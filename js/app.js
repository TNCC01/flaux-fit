/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  APP SHELL: views, setup flows, rendering and the timer.
*/

// The same check as in index.html, for this script with the page from an
// older release: if the scripts fail while the page loads, a release
// waiting in the service worker (or one it looks for then, and again for a
// while if it can't install) takes over and the page loads again.
window.addEventListener('error', function retry() {
  window.removeEventListener('error', retry);
  const sw = navigator.serviceWorker;
  if (document.readyState === 'complete' || !sw) return;
  sw.addEventListener('controllerchange', () => location.reload());
  // once the page has stopped loading, so the release it came from isn't
  // still handing it files
  window.addEventListener('load', () => sw.register('sw.js').then(async function look(reg, tries = 12) {
    // the browser may not have looked for the new release yet: look now
    if (!reg.waiting && !reg.installing) await reg.update().catch(() => {});
    const next = reg.waiting || reg.installing;
    if (!next) {
      // none: load again, once, which fetches the page afresh past a
      // worker from before this one that handed over its old copy
      if (!sessionStorage.getItem('fit-retried')) { sessionStorage.setItem('fit-retried', '1'); location.reload(); }
      return;
    }
    const take = () => {
      if (next.state === 'installed') next.postMessage('update');
      // it couldn't install (a file that didn't come): look again, every ten seconds for two minutes
      else if (next.state === 'redundant' && tries > 0) setTimeout(() => look(reg, tries - 1), 10000);
    };
    take();
    next.addEventListener('statechange', take);
  }).catch(() => { /* no offline copy to fall back on */ }));
});
// And workouts.js has to be from this release. One from another (the
// worker from before sw.js hands over its old copy of a file that's slow
// to come, or doesn't come) can load without an error and only break the
// first tap on Start, so it says which release it's from, and one that
// doesn't match fails here, while the page loads, for the check above.
// An older exercises.js or generator.js works beside this one.
const RELEASE = 'fit-v20';
if (typeof WORKOUTS_RELEASE !== 'string' || WORKOUTS_RELEASE !== RELEASE) {
  throw new Error('FIT scripts from more than one release');
}

const TIME_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60];
const RECENT_CAP = 60;          // exercise ids remembered for variety
const HISTORY_CAP = 200;        // sessions kept in the history list (a 42-day program and then some)
// Re-opening the same workout inside this window updates its history entry
// instead of adding another, so a reset or a second go is still one session.
const HISTORY_MERGE_MS = 3 * 60 * 60 * 1000;
const PREFS_KEY = 'fit-prefs-2';

// =====================================================================
// STATE
// =====================================================================
const state = {
  view: 'welcome',

  // Preferences (persisted, see PERSISTED below). A new visitor starts
  // solo; the first-visit question asks (see renderGearQuestion).
  people: 1,
  nameA: '', nameB: '',
  equipment: { ...DEFAULT_EQUIPMENT, kettlebells: true },
  // the weights you own: kettlebells and dumbbell pairs in kg, and what the
  // bar is loaded to (see GEAR and loadsFor)
  weights: { kb: [10, 15], db: [], bar: 10 },
  // named gear and weights for each place you train ("Home", "Mate's
  // place"); the selected one follows every change made in setup
  gearSets: [],
  gearSetId: null,
  minutes: 20,
  // FIT picks the style for a built workout (see FIT PICKS in
  // js/workouts.js) until you choose one; the one chosen is kept here, and
  // a classic always runs in it
  styleAuto: true,
  intervalStyle: DEFAULT_INTERVAL,
  // what the session is for: general fitness, or surfing (see SURF_GROUPS)
  goal: 'general',
  // programs started: { [id]: { startedAt, done: [{ n, at, surfed, water, check }],
  // surfs: [{ at, paddle }], ease, checkLater } } (see PROGRAMS)
  programs: {},
  // each Surf check's results, oldest first, kept apart from the history:
  // [{ at, n, results: { [name, or '#a']: { name, popups, pushups, paddle } } }]
  // (see SURF CHECKS)
  checks: [],
  // each person's level, from how their sessions felt: { [name, or '#a'
  // for a spot with no name]: { k, easy } } (see PERSONAL LEVELS)
  levels: {},
  // a mixed session: on, and the styles in order (see planMix)
  mixOn: false,
  mixStyles: ['emom', 'short', 'amrap'],
  regions: REGIONS.map(r => r.id),
  blockedTags: [],
  excluded: [],
  // the sound (see SOUNDS): beeps over your music, beeps even with the
  // silent switch on (the iPhone's pick, see applyAudioSession), or none;
  // and the voice coach on top of the beeps (see VOICE COACH)
  sound: 'silent',
  voice: true,
  // the two tick boxes the sound took over from, Mute audio and Beep even
  // on silent, still saved beside it for a tab on an older release, which
  // knows only them (see cleanPrefs)
  muteAudio: false,
  beepOnSilent: true,
  showAlts: false,
  showPhotos: true,
  textScale: 1,
  recent: [],
  saved: [],
  history: [],
  filterFocus: 'all',
  // the first-visit gear question has been answered (see openGearQuestion)
  gearAsked: false,

  // Per-workout runtime
  workout: null,
  lastRequest: null,
  sequence: [],
  totalDuration: 0,
  currentIdx: 0,
  remainingInPhase: 0,
  elapsedTotal: 0,
  running: false,
  // Start was pressed on this workout (set in startTimer, cleared by a
  // reset): only then does finishing count it as done, and leaving it take
  // two taps
  started: false,
  elapsedAtResume: 0,
  runStartWall: 0,
  // blocks (or stretches) skipped this go, and the seconds that skipped,
  // for the finish screen
  skipped: [],
  skippedSec: 0,
  // what each person said on the finish screen: { a: 'easy', b: 'cooked' }
  feel: {},
  lastBeep: null,
  tickHandle: null,
  wakeLock: null,
  excludeSearch: '',
  // "Something else today" on the home card: the day it was tapped, so the
  // program session comes back tomorrow (see renderToday). Saved, so a
  // reload the same day keeps it.
  todayOther: null
};

const PERSISTED = ['people', 'nameA', 'nameB', 'equipment', 'weights', 'minutes', 'styleAuto', 'intervalStyle', 'mixOn', 'mixStyles', 'goal', 'programs', 'checks', 'levels', 'gearSets', 'gearSetId',
  'regions', 'blockedTags', 'excluded', 'sound', 'voice', 'muteAudio', 'beepOnSilent', 'showAlts', 'showPhotos',
  'textScale', 'recent', 'saved', 'history', 'filterFocus', 'gearAsked', 'todayOther'];

// What a new visitor starts with: the fallback for anything a store or a
// backup leaves out or has the wrong shape.
const PREF_DEFAULTS = JSON.parse(JSON.stringify(Object.fromEntries(PERSISTED.map(k => [k, state[k]]))));
const TEXT_SCALES = [1, 1.2, 1.45];
// Beeps over my music, Beeps even on silent, No sound (see AUDIO)
const SOUNDS = ['music', 'silent', 'off'];

// Nothing is saved until the store has been read, so a page that broke
// while it loaded (a page from one release with another's scripts, see the
// check at the top) can't write a new visitor's defaults over everything.
let prefsLoaded = false;
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    const s = cleanPrefs(p);
    // a save from an older release leaves the levels out (see LEVELS_KEY),
    // the voice switch (see VOICE_KEY), FIT picks (see PICKS_KEY) and the
    // Surf checks (see CHECKS_KEY)
    if (!hasLevels(p)) s.levels = storedLevels() || s.levels;
    if (!hasChecks(p)) s.checks = storedChecks() || s.checks;
    if (!hasVoice(p)) s.voice = storedVoice() ?? s.voice;
    if (!hasPicks(p)) s.styleAuto = storedPicks() ?? s.styleAuto;
    Object.assign(state, s);
  } catch (e) { /* corrupt store: fall back to defaults */ } finally { prefsLoaded = true; }
}
// Saved prefs (the store, another tab's save, or a backup being restored)
// as a full set of PERSISTED keys, each checked. Only keys we know about
// are taken, so a stale or hand-edited store must not be able to drop
// arbitrary values into runtime state, and anything missing or the wrong
// shape is the default. Throws if it isn't prefs at all.
function cleanPrefs(p) {
  const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!plain(p)) throw new Error('not FIT prefs');
  const s = JSON.parse(JSON.stringify(PREF_DEFAULTS));
  PERSISTED.forEach(k => { if (p[k] !== undefined) s[k] = p[k]; });
  const equip = plain(p.equipment) ? p.equipment : {};
  s.equipment = { ...DEFAULT_EQUIPMENT, kettlebells: true, ...equip };
  s.weights = cleanWeights(p.weights, equip, s.equipment);
  s.gearSets = (Array.isArray(p.gearSets) ? p.gearSets : []).filter(g =>
    plain(g) && typeof g.id === 'string' && typeof g.name === 'string' && plain(g.equipment))
    .map(g => {
      const equipment = { ...g.equipment };
      return { id: g.id, name: g.name.slice(0, 24), equipment, weights: cleanWeights(g.weights, g.equipment, equipment) };
    });
  if (typeof s.gearSetId !== 'string') s.gearSetId = null;
  if (!INTERVALS[s.intervalStyle]) s.intervalStyle = DEFAULT_INTERVAL;
  s.mixOn = s.mixOn === true;
  // FIT picks, or a style chosen. A save from before FIT picked (an old
  // backup, or one with no PICKS_KEY beside it) goes by its style: one
  // other than the style setup starts on, or a mix, was chosen, and is kept.
  s.styleAuto = typeof p.styleAuto === 'boolean' ? p.styleAuto
    : !(s.mixOn || s.intervalStyle !== DEFAULT_INTERVAL);
  if (!GOALS.some(g => g.id === s.goal)) s.goal = 'general';
  if (!plain(s.programs)) s.programs = {};
  Object.keys(s.programs).forEach(id => {
    const pr = s.programs[id];
    if (!PROGRAMS.some(x => x.id === id) || !plain(pr) || !Array.isArray(pr.done)) { delete s.programs[id]; return; }
    pr.done = pr.done.filter(d => plain(d) && Number.isInteger(d.n) && typeof d.at === 'number');
    // a flat-day paddle names its session; one not known here is still a day done
    pr.done.forEach(d => { if (d.water !== undefined && !WATER_IDS.includes(d.water)) delete d.water; });
    // a day the Surf check took (see SURF CHECKS)
    pr.done.forEach(d => { if (d.check !== undefined && d.check !== true) delete d.check; });
    // "Not today" for the check, which only lasts the day it was said
    if (pr.checkLater !== undefined && pr.checkLater !== dayKey(Date.now())) delete pr.checkLater;
    // the surfs beside it (none from before there were any), and how the
    // paddle-out felt where it was said
    pr.surfs = (Array.isArray(pr.surfs) ? pr.surfs : []).filter(x => plain(x) && typeof x.at === 'number').slice(-SURFS_CAP);
    pr.surfs.forEach(x => { if (x.paddle !== undefined && !ownKey(PADDLE_FEEL, x.paddle)) delete x.paddle; });
    // easing back in after time off, as noted (see noteEase)
    const e = pr.ease;
    if (e !== undefined && !(plain(e) && Number.isInteger(e.n) && e.n >= 0 && (e.steps === 1 || e.steps === 2)
                             && Number.isInteger(e.days) && e.days > 0)) delete pr.ease;
  });
  s.levels = cleanLevels(s.levels);
  s.checks = cleanChecks(s.checks);
  if (!Array.isArray(s.mixStyles)) s.mixStyles = ['emom', 'short', 'amrap'];
  s.mixStyles = [...new Set(s.mixStyles.filter(id => INTERVALS[id]))].slice(0, 3);
  if (s.mixStyles.length < 2) s.mixStyles = ['emom', 'short', 'amrap'];
  if (!Array.isArray(s.regions) || !s.regions.length) s.regions = REGIONS.map(r => r.id);
  if (!Array.isArray(s.excluded)) s.excluded = [];
  if (!Array.isArray(s.recent)) s.recent = [];
  // a favourite can't open without its seed and request, and a session in
  // history is known by its key and when it was
  if (!Array.isArray(s.saved)) s.saved = [];
  s.saved = s.saved.filter(x => plain(x) && Number.isInteger(x.seed) && x.seed > 0 && plain(x.request));
  if (!Array.isArray(s.history)) s.history = [];
  s.history = s.history.filter(h => plain(h) && typeof h.key === 'string' && typeof h.at === 'number').slice(0, HISTORY_CAP);
  // the moves swapped in (see SWAP A MOVE), where there are any: checked
  // again against the workout when it opens
  [...s.saved, ...s.history].forEach(x => {
    if (x.swaps === undefined) return;
    const swaps = cleanSwaps(x.swaps);
    if (swaps.length) x.swaps = swaps; else delete x.swaps;
  });
  // how it felt, when someone said (older sessions have nothing)
  s.history.forEach(h => {
    if (h.feel === undefined) return;
    const feel = plain(h.feel) ? Object.fromEntries(['a', 'b'].filter(w => ownKey(FEEL_LABEL, h.feel[w])).map(w => [w, h.feel[w]])) : {};
    if (Object.keys(feel).length) h.feel = feel; else delete h.feel;
  });
  if (!Array.isArray(s.blockedTags)) s.blockedTags = [];
  if (s.people !== 1 && s.people !== 2) s.people = 1;
  if (!TIME_OPTIONS.includes(s.minutes)) s.minutes = 20;
  fitMixMinutes(s);
  if (!TEXT_SCALES.includes(s.textScale)) s.textScale = 1;
  if (typeof s.nameA !== 'string') s.nameA = '';
  if (typeof s.nameB !== 'string') s.nameB = '';
  // A save from before the sound choice, or from a tab on an older release
  // (which leaves it out), has the two tick boxes it replaced: Mute audio
  // is No sound, and Beep even on silent (on unless it was unticked) is
  // Beeps even on silent, off is Beeps over my music. They're kept in step
  // with it for such a tab, the second as it was under No sound. (So an
  // older tab that saves with no tab of this release open puts back the
  // choice its tick boxes had when it loaded, as it does the minutes and
  // the style: one made since in a tab now closed is lost to it.)
  s.sound = SOUNDS.includes(p.sound) ? p.sound
    : p.muteAudio === true ? 'off' : p.beepOnSilent === false ? 'music' : 'silent';
  s.muteAudio = s.sound === 'off';
  s.beepOnSilent = s.sound === 'off' ? p.beepOnSilent !== false : s.sound === 'silent';
  s.voice = s.voice !== false;
  s.showAlts = s.showAlts === true;
  s.showPhotos = s.showPhotos !== false;
  if (s.filterFocus !== 'all' && !focusLabelMap[s.filterFocus]) s.filterFocus = 'all';
  // stored prefs from before the gear question means it's not a first visit
  s.gearAsked = p.gearAsked !== false;
  if (s.todayOther !== dayKey(Date.now())) s.todayOther = null;   // only lasts the day
  return s;
}
// A level in range for each person, by a name or a spot of sensible length.
function cleanLevels(x) {
  const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const levels = {};
  if (plain(x)) {
    Object.keys(x).slice(0, 60).forEach(key => {
      const v = x[key];
      const k = plain(v) && typeof v.k === 'number' ? Math.round(v.k * 10) / 10 : NaN;
      if (key && key.length <= 30 && key !== '__proto__' && k >= LEVEL_MIN && k <= LEVEL_MAX) levels[key] = { k, easy: v.easy === 1 ? 1 : 0 };
    });
  }
  return levels;
}
// Saved with the prefs, so another tab can tell a save from this version
// (or a later one) from one made by a tab still running an older FIT. Up
// it whenever PERSISTED gains a key: an older tab's save leaves the key
// out, and taken as current it would wipe it (3: each person's levels; 4:
// the sound choice and the voice; 5: FIT picks; 6: the Surf checks).
const PREFS_SCHEMA = 6;
// From 2 on, a tab hears the others' saves (see below), so its lists are
// as new as anyone's.
const HEARS_SCHEMA = 2;
function currentPrefs() {
  const out = { schema: PREFS_SCHEMA };
  PERSISTED.forEach(k => { out[k] = state[k]; });
  return out;
}
// The levels are kept under a key of their own as well, which a tab on an
// older release never writes. Its saves leave them out of the prefs, and a
// tab of this release open then writes them back (below); with none open,
// the next one to load takes them from here. Saved first, so a tab that
// hears the prefs finds them already there.
const LEVELS_KEY = 'fit-levels-1';
const LEVELS_SCHEMA = 3;         // the first prefs with the levels in
const hasLevels = (p) => p.schema >= LEVELS_SCHEMA && p.levels !== undefined;
function storedLevels() {
  try {
    const x = JSON.parse(localStorage.getItem(LEVELS_KEY));
    return x && typeof x === 'object' && !Array.isArray(x) ? cleanLevels(x) : null;
  } catch (e) { return null; }
}
// The voice switch (4) is kept the same way, so a tab on an older release
// saving can't turn it back to the default. The sound choice needs no key
// of its own: such a tab saves the two tick boxes it came from, and a
// save without it is read from them (see cleanPrefs).
const VOICE_KEY = 'fit-voice-1';
const VOICE_SCHEMA = 4;
const hasVoice = (p) => p.schema >= VOICE_SCHEMA && typeof p.voice === 'boolean';
function storedVoice() {
  try {
    const v = JSON.parse(localStorage.getItem(VOICE_KEY));
    return typeof v === 'boolean' ? v : null;
  } catch (e) { return null; }
}
// And FIT picks (5): a tab on an older release saves the style it shows,
// and nothing to say FIT picks, which read from the style alone (see
// cleanPrefs) would turn it off for anyone who had chosen a style before.
const PICKS_KEY = 'fit-picks-1';
const PICKS_SCHEMA = 5;
const hasPicks = (p) => p.schema >= PICKS_SCHEMA && typeof p.styleAuto === 'boolean';
function storedPicks() {
  try {
    const v = JSON.parse(localStorage.getItem(PICKS_KEY));
    return typeof v === 'boolean' ? v : null;
  } catch (e) { return null; }
}
// And the Surf check results (6), the same way as the levels: a tab on an
// older release saves without them, and a tab of this release writes
// them back, or the next one to open takes them from here.
const CHECKS_KEY = 'fit-checks-1';
const CHECKS_SCHEMA = 6;
const hasChecks = (p) => p.schema >= CHECKS_SCHEMA && Array.isArray(p.checks);
function storedChecks() {
  try {
    const x = JSON.parse(localStorage.getItem(CHECKS_KEY));
    return Array.isArray(x) ? cleanChecks(x) : null;
  } catch (e) { return null; }
}
function savePrefs() {
  if (!prefsLoaded) return;
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(state.levels));
    localStorage.setItem(CHECKS_KEY, JSON.stringify(state.checks));
    localStorage.setItem(VOICE_KEY, JSON.stringify(state.voice));
    localStorage.setItem(PICKS_KEY, JSON.stringify(state.styleAuto));
  } catch (e) { /* as below */ }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(currentPrefs()));
  } catch (e) { /* private mode / quota: preferences just won't stick */ }
}
// Another tab saved (one left open from before, or the one a shared link
// opened). Its history, favourites and program progress are the newest,
// and already include this tab's (each tab hears the other's saves), so
// take them in. Otherwise this tab's next save would write its older copy
// over them. Settings stay as they are here until a reload, so a workout
// on screen isn't changed under you.
//
// A tab from before that hears nothing, so what it writes is the copy it
// loaded when it opened. That gets added to this tab's lists rather than
// taking their place, and saved straight back, so a session or program
// day done here isn't lost to it.
//
// A tab on a release since (schema 2 or 3) hears, so its lists are taken
// as they are, sessions it finished and favourites it took out with them.
//
// The first two don't know the levels, and leave them out: they're taken
// from their own key (LEVELS_KEY), or stay as they are here, and are
// saved straight back, and none of them know the Surf checks, kept the
// same way (CHECKS_KEY). None of them know the voice switch or FIT picks,
// settings, so they stay as they are here, and the next load finds them
// under their own keys (VOICE_KEY, PICKS_KEY).
window.addEventListener('storage', (e) => {
  if (e.key !== PREFS_KEY || !e.newValue) return;
  let p, theirs;
  try { p = JSON.parse(e.newValue); theirs = cleanPrefs(p); } catch (err) { return; }
  if (!(p.schema >= HEARS_SCHEMA)) {
    mergeOlderSave(theirs);
  } else {
    state.history = theirs.history;
    state.saved = theirs.saved;
    state.programs = theirs.programs;
  }
  // levels move on with the history, as a session finishes, and the
  // checks as a check does
  let back = false;
  if (hasLevels(p)) state.levels = theirs.levels;
  else { state.levels = storedLevels() || state.levels; back = true; }
  if (hasChecks(p)) state.checks = theirs.checks;
  else { state.checks = storedChecks() || state.checks; back = true; }
  if (back) savePrefs();
  // redraw whatever lists them, and FIT's pick, which goes by the sessions
  if (state.view === 'welcome') renderToday();
  else if (state.view === 'library') renderLibrary();
  else if (state.view === 'program') renderProgram();
  else if (state.view === 'setup') renderIntervalPicker();
});
// An older tab's lists (checked, see cleanPrefs) added to this tab's: its
// sessions not already here (the same session, reopened within the merge
// window, counts as here), its favourites by seed, and its program days by
// day number.
function mergeOlderSave(p) {
  const extra = p.history.filter(h => !state.history.some(x =>
    x.key === h.key && Math.abs(x.at - h.at) < HISTORY_MERGE_MS));
  state.history = [...state.history, ...extra].sort((a, b) => b.at - a.at).slice(0, HISTORY_CAP);
  state.saved = [...p.saved.filter(s => !state.saved.some(x => x.seed === s.seed)), ...state.saved];
  Object.entries(p.programs).forEach(([id, theirs]) => {
    const ours = state.programs[id];
    if (!ours) { state.programs[id] = theirs; return; }
    const extra = theirs.done.filter(d => d && !ours.done.some(x => x.n === d.n));
    if (extra.length) ours.done = [...ours.done, ...extra].sort((a, b) => a.at - b.at);
  });
}

// What a session is for. Surf fitness builds around paddling, pop-ups,
// stance and shoulder care instead of target areas.
const GOALS = [
  { id: 'general', label: 'General fitness', hint: '' },
  { id: 'surf', label: 'Surf fitness',
    hint: 'Built around what surfing asks of you: paddle strength, a fast pop-up, legs and balance for turns, and shoulder care. Target areas don\'t apply.' }
];

// ---------------------------------------------------------------- gear
// What setup shows. Kettlebells are one item with the bells you own ticked
// underneath; the exercises' kb15 and kb10 are roles (the heavier bell and
// the lighter one) filled from that list, so the generator and saved
// workouts never see a particular weight.
const GEAR = [
  { id: 'kettlebells', label: 'Kettlebells', weights: 'kb' },
  { id: 'barbell10', label: 'Barbell', weights: 'bar' },
  { id: 'dumbbells', label: 'Dumbbells', weights: 'db' },
  { id: 'rope', label: 'Skipping rope' },
  { id: 'rings', label: 'Rings' },
  { id: 'pullupBar', label: 'Pull-up bar' },
  { id: 'bands', label: 'Resistance bands' },
  { id: 'medball', label: 'Medicine / slam ball' },
  { id: 'box', label: 'Box or bench' }
];
const WEIGHT_CHOICES = {
  kb:  { label: 'Kettlebells you have', many: true, kg: [4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32] },
  db:  { label: 'Dumbbell pairs you have', many: true, kg: [2, 3, 4, 5, 6, 7.5, 8, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30] },
  bar: { label: 'Barbell loaded to', many: false, kg: [10, 15, 20, 25, 30, 35, 40, 50, 60] }
};
// Saved weights, checked; or, from before weights existed, the two old
// kettlebell switches turned into a list (and with neither bell on,
// kettlebells switched off in `equipment`).
function cleanWeights(w, oldEquip, equipment) {
  const pick = (list, ok) => Array.isArray(list) ? [...new Set(list.filter(x => ok.includes(x)))].sort((a, b) => a - b) : null;
  if (w && typeof w === 'object') {
    return { kb: pick(w.kb, WEIGHT_CHOICES.kb.kg) || [10, 15],
             db: pick(w.db, WEIGHT_CHOICES.db.kg) || [],
             bar: WEIGHT_CHOICES.bar.kg.includes(w.bar) ? w.bar : 10 };
  }
  const kb = [10, 15].filter(kg => oldEquip[kg === 15 ? 'kb15' : 'kb10'] !== false);
  if (!kb.length) equipment.kettlebells = false;
  return { kb: kb.length ? kb : [10, 15], db: [], bar: 10 };
}
// The lighter role: the bell (or pair) nearest two thirds of the heaviest.
function lighterOf(list) {
  const top = Math.max(...list);
  const under = list.filter(x => x < top);
  if (!under.length) return null;
  return under.reduce((best, x) => Math.abs(x - top * 2 / 3) <= Math.abs(best - top * 2 / 3) ? x : best);
}
// Equipment as the generator sees it: the gear switches, with the two
// kettlebell roles on only when there are bells to fill them.
function effectiveEquip() {
  const e = { ...state.equipment };
  const kb = state.equipment.kettlebells !== false ? state.weights.kb : [];
  e.kb15 = kb.length >= 1;
  e.kb10 = kb.length >= 2;
  delete e.kettlebells;
  return e;
}
// The weight each role stands for, for the cards.
function loadsFor(weights) {
  const kg = (n) => `${n}kg`;
  const L = { bar: `${weights.bar}kg bar` };
  if (weights.kb.length) {
    L.kb15 = kg(Math.max(...weights.kb));
    const light = lighterOf(weights.kb);
    if (light) L.kb10 = kg(light);
  }
  if (weights.db.length) {
    L.dbHeavy = kg(Math.max(...weights.db));
    L.dbLight = kg(lighterOf(weights.db) || Math.max(...weights.db));
  }
  return L;
}
// The bells a mate can take in an AMRAP or For Time lap (see amrapCircuits
// in js/workouts.js) while the other lap holds the kettlebell roles in
// `taken`: for each one, a lighter bell nobody's using, the heaviest left
// for the heavier role and the one nearest two thirds of the heavier for
// the lighter (one person can use one bell for both). Never a heavier one:
// a lighter-bell move (a press, a snatch) never goes up to the top bell.
// So with 8, 12, 16 and 24, a mate swings the 12 rather than doing good
// mornings while you've got the 24 and the 16. A role with none lighter
// spare is left out, and that move goes to its bodyweight version, as it
// did (with 16 and 24, a mate's press while you've got the 16).
function spareLoads(weights, taken) {
  const bells = state.equipment.kettlebells !== false ? weights.kb : [];
  if (!bells.length) return {};
  const top = Math.max(...bells), light = lighterOf(bells);
  const held = new Set(taken.map(r => (r === 'kb15' ? top : r === 'kb10' ? light : null)).filter(kg => kg !== null));
  const free = bells.filter(kg => !held.has(kg)).sort((a, b) => b - a);
  const out = {};
  const heavy = free.filter(kg => kg < top);
  if (taken.includes('kb15') && heavy.length) out.kb15 = `${heavy[0]}kg`;
  const lighter = light === null ? [] : free.filter(kg => kg < light);
  if (taken.includes('kb10') && lighter.length) {
    const heavier = taken.includes('kb15') ? (heavy[0] || top) : top;
    out.kb10 = `${lighter.reduce((best, kg) => (Math.abs(kg - heavier * 2 / 3) < Math.abs(best - heavier * 2 / 3) ? kg : best))}kg`;
  }
  return out;
}
const hasEquip = (id) => effectiveEquip()[id] !== false;
const currentInterval = () => INTERVALS[state.intervalStyle] || INTERVALS[DEFAULT_INTERVAL];
// A generated workout carries the interval it was built for, so a saved
// favourite replays as built without overwriting the interval chosen in
// setup. The classics have none of their own and take whatever is selected.
const intervalFor = (w) => (w && w.intervalId && INTERVALS[w.intervalId]) || currentInterval();
// The sections a workout runs as: a mix's own list, or one section of the
// whole workout at its interval.
function sectionsOf(w) {
  if (w.sections) return w.sections;
  return [{ intervalId: intervalFor(w).id, start: 0, count: w.blocks.length, minutes: 0, blockRestSec: w.blockRestSec }];
}
// A workout's style for history and comparisons: 'stretch' for a stretch
// routine, 'check' for a Surf check, 'mix', or the interval's id.
const styleIdOf = (w) => (w.format === 'stretch' || w.format === 'check' ? w.format : w.sections ? 'mix' : intervalFor(w).id);
// The cards' context for one person ('a', the default, or 'b'): their
// level comes with it (see personScale). The spare bells only for a build
// that says so (see SPARE_BELLS): one built before them, a favourite, a
// session in history, a link or one to pick up, keeps the mate's lap it had.
const buildCtx = (w, ivOverride, who = 'a') => {
  const iv = ivOverride || intervalFor(w);
  return { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, reps: !!iv.reps, lap: !!iv.lap,
           hasEquip, loads: loadsFor(state.weights), repScale: (w && w.repScale) || undefined,
           level: personScale(w, who), spare: withSpares(w) ? (taken) => spareLoads(state.weights, taken) : undefined };
};
// A new build is marked as one with the spare bells (request.spare), and
// the mark goes with its request wherever that's kept, so it's built the
// same way again; a build from before them has none, and a classic never
// does. A tab on the release before ignores it.
const SPARE_BELLS = 1;
const withSpares = (w) => !!(w && w.generated && w.request && w.request.spare === SPARE_BELLS);

// ------------------------------------------------------------- levels
// How each person said a session felt (see PERSONAL LEVELS in
// js/workouts.js), as the finish screen and history say it.
const FEEL_LABEL = { easy: 'Too easy', right: 'About right', cooked: 'Cooked' };
// The names on the cards: this phone's own, or while a workout opened
// from a shared link is on screen (or one picked up that was), the names
// it came with, so each card says what the same card on the other phone
// does, and each person's level, swaps and results go to them. They're
// never saved over this phone's: Dave opening Wayne's link for the two of
// them is still Dave here after. Let go as you leave it (see setView).
let namesShown = null;           // { a, b }, or null for this phone's own
const nameOn = (which) => (((namesShown || { a: state.nameA, b: state.nameB })[which]) || '').trim();
// Whose level it is: the person's name, or with no name set, their spot
// ('#a', '#b'), so it follows Wayne whichever spot he's in.
function levelKey(which) {
  const name = nameOn(which).toLowerCase();
  return name ? name.slice(0, 30) : `#${which}`;
}
// Each person's level for a new build, for its request: undefined while
// nobody's is away from 1, so the request is what it always was.
function personalScales() {
  const out = {};
  (state.people === 2 ? ['a', 'b'] : ['a']).forEach(w => {
    const key = levelKey(w);
    if (ownKey(state.levels, key) && state.levels[key].k !== 1) out[key] = state.levels[key].k;
  });
  return Object.keys(out).length ? out : undefined;
}
// The level a workout was built at for whoever is in this spot now: by
// name, so with Dave and Wayne swapped round each keeps their own reps,
// and someone it wasn't built for gets the plain targets.
function personScale(w, who) {
  const s = w && w.repScales;
  const key = levelKey(who);
  return (ownKey(s, key) && s[key]) || undefined;
}

// -------------------------------------------------------------- swaps
// Who's in each spot now, for their swaps (see SWAPS in js/workouts.js),
// which go by name like the levels: with Dave and Wayne swapped round, each
// keeps their own. And a context with a person's swaps for one block in.
const swapKeys = () => ({ a: levelKey('a'), b: levelKey('b') });
const withSwaps = (ctx, map) => (Object.keys(map).length ? { ...ctx, swaps: map } : ctx);
// A workout with these swaps on it, checked against its blocks: a copy, so
// a classic in the library is never changed, and none left on it when
// there are none.
function swapped(w, list) {
  const swaps = cleanSwaps(list, w);
  const out = { ...w };
  if (swaps.length) out.swaps = swaps; else delete out.swaps;
  return out;
}
// A record's swaps, for keeping: undefined when there are none.
const keptSwaps = (w) => (w && Array.isArray(w.swaps) && w.swaps.length ? w.swaps.map(x => ({ ...x })) : undefined);

// Classics carry no bookends of their own; derive them once at load.
CLASSICS.forEach(w => Object.assign(w, classicBookends(w)));

