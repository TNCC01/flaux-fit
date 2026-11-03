/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  The native bridge, in a browser. Serves the app's www/ (made by
  sync.mjs) in headless Chromium with a stand-in for Capacitor: it says
  this is the native app and its plugins only write down what they were
  asked. Then it drives FIT as someone would and checks what the bridge
  did with it:
  - an iPhone: no service worker, no Add to Home Screen hint, a shared
    link that points at fit.flaux.com.au through the Share plugin, the
    screen let go as the app loads, kept on from Start to the finish and
    let go on leaving, a tap on each of 3, 2, 1 and on the next phase,
    the Apple Health question on the first finish (brought into view,
    with a link to the privacy policy), then one save per finished
    workout while the switch is on and none while it's off, a reload
    mid-workout and Resume, a backup through the share sheet, and the
    privacy policy and support links under Your data;
  - the same, answering Not now, then not allowed;
  - the question left unanswered: it goes with its finish screen, and
    turning the switch on later doesn't save that old workout;
  - Android: no Apple Health anywhere, the backup through the share
    sheet, and the back gesture (a sheet first, then the screen's Back);
  - and the website, with no Capacitor at all and with Capacitor that
    isn't native: the bridge does nothing, and the shared link opens.
    This serves the app's www/, with the bridge in it, to show the
    bridge does nothing outside the app. The website itself, which
    never has the bridge, is scripts/e2e.mjs's.

    cd app && npm test          (node sync.mjs, then this)

  Needs Playwright, which the repo's browser suite installs: npm install
  and npx playwright install chromium at the repo root. Serves on port
  5141 (PORT= to change it).
*/
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(HERE, 'www');
const ROOT = path.join(HERE, '..');
if (!fs.existsSync(path.join(WWW, 'native-bridge.js'))) { console.error('No www/ yet: run node sync.mjs first'); process.exit(2); }
const PORT = Number(process.env.PORT) || 5141;
const URL = `http://127.0.0.1:${PORT}/`;
const SITE = 'https://fit.flaux.com.au/#w=';
const PRIVACY = 'https://fit.flaux.com.au/privacy.html';
const SUPPORT = 'https://fit.flaux.com.au/support.html';
const SCHEMA = Number(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').match(/^const PREFS_SCHEMA = (\d+)/m)[1]);

// ---------------------------------------------------------- static server
// The app's files, and the website's service worker for the website's
// turn (the app has none, see sync.mjs).
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url === '/sw.js' ? path.join(ROOT, 'sw.js') : path.normalize(path.join(WWW, url === '/' ? 'index.html' : url));
  if (url !== '/sw.js' && !file.startsWith(WWW)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });

let step = '', passed = 0;
const errors = [];
const ok = (msg) => { passed++; console.log('ok   ' + msg); };
const assert = (c, msg) => { if (!c) throw new Error(`FAILED at "${step}": ${msg}`); };

// software WebGL, so the 3D figures draw without a GPU, as in scripts/e2e.mjs
const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
else if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);

