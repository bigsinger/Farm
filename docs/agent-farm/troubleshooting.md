# 以 request_id 为中心的排障

## 先建立证据包

对每个失败请求都保存：

1. Method、URL、时间、调用方最后连续 ledger seq；
2. 请求头 `x-request-id`（建议主动设置一个不超过 128 字符的唯一值）；
3. HTTP status、响应头 `x-request-id` 与完整 error body；
4. Server log 中同一 `[request <id>]` 行；
5. 对应 task/run/repository ID、task timeline 与相关 artifact digest；
6. `/api/health`、最新 residual artifact ID/digest；
7. 若涉及 Git，保存 base HEAD/status/worktree registry，但不要先执行破坏性修复。

示例：

```bash
request_id="af-debug-$(date +%s)"
curl -i -H "x-request-id: $request_id" \
  http://127.0.0.1:7878/api/tasks/<task-id>
```

调用方 ID 非空且不超过 128 字符时会原样回显；否则服务生成 UUID。Error `details` 可选，不能因键缺失误判 envelope 损坏。未知异常只向客户端返回 `internal_error`；细节在 server log 的同 request ID 下。

WebSocket upgrade 不经过 Express middleware，plain-text 400/403/404/405 没有 request ID。此时记录连接 URL、Origin/Host、after_seq、时间、HTTP status 和相邻 REST request ID，再关联 `[ws]` log。

## 快速分流

### 服务不能启动

检查 stderr 和：

```bash
pnpm --dir server typecheck
```

常见原因：

- `PORT` 不是 1..65535 的整数；
- data directory 不可写；
- native `better-sqlite3` 与 Node runtime 不匹配；
- migration filename/version 重复；
- 已应用 migration filename 或 SHA-256 漂移；
- SQLite 损坏/锁定；
- server dependency 缺失。

