
  // =========================================================================
  // 2. DOM 元素检索
  // =========================================================================
  // =========================================================================
  // 2. DOM 元素检索
  // =========================================================================
  const dom = {
    // 导航与主题 (PC端与移动端)
    tabBtns: document.querySelectorAll('.tp-tab-btn'),
    mobileTabBtns: document.querySelectorAll('.tp-mobile-tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    micSelect: document.getElementById('micSelect'),
    memoryCountBadge: document.getElementById('memoryCountBadge'),

    // 实时录音与流 (PC端)
    btnToggleRecord: document.getElementById('btnToggleRecord'),
    btnForceEvolve: document.getElementById('btnForceEvolve'),
    btnDownloadWav: document.getElementById('btnDownloadWav'),
    wsStatusPill: document.getElementById('wsStatusPill'),
    timerBadge: document.getElementById('timerBadge'),
    pcmStatsBadge: document.getElementById('pcmStatsBadge'),
    canvasWaveform: document.getElementById('canvasWaveform'),

    // 实时录音与流 (移动端)
    btnMobileToggleRecord: document.getElementById('btnMobileToggleRecord'),
    btnMobileDownloadWav: document.getElementById('btnMobileDownloadWav'),
    mobileWsStatus: document.getElementById('mobileWsStatus'),
    mobileTimerBadge: document.getElementById('mobileTimerBadge'),
    mobileCanvasWaveform: document.getElementById('mobileCanvasWaveform'),

    // 移动端子分栏控制
    liveSubsegBtns: document.querySelectorAll('.tp-subseg-btn[data-subseg]'),
    minSubsegBtns: document.querySelectorAll('.tp-subseg-btn[data-subseg-min]'),
    colAsr: document.getElementById('col-asr'),
    colWindow: document.getElementById('col-window'),
    colState: document.getElementById('col-state'),
    colMinMain: document.getElementById('col-min-main'),
    colMinRedteam: document.getElementById('col-min-redteam'),

    // 文本流
    interimContainer: document.getElementById('interimContainer'),
    interimText: document.getElementById('interimText'),
    committedList: document.getElementById('committedList'),
    committedCountBadge: document.getElementById('committedCountBadge'),
    windowRangeBadge: document.getElementById('windowRangeBadge'),
    strideProgress: document.getElementById('strideProgress'),
    strideText: document.getElementById('strideText'),
    windowItemsContainer: document.getElementById('windowItemsContainer'),
    fastInsightsFeed: document.getElementById('fastInsightsFeed'),
    inputWindowSize: document.getElementById('inputWindowSize'),
    valWindowSize: document.getElementById('valWindowSize'),
    inputStride: document.getElementById('inputStride'),
    valStride: document.getElementById('valStride'),

    // 全局认知状态 (Tier 3)
    currentTopic: document.getElementById('currentTopic'),
    deltaSummary: document.getElementById('deltaSummary'),
    keyDecisionsList: document.getElementById('keyDecisionsList'),
    actionItemsList: document.getElementById('actionItemsList'),
    unresolvedQuestionsList: document.getElementById('unresolvedQuestionsList'),
    llmStatusBadge: document.getElementById('llmStatusBadge'),
    btnEndAndGenerateMinutes: document.getElementById('btnEndAndGenerateMinutes'),

    // 深度 AI 纪要面板与人设组件
    activePersonaCapsule: document.getElementById('activePersonaCapsule'),
    activePersonaAvatar: document.getElementById('activePersonaAvatar'),
    activePersonaName: document.getElementById('activePersonaName'),
    activePersonaBadge: document.getElementById('activePersonaBadge'),
    activePersonaTitle: document.getElementById('activePersonaTitle'),
    btnOpenPersonaModal: document.getElementById('btnOpenPersonaModal'),
    btnGenerateMinutes: document.getElementById('btnGenerateMinutes'),
    btnGenerateMinutesLabel: document.getElementById('btnGenerateMinutesLabel'),
    btnSyncObsidian: document.getElementById('btnSyncObsidian'),
    obsidianSyncMiniBadge: document.getElementById('obsidianSyncMiniBadge'),
    btnExtractToMemory: document.getElementById('btnExtractToMemory'),
    btnExportMd: document.getElementById('btnExportMd'),
    minutesTitle: document.getElementById('minutesTitle'),
    minutesTldrList: document.getElementById('minutesTldrList'),
    minutesDecisionsList: document.getElementById('minutesDecisionsList'),
    minutesActionList: document.getElementById('minutesActionList'),
    minutesMindmap: document.getElementById('minutesMindmap'),
    minutesRisksList: document.getElementById('minutesRisksList'),
    obsidianSyncedNotice: document.getElementById('obsidianSyncedNotice'),
    minutesEntitiesContainer: document.getElementById('minutesEntitiesContainer'),
    minutesEntitiesList: document.getElementById('minutesEntitiesList'),
    personaSpecialCard: document.getElementById('personaSpecialCard'),
    personaSpecialAvatar: document.getElementById('personaSpecialAvatar'),
    personaSpecialHeader: document.getElementById('personaSpecialHeader'),
    personaSpecialRoleBadge: document.getElementById('personaSpecialRoleBadge'),
    personaSpecialQuoteBox: document.getElementById('personaSpecialQuoteBox'),
    personaSpecialList: document.getElementById('personaSpecialList'),

    // Koboyo 角色人设大选择器弹窗
    personaModal: document.getElementById('personaModal'),
    btnClosePersonaModal: document.getElementById('btnClosePersonaModal'),
    btnCancelPersonaModal: document.getElementById('btnCancelPersonaModal'),
    personaModalGrid: document.getElementById('personaModalGrid'),
    personaModalSelectedName: document.getElementById('personaModalSelectedName'),
    personaModalSelectedBadge: document.getElementById('personaModalSelectedBadge'),
    personaModalSelectedOutput: document.getElementById('personaModalSelectedOutput'),
    btnConfirmPersonaOnly: document.getElementById('btnConfirmPersonaOnly'),
    btnConfirmPersonaAndGenerate: document.getElementById('btnConfirmPersonaAndGenerate'),

    // 深度 AI 纪要多视图切换 (标准纪要 vs 排版润色)
    btnMinutesTabStandard: document.getElementById('btnMinutesTabStandard'),
    btnMinutesTabPolish: document.getElementById('btnMinutesTabPolish'),
    badgePolishDraftReady: document.getElementById('badgePolishDraftReady'),
    viewStandardMinutes: document.getElementById('viewStandardMinutes'),
    viewPolishedDraft: document.getElementById('viewPolishedDraft'),
    polishedDraftContent: document.getElementById('polishedDraftContent'),
    btnCopyPolishedDraft: document.getElementById('btnCopyPolishedDraft'),
    btnBackToStandardMinutes: document.getElementById('btnBackToStandardMinutes'),
    btnPolishDraft: document.getElementById('btnPolishDraft'),

    // Obsidian 知识库与 Hermes 联合问答
    tabObsidian: document.getElementById('tab-obsidian'),
    obsidianNavBadge: document.getElementById('obsidianNavBadge'),
    obsidianStatusBadge: document.getElementById('obsidianStatusBadge'),
    obsidianAgentBackendBadge: document.getElementById('obsidianAgentBackendBadge'),
    obsidianVaultPath: document.getElementById('obsidianVaultPath'),
    obsidianStatsNotes: document.getElementById('obsidianStatsNotes'),
    obsidianVoiceNotesCount: document.getElementById('obsidianVoiceNotesCount'),
    btnSyncCurrentToObsidianDirect: document.getElementById('btnSyncCurrentToObsidianDirect'),
    btnRefreshObsidian: document.getElementById('btnRefreshObsidian'),
    obsidianChatHistory: document.getElementById('obsidianChatHistory'),
    formObsidianAsk: document.getElementById('formObsidianAsk'),
    inputObsidianQuery: document.getElementById('inputObsidianQuery'),
    btnSubmitObsidianAsk: document.getElementById('btnSubmitObsidianAsk'),
    obsidianSyncedList: document.getElementById('obsidianSyncedList'),
    obsidianEntitiesList: document.getElementById('obsidianEntitiesList'),
    checkAutoWriteBack: document.getElementById('checkAutoWriteBack'),
    activeWriteBackTargetBadge: document.getElementById('activeWriteBackTargetBadge'),
    btnClearObsidianChat: document.getElementById('btnClearObsidianChat'),
    suggestionChips: document.querySelectorAll('.tp-suggestion-chip'),

    // 长期记忆第二大脑 (3/4 记忆卡片 : 1/4 Agent 对话，带可拖动分界线)
    tabMemory: document.getElementById('tab-memory'),
    memoryWorkspace: document.getElementById('memoryWorkspace'),
    memoryLeftPanel: document.getElementById('memoryLeftPanel'),
    memorySplitter: document.getElementById('memorySplitter'),
    memoryRightPanel: document.getElementById('memoryRightPanel'),
    btnResetMemoryRatio: document.getElementById('btnResetMemoryRatio'),
    memoryRatioBadge: document.getElementById('memoryRatioBadge'),
    memoryCountBadge: document.getElementById('memoryCountBadge'),
    headerMemoryCountBadge: document.getElementById('headerMemoryCountBadge'),
    navMemoryCountBadge: document.getElementById('navMemoryCountBadge'),
    btnMobileMemoryCards: document.getElementById('btnMobileMemoryCards'),
    btnMobileMemoryAgent: document.getElementById('btnMobileMemoryAgent'),
    inputSearchMemories: document.getElementById('inputSearchMemories'),
    selectMemorySort: document.getElementById('selectMemorySort'),
    filterBtns: document.querySelectorAll('.tp-filter-btn'),
    memoryGrid: document.getElementById('memoryGrid'),
    btnShowAddMemoryModal: document.getElementById('btnShowAddMemoryModal'),
    addMemoryModal: document.getElementById('addMemoryModal'),
    btnCloseAddMemory: document.getElementById('btnCloseAddMemory'),
    btnCancelAddMemory: document.getElementById('btnCancelAddMemory'),
    btnConfirmAddMemory: document.getElementById('btnConfirmAddMemory'),
    modalMemoryCategory: document.getElementById('modalMemoryCategory'),
    modalMemoryContent: document.getElementById('modalMemoryContent'),
    modalMemoryTags: document.getElementById('modalMemoryTags'),

    // 第二大脑 Agent 对话
    brainChatHistory: document.getElementById('brainChatHistory'),
    brainShelfContainer: document.getElementById('brainShelfContainer'),
    formBrainAsk: document.getElementById('formBrainAsk'),
    inputBrainQuestion: document.getElementById('inputBrainQuestion'),
    btnAskBrain: document.getElementById('btnAskBrain'),
    btnClearBrainChat: document.getElementById('btnClearBrainChat'),
    btnNewBrainChat: document.getElementById('btnNewBrainChat'),
    agentRefBadge: document.getElementById('agentRefBadge'),

    // 档案
    sessionsGrid: document.getElementById('sessionsGrid'),
    archiveCountBadge: document.getElementById('archiveCountBadge'),
    btnRefreshSessions: document.getElementById('btnRefreshSessions')
  };

  const canvasCtx = dom.canvasWaveform ? dom.canvasWaveform.getContext('2d') : null;
  const mobileCanvasCtx = dom.mobileCanvasWaveform ? dom.mobileCanvasWaveform.getContext('2d') : null;
