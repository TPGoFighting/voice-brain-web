# TP Voice Brain Web

> **Voice Brain 的服务端与 Web / PWA 客户端**，部署于 <https://voice.tpgofighting.top>。
> 与姊妹仓库 [TPGoFighting/voice-brain-android](https://github.com/TPGoFighting/voice-brain-android)（Kotlin 2.0 + Jetpack Compose 原生客户端）共同构成「个人长期语音副驾与第二大脑」的双端体系。

基于 **Node.js 22 + Express 5 + ws + dotenv** 构建：浏览器采集 16k PCM 音频，经 WebSocket 中继到 DashScope `fun-asr-realtime` 做流式识别，再由 `qwen-flash` 句级快修、DeepSeek 生成结构化纪要与长期记忆，最后可反向写回 Obsidian Vault / Hermes 知识库。前端是零构建的单页 PWA（本地化 Tailwind 引擎 + TP Brand VI v2.4 新野兽派组件库）。

---

## 📖 项目简介

### 🎯 愿景与定位
**TP Voice Brain** 是一套面向深度思考者、系统架构师与个人开发者的**个人长期语音副驾与第二大脑**系统。

在日常灵感迸发、长会谈讨论、技术方案评审或个人随想场景中，传统的「录音机」或「手机语音备忘录」常常变成**声音的死胡同**：
- **存得越多，找得越难**：只有长达数十分钟的声音流水账，缺乏快速复盘的结构化抓手；
- **口语杂乱与同音错字**：原始语音转写充斥口癖语气词、同音错别字与零碎语块，直接阅读心智负担极大；
- **单一视角无法深入本质**：单调的流水账摘要无法从架构、产品、商业、风险等多维度深入剖析会谈精髓；
- **与个人长期知识网络割裂**：录制完散落各处，无法持续演化为个人长效记忆资产，更无法与已有的个人知识库（如 Obsidian 双链笔记、Hermes 向量检索库）形成闭环共振。

**Voice Brain 致力于彻底打通从「声音震动」到「知识资产沉淀」的完整闭环**：
浏览器实时捕获高保真音频 $\rightarrow$ 毫秒级双工流式转写 $\rightarrow$ 大模型句级原地自愈快修 $\rightarrow$ 10 大认知人设多视角深度纪要 $\rightarrow$ 5 维记忆资产沉淀 $\rightarrow$ Obsidian 本地双链知识库反向追记与跨笔记 RAG 智能问答。

---

### ✨ 核心四大支柱

1. **🎙️ 极速流式声学工作台 (Live Acoustic Workbench)**
   - **高保真声音采集**：支持直接通过浏览器或外接 DJI Mic 等专业麦克风，以 16kHz PCM 单声道低延迟推流；
   - **双工 WebSocket 中继**：服务端建立 `/ws/asr` 双工中继通道直连 DashScope `fun-asr-realtime`，百毫秒级实时流式出字；
   - **句级异步自愈快修**：分句后由 `qwen-flash` 异步原地去除口语语气词、校正同音错字与标点优化，自带网络超时熔断降级（保底显示原始转写），兼顾超快响应与整洁排版。

2. **🧠 10 大认知人设与多视角纪要工坊 (Cognitive Personas & Insights)**
   - **多视角深度透视**：内置 10 种认知人设（技术极客、系统架构师、严苛审计、产品策划、商业决策者等），多维度剖析会谈切面；
   - **结构化深度纪要**：一键生成 **30 秒核心速览 (TL;DR)**、**关键决策对账清单**、**明确待办动作**与**关联实体网络**；
   - **正式草稿排版润色**：利用大模型将零碎的口语流水账，深度重构润色为逻辑严密、措辞得体的正式汇报邮件或草稿。

3. **🧬 第二大脑与长效记忆资产库 (Long-term Memory Bank)**
   - **5 维记忆资产提取**：自动或手动提炼「核心事实、技术决策、待办承诺、人物画像偏好、认知洞察」；
   - **跨会话记忆演化与对账**：建立长效时间线，支持跨多场录音做记忆关联对账，让 AI 真正“记住”你的历史背景与习惯偏好；
   - **第二大脑沉浸对话**：提供自然语言交互问答，随时唤醒沉淀的历史记忆与决策上下文。

4. **📚 Obsidian / Hermes 双链知识库回流 (Vault Bi-directional Loop)**
   - **无缝回流 Obsidian**：深度集成拥有数千篇笔记的本地 Obsidian Vault，一键将结构化纪要与记忆卡片反向追记为标准 Markdown；
   - **双向链接与元数据**：自动生成 `[[Note]]` 双向链接、分类标签与 Frontmatter 元数据，融入个人知识图谱；
   - **全库多跳 RAG 问答**：结合 Hermes Agent 与本地知识库向量/全文索引，支持结合当前录音与全库知识的多跳深度探查与带来源引用的智能解答。

---

### 🛠️ 设计哲学与技术亮点

- **零构建极简部署**：纯原生单页 Web / PWA，基于本地化 Tailwind 引擎驱动，无需任何打包构建步骤，修改代码刷新即见；
- **新野兽派工业美学**：严格贯彻 TP Brand VI v2.4 规范，工程图纸网纹背景、高对比度微阴影卡片与紧凑高效的信息排版；
- **双端协同体系**：Web / PWA 提供跨设备桌面端与移动端覆盖，配合姊妹仓库 [voice-brain-android](https://github.com/TPGoFighting/voice-brain-android) 原生客户端，满足随身息屏录制与桌面深度处理；
- **端到端安全与隐私保障**：第三方 API Key 严格驻留服务端环境变量或本地排除目录，不在前端泄露明文；全站 API 支持可选 Bearer Token 鉴权保护；
- **模型自由插拔与热切换**：内置 DeepSeek 官方接口，同时运行时支持配置任意兼容 OpenAI 规范的第三方 Base URL 与自定义模型，并可在线刷新模型列表与一键连通性测试。

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
| - 声波可视化     | - 10 种认知人设    | - 5 维记忆资产    | - Hermes 问答     |
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
| 模型配置 | `GET/POST /api/llm/config`、`DELETE /api/llm/config/custom`、`GET /api/llm/models`、`POST /api/llm/test` |
| 知识库 | `GET /api/obsidian/status|search|note|list`、`POST /api/obsidian/sync|ask|append` |
| 实时流 | `WS /ws/asr` |
| 鉴权 | 设置 `API_AUTH_TOKEN` 后所有 `/api/*` 需携带 `Authorization: Bearer <token>`，见下方安全须知 |

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
| `LLM_PROVIDER` | 默认服务商：`deepseek` 或 `custom` | `deepseek` |
| `LLM_BASE_URL` | 默认 OpenAI 兼容 Base URL | `https://api.deepseek.com` |
| `VAULT_PATH` | Obsidian Vault 路径 | 探测 `/home/ubuntu/obsidian-vault`，否则 `data/vault-mirror` |
| `OBSIDIAN_AGENT_URL` | Hermes / Obsidian Agent 地址 | `http://127.0.0.1:8000` |
| `ADMIN_API_KEY` | Obsidian Agent 管理口令 | 空（必须通过环境变量注入） |

---

## ⚠️ 安全须知

- API 密钥仅存在于服务端环境变量，不再通过任何 HTTP 端点下发；ASR 转写经由服务端 WebSocket 中继完成。
- 页面「模型设置」支持在运行时填写自定义 API Key、Base URL，并从 `/models` 或手动输入选择模型；配置保存在 `data/llm-config.json`，该文件由 `.gitignore` 排除。前端仅能看到密钥是否配置，无法读取密钥明文。
- 自定义接口需兼容 OpenAI Chat Completions 协议：`<Base URL>/chat/completions`；若提供 `<Base URL>/models` 或 `<Base URL>/v1/models`，可一键刷新模型列表。
- 所有 `/api/*` 端点支持可选鉴权：设置 `API_AUTH_TOKEN` 环境变量后，请求必须携带 `Authorization: Bearer <API_AUTH_TOKEN>`；未设置时保持本地开放访问。公网部署时建议务必设置该令牌。
- 本仓库 **不含** 任何真实密钥、录音会话数据、记忆数据或 Android APK：`.env`、`data/*.json`、`*.apk`、`node_modules` 均已由 `.gitignore` 排除。
- 源码内不内置任何默认口令，`ADMIN_API_KEY` 只从环境变量读取。

---

## 归档说明

本仓库是 2026-11-05 从线上 `/var/www/voice-bean` 整理的**脱敏快照**：仅剔除私密文件并补上仓库文档，线上服务与服务器原有代码未做任何改动。姊妹仓库：[voice-brain-android](https://github.com/TPGoFighting/voice-brain-android)。

## 2026-11-06 升级记录（三项修复 + 三期产品升级，前端 v3.9.0）

**准确性修复（Fix 1–3）**
- ASR 配置与热词：language_hints 扩为 zh/en、断句阈值 800→1200ms、45 词热词表（voicebean 前缀）接入 paraformer-realtime-v2；DashScope / DeepSeek 密钥轮换。
- 清洗降级为「只补标点」：白名单规则 + LCS 相似度护栏（<0.85 拒绝）、短句跳过；`text/rawText` 恒存 ASR 原文，清洗稿只进 `displayText`，前端默认展示原文。
- 问答强 grounding：新增逐字稿原文片段检索注入上下文，关键结论必须逐字引用，无依据明确答「没提到」；温度 0.3；假 steps/sources 改为真实命中片段。

**一期 · 体验**：问答 SSE 真流式（`POST /api/memory/query/stream`，首字约 2s）+ 来源 chip 点击定位原文句；录音波形改真实频谱（AnalyserNode 旁路）；重采样改区间均值抗混叠；骨架屏与 toast 反馈。

**二期 · 性能与结构**：Tailwind 运行时（407KB）换静态构建（`build/` + `tailwind-static.css` 26.6KB，含 color-mix compat）；`public/app.js` 源码拆为 `src/01–11` 模块 + `build_app.sh` 拼接（产物逐字节一致）；PWA Service Worker（`public/sw.js`）：外壳离线缓存、只读接口离线回落、写接口 IndexedDB 队列联网重放。

**三期 · 智能**：全文检索 `GET /api/search`（逐字稿+记忆，归档页 UI）；纪要四模板（通用/会议/课程/访谈，`MINUTES_TEMPLATES` 注入 prompt，结果回写 template 字段）；说话人分离（离线精转写 paraformer-v2 + diarization：`/api/asr/diarize/upload|start|status`，前端单调对齐回填 speaker + 彩色标记）。

已通过端到端验证：双人中文合成会议全旅程（WS 录音→纪要→问答→检索→分离）与原有接口回归。
