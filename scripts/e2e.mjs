/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  Browser suite. Serves the app from this directory and drives it in
  headless Chromium at iPad-landscape size, then once at phone width.

    npm install && npx playwright install chromium     (once)
    node scripts/e2e.mjs

  Every step asserts real behaviour through the app's own globals (state,
  EXERCISES), and any console error fails the run. Steps build on each
  other deliberately: a favourite saved early is replayed later, a session
  started early has to show up in history.
*/
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');

// ---------------------------------------------------------- static server
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png'
};
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

// ------------------------------------------------------------- harness
const errors = [];
let step = '';
const ok = (msg) => console.log('ok   ' + msg);
const note = (msg) => console.log('     ' + msg);
const assert = (c, msg) => { if (!c) throw new Error(`FAILED at "${step}": ${msg}`); };
const GEAR = ['15kg kettlebell', '10kg kettlebell', '10kg barbell', 'Dumbbells', 'Skipping rope', 'Rings'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await context.newPage();
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));

const st = (fn) => p.evaluate(fn);
const activeView = () => st(() => document.querySelector('.view.active').id);
const previewText = () => p.$$eval('#previewList li', els => els.map(e => e.textContent.trim()).join('|'));
// Rounds in the first block of the built sequence: 8 for short bursts, 4 for long efforts.
const rounds = () => st(() => state.sequence.filter(x => x.kind === 'work' && x.blockIdx === 0).length);
const pickInterval = async (label) => { await p.click('#pathQuick'); await p.click(`.interval-card:has-text("${label}")`); };
// Exact name match: "Power Hour" also appears in Half Power's tagline.
const card = (name) => `.workout-card:not(.history-card):has(.card-name:text-is("${name}"))`;
const toggleAllGear = async () => { for (const g of GEAR) await p.click(`#equipmentPicker .chip:has-text("${g}")`); };