// =====================================================================
// ELEMENTS
// =====================================================================
const $ = (id) => document.getElementById(id);
const els = {
  welcomeView: $('welcomeView'), setupView: $('setupView'),
  libraryView: $('libraryView'), workoutView: $('workoutView'), programView: $('programView'),
  pathProgram: $('pathProgram'), programBody: $('programBody'), programNote: $('programNote'),
  btnProgramBack: $('btnProgramBack'), programTitle: $('programTitle'),
  pathLibrary: $('pathLibrary'), pathProgramGo: $('pathProgramGo'), todayCard: $('todayCard'),
  gearView: $('gearView'), onboardGear: $('onboardGear'), btnGearDone: $('btnGearDone'),
  onboardPeople: $('onboardPeople'), onboardWeights: $('onboardWeights'), gearNote: $('gearNote'),
  btnGearRestore: $('btnGearRestore'), updateBar: $('updateBar'),
  btnMoreOptions: $('btnMoreOptions'), moreOptions: $('moreOptions'), moreSummary: $('moreSummary'),
  scroller: $('scroller'), scrollHint: $('scrollHint'),
  welcomeNote: $('welcomeNote'), welcomeSub: $('welcomeSub'),
  btnFullscreen: $('btnFullscreen'), installHint: $('installHint'),

  btnSetupBack: $('btnSetupBack'), setupTitle: $('setupTitle'),
  peoplePicker: $('peoplePicker'), nameInputs: $('nameInputs'),
  nameA: $('nameA'), nameB: $('nameB'),
  equipmentPicker: $('equipmentPicker'), weightPicker: $('weightPicker'), timePicker: $('timePicker'), timeHint: $('timeHint'),
  mixPicker: $('mixPicker'), gearSetPicker: $('gearSetPicker'), goalPicker: $('goalPicker'), goalHint: $('goalHint'), rowRegions: $('rowRegions'),
  intervalPicker: $('intervalPicker'),
  bodyMap: $('bodyMap'), regionPicker: $('regionPicker'), tagPicker: $('tagPicker'),
  btnOpenExclude: $('btnOpenExclude'), excludeSummary: $('excludeSummary'),
  excludePanel: $('excludePanel'), excludeSearch: $('excludeSearch'),
  excludeList: $('excludeList'), excludeCount: $('excludeCount'),
  btnClearExclude: $('btnClearExclude'),
  btnBuild: $('btnBuild'), buildNote: $('buildNote'),

  btnLibraryBack: $('btnLibraryBack'), libraryTitle: $('libraryTitle'),
  focusFilter: $('focusFilter'), librarySections: $('librarySections'),
  libraryNote: $('libraryNote'),

  btnBack: $('btnBack'), workoutTitle: $('workoutTitle'), peopleBadge: $('peopleBadge'),
  awayBar: $('awayBar'), awayText: $('awayText'), btnAwayBack: $('btnAwayBack'), btnAwayKept: $('btnAwayKept'),
  overallProgress: $('overallProgress'), blockName: $('blockName'), roundDots: $('roundDots'),
  phaseBleed: $('phaseBleed'), ring: $('phaseRing'),
  timerCard: $('timerCard'), phaseLabel: $('phaseLabel'),
  timeDisplay: $('timeDisplay'), totalTime: $('totalTime'),
  exerciseGrid: $('exerciseGrid'), labelA: $('labelA'), labelB: $('labelB'),
  exerciseA: $('exerciseA'), repsA: $('repsA'), cueA: $('cueA'), animA: $('animA'), alternativeA: $('alternativeA'),
  personB: $('personB'), exerciseB: $('exerciseB'), repsB: $('repsB'), cueB: $('cueB'),
  levelA: $('levelA'), levelB: $('levelB'), finishA: $('finishA'), finishB: $('finishB'),
  circuitA: $('circuitA'), counterA: $('counterA'), circuitB: $('circuitB'), counterB: $('counterB'),
  animB: $('animB'), alternativeB: $('alternativeB'),
  upcoming: $('upcoming'), preStart: $('preStart'),
  previewList: $('previewList'), previewHint: $('previewHint'), swapA: $('swapA'), swapB: $('swapB'),
  btnShuffle: $('btnShuffle'), btnSave: $('btnSave'), btnShare: $('btnShare'),
  btnStart: $('btnStart'), btnSkip: $('btnSkip'), btnReset: $('btnReset'), btnAgain: $('btnAgain'),
  workoutNote: $('workoutNote'), goingNote: $('goingNote'),
  showPhotos: $('showPhotos'), showAlts: $('showAlts'),
  soundBox: $('soundBox'), soundPicker: $('soundPicker'), soundHint: $('soundHint'),
  voiceToggle: $('voiceToggle'), voiceOn: $('voiceOn'), soundSaid: $('soundSaid'), btnSoundJump: $('btnSoundJump')
};

const PHASE_COLOR = {
  work:      { hex: '#14b8a6', rgb: '20,184,166' },
  rest:      { hex: '#ef4444', rgb: '239,68,68' },
  blockrest: { hex: '#ef4444', rgb: '239,68,68' },
  warmup:    { hex: '#0d9488', rgb: '13,148,136' },
  cooldown:  { hex: '#0d9488', rgb: '13,148,136' },
  stretch:   { hex: '#a855f7', rgb: '168,85,247' }
};
const PHASE_LABEL = {
  work: 'Work', rest: 'Rest', blockrest: 'Block rest',
  warmup: 'Warm-up', cooldown: 'Cool-down', stretch: 'Stretch'
};
// What Skip skips: one stretch of a stretch routine, all of the warm-up or
// cool-down (one tap, as when it was one card), otherwise the block. The
// hyphens don't break, so a phone's narrow button wraps "Skip / warm-up".
const SKIP_LABEL = { stretch: 'Skip', warmup: 'Skip warm\u2011up', cooldown: 'Skip cool\u2011down' };
const focusClassMap = {
  'whole-body': 'whole', 'upper-body': 'upper', 'lower-body': 'lower',
  'core': 'core', 'stretching': 'stretching'
};
const focusLabelMap = {
  'whole-body': 'Whole body', 'upper-body': 'Upper body', 'lower-body': 'Lower body',
  'core': 'Core', 'stretching': 'Stretching'
};

// =====================================================================
// DURATION + SEQUENCE
// =====================================================================
const fmtMin = (sec) => `${Math.round(sec / 60 * 10) / 10} min`;

// Real phase math, so a card can never claim a length the timer doesn't
// run. Rounds once at the end rather than rounding the parts separately.
function durationParts(w) {
  if (w.format === 'stretch') {
    const total = stretchList(w).reduce((s, x) => s + x.hold, 0);
    return { totalMin: Math.round(total / 60), totalSec: total, workMin: null, bookendsMin: null };
  }
  // a Surf check's minutes are about how long it takes (its hold seldom runs out)
  if (w.format === 'check') return { totalMin: checkMinutes(w), totalSec: checkSeconds(w), workMin: null, bookendsMin: null };
  const secs = sectionsOf(w);
  const work = secs.reduce((t, x) => t + sectionSeconds(x), 0) + (secs.length - 1) * (w.changeoverSec || 0);
  const bookend = w.warmupSec + w.cooldownSec;
  return {
    totalMin: Math.round((work + bookend) / 60), totalSec: work + bookend,
    workMin: Math.round(work / 60), bookendsMin: Math.round(bookend / 60)
  };
}

// What the warm-up and cool-down work around (see WARM-UP AND COOL-DOWN in
// js/workouts.js): the gear here now, and the leave-outs the workout was
// built with as well as today's.
function bookendOpts(w) {
  const both = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
  return { hasEquip, blockedTags: both(state.blockedTags, w.request && w.request.blockedTags),
           excluded: both(state.excluded, w.builtWith && w.builtWith.excluded) };
}

function buildSequence(workout, people) {
  const seq = [];
  const isDuo = people === 2;
  const pair = (ex) => isDuo ? { a: ex, b: ex } : { a: ex, b: null };

  if (workout.format === 'tabata') {
    // the warm-up's moves, each its own phase, both people on the same one
    const around = bookendOpts(workout);
    const warm = warmupPlan(workout, around);
    warm.forEach((m, i) => {
      const ex = warmupCard(m.id, m.sec);
      seq.push({ kind: 'warmup', duration: m.sec, warmIdx: i, totalWarm: warm.length,
                 name: `Warm-up ${i + 1} of ${warm.length}: ${ex.name}`, ...pair(ex) });
    });
    const total = workout.blocks.length;
    const secs = sectionsOf(workout);
    // the first block of each style says how the style works (see styleHow),
    // once a session: each section of a mix as it starts
    const explained = new Set();
    secs.forEach((sec, secIdx) => {
      const iv = sectionInterval(sec, workout.workRest);
      const explain = explained.has(iv.id) ? undefined : styleHow(iv);
      explained.add(iv.id);
      // each person's own context, so their level reaches their reps only
      const ctxA = buildCtx(workout, iv, 'a'), ctxB = buildCtx(workout, iv, 'b');
      // between the sections of a mix: a longer break that says what's next,
      // and how it works with the section's own numbers
      if (secIdx > 0) {
        const first = workout.blocks[sec.start];
        seq.push({ kind: 'blockrest', changeover: true, duration: workout.changeoverSec || CHANGEOVER_SEC,
                   blockIdx: sec.start - 1, totalBlocks: total, howTo: `${iv.label}: ${styleHow(iv)}`,
                   name: `Next: ${iv.label}${sec.minutes ? `, ${sec.minutes} min` : ''}. ${first.name}`,
                   ...pair({ name: `Next: ${iv.label}`, display: `Next: ${iv.label}`, cue: styleHow(iv), alt: '', img: null }) });
      }
      workout.blocks.slice(sec.start, sec.start + sec.count).forEach((block, i) => {
        const blockIdx = sec.start + i;
        const label = `Block ${blockIdx + 1} of ${total}: ${block.name}`;
        // and each person's swaps in this block (see SWAPS)
        const swaps = swapMaps(workout, blockIdx, swapKeys());
        const sA = withSwaps(ctxA, swaps.a), sB = withSwaps(ctxB, swaps.b);
        if (iv.lap) {
          // one phase for the whole block; each person carries their lap, and
          // in For Time how many laps of it to finish
          const lapA = amrapCircuits(block, sA, isDuo).a;
          const lapB = isDuo ? amrapCircuits(block, sB, true, sA).b : null;
          const carry = (lap) => lap && { ...lap[0], circuit: lap, lapRounds: iv.forTime ? forTimeRounds(lap.length, iv.workSec) : 0 };
          seq.push({ kind: 'work', amrap: !!iv.amrap, forTime: !!iv.forTime, duration: iv.workSec,
                     blockIdx, totalBlocks: total, name: label, explain: i ? undefined : explain, a: carry(lapA), b: carry(lapB) });
        }
        for (let round = 1; !iv.lap && round <= iv.rounds; round++) {
          // the same moves either way: duo() is deterministic, only the targets differ
          const w = isDuo ? { a: block.duo(round, sA).a, b: block.duo(round, sB).b } : { a: block.solo(round, sA), b: null };
          seq.push({ kind: 'work', duration: iv.workSec, blockIdx, round, emom: !!iv.reps,
                     totalBlocks: total, totalRounds: iv.rounds, name: label, explain: i ? undefined : explain, a: w.a, b: w.b });
          // an EMOM's rest is whatever is left of the minute, not a phase of its own
          if (iv.restSec > 0) seq.push({ kind: 'rest', duration: iv.restSec, blockIdx, round,
                     totalBlocks: total, totalRounds: iv.rounds, name: label, explain: i ? undefined : explain,
                     ...pair({ name: 'Rest', display: 'Rest', cue: 'Breathe', alt: '', img: null }) });
        }
        if (i < sec.count - 1) {
          seq.push({ kind: 'blockrest', duration: sec.blockRestSec, blockIdx, totalBlocks: total,
                     name: `Rest, then Block ${blockIdx + 2}: ${workout.blocks[blockIdx + 1].name}`,
                     ...pair({ name: 'Block rest', display: 'Block rest', cue: 'Hydrate, reset, swap equipment if needed', alt: '', img: null }) });
        }
      });
    });
    const cool = cooldownPlan(workout, around);
    cool.forEach((m, i) => {
      const ex = cooldownCard(m.id);
      seq.push({ kind: 'cooldown', duration: m.sec, coolIdx: i, totalCool: cool.length,
                 name: `Cool-down ${i + 1} of ${cool.length}: ${ex.name}`, ...pair(ex) });
    });
  } else if (workout.format === 'check') {
    // a Surf check (see SURF_CHECK): the warm-up, then each test with a
    // rest before it, the first a short get-ready and the others the rest
    // after the last test, where each person puts in how many they did
    const around = bookendOpts(workout), shape = checkShape(workout);
    const warm = warmupPlan(shape, around);
    warm.forEach((m, i) => {
      const ex = warmupCard(m.id, m.sec);
      seq.push({ kind: 'warmup', duration: m.sec, warmIdx: i, totalWarm: warm.length,
                 name: `Warm-up ${i + 1} of ${warm.length}: ${ex.name}`, ...pair(ex) });
    });
    const tests = workout.stations, total = tests.length;
    tests.forEach((t, i) => {
      const ex = EXERCISES[t.ex];
      const card = { id: t.ex, name: t.label, display: t.label, reps: t.how, cue: ex.cue, alt: ex.alt || '', img: ex.img };
      const before = tests[i - 1];
      if (!before) {
        seq.push({ kind: 'rest', check: t.id, stationIdx: i, totalStations: total, duration: workout.readySec,
                   name: `Get ready: ${t.label}`, ...pair({ name: 'Get ready', display: 'Get ready', cue: '', alt: '', img: null }) });
      } else {
        // blockIdx is the test whose count goes in
        const ask = before.hold ? null : `How many ${before.short}?`;
        seq.push({ kind: 'rest', check: t.id, stationIdx: i, totalStations: total, duration: workout.restSec,
                   blockIdx: i - 1, tally: ask ? i - 1 : undefined,
                   name: `Rest, then ${t.label}`, ...pair({ name: ask || 'Rest', display: ask || 'Rest', cue: '', alt: '', img: null }) });
      }
      seq.push({ kind: 'work', check: t.id, hold: !!t.hold, stationIdx: i, totalStations: total, blockIdx: i,
                 duration: t.sec, name: `Test ${i + 1} of ${total}: ${t.label}`, ...pair(card) });
    });
    const cool = cooldownPlan(shape, around);
    cool.forEach((m, i) => {
      const ex = cooldownCard(m.id);
      seq.push({ kind: 'cooldown', duration: m.sec, coolIdx: i, totalCool: cool.length,
                 name: `Cool-down ${i + 1} of ${cool.length}: ${ex.name}`, ...pair(ex) });
    });
  } else if (workout.format === 'stretch') {
    const list = stretchList(workout);
    list.forEach((s, idx) => {
      seq.push({ kind: 'stretch', duration: s.hold, stretchIdx: idx, totalStretches: list.length,
                 name: `Stretch ${idx + 1} of ${list.length}`,
                 ...pair({ name: s.name, cue: `${s.hold}s hold`, alt: s.alt, img: null }) });
    });
  }
  return seq;
}

// =====================================================================
// AUDIO
// An iPhone plays Web Audio on the ringer channel unless told otherwise,
// so the silent switch mutes every beep. Telling Safari the sound is
// 'playback' (the AudioSession API, iOS 16.4 and later) moves it onto the
// media channel with videos and music, which the switch leaves alone. The
// catch: playback takes over from other apps, so Spotify pauses while FIT
// has sound, and FIT gives the sound back when you leave the workout.
// Hence the choice of three: Beeps over my music (the ringer channel, so
// the music plays on and the ringer has to be on), Beeps even on silent
// (playback), and No sound. Safari on a Mac has navigator.audioSession too
// but no silent switch, so it's left to touch screens (an iPad asking for
// the desktop site still has touch points); desktop and Android get Beeps
// or No sound, and are untouched. The older trick of looping a silent
// <audio> element is left out: it puts a player on the lock screen and
// later Safaris broke it.
// =====================================================================
let audioCtx = null;
const CAN_SILENT = 'audioSession' in navigator && navigator.maxTouchPoints > 0;
// The choices as they're offered, and what each one means for you. With
// no silent switch to play through, Beeps even on silent plays as Beeps.
const SOUND_CHOICES = [
  { id: 'music', label: 'Beeps over my music', plain: 'Beeps',
    hint: 'Lets your music play. Needs the ringer on: with the silent switch on, you won\'t hear FIT.' },
  { id: 'silent', label: 'Beeps even on silent',
    hint: 'Plays with the silent switch on too, but pauses Spotify or other music while you train.' },
  { id: 'off', label: 'No sound', hint: 'No beeps and no voice. Keep an eye on the screen.' }
];
const soundShown = () => (!CAN_SILENT && state.sound === 'silent' ? 'music' : state.sound);
function setSound(id) {
  if (!SOUNDS.includes(id)) return;
  state.sound = id;
  // and the two tick boxes it took over from, for a tab on an older release
  state.muteAudio = id === 'off';
  if (id !== 'off') state.beepOnSilent = id === 'silent';
  // takes effect from the next sound, never before FIT has made one, so
  // just opening the app leaves someone's music alone; No sound has no
  // reason to keep your music paused
  if (audioCtx) applyAudioSession();
  if (id === 'off') hush();
  else if (state.running) primeVoice();      // a tap, which the voice needs
  savePrefs();
  renderSound();
}
// The choice (only what this device can do), the voice switch beside it,
// what the choice means, and the line before Start that says what you'll
// hear.
function renderSound() {
  const shown = soundShown();
  els.soundPicker.innerHTML = '';
  SOUND_CHOICES.filter(c => c.id !== 'silent' || CAN_SILENT).forEach(c => {
    const on = c.id === shown;
    const chip = tappable('chip sound-chip' + (on ? ' active' : ''), () => setSound(c.id));
    chip.textContent = !CAN_SILENT && c.plain ? c.plain : c.label;
    chip.dataset.sound = c.id;
    chip.setAttribute('aria-pressed', String(on));
    els.soundPicker.appendChild(chip);
  });
  const choice = SOUND_CHOICES.find(c => c.id === shown);
  // beeps on a desktop need no explaining
  els.soundHint.textContent = !CAN_SILENT && shown === 'music' ? '' : choice.hint;
  els.soundHint.hidden = !els.soundHint.textContent;
  els.voiceToggle.hidden = !CAN_SPEAK;
  els.voiceOn.checked = state.voice;
  els.voiceOn.disabled = shown === 'off';
  els.voiceToggle.classList.toggle('off', shown === 'off');
  const voice = CAN_SPEAK && state.voice && shown !== 'off' ? ' and the voice coach' : '';
  els.soundSaid.textContent = shown === 'off' ? 'Sound: none.'
    : !CAN_SILENT ? `Sound: beeps${voice}.`
    : shown === 'silent' ? `Sound: beeps even on silent${voice}. Your music will pause.`
    : `Sound: beeps over your music${voice}. Needs the ringer on.`;
}
function applyAudioSession() {
  if (!CAN_SILENT) return;
  const want = state.sound === 'silent' ? 'playback' : 'auto';
  try {
    if (navigator.audioSession.type !== want) navigator.audioSession.type = want;
  } catch (e) { /* a Safari that only half has it */ }
}
// Safari parks the context as 'interrupted' after a phone call or Siri,
// and 'suspended' after time away, so anything short of running gets a
// resume. It can refuse outside a tap; the next beep, tap or return to
// the app tries again.
function ensureAudio() {
  try {
    applyAudioSession();
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') Promise.resolve(audioCtx.resume()).catch(() => {});
  } catch (e) { /* no Web Audio: the timer runs silent */ }
}
// iOS can also leave the context saying 'running' with no sound: after a
// call, after another app's sound, or when the home-screen app comes back
// from the background. So once the page has been hidden, a return to a
// running workout suspends and resumes it, and the first tap after that
// (or the Start that sets it going) swaps in a new context, since a tap
// is always allowed to start sound.
let audioStale = false;
function rearmAudio() {
  const ctx = audioCtx;
  if (!ctx || ctx.state === 'closed') return ensureAudio();
  applyAudioSession();
  try { Promise.resolve(ctx.suspend()).then(() => ctx.resume()).catch(() => {}); } catch (e) { /* see beep() */ }
}
// A new context only starts on a tap, and the touch that ends a scroll
// isn't one. So the old context keeps the beeps going until the new one is
// actually running, and only then is it swapped in and the old one closed;
// until that happens audioStale stays set, so the next tap tries again.
let audioNext = null;
function freshAudio() {
  ensureAudio();
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  try {
    if (audioNext && audioNext.state === 'closed') audioNext = null;
    const next = audioNext || (audioNext = new (window.AudioContext || window.webkitAudioContext)());
    const swap = () => {
      if (audioNext !== next) return;           // let go of in the meantime
      audioNext = null;
      audioStale = false;
      const old = audioCtx;
      audioCtx = next;
      if (old && old !== next) {
        try { Promise.resolve(old.close()).catch(() => {}); } catch (e) { /* already gone */ }
      }
    };
    if (next.state === 'running') swap();
    else Promise.resolve(next.resume()).then(swap, () => {});
  } catch (e) { /* no Web Audio: the timer runs silent */ }
}
// Out of the workout, FIT lets go: the session back to 'auto' so your
// music can carry on, and the context suspended so nothing of FIT's keeps
// running in the background. The next Start takes it again.
function releaseAudio() {
  if (audioNext) {
    const next = audioNext;
    audioNext = null;
    try { Promise.resolve(next.close()).catch(() => {}); } catch (e) { /* already gone */ }
  }
  if (!audioCtx) return;
  if (CAN_SILENT) {
    try { if (navigator.audioSession.type !== 'auto') navigator.audioSession.type = 'auto'; } catch (e) { /* see applyAudioSession() */ }
  }
  try { Promise.resolve(audioCtx.suspend()).catch(() => {}); } catch (e) { /* see beep() */ }
}
// Beeps belong to the workout screen: the second note of a chime still due
// when you leave must not take the sound back from your music.
function beep(freq, duration, volume = 0.4) {
  if (state.sound === 'off' || state.view !== 'workout') return;
  try {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* audio is a nicety; never let it break the timer */ }
}
function workChime() {
  beep(880, 0.12, 0.4);
  setTimeout(() => { beep(1320, 0.6, 0.5); beep(1980, 0.5, 0.12); }, 140);
}
function restChime() {
  if (state.sound === 'off' || state.view !== 'workout') return;
  try {
    ensureAudio();
    const duration = 0.45;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.22, audioCtx.currentTime + duration - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    [160, 163].forEach(f => {
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    });
  } catch (e) { /* see beep() */ }
}
const stretchChime = () => beep(660, 0.4, 0.35);
function bigBell() {
  beep(660, 0.25, 0.5);
  setTimeout(() => beep(880, 0.25, 0.5), 220);
  setTimeout(() => beep(1320, 0.45, 0.5), 460);
}
const tickBeep = () => beep(700, 0.08, 0.3);

// The sound for arriving at a phase: the bell once the blocks are done, and
// the soft chime for each new warm-up move and each stretch after that.
function chimeFor(phase) {
  const kind = phase && phase.kind;
  if (kind === 'work') workChime();
  else if (kind === 'rest') restChime();
  else if (kind === 'blockrest' || (kind === 'cooldown' && !phase.coolIdx)) bigBell();
  else if (kind === 'stretch' || kind === 'warmup' || kind === 'cooldown') stretchChime();
}

// =====================================================================
// VOICE COACH
// The phone's own voice (speechSynthesis) says what's coming, so a move
// done face down, or with the phone across the room, doesn't need the
// screen. In each rest, the next move for each person ("Next: Wayne,
// push-ups. Dave, squats."), with the reps in an EMOM or an AMRAP when they
// fit, and "Last round" before the last; "Halfway" through the session;
// "One minute left" in a long AMRAP or For Time. A move that comes with no
// rest before it (the first block after the warm-up, an EMOM's next
// minute) is called just before it starts, and each warm-up move and
// stretch is named as it starts. The beeps keep the 3-2-1, which has to be
// on the second.
//
// What Safari does with it isn't written down anywhere, so this goes by
// what others have found, and Wayne's phone has the last word:
// - it says nothing until a tap has had it say something, so the first
//   tap that sets it going (Start, Resume, turning it on) says a silent
//   line;
// - the silent switch mutes it like the beeps unless the page has the
//   sound (Beeps even on silent, see AUDIO), so it goes by the same choice,
//   and No sound says nothing;
// - other apps' music is turned down while it talks, not paused (WebKit
//   bug 278598), so Beeps over my music keeps Spotify going;
// - a line cut off and another started at the same moment can come out as
//   silence, so the new one waits a moment;
// - it stops while the app is out of view.
// A line only starts if it can finish clear of the 3-2-1, is cut off there
// if it runs over, and goes when the phase changes, the workout pauses or
// skips, or you leave, so the voice is never behind the clock or over
// itself. Nothing else reads its lines out (aria-live): the phase and
// block already are as they change (see render), and with VoiceOver on, a
// copy would be said over the voice.
// =====================================================================
const CAN_SPEAK = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
const VOICE_RATE = 1.05;
// about how fast it talks, to tell whether a line fits: characters a
// second, and a moment to get going
const VOICE_CPS = 13, VOICE_START = 0.4;
const VOICE_CLEAR = 3.5;        // seconds kept clear at the end of a phase, for the 3-2-1
const VOICE_MOST = 12;          // seconds: a longer line is chatter
const VOICE_GAP_MS = 120;       // after a line is cut off, before the next
const VOICE_AFTER_CHIME_MS = 600;   // a new phase's line waits for its chime
// Apple's novelty voices (Bells, Zarvox...) and the Eloquence set (Eddy,
// Grandma...) are no coaches.
const NOVELTY_VOICE = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|junior|ralph|fred|kathy)\b/i;

// An Australian voice, then a British one, then any English: the phone's
// own choice among them first, then one that works without the internet.
let coachVoice = null;
function pickVoice() {
  try {
    const all = speechSynthesis.getVoices().filter(v => !NOVELTY_VOICE.test(v.name || ''));
    const lang = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
    const best = (pre) => {
      const list = all.filter(v => lang(v).startsWith(pre));
      return list.find(v => v.default) || list.find(v => v.localService) || list[0];
    };
    coachVoice = best('en-au') || best('en-gb') || best('en') || null;
  } catch (e) { coachVoice = null; }
}
if (CAN_SPEAK) {
  pickVoice();
  // the list comes in late, and can change
  try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* picked again at the first line */ }
}

// What the voice has done this go: the phase it last saw, the work whose
// moves it has called, Halfway, the phase it said One minute left in, and
// the line for work straight after this phase (said `at` seconds before
// the phase ends). And the line being said (until about when it should
// be done, in case Safari never says it's finished), one waiting to
// start, and when the next may.
const coach = { at: -1, called: -1, half: false, minute: -1, ahead: null,
                line: null, lineUntil: 0, timer: null, quietUntil: 0, primed: false };
const coachFresh = () => Object.assign(coach, { at: -1, called: -1, half: false, minute: -1, ahead: null });
const voiceOn = () => CAN_SPEAK && state.voice && state.sound !== 'off' && state.view === 'workout';
const talking = () => !!coach.timer || (!!coach.line && Date.now() < coach.lineUntil);

// Stop whatever is being said, and anything about to be: it's out of date.
function hush() {
  clearTimeout(coach.timer);
  coach.timer = null;
  if (!CAN_SPEAK) return;
  const busy = !!coach.line || speechSynthesis.speaking || speechSynthesis.pending;
  coach.line = null;
  if (!busy) return;
  coach.quietUntil = Date.now() + VOICE_GAP_MS;
  try { speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ }
}
// One line, in place of anything still being said, after `delayMs`; not
// at all if it can't start by `latest` (a busy phone can hold a timer up,
// and a line said late is a line over the 3-2-1).
function say(text, delayMs = 0, latest = Infinity) {
  if (!voiceOn() || !text) return;
  hush();
  const go = () => {
    coach.timer = null;
    if (!voiceOn() || Date.now() > latest) return;
    try {
      if (!coachVoice) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (coachVoice) u.voice = coachVoice;
      u.lang = coachVoice ? coachVoice.lang : 'en-AU';
      u.rate = VOICE_RATE;
      u.onend = u.onerror = () => { if (coach.line === u) coach.line = null; };
      // held on to, too: an older Safari let go of a line nobody held, mid-sentence
      coach.line = u;
      coach.lineUntil = Date.now() + (sayTime(text) / VOICE_RATE + 2) * 1000;
      speechSynthesis.speak(u);
    } catch (e) { coach.line = null; }
  };
  const wait = Math.max(delayMs, coach.quietUntil - Date.now());
  if (wait > 0) coach.timer = setTimeout(go, wait); else go();
}
// Safari only lets a page talk once a tap has had it say something, so
// the taps that set the voice going say a silent line first, once.
function primeVoice() {
  if (coach.primed || !voiceOn()) return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    coach.primed = true;
  } catch (e) { /* see say() */ }
}

// Words as they're said rather than read: "KB swings · 16kg" is
// "kettlebell swings, 16 kilo", "40s each side" is "40 seconds each side".
function spoken(text) {
  return String(text || '')
    .replace(/\bKB\b/g, 'kettlebell')
    .replace(/(\d+(?:\.\d+)?)\s?kg\b/gi, '$1 kilo')
    .replace(/\b(\d+)s\b/g, (m, n) => `${n} second${n === '1' ? '' : 's'}`)
    .replace(/\b(\d+) min\b/g, (m, n) => `${n} minute${n === '1' ? '' : 's'}`)
    .replace(/\/side\b/g, ' each side')
    .replace(/(\d+)\/(\d+)/g, '$1 $2')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+\/\s+|\s*·\s*/g, ', ')
    .replace(/\s+/g, ' ').trim();
}
const sayTime = (text) => VOICE_START + text.length / VOICE_CPS;
const minutesSaid = (sec) => { const m = Math.round(sec / 60); return `${m} minute${m === 1 ? '' : 's'}`; };

// One person's move as it's said: the name, with the reps and the weight,
// as far as `detail` goes (2 both, 1 the reps, 0 the name alone). The
// count comes first, so a list of them still reads: "10 push-ups", "40s of
// plank", "8 lunges each side", "1 lap of bear crawls".
function moveSaid(ex, detail) {
  if (!ex) return '';
  const reps = detail >= 1 ? ex.reps || '' : '';
  const m = /^(\d+)( reps?|s| laps?)?( each (?:side|way))?$/.exec(reps);
  const said = !reps ? ex.name
    : !m ? `${ex.name}, ${reps}`
    : m[2] === 's' || /lap/.test(m[2] || '') ? `${m[1]}${m[2]} of ${ex.name}${m[3] || ''}`
    : `${m[1]} ${ex.name}${m[3] || ''}`;
  return detail >= 2 && ex.load ? `${said}, ${ex.load}` : said;
}
// What a work phase has each person doing, each way it can be said, most
// first: "Wayne, 10 push-ups. Dave, 8 squats.", or an AMRAP's or For
// Time's list. One person, or two on the same, need no names.
function workSaid(p) {
  const duo = state.people === 2 && !!p.b;
  const both = (a, b, join) => (!duo || a === b ? `${a}.` : `${personName('a')}${join}${a}. ${personName('b')}${join}${b}.`);
  const lines = [];
  if (p.amrap || p.forTime) {
    const head = p.amrap ? `AMRAP, ${minutesSaid(p.duration)}` : `For time, ${p.a.lapRounds} rounds`;
    const list = (ex, d) => (ex ? ex.circuit : []).map(x => moveSaid(x, d)).join(', ');
    // two people on the same moves, one starting further round: the list
    // once and where the second one starts (with the reps when they're the
    // same for both)
    const sorted = (ex, d) => (ex ? ex.circuit : []).map(x => moveSaid(x, d)).sort().join();
    const round = duo && sorted(p.a, 0) === sorted(p.b, 0) && p.b.circuit.length > 1 && p.b.circuit[0].name !== p.a.circuit[0].name;
    for (const d of [1, 0]) {
      lines.push(`${head}. ${both(list(p.a, d), duo ? list(p.b, d) : '', ': ')}`);
      if (round && sorted(p.a, d) === sorted(p.b, d)) lines.push(`${head}. ${list(p.a, d)}. ${personName('b')} starts on ${p.b.circuit[0].name}.`);
    }
    lines.push(`${head}.`);
  } else {
    for (const d of [2, 1, 0]) lines.push(both(moveSaid(p.a, d), duo ? moveSaid(p.b, d) : '', ', '));
  }
  return [...new Set(lines)];
}
// The work at `w` called from the phase before it: "Next: ...", "Last
// round: ...", or at the change to another style of a mix, "Next: EMOM,
// 5 min. ..." (an AMRAP or For Time says its own).
function callSaid(w, from) {
  const p = state.sequence[w], f = state.sequence[from];
  const lap = p.amrap || p.forTime;
  const lead = f && f.changeover && !lap ? `${f.name.split('. ')[0]}. `
    : !lap && p.totalRounds > 2 && p.round === p.totalRounds ? 'Last round: ' : 'Next: ';
  return workSaid(p).map(t => lead + t);
}
// Work that's the work before it again: the same block, each person on
// the same move, reps and weight, and not the last round. Nothing calls
// it (the screen and the chime say it), so an EMOM's minutes on the same
// moves, or sprints after a rest too short to call them, aren't said over
// and over. A change of moves, a new block and the last round always are.
function sameAgain(idx) {
  const seq = state.sequence, p = seq[idx];
  if (!p || p.kind !== 'work' || p.amrap || p.forTime || (p.totalRounds > 2 && p.round === p.totalRounds)) return false;
  let j = idx - 1;
  while (j >= 0 && seq[j].kind === 'rest' && seq[j].blockIdx === p.blockIdx) j--;
  const q = seq[j];
  const same = (x, y) => (!x && !y) || (!!x && !!y && x.id === y.id && x.reps === y.reps && x.load === y.load);
  return !!q && q.kind === 'work' && q.blockIdx === p.blockIdx && same(q.a, p.a) && same(q.b, p.b);
}
// What to say as a phase starts, and the work it calls, if it does: a
// rest calls the work after it, work that nothing called says itself
// (unless it's the same again), and a warm-up move or stretch says its name.
function entrySaid(idx) {
  const seq = state.sequence, p = seq[idx], next = seq[idx + 1];
  if (p.kind === 'rest' || p.kind === 'blockrest') {
    if (!(next && next.kind === 'work')) return null;
    const lines = callSaid(idx + 1, idx);
    // after a Surf check test, how many first ("How many pop-ups? Next: ...")
    return { w: idx + 1, lines: p.tally !== undefined ? [...lines.map(l => `${p.a.name} ${l}`), ...lines] : lines };
  }
  if (p.kind === 'work') return coach.called === idx || sameAgain(idx) ? null : { w: idx, lines: workSaid(p) };
  const first = p.kind === 'warmup' ? !p.warmIdx && 'Warm-up. ' : p.kind === 'cooldown' ? !p.coolIdx && 'Cool-down. ' : '';
  return p.a ? { lines: [`${first || ''}${p.a.name}.`] } : null;
}
// Work straight after a phase with no rest between, called as late as it
// can be and still be said clear of its 3-2-1, as much of it as fits in
// the time left once the phase has started.
function aheadSaid(idx, left) {
  const seq = state.sequence, p = seq[idx], next = seq[idx + 1];
  if (!next || next.kind !== 'work' || p.kind === 'rest' || p.kind === 'blockrest' || sameAgain(idx + 1)) return null;
  for (const line of callSaid(idx + 1, idx)) {
    const t = sayTime(spoken(line));
    const at = VOICE_CLEAR + t + 0.5;
    if (t <= VOICE_MOST && at <= left - 2) return { w: idx + 1, lines: [line], at };
  }
  return null;
}
const halfDue = () => !coach.half && state.totalDuration > 120 && state.elapsedTotal >= state.totalDuration / 2;
// The most of `lines` that fits in `room` seconds, with Halfway in front
// when it's due and there's room for it (on its own if there are no
// lines), said after `delayMs`. True if anything was.
function speak(lines, room, delayMs = 0) {
  const half = halfDue();
  if (!lines.length && !half) return false;
  const options = [...(half ? (lines.length ? lines.map(l => `Halfway. ${l}`) : ['Halfway.']) : []), ...lines].map(spoken);
  const fit = options.find(t => sayTime(t) <= Math.min(room - delayMs / 1000, VOICE_MOST));
  if (!fit) return false;
  if (fit.startsWith('Halfway')) coach.half = true;
  say(fit, delayMs, Date.now() + (room - sayTime(fit)) * 1000);
  return true;
}

