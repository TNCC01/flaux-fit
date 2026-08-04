#!/usr/bin/env node
// Generate Garmin structured-workout .FIT files from the workout library in
// index.html.  See GARMIN-HANDOFF.md for the data model (Route 1).
//
// Usage:  npm install   (once, to get the Garmin FIT SDK)
//         node scripts/generate-fit.mjs
// Output: garmin/<workout-id>.fit (one file per workout)
//
// The watch guides each interval and vibrates at every change. Files are built
// in solo mode (one person, all equipment present), exactly as the web app
// expands them via buildSequence(workout, 1). Repeated rounds collapse into
// FIT repeat steps to stay under the watch step cap.
//
// EXERCISE NAMES: a Forerunner 255 does NOT read a step's free-text name; it
// reads the name from a separate exercise_title (FIT mesg 264) record, matched
// to each step by the (exercise_category, exercise_name) pair. Confirmed by
// decoding genuine Garmin and known-working sideloaded strength .fit files. So
// each tabata work step is mapped to a real Garmin catalog exercise (EX_MAP)
// and we emit one exercise_title per distinct exercise; weight variants share
// an exercise and are told apart by exercise_weight. Tabata workouts use the
// strength sub-sport (which also gives the muscle-group graphic); stretch flows
// use unknown-category titles so every pose name shows verbatim. Per-exercise
// animations only exist for Garmin's premade workouts, not sideloaded ones.
//
// Encoded with Garmin's official FIT SDK; each file has a unique file_id so all
// import.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Encoder, Profile } from '@garmin/fitsdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'garmin');

// ---------------------------------------------------------------------
// 1. Extract and run the app's real workout code from index.html
// ---------------------------------------------------------------------
function loadApp() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sliceBetween = (from, to) => {
    const a = html.indexOf(from);
    const b = html.indexOf(to, a);
    if (a === -1 || b === -1) throw new Error(`Could not find region: ${from} .. ${to}`);
    return html.slice(a, b);
  };
  const regionA = sliceBetween('const EQUIPMENT = {', 'const state = {');
  const bStart = html.indexOf('const warmupExercise = {');
  const bRet = html.indexOf('return seq;', bStart);
  const bEnd = html.indexOf('}', bRet) + 1;
  if (bStart === -1 || bRet === -1) throw new Error('Could not find buildSequence region');
  const regionB = html.slice(bStart, bEnd);
  const src = `const state = { equipment: {} };\n${regionA}\n${regionB}\n` +
    'return { workouts, buildSequence, EXERCISES };';
  return new Function(src)();
}