try {
  await p.goto(URL); await st(() => localStorage.clear()); await p.goto(URL);

  step = 'welcome';
  assert((await p.$$('.path-card')).length === 4, 'four path cards');
  assert(await p.$eval('#installHint', e => e.hidden), 'install hint is hidden on a desktop UA');
  ok('welcome shows four paths, no iOS install hint on desktop');

  step = 'quick build, long efforts, save, start';
  await pickInterval('Long efforts');
  await p.click('#btnBuild');
  assert(await activeView() === 'workoutView', 'workout view open');
  assert(await rounds() === 4, 'long efforts gives 4 rounds, got ' + await rounds());
  const previewA = await previewText();
  const idsA = await st(() => state.workout.exerciseIds.join(','));
  const seedA = await st(() => state.workout.seed);
  await p.click('#btnSave');
  assert(await p.$eval('#btnSave', e => e.textContent.includes('Saved') && e.disabled), 'save button flips to Saved');
  await p.click('#btnStart'); await p.waitForTimeout(400);
  await p.click('#btnStart');
  assert(await st(() => state.recent.length) > 0, 'starting filled the recency list');
  ok('first workout built, saved, started and paused');

  step = 'second build is weighted by recency, then saved';
  await p.click('#btnBack'); await p.click('#pathQuick'); await p.click('#btnBuild');
  const recentUsed = await st(() => state.workout.request.recent.length);
  assert(recentUsed > 0, 'second build carried a recency list, got ' + recentUsed);
  const previewB = await previewText();
  const idsB = await st(() => state.workout.exerciseIds.join(','));
  await p.click('#btnSave');
  ok(`second workout saved; its request recorded ${recentUsed} recent movements`);

  step = 'switch preference to short, reopen the long favourite';
  await p.click('#btnBack'); await pickInterval('Short bursts');
  await p.click('#btnSetupBack'); await p.click('#pathClassics');
  const savedCards = await p.$$('.workout-card:has-text("☆")');
  assert(savedCards.length === 2, 'two saved cards, got ' + savedCards.length);
  await savedCards[1].click();                       // the older one, A
  assert(await activeView() === 'workoutView', 'favourite opened');
  assert(await st(() => state.workout.exerciseIds.join(',')) === idsA, 'favourite A rebuilt with identical movements');
  assert(await previewText() === previewA, 'preview identical to the original');
  assert(await st(() => state.workout.seed) === seedA, 'same seed');
  assert(await rounds() === 4, 'replays with its own 4-round interval');
  assert(await p.$eval('#btnSave', e => e.textContent.includes('Saved') && e.disabled), 'already-saved favourite shows Saved');
  assert(await st(() => state.intervalStyle) === 'short', 'opening a long favourite left the short preference alone');
  ok('favourite A replays identically, keeps its interval, leaves the preference alone');

  step = 'reopen favourite B, the one built with a recency list';
  await p.click('#btnBack'); await p.click('#pathClassics');
  await (await p.$$('.workout-card:has-text("☆")'))[0].click();
  assert(await st(() => state.workout.exerciseIds.join(',')) === idsB, 'favourite B rebuilt with identical movements');
  assert(await previewText() === previewB, 'preview B identical');
  ok('favourite B replays identically despite the recency weighting');

  step = 'shuffle after a favourite respects switched-off gear';
  await p.click('#btnBack'); await p.click('#pathQuick'); await toggleAllGear();
  assert(await st(() => Object.values(state.equipment).every(v => v === false)), 'all gear off');
  await p.click('#btnSetupBack'); await p.click('#pathClassics');
  await (await p.$$('.workout-card:has-text("☆")'))[0].click();
  await p.click('#btnShuffle');
  assert(await st(() => state.workout.exerciseIds.every(id => EXERCISES[id].equipment.length === 0)),
         'shuffle after a favourite picked gear that is switched off');
  assert(await p.$eval('#workoutNote', e => e.textContent === ''), 'no error note after a good shuffle');
  ok('shuffle after a favourite stayed bodyweight-only');
  await p.click('#btnBack'); await p.click('#pathQuick'); await toggleAllGear();

  step = 'classic under long efforts, then the timer survives a suspension';
  await p.click('.interval-card:has-text("Long efforts")');
  await p.click('#btnSetupBack'); await p.click('#pathClassics');
  await p.click(card('Power Hour'));
  assert(await rounds() === 4, 'classic takes the long preference');
  await p.click('#btnStart'); await p.click('#btnSkip');       // into block 1
  assert(await p.$eval('#blockName', e => /Block 1 of/.test(e.textContent)), 'skip jumped to block 1');
  const before = await st(() => elapsedNow());
  await st(() => clearInterval(state.tickHandle));             // what iOS does to a backgrounded tab
  await p.waitForTimeout(3000);
  const stale = await p.$eval('#totalTime', e => e.textContent);
  await st(() => document.dispatchEvent(new Event('visibilitychange')));
  const gained = (await st(() => state.elapsedTotal)) - before;
  assert(gained >= 2.8 && gained <= 4, `caught up ${gained.toFixed(1)}s of a 3s gap`);
  const fresh = await p.$eval('#totalTime', e => e.textContent);
  note(`suspended at "${stale}", on return "${fresh}" (+${gained.toFixed(1)}s)`);
  await p.click('#btnStart');                                   // pause
  ok('classic opens with 4 rounds, skip works, timer recovers a 3s suspension');

  step = 'history entry of a classic reopens at the interval it was run';
  await p.click('#btnBack'); await pickInterval('Short bursts');
  await p.click('#btnSetupBack'); await p.click('#pathClassics');
  await p.click(card('Power Hour'));
  assert(await rounds() === 8, 'fresh open of the classic uses today\'s short preference');
  await p.click('#btnBack'); await p.click('#pathClassics');
  assert(await p.$('.section-title:has-text("Recent")'), 'Recent section present');
  await p.click('.history-card:has(.card-name:text-is("Power Hour"))');
  assert(await activeView() === 'workoutView', 'history entry reopens');
  assert(await rounds() === 4, 'history entry reopened with the 4-round interval it was run at');
  ok('history reopens a classic at the interval it was actually run');

  step = 'custom flow';
  await p.click('#btnBack'); await p.click('#pathCustom');
  assert(await p.$eval('#rowRegions', e => e.style.display !== 'none'), 'target areas visible');
  await p.click('.zone[data-region="push"]');
  await p.click('.zone[data-region="pull"] .fill');
  await p.click('.zone[data-region="core"]');
  await p.click('#regionPicker .chip:has-text("Cardio")');
  assert(await st(() => state.regions.join(',')) === 'legs', 'legs only, got ' + await st(() => state.regions.join(',')));
  await p.click('#btnOpenExclude');
  await p.fill('#excludeSearch', 'burpee');
  const rows = await p.$$eval('.exclude-item', els => els.length);
  assert(rows === 2, 'burpee search gives 2 rows, got ' + rows);
  await p.click('#btnBuild');
  assert(await st(() => state.workout.exerciseIds.every(id => EXERCISES[id].regions.includes('legs'))), 'custom build on target');
  ok('custom flow: body map, search, and a legs-only build');

  step = 'stretch';
  await p.click('#btnBack'); await p.click('#pathStretch');
  await p.click(card('Sunrise Stretch'));
  assert(await p.$eval('#exerciseA', e => e.textContent.length > 0), 'stretch shows a pose');
  ok('stretch routine opens');

  step = 'text size';
  const small = await p.$eval('#exerciseA', e => parseFloat(getComputedStyle(e).fontSize));
  await p.click('.text-size .mini-btn[data-scale="1.45"]');
  const large = await p.$eval('#exerciseA', e => parseFloat(getComputedStyle(e).fontSize));
  assert(large > small, 'text size control enlarges');
  note(`${small}px -> ${large}px`);
  ok('text size control works');

  step = 'share link rebuilds the same workout on another device';
  await p.click('#btnBack'); await p.click('#pathQuick'); await p.click('#btnBuild');
  const sharedIds = await st(() => state.workout.exerciseIds.join(','));
  const sharedSeed = await st(() => state.workout.seed);
  const shareUrl = await st(() => shareUrlFor(state.workout));
  assert(shareUrl.includes('#w='), 'share url carries a payload');
  // No share sheet in headless Chromium, so the button copies the link.
  await p.click('#btnShare');
  await p.waitForFunction(() => document.getElementById('workoutNote').textContent.length > 0);
  const shareNote = await p.$eval('#workoutNote', e => e.textContent);
  assert(/Link copied/.test(shareNote), 'share button reports the copy, got: ' + shareNote.slice(0, 80));
  const clip = await st(() => navigator.clipboard.readText().catch(() => null));
  if (clip === null) note('clipboard not readable here, skipping that check');
  else assert(clip === shareUrl, 'clipboard holds the link');
  // "Another device": a fresh browser context with nothing stored.
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const q = await other.newPage();
  q.on('pageerror', e => errors.push('other device: ' + e));
  q.on('console', m => { if (m.type() === 'error') errors.push('other device: ' + m.text()); });
  await q.goto(shareUrl);
  assert(await q.evaluate(() => document.querySelector('.view.active').id) === 'workoutView', 'link opens the workout');
  assert(await q.evaluate(() => state.workout.exerciseIds.join(',')) === sharedIds, 'same movements on the other device');
  assert(await q.evaluate(() => state.workout.seed) === sharedSeed, 'same seed');
  assert(await q.evaluate(() => location.hash) === '', 'hash cleared once opened');
  assert(await q.$eval('#workoutNote', e => /shared link/.test(e.textContent)), 'says it came from a link');
  await p.click('#btnBack'); await p.click('#pathClassics');
  assert(await st(() => state.filterFocus) === 'all', 'Workouts path shows the whole library after a Stretch visit');
  await p.click(card('Power Hour'));
  const classicUrl = await st(() => shareUrlFor(state.workout));
  await q.goto(classicUrl);
  assert(await q.evaluate(() => state.workout.id) === 'power-hour', 'a classic shares by id');
  await q.goto(URL + '#w=notaworkout');
  assert(await q.evaluate(() => document.querySelector('.view.active').id) === 'welcomeView', 'a bad link lands on welcome');
  assert(await q.$eval('#welcomeNote', e => e.textContent.length > 0), 'a bad link explains itself');
  await other.close();
  note(`link is ${shareUrl.length} characters`);
  ok('share link rebuilds the same workout on a fresh device; classics and bad links handled');

  step = 'corrupt preferences fall back, favourites persist';
  await st(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    prefs.people = 7; prefs.minutes = 13; prefs.textScale = 'big'; prefs.blockedTags = 'nope';
    localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
  });
  await p.goto(URL);
  assert(await st(() => state.people === 2 && state.minutes === 20 && state.textScale === 1 && Array.isArray(state.blockedTags)),
         'junk preference values fell back to defaults');
  assert(await st(() => state.saved.length === 2), 'saved favourites survived the reload');
  ok('corrupt preference values fall back to defaults, favourites persist');

  step = 'phone width';
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#pathQuick'); await p.click('#btnBuild');
  const overflow = await st(() => {
    const s = document.getElementById('scroller');
    return s.scrollWidth > s.clientWidth + 1;
  });
  assert(!overflow, 'no horizontal overflow on a phone');
  ok('no horizontal overflow on a phone');

  step = 'opens offline after the first visit';
  await p.goto(URL);
  await st(() => navigator.serviceWorker.ready);
  // The worker precaches the shell and every animation; wait for it to fill.
  const expected = await st(() => 12 + new Set(Object.values(EXERCISES).map(e => e.img)).size);
  await p.waitForFunction(async (n) => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const c = await caches.open(keys[0]);
    return (await c.keys()).length >= n;
  }, expected, { timeout: 60000 });
  await p.reload();
  assert(await st(() => !!navigator.serviceWorker.controller), 'page is controlled by the worker');
  await context.setOffline(true);
  await p.reload();
  assert((await p.$$('.path-card')).length === 4, 'welcome renders with no network');
  await p.click('#pathQuick'); await p.click('#btnBuild');
  assert(await activeView() === 'workoutView', 'a workout builds with no network');
  assert(await st(() => fetch('img/exercises/pushup.svg').then(r => r.ok)), 'an animation comes from the cache with no network');
  await context.setOffline(false);
  ok(`opens, builds and animates offline from a ${expected}-file cache`);

  if (errors.length) {
    console.log('\nCONSOLE ERRORS:'); errors.forEach(e => console.log('  ' + e));
    process.exitCode = 1;
  } else {
    console.log('\nno console errors, all steps passed');
  }
} catch (e) {
  console.log(String(e));
  if (errors.length) { console.log('console errors:'); errors.forEach(x => console.log('  ' + x)); }
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
