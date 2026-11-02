import { BUILTIN, assignHands, clamp, createSong, formatTime, keyName, measureAt, noteName } from './music.js';
import { PianoAudio } from './audio.js';
import { Transport } from './transport.js';
import { PianoRoll, drawWaveform } from './roll.js';
import { readImports, saveImport } from './storage.js';

const $ = id => document.getElementById(id);
const preferences = { noteLabels: true, countIn: true, lookahead: 12, handMethod: 'auto', split: 60, volume: .75, speed: 1 };
try {
  const saved = JSON.parse(localStorage.getItem('meedee-preferences') || '{}');
  for (const key of ['noteLabels', 'countIn']) if (typeof saved[key] === 'boolean') preferences[key] = saved[key];
  if ([6, 9, 12, 16].includes(saved.lookahead)) preferences.lookahead = saved.lookahead;
  if (['auto', 'pitch'].includes(saved.handMethod)) preferences.handMethod = saved.handMethod;
  if ([48, 55, 60, 65, 72].includes(saved.split)) preferences.split = saved.split;
  if (Number.isFinite(saved.volume)) preferences.volume = clamp(saved.volume, 0, 1);
  if (Number.isFinite(saved.speed)) preferences.speed = clamp(saved.speed, .25, 1.5);
} catch { /* Private browsing may make local storage unavailable. */ }
const savePreferences = () => { try { localStorage.setItem('meedee-preferences', JSON.stringify(preferences)); } catch {} };
export const audio = new PianoAudio();
export const transport = new Transport(audio);
export const roll = new PianoRoll($('piano-roll'), transport);
export const songs = [];
transport.rate = preferences.speed;
audio.setVolume(preferences.volume);
roll.labels = preferences.noteLabels;
roll.lookahead = preferences.lookahead;
let playRequest = 0, loadingAudio = false, draftLoop = null, draftBarEdits = false, toastTimer, wakeLock;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
}
function openDialog(id) { $(id).showModal(); }
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

function renderLibrary() {
  $('song-count').textContent = String(songs.length).padStart(2, '0');
  for (const id of ['song-list', 'mobile-song-list']) {
    const list = $(id);
    list.replaceChildren();
    for (const [index, song] of songs.entries()) {
      const button = document.createElement('button');
      button.className = `song-card${transport.song?.id === song.id ? ' selected' : ''}`;
      button.setAttribute('aria-label', `选择 ${song.title}`);
      if (transport.song?.id === song.id) button.setAttribute('aria-current', 'true');
      const number = document.createElement('span'); number.className = 'song-number'; number.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('span'); copy.className = 'song-card-copy';
      const title = document.createElement('strong'); title.textContent = song.title;
      const meta = document.createElement('small'); meta.textContent = `${song.id === BUILTIN.id ? 'Pachelbel' : '本地 MIDI'} · ${formatTime(song.duration)}`;
      copy.append(title, meta); button.append(number, copy);
      button.addEventListener('click', () => { selectSong(song); if ($('library-dialog').open) $('library-dialog').close(); });
      list.append(button);
    }
  }
}
function selectSong(song) {
  playRequest++;
  assignHands(song, preferences.handMethod, preferences.split);
  transport.load(song);
  roll.layout();
  $('song-title').textContent = song.title;
  $('song-subtitle').textContent = `${song.composer} · ${song.subtitle}`;
  $('bar-total').textContent = `${song.measures.length} 小节`;
  $('seek').max = song.duration;
  $('total-time').textContent = formatTime(song.duration);
  $('roll-empty').hidden = true;
  $('play-button').disabled = false;
  document.title = `${song.title} · Meedee 钢琴练习室`;
  renderLibrary();
  drawWaveform($('waveform'), song);
  updateUI();
}

