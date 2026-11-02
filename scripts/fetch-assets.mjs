import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = [
  ['vendor/Midi.js', 'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.js'],
  ['vendor/Midi.LICENSE', 'https://raw.githubusercontent.com/Tonejs/Midi/master/LICENSE.md'],
  ['vendor/midi-file.LICENSE', 'https://raw.githubusercontent.com/carter-thaxton/midi-file/master/LICENSE.md'],
  ['vendor/array-flatten.LICENSE', 'https://raw.githubusercontent.com/blakeembrey/array-flatten/master/LICENSE'],
  ['assets/source/canon-piano.mxl', 'https://noctavepiano.com/partitions/pachelbel-canon/pachelbel-canon.mxl'],
  ['assets/piano/README.txt', 'https://raw.githubusercontent.com/Tonejs/audio/master/salamander/README'],
];
for (let octave = 0; octave <= 7; octave++) {
  assets.push([`assets/piano/A${octave}.mp3`, `https://raw.githubusercontent.com/Tonejs/audio/master/salamander/A${octave}.mp3`]);
  if (octave > 0) assets.push([`assets/piano/Ds${octave}.mp3`, `https://raw.githubusercontent.com/Tonejs/audio/master/salamander/Ds${octave}.mp3`]);
}
assets.push(['assets/piano/C8.mp3', 'https://raw.githubusercontent.com/Tonejs/audio/master/salamander/C8.mp3']);

const selected = process.argv[2] ? assets.filter(([relative]) => relative.includes(process.argv[2])) : assets;
let failed = false;
for (let i = 0; i < selected.length; i += 4) {
  await Promise.all(selected.slice(i, i + 4).map(async ([relative, url]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (relative.endsWith('.mid') && buffer.subarray(0, 4).toString() !== 'MThd') throw new Error('Not a MIDI file');
      const destination = path.join(root, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, buffer);
      console.log(`${relative}: ${buffer.length} bytes`);
    } catch (error) {
      failed = true;
      console.error(`${relative}: ${error.message} ${error.cause?.code ?? ''}`);
    }
  }));
}
if (failed) process.exitCode = 1;
