
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

  // =========================================================================
  // 一期升级（2026-11-06）：真实频谱波形 + 来源定位 + toast 反馈
  // =========================================================================
  let _freqArr = null;
  function getFreqData() {
    const an = state.recorder && state.recorder.analyser;
    if (!an || !state.isRecording) return null;
    if (!_freqArr || _freqArr.length !== an.frequencyBinCount) _freqArr = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(_freqArr);
    return _freqArr;
  }
  function barLevel(freq, i, bars) {
    const idx = Math.min(freq.length - 1, Math.floor(Math.pow(i / bars, 1.6) * freq.length * 0.85));
    return freq[idx] / 255;
  }

  function vbToast(msg) {
    let box = document.getElementById('vb-toast-box');
    if (!box) { box = document.createElement('div'); box.id = 'vb-toast-box'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'vb-toast';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 2600);
  }

  // 问答来源定位：载入来源会话到工作区，并高亮命中原文句
  async function locateTranscriptSource(src) {
    if (!src || !src.sessionId) return;
    try {
      if (!state.sessions || !state.sessions.length) await loadSessions();
      const s = (state.sessions || []).find(x => x.id === src.sessionId);
      if (!s) { vbToast('来源会话已不存在'); return; }
      loadSessionIntoWorkspace(s);
      switchTab('tab-live');
      vbToast('已定位到来源会话');
      const probe = (src.quote || '').replace(/\s+/g, '').slice(0, 14);
      setTimeout(() => {
        if (!probe || !dom.committedList) return;
        const leaves = dom.committedList.querySelectorAll('p, span, div');
        for (const el of leaves) {
          if (el.children.length === 0 && el.textContent && el.textContent.replace(/\s+/g, '').includes(probe)) {
            const host = el.closest('.tp-committed-item') || el.parentElement || el;
            host.scrollIntoView({ behavior: 'smooth', block: 'center' });
            host.classList.add('vb-locate-flash');
            setTimeout(() => host.classList.remove('vb-locate-flash'), 2600);
            break;
          }
        }
      }, 400);
    } catch (e) {
      vbToast('定位失败，请到历史档案中手动打开该会话');
    }
  }

  // 二期升级：PWA 离线队列事件 → toast 反馈（事件由 index.html 的 SW 桥转发）
  window.addEventListener('vb-offline-queued', () => vbToast('网络不佳，操作已暂存，联网后自动同步'));
  window.addEventListener('vb-offline-synced', () => vbToast('离线期间的操作已同步'));


// =========================================================================
// 三期升级（2026-11-06）：全文检索 / 说话人分离 / 纪要模板
// =========================================================================
const VB_SPEAKER_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#f472b6', '#94a3b8', '#facc15'];
function vbSpeakerColor(name) {
const s = String(name || '发言人');
let h = 0;
for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
return VB_SPEAKER_COLORS[h % VB_SPEAKER_COLORS.length];
}

// ---- 全文检索（归档页） ----
const archiveSearchInput = document.getElementById('archiveSearchInput');
const btnArchiveSearch = document.getElementById('btnArchiveSearch');
const btnClearSearch = document.getElementById('btnClearSearch');
const searchResultsEl = document.getElementById('searchResults');

function highlightHitText(text, q) {
const esc = escapeHtml(text);
if (!q || q.length < 2) return esc;
const eq = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
return esc.replace(new RegExp(eq, 'g'), m => `<mark class="vb-mark">${m}</mark>`);
}

