
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


