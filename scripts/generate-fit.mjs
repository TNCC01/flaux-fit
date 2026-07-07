#!/usr/bin/env node
// Generate Garmin structured-workout .FIT files from the workout library in
// index.html.  See GARMIN-HANDOFF.md for the data model (Route 1).
//
// Usage:  node scripts/generate-fit.mjs
// Output: garmin/<workout-id>.fit (one file per workout)
//
// The watch guides each interval: the exercise name shows on screen and the
// watch vibrates at every step change. Files are built in solo mode (one
// person wearing the watch) with all equipment assumed present, exactly as
// the web app expands them via buildSequence(workout, 1). Repeated rounds are
// collapsed into FIT repeat steps so files stay small and under the watch's
// step cap while every 20s work interval keeps its real exercise name.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'garmin');

// ---------------------------------------------------------------------
// 1. Extract and run the app's real workout code from index.html
// ---------------------------------------------------------------------
// We pull two verbatim regions out of index.html and evaluate them:
//   A) EQUIPMENT + EXERCISES + resolveEx + block helpers + workouts
//   B) TABATA + buildSequence
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
// 2. FIT binary encoder (workout files only, little-endian)
// ---------------------------------------------------------------------
const CRC_TABLE = [
  0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
  0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
];
function crc16(bytes, crc = 0) {
  for (const byte of bytes) {
    let tmp = CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xF];
    tmp = CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xF];
  }
  return crc;
}

const T = {
  enum:    { code: 0x00, size: 1 },
  uint16:  { code: 0x84, size: 2 },
  uint32:  { code: 0x86, size: 4 },
  uint32z: { code: 0x8C, size: 4 },
  string:  { code: 0x07, size: 0 }
};

class FitWriter {
  constructor() { this.chunks = []; }
  push(...bytes) { this.chunks.push(Uint8Array.from(bytes)); }
  pushBuf(buf) { this.chunks.push(buf); }

  definition(localType, globalNum, fields) {
    this.push(0x40 | localType, 0, 0);
    const g = new Uint8Array(3);
    new DataView(g.buffer).setUint16(0, globalNum, true);
    g[2] = fields.length;
    this.pushBuf(g);
    for (const f of fields) {
      const size = f.type === T.string ? f.strSize : f.type.size;
      this.push(f.num, size, f.type.code);
    }
  }

  data(localType, fields, values) {
    this.push(localType);
    fields.forEach((f, i) => {
      const v = values[i];
      if (f.type === T.string) {
        const buf = new Uint8Array(f.strSize);
        const enc = new TextEncoder().encode(v ?? '');
        buf.set(enc.slice(0, f.strSize - 1));
        this.pushBuf(buf);
      } else {
        const buf = new Uint8Array(f.type.size);
        const dv = new DataView(buf.buffer);
        if (f.type.size === 1) buf[0] = v;
        else if (f.type.size === 2) dv.setUint16(0, v, true);
        else dv.setUint32(0, v, true);
        this.pushBuf(buf);
      }
    });
  }

  toFile() {
    let dataSize = 0;
    for (const c of this.chunks) dataSize += c.length;
    const header = new Uint8Array(14);
    const dv = new DataView(header.buffer);
    header[0] = 14;
    header[1] = 0x10;
    dv.setUint16(2, 2132, true);
    dv.setUint32(4, dataSize, true);
    header.set(new TextEncoder().encode('.FIT'), 8);
    dv.setUint16(12, crc16(header.slice(0, 12)), true);

    const file = new Uint8Array(14 + dataSize + 2);
    file.set(header, 0);
    let off = 14;
    for (const c of this.chunks) { file.set(c, off); off += c.length; }
    const fileCrc = crc16(file.slice(0, off));
    new DataView(file.buffer).setUint16(off, fileCrc, true);
    return file;
  }
}

// ---------------------------------------------------------------------
// 3. Sequence -> compressed step list
// ---------------------------------------------------------------------
const INTENSITY = { active: 0, rest: 1, warmup: 2, cooldown: 3 };
const DURATION = { time: 0, repeat: 6 };
const TARGET_OPEN = 2;
const STEP_NAME_SIZE = 40; // fixed field width; names are truncated to fit

const clean = (s) => (s || '').replace(/\s+—\s+/g, ' - ').replace(/[—–]/g, '-').trim();
const shorten = (s, max = STEP_NAME_SIZE - 1) => {
  s = clean(s);
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
};

