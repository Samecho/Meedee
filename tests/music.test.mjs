import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BUILTINS, assignHands, createSong, keyName, loopSegments, measureAt, pianoLayout } from '../src/music.js';
const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const BUILTIN = BUILTINS.find(song => song.id === 'canon-in-d');
const readCanon = () => new context.Midi(readFileSync('assets/midi/canon-piano.mid'));

test('The built-in library has distinct playable songs with River first', () => {
  assert.equal(BUILTINS[0].id, 'river-flows-in-you');
  assert.equal(new Set(BUILTINS.map(song => song.id)).size, BUILTINS.length);
  for (const metadata of BUILTINS) {
    const song = createSong(new context.Midi(readFileSync(metadata.url)), metadata);
    assert.ok(song.notes.some(note => note.hand === 'left'));
    assert.ok(song.notes.some(note => note.hand === 'right'));
    assert.ok(song.duration > 120);
  }
});

test('River Flows in You includes the complete two-hand transcription and ending', () => {
  const metadata = BUILTINS.find(song => song.id === 'river-flows-in-you');
  const song = createSong(new context.Midi(readFileSync(metadata.url)), metadata);
  const right = song.notes.filter(note => note.hand === 'right');
  const left = song.notes.filter(note => note.hand === 'left');
  assert.equal(song.notes.length, 841);
  assert.equal(song.measures.length, 45);
  assert.ok(Math.abs(song.duration - 166.98325) < .001);
  assert.equal(right.length, 544);
  assert.equal(left.length, 297);
  assert.deepEqual(right.slice(0, 8).map(note => note.midi), [81, 80, 81, 80, 81, 76, 81, 74]);
  assert.deepEqual(left.slice(0, 6).map(note => note.midi), [54, 61, 66, 50, 57, 64]);
  assert.equal(right.at(-1).midi, 81);
  assert.equal(left.at(-1).midi, 61);
  assert.ok(right.at(-1).end > 166);
  assert.ok(left.at(-1).end > 166);
  assert.ok(right.some(note => note.midi < 60));
  assert.ok(left.some(note => note.midi > 60));
  assert.equal(keyName(song), 'A 大调');
  assert.equal(keyName(song, 2), 'B 大调');
});

test('River follows the reviewed score passages and maintains the tied chord', () => {
  const midi = new context.Midi(readFileSync('assets/midi/river-flows-in-you.mid'));
  const [right, left] = midi.tracks;
  const at = (track, bar, beat) => Array.from(track.notes).filter(note =>
    note.ticks === ((bar - 1) * 4 + (bar > 20 ? 1 : 0) + beat) * 480);
  assert.deepEqual(at(left, 11, 2.5).map(note => note.midi), [57]);
  assert.deepEqual(at(right, 21, 2.5).map(note => note.midi), [76]);
  assert.deepEqual(at(right, 30, 2.25).map(note => note.midi), [71]);
  assert.deepEqual(at(right, 31, 3.25).map(note => note.midi), [81]);
  assert.deepEqual(at(right, 32, 2.75).map(note => note.midi), [71]);
  assert.deepEqual(at(left, 38, 1).map(note => note.midi), [69]);
  assert.deepEqual(at(right, 10, 3).map(note => note.midi).sort((a, b) => a - b), [76, 83]);
  assert.deepEqual(at(right, 26, 3).map(note => note.midi).sort((a, b) => a - b), [76, 83]);
  assert.deepEqual(at(right, 42, 3.75).map(note => note.midi), [68]);
  const tied = at(right, 23, 0);
  assert.deepEqual(tied.map(note => note.midi).sort((a, b) => a - b), [64, 69]);
  assert.ok(tied.every(note => note.durationTicks > 480));
  assert.equal(at(right, 23, 1).length, 0);
});

