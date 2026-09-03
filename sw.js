/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  SERVICE WORKER: the app opens without a network.

  On install it caches the app shell and every animation (about 6 MB, once,
  on the first visit). After that:

    app files   network-first, four-second timeout, cache as the fallback,
                so online you always run the current version and a flaky
                connection falls back rather than hanging
    animations  cache-first, refreshed in the background

  Because the shell is network-first, forgetting to bump VERSION after a
  deploy costs nothing: the next online load fetches the new files and
  refreshes the cache. Bumping it only clears out old entries sooner.
*/
const VERSION = 'fit-v1';
const NETWORK_TIMEOUT_MS = 4000;

// The animation list comes from the dictionary itself, so it can't drift.
importScripts('js/exercises.js');

const SHELL = [
  '/', '/index.html', '/css/app.css',
  '/js/exercises.js', '/js/workouts.js', '/js/generator.js', '/js/app.js',
  '/manifest.json', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'
];
const ANIMATIONS = [...new Set(Object.values(EXERCISES).map(e => e.img).filter(Boolean))]
  .map(base => `/img/exercises/${base}.svg`);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Best effort, file by file: one missing animation must not block the
    // rest, and the app runs without the cache anyway.
    await Promise.all([...SHELL, ...ANIMATIONS].map(url => cache.add(url).catch(() => {})));
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
  if (url.pathname.startsWith('/img/exercises/')) {
    event.respondWith(cacheFirst(event, req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  // Every navigation is the one page, whatever the query string or hash.
  const key = req.mode === 'navigate' ? '/' : req;
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

async function cacheFirst(event, req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  const refresh = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const fresh = await refresh;
  return fresh || new Response('', { status: 504, statusText: 'offline and not cached' });
}