async function runArchiveSearch() {
const q = (archiveSearchInput.value || '').trim();
if (!q) { vbToast('先输入要检索的关键词'); return;}
searchResultsEl.classList.remove('hidden');
searchResultsEl.innerHTML = '<div class="vb-skel-card"></div>';
if (btnClearSearch) btnClearSearch.classList.remove('hidden');
try {
const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&limit=30');
const data = await res.json();
const utts = data.utterances || [];
const mems = data.memories || [];
if (!utts.length &&!mems.length) {
searchResultsEl.innerHTML = '<p class="text-[11px] text-[var(--text-muted)] py-2">没有找到相关记录，换个关键词试试。</p>';
return;
}
let html = `<div class="text-[10px] font-bold text-[var(--text-muted)]">逐字稿命中 ${utts.length} 条 · 记忆命中 ${mems.length} 条</div>`;
utts.forEach((h, i) => {
html += `<button type="button" class="vb-search-hit" data-hit="${i}">
<span class="vb-search-hit-meta">${escapeHtml(h.sessionTitle || '录音会话')} · ${escapeHtml(String(h.utteranceTime || ''))}</span>
<span class="vb-search-hit-text">${highlightHitText(h.text, q)}</span>
</button>`;
});
mems.forEach(m => {
html += `<div class="vb-search-hit vb-search-hit-mem"><span class="vb-search-hit-meta">记忆 · ${escapeHtml(m.category || '')}</span><span class="vb-search-hit-text">${highlightHitText(m.content || '', q)}</span></div>`;
});
searchResultsEl.innerHTML = html;
searchResultsEl.querySelectorAll('[data-hit]').forEach(btn => {
btn.addEventListener('click', () => {
const h = utts[Number(btn.getAttribute('data-hit'))];
locateTranscriptSource({ sessionId: h.sessionId, quote: h.text});
});
});
} catch (e) {
searchResultsEl.innerHTML = '<p class="text-[11px] text-rose-500 py-2">检索失败：' + escapeHtml(e.message) + '</p>';
}
}
if (btnArchiveSearch) btnArchiveSearch.addEventListener('click', runArchiveSearch);
if (archiveSearchInput) archiveSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runArchiveSearch();});
if (btnClearSearch) btnClearSearch.addEventListener('click', () => {
archiveSearchInput.value = '';
searchResultsEl.classList.add('hidden');
searchResultsEl.innerHTML = '';
btnClearSearch.classList.add('hidden');
});

// ---- 纪要模板选择（记住选择） ----
const minutesTemplateSelect = document.getElementById('minutesTemplateSelect');
if (minutesTemplateSelect) {
try {
const saved = localStorage.getItem('vb-minutes-template');
if (saved) minutesTemplateSelect.value = saved;
} catch (e) {}
minutesTemplateSelect.addEventListener('change', () => {
try { localStorage.setItem('vb-minutes-template', minutesTemplateSelect.value);} catch (e) {}
vbToast('纪要模板：' + minutesTemplateSelect.options[minutesTemplateSelect.selectedIndex].text);
});
}

// ---- 说话人分离（离线精转写 paraformer-v2 + diarization） ----
const btnDiarize = document.getElementById('btnDiarize');
const diarizeFileInput = document.getElementById('diarizeFileInput');

function vbBigrams(text) {
const clean = String(text || '').replace(/[\s，。！？；：、,.!?;:""''（）()[\]{}]/g, '');
const set = new Set();
for (let i = 0; i + 2 <= clean.length; i++) set.add(clean.slice(i, i + 2));
if (clean.length === 1) set.add(clean);
return set;
}
function vbTextSim(a, b) {
const A = vbBigrams(a), B = vbBigrams(b);
if (!A.size ||!B.size) return 0;
let inter = 0;
A.forEach(t => { if (B.has(t)) inter++;});
return (2 * inter) / (A.size + B.size);
}
function fmtElapsed(ms) {
const s = Math.floor(ms / 1000);
const hh = String(Math.floor(s / 3600)).padStart(2, '0');
const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
const ss = String(s % 60).padStart(2, '0');
return `${hh}:${mm}:${ss}`;
}

function applyDiarizedToCurrent(sentences) {
// 单调对齐：实时逐字稿与离线精转写是同一段音频的两次转写，按顺序做文本相似匹配回填 speaker
let ptr = 0;
let assigned = 0;
state.utterances.forEach(u => {
const src = u.rawText || u.text || '';
let best = -1, bestSim = 0;
for (let j = ptr; j < Math.min(sentences.length, ptr + 6); j++) {
const sim = vbTextSim(src, sentences[j].text);
if (sim > bestSim) { bestSim = sim; best = j;}
}
if (best >= 0 && bestSim >= 0.25) {
u.speaker = '说话人 ' + (sentences[best].speakerId + 1);
ptr = best + 1;
assigned++;
}
});
return assigned;
}

