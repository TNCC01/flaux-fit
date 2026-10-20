/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  SERVICE WORKER: the app opens straight away, signal or not.

  On install it fetches every file below into a cache of its own (the app,
  the 3D figures and the engine that draws them: about 1.2 MB, 300 KB over
  the wire), all or nothing: one file failing fails the install, and the
  browser tries again later. From then on every file comes from that
  cache, so the app opens at once on one bar of signal or none, and the
  files it runs on are always one release's, never a mix of two.

  Updates come in the background. Each time the app opens (and when it
  comes back to the front) the browser checks this file; a changed one
  installs the new release into a new cache beside the old, and waits.
  The app then shows "New version ready, tap to update" (not during a
  workout). The tap tells the waiting worker to take over, it deletes the
  old cache, and the page reloads into the new release. Untapped, it takes
  over the next time FIT is closed and opened again.

  So a release that changes any file below has to change this file too,
  or it never arrives: bump VERSION, and set FILES_HASH to what
  scripts/selfcheck.mjs asks for (it fails until the two match, and
  prints the new value). The hash is part of the cache's name, so changed
  files can never be installed over the copy that's running. When a file
  is added, list it below (the self-check fails on a file the pages load,
  or a 3D file, that isn't listed).
*/
const VERSION = 'fit-v9';
const FILES_HASH = '809d962f8069';
const CACHE = `${VERSION}-${FILES_HASH}`;

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
  '/js/moves/press.js', '/js/moves/pull.js', '/js/moves/core.js', '/js/moves/abs.js', '/js/moves/cardio.js',
  '/js/moves/gear.js', '/js/moves/surf.js'
];

self.addEventListener('install', (event) => {
  // Past the browser's own cache, so a file it kept from the last release
  // can't end up in this one. No skipWaiting: the first install has
  // nothing to wait for, and an update waits for the tap.
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll([...SHELL, ...MOVE_3D].map(url => new Request(url, { cache: 'reload' })))));
});

// The tap on "New version ready" (or a page whose scripts failed, which has
// nothing to lose; see index.html).
self.addEventListener('message', (event) => {
  if (event.data === 'update') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fromCache(req));
});

// This release's copy, or the network for anything it doesn't hold. What
// comes from the network isn't kept: only an install fills the cache, so
// it only ever holds one release.
async function fromCache(req) {
  const cache = await caches.open(CACHE);
  // A navigation to the app is the one page, whatever the query string or
  // hash; other pages (the 3D viewer) are cached under their own path.
  const path = new URL(req.url).pathname;
  const key = req.mode === 'navigate' ? (path === '/' || path === '/index.html' ? '/' : path) : req;
  const hit = await cache.match(key, { ignoreSearch: true });
  if (!hit) return fetch(req);
  // a page can't be answered with a redirect it didn't ask for, so a file
  // the host redirected on install goes out as a plain copy
  return hit.redirected ? new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers: hit.headers }) : hit;
}
