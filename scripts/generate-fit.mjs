#!/usr/bin/env node
// Generate Garmin structured-workout .FIT files from the workout library in
// index.html.  See GARMIN-HANDOFF.md for the data model (Route 1).
//
// Usage:  npm install   (once, to get the Garmin FIT SDK)
//         node scripts/generate-fit.mjs
// Output: garmin/<workout-id>.fit (one file per workout)
//
// The watch guides each interval: the exercise name and its animation show on
// screen and the watch vibrates at every step change. Files are built in solo
// mode (one person wearing the watch) with all equipment assumed present,
// exactly as the web app expands them via buildSequence(workout, 1). Repeated
// rounds are collapsed into FIT repeat steps to stay under the watch step cap.
//
// Names/animations on the watch come from Garmin's built-in exercise catalog
// (exercise_category + exercise_name), NOT free text - a Forerunner 255 shows
// generic "Go / Rest" for a plain wkt_step_name. So every work step is mapped
// to a catalog entry via EX_MAP below, and tabata workouts use the strength
// sub-sport (which renders those names + animations). Files are encoded with
// Garmin's official FIT SDK, each with a unique file_id so all 18 import.

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
// 2. Garmin exercise catalog mapping
// ---------------------------------------------------------------------
// app exercise id -> [category, ...name candidates]. First candidate that
// exists in the SDK for that category wins. Validated at load time; a new
// exercise in index.html with no mapping is a hard error, not a silent blank.
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

// Best-effort catalog for the two stretch flows (normalized hold name ->
// [category, ...candidates]). Unmatched holds keep their text name.
const STRETCH_MAP = {
  'standing forward fold': ['warmUp', 'stretchHamstring'],
  'seated forward fold': ['warmUp', 'stretchHamstring'],
  'downward dog': ['warmUp', 'stretchCalf'],
  'low lunge': ['warmUp', 'stretchLungingHipFlexor', 'stretchHipFlexorAndQuad'],
  'pigeon': ['warmUp', 'stretchPigeonPose'],
  "child's pose": ['warmUp', 'stretchChildsPose'],
  'cobra / upward dog': ['warmUp', 'stretchCobra'],
  'cat-cow flow': ['warmUp', 'stretchCatCow', 'catCow'],
  'standing chest opener': ['warmUp', 'stretchPectoral'],
  'neck & shoulder rolls': ['warmUp', 'stretchNeck', 'neckRotations'],
  'supine spinal twist': ['warmUp', 'stretchLyingSpinalTwist'],
  'thread the needle': ['warmUp', 'stretchLyingSpinalTwist'],
  '90/90 hip': ['warmUp', 'stretch90_90'],
  'glute bridge hold': ['hipRaise', 'hipRaise']
};

// Resolve names to numeric (category, name) once, against the SDK profile.
function buildCatalog() {
  const t = Profile.types;
  const catNum = (cat) => {
    const hit = Object.entries(t.exerciseCategory).find(([, v]) => v === cat);
    return hit ? Number(hit[0]) : null;
  };
  const nameNum = (cat, name) => {
    const e = t[cat + 'ExerciseName'];
    if (!e) return null;
    const hit = Object.entries(e).find(([, v]) => v === name);
    return hit ? Number(hit[0]) : null;
  };
  const resolve = (spec, label) => {
    const [cat, ...cands] = spec;
    const c = catNum(cat);
    for (const name of cands) {
      const n = nameNum(cat, name);
      if (c !== null && n !== null) return { category: c, exerciseName: n };
    }
    if (label) throw new Error(`No catalog match for ${label}: [${spec.join(', ')}]`);
    return null;
  };
  const byId = {};
  for (const [id, spec] of Object.entries(EX_MAP)) byId[id] = resolve(spec, id);
  const stretch = {};
  for (const [key, spec] of Object.entries(STRETCH_MAP)) {
    const r = resolve(spec, null);
    if (r) stretch[key] = r;
  }
  return { byId, stretch };
}

// ---------------------------------------------------------------------
// 3. Sequence -> compressed step list
// ---------------------------------------------------------------------
const MAX_NAME = 40; // wkt_step_name fallback text length

