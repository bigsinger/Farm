# HTTP API 契约

规范 API 前缀为 `/api`。所有 JSON mutation 使用 `content-type: application/json`；Express body parser 开启 `strict: true`，因此顶层 JSON 必须是 object 或 array（primitive 会由 parser 拒绝）。领域 handlers 只接受 object 语义，array 会被当作空 object 并随后因必需字段缺失而返回 validation error。默认大小上限为 `2mb`，可由 `AGENT_FARM_JSON_LIMIT` 覆盖。Malformed JSON 返回 `invalid_json`，超限返回 HTTP 413 `request_body_too_large`，都带 request ID。

## Request ID 与错误 envelope

调用方可发送最长 128 字符的非空 `x-request-id`；否则服务生成 UUID。所有经过 Express 的响应都带 `x-request-id`。结构化错误：

```json
{
  "error": {
    "code": "review_stale",
    "message": "The requested harvest digest is not the current diff digest.",
    "details": {
      "requested_diff_digest": "old",
      "current_diff_digest": "new"
    },
    "request_id": "b5a819dd-2ff1-42f8-8f17-c0fae7cebbfd"
  }
}
```

`details` 是可选字段；没有 details 时整个键省略。未知异常返回 HTTP 500 `internal_error`，服务日志使用 `[request <id>]`。排障时始终保存响应头和 body 的同一个 ID。WebSocket upgrade 是例外，见 [WebSocket ledger](websocket-ledger.md)。

## Health

### `GET /api/health`

```json
{
  "ok": true,
  "ledger_last_seq": 12,
  "active_runs": 0,
  "provider": null,
  "database": "db.sqlite"
}
```

`provider` 是非敏感 provider kind 或 `null`，不是凭据有效性的联网探测。`GET /health` 是 deprecated 兼容健康路由，返回较小 shape 并带 `deprecation: true`。

## Task 读取与创建

### `GET /api/tasks`

返回：

```text
{ tasks, last_seq, generated_at, residual_health? }
```

`tasks` 是在一个 SQLite transaction 内生成的 task summary 数组；`last_seq` 与该 snapshot 同一 transaction，`generated_at` 是 epoch ms。存在最新 residual artifact 时才有 `residual_health`。Task summary 现包含持久 `base_commit` 和 `row_version`。未做 live Git refresh 的 approved summary 只能返回 `review_stale: null`（未知），不能根据两个旧 SQLite digest 肯定为 false。

### `POST /api/tasks`

请求：

```json
{
  "repo_path": "/absolute/path/to/repository",
  "prompt": "更新 API 契约并运行检查",
  "title": "更新契约",
  "dependencies": ["upstream-task-id"],
  "claims": [{"path":"docs/agent-farm","mode":"exclusive"}],
  "magnet_paths": ["server/src/ledger.ts"],
  "auto_start": false
}
```

- `repo_path`、`prompt` 必需。
- dependencies 也接受 `dependency_ids` 别名。
- `title` 省略时取 prompt 第一行前 120 字符。
- `claims[].mode` 是 `exclusive` 或 `shared`；path 与 magnet 均为规范化的仓库相对路径，拒绝 absolute、`..`、NUL 与 `.git`。
- `auto_start` 默认 `true`；类型必须是 boolean。

HTTP 201 返回完整 task detail，并额外包含 `claim_conflicts`。Git 仓库会建立真实 branch/worktree；gitless 或不可访问路径会产生 blocked task 和真实原因，而非伪造仓库。

### `GET /api/tasks/:id`

返回 task detail：

```text
task, repository, dependencies, dependents,
claims, overlaps, runs, artifacts, reviews, outcomes, timeline,
group, eligibility, worktree_health, residual_health
```

Detail 组装会读取 live repository/worktree，必要时刷新 approved task 的真实 diff，并用 `row_version` 最多重试三次，拒绝把并发 mutation 拼成 torn snapshot；无法稳定时返回 409 `task_snapshot_changed`。Task summary 中 `base_commit` 明确对外暴露。