// Each tick of a running workout (see tickClock), and Start.
function coachTick() {
  if (!state.running || !voiceOn()) return;
  const idx = state.currentIdx, p = state.sequence[idx];
  if (!p) return;
  const left = state.remainingInPhase, room = left - VOICE_CLEAR;
  if (coach.at !== idx) {
    // a new phase: whatever was being said belongs to the one before
    coach.at = idx;
    hush();
    coach.ahead = aheadSaid(idx, left);
    const entry = entrySaid(idx);
    const fresh = left > p.duration - 1;            // not landed on part-way
    if (entry && speak(entry.lines, room, fresh ? VOICE_AFTER_CHIME_MS : 0)) {
      if (entry.w !== undefined) coach.called = entry.w;
      return;
    }
  }
  // clear for the 3-2-1: a line that ran over is cut off
  if (left <= 3) { hush(); return; }
  const a = coach.ahead;
  if (a && left <= a.at) {
    coach.ahead = null;
    if (coach.called !== a.w && speak(a.lines, room)) coach.called = a.w;
    return;
  }
  if (talking()) return;
  // a long AMRAP, or a For Time someone is still racing
  if ((p.amrap || p.forTime) && p.duration >= 180 && coach.minute !== idx && left <= 60 && left > 55
      && !(p.forTime && allDone(p))) {
    coach.minute = idx;
    if (speak(['One minute left.'], room)) return;
  }
  // Halfway on its own, when nothing else is said, and not just before a call
  if (halfDue() && !(a && left - a.at < 2)) speak([], room);
}

// =====================================================================
// WAKE LOCK
// Held from Start until the workout stops or you leave it, pauses
// included, so a water break doesn't let the phone lock. The browser lets
// go of it whenever the page is hidden; keepAwake says to ask again when
// it's back (see the visibilitychange handler).
// =====================================================================
let keepAwake = false, wakeLockAsked = false;
async function requestWakeLock() {
  keepAwake = true;
  if (!('wakeLock' in navigator) || state.wakeLock || wakeLockAsked) return;
  wakeLockAsked = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { if (state.wakeLock === lock) state.wakeLock = null; });
    state.wakeLock = lock;
  } catch (e) { /* denied or unsupported, the timer is still correct */ }
  wakeLockAsked = false;
  if (!keepAwake) releaseWakeLock();      // stopped while the request was out
}
function releaseWakeLock() {
  keepAwake = false;
  if (!state.wakeLock) return;
  const lock = state.wakeLock;
  state.wakeLock = null;
  try { lock.release(); } catch (e) { /* already gone */ }
}

// =====================================================================
// VIEWS
// =====================================================================
// A new release took over during a workout here, so the page loads again
// as you leave it (see OFFLINE AND UPDATES).
let swReloadAfterWorkout = false;
function setView(v) {
  if (swReloadAfterWorkout && v !== 'workout') { location.reload(); return; }
  state.view = v;
  if (v !== 'workout') namesShown = null;     // a link's names, for its workout only
  ['welcome', 'gear', 'setup', 'library', 'program', 'workout'].forEach(name => {
    els[name + 'View'].classList.toggle('active', v === name);
    document.body.classList.toggle('view-' + name, v === name);   // for the scroll fade (css)
  });
  els.scroller.scrollTop = 0;
  queueScrollHint();
}

/*
  Large tap targets are divs with role="button", not real <button> elements,
  because a <button> may not contain block-level content and these cards are
  full of divs. A div with role="button" plus tabindex plus the delegated
  Enter/Space handler below is announced identically to assistive technology.
*/
function tappable(className, onActivate) {
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.addEventListener('click', onActivate);
  return el;
}

/*
  A div with role="button" is not a form control, so Enter and Space do not
  activate it for free. One delegated handler covers every one of them,
  including the cards written in the markup rather than created here.
*/
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target instanceof Element && e.target.closest('[role="button"]');
  if (!el) return;
  e.preventDefault();
  el.click();
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function goWelcome() {
  stopTimer();
  state.programRun = null;
  state.programMinutes = null;
  state.workout = null;
  // someone who came in on a shared link answers the first-visit question
  // on the way home
  if (!state.gearAsked) { openGearQuestion(); return; }
  els.welcomeNote.textContent = '';
  setView('welcome');
  renderToday();
}

// ------------------------------------------------------------ today card
// The top of home: how long, how many and where, filled in from last time,
// then Start. While a program is on and today's session is still to do,
// the card is that session instead, with "Something else today" to swap
// back to a built workout for the day. A session left part-way goes above
// all of it, to pick up or let go (see RESUME).
function renderToday() {
  fillToday();
  const line = resumeLine();
  if (!line) return;
  els.todayCard.prepend(line);
  // with today's program day waiting to be resumed, Resume is the way on:
  // its Start, which builds the day afresh, becomes a small link (a Surf
  // check left part-way, only while the card is the check too)
  const run = readRun(), ps = programStatus(PROGRAMS[0]);
  const go = els.todayCard.querySelector('.program-go:not(.today-go)');
  if (go && run && run.programRun && ps && !ps.finished
      && run.programRun.id === PROGRAMS[0].id && run.programRun.n === ps.n
      && !!run.programRun.check === checkToday(PROGRAMS[0], ps.st, ps.n)) {
    go.className = 'link-btn today-fresh';
    go.textContent = 'Start a fresh one instead';
  }
}
function fillToday() {
  const card = els.todayCard;
  card.innerHTML = '';
  const prog = PROGRAMS[0];
  const ps = programStatus(prog);
  renderProgramPath(prog, ps);
  const waiting = ps && !ps.finished && !ps.doneToday;
  const today = dayKey(Date.now());
  // what FIT is, until you know: a session done or a program started
  els.welcomeSub.hidden = state.history.length > 0 || !!ps;

  if (waiting && state.todayOther !== today) {
    fillProgramDay(card, prog, ps.st, ps.day, {
      tagline: `${prog.name} · Week ${ps.day.week}, Day ${ps.n + 1}`,
      rerender: renderToday, note: els.welcomeNote
    });
    card.appendChild(linkButton('Something else today', () => { state.todayOther = today; savePrefs(); renderToday(); }));
    return;
  }

  // With a program on, its line takes the place of "Today" above the
  // name, so Start stays on the first screen of a small phone.
  let tagline = '<div class="card-tagline">Today</div>';
  if (waiting) {
    const top = document.createElement('div');
    top.className = 'today-top';
    top.appendChild(linkButton(`Back to today's ${prog.name} session`, () => { state.todayOther = null; savePrefs(); renderToday(); }));
    card.appendChild(top);
    tagline = '';
  } else if (ps && ps.doneToday) {
    const counts = ps.last.surfed ? ' (a surf counts)' : ps.last.water ? ' (a paddle counts)' : ps.last.check ? ' (the Surf check)' : '';
    tagline = `<div class="card-tagline today-line">${esc(`${prog.name}: today's done${counts}. Next up: ${ps.day.name}.`)}</div>`;
  }
  const head = document.createElement('div');
  head.innerHTML = `${tagline}<div class="card-name">Build a workout</div>`;
  const floor = mixFloor();
  card.append(head, pickerLabel('How long have you got?'),
    timeChips(TIME_OPTIONS, state.minutes, m => { state.minutes = m; savePrefs(); renderToday(); }, floor));
  if (floor > TIME_OPTIONS[0]) card.append(programHint(mixFloorText(floor)));
  card.append(...peopleGearRows(true, renderToday));
  // FIT's pick and how it works, with the way to choose your own
  if (state.styleAuto) {
    const how = document.createElement('div');
    how.className = 'today-how';
    how.textContent = `${fitPicksLine(buildStyle())} `;
    const mine = linkButton('Choose myself', () => openSetup({ styles: true }));
    mine.id = 'btnChooseStyle';
    how.appendChild(mine);
    card.append(how);
  }
  // everything else comes from last time, and Change opens the full setup
  const style = document.createElement('div');
  style.className = 'today-style';
  style.textContent = `${todayStyleText()} · `;
  const change = linkButton('Change', openSetup);
  change.id = 'pathBuild';
  change.setAttribute('aria-label', 'Change the style, goal and gear');
  style.appendChild(change);
  const go = document.createElement('button');
  go.className = 'program-go today-go';
  go.textContent = 'Start';
  go.addEventListener('click', () => {
    els.welcomeNote.textContent = '';
    const err = buildAndOpen(requestFromState());
    if (err) els.welcomeNote.textContent = err;
  });
  card.append(style, go);
}
// "FIT picks Short bursts: go hard for 20s, rest 10s, 8 rounds a block.",
// or "FIT picks a mix: EMOM, Short bursts and AMRAP, ..."
function fitPicksLine(st) {
  if (st.intervalId === 'mix') {
    const names = st.mix.map(id => INTERVALS[id].label);
    return `FIT picks a mix: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}, with a short break between each.`;
  }
  const how = styleHow(INTERVALS[st.intervalId]);
  return `FIT picks ${INTERVALS[st.intervalId].label}: ${how[0].toLowerCase()}${how.slice(1)}`;
}
// "Short bursts · General fitness" (with FIT picking, the line above says
// the style, so "General fitness"), plus target areas or things left out
// when they're set, so a choice from last time can't catch you out.
function todayStyleText() {
  const parts = [state.styleAuto ? null : styleName(buildStyle()), GOALS.find(g => g.id === state.goal).label].filter(Boolean);
  if (state.goal !== 'surf' && state.regions.length < REGIONS.length) {
    parts.push(REGIONS.filter(r => state.regions.includes(r.id)).map(r => r.label).join(', '));
  }
  const n = state.blockedTags.length + state.excluded.length;
  if (n) parts.push(`${n} thing${n === 1 ? '' : 's'} left out`);
  return parts.join(' · ');
}
// The Programs card says where you're up to.
function renderProgramPath(prog, ps) {
  els.pathProgramGo.textContent = !ps ? `Start ${prog.name} →`
    : ps.finished ? (finalCheckDue(prog, ps.st) ? `${prog.name} · the last Surf check →` : `${prog.name} · all ${prog.weeks} weeks done →`)
    : `${prog.name} · Week ${ps.day.week} of ${prog.weeks} →`;
}
function linkButton(text, onClick) {
  const b = document.createElement('button');
  b.className = 'link-btn';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// Setup, with the styles to choose from open when Choose myself opened it,
// and brought into view.
function openSetup(opts = {}) {
  // Back returns to the Programs screen when its Change opened setup
  state.setupFrom = state.view === 'program' ? 'program' : 'welcome';
  setMoreOptions(false);
  stylesOpen = !!opts.styles;
  els.btnBuild.textContent = 'Build my workout';
  els.buildNote.textContent = '';
  renderSetup();
  setView('setup');
  if (opts.styles) els.intervalPicker.closest('.picker-row').scrollIntoView({ block: 'start' });
}

// =====================================================================
// SETUP RENDERERS
// =====================================================================
function renderSetup() {
  renderGoalPicker();
  renderPeoplePicker();
  renderEquipmentPicker();
  renderTimePicker();
  renderIntervalPicker();
  renderRegionPicker();
  renderTagPicker();
  renderExcludeSummary();
  if (!els.excludePanel.hidden) renderExcludeList();
}

// ------------------------------------------------------- more options
// Target areas and things to leave out sit behind "More options", closed
// by default. They still apply when closed, so the link says what's set.
function setMoreOptions(open) {
  els.moreOptions.hidden = !open;
  els.btnMoreOptions.setAttribute('aria-expanded', String(open));
  els.btnMoreOptions.querySelector('.more-label').textContent = open ? 'Fewer options' : 'More options';
}
function renderMoreSummary() {
  const all = state.regions.length === REGIONS.length;
  const areas = state.goal === 'surf' ? 'Surf picks the areas'
    : all ? 'Whole body'
    : REGIONS.filter(r => state.regions.includes(r.id)).map(r => r.label).join(', ');
  const n = state.blockedTags.length + state.excluded.length;
  els.moreSummary.textContent = `${areas} · ${n ? `${n} thing${n === 1 ? '' : 's'} left out` : 'nothing left out'}`;
}

function renderGoalPicker() {
  els.goalPicker.innerHTML = '';
  GOALS.forEach(g => {
    const on = state.goal === g.id;
    const b = tappable('chip' + (on ? ' active' : ''), () => { state.goal = g.id; savePrefs(); renderSetup(); });
    b.textContent = g.label;
    b.setAttribute('aria-pressed', String(on));
    els.goalPicker.appendChild(b);
  });
  const goal = GOALS.find(g => g.id === state.goal);
  els.goalHint.textContent = goal.hint;
  els.goalHint.hidden = !goal.hint;
  // target areas mean nothing to a surf session
  els.rowRegions.style.display = state.goal === 'surf' ? 'none' : '';
}

function renderPeoplePicker() {
  els.peoplePicker.querySelectorAll('.chip').forEach(chip => {
    const on = Number(chip.dataset.people) === state.people;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', String(on));
  });
  els.nameInputs.classList.toggle('hidden', state.people !== 2);
}

// ------------------------------------------------------------ gear sets
// Every change to the gear or weights is saved into the selected set, so a
// set is simply "what I ticked last time I was here".
function ensureGearSets() {
  if (!state.gearSets.length) {
    state.gearSets = [{ id: 'home', name: 'Home', equipment: { ...state.equipment }, weights: structuredClone(state.weights) }];
  }
  if (!state.gearSets.some(g => g.id === state.gearSetId)) state.gearSetId = state.gearSets[0].id;
  return state.gearSets.find(g => g.id === state.gearSetId);
}
function saveIntoGearSet() {
  const set = ensureGearSets();
  set.equipment = { ...state.equipment };
  set.weights = structuredClone(state.weights);
}
// The gear in use is the first place's, or the only gear there is (the
// selected set, as ensureGearSets picks it).
const atFirstPlace = () => !state.gearSets.length
  || (state.gearSets.find(g => g.id === state.gearSetId) || state.gearSets[0]) === state.gearSets[0];
function useGearSet(id) {
  const set = state.gearSets.find(g => g.id === id);
  if (!set) return;
  state.gearSetId = id;
  state.equipment = { ...DEFAULT_EQUIPMENT, kettlebells: true, ...set.equipment };
  state.weights = structuredClone(set.weights);
  savePrefs();
  renderEquipmentPicker();
}
function renderGearSets() {
  const box = els.gearSetPicker;
  box.innerHTML = '<div class="weight-label">Training at</div>';
  const row = document.createElement('div');
  row.className = 'chip-row';
  state.gearSets.forEach(g => {
    const on = g.id === state.gearSetId;
    const c = tappable('chip gear-set' + (on ? ' active' : ''), () => { if (!on) useGearSet(g.id); });
    c.textContent = g.name;
    c.setAttribute('aria-pressed', String(on));
    row.appendChild(c);
  });
  const add = tappable('chip gear-set-add', () => {
    const name = (window.prompt('Name this gear set, for example "Mate\'s place".', '') || '').trim().slice(0, 24);
    if (!name) return;
    const id = `set-${Date.now().toString(36)}`;
    // starts as a copy of what's ticked now; change it from there
    state.gearSets.push({ id, name, equipment: { ...state.equipment }, weights: structuredClone(state.weights) });
    state.gearSetId = id;
    savePrefs();
    renderEquipmentPicker();
  });
  add.textContent = '+ New set';
  row.appendChild(add);
  box.appendChild(row);
  if (state.gearSets.length > 1) {
    const rm = document.createElement('button');
    rm.className = 'card-remove';
    rm.textContent = `Remove "${ensureGearSets().name}"`;
    rm.addEventListener('click', () => {
      state.gearSets = state.gearSets.filter(g => g.id !== state.gearSetId);
      useGearSet(state.gearSets[0].id);
    });
    box.appendChild(rm);
  }
}

function renderEquipmentPicker() {
  saveIntoGearSet();
  renderGearSets();
  els.equipmentPicker.innerHTML = '';
  els.weightPicker.innerHTML = '';
  GEAR.forEach(g => {
    const on = state.equipment[g.id] !== false;
    const b = tappable('chip' + (on ? ' active' : ''), () => {
      state.equipment[g.id] = !on;
      savePrefs();
      renderEquipmentPicker();
    });
    b.textContent = g.label;
    b.setAttribute('aria-pressed', String(on));
    els.equipmentPicker.appendChild(b);
    if (on && g.weights) els.weightPicker.appendChild(weightRow(g.weights));
  });
}
// A row of weights under an item that's switched on: tick the ones you own
// (or, for the bar, what it's loaded to). A tap redraws the screen it's on.
function weightRow(kind, rerender = renderEquipmentPicker) {
  const spec = WEIGHT_CHOICES[kind];
  const row = document.createElement('div');
  row.className = 'weight-row';
  row.innerHTML = `<div class="weight-label">${esc(spec.label)}</div>`;
  const chips = document.createElement('div');
  chips.className = 'chip-row weight-chips';
  spec.kg.forEach(kg => {
    const on = spec.many ? state.weights[kind].includes(kg) : state.weights[kind] === kg;
    const c = tappable('chip weight-chip' + (on ? ' active' : ''), () => {
      if (!spec.many) state.weights[kind] = kg;
      else state.weights[kind] = on ? state.weights[kind].filter(x => x !== kg)
                                    : [...state.weights[kind], kg].sort((a, b) => a - b);
      savePrefs();
      rerender();
    });
    c.textContent = `${kg}kg`;
    c.setAttribute('aria-pressed', String(on));
    chips.appendChild(c);
  });
  row.appendChild(chips);
  if (kind === 'kb') {
    const L = loadsFor(state.weights), n = state.weights.kb.length;
    const note = document.createElement('div');
    note.className = 'picker-hint';
    note.textContent = !n ? 'Tick at least one, or switch kettlebells off.'
      : n === 1 ? `With one bell, ${L.kb15} does everything a kettlebell can, and the lighter-bell moves go bodyweight.`
      : `${L.kb15} for swings, squats and deadlifts; ${L.kb10} for presses and single-arm work.`
        // the others are spares, for a mate who wants a bell when both of those are in use
        + (n > 2 ? ' With a mate, the others are spares for when you both want a bell at once.' : '');
    row.appendChild(note);
  }
  if (kind === 'db') {
    const L = loadsFor(state.weights);
    const note = document.createElement('div');
    note.className = 'picker-hint';
    note.textContent = !state.weights.db.length ? 'Tick your pairs and the cards will show the weight to grab.'
      : L.dbHeavy === L.dbLight ? `${L.dbHeavy} for everything.`
      : `${L.dbHeavy} for squats, rows and deadlifts; ${L.dbLight} for presses, raises and curls.`;
    row.appendChild(note);
  }
  return row;
}

function renderTimePicker() {
  els.timePicker.innerHTML = '';
  const floor = mixFloor();
  TIME_OPTIONS.forEach(m => {
    const b = tappable('chip' + (state.minutes === m ? ' active' : '') + (m < floor ? ' dim' : ''), () => {
      if (m < floor) return;
      state.minutes = m;
      savePrefs();
      renderTimePicker();
      renderIntervalPicker();     // FIT's pick goes by the time too
    });
    b.textContent = `${m} min`;
    b.setAttribute('aria-pressed', String(state.minutes === m));
    if (m < floor) b.setAttribute('aria-disabled', 'true');
    els.timePicker.appendChild(b);
  });
  els.timeHint.hidden = !(floor > TIME_OPTIONS[0]);
  els.timeHint.textContent = els.timeHint.hidden ? '' : mixFloorText(floor);
}

// FIT picks first, with today's pick and how it works; the styles to
// choose from yourself, Mix included, open under it (Choose myself), and
// stay open once one is chosen. Tapping FIT picks closes them again.
let stylesOpen = false;
function renderIntervalPicker() {
  els.intervalPicker.innerHTML = '';
  const card = (on, name, sub, blurb, pick, extra = '') => {
    const b = tappable('interval-card' + (on ? ' active' : '') + extra, () => {
      pick(); fitMixMinutes(); savePrefs(); renderIntervalPicker(); renderTimePicker();
    });
    b.innerHTML = `
      <div class="interval-name">${esc(name)}</div>
      <div class="interval-sub">${esc(sub)}</div>
      <div class="interval-blurb">${esc(blurb)}</div>`;
    b.setAttribute('aria-pressed', String(on));
    els.intervalPicker.appendChild(b);
  };
  const pick = fitPicks(state.minutes, state.goal, recentStyles());
  card(state.styleAuto, `FIT picks: ${pick.intervalId === 'mix' ? 'Mix' : styleName(pick)}`,
       pick.intervalId === 'mix' ? pick.mix.map(id => INTERVALS[id].label).join(', ') : 'A different style each session',
       styleSentence(pick), () => { state.styleAuto = true; stylesOpen = false; }, ' fit-picks');
  const open = stylesOpen || !state.styleAuto;
  // the styles to choose from, behind a link while FIT picks
  if (state.styleAuto) {
    const more = linkButton(open ? 'Hide the styles' : 'Choose myself', () => {
      stylesOpen = !stylesOpen;
      renderIntervalPicker();
    });
    more.className = 'link-btn styles-toggle';
    more.setAttribute('aria-expanded', String(open));
    els.intervalPicker.appendChild(more);
  }
  if (open) {
    Object.keys(INTERVALS).forEach(id => {
      const iv = INTERVALS[id];
      card(!state.styleAuto && !state.mixOn && state.intervalStyle === id, iv.label, `${iv.sub}${iv.reps ? '' : ` × ${iv.rounds} rounds`}`,
           iv.blurb, () => { state.styleAuto = false; state.intervalStyle = id; state.mixOn = false; });
    });
    card(!state.styleAuto && state.mixOn, 'Mix', 'Two or three styles in one session',
         'Pick the styles in the order you want them. The time is shared out so the whole session fits.',
         () => { state.styleAuto = false; state.mixOn = true; });
  }
  renderMixPicker();
}

// The styles in a mix, tapped in order (1, 2, 3), and how the time works out.
function renderMixPicker() {
  els.mixPicker.hidden = state.styleAuto || !state.mixOn;
  if (els.mixPicker.hidden) return;
  els.mixPicker.innerHTML = '<div class="weight-label">Styles, in order</div>';
  const chips = document.createElement('div');
  chips.className = 'chip-row';
  Object.keys(INTERVALS).forEach(id => {
    const at = state.mixStyles.indexOf(id);
    const c = tappable('chip mix-chip' + (at >= 0 ? ' active' : ''), () => {
      if (at >= 0) state.mixStyles = state.mixStyles.filter(x => x !== id);
      else if (state.mixStyles.length < 3) state.mixStyles = [...state.mixStyles, id];
      fitMixMinutes();
      savePrefs();
      renderMixPicker();
      renderTimePicker();
    });
    c.innerHTML = at >= 0 ? `<b>${at + 1}</b> ${esc(INTERVALS[id].label)}` : esc(INTERVALS[id].label);
    c.setAttribute('aria-pressed', String(at >= 0));
    chips.appendChild(c);
  });
  els.mixPicker.appendChild(chips);
  const note = document.createElement('div');
  note.className = 'picker-hint mix-plan';
  note.textContent = mixPlanText();
  els.mixPicker.appendChild(note);
}
// With Mix on, the shortest time on offer the mix fits in. Shorter time
// chips are dimmed, and turning Mix on or adding a style raises the minutes
// to it, so a build can't fail for want of time. FIT only picks a mix that
// fits, so with FIT picking there's no floor.
function mixFloor(s = state) {
  if (s.styleAuto || !s.mixOn || s.mixStyles.length < 2) return 0;
  const min = mixMinimumMinutes(s.mixStyles);
  return (min && TIME_OPTIONS.find(m => m >= min)) || 0;
}
function fitMixMinutes(s = state) {
  const floor = mixFloor(s);
  if (floor && s.minutes < floor) s.minutes = floor;
}
// Said under the time chips while some are dimmed.
function mixFloorText(floor) {
  return `This mix needs at least ${floor} min. For less time, take a style out or pick a single style.`;
}
function mixPlanText() {
  const s = state.mixStyles;
  if (s.length < 2) return 'Pick at least two styles.';
  const plan = planMix(state.minutes, s);
  if (plan.error) {
    const min = mixMinimumMinutes(s);
    return min ? `That mix needs at least ${min} minutes.` : plan.error;
  }
  const part = (x) => {
    const iv = INTERVALS[x.intervalId];
    return x.minutes ? `${iv.label} ${x.minutes} min` : `${iv.label} ${x.count} × 4 min`;
  };
  return `${fmtMin(plan.warmupSec)} warm-up · ${plan.sections.map(part).join(' · ')} · ` +
         `${fmtMin(plan.cooldownSec)} cool-down, with a short changeover between styles.`;
}

function renderRegionPicker() {
  renderMoreSummary();
  els.regionPicker.innerHTML = '';
  REGIONS.forEach(r => {
    const on = state.regions.includes(r.id);
    const b = tappable('chip' + (on ? ' active' : ''), () => toggleRegion(r.id));
    b.textContent = r.label;
    b.setAttribute('aria-pressed', String(on));
    els.regionPicker.appendChild(b);
  });
  // Keep the drawing and the labels showing the same truth.
  els.bodyMap.querySelectorAll('.zone').forEach(z => {
    const on = state.regions.includes(z.dataset.region);
    z.classList.toggle('on', on);
    z.setAttribute('aria-checked', String(on));
  });
}

function toggleRegion(id) {
  const i = state.regions.indexOf(id);
  if (i >= 0) state.regions.splice(i, 1);
  else state.regions.push(id);
  // Targeting nothing is not a meaningful request, fall back to everything.
  if (!state.regions.length) state.regions = REGIONS.map(r => r.id);
  savePrefs();
  renderRegionPicker();
}

function renderTagPicker() {
  renderMoreSummary();
  els.tagPicker.innerHTML = '';
  EXCLUSION_TAGS.forEach(t => {
    const on = state.blockedTags.includes(t.id);
    const b = tappable('chip' + (on ? ' active' : ''), () => {
      const i = state.blockedTags.indexOf(t.id);
      if (i >= 0) state.blockedTags.splice(i, 1); else state.blockedTags.push(t.id);
      savePrefs();
      renderTagPicker();
    });
    b.textContent = t.label;
    b.title = t.blurb;
    b.setAttribute('aria-pressed', String(on));
    els.tagPicker.appendChild(b);
  });
}

function renderExcludeSummary() {
  renderMoreSummary();
  const n = state.excluded.length;
  els.excludeSummary.textContent = n
    ? `${n} movement${n === 1 ? '' : 's'} left out (tap to edit)`
    : 'Leave out specific movements';
}

function renderExcludeList() {
  const q = state.excludeSearch.trim().toLowerCase();
  els.excludeList.innerHTML = '';
  let shown = 0;

  REGIONS.forEach(region => {
    const ids = Object.keys(EXERCISES).filter(id => {
      const ex = EXERCISES[id];
      if (ex.regions[0] !== region.id) return false;
      if (!q) return true;
      return (ex.name + ' ' + (ex.load || '') + ' ' + (ex.cue || '')).toLowerCase().includes(q);
    }).sort((a, b) => EXERCISES[a].name.localeCompare(EXERCISES[b].name));
    if (!ids.length) return;

    const head = document.createElement('div');
    head.className = 'exclude-group';
    head.textContent = region.label;
    els.excludeList.appendChild(head);

    ids.forEach(id => {
      shown++;
      const off = state.excluded.includes(id);
      const row = document.createElement('label');
      row.className = 'exclude-item' + (off ? ' off' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = off;
      cb.addEventListener('change', () => {
        const i = state.excluded.indexOf(id);
        if (cb.checked && i < 0) state.excluded.push(id);
        else if (!cb.checked && i >= 0) state.excluded.splice(i, 1);
        row.classList.toggle('off', cb.checked);
        savePrefs();
        renderExcludeSummary();
        renderExcludeCount();
      });
      const label = document.createElement('span');
      const ex = EXERCISES[id];
      // Include the load: four movements exist at two weights, and without
      // it those rows are indistinguishable from each other.
      label.textContent = ex.name + (ex.load ? ` · ${ex.load}` : '')
                        + (ex.cue ? `, ${ex.cue}` : '');
      row.appendChild(cb);
      row.appendChild(label);
      els.excludeList.appendChild(row);
    });
  });

  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'exclude-empty';
    empty.textContent = 'Nothing matches that search.';
    els.excludeList.appendChild(empty);
  }
  renderExcludeCount();
}

function renderExcludeCount() {
  const total = Object.keys(EXERCISES).length;
  els.excludeCount.textContent =
    `${state.excluded.length} of ${total} excluded · ${total - state.excluded.length} available`;
}

// =====================================================================
// BUILDING A WORKOUT
// =====================================================================
function requestFromState() {
  const style = buildStyle();
  return {
    minutes: state.minutes,
    people: state.people,
    intervalId: style.intervalId,
    mix: style.mix,
    goal: state.goal === 'surf' ? 'surf' : undefined,
    regions: state.regions.slice(),
    blockedTags: state.blockedTags.slice(),
    repScales: personalScales(),
    spare: SPARE_BELLS
  };
}

// The style a build gets: FIT's pick for the time, the goal and the
// sessions before (see FIT PICKS in js/workouts.js), or the one chosen in
// setup. { intervalId } or { intervalId: 'mix', mix }.
function buildStyle() {
  if (state.styleAuto) return fitPicks(state.minutes, state.goal, recentStyles());
  return state.mixOn ? { intervalId: 'mix', mix: state.mixStyles.slice() } : { intervalId: state.intervalStyle };
}
// The styles of the sessions in history, newest first, as FIT picks reads
// them: a mix as 'mix' and the styles in it, and stretching left out.
function recentStyles() {
  return state.history
    .filter(h => ownKey(INTERVALS, h.intervalId) || h.intervalId === 'mix')
    .filter(h => !STRETCH_ROUTINES.some(x => x.id === h.workoutId))
    .map(h => (h.intervalId === 'mix' ? ['mix', ...((h.request && Array.isArray(h.request.mix)) ? h.request.mix : [])] : [h.intervalId]));
}
// A style as it reads on screen: "Long efforts", or "Mix: EMOM, Short
// bursts, AMRAP"; and how it works, in a sentence (see styleHow).
const styleName = (st) => (st.intervalId === 'mix' ? `Mix: ${st.mix.map(id => INTERVALS[id].label).join(', ')}` : INTERVALS[st.intervalId].label);
const styleSentence = (st) => (st.intervalId === 'mix'
  ? `${st.mix.length === 3 ? 'Three' : 'Two'} styles in one session, with a short break between each.`
  : styleHow(INTERVALS[st.intervalId]));

// Equipment and exclusions always come from live state, never from a stored
// request: a favourite reopened with the kettlebells switched off has to
// adapt, and a Shuffle after it has to respect the current filters. The
// recency list defaults to live too; a replay overrides it with the list the
// original build used, so the seed rebuilds exactly what was saved.
function liveOpts(request, extra) {
  return {
    ...request,
    equipment: effectiveEquip(),
    excluded: state.excluded.slice(),
    recent: state.recent.slice(),
    ...extra
  };
}

// Builds a workout: the workout, or { error }.
function buildWorkout(request, seed, extra) {
  const opts = liveOpts(request, { seed: seed || newSeed(), ...extra });
  const w = generateWorkout(opts);
  // the gear and leave-outs it was built with, so a link passed on from
  // here rebuilds this workout, not one for this device's gear
  if (!w.error) w.builtWith = { equipment: opts.equipment, excluded: opts.excluded };
  // and a mate's lap with the spare bells, where its request had them
  if (!w.error && request && request.spare === SPARE_BELLS) w.request.spare = SPARE_BELLS;
  return w;
}
// Builds and opens a workout, with any moves swapped in it (a favourite's,
// say). Returns an error message, or null on success.
function buildAndOpen(request, seed, extra, swaps) {
  const w = buildWorkout(request, seed, extra);
  if (w.error) return w.error;
  state.lastRequest = request;
  openWorkout(swapped(w, swaps));
  return null;
}

const newSeed = () => (Math.floor(Math.random() * 0x7fffffff) || 1);

// =====================================================================
// LIBRARY
// =====================================================================
function openLibrary() {
  renderFocusFilter();
  renderLibrary();
  setView('library');
}

// True when anything in the workout would fall back to a bodyweight
// version under the current equipment selection.
function workoutAdapted(w) {
  if (w.format === 'stretch') return false;
  const ctx = buildCtx(w);
  return w.blocks.some(b => (b.ids || []).some(id => resolveEx(id, ctx).adapted));
}

function renderFocusFilter() {
  const list = [{ id: 'all', label: 'All' },
                ...Object.keys(focusLabelMap).map(id => ({ id, label: focusLabelMap[id] }))];
  els.focusFilter.innerHTML = '';
  list.forEach(f => {
    const b = tappable('chip' + (state.filterFocus === f.id ? ' active' : ''), () => {
      state.filterFocus = f.id;
      savePrefs();
      renderFocusFilter();
      renderLibrary();
    });
    b.textContent = f.label;
    b.setAttribute('aria-pressed', String(state.filterFocus === f.id));
    els.focusFilter.appendChild(b);
  });
}

const inFocus = (focus) => state.filterFocus === 'all' || focus === state.filterFocus;

// One section: a heading, an optional action, and a grid of cards.
function librarySection(title, subtitle, cards, action) {
  if (!cards.length) return null;
  const wrap = document.createElement('section');
  wrap.className = 'library-section';
  const head = document.createElement('div');
  head.className = 'section-head';
  const h = document.createElement('div');
  h.className = 'section-title';
  h.textContent = title;
  head.appendChild(h);
  if (subtitle) {
    const sub = document.createElement('div');
    sub.className = 'section-sub';
    sub.textContent = subtitle;
    head.appendChild(sub);
  }
  if (action) head.appendChild(action);
  wrap.appendChild(head);
  const grid = document.createElement('div');
  grid.className = 'workout-grid';
  cards.forEach(c => grid.appendChild(c));
  wrap.appendChild(grid);
  return wrap;
}

function renderLibrary() {
  els.libraryTitle.textContent = 'Saved & ready-made';
  els.libraryNote.textContent = '';
  els.librarySections.innerHTML = '';

  const sections = [];

  // Saved first, then recent, so a generated session you liked but didn't
  // save is still findable afterwards.
  sections.push(librarySection('Saved', null,
    state.saved.filter(s => inFocus(s.focus || 'whole-body')).map(savedCard)));

  const history = state.history.filter(h => inFocus(h.focus));
  if (history.length) {
    const clear = document.createElement('button');
    clear.className = 'mini-btn section-action';
    clear.textContent = 'Clear history';
    // two taps, like Reset, so one stray tap can't wipe every session
    let clearTimer = null;
    clear.addEventListener('click', () => {
      if (!clear.dataset.sure) {
        clear.dataset.sure = '1';
        clear.textContent = 'Tap again to clear';
        clearTimer = setTimeout(() => { delete clear.dataset.sure; clear.textContent = 'Clear history'; }, 3000);
        return;
      }
      clearTimeout(clearTimer);
      state.history = [];
      savePrefs();
      renderLibrary();
    });
    sections.push(librarySection(
      'Recent', 'Kept on this device only', history.map(historyCard), clear));
  }

  sections.push(librarySection('The classics', null,
    CLASSICS.filter(w => inFocus(w.focus)).map(namedCard)));
  sections.push(librarySection('Stretch & mobility', null,
    STRETCH_ROUTINES.filter(w => inFocus(w.focus)).map(namedCard)));

  const live = sections.filter(Boolean);
  if (!live.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nothing here with that focus.';
    els.librarySections.appendChild(empty);
  }
  live.forEach(sec => els.librarySections.appendChild(sec));
  // backing up and moving everything, whatever the focus (see YOUR DATA)
  els.librarySections.appendChild(dataSection());
}

function namedCard(w) {
  const parts = durationParts(w);
  const card = tappable('workout-card ' + focusClassMap[w.focus], () => openWorkout(w));
  const detail = parts.workMin !== null
    ? `<div class="card-time-detail">${parts.workMin} min work + ${parts.bookendsMin} min warm-up/cool-down</div>` : '';
  const adapted = workoutAdapted(w)
    ? '<div class="card-adapted">Adapted for your equipment</div>' : '';
  // a classic runs in the style last picked in setup, so the card says which
  const style = w.format === 'tabata'
    ? `<span>·</span> <span class="card-style">${esc(intervalFor(w).label)}</span>` : '';
  card.innerHTML = `
    <div class="card-name">${esc(w.name)}</div>
    <div class="card-tagline">${esc(w.tagline)}</div>
    <div class="card-meta">
      <span class="duration">${parts.totalMin} min</span>
      <span>·</span>
      <span class="focus-tag ${focusClassMap[w.focus]}">${focusLabelMap[w.focus]}</span>
      ${style}
    </div>
    ${detail}
    <div class="card-blurb">${esc(w.blurb)}</div>
    ${adapted}`;
  return card;
}

// How a history entry's style reads, by the name it's picked by: "Short
// bursts", "EMOM", or for a mix "Mix: EMOM, Short bursts, AMRAP". A stretch
// routine is "Stretching" (older entries kept the style picked in setup).
function styleLabel(rec) {
  if (rec.intervalId === 'stretch' || STRETCH_ROUTINES.some(x => x.id === rec.workoutId)) return 'Stretching';
  if (rec.intervalId === 'check') return 'Three tests';
  if (rec.intervalId === 'mix') {
    const list = (rec.request && rec.request.mix) || [];
    return `Mix: ${list.map(id => (INTERVALS[id] || {}).label).filter(Boolean).join(', ')}`;
  }
  return (INTERVALS[rec.intervalId] || {}).label || '';
}

// An AMRAP session's rounds, block by block ("Rounds: 4 · 5 · 4"), or a
// For Time one's finishing times ("Times: 3:12 · 2:58 · capped"). A block
// skipped with no score shows as "–".
function scoreLine(rec) {
  if (!rec.scores || !rec.scores.some(s => s.a || s.b)) return '';
  // each block knows its kind of score; older entries go by the style
  const kind = (s) => s.t || (rec.intervalId === 'fortime' ? 'fortime' : 'amrap');
  const scored = rec.scores.filter(s => s.t !== null);
  const mixed = new Set(scored.map(kind)).size > 1;
  const one = (s, w) => {
    const v = s[w];
    const val = s.skipped && !v ? '–' : kind(s) === 'fortime' ? (v ? fmt(v) : 'capped') : (v || 0);
    return mixed ? `${kind(s) === 'fortime' ? 'time' : 'rounds'} ${val}` : val;
  };
  const row = (w) => scored.map(s => one(s, w)).join(' · ');
  const what = mixed ? 'Scores' : kind(scored[0]) === 'fortime' ? 'Times' : 'Rounds';
  const text = rec.people === 2
    ? `${what}: ${nameIn(rec, 'a')} ${row('a')}, ${nameIn(rec, 'b')} ${row('b')}`
    : `${what}: ${row('a')}`;
  return `<div class="card-score">${esc(text)}</div>`;
}
// How it felt, when someone said (older sessions have nothing): "Felt too
// easy", or with two "Wayne: too easy · Dave: cooked".
function feelLine(rec) {
  const f = rec.feel;
  if (!f) return '';
  const say = (w) => FEEL_LABEL[f[w]].toLowerCase();
  const text = rec.people === 2
    ? ['a', 'b'].filter(w => f[w]).map(w => `${nameIn(rec, w)}: ${say(w)}`).join(' · ')
    : f.a ? `Felt ${say('a')}` : '';
  return text ? `<div class="card-feel">${esc(text)}</div>` : '';
}
// Who was A or B in a history entry: the name kept with it, or for older
// entries that kept none, today's name.
function nameIn(rec, which) {
  if (!rec.names) return personName(which);
  return rec.names[which] || (which === 'a' ? 'Person A' : 'Person B');
}
// "solo", "Wayne & Dave", or "2 people" when nobody was named (or the
// entry is from before names were kept).
function whoLabel(rec) {
  if (rec.people === 1) return 'solo';
  return rec.names && (rec.names.a || rec.names.b) ? `${nameIn(rec, 'a')} & ${nameIn(rec, 'b')}` : '2 people';
}

function historyCard(rec) {
  const wrap = document.createElement('div');
  wrap.className = 'workout-card history-card ' + (focusClassMap[rec.focus] || 'whole');
  const alreadySaved = rec.generated && state.saved.some(s => s.seed === rec.seed);
  // a program day goes by its own name ("Pop-ups & legs"), not "Surf fitness · 20 min"
  const prog = rec.program;
  wrap.innerHTML = `
    <div class="card-name">${esc(prog ? prog.day : rec.name)}</div>
    <div class="card-tagline">${esc(whenLabel(rec.at))}${prog ? ` · ${esc(prog.where)}` : ''}</div>
    <div class="card-meta">
      <span class="duration">${rec.minutes} min</span>
      <span><span class="sep">·</span> ${esc(whoLabel(rec))}</span>
      <span><span class="sep">·</span> ${esc(styleLabel(rec))}</span>
    </div>
    <div class="card-blurb">${esc(rec.blurb || '')}</div>
    ${scoreLine(rec)}
    ${feelLine(rec)}
    ${rec.completed ? '<div class="card-done">Finished</div>'
                    : '<div class="card-part">Started, not finished</div>'}`;
  wrap.addEventListener('click', () => {
    const err = openFromRecord(rec);
    if (err) els.libraryNote.textContent = err;
  });

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  // Only generated sessions are worth saving; the named ones are already
  // listed further down.
  if (rec.generated) {
    const save = document.createElement('button');
    save.className = 'card-remove';
    save.textContent = alreadySaved ? 'Already saved' : 'Save to favourites';
    save.disabled = alreadySaved;
    save.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.saved.some(x => x.seed === rec.seed)) return;
      state.saved.unshift({
        name: rec.name, blurb: rec.blurb, focus: rec.focus, seed: rec.seed,
        request: rec.request, frozen: rec.frozen || undefined, swaps: rec.swaps, savedOn: new Date().toLocaleDateString()
      });
      savePrefs();
      keepStorage();
      renderLibrary();
    });
    actions.appendChild(save);
  }
  const rm = document.createElement('button');
  rm.className = 'card-remove';
  rm.textContent = 'Remove';
  rm.addEventListener('click', (e) => {
    e.stopPropagation();
    state.history = state.history.filter(h => !(h.key === rec.key && h.at === rec.at));
    savePrefs();
    renderLibrary();
  });
  actions.appendChild(rm);
  wrap.appendChild(actions);
  return wrap;
}

