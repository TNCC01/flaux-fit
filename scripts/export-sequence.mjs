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
    node scripts/export-sequence.mjs power-hour --interval emom --gear kb15,kb10
    node scripts/export-sequence.mjs --generate --minutes 30 --regions legs,core
    node scripts/export-sequence.mjs --generate --minutes 30 --interval mix --mix emom,short,amrap

  --interval is short, long, emom, amrap, fortime, or mix (generated only).
  --gear lists what's on hand (none for bodyweight); everything by default.
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
const { EQUIPMENT, INTERVALS, DEFAULT_EQUIPMENT, DEFAULT_INTERVAL, CLASSICS,
        STRETCH_ROUTINES, REGIONS, CHANGEOVER_SEC, stretchList, generateWorkout,
        classicBookends, sectionInterval, amrapCircuits, forTimeRounds } = A;

const die = (msg) => { console.error(msg); process.exit(1); };

// --- args -------------------------------------------------------------
const argv = process.argv.slice(2);
const VALUE_FLAGS = ['interval', 'people', 'minutes', 'regions', 'seed', 'mix', 'gear'];
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

const intervalId = flag('interval', DEFAULT_INTERVAL);
if (!INTERVALS[intervalId] && intervalId !== 'mix') {
  die(`unknown interval "${intervalId}": use ${Object.keys(INTERVALS).join(', ')} or mix`);
}
const mix = flag('mix', 'emom,short,amrap').split(',');
if (intervalId === 'mix' && (mix.length < 2 || mix.length > 3 || mix.some(id => !INTERVALS[id]) || new Set(mix).size !== mix.length)) {
  die(`--mix takes two or three different styles from ${Object.keys(INTERVALS).join(', ')}, got "${mix.join(',')}"`);
}
const people = Number(flag('people', 1));
if (people !== 1 && people !== 2) die(`--people is 1 or 2, got "${flag('people')}"`);

// The gear on hand, as the app's switches: the generator picks to suit it
// and the cards fall back to bodyweight for anything switched off.
const gear = flag('gear', null);
const equipment = { ...DEFAULT_EQUIPMENT };
if (gear) {
  const on = gear === 'none' ? [] : gear.split(',');
  const bad = on.filter(id => !EQUIPMENT[id]);
  if (bad.length) die(`unknown gear "${bad.join(',')}": use ${Object.keys(EQUIPMENT).join(', ')} or none`);
  Object.keys(EQUIPMENT).forEach(id => { equipment[id] = on.includes(id); });
}
const hasEquip = (id) => equipment[id] !== false;

// --- pick the workout -------------------------------------------------
let workout;
if (has('generate')) {
  const minutes = Number(flag('minutes', 30));
  const regions = flag('regions', REGIONS.map(r => r.id).join(',')).split(',');
  workout = generateWorkout({
    minutes, people, intervalId, mix: intervalId === 'mix' ? mix : undefined, regions,
    equipment, excluded: [], blockedTags: [],
    seed: Number(flag('seed', 1)), recent: []
  });
  if (workout.error) die(workout.error);
} else {
  const id = target;
  workout = CLASSICS.find(w => w.id === id) || STRETCH_ROUTINES.find(w => w.id === id);
  if (!workout) die(`unknown workout "${id}", try --list`);
  if (intervalId === 'mix') die('a classic runs in one style; a mix is built by the generator: use --generate --interval mix');
  if (workout.format === 'tabata' && workout.warmupSec === undefined) {
    // Classics derive their bookends at runtime; do the same here.
    Object.assign(workout, classicBookends(workout));
  }
}

// --- expand -----------------------------------------------------------
// Mirrors buildSequence() in js/app.js. Each step maps to one Garmin
// WorkoutStepMesg: duration_time = seconds, wkt_step_name = name,
// intensity from `intensity` below.
const INTENSITY = { warmup: 'warmup', work: 'active', rest: 'rest', blockrest: 'rest',
                    changeover: 'rest', cooldown: 'cooldown', stretch: 'active' };
const steps = [];
const push = (kind, seconds, name, note, extra) =>
  steps.push({ kind, intensity: INTENSITY[kind], seconds, name, note, ...extra });
// "Goblet squats · 15kg × 8 reps", the way a card reads with a rep target
const withReps = (ex) => ex.reps ? `${ex.display} × ${ex.reps}` : ex.display;
const lapList = (lap) => lap.map(withReps).join(', ');
const lapData = (lap) => lap.map(ex => ({ name: ex.display, reps: ex.reps }));

