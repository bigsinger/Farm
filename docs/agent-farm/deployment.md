# 部署、监控与回滚

当前实现是本机 loopback-only 控制面：只接受 `127.0.0.1` / `localhost` / `::1`、无远程应用鉴权、不是互联网多租户服务。非 loopback bind 会在任何 data/SQLite/migration 写入前失败。部署闭环必须按 `build → stage → start → smoke → monitor → rollback` 执行，并同时处理 SQLite、Git worktree、Claude provider 与静态资源许可。禁止把本服务挂到 LAN/public reverse proxy。

## 0. 发布门槛

- Node.js `>=20.11.0`、pnpm、Git、sqlite3 可用；
- 使用固定代码 commit 和与之匹配的 lockfiles；
- 有独立、可写、受权限保护的绝对 `AGENT_FARM_DATA_DIR`；
- 进程用户对目标 repositories 和 data root 有明确权限；
- Git author/committer identity 已显式配置为可审计发布身份；代码虽有 `Agent Farm <agent-farm@localhost>` fallback，但正式仓库不应依赖它；
- 如允许真实 run，provider 凭据只通过受保护 env/settings 注入；
- 确认 `FarmCreator/assets` 不会被公网分发；
- 保留升级前停服备份和旧应用 artifact。

## 1. Build

```bash
pnpm --dir server install --frozen-lockfile
pnpm --dir web-app install --frozen-lockfile
pnpm --dir e2e install --frozen-lockfile
```

```bash
pnpm --dir server typecheck
pnpm --dir web-app build
pnpm --dir e2e typecheck
pnpm --dir e2e test:local
```

`web-app build` 依次运行浏览器 TS、Vite config TS typecheck 和 Vite build，输出 `web-app/dist`。Server 没有独立编译 artifact，`start` 通过本地 `tsx` 执行源码，因此部署包必须带 server source、migrations、package dependencies 和 build 后的 web-app dist。

若 release 要宣称 provider-backed coding 成功，另运行 `pnpm --dir e2e test:provider` 并保存 runtime verified proof。Gate ready 后 runtime 401/403 blocked 的 lifecycle test 可以通过，但 proof 仍为 `provider_status=blocked`，不能支撑 provider-backed 成功声明。

## 2. Stage

1. 停止接收新 task；等待 active run 结束，或显式 cancel/wilt。
2. 记录当前代码 commit、`GET /api/health`、ledger last seq、task count 和最新 residual artifact。
3. 优雅停止当前服务。
4. 在停服状态下备份整个 `AGENT_FARM_DATA_DIR`，保留权限与 symlink metadata；不要只复制 `db.sqlite`。
5. 将新代码、migrations、dependencies 和 `web-app/dist` 放到 staging release directory。
6. 复制停服备份到独立 staging data directory；不要让 staging 指向生产目录或生产 repositories 的可写副本。
7. 使用独立 port 和 loopback host 启动 staging。已有数据库先 read-only 检查 unknown migration/checksum；不兼容时应在任何 DB/WAL/metadata/reconciliation 写入前退出。兼容时才应用 forward migrations并执行 restart reconciliation。正常启动会追加 `server.reconciliation.completed`，并可能将 interrupted run/operation 收敛为 crashed/reconciled/recovery-required；staging 副本不再与备份逐字节相等。
8. 在 staging 副本检查 `PRAGMA integrity_check`、000/001/002 migration registry、`ledger_metadata`、legacy backfill（若有旧行）、ledger replay、residual artifact 和 Git registry，并把正常 startup 新增事件纳入预期。

## 3. Start

推荐最小环境：

```bash
AGENT_FARM_DATA_DIR=/absolute/agent-farm-data \
HOST=127.0.0.1 \
PORT=7878 \
GIT_AUTHOR_NAME='Agent Farm' \
GIT_AUTHOR_EMAIL='agent-farm@example.invalid' \
GIT_COMMITTER_NAME='Agent Farm' \
GIT_COMMITTER_EMAIL='agent-farm@example.invalid' \
pnpm --dir server start
```

`server/.env` 会在启动时读取，随后 `~/.claude/settings.json` 的 `env` 只补尚未设置、且属于 provider/transport allowlist 的键。优先级：

```text
shell env > server/.env > ~/.claude/settings.json provider/transport env
```

设 `AGENT_FARM_DISABLE_USER_SETTINGS=1` 可隔离服务账户。Provider kind 检测只根据显式 env；磁盘上的默认 Anthropic profile 若没有通过 `ANTHROPIC_PROFILE` 显式选择，Agent Farm 会视为 provider unavailable。HTTP/WS 还要求 canonical loopback Host；browser 请求必须匹配精确 Origin allowlist，并拒绝 `Origin: null` 与 cross-site `Sec-Fetch-Site`。

使用进程监督器时：

- 工作目录固定为 release root/server；
- SIGTERM 留出至少 10 秒，以便 cancel SDK runs、关闭 WS/HTTP/SQLite；
- 不要同时启动两个进程共享同一 data directory；
- stdout/stderr 进入受访问控制、带 rotation 的日志；
- release 与 data directory 分离，应用回滚不覆盖数据证据。

## 4. Smoke

启动后立即执行：

