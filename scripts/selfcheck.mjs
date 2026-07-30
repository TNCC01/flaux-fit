/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  Self-check: run before committing.  node scripts/selfcheck.mjs

  The app ships as plain scripts with no build step, so nothing would
  otherwise catch a typo'd exercise id, a missing animation, or a block
  that hands the same single kettlebell to both people. This walks the
  data and every generator input combination and fails loudly.
*/
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = ['js/exercises.js', 'js/workouts.js', 'js/generator.js'];

// The app files are browser globals, not modules, evaluate them together
// and hand back everything they declared at top level.
function loadApp() {
  const src = SRC.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const names = [...src.matchAll(/^const ([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m => m[1]);
  const fns = [...src.matchAll(/^function ([A-Za-z_][A-Za-z0-9_]*)/gm)].map(m => m[1]);
  const all = [...new Set([...names, ...fns])];
  return new Function(`${src}\nreturn {${all.join(',')}};`)();
}

const A = loadApp();
const {
  EXERCISES, EQUIPMENT, REGIONS, EXCLUSION_TAGS, SINGLE_INSTANCE, STRETCHES,
  INTERVALS, CLASSICS, STRETCH_ROUTINES, DEFAULT_EQUIPMENT,
  describeEx, resolveEx, stretchList, generateWorkout, blockSeconds, bookends
} = A;

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);

const REGION_IDS = REGIONS.map(r => r.id);
const TAG_IDS = EXCLUSION_TAGS.map(t => t.id);
const PATTERNS = ['squat', 'hinge', 'lunge', 'pushH', 'pushV', 'pullH', 'pullV',
  'coreAnti', 'coreFlex', 'coreRot', 'coreLat', 'carry', 'cardio', 'crawl'];
const ALL_EQUIP = { ...DEFAULT_EQUIPMENT };
const ctxFor = (ivId, equipment = ALL_EQUIP) => {
  const iv = INTERVALS[ivId];
  return { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec,
           hasEquip: (id) => equipment[id] !== false };
};

// ---------------------------------------------------------------- 1. data
const ids = Object.keys(EXERCISES);
for (const id of ids) {
  const ex = EXERCISES[id];
  if (!ex.name) fail(`${id}: missing name`);
  if (ex.cue === undefined) fail(`${id}: missing cue (use '' for none)`);
  if (typeof ex.alt !== 'string') fail(`${id}: missing alt`);
  if (!Array.isArray(ex.equipment)) fail(`${id}: equipment must be an array`);
  else ex.equipment.forEach(e => { if (!EQUIPMENT[e]) fail(`${id}: unknown equipment "${e}"`); });
  if (!Array.isArray(ex.regions) || !ex.regions.length) fail(`${id}: needs at least one region`);
  else ex.regions.forEach(r => { if (!REGION_IDS.includes(r)) fail(`${id}: unknown region "${r}"`); });
  if (!PATTERNS.includes(ex.pattern)) fail(`${id}: unknown pattern "${ex.pattern}"`);
  if (!Array.isArray(ex.tags)) fail(`${id}: tags must be an array`);
  else ex.tags.forEach(t => { if (!TAG_IDS.includes(t)) fail(`${id}: unknown tag "${t}"`); });
  if (ex.bw && !EXERCISES[ex.bw]) fail(`${id}: bw fallback "${ex.bw}" does not exist`);
  if (!ex.img) fail(`${id}: missing img`);
  // Anything needing gear must have a path down to bodyweight, or it
  // vanishes the moment that gear is switched off.
  if (ex.equipment.length) {
    let cur = ex, guard = 0;
    while (cur.equipment.length && cur.bw && guard++ < 8) cur = EXERCISES[cur.bw];
    if (cur.equipment.length) fail(`${id}: no bodyweight fallback chain`);
  }
}

// ------------------------------------------------------------- 2. artwork
const artDir = path.join(ROOT, 'img/exercises');
const onDisk = fs.readdirSync(artDir).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
const referenced = [...new Set(ids.map(id => EXERCISES[id].img))];
referenced.forEach(img => {
  if (!onDisk.includes(img)) fail(`no animation for "${img}" (img/exercises/${img}.svg)`);
});
onDisk.forEach(f => {
  if (!referenced.includes(f)) warn(`img/exercises/${f}.svg is not used by any exercise`);
});

// -------------------------------------------------------- 3. stretch data
const stretchIds = STRETCHES.map(s => s.id);
STRETCH_ROUTINES.forEach(r => {
  r.ids.forEach(id => { if (!stretchIds.includes(id)) fail(`${r.id}: unknown stretch "${id}"`); });
  if (!r.hold) fail(`${r.id}: missing hold`);
  const list = stretchList(r);
  if (list.length !== r.ids.length) fail(`${r.id}: stretchList lost entries`);
});

// ------------------------------- 4. blocks: ids resolve, no duo gear clash
const sharesSingle = (a, b) =>
  EXERCISES[a] && EXERCISES[b] &&
  EXERCISES[a].equipment.some(e => SINGLE_INSTANCE.includes(e) && EXERCISES[b].equipment.includes(e));

function checkBlocks(label, workout, equipment) {
  for (const ivId of Object.keys(INTERVALS)) {
    const iv = INTERVALS[ivId];
    const ctx = ctxFor(ivId, equipment);
    workout.blocks.forEach((block, bi) => {
      (block.ids || []).forEach(id => {
        if (!EXERCISES[id]) fail(`${label} block ${bi + 1}: unknown exercise id "${id}"`);
      });
      if (!block.name) fail(`${label} block ${bi + 1}: missing name`);
      for (let r = 1; r <= iv.rounds; r++) {
        const duo = block.duo(r, ctx);
        const solo = block.solo(r, ctx);
        [duo.a, duo.b, solo].forEach(ex => {
          if (!ex || !ex.name) fail(`${label} block ${bi + 1} round ${r} (${ivId}): empty exercise`);
        });
        if (duo.a && duo.b && sharesSingle(duo.a.id, duo.b.id)) {
          fail(`${label} block ${bi + 1} round ${r} (${ivId}): ` +
               `${duo.a.id} + ${duo.b.id} both need the same single-instance item`);
        }
      }
    });
  }
}

CLASSICS.forEach(w => checkBlocks(`classic "${w.id}"`, w, ALL_EQUIP));

// Also with gear switched off, since fallbacks change the assignment.
const noKb = { ...ALL_EQUIP, kb15: false, kb10: false };
const bodyOnly = Object.fromEntries(Object.keys(EQUIPMENT).map(k => [k, false]));
CLASSICS.forEach(w => {
  checkBlocks(`classic "${w.id}" (no kettlebells)`, w, noKb);
  checkBlocks(`classic "${w.id}" (bodyweight only)`, w, bodyOnly);
});

// ------------------------------------------- 5. interval-aware cue timing
for (const ivId of Object.keys(INTERVALS)) {
  const iv = INTERVALS[ivId];
  const ctx = ctxFor(ivId);
  const half = Math.round(iv.workSec / 2);
  const sideEx = ids.filter(id => EXERCISES[id].sideCue && !EXERCISES[id].equipment.length);
  if (!sideEx.length) fail('no sideCue exercises to check');
  sideEx.forEach(id => {
    const d = describeEx(id, ctx);
    if (!d.cue.includes(`${half}s`)) {
      fail(`${id} (${ivId}): cue should name the ${half}s halfway point, got "${d.cue}"`);
    }
  });
  const rot = ids.filter(id => EXERCISES[id].rotateCue);
  rot.forEach(id => {
    const every = Math.round(iv.workSec / EXERCISES[id].rotateCue);
    const d = describeEx(id, ctx);
    if (!d.cue.includes(`${every}s`)) {
      fail(`${id} (${ivId}): rotation cue should say every ${every}s, got "${d.cue}"`);
    }
  });
}

// -------------------------------------- 6. blockSwap swaps at the halfway
for (const ivId of Object.keys(INTERVALS)) {
  const iv = INTERVALS[ivId];
  const ctx = ctxFor(ivId);
  const swapBlock = CLASSICS.flatMap(w => w.blocks).find(b => b.shape === 'swap');
  const seen = new Set();
  for (let r = 1; r <= iv.rounds; r++) seen.add(swapBlock.solo(r, ctx).id);
  if (seen.size !== 2) {
    fail(`blockSwap only used ${seen.size} of its 2 loads over ${iv.rounds} rounds (${ivId}) ` +
         `. The halfway swap is not firing.`);
  }
}

// -------------------------------------------------- 7. duration honesty
function realSeconds(w, ivId) {
  const iv = INTERVALS[ivId];
  if (w.format === 'stretch') return stretchList(w).reduce((s, x) => s + x.hold, 0);
  return w.warmupSec + w.cooldownSec
       + w.blocks.length * blockSeconds(iv)
       + (w.blocks.length - 1) * w.blockRestSec;
}
// Both interval styles must run a block to the same length, or swapping
// between them would silently change how long a workout takes.
const lens = Object.keys(INTERVALS).map(id => blockSeconds(INTERVALS[id]));
if (new Set(lens).size !== 1) {
  fail(`interval styles disagree on block length: ${lens.join(' vs ')}s`);
}
// And the same total work, which is the whole point of the "long efforts"
// option, fewer stops, not less work.
const work = Object.keys(INTERVALS).map(id => INTERVALS[id].rounds * INTERVALS[id].workSec);
if (new Set(work).size !== 1) {
  fail(`interval styles disagree on total work: ${work.join(' vs ')}s`);
}

// ------------------------------------------------- 8. generator sweep
const REGION_SUBSETS = [];
for (let mask = 1; mask < (1 << REGION_IDS.length); mask++) {
  REGION_SUBSETS.push(REGION_IDS.filter((_, i) => mask & (1 << i)));
}
const EQUIP_CASES = [
  ['full kit', ALL_EQUIP],
  ['no kettlebells', noKb],
  ['bodyweight only', bodyOnly],
  ['rings + rope only', { ...bodyOnly, rings: true, rope: true }]
];
const TAG_CASES = [[], ['impact'], ['floor'], ['impact', 'floor', 'running'],
                   ['impact', 'floor', 'overhead', 'running']];

let generated = 0, errored = 0;
const minutesList = [10, 15, 20, 25, 30, 40, 45, 60];

for (const [equipLabel, equipment] of EQUIP_CASES) {
  for (const regions of REGION_SUBSETS) {
    for (const people of [1, 2]) {
      for (const ivId of Object.keys(INTERVALS)) {
        const minutes = minutesList[generated % minutesList.length];
        const blockedTags = TAG_CASES[generated % TAG_CASES.length];
        const label = `[${equipLabel} | ${regions.join('+')} | ${people}p | ${ivId} | ` +
                      `${minutes}min | no:${blockedTags.join(',') || '-'}]`;
        const w = generateWorkout({
          minutes, people, intervalId: ivId, regions, equipment,
          excluded: [], blockedTags, seed: 1000 + generated, recent: []
        });
        generated++;
        if (w.error) {
          errored++;
          // Refusing is only correct when the filters can't yield a real
          // block. That needs two movements that can legally run side by
          // side, a whole session of one exercise is not a workout, and
          // two that both need the single set of rings can't pair up.
          const left = Object.keys(EXERCISES).filter(id =>
            EXERCISES[id].equipment.every(e => equipment[e] !== false) &&
            !EXERCISES[id].tags.some(t => blockedTags.includes(t)) &&
            EXERCISES[id].regions.some(r => regions.includes(r)));
          const pairable = left.some((a, i) =>
            left.slice(i + 1).some(b => !sharesSingle(a, b) &&
              EXERCISES[a].img !== EXERCISES[b].img));
          if (pairable) {
            fail(`${label} generator gave up with ${left.length} usable movements ` +
                 `still available: ${w.error}`);
          }
          continue;
        }
        if (!w.blocks.length) fail(`${label} produced no blocks`);
        checkBlocks(label, w, equipment);

        // The name must not claim a length the timer won't run.
        const claimed = Number((w.name.match(/(\d+) min/) || [])[1]);
        const real = Math.round(realSeconds(w, ivId) / 60);
        if (claimed !== real) fail(`${label} card says ${claimed} min but runs ${real} min`);

        // Every movement must be usable under this equipment set.
        w.exerciseIds.forEach(id => {
          if (!EXERCISES[id].equipment.every(e => equipment[e] !== false)) {
            fail(`${label} picked ${id}, which needs gear that is switched off`);
          }
          if (EXERCISES[id].tags.some(t => blockedTags.includes(t))) {
            fail(`${label} picked ${id}, which carries an excluded tag`);
          }
        });
      }
    }
  }
}

// ---------------------------------- 9. exclusions are actually respected
const someIds = ids.filter(id => !EXERCISES[id].equipment.length).slice(0, 40);
const wEx = generateWorkout({
  minutes: 30, people: 2, intervalId: 'short', regions: REGION_IDS,
  equipment: ALL_EQUIP, excluded: someIds, blockedTags: [], seed: 4242, recent: []
});
if (wEx.error) fail(`excluding 40 movements should still leave a workout: ${wEx.error}`);
else someIds.forEach(id => {
  if (wEx.exerciseIds.includes(id)) fail(`excluded movement ${id} still appeared`);
});

// Excluding everything must fail cleanly rather than produce a shell.
const wNone = generateWorkout({
  minutes: 30, people: 1, intervalId: 'short', regions: REGION_IDS,
  equipment: ALL_EQUIP, excluded: ids, blockedTags: [], seed: 1, recent: []
});
if (!wNone.error) fail('excluding every movement should return an error');

// ------------------------------------------ 10. variety across sessions
let recent = [], prev = null, worstOverlap = 0;
for (let i = 0; i < 8; i++) {
  const w = generateWorkout({
    minutes: 30, people: 2, intervalId: 'short', regions: REGION_IDS,
    equipment: ALL_EQUIP, excluded: [], blockedTags: [], seed: 7919 * (i + 1), recent
  });
  if (w.error) { fail(`variety sweep ${i}: ${w.error}`); break; }
  if (prev) {
    const overlap = w.exerciseIds.filter(id => prev.includes(id)).length / w.exerciseIds.length;
    worstOverlap = Math.max(worstOverlap, overlap);
  }
  prev = w.exerciseIds;
  recent = [...w.exerciseIds, ...recent].slice(0, 60);
}
if (worstOverlap > 0.5) {
  fail(`consecutive generated sessions shared ${Math.round(worstOverlap * 100)}% of movements ` +
       `,  the recency weighting is not working`);
}

// ------------------------------- 11. no touch-action in the stylesheet
// iOS only: any non-`auto` touch-action stops a slow press-and-drag from
// turning into a page scroll, while a fast flick still works. It cannot be
// reproduced in Chromium, so guard it here rather than hope to catch it.
const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');          // strip comments
const touchActions = [...css.matchAll(/touch-action\s*:\s*([^;}]+)/g)]
  .map(m => m[1].trim())
  .filter(v => v !== 'auto');
if (touchActions.length) {
  fail(`css/app.css sets touch-action: ${touchActions.join(', ')}. Anything other ` +
       `than "auto" breaks press-and-drag scrolling on iOS (flick still works, ` +
       `which is what makes it easy to miss).`);
}

// Same failure mode, different cause: a transform on :active animates a
// composited layer under the finger, and WebKit keeps the touch for the
// element instead of panning the page. Paint-only press states are fine.
const activeTransform = [...css.matchAll(/([^{}]*:active[^{}]*)\{([^}]*)\}/g)]
  .filter(m => /(^|[^-\w])transform\s*:/.test(m[2]))
  .map(m => m[1].trim().replace(/\s+/g, ' '));