function savedCard(saved) {
  const wrap = document.createElement('div');
  wrap.className = 'workout-card ' + (focusClassMap[saved.focus] || 'whole');
  wrap.innerHTML = `
    <div class="card-name">☆ ${esc(saved.name)}</div>
    <div class="card-tagline">Saved ${esc(saved.savedOn || '')}</div>
    <div class="card-blurb">${esc(saved.blurb || '')}</div>`;
  wrap.addEventListener('click', () => {
    const err = openFromRecord({ ...saved, generated: true });
    if (err) els.libraryNote.textContent = err;
  });
  const rm = document.createElement('button');
  rm.className = 'card-remove';
  rm.textContent = 'Remove';
  rm.addEventListener('click', (e) => {
    e.stopPropagation();
    state.saved = state.saved.filter(x => x.seed !== saved.seed);
    savePrefs();
    renderLibrary();
  });
  wrap.appendChild(rm);
  return wrap;
}

// =====================================================================
// WORKOUT VIEW
// =====================================================================
// A note that asks for a tap to go again ("Back to 7:30. Tap Resume when
// you're ready.") sits under the block's name, on the first screen, and
// goes as soon as the clock does. On a phone on its side the ask makes way
// (the button is just under it), and so does how a style works (css).
function noteUntilGoing(text) {
  els.goingNote.textContent = text ? `${text} ` : '';
  if (text) {
    const tap = document.createElement('span');
    tap.className = 'going-tap';
    tap.textContent = `Tap ${els.btnStart.textContent} when you're ready.`;
    els.goingNote.appendChild(tap);
  }
  els.goingNote.hidden = !text;
  els.workoutView.classList.toggle('going-noted', !!text);
}
const clearGoingNote = () => noteUntilGoing('');

function openWorkout(workout) {
  stopTimer();
  state.workout = workout;
  state.sequence = buildSequence(workout, state.people);
  // AMRAP rounds counted this session (and For Time's times, and the
  // rounds done towards them), and what this workout scored last time
  state.scores = {};
  state.laps = {};
  state.pick = {};
  state.skipped = [];
  state.skippedSec = 0;
  // a Surf check's entry, once it's kept (see recordCheck)
  state.checkAt = null;
  state.holdDoneAt = null;
  coachFresh();
  const before = state.history.find(h => h.key === historyKey(workout) && h.scores
    && h.intervalId === styleIdOf(workout));       // a classic can be run in any style
  state.lastScores = before ? lastScoresFrom(before) : null;
  state.totalDuration = state.sequence.reduce((s, p) => s + p.duration, 0);
  seekTo(0);
  state.running = false;
  state.started = false;
  disarmBack();
  hideAway();

  // a program day goes by its own name ("Paddle & shoulders"), as on home
  // and in history, not "Surf fitness · 20 min"
  const run = programRunLabel();
  els.workoutTitle.textContent = run ? run.day : workout.name;
  els.peopleBadge.textContent = peopleText();
  els.exerciseGrid.classList.toggle('solo', state.people === 1);
  els.personB.style.display = state.people === 1 ? 'none' : '';
  els.labelA.textContent = state.people === 1 ? 'You' : personName('a');
  els.labelB.textContent = personName('b');
  els.swapA.setAttribute('aria-label', state.people === 1 ? 'Swap this move' : `Swap ${personName('a')}'s move`);
  els.swapB.setAttribute('aria-label', `Swap ${personName('b')}'s move`);

  // Shuffle and Save only mean something for a generated session.
  const gen = !!workout.generated;
  els.btnShuffle.style.display = gen ? '' : 'none';
  els.btnSave.style.display = gen ? '' : 'none';
  renderSaveButton();
  // a Surf check is your own numbers, not a workout to pass on
  els.btnShare.style.display = workout.format === 'check' ? 'none' : '';
  els.workoutNote.textContent = '';
  clearGoingNote();

  if (state.sequence[0]) enterPhaseVisual(state.sequence[0].kind, state.remainingInPhase);
  renderPreview();
  setView('workout');
  render();
}

// Who it's for, on the badge beside the name: "1 person", "2 people", or
// "Wayne & Dave". Before Start a tap on it changes 1 for 2 and back (see
// flipPeople), and it says so.
function peopleText() {
  return state.people === 1 ? '1 person'
    : (nameOn('a') || nameOn('b') ? `${personName('a')} & ${personName('b')}` : '2 people');
}
const canFlipPeople = () => !!state.workout && !state.started && state.workout.format !== 'check' && !isFinished();
function renderPeopleBadge() {
  const can = canFlipPeople();
  els.peopleBadge.disabled = !can;
  els.peopleBadge.classList.toggle('can-flip', can);
  // what a tap does, in words beside it (css)
  els.peopleBadge.dataset.flip = can ? (state.people === 1 ? 'Add a mate' : 'Just me?') : '';
  els.peopleBadge.setAttribute('aria-label', can
    ? `${peopleText()}. Tap for ${state.people === 1 ? 'two people' : 'one person'}` : peopleText());
}
// The same workout, for one more or one fewer: the moves stay as they
// are, and they're shared out again for the people training. Each keeps
// the level it was built at, as a favourite does (a new mate gets the
// plain targets). Once Start is pressed it stays as it is (the timeline
// would change under the clock); a Surf check asks for its people first.
function flipPeople() {
  if (!canFlipPeople()) return;
  state.people = state.people === 1 ? 2 : 1;
  savePrefs();
  renderPeoplePicker();
  openWorkout(state.workout);
  // and says so on the first screen, with how to go back
  noteUntilGoing(`Now for ${peopleText()}. Tap the badge again for ${state.people === 1 ? 'two' : 'one'}.`);
}
els.peopleBadge.addEventListener('click', flipPeople);

// Save: a favourite this isn't yet, or one saved without the swaps made
// since (see SWAP A MOVE), which a tap puts in it; otherwise Saved.
function renderSaveButton() {
  const w = state.workout;
  const fav = w && w.generated && state.saved.find(s => s.seed === w.seed);
  const same = fav && JSON.stringify(fav.swaps || []) === JSON.stringify(keptSwaps(w) || []);
  const n = (keptSwaps(w) || []).length;
  els.btnSave.textContent = !fav ? '☆ Save as favourite' : same ? '★ Saved' : `☆ Save with the swap${n === 1 ? '' : 's'}`;
  els.btnSave.disabled = !!same;
}

function personName(which) {
  return nameOn(which) || (which === 'a' ? 'Person A' : 'Person B');
}
// Last time's scores, each moved to whoever made it: with Dave and Wayne
// swapped round, each still sees their own, and a new name sees none. An
// unnamed person only matches the same spot. Entries from before names
// were kept go by spot. A block skipped without a score has no last time.
function lastScoresFrom(rec) {
  const score = (s, v) => (v && !(s.skipped && !s[v]) ? s[v] : undefined);
  if (!rec.names) return rec.scores.map(s => s && ({ ...s, a: score(s, 'a'), b: score(s, 'b') }));
  const now = { a: nameOn('a'), b: state.people === 2 ? nameOn('b') : '' };
  const spots = rec.people === 2 ? ['a', 'b'] : ['a'];
  const from = (w) => [w, ...spots].find(v => spots.includes(v) && rec.names[v] === now[w] && (now[w] || v === w));
  const fa = from('a'), fb = from('b');
  return rec.scores.map(s => s && ({ ...s, a: score(s, fa), b: score(s, fb) }));
}

function renderPreview() {
  const w = state.workout;
  if (!w) return;
  els.previewList.innerHTML = '';
  // a block's moves are buttons: a tap swaps one (see SWAP A MOVE)
  els.previewHint.hidden = !canSwap(w);
  const add = (name, sub, moves) => {
    const li = document.createElement('li');
    const n = document.createElement('div');
    n.className = 'preview-item-name';
    n.textContent = name;
    li.appendChild(n);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'preview-item-sub';
      s.textContent = sub;
      li.appendChild(s);
    }
    if (moves) {
      const row = document.createElement('div');
      row.className = 'preview-moves';
      moves.forEach(m => {
        const b = document.createElement('button');
        b.className = 'preview-move';
        b.dataset.block = m.block;
        b.dataset.from = m.from;
        b.textContent = m.text;
        b.setAttribute('aria-label', `${m.text}: swap it`);
        row.appendChild(b);
      });
      li.appendChild(row);
    }
    els.previewList.appendChild(li);
  };

  if (w.notes && w.notes.length) add('Heads up', w.notes.join(' '));

  if (w.format === 'stretch') {
    stretchList(w).forEach((s, i) => add(`${i + 1}. ${s.name}`, `${s.hold}s hold`));
    return;
  }
  if (w.format === 'check') {
    // each test and the one way of doing it, so the numbers mean the same every time
    const around = bookendOpts(w), shape = checkShape(w);
    add('How it works', 'Each test is done the same way every time, so the numbers compare. After each minute, put in how many you did. In the paddle hold, tap Done when your chest touches down.');
    add(`Warm-up: ${fmtMin(w.warmupSec)}`, warmupPlan(shape, around).map(m => warmupCard(m.id, m.sec).name).join(' · '));
    w.stations.forEach((t, i) => add(`Test ${i + 1}: ${t.label}${t.hold ? `, up to ${fmtMin(t.sec)}` : ''}`, t.standard));
    add(`Cool-down: ${fmtMin(w.cooldownSec)}`, cooldownPlan(shape, around).map(m => cooldownCard(m.id).name).join(' · '));
    return;
  }
  // the warm-up and cool-down by their moves, as the timer will run them
  const fitAround = bookendOpts(w);
  if (w.warmupSec > 0) add(`Warm-up: ${fmtMin(w.warmupSec)}`, warmupPlan(w, fitAround).map(m => warmupCard(m.id, m.sec).name).join(' · '));
  // two people at different levels: each one's reps ("Burpees (Wayne 9 reps, Dave 7 reps)")
  const duo = state.people === 2;
  const short = (which) => nameOn(which) || which.toUpperCase();
  sectionsOf(w).forEach((sec, si) => {
    const iv = sectionInterval(sec, w.workRest);
    const ctxA = buildCtx(w, iv, 'a'), ctxB = buildCtx(w, iv, 'b');
    if (si > 0) add(`Change over: ${fmtMin(w.changeoverSec || CHANGEOVER_SEC)}`, `Next up, ${iv.label}: ${styleHow(iv)}`);
    w.blocks.slice(sec.start, sec.start + sec.count).forEach((b, j) => {
      const i = sec.start + j;
      // with each person's swaps in: one who swapped a move does another
      const swaps = swapMaps(w, i, swapKeys());
      const sA = withSwaps(ctxA, swaps.a), sB = withSwaps(ctxB, swaps.b);
      const both = (id) => {
        const a = describeEx(id, sA), bx = duo ? describeEx(id, sB) : a;
        if (bx.id !== a.id) return `${withReps(a)} for ${short('a')}, ${withReps(bx)} for ${short('b')}`;
        return bx.reps === a.reps ? withReps(a) : `${a.display || a.name} (${short('a')} ${a.reps}, ${short('b')} ${bx.reps})`;
      };
      // once each: a two-weight block's pair reads as one move
      const moves = [];
      (b.ids || []).forEach(id => { const text = both(id); if (!moves.some(m => m.text === text)) moves.push({ text, block: i, from: id }); });
      add(`Block ${i + 1}: ${b.name}`,
          `${iv.forTime ? `For time, ${iv.workSec / 60} min cap` : iv.amrap ? `AMRAP, ${iv.workSec / 60} min` : iv.reps ? `EMOM, ${iv.rounds} min` : `${iv.label}, ${iv.rounds} × ${iv.workSec}s`}`,
          moves);
    });
  });
  if (w.cooldownSec > 0) {
    // the two sides of a stretch read as one here: "Low lunge, both sides"
    const names = cooldownPlan(w, fitAround).map(m => cooldownCard(m.id).name)
      .filter((n, i, all) => !(/, right$/.test(n) && all[i - 1] === n.replace(/right$/, 'left')))
      .map(n => n.replace(/, left$/, ', both sides'));
    add(`Cool-down: ${fmtMin(w.cooldownSec)}`, names.join(' · '));
  }
}

const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

// An exercise as it reads in a list or preview: in an EMOM, with its reps.
const withReps = (ex) => {
  const name = ex.display || ex.name;
  return ex.reps ? `${name} · ${ex.reps}` : name;
};

function setAlt(el, alt) {
  el.textContent = alt || '';
  el.classList.toggle('has-alt', !!alt);
}

// The exercise shows as a turning 3D figure (js/move/deck.js). render()
// runs several times a second, so only touch it when the exercise changes:
// swapping it restarts the rep and resets any turn the user gave it.
function updateAnim(el, ex) {
  const key = ex && ex.img ? (ex.id || ex.img) : '';
  // tapping the figure opens the full 3D view with coaching
  el.dataset.move = key;
  el.setAttribute('aria-label', key ? `${ex.name}: how to do it` : '');
  if (el.dataset.shown === key) return;
  el.dataset.shown = key;
  el.innerHTML = key ? '<span class="ex-3d" aria-hidden="true">How to</span>' : '';
  showFigure(el, key);
}
function showFigure(el, key, opts) {
  const deck = window.FitDeck;
  if (!deck) return;                 // still loading: synced on fitdeck-ready
  if (!deck.available) { el.classList.add('no-3d'); return; }
  if (key) deck.show(el, key, opts); else deck.clear(el);
}
// the 3D module loads after this script; catch up the figures asked for so far
window.addEventListener('fitdeck-ready', () => {
  for (const el of document.querySelectorAll('.ex-anim[data-move]')) showFigure(el, el.dataset.move);
  for (const el of document.querySelectorAll('.next-thumb[data-move]')) showFigure(el, el.dataset.move, { thumb: true });
});

// ----------------------------------------------------- AMRAP and For Time
// The card lists the lap. Tapping an exercise in it shows that one's
// figure and cue; above it, AMRAP counts rounds, and For Time counts them
// to the number to do, so nobody has to keep count while puffing: +1 round
// after each, and on the last one Done logs the time. Either score is saved
// with the session in history, so the next go can be compared against it.
function renderCircuit(w, ex, phase) {
  if (phase.check) return renderCheckCount(w, phase);
  const W = w.toUpperCase();
  const list = els['circuit' + W], counter = els['counter' + W];
  const card = list.closest('.person');
  counter.classList.remove('check-count');
  const lap = ex && ex.circuit;
  card.classList.toggle('amrap', !!lap);
  list.hidden = !lap;
  counter.hidden = !(lap && (phase.amrap || phase.forTime));
  if (!lap) return;
  const k = phase.blockIdx;
  const pickKey = lapKey(w, lap);
  const pick = state.pick[pickKey] || 0;
  const listKey = `${pickKey}#${pick}#${ex.lapRounds || 0}`;
  if (list.dataset.key !== listKey) {
    list.dataset.key = listKey;
    list.innerHTML = (ex.lapRounds ? `<li class="lap-head">${ex.lapRounds} rounds of</li>` : '') + lap.map((x, i) => `
      <li class="${i === pick ? 'picked' : ''}" data-i="${i}" role="button" tabindex="0">
        <span class="lap-reps">${esc(x.reps)}</span> <span class="lap-name">${esc(x.display || x.name)}</span>
      </li>`).join('');
  }
  if (phase.forTime) return renderDone(w, counter, k, ex.lapRounds);
  if (!phase.amrap) return;
  const n = (state.scores[k] && state.scores[k][w]) || 0;
  const last = state.lastScores && state.lastScores[k] && state.lastScores[k][w];
  const countKey = `${k}:${n}:${last ?? ''}`;
  if (counter.dataset.key === countKey) return;
  counter.dataset.key = countKey;
  counter.innerHTML = `
    <button class="secondary count-less" data-step="-1" aria-label="Take one round off"${n ? '' : ' disabled'}>−</button>
    <div class="count-now"><b>${n}</b> ${n === 1 ? 'round' : 'rounds'}${last != null ? `<span>Last time ${last}</span>` : ''}</div>
    <button class="count-more" data-step="1">+1 round</button>`;
}
// For Time: the round you're on ("Round 2 of 3"), +1 round after each and
// Done on the last, which logs the time; then the time, and an undo that
// goes back to the last round.
function renderDone(w, counter, k, rounds) {
  const t = (state.scores[k] && state.scores[k][w]) || 0;
  const n = lapsDone(k, w, rounds);
  const last = state.lastScores && state.lastScores[k] && state.lastScores[k][w];
  const key = `t${k}:${t}:${n}/${rounds}:${last ?? ''}`;
  if (counter.dataset.key === key) return;
  counter.dataset.key = key;
  const lastLine = last ? `<span>Last time ${fmt(last)}</span>` : '';
  const final = n >= rounds - 1;
  counter.innerHTML = t
    ? `<button class="secondary count-less" data-step="undo" aria-label="Not done yet">↺</button>
       <div class="count-now"><b>${fmt(t)}</b> done, rest up${lastLine}</div>`
    : `<button class="secondary count-less" data-step="-1" aria-label="Take one round off"${n ? '' : ' disabled'}>−</button>
       <div class="count-now">Round <b>${n + 1}</b> of ${rounds}${lastLine}</div>
       <button class="count-more" data-step="1"${final ? ' aria-label="Done: that was the last round"' : ''}>${final ? 'Done' : '+1 round'}</button>`;
}
// A Surf check: in the rest after a test, how many each person did (one
// fewer, one or five more, and their last time); in the paddle hold, a
// big Done for when their chest touches down (said above, with how it's
// done), then the time held, with an undo.
function renderCheckCount(w, phase) {
  const W = w.toUpperCase();
  const list = els['circuit' + W], counter = els['counter' + W];
  list.closest('.person').classList.remove('amrap');
  list.hidden = true;
  const k = phase.hold ? phase.stationIdx : phase.tally;
  counter.hidden = k === undefined;
  if (k === undefined) return;
  const test = state.workout.stations[k];
  const v = (state.scores[k] && state.scores[k][w]) || 0;
  const last = lastCheck(w, test.id);
  const key = `c${k}:${v}:${last ?? ''}`;
  if (counter.dataset.key === key) return;
  counter.dataset.key = key;
  counter.classList.add('check-count');
  const lastLine = last ? `<span>Last time ${esc(checkValue(test, last))}</span>` : '';
  counter.innerHTML = !test.hold ? countButtons(test, v, lastLine)
    : v ? `<button class="secondary count-less" data-step="undo" aria-label="Not done yet">↺</button>
           <div class="count-now"><b>${fmt(v)}</b> held${lastLine}</div>`
    : `${lastLine ? `<div class="count-now">${lastLine}</div>` : ''}
       <button class="count-more check-done" data-step="done" aria-label="Done: my chest touched down">Done</button>`;
}
// One fewer, the count, one more and five more, for a test of reps.
function countButtons(test, v, lastLine = '') {
  return `<button class="secondary count-less" data-step="-1" aria-label="One fewer"${v ? '' : ' disabled'}>−</button>
    <div class="count-now"><b>${v}</b> ${esc(test.short)}${lastLine}</div>
    <button class="count-more" data-step="1" aria-label="One more">+1</button>
    <button class="count-more" data-step="5" aria-label="Five more">+5</button>`;
}
// For Time rounds finished so far, below the number to do.
const lapsDone = (k, w, rounds) => Math.min(Math.max(0, rounds - 1), (state.laps[k] && state.laps[k][w]) || 0);
// Seconds into the current phase.
const phaseElapsed = (phase) => Math.max(0, phase.duration - state.remainingInPhase);
// Everyone on the card has logged a For Time finish.
const allDone = (phase) => {
  const s = state.scores[phase.blockIdx] || {};
  return (state.people === 2 ? ['a', 'b'] : ['a']).every(w => s[w] > 0);
};

// Which exercise of an AMRAP lap the card is showing (the first, until
// another is tapped). The figure, cue and alternative follow it.
const lapKey = (w, lap) => `${w}:${lap.map(x => x.id).join(',')}`;
function shownFor(w, ex) {
  if (!ex || !ex.circuit) return ex;
  return ex.circuit[state.pick[lapKey(w, ex.circuit)] || 0] || ex.circuit[0];
}
function onCircuitTap(e) {
  const li = e.target.closest('li[data-i]');
  if (!li) return;
  const lap = e.currentTarget.dataset.key.split('#')[0];
  state.pick[lap] = +li.dataset.i;
  render();
  saveRun();
}
function onCounterTap(e) {
  const b = e.target.closest('button[data-step]');
  if (!b) return;
  const w = e.currentTarget.dataset.who;
  const phase = state.sequence[state.currentIdx];
  if (phase && phase.check) return checkTap(w, b.dataset.step, phase);
  if (!phase || !(phase.amrap || phase.forTime)) return;
  const s = state.scores[phase.blockIdx] || (state.scores[phase.blockIdx] = { a: 0, b: 0 });
  const step = b.dataset.step;
  if (phase.forTime) {
    // the rounds go up to the last; finishing that one is the time
    const rounds = phase[w].lapRounds;
    const laps = state.laps[phase.blockIdx] || (state.laps[phase.blockIdx] = { a: 0, b: 0 });
    const n = lapsDone(phase.blockIdx, w, rounds);
    if (step === 'undo') s[w] = 0;
    else if (step === '-1') laps[w] = Math.max(0, n - 1);
    else if (n + 1 < rounds) laps[w] = n + 1;
    else { laps[w] = rounds - 1; s[w] = Math.max(1, Math.round(phaseElapsed(phase))); }
  } else s[w] = Math.max(0, s[w] + +step);
  delete s.skipped;                        // done after a reset, so not skipped after all
  saveScores();
  render();
  saveRun();
}
// A count put in, or a paddle hold done (see renderCheckCount). Kept with
// the session (see RESUME) until the check finishes.
function checkTap(w, step, phase) {
  const k = phase.hold ? phase.stationIdx : phase.tally;
  if (k === undefined) return;
  const s = state.scores[k] || (state.scores[k] = { a: 0, b: 0 });
  if (phase.hold) {
    // to the second the clock is on, which it shows from here
    const held = Math.min(phase.duration, elapsedNow() - startOf(state.currentIdx));
    state.remainingInPhase = phase.duration - held;
    if (step === 'undo') s[w] = 0;
    else if (step === 'done') s[w] = Math.max(1, Math.floor(held));
  } else s[w] = Math.min(state.workout.stations[k].most, Math.max(0, (s[w] || 0) + +step));
  delete s.skipped;
  // the buttons are drawn again: from a keyboard, back on the one pressed
  const keyboard = document.activeElement && document.activeElement.closest('.round-counter');
  render();
  const again = keyboard && els['counter' + w.toUpperCase()].querySelector(`button[data-step="${step}"]`);
  if (again) again.focus();
  saveRun();
}
for (const w of ['A', 'B']) {
  els['circuit' + w].addEventListener('click', onCircuitTap);
  els['counter' + w].addEventListener('click', onCounterTap);
}
// Keep the score on this session's history entry as it goes, so it survives
// a closed tab as well as a finished workout.
function saveScores() {
  const w = state.workout;
  const entry = w && state.history.find(h => h.key === historyKey(w));
  if (!entry) return;
  const kinds = {};
  state.sequence.forEach(p => { if (p.amrap) kinds[p.blockIdx] = 'amrap'; if (p.forTime) kinds[p.blockIdx] = 'fortime'; });
  const blocks = (w.blocks || []).length;
  entry.scores = Array.from({ length: blocks }, (_, i) =>
    ({ ...(state.scores[i] || { a: 0, b: 0 }), t: kinds[i] || null }));
  savePrefs();
}

