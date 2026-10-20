/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  APP SHELL: views, setup flows, rendering and the timer.
*/

// The same check as in index.html, for this script with the page from an
// older release: if the scripts fail while the page loads, a release
// waiting in the service worker takes over and the page loads again.
window.addEventListener('error', function retry() {
  window.removeEventListener('error', retry);
  const sw = navigator.serviceWorker;
  if (document.readyState === 'complete' || !sw) return;
  sw.addEventListener('controllerchange', () => location.reload());
  // once the page has stopped loading, so the release it came from isn't
  // still handing it files
  window.addEventListener('load', () => sw.register('sw.js').then(reg => {
    const next = reg.waiting || reg.installing;
    if (!next) return;
    const take = () => { if (next.state === 'installed') next.postMessage('update'); };
    take();
    next.addEventListener('statechange', take);
  }).catch(() => { /* no offline copy to fall back on */ }));
});

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
  intervalStyle: DEFAULT_INTERVAL,
  // what the session is for: general fitness, or surfing (see SURF_GROUPS)
  goal: 'general',
  // programs started: { [id]: { startedAt, done: [{ n, at, surfed }] } }
  programs: {},
  // a mixed session: on, and the styles in order (see planMix)
  mixOn: false,
  mixStyles: ['emom', 'short', 'amrap'],
  regions: REGIONS.map(r => r.id),
  blockedTags: [],
  excluded: [],
  muteAudio: false,
  // on an iPhone, beep with the silent switch on (see applyAudioSession)
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
  lastBeep: null,
  tickHandle: null,
  wakeLock: null,
  excludeSearch: '',
  // "Something else today" on the home card: the day it was tapped, so the
  // program session comes back tomorrow (see renderToday). Saved, so a
  // reload the same day keeps it.
  todayOther: null
};

const PERSISTED = ['people', 'nameA', 'nameB', 'equipment', 'weights', 'minutes', 'intervalStyle', 'mixOn', 'mixStyles', 'goal', 'programs', 'gearSets', 'gearSetId',
  'regions', 'blockedTags', 'excluded', 'muteAudio', 'beepOnSilent', 'showAlts', 'showPhotos',
  'textScale', 'recent', 'saved', 'history', 'filterFocus', 'gearAsked', 'todayOther'];

