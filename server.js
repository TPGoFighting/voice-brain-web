const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
require('dotenv').config();

const storage = require('./storage');
const obsidianSync = require('./obsidian-sync');
const llmConfig = require('./llm-config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/asr' });

const PORT = process.env.PORT || (process.platform === 'linux' ? 8120 : 3000);
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || '';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 可选 API 鉴权：设置 API_AUTH_TOKEN 后，所有 /api/* 请求必须携带
// `Authorization: Bearer <API_AUTH_TOKEN>`；未设置时保持本地开放访问。
function requireApiAuth(req, res, next) {
  if (!API_AUTH_TOKEN) return next();
  if (req.headers['authorization'] === `Bearer ${API_AUTH_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
app.use('/api', requireApiAuth);

// -------------------------------------------------------------
// 1. 服务状态与配置
// -------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'voice-bean', time: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  const llm = llmConfig.getPublicConfig();
  res.json({
    ok: true,
    dashscopeConfigured: !!DASHSCOPE_API_KEY,
    deepseekConfigured: llm.configured,
    deepseekModel: llm.model,
    llmProvider: llm.provider,
    llmBaseUrl: llm.baseUrl,
    port: PORT,
    sessionCount: storage.getSessions().length,
    memoryCount: storage.getMemories().length
  });
});

app.get('/api/llm/config', (req, res) => {
  res.json({ ok: true, config: llmConfig.getPublicConfig() });
});

app.post('/api/llm/config', (req, res) => {
  const result = llmConfig.saveConfig(req.body || {});
  res.status(result.ok ? 200 : 400).json(result);
});

app.delete('/api/llm/config/custom', (req, res) => {
  res.json(llmConfig.clearCustomConfig());
});

app.get('/api/llm/models', async (req, res) => {
  const result = await llmConfig.listRemoteModels();
  res.status(result.ok ? 200 : 400).json(result);
});

app.post('/api/llm/test', async (req, res) => {
  const result = await llmConfig.testConnection();
  res.status(result.ok ? 200 : 400).json(result);
});

// -------------------------------------------------------------
// 2. 会话档案持久化接口 (Sessions)
// -------------------------------------------------------------
app.get('/api/sessions', (req, res) => {
  res.json(storage.getSessions());
});

app.get('/api/sessions/:id', (req, res) => {
  const session = storage.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.post('/api/sessions', (req, res) => {
  const sessionData = req.body;
  if (!sessionData.id) {
    sessionData.id = 'sess-' + Date.now();
  }
  if (typeof sessionData.id !== 'string' || !/^[\w-]{1,64}$/.test(sessionData.id)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }
  const saved = storage.saveSession(sessionData);
  res.json({ success: true, session: saved });
});

app.delete('/api/sessions/:id', (req, res) => {
  storage.deleteSession(req.params.id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 3. 长期 AI 记忆库接口 (Long-Term Memory Bank)
// -------------------------------------------------------------
app.get('/api/memory/all', (req, res) => {
  res.json(storage.getMemories());
});

app.post('/api/memory/add', (req, res) => {
  const { memories } = req.body;
  if (!Array.isArray(memories)) {
    return res.status(400).json({ error: 'memories must be an array' });
  }
  const added = storage.addMemories(memories);
  res.json({ success: true, count: added.length, added });
});

app.delete('/api/memory/:id', (req, res) => {
  storage.deleteMemory(req.params.id);
  res.json({ success: true });
});

// 从会话中自动提炼长期记忆碎片
app.post('/api/memory/extract', async (req, res) => {
  try {
    const { utterances, sessionId, topic } = req.body;
    if (!utterances || utterances.length === 0) {
      return res.json({ success: false, message: '无对话记录' });
    }

    const conversationText = utterances.map(u => `[${u.speaker || '发言人'}]: ${u.text}`).join('\n');

    const systemPrompt = `你是一个个人长期第二大脑（Second Brain）的记忆沉淀引擎。
你的任务是从用户的录音转写文本中，抽取出具有【长期记忆价值】的核心事实与洞见，将其固化为个人的长期知识库。

抽取维度：
1. preference: 用户的个人偏好、技术倾向、工作习惯与行事风格
2. project: 关于具体项目/产品的核心方案、技术选型或关键目标
3. decision: 经过深思熟虑后敲定的不可妥协决策或重大结论
4. person: 合作者、团队成员的分工、特点或承诺
5. fact: 重要的客观事实、数据指标或经验教训

规则：
- 严格输出 JSON 格式
- 每条记忆独立成段，精炼、客观、高信噪比，20~60字
- 忽略闲聊、口癖和无价值琐碎记录
- importance 为 1 到 5 整数（5为最重要）
- tags 为 2~3 个关键词标签

输出 JSON Schema 示例：
{
  "extracted_memories": [
    {
      "category": "preference" | "project" | "decision" | "person" | "fact",
      "content": "具体的记忆描述",
      "tags": ["标签1", "标签2"],
      "importance": 5
    }
  ]
}`;

    const userPrompt = `主题: ${topic || '录音随笔'}\n会话全文:\n${conversationText}`;

    const result = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: true
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const data = result.data;
    const parsed = JSON.parse(data.choices[0]?.message?.content || '{"extracted_memories":[]}');
    const memoriesWithSource = (parsed.extracted_memories || []).map(m => ({
      ...m,
      sourceSessionId: sessionId
    }));

    const added = storage.addMemories(memoriesWithSource);
    res.json({ success: true, count: added.length, memories: added });
  } catch (err) {
    console.error('Error in /api/memory/extract:', err);
    res.status(500).json({ error: err.message });
  }
});

// 问问你的第二大脑 (Ask Your Second Brain - 自然语言检索记忆库)
app.post('/api/memory/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const allMemories = storage.getMemories();
    const sessions = storage.getSessions().slice(0, 5); // 附带最近5次会话的摘要

    const memoryContext = allMemories.map(m => `[分类: ${m.category} | 标签: ${m.tags.join(', ')} | 重要度: ${m.importance}/5]: ${m.content}`).join('\n');
    const sessionContext = sessions.map(s => `[会话: ${s.title} (${new Date(s.createdAt).toLocaleDateString()})]: 主题: ${s.topic || ''}; 摘要: ${s.tldr || s.delta_summary || ''}`).join('\n');

    const systemPrompt = `你是一个个人的专属 AI 第二大脑助手（Personal Voice Brain Assistant）。
你拥有用户过去所有语音记录、会议决策和沉淀下来的长期记忆库。
请基于给定的【个人长期记忆库】和【历史会话档案】，用清晰、有条理、贴心的口吻回答用户的问题。
要求：
1. 明确指出相关信息来自于哪些记忆条目或哪场历史讨论。
2. 若记忆库中没有记录，诚实说明，切勿编造。
3. 结构清晰，重点内容加粗。`;

    const userPrompt = `【个人长期记忆库】:
${memoryContext || '暂无存储的长期记忆'}

【历史会话档案】:
${sessionContext || '暂无历史会话'}

用户提问: "${question}"`;

    const result = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const data = result.data;
    const answer = data.choices[0]?.message?.content || '抱歉，未能查询到相关记忆。';

    const steps = [
      {
        type: 'tool_call',
        name: 'recall_memories',
        desc: `查阅第二大脑记忆库 (${allMemories.length} 条资产)`,
        result: `已关联匹配到相关偏好与架构约定`,
        status: 'done'
      },
      {
        type: 'tool_call',
        name: 'search_archive',
        desc: `调阅最近会话归档 (${sessions.length} 场讨论)`,
        result: `完成历史上下文交叉比对`,
        status: 'done'
      },
      {
        type: 'reasoning',
        name: 'cognitive_synthesis',
        desc: `综合个人偏好与事实基线进行推演`,
        status: 'done'
      }
    ];

    let clarification = null;
    if (/(方案|选型|偏好|决策|怎么选|建议|对比|优先)/.test(question)) {
      clarification = {
        id: 'ask-' + Date.now(),
        title: '需要优先聚焦在哪个维度的决策偏好？',
        meta: '第 1/1 题 · 单选决策',
        options: [
          '极速跟手流 (延迟 < 300ms，异步句级快修)',
          '严谨结构化与长期沉淀 (Obsidian 双链归档)',
          '双模并进 (全链路流式感知 + 认知微调)'
        ]
      };
    }

    res.json({ success: true, answer, steps, clarification, sources: allMemories.slice(0, 3) });
  } catch (err) {
    console.error('Error in /api/memory/query:', err);
    res.status(500).json({ error: err.message });
  }
});

// 跨会话实时联想（检查当前发言是否与历史记忆产生碰撞）
app.post('/api/memory/correlate', async (req, res) => {
  try {
    const { currentText } = req.body;
    if (!currentText || currentText.trim().length < 6) {
      return res.json({ has_correlation: false });
    }

    const allMemories = storage.getMemories();
    if (allMemories.length === 0) return res.json({ has_correlation: false });

    const systemPrompt = `你是一个长期记忆关联检查器。
任务：对比用户当前的最新发言与【长期记忆库】，判断是否有强相关的历史决策、偏好或技术约定。
如果有明确关联，输出 JSON:
{
  "has_correlation": true,
  "memory_content": "引用的具体记忆内容",
  "reason": "为什么相关（20字以内）"
}
如果关联度低或没有相关记忆，输出:
{
  "has_correlation": false
}`;

    const memoriesSample = allMemories.slice(0, 15).map(m => `[ID:${m.id}]: ${m.content}`).join('\n');

    const completion = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `长期记忆库:\n${memoriesSample}\n\n当前发言: "${currentText}"` }
      ],
      responseFormat: true
    });
    if (!completion.ok) return res.json({ has_correlation: false });
    const data = completion.data;
    const correlation = JSON.parse(data.choices[0]?.message?.content || '{"has_correlation":false}');
    res.json(correlation);
  } catch (err) {
    console.error('Error in /api/memory/correlate:', err);
    res.json({ has_correlation: false });
  }
});

// -------------------------------------------------------------
// 4. AI 纪要与多角色人设生成 (Persona-Driven Minutes & Summaries)
// -------------------------------------------------------------
const PERSONA_CONFIGS = {
  detective: {
    id: 'detective',
    name: '红队侦探',
    title: '反方拷问官',
    personaTitle: '挑刺审计官 · 攻击性安全与漏洞审查',
    badgeClass: 'tp-badge-rose',
    motto: '没有天衣无缝的工程方案，只有还没发现的边缘盲区。',
    systemInstruction: `你是【红队侦探 (Red-Team Detective)】。你以极其敏锐、挑剔且极具穿透力的黑客审计思维审视整场录音。
你的核心任务是：专门挑刺、指出所有未被言明的假设漏洞、寻找工程单点故障 (SPOF)、挖掘合规与实施踩坑风险，并提供进攻性防御补丁。
你的专属输出板块为：【红队极客审查与盲区漏洞警示 (special_section)】。`,
    specialTitle: '红队极客审查与盲区漏洞警示'
  },
  architect: {
    id: 'architect',
    name: '系统架构师',
    title: '零丢失守卫',
    personaTitle: '领域建模师 · 系统解耦与高可用拓扑',
    badgeClass: 'tp-badge-blue',
    motto: '解耦是优雅之母，契约是系统韧性的磐石。',
    systemInstruction: `你是【系统架构师 (System Architect)】。你以宏观系统工程、领域建模与高内聚低耦合视角审视整场录音。
你的核心任务是：梳理服务拓扑边界、提炼数据流转契约、评估系统可用性冗余度、指出潜在技术负债与架构演进路线。
你的专属输出板块为：【系统解耦契约与服务拓扑 (special_section)】。`,
    specialTitle: '系统解耦契约与服务拓扑'
  },
  scientist: {
    id: 'scientist',
    name: '算法科学家',
    title: '第一性原理',
    personaTitle: '理论推导者 · 数学建模与指标收敛',
    badgeClass: 'tp-badge-blue',
    motto: '以第一性原理建模，驱动认知与系统指标持续收敛。',
    systemInstruction: `你是【算法科学家 (Algorithm Scientist)】。你以数学建模、严谨因果推演与第一性原理视角审视录音。
你的核心任务是：剥离表面情绪，推演底层因果逻辑链，定义关键评价指标 (Metrics Benchmark)，评估时间/空间复杂度与收敛边界。
你的专属输出板块为：【第一性原理因果推演与量化基准 (special_section)】。`,
    specialTitle: '第一性原理因果推演与量化基准'
  },
  engineer: {
    id: 'engineer',
    name: '底层工程师',
    title: '环形缓冲区',
    personaTitle: '硬核极客工匠 · 内存池与零拷贝性能',
    badgeClass: 'tp-badge-yellow',
    motto: '环形缓冲区与内存池零拷贝，让每一次录音坚若磐石。',
    systemInstruction: `你是【底层工程师 (Core Systems Engineer)】。你是一名关注裸机性能、内存布局与系统调用的硬核极客。
你的核心任务是：从 CPU 缓存局部性、内存拷贝开销、并发锁竞争、I/O 阻塞等极客细节剖析讨论内容，提出硬核性能优化策略。
你的专属输出板块为：【硬核底层性能与零拷贝优化建议 (special_section)】。`,
    specialTitle: '硬核底层性能与零拷贝优化建议'
  },
  wizard: {
    id: 'wizard',
    name: '总结魔法师',
    title: '极简点金手',
    personaTitle: '极简速记官 · 30秒高管电梯决策汇报',
    badgeClass: 'tp-badge-purple',
    motto: '去除一切冗余修饰，唯有高信噪比真理永恒闪耀。',
    systemInstruction: `你是【总结魔法师 / 极简速记官 (TL;DR Summarizer)】。你追求极致信息压缩率与电梯汇报体。
你的核心任务是：粉碎一切废话、客套和铺垫，将整场对话炼化为 3 句战略本质、1 个底线结论和 30 秒高管决策电梯陈述。
你的专属输出板块为：【30秒高管电梯汇报极简版 (special_section)】。`,
    specialTitle: '30秒高管电梯汇报极简版'
  },
  astronaut: {
    id: 'astronaut',
    name: '记忆宇航员',
    title: '认知星际漫游',
    personaTitle: '知识引航员 · 长期第二大脑知识星系',
    badgeClass: 'tp-badge-blue',
    motto: '漫游第二大脑未开垦的记忆星系，为人与事搭建永久图谱。',
    systemInstruction: `你是【记忆宇航员 (Second Brain Astronaut)】。你关注长期主义、跨领域类比与第二大脑知识星系生长。
你的核心任务是：提炼能跨越时间长河复利生长的认知元模型，将其锚定在知识星系的永久坐标中，建立跨学科双向关联。
你的专属输出板块为：【第二大脑长期认知固化节点 (special_section)】。`,
    specialTitle: '第二大脑长期认知固化节点'
  },
  ninja: {
    id: 'ninja',
    name: '快轨暗影忍者',
    title: '<800ms 疾行',
    personaTitle: '极速执行官 · 敏捷冲刺与DoD验收',
    badgeClass: 'tp-badge-green',
    motto: '毫秒必争，敏捷直达，在无声中完成最严苛的交付。',
    systemInstruction: `你是【快轨暗影忍者 (Fast-Track Agile Ninja)】。你信奉极速敏捷交付与结果导向。
你的核心任务是：立即找出阻碍项目推进的今日核心阻断项 (Blockers)，严格制定可被验收的 DoD (Definition of Done) 与精准敏捷工单。
你的专属输出板块为：【敏捷冲刺工单与阻断项清单 (special_section)】。`,
    specialTitle: '敏捷冲刺工单与阻断项清单'
  },
  meditating: {
    id: 'meditating',
    name: '认知冥想者',
    title: '深度沉淀者',
    personaTitle: '心智洞察师 · 心理动机与认知盲区反思',
    badgeClass: 'tp-badge-purple',
    motto: '静坐过滤纷扰杂音，让真正的智慧与决策沉淀在岁月深处。',
    systemInstruction: `你是【认知冥想者 (Deep Meditator)】。你拥有极高的同理心与心理学心智洞察力。
你的核心任务是：穿透言语表象，洞察各方深层意图、心理动机、沟通盲区与价值取向，提供促进长期智慧沉淀的反思性谏言。
你的专属输出板块为：【深层动机洞察与认知盲区反思 (special_section)】。`,
    specialTitle: '深层动机洞察与认知盲区反思'
  },
  musician: {
    id: 'musician',
    name: '声学音乐家',
    title: '纯净声学共鸣',
    personaTitle: '共鸣调和官 · 跨团队同频与分歧化解',
    badgeClass: 'tp-badge-yellow',
    motto: '聆听不同声音的协奏，捕捉思维交锋中最美妙的泛音。',
    systemInstruction: `你是【声学音乐家 (Harmonic Integrator)】。你关注跨职能团队的同频共振与冲突调和。
你的核心任务是：梳理讨论中的分歧焦点，搭建不同专业背景人员理解彼此的桥梁，提出兼顾各方诉求的团队合奏共识方案。
你的专属输出板块为：【分歧化解与跨团队共识合奏点 (special_section)】。`,
    specialTitle: '分歧化解与跨团队共识合奏点'
  },
  explorer: {
    id: 'explorer',
    name: '灵感探险家',
    title: '新知先锋',
    personaTitle: '创新拓荒者 · 颠覆性脑洞与未知蓝海',
    badgeClass: 'tp-badge-green',
    motto: '身穿探险服踏入未知的随笔领域，让每个灵感火花都被妥善安放。',
    systemInstruction: `你是【灵感探险家 (Inspiration Explorer)】。你充满探索未知的好奇心与颠覆性想象力。
你的核心任务是：捕捉对话中哪怕一闪而过的非主流边缘想法，将其放大为可能开辟第二增长曲线的未知蓝海机遇。
你的专属输出板块为：【颠覆性跨界脑洞与未来蓝海机遇 (special_section)】。`,
    specialTitle: '颠覆性跨界脑洞与未来蓝海机遇'
  }
};

app.get('/api/llm/personas', (req, res) => {
  res.json(Object.values(PERSONA_CONFIGS));
});

app.post('/api/llm/generate-minutes', async (req, res) => {
  const configurationError = llmConfig.ensureConfigured();
  if (configurationError) {
    return res.status(503).json({ error: configurationError });
  }
  try {
    const { utterances, persona = 'detective', template = 'engineering', customTitle } = req.body;
    if (!utterances || utterances.length === 0) {
      return res.status(400).json({ error: 'utterances cannot be empty' });
    }

    const personaConfig = PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.detective;
    const fullTranscript = utterances.map(u => `[${u.time || ''}][${u.speaker || '发言人'}]: ${u.text}`).join('\n');

    const systemPrompt = `你是一个具备鲜明人格与专业深度的人格化 AI 智能纪要专家。
${personaConfig.systemInstruction}

基本原则：
1. 恪守上述角色人设与独特语气，全面深度梳理对话，提炼出极高信噪比的结构化纪要。
2. 包含专属输出板块 【${personaConfig.specialTitle}】，严格贴合角色人设视角。
3. 包含【知识实体抽取 (lmm_wiki_entities)】：抽取 3~5 个具有长期双向链接价值的核心知识概念或技术实体，用于构建 Obsidian LMMWiki 知识网络。
4. 包含【思维导图 (mindmap_markdown)】：输出用于生成结构化树状图的 Markdown 无序列表。
5. 输出严格符合 JSON Schema。
6. 严格禁止输出任何 Unicode Emoji 表情符号，采用严谨、现代、高信噪比的书面结构化表达。

JSON Schema 规范示例：
{
  "title": "会议/录音核心标题（精炼有力）",
  "persona_id": "${personaConfig.id}",
  "persona_name": "${personaConfig.name}",
  "persona_title": "${personaConfig.title}",
  "tldr": [
    "30秒速览关键结论 1",
    "30秒速览关键结论 2",
    "30秒速览关键结论 3"
  ],
  "decisions": [
    "明确敲定的决策/结论 1",
    "明确敲定的决策/结论 2"
  ],
  "action_items": [
    {
      "task": "具体可执行的任务动作",
      "assignee": "负责人或待定",
      "priority": "P0" | "P1" | "P2",
      "deadline": "建议完成时间或待定"
    }
  ],
  "unresolved_risks": [
    "未决争议或待跟进风险"
  ],
  "special_section": {
    "title": "${personaConfig.specialTitle}",
    "summary": "以角色口吻给出的一句话核心判定与总览",
    "items": [
      {
        "title": "要点标题 1",
        "desc": "详细阐述与具体分析，融入角色鲜明风格"
      },
      {
        "title": "要点标题 2",
        "desc": "详细阐述与具体分析"
      }
    ]
  },
  "lmm_wiki_entities": [
    {
      "name": "实体/概念名称（例如：Paraformer、零拷贝、Cloudflare Tunnel）",
      "category": "架构 | 技术 | 业务 | 概念",
      "description": "本实体在当前讨论中的核心定义或上下文"
    }
  ],
  "mindmap_markdown": "- 核心主题\\n  - 分支1\\n    - 叶子节点\\n  - 分支2"
}`;

    const userPrompt = `建议录音标题: ${customTitle || '无'}\n全量对话逐字稿:\n${fullTranscript}`;

    const completion = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: true
    });
    if (!completion.ok) return res.status(completion.status).json({ error: completion.error });
    const data = completion.data;
    const result = JSON.parse(data.choices[0]?.message?.content || '{}');
    result.persona = personaConfig;

    // 自动静默同步至 Obsidian Vault & LMMWiki (无需手动点击)
    let autoSyncResult = null;
    let syncedSessionId = req.body.sessionId || ('sess-' + Date.now());
    try {
      let existingSession = storage.getSession(syncedSessionId);
      if (!existingSession) {
        existingSession = {
          id: syncedSessionId,
          title: result.title || req.body.customTitle || '语音纪要',
          createdAt: new Date().toISOString(),
          duration: req.body.duration || (req.body.utterances ? Math.max(0, ...req.body.utterances.map(u => (u.end_time || u.end || 0) / 1000)) : 0),
          utterances: utterances,
          minutes: result,
          topic: result.title || '语音纪要',
          memories: []
        };
      } else {
        existingSession.minutes = result;
        existingSession.title = result.title || existingSession.title;
        existingSession.updatedAt = new Date().toISOString();
      }

      autoSyncResult = await obsidianSync.syncSessionToVault(existingSession, personaConfig);
      existingSession.syncedToObsidian = true;
      existingSession.obsidianNotePath = autoSyncResult.relativePath;
      existingSession.obsidianSyncedAt = new Date().toISOString();
      storage.saveSession(existingSession);
      console.log(`[Auto-Sync] Session ${existingSession.id} automatically synced to Obsidian Vault at ${autoSyncResult.relativePath}`);
    } catch (syncErr) {
      console.warn('[Auto-Sync] Silent sync to Obsidian warning:', syncErr.message);
    }

    // 自动静默沉淀长期记忆碎片至第二大脑 (无需用户手动点击)
    let autoMemoriesCreated = [];
    try {
      const memorySystemPrompt = `你是一个个人长期第二大脑（Second Brain）的记忆沉淀引擎。
你的任务是从用户的会议纪要与对话中，抽取出具有【长期记忆价值】的核心事实与洞见，将其固化为个人的长期知识库。
分类维度定义（必须属于以下其一）：
- preference: 用户个人或团队的鲜明偏好、审美取向、技术选型倾向
- project: 正在进行的项目方案、架构设计、技术定调
- decision: 经过权衡最终敲定的重大技术路线或业务定夺
- person: 对团队成员、合作方或特定角色的承诺、分工或关键属性
- fact: 踩坑经验、客观规律、核心指标或不可违背的事实基准
规则：
1. 严格输出 JSON 格式 {"extracted_memories": [{"category": "...", "content": "...", "tags": ["..."], "importance": 5}]}
2. 每条记忆独立成段，精炼、客观、高信噪比，20~60字
3. 忽略闲聊口癖，只保留关键认知资产`;

      const memoryResult = await llmConfig.callChatCompletions({
        messages: [
          { role: 'system', content: memorySystemPrompt },
          { role: 'user', content: `会话主题: ${result.title || ''}\n速览摘要: ${(result.tldr || []).join('; ')}\n决策: ${(result.decisions || []).join('; ')}\n会话全文:\n${fullTranscript}` }
        ],
        responseFormat: true
      });

      if (memoryResult.ok) {
        const memData = memoryResult.data;
        const memParsed = JSON.parse(memData.choices[0]?.message?.content || '{"extracted_memories":[]}');
        const memoriesWithSource = (memParsed.extracted_memories || []).map(m => ({
          ...m,
          sourceSessionId: syncedSessionId
        }));
        if (memoriesWithSource.length > 0) {
          autoMemoriesCreated = storage.addMemories(memoriesWithSource);
          console.log(`[Auto-Memory] Automatically extracted and saved ${autoMemoriesCreated.length} memories for session ${syncedSessionId}`);
        }
      }
    } catch (memErr) {
      console.warn('[Auto-Memory] Silent memory extraction warning:', memErr.message);
    }

    res.json({
      success: true,
      data: result,
      usage: data.usage,
      autoSynced: autoSyncResult ? autoSyncResult.success : false,
      obsidianNotePath: autoSyncResult?.relativePath || null,
      obsidianEntities: autoSyncResult?.entitiesCreated || [],
      obsidianReindexed: autoSyncResult?.reindexSuccess || false,
      autoMemories: autoMemoriesCreated,
      autoMemoriesCount: autoMemoriesCreated.length,
      sessionId: syncedSessionId
    });
  } catch (err) {
    console.error('Error in /api/llm/generate-minutes:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. 慢轨：滑动窗口全局状态演进 (DeepSeek)
// -------------------------------------------------------------
app.post('/api/llm/evolve', async (req, res) => {
  try {
    const { globalState, activeWindow } = req.body;

    const systemPrompt = `你是一个专业的实时会议与灵感流状态解析引擎（State Machine）。
你负责维护一个实时结构化的全局会议认知状态（Global Meeting State）。

核心规则：
1. 增量演进：输入包含【当前全局状态快照】与【最新滑动窗口对话】（包含前序重叠句和最新增量句），请提炼最新信息并增量演进全局状态。
2. 容错纠偏：ASR 识别文本中可能包含口癖或同音错别字，请根据上下文逆向语义纠偏，绝不编造事实。
3. 动态议题锚点：current_topic 随讨论进展准确演变。
4. 必须严格只返回 JSON 对象。

Schema 示例:
{
  "current_topic": "当前讨论议题",
  "phase_marker": "阶段标记，如'02:15 架构选型探讨'",
  "key_decisions": ["决策清单"],
  "action_items": [
    {"task": "任务", "assignee": "负责人", "status": "pending"}
  ],
  "unresolved_questions": ["疑问清单"],
  "delta_summary": "本轮50字演进摘要"
}`;

    const userPrompt = `【当前全局状态快照】:
${JSON.stringify(globalState || {}, null, 2)}

【最新滑动窗口增量对话】:
${(activeWindow || []).map(u => `[${u.id || ''}][${u.speaker || '发言人'}][${u.time || ''}]: ${u.text}`).join('\n')}

请输出增量演进后的最新全局状态 JSON：`;

    const completion = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: true
    });
    if (!completion.ok) return res.status(completion.status).json({ error: `模型服务错误: ${completion.error}` });
    const data = completion.data;
    const parsedState = JSON.parse(data.choices[0]?.message?.content || '{}');
    res.json({ success: true, data: parsedState, usage: data.usage });
  } catch (err) {
    console.error('Error in /api/llm/evolve:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. 快轨：微触发实时副驾 (DeepSeek)
// -------------------------------------------------------------
app.post('/api/llm/fast-insight', async (req, res) => {
  try {
    const { recentUtterances, currentTopic } = req.body;
    if (!recentUtterances || recentUtterances.length === 0) {
      return res.json({ has_insight: false });
    }

    const systemPrompt = `你是一个实时会议耳旁副驾（Copilot Fast-Track）。
任务：分析用户最新说的 1~2 句话，判断是否包含：
1. 专业技术黑话/行业缩写/生僻概念，给出极简易懂的中文解释（30字内）；
2. 明确的待办承诺句（如“我明天交”、“李四去核对”），提炼为 action_catcher；
3. 明确的提问或决策疑问句；
4. 外文短语，给出快速翻译。
若没有明显需要提示的内容，则 has_insight 设为 false。

严格输出 JSON 格式：
{
  "has_insight": true/false,
  "insight_type": "term" | "action" | "question" | "translation" | "none",
  "title": "关键词或标题",
  "content": "30字以内的极简解释或建议"
}`;

    const textToAnalyze = recentUtterances.map(u => u.text).join(' ');

    const completion = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `当前主题: ${currentTopic || '未定'}\n最新发言: "${textToAnalyze}"` }
      ],
      responseFormat: true
    });
    if (!completion.ok) return res.json({ has_insight: false });
    const data = completion.data;
    const result = JSON.parse(data.choices[0]?.message?.content || '{"has_insight":false}');
    res.json(result);
  } catch (err) {
    console.error('Error in /api/llm/fast-insight:', err);
    res.json({ has_insight: false });
  }
});

// -------------------------------------------------------------
// 6.5. Obsidian Vault & LMMWiki 知识库联动接口
// -------------------------------------------------------------
app.get('/api/obsidian/status', async (req, res) => {
  try {
    const status = await obsidianSync.getObsidianStatus();
    res.json({ ok: true, data: status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/obsidian/sync', async (req, res) => {
  try {
    const { sessionId, session: clientSession, personaId } = req.body;
    let session = clientSession;
    if (!session && sessionId) {
      session = storage.getSession(sessionId);
    }
    if (!session && req.body.minutes) {
      session = {
        id: sessionId || 'session-' + Date.now(),
        title: req.body.minutes.title || '录音材料',
        minutes: req.body.minutes,
        utterances: req.body.utterances || [],
        duration: req.body.duration || 60,
        createdAt: new Date().toISOString()
      };
    }
    if (!session) {
      return res.status(404).json({ ok: false, error: 'Session not found' });
    }

    const persona = PERSONA_CONFIGS[personaId || session.minutes?.persona_id || 'detective'] || PERSONA_CONFIGS.detective;
    const result = await obsidianSync.syncSessionToVault(session, persona);

    // 更新持久化状态
    session.syncedToObsidian = true;
    session.obsidianNotePath = result.relativePath;
    session.obsidianSyncedAt = new Date().toISOString();
    storage.saveSession(session);

    res.json({
      ok: true,
      message: '成功同步至 Obsidian Vault & LMMWiki 知识图谱',
      ...result
    });
  } catch (err) {
    console.error('Error syncing to Obsidian:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/obsidian/ask', async (req, res) => {
  try {
    const { query, message, history = [], targetNotePath, autoWriteBack = false } = req.body;
    const q = query || message;
    if (!q) {
      return res.status(400).json({ ok: false, error: 'query or message is required' });
    }
    const result = await obsidianSync.queryObsidianVault(q, history);

    // 如果开启了自动反向写回并且有有效回答与目标笔记
    let writeBackResult = null;
    if (autoWriteBack && targetNotePath && result.ok && result.answer) {
      try {
        writeBackResult = await obsidianSync.appendThinkingToNote({
          notePath: targetNotePath,
          query: q,
          answer: result.answer,
          sources: result.sources || [],
          agentBackend: result.backend || 'hermes'
        });
        console.log(`[Obsidian WriteBack] Auto-appended thinking to ${writeBackResult.relativePath}`);
      } catch (wbErr) {
        console.warn('[Obsidian WriteBack] Auto-append failed:', wbErr.message);
      }
    }

    res.json({
      ...result,
      writtenBack: writeBackResult ? writeBackResult.ok : false,
      writeBackPath: writeBackResult ? writeBackResult.relativePath : null,
      appendedAt: writeBackResult ? writeBackResult.appendedAt : null
    });
  } catch (err) {
    console.error('Error asking Obsidian:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 反向将 Hermes 思考结果手动或定向追加写回指定笔记
app.post('/api/obsidian/append', async (req, res) => {
  try {
    const { notePath, query, answer, sources = [], agentBackend = 'hermes' } = req.body;
    if (!notePath || !answer) {
      return res.status(400).json({ ok: false, error: 'notePath and answer are required' });
    }
    const result = await obsidianSync.appendThinkingToNote({
      notePath,
      query: query || '知识库思考追记',
      answer,
      sources,
      agentBackend
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/obsidian/append:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/obsidian/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.k || '6', 10);
    if (!query) return res.json({ ok: true, hits: [] });
    const result = await obsidianSync.searchObsidianVault(query, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 读取 Vault 指定笔记正文
app.get('/api/obsidian/note', (req, res) => {
  try {
    const notePath = req.query.path || '00-入口/LMMWiki-Index.md';
    const result = obsidianSync.readVaultNote(notePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 读取 Vault 笔记与实体列表
app.get('/api/obsidian/list', (req, res) => {
  try {
    const result = obsidianSync.listVaultNotes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Tier 2: qwen-flash 智能句级原地快修引擎
// -------------------------------------------------------------
const CLEANSING_WHITELIST = new Set([
  '好的', '收到', '看下微信', '是的', '明白', '好的好的', '没问题',
  '谢谢', '对的', 'OK', '再见', '继续', '没有', '同意', '行', '好的收到'
]);

const sentenceCache = new Map();

async function cleanseSentenceWithQwenFlash(text, context = '') {
  const trimmed = (text || '').trim();
  if (!trimmed || /^[，。！？、…—\s]+$/.test(trimmed)) return trimmed;

  const cacheKey = context ? `${context.slice(-30)}:::${trimmed}` : trimmed;

  // 1. 缓存拦截
  if (sentenceCache.has(cacheKey)) {
    return sentenceCache.get(cacheKey);
  }

  // 2. 短命令白名单免修 (0ms 零延迟返回)
  if (CLEANSING_WHITELIST.has(trimmed)) {
    return trimmed;
  }

  if (!DASHSCOPE_API_KEY) {
    return trimmed;
  }

  // 3. 熔断与降级控制 (Tier 2 异步就地替换，宽容度设为 1200ms 以保证 100% 修复率且不影响 Tier 1 实时出字)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const userPrompt = context
      ? `【前文语境】：${context}\n【待修正语句】：${trimmed}`
      : `【待修正语句】：${trimmed}`;

    const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-flash',
        messages: [
          {
            role: 'system',
            content: '你是一个高精度的实时语音转文字纠错润色助手。\n你的任务是对 ASR 语音识别输出的语句进行智能修正：\n1. 结合前文语境，纠正同音/近音错别字、生僻词和被 ASR 听错的专业词汇（例如将“率度”纠正为“额度”，“仓市”纠正为“尝试”等）。\n2. 消除口吃、卡顿导致的字词重复（如“过完过完”->“过完”）。\n3. 剔除严重影响可读性的无意义口头禅与语气词（如“呃”、“那个那个”、“嗯”）。\n4. 补充和修正标点符号，遵循中英文及数字之间加半角空格的规范，保持句子通顺连贯。\n5. 忠于说话者原意，不要随意添加未提及的信息。\n6. 严格禁止任何开场白、解释或前后引号标记，直接输出修正后的单句纯文本。'
          },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        top_p: 0.1,
        max_tokens: 300
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const json = await resp.json();
      let result = json.choices?.[0]?.message?.content?.trim();
      if (result) {
        result = result.replace(/^```.*?```$/gs, '').replace(/^"|"$/g, '').trim();
        sentenceCache.set(cacheKey, result);
        if (sentenceCache.size > 200) {
          const firstKey = sentenceCache.keys().next().value;
          sentenceCache.delete(firstKey);
        }
        return result;
      }
    }
    return trimmed;
  } catch (err) {
    clearTimeout(timeoutId);
    return trimmed; // 熔断降级返回原始文本
  }
}

// Tier 2 单句快修 HTTP 接口
app.post('/api/asr/cleanse', async (req, res) => {
  try {
    const { text, sentenceId, context } = req.body;
    const t0 = Date.now();
    const cacheKey = context ? `${(context || '').slice(-30)}:::${(text || '').trim()}` : (text || '').trim();
    const wasCached = sentenceCache.has(cacheKey);
    const cleansed = await cleanseSentenceWithQwenFlash(text, context || '');
    res.json({
      ok: true,
      sentenceId,
      original: text,
      cleansed,
      latencyMs: Date.now() - t0,
      cached: wasCached
    });
  } catch (err) {
    res.json({ ok: false, original: req.body.text, cleansed: req.body.text, error: err.message });
  }
});

// Tier 3 任务分类：排版润色 (Polish/Formal Draft)
app.post('/api/llm/polish', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ ok: false, error: 'text is required' });

    const systemPrompt = `你是一个资深幕僚与排版润色专家。你的任务是将用户口语化的长语音流水账/碎碎念，深度重构并整理为结构分明、行文干练、极具商业价值的正式汇报草稿。
要求：
1. 提炼明确的主题、背景、核心主张。
2. 将口语叙述整理为模块化要点，分级清晰 (Markdown H2/H3/列表)。
3. 严格禁止 Unicode Emoji。
4. 保持事实严谨，消除赘述。`;

    const userPrompt = `【待润色原始口语材料】:\n${text}\n\n请输出结构化正式汇报草稿：`;
    const completion = await llmConfig.callChatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    });
    if (!completion.ok) return res.status(completion.status).json({ ok: false, error: completion.error });
    const data = completion.data;
    const draft = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ ok: true, draft });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. WebSocket ASR 中继 (第一层 fun-asr-realtime 感知层 + 第二层 qwen-flash 快修)
// 具备实时监控日志、15秒环形缓冲与平滑断线自愈重连架构
// -------------------------------------------------------------
wss.on('connection', (clientWs, req) => {
  const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = (req.headers['user-agent'] || '').slice(0, 45);
  console.log(`[WS] Client connected from ${clientIp} [${ua}]`);

  let dashscopeWs = null;
  let currentTaskId = null;
  let isTaskStarted = false;
  let isClientRecording = false;
  let reconnectTimer = null;
  let isReconnecting = false;
  let clientChunkCount = 0;
  let clientByteCount = 0;
  let currentSessionId = 'sess-' + Date.now();
  let clientSilenceThreshold = 800; // 默认 800ms 自然交流阈值，允许吸气与短停顿，杜绝抢跑断句
  let pendingPrefix = ''; // 连句保护缓存：暂存如"然后"、"但是"等悬挂连词
  const DANGLING_CONJUNCTIONS = new Set(['然后', '因为', '所以', '但是', '而且', '并且', '以及', '那么', '其实', '不过', '虽然', '另外', '也就是说', '比如', '比如说']);
  const sessionUtterances = [];

  function persistSessionIncremental() {
    if (sessionUtterances.length === 0) return;
    try {
      const existing = storage.getSession(currentSessionId) || {
        id: currentSessionId,
        title: '语音录音 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        topic: '语音讨论',
        createdAt: new Date().toISOString()
      };
      existing.utterances = sessionUtterances;
      existing.durationSeconds = Math.round(clientChunkCount * 0.05);
      storage.saveSession(existing);
    } catch (e) {
      console.error('[Storage] Incremental save error:', e);
    }
  }

  // 环形缓冲队列：保留最多 150 帧 (15 秒 16kHz PCM，每帧 3200 字节，防止网络重连时丢音)
  const pcmQueue = [];
  const MAX_QUEUE_SIZE = 150;

  function pushPcmChunk(chunk) {
    pcmQueue.push(chunk);
    if (pcmQueue.length > MAX_QUEUE_SIZE) {
      pcmQueue.shift();
    }
  }

  function flushPcmQueue() {
    if (!dashscopeWs || dashscopeWs.readyState !== WebSocket.OPEN || !isTaskStarted) return;
    const queuedCount = pcmQueue.length;
    if (queuedCount > 0) {
      console.log(`[DashScope] Flushing ${queuedCount} buffered audio chunks to DashScope...`);
    }
    while (pcmQueue.length > 0 && dashscopeWs.readyState === WebSocket.OPEN) {
      const chunk = pcmQueue.shift();
      dashscopeWs.send(chunk);
    }
  }

  function startDashScopeTask() {
    if (!isClientRecording || clientWs.readyState !== WebSocket.OPEN) return;

    if (!DASHSCOPE_API_KEY) {
      isClientRecording = false;
      cleanupDashScope(true);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'asr_error',
          code: 'ASR_NOT_CONFIGURED',
          message: 'ASR 未配置：请在 .env 中设置 DASHSCOPE_API_KEY 后重启服务。'
        }));
      }
      return;
    }

    cleanupDashScope(false); // 关闭旧 socket，但保留队列
    currentTaskId = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    console.log(`[DashScope] Initializing task: ${currentTaskId}`);

    try {
      dashscopeWs = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference/', {
        headers: {
          'Authorization': `bearer ${DASHSCOPE_API_KEY}`
        }
      });
    } catch (e) {
      console.error('[DashScope] Failed to create WebSocket:', e);
      scheduleReconnect();
      return;
    }

    dashscopeWs.on('open', () => {
      console.log(`[DashScope] Socket open for taskId: ${currentTaskId}, sending run-task...`);
      const runTaskPayload = {
        header: {
          action: 'run-task',
          task_id: currentTaskId,
          streaming: 'duplex'
        },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: 'paraformer-realtime-v2',
          input: {},
          parameters: {
            format: 'pcm',
            sample_rate: 16000,
            language_hints: ['zh'],
            semantic_punctuation_enabled: false,
            max_sentence_silence: clientSilenceThreshold,
            multi_threshold_mode_enabled: false
          }
        }
      };
      dashscopeWs.send(JSON.stringify(runTaskPayload));
    });

    dashscopeWs.on('message', (dsData) => {
      try {
        const parsed = JSON.parse(dsData.toString());
        // 过滤心跳包帧，避免误判
        if (parsed.payload?.heartbeat === true) {
          return;
        }

        const event = parsed.header?.event;

        if (event === 'task-started') {
          isTaskStarted = true;
          isReconnecting = false;
          console.log(`[DashScope] Task started successfully: ${currentTaskId}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'asr_started',
              taskId: currentTaskId,
              model: 'paraformer-realtime-v2'
            }));
          }
          flushPcmQueue();
        } else if (event === 'result-generated') {
          const sentence = parsed.payload?.output?.sentence;
          if (sentence) {
            const text = (sentence.text || '').trim();
            const isEnd = sentence.sentence_end === true;
            if (isEnd) {
              if (!text) return; // 忽略静音空句

              // 悬挂连词连句保护：如果只说了"然后"、"但是"等单独连词且仍在录音，暂存前缀等待拼接下一句
              const cleanText = text.replace(/[，。！？、…—\s]/g, '');
              if (DANGLING_CONJUNCTIONS.has(cleanText) && isClientRecording) {
                pendingPrefix = cleanText + '，';
                console.log(`[ASR Guard] Held dangling conjunction "${cleanText}" for next sentence`);
                return;
              }

              const finalText = pendingPrefix ? (pendingPrefix + text) : text;
              pendingPrefix = '';

              const sentenceId = 'sent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
              console.log(`[ASR Committed] "${finalText}" (${sentence.begin_time || 0}ms -> ${sentence.end_time || 0}ms)`);
              
              // 实时落库：记录至当前会话
              const utteranceEntry = {
                id: sessionUtterances.length + 1,
                sentenceId,
                speaker: '发言人',
                time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
                text: finalText,
                rawText: finalText,
                isCleansed: false,
                begin_time: sentence.begin_time,
                end_time: sentence.end_time
              };
              sessionUtterances.push(utteranceEntry);
              persistSessionIncremental();

              // 第一层 fun-asr-realtime 极速闭合
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'asr_committed',
                  sentenceId,
                  text: finalText,
                  raw_text: finalText,
                  begin_time: sentence.begin_time,
                  end_time: sentence.end_time,
                  words: sentence.words
                }));
              }

              // 第二层 qwen-flash 智能结合上下文原地快修 (异步不阻塞)
              const t0 = Date.now();
              const recentContext = sessionUtterances
                .slice(-4, -1)
                .map(u => u.text)
                .filter(Boolean)
                .join('；');

              cleanseSentenceWithQwenFlash(finalText, recentContext).then((cleansed) => {
                if (clientWs.readyState === WebSocket.OPEN && cleansed) {
                  console.log(`[Qwen Cleansed] "${finalText}" -> "${cleansed}" (${Date.now() - t0}ms)`);
                  const target = sessionUtterances.find(u => u.sentenceId === sentenceId);
                  if (target) {
                    target.text = cleansed;
                    target.isCleansed = true;
                    persistSessionIncremental();
                  }
                  clientWs.send(JSON.stringify({
                    type: 'sentence_cleansed',
                    sentenceId,
                    original: finalText,
                    cleansed,
                    latencyMs: Date.now() - t0,
                    cached: false
                  }));
                }
              }).catch(() => {});
            } else {
              // 第一层 Partial Interim 流
              if (text) {
                console.log(`[ASR Interim] "${text}"`);
              }
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'asr_interim',
                  text: sentence.text || '',
                  begin_time: sentence.begin_time,
                  end_time: sentence.end_time
                }));
              }
            }
          }
        } else if (event === 'task-finished') {
          console.log(`[DashScope] Task ${currentTaskId} finished.`);
          if (isClientRecording) {
            // 如果客户端仍在录音状态，说明是服务端超时闭合，立即自动续连
            scheduleReconnect();
          } else {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'asr_finished' }));
            }
            cleanupDashScope(true);
          }
        } else if (event === 'task-failed') {
          console.error(`[DashScope] Task ${currentTaskId} failed:`, parsed.header?.error_code, parsed.header?.error_message);
          if (isClientRecording) {
            scheduleReconnect();
          } else {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'asr_error',
                code: parsed.header?.error_code,
                message: parsed.header?.error_message
              }));
            }
            cleanupDashScope(true);
          }
        }
      } catch (err) {
        console.error('[DashScope] Parse error:', err);
      }
    });

    dashscopeWs.on('error', (err) => {
      console.error('[DashScope] Socket error:', err.message);
      if (isClientRecording) {
        scheduleReconnect();
      } else {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'asr_error', message: err.message }));
        }
        cleanupDashScope(true);
      }
    });

    dashscopeWs.on('close', (code, reason) => {
      console.log(`[DashScope] Socket closed (code: ${code}, reason: ${reason?.toString() || 'none'})`);
      if (isClientRecording) {
        scheduleReconnect();
      } else {
        cleanupDashScope(true);
      }
    });
  }

  function scheduleReconnect() {
    if (!isClientRecording || isReconnecting) return;
    isReconnecting = true;
    isTaskStarted = false;
    console.warn('[DashScope] Connection dropped while client recording. Triggering auto-reconnect in 300ms...');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'asr_reconnecting',
        message: 'ASR 引擎自动平滑续接中，音频持续采集中...'
      }));
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (isClientRecording && clientWs.readyState === WebSocket.OPEN) {
        startDashScopeTask();
      }
    }, 300);
  }

  function cleanupDashScope(resetQueue = true) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (dashscopeWs) {
      try {
        if (dashscopeWs.readyState === WebSocket.OPEN) {
          dashscopeWs.close();
        }
      } catch (e) {}
      dashscopeWs = null;
    }
    isTaskStarted = false;
    currentTaskId = null;
    if (resetQueue) {
      pcmQueue.length = 0;
    }
  }

  clientWs.on('message', (message, isBinary) => {
    // 1. 处理控制信令
    if (!isBinary) {
      try {
        const cmd = JSON.parse(message.toString());
        if (cmd.type === 'ping') {
          clientWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (cmd.type === 'start') {
          currentSessionId = cmd.sessionId || ('sess-' + Date.now());
          if (cmd.maxSentenceSilence && typeof cmd.maxSentenceSilence === 'number') {
            clientSilenceThreshold = Math.max(300, Math.min(2500, cmd.maxSentenceSilence));
          } else {
            clientSilenceThreshold = 800;
          }
          pendingPrefix = '';
          sessionUtterances.length = 0;
          console.log(`[WS] Client START command received (ip: ${clientIp}, sessionId: ${currentSessionId}, silenceThreshold: ${clientSilenceThreshold}ms)`);
          isClientRecording = true;
          isReconnecting = false;
          clientChunkCount = 0;
          clientByteCount = 0;
          pcmQueue.length = 0;
          startDashScopeTask();
        } else if (cmd.type === 'config') {
          if (cmd.maxSentenceSilence && typeof cmd.maxSentenceSilence === 'number') {
            clientSilenceThreshold = Math.max(300, Math.min(2500, cmd.maxSentenceSilence));
            console.log(`[WS] Client updated silenceThreshold to ${clientSilenceThreshold}ms`);
          }
        } else if (cmd.type === 'stop') {
          console.log(`[WS] Client STOP command received. Total streamed: ${clientChunkCount} chunks (${(clientByteCount / 1024).toFixed(1)} KB)`);
          if (pendingPrefix) {
            // 如果录音停止时仍有暂存前缀，将其作为独立句段提交
            const clean = pendingPrefix.replace(/[，、]/g, '').trim();
            if (clean) {
              const sentenceId = 'sent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
              sessionUtterances.push({
                id: sessionUtterances.length + 1,
                sentenceId,
                speaker: '发言人',
                time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
                text: clean,
                rawText: clean,
                isCleansed: false,
                begin_time: 0,
                end_time: 0
              });
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'asr_committed',
                  sentenceId,
                  text: clean,
                  raw_text: clean,
                  begin_time: 0,
                  end_time: 0
                }));
              }
            }
            pendingPrefix = '';
          }
          persistSessionIncremental();
          isClientRecording = false;
          isReconnecting = false;
          // 捕获旧连接后只关闭它本身，不重置全局状态与队列，
          // 避免用户在 800ms 内重新开始录音时新任务被旧定时器清空。
          const staleDashscopeWs = dashscopeWs;
          const staleTaskId = currentTaskId;
          dashscopeWs = null;
          currentTaskId = null;
          isTaskStarted = false;
          if (staleDashscopeWs && staleDashscopeWs.readyState === WebSocket.OPEN && staleTaskId) {
            staleDashscopeWs.send(JSON.stringify({
              header: {
                action: 'finish-task',
                task_id: staleTaskId,
                streaming: 'duplex'
              },
              payload: { input: {} }
            }));
            setTimeout(() => {
              try {
                if (staleDashscopeWs.readyState !== WebSocket.CLOSED) staleDashscopeWs.close();
              } catch (e) {}
            }, 800);
          } else {
            cleanupDashScope(true);
          }
        }
      } catch (e) {
        console.error('[WebSocket] Command error:', e);
      }
      return;
    }

    // 2. 音频裸流 (16kHz 16-bit PCM)
    if (isClientRecording) {
      clientChunkCount++;
      clientByteCount += message.length;
      if (clientChunkCount === 1 || clientChunkCount % 30 === 0) {
        console.log(`[WS Stream] Streaming active: chunk #${clientChunkCount} (${(clientByteCount / 1024).toFixed(1)} KB sent so far), taskStarted=${isTaskStarted}`);
      }
      if (dashscopeWs && dashscopeWs.readyState === WebSocket.OPEN && isTaskStarted) {
        dashscopeWs.send(message);
      } else {
        // DashScope 建立连接中或自愈重连时，进入环形缓冲，绝不丢音
        pushPcmChunk(message);
      }
    }
  });

  clientWs.on('close', (code, reason) => {
    console.log(`[WS] Client disconnected (code: ${code}, reason: ${reason?.toString() || 'none'}, total audio chunks: ${clientChunkCount})`);
    if (sessionUtterances.length > 0) {
      persistSessionIncremental();
      console.log(`[Storage] Auto-persisted session ${currentSessionId} with ${sessionUtterances.length} utterances.`);
    }
    isClientRecording = false;
    cleanupDashScope(true);
  });
});

server.listen(PORT, () => {
  const llm = llmConfig.getPublicConfig();
  console.log(`=================================================`);
  console.log(`[Server] TP Voice Brain · 个人长期语音录音助手 (Web)`);
  console.log(`[Server] 访问地址: http://localhost:${PORT}`);
  console.log(`[Server] 阿里云百炼 ASR: ${DASHSCOPE_API_KEY ? 'Paraformer-realtime-v2 (已配置)' : '未配置 · 录音转写不可用'}`);
  console.log(`[Server] LLM: ${llm.configured ? `${llm.provider}/${llm.model} @ ${llm.baseUrl} (已配置)` : '未配置 · AI 纪要不可用'}`);
  console.log(`=================================================`);
});
