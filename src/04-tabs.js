
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
  const initialSilence = localStorage.getItem('voice_sentence_silence') || '1200';
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