function rerenderCommittedList() {
if (!dom.committedList) return;
dom.committedList.innerHTML = '';
state.utterances.forEach(u => appendCommittedItem(u));
if (typeof updateSlidingWindowUI === 'function') updateSlidingWindowUI();
}

async function runDiarization(blob, mode) {
vbToast('正在上传录音，启动说话人分离…');
try {
const up = await fetch('/api/asr/diarize/upload', { method: 'POST', headers: { 'Content-Type': 'audio/wav'}, body: blob});
const upJson = await up.json();
if (!upJson.success) throw new Error(upJson.error || '上传失败');
const st = await fetch('/api/asr/diarize/start', {
method: 'POST',
headers: { 'Content-Type': 'application/json'},
body: JSON.stringify({ url: upJson.url, audioId: upJson.audioId})
});
const stJson = await st.json();
if (!stJson.success) throw new Error('任务提交失败');
vbToast('精转写进行中，稍等片刻…');
const deadline = Date.now() + 5 * 60 * 1000;
while (Date.now() < deadline) {
await new Promise(r => setTimeout(r, 4000));
const pr = await fetch('/api/asr/diarize/status/' + stJson.taskId);
const pj = await pr.json();
if (pj.status === 'SUCCEEDED') {
const sentences = pj.sentences || [];
if (!sentences.length) { vbToast('精转写完成，但没有识别出句子'); return;}
if (mode === 'live' && state.utterances.length) {
const n = applyDiarizedToCurrent(sentences);
if (n === 0) { vbToast('未能对齐：这段音频与当前逐字稿对不上，可改用音频文件导入'); return;}
rerenderCommittedList();
saveCurrentSessionToDatabase();
vbToast(`说话人分离完成：${(pj.speakers || []).length} 位说话人，${n} 句已标注`);
} else {
state.sessionId = 'sess-' + Date.now();
state.utterances = sentences.map((s, i) => ({
id: i + 1,
sentenceId: 'dia-' + Date.now() + '-' + i,
time: fmtElapsed(s.beginMs),
speaker: '说话人 ' + (s.speakerId + 1),
text: s.text,
rawText: s.text,
isCleansed: false
}));
rerenderCommittedList();
saveCurrentSessionToDatabase();
vbToast(`已导入精转写：${sentences.length} 句，${(pj.speakers || []).length} 位说话人`);
}
return;
}
if (!pj.success || pj.status === 'FAILED') throw new Error(pj.error || '精转写失败');
}
vbToast('精转写超时（5 分钟），请稍后重试');
} catch (e) {
vbToast('说话人分离失败：' + e.message);
}
}

