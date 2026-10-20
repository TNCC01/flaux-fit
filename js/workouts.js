/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  INTERVALS, BLOCK HELPERS AND THE NAMED CLASSICS
  ===============================================
  Every interval style runs a 240-second block, so swapping between them
  never changes how long a workout takes, only how each minute is spent:

    short  8 rounds x (20s work + 10s rest)  = 240s   160s of work
    long   4 rounds x (40s work + 20s rest)  = 240s   160s of work
    emom   4 rounds x 60s, a set number of reps at the top of each
           minute and whatever is left of it to rest     = 240s
    amrap  one 240s round: each person works through the block's
           exercises as many times as they can, tapping after each lap
    fortime  a set number of laps of the block's exercises against a
           240s cap; tap Done to log the time, the rest of the cap is rest

  A program week can run short bursts or long efforts at its own split of
  the same 240 seconds (see withWorkRest).

  Everything that used to hardcode "round 5" or "switch at 10s" now reads
  the live interval out of ctx, so cues stay truthful in both styles.
*/

const INTERVALS = {
  short: { id: 'short', label: 'Short bursts', sub: '20s work · 10s rest',
           rounds: 8, workSec: 20, restSec: 10,
           blurb: 'Eight sharp rounds. More stops, more recovery.' },
  long:  { id: 'long',  label: 'Long efforts', sub: '40s work · 20s rest',
           rounds: 4, workSec: 40, restSec: 20,
           blurb: 'Four long rounds. Same total work, half the stops, so it burns more.' },
  emom:  { id: 'emom',  label: 'EMOM', sub: 'Every minute on the minute',
           rounds: 4, workSec: 60, restSec: 0, reps: true,
           blurb: 'Do the reps at the start of each minute, then rest until the next one. Faster reps, more rest.' },
  amrap: { id: 'amrap', label: 'AMRAP', sub: 'As many rounds as possible',
           rounds: 1, workSec: 240, restSec: 0, reps: true, lap: true, amrap: true,
           blurb: 'Four minutes to get through a short list as many times as you can. Tap after each round to keep score.' },
  fortime: { id: 'fortime', label: 'For Time', sub: 'Race the clock',
           rounds: 1, workSec: 240, restSec: 0, reps: true, lap: true, forTime: true,
           blurb: 'A set amount of work with a four-minute cap. Finish faster and the rest of the cap is yours to recover. Tap Done to log your time.' }
};
const DEFAULT_INTERVAL = 'short';

// Every block is this long whichever interval you pick.
const blockSeconds = (iv) => iv.rounds * (iv.workSec + iv.restSec);
const ownKey = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