Migration checksum mismatch 或 `database contains migration(s) unknown to this binary` 不可通过编辑 `schema_migrations` 或旧 SQL 绕过。该检查应在任何 SQLite/WAL/ledger/reconciliation 写入前失败；先复制并比较文件 mtime/size/`schema_migrations` 验证 zero-write，再使用认识该 version 的 binary，或停服后按 [deployment rollback](deployment.md#6-rollback) 恢复完整数据副本。

### Health 成功但页面 503

若 API 正常、`/web/` 返回 `web_build_missing`：

```bash
pnpm --dir web-app build
```

确认 `web-app/dist/index.html` 存在且 server release 与 build 同版本。`vite preview` 没有 backend proxy，不能代替 server 的 `/web/` 集成入口。

### 页面背景/图片 404

先看 `HOST`。`/assets` 只在 loopback bind 且 `FarmCreator/assets` 存在时注册。非 loopback 缺图是安全边界；禁止为了修复 UI 将既有 Farm/Cocos asset tree 暴露公网。公开部署必须先替换/移除资源并重新设计映射和授权，见 [deployment](deployment.md#静态资源许可与公网边界)。

## Task 创建与 prepare

### `invalid_request` / path 错误

用 request ID 查看 `details` 或 message。`repo_path` 和 `prompt` 必需；claim/magnet path 必须仓库相对，拒绝 absolute、`..`、NUL、`.git`。确认 JSON body 是 object 且未超过 `AGENT_FARM_JSON_LIMIT`。

### Task 立即 blocked

读取：

```bash
curl -i -H 'x-request-id: af-blocked-detail' \
  http://127.0.0.1:7878/api/tasks/<id>
```

查看 `task.status`、`blocking_reasons`、repository `last_error`、worktree health 和 timeline。Gitless/missing/unavailable repo 会真实 blocked。不要手工把 status 改为 seeded；修复 path/permission/Git 后重新创建 task，或使用可证明的 recovery 流程。

### Worktree missing / dirty

在不修改状态前记录：

```bash
git -C /repo worktree list --porcelain
git -C /repo status --porcelain=v1
```

Task path 必须与 Git registry 和 branch `agent-farm/<task-id>` 同时匹配。`worktree_health` 会报告实际 `branchName` mismatch；run、diff、harvest、wilt 都不能在 externally switched/detached/wrong-branch tree 上继续。未注册目录不会被服务递归删除；错误 branch 的 registered worktree也不会被 wilt 当作本 task 删除。外部删除后先评估 `git worktree prune`，再通过 API wilt/reconcile，保留 cleanup proof。

## Queue、dependency 与 overlap

Task 不启动或 harvest 被 gate 时，检查 detail：

- `dependency_ids` 及其 task status；
- `overlaps[]` 的 `evidence_type/status/blocking`；
- `blocking_reasons`；
- `group`。

只有显式 dependency 形成 group。Claim、magnet、diff 相交不会自动形成 dependency；若看到两个 task 因 overlap 同组，应视为投影/客户端错误。反过来，open blocking overlap 虽不是 dependency，仍合法阻止 run/harvest。解决真实冲突后调用 resolve/release；不要为了放行而直接改 SQLite。

常见冲突：

- `dependency_cycle`：重画显式 DAG；
- `cross_repository_dependency`：dependency 必须同 repository；
- claim mode 冲突：先 release 原 claim，再添加新 mode；
- unresolved exclusive claim：协调 owner 后记录 resolution；
- magnet overlap：warning evidence，默认不阻断。

## Provider 与 run

### `provider_blocked`

查看 run 的 `error_code`：

- `provider_auth_missing`：Agent Farm 未检测到显式 provider env；
- `provider_auth_failed`：provider 返回 401/403 或可识别认证/授权错误。

`GET /api/health.provider` 只是配置种类，不是联网验证。Server detection 支持 provider flags、direct credential/custom base URL、显式 `ANTHROPIC_PROFILE` 和完整 WIF env。磁盘 default profile 没有显式 `ANTHROPIC_PROFILE` 时仍视为 unavailable。

修复 credential 后使用 retry/recover 创建新 run；旧 blocked run 保留。禁止手工改成 succeeded，禁止用构造 result 冒充 provider。

### Provider E2E blocked，但 server 看起来已配置

Provider test gate 还要求 `AGENT_FARM_RUN_PROVIDER_E2E=1`，以及 `CLAUDE_SETTINGS_PATH` 或 `~/.claude/settings.json` 存在、可读、合法 JSON。检查 `provider-blocked.json` 的 reason。即使 process env 有 key，settings 文件不存在也会先 blocked。Gate exit code 2 是未进入 runtime 的 blocked 证明，不是 test passed。

若 gate ready 后真实 SDK 返回 401/403，provider lifecycle test 会验证 blocked run/task、SDK provenance、wilt cleanup 与 restart replay，并可作为安全失败测试通过；此时检查 `provider-runtime-blocked.json`，其 `provider_status` 必须为 `blocked`。不要把 suite exit 0 误读为 provider verified。

### Timeout、cancel、crash

- `timed_out`：检查 run `timeout_ms`、SDK latency 和 server shutdown；
- `cancelled`：确认操作人/request ID 和 terminal timeline；
- `crashed` / task `recovery_required`：通常是 iterator 无 result、进程重启、query 初始化或 diff capture 无法证明。

不要假设旧 session iterator还存在。保存 SDK terminal event、stdout/stderr、worktree status 后显式 recover/retry。

### Cost 为 `0` 或 `null`

`0` 表示 SDK 明确报告零成本，是合法值；`null` 表示没有 SDK result/cost。Agent Farm 不估算。出现 `cost_event_mismatch` 时，按 residual 的 `source_event_seq` 对照最新 `agent.sdk.result.*` payload 与 run 行；不要把 null 改成 0 或反之。

## Diff、review 与 harvest

### `diff_artifact_missing`

当前 task digest 没有 matching patch artifact。保存 task timeline、artifact list、data directory 路径和 request ID；不要提交空 approval。检查 artifact write/digest 和 worktree，必要时通过真实 run/recovery 重新 capture。

### Diff 太大、terminal 或 truncated

`AGENT_FARM_DIFF_RESPONSE_MAX_BYTES` 控制 HTTP UTF-8 byte 上限。`large=true`、`truncated=true` 不表示磁盘 artifact 丢失；prefix 会回退到合法 UTF-8 boundary，CJK 不会产生 replacement character。Harvested/wilted/cancelled task 的 worktree 可已清理，GET diff 应读取 retained artifact。`diff_artifact_changed` 表示 size/digest 漂移，`diff_artifact_invalid_utf8` 表示持久 patch 非法；两者都应保留原文件做取证，不要绕过验证。

### `review_stale`

调用方 digest 与 current digest 不同，或 approval 绑定旧 digest。重新获取 diff、人工审查新 digest并提交新 review。不能复用旧 approval。Task summary/detail 的 `review_stale=null` 不是有效 approval：它表示 live worktree 尚未验证；只有 detail live refresh 后 `false` 且 exact digest 相等才是当前投影证明，harvest 仍会在执行路径再次 capture。

### `merge_conflict`

服务尝试回滚 base 到可信 pre-commit。立刻记录 request ID、base HEAD/status、operation journal、task worktree和 trailer：

```bash
git -C /repo status --porcelain=v1
git -C /repo log --first-parent --format='%H%n%B%n---' -n 50
```

若 base clean 且 task 回到 review state，在 task worktree 解决冲突、重新 capture/review。若状态为 `recovery_required`，停止该 repository 的 harvest，按 journal/trailer 人工 reconcile。不要在 base 手工提交或 reset 掉 winner。

### Concurrent harvest loser

同仓库 lock 与 FIFO mutex 保证一个 authoritative winner。Loser 可能收到 lock/state/conflict 响应；用 request ID 对照 winner 的 harvest outcome、base HEAD 和精确 `Agent-Farm-Task` trailer。禁止用 loser 的旧 pre-commit reset base。

## Ledger 与 WebSocket

### REST cursor ahead

HTTP 409 `event_cursor_ahead` 表示客户端 cursor 大于当前 ledger。检查是否恢复/替换了 data directory、切错环境或客户端缓存来自另一 ledger。WS `ledger_id` 是 DB 内持久 UUID：restart 不变，同路径 DB replacement 会变化。Identity 变化或 cursor 没旧 identity binding 时清空 cursor/recent tail，从 0 分页 REST 重同步；不能只比较 filesystem path。

### WS `resync_required`

`after_seq` 超前。服务发送 envelope 后 close 1008。清除错误 cursor，调用 REST events，再重连。

### Replay gap / close 1011

停止应用后续 event，保存最后连续 seq 与 `[ws]` log。在停服或只读副本执行：

```bash
sqlite3 /path/to/db.sqlite 'PRAGMA integrity_check;'
sqlite3 /path/to/db.sqlite 'SELECT MIN(seq), MAX(seq), COUNT(*) FROM audit_events;'
```

Append-only seq 出现真实缺口或 invalid payload 是持久数据问题；不要让客户端跳过。恢复备份前保存当前 data directory。

### Close 1003/1009/1013

- 1003：binary/invalid JSON/unsupported message/invalid ack；
- 1009：单个 ledger frame 超过 4 MiB；
- 1013：backpressure、send timeout 或 replay buffer 超限。

1009 常由过大 audit payload 引起；定位 event seq/request ID，修复未来写入边界但不改旧 ledger。1013 检查客户端消费速度，改用 REST 分批 replay 后再重连。

## SQLite、migration 与 residual

### SQLite busy/integrity

当前 busy timeout 为 5 秒，WAL + synchronous NORMAL。确认只有一个 server 使用 data directory、磁盘空间足够、备份工具支持 WAL。不运行服务时再做 integrity check。不要在活跃数据库上随意复制单个文件。

### Residual finding

Artifact 只报告，不修复：

1. 保存 artifact 与 SHA-256；
2. 对 blocking finding 停止相关 repository 写操作；
3. 用 `source_event_seq`、entity IDs、evidence/path 关联 ledger/Git；
4. 确定权威状态并执行最小幂等修复；
5. 追加 audit/outcome，不改旧 event；
6. 再 scan，比较前后 artifact；
7. 保留 cleanup proof。

`GET latest` 404 表示尚未扫描，不是无问题。

## Wilt 与 cleanup

Cleanup failure 会让 task `recovery_required`。检查 outcome、Git registry、branch 和 cleanup proof。不要直接 `rm -rf worktrees/<id>`；这会留下 registry/branch residual。E2E 的 `cleanup-proof.json` 中六个 boolean 必须全部为 true，临时 repo/data/home 才算清除；proof artifact 本身按 retention policy 保留。

## Legacy backfill、升级与回滚失败

Migration 002 后，旧 workspace/event 应同时出现在 current/compatibility API 与 append-only ledger。Legacy harvested 被降级为 stale review，active/unknown state 要求 recovery，所有 backfilled task `auto_start=0`。若旧行缺失或产生 partial backfill，停止服务并保存完整 data root；002 是单 transaction，正常 checksum/SQL failure 不应留下 `ledger_metadata`、columns 或 backfill rows 的半状态。

先区分：

- migration 文件 transaction 失败；
- application code rollback；
- 整个 data directory 恢复。

三者不是同一操作。若新版本已产生 task/Git commit，恢复旧 SQLite snapshot 会分叉；保留新旧证据，按 trailer/journal/seq reconcile。完整步骤见 [deployment](deployment.md) 和 [operations](operations.md)。
