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
  equipment: { ...DEFAULT_EQUIPMENT },
  minutes: 20,
  intervalStyle: DEFAULT_INTERVAL,
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

const PERSISTED = ['people', 'nameA', 'nameB', 'equipment', 'minutes', 'intervalStyle',
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
    state.equipment = { ...DEFAULT_EQUIPMENT, ...(p.equipment || {}) };
    if (!INTERVALS[state.intervalStyle]) state.intervalStyle = DEFAULT_INTERVAL;
    if (!Array.isArray(state.regions) || !state.regions.length) state.regions = REGIONS.map(r => r.id);
    if (!Array.isArray(state.excluded)) state.excluded = [];
    if (!Array.isArray(state.recent)) state.recent = [];
    if (!Array.isArray(state.saved)) state.saved = [];
    if (!Array.isArray(state.history)) state.history = [];
  } catch (e) { /* corrupt store: fall back to defaults */ }
}
function savePrefs() {
  try {
    const out = {};
    PERSISTED.forEach(k => { out[k] = state[k]; });
    localStorage.setItem(PREFS_KEY, JSON.stringify(out));
  } catch (e) { /* private mode / quota: preferences just won't stick */ }
}

const hasEquip = (id) => state.equipment[id] !== false;
const currentInterval = () => INTERVALS[state.intervalStyle] || INTERVALS[DEFAULT_INTERVAL];
const buildCtx = () => {
  const iv = currentInterval();
  return { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, hasEquip };
};

// Classics carry no bookends of their own, they scale to the length of
// the work, so a 9-minute session isn't wrapped in 10 minutes of walking.
CLASSICS.forEach(w => {
  const workSec = w.blocks.length * 240 + (w.blocks.length - 1) * w.blockRestSec;
  const b = bookends(Math.round(workSec / 60) + 8);
  w.warmupSec = b.warmupSec;
  w.cooldownSec = b.cooldownSec;
});

// =====================================================================
// ELEMENTS
// =====================================================================
const $ = (id) => document.getElementById(id);
const els = {
  welcomeView: $('welcomeView'), setupView: $('setupView'),
  libraryView: $('libraryView'), workoutView: $('workoutView'),
  pathQuick: $('pathQuick'), pathCustom: $('pathCustom'),
  pathStretch: $('pathStretch'), pathClassics: $('pathClassics'),
  scroller: $('scroller'),
  welcomeFoot: $('welcomeFoot'), btnFullscreen: $('btnFullscreen'),
  installHint: $('installHint'),

  btnSetupBack: $('btnSetupBack'), setupTitle: $('setupTitle'),
  peoplePicker: $('peoplePicker'), nameInputs: $('nameInputs'),
  nameA: $('nameA'), nameB: $('nameB'),
  equipmentPicker: $('equipmentPicker'), timePicker: $('timePicker'),
  intervalPicker: $('intervalPicker'),
  rowRegions: $('rowRegions'), rowExclude: $('rowExclude'),
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
  exerciseA: $('exerciseA'), cueA: $('cueA'), animA: $('animA'), alternativeA: $('alternativeA'),
  personB: $('personB'), exerciseB: $('exerciseB'), cueB: $('cueB'),
  animB: $('animB'), alternativeB: $('alternativeB'),
  upcoming: $('upcoming'), preStart: $('preStart'),
  previewCard: $('previewCard'), previewList: $('previewList'),
  btnShuffle: $('btnShuffle'), btnSave: $('btnSave'),
  btnStart: $('btnStart'), btnSkip: $('btnSkip'), btnReset: $('btnReset'),
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
  const iv = currentInterval();
  const work = w.blocks.length * blockSeconds(iv) + (w.blocks.length - 1) * w.blockRestSec;
  const bookend = w.warmupSec + w.cooldownSec;
  return {
    totalMin: Math.round((work + bookend) / 60), totalSec: work + bookend,
    workMin: Math.round(work / 60), bookendsMin: Math.round(bookend / 60)
  };
}

