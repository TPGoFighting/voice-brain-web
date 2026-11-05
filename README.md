# TP Voice Brain Web

> **Voice Brain 的服务端与 Web / PWA 客户端**，部署于 <https://voice.tpgofighting.top>。
> 与姊妹仓库 [TPGoFighting/voice-brain-android](https://github.com/TPGoFighting/voice-brain-android)（Kotlin 2.0 + Jetpack Compose 原生客户端）共同构成「个人长期语音副驾与第二大脑」的双端体系。

基于 **Node.js 22 + Express 5 + ws + dotenv** 构建：浏览器采集 16k PCM 音频，经 WebSocket 中继到 DashScope `fun-asr-realtime` 做流式识别，再由 `qwen-flash` 句级快修、DeepSeek 生成结构化纪要与长期记忆，最后可反向写回 Obsidian Vault / Hermes 知识库。前端是零构建的单页 PWA（本地化 Tailwind 引擎 + TP Brand VI v2.4 新野兽派组件库）。

---

## 架构分层

```
+---------------------------------------------------------------------------+
|                        TP Voice Brain Web (Node 22)                       |
+------------------+------------------+------------------+-----------------+
| 1. 实时流式工作台 | 2. 纪要与决策     | 3. 第二大脑记忆库 | 4. Obsidian 闭环  |
| (Live Workbench) | (Minutes & LLM)  | (Memory Bank)    | (Hermes / Vault) |
+------------------+------------------+------------------+-----------------+
| - /ws/asr 双工流 | - 多人设纪要生成  | - 会话档案持久化  | - Vault 状态查询  |
| - fun-asr RT     | - 排版润色正式稿  | - 记忆抽取/查询   | - 笔记检索与读取  |
| - qwen-flash 快修| - 记忆演化/快洞察 | - 关联记忆对账    | - 反向追记写入    |
| - 声波可视化     | - 9 种认知人设    | - 5 维记忆资产    | - Hermes 问答     |
+------------------+------------------+------------------+-----------------+
                     |                                    |
              data/sessions.json                 Obsidian Agent (127.0.0.1:8000)
              data/memories.json                (运行时生成，不入库)
```

---

## 核心能力

1. **两层实时语音流**：`server.js` 建立 `/ws/asr` WebSocket，上行转发至 `wss://dashscope.aliyuncs.com/api-ws/v1/inference/`（`fun-asr-realtime`）；句级结果异步交给 `qwen-flash` 原地快修错别字与口语语气词，并带网络熔断降级（超时保留 ASR 原文）。
2. **LLM 纪要工坊**：`/api/llm/personas` 提供认知人设，`/api/llm/generate-minutes` 生成结构化纪要与决策对账，`/api/llm/evolve` 做记忆演化，`/api/llm/fast-insight` 出速览，`/api/llm/polish` 排版润色正式稿，`/api/asr/cleanse` 单独调用快修。
3. **长期记忆库**：`/api/memory/all|add|extract|query|correlate` 负责记忆资产的沉淀、检索与关联；会话档案走 `/api/sessions` CRUD。数据由 `storage.js` 落盘为本地 JSON。
4. **Obsidian / Hermes 反向追记**：`obsidian-sync.js` 提供 `/api/obsidian/status|sync|ask|append|search|note|list`，把 AI 结论写回 Vault，并支持多跳问答。
5. **Web / PWA 客户端**：`public/index.html` + `app.js` + `style.css` + `tp-ui.*` + `icons.js` + `site.webmanifest`，含完整 favicon 与 TP 品牌资产；无打包步骤，改完刷新即可。

### 主要 HTTP 接口

| 分组 | 路径 |
| --- | --- |
| 状态 | `GET /health`、`GET /api/status` |
| 会话 | `GET/POST /api/sessions`、`GET/DELETE /api/sessions/:id` |
| 记忆 | `GET /api/memory/all`、`POST /api/memory/add|extract|query|correlate`、`DELETE /api/memory/:id` |
| LLM | `GET /api/llm/personas`、`POST /api/llm/generate-minutes|evolve|fast-insight|polish`、`POST /api/asr/cleanse` |
| 知识库 | `GET /api/obsidian/status|search|note|list`、`POST /api/obsidian/sync|ask|append` |
| 实时流 | `WS /ws/asr` |
| 客户端凭据 | `ALL /auth/token`、`/token` ⚠️ 见下方安全须知 |

---

## 目录结构

```
voice-brain-web/
├── server.js            # Express + WebSocket 服务，全部 API 与 LLM/ASR 编排
├── storage.js           # sessions.json / memories.json 本地持久化
├── obsidian-sync.js     # Vault 与 Hermes Agent 同步、反向追记
├── app.js               # 根目录前端副本（早期单文件版本）
├── index.html           # 根目录前端副本（早期单文件版本）
├── public/              # 实际对外服务的静态目录（express.static 指向此处）
│   ├── index.html / app.js / style.css / audio-recorder.js
│   ├── tp-ui.* / tp-theme.js / tp-icons.svg / icons.js / tailwind.js
│   ├── site.webmanifest / favicon.* / icon-*.png / apple-touch-icon*.png
│   └── assets/          # TP 品牌 VI 全套 logo 与 web 图标
├── package.json
├── .env.example         # 环境变量模板（真实 .env 不入库）
└── .gitignore
```

> 说明：根目录的 `index.html` / `app.js` 与 `public/` 下同名文件是同源副本，`express.static` 只服务 `public/`；根目录两份的确切用途 **待确认**，先原样保留以便对照。

---

## 本地启动

```bash
git clone https://github.com/TPGoFighting/voice-brain-web.git
cd voice-brain-web
npm install
cp .env.example .env      # 填入 DASHSCOPE_API_KEY 与 DEEPSEEK_API_KEY
npm start                 # Linux 默认 8120，其他平台默认 3000
```

打开 `http://localhost:8120`，授权麦克风后即可开始录音。健康探针：`curl -s http://localhost:8120/health`。

## 生产部署（当前线上形态）

| 层 | 配置 |
| --- | --- |
| 进程 | PM2 `voice-bean` → `node server.js`，工作目录 `/var/www/voice-bean` |
| 端口 | `8120`（`PORT` 可覆盖） |
| Nginx | `voice.tpgofighting.top` 站点配置，80 跳 443；`/` 与 `/ws/asr` 均反代 `127.0.0.1:8120` |
| WebSocket | 需 `Upgrade` / `Connection: upgrade`、`proxy_buffering off`、`proxy_read_timeout 3600s` |
| 上传限制 | `client_max_body_size 50M` |
| 数据 | `data/sessions.json`、`data/memories.json` 运行时生成，需单独备份 |

## 环境变量

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `PORT` | 监听端口 | Linux `8120` / 其他 `3000` |
| `DASHSCOPE_API_KEY` | 实时 ASR 与 qwen-flash 快修 | 必填 |
| `DEEPSEEK_API_KEY` | 纪要、记忆与问答 | 必填 |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-flash` |
| `VAULT_PATH` | Obsidian Vault 路径 | 探测 `/home/ubuntu/obsidian-vault`，否则 `data/vault-mirror` |
| `OBSIDIAN_AGENT_URL` | Hermes / Obsidian Agent 地址 | `http://127.0.0.1:8000` |
| `ADMIN_API_KEY` | Obsidian Agent 管理口令 | 空（必须通过环境变量注入） |

---

## ⚠️ 安全须知

- **`/auth/token` 与 `/token` 目前无鉴权，会直接把 `DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` 返回给调用方**（客户端直连 ASR 所需）。公网部署时务必在网关层加访问控制、IP 白名单或改造为服务端代理，避免密钥被任意取用。此项为本仓库既有的架构风险，**待修复**。
- 本仓库 **不含** 任何真实密钥、录音会话数据、记忆数据或 Android APK：`.env`、`data/*.json`、`*.apk`、`node_modules` 均已由 `.gitignore` 排除。
- 源码内不内置任何默认口令，`ADMIN_API_KEY` 只从环境变量读取。

---

## 归档说明

本仓库是 2026-11-05 从线上 `/var/www/voice-bean` 整理的**脱敏快照**：仅剔除私密文件并补上仓库文档，线上服务与服务器原有代码未做任何改动。姊妹仓库：[voice-brain-android](https://github.com/TPGoFighting/voice-brain-android)。
