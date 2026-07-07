#!/usr/bin/env node
// Generate Garmin structured-workout .FIT files from the workout library in
// index.html.  See GARMIN-HANDOFF.md for the data model (Route 1).
//
// Usage:  npm install   (once, to get the Garmin FIT SDK)
//         node scripts/generate-fit.mjs
// Output: garmin/<workout-id>.fit (one file per workout)
//
// The watch guides each interval: the exercise name shows on screen and the
// watch vibrates at every step change. Files are built in solo mode (one
// person wearing the watch) with all equipment assumed present, exactly as
// the web app expands them via buildSequence(workout, 1). Repeated rounds are
// collapsed into FIT repeat steps so files stay small and under the watch's
// step cap while every 20s work interval keeps its real exercise name.
//
// Files are encoded with Garmin's official FIT SDK (@garmin/fitsdk) so the
// framing is exactly what watches expect, and each file gets a unique file_id
// (serial + timestamp) so the watch imports all of them instead of treating
// them as one duplicate.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Encoder, Profile } from '@garmin/fitsdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'garmin');

// ---------------------------------------------------------------------
// 1. Extract and run the app's real workout code from index.html
// ---------------------------------------------------------------------
// We pull two verbatim regions out of index.html and evaluate them:
//   A) EQUIPMENT + EXERCISES + resolveEx + block helpers + workouts
//   B) warmup/cooldown exercises + TABATA + buildSequence
// A minimal `state` with no equipment overrides means resolveEx treats all
// gear as present (state.equipment[id] !== false is true for undefined), so
// no bodyweight adaptation happens - the watch files use each exercise's own
// task string. This keeps us 1:1 with the app instead of reimplementing it.
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
// 2. Sequence -> compressed step list
// ---------------------------------------------------------------------
const MAX_NAME = 32; // keep step names short enough to read on the watch

const clean = (s) => (s || '').replace(/\s+—\s+/g, ' - ').replace(/[—–]/g, '-').trim();
const shorten = (s, max = MAX_NAME) => {
  s = clean(s);
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
};

const kindIntensity = (kind) => {
  if (kind === 'warmup') return 'warmup';
  if (kind === 'cooldown') return 'cooldown';
  if (kind === 'rest' || kind === 'blockrest') return 'rest';
  return 'active'; // work, stretch
};

// Collapse a block's round names into repeat groups without reordering or
// renaming. Tries a whole-block period (Same=1, Alt=2, Cycle=period), then
// two half-block periods (Swap=4+4, alt-arm clean&press=2+2), else flat.
function periodGroup(names) {
  const n = names.length;
  for (let p = 1; p < n; p++) {
    if (n % p !== 0) continue;
    if (names.every((name, i) => name === names[i % p])) {
      return { items: names.slice(0, p), reps: n / p };
    }
  }
  return null;
}
function compressRounds(names) {
  const whole = periodGroup(names);
  if (whole) return [whole];
  if (names.length % 2 === 0) {
    const mid = names.length / 2;
    const h1 = periodGroup(names.slice(0, mid));
    const h2 = periodGroup(names.slice(mid));
    if (h1 && h2) return [h1, h2];
  }
  return names.map((name) => ({ items: [name], reps: 1 }));
}

// Turn buildSequence(workout, 1) output into a flat list of FIT steps.
// Each step is { name, seconds, intensity } or { repeatFrom, count }.
function stepsFor(workout, buildSequence) {
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
        pairs.push({ name: shorten(work.a.task), workSec: work.duration, restSec: rest.duration });
        i += 2;
      }
      const names = pairs.map((p) => p.name);
      for (const group of compressRounds(names)) {
        const firstIdx = steps.length;
        for (const name of group.items) {
          steps.push({ name, seconds: pairs[0].workSec, intensity: 'active' });
          steps.push({ name: 'Rest', seconds: pairs[0].restSec, intensity: 'rest' });
        }
        if (group.reps > 1) steps.push({ repeatFrom: firstIdx, count: group.reps });
      }
    } else {
      const label = e.kind === 'stretch' ? e.a.task : e.name;
      steps.push({ name: shorten(label), seconds: e.duration, intensity: kindIntensity(e.kind) });
      i += 1;
    }
  }
  return steps;
}

// ---------------------------------------------------------------------
// 3. Encode one workout file with the official FIT SDK
// ---------------------------------------------------------------------
const { MesgNum } = Profile;
// Base timestamp; each file offsets by its index so every file_id is unique.
const BASE_TIME = Date.UTC(2026, 6, 6, 0, 0, 0);

function encodeWorkout(workout, buildSequence, index) {
  const steps = stepsFor(workout, buildSequence);
  const subSport = workout.format === 'tabata' ? 'cardioTraining' : 'yoga';
  const enc = new Encoder();

  // Unique identity per file so the watch imports all 18, not just one.
  enc.onMesg(MesgNum.FILE_ID, {
    type: 'workout',
    manufacturer: 'development',
    product: 1,
    serialNumber: 0x464C0000 + index, // "FL" + index, nonzero
    timeCreated: new Date(BASE_TIME + index * 1000)
  });

  enc.onMesg(MesgNum.WORKOUT, {
    sport: 'training',
    subSport,
    numValidSteps: steps.length,
    wktName: workout.name
  });

  steps.forEach((step, i) => {
    if (step.repeatFrom !== undefined) {
      enc.onMesg(MesgNum.WORKOUT_STEP, {
        messageIndex: i,
        intensity: 'active',
        durationType: 'repeatUntilStepsCmplt',
        durationValue: step.repeatFrom, // step index to loop back to
        targetType: 'open',
        targetValue: step.count         // number of repetitions
      });
    } else {
      enc.onMesg(MesgNum.WORKOUT_STEP, {
        messageIndex: i,
        wktStepName: step.name,
        intensity: step.intensity,
        durationType: 'time',
        durationValue: step.seconds * 1000, // milliseconds
        targetType: 'open',
        targetValue: 0
      });
    }
  });

  return { bytes: enc.close(), stepCount: steps.length, steps };
}

// Expanded duration in seconds (repeats unrolled) for the summary printout.
function totalSeconds(steps) {
  let total = 0;
  steps.forEach((step, i) => {
    if (step.repeatFrom !== undefined) {
      let loop = 0;
      for (let j = step.repeatFrom; j < i; j++) loop += steps[j].seconds || 0;
      total += loop * (step.count - 1);
    } else {
      total += step.seconds;
    }
  });
  return total;
}

// ---------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------
const { workouts, buildSequence } = loadApp();
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Generating ${workouts.length} workout files into garmin/\n`);
let maxSteps = 0;
workouts.forEach((workout, index) => {
  const { bytes, stepCount, steps } = encodeWorkout(workout, buildSequence, index);
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
