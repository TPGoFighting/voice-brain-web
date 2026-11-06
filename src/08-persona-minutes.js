
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
          template: (document.getElementById('minutesTemplateSelect') || {}).value || 'general',
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