// A program week can run a timed style at its own split of the same block
// (Surf Fit's long efforts go from 30s on, 30s off to 45s on, 15s off).
// workRest is { long: [45, 15] }, keyed by style; every split keeps the
// style's rounds and its 240 seconds, so the length never changes.
function withWorkRest(iv, workRest) {
  const wr = ownKey(workRest, iv.id) && workRest[iv.id];
  if (!wr) return iv;
  return { ...iv, workSec: wr[0], restSec: wr[1], sub: `${wr[0]}s work · ${wr[1]}s rest` };
}
// A workRest from a build, a favourite or a link, checked: splits a timed
// style can run in its 240 seconds, or undefined.
function cleanWorkRest(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const out = {};
  for (const [id, wr] of Object.entries(x)) {
    const iv = ownKey(INTERVALS, id) && INTERVALS[id];
    if (!iv || iv.reps || !Array.isArray(wr) || wr.length !== 2) return undefined;
    const [work, rest] = wr;
    if (!Number.isInteger(work) || !Number.isInteger(rest) || work < 5 || rest < 5
        || iv.rounds * (work + rest) !== blockSeconds(iv)) return undefined;
    out[id] = [work, rest];
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------
// EXERCISE RESOLUTION
// ctx = { rounds, workSec, restSec, reps, lap, repScale, level, hasEquip },
// where hasEquip(id) => bool, reps is true for the styles that count reps
// rather than seconds (EMOM, AMRAP, For Time), lap for the two that work
// through the block as one list (AMRAP, For Time), repScale a program's
// build-up and level the person's own (see PERSONAL LEVELS)
// ---------------------------------------------------------------------

// Walk bw fallbacks until everything the exercise needs is on hand.
function resolveEx(id, ctx) {
  let cur = EXERCISES[id];
  if (!cur) {
    // A bad id is a bug, not a runtime condition, say so loudly in dev
    // but still hand back something renderable so a workout can finish.
    console.error(`[FIT] unknown exercise id "${id}"`);
    return { id, name: 'Unknown exercise', cue: '', alt: '', img: null,
             equipment: [], adapted: false, regions: [], pattern: 'cardio', tags: [] };
  }
  const has = (ctx && ctx.hasEquip) || (() => true);
  let curId = id, adapted = false, guard = 0;
  while (!cur.equipment.every(has) && cur.bw && guard++ < 8) {
    curId = cur.bw;
    cur = EXERCISES[curId];
    adapted = true;
  }
  return { ...cur, id: curId, adapted };
}

// An exercise's EMOM target as it reads on screen.
function repsLabel(v) {
  if (typeof v === 'number') return `${v} reps`;
  const m = /^(\d+)(s?)\/side$/.exec(v || '');
  if (m) return `${m[1]}${m[2]} each side`;
  return v || '';                     // '40s', '1 lap', '5 each way'
}
// An AMRAP lap strings several exercises together, so each one is about
// two thirds of its EMOM target: 12 reps -> 8, 20 -> 14, '40s' -> '25s'.
function amrapTarget(v) {
  const two3 = (n) => n * 2 / 3;
  // over ten, an even number reads as a target rather than a calculation
  const nice = (x) => x > 10 ? Math.round(x / 2) * 2 : Math.round(x);
  if (typeof v === 'number') return Math.max(3, nice(two3(v)));
  const m = /^(\d+)(s?)(\/side)?$/.exec(v || '');
  if (!m) return v;                   // '1 lap', '5 each way'
  const n = m[2] ? Math.max(10, Math.round(two3(+m[1]) / 5) * 5)
                 : Math.max(2, nice(two3(+m[1])));
  return `${n}${m[2]}${m[3] || ''}`;
}

// A program's build-up: the same targets, lighter early and heavier late
// (0.8 is four fifths of the reps). Timed efforts move in 5-second steps.
function scaleTarget(v, k) {
  if (!k || k === 1) return v;
  if (typeof v === 'number') return Math.max(2, Math.round(v * k));
  const m = /^(\d+)(s?)(\/side)?$/.exec(v || '');
  if (!m) return v;
  const n = m[2] ? Math.max(10, Math.round(+m[1] * k / 5) * 5) : Math.max(2, Math.round(+m[1] * k));
  return `${n}${m[2]}${m[3] || ''}`;
}

// Seconds of work in a timed EMOM target ('40s', '20s/side'), else 0.
function timedSec(v) {
  const m = /^(\d+)s(\/side)?$/.exec(typeof v === 'string' ? v : '');
  return m ? +m[1] * (m[2] ? 2 : 1) : 0;
}
// An EMOM's timed effort leaves at least 15 seconds of the minute to rest,
// however far a program and a level have pushed it.
function inMinute(v, ctx) {
  if (!ctx || !ctx.reps || ctx.lap) return v;
  const m = /^(\d+)s(\/side)?$/.exec(typeof v === 'string' ? v : '');
  const cap = m && (m[2] ? 20 : 45);
  return m && +m[1] > cap ? `${cap}s${m[2] || ''}` : v;
}
// How far a person's level moved a target, the way the card says it:
// '+1 rep', '−2 reps', '+5s', '+1 each side', or '' when it didn't.
function targetDiff(now, plain) {
  const parse = (v) => {
    if (typeof v === 'number') return { n: v, secs: false, side: false };
    const m = /^(\d+)(s?)(\/side)?$/.exec(v || '');
    return m && { n: +m[1], secs: !!m[2], side: !!m[3] };
  };
  const a = parse(now), b = parse(plain);
  if (!a || !b || a.n === b.n) return '';
  const d = Math.abs(a.n - b.n);
  const amount = a.secs ? `${d}s` : a.side ? `${d}` : `${d} rep${d === 1 ? '' : 's'}`;
  return `${a.n > b.n ? '+' : '−'}${amount}${a.side ? ' each side' : ''}`;
}

// The weight to show on the card. ctx.loads, when the app knows the gear
// you own, holds the real weight for each role ({ kb15: '16kg', kb10:
// '12kg', bar: '20kg bar', dbHeavy: '12.5kg', dbLight: '7.5kg' }); without
// it the exercise's own default label stands.
function loadFor(ex, ctx) {
  const L = ctx && ctx.loads;
  if (!L) return ex.load || '';
  const eq = ex.equipment || [];
  const real = eq.includes('kb15') ? L.kb15
    : eq.includes('kb10') ? L.kb10
    : eq.includes('barbell10') ? L.bar
    : eq.includes('dumbbells') ? (ex.db === 'light' ? L.dbLight : L.dbHeavy)
    : '';
  return real || ex.load || '';
}

// Build what the workout screen actually shows: a short bold name plus a
// coaching cue whose timings match the interval in play.
function describeEx(id, ctx) {
  const ex = resolveEx(id, ctx);
  const emom = !!(ctx && ctx.reps);
  // the program's build-up, then the person's own level on top
  const base = ctx && ctx.lap ? amrapTarget(ex.emom) : ex.emom;
  const repScale = (ctx && ctx.repScale) || 1, level = (ctx && ctx.level) || 1;
  const plain = inMinute(scaleTarget(base, repScale), ctx);
  const target = level === 1 ? plain : inMinute(scaleTarget(base, repScale * level), ctx);
  // when counting reps the effort is the reps (or the timed hold), not the clock
  const workSec = (emom && timedSec(target)) || (ctx && ctx.workSec) || INTERVALS[DEFAULT_INTERVAL].workSec;
  let cue = ex.cue || '';
  // an EMOM target already says "each side"
  if (ex.sideCue && !emom) {
    const half = Math.round(workSec / 2);
    cue = cue ? `${cue} · swap sides at ${half}s` : `Swap sides at ${half}s`;
  }
  if (ex.rotateCue) {
    cue = `${cue}, change every ${Math.round(workSec / ex.rotateCue)}s`;
  }
  // `display` is what goes on screen: the load belongs in the headline, not
  // the cue, so a pair sharing a movement at two weights can tell at a
  // glance which one is theirs.
  const load = loadFor(ex, ctx);
  return { id: ex.id, name: ex.name, load, cue, reps: emom ? repsLabel(target) : '',
           more: emom && level !== 1 ? targetDiff(target, plain) : '',
           display: load ? `${ex.name} · ${load}` : ex.name,
           alt: ex.alt || '', img: ex.img || null, adapted: ex.adapted };
}

// ---------------------------------------------------------------------
// PERSONAL LEVELS
// After a session each person can say how it was: Too easy, About right or
// Cooked. Two Too easy in a row move their level up a notch and one Cooked
// moves it down, between 0.7 and 1.3, so one bad day can't undo weeks. A
// new build keeps each person's level on its request as repScales
// ({ wayne: 1.1, '#b': 0.9 }: by name, or by spot for someone with no
// name), and the cards scale that person's rep targets by it, on top of a
// program's build-up, so two people get their own reps from the same
// moves. Rep targets only: the moves and the clock stay as built.
// ---------------------------------------------------------------------
const LEVEL_MIN = 0.7;
const LEVEL_MAX = 1.3;
const LEVEL_STEP = 0.1;
// A person's level, { k, easy } (easy: a Too easy waiting for its second),
// after one more answer: 'easy', 'right' or 'cooked'.
function nextLevel(rec, feel) {
  let k = rec && typeof rec.k === 'number' ? rec.k : 1;
  let easy = rec && rec.easy === 1 ? 1 : 0;
  if (feel === 'easy') {
    easy++;
    if (easy >= 2) { k += LEVEL_STEP; easy = 0; }
  } else if (feel === 'cooked') {
    k -= LEVEL_STEP; easy = 0;
  } else if (feel === 'right') {
    easy = 0;
  }
  return { k: Math.round(Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, k)) * 10) / 10, easy };
}
// repScales from a build, a favourite or a link, checked: a level in range
// for each person (two at most), or undefined when nobody's is away from 1.
function cleanRepScales(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const out = {};
  Object.keys(x).slice(0, 2).forEach(key => {
    const k = typeof x[key] === 'number' ? Math.round(x[key] * 10) / 10 : NaN;
    if (key && key.length <= 30 && key !== '__proto__' && k >= LEVEL_MIN && k <= LEVEL_MAX && k !== 1) out[key] = k;
  });
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------
// BLOCK HELPERS
// Each returns { name, ids, shape, make, duo(round, ctx), solo(round, ctx) }.
// `make` says which helper built it, so a saved workout can build the same
// block again (see FROZEN WORKOUTS).
// ---------------------------------------------------------------------

// Both people do the same exercise, only safe when it needs no
// single-instance gear, which the self-check enforces.
function blockSame(name, exId) {
  return {
    name, ids: [exId], shape: 'same', make: 'same',
    duo: (r, ctx) => { const ex = describeEx(exId, ctx); return { a: ex, b: ex }; },
    solo: (r, ctx) => describeEx(exId, ctx)
  };
}

// Two exercises trade places between A and B each round; solo alternates
// them round by round.
function blockAlt(name, idA, idB) {
  return {
    name, ids: [idA, idB], shape: 'alt', make: 'alt',
    duo: (r, ctx) => {
      const A = describeEx(idA, ctx), B = describeEx(idB, ctx);
      return (r % 2 === 1) ? { a: A, b: B } : { a: B, b: A };
    },
    solo: (r, ctx) => describeEx(r % 2 === 1 ? idA : idB, ctx)
  };
}

// A list cycled round by round. A and B always sit on neighbouring
// entries, so no two adjacent entries (wrap included) may need the same
// single-instance item.
function blockCycle(name, ids) {
  return {
    name, ids, shape: 'cycle', make: 'cycle',
    duo: (r, ctx) => ({
      a: describeEx(ids[(r - 1) % ids.length], ctx),
      b: describeEx(ids[r % ids.length], ctx)
    }),
    solo: (r, ctx) => describeEx(ids[(r - 1) % ids.length], ctx)
  };
}

// True once round r is past the halfway point of the block. Derived from
// ctx.rounds so it works at 8 rounds and at 4.
const pastHalfway = (r, ctx) => r > Math.ceil(((ctx && ctx.rounds) || 8) / 2);

// One movement at two weights, swapping between the pair at the halfway round.
function blockSwap(name, heavyId, lightId) {
  return {
    name, ids: [heavyId, lightId], shape: 'swap', make: 'swap',
    duo: (r, ctx) => {
      const h = describeEx(heavyId, ctx), l = describeEx(lightId, ctx);
      return pastHalfway(r, ctx) ? { a: l, b: h } : { a: h, b: l };
    },
    solo: (r, ctx) => describeEx(pastHalfway(r, ctx) ? lightId : heavyId, ctx)
  };
}

// Like blockSwap but also alternates which arm works each round, for
// single-arm lifts where that matters.
function blockSwapAlternating(name, heavyId, lightId) {
  const arm = (r) => r % 2 === 1 ? 'Left arm' : 'Right arm';
  // The arm cue is dropped once an exercise has adapted to bodyweight,
  // where it no longer means anything.
  const tag = (ex, r) => ex.adapted ? ex
    : { ...ex, cue: ex.cue ? `${arm(r)} · ${ex.cue}` : arm(r) };
  return {
    name, ids: [heavyId, lightId], shape: 'swap', make: 'swapAlt',
    duo: (r, ctx) => {
      const h = tag(describeEx(heavyId, ctx), r), l = tag(describeEx(lightId, ctx), r);
      return pastHalfway(r, ctx) ? { a: l, b: h } : { a: h, b: l };
    },
    solo: (r, ctx) => tag(describeEx(pastHalfway(r, ctx) ? lightId : heavyId, ctx), r)
  };
}

// AMRAP: each person laps the block's exercises at their own pace, so the
// two of them are never in step and a shared bell could be wanted by both
// at once. B starts one exercise along, and anything in B's lap that needs
// single-instance gear A's lap uses goes to its bodyweight version. A swap
// block's two ids are one movement at two weights: A takes the first, B
// the second.
// For Time: laps to finish, so the work lands around three quarters of the
// cap for most people (three minutes of a four-minute cap), leaving the rest
// to recover. A longer cap in a mix gets proportionally more laps.
const forTimeRounds = (lapLength, capSec = 240) =>
  Math.max(2, Math.round((lapLength >= 3 ? 3 : lapLength === 2 ? 4 : 5) * capSec / 240));

function amrapCircuits(block, ctx, duo) {
  const swap = block.shape === 'swap';
  const ids = swap ? [block.ids[0]] : block.ids;
  const a = ids.map(id => describeEx(id, ctx));
  if (!duo) return { a, b: null };
  const aGear = new Set(a.flatMap(ex => EXERCISES[ex.id].equipment).filter(g => SINGLE_INSTANCE.includes(g)));
  const has = (ctx && ctx.hasEquip) || (() => true);
  const bCtx = { ...ctx, hasEquip: (g) => !aGear.has(g) && has(g) };
  const bIds = swap ? [block.ids[1]] : [...ids.slice(1), ids[0]];
  const b = [];
  for (const id of bIds) {
    const ex = describeEx(id, bCtx);
    if (!b.some(x => x.id === ex.id)) b.push(ex);   // two bells can fall back to the same move
  }
  return { a, b };
}

// ---------------------------------------------------------------------
// MIXED SESSIONS
// A mix runs two or three styles back to back, each as a section of its
// own. Short bursts and long efforts keep their four-minute blocks; EMOM,
// AMRAP and For Time can run any whole number of minutes, so they take up
// whatever's left once the blocks are in. The generator's planMix sizes
// them; a section is { intervalId, start, count, minutes, blockRestSec }:
// `count` exercise blocks from block `start`, and for the flexible styles
// the minutes it runs.
// ---------------------------------------------------------------------
const CHANGEOVER_SEC = 75;      // between sections: longer than a block rest
const FLEX_MIN_MINUTES = 4;     // shortest EMOM / AMRAP / For Time section
const isFlexible = (id) => !!(INTERVALS[id] && INTERVALS[id].reps);

// The interval a section runs at: the style's own (at a program week's
// split, see withWorkRest), with the plan's minutes as an EMOM's rounds or
// an AMRAP's or For Time's length.
function sectionInterval(sec, workRest) {
  const iv = withWorkRest(INTERVALS[sec.intervalId] || INTERVALS[DEFAULT_INTERVAL], workRest);
  if (!sec.minutes) return iv;
  if (iv.lap) return { ...iv, workSec: sec.minutes * 60 };
  if (iv.reps) return { ...iv, rounds: sec.minutes };
  return iv;
}
const sectionSeconds = (sec) =>
  sec.count * blockSeconds(sectionInterval(sec)) + Math.max(0, sec.count - 1) * (sec.blockRestSec || 0);

// ---------------------------------------------------------------------
// FROZEN WORKOUTS
// A built workout comes from a seed, and the same seed builds something
// else once the exercise library or the generator changes. So a favourite
// (and a history entry, and a session saved part-way) keeps what it was
// built as: each block's exercise ids and the helper that hands them out
// (which also says who does what with two people), and the plan around
// them. Built again from that, it's the same workout after any update.
// The gear still adapts as the cards are drawn (describeEx), as it does
// for a classic.
// ---------------------------------------------------------------------
const BLOCK_MAKERS = {
  same:    { ids: 1, build: (name, ids) => blockSame(name, ids[0]) },
  alt:     { ids: 2, build: (name, ids) => blockAlt(name, ids[0], ids[1]) },
  cycle:   { ids: 0, build: (name, ids) => blockCycle(name, ids.slice()) },
  swap:    { ids: 2, build: (name, ids) => blockSwap(name, ids[0], ids[1]) },
  swapAlt: { ids: 2, build: (name, ids) => blockSwapAlternating(name, ids[0], ids[1]) }
};
// Plain data, so it goes into localStorage as it is.
function freezeWorkout(w) {
  const copy = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  return {
    v: 1, name: w.name, tagline: w.tagline, blurb: w.blurb, focus: w.focus,
    intervalId: w.intervalId, mix: copy(w.mix), repScale: w.repScale, sections: copy(w.sections),
    workRest: copy(w.workRest), repScales: copy(w.repScales),
    changeoverSec: w.changeoverSec, warmupSec: w.warmupSec, cooldownSec: w.cooldownSec,
    blockRestSec: w.blockRestSec, notes: copy(w.notes || []), builtWith: copy(w.builtWith),
    blocks: w.blocks.map(b => ({ make: b.make, name: b.name, ids: b.ids.slice() }))
  };
}
// The workout a frozen copy describes, with the seed and request it was
// built from (for its history key, Shuffle and Share), or null when any of
// it is the wrong shape or one of its exercises is no longer in the
// library. Null means build it again from the seed instead.
function thawWorkout(f, seed, request) {
  const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const secs = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const text = (x) => (typeof x === 'string' ? x : '');
  if (!plain(f) || f.v !== 1 || !Array.isArray(f.blocks) || !f.blocks.length || f.blocks.length > 30) return null;
  if (!(Number.isInteger(seed) && seed > 0) || !plain(request)) return null;
  const blocks = [];
  for (const b of f.blocks) {
    const maker = plain(b) && Object.prototype.hasOwnProperty.call(BLOCK_MAKERS, b.make) && BLOCK_MAKERS[b.make];
    if (!maker || typeof b.name !== 'string' || !Array.isArray(b.ids)) return null;
    if (maker.ids ? b.ids.length !== maker.ids : b.ids.length < 2 || b.ids.length > 8) return null;
    if (!b.ids.every(id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(EXERCISES, id))) return null;
    blocks.push(maker.build(b.name, b.ids));
  }
  if (![f.warmupSec, f.cooldownSec, f.blockRestSec].every(secs)) return null;
  if (f.repScale !== undefined && !(typeof f.repScale === 'number' && f.repScale > 0)) return null;
  if (f.workRest !== undefined && !cleanWorkRest(f.workRest)) return null;
  const w = {
    id: `gen-${seed}`, generated: true, format: 'tabata',
    name: text(f.name) || 'Saved workout', tagline: text(f.tagline), blurb: text(f.blurb),
    focus: typeof f.focus === 'string' && f.focus ? f.focus : 'whole-body',
    intervalId: f.intervalId, repScale: f.repScale,
    workRest: cleanWorkRest(f.workRest), repScales: cleanRepScales(f.repScales),
    warmupSec: f.warmupSec, cooldownSec: f.cooldownSec, blockRestSec: f.blockRestSec,
    blocks, notes: Array.isArray(f.notes) ? f.notes.filter(x => typeof x === 'string') : [],
    seed, request, exerciseIds: [...new Set(blocks.flatMap(b => b.ids))]
  };
  if (f.intervalId === 'mix') {
    // the sections have to cover the blocks, end to end
    if (!Array.isArray(f.sections) || !Array.isArray(f.mix) || !secs(f.changeoverSec)) return null;
    let at = 0;
    for (const s of f.sections) {
      if (!plain(s) || !INTERVALS[s.intervalId] || s.start !== at || !(Number.isInteger(s.count) && s.count > 0)
          || !secs(s.minutes) || !secs(s.blockRestSec)) return null;
      at += s.count;
    }
    if (at !== blocks.length) return null;
    w.mix = f.mix.filter(id => INTERVALS[id]);
    w.sections = f.sections.map(s => ({ intervalId: s.intervalId, start: s.start, count: s.count,
                                        minutes: s.minutes, blockRestSec: s.blockRestSec }));
    w.changeoverSec = f.changeoverSec;
  } else if (!INTERVALS[f.intervalId]) {
    return null;
  }
  const bw = f.builtWith;
  if (plain(bw) && plain(bw.equipment) && Array.isArray(bw.excluded)) {
    w.builtWith = { equipment: { ...bw.equipment }, excluded: bw.excluded.filter(id => typeof id === 'string') };
  }
  return w;
}

const blockCleanPress = () =>
  blockSwapAlternating('KB clean & press (alt arms)', 'kbCleanPress15', 'kbCleanPress10');

// ---------------------------------------------------------------------
// THE CLASSICS
// Hand-tuned named workouts, kept alongside the generator because a
// named session has an identity people come back to. The generator
// covers everything these don't.
// ---------------------------------------------------------------------
const CLASSICS = [
  {
    id: 'quick-spark', name: 'Quick Spark', tagline: 'No gear, max sweat',
    focus: 'whole-body', blurb: 'Bodyweight full-body. Get in, get sweaty, get out.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockAlt('Squats & push-ups', 'airSquat', 'pushup'),
      blockCycle('Climbers, jacks & core', ['mountainClimber', 'plankHold', 'jumpingJacks', 'hollowHold'])
    ]
  },
  {
    id: 'core-crusher', name: 'Core Crusher', tagline: 'Burn the middle',
    focus: 'core', blurb: 'Three blocks on the trunk: climbers, holds, twists.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockCycle('Climbers & core burners', ['mountainClimberFast', 'bicycleCrunch', 'flutterKicks', 'plankShoulderTaps']),
      blockAlt('Hollow holds & Russian twists', 'hollowHold', 'russianTwistKb'),
      blockSame('Plank rotations', 'plankRotation')
    ]
  },
  {
    id: 'calisthenics-core', name: 'Calisthenics Core', tagline: 'Bodyweight abs blast',
    focus: 'core', blurb: 'No equipment needed, just gravity and effort.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockAlt('Hollow rocks & V-sits', 'hollowRocks', 'vSit'),
      blockCycle('Climbers, dead bugs & bird dogs', ['mountainClimber', 'deadBug', 'birdDog', 'sidePlankDips']),
      blockAlt('Plank & leg raises', 'plankForearm', 'legRaises')
    ]
  },
  {
    id: 'lunchbreak-burn', name: 'Lunchbreak Burn', tagline: 'Big sweat, no gear',
    focus: 'whole-body', blurb: 'Bodyweight conditioning. No gear, no fuss, just go.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockAlt('Squats & push-ups', 'airSquat', 'pushup'),
      blockCycle('Lunges, dips & lower mix', ['reverseLunge', 'tricepDips', 'goodMorning', 'calfRaises']),
      blockCycle('Burpees & core burners', ['burpee', 'hollowRocks', 'skaterHops', 'supermanPull'])
    ]
  },
  {
    id: 'kb-blitz', name: 'KB Blitz', tagline: 'Two bells, twenty minutes',
    focus: 'lower-body', blurb: 'Pure kettlebell: goblet squats and swings, one bell each, swap at halfway.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10')
    ]
  },
  {
    id: 'ring-rush', name: 'Ring Rush', tagline: 'Hang on tight',
    focus: 'upper-body', blurb: 'Quick upper-body hit on the rings and dumbbells: pull, press, dip, curl.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockCycle('Rows & presses', ['ringRow', 'pikePushup', 'dbRow', 'pushup']),
      blockCycle('Dips & curls', ['ringDip', 'dbCurl', 'ringPushup', 'dbLateralRaise'])
    ]
  },
  {
    id: 'lunchbreak-loaded', name: 'Lunchbreak Loaded', tagline: 'The lunch break, with weights',
    focus: 'whole-body', blurb: 'Same footprint as Lunchbreak Burn, but with the whole kit.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockCycle('Press & pull mix', ['barbellPress', 'pushup', 'dbRow', 'plankShoulderTaps']),
      blockCycle('Swings & skips', ['kbSwing15', 'skipping', 'kbSwing10', 'highKnees'])
    ]
  },
  {
    id: 'loaded-core', name: 'Loaded Core', tagline: 'Weighted middle management',
    focus: 'core', blurb: 'Core work with gear: weighted twists, renegade rows, ring hangs, carries.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockAlt('Russian twists & renegade rows', 'russianTwistKb', 'renegadeRow'),
      blockCycle('Hangs, planks & raises', ['ringTuckHold', 'plankShoulderTaps', 'legRaises', 'sidePlankDips']),
      blockAlt('Suitcase carry & hollow rocks', 'dbSuitcaseCarry', 'hollowRocks')
    ]
  },
  {
    id: 'half-power', name: 'Half Power', tagline: "Power Hour's little sibling",
    focus: 'whole-body', blurb: 'Squats, rows, swings and the clean & press finisher. The big one, condensed.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockCycle('Rows & push-up mix', ['ringRow', 'pushup', 'ringPushup', 'pikePushup']),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCleanPress()
    ]
  },
  {
    id: 'iron-legs', name: 'Iron Legs', tagline: 'Lower-body strength + grit',
    focus: 'lower-body', blurb: 'Squats, hinges, lunges, jumps. Wake up the legs.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Lunges, step-ups & hinges', ['dbLunge', 'stepUp', 'kbDeadlift15', 'gluteBridge']),
      blockCycle('Jumps, wall sits & bridges', ['squatJump', 'wallSit', 'cossackSquat', 'singleLegBridge'])
    ]
  },
  {
    id: 'upper-storm', name: 'Upper Storm', tagline: 'Press, pull, push',
    focus: 'upper-body', blurb: 'Four blocks across the upper body: press, row, push, hold.',
    format: 'tabata', blockRestSec: 30,
    blocks: [
      blockCycle('Barbell press, rows & planks', ['barbellPress', 'plankHold', 'barbellRow', 'plankShoulderTaps']),
      blockCycle('Rows & push-up mix', ['ringRow', 'pushup', 'ringPushup', 'pikePushup']),
      blockSwap('Dumbbell press', 'dbPressHeavy', 'dbPressLight'),
      blockCycle('Dips, curls & raises', ['ringDip', 'dbCurl', 'tricepDips', 'dbLateralRaise'])
    ]
  },
  {
    id: 'engine-builder', name: 'Engine Builder', tagline: 'Build the cardio engine',
    focus: 'whole-body', blurb: 'Five blocks of mixed strength and conditioning. Steady, deliberate, hard.',
    format: 'tabata', blockRestSec: 45,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Push-ups, climbers & crawls', ['pushup', 'mountainClimber', 'bearCrawl', 'jumpingJacks']),
      blockAlt('Burpees & plank', 'burpee', 'plankHold'),
      // dbCurl and renegadeRow used to land on adjacent entries, which
      // handed both people the dumbbells in the same round.
      blockCycle('Rows, curls & pulls', ['ringRow', 'dbCurl', 'supermanPull', 'renegadeRow'])
    ]
  },
  {
    id: 'driveway-demon', name: 'Driveway Demon', tagline: 'Sprint, swing, suffer',
    focus: 'whole-body', blurb: 'Six blocks of sprints, KBs, bodyweight and holds. Find some flat ground to sprint on.',
    format: 'tabata', blockRestSec: 45,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockAlt('Sprints & KB hold', 'sprint', 'kbRackHold15'),
      blockCycle('Climbers, skaters & crawls', ['mountainClimberFast', 'skaterHops', 'highKnees', 'bearCrawl']),
      blockAlt('Push-ups & plank', 'pushup', 'plankHold'),
      blockAlt('Ring rows & hollow rocks', 'ringRow', 'hollowRocks')
    ]
  },
  {
    id: 'backyard-strength', name: 'Backyard Strength', tagline: 'The full original',
    focus: 'whole-body', blurb: 'Eight blocks across every movement pattern. The full workout.',
    format: 'tabata', blockRestSec: 60,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockAlt('Ring rows & push-ups', 'ringRow', 'pushup'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Skipping & push-up mix', ['skipping', 'pushup', 'inchworm', 'pikePushup']),
      blockAlt('Barbell press & plank', 'barbellPress', 'plankHold'),
      blockAlt('Sprints & KB hold', 'sprint', 'kbRackHold15'),
      blockAlt('Ring hangs & suitcase carry', 'ringTuckHold', 'dbSuitcaseCarry'),
      blockCleanPress()
    ]
  },
  {
    id: 'power-hour', name: 'Power Hour', tagline: 'Every muscle, every toy',
    focus: 'whole-body', blurb: 'Ten blocks using the whole kit: squats, swings, presses, rows, sprints. The big one.',
    format: 'tabata', blockRestSec: 60,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockCycle('Rows & push-up mix', ['ringRow', 'pushup', 'ringPushup', 'pikePushup']),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Barbell press, rows & planks', ['barbellPress', 'plankHold', 'barbellRow', 'plankShoulderTaps']),
      blockAlt('Sprints & KB hold', 'sprint', 'kbRackHold15'),
      blockCycle('Skipping & core', ['skipping', 'hollowRocks', 'highKnees', 'bicycleCrunch']),
      blockSwap('Dumbbell press', 'dbPressHeavy', 'dbPressLight'),
      blockCycle('Lunges, step-ups & hinges', ['dbLunge', 'stepUp', 'kbDeadlift15', 'gluteBridge']),
      blockAlt('Ring dips & DB curls', 'ringDip', 'dbCurl'),
      blockCleanPress()
    ]
  },
  {
    id: 'long-haul', name: 'The Long Haul', tagline: 'Sixty minutes of engine',
    focus: 'whole-body', blurb: 'Ten blocks of near-nonstop conditioning: jumps, sprints, skips, crawls. Pace yourself.',
    format: 'tabata', blockRestSec: 60,
    blocks: [
      blockCycle('Jacks, knees & skaters', ['jumpingJacks', 'highKnees', 'skaterHops', 'mountainClimber']),
      blockAlt('Burpees & plank', 'burpee', 'plankHold'),
      blockCycle('Skipping & squats', ['skipping', 'airSquat', 'highKnees', 'squatJump']),
      blockAlt('Sprints & wall sit', 'sprint', 'wallSit'),
      blockCycle('Climbers & core burners', ['mountainClimberFast', 'bicycleCrunch', 'flutterKicks', 'plankShoulderTaps']),
      blockAlt('Squat jumps & push-ups', 'squatJump', 'pushup'),
      blockCycle('Crawls & bridges', ['bearCrawl', 'gluteBridge', 'inchworm', 'singleLegBridge']),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockAlt('Skipping & hollow rocks', 'skipping', 'hollowRocks'),
      blockCycle('Burpee finishers', ['burpee', 'russianTwistBw', 'skaterHops', 'supermanPull'])
    ]
  }
];

