const CACHE = 'meedee-v4';
const CORE = ['./', './index.html', './style.css', './vendor/Midi.js', './src/app.js', './src/music.js', './src/audio.js', './src/transport.js', './src/roll.js', './src/zoom.js', './src/storage.js', './assets/midi/canon-piano.mid', './assets/midi/river-flows-in-you.mid', './assets/icon.svg', './manifest.webmanifest', ...['A0', 'Ds1', 'A1', 'Ds2', 'A2', 'Ds3', 'A3', 'Ds4', 'A4', 'Ds5', 'A5', 'Ds6', 'A6', 'Ds7', 'A7', 'C8'].map(name => `./assets/piano/${name}.mp3`)];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('meedee-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Prefer current files when online; cached local assets keep the piano usable offline.
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || Response.error()));
});