function buildSequence(workout, people) {
  const seq = [];
  const iv = currentInterval();
  const ctx = buildCtx();
  const isDuo = people === 2;
  const pair = (ex) => isDuo ? { a: ex, b: ex } : { a: ex, b: null };

  if (workout.format === 'tabata') {
    if (workout.warmupSec > 0) {
      seq.push({ kind: 'warmup', duration: workout.warmupSec,
                 name: `Warm-up: ${fmtMin(workout.warmupSec)}`, ...pair(warmupExercise) });
    }
    const total = workout.blocks.length;
    workout.blocks.forEach((block, blockIdx) => {
      const label = `Block ${blockIdx + 1} of ${total}: ${block.name}`;
      for (let round = 1; round <= iv.rounds; round++) {
        const w = isDuo ? block.duo(round, ctx) : { a: block.solo(round, ctx), b: null };
        seq.push({ kind: 'work', duration: iv.workSec, blockIdx, round,
                   totalBlocks: total, totalRounds: iv.rounds, name: label, a: w.a, b: w.b });
        seq.push({ kind: 'rest', duration: iv.restSec, blockIdx, round,
                   totalBlocks: total, totalRounds: iv.rounds, name: label,
                   ...pair({ name: 'Rest', display: 'Rest', cue: 'Breathe', alt: '', img: null }) });
      }
      if (blockIdx < total - 1) {
        seq.push({ kind: 'blockrest', duration: workout.blockRestSec, blockIdx, totalBlocks: total,
                   name: `Rest, then Block ${blockIdx + 2}: ${workout.blocks[blockIdx + 1].name}`,
                   ...pair({ name: 'Block rest', display: 'Block rest', cue: 'Hydrate, reset, swap equipment if needed', alt: '', img: null }) });
      }
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
  ['welcome', 'setup', 'library', 'workout'].forEach(name => {
    els[name + 'View'].classList.toggle('active', v === name);
  });
  els.scroller.scrollTop = 0;
  queueScrollHint();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function goWelcome() {
  stopTimer();
  state.workout = null;
  setView('welcome');
  renderWelcomeFoot();
}

function renderWelcomeFoot() {
  const iv = currentInterval();
  const gear = Object.keys(EQUIPMENT).filter(hasEquip).length;
  els.welcomeFoot.textContent =
    `${Object.keys(EXERCISES).length} movements · ${iv.label.toLowerCase()} (${iv.sub}) · ` +
    `${gear}/${Object.keys(EQUIPMENT).length} kit items on · ` +
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
  renderPeoplePicker();
  renderEquipmentPicker();
  renderTimePicker();
  renderIntervalPicker();
  renderRegionPicker();
  renderTagPicker();
  renderExcludeSummary();
  if (!els.excludePanel.hidden) renderExcludeList();
}

function renderPeoplePicker() {
  els.peoplePicker.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', Number(chip.dataset.people) === state.people);
  });
  els.nameInputs.classList.toggle('hidden', state.people !== 2);
}

function renderEquipmentPicker() {
  els.equipmentPicker.innerHTML = '';
  Object.keys(EQUIPMENT).forEach(id => {
    const b = document.createElement('button');
    b.className = 'chip' + (hasEquip(id) ? ' active' : '');
    b.textContent = EQUIPMENT[id];
    b.setAttribute('aria-pressed', String(hasEquip(id)));
    b.addEventListener('click', () => {
      state.equipment[id] = !hasEquip(id);
      savePrefs();
      renderEquipmentPicker();
    });
    els.equipmentPicker.appendChild(b);
  });
}

function renderTimePicker() {
  els.timePicker.innerHTML = '';
  TIME_OPTIONS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.minutes === m ? ' active' : '');
    b.textContent = `${m} min`;
    b.addEventListener('click', () => {
      state.minutes = m;
      savePrefs();
      renderTimePicker();
    });
    els.timePicker.appendChild(b);
  });
}

