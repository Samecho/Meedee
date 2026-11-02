export const HAND_COLORS = { left: '#91d5bd', right: '#e9b998' };
export const BUILTIN = {
  id: 'canon-in-d', title: 'Canon in D', composer: 'Johann Pachelbel',
  subtitle: '完整钢琴编曲 · Noctave 版', key: 2, scale: 'major',
  url: './assets/midi/canon-piano.mid', endBeats: 228,
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export function noteName(midi, octave = true) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return names[((midi % 12) + 12) % 12] + (octave ? Math.floor(midi / 12) - 1 : '');
}
export function keyName(song, transpose = 0) {
  if (song.key == null) return transpose === 0 ? '原调' : `${transpose > 0 ? '+' : ''}${transpose} 半音`;
  const names = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return `${names[((song.key + transpose) % 12 + 12) % 12]} ${song.scale === 'minor' ? '小调' : '大调'}`;
}

export function lowerBound(notes, time) {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].time < time - 1e-8) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function inferTrackHands(tracks) {
  const active = tracks.map((track, index) => ({ track, index })).filter(({ track }) => track.notes.length);
  const hands = {};
  for (const { track, index } of active) {
    if (/left|\blh\b|\bl\.h\.|bass|左/i.test(track.name)) hands[index] = 'left';
    if (/right|\brh\b|\br\.h\.|treble|右/i.test(track.name)) hands[index] = 'right';
  }
  const median = track => {
    const pitches = track.notes.map(n => n.midi).sort((a, b) => a - b);
    return pitches[Math.floor(pitches.length / 2)];
  };
  if (active.length === 2) {
    const sorted = [...active].sort((a, b) => median(a.track) - median(b.track));
    for (const [i, { index }] of sorted.entries()) hands[index] ??= i === 0 ? 'left' : 'right';
  } else if (active.length > 2) {
    for (const { track, index } of active) hands[index] ??= median(track) < 60 ? 'left' : 'right';
  }
  return hands;
}

export function assignHands(song, method = 'auto', split = 60) {
  for (const note of song.notes) note.hand = method === 'pitch' ? (note.midi < split ? 'left' : 'right') : (song.trackHands[note.track] ?? (note.midi < split ? 'left' : 'right'));
  return song;
}

function pedalEnd(end, pedal, duration) {
  let on = false;
  for (let i = 0; i < pedal.length; i++) {
    const event = pedal[i];
    if (event.time <= end + 1e-8) on = event.value >= .5;
    else if (!on) return end;
    else if (event.value < .5) return Math.min(event.time, duration);
  }
  return on ? duration : end;
}

export function buildMeasures(midi, duration) {
  const ppq = midi.header.ppq;
  const signatures = [...midi.header.timeSignatures].sort((a, b) => a.ticks - b.ticks);
  if (!signatures.length || signatures[0].ticks > 0) signatures.unshift({ ticks: 0, timeSignature: [4, 4] });
  const measures = [], beats = [];
  let tick = 0, signatureIndex = 0;
  while (midi.header.ticksToSeconds(tick) < duration - 1e-5 && measures.length < 20000) {
    while (signatures[signatureIndex + 1]?.ticks <= tick) signatureIndex++;
    const [numerator, denominator] = signatures[signatureIndex].timeSignature;
    if (!(numerator > 0 && numerator <= 64 && denominator > 0 && denominator <= 128)) throw new Error('这个 MIDI 的拍号不受支持');
    const beatTicks = ppq * 4 / denominator;
    const endTick = Math.min(tick + numerator * beatTicks, signatures[signatureIndex + 1]?.ticks ?? Infinity);
    const time = midi.header.ticksToSeconds(tick);
    const end = Math.min(midi.header.ticksToSeconds(endTick), duration);
    measures.push({ index: measures.length + 1, time, end });
    for (let b = 0; b < numerator && tick + b * beatTicks < endTick; b++) {
      const beatTime = midi.header.ticksToSeconds(tick + b * beatTicks);
      if (beatTime < duration) beats.push({ time: beatTime, measure: b === 0, label: measures.length });
    }
    tick = endTick;
  }
  return { measures, beats };
}

