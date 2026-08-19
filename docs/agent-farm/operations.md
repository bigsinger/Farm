# 运维、恢复、回滚与资源清理

## 1. 运行前检查

最低要求：

- Node.js `>=20.11.0`；当前 `better-sqlite3` 12.11.1 的 package engine 声明支持 Node 20、22、23、24、25、26；
- pnpm；
- Git；
- 可写的 `AGENT_FARM_DATA_DIR`；
- 已构建的 `web-app/dist`；
- 如果需要真实 Agent run：有效的 Anthropic、Bedrock、Vertex、Foundry 或兼容 endpoint 凭据。

当前版本只接受 loopback bind：`127.0.0.1`、`localhost`、`::1`。非 loopback / wildcard HOST 会在创建 data directory、SQLite、WAL、migration 或 ledger metadata 前 fail closed。不要把 Agent Farm 挂到 LAN/public reverse proxy；未来远程访问必须单独设计 TLS、认证、授权、CSRF 与 tenant/provider isolation。本实现也不把固定 `local_user` review actor 宣称为远程 principal。

Agent run 使用两级 Sandbox Runtime：outer 包住整个 Claude Code 进程，inner 只执行 workspace Bash。Bash 不再走 built-in 工具，而是经 `mcp__workspace__bash`；sandbox unavailable 记为 `sandbox_blocked`（`provider_status=not_run`），不得伪装成 provider success/failure。SDK ledger 只保留结构化 allowlist，不保存 command/tool 原文。macOS 上若 data dir 路径过长，SRT 临时 socket 会落到短 `/tmp/af*` 路径。

健康检查：

```bash
curl --fail http://127.0.0.1:7878/api/health
```

返回真实 ledger cursor、活跃 run 数和非敏感 provider 类型。它不会返回 token、API key 或完整 provider URL。

## 2. 配置

| 变量 | 默认 | 说明 |
|---|---:|---|
| `AGENT_FARM_DATA_DIR` | `~/.agent-farm` | SQLite、worktrees、artifacts、logs、benchmarks 的根目录；必须使用绝对隔离目录运行并行实例 |
| `HOST` | `127.0.0.1` | HTTP/WS bind address；只接受 `127.0.0.1` / `localhost` / `::1` |
| `PORT` | `7878` | 监听端口 |
| `AGENT_FARM_BROWSER_ORIGINS` | 派生自 HOST/PORT 的三个 loopback origin | 本机 Vite/loopback TLS proxy 的精确 Origin allowlist；每项必须是绝对 http(s) loopback origin、显式端口、无 path/query/hash |
| `AGENT_FARM_RUN_TIMEOUT_MS` | 30 分钟 | Agent run 默认超时 |
| `AGENT_FARM_MAX_BUDGET_USD` | `5` | 单 run 默认 provider 预算 |
| `AGENT_FARM_STALE_RUN_MS` | 5 分钟 | residual stale-run 阈值 |
| `AGENT_FARM_JSON_LIMIT` | `2mb` | HTTP JSON body 限制 |
| `AGENT_FARM_DIFF_RESPONSE_MAX_BYTES` | 4 MiB | `/api/tasks/:id/diff` 的 patch 响应截断阈值；不删除完整 artifact |
| `AGENT_FARM_DISABLE_USER_SETTINGS` | unset | 设为 `1` 时不读取 `~/.claude/settings.json`，用于隔离测试/服务账户 |

Provider 环境变量见 `server/.env.example`。Shell env 优先于 `server/.env`；project env 再优先于 `~/.claude/settings.json` 中尚未设置的 env。用户 settings 只会补 provider/transport 相关键（`ANTHROPIC_*`、`CLAUDE_CODE_USE_*`、AWS/Google/Azure 与明确 proxy/证书变量），不会把任意 GitHub/云无关 secret 复制进 server 环境。SDK query 使用 `settingSources: []`，不会加载 settings behavior。不要把 secret 写入 Git、audit payload、benchmark 或测试 artifact。

## 3. 数据布局

```text
AGENT_FARM_DATA_DIR/
  db.sqlite
  db.sqlite-wal
  db.sqlite-shm
  worktrees/<task-id>/
  artifacts/<task-id>/...
  logs/
  benchmarks/<artifact-id>.json
  runs/<run-id>/
```

目录按 `0700` 创建；benchmark/artifact 临时文件使用原子 rename。备份与恢复必须把 SQLite database 视为一个 WAL 数据库，不能只在服务运行时随意复制 `db.sqlite` 而忽略 WAL。

## 4. 升级与 migration

1. 停止接收新 task，并等待活跃 run 结束或显式 cancel/wilt。
2. 记录当前应用 commit、`/api/health`、最新 ledger seq 和 residual artifact ID。
3. 正常停止服务，确认进程退出。
4. 在停服状态下复制整个 `AGENT_FARM_DATA_DIR` 到受保护备份位置；保留权限和 symlink 元数据。
5. 部署新代码并先运行：