function updateUI() {
  const song = transport.song;
  if (!song) return;
  const position = transport.getPosition();
  const countInRemaining = transport.countInRemaining();
  const currentBar = measureAt(song, position).index;
  $('current-time').textContent = formatTime(position);
  $('seek').value = position;
  $('seek').setAttribute('aria-valuetext', `${formatTime(position)}，全长 ${formatTime(song.duration)}`);
  $('timeline-progress').style.width = `${position / song.duration * 100}%`;
  $('measure-counter').textContent = `第 ${currentBar} / ${song.measures.length} 小节`;
  $('key-label').textContent = keyName(song, transport.transpose);
  $('transpose-label').textContent = keyName(song, transport.transpose);
  $('transpose-amount').textContent = transport.transpose ? `${transport.transpose > 0 ? '+' : ''}${transport.transpose} 半音` : '原调';
  $('transpose-down').disabled = transport.transpose <= Math.max(-12, -song.minPitch);
  $('transpose-up').disabled = transport.transpose >= Math.min(12, 127 - song.maxPitch);
  $('transpose-reset').style.visibility = transport.transpose ? 'visible' : 'hidden';
  $('speed').value = transport.rate;
  $('speed-label').textContent = `${transport.rate.toFixed(2)}×`;
  const tempo = song.tempos.filter(t => t.time <= position).at(-1)?.bpm || song.bpm;
  $('bpm-label').textContent = `${Math.round(tempo * transport.rate)} BPM`;
  $('play-button').classList.toggle('is-playing', transport.playing);
  $('play-icon').querySelector('use').setAttribute('href', transport.playing ? '#i-pause' : '#i-play');
  $('play-button').setAttribute('aria-label', transport.playing ? '暂停' : '播放');
  $('play-text').textContent = transport.playing ? '暂停' : '播放';
  for (const hand of ['left', 'right']) {
    const enabled = transport.hands[hand];
    $(`${hand}-hand`).classList.toggle('selected', enabled);
    $(`${hand}-hand`).setAttribute('aria-pressed', String(enabled));
    $(`${hand}-hand`).querySelector('small').textContent = enabled ? '开' : '关';
  }
  $('practice-mode').textContent = transport.hands.left && transport.hands.right ? '双手练习' : transport.hands.left ? '左手练习' : transport.hands.right ? '右手练习' : '静音跟练';
  $('loop-button').setAttribute('aria-pressed', String(transport.loop.enabled));
  $('loop-button').setAttribute('aria-label', transport.loop.enabled ? '关闭片段循环' : '开启片段循环');
  $('loop-selection').hidden = !transport.loop.enabled;
  $('loop-selection').style.left = `${transport.loop.start / song.duration * 100}%`;
  $('loop-selection').style.width = `${(transport.loop.end - transport.loop.start) / song.duration * 100}%`;
  $('loop-summary').textContent = transport.loop.enabled ? `${formatTime(transport.loop.start)} — ${formatTime(transport.loop.end)} · 循环中` : '选择练习片段';
  $('countdown').hidden = countInRemaining <= 0;
  if (countInRemaining > 0) $('countdown-number').textContent = String(Math.ceil(countInRemaining));
  $('session-status').replaceChildren();
  const dot = document.createElement('span'); dot.className = 'status-dot';
  $('session-status').append(dot, loadingAudio ? '正在准备钢琴音色…' : transport.playing ? transport.loop.enabled ? '片段循环中，按自己的节奏练习' : '正在练习，按自己的节奏来' : position >= song.duration ? '完整弹完一遍了，再来一次吧' : position > 0 ? '已暂停，随时可以继续' : '准备好，按下播放就开始');
  $('note-range').textContent = `${noteName(roll.keyboard.min)} — ${noteName(roll.keyboard.max)}`;
}
transport.onchange = () => { roll.invalid = true; updateUI(); };
transport.onended = () => { updateUI(); toast('这一遍结束了。慢慢来，每一遍都算数。'); };

