# Task、run 与 Git 生命周期

## 核心不变量

- 中央队列的 task 是权威生命周期单元；Agent 只在自己的 worktree 中工作。
- 只有显式 dependency 构成 group。
- Claim、magnet、diff 的路径相交只产生 overlap evidence；它们不自动建立 dependency 或协作关系。
- Open blocking overlap 虽然只是 evidence，仍会阻止 run 和 harvest。
- Run 成功必须来自真实 Claude Agent SDK `result.subtype === "success"` 且 `is_error === false`。
- Provider 不可用或认证失败必须产生 `provider_blocked` / blocked task，不能伪装成功。
- Review 必须绑定当前 diff digest；harvest 只能消费仍然新鲜的 approval。

## Seed 与 prepare

`POST /api/tasks` 先检查真实 repository path：

- Git repository：记录精确 base commit，task 初始 `seeded`。
- gitless、missing/unavailable 或 unborn（无可解析 HEAD/default branch）：仍记录 repository/task 与真实错误证据，task 初始 `blocked`，不进入 prepare。

Default branch 从 symbolic HEAD、本地 refs 与 remote origin HEAD 等真实 Git evidence 解析；无法证明时不猜 `main`。对可用 Git repository，prepare 执行：

```text
seeded|blocked → preparing → seeded
```

它从播种时的精确 `base_commit` 创建 branch `agent-farm/<task-id>` 和真实 Git worktree。该 SHA 在 task summary/detail wire 与 inspector 中显式暴露。成功后 task 回到 `seeded`；失败进入 `blocked`，保留 operation/audit evidence。Task 不会从随后移动的 branch name 偷换 base。

创建时提交的 dependencies 立即写显式边。Claims 产生 claim evidence；exclusive collision 可形成 blocking overlap，shared/shared 是 warning。Magnet paths 与其他 task 的 magnet 相交形成非阻断 evidence。任何这些 overlap 都不会把 task 放入 dependency group。

`auto_start` 默认 true，但 scheduler 只启动没有 queue blocker 的 `seeded` task。

## Queue eligibility

Run queue blocker 是：

1. 任一显式 dependency 的 task 尚未 `harvested`；
2. 与 task 相连的任一 overlap 为 `open` 且 `blocking=1`。

因此 evidence 与 relationship 必须分开理解：overlap 不建立依赖，但 blocking evidence 仍是安全 gate。Resolve/supersede、claim release 或 dependency remove 后会重新调度该 repository 的 auto-start tasks；调度去重且 attempt/current-run CAS 保护 lineage。Claim evidence 保存两侧 source claim，shared warning 可升级为 exclusive blocking conflict；释放任一来源 claim 只 supersede 对应 evidence并清理真实 blocker。Dependency cycle、cross-repository dependency 与 self dependency 被拒绝。

## Run

Start 创建 run：

```text
run:  queued → running
task: seeded → running
```

Start/diff/harvest 首先验证 filesystem path、Git registry 与 expected `agent-farm/<task-id>` branch identity；外部 switch 到其他 branch 或 detached HEAD 会以 `worktree_mismatch`/branch blocker 拒绝，不能在错误树上执行。SDK query 使用 task worktree 作为 `cwd`，保存 session，并只允许 Read/Write/Edit/Glob/Grep/Bash。`settingSources: []` 阻止 settings 为 run 加载额外行为。运行时启用 sandbox 且 `failIfUnavailable: true`，读写限制到该 worktree，禁止网络、Unix socket、local bind、peer Agent、workflow 与外部消息。Permission mode 使用 `default` 并由 `canUseTool` 做 path allowlist；不是 bypass permissions，也不会在 sandbox 不可用时降级执行。

Terminal 映射：

| SDK/控制结果 | Run | Task |
|---|---|---|
| result subtype `success` 且 `is_error=false`，diff capture 成功 | `succeeded` | `review_pending` |
| provider 配置缺失或认证/授权拒绝 | `provider_blocked` | `blocked` |
| 显式 cancel | `cancelled` | `cancelled` |
| timeout | `timed_out` | `failed` |
| SDK `error_*` result / runtime failure | `failed` | `failed` |
| iterator 结束无 durable result、进程 crash 或 diff capture 无法证明 | `crashed` | `recovery_required` |

Cancel/timeout 同时请求 `Query.interrupt()` 与 `AbortController.abort()`。Iterator 消失不等于成功。

`cost_usd`、turns、duration、usage/model usage 来自真实 SDK result。SDK 明确报告成本 `0` 时保留 `0`；无 result 时 `null`。系统没有根据 token 或时长估算成本的路径。

## Retry 与 recover

Retry/recover 都创建新 attempt，不会隐式恢复旧 SDK iterator：

- retry 写 `retry_of_run_id`；
- recover 写 `recovery_of_run_id`。

旧 run 保持原终态和 audit history。用户应在确认 provider、worktree 和旧 result evidence 后选择操作，不能手工覆写旧行。

## Diff capture

SDK success 后在真实 worktree 中 capture index 与精确 base 的差异，覆盖：

