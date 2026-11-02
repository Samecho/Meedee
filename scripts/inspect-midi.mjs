import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync('vendor/Midi.js', 'utf8'), context);
const midi = new context.Midi(readFileSync(process.argv[2] || 'assets/midi/canon-piano.mid'));
console.log(JSON.stringify({
  duration: midi.duration, name: midi.name, tempos: midi.header.tempos,
  timeSignatures: midi.header.timeSignatures, keys: midi.header.keySignatures,
  meta: midi.header.meta,
  tracks: midi.tracks.map(track => ({
    name: track.name, count: track.notes.length,
    range: [Math.min(...track.notes.map(n => n.midi)), Math.max(...track.notes.map(n => n.midi))],
    first: track.notes.slice(0, 4).map(n => ({ name: n.name, time: n.time, duration: n.duration })),
    cc: Object.keys(track.controlChanges),
  })),
}, null, 2));
