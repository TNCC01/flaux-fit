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
import { execFileSync } from 'child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');

// ---------------------------------------------------------- static server
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png'
};
// It can be slowed down (one bar of signal, just the page, or any one
// file), drop any one file's requests until a given time, made to serve
// the next release of the app or the one before (to a browser context
// with the e2e=previous cookie, so the others' workers can never pick it
// up), or hand out a script from another release once (see the update
// steps at the end).
const serve = { delayMs: 0, pageDelayMs: 0, slow: {}, drop: {}, next: null, previous: false, breakOnce: null };
const isPage = (url) => url === '/' || url === '/index.html';
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // an empty page on the same origin, to set up a device before the app is on it
  if (url === '/e2e-blank.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>blank</title><link rel="icon" href="data:,">'); return; }
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (serve.drop[url] > Date.now()) { req.socket.destroy(); return; }
  fs.readFile(file, (err, data) => {
    setTimeout(() => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      if (serve.breakOnce === url) { serve.breakOnce = null; res.end(`throw new Error("${url} from another release")`); return; }
      if (serve.previous && /(^|;\s*)e2e=previous(;|$)/.test(req.headers.cookie || '')) { res.end(previousRelease(url, data)); return; }
      res.end(serve.next ? nextRelease(url, data) : data);
    }, serve.delayMs + (isPage(url) ? serve.pageDelayMs : 0) + (serve.slow[url] || 0));
  });
});
// The same files as a release called serve.next: sw.js with that VERSION,
// and the page and app.js each marked with it, so a page can say which
// release each came from.
function nextRelease(url, data) {
  const tag = serve.next;
  if (url === '/sw.js') return String(data).replace(/const VERSION = '[^']+'/, `const VERSION = 'fit-${tag}'`);
  if (url === '/' || url === '/index.html') return String(data).replace('<title>', `<meta name="fit-release" content="${tag}"><title>`);
  if (url === '/js/app.js') return `${data}\nwindow.FIT_RELEASE = '${tag}';\n`;
  return data;
}
// The release before this one, as far as an upgrade sees it: its service
// worker fetched every file from the network first and fell back to its
// copy after four seconds, its page had no Restore link (so this
// release's app.js fails on it) and only waited for a new worker to take
// over if its scripts failed, and its workouts.js is its own.
function previousRelease(url, data) {
  if (url === '/sw.js') return PREVIOUS_SW;
  if (url === '/js/workouts.js') return LAST_WORKOUTS.src;
  if (!isPage(url)) return data;
  return String(data).replace(/<button[^>]*id="btnGearRestore"[^>]*>[^<]*<\/button>/, '')
    .replace(/<script>\s*window\.addEventListener\('error'[\s\S]*?<\/script>/, `<script>
  window.addEventListener('error', function retry() {
    window.removeEventListener('error', retry);
    if (document.readyState !== 'complete' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    }
  });
</script>`);
}
// The last release's workouts.js, from origin/main where git has it: it
// loads without an error beside this release's app.js. With no git here,
// or on main itself, this one says it's from another release instead.
const LAST_WORKOUTS = (() => {
  const mine = fs.readFileSync(path.join(ROOT, 'js/workouts.js'), 'utf8');
  const stamp = (src) => (src.match(/^const WORKOUTS_RELEASE = '([^']*)'/m) || [])[1];
  try {
    const last = execFileSync('git', ['show', 'origin/main:js/workouts.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (stamp(last) !== stamp(mine)) return { src: last, real: true };
  } catch (e) { /* no git or no origin/main here */ }
  return { src: mine.replace(/^const WORKOUTS_RELEASE = '[^']*'/m, "const WORKOUTS_RELEASE = 'fit-previous'"), real: false };
})();
const PREVIOUS_SW = `
const VERSION = 'fit-previous';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/exercises.js', '/js/workouts.js', '/js/generator.js', '/js/app.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION)
  .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys()
  .then(ns => Promise.all(ns.filter(n => n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const path = new URL(req.url).pathname;
    const key = req.mode === 'navigate' ? (path === '/' || path === '/index.html' ? '/' : path) : req;
    const net = fetch(req);
    e.waitUntil(net.then(r => (r.ok ? cache.put(key, r.clone()) : null)).catch(() => {}));
    try {
      return await new Promise((ok, no) => { setTimeout(() => no(new Error('timeout')), 4000); net.then(ok, no); });
    } catch (err) {
      return (await cache.match(key, { ignoreSearch: true })) || net;
    }
  })());
});`;
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

const st = (fn, arg) => p.evaluate(fn, arg);
// Another tab's save reaches a page as a storage event, after a trip
// through the browser, and the page's localStorage can show the other
// tab's write before the app's storage listener has run. So what's stored
// can't say whether the app has dealt with a save yet: listenFor() arms a
// listener in the page for the next save of the prefs at that schema (null:
// none), before the other tab writes, and heard() waits until it has fired.
// The app's own listener was added first, so by then it has run (and
// written back, when it does).
const listenFor = (pg, schema) => pg.evaluate((want) => {
  window.e2eHeard = false;
  addEventListener('storage', function heard(e) {
    if (e.key !== 'fit-prefs-2' || !e.newValue) return;
    let got;
    try { got = JSON.parse(e.newValue).schema; } catch (err) { return; }
    if ((got === undefined ? null : got) !== want) return;
    removeEventListener('storage', heard);
    window.e2eHeard = true;
  });
}, schema);
const heard = (pg) => pg.waitForFunction(() => window.e2eHeard === true, null, { timeout: 10000 });
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
  assert(await pg.$eval('#btnBack', e => e.textContent) === 'Tap again', 'the first tap on Menu asks');
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
  const health = await p.$eval('#healthNote', e => e.offsetParent !== null && e.textContent);
  assert(health === 'Check with your doctor before starting if you have an injury or health condition, and stop if anything hurts.',
         'one plain line on health, on the screen: ' + health);
  assert(!(await p.$('#gearView input[type="checkbox"]')) && !(await p.$('#gearView dialog')), 'nothing to tick or dismiss for it');
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
  ok('first visit: who and what gear, weights included, a line on health, saved as Home, asked once');

  step = 'a newcomer on a phone: one person, their own bell, Start on the first screen';
  {
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const f = await fresh.newPage();
    f.on('pageerror', e => errors.push('newcomer: ' + e));
    f.on('console', m => { if (m.type() === 'error') errors.push('newcomer: ' + m.text()); });
    await f.goto(URL);
    assert((await f.$eval('#gearView', e => e.textContent)).includes('tap Change on the home screen'), 'it says where to change it later');
    // the home-screen app always opens here, empty: Restore is on the first screen of the smallest iPhone
    await f.setViewportSize({ width: 375, height: 667 });
    const restore = await f.$eval('#btnGearRestore', e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && e.textContent; });
    assert(restore === 'Used FIT before? Restore your data', 'Restore is on the first screen at 375 x 667: ' + restore);
    assert(await f.$eval('#healthNote', e => e.nextElementSibling.id === 'btnGearDone'), 'and the line on health sits just above the button');
    await f.setViewportSize({ width: 390, height: 844 });
    await f.click('#onboardGear .chip:has-text("Kettlebells")');
    assert((await f.$eval('#onboardWeights', e => e.textContent)).includes('Tick at least one'), 'ticking kettlebells asks which bells');
    // Done with no bell picked would mean no kettlebell work at all, so it asks
    await f.click('#btnGearDone');
    assert(await f.evaluate(() => document.querySelector('.view.active').id === 'gearView' && !state.gearAsked)
           && (await f.$eval('#gearNote', e => e.textContent)) === "Tick the bells you've got, or untick Kettlebells.",
           'Done with kettlebells ticked and no bell stays on the question and asks for the bells');
    assert(await f.$eval('#scrollHint', e => getComputedStyle(e).display === 'none'), 'no bottom fade over the sticky Done');
    await f.click('#onboardWeights .chip:text-is("12kg")');
    assert((await f.$eval('#gearNote', e => e.textContent)) === '', 'picking a bell clears the ask');
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

  step = 'a returning phone user with a program day, two places and leave-outs still has Start on the first screen';
  {
    const back = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Surf Fit days 1 to 3 done on earlier days, so Engine (day 4) is waiting
    await back.addInitScript(() => {
      if (localStorage.getItem('fit-prefs-2')) return;
      const day = 86400000, now = Date.now(), gear = { kettlebells: true }, weights = { kb: [12, 16], db: [], bar: 10 };
      localStorage.setItem('fit-prefs-2', JSON.stringify({
        gearAsked: true, people: 2, minutes: 20, blockedTags: ['impact', 'floor'], excluded: ['burpee', 'pushup'],
        equipment: gear, weights, gearSets: [{ id: 'home', name: 'Home', equipment: gear, weights }, { id: 'dave', name: "Dave's garage", equipment: gear, weights }],
        programs: { 'surf-fit': { startedAt: now - 9 * day, done: [0, 1, 2].map(n => ({ n, at: now - (5 - n) * day })) } },
        history: [{ key: 'id:power-hour', name: 'Power Hour', at: now - day, people: 2, intervalId: 'short', generated: false, workoutId: 'power-hour', minutes: 30, completed: true }]
      }));
    });
    const r = await back.newPage();
    r.on('pageerror', e => errors.push('returning: ' + e));
    r.on('console', m => { if (m.type() === 'error') errors.push('returning: ' + m.text()); });
    await r.goto(URL);
    await r.click('#todayCard .time-chips .chip:text-is("10 min")');
    const fold = () => r.evaluate(() => {
      const card = document.getElementById('todayCard'), go = card.querySelector('.program-go');
      const kids = [...card.children];
      return { go: go.getBoundingClientRect().bottom, height: innerHeight, sub: document.getElementById('welcomeSub').offsetParent !== null,
               text: card.textContent, notesAfter: [...card.querySelectorAll('.program-hint')].every(h => kids.indexOf(h) > kids.indexOf(go)),
               links: [...card.querySelectorAll('.link-btn')].map(b => Math.round(b.getBoundingClientRect().height)) };
    });
    const day = await fold();
    assert(day.text.includes('Engine') && day.text.includes('Training at') && day.text.includes('too short') && day.text.includes('Left out'),
           "the card is the Engine day at 10 min, with two places and the leave-outs: " + day.text.slice(0, 80));
    assert(!day.sub, 'a returning user is not told what FIT is again');
    assert(day.notesAfter, 'the short-day and left-out notes come under Start');
    assert(day.go <= day.height, `Start is on the first screen (bottom ${Math.round(day.go)} of ${day.height})`);
    assert(day.links.every(h => h >= 44), 'the links on the card are 44px tall to tap: ' + day.links);
    // "Something else today" lasts the day, a reload included
    await r.click('#todayCard .link-btn:has-text("Something else today")');
    const other = await fold();
    assert(other.go <= other.height && other.text.includes('Build a workout'), `the built workout's Start is on the first screen too (bottom ${Math.round(other.go)})`);
    assert(await r.$eval('#pathBuild', e => e.getBoundingClientRect().height >= 44), 'Change is 44px tall to tap');
    await r.reload();
    assert((await r.$eval('#todayCard', e => e.textContent)).includes('Build a workout'), 'a reload the same day keeps the built workout');
    await r.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      prefs.todayOther = dayKey(Date.now() - 86400000);
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
    });
    await r.reload();
    assert((await r.$eval('#todayCard', e => e.textContent)).includes('Engine'), "yesterday's choice doesn't carry over: the session is back");
    // on the Programs screen the gear line has its own way to setup
    await r.click('#pathProgram');
    const hint = '.program-today .program-hint:has-text("To add a place")';
    assert(await r.$(`${hint} .link-btn:text-is("Change")`), 'the Programs screen says where places are set, with a Change link');
    await r.click(`${hint} .link-btn`);
    assert(await r.evaluate(() => document.querySelector('.view.active').id) === 'setupView', 'and Change opens the setup');
    await r.click('#btnSetupBack');
    assert(await r.evaluate(() => document.querySelector('.view.active').id) === 'programView', "and setup's Back goes back to Programs");
    assert(await r.$eval('.program-today .card-tagline', e => e.textContent) === 'Today · Week 1', 'the day says Week, capitalised as on home');
    // A small phone (375 x 667): Start ends above the bottom edge whatever
    // the card shows, and the bottom fade never sits over it.
    await r.setViewportSize({ width: 375, height: 667 });
    await r.click('#btnProgramBack');
    const startClear = async (label) => {
      await r.evaluate(() => { document.getElementById('scroller').scrollTop = 0; return new Promise(requestAnimationFrame); });
      const m = await r.evaluate(() => ({
        bottom: Math.round(document.querySelector('#todayCard .program-go, #todayCard .today-go').getBoundingClientRect().bottom),
        height: innerHeight, fade: document.body.classList.contains('can-scroll') }));
      assert(m.bottom <= m.height && !m.fade, `${label}: Start on the first screen with no fade over it ${JSON.stringify(m)}`);
    };
    await r.click('#todayCard .time-chips .chip:text-is("25 min")');
    await startClear('the Engine day at 25 min');
    await r.click('#todayCard .link-btn:has-text("Something else today")');
    await startClear('something else today');
    await r.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      prefs.programs['surf-fit'].done.push({ n: 3, at: Date.now() });
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
    });
    await r.reload();
    assert((await r.$eval('#todayCard .card-tagline', e => e.textContent)).startsWith("Surf Fit: today's done"), "today's done takes the place of the Today line");
    await startClear("today's session done");
    await r.evaluate(() => { document.getElementById('scroller').scrollTop = 150; });
    await r.evaluate(() => new Promise(requestAnimationFrame));
    assert(await r.evaluate(() => document.body.classList.contains('can-scroll')), 'scrolled clear of Start, the fade is back');
    await back.close();
  }
  ok("returning on a phone: Engine at 10 min with two places and leave-outs keeps Start on the first screen, links are 44px, Something else today lasts the day, the Programs gear line opens setup and Back returns there; on a 375 x 667 phone Start fits with no fade over it, today's session to do, set aside or done");

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
  // every length runs to the minute picked, 15 and 40 included
  for (const m of [15, 40]) {
    await p.click(`#todayCard .time-chips .chip:text-is("${m} min")`);
    await p.click('#todayCard .today-go');
    const got = await st(() => [state.workout.name, document.getElementById('totalTime').textContent]);
    assert(got[0].endsWith(`· ${m} min`) && got[1].endsWith(`/ ${m}:00`), `${m} min on the Today card is ${m} min on the clock: ${got}`);
    await p.click('#btnBack');
  }
  await p.click('#todayCard .time-chips .chip:text-is("20 min")');
  ok('welcome: the Today card, Programs and Saved & ready-made; no footer, no iOS install hint on desktop; 15 and 40 min run 15:00 and 40:00');

  step = 'the warm-up is real moves with figures, and the cool-down stretches for what was worked';
  {
    await p.click('#todayCard .today-go');
    const bk = await st(() => {
      const w = state.workout, seq = state.sequence;
      const warm = seq.filter(x => x.kind === 'warmup'), cool = seq.filter(x => x.kind === 'cooldown');
      const firstWork = seq.findIndex(x => x.kind === 'work');
      return {
        warmSec: w.warmupSec, coolSec: w.cooldownSec, warm: warm.map(x => ({ name: x.name, d: x.duration, a: x.a.id, b: x.b && x.b.id, img: x.a.img })),
        cool: cool.map(x => ({ name: x.name, d: x.duration, img: x.a.img })), firstWork, lastIsCool: seq[seq.length - 1].kind === 'cooldown',
        total: state.totalDuration, minutes: state.minutes,
        impact: warm.filter(x => EXERCISES[x.a.id].tags.some(t => t === 'impact' || t === 'running')).map(x => x.a.id),
        lead: EXERCISES[w.blocks[0].ids[0]].pattern
      };
    });
    const sum = (xs) => xs.reduce((t, x) => t + x.d, 0);
    assert(bk.warm.length >= 2 && bk.firstWork === bk.warm.length, `the session opens on ${bk.warm.length} warm-up moves, then block 1`);
    assert(bk.warm.every((x, i) => new RegExp(`^Warm-up ${i + 1} of ${bk.warm.length}: \\S`).test(x.name) && x.img), 'each named "Warm-up 2 of 5: …", with a figure: ' + bk.warm.map(x => x.name).join(' | '));
    assert(bk.warm.every(x => x.a && x.a === x.b), 'both people on the same warm-up move at the same time');
    assert(sum(bk.warm) === bk.warmSec && sum(bk.cool) === bk.coolSec && bk.total === bk.minutes * 60, `the moves fill the warm-up (${sum(bk.warm)}/${bk.warmSec}s) and cool-down (${sum(bk.cool)}/${bk.coolSec}s), and it still runs ${bk.minutes}:00`);
    assert(bk.warm.every(x => x.d >= 25 && x.d <= 60), 'about 30 to 45 seconds a move: ' + bk.warm.map(x => x.d).join(','));
    assert(!bk.impact.length, 'nothing in the warm-up jumps or runs: ' + bk.impact.join(','));
    assert(await st((last) => WARMUP_REHEARSAL[EXERCISES[state.workout.blocks[0].ids[0]].pattern].includes(last), bk.warm[bk.warm.length - 1].a),
           `it ends on a light go at block 1's ${bk.lead}: ${bk.warm.map(x => x.a).join(',')}`);
    assert(bk.lastIsCool && bk.cool.length >= 2 && bk.cool.every((x, i) => new RegExp(`^Cool-down ${i + 1} of ${bk.cool.length}: \\S`).test(x.name)), 'and ends on named stretches: ' + bk.cool.map(x => x.name).join(' | '));
    // on screen: the move, its figure for each person, the count, and the next move by name
    assert(await p.$eval('#blockName', e => e.textContent) === bk.warm[0].name && await p.$eval('#phaseLabel', e => e.textContent) === 'Warm-up', 'the timer shows the first move like any phase');
    assert(await p.$eval('#roundDots', e => /Move 1 of \d/.test(e.textContent)), 'with a count of the moves');
    await figureDrawn('#animA'); await figureDrawn('#animB');
    assert(await st(() => document.getElementById('animA').dataset.move === state.sequence[0].a.id && document.getElementById('animB').dataset.move === state.sequence[0].a.id), 'both cards play its figure');
    const up = await p.$eval('#upcoming strong', e => e.textContent);
    assert(up === bk.warm[1].name.replace(/^Warm-up \d+ of \d+: /, ''), 'Up next names the next warm-up move: ' + up);
    assert(await p.$eval('#btnSkip', e => e.textContent.replace(/\u2011/g, '-')) === 'Skip warm-up', 'Skip says it skips the warm-up');
    const prev = await previewText();
    assert(bk.warm.every(x => prev.includes(x.name.replace(/^Warm-up \d+ of \d+: /, ''))), 'the preview lists the warm-up moves: ' + prev);
    assert(bk.cool.every(x => prev.includes(x.name.replace(/^Cool-down \d+ of \d+: /, '').replace(/, (left|right)$/, ''))) && !/, right/.test(prev),
           'and the stretches, a stretch\'s two sides as one');
    await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'cooldown') - 1); render(); });
    assert(await p.$eval('#upcoming strong', e => e.textContent) === bk.cool[0].name.replace(/^Cool-down \d+ of \d+: /, 'Cool-down: '), 'from the last block, Up next says the cool-down is next');
    await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'cooldown')); render(); });
    assert(await p.$eval('#btnSkip', e => e.textContent.replace(/\u2011/g, '-')) === 'Skip cool-down' && await p.$eval('#roundDots', e => /Stretch 1 of \d/.test(e.textContent)), 'a stretch says Skip cool-down, with a count');
    // the bell once the blocks are done, then the soft chime for each stretch, and between warm-up moves
    const chimes = await st(() => {
      // each sound by its first note: the soft chime 660 Hz for 0.4s, the bell 660 for 0.25, work 880
      const heard = [], keep = beep, sound = { '660/0.4': 'soft', '660/0.25': 'bell', '880/0.12': 'work' };
      const seq = state.sequence, c = seq.findIndex(x => x.kind === 'cooldown');
      [seq[1], seq[c], seq[c + 1], seq.find(x => x.kind === 'work')].forEach(p => {
        beep = (f, d) => { heard.push(sound[`${f}/${d}`] || `${f}/${d}`); beep = () => {}; };
        chimeFor(p);
      });
      beep = keep;
      return heard.join(',');
    });
    assert(chimes === 'soft,bell,soft,work', 'the bell rings once for the cool-down, the soft chime marks each move: ' + chimes);
    // the same session works around No floor work, today's or the one it was built with
    const noFloor = await st(() => {
      const keep = state.blockedTags;
      state.blockedTags = ['floor'];
      const seq = buildSequence(state.workout, 2);
      state.blockedTags = keep;
      return { floor: seq.filter(x => x.kind === 'warmup' && EXERCISES[x.a.id].tags.includes('floor')).map(x => x.a.id),
               lying: seq.filter(x => x.kind === 'cooldown' && !STRETCHES.some(s => s.pos === 'stand' && x.a.name === s.name)).map(x => x.a.name),
               len: seq.length, same: seq.length === state.sequence.length && seq.every((x, i) => x.duration === state.sequence[i].duration) };
    });
    assert(!noFloor.floor.length && !noFloor.lying.length, `with No floor work, a standing warm-up and standing stretches (${noFloor.floor.join(',')} ${noFloor.lying.join(',')})`);
    assert(noFloor.same, 'and the same timeline, so a session picked up after a reload still lines up');
    await p.click('#btnBack');
    assert(await activeView() === 'welcomeView', 'not started, so one tap goes home');
  }
  ok('the warm-up: named moves with figures for both people, filling its time exactly, Up next and Skip say so; stretches to finish; No floor work kept to standing');

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
  // what the finish screen counts as skipped: not a block skipped from its
  // last rest or the last seconds of its last round, but one with a round to come
  const skips = await st(() => {
    const last = (kind, b) => state.sequence.reduce((k, x, i) => (x.kind === kind && x.blockIdx === b ? i : k), -1);
    const out = {};
    placeAt(startOf(last('rest', 0) + 1) - 3); skipBlock(); out.lastRest = JSON.stringify(state.skipped);
    placeAt(startOf(last('work', 1) + 1) - 3); skipBlock(); out.lastSeconds = JSON.stringify(state.skipped);
    placeAt(startOf(state.sequence.findIndex(x => x.kind === 'work' && x.blockIdx === 0)) + 5); skipBlock(); out.early = JSON.stringify(state.skipped);
    return out;
  });
  assert(skips.lastRest === '[]' && skips.lastSeconds === '[]' && skips.early === '[0]',
         'a skip from a block\'s last rest or its last few seconds is not a block skipped; one with rounds to come is: ' + JSON.stringify(skips));
  ok('first workout built, saved, started and paused, from the button and from a tap on the timer; a block skipped only counts with rounds to come');

  step = 'Menu mid-workout takes two taps';
  await p.click('#btnBack');
  assert(await activeView() === 'workoutView' && await st(() => !!state.workout), 'one tap on Menu keeps the session');
  assert((await p.$eval('#btnBack', e => e.textContent)) === 'Tap again', 'and asks for a second tap');
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

  step = 'a favourite keeps its exercises when the library changes under it';
  {
    // An update that reorders the library changes what a seed builds, as
    // most releases have; a favourite and a session in history must not.
    const reorder = (keys) => st((k) => {
      const all = { ...EXERCISES };
      Object.keys(EXERCISES).forEach(id => { delete EXERCISES[id]; });
      k.forEach(id => { EXERCISES[id] = all[id]; });
    }, keys);
    const order = await st(() => Object.keys(EXERCISES));
    assert(await st(() => state.saved.every(s => s.frozen && s.frozen.blocks.length > 0)), 'each favourite keeps the exercises it was built with');
    assert(await st(() => state.history.filter(h => h.generated).every(h => h.frozen && h.frozen.blocks.length > 0)), 'and so does each built session in history');
    await reorder(order.slice().reverse());
    const drifted = await st((seed) => {
      const fav = state.saved.find(s => s.seed === seed);
      return buildWorkout(fav.request, fav.seed, { recent: fav.request.recent }).exerciseIds.join(',');
    }, seedA);
    assert(drifted !== idsA, 'with the library reordered, the seed on its own builds something else');
    await p.click('#btnBack'); await p.click('#pathLibrary');
    await (await p.$$('.workout-card:has-text("☆")'))[1].click();
    assert(await st(() => state.workout.exerciseIds.join(',')) === idsA && await previewText() === previewA,
           'favourite A still opens with the moves it was saved with');
    assert(await st(() => state.workout.seed) === seedA && await p.$eval('#btnSave', e => e.disabled), 'same seed, still saved');
    await p.click('#btnShuffle');
    assert(await st(() => state.workout.seed) !== seedA && await st(() => state.lastRequest.intervalId) === 'long', 'Shuffle still builds from its request');
    // a session in history, opened again
    await p.click('#btnBack'); await p.click('#pathLibrary');
    const atA = await st((seed) => state.history.findIndex(h => h.seed === seed), seedA);
    assert(atA >= 0, 'favourite A was started, so it is in history');
    await (await p.$$('.history-card'))[atA].click();
    assert(await st(() => state.workout.exerciseIds.join(',')) === idsA, 'its session in history opens with the same moves too');
    // one saved before favourites kept their moves is built from its seed, and keeps that from then on
    await p.click('#btnBack');
    await st((seed) => {
      const fav = state.saved.find(s => s.seed === seed);
      state.saved.push({ name: 'Kept the old way', blurb: '', focus: fav.focus, seed: 777001, request: fav.request, savedOn: '1/1/2026' });
      savePrefs();
    }, seedA);
    await p.click('#pathLibrary');
    await p.click('.workout-card:has(.card-name:text-is("☆ Kept the old way"))');
    const oldWay = await st(() => state.workout.exerciseIds.join(','));
    assert(await st(() => state.workout.seed === 777001 && JSON.stringify(state.saved.find(s => s.seed === 777001).frozen.blocks.map(b => b.ids))
             === JSON.stringify(state.workout.blocks.map(b => b.ids))), 'an old favourite opens from its seed and then keeps those moves');
    await reorder(order);
    await p.click('#btnBack'); await p.click('#pathLibrary');
    await p.click('.workout-card:has(.card-name:text-is("☆ Kept the old way"))');
    assert(await st(() => state.workout.exerciseIds.join(',')) === oldWay, 'and opens the same after the library changes back');
    // a favourite naming a move that has gone is built from its seed, and says so
    await p.click('#btnBack');
    await st(() => { const fav = state.saved.find(s => s.seed === 777001); fav.frozen.blocks[0].ids[0] = 'noSuchMove'; savePrefs(); });
    await p.click('#pathLibrary');
    await p.click('.workout-card:has(.card-name:text-is("☆ Kept the old way"))');
    assert((await p.$eval('#workoutNote', e => e.textContent)).includes('built again'), 'a favourite with a move that has gone says it was built again');
    assert(await st(() => state.saved.find(s => s.seed === 777001).frozen.blocks.every(b => b.ids.every(id => EXERCISES[id]))), 'and keeps the new build');
    await p.click('#btnBack');
    await st(() => { state.saved = state.saved.filter(s => s.seed !== 777001); savePrefs(); });
    // and on as before, from favourite B
    await p.click('#pathLibrary');
    await (await p.$$('.workout-card:has-text("☆")'))[0].click();
    assert(await st(() => state.workout.exerciseIds.join(',')) === idsB, 'favourite B as it was');
  }
  ok('favourites and history keep the moves they were built with through a library change; old favourites rebuild from their seed once, then keep it; a move gone falls back and says so');

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
  // a favourite from before they kept their moves, opened first at the
  // mate's place, adapts there and still opens at Home as it was built
  await p.click('.gear-set:has-text("Home")');
  const homeIds = await st((seed) => {
    const fav = state.saved.find(s => s.seed === seed);
    state.saved.push({ name: 'Saved at Home', blurb: '', focus: fav.focus, seed: 777002, request: fav.request, savedOn: '1/1/2026' });
    savePrefs();
    return buildWorkout(fav.request, 777002, { recent: fav.request.recent || [] }).exerciseIds.join(',');
  }, seedA);
  const oldFav = '.workout-card:has(.card-name:text-is("☆ Saved at Home"))';
  await p.click(`.gear-set:has-text("Mate's place")`);
  await p.click('#btnSetupBack'); await p.click('#pathLibrary'); await p.click(oldFav);
  const atMates = await st(() => ({ kb: state.workout.exerciseIds.some(id => /^kb/.test(id)), frozen: !!state.saved.find(s => s.seed === 777002).frozen }));
  assert(!atMates.kb && !atMates.frozen, "at the mate's place it adapts to the gear there, and isn't kept that way: " + JSON.stringify(atMates));
  await p.click('#btnBack'); await p.click('#pathBuild'); await p.click('.gear-set:has-text("Home")');
  await p.click('#btnSetupBack'); await p.click('#pathLibrary'); await p.click(oldFav);
  const atHome = await st(() => ({ ids: state.workout.exerciseIds.join(','), frozen: !!state.saved.find(s => s.seed === 777002).frozen }));
  assert(atHome.ids === homeIds && atHome.frozen, 'back at Home it opens as it was built there, and keeps that: ' + JSON.stringify(atHome));
  await st(() => { state.saved = state.saved.filter(s => s.seed !== 777002); savePrefs(); });
  await p.click('#btnBack'); await p.click('#pathBuild'); await p.click(`.gear-set:has-text("Mate's place")`);
  await p.click('.gear-sets .card-remove');
  assert(await st(() => state.gearSets.length === 1 && effectiveEquip().kb15), 'removing it falls back to Home');
  ok("gear sets: a mate's place without kettlebells, Home with them, one tap apart; an old favourite opened at the mate's place still opens at Home as built");

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
  assert(await p.$eval('#btnSkip', e => e.textContent.replace(/\u2011/g, '-')) === 'Skip warm-up' && await st(() => state.sequence.filter(x => x.kind === 'warmup').length > 1),
         'a classic gets the guided warm-up too, skipped in one tap');
  await p.click('#btnStart'); await p.click('#btnSkip');       // into block 1
  assert(await p.$eval('#blockName', e => /Block 1 of/.test(e.textContent)), 'skip jumped to block 1');
  // the gap is timed in the page, since the trips to it can add a second on a slow machine
  const before = await st(() => { clearInterval(state.tickHandle); return [elapsedNow(), Date.now()]; });   // what iOS does to a backgrounded tab
  await p.waitForTimeout(3000);
  const stale = await p.$eval('#totalTime', e => e.textContent);
  const [gained, wall] = await st((b) => { document.dispatchEvent(new Event('visibilitychange')); return [state.elapsedTotal - b[0], (Date.now() - b[1]) / 1000]; }, before);
  assert(gained >= 2.8 && gained <= wall + 0.01, `caught up ${gained.toFixed(1)}s of a ${wall.toFixed(1)}s gap`);
  const fresh = await p.$eval('#totalTime', e => e.textContent);
  note(`suspended at "${stale}", on return "${fresh}" (+${gained.toFixed(1)}s)`);
  await p.click('#btnStart');                                   // pause
  ok('classic opens with 4 rounds, skip works, timer recovers a 3s suspension');

  step = 'a reload mid-session offers Resume: the same workout, in the same block, paused, scores kept';
  {
    const run = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await run.addInitScript(() => {
      if (location.protocol === 'about:' || localStorage.getItem('fit-prefs-2')) return;     // about:blank has no storage
      localStorage.setItem('fit-prefs-2', JSON.stringify({ gearAsked: true, people: 2, nameA: 'Wayne', nameB: 'Dave', minutes: 20,
        intervalStyle: 'amrap', equipment: { kettlebells: true }, weights: { kb: [12, 16], db: [], bar: 10 } }));
    });
    const r = await run.newPage();
    r.on('pageerror', e => errors.push('resume: ' + e));
    r.on('console', m => { if (m.type() === 'error') errors.push('resume: ' + m.text()); });
    const ev = (fn, arg) => r.evaluate(fn, arg);
    const kept = () => ev(() => JSON.parse(localStorage.getItem('fit-run-1')));
    const offered = () => r.$('#todayCard .today-resume');
    const view = () => ev(() => document.querySelector('.view.active').id);
    await r.goto(URL);
    assert(!(await offered()), 'nothing to pick up to begin with');
    await r.click('#todayCard .today-go');
    assert(!(await kept()), 'opening a workout saves nothing until it starts');
    await r.click('#btnStart');
    assert(await kept(), 'Start saves it straight away');
    assert(!(await ev(() => 'fit-run-1' in JSON.parse(localStorage.getItem('fit-prefs-2')))), 'under its own key, not with the prefs');
    await ev(() => { localStorage.removeItem('fit-run-1'); tickClock(); });
    assert(!(await kept()), 'a tick within five seconds of the last save writes nothing');
    await ev(() => { runSavedAt -= 5000; tickClock(); });
    assert(await kept(), 'a tick five seconds on saves it again');
    // into block 2's AMRAP, scores for both and a lap pick, then 70 seconds on
    const at = await ev(() => {
      const i = state.sequence.findIndex(x => x.amrap && x.blockIdx === 1);
      seekTo(i); render();
      return { i, start: state.elapsedTotal };
    });
    await r.click('#counterA .count-more'); await r.click('#counterA .count-more'); await r.click('#counterB .count-more');
    if (await r.$('#circuitA li[data-i="1"]')) await r.click('#circuitA li[data-i="1"]');
    await ev((s) => { state.elapsedAtResume = s + 70; state.runStartWall = Date.now(); tickClock(); }, at.start);
    const was = await ev(() => ({ ids: state.workout.exerciseIds.join(','), seed: state.workout.seed, name: state.workout.name,
      scores: JSON.stringify(state.scores), pick: JSON.stringify(state.pick), elapsed: elapsedNow() }));
    assert(was.scores.includes('"a":2') && was.scores.includes('"b":1'), 'scored 2 and 1: ' + was.scores);
    // the phone throws the tab away while it's out of view: it saved on the way out
    await ev(() => { localStorage.removeItem('fit-run-1'); window.dispatchEvent(new Event('pagehide')); });
    const snap = await kept();
    assert(snap && snap.idx === at.i && Math.abs(snap.elapsed - was.elapsed) < 1, 'leaving the page saves where it was: ' + JSON.stringify(snap && [snap.idx, snap.elapsed]));
    await r.reload();
    assert(await view() === 'welcomeView', 'a reload lands on home');
    // picked up four hours on: Start still goes on with its history entry
    await ev((seed) => {
      const s = JSON.parse(localStorage.getItem('fit-run-1'));
      s.savedAt -= 4 * 3600e3;
      localStorage.setItem('fit-run-1', JSON.stringify(s));
      state.history.find(h => h.key === `gen:${seed}`).at -= 4 * 3600e3;
      savePrefs(); renderToday();
    }, was.seed);
    const line = await r.$eval('#todayCard .today-resume .resume-text', e => e.textContent);
    const startAt = `${Math.floor(at.start / 60)}:${String(Math.floor(at.start % 60)).padStart(2, '0')}`;
    assert(snap.elapsed - at.start >= 69 && line === `Resume ${was.name} from ${startAt}, block 2`,
           'the Today card offers it by name, and the time and block Resume picks up at (the start of the block, not 70s on): ' + line);
    assert(await r.$eval('#todayCard', e => e.firstElementChild.classList.contains('today-resume')), 'at the top of the card');
    assert(await r.$('#btnResumeRun:text-is("Resume")') && await r.$('#btnDiscardRun:text-is("Discard")'), 'with Resume and Discard');
    await r.click('#btnResumeRun');
    const back = await ev(() => ({ view: document.querySelector('.view.active').id, running: state.running, idx: state.currentIdx,
      elapsed: state.elapsedTotal, ids: state.workout.exerciseIds.join(','), seed: state.workout.seed,
      scores: JSON.stringify(state.scores), pick: JSON.stringify(state.pick), button: document.getElementById('btnStart').textContent,
      a: document.querySelector('#counterA .count-now b').textContent, b: document.querySelector('#counterB .count-now b').textContent,
      badge: document.getElementById('peopleBadge').textContent, note: document.getElementById('goingNote').textContent,
      total: document.getElementById('totalTime').textContent }));
    assert(back.view === 'workoutView' && !back.running && back.button === 'Resume', 'Resume opens the workout, paused: ' + JSON.stringify(back));
    assert(back.idx === at.i && back.elapsed === at.start, `at the start of the block it was in (${back.elapsed}s, block began ${at.start}s)`);
    assert(back.ids === was.ids && back.seed === was.seed, 'the same exercises');
    assert(back.scores === was.scores && back.pick === was.pick && back.a === '2' && back.b === '1', 'with the scores and the lap pick: ' + back.scores);
    assert(back.badge === 'Wayne & Dave' && back.note === `Picked up at ${startAt}, the start of block 2. Tap Resume when you're ready.`,
           'for the same two people, saying where it picked up: ' + back.note);
    assert(back.total.startsWith(`Total ${startAt} /`), 'the timer opens at the time the card said: ' + back.total);
    const noteBox = await r.$eval('#goingNote', e => { const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), innerHeight]; });
    assert(noteBox[0] >= 0 && noteBox[1] <= noteBox[2] && noteBox[1] > noteBox[0], 'and the note is on the first screen of a 390 x 844 phone: ' + noteBox);
    // where a phase starts, as the note says it: the round, move or stretch, or the block at its first
    const places = await ev(() => [{ kind: 'work', blockIdx: 1, round: 5 }, { kind: 'work', blockIdx: 1, round: 1 }, { kind: 'work', amrap: true, blockIdx: 2 },
      { kind: 'rest', blockIdx: 0, round: 8 }, { kind: 'warmup', warmIdx: 0 }, { kind: 'warmup', warmIdx: 2 }, { kind: 'cooldown', coolIdx: 2 },
      { kind: 'stretch', stretchIdx: 2 }, { kind: 'blockrest', blockIdx: 0 }, { kind: 'work', emom: true, blockIdx: 1, round: 2 }].map(phaseStart).join('|'));
    assert(places === 'round 5 of block 2|block 2|block 3|the rest after round 8 of block 1|the warm-up|warm-up move 3|cool-down stretch 3|stretch 3|the rest before block 2|minute 2 of block 2',
           'the note names the round, move or stretch it went back to: ' + places);
    await r.click('#btnStart');
    const going = await ev((seed) => ({ note: document.getElementById('goingNote').hidden ? '' : 'shown', running: state.running,
      rows: state.history.filter(h => h.key === `gen:${seed}`).length, fresh: Date.now() - state.history.find(h => h.key === `gen:${seed}`).at < 60000 }), was.seed);
    assert(going.running && going.note === '', 'once it is going again, the note asking for Resume goes: ' + JSON.stringify(going));
    assert(going.rows === 1 && going.fresh, 'and it carries on as the same session in history, four hours on: ' + JSON.stringify(going));
    await r.click('#btnStart');                                 // pause
    await r.click('#btnBack');
    assert(await view() === 'workoutView', 'a picked-up session takes two taps on Menu too');
    await ev(() => disarmBack());
    // Discard lets it go, for good
    await r.reload();
    await r.click('#btnDiscardRun');
    assert(!(await kept()) && !(await offered()), 'Discard lets it go');
    await r.reload();
    assert(!(await offered()), 'and it stays gone');
    ok(`reload mid-session: "${line}" on the Today card; Resume is the same workout at the start of block 2, paused, with 2 and 1 rounds and the lap pick; Discard lets it go`);

    step = 'what clears a saved session, and what does not offer one';
    // a session to pick up, then a shared link: it opens the link's workout and leaves the session be
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    const ownSeed = await ev(() => state.workout.seed);
    const link = await ev(() => shareUrlFor(buildWorkout(requestFromState(), 4242)));
    await r.goto('about:blank');
    await r.goto(link);
    const shared = await ev(() => ({ view: document.querySelector('.view.active').id, seed: state.workout.seed, started: state.started, elapsed: state.elapsedTotal }));
    assert(shared.view === 'workoutView' && shared.seed === 4242 && !shared.started && shared.elapsed === 0,
           "a shared link opens the link's workout, from the top, not the session left part-way: " + JSON.stringify(shared));
    assert((await kept()).seed === ownSeed, 'and leaves that session to pick up later');
    await r.click('#btnBack');
    assert(await offered(), 'back home, it is there to pick up');
    // finishing clears it
    await r.click('#btnResumeRun'); await r.click('#btnStart');
    await ev(() => { while (!isFinished()) skipBlock(); });
    assert(!(await kept()), 'finishing clears it');
    await r.click('#btnStart');                                 // Done
    assert(await view() === 'welcomeView' && !(await offered()), 'and home has nothing to pick up');
    // two taps on Menu clear it
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    assert(await kept(), 'a new session is saved');
    await leaveStarted(r);
    assert(!(await kept()) && !(await offered()), 'leaving it with two taps on Menu clears it');
    // so do Reset and Start over (which then saves the new go as it runs)
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    await r.click('#btnReset'); await r.click('#btnReset');
    assert(!(await kept()), 'Reset clears it');
    await r.click('#btnStart');
    await ev(() => { state.elapsedAtResume = 200; state.runStartWall = Date.now(); tickClock(); pauseTimer(); });
    assert((await kept()).elapsed >= 200, 'a pause saves it');
    await ev(() => { while (!isFinished()) skipBlock(); });
    assert(!(await kept()), 'finished again, and cleared');
    await r.click('#btnAgain');
    const again = await kept();
    assert(again && again.elapsed < 2 && again.idx === 0, 'Start over saves the new go from the top: ' + JSON.stringify(again && [again.idx, again.elapsed]));
    // one that no longer builds the same (an update changed the library), one over
    // twelve hours old, and junk are never offered, and are thrown away
    for (const [what, spoil] of [['a changed workout', (s) => { s.sig = 'not-this'; }], ['twelve hours on', (s) => { s.savedAt -= 12.1 * 3600e3; }],
                                  ['a bad block number', (s) => { s.idx = 999; }], ['junk', () => 'junk']]) {
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await r.reload();
      assert(await offered(), `${what}: offered before it is spoilt`);
      await ev((src) => {
        const s = JSON.parse(localStorage.getItem('fit-run-1'));
        const out = new Function('s', `return (${src})(s)`)(s);
        localStorage.setItem('fit-run-1', out === 'junk' ? '{nope' : JSON.stringify(s));
      }, spoil.toString());
      await r.reload();
      assert(!(await offered()) && !(await kept()), `${what}: not offered, and thrown away`);
      await r.click('#todayCard .today-go'); await r.click('#btnStart');
    }
    ok('a shared link opens its own workout and leaves the session to pick up; finishing, two taps on Menu, Reset and Start over clear it; a changed workout, one twelve hours old and junk are thrown away');

    step = 'a program day picks up as that day, and finishing it ticks the day off';
    await leaveStarted(r);
    await ev(() => { state.programs['surf-fit'] = { startedAt: Date.now(), done: [] }; savePrefs(); renderToday(); });
    // left on purpose, it goes back to the program and is not offered again,
    // even after the page goes (the phone locks, or the app is swiped away)
    await r.click('#todayCard .program-go'); await r.click('#btnStart');
    await ev(() => { state.elapsedAtResume = 3; state.runStartWall = Date.now(); tickClock(); });
    await leaveStarted(r);
    assert(await view() === 'programView' && !(await kept()), 'two taps on Menu go back to the program, and clear it');
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await r.reload();
    assert(!(await kept()) && !(await offered()), 'and it stays cleared when the page goes: ' + JSON.stringify(await kept()));
    await r.click('#todayCard .program-go'); await r.click('#btnStart');
    await r.reload();
    const dayLine = await r.$eval('#todayCard .today-resume .resume-text', e => e.textContent);
    assert(dayLine === 'Resume Paddle power from 0:00, the warm-up', 'offered by the day\'s name: ' + dayLine);
    assert(await r.$('#todayCard .today-resume + .card-tagline:has-text("Week 1, Day 1")'), "above today's session on the card");
    // the day's own Start would build it afresh: with Resume there, it's a small link
    assert(!(await r.$('#todayCard .program-go')) && await r.$('#todayCard .link-btn.today-fresh:text-is("Start a fresh one instead")')
           && await r.$('#todayCard button:text-is("I surfed today")'), "Resume is the one big button for the day, and a fresh start is a link");
    await r.click('#btnResumeRun');
    assert(await ev(() => state.programRun && state.programRun.n === 0 && document.getElementById('workoutTitle').textContent === 'Paddle power'),
           'the program day comes back with it');
    await r.click('#btnStart');
    await ev(() => { while (!isFinished()) skipBlock(); });
    assert(await ev(() => state.programs['surf-fit'].done.length === 1) && !(await kept()), 'finishing it ticks day 1 off and clears it');
    await r.click('#btnStart');
    assert(await view() === 'programView', 'and Done goes back to the program');
    await r.click('#btnProgramBack');
    ok(`a program day: "${dayLine}", picked up as Paddle power, finished and ticked off`);

    step = 'back after time away: a short spell carries on, a long one stops and asks';
    await ev(() => { state.intervalStyle = 'short'; savePrefs(); renderToday(); });
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    await ev(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work' && x.blockIdx === 1)); render(); });
    // out of view and back, with the time passing while it's hidden
    const away = (ms) => ev((ms) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      if (awayFrom) awayFrom.at -= ms;
      state.runStartWall -= ms;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    }, ms);
    const clock = () => ev(() => ({ running: state.running, elapsed: elapsedNow(), bar: !document.getElementById('awayBar').hidden,
      text: document.getElementById('awayText').textContent, button: document.getElementById('btnStart').textContent }));
    const e0 = (await clock()).elapsed;
    await away(5000);
    const short = await clock();
    assert(short.running && !short.bar && short.elapsed - e0 >= 4.9 && short.elapsed - e0 < 6, `5s away just carries on, caught up (+${(short.elapsed - e0).toFixed(1)}s)`);
    await away(30000);
    const asked = await clock();
    assert(!asked.running && asked.bar && asked.button === 'Resume', 'away 30s, it stops and asks: ' + JSON.stringify(asked));
    const answers = await ev(() => ['btnAwayBack', 'btnAwayKept', 'btnStart', 'btnSkip', 'btnReset'].filter(id => document.getElementById(id).offsetParent !== null).join());
    assert(answers === 'btnAwayBack,btnAwayKept,btnSkip,btnReset', 'Go back and I kept going are the answer, with no Resume beside them: ' + answers);
    assert(asked.elapsed - short.elapsed >= 29.9 && asked.elapsed - short.elapsed < 31, `stopped where the clock had got to (+${(asked.elapsed - short.elapsed).toFixed(1)}s)`);
    const backAt = await ev(() => awayBack);
    assert(Math.abs(backAt - short.elapsed) < 0.5, `it remembers where you left (${backAt.toFixed(1)}s)`);
    const leftAt = `${Math.floor(backAt / 60)}:${String(Math.floor(backAt % 60)).padStart(2, '0')}`;
    assert(asked.text === `You were away 0:30. Go back to ${leftAt}?`, 'it says how long and where you left: ' + asked.text);
    assert(await r.$eval('#awayBar', e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }), 'the question is on screen');
    await r.click('#btnAwayBack');
    const gone = await clock();
    assert(!gone.running && !gone.bar && gone.elapsed === backAt, `Go back: paused where you left (${gone.elapsed.toFixed(1)}s)`);
    assert((await r.$eval('#goingNote', e => e.textContent)) === `Back to ${leftAt}. Tap Resume when you're ready.`, 'and says so');
    assert(await r.$eval('#goingNote', e => { const b = e.getBoundingClientRect(); return !e.hidden && b.top >= 0 && b.bottom <= innerHeight; }),
           'where it can be seen, not under the buttons');
    assert(await r.$eval('#btnStart', e => e.offsetParent !== null && e.textContent === 'Resume'), 'with Resume back to tap');
    await r.click('#btnStart');
    assert(await r.$eval('#goingNote', e => e.hidden), 'and once it is going again, the note goes');
    const e2 = (await clock()).elapsed;
    await away(30000);
    assert((await clock()).bar, 'away 30s again, it asks again');
    await r.click('#btnAwayKept');
    const keptGoing = await clock();
    assert(keptGoing.running && !keptGoing.bar && keptGoing.elapsed - e2 >= 29.9 && keptGoing.elapsed - e2 < 32,
           `I kept going: running on from the caught-up time (+${(keptGoing.elapsed - e2).toFixed(1)}s)`);
    await r.click('#btnStart');                                 // pause: nothing to ask after a paused spell away
    await away(60000);
    assert(!(await clock()).bar && !(await clock()).running, 'a paused session away for a minute is not asked about');
    ok('away: 5s carries on, 30s stops at the caught-up time and asks "You were away 0:30. Go back to ' + leftAt + '?"; Go back pauses where you left, I kept going runs on');

    step = 'a phone on its side: the timer, both people and Pause on one screen';
    await r.click('#btnStart');
    await ev(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work' && x.blockIdx === 1)); render(); els.scroller.scrollTop = 0; });
    const onScreen = (ids) => ev((ids) => ids.filter(id => {
      const b = document.getElementById(id).getBoundingClientRect();
      return !(b.height > 0 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth);
    }), ids);
    for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
      await r.setViewportSize(size);
      await ev(() => new Promise(requestAnimationFrame));
      const off = await onScreen(['timeDisplay', 'labelA', 'exerciseA', 'labelB', 'exerciseB', 'btnStart', 'btnSkip', 'btnReset']);
      assert(!off.length, `${size.width} x ${size.height}: off screen: ${off}`);
      const lay = await ev(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        return { side: r('timeDisplay').right < r('labelA').left, pair: Math.round(r('labelA').top) === Math.round(r('labelB').top),
                 wide: els.scroller.scrollWidth > els.scroller.clientWidth + 1, pause: document.getElementById('btnStart').textContent };
      });
      assert(lay.side && lay.pair && !lay.wide && lay.pause === 'Pause', `${size.width} x ${size.height}: the timer left, the two people side by side on the right: ${JSON.stringify(lay)}`);
    }
    // an AMRAP's +1 round buttons are on that screen too
    await r.setViewportSize({ width: 844, height: 390 });
    await leaveStarted(r);
    await ev(() => { state.intervalStyle = 'amrap'; savePrefs(); renderToday(); });
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    await ev(() => { seekTo(state.sequence.findIndex(x => x.amrap)); render(); els.scroller.scrollTop = 0; });
    const amrapOff = await ev(() => ['#counterA .count-more', '#counterB .count-more', '#btnStart', '#timeDisplay'].filter(s => {
      const b = document.querySelector(s).getBoundingClientRect();
      return !(b.height > 0 && b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth);
    }));
    assert(!amrapOff.length, 'AMRAP on its side, off screen: ' + amrapOff);
    // an EMOM with the question after time away up: the buttons stay clear of the timer
    await leaveStarted(r);
    await ev(() => { state.intervalStyle = 'emom'; savePrefs(); renderToday(); });
    await r.click('#todayCard .today-go'); await r.click('#btnStart');
    await ev(() => { seekTo(state.sequence.findIndex(x => x.emom && x.blockIdx === 1)); render(); });
    for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
      await r.setViewportSize(size);
      await away(30000);
      await ev(() => new Promise(requestAnimationFrame));
      const clear = await ev(() => {
        const b = (id) => document.getElementById(id).getBoundingClientRect();
        const ctrl = document.querySelector('#workoutView .controls').getBoundingClientRect();
        return { asked: !document.getElementById('awayBar').hidden, timer: Math.round(ctrl.top - b('timerCard').bottom), total: Math.round(ctrl.top - b('totalTime').bottom),
                 bar: b('awayBar').bottom <= innerHeight };
      });
      assert(clear.asked && clear.bar && clear.timer >= 0 && clear.total >= 0,
             `${size.width} x ${size.height}: with the question up, the buttons clear the timer card and its Total line: ` + JSON.stringify(clear));
      await r.click('#btnAwayKept');
    }
    await r.setViewportSize({ width: 1180, height: 820 });
    assert(await ev(() => getComputedStyle(document.getElementById('workoutView')).display) === 'flex', 'an iPad keeps its own layout');
    await run.close();
    ok('on its side (844 x 390 and 667 x 375): the timer on the left, both people side by side on the right and Pause, Skip and Reset all on one screen; an AMRAP\'s +1 round buttons too; an EMOM\'s buttons clear the timer with the question after time away up');
  }

  step = 'iPhone sound: beeps on silent, back after a call; the wake lock outlasts a pause';
  assert(await p.$$eval('#soundPicker .chip', cs => cs.map(c => `${c.dataset.sound}:${c.textContent}`).join()) === 'music:Beeps,off:No sound',
         'Chromium has no audioSession, so the choice is Beeps or No sound, with nothing about the silent switch');
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    // What the page sees of an iPhone: a touch screen, a session type to set,
    // a wake lock that can take a moment to come back, and Web Audio by
    // WebKit's rules: a new context only starts with a tap behind it (user
    // activation), one that has run before can be resumed without one,
    // suspend and close settle a moment later, and Safari can leave it
    // 'interrupted' (and refuse to resume outside a tap). A beep is heard
    // when its context is running, or about to be.
    await phone.addInitScript(() => {
      const tapped = () => navigator.userActivation.isActive;
      window.__audio = { contexts: [], resumes: 0, suspends: 0, refuse: false, typeAtCreate: null, heard: 0, unheard: 0 };
      window.AudioContext = class {
        constructor() {
          this.ran = tapped(); this.starting = false;
          this.state = this.ran ? 'running' : 'suspended'; this.currentTime = 0; this.destination = {};
          __audio.contexts.push(this); __audio.typeAtCreate = navigator.audioSession.type;
        }
        resume() {
          __audio.resumes++;
          if (this.state === 'closed') return Promise.reject(new DOMException('closed', 'InvalidStateError'));
          if (__audio.refuse) return Promise.reject(new DOMException('not now', 'InvalidStateError'));
          if (!this.ran && !tapped()) return new Promise(() => {});      // waits for a tap
          this.ran = this.starting = true;
          return Promise.resolve().then(() => { this.starting = false; if (this.state !== 'closed') this.state = 'running'; });
        }
        suspend() { __audio.suspends++; return Promise.resolve().then(() => { if (this.state !== 'closed') this.state = 'suspended'; }); }
        close() { return Promise.resolve().then(() => { this.state = 'closed'; }); }
        createOscillator() {
          const c = this;
          return { frequency: {}, connect() {}, stop() {},
                   start() { if (c.state === 'running' || c.starting) __audio.heard++; else __audio.unheard++; } };
        }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      };
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
      window.__locks = { asked: 0, held: 0, last: null, delay: 0 };
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
        __locks.asked++;
        if (__locks.delay) await new Promise(r => setTimeout(r, __locks.delay));
        __locks.held++;
        const fns = [];
        __locks.last = { addEventListener: (t, f) => fns.push(f),
                         release() { __locks.held--; fns.forEach(f => f()); return Promise.resolve(); } };
        return __locks.last;
      } } });
    });
    const s = await phone.newPage();
    s.on('pageerror', e => errors.push('iPhone sound: ' + e));
    s.on('console', m => { if (m.type() === 'error') errors.push('iPhone sound: ' + m.text()); });
    // Reads and nudges from here are not taps: Playwright's own evaluate
    // carries user activation, which would let any context start. Taps are
    // real ones (s.tap, s.click).
    const cdp = await phone.newCDPSession(s);
    const ev = async (fn, arg) => {
      const r = await cdp.send('Runtime.evaluate', { expression: `(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})`,
                                                    returnByValue: true, awaitPromise: true, userGesture: false });
      if (r.exceptionDetails) throw new Error('in the page: ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
      return r.result.value;
    };
    const ctx = () => ev(() => __audio.contexts[0] && __audio.contexts[0].state);
    const live = () => ev(() => { const c = __audio.contexts[__audio.contexts.length - 1]; return c && c.state; });
    const visible = () => ev(() => document.dispatchEvent(new Event('visibilitychange')));
    // the app goes to the background and comes back
    const awayAndBack = () => ev(async () => {
      for (const v of ['hidden', 'visible']) {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
        document.dispatchEvent(new Event('visibilitychange'));
      }
      delete document.visibilityState;
      await new Promise(r => setTimeout(r, 0));
    });
    // a finger scrolling down the workout screen: the touch ends a scroll,
    // which isn't a tap
    const scrollDown = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] });
      for (let y = 570; y >= 240; y -= 30) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
        await s.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await s.waitForTimeout(100);
    };
    await s.goto(URL);
    await s.click('#btnGearDone');
    await s.click('#todayCard .today-go');
    const choices = await s.$$eval('#soundPicker .chip', cs => cs.map(c => `${c.dataset.sound}:${c.textContent}`).join());
    assert(choices === 'music:Beeps over my music,silent:Beeps even on silent,off:No sound', 'all three choices where audioSession exists: ' + choices);
    assert(await s.$eval('#soundPicker [data-sound="silent"]', e => e.offsetParent !== null && e.getAttribute('aria-pressed') === 'true')
           && await ev(() => state.sound === 'silent'), 'a new visitor on an iPhone starts on Beeps even on silent');
    assert(await s.$eval('#soundHint', e => !e.hidden && /Spotify/.test(e.textContent)), 'with a hint that other music pauses');
    assert(await s.$eval('#soundSaid', e => /even on silent/.test(e.textContent) && /music will pause/.test(e.textContent)),
           'and the line by Start says so: ' + await s.$eval('#soundSaid', e => e.textContent));
    assert(await ev(() => __audio.contexts.length === 0 && navigator.audioSession.type === 'auto'),
           'opening a workout makes no sound and leaves the session alone');

    await s.click('#btnStart');
    assert(await ev(() => __audio.contexts.length === 1 && __audio.typeAtCreate === 'playback'),
           'Start sets the session to playback before the first sound: ' + await ev(() => __audio.typeAtCreate));
    assert(await ctx() === 'running' && await ev(() => __audio.heard > 0 && __audio.unheard === 0), 'the Start tap starts it, and the chime is heard');
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
    await ev(() => { __audio.refuse = false; });
    await s.tap('#blockName');
    assert(await ctx() === 'running', 'and the next touch of the screen brings it back');
    // iOS can leave it saying 'running' with no sound after time in the background
    const [sus, res] = await ev(() => [__audio.suspends, __audio.resumes]);
    await awayAndBack();
    assert(await ev((n) => __audio.suspends === n[0] + 1 && __audio.resumes === n[1] + 1, [sus, res]) && await ctx() === 'running',
           'back from the background, a context that still says running is suspended and resumed anyway');
    await ev(() => { __audio.contexts[0].state = 'interrupted'; });
    await awayAndBack();
    assert(await ctx() === 'running', "and one Safari left 'interrupted' is running again too");
    // The first touch after that can be a scroll down to the cards, which
    // isn't a tap: the context that plays keeps the beeps going, rather than
    // being swapped for a new one that can't start.
    await s.waitForTimeout(5500);                               // the last tap's activation runs out
    assert(await ev(() => !navigator.userActivation.isActive), 'no tap behind what comes next');
    const before = await ev(() => [__audio.contexts.length, __audio.heard, __audio.unheard]);
    await scrollDown();
    assert(await ev(() => els.scroller.scrollTop) > 100, 'the workout screen scrolled');
    await ev(() => tickBeep());
    assert(await ev((b) => __audio.contexts.length === b[0] && __audio.contexts[0].state === 'running' && audioStale
                           && __audio.heard === b[1] + 1 && __audio.unheard === b[2], before),
           'after a scroll the same context plays on and the beep is heard: ' + JSON.stringify(await ev(() => [__audio.contexts.map(c => c.state), __audio.heard, __audio.unheard, audioStale])));
    await s.tap('#blockName');
    assert(await ev(() => __audio.contexts.length === 2 && __audio.contexts[0].state === 'closed' && __audio.contexts[1].state === 'running'
                          && __audio.typeAtCreate === 'playback' && !audioStale), 'and the first tap starts a fresh context, on playback');
    await s.tap('#blockName');
    assert(await ev(() => __audio.contexts.length === 2), 'only the first tap: the next one leaves it alone');
    await ev(() => { __audio.contexts.shift(); });               // the rest of the step watches the live one
    const heardNow = await ev(() => [__audio.heard, __audio.unheard]);
    await ev(() => tickBeep());
    assert(await ev((h) => __audio.heard === h[0] + 1 && __audio.unheard === h[1], heardNow), 'its beeps are heard');

    // sound settings changed mid-session take effect straight away
    const sound = (id) => s.click(`#soundPicker [data-sound="${id}"]`);
    await sound('off');
    assert(await ev(() => state.running && navigator.audioSession.type === 'auto'), 'No sound while running, FIT gives the session back');
    await sound('silent');
    assert(await ev(() => navigator.audioSession.type === 'playback'), 'Beeps even on silent again, playback again');
    await sound('music');
    assert(await ev(() => navigator.audioSession.type === 'auto'), 'Beeps over my music while running goes back to auto');
    await sound('silent');
    assert(await ev(() => navigator.audioSession.type === 'playback'), 'and on silent again, playback');

    await s.click('#btnStart');                                 // pause for a drink
    assert(await ev(() => !state.running && __locks.held === 1 && !!state.wakeLock), 'a pause keeps the wake lock');
    await ev(() => { __locks.last.release(); __audio.contexts[0].state = 'interrupted'; });  // the browser drops it while hidden
    assert(await ev(() => state.wakeLock === null), 'the app notices the browser letting go');
    const resumesBefore = await ev(() => __audio.resumes);
    await visible();
    assert(await ev(() => __locks.asked === 2 && __locks.held === 1 && !!state.wakeLock), 'coming back to a paused workout asks again');
    assert(await ev(() => __audio.resumes) === resumesBefore, 'but a paused workout leaves the audio (and your music) alone');

    await sound('off');
    assert(await ev(() => navigator.audioSession.type === 'auto'), 'No sound, FIT gives the session back');
    await sound('silent');
    assert(await ev(() => navigator.audioSession.type === 'playback'), 'on silent again, playback again');
    await sound('music');
    assert(await ev(() => state.sound === 'music' && !state.beepOnSilent && !state.muteAudio && navigator.audioSession.type === 'auto'),
           'Beeps over my music goes back to auto, and the old tick boxes follow it for a tab on an older release');

    await s.click('#btnBack');
    assert(await ev(() => __locks.held === 1 && document.querySelector('.view.active').id === 'workoutView'),
           'the first tap on Menu only asks, so the wake lock stays');
    await s.click('#btnBack');
    assert(await ev(() => __locks.held === 0 && !state.wakeLock), 'leaving the workout lets the wake lock go');
    assert(await ev(() => __audio.contexts[0].state === 'suspended'), 'and suspends the audio');
    await visible();
    assert(await ev(() => __locks.asked === 2), 'and nothing asks for it on the home screen');

    await s.reload();
    await s.click('#todayCard .today-go');
    assert(await ev(() => state.sound === 'music') && await s.$eval('#soundPicker [data-sound="music"]', e => e.getAttribute('aria-pressed') === 'true')
           && /over your music/.test(await s.$eval('#soundSaid', e => e.textContent)), 'Beeps over my music survives a reload');
    // Saves from before the choice: the two tick boxes it took over from
    const fromOld = (boxes) => ev((b) => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      delete prefs.sound; delete prefs.muteAudio; delete prefs.beepOnSilent; prefs.schema = 3;
      localStorage.setItem('fit-prefs-2', JSON.stringify({ ...prefs, ...b }));
    }, boxes);
    for (const [boxes, want] of [[{ muteAudio: true, beepOnSilent: true }, 'off'], [{ muteAudio: true, beepOnSilent: false }, 'off'],
                                 [{ muteAudio: false, beepOnSilent: false }, 'music'], [{ muteAudio: false, beepOnSilent: true }, 'silent'], [{}, 'silent']]) {
      await fromOld(boxes);
      await s.reload();
      const got = await ev(() => [state.sound, state.muteAudio, state.beepOnSilent]);
      assert(got[0] === want && got[1] === (want === 'off') && got[2] === (boxes.beepOnSilent !== false),
             `a save from before the choice with ${JSON.stringify(boxes)} is ${want}, and keeps its tick boxes: ` + JSON.stringify(got));
    }
    await fromOld({ muteAudio: true });
    await s.reload();
    await s.click('#todayCard .today-go');
    assert(await s.$eval('#soundPicker [data-sound="off"]', e => e.getAttribute('aria-pressed') === 'true') && await s.$eval('#voiceOn', e => e.disabled)
           && await s.$eval('#soundSaid', e => e.textContent) === 'Sound: none.', 'Mute audio ticked comes back as No sound, the voice switch greyed out with it');
    await sound('silent');
    assert(await ev(() => !state.muteAudio && state.beepOnSilent) && !(await s.$eval('#voiceOn', e => e.disabled)), 'and Beeps even on silent from there');
    await s.click('#btnBack');
    // leaving gives the session back, and a wake lock that lands after you've left is let go
    await s.click('#todayCard .today-go');
    await ev(() => { __locks.delay = 300; });
    await s.click('#btnStart');
    assert(await ev(() => navigator.audioSession.type === 'playback'), 'Start takes the session');
    await leaveStarted(s);
    assert(await ev(() => navigator.audioSession.type === 'auto' && __audio.contexts[0].state === 'suspended'),
           'leaving puts it back to auto, so music can carry on, and suspends the audio');
    await s.waitForFunction(() => __locks.asked === 1 && __locks.last, null, { timeout: 2000 });
    assert(await ev(() => __locks.held === 0 && !state.wakeLock), 'a wake lock still on its way when you leave is let go when it lands');
    await ev(() => { __locks.delay = 0; });

    // The finish: the bell on playback, the sound given back two seconds
    // later, and Start over taking it again.
    await s.click('#todayCard .today-go');
    await s.click('#btnStart');
    await ev(() => { while (!isFinished()) skipBlock(); });
    assert(await ev(() => navigator.audioSession.type === 'playback' && document.getElementById('btnAgain').offsetParent !== null),
           'the finish bell rings on playback, with Start over on screen');
    await s.waitForTimeout(2300);
    assert(await ev(() => navigator.audioSession.type === 'auto') && await live() === 'suspended', 'two seconds after the bell, FIT lets the sound go');
    await s.click('#btnAgain');
    const again = await ev(() => [__audio.heard, __audio.unheard]);
    await ev(() => tickBeep());
    assert(await ev((h) => state.running && navigator.audioSession.type === 'playback' && __audio.heard === h[0] + 1 && __audio.unheard === h[1], again)
           && await live() === 'running', 'Start over takes it again, and its beeps are heard');
    // Leaving with a chime still ringing (the block-rest bell has two notes to
    // come) leaves the sound with your music.
    await ev(() => {
      seekTo(state.sequence.findIndex(x => x.kind === 'work')); render();
      els.btnSkip.click(); els.btnBack.click(); els.btnBack.click();
    });
    assert(await ev(() => state.view === 'welcome' && navigator.audioSession.type === 'auto'), 'left on the bell');
    await s.waitForTimeout(700);
    assert(await ev(() => navigator.audioSession.type === 'auto') && await live() === 'suspended',
           'the rest of the bell after leaving does not take the sound back: ' + await ev(() => navigator.audioSession.type));
    await phone.close();
  }
  // Safari on a Mac has the session too, but no silent switch
  {
    const mac = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    await mac.addInitScript(() => {
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
    });
    const m = await mac.newPage();
    m.on('pageerror', e => errors.push('Mac: ' + e));
    await m.goto(URL);
    await m.click('#btnGearDone');
    await m.click('#todayCard .today-go');
    assert(await m.$$eval('#soundPicker .chip', cs => cs.map(c => c.dataset.sound).join()) === 'music,off'
           && await m.$eval('#soundPicker [data-sound="music"]', e => e.getAttribute('aria-pressed') === 'true')
           && await m.$eval('#soundHint', e => e.hidden), 'no silent option without a touch screen: Beeps (on) or No sound');
    await m.click('#btnStart');
    assert(await m.evaluate(() => navigator.audioSession.type === 'auto'), 'and the session is left alone');
    await mac.close();
  }
  ok('iPhone, by WebKit\'s tap rules: playback from the first beep, resumes after a call or a return, re-armed after the background even when it says running or interrupted, a scroll keeps the sound and the next tap swaps in a fresh context, a refusal is caught; a change of sound applies mid-session; wake lock kept through a pause, asked again on return, let go on leaving even mid-request; the sound given back on leaving, after the finish bell and after a late chime, and taken again by Start over; the choice persists, comes from the old tick boxes, and has no silent option on a Mac');

  step = 'voice coach: the next move for each person at the rest, never over itself or the 3-2-1, and quiet when it should be';
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    // speechSynthesis as Safari has it: one line at a time (another while one
    // plays is counted as an overlap), a line takes about as long as it
    // would to say unless __speech.ms says otherwise, and cancel cuts it off.
    // Safari's own list of voices has novelty ones in it.
    await phone.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
      window.__speech = { said: [], cancels: 0, overlaps: 0, current: null, ms: null, voices: [
        { name: 'Samantha', lang: 'en-US', localService: true, default: true }, { name: 'Bells', lang: 'en-AU', localService: true },
        { name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Karen', lang: 'en-AU', localService: true }] };
      const synth = {
        get speaking() { return !!__speech.current; }, get pending() { return false; }, paused: false,
        getVoices: () => __speech.voices,
        speak(u) {
          if (__speech.current) __speech.overlaps++;
          const phase = state.sequence[state.currentIdx] || {};
          // the time left in the phase as it starts, to the moment
          const left = phase.duration - (elapsedNow() - startOf(state.currentIdx));
          __speech.said.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang, volume: u.volume,
                               tapped: navigator.userActivation.isActive, idx: state.currentIdx, kind: phase.kind, left });
          __speech.current = u;
          const ms = __speech.ms != null ? __speech.ms : 400 + u.text.length / 13 * 1000;
          setTimeout(() => { if (__speech.current === u) { __speech.current = null; if (u.onend) u.onend({}); } }, ms);
        },
        cancel() {
          __speech.cancels++;
          const u = __speech.current;
          __speech.current = null;
          if (u && u.onerror) u.onerror({ error: 'interrupted' });
        },
        pause() {}, resume() {}, addEventListener() {}, removeEventListener() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.volume = 1; } };
    });
    const v = await phone.newPage();
    v.on('pageerror', e => errors.push('voice: ' + e));
    v.on('console', m => { if (m.type() === 'error') errors.push('voice: ' + m.text()); });
    const ev = (fn, arg) => v.evaluate(fn, arg);
    const said = () => ev(() => __speech.said.filter(x => x.text.trim()).map(x => x.text));
    const lines = () => ev(() => __speech.said.filter(x => x.text.trim()).length);
    // Arriving at phase i, `left` seconds before its end (at its start if
    // left is left out), and one tick there; later, the same phase further on.
    const at = (i, left) => ev(([i, left]) => {
      seekTo(i);
      coach.at = -1;
      if (left != null) state.runStartWall -= (state.sequence[i].duration - left) * 1000;
      tickClock();
    }, [i, left]);
    const later = (left) => ev((left) => {
      const i = state.currentIdx;
      state.runStartWall = Date.now() - (startOf(i) + state.sequence[i].duration - left - state.elapsedAtResume) * 1000;
      tickClock();
    }, left);
    const waitSaid = (n, why) => v.waitForFunction((n) => __speech.said.filter(x => x.text.trim()).length > n, n, { timeout: 5000 })
      .catch(() => { throw new Error(`FAILED at "${step}": nothing said ${why}`); });
    await v.goto(URL);
    await v.click('#btnGearDone');
    // a seeded two-person surf session in short bursts, without the 3D
    // figures, whose software drawing here can hold the page's timers up
    const built = await ev(() => {
      state.people = 2; state.nameA = 'Wayne'; state.nameB = 'Dave'; state.showPhotos = false; savePrefs(); showSettings();
      return buildAndOpen({ ...requestFromState(), people: 2, goal: 'surf', intervalId: 'short', mix: undefined, minutes: 20 }, 4242);
    });
    assert(built === null, 'a seeded surf session opens: ' + built);
    assert(await ev(() => state.voice === true && CAN_SPEAK) && await v.$eval('#voiceOn', e => e.checked && !e.disabled && e.offsetParent !== null),
           'the voice coach is on for a new visitor, beside the sound choice');
    assert(/and the voice coach/.test(await v.$eval('#soundSaid', e => e.textContent)), 'and the line by Start says so');
    assert(await ev(() => coachVoice && coachVoice.name) === 'Karen', 'it talks with the Australian voice, not the novelty one');
    assert(await ev(() => { __speech.voices = __speech.voices.filter(x => x.lang !== 'en-AU'); pickVoice(); const n = coachVoice.name; __speech.voices.push({ name: 'Karen', lang: 'en-AU', localService: true }); pickVoice(); return n; }) === 'Daniel',
           'with no Australian voice, the British one');
    assert(await lines() === 0 && await ev(() => __speech.said.length === 0), 'opening a workout says nothing');

    await v.click('#btnStart');
    const first = await ev(() => __speech.said[0]);
    assert(first && !first.text.trim() && first.volume === 0 && first.tapped, 'the Start tap has it say a silent line, which lets it talk from then on: ' + JSON.stringify(first));
    await waitSaid(0, 'as the warm-up starts');
    const warm = await ev(() => [__speech.said.filter(x => x.text.trim())[0], state.sequence[0].a.name]);
    assert(warm[0].text === `Warm-up. ${warm[1]}.` && warm[0].voice === 'Karen' && warm[0].lang === 'en-AU', 'the warm-up names its first move: ' + JSON.stringify(warm));

    // the rest before a round where the two of them are on different moves
    const r = await ev(() => {
      const i = state.sequence.findIndex((x, j) => x.kind === 'rest' && j > 0 && (state.sequence[j + 1] || {}).kind === 'work'
        && state.sequence[j + 1].a.name !== state.sequence[j + 1].b.name && state.sequence[j + 1].round < state.sequence[j + 1].totalRounds);
      const next = state.sequence[i + 1];
      return { i, a: spoken(next.a.name), b: spoken(next.b.name) };
    });
    assert(r.i > 0, 'a rest before the two of them do different moves');
    let n = await lines();
    await at(r.i);
    await waitSaid(n, 'at the rest');
    const rest = await ev(() => __speech.said[__speech.said.length - 1]);
    assert(rest.text.startsWith('Next: ') && rest.text.includes(`Wayne, ${r.a}`) && rest.text.includes(`Dave, ${r.b}`) && rest.kind === 'rest',
           `the rest says the next move and both names: "${rest.text}" (${r.a} / ${r.b})`);
    assert(rest.left - (0.4 + rest.text.length / 13) >= 3.5, 'and it starts in time to finish clear of the 3-2-1: ' + rest.left);
    // before the last round
    const last = await ev(() => state.sequence.findIndex((x, j) => x.kind === 'rest' && (state.sequence[j + 1] || {}).round === state.sequence[j + 1].totalRounds && state.sequence[j + 1].totalRounds > 2));
    n = await lines();
    await at(last);
    await waitSaid(n, 'before the last round');
    assert((await said()).pop().startsWith('Last round: '), 'the rest before the last round says so: ' + (await said()).pop());
    // the block rest calls the next block
    const br = await ev(() => state.sequence.findIndex(x => x.kind === 'blockrest'));
    n = await lines();
    await at(br);
    await waitSaid(n, 'at the block rest');
    assert((await said()).pop().startsWith('Next: '), 'the block rest says what the next block starts with');
    // halfway through the session, said once
    const half = await ev(() => state.sequence.findIndex((x, j) => x.kind === 'rest' && startOf(j) >= state.totalDuration / 2 && (state.sequence[j + 1] || {}).kind === 'work'));
    n = await lines();
    await at(half);
    await waitSaid(n, 'at halfway');
    assert((await said()).pop().startsWith('Halfway. Next: '), 'past halfway, the next line starts with it: ' + (await said()).pop());
    n = await lines();
    await at(half + 2);
    await waitSaid(n, 'at the rest after halfway');
    assert(!(await said()).pop().includes('Halfway'), 'and only once');
    // a rest landed on with too little time left says nothing
    n = await lines();
    await at(r.i, 3.2);
    assert(await lines() === n && await ev(() => !coach.timer), 'nothing starts with under 3.5 seconds of a phase left');
    // a phone too busy to start a line on time drops it rather than say it late
    await ev((i) => { seekTo(i); coach.at = -1; tickClock(); const t = Date.now(); while (Date.now() - t < 5000); }, r.i);
    await v.waitForFunction(() => !coach.timer);
    assert(await lines() === n, 'a line held up past when it could finish clear of the 3-2-1 is dropped, not said late');
    // nothing said over the 3-2-1: a line still going at 3 seconds is cut off
    await ev(() => { __speech.ms = 60000; });
    n = await lines();
    await at(r.i);
    await waitSaid(n, 'with a long line');
    let cancels = await ev(() => __speech.cancels);
    await later(2.9);
    assert(await ev((c) => __speech.cancels === c + 1 && !speechSynthesis.speaking, cancels), 'a line still going at the 3-2-1 is cut off');
    // a pause, a skip and leaving each cut off what's being said
    n = await lines();
    await at(r.i);
    await waitSaid(n, 'before the pause');
    cancels = await ev(() => __speech.cancels);
    await v.click('#btnStart');
    assert(await ev((c) => !state.running && __speech.cancels === c + 1 && !speechSynthesis.speaking, cancels), 'Pause cuts the voice off');
    n = await lines();
    await v.click('#btnStart');
    await waitSaid(n, 'on Resume');
    assert((await said()).pop().startsWith('Next: '), 'Resume in a rest says its line again, since the pause cut it off');
    cancels = await ev(() => __speech.cancels);
    n = await lines();
    await v.click('#btnSkip');
    assert(await ev((c) => __speech.cancels >= c + 1, cancels), 'Skip cuts it off');
    await waitSaid(n, 'after the skip');
    const landed = await ev(() => state.sequence[state.currentIdx].kind);
    assert(landed === 'blockrest' ? (await said()).pop().startsWith('Next: ') : (await said()).pop().startsWith('Cool-down. '),
           `and the ${landed} it lands on says its own line: ` + (await said()).pop());
    assert(await ev(() => __speech.overlaps) === 0, 'no line ever started over another');
    cancels = await ev(() => __speech.cancels);
    await leaveStarted(v);
    assert(await ev((c) => state.view === 'welcome' && __speech.cancels === c + 1 && !speechSynthesis.speaking && !coach.timer, cancels), 'leaving the workout cuts it off');
    await ev(() => { __speech.ms = null; });

    // No sound says nothing, and neither does the voice switched off
    await ev(() => buildAndOpen({ ...requestFromState(), people: 2, goal: 'surf', intervalId: 'short', mix: undefined, minutes: 20 }, 4242));
    await v.click('#btnStart');
    await v.click('#soundPicker [data-sound="off"]');
    assert(await v.$eval('#voiceOn', e => e.disabled), 'No sound greys the voice switch out');
    n = await lines();
    await at(r.i);
    await at(r.i + 2, 8);
    assert(await lines() === n && await ev(() => !coach.timer), 'No sound: nothing is said at a rest');
    await v.click('#soundPicker [data-sound="silent"]');
    await v.click('#voiceOn');
    assert(await ev(() => state.voice === false && !talking()), 'the voice switched off, which stops it');
    assert(!/voice coach/.test(await v.$eval('#soundSaid', e => e.textContent)), 'and the line by Start leaves it out');
    n = await lines();
    await at(r.i);
    await at(r.i + 2, 8);
    assert(await lines() === n && await ev(() => !coach.timer), 'Voice off: nothing is said at a rest either');
    await v.click('#voiceOn');
    n = await lines();
    await at(r.i);
    await waitSaid(n, 'with the voice back on');
    await leaveStarted(v);

    // EMOM: the next minute's reps, called before it starts
    await ev(() => buildAndOpen({ ...requestFromState(), people: 2, goal: undefined, intervalId: 'emom', mix: undefined, minutes: 20 }, 777));
    await v.click('#btnStart');
    const em = await ev(() => {
      const i = state.sequence.findIndex((x, j) => x.emom && (state.sequence[j + 1] || {}).emom && state.sequence[j + 1].blockIdx === x.blockIdx);
      const next = state.sequence[i + 1];
      return { i, a: [spoken(next.a.name), next.a.reps.split(' ')[0].replace(/s$/, '')], b: [spoken(next.b.name), next.b.reps.split(' ')[0].replace(/s$/, '')], reps: next.a.reps };
    });
    assert(em.i >= 0 && /\d/.test(em.reps), 'an EMOM minute with another after it: ' + JSON.stringify(em));
    await at(em.i, 30);
    const aheadAt = await ev(() => coach.ahead && coach.ahead.at);
    assert(aheadAt > 3.5 && aheadAt < 20, 'the next minute is called a few seconds before it starts: ' + aheadAt);
    n = await lines();
    await later(aheadAt - 0.1);
    await waitSaid(n, 'before the next EMOM minute');
    const emLine = (await said()).pop();
    assert(emLine.startsWith('Next: ') || emLine.startsWith('Last round: '), 'the call before an EMOM minute: ' + emLine);
    assert([em.a, em.b].every(([name, count]) => emLine.includes(name) && emLine.includes(count)),
           `with each person's move and count: "${emLine}" (${em.a} / ${em.b})`);
    await leaveStarted(v);

    // AMRAP: the block rest reads out the list, and one minute left
    await ev(() => { state.people = 1; return buildAndOpen({ ...requestFromState(), people: 1, goal: undefined, intervalId: 'amrap', mix: undefined, minutes: 20 }, 99); });
    await v.click('#btnStart');
    const am = await ev(() => {
      const i = state.sequence.findIndex((x, j) => x.kind === 'blockrest' && (state.sequence[j + 1] || {}).amrap);
      return { i, w: i + 1, first: spoken(state.sequence[i + 1].a.circuit[0].name), min: Math.round(state.sequence[i + 1].duration / 60) };
    });
    n = await lines();
    await at(am.i);
    await waitSaid(n, 'before an AMRAP');
    const amLine = (await said()).pop();
    assert(amLine.startsWith(`Next: AMRAP, ${am.min} minutes. `) && amLine.includes(am.first), 'the block rest reads out the AMRAP: ' + amLine);
    await at(am.w, 100);
    n = await lines();
    await later(59.5);
    await waitSaid(n, 'with a minute to go');
    assert(/^(Halfway\. )?One minute left\.$/.test((await said()).pop()), 'one minute left in the AMRAP: ' + (await said()).pop());
    await leaveStarted(v);

    // what it says, said well: weights, seconds, sides, and no symbols, for every exercise
    const words = await ev(() => [spoken('KB swings · 16kg'), spoken('Plank, 40s each side'), spoken('Next: EMOM, 1 min. Wayne, 12.5kg'),
                                 spoken('90/90 hip, left'), spoken('Neck & shoulder rolls'), spoken('Cobra / upward dog')]);
    assert(words.join('|') === 'kettlebell swings, 16 kilo|Plank, 40 seconds each side|Next: EMOM, 1 minute. Wayne, 12.5 kilo|90 90 hip, left|Neck and shoulder rolls|Cobra, upward dog',
           'said as you would say it: ' + words.join(' | '));
    const counts = await ev(() => [['10 reps', ''], ['1 rep', ''], ['40s', ''], ['20s each side', ''], ['8 each side', '16kg'], ['5 each way', ''], ['1 lap', ''], ['', '12kg']]
      .map(([reps, load]) => spoken(moveSaid({ name: 'KB swings', reps, load }, 2))));
    assert(counts.join('|') === '10 kettlebell swings|1 kettlebell swings|40 seconds of kettlebell swings|20 seconds of kettlebell swings each side|8 kettlebell swings each side, 16 kilo|5 kettlebell swings each way|1 lap of kettlebell swings|kettlebell swings, 12 kilo',
           'the count first, so a list of them still reads: ' + counts.join(' | '));
    const odd = await ev(() => Object.keys(EXERCISES).flatMap(id => [{ reps: true }, { reps: true, lap: true }, {}].map(ctx => {
      const ex = describeEx(id, { ...ctx, loads: { kb15: '16kg', kb10: '12kg', bar: '20kg bar', dbHeavy: '12.5kg', dbLight: '7.5kg' } });
      return spoken(moveSaid(ex, 2));
    })).filter(t => /[\/·&]|\dkg|\d+s\b|\bKB\b|undefined/.test(t)));
    assert(!odd.length, 'every exercise, its reps and its weight said without symbols: ' + odd.slice(0, 5).join(' | '));

    // the choice and the voice switch persist, through a backup, and past a tab on an older release
    await v.click('#todayCard .today-go');
    await v.click('#soundPicker [data-sound="music"]');
    await v.click('#voiceOn');
    await v.reload();
    assert(await ev(() => state.sound === 'music' && state.voice === false && !state.muteAudio && !state.beepOnSilent), 'Beeps over my music and the voice off survive a reload');
    const backup = await ev(() => JSON.parse(backupText()).prefs);
    assert(backup.sound === 'music' && backup.voice === false && backup.muteAudio === false && backup.beepOnSilent === false, 'a backup has both, and the old tick boxes for an older release');
    const back = await ev(() => {
      const text = backupText();
      setSound('off'); state.voice = true; savePrefs();
      replaceData(readBackup(text).prefs, true);
      return [state.sound, state.voice, document.querySelector('#soundPicker [aria-pressed="true"]').dataset.sound, document.getElementById('voiceOn').checked];
    });
    assert(back.join() === 'music,false,music,false', 'and a restore brings them back, on screen too: ' + back);
    const oldBackup = await ev(() => {
      const o = JSON.parse(backupText());
      delete o.prefs.sound; delete o.prefs.voice; o.prefs.schema = 3; o.prefs.muteAudio = true;
      const b = readBackup(JSON.stringify(o));
      return [b.prefs.sound, b.prefs.voice];
    });
    assert(oldBackup.join() === 'off,true', "a backup from before the choice: Mute audio is No sound, and the voice its default: " + oldBackup);
    // a tab on the last release knows neither, and saves without them
    await ev(() => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      delete prefs.sound; delete prefs.voice; prefs.schema = 3; prefs.muteAudio = false; prefs.beepOnSilent = false;
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
    });
    await v.reload();
    assert(await ev(() => state.sound === 'music' && state.voice === false), "after a save from a tab on the last release, the choice comes from its tick boxes and the voice from its own key");
    await ev(() => {
      localStorage.setItem('fit-prefs-2', JSON.stringify({ ...JSON.parse(localStorage.getItem('fit-prefs-2')), schema: 4, voice: 'loud', sound: 'blaring' }));
      localStorage.setItem('fit-voice-1', '"loud"');
    });
    await v.reload();
    assert(await ev(() => state.voice === true && state.sound === 'music'), 'a voice or sound that is not one of its own goes back to the default, and the tick boxes');
    note(`at a rest: "${rest.text}"; before an EMOM minute: "${emLine}"; before an AMRAP: "${amLine}"`);
    await phone.close();
  }
  ok('voice coach: on for a new visitor in an Australian voice, primed by the Start tap, names the warm-up, calls both people\'s next move at each rest, Last round, the next block, Halfway once, an EMOM\'s reps ahead of the minute and an AMRAP\'s list and one minute left; never under 3.5 seconds, cut off at the 3-2-1, on pause, skip and leave, never over itself; silent with No sound or the voice off; spoken words for every exercise; the choice and the switch persist, back up and survive a tab on the last release');

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
  // reopened, the scored block has its last time and a skipped one has none
  await leaveStarted(); await p.click('#pathLibrary'); await p.click('.history-card');
  const amrapAtBlock = (b) => p.evaluate((b) => { seekTo(state.sequence.findIndex(x => x.amrap && x.blockIdx === b)); render(); }, b);
  const skippedBlk = await p.evaluate((b) => state.sequence.find(x => x.amrap && x.blockIdx !== b).blockIdx, blk);
  await amrapAtBlock(blk);
  assert((await p.$eval('#counterA', e => e.textContent)).includes('Last time 1'), 'reopened, the scored block shows Last time 1');
  await amrapAtBlock(skippedBlk);
  const skippedLast = await p.$eval('#counterA', e => e.textContent);
  assert(!skippedLast.includes('Last time'), 'and a block skipped unscored shows no Last time: ' + skippedLast.trim());
  // Start over on the finish screen counts from 0, not on top of the first go
  await p.click('#btnStart');
  await amrapAtBlock(blk);
  for (let i = 0; i < 3; i++) await p.click('#counterA .count-more');
  while (await st(() => !isFinished())) await p.click('#btnSkip');
  await p.click('#btnAgain');
  await amrapAtBlock(blk);
  assert((await p.$eval('#counterA .count-now b', e => e.textContent)) === '0', 'Start over: the counter is back at 0');
  await p.click('#counterA .count-more');
  assert(await p.evaluate((b) => state.history[0].scores[b].a === 1, blk), 'and one round is one round, not 4');
  await p.click('#btnStart');                                   // pause
  // an AMRAP skipped with no rounds logged: with most of it done it counts as done and reads 0 rounds,
  // with most of it to go it's skipped and reads skipped, so the summary and the rows agree
  const agree = await st((done) => {
    const i = state.sequence.findIndex(x => x.amrap && x.blockIdx !== done);
    const b = state.sequence[i].blockIdx, dur = state.sequence[i].duration;
    const look = () => ({ skipped: JSON.stringify(state.skipped), row: finishScores('a').find(r => r.startsWith(`Block ${b + 1} `)),
                          line: finishSummary()[0], history: !!state.history[0].scores[b].skipped });
    const at = (part) => { delete state.scores[b]; saveScores(); state.skipped = []; placeAt(startOf(i) + dur * part); skipBlock(); return look(); };
    return { b, late: at(0.6), early: at(0.4) };
  }, blk);
  assert(agree.late.skipped === '[]' && agree.late.row === `Block ${agree.b + 1} AMRAP: 0 rounds` && !agree.late.line.includes('skipped') && !agree.late.history,
         'skipped with 40% of it left and no rounds: a block done, 0 rounds: ' + JSON.stringify(agree.late));
  assert(agree.early.skipped === `[${agree.b}]` && agree.early.row === `Block ${agree.b + 1} AMRAP: skipped` && agree.early.line.includes('1 skipped') && agree.early.history,
         'skipped with 60% of it left: a block skipped, and its row says so: ' + JSON.stringify(agree.early));
  ok(`AMRAP: ${amrap.blocks} four-minute laps, the counter keeps score and history saves it; skipped blocks read "–", show no Last time, and the lap goes after; Start over counts from 0; a skip's row and the summary agree`);

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

  step = 'the finish screen says what was done, and each person says how it was';
  await leaveStarted();
  await p.click('#pathBuild'); await p.fill('#nameA', 'Wayne'); await p.fill('#nameB', 'Dave');
  await p.click('.interval-card:has-text("EMOM")');
  await p.click('#btnBuild');
  assert(await st(() => state.people === 2 && state.workout.request.repScales === undefined && !Object.keys(state.levels).length),
         'before anyone has said, a build carries no levels');
  // one block skipped, then the clock runs out on its own
  const runOut = () => p.evaluate(() => new Promise(done => {
    state.elapsedAtResume = state.totalDuration - 0.3; state.runStartWall = Date.now();
    const t = setInterval(() => { if (isFinished()) { clearInterval(t); done(); } }, 50);
  }));
  await p.click('#btnStart');
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  await p.click('#btnSkip');
  assert(await st(() => { saveRun(); return JSON.stringify(readRun().skipped); }) === '[0]', 'a session saved part-way keeps what was skipped');
  await st(() => noteUntilGoing('Back to 7:30.'));      // as if it had been, a note from before the end
  await runOut();
  const fin1 = await st(() => ({ lines: [...document.querySelectorAll('#roundDots .finish-line')].map(e => e.textContent),
    total: document.getElementById('totalTime').textContent, n: state.workout.blocks.length, whole: fmt(state.totalDuration),
    done: fmt(Math.round(timeDone())), near: Math.abs(timeDone() - (state.totalDuration - 240)) < 3, min: Math.floor(Math.round(timeDone()) / 60),
    note: document.getElementById('workoutNote').textContent + (document.getElementById('goingNote').hidden ? '' : document.getElementById('goingNote').textContent),
    asks: ['finishA', 'finishB'].map(id => document.querySelector(`#${id} .feel-ask`) && document.querySelector(`#${id} .feel-ask`).textContent),
    chips: [...document.querySelectorAll('#finishA .feel-chip')].map(c => c.textContent).join('|') }));
  assert(fin1.lines.length === 1 && fin1.lines[0] === `${fin1.min} min done · ${fin1.n - 1} of ${fin1.n} blocks, 1 skipped`,
         'the summary says the minutes done and the block skipped: ' + JSON.stringify(fin1.lines));
  assert(fin1.total === `Total ${fin1.done} / ${fin1.whole}` && fin1.near, 'and the clock the time it ran, four minutes short: ' + fin1.total);
  assert(fin1.done.split(':')[0] === String(fin1.min), `the minutes done are the clock's whole minutes: ${fin1.min} min beside ${fin1.done}`);
  assert(fin1.note === '', 'a note from before the end is gone from the finish screen: ' + fin1.note);
  assert(fin1.asks.every(a => a === 'How was that?') && fin1.chips === 'Too easy|About right|Cooked', 'each person is asked how it was, three answers: ' + JSON.stringify(fin1));
  await p.click('#finishA .feel-chip[data-feel="easy"]');
  await p.click('#finishB .feel-chip[data-feel="right"]');
  const said1 = await st(() => ({ feel: JSON.stringify(state.history[0].feel), levels: JSON.stringify(state.levels),
    notes: ['finishA', 'finishB'].map(id => document.querySelector(`#${id} .feel-note`).textContent),
    on: [...document.querySelectorAll('.feel-chip.active')].map(c => c.dataset.feel).join() }));
  assert(said1.feel === '{"a":"easy","b":"right"}' && said1.levels === '{"wayne":{"k":1,"easy":1}}' && said1.on === 'easy,right',
         'one tap each, kept with the session, and one Too easy waits for a second: ' + JSON.stringify(said1));
  assert(said1.notes[0] === 'Noted. Say it again next time and your reps go up a notch.' && said1.notes[1] === 'Noted. Your reps stay as they are.',
         'each answer says what it does: ' + JSON.stringify(said1.notes));
  // the same answer again takes it back; then it's given again
  await p.click('#finishA .feel-chip[data-feel="easy"]');
  assert(await st(() => JSON.stringify(state.history[0].feel) === '{"b":"right"}' && !state.levels.wayne), 'a second tap on the same answer takes it back');
  await p.click('#finishA .feel-chip[data-feel="cooked"]'); await p.click('#finishA .feel-chip[data-feel="easy"]');
  assert(await st(() => JSON.stringify(state.levels) === '{"wayne":{"k":1,"easy":1}}'), 'changing your mind counts once, not twice: ' + await st(() => JSON.stringify(state.levels)));
  // the history card says how it felt, and an old entry without it still shows
  await p.click('#btnStart');
  await st(() => {
    state.history.splice(1, 0, { key: 'id:quick-spark', name: 'Quick Spark', at: Date.now() - 86400000 * 3, people: 2, intervalId: 'short',
                                 generated: false, workoutId: 'quick-spark', minutes: 13, completed: true });
    savePrefs(); renderLibrary(); setView('library');
  });
  const felt = await p.$$eval('.history-card', els => els.slice(0, 2).map(e => ({ name: e.querySelector('.card-name').textContent,
    feel: (e.querySelector('.card-feel') || {}).textContent || '', done: !!e.querySelector('.card-done') })));
  assert(felt[0].feel === 'Wayne: too easy · Dave: about right' && felt[1].name === 'Quick Spark' && felt[1].feel === '' && felt[1].done,
         'the card says who felt what, and an old session with nothing said still shows: ' + JSON.stringify(felt));
  // a second Too easy in a row moves Wayne up a notch, and one Cooked moves Dave down
  await st(() => goWelcome());
  await p.click('#todayCard .today-go');
  assert(await st(() => state.workout.request.repScales === undefined), 'one Too easy alone changes nothing yet');
  await p.click('#btnStart');
  await runOut();
  const whole = await st(() => ({ total: document.getElementById('totalTime').textContent, line: document.querySelector('#roundDots .finish-line').textContent,
                                  n: state.workout.blocks.length, min: Math.round(state.totalDuration / 60) }));
  assert(/^Total (\d+:\d\d) \/ \1$/.test(whole.total) && whole.line === `${whole.min} min done · ${whole.n} of ${whole.n} blocks`,
         'run out on the clock with nothing skipped, the finish screen has the whole session on it: ' + JSON.stringify(whole));
  await p.click('#finishA .feel-chip[data-feel="easy"]');
  await p.click('#finishB .feel-chip[data-feel="cooked"]');
  const said2 = await st(() => ({ levels: JSON.stringify(state.levels), notes: ['finishA', 'finishB'].map(id => document.querySelector(`#${id} .feel-note`).textContent) }));
  assert(said2.levels === '{"wayne":{"k":1.1,"easy":0},"dave":{"k":0.9,"easy":0}}', 'Wayne up to 1.1, Dave down to 0.9: ' + said2.levels);
  assert(said2.notes[0] === 'Noted. Your reps go up a notch next time.' && said2.notes[1] === 'Noted. Your reps come down a notch next time.', JSON.stringify(said2.notes));
  // a session all on the clock has no reps for that to change, so it says when it shows
  const timedNotes = await st(() => {
    const w = state.workout;
    state.workout = { ...w, intervalId: 'short' };
    const out = ['a', 'b'].map(feelNote);
    state.workout = w;
    return { out, mix: hadReps({ sections: [{ intervalId: 'short' }, { intervalId: 'amrap' }] }), long: hadReps({ intervalId: 'long', blocks: [] }) };
  });
  assert(timedNotes.out[0] === 'Noted. Your reps go up a notch next time there are reps to do.'
         && timedNotes.out[1] === 'Noted. Your reps come down a notch next time there are reps to do.' && timedNotes.mix && !timedNotes.long,
         'after Short bursts it says the reps change next time there are some: ' + JSON.stringify(timedNotes));
  // the next EMOM: the same moves for both, Wayne's reps above Dave's
  await p.click('#btnStart');
  await p.click('#pathBuild'); await p.click('#btnBuild');
  const reps = () => st(() => {
    const n = (r) => parseInt(r, 10);
    const plainCtx = { ...buildCtx(state.workout, INTERVALS.emom), level: undefined };
    const by = {};
    state.sequence.filter(x => x.emom).forEach(x => ['a', 'b'].forEach(w => {
      const e = by[x[w].id] || (by[x[w].id] = { plain: n(describeEx(x[w].id, plainCtx).reps) });
      e[w] = n(x[w].reps);
    }));
    return { by, scales: JSON.stringify(state.workout.request.repScales), ids: state.workout.exerciseIds.join(), seed: state.workout.seed,
             seq: state.sequence.filter(x => x.emom).map(x => `${x.a.id} ${x.a.reps} / ${x.b.id} ${x.b.reps}`).join('|') };
  });
  const lv = await reps();
  const both = Object.values(lv.by).filter(e => e.a !== undefined && e.b !== undefined);
  assert(lv.scales === '{"wayne":1.1,"dave":0.9}', 'the build carries each person\'s level by name: ' + lv.scales);
  assert(both.length && both.every(e => e.a >= e.plain && e.plain >= e.b) && both.some(e => e.a > e.b),
         "two Too easy taps put Wayne's EMOM reps above Dave's on the same moves: " + JSON.stringify(lv.by));
  const plainIds = await st((seed) => buildWorkout({ ...state.workout.request, repScales: undefined }, seed, { recent: state.workout.request.recent }).exerciseIds.join(), lv.seed);
  assert(plainIds === lv.ids, 'and the levels change the reps only, never the moves');
  const lineFor = (w) => st((w) => {
    const i = state.sequence.findIndex(x => x.emom && x[w].more);
    if (i < 0) return null;
    seekTo(i); render();
    return els['level' + w.toUpperCase()].textContent;
  }, w);
  const lines = [await lineFor('a'), await lineFor('b')];
  assert(/^\+\d+( reps?| each side|s|s each side): you said too easy$/.test(lines[0]) && /^−\d+( reps?| each side|s|s each side): you said cooked$/.test(lines[1]),
         'each card says why its target moved: ' + JSON.stringify(lines));
  assert((await previewText()).includes('(Wayne '), 'the preview gives each of them their reps');
  // a favourite plays back with the same reps for each; swapped round, each keeps their own; a new mate gets the plain targets
  await st(() => { seekTo(0); render(); });
  await p.click('#btnSave');
  await p.click('#btnBack'); await p.click('#pathLibrary');
  await p.click('.workout-card:has-text("☆")');
  assert((await reps()).seq === lv.seq, 'the favourite replays the same moves and the same reps for each person');
  // Wayne has moved up since it was saved: Shuffle builds at today's levels, not the favourite's
  const shuffled = await st(() => {
    state.levels.wayne = { k: 1.3, easy: 0 };
    document.getElementById('btnShuffle').click();
    const got = { seed: state.workout.seed, scales: JSON.stringify(state.workout.request.repScales), a: personScale(state.workout, 'a'),
                  style: state.workout.request.intervalId };
    state.levels.wayne = { k: 1.1, easy: 0 };
    return got;
  });
  assert(shuffled.seed !== lv.seed && shuffled.scales === '{"wayne":1.3,"dave":0.9}' && shuffled.a === 1.3 && shuffled.style === 'emom',
         "Shuffle after a favourite builds at each person's level now, the rest of the request as it was: " + JSON.stringify(shuffled));
  await p.click('#btnBack');
  await p.click('#pathBuild'); await p.fill('#nameA', 'Dave'); await p.fill('#nameB', 'Sam'); await p.click('#btnSetupBack');
  await p.click('#pathLibrary'); await p.click('.workout-card:has-text("☆")');
  assert(await st(() => personScale(state.workout, 'a') === 0.9 && personScale(state.workout, 'b') === undefined),
         "with Dave in Wayne's spot he keeps his own level, and Sam, new, gets the plain targets");
  // a link carries the levels by name: on the other device they reach those people only, and its own levels stay out of it
  const linked = await st(() => {
    state.nameA = 'Wayne'; state.nameB = 'Dave';
    const named = sharePayload(state.workout).request.repScales;
    state.nameA = 'Dave'; state.nameB = ''; state.levels['#b'] = { k: 1.3, easy: 0 }; state.levels.dave = { k: 0.7, easy: 0 };
    openSharedLink('#w=' + encodeShare(JSON.stringify(sharePayload({ ...state.workout, repScales: { wayne: 1.1, dave: 0.9 } }))));
    const got = { named: JSON.stringify(named), a: personScale(state.workout, 'a'), b: personScale(state.workout, 'b'), req: JSON.stringify(state.workout.request.repScales) };
    delete state.levels['#b']; state.levels.dave = { k: 0.9, easy: 0 };
    const spot = sharePayload({ ...state.workout, repScales: { '#a': 1.2 }, request: { ...state.workout.request, repScales: { '#a': 1.2 } } }).request;
    got.spot = 'repScales' in spot;
    return got;
  });
  assert(linked.named === '{"wayne":1.1,"dave":0.9}' && linked.a === 0.9 && linked.b === undefined && linked.req === '{"wayne":1.1,"dave":0.9}' && !linked.spot,
         "a link keeps each named person's level, gives it to that person on the other device, adds none of its own, and leaves levels by spot behind: " + JSON.stringify(linked));
  // tidy up: the favourite saved here gone, no names, short bursts, a workout going
  await st(() => { state.saved.shift(); savePrefs(); });
  await p.click('#btnBack');
  await p.click('#pathBuild'); await p.fill('#nameA', ''); await p.fill('#nameB', '');
  await p.click('.interval-card:has-text("Short bursts")');
  await p.click('#btnBuild'); await p.click('#btnStart');
  ok("finish: the minutes, the blocks and any skipped; How was that? once each, kept with the session and taken back with a second tap; two Too easy raise Wayne's EMOM reps above Dave's on the same moves, said on the card; favourites, swaps, new mates and links keep each person's own reps");

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
  // (to the pixel: at the very end of the page a fraction of one can sit past the edge)
  assert(refused.top >= 0 && refused.bottom < refused.h + 1 && refused.gap >= 0 && refused.gap < 60,
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
  const surfWarm = await st(() => state.sequence.filter(x => x.kind === 'warmup').map(x => ({ id: x.a.id, name: x.name, img: x.a.img })));
  assert(surfWarm.some(x => x.id === 'popUp') && surfWarm[surfWarm.length - 1].id === 'popUp', 'the warm-up ends on a slow pop-up: ' + surfWarm.map(x => x.name).join(' | '));
  assert(await st((ws) => ws.some(x => (EXERCISES[x.id].surf || []).includes('shoulders')), surfWarm), 'with shoulder prep before it');
  assert(surfWarm.length < 3 || surfWarm.some(x => x.id === 'thoracicRotation'), 'and the upper back turning');
  assert(surfWarm.every(x => x.img), 'each with its figure');
  await p.click('#btnBack');
  assert((await p.$eval('#todayCard .today-style', e => e.textContent)).includes('Short bursts · Surf fitness'), 'the home card says the goal');
  await p.click('#pathBuild');
  await p.click('#goalPicker .chip:has-text("General fitness")');
  assert(await p.$eval('#rowRegions', e => e.style.display !== 'none'), 'target areas come back');
  await p.click('#btnBuild');
  ok(`Surf fitness: ${surfIds.length} surf exercises, pop-ups included, a warm-up of shoulder prep and a slow pop-up; target areas return for general fitness`);

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
  assert((await p.$eval('#todayCard .day-timing', e => e.textContent)) === '30s on, 30s off this week', "the day card says this week's split");
  assert((await p.$eval('#pathProgramGo', e => e.textContent)) === 'Surf Fit · Week 1 of 6 →', 'the Programs card says where you are up to');
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
  // the timed days build too: week 1's long efforts are 30s on, 30s off, week 5's 45s on, 15s off, every block still 4 minutes
  const split = () => st(() => {
    const work = state.sequence.filter(x => x.kind === 'work'), rest = state.sequence.filter(x => x.kind === 'rest');
    const perBlock = {};
    state.sequence.filter(x => x.kind === 'work' || x.kind === 'rest').forEach(x => { perBlock[x.blockIdx] = (perBlock[x.blockIdx] || 0) + x.duration; });
    return { work: [...new Set(work.map(x => x.duration))].join(), rest: [...new Set(rest.map(x => x.duration))].join(),
             blocks: Object.values(perBlock), request: JSON.stringify(state.workout.request.workRest),
             preview: document.getElementById('previewList').textContent, blurb: state.workout.blurb };
  });
  const wk1 = await split();
  assert(wk1.work === '30' && wk1.rest === '30' && wk1.blocks.every(t => t === 240) && wk1.request === '{"long":[30,30]}',
         'Surf Fit week 1: long efforts at 30s on, 30s off, in four-minute blocks: ' + JSON.stringify(wk1));
  assert(wk1.preview.includes('Long efforts, 4 × 30s') && wk1.blurb.includes('30s work · 30s rest'), 'and the preview and blurb say so: ' + wk1.blurb);
  await st(() => { state.programMinutes = 15; startProgramDay(PROGRAMS[0], programDay(PROGRAMS[0], 28)); });
  const wk5 = await split();
  assert(wk5.work === '45' && wk5.rest === '15' && wk5.blocks.every(t => t === 240) && wk5.request === '{"long":[45,15]}',
         'week 5 (day 29): 45s on, 15s off: ' + JSON.stringify(wk5));
  await st(() => { state.programMinutes = 15; startProgramDay(PROGRAMS[0], programDay(PROGRAMS[0], 8)); });
  const wk2pop = await split();
  assert(wk2pop.work === '20' && wk2pop.rest === '10' && wk2pop.request === '{"short":[20,10]}', 'and week 2 Pop-ups & legs 20s on, 10s off: ' + JSON.stringify(wk2pop));
  await st(() => { state.programMinutes = 15; startProgramDay(PROGRAMS[0], programDay(PROGRAMS[0], 0)); });
  assert((await p.$eval('#workoutTitle', e => e.textContent)) === 'Paddle power', "the workout goes by the day's name, as on home and in history");
  // skipping through without ever pressing Start doesn't count as the day done
  const skipToEnd = async () => { while (await st(() => !isFinished())) await p.click('#btnSkip'); };
  await skipToEnd();
  assert(await st(() => state.programs['surf-fit'].done.length === 0 && !state.history.some(h => h.completed && h.key === historyKey(state.workout))),
         'skipping to the end without Start ticks nothing off');
  // nor does a stray Start, then Reset back to the top, then skipping through
  await p.click('#btnAgain'); await p.click('#btnReset'); await p.click('#btnReset');
  assert(await st(() => !state.running && state.currentIdx === 0 && !state.started), 'a reset goes back to the top, not started');
  await skipToEnd();
  assert(await st(() => state.programs['surf-fit'].done.length === 0 && !state.history.some(h => h.completed && h.key === historyKey(state.workout))),
         'Start, then Reset, then skipping to the end ticks nothing off either');
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
  // what was done: skipped straight through after Start, next to nothing, and the program day ticked off
  const summary = await st(() => ({ total: document.getElementById('totalTime').textContent, top: document.getElementById('blockName').textContent,
    want: `Total ${fmt(Math.round(timeDone()))} / ${fmt(state.totalDuration)}`, n: state.workout.blocks.length,
    lines: [...document.querySelectorAll('#roundDots .finish-line')].map(e => e.textContent) }));
  assert(summary.total === summary.want && summary.total.startsWith('Total 0:0'), 'the finish clock says how much of it ran, not the whole: ' + JSON.stringify(summary));
  assert(summary.top === 'Ended early, day ticked off' && summary.lines[0] === `Under a minute done · 0 of ${summary.n} blocks, ${summary.n} skipped`
         && summary.lines[1] === 'Day 1 of 42 done. Next: Pop-ups & legs', 'and the summary says it ended early, the minutes, the blocks skipped and the next day: ' + JSON.stringify(summary));
  assert(await st(() => !document.querySelector('.feel-ask') && document.getElementById('workoutView').classList.contains('unstarted')),
         "with next to nothing done, nobody is asked how it was, so a tap can't move their level");
  await p.click('#timerCard');
  assert(await st(() => !state.running && isFinished()), 'a tap on the finished timer does nothing');
  await p.click('#btnStart');
  assert(await activeView() === 'programView', 'Done goes back to the program');
  const after = await p.$eval('#programBody', e => e.textContent);
  assert(after.includes("Today's done") && after.includes('Pop-ups & legs'), 'day 1 ticked, day 2 next');
  assert((await p.$eval('.program-dot.now i', e => e.textContent)) === 'Next', "with today's done, the next day in the strip says Next, not Today");
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
  // Undo only ever takes back today's surf: not one from another day
  await p.click('.program-today button:has-text("I surfed today")');
  await st(() => { const d = state.programs['surf-fit'].done; d[d.length - 1].at -= 86400000; savePrefs(); });
  await p.click('#programNote .link-btn:text-is("Undo")');
  assert(await st(() => state.programs['surf-fit'].done.length === 4 && state.programs['surf-fit'].done[3].surfed),
         'Undo leaves a surf from yesterday alone');
  await st(() => { state.programs['surf-fit'].done.pop(); savePrefs(); renderProgram(); });
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
  // in history it's stretching, not whichever style was last picked in setup
  await p.click('#btnStart');
  assert(await st(() => state.history[0].workoutId === 'sunrise-stretch' && state.history[0].intervalId === 'stretch'), 'logged as a stretch');
  await leaveStarted();
  await p.click('#pathLibrary');
  const stretchMeta = await p.$eval('.history-card .card-meta', e => e.textContent.replace(/\s+/g, ' ').trim());
  assert(stretchMeta.endsWith('· Stretching'), 'the history card says Stretching: ' + stretchMeta);
  await st(() => { state.history[0].intervalId = 'short'; renderLibrary(); });     // as the version before logged it
  assert((await p.$eval('.history-card .card-meta', e => e.textContent)).includes('Stretching'), 'older entries too');
  await p.click('#btnLibraryBack');
  await p.click('#pathLibrary');
  await p.click(card('Sunrise Stretch'));
  ok('stretch routine opens, naming the next stretch, and history calls it Stretching');

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
  assert(await p.$eval('#workoutNote', e => getComputedStyle(e).overflowWrap === 'anywhere' && getComputedStyle(e).wordBreak !== 'break-all'),
         'the note wraps between words (and a bare link anywhere)');
  await st(() => finish());
  await p.click('#btnAgain');
  assert(await p.$eval('#workoutNote', e => e.textContent) === '', 'Start over clears the note');
  await p.click('#btnReset'); await p.click('#btnReset');
  // an iPad in landscape, two people, demos on: a work phase runs past the
  // bottom of the screen, and Pause, Skip and Reset stay on it
  await st(() => { seekTo(state.sequence.findIndex(x => x.kind === 'work')); render(); });
  const ipadBar = await st(() => ({ long: els.scroller.scrollHeight > els.scroller.clientHeight + 100,
    on: ['btnStart', 'btnSkip', 'btnReset'].every(id => { const b = document.getElementById(id).getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }) }));
  assert(ipadBar.long && ipadBar.on, 'iPad landscape: the controls stay on screen through a long work phase: ' + JSON.stringify(ipadBar));
  await st(() => resetWorkout());
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
  // this device is bodyweight only now; passing the link on still sends the sender's workout
  assert(await p.evaluate((ids) => ids.split(',').some(id => EXERCISES[id].equipment.length), sharedIds), 'the shared workout uses some gear');
  await q.goto(shareUrl);
  const fwdUrl = await q.evaluate(() => shareUrlFor(state.workout));
  assert(await q.evaluate(() => !Object.values(effectiveEquip()).some(Boolean)), 'the forwarding device has no gear');
  const third = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const c = await third.newPage();
  c.on('pageerror', e => errors.push('third device: ' + e));
  await c.goto(fwdUrl);
  assert(await c.evaluate(() => state.workout.exerciseIds.join(',')) === sharedIds, 'a link passed on opens the same movements as the first one');
  await third.close();
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
  // A tab still on the version before this one hears nothing, so it writes
  // the copy it opened with: what this tab did since is added back, not lost.
  const newest = await st(() => state.history[0].key);
  await listenFor(p, null);
  await tab2.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    delete prefs.schema; delete prefs.beepOnSilent; delete prefs.todayOther; delete prefs.sound; delete prefs.voice;
    prefs.history = prefs.history.slice(1);           // opened before the newest session
    prefs.saved = prefs.saved.slice(1);
    localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
  });
  await heard(p);
  const merged = await st(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    return { first: prefs.history[0].key, n: prefs.history.length, mem: state.history.length, saved: prefs.saved.length === state.saved.length,
             beep: 'beepOnSilent' in prefs && 'sound' in prefs && 'voice' in prefs, dupes: new Set(prefs.history.map(h => h.key + h.at)).size !== prefs.history.length };
  });
  assert(merged.first === newest && merged.n === merged.mem && merged.saved && merged.beep && !merged.dupes,
         "an older tab's stale save is merged in and written back with this tab's sessions and settings: " + JSON.stringify(merged));
  // a level set in the other tab (a finish screen there) comes across with the history
  await tab2.evaluate(() => { state.levels.tabtwo = { k: 1.2, easy: 0 }; savePrefs(); });
  await p.waitForFunction(() => state.levels.tabtwo && state.levels.tabtwo.k === 1.2, null, { timeout: 5000 });
  await st(() => { delete state.levels.tabtwo; savePrefs(); });
  // a tab still on the last release (schema 2, no levels) saving leaves this tab's levels as they are,
  // and its lists are taken as they are: it hears this tab, so they're as new as anyone's
  const old2 = await st(() => {
    state.levels.keepme = { k: 0.8, easy: 0 };
    const h = state.history[0];
    h.completed = false; delete h.scores;
    savePrefs();
    return { key: h.key, saved: state.saved.map(x => x.seed), fav: state.saved[0] };
  });
  assert(old2.saved.length >= 1, 'a favourite to take out: ' + old2.saved);
  // there, the session runs to the end with 2 rounds logged in block 1, and a favourite is taken out
  await listenFor(p, 2);
  await tab2.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    prefs.schema = 2; delete prefs.levels;
    Object.assign(prefs.history[0], { completed: true, scores: [{ a: 2, b: 0, t: 'amrap' }, { a: 0, b: 0, t: 'amrap' }] });
    prefs.saved = prefs.saved.slice(1);
    localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
  });
  await heard(p);
  const lv2 = await st(() => ({ mem: JSON.stringify(state.levels.keepme), stored: JSON.stringify((JSON.parse(localStorage.getItem('fit-prefs-2')).levels || {}).keepme) }));
  assert(lv2.mem === '{"k":0.8,"easy":0}' && lv2.stored === lv2.mem, "a save from a tab on the last release leaves the levels here, and they're written back: " + JSON.stringify(lv2));
  const took = await st((k) => {
    const stored = JSON.parse(localStorage.getItem('fit-prefs-2'));
    const pick = (list) => { const h = list.find(x => x.key === k); return h && `${h.completed}:${h.scores ? h.scores[0].a : '-'}`; };
    return { mem: pick(state.history), stored: pick(stored.history), saved: state.saved.map(x => x.seed).join(), storedSaved: stored.saved.map(x => x.seed).join() };
  }, old2.key);
  assert(took.mem === 'true:2' && took.stored === 'true:2', "the session it finished stays finished, with its 2 rounds, here and in storage: " + JSON.stringify(took));
  assert(took.saved === old2.saved.slice(1).join() && took.storedSaved === took.saved, 'and the favourite it took out stays out: ' + JSON.stringify(took));
  // (and back as it was, for the steps after)
  await st((fav) => { delete state.levels.keepme; state.saved.unshift(fav); savePrefs(); }, old2.fav);
  await tab2.close();
  // A tab on the last release saving once this release's tab has closed:
  // nothing is open to write the levels back, so the next tab to open has
  // to find them.
  {
    const two = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const watch = (pg, who) => {
      pg.on('pageerror', e => errors.push(`${who}: ${e}`));
      pg.on('console', m => { if (m.type() === 'error') errors.push(`${who}: ${m.text()}`); });
    };
    // the old tab, open from before: a page that saves as the last release does
    const old = await two.newPage(); watch(old, 'old tab');
    await old.goto(URL + 'e2e-blank.html');
    await old.evaluate(() => localStorage.setItem('fit-prefs-2', JSON.stringify({ schema: 2, gearAsked: true, people: 2, nameA: 'Wayne', nameB: 'Dave' })));
    // this release opens beside it, and Wayne finds a session too easy
    const fresh = await two.newPage(); watch(fresh, 'new tab');
    await fresh.goto(URL);
    await fresh.click('#todayCard .today-go'); await fresh.click('#btnStart');
    await fresh.evaluate(() => new Promise(done => {
      state.elapsedAtResume = state.totalDuration - 0.3; state.runStartWall = Date.now();
      const t = setInterval(() => { if (isFinished()) { clearInterval(t); done(); } }, 50);
    }));
    await fresh.click('#finishA .feel-chip[data-feel="easy"]');
    const lv = await fresh.evaluate(() => ({ mem: JSON.stringify(state.levels), own: localStorage.getItem('fit-levels-1') }));
    assert(lv.mem === '{"wayne":{"k":1,"easy":1}}' && lv.own === lv.mem, 'the levels are kept under their own key too: ' + JSON.stringify(lv));
    await fresh.close();
    // then the old tab saves what it heard, with a session it finished, and no levels
    await old.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
      prefs.schema = 2; delete prefs.levels;
      prefs.history.unshift({ key: 'id:quick-spark', name: 'Quick Spark', at: Date.now(), people: 2, intervalId: 'short',
                              generated: false, workoutId: 'quick-spark', minutes: 13, completed: true });
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
    });
    const next = await two.newPage(); watch(next, 'next tab');
    await next.goto(URL);
    const back = await next.evaluate(() => ({ levels: JSON.stringify(state.levels), history: state.history.length, first: state.history[0].key }));
    assert(back.levels === lv.mem && back.history === 2 && back.first === 'id:quick-spark',
           "a tab opened after still has the levels, beside the old tab's session: " + JSON.stringify(back));
    await next.click('#todayCard .time-chips .chip:text-is("25 min")');
    assert(await next.evaluate((m) => JSON.stringify(JSON.parse(localStorage.getItem('fit-prefs-2')).levels) === m, lv.mem),
           'and they are back in the prefs at its next save');
    await two.close();
  }
  ok('two tabs: each takes in the other\'s history as it saves, so neither writes over the other; a stale save from a tab on the older version is merged, not taken, and leaves the levels, even with no tab of this release open');

  step = 'your data: a backup file, a copy for another device, and a restore that asks first';
  {
    await p.click('#pathLibrary');
    const sections = await p.$$eval('#librarySections > *', els => els.map(e => e.id || e.className));
    assert(sections[sections.length - 1] === 'yourData', 'Your data is the last thing in Saved & ready-made: ' + sections);
    assert((await p.$eval('#yourData', e => e.textContent)).includes('home-screen app and Safari keep separate data'), 'it says why it is there');
    // a dated file of everything
    const [download] = await Promise.all([p.waitForEvent('download'), p.click('#btnBackup')]);
    assert(/^FIT backup \d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), 'a dated backup file: ' + download.suggestedFilename());
    const fileText = fs.readFileSync(await download.path(), 'utf8');
    const backup = JSON.parse(fileText);
    const mine = await st(() => ({ keys: PERSISTED, history: state.history.length, saved: state.saved.length,
                                   places: state.gearSets.map(g => g.name).join('|'), summary: dataSummary(state),
                                   levels: JSON.stringify(state.levels) }));
    assert(mine.keys.includes('levels') && JSON.stringify(backup.prefs.levels) === mine.levels && mine.levels.includes('"wayne"'),
           "the file holds each person's level too: " + JSON.stringify(backup.prefs.levels));
    assert(backup.kind === 'fit-backup' && mine.keys.every(k => k in backup.prefs) && backup.prefs.history.length === mine.history
           && backup.prefs.saved.length === mine.saved && mine.history > 0,
           `the file holds every setting, session and favourite: ${backup.prefs.history.length} of ${mine.history} sessions, ${backup.prefs.saved.length} of ${mine.saved} favourites`);
    assert((await p.$eval('#yourData .data-note', e => e.textContent)).includes('downloads'), 'and says where it went');
    // the same as text on the clipboard
    await p.click('#btnCopyData');
    await p.waitForFunction(() => document.querySelector('#yourData .data-note').textContent.startsWith('Copied'));
    const copied = await st(() => navigator.clipboard.readText());
    assert(JSON.parse(copied).prefs.history.length === mine.history, 'Copy to another device puts it all on the clipboard');
    assert((await p.$eval('#yourData .data-note', e => e.textContent)).includes('tap Restore and paste it in'), 'and says what to do on the other device');
    // no clipboard: a box to copy it from
    await st(() => { window.realWrite = navigator.clipboard.writeText; navigator.clipboard.writeText = () => Promise.reject(new Error('not allowed')); });
    await p.click('#btnCopyData');
    await p.waitForSelector('#yourData .data-copy');
    assert(JSON.parse(await p.$eval('#yourData .data-copy', e => e.value)).prefs.saved.length === mine.saved
           && (await p.$eval('#yourData .data-note', e => e.textContent)).includes('Copy all the text in the box'),
           'without a clipboard the text goes in a box to copy by hand');
    await st(() => { navigator.clipboard.writeText = window.realWrite; });

    // another device, or the iPhone's home-screen app, which starts empty
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const f = await phone.newPage();
    f.on('pageerror', e => errors.push('restore: ' + e));
    f.on('console', m => { if (m.type() === 'error') errors.push('restore: ' + m.text()); });
    await f.goto(URL);
    const view = () => f.evaluate(() => document.querySelector('.view.active').id);
    const said = () => f.$eval('#yourData .data-note', e => e.textContent);
    assert(await view() === 'gearView', 'a new device starts on the gear question');
    await f.click('#btnGearRestore');
    assert(await view() === 'libraryView' && await f.$eval('.restore-panel', e => !e.hidden), 'whose Restore link opens Saved & ready-made with Restore open');
    await f.fill('#restoreText', 'nope');
    await f.click('#btnRestoreText');
    assert((await said()).includes("isn't a FIT backup") && !(await f.$('#btnRestoreYes')), 'text that is not a backup is turned away');
    // what a message wraps round it, and entries that can't be used, are let go
    const spoilt = JSON.parse(copied);
    spoilt.prefs.history.push(null, { name: 'no key or time' });
    spoilt.prefs.saved.push({ name: 'no seed' });
    spoilt.prefs.people = 9;
    await f.fill('#restoreText', `Here's my FIT: ${JSON.stringify(spoilt)} cheers`);
    await f.click('#btnRestoreText');
    const found = await f.$eval('.restore-check', e => e.textContent);
    const replaces = await f.$eval('.restore-check .picker-hint', e => e.textContent);
    assert(found.includes(`This backup has ${mine.summary}, saved `) && replaces === 'Nothing is saved here yet.',
           'it says what it found, and that a new device has nothing to replace (not the Home it made for itself): ' + found);
    assert(/^\d+ sessions?, 2 favourites, \d places? \(Home[^)]*\) and Surf Fit (week \d|finished)$/.test(mine.summary),
           'sessions, favourites, places by name and where the program is up to: ' + mine.summary);
    await f.click('#btnRestoreNo');
    assert(await f.evaluate(() => state.history.length === 0 && !document.querySelector('#btnRestoreYes')), 'Cancel changes nothing');
    await f.click('#btnRestoreText');
    await f.click('#btnRestoreYes');
    const moved = await f.evaluate(() => ({ history: state.history.length, saved: state.saved.length, places: state.gearSets.map(g => g.name).join('|'),
      asked: state.gearAsked, name: document.getElementById('nameA').value === state.nameA, people: state.people, levels: JSON.stringify(state.levels) }));
    assert(moved.history === mine.history && moved.saved === mine.saved && moved.places === mine.places && moved.asked && moved.name && moved.people === 1,
           'Replace brings every session, favourite, place and setting across, checked: ' + JSON.stringify(moved));
    assert(moved.levels === mine.levels && await f.evaluate(() => localStorage.getItem('fit-levels-1')) === mine.levels,
           "and each person's level, under its own key too: " + moved.levels);
    assert((await said()).startsWith('Restored: ') && await f.$('#btnPutBack'), 'it says so, and offers Put it back');
    const box = (sel) => f.$eval(sel, e => { const b = e.getBoundingClientRect(); return [b.top, b.bottom, innerHeight]; });
    const onScreen = async (sel) => { const [top, bottom, ih] = await box(sel); return top >= 0 && bottom <= ih && bottom > top; };
    assert(await onScreen('#yourData .data-note') && await onScreen('#btnPutBack'),
           'where it can be seen, with Put back, though the sessions and favourites above it moved it down the page: '
           + JSON.stringify([await box('#yourData .data-note'), await box('#btnPutBack')]));
    assert(await f.$$eval('.workout-card:has-text("☆")', els => els.length) === mine.saved, 'the favourites are on the page');
    await (await f.$$('.workout-card:has-text("☆")'))[1].click();
    assert(await f.evaluate(() => state.workout.exerciseIds.join(',')) === idsA, 'favourite A opens on the other device with the same moves');
    await f.click('#btnBack');
    assert(await view() === 'welcomeView', 'and the gear question has been answered');
    // Put it back undoes it, until the next restore
    await f.reload();
    await f.click('#pathLibrary');
    await f.click('#btnPutBack');
    assert((await f.$eval('.restore-check', e => e.textContent)).includes('Put back what was here before the restore: no sessions'), 'Put it back says what it puts back');
    await f.click('#btnRestoreYes');
    assert(await f.evaluate(() => state.history.length === 0 && !localStorage.getItem('fit-prefs-2-before-restore')
                                  && JSON.stringify(state.levels) === '{}' && localStorage.getItem('fit-levels-1') === '{}'),
           'Put it back puts back what was there, levels too');
    assert(!(await f.$('#btnPutBack')) && (await said()).startsWith('Put back: '), 'and is used up');
    assert(await onScreen('#yourData .data-note'), 'saying so on screen');
    assert(await f.$eval('#restoreFile', e => e.accept) === '.json,application/json,text/plain', 'the file picker asks for the backup, so an iPhone opens Files, not Photos');
    // from a file, the same way
    await f.click('#btnRestore');
    await f.setInputFiles('#restoreFile', { name: 'FIT backup.json', mimeType: 'application/json', buffer: Buffer.from(fileText) });
    await f.waitForSelector('#btnRestoreYes');
    assert((await f.$eval('.restore-check', e => e.textContent)).includes(`This backup has ${mine.summary}`), 'a chosen backup file is read the same way');
    await f.click('#btnRestoreYes');
    assert(await f.evaluate((n) => state.history.length === n, mine.history), 'and restored');
    await phone.close();
  }
  ok('Your data: a dated backup file, the same on the clipboard (or in a box without one), and a restore by file or paste from the first-visit question that says what it found, asks, cleans what it takes, and can be put back');

  step = 'corrupt preferences fall back, favourites persist';
  await st(() => {
    const prefs = JSON.parse(localStorage.getItem('fit-prefs-2'));
    prefs.people = 7; prefs.minutes = 13; prefs.textScale = 'big'; prefs.blockedTags = 'nope';
    prefs.history.push(null, 'junk'); prefs.saved.push({ name: 'no seed' }); prefs.filterFocus = 'nowhere'; prefs.muteAudio = 'yes'; prefs.sound = 'loud'; prefs.voice = 'maybe';
    prefs.levels = { ...prefs.levels, huge: { k: 5 }, odd: 'x', '': { k: 1.1 }, kept: { k: 1.2, easy: 1 } };
    prefs.history[0].feel = { a: 'meh', b: 'cooked' };
    if (prefs.history[1]) prefs.history[1].feel = 'nope';
    localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
  });
  await p.goto(URL);
  const junk = await st(() => ({ levels: state.levels, feel: [state.history[0].feel, state.history[1] && state.history[1].feel] }));
  assert(JSON.stringify(junk.levels.kept) === '{"k":1.2,"easy":1}' && !junk.levels.huge && !junk.levels.odd && !('' in junk.levels) && junk.levels.wayne,
         'levels out of range or the wrong shape are dropped, the rest kept: ' + JSON.stringify(junk.levels));
  assert(JSON.stringify(junk.feel[0]) === '{"b":"cooked"}' && junk.feel[1] === undefined, 'and so are answers that are not one of the three: ' + JSON.stringify(junk.feel));
  assert(await st(() => state.people === 1 && state.minutes === 20 && state.textScale === 1 && Array.isArray(state.blockedTags)),
         'junk preference values fell back to defaults (one person)');
  assert(await st(() => state.saved.length === 2), 'saved favourites survived the reload');
  assert(await st(() => state.history.every(h => h && typeof h.key === 'string') && state.filterFocus === 'all' && state.muteAudio === false
                        && SOUNDS.includes(state.sound) && state.sound !== 'off' && state.voice === true),
         'sessions and favourites that cannot be used are dropped, and an unknown focus or a switch that is not on or off goes back to its default');
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
  const bar = await st(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const ids = ['btnStart', 'btnSkip', 'btnReset'];
    return { row: new Set(ids.map(id => Math.round(r(id).top))).size === 1,
             fits: ids.every(id => document.getElementById(id).scrollWidth <= document.getElementById(id).clientWidth),
             top: Math.round(document.querySelector('.controls').getBoundingClientRect().top), b: Math.round(r('personB').top) };
  });
  assert(bar.row && bar.fits && bar.b < bar.top, "Pause, Skip block and Reset share one row, and the second person's card starts above it: " + JSON.stringify(bar));
  assert(await st(() => document.body.classList.contains('can-scroll') && getComputedStyle(document.getElementById('scrollHint')).display === 'none'),
         'the page scrolls, but no bottom fade sits over the controls');
  const titleWas = await p.$eval('#workoutTitle', e => e.getBoundingClientRect().width);
  await p.click('#btnBack');
  const titleNow = await p.$eval('#workoutTitle', e => e.getBoundingClientRect().width);
  assert(titleNow >= titleWas - 20, `the first tap on Menu leaves the title its room (${Math.round(titleWas)}px, then ${Math.round(titleNow)}px)`);
  await st(() => disarmBack());
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
  // every file sw.js lists, in a cache named for its release
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swList = (name) => [...swSrc.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const expected = swList('SHELL').length + swList('MOVE_3D').length;
  const cacheFor = (version) => `${version}-${swSrc.match(/const FILES_HASH = '([0-9a-f]+)'/)[1]}`;
  const baseCache = cacheFor(swSrc.match(/const VERSION = '([^']+)'/)[1]);
  await p.goto(URL);
  await st(() => navigator.serviceWorker.ready);
  await p.waitForFunction(async (n) => {
    const keys = await caches.keys();
    return keys.length === 1 && (await (await caches.open(keys[0])).keys()).length === n;
  }, expected, { timeout: 60000 });
  assert((await st(() => caches.keys())).join() === baseCache, `one cache, named for the release: ${baseCache}`);
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
  await p.click('#btnBack');
  ok(`opens, builds and shows the 3D figures offline from a ${expected}-file cache`);

  step = 'on one bar of signal it opens from the offline copy at once';
  {
    serve.delayMs = 6000;            // every file takes six seconds to come
    const t0 = Date.now();
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#todayCard .today-go', { state: 'visible' });
    const homeMs = Date.now() - t0;
    await p.waitForFunction(() => window.FitDeck && window.FitDeck.available);
    const deckMs = Date.now() - t0;
    serve.delayMs = 0;
    // the browser's look for a new sw.js, still out on the slow network, is let finish
    await st(() => navigator.serviceWorker.getRegistration().then(reg => reg.update()));
    // well inside the six seconds anything from the network would take
    assert(homeMs < 2500 && deckMs < 4000, `home in ${homeMs}ms and the 3D figures ready in ${deckMs}ms, not after the network`);
    note(`with a 6s network: home in ${homeMs}ms, figures ready in ${deckMs}ms`);
    ok('a slow network does not hold up opening');
  }

  step = 'a new release waits for a tap, and never runs beside the old one';
  // the browser looks for a new sw.js each time the page loads
  const updateShows = () => p.waitForFunction(() => getComputedStyle(document.getElementById('updateBar')).display !== 'none',
                                              null, { timeout: 30000 });
  {
    // which release the page came from, and which its script did
    const release = (pg = p) => pg.evaluate(() => [(document.querySelector('meta[name="fit-release"]') || {}).content || 'base', window.FIT_RELEASE || 'base'].join());
    const bar = (pg = p) => pg.$eval('#updateBar', e => getComputedStyle(e).display !== 'none' && e.textContent);
    serve.next = 'n1';
    await p.reload();
    assert(await release() === 'base,base', 'the next load is still the release it has');
    await updateShows();
    const shown = await bar();
    assert(shown === 'New version ready, tap to update', 'once the new one is in, it says so: ' + JSON.stringify(shown));
    assert((await st(() => caches.keys())).sort().join() === [baseCache, cacheFor('fit-n1')].sort().join(), 'each release in its own cache');
    await p.reload();
    assert(await release() === 'base,base', 'a reload before the tap is still the old release, page and scripts');
    await p.waitForFunction(() => getComputedStyle(document.getElementById('updateBar')).display !== 'none');
    await p.click('#todayCard .today-go');
    assert(await bar() === false, 'not shown over a workout');
    await p.click('#btnBack');
    // another tab, mid-workout when the tap comes
    const tab = await context.newPage();
    tab.on('pageerror', e => errors.push('update tab: ' + e));
    tab.on('console', m => { if (m.type() === 'error') errors.push('update tab: ' + m.text()); });
    await tab.goto(URL);
    await tab.click('#todayCard .today-go'); await tab.click('#btnStart');
    await Promise.all([p.waitForEvent('load'), p.click('#updateBar')]);
    await p.waitForFunction(() => window.FIT_RELEASE === 'n1');
    assert(await release() === 'n1,n1', 'the tap loads the new release, page and scripts');
    assert(await bar() === false, 'and the line goes');
    assert((await st(() => caches.keys())).join() === cacheFor('fit-n1'), 'and the old copy is gone');
    assert(await release(tab) === 'base,base' && await tab.evaluate(() => state.view === 'workout' && state.running),
           "the other tab's workout carries on, untouched");
    await Promise.all([tab.waitForEvent('load'), leaveStarted(tab)]);
    await tab.waitForFunction(() => window.FIT_RELEASE === 'n1');
    assert(await release(tab) === 'n1,n1', 'and loads the new release once it leaves the workout');
    await tab.close();
    await context.setOffline(true);
    await p.reload();
    assert(await release() === 'n1,n1' && await p.$('#todayCard .today-go'), 'the new release opens offline');
    await context.setOffline(false);
    serve.next = null;
    ok('a new release installs in the background, says "New version ready", and loads whole on the tap; never over a workout, never a page from one release with scripts from another');
  }

  step = 'a first visit whose scripts do not match loads again from the offline copy';
  {
    // the HTTP cache, say, handing over one script from the last release
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const f = await fresh.newPage();
    const broken = [];
    f.on('pageerror', e => broken.push(String(e)));
    f.on('console', m => { if (m.type() === 'error') broken.push(m.text()); });
    serve.breakOnce = '/js/generator.js';
    await f.goto(URL);
    // the offline copy installs, takes over, and the page loads again from it
    await f.waitForFunction(() => !!navigator.serviceWorker.controller && document.getElementById('onboardGear').children.length > 0,
                            null, { timeout: 30000 });
    assert(broken.some(e => e.includes('from another release')), 'the first load failed as it should: ' + broken.join(' | '));
    const failedLoads = broken.length;
    await f.click('#btnGearDone');
    await f.click('#todayCard .today-go');
    assert(await f.evaluate(() => document.querySelector('.view.active').id) === 'workoutView' && broken.length === failedLoads,
           'and works, with nothing more going wrong: ' + broken.slice(failedLoads).join(' | '));
    await fresh.close();
    ok('a first visit whose scripts fail loads again, once, from the offline copy as it takes over');
  }

  // A phone on the last release, with Wayne's data as that release kept it:
  // what it stored, and (on the page) what it all comes to.
  const onLastRelease = async (u) => {
    await u.context().addCookies([{ name: 'e2e', value: 'previous', url: URL }]);
    serve.previous = true;
    await u.goto(URL + 'e2e-blank.html');
    await u.evaluate(() => navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready));
    await u.waitForFunction(async () => !!(await (await caches.open('fit-previous')).match('/')) && !!navigator.serviceWorker.controller,
                            null, { timeout: 30000 });
    const kept = await u.evaluate(() => {
      const day = 86400e3, now = Date.now();
      const prefs = { schema: 2, gearAsked: true, people: 2, nameA: 'Wayne', nameB: 'Dave', minutes: 25,
        gearSets: [{ id: 'home', name: 'Home', equipment: { kettlebells: true }, weights: { kb: [12, 16], db: [], bar: 10 } },
                   { id: 'set-dave', name: "Dave's place", equipment: { kettlebells: false }, weights: { kb: [], db: [], bar: 10 } }],
        gearSetId: 'home',
        programs: { 'surf-fit': { startedAt: now - 12 * day, done: [...Array(11)].map((_, n) => ({ n, at: now - (12 - n) * day })) } },
        saved: [{ name: 'Full Body · 20 min', blurb: '', focus: 'whole-body', seed: 4711, savedOn: '1/9/2026',
                  request: { minutes: 20, people: 1, intervalId: 'short', regions: ['push', 'pull', 'core', 'legs', 'cardio'], blockedTags: [] } }],
        history: [...Array(31)].map((_, i) => ({ key: `id:quick-spark-${i}`, name: 'Quick Spark', at: now - (i + 1) * day, people: 1,
                                                 intervalId: 'short', generated: false, workoutId: 'quick-spark', minutes: 13, completed: true })) };
      localStorage.setItem('fit-prefs-2', JSON.stringify(prefs));
      return localStorage.getItem('fit-prefs-2');
    });
    serve.previous = false;
    return kept;
  };
  const wayneKept = (u) => u.evaluate(async () => ({ history: state.history.length, saved: state.saved.length, places: state.gearSets.map(g => g.name).join(),
    days: state.programs['surf-fit'].done.length, name: state.nameA, program: !!document.querySelector('#todayCard .program-go'),
    stored: JSON.parse(localStorage.getItem('fit-prefs-2')).history.length, caches: (await caches.keys()).join() }));
  const allKept = (after) => after.history === 31 && after.saved === 1 && after.places === "Home,Dave's place" && after.days === 11
    && after.name === 'Wayne' && after.program && after.stored === 31;

  step = 'the first open of this release on one bar, through the last one, loses nothing and loads again whole';
  {
    const up = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const u = await up.newPage();
    const seen = [];
    u.on('pageerror', e => seen.push(String(e)));
    u.on('console', m => { if (m.type() === 'error') seen.push(m.text()); });
    const kept = await onLastRelease(u);
    // this release goes up, and the page takes eight seconds to come: the
    // old worker hands over its old page at four, beside this release's scripts
    serve.pageDelayMs = 8000;
    await u.goto(URL, { waitUntil: 'domcontentloaded' });
    const broke = await u.evaluate(() => !document.getElementById('btnGearRestore'));
    assert(broke && seen.some(e => e.includes('addEventListener')), 'the old page with the new scripts fails as it loads: ' + seen.join(' | '));
    // a tap on the half-started page saves nothing over what's kept
    await u.evaluate(() => document.getElementById('pathLibrary').click());
    assert(await u.evaluate(() => localStorage.getItem('fit-prefs-2')) === kept, "a tap on the broken page leaves the data as it was");
    // the new release installs, takes over and loads the page again, whole
    await u.waitForFunction(() => !!document.getElementById('btnGearRestore') && typeof state === 'object' && state.view === 'welcome',
                            null, { timeout: 40000 });
    serve.pageDelayMs = 0;
    const after = await wayneKept(u);
    assert(allKept(after), 'everything is still there, and home has his program day: ' + JSON.stringify(after));
    assert(!after.caches.includes('fit-previous'), 'running from this release now: ' + after.caches);
    await up.close();
    ok("the first open of this release through the last one's worker on a slow page: nothing saved over the data, and it loads again whole");
  }

  step = "the first open of this release with the last one's workouts.js: it loads again whole, once, and Start works";
  {
    const up = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const u = await up.newPage();
    const seen = [];
    u.on('pageerror', e => seen.push(String(e)));
    u.on('console', m => { if (m.type() === 'error') seen.push(m.text()); });
    let loads = 0;
    u.on('load', () => { loads++; });
    const kept = await onLastRelease(u);
    loads = 0;
    // this release goes up, and workouts.js takes eight seconds to come: the
    // old worker hands over its old copy at four, beside this release's app.js,
    // which loads without an error of its own
    serve.slow['/js/workouts.js'] = 8000;
    await u.goto(URL, { waitUntil: 'domcontentloaded' });
    const mixed = await u.evaluate(() => [typeof WORKOUTS_RELEASE === 'string' ? WORKOUTS_RELEASE : 'none', RELEASE]);
    assert(mixed[0] !== mixed[1], "the first load has the last release's workouts.js beside this release's app.js: " + mixed);
    await u.evaluate(() => document.querySelector('#todayCard button') && document.querySelector('#todayCard button').click());
    assert(await u.evaluate(() => localStorage.getItem('fit-prefs-2')) === kept, 'a tap on the page that failed leaves the data as it was');
    // the new release installs, takes over and loads the page again, whole
    const whole = await u.waitForFunction(() => { try { return state.view === 'welcome' && WORKOUTS_RELEASE === RELEASE; } catch (e) { return false; } },
                                          null, { timeout: 60000 }).then(() => true, () => false);
    serve.slow = {};
    assert(whole, 'the page loads again on this release, whole: ' + await u.evaluate(() => typeof WORKOUTS_RELEASE === 'string' ? WORKOUTS_RELEASE : 'none'));
    assert(seen.some(e => e.includes('FIT scripts from more than one release')),
           "this release's app.js failed as it loaded, beside a script from the last one: " + seen.join(' | '));
    const failed = seen.length;
    const after = await wayneKept(u);
    assert(allKept(after), 'everything is still there, and home has his program day: ' + JSON.stringify(after));
    assert(!after.caches.includes('fit-previous'), 'running from this release now: ' + after.caches);
    // Start opens today's session, and a favourite opens
    await u.click('#todayCard .program-go');
    assert(await u.evaluate(() => state.view === 'workout' && state.sequence.length > 0), 'Start opens the session');
    await u.click('#btnBack'); await u.click('#btnProgramBack');
    await u.click('#pathLibrary');
    await u.click(card('☆ Full Body · 20 min'));
    assert(await u.evaluate(() => state.view === 'workout' && state.workout.exerciseIds.length > 0), 'and so does his favourite');
    await u.waitForTimeout(1000);
    assert(loads === 2 && seen.length === failed, `once: ${loads} loads, ${seen.length - failed} more errors: ` + seen.slice(failed).join(' | '));
    await up.close();
    note(`with ${LAST_WORKOUTS.real ? "origin/main's workouts.js" : 'this workouts.js saying it is from another release (no origin/main here)'}`);
    ok("an old workouts.js beside this release's app.js fails as the page loads, the new release takes over, and the page loads again once, whole, with Start and the favourites working");
  }

  step = "the first open of this release where workouts.js doesn't come for a while: the new release looks again, and the page loads whole";
  {
    const up = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const u = await up.newPage();
    const seen = [];
    u.on('pageerror', e => seen.push(String(e)));
    u.on('console', m => { if (m.type() === 'error') seen.push(m.text()); });
    let loads = 0;
    u.on('load', () => { loads++; });
    await onLastRelease(u);
    loads = 0;
    // this release goes up, and workouts.js doesn't come for eight seconds:
    // the old worker hands over its old copy, and the new release's install
    // fails on it, so it has to be looked for again once the file comes
    serve.drop['/js/workouts.js'] = Date.now() + 8000;
    await u.goto(URL, { waitUntil: 'domcontentloaded' });
    const mixed = await u.evaluate(() => [typeof WORKOUTS_RELEASE === 'string' ? WORKOUTS_RELEASE : 'none', RELEASE]);
    assert(mixed[0] !== mixed[1], "the first load has the last release's workouts.js beside this release's app.js: " + mixed);
    const whole = await u.waitForFunction(() => { try { return state.view === 'welcome' && WORKOUTS_RELEASE === RELEASE; } catch (e) { return false; } },
                                          null, { timeout: 60000 }).then(() => true, () => false);
    serve.drop = {};
    assert(whole, 'the page loads again on this release, whole, by itself: ' + await u.evaluate(() => typeof WORKOUTS_RELEASE === 'string' ? WORKOUTS_RELEASE : 'none'));
    const failed = seen.length;
    const after = await wayneKept(u);
    assert(allKept(after), 'everything is still there, and home has his program day: ' + JSON.stringify(after));
    assert(!after.caches.includes('fit-previous'), 'running from this release now: ' + after.caches);
    await u.click('#todayCard .program-go');
    assert(await u.evaluate(() => state.view === 'workout' && state.sequence.length > 0), 'Start opens the session');
    await u.waitForTimeout(1000);
    assert(loads === 2 && seen.length === failed, `once: ${loads} loads, ${seen.length - failed} more errors: ` + seen.slice(failed).join(' | '));
    await up.close();
    ok("with workouts.js not coming for a while the new release can't install at first; it's looked for again, and the page loads again once, whole");
  }

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