// ------------------------------------------------------ Capacitor stand-in
// Runs in the page before anything else, as Capacitor's own runtime does
// in the app. Every plugin call goes in window.__calls.
function fakeCapacitor({ platform, native, health }) {
  const calls = window.__calls = [];
  window.__listeners = {};
  const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
  const record = (plugin, method, answer) => (...args) => {
    calls.push({ plugin, method, args: plain(args), at: Date.now() });
    const result = typeof answer === 'function' ? answer(...args) : answer;
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  };
  const Plugins = {
    KeepAwake: { keepAwake: record('KeepAwake', 'keepAwake'), allowSleep: record('KeepAwake', 'allowSleep') },
    Haptics: { impact: record('Haptics', 'impact'), notification: record('Haptics', 'notification') },
    Share: { share: record('Share', 'share', () => (window.__cancelShare ? new Error('Share canceled') : {})) },
    Filesystem: { writeFile: record('Filesystem', 'writeFile', (o) => ({ uri: 'file:///cache/' + encodeURIComponent(o.path) })) },
    SplashScreen: { hide: record('SplashScreen', 'hide') },
    StatusBar: { setStyle: record('StatusBar', 'setStyle') },
    App: {
      addListener: (name, fn) => { window.__listeners[name] = fn; calls.push({ plugin: 'App', method: 'addListener', args: [name] }); return Promise.resolve({ remove() {} }); },
      minimizeApp: record('App', 'minimizeApp')
    }
  };
  if (health) {
    Plugins.FitHealth = {
      isAvailable: record('FitHealth', 'isAvailable', { available: true }),
      authorizationStatus: record('FitHealth', 'authorizationStatus', () => ({ status: window.__healthStatus || 'notDetermined' })),
      requestAuthorization: record('FitHealth', 'requestAuthorization', () => ({ status: (window.__healthStatus = window.__healthAnswer || 'authorized') })),
      saveWorkout: record('FitHealth', 'saveWorkout', { uuid: 'test-uuid' })
    };
  }
  window.Capacitor = { isNativePlatform: () => native, getPlatform: () => platform, isPluginAvailable: (n) => n in Plugins, Plugins };
}

