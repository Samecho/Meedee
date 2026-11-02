import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const data = JSON.parse(readFileSync('assets/source/canon-notes.json', 'utf8'));
const midi = new context.Midi();
midi.header.name = 'Canon in D - full piano arrangement';
midi.header.setTempo(data.tempo);
midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];
midi.header.keySignatures = [{ ticks: 0, key: 'D', scale: 'major' }];
midi.header.meta.push({ ticks: 0, type: 'text', text: 'Pachelbel. Noctave, after Michael Fischer v. Mollard / Mutopia Project, CC BY 4.0. MIDI conversion for Meedee; notes preserved.' });
for (const [index, hand] of ['right', 'left'].entries()) {
  const track = midi.addTrack();
  track.name = hand === 'right' ? 'Right Hand' : 'Left Hand';
  track.channel = index;
  track.instrument.number = 0;
  for (const note of data.hands[hand]) track.addNote({
    midi: note.midi, ticks: Math.round(note.beats * midi.header.ppq),
    durationTicks: Math.round(note.duration * midi.header.ppq), velocity: hand === 'right' ? .76 : .63,
  });
}
const bytes = Buffer.from(midi.toArray());
// @tonejs/midi 2.0.28 encodes the key index with +7 instead of -7.
// Correct the SMF key-signature event to two sharps (D major).
const keyEvent = bytes.indexOf(Buffer.from([0xff, 0x59, 0x02]));
if (keyEvent < 0) throw new Error('Missing key signature');
bytes[keyEvent + 3] = 2;
writeFileSync('assets/midi/canon-piano.mid', bytes);
console.log(`Canon: ${data.measures} bars, ${midi.duration.toFixed(2)} seconds; right ${data.hands.right.length}, left ${data.hands.left.length} notes.`);