function renderIntervalPicker() {
  els.intervalPicker.innerHTML = '';
  Object.keys(INTERVALS).forEach(id => {
    const iv = INTERVALS[id];
    const b = document.createElement('button');
    b.className = 'interval-card' + (state.intervalStyle === id ? ' active' : '');
    b.innerHTML = `
      <div class="interval-name">${esc(iv.label)}</div>
      <div class="interval-sub">${esc(iv.sub)} × ${iv.rounds} rounds</div>
      <div class="interval-blurb">${esc(iv.blurb)}</div>`;
    b.addEventListener('click', () => {
      state.intervalStyle = id;
      savePrefs();
      renderIntervalPicker();
    });
    els.intervalPicker.appendChild(b);
  });
}

function renderRegionPicker() {
  els.regionPicker.innerHTML = '';
  REGIONS.forEach(r => {
    const on = state.regions.includes(r.id);
    const b = document.createElement('button');
    b.className = 'chip' + (on ? ' active' : '');
    b.textContent = r.label;
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => toggleRegion(r.id));
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
    const b = document.createElement('button');
    b.className = 'chip' + (on ? ' active' : '');
    b.textContent = t.label;
    b.title = t.blurb;
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => {
      const i = state.blockedTags.indexOf(t.id);
      if (i >= 0) state.blockedTags.splice(i, 1); else state.blockedTags.push(t.id);
      savePrefs();
      renderTagPicker();
    });
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
    intervalId: state.intervalStyle,
    regions: custom ? state.regions.slice() : REGIONS.map(r => r.id),
    equipment: { ...state.equipment },
    excluded: state.excluded.slice(),
    blockedTags: custom ? state.blockedTags.slice() : [],
    recent: state.recent.slice()
  };
}

function buildAndOpen(request, seed) {
  const opts = { ...request, seed: seed || newSeed() };
  const w = generateWorkout(opts);
  if (w.error) {
    els.buildNote.textContent = w.error;
    return false;
  }
  state.lastRequest = request;
  openWorkout(w);
  return true;
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
  const ctx = buildCtx();
  return w.blocks.some(b => (b.ids || []).some(id => resolveEx(id, ctx).adapted));
}

function renderFocusFilter() {
  const list = [{ id: 'all', label: 'All' },
                ...Object.keys(focusLabelMap).map(id => ({ id, label: focusLabelMap[id] }))];
  els.focusFilter.innerHTML = '';
  list.forEach(f => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.filterFocus === f.id ? ' active' : '');
    b.textContent = f.label;
    b.addEventListener('click', () => {
      state.filterFocus = f.id;
      savePrefs();
      renderFocusFilter();
      renderLibrary();
    });
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
  const card = document.createElement('button');
  card.className = 'workout-card ' + focusClassMap[w.focus];
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
  card.addEventListener('click', () => openWorkout(w));
  return card;
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
      <span>${esc((INTERVALS[rec.intervalId] || {}).sub || '')}</span>
    </div>
    <div class="card-blurb">${esc(rec.blurb || '')}</div>
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
  // A generated workout carries its own interval; honour it so a saved
  // favourite replays as it was built.
  if (workout.intervalId && INTERVALS[workout.intervalId]) state.intervalStyle = workout.intervalId;

  state.sequence = buildSequence(workout, state.people);
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
  els.btnSave.textContent = '☆ Save as favourite';
  els.btnSave.disabled = false;

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
  const ctx = buildCtx();
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
  const iv = currentInterval();
  add(`Warm-up: ${fmtMin(w.warmupSec)}`, warmupExercise.cue);
  w.blocks.forEach((b, i) => {
    const names = Array.from(new Set((b.ids || []).map(id => describeEx(id, ctx).display)));
    add(`Block ${i + 1}: ${b.name}`,
        `${iv.rounds} × ${iv.workSec}s · ${names.join('  ·  ')}`);
  });
  add(`Cool-down: ${fmtMin(w.cooldownSec)}`, cooldownExercise.cue);
}

const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

function setAlt(el, alt) {
  el.textContent = alt || '';
  el.classList.toggle('has-alt', !!alt);
}