async function playPause() {
  if (!transport.song) return;
  if (transport.playing) { playRequest++; transport.pause(); wakeLock?.release().catch(() => {}); return; }
  const request = ++playRequest;
  loadingAudio = true;
  $('play-button').disabled = true;
  $('play-button').classList.add('is-loading');
  $('play-button').setAttribute('aria-busy', 'true');
  updateUI();
  try {
    await audio.initialize(progress => { $('audio-status').textContent = `准备音色 ${Math.round(progress * 100)}%`; });
    if (request !== playRequest || document.hidden) return;
    transport.start(preferences.countIn && transport.position < .05 ? 3 : 0);
    // Screen-awake support must never block the pause button or audio loading state.
    navigator.wakeLock?.request('screen').then(lock => {
      if (transport.playing) wakeLock = lock;
      else lock.release().catch(() => {});
    }).catch(() => {});
  } catch (error) { toast(error.message || '音色载入失败，请再试一次'); }
  finally {
    loadingAudio = false;
    $('play-button').disabled = false;
    $('play-button').classList.remove('is-loading');
    $('play-button').removeAttribute('aria-busy');
    $('audio-status').textContent = audio.ready ? '原声钢琴' : '点击播放加载音色';
    updateUI();
  }
}
$('play-button').addEventListener('click', playPause);
$('restart-button').addEventListener('click', () => { if (transport.loop.enabled) transport.setLoop({ ...transport.loop, enabled: false }); transport.seek(0); });
function skip(seconds) { const wasLooping = transport.loop.enabled; transport.seek(transport.getPosition() + seconds); if (wasLooping && !transport.loop.enabled) toast('已跳出片段，循环已关闭'); }
$('back-button').addEventListener('click', () => skip(-5));
$('forward-button').addEventListener('click', () => skip(5));
let wasScrubbingPlaying = false, scrubbing = false;
$('seek').addEventListener('pointerdown', () => { scrubbing = true; wasScrubbingPlaying = transport.playing; transport.pause(); });
$('seek').addEventListener('input', event => { transport.seek(Number(event.target.value)); roll.draw(true); });
function finishScrub() { if (!scrubbing) return; scrubbing = false; if (wasScrubbingPlaying) transport.start(); }
globalThis.addEventListener('pointerup', finishScrub);
globalThis.addEventListener('pointercancel', finishScrub);
$('seek').addEventListener('change', finishScrub);

for (const hand of ['left', 'right']) $(`${hand}-hand`).addEventListener('click', () => transport.update({ hands: { ...transport.hands, [hand]: !transport.hands[hand] } }));
function changeSpeed(value) {
  const speed = Math.round(clamp(value, .25, 1.5) * 100) / 100;
  transport.update({ rate: speed }); preferences.speed = speed; savePreferences();
}
$('speed').addEventListener('input', event => changeSpeed(Number(event.target.value)));
$('speed-down').addEventListener('click', () => changeSpeed(transport.rate - .05));
$('speed-up').addEventListener('click', () => changeSpeed(transport.rate + .05));
$('volume').value = preferences.volume;
$('volume').addEventListener('input', event => { preferences.volume = Number(event.target.value); audio.setVolume(preferences.volume); savePreferences(); });
function transpose(value) {
  if (!transport.song) return;
  transport.update({ transpose: clamp(value, Math.max(-12, -transport.song.minPitch), Math.min(12, 127 - transport.song.maxPitch)) });
  roll.layout(); updateUI();
}
$('transpose-down').addEventListener('click', () => transpose(transport.transpose - 1));
$('transpose-up').addEventListener('click', () => transpose(transport.transpose + 1));
$('transpose-reset').addEventListener('click', () => transpose(0));
$('range-button').addEventListener('click', () => {
  roll.fullRange = !roll.fullRange; roll.layout(); updateUI();
  $('range-button').replaceChildren(document.createTextNode(roll.fullRange ? '完整 88 键 ' : '适配曲目 '));
  const arrow = document.createElement('span'); arrow.textContent = '⌄'; $('range-button').append(arrow);
  $('range-button').setAttribute('aria-label', roll.fullRange ? '切换到适配曲目的键盘' : '切换到完整 88 键键盘');
});