```bash
curl --fail -H 'x-request-id: deploy-smoke-health' \
  http://127.0.0.1:7878/api/health
```

```bash
curl --fail -H 'x-request-id: deploy-smoke-tasks' \
  http://127.0.0.1:7878/api/tasks
```

```bash
curl --fail -H 'x-request-id: deploy-smoke-events' \
  'http://127.0.0.1:7878/api/events?after_seq=0'
```

```bash
curl --fail -H 'x-request-id: deploy-smoke-web' \
  http://127.0.0.1:7878/web/
```

然后：

- 验证 response `x-request-id`；
- 从升级前 last seq 做 REST replay，逐页验证 wire-order seq、页尾 `last_seq`、`has_more` 和 `ledger_last_seq`，直到捕获的 ledger head；
- 建立 `/ws?after_seq=<last-contiguous>`，验证 `hello → replay → ready` 与持久 `ledger_id`；在 disposable staging 副本替换同路径 SQLite 后，验证 ledger ID 变化和旧 cursor reset；
- Replay 完成后再取 `/api/tasks` 最终 snapshot，要求它的 `last_seq` 等于连续 cursor；
- `POST /api/benchmarks/residual`，保存 artifact ID/digest，调查 blocking finding；
- 检查 SQLite `integrity_check`；
- 在 staging repository 上跑一个可清理的真实 task，覆盖 worktree、run blocked/verified、diff、review、harvest 或 wilt；
- 若 provider 未配置，明确验证 run 为 `provider_blocked`，不能把 health `ok=true` 当成 provider 可用。

## 5. Monitor

持续监控：

- `/api/health`: availability、ledger cursor、active runs、provider kind；
- HTTP 4xx/5xx 按 `x-request-id` 聚合；
- server log 中 `[request <id>]`、`[ws]`、migration checksum、SQLite busy/integrity；
- WS close code 1008/1009/1011/1013、replay gap 与 reconnect 频率；
- queued/running stale runs；
- provider blocked/auth failures；
- task `recovery_required`；
- operation locks/journal；
- data disk、WAL、artifact/benchmark 和 test proof retention；
- residual `blocking` 数量、cleanup remaining paths、cost-event mismatch；
- repository base branch cleanliness与意外 worktree/branch。

健康检查不验证 credential 可实际调用 provider。Provider 可信度来自真实 run/result 和 provider proof。

## 6. Rollback

### Application rollback

应用回滚是切回旧代码/build，不自动倒退 schema：

1. 停止新版本写操作并优雅停服；
2. 保存新版本日志、health、ledger cursor 和 residual artifact；
3. 在数据副本确认旧代码能读取当前 schema；
4. 将 server commit 与匹配的 `web-app/dist` 一起切回；
5. 启动旧版本；
6. 从回滚前 cursor 验证 REST/WS replay；
7. 运行 integration smoke、SQLite integrity 和 residual scan。

只有旧应用明确 forward-compatible 时才可保留当前 migrated data。不能只回滚 React build 或只回滚 server。

### Migration/data rollback

本项目没有 down migration。若新 migration 或新 schema 不可由旧应用读取：

1. 立即停服，保留失败后的完整 data directory 和日志作为证据；
2. 把活动 data directory 移出路径，不覆盖它；
3. 从升级前停服备份恢复整个 data directory；
4. 启动旧应用 commit/build；
5. 验证 SQLite integrity、migration checksum、ledger last seq、task/outcome count、Git registry；
6. 生成 residual artifact并与升级前证据比较。

单 migration 文件 transaction 失败会回滚该文件，但不撤销此前已提交 migration；这与完整 data rollback 是两回事。

若新版本已经处理 task 或产生 Git commit，直接恢复旧 SQLite 会让 Git/ledger 分叉。应停止所有写入，保留新旧数据，按 `Agent-Farm-Task` trailer、operation journal、base HEAD 和 audit seq 逐 task reconcile；无法证明时保持 `recovery_required`，不要强行宣告回滚成功。

## 静态资源许可与公网边界

当前 React CSS 直接引用：

```text
/assets/resources/farmUI/farm_bg01.png
/assets/resources/map/farm_soil_tiles.png
```

但 server 的 `/assets` 静态映射指向整个 `FarmCreator/assets`。当前代码只有在 `HOST` 是 loopback 且目录存在时才注册 `/assets`；这是一道本地分发边界，不是资源授权。

硬性部署规则：

- 现有 `/assets` 只可用于本项目当前本地许可/学习研究范围；
- 禁止把既有 Farm/Cocos 美术资产直接公开发布、打包、CDN 分发或商业再分发；
- 不要通过反向代理把 loopback server 的 `/assets` 转发到公网，以此绕过 host guard；
- 公开或商业部署前必须取得完整权利许可，或替换/移除全部现有资源引用，并关闭或重新限制 `/assets` 映射；
- 当前服务无鉴权。即使移除资源问题，也必须另加 TLS、认证、授权、CSRF/Origin 策略、rate limit、审计和租户隔离，才能评估网络部署。

因 `HOST` 改为非 loopback 后 `/assets` 不注册，现有 UI 背景会缺失；这是预期安全失败，不应通过暴露原资产目录修补。