export function createSong(midi, metadata = {}) {
  const tracks = midi.tracks.filter(track => !track.instrument.percussion);
  const totalNotes = tracks.reduce((sum, t) => sum + t.notes.length, 0);
  if (!totalNotes) throw new Error('这个 MIDI 没有可播放的音符');
  if (totalNotes > 100000) throw new Error('这个文件的音符过多，请导入 10 万个音符以内的 MIDI');
  const ppq = midi.header.ppq;
  if (!(ppq > 0 && ppq < 32768)) throw new Error('暂不支持 SMPTE 时间格式的 MIDI');
  const duration = Math.max(midi.duration, metadata.endBeats ? midi.header.ticksToSeconds(metadata.endBeats * ppq) : 0);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 21600) throw new Error('这个 MIDI 的时长不受支持');
  const notes = [];
  for (const [trackIndex, track] of tracks.entries()) {
    const pedal = track.controlChanges[64] || [];
    for (const [index, note] of track.notes.entries()) {
      if (![note.time, note.duration, note.midi, note.velocity].every(Number.isFinite)) throw new Error('MIDI 含有无法读取的音符');
      if (note.duration <= 0) continue;
      const end = note.time + note.duration;
      notes.push({ id: `${trackIndex}-${index}`, track: trackIndex, midi: note.midi,
        time: note.time, duration: note.duration, end, soundEnd: pedalEnd(end, pedal, duration),
        velocity: clamp(note.velocity, .01, 1),
      });
    }
  }
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  const key = midi.header.keySignatures?.[0];
  const keyMap = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
  const song = { id: metadata.id || `import-${Date.now()}`, title: metadata.title || midi.name || '未命名的曲子',
    composer: metadata.composer || '我的 MIDI', subtitle: metadata.subtitle || '本地导入',
    key: metadata.key ?? keyMap[key?.key], scale: metadata.scale || key?.scale || 'major',
    notes, duration, bpm: midi.header.tempos[0]?.bpm || 120,
    tempos: midi.header.tempos.map(t => ({ time: t.time, bpm: t.bpm })),
    trackHands: inferTrackHands(tracks), ...buildMeasures(midi, duration),
  };
  song.minPitch = notes.reduce((min, note) => Math.min(min, note.midi), 127);
  song.maxPitch = notes.reduce((max, note) => Math.max(max, note.midi), 0);
  return assignHands(song);
}

export function measureAt(song, time) {
  const index = Math.max(0, lowerBound(song.measures, time + 1e-5) - 1);
  return song.measures[index] || { index: 1, time: 0, end: song.duration };
}

export function pianoLayout(width, min = 36, max = 96) {
  const isBlack = midi => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
  while (isBlack(min)) min--;
  while (isBlack(max)) max++;
  const whiteCount = Array.from({ length: max - min + 1 }, (_, i) => i + min).filter(n => !isBlack(n)).length;
  const whiteWidth = width / whiteCount;
  const keys = new Map();
  let white = 0;
  for (let midi = min; midi <= max; midi++) {
    const black = isBlack(midi);
    keys.set(midi, { midi, black, x: black ? white * whiteWidth - whiteWidth * .31 : white * whiteWidth, width: black ? whiteWidth * .62 : whiteWidth });
    if (!black) white++;
  }
  return { keys, whiteWidth, min, max };
}

// A monotonically advancing audio-clock window can cross a loop boundary.
// Each segment maps back to song seconds without changing note pitch.
export function loopSegments(from, to, loop) {
  if (!loop?.enabled) return [{ start: from, end: to, offset: 0, wrapped: false }];
  const length = loop.end - loop.start;
  if (!(length >= .1)) throw new Error('循环片段至少需要 0.1 秒');
  const result = [];
  let raw = from;
  while (raw < to - 1e-9 && result.length < 100) {
    const cycle = raw < loop.end - 1e-8 ? 0 : Math.floor((raw - loop.end + 1e-8) / length) + 1;
    const offset = cycle * length;
    const start = raw - offset;
    const end = Math.min(to, loop.end + offset);
    result.push({ start, end: end - offset, offset, wrapped: cycle > 0 && Math.abs(start - loop.start) < 1e-7 });
    raw = end;
  }
  return result;
}