`review_stale` 是 `boolean | null`：`true` 表示 persisted stale/digest mismatch；`false` 只在 non-terminal approved task 已完成本次 live diff refresh、且 exact approved/current digest 相等时返回；`null` 表示 persisted digest 看似相等但本响应未验证 live worktree。非 approved task 可为 `false`。Harvest 仍在执行路径重新 capture，只有 exact digest approval 才放行。

Repository 同时给出两类来源：`provenance` 指向 repository `last_event_seq`（无则 creation seq）的持久 audit event；`observation_provenance` 则说明本次 live Git inspection，带独立 digest/recorded-at。`branch/head_commit/clean/dirty/checked_at` 是 live observation，不能冒充 persisted ledger state。

`group` 只由显式 dependency 图计算。Claim、magnet、diff 交叠只出现在 `overlaps`；它们不会自动建立 dependency 或协作关系。不过 `status=open && blocking=true` 的 overlap 会进入 `blocking_reasons`，阻止 run 和 harvest。

## Dependency、claim 与 overlap

| Method | Path | Body / 语义 |
|---|---|---|
| POST | `/api/tasks/:id/dependencies` | `{ "dependency_id": "..." }` |
| POST | `/api/tasks/:id/dependencies/:dependencyId` | path param 版本 |
| DELETE | `/api/tasks/:id/dependencies/:dependencyId` | 删除显式边 |
| DELETE | `/api/tasks/:id/dependencies` | body 中 `dependency_id` |
| POST | `/api/tasks/:id/claims` | `{ "path": "...", "mode": "exclusive|shared" }` |
| POST | `/api/tasks/:id/claims/:claimId/release` | release claim |
| POST | `/api/tasks/:id/claims/:claimId` | release 的兼容别名 |
| POST | `/api/tasks/:id/overlaps/:overlapId/resolve` | `{ "resolution": "..." }` |

跨 repository dependency、self dependency 和 cycle 返回结构化冲突。相同 task/path/mode 的重复 claim 幂等；同 task/path 不同 mode 冲突。至少一方 exclusive 的 claim overlap 可阻断，shared/shared 是 warning；magnet overlap 不直接阻断；当前 diff overlap 生成时设为 blocking。三者始终只是 evidence，不会自动建立 dependency/group。

## Run

Start、retry、recover 均可接收：

```json
{
  "timeout_ms": 1800000,
  "max_budget_usd": 5,
  "max_turns": 20,
  "model": "provider-supported-model"
}
```

`timeout_ms` 和 `max_budget_usd` 必须为正数；`max_turns` 是非负整数。路由：

| Method | Path | 结果 |
|---|---|---|
| POST | `/api/tasks/:id/runs` | HTTP 202，创建 run |
| POST | `/api/tasks/:id/runs/start` | start 别名 |
| POST | `/api/tasks/:id/runs/retry` | retry 最近/指定 body `run_id` |
| POST | `/api/tasks/:id/runs/:runId/retry` | 指定 lineage |
| POST | `/api/tasks/:id/runs/recover` | recover 最近/指定 body `run_id` |
| POST | `/api/tasks/:id/runs/:runId/recover` | 指定 lineage |
| POST | `/api/tasks/:id/runs/cancel` | cancel 最近/指定 body `run_id` |
| POST | `/api/tasks/:id/runs/:runId/cancel` | 指定 run |

任务受未收获 dependency 或 open blocking overlap 阻挡时不能 run。Provider 未配置或认证被拒绝时，run 进入 `provider_blocked`、task 进入 `blocked`；不能返回成功。只有 Claude Agent SDK terminal result subtype `success` 且 `is_error=false` 才产生 succeeded run；success subtype 但 error flag 为真仍失败。

成本 `cost_usd` 直接来自 SDK `total_cost_usd`。SDK 报告 `0` 时响应保持 `0`；没有 result/cost 时是 `null`，从不估算。

## Diff、review、harvest 与 wilt

### `GET /api/tasks/:id/diff`

返回：

```text
kind: patch | empty | binary | large
patch
digest
artifact_digest
changed_paths
binary
large
truncated
manifest[]
```

