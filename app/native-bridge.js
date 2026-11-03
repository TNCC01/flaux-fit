/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  NATIVE BRIDGE: FIT as the App Store and Google Play app, FIT by Flaux.

  The app is the website, copied in by app/sync.mjs, plus this file, which
  only the app's copy of index.html loads (in its <head>, ahead of FIT's
  own scripts). It does nothing at all unless Capacitor says this is the
  native app, so a page without Capacitor runs exactly as the website
  does.

  It changes FIT from the outside, without a line of js/app.js knowing:
  - Straight away, before FIT's scripts run, it swaps the browser
    features FIT already uses for the app's own: no service worker (see
    OFFLINE), the share sheet through the Share plugin (SHARE), and the
    screen kept on through KeepAwake (KEEP AWAKE).
  - Once FIT's scripts have run, it wraps a few of FIT's own functions to
    add what only the app does: links that point at the website, a
    backup through the share sheet, haptics on each phase, and Apple
    Health. They're function declarations in js/app.js, so each is a
    property of window that FIT's own calls go through (see hook below).
    The ones it wraps: shareUrlFor, dataSection, copyData, saveBackup,
    chimeFor, startTimer, tickClock and finish. It also reads FIT's state
    and a few of its helpers (endedEarly, timeDone, styleIdOf, backupText,
    dayKey). app/test-bridge.mjs fails if any of that stops working, so run
    it after changing js/app.js.
