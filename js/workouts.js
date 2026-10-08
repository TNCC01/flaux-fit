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

// ---------------------------------------------------------------------
// EXERCISE RESOLUTION
// ctx = { rounds, workSec, restSec, reps, lap, hasEquip }, where
// hasEquip(id) => bool, reps is true for the styles that count reps rather
// than seconds (EMOM, AMRAP, For Time) and lap for the two that work
// through the block as one list (AMRAP, For Time)
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

// Seconds of work in a timed EMOM target ('40s', '20s/side'), else 0.
function timedSec(v) {
  const m = /^(\d+)s(\/side)?$/.exec(typeof v === 'string' ? v : '');
  return m ? +m[1] * (m[2] ? 2 : 1) : 0;
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
  const target = ctx && ctx.lap ? amrapTarget(ex.emom) : ex.emom;
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
           display: load ? `${ex.name} · ${load}` : ex.name,
           alt: ex.alt || '', img: ex.img || null, adapted: ex.adapted };
}

// ---------------------------------------------------------------------
// BLOCK HELPERS
// Each returns { name, ids, duo(round, ctx), solo(round, ctx) }.
// ---------------------------------------------------------------------

// Both people do the same exercise, only safe when it needs no
// single-instance gear, which the self-check enforces.
function blockSame(name, exId) {
  return {
    name, ids: [exId], shape: 'same',
    duo: (r, ctx) => { const ex = describeEx(exId, ctx); return { a: ex, b: ex }; },
    solo: (r, ctx) => describeEx(exId, ctx)
  };
}

// Two exercises trade places between A and B each round; solo alternates
// them round by round.
function blockAlt(name, idA, idB) {
  return {
    name, ids: [idA, idB], shape: 'alt',
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
    name, ids, shape: 'cycle',
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
    name, ids: [heavyId, lightId], shape: 'swap',
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
    name, ids: [heavyId, lightId], shape: 'swap',
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

// The interval a section runs at: the style's own, with the plan's minutes
// as an EMOM's rounds or an AMRAP's or For Time's length.
function sectionInterval(sec) {
  const iv = INTERVALS[sec.intervalId] || INTERVALS[DEFAULT_INTERVAL];
  if (!sec.minutes) return iv;
  if (iv.lap) return { ...iv, workSec: sec.minutes * 60 };
  if (iv.reps) return { ...iv, rounds: sec.minutes };
  return iv;
}
const sectionSeconds = (sec) =>
  sec.count * blockSeconds(sectionInterval(sec)) + Math.max(0, sec.count - 1) * (sec.blockRestSec || 0);

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
    focus: 'whole-body', blurb: 'Six blocks of sprints, KBs, bodyweight and holds. Use the whole driveway.',
    format: 'tabata', blockRestSec: 45,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockAlt('Driveway sprint & KB hold', 'sprint', 'kbRackHold15'),
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
      blockAlt('Driveway sprint & KB hold', 'sprint', 'kbRackHold15'),
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
      blockAlt('Driveway sprint & KB hold', 'sprint', 'kbRackHold15'),
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
      blockAlt('Driveway sprint & wall sit', 'sprint', 'wallSit'),
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
