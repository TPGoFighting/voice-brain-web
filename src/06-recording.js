
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
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/asr`;
      state.ws = new WebSocket(wsUrl);

      state.ws.onopen = async () => {
        const silenceThreshold = parseInt(localStorage.getItem('voice_sentence_silence') || '1200', 10);
        state.ws.send(JSON.stringify({
          type: 'start',
          sessionId: state.sessionId,
          maxSentenceSilence: silenceThreshold
        }));

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

      state.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleAsrMessage(msg);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      state.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        updateRecordingUI('error');
      };

      state.ws.onclose = () => {
        if (!state.isRecording) {
          updateRecordingUI('idle');
        }
      };
    } catch (err) {
      alert('启动麦克风录音异常: ' + (err.message || err.name || '请检查麦克风权限'));
      updateRecordingUI('error');
    }
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
        // TP 2026-11-06: live display defaults to the ASR original; the cleansed draft is kept only in displayText and never replaces the shown text
        if (badgeEl) {
          badgeEl.dataset.cleansed = 'true';
          badgeEl.textContent = `原文展示 · 清洗稿已存 (${msg.latencyMs || 0}ms)`;
          badgeEl.className = 'tp-badge tp-badge-blue text-[8px] font-mono';
        }
      }

      // 同步更新内存中的对应语句
      const targetUtt = state.utterances.find(u => u.sentenceId === sentenceId);
      if (targetUtt && msg.cleansed) {
        // Fix2: text 恒为 ASR 原文，清洗稿只进 displayText 作展示层
        targetUtt.displayText = msg.cleansed;
        targetUtt.isCleansed = msg.cleansed !== targetUtt.text;
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
          <span class="vb-speaker-dot" style="background:${vbSpeakerColor(u.speaker)}"></span><span class="text-[var(--text-title)] font-bold">${escapeHtml(u.speaker)}</span>
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
