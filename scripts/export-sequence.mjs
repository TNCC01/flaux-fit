/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  Export a workout's expanded timed sequence as JSON.

  This exists so nothing downstream (the Garmin work, in particular) has to
  keep a hand-copied duplicate of the exercise dictionary, copies go stale
  the moment the library changes. Ask this script instead; it reads the same
  source the app runs on.

  Usage:
    node scripts/export-sequence.mjs --list
    node scripts/export-sequence.mjs power-hour
    node scripts/export-sequence.mjs power-hour --interval long --people 2
    node scripts/export-sequence.mjs --generate --minutes 30 --regions legs,core
*/
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = ['js/exercises.js', 'js/workouts.js', 'js/generator.js'];

function loadApp() {
  const src = SRC.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const names = [...src.matchAll(/^const ([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m => m[1]);
  const fns = [...src.matchAll(/^function ([A-Za-z_][A-Za-z0-9_]*)/gm)].map(m => m[1]);
  return new Function(`${src}\nreturn {${[...new Set([...names, ...fns])].join(',')}};`)();
}

const A = loadApp();
const { EXERCISES, INTERVALS, DEFAULT_EQUIPMENT, DEFAULT_INTERVAL, CLASSICS,
        STRETCH_ROUTINES, REGIONS, stretchList, describeEx, generateWorkout,
        bookends, blockSeconds } = A;

// --- args -------------------------------------------------------------
const argv = process.argv.slice(2);
const VALUE_FLAGS = ['interval', 'people', 'minutes', 'regions', 'seed'];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);
// The workout id is the first bare argument that isn't a flag's value.
const target = argv.find((a, i) =>
  !a.startsWith('--') && !VALUE_FLAGS.some(f => argv[i - 1] === `--${f}`));

if (has('list')) {
  console.log('tabata:');
  CLASSICS.forEach(w => console.log(`  ${w.id.padEnd(20)} ${w.blocks.length} blocks, ${w.name}`));
  console.log('stretch:');
  STRETCH_ROUTINES.forEach(w => console.log(`  ${w.id.padEnd(20)} ${w.ids.length} holds, ${w.name}`));
  process.exit(0);
}

const intervalId = INTERVALS[flag('interval', DEFAULT_INTERVAL)] ? flag('interval', DEFAULT_INTERVAL) : DEFAULT_INTERVAL;
const people = Number(flag('people', 1));
const iv = INTERVALS[intervalId];
const ctx = { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, hasEquip: () => true };

// --- pick the workout -------------------------------------------------
let workout;
if (has('generate')) {
  const minutes = Number(flag('minutes', 30));
  const regions = flag('regions', REGIONS.map(r => r.id).join(',')).split(',');
  workout = generateWorkout({
    minutes, people, intervalId, regions,
    equipment: { ...DEFAULT_EQUIPMENT }, excluded: [], blockedTags: [],
    seed: Number(flag('seed', 1)), recent: []
  });
  if (workout.error) { console.error(workout.error); process.exit(1); }
} else {
  const id = target;
  workout = CLASSICS.find(w => w.id === id) || STRETCH_ROUTINES.find(w => w.id === id);
  if (!workout) {
    console.error(`unknown workout "${id}", try --list`);
    process.exit(1);
  }
  if (workout.format === 'tabata' && workout.warmupSec === undefined) {
    // Classics derive their bookends at runtime; do the same here.
    const workSec = workout.blocks.length * 240 + (workout.blocks.length - 1) * workout.blockRestSec;
    const b = bookends(Math.round(workSec / 60) + 8);
    workout.warmupSec = b.warmupSec;
    workout.cooldownSec = b.cooldownSec;
  }
}

// --- expand -----------------------------------------------------------
// Mirrors buildSequence() in js/app.js. Each step maps to one Garmin
// WorkoutStepMesg: duration_time = seconds, wkt_step_name = name,
// intensity from `intensity` below.
const INTENSITY = { warmup: 'warmup', work: 'active', rest: 'rest',
                    blockrest: 'rest', cooldown: 'cooldown', stretch: 'active' };
const steps = [];
const push = (kind, seconds, name, note) =>
  steps.push({ kind, intensity: INTENSITY[kind], seconds, name, note });

if (workout.format === 'tabata') {
  if (workout.warmupSec > 0) push('warmup', workout.warmupSec, 'Warm-up', 'Easy movement');
  workout.blocks.forEach((block, bi) => {
    for (let r = 1; r <= iv.rounds; r++) {
      const a = people === 2 ? block.duo(r, ctx).a : block.solo(r, ctx);
      const b = people === 2 ? block.duo(r, ctx).b : null;
      push('work', iv.workSec, a.display, b ? `B: ${b.display}` : a.cue);
      push('rest', iv.restSec, 'Rest', `Block ${bi + 1} round ${r}`);
    }
    if (bi < workout.blocks.length - 1) {
      push('blockrest', workout.blockRestSec, 'Block rest',
           `Next: ${workout.blocks[bi + 1].name}`);
    }
  });
  if (workout.cooldownSec > 0) push('cooldown', workout.cooldownSec, 'Cool-down', 'Walk and stretch');
} else {
  stretchList(workout).forEach(s => push('stretch', s.hold, s.name, s.alt));
}

const total = steps.reduce((s, x) => s + x.seconds, 0);
console.log(JSON.stringify({
  id: workout.id,
  name: workout.name,
  format: workout.format,
  interval: { id: iv.id, label: iv.label, rounds: iv.rounds,
              workSec: iv.workSec, restSec: iv.restSec },
  people,
  totalSeconds: total,
  totalMinutes: Math.round(total / 60),
  stepCount: steps.length,
  steps
}, null, 2));