// ------------------------------------------------------ what's coming up
// The next block's exercises, in order, once each, per person, with the
// rounds each one comes round in.
function upcomingBlock() {
  const seq = state.sequence || [];
  let j = state.currentIdx + 1;
  while (j < seq.length && seq[j].kind !== 'work' && seq[j].kind !== 'stretch') j++;
  if (j >= seq.length) return null;
  const first = seq[j];
  const who = state.people === 2 ? ['a', 'b'] : ['a'];
  const lists = { a: [], b: [] };
  for (let k = j; k < seq.length; k++) {
    const p = seq[k];
    if (p.kind === 'blockrest' || p.kind === 'cooldown') break;
    if (p.kind !== 'work' && p.kind !== 'stretch') continue;
    if (first.blockIdx !== undefined && p.blockIdx !== first.blockIdx) break;
    for (const w of who) {
      // an AMRAP phase carries the whole lap
      for (const ex of (p[w] && p[w].circuit) || [p[w]]) {
        if (!ex || !ex.img) continue;
        const key = ex.id || ex.name;
        let e = lists[w].find(x => x.key === key);
        if (!e) lists[w].push(e = { key, ex, rounds: [] });
        if (p.round) e.rounds.push(p.round);
      }
    }
  }
  if (!lists.a.length && !lists.b.length) return null;
  return { title: first.name || 'Next exercises', lists, who };
}

function openNextSheet() {
  const up = upcomingBlock();
  if (!up) return;
  const label = (w) => personName(w);
  const rounds = (r) => !r.length ? '' : r.length === 1 ? `Round ${r[0]}` : `Rounds ${r.join(', ')}`;
  const card = ({ ex, rounds: r }) => `
    <div class="next-card" role="button" tabindex="0" data-move="${esc(ex.id || ex.img)}"
         aria-label="${esc(ex.display || ex.name)}: how to do it">
      <div class="next-thumb" data-move="${esc(ex.id || ex.img)}"></div>
      <div class="next-text">
        <strong>${esc(withReps(ex))}</strong>
        ${ex.cue ? `<span>${esc(ex.cue)}</span>` : ''}
        ${r.length ? `<span class="next-rounds">${esc(rounds(r))}</span>` : ''}
      </div>
    </div>`;
  document.getElementById('nextTitle').textContent = up.title;
  document.getElementById('nextCols').innerHTML = up.who.map(w => `
    <section class="next-col">
      ${up.who.length > 1 ? `<h3>${esc(label(w))}</h3>` : ''}
      ${up.lists[w].map(card).join('')}
    </section>`).join('');
  document.getElementById('nextSheet').hidden = false;
  for (const t of document.querySelectorAll('#nextCols .next-thumb')) showFigure(t, t.dataset.move, { thumb: true });
  document.getElementById('nextClose').focus();
}
function closeNextSheet() {
  const sheet = document.getElementById('nextSheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  if (window.FitDeck) for (const t of document.querySelectorAll('#nextCols .next-thumb')) window.FitDeck.clear(t);
  document.getElementById('nextCols').innerHTML = '';
}
document.getElementById('btnNextBlock').addEventListener('click', openNextSheet);
document.getElementById('nextClose').addEventListener('click', closeNextSheet);
document.getElementById('nextSheet').addEventListener('click', (e) => {
  if (e.target.id === 'nextSheet') return closeNextSheet();
  const c = e.target.closest('.next-card');
  if (c) openMove(c.dataset.move);
});

// ------------------------------------------------------- swap a move
// A move someone can't or won't do: Swap on their card (in a rest, the
// move coming up; paused, the one on it) or a tap on a move in the
// preview before Start opens up to three like it that suit the gear and
// the leave-outs (see swapCandidates in js/generator.js), as moving
// thumbnails. One tap swaps it in for the rest of the session: from a
// card just for that person (their mate's moves stay as they are), from
// the preview for both of you, in that block and any later one with the
// same move. The workout keeps it (see SWAPS in js/workouts.js), so Save,
// Share, the session in history and Resume all have it. Opening it pauses
// the clock: ten seconds of rest is too short to choose in. Leave it out
// from now on puts the move on the leave-out list for every build after.
const canSwap = (w) => !!w && w.format === 'tabata' && Array.isArray(w.blocks) && w.blocks.length > 0;
let swapping = null;            // what the sheet is swapping: { block, from, who, shown }
// What Swap on a person's card swaps ('a' or 'b'), or null when there's
// nothing to: the move coming up in a rest, the one on the card while
// paused, and in a lap the one picked.
function cardSwapTarget(which) {
  const w = state.workout, phase = state.sequence[state.currentIdx];
  if (!canSwap(w) || !phase || isFinished() || (which === 'b' && state.people !== 2)) return null;
  const rest = (phase.kind === 'rest' || phase.kind === 'blockrest') && phase.tally === undefined;
  if (!rest && !(phase.kind === 'work' && !state.running)) return null;
  let p = phase;
  if (rest) {
    let j = state.currentIdx + 1;
    while (j < state.sequence.length && state.sequence[j].kind !== 'work') j++;
    p = state.sequence[j];
  }
  const ex = p && p.blockIdx !== undefined && shownFor(which, p[which]);
  // on your own it's for whoever does the workout (see the preview's); and
  // whether the other one is on the same move then, for the sheet to say
  const mate = state.people === 2 && p && p[which === 'a' ? 'b' : 'a'];
  return ex && ex.base && w.blocks[p.blockIdx] ? { block: p.blockIdx, from: ex.base, who: state.people === 2 ? which : null, shown: ex,
                                                   together: !!(mate && !mate.circuit && mate.base === ex.base) } : null;
}
// What swapCandidates works to: the gear here now, the leave-outs now and
// the ones it was built with, and everyone's swaps in the block so far.
function swapOpts(w, blockIdx, who) {
  const around = bookendOpts(w);
  const sec = sectionsOf(w).find(x => blockIdx >= x.start && blockIdx < x.start + x.count);
  return { equipment: effectiveEquip(), excluded: around.excluded, blockedTags: around.blockedTags,
           recent: state.recent, surf: !!(w.request && w.request.goal === 'surf'), who: who || null,
           lap: !!(sec && (INTERVALS[sec.intervalId] || {}).lap), swaps: swapMaps(w, blockIdx, swapKeys()) };
}
function openSwapSheet(target) {
  const w = state.workout;
  if (!target || !canSwap(w)) return;
  if (state.running) pauseTimer();
  closeNextSheet();
  swapping = target;
  const block = w.blocks[target.block];
  const ids = swapCandidates(block, target.from, swapOpts(w, target.block, target.who));
  // what each of you does there now, the swaps in
  const maps = swapMaps(w, target.block, swapKeys());
  const now = (k) => describeEx(target.from, withSwaps(buildCtx(w, null, k), maps[k]));
  const shown = target.shown || now(target.who || 'a');
  const duo = state.people === 2;
  document.getElementById('swapTitle').textContent = `Instead of ${shown.name}`;
  const other = target.who === 'a' ? 'b' : 'a';
  document.getElementById('swapFor').textContent = !target.who ? (duo ? 'For both of you, in this workout.' : state.started ? 'For the rest of this workout.' : 'For this workout.')
    : `Just for ${personName(target.who)}, for the rest of this workout. ${personName(other)} ${target.together ? 'keeps' : 'still does'} ${now(other).name}${target.together ? '' : ' when it comes round'}.`;
  const ctx = buildCtx(w, null, target.who || 'a');
  document.getElementById('swapList').innerHTML = ids.length ? ids.map(id => {
    const ex = describeEx(id, ctx);
    return `<div class="next-card swap-card" role="button" tabindex="0" data-to="${esc(id)}" aria-label="${esc(ex.display || ex.name)}: do this instead">
        <div class="next-thumb" data-move="${esc(id)}"></div>
        <div class="next-text"><strong>${esc(ex.display || ex.name)}</strong>${ex.cue ? `<span>${esc(ex.cue)}</span>` : ''}</div>
      </div>`;
  }).join('') : '<p class="swap-none">Nothing else like it fits your gear and what you\'ve left out.</p>';
  // a move already swapped can go back to the one it was built with
  const swappedHere = (target.who ? [target.who] : ['a', 'b']).some(k => now(k).id !== describeEx(target.from, buildCtx(w, null, k)).id);
  const back = document.getElementById('swapBack');
  back.hidden = !swappedHere;
  back.textContent = `Put ${describeEx(target.from, ctx).name} back`;
  // leaving it out goes by the move on screen (a bodyweight stand-in, say)
  const leave = document.getElementById('swapLeave');
  leave.checked = state.excluded.includes(shown.id);
  leave.dataset.id = shown.id;
  document.getElementById('swapLeaveText').textContent = `Leave ${shown.name} out from now on`;
  document.getElementById('swapSheet').hidden = false;
  for (const t of document.querySelectorAll('#swapList .next-thumb')) showFigure(t, t.dataset.move, { thumb: true });
  document.getElementById('swapClose').focus();
}
function closeSwapSheet() {
  const sheet = document.getElementById('swapSheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  swapping = null;
  if (window.FitDeck) for (const t of document.querySelectorAll('#swapList .next-thumb')) window.FitDeck.clear(t);
  document.getElementById('swapList').innerHTML = '';
}
// The swaps with this one made: in its block, and in any later block with
// the same move where it's safe there too. For one person it goes over
// any swap for both of you; for both of you it takes the place of
// everyone's. `to` the move it was built with puts it back, and a swap for
// both of you that one person puts back stays with the other.
function swapsWith(w, target, to) {
  const { from } = target;
  const key = target.who ? levelKey(target.who) : null;
  const otherKey = target.who ? levelKey(target.who === 'a' ? 'b' : 'a') : null;
  let list = (w.swaps || []).slice();
  const covers = (x, k) => x.block === k && (w.blocks[k].shape === 'swap' ? w.blocks[k].ids : [from]).includes(x.from);
  w.blocks.forEach((b, k) => {
    if (k < target.block || !b.ids.includes(from)) return;
    if (k > target.block && to !== from) {
      const opts = swapOpts({ ...w, swaps: list }, k, target.who);
      if (!swapCandidates(b, from, { ...opts, only: to }).length) return;
    }
    if (!key) {
      list = list.filter(x => !covers(x, k));
      if (to !== from) list.push({ block: k, from, to });
      return;
    }
    list = list.filter(x => !(covers(x, k) && x.who === key));
    if (to !== from) { list.push({ block: k, from, to, who: key }); return; }
    const both = list.find(x => covers(x, k) && !x.who);
    if (both) {
      list = list.filter(x => x !== both);
      if (!list.some(x => covers(x, k) && x.who === otherKey)) list.push({ ...both, who: otherKey });
    }
  });
  return list;
}
// Picked: the session again with it in. A swap changes the moves, never
// the clock, so the phases line up and it carries on from where it was,
// paused, with the session in history (and the one to pick up) keeping it.
function pickSwap(to) {
  const w = state.workout, target = swapping;
  if (!w || !target) return;
  state.workout = swapped(w, swapsWith(w, target, to));
  state.sequence = buildSequence(state.workout, state.people);
  state.totalDuration = state.sequence.reduce((t, p) => t + p.duration, 0);
  closeSwapSheet();
  if (state.started) {
    rememberExercises();
    const entry = state.history.find(h => h.key === historyKey(state.workout));
    if (entry) { entry.swaps = keptSwaps(state.workout); if (!entry.swaps) delete entry.swaps; }
    savePrefs();
    const name = to === target.from ? null : describeEx(to, buildCtx(state.workout)).name;
    noteUntilGoing(name ? `Swapped in ${name}${target.who && state.people === 2 ? ` for ${personName(target.who)}` : ''}.`
      : `Back to ${describeEx(to, buildCtx(state.workout)).name}.`);
  }
  renderPreview();
  renderSaveButton();
  render();
  saveRun();
}
for (const k of ['a', 'b']) {
  els['swap' + k.toUpperCase()].addEventListener('click', () => openSwapSheet(cardSwapTarget(k)));
}
els.previewList.addEventListener('click', (e) => {
  const b = e.target.closest('.preview-move');
  if (!b || state.running) return;
  // for whoever does it: both of you, or on your own, whoever opens it
  // later (a mate from a link, you once your name's in), kept for nobody
  // in particular, so it comes back the same for them
  openSwapSheet({ block: +b.dataset.block, from: b.dataset.from, who: null });
});
document.getElementById('swapClose').addEventListener('click', closeSwapSheet);
document.getElementById('swapBack').addEventListener('click', () => { if (swapping) pickSwap(swapping.from); });
document.getElementById('swapSheet').addEventListener('click', (e) => {
  if (e.target.id === 'swapSheet') return closeSwapSheet();
  const c = e.target.closest('.swap-card');
  if (c) pickSwap(c.dataset.to);
});
document.getElementById('swapLeave').addEventListener('change', (e) => {
  const id = e.target.dataset.id, i = state.excluded.indexOf(id);
  if (e.target.checked && i < 0) state.excluded.push(id);
  else if (!e.target.checked && i >= 0) state.excluded.splice(i, 1);
  savePrefs();
});

// ------------------------------------------------------------ 3D sheet
async function openMove(id) {
  if (!id) return;
  const sheet = document.getElementById('moveSheet');
  const frame = document.getElementById('moveFrame');
  const offline = document.getElementById('moveOffline');
  // offline and never opened before: say so, rather than a browser error
  let reachable = navigator.onLine;
  if (!reachable && 'caches' in window) {
    try { reachable = !!(await caches.match('/move.html', { ignoreSearch: true })); } catch (e) { /* no cache */ }
  }
  offline.hidden = reachable;
  frame.hidden = !reachable;
  if (reachable) frame.src = `move.html?embed=1#${encodeURIComponent(id)}`;
  sheet.hidden = false;
  document.getElementById('moveClose').focus();
}
function closeMove() {
  const sheet = document.getElementById('moveSheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  // stop the 3D page rendering in the background
  document.getElementById('moveFrame').src = 'about:blank';
}
for (const id of ['animA', 'animB']) {
  const el = document.getElementById(id);
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.addEventListener('click', () => openMove(el.dataset.move));
}
document.getElementById('moveClose').addEventListener('click', closeMove);
document.getElementById('moveSheet').addEventListener('click', (e) => { if (e.target.id === 'moveSheet') closeMove(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('moveSheet').hidden) closeMove();
  else if (!document.getElementById('swapSheet').hidden) closeSwapSheet();
  else closeNextSheet();
});
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'fit-move-close') closeMove();
});

function renderSegBar(current, total, kind, unit = 'Round') {
  const row = document.createElement('div');
  row.className = 'round-row';
  const count = document.createElement('div');
  count.className = 'round-count';
  count.innerHTML = `${unit} <b>${current}</b><span class="of"> of ${total}</span>`;
  const remaining = document.createElement('div');
  remaining.className = 'remaining-tag';
  remaining.textContent = `${total - current + 1} left`;
  row.appendChild(count);
  row.appendChild(remaining);
  els.roundDots.appendChild(row);

  const segRow = document.createElement('div');
  segRow.className = 'seg-row';
  const color = PHASE_COLOR[kind];
  for (let i = 1; i <= total; i++) {
    const s = document.createElement('div');
    s.className = 'seg';
    if (i < current) s.classList.add('done');
    else if (i === current && color) {
      s.style.background = color.hex;
      s.style.boxShadow = `0 0 10px 2px rgba(${color.rgb},0.6)`;
    }
    segRow.appendChild(s);
  }
  els.roundDots.appendChild(segRow);
}

// The round, minute or move it's up to, and in the first block of a style
// how the style works (phase.explain, see buildSequence): under the count,
// or for an AMRAP or For Time, which have no count, in place of its line.
function renderRoundDots(phase) {
  els.roundDots.innerHTML = '';
  if (phase.amrap || phase.forTime) {
    const label = document.createElement('div');
    label.className = phase.explain ? 'round-count round-how' : 'round-count';
    label.textContent = phase.explain || (phase.forTime ? `Finish the rounds, ${fmtMin(phase.duration)} cap`
      : `As many rounds as you can in ${fmtMin(phase.duration)}`);
    els.roundDots.appendChild(label);
  } else if (phase.check) {
    // a Surf check: the test it's on or getting ready for, and how it's done
    renderSegBar(phase.stationIdx + 1, phase.totalStations, phase.kind, 'Test');
    const how = document.createElement('div');
    how.className = 'round-hint check-standard';
    how.textContent = state.workout.stations[phase.stationIdx].standard;
    els.roundDots.appendChild(how);
  } else if (phase.totalRounds) {
    renderSegBar(phase.round, phase.totalRounds, phase.kind, phase.emom ? 'Minute' : 'Round');
    if (phase.explain) {
      const how = document.createElement('div');
      how.className = 'round-hint';
      how.textContent = phase.explain;
      els.roundDots.appendChild(how);
    }
  } else if (phase.totalStretches) renderSegBar(phase.stretchIdx + 1, phase.totalStretches, phase.kind, 'Stretch');
  else if (phase.totalWarm) renderSegBar(phase.warmIdx + 1, phase.totalWarm, phase.kind, 'Move');
  else if (phase.totalCool) renderSegBar(phase.coolIdx + 1, phase.totalCool, phase.kind, 'Stretch');
  else if (phase.totalBlocks) {
    const label = document.createElement('div');
    label.className = 'round-count';
    label.textContent = phase.changeover ? phase.howTo
      : `Between blocks: ${phase.blockIdx + 1} to ${phase.blockIdx + 2} of ${phase.totalBlocks}`;
    els.roundDots.appendChild(label);
  }
}

// =====================================================================
// PHASE COLOUR BLEED
// The card starts each phase ringed in the phase colour; as the countdown
// runs the ring fades and an ambient wash grows behind the whole view,
// finishing exactly as the phase ends.
//
// Only opacity animates. The gradient and the ring shadow are written once
// per phase, because opacity is composited on the GPU while gradients and
// large blurred shadows are not: animating those repainted a full-screen
// gradient every frame for the whole phase, which is what made scrolling
// stutter on an iPad mid-workout.
// =====================================================================
const BLEED_START_OPACITY = 0.18;

function setBleedStartState(kind) {
  const c = PHASE_COLOR[kind];
  els.phaseBleed.style.transition = 'none';
  els.ring.style.transition = 'none';
  if (!c) {
    els.phaseBleed.style.opacity = '0';
    els.ring.style.opacity = '0';
    return;
  }
  els.phaseBleed.style.background =
    `radial-gradient(1000px 700px at 50% 0%, rgba(${c.rgb},0.34), transparent 65%)`;
  els.ring.style.boxShadow =
    `inset 0 0 0 8px ${c.hex}, 0 0 0 3px rgba(${c.rgb},0.25), 0 0 40px rgba(${c.rgb},0.55)`;
  els.phaseBleed.style.opacity = String(BLEED_START_OPACITY);
  els.ring.style.opacity = '1';
}

function beginBleed(seconds) {
  const phase = state.sequence[state.currentIdx];
  const kind = phase ? phase.kind : null;
  if (!kind || !PHASE_COLOR[kind] || seconds <= 0) return;
  void els.phaseBleed.offsetHeight;     // force reflow so the transition animates
  els.phaseBleed.style.transition = `opacity ${seconds}s linear`;
  els.ring.style.transition = `opacity ${seconds}s linear`;
  els.phaseBleed.style.opacity = '1';
  els.ring.style.opacity = '0';
}

function enterPhaseVisual(kind, seconds) {
  setBleedStartState(kind);
  if (state.running) beginBleed(seconds);
}

function freezeBleed() {
  const bleed = getComputedStyle(els.phaseBleed).opacity;
  const ring = getComputedStyle(els.ring).opacity;
  els.phaseBleed.style.transition = 'none';
  els.ring.style.transition = 'none';
  els.phaseBleed.style.opacity = bleed;
  els.ring.style.opacity = ring;
}

function clearBleed() {
  els.phaseBleed.style.transition = 'none';
  els.ring.style.transition = 'none';
  els.phaseBleed.style.opacity = '0';
  els.ring.style.opacity = '0';
}

// =====================================================================
// RENDER
// =====================================================================
// Text that's read out when it changes (aria-live) is only written then.
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

function render() {
  const phase = state.sequence[state.currentIdx];
  if (!phase) return;

  // a phase on screen means the finish screen has gone (see finish)
  els.workoutView.classList.remove('finished');
  els.btnAgain.hidden = true;
  els.finishA.hidden = els.finishB.hidden = true;
  els.timerCard.className = 'timer-card ' + phase.kind;
  let label = phase.amrap ? 'AMRAP' : phase.emom ? 'EMOM'
    : phase.changeover ? 'Change over' : phase.check && phase.kind === 'rest' && !phase.stationIdx ? 'Get ready'
    : (PHASE_LABEL[phase.kind] || '');
  els.timeDisplay.textContent = fmt(Math.ceil(state.remainingInPhase));
  if (phase.forTime) {
    // the clock counts up while you race it; once everyone's done it counts
    // down the rest of the cap
    const done = allDone(phase);
    label = done ? 'Rest' : 'For time';
    if (!done) els.timeDisplay.textContent = fmt(Math.floor(phaseElapsed(phase)));
  } else if (phase.hold) {
    // a paddle hold counts up, and stops at the longest once everyone's done
    const done = allDone(phase), s = state.scores[phase.blockIdx] || {};
    label = done ? 'Done' : 'Hold';
    els.timeDisplay.textContent = fmt(done ? Math.max(s.a || 0, s.b || 0) : Math.floor(phaseElapsed(phase)));
  }
  els.totalTime.textContent = `Total ${fmt(state.elapsedTotal)} / ${fmt(state.totalDuration)}`;
  // the phase and block are read out as they change (aria-live), so only
  // write them when they do, not five times a second
  setText(els.phaseLabel, label);
  setText(els.blockName, phase.name);
  setText(els.btnSkip, phase.check ? (phase.kind === 'work' ? 'Skip test' : 'Skip rest') : SKIP_LABEL[phase.kind] || 'Skip block');
  els.overallProgress.style.width =
    `${Math.min(100, (state.elapsedTotal / state.totalDuration) * 100)}%`;

  renderRoundDots(phase);

  // During a rest the person cards show what's coming, at full size, so
  // there's time to read it and get the gear ready. The rest after a Surf
  // check test asks how many instead (what's next is under it).
  const restLike = (phase.kind === 'rest' || phase.kind === 'blockrest') && phase.tally === undefined;
  let dispA = phase.a, dispB = phase.b;
  if (restLike) {
    let j = state.currentIdx + 1;
    while (j < state.sequence.length && state.sequence[j].kind !== 'work') j++;
    const nxt = state.sequence[j] || state.sequence[state.currentIdx + 1];
    if (nxt) { dispA = nxt.a; dispB = nxt.b; }
  }
  els.workoutView.classList.toggle('resting', restLike);
  // a rest (or the warm-up) is the time to look at what's coming
  const prep = restLike || phase.kind === 'warmup';
  document.getElementById('btnNextBlock').hidden = !(prep && upcomingBlock());
  if (!prep) closeNextSheet();

  els.exerciseA.textContent = dispA ? (dispA.display || dispA.name) : '';
  els.repsA.textContent = dispA ? (dispA.reps || '') : '';
  const showA = shownFor('a', dispA);
  setText(els.levelA, levelLine('a', showA));
  els.cueA.textContent = showA ? (showA.cue || '') : '';
  setAlt(els.alternativeA, showA ? showA.alt : '');
  updateAnim(els.animA, showA);
  if (state.people === 2 && dispB) {
    els.exerciseB.textContent = dispB.display || dispB.name;
    els.repsB.textContent = dispB.reps || '';
    const showB = shownFor('b', dispB);
    setText(els.levelB, levelLine('b', showB));
    els.cueB.textContent = showB.cue || '';
    setAlt(els.alternativeB, showB.alt);
    updateAnim(els.animB, showB);
  } else {
    updateAnim(els.animB, null);
    setText(els.levelB, '');
  }
  renderCircuit('a', dispA, phase);
  renderCircuit('b', state.people === 2 ? dispB : null, phase);

  renderUpcoming();

  // Swap on each card, in a rest or while paused (see SWAP A MOVE)
  els.swapA.hidden = !cardSwapTarget('a');
  els.swapB.hidden = !cardSwapTarget('b');

  els.btnStart.textContent = state.running ? 'Pause' : (state.elapsedTotal > 0 ? 'Resume' : 'Start');
  els.btnStart.classList.toggle('running', state.running);
  // once it's going, only Share is left of the pre-start strip (css)
  els.preStart.classList.toggle('underway', state.running || state.elapsedTotal > 0);
  renderPeopleBadge();
}

// "+1 rep: you said too easy", under a target that a person's level moved
// (see PERSONAL LEVELS), so a change FIT made on its own says why.
function levelLine(who, ex) {
  if (!ex || !ex.more) return '';
  return `${ex.more}: you said ${personScale(state.workout, who) > 1 ? 'too easy' : 'cooked'}`;
}

function renderUpcoming() {
  const next = state.sequence[state.currentIdx + 1];
  if (!next) { els.upcoming.innerHTML = ''; return; }
  const short = (which, fallback) => nameOn(which) || fallback;
  // (a Surf check test is the same for both)
  const work = (p) => state.people === 2 && !p.check
    ? `${short('a', 'A')}: ${withReps(p.a)} · ` +
      `${short('b', 'B')}: ${withReps(p.b)}`
    : withReps(p.a);
  // a rest says what it's resting for
  const then = state.sequence[state.currentIdx + 2];
  let preview;
  if (next.tally !== undefined && then) preview = `Rest ${next.duration}s and put in how many, then ${work(then)}`;
  else if (next.kind === 'rest') preview = then && then.kind === 'work'
    ? `Rest ${next.duration}s, then ${work(then)}` : `Rest ${next.duration}s`;
  else if (next.amrap) preview = `AMRAP: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.forTime) preview = `For time, ${next.a.lapRounds} rounds: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.kind === 'work') preview = work(next);
  else if (next.kind === 'stretch') preview = next.a.name;
  // the next warm-up move or stretch by name; the first stretch says it's the cool-down
  else if (next.kind === 'warmup' || next.kind === 'cooldown') {
    const cur = state.sequence[state.currentIdx];
    preview = cur && cur.kind === next.kind ? next.a.name : `${PHASE_LABEL[next.kind]}: ${next.a.name}`;
  } else preview = next.name;
  const c = PHASE_COLOR[next.kind];
  const swatch = c ? `background:${c.hex};box-shadow:0 0 8px 1px rgba(${c.rgb},0.7)` : '';
  els.upcoming.innerHTML =
    `<div class="swatch" style="${swatch}"></div>
     <div class="txt"><span class="eyebrow">Up next</span><strong>${esc(preview)}</strong></div>`;
}

// =====================================================================
// TIMER
// Driven by the wall clock, not by counting setInterval ticks. iOS
// throttles or suspends timers whenever the app is backgrounded or the
// screen locks, so a tick-counting timer silently falls behind and never
// catches up. Deriving the position from elapsed real time means the
// workout is always where it should be, however long the gap was.
// =====================================================================
function elapsedNow() {
  if (!state.running) return state.elapsedTotal;
  return state.elapsedAtResume + (Date.now() - state.runStartWall) / 1000;
}

// Which phase a given elapsed time lands in, and how much of it is left.
function locate(elapsed) {
  let acc = 0;
  for (let i = 0; i < state.sequence.length; i++) {
    const d = state.sequence[i].duration;
    if (elapsed < acc + d) return { idx: i, remaining: acc + d - elapsed };
    acc += d;
  }
  return { idx: state.sequence.length, remaining: 0 };
}

// How far into the session a phase starts (the end, for one past the last).
function startOf(idx) {
  let acc = 0;
  for (let i = 0; i < idx && i < state.sequence.length; i++) acc += state.sequence[i].duration;
  return acc;
}
// Jump to the start of a phase, keeping the wall-clock origin in step.
function seekTo(idx) {
  const acc = startOf(idx);
  state.currentIdx = Math.min(idx, state.sequence.length);
  state.elapsedTotal = acc;
  state.elapsedAtResume = acc;
  state.runStartWall = Date.now();
  state.lastBeep = null;
  const phase = state.sequence[state.currentIdx];
  state.remainingInPhase = phase ? phase.duration : 0;
}

function tickClock() {
  const elapsed = elapsedNow();
  const { idx, remaining } = locate(elapsed);

  if (idx >= state.sequence.length) {
    holdRanOut(state.currentIdx, idx);
    state.elapsedTotal = state.totalDuration;
    finish();
    return;
  }

  state.elapsedTotal = elapsed;
  if (idx !== state.currentIdx) {
    holdRanOut(state.currentIdx, idx);
    // May have crossed several phases at once if we were backgrounded;
    // only announce the one we actually landed on.
    state.currentIdx = idx;
    state.lastBeep = null;
    const kind = state.sequence[idx].kind;
    enterPhaseVisual(kind, remaining);
    chimeFor(state.sequence[idx]);
    // the how-to sheet covers the timer: get it out of the way to go again
    if (kind === 'work' || kind === 'stretch' || kind === 'warmup') closeMove();
  }
  state.remainingInPhase = remaining;
  if (state.sequence[idx].hold && holdOver(state.sequence[idx])) return;

  const whole = Math.ceil(remaining);
  if (whole <= 3 && whole >= 1) {
    if (state.lastBeep !== whole) { state.lastBeep = whole; tickBeep(); }
  } else if (whole > 3) {
    state.lastBeep = null;
  }
  coachTick();
  render();
  // kept every few seconds, so a reload picks up about where it was
  if (Date.now() - runSavedAt >= RUN_SAVE_MS) saveRun();
}

// A Surf check's paddle hold (see SURF_CHECK). Run out to its end, whoever
// was still going held it all; stopped with Skip part-way, they held it
// till then (from five seconds in, before which it was skipped).
function holdRanOut(from, to) {
  const p = state.sequence[from];
  if (p && p.hold && to > from) holdStopped(p, p.duration);
}
function holdStopped(p, sec) {
  if (sec < 5) return;
  const s = state.scores[p.blockIdx] || (state.scores[p.blockIdx] = { a: 0, b: 0 });
  (state.people === 2 ? ['a', 'b'] : ['a']).forEach(w => { if (!(s[w] > 0)) s[w] = Math.round(sec); });
}
// Everyone's tapped Done: a moment to take back a mis-tap, then on to the
// cool-down. True once it has moved on.
const HOLD_GRACE_MS = 3000;
function holdOver(p) {
  if (!allDone(p)) { state.holdDoneAt = null; return false; }
  if (!state.holdDoneAt) state.holdDoneAt = Date.now();
  if (Date.now() - state.holdDoneAt < HOLD_GRACE_MS) return false;
  state.holdDoneAt = null;
  const target = state.currentIdx + 1;
  // the cap's time not used, so the finish screen's minutes are what was done
  state.skippedSec += Math.max(0, startOf(target) - elapsedNow());
  if (target >= state.sequence.length) {
    state.elapsedTotal = state.totalDuration;
    state.currentIdx = state.sequence.length;
    finish();
    return true;
  }
  hush();
  seekTo(target);
  enterPhaseVisual(state.sequence[target].kind, state.remainingInPhase);
  chimeFor(state.sequence[target]);
  if (state.running) beginBleed(state.remainingInPhase);
  render();
  saveRun();
  return true;
}

function startTimer() {
  if (state.running) return;
  if (state.currentIdx >= state.sequence.length) seekTo(0);
  if (audioStale) freshAudio(); else ensureAudio();
  requestWakeLock();
  state.running = true;
  state.started = true;
  state.elapsedAtResume = state.elapsedTotal;
  state.runStartWall = Date.now();
  state.lastBeep = null;
  workChime();
  // from the top the voice starts afresh; on a resume it says the phase's
  // line again, if there's still time (a pause cut it off)
  if (state.elapsedTotal === 0) coachFresh();
  coach.at = -1;
  primeVoice();
  coachTick();
  state.tickHandle = setInterval(tickClock, 200);
  hideAway();                              // going again answers it (see askAway)
  clearGoingNote();
  beginBleed(state.remainingInPhase);
  render();
  rememberExercises();
  recordHistory();
  saveRun();
}

function pauseTimer() {
  if (!state.running) return;
  state.elapsedTotal = elapsedNow();
  freezeBleed();
  state.running = false;
  clearTick();
  hush();
  render();                                // the wake lock stays on through a pause
  saveRun();
}

function clearTick() {
  if (state.tickHandle) { clearInterval(state.tickHandle); state.tickHandle = null; }
}

function stopTimer() {
  state.running = false;
  clearTick();
  hush();
  releaseWakeLock();
}

// Back to the top as if just opened: rounds counted from 0 again, and not
// started, so skipping through after a reset doesn't count as done.
function resetWorkout() {
  stopTimer();
  hideAway();
  if (state.started) clearRun();
  state.scores = {};
  state.laps = {};
  state.pick = {};
  state.skipped = [];
  state.skippedSec = 0;
  state.started = false;
  // a Surf check gone again is a new one
  state.checkAt = null;
  state.holdDoneAt = null;
  coachFresh();
  seekTo(0);
  if (state.sequence[0]) enterPhaseVisual(state.sequence[0].kind, state.remainingInPhase);
  render();
}