// ---------------------------------------------------------------------
// 2. Garmin exercise catalog mapping (app exercise id -> catalog exercise)
// ---------------------------------------------------------------------
// [category, ...name candidates]. First candidate that exists in the SDK for
// that category wins. Validated at load; an unmapped exercise is a hard error.
const EX_MAP = {
  airSquat: ['squat', 'squat'], tempoSquat: ['squat', 'squat'],
  pushup: ['pushUp', 'pushUp'], burpee: ['totalBody', 'burpee'],
  jumpingJacks: ['cardio', 'jumpingJacks'], highKnees: ['warmUp', 'walkingHighKnees'],
  skaterHops: ['plyo', 'sideToSideShuffleJump'], bearCrawl: ['plank', 'bearCrawl'],
  inchworm: ['core', 'inchworm'], sprint: ['run', 'run'],
  squatReach: ['squat', 'overheadSquat'],
  mountainClimber: ['plank', 'mountainClimber'], mountainClimberFast: ['plank', 'mountainClimber'],
  reverseLunge: ['lunge', 'reverseLunge', 'lunge'], stepUp: ['squat', 'boxStepSquat'],
  squatJump: ['plyo', 'jumpSquat'], wallSit: ['squat', 'bodyWeightWallSquat'],
  gluteBridge: ['hipRaise', 'hipRaise'], singleLegBridge: ['hipRaise', 'singleLegHipRaise'],
  cossackSquat: ['lunge', 'lowSideToSideLunge'], calfRaises: ['calfRaise', 'standingCalfRaise'],
  goodMorning: ['deadlift', 'straightLegDeadlift'], pikePushup: ['pushUp', 'shoulderPushUp'],
  tricepDips: ['tricepsExtension', 'benchDip'], supermanPull: ['hyperextension', 'supermanFromFloor'],
  supermanHold: ['hyperextension', 'supermanFromFloor'], plankHold: ['plank', 'plank'],
  plankForearm: ['plank', 'plank'], plankRotation: ['plank', 'plank'],
  plankShoulderTaps: ['plank', 'plankWithArmRaise'], hollowHold: ['crunch', 'hollowRock'],
  hollowRocks: ['crunch', 'hollowRock'], vSit: ['sitUp', 'vUp'],
  deadBug: ['hipStability', 'deadBug'], birdDog: ['core', 'armAndLegExtensionOnKnees'],
  legRaises: ['legRaise', 'lyingStraightLegRaise'], bicycleCrunch: ['crunch', 'bicycleCrunch'],
  flutterKicks: ['crunch', 'flutterKicks'], sidePlankDips: ['plank', 'sidePlankLift', 'sidePlank'],
  russianTwistBw: ['core', 'russianTwist'], gobletSquat15: ['squat', 'gobletSquat'],
  gobletSquat10: ['squat', 'gobletSquat'], kbSwing15: ['hipRaise', 'kettlebellSwing'],
  kbSwing10: ['hipRaise', 'kettlebellSwing'], kbDeadlift15: ['deadlift', 'kettlebellDeadlift'],
  kbRackHold15: ['carry', 'hexDumbbellHold'], kbCleanPress15: ['shoulderPress', 'dumbbellPushPress'],
  kbCleanPress10: ['shoulderPress', 'dumbbellPushPress'], russianTwistKb: ['core', 'russianTwist'],
  barbellPress: ['shoulderPress', 'strictPress'], barbellRow: ['row', 'barbellRow'],
  dbPressHeavy: ['shoulderPress', 'dumbbellShoulderPress'], dbPressLight: ['shoulderPress', 'dumbbellShoulderPress'],
  dbLunge: ['lunge', 'dumbbellLunge'], dbRow: ['row', 'dumbbellRow'],
  dbCurl: ['curl', 'dumbbellBicepsCurl'], dbLateralRaise: ['lateralRaise', 'dumbbellLateralRaise'],
  renegadeRow: ['row', 'renegadeRow'], dbSuitcaseCarry: ['carry', 'farmersCarry'],
  skipping: ['cardio', 'jumpRope'], ringRow: ['row', 'ringRow', 'invertedRow'],
  ringPushup: ['pushUp', 'suspendedPushUp'], ringDip: ['tricepsExtension', 'suspendedDip', 'benchDip'],
  ringTuckHold: ['legRaise', 'hangingKneeRaise']
};

// Resolve each mapping to { category:<string>, exerciseName:<number> }, once.
function buildCatalog() {
  const t = Profile.types;
  const catExists = (cat) => Object.values(t.exerciseCategory).includes(cat);
  const nameNum = (cat, name) => {
    const e = t[cat + 'ExerciseName'];
    if (!e) return null;
    const hit = Object.entries(e).find(([, v]) => v === name);
    return hit ? Number(hit[0]) : null;
  };
  const byId = {};
  for (const [id, [cat, ...cands]] of Object.entries(EX_MAP)) {
    if (!catExists(cat)) throw new Error(`Unknown exercise category '${cat}' for ${id}`);
    let picked = null;
    for (const name of cands) {
      const n = nameNum(cat, name);
      if (n !== null) { picked = { category: cat, exerciseName: n }; break; }
    }
    if (!picked) throw new Error(`No catalog match for ${id}: [${cat}, ${cands.join(', ')}]`);
    byId[id] = picked;
  }
  return byId;
}

// ---------------------------------------------------------------------
// 3. Sequence -> compressed step list
// ---------------------------------------------------------------------
const MAX_NAME = 40;
const UNKNOWN_CATEGORY = 'unknown'; // for stretch poses with no catalog match

const clean = (s) => (s || '').replace(/\s+—\s+/g, ' - ').replace(/[—–]/g, '-').trim();
const shorten = (s, max = MAX_NAME) => {
  s = clean(s);
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
};
// Strip weight ("- 15kg KB") and arm ("(left arm)") so weight/arm variants of
// one movement share a single exercise_title; the weight field tells them apart.
const titleLabel = (task) => shorten(
  clean(task).replace(/\s*-\s*\d+\s*kg.*$/i, '').replace(/\s*\((left|right) arm\)\s*$/i, '').trim()
);
const weightKg = (task) => {
  const m = /(\d+)\s*kg/i.exec(task);
  return m ? Number(m[1]) : null;
};