function syncLoopDraft() {
  const song = transport.song;
  $('loop-start-bar').max = song.measures.length;
  $('loop-end-bar').max = song.measures.length;
  $('loop-start-bar').value = measureAt(song, draftLoop.start).index;
  $('loop-end-bar').value = measureAt(song, Math.max(draftLoop.start, draftLoop.end - .001)).index;
  $('loop-time').textContent = `A ${formatTime(draftLoop.start)} — B ${formatTime(draftLoop.end)}`;
}
$('loop-settings-button').addEventListener('click', () => { if (!transport.song) return; draftLoop = { ...transport.loop }; draftBarEdits = false; syncLoopDraft(); openDialog('loop-dialog'); });
function readLoopBars(changedId = 'loop-start-bar') {
  const song = transport.song;
  let start = clamp(Number($('loop-start-bar').value) || 1, 1, song.measures.length);
  let end = clamp(Number($('loop-end-bar').value) || start, 1, song.measures.length);
  start = Math.floor(start); end = Math.floor(end);
  if (end < start) { if (changedId === 'loop-start-bar') end = start; else start = end; }
  draftLoop.start = song.measures[start - 1].time;
  draftLoop.end = song.measures[end - 1].end;
  syncLoopDraft();
}
for (const id of ['loop-start-bar', 'loop-end-bar']) {
  $(id).addEventListener('input', () => { draftBarEdits = true; });
  $(id).addEventListener('change', () => { draftBarEdits = true; readLoopBars(id); });
}
$('set-a').addEventListener('click', () => { draftBarEdits = false; draftLoop.start = Math.min(transport.getPosition(), transport.song.duration - .1); if (draftLoop.end <= draftLoop.start + .1) draftLoop.end = Math.min(transport.song.duration, measureAt(transport.song, draftLoop.start).end + .1); syncLoopDraft(); });
$('set-b').addEventListener('click', () => { const pos = transport.getPosition(); if (pos < draftLoop.start + .1) { toast('B 点需要在 A 点之后'); return; } draftBarEdits = false; draftLoop.end = pos; syncLoopDraft(); });
$('apply-loop').addEventListener('click', async () => {
  try { if (draftBarEdits) readLoopBars(); transport.setLoop({ ...draftLoop, enabled: true }); $('loop-dialog').close(); if (!transport.playing) await playPause(); }
  catch (error) { toast(error.message); }
});
$('clear-loop').addEventListener('click', () => { transport.setLoop({ ...transport.loop, enabled: false }); $('loop-dialog').close(); });
$('loop-button').addEventListener('click', () => { if (transport.song) transport.setLoop({ ...transport.loop, enabled: !transport.loop.enabled }); });

$('note-labels').checked = preferences.noteLabels;
$('count-in').checked = preferences.countIn;
$('lookahead').value = preferences.lookahead;
$('hand-method').value = preferences.handMethod;
$('split-note').value = preferences.split;
$('split-row').hidden = preferences.handMethod !== 'pitch';
$('settings-button').addEventListener('click', () => openDialog('settings-dialog'));
$('help-button').addEventListener('click', () => openDialog('help-dialog'));
$('library-button').addEventListener('click', () => openDialog('library-dialog'));
$('note-labels').addEventListener('change', event => { roll.labels = preferences.noteLabels = event.target.checked; roll.invalid = true; savePreferences(); });
$('count-in').addEventListener('change', event => { preferences.countIn = event.target.checked; savePreferences(); });
$('lookahead').addEventListener('change', event => { roll.lookahead = preferences.lookahead = Number(event.target.value); roll.invalid = true; savePreferences(); });
function reassignHands() {
  if (!transport.song) return;
  const wasPlaying = transport.playing;
  transport.pause();
  assignHands(transport.song, preferences.handMethod, preferences.split);
  if (wasPlaying) transport.start();
  roll.invalid = true;
  $('hand-method-note').textContent = preferences.handMethod === 'auto' ? '优先使用 MIDI 声部；单声部文件按音高分手' : '低于分界音的音符归左手，其余归右手';
}
$('hand-method').addEventListener('change', event => { preferences.handMethod = event.target.value; $('split-row').hidden = preferences.handMethod !== 'pitch'; reassignHands(); savePreferences(); });
$('split-note').addEventListener('change', event => { preferences.split = Number(event.target.value); reassignHands(); savePreferences(); });

