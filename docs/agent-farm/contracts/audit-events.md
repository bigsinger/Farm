# Audit event 契约

本页描述 `server/src/ledger.ts` 中 `AuditEventView` 的真实 REST wire shape。机器可校验版本是 [`ledger-event.v1.schema.json`](../schemas/ledger-event.v1.schema.json)。WebSocket 为减少帧大小省略了三个字段；其协议见 [WebSocket ledger](websocket-ledger.md)，不能用本 Schema 假装两种 shape 相同。

## REST event shape

`GET /api/events?after_seq=N` 的 `events` 数组中每项均为：

```json
{
  "seq": 42,
  "id": "242a5c77-9e92-4d0e-836f-21c562ab96b0",
  "type": "task.seeded",
  "entity_type": "task",
  "entity_id": "task-id",
  "repository_id": "repository-id",
  "task_id": "task-id",
  "run_id": null,
  "actor": "human",
  "occurred_at": 1760000000000,
  "payload": {
    "title": "更新契约"
  },
  "provenance": {
    "kind": "task_seed",
    "source": "http_api",
    "digest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "seq": 42
  }
}
```

字段约束：

- `seq` 是 SQLite `audit_events.seq` 的正安全整数；全局单调递增。
- `id` 是 event ID；当前写入器生成 UUID，但 wire contract 只依赖非空字符串。
- `type`、`entity_type`、`entity_id`、`actor` 是非空字符串。
- `repository_id`、`task_id`、`run_id` 依事件上下文为字符串或 `null`。
- `occurred_at` 是 Unix epoch 毫秒整数。
- `payload` 是任意 JSON 值。服务默认写 `{}`，读取损坏 JSON 时会投影为 `null`；契约不能擅自限制为 object。
- `provenance.seq` 与 event `seq` 相同。
- `provenance.digest` 通常是 canonical payload 的 SHA-256；调用方提供的 provenance 也可显式给出字符串或 `null`，所以 wire Schema 不把它错误限定为 64 位摘要。

## 不可变性与来源

每次领域 mutation 在 SQLite transaction 内同时写状态投影和 audit event。事务提交后才发布 WebSocket 通知。`audit_events` 上的 trigger 拒绝 `UPDATE` 与 `DELETE`，因此纠正历史应追加新事件和 outcome，而不是改旧记录。

真实来源包括：

- HTTP 人工操作；
- Git inspection、diff、worktree、commit 和 cleanup；
- Claude Agent SDK message/result；
- SQLite、Git registry 与 filesystem residual scan；
- restart reconciliation。

SDK message 在进入账本前同时经过敏感键清理和已配置敏感 env value 文本替换；numeric usage token counters 保留。嵌套数组/object 有深度/数量边界，超长字符串截断后再 redaction。Secret 不应出现在 payload、benchmark 或测试证明中。

## 游标和连续性

REST 查询 `GET /api/events?after_seq=N` 在一个 SQLite read transaction 中捕获账本头，并返回固定 shape：

```json
{
  "events": [],
  "last_seq": 0,
  "has_more": false,
  "ledger_last_seq": 0
}
```

`events` 是 `seq > N` 的当前批次，最多 10,000 条；`last_seq` 是本页末 event seq（空页等于 `N`），`ledger_last_seq` 是该页 transaction 捕获的账本头，`has_more` 必须精确等于 `last_seq < ledger_last_seq`。当前 endpoint 没有调用方可调 `limit`；has-more 时用本页 `last_seq` 继续，直到页尾等于 ledger head。`N` 必须是无 leading-zero 的非负安全整数；若游标超前，返回 HTTP 409 `event_cursor_ahead`，details 同时含 `last_seq` 与 `ledger_last_seq`。客户端不能把超前游标当成空结果。Migration 002 已把每个 legacy event 追加进当前 `audit_events`，并在 payload 中保留原 payload text/合法 JSON。

账本 seq 是连续性检测依据，不是业务实体版本号。客户端遇到缺口时应停止应用后续事件，使用最后连续 seq 重新请求 REST replay，再重连 WebSocket。

## 版本边界

`ledger-event.v1.schema.json` 描述当前 REST 单事件，不描述外层 `{ events, last_seq, has_more, ledger_last_seq }`，也不描述 WebSocket envelope。Schema 使用 JSON Schema Draft 2020-12，可由支持该 draft 的标准 validator 编译和校验。
