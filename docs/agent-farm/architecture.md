# 架构与数据模型

## 1. Task 是 hyperedge

`tasks` 是生命周期投影的中心。一个 task 通过有类型、有来源事件的关系连接：

```text
repository @ base_commit
  └─ task(prompt)
      ├─ explicit dependency → task
      ├─ path claim → repository-relative path
      ├─ overlap evidence ↔ another task
      ├─ worktree + branch
      ├─ Agent SDK run/session
      ├─ patch/stat/manifest artifacts
      ├─ review(diff digest)
      └─ harvest commit | wilt outcome
```

这些关系不是从 UI 推断的。每条 materialized lineage/evidence 记录包含 `source_event_seq`，指向 `audit_events` 中的真实触发事件。

## 2. SQLite

迁移按文件名排序并逐个事务应用。`schema_migrations` 保存 version、filename 和 SHA-256；已经应用的迁移若在磁盘发生变化，服务会 fail-fast，不会静默接受漂移。

核心表：

- `repositories`：canonical root、Git 元数据、默认分支、HEAD；
- `tasks`：中央队列状态、base/worktree/branch、review/outcome 和真实 SDK metrics；
- `task_dependencies`：唯一可形成 group 的显式有向边；
- `path_claims`：exclusive/shared、active/released；
- `overlap_evidence`：claim/magnet/diff 的 open/resolved/superseded 证据；
- `agent_runs`：attempt、provider、session、SDK result subtype、cost/usage/error；
- `artifacts`：patch/stat/manifest/result/log/benchmark 的文件、大小和 digest；
- `reviews`：approved/rejected 决策与当时的 diff digest；
- `outcomes`：harvest/wilt/cancel/failure/recovery；
- `operation_locks`：每仓库单一写操作锁；
- `operation_journal`：跨 Git/SQLite 边界的 crash recovery；
- `benchmark_artifacts`：versioned residual artifact registry；
- `audit_events`：全局递增 `seq` 的 append-only replay source。

SQLite trigger 禁止 update/delete `audit_events`。当前状态表是投影；账本是审计与重放来源。

## 3. 状态机

Task 状态：

```text
seeded → preparing → seeded → running → review_pending → harvesting → harvested
   │          │          │         │              │
   │          └──────── blocked     ├→ review_rejected
   │                               └→ failed / cancelled / recovery_required
   └→ wilting → wilted | recovery_required
```

实际允许转换由领域层 compare-and-set SQL 约束，不只依赖调用方先读状态。异步 Git/SDK 操作前后都重新检查数据库状态；同仓库 harvest/wilt 还需取得 `operation_locks`。

Run 状态：

```text
queued → running → succeeded | failed | cancelled | timed_out | provider_blocked | crashed
```

只有 SDK `result.subtype === "success" && result.is_error === false` 才是成功；success subtype 但 `is_error=true` 仍失败。Async iterator 结束但无 result 是 `crashed`；SDK `error_*` result 是失败。取消和超时都调用 `Query.interrupt()` 与 `AbortController.abort()`。SDK query 使用 `settingSources: []`、default permission + `canUseTool` path guard，并要求 fail-closed sandbox；sandbox 不可用时不能降级为无隔离执行。

重启不会假设 Agent SDK session 可恢复。未得到可证明的 durable result 时，原 run 进入 `crashed`，task 进入 `recovery_required`；用户必须显式选择 retry/recover，新 run 使用 `retry_of_run_id` 或 `recovery_of_run_id` 建立 lineage。

## 4. Repository 与 worktree

Repository inspection 支持：

- 本地仓库且没有 `origin`；
- remote default branch；
- detached HEAD；
- unborn branch；
- dirty base；
- gitless 或 missing 路径。

Gitless/missing/unborn（无 HEAD/default branch）不会使服务崩溃；task 会进入 blocked 并记录真实原因，不猜默认 branch。Task worktree 始终从播种时记录的精确 `base_commit` 创建，而不是随后移动的 branch name；该 SHA 是 task summary/detail wire 的稳定字段。

Task branch 固定为 `agent-farm/<task-id>`。Worktree cleanup 只移除 Git registry 中路径和 branch 都精确匹配的条目；未注册路径不会被递归删除。

## 5. Claims、overlap 与 group

- 同一 task 对相同 normalized path 和相同 mode 的重复 claim 是幂等操作，返回已有 claim ID。
- 同一路径 mode 不同返回 409，要求先 release，避免静默改写所有权。
- 不同 task 的 exclusive/shared 冲突生成 overlap evidence。Exclusive 冲突会阻断；shared/shared 是 warning。
- Release source claim 会把由它产生的 open overlap 标为 superseded，并在没有其他 blocker 时清理 materialized conflict reason。
- Magnet overlap 永远不建立 dependency，也不直接阻断。
- Diff overlap 也不建立 dependency，但当前生成规则将其标为 blocking；open 时会阻止 run/harvest。
- Dependency cycle 返回结构化 HTTP 409。
- Dependency group 是显式依赖图的弱连通分量；无 dependency 的 task 不会因 overlap 被分组。