// The sections a workout runs as, as sectionsOf() in js/app.js: a mix's own
// list, or one section of the whole workout at the chosen interval.
const sections = workout.sections || (workout.format === 'tabata'
  ? [{ intervalId: workout.intervalId || intervalId, start: 0, count: workout.blocks.length,
       minutes: 0, blockRestSec: workout.blockRestSec }]
  : []);

if (workout.format === 'tabata') {
  if (workout.warmupSec > 0) push('warmup', workout.warmupSec, 'Warm-up', 'Easy movement');
  sections.forEach((sec, si) => {
    const iv = sectionInterval(sec);
    const ctx = { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, reps: !!iv.reps,
                  lap: !!iv.lap, hasEquip, repScale: workout.repScale };
    // between the sections of a mix: a longer break that says what's next
    if (si > 0) {
      push('changeover', workout.changeoverSec || CHANGEOVER_SEC, `Next: ${iv.label}`,
           `${iv.label}${sec.minutes ? `, ${sec.minutes} min` : ''}: ${iv.blurb}`);
    }
    workout.blocks.slice(sec.start, sec.start + sec.count).forEach((block, i) => {
      const bi = sec.start + i;
      if (iv.lap) {
        // AMRAP and For Time are one step for the whole block: each person
        // works through their lap, For Time for a set number of laps
        const c = amrapCircuits(block, ctx, people === 2);
        const laps = iv.forTime ? forTimeRounds(c.a.length, iv.workSec) : 0;
        const b = c.b ? `. B: ${lapList(c.b)}` : '';
        if (iv.forTime) {
          push('work', iv.workSec, `For Time ${laps} laps`,
               `${laps} laps of ${lapList(c.a)}${b}. Finish early and rest out the ${iv.workSec / 60} min cap.`,
               { laps, lap: lapData(c.a), lapB: c.b ? lapData(c.b) : undefined });
        } else {
          push('work', iv.workSec, `AMRAP ${iv.workSec / 60} min`,
               `As many laps as you can of ${lapList(c.a)}${b}`,
               { lap: lapData(c.a), lapB: c.b ? lapData(c.b) : undefined });
        }
      }
      for (let r = 1; !iv.lap && r <= iv.rounds; r++) {
        const a = people === 2 ? block.duo(r, ctx).a : block.solo(r, ctx);
        const b = people === 2 ? block.duo(r, ctx).b : null;
        // an EMOM's target is reps (or a timed hold) at the top of the minute
        const target = a.reps ? `${a.reps}, then rest out the minute` : '';
        push('work', iv.workSec, a.display,
             [target, b ? `B: ${withReps(b)}` : a.cue].filter(Boolean).join(' · '),
             a.reps ? { reps: a.reps } : undefined);
        // an EMOM's rest is whatever is left of the minute, not a step of its own
        if (iv.restSec > 0) push('rest', iv.restSec, 'Rest', `Block ${bi + 1} round ${r}`);
      }
      if (i < sec.count - 1) {
        push('blockrest', sec.blockRestSec, 'Block rest', `Next: ${workout.blocks[bi + 1].name}`);
      }
    });
  });
  if (workout.cooldownSec > 0) push('cooldown', workout.cooldownSec, 'Cool-down', 'Walk and stretch');
} else {
  stretchList(workout).forEach(s => push('stretch', s.hold, s.name, s.alt));
}

// a zero-length step would be a blip on the watch; the app never has one
const empty = steps.filter(s => !(s.seconds > 0));
if (empty.length) die(`internal: ${empty.length} step(s) with no length, first "${empty[0].name}"`);

const total = steps.reduce((s, x) => s + x.seconds, 0);
const ivOut = (iv) => ({ id: iv.id, label: iv.label, rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec });
console.log(JSON.stringify({
  id: workout.id,
  name: workout.name,
  format: workout.format,
  interval: workout.sections
    ? { id: 'mix', label: 'Mix', styles: workout.sections.map(x => x.intervalId) }
    : workout.format === 'tabata' ? ivOut(INTERVALS[sections[0].intervalId]) : null,
  sections: workout.sections
    ? workout.sections.map(x => ({ ...ivOut(sectionInterval(x)), blocks: x.count, minutes: x.minutes || undefined }))
    : undefined,
  people,
  totalSeconds: total,
  totalMinutes: Math.round(total / 60),
  stepCount: steps.length,
  steps
}, null, 2));