```bash
pnpm --dir server typecheck
```

```bash
pnpm --dir web-app build
```

6. 用备份副本或 staging data directory 启动一次，确认 migrations、`PRAGMA integrity_check`、API 和 replay。
7. 再使用真实数据目录启动。
8. 运行 residual scan 并对比 ledger cursor、task 数和 cleanup proof。

Migration 是有版本、带 SHA-256 的 forward migration。已有非空 SQLite 先 read-only 校验：数据库含任何当前 binary 不认识的 version，或已知 filename/checksum 漂移，都会在创建 WAL/metadata/reconciliation event 前 zero-write fail-fast。当前 002 在一个 migration transaction 中创建 `ledger_metadata` schema、补齐 repository provenance 与 legacy workspace/event backfill；fresh database 的 singleton UUID `ledger_id` row 在 migrations 成功后由启动初始化逻辑写入。Checksum/SQL 任一步失败会整体回滚 002，不留下 partial schema/backfill。已应用 SQL 文件不得原地修改；新增 schema 必须新增 migration 文件。

### Migration 回滚

本项目不提供可能丢数据的自动 down migration。若新 migration 失败：

1. 停止新版本服务；
2. 保存失败数据库和日志用于调查，不能覆盖唯一证据；
3. 将完整数据目录移出活动路径；
4. 从升级前停服备份恢复整个目录；
5. 启动旧应用 commit；
6. 验证 SQLite integrity、ledger last seq、task/outcome 数和 Git worktree registry；
7. 生成 residual artifact，确认恢复后没有新 orphan 或 mismatch。

如果新版本已经处理了任务或产生了 Git commit，不能只恢复旧 SQLite 快照：那会使 Git 与 ledger 分叉。必须先停止操作，保留新数据库，再逐 task 以 commit trailer 和 operation journal reconcile；必要时保持 `recovery_required`，由人工决定权威状态。

## 5. 应用回滚

应用代码回滚只在旧版本能够读取当前 schema 时安全。推荐策略：

- 先在备份副本验证旧 commit；
- 不删除新表或 audit events；
- React build 与 server commit 一起回滚，避免 API decoder 不匹配；
- 回滚后重连 `/ws?after_seq=<previous last seq>`，验证 replay 连续；
- 运行 integration 和 residual scan。

不执行 tag、release 或 deploy 的开发变更不构成应用发布。PR 合并也不自动意味着生产 rollout。

## 6. Restart reconciliation

兼容性 read-only probe 和 migrations 通过后，正常服务启动会执行以下 mutation，并在完成时追加 `server.reconciliation.completed`；因此正常启动一个数据副本会推进 ledger seq。未知 future migration/checksum mismatch 则必须在这些写入前退出：

1. 清除进程死亡后不再有效的 repository locks；
2. 将没有 durable SDK result 的 queued/running run 标为 crashed；
3. 将对应 task 标为 `recovery_required`，不伪造 SDK session resume；
4. 对 interrupted worktree prepare 检查确定性路径、branch 与 base SHA：三者精确匹配才补齐投影，否则不触碰未知目录；
5. 对 interrupted harvest 仅检查 base first-parent、journal `pre_commit` 之后的有限历史中的精确 `Agent-Farm-Task` trailer；
6. 如果 commit 已落地，补写 confirmed outcome 并 cleanup；
7. 如果未落地且 journal 同时有可信 `pre_commit` 与 `base_branch`，在 branch 精确匹配时 abort/reset/clean 回到该 SHA，并验证 HEAD/clean；
8. 缺少边界、branch 不匹配或任何 Git 验证失败时保留 `recovery_required` / `needs_recovery` 并记录审计证据。

`POST /api/tasks/:id/runs/recover` 会创建新 run lineage，不会隐式继续旧迭代器。

## 7. Merge conflict 与 concurrent harvest

Harvest 前必须满足 review gate、dependency、overlap、worktree、branch 与 clean checks。

- Squash/commit 失败时，Git primitive abort/reset/clean 回到调用时记录的 `pre_commit`，并验证 base clean。
- 同仓库操作有 SQLite lock；进程内 Git primitive 还有 canonical-root FIFO mutex。
- 并发请求恰有一个 authoritative terminal commit。Loser 重新读取 winner 后的 HEAD，不能使用过时 pre-commit 覆盖 winner。
- Merge conflict 返回结构化错误；task 回到可审查/恢复状态，base 不保留 conflicted index。

人工解决冲突应在 task worktree 中完成，重新 capture diff 并重新 review。不要在 base checkout 手工提交来绕过 ledger。

## 8. Cost 与资源预算

真实 SDK result 中的 `total_cost_usd`、turns、duration、usage 和 model usage 原样存储。SDK 明确报告 `0` 时保留 `0`；没有 result/cost 时保持 `null`。二者都不会被本地估算替代。

建议：

