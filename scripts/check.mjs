import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
for (const dir of ['src', 'scripts', 'tests']) {
  for (const file of await readdir(dir)) {
    if (!/\.m?js$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(dir, file)], { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
  }
}
const html = await readFile('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (ids.length !== new Set(ids).size) throw new Error('Duplicate element IDs');
for (const file of ['src/app.js']) {
  const text = await readFile(file, 'utf8');
  for (const [, id] of text.matchAll(/\$\('([\w-]+)'\)/g)) if (!ids.includes(id) && id !== 'focus-exit') throw new Error(`Missing UI element: ${id}`);
}
console.log('JavaScript syntax and UI element references passed.');
