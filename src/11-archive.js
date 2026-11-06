
  // =========================================================================
  // 10. 历史会话档案 (Tab 5: Sessions Archive)
  // =========================================================================
  async function loadSessions() {
    // 一期升级：首次加载时先展示骨架屏，避免空白闪烁
    if (dom.sessionsGrid && (!state.sessions || state.sessions.length === 0)) {
      dom.sessionsGrid.innerHTML = '<div class="vb-skel-card"></div><div class="vb-skel-card"></div><div class="vb-skel-card"></div>';
    }
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