const kindIntensity = (kind) => {
  if (kind === 'warmup') return 'warmup';
  if (kind === 'cooldown') return 'cooldown';
  if (kind === 'rest' || kind === 'blockrest') return 'rest';
  return 'active';
};

// Reverse map a work step's task back to its EXERCISES id (all equipment
// present => no bw adaptation; strip the clean&press arm suffix).
function buildTaskToId(EXERCISES) {
  const map = {};
  for (const [id, ex] of Object.entries(EXERCISES)) map[ex.task] = id;
  return (task) => map[task.replace(/\s*\((left|right) arm\)$/, '')] ?? null;
}

// Collapse a block's rounds into repeat groups (Same=1, Alt=2, Cycle=n; then
// two half-block periods for Swap=4+4 / alt-arm=2+2; else flat).
function periodGroup(items) {
  const n = items.length;
  for (let p = 1; p < n; p++) {
    if (n % p !== 0) continue;
    if (items.every((it, i) => it.key === items[i % p].key)) {
      return { items: items.slice(0, p), reps: n / p };
    }
  }
  return null;
}
function compressRounds(items) {
  const whole = periodGroup(items);
  if (whole) return [whole];
  if (items.length % 2 === 0) {
    const mid = items.length / 2;
    const h1 = periodGroup(items.slice(0, mid));
    const h2 = periodGroup(items.slice(mid));
    if (h1 && h2) return [h1, h2];
  }
  return items.map((it) => ({ items: [it], reps: 1 }));
}

// buildSequence(workout,1) -> flat FIT steps.
// work step:  { name, seconds, intensity, catId:{category,exerciseName}, title, weightKg }
// stretch:    { name, seconds, intensity, stretchTitle }
// other:      { name, seconds, intensity }
// repeat:     { repeatFrom, count }
function stepsFor(workout, buildSequence, catalog, taskToId, EXERCISES) {
  const seq = buildSequence(workout, 1);
  const steps = [];
  let i = 0;
  while (i < seq.length) {
    const e = seq[i];
    if (e.kind === 'work') {
      const pairs = [];
      while (i < seq.length && seq[i].kind === 'work') {
        const work = seq[i];
        const rest = seq[i + 1];
        const id = taskToId(work.a.task);
        if (!id || !catalog[id]) throw new Error(`No exercise mapping for "${work.a.task}" in ${workout.id}`);
        pairs.push({
          key: work.a.task, // arm-suffixed clean&press stays a distinct step
          name: shorten(work.a.task),
          catId: catalog[id],
          title: titleLabel(EXERCISES[id].task),
          weightKg: weightKg(work.a.task),
          workSec: work.duration, restSec: rest.duration
        });
        i += 2;
      }
      for (const group of compressRounds(pairs)) {
        const firstIdx = steps.length;
        for (const it of group.items) {
          steps.push({ name: it.name, seconds: it.workSec, intensity: 'active', catId: it.catId, title: it.title, weightKg: it.weightKg });
          steps.push({ name: 'Rest', seconds: it.restSec, intensity: 'rest' });
        }
        if (group.reps > 1) steps.push({ repeatFrom: firstIdx, count: group.reps });
      }
    } else if (e.kind === 'stretch') {
      steps.push({ name: shorten(e.a.task), seconds: e.duration, intensity: 'active', stretchTitle: shorten(e.a.task) });
      i += 1;
    } else {
      steps.push({ name: shorten(e.name), seconds: e.duration, intensity: kindIntensity(e.kind) });
      i += 1;
    }
  }
  return steps;
}

// ---------------------------------------------------------------------
// 4. Encode one workout file with the official FIT SDK
// ---------------------------------------------------------------------
const { MesgNum } = Profile;
const BASE_TIME = Date.UTC(2026, 6, 6, 0, 0, 0);