if (btnDiarize) btnDiarize.addEventListener('click', () => {
if (state.isRecording) { vbToast('请先结束录音再做说话人分离'); return;}
if (state.recorder && state.recorder.recordedSamples && state.recorder.recordedSamples.length && state.utterances.length) {
const blob = state.recorder.exportWavBlob();
if (blob) { runDiarization(blob, 'live'); return;}
}
if (diarizeFileInput) diarizeFileInput.click();
});
if (diarizeFileInput) diarizeFileInput.addEventListener('change', () => {
const f = diarizeFileInput.files && diarizeFileInput.files[0];
if (f) runDiarization(f, 'file');
diarizeFileInput.value = '';
});

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

    // 一期升级：优先走流式接口逐字渲染；流式未出字时自动回落原非流式接口，保证可用性
    const assistantBubble = document.createElement('div');
    assistantBubble.className = 'tp-bubble-assistant';
    assistantBubble.innerHTML = `<div class="tp-stream-target tp-markdown-body text-xs leading-relaxed font-sans"></div>`;
    withUnifiedScroll(dom.brainChatHistory, () => { dom.brainChatHistory.appendChild(assistantBubble); });
    const targetEl = assistantBubble.querySelector('.tp-stream-target');

    let accText = '';
    let finalData = null;
    let streamErr = null;
    let renderQueued = false;
    const renderStream = (final = false) => {
      if (!accText) { targetEl.innerHTML = '<span class="vb-stream-cursor"></span>'; return; }
      const html = renderObsidianMarkdown(accText);
      targetEl.innerHTML = final ? html : html + '<span class="vb-stream-cursor"></span>';
    };
    const queueRender = () => {
      if (renderQueued) return;
      renderQueued = true;
      setTimeout(() => { renderQueued = false; renderStream(false); }, 90);
    };
    renderStream(false);

    const finishWithData = (data, elapsed) => {
      const steps = data.steps || [];
      const quietRow = createQuietRow(`执行过程 · 已完成 · ${steps.length} 步`, `${elapsed}s`, steps);
      pipelineDiv.replaceWith(quietRow);
      if (dom.agentRefBadge && data.sources) {
        dom.agentRefBadge.textContent = `${data.sources.length} 引用`;
      }
      renderStream(true);
      // 来源片段：本次真实命中的原文，可点击定位到对应会话与原句
      if (data.sources && data.sources.length) {
        const srcDiv = document.createElement('div');
        srcDiv.className = 'vb-answer-sources';
        srcDiv.innerHTML = `<div class="vb-answer-sources-title">原文来源 · 点击定位</div>` + data.sources.map((s, i) =>
          `<button type="button" class="vb-source-chip" data-src-idx="${i}"><span class="vb-source-chip-title">${escapeHtml(s.sessionTitle || '录音会话')}</span><span class="vb-source-chip-time">${escapeHtml(String(s.utteranceTime || ''))}</span></button>`).join('');
        assistantBubble.appendChild(srcDiv);
        srcDiv.querySelectorAll('.vb-source-chip').forEach(chip => {
          chip.addEventListener('click', () => locateTranscriptSource(data.sources[Number(chip.getAttribute('data-src-idx'))]));
        });
      }
      state.brainChatHistory.push({ role: 'user', content: q });
      state.brainChatHistory.push({ role: 'assistant', content: accText });
      if (data.clarification && data.clarification.question) {
        renderShelfAsk(data.clarification);
      }
    };

    try {
      const res = await fetch('/api/memory/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      if (!res.ok || !res.body) throw new Error('stream http ' + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const handleEvent = (evtName, payload) => {
        if (evtName === 'delta' && payload.t) { accText += payload.t; queueRender(); }
        else if (evtName === 'final') { finalData = payload; }
        else if (evtName === 'error') { streamErr = payload; }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const rawEvt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let evtName = 'message';
          let dataStr = '';
          rawEvt.split('\n').forEach(line => {
            if (line.startsWith('event:')) evtName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          });
          if (dataStr) { try { handleEvent(evtName, JSON.parse(dataStr)); } catch (e) {} }
        }
      }
      clearInterval(timerInterval);
      const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (finalData && accText) {
        finishWithData({ success: true, steps: finalData.steps, sources: finalData.sources, clarification: finalData.clarification }, finalElapsed);
      } else if (!accText) {
        // 流式未出字（上游异常/超时）：回落非流式接口再试一次
        const res2 = await fetch('/api/memory/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q })
        });
        const data2 = await res2.json();
        if (!data2.success) throw new Error((streamErr && streamErr.error) || data2.error || '问答失败');
        accText = data2.answer || '未能给出有效答案。';
        finishWithData(data2, finalElapsed);
        vbToast('已自动回落普通模式作答');
      } else {
        finishWithData({ success: true, steps: [], sources: [], clarification: null }, finalElapsed);
      }
    } catch (err) {
      clearInterval(timerInterval);
      pipelineDiv.remove();
      assistantBubble.remove();
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
