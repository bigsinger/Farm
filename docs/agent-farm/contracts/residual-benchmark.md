# Residual benchmark 契约

Residual benchmark 是 SQLite、Git worktree registry 与 filesystem 的只读一致性扫描。机器契约是 [`residual-benchmark.v1.schema.json`](../schemas/residual-benchmark.v1.schema.json)，对应 `server/src/benchmark.ts` 的真实 artifact wire shape。

## 生成、读取与持久化

```text
POST /api/benchmarks/residual
GET  /api/benchmarks/residual/latest
```

POST 返回 HTTP 201 和新 artifact。GET 返回最近一份经过版本和 digest 验证的 artifact；尚未生成时返回结构化 404 `residual_benchmark_not_found`，不能把“没有扫描”解释为零 residual。

生成流程：

1. 向 SQLite ledger 追加 `benchmark.residual.scan_started`；
2. 读取 repositories、tasks、runs 和 ledger 范围；
3. 对 Git registry 和 filesystem 做只读扫描；
4. 计算 findings、summary、cleanup proof 与 provider proof；
5. 计算 artifact SHA-256；
6. 以 mode `0600` 写临时文件并原子 rename 到 `benchmarks/<artifact-id>.json`；
7. 写 SQLite registry 和 `benchmark.residual.generated`；registry 写入失败则删除 final file。

Artifact 只报告，不自动清理 worktree、修改状态或改写 ledger。扫描不是只读 SQLite 计数：它读取真实 Git worktree registry、canonical filesystem paths，并对 harvested task 验证 base branch ref、commit existence/ancestry、精确唯一 `Agent-Farm-Task` trailer、review/outcome/artifact/audit provenance 与 digest lineage。

## Wire shape

```json
{
  "schema_version": "agent-farm.residual-benchmark.v1",
  "artifact_id": "artifact-uuid",
  "generated_at": "2026-08-10T00:00:00.000Z",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "ledger": {
    "first_seq": 0,
    "last_seq": 0,
    "event_count": 0
  },
  "scope": {
    "repository_ids": [],
    "task_ids": []
  },
  "summary": {
    "total": 0,
    "by_type": {},
    "by_severity": {}
  },
  "residuals": [],
  "cleanup_proof": {
    "checked_paths": [],
    "remaining_paths": []
  },
  "provider_proof": {
    "status": "not_run",
    "reason": "No Agent SDK run has been recorded.",
    "run_ids": []
  }
}
```

Digest 计算以整个 artifact 为输入，但把 `sha256` 暂时替换为空字符串，序列化后加一个换行再做 SHA-256。修改保存文件后沿用旧 digest 会在读取时失败。

## Finding

每项 finding 必需：

```text
id
type
severity
detected_at
source_event_seq
provenance { kind, source, observed_at, digest }
evidence
remediation
```

`task_id`、`run_id`、`repository_id` 没有值时省略，不输出 `null`。`evidence` 是任意 JSON object。`source_event_seq` 可以为 `0`：空 ledger 或缺少更精确来源时，扫描开始事件/回退来源决定该值。

类型：

- `orphan_worktree`
- `orphan_run`
- `dangling_task`
- `double_terminal`
- `review_merge_mismatch`：不仅比较 SQLite digest，也验证真实 Git base ancestry/commit/trailer、terminal event/outcome/patch provenance；
- `stale_run`
- `cost_event_mismatch`：SDK terminal event 未报告 cost 时不凭空要求/估算 cost；明确 `0` 仍是有报告值。

严重度：`info`、`warning`、`blocking`。

## Cleanup proof

`checked_paths` 是扫描过的确定性 worktree/filesystem 路径；路径先做 canonical/realpath 匹配，因此 symlinked data root 不会把受管目录误报为 orphan。`remaining_paths` 是扫描结束仍存在、需要结合 finding 解释的路径。Terminal task 可合法保留 artifact，但不应保留归它所有的 registered task worktree；active/blocked/failed/recovery task 的 projected worktree missing 则可形成 retryable dangling evidence。空 `remaining_paths` 只证明这次扫描范围内没有残留，不证明未扫描的外部路径不存在。

## Provider proof

此处是 server residual artifact 对数据库中 run 的只读归纳，与 E2E gate/runtime proof 文件不是同一契约。三种实际输出：

- `verified`：至少一个 run 同时为 `succeeded` 且 `provider_status=verified`，并包含 `run_ids`。只有所有这些 run 都有 SDK-reported cost 时才包含 `cost_usd`；合计合法地可以是 `0`。
- `blocked`：存在 `provider_blocked` run，包含 `reason` 与 `run_ids`。这是如实记录 provider 不可用，不是成功证明。
- `not_run`：没有 verified run，且没有 blocked run，包含 `reason` 与全部相关 `run_ids`。

成本来自 Claude Agent SDK result 的 `total_cost_usd`，不按 token、时长或本地费率估算。SDK 明确报告 `0` 时必须保留 `0`；没有 result/cost 才省略 artifact 的 aggregate `cost_usd`。

## Validator 使用

Schema 使用 JSON Schema Draft 2020-12。`format: date-time` 的严格程度取决于 validator 是否启用 format assertion；类型、必需字段、枚举、provider 三态和附加字段约束不依赖 format 插件。
