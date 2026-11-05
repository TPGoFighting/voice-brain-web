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

  // =========================================================================
  // 3. 主题系统 (匹配 tpgofighting.top 昼夜切换，对齐 tp-theme.js 标准契约)
  // =========================================================================
  function initTheme() {
    const saved = localStorage.getItem('tp-theme') || document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tp-theme', theme);
    dom.themeIcon.innerHTML = theme === 'dark' ? Icons.moon : Icons.sun;
  }

  dom.btnThemeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
  initTheme();

  // =========================================================================
  // 4. Tab 导航切换 (同步桌面顶部与移动端底部栏)
  // =========================================================================
  function switchTab(targetId) {
    dom.tabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
    });
    dom.mobileTabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
    });
    dom.tabPanes.forEach(p => {
      p.classList.toggle('hidden', p.id !== targetId);
    });

    if (targetId === 'tab-memory') loadMemories();
    if (targetId === 'tab-archive') loadSessions();
  }

  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  dom.mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // 移动端子分栏切换 (Live 工作台)
  const subsegPanes = {
    'subseg-asr': dom.colAsr,
    'subseg-window': dom.colWindow,
    'subseg-state': dom.colState
  };

  dom.liveSubsegBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.liveSubsegBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-subseg');
      Object.keys(subsegPanes).forEach(k => {
        if (subsegPanes[k]) {
          subsegPanes[k].classList.toggle('subseg-active', k === target);
        }
      });
    });
  });

  // 移动端子分栏切换 (Minutes 纪要)
  const subsegMinPanes = {
    'subseg-min-main': dom.colMinMain,
    'subseg-min-redteam': dom.colMinRedteam
  };

  dom.minSubsegBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.minSubsegBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-subseg-min');
      Object.keys(subsegMinPanes).forEach(k => {
        if (subsegMinPanes[k]) {
          subsegMinPanes[k].classList.toggle('subseg-active', k === target);
        }
      });
    });
  });

  // 断句停顿灵敏度控制 (500ms 紧凑 / 800ms 标准 / 1200ms 防抢断)
  const selectSilence = document.getElementById('selectSentenceSilence');
  const mobileSelectSilence = document.getElementById('mobileSelectSentenceSilence');
  const initialSilence = localStorage.getItem('voice_sentence_silence') || '800';
  if (selectSilence) selectSilence.value = initialSilence;
  if (mobileSelectSilence) mobileSelectSilence.value = initialSilence;

  function onSilenceChange(val) {
    localStorage.setItem('voice_sentence_silence', val);
    if (selectSilence) selectSilence.value = val;
    if (mobileSelectSilence) mobileSelectSilence.value = val;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'config',
        maxSentenceSilence: parseInt(val, 10)
      }));
    }
  }

  if (selectSilence) selectSilence.addEventListener('change', (e) => onSilenceChange(e.target.value));
  if (mobileSelectSilence) mobileSelectSilence.addEventListener('change', (e) => onSilenceChange(e.target.value));

  // =========================================================================
  // 5. 音频设备检测与波形绘制
  // =========================================================================
  async function loadAudioDevices() {
    const devices = await AudioStreamRecorder.getAudioDevices();
    dom.micSelect.innerHTML = '<option value="">默认麦克风 (Default Mic)</option>';
    devices.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `音频输入设备 ${idx + 1}`;
      if (d.label.toLowerCase().includes('dji') || d.label.toLowerCase().includes('wireless')) {
        opt.textContent = `${opt.textContent} [推荐]`;
        opt.selected = true;
      }
      dom.micSelect.appendChild(opt);
    });
  }
  loadAudioDevices();

  function drawWaveform() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const strokeStyle = state.isRecording ? (isDark ? '#38bdf8' : '#f59e0b') : (isDark ? '#334155' : '#9ca3af');

    // 桌面端波形
    if (canvasCtx && dom.canvasWaveform) {
      canvasCtx.clearRect(0, 0, dom.canvasWaveform.width, dom.canvasWaveform.height);
      const w = dom.canvasWaveform.width;
      const h = dom.canvasWaveform.height;
      const centerY = h / 2;

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = strokeStyle;
      canvasCtx.beginPath();

      const bars = 44;
      const barWidth = w / bars;
      const now = Date.now() / 180;

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        const wave = Math.sin(now + i * 0.35) * (state.currentVolume * (h * 0.48));
        const barHeight = state.isRecording ? Math.max(3, wave) : 2;
        canvasCtx.moveTo(x + barWidth / 2, centerY - barHeight);
        canvasCtx.lineTo(x + barWidth / 2, centerY + barHeight);
      }
      canvasCtx.stroke();
    }

    // 移动端波形
    if (mobileCanvasCtx && dom.mobileCanvasWaveform) {
      mobileCanvasCtx.clearRect(0, 0, dom.mobileCanvasWaveform.width, dom.mobileCanvasWaveform.height);
      const mw = dom.mobileCanvasWaveform.width;
      const mh = dom.mobileCanvasWaveform.height;
      const mCenterY = mh / 2;

      mobileCanvasCtx.lineWidth = 2;
      mobileCanvasCtx.strokeStyle = strokeStyle;
      mobileCanvasCtx.beginPath();

      const mBars = 22;
      const mBarWidth = mw / mBars;
      const mNow = Date.now() / 180;

      for (let i = 0; i < mBars; i++) {
        const x = i * mBarWidth;
        const wave = Math.sin(mNow + i * 0.45) * (state.currentVolume * (mh * 0.48));
        const barHeight = state.isRecording ? Math.max(2, wave) : 2;
        mobileCanvasCtx.moveTo(x + mBarWidth / 2, mCenterY - barHeight);
        mobileCanvasCtx.lineTo(x + mBarWidth / 2, mCenterY + barHeight);
      }
      mobileCanvasCtx.stroke();
    }

    requestAnimationFrame(drawWaveform);
  }
  drawWaveform();

  // =========================================================================
  // 6. 录音会话与 WebSocket 流处理 (Tier 1 & Tier 2)
  // =========================================================================
  function updateRecordingUI(status) {
    if (status === 'connecting') {
      dom.btnToggleRecord.disabled = true;
      dom.btnToggleRecord.innerHTML = `${Icons.spinner}<span>正在建立 ASR 连接...</span>`;
      if (dom.btnMobileToggleRecord) {
        dom.btnMobileToggleRecord.disabled = true;
        dom.btnMobileToggleRecord.innerHTML = `${Icons.spinner}<span>连接中...</span>`;
      }
    } else if (status === 'recording') {
      dom.btnToggleRecord.disabled = false;
      dom.btnToggleRecord.className = 'tp-btn tp-btn-danger w-full py-2.5 text-xs font-extrabold shadow-[2.5px_2.5px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
      dom.btnToggleRecord.innerHTML = `${Icons.stop}<span>停止录音并固化 (Stop Session)</span>`;
      if (dom.btnMobileToggleRecord) {
        dom.btnMobileToggleRecord.disabled = false;
        dom.btnMobileToggleRecord.className = 'tp-btn tp-btn-danger flex-1 py-2 text-xs font-black shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
        dom.btnMobileToggleRecord.innerHTML = `${Icons.stop}<span>停止录音</span>`;
      }
      dom.wsStatusPill.className = 'tp-badge tp-badge-green';
      dom.wsStatusPill.textContent = '流已就绪';
      if (dom.mobileWsStatus) {
        dom.mobileWsStatus.className = 'tp-badge tp-badge-green text-[10px]';
        dom.mobileWsStatus.textContent = '流就绪';
      }
    } else if (status === 'idle') {
      if (dom.interimContainer) dom.interimContainer.classList.add('hidden');
      if (dom.interimText) dom.interimText.textContent = '';
      dom.btnToggleRecord.disabled = false;
      dom.btnToggleRecord.className = 'tp-btn tp-btn-primary w-full py-2.5 text-xs font-extrabold shadow-[2.5px_2.5px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
      dom.btnToggleRecord.innerHTML = `${Icons.mic}<span>开始实时录音 (Start Recording)</span>`;
      if (dom.btnMobileToggleRecord) {
        dom.btnMobileToggleRecord.disabled = false;
        dom.btnMobileToggleRecord.className = 'tp-btn tp-btn-primary flex-1 py-2 text-xs font-black shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
        dom.btnMobileToggleRecord.innerHTML = `${Icons.mic}<span>开始录音</span>`;
      }
      dom.wsStatusPill.className = 'tp-badge';
      dom.wsStatusPill.textContent = '未连接';
      if (dom.mobileWsStatus) {
        dom.mobileWsStatus.className = 'tp-badge text-[10px]';
        dom.mobileWsStatus.textContent = '未连接';
      }
      dom.timerBadge.textContent = '00:00';
      if (dom.mobileTimerBadge) dom.mobileTimerBadge.textContent = '00:00';
    } else if (status === 'error') {
      dom.btnToggleRecord.disabled = false;
      dom.btnToggleRecord.className = 'tp-btn tp-btn-primary w-full py-2.5 text-xs font-extrabold shadow-[2.5px_2.5px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
      dom.btnToggleRecord.innerHTML = `${Icons.mic}<span>开始实时录音 (Start Recording)</span>`;
      if (dom.btnMobileToggleRecord) {
        dom.btnMobileToggleRecord.disabled = false;
        dom.btnMobileToggleRecord.className = 'tp-btn tp-btn-primary flex-1 py-2 text-xs font-black shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center space-x-1.5';
        dom.btnMobileToggleRecord.innerHTML = `${Icons.mic}<span>开始录音</span>`;
      }
      dom.wsStatusPill.className = 'tp-badge tp-badge-yellow';
      dom.wsStatusPill.textContent = '连接异常';
      if (dom.mobileWsStatus) {
        dom.mobileWsStatus.className = 'tp-badge tp-badge-yellow text-[10px]';
        dom.mobileWsStatus.textContent = '异常';
      }
    }
  }

  // 统一导出无损 WAV 文件（支持移动端 Web Share API 与 PC 浏览器下载）
  async function triggerExportWav() {
    let blob = null;
    if (state.recorder && typeof state.recorder.exportWavBlob === 'function') {
      try {
        blob = state.recorder.exportWavBlob();
      } catch (e) {}
    }
    if (!blob && state.lastWavBlob) {
      blob = state.lastWavBlob;
    }
    if (!blob || blob.size <= 44) {
      alert('暂无音频数据！请先进行录音。');
      return;
    }

    const filename = `voice_brain_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    const fallbackDownload = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    // 移动端优先唤起原生系统分享或保存对话框
    try {
      const file = new File([blob], filename, { type: 'audio/wav' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'TP Voice Brain 录音导出',
          text: 'TP Voice Brain 无损 16kHz WAV 录音文件'
        });
        return;
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') return;
      console.warn('Web Share API 未响应，降级至浏览器下载:', shareErr);
    }

    fallbackDownload();
  }

  dom.btnToggleRecord.addEventListener('click', async () => {
    if (!state.isRecording) {
      await startRecordingSession();
    } else {
      await stopRecordingSession();
    }
  });

  if (dom.btnMobileToggleRecord) {
    dom.btnMobileToggleRecord.addEventListener('click', async () => {
      if (!state.isRecording) {
        await startRecordingSession();
      } else {
        await stopRecordingSession();
      }
    });
  }

  if (dom.btnDownloadWav) {
    dom.btnDownloadWav.addEventListener('click', triggerExportWav);
  }
  if (dom.btnMobileDownloadWav) {
    dom.btnMobileDownloadWav.addEventListener('click', triggerExportWav);
  }

  async function startRecordingSession() {
    try {
      updateRecordingUI('connecting');

      state.sessionId = 'sess-' + Date.now();
      state.wsRetryCount = 0;
      state.ws = connectAsrSocket(state.sessionId);
    } catch (err) {
      alert('启动麦克风录音异常: ' + (err.message || err.name || '请检查麦克风权限'));
      updateRecordingUI('error');
    }
  }

  function connectAsrSocket(sessionId, { resumeRecording = false } = {}) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/asr`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = async () => {
      state.wsRetryCount = 0;
        const silenceThreshold = parseInt(localStorage.getItem('voice_sentence_silence') || '800', 10);
      ws.send(JSON.stringify({
          type: 'start',
        sessionId,
          maxSentenceSilence: silenceThreshold
        }));

      // 断线重连时复用正在运行的录音器，仅重建 ASR 通道，计时器保持不变
      if (resumeRecording && state.recorder) {
        updateRecordingUI('recording');
        return;
      }

        state.recorder = new AudioStreamRecorder({
          onChunk: (chunk) => {
          if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(chunk);
            updatePcmStats();
          }
          },
          onVolume: (vol) => {
            state.currentVolume = vol;
          }
        });

      await state.recorder.start(dom.micSelect.value || null);
      loadAudioDevices();

      state.isRecording = true;
      updateRecordingUI('recording');

      state.recordSeconds = 0;
      if (state.recordTimer) clearInterval(state.recordTimer);
      state.recordTimer = setInterval(() => {
        state.recordSeconds++;
        const m = String(Math.floor(state.recordSeconds / 60)).padStart(2, '0');
        const s = String(state.recordSeconds % 60).padStart(2, '0');
        dom.timerBadge.textContent = `${m}:${s}`;
        if (dom.mobileTimerBadge) dom.mobileTimerBadge.textContent = `${m}:${s}`;
      }, 1000);
      };

    ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleAsrMessage(msg);
        } catch (e) {
          console.error('WS parse error:', e);
        }
    };

    ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
    };

    ws.onclose = () => {
      if (!state.isRecording) {
        updateRecordingUI('idle');
        return;
      }
      state.wsRetryCount = (state.wsRetryCount || 0) + 1;
      if (state.wsRetryCount > 5) {
        state.isRecording = false;
        if (state.recordTimer) clearInterval(state.recordTimer);
        if (state.recorder) {
          try { state.recorder.stop(); } catch (e) {}
        }
        console.warn('[ASR] WebSocket 连续重连失败，已自动停止录音');
        updateRecordingUI('error');
        return;
      }
      updateRecordingUI('connecting');
      setTimeout(() => {
        if (state.isRecording) {
          state.ws = connectAsrSocket(state.sessionId, { resumeRecording: true });
        }
      }, 1000);
    };

    return ws;
  }

  async function stopRecordingSession() {
    state.isRecording = false;
    state.currentVolume = 0;
    if (state.recordTimer) clearInterval(state.recordTimer);
    if (state.wsPingTimer) {
      clearInterval(state.wsPingTimer);
      state.wsPingTimer = null;
    }

    if (state.recorder) {
      try {
        state.lastWavBlob = state.recorder.exportWavBlob();
      } catch (e) {}
      state.recorder.stop();
    }
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'stop' }));
      setTimeout(() => { if (state.ws) state.ws.close(); }, 500);
    }

    updateRecordingUI('idle');
    const liveRow = document.getElementById('liveStreamingRow');
    if (liveRow) liveRow.remove();

    // 录音结束，持久化保存该会话
    saveCurrentSessionToDatabase();

    // 第三层 deepseek-flash: 自动模式 (单次连续录音超 100 字且停止录音后异步执行语义沉淀)
    const totalChars = state.utterances.reduce((acc, u) => acc + (u.text ? u.text.length : 0), 0);
    if (totalChars >= 100) {
      console.log(`[Tier 3 Auto] 单次连续录音字数 (${totalChars} 字) 超过 100 字阈值，自动触发 deepseek-flash 认知沉淀`);
      triggerSlidingWindowEvolution();
    } else if (state.utterances.length > state.lastProcessedIndex) {
      triggerSlidingWindowEvolution();
    }
  }

  const pendingCleansingTimers = new Map();
  let llmBackgroundIdleTimer = null;

  function scheduleBackgroundCognitiveEvolution() {
    if (llmBackgroundIdleTimer) clearTimeout(llmBackgroundIdleTimer);
    // 仅在用户短暂停顿（1.5秒）后，异步旁路触发快轨洞察与滑动窗口，绝不在快速连续讲话时抢占 CPU
    llmBackgroundIdleTimer = setTimeout(() => {
      if (state.utterances.length > 0) {
        const lastUtt = state.utterances[state.utterances.length - 1];
        checkFastTrackInsight([lastUtt]);
        checkMemoryCorrelation(lastUtt.text);
      }
      const unprocessed = state.utterances.length - state.lastProcessedIndex;
      if (unprocessed >= state.stride && !state.isLlmProcessing) {
        triggerSlidingWindowEvolution();
      }
    }, 1500);
  }

  function ensureLiveStreamingRow() {
    let row = document.getElementById('liveStreamingRow');
    if (!row) {
      const emptyState = dom.committedList.querySelector('.text-center');
      if (emptyState) emptyState.remove();

      row = document.createElement('div');
      row.id = 'liveStreamingRow';
      row.className = 'tp-transcript-row rounded-lg border-2 border-[var(--accent-blue)] bg-[var(--bg-card)] transition-all p-2.5 space-y-1 flex flex-col w-full shadow-sm';
      row.innerHTML = `
        <div class="flex items-center justify-between text-[10px] w-full">
          <div class="flex items-center space-x-1.5 font-mono">
            <span class="tp-badge tp-badge-green text-[8px] animate-pulse">实时采集</span>
            <span class="text-[var(--text-title)] font-bold">发言人 (实时感知)</span>
          </div>
          <div class="flex items-center space-x-1 text-[9px] text-[var(--accent-blue)] font-bold font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>流式出字中</span>
          </div>
        </div>
        <p id="liveStreamingText" class="text-xs sm:text-sm text-[var(--accent-blue)] leading-relaxed font-semibold break-words">...</p>
      `;
      dom.committedList.appendChild(row);
    }
    return row;
  }

  function handleAsrMessage(msg) {
    if (msg.type === 'asr_started') {
      dom.interimContainer.classList.remove('hidden');
      dom.interimText.textContent = '感知层实时出字流就绪，请说话...';
      const liveRow = ensureLiveStreamingRow();
      liveRow.classList.remove('hidden');
      const liveText = document.getElementById('liveStreamingText');
      if (liveText) liveText.textContent = '实时拾音就绪，请开始说话...';

      if (dom.wsStatusPill) {
        dom.wsStatusPill.textContent = '双工就绪';
        dom.wsStatusPill.className = 'tp-badge tp-badge-green text-[9px] font-mono';
      }
      if (dom.mobileWsStatus) {
        dom.mobileWsStatus.textContent = '双工就绪';
        dom.mobileWsStatus.className = 'tp-badge tp-badge-green text-[9px] font-mono';
      }
    } else if (msg.type === 'asr_reconnecting') {
      dom.interimContainer.classList.remove('hidden');
      dom.interimText.textContent = msg.message || 'ASR 引擎自动平滑续接中，音频持续采集中...';
      if (dom.wsStatusPill) {
        dom.wsStatusPill.textContent = '平滑续连中';
        dom.wsStatusPill.className = 'tp-badge tp-badge-yellow text-[9px] font-mono';
      }
      if (dom.mobileWsStatus) {
        dom.mobileWsStatus.textContent = '平滑续连中';
        dom.mobileWsStatus.className = 'tp-badge tp-badge-yellow text-[9px] font-mono';
      }
    } else if (msg.type === 'pong') {
      // 心跳存活确认，无操作
      return;
    } else if (msg.type === 'asr_error') {
      console.warn('[ASR Warning]', msg.code, msg.message);
    } else if (msg.type === 'asr_interim') {
      const liveRow = ensureLiveStreamingRow();
      liveRow.classList.remove('hidden');
      const liveText = document.getElementById('liveStreamingText');
      if (liveText && msg.text) liveText.textContent = msg.text;

      dom.interimContainer.classList.remove('hidden');
      dom.interimText.textContent = msg.text || '';
      dom.committedList.scrollTop = dom.committedList.scrollHeight;
    } else if (msg.type === 'asr_committed') {
      if (!msg.text || !msg.text.trim()) return;

      const sentenceId = msg.sentenceId || ('sent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
      const newUtterance = {
        id: state.utterances.length + 1,
        sentenceId: sentenceId,
        speaker: '发言人',
        time: new Date().toLocaleTimeString(),
        text: msg.text.trim(),
        rawText: msg.text.trim(),
        isCleansed: false
      };
      state.utterances.push(newUtterance);

      appendCommittedItem(newUtterance);
      updateSlidingWindowUI();

      // 实时出字行原地复位等待下一句，绝无闪烁跳变
      const liveText = document.getElementById('liveStreamingText');
      if (liveText) liveText.innerHTML = '<span class="text-[var(--text-muted)] italic font-normal">聆听下一句中...</span>';
      dom.interimText.textContent = '聆听下一句中...';
      dom.committedList.scrollTop = dom.committedList.scrollHeight;

      // 熔断与降级机制：如果网络抖动导致 qwen-flash 超过 500ms 没返回，UI 直接保留并展示 ASR 原始文字
      const timer = setTimeout(() => {
        const badge = document.getElementById(`status-badge-${sentenceId}`);
        if (badge && !badge.dataset.cleansed) {
          badge.textContent = 'ASR 定稿';
          badge.className = 'tp-badge tp-badge-blue text-[8px] font-mono';
        }
        pendingCleansingTimers.delete(sentenceId);
      }, 500);
      pendingCleansingTimers.set(sentenceId, timer);

      // 慢轨与快轨采用轻量级防抖调度，说话不间断时不发多余 HTTP 请求
      scheduleBackgroundCognitiveEvolution();
    } else if (msg.type === 'sentence_cleansed') {
      // 第二层 qwen-flash 原地快修返回
      const sentenceId = msg.sentenceId;
      if (pendingCleansingTimers.has(sentenceId)) {
        clearTimeout(pendingCleansingTimers.get(sentenceId));
        pendingCleansingTimers.delete(sentenceId);
      }

      // 光标防跳动与局部替换 (Flicker Control): 只替换当前闭合的句段，绝不全量重刷历史文本
      const textEl = document.getElementById(`sentence-text-${sentenceId}`);
      const badgeEl = document.getElementById(`status-badge-${sentenceId}`);
      if (textEl && msg.cleansed) {
        textEl.textContent = msg.cleansed;
        if (badgeEl) {
          badgeEl.dataset.cleansed = 'true';
          badgeEl.textContent = `qwen-flash 快修 (${msg.latencyMs || 0}ms)`;
          badgeEl.className = 'tp-badge tp-badge-green text-[8px] font-mono';
        }
      }

      // 同步更新内存中的对应语句
      const targetUtt = state.utterances.find(u => u.sentenceId === sentenceId);
      if (targetUtt && msg.cleansed) {
        targetUtt.text = msg.cleansed;
        targetUtt.isCleansed = true;
      }
    }
  }

  function appendCommittedItem(u) {
    dom.committedCountBadge.textContent = `${state.utterances.length} 句`;

    // 移除等待输入的空状态占位
    const emptyState = dom.committedList.querySelector('.text-center');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.id = `sentence-item-${u.sentenceId}`;
    item.className = 'tp-transcript-row rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] transition-colors p-2.5 space-y-1.5 flex flex-col w-full';
    item.innerHTML = `
      <div class="flex items-center justify-between text-[10px] w-full">
        <div class="flex items-center space-x-1.5 font-mono">
          <span class="tp-badge tp-badge-yellow text-[8px]">#${u.id}</span>
          <time class="text-[var(--text-muted)]">${escapeHtml(u.time)}</time>
          <span class="text-[var(--text-title)] font-bold">${escapeHtml(u.speaker)}</span>
        </div>
        <span id="status-badge-${u.sentenceId}" class="tp-badge tp-badge-blue text-[8px] font-mono">ASR 定稿</span>
      </div>
      <p id="sentence-text-${u.sentenceId}" class="tp-sentence-text text-xs sm:text-sm text-[var(--text-title)] leading-relaxed font-medium block w-full">${escapeHtml(u.text)}</p>
    `;

    const liveRow = document.getElementById('liveStreamingRow');
    if (liveRow && liveRow.parentNode === dom.committedList) {
      dom.committedList.insertBefore(item, liveRow);
    } else {
      dom.committedList.appendChild(item);
    }
    dom.committedList.scrollTop = dom.committedList.scrollHeight;
  }

  // =========================================================================
  // 7. 滑动窗口与快轨副驾 (Sliding Window & Fast Track)
  // =========================================================================
  dom.inputWindowSize.addEventListener('input', (e) => {
    state.windowSize = parseInt(e.target.value, 10);
    dom.valWindowSize.textContent = state.windowSize;
    updateSlidingWindowUI();
  });
  dom.inputStride.addEventListener('input', (e) => {
    state.stride = parseInt(e.target.value, 10);
    dom.valStride.textContent = state.stride;
    updateSlidingWindowUI();
  });

  dom.btnForceEvolve.addEventListener('click', () => {
    if (state.utterances.length === 0) {
      alert('请先开始录音并讲话！');
      return;
    }
    triggerSlidingWindowEvolution();
  });

  function updateSlidingWindowUI() {
    const total = state.utterances.length;
    const unprocessed = total - state.lastProcessedIndex;
    const progressPercent = Math.min(100, Math.round((unprocessed / state.stride) * 100));

    dom.strideProgress.style.width = `${progressPercent}%`;
    dom.strideText.textContent = `${unprocessed} / ${state.stride} 句 (步长演进)`;

    const endIndex = total;
    const startIndex = Math.max(0, endIndex - state.windowSize);
    dom.windowRangeBadge.textContent = total > 0 ? `[#${startIndex + 1} ~ #${endIndex}]` : `[未激活]`;

    dom.windowItemsContainer.innerHTML = '';
    const slice = state.utterances.slice(startIndex, endIndex);
    slice.forEach((u, i) => {
      const isOverlap = (startIndex + i) < state.lastProcessedIndex;
      const tag = document.createElement('div');
      tag.className = `text-[11px] px-2 py-1 rounded border flex items-center justify-between ${
        isOverlap 
          ? 'bg-[var(--accent-yellow-light)] border-[var(--accent-yellow)] text-amber-900' 
          : 'bg-[var(--accent-blue-light)] border-[var(--accent-blue)] text-blue-900'
      }`;
      tag.innerHTML = `
        <span class="truncate pr-2 font-medium"><b>#${u.id}</b>: ${escapeHtml(u.text)}</span>
        <span class="text-[9px] uppercase font-bold shrink-0">${isOverlap ? '重叠' : '增量'}</span>
      `;
      dom.windowItemsContainer.appendChild(tag);
    });
    dom.windowItemsContainer.scrollTop = dom.windowItemsContainer.scrollHeight;
  }

  async function triggerSlidingWindowEvolution() {
    if (state.isLlmProcessing || state.utterances.length === 0) return;

    state.isLlmProcessing = true;
    dom.llmStatusBadge.className = 'tp-badge tp-badge-yellow animate-pulse';
    dom.llmStatusBadge.textContent = '慢轨演进中...';

    const endIndex = state.utterances.length;
    const startIndex = Math.max(0, endIndex - state.windowSize);
    const activeWindow = state.utterances.slice(startIndex, endIndex);

    try {
      const res = await fetch('/api/llm/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalState: state.globalState,
          activeWindow: activeWindow
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        state.globalState = json.data;
        state.lastProcessedIndex = endIndex;
        renderGlobalCognitiveState();
      }
    } catch (err) {
      console.error('演进失败:', err);
    } finally {
      state.isLlmProcessing = false;
      dom.llmStatusBadge.className = 'tp-badge font-mono text-[10px]';
      dom.llmStatusBadge.textContent = '就绪';
      updateSlidingWindowUI();
    }
  }

  async function checkFastTrackInsight(recent) {
    try {
      const res = await fetch('/api/llm/fast-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentUtterances: recent,
          currentTopic: state.globalState.current_topic
        })
      });
      const data = await res.json();
      if (data.has_insight) {
        appendFastInsight(data);
      }
    } catch (e) {
      console.warn('Fast track error:', e);
    }
  }

  function appendFastInsight(insight) {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-lg border-1.5 border-[var(--border-main)] bg-[var(--bg-card)] shadow-[2px_2px_0px_var(--border-main)] text-xs flex flex-col space-y-1';
    let icon = `${Icons.lightbulb} <span>概念速览</span>`;
    if (insight.insight_type === 'action') icon = `${Icons.checklist} <span>实时捕获待办</span>`;
    if (insight.insight_type === 'question') icon = `${Icons.help} <span>决策问询</span>`;

    card.innerHTML = `
      <div class="flex items-center justify-between font-extrabold text-[var(--text-title)]">
        <span class="flex items-center space-x-1.5">${icon}: ${escapeHtml(insight.title || '')}</span>
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="text-[var(--text-body)] leading-relaxed">${escapeHtml(insight.content || '')}</div>
    `;
    dom.fastInsightsFeed.prepend(card);
  }

  async function checkMemoryCorrelation(text) {
    try {
      const res = await fetch('/api/memory/correlate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentText: text })
      });
      const data = await res.json();
      if (data.has_correlation) {
        appendFastInsight({
          insight_type: 'term',
          title: '长期记忆触发',
          content: `${data.reason}: “${data.memory_content}”`
        });
      }
    } catch (e) {}
  }

  function renderGlobalCognitiveState() {
    const s = state.globalState;
    dom.currentTopic.textContent = s.current_topic || '等待开讲...';
    dom.deltaSummary.textContent = s.delta_summary || '本轮无显著推进';

    // 决策
    dom.keyDecisionsList.innerHTML = '';
    (s.key_decisions || []).forEach(dec => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-body)] flex items-start space-x-2';
      li.innerHTML = `<span class="shrink-0 mt-0.5">${Icons.check}</span><span>${escapeHtml(dec)}</span>`;
      dom.keyDecisionsList.appendChild(li);
    });
    if ((s.key_decisions || []).length === 0) {
      dom.keyDecisionsList.innerHTML = `<div class="text-xs text-[var(--text-muted)] italic">暂无固定决策结论</div>`;
    }

    // 待办
    dom.actionItemsList.innerHTML = '';
    (s.action_items || []).forEach(item => {
      const li = document.createElement('li');
      const isDone = item.status === 'done';
      li.className = `p-2 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs flex items-center justify-between space-x-2 ${isDone ? 'opacity-50 line-through' : ''}`;
      li.innerHTML = `
        <label class="flex items-center space-x-2 cursor-pointer flex-1">
          <input type="checkbox" ${isDone ? 'checked' : ''} class="rounded text-[var(--accent-blue)]">
          <span class="text-[var(--text-body)]">${escapeHtml(item.task)}</span>
        </label>
        <span class="tp-badge text-[10px]">${escapeHtml(item.assignee || '待定')}</span>
      `;
      const chk = li.querySelector('input');
      chk.addEventListener('change', () => {
        item.status = chk.checked ? 'done' : 'pending';
        li.classList.toggle('opacity-50', chk.checked);
        li.classList.toggle('line-through', chk.checked);
      });
      dom.actionItemsList.appendChild(li);
    });
    if ((s.action_items || []).length === 0) {
      dom.actionItemsList.innerHTML = `<div class="text-xs text-[var(--text-muted)] italic">暂无分配待办</div>`;
    }

    // 疑问
    dom.unresolvedQuestionsList.innerHTML = '';
    (s.unresolved_questions || []).forEach(q => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded bg-[var(--accent-yellow-light)] border border-[var(--accent-yellow)] text-xs text-amber-900 flex items-start space-x-2';
      li.innerHTML = `<span class="shrink-0 mt-0.5">${Icons.help}</span><span>${escapeHtml(q)}</span>`;
      dom.unresolvedQuestionsList.appendChild(li);
    });
    if ((s.unresolved_questions || []).length === 0) {
      dom.unresolvedQuestionsList.innerHTML = `<div class="text-xs text-[var(--text-muted)] italic">暂无开放疑问</div>`;
    }
  }

  let lastPcmStatUpdate = 0;
  function updatePcmStats() {
    const now = Date.now();
    if (now - lastPcmStatUpdate < 350) return;
    lastPcmStatUpdate = now;
    if (!state.recorder) return;
    const kb = (state.recorder.totalBytesSent / 1024).toFixed(1);
    dom.pcmStatsBadge.textContent = `${state.recorder.totalChunksSent} 帧 (${kb} KB)`;
  }



  // =========================================================================
  // 8. Koboyo 角色人设系统与深度 AI 纪要 (Persona-Driven Minutes & LMMWiki)
  // =========================================================================
  function getPersonaConfig(personaId) {
    const chars = Icons.koboyoCharacters || [];
    return chars.find(c => c.id === personaId) || chars[0] || {
      id: 'detective',
      name: '红队侦探',
      title: '反方拷问官',
      personaTitle: '挑刺审计官 · 攻击性安全与漏洞审查',
      badgeClass: 'tp-badge-rose',
      motto: '没有天衣无缝的工程方案，只有还没发现的边缘盲区。',
      signatureOutput: '红队极客审查与盲区漏洞警示'
    };
  }

  function updateActivePersonaCapsule(personaId) {
    const char = getPersonaConfig(personaId);
    state.selectedPersona = char.id;
    localStorage.setItem('tp_voice_persona', char.id);

    if (dom.activePersonaAvatar) {
      dom.activePersonaAvatar.innerHTML = Icons.koboyo(char.id, 'w-5 h-5 sm:w-6 sm:h-6');
    }
    if (dom.activePersonaName) {
      dom.activePersonaName.textContent = char.name;
    }
    if (dom.activePersonaBadge) {
      dom.activePersonaBadge.textContent = char.title;
      dom.activePersonaBadge.className = `tp-badge ${char.badgeClass} text-[9px] font-bold`;
    }
    if (dom.activePersonaTitle) {
      dom.activePersonaTitle.textContent = char.personaTitle || char.styleDesc;
    }
    if (dom.btnGenerateMinutesLabel) {
      dom.btnGenerateMinutesLabel.textContent = `以「${char.name}」视角生成纪要`;
    }
  }

  // 渲染角色人设大选择器弹窗 (10 位手绘小人)
  function renderPersonaModalCards() {
    if (!dom.personaModalGrid) return;
    const characters = Icons.koboyoCharacters || [];
    dom.personaModalGrid.innerHTML = '';

    characters.forEach(char => {
      const isSelected = char.id === state.personaModalDraft;
      const card = document.createElement('div');
      card.className = `tp-persona-card tp-card p-3 sm:p-3.5 cursor-pointer transition-all duration-200 flex flex-col justify-between border-1.5 ${
        isSelected
          ? 'border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] bg-[var(--bg-subtle)] ring-2 ring-[var(--accent-purple)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-main)] bg-[var(--bg-card)] hover:-translate-y-0.5'
      }`;
      card.setAttribute('data-persona-id', char.id);

      const avatarHtml = Icons.koboyo(char.id, 'w-10 h-10 sm:w-12 sm:h-12');
      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="tp-badge ${char.badgeClass} text-[9px] font-bold">${char.title}</span>
            ${isSelected ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--accent-purple)] text-white font-bold">当前已选</span>' : ''}
          </div>
          <div class="flex items-center space-x-2.5">
            <div class="w-12 h-12 rounded-xl ${char.cardAccent} border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              ${avatarHtml}
            </div>
            <div>
              <h4 class="font-extrabold text-xs sm:text-sm text-[var(--text-title)]">${char.name}</h4>
              <p class="text-[9px] text-[var(--text-muted)] line-clamp-1">${char.personaTitle || ''}</p>
            </div>
          </div>
          <p class="text-[10px] text-[var(--text-muted)] italic leading-snug pt-1 border-t border-[var(--border-subtle)]">
            ${char.motto}
          </p>
        </div>
        <div class="mt-2.5 pt-2 border-t border-[var(--border-subtle)] space-y-1 text-[10px]">
          <div class="text-[var(--text-body)]"><span class="font-bold text-[var(--text-title)]">视角:</span> ${char.styleDesc || ''}</div>
          <div class="text-[var(--accent-purple)] font-medium truncate"><span class="font-bold">产物:</span> ${char.signatureOutput || ''}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        state.personaModalDraft = char.id;
        updatePersonaModalSelection(char);
        renderPersonaModalCards();
      });

      dom.personaModalGrid.appendChild(card);
    });
  }

  function updatePersonaModalSelection(char) {
    if (dom.personaModalSelectedName) dom.personaModalSelectedName.textContent = char.name;
    if (dom.personaModalSelectedBadge) {
      dom.personaModalSelectedBadge.textContent = char.title;
      dom.personaModalSelectedBadge.className = `tp-badge ${char.badgeClass} text-[10px]`;
    }
    if (dom.personaModalSelectedOutput) {
      dom.personaModalSelectedOutput.textContent = `专属产物：${char.signatureOutput || char.title}`;
    }
  }

  function openPersonaModal() {
    state.personaModalDraft = state.selectedPersona;
    const char = getPersonaConfig(state.personaModalDraft);
    updatePersonaModalSelection(char);
    renderPersonaModalCards();
    if (dom.personaModal) dom.personaModal.classList.remove('hidden');
  }

  function closePersonaModal() {
    if (dom.personaModal) dom.personaModal.classList.add('hidden');
  }

  // 事件监听器绑定：人设胶囊与弹窗
  if (dom.activePersonaCapsule) dom.activePersonaCapsule.addEventListener('click', openPersonaModal);
  if (dom.btnOpenPersonaModal) dom.btnOpenPersonaModal.addEventListener('click', openPersonaModal);
  if (dom.btnClosePersonaModal) dom.btnClosePersonaModal.addEventListener('click', closePersonaModal);
  if (dom.btnCancelPersonaModal) dom.btnCancelPersonaModal.addEventListener('click', closePersonaModal);

  if (dom.btnConfirmPersonaOnly) {
    dom.btnConfirmPersonaOnly.addEventListener('click', () => {
      updateActivePersonaCapsule(state.personaModalDraft);
      closePersonaModal();
    });
  }

  if (dom.btnConfirmPersonaAndGenerate) {
    dom.btnConfirmPersonaAndGenerate.addEventListener('click', () => {
      updateActivePersonaCapsule(state.personaModalDraft);
      closePersonaModal();
      generateStructuredMinutes();
    });
  }

  dom.btnEndAndGenerateMinutes.addEventListener('click', () => {
    const minutesTabBtn = document.querySelector('[data-tab="tab-minutes"]');
    if (minutesTabBtn) minutesTabBtn.click();
    generateStructuredMinutes();
  });

  dom.btnGenerateMinutes.addEventListener('click', generateStructuredMinutes);

  async function generateStructuredMinutes() {
    if (state.utterances.length === 0) {
      alert('请先进行录音，产生转写文本后再生成纪要！');
      return;
    }

    const persona = getPersonaConfig(state.selectedPersona);
    dom.btnGenerateMinutes.disabled = true;
    dom.btnGenerateMinutes.innerHTML = `${Icons.spinner}<span>「${persona.name}」正在提炼纪要...</span>`;

    try {
      const res = await fetch('/api/llm/generate-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          utterances: state.utterances,
          persona: state.selectedPersona,
          customTitle: state.globalState.current_topic,
          duration: state.recordSeconds
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        state.currentMinutes = json.data;
        if (json.sessionId) state.sessionId = json.sessionId;
        renderMinutesView(json.data);
        saveCurrentSessionToDatabase();

        // 自动静默同步至 Obsidian Vault & LMMWiki 知识库
        if (json.autoSynced && json.obsidianNotePath) {
          state.activeVaultNotePath = json.obsidianNotePath;
          if (dom.obsidianAutoSyncBadge) {
            dom.obsidianAutoSyncBadge.classList.remove('hidden');
          }
          if (dom.obsidianAutoSyncPath) {
            dom.obsidianAutoSyncPath.textContent = json.obsidianNotePath;
          }
          if (dom.activeWriteBackTargetBadge) {
            dom.activeWriteBackTargetBadge.textContent = json.obsidianNotePath;
          }
          if (dom.obsidianSyncedNotice) {
            dom.obsidianSyncedNotice.classList.remove('hidden');
          }
          loadObsidianStatus();
          loadObsidianVaultData();
        }

        // 自动沉淀记忆：后端静默提炼返回后即刻刷新第二大脑
        if (json.autoMemories && json.autoMemories.length > 0) {
          loadMemories();
        }
      } else {
        alert('生成纪要失败: ' + (json.error || '未知错误'));
      }
    } catch (err) {
      alert('请求错误: ' + err.message);
    } finally {
      dom.btnGenerateMinutes.disabled = false;
      dom.btnGenerateMinutes.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>以「${persona.name}」视角生成纪要</span>`;
    }
  }

  function renderMinutesView(m) {
    dom.minutesTitle.textContent = m.title || '会议纪要总结';
    const persona = m.persona || getPersonaConfig(m.persona_id || state.selectedPersona);

    // 渲染人设专属产物卡片 (Special Section)
    if (dom.personaSpecialCard) {
      if (dom.personaSpecialAvatar) {
        dom.personaSpecialAvatar.innerHTML = Icons.koboyo(persona.id, 'w-5 h-5 sm:w-6 sm:h-6');
      }
      if (dom.personaSpecialHeader) {
        dom.personaSpecialHeader.textContent = m.special_section?.title || persona.signatureOutput || `${persona.name}专属审查`;
      }
      if (dom.personaSpecialRoleBadge) {
        dom.personaSpecialRoleBadge.textContent = persona.name;
        dom.personaSpecialRoleBadge.className = `tp-badge ${persona.badgeClass || 'tp-badge-rose'} text-[9px] ml-1 font-bold`;
      }
      if (dom.personaSpecialQuoteBox) {
        dom.personaSpecialQuoteBox.innerHTML = `“${escapeHtml(m.special_section?.summary || persona.motto)}”`;
      }
      if (dom.personaSpecialList) {
        dom.personaSpecialList.innerHTML = '';
        const items = m.special_section?.items || [];
        if (items.length > 0) {
          items.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-0.5 text-xs';
            if (typeof item === 'string') {
              li.innerHTML = `<span class="font-bold text-[var(--text-title)]">${idx + 1}.</span> <span>${escapeHtml(item)}</span>`;
            } else {
              li.innerHTML = `
                <div class="font-bold text-[var(--text-title)] flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)]"></span>
                  <span>${escapeHtml(item.title || `要点 ${idx + 1}`)}</span>
                </div>
                <div class="text-[11px] text-[var(--text-body)] pl-2.5 leading-relaxed">${escapeHtml(item.desc || '')}</div>
              `;
            }
            dom.personaSpecialList.appendChild(li);
          });
        } else {
          dom.personaSpecialList.innerHTML = '<li class="italic text-[var(--text-muted)] text-[11px]">本场讨论未产生专属警示项</li>';
        }
      }
    }

    // 30秒 TL;DR
    dom.minutesTldrList.innerHTML = '';
    (m.tldr || []).forEach(point => {
      const li = document.createElement('li');
      li.className = 'flex items-start space-x-2';
      li.innerHTML = `<span class="mt-1 text-[var(--accent-yellow)]">${Icons.dot}</span><span>${escapeHtml(point)}</span>`;
      dom.minutesTldrList.appendChild(li);
    });

    // 决策
    dom.minutesDecisionsList.innerHTML = '';
    (m.decisions || []).forEach(d => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-body)] flex items-start space-x-1.5';
      li.innerHTML = `<span class="shrink-0 mt-0.5 text-[var(--accent-green)]">${Icons.check}</span><span>${escapeHtml(d)}</span>`;
      dom.minutesDecisionsList.appendChild(li);
    });

    // 待办
    dom.minutesActionList.innerHTML = '';
    (m.action_items || []).forEach(a => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-body)] flex items-center justify-between';
      li.innerHTML = `
        <span class="flex-1 pr-2">${escapeHtml(a.task)}</span>
        <div class="flex items-center space-x-1 shrink-0">
          <span class="tp-badge tp-badge-blue text-[9px]">${escapeHtml(a.assignee || '待定')}</span>
          <span class="tp-badge tp-badge-yellow text-[9px]">${escapeHtml(a.priority || 'P1')}</span>
        </div>
      `;
      dom.minutesActionList.appendChild(li);
    });

    // LMMWiki 知识实体网络
    if (dom.minutesEntitiesList) {
      dom.minutesEntitiesList.innerHTML = '';
      const entities = m.lmm_wiki_entities || [];
      if (entities.length > 0) {
        entities.forEach(ent => {
          const card = document.createElement('div');
          card.className = 'p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1';
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-mono font-bold text-[11px] text-[var(--accent-purple)]">[[${escapeHtml(ent.name)}]]</span>
              <span class="tp-badge tp-badge-purple text-[8px]">${escapeHtml(ent.category || '概念')}</span>
            </div>
            <p class="text-[10px] text-[var(--text-muted)] line-clamp-2 leading-tight">${escapeHtml(ent.description || '')}</p>
          `;
          dom.minutesEntitiesList.appendChild(card);
        });
      } else {
        dom.minutesEntitiesList.innerHTML = '<div class="col-span-full text-[var(--text-muted)] italic text-[11px]">本场讨论无额外抽取实体</div>';
      }
    }

    // 思维导图
    dom.minutesMindmap.textContent = m.mindmap_markdown || '无思维导图内容';

    // 风险
    if (dom.minutesRisksList) {
      dom.minutesRisksList.innerHTML = '';
      (m.unresolved_risks || []).forEach(r => {
        const li = document.createElement('li');
        li.className = 'p-1.5 rounded bg-[var(--bg-subtle)] text-xs flex items-start space-x-1.5';
        li.innerHTML = `<span class="mt-1 text-[var(--accent-yellow)]">${Icons.dot}</span><span>${escapeHtml(r)}</span>`;
        dom.minutesRisksList.appendChild(li);
      });
    }

    // 状态提醒
    if (dom.obsidianSyncedNotice) {
      const isSynced = state.currentSession?.syncedToObsidian;
      dom.obsidianSyncedNotice.classList.toggle('hidden', !isSynced);
    }
  }

  // =========================================================================
  // 9. Obsidian Vault & LMMWiki 同步与智能问答联动
  // =========================================================================
  async function syncCurrentSessionToObsidian() {
    if (state.utterances.length === 0) {
      alert('请先录音产生会话，并生成纪要后再同步至 Obsidian Vault！');
      return;
    }

    const btn = dom.btnSyncObsidian;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${Icons.spinner}<span>正在同步至 Vault...</span>`;
    }

    try {
      const currentSessionData = {
        id: state.sessionId,
        title: state.currentMinutes?.title || state.globalState.current_topic || '未命名讨论',
        topic: state.globalState.current_topic,
        delta_summary: state.globalState.delta_summary,
        utterances: state.utterances,
        minutes: state.currentMinutes,
        decisions: state.globalState.key_decisions,
        action_items: state.globalState.action_items,
        memories: state.memories.filter(m => m.sourceSessionId === state.sessionId),
        duration: state.recordSeconds
      };

      const res = await fetch('/api/obsidian/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          session: currentSessionData,
          personaId: state.selectedPersona
        })
      });

      const data = await res.json();
      if (data.ok) {
        alert(`已成功同步到 Obsidian Vault！\n\n文件路径: ${data.relativePath}\n关联知识实体: ${data.entitiesCreated?.join(', ') || '无'}\nFTS5/向量索引: ${data.reindexSuccess ? '增量重索引就绪' : '后台更新中'}`);
        if (dom.obsidianSyncedNotice) dom.obsidianSyncedNotice.classList.remove('hidden');
        loadObsidianStatus();
      } else {
        alert('同步失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      alert('同步请求异常: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10M6 14h6"/></svg><span>同步至 Obsidian</span><span id="obsidianSyncMiniBadge" class="text-[9px] px-1 rounded bg-black/20 text-white font-mono">LMMWiki</span>`;
      }
    }
  }

  if (dom.btnSyncObsidian) dom.btnSyncObsidian.addEventListener('click', syncCurrentSessionToObsidian);
  if (dom.btnSyncCurrentToObsidianDirect) dom.btnSyncCurrentToObsidianDirect.addEventListener('click', syncCurrentSessionToObsidian);

  if (dom.btnViewSyncedNote) {
    dom.btnViewSyncedNote.addEventListener('click', () => {
      const obsTabBtn = document.querySelector('[data-tab="tab-obsidian"]');
      if (obsTabBtn) obsTabBtn.click();
      if (state.activeVaultNotePath) {
        loadVaultNote(state.activeVaultNotePath);
      }
    });
  }
  if (dom.obsidianAutoSyncPath) {
    dom.obsidianAutoSyncPath.addEventListener('click', () => {
      const obsTabBtn = document.querySelector('[data-tab="tab-obsidian"]');
      if (obsTabBtn) obsTabBtn.click();
      if (state.activeVaultNotePath) {
        loadVaultNote(state.activeVaultNotePath);
      }
    });
  }

  // 初始化自动反向写回开关状态 (默认开启，记住用户设置)
  if (dom.checkAutoWriteBack) {
    const savedAutoWb = localStorage.getItem('tp_obsidian_autowriteback');
    dom.checkAutoWriteBack.checked = savedAutoWb === null ? true : (savedAutoWb === 'true');
    dom.checkAutoWriteBack.addEventListener('change', () => {
      localStorage.setItem('tp_obsidian_autowriteback', dom.checkAutoWriteBack.checked ? 'true' : 'false');
    });
  }

  // =========================================================================
  // 9. Obsidian Vault (3/4 知识库 : 1/4 AI对话 左右拖动分栏) & LMMWiki 联动
  // =========================================================================

  // 1. 读取 Vault 归档列表与实体网络并渲染到右侧 5 列
  async function loadObsidianVaultData() {
    try {
      const res = await fetch('/api/obsidian/list');
      const data = await res.json();
      if (data.ok) {
        // 渲染已沉淀至 Vault 的录音材料
        if (dom.obsidianSyncedList) {
          dom.obsidianSyncedList.innerHTML = '';
          const voiceNotes = data.voiceNotes || [];
          if (voiceNotes.length === 0) {
            dom.obsidianSyncedList.innerHTML = `<div class="text-[var(--text-muted)] italic text-[11px] p-2">尚未同步录音材料，可在纪要页面点击“同步至 Obsidian”</div>`;
          } else {
            voiceNotes.forEach(vn => {
              const item = document.createElement('div');
              item.className = 'p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-main)] transition-colors space-y-1';
              item.innerHTML = `
                <div class="flex items-center justify-between">
                  <div class="font-bold text-[var(--text-title)] text-xs truncate max-w-[190px]" title="${escapeHtml(vn.title)}">${escapeHtml(vn.title)}</div>
                  <span class="tp-badge tp-badge-blue text-[8px] font-mono">${escapeHtml(vn.updatedAt ? vn.updatedAt.slice(0, 10) : '')}</span>
                </div>
                <div class="text-[9px] text-[var(--text-muted)] font-mono truncate">${escapeHtml(vn.path)}</div>
                <div class="flex items-center space-x-1.5 pt-0.5">
                  <button type="button" class="tp-btn text-[9px] py-0.5 px-1.5 btn-ask-about-note font-medium" data-path="${escapeHtml(vn.path)}" data-title="${escapeHtml(vn.title)}">对此录音提问</button>
                  <button type="button" class="tp-btn text-[9px] py-0.5 px-1.5 btn-writeback-target" data-path="${escapeHtml(vn.path)}">设为写回目标</button>
                </div>
              `;
              item.querySelector('.btn-ask-about-note').addEventListener('click', () => {
                if (dom.inputObsidianQuery) {
                  dom.inputObsidianQuery.value = `请结合录音笔记 [[${vn.title}]]，梳理其中的核心争议点与待办事项`;
                  dom.inputObsidianQuery.focus();
                }
              });
              item.querySelector('.btn-writeback-target').addEventListener('click', () => {
                state.activeVaultNotePath = vn.path;
                if (dom.activeWriteBackTargetBadge) dom.activeWriteBackTargetBadge.textContent = vn.path;
                alert(`已将思考写回目标设定为: ${vn.path}`);
              });
              dom.obsidianSyncedList.appendChild(item);
            });
          }
        }

        // 渲染 LMMWiki 活跃实体与双向链接
        if (dom.obsidianEntitiesList) {
          dom.obsidianEntitiesList.innerHTML = '';
          const entities = data.wikiEntities || [];
          if (entities.length === 0) {
            dom.obsidianEntitiesList.innerHTML = `<div class="text-[var(--text-muted)] italic text-[11px] p-2">同步录音后将自动提取核心技术实体，并生成双向反向链接</div>`;
          } else {
            entities.forEach(ent => {
              const item = document.createElement('div');
              item.className = 'p-1.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-main)] flex items-center justify-between text-xs cursor-pointer transition-all';
              item.innerHTML = `
                <div class="flex items-center space-x-1.5 truncate">
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)] shrink-0"></span>
                  <span class="font-bold text-[var(--text-title)] truncate">[[${escapeHtml(ent.title || ent.name)}]]</span>
                </div>
                <span class="text-[9px] text-[var(--text-muted)] font-mono shrink-0">LMMWiki</span>
              `;
              item.addEventListener('click', () => {
                if (dom.inputObsidianQuery) {
                  dom.inputObsidianQuery.value = `知识库中关于 [[${ent.title || ent.name}]] 的核心定义、关联方案与历史记录是什么？`;
                  dom.inputObsidianQuery.focus();
                }
              });
              dom.obsidianEntitiesList.appendChild(item);
            });
          }
        }
      }
    } catch (err) {
      console.warn('loadObsidianVaultData error:', err);
    }
  }

  // 2. 富 Markdown 渲染器 (支持 Obsidian Callouts, [[Wikilinks]], Checkboxes, Lists, Tables)
  function renderObsidianMarkdown(md) {
    if (!md) return '<div class="text-[var(--text-muted)] italic p-2">空白内容</div>';

    let html = escapeHtml(md);

    // 块级引用行
    html = html.replace(/^&gt;\s*(.*)$/gim, '<div class="border-l-2 border-[var(--accent-yellow)] pl-2.5 my-1 text-[var(--text-body)] bg-[var(--bg-subtle)] py-0.5 rounded-r text-xs italic">$1</div>');

    // 标题解析 (#, ##, ###)
    html = html
      .replace(/^### (.*$)/gim, '<h3 class="font-bold text-xs sm:text-sm text-[var(--text-title)] mt-2.5 mb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="font-black text-sm sm:text-base text-[var(--text-title)] mt-3 mb-1.5 pb-0.5 border-b border-[var(--border-subtle)]">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="font-black text-base sm:text-lg text-[var(--text-title)] mt-3.5 mb-2 pb-1 border-b-2 border-[var(--border-main)]">$1</h1>');

    // 点击式 Wikilinks: [[path|label]] 或 [[path]]
    html = html.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (match, linkPath, label) => {
      const displayText = label || linkPath;
      return `<a href="#" class="tp-wikilink font-bold text-[var(--accent-purple)] bg-[var(--accent-purple)]/10 px-1 py-0.5 rounded border border-[var(--accent-purple)]/30 hover:underline cursor-pointer" data-wikilink="${escapeHtml(linkPath)}">[[${escapeHtml(displayText)}]]</a>`;
    });

    // 粗体、斜体、列表、分割线
    html = html
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-extrabold text-[var(--text-title)]">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc my-0.5 text-xs text-[var(--text-body)]">$1</li>')
      .replace(/^---$/gim, '<hr class="my-3 border-[var(--border-subtle)]">');

    // 换行与段落
    html = html.replace(/\n\n/gim, '<div class="h-2"></div>').replace(/\n/gim, '<br>');

    return html;
  }

  // 3. 第三层认知任务：排版润色 (Polish Draft) 与双视图切换
  if (dom.btnPolishDraft) {
    dom.btnPolishDraft.addEventListener('click', async () => {
      if (state.utterances.length === 0) {
        alert('尚无录音逐字稿，请先录制后再进行排版润色！');
        return;
      }
      const fullText = state.utterances.map(u => `${u.speaker} (${u.time}): ${u.text}`).join('\n');
      dom.btnPolishDraft.disabled = true;
      dom.btnPolishDraft.innerHTML = `${Icons.spinner}<span>排版润色中...</span>`;

      try {
        const res = await fetch('/api/llm/polish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText })
        });
        const data = await res.json();
        if (data.ok && data.draft) {
          state.currentPolishedDraft = data.draft;
          const minutesTabBtn = document.querySelector('[data-tab="tab-minutes"]');
          if (minutesTabBtn) minutesTabBtn.click();

          // 渲染富 Markdown 内容到专属卡片，不破坏左侧 30s TL;DR 与决策清单
          if (dom.polishedDraftContent) {
            dom.polishedDraftContent.innerHTML = renderObsidianMarkdown(data.draft);
          }
          if (dom.badgePolishDraftReady) {
            dom.badgePolishDraftReady.classList.remove('hidden');
          }
          showPolishedDraftView();
        } else {
          alert('润色失败: ' + (data.error || '未知错误'));
        }
      } catch (err) {
        alert('润色异常: ' + err.message);
      } finally {
        dom.btnPolishDraft.disabled = false;
        dom.btnPolishDraft.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4-12 12H6v-4L18 2z"/><path d="m15 5 4 4"/></svg><span>排版润色</span>`;
      }
    });
  }

  function showPolishedDraftView() {
    if (dom.viewStandardMinutes) dom.viewStandardMinutes.classList.add('hidden');
    if (dom.viewPolishedDraft) dom.viewPolishedDraft.classList.remove('hidden');
    if (dom.btnMinutesTabStandard) {
      dom.btnMinutesTabStandard.className = 'tp-btn text-xs py-1 px-2.5 bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-title)]';
    }
    if (dom.btnMinutesTabPolish) {
      dom.btnMinutesTabPolish.className = 'tp-btn text-xs py-1 px-2.5 font-bold bg-[var(--accent-yellow)] text-slate-900 border-1.5 border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]';
    }
  }

  function showStandardMinutesView() {
    if (dom.viewPolishedDraft) dom.viewPolishedDraft.classList.add('hidden');
    if (dom.viewStandardMinutes) dom.viewStandardMinutes.classList.remove('hidden');
    if (dom.btnMinutesTabStandard) {
      dom.btnMinutesTabStandard.className = 'tp-btn text-xs py-1 px-2.5 font-bold bg-[var(--accent-yellow)] text-slate-900 border-1.5 border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]';
    }
    if (dom.btnMinutesTabPolish) {
      dom.btnMinutesTabPolish.className = 'tp-btn text-xs py-1 px-2.5 bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-title)]';
    }
  }

  if (dom.btnMinutesTabStandard) dom.btnMinutesTabStandard.addEventListener('click', showStandardMinutesView);
  if (dom.btnMinutesTabPolish) dom.btnMinutesTabPolish.addEventListener('click', showPolishedDraftView);
  if (dom.btnBackToStandardMinutes) dom.btnBackToStandardMinutes.addEventListener('click', showStandardMinutesView);

  if (dom.btnCopyPolishedDraft) {
    dom.btnCopyPolishedDraft.addEventListener('click', () => {
      if (!state.currentPolishedDraft) {
        alert('暂无排版润色内容可复制！');
        return;
      }
      navigator.clipboard.writeText(state.currentPolishedDraft).then(() => {
        alert('正式汇报排版草稿已复制到剪贴板！');
      }).catch(() => {
        alert('复制失败，请手动选择复制');
      });
    });
  }

  // 4. 第二大脑左右分栏 (3/4 记忆卡片 : 1/4 Agent 对话) 拖动条控制器
  function initMemorySplitter() {
    if (!dom.memorySplitter || !dom.memoryLeftPanel || !dom.memoryRightPanel || !dom.memoryWorkspace) return;

    let isDragging = false;

    function applyRatio(ratio) {
      const clamped = Math.max(25, Math.min(85, ratio));
      state.memorySplitRatio = clamped;
      dom.memoryLeftPanel.style.width = `${clamped}%`;
      dom.memoryRightPanel.style.width = `${100 - clamped}%`;
      if (dom.memoryRatioBadge) {
        dom.memoryRatioBadge.textContent = `比例: ${Math.round(clamped)}% : ${Math.round(100 - clamped)}%`;
      }
    }

    applyRatio(state.memorySplitRatio || 75);

    function startDrag(e) {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.classList.add('select-none');
    }

    function onDrag(e) {
      if (!isDragging) return;
      const rect = dom.memoryWorkspace.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      if (!clientX || rect.width <= 0) return;
      const offsetX = clientX - rect.left;
      const ratio = (offsetX / rect.width) * 100;
      applyRatio(ratio);
    }

    function stopDrag() {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.classList.remove('select-none');
        localStorage.setItem('tp_memory_split_ratio', state.memorySplitRatio || 75);
      }
    }

    dom.memorySplitter.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);

    dom.memorySplitter.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', onDrag, { passive: true });
    window.addEventListener('touchend', stopDrag);

    // 双击重置为 75% : 25% (3/4 : 1/4)
    dom.memorySplitter.addEventListener('dblclick', () => {
      applyRatio(75);
      localStorage.setItem('tp_memory_split_ratio', 75);
    });
    if (dom.btnResetMemoryRatio) {
      dom.btnResetMemoryRatio.addEventListener('click', () => {
        applyRatio(75);
        localStorage.setItem('tp_memory_split_ratio', 75);
      });
    }

    // 移动端子切换胶囊
    if (dom.btnMobileMemoryCards && dom.btnMobileMemoryAgent) {
      dom.btnMobileMemoryCards.addEventListener('click', () => {
        dom.btnMobileMemoryCards.classList.add('active');
        dom.btnMobileMemoryAgent.classList.remove('active');
        if (dom.memoryLeftPanel) {
          dom.memoryLeftPanel.classList.remove('hidden');
          dom.memoryLeftPanel.classList.add('subseg-active');
          dom.memoryLeftPanel.style.width = '100%';
        }
        if (dom.memoryRightPanel) {
          dom.memoryRightPanel.classList.add('hidden');
          dom.memoryRightPanel.classList.remove('subseg-active');
        }
      });

      dom.btnMobileMemoryAgent.addEventListener('click', () => {
        dom.btnMobileMemoryAgent.classList.add('active');
        dom.btnMobileMemoryCards.classList.remove('active');
        if (dom.memoryRightPanel) {
          dom.memoryRightPanel.classList.remove('hidden');
          dom.memoryRightPanel.classList.add('subseg-active');
          dom.memoryRightPanel.style.width = '100%';
        }
        if (dom.memoryLeftPanel) {
          dom.memoryLeftPanel.classList.add('hidden');
          dom.memoryLeftPanel.classList.remove('subseg-active');
        }
      });
    }
  }

  // 5. 清空 Obsidian 聊天历史
  if (dom.btnClearObsidianChat) {
    dom.btnClearObsidianChat.addEventListener('click', () => {
      state.obsidianChatHistory = [];
      if (dom.obsidianChatHistory) {
        dom.obsidianChatHistory.innerHTML = `
          <div class="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
            <div class="flex items-center space-x-1 font-bold text-[var(--accent-purple)]">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <span>Obsidian 知识库问答助手已就绪</span>
            </div>
            <p class="text-[var(--text-title)] leading-relaxed text-[11px]">
              直接输入问题，模型将结合语音会话逐字稿、提炼的人设纪要以及知识库原文给出精准回答。
            </p>
          </div>
        `;
      }
    });
  }

  async function loadObsidianStatus() {
    try {
      const res = await fetch('/api/obsidian/status');
      const json = await res.json();
      if (json.ok && json.data) {
        state.obsidianStatus = json.data;
        const d = json.data;
        if (dom.obsidianVaultPath) dom.obsidianVaultPath.textContent = d.vaultPath;
        if (dom.obsidianVoiceNotesCount) dom.obsidianVoiceNotesCount.textContent = `录音归档: ${d.voiceNotesCount} 篇`;
        if (dom.obsidianStatusBadge) {
          dom.obsidianStatusBadge.textContent = d.vaultExists ? 'Vault 在线' : '本地镜像模式';
          dom.obsidianStatusBadge.className = `tp-badge ${d.vaultExists ? 'tp-badge-green' : 'tp-badge-yellow'} text-[9px] font-mono`;
        }
        if (dom.obsidianStatsNotes && d.agentStatus) {
          const notes = d.agentStatus.notes || 6522;
          const chunks = d.agentStatus.chunks || 60101;
          dom.obsidianStatsNotes.textContent = `${notes.toLocaleString()} 篇笔记 · ${chunks.toLocaleString()} 向量`;
        }
      }
    } catch (err) {
      console.warn('loadObsidianStatus notice:', err);
    }
  }

  if (dom.btnRefreshObsidian) {
    dom.btnRefreshObsidian.addEventListener('click', () => {
      loadObsidianStatus();
      loadObsidianVaultData();
      alert('已触发刷新 Obsidian Vault 索引与归档列表');
    });
  }

  // 知识库问答交互
  if (dom.formObsidianAsk) {
    dom.formObsidianAsk.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = dom.inputObsidianQuery.value.trim();
      if (!query) return;

      appendObsidianChatMessage('user', query);
      dom.inputObsidianQuery.value = '';
      dom.btnSubmitObsidianAsk.disabled = true;

      const isAutoWriteBack = dom.checkAutoWriteBack ? dom.checkAutoWriteBack.checked : false;
      const targetNote = state.activeVaultNotePath || '00-入口/LMMWiki-Index.md';

      const loadingMsgEl = appendObsidianChatMessage('assistant', '正在检索 Obsidian 6,500+ 篇笔记与录音材料...', true);

      try {
        const res = await fetch('/api/obsidian/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            history: state.obsidianChatHistory.slice(-6),
            targetNotePath: targetNote,
            autoWriteBack: isAutoWriteBack
          })
        });

        const data = await res.json();
        loadingMsgEl.remove();

        if (data.ok) {
          appendObsidianChatMessage('assistant', data.answer, false, data.sources, data.backend, query, data.writtenBack, data.writeBackPath || targetNote);
          state.obsidianChatHistory.push({ role: 'user', content: query });
          state.obsidianChatHistory.push({ role: 'assistant', content: data.answer });

          // 若开启了自动写回且写回成功，即时重新加载左侧笔记并更新反馈
          if (data.writtenBack) {
            if (dom.writeBackStatusFeedback) {
              dom.writeBackStatusFeedback.classList.remove('hidden');
              setTimeout(() => { dom.writeBackStatusFeedback.classList.add('hidden'); }, 3500);
            }
            loadVaultNote(data.writeBackPath || targetNote);
          }
        } else {
          appendObsidianChatMessage('assistant', '问答出错: ' + (data.error || '未知异常'));
        }
      } catch (err) {
        loadingMsgEl.remove();
        appendObsidianChatMessage('assistant', '请求失败: ' + err.message);
      } finally {
        dom.btnSubmitObsidianAsk.disabled = false;
      }
    });
  }

  function appendObsidianChatMessage(role, text, isLoading = false, sources = [], backend = '', query = '', wasWrittenBack = false, writtenBackPath = '') {
    if (!dom.obsidianChatHistory) return null;
    const msgDiv = document.createElement('div');
    msgDiv.className = `p-2.5 rounded-lg border text-xs space-y-1.5 ${
      role === 'user'
        ? 'bg-[var(--accent-purple)]/10 border-[var(--accent-purple)]/30 text-[var(--text-title)]'
        : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-body)]'
    }`;

    const roleName = role === 'user' ? '你' : (backend === 'hermes' ? 'Hermes Agent · Obsidian' : 'Obsidian 助手');
    const roleBadge = role === 'user' ? 'tp-badge-blue' : 'tp-badge-purple';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
      sourcesHtml = `
        <div class="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[10px] space-y-1">
          <div class="font-bold text-[var(--text-title)] flex items-center space-x-1">
            <svg class="w-3 h-3 text-[var(--accent-purple)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
            <span>引用知识库来源 (${sources.length}):</span>
          </div>
          <div class="space-y-1">
            ${sources.map(s => `
              <div class="tp-citation-card p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-purple)] cursor-pointer truncate transition-colors" data-path="${escapeHtml(s.path)}" title="点击在左侧查看该笔记">
                <div class="font-bold text-[var(--text-title)] text-[11px] truncate flex items-center space-x-1">
                  <span class="text-[var(--accent-purple)] font-mono">[[</span>
                  <span class="truncate">${escapeHtml(s.title || s.path)}</span>
                  <span class="text-[var(--accent-purple)] font-mono">]]</span>
                </div>
                <div class="text-[9px] text-[var(--text-muted)] truncate">${escapeHtml(s.path)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let writeBackActionHtml = '';
    if (role === 'assistant' && !isLoading) {
      const targetPath = state.activeVaultNotePath || '00-入口/LMMWiki-Index.md';
      writeBackActionHtml = `
        <div class="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] gap-1">
          <div class="truncate flex items-center space-x-1">
            <span class="tp-wb-badge ${wasWrittenBack ? 'inline-flex' : 'hidden'} tp-badge tp-badge-green text-[9px] font-mono truncate">
              已追加至: [[${escapeHtml(writtenBackPath || targetPath)}]]
            </span>
          </div>
          <button class="tp-btn-write-back tp-btn text-[10px] py-0.5 px-2 flex items-center space-x-1 shrink-0 ${wasWrittenBack ? 'opacity-70 bg-[var(--bg-card)]' : 'tp-btn-secondary'}" data-written="${wasWrittenBack ? '1' : '0'}">
            <svg class="w-3 h-3 text-[var(--accent-purple)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>${wasWrittenBack ? '已追加写回' : '反向追加写回当前笔记'}</span>
          </button>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="flex items-center space-x-1.5 font-bold">
        <span class="tp-badge ${roleBadge} text-[8px]">${roleName}</span>
        ${isLoading ? `<span class="text-[10px] text-[var(--accent-purple)] animate-pulse">${Icons.spinner} 检索并推理中...</span>` : ''}
      </div>
      <div class="leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</div>
      ${sourcesHtml}
      ${writeBackActionHtml}
    `;

    // 绑定来源卡片点击事件：在左侧查看正文
    msgDiv.querySelectorAll('.tp-citation-card').forEach(card => {
      card.addEventListener('click', () => {
        const p = card.getAttribute('data-path');
        if (p) {
          loadVaultNote(p);
          if (dom.btnMobileObsidianVault) dom.btnMobileObsidianVault.click();
        }
      });
    });

    // 绑定反向追加写回按钮事件
    const btnWb = msgDiv.querySelector('.tp-btn-write-back');
    if (btnWb) {
      btnWb.addEventListener('click', async () => {
        const targetPath = state.activeVaultNotePath || '00-入口/LMMWiki-Index.md';
        btnWb.disabled = true;
        btnWb.innerHTML = `${Icons.spinner}<span>写回中...</span>`;
        try {
          const appendRes = await fetch('/api/obsidian/append', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notePath: targetPath,
              query: query || '知识库深度研判',
              answer: text,
              sources: sources || [],
              agentBackend: backend || 'hermes'
            })
          });
          const appendData = await appendRes.json();
          if (appendData.ok) {
            btnWb.innerHTML = `<svg class="w-3 h-3 text-[var(--accent-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>已成功追加写回</span>`;
            btnWb.classList.add('opacity-70');
            const badge = msgDiv.querySelector('.tp-wb-badge');
            if (badge) {
              badge.textContent = `已追加至: [[${appendData.relativePath || targetPath}]]`;
              badge.classList.remove('hidden');
            }
            if (dom.writeBackStatusFeedback) {
              dom.writeBackStatusFeedback.classList.remove('hidden');
              setTimeout(() => { dom.writeBackStatusFeedback.classList.add('hidden'); }, 3500);
            }
            loadVaultNote(appendData.relativePath || targetPath);
          } else {
            alert('写回失败: ' + (appendData.error || '未知错误'));
            btnWb.disabled = false;
            btnWb.innerHTML = `<span>重新写回</span>`;
          }
        } catch (wbErr) {
          alert('写回网络异常: ' + wbErr.message);
          btnWb.disabled = false;
          btnWb.innerHTML = `<span>重新写回</span>`;
        }
      });
    }

    dom.obsidianChatHistory.appendChild(msgDiv);
    dom.obsidianChatHistory.scrollTop = dom.obsidianChatHistory.scrollHeight;
    return msgDiv;
  }

  // 快捷问题 Chip
  dom.suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (dom.inputObsidianQuery) {
        dom.inputObsidianQuery.value = chip.textContent.trim();
        if (dom.formObsidianAsk) dom.formObsidianAsk.dispatchEvent(new Event('submit'));
      }
    });
  });

  // 沉淀为长期记忆 (Extract to Long-term Memory)
  dom.btnExtractToMemory.addEventListener('click', async () => {
    if (state.utterances.length === 0) {
      alert('尚无对话内容，请先录音！');
      return;
    }

    dom.btnExtractToMemory.disabled = true;
    dom.btnExtractToMemory.innerHTML = `${Icons.spinner}<span>正在沉淀记忆...</span>`;

    try {
      const res = await fetch('/api/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utterances: state.utterances,
          sessionId: state.sessionId,
          topic: state.globalState.current_topic
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`成功沉淀 ${data.count} 条长期核心记忆到你的第二大脑！`);
        loadMemories();
      } else {
        alert('沉淀失败: ' + data.message);
      }
    } catch (err) {
      alert('沉淀记忆请求异常: ' + err.message);
    } finally {
      dom.btnExtractToMemory.disabled = false;
      dom.btnExtractToMemory.innerHTML = `${Icons.brain}<span>沉淀为长期记忆</span>`;
    }
  });

  // 导出 Markdown
  dom.btnExportMd.addEventListener('click', () => {
    if (!state.currentMinutes) {
      alert('请先生成纪要后再导出！');
      return;
    }
    const m = state.currentMinutes;
    let md = `# ${m.title || '会议纪要'}\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString()} | 模式: ${m.template}\n\n`;
    md += `## 一、 30秒高管速览 (TL;DR)\n`;
    (m.tldr || []).forEach(p => md += `- ${p}\n`);
    md += `\n## 二、 关键决策对账单 (Decisions)\n`;
    (m.decisions || []).forEach(d => md += `- [x] ${d}\n`);
    md += `\n## 三、 落地执行待办 (Action Items)\n`;
    (m.action_items || []).forEach(a => md += `- [ ] [${a.priority || 'P1'}][${a.assignee || '待定'}] ${a.task} (截止: ${a.deadline || '待定'})\n`);
    md += `\n## 四、 AI 批评家 · 红队对抗审查 (Red Team Review)\n`;
    md += `### 潜在隐患与盲区:\n`;
    (m.red_team_review?.vulnerabilities || []).forEach(v => md += `- [风险] ${v}\n`);
    md += `### 针对性防御补丁:\n`;
    (m.red_team_review?.countermeasures || []).forEach(p => md += `- [防御补丁] ${p}\n`);
    md += `\n## 五、 结构化思维导图大纲 (Mindmap)\n\`\`\`markdown\n${m.mindmap_markdown || ''}\n\`\`\`\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${m.title || 'meeting_minutes'}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // =========================================================================
  // 9. 长期 AI 记忆第二大脑与现代化 Agent 交互系统 (7 原则完整实现)
  // =========================================================================

  // 4. 动效只播一次 (WeakSet 门控)
  const agentEntranceWeakSet = new WeakSet();
  function markEntrancePlayed(obj) {
    if (obj && typeof obj === 'object') {
      agentEntranceWeakSet.add(obj);
    }
  }
  function hasEntrancePlayed(obj) {
    return (obj && typeof obj === 'object') ? agentEntranceWeakSet.has(obj) : false;
  }

  // 7. 滚动由统一管理器管控 (距底 <= 64px 贴底判断 + 局部滚动自控)
  function withUnifiedScroll(container, callback) {
    if (!container) return;
    const isAtBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) <= 64;
    if (callback) callback();
    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // 3x3 像素阵生成器
  function generatePixelGridHtml() {
    let dots = '';
    const delays = [0, 0.1, 0.2, 0.15, 0.25, 0.35, 0.3, 0.4, 0.5];
    for (let i = 0; i < 9; i++) {
      dots += `<span class="tp-pixel-dot" style="animation-delay: ${delays[i]}s"></span>`;
    }
    return `<div class="tp-pixel-grid">${dots}</div>`;
  }

  // 活卡提问架子 (Single-stage Shelf) 状态管理
  let activeShelfState = null;

  function renderShelfAsk(shelfData) {
    if (!dom.brainShelfContainer) return;
    activeShelfState = shelfData;

    dom.brainShelfContainer.innerHTML = `
      <div class="tp-shelf-ask">
        <div class="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
          <div class="flex items-center space-x-1.5 min-w-0">
            <span class="tp-status-dot tp-status-dot--purple"></span>
            <span class="font-extrabold text-xs text-[var(--text-title)] truncate">${escapeHtml(shelfData.title || '需你定夺')}</span>
          </div>
          <button id="btnDismissShelf" class="text-[var(--text-muted)] hover:text-[var(--text-title)] text-xs p-0.5" title="跳过此问">${Icons.close}</button>
        </div>
        <p class="text-[11px] text-[var(--text-body)] leading-relaxed">${escapeHtml(shelfData.question)}</p>
        <div class="space-y-1.5 pt-1">
          ${shelfData.options.map((opt, idx) => `
            <button class="tp-shelf-btn w-full flex items-center justify-between text-left" data-option-index="${idx}">
              <div class="flex items-center space-x-2 min-w-0">
                <span class="tp-shelf-key">${idx + 1}</span>
                <span class="text-xs text-[var(--text-title)] font-medium truncate">${escapeHtml(opt)}</span>
              </div>
              <svg class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    dom.brainShelfContainer.classList.remove('hidden');

    // 绑定选项点击
    dom.brainShelfContainer.querySelectorAll('.tp-shelf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-option-index'), 10);
        resolveShelfAsk(shelfData.options[idx]);
      });
    });

    const btnDismiss = document.getElementById('btnDismissShelf');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        resolveShelfAsk(null, true);
      });
    }

    // 输入区高度变化补偿滚动贴底
    withUnifiedScroll(dom.brainChatHistory, () => {});
  }

  function resolveShelfAsk(selectedAnswer, isDismissed = false) {
    if (!activeShelfState) return;
    const shelf = activeShelfState;
    activeShelfState = null;

    if (dom.brainShelfContainer) {
      dom.brainShelfContainer.innerHTML = '';
      dom.brainShelfContainer.classList.add('hidden');
    }

    // 6. 归档为一行 QuietRow 存入对话流
    withUnifiedScroll(dom.brainChatHistory, () => {
      const archiveDiv = document.createElement('div');
      archiveDiv.className = 'tp-quiet-row';
      const label = isDismissed ? '提问 · 已跳过' : `提问 · 已选定: ${escapeHtml(selectedAnswer)}`;
      archiveDiv.innerHTML = `
        <div class="tp-quiet-header">
          <div class="flex items-center space-x-1.5 min-w-0">
            <svg class="tp-quiet-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="tp-status-dot tp-status-dot--green"></span>
            <span class="truncate font-mono">${label}</span>
          </div>
          <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0">${shelf.options.length} 选项</span>
        </div>
      `;
      dom.brainChatHistory.appendChild(archiveDiv);
    });

    // 触发继续执行
    if (!isDismissed && selectedAnswer) {
      submitBrainQuestionInternal(`关于刚才的决定，我选择：${selectedAnswer}`);
    }
  }

  // 键盘快捷键监听: 活卡激活时支持按键 1-9 快速选择
  document.addEventListener('keydown', (e) => {
    if (!activeShelfState) return;
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= activeShelfState.options.length) {
      if (document.activeElement === dom.inputBrainQuestion) {
        // 如果焦点在输入框，按数字不误拦截输入
        return;
      }
      e.preventDefault();
      resolveShelfAsk(activeShelfState.options[num - 1]);
    }
  });

  // 1. 静默摘要行 (QuietRow) 生成器
  function createQuietRow(title, meta, steps = []) {
    const row = document.createElement('div');
    row.className = 'tp-quiet-row';
    let isExpanded = false;

    function update() {
      row.innerHTML = `
        <div class="tp-quiet-header">
          <div class="flex items-center space-x-1.5 min-w-0 flex-1">
            <svg class="tp-quiet-chevron ${isExpanded ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="tp-status-dot tp-status-dot--green"></span>
            <span class="truncate font-mono text-xs">${escapeHtml(title)}</span>
          </div>
          <span class="text-[10px] text-[var(--text-muted)] font-mono shrink-0 ml-2">${escapeHtml(meta)}</span>
        </div>
        ${isExpanded ? `
          <div class="tp-quiet-details">
            ${steps.map(s => `
              <div class="tp-quiet-step-item">
                <span class="font-bold text-[var(--accent-purple)] shrink-0 font-mono text-[10px]">[${escapeHtml(s.name || s.type || 'STEP')}]</span>
                <span class="text-[var(--text-title)]">${escapeHtml(s.desc || s.detail || s.text || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      row.querySelector('.tp-quiet-header').addEventListener('click', () => {
        isExpanded = !isExpanded;
        withUnifiedScroll(dom.brainChatHistory, () => {
          update();
        });
      });
    }

    update();
    return row;
  }

  // 加载记忆
  async function loadMemories() {
    try {
      const res = await fetch('/api/memory/all');
      state.memories = await res.json();
      
      const countText = `${state.memories.length} 条记忆`;
      if (dom.memoryCountBadge) dom.memoryCountBadge.textContent = countText;
      if (dom.headerMemoryCountBadge) dom.headerMemoryCountBadge.textContent = countText;
      if (dom.navMemoryCountBadge) dom.navMemoryCountBadge.textContent = state.memories.length;
      
      const navBadge = document.getElementById('memoryNavBadge');
      if (navBadge) navBadge.textContent = state.memories.length;

      renderMemories();
    } catch (e) {
      console.error('加载记忆异常:', e);
    }
  }

  if (dom.selectMemorySort) {
    dom.selectMemorySort.addEventListener('change', () => {
      renderMemories();
    });
  }

  dom.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.memoryFilterCategory = btn.getAttribute('data-category');
      renderMemories();
    });
  });

  function renderMemories() {
    dom.memoryGrid.innerHTML = '';
    const q = (state.memorySearchQuery || '').trim().toLowerCase();
    const sortMode = dom.selectMemorySort ? dom.selectMemorySort.value : 'importance';

    let filtered = state.memories.filter(m => {
      const matchCat = state.memoryFilterCategory === 'all' || m.category === state.memoryFilterCategory;
      if (!matchCat) return false;
      if (!q) return true;
      const textMatch = (m.content || '').toLowerCase().includes(q);
      const tagMatch = (m.tags || []).some(t => t.toLowerCase().includes(q));
      return textMatch || tagMatch;
    });

    // 排序逻辑
    if (sortMode === 'importance') {
      filtered.sort((a, b) => (b.importance || 0) - (a.importance || 0));
    } else if (sortMode === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortMode === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    if (filtered.length === 0) {
      dom.memoryGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div class="w-14 h-14 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[var(--accent-purple)]">
            ${Icons.koboyo('brain', 'w-8 h-8')}
          </div>
          <div class="space-y-1">
            <p class="font-bold text-xs text-[var(--text-title)]">大脑中还没有沉淀此分类记忆</p>
            <p class="text-[11px] text-[var(--text-muted)]">在“深度纪要”页点击“沉淀记忆”，T小P 会自动提炼用户偏好与决策经验</p>
          </div>
        </div>
      `;
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'tp-card p-3.5 flex flex-col justify-between space-y-2.5 bg-[var(--bg-card)] border-1.5 border-[var(--border-main)] hover:shadow-md transition-shadow';
      
      let catBadge = '客观经验';
      let catIcon = Icons.lightbulb;
      let catColor = 'tp-badge-yellow';
      if (m.category === 'preference') { catBadge = '偏好画像'; catIcon = Icons.user; catColor = 'tp-badge-purple'; }
      if (m.category === 'project') { catBadge = '项目方案'; catIcon = Icons.box; catColor = 'tp-badge-green'; }
      if (m.category === 'decision') { catBadge = '重大决策'; catIcon = Icons.scale; catColor = 'tp-badge-yellow'; }
      if (m.category === 'person') { catBadge = '人物承诺'; catIcon = Icons.users; catColor = 'tp-badge-blue'; }

      // 5点式重要度指示器
      const imp = Math.max(1, Math.min(5, m.importance || 3));
      let dotsHtml = '';
      for (let i = 1; i <= 5; i++) {
        dotsHtml += `<span class="inline-block w-1.5 h-1.5 rounded-full ${i <= imp ? 'bg-[var(--accent-purple)]' : 'bg-[var(--border-main)]'}"></span>`;
      }

      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="tp-badge ${catColor} text-[10px] font-bold flex items-center space-x-1">${catIcon}<span>${catBadge}</span></span>
            <div class="flex items-center space-x-1" title="重要度权重: ${imp}/5">
              ${dotsHtml}
            </div>
          </div>
          <p class="text-xs sm:text-sm text-[var(--text-title)] leading-relaxed font-medium">${escapeHtml(m.content)}</p>
        </div>

        <div class="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div class="flex flex-wrap gap-1">
            ${(m.tags || []).map(t => `<span class="px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] font-mono text-[9px] text-[var(--text-title)] border border-[var(--border-subtle)]">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <button class="delete-memory-btn text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-colors" data-id="${m.id}" title="删除此记忆">${Icons.close}</button>
        </div>
      `;

      card.querySelector('.delete-memory-btn').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('确认从第二大脑中删除此条记忆吗？')) {
          await fetch(`/api/memory/${id}`, { method: 'DELETE' });
          loadMemories();
        }
      });

      dom.memoryGrid.appendChild(card);
    });
  }

  // 实时过滤记忆卡片
  if (dom.inputSearchMemories) {
    dom.inputSearchMemories.addEventListener('input', (e) => {
      state.memorySearchQuery = e.target.value;
      renderMemories();
    });
  }

  // 第二大脑 Composer 输入框自适应与回车逻辑
  if (dom.inputBrainQuestion) {
    dom.inputBrainQuestion.addEventListener('input', () => {
      dom.inputBrainQuestion.style.height = 'auto';
      dom.inputBrainQuestion.style.height = Math.min(dom.inputBrainQuestion.scrollHeight, 96) + 'px';
      withUnifiedScroll(dom.brainChatHistory, () => {});
    });

    dom.inputBrainQuestion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // 5. 有活卡时输入框 Enter 不发送，焦点移到架子
        if (activeShelfState) {
          const firstOptBtn = dom.brainShelfContainer ? dom.brainShelfContainer.querySelector('.tp-shelf-btn') : null;
          if (firstOptBtn) firstOptBtn.focus();
          alert('请先根据上方活卡定夺选择，或按 Esc/右上角关闭。');
          return;
        }
        submitBrainQuestion();
      }
    });
  }

  if (dom.formBrainAsk) {
    dom.formBrainAsk.addEventListener('submit', (e) => {
      e.preventDefault();
      submitBrainQuestion();
    });
  }

  function submitBrainQuestion() {
    if (!dom.inputBrainQuestion) return;
    const q = dom.inputBrainQuestion.value.trim();
    if (!q) return;
    dom.inputBrainQuestion.value = '';
    dom.inputBrainQuestion.style.height = 'auto';
    submitBrainQuestionInternal(q);
  }

  // Prompt chips
  document.querySelectorAll('.tp-memory-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      submitBrainQuestionInternal(chip.textContent.trim());
    });
  });

  if (dom.btnNewBrainChat || dom.btnClearBrainChat) {
    const resetChat = () => {
      state.brainChatHistory = [];
      if (dom.brainChatHistory) {
        dom.brainChatHistory.innerHTML = `
          <div class="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5 text-[11px]">
            <div class="flex items-center space-x-1 font-bold text-[var(--accent-purple)]">
              <svg class="w-3.5 h-3.5 text-[var(--accent-purple)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span class="text-[var(--text-title)] font-extrabold">第二大脑认知副驾已就绪</span>
            </div>
            <p class="text-[var(--text-body)] leading-relaxed">
              对话已重置。随时向我提问关于已记录材料的架构定调、人物承诺与历史决策。
            </p>
          </div>
        `;
      }
      if (dom.agentRefBadge) dom.agentRefBadge.textContent = '0 引用';
      if (dom.brainShelfContainer) {
        dom.brainShelfContainer.innerHTML = '';
        dom.brainShelfContainer.classList.add('hidden');
      }
      activeShelfState = null;
    };
    if (dom.btnNewBrainChat) dom.btnNewBrainChat.addEventListener('click', resetChat);
    if (dom.btnClearBrainChat) dom.btnClearBrainChat.addEventListener('click', resetChat);
  }

  // 内部提交逻辑
  async function submitBrainQuestionInternal(q) {
    if (!dom.brainChatHistory) return;

    // 1. 用户气泡入场
    withUnifiedScroll(dom.brainChatHistory, () => {
      const userBubble = document.createElement('div');
      userBubble.className = 'tp-bubble-user';
      userBubble.innerHTML = `
        <p class="leading-relaxed font-sans">${escapeHtml(q)}</p>
        <span class="text-[9px] text-[var(--accent-purple)] block text-right mt-1 font-mono">刚刚</span>
      `;
      dom.brainChatHistory.appendChild(userBubble);
    });

    if (dom.btnAskBrain) dom.btnAskBrain.disabled = true;

    // 3. 执行过程流水线 (300px 限高窗口 + 3x3 像素阵 + 计时器)
    const pipelineDiv = document.createElement('div');
    pipelineDiv.className = 'tp-process-pipeline';
    
    let elapsedMs = 0;
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      elapsedMs = ((Date.now() - startTime) / 1000).toFixed(1);
      const timerSpan = pipelineDiv.querySelector('.tp-process-timer');
      if (timerSpan) timerSpan.textContent = `${elapsedMs}s`;
    }, 100);

    pipelineDiv.innerHTML = `
      <div class="tp-process-header">
        <div class="flex items-center space-x-2">
          ${generatePixelGridHtml()}
          <span class="tp-status-dot tp-status-dot--purple"></span>
          <span class="text-xs font-bold text-[var(--text-title)]">执行过程 · 进行中</span>
        </div>
        <span class="tp-process-timer text-[10px] text-[var(--text-muted)] font-mono">0.0s</span>
      </div>
      <div class="tp-process-body space-y-1.5 pt-1">
        <div class="tp-process-step active flex items-center space-x-1.5 text-xs text-[var(--text-title)]">
          <span class="tp-status-dot tp-status-dot--purple"></span>
          <span>检索第二大脑长期记忆库与历史转写向量...</span>
        </div>
      </div>
    `;

    withUnifiedScroll(dom.brainChatHistory, () => {
      dom.brainChatHistory.appendChild(pipelineDiv);
    });

    try {
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      clearInterval(timerInterval);

      const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const steps = data.steps || [
        { type: 'tool_call', detail: '调用 SQLite FTS5 / Embedding 记忆检索' },
        { type: 'reasoning', detail: '聚合偏好画像与项目决策历史进行推演' }
      ];

      // 1. 过程结束后一律收成一行 12.5px 弱化摘要 (QuietRow)
      const quietRow = createQuietRow(`执行过程 · 已完成 · ${steps.length} 步`, `${finalElapsed}s`, steps);
      pipelineDiv.replaceWith(quietRow);

      // 更新引用角标
      if (dom.agentRefBadge && data.sources) {
        dom.agentRefBadge.textContent = `${data.sources.length} 引用`;
      }

      // 4. 正文流式渲染与光标落笔
      withUnifiedScroll(dom.brainChatHistory, () => {
        const assistantBubble = document.createElement('div');
        assistantBubble.className = 'tp-bubble-assistant';
        
        const answerText = data.success ? (data.answer || '未能给出有效答案。') : ('请求异常: ' + (data.error || '未知错误'));
        
        // 模拟逐字流式出字
        assistantBubble.innerHTML = `
          <div class="tp-stream-target tp-markdown-body text-xs leading-relaxed font-sans"></div>
        `;
        dom.brainChatHistory.appendChild(assistantBubble);

        const targetEl = assistantBubble.querySelector('.tp-stream-target');
        const renderedHtml = renderObsidianMarkdown(answerText);
        
        // 瞬间渲染并带落笔 token 类
        targetEl.innerHTML = `<span class="qianji-stream-token">${renderedHtml}</span>`;

        state.brainChatHistory.push({ role: 'user', content: q });
        state.brainChatHistory.push({ role: 'assistant', content: answerText });
      });

      // 2. 如果模型返回了定夺卡片 (clarification)，单舞台架子弹出
      if (data.clarification && data.clarification.question) {
        renderShelfAsk(data.clarification);
      }

    } catch (err) {
      clearInterval(timerInterval);
      pipelineDiv.remove();
      withUnifiedScroll(dom.brainChatHistory, () => {
        const errDiv = document.createElement('div');
        errDiv.className = 'tp-bubble-assistant text-rose-500 text-xs';
        errDiv.textContent = '请求失败: ' + err.message;
        dom.brainChatHistory.appendChild(errDiv);
      });
    } finally {
      if (dom.btnAskBrain) dom.btnAskBrain.disabled = false;
    }
  }

  // 手动添加记忆弹窗
  dom.btnShowAddMemoryModal.addEventListener('click', () => {
    dom.addMemoryModal.classList.remove('hidden');
  });
  dom.btnCloseAddMemory.addEventListener('click', () => dom.addMemoryModal.classList.add('hidden'));
  dom.btnCancelAddMemory.addEventListener('click', () => dom.addMemoryModal.classList.add('hidden'));

  dom.btnConfirmAddMemory.addEventListener('click', async () => {
    const content = dom.modalMemoryContent.value.trim();
    if (!content) {
      alert('请输入记忆内容！');
      return;
    }
    const category = dom.modalMemoryCategory.value;
    const tags = dom.modalMemoryTags.value.split(',').map(t => t.trim()).filter(Boolean);

    await fetch('/api/memory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memories: [{
          category,
          content,
          tags,
          importance: 5,
          sourceSessionId: 'manual'
        }]
      })
    });

    dom.modalMemoryContent.value = '';
    dom.modalMemoryTags.value = '';
    dom.addMemoryModal.classList.add('hidden');
    loadMemories();
  });

  // =========================================================================
  // 10. 历史会话档案 (Tab 5: Sessions Archive)
  // =========================================================================
  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions');
      state.sessions = await res.json();
      renderSessions();
    } catch (e) {
      console.error('加载会话档案异常:', e);
    }
  }
  dom.btnRefreshSessions.addEventListener('click', loadSessions);

  function renderSessions() {
    dom.sessionsGrid.innerHTML = '';
    if (dom.archiveCountBadge) {
      dom.archiveCountBadge.textContent = `${state.sessions.length} 次会话`;
    }

    if (state.sessions.length === 0) {
      dom.sessionsGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div class="w-14 h-14 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[var(--accent-blue)]">
            <svg class="w-7 h-7 text-[var(--accent-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="4" width="19" height="5" rx="1.5"/><path d="M4.5 9V19C4.5 20 5.5 21 6.5 21H17.5C18.5 21 19.5 20 19.5 19V9"/></svg>
          </div>
          <div class="space-y-1">
            <p class="font-bold text-xs text-[var(--text-title)]">暂无历史归档会话</p>
            <p class="text-[11px] text-[var(--text-muted)]">在“实时工作台”开启录音，会议结束后系统将自动建立持久化结构归档</p>
          </div>
        </div>
      `;
      return;
    }

    state.sessions.forEach(s => {
      const card = document.createElement('div');
      card.className = 'tp-card p-4 space-y-3 bg-[var(--bg-card)] border-1.5 border-[var(--border-main)] flex flex-col justify-between hover:shadow-md transition-shadow';

      const dateStr = new Date(s.createdAt).toLocaleString();
      const count = (s.utterances || []).length;
      
      // 字数计算
      const wordCount = (s.utterances || []).reduce((acc, u) => acc + (u.text ? u.text.length : 0), 0);
      const personaTitle = s.personaName || (s.persona ? s.persona.name : '红队侦探');

      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span class="flex items-center space-x-1">${Icons.calendar}<span>${dateStr}</span></span>
            <div class="flex items-center space-x-1.5">
              <span class="tp-badge tp-badge-blue text-[9px] font-mono">${count} 句 · ${wordCount} 字</span>
            </div>
          </div>
          <div class="flex items-center space-x-1.5">
            <h3 class="font-extrabold text-sm text-[var(--text-title)] line-clamp-1">${escapeHtml(s.title || s.topic || '录音随笔')}</h3>
            <span class="tp-badge tp-badge-purple text-[8px] font-mono shrink-0">${escapeHtml(personaTitle)}</span>
          </div>
          <p class="text-xs text-[var(--text-body)] line-clamp-2 leading-relaxed">${escapeHtml(s.delta_summary || s.tldr?.[0] || '暂无摘要')}</p>
        </div>

        <div class="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button class="tp-btn text-xs py-1 px-3 view-session-btn flex items-center space-x-1" data-id="${s.id}">
            <svg class="w-3 h-3 text-[var(--accent-purple)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>载入工作区</span>
          </button>
          <button class="text-rose-500 hover:text-rose-700 text-xs font-bold delete-session-btn p-1" data-id="${s.id}" title="删除会话">${Icons.close}</button>
        </div>
      `;

      card.querySelector('.view-session-btn').addEventListener('click', () => {
        loadSessionIntoWorkspace(s);
      });
      card.querySelector('.delete-session-btn').addEventListener('click', async () => {
        if (confirm(`确认删除会话 “${s.title}” 吗？`)) {
          await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
          loadSessions();
        }
      });

      dom.sessionsGrid.appendChild(card);
    });
  }

  function loadSessionIntoWorkspace(s) {
    state.sessionId = s.id;
    state.utterances = s.utterances || [];
    state.globalState = {
      current_topic: s.topic || s.title,
      key_decisions: s.decisions || [],
      action_items: s.action_items || [],
      unresolved_questions: s.unresolved_questions || [],
      delta_summary: s.delta_summary || ''
    };
    if (s.minutes) {
      state.currentMinutes = s.minutes;
      renderMinutesView(s.minutes);
    }

    // 重新渲染 Tier 2 列表
    dom.committedList.innerHTML = '';
    state.utterances.forEach(u => appendCommittedItem(u));
    updateSlidingWindowUI();
    renderGlobalCognitiveState();

    // 切换到工作台
    const liveTab = document.querySelector('[data-tab="tab-live"]');
    if (liveTab) liveTab.click();
  }

  async function saveCurrentSessionToDatabase() {
    if (state.utterances.length === 0) return;
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.sessionId,
          title: state.currentMinutes?.title || state.globalState.current_topic || '未命名讨论',
          topic: state.globalState.current_topic,
          delta_summary: state.globalState.delta_summary,
          utterances: state.utterances,
          minutes: state.currentMinutes,
          decisions: state.globalState.key_decisions,
          action_items: state.globalState.action_items,
          unresolved_questions: state.globalState.unresolved_questions,
          durationSeconds: state.recordSeconds
        })
      });
    } catch (e) {
      console.warn('会话自动存档失败:', e);
    }
  }

  // 工具函数
  function formatMarkdown(md) {
    if (!md) return '';
    return md
      .replace(/^### (.*$)/gim, '<h4 class="font-black text-sm text-[var(--text-title)] mt-3 mb-1">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="font-black text-base text-[var(--text-title)] mt-4 mb-2 border-b border-[var(--border-subtle)] pb-1">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="font-black text-lg text-[var(--text-title)] mt-5 mb-2">$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-extrabold text-[var(--text-title)]">$1</strong>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-xs sm:text-sm my-0.5">$1</li>')
      .replace(/\n\n/gim, '<div class="h-2"></div>')
      .replace(/\n/gim, '<br>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  // =========================================================================
  // Koboyo 趣味手绘小人宇宙角色交互画廊 (10 位手绘思维伙伴)
  // =========================================================================
  function renderKoboyoCharacters() {
    if (!dom.koboyoCharactersGrid) return;
    const characters = Icons.koboyoCharacters || [];
    dom.koboyoCharactersGrid.innerHTML = '';

    characters.forEach((char, index) => {
      const card = document.createElement('div');
      card.className = `tp-card p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_var(--border-main)] border-1.5 border-[var(--border-main)] bg-[var(--bg-card)] group ${index === 0 ? 'ring-2 ring-[var(--accent-rose)]' : ''}`;
      card.setAttribute('data-char-id', char.id);

      const svgHtml = Icons.koboyo(char.id, 'w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-200 group-hover:scale-110');

      card.innerHTML = `
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${char.cardAccent} border border-[var(--border-subtle)] flex items-center justify-center mb-2 overflow-hidden shrink-0">
          ${svgHtml}
        </div>
        <div class="space-y-0.5 w-full">
          <span class="tp-badge ${char.badgeClass} text-[9px] font-bold block truncate">${char.title}</span>
          <h4 class="font-extrabold text-xs text-[var(--text-title)] tracking-tight">${char.name}</h4>
        </div>
      `;

      card.addEventListener('click', () => {
        selectKoboyoCharacter(char, card);
      });

      dom.koboyoCharactersGrid.appendChild(card);
    });
  }

  function selectKoboyoCharacter(char, activeCard) {
    if (dom.koboyoSpeakerBadge) {
      dom.koboyoSpeakerBadge.textContent = char.name;
      dom.koboyoSpeakerBadge.className = `tp-badge ${char.badgeClass} text-[9px] font-bold shrink-0`;
    }
    if (dom.koboyoSpeakerQuote) {
      dom.koboyoSpeakerQuote.textContent = char.motto;
    }
    // 更新高亮环
    if (dom.koboyoCharactersGrid) {
      dom.koboyoCharactersGrid.querySelectorAll('.tp-card').forEach(c => {
        c.classList.remove('ring-2', 'ring-[var(--accent-rose)]', 'ring-[var(--accent-blue)]', 'ring-[var(--accent-yellow)]', 'ring-[var(--accent-green)]', 'ring-[var(--accent-purple)]');
      });
      if (activeCard) {
        activeCard.classList.add('ring-2', 'ring-[var(--accent-yellow)]');
      }
    }
  }

  if (dom.btnKoboyoRandom) {
    dom.btnKoboyoRandom.addEventListener('click', (e) => {
      e.stopPropagation();
      const characters = Icons.koboyoCharacters || [];
      if (characters.length === 0) return;
      const randIdx = Math.floor(Math.random() * characters.length);
      const chosen = characters[randIdx];
      const cards = dom.koboyoCharactersGrid.querySelectorAll('.tp-card');
      const activeCard = cards[randIdx];
      selectKoboyoCharacter(chosen, activeCard);
    });
  }

  // 初始加载记忆、人设胶囊、Obsidian 状态、记忆库 3/4 : 1/4 拖动分栏与 Vault 数据
  loadMemories();
  updateActivePersonaCapsule(state.selectedPersona);
  loadObsidianStatus();
  loadObsidianVaultData();
  initMemorySplitter();
});
