/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  SERVICE WORKER: the app opens without a network.

  On install it caches the app, including the 3D figures and the engine
  that draws them (about 1.2 MB, 300 KB over the wire, once, on the first
  visit). After that every file is network-first with a four-second
  timeout and the cache as the fallback, so online you always run the
  current version and a flaky connection falls back rather than hanging.

  Because of that, forgetting to bump VERSION after a deploy costs nothing:
  the next online load fetches the new files and refreshes the cache.
  Bumping it only clears out old entries sooner. When a 3D file is added,
  list it in MOVE_3D (scripts/selfcheck.mjs checks the list is complete).
*/
const VERSION = 'fit-v4';
const NETWORK_TIMEOUT_MS = 4000;

const SHELL = [
  '/', '/index.html', '/css/app.css',
  '/js/exercises.js', '/js/workouts.js', '/js/generator.js', '/js/app.js',
  '/manifest.json', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'
];
// the 3D figures on the cards and the full viewer (move.html)
const MOVE_3D = [
  '/move.html', '/vendor/three/three.min.js',
  '/js/move/body.js', '/js/move/motion.js', '/js/move/scene.js', '/js/move/deck.js', '/js/move/viewer.js',
  '/js/moves/index.js', '/js/moves/legs.js', '/js/moves/lunge.js', '/js/moves/hinge.js', '/js/moves/push.js',
  '/js/moves/press.js', '/js/moves/pull.js', '/js/moves/core.js', '/js/moves/abs.js', '/js/moves/cardio.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Best effort, file by file: one missing file must not block the rest,
    // and the app runs without the cache anyway.
    await Promise.all([...SHELL, ...MOVE_3D].map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  // A navigation to the app is the one page, whatever the query string or
  // hash; other pages (the 3D viewer) are cached under their own path.
  const path = new URL(req.url).pathname;
  const key = req.mode === 'navigate' ? (path === '/' || path === '/index.html' ? '/' : path) : req;
  const net = fetch(req);
  try {
    const fresh = await withTimeout(net, NETWORK_TIMEOUT_MS);
    if (fresh && fresh.ok) cache.put(key, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    // Nothing cached: let the slow network request run its course.
    return net;
  }
}
