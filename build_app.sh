#!/bin/sh
# 二期模块化构建：src/ 下按序号拼接为 public/app.js（运行时语义与单文件版完全一致）
# 用法: sh build_app.sh [输出路径]，默认输出到 ../app.js（本地校验用）
set -e
cd "$(dirname "$0")"
OUT="${1:-../app.js}"
cat src/01-state.js src/02-dom.js src/03-theme.js src/04-tabs.js src/05-audio-waveform.js \
    src/06-recording.js src/07-sliding-window.js src/08-persona-minutes.js src/09-obsidian.js \
    src/10-brain.js src/11-archive.js > "$OUT"
echo "built -> $OUT"
