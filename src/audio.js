const SAMPLE_NAMES = ['A0', 'Ds1', 'A1', 'Ds2', 'A2', 'Ds3', 'A3', 'Ds4', 'A4', 'Ds5', 'A5', 'Ds6', 'A6', 'Ds7', 'A7', 'C8'];
const SAMPLE_MIDI = [21, 27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 99, 105, 108];
export class PianoAudio {
  constructor() {
    this.context = null;
    this.buffers = new Map();
    this.voices = new Set();
    this.volume = .75;
    this.ready = null;
    this.loading = null;
  }
  now() { return this.context?.currentTime ?? 0; }
  async initialize(onProgress = () => {}) {
    if (!this.context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw new Error('当前浏览器不支持网页音频，请用 Safari 或 Chrome 打开');
      this.context = new Audio({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * .65;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 15;
      this.compressor.ratio.value = 4;
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    }
    // Resume directly from the user's tap before waiting for network/decoding on iPad.
    await this.context.resume();
    if (this.ready) return;
    if (!this.loading) this.loading = this.load(onProgress).catch(error => { this.loading = null; throw error; });
    await this.loading;
  }
  async load(onProgress) {
    let loaded = 0;
    await Promise.all(SAMPLE_NAMES.map(async (name, index) => {
      if (!this.buffers.has(SAMPLE_MIDI[index])) {
        const response = await fetch(new URL(`../assets/piano/${name}.mp3`, import.meta.url));
        if (!response.ok) throw new Error('钢琴音色暂时无法载入，请检查网络后再点播放');
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(SAMPLE_MIDI[index], buffer);
      }
      onProgress(++loaded / SAMPLE_NAMES.length);
    }));
    this.ready = true;
  }
  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value * .65, this.now(), .015);
  }
  playNote({ midi, when, duration, velocity, elapsed = 0 }) {
    if (!this.ready || duration <= 0 || midi < 0 || midi > 127) return;
    const sample = SAMPLE_MIDI.reduce((best, n) => Math.abs(n - midi) < Math.abs(best - midi) ? n : best);
    const rate = 2 ** ((midi - sample) / 12);
    const buffer = this.buffers.get(sample);
    const offset = Math.min(elapsed * rate, Math.max(0, buffer.duration - .08));
    const start = Math.max(this.now(), when);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const amplitude = Math.pow(velocity, 1.35) * .78;
    const end = start + duration;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + Math.min(.006, duration / 2));
    gain.gain.setValueAtTime(amplitude, end);
    gain.gain.exponentialRampToValueAtTime(.0001, end + .14);
    source.connect(gain);
    gain.connect(this.master);
    const voice = { source, gain };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(start, offset);
    source.stop(end + .16);
  }
  stopAll() {
    if (!this.context) return;
    const now = this.now();
    for (const voice of this.voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
        voice.source.stop(now);
      } catch { /* The source can finish naturally between scheduling and cancellation. */ }
    }
    this.voices.clear();
  }
}