const kindIntensity = (kind) => {
  if (kind === 'warmup') return INTENSITY.warmup;
  if (kind === 'cooldown') return INTENSITY.cooldown;
  if (kind === 'rest' || kind === 'blockrest') return INTENSITY.rest;
  return INTENSITY.active; // work, stretch
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

// Turn buildSequence(workout, 1) output into FIT steps.
function stepsFor(workout, buildSequence) {
  const seq = buildSequence(workout, 1);
  const steps = [];
  const emitTimed = (name, seconds, intensity) =>
    steps.push({ name: shorten(name), seconds, intensity });

  let i = 0;
  while (i < seq.length) {
    const e = seq[i];
    if (e.kind === 'work') {
      // Gather this block's consecutive work/rest pairs.
      const pairs = [];
      while (i < seq.length && seq[i].kind === 'work') {
        const work = seq[i];
        const rest = seq[i + 1];
        pairs.push({ name: work.a.task, workSec: work.duration, restSec: rest.duration });
        i += 2;
      }
      const names = pairs.map((p) => shorten(p.name));
      for (const group of compressRounds(names)) {
        const firstIdx = steps.length;
        for (const name of group.items) {
          steps.push({ name, seconds: pairs[0].workSec, intensity: INTENSITY.active });
          steps.push({ name: 'Rest', seconds: pairs[0].restSec, intensity: INTENSITY.rest });
        }
        if (group.reps > 1) steps.push({ repeatFrom: firstIdx, count: group.reps });
      }
    } else {
      // warmup / cooldown / blockrest / stretch: one timed step each.
      const label = e.kind === 'stretch' ? e.a.task : e.name;
      emitTimed(label, e.duration, kindIntensity(e.kind));
      i += 1;
    }
  }
  return steps;
}

// ---------------------------------------------------------------------
// 4. Encode one workout file
// ---------------------------------------------------------------------
const SPORT_TRAINING = 10;
const SUB_SPORT = { cardio: 26, yoga: 43 };
const TIME_CREATED = Math.floor(Date.UTC(2026, 6, 6) / 1000) - 631065600;

function encodeWorkout(workout, buildSequence) {
  const steps = stepsFor(workout, buildSequence);
  const subSport = workout.format === 'tabata' ? SUB_SPORT.cardio : SUB_SPORT.yoga;
  const w = new FitWriter();

  const fileIdFields = [
    { num: 0, type: T.enum },
    { num: 1, type: T.uint16 },
    { num: 2, type: T.uint16 },
    { num: 3, type: T.uint32z },
    { num: 4, type: T.uint32 }
  ];
  w.definition(0, 0, fileIdFields);
  w.data(0, fileIdFields, [5, 255, 1, 0x464C5558 /* FLUX */, TIME_CREATED]);

  const nameSize = Math.min(64, new TextEncoder().encode(workout.name).length + 1);
  const workoutFields = [
    { num: 4, type: T.enum },
    { num: 6, type: T.uint16 },
    { num: 8, type: T.string, strSize: nameSize },
    { num: 11, type: T.enum }
  ];
  w.definition(1, 26, workoutFields);
  w.data(1, workoutFields, [SPORT_TRAINING, steps.length, workout.name, subSport]);

  const stepFields = [
    { num: 254, type: T.uint16 },
    { num: 0, type: T.string, strSize: STEP_NAME_SIZE },
    { num: 1, type: T.enum },
    { num: 2, type: T.uint32 },
    { num: 3, type: T.enum },
    { num: 4, type: T.uint32 },
    { num: 7, type: T.enum }
  ];
  w.definition(2, 27, stepFields);
  steps.forEach((step, i) => {
    if (step.repeatFrom !== undefined) {
      w.data(2, stepFields, [i, '', DURATION.repeat, step.repeatFrom, TARGET_OPEN, step.count, INTENSITY.active]);
    } else {
      w.data(2, stepFields, [i, step.name, DURATION.time, step.seconds * 1000, TARGET_OPEN, 0, step.intensity]);
    }
  });

  return { bytes: w.toFile(), stepCount: steps.length, steps };
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
// 5. Main
// ---------------------------------------------------------------------
const { workouts, buildSequence } = loadApp();
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Generating ${workouts.length} workout files into garmin/\n`);
let maxSteps = 0;
for (const workout of workouts) {
  const { bytes, stepCount, steps } = encodeWorkout(workout, buildSequence);
  maxSteps = Math.max(maxSteps, stepCount);
  writeFileSync(join(OUT_DIR, `${workout.id}.fit`), bytes);
  const mins = (totalSeconds(steps) / 60).toFixed(0);
  console.log(
    `  ${workout.id.padEnd(20)} ${String(stepCount).padStart(3)} steps  ` +
    `${mins.padStart(3)} min  ${String(bytes.length).padStart(6)} bytes  (${workout.format})`
  );
}
console.log(`\nDone. Largest workout: ${maxSteps} steps.`);
console.log('Copy the .fit files onto the watch: GARMIN/NewFiles (see garmin/README.md).');