## 6. Diff 与 review

Diff capture 在 worktree 中 `git add -A`，然后从 index 对精确 base 生成：

- binary/full-index patch；
- stat；
- `--name-status -z` 和 raw metadata；
- versioned manifest。

它覆盖 staged、unstaged、untracked、rename、delete、binary 和 symlink。Symlink manifest 记录 link 本身，绝不跟随 target 复制内容。Artifacts 原子写入 task/run 目录并保存 SHA-256。

Review 必须绑定当前 patch digest。Diff 变化后 approval 变 stale，harvest gate 拒绝旧 approval。

## 7. Harvest gate 与并发

Harvest 同时要求：

1. task 为 `review_pending`；
2. 最新 review 为 approved；
3. approved digest 等于 current diff digest；
4. 所有显式 dependencies 已 harvested；
5. 无 open blocking overlap；
6. worktree 存在且在 Git registry 中；
7. base checkout 位于正确 branch 且 clean。

领域层持久化 per-repository lock；Git primitive 还按 canonical repository root 使用进程内 FIFO mutex，把预检、squash、commit、验证和失败回滚包在同一临界区。并发 harvest 恰有一个成功；loser 不能 reset winner commit。

Task worktree 变更先提交，commit 与最终 squash commit 都带精确 trailer：

```text
Agent-Farm-Task: <task-id>
```

Crash recovery 只在 base first-parent ancestry 的有限历史中匹配该精确 trailer；不会按标题模糊匹配。

## 8. HTTP 与 WebSocket

规范 API 前缀是 `/api`。错误统一为：

```json
{
  "error": {
    "code": "review_stale",
    "message": "...",
    "request_id": "..."
  }
}
```

`details` 仅在错误有结构化详情时出现。旧 `/workspaces` 路由做带 deprecation header 的当前 handler 兼容映射；migration 002 已将真实 legacy repositories/workspaces/events 确定性 backfill 到当前 projections 与 append-only ledger。Legacy `harvested` 会保守降级到待重新验证的 review 状态，绝不在缺少当前 Git/review/digest 证据时合成 harvest success。

WebSocket endpoint：

```text
/ws?after_seq=N
```

阶段：

```text
hello → replay* → ready → live*
```

Replay 与 live 均从 SQLite `audit_events` 读取。REST `/api/events` 单次最多 10,000 条，并区分页尾 `last_seq` 与捕获的账本头 `ledger_last_seq`；WebSocket 以 250-row database page 读取并按 4 MiB frame 边界组批。Replay 期间的新事件先按 seq 缓冲，再从数据库补齐，保证 `ready` 前连续、无新重复、无缺口。`ledger_id` 是 `ledger_metadata` 中的持久 UUID：restart 稳定，同路径 DB 被替换时变化。客户端发现 gap/乱序/new duplicate/identity replacement 时严格按 wire order 分页 REST resync，追到 ledger head 后再取 `last_seq` 对齐的最终 task snapshot。Browser Origin 必须与 HTTP Host 同源；CLI 可不发送 Origin。

REST mutation 成功后 UI 立即采用响应投影或 refetch；不等待后续 WebSocket 才更新。Task list snapshot 的 tasks/last_seq 同 transaction；detail 用 row_version + 最多三次 live hydration 重试防 torn snapshot。Approved summary 的 `review_stale` 在未刷新 live diff 时为 `null`，只有 exact live verification 才为 false。Repository projection 将 persisted last-event provenance 与本次 live Git observation provenance 分离。Terminal diff 从 retained artifact 读取，HTTP large patch按合法 UTF-8 byte boundary 截断。

## 9. Residual benchmark

`POST /api/benchmarks/residual` 触发只读扫描；`GET /api/benchmarks/residual/latest` 返回最新 artifact，没有 artifact 时返回结构化 404，而不是伪造零问题。

Schema version：

```text
agent-farm.residual-benchmark.v1
```

检测类型：

- `orphan_worktree`
- `orphan_run`
- `dangling_task`
- `double_terminal`
- `review_merge_mismatch`
- `stale_run`
- `cost_event_mismatch`

每条 finding 包含真实 source event seq、provenance、evidence 和 remediation。扫描结合 SQLite、canonical filesystem、Git worktree registry；harvest lineage还验证 base ref、commit existence/ancestry、精确 trailer、review/outcome/artifact/audit provenance。Terminal cardinality、absent-vs-zero cost、retryable missing worktree 与 symlink ownership 都有直接真实测试。Artifact 使用原子文件写入、SHA-256 和 SQLite registry；它只报告问题，不自动删除或修复资源。