// ---------------------------------------------------------------------
// STRETCH ROUTINES
// ---------------------------------------------------------------------
const STRETCH_ROUTINES = [
  {
    id: 'sunrise-stretch', name: 'Sunrise Stretch', tagline: 'Open up the day',
    focus: 'stretching', blurb: 'Slow mobility. Hold and breathe, wake the body up.',
    format: 'stretch', hold: 60,
    ids: ['forwardFold', 'downDog', 'lowLungeL', 'lowLungeR', 'pigeonL', 'pigeonR',
          'childsPose', 'cobra', 'catCow', 'neckRolls', 'chestOpener']
  },
  {
    id: 'cool-mobile', name: 'Cool & Mobile', tagline: 'Recovery & mobility',
    focus: 'stretching', blurb: 'Full-body mobility flow, perfect after a workout or before bed.',
    format: 'stretch', hold: 60,
    ids: ['catCow', 'threadNeedleL', 'threadNeedleR', 'downDog', 'lowLungeL', 'lowLungeR',
          'pigeonL', 'pigeonR', 'seatedFold', 'spinalTwistL', 'spinalTwistR',
          'hip9090L', 'hip9090R', 'frog', 'bridgeHold', 'happyBaby', 'savasana']
  },
  {
    id: 'surf-mobility', name: 'Surf Mobility', tagline: 'Hips, upper back, shoulders, ankles',
    focus: 'stretching', blurb: 'What paddling and a low stance need: open hips and shoulders, a turning upper back and ankles that bend. Good after a surf too.',
    format: 'stretch', hold: 45,
    ids: ['catCow', 'threadNeedleL', 'threadNeedleR', 'chestOpener', 'cobra', 'lowLungeL', 'lowLungeR',
          'hip9090L', 'hip9090R', 'pigeonL', 'pigeonR', 'calfWall', 'quadKneel', 'childsPose']
  },
  {
    id: 'post-session', name: 'Post-Session Reset', tagline: 'Ten minutes, straight after',
    focus: 'stretching', blurb: 'Short and targeted: the bits that tighten up after a hard session.',
    format: 'stretch', hold: 45,
    ids: ['forwardFold', 'quadKneel', 'hamstringL', 'hamstringR', 'calfWall',
          'lowLungeL', 'lowLungeR', 'chestOpener', 'tricepReach', 'wristCircles',
          'spinalTwistL', 'spinalTwistR', 'savasana']
  }
];

