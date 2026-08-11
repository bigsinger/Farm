# SQLite schema 与迁移

## 数据根

默认数据根是 `~/.agent-farm`，可用 `AGENT_FARM_DATA_DIR` 指定绝对隔离目录。共享 env loader 在 `db.ts` 计算路径/打开 SQLite 之前加载 `server/.env` 与可选 user settings，因此配置不会晚于数据库初始化：

```text
AGENT_FARM_DATA_DIR/
  db.sqlite
  db.sqlite-wal
  db.sqlite-shm
  worktrees/
  artifacts/
  logs/
  benchmarks/
```

SQLite 启动配置：

```text
journal_mode = WAL
foreign_keys = ON
busy_timeout = 5000
synchronous = NORMAL
```

`db.sqlite`、WAL、SHM 与旁边的 Git/artifact 状态共同构成运行数据。在线备份不能只复制主数据库文件而遗漏 WAL；升级回滚的可靠单位是停服后的完整 data directory。

## Migration runner

Migration 位于 `server/migrations`。当前顺序：

1. `000_legacy_compat.sql`
2. `001_hyperedge_core.sql`
3. `002_legacy_workspace_backfill.sql`

Runner 只接受 `^\d+[_-].+\.sql$`。Filename leading digits 是唯一 version，按任意长度十进制 version 排序，同 version 重复会 fail-fast；每个文件在独立 SQLite transaction 中应用。成功后 `schema_migrations` 保存：

```text
version, filename, sha256, applied_at
```

对已有非空数据库，服务先以 read-only、`fileMustExist` 模式检查 `schema_migrations`，此时不会创建目录、WAL、schema、ledger metadata 或 reconciliation event。数据库中只要有当前 binary 不认识的 version，就在任何写入前 fail-fast；已知 version 的 filename/SHA-256 不一致也同样拒绝。兼容性通过后才打开可写连接并应用本地缺失 migration。已应用 SQL 绝不能原地修改，应新增更高 version 的 forward migration。项目没有 down migration runner。

单文件执行失败时该文件 transaction 回滚，但先前 migration 可能已提交。因此“migration 事务回滚”不等于“整个版本升级已回滚”。完整恢复流程见 [deployment](deployment.md) 和 [operations](operations.md)。

## Legacy compatibility 与 002 backfill

`000_legacy_compat.sql` 保留旧 `workspaces` 与 `events` 表；`002_legacy_workspace_backfill.sql` 再把真实旧行确定性、可审计地映射进当前模型。`/workspaces` compatibility routes 仍调用当前 task handlers，因此 backfill 后旧 workspace 同时可从 `/api/tasks` 和 compatibility API 读取。

002 在同一个 checksum-protected transaction 中完成：

- 为 Phase 1 缺失的 `cost_usd`、`num_turns`、`duration_ms` legacy columns 补零值列；
- 每个 legacy repo path 创建 deterministic repository/audit identity；
- 每个 workspace 保留全部旧字段和 metrics 于 `legacy.workspace.backfilled` payload，并映射到 repository/task；
- 每个旧 event 追加一个 audit row，保留原 ID/type/time/workspace、精确 `payload_text`，合法 JSON 另放 `payload_json`；
- 所有 backfilled task `auto_start=0`，不会升级后静默运行；
- legacy `harvested` 只降级为 `review_pending + stale`，不会在缺少当前 review/digest/Git evidence 时合成 harvested；`growing`/未知态进入 recovery，`ripe` 进入 review pending，`wilted` 保留 terminal；
- deterministic event IDs 与 `INSERT OR IGNORE` 只让 backfill 的 data INSERT 在已具备 002 schema 的受控恢复演练中可重复执行；含 `CREATE TABLE` / `ALTER TABLE` 的整份 002 SQL 不能任意手工重放，正常 runner 仍按 checksum 只应用一次。Migration 任一步或 checksum 失败时整个 002 transaction 回滚，不留下 partial schema/backfill。

Legacy schema 没保存 Git identity/base commit，因此 backfilled repository/task 明确留下 unavailable/error/blocking evidence，需人工验证，不得把迁移成功理解为 Git lineage 已证明。

## Hyperedge core

### `ledger_metadata`

Singleton row `id=1` 保存随机 UUID `ledger_id` 与创建时间。Fresh database 在 migration 后初始化一次；普通重启不变化。若同一路径的 SQLite 文件被替换，新数据库会获得新 identity，客户端必须丢弃绑定旧 ledger 的 cursor。

### `repositories`