`AGENT_FARM_DIFF_RESPONSE_MAX_BYTES` 是 UTF-8 byte 上限，不是 JavaScript 字符数。HTTP 只返回不超过阈值、且停在合法 UTF-8 boundary 的 patch prefix（CJK 等多字节字符不会被切坏）；完整 retained artifact 和 digest 不变。Endpoint 先验证 artifact 文件 size、SHA-256 与 strict UTF-8；不匹配分别返回 `diff_artifact_changed` / `diff_artifact_invalid_utf8`。当前 diff digest 必须有 matching patch artifact，否则返回 409 `diff_artifact_missing`。

对 non-terminal task，GET diff 先从 live worktree refresh；对已 harvested/wilted/cancelled task，worktree cleanup 后仍从 retained patch/manifest artifact 返回 terminal diff，避免重新依赖已删除目录。

### Review

```text
POST /api/tasks/:id/reviews
POST /api/tasks/:id/reviews/:decision
```

请求包含 `decision: approved|rejected`（path 版本可省略 body decision）、必需 `diff_digest` 和可选 `summary`。当前单用户 loopback 模式固定写入 `local_user` actor；调用方不能通过 `x-agent-farm-actor` 伪造 reviewer，该 actor 也不是远程 principal authentication。Approval 只绑定该 digest；diff 改变后旧 approval stale。

### Harvest

```text
POST /api/tasks/:id/harvest
```

可传 `{ "diff_digest": "..." }` 做调用方一致性检查。真实 gate 同时要求 `review_pending`、approved 且 digest 当前、所有显式 dependency 已 harvested、无 open blocking overlap、worktree 注册且 base checkout/branch/clean 条件满足。成功返回 outcome 和 task summary；冲突失败会回滚 Git primitive，并保持可审查/恢复状态。

### Wilt

```text
DELETE /api/tasks/:id
DELETE /api/tasks/:id/wilt
```

可传 `{ "reason": "..." }`。Wilt 是 destructive lifecycle 操作，但不删除 audit history；它中断 run，按 Git registry 安全移除 worktree/branch并写 cleanup proof。Harvested task 不能 wilt，cleanup 不可证明时进入 `recovery_required`。

## Ledger 与 residual

### `GET /api/events?after_seq=N`

`N` 默认 `0`，必须是非负安全整数。响应：

```json
{"events":[],"last_seq":0,"has_more":false,"ledger_last_seq":0}
```

每个 event 的机器契约见 [`ledger-event.v1.schema.json`](../schemas/ledger-event.v1.schema.json) 和 [audit event 说明](audit-events.md)。响应固定为 `{ events, last_seq, has_more, ledger_last_seq }`。单次最多 10,000 events；当前 endpoint 没有 `limit` 参数，更多历史要把页尾 `last_seq` 作为下一次 `after_seq`，直到它等于捕获的 `ledger_last_seq`。客户端必须按 wire order 验证每个 seq，不得排序掩盖乱序或本次流中的 duplicate。游标大于账本头返回 HTTP 409 `event_cursor_ahead`。Legacy events 已由 migration 002 作为带 provenance 的 audit rows backfill。

### Residual

```text
GET  /api/benchmarks/residual/latest
POST /api/benchmarks/residual
```

详见 [residual benchmark 契约](residual-benchmark.md)。

## Legacy 与静态路由

`/workspaces`、`/workspaces/:id`、`/workspaces/:id/diff`、`/workspaces/:id/merge` 是兼容映射，带 `deprecation: true` 和 successor `Link`；新客户端只使用 `/api/tasks`。

React build 由 `/web/` 提供；缺少 `web-app/dist/index.html` 时页面路由返回 503 `web_build_missing`，API 保持可用。

`/assets` 只有在 bind host 为 loopback 且 `FarmCreator/assets` 存在时才注册，映射的是整个目录，不只是 UI 当前引用的两张图片。它仅可用于现有项目的本地许可范围；禁止把既有 Farm/Cocos 美术资产公开发布。详见 [部署](../deployment.md)。