// What a new visitor starts with: the fallback for anything a store or a
// backup leaves out or has the wrong shape.
const PREF_DEFAULTS = JSON.parse(JSON.stringify(Object.fromEntries(PERSISTED.map(k => [k, state[k]]))));
const TEXT_SCALES = [1, 1.2, 1.45];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    Object.assign(state, cleanPrefs(JSON.parse(raw)));
  } catch (e) { /* corrupt store: fall back to defaults */ }
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
  if (!GOALS.some(g => g.id === s.goal)) s.goal = 'general';
  if (!plain(s.programs)) s.programs = {};
  Object.keys(s.programs).forEach(id => {
    const pr = s.programs[id];
    if (!PROGRAMS.some(x => x.id === id) || !plain(pr) || !Array.isArray(pr.done)) delete s.programs[id];
    else pr.done = pr.done.filter(d => plain(d) && Number.isInteger(d.n) && typeof d.at === 'number');
  });
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
  if (!Array.isArray(s.blockedTags)) s.blockedTags = [];
  if (s.people !== 1 && s.people !== 2) s.people = 1;
  if (!TIME_OPTIONS.includes(s.minutes)) s.minutes = 20;
  fitMixMinutes(s);
  if (!TEXT_SCALES.includes(s.textScale)) s.textScale = 1;
  if (typeof s.nameA !== 'string') s.nameA = '';
  if (typeof s.nameB !== 'string') s.nameB = '';
  s.muteAudio = s.muteAudio === true;
  s.beepOnSilent = s.beepOnSilent !== false;
  s.showAlts = s.showAlts === true;
  s.showPhotos = s.showPhotos !== false;
  if (s.filterFocus !== 'all' && !focusLabelMap[s.filterFocus]) s.filterFocus = 'all';
  // stored prefs from before the gear question means it's not a first visit
  s.gearAsked = p.gearAsked !== false;
  if (s.todayOther !== dayKey(Date.now())) s.todayOther = null;   // only lasts the day
  return s;
}
// Saved with the prefs, so another tab can tell a save from this version
// (or a later one) from one made by a tab still running an older FIT.
const PREFS_SCHEMA = 2;
function currentPrefs() {
  const out = { schema: PREFS_SCHEMA };
  PERSISTED.forEach(k => { out[k] = state[k]; });
  return out;
}
function savePrefs() {
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
// A tab still on the version before this one hears nothing, so what it
// writes is the copy it loaded when it opened. That gets added to this
// tab's lists rather than taking their place, and saved straight back, so
// a session or program day done here isn't lost to it.
window.addEventListener('storage', (e) => {
  if (e.key !== PREFS_KEY || !e.newValue) return;
  let p, theirs;
  try { p = JSON.parse(e.newValue); theirs = cleanPrefs(p); } catch (err) { return; }
  const older = !(p.schema >= PREFS_SCHEMA);
  if (older) {
    mergeOlderSave(theirs);
    savePrefs();
  } else {
    state.history = theirs.history;
    state.saved = theirs.saved;
    state.programs = theirs.programs;
  }
  // redraw whatever lists them
  if (state.view === 'welcome') renderToday();
  else if (state.view === 'library') renderLibrary();
  else if (state.view === 'program') renderProgram();
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
// routine, 'mix', or the interval's id.
const styleIdOf = (w) => (w.format === 'stretch' ? 'stretch' : w.sections ? 'mix' : intervalFor(w).id);
const buildCtx = (w, ivOverride) => {
  const iv = ivOverride || intervalFor(w);
  return { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, reps: !!iv.reps, lap: !!iv.lap,
           hasEquip, loads: loadsFor(state.weights), repScale: (w && w.repScale) || undefined };
};

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
  circuitA: $('circuitA'), counterA: $('counterA'), circuitB: $('circuitB'), counterB: $('counterB'),
  animB: $('animB'), alternativeB: $('alternativeB'),
  upcoming: $('upcoming'), preStart: $('preStart'),
  previewList: $('previewList'),
  btnShuffle: $('btnShuffle'), btnSave: $('btnSave'), btnShare: $('btnShare'),
  btnStart: $('btnStart'), btnSkip: $('btnSkip'), btnReset: $('btnReset'), btnAgain: $('btnAgain'),
  workoutNote: $('workoutNote'),
  showPhotos: $('showPhotos'), showAlts: $('showAlts'), muteAudio: $('muteAudio'),
  beepOnSilent: $('beepOnSilent'), silentToggle: $('silentToggle'), silentHint: $('silentHint')
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
  const secs = sectionsOf(w);
  const work = secs.reduce((t, x) => t + sectionSeconds(x), 0) + (secs.length - 1) * (w.changeoverSec || 0);
  const bookend = w.warmupSec + w.cooldownSec;
  return {
    totalMin: Math.round((work + bookend) / 60), totalSec: work + bookend,
    workMin: Math.round(work / 60), bookendsMin: Math.round(bookend / 60)
  };
}

function buildSequence(workout, people) {
  const seq = [];
  const isDuo = people === 2;
  const pair = (ex) => isDuo ? { a: ex, b: ex } : { a: ex, b: null };

  if (workout.format === 'tabata') {
    if (workout.warmupSec > 0) {
      seq.push({ kind: 'warmup', duration: workout.warmupSec,
                 name: `Warm-up: ${fmtMin(workout.warmupSec)}`, ...pair(warmupExercise) });
    }
    const total = workout.blocks.length;
    const secs = sectionsOf(workout);
    secs.forEach((sec, secIdx) => {
      const iv = sectionInterval(sec);
      const ctx = buildCtx(workout, iv);
      // between the sections of a mix: a longer break that says what's next
      if (secIdx > 0) {
        const first = workout.blocks[sec.start];
        seq.push({ kind: 'blockrest', changeover: true, duration: workout.changeoverSec || CHANGEOVER_SEC,
                   blockIdx: sec.start - 1, totalBlocks: total, howTo: `${iv.label}: ${iv.blurb}`,
                   name: `Next: ${iv.label}${sec.minutes ? `, ${sec.minutes} min` : ''}. ${first.name}`,
                   ...pair({ name: `Next: ${iv.label}`, display: `Next: ${iv.label}`, cue: iv.blurb, alt: '', img: null }) });
      }
      workout.blocks.slice(sec.start, sec.start + sec.count).forEach((block, i) => {
        const blockIdx = sec.start + i;
        const label = `Block ${blockIdx + 1} of ${total}: ${block.name}`;
        if (iv.lap) {
          // one phase for the whole block; each person carries their lap, and
          // in For Time how many laps of it to finish
          const c = amrapCircuits(block, ctx, isDuo);
          const carry = (lap) => lap && { ...lap[0], circuit: lap, lapRounds: iv.forTime ? forTimeRounds(lap.length, iv.workSec) : 0 };
          seq.push({ kind: 'work', amrap: !!iv.amrap, forTime: !!iv.forTime, duration: iv.workSec,
                     blockIdx, totalBlocks: total, name: label, a: carry(c.a), b: carry(c.b) });
        }
        for (let round = 1; !iv.lap && round <= iv.rounds; round++) {
          const w = isDuo ? block.duo(round, ctx) : { a: block.solo(round, ctx), b: null };
          seq.push({ kind: 'work', duration: iv.workSec, blockIdx, round, emom: !!iv.reps,
                     totalBlocks: total, totalRounds: iv.rounds, name: label, a: w.a, b: w.b });
          // an EMOM's rest is whatever is left of the minute, not a phase of its own
          if (iv.restSec > 0) seq.push({ kind: 'rest', duration: iv.restSec, blockIdx, round,
                     totalBlocks: total, totalRounds: iv.rounds, name: label,
                     ...pair({ name: 'Rest', display: 'Rest', cue: 'Breathe', alt: '', img: null }) });
        }
        if (i < sec.count - 1) {
          seq.push({ kind: 'blockrest', duration: sec.blockRestSec, blockIdx, totalBlocks: total,
                     name: `Rest, then Block ${blockIdx + 2}: ${workout.blocks[blockIdx + 1].name}`,
                     ...pair({ name: 'Block rest', display: 'Block rest', cue: 'Hydrate, reset, swap equipment if needed', alt: '', img: null }) });
        }
      });
    });
    if (workout.cooldownSec > 0) {
      seq.push({ kind: 'cooldown', duration: workout.cooldownSec,
                 name: `Cool-down: ${fmtMin(workout.cooldownSec)}`, ...pair(cooldownExercise) });
    }
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
// has sound, hence the setting, and FIT gives the sound back when you
// leave the workout. Safari on a Mac has navigator.audioSession too but no
// silent switch, so it's left to touch screens (an iPad asking for the
// desktop site still has touch points); desktop and Android are untouched.
// The older trick of looping a silent <audio> element is left out: it puts
// a player on the lock screen and later Safaris broke it.
// =====================================================================
let audioCtx = null;
const CAN_SILENT = 'audioSession' in navigator && navigator.maxTouchPoints > 0;
function applyAudioSession() {
  if (!CAN_SILENT) return;
  const want = state.beepOnSilent && !state.muteAudio ? 'playback' : 'auto';
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
  if (state.muteAudio || state.view !== 'workout') return;
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
  if (state.muteAudio || state.view !== 'workout') return;
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

function chimeFor(kind) {
  if (kind === 'work') workChime();
  else if (kind === 'rest') restChime();
  else if (kind === 'blockrest' || kind === 'cooldown') bigBell();
  else if (kind === 'stretch') stretchChime();
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
  if (line) els.todayCard.prepend(line);
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
    tagline = `<div class="card-tagline today-line">${esc(`${prog.name}: today's done${ps.last.surfed ? ' (a surf counts)' : ''}. Next up: ${ps.day.name}.`)}</div>`;
  }
  const head = document.createElement('div');
  head.innerHTML = `${tagline}<div class="card-name">Build a workout</div>`;
  const floor = mixFloor();
  card.append(head, pickerLabel('How long have you got?'),
    timeChips(TIME_OPTIONS, state.minutes, m => { state.minutes = m; savePrefs(); renderToday(); }, floor));
  if (floor > TIME_OPTIONS[0]) card.append(programHint(mixFloorText(floor)));
  card.append(...peopleGearRows(true, renderToday));
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
// "Short bursts · General fitness", plus target areas or things left out
// when they're set, so a choice from last time can't catch you out.
function todayStyleText() {
  const parts = [state.mixOn ? `Mix: ${state.mixStyles.map(id => INTERVALS[id].label).join(', ')}` : currentInterval().label,
                 GOALS.find(g => g.id === state.goal).label];
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
    : ps.finished ? `${prog.name} · all ${prog.weeks} weeks done →`
    : `${prog.name} · Week ${ps.day.week} of ${prog.weeks} →`;
}
function linkButton(text, onClick) {
  const b = document.createElement('button');
  b.className = 'link-btn';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function openSetup() {
  // Back returns to the Programs screen when its Change opened setup
  state.setupFrom = state.view === 'program' ? 'program' : 'welcome';
  setMoreOptions(false);
  els.btnBuild.textContent = 'Build my workout';
  els.buildNote.textContent = '';
  renderSetup();
  setView('setup');
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
      : `${L.kb15} for swings, squats and deadlifts; ${L.kb10} for presses and single-arm work.`;
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
      renderMixPicker();
    });
    b.textContent = `${m} min`;
    b.setAttribute('aria-pressed', String(state.minutes === m));
    if (m < floor) b.setAttribute('aria-disabled', 'true');
    els.timePicker.appendChild(b);
  });
  els.timeHint.hidden = !(floor > TIME_OPTIONS[0]);
  els.timeHint.textContent = els.timeHint.hidden ? '' : mixFloorText(floor);
}

function renderIntervalPicker() {
  els.intervalPicker.innerHTML = '';
  const card = (on, name, sub, blurb, pick) => {
    const b = tappable('interval-card' + (on ? ' active' : ''), () => {
      pick(); fitMixMinutes(); savePrefs(); renderIntervalPicker(); renderTimePicker();
    });
    b.innerHTML = `
      <div class="interval-name">${esc(name)}</div>
      <div class="interval-sub">${esc(sub)}</div>
      <div class="interval-blurb">${esc(blurb)}</div>`;
    b.setAttribute('aria-pressed', String(on));
    els.intervalPicker.appendChild(b);
  };
  Object.keys(INTERVALS).forEach(id => {
    const iv = INTERVALS[id];
    card(!state.mixOn && state.intervalStyle === id, iv.label, `${iv.sub}${iv.reps ? '' : ` × ${iv.rounds} rounds`}`,
         iv.blurb, () => { state.intervalStyle = id; state.mixOn = false; });
  });
  card(state.mixOn, 'Mix', 'Two or three styles in one session',
       'Pick the styles in the order you want them. The time is shared out so the whole session fits.',
       () => { state.mixOn = true; });
  renderMixPicker();
}

// The styles in a mix, tapped in order (1, 2, 3), and how the time works out.
function renderMixPicker() {
  els.mixPicker.hidden = !state.mixOn;
  if (!state.mixOn) return;
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
// to it, so a build can't fail for want of time.
function mixFloor(s = state) {
  if (!s.mixOn || s.mixStyles.length < 2) return 0;
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
  return {
    minutes: state.minutes,
    people: state.people,
    intervalId: state.mixOn ? 'mix' : state.intervalStyle,
    mix: state.mixOn ? state.mixStyles.slice() : undefined,
    goal: state.goal === 'surf' ? 'surf' : undefined,
    regions: state.regions.slice(),
    blockedTags: state.blockedTags.slice()
  };
}

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
  return w;
}
// Builds and opens a workout. Returns an error message, or null on success.
function buildAndOpen(request, seed, extra) {
  const w = buildWorkout(request, seed, extra);
  if (w.error) return w.error;
  state.lastRequest = request;
  openWorkout(w);
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
        request: rec.request, frozen: rec.frozen || undefined, savedOn: new Date().toLocaleDateString()
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
function openWorkout(workout) {
  stopTimer();
  state.workout = workout;
  state.sequence = buildSequence(workout, state.people);
  // AMRAP rounds counted this session, and what this workout scored last time
  state.scores = {};
  state.pick = {};
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
  els.peopleBadge.textContent = state.people === 1
    ? '1 person'
    : ((state.nameA || '').trim() || (state.nameB || '').trim()
        ? `${personName('a')} & ${personName('b')}` : '2 people');
  els.exerciseGrid.classList.toggle('solo', state.people === 1);
  els.personB.style.display = state.people === 1 ? 'none' : '';
  els.labelA.textContent = state.people === 1 ? 'You' : personName('a');
  els.labelB.textContent = personName('b');

  // Shuffle and Save only mean something for a generated session.
  const gen = !!workout.generated;
  els.btnShuffle.style.display = gen ? '' : 'none';
  els.btnSave.style.display = gen ? '' : 'none';
  const alreadySaved = gen && state.saved.some(s => s.seed === workout.seed);
  els.btnSave.textContent = alreadySaved ? '★ Saved' : '☆ Save as favourite';
  els.btnSave.disabled = alreadySaved;
  els.workoutNote.textContent = '';

  if (state.sequence[0]) enterPhaseVisual(state.sequence[0].kind, state.remainingInPhase);
  renderPreview();
  setView('workout');
  render();
}

function personName(which) {
  const raw = which === 'a' ? state.nameA : state.nameB;
  return (raw || '').trim() || (which === 'a' ? 'Person A' : 'Person B');
}
// Last time's scores, each moved to whoever made it: with Dave and Wayne
// swapped round, each still sees their own, and a new name sees none. An
// unnamed person only matches the same spot. Entries from before names
// were kept go by spot. A block skipped without a score has no last time.
function lastScoresFrom(rec) {
  const score = (s, v) => (v && !(s.skipped && !s[v]) ? s[v] : undefined);
  if (!rec.names) return rec.scores.map(s => s && ({ ...s, a: score(s, 'a'), b: score(s, 'b') }));
  const now = { a: (state.nameA || '').trim(), b: state.people === 2 ? (state.nameB || '').trim() : '' };
  const spots = rec.people === 2 ? ['a', 'b'] : ['a'];
  const from = (w) => [w, ...spots].find(v => spots.includes(v) && rec.names[v] === now[w] && (now[w] || v === w));
  const fa = from('a'), fb = from('b');
  return rec.scores.map(s => s && ({ ...s, a: score(s, fa), b: score(s, fb) }));
}

function renderPreview() {
  const w = state.workout;
  if (!w) return;
  const ctx = buildCtx(w);
  els.previewList.innerHTML = '';
  const add = (name, sub) => {
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
    els.previewList.appendChild(li);
  };

  if (w.notes && w.notes.length) add('Heads up', w.notes.join(' '));

  if (w.format === 'stretch') {
    stretchList(w).forEach((s, i) => add(`${i + 1}. ${s.name}`, `${s.hold}s hold`));
    return;
  }
  add(`Warm-up: ${fmtMin(w.warmupSec)}`, warmupExercise.cue);
  sectionsOf(w).forEach((sec, si) => {
    const iv = sectionInterval(sec);
    const sctx = buildCtx(w, iv);
    if (si > 0) add(`Change over: ${fmtMin(w.changeoverSec || CHANGEOVER_SEC)}`, `Next up, ${iv.label}: ${iv.blurb}`);
    w.blocks.slice(sec.start, sec.start + sec.count).forEach((b, j) => {
      const i = sec.start + j;
      const names = Array.from(new Set((b.ids || []).map(id => withReps(describeEx(id, sctx)))));
      add(`Block ${i + 1}: ${b.name}`,
          `${iv.forTime ? `For time, ${iv.workSec / 60} min cap` : iv.amrap ? `AMRAP, ${iv.workSec / 60} min` : iv.reps ? `EMOM, ${iv.rounds} min` : `${iv.label}, ${iv.rounds} × ${iv.workSec}s`} · ${names.join('  ·  ')}`);
    });
  });
  add(`Cool-down: ${fmtMin(w.cooldownSec)}`, cooldownExercise.cue);
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
// figure and cue; above it, AMRAP counts rounds and For Time has a Done
// button that logs the time. Either score is saved with the session in
// history, so the next go can be compared against it.
function renderCircuit(w, ex, phase) {
  const W = w.toUpperCase();
  const list = els['circuit' + W], counter = els['counter' + W];
  const card = list.closest('.person');
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
  if (phase.forTime) return renderDone(w, counter, k);
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
// For Time: a Done button until it's tapped, then the time (and an undo).
function renderDone(w, counter, k) {
  const t = (state.scores[k] && state.scores[k][w]) || 0;
  const last = state.lastScores && state.lastScores[k] && state.lastScores[k][w];
  const key = `t${k}:${t}:${last ?? ''}`;
  if (counter.dataset.key === key) return;
  counter.dataset.key = key;
  const lastLine = last ? `<span>Last time ${fmt(last)}</span>` : '';
  counter.innerHTML = t
    ? `<button class="secondary count-less" data-step="undo" aria-label="Not done yet">↺</button>
       <div class="count-now"><b>${fmt(t)}</b> done, rest up${lastLine}</div>`
    : `<div class="count-now"><b>Go</b> finish the rounds${lastLine}</div>
       <button class="count-more" data-step="done">Done</button>`;
}
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
  if (!phase || !(phase.amrap || phase.forTime)) return;
  const s = state.scores[phase.blockIdx] || (state.scores[phase.blockIdx] = { a: 0, b: 0 });
  const step = b.dataset.step;
  if (step === 'done') s[w] = Math.max(1, Math.round(phaseElapsed(phase)));
  else if (step === 'undo') s[w] = 0;
  else s[w] = Math.max(0, s[w] + +step);
  delete s.skipped;                        // done after a reset, so not skipped after all
  saveScores();
  render();
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
  const label = (w) => ((w === 'a' ? state.nameA : state.nameB) || '').trim() || (w === 'a' ? 'Person A' : 'Person B');
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

function renderRoundDots(phase) {
  els.roundDots.innerHTML = '';
  if (phase.amrap || phase.forTime) {
    const label = document.createElement('div');
    label.className = 'round-count';
    label.textContent = phase.forTime ? `Finish the rounds, ${fmtMin(phase.duration)} cap`
      : `As many rounds as you can in ${fmtMin(phase.duration)}`;
    els.roundDots.appendChild(label);
  } else if (phase.totalRounds) {
    renderSegBar(phase.round, phase.totalRounds, phase.kind, phase.emom ? 'Minute' : 'Round');
    // an EMOM's rest is the rest of the minute, which nothing else says
    if (phase.emom) {
      const how = document.createElement('div');
      how.className = 'round-hint';
      how.textContent = "Do the reps, then rest till the minute's up";
      els.roundDots.appendChild(how);
    }
  } else if (phase.totalStretches) renderSegBar(phase.stretchIdx + 1, phase.totalStretches, phase.kind, 'Stretch');
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
  els.timerCard.className = 'timer-card ' + phase.kind;
  let label = phase.amrap ? 'AMRAP' : phase.emom ? 'EMOM'
    : phase.changeover ? 'Change over' : (PHASE_LABEL[phase.kind] || '');
  els.timeDisplay.textContent = fmt(Math.ceil(state.remainingInPhase));
  if (phase.forTime) {
    // the clock counts up while you race it; once everyone's done it counts
    // down the rest of the cap
    const done = allDone(phase);
    label = done ? 'Rest' : 'For time';
    if (!done) els.timeDisplay.textContent = fmt(Math.floor(phaseElapsed(phase)));
  }
  els.totalTime.textContent = `Total ${fmt(state.elapsedTotal)} / ${fmt(state.totalDuration)}`;
  // the phase and block are read out as they change (aria-live), so only
  // write them when they do, not five times a second
  setText(els.phaseLabel, label);
  setText(els.blockName, phase.name);
  setText(els.btnSkip, phase.kind === 'stretch' ? 'Skip' : 'Skip block');
  els.overallProgress.style.width =
    `${Math.min(100, (state.elapsedTotal / state.totalDuration) * 100)}%`;

  renderRoundDots(phase);

  // During a rest the person cards show what's coming, at full size, so
  // there's time to read it and get the gear ready.
  const restLike = phase.kind === 'rest' || phase.kind === 'blockrest';
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
  els.cueA.textContent = showA ? (showA.cue || '') : '';
  setAlt(els.alternativeA, showA ? showA.alt : '');
  updateAnim(els.animA, showA);
  if (state.people === 2 && dispB) {
    els.exerciseB.textContent = dispB.display || dispB.name;
    els.repsB.textContent = dispB.reps || '';
    const showB = shownFor('b', dispB);
    els.cueB.textContent = showB.cue || '';
    setAlt(els.alternativeB, showB.alt);
    updateAnim(els.animB, showB);
  } else {
    updateAnim(els.animB, null);
  }
  renderCircuit('a', dispA, phase);
  renderCircuit('b', state.people === 2 ? dispB : null, phase);

  renderUpcoming();

  els.btnStart.textContent = state.running ? 'Pause' : (state.elapsedTotal > 0 ? 'Resume' : 'Start');
  els.btnStart.classList.toggle('running', state.running);
  // once it's going, only Share is left of the pre-start strip (css)
  els.preStart.classList.toggle('underway', state.running || state.elapsedTotal > 0);
}

function renderUpcoming() {
  const next = state.sequence[state.currentIdx + 1];
  if (!next) { els.upcoming.innerHTML = ''; return; }
  const short = (which, fallback) =>
    ((which === 'a' ? state.nameA : state.nameB) || '').trim() || fallback;
  const work = (p) => state.people === 2
    ? `${short('a', 'A')}: ${withReps(p.a)} · ` +
      `${short('b', 'B')}: ${withReps(p.b)}`
    : withReps(p.a);
  // a rest says what it's resting for
  const then = state.sequence[state.currentIdx + 2];
  let preview;
  if (next.kind === 'rest') preview = then && then.kind === 'work'
    ? `Rest ${next.duration}s, then ${work(then)}` : `Rest ${next.duration}s`;
  else if (next.amrap) preview = `AMRAP: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.forTime) preview = `For time, ${next.a.lapRounds} rounds: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.kind === 'work') preview = work(next);
  else if (next.kind === 'stretch') preview = next.a.name;
  else preview = next.name;
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

// Jump to the start of a phase, keeping the wall-clock origin in step.
function seekTo(idx) {
  let acc = 0;
  for (let i = 0; i < idx && i < state.sequence.length; i++) acc += state.sequence[i].duration;
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
    state.elapsedTotal = state.totalDuration;
    finish();
    return;
  }

  state.elapsedTotal = elapsed;
  if (idx !== state.currentIdx) {
    // May have crossed several phases at once if we were backgrounded;
    // only announce the one we actually landed on.
    state.currentIdx = idx;
    state.lastBeep = null;
    const kind = state.sequence[idx].kind;
    enterPhaseVisual(kind, remaining);
    chimeFor(kind);
    // the how-to sheet covers the timer: get it out of the way to go again
    if (kind === 'work' || kind === 'stretch') closeMove();
  }
  state.remainingInPhase = remaining;

  const whole = Math.ceil(remaining);
  if (whole <= 3 && whole >= 1) {
    if (state.lastBeep !== whole) { state.lastBeep = whole; tickBeep(); }
  } else if (whole > 3) {
    state.lastBeep = null;
  }
  render();
  // kept every few seconds, so a reload picks up about where it was
  if (Date.now() - runSavedAt >= RUN_SAVE_MS) saveRun();
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
  state.tickHandle = setInterval(tickClock, 200);
  hideAway();                              // going again answers it (see askAway)
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
  render();                                // the wake lock stays on through a pause
  saveRun();
}

function clearTick() {
  if (state.tickHandle) { clearInterval(state.tickHandle); state.tickHandle = null; }
}

function stopTimer() {
  state.running = false;
  clearTick();
  releaseWakeLock();
}

// Back to the top as if just opened: rounds counted from 0 again, and not
// started, so skipping through after a reset doesn't count as done.
function resetWorkout() {
  stopTimer();
  hideAway();
  if (state.started) clearRun();
  state.scores = {};
  state.pick = {};
  state.started = false;
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
  els.timerCard.className = 'timer-card';
  setText(els.phaseLabel, 'Done');
  els.timeDisplay.textContent = '✓';
  // the last tick can land a fraction short of the end ("19:59 / 20:00")
  els.totalTime.textContent = `Total ${fmt(Math.min(state.elapsedTotal, state.totalDuration))} / ${fmt(state.totalDuration)}`;
  setText(els.blockName, 'Workout complete. Nice work.');
  els.roundDots.innerHTML = '';
  els.exerciseA.textContent = 'Well done.';
  els.repsA.textContent = els.cueA.textContent = '';
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
  els.btnStart.textContent = 'Done';
  els.btnStart.classList.remove('running');
  els.btnAgain.hidden = false;
  els.overallProgress.style.width = '100%';
  els.preStart.classList.remove('underway'); // Save and Share; the preview and Shuffle hide (css)
}
const isFinished = () => state.currentIdx >= state.sequence.length;

function skipBlock() {
  if (!state.sequence.length) return;
  const cur = state.sequence[state.currentIdx];
  if (!cur) return;
  // a scored block skipped before anyone logged a score shows as skipped
  // in history, not as 0 rounds or capped
  const s = state.scores[cur.blockIdx];
  if ((cur.amrap || cur.forTime) && !(s && (s.a || s.b))) {
    state.scores[cur.blockIdx] = { a: 0, b: 0, skipped: true };
    saveScores();
  }
  let target = state.currentIdx + 1;
  if (cur.kind !== 'stretch') {
    // Walk to the first phase that isn't part of this block.
    while (target < state.sequence.length) {
      const t = state.sequence[target];
      if (t.blockIdx !== undefined && t.blockIdx === cur.blockIdx && t.kind !== 'blockrest') target++;
      else break;
    }
  }
  if (target >= state.sequence.length) {
    state.elapsedTotal = state.totalDuration;
    state.currentIdx = state.sequence.length;
    finish();
    return;
  }
  hideAway();
  seekTo(target);
  enterPhaseVisual(state.sequence[target].kind, state.remainingInPhase);
  chimeFor(state.sequence[target].kind);
  if (state.running) beginBleed(state.remainingInPhase);
  render();
  saveRun();
}

// Remember what this session used so the next generated workout leans
// towards movements you haven't just done.
function rememberExercises() {
  const w = state.workout;
  if (!w || !w.blocks) return;
  const ids = [...new Set(w.blocks.flatMap(b => b.ids || []))];
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
    // who it was, so a score stays with the person who made it after a
    // rename, and which program day, so the card can say so
    names: { a: (state.nameA || '').trim(), b: state.people === 2 ? (state.nameB || '').trim() : '' },
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
  return { id: prog.id, n: run.n, day: day.name, where: `${prog.name} · Week ${day.week}, Day ${run.n + 1}` };
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
      openWorkout(w);
      return null;
    }
    const err = buildAndOpen(rec.request, rec.seed, { recent: (rec.request && rec.request.recent) || [] });
    if (err) return err;
    if (rec.frozen) els.workoutNote.textContent = 'Some of its moves have changed since it was saved, so it was built again.';
    const fav = state.saved.find(s => s.seed === rec.seed);
    if (fav && !(fav.frozen && thawWorkout(fav.frozen, fav.seed, fav.request))) {
      fav.frozen = freezeWorkout(state.workout);
      savePrefs();
    }
    return null;
  }
  const w = namedAsRun(rec.workoutId, rec.intervalId);
  if (!w) return 'That workout is no longer in the library.';
  openWorkout(w);
  return null;
}
// A classic or stretch routine the way it was run: a classic takes
// whichever interval was selected at the time, so carry the recorded one,
// not today's preference. Null if it's no longer in the library.
function namedAsRun(id, intervalId) {
  const w = CLASSICS.find(x => x.id === id) || STRETCH_ROUTINES.find(x => x.id === id);
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
  if (!w || !inProgress()) return;
  // with the question after time away still up, where you left (see AWAY)
  const elapsed = Math.min(awayBack !== null ? awayBack : elapsedNow(), state.totalDuration);
  const idx = locate(elapsed).idx;
  if (idx >= state.sequence.length) return;
  runSavedAt = Date.now();
  const snap = {
    v: 1, savedAt: runSavedAt, sig: runSig(w, state.sequence),
    generated: !!w.generated, seed: w.seed || null, request: w.request || null, builtWith: w.builtWith || null,
    frozen: w.generated ? freezeWorkout(w) : null,
    workoutId: w.generated ? null : w.id, intervalId: intervalFor(w).id,
    people: state.people, names: { a: state.nameA || '', b: state.nameB || '' },
    programRun: state.programRun || null,
    elapsed, idx, scores: state.scores, pick: state.pick, lastScores: state.lastScores || null
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
  const last = (x) => (count(x) ? x : undefined);
  const names = plain(s.names) ? s.names : {};
  const name = (x) => (typeof x === 'string' ? x.slice(0, 14) : '');
  const prog = plain(s.programRun) && whole(s.programRun.n) && PROGRAMS.some(p => p.id === s.programRun.id);
  return {
    savedAt: s.savedAt, sig: s.sig, elapsed: s.elapsed, idx: s.idx, people: s.people,
    generated: !!s.generated, seed: s.seed, request: s.request, builtWith: built,
    frozen: plain(s.frozen) ? s.frozen : null,
    workoutId: s.workoutId, intervalId: typeof s.intervalId === 'string' ? s.intervalId : null,
    names: { a: name(names.a), b: name(names.b) },
    programRun: prog ? { id: s.programRun.id, n: s.programRun.n } : null,
    scores, pick,
    lastScores: Array.isArray(s.lastScores) ? s.lastScores.map(x => (plain(x) ? { a: last(x.a), b: last(x.b) } : null)) : null
  };
}

// The saved session built again: a built one from the exercises it was
// built with (or, saved before it kept them, from its seed with the gear
// and leave-outs it was first built with), a named one by its id at the
// style it ran in. Null if it no longer comes out the same.
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
    const seq = buildSequence(w, s.people);
    return runSig(w, seq) === s.sig && s.idx < seq.length ? { w, seq } : null;
  } catch (e) { return null; }
}

// "block 2", "the warm-up", "stretch 3": where in a session a phase is.
function phaseWhere(p) {
  if (p.kind === 'warmup') return 'the warm-up';
  if (p.kind === 'cooldown') return 'the cool-down';
  if (p.kind === 'stretch') return `stretch ${p.stretchIdx + 1}`;
  if (p.kind === 'blockrest') return `the rest before block ${p.blockIdx + 2}`;
  return `block ${p.blockIdx + 1}`;
}

// At the top of the Today card while there's a session to pick up:
// "Resume Paddle power, block 2, 8:20 in", with Resume and Discard.
function resumeLine() {
  const s = readRun();
  const built = s && rebuildRun(s);
  if (!built) { if (s) clearRun(); return null; }
  const day = programRunLabel(s.programRun);
  const box = document.createElement('div');
  box.className = 'today-resume';
  const text = document.createElement('div');
  text.className = 'resume-text';
  text.textContent = `Resume ${day ? day.day : built.w.name}, ${phaseWhere(built.seq[s.idx])}, ${fmt(s.elapsed)} in`;
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
  state.nameA = els.nameA.value = s.names.a;
  state.nameB = els.nameB.value = s.names.b;
  renderPeoplePicker();
  savePrefs();
  state.programRun = s.programRun;
  if (s.generated) state.lastRequest = s.request;
  openWorkout(built.w);
  state.scores = s.scores;
  state.pick = s.pick;
  state.lastScores = s.lastScores;
  state.started = true;
  seekTo(s.idx);
  enterPhaseVisual(state.sequence[s.idx].kind, state.remainingInPhase);
  render();
  els.workoutNote.textContent = `Picked up from the start of ${phaseWhere(state.sequence[s.idx])}. Tap ${els.btnStart.textContent} when you're ready.`;
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
function sharePayload(w) {
  if (w.generated) {
    const built = w.builtWith || { equipment: effectiveEquip(), excluded: state.excluded };
    return { v: SHARE_VERSION, seed: w.seed, request: { ...w.request, people: state.people },
             equipment: { ...built.equipment }, excluded: built.excluded.slice() };
  }
  return { v: SHARE_VERSION, id: w.id, intervalId: intervalFor(w).id, people: state.people };
}

// What goes with the link, so it says what it is before anyone opens it:
// "FIT: Lower body · 20 min · Short bursts · 2 people". A built workout's
// name already ends in its minutes.
function shareText(w) {
  const style = styleLabel({ intervalId: styleIdOf(w), request: w.request });
  return [`FIT: ${w.name}`, ...(w.generated ? [] : [`${durationParts(w).totalMin} min`]), style,
          state.people === 1 ? '1 person' : '2 people'].join(' · ');
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
function openSharedLink(hash) {
  let payload;
  try { payload = JSON.parse(decodeShare(hash.slice(3))); }
  catch (e) { return 'That link is not a FIT workout.'; }
  if (!payload || typeof payload !== 'object') return 'That link is not a FIT workout.';
  if (payload.v !== SHARE_VERSION) return 'That link was made by a different version of FIT.';
  if (!payload.id && (!payload.seed || !payload.request)) return 'That link is missing its workout.';
  // it opens for as many people as it was sent for (a classic's link from
  // before it said keeps today's count)
  const people = payload.id ? payload.people : payload.request.people;
  if (people === 1 || people === 2) { state.people = people; savePrefs(); }
  if (payload.id) {
    return openFromRecord({ workoutId: payload.id, intervalId: payload.intervalId, generated: false });
  }
  return buildAndOpen(payload.request, payload.seed, {
    equipment: payload.equipment || effectiveEquip(),
    excluded: Array.isArray(payload.excluded) ? payload.excluded : [],
    recent: Array.isArray(payload.request.recent) ? payload.request.recent : []
  });
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
    els.workoutNote.textContent = 'Opened from a shared link.';
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
// sessions, 3 favourites, 2 places (Home, Mate's place) and Surf Fit week 3".
function dataSummary(p) {
  const count = (n, one) => `${n || 'no'} ${one}${n === 1 ? '' : 's'}`;
  const parts = [count(p.history.length, 'session')];
  if (p.saved.length) parts.push(count(p.saved.length, 'favourite'));
  if (p.gearSets.length) parts.push(`${count(p.gearSets.length, 'place')} (${p.gearSets.map(g => g.name).join(', ')})`);
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
    p2.textContent = `It replaces everything here now: ${dataSummary(currentPrefs())}.`;
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
  // the page again, with what's here now and what was done
  const done = (text) => {
    restoreOpen = false;
    dataSaid = text;
    state.filterFocus = 'all';
    renderFocusFilter();
    renderLibrary();
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
// waits, and "I surfed today" counts a surf in its place.
// =====================================================================
const dayKey = (t) => new Date(t).toLocaleDateString('en-CA');
function openProgram() {
  stopTimer();
  state.programRun = null;
  state.programMinutes = null;
  state.programAhead = false;      // "do the next one now anyway", for this visit
  els.programNote.textContent = '';
  renderProgram();
  setView('program');
}
// Days in a row with something done, up to today (or yesterday, if today
// isn't done yet).
function programStreak(st) {
  const days = new Set(st.done.map(d => dayKey(d.at)));
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
      <div class="card-blurb">Rep targets start a little lighter and build over the ${prog.weeks} weeks. Pick how long you've got each day.</div>`);
    const go = document.createElement('button');
    go.textContent = `Start ${prog.name}`;
    go.addEventListener('click', () => {
      state.programs[prog.id] = { startedAt: Date.now(), done: [] };
      savePrefs();
      keepStorage();
      renderProgram();
    });
    c.appendChild(go);
    return;
  }

  if (ps.finished) {
    const c = add(`<div class="card-name">${prog.weeks} weeks done</div>
      <div class="card-blurb">That's the whole of ${esc(prog.name)}. Go again from the start, or keep choosing Surf fitness in Build a workout.</div>`);
    c.appendChild(restartButton(prog));
    return;
  }
  const { st, n, day, last, doneToday } = ps;
  const streak = programStreak(st);
  add(`<div class="program-progress">
      <div><b>Week ${day.week}</b> of ${prog.weeks}</div>
      <div><b>Day ${n + 1}</b> of ${total}</div>
      <div><b>${streak}</b> day${streak === 1 ? '' : 's'} in a row</div>
    </div>
    <div class="program-week">${prog.days.map((d, i) => {
      const at = (day.week - 1) * prog.days.length + i;
      const rec = st.done.find(x => x.n === at);
      const cls = rec ? 'done' : at === n ? 'now' : '';
      return `<div class="program-dot ${cls}" title="Day ${at + 1}: ${esc(d.name)}" aria-label="Day ${at + 1}, ${esc(d.name)}${rec ? (rec.surfed ? ', surfed' : ', done') : ''}">
        <b>${at + 1}</b><span>${esc(d.short || d.name)}</span><i>${rec ? (rec.surfed ? 'Surf' : '✓') : at === n ? (doneToday ? 'Next' : 'Today') : ''}</i></div>`;
    }).join('')}</div>`, 'program-status');

  if (doneToday && !state.programAhead) {
    const c = add(`<div class="card-name">Today's done</div>
      <div class="card-blurb">${last.surfed ? 'A surf counts. ' : ''}Next up: <b>${esc(day.name)}</b>. ${esc(day.about)}</div>`);
    const again = document.createElement('button');
    again.className = 'secondary';
    again.textContent = 'Do the next one now anyway';
    again.addEventListener('click', () => { state.programAhead = true; renderProgram(); });
    c.appendChild(again);
  } else {
    renderProgramToday(prog, st, day);
  }
  const foot = add(`<div class="picker-label">Each week</div>${rhythm}`, 'program-foot');
  foot.appendChild(restartButton(prog));
}
function restartButton(prog) {
  const b = document.createElement('button');
  b.className = 'card-remove';
  b.textContent = 'Start the program again';
  b.addEventListener('click', () => {
    if (b.dataset.sure) {
      state.programs[prog.id] = { startedAt: Date.now(), done: [] };
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
  c.innerHTML = `<div class="card-tagline">${esc(tagline)}</div>
    <div class="card-name">${esc(day.name)}</div>
    <div class="card-blurb">${esc(day.about)}</div>`;
  // the notes go under Start, so Start stays on the first screen of a phone
  const notes = [];
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
  c.append(...peopleGearRows(!day.stretch, rerender, gearHint));
  const go = document.createElement('button');
  go.className = 'program-go';
  go.textContent = "Start today's session";
  go.addEventListener('click', () => {
    const err = startProgramDay(prog, day);
    if (err) note.textContent = err;
  });
  c.append(go, ...notes);
  const surfed = document.createElement('button');
  surfed.className = 'secondary';
  surfed.textContent = 'I surfed today';
  surfed.addEventListener('click', () => {
    st.done.push({ n: day.n, at: Date.now(), surfed: true });
    savePrefs();
    rerender();
    note.textContent = 'Logged. If you\'ve got ten minutes, Surf Mobility in Saved & ready-made is good after a session. ';
    // a mis-tap can be taken back: only today's surf, and only the last one
    note.appendChild(linkButton('Undo', () => {
      const now = state.programs[prog.id];
      const last = now && now.done[now.done.length - 1];
      if (last && last.surfed && dayKey(last.at) === dayKey(Date.now())) { now.done.pop(); savePrefs(); }
      note.textContent = '';
      rerender();
    }));
  });
  c.append(surfed);
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
  const minutes = state.programMinutes || day.minutes;
  // a mix too long for the minutes runs as its first style (see programStyle)
  const { intervalId, mix } = programStyle(day, minutes);
  const request = {
    minutes,
    people: state.people,
    intervalId, mix,
    goal: prog.goal, surfFocus: day.focus, repScale: day.repScale,
    // the leave-outs from Build a workout, the same as any other session
    regions: REGIONS.map(r => r.id), blockedTags: state.blockedTags.slice()
  };
  const err = buildAndOpen(request);
  if (err) state.programRun = null;
  return err;
}
// Called when a session finishes: tick off the program day it was.
function completeProgramDay() {
  const run = state.programRun;
  if (!run) return;
  const st = state.programs[run.id];
  if (st && !st.done.some(d => d.n === run.n)) {
    st.done.push({ n: run.n, at: Date.now() });
    savePrefs();
  }
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

els.btnShuffle.addEventListener('click', () => {
  const request = state.lastRequest || requestFromState();
  const err = buildAndOpen(request, newSeed());
  if (err) els.workoutNote.textContent = err;
});

els.btnSave.addEventListener('click', () => {
  const w = state.workout;
  if (!w || !w.generated) return;
  if (state.saved.some(s => s.seed === w.seed)) return;
  // the exercises it was built with, so an update can't change it (see
  // FROZEN WORKOUTS in js/workouts.js)
  state.saved.unshift({
    name: w.name, blurb: w.blurb, focus: w.focus, seed: w.seed,
    request: w.request, frozen: freezeWorkout(w),
    savedOn: new Date().toLocaleDateString()
  });
  savePrefs();
  keepStorage();
  els.btnSave.textContent = '★ Saved';
  els.btnSave.disabled = true;
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
els.muteAudio.addEventListener('change', (e) => {
  state.muteAudio = e.target.checked;
  if (audioCtx) applyAudioSession();      // muted, FIT has no reason to pause your music
  savePrefs();
});
// Takes effect from the next sound, never before FIT has made one, so just
// opening the app leaves someone's music alone.
els.beepOnSilent.addEventListener('change', (e) => {
  state.beepOnSilent = e.target.checked;
  if (audioCtx) applyAudioSession();
  savePrefs();
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
  els.scroller.scrollTop = 0;
  render();
}
function hideAway() {
  awayBack = null;
  els.awayBar.hidden = true;
}
els.btnAwayBack.addEventListener('click', () => {
  const back = awayBack;
  hideAway();
  if (back === null || isFinished()) return;
  placeAt(back);
  render();
  saveRun();
  els.workoutNote.textContent = `Back to ${fmt(back)}. Tap ${els.btnStart.textContent} when you're ready.`;
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
  els.muteAudio.checked = state.muteAudio;
  els.beepOnSilent.checked = state.beepOnSilent;
  els.showPhotos.checked = state.showPhotos !== false;
  document.body.classList.toggle('show-alternatives', state.showAlts);
  document.body.classList.toggle('hide-photos', state.showPhotos === false);
  applyTextScale();
  renderPeoplePicker();
}
loadPrefs();
showSettings();
// only an iPhone or iPad can play through the silent switch, so only they ask
els.silentToggle.hidden = els.silentHint.hidden = !CAN_SILENT;
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
