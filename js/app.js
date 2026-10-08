/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  APP SHELL: views, setup flows, rendering and the timer.
*/

const TIME_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60];
const RECENT_CAP = 60;          // exercise ids remembered for variety
const HISTORY_CAP = 40;         // sessions kept in the history list
// Re-opening the same workout inside this window updates its history entry
// instead of adding another, so a reset or a second go is still one session.
const HISTORY_MERGE_MS = 3 * 60 * 60 * 1000;
const PREFS_KEY = 'fit-prefs-2';

// =====================================================================
// STATE
// =====================================================================
const state = {
  view: 'welcome',
  mode: 'quick',                // which setup flow is on screen

  // Preferences (persisted, see PERSISTED below)
  people: 2,
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
  showAlts: false,
  showPhotos: true,
  textScale: 1,
  recent: [],
  saved: [],
  history: [],
  filterFocus: 'all',

  // Per-workout runtime
  workout: null,
  lastRequest: null,
  sequence: [],
  totalDuration: 0,
  currentIdx: 0,
  remainingInPhase: 0,
  elapsedTotal: 0,
  running: false,
  elapsedAtResume: 0,
  runStartWall: 0,
  lastBeep: null,
  tickHandle: null,
  wakeLock: null,
  excludeSearch: ''
};

const PERSISTED = ['people', 'nameA', 'nameB', 'equipment', 'weights', 'minutes', 'intervalStyle', 'mixOn', 'mixStyles', 'goal', 'programs', 'gearSets', 'gearSetId',
  'regions', 'blockedTags', 'excluded', 'muteAudio', 'showAlts', 'showPhotos',
  'textScale', 'recent', 'saved', 'history', 'filterFocus'];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    // Only take keys we know about, a stale or hand-edited store must not
    // be able to drop arbitrary values into runtime state.
    PERSISTED.forEach(k => { if (p[k] !== undefined) state[k] = p[k]; });
    state.equipment = { ...DEFAULT_EQUIPMENT, kettlebells: true, ...(p.equipment || {}) };
    state.weights = cleanWeights(p.weights, p.equipment || {});
    state.gearSets = (Array.isArray(p.gearSets) ? p.gearSets : []).filter(g =>
      g && typeof g.id === 'string' && typeof g.name === 'string' && g.equipment && typeof g.equipment === 'object')
      .map(g => ({ id: g.id, name: g.name.slice(0, 24), equipment: { ...g.equipment },
                   weights: cleanWeights(g.weights, g.equipment) }));
    if (!INTERVALS[state.intervalStyle]) state.intervalStyle = DEFAULT_INTERVAL;
    state.mixOn = state.mixOn === true;
    if (!GOALS.some(g => g.id === state.goal)) state.goal = 'general';
    if (!state.programs || typeof state.programs !== 'object' || Array.isArray(state.programs)) state.programs = {};
    Object.keys(state.programs).forEach(id => {
      const p = state.programs[id];
      if (!PROGRAMS.some(x => x.id === id) || !p || !Array.isArray(p.done)) delete state.programs[id];
    });
    if (!Array.isArray(state.mixStyles)) state.mixStyles = ['emom', 'short', 'amrap'];
    state.mixStyles = [...new Set(state.mixStyles.filter(id => INTERVALS[id]))].slice(0, 3);
    if (state.mixStyles.length < 2) state.mixStyles = ['emom', 'short', 'amrap'];
    if (!Array.isArray(state.regions) || !state.regions.length) state.regions = REGIONS.map(r => r.id);
    if (!Array.isArray(state.excluded)) state.excluded = [];
    if (!Array.isArray(state.recent)) state.recent = [];
    if (!Array.isArray(state.saved)) state.saved = [];
    if (!Array.isArray(state.history)) state.history = [];
    if (!Array.isArray(state.blockedTags)) state.blockedTags = [];
    if (state.people !== 1 && state.people !== 2) state.people = 2;
    if (!TIME_OPTIONS.includes(state.minutes)) state.minutes = 20;
    if (typeof state.textScale !== 'number' || !(state.textScale > 0)) state.textScale = 1;
    if (typeof state.nameA !== 'string') state.nameA = '';
    if (typeof state.nameB !== 'string') state.nameB = '';
  } catch (e) { /* corrupt store: fall back to defaults */ }
}
function savePrefs() {
  try {
    const out = {};
    PERSISTED.forEach(k => { out[k] = state[k]; });
    localStorage.setItem(PREFS_KEY, JSON.stringify(out));
  } catch (e) { /* private mode / quota: preferences just won't stick */ }
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
// kettlebell switches turned into a list.
function cleanWeights(w, oldEquip) {
  const pick = (list, ok) => Array.isArray(list) ? [...new Set(list.filter(x => ok.includes(x)))].sort((a, b) => a - b) : null;
  if (w && typeof w === 'object') {
    return { kb: pick(w.kb, WEIGHT_CHOICES.kb.kg) || [10, 15],
             db: pick(w.db, WEIGHT_CHOICES.db.kg) || [],
             bar: WEIGHT_CHOICES.bar.kg.includes(w.bar) ? w.bar : 10 };
  }
  const kb = [10, 15].filter(kg => oldEquip[kg === 15 ? 'kb15' : 'kb10'] !== false);
  if (!kb.length) state.equipment.kettlebells = false;
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
// A workout's style for history and comparisons: 'mix' or the interval's id.
const styleIdOf = (w) => (w.sections ? 'mix' : intervalFor(w).id);
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
  pathQuick: $('pathQuick'), pathCustom: $('pathCustom'),
  pathStretch: $('pathStretch'), pathClassics: $('pathClassics'),
  scroller: $('scroller'),
  welcomeFoot: $('welcomeFoot'), welcomeNote: $('welcomeNote'),
  btnFullscreen: $('btnFullscreen'), installHint: $('installHint'),

  btnSetupBack: $('btnSetupBack'), setupTitle: $('setupTitle'),
  peoplePicker: $('peoplePicker'), nameInputs: $('nameInputs'),
  nameA: $('nameA'), nameB: $('nameB'),
  equipmentPicker: $('equipmentPicker'), weightPicker: $('weightPicker'), timePicker: $('timePicker'),
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
  btnStart: $('btnStart'), btnSkip: $('btnSkip'), btnReset: $('btnReset'),
  workoutNote: $('workoutNote'),
  showPhotos: $('showPhotos'), showAlts: $('showAlts'), muteAudio: $('muteAudio')
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
// =====================================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, duration, volume = 0.4) {
  if (state.muteAudio) return;
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
  if (state.muteAudio) return;
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
// =====================================================================
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (e) { /* denied or unsupported, the timer is still correct */ }
}
function releaseWakeLock() {
  if (!state.wakeLock) return;
  const lock = state.wakeLock;
  state.wakeLock = null;
  try { lock.release(); } catch (e) { /* already gone */ }
}

// =====================================================================
// VIEWS
// =====================================================================
function setView(v) {
  state.view = v;
  ['welcome', 'setup', 'library', 'program', 'workout'].forEach(name => {
    els[name + 'View'].classList.toggle('active', v === name);
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
  state.workout = null;
  els.welcomeNote.textContent = '';
  setView('welcome');
  renderWelcomeFoot();
}

function renderWelcomeFoot() {
  const iv = currentInterval();
  const gear = GEAR.filter(g => state.equipment[g.id] !== false).length;
  const style = state.mixOn ? `mix (${state.mixStyles.map(id => INTERVALS[id].label).join(', ')})`
    : `${iv.label.toLowerCase()} (${iv.sub})`;
  els.welcomeFoot.textContent =
    `${Object.keys(EXERCISES).length} movements · ${style} · ` +
    `${gear}/${GEAR.length} kit items on · ` +
    `${state.people === 1 ? 'solo' : 'two people'}`;
}

function openSetup(mode) {
  state.mode = mode;
  els.setupTitle.textContent = mode === 'custom' ? 'Customise your workout' : 'Quick start';
  els.setupView.querySelectorAll('.custom-only').forEach(el => {
    el.style.display = mode === 'custom' ? '' : 'none';
  });
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
  if (state.mode === 'custom') els.rowRegions.style.display = state.goal === 'surf' ? 'none' : '';
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
// (or, for the bar, what it's loaded to).
function weightRow(kind) {
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
      renderEquipmentPicker();
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
  TIME_OPTIONS.forEach(m => {
    const b = tappable('chip' + (state.minutes === m ? ' active' : ''), () => {
      state.minutes = m;
      savePrefs();
      renderTimePicker();
      renderMixPicker();
    });
    b.textContent = `${m} min`;
    b.setAttribute('aria-pressed', String(state.minutes === m));
    els.timePicker.appendChild(b);
  });
}

function renderIntervalPicker() {
  els.intervalPicker.innerHTML = '';
  const card = (on, name, sub, blurb, pick) => {
    const b = tappable('interval-card' + (on ? ' active' : ''), () => { pick(); savePrefs(); renderIntervalPicker(); });
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
      savePrefs();
      renderMixPicker();
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
  const custom = state.mode === 'custom';
  return {
    minutes: state.minutes,
    people: state.people,
    intervalId: state.mixOn ? 'mix' : state.intervalStyle,
    mix: state.mixOn ? state.mixStyles.slice() : undefined,
    goal: state.goal === 'surf' ? 'surf' : undefined,
    regions: custom ? state.regions.slice() : REGIONS.map(r => r.id),
    blockedTags: custom ? state.blockedTags.slice() : []
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

// Builds and opens a workout. Returns an error message, or null on success.
function buildAndOpen(request, seed, extra) {
  const w = generateWorkout(liveOpts(request, { seed: seed || newSeed(), ...extra }));
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

function openStretchLibrary() {
  state.filterFocus = 'stretching';
  openLibrary();
  els.libraryTitle.textContent = 'Stretch & mobility';
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
  els.libraryTitle.textContent = 'Workouts';
  els.libraryNote.textContent = '';
  els.librarySections.innerHTML = '';

  const sections = [];

  // Recent first, so a generated session you liked but didn't save is
  // still findable afterwards.
  const history = state.history.filter(h => inFocus(h.focus));
  if (history.length) {
    const clear = document.createElement('button');
    clear.className = 'mini-btn section-action';
    clear.textContent = 'Clear history';
    clear.addEventListener('click', () => {
      state.history = [];
      savePrefs();
      renderLibrary();
    });
    sections.push(librarySection(
      'Recent', 'Kept on this device only', history.map(historyCard), clear));
  }

  sections.push(librarySection('Saved', null,
    state.saved.filter(s => inFocus(s.focus || 'whole-body')).map(savedCard)));
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
    return;
  }
  live.forEach(sec => els.librarySections.appendChild(sec));
}

function namedCard(w) {
  const parts = durationParts(w);
  const card = tappable('workout-card ' + focusClassMap[w.focus], () => openWorkout(w));
  const detail = parts.workMin !== null
    ? `<div class="card-time-detail">${parts.workMin} min work + ${parts.bookendsMin} min warm-up/cool-down</div>` : '';
  const adapted = workoutAdapted(w)
    ? '<div class="card-adapted">Adapted for your equipment</div>' : '';
  card.innerHTML = `
    <div class="card-name">${esc(w.name)}</div>
    <div class="card-tagline">${esc(w.tagline)}</div>
    <div class="card-meta">
      <span class="duration">${parts.totalMin} min</span>
      <span>·</span>
      <span class="focus-tag ${focusClassMap[w.focus]}">${focusLabelMap[w.focus]}</span>
    </div>
    ${detail}
    <div class="card-blurb">${esc(w.blurb)}</div>
    ${adapted}`;
  return card;
}

// How a history entry's style reads: "Every minute on the minute", or for
// a mix "Mix: EMOM, Short bursts, AMRAP".
function styleLabel(rec) {
  if (rec.intervalId === 'mix') {
    const list = (rec.request && rec.request.mix) || [];
    return `Mix: ${list.map(id => (INTERVALS[id] || {}).label).filter(Boolean).join(', ')}`;
  }
  return (INTERVALS[rec.intervalId] || {}).sub || '';
}

// An AMRAP session's rounds, block by block ("Rounds: 4 · 5 · 4"), or a
// For Time one's finishing times ("Times: 3:12 · 2:58 · capped").
function scoreLine(rec) {
  if (!rec.scores || !rec.scores.some(s => s.a || s.b)) return '';
  // each block knows its kind of score; older entries go by the style
  const kind = (s) => s.t || (rec.intervalId === 'fortime' ? 'fortime' : 'amrap');
  const scored = rec.scores.filter(s => s.t !== null);
  const mixed = new Set(scored.map(kind)).size > 1;
  const one = (s, w) => {
    const v = s[w];
    const val = kind(s) === 'fortime' ? (v ? fmt(v) : 'capped') : (v || 0);
    return mixed ? `${kind(s) === 'fortime' ? 'time' : 'rounds'} ${val}` : val;
  };
  const row = (w) => scored.map(s => one(s, w)).join(' · ');
  const what = mixed ? 'Scores' : kind(scored[0]) === 'fortime' ? 'Times' : 'Rounds';
  const text = rec.people === 2
    ? `${what}: ${personName('a')} ${row('a')}, ${personName('b')} ${row('b')}`
    : `${what}: ${row('a')}`;
  return `<div class="card-score">${esc(text)}</div>`;
}

function historyCard(rec) {
  const wrap = document.createElement('div');
  wrap.className = 'workout-card history-card ' + (focusClassMap[rec.focus] || 'whole');
  const alreadySaved = rec.generated && state.saved.some(s => s.seed === rec.seed);
  wrap.innerHTML = `
    <div class="card-name">${esc(rec.name)}</div>
    <div class="card-tagline">${esc(whenLabel(rec.at))}</div>
    <div class="card-meta">
      <span class="duration">${rec.minutes} min</span>
      <span>·</span>
      <span>${rec.people === 1 ? 'solo' : '2 people'}</span>
      <span>·</span>
      <span>${esc(styleLabel(rec))}</span>
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
        request: rec.request, savedOn: new Date().toLocaleDateString()
      });
      savePrefs();
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
  state.lastScores = before ? before.scores : null;
  state.totalDuration = state.sequence.reduce((s, p) => s + p.duration, 0);
  seekTo(0);
  state.running = false;

  els.workoutTitle.textContent = workout.name;
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
        <span class="lap-reps">${esc(x.reps)}</span><span class="lap-name">${esc(x.display || x.name)}</span>
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
  saveScores();
  render();
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
  } else if (phase.totalRounds) renderSegBar(phase.round, phase.totalRounds, phase.kind, phase.emom ? 'Minute' : 'Round');
  else if (phase.totalStretches) renderSegBar(phase.stretchIdx + 1, phase.totalStretches, phase.kind);
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
function render() {
  const phase = state.sequence[state.currentIdx];
  if (!phase) return;

  els.timerCard.className = 'timer-card ' + phase.kind;
  els.phaseLabel.textContent = phase.amrap ? 'AMRAP' : phase.emom ? 'EMOM'
    : phase.changeover ? 'Change over' : (PHASE_LABEL[phase.kind] || '');
  els.timeDisplay.textContent = fmt(Math.ceil(state.remainingInPhase));
  if (phase.forTime) {
    // the clock counts up while you race it; once everyone's done it counts
    // down the rest of the cap
    const done = allDone(phase);
    els.phaseLabel.textContent = done ? 'Rest' : 'For time';
    if (!done) els.timeDisplay.textContent = fmt(Math.floor(phaseElapsed(phase)));
  }
  els.totalTime.textContent = `Total ${fmt(state.elapsedTotal)} / ${fmt(state.totalDuration)}`;
  els.blockName.textContent = phase.name;
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
  els.preStart.style.display = (!state.running && state.elapsedTotal === 0) ? '' : 'none';
}

function renderUpcoming() {
  const next = state.sequence[state.currentIdx + 1];
  if (!next) { els.upcoming.innerHTML = ''; return; }
  const short = (which, fallback) =>
    ((which === 'a' ? state.nameA : state.nameB) || '').trim() || fallback;
  let preview;
  if (next.kind === 'rest') preview = `Rest ${next.duration}s`;
  else if (next.amrap) preview = `AMRAP: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.forTime) preview = `For time, ${next.a.lapRounds} rounds: ${next.a.circuit.map(x => x.name).join(', ')}`;
  else if (next.kind === 'work') {
    preview = state.people === 2
      ? `${short('a', 'A')}: ${withReps(next.a)} · ` +
        `${short('b', 'B')}: ${withReps(next.b)}`
      : withReps(next.a);
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
    enterPhaseVisual(state.sequence[idx].kind, remaining);
    chimeFor(state.sequence[idx].kind);
  }
  state.remainingInPhase = remaining;

  const whole = Math.ceil(remaining);
  if (whole <= 3 && whole >= 1) {
    if (state.lastBeep !== whole) { state.lastBeep = whole; tickBeep(); }
  } else if (whole > 3) {
    state.lastBeep = null;
  }
  render();
}

function startTimer() {
  if (state.running) return;
  if (state.currentIdx >= state.sequence.length) seekTo(0);
  ensureAudio();
  requestWakeLock();
  state.running = true;
  state.elapsedAtResume = state.elapsedTotal;
  state.runStartWall = Date.now();
  state.lastBeep = null;
  workChime();
  state.tickHandle = setInterval(tickClock, 200);
  beginBleed(state.remainingInPhase);
  render();
  rememberExercises();
  recordHistory();
}

function pauseTimer() {
  if (!state.running) return;
  state.elapsedTotal = elapsedNow();
  freezeBleed();
  state.running = false;
  clearTick();
  releaseWakeLock();
  render();
}

function clearTick() {
  if (state.tickHandle) { clearInterval(state.tickHandle); state.tickHandle = null; }
}

function stopTimer() {
  state.running = false;
  clearTick();
  releaseWakeLock();
}

function resetWorkout() {
  stopTimer();
  seekTo(0);
  if (state.sequence[0]) enterPhaseVisual(state.sequence[0].kind, state.remainingInPhase);
  render();
}

function finish() {
  stopTimer();
  markHistoryComplete();
  completeProgramDay();
  bigBell();
  clearBleed();
  els.workoutView.classList.remove('resting');
  els.timerCard.className = 'timer-card';
  els.phaseLabel.textContent = 'Done';
  els.timeDisplay.textContent = '✓';
  els.blockName.textContent = 'Workout complete. Nice work.';
  els.roundDots.innerHTML = '';
  els.exerciseA.textContent = 'Well done.';
  els.cueA.textContent = '';
  setAlt(els.alternativeA, '');
  updateAnim(els.animA, null);
  updateAnim(els.animB, null);
  if (state.people === 2) {
    els.exerciseB.textContent = 'Well done.';
    els.cueB.textContent = '';
    setAlt(els.alternativeB, '');
  }
  els.upcoming.innerHTML = '';
  els.btnStart.textContent = 'Start over';
  els.btnStart.classList.remove('running');
  els.overallProgress.style.width = '100%';
  els.preStart.style.display = 'none';
}

function skipBlock() {
  if (!state.sequence.length) return;
  const cur = state.sequence[state.currentIdx];
  if (!cur) return;
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
  seekTo(target);
  enterPhaseVisual(state.sequence[target].kind, state.remainingInPhase);
  chimeFor(state.sequence[target].kind);
  if (state.running) beginBleed(state.remainingInPhase);
  render();
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
    // Enough to rebuild it exactly: a seed and a request for generated
    // workouts, an id for the named ones.
    seed: w.seed || null,
    request: w.request || null,
    workoutId: w.generated ? null : w.id,
    at: now,
    completed: false
  });
  state.history = state.history.slice(0, HISTORY_CAP);
  savePrefs();
}

function markHistoryComplete() {
  const w = state.workout;
  if (!w) return;
  const entry = state.history.find(h => h.key === historyKey(w));
  if (entry && !entry.completed) { entry.completed = true; savePrefs(); }
}

// Rebuild a workout from a history entry (or a saved favourite: same shape).
function openFromRecord(rec) {
  if (rec.generated) {
    return buildAndOpen(rec.request, rec.seed, { recent: (rec.request && rec.request.recent) || [] });
  }
  const w = CLASSICS.find(x => x.id === rec.workoutId) ||
            STRETCH_ROUTINES.find(x => x.id === rec.workoutId);
  if (!w) return 'That workout is no longer in the library.';
  // Reopen it the way it was run: a classic takes whichever interval was
  // selected at the time, so carry the recorded one, not today's preference.
  const asRun = w.format === 'tabata' && rec.intervalId && INTERVALS[rec.intervalId]
    ? { ...w, intervalId: rec.intervalId } : w;
  openWorkout(asRun);
  return null;
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

function sharePayload(w) {
  if (w.generated) {
    return { v: SHARE_VERSION, seed: w.seed, request: w.request,
             equipment: effectiveEquip(), excluded: state.excluded.slice() };
  }
  return { v: SHARE_VERSION, id: w.id, intervalId: intervalFor(w).id };
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
  if (payload.id) {
    return openFromRecord({ workoutId: payload.id, intervalId: payload.intervalId, generated: false });
  }
  if (!payload.seed || !payload.request) return 'That link is missing its workout.';
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
    els.welcomeNote.textContent = err;
  } else {
    els.workoutNote.textContent = 'Opened from a shared link.';
  }
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
function renderProgram() {
  const prog = PROGRAMS[0];
  const st = state.programs[prog.id];
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

  if (!st) {
    const c = add(`<div class="card-name">${esc(prog.name)}</div>
      <div class="card-tagline">${esc(prog.tagline)}</div>
      <div class="card-blurb">${esc(prog.blurb)}</div>
      <div class="picker-label">Each week</div>${rhythm}
      <div class="card-blurb">Reps start a little lighter and build every fortnight. Pick how long you've got each day.</div>`);
    const go = document.createElement('button');
    go.textContent = `Start ${prog.name}`;
    go.addEventListener('click', () => {
      state.programs[prog.id] = { startedAt: Date.now(), done: [] };
      savePrefs();
      renderProgram();
    });
    c.appendChild(go);
    return;
  }

  const n = st.done.length;
  if (n >= total) {
    const c = add(`<div class="card-name">${prog.weeks} weeks done</div>
      <div class="card-blurb">That's the whole of ${esc(prog.name)}. Go again from the start, or keep using Surf fitness in Quick and Custom.</div>`);
    c.appendChild(restartButton(prog));
    return;
  }
  const day = programDay(prog, n);
  const last = st.done[st.done.length - 1];
  const doneToday = last && dayKey(last.at) === dayKey(Date.now());
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
        <b>${at + 1}</b><span>${esc(d.short || d.name)}</span><i>${rec ? (rec.surfed ? 'Surf' : '✓') : at === n ? 'Today' : ''}</i></div>`;
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
// Today's session: what it's for, how long you've got, and go.
function renderProgramToday(prog, st, day) {
  const c = document.createElement('div');
  c.className = 'workout-card program-card program-today';
  c.innerHTML = `<div class="card-tagline">Today · week ${day.week}</div>
    <div class="card-name">${esc(day.name)}</div>
    <div class="card-blurb">${esc(day.about)}</div>`;
  if (!day.stretch) {
    const min = day.mix ? (mixMinimumMinutes(day.mix) || 25) : 10;
    const options = TIME_OPTIONS.filter(m => m >= min);
    if (!options.includes(state.programMinutes)) state.programMinutes = options.includes(day.minutes) ? day.minutes : options[0];
    const row = document.createElement('div');
    row.className = 'chip-row';
    options.forEach(m => {
      const chip = tappable('chip' + (m === state.programMinutes ? ' active' : ''), () => { state.programMinutes = m; renderProgram(); });
      chip.textContent = `${m} min`;
      chip.setAttribute('aria-pressed', String(m === state.programMinutes));
      row.appendChild(chip);
    });
    const label = document.createElement('div');
    label.className = 'picker-label';
    label.textContent = 'How long have you got?';
    c.append(label, row);
  }
  const go = document.createElement('button');
  go.className = 'program-go';
  go.textContent = "Start today's session";
  go.addEventListener('click', () => startProgramDay(prog, day));
  const surfed = document.createElement('button');
  surfed.className = 'secondary';
  surfed.textContent = 'I surfed today';
  surfed.addEventListener('click', () => {
    st.done.push({ n: day.n, at: Date.now(), surfed: true });
    savePrefs();
    renderProgram();
    els.programNote.textContent = 'Logged. If you\'ve got ten minutes, Surf Mobility in Stretch & mobility is good after a session.';
  });
  c.append(go, surfed);
  els.programBody.insertBefore(c, els.programBody.querySelector('.program-foot'));
}
function startProgramDay(prog, day) {
  state.programRun = { id: prog.id, n: day.n };
  if (day.stretch) {
    const w = STRETCH_ROUTINES.find(x => x.id === day.stretch);
    openWorkout(w);
    return;
  }
  const request = {
    minutes: state.programMinutes || day.minutes,
    people: state.people,
    intervalId: day.mix ? 'mix' : day.style,
    mix: day.mix ? day.mix.slice() : undefined,
    goal: prog.goal, surfFocus: day.focus, repScale: day.repScale,
    regions: REGIONS.map(r => r.id), blockedTags: []
  };
  const err = buildAndOpen(request);
  if (err) { state.programRun = null; els.programNote.textContent = err; }
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
// EVENT WIRING
// =====================================================================
els.pathQuick.addEventListener('click', () => openSetup('quick'));
els.pathCustom.addEventListener('click', () => openSetup('custom'));
els.pathStretch.addEventListener('click', openStretchLibrary);
// The Stretch path narrows the library to stretching; the Workouts path is
// the whole library, so it must not inherit that filter from a previous visit.
els.pathClassics.addEventListener('click', () => {
  state.filterFocus = 'all';
  savePrefs();
  openLibrary();
});
els.btnSetupBack.addEventListener('click', goWelcome);
els.btnLibraryBack.addEventListener('click', goWelcome);
// a program's session goes back to the program, anything else to the menu
els.btnBack.addEventListener('click', () => (state.programRun ? openProgram() : goWelcome()));
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
  if (err) els.buildNote.textContent = err;
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
  state.saved.unshift({
    name: w.name, blurb: w.blurb, focus: w.focus, seed: w.seed,
    request: w.request,
    savedOn: new Date().toLocaleDateString()
  });
  savePrefs();
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
    if (navigator.share) { await navigator.share({ title, text: title, url }); return; }
    await navigator.clipboard.writeText(url);
    els.workoutNote.textContent = 'Link copied. Open it on any phone or tablet for this exact workout.';
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // share sheet dismissed
    els.workoutNote.textContent = url;
  }
});

els.btnStart.addEventListener('click', () => {
  if (state.running) pauseTimer(); else startTimer();
});
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
  savePrefs();
});

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
  const more = el.scrollHeight - el.clientHeight - el.scrollTop > 8;
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

function setupFullscreen() {
  const canFullscreen = !!(document.documentElement.requestFullscreen ||
                           document.documentElement.webkitRequestFullscreen);
  // Already launched from the home screen: nothing left to hide.
  if (isStandalone()) return;
  // The hint describes the Safari share sheet, so only show it where that
  // exists. iPadOS reports itself as a Mac, hence the touch-points check.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  els.installHint.hidden = !isIOS;
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

// Coming back to the app re-derives the position from the clock, so a
// spell in the background can't leave the workout behind.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!state.running) return;
  requestWakeLock();
  tickClock();
});

// =====================================================================
// INIT
// =====================================================================
loadPrefs();
els.nameA.value = state.nameA || '';
els.nameB.value = state.nameB || '';
els.showAlts.checked = state.showAlts;
els.muteAudio.checked = state.muteAudio;
els.showPhotos.checked = state.showPhotos !== false;
document.body.classList.toggle('show-alternatives', state.showAlts);
document.body.classList.toggle('hide-photos', state.showPhotos === false);
applyTextScale();
setupFullscreen();
renderWelcomeFoot();
updateScrollHint();
openLinkFromHash();
window.addEventListener('hashchange', openLinkFromHash);

// =====================================================================
// OFFLINE
// sw.js caches the app and every animation on the first visit, so from
// then on it opens with no network at all. The app files themselves are
// fetched network-first, so online it is always the current version.
// =====================================================================
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('sw.js')
    .catch(() => { /* offline support is a nicety; the app runs without it */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
