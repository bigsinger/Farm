# 测试、证明与保留策略

## 原则

Agent Farm 的验证以真实边界为准：

- 真实 Git repository、bare remote、commit、branch 与 worktree；
- 真实 SQLite database、WAL、migration 和 append-only trigger；
- 真实 HTTP server process 与 WebSocket；
- 真实 Chromium binary；
- provider suite 使用真实 Claude Agent SDK/provider。

Provider gate unavailable 时必须输出 blocked proof 并返回非零；不得把 fixture、跳过或本地构造 result 当作 provider 成功。Gate ready 后 runtime 仍可能因 401/403 blocked；provider lifecycle suite 可以通过这一真实安全失败路径，但 runtime proof 必须标 `provider_status=blocked`。SDK 成本 `0` 是合法真实值，必须与 `null` 区分。

## 前置条件

安装 server、web-app 和 e2e 依赖，并安装 Playwright Chromium：

```bash
pnpm --dir server install
pnpm --dir web-app install
pnpm --dir e2e install
pnpm --dir e2e exec playwright install chromium
```

Preflight：

```bash
pnpm --dir e2e preflight
```

它检查 Git、sqlite3、pnpm、server/web package 和 Chromium executable，记录 Node version，并写 `preflight.json`。Local preflight 不要求 provider ready；provider readiness 是 proof 中的独立字段。

## Suite 矩阵

| 命令 | 内容 | Provider 要求 |
|---|---|---|
| `pnpm --dir server typecheck` | Server TypeScript | 无 |
| `pnpm --dir web-app build` | 两套 TS typecheck + Vite build | 无 |
| `pnpm --dir e2e typecheck` | E2E TypeScript | 无 |
| `pnpm --dir e2e test:infrastructure` | 独立 `run-node-tests`：isolation/Git、preflight/benchmark、SQLite fixture、WS ledger | 无 |
| `pnpm --dir e2e test:integration` | 独立 `run-node-tests`：全部 Node integration tests | 无 |
| `pnpm --dir e2e test:browser` | Chromium，排除 `@provider` | 无 |
| `pnpm --dir e2e test:local` | preflight + typecheck + integration + browser | 无 |
| `pnpm --dir e2e test:provider` | preflight + provider gate + `@provider`，1 worker | 必需 |
| `pnpm --dir e2e test:all` | local 全链 + provider | Gate blocked 时整体失败；gate ready 后 runtime blocked lifecycle 可通过但 proof 仍 blocked |

Playwright 当前只有 Chromium project；retries 为 0，CI 使用 2 workers，本地 4 workers。没有 Firefox/Safari 自动化证明，文档和发布声明不得声称已验证它们。

## Provider gate

Provider suite 必须同时满足：