function encodeWorkout(workout, buildSequence, catalog, taskToId, EXERCISES, index) {
  const steps = stepsFor(workout, buildSequence, catalog, taskToId, EXERCISES);
  const subSport = workout.format === 'tabata' ? 'strengthTraining' : 'yoga';

  // Assign a catalog identity to every named step and collect exercise_titles.
  const titles = [];
  const byPair = new Map();      // "cat|exName" -> title
  const stretchExName = new Map(); // pose label -> exerciseName (unknown category)
  const ensureTitle = (category, exerciseName, label) => {
    const key = `${category}|${exerciseName}`;
    if (!byPair.has(key)) {
      const t = { messageIndex: titles.length, exerciseCategory: category, exerciseName, wktStepName: label };
      titles.push(t);
      byPair.set(key, t);
    }
  };
  for (const step of steps) {
    if (step.repeatFrom !== undefined) continue;
    if (step.catId) {
      step._category = step.catId.category;
      step._exerciseName = step.catId.exerciseName;
      ensureTitle(step._category, step._exerciseName, step.title);
    } else if (step.stretchTitle) {
      if (!stretchExName.has(step.stretchTitle)) stretchExName.set(step.stretchTitle, stretchExName.size);
      step._category = UNKNOWN_CATEGORY;
      step._exerciseName = stretchExName.get(step.stretchTitle);
      ensureTitle(step._category, step._exerciseName, step.stretchTitle);
    }
  }

  const enc = new Encoder();
  enc.onMesg(MesgNum.FILE_ID, {
    type: 'workout', manufacturer: 'development', product: 1,
    serialNumber: 0x464C0000 + index,
    timeCreated: new Date(BASE_TIME + index * 1000)
  });
  enc.onMesg(MesgNum.WORKOUT, {
    sport: 'training', subSport, numValidSteps: steps.length, wktName: workout.name
  });

  steps.forEach((step, i) => {
    if (step.repeatFrom !== undefined) {
      enc.onMesg(MesgNum.WORKOUT_STEP, {
        messageIndex: i, intensity: 'active',
        durationType: 'repeatUntilStepsCmplt', durationValue: step.repeatFrom,
        targetType: 'open', targetValue: step.count
      });
      return;
    }
    const mesg = {
      messageIndex: i, wktStepName: step.name, intensity: step.intensity,
      durationType: 'time', durationValue: step.seconds * 1000,
      targetType: 'open', targetValue: 0
    };
    if (step._category !== undefined) {
      mesg.exerciseCategory = step._category;
      mesg.exerciseName = step._exerciseName;
      if (step.weightKg) { mesg.exerciseWeight = step.weightKg; mesg.weightDisplayUnit = 'kilogram'; }
    }
    enc.onMesg(MesgNum.WORKOUT_STEP, mesg);
  });

  // exercise_title records (the name source the watch actually reads).
  for (const t of titles) enc.onMesg(MesgNum.EXERCISE_TITLE, t);

  return { bytes: enc.close(), stepCount: steps.length, titleCount: titles.length, steps };
}

function totalSeconds(steps) {
  let total = 0;
  steps.forEach((step, i) => {
    if (step.repeatFrom !== undefined) {
      let loop = 0;
      for (let j = step.repeatFrom; j < i; j++) loop += steps[j].seconds || 0;
      total += loop * (step.count - 1);
    } else total += step.seconds;
  });
  return total;
}

// ---------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------
const { workouts, buildSequence, EXERCISES } = loadApp();
const catalog = buildCatalog();
const taskToId = buildTaskToId(EXERCISES);
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Generating ${workouts.length} workout files into garmin/\n`);
let maxSteps = 0;
workouts.forEach((workout, index) => {
  const { bytes, stepCount, titleCount, steps } = encodeWorkout(workout, buildSequence, catalog, taskToId, EXERCISES, index);
  maxSteps = Math.max(maxSteps, stepCount);
  writeFileSync(join(OUT_DIR, `${workout.id}.fit`), bytes);
  const mins = (totalSeconds(steps) / 60).toFixed(0);
  console.log(
    `  ${workout.id.padEnd(20)} ${String(stepCount).padStart(3)} steps  ${String(titleCount).padStart(2)} titles  ` +
    `${mins.padStart(3)} min  ${String(bytes.length).padStart(6)} bytes  (${workout.format})`
  );
});
console.log(`\nDone. Largest workout: ${maxSteps} steps.`);
console.log('Copy the .fit files onto the watch: GARMIN/NewFiles (see garmin/README.md).');