for (const button of document.querySelectorAll('[data-import]')) button.addEventListener('click', () => $('midi-file').click());
async function importFile(file) {
  if (!file) return;
  if (!/\.(mid|midi)$/i.test(file.name)) { toast('请选择 .mid 或 .midi 文件'); return; }
  if (file.size > 8 * 1024 * 1024) { toast('请选择 8 MB 以内的 MIDI 文件'); return; }
  try {
    const bytes = await file.arrayBuffer();
    const title = file.name.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ');
    const metadata = { id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title };
    const song = createSong(new globalThis.Midi(bytes), metadata);
    songs.push(song); selectSong(song);
    if ($('library-dialog').open) $('library-dialog').close();
    try { await saveImport({ ...metadata, bytes }); toast('已加入曲库，只保存在这台设备上'); }
    catch { toast('MIDI 已打开；浏览器未允许保存，刷新后需要重新导入'); }
  } catch (error) { toast(error.message?.startsWith('这个') || error.message?.startsWith('暂不') ? error.message : '无法读取这个 MIDI，请检查文件后重试'); }
  finally { $('midi-file').value = ''; }
}
$('midi-file').addEventListener('change', event => importFile(event.target.files[0]));
let dragDepth = 0;
document.addEventListener('dragenter', event => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); dragDepth++; document.body.classList.add('drag-over'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drag-over'); } });
document.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; document.body.classList.remove('drag-over'); importFile(event.dataTransfer.files[0]); });

let focusMode = false;
async function toggleFocus() {
  focusMode = !focusMode;
  document.body.classList.toggle('focus-mode', focusMode);
  if (focusMode) {
    const exit = document.createElement('button'); exit.id = 'focus-exit'; exit.className = 'focus-exit'; exit.textContent = '退出专注模式'; exit.addEventListener('click', toggleFocus); document.body.append(exit);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* CSS focus mode also works on iPad versions without Fullscreen API support. */ }
  } else {
    $('focus-exit')?.remove();
    if (document.fullscreenElement) await document.exitFullscreen();
  }
  roll.resize(); if (transport.song) drawWaveform($('waveform'), transport.song);
}
$('fullscreen-button').addEventListener('click', toggleFocus);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && focusMode) { focusMode = false; document.body.classList.remove('focus-mode'); $('focus-exit')?.remove(); roll.resize(); } });
document.addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); if (!loadingAudio) playPause(); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); skip(-5); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); skip(5); }
  else if (event.key === 'Escape' && focusMode) toggleFocus();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { playRequest++; transport.pause(); wakeLock?.release().catch(() => {}); } });
globalThis.addEventListener('resize', () => { if (transport.song) drawWaveform($('waveform'), transport.song); });
let lastUI = 0;
function frame(now) { roll.draw(); if (now - lastUI > 100) { if (transport.playing) updateUI(); lastUI = now; } requestAnimationFrame(frame); }
requestAnimationFrame(frame);

async function boot() {
  try {
    const response = await fetch(BUILTIN.url);
    if (!response.ok) throw new Error('曲目暂时无法载入，请刷新重试');
    const song = createSong(new globalThis.Midi(await response.arrayBuffer()), BUILTIN);
    songs.push(song); selectSong(song);
  } catch (error) { $('roll-empty').textContent = error.message || '练习室暂时无法打开，请刷新重试'; toast(error.message); }
  try {
    for (const saved of await readImports()) {
      try { songs.push(createSong(new globalThis.Midi(saved.bytes), saved)); } catch { /* One obsolete import must not prevent other songs from opening. */ }
    }
    renderLibrary();
  } catch { /* Importing still works when IndexedDB is disabled. */ }
  if ('serviceWorker' in navigator && globalThis.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