// The finish screen: Done to go back, Start over, and Save and Share. The
// position goes past the end, so render() leaves this screen alone and
// Start over begins again from the top.
function finish() {
  stopTimer();
  hideAway();
  state.currentIdx = state.sequence.length;
  // skipping through without ever pressing Start isn't a session done
  if (state.started) {
    markHistoryComplete();
    completeProgramDay();
    if (state.workout.format === 'check') recordCheck();
    clearRun();
  }
  bigBell();
  // and once the bell has rung, the sound goes back (unless Start over has
  // it going again)
  setTimeout(() => { if (!state.running) releaseAudio(); }, 2000);
  clearBleed();
  disarmBack();
  els.workoutView.classList.remove('resting');
  els.workoutView.classList.add('finished');
  // never started, or skipped through inside a minute: nobody did
  // anything, so no cards saying well done
  els.workoutView.classList.toggle('unstarted', !state.started || endedEarly());
  // what it said before the end (Back to 7:30, Tap Resume) is done with
  els.workoutNote.textContent = '';
  clearGoingNote();
  els.timerCard.className = 'timer-card';
  setText(els.phaseLabel, 'Done');
  els.timeDisplay.textContent = '✓';
  // the time it ran, out of the whole: all of it unless something was
  // skipped (the last tick can land a fraction short of the end, and that
  // isn't "19:59 / 20:00")
  els.totalTime.textContent = `Total ${fmt(Math.round(timeDone()))} / ${fmt(state.totalDuration)}`;
  // skipped through on a program day still ticks the day off (see
  // programDoneLine below), so the top says that too
  setText(els.blockName, !state.started ? 'The end of the workout'
    : endedEarly() ? (programDoneLine() && !lastCheckRun() ? 'Ended early, day ticked off' : 'Session ended early')
    : state.workout.format === 'check' ? 'Surf check done. Nice work.' : 'Workout complete. Nice work.');
  els.roundDots.innerHTML = '';
  finishSummary().forEach(text => {
    const line = document.createElement('div');
    line.className = 'finish-line';
    line.textContent = text;
    els.roundDots.appendChild(line);
  });
  els.exerciseA.textContent = 'Well done.';
  els.repsA.textContent = els.cueA.textContent = els.levelA.textContent = els.levelB.textContent = '';
  setAlt(els.alternativeA, '');
  updateAnim(els.animA, null);
  updateAnim(els.animB, null);
  if (state.people === 2) {
    els.exerciseB.textContent = 'Well done.';
    els.repsB.textContent = els.cueB.textContent = '';
    setAlt(els.alternativeB, '');
  }
  // no laps or +1 round buttons left over from the last block
  for (const w of ['A', 'B']) {
    els['circuit' + w].hidden = els['counter' + w].hidden = true;
    els['circuit' + w].closest('.person').classList.remove('amrap');
  }
  els.upcoming.innerHTML = '';
  document.getElementById('btnNextBlock').hidden = true;
  closeNextSheet();
  closeSwapSheet();
  els.swapA.hidden = els.swapB.hidden = true;
  renderPeopleBadge();
  renderSaveButton();
  els.btnStart.textContent = 'Done';
  els.btnStart.classList.remove('running');
  els.btnAgain.hidden = false;
  els.overallProgress.style.width = '100%';
  els.preStart.classList.remove('underway'); // Save and Share; the preview and Shuffle hide (css)
  // each person's scores and How was that?, fresh for this finish
  state.feel = {};
  feelBefore = {};
  renderFinishPeople();
}
const isFinished = () => state.currentIdx >= state.sequence.length;
// Started, then skipped through with under a minute of it run.
const endedEarly = () => state.started && timeDone() < 60;

// ------------------------------------------------------- finish screen
// It says what was done: the minutes, the blocks (and any skipped), each
// AMRAP and For Time score against last time, and on a program day where
// that leaves the program. Then each person can say how it was, one tap
// each, and that sets their reps for the next build (see levels).
function finishSummary() {
  const w = state.workout;
  if (!state.started) return ["Skipped to the end without pressing Start, so it isn't counted as a session."];
  const sec = timeDone();
  const stretch = w.format === 'stretch', check = w.format === 'check';
  const total = stretch ? stretchList(w).length : check ? w.stations.length : w.blocks.length;
  const unit = stretch ? (total === 1 ? 'stretch' : 'stretches') : check ? (total === 1 ? 'test' : 'tests')
    : (total === 1 ? 'block' : 'blocks');
  // a test skipped that someone put a number in for anyway was done
  const skipped = state.skipped.filter(k => !(check && checkScored(k))).length;
  // whole minutes, as the clock beside it has them (7:30 is 7 min)
  const lines = [`${sec < 60 ? 'Under a minute' : `${Math.floor(Math.round(sec) / 60)} min`} done · ${total - skipped} of ${total} ${unit}${skipped ? `, ${skipped} skipped` : ''}`];
  const day = programDoneLine();
  if (day) lines.push(day);
  return lines;
}
// Seconds of the session run through rather than skipped.
const timeDone = () => Math.max(0, state.totalDuration - state.skippedSec);
// The Surf check after a program's last day, which has no day to tick off.
function lastCheckRun() {
  const run = state.programRun;
  const prog = run && run.check && PROGRAMS.find(p => p.id === run.id);
  return !!prog && run.n >= prog.weeks * prog.days.length;
}
// "Day 9 of 42 done. Next: Pop-ups & legs"
function programDoneLine() {
  const run = state.programRun;
  const prog = run && PROGRAMS.find(p => p.id === run.id);
  const ps = prog && programStatus(prog);
  if (!ps) return '';
  if (lastCheckRun()) return `The last Surf check of ${prog.name}.`;
  return `Day ${run.n + 1} of ${prog.weeks * prog.days.length} done. ${ps.finished ? `That's the whole of ${prog.name}.` : `Next: ${ps.day.name}`}`;
}
// Each AMRAP and For Time score this person made, against last time:
// "Block 2 AMRAP: 5 rounds (last time 4)".
function finishScores(who) {
  const rows = [], seen = new Set();
  state.sequence.forEach(p => {
    if (!(p.amrap || p.forTime) || seen.has(p.blockIdx)) return;
    seen.add(p.blockIdx);
    const s = state.scores[p.blockIdx] || {};
    const v = s[who] || 0;
    const last = state.lastScores && state.lastScores[p.blockIdx] ? state.lastScores[p.blockIdx][who] : undefined;
    const what = s.skipped && !v ? 'skipped' : p.forTime ? (v ? fmt(v) : 'capped') : `${v} round${v === 1 ? '' : 's'}`;
    const before = what === 'skipped' ? '' : p.forTime ? (last ? fmt(last) : '') : (last != null ? String(last) : '');
    rows.push(`Block ${p.blockIdx + 1} ${p.forTime ? 'For Time' : 'AMRAP'}: ${what}${before ? ` (last time ${before})` : ''}`);
  });
  return rows;
}
// Each person's level before this finish screen's taps, so changing your
// mind doesn't count twice.
let feelBefore = {};
// The history entry of the session just finished, which keeps how it felt;
// a stretch routine says nothing about reps, so it doesn't ask, nor does
// a Surf check (flat out, by design) or one skipped through.
const finishedEntry = () => (state.started && !endedEarly() && state.workout && state.workout.format !== 'stretch' && state.workout.format !== 'check'
  && state.history.find(h => h.key === historyKey(state.workout))) || null;
function renderFinishPeople() {
  const entry = finishedEntry();
  ['a', 'b'].forEach(who => {
    const box = els['finish' + who.toUpperCase()];
    box.innerHTML = '';
    if (who === 'b' && state.people !== 2) { box.hidden = true; return; }
    // a Surf check: each test's result, a count still to be changed, and
    // against last time
    if (state.started && state.workout.format === 'check') box.append(...checkFinish(who));
    const scores = finishScores(who);
    if (scores.length) {
      const list = document.createElement('ul');
      list.className = 'finish-scores';
      list.innerHTML = scores.map(t => `<li>${esc(t)}</li>`).join('');
      box.appendChild(list);
    }
    if (entry) box.append(...feelRow(who));
    box.hidden = !box.children.length;
    // the question takes the place of "Well done." (the top says Nice work)
    els['exercise' + who.toUpperCase()].textContent = entry ? '' : 'Well done.';
  });
}
// How was that? Too easy, About right, Cooked, and what the answer does.
function feelRow(who) {
  const ask = document.createElement('div');
  ask.className = 'feel-ask';
  ask.textContent = 'How was that?';
  const row = document.createElement('div');
  row.className = 'chip-row feel-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `How was that for ${state.people === 1 ? 'you' : personName(who)}?`);
  Object.entries(FEEL_LABEL).forEach(([id, label]) => {
    const on = state.feel[who] === id;
    const chip = tappable('chip feel-chip' + (on ? ' active' : ''), () => tapFeel(who, id));
    chip.textContent = label;
    chip.dataset.feel = id;
    chip.setAttribute('aria-pressed', String(on));
    row.appendChild(chip);
  });
  const note = document.createElement('div');
  note.className = 'feel-note';
  note.setAttribute('role', 'status');
  note.textContent = feelNote(who);
  return [ask, row, note];
}
// One tap: kept with the session, and the person's level moved from where
// it was before this screen. The same answer again takes it back.
function tapFeel(who, feel) {
  const entry = finishedEntry();
  if (!entry) return;
  const key = levelKey(who);
  if (!ownKey(feelBefore, who)) feelBefore[who] = ownKey(state.levels, key) ? { ...state.levels[key] } : null;
  if (state.feel[who] === feel) delete state.feel[who]; else state.feel[who] = feel;
  const now = state.feel[who];
  const level = now ? nextLevel(feelBefore[who], now) : feelBefore[who];
  if (level && (level.k !== 1 || level.easy)) state.levels[key] = level; else delete state.levels[key];
  const kept = { ...(entry.feel || {}) };
  if (now) kept[who] = now; else delete kept[who];
  if (Object.keys(kept).length) entry.feel = kept; else delete entry.feel;
  savePrefs();
  const keyboard = document.activeElement && document.activeElement.classList.contains('feel-chip');
  renderFinishPeople();
  if (keyboard) els['finish' + who.toUpperCase()].querySelector(`[data-feel="${feel}"]`).focus();
}
// What an answer does, said under it. A session all on the clock (Short
// bursts, Long efforts) has no reps for a level to change, so it says
// when the change shows.
function feelNote(who) {
  const feel = state.feel[who];
  if (!feel) return '';
  const key = levelKey(who);
  const level = ownKey(state.levels, key) ? state.levels[key] : { k: 1, easy: 0 };
  const before = feelBefore[who] ? feelBefore[who].k : 1;
  const next = hadReps(state.workout) ? 'next time' : 'next time there are reps to do';
  if (feel === 'right') return 'Noted. Your reps stay as they are.';
  if (feel === 'easy') {
    if (level.k > before) return `Noted. Your reps go up a notch ${next}.`;
    if (level.k >= LEVEL_MAX) return 'Noted. Your reps are already as high as they go.';
    return 'Noted. Say it again next time and your reps go up a notch.';
  }
  return level.k < before ? `Noted. Your reps come down a notch ${next}.` : 'Noted. Your reps are already as low as they go.';
}
// Whether any of a workout runs to reps (EMOM, AMRAP, For Time).
const hadReps = (w) => !!w && sectionsOf(w).some(sec => !!(INTERVALS[sec.intervalId] || {}).reps);

function skipBlock() {
  if (!state.sequence.length) return;
  const cur = state.sequence[state.currentIdx];
  if (!cur) return;
  hush();                                  // the next part says its own
  const from = Math.min(elapsedNow(), state.totalDuration);
  let target = state.currentIdx + 1;
  if (cur.kind === 'warmup' || cur.kind === 'cooldown') {
    while (target < state.sequence.length && state.sequence[target].kind === cur.kind) target++;
  } else if (cur.check) {
    // a Surf check skips a test, or the rest before one, at a time; Skip in
    // the paddle hold stops it for whoever hasn't tapped Done
    if (cur.hold) holdStopped(cur, from - startOf(state.currentIdx));
  } else if (cur.kind !== 'stretch') {
    // Walk to the first phase that isn't part of this block.
    while (target < state.sequence.length) {
      const t = state.sequence[target];
      if (t.blockIdx !== undefined && t.blockIdx === cur.blockIdx && t.kind !== 'blockrest') target++;
      else break;
    }
  }
  // what the finish screen says was skipped: the block (or stretch), unless
  // it was scored (a For Time finished early, say) or as good as done, and
  // the time
  const s = state.scores[cur.blockIdx];
  const scored = (cur.amrap || cur.forTime || cur.hold) && s && (s.a || s.b);
  const leftOut = (cur.kind === 'work' || cur.kind === 'rest') && !scored && skipsBlock(cur, target, from);
  // a scored block left out before anyone logged a score says skipped, in
  // history and on the finish screen, not 0 rounds or capped; one as good
  // as done keeps what was logged, as if it had run out
  if ((cur.amrap || cur.forTime) && leftOut) {
    state.scores[cur.blockIdx] = { a: 0, b: 0, skipped: true };
    saveScores();
  }
  const what = cur.kind === 'stretch' ? cur.stretchIdx : leftOut ? cur.blockIdx : undefined;
  if (what !== undefined && !state.skipped.includes(what)) state.skipped.push(what);
  state.skippedSec += Math.max(0, startOf(target) - from);
  if (target >= state.sequence.length) {
    state.elapsedTotal = state.totalDuration;
    state.currentIdx = state.sequence.length;
    finish();
    return;
  }
  hideAway();
  seekTo(target);
  enterPhaseVisual(state.sequence[target].kind, state.remainingInPhase);
  chimeFor(state.sequence[target]);
  if (state.running) beginBleed(state.remainingInPhase);
  render();
  saveRun();
}

// A skip from here leaves out a real part of the block: a round still to
// come, or most of its time (an AMRAP's one long effort, say). From its
// last rest, or the end of its last round, the block was done.
function skipsBlock(cur, target, from) {
  const seq = state.sequence;
  if (seq.slice(state.currentIdx + 1, target).some(p => p.kind === 'work')) return true;
  if (cur.kind !== 'work') return false;
  const work = seq.filter(p => p.kind === 'work' && p.blockIdx === cur.blockIdx).reduce((t, p) => t + p.duration, 0);
  return startOf(state.currentIdx + 1) - from > work / 2;
}

// Remember what this session used so the next generated workout leans
// towards movements you haven't just done.
function rememberExercises() {
  const w = state.workout;
  if (!w || !w.blocks) return;
  // and the moves swapped in
  const ids = [...new Set([...w.blocks.flatMap(b => b.ids || []), ...(w.swaps || []).map(x => x.to)])];
  state.recent = [...ids, ...state.recent.filter(id => !ids.includes(id))].slice(0, RECENT_CAP);
  savePrefs();
}

// =====================================================================
// HISTORY
// Every session you start is logged, so a generated workout you liked but
// forgot to save is still there afterwards. Browser-only by design: it
// lives in localStorage alongside the other preferences, and if the cache
// is cleared it goes with it. No account, no server.
// =====================================================================

// A stable key for "the same workout", so restarting one doesn't log twice.
const historyKey = (w) => w.generated ? `gen:${w.seed}` : `id:${w.id}`;

function recordHistory() {
  const w = state.workout;
  if (!w) return;
  const key = historyKey(w);
  const now = Date.now();
  const existing = state.history.find(h => h.key === key && now - h.at < HISTORY_MERGE_MS);
  if (existing) {
    existing.at = now;
    // with this go's swaps, the moves it's doing
    existing.swaps = keptSwaps(w);
    if (!existing.swaps) delete existing.swaps;
    savePrefs();
    return;
  }
  state.history.unshift({
    key,
    name: w.name,
    blurb: w.blurb || '',
    focus: w.focus || 'whole-body',
    minutes: durationParts(w).totalMin,
    people: state.people,
    intervalId: styleIdOf(w),
    generated: !!w.generated,
    // Enough to rebuild it exactly: for a generated workout the exercises
    // it was built with (see FROZEN WORKOUTS in js/workouts.js), and the
    // seed and request it came from; an id for the named ones.
    seed: w.seed || null,
    request: w.request || null,
    frozen: w.generated ? freezeWorkout(w) : undefined,
    workoutId: w.generated ? null : w.id,
    // and any moves swapped (see SWAP A MOVE), kept up to date as it goes
    swaps: keptSwaps(w),
    // who it was, so a score stays with the person who made it after a
    // rename, and which program day, so the card can say so
    names: { a: nameOn('a'), b: state.people === 2 ? nameOn('b') : '' },
    program: programRunLabel(),
    at: now,
    completed: false
  });
  state.history = state.history.slice(0, HISTORY_CAP);
  savePrefs();
}
// The program day being run (or one saved part-way, see RESUME), as
// history keeps it: "Pop-ups & legs" and where it sits ("Surf Fit · Week
// 1, Day 2"), or null for any other session.
function programRunLabel(run = state.programRun) {
  const prog = run && PROGRAMS.find(p => p.id === run.id);
  if (!prog) return null;
  const day = programDay(prog, run.n);
  // a Surf check in the day's place, or the last one, after the end
  if (run.check && run.n >= prog.weeks * prog.days.length) return { id: prog.id, n: run.n, day: SURF_CHECK.name, where: `${prog.name} · after ${prog.weeks} weeks` };
  return { id: prog.id, n: run.n, day: run.check ? SURF_CHECK.name : day.name, where: `${prog.name} · Week ${day.week}, Day ${run.n + 1}` };
}

function markHistoryComplete() {
  const w = state.workout;
  if (!w) return;
  const entry = state.history.find(h => h.key === historyKey(w));
  if (entry && !entry.completed) { entry.completed = true; savePrefs(); }
  keepStorage();
}

// Once there's something worth keeping (a finished session, a favourite, a
// program under way), ask the browser not to clear FIT's storage to free up
// space. Asked once a visit; a browser without it, or one that says no,
// carries on as before.
let storageAsked = false;
function keepStorage() {
  if (storageAsked || !navigator.storage || !navigator.storage.persist) return;
  storageAsked = true;
  try {
    (navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false))
      .then(on => on || navigator.storage.persist())
      .catch(() => { /* not allowed here: localStorage still works */ });
  } catch (e) { /* as above */ }
}

// Rebuild a workout from a history entry (or a saved favourite: same shape).
// A generated one opens as it was built. One kept before entries kept
// their exercises, or with a move that has since left the library, is
// built again from its seed, and a favourite then keeps that.
function openFromRecord(rec) {
  if (rec.generated) {
    const w = rec.frozen ? thawWorkout(rec.frozen, rec.seed, rec.request) : null;
    if (w) {
      state.lastRequest = rec.request;
      openWorkout(swapped(w, rec.swaps));
      return null;
    }
    const err = buildAndOpen(rec.request, rec.seed, { recent: (rec.request && rec.request.recent) || [] }, rec.swaps);
    if (err) return err;
    if (rec.frozen) els.workoutNote.textContent = 'Some of its moves have changed since it was saved, so it was built again.';
    // a favourite then keeps this build, but only one made with the gear
    // at the first place (Home, where favourites were saved): at a mate's
    // place it adapts, as it always did, and Home still gets the original
    const fav = atFirstPlace() && state.saved.find(s => s.seed === rec.seed);
    if (fav && !(fav.frozen && thawWorkout(fav.frozen, fav.seed, fav.request))) {
      fav.frozen = freezeWorkout(state.workout);
      savePrefs();
    }
    return null;
  }
  const w = namedAsRun(rec.workoutId, rec.intervalId);
  if (!w) return 'That workout is no longer in the library.';
  openWorkout(rec.swaps ? swapped(w, rec.swaps) : w);
  return null;
}
// A classic, stretch routine or Surf check the way it was run: a classic takes
// whichever interval was selected at the time, so carry the recorded one,
// not today's preference. Null if it's no longer in the library.
function namedAsRun(id, intervalId) {
  const w = CLASSICS.find(x => x.id === id) || STRETCH_ROUTINES.find(x => x.id === id) || (id === SURF_CHECK.id ? SURF_CHECK : null);
  if (!w) return null;
  return w.format === 'tabata' && intervalId && INTERVALS[intervalId] ? { ...w, intervalId } : w;
}

// "Today", "Yesterday", then the date. Nobody wants a timestamp.
function whenLabel(ts) {
  const then = new Date(ts);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday - then) / 86400000) + 1;
  const time = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (then >= startOfToday) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${then.toLocaleDateString([], { weekday: 'long' })}, ${time}`;
  return then.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// =====================================================================
// RESUME
// A session under way is kept under its own key, not with the prefs (it
// changes every few seconds and means nothing once it's over), so a
// reload, a tab the phone threw away or a stray swipe can pick it back up
// from the home screen. Saved every few seconds while it runs, and on a
// pause, a skip, a score and whenever the app goes out of view. Cleared
// when it finishes, on Reset or Start over, and when you leave it with
// two taps on Menu. After twelve hours it isn't offered.
//
// The session that owns the key is the one on screen once it's started
// (state.started), so opening something else and leaving it untouched
// leaves an earlier session to pick up.
// =====================================================================
const RUN_KEY = 'fit-run-1';
const RUN_MAX_AGE_MS = 12 * 3600e3;
const RUN_SAVE_MS = 5000;
let runSavedAt = 0;

// A short fingerprint of a session: the exercises it was built from and
// the shape of its timeline. A rebuild that comes out different (an update
// changed the library, say) isn't the session that was saved. The gear
// doesn't come into it: like a favourite, a session picked up after the
// gear changed adapts to what's there.
function runSig(w, seq) {
  const ids = (w.blocks || [w]).map(b => (b.ids || []).join(','));
  const text = JSON.stringify([ids, seq.length, seq.reduce((t, p) => t + p.duration, 0)]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Everything needed to build the session again exactly and put it back
// where it was: how it was built, who was training, the program day, how
// far in, and the scores and lap picks so far.
function saveRun() {
  const w = state.workout;
  if (!w || state.view !== 'workout' || !inProgress()) return;
  // with the question after time away still up, where you left (see AWAY)
  const elapsed = Math.min(awayBack !== null ? awayBack : elapsedNow(), state.totalDuration);
  const idx = locate(elapsed).idx;
  if (idx >= state.sequence.length) return;
  runSavedAt = Date.now();
  const snap = {
    v: 1, savedAt: runSavedAt, sig: runSig(w, state.sequence),
    generated: !!w.generated, seed: w.seed || null, request: w.request || null, builtWith: w.builtWith || null,
    frozen: w.generated ? freezeWorkout(w) : null,
    workoutId: w.generated ? null : w.id, intervalId: intervalFor(w).id, swaps: keptSwaps(w),
    people: state.people, names: { a: nameOn('a'), b: nameOn('b') },
    programRun: state.programRun || null,
    elapsed, idx, scores: state.scores, laps: state.laps, pick: state.pick, lastScores: state.lastScores || null,
    skipped: state.skipped, skippedSec: state.skippedSec
  };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) { /* private mode or full: nothing to pick up later */ }
}
function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch (e) { /* as above */ }
}

// The saved session, if there's one worth offering: under twelve hours
// old, and every part of it the right shape, since it goes straight back
// into the timer. Anything else is thrown away.
function readRun() {
  let s;
  try { s = JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) { s = undefined; }
  if (s === null) return null;
  const run = cleanRun(s);
  if (!run) clearRun();
  return run;
}
function cleanRun(s) {
  const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const count = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const whole = (x) => Number.isInteger(x) && x >= 0;
  if (!plain(s) || s.v !== 1 || typeof s.sig !== 'string') return null;
  const age = Date.now() - s.savedAt;
  if (!(age >= -60000 && age < RUN_MAX_AGE_MS)) return null;
  if (!count(s.elapsed) || !whole(s.idx) || (s.people !== 1 && s.people !== 2)) return null;
  if (s.generated ? !(whole(s.seed) && s.seed > 0 && plain(s.request)) : typeof s.workoutId !== 'string') return null;
  const built = plain(s.builtWith) && plain(s.builtWith.equipment) && Array.isArray(s.builtWith.excluded)
    ? { equipment: { ...s.builtWith.equipment }, excluded: s.builtWith.excluded.filter(id => typeof id === 'string') } : null;
  const scores = {};
  if (plain(s.scores)) {
    Object.entries(s.scores).forEach(([k, v]) => {
      if (/^\d+$/.test(k) && plain(v) && count(v.a || 0) && count(v.b || 0)) {
        scores[k] = { a: v.a || 0, b: v.b || 0, ...(v.skipped === true ? { skipped: true } : {}) };
      }
    });
  }
  const pick = {};
  if (plain(s.pick)) Object.entries(s.pick).forEach(([k, v]) => { if (whole(v)) pick[k] = v; });
  // For Time rounds done (saved before they were counted: none)
  const laps = {};
  if (plain(s.laps)) {
    Object.entries(s.laps).forEach(([k, v]) => {
      if (/^\d+$/.test(k) && plain(v) && whole(v.a || 0) && whole(v.b || 0)) laps[k] = { a: v.a || 0, b: v.b || 0 };
    });
  }
  const last = (x) => (count(x) ? x : undefined);
  const names = plain(s.names) ? s.names : {};
  const name = (x) => (typeof x === 'string' ? x.slice(0, 14) : '');
  const prog = plain(s.programRun) && whole(s.programRun.n) && PROGRAMS.some(p => p.id === s.programRun.id);
  return {
    savedAt: s.savedAt, sig: s.sig, elapsed: s.elapsed, idx: s.idx, people: s.people,
    generated: !!s.generated, seed: s.seed, request: s.request, builtWith: built,
    frozen: plain(s.frozen) ? s.frozen : null,
    workoutId: s.workoutId, intervalId: typeof s.intervalId === 'string' ? s.intervalId : null,
    // the moves swapped (saved before there were swaps: none), checked
    // again against the workout as it's built
    swaps: cleanSwaps(s.swaps),
    names: { a: name(names.a), b: name(names.b) },
    programRun: prog ? { id: s.programRun.id, n: s.programRun.n, ...(s.programRun.check === true ? { check: true } : {}) } : null,
    scores, laps, pick,
    lastScores: Array.isArray(s.lastScores) ? s.lastScores.map(x => (plain(x) ? { a: last(x.a), b: last(x.b) } : null)) : null,
    // saved before the finish screen counted skips: none
    skipped: Array.isArray(s.skipped) ? [...new Set(s.skipped.filter(whole))].slice(0, 60) : [],
    skippedSec: count(s.skippedSec) ? s.skippedSec : 0
  };
}

// The saved session built again: a built one from the exercises it was
// built with (or, saved before it kept them, from its seed with the gear
// and leave-outs it was first built with), a named one by its id at the
// style it ran in, either with the moves swapped in it. Null if it no
// longer comes out the same. (A swap never changes the timeline, so the
// fingerprint leaves the swaps out: a tab on the release before, which
// knows nothing of them, still picks the session up, as built.)
function rebuildRun(s) {
  try {
    let w;
    if (s.generated) {
      w = (s.frozen && thawWorkout(s.frozen, s.seed, s.request))
        || buildWorkout(s.request, s.seed, { recent: Array.isArray(s.request.recent) ? s.request.recent : [], ...(s.builtWith || {}) });
      if (w.error) return null;
    } else {
      w = namedAsRun(s.workoutId, s.intervalId);
      if (!w) return null;
    }
    if (s.swaps.length) w = swapped(w, s.swaps);
    const seq = buildSequence(w, s.people);
    return runSig(w, seq) === s.sig && s.idx < seq.length ? { w, seq } : null;
  } catch (e) { return null; }
}

// "block 2", "the warm-up", "stretch 3": where in a session a phase is.
function phaseWhere(p) {
  if (p.kind === 'warmup') return 'the warm-up';
  if (p.kind === 'cooldown') return 'the cool-down';
  if (p.check) return p.kind === 'work' ? `test ${p.stationIdx + 1}` : p.stationIdx ? `the rest before test ${p.stationIdx + 1}` : 'getting ready';
  if (p.kind === 'stretch') return `stretch ${p.stretchIdx + 1}`;
  if (p.kind === 'blockrest') return `the rest before block ${p.blockIdx + 2}`;
  return `block ${p.blockIdx + 1}`;
}

// Where a phase starts, for the note after picking up a session: "round 5
// of block 2" ("minute 2" in an EMOM, as its bar counts), "warm-up move
// 3", or just "block 2" at its first round.
function phaseStart(p) {
  const block = `block ${p.blockIdx + 1}`;
  if (p.kind === 'warmup') return p.warmIdx ? `warm-up move ${p.warmIdx + 1}` : 'the warm-up';
  if (p.kind === 'cooldown') return p.coolIdx ? `cool-down stretch ${p.coolIdx + 1}` : 'the cool-down';
  if (p.check) return phaseWhere(p);
  if (p.kind === 'rest') return `the rest after round ${p.round} of ${block}`;
  if (p.kind === 'work' && p.round > 1) return `${p.emom ? 'minute' : 'round'} ${p.round} of ${block}`;
  return phaseWhere(p);
}

// At the top of the Today card while there's a session to pick up:
// "Resume Paddle power from 8:00, block 2", with Resume and Discard. The
// time is where Resume picks up (the start of the round it was in), so
// the timer says the same.
function resumeLine() {
  const s = readRun();
  const built = s && rebuildRun(s);
  if (!built) { if (s) clearRun(); return null; }
  const day = programRunLabel(s.programRun);
  const box = document.createElement('div');
  box.className = 'today-resume';
  const text = document.createElement('div');
  text.className = 'resume-text';
  const from = built.seq.slice(0, s.idx).reduce((t, p) => t + p.duration, 0);
  text.textContent = `Resume ${day ? day.day : built.w.name} from ${fmt(from)}, ${phaseWhere(built.seq[s.idx])}`;
  const go = document.createElement('button');
  go.id = 'btnResumeRun';
  go.textContent = 'Resume';
  go.addEventListener('click', resumeRun);
  const drop = document.createElement('button');
  drop.id = 'btnDiscardRun';
  drop.className = 'secondary';
  drop.textContent = 'Discard';
  drop.addEventListener('click', () => { clearRun(); renderToday(); });
  const row = document.createElement('div');
  row.className = 'resume-actions';
  row.append(go, drop);
  box.append(text, row);
  return box;
}

// Resume: the same session, with the same people, at the start of the
// phase it was in (easier to pick up than mid-interval), paused so you
// tap to go. Its scores, the lap exercise each card was showing and the
// program day come back too, so finishing it still ticks the day off.
function resumeRun() {
  const s = readRun();
  const built = s && rebuildRun(s);
  if (!built) { clearRun(); renderToday(); return; }
  state.people = s.people;
  // on the cards, the names it was for (a link's, say), where they aren't
  // this phone's own, which stay as they are
  const own = (x) => ((x === 'a' ? state.nameA : state.nameB) || '').trim();
  namesShown = ['a', 'b'].every(x => s.names[x].trim() === own(x)) ? null : { a: s.names.a, b: s.names.b };
  renderPeoplePicker();
  savePrefs();
  state.programRun = s.programRun;
  if (s.generated) state.lastRequest = s.request;
  // Start goes on with its history entry, however long ago it was left
  // (see recordHistory), not a second one
  const entry = state.history.find(h => h.key === historyKey(built.w));
  if (entry && s.savedAt - entry.at < RUN_MAX_AGE_MS) entry.at = Date.now();
  openWorkout(built.w);
  state.scores = s.scores;
  state.laps = s.laps;
  state.pick = s.pick;
  state.lastScores = s.lastScores;
  state.skipped = s.skipped;
  state.skippedSec = Math.min(s.skippedSec, state.totalDuration);
  state.started = true;
  seekTo(s.idx);
  enterPhaseVisual(state.sequence[s.idx].kind, state.remainingInPhase);
  render();
  noteUntilGoing(`Picked up at ${fmt(state.elapsedTotal)}, the start of ${phaseStart(state.sequence[s.idx])}.`);
}

// =====================================================================
// SHARE LINKS
// A workout travels as a URL. For a generated one that is the seed plus
// the request that built it, and the equipment and exclusions in force at
// the time; for a named one, its id and interval. Packed into the hash, so
// no server ever sees it and the static host needs nothing. Seeds build
// identically in every browser, so the phone rebuilds exactly what the
// iPad had, and it works for someone else's device too: their own gear
// still adapts the display, the way it does for a classic.
// =====================================================================
const SHARE_VERSION = 1;

// Both kinds carry how many people it's on screen for (a favourite reopened
// with a mate is two, whatever it was built for), so the link opens the same.
// A built one carries the gear and leave-outs it was built with, which for
// a link being passed on are the sender's, not this device's.
//
// And the levels it was built at, by name (see PERSONAL LEVELS): on the
// other device Wayne's reps reach whoever is called Wayne there and nobody
// else, so passing a session from the phone to the iPad keeps everyone's
// reps, and a mate opening it gets the plain targets. A level kept by spot
// (someone with no name) stays behind, since that spot could be anyone.
// The other device's own levels are never put on a link: it's the sender's
// session, and their levels go on their own next build.
//
// For two people it carries their names too, so the other phone has Wayne
// and Dave on the cards each side as this one does, and their levels and
// swaps go to the right one of them; and any moves swapped (see SWAP A
// MOVE). A release before these leaves both out, and opens it as built.
function sharePayload(w) {
  const extra = {};
  const names = linkNames();
  if (names) extra.names = names;
  const swaps = keptSwaps(w);
  if (swaps) extra.swaps = swaps;
  if (w.generated) {
    const built = w.builtWith || { equipment: effectiveEquip(), excluded: state.excluded };
    const request = { ...w.request, people: state.people };
    const named = cleanRepScales(Object.fromEntries(Object.entries(w.repScales || {}).filter(([k]) => !k.startsWith('#'))));
    if (named) request.repScales = named; else delete request.repScales;
    return { v: SHARE_VERSION, seed: w.seed, request,
             equipment: { ...built.equipment }, excluded: built.excluded.slice(), ...extra };
  }
  return { v: SHARE_VERSION, id: w.id, intervalId: intervalFor(w).id, people: state.people, ...extra };
}
// The names a link carries: with two people and either named, both (as
// they are on the cards, an empty one too); otherwise none.
function linkNames() {
  const a = nameOn('a'), b = nameOn('b');
  return state.people === 2 && (a || b) ? { a, b } : null;
}

// What goes with the link, so it says what it is before anyone opens it:
// "FIT: Lower body · 20 min · Short bursts · Wayne & Dave" ("1 person" or
// "2 people" with nobody named), as the badge says it. A built workout's
// name already ends in its minutes.
function shareText(w) {
  const style = styleLabel({ intervalId: styleIdOf(w), request: w.request });
  return [`FIT: ${w.name}`, ...(w.generated ? [] : [`${durationParts(w).totalMin} min`]), style, peopleText()].join(' · ');
}

// URL-safe base64 of UTF-8 text, and back.
function encodeShare(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShare(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function shareUrlFor(w) {
  return `${location.origin}${location.pathname}#w=${encodeShare(JSON.stringify(sharePayload(w)))}`;
}

