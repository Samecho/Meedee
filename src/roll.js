import { HAND_COLORS, pianoLayout, noteName, lowerBound, clamp } from './music.js';

export class PianoRoll {
  constructor(canvas, transport) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.transport = transport;
    this.labels = true;
    this.lookahead = 12;
    this.fullRange = false;
    this.width = 0;
    this.height = 0;
    this.invalid = true;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
    this.resize();
  }
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
    this.invalid = true;
  }
  layout() {
    const { song, transpose } = this.transport;
    let min = 36, max = 96;
    if (this.fullRange) { min = 21; max = 108; }
    else if (song) {
      min = clamp(Math.floor((song.minPitch + transpose - 2) / 12) * 12, 0, 120);
      max = clamp(Math.ceil((song.maxPitch + transpose + 2) / 12) * 12, min + 12, 127);
    }
    this.keyboard = pianoLayout(this.width, min, max);
    this.keyHeight = clamp(this.height * .255, 64, 112);
    this.hitY = this.height - this.keyHeight;
    this.invalid = true;
  }
  draw(force = false) {
    const transport = this.transport;
    if (!force && !transport.playing && !this.invalid) return;
    this.invalid = false;
    const { ctx, width, height, hitY, keyboard } = this;
    if (!width || !height) return;
    const position = transport.getPosition(true);
    const song = transport.song;
    const preparing = transport.countInRemaining() > 0;
    const px = hitY / this.lookahead;
    ctx.fillStyle = '#111b1a';
    ctx.fillRect(0, 0, width, height);
    if (!song) return;
    for (const key of keyboard.keys.values()) {
      if (key.black) {
        ctx.fillStyle = '#0d15155c';
        ctx.fillRect(key.x, 0, key.width, hitY);
      } else {
        ctx.strokeStyle = key.midi % 12 === 0 ? '#36463c60' : '#25332e55';
        ctx.lineWidth = key.midi % 12 === 0 ? 1 : .5;
        ctx.beginPath(); ctx.moveTo(key.x, 0); ctx.lineTo(key.x, hitY); ctx.stroke();
      }
    }
    for (let i = lowerBound(song.beats, position - .05); i < song.beats.length; i++) {
      const beat = song.beats[i];
      if (beat.time > position + this.lookahead) break;
      const y = hitY - (beat.time - position) * px;
      ctx.strokeStyle = beat.measure ? '#52604c45' : '#43523d1e';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      if (beat.measure && y > 12 && y < hitY - 15) {
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = '#68785f9c'; ctx.fillText(String(beat.label).padStart(2, '0'), 8, y - 5);
      }
    }
    const active = new Map();
    for (const note of song.notes) {
      if (note.time > position + this.lookahead + .1) break;
      if (preparing && note.end <= transport.anchorPosition) continue;
      const isActive = !preparing && note.time <= position + .015 && note.end > position;
      if (note.end < position && !isActive) continue;
      const key = keyboard.keys.get(note.midi + transport.transpose);
      if (!key) continue;
      const color = HAND_COLORS[note.hand];
      const enabled = transport.hands[note.hand];
      if (isActive && enabled) active.set(key.midi, note.hand);
      const y1 = Math.max(-10, hitY - (note.end - position) * px);
      const y2 = Math.min(hitY, hitY - (note.time - position) * px);
      if (y2 < 0 || y1 >= hitY || y2 - y1 < .4) continue;
      const padding = key.black ? 1 : 2;
      const x = key.x + padding, w = key.width - padding * 2;
      const h = Math.max(3, y2 - y1 - 2);
      ctx.globalAlpha = enabled ? 1 : .15;
      const gradient = ctx.createLinearGradient(0, y1, 0, y1 + h);
      gradient.addColorStop(0, note.hand === 'left' ? '#68a88c' : '#bd906e');
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.roundRect(x, y1, w, h, Math.min(4, w / 3)); ctx.fill();
      ctx.strokeStyle = note.hand === 'left' ? '#c0e8cd55' : '#ffe1b755';
      ctx.lineWidth = .7;
      ctx.stroke();
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(x + 1, y1 + 3, 1, Math.max(0, h - 6));
      if (this.labels && w > 14 && h > 19) {
        ctx.fillStyle = note.hand === 'left' ? '#1a4032' : '#563a28';
        ctx.textAlign = 'center';
        ctx.font = `${Math.min(10, w * .45)}px "Segoe UI", sans-serif`;
        ctx.fillText(noteName(key.midi, false), x + w / 2, Math.min(y1 + h - 6, y1 + 16));
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    }
    const fade = ctx.createLinearGradient(0, 0, 0, Math.min(hitY, 50));
    fade.addColorStop(0, '#111b1ad9'); fade.addColorStop(1, '#111b1a00');
    ctx.fillStyle = fade; ctx.fillRect(0, 0, width, 50);
    const glow = ctx.createLinearGradient(0, hitY - 20, 0, hitY);
    glow.addColorStop(0, '#a8d9ad00'); glow.addColorStop(1, '#b0d6a512');
    ctx.fillStyle = glow; ctx.fillRect(0, hitY - 20, width, 20);
    ctx.fillStyle = '#bfd4ae'; ctx.fillRect(0, hitY - 1.5, width, 1.5);
    for (const black of [false, true]) {
      for (const key of keyboard.keys.values()) {
        if (key.black !== black) continue;
        const hand = active.get(key.midi);
        const y = hitY + 2, h = black ? this.keyHeight * .63 : this.keyHeight - 3;
        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        if (hand) {
          gradient.addColorStop(0, HAND_COLORS[hand]);
          gradient.addColorStop(1, hand === 'left' ? '#b3d8b7' : '#eed1ae');
        } else if (black) {
          gradient.addColorStop(0, '#28332e'); gradient.addColorStop(.85, '#131b18'); gradient.addColorStop(1, '#0a110f');
        } else {
          gradient.addColorStop(0, '#c3c9bb'); gradient.addColorStop(.7, '#dedfd1'); gradient.addColorStop(1, '#b3bca9');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.roundRect(key.x + .6, y, Math.max(1, key.width - 1.2), h, [0, 0, black ? 3 : 4, black ? 3 : 4]); ctx.fill();
        if (black) {
          ctx.fillStyle = hand ? '#fff3' : '#68785b33';
          ctx.fillRect(key.x + 3, y + h - 7, key.width - 6, 2);
        } else if (key.midi % 12 === 0 || (this.labels && keyboard.whiteWidth > 22)) {
          ctx.fillStyle = hand ? '#284734' : '#5c6e56';
          ctx.font = `${key.midi % 12 === 0 ? 10 : 9}px "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(noteName(key.midi, key.midi % 12 === 0), key.x + key.width / 2, y + h - 12);
          ctx.textAlign = 'left';
        }
      }
    }
    for (const [midi, hand] of active) {
      const key = keyboard.keys.get(midi);
      ctx.fillStyle = HAND_COLORS[hand];
      ctx.shadowColor = HAND_COLORS[hand]; ctx.shadowBlur = 14;
      ctx.fillRect(key.x + 1, hitY - 3, key.width - 2, 3);
      ctx.shadowBlur = 0;
    }
  }
}

export function drawWaveform(canvas, song) {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const count = Math.max(1, Math.floor(box.width / 4));
  const density = new Float32Array(count);
  for (const note of song.notes) density[Math.min(count - 1, Math.floor(note.time / song.duration * count))] += note.velocity;
  const peak = Math.max(1, ...density);
  ctx.fillStyle = '#64836c';
  for (let i = 0; i < count; i++) {
    const h = 3 + (density[i] / peak) ** .6 * 18;
    ctx.fillRect(i * box.width / count, (box.height - h) / 2, 1.5, h);
  }
}
