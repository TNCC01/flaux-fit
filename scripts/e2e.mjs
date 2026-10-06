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
const GEAR = ['Kettlebells', 'Barbell', 'Dumbbells', 'Skipping rope', 'Rings',
              'Pull-up bar', 'Resistance bands', 'Medicine / slam ball', 'Box or bench'];

// software WebGL, so the 3D figures draw on machines without a GPU (CI)
const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);
const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await context.newPage();
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));

const st = (fn) => p.evaluate(fn);
// a 3D figure has drawn into this element's canvas: enough light body pixels
// against the dark stage
const figureDrawn = (sel) => p.waitForFunction((s) => {
  const c = document.querySelector(`${s} canvas.fig3d`);
  if (!c || !c.width || !c.height) return false;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] > 110 && d[i + 1] > 110) lit++;
  return lit > 40;
}, sel, { timeout: 20000 });
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
  assert(await st(() => Object.values(effectiveEquip()).every(v => v === false)), 'all gear off');
  await p.click('#btnSetupBack'); await p.click('#pathClassics');
  await (await p.$$('.workout-card:has-text("☆")'))[0].click();
  await p.click('#btnShuffle');
  assert(await st(() => state.workout.exerciseIds.every(id => EXERCISES[id].equipment.length === 0)),
         'shuffle after a favourite picked gear that is switched off');
  assert(await p.$eval('#workoutNote', e => e.textContent === ''), 'no error note after a good shuffle');
  ok('shuffle after a favourite stayed bodyweight-only');
  await p.click('#btnBack'); await p.click('#pathQuick'); await toggleAllGear();

  step = 'the weights you own fill the heavier and lighter bell';
  const kbChip = (kg) => `.weight-row:has-text("Kettlebells you have") .chip:text-is("${kg}kg")`;
  await p.click(kbChip(10)); await p.click(kbChip(15));           // off
  await p.click(kbChip(12)); await p.click(kbChip(16)); await p.click(kbChip(24));
  assert(await st(() => state.weights.kb.join(',')) === '12,16,24', 'ticked 12, 16 and 24: ' + await st(() => state.weights.kb.join(',')));
  const loads = await st(() => { const c = buildCtx(null); return [describeEx('kbSwing15', c).display, describeEx('kbPress10', c).display]; });
  assert(loads[0] === 'KB swings · 24kg', `the heaviest bell takes the swings: ${loads[0]}`);
  assert(loads[1] === 'Single-arm KB press · 16kg', `the one nearest two thirds takes the press: ${loads[1]}`);
  assert((await p.$eval('#weightPicker', e => e.textContent)).includes('24kg for swings'), 'setup says which bell does what');
  await p.click(kbChip(12)); await p.click(kbChip(16));           // just the 24
  assert(await st(() => effectiveEquip().kb15 && !effectiveEquip().kb10), 'one bell: only the heavier role is on');
  await p.click('.weight-row:has-text("Barbell") .chip:text-is("30kg")');
  assert(await st(() => describeEx('barbellPress', buildCtx(null)).display) === 'Strict press · 30kg bar', 'the bar shows its load');
  await p.click(kbChip(24)); await p.click(kbChip(10)); await p.click(kbChip(15));
  await p.click('.weight-row:has-text("Barbell") .chip:text-is("10kg")');
  assert(await st(() => state.weights.kb.join(',') === '10,15' && state.weights.bar === 10), 'back to the defaults');
  ok('weights: the heaviest bell and the one nearest two thirds of it fill the roles, the bar shows its load');

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

  step = 'the card shows the exercise as a 3D figure; drag turns it, a tap opens the full view';
  // the full viewer is checked by move-check; here it's the app's side of the tap
  await p.route('**/move.html*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>3D</title>' }));
  await p.click('#btnStart');                                   // running again
  const moveId = await p.$eval('#animA', e => e.dataset.move);
  assert(await st(() => !!EXERCISES[document.getElementById('animA').dataset.move]), `the card knows its exercise (${moveId})`);
  await figureDrawn('#animA');
  const figs = await st(() => [...document.querySelectorAll('.ex-anim')].map(e => `${e.id}:${e.dataset.move}:${e.querySelectorAll('canvas.fig3d').length}`));
  assert(figs.every(f => /:[1]$/.test(f) || /::0$/.test(f)), `one figure per card that has an exercise (${figs})`);
  const box = await p.$eval('#animA', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + i * 12, box.y);
  await p.mouse.up();
  assert(await p.$eval('#moveSheet', e => e.hidden), 'dragging turns the figure without opening the full view');
  await p.click('#animA');
  assert(await p.$eval('#moveSheet', e => !e.hidden), 'the 3D sheet opens');
  assert(await p.$eval('#moveFrame', e => e.getAttribute('src')) === `move.html?embed=1#${moveId}`, 'on that exercise');
  assert(await st(() => state.running), 'the timer keeps running under it');
  await p.keyboard.press('Escape');
  assert(await p.$eval('#moveSheet', e => e.hidden), 'Escape closes it');
  assert(await p.$eval('#moveFrame', e => e.getAttribute('src')) === 'about:blank', 'and stops the 3D page');
  await p.click('#btnStart');                                   // pause
  ok(`${moveId} plays as a 3D figure; a drag turns it and a tap opens it over the running timer`);

  step = 'a rest shows the coming block as thumbnails';
  assert(await p.$eval('#btnNextBlock', e => e.hidden), 'no preview button while working');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'blockrest')); render(); });
  assert(!(await p.$eval('#btnNextBlock', e => e.hidden)), 'the button shows in the block rest');
  await p.click('#btnNextBlock');
  const cards = await p.$$eval('.next-card', els => els.map(e => e.dataset.move));
  const expect = await st(() => {
    const j = state.sequence.findIndex((x, i) => i > state.currentIdx && x.kind === 'work');
    const blk = state.sequence[j].blockIdx;
    const ids = new Set();
    for (const x of state.sequence) if (x.kind === 'work' && x.blockIdx === blk) for (const w of ['a', 'b']) if (x[w]) ids.add(`${w}:${x[w].id}`);
    return ids.size;
  });
  assert(cards.length === expect, `one card per exercise per person in the next block (${cards.length} of ${expect})`);
  assert(await p.evaluate(ids => ids.every(id => !!EXERCISES[id]), cards), 'cards name real exercises');
  await figureDrawn('.next-card .next-thumb');
  assert(await p.$$eval('.next-thumb', ts => ts.every(t => t.querySelector('canvas.fig3d'))), 'every card has its moving figure');
  await p.click('.next-card >> nth=0');
  assert(await p.$eval('#moveFrame', e => e.getAttribute('src')) === `move.html?embed=1#${cards[0]}`, 'a card opens its 3D view');
  await p.keyboard.press('Escape');
  assert(!(await p.$eval('#nextSheet', e => e.hidden)), 'Escape closes the 3D view first');
  await st(() => { seekTo(state.currentIdx + 1); render(); });
  assert(await p.$eval('#nextSheet', e => e.hidden), 'and the preview closes itself when the work starts');
  assert((await p.$$('.next-thumb canvas')).length === 0, 'its figures are let go');
  await p.unroute('**/move.html*');
  ok(`the block rest previews ${cards.length} upcoming exercises, each opening in 3D`);

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

  step = 'EMOM: a minute per round, reps on the card';
  await p.click('#btnBack'); await pickInterval('EMOM');
  await p.click('#btnBuild');
  const emom = await st(() => {
    const work = state.sequence.filter(x => x.kind === 'work');
    const perBlock = {};
    work.forEach(x => { perBlock[x.blockIdx] = (perBlock[x.blockIdx] || 0) + x.duration; });
    return { rests: state.sequence.filter(x => x.kind === 'rest').length,
             minutes: work.every(x => x.duration === 60 && x.emom),
             blocks: Object.values(perBlock), reps: work.every(x => x.a.reps) };
  });
  assert(emom.minutes, 'every work phase is a 60s EMOM minute');
  assert(emom.rests === 0, `no separate rests, got ${emom.rests}`);
  assert(emom.blocks.every(t => t === 240), `blocks stay 4 minutes: ${emom.blocks}`);
  assert(emom.reps, 'every minute carries its reps');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  const shown = await p.$eval('#repsA', e => e.textContent);
  assert(/^(\d+ reps|\d+s? each side|\d+s|.+)$/.test(shown) && shown.length > 0, `reps on the card, got "${shown}"`);
  assert(await p.$eval('#phaseLabel', e => e.textContent) === 'EMOM', 'the timer says EMOM');
  assert(/Minute/.test(await p.$eval('#roundDots', e => e.textContent)), 'counts minutes, not rounds');
  assert((await p.$eval('#upcoming', e => e.textContent)).includes(' · '), 'up next names the reps');
  ok(`EMOM: ${emom.blocks.length} blocks of four 60s minutes, "${shown}" on the card`);

  step = 'AMRAP: one lap per block, a round counter, the score kept';
  await p.click('#btnBack'); await pickInterval('AMRAP');
  await p.click('#btnBuild');
  const amrap = await st(() => {
    const work = state.sequence.filter(x => x.kind === 'work');
    return { all: work.every(x => x.amrap && x.duration === 240 && x.a.circuit.length && x.a.circuit.every(c => c.reps)),
             blocks: work.length, expect: state.workout.blocks.length };
  });
  assert(amrap.all, 'each block is one 240s AMRAP phase with a lap of exercises and their reps');
  assert(amrap.blocks === amrap.expect, `one phase per block (${amrap.blocks} of ${amrap.expect})`);
  await p.click('#btnStart');
  const blk = await st(() => { const i = state.sequence.findIndex(x => x.amrap); seekTo(i); render(); return state.sequence[i].blockIdx; });
  assert(await p.$eval('#phaseLabel', e => e.textContent) === 'AMRAP', 'the timer says AMRAP');
  assert(!(await p.$eval('#circuitA', e => e.hidden)) && !(await p.$eval('#counterA', e => e.hidden)), 'the lap and the counter show');
  await p.click('#counterA .count-more'); await p.click('#counterA .count-more'); await p.click('#counterA .count-less');
  assert((await p.$eval('#counterA .count-now b', e => e.textContent)) === '1', 'two up and one down leaves 1');
  assert(await p.evaluate((b) => state.history[0].scores && state.history[0].scores[b].a === 1, blk), 'the score is saved with the session');
  const lapLen = await p.$$eval('#circuitA li', els => els.length);
  if (lapLen > 1) {
    const before = await p.$eval('#animA', e => e.dataset.move);
    await p.click('#circuitA li[data-i="1"]');
    assert(await p.$eval('#animA', e => e.dataset.move) !== before, 'tapping an exercise in the lap shows its figure');
  }
  await p.click('#btnStart');                                   // pause
  ok(`AMRAP: ${amrap.blocks} four-minute laps, the counter keeps score and history saves it`);

  step = 'For Time: rounds of a lap against a cap, Done logs the time';
  await p.click('#btnBack'); await pickInterval('For Time');
  await p.click('#btnBuild');
  const ft = await st(() => {
    const work = state.sequence.filter(x => x.kind === 'work');
    return work.every(x => x.forTime && x.duration === 240 && x.a.circuit.length && x.a.lapRounds >= 3);
  });
  assert(ft, 'each block is one 240s For Time phase with a lap and a number of rounds');
  await p.click('#btnStart');
  const ftBlk = await st(() => { const i = state.sequence.findIndex(x => x.forTime); seekTo(i); render(); return state.sequence[i].blockIdx; });
  // hold the clock 70 seconds in
  await st(() => { clearInterval(state.tickHandle); state.remainingInPhase = 170; render(); });
  assert(await p.$eval('#phaseLabel', e => e.textContent) === 'For time', 'the timer says For time');
  assert(await p.$eval('#timeDisplay', e => e.textContent) === '1:10', 'and counts up: ' + await p.$eval('#timeDisplay', e => e.textContent));
  assert(/rounds of/i.test(await p.$eval('#circuitA', e => e.textContent)), 'the card says how many rounds');
  await p.click('#counterA .count-more');
  assert(await p.evaluate((b) => state.history[0].scores[b].a === 70, ftBlk), 'Done logs 1:10');
  assert((await p.$eval('#counterA', e => e.textContent)).includes('1:10'), 'the card shows the time');
  if (await st(() => state.people === 1)) {
    assert(await p.$eval('#phaseLabel', e => e.textContent) === 'Rest', 'once done, the rest of the cap is rest');
  }
  await p.click('#btnStart');                                   // pause
  await st(() => { state.intervalStyle = 'short'; savePrefs(); });
  ok('For Time: the clock counts up, Done logs the time to history and the cap turns to rest');

  step = 'Mix: EMOM, short bursts and AMRAP in exactly 30 minutes';
  await p.click('#btnBack'); await p.click('#pathQuick');
  await p.click('#timePicker .chip:text-is("30 min")');
  await p.click('.interval-card:has-text("Two or three styles")');
  // start from nothing, then tap the styles in order
  for (const id of await st(() => state.mixStyles.slice())) {
    await p.click(`.mix-chip:has-text("${await p.evaluate(i => INTERVALS[i].label, id)}")`);
  }
  for (const label of ['EMOM', 'Short bursts', 'AMRAP']) await p.click(`.mix-chip:has-text("${label}")`);
  assert(await st(() => state.mixStyles.join(',')) === 'emom,short,amrap', 'styles picked in order: ' + await st(() => state.mixStyles.join(',')));
  assert(/warm-up.*EMOM.*Short bursts.*AMRAP.*cool-down/.test(await p.$eval('#mixPicker', e => e.textContent)), 'setup shows how the time works out');
  await p.click('#btnBuild');
  const mixRun = await st(() => ({
    total: state.totalDuration,
    order: state.sequence.filter(x => x.kind === 'work').map(x => x.amrap ? 'amrap' : x.emom ? 'emom' : 'short')
      .filter((k, i, all) => k !== all[i - 1]).join(','),
    changeovers: state.sequence.filter(x => x.changeover).length,
    first: state.sequence[0].kind, last: state.sequence[state.sequence.length - 1].kind
  }));
  assert(mixRun.total === 1800, `the whole session is 30:00, got ${mixRun.total}s`);
  assert(mixRun.order === 'emom,short,amrap', `sections run in order: ${mixRun.order}`);
  assert(mixRun.changeovers === 2, `a changeover between each style: ${mixRun.changeovers}`);
  assert(mixRun.first === 'warmup' && mixRun.last === 'cooldown', 'one warm-up at the start, one cool-down at the end');
  await st(() => { seekTo(state.sequence.findIndex(x => x.changeover)); render(); });
  assert(await p.$eval('#phaseLabel', e => e.textContent) === 'Change over', 'the changeover says so');
  assert((await p.$eval('#roundDots', e => e.textContent)).includes('Short bursts'), 'and explains the next style');
  await p.click('#btnBack'); await p.click('#pathQuick');
  await p.click('.interval-card:has-text("Short bursts")');
  assert(await st(() => !state.mixOn), 'picking a single style turns the mix off');
  await p.click('#timePicker .chip:text-is("20 min")');
  await p.click('#btnBuild');
  ok('Mix: 30:00 exactly, EMOM then short bursts then AMRAP, a changeover between each');

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
  // The worker precaches the shell and the 3D files; wait for it to fill.
  const expected = 12 + 17;
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
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  await figureDrawn('#animA');
  await context.setOffline(false);
  ok(`opens, builds and shows the 3D figures offline from a ${expected}-file cache`);

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