- staged、unstaged、untracked；
- rename、delete、binary、symlink；
- patch、stat、name-status/raw metadata 与 versioned manifest；
- SHA-256 与 changed paths。

Diff path 与同 repository、非 harvested/wilted/cancelled task 的最新 manifest changed paths 相交时，形成 `evidence_type=diff` 且当前实现设为 blocking；它仍只是 overlap evidence，不形成 dependency/group。当前 UI 能展示这一类型；现有 E2E 对 claim/magnet 有直接断言，对 diff evidence 的同级直接构造覆盖不应被夸大。

Capture 成功后 task 进入 `review_pending`。HTTP diff response 可按 UTF-8 byte 阈值截断到合法字符边界，但完整 artifact 和 digest 保留。Terminal task 清理 worktree 后，detail/diff 不再尝试 live refresh，而从 retained artifact 返回可验证结果。

## Review

Reviewer 提交 approved 或 rejected，并提供正在审查的 `diff_digest`：

- approved：task 保持 `review_pending`，`review_status=approved`；
- rejected：task 进入 `review_rejected`；
- worktree diff 后续变化：旧 approval stale，不能 harvest。

`approved` 不是 task status；它是 review projection。List/persisted summary 若未检查 live worktree，会把看似匹配的 approval 标成 `review_stale=null`（未知），绝不乐观宣称 false；detail 只有完成 live refresh 且 exact digest 相等才返回 false。Live diff 变化会清空 approved digest并标 true。若拒绝后继续修改/运行，应通过真实生命周期创建新 attempt 和新 diff/review，而不是改旧 review。

## Harvest

Harvest gate 同时要求：

1. task 为 `review_pending`；
2. 最新 review approved；
3. approved digest 等于 current diff digest；
4. 所有显式 dependencies 已 harvested；
5. 无 open blocking overlap；
6. task worktree 存在且已在 Git registry 注册；
7. base checkout 位于正确 branch 且 clean。

执行：

```text
review_pending → harvesting → harvested
```

Task worktree 变更先形成 commit；base repository 做 squash harvest。Base repository 必须正 checkout recorded `base_branch`、clean，且 recorded task `base_commit` 仍是该 branch 当前 HEAD 的 ancestor。Task commit 与 harvest commit 都带：

```text
Agent-Farm-Task: <task-id>
```

Repository SQLite lock 与 canonical-root FIFO mutex 把 preflight、commit、验证、rollback 放入同一临界区。Task commit 必须保留 approved patch digest；commit hook/并发写入造成 tree 漂移会撤销新建 task commit并拒绝。Base harvest 前验证 recorded base commit 是当前 base branch ancestry，防止错误 side checkout。并发 harvest 只能有一个 authoritative terminal commit；loser 重新读取 winner 后的 HEAD，不得 reset winner。

Merge conflict 或 Git primitive 失败时，服务 abort/reset/clean 回到调用时的可信 pre-commit 并验证 base。可证明回滚时 task 恢复 `review_pending`；无法证明时进入 `recovery_required`。不能在 base checkout 手工提交来绕过 ledger/review。

## Wilt

除 `harvested`、`wilted`、`wilting` 外，task 可经人工确认 wilt：

```text
<eligible state> → wilting → wilted | recovery_required
```

流程中断活跃 run，只移除 Git registry 中 path 与 branch 精确匹配的 worktree，删除 task branch，写 outcome/cleanup proof。Missing path 可作为已清理收敛；但 path 被注册到错误 branch 时绝不删除那个不相关 worktree，task/journal 进入 recovery。修复成精确 task branch 后，显式 wilt 或 restart reconciliation 可幂等完成，不追加第二个 terminal outcome。Wilt 不删除 audit events、reviews、outcomes 或 artifact metadata。不要用 `rm -rf` 代替 API/Git cleanup。

## Restart reconciliation

启动时：

1. 清除旧 process 遗留 repository locks；
2. queued/running run 因缺少 durable terminal result 进入 `crashed`；
3. 对应 task 进入 `recovery_required`；
4. interrupted prepare 只有在确定性 path、branch、base 都匹配时补齐；
5. interrupted harvest 只在当前 checked-out recorded base branch 的 first-parent、且位于 journal `pre_commit` 之后的有限历史中找到精确、唯一 trailer 时补写 confirmed outcome；side branch/checkouts 的 trailer 永不确认，也不 cleanup task worktree；
6. 未找到 landed commit时，只有 base checkout仍在 recorded branch、HEAD 恰为 `pre_commit` 且 clean，才可把“未落地”收敛为 rolled back；对外部 commit/dirty content 绝不执行 destructive reset/clean；
7. journal 缺少边界、branch/ancestry 不匹配、terminal outcome 已存在或任何 Git 验证失败时不猜测，保留 `recovery_required` / `needs_recovery`，且 CAS/terminal cardinality 阻止第二个终态。

重启后使用显式 recover/retry。Ledger、operation journal、Git commit trailer 和 registry 共同提供证据；单独一个 UI 状态不是恢复依据。