// Opens the workout in a share link. Returns an error message, or null.
let linkFor = '';                // who the link was for, when it said ("Wayne & Dave")
function openSharedLink(hash) {
  linkFor = '';
  namesShown = null;
  let payload;
  try { payload = JSON.parse(decodeShare(hash.slice(3))); }
  catch (e) { return 'That link is not a FIT workout.'; }
  if (!payload || typeof payload !== 'object') return 'That link is not a FIT workout.';
  if (payload.v !== SHARE_VERSION) return 'That link was made by a different version of FIT.';
  if (!payload.id && (!payload.seed || !payload.request)) return 'That link is missing its workout.';
  // it opens for as many people as it was sent for (a classic's link from
  // before it said keeps today's count), and two by the names they were
  // sent with, in the same spots, so each card here says what the same
  // card there does: on the cards for this workout only, never saved over
  // this phone's own names (see namesShown)
  const people = payload.id ? payload.people : payload.request.people;
  if (people === 1 || people === 2) { state.people = people; savePrefs(); }
  const names = payload.names;
  if (state.people === 2 && names && typeof names === 'object' && [names.a, names.b].every(x => typeof x === 'string')
      && (names.a.trim() || names.b.trim())) {
    namesShown = { a: names.a.trim().slice(0, 14), b: names.b.trim().slice(0, 14) };
    linkFor = peopleText();
  }
  if (payload.id) {
    return openFromRecord({ workoutId: payload.id, intervalId: payload.intervalId, generated: false, swaps: payload.swaps });
  }
  return buildAndOpen(payload.request, payload.seed, {
    equipment: payload.equipment || effectiveEquip(),
    excluded: Array.isArray(payload.excluded) ? payload.excluded : [],
    recent: Array.isArray(payload.request.recent) ? payload.request.recent : []
  }, payload.swaps);
}

// A link in the address bar, on load or pasted into the open app.
function openLinkFromHash() {
  if (!location.hash.startsWith('#w=')) return;
  const err = openSharedLink(location.hash);
  // Clear it so a reload comes back to the home screen, not the link.
  history.replaceState(null, '', location.pathname + location.search);
  if (err) {
    goWelcome();
    // a first visit lands on the gear question, so the note goes there
    (state.gearAsked ? els.welcomeNote : els.gearNote).textContent = err;
  } else {
    // and who for, when the link said
    els.workoutNote.textContent = linkFor ? `Opened from a shared link, for ${linkFor}.` : 'Opened from a shared link.';
  }
}

// =====================================================================
// YOUR DATA
// Everything FIT keeps (the prefs, see PERSISTED) can go out as a file or
// as text on the clipboard, and come back from either through the same
// checks as the store itself (cleanPrefs). On an iPhone or iPad the
// home-screen app and Safari keep separate storage, so this is how your
// progress gets from one to the other, or to the other device. A restore
// says what it found and asks first, and what it replaced is kept, so Put
// it back can undo it until the next restore.
// =====================================================================
const BACKUP_KIND = 'fit-backup';
const BEFORE_RESTORE_KEY = 'fit-prefs-2-before-restore';
let restoreOpen = false;         // the Restore panel stays open across redraws
let dataSaid = '';               // said under the buttons on the next redraw

const backupText = () => JSON.stringify({ kind: BACKUP_KIND, v: 1, savedAt: new Date().toISOString(), prefs: currentPrefs() });

// The data in a backup file or pasted text, checked: { prefs, savedAt },
// or null when it isn't FIT's. Whatever a message or a note wrapped
// around it is let go, and the bare store is taken too.
function readBackup(text) {
  const t = String(text || '');
  const from = t.indexOf('{'), to = t.lastIndexOf('}');
  if (from < 0 || to < from) return null;
  try {
    const o = JSON.parse(t.slice(from, to + 1));
    const wrapped = !!o && o.kind === BACKUP_KIND;
    const prefs = wrapped ? o.prefs : o && typeof o.schema === 'number' ? o : null;
    if (!prefs) return null;
    const at = wrapped ? Date.parse(o.savedAt) : NaN;
    return { prefs: cleanPrefs(prefs), savedAt: Number.isFinite(at) ? at : null };
  } catch (e) { return null; }
}
// What's in a set of prefs, to check before replacing anything: "12
// sessions, 3 favourites, 2 places (Home, Mate's place), 2 Surf checks and
// Surf Fit week 3".
function dataSummary(p) {
  const count = (n, one) => `${n || 'no'} ${one}${n === 1 ? '' : 's'}`;
  const parts = [count(p.history.length, 'session')];
  if (p.saved.length) parts.push(count(p.saved.length, 'favourite'));
  if (p.gearSets.length) parts.push(`${count(p.gearSets.length, 'place')} (${p.gearSets.map(g => g.name).join(', ')})`);
  if (p.checks.length) parts.push(count(p.checks.length, 'Surf check'));
  PROGRAMS.forEach(prog => {
    const st = p.programs[prog.id];
    if (!st) return;
    const n = st.done.length;
    parts.push(n >= prog.weeks * prog.days.length ? `${prog.name} finished` : `${prog.name} week ${programDay(prog, n).week}`);
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}
const shortDate = (t) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });

// Swap in a whole set of prefs. A restore keeps what was here first, for
// Put it back; putting it back lets that copy go. False, with nothing
// changed, if this device has no room for the copy.
function replaceData(prefs, keepBefore) {
  try {
    if (keepBefore) localStorage.setItem(BEFORE_RESTORE_KEY, JSON.stringify({ at: Date.now(), prefs: currentPrefs() }));
    else localStorage.removeItem(BEFORE_RESTORE_KEY);
  } catch (e) { return false; }
  Object.assign(state, prefs);
  savePrefs();
  keepStorage();
  showSettings();
  return true;
}
function dataBefore() {
  try {
    const b = JSON.parse(localStorage.getItem(BEFORE_RESTORE_KEY));
    return b && typeof b.at === 'number' ? { at: b.at, prefs: cleanPrefs(b.prefs) } : null;
  } catch (e) { return null; }
}

// A file to keep. An iPhone or iPad gets the share sheet (Save to Files,
// or AirDrop it to the other device); anything else downloads it.
async function saveBackup(say) {
  const name = `FIT backup ${dayKey(Date.now())}.json`;
  const file = new File([backupText()], name, { type: 'application/json' });
  if (IS_IOS && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      say('Backup made. Keep the file somewhere safe, like Files or iCloud Drive.');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;      // share sheet dismissed
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  say(`Saved "${name}" to your downloads. Keep it somewhere safe.`);
}
// The same data as text, for pasting into Restore on the other device or
// in the home-screen app. Without a clipboard, it goes in a box to copy.
function copyData(after, say) {
  const text = backupText();
  const byHand = () => {
    let box = after.parentNode.querySelector('.data-copy');
    if (!box) {
      box = document.createElement('textarea');
      box.className = 'data-text data-copy';
      box.readOnly = true;
      box.rows = 3;
      box.setAttribute('aria-label', 'Your data, to copy');
      after.after(box);
    }
    box.value = text;
    box.focus();
    box.select();
    say('Copy all the text in the box, then paste it into Restore on the other device.');
  };
  try {
    navigator.clipboard.writeText(text).then(
      () => say('Copied. On the other device, or in the home-screen app, open Saved & ready-made, tap Restore and paste it in.'),
      byHand);
  } catch (e) { byHand(); }
}

// The bottom of Saved & ready-made.
function dataSection() {
  const wrap = document.createElement('section');
  wrap.className = 'library-section data-section';
  wrap.id = 'yourData';
  wrap.innerHTML = `<div class="section-head"><div class="section-title">Your data</div></div>
    <p class="data-about">The iPhone home-screen app and Safari keep separate data, so this is how you move yours between them, or to the iPad.</p>`;
  const note = document.createElement('div');
  note.className = 'build-note data-note';
  note.setAttribute('role', 'status');
  const say = (text) => { note.textContent = text; };
  const actions = document.createElement('div');
  actions.className = 'data-actions';
  const button = (id, text, onClick) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.id = id;
    b.textContent = text;
    b.addEventListener('click', onClick);
    actions.appendChild(b);
    return b;
  };
  button('btnBackup', 'Save a backup', () => saveBackup(say));
  button('btnCopyData', 'Copy to another device', () => copyData(actions, say));
  const open = button('btnRestore', 'Restore', () => {
    restoreOpen = !restoreOpen;
    panel.hidden = !restoreOpen;
    open.setAttribute('aria-expanded', String(restoreOpen));
    check.innerHTML = '';
    say('');
  });
  open.setAttribute('aria-expanded', String(restoreOpen));

  // Restore: a file or pasted text, then what's in it, and a yes or no.
  const panel = document.createElement('div');
  panel.className = 'restore-panel';
  panel.hidden = !restoreOpen;
  panel.innerHTML = `<p class="picker-hint">Choose the backup file, or paste the text you copied.</p>`;
  const fileBtn = document.createElement('button');
  fileBtn.className = 'secondary';
  fileBtn.id = 'btnRestoreFile';
  fileBtn.textContent = 'Choose a backup file';
  // out of sight rather than display: none, which some iPhones won't open
  const file = document.createElement('input');
  file.type = 'file';
  // so an iPhone goes straight to Files, not Photos (the backup is a .json)
  file.accept = '.json,application/json,text/plain';
  file.id = 'restoreFile';
  file.className = 'file-input';
  file.tabIndex = -1;
  file.setAttribute('aria-hidden', 'true');
  fileBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    let text = '';
    try { text = await f.text(); } catch (e) { /* unreadable: said below */ }
    offer(readBackup(text));
  });
  const paste = document.createElement('textarea');
  paste.className = 'data-text';
  paste.id = 'restoreText';
  paste.rows = 3;
  paste.placeholder = 'Or paste the copied text here';
  paste.setAttribute('aria-label', 'Paste your copied data');
  const usePaste = document.createElement('button');
  usePaste.className = 'secondary';
  usePaste.id = 'btnRestoreText';
  usePaste.textContent = 'Use the pasted text';
  usePaste.addEventListener('click', () => offer(readBackup(paste.value)));
  panel.append(fileBtn, file, paste, usePaste);

  // What was found against what's here, and a yes or no, under whatever
  // asked (the Restore panel, or Put it back).
  const check = document.createElement('div');
  check.className = 'restore-check';
  const ask = (under, found, yes, onYes) => {
    check.innerHTML = '';
    under.after(check);
    const p1 = document.createElement('p');
    p1.className = 'restore-found';
    p1.textContent = found;
    const p2 = document.createElement('p');
    p2.className = 'picker-hint';
    // a new device has only the defaults (the Home it makes for itself)
    const here = currentPrefs();
    const blank = !here.gearAsked && !here.history.length && !here.saved.length && !Object.keys(here.programs).length && !here.checks.length;
    p2.textContent = blank ? 'Nothing is saved here yet.' : `It replaces everything here now: ${dataSummary(here)}.`;
    const row = document.createElement('div');
    row.className = 'data-actions';
    const go = document.createElement('button');
    go.id = 'btnRestoreYes';
    go.textContent = yes;
    go.addEventListener('click', onYes);
    const no = document.createElement('button');
    no.className = 'secondary';
    no.id = 'btnRestoreNo';
    no.textContent = 'Cancel';
    no.addEventListener('click', () => { check.innerHTML = ''; });
    row.append(go, no);
    check.append(p1, p2, row);
    check.scrollIntoView({ block: 'nearest' });
  };
  // the page again, with what's here now and what was done, where it's
  // said (the sessions and favourites now above it move it down the page)
  const done = (text) => {
    restoreOpen = false;
    dataSaid = text;
    state.filterFocus = 'all';
    renderFocusFilter();
    renderLibrary();
    $('yourData').scrollIntoView({ block: 'start' });
  };
  const offer = (got) => {
    say('');
    if (!got) {
      check.innerHTML = '';
      say("That isn't a FIT backup. Check all of it was copied, or choose the file again.");
      return;
    }
    const when = got.savedAt ? `, saved ${shortDate(got.savedAt)}` : '';
    ask(panel, `This backup has ${dataSummary(got.prefs)}${when}.`, 'Replace my data', () => {
      if (!replaceData(got.prefs, true)) { say("There isn't room on this device to keep a copy of what's here, so nothing was changed."); return; }
      done(`Restored: ${dataSummary(state)}.`);
    });
  };

  // Put it back, while there's a copy from before the last restore.
  const before = dataBefore();
  let undo = null;
  if (before) {
    undo = document.createElement('div');
    undo.className = 'data-undo';
    undo.textContent = `Restored from a backup on ${shortDate(before.at)}.`;
    const back = linkButton('Put back what was here before', () => {
      say('');
      ask(undo, `Put back what was here before the restore: ${dataSummary(before.prefs)}.`, 'Put it back', () => {
        replaceData(before.prefs, false);
        done(`Put back: ${dataSummary(state)}.`);
      });
    });
    back.id = 'btnPutBack';
    undo.append(' ', back);
  }

  wrap.append(actions, note, panel, ...(undo ? [undo] : []));
  if (dataSaid) { say(dataSaid); dataSaid = ''; }
  return wrap;
}

