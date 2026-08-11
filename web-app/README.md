# Agent Farm web app

React 19 + Vite 6 的中央队列界面，生产式路径为 server 同源提供的 `/web/`。仓库根 `web/` 是 legacy 页面，不是当前 React app。

## 安装与命令

```bash
pnpm --dir web-app install
```

开发：

```bash
pnpm --dir server start
pnpm --dir web-app dev
```

Vite dev server 使用 `http://localhost:5173`，代理：

```text
/api    → http://localhost:7878
/assets → http://localhost:7878
/ws     → ws://localhost:7878
```

构建：

```bash
pnpm --dir web-app build
```

该命令运行两个 TypeScript `--noEmit` 检查，再运行 Vite，输出 `web-app/dist`。随后由 server 提供：

```bash
pnpm --dir server start
open http://127.0.0.1:7878/web/
```

`pnpm --dir web-app preview` 只预览静态 Vite build，没有配置 `/api`、`/assets` 或 `/ws` backend proxy，不能当成完整集成预览。

## 数据流

Frontend REST 请求使用相对 `/api/...`。WebSocket 根据页面协议和 host 生成：

```text
http  → ws://<same-host>/ws?after_seq=<lastSeq>
https → wss://<same-host>/ws?after_seq=<lastSeq>
```

Browser Origin 必须与 HTTP Host 同源。连接阶段是 `hello → replay → ready → live`。客户端把 cursor 绑定到持久 `ledger_id`：同路径数据库被替换、旧 cursor 没 identity binding、seq gap/乱序/new duplicate、ready 超前或 ready 前 live 都触发 fail-closed resync。REST replay 严格按 wire order 和 `{last_seq, has_more, ledger_last_seq}` 分页到头，绝不先排序掩盖协议错误；随后重新取 `/api/tasks` 最终 snapshot，并要求 snapshot `last_seq` 精确等于已接受 cursor。REST mutation 成功后采用响应投影或 refetch，不等待 WS 回声。

契约：

- [HTTP API](../docs/agent-farm/contracts/http-api.md)
- [WebSocket ledger](../docs/agent-farm/contracts/websocket-ledger.md)
- [Lifecycle](../docs/agent-farm/lifecycle.md)

## UI 语义

三种主视图：

- queue：task 状态、run、review、harvest/wilt；
- impact：dependency、claim 与 overlap evidence；
- residual：最新只读 residual artifact。

必须保持：

- 只有显式 dependency 形成 group；
- claim/magnet/diff overlap 只是 evidence，不自动形成 dependency 或协作关系；
- open blocking evidence 仍会阻止 run/harvest；
- provider unavailable 显示 blocked，不能显示成功；
- cost `0` 表示 SDK reported zero，`null` 表示未报告，不能估算；
- approved task 的 `review_stale=null` 表示 live diff 未验证，不能显示为“仍有效”；只有 detail refresh 后 exact digest 的 `false` 才可作为当前证明；
- task inspector 使用服务端暴露的精确 `base_commit`，repository panel 分开显示 persisted event provenance 与 live Git observation；
- terminal task 即使 worktree 已清理，diff 仍来自 retained artifact；large/CJK patch 按 UTF-8 byte boundary 安全截断；
- residual latest 404 显示“尚未扫描”，不能显示零问题。

界面已有真实空 queue、筛选空态、diff empty/large/binary、detail loading/error、initial load failure、refresh failure 保留旧真实 snapshot、review/harvest/wilt 错误与确认。Loading state 不使用 fixture 数据。Diff 渲染前做敏感文本 redaction，diff2html 将 hostile filename/content 作为文本编码；浏览器测试直接验证 `<img onerror>` 等 payload 不执行。

## 浏览器验证范围

TypeScript target ES2022，使用 DOM/DOM.Iterable。仓库没有 browserslist。自动化只运行 Playwright Chromium，覆盖 responsive empty state、reduced motion 和基础 accessibility；Firefox/Safari 尚无自动化证明，发布说明不能宣称已验证。

```bash
pnpm --dir e2e test:browser
```

## 资产许可

当前 CSS 直接引用：

```text
/assets/resources/farmUI/farm_bg01.png
/assets/resources/map/farm_soil_tiles.png
```

Server 本地 `/assets` 映射却指向整个 `FarmCreator/assets`，且只在 loopback bind 时启用。现有 Farm/Cocos 美术资源仅可用于当前项目本地许可/学习研究范围，禁止公网发布、打包或商业再分发。

公开部署前必须取得权利许可，或替换/移除这些引用并关闭/重新限制 asset route；不能通过反向代理绕过 server 的 non-loopback guard。详见 [部署](../docs/agent-farm/deployment.md)。
