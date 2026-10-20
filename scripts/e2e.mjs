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
const pickInterval = async (label) => { await p.click('#pathBuild'); await p.click(`.interval-card:has-text("${label}")`); };
// Exact name match: "Power Hour" also appears in Half Power's tagline.
const card = (name) => `.workout-card:not(.history-card):has(.card-name:text-is("${name}"))`;
const toggleAllGear = async () => { for (const g of GEAR) await p.click(`#equipmentPicker .chip:has-text("${g}")`); };
// Once Start has been pressed, Menu takes two taps: the first one asks.
const leaveStarted = async (pg = p) => {
  await pg.click('#btnBack');
  assert(await pg.$eval('#btnBack', e => e.textContent) === 'Tap again to leave', 'the first tap on Menu asks');
  await pg.click('#btnBack');
};
// Contrast of white text on every colour stop of an element's background.
const whiteContrast = (sel) => p.$eval(sel, (e) => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const stops = [...getComputedStyle(e).backgroundImage.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)];
  return Math.min(...stops.map(([, r, g, b]) => 1.05 / (0.2126 * lin(+r) + 0.7152 * lin(+g) + 0.0722 * lin(+b) + 0.05)));
});

try {
  await p.goto(URL); await st(() => localStorage.clear()); await p.goto(URL);

  step = 'first visit asks who is training and what gear you have';
  assert(await activeView() === 'gearView', 'a first visit opens on the gear question');
  assert((await p.$eval('#gearView', e => e.textContent)).includes('builds a timed workout'), 'the first screen says what FIT is');
  assert((await p.$eval('#onboardPeople .chip.active', e => e.textContent)) === 'Just me', 'one person to start');
  assert(await p.$$eval('#onboardGear .chip.active', els => els.length) === 0, 'nothing ticked to start');
  assert((await p.$eval('#btnGearDone', e => e.textContent)) === 'Just bodyweight for now', 'no gear reads as bodyweight');
  for (const g of GEAR) await p.click(`#onboardGear .chip:has-text("${g}")`);
  assert(await p.$$eval('#onboardGear .chip.active', els => els.length) === GEAR.length, 'everything ticked');
  assert((await p.$eval('#btnGearDone', e => e.textContent)) === 'Done', 'with gear it says Done');
  assert(await p.$$eval('#onboardWeights .weight-row', els => els.length) === 3, 'a weight row under kettlebells, barbell and dumbbells');
  assert(await st(() => state.weights.kb.length === 0), 'no bells ticked until you say');
  await p.click('#onboardWeights .weight-row:has-text("Kettlebells you have") .chip:text-is("10kg")');
  await p.click('#onboardWeights .weight-row:has-text("Kettlebells you have") .chip:text-is("15kg")');
  await p.click('#onboardPeople .chip:has-text("Me and a mate")');
  await p.click('#btnGearDone');
  assert(await activeView() === 'welcomeView', 'then the home screen');
  assert(await st(() => state.gearAsked && state.gearSets[0].name === 'Home' && state.gearSets[0].equipment.rings === true
                        && state.gearSets[0].weights.kb.join(',') === '10,15' && state.people === 2),
         'the answer is saved as the Home gear set, with the bells ticked and two people');
  await p.goto(URL);
  assert(await activeView() === 'welcomeView', 'and not asked again');
  ok('first visit: who and what gear, weights included, saved as Home, asked once');

  step = 'a newcomer on a phone: one person, their own bell, Start on the first screen';
  {
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const f = await fresh.newPage();
    f.on('pageerror', e => errors.push('newcomer: ' + e));
    f.on('console', m => { if (m.type() === 'error') errors.push('newcomer: ' + m.text()); });
    await f.goto(URL);
    await f.click('#onboardGear .chip:has-text("Kettlebells")');
    assert((await f.$eval('#onboardWeights', e => e.textContent)).includes('Tick at least one'), 'ticking kettlebells asks which bells');
    await f.click('#onboardWeights .chip:text-is("12kg")');
    await f.click('#btnGearDone');
    const home = await f.evaluate(() => {
      const card = document.getElementById('todayCard');
      return { view: document.querySelector('.view.active').id, people: state.people, kb: loadsFor(state.weights).kb15,
               on: [...card.querySelectorAll('.chip.active')].map(c => c.textContent).join(','),
               places: !!card.querySelector('.chip[data-pick^="gear-"]'),
               style: card.querySelector('.today-style').textContent,
               go: card.querySelector('.today-go').getBoundingClientRect().bottom, height: innerHeight };
    });
    assert(home.view === 'welcomeView' && home.people === 1 && home.kb === '12kg', 'one person and the 12kg bell: ' + JSON.stringify(home));
    assert(home.on === '20 min,1 person', 'the Today card starts on 20 minutes, one person: ' + home.on);
    assert(!home.places, 'with one place there is no "Training at" row');
    assert(home.style.startsWith('Short bursts · General fitness'), 'one line says the style and the goal: ' + home.style);
    assert(home.go <= home.height, `Start is on the first screen (bottom ${Math.round(home.go)} of ${home.height})`);
    await f.click('#todayCard .chip:text-is("15 min")');
    assert(await f.evaluate(() => state.minutes) === 15, 'a time chip sets the minutes');
    await f.click('#todayCard .today-go');
    const built = await f.evaluate(() => ({ view: document.querySelector('.view.active').id, people: state.people,
      min: state.workout.request.minutes, total: state.totalDuration, plan: planBlocks(15, INTERVALS.short).total,
      badge: document.getElementById('peopleBadge').textContent }));
    assert(built.view === 'workoutView' && built.people === 1 && built.min === 15 && built.badge === '1 person',
           'Start builds a solo 15-minute workout: ' + JSON.stringify(built));
    assert(built.total === built.plan, `and it runs as long as a 15-minute build does: ${built.total}s, planned ${built.plan}s`);
    await fresh.close();
  }
  ok('a newcomer: just me and a 12kg bell, then 15 min and Start on the home card builds a solo session');

  step = 'welcome';
  assert(await p.$eval('#todayCard', e => e.offsetParent !== null), 'the Today card shows');
  assert((await p.$$('#todayCard .time-chips .chip')).length === 8, 'with the eight times');
  assert(await p.$('#todayCard .today-go'), 'and a Start button');
  assert((await p.$$('.path-card')).length === 2, 'Programs and Saved & ready-made beside it');
  assert((await p.$eval('#pathProgramGo', e => e.textContent)) === 'Start Surf Fit →', 'before a program starts, the card says how to start one');
  assert(!(await p.$('#welcomeFoot')), 'no jargon footer');
  assert(await p.$eval('#installHint', e => e.hidden), 'install hint is hidden on a desktop UA');
  assert((await p.$eval('#installHint', e => e.textContent)).replace(/\s+/g, ' ').includes('the home-screen app keeps its own history'),
         'the install hint says the home-screen app keeps its own data');
  ok('welcome: the Today card, Programs and Saved & ready-made; no footer, no iOS install hint on desktop');

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
  await p.click('#timerCard');
  assert(await st(() => state.running) && (await p.$eval('#btnStart', e => e.textContent)) === 'Pause', 'a tap on the timer resumes');
  await p.click('#timerCard');
  assert(await st(() => !state.running) && (await p.$eval('#btnStart', e => e.textContent)) === 'Resume', 'and another pauses');
  ok('first workout built, saved, started and paused, from the button and from a tap on the timer');

  step = 'Menu mid-workout takes two taps';
  await p.click('#btnBack');
  assert(await activeView() === 'workoutView' && await st(() => !!state.workout), 'one tap on Menu keeps the session');
  assert((await p.$eval('#btnBack', e => e.textContent)) === 'Tap again to leave', 'and asks for a second tap');
  await p.waitForTimeout(2100);
  assert((await p.$eval('#btnBack', e => e.textContent)) === '← Menu', 'the ask goes away after two seconds');
  await leaveStarted();
  assert(await activeView() === 'welcomeView', 'two taps leave');
  await p.click('#todayCard .today-go');
  await p.click('#btnBack');
  assert(await activeView() === 'welcomeView', 'before Start, one tap leaves');
  ok('Menu: one tap asks once a workout is going, two leave; before Start one tap does');

  step = 'second build is weighted by recency, then saved';
  await p.click('#pathBuild'); await p.click('#btnBuild');
  const recentUsed = await st(() => state.workout.request.recent.length);
  assert(recentUsed > 0, 'second build carried a recency list, got ' + recentUsed);
  const previewB = await previewText();
  const idsB = await st(() => state.workout.exerciseIds.join(','));
  await p.click('#btnSave');
  ok(`second workout saved; its request recorded ${recentUsed} recent movements`);

  step = 'switch preference to short, reopen the long favourite';
  await p.click('#btnBack'); await pickInterval('Short bursts');
  await p.click('#btnSetupBack'); await p.click('#pathLibrary');
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
  await p.click('#btnBack'); await p.click('#pathLibrary');
  await (await p.$$('.workout-card:has-text("☆")'))[0].click();
  assert(await st(() => state.workout.exerciseIds.join(',')) === idsB, 'favourite B rebuilt with identical movements');
  assert(await previewText() === previewB, 'preview B identical');
  ok('favourite B replays identically despite the recency weighting');

  step = 'shuffle after a favourite respects switched-off gear';
  await p.click('#btnBack'); await p.click('#pathBuild'); await toggleAllGear();
  assert(await st(() => Object.values(effectiveEquip()).every(v => v === false)), 'all gear off');
  await p.click('#btnSetupBack'); await p.click('#pathLibrary');
  await (await p.$$('.workout-card:has-text("☆")'))[0].click();
  await p.click('#btnShuffle');
  assert(await st(() => state.workout.exerciseIds.every(id => EXERCISES[id].equipment.length === 0)),
         'shuffle after a favourite picked gear that is switched off');
  assert(await p.$eval('#workoutNote', e => e.textContent === ''), 'no error note after a good shuffle');
  ok('shuffle after a favourite stayed bodyweight-only');
  await p.click('#btnBack'); await p.click('#pathBuild'); await toggleAllGear();

  step = 'gear sets: Home and a mate\'s place, one tap apart';
  p.once('dialog', d => d.accept("Mate's place"));
  await p.click('.gear-set-add');
  assert(await st(() => state.gearSets.map(g => g.name).join('|')) === "Home|Mate's place", 'a second set, named');
  await p.click('#btnSetupBack');
  assert(await p.$$eval('#todayCard .chip[data-pick^="gear-"]', els => els.map(e => e.textContent).join('|')) === "Home|Mate's place",
         'with two places, the home card asks where you are training');
  await p.click('#pathBuild');
  await p.click('#equipmentPicker .chip:has-text("Kettlebells")');          // no bells at the mate's
  assert(await st(() => !effectiveEquip().kb15), "kettlebells off at the mate's place");
  await p.click('.gear-set:has-text("Home")');
  assert(await st(() => effectiveEquip().kb15 && state.gearSetId === 'home'), 'back home, the bells are back');
  await p.click(`.gear-set:has-text("Mate's place")`);
  assert(await st(() => !effectiveEquip().kb15), "and the mate's place remembered");
  await p.click('.gear-sets .card-remove');
  assert(await st(() => state.gearSets.length === 1 && effectiveEquip().kb15), 'removing it falls back to Home');
  ok("gear sets: a mate's place without kettlebells, Home with them, one tap apart");

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
  await p.click('#btnSetupBack'); await p.click('#pathLibrary');
  assert(await p.$eval(`${card('Power Hour')} .card-style`, e => e.textContent) === 'Long efforts', 'the classic card says the style it will run as');
  assert(await p.$(card('Sunrise Stretch')) && !(await p.$(`${card('Sunrise Stretch')} .card-style`)), 'a stretch routine has no style to show');
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

  step = 'iPhone sound: beeps on silent, back after a call; the wake lock outlasts a pause';
  assert(await p.$eval('#silentToggle', e => e.hidden) && await p.$eval('#silentHint', e => e.hidden),
         'Chromium has no audioSession, so no silent-switch setting');
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // What the page sees of an iPhone: a session type to set, a context Safari
    // can leave 'interrupted' (and refuse to resume outside a tap), a wake lock.
    await phone.addInitScript(() => {
      window.__audio = { contexts: [], resumes: 0, refuse: false, typeAtCreate: null };
      window.AudioContext = class {
        constructor() {
          this.state = 'running'; this.currentTime = 0; this.destination = {};
          __audio.contexts.push(this); __audio.typeAtCreate = navigator.audioSession.type;
        }
        resume() {
          __audio.resumes++;
          if (__audio.refuse) return Promise.reject(new DOMException('not now', 'InvalidStateError'));
          this.state = 'running'; return Promise.resolve();
        }
        createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {} }; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      };
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
      window.__locks = { asked: 0, held: 0, last: null };
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
        __locks.asked++; __locks.held++;
        const fns = [];
        __locks.last = { addEventListener: (t, f) => fns.push(f),
                         release() { __locks.held--; fns.forEach(f => f()); return Promise.resolve(); } };
        return __locks.last;
      } } });
    });
    const s = await phone.newPage();
    s.on('pageerror', e => errors.push('iPhone sound: ' + e));
    s.on('console', m => { if (m.type() === 'error') errors.push('iPhone sound: ' + m.text()); });
    const ev = (fn) => s.evaluate(fn);
    const ctx = () => ev(() => __audio.contexts[0] && __audio.contexts[0].state);
    const visible = () => ev(() => document.dispatchEvent(new Event('visibilitychange')));
    await s.goto(URL);
    await s.click('#btnGearDone');
    await s.click('#todayCard .today-go');
    assert(await s.$eval('#silentToggle', e => !e.hidden && e.offsetParent !== null), 'the setting shows where audioSession exists');
    assert(await s.$eval('#silentHint', e => !e.hidden && /Spotify/.test(e.textContent)), 'with a hint that other music can pause');
    assert(await s.$eval('#beepOnSilent', e => e.checked) && await ev(() => state.beepOnSilent), 'and it starts on');
    assert(await ev(() => __audio.contexts.length === 0 && navigator.audioSession.type === 'auto'),
           'opening a workout makes no sound and leaves the session alone');

    await s.click('#btnStart');
    assert(await ev(() => __audio.contexts.length === 1 && __audio.typeAtCreate === 'playback'),
           'Start sets the session to playback before the first sound: ' + await ev(() => __audio.typeAtCreate));
    assert(await ev(() => __locks.held === 1), 'and takes the wake lock');

    await ev(() => { __audio.contexts[0].state = 'interrupted'; });  // a phone call
    await ev(() => tickBeep());
    assert(await ctx() === 'running' && await ev(() => __audio.resumes) === 1, 'the next beep resumes an interrupted context');
    await ev(() => { __audio.contexts[0].state = 'interrupted'; });
    await visible();
    assert(await ctx() === 'running' && await ev(() => __audio.resumes) === 2, 'so does coming back to the app');
    await ev(() => { __audio.refuse = true; __audio.contexts[0].state = 'interrupted'; });
    await ev(() => tickBeep());
    await s.waitForTimeout(50);                                 // let a rejected resume surface, if it would
    assert(await ctx() === 'interrupted', 'Safari refusing outside a tap is caught, not thrown');
    await ev(() => { __audio.refuse = false; document.dispatchEvent(new Event('touchend')); });
    assert(await ctx() === 'running', 'and the next touch of the screen brings it back');

    await s.click('#btnStart');                                 // pause for a drink
    assert(await ev(() => !state.running && __locks.held === 1 && !!state.wakeLock), 'a pause keeps the wake lock');
    await ev(() => { __locks.last.release(); __audio.contexts[0].state = 'interrupted'; });  // the browser drops it while hidden
    assert(await ev(() => state.wakeLock === null), 'the app notices the browser letting go');
    const resumesBefore = await ev(() => __audio.resumes);
    await visible();
    assert(await ev(() => __locks.asked === 2 && __locks.held === 1 && !!state.wakeLock), 'coming back to a paused workout asks again');
    assert(await ev(() => __audio.resumes) === resumesBefore, 'but a paused workout leaves the audio (and your music) alone');

    await s.click('#muteAudio');
    assert(await ev(() => navigator.audioSession.type === 'auto'), 'muted, FIT gives the session back');
    await s.click('#muteAudio');
    assert(await ev(() => navigator.audioSession.type === 'playback'), 'unmuted, playback again');
    await s.click('#beepOnSilent');
    assert(await ev(() => !state.beepOnSilent && navigator.audioSession.type === 'auto'), 'turning the setting off goes back to auto');

    await s.click('#btnBack');
    assert(await ev(() => __locks.held === 1 && document.querySelector('.view.active').id === 'workoutView'),
           'the first tap on Menu only asks, so the wake lock stays');
    await s.click('#btnBack');
    assert(await ev(() => __locks.held === 0 && !state.wakeLock), 'leaving the workout lets the wake lock go');
    await visible();
    assert(await ev(() => __locks.asked === 2), 'and nothing asks for it on the home screen');

    await s.reload();
    await s.click('#todayCard .today-go');
    assert(await ev(() => state.beepOnSilent === false) && !(await s.$eval('#beepOnSilent', e => e.checked)), 'off survives a reload');
    await ev(() => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      delete prefs.beepOnSilent;
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
    });
    await s.reload();
    assert(await ev(() => state.beepOnSilent === true), 'prefs saved before the setting existed start it on');
    await phone.close();
  }
  ok('iPhone: playback from the first beep, resumes after a call or a return, a refusal is caught; wake lock kept through a pause, asked again on return, let go on leaving; the setting persists');

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
  // the clock running on into the next phase, as tickClock sees it; the
  // interval is stopped so only these ticks move it
  const runInto = (kind) => p.evaluate((k) => {
    clearInterval(state.tickHandle);
    const i = state.sequence.findIndex((x, j) => j > state.currentIdx && x.kind === k);
    state.elapsedAtResume = state.sequence.slice(0, i).reduce((t, x) => t + x.duration, 0) + 0.5;
    state.runStartWall = Date.now();
    tickClock();
    return state.sequence[state.currentIdx].kind;
  }, kind);
  await runInto('work');
  await p.click('#animA');
  assert(await runInto('rest') === 'rest' && await p.$eval('#moveSheet', e => !e.hidden), 'the 3D sheet stays open into a rest');
  assert(await runInto('work') === 'work' && await p.$eval('#moveSheet', e => e.hidden), 'and gets out of the way when the work starts');
  await p.click('#btnStart');                                   // pause
  ok(`${moveId} plays as a 3D figure; a drag turns it and a tap opens it over the running timer, closing itself for the next work`);

  step = 'a rest shows the coming block as thumbnails';
  assert(await p.$eval('#btnNextBlock', e => e.hidden), 'no preview button while working');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'blockrest')); render(); });
  assert(!(await p.$eval('#btnNextBlock', e => e.hidden)), 'the button shows in the block rest');
  const restClock = await p.$eval('#timeDisplay', e => parseFloat(getComputedStyle(e).fontSize));
  assert(restClock >= 64, `the rest countdown is still big enough to read from the floor (${restClock}px)`);
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
  await leaveStarted(); await pickInterval('Short bursts');
  await p.click('#btnSetupBack'); await p.click('#pathLibrary');
  assert(await p.$eval(`${card('Power Hour')} .card-style`, e => e.textContent) === 'Short bursts', 'the card follows the style picked');
  await p.click(card('Power Hour'));
  assert(await rounds() === 8, 'fresh open of the classic uses today\'s short preference');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  const restNext = await p.$eval('#upcoming strong', e => e.textContent);
  const afterRest = await st(() => withReps(state.sequence[state.currentIdx + 2].a));
  assert(restNext.startsWith('Rest 10s, then ') && restNext.includes(afterRest), `Up next says what the rest is for: "${restNext}"`);
  await p.click('#btnBack'); await p.click('#pathLibrary');
  assert(await p.$('.section-title:has-text("Recent")'), 'Recent section present');
  await p.click('.history-card:has(.card-name:text-is("Power Hour"))');
  assert(await activeView() === 'workoutView', 'history entry reopens');
  assert(await rounds() === 4, 'history entry reopened with the 4-round interval it was run at');
  ok('history reopens a classic at the interval it was actually run');

  step = 'custom flow';
  await p.click('#btnBack'); await p.click('#pathBuild');
  assert(await p.$eval('#moreOptions', e => e.hidden), 'more options start closed');
  assert((await p.$eval('#moreSummary', e => e.textContent)) === 'Whole body · nothing left out', 'and say what is set');
  await p.click('#btnMoreOptions');
  assert(await p.$eval('#rowRegions', e => e.style.display !== 'none' && e.offsetParent !== null), 'target areas visible');
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
  await p.click('#btnBack');
  assert((await p.$eval('#todayCard .today-style', e => e.textContent)).includes('Legs & Glutes'), 'the home card says the build is legs only');
  await p.click('#pathBuild');
  assert(await p.$eval('#moreOptions', e => e.hidden), 'closed again next time');
  assert((await p.$eval('#moreSummary', e => e.textContent)).startsWith('Legs & Glutes · '), 'the closed link still shows legs only');
  await st(() => { state.regions = REGIONS.map(r => r.id); savePrefs(); });
  await p.click('#btnBuild');
  ok('more options: body map, search, a legs-only build, and the choice shows when closed');

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
  assert((await p.$eval('#roundDots', e => e.textContent)).includes("Do the reps, then rest till the minute's up"), 'and says how an EMOM works');
  assert((await p.$eval('#upcoming', e => e.textContent)).includes(' · '), 'up next names the reps');
  const [repsPx, namePx] = await st(() => ['repsA', 'exerciseA'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));
  assert(repsPx >= namePx, `the reps are as big as the name (${repsPx}px, name ${namePx}px)`);
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
  const shows = (id) => p.$eval(id, e => getComputedStyle(e).display !== 'none');
  assert(await shows('#circuitA') && await shows('#counterA'), 'the lap and the counter show');
  await p.click('#counterA .count-more'); await p.click('#counterA .count-more'); await p.click('#counterA .count-less');
  assert((await p.$eval('#counterA .count-now b', e => e.textContent)) === '1', 'two up and one down leaves 1');
  assert(await p.evaluate((b) => state.history[0].scores && state.history[0].scores[b].a === 1, blk), 'the score is saved with the session');
  const lapLen = await p.$$eval('#circuitA li', els => els.length);
  if (lapLen > 1) {
    const before = await p.$eval('#animA', e => e.dataset.move);
    await p.click('#circuitA li[data-i="1"]');
    assert(await p.$eval('#animA', e => e.dataset.move) !== before, 'tapping an exercise in the lap shows its figure');
  }
  // skip the rest of the blocks with no score, on to the cool-down
  while (await st(() => state.sequence[state.currentIdx].kind !== 'cooldown')) await p.click('#btnSkip');
  assert(!(await shows('#circuitA')) && !(await shows('#counterA')) && !(await shows('#counterB')),
         'the lap and +1 round are gone in the cool-down');
  const amrapLine = await st(() => scoreLine(state.history[0]));
  const dashes = (amrap.blocks - 1) * (await st(() => state.people));
  assert(await p.evaluate((b) => state.history[0].scores.every((x, i) => i === b ? !x.skipped : x.skipped), blk), 'the blocks skipped with no score are marked skipped');
  assert((amrapLine.match(/–/g) || []).length === dashes && amrapLine.includes('1 · –'), `and read "–", not 0: ${amrapLine}`);
  await p.click('#btnStart');                                   // pause
  ok(`AMRAP: ${amrap.blocks} four-minute laps, the counter keeps score and history saves it; skipped blocks read "–" and the lap goes after`);

  step = 'For Time: rounds of a lap against a cap, Done logs the time';
  await leaveStarted(); await pickInterval('For Time');
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
  await p.click('#btnSkip'); await p.click('#btnSkip'); await p.click('#btnSkip');   // block 1, its rest, then skip block 2
  assert(await p.evaluate((b) => !state.history[0].scores[b].skipped && state.history[0].scores[b + 1].skipped, ftBlk),
         'a block skipped before Done is marked skipped');
  assert(/^Times: [^,]*1:10 · –/.test((await st(() => scoreLine(state.history[0]))).replace(/<[^>]+>/g, '')),
         'and reads "–", not capped: ' + await st(() => scoreLine(state.history[0])));
  await p.click('#btnStart');                                   // pause
  await st(() => { state.intervalStyle = 'short'; savePrefs(); });
  ok('For Time: the clock counts up, Done logs the time to history and the cap turns to rest; a skipped block reads "–"');

  step = 'history keeps who trained, so a score stays with its person after a rename';
  await leaveStarted(); await pickInterval('AMRAP');
  await p.click('#peoplePicker .chip[data-people="2"]');
  await p.fill('#nameA', 'Dave'); await p.fill('#nameB', 'Wayne');
  await p.click('#btnBuild'); await p.click('#btnStart');
  const amrapAt = () => st(() => { seekTo(state.sequence.findIndex(x => x.amrap)); render(); });
  await amrapAt();
  for (let i = 0; i < 3; i++) await p.click('#counterA .count-more');
  await leaveStarted();
  // Dave hands over to Sam
  await p.click('#pathBuild'); await p.fill('#nameA', 'Sam'); await p.click('#btnSetupBack');
  await p.click('#pathLibrary');
  const named = await p.$eval('.history-card', e => ({ meta: e.querySelector('.card-meta').textContent.replace(/\s+/g, ' '),
                                                       score: e.querySelector('.card-score').textContent }));
  assert(named.meta.includes('Dave & Wayne') && named.meta.includes('· AMRAP'), 'the card says who trained and the style by name: ' + named.meta);
  assert(named.score.startsWith('Rounds: Dave 3') && named.score.includes('Wayne 0') && !named.score.includes('Sam'),
         'the score stays with Dave, not today\'s Person A: ' + named.score);
  await p.click('.history-card');
  await amrapAt();
  const [samLast, wayneLast] = await Promise.all(['#counterA', '#counterB'].map(s => p.$eval(s, e => e.textContent)));
  assert(!samLast.includes('Last time') && wayneLast.includes('Last time 0'), `Sam has no "Last time", Wayne has his own: "${samLast}" / "${wayneLast}"`);
  // swapped round, each still sees their own
  await p.click('#btnBack');
  await p.click('#pathBuild'); await p.fill('#nameA', 'Wayne'); await p.fill('#nameB', 'Dave'); await p.click('#btnSetupBack');
  await p.click('#pathLibrary'); await p.click('.history-card');
  await amrapAt();
  const [aLast, bLast] = await Promise.all(['#counterA', '#counterB'].map(s => p.$eval(s, e => e.textContent)));
  assert(aLast.includes('Last time 0') && bLast.includes('Last time 3'), `swapped, Dave's 3 follows him to B: "${aLast}" / "${bLast}"`);
  await p.click('#btnBack');
  await p.click('#pathBuild'); await p.fill('#nameA', ''); await p.fill('#nameB', '');
  await p.click('.interval-card:has-text("Short bursts")');
  await p.click('#btnBuild'); await p.click('#btnStart');
  ok('history keeps the names: a rename leaves the score with Dave, a new name gets no "Last time", and a swap follows the person');

  step = 'Mix: EMOM, short bursts and AMRAP in exactly 30 minutes';
  await leaveStarted(); await p.click('#pathBuild');
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
  await p.click('#btnBack');
  assert((await p.$eval('#todayCard .today-style', e => e.textContent)).startsWith('Mix: EMOM, Short bursts, AMRAP · '), 'the home card names the mix');
  await p.click('#pathBuild');
  await p.click('.interval-card:has-text("Short bursts")');
  assert(await st(() => !state.mixOn), 'picking a single style turns the mix off');
  await p.click('#timePicker .chip:text-is("20 min")');
  await p.click('#btnBuild');
  ok('Mix: 30:00 exactly, EMOM then short bursts then AMRAP, a changeover between each');

  step = "Mix: no time on offer that the mix won't fit, and a build error shows by the button";
  await p.click('#btnBack'); await p.click('#pathBuild');
  assert(await st(() => state.minutes === 20 && !state.mixOn), 'starting from one style at 20 minutes');
  const dimmed = (sel) => p.$$eval(`${sel} .chip.dim`, els => els.map(e => e.textContent).join(','));
  await p.click('.interval-card:has-text("Two or three styles")');
  assert(await st(() => mixMinimumMinutes(state.mixStyles)) === 25, 'EMOM, short bursts and AMRAP need 25 minutes');
  assert(await st(() => state.minutes) === 25, 'turning Mix on raises 20 minutes to the 25 it needs');
  assert(await dimmed('#timePicker') === '10 min,15 min,20 min', 'the shorter times are dimmed: ' + await dimmed('#timePicker'));
  assert(await p.$$eval('#timePicker .chip.dim', els => els.every(e => e.getAttribute('aria-disabled') === 'true')), 'and marked as not on offer');
  assert(((await p.$eval('#timeHint', e => !e.hidden && e.textContent)) || '').includes('at least 25 min'), 'a line under the times says why');
  await p.click('#timePicker .chip:text-is("15 min")', { force: true });
  assert(await st(() => state.minutes) === 25, 'a dimmed time does nothing');
  await p.click('.mix-chip:has-text("AMRAP")');
  assert(await dimmed('#timePicker') === '10 min' && await st(() => state.minutes) === 25, 'two styles fit in 15, and the time stays as picked');
  await p.click('#timePicker .chip:text-is("15 min")');
  assert(await st(() => state.minutes) === 15, '15 can be picked now');
  await p.click('.mix-chip:has-text("AMRAP")');
  assert(await st(() => state.minutes === 25 && state.mixStyles.join(',') === 'emom,short,amrap'), 'adding the third style back raises it to 25 again');
  assert(await st(() => !planMix(state.minutes, state.mixStyles).error), 'so the mix always fits the time');
  await p.click('#btnSetupBack');
  assert(await dimmed('#todayCard') === '10 min,15 min,20 min', 'the home card dims the same times');
  assert((await p.$eval('#todayCard', e => e.textContent)).includes('This mix needs at least 25 min'), 'and says why');
  await p.click('#pathBuild');
  // an error the time can't fix: it comes up beside the button, not off the bottom
  await st(() => { state.excluded = Object.keys(EXERCISES); document.getElementById('scroller').scrollTop = 0; });
  await p.click('#btnBuild');
  const refused = await st(() => {
    const n = document.getElementById('buildNote').getBoundingClientRect();
    const b = document.getElementById('btnBuild').getBoundingClientRect();
    return { text: document.getElementById('buildNote').textContent, top: n.top, bottom: n.bottom, gap: n.top - b.bottom, h: innerHeight };
  });
  assert(await activeView() === 'setupView' && refused.text.includes('excluded'), 'the build is refused: ' + refused.text);
  assert(refused.top >= 0 && refused.bottom <= refused.h && refused.gap >= 0 && refused.gap < 60,
         `and the reason is on screen just under the button: ${JSON.stringify(refused)}`);
  await st(() => { state.excluded = []; savePrefs(); });
  await p.click('.interval-card:has-text("Short bursts")');
  assert(await dimmed('#timePicker') === '' && await p.$eval('#timeHint', e => e.hidden), 'one style: every time is on offer again');
  await p.click('#timePicker .chip:text-is("20 min")');
  await p.click('#btnBuild');
  assert(await st(() => state.totalDuration) === 1200, `and 20 minutes runs 20:00, got ${await st(() => state.totalDuration)}s`);
  ok('Mix: shorter times dimmed and the minutes raised to fit, on setup and the home card; a refused build says why by the button');

  step = 'Surf fitness: a session built from surf exercises';
  await p.click('#btnBack'); await p.click('#pathBuild');
  await p.click('#goalPicker .chip:has-text("Surf fitness")');
  assert(await p.$eval('#rowRegions', e => e.style.display === 'none'), 'target areas step aside for the surf goal');
  assert((await p.$eval('#goalHint', e => e.textContent)).includes('paddle'), 'the goal says what it trains');
  await p.click('#btnBuild');
  const surfIds = await st(() => state.workout.exerciseIds);
  assert(await st(() => state.workout.exerciseIds.every(id => (EXERCISES[id].surf || []).length)), 'every exercise trains something for surfing');
  assert(await st(() => state.workout.exerciseIds.some(id => EXERCISES[id].surf.includes('popup'))), 'pop-up work is in');
  assert(await st(() => state.workout.name.startsWith('Surf fitness')), 'named for it');
  await p.click('#btnBack');
  assert((await p.$eval('#todayCard .today-style', e => e.textContent)).includes('Short bursts · Surf fitness'), 'the home card says the goal');
  await p.click('#pathBuild');
  await p.click('#goalPicker .chip:has-text("General fitness")');
  assert(await p.$eval('#rowRegions', e => e.style.display !== 'none'), 'target areas come back');
  await p.click('#btnBuild');
  ok(`Surf fitness: ${surfIds.length} surf exercises, pop-ups included; target areas return for general fitness`);

  step = 'Programs: Surf Fit day by day';
  await p.click('#btnBack');
  await p.click('#pathProgram');
  assert(await activeView() === 'programView', 'programs open');
  await p.click('#programBody button:has-text("Start Surf Fit")');
  assert((await p.$eval('#programBody', e => e.textContent)).includes('Day 1'), 'day 1 of the program');
  assert((await p.$$('.program-dot')).length === 7, 'the week strip has seven days');
  // home now leads with today's session, and can set it aside for the day
  await p.click('#btnProgramBack');
  const homeDay = await p.$eval('#todayCard', e => e.textContent);
  assert(homeDay.includes('Week 1, Day 1') && homeDay.includes('Paddle power'), "home shows today's session: " + homeDay.slice(0, 80));
  assert((await p.$eval('#pathProgramGo', e => e.textContent)) === 'Surf Fit · week 1 of 6 →', 'the Programs card says where you are up to');
  await p.click('#todayCard .link-btn:has-text("Something else today")');
  assert(await p.$('#todayCard #pathBuild') && !(await p.$('#todayCard .program-go:has-text("today")')), 'something else today swaps in a built workout');
  await p.click('#todayCard .link-btn:has-text("Back to today")');
  await p.click('#todayCard .time-chips .chip:text-is("15 min")');
  await p.click('#todayCard .program-go');
  const fromHome = await st(() => ({ view: document.querySelector('.view.active').id, n: state.programRun && state.programRun.n,
    goal: state.workout.request.goal, min: state.workout.request.minutes }));
  assert(fromHome.view === 'workoutView' && fromHome.n === 0 && fromHome.goal === 'surf' && fromHome.min === 15,
         "Start on the home card opens day 1 at 15 minutes: " + JSON.stringify(fromHome));
  await p.click('#btnBack');
  assert(await activeView() === 'programView', 'and back goes to the program');
  // who and where can be changed right on today's card
  const peopleBefore = await st(() => state.people);
  await st(() => {
    state.gearSets.push({ id: 'mates', name: "Mate's place", equipment: { ...state.equipment, kettlebells: false }, weights: structuredClone(state.weights) });
    renderProgram();
  });
  await p.click('.program-today .chip[data-pick="gear-mates"]');
  await p.click('.program-today .chip[data-pick="people-1"]');
  const picked = await st(() => ({ set: state.gearSetId, kb: !!effectiveEquip().kb15, people: state.people,
    on: [...document.querySelectorAll('.program-today .chip.active')].map(c => c.dataset.pick).filter(Boolean).join(',') }));
  assert(picked.set === 'mates' && !picked.kb && picked.people === 1 && picked.on === 'people-1,gear-mates',
         "today's card switches to the mate's place, solo: " + JSON.stringify(picked));
  await p.click('.program-today .chip[data-pick="gear-home"]');
  await p.click(`.program-today .chip[data-pick="people-${peopleBefore}"]`);
  assert(await st(() => state.gearSetId === 'home' && !!effectiveEquip().kb15), 'and back home with the bells');
  await st(() => { state.gearSets = state.gearSets.filter(g => g.id !== 'mates'); renderProgram(); });
  assert(!(await p.$('.program-today .chip[data-pick^="gear-"]')), 'with one place left, no "Training at" row');
  await p.click('.program-today .chip:text-is("15 min")');
  await p.click('.program-today .program-go');
  assert(await activeView() === 'workoutView', "today's session opens");
  const day1 = await st(() => ({ goal: state.workout.request.goal, focus: state.workout.request.surfFocus,
    scale: state.workout.repScale, style: state.workout.request.intervalId, min: state.workout.request.minutes }));
  assert(day1.goal === 'surf' && day1.focus === 'paddle' && day1.style === 'long' && day1.min === 15,
         'day 1 is a 15-minute surf paddle session: ' + JSON.stringify(day1));
  assert(day1.scale === 0.8, 'week 1 starts lighter: ' + day1.scale);
  // skipping through without ever pressing Start doesn't count as the day done
  const skipToEnd = async () => { while (await st(() => !isFinished())) await p.click('#btnSkip'); };
  await skipToEnd();
  assert(await st(() => state.programs['surf-fit'].done.length === 0 && !state.history.some(h => h.completed && h.key === historyKey(state.workout))),
         'skipping to the end without Start ticks nothing off');
  await p.click('#btnAgain');
  assert(await st(() => state.running && state.currentIdx === 0 && state.started) && (await p.$eval('#btnSkip', e => e.offsetParent !== null)),
         'Start over runs it again from the top');
  await skipToEnd();
  // the finish screen: Done and Start over, Save and Share, nothing left over from the workout
  const fin = await st(() => {
    const shown = (id) => getComputedStyle(document.getElementById(id)).display !== 'none' && document.getElementById(id).offsetParent !== null;
    return { done: document.getElementById('btnStart').textContent, again: shown('btnAgain'), share: shown('btnShare'),
             gone: ['btnSkip', 'btnReset', 'btnShuffle', 'previewCard', 'circuitA', 'counterA', 'circuitB', 'counterB', 'btnNextBlock'].filter(shown) };
  });
  assert(fin.done === 'Done' && fin.again && fin.share && !fin.gone.length, 'the finish screen offers Done, Start over and Share, and nothing else: ' + JSON.stringify(fin));
  await p.click('#timerCard');
  assert(await st(() => !state.running && isFinished()), 'a tap on the finished timer does nothing');
  await p.click('#btnStart');
  assert(await activeView() === 'programView', 'Done goes back to the program');
  const after = await p.$eval('#programBody', e => e.textContent);
  assert(after.includes("Today's done") && after.includes('Pop-ups & legs'), 'day 1 ticked, day 2 next');
  await p.click('#programBody button:has-text("Do the next one now anyway")');
  await p.click('#programBody button:has-text("I surfed today")');
  const prog = await st(() => state.programs['surf-fit'].done.map(d => `${d.n}${d.surfed ? 's' : ''}`).join(','));
  assert(prog === '0,1s', 'a surf counts as day 2: ' + prog);
  assert((await p.$eval('.program-progress', e => e.textContent)).includes('Day 3'), 'on to day 3');
  await p.click('#btnProgramBack');
  const doneLine = await p.$eval('#todayCard .today-line', e => e.textContent);
  assert(doneLine.includes("today's done") && doneLine.includes('Next up: Mobility'), 'home says today is done and what is next: ' + doneLine);
  assert(await p.$('#todayCard .today-go'), 'with a built workout still one tap away');
  await p.click('#pathBuild'); await p.click('#btnBuild');     // the next step starts from a workout
  ok("Programs: today's session leads the home card; who and where change on the day card; Surf Fit day 1 builds lighter for week 1; skipping through without Start ticks nothing, a real finish does and Done goes back to the program; a surf counts as a day");

  step = 'Programs: leave-outs carry over, a short Engine day still runs, a surf can be undone';
  await p.click('#btnBack');
  await p.click('#pathBuild'); await p.click('#btnMoreOptions');
  await p.click('#tagPicker .chip:text-is("No jumping")');
  assert(await st(() => state.blockedTags.join(',')) === 'impact', 'no jumping is on in Build a workout');
  await p.click('#btnSetupBack');
  // days 1 to 3 done yesterday, so day 4 (Engine) is today's, on the home card
  await st(() => { const d = state.programs['surf-fit'].done; d.push({ n: 2, at: Date.now() }); d.forEach(x => { x.at -= 86400000; }); savePrefs(); renderToday(); });
  const engineHome = await p.$eval('#todayCard', e => e.textContent);
  assert(engineHome.includes('Week 1, Day 4') && engineHome.includes('Engine'), 'home leads with the Engine day: ' + engineHome.slice(0, 80));
  assert((await p.$eval('#todayCard .program-out', e => e.textContent)) === 'Left out, as in Build a workout: no jumping. Change',
         'the day card says what is left out, with a Change link');
  assert((await p.$$('#todayCard .time-chips .chip')).length === 8, 'every length is on offer for the Engine day, 10 min included');
  assert(!engineHome.includes('too short'), 'at its own 25 minutes the mix fits');
  await p.click('#todayCard .time-chips .chip:text-is("10 min")');
  assert((await p.$eval('#todayCard', e => e.textContent)).includes("10 min is too short for EMOM and AMRAP, so today it's just the EMOM."),
         '10 min says what it runs as');
  await p.click('#todayCard .program-go');
  const shortDay = await st(() => ({ view: document.querySelector('.view.active').id, style: state.workout.request.intervalId,
    min: state.workout.request.minutes, n: state.programRun && state.programRun.n, tags: state.workout.request.blockedTags.join(','),
    jumps: state.workout.exerciseIds.filter(id => EXERCISES[id].tags.includes('impact')) }));
  assert(shortDay.view === 'workoutView' && shortDay.style === 'emom' && shortDay.min === 10 && shortDay.n === 3,
         'a 10-minute Engine day runs as an EMOM instead of refusing: ' + JSON.stringify(shortDay));
  assert(shortDay.tags === 'impact' && !shortDay.jumps.length, 'and leaves out jumping: ' + JSON.stringify(shortDay));
  await p.click('#btnBack');
  assert(await activeView() === 'programView', 'back to the program');
  assert(await p.$('.program-today .program-out .link-btn:text-is("Change")'), 'the program screen says what is left out too');
  assert((await p.$$('.program-today .time-chips .chip')).length === 8, 'with all eight lengths');
  await p.click('.program-today .program-go');
  assert(await st(() => state.workout.request.intervalId === 'mix' && state.workout.request.mix.join(',') === 'emom,amrap'
                        && state.workout.request.minutes === 25), 'at 25 minutes it is the full EMOM and AMRAP mix');
  await p.click('#btnBack');
  // the jumpiest day keeps to no jumping, and without the leave-out it would have jumped
  const popJumps = (tags) => p.evaluate((t) => {
    state.blockedTags = t;
    const prog = PROGRAMS[0];
    let n = 0;
    for (let i = 0; i < 10; i++) { state.programMinutes = 20; startProgramDay(prog, programDay(prog, 1)); n += state.workout.exerciseIds.filter(id => EXERCISES[id].tags.includes('impact')).length; }
    return n;
  }, tags);
  const jumpsOff = await popJumps(['impact']), jumpsOn = await popJumps([]);
  assert(jumpsOff === 0 && jumpsOn > 0, `ten Pop-ups & legs days: ${jumpsOff} jumping moves with no jumping, ${jumpsOn} without it`);
  await st(() => { state.blockedTags = ['impact']; savePrefs(); });
  await p.click('#btnBack');
  // "I surfed today" by mistake, then Undo, on the program screen and on home
  await p.click('.program-today button:has-text("I surfed today")');
  assert(await st(() => state.programs['surf-fit'].done.length === 4) && (await p.$eval('#programBody', e => e.textContent)).includes("Today's done"), 'a surf logged');
  await p.click('#programNote .link-btn:text-is("Undo")');
  assert(await st(() => state.programs['surf-fit'].done.length === 3) && await p.$('.program-today') && (await p.$eval('#programNote', e => e.textContent)) === '',
         'Undo takes it back, and the Engine day is today again');
  await p.click('#btnProgramBack');
  await p.click('#todayCard button:has-text("I surfed today")');
  assert((await p.$eval('#todayCard .today-line', e => e.textContent)).includes("today's done"), 'from home too');
  await p.click('#welcomeNote .link-btn:text-is("Undo")');
  assert(await st(() => state.programs['surf-fit'].done.length === 3) && (await p.$eval('#todayCard', e => e.textContent)).includes('Engine'),
         'and Undo on home brings the Engine day back');
  // tidy up: nothing left out, and today done (a surf), so home offers a built workout again
  await st(() => { state.blockedTags = []; savePrefs(); renderToday(); });
  assert(!(await p.$('#todayCard .program-out')), 'with nothing left out, no line');
  await p.click('#todayCard button:has-text("I surfed today")');
  ok(`Programs: No jumping reaches the program day and says so on both cards; Engine at 10 min is an EMOM, at 25 the mix; Pop-ups & legs had ${jumpsOn} jumping moves in ten builds without the leave-out, none with it; a surf can be undone`);

  step = 'history: program days by name, 200 kept, two taps to clear';
  await p.click('#pathLibrary');
  const dayCard = await p.$eval('.history-card:has(.card-tagline:has-text("Surf Fit · Week 1, Day 1"))',
    e => ({ name: e.querySelector('.card-name').textContent, meta: e.querySelector('.card-meta').textContent.replace(/\s+/g, ' ') }));
  assert(dayCard.name === 'Paddle power' && dayCard.meta.includes('Long efforts'), 'a program day goes by its name and style: ' + JSON.stringify(dayCard));
  // a long run of sessions: the newest 200 are kept, more than a 42-day program
  await st(() => {
    const h = state.history[0];
    state.history = Array.from({ length: 250 }, (_, i) => ({ ...h, key: `old:${i}`, at: h.at - (i + 1) * 4 * 3600e3 }));
    savePrefs();
  });
  await p.click(card('Power Hour')); await p.click('#btnStart');
  assert(await st(() => state.history.length === 200 && state.history[0].key === 'id:power-hour' && state.history[199].key === 'old:198'),
         'the newest 200 sessions are kept: ' + await st(() => state.history.length));
  await leaveStarted(); await p.click('#pathLibrary');
  await p.click('.section-action:has-text("Clear history")');
  assert(await st(() => state.history.length === 200) && (await p.$eval('.section-action', e => e.textContent)) === 'Tap again to clear',
         'one tap only asks');
  await p.waitForTimeout(3100);
  assert((await p.$eval('.section-action', e => e.textContent)) === 'Clear history', 'and the ask goes after three seconds');
  await p.click('.section-action'); await p.click('.section-action');
  assert(await st(() => state.history.length === 0) && !(await p.$('.section-title:has-text("Recent")')), 'two taps clear it');
  await p.click(card('Power Hour'));                          // the next step starts from a workout
  ok('history: a program day reads "Paddle power", 200 sessions kept, Clear history takes two taps');

  step = 'stretch';
  await p.click('#btnBack'); await p.click('#pathLibrary');
  assert(await p.$('.section-title:text-is("Stretch & mobility")'), 'stretches have their own section');
  await p.click('#focusFilter .chip:text-is("Stretching")');
  await p.click(card('Sunrise Stretch'));
  assert(await p.$eval('#exerciseA', e => e.textContent.length > 0), 'stretch shows a pose');
  const stretchNext = await st(() => state.sequence[1].a.name);
  assert((await p.$eval('#upcoming strong', e => e.textContent)) === stretchNext, `up next names the next stretch (${stretchNext})`);
  assert(/^Stretch 1 of \d+/.test(await p.$eval('#roundDots', e => e.textContent)), 'counts stretches, not rounds');
  assert((await p.$eval('#btnSkip', e => e.textContent)) === 'Skip', 'and the skip button skips one stretch');
  ok('stretch routine opens, naming the next stretch');

  step = 'text size';
  const small = await p.$eval('#exerciseA', e => parseFloat(getComputedStyle(e).fontSize));
  await p.click('.text-size .mini-btn[data-scale="1.45"]');
  const large = await p.$eval('#exerciseA', e => parseFloat(getComputedStyle(e).fontSize));
  assert(large > small, 'text size control enlarges');
  note(`${small}px -> ${large}px`);
  ok('text size control works');

  step = 'share link rebuilds the same workout on another device, for as many people';
  await p.click('#btnBack'); await p.click('#pathBuild');
  const peopleWas = await st(() => state.people);
  await p.click('#peoplePicker .chip[data-people="2"]');
  await p.click('#btnBuild');
  const sharedIds = await st(() => state.workout.exerciseIds.join(','));
  const sharedSeed = await st(() => state.workout.seed);
  const shareUrl = await st(() => shareUrlFor(state.workout));
  assert(shareUrl.includes('#w='), 'share url carries a payload');
  // what goes with the link: the name (which ends in its minutes), the style and how many
  const sharedText = await st(() => {
    const r = state.workout.request;
    const style = r.intervalId === 'mix' ? `Mix: ${r.mix.map(id => INTERVALS[id].label).join(', ')}` : INTERVALS[r.intervalId].label;
    return { got: shareText(state.workout), want: `FIT: ${state.workout.name} · ${style} · 2 people`, name: state.workout.name };
  });
  assert(/ · \d+ min$/.test(sharedText.name) && sharedText.got === sharedText.want,
         'the share text says the minutes, style and people: ' + JSON.stringify(sharedText));
  // No share sheet in headless Chromium, so the button copies the link.
  await p.click('#btnShare');
  await p.waitForFunction(() => document.getElementById('workoutNote').textContent.length > 0);
  const shareNote = await p.$eval('#workoutNote', e => e.textContent);
  assert(/Link copied/.test(shareNote), 'share button reports the copy, got: ' + shareNote.slice(0, 80));
  const clip = await st(() => navigator.clipboard.readText().catch(() => null));
  if (clip === null) note('clipboard not readable here, skipping that check');
  else assert(clip === shareUrl, 'clipboard holds the link');
  // "Another device": a fresh browser context with nothing stored, so one person to start.
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
  assert(await q.evaluate(() => state.people === 2 && document.getElementById('peopleBadge').textContent === '2 people'
                                && document.getElementById('personB').offsetParent !== null), 'and for two people, as it was sent');
  // once Start is pressed Share stays (the rest of the pre-start strip goes), and the sheet gets the text
  await q.evaluate(() => { navigator.share = (d) => { window.sharedWith = d; return Promise.resolve(); }; });
  await q.click('#btnStart');
  const midShown = await q.evaluate(() => ['btnShare', 'btnShuffle', 'btnSave', 'previewCard'].filter(id => document.getElementById(id).offsetParent !== null));
  assert(midShown.join(',') === 'btnShare', 'once started, Share is still there and Shuffle, Save and the preview are not: ' + midShown);
  await q.click('#btnShare');
  const sent = await q.evaluate(() => window.sharedWith);
  assert(sent && sent.text === sharedText.want && sent.title === `FIT: ${sharedText.name}` && sent.url.includes('#w='),
         'mid-workout, the share sheet gets the link and the text: ' + JSON.stringify(sent && sent.text));
  // leaving it on a first visit asks who and what gear before home, the link's two people ticked
  await leaveStarted(q);
  assert(await q.evaluate(() => document.querySelector('.view.active').id) === 'gearView', 'leaving a shared workout on a first visit asks the gear question');
  assert((await q.$eval('#onboardPeople .chip.active', e => e.textContent)) === 'Me and a mate', 'with two people ticked, as the link was');
  await q.goto(URL + '#w=notaworkout');
  assert(await q.evaluate(() => document.querySelector('.view.active').id) === 'gearView'
         && /not a FIT workout/.test(await q.$eval('#gearNote', e => e.textContent)), 'a bad link on a first visit explains itself above the question');
  await q.click('#btnGearDone');
  assert(await q.evaluate(() => document.querySelector('.view.active').id === 'welcomeView' && state.gearAsked && state.people === 2),
         'then home, with the answer kept');
  // a solo link opens solo on a device set to two
  await p.click('#btnBack'); await p.click('#pathBuild');
  await p.click('#peoplePicker .chip[data-people="1"]');
  await p.click('#btnBuild');
  const soloUrl = await st(() => shareUrlFor(state.workout));
  await q.goto(soloUrl);
  assert(await q.evaluate(() => state.people === 1 && document.getElementById('peopleBadge').textContent === '1 person'
                                && document.getElementById('personB').offsetParent === null), 'a solo link opens for one person');
  // a solo build reopened with a mate (a favourite, say) shares as it's on screen: two
  assert(await st(() => { state.people = 2; const n = sharePayload(state.workout).request.people; state.people = 1; return n; }) === 2,
         'the link carries the people on screen, not the people it was first built for');
  await p.click('#btnBack'); await p.click('#pathBuild');
  await p.click('#peoplePicker .chip[data-people="2"]');
  await p.click('#btnSetupBack'); await p.click('#pathLibrary');
  assert(await st(() => state.filterFocus) === 'all', 'the library opens on everything after a Stretching filter');
  const classicMeta = await p.$eval(`${card('Power Hour')} .card-meta`, e => [e.querySelector('.duration').textContent, e.querySelector('.card-style').textContent]);
  await p.click(card('Power Hour'));
  const classicUrl = await st(() => shareUrlFor(state.workout));
  await q.goto(classicUrl);
  assert(await q.evaluate(() => state.workout.id) === 'power-hour', 'a classic shares by id');
  assert(await q.evaluate(() => state.people === 2 && document.getElementById('peopleBadge').textContent === '2 people'),
         'and carries its people too (the device was on one)');
  const classicText = await q.evaluate(() => shareText(state.workout));
  assert(classicText === `FIT: Power Hour · ${classicMeta[0]} · ${classicMeta[1]} · 2 people`, 'a classic says its minutes and style: ' + classicText);
  assert(/^FIT: .+ · \d+ min · Stretching · 2 people$/.test(await q.evaluate(() => shareText(STRETCH_ROUTINES[0]))), 'a stretch says Stretching');
  await q.goto(URL + '#w=notaworkout');
  assert(await q.evaluate(() => document.querySelector('.view.active').id) === 'welcomeView', 'a bad link lands on welcome');
  assert(await q.$eval('#welcomeNote', e => e.textContent.length > 0), 'a bad link explains itself');
  await other.close();
  if (peopleWas !== 2) await p.evaluate((n) => { state.people = n; savePrefs(); }, peopleWas);
  note(`link is ${shareUrl.length} characters`);
  ok('share link rebuilds the same workout on a fresh device for as many people as it was sent for, says the minutes, style and people, and Share stays once started; a first visit by link asks the gear question on the way home; classics and bad links handled');

  step = 'two tabs open: one saving does not wipe what the other saved';
  await p.click('#btnBack'); await p.click('#pathLibrary');
  const cardsBefore = (await p.$$('.history-card')).length;
  const tab2 = await context.newPage();
  tab2.on('pageerror', e => errors.push('tab 2: ' + e));
  tab2.on('console', m => { if (m.type() === 'error') errors.push('tab 2: ' + m.text()); });
  await tab2.goto(URL);
  await tab2.click('#todayCard .today-go'); await tab2.click('#btnStart');
  const tab2Key = await tab2.evaluate(() => state.history[0].key);
  await p.waitForFunction((n) => document.querySelectorAll('.history-card').length === n + 1, cardsBefore, { timeout: 5000 });
  assert(await p.evaluate((k) => state.history[0].key === k, tab2Key), "the first tab takes in the second tab's session, and its open list shows it");
  // the reproduced bug: one setup tap in the older tab used to write its stale copy back
  await p.click('#btnLibraryBack');
  await p.click('#todayCard .time-chips .chip:text-is("25 min")');
  const storedKeys = await st(() => JSON.parse(localStorage.getItem('fit-prefs-2')).history.map(h => h.key));
  assert(storedKeys.includes(tab2Key), "a save in the first tab keeps the second tab's session: " + storedKeys.length);
  await p.click('#todayCard .time-chips .chip:text-is("20 min")');
  await tab2.close();
  ok('two tabs: each takes in the other\'s history as it saves, so neither writes over the other');

  step = 'corrupt preferences fall back, favourites persist';
  await st(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    prefs.people = 7; prefs.minutes = 13; prefs.textScale = 'big'; prefs.blockedTags = 'nope';
    localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
  });
  await p.goto(URL);
  assert(await st(() => state.people === 1 && state.minutes === 20 && state.textScale === 1 && Array.isArray(state.blockedTags)),
         'junk preference values fell back to defaults (one person)');
  assert(await st(() => state.saved.length === 2), 'saved favourites survived the reload');
  ok('corrupt preference values fall back to defaults, favourites persist');

  step = 'phone width';
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#pathBuild'); await p.click('#btnBuild');
  const overflow = await st(() => {
    const s = document.getElementById('scroller');
    return s.scrollWidth > s.clientWidth + 1;
  });
  assert(!overflow, 'no horizontal overflow on a phone');
  // two people make the page long; Start, Skip and Reset stay on screen
  await p.click('#btnBack'); await p.click('#pathBuild');
  await p.click('#peoplePicker .chip[data-people="2"]');
  await p.click('#btnBuild');
  const controlsOnScreen = () => st(() => ['btnStart', 'btnSkip', 'btnReset']
    .every(id => document.getElementById(id).getBoundingClientRect().bottom <= innerHeight));
  assert(await controlsOnScreen(), 'with two people, Start is on the first screen');
  await p.click('#btnStart');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  assert(await controlsOnScreen(), 'and Pause, Skip and Reset stay there while working');
  await st(() => { document.getElementById('scroller').scrollTop = 400; });
  assert(await controlsOnScreen(), 'scrolled down too');
  await p.route('**/move.html*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>3D</title>' }));
  await p.click('#animB');
  assert(await p.$eval('#moveSheet', e => !e.hidden), "the second person's How to still opens under the controls");
  await p.click('#moveClose');
  await p.unroute('**/move.html*');
  await st(() => { document.getElementById('scroller').scrollTop = 0; });
  await p.click('#timerCard');
  assert(await st(() => !state.running), 'a tap on the timer pauses');
  await leaveStarted();
  ok('phone: no horizontal overflow; with two people the controls stay on screen and the timer pauses on a tap');

  step = 'once a session is finished, FIT asks the browser to keep its storage';
  await st(() => {
    window.persistAsked = 0;
    navigator.storage.persisted = () => Promise.resolve(false);
    navigator.storage.persist = () => { window.persistAsked++; return Promise.resolve(true); };
  });
  await p.click('#todayCard .today-go'); await p.click('#btnStart');
  assert(await st(() => window.persistAsked) === 0, 'starting a session does not ask');
  while (await st(() => !isFinished())) await p.click('#btnSkip');
  await p.waitForFunction(() => window.persistAsked === 1, null, { timeout: 2000 });
  await p.click('#btnAgain');
  while (await st(() => !isFinished())) await p.click('#btnSkip');
  await p.waitForTimeout(100);
  assert(await st(() => window.persistAsked) === 1, 'a finished session asks, once a visit');
  await p.click('#btnStart');                                   // Done, home
  ok('a finished session asks navigator.storage.persist() once a visit');

  step = 'the timer screen reads out its changes, and white text has the contrast';
  await p.click('#todayCard .today-go');
  assert(await p.$('main.app #workoutView'), 'the views sit in <main>');
  assert(await p.$eval('#phaseLabel', e => e.getAttribute('aria-live')) === 'polite'
         && await p.$eval('#blockName', e => e.getAttribute('aria-live')) === 'polite', 'the phase and block are live regions');
  assert(await st(() => { const n = document.getElementById('phaseLabel').firstChild; render(); return n === document.getElementById('phaseLabel').firstChild; }),
         'render() leaves an unchanged phase alone, so it is not read out five times a second');
  const sizes = await p.$$eval('.text-size .mini-btn', els => els.map(e => e.getAttribute('aria-label')));
  assert(sizes.join('|') === 'Text size normal|Text size large|Text size largest', 'the text size buttons say which is which: ' + sizes);
  const startContrast = await whiteContrast('#btnStart');
  await p.click('#btnStart');
  const pauseContrast = await whiteContrast('#btnStart');
  assert(startContrast >= 4.5 && pauseContrast >= 4.5, `white on Start ${startContrast.toFixed(2)}:1, on Pause ${pauseContrast.toFixed(2)}:1`);
  // and on to the end: on a phone the finish screen's buttons are on screen, and Done goes home
  while (await st(() => !isFinished())) await p.click('#btnSkip');
  assert(await st(() => ['btnStart', 'btnAgain', 'btnShare'].every(id => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.height > 0 && r.bottom <= innerHeight;
  })), 'Done, Start over and Share are on the first screen');
  await p.click('#btnStart');
  assert(await activeView() === 'welcomeView', 'Done goes home after a session that is not a program day');
  ok(`aria-live phase and block, labelled text sizes, Start ${startContrast.toFixed(1)}:1 and Pause ${pauseContrast.toFixed(1)}:1; Done goes home`);

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
  assert(await p.$eval('#todayCard', e => e.querySelectorAll('.time-chips .chip').length === 8 && !!e.querySelector('.today-go')),
         'welcome and its Today card render with no network');
  await p.click('#todayCard .today-go');
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