// render() runs several times a second, so only touch the DOM when the
// media actually changes, rewriting it would restart the animation.
function updateAnim(el, ex) {
  const base = ex && ex.img ? ex.img : '';
  if (el.dataset.img === base) return;
  el.dataset.img = base;
  el.innerHTML = base ? `<img src="img/exercises/${base}.svg" alt="">` : '';
}

function renderSegBar(current, total, kind) {
  const row = document.createElement('div');
  row.className = 'round-row';
  const count = document.createElement('div');
  count.className = 'round-count';
  count.innerHTML = `Round <b>${current}</b><span class="of"> of ${total}</span>`;
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
  if (phase.totalRounds) renderSegBar(phase.round, phase.totalRounds, phase.kind);
  else if (phase.totalStretches) renderSegBar(phase.stretchIdx + 1, phase.totalStretches, phase.kind);
  else if (phase.totalBlocks) {
    const label = document.createElement('div');
    label.className = 'round-count';
    label.textContent = `Between blocks: ${phase.blockIdx + 1} to ${phase.blockIdx + 2} of ${phase.totalBlocks}`;
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
  els.phaseLabel.textContent = PHASE_LABEL[phase.kind] || '';
  els.timeDisplay.textContent = fmt(Math.ceil(state.remainingInPhase));
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

  els.exerciseA.textContent = dispA ? (dispA.display || dispA.name) : '';
  els.cueA.textContent = dispA ? (dispA.cue || '') : '';
  setAlt(els.alternativeA, dispA ? dispA.alt : '');
  updateAnim(els.animA, dispA);
  if (state.people === 2 && dispB) {
    els.exerciseB.textContent = dispB.display || dispB.name;
    els.cueB.textContent = dispB.cue || '';
    setAlt(els.alternativeB, dispB.alt);
    updateAnim(els.animB, dispB);
  } else {
    updateAnim(els.animB, null);
  }

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
  else if (next.kind === 'work') {
    preview = state.people === 2
      ? `${short('a', 'A')}: ${next.a.display || next.a.name} · ` +
        `${short('b', 'B')}: ${next.b.display || next.b.name}`
      : (next.a.display || next.a.name);
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
    intervalId: w.intervalId || state.intervalStyle,
    generated: !!w.generated,
    // Enough to rebuild it exactly: a seed and a request for generated
    // workouts, an id for the named ones.
    seed: w.seed || null,
    request: w.request ? { ...w.request, recent: [] } : null,
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
    const w = generateWorkout({
      ...rec.request,
      equipment: { ...state.equipment },
      excluded: state.excluded.slice(),
      seed: rec.seed,
      recent: []
    });
    if (w.error) return w.error;
    state.lastRequest = rec.request;
    openWorkout(w);
    return null;
  }
  const w = CLASSICS.find(x => x.id === rec.workoutId) ||
            STRETCH_ROUTINES.find(x => x.id === rec.workoutId);
  if (!w) return 'That workout is no longer in the library.';
  openWorkout(w);
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
// EVENT WIRING
// =====================================================================
els.pathQuick.addEventListener('click', () => openSetup('quick'));
els.pathCustom.addEventListener('click', () => openSetup('custom'));
els.pathStretch.addEventListener('click', openStretchLibrary);
els.pathClassics.addEventListener('click', openLibrary);
els.btnSetupBack.addEventListener('click', goWelcome);
els.btnLibraryBack.addEventListener('click', goWelcome);
els.btnBack.addEventListener('click', goWelcome);

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
  buildAndOpen(requestFromState());
});

els.btnShuffle.addEventListener('click', () => {
  const request = state.lastRequest || requestFromState();
  buildAndOpen(request, newSeed());
});

els.btnSave.addEventListener('click', () => {
  const w = state.workout;
  if (!w || !w.generated) return;
  if (state.saved.some(s => s.seed === w.seed)) return;
  state.saved.unshift({
    name: w.name, blurb: w.blurb, focus: w.focus, seed: w.seed,
    request: { ...w.request, recent: [] },
    savedOn: new Date().toLocaleDateString()
  });
  savePrefs();
  els.btnSave.textContent = '★ Saved';
  els.btnSave.disabled = true;
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
  els.installHint.hidden = false;
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