test('Galloway Canon contains all 46 measures, both hands and the familiar opening', () => {
  const midi = readCanon();
  const song = createSong(midi, BUILTIN);
  assert.equal(song.measures.length, 46);
  assert.ok(Math.abs(song.duration - 180.8241) < .01);
  assert.equal(song.notes.filter(n => n.hand === 'right').length, 511);
  assert.equal(song.notes.filter(n => n.hand === 'left').length, 520);
  assert.deepEqual(song.notes.filter(n => n.hand === 'right').slice(0, 8).map(n => n.midi), [78, 76, 74, 73, 71, 69, 71, 73]);
  assert.equal(midi.header.keySignatures[0].key, 'D');
});
test('The full source transcription is preserved, including every pitch, duration and velocity', () => {
  const source = new context.Midi(readFileSync('assets/source/canon-galloway-community.mid'));
  const output = readCanon();
  const events = midi => midi.tracks.flatMap(t => t.notes.map(n => [n.midi, n.ticks, n.durationTicks, n.velocity].join(':'))).sort();
  assert.deepEqual(events(output), events(source));
  assert.equal(output.header.tempos.length, source.header.tempos.length);
  source.header.tempos.forEach((tempo, index) => {
    assert.equal(output.header.tempos[index].ticks, tempo.ticks);
    assert.ok(Math.abs(output.header.tempos[index].bpm - tempo.bpm) < .001);
  });
});
test('The rising left-hand accompaniment stays blue even above middle C', () => {
  const song = createSong(readCanon(), BUILTIN);
  assert.deepEqual(song.notes.filter(n => n.hand === 'left').slice(0, 8).map(n => n.midi), [50, 57, 62, 66, 45, 52, 57, 61]);
});
test('Original hand labels survive crossing middle C; optional pitch split is explicit', () => {
  const song = createSong(readCanon(), BUILTIN);
  const crossing = song.notes.find(n => n.hand === 'right' && n.midi < 60);
  assert.ok(crossing);
  assignHands(song, 'pitch', 60);
  assert.equal(crossing.hand, 'left');
  assignHands(song, 'auto');
  assert.equal(crossing.hand, 'right');
});
test('Transposing D major to C or E updates the label without modifying source pitches', () => {
  const song = createSong(readCanon(), BUILTIN);
  const first = song.notes[0].midi;
  assert.equal(keyName(song, -2), 'C 大调');
  assert.equal(keyName(song, 2), 'E 大调');
  assert.equal(song.notes[0].midi, first);
});
test('Measure boundaries include the selected final bar and use musical time', () => {
  const song = createSong(readCanon(), BUILTIN);
  assert.equal(measureAt(song, song.measures[4].time).index, 5);
  assert.equal(measureAt(song, song.duration).index, 46);
  assert.ok(Math.abs(song.measures[3].end - 16) < .001);
});
test('Black piano keys align with the gap between white keys', () => {
  const layout = pianoLayout(700, 60, 71);
  assert.equal(layout.keys.get(60).x, 0);
  assert.equal(layout.keys.get(62).x, 100);
  assert.equal(layout.keys.get(61).x + layout.keys.get(61).width / 2, 100);
});
test('The complete piano layout has exactly 88 keys', () => {
  const layout = pianoLayout(1040, 21, 108);
  assert.equal(layout.keys.size, 88);
  assert.equal([...layout.keys.values()].filter(k => !k.black).length, 52);
});
test('Audio windows map precisely across one or several loop boundaries', () => {
  const loop = { enabled: true, start: 2, end: 10 };
  assert.deepEqual(loopSegments(9.9, 10.2, loop).map(s => [s.start, s.end, s.offset]), [[9.9, 10, 0], [2, 2.1999999999999993, 8]]);
  const segments = loopSegments(18, 26.2, loop);
  assert.equal(segments[0].start, 2);
  assert.equal(segments[0].offset, 16);
  assert.ok(segments[0].wrapped);
  assert.equal(segments.at(-1).offset, 24);
});
test('Tempo changes are used in bar placement instead of assuming one fixed BPM', () => {
  const midi = new context.Midi();
  midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 1920, bpm: 60 }];
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];
  midi.header.update();
  midi.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 3840, velocity: .8 });
  const song = createSong(midi);
  assert.equal(song.measures.length, 2);
  assert.equal(song.measures[0].end, 2);
  assert.equal(song.measures[1].end, 6);
});
test('Sustain waits for pedal release even if the pedal sends repeated on events', () => {
  const midi = new context.Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: .5, velocity: .8 });
  track.addNote({ midi: 62, time: 2, duration: .2, velocity: .8 });
  track.addCC({ number: 64, time: .1, value: 1 });
  track.addCC({ number: 64, time: .8, value: 1 });
  track.addCC({ number: 64, time: 1.4, value: 0 });
  const song = createSong(midi);
  assert.ok(Math.abs(song.notes[0].soundEnd - 1.4) < .005);
  assert.equal(song.notes[0].end, .5);
});
test('Empty MIDI files are rejected with a readable error', () => {
  assert.throws(() => createSong(new context.Midi()), /没有可播放/);
});
