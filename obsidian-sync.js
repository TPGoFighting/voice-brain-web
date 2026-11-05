const fs = require('fs');
const path = require('path');

// 环境配置
const VAULT_PATH = process.env.VAULT_PATH || (fs.existsSync('/home/ubuntu/obsidian-vault') ? '/home/ubuntu/obsidian-vault' : path.join(__dirname, 'data', 'vault-mirror'));
const OBSIDIAN_AGENT_URL = process.env.OBSIDIAN_AGENT_URL || 'http://127.0.0.1:8000';
// 安全说明：不在源码中内置默认口令，必须通过 ADMIN_API_KEY 环境变量注入。
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 格式化日期为 YYYY-MM-DD
function formatDate(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化时间为 YYYY-MM-DD HH:mm:ss
function formatDateTime(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

// 安全文件名清洗
function sanitizeFilename(name) {
  return (name || '未命名讨论')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

// 严格校验目标路径必须位于 Vault 内部（防同级目录前缀绕过，如 ../vault-evil/）
function isSafeVaultPath(absolutePath) {
  const relative = path.relative(path.resolve(VAULT_PATH), path.resolve(absolutePath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

// YAML 双引号标量转义：防止标题中的引号或换行破坏 Frontmatter 结构
function yamlEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

// 将录音会话转写为标准的 Obsidian LMMWiki 笔记
function formatSessionMarkdown(session, persona = {}) {
  const title = session.title || session.topic || '未命名讨论';
  const createdDate = formatDate(session.createdAt);
  const createdDateTime = formatDateTime(session.createdAt);
  const minutes = session.minutes || {};
  const utterances = session.utterances || [];
  const memories = session.memories || [];
  const personaName = persona.name || '红队侦探';
  const personaTitle = persona.title || '反方拷问官';
  const personaMotto = persona.motto || '没有天衣无缝的工程方案，只有还没发现的边缘盲区。';
  const specialSection = minutes.special_section || null;

  // 提取关键词标签
  const rawTags = ['知识库', '录音材料', '语音纪要', 'lmm-wiki', `人设/${personaName}`];
  if (session.topic) rawTags.push(`主题/${session.topic.replace(/\s+/g, '_')}`);
  const tagListYaml = rawTags.map(t => `  - "${t}"`).join('\n');

  // 构建 Frontmatter
  let md = `---
title: "${yamlEscape(title)}"
created: ${createdDate}
updated: ${formatDate(new Date())}
date_time: "${createdDateTime}"
source: tp-voice-brain
session_id: "${session.id}"
duration_seconds: ${session.duration || 0}
layer: raw
provenance: voice-brain
persona: "[[03-Wiki/LMMWiki/角色-${personaName}|${personaName}]]"
status: done
tags:
${tagListYaml}
---

# [[${title}]]

> [!NOTE] 录音与第二大脑元数据
> - 记录时间：${createdDateTime} · 录音时长：${Math.floor((session.duration || 0) / 60)}分${(session.duration || 0) % 60}秒
> - 提炼人设：**[[03-Wiki/LMMWiki/角色-${personaName}|${personaName}]]**（${personaTitle}）
> - 人设谏言：*“${personaMotto.replace(/[“”"]/g, '')}”*
> - 归档路径：\`01-Raw/录音材料/${createdDate.slice(0, 7)}/${createdDate}-${sanitizeFilename(title)}.md\`
> - 索引总线：[[03-Wiki/LMMWiki/LMMWiki-Index|LMMWiki 知识总线索引]]

---

## 一、人设专属提炼 · [[03-Wiki/LMMWiki/角色-${personaName}|${personaName}]]
`;

  if (specialSection) {
    md += `### ${specialSection.title || '人设深度审查'}\n\n`;
    if (specialSection.summary) {
      md += `> ${specialSection.summary}\n\n`;
    }
    if (Array.isArray(specialSection.items) && specialSection.items.length > 0) {
      specialSection.items.forEach((item, idx) => {
        if (typeof item === 'string') {
          md += `- ${idx + 1}. ${item}\n`;
        } else if (item && typeof item === 'object') {
          md += `- **${item.title || item.name || `点位 ${idx + 1}`}**: ${item.desc || item.content || JSON.stringify(item)}\n`;
        }
      });
      md += '\n';
    }
  }

  // TLDR
  md += `## 二、30秒速览 (TL;DR)\n\n`;
  if (Array.isArray(minutes.tldr) && minutes.tldr.length > 0) {
    minutes.tldr.forEach(t => {
      md += `- ${t}\n`;
    });
  } else {
    md += `- ${session.delta_summary || '暂无提炼'}\n`;
  }
  md += '\n';

  // 关键决议
  md += `## 三、明确敲定的关键决议 (Decisions)\n\n`;
  const decisions = minutes.decisions || session.decisions || [];
  if (Array.isArray(decisions) && decisions.length > 0) {
    decisions.forEach((d, i) => {
      md += `${i + 1}. **[[决议/${sanitizeFilename(d).slice(0, 20)}|${d}]]**\n`;
    });
  } else {
    md += `*暂无明确终局敲定的决议项*\n`;
  }
  md += '\n';

  // 行动清单
  md += `## 四、落地行动清单 (Action Items)\n\n`;
  const actions = minutes.action_items || [];
  if (Array.isArray(actions) && actions.length > 0) {
    actions.forEach(a => {
      const task = typeof a === 'string' ? a : a.task;
      const assignee = a.assignee ? ` @${a.assignee}` : '';
      const priority = a.priority ? ` [${a.priority}]` : '';
      const deadline = a.deadline ? ` (截止: ${a.deadline})` : '';
      md += `- [ ] ${priority}${task}${assignee}${deadline}\n`;
    });
  } else {
    md += `*暂无明确行动待办*\n`;
  }
  md += '\n';

  // 固化的长期记忆
  md += `## 五、固化至第二大脑的长期记忆碎片 (Memories)\n\n`;
  if (Array.isArray(memories) && memories.length > 0) {
    memories.forEach(m => {
      const cat = m.category || 'fact';
      const content = m.content || '';
      const tags = (m.tags || []).map(t => `#${t}`).join(' ');
      md += `- **[${cat.toUpperCase()}]** ${content} ${tags}\n`;
    });
  } else {
    md += `*本场讨论未产生新增长期记忆*\n`;
  }
  md += '\n';

  // 涉及的核心知识实体 (双向链接)
  md += `## 六、关联知识实体网络 (LMMWiki Entities)\n\n`;
  const entities = minutes.lmm_wiki_entities || [];
  if (Array.isArray(entities) && entities.length > 0) {
    entities.forEach(ent => {
      const entName = typeof ent === 'string' ? ent : ent.name;
      const entDesc = ent.description ? ` —— ${ent.description}` : '';
      md += `- **[[03-Wiki/LMMWiki/${entName}|${entName}]]**${entDesc}\n`;
    });
  } else {
    // 自动从主题和标签生成默认实体
    const defaultEnt = session.topic || '语音技术架构';
    md += `- **[[03-Wiki/LMMWiki/${defaultEnt}|${defaultEnt}]]** —— 核心议题节点\n`;
    md += `- **[[03-Wiki/LMMWiki/角色-${personaName}|${personaName}]]** —— 提炼视角智能体\n`;
  }
  md += '\n';

  // 思维导图
  if (minutes.mindmap_markdown) {
    md += `## 七、结构化思维导图 (Mindmap)\n\n\`\`\`markdown\n${minutes.mindmap_markdown}\n\`\`\`\n\n`;
  }

  // 逐字稿
  md += `## 八、录音逐字稿对齐 (Transcript)\n\n`;
  if (utterances.length > 0) {
    utterances.forEach(u => {
      const time = u.time ? `\`${u.time}\` ` : '';
      const spk = u.speaker ? `**${u.speaker}**: ` : '';
      md += `> ${time}${spk}${u.text}\n>\n`;
    });
  } else {
    md += `*无逐字稿内容*\n`;
  }

  return md;
}

// 同步单个会话至 Obsidian Vault
async function syncSessionToVault(session, persona = {}) {
  const title = session.title || session.topic || '未命名讨论';
  const createdDate = formatDate(session.createdAt);
  const monthDir = createdDate.slice(0, 7);
  const targetDir = path.join(VAULT_PATH, '01-Raw', '录音材料', monthDir);
  ensureDir(targetDir);

  let filename = `${createdDate}-${sanitizeFilename(title)}.md`;
  // 同一天同标题的重复归档不覆盖旧笔记，追加序号生成唯一文件名
  if (fs.existsSync(path.join(targetDir, filename))) {
    const baseName = filename.slice(0, -3);
    let counter = 2;
    while (fs.existsSync(path.join(targetDir, `${baseName}-${counter}.md`))) counter++;
    filename = `${baseName}-${counter}.md`;
  }
  const filePath = path.join(targetDir, filename);
  const relativePath = path.join('01-Raw', '录音材料', monthDir, filename).replace(/\\/g, '/');

  // 生成 Markdown 内容并写入
  const markdownContent = formatSessionMarkdown(session, persona);
  fs.writeFileSync(filePath, markdownContent, 'utf-8');

  // 更新/创建关联的 LMMWiki 实体节点
  const entitiesCreated = [];
  const lmmWikiDir = path.join(VAULT_PATH, '03-Wiki', 'LMMWiki');
  ensureDir(lmmWikiDir);

  const entities = session.minutes?.lmm_wiki_entities || [];
  for (const ent of entities) {
    const entName = sanitizeFilename(typeof ent === 'string' ? ent : ent.name);
    if (!entName) continue;
    const entPath = path.join(lmmWikiDir, `${entName}.md`);
    const backlink = `- [[${relativePath}|${createdDate} ${title}]] (角色: [[03-Wiki/LMMWiki/角色-${persona.name || '红队侦探'}|${persona.name || '红队侦探'}]])`;

    if (fs.existsSync(entPath)) {
      let existing = fs.readFileSync(entPath, 'utf-8');
      if (!existing.includes(relativePath)) {
        if (!existing.includes('## 关联语音录音讨论 (Referenced Voice Sessions)')) {
          existing += `\n\n## 关联语音录音讨论 (Referenced Voice Sessions)\n\n${backlink}\n`;
        } else {
          existing = existing.replace('## 关联语音录音讨论 (Referenced Voice Sessions)', `## 关联语音录音讨论 (Referenced Voice Sessions)\n\n${backlink}`);
        }
        fs.writeFileSync(entPath, existing, 'utf-8');
      }
    } else {
      const entDesc = typeof ent === 'object' && ent.description ? ent.description : '由 TP Voice Brain 录音会话自动沉淀的核心概念节点。';
      const entCategory = typeof ent === 'object' && ent.category ? ent.category : '概念';
      const entContent = `---
title: "${yamlEscape(entName)}"
created: ${createdDate}
updated: ${formatDate(new Date())}
layer: wiki
provenance: voice-brain
tags:
  - 知识库
  - lmm-wiki
  - 实体/${entCategory}
---

# [[${entName}]]

## 概述
${entDesc}

---

## 关联语音录音讨论 (Referenced Voice Sessions)
${backlink}
`;
      fs.writeFileSync(entPath, entContent, 'utf-8');
    }
    entitiesCreated.push(entName);
  }

  // 更新角色人设主页
  const personaName = persona.name || '红队侦探';
  const personaNotePath = path.join(lmmWikiDir, `角色-${personaName}.md`);
  const personaBacklink = `- [[${relativePath}|${createdDate} ${title}]] (${formatDateTime(session.createdAt)})`;
  if (fs.existsSync(personaNotePath)) {
    let pContent = fs.readFileSync(personaNotePath, 'utf-8');
    if (!pContent.includes(relativePath)) {
      if (!pContent.includes('## 经由本角色提炼的录音会话')) {
        pContent += `\n\n## 经由本角色提炼的录音会话\n\n${personaBacklink}\n`;
      } else {
        pContent = pContent.replace('## 经由本角色提炼的录音会话', `## 经由本角色提炼的录音会话\n\n${personaBacklink}`);
      }
      fs.writeFileSync(personaNotePath, pContent, 'utf-8');
    }
  } else {
    const pContent = `---
title: "角色-${personaName}"
created: ${createdDate}
updated: ${formatDate(new Date())}
layer: wiki
provenance: voice-brain
tags:
  - 知识库
  - lmm-wiki
  - 角色人设
---

# [[角色-${personaName}]]

> **称号**：${persona.title || '认知审计官'}
> **人设格言**：${persona.motto || '以严密逻辑守卫第二大脑。'}

## 角色定位与总结风格
${persona.styleDesc || '负责对录音材料进行该维度的深度洞察、提取盲区与固化长期记忆。'}

---

## 经由本角色提炼的录音会话
${personaBacklink}
`;
    fs.writeFileSync(personaNotePath, pContent, 'utf-8');
  }

  // 更新主索引文件：00-入口/LMMWiki-Index.md
  updateMasterIndex(session, persona, relativePath);

  // 触发 Obsidian-Agent 增量重索引
  let reindexSuccess = false;
  try {
    const reindexRes = await fetch(`${OBSIDIAN_AGENT_URL}/api/reindex?wait=false`, {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_API_KEY
      }
    });
    reindexSuccess = reindexRes.ok;
  } catch (err) {
    // 本地开发或服务离线时静默记录
    console.warn('[Obsidian-Agent] Reindex trigger notice:', err.message);
  }

  return {
    success: true,
    filePath,
    relativePath,
    entitiesCreated,
    reindexSuccess
  };
}

// 更新知识库主入口索引
function updateMasterIndex(session, persona, relativePath) {
  const indexDir = path.join(VAULT_PATH, '00-入口');
  ensureDir(indexDir);
  const indexPath = path.join(indexDir, 'LMMWiki-Index.md');

  const createdDateTime = formatDateTime(session.createdAt);
  const title = session.title || session.topic || '未命名讨论';
  const personaName = persona.name || '红队侦探';
  const durationStr = `${Math.floor((session.duration || 0) / 60)}m${(session.duration || 0) % 60}s`;
  const row = `| [[${relativePath}\\|${title}]] | ${createdDateTime} | [[03-Wiki/LMMWiki/角色-${personaName}\\|${personaName}]] | ${durationStr} | \`${session.id}\` |`;

  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    if (!content.includes(relativePath)) {
      if (content.includes('|---')) {
        content = content.replace('|---|\n', `|---|\n${row}\n`);
      } else {
        content += `\n${row}\n`;
      }
      fs.writeFileSync(indexPath, content, 'utf-8');
    }
  } else {
    const newIndex = `---
title: LMMWiki 知识总线索引
created: ${formatDate(new Date())}
updated: ${formatDate(new Date())}
layer: wiki
provenance: voice-brain
tags:
  - 知识库
  - lmm-wiki
  - 总线索引
---

# LMMWiki 知识总线索引 (Voice Brain & Second Brain)

> 基于 Karpathy LLM-Wiki 范式构建：录音素材为不可变源数据，大模型为编译器，持续编译出高信噪比、互相双向链接的活体知识节点。

## 录音纪要与素材归档总表

| 录音会话主题 | 记录时间 | 提炼人设 | 录音时长 | 会话编号 |
|---|---|---|---|---|
${row}

---

## 关联知识实体集群 (LMMWiki Entities)
- 查看目录：[[03-Wiki/LMMWiki/]]

## 角色人设档案库 (Koboyo Personas)
- [[03-Wiki/LMMWiki/角色-红队侦探|红队侦探]] · 挑刺审计与漏洞排查
- [[03-Wiki/LMMWiki/角色-系统架构师|系统架构师]] · 模块解耦与服务契约
- [[03-Wiki/LMMWiki/角色-算法科学家|算法科学家]] · 第一性原理与指标收敛
- [[03-Wiki/LMMWiki/角色-底层工程师|底层工程师]] · 内存池与硬核性能
- [[03-Wiki/LMMWiki/角色-总结魔法师|总结魔法师]] · 30秒高管电梯汇报
- [[03-Wiki/LMMWiki/角色-记忆宇航员|记忆宇航员]] · 第二大脑知识星系
- [[03-Wiki/LMMWiki/角色-快轨暗影忍者|快轨暗影忍者]] · 敏捷交付与DoD验收
- [[03-Wiki/LMMWiki/角色-认知冥想者|认知冥想者]] · 动机洞察与盲区反思
- [[03-Wiki/LMMWiki/角色-声学音乐家|声学音乐家]] · 跨职能同频与共识合奏
- [[03-Wiki/LMMWiki/角色-灵感探险家|灵感探险家]] · 颠覆性脑洞与未知蓝海
`;
    fs.writeFileSync(indexPath, newIndex, 'utf-8');
  }
}

// 统一向 Obsidian 知识库 (带 Hermes / Native RAG) 发起提问
async function queryObsidianVault(query, history = []) {
  try {
    const res = await fetch(`${OBSIDIAN_AGENT_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        history: history.slice(-8)
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Obsidian Agent responded with ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return {
      ok: true,
      answer: data.answer || '',
      sources: data.sources || [],
      backend: data.backend || 'native',
      sessionId: data.session_id
    };
  } catch (err) {
    console.error('queryObsidianVault error:', err);
    return {
      ok: false,
      error: err.message,
      answer: `连接 Obsidian Agent 知识库异常: ${err.message}`,
      sources: []
    };
  }
}

// 在 Obsidian 知识库中快速检索
async function searchObsidianVault(query, limit = 6) {
  try {
    const url = `${OBSIDIAN_AGENT_URL}/api/search?q=${encodeURIComponent(query)}&k=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();
    return {
      ok: true,
      hits: data.hits || []
    };
  } catch (err) {
    return { ok: false, error: err.message, hits: [] };
  }
}

// 读取 Vault 中的指定笔记内容与 Frontmatter
function readVaultNote(noteRelativePath) {
  if (!fs.existsSync(VAULT_PATH)) {
    return { ok: false, error: 'Vault path does not exist on host' };
  }
  const cleanPath = (noteRelativePath || '00-入口/LMMWiki-Index.md').replace(/^\/+/, '');
  const targetPath = path.resolve(VAULT_PATH, cleanPath);
  if (!isSafeVaultPath(targetPath)) {
    return { ok: false, error: 'Access denied: path traversal not allowed' };
  }

  let actualPath = targetPath;
  if (!fs.existsSync(actualPath) && !actualPath.endsWith('.md')) {
    if (fs.existsSync(actualPath + '.md')) {
      actualPath = actualPath + '.md';
    }
  }

  if (!fs.existsSync(actualPath) || fs.statSync(actualPath).isDirectory()) {
    return { ok: false, error: `Note not found: ${cleanPath}` };
  }

  const content = fs.readFileSync(actualPath, 'utf-8');
  let frontmatter = {};
  let body = content;

  if (content.startsWith('---')) {
    const endFmIdx = content.indexOf('---', 3);
    if (endFmIdx !== -1) {
      const fmText = content.substring(3, endFmIdx).trim();
      body = content.substring(endFmIdx + 3).trim();
      fmText.split('\n').forEach(line => {
        const colon = line.indexOf(':');
        if (colon > 0) {
          const k = line.substring(0, colon).trim();
          const v = line.substring(colon + 1).trim().replace(/^['"]|['"]$/g, '');
          frontmatter[k] = v;
        }
      });
    }
  }

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = frontmatter.title || (titleMatch ? titleMatch[1].replace(/\[\[|\]\]/g, '') : path.basename(actualPath, '.md'));
  const stat = fs.statSync(actualPath);

  return {
    ok: true,
    path: path.relative(VAULT_PATH, actualPath),
    title,
    content,
    body,
    frontmatter,
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

// 列出知识库中的核心目录清单 (录音材料、实体、总线索引)
function listVaultNotes(category = 'all') {
  if (!fs.existsSync(VAULT_PATH)) {
    return { ok: false, error: 'Vault path does not exist' };
  }

  const voiceNotes = [];
  const voiceDir = path.join(VAULT_PATH, '01-Raw', '录音材料');
  if (fs.existsSync(voiceDir)) {
    const walk = (d) => {
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(d, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.name.endsWith('.md')) {
          const rel = path.relative(VAULT_PATH, full);
          const stat = fs.statSync(full);
          voiceNotes.push({
            title: item.name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''),
            filename: item.name,
            path: rel,
            category: 'voice',
            size: stat.size,
            updatedAt: stat.mtime.toISOString()
          });
        }
      }
    };
    walk(voiceDir);
  }

  const wikiEntities = [];
  const wikiDir = path.join(VAULT_PATH, '03-Wiki', 'LMMWiki');
  if (fs.existsSync(wikiDir)) {
    const items = fs.readdirSync(wikiDir);
    for (const name of items) {
      if (name.endsWith('.md')) {
        const full = path.join(wikiDir, name);
        const rel = path.relative(VAULT_PATH, full);
        const stat = fs.statSync(full);
        wikiEntities.push({
          title: name.replace(/\.md$/, ''),
          filename: name,
          path: rel,
          category: 'wiki',
          size: stat.size,
          updatedAt: stat.mtime.toISOString()
        });
      }
    }
  }

  return {
    ok: true,
    indexNote: '00-入口/LMMWiki-Index.md',
    voiceNotes,
    wikiEntities
  };
}

// 读取 Vault 与 Agent 健康状态
async function getObsidianStatus() {
  const vaultExists = fs.existsSync(VAULT_PATH);
  let voiceNotesCount = 0;
  let wikiNodesCount = 0;

  if (vaultExists) {
    const voiceDir = path.join(VAULT_PATH, '01-Raw', '录音材料');
    if (fs.existsSync(voiceDir)) {
      const countFiles = (dir) => {
        let count = 0;
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          if (item.isDirectory()) {
            count += countFiles(path.join(dir, item.name));
          } else if (item.name.endsWith('.md')) {
            count++;
          }
        }
        return count;
      };
      voiceNotesCount = countFiles(voiceDir);
    }

    const wikiDir = path.join(VAULT_PATH, '03-Wiki', 'LMMWiki');
    if (fs.existsSync(wikiDir)) {
      wikiNodesCount = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md')).length;
    }
  }

  let agentStatus = null;
  try {
    const healthRes = await fetch(`${OBSIDIAN_AGENT_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (healthRes.ok) {
      agentStatus = await healthRes.json();
    }
  } catch (e) {
    agentStatus = { status: 'offline', error: e.message };
  }

  return {
    vaultPath: VAULT_PATH,
    vaultExists,
    voiceNotesCount,
    wikiNodesCount,
    agentStatus
  };
}

// 反向将 Hermes Agent 思考与问答结果追加写回指定 Obsidian 笔记
async function appendThinkingToNote({
  notePath,
  query,
  answer,
  sources = [],
  agentBackend = 'hermes'
}) {
  if (!fs.existsSync(VAULT_PATH)) {
    throw new Error('Vault path does not exist on host: ' + VAULT_PATH);
  }

  // 清洗并解析目标笔记相对路径
  let cleanRelPath = (notePath || '00-入口/LMMWiki-Index.md').replace(/^\/+/, '');
  let actualPath = path.resolve(VAULT_PATH, cleanRelPath);

  if (!isSafeVaultPath(actualPath)) {
    throw new Error('Access denied: path traversal not allowed');
  }

  // 补齐 .md 后缀
  if (!fs.existsSync(actualPath) && !actualPath.endsWith('.md')) {
    if (fs.existsSync(actualPath + '.md')) {
      actualPath = actualPath + '.md';
      cleanRelPath = cleanRelPath + '.md';
    }
  }

  // 若指定笔记仍不存在，退回到 03-Wiki/LMMWiki/Hermes-追记日志.md
  if (!fs.existsSync(actualPath) || fs.statSync(actualPath).isDirectory()) {
    const fallbackDir = path.join(VAULT_PATH, '03-Wiki', 'LMMWiki');
    ensureDir(fallbackDir);
    actualPath = path.join(fallbackDir, 'Hermes-Agent-追记.md');
    cleanRelPath = '03-Wiki/LMMWiki/Hermes-Agent-追记.md';
    if (!fs.existsSync(actualPath)) {
      const initContent = `---
title: "Hermes Agent 追记"
created: ${formatDate(new Date())}
updated: ${formatDate(new Date())}
layer: wiki
provenance: hermes-agent
tags:
  - 知识库
  - lmm-wiki
  - hermes
---

# [[Hermes Agent 追记]]

> 本笔记由 Hermes Agent 在人机问答闭环中自动生成与反向追加。

`;
      fs.writeFileSync(actualPath, initContent, 'utf-8');
      try { fs.chmodSync(actualPath, 0o666); } catch (e) {}
    }
  }

  const dateTimeStr = formatDateTime(new Date());

  // 构建引用来源展示
  let sourcesBlock = '';
  if (Array.isArray(sources) && sources.length > 0) {
    const srcLines = sources.map(s => {
      const sp = typeof s === 'string' ? s : (s.path || s.title || '');
      const st = typeof s === 'object' && s.title ? s.title : sp;
      return `> - 来源: [[${sp}|${st}]]`;
    }).join('\n');
    sourcesBlock = `${srcLines}\n`;
  }

  const appendText = `
---

### AI 研判追记 · Hermes Agent (${dateTimeStr})
> [!NOTE] Hermes 研判记录
> - 记录时间：${dateTimeStr}
> - 研判议题：${(query || '知识库问答').replace(/[\r\n]+/g, ' ')}
> - 调度引擎：${(agentBackend || 'hermes').toUpperCase()}
${sourcesBlock}> - 追记归档：\`${cleanRelPath}\`

#### 思考与研判结论
${answer.trim()}
`;

  // 写入文件 (带完整权限)
  fs.appendFileSync(actualPath, appendText, 'utf-8');
  try {
    fs.chmodSync(actualPath, 0o666);
  } catch (e) {
    // 忽略权限修改失败
  }

  // 触发 Obsidian-Agent 增量重索引
  let reindexSuccess = false;
  try {
    const reindexRes = await fetch(`${OBSIDIAN_AGENT_URL}/api/reindex?wait=false`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_API_KEY }
    });
    reindexSuccess = reindexRes.ok;
  } catch (err) {
    console.warn('[Obsidian-Agent] Reindex after write-back notice:', err.message);
  }

  return {
    ok: true,
    relativePath: path.relative(VAULT_PATH, actualPath).replace(/\\/g, '/'),
    appendedAt: new Date().toISOString(),
    reindexSuccess
  };
}

module.exports = {
  formatSessionMarkdown,
  syncSessionToVault,
  appendThinkingToNote,
  queryObsidianVault,
  searchObsidianVault,
  getObsidianStatus,
  readVaultNote,
  listVaultNotes
};
