
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
