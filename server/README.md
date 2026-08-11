# Agent Farm server

Node.js 20+、Express、SQLite、Git worktree 与 Claude Agent SDK 的本地中央队列服务。规范接口是 `/api/*` 与 `/ws`；`/workspaces*` 仅为 deprecated compatibility route。

完整文档：

- [Agent Farm 总览](../docs/agent-farm/README.md)
- [HTTP API](../docs/agent-farm/contracts/http-api.md)
- [WebSocket ledger](../docs/agent-farm/contracts/websocket-ledger.md)
- [Schema 与迁移](../docs/agent-farm/schema.md)
- [生命周期](../docs/agent-farm/lifecycle.md)
- [运维](../docs/agent-farm/operations.md)
- [部署](../docs/agent-farm/deployment.md)
- [排障](../docs/agent-farm/troubleshooting.md)

## 安装与启动

```bash
pnpm --dir server install
cp server/.env.example server/.env
pnpm --dir web-app install
pnpm --dir web-app build
pnpm --dir server start
```

默认：

```text
HTTP: http://127.0.0.1:7878
UI:   http://127.0.0.1:7878/web/
WS:   ws://127.0.0.1:7878/ws?after_seq=0
Data: ~/.agent-farm
```

开发时热重载：

```bash
pnpm --dir server dev
```

Typecheck：

```bash
pnpm --dir server typecheck
```

Server `start` 由本地 `tsx` 执行 TypeScript 源码；release 必须包含 `src/`、`migrations/`、dependencies，以及已构建的 `web-app/dist`。

`better-sqlite3` 当前固定为 12.11.1，其 package engine 声明支持 Node 20、22、23、24、25、26；项目最低版本仍是 Node 20。使用依赖未声明支持的 Node 版本时不要假定 native binary 可工作。

## 数据与 migration

数据布局：

```text
AGENT_FARM_DATA_DIR/
  db.sqlite
  db.sqlite-wal
  db.sqlite-shm
  worktrees/
  artifacts/
  logs/
  benchmarks/
```

SQLite 使用 WAL、foreign keys、5 秒 busy timeout、synchronous NORMAL。当前 migrations 为 000/001/002；每个文件独立 transaction，成功记录 filename 与 SHA-256。已有数据库先 read-only 检查未知 version 与 checksum，任何不兼容都在创建 WAL、metadata 或 reconciliation event 前 zero-write fail-fast。002 在单 transaction 内创建 `ledger_metadata` schema，并完成 legacy workspace/event backfill 与 repository `last_event_seq`；持久 singleton `ledger_id` row 在 migrations 成功后初始化。失败不留 partial rows/schema。没有 down migration。备份/恢复必须停服并处理整个 data directory，而不是在线只复制 `db.sqlite`。

## Claude Agent SDK

Agent Farm 调用 `@anthropic-ai/claude-agent-sdk` 的 `query(...)`。当前约束：

- `cwd` 是 task worktree；
- `persistSession: true`；
- `settingSources: []`，SDK run 不再从 settings 文件加载额外 behavior；
- `permissionMode: "default"`；
- 工具 allowlist：Read、Write、Edit、Glob、Grep、Bash；
- `canUseTool` 拒绝 worktree 外路径与 `.git`；
- sandbox `enabled` 且 `failIfUnavailable`，读写仅 cwd，网络域/Unix socket/local bind 均拒绝；
- 禁止 peer agent、workflow、网络抓取和外部消息工具。

Provider 检测以显式 env 为准。配置不存在时 run 为 `provider_blocked`；preflight 即使 ready，运行时仍可能因 401/403 进入 `provider_blocked`。只有 SDK result subtype `success` 且 `is_error=false` 才是 succeeded。

Cost 来自 SDK `total_cost_usd`。Reported `0` 保留为 `0`；无 result 为 `null`，不估算。

## 配置

参考 [`.env.example`](.env.example)。启动优先级：

```text
shell env > server/.env > ~/.claude/settings.json env
```

共享 `load-env` module 在 `db.ts` 解析 `AGENT_FARM_DATA_DIR` 之前运行，因此 `server/.env` 能选择正确 SQLite，而不是打开默认 DB 后才生效。Settings env 只用于 server 启动注入；SDK query 本身使用 `settingSources: []`。`AGENT_FARM_DISABLE_USER_SETTINGS=1` 禁止启动注入。

最低运行变量：

```text
AGENT_FARM_DATA_DIR
HOST
PORT
AGENT_FARM_RUN_TIMEOUT_MS
AGENT_FARM_MAX_BUDGET_USD
AGENT_FARM_STALE_RUN_MS
AGENT_FARM_JSON_LIMIT
AGENT_FARM_DIFF_RESPONSE_MAX_BYTES
```

Git commit identity 可通过标准 `GIT_AUTHOR_*`、`GIT_COMMITTER_*` env 覆盖。未提供时当前 Git 层使用 `Agent Farm <agent-farm@localhost>`，committer 默认跟随 author；正式仓库应显式设置可审计身份。

## HTTP/WS 与 request ID

健康检查：

```bash
curl -i -H 'x-request-id: local-health' http://127.0.0.1:7878/api/health
```

REST response 带 `x-request-id`；error body 的 `details` 可选。Task list 是同 transaction snapshot；detail 用 row-version retry 防 torn state，`review_stale` 是 boolean|null，`base_commit` 对外稳定。Repository persisted provenance 与 live observation 分开。WebSocket browser Origin 必须与 HTTP Host 同源；CLI 可无 Origin。Ledger history 来源始终是 SQLite，REST 单 event 与 WS 精简 event shape 不同。

`GET /api/events` 每次最多返回 10,000 events，固定返回 `events`、页尾 `last_seq`、`has_more` 与捕获的账本头 `ledger_last_seq`。Terminal task 的 diff 来自 retained artifact；HTTP truncation 按 UTF-8 byte boundary，且先验证 size/digest/UTF-8。WebSocket replay 内部按 250 条读取，但 envelope 会在 4 MiB frame 边界下组批。`ledger_id` 是 `ledger_metadata` 中的持久 UUID：restart 稳定，同路径 SQLite 被替换时变化；客户端必须重置旧 cursor。

## 静态服务安全边界

- `/web/` 服务 `web-app/dist`；build 缺失时页面返回 503，API 可用。
- `/assets` 只在 bind host 为 loopback 且 `FarmCreator/assets` 存在时注册。
- 映射指向整个 asset tree；禁止反向代理到公网或公开发布既有 Farm/Cocos 资源。
- 当前无应用鉴权，不是互联网多租户控制面。

## 关闭与恢复

SIGINT/SIGTERM 会 cancel SDK runs、等待后台 run 最多 10 秒、关闭 WS/HTTP/SQLite。启动 reconciliation 将 interrupted queued/running run 标为 crashed，使 task `recovery_required`；prepare/harvest 仅在 Git registry、base commit、operation journal 或精确 commit trailer 足以证明时自动收敛。其余情况保留人工恢复状态。
