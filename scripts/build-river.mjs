import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const midi = new context.Midi(readFileSync('assets/source/river-bestpianocla6.mid'));
assert.equal(midi.header.ppq, 480);
assert.equal(midi.tracks.length, 2);
const [right, left] = midi.tracks;

// The source has 4/4 bars, except for the 5/4 bar 20. Beat is zero-based.
const ticksAt = (bar, beat) => ((bar - 1) * 4 + (bar > 20 ? 1 : 0) + beat) * 480;
function noteAt(track, bar, beat, pitch) {
  const matches = track.notes.filter(note => note.ticks === ticksAt(bar, beat) && note.midi === pitch);
  assert.equal(matches.length, 1, `Unexpected source note at bar ${bar}, beat ${beat}, pitch ${pitch}`);
  return matches[0];
}

// Reviewed against the early published scores described in CREDITS.md.
// Bar 31 keeps the A5 in the earlier Korean edition; the 2005 edition has C#6.
const pitchCorrections = [
  [left, 11, 2.5, 59, 57],
  [left, 15, 1, 64, 66], [left, 15, 2.5, 59, 57],
  [left, 17, 3, 61, 64], [right, 21, 2.5, 80, 76],
  [right, 30, 2.25, 69, 71], [right, 30, 2.75, 69, 71],
  [right, 32, 2.25, 69, 71], [right, 32, 2.75, 69, 71],
  [left, 37, 2, 52, 54], [left, 37, 3.5, 52, 54],
  [left, 38, 1, 57, 69],
];
for (const [track, bar, beat, before, after] of pitchCorrections) {
  noteAt(track, bar, beat, before).midi = after;
}

// The two grace chords each lack one pitch in the community transcription.
for (const [bar, addedPitch, existingPitch] of [[10, 76, 83], [26, 83, 76]]) {
  const existing = noteAt(right, bar, 3, existingPitch);
  right.addNote({ midi: addedPitch, ticks: existing.ticks, durationTicks: existing.durationTicks, velocity: existing.velocity });
}
const previous = noteAt(right, 42, 3.5, 69);
right.addNote({ midi: 68, ticks: ticksAt(42, 3.75), durationTicks: previous.durationTicks, velocity: previous.velocity });

// The chord at the start of bar 23 is tied across the next beat.
for (const pitch of [64, 69]) {
  const start = noteAt(right, 23, 0, pitch);
  const continuation = noteAt(right, 23, 1, pitch);
  start.durationTicks = continuation.ticks + continuation.durationTicks - start.ticks;
  right.notes.splice(right.notes.indexOf(continuation), 1);
}
right.name = 'Right Hand';
left.name = 'Left Hand';
right.channel = 0;
left.channel = 1;

const bytes = Buffer.from(midi.toArray());
// Correct @tonejs/midi 2.0.28's major-key signature encoder for A major.
const marker = Buffer.from([0xff, 0x59, 0x02]);
let offset = 0, keyEvents = 0;
while ((offset = bytes.indexOf(marker, offset)) >= 0) {
  bytes[offset + 3] = 3;
  offset += 5;
  keyEvents++;
}
assert.ok(keyEvents > 0, 'Missing key signature');
const output = new context.Midi(bytes);
assert.ok(output.header.keySignatures.every(key => key.key === 'A' && key.scale === 'major'));
assert.deepEqual(Array.from(output.tracks, track => track.notes.length), [544, 297]);
writeFileSync('assets/midi/river-flows-in-you.mid', bytes);
console.log(`River: ${output.tracks[0].notes.length} right, ${output.tracks[1].notes.length} left, ${output.duration.toFixed(2)} seconds.`);
