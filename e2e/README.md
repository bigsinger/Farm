# Agent Farm E2E

E2E 使用隔离 HOME/data/repository/port、真实 Git/bare remote/worktree、真实 SQLite/HTTP/WebSocket、Playwright Chromium，以及可选的真实 Claude Agent SDK/provider。

完整证明规则见 [testing-and-proofs](../docs/agent-farm/testing-and-proofs.md)。

## 安装

先安装 server、web-app 与 E2E dependencies：

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

它检查 Git、sqlite3、pnpm、server/web packages 和 Chromium executable，并写 machine-readable `preflight.json`。

`better-sqlite3` 12.11.1 的 engine 声明支持 Node 20、22、23、24、25、26；项目与测试最低要求 Node 20。

## Suite

```bash
pnpm --dir e2e typecheck
pnpm --dir e2e test:infrastructure
pnpm --dir e2e test:integration
pnpm --dir e2e test:browser
pnpm --dir e2e test:local
pnpm --dir e2e test:provider
pnpm --dir e2e test:all
```

- `test:infrastructure`：经隔离 node runner 执行 isolation/Git、preflight/benchmark、SQLite fixture、WS ledger。
- `test:integration`：经隔离 node runner 执行所有 Node integration tests；冻结后的 release proof 为 14 个文件、61/61 passed、0 failed/cancelled，cleanup proof 全 true。Runner 默认文件级并发为 2，可用 `AGENT_FARM_E2E_NODE_CONCURRENCY=1..8` 显式覆盖；用例内部的并发 harvest、wilt/detail 与多任务行为仍真实并行。
- `test:browser`：Chromium，排除 `@provider`。
- `test:local`：preflight + typecheck + integration + browser。
- `test:provider`：preflight + provider gate + `@provider`，1 worker。
- `test:all`：local 加 provider；provider gate blocked 会使整体非 passed；gate ready 后 runtime blocked lifecycle 可通过，但 proof 仍必须 blocked。

Playwright 仅配置 Chromium，retries 为 0；不能据此宣称 Firefox/Safari 已验证。

## Provider gate 与 runtime proof

Gate ready 要求：

1. `AGENT_FARM_RUN_PROVIDER_E2E=1`；
2. `CLAUDE_SETTINGS_PATH` 或默认 `~/.claude/settings.json` 存在、可读、合法 JSON object；
3. settings env 或 process env 至少有一个支持的 credential key。

即使 process env 有 credential，settings 文件不存在也会 blocked。Gate 写 `provider-ready.json` 或 `provider-blocked.json`；blocked exit code 2。

Gate ready 只证明配置可以尝试，不证明运行时认证成功。真实 SDK 调用仍可能因 401/403 进入 `provider_blocked`。Provider lifecycle test 将这种真实 runtime blocked 路径视为已验证的安全生命周期：

- run `provider_status` 必须是 `blocked`；
- task 必须 blocked 并带真实 reason；
- audit terminal provenance 必须来自 `claude_agent_sdk`；
- worktrees 必须通过 wilt 清理；
- restart replay 必须连续；
- 写 `provider-runtime-blocked.json`，其 `provider_status` 必须是 `blocked`。

因此要区分：

- gate blocked：provider suite 未进入 runtime，命令退出非零；
- gate ready + runtime blocked：provider test 可通过，因为它证明了真实 401/403 blocked lifecycle，但 proof 不能标为 verified；
- runtime verified：SDK result subtype success，proof `provider_status=verified`，再验证 diff/review/harvest/wilt/restart。

成本 proof 只记录 SDK reported value：`null`、`0` 或正数原样保留，`estimated: false`。`0` 不应被当成缺失值。

## 已有证明边界

直接覆盖显式 dependency group、claim/magnet overlap 不形成 group、claim escalation/release、durable ledger replacement、10k+ pagination/strict order/final snapshot、002 legacy/future migration、review/base/repository projections、terminal CJK artifact、Git ancestry/recovery/concurrency、Git-backed residual、loopback asset/Origin/XSS、SQLite append-only/integrity、隔离 runner cleanup与 responsive/accessibility。冻结的 release provider proof 是 gate ready 后两个真实 SDK run 均 `provider_auth_failed` 的 runtime-blocked 安全生命周期；它包含真实 session/run、SDK terminal provenance、wilt cleanup 与连续 restart replay，不能支撑 provider verified success 声明。测试也定义并严格断言 verified success 分支，但只有实际生成 `provider-proof.json` 才表示该分支本次通过。

Server/UI 支持 diff overlap evidence；当前没有与 claim/magnet 同级的显式 diff-overlap E2E 构造断言，不能夸大覆盖。

## Artifact 与 cleanup

每个 suite：

```text
e2e/test-results/runs/<run-id>/
```

包含 `suite.json`、`infrastructure-node-cleanup.json` 或 `integration-node-cleanup.json`、`server-processes.jsonl`、browser suite 的 `browser-process-cleanup.json`、preflight/provider proof、Playwright output/report 和 case proof。Node runner 使用独立 HOME/data/process group，信号转发后也在 finally 删除 suite temp root。Harness server 以随机 cleanup token、PID/PGID 和 started/stopped journal 登记；suite finally 只在身份精确匹配后 TERM、超时 KILL，并拒绝 registry parse error、identity mismatch 或 remaining group。Node proof 记录 child exit/signal、process/root/data/home removal、process cleanup arrays 和可选 outer-finally failure-injection proof；Playwright global teardown 使用同一 registry 并写 browser process cleanup proof。任一清理失败都会令命令失败。Harness 临时 HOME/data/repository/remote 在 cleanup 中删除；保留的 case artifact 包含 server logs/process metadata 和 `cleanup-proof.json`。

每个 case 的 cleanup proof 六个 boolean 必须全 true：

```text
processStopped
dataDirectoryRemoved
repositoryRemoved
remoteRemoved
worktreesPruned
branchesRemoved
```

Run roots 不会自动过期。保留 failed、gate blocked、runtime blocked 和 release-used passed proof；人工确认无需调查且 cleanup 全 true 后，按整个旧 run root 删除。不要只删 suite manifest、digest 或 cleanup proof。

## 报告

```bash
pnpm --dir e2e report
pnpm --dir e2e report:html
```

Report 聚合 residual、Git、cleanup 与 runtime provider proof。若发现 `agent-farm.e2e-provider-proof.v1`，`provider_status` 只接受 `verified` 或 `blocked`；runtime blocked 不能标成 ready/verified。
