/**
 * AudioRecorder - 浏览器端 16kHz 16-bit Mono PCM 音频采集与 100ms 分流器
 * 包含本地全量 WAV 安全缓存（Zero Audio Loss 验证）
 */
class AudioStreamRecorder {
  constructor(options = {}) {
    this.targetSampleRate = options.sampleRate || 16000;
    this.chunkSize = options.chunkSize || 1600; // 50ms = 800 samples * 2 bytes = 1600 bytes
    this.onChunk = options.onChunk || (() => {});
    this.onVolume = options.onVolume || (() => {});

    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.isRecording = false;

    // 本地无损录音缓存（全部 16kHz PCM 样本）
    this.recordedSamples = [];
    this.totalBytesSent = 0;
    this.totalChunksSent = 0;
    this.buffer = [];
  }

  static async getAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (err) {
      console.warn('获取音频设备列表异常:', err);
      return [];
    }
  }

  async start(deviceId = null) {
    if (this.isRecording) return;

    this.recordedSamples = [];
    this.buffer = [];
    this.totalBytesSent = 0;
    this.totalChunksSent = 0;

    const audioConstraints = {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId };
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    try {
      this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate, latencyHint: 'interactive' });
    } catch (e) {
      this.audioContext = new AudioCtx();
    }
    const sourceSampleRate = this.audioContext.sampleRate;
    console.log(`[Audio] AudioContext 采样率: ${sourceSampleRate}Hz, 目标采样率: ${this.targetSampleRate}Hz`);

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 一期升级：旁路 AnalyserNode 供真实频谱波形绘制（不影响采集链路）
    try {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;
      this.source.connect(this.analyser);
    } catch (e) { this.analyser = null; }
    // 使用 1024 缓冲区与直发流管道，实现端侧零缓冲采集（~20ms~60ms 极速直通）
    this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // 计算音量幅值 (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolume(Math.min(1, rms * 5));

      // 1. 重采样至 16000Hz (若原生已是 16k 则 0 开销直通)
      const resampled = (sourceSampleRate === this.targetSampleRate)
        ? inputData
        : this._resample(inputData, sourceSampleRate, this.targetSampleRate);

      // 2. 存入全量本地录音缓存（验证 Zero Audio Loss）
      for (let i = 0; i < resampled.length; i++) {
        this.recordedSamples.push(resampled[i]);
      }

      // 3. 转换为 16-bit PCM 字节序列
      const pcm16 = this._floatTo16BitPCM(resampled);

      // 4. 零延迟直发网络流（彻底消除队列切片等待与 GC 碎片）
      this.totalBytesSent += pcm16.byteLength;
      this.totalChunksSent++;
      this.onChunk(pcm16.buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  stop() {
    this.isRecording = false;

    // 清空剩余 buffer
    if (this.buffer.length > 0) {
      const remaining = new Uint8Array(this.buffer);
      this.onChunk(remaining.buffer);
      this.buffer = [];
    }

    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {}
      this.analyser = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    if (this.mediaStream) {
      try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }
  }

  /**
   * 重采样算法：区间均值降采样（抗混叠）
   */
  _resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    // 一期升级：区间均值降采样（自带抗混叠），替代原线性插值（高频会折叠成噪声）
    const ratio = fromRate / toRate;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio);
      let end = Math.floor((i + 1) * ratio);
      if (end <= start) end = start + 1;
      if (end > input.length) end = input.length;
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      result[i] = sum / (end - start);
    }
    return result;
  }

  /**
   * 将 [-1.0, 1.0] 的 Float32 转换为 16-bit signed PCM 字节序列
   */
  _floatTo16BitPCM(input) {
    const output = new Uint8Array(input.length * 2);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      const intVal = Math.round(val);
      output[i * 2] = intVal & 0xFF;
      output[i * 2 + 1] = (intVal >> 8) & 0xFF;
    }
    return output;
  }

  /**
   * 导出本地全量无损录音为标准 WAV 格式 Blob
   */
  exportWavBlob() {
    if (!this.recordedSamples || this.recordedSamples.length === 0) {
      return null;
    }
    const numChannels = 1;
    const sampleRate = this.targetSampleRate;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = this.recordedSamples.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this._writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < this.recordedSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, this.recordedSamples[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, Math.round(val), true);
      offset += 2;
    }

    return new Blob([view.buffer], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

window.AudioStreamRecorder = AudioStreamRecorder;
