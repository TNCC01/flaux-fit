// Sync the FIT website into the store app's webDir.
//
// The single source of truth is the website at the repo root (live at
// fit.flaux.com.au). This copies it into ./www and adds the native bridge
// (native-bridge.js) to the app's copy of index.html only, so the app can
// never drift from the website by hand-editing, and the website never
// loads the bridge. Never edit www/ by hand; it is made here.
//
// sw.js is not copied: in the app the files are already on the device and
// a new release comes through the store, so the bridge keeps FIT from
// registering a service worker at all (see OFFLINE in native-bridge.js).
//
// Usage: node sync.mjs   (also runs via `npm run sync:www`)

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const out = join(here, 'www');

// The website's own files: the two pages, their styles and scripts, the
// 3D engine, the icons and the manifest.
const FILES = ['index.html', 'move.html', 'manifest.json', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
const FOLDERS = ['css', 'js', 'vendor'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) copyFileSync(join(site, f), join(out, f));
for (const d of FOLDERS) cpSync(join(site, d), join(out, d), { recursive: true });

// Every file the website keeps for offline use (the lists in sw.js, which
// scripts/selfcheck.mjs holds to every file the pages load) has to be in
// the app too, or a file FIT adds somewhere new would be missing from it.
const sw = readFileSync(join(site, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'(\/[^']*)'/g)].map(m => m[1]).filter(p => p !== '/');
const missing = listed.filter(p => !existsSync(join(out, p)));
if (!listed.length || missing.length) {
  console.error(missing.length ? `Missing from www (add them to sync.mjs): ${missing.join(', ')}` : 'Found no file list in sw.js');
  process.exit(1);
}

// The bridge goes in the <head>, ahead of FIT's own scripts: it has to
// take the service worker away before index.html's first script looks
// for one (see native-bridge.js).
copyFileSync(join(here, 'native-bridge.js'), join(out, 'native-bridge.js'));
const indexPath = join(out, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('native-bridge.js')) {
  if (!html.includes('</head>')) { console.error('index.html has no </head> to put the bridge before'); process.exit(1); }
  html = html.replace('</head>', '<script src="native-bridge.js"></script>\n</head>');
  writeFileSync(indexPath, html);
}

console.log(`Synced the website into www (${listed.length} files checked) and added native-bridge.js`);