const clean = (s) => (s || '').replace(/\s+—\s+/g, ' - ').replace(/[—–]/g, '-').trim();
const shorten = (s, max = MAX_NAME) => {
  s = clean(s);
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
};
const normStretch = (name) => clean(name).toLowerCase().replace(/\s*[-–—].*$/, '').trim();

const kindIntensity = (kind) => {
  if (kind === 'warmup') return 'warmup';
  if (kind === 'cooldown') return 'cooldown';
  if (kind === 'rest' || kind === 'blockrest') return 'rest';
  return 'active';
};

// Reverse map an exercise's task string back to its EXERCISES id. Since the
// watch files assume all equipment present (no bw adaptation), a work step's
// task equals EXERCISES[id].task, minus the clean&press " (… arm)" suffix.
function buildTaskToId(EXERCISES) {
  const map = {};
  for (const [id, ex] of Object.entries(EXERCISES)) map[ex.task] = id;
  return (task) => map[task.replace(/\s*\((left|right) arm\)$/, '')] ?? null;
}

// Collapse a block's round names into repeat groups (Same=1, Alt=2, Cycle=n),
// then two half-block periods (Swap=4+4, alt-arm=2+2), else flat.
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

// buildSequence(workout,1) -> flat FIT steps. Work steps carry a catalog
// {category, exerciseName}; timed steps carry {name, seconds, intensity};
// repeats carry {repeatFrom, count}.
function stepsFor(workout, buildSequence, catalog, taskToId) {
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
        if (!id || !catalog.byId[id]) {
          throw new Error(`No exercise mapping for task "${work.a.task}" in ${workout.id}`);
        }
        pairs.push({
          key: id + '|' + work.a.task, // arm-suffixed clean&press stays distinct
          name: shorten(work.a.task),
          cat: catalog.byId[id],
          workSec: work.duration, restSec: rest.duration
        });
        i += 2;
      }
      for (const group of compressRounds(pairs)) {
        const firstIdx = steps.length;
        for (const it of group.items) {
          steps.push({ name: it.name, seconds: it.workSec, intensity: 'active', cat: it.cat });
          steps.push({ name: 'Rest', seconds: it.restSec, intensity: 'rest' });
        }
        if (group.reps > 1) steps.push({ repeatFrom: firstIdx, count: group.reps });
      }
    } else {
      const label = e.kind === 'stretch' ? e.a.task : e.name;
      const step = { name: shorten(label), seconds: e.duration, intensity: kindIntensity(e.kind) };
      if (e.kind === 'stretch') {
        const hit = catalog.stretch[normStretch(e.a.task)];
        if (hit) step.cat = hit;
      }
      steps.push(step);
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

function encodeWorkout(workout, buildSequence, catalog, taskToId, index) {
  const steps = stepsFor(workout, buildSequence, catalog, taskToId);
  const subSport = workout.format === 'tabata' ? 'strengthTraining' : 'yoga';
  const enc = new Encoder();

  enc.onMesg(MesgNum.FILE_ID, {
    type: 'workout', manufacturer: 'development', product: 1,
    serialNumber: 0x464C0000 + index,           // unique per file
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
    if (step.cat) {                              // catalog name + animation
      mesg.exerciseCategory = step.cat.category;
      mesg.exerciseName = step.cat.exerciseName;
    }
    enc.onMesg(MesgNum.WORKOUT_STEP, mesg);
  });

  return { bytes: enc.close(), stepCount: steps.length, steps };
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
  const { bytes, stepCount, steps } = encodeWorkout(workout, buildSequence, catalog, taskToId, index);
  maxSteps = Math.max(maxSteps, stepCount);
  writeFileSync(join(OUT_DIR, `${workout.id}.fit`), bytes);
  const mins = (totalSeconds(steps) / 60).toFixed(0);
  console.log(
    `  ${workout.id.padEnd(20)} ${String(stepCount).padStart(3)} steps  ` +
    `${mins.padStart(3)} min  ${String(bytes.length).padStart(6)} bytes  (${workout.format})`
  );
});
console.log(`\nDone. Largest workout: ${maxSteps} steps.`);
console.log('Copy the .fit files onto the watch: GARMIN/NewFiles (see garmin/README.md).');
