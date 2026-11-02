import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BUILTIN, assignHands, createSong, keyName, loopSegments, measureAt, pianoLayout } from '../src/music.js';
const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const readCanon = () => new context.Midi(readFileSync('assets/midi/canon-piano.mid'));

test('Canon contains all 57 measures with separate piano hands and the familiar opening', () => {
  const midi = readCanon();
  const song = createSong(midi, BUILTIN);
  assert.equal(song.measures.length, 57);
  assert.ok(Math.abs(song.duration - 244.2857) < .01);
  assert.equal(song.notes.filter(n => n.hand === 'right').length, 513);
  assert.equal(song.notes.filter(n => n.hand === 'left').length, 450);
  assert.deepEqual(song.notes.filter(n => n.hand === 'right').slice(0, 8).map(n => n.midi), [78, 76, 74, 73, 71, 69, 71, 73]);
  assert.equal(midi.header.keySignatures[0].key, 'D');
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
  assert.equal(measureAt(song, song.duration).index, 57);
  assert.ok(Math.abs(song.measures[3].end - 240 / 56 * 4) < .001);
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