1. `AGENT_FARM_RUN_PROVIDER_E2E=1`；
2. `CLAUDE_SETTINGS_PATH` 指向的文件，或默认 `~/.claude/settings.json`，存在且可读；
3. 该文件是 JSON object；
4. settings `env` 或 process env 中至少有一个受支持 credential key：
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_API_KEY`
   - `CLAUDE_CODE_OAUTH_TOKEN`

注意判断顺序：即使 process env 有 credential，settings 文件不存在/不可读/无效时仍 blocked。Endpoint metadata 只记录是否存在 `ANTHROPIC_BASE_URL`、`ANTHROPIC_BEDROCK_BASE_URL` 或 `ANTHROPIC_VERTEX_BASE_URL`，不会输出值。

Gate 输出：

```text
provider-ready.json
```

或：

```text
provider-blocked.json
```

文件以 mode `0600`、临时文件 + atomic rename 写入，包含 `secrets_printed: false`。Gate blocked exit code 是 `2`。这是有效的“为何未进入 runtime”证明，但不是 provider suite passed。

Gate ready 只表示允许真实尝试。若 SDK runtime 返回认证/授权失败，browser provider lifecycle 断言 run/task/provenance/cleanup/restart replay，并写 `provider-runtime-blocked.json`；这条测试路径可以 passed，因为安全失败行为已被证明，但 artifact `provider_status` 必须是 `blocked`，report 也必须保留 blocked，而不能改成 verified。只有真实 success result 才生成 verified proof。冻结的 release provider run 中，gate 为 ready，但两个真实 SDK run 均返回 `provider_auth_failed`；保留 proof 含两个 session/run、`claude_agent_sdk` terminal provenance、两个 wilted cleanup、seq 1–34 连续 restart replay，以及 `reported_usd:[null,null]`、`estimated:false`。因此本 release 只证明 runtime-blocked 安全路径，不声称 provider-backed coding 成功。

## 已覆盖的关键证明

冻结后的 release integration 机读 proof 为 **14 个测试文件、61/61 passed、0 failed/cancelled**，所有 node-test cleanup proof 均为 true；proof 同时保留原始 TAP、文件级并发、child exit/signal 与 process-group cleanup arrays。Integration/browser suite 直接覆盖：

- provider unavailable → run/task blocked；
- 显式 dependency group；claim/magnet overlap 不成组；claim blocking escalation 与任一侧 release 精确清除；
- durable ledger ID restart 稳定、同路径 DB replacement 变化；10,052-event REST pagination、strict wire order、duplicate/gap rejection、final snapshot cursor 对齐；
- legacy workspace/event 002 backfill、deterministic data-INSERT replay 边界、checksum transaction rollback、`.env` 早加载、unknown future migration zero-write fail-fast；
- nullable review stale 的 live invalidation、task `base_commit`、repository persisted/live dual provenance、concurrent wilt/detail snapshot consistency；
- terminal retained diff artifact与 CJK UTF-8 byte-boundary truncation；
- 真实 Git reviewed digest、base ancestry、unborn repository、worktree branch identity、wrong branch/missing worktree gates；
- merge conflict与 unsafe rollback拒绝、side-branch trailer不确认、interrupted wilt/restart幂等恢复、concurrent harvest恰一个 winner；
- residual real Git lineage/exact trailer/audit provenance、duplicate terminal cardinality、absent cost、retryable dangling worktree、symlink canonical ownership；
- SQLite integrity与 audit append-only trigger；
- node-runner 与 harness cleanup proof；
- loopback-only assets、same-origin WS、JSON/parser/request-ID/redaction、diff XSS、responsive empty state、reduced motion 与 Chromium accessibility basics。

Server 支持并在 UI 中展示 diff overlap evidence，但当前 suite 没有与 claim/magnet 同级、显式构造并断言 `evidence_type=diff` 的直接用例；不能把间接行为描述为已有直接 E2E 证明。

## Proof artifact 布局

Suite runner 创建：

```text
e2e/test-results/
  latest.json
  runs/<run-id>/
    suite.json
    infrastructure-node-cleanup.json | integration-node-cleanup.json
    server-processes.jsonl
    browser-process-cleanup.json       # browser suite
    preflight.json
    provider-ready.json | provider-blocked.json
    playwright/
    playwright-report/
    <case-label>-<tmp-basename>/
      server.stdout.log
      server.stderr.log
      server-process.json
      cleanup-proof.json
      ...case-specific proof
```

`run-id` 包含 UTC timestamp、suite 和随机后缀。`suite.json` 记录每一步命令、开始/结束、duration、exit code/signal 和总状态；`latest.json` 指向最近 run root。

Playwright 仅在失败时保留 trace/video，失败时截图；HTML report 写入该 run root。不要只保存 console 截图而丢弃 machine-readable suite/proof 文件。

## 隔离与 cleanup

每个 harness 使用 `mkdtemp` 创建隔离：

```text
/tmp/agent-farm-e2e-<label>-*/
  home/
  data/
  repository/
  origin.git/
