# Agent Farm task/worktree hyperedge

Agent Farm 是一个面向本地开发仓库的中央任务队列。它把一次编码任务从播种到收获或枯萎的完整生命周期记录为一个可重放、可审计的高阶工作单元：

- 仓库、默认分支和精确 base commit；
- task prompt、显式 dependencies、path claims 和 magnet paths；
- task branch、真实 Git worktree、Agent SDK run/session；
- Git diff、stat、manifest 和其他 artifact 的 SHA-256；
- 人工 review 及其绑定的 diff digest；
- harvest commit 或 wilt/cleanup outcome；
- 每一条投影边对应的 append-only audit event provenance。

## 语义边界

Agent Farm 保持 **central queue**，不是 agent 间的 P2P swarm。

- 只有 `task_dependencies` 中的显式边形成 dependency group。Group 是这些边的弱连通分量。
- claim、magnet path 或真实 diff 的路径相交只生成 `overlap_evidence`。
- 共同上游提交、时间共现或共享文件不会自动建立 dependency。
- overlap evidence 不是协作关系，也不是协作智能或更高阶智能的证据。
- Agent SDK 运行只能修改自己的 worktree；harvest 仍由中央队列、人工 review 和仓库锁控制。

## 目录

| 路径 | 职责 |
|---|---|
| `server/` | SQLite 000/001/002 migration 与 legacy backfill、领域状态机、Git/Agent SDK 执行、HTTP API、durable ledger/WebSocket replay、residual benchmark |
| `web-app/` | React 中央队列、dependency/overlap 解释、diff review、运行控制与 residual health |
| `e2e/` | 隔离 HOME/data/repo/port 的真实 Git、SQLite、WebSocket、Playwright 和 provider-backed Agent SDK 测试 |
| `docs/agent-farm/` | 架构、运维、恢复/回滚与机器契约 |

## 本地启动

需要 Node.js 20 或更高版本、pnpm、Git，以及用于 Agent SDK 真实运行的 provider 凭据。未配置 provider 时，服务、Git 生命周期、review gate、WebSocket 和 residual scan 仍可运行；Agent run 会如实进入 `provider_blocked`，不会伪造成成功。

```bash
pnpm --dir server install
```

```bash
pnpm --dir web-app install
```

```bash
pnpm --dir web-app build
```

```bash
pnpm --dir server start
```

默认监听 `http://127.0.0.1:7878`，应用位于 `/web/`，健康检查位于 `/api/health`。生产式启动要求 `web-app/dist/index.html` 已构建；如果缺失，页面路由返回结构化 503，而 API 和健康检查保持可用。

数据默认写入 `~/.agent-farm`。SQLite 中持久 `ledger_id` 跨 restart 保持、DB replacement 时变化；migration 002 会保守 backfill 旧 workspace/event，绝不合成未经当前证据验证的 harvest。测试和并行实例必须使用独立目录：

```bash
AGENT_FARM_DATA_DIR=/absolute/isolated/path PORT=8787 pnpm --dir server start
```

## 验证

```bash
pnpm --dir server typecheck
```

```bash
pnpm --dir web-app build
```

```bash
pnpm --dir e2e test:infrastructure
```

```bash
pnpm --dir e2e test:integration
```

```bash
pnpm --dir e2e test:browser
```

真实 provider 生命周期由 `pnpm --dir e2e test:provider` 运行。Gate 不可用时写 machine-readable blocked proof 并以 exit code 2 结束。Gate ready 只允许开始真实尝试；运行时仍可能因 401/403 进入 `provider_blocked`。Suite 可通过这个安全失败生命周期，但 runtime proof 的 `provider_status` 必须保持 `blocked`，不能冒充 verified。

## 进一步阅读

- [架构与数据模型](architecture.md)
- [SQLite schema 与迁移](schema.md)
- [Task、run 与 Git 生命周期](lifecycle.md)
- [运维、恢复、回滚与清理](operations.md)
- [测试、证明与保留策略](testing-and-proofs.md)
- [部署、监控与回滚](deployment.md)
- [以 request_id 为中心的排障](troubleshooting.md)
- [HTTP API](contracts/http-api.md)
- [WebSocket ledger](contracts/websocket-ledger.md)
- [REST audit event](contracts/audit-events.md)
- [Residual benchmark](contracts/residual-benchmark.md)
- [Ledger event JSON Schema](schemas/ledger-event.v1.schema.json)
- [Residual benchmark JSON Schema](schemas/residual-benchmark.v1.schema.json)

## 美术资源许可

当前 React CSS 直接引用两张本地图片，但 server 的 `/assets` 映射指向整个 `FarmCreator/assets`，且只有 loopback bind 时才注册。根目录 README 明确说明部分资源来自第三方项目和旧商业游戏，仅用于学习研究。该本地 guard 不是授权：`FarmCreator/assets`、截图及其他既有美术资源不得公开分发、打包或商用，也不得通过反向代理绕过 non-loopback 限制；部署前必须取得权利许可，或替换/移除资源并重新限制 route。