保存 canonical root、git dir、是否 Git、default branch、HEAD、最后错误、创建 event seq 与 `last_event_seq`。当前 repository mutation 会推进 `last_event_seq`，projection 的持久 provenance 取它（缺失时回退创建 event）；detail 中本次 live Git inspection 另有 observation provenance，不会冒充 ledger history。当前 repository ID 来自 canonical root SHA-256 前缀；legacy backfill 使用显式 `legacy-repository:` deterministic identity。

### `tasks`

中央队列投影，包含 prompt/title、repository/base commit、branch/worktree、状态、blocking reasons、当前 run/diff/review/outcome、SDK metrics 与来源 event seq。

Task status：

```text
seeded
preparing
blocked
running
review_pending
review_rejected
harvesting
harvested
wilting
wilted
failed
cancelled
recovery_required
```

### `task_dependencies`

显式有向边 `task_id → depends_on_task_id`。这是唯一形成 dependency group 的关系。Group 是忽略边方向后的弱连通分量；没有显式边时 group 为 `null`。

### `path_claims`

仓库相对、规范化 path 的 active/released 记录；mode 是 `exclusive` 或 `shared`。Claim 产生 ownership evidence，但不等于 dependency。

### `overlap_evidence`

字段包括左右 task、path、`evidence_type`、`blocking`、`status`、details、resolution 和 provenance。

```text
evidence_type: claim | magnet | diff
status:        open | resolved | superseded
blocking:      0 | 1
```

Claim、magnet、diff 的路径相交只形成 evidence，不自动形成 dependency、group 或协作关系。这个语义边界不意味着 overlap 永不阻挡：任意 open 且 `blocking=1` 的 evidence 都会阻止 run 和 harvest。当前生成规则是 magnet 非阻断，shared/shared claim 非阻断，至少一方 exclusive 的 claim 阻断，diff overlap 阻断；最终 gate 仍读取持久化 `blocking` 值。

### `agent_runs`

每个 attempt 的 provider/session/lineage、terminal subtype、cost、turns、duration、usage、permission denial 与错误。

Run status：

```text
queued
running
succeeded
failed
cancelled
timed_out
provider_blocked
crashed
```

`provider_blocked` 是终态证据，不是 succeeded 的别名。Cost 为 SDK reported `total_cost_usd`，合法地可以为 `0`；缺失 result 时为 `NULL`，无估算列或估算路径。

### `artifacts`

保存 patch/stat/manifest/result/log/benchmark 等文件的路径、media type、size、SHA-256、metadata 与 source event seq。文件内容不嵌入 SQLite 主表。

### `reviews`

保存 approved/rejected、reviewer、summary 与当时的 diff digest。Approval 不是 task 状态；当前 digest 变化时 approval stale。

### `outcomes`

保存 harvest/wilt/cancel/failure/recovery 等操作结果、operation ID、commit SHA、diff digest、reason 与 provenance。

### `operation_locks` 与 `operation_journal`

- `operation_locks`：repository 范围互斥写锁，保护 harvest/wilt。
- `operation_journal`：跨 SQLite 与 Git 边界的 crash recovery，保存 pre-commit、operation state 与 evidence。

### `audit_events`

全局自增 seq 的 append-only ledger：entity IDs、actor、payload JSON、provenance 与 occurred-at。Trigger 拒绝 update/delete。REST wire shape 见 [audit events](contracts/audit-events.md)。

### `benchmark_artifacts`

保存 residual schema version、artifact path、SHA-256、JSON 与生成 event seq。磁盘文件和 registry 必须一致；读取会验证 schema version 和 digest。

## Foreign key、唯一性与来源

Foreign keys 在每次连接上启用。Domain mutation 使用 transaction 和 compare-and-set guard；不能通过只看前端状态绕过生命周期。Materialized relationship 和 artifact 记录持有 source event seq，因此 UI projection 可追溯到 append-only ledger。

## 升级与备份检查

停服副本上至少执行：

```bash
sqlite3 /path/to/db.sqlite 'PRAGMA integrity_check;'
```

```bash
sqlite3 /path/to/db.sqlite 'SELECT version, filename, sha256, applied_at FROM schema_migrations ORDER BY length(version), version;'
```

```bash
sqlite3 /path/to/db.sqlite 'SELECT id, ledger_id, created_at FROM ledger_metadata;'
```

必须恰有 singleton `id=1`。

```bash
sqlite3 /path/to/db.sqlite 'SELECT MIN(seq), MAX(seq), COUNT(*) FROM audit_events;'
```

检查 migration 只证明 SQLite schema；还必须验证 Git worktree registry、base branch/HEAD、artifact digest 与 residual artifact。不要直接 update/delete ledger 或手工把 run 标成成功。
