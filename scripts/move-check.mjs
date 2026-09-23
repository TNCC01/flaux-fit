/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  Checks the 3D movement data (js/moves/) and renders a contact sheet.

    node scripts/move-check.mjs                    every movement
    node scripts/move-check.mjs bwSquat pushup     just these
    node scripts/move-check.mjs --out sheet.png bwSquat
    node scripts/move-check.mjs --joints pushup     also print joint positions
    node scripts/move-check.mjs --big pushup        bigger pictures
    node scripts/move-check.mjs --quick             numbers only, no pictures (CI)

  For each movement it draws every key pose, and the halfway point into
  each move, from the front, the side and three-quarters, into one PNG
  (default: move-check.png in the current directory). Look at it: the
  numbers catch mechanical faults, the pictures catch bad form.

  Fails (exit 1) on errors: a movement with no data, a foot or hand target
  the limb can't reach, the body going through the floor, or any console
  error. Every animation used by js/exercises.js must have data once the
  library is complete; pass --all-required to enforce that.

  Set CHROMIUM=/path/to/chrome to use a specific browser build.
*/
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');

const args = process.argv.slice(2);
let out = 'move-check.png';
const oi = args.indexOf('--out');
if (oi >= 0) { out = args[oi + 1]; args.splice(oi, 2); }
const requireAll = args.includes('--all-required');
const verbose = args.includes('--joints');
const big = args.includes('--big');
const quick = args.includes('--quick');
const names = args.filter(a => !a.startsWith('--'));

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const URL = `http://127.0.0.1:${server.address().port}/`;

const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

// which movements: the ones named, or every one with data
let list = names;
const known = await (async () => {
  await page.goto(URL + 'move.html');
  await page.waitForFunction(() => document.getElementById('libraryCount').textContent !== '', null, { timeout: 60000 });
  return page.evaluate(async () => {
    const m = await import('./js/moves/index.js');
    const used = [...new Set(Object.values(EXERCISES).map(e => e.img).filter(Boolean))];  // eslint-disable-line no-undef
    return { have: Object.keys(m.MOVES), used };
  });
})();
if (!list.length) list = known.have;

let failed = false;
const report = {};
// render in batches so one sheet doesn't get huge
const BATCH = quick ? 200 : big ? 4 : 12;
const sheets = [];
for (let i = 0; i < list.length; i += BATCH) {
  const batch = list.slice(i, i + BATCH);
  await page.goto(`${URL}move.html?check=${batch.join(',')}${big ? '&size=360' : ''}${quick ? '&quick=1' : ''}`);
  await page.waitForSelector('body[data-checked]', { timeout: 300000 });
  Object.assign(report, await page.evaluate(() => window.__check));
  if (quick) continue;
  const file = list.length > BATCH ? out.replace(/\.png$/, `-${i / BATCH + 1}.png`) : out;
  await page.locator('#checkSheet').screenshot({ path: file });
  sheets.push(file);
}

for (const [name, r] of Object.entries(report)) {
  for (const e of r.errors) { console.log(`FAIL ${name}: ${e}`); failed = true; }
  for (const w of r.warnings) console.log(`warn ${name}: ${w}`);
  if (!r.errors.length) console.log(`ok   ${name}`);
  if (verbose && r.joints) for (const [k, j] of Object.entries(r.joints)) console.log(`     ${name}.${k}: ${JSON.stringify(j)}`);
}
const missing = known.used.filter(u => !known.have.includes(u));
if (missing.length) {
  const msg = `${missing.length} animation(s) used by exercises have no 3D data yet`;
  if (requireAll) { console.log(`FAIL ${msg}: ${missing.join(', ')}`); failed = true; }
  else console.log(`note ${msg}`);
}
for (const e of consoleErrors) { console.log(`FAIL console: ${e}`); failed = true; }
if (sheets.length) console.log(`sheet${sheets.length > 1 ? 's' : ''}: ${sheets.join(', ')}`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
