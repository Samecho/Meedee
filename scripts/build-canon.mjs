import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const source = new context.Midi(readFileSync('assets/source/canon-galloway-community.mid'));
const reference = new context.Midi(readFileSync('assets/source/canon-galloway-hand-reference.mid'));

// Align the full transcription with a separately labelled two-hand transcription.
// The shorter reference is used only for hand labels; its notes never replace
// notes in the full source. The full MIDI's pitches, timing, dynamics and pedal remain.
const refNotes = reference.tracks.flatMap((track, trackIndex) => track.notes.map(note => ({
  midi: note.midi, beat: note.ticks / reference.header.ppq,
  hand: trackIndex === 0 ? 'right' : 'left',
}))).sort((a, b) => a.beat - b.beat || a.midi - b.midi);
const notes = source.tracks[0].notes.map((note, index) => ({
  note, index, midi: note.midi, ticks: note.ticks,
})).sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);
const alignment = Array.from({ length: refNotes.length + 1 }, () => new Uint16Array(notes.length + 1));
for (let i = 1; i <= refNotes.length; i++) for (let j = 1; j <= notes.length; j++) {
  alignment[i][j] = refNotes[i - 1].midi === notes[j - 1].midi
    ? alignment[i - 1][j - 1] + 1 : Math.max(alignment[i - 1][j], alignment[i][j - 1]);
}
const hands = new Map();
let i = refNotes.length, j = notes.length;
while (i && j) {
  if (refNotes[i - 1].midi === notes[j - 1].midi) {
    hands.set(notes[j - 1].index, refNotes[i - 1].hand); i--; j--;
  } else if (alignment[i - 1][j] >= alignment[i][j - 1]) i--;
  else j--;
}
const alignedCount = hands.size;
if (alignedCount < 840) throw new Error('The source no longer matches the reviewed hand reference');
const groups = new Map();
for (const note of notes) {
  if (!groups.has(note.ticks)) groups.set(note.ticks, []);
  groups.get(note.ticks).push(note);
}
for (const group of groups.values()) {
  const leftIsKnown = group.some(note => hands.get(note.index) === 'left');
  const allUnknown = group.every(note => !hands.has(note.index));
  for (const note of group) {
    if (hands.has(note.index)) continue;
    const hand = leftIsKnown ? 'right'
      : allUnknown && group.length > 1 ? (note === group[0] ? 'left' : 'right')
      : note.midi <= 61 ? 'left' : 'right';
    hands.set(note.index, hand);
  }
}
// Reviewed inner melody/chord tones, including right-hand tones below middle C.
for (const index of [156, 336, 338, 518, 521, 529, 542, 555, 568, 581, 963, 971, 979]) hands.set(index, 'right');
hands.set(422, 'left');

const output = new context.Midi();
output.header.fromJSON(source.header.toJSON());
output.header.name = 'Canon in D - Lee Galloway, community transcription';
output.header.keySignatures = [{ ticks: 0, key: 'D', scale: 'major' }];
output.header.meta.push({ ticks: 0, type: 'text', text: 'Arr. Lee Galloway. Full community MIDI shared by SlappingRico (2013). Hand labels aligned against Midi2Piano (2008). Original pitches, durations, velocities, tempo changes and pedal preserved. See CREDITS.md.' });
const tracks = { right: output.addTrack(), left: output.addTrack() };
for (const [channel, hand] of ['right', 'left'].entries()) {
  tracks[hand].name = hand === 'right' ? 'Right Hand' : 'Left Hand';
  tracks[hand].channel = channel;
  tracks[hand].instrument.number = 0;
  for (const [number, changes] of Object.entries(source.tracks[0].controlChanges)) {
    for (const cc of changes) tracks[hand].addCC({ number: Number(number), ticks: cc.ticks, value: cc.value });
  }
}
for (const { note, index } of notes) {
  tracks[hands.get(index)].addNote({ midi: note.midi, ticks: note.ticks, durationTicks: note.durationTicks, velocity: note.velocity });
}
const bytes = Buffer.from(output.toArray());
// Correct the known key-signature encoder offset in @tonejs/midi 2.0.28.
const keyEvent = bytes.indexOf(Buffer.from([0xff, 0x59, 0x02]));
if (keyEvent < 0) throw new Error('Missing key signature');
bytes[keyEvent + 3] = 2;
writeFileSync('assets/midi/canon-piano.mid', bytes);
writeFileSync('assets/source/canon-galloway-hands.json', JSON.stringify({
  source: 'canon-galloway-community.mid',
  reference: 'canon-galloway-hand-reference.mid',
  alignedNotes: alignedCount,
  assignments: Object.fromEntries(hands),
}, null, 2) + '\n');
console.log(JSON.stringify({ notes: notes.length, aligned: alignedCount,
  right: tracks.right.notes.length, left: tracks.left.notes.length, duration: output.duration }));