// Expand a stretch routine's ids into the phase shape the timer wants.
function stretchList(routine) {
  return routine.ids.map(id => {
    const s = STRETCHES.find(x => x.id === id);
    return s ? { name: s.name, alt: s.alt, hold: routine.hold }
             : { name: id, alt: '', hold: routine.hold };
  });
}

// ---------------------------------------------------------------------
// WARM-UP AND COOL-DOWN
// The warm-up is a few real moves with figures, filling exactly the
// seconds the plan gives it (as little as a minute on a short session):
// something easy to get the blood moving, the hips, the upper back
// turning, the shoulders, then a light go at the session's first move. A
// surf session always gets shoulder prep and a slow pop-up, the pop-up
// last. The cool-down is stretches for what was worked, standing ones
// first.
//
// Both are worked out from the session itself (its blocks, its goal, the
// gear and the leave-outs), never from the generator's random numbers, so
// a favourite or a link builds the same main blocks it always did, and the
// same warm-up with them. Nothing jumps or runs. Two people do each move
// together, so nothing needs gear there's only one of (bands come as a
// set). How many moves there are depends only on the seconds, so a
// session picked up after a reload lines up with the one that was saved.
// ---------------------------------------------------------------------
// The warm-up's own cue for each move it uses: easy, not a work set.
const WARMUP_CUES = {
  squatReach: 'Easy pace, reach long and get the blood moving',
  airSquat: 'Slow and easy, a little deeper each time',
  reverseLunge: 'Easy steps back, alternate legs',
  inchworm: 'Walk the hands out slowly, no push-up',
  lateralLunge: 'Shallow to start, a little lower each side',
  goodMorning: 'Soft knees, hinge back and feel the hamstrings',
  deepSquatHold: 'Sit low and rock gently side to side',
  calfRaises: 'Easy, up onto the toes and down',
  thoracicRotation: 'Slow, follow the top hand with your eyes',
  bandPullApart: 'Light band, slow and controlled',
  bandExternalRotation: 'Light band, elbow pinned, rotate out slowly',
  supermanYtw: 'Light and slow, squeeze the shoulder blades',
  scapPushup: 'Small movement, just the shoulder blades',
  proneSwimmer: 'Slow sweeps, thumbs up',
  pushup: 'A few easy reps, knees down is fine',
  bandRow: 'Light band, squeeze the shoulder blades',
  supermanPull: 'Slow sweeps, chest just off the floor',
  bandOverheadPress: 'Light band, easy presses',
  birdDog: 'Slow, reach long, no wobble',
  deadBug: 'Slow, ribs down',
  popUp: 'Slow and smooth: hands under the chest, up to your stance',
  surfStanceHold: 'Easy, shift from foot to foot'
};
// What each part of the warm-up can be, best first.
const WARMUP_SLOTS = {
  pulse: ['squatReach', 'airSquat'],
  pulse2: ['inchworm', 'reverseLunge', 'airSquat'],
  hips: ['lateralLunge', 'deepSquatHold', 'goodMorning'],
  hips2: ['goodMorning', 'deepSquatHold', 'reverseLunge'],
  thoracic: ['thoracicRotation'],
  shoulders: ['bandPullApart', 'supermanYtw', 'scapPushup'],
  shoulders2: ['scapPushup', 'proneSwimmer', 'bandPullApart'],
  popup: ['popUp', 'surfStanceHold']
};
// a surfer's shoulders get the rotator cuff first
const WARMUP_SURF_SLOTS = { ...WARMUP_SLOTS, shoulders: ['bandExternalRotation', 'supermanYtw', 'scapPushup'] };
// A light go at a block's movement pattern, by the pattern of its first move.
const WARMUP_REHEARSAL = {
  squat: ['airSquat'], hinge: ['goodMorning'], lunge: ['reverseLunge'],
  pushH: ['pushup', 'scapPushup'], pushV: ['bandOverheadPress', 'scapPushup'],
  pullH: ['bandRow', 'supermanPull'], pullV: ['bandRow', 'supermanPull'],
  coreAnti: ['birdDog', 'deadBug'], coreFlex: ['deadBug', 'birdDog'], coreRot: ['thoracicRotation', 'birdDog'],
  coreLat: ['birdDog'], crawl: ['inchworm', 'birdDog'], carry: ['goodMorning'], cardio: ['inchworm', 'squatReach']
};
// When a part has nothing left that fits: standing, no gear.
const WARMUP_FALLBACK = ['squatReach', 'airSquat', 'goodMorning', 'reverseLunge', 'lateralLunge', 'calfRaises', 'deepSquatHold'];
// The order the parts run in, each with its rank: the fewer moves there's
// time for, the more of the low-ranked ones are dropped.
const WARMUP_ORDER = {
  general: [['pulse', 1], ['pulse2', 6], ['hips', 3], ['hips2', 7], ['thoracic', 5], ['shoulders', 4], ['rehearse', 2], ['rehearse2', 8]],
  surf: [['pulse', 4], ['pulse2', 8], ['hips', 5], ['thoracic', 3], ['shoulders', 1], ['shoulders2', 6], ['rehearse', 7], ['popup', 2]]
};
// The cool-down's stretches for each area, best first; a pair is the two
// sides of one, which run back to back.
const COOLDOWN_STRETCHES = {
  legs: [['forwardFold'], ['quadKneel'], ['hamstringL', 'hamstringR'], ['calfWall'], ['seatedFold']],
  hips: [['lowLungeL', 'lowLungeR'], ['pigeonL', 'pigeonR'], ['hip9090L', 'hip9090R'], ['frog'], ['happyBaby']],
  shoulders: [['chestOpener'], ['threadNeedleL', 'threadNeedleR'], ['tricepReach'], ['neckRolls'], ['wristCircles']],
  back: [['childsPose'], ['spinalTwistL', 'spinalTwistR'], ['cobra'], ['catCow']]
};
// How much each body region worked asks of each area.
const COOLDOWN_AREAS = {
  legs: { legs: 2, hips: 1 }, push: { shoulders: 2 }, pull: { shoulders: 1, back: 1 },
  core: { back: 2, hips: 1 }, cardio: { legs: 1, hips: 1 }
};
// the cool-down's cue for the ones that aren't a hold
const COOLDOWN_CUES = {
  savasana: 'Lie back, slow deep breaths', catCow: 'Slow, with the breath',
  neckRolls: 'Slow circles, both ways', wristCircles: 'Circle both ways, then shake them out'
};
const MOVE_SEC = 45;            // about how long each warm-up move or stretch runs

