const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const MEMORIES_FILE = path.join(DATA_DIR, 'memories.json');

// 确保数据目录与基础文件存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_FILE)) {
  writeJsonAtomic(SESSIONS_FILE, []);
}
if (!fs.existsSync(MEMORIES_FILE)) {
  // 预置几条初始用户画像与项目事实记忆
  const initialMemories = [
    {
      id: "mem-init-1",
      category: "preference",
      content: "唐潘（Tyler Tang）倾向于使用 Flutter + Dart 跨平台开发移动端核心流处理应用，极度看重端侧零丢失与后台保活韧性。",
      tags: ["个人偏好", "Flutter", "工程架构"],
      importance: 5,
      createdAt: new Date().toISOString(),
      sourceSessionId: "system"
    },
    {
      id: "mem-init-2",
      category: "project",
      content: "「AI 录音豆」项目选型：硬件采用 DJI Mic Mini（单发射器蓝牙直连或 Type-C RX 双声道声卡），云端 ASR 采用阿里云百炼 Paraformer 流式接口，大模型采用 DeepSeek-Flash。",
      tags: ["AI录音豆", "DJI Mic", "技术选型", "百炼ASR"],
      importance: 5,
      createdAt: new Date().toISOString(),
      sourceSessionId: "system"
    }
  ];
  writeJsonAtomic(MEMORIES_FILE, initialMemories);
}

// 原子写盘：先写临时文件再 rename，避免进程崩溃导致 JSON 半截损坏
function writeJsonAtomic(file, data) {
  const tmpFile = `${file}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, file);
}

function readJsonSafe(file) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Read error on ${file}:`, err);
    // 损坏文件立即改名保留现场，避免空缓存随下次刷盘把原始数据覆盖清空
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    } catch (renameErr) {}
    return [];
  }
}

// -------------------------------------------------------------
// 高性能内存缓存 + 异步刷盘队列 (0ms 读写，避免阻塞 Node.js 事件循环与音频流)
// -------------------------------------------------------------
let sessionsCache = readJsonSafe(SESSIONS_FILE);
let memoriesCache = readJsonSafe(MEMORIES_FILE);

let sessionsFlushTimer = null;
let memoriesFlushTimer = null;

function scheduleSessionsFlush() {
  if (sessionsFlushTimer) return;
  sessionsFlushTimer = setTimeout(() => {
    sessionsFlushTimer = null;
    const tmpFile = `${SESSIONS_FILE}.tmp`;
    fs.promises.writeFile(tmpFile, JSON.stringify(sessionsCache, null, 2), 'utf-8')
      .then(() => fs.promises.rename(tmpFile, SESSIONS_FILE))
      .catch(err => console.error('[Storage Async Flush] Sessions error:', err));
  }, 200);
}

function scheduleMemoriesFlush() {
  if (memoriesFlushTimer) return;
  memoriesFlushTimer = setTimeout(() => {
    memoriesFlushTimer = null;
    const tmpFile = `${MEMORIES_FILE}.tmp`;
    fs.promises.writeFile(tmpFile, JSON.stringify(memoriesCache, null, 2), 'utf-8')
      .then(() => fs.promises.rename(tmpFile, MEMORIES_FILE))
      .catch(err => console.error('[Storage Async Flush] Memories error:', err));
  }, 200);
}

module.exports = {
  getSessions() {
    return sessionsCache;
  },

  getSession(id) {
    return sessionsCache.find(s => s.id === id) || null;
  },

  saveSession(sessionData) {
    const existingIndex = sessionsCache.findIndex(s => s.id === sessionData.id);
    if (existingIndex >= 0) {
      // 更新时保留原 createdAt，防止客户端伪造时间覆盖归档时间线
      sessionsCache[existingIndex] = {
        ...sessionsCache[existingIndex],
        ...sessionData,
        createdAt: sessionsCache[existingIndex].createdAt,
        updatedAt: new Date().toISOString()
      };
    } else {
      sessionsCache.unshift({
        ...sessionData,
        createdAt: sessionData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    // 异步排队刷盘，绝对不阻塞实时音频与 WebSocket 事件循环
    scheduleSessionsFlush();
    return sessionData;
  },

  deleteSession(id) {
    sessionsCache = sessionsCache.filter(s => s.id !== id);
    scheduleSessionsFlush();
  },

  getMemories() {
    return memoriesCache;
  },

  addMemories(newMemories) {
    const added = [];
    const existingContents = new Set(memoriesCache.map(m => m.content));
    for (const item of newMemories) {
      if (typeof item.content !== 'string' || !item.content.trim()) continue;
      // 按 content 去重：重复生成纪要不会向记忆库重复沉淀同一条记忆
      if (existingContents.has(item.content)) continue;
      existingContents.add(item.content);
      const memoryEntry = {
        id: item.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: item.category || 'fact', // preference | project | decision | fact | person
        content: item.content,
        tags: item.tags || [],
        importance: item.importance || 3, // 1 - 5
        createdAt: item.createdAt || new Date().toISOString(),
        sourceSessionId: item.sourceSessionId || null
      };
      memoriesCache.unshift(memoryEntry);
      added.push(memoryEntry);
    }
    scheduleMemoriesFlush();
    return added;
  },

  deleteMemory(id) {
    memoriesCache = memoriesCache.filter(m => m.id !== id);
    scheduleMemoriesFlush();
  },

  flushSync() {
    if (sessionsFlushTimer) clearTimeout(sessionsFlushTimer);
    if (memoriesFlushTimer) clearTimeout(memoriesFlushTimer);
    try {
      writeJsonAtomic(SESSIONS_FILE, sessionsCache);
      writeJsonAtomic(MEMORIES_FILE, memoriesCache);
    } catch (e) {}
  }
};