- 为每个 run 设置 `max_budget_usd` 和 `max_turns`；
- 设置合理 timeout；
- 并行 provider suite 使用独立测试预算；
- cancellation 同时发送 `interrupt` 与 abort；
- 定期对比 task/run cost 与 SDK result event，`cost_event_mismatch` 必须调查；
- audit payload 对 token、API key、authorization、cookie 和 secret 键做 redaction。

Provider gate 不可用时写 blocked proof 并以 exit code 2 结束。Gate ready 后真实调用仍可能被 401/403 阻挡；provider lifecycle suite 可以通过这一安全失败路径，但 runtime proof 的 `provider_status` 必须是 `blocked`，不能标为 verified。禁止用本地 fixture 数值、构造 result 或手工 DB 更新冒充真实成本与成功 run。

## 9. Wilt 与 cleanup

Wilt 是需要人工确认的终态操作：

1. task 进入 `wilting` 并写 operation journal/outcome；
2. 活跃 run 被 interrupt/abort；
3. 只对 Git registry 中路径和 branch 精确匹配的 worktree 执行 remove；
4. 删除 task branch；
5. 写 cleanup proof；
6. 成功进入 `wilted`，失败进入 `recovery_required`。

Wilt 不删除 audit history、reviews、outcomes 或 artifact metadata。已经 harvested 的 task 不能 wilt。

不要直接 `rm -rf worktrees/<id>`：这会留下 Git registry 与 branch residual。若目录已经被外部删除，先 `git worktree prune`，再通过 API wilt/reconcile 并保留审计证据。

## 10. Residual scan 与人工修复

运行：

```bash
curl --fail -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:7878/api/benchmarks/residual
```

Artifact 是只读审计结果，不自动修复。处理顺序：

1. 保存 artifact 和 SHA-256；
2. 对 blocking residual 停止相关仓库的 harvest；
3. 使用 evidence 中的 task/run/repository/path/seq 定位 SQLite 与 Git；
4. 确认权威状态，执行最小、幂等修复；
5. 写新的 audit/outcome，而不是改旧 audit event；
6. 再次扫描并对比 residual ID；
7. 保留前后 artifact 作为 cleanup proof。

常见类型：

| 类型 | 处理原则 |
|---|---|
| orphan worktree | 先验证 Git registry、branch 与所有者；确认无人使用后走 Git cleanup |
| orphan run | 恢复 task lineage 或将 run 标为需要人工 reconcile；不删除 run 证据 |
| dangling task | 恢复精确 worktree/base，或 wilt 并记录原因 |
| double terminal | 停止写操作，用 Git commit trailer 与 ledger seq 选择权威终态 |
| review/merge mismatch | 阻止 harvest 声明，重新绑定 review/digest/outcome |
| stale run | 检查真实进程/provider；明确 cancel/recover |
| cost/event mismatch | 对照 SDK result，禁止编造或改成零 |

## 11. SQLite 与 artifact 检查

停服或只读副本上检查：

```bash
sqlite3 /path/to/db.sqlite 'PRAGMA integrity_check;'
```

预期仅输出 `ok`。再检查 migration 与 ledger：

```bash
sqlite3 /path/to/db.sqlite 'SELECT version, filename, sha256, applied_at FROM schema_migrations ORDER BY length(version), version;'
```

```bash
sqlite3 /path/to/db.sqlite 'SELECT id, ledger_id, created_at FROM ledger_metadata;'
```

预期 metadata 只有 singleton `id=1`；同一数据库 restart 时 ID 不变，替换 DB 后应变化。

```bash
sqlite3 /path/to/db.sqlite 'SELECT MIN(seq), MAX(seq), COUNT(*) FROM audit_events;'
```

不要 update/delete `audit_events`；触发器会拒绝。不要修改 benchmark JSON 后继续使用旧 digest。

## 12. 安全与许可

- 所有 Git 调用使用 `execFile` 参数数组，不使用 shell 字符串插值。
- claim/magnet path 必须是仓库相对路径，拒绝 absolute、`..`、NUL 和 `.git`。
- Agent SDK 工具 allowlist 仅包含本地读写/搜索/Bash；网络、peer agent、workflow 和外部消息工具被禁用。
- SDK query 使用 `settingSources: []`、`permissionMode: "default"` 与 `canUseTool` path guard；sandbox 必须可用，否则 fail closed。读写仅限 task worktree，网络、Unix socket 与 local bind 均拒绝。
- Server 错误响应带 request ID；未知异常不返回 secret。WebSocket upgrade 不经过该 middleware，需用 cursor、Origin/Host、close code 和 `[ws]` log 关联。
- UI 中展示 prompt/event/details 前执行敏感文本 redaction。
- `/assets` 只在 loopback bind 时注册，但映射整个 `FarmCreator/assets`。现有 Cocos/legacy 美术资源仅供学习研究，禁止通过反向代理或其他方式公开发布。
