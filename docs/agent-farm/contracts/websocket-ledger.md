# WebSocket ledger 契约

## Endpoint 与连接前提

连接地址：

```text
GET /ws?after_seq=N
```

`after_seq` 省略时等于 `0`；出现多次、不是纯十进制非负数或超出 JavaScript 安全整数范围时，upgrade 返回 plain-text HTTP 400。只有 `/ws` 和 `GET` 可 upgrade。浏览器请求带 `Origin` 时，Origin 的 host 必须与 HTTP `Host` 相同；非浏览器客户端可不发送 Origin。

WebSocket upgrade 不经过 Express request-ID middleware。因此 upgrade 阶段的 400/403/404/405 是 plain text，不具有 REST error envelope 或 `request_id`。建立连接后的诊断使用 envelope、close code、server log 和 cursor。

## 阶段

正常序列固定为：

```text
hello → replay* → ready → live*
```

示例：

```json
{"type":"hello","server_id":"server-uuid","ledger_id":"550e8400-e29b-41d4-a716-446655440000","last_seq":10,"restarted":true}
```

```json
{"type":"replay","events":[],"last_seq":10}
```

```json
{"type":"ready","last_seq":10}
```

```json
{"type":"live","event":{"seq":11,"id":"event-id","type":"task.seeded","task_id":"task-id","repository_id":"repo-id","run_id":null,"occurred_at":1760000000000,"payload":{},"provenance":{"kind":"task_seed","source":"http_api","digest":"digest","seq":11}}}
```

`hello.last_seq` 是握手时 cursor。服务以 250-row SQLite page 读取，并按 4 MiB outbound frame 上限把一个或多个 event 组装为 replay envelope；“database page”不等于“一定一个 WebSocket frame”。随后吸收回放期间新增的 seq，确认没有缺口后发送 `ready`。`ready.last_seq` 才是进入 live 阶段时客户端已接收的权威 cursor。

当前数据库没有持久化 process identity，`restarted` 保守地始终为 `true`；客户端不能把它解释为这次重连前必然发生过一次重启。`ledger_id` 来自 SQLite `ledger_metadata` singleton 的持久随机 UUID：普通进程重启保持不变；即使 filesystem path 相同，只要替换成独立初始化的 SQLite，新数据库就获得新 identity。完整恢复同一账本的旧 snapshot 会保留 ID，但 `hello.last_seq` 可能小于客户端 cursor；客户端也必须 reset。Cursor 必须与 ledger ID 绑定；identity 变化、旧 cursor 没 identity binding 或 server head 倒退时，丢弃 cursor/recent tail并从 seq 0 完整 REST resync。

## WebSocket event shape

`replay.events[]` 和 `live.event` 使用同一个精简 shape：

```text
seq, id, type,
task_id, repository_id, run_id,
occurred_at, payload,
provenance { kind, source, digest, seq }
```

与 REST `AuditEventView` 相比，它有意省略：

```text
entity_type, entity_id, actor
```

需要这些字段时，应使用 [`GET /api/events`](http-api.md#ledger-与-residual) REST replay。机器 Schema [`ledger-event.v1.schema.json`](../schemas/ledger-event.v1.schema.json) 只匹配 REST shape，不适用于这个精简 event。

## 其他 server envelope

游标超前：

```json
{
  "type": "resync_required",
  "reason": "after_seq_ahead_of_ledger",
  "after_seq": 99,
  "last_seq": 10
}
```

随后 close code 为 `1008`。客户端应丢弃超前 cursor，从可靠持久化的最后连续 cursor 或 `0` 重同步。

持久账本回放失败：

```json
{
  "type": "error",
  "code": "ledger_replay_failed",
  "message": "persistent ledger replay failed",
  "retryable": true
}
```

随后 close code 为 `1011`。先记录最后连续 seq，再查看 server log 和 SQLite integrity，禁止假定未收到的 mutation 已成功。

Ping 响应：

```json
{"type":"pong","server_id":"server-uuid","last_seq":10}
```

## Client messages

只支持 JSON text：

```json
{"type":"ping"}
```

```json
{"type":"ack","seq":10}
```

`ack.seq` 必须是 0 以上安全整数，且不能大于该连接最后发送的 seq。Ack 只记录客户端进度，不删除事件，也不改变 replay 真相。Binary、无效 JSON、不支持的消息或超前 ack 以 close code `1003` 关闭。

## 容量与失败路径

- client payload 上限：64 KiB；
- 单个 outbound frame 上限：4 MiB；
- 发送缓冲/backpressure 上限：8 MiB；
- replay 数据库页：250 events；
- replay 阶段内存 seq buffer：50,000 events；
- send timeout：15 秒；
- per-message deflate：关闭。

事件太大使用 `1009`；客户端消费过慢、send timeout 或 replay buffer 超限使用 `1013`；持久读取失败使用 `1011`。服务端发布 live event 前总是按 seq 重新读取 SQLite，调用方内存对象不会成为历史真相。

## 客户端恢复算法

1. 持久化最后一个连续应用的 `seq`。
2. 连接 `/ws?after_seq=<seq>`。
3. 验证 replay/live 严格从 `seq + 1` 连续增长。只有 `seq <=` 连接开始时已持久化 cursor 的旧历史重复可忽略；本页/本连接中新接受过的重复 seq 与乱序一样属于 protocol discontinuity，必须 resync。
4. 收到 `ready` 后才宣告实时同步；ready 声称的 seq 不能大于客户端已连续接受的 seq，ready 前收到 live 也是协议失败。
5. 遇到 gap/duplicate/order error、`resync_required`、1011、ledger ID 变化或进程重启，分批调用 REST events 回放到 `ledger_last_seq`，随后获取 `/api/tasks` 最终 snapshot，并要求 snapshot `last_seq` 等于已接受 cursor，再重连。
6. REST mutation 成功时立即采用响应投影或 refetch；不要为了等待 WebSocket 回声而延迟 UI 真相。