// How many moves fit: about 45 seconds each, so a minute is two.
const bookendCount = (sec, most) => Math.min(most, Math.max(1, Math.ceil(sec / MOVE_SEC)));
// `total` seconds in `n` parts, in steps of five where it can, adding up
// exactly; any longer ones come first.
function splitSeconds(total, n) {
  const base = Math.floor(total / n / 5) * 5 || Math.floor(total / n);
  const out = Array(n).fill(base);
  let left = total - base * n;
  for (let i = 0; left > 0; i = (i + 1) % n) {
    const add = Math.min(5, left);
    out[i] += add;
    left -= add;
  }
  return out;
}
// What a warm-up move may be: on hand, not left out, nothing that jumps or
// runs, and nothing there's only one of. opts = { hasEquip, blockedTags,
// excluded }.
function bookendFits(opts) {
  const has = (opts && opts.hasEquip) || (() => true);
  const blocked = new Set((opts && opts.blockedTags) || []);
  const excluded = new Set((opts && opts.excluded) || []);
  return (id) => {
    const ex = EXERCISES[id];
    return !!ex && !excluded.has(id) && !ex.tags.some(t => t === 'impact' || t === 'running' || blocked.has(t))
      && ex.equipment.every(e => !SINGLE_INSTANCE.includes(e) && has(e));
  };
}
// The warm-up for a workout: [{ id, sec }] in the order they run, where id
// is null for a part nothing fits (it shows the plain card).
function warmupPlan(w, opts) {
  const sec = (w && w.warmupSec) || 0;
  if (!(sec > 0) || !Array.isArray(w.blocks)) return [];
  const fits = bookendFits(opts);
  const surf = !!(w.request && w.request.goal === 'surf');
  const slots = surf ? WARMUP_SURF_SLOTS : WARMUP_SLOTS;
  const order = WARMUP_ORDER[surf ? 'surf' : 'general'];
  const n = bookendCount(sec, order.length);
  const patternOf = (b) => b && b.ids && EXERCISES[b.ids[0]] ? EXERCISES[b.ids[0]].pattern : null;
  const rehearse = (b) => WARMUP_REHEARSAL[patternOf(b)] || [];
  const candidates = (slot) => slot === 'rehearse' ? rehearse(w.blocks[0])
    : slot === 'rehearse2' ? rehearse(w.blocks[1] || w.blocks[0]) : slots[slot];
  // the most important parts choose first, so they get the best moves
  const picked = new Map(), taken = new Set();
  order.slice().sort((a, b) => a[1] - b[1]).slice(0, n).forEach(([slot]) => {
    const id = [...candidates(slot), ...WARMUP_FALLBACK]
      .find(x => fits(x) && ![...taken].some(t => EXERCISES[t].img === EXERCISES[x].img)) || null;
    if (id) taken.add(id);
    picked.set(slot, id);
  });
  const shown = order.filter(([slot]) => picked.has(slot));
  const secs = splitSeconds(sec, shown.length);
  return shown.map(([slot], i) => ({ id: picked.get(slot), sec: secs[i] }));
}
// The cool-down for a workout: [{ id, sec }] in the order they run, one
// stretch each, the two sides of one stretch back to back (and id null for
// a part nothing fits, which shows the plain card). Stretches for the areas
// the blocks worked hardest come up most, standing ones only with No floor
// work, and a long cool-down ends on deep breathing.
function cooldownPlan(w, opts) {
  const sec = (w && w.cooldownSec) || 0;
  if (!(sec > 0) || !Array.isArray(w.blocks)) return [];
  const floorOk = !((opts && opts.blockedTags) || []).includes('floor');
  const byId = (id) => STRETCHES.find(s => s.id === id);
  const usable = (u) => u.every(id => byId(id) && (floorOk || byId(id).pos === 'stand'));
  const areas = Object.keys(COOLDOWN_STRETCHES);
  const score = Object.fromEntries(areas.map(a => [a, 0]));
  w.blocks.forEach(b => (b.ids || []).forEach(id => {
    const ex = EXERCISES[id];
    if (ex) ex.regions.forEach((r, i) => Object.entries(COOLDOWN_AREAS[r] || {}).forEach(([a, k]) => { score[a] += k * (i ? 1 : 2); }));
  }));
  const slots = bookendCount(sec, 10);
  const closer = floorOk && slots >= 6 ? ['savasana'] : null;
  let left = slots - (closer ? 1 : 0);
  // each pick goes to the area with the most worked per stretch it already
  // has, so a leg day gets mostly leg and hip stretches
  const chosen = [], taken = Object.fromEntries(areas.map(a => [a, 0]));
  while (left > 0) {
    let best = null;
    for (const a of areas) {
      const u = COOLDOWN_STRETCHES[a].find(x => !chosen.includes(x) && usable(x) && x.length <= left);
      const pull = (score[a] + 0.1) / (taken[a] + 1);
      if (u && (!best || pull > best.pull)) best = { a, u, pull };
    }
    if (!best) break;
    chosen.push(best.u);
    taken[best.a]++;
    left -= best.u.length;
  }
  const rank = { stand: 0, kneel: 1, floor: 2 };
  const run = chosen.map((u, i) => ({ u, i })).sort((x, y) => rank[byId(x.u[0]).pos] - rank[byId(y.u[0]).pos] || x.i - y.i)
    .flatMap(x => x.u);
  // nothing left that fits: the plain card, so there are always as many
  // parts as the seconds call for
  while (run.length < slots - (closer ? 1 : 0)) run.push(null);
  if (closer) run.push(...closer);
  const secs = splitSeconds(sec, slots);
  // the two sides of a stretch get the same time, give or take a second
  run.forEach((id, i) => {
    const s = id && byId(id);
    if (s && /, left$/.test(s.name) && run[i + 1]) {
      const both = secs[i] + secs[i + 1];
      secs[i] = Math.ceil(both / 2);
      secs[i + 1] = both - secs[i];
    }
  });
  return run.map((id, i) => ({ id, sec: secs[i] }));
}
// What a warm-up move's card shows: the move and its figure, with the
// warm-up's easy cue, and a halfway swap for a one-sided move.
function warmupCard(id, sec) {
  const ex = id && EXERCISES[id];
  if (!ex) return { ...warmupExercise, display: warmupExercise.name, reps: '' };
  let cue = WARMUP_CUES[id] || ex.cue || '';
  if (ex.sideCue) cue = `${cue} · swap sides at ${Math.round(sec / 2)}s`;
  return { id, name: ex.name, display: ex.name, load: '', cue, reps: '', alt: ex.alt || '', img: ex.img || null };
}
// And a cool-down stretch's: a hold, with no figure.
function cooldownCard(id) {
  const s = id && STRETCHES.find(x => x.id === id);
  if (!s) return { ...cooldownExercise, display: cooldownExercise.name, reps: '' };
  return { name: s.name, display: s.name, cue: COOLDOWN_CUES[id] || 'Ease in and breathe slowly', reps: '', alt: s.alt || '', img: null };
}