```

它使用独立 HOME/data/port、真实 bare remote 与 Git history、真实 server child process。非 provider case 清空 credential/provider env，防止误用开发者身份。

此外 `_test:infrastructure` / `_test:integration` 不再直接用共享 process 启动 `tsx --test`，而是经过 `scripts/run-node-tests.ts`：创建 suite 级临时 HOME/data，禁用 user settings/provider，验证测试文件名 allowlist，建立独立 child process group并转发 SIGINT/SIGTERM。文件级并发默认 2（`AGENT_FARM_E2E_NODE_CONCURRENCY=1..8` 可覆盖），避免大量 tsx/Git/SQLite server 同时冷启动造成资源饥饿；用例内部的业务并发不降级。Harness 启动的 server 以随机 cleanup token、PID/PGID 和 `started` / `stopped` 状态追加到 mode `0600` 的 `server-processes.jsonl`。Runner 使用 Node TAP reporter，实时回显并保留 `<suite>-node-test.tap`/stderr，解析标准 tests/pass/fail/cancelled summary；summary 缺失、fail/cancel 非零或 pass 不等于 tests 都令 suite 失败。Runner finally 先核验进程身份，再 TERM、超时 KILL，拒绝 token mismatch、registry parse error 或 remaining group；随后删除 suite root，并写 `agent-farm.node-test-cleanup.v1`，记录文件数/并发/TAP summary、child exit/signal、forwarded signal、process/root/data/home removal、process cleanup arrays、可选 failure-injection proof 和 cleanup error。`isolation-and-git` 专项会故意让一个 detached group 跨出 test process，要求 outer finally 证明已登记、初始存活、已终止且无残留，避免空 registry 假阳性。Playwright global teardown 使用同一 registry cleanup，并写 `agent-farm.browser-process-cleanup.v1` 的 `browser-process-cleanup.json`；身份不匹配、解析错误或残留同样令 browser suite 失败。

Cleanup 顺序：

1. 停止 server，保存 stdout/stderr/process metadata；
2. `git worktree prune`；
3. 移除非主 worktree；
4. 再 prune 并检查 registry；
5. 删除非 `main` branch 并验证；
6. 删除整个临时 root；
7. 验证 data、repository、remote 均不存在；
8. 在保留的 artifact directory 写 `cleanup-proof.json`。

Cleanup proof 字段：

```text
processStopped
dataDirectoryRemoved
repositoryRemoved
remoteRemoved
worktreesPruned
branchesRemoved
checkedAt
```

任一 boolean 为 false 都是失败证据，需要调查；不能因为测试 assertions 通过就忽略 cleanup failure。

## 保留策略

代码当前自动删除临时 HOME/data/repository/remote，但不会自动删除 `e2e/test-results/runs`。运维方应制定外部 retention policy：

- CI：至少保留所有 failed/blocked provider run，和发布所用 passed run 的完整 root；
- 本地：确认 cleanup proof 全 true、无调查需求后，可按 run root 整体删除旧记录；
- 不要从一个 run root 中单独删 digest、suite manifest 或 cleanup proof，以免破坏证据链；
- Artifact 可能含 repository path、prompt、diff 或日志，按内部敏感开发数据保护；
- Provider gate 声明不输出 secret，但仍应限制目录访问，且不要上传未经审查的 server logs；
- 对 release/staging 证明，记录代码 commit、Node/pnpm/Chromium 版本和对应 run-id，直至该 release 退出回滚窗口。

清理示例只在人工确认路径准确后执行：

```bash
rm -rf -- e2e/test-results/runs/<confirmed-old-run-id>
```

不要删除当前 `latest.json` 指向的 run；若删除旧 run，应同步检查/更新外部 CI artifact index。

## 报告与判定

`pnpm --dir e2e report` 会生成 benchmark/report 输出；`report:html` 打开 Playwright report。最终判定必须分开：

- 功能 assertions；
- provider verified/blocked/not-run；
- SQLite/Git residual；
- cleanup proof；
- artifact 持久化是否完整。

“local passed + provider gate blocked”不是全链 passed；应报告 local 通过、provider 因具体 gate 原因未进入 runtime，并保留两类 proof。“provider suite passed + runtime proof blocked”则表示真实尝试证明了 401/403 的 blocked lifecycle，不表示 provider-backed coding 成功；发布报告必须继续标 blocked。
