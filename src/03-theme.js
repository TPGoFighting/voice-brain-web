
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