// ---------------------------------------------------------------------
// PROGRAMS
// A program is a run of daily sessions planned ahead: a week of day
// templates repeated, with the rep targets building over the weeks. Each
// day builds through the same generator as everything else, so it fits the
// time, gear and number of people on the day. Progress moves on when a day
// is done, not by the calendar, so a missed day waits for you.
//   day: { name, short (for the week strip), about, style | mix, focus (the surf rhythm to lean on),
//          minutes (the suggestion) }  or  { name, about, stretch: id }
// ---------------------------------------------------------------------
const PROGRAMS = [
  {
    id: 'surf-fit', name: 'Surf Fit', weeks: 6, goal: 'surf',
    tagline: 'Six weeks back to paddle fitness',
    blurb: 'A session a day for surfers whose fitness has slipped: paddling stamina, a pop-up that beats the wave, and legs that hold a turn. Hard days, easy days and mobility, so every day is doable.',
    // reps start lighter and build: weeks 1 to 6
    repScale: [0.8, 0.9, 1, 1, 1.1, 1.1],
    // and the timed days work longer and rest less: [work, rest] seconds,
    // weeks 1 to 6, each still a four-minute block
    workRest: {
      long:  [[30, 30], [35, 25], [40, 20], [40, 20], [45, 15], [45, 15]],
      short: [[15, 15], [20, 10], [20, 10], [20, 10], [25, 5], [25, 5]]
    },
    days: [
      { name: 'Paddle power', short: 'Paddle', style: 'long', focus: 'paddle', minutes: 20,
        about: 'Long efforts on paddling strength and stamina: rows, swimmers, prone paddling. The muscles that get you out the back.' },
      { name: 'Pop-ups & legs', short: 'Pop-ups', style: 'short', focus: 'popup', minutes: 20,
        about: 'Short, sharp bursts on getting to your feet fast and staying low: pop-ups, jumps, stance work.' },
      { name: 'Mobility', short: 'Mobility', stretch: 'surf-mobility',
        about: 'Hips, upper back, shoulders and ankles. Easy holds, no timer pressure.' },
      { name: 'Engine', short: 'Engine', mix: ['emom', 'amrap'], minutes: 25,
        about: 'An EMOM then an AMRAP finisher. Fitness for a long session and the paddle back out after a set.' },
      { name: 'Paddle & shoulders', short: 'Paddle', style: 'emom', focus: 'paddle', minutes: 20,
        about: 'Paddling strength with shoulder care built in, every minute on the minute.' },
      { name: 'Pop-ups & turns', short: 'Turns', style: 'fortime', focus: 'popup', minutes: 20,
        about: 'Race the clock through pop-ups, turns and rotation. Fast feet when you\'re tired, like the end of a ride.' },
      { name: 'Easy day', short: 'Easy', stretch: 'cool-mobile',
        about: 'Recovery and a long stretch. Or go for a surf.' }
    ]
  }
];
// The template, week (1-based), rep scale and timed splits (see
// withWorkRest) for day n (0-based) of a program.
function programDay(prog, n) {
  const week = Math.min(prog.weeks, Math.floor(n / prog.days.length) + 1);
  const day = prog.days[n % prog.days.length];
  const ladder = prog.workRest || {};
  const timed = (day.mix || (day.style ? [day.style] : [])).filter(id => ownKey(ladder, id));
  const workRest = timed.length ? Object.fromEntries(timed.map(id => [id, ladder[id][week - 1].slice()])) : undefined;
  return { ...day, n, week, repScale: prog.repScale[week - 1] || 1, workRest };
}
// The style a day runs in at this length: its own, or its mix. A mix that
// won't fit the minutes runs as its first style on its own, so a short day
// is still a session rather than a refusal.
function programStyle(day, minutes) {
  if (!day.mix) return { intervalId: day.style };
  const min = mixMinimumMinutes(day.mix);
  if (min && minutes >= min) return { intervalId: 'mix', mix: day.mix.slice() };
  return { intervalId: day.mix[0], short: true };
}

