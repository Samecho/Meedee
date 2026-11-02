import { clamp, lowerBound, loopSegments } from './music.js';

export class Transport {
  constructor(audio) {
    this.audio = audio;
    this.song = null;
    this.playing = false;
    this.position = 0;
    this.rate = 1;
    this.transpose = 0;
    this.hands = { left: true, right: true };
    this.loop = { enabled: false, start: 0, end: 1 };
    this.timer = null;
    this.onchange = () => {};
    this.onended = () => {};
  }
  load(song) {
    this.pause();
    this.song = song;
    this.position = 0;
    this.transpose = 0;
    this.loop = { enabled: false, start: 0, end: song.measures[3]?.end || song.duration };
    this.onchange();
  }
  rawPosition(clock = this.audio.now()) {
    return this.playing ? this.anchorPosition + (clock - this.anchorClock) * this.rate : this.position;
  }
  getPosition(visual = false) {
    if (!visual && this.playing && this.audio.now() < this.anchorClock) return this.anchorPosition;
    let value = this.rawPosition();
    if (this.loop.enabled && value >= this.loop.end) value = this.loop.start + (value - this.loop.end) % (this.loop.end - this.loop.start);
    return visual && value < 0 ? value : clamp(value, 0, this.song?.duration || 0);
  }
  countInRemaining() { return this.playing ? Math.max(0, this.anchorClock - this.audio.now()) : 0; }
  start(countIn = 0) {
    if (!this.song || this.playing) return;
    if (this.position >= this.song.duration - .001) this.position = this.loop.enabled ? this.loop.start : 0;
    if (this.loop.enabled && (this.position < this.loop.start || this.position >= this.loop.end)) this.position = this.loop.start;
    this.playing = true;
    this.anchorPosition = this.position;
    this.anchorClock = this.audio.now() + countIn;
    this.scheduledUntil = this.anchorClock;
    this.resumeSustained(this.position, this.anchorClock);
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
    this.onchange();
  }
  pause() {
    if (this.playing) this.position = this.getPosition();
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.audio.stopAll();
    this.onchange();
  }
  seek(value) {
    const playing = this.playing;
    this.pause();
    this.position = clamp(value, 0, this.song?.duration || 0);
    // Seeking outside a selected practice range is intentional; playback may continue there.
    if (this.loop.enabled && (this.position < this.loop.start || this.position >= this.loop.end)) this.loop.enabled = false;
    if (playing) this.start();
    this.onchange();
  }
  update(options) {
    const playing = this.playing;
    this.pause();
    Object.assign(this, options);
    if (playing) this.start();
    this.onchange();
  }
  setLoop(loop) {
    if (!(loop.start >= 0 && loop.end <= this.song.duration + 1e-6 && loop.end - loop.start >= .1)) throw new Error('请选择至少 0.1 秒的有效片段');
    this.update({ loop: { ...loop } });
  }
  resumeSustained(time, when) {
    for (const note of this.song.notes) {
      if (note.time >= time - 1e-8) break;
      if (note.soundEnd > time) this.schedule(note, when, time);
    }
  }
  schedule(note, when, startingAt = note.time) {
    if (!this.hands[note.hand]) return;
    const end = Math.min(note.soundEnd, this.loop.enabled ? this.loop.end : this.song.duration);
    this.audio.playNote({ midi: note.midi + this.transpose, when,
      duration: (end - startingAt) / this.rate, velocity: note.velocity,
      elapsed: (startingAt - note.time) / this.rate,
    });
  }
  tick() {
    if (!this.playing) return;
    const now = this.audio.now();
    const raw = this.rawPosition(now);
    if (!this.loop.enabled && raw >= this.song.duration) {
      this.pause();
      this.position = this.song.duration;
      this.onended();
      return;
    }
    // If the browser throttled timers, skip stale audio instead of playing a backlog.
    if (this.scheduledUntil < now - .03) {
      this.scheduledUntil = now;
      this.audio.stopAll();
      this.resumeSustained(this.getPosition(), now);
    }
    const until = now + .13;
    if (until <= this.scheduledUntil) return;
    const from = this.rawPosition(this.scheduledUntil);
    const to = this.rawPosition(until);
    for (const segment of loopSegments(from, to, this.loop)) {
      if (segment.wrapped) this.resumeSustained(segment.start, this.anchorClock + (segment.start + segment.offset - this.anchorPosition) / this.rate);
      for (let i = lowerBound(this.song.notes, segment.start); i < this.song.notes.length; i++) {
        const note = this.song.notes[i];
        if (note.time >= segment.end - 1e-8) break;
        const when = this.anchorClock + (note.time + segment.offset - this.anchorPosition) / this.rate;
        this.schedule(note, when);
      }
    }
    this.scheduledUntil = until;
  }
}