if (activeTransform.length) {
  fail(`css/app.css applies a transform on :active (${activeTransform.join('; ')}). ` +
       `That stops a slow press-and-drag becoming a page scroll on iOS. Use a ` +
       `paint-only press state (border-color, background-color, box-shadow).`);
}
const transformTransitions = [...css.matchAll(/transition\s*:\s*([^;}]*transform[^;}]*)/g)]
  .map(m => m[1].trim());
if (transformTransitions.length) {
  fail(`css/app.css transitions transform (${transformTransitions.join('; ')}), which ` +
       `is the animation half of the same iOS scrolling problem.`);
}

// ------------------------------------------------------------- report
const reused = ids.filter(id => EXERCISES[id].equipment.length === 0).length;
console.log(`exercises          ${ids.length} (${reused} bodyweight)`);
console.log(`animations         ${referenced.length} referenced, ${onDisk.length} on disk`);
console.log(`classics           ${CLASSICS.length} + ${STRETCH_ROUTINES.length} stretch routines`);
console.log(`generator sweep    ${generated} combinations, ${errored} correctly refused`);
console.log(`session overlap    ${Math.round(worstOverlap * 100)}% worst case between consecutive`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach(w => console.log(`  - ${w}`));
}
if (failures.length) {
  console.log(`\nFAILED, ${failures.length} problem(s):`);
  failures.slice(0, 40).forEach(f => console.log(`  x ${f}`));
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
  process.exit(1);
}
console.log('\nall checks passed');
