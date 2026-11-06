
  // =========================================================================
  // 5. 音频设备检测与波形绘制
  // =========================================================================
  async function loadAudioDevices() {
    const devices = await AudioStreamRecorder.getAudioDevices();
    dom.micSelect.innerHTML = '<option value="">默认麦克风 (Default Mic)</option>';
    devices.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `音频输入设备 ${idx + 1}`;
      if (d.label.toLowerCase().includes('dji') || d.label.toLowerCase().includes('wireless')) {
        opt.textContent = `${opt.textContent} [推荐]`;
        opt.selected = true;
      }
      dom.micSelect.appendChild(opt);
    });
  }
  loadAudioDevices();

  function drawWaveform() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const strokeStyle = state.isRecording ? (isDark ? '#38bdf8' : '#f59e0b') : (isDark ? '#334155' : '#9ca3af');

    // 桌面端波形
    if (canvasCtx && dom.canvasWaveform) {
      canvasCtx.clearRect(0, 0, dom.canvasWaveform.width, dom.canvasWaveform.height);
      const w = dom.canvasWaveform.width;
      const h = dom.canvasWaveform.height;
      const centerY = h / 2;

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = strokeStyle;
      canvasCtx.beginPath();

      const bars = 44;
      const barWidth = w / bars;
      const now = Date.now() / 180;
      const freq = getFreqData();

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        const wave = freq ? barLevel(freq, i, bars) * (h * 0.48) : Math.sin(now + i * 0.35) * (state.currentVolume * (h * 0.48));
        const barHeight = state.isRecording ? Math.max(3, wave) : 2;
        canvasCtx.moveTo(x + barWidth / 2, centerY - barHeight);
        canvasCtx.lineTo(x + barWidth / 2, centerY + barHeight);
      }
      canvasCtx.stroke();
    }

    // 移动端波形
    if (mobileCanvasCtx && dom.mobileCanvasWaveform) {
      mobileCanvasCtx.clearRect(0, 0, dom.mobileCanvasWaveform.width, dom.mobileCanvasWaveform.height);
      const mw = dom.mobileCanvasWaveform.width;
      const mh = dom.mobileCanvasWaveform.height;
      const mCenterY = mh / 2;

      mobileCanvasCtx.lineWidth = 2;
      mobileCanvasCtx.strokeStyle = strokeStyle;
      mobileCanvasCtx.beginPath();

      const mBars = 22;
      const mBarWidth = mw / mBars;
      const mNow = Date.now() / 180;
      const mFreq = getFreqData();

      for (let i = 0; i < mBars; i++) {
        const x = i * mBarWidth;
        const wave = mFreq ? barLevel(mFreq, i, mBars) * (mh * 0.48) : Math.sin(mNow + i * 0.45) * (state.currentVolume * (mh * 0.48));
        const barHeight = state.isRecording ? Math.max(2, wave) : 2;
        mobileCanvasCtx.moveTo(x + mBarWidth / 2, mCenterY - barHeight);
        mobileCanvasCtx.lineTo(x + mBarWidth / 2, mCenterY + barHeight);
      }
      mobileCanvasCtx.stroke();
    }

    requestAnimationFrame(drawWaveform);
  }
  drawWaveform();