// A device: a fresh context, FIT's first-visit question already answered,
// no sound (the haptics don't care), and the stand-in when it's the app.
async function device(name, cap, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e}`));
  page.on('console', m => {
    if (m.type() === 'error' || m.text().startsWith('FIT app:')) errors.push(`${name}: ${m.text()}`);
  });
  if (cap) await page.addInitScript(fakeCapacitor, cap);
  await page.addInitScript((schema) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('fit-prefs-2', JSON.stringify({ schema, gearAsked: true, people: 1, sound: 'off', voice: false }));
  }, SCHEMA);
  await page.goto(URL);
  await page.waitForSelector('#welcomeView.active');
  return { context, page };
}
const calls = (page, plugin, method) => page.evaluate(([pl, m]) => window.__calls.filter(c => c.plugin === pl && (!m || c.method === m)), [plugin, method]);
const count = async (page, plugin, method) => (await calls(page, plugin, method)).length;
const waitCalls = (page, plugin, method, n) =>
  page.waitForFunction(([pl, m, k]) => window.__calls.filter(c => c.plugin === pl && c.method === m).length >= k, [plugin, method, n], { timeout: 10000 });
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Today's workout, Start, and the clock jumped on to just before its end:
// it runs out on the next tick, as a finished session.
async function openToday(page) {
  await page.click('#todayCard .today-go');
  await page.waitForSelector('#workoutView.active');
}
async function runToEnd(page) {
  await page.evaluate(() => { state.elapsedAtResume = state.totalDuration - 0.3; state.runStartWall = Date.now(); });
  await page.waitForFunction(() => isFinished(), null, { timeout: 10000 });
}
async function startAndFinish(page) {
  await page.click('#btnStart');
  await runToEnd(page);
}

try {
  // ======================================================== an iPhone
  const { context: iosContext, page: ios } = await device('iPhone', { platform: 'ios', native: true, health: true });

  step = 'no service worker in the app';
  await sleep(1000);                                // past load, where FIT would register one
  assert(!(await ios.evaluate(() => 'serviceWorker' in navigator)), 'FIT sees a browser with no service workers');
  assert(iosContext.serviceWorkers().length === 0, 'and none is running');
  assert(await ios.evaluate(() => navigator.onLine === true && document.getElementById('updateBar').hidden), 'online as far as the 3D viewer goes, and no update bar');
  ok('no service worker registered, and the 3D viewer never asks for a connection');

  step = 'the browser-only bits are gone';
  assert(!(await visible(ios, '#installHint')) && !(await visible(ios, '#btnFullscreen')), 'no Add to Home Screen hint or Full screen button');
  assert(await count(ios, 'SplashScreen', 'hide') === 1, 'the splash goes once FIT has drawn');
  ok('no Add to Home Screen hint, no Full screen button, the splash let go');

  step = 'the screen is let go as the app loads';
  assert(await count(ios, 'KeepAwake', 'allowSleep') === 1 && await count(ios, 'KeepAwake', 'keepAwake') === 0,
         'one allowSleep, in case a page before this one (a web view iOS ended) kept the screen on');
  ok('KeepAwake let go as the page loads');

  step = 'the Apple Health switch is with the settings';
  await openToday(ios);
  assert(await ios.evaluate(() => {
    const t = document.querySelector('#workoutView .toggle-row #healthToggle');
    return !!t && t.textContent.trim() === 'Save to Apple Health' && !document.getElementById('healthOn').checked;
  }), 'Save to Apple Health, off until asked');
  assert(!(await visible(ios, '#healthAsk')), 'no question before a finish');
  ok('Save to Apple Health sits in the settings under the workout, off');

  step = 'share goes through the Share plugin with a link to the website';
  await ios.click('#btnShare');
  await waitCalls(ios, 'Share', 'share', 1);
  const [shared] = (await calls(ios, 'Share', 'share')).map(c => c.args[0]);
  assert(shared.url.startsWith(SITE) && shared.url.length > SITE.length + 20, 'a fit.flaux.com.au link to this workout: ' + shared.url);
  assert(shared.title.startsWith('FIT: ') && shared.text.startsWith('FIT: '), 'with what it is: ' + JSON.stringify(shared));
  assert(await ios.$eval('#workoutNote', e => e.textContent) === '', 'and nothing said after');
  await ios.evaluate(() => { window.__cancelShare = true; });
  await ios.click('#btnShare');
  await waitCalls(ios, 'Share', 'share', 2);
  await sleep(200);
  assert(await ios.$eval('#workoutNote', e => e.textContent) === '', 'a share sheet closed without sharing says nothing');
  await ios.evaluate(() => { window.__cancelShare = false; });
  ok('Share: the plugin, an https://fit.flaux.com.au link, a closed sheet says nothing');

  step = 'Start keeps the screen on, with a tap';
  await ios.click('#btnStart');
  await waitCalls(ios, 'KeepAwake', 'keepAwake', 1);
  assert(await count(ios, 'KeepAwake', 'allowSleep') === 1, 'not let go yet (only the once, as it loaded)');
  assert(await count(ios, 'Haptics', 'impact') === 1, 'one tap as it starts');
  ok('Start: KeepAwake on, one haptic');

  step = '3, 2, 1 and the next phase';
  const before = await count(ios, 'Haptics', 'impact');
  const next = await ios.evaluate(() => {
    const i = state.currentIdx + 1;
    state.elapsedAtResume = startOf(i) - 3.6;
    state.runStartWall = Date.now();
    return { i, kind: state.sequence[i].kind };
  });
  await ios.waitForFunction((i) => state.currentIdx >= i, next.i, { timeout: 8000 });
  await sleep(300);
  const taps = (await calls(ios, 'Haptics', 'impact')).slice(before).map(c => c.args[0].style);
  const want = ['LIGHT', 'LIGHT', 'LIGHT', next.kind === 'work' ? 'HEAVY' : 'MEDIUM'];
  assert(JSON.stringify(taps) === JSON.stringify(want), `a light tap on 3, 2 and 1, then the ${next.kind} phase's: ${taps}`);
  ok(`haptics: 3, 2, 1, then the ${next.kind} phase`);

  step = 'the first finish asks about Apple Health';
  await ios.setViewportSize({ width: 320, height: 568 });   // the smallest iPhone iOS 15 runs on, where it's below Done
  await runToEnd(ios);
  await waitCalls(ios, 'KeepAwake', 'allowSleep', 2);
  assert(await count(ios, 'Haptics', 'notification') === 1, 'a success tap at the end');
  assert(await visible(ios, '#healthAsk'), 'the question, on the finish screen');
  const askInView = () => { const r = document.getElementById('healthAsk').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; };
  assert(!(await ios.evaluate(askInView)), 'below Done at first');
  await ios.waitForFunction(askInView, null, { timeout: 5000 });          // then brought up
  assert(await ios.$eval('#healthAsk a', a => a.href) === PRIVACY, 'with a link to the privacy policy');
  await ios.setViewportSize({ width: 390, height: 844 });
  assert(await count(ios, 'FitHealth', 'saveWorkout') === 0 && await count(ios, 'FitHealth', 'requestAuthorization') === 0, 'nothing asked of Health until it is answered');
  const finishedAt = Date.now();
  const expect = await ios.evaluate(() => ({ style: styleIdOf(state.workout), ran: Math.round(timeDone()) }));
  await ios.click('#btnHealthYes');
  await waitCalls(ios, 'FitHealth', 'saveWorkout', 1);
  const [saved] = (await calls(ios, 'FitHealth', 'saveWorkout')).map(c => c.args[0]);
  const kinds = { short: 'highIntensityIntervalTraining', long: 'highIntensityIntervalTraining', emom: 'functionalStrengthTraining',
                  amrap: 'functionalStrengthTraining', fortime: 'functionalStrengthTraining', mix: 'crossTraining' };
  assert(saved.activity === kinds[expect.style], `the ${expect.style} style is saved as ${kinds[expect.style]}: ${saved.activity}`);
  assert(saved.end <= Date.now() && saved.end >= finishedAt - 5000, 'it ends when it finished');
  assert(saved.end - saved.start === expect.ran * 1000 && expect.ran >= 60, `and starts the ${expect.ran} s the clock ran before that`);
  assert(Object.keys(saved).sort().join() === 'activity,end,start', 'and nothing else: ' + JSON.stringify(saved));
  await ios.waitForFunction(() => document.getElementById('workoutNote').textContent === 'Saved to Apple Health.');
  assert(!(await visible(ios, '#healthAsk')) && await ios.$eval('#healthOn', e => e.checked), 'the question goes, and the switch is on');
  ok(`Apple Health: asked on the first finish (brought into view, with the privacy policy), then one save (${saved.activity}, ${expect.ran} s, ending as it finished)`);

  step = 'with the switch on, each finish saves once';
  await ios.click('#btnAgain');                     // Start over
  await waitCalls(ios, 'KeepAwake', 'keepAwake', 2);
  await runToEnd(ios);
  await waitCalls(ios, 'FitHealth', 'saveWorkout', 2);
  await sleep(300);
  assert(await count(ios, 'FitHealth', 'saveWorkout') === 2 && !(await visible(ios, '#healthAsk')), 'one more save, and no question');
  assert(await count(ios, 'KeepAwake', 'allowSleep') === 3, 'the screen let go at that finish too');
  ok('a second finish: one more save, no question, the screen let go');

  step = 'leaving a workout lets the screen go';
  await ios.click('#btnAgain');
  await waitCalls(ios, 'KeepAwake', 'keepAwake', 3);
  await ios.click('#btnBack');
  await ios.click('#btnBack');                      // Menu takes two taps once it's going
  await ios.waitForSelector('#welcomeView.active');
  await waitCalls(ios, 'KeepAwake', 'allowSleep', 4);
  assert(await count(ios, 'FitHealth', 'saveWorkout') === 2, 'a workout left part-way is not saved');
  ok('left part-way: the screen let go, nothing saved');

  step = 'with the switch off, no save';
  await openToday(ios);
  await ios.click('#healthOn');
  assert(!(await ios.$eval('#healthOn', e => e.checked)), 'switched off');
  await startAndFinish(ios);
  await sleep(500);
  assert(await count(ios, 'FitHealth', 'saveWorkout') === 2 && !(await visible(ios, '#healthAsk')), 'nothing saved, nothing asked');
  await ios.click('#btnStart');                     // Done
  await ios.waitForSelector('#welcomeView.active');
  ok('switch off: a finish saves nothing');

  step = 'a session skipped through is not a workout';
  await ios.reload();                               // (which starts the record of plugin calls afresh)
  await ios.waitForSelector('#welcomeView.active');
  await ios.waitForSelector('#healthOn', { state: 'attached' });
  assert(await ios.evaluate(() => !document.getElementById('healthOn').checked), 'the switch stays off after a reload');
  await openToday(ios);
  await ios.click('#healthOn');                     // on again (already allowed)
  await ios.waitForFunction(() => JSON.parse(localStorage.getItem('fit-app-health-1')).on === true);
  await ios.click('#btnStart');
  while (await ios.evaluate(() => !isFinished())) await ios.click('#btnSkip');
  await sleep(300);
  assert(await ios.evaluate(() => endedEarly()), 'FIT calls it ended early');
  assert(await count(ios, 'FitHealth', 'saveWorkout') === 0, 'and Health gets nothing');
  assert(await count(ios, 'Haptics', 'notification') === 0, 'and there is no success tap');
  ok('skipped through inside a minute: nothing saved, no success tap');

  step = 'a reload mid-workout, then Resume';
  await ios.click('#btnStart');                     // Done
  await ios.waitForSelector('#welcomeView.active');
  await openToday(ios);
  await ios.click('#btnStart');
  await waitCalls(ios, 'KeepAwake', 'keepAwake', 2);
  await ios.reload();                               // as when iOS ends the web view and the app loads FIT again
  await ios.waitForSelector('#welcomeView.active');
  assert(await count(ios, 'KeepAwake', 'allowSleep') === 1 && await count(ios, 'KeepAwake', 'keepAwake') === 0, 'the screen let go as FIT loads again');
  await ios.click('#btnResumeRun');
  await ios.waitForSelector('#workoutView.active');
  assert(await count(ios, 'KeepAwake', 'keepAwake') === 0 && await ios.evaluate(() => !state.running), 'not held while it waits for a tap');
  await ios.click('#btnStart');                     // Resume
  await waitCalls(ios, 'KeepAwake', 'keepAwake', 1);
  assert(await count(ios, 'Haptics', 'impact') === 1, 'held again from Resume, with a tap');
  await runToEnd(ios);
  await waitCalls(ios, 'FitHealth', 'saveWorkout', 1);
  const [resumed] = (await calls(ios, 'FitHealth', 'saveWorkout')).map(c => c.args[0]);
  const ranResumed = await ios.evaluate(() => Math.round(timeDone()));
  assert(resumed.end - resumed.start === ranResumed * 1000, `the finish saved as one workout of ${ranResumed} s: ` + JSON.stringify(resumed));
  assert(await count(ios, 'KeepAwake', 'allowSleep') === 2, 'and the screen let go at the finish');
  ok('a reload mid-workout: the screen let go, Resume holds it again, and the finish is saved');

  step = 'a backup goes through the share sheet';
  await ios.click('#btnStart');                     // Done
  await ios.click('#pathLibrary');
  await ios.waitForSelector('#libraryView.active');
  assert((await ios.$eval('.data-about', e => e.textContent)).startsWith('The app keeps its own data'), 'Your data says the app keeps its own');
  const links = await ios.$$eval('#yourData .app-links a', as => as.map(a => [a.textContent, a.href]));
  assert(JSON.stringify(links) === JSON.stringify([['Privacy policy', PRIVACY], ['Help and support', SUPPORT]]), 'the privacy policy and support, at its foot: ' + JSON.stringify(links));
  assert(await visible(ios, '#yourData .app-links'), 'on show');
  await ios.click('#btnBackup');
  await waitCalls(ios, 'Share', 'share', 1);
  const [written] = (await calls(ios, 'Filesystem', 'writeFile')).map(c => c.args[0]);
  assert(/^FIT backup \d{4}-\d{2}-\d{2}\.json$/.test(written.path) && written.directory === 'CACHE' && written.encoding === 'utf8', 'written to the cache: ' + written.path);
  assert(JSON.parse(written.data).kind === 'fit-backup', 'and it is the backup');
  const backupShare = (await calls(ios, 'Share', 'share')).pop().args[0];
  assert(backupShare.files.length === 1 && backupShare.files[0] === 'file:///cache/' + encodeURIComponent(written.path), 'shared from there: ' + JSON.stringify(backupShare));
  assert((await ios.$eval('.data-note', e => e.textContent)).includes('Files or iCloud Drive'), 'and it says where to keep it');
  ok('backup: written to the cache, shared through the sheet; the privacy policy and support links under Your data');
  await iosContext.close();

  // =================================== an iPhone that says Not now, then no
  const { context: noContext, page: no } = await device('iPhone, no', { platform: 'ios', native: true, health: true });
  step = 'Not now, then not allowed';
  await openToday(no);
  await startAndFinish(no);
  await no.click('#btnHealthNo');
  await sleep(300);
  assert(await count(no, 'FitHealth', 'requestAuthorization') === 0 && await count(no, 'FitHealth', 'saveWorkout') === 0, 'Not now asks Health nothing');
  assert((await no.$eval('#workoutNote', e => e.textContent)).includes('Save to Apple Health'), 'and says where to turn it on');
  await no.click('#btnAgain');
  await runToEnd(no);
  await sleep(300);
  assert(!(await visible(no, '#healthAsk')) && await count(no, 'FitHealth', 'saveWorkout') === 0, 'not asked again, nothing saved');
  await no.evaluate(() => { window.__healthAnswer = 'denied'; });
  await no.click('#healthOn');
  await no.waitForFunction(() => !document.getElementById('healthHint').hidden);
  assert(!(await no.$eval('#healthOn', e => e.checked)) && (await no.$eval('#healthHint', e => e.textContent)).includes('Health app'),
         'turned on but not allowed: back off, with how to allow it');
  ok('Not now: nothing asked of Health; turned on but not allowed: off again, and how to allow it');
  await noContext.close();

  // ============================ an iPhone that leaves the question unanswered
  const { context: laterContext, page: later } = await device('iPhone, later', { platform: 'ios', native: true, health: true });
  step = 'the question left unanswered goes with its finish screen';
  await openToday(later);
  await startAndFinish(later);
  assert(await visible(later, '#healthAsk'), 'asked at the first finish');
  await later.click('#btnStart');                   // Done, without answering
  await later.waitForSelector('#welcomeView.active');
  await openToday(later);
  await later.click('#btnStart');
  while (await later.evaluate(() => !isFinished())) await later.click('#btnSkip');
  await sleep(300);
  assert(await later.evaluate(() => endedEarly()) && !(await visible(later, '#healthAsk')), 'not on the finish screen of a session skipped through');
  await later.click('#healthOn');                   // turned on later, from the settings
  await waitCalls(later, 'FitHealth', 'requestAuthorization', 1);
  await sleep(300);
  assert(await later.$eval('#healthOn', e => e.checked) && await count(later, 'FitHealth', 'saveWorkout') === 0,
         'on, and the workout the question was about is not saved without a word');
  await later.click('#btnAgain');                   // Start over
  await runToEnd(later);
  await waitCalls(later, 'FitHealth', 'saveWorkout', 1);
  await later.waitForFunction(() => document.getElementById('workoutNote').textContent === 'Saved to Apple Health.');
  ok('left unanswered: the question goes with its finish screen, and turned on later only the next finish is saved');
  await laterContext.close();

  // ========================================================== Android
  const { context: androidContext, page: android } = await device('Android', { platform: 'android', native: true, health: false });
  step = 'Android: no Apple Health';
  assert(!(await android.$('#healthToggle')) && !(await android.$('#healthAsk')), 'no switch, no question');
  await openToday(android);
  await startAndFinish(android);
  await waitCalls(android, 'KeepAwake', 'allowSleep', 1);
  assert(await count(android, 'Haptics', 'notification') === 1, 'the success tap still');
  ok('Android: the screen kept on and let go, haptics, and no Apple Health anywhere');

  step = 'Android: the backup through the share sheet';
  await android.click('#btnStart');                 // Done
  await android.click('#pathLibrary');
  await android.click('#btnBackup');
  await waitCalls(android, 'Share', 'share', 1);
  assert((await android.$eval('.data-note', e => e.textContent)).includes('Google Drive'), 'it says where to keep it');
  assert(await android.$$eval('#yourData .app-links a', as => as.map(a => a.href).join()) === `${PRIVACY},${SUPPORT}`, 'the privacy policy and support links');
  ok('Android: backup through the share sheet, not a download');

  step = 'Android: the back gesture';
  const back = () => android.evaluate(() => window.__listeners.backButton());
  assert(await android.evaluate(() => typeof window.__listeners.backButton === 'function'), 'listened for');
  await back();
  await android.waitForSelector('#welcomeView.active');
  await back();
  await waitCalls(android, 'App', 'minimizeApp', 1);
  await openToday(android);
  await android.click('#btnStart');
  await android.click('#btnNextBlock');             // Up next, a sheet over the workout
  await android.waitForSelector('#nextSheet', { state: 'visible' });
  await back();
  assert(await android.evaluate(() => document.getElementById('nextSheet').hidden && state.view === 'workout' && state.running), 'a sheet open: back closes it, and the workout carries on');
  assert(await android.$eval('#btnBack', e => e.textContent) !== 'Tap again', "and that isn't the first of Menu's two taps");
  await back();
  assert(await android.$eval('#btnBack', e => e.textContent) === 'Tap again' && await android.evaluate(() => state.view === 'workout'), 'mid-workout it asks first, like Menu');
  await back();
  await android.waitForSelector('#welcomeView.active');
  ok('Android back: the screen\'s own Back, a sheet closed first, Menu\'s two taps mid-workout, and away from home');
  await androidContext.close();

  // ========================================================== the website
  for (const [name, cap] of [['the website', null], ['Capacitor on the web', { platform: 'web', native: false, health: true }]]) {
    const { context: webContext, page: web } = await device(name, cap, { width: 1180, height: 820 });
    step = `${name}: the bridge does nothing`;
    assert(await web.evaluate(() => ['serviceWorker', 'share', 'canShare', 'wakeLock', 'onLine'].every(k => !Object.getOwnPropertyDescriptor(navigator, k))),
           'none of the browser features swapped');
    await web.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r), null, { timeout: 10000 });
    assert(!(await web.$('#healthToggle')) && !(await web.evaluate(() => [...document.querySelectorAll('style')].some(s => s.textContent.includes('health-ask')))), 'no Health switch, no app styles');
    assert(await web.evaluate(() => finish.toString().includes('stopTimer') && shareUrlFor.toString().includes('location.origin')), "FIT's own functions, unwrapped");
    assert(await web.evaluate(() => !dataSection().querySelector('.app-links')), 'and no app links under Your data');
    await web.goto(URL + shared.url.slice(shared.url.indexOf('#')));
    await web.waitForSelector('#workoutView.active');
    assert((await web.$eval('#workoutNote', e => e.textContent)).startsWith('Opened from a shared link'), 'the link shared from the app opens the workout');
    assert(await web.evaluate(() => shareUrlFor(state.workout).startsWith(location.origin + '/')), "and the site's links are its own");
    if (cap) assert(await count(web, 'KeepAwake') + await count(web, 'Share') + await count(web, 'SplashScreen') === 0, 'no plugin called');
    ok(`${name}: service worker registered, nothing swapped or wrapped, the app's shared link opens`);
    await webContext.close();
  }

  assert(!errors.length, 'console or page errors:\n' + errors.join('\n'));
  console.log(`\nAll ${passed} checks passed.`);
} catch (e) {
  console.error(e.message);
  if (errors.length) console.error('errors seen:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
