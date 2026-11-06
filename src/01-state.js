// public/app.js - TP Space · Voice Brain 核心控制器与多维度 AI 引擎
document.addEventListener('DOMContentLoaded', async () => {

  // =========================================================================
  // 1. 全局状态 (State Management)
  // =========================================================================
  const state = {
    sessionId: 'sess-' + Date.now(),
    currentTemplate: 'engineering',
    isRecording: false,
    recordSeconds: 0,
    recordTimer: null,
    recorder: null,
    ws: null,
    currentVolume: 0,
    
    // Tier 1 & 2 对话流
    utterances: [],
    lastProcessedIndex: 0,
    windowSize: 15,
    stride: 10,
    overlap: 5,
    isLlmProcessing: false,

    // Tier 3 全局状态
    globalState: {
      current_topic: "等待开讲...",
      key_decisions: [],
      action_items: [],
      unresolved_questions: [],
      delta_summary: "暂无演进"
    },

    // 结构化深度纪要
    currentMinutes: null,

    // 长期记忆库缓存
    memories: [],
    memoryFilterCategory: 'all',

    // 历史会话档案
    sessions: [],

    // Koboyo 角色人设系统
    selectedPersona: localStorage.getItem('tp_voice_persona') || 'detective',
    personaModalDraft: localStorage.getItem('tp_voice_persona') || 'detective',

    // Obsidian 知识库与问答 (左右分栏 3/4 与 1/4)
    obsidianStatus: null,
    obsidianChatHistory: [],
    obsidianSplitRatio: parseFloat(localStorage.getItem('tp_obsidian_split_ratio')) || 75,
    activeVaultNotePath: '00-入口/LMMWiki-Index.md',
    activeVaultCategory: 'voice',
    rawNoteMarkdown: '',
    memorySplitRatio: parseFloat(localStorage.getItem('tp_memory_split_ratio')) || 75,
    memorySearchQuery: '',
    brainChatHistory: [],
    currentPolishedDraft: ''
  };
