import test from 'node:test';
import assert from 'node:assert/strict';
import { Transport } from '../src/transport.js';

class FakeAudio {
  clock = 0;
  notes = [];
  generation = 0;
  now() { return this.clock; }
  stopAll() { this.generation++; }
  playNote(note) { this.notes.push({ ...note, generation: this.generation }); }
}
const song = {
  duration: 4, measures: [{ time: 0, end: 2 }, { time: 2, end: 4 }],
  notes: [0, 1, 2, 3].map((time, i) => ({ time, midi: 60 + i, duration: .6, end: time + .6, soundEnd: time + .6, velocity: .8, hand: i % 2 ? 'left' : 'right' })),
};
function setup(t) { const audio = new FakeAudio(); const transport = new Transport(audio); transport.load(song); t.after(() => transport.pause()); return { audio, transport }; }

test('Playback uses the audio clock and stops all scheduled voices on pause', t => {
  const { audio, transport } = setup(t);
  transport.start(); audio.clock = .4;
  assert.equal(transport.getPosition(), .4);
  transport.pause(); audio.clock = 1.3;
  assert.equal(transport.getPosition(), .4);
  assert.equal(transport.playing, false);
});
test('Speed changes preserve position and change duration, independently of pitch', t => {
  const { audio, transport } = setup(t);
  transport.start(); audio.clock = .2; transport.update({ rate: .5 });
  assert.equal(transport.getPosition(), .2);
  audio.clock = .4;
  assert.ok(Math.abs(transport.getPosition() - .3) < 1e-8);
  const resumed = audio.notes.at(-1);
  assert.equal(resumed.midi, 60);
  assert.ok(Math.abs(resumed.duration - .8) < 1e-8);
});
test('Transposition changes pitches while preserving musical time', t => {
  const { audio, transport } = setup(t);
  transport.start(); audio.clock = .2; transport.update({ transpose: 2 });
  assert.equal(audio.notes.at(-1).midi, 62);
  assert.ok(Math.abs(audio.notes.at(-1).duration - .4) < 1e-8);
  assert.equal(transport.getPosition(), .2);
});
test('Seek cancels old notes and resumes sounding notes in the new position', t => {
  const { audio, transport } = setup(t);
  transport.start(); transport.seek(2.1);
  assert.equal(audio.notes.at(-1).midi, 62);
  assert.ok(Math.abs(audio.notes.at(-1).duration - .5) < 1e-8);
  assert.equal(transport.getPosition(), 2.1);
  assert.equal(transport.playing, true);
});
test('Disabled hands remain silent, including after seeking', t => {
  const { audio, transport } = setup(t);
  transport.update({ hands: { left: false, right: true } });
  transport.seek(1); transport.start();
  assert.equal(audio.notes.length, 0);
  transport.seek(2);
  assert.equal(audio.notes.at(-1).midi, 62);
});
test('Count-in schedules the first note at the future downbeat', t => {
  const { audio, transport } = setup(t);
  transport.start(3);
  assert.equal(transport.getPosition(true), -3);
  assert.equal(audio.notes.length, 0);
  audio.clock = 2.9; transport.tick();
  assert.equal(audio.notes[0].when, 3);
  assert.equal(audio.notes[0].midi, 60);
});
test('Loop lookahead schedules the next cycle before the current cycle ends', t => {
  const { audio, transport } = setup(t);
  transport.setLoop({ enabled: true, start: 1, end: 3 });
  transport.seek(2.95); transport.start();
  const firstLoopNote = audio.notes.find(n => n.midi === 61);
  assert.ok(firstLoopNote);
  assert.ok(Math.abs(firstLoopNote.when - .05) < 1e-8);
  audio.clock = .1;
  assert.ok(Math.abs(transport.getPosition() - 1.05) < 1e-8);
});
test('Count-in at a loop start never plays notes from before the A point', t => {
  const { audio, transport } = setup(t);
  transport.setLoop({ enabled: true, start: 1, end: 3 });
  transport.start(3);
  assert.equal(transport.getPosition(), 1);
  assert.equal(transport.countInRemaining(), 3);
  assert.equal(audio.notes.length, 0);
  audio.clock = 2.9; transport.tick();
  assert.equal(audio.notes.length, 1);
  assert.equal(audio.notes[0].midi, 61);
  assert.equal(audio.notes[0].when, 3);
});
test('Adjacent scheduler windows never repeat a note on their shared boundary', t => {
  const { audio, transport } = setup(t);
  transport.start();
  for (let tick = 1; tick < 61; tick++) { audio.clock = tick * .025; transport.tick(); }
  assert.equal(audio.notes.filter(n => n.midi === 61).length, 1);
});
test('Seeking beyond the loop turns it off instead of jumping back unexpectedly', t => {
  const { transport } = setup(t);
  transport.setLoop({ enabled: true, start: 1, end: 3 });
  transport.seek(3.5);
  assert.equal(transport.loop.enabled, false);
  assert.equal(transport.getPosition(), 3.5);
});
test('Playback finishes at the end and can restart from the beginning', t => {
  const { audio, transport } = setup(t);
  let ended = 0; transport.onended = () => ended++;
  transport.start(); audio.clock = 4.1; transport.tick();
  assert.equal(transport.playing, false);
  assert.equal(transport.position, 4);
  assert.equal(ended, 1);
  transport.start(); assert.equal(transport.getPosition(), 0);
});