// =====================================================================
// PROGRAMS
// One screen: what today is, the week so far, and the streak. Starting a
// day builds it through the generator like any other session (today's
// people, gear and weights); finishing it ticks the day off. A missed day
// waits.
//
// Where a program is up to is { startedAt, done, surfs, ease }:
// - done: a day used up, in order, so the day you're on is done.length
//   (programDay numbers them, and history and a session left part-way
//   keep that number). A finished session is { n, at }, and a flat-day
//   paddle in its place { n, at, water: id }. Up to release fit-v16 a surf
//   took the day's place as well, { n, at, surfed: true }: those stay days
//   done, marked Surf on the strip, so nobody's progress moves back and
//   the same day comes up next as before. Nothing in them is changed.
// - surfs: each surf since, { at, paddle } (paddle: how the paddle-out
//   felt, if said). A surf sits beside the program and doesn't use a day
//   up, so the land work on paddling and pop-ups still comes next, and
//   today's stays on offer, optional. It counts towards the streak and the
//   week's surfs. History stays the sessions FIT ran (and can run again),
//   so a surf isn't in it.
// - ease: { n, steps, days }, easing back in after time off (see
//   programEase in js/workouts.js), noted as the time off ends (see
//   noteEase), so it lasts its two sessions once something's recent.
// A tab on an older release only checks done, so it keeps surfs and ease
// as they are, and its own "I surfed today" still uses a day up, as it
// always did.
// =====================================================================
const dayKey = (t) => new Date(t).toLocaleDateString('en-CA');
const SURFS_CAP = 400;           // surfs kept, newest; a 6-week program and years more
// how the paddle-out felt, after a surf
const PADDLE_FEEL = { easy: 'Easy', ok: 'OK', cooked: 'Cooked' };
function openProgram() {
  stopTimer();
  state.programRun = null;
  state.programMinutes = null;
  state.workout = null;            // left behind, as on the way home (see goWelcome)
  state.programAhead = false;      // "do the next one now anyway", for this visit
  els.programNote.textContent = '';
  renderProgram();
  setView('program');
}
// Days in a row with something done or a surf, up to today (or
// yesterday, if today has neither yet).
function programStreak(st) {
  const days = new Set([...st.done, ...surfsOf(st)].map(d => dayKey(d.at)));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
// Where a program is up to: null before it's started, finished, or the day
// that's next and whether today's session is already done.
function programStatus(prog) {
  const st = state.programs[prog.id];
  if (!st) return null;
  const n = st.done.length;
  if (n >= prog.weeks * prog.days.length) return { st, n, finished: true };
  const last = st.done[n - 1];
  return { st, n, day: programDay(prog, n), last, doneToday: !!last && dayKey(last.at) === dayKey(Date.now()) };
}
const newProgram = () => ({ startedAt: Date.now(), done: [], surfs: [] });
// A program's surfs, a list from here on for one set up without (saved
// prefs always have one, see cleanPrefs).
const surfsOf = (st) => (Array.isArray(st.surfs) ? st.surfs : (st.surfs = []));
// Today's surf, if one's logged.
const todaysSurf = (st) => surfsOf(st).find(x => dayKey(x.at) === dayKey(Date.now()));
// Surfs this week, Monday on, the old kind that took a day's place too.
function surfsThisWeek(st) {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return [...surfsOf(st), ...st.done.filter(d => d.surfed)].filter(x => x.at >= monday.getTime()).length;
}
// The last time anything was done or surfed, or null.
function lastActivity(st) {
  const at = [...st.done, ...surfsOf(st)].map(x => x.at);
  return at.length ? Math.max(...at) : null;
}
// Easing back in, from time off that's ending now: from the day you're on,
// with the steps down and days off (see programEase), or null.
function freshEase(st) {
  const gap = programEase(lastActivity(st), Date.now());
  return gap && { n: st.done.length, steps: gap.steps, days: gap.days };
}
// Called before a session, surf or paddle is recorded: if it ends time off,
// the easing is kept, so the sessions after it are still eased.
function noteEase(st) {
  const fresh = freshEase(st);
  if (fresh) st.ease = fresh;
}
// Whether day n eases back in: the week whose load it takes (week), the
// days off and how many eased sessions are left counting it, or null. A
// stretch day, or one with nothing lighter to go to, doesn't.
function programEaseFor(prog, st, n) {
  const e = freshEase(st) || st.ease;
  const left = e ? easeLeft(prog, e.n, n) : 0;
  const day = programDay(prog, n);
  if (!left || day.stretch) return null;
  const week = easeWeek(prog, day.week, e.steps);
  return week < day.week ? { week, days: e.days, left } : null;
}
function renderProgram() {
  const prog = PROGRAMS[0];
  const ps = programStatus(prog);
  const total = prog.weeks * prog.days.length;
  els.programTitle.textContent = prog.name;
  const body = els.programBody;
  body.innerHTML = '';
  const add = (html, cls = 'workout-card program-card') => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    body.appendChild(el);
    return el;
  };
  const rhythm = `<ol class="program-rhythm">${prog.days.map(d =>
    `<li><b>${esc(d.name)}</b> <span>${esc(d.about)}</span></li>`).join('')}</ol>`;

  if (!ps) {
    const c = add(`<div class="card-name">${esc(prog.name)}</div>
      <div class="card-tagline">${esc(prog.tagline)}</div>
      <div class="card-blurb">${esc(prog.blurb)}</div>
      <div class="picker-label">Each week</div>${rhythm}
      <div class="card-blurb">Rep targets start a little lighter and build over the ${prog.weeks} weeks, and the timed days work longer and rest less as the weeks go on. Pick how long you've got each day.</div>`);
    const go = document.createElement('button');
    go.textContent = `Start ${prog.name}`;
    go.addEventListener('click', () => {
      state.programs[prog.id] = newProgram();
      savePrefs();
      keepStorage();
      renderProgram();
    });
    c.appendChild(go);
    const results = checkResults(null);
    if (results) body.appendChild(results);
    return;
  }

  if (ps.finished) {
    const c = add(`<div class="card-name">${prog.weeks} weeks done</div>
      <div class="card-blurb">That's the whole of ${esc(prog.name)}. Go again from the start, or keep choosing Surf fitness in Build a workout.</div>`);
    c.appendChild(restartButton(prog));
    // one more Surf check, to see how far you've come
    if (finalCheckDue(prog, ps.st)) {
      const last = add('', 'workout-card program-card program-today');
      fillCheckDay(last, prog, ps.st, null, { tagline: `${prog.name} · after ${prog.weeks} weeks`, rerender: renderProgram, final: true });
    }
    const results = checkResults(ps.st);
    if (results) body.appendChild(results);
    return;
  }
  const { st, n, day, last, doneToday } = ps;
  const streak = programStreak(st);
  // the surfs, once there are any: this week's, and how the paddle-outs
  // have gone, oldest first (the last six said)
  const surfs = surfsThisWeek(st);
  const surfing = surfsOf(st).length > 0 || st.done.some(d => d.surfed);
  const felt = surfsOf(st).filter(x => x.paddle).slice(-6).map(x => PADDLE_FEEL[x.paddle]);
  // what a day in the strip was: a session, a surf in its place (before
  // surfs sat beside the program), a paddle or a Surf check
  const mark = (rec) => (rec.surfed ? ['Surf', 'surfed'] : rec.water ? ['Water', 'paddled']
    : rec.check ? ['Check', 'Surf check done'] : ['✓', 'done']);
  add(`<div class="program-progress">
      <div><b>Week ${day.week}</b> of ${prog.weeks}</div>
      <div><b>Day ${n + 1}</b> of ${total}</div>
      <div><b>${streak}</b> day${streak === 1 ? '' : 's'} in a row</div>
      ${surfing ? `<div class="program-surfs"><b>${surfs}</b> surf${surfs === 1 ? '' : 's'} this week</div>` : ''}
    </div>
    <div class="program-week">${prog.days.map((d, i) => {
      const at = (day.week - 1) * prog.days.length + i;
      const rec = st.done.find(x => x.n === at);
      const cls = rec ? 'done' : at === n ? 'now' : '';
      return `<div class="program-dot ${cls}" title="Day ${at + 1}: ${esc(d.name)}" aria-label="Day ${at + 1}, ${esc(d.name)}${rec ? `, ${mark(rec)[1]}` : ''}">
        <b>${at + 1}</b><span>${esc(d.short || d.name)}</span><i>${rec ? mark(rec)[0] : at === n ? (doneToday ? 'Next' : 'Today') : ''}</i></div>`;
    }).join('')}</div>
    ${felt.length ? `<div class="paddle-felt" role="img" aria-label="Paddle-outs lately, oldest first: ${felt.join(', ')}">Paddle-outs lately: ${felt.join(' → ')}</div>` : ''}`, 'program-status');

  if (doneToday && !state.programAhead) {
    const c = add(`<div class="card-name">Today's done</div>
      <div class="card-blurb">${last.surfed ? 'A surf counts. ' : last.water ? 'A paddle counts. ' : last.check ? 'Surf check done. ' : ''}Next up: <b>${esc(day.name)}</b>. ${esc(day.about)}</div>`);
    const again = document.createElement('button');
    again.className = 'secondary';
    again.textContent = 'Do the next one now anyway';
    again.addEventListener('click', () => { state.programAhead = true; renderProgram(); });
    // a surf after the session is logged too
    c.append(again, surfLog(prog, st, renderProgram, false));
  } else {
    renderProgramToday(prog, st, day);
  }
  const results = checkResults(st);
  if (results) body.appendChild(results);
  const foot = add(`<div class="picker-label">Each week</div>${rhythm}`, 'program-foot');
  foot.appendChild(restartButton(prog));
}
function restartButton(prog) {
  const b = document.createElement('button');
  b.className = 'card-remove';
  b.textContent = 'Start the program again';
  b.addEventListener('click', () => {
    if (b.dataset.sure) {
      // from day 1 again, keeping the surfs: they're a log of surfing, not
      // days of the program (and the Surf checks are kept apart anyway)
      const was = state.programs[prog.id];
      state.programs[prog.id] = { ...newProgram(), surfs: was ? surfsOf(was) : [] };
      savePrefs();
      renderProgram();
    } else {
      b.dataset.sure = '1';
      b.textContent = 'Tap again to start over from day 1';
    }
  });
  return b;
}
// Today's session on the program screen, above the weekly rhythm.
function renderProgramToday(prog, st, day) {
  const c = document.createElement('div');
  c.className = 'workout-card program-card program-today';
  fillProgramDay(c, prog, st, day, {
    tagline: `Today · Week ${day.week}`, rerender: renderProgram, note: els.programNote,
    gearHint: 'To add a place or change its gear: '
  });
  els.programBody.insertBefore(c, els.programBody.querySelector('.program-foot'));
}
// Today's session: what it's for, how long you've got, and go. The program
// screen and the home card both show it, so they say how to redraw and
// where a message goes.
function fillProgramDay(c, prog, st, day, { tagline, rerender, note, gearHint }) {
  // every two weeks, a Surf check in the day's place (see SURF CHECKS)
  if (checkToday(prog, st, day.n)) return fillCheckDay(c, prog, st, day, { tagline, rerender });
  // back after time off, an earlier week's reps and timing (as Start builds it)
  const ease = programEaseFor(prog, st, day.n);
  if (ease) day = easedDay(prog, day, ease.week);
  // a timed day says this week's split: "45s on, 15s off this week"
  const timing = Object.values(day.workRest || {}).map(([on, off]) => `${on}s on, ${off}s off`).join(', ');
  c.innerHTML = `<div class="card-tagline">${esc(tagline)}</div>
    <div class="card-name">${esc(day.name)}</div>
    <div class="card-blurb">${esc(day.about)}</div>
    ${timing ? `<div class="day-timing">${esc(timing)} ${ease ? 'today, easing back in' : 'this week'}</div>` : ''}`;
  // the notes go under Start, so Start stays on the first screen of a phone
  const notes = [];
  if (ease) {
    const load = `week ${ease.week}'s ${day.workRest ? 'reps and timing' : 'reps'}`;
    const line = programHint(ease.left > 1
      ? `Welcome back. After ${ease.days} days off, this session and the next are a bit lighter (${load}) to ease you back in.`
      : `Still easing back in: this one's a bit lighter too (${load}). Then it's back to week ${programDay(prog, day.n).week}.`);
    line.classList.add('ease-line');
    notes.push(line);
  }
  if (!day.stretch) {
    if (!TIME_OPTIONS.includes(state.programMinutes)) state.programMinutes = TIME_OPTIONS.includes(day.minutes) ? day.minutes : 20;
    c.append(pickerLabel('How long have you got?'),
      timeChips(TIME_OPTIONS, state.programMinutes, m => { state.programMinutes = m; rerender(); }));
    // every length is on offer; a mix that won't fit says what it runs as
    const style = programStyle(day, state.programMinutes);
    if (style.short) {
      notes.push(programHint(`${state.programMinutes} min is too short for ${day.mix.map(id => INTERVALS[id].label).join(' and ')}, so today it's just the ${INTERVALS[style.intervalId].label}.`));
    }
    // the leave-outs from Build a workout apply here too, so say so
    const out = leftOutList();
    if (out) {
      const line = programHint(`Left out, as in Build a workout: ${out}. `);
      line.classList.add('program-out');
      line.appendChild(linkButton('Change', () => { openSetup(); setMoreOptions(true); }));
      notes.push(line);
    }
  }
  // the Surf check put off till tomorrow, with the way back to it
  if (isCheckDay(prog, day.n) && checkFits()) {
    const line = programHint('Not doing the Surf check today. ');
    line.classList.add('check-later');
    const back = linkButton('Do the Surf check', () => {
      const now = state.programs[prog.id];
      if (now) { delete now.checkLater; savePrefs(); }
      rerender();
    });
    back.id = 'btnCheckBack';
    line.appendChild(back);
    notes.push(line);
  }
  c.append(...peopleGearRows(!day.stretch, rerender, gearHint));
  const go = document.createElement('button');
  go.className = 'program-go';
  go.textContent = "Start today's session";
  go.addEventListener('click', () => {
    const err = startProgramDay(prog, day);
    if (err) note.textContent = err;
  });
  c.append(go, ...notes, surfLog(prog, st, rerender, true));
  if (day.water) c.append(waterAlt(prog, day, rerender, note));
}
// "I surfed today", which logs a surf beside the program (see PROGRAMS);
// once one's logged today, how the paddle-out felt (one tap, if you want
// to say) and Undo. With today's session still to do, it says that's
// optional now.
function surfLog(prog, st, rerender, optional) {
  const surf = todaysSurf(st);
  // one logged today on a release before, in the day's place (see
  // PROGRAMS): logged, with its Undo while it's the last day done, as then
  const before = !surf && st.done.find(d => d.surfed && dayKey(d.at) === dayKey(Date.now()));
  if (before) {
    const head = document.createElement('div');
    head.className = 'surf-head';
    head.textContent = 'Surf logged for today. ';
    if (st.done[st.done.length - 1] === before) {
      head.appendChild(linkButton('Undo', () => {
        const now = state.programs[prog.id];
        const last = now && now.done[now.done.length - 1];
        if (last && last.surfed && dayKey(last.at) === dayKey(Date.now())) { now.done.pop(); savePrefs(); }
        rerender();
      }));
    }
    const box = document.createElement('div');
    box.className = 'surf-log';
    box.append(head);
    return box;
  }
  if (!surf) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = 'I surfed today';
    b.addEventListener('click', () => {
      // as it is now: another tab may have saved since this was drawn
      const now = state.programs[prog.id];
      if (now && !todaysSurf(now)) {
        noteEase(now);
        surfsOf(now).push({ at: Date.now() });
        savePrefs();
      }
      rerender();
    });
    return b;
  }
  const box = document.createElement('div');
  box.className = 'surf-log';
  const head = document.createElement('div');
  head.className = 'surf-head';
  head.textContent = 'Surf logged for today. ';
  // a mis-tap can be taken back: today's surf only (another tab may have
  // changed the list since this was drawn, so it's looked up afresh)
  head.appendChild(linkButton('Undo', () => {
    const now = state.programs[prog.id];
    const mine = now && todaysSurf(now);
    if (mine) { now.surfs.splice(now.surfs.indexOf(mine), 1); savePrefs(); }
    rerender();
  }));
  const row = document.createElement('div');
  row.className = 'chip-row paddle-chips';
  Object.entries(PADDLE_FEEL).forEach(([id, label]) => {
    const on = surf.paddle === id;
    const chip = tappable('chip' + (on ? ' active' : ''), () => {
      const now = state.programs[prog.id];
      const mine = now && todaysSurf(now);
      if (mine && mine.paddle !== id) { mine.paddle = id; savePrefs(); }
      rerender();
    });
    chip.textContent = label;
    chip.dataset.paddle = id;
    chip.setAttribute('aria-pressed', String(on));
    row.appendChild(chip);
  });
  box.append(head, pickerLabel('How was the paddle-out?'), row);
  if (optional) box.append(programHint("Today's session is optional now: do it if you're keen, or it'll wait for tomorrow."));
  return box;
}
// On a paddle day, a closed "Near the water?" with the flat-day paddles
// (see WATER_SESSIONS): ticking one off is the day done, with an Undo.
let waterOpen = false;           // left open as the card redraws, for this visit
function waterAlt(prog, day, rerender, note) {
  const box = document.createElement('details');
  box.className = 'water-alt';
  box.open = waterOpen;
  box.addEventListener('toggle', () => { waterOpen = box.open; });
  box.innerHTML = `<summary>Near the water? Paddle it instead</summary>
    <div class="program-hint">On a flat day, one of these on your board does the same job as the land session. Short enough to remember, so the phone stays on the sand.</div>
    <div class="water-safety">${esc(WATER_SAFETY)}</div>`;
  day.water.map(id => WATER_SESSIONS.find(w => w.id === id)).filter(Boolean).forEach(w => {
    const el = document.createElement('div');
    el.className = 'water-session';
    el.innerHTML = `<div class="water-name">${esc(w.name)} <span>${esc(w.about)}</span></div>
      <ol>${w.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`;
    const did = document.createElement('button');
    did.className = 'secondary';
    did.textContent = 'I did this';
    did.dataset.water = w.id;
    did.addEventListener('click', () => {
      const now = state.programs[prog.id];
      if (!now || now.done.some(d => d.n === day.n)) { rerender(); return; }
      noteEase(now);
      now.done.push({ n: day.n, at: Date.now(), water: w.id });
      savePrefs();
      waterOpen = false;
      rerender();
      note.textContent = `Ticked off: ${w.name}. `;
      // a mis-tap can be taken back: only today's paddle, and only the last day done
      note.appendChild(linkButton('Undo', () => {
        const now = state.programs[prog.id];
        const last = now && now.done[now.done.length - 1];
        if (last && last.water && dayKey(last.at) === dayKey(Date.now())) { now.done.pop(); savePrefs(); }
        note.textContent = '';
        rerender();
      }));
      // it sits above the card, out of sight from down here
      note.scrollIntoView({ block: 'center' });
    });
    el.appendChild(did);
    box.appendChild(el);
  });
  return box;
}
function programHint(text) {
  const el = document.createElement('div');
  el.className = 'program-hint';
  el.textContent = text;
  return el;
}
// "no jumping, no floor work and 2 movements": what Build a workout leaves
// out, or '' when nothing is.
function leftOutList() {
  const parts = EXCLUSION_TAGS.filter(t => state.blockedTags.includes(t.id)).map(t => t.label.toLowerCase());
  const n = state.excluded.length;
  if (n) parts.push(`${n} movement${n === 1 ? '' : 's'}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join('');
}
function pickerLabel(text) {
  const label = document.createElement('div');
  label.className = 'picker-label';
  label.textContent = text;
  return label;
}
// "10 min", "15 min"...; tapping one hands it to onPick. Times under
// `floor` (see mixFloor) are dimmed and can't be picked.
function timeChips(options, current, onPick, floor = 0) {
  const row = document.createElement('div');
  row.className = 'chip-row time-chips';
  options.forEach(m => {
    const chip = tappable('chip' + (m === current ? ' active' : '') + (m < floor ? ' dim' : ''),
      () => { if (m >= floor) onPick(m); });
    chip.textContent = `${m} min`;
    chip.setAttribute('aria-pressed', String(m === current));
    if (m < floor) chip.setAttribute('aria-disabled', 'true');
    row.appendChild(chip);
  });
  return row;
}
// Who's training and where, so today's session can be checked and changed
// without going back into setup. The place only shows once there's more
// than one to pick from, and stretch days don't use gear, so they only get
// the people row.
function peopleGearRows(withGear, rerender, gearHint) {
  const rows = [];
  const pick = (text, options) => {
    const row = document.createElement('div');
    row.className = 'chip-row';
    options.forEach(o => {
      const chip = tappable('chip' + (o.on ? ' active' : ''), () => { if (!o.on) { o.pick(); savePrefs(); rerender(); } });
      chip.textContent = o.text;
      chip.setAttribute('aria-pressed', String(o.on));
      chip.dataset.pick = o.key;
      row.appendChild(chip);
    });
    rows.push(pickerLabel(text), row);
  };
  pick('How many of you?', [1, 2].map(n => ({
    key: `people-${n}`, text: n === 1 ? '1 person' : '2 people', on: state.people === n,
    pick: () => { state.people = n; renderPeoplePicker(); }
  })));
  if (withGear) ensureGearSets();
  if (withGear && state.gearSets.length > 1) {
    pick('Training at', state.gearSets.map(g => ({
      key: `gear-${g.id}`, text: g.name, on: g.id === state.gearSetId, pick: () => useGearSet(g.id)
    })));
    // with a way there: on home a waiting session hides Build a workout
    if (gearHint) {
      const note = programHint(gearHint);
      note.appendChild(linkButton('Change', openSetup));
      rows.push(note);
    }
  }
  return rows;
}
// Opens the day's session. Returns an error message, or null.
function startProgramDay(prog, day) {
  state.programRun = { id: prog.id, n: day.n };
  if (day.stretch) {
    const w = STRETCH_ROUTINES.find(x => x.id === day.stretch);
    openWorkout(w);
    return null;
  }
  // back after time off, an earlier week's reps and timing (see
  // programEaseFor), which the request keeps for a favourite or a link
  const st = state.programs[prog.id];
  const ease = st && programEaseFor(prog, st, day.n);
  if (ease) day = easedDay(prog, day, ease.week);
  const minutes = state.programMinutes || day.minutes;
  // a mix too long for the minutes runs as its first style (see programStyle)
  const { intervalId, mix } = programStyle(day, minutes);
  const request = {
    minutes,
    people: state.people,
    intervalId, mix,
    goal: prog.goal, surfFocus: day.focus, repScale: day.repScale, workRest: day.workRest,
    // the leave-outs from Build a workout, the same as any other session
    regions: REGIONS.map(r => r.id), blockedTags: state.blockedTags.slice(),
    repScales: personalScales(), spare: SPARE_BELLS
  };
  const err = buildAndOpen(request);
  if (err) state.programRun = null;
  return err;
}
// Called when a session finishes: tick off the program day it was (a
// Surf check in its place says so; the last one, after the end, has no
// day to tick).
function completeProgramDay() {
  const run = state.programRun;
  if (!run) return;
  const st = state.programs[run.id];
  const prog = PROGRAMS.find(p => p.id === run.id);
  if (st && prog && run.n < prog.weeks * prog.days.length && !st.done.some(d => d.n === run.n)) {
    noteEase(st);
    st.done.push({ n: run.n, at: Date.now(), ...(run.check ? { check: true } : {}) });
    savePrefs();
  }
}

// =====================================================================
// SURF CHECKS
// Every two weeks Surf Fit offers a Surf check (see SURF_CHECK in
// js/workouts.js) in place of the day's session, with Not today to do the
// session instead (for today: tomorrow it's offered again, unless the
// session was done), and one more after the last day. It's done as that
// day ({ n, at, check: true } in done), so where you're up to moves on as
// it would have.
//
// The results are kept apart from the history (which keeps 200 sessions
// and can be cleared), one entry a check, oldest first: { at, n, results:
// { [person]: { name, popups, pushups, paddle } } }, each person by their
// name as their level is (or their spot, '#a', with no name), with the
// name as it was written, and only what they put in (paddle is seconds).
// n is the program day it was on (the last one past the end); a check run
// again from the history has none. Starting the program again keeps them,
// shown as earlier, by date. They're under their own key too (CHECKS_KEY),
// so a tab on an older release, which doesn't know them, can't lose them.
// =====================================================================
const CHECKS_CAP = 100;          // checks kept, newest: 4 a program, years of them
// The checks as stored (or from another tab, or a backup), each part
// checked, with anything that can't be used let go.
function cleanChecks(x) {
  const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const list = (Array.isArray(x) ? x : []).filter(c => plain(c) && typeof c.at === 'number' && Number.isFinite(c.at) && plain(c.results)).map(c => {
    const results = {};
    Object.keys(c.results).slice(0, 4).forEach(key => {
      const r = c.results[key];
      if (!key || key.length > 30 || key === '__proto__' || !plain(r)) return;
      const one = { name: typeof r.name === 'string' ? r.name.trim().slice(0, 14) : '' };
      SURF_CHECK.stations.forEach(t => { if (Number.isInteger(r[t.id]) && r[t.id] > 0 && r[t.id] <= t.most) one[t.id] = r[t.id]; });
      if (Object.keys(one).length > 1) results[key] = one;
    });
    return { at: c.at, ...(Number.isInteger(c.n) && c.n >= 0 ? { n: c.n } : {}), results };
  });
  return list.filter(c => Object.keys(c.results).length).sort((a, b) => a.at - b.at).slice(-CHECKS_CAP);
}
const checkHas = (key) => state.checks.some(c => ownKey(c.results, key));
// Whose results a spot's are: their name's, or until that name has any,
// the spot's from before it had a name (Wayne on his own, say, before
// Dave came round and they put their names in).
function checkKey(which) {
  const key = levelKey(which), spot = `#${which}`;
  return key !== spot && !checkHas(key) && checkHas(spot) ? spot : key;
}
// This person's last result in a test, before the check under way, or null.
function lastCheck(which, testId) {
  const key = checkKey(which);
  for (let i = state.checks.length - 1; i >= 0; i--) {
    const c = state.checks[i];
    const r = c.at !== state.checkAt && ownKey(c.results, key) && c.results[key];
    if (r && r[testId]) return r[testId];
  }
  return null;
}
// Someone has a result in test k of the check under way.
const checkScored = (k) => !!state.scores[k] && (state.scores[k].a > 0 || state.scores[k].b > 0);
// "12", "1:35", or a dash for a test not put in.
const checkValue = (test, v) => (v ? (test.hold ? fmt(v) : String(v)) : '–');
// Keep the check under way (at its finish, and as a count is changed
// after): its entry, made the first time anyone has a result in it, or
// taken out again if all of them are taken back.
function recordCheck() {
  const w = state.workout;
  const who = state.people === 2 ? ['a', 'b'] : ['a'];
  // a name's first results take in its spot's from before it had one
  who.forEach(x => {
    const key = levelKey(x), spot = checkKey(x);
    if (spot !== key) state.checks.forEach(c => { if (ownKey(c.results, spot) && !ownKey(c.results, key)) { c.results[key] = c.results[spot]; delete c.results[spot]; } });
  });
  const results = {};
  who.forEach(x => {
    const r = { name: nameOn(x).slice(0, 14) };
    w.stations.forEach((t, k) => {
      const v = state.scores[k] && state.scores[k][x];
      if (v > 0) r[t.id] = Math.min(Math.round(v), t.most);
    });
    if (Object.keys(r).length > 1) results[levelKey(x)] = r;
  });
  const i = state.checks.findIndex(c => c.at === state.checkAt);
  if (i >= 0 && !Object.keys(results).length) state.checks.splice(i, 1);
  else if (i >= 0) state.checks[i].results = results;
  else if (Object.keys(results).length) {
    state.checkAt = Date.now();
    const run = state.programRun;
    state.checks.push({ at: state.checkAt, ...(run && run.check ? { n: run.n } : {}), results });
    state.checks = state.checks.slice(-CHECKS_CAP);
  }
  savePrefs();
  keepStorage();
}
// On the finish screen, each test for one person: what they did (a count
// can still be changed, for one not put in in the rest), and against
// their last.
function checkFinish(who) {
  return state.workout.stations.map((t, k) => {
    const v = (state.scores[k] && state.scores[k][who]) || 0;
    const last = lastCheck(who, t.id);
    const row = document.createElement('div');
    row.className = 'check-result';
    const head = document.createElement('div');
    head.className = 'check-label';
    head.textContent = t.label;
    const count = document.createElement('div');
    count.className = 'round-counter check-count';
    count.dataset.who = who;
    count.dataset.test = k;
    count.innerHTML = t.hold ? `<div class="count-now check-time"><b>${checkValue(t, v)}</b> ${v ? 'held' : 'not timed'}</div>` : countButtons(t, v);
    const change = document.createElement('div');
    change.className = 'check-change';
    change.setAttribute('role', 'status');
    change.textContent = !v ? '' : last ? checkChange(t, v, last) : 'Your first one: the number to beat.';
    row.append(head, count, change);
    return row;
  });
}
// A count changed on the finish screen: kept at once.
function onCheckFinishTap(e) {
  const b = e.target.closest('button[data-step]');
  const box = b && b.closest('.check-count');
  if (!box || !isFinished() || !state.workout || state.workout.format !== 'check') return;
  const who = box.dataset.who, k = +box.dataset.test, test = state.workout.stations[k];
  const s = state.scores[k] || (state.scores[k] = { a: 0, b: 0 });
  s[who] = Math.min(test.most, Math.max(0, (s[who] || 0) + +b.dataset.step));
  recordCheck();
  const keyboard = document.activeElement === b;
  renderFinishPeople();
  const again = els['finish' + who.toUpperCase()].querySelector(`.check-count[data-test="${k}"] button[data-step="${b.dataset.step}"]`);
  if (keyboard && again) again.focus();
}
els.finishA.addEventListener('click', onCheckFinishTap);
els.finishB.addEventListener('click', onCheckFinishTap);

// A check fits what Build a workout leaves out: all three tests are on the
// floor, so with No floor work (or one of its moves left out) it isn't
// offered, and the day is its usual session.
const checkFits = () => !state.blockedTags.includes('floor')
  && !SURF_CHECK.stations.some(t => state.excluded.includes(t.ex));
// Day n's Surf check is on offer today: a check day, and not put off.
const checkToday = (prog, st, n) => isCheckDay(prog, n) && checkFits() && st.checkLater !== dayKey(Date.now());
// The last check, after the last day: offered until it's done, this time through.
function finalCheckDue(prog, st) {
  const total = prog.weeks * prog.days.length;
  return !!prog.finalCheck && checkFits() && !state.checks.some(c => c.n === total && c.at >= (st.startedAt || 0));
}
function startCheck(prog, n) {
  state.programRun = { id: prog.id, n, check: true };
  openWorkout(SURF_CHECK);
}
// The Surf check in the day's place, on the program screen and the home
// card (see fillProgramDay), or the last one after the end: what it is,
// who's doing it, and go; and Not today, for the day's session instead.
function fillCheckDay(c, prog, st, day, { tagline, rerender, final }) {
  const n = final ? prog.weeks * prog.days.length : day.n;
  c.innerHTML = `<div class="card-tagline">${esc(tagline)}</div>
    <div class="card-name">${final ? 'The last Surf check' : 'Surf check'}</div>
    <div class="card-blurb">${final ? "The same three tests once more, to see how far you've come"
      : `Every two weeks, in place of ${esc(day.name)}: three quick tests to see your pop-ups and paddling getting better`}.
      Pop-ups in a minute, push-ups in a minute, then a paddle hold. About ${checkMinutes(SURF_CHECK)} minutes.</div>`;
  c.append(...peopleGearRows(false, rerender));
  if (state.people === 2) c.append(...checkNames());
  const go = document.createElement('button');
  go.className = 'program-go';
  go.textContent = final ? 'Start the last Surf check' : 'Start the Surf check';
  go.addEventListener('click', () => startCheck(prog, n));
  c.append(go);
  if (!final) {
    const later = programHint('');
    later.classList.add('check-later');
    const no = linkButton('Not today', () => {
      const now = state.programs[prog.id];
      if (now) { now.checkLater = dayKey(Date.now()); savePrefs(); }
      rerender();
    });
    no.id = 'btnCheckLater';
    // (doing the session is what moves it on: put off and not trained, it's back tomorrow)
    later.append(no, `? Do ${day.name} instead, and the next check is in two weeks.`);
    c.append(later, surfLog(prog, st, rerender, true));
  }
}
// With two of you and a name missing, the names the results are kept
// under (the same as in setup).
function checkNames() {
  const label = pickerLabel('Your names, so you each keep your own results');
  const row = document.createElement('div');
  row.className = 'name-inputs check-names';
  ['a', 'b'].forEach(w => {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.autocomplete = 'off';
    input.enterKeyHint = 'done';
    input.placeholder = w === 'a' ? 'First name' : 'Second name';
    input.setAttribute('aria-label', `Person ${w.toUpperCase()}'s name`);
    input.dataset.name = w;
    input.value = w === 'a' ? state.nameA : state.nameB;
    input.addEventListener('input', () => {
      if (w === 'a') state.nameA = els.nameA.value = input.value; else state.nameB = els.nameB.value = input.value;
      savePrefs();
    });
    row.appendChild(input);
  });
  return (state.nameA || '').trim() && (state.nameB || '').trim() ? [] : [label, row];
}
// What a person's results go by: their name, as last written.
function checkPeople(list) {
  const people = new Map();
  list.forEach(c => Object.entries(c.results).forEach(([key, r]) => {
    if (!people.has(key)) people.set(key, { key, rows: [] });
    people.get(key).rows.push({ at: c.at, ...r });
  }));
  return [...people.values()].map(p => {
    const named = [...p.rows].reverse().find(r => r.name);
    return { ...p, name: named ? named.name : p.key === '#b' ? 'Person B' : 'You' };
  });
}
// "12 pop-ups, 20 push-ups and a 1:35 paddle hold"
function checkSaid(r) {
  const parts = SURF_CHECK.stations.filter(t => r[t.id]).map(t => (t.hold ? `a ${fmt(r[t.id])} ${t.short}` : `${r[t.id]} ${t.short}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join('');
}
// The results on the Programs screen, each person's line for each test,
// oldest first ("Pop-ups in a minute: 9, 12, 14"), since the program was
// started; from before it was started again, closed, by date. Null with
// no checks yet.
function checkResults(st) {
  if (!state.checks.length) return null;
  const from = st && typeof st.startedAt === 'number' ? st.startedAt : 0;
  const now = state.checks.filter(c => c.at >= from), before = state.checks.filter(c => c.at < from);
  const box = document.createElement('div');
  box.className = 'workout-card program-card check-results';
  box.innerHTML = '<div class="card-name">Surf check results</div>';
  checkPeople(now).forEach(p => {
    const el = document.createElement('div');
    el.className = 'check-person';
    el.innerHTML = `<div class="check-who"><b>${esc(p.name)}</b> <span>${esc(p.rows.map(r => shortDate(r.at)).join(', '))}</span></div>`
      + SURF_CHECK.stations.filter(t => p.rows.some(r => r[t.id])).map(t =>
        `<div class="check-line">${esc(t.label)}: <b>${esc(p.rows.map(r => checkValue(t, r[t.id])).join(', '))}</b></div>`).join('');
    box.appendChild(el);
  });
  if (!now.length) box.appendChild(programHint("None yet since you started again. Your earlier ones are here."));
  if (before.length) {
    const old = document.createElement('details');
    old.className = 'check-earlier';
    old.innerHTML = '<summary>Earlier, before you started again</summary>' + checkPeople(before).map(p =>
      `<div class="check-person"><div class="check-who"><b>${esc(p.name)}</b></div>${p.rows.map(r =>
        `<div class="check-line">${esc(shortDate(r.at))}: ${esc(checkSaid(r))}</div>`).join('')}</div>`).join('');
    box.appendChild(old);
  }
  return box;
}

// =====================================================================
// FIRST VISIT
// Before anything else, a new visitor says who's training and what gear
// they've got, so the first workout doesn't hand them kettlebell swings
// with no kettlebell, or a Person A and B when they're on their own.
// Everything starts off, weights included; whatever's ticked becomes the
// Home gear set.
// =====================================================================
function openGearQuestion() {
  GEAR.forEach(g => { state.equipment[g.id] = false; });
  state.weights = { kb: [], db: [], bar: 10 };
  els.gearNote.textContent = '';
  renderGearQuestion();
  setView('gear');
}
function renderGearQuestion() {
  els.onboardPeople.innerHTML = '';
  [[1, 'Just me'], [2, 'Me and a mate']].forEach(([n, text]) => {
    const on = state.people === n;
    const b = tappable('chip people-chip' + (on ? ' active' : ''), () => { state.people = n; renderGearQuestion(); });
    b.textContent = text;
    b.setAttribute('aria-pressed', String(on));
    els.onboardPeople.appendChild(b);
  });
  els.onboardGear.innerHTML = '';
  els.onboardWeights.innerHTML = '';
  GEAR.forEach(g => {
    const on = state.equipment[g.id] !== false;
    const b = tappable('chip' + (on ? ' active' : ''), () => {
      state.equipment[g.id] = !on;
      renderGearQuestion();
    });
    b.textContent = g.label;
    b.setAttribute('aria-pressed', String(on));
    els.onboardGear.appendChild(b);
    // the same weight chips as setup, under each ticked item that has them
    if (on && g.weights) els.onboardWeights.appendChild(weightRow(g.weights, renderGearQuestion));
  });
  const any = GEAR.some(g => state.equipment[g.id] !== false);
  els.btnGearDone.textContent = any ? 'Done' : 'Just bodyweight for now';
  if (els.gearNote.textContent === NO_BELLS && !noBells()) els.gearNote.textContent = '';
}
// Kettlebells ticked with no bell picked would quietly mean no kettlebell
// moves at all, so Done asks for the bells first.
const NO_BELLS = "Tick the bells you've got, or untick Kettlebells.";
const noBells = () => state.equipment.kettlebells !== false && !state.weights.kb.length;
function finishGearQuestion() {
  if (noBells()) {
    els.gearNote.textContent = NO_BELLS;
    els.gearNote.scrollIntoView({ block: 'nearest' });
    return;
  }
  state.gearAsked = true;
  saveIntoGearSet();
  savePrefs();
  goWelcome();
}

// =====================================================================
// EVENT WIRING
// =====================================================================
// the library always opens on everything, whatever focus was picked last time
els.pathLibrary.addEventListener('click', () => {
  state.filterFocus = 'all';
  savePrefs();
  restoreOpen = false;
  openLibrary();
});
els.btnMoreOptions.addEventListener('click', () => setMoreOptions(els.moreOptions.hidden));
els.btnGearDone.addEventListener('click', finishGearQuestion);
// straight to Restore, for the home-screen app or a new device
els.btnGearRestore.addEventListener('click', () => {
  restoreOpen = true;
  openLibrary();
  $('yourData').scrollIntoView({ block: 'start' });
});
els.btnSetupBack.addEventListener('click', () => (state.setupFrom === 'program' ? openProgram() : goWelcome()));
els.btnLibraryBack.addEventListener('click', goWelcome);
// a program's session goes back to the program, anything else to the menu
function leaveWorkout() {
  disarmBack();
  hush();
  releaseAudio();
  // a session left on purpose (two taps on Menu, or Done) isn't offered again
  if (state.started) clearRun();
  if (state.programRun) openProgram(); else goWelcome();
}
// Two-tap leave once a workout is going, like Reset, so a stray tap on
// Menu can't throw the session away.
let backArmed = false, backTimer = null;
function disarmBack() {
  clearTimeout(backTimer);
  backArmed = false;
  els.btnBack.textContent = '← Menu';
}
const inProgress = () => state.started && (state.running || state.elapsedTotal > 0) && !isFinished();
els.btnBack.addEventListener('click', () => {
  if (backArmed || !inProgress()) return leaveWorkout();
  backArmed = true;
  els.btnBack.textContent = 'Tap again';      // short, so the title beside it keeps its room
  backTimer = setTimeout(disarmBack, 2000);
});
els.btnProgramBack.addEventListener('click', goWelcome);
els.pathProgram.addEventListener('click', openProgram);

els.peoplePicker.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    state.people = Number(chip.dataset.people);
    savePrefs();
    renderPeoplePicker();
  });
});
els.nameA.addEventListener('input', (e) => { state.nameA = e.target.value; savePrefs(); });
els.nameB.addEventListener('input', (e) => { state.nameB = e.target.value; savePrefs(); });

els.bodyMap.querySelectorAll('.zone').forEach(z => {
  z.addEventListener('click', () => toggleRegion(z.dataset.region));
  z.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRegion(z.dataset.region); }
  });
});

els.btnOpenExclude.addEventListener('click', () => {
  els.excludePanel.hidden = !els.excludePanel.hidden;
  if (!els.excludePanel.hidden) renderExcludeList();
});
els.excludeSearch.addEventListener('input', (e) => {
  state.excludeSearch = e.target.value;
  renderExcludeList();
});
els.btnClearExclude.addEventListener('click', () => {
  state.excluded = [];
  savePrefs();
  renderExcludeList();
  renderExcludeSummary();
});

els.btnBuild.addEventListener('click', () => {
  els.buildNote.textContent = '';
  const err = buildAndOpen(requestFromState());
  if (!err) return;
  // the note sits under the button at the very end of a long page, so
  // bring it up beside the button rather than leave the tap looking dead
  els.buildNote.textContent = err;
  els.buildNote.scrollIntoView({ block: 'center' });
});

// A new build of the same request, at each person's level today, not the
// one a favourite or a link was built at, and with the spare bells.
els.btnShuffle.addEventListener('click', () => {
  const request = { ...(state.lastRequest || requestFromState()), repScales: personalScales(), spare: SPARE_BELLS };
  const err = buildAndOpen(request, newSeed());
  if (err) els.workoutNote.textContent = err;
});

els.btnSave.addEventListener('click', () => {
  const w = state.workout;
  if (!w || !w.generated) return;
  const fav = state.saved.find(s => s.seed === w.seed);
  if (fav) {
    // saved before a swap: it keeps the swaps from now on
    fav.swaps = keptSwaps(w);
    if (!fav.swaps) delete fav.swaps;
  } else {
    // the exercises it was built with, so an update can't change it (see
    // FROZEN WORKOUTS in js/workouts.js), and any moves swapped
    state.saved.unshift({
      name: w.name, blurb: w.blurb, focus: w.focus, seed: w.seed,
      request: w.request, frozen: freezeWorkout(w), swaps: keptSwaps(w),
      savedOn: new Date().toLocaleDateString()
    });
  }
  savePrefs();
  keepStorage();
  renderSaveButton();
});

els.btnShare.addEventListener('click', async () => {
  const w = state.workout;
  if (!w) return;
  const url = shareUrlFor(w);
  const title = `FIT: ${w.name}`;
  try {
    // The share sheet where there is one (iOS, Android), the clipboard
    // elsewhere, and the bare link as the last resort.
    if (navigator.share) { await navigator.share({ title, text: shareText(w), url }); return; }
    await navigator.clipboard.writeText(url);
    els.workoutNote.textContent = 'Link copied. Open it on any phone or tablet for this exact workout.';
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // share sheet dismissed
    els.workoutNote.textContent = url;
  }
});

// Start, pause and resume from the big button or a tap on the timer. On
// the finish screen the button is Done.
const toggleTimer = () => (state.running ? pauseTimer() : startTimer());
els.btnStart.addEventListener('click', () => (isFinished() ? leaveWorkout() : toggleTimer()));
els.timerCard.addEventListener('click', () => { if (!isFinished()) toggleTimer(); });
els.btnAgain.addEventListener('click', () => { els.workoutNote.textContent = ''; resetWorkout(); startTimer(); });
els.btnSkip.addEventListener('click', () => { disarmReset(); skipBlock(); });

// Two-tap reset, so a stray tap can't wipe a session mid-workout.
let resetArmed = false, resetTimer = null;
function disarmReset() {
  clearTimeout(resetTimer);
  resetArmed = false;
  els.btnReset.textContent = 'Reset';
}
els.btnReset.addEventListener('click', () => {
  if (resetArmed) { disarmReset(); resetWorkout(); return; }
  resetArmed = true;
  els.btnReset.textContent = 'Tap again';
  resetTimer = setTimeout(disarmReset, 2000);
});

els.showPhotos.addEventListener('change', (e) => {
  state.showPhotos = e.target.checked;
  document.body.classList.toggle('hide-photos', !state.showPhotos);
  savePrefs();
});
els.showAlts.addEventListener('change', (e) => {
  state.showAlts = e.target.checked;
  document.body.classList.toggle('show-alternatives', state.showAlts);
  savePrefs();
});
// The voice on top of the beeps (see setSound for the beeps themselves).
els.voiceOn.addEventListener('change', (e) => {
  state.voice = e.target.checked;
  if (!state.voice) hush();
  else if (state.running) primeVoice();       // this tap is what lets it talk
  savePrefs();
  renderSound();
});
// before Start: down to the choice, which is at the foot of the screen
els.btnSoundJump.addEventListener('click', () => {
  els.soundBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  els.soundBox.focus({ preventScroll: true });
});
// A tap is the one moment Safari always lets audio restart, so a context
// still stuck after a call comes back on the next touch of the screen, and
// after time in the background the first tap starts a fresh one (a scroll
// doesn't count as a tap, so the old one plays on until then; see
// freshAudio).
document.addEventListener('touchend', () => {
  if (!state.running || !audioCtx) return;
  if (audioStale) freshAudio();
  else if (audioCtx.state !== 'running') ensureAudio();
}, { passive: true });

document.querySelectorAll('.text-size .mini-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.textScale = Number(btn.dataset.scale);
    applyTextScale();
    savePrefs();
  });
});
function applyTextScale() {
  document.documentElement.style.setProperty('--ex-scale', String(state.textScale));
  document.querySelectorAll('.text-size .mini-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.scale) === state.textScale);
  });
}

// =====================================================================
// SCROLL AFFORDANCE
// The cards fill the screen, so there is often no visible cue that the
// page continues below. Fade the bottom edge whenever it does. Passive
// listener and a single class toggle, so it costs nothing while scrolling.
// =====================================================================
function updateScrollHint() {
  const el = els.scroller;
  let more = el.scrollHeight - el.clientHeight - el.scrollTop > 8;
  // Not over the home Start, which on a short screen sits at the bottom
  // edge: under the fade it looks switched off.
  if (more && state.view === 'welcome') {
    const go = els.todayCard.querySelector('.today-go, .program-go');
    const r = go && go.getBoundingClientRect();
    if (r && r.top < innerHeight && r.bottom > innerHeight - els.scrollHint.offsetHeight) more = false;
  }
  document.body.classList.toggle('can-scroll', more);
}
let scrollHintQueued = false;
function queueScrollHint() {
  if (scrollHintQueued) return;
  scrollHintQueued = true;
  requestAnimationFrame(() => { scrollHintQueued = false; updateScrollHint(); });
}
els.scroller.addEventListener('scroll', queueScrollHint, { passive: true });
window.addEventListener('resize', queueScrollHint, { passive: true });
// Views swap and lists re-render without firing scroll or resize, so watch
// the content itself. It has to be the element inside the scroller, not the
// body: the body is a fixed height now and never changes size.
if ('ResizeObserver' in window) {
  new ResizeObserver(queueScrollHint).observe(els.scroller.firstElementChild);
}

// =====================================================================
// FULL SCREEN
// Two routes, because iOS gives neither one on its own:
//   1. Add to Home Screen. The manifest and the apple-mobile-web-app meta
//      tags mean it launches standalone, with no address bar and no tabs.
//      This is the real answer, and the hint below points at it.
//   2. The Fullscreen API, for when you are just browsing normally. iPad
//      Safari supports it, iPhone Safari does not, so the button only
//      appears when the browser actually offers it.
// =====================================================================
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;
// iPadOS reports itself as a Mac, hence the touch-points check.
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function setupFullscreen() {
  const canFullscreen = !!(document.documentElement.requestFullscreen ||
                           document.documentElement.webkitRequestFullscreen);
  // Already launched from the home screen: nothing left to hide.
  if (isStandalone()) return;
  // The hint describes the Safari share sheet, so only show it where that
  // exists.
  els.installHint.hidden = !IS_IOS;
  if (!canFullscreen) return;
  els.btnFullscreen.hidden = false;
  els.btnFullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const el = document.documentElement;
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    } catch (e) { /* the browser refused; the Add to Home Screen route still works */ }
  });
  const sync = () => {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    els.btnFullscreen.textContent = on ? '⤡ Exit full screen' : '⤢ Full screen';
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

// =====================================================================
// AWAY
// Coming back to the app re-derives the position from the clock, so a
// spell in the background can't leave the workout behind. A short one
// just carries on. After a longer one (a call, a text, another app) you
// may or may not have kept going, so the clock stops where it has got to
// and asks: Go back puts it where you left, paused; I kept going (or
// Resume, or a tap on the timer) carries on from where it has got to.
// =====================================================================
const AWAY_ASK_MS = 20000;
let awayFrom = null;       // when the app went out of view mid-run, and how far in
let awayBack = null;       // while the question is up: where you left

// Put the clock at a point in the session, without the chimes a tick
// sounds on the way there (seekTo goes to the start of a phase).
function placeAt(elapsed) {
  const { idx, remaining } = locate(elapsed);
  state.currentIdx = idx;
  state.elapsedTotal = state.elapsedAtResume = elapsed;
  state.runStartWall = Date.now();
  state.remainingInPhase = remaining;
  state.lastBeep = null;
  if (state.sequence[idx]) enterPhaseVisual(state.sequence[idx].kind, remaining);
}
function askAway(away) {
  const caught = elapsedNow();
  state.running = false;
  clearTick();
  // a spell longer than the rest of the session stops on its last second,
  // so I kept going runs it out and it counts as done
  placeAt(Math.max(away.elapsed, Math.min(caught, state.totalDuration - 1)));
  awayBack = away.elapsed;
  els.awayText.textContent = `You were away ${fmt((Date.now() - away.at) / 1000)}. Go back to ${fmt(away.elapsed)}?`;
  els.awayBar.hidden = false;
  // its two buttons are the answer: Resume would only mean I kept going
  els.workoutView.classList.add('asking-away');
  els.scroller.scrollTop = 0;
  render();
}
function hideAway() {
  awayBack = null;
  els.awayBar.hidden = true;
  els.workoutView.classList.remove('asking-away');
}
els.btnAwayBack.addEventListener('click', () => {
  const back = awayBack;
  hideAway();
  if (back === null || isFinished()) return;
  placeAt(back);
  render();
  saveRun();
  noteUntilGoing(`Back to ${fmt(back)}.`);
});
els.btnAwayKept.addEventListener('click', () => {
  hideAway();
  if (!isFinished()) startTimer();
});

// The browser let go of the wake lock while the page was hidden, so a
// started workout, paused or not, asks for it again, and a running one
// wakes its audio (Safari leaves it 'interrupted' after a call, or silent
// while it still says 'running', so it's re-armed either way; see
// rearmAudio). Going out of view saves the session (see RESUME), in case
// the phone closes the tab while it's away.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (audioCtx) audioStale = true;
    hush();                                // out of date by the time it's back
    awayFrom = state.running ? { at: Date.now(), elapsed: elapsedNow() } : null;
    saveRun();
    return;
  }
  if (document.visibilityState !== 'visible') return;
  const away = awayFrom;
  awayFrom = null;
  if (keepAwake) requestWakeLock();
  if (!state.running) return;
  if (audioStale) rearmAudio(); else ensureAudio();
  if (away && Date.now() - away.at > AWAY_ASK_MS) askAway(away);
  else tickClock();
});
window.addEventListener('pagehide', saveRun);

// =====================================================================
// INIT
// =====================================================================
// The settings into the controls that show them: on load, and after a
// restore (see YOUR DATA).
function showSettings() {
  els.nameA.value = state.nameA || '';
  els.nameB.value = state.nameB || '';
  els.showAlts.checked = state.showAlts;
  els.showPhotos.checked = state.showPhotos !== false;
  renderSound();
  document.body.classList.toggle('show-alternatives', state.showAlts);
  document.body.classList.toggle('hide-photos', state.showPhotos === false);
  applyTextScale();
  renderPeoplePicker();
}
loadPrefs();
showSettings();
setupFullscreen();
renderToday();
updateScrollHint();
// a shared link opens straight away; the gear question waits for a plain visit
if (location.hash.startsWith('#w=')) openLinkFromHash();
else if (!state.gearAsked) openGearQuestion();
window.addEventListener('hashchange', openLinkFromHash);

// =====================================================================
// OFFLINE AND UPDATES
// sw.js keeps every file of one release, fetched on the first visit, and
// the app runs from that copy, so it opens at once on any signal or none.
// A new release installs in the background and waits: the line at the top
// says so (not during a workout), and a tap on it moves over and reloads.
// =====================================================================
const UPDATE_CHECK_MS = 30 * 60e3;
let swReg = null, swUpdating = false, swCheckedAt = 0;
function offerUpdate() {
  els.updateBar.hidden = !(swReg && swReg.waiting && swReg.active);
}
function watchUpdates(reg) {
  swReg = reg;
  swCheckedAt = Date.now();
  offerUpdate();
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    if (next) next.addEventListener('statechange', offerUpdate);
  });
}
els.updateBar.addEventListener('click', () => {
  const next = swReg && swReg.waiting;
  if (!next) { offerUpdate(); return; }
  swUpdating = true;
  els.updateBar.textContent = 'Updating…';
  next.postMessage('update');
  // the browser can hold the new release back while the old one is busy
  setTimeout(() => { els.updateBar.textContent = 'Close FIT and open it again to finish updating'; }, 8000);
});
if ('serviceWorker' in navigator) {
  // A new release taking over: this page is the old one, and anything it
  // loaded from now on would be the new one's, so it reloads. A tap here
  // reloads at once; a tap in another tab waits for this one's workout to
  // end. The first install taking over a page fresh from the network isn't
  // an update, so that page carries on.
  let wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const update = swUpdating || wasControlled;
    wasControlled = true;
    if (!update) return;
    if (swUpdating || state.view !== 'workout') location.reload();
    else swReloadAfterWorkout = true;
  });
  const register = () => navigator.serviceWorker.register('sw.js').then(watchUpdates)
    .catch(() => { /* offline support is a nicety; the app runs without it */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
  // The home-screen app can stay open for days without loading again, so
  // it looks for a new release when it comes back to the front too.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !swReg || Date.now() - swCheckedAt < UPDATE_CHECK_MS) return;
    swCheckedAt = Date.now();
    Promise.resolve(swReg.update()).catch(() => { /* offline: next time */ });
  });
}