*/
(function () {
  'use strict';
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  const platform = cap.getPlatform();                  // 'ios' or 'android'
  const plugins = cap.Plugins || {};
  const plugin = (name) => (cap.isPluginAvailable ? cap.isPluginAvailable(name) : name in plugins) ? plugins[name] : null;
  // A plugin call that mustn't get in FIT's way: whatever goes wrong, the
  // workout carries on without it.
  const quietly = (call) => {
    try { Promise.resolve(call()).catch(() => {}); } catch (e) { /* see above */ }
  };
  // A property of the browser's, given a value of the app's.
  const define = (obj, name, value) => {
    try { Object.defineProperty(obj, name, { value, configurable: true, writable: true }); return true; }
    catch (e) { return false; }
  };
  // Where a shared workout opens for whoever gets it.
  const SITE = 'https://fit.flaux.com.au';

  // =====================================================================
  // OFFLINE
  // The app's files are already on the device, and a new release comes
  // through the store, so FIT's service worker (and its New version ready
  // bar) has no job here. On Android, where the WebView would run one, it
  // would go on serving the last release's files after an update. So FIT
  // is shown a browser with no service workers, which it already copes
  // with, and any worker registered before (none should be) is let go.
  // =====================================================================
  const container = navigator.serviceWorker;
  if (container) {
    try { container.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {}); } catch (e) { /* none to let go */ }
    try { delete Navigator.prototype.serviceWorker; } catch (e) { /* see below */ }
    // couldn't be taken away: one that never registers anything
    if ('serviceWorker' in navigator) {
      define(navigator, 'serviceWorker', {
        controller: null, addEventListener() {}, removeEventListener() {},
        register: () => Promise.reject(new Error('No service worker in the app')),
        getRegistrations: () => Promise.resolve([])
      });
    }
  }
  // The 3D viewer (move.html) is in the app too, so it never needs the
  // network, and that's the one thing FIT asks navigator.onLine about
  // (openMove, which otherwise says it needs a connection the first time).
  define(navigator, 'onLine', true);

  // =====================================================================
  // KEEP AWAKE
  // FIT holds a screen wake lock from Start until the workout ends or you
  // leave it, pauses included (WAKE LOCK in js/app.js). The WebView's own
  // may not be there, or may not hold, so FIT is handed one that keeps the
  // screen on with the KeepAwake plugin. The app's isn't let go in the
  // background, so FIT never needs to ask again on the way back.
  // The screen kept on belongs to the app, not the page: if iOS ends the
  // web view mid-workout, the app loads FIT again and nothing would ever
  // let it go (an iPad in its folio would stay lit). So a page starts by
  // letting it go, and Resume holds it again.
  // =====================================================================
  const KeepAwake = plugin('KeepAwake');
  if (KeepAwake) {
    quietly(() => KeepAwake.allowSleep());
    const held = new Set();
    define(navigator, 'wakeLock', {
      async request(type = 'screen') {
        await KeepAwake.keepAwake();
        const lock = new EventTarget();
        lock.type = type;
        lock.released = false;
        lock.release = async () => {
          if (lock.released) return;
          lock.released = true;
          held.delete(lock);
          if (!held.size) await Promise.resolve(KeepAwake.allowSleep()).catch(() => {});
          lock.dispatchEvent(new Event('release'));
        };
        held.add(lock);
        return lock;
      }
    });
  }

  // =====================================================================
  // SHARE
  // FIT shares a workout link with navigator.share, and on an iPhone or
  // iPad a backup file too. The WebView has no share sheet of its own, so
  // both go to the Share plugin: text and a link as they are, a file
  // written to the app's cache first (Filesystem) and shared from there.
  // A share sheet closed without sharing is an AbortError, as in the
  // browser, so FIT says nothing.
  // =====================================================================
  const Share = plugin('Share');
  const Filesystem = plugin('Filesystem');
  if (Share) {
    define(navigator, 'share', async (data = {}) => {
      const options = {};
      if (data.title) options.title = data.title;
      if (data.text) options.text = data.text;
      if (data.url) options.url = data.url;
      const files = data.files ? [...data.files] : [];
      if (files.length) {
        if (!Filesystem) throw new DOMException('No files to share in this app', 'NotSupportedError');
        // FIT only ever shares its backup, which is JSON text
        options.files = [];
        for (const file of files) {
          const written = await Filesystem.writeFile({ path: file.name, data: await file.text(), directory: 'CACHE', encoding: 'utf8' });
          options.files.push(written.uri);
        }
      }
      try {
        await Share.share(options);
      } catch (e) {
        if (/cancel/i.test(String(e && e.message))) throw new DOMException('Share canceled', 'AbortError');
        throw e;
      }
    });
    define(navigator, 'canShare', (data) => !!data && (!data.files || !!Filesystem));
  }

  // =====================================================================
  // LOOKS
  // The Add to Home Screen hint and the Full screen button are for FIT in
  // a browser; the app is already full screen. The one-time Apple Health
  // question (see HEALTH) sits under Save and Share on the finish screen,
  // and only there. And the privacy policy and support links sit at the
  // foot of Your data (see LINKS AND YOUR DATA).
  // =====================================================================
  const looks = document.createElement('style');
  looks.textContent = `
    #installHint, #btnFullscreen { display: none !important; }
    .health-ask { margin-top: 0.8rem; padding: 0.9rem 1rem; background: var(--card); border: 1px solid var(--border);
      border-radius: 1rem; display: flex; flex-direction: column; gap: 0.6rem; text-align: center; }
    .health-ask[hidden], #workoutView:not(.finished) .health-ask { display: none; }
    .health-ask-title { font-weight: 700; font-size: 1.05rem; }
    .health-ask-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .health-ask-actions button { flex: 1 1 12rem; font-size: 1rem; padding: 0.85rem; }
    .health-ask a, .app-links a { color: var(--teal-bright); font-weight: 700; text-underline-offset: 3px; white-space: nowrap; }
    .app-links { color: var(--muted); font-size: 0.95rem; margin-top: 1.2rem; padding: 0 0.25rem; }
    .app-links a { display: inline-block; padding: 0.5rem 0; }
  `;
  document.head.appendChild(looks);

  // FIT's background until FIT has drawn its first screen (the splash is
  // the same colour, see capacitor.config.json), then FIT's own hooks.
  document.addEventListener('DOMContentLoaded', () => {
    const SplashScreen = plugin('SplashScreen');
    if (SplashScreen) quietly(() => SplashScreen.hide());
    // FIT's scripts didn't run (they always come together in the app, so
    // this shouldn't happen): there's nothing to hook
    if (typeof window.finish !== 'function') return;
    hookLinksAndData();
    hookHaptics();
    setupHealth();
    androidBack();
  });

  // Wraps one of FIT's functions. They're function declarations in
  // js/app.js, so each is a property of window and FIT's own calls to it
  // go through that property: replacing it changes what FIT calls.
  function hook(name, wrap) {
    const fn = window[name];
    if (typeof fn !== 'function') {
      console.warn(`FIT app: js/app.js has no ${name}() any more, so the app can't add to it`);
      return;
    }
    window[name] = wrap(fn);
  }

  // =====================================================================
  // LINKS AND YOUR DATA
  // A shared workout has to open for whoever gets it, so its link points
  // at the website, not at the app's own address (capacitor://localhost
  // on an iPhone or iPad, https://localhost on Android). Your data says
  // the app keeps its own, apart from FIT in a browser, which is what it
  // is there to move. A backup goes to the share sheet on Android too,
  // where the browser's download has nowhere to go. And the foot of Your
  // data links to the privacy policy and support pages on the website,
  // as the stores ask of an app (Apple's guideline 5.1.1). Capacitor
  // opens a link to anywhere but the app's own address in the browser,
  // so a plain link leaves the app where it was.
  // =====================================================================
  const PRIVACY = `${SITE}/privacy.html`;
  const SUPPORT = `${SITE}/support.html`;
  function hookLinksAndData() {
    hook('shareUrlFor', (shareUrlFor) => function () {
      const url = shareUrlFor.apply(this, arguments);
      const hash = url.indexOf('#');
      return hash < 0 ? url : `${SITE}/${url.slice(hash)}`;
    });
    hook('dataSection', (dataSection) => function () {
      const section = dataSection.apply(this, arguments);
      const about = section.querySelector('.data-about');
      if (about) about.textContent = 'The app keeps its own data, apart from FIT in a web browser, so this is how you bring yours across, or move it to another device.';
      const links = document.createElement('p');
      links.className = 'app-links';
      links.innerHTML = `<a href="${PRIVACY}">Privacy policy</a> · <a href="${SUPPORT}">Help and support</a>`;
      section.appendChild(links);
      return section;
    });
    hook('copyData', (copyData) => function (after, say) {
      return copyData.call(this, after, (text) => say(String(text).replace(', or in the home-screen app,', ',')));
    });
    hook('saveBackup', () => async function (say) {
      const name = `FIT backup ${dayKey(Date.now())}.json`;
      try {
        await navigator.share({ files: [new File([backupText()], name, { type: 'application/json' })] });
      } catch (e) {
        if (e && e.name === 'AbortError') return;         // share sheet closed
        say("The backup file couldn't be made here. Copy to another device does the same job.");
        return;
      }
      say(platform === 'android' ? 'Backup made. Keep the file somewhere safe, like Google Drive.'
        : 'Backup made. Keep the file somewhere safe, like Files or iCloud Drive.');
    });
  }

  // =====================================================================
  // HAPTICS
  // A tap you can feel at each change, for a phone on the floor or in a
  // pocket: a firm one as work starts, a softer one for everything else
  // (a rest, the next warm-up move or stretch, the cool-down), a light
  // tick on each of the last three seconds, and a success at the end.
  // They follow FIT's own sounds, but not its sound setting: No sound
  // still has them. An iPad has no haptics, so it simply has none.
  // =====================================================================
  const Haptics = plugin('Haptics');
  const tap = (style) => { if (Haptics) quietly(() => Haptics.impact({ style })); };
  const tapFor = (phase) => tap(phase && phase.kind === 'work' ? 'HEAVY' : 'MEDIUM');
  const finishedOnScreen = () => document.getElementById('workoutView').classList.contains('finished');

  function hookHaptics() {
    // arriving at a phase, as it ticks over or is skipped to
    hook('chimeFor', (chimeFor) => function (phase) {
      tapFor(phase);
      return chimeFor.apply(this, arguments);
    });
    // Start (and Resume) begins the phase it's on, which chimeFor doesn't see
    hook('startTimer', (startTimer) => function () {
      const was = state.running;
      const result = startTimer.apply(this, arguments);
      if (!was && state.running) tapFor(state.sequence[state.currentIdx]);
      return result;
    });
    // 3, 2, 1: each time the countdown beeps, FIT's state.lastBeep moves on
    // to that second
    hook('tickClock', (tickClock) => function () {
      const before = state.lastBeep;
      const result = tickClock.apply(this, arguments);
      const second = state.lastBeep;
      if (state.running && second !== before && second >= 1 && second <= 3) tap('LIGHT');
      return result;
    });
    // The end of a session someone actually did: the success tap, and the
    // workout to Apple Health. Not a second time for a finish screen
    // already up, and not for one never started or skipped through inside
    // a minute (see endedEarly), which FIT doesn't count either.
    hook('finish', (finish) => function () {
      const already = finishedOnScreen();
      const result = finish.apply(this, arguments);
      if (already || !state.started || endedEarly()) return result;
      if (Haptics) quietly(() => Haptics.notification({ type: 'SUCCESS' }));
      health.finished(healthWorkout());
      return result;
    });
  }

  // =====================================================================
  // HEALTH
  // Each workout you finish goes to Apple Health, iPhone and iPad (with
  // the Health app, iPadOS 17 on), through FIT's own plugin
  // (app/plugins/fit-health). It asks once, on the finish screen of the
  // first workout finished: Save to Apple Health shows Apple's sheet and
  // saves that workout, Not now leaves it off. Either way the switch
  // under the workout (Save to Apple Health, with the other settings)
  // turns it on or off from then on. The answer is kept on this device
  // under its own key, apart from FIT's prefs, since Apple's permission
  // belongs to the device too. Android has no plugin yet (Health Connect
  // is v1.1), so none of this shows there.
  //
  // The question is about the workout on the finish screen it's on. Left
  // unanswered, it goes with that screen (Done, Start over), and so does
  // the workout it was about: a yes later doesn't quietly save a session
  // that's no longer on screen. It's asked again at the next finish. On a
  // phone in portrait it sits below Done, so the first time it's asked
  // it's brought into view.
  //
  // What's saved: the kind of workout (FIT's style, as Apple's kinds, see
  // ACTIVITY), and when it ran. FIT's clock doesn't count a pause, so the
  // workout ends as it finished and starts the minutes it ran before
  // that: a pause for water moves the start along rather than counting
  // as exercise. No calories, no heart rate: FIT doesn't measure them.
  // =====================================================================
  const Health = platform === 'ios' ? plugin('FitHealth') : null;
  const HEALTH_KEY = 'fit-app-health-1';               // { on }, once it's been asked
  // FIT's styles (styleIdOf in js/app.js) as Apple Health's workouts:
  // the timed intervals are HIIT; EMOM, AMRAP, For Time and the Surf check
  // are sets of reps against the clock, which Apple calls functional
  // strength; a mix of styles is cross training ("any mixture of cardio,
  // strength and flexibility", which a mixed session is); stretching is
  // flexibility.
  const ACTIVITY = {
    short: 'highIntensityIntervalTraining', long: 'highIntensityIntervalTraining',
    emom: 'functionalStrengthTraining', amrap: 'functionalStrengthTraining', fortime: 'functionalStrengthTraining',
    check: 'functionalStrengthTraining', mix: 'crossTraining', stretch: 'flexibility'
  };
  const healthWorkout = () => {
    const end = Date.now();
    const ran = Math.max(1, Math.round(timeDone()));
    return { activity: ACTIVITY[styleIdOf(state.workout)] || 'highIntensityIntervalTraining', start: end - ran * 1000, end };
  };
  const health = { finished() {} };                    // until it's known Health is here

  function healthOn() {
    try {
      const kept = JSON.parse(localStorage.getItem(HEALTH_KEY));
      return kept && typeof kept.on === 'boolean' ? kept.on : null;      // null: never asked
    } catch (e) { return null; }
  }

  async function setupHealth() {
    if (!Health) return;
    let available = false;
    try { available = !!(await Health.isAvailable()).available; } catch (e) { /* no Health */ }
    if (!available) return;

    const NOT_ALLOWED = "FIT isn't allowed to save to Health. To let it: in the Health app, tap your picture, then Apps, FIT by Flaux, and turn on Workouts.";
    // Apple's sheet the first time; its answer straight back after that
    const ask = async () => {
      try { return (await Health.requestAuthorization()).status; } catch (e) { return 'failed'; }
    };
    const note = (text) => { if (finishedOnScreen()) document.getElementById('workoutNote').textContent = text; };
    const save = async (workout) => {
      try {
        await Health.saveWorkout(workout);
        note('Saved to Apple Health.');
      } catch (e) {
        note("This workout couldn't be saved to Apple Health. Check FIT is allowed to, in the Health app.");
      }
    };
    let waiting = null;                                // the workout the question is about
    let broughtIntoView = false;                       // the question, scrolled to once

    // ----------------------------- the question, on the first finish screen
    const question = document.createElement('div');
    question.className = 'health-ask';
    question.id = 'healthAsk';
    question.hidden = true;
    question.innerHTML = `<p class="health-ask-title">Save your workouts to Apple Health?</p>
      <p class="picker-hint">FIT can add each workout you finish to the Health app: the kind of workout, when, and how long. It doesn't read anything from Health. <a href="${PRIVACY}">Privacy policy</a></p>
      <div class="health-ask-actions"><button id="btnHealthYes">Save to Apple Health</button>
      <button class="secondary" id="btnHealthNo">Not now</button></div>`;
    document.getElementById('preStart').appendChild(question);
    // gone with its finish screen, unanswered, and the workout with it
    new MutationObserver(() => {
      if (!finishedOnScreen()) { waiting = null; question.hidden = true; }
    }).observe(document.getElementById('workoutView'), { attributes: true, attributeFilter: ['class'] });

    // ------------------------------------------- the switch, in the settings
    const row = document.querySelector('#workoutView .toggle-row');
    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    toggle.id = 'healthToggle';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'healthOn';
    toggle.append(box, ' Save to Apple Health');
    const hint = document.createElement('p');
    hint.className = 'toggle-hint';
    hint.id = 'healthHint';
    hint.hidden = true;
    row.insertBefore(toggle, row.querySelector('.text-size'));
    row.appendChild(hint);
    const say = (text) => { hint.textContent = text; hint.hidden = !text; };
    box.checked = healthOn() === true;

    // An answer, from the question or the switch: kept, shown on the
    // switch, and the question done with. A yes saves the workout the
    // question was about.
    const answer = (status) => {
      const on = status === 'authorized';
      try { localStorage.setItem(HEALTH_KEY, JSON.stringify({ on })); } catch (e) { /* asked again next time */ }
      box.checked = on;
      question.hidden = true;
      if (on && waiting) save(waiting);
      waiting = null;
    };
    box.addEventListener('change', async () => {
      say('');
      if (!box.checked) { answer('off'); return; }
      const status = await ask();
      answer(status);
      if (status !== 'authorized') say(NOT_ALLOWED);
    });
    question.querySelector('#btnHealthYes').addEventListener('click', async () => {
      const status = await ask();
      answer(status);
      if (status !== 'authorized') note(NOT_ALLOWED);
    });
    question.querySelector('#btnHealthNo').addEventListener('click', () => {
      answer('off');
      note('To save them later, turn on Save to Apple Health in the settings under the workout.');
    });

    health.finished = (workout) => {
      const on = healthOn();
      if (on === null) {
        waiting = workout;
        question.hidden = false;
        if (!broughtIntoView) {
          broughtIntoView = true;
          // just enough to show it (none at all where it's on screen
          // already, as in landscape), after a moment on the finish
          setTimeout(() => {
            if (!question.hidden && finishedOnScreen()) question.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 800);
        }
        return;
      }
      if (on) save(workout);
    };
  }

  // =====================================================================
  // ANDROID BACK
  // Android's back gesture does what FIT's own Back does on the screen
  // you're on: closes a sheet that's open, and otherwise taps the screen's
  // Back (in a workout, Menu, which still asks for a second tap once it's
  // going). On the home screen it puts the app away, as Android apps do.
  // Without this, back left FIT from any screen.
  // =====================================================================
  function androidBack() {
    const App = plugin('App');
    if (!App || platform !== 'android') return;
    quietly(() => App.addListener('backButton', () => {
      const sheet = ['moveSheet', 'swapSheet', 'nextSheet'].map(id => document.getElementById(id)).find(el => el && !el.hidden);
      if (sheet) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return; }
      const back = document.querySelector('.view.active .back-btn');
      if (back) back.click();
      else quietly(() => App.minimizeApp());
    }));
  }
})();
