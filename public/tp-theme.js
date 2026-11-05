/* TP Theme Bootstrap · v2.4.0
   标准深色接入（收编 obsidian 的引导模式）：在 <head> 内、任何 CSS 渲染前同步执行，
   顺序：localStorage('tp-theme') → 系统偏好 → 默认 light。消灭主题闪烁（FOUC）。
   用法：<script src="/tp-theme.js"></script> 放在 <head> 最前；或整段内联。
   切换：TpUI 运行时点 [data-tp-theme-toggle] 自动写回 localStorage。 */
(function () {
  try {
    var t = localStorage.getItem('tp-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
