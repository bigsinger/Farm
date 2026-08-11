# 文档导航

本目录的当前 Agent Farm 文档以 `server/src`、`server/migrations`、`web-app/src` 和 `e2e` 的真实实现为依据。旧命名或 legacy 页面不构成契约。

## Agent Farm

- [总览与本地启动](agent-farm/README.md)
- [架构与数据模型](agent-farm/architecture.md)
- [SQLite schema 与迁移](agent-farm/schema.md)
- [Task、run 与 Git 生命周期](agent-farm/lifecycle.md)
- [运维、恢复、回滚与清理](agent-farm/operations.md)
- [测试、证明与保留策略](agent-farm/testing-and-proofs.md)
- [部署、监控与回滚](agent-farm/deployment.md)
- [以 request_id 为中心的排障](agent-farm/troubleshooting.md)

## Wire contracts

- [HTTP API](agent-farm/contracts/http-api.md)
- [WebSocket ledger](agent-farm/contracts/websocket-ledger.md)
- [REST audit event](agent-farm/contracts/audit-events.md)
- [Residual benchmark](agent-farm/contracts/residual-benchmark.md)
- [REST ledger event JSON Schema](agent-farm/schemas/ledger-event.v1.schema.json)
- [Residual benchmark JSON Schema](agent-farm/schemas/residual-benchmark.v1.schema.json)

## 子项目入口

- [Server](../server/README.md)
- [Web app](../web-app/README.md)
- [E2E](../e2e/README.md)

## 必须保持的语义边界

- Central queue 中只有显式 dependency 形成 group。
- Claim、magnet、diff 的路径相交只形成 overlap evidence，不自动建立 dependency 或协作关系。
- Open blocking overlap 仍可阻止 run 和 harvest。
- Git、Claude Agent SDK、SQLite 和 browser proof 必须来自真实执行；provider unavailable 必须 blocked。
- SDK reported cost 为 `0` 时原样保留；无报告时为 `null`，不估算。
- Migration/data rollback 与 application rollback 是不同操作；unknown future migration 必须 zero-write fail-fast，002 legacy backfill 是单 transaction。
- `/assets` 仅限当前项目本地许可范围，禁止公开发布既有 Farm/Cocos 美术资产。
