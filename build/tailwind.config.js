/** 二期：静态 Tailwind 构建配置。内容扫描覆盖全部前端文本（含 JS 动态模板字符串里的完整类名）。 */
module.exports = {
  content: ['../index.html', '../app.js', '../icons.js', '../tp-theme.js', '../audio-recorder.js'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: { extend: {} },
  plugins: []
};
