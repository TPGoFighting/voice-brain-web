/* ==========================================================================
   TP UI · tp-ui.js v2.4.0 (2026-10-31)
   交互与动效引擎。与 ATP 上的 Antigravity 两轮评审后定稿，动效机制 1:1 复刻
   tpgofighting.top 自研 scrub 系统（取证规格见 portal_audit/motion-spec.md）：
   - TpMotion：IO 门控(22%) + 单飞 rAF + 几何进度 -> 单个 CSS 变量 --tp-p
   - 三种进度公式：scene / self / wrap（与原站分母一致）
   - 子元素错峰靠 CSS 算术时间窗（--tp-i），JS 不管时间轴
   - TpSpring：英雄区弹簧积分器（默认 easing .15 / 阻尼 .72；复位 .08 / .68）
   - 降级链：reduced-motion 直达终态 / 无 JS 内容默认可见（渐进增强）
   ========================================================================== */
(function () {
  'use strict';
  var VERSION = '2.4.0';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  /* 渐进增强标记：只有 JS 在场才启用初始隐藏态（无 JS 时内容完全可见） */
  document.documentElement.classList.add('tp-js');

  /* ---------------- TpMotion：滚动 scrub 引擎 ---------------- */
  var scenes = new Set();       // 活跃场景（IO 门控后）
  var ticking = false;

  function progressFor(el, mode) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    if (rect.height === 0 && rect.top === 0) return null; // display:none 的路由视图，跳过
    if (mode === 'self') return clamp01((vh - rect.top) / (vh * 0.72));
    if (mode === 'wrap') return clamp01((vh - rect.top) / (rect.height + vh));
    /* scene（默认，与原站 A1 一致） */
    return clamp01((vh - rect.top) / (vh + rect.height * 0.15));
  }

  function measure() {
    ticking = false;
    if (document.hidden) return;
    scenes.forEach(function (el) {
      var p = progressFor(el, el.getAttribute('data-tp-scroll') || 'scene');
      if (p === null) return;
      var v = p.toFixed(3);
      if (el.__tpP !== v) {           // 值未变不写，避免无谓样式重算
        el.__tpP = v;
        el.style.setProperty('--tp-p', v);
      }
    });
  }
  function schedule() {
    if (!ticking) { ticking = true; requestAnimationFrame(measure); }
  }

  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { scenes.add(e.target); schedule(); }
      else { scenes.delete(e.target); }
    });
  }, { rootMargin: '22% 0px 22% 0px' }) : null;

  function initMotion() {
    var els = document.querySelectorAll('[data-tp-scroll]');
    if (reduced || !io) {
      /* 降级：全部直达终态 */
      els.forEach(function (el) { el.style.setProperty('--tp-p', '1'); });
      return;
    }
    els.forEach(function (el) { io.observe(el); });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
  }

  /* ---------------- 一次性入场（原站 A3：threshold .2，播完 unobserve） ---------------- */
  function initReveal() {
    var els = document.querySelectorAll('[data-tp-reveal]');
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('tp-in'); });
      return;
    }
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('tp-in'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    els.forEach(function (el) { rio.observe(el); });
  }

  /* ---------------- TpSpring：弹簧积分器（英雄区眼睛/跟随） ---------------- */
  /* 用法：var s = TpSpring.create(); 每帧 s.step(target) 返回当前值；
     参数为原站实测值：active easing .15（范围 .05–.3）×1.55 钳制 .28、阻尼 .72；
     reset easing .08、阻尼 .68。指针主循环另有 lerp .14 预平滑（见 TpHero）。 */
  function makeSpring(opts) {
    var cfg = Object.assign({ easing: 0.15, multiplier: 1.55, maxSpring: 0.28, damping: 0.72 }, opts || {});
    var cur = 0, vel = 0;
    return {
      step: function (target) {
        var spring = Math.min(cfg.maxSpring, cfg.easing * cfg.multiplier);
        vel += (target - cur) * spring;
        vel *= cfg.damping;
        cur += vel;
        return cur;
      },
      set: function (v) { cur = v; vel = 0; },
      value: function () { return cur; }
    };
  }

  /* 英雄区指针跟随：lerp .14 预平滑 + 每只眼独立弹簧；降级链 陀螺仪→滚动伪造→静态 */
  function initHero(root) {
    if (!root || reduced) return;
    var eyes = root.querySelectorAll('[data-tp-eye]');
    if (!eyes.length) return;
    var springs = [];
    eyes.forEach(function () { springs.push({ x: makeSpring(), y: makeSpring() }); });
    var tx = 0, ty = 0, px = 0, py = 0, running = false, inView = false;
    function loop() {
      if (!running) return;
      px += (tx - px) * 0.14;   // 指针预平滑（原站实测 lerp 0.14）
      py += (ty - py) * 0.14;
      eyes.forEach(function (eye, i) {
        var dx = springs[i].x.step(px), dy = springs[i].y.step(py);
        var max = parseFloat(eye.getAttribute('data-tp-eye')) || 6;
        eye.style.transform = 'translate(' + (dx * max).toFixed(2) + 'px,' + (dy * max).toFixed(2) + 'px)';
      });
      requestAnimationFrame(loop);
    }
    function start() { if (!running && inView && !document.hidden) { running = true; requestAnimationFrame(loop); } }
    function stop() { running = false; }
    new IntersectionObserver(function (e) { inView = e[0].isIntersecting; inView ? start() : stop(); },
      { rootMargin: '100px' }).observe(root);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;      // 原站显式忽略触摸指针
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    /* 触屏降级 1：陀螺仪 */
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma === null) return;
      tx = Math.max(-35, Math.min(35, e.gamma)) / 35;
      ty = Math.max(-20, Math.min(50, (e.beta || 30) - 30)) / 35;
    }, { passive: true });
    /* 触屏降级 2：滚动比例伪造指针 */
    window.addEventListener('scroll', function () {
      if (window.matchMedia('(pointer: fine)').matches) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var r = max > 0 ? window.scrollY / max : 0;
      tx = 0.46 + r * 0.08 * 2 - 1; ty = 0.35 + r * 0.22 * 2 - 1;
    }, { passive: true });
  }

  /* ---------------- 聚光 hover（原站产品卡：190px 径向光跟随） ---------------- */
  function initSpotlight() {
    document.querySelectorAll('[data-tp-spot]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--tp-spot-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--tp-spot-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      }, { passive: true });
    });
  }

  /* ---------------- 阅读进度条（Antigravity 裁决：独立 + rAF 节流，不裸奔） ---------------- */
  function initProgress() {
    var bar = document.querySelector('[data-tp-progress]');
    if (!bar) return;
    var busy = false;
    function upd() {
      busy = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0).toFixed(2) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!busy) { busy = true; requestAnimationFrame(upd); }
    }, { passive: true });
    upd();
  }

  /* ---------------- Tabs 内容切换 ---------------- */
  function initTabs() {
    document.querySelectorAll('[data-tp-tabs]').forEach(function (group) {
      var tabs = group.querySelectorAll('[data-tp-tab]');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function (ev) {
          ev.preventDefault();
          tabs.forEach(function (t) {
            var on = t === tab;
            t.classList.toggle('tp-tab--on', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            var panel = document.getElementById(t.getAttribute('data-tp-tab'));
            if (panel) panel.hidden = !on;
          });
          schedule();   // 路由/面板切换后补算一帧 scrub（原站 switchRoute 同款处理）
        });
      });
    });
  }

  /* ---------------- Modal（焦点回归 + Esc + 遮罩点击关） ---------------- */
  var lastFocus = null;
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('tp-open'); });
    var f = m.querySelector('[autofocus]') || m.querySelector('button, [href], input, select, textarea, [tabindex]');
    if (f) f.focus();
    document.documentElement.style.overflow = 'hidden';
  }
  function closeModal(m) {
    m = typeof m === 'string' ? document.getElementById(m) : m;
    if (!m) return;
    m.classList.remove('tp-open');
    m.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function initModals() {
    document.querySelectorAll('[data-tp-modal-open]').forEach(function (b) {
      b.addEventListener('click', function () { openModal(b.getAttribute('data-tp-modal-open')); });
    });
    document.querySelectorAll('.tp-modal').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
      m.querySelectorAll('[data-tp-modal-close]').forEach(function (b) {
        b.addEventListener('click', function () { closeModal(m); });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.querySelectorAll('.tp-modal.tp-open').forEach(closeModal);
    });
  }

  /* ---------------- Toast（自动销毁栈） ---------------- */
  function toast(msg, kind) {
    var host = document.querySelector('.tp-toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'tp-toasts';
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'tp-toast' + (kind ? ' tp-toast--' + kind : '');
    t.textContent = msg;
    t.setAttribute('role', 'status');
    host.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('tp-in'); });
    setTimeout(function () {
      t.classList.remove('tp-in');
      setTimeout(function () { t.remove(); }, 350);
    }, 3400);
  }

  /* ---------------- 数字滚动（v2.1，Antigravity 裁决：独立 IO 触发补间，不走 scrub） ---------------- */
  function initCount() {
    var els = document.querySelectorAll('[data-tp-count]');
    if (!els.length) return;
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    function run(el) {
      var target = parseFloat(el.getAttribute('data-tp-count')) || 0;
      var suffix = el.getAttribute('data-tp-count-suffix') || '';
      if (reduced || !('requestAnimationFrame' in window)) { el.textContent = fmt(target) + suffix; return; }
      var t0 = null, dur = 1200;
      function tick(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);           /* easeOutCubic */
        el.textContent = fmt(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (el) { cio.observe(el); });
  }

  /* ---------------- 跑马灯（补齐原站缺失的 keyframes 后的行为件：hover 暂停在 CSS） ---------------- */
  /* 结构要求：.tp-marquee > .tp-marquee__track 内含两份相同内容，CSS 已定义动画。 */

  /* ---------------- 弃用契约（治理：旧类名 warn 保留两版） ---------------- */
  var DEPRECATED = { 'tp-btn-primary': 'tp-btn', 'tp-card-hover': 'tp-card--hover' };
  function checkDeprecated() {
    Object.keys(DEPRECATED).forEach(function (old) {
      if (document.querySelector('.' + old)) {
        console.warn('[tp-ui] .' + old + ' is deprecated since v2.0.0, use .' + DEPRECATED[old] + ' instead.');
      }
    });
  }

  /* ---------------- 主题切换（配合 tp-theme.js 引导：切换即写回 localStorage） ---------------- */
  function initThemeToggle() {
    document.querySelectorAll('[data-tp-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('tp-theme', next); } catch (e) {}
      });
    });
  }

  function init() {
    initMotion(); initReveal(); initSpotlight(); initProgress();
    initTabs(); initModals(); initCount(); initThemeToggle(); checkDeprecated();
    document.querySelectorAll('[data-tp-hero]').forEach(initHero);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.TpUI = {
    version: VERSION,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    spring: makeSpring,
    refreshMotion: schedule   /* 路由切换后手动补算一帧 */
  };
})();
