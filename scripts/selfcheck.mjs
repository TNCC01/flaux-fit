/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  Self-check: run before committing.  node scripts/selfcheck.mjs

  The app ships as plain scripts with no build step, so nothing would
  otherwise catch a typo'd exercise id, a missing 3D movement, or a block
  that hands the same single kettlebell to both people. This walks the
  data and every generator input combination and fails loudly.
*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = ['js/exercises.js', 'js/workouts.js', 'js/generator.js'];

// The app files are browser globals, not modules, evaluate them together
// and hand back everything they declared at top level.
function loadApp(src = SRC.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')) {
  const names = [...src.matchAll(/^const ([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m => m[1]);
  const fns = [...src.matchAll(/^function ([A-Za-z_][A-Za-z0-9_]*)/gm)].map(m => m[1]);
  const all = [...new Set([...names, ...fns])];
  return new Function(`${src}\nreturn {${all.join(',')}};`)();
}

const A = loadApp();
const {
  EXERCISES, EQUIPMENT, REGIONS, EXCLUSION_TAGS, SINGLE_INSTANCE, STRETCHES,
  INTERVALS, CLASSICS, STRETCH_ROUTINES, DEFAULT_EQUIPMENT,
  describeEx, resolveEx, stretchList, generateWorkout, blockSeconds, bookends, amrapCircuits, sectionInterval,
  freezeWorkout, thawWorkout, BLOCK_MAKERS, withWorkRest, cleanWorkRest, nextLevel, cleanRepScales, targetDiff,
  LEVEL_MIN, LEVEL_MAX, warmupPlan, cooldownPlan, warmupCard, cooldownCard, WARMUP_REHEARSAL,
  planMix, planBlocks, sectionSeconds, isFlexible, FLEX_MIN_MINUTES, PROGRAMS, programDay, programStyle, mixMinimumMinutes, DEFAULT_INTERVAL,
  programEase, easeWeek, easeLeft, easedDay, weekLoad, EASE_SESSIONS, WATER_SESSIONS, WATER_SAFETY,
  SURF_CHECK, checkSeconds, checkMinutes, checkShape, checkChange, isCheckDay,
  swapCandidates, swapMaps, cleanSwaps, blockAlt, blockCycle
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
  return { rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, reps: !!iv.reps, lap: !!iv.lap,
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

// ------------------------------------------------------ 2. 3D movements
// Every exercise shows as a 3D figure during the workout, so each one needs
// movement data (its own record, or the animation it shares).
const { MOVES } = await import('../js/moves/index.js');
ids.forEach(id => {
  const ex = EXERCISES[id];
  if (!MOVES[id] && !MOVES[ex.img]) fail(`${id}: no 3D movement for "${ex.img}" (js/moves/)`);
});
const usedMoves = new Set(ids.flatMap(id => [id, EXERCISES[id].img]));
Object.keys(MOVES).forEach(k => { if (!usedMoves.has(k)) warn(`js/moves: "${k}" is not used by any exercise`); });

// and the service worker has to cache every file the figures load, or
// they go missing offline
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const need = ['move.html', 'vendor/three/three.min.js',
  ...['js/move', 'js/moves'].flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`))];
need.forEach(f => { if (!sw.includes(`'/${f}'`)) fail(`sw.js does not precache /${f}`); });

// The app runs from the service worker's copy of one release, and a new
// release only arrives when sw.js itself changes. So every file it lists
// has to exist, every file the pages load has to be on the list, and the
// fingerprint of them all in sw.js has to be current: change a file and
// this fails until VERSION is bumped and FILES_HASH updated, so a release
// can never go out that phones never pick up.
const swList = (name) => [...((sw.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`)) || [])[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
const precached = [...swList('SHELL'), ...swList('MOVE_3D')];
const fileOf = (url) => (url === '/' ? 'index.html' : url.slice(1));
precached.forEach(u => { if (!fs.existsSync(path.join(ROOT, fileOf(u)))) fail(`sw.js precaches ${u}, which doesn't exist`); });
['index.html', 'move.html'].forEach(page => {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  [...html.matchAll(/(?:src|href)="([^"#?:]+)"/g)].map(m => '/' + m[1].replace(/^\//, ''))
    .forEach(u => { if (!precached.includes(u)) fail(`${page} loads ${u}, which sw.js doesn't precache, so it's missing offline`); });
});
const swVersion = (sw.match(/const VERSION = '([^']+)'/) || [])[1];
const swHash = (sw.match(/const FILES_HASH = '([0-9a-f]+)'/) || [])[1];
const filesHash = (() => {
  const h = crypto.createHash('sha256');
  [...new Set(precached.map(fileOf))].sort().forEach(f => {
    const raw = fs.readFileSync(path.join(ROOT, f));
    // text with Windows line ends is the same file
    h.update(`${f}\n`).update(/\.(png|ico)$/.test(f) ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')));
  });
  return h.digest('hex').slice(0, 12);
})();
if (!swVersion || !swHash) fail('sw.js: VERSION or FILES_HASH is missing');
else if (swHash !== filesHash) fail(`app files changed: bump VERSION in sw.js (it says ${swVersion}) and update the hash to ${filesHash} (FILES_HASH)`);
// workouts.js says which release it's from, and js/app.js won't run beside
// one from another (see the check at its top), so both say VERSION.
[['js/workouts.js', 'WORKOUTS_RELEASE'], ['js/app.js', 'RELEASE']]
  .forEach(([f, name]) => {
    const stamp = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(new RegExp(`^const ${name} = '([^']*)'`, 'm')) || [])[1];
    if (swVersion && stamp !== swVersion) fail(`${f}: ${name} is ${stamp ? `'${stamp}'` : 'missing'}: set it to sw.js's VERSION, '${swVersion}'`);
  });
// and against the last release, where git knows it: the files can't
// change under the same VERSION
try {
  const main = execFileSync('git', ['show', 'origin/main:sw.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const mainVersion = (main.match(/const VERSION = '([^']+)'/) || [])[1];
  const mainHash = (main.match(/const FILES_HASH = '([0-9a-f]+)'/) || [])[1];
  if (mainHash && mainVersion === swVersion && mainHash !== filesHash) {
    fail(`app files changed since origin/main but VERSION is still ${swVersion}: bump VERSION in sw.js`);
  }
} catch (e) { /* no git or no origin/main here: the hash check above still holds */ }

// A shared link previews as FIT in Messages or WhatsApp, not a bare
// address: a title, a line on what it is, and the app icon at a full
// address (most apps won't fetch a relative one).
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const og = (k) => (html.match(new RegExp(`<meta property="og:${k}" content="([^"]*)">`)) || [])[1];
  if (!og('title') || !/FIT/.test(og('title'))) fail('index.html: og:title missing or does not say FIT');
  if (!og('description') || og('description').length < 40) fail('index.html: og:description missing or too short to say what FIT is');
  if (!/^https:\/\/[^/]+\/icon-512\.png$/.test(og('image') || '')) fail(`index.html: og:image should be the full address of icon-512.png, got ${og('image')}`);
  if (!fs.existsSync(path.join(ROOT, 'icon-512.png'))) fail('icon-512.png is missing');
}

// What's said on screen fits wherever you train: a mate's place or a park,
// not one particular house with a driveway and a mailbox.
{
  const HOUSE = /driveway|mailbox|letterbox/i;
  const said = [
    ...ids.map(id => [id, [EXERCISES[id].name, EXERCISES[id].cue, EXERCISES[id].alt].join(' | ')]),
    ...EXCLUSION_TAGS.map(t => [`tag ${t.id}`, `${t.label} | ${t.blurb}`]),
    ...CLASSICS.map(w => [`classic ${w.id}`, [w.blurb, ...w.blocks.map(b => b.name)].join(' | ')]),
    ...Object.keys(MOVES).map(k => [`3D ${k}`, JSON.stringify(MOVES[k].coaching || {})])
  ];
  said.forEach(([where, text]) => { if (HOUSE.test(text)) fail(`${where}: says "${text.match(HOUSE)[0]}"`); });
}

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
      if (iv.lap) {
        // the two laps run out of step, so no single-instance item may be in both
        const c = amrapCircuits(block, ctx, true), solo = amrapCircuits(block, ctx, false);
        if (!c.a.length || !c.b.length || !solo.a.length) fail(`${label} block ${bi + 1} (${ivId}): empty AMRAP lap`);
        c.a.forEach(x => c.b.forEach(y => {
          if (sharesSingle(x.id, y.id)) fail(`${label} block ${bi + 1} (${ivId}): AMRAP laps share gear: ${x.id} + ${y.id}`);
        }));
        [...c.a, ...c.b].forEach(x => { if (!x.reps) fail(`${label} block ${bi + 1} (${ivId}): ${x.id} has no AMRAP target`); });
        return;
      }
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
// (an EMOM counts reps instead: checked in 5b)
for (const ivId of Object.keys(INTERVALS).filter(id => !INTERVALS[id].reps)) {
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

// ------------------------------------------------- 5b. EMOM rep targets
// Every exercise says what to do each minute, in a form the screen can
// show, and a timed target leaves at least 15 seconds of the minute to rest.
const emomIds = Object.keys(INTERVALS).filter(id => INTERVALS[id].reps);
if (!emomIds.length) fail('no EMOM interval style');
ids.forEach(id => {
  const v = EXERCISES[id].emom;
  const ok = (Number.isInteger(v) && v > 0 && v <= 50)
    || (typeof v === 'string' && /^(\d+\/side|\d+s(\/side)?|\d+ [a-z ]+)$/.test(v));
  if (!ok) { fail(`${id}: emom target "${v}" should be a rep count, '8/side', '40s', '20s/side' or a short phrase`); return; }
  const secs = typeof v === 'string' && /^(\d+)s(\/side)?$/.exec(v);
  if (secs && +secs[1] * (secs[2] ? 2 : 1) > 45) fail(`${id}: emom "${v}" leaves under 15s of the minute to rest`);
});
for (const ivId of emomIds) {
  const ctx = ctxFor(ivId);
  ids.forEach(id => {
    const d = describeEx(id, ctx);
    if (!d.reps) fail(`${id} (${ivId}): no reps on screen`);
    if (/swap sides at/.test(d.cue)) fail(`${id} (${ivId}): EMOM cue still times a side swap: "${d.cue}"`);
  });
  ids.filter(id => EXERCISES[id].rotateCue && !INTERVALS[ivId].lap).forEach(id => {
    const m = /^(\d+)s$/.exec(EXERCISES[id].emom || '');
    const d = describeEx(id, ctx);
    if (!m) fail(`${id}: a rotating hold needs a timed EMOM target`);
    else if (!d.cue.includes(`${Math.round(+m[1] / EXERCISES[id].rotateCue)}s`)) fail(`${id} (${ivId}): rotation cue doesn't fit the ${m[1]}s hold: "${d.cue}"`);
  });
}

// ------------------------------- 5c. a program's splits and personal levels
// A program week's split of a timed style keeps the block at 240 seconds
// (so a day never changes length), and the cues follow it. A person's level
// moves their rep targets and nothing else, stays sensible at either end
// of its range on top of a program's build-up, and moves by the rules.
for (const prog of PROGRAMS) {
  Object.entries(prog.workRest || {}).forEach(([id, ladder]) => {
    const iv = INTERVALS[id];
    if (!iv || iv.reps) { fail(`${prog.id}: a work/rest ladder for "${id}", which isn't a timed style`); return; }
    if (ladder.length !== prog.weeks) fail(`${prog.id}: the ${id} ladder needs a rung for each of its ${prog.weeks} weeks`);
    ladder.forEach(([on, off], i) => {
      const rung = withWorkRest(iv, { [id]: [on, off] });
      if (blockSeconds(rung) !== 240) fail(`${prog.id} week ${i + 1}: ${id} at ${on}s on, ${off}s off runs ${blockSeconds(rung)}s, not 240`);
      if (!cleanWorkRest({ [id]: [on, off] })) fail(`${prog.id} week ${i + 1}: ${id} ${on}/${off} would be refused when a favourite or link comes back`);
      const half = Math.round(on / 2);
      ids.filter(x => EXERCISES[x].sideCue && !EXERCISES[x].equipment.length).slice(0, 3).forEach(x => {
        const d = describeEx(x, { rounds: rung.rounds, workSec: rung.workSec, restSec: rung.restSec, reps: false, lap: false });
        if (!d.cue.includes(`${half}s`)) fail(`${x} at ${on}s on: the cue should swap sides at ${half}s, got "${d.cue}"`);
      });
    });
    for (let i = 1; i < ladder.length; i++) {
      if (ladder[i][0] < ladder[i - 1][0]) fail(`${prog.id}: the ${id} work drops from week ${i} to week ${i + 1}`);
    }
  });
}
{
  const surf = PROGRAMS.find(p => p.id === 'surf-fit');
  const longAt = (n) => JSON.stringify(programDay(surf, n).workRest);
  if (longAt(0) !== '{"long":[30,30]}' || longAt(28) !== '{"long":[45,15]}') fail(`Surf Fit's Paddle power should run 30/30 in week 1 and 45/15 in week 5, got ${longAt(0)} and ${longAt(28)}`);
  if (programDay(surf, 3).workRest !== undefined) fail('Surf Fit Engine (EMOM, AMRAP) has no timed split to carry');
  // easing back in: more than ten days off eases, three weeks or more eases further
  const DAY = 86400000, now = new Date(2026, 9, 21, 18, 30).getTime();
  [[9, null], [10, null], [11, 1], [20, 1], [21, 2], [60, 2]].forEach(([days, steps]) => {
    const got = programEase(now - days * DAY, now);
    if ((got && got.steps) !== steps || (got && got.days !== days)) fail(`programEase after ${days} days off should be ${steps ? `${steps} step(s)` : 'none'}, got ${JSON.stringify(got)}`);
  });
  // by the calendar: last thing late on the 10th, back early on the 21st is 11 days
  if (!programEase(new Date(2026, 9, 10, 22, 0).getTime(), new Date(2026, 9, 21, 6, 0).getTime())) fail('programEase should count calendar days, not hours');
  if (programEase(null, now) !== null || programEase(undefined, now) !== null) fail('programEase with nothing done yet should be none');
  // a step down is the rung below on the rep ladder, never the same load
  const weeks = [1, 2, 3, 4, 5, 6];
  const one = weeks.map(w => easeWeek(surf, w, 1)).join(), two = weeks.map(w => easeWeek(surf, w, 2)).join();
  if (one !== '1,1,2,2,3,3' || two !== '1,1,1,1,2,2') fail(`easeWeek should go a rung down (1,1,2,2,3,3) or two (1,1,1,1,2,2), got ${one} and ${two}`);
  weeks.forEach(w => {
    const e = easeWeek(surf, w, 1);
    if (e < w && !(surf.repScale[e - 1] < surf.repScale[w - 1])) fail(`easing week ${w} to week ${e} isn't any lighter`);
  });
  // two sessions with reps, stretch days passed over: from day 21 (Paddle power) days 21 and 22; from Mobility (day 23) days 23 to 25
  const lefts = (from) => [0, 1, 2, 3].map(i => easeLeft(surf, from, from + i)).join();
  if (lefts(21) !== '2,1,0,0' || lefts(23) !== '2,2,1,0' || easeLeft(surf, 21, 20) !== 0) fail(`easeLeft should cover two sessions with reps, got ${lefts(21)} and ${lefts(23)}`);
  const eased = easedDay(surf, programDay(surf, 21), 2);
  if (eased.n !== 21 || eased.week !== 4 || eased.repScale !== 0.9 || JSON.stringify(eased.workRest) !== '{"long":[35,25]}' || eased.name !== 'Paddle power')
    fail(`an eased week-4 Paddle power keeps its day and week, at week 2's load: ${JSON.stringify(eased)}`);
  if (JSON.stringify(weekLoad(surf, surf.days[0], 4)) !== JSON.stringify({ repScale: 1, workRest: { long: [40, 20] } })) fail('weekLoad should match programDay');
  if (EASE_SESSIONS !== 2) fail('easing back in is for two sessions');
  // the flat-day paddles: three short lines each, on the paddle days only
  WATER_SESSIONS.forEach(w => {
    if (!w.id || !w.name || !w.about) fail(`water session ${JSON.stringify(w)}: needs an id, name and about`);
    if (!Array.isArray(w.lines) || w.lines.length !== 3) fail(`${w.id}: three lines to remember, got ${w.lines && w.lines.length}`);
    (w.lines || []).forEach(l => { if (l.length > 70) fail(`${w.id}: "${l}" is too long to remember (${l.length} characters)`); });
  });
  if (new Set(WATER_SESSIONS.map(w => w.id)).size !== WATER_SESSIONS.length) fail('water session ids must be unique');
  if (!/mate/.test(WATER_SAFETY) || !/inside the break/.test(WATER_SAFETY) || !/dizzy/.test(WATER_SAFETY)) fail(`the water safety line should say paddle with someone, stay inside the break and stop if dizzy: ${WATER_SAFETY}`);
  PROGRAMS.forEach(prog => prog.days.forEach(d => {
    if (!d.water) return;
    if (d.stretch || d.focus !== 'paddle') fail(`${prog.id} ${d.name}: flat-day paddles belong on paddle days`);
    d.water.forEach(id => { if (!WATER_SESSIONS.some(w => w.id === id)) fail(`${prog.id} ${d.name}: unknown water session "${id}"`); });
  }));
  if (surf.days.filter(d => d.water).map(d => d.name).join() !== 'Paddle power,Paddle & shoulders') fail('Surf Fit\'s two paddle days have the flat-day paddles');
  // the Surf check: three tests of floor moves with no gear, each done one way, said in a line
  const tests = SURF_CHECK.stations;
  if (tests.map(t => t.id).join() !== 'popups,pushups,paddle') fail(`the Surf check is pop-ups, push-ups and a paddle hold: ${tests.map(t => t.id)}`);
  tests.forEach(t => {
    const ex = EXERCISES[t.ex];
    if (!ex || !ex.img) fail(`Surf check ${t.id}: "${t.ex}" needs to be a move with a figure`);
    else if (ex.equipment.length) fail(`Surf check ${t.id}: "${t.ex}" needs gear, and the check is for anywhere`);
    if (!t.label || !t.short || !t.how || !(t.sec > 0) || !(t.most >= t.sec || !t.hold)) fail(`Surf check ${t.id}: needs a label, short name, how, seconds and a top result`);
    if (!t.standard || t.standard.length > 150) fail(`Surf check ${t.id}: its one way of doing it should be said in a line (${(t.standard || '').length} characters)`);
  });
  if (tests.filter(t => t.hold).map(t => t.id).join() !== 'paddle' || tests[tests.length - 1].hold !== true) fail('the paddle hold is the one timed test, and comes last');
  if (checkSeconds(SURF_CHECK) !== 710 || checkMinutes(SURF_CHECK) !== 10) fail(`the Surf check is about ten minutes (11:50 with the hold run out): ${checkSeconds(SURF_CHECK)}s, about ${checkMinutes(SURF_CHECK)} min`);
  const shape = checkShape(SURF_CHECK);
  const warm = warmupPlan(shape, {}), cool = cooldownPlan(shape, {});
  if (warm.reduce((t, m) => t + m.sec, 0) !== SURF_CHECK.warmupSec || cool.reduce((t, m) => t + m.sec, 0) !== SURF_CHECK.cooldownSec) fail('the Surf check warm-up and cool-down fill their time');
  if (warm.some(m => !m.id) || warm[warm.length - 1].id !== 'popUp') fail(`the Surf check warm-up is real moves, a slow pop-up last: ${warm.map(m => m.id)}`);
  // on day 1 of weeks 1, 3 and 5, each a Paddle power day, and one more after the end
  const checkOn = [...Array(surf.weeks * surf.days.length + 2)].map((_, n) => n).filter(n => isCheckDay(surf, n));
  if (checkOn.join() !== '0,14,28' || !surf.finalCheck) fail(`Surf Fit's Surf checks are days 1, 15 and 29 and one at the end: ${checkOn}`);
  checkOn.forEach(n => { if (programDay(surf, n).name !== 'Paddle power') fail(`the Surf check on day ${n + 1} should take a Paddle power day, not ${programDay(surf, n).name}`); });
  // against last time, in plain words
  const [pops, , hold] = tests;
  [[pops, 12, 9, '3 more than last time'], [pops, 8, 9, '1 fewer than last time'], [pops, 9, 9, 'Same as last time'],
   [hold, 95, 70, '25s longer than last time'], [hold, 180, 70, '1:50 longer than last time'], [hold, 60, 125, '1:05 shorter than last time'],
   [pops, 9, null, ''], [pops, 0, 9, '']].forEach(([t, now, before, want]) => {
    const got = checkChange(t, now, before);
    if (got !== want) fail(`checkChange(${t.id}, ${now}, ${before}) should say "${want}", got "${got}"`);
  });
  const bad = [{ long: [50, 20] }, { emom: [30, 30] }, { long: [60, 0] }, { short: ['20', '10'] }, { toString: [30, 30] }, [30, 30], { long: [30, 30], short: [1, 29] }];
  bad.forEach(x => { if (cleanWorkRest(x) !== undefined) fail(`cleanWorkRest should refuse ${JSON.stringify(x)}`); });
  if (JSON.stringify(cleanWorkRest({ long: [45, 15], short: [25, 5] })) !== '{"long":[45,15],"short":[25,5]}') fail('cleanWorkRest should keep good splits');
}
{
  // the rules: two Too easy in a row up a notch, one Cooked down, held between 0.7 and 1.3
  const run = (feels, from = null) => feels.reduce((rec, f) => nextLevel(rec, f), from);
  const cases = [
    [['easy'], 1, 1], [['easy', 'easy'], 1.1, 0], [['easy', 'right', 'easy'], 1, 1], [['cooked'], 0.9, 0],
    [['easy', 'cooked'], 0.9, 0], [Array(12).fill('easy'), 1.3, 0], [Array(9).fill('cooked'), 0.7, 0],
    [['easy', 'easy', 'easy', 'easy', 'cooked'], 1.1, 0]
  ];
  cases.forEach(([feels, k, easy]) => {
    const got = run(feels);
    if (got.k !== k || got.easy !== easy) fail(`levels: ${feels.join(', ')} should leave ${k} (${easy} waiting), got ${got.k} (${got.easy})`);
  });
  if (JSON.stringify(cleanRepScales({ wayne: 1.1, '#b': 0.9 })) !== '{"wayne":1.1,"#b":0.9}') fail('cleanRepScales should keep levels in range');
  [{ wayne: 1.4 }, { wayne: 0.6 }, { wayne: 1 }, { wayne: '1.1' }, null, [1.1]].forEach(x => {
    if (cleanRepScales(x) !== undefined) fail(`cleanRepScales should refuse ${JSON.stringify(x)}`);
  });
  const diffs = [[13, 12, '+1 rep'], [22, 20, '+2 reps'], [9, 10, '−1 rep'], ['45s', '40s', '+5s'], ['9/side', '8/side', '+1 each side'], [12, 12, ''], ['1 lap', '1 lap', '']];
  diffs.forEach(([a, b, want]) => { if (targetDiff(a, b) !== want) fail(`targetDiff(${a}, ${b}) should be "${want}", got "${targetDiff(a, b)}"`); });
  // every target readable at both ends of the range, on top of a program's
  // lightest and heaviest weeks, and an EMOM's timed effort still leaves
  // 15 seconds of the minute
  for (const ivId of emomIds) {
    for (const repScale of [undefined, 0.8, 1.1]) {
      for (const level of [LEVEL_MIN, LEVEL_MAX]) {
        const ctx = { ...ctxFor(ivId), repScale, level };
        ids.forEach(id => {
          const d = describeEx(id, ctx), plain = describeEx(id, { ...ctx, level: undefined });
          if (!d.reps || /^0|NaN|undefined/.test(d.reps)) fail(`${id} (${ivId}) at level ${level}, scale ${repScale}: reads "${d.reps}"`);
          const m = !INTERVALS[ivId].lap && /^(\d+)s( each side)?$/.exec(d.reps);
          if (m && +m[1] * (m[2] ? 2 : 1) > 45) fail(`${id} (EMOM) at level ${level}, scale ${repScale}: "${d.reps}" leaves under 15s of the minute`);
          if (d.id !== plain.id || d.display !== plain.display) fail(`${id}: a level changed the move itself`);
          if (d.reps !== plain.reps && !d.more) fail(`${id} (${ivId}) at level ${level}: the target moved but the card wouldn't say why`);
          if (d.reps === plain.reps && d.more) fail(`${id} (${ivId}) at level ${level}: says "${d.more}" but the target didn't move`);
        });
      }
    }
  }
  // the timed styles have no reps, so a level leaves them exactly as they were
  for (const ivId of Object.keys(INTERVALS).filter(id => !INTERVALS[id].reps)) {
    ids.forEach(id => {
      const a = describeEx(id, { ...ctxFor(ivId), level: LEVEL_MAX }), b = describeEx(id, ctxFor(ivId));
      if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${id} (${ivId}): a level changed a timed card`);
    });
  }
}

// -------------------------------------- 6. blockSwap swaps at the halfway
// (an AMRAP or For Time block is one lap, with each person on one of the two loads)
for (const ivId of Object.keys(INTERVALS).filter(id => !INTERVALS[id].lap)) {
  const iv = INTERVALS[ivId];
  const ctx = ctxFor(ivId);
  const swapBlock = CLASSICS.flatMap(w => w.blocks).find(b => b.shape === 'swap');
  const seen = new Set();
  for (let r = 1; r <= iv.rounds; r++) seen.add(swapBlock.solo(r, ctx).id);
  if (seen.size !== 2) {
    fail(`blockSwap only used ${seen.size} of its 2 loads over ${iv.rounds} rounds (${ivId}). ` +
         `The halfway swap is not firing.`);
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
// And the timed styles do the same total work, which is the whole point of
// the "long efforts" option, fewer stops, not less work. (An EMOM's work is
// set by the reps, not the clock.)
const work = Object.keys(INTERVALS).filter(id => !INTERVALS[id].reps).map(id => INTERVALS[id].rounds * INTERVALS[id].workSec);
if (new Set(work).size !== 1) {
  fail(`interval styles disagree on total work: ${work.join(' vs ')}s`);
}

// ------------------------------------- 7b. warm-up and cool-down moves
// The warm-up is real moves with figures and the cool-down stretches,
// filling exactly the seconds the plan gives each (so a session still runs
// to the minute), about 30 to 45 seconds a move. Nothing in a warm-up jumps
// or runs, needs gear that's off or that two people can't share, or is
// something left out; No floor work leaves standing stretches only. And
// it's the same every time it's worked out: nothing random goes into it.
let bookendsChecked = 0;
function checkBookends(label, w, equipment, blockedTags = []) {
  const opts = { hasEquip: (id) => equipment[id] !== false, blockedTags };
  const warm = warmupPlan(w, opts), cool = cooldownPlan(w, opts);
  const sum = (xs) => xs.reduce((t, x) => t + x.sec, 0);
  bookendsChecked++;
  if (sum(warm) !== w.warmupSec) fail(`${label}: the warm-up's moves run ${sum(warm)}s, the plan gives it ${w.warmupSec}s`);
  if (sum(cool) !== w.cooldownSec) fail(`${label}: the cool-down's stretches run ${sum(cool)}s, the plan gives it ${w.cooldownSec}s`);
  if (w.warmupSec > 0 && warm.length !== Math.min(8, Math.ceil(w.warmupSec / 45))) fail(`${label}: ${warm.length} warm-up moves in ${w.warmupSec}s`);
  warm.forEach(m => {
    const ex = EXERCISES[m.id];
    if (!ex) { fail(`${label}: a warm-up move nothing fitted ("${m.id}")`); return; }
    if (m.sec < 25 || m.sec > 60) fail(`${label}: ${m.id} runs ${m.sec}s of the warm-up`);
    if (ex.tags.includes('impact') || ex.tags.includes('running')) fail(`${label}: ${m.id} in the warm-up jumps or runs`);
    if (ex.tags.some(t => blockedTags.includes(t))) fail(`${label}: ${m.id} in the warm-up is left out (${blockedTags.join(',')})`);
    if (!ex.equipment.every(e => equipment[e] !== false)) fail(`${label}: ${m.id} in the warm-up needs gear that is switched off`);
    if (ex.equipment.some(e => SINGLE_INSTANCE.includes(e))) fail(`${label}: ${m.id} in the warm-up needs gear two people can't share`);
    if (!MOVES[m.id] && !MOVES[ex.img]) fail(`${label}: ${m.id} in the warm-up has no figure`);
    const card = warmupCard(m.id, m.sec);
    if (!card.img || !card.cue || card.reps) fail(`${label}: ${m.id}'s warm-up card is missing its figure or cue`);
    if (ex.sideCue && !card.cue.includes(`${Math.round(m.sec / 2)}s`)) fail(`${label}: ${m.id} should swap sides halfway through its ${m.sec}s`);
  });
  if (new Set(warm.map(m => EXERCISES[m.id] && EXERCISES[m.id].img)).size !== warm.length) fail(`${label}: the same move twice in the warm-up`);
  if (w.cooldownSec > 0 && cool.length !== Math.min(10, Math.ceil(w.cooldownSec / 45))) fail(`${label}: ${cool.length} stretches in ${w.cooldownSec}s`);
  cool.forEach((m, i) => {
    const st = STRETCHES.find(x => x.id === m.id);
    if (!st) { fail(`${label}: a cool-down stretch nothing fitted ("${m.id}")`); return; }
    if (m.sec < 25 || m.sec > 60) fail(`${label}: ${m.id} gets ${m.sec}s of the cool-down`);
    // the two sides of a stretch, back to back and as long as each other
    const next = cool[i + 1] && STRETCHES.find(x => x.id === cool[i + 1].id);
    const prev = cool[i - 1] && STRETCHES.find(x => x.id === cool[i - 1].id);
    if (/, left$/.test(st.name) && !(next && next.name === st.name.replace(/left$/, 'right') && Math.abs(cool[i + 1].sec - m.sec) <= 1)) {
      fail(`${label}: ${m.id} in the cool-down isn't followed by its other side for as long`);
    }
    if (/, right$/.test(st.name) && !(prev && prev.name === st.name.replace(/right$/, 'left'))) fail(`${label}: ${m.id} in the cool-down without its left side first`);
    if (blockedTags.includes('floor') && st.pos !== 'stand') fail(`${label}: ${m.id} in the cool-down is floor work, which is left out`);
    const card = cooldownCard(m.id);
    if (card.name !== st.name || !card.cue || card.img) fail(`${label}: ${m.id}'s cool-down card reads "${card.name}"`);
  });
  if (new Set(cool.map(m => m.id)).size !== cool.length) fail(`${label}: the same stretch twice in the cool-down`);
  if (JSON.stringify([warmupPlan(w, opts), cooldownPlan(w, opts)]) !== JSON.stringify([warm, cool])) fail(`${label}: worked out again, the warm-up or cool-down came out different`);
  return { warm, cool };
}
// and the stretches follow what was worked: a legs session stretches only
// legs and hips, and one aimed at the chest and shoulders or the core
// (which brings some legs along) stretches those too
{
  const areaOf = (id) => Object.keys(A.COOLDOWN_STRETCHES).find(a => A.COOLDOWN_STRETCHES[a].some(u => u.includes(id))) || id;
  for (const [regions, want, only] of [[['legs'], ['legs', 'hips'], true], [['push'], ['shoulders']], [['pull'], ['shoulders', 'back']], [['core'], ['back']]]) {
    for (const seed of [77, 4242]) {
      const w = generateWorkout({ minutes: 30, people: 1, intervalId: 'short', regions, equipment: ALL_EQUIP, seed, recent: [] });
      const got = cooldownPlan(w, {}).map(m => areaOf(m.id)).filter(a => a !== 'savasana');
      if (only ? got.some(a => !want.includes(a)) : !want.every(a => got.includes(a))) {
        fail(`a ${regions[0]} session's cool-down stretches ${got.join(', ')}, not ${only ? 'only ' : ''}${want.join(' and ')}`);
      }
    }
  }
}
CLASSICS.forEach(c => {
  // a classic's bookends come from its length, as the app works them out
  const w = { ...c, ...A.classicBookends(c) };
  checkBookends(`classic "${w.id}"`, w, ALL_EQUIP);
  checkBookends(`classic "${w.id}" (bodyweight only, no floor)`, w, bodyOnly, ['floor']);
});

// ------------------------------------------------- 8. generator sweep
const REGION_SUBSETS = [];
for (let mask = 1; mask < (1 << REGION_IDS.length); mask++) {
  REGION_SUBSETS.push(REGION_IDS.filter((_, i) => mask & (1 << i)));
}
const EQUIP_CASES = [
  ['full kit', ALL_EQUIP],
  ['no kettlebells', noKb],
  ['bodyweight only', bodyOnly],
  ['rings + rope only', { ...bodyOnly, rings: true, rope: true }],
  ['bar, bands, ball and box only', { ...bodyOnly, pullupBar: true, bands: true, medball: true, box: true }]
];
const TAG_CASES = [[], ['impact'], ['floor'], ['impact', 'floor', 'running'],
                   ['impact', 'floor', 'overhead', 'running']];

let generated = 0, errored = 0, exact = 0;
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

        // And it runs to the minutes picked. Anything short of the mark goes
        // on the cool-down, unless blocks went unfilled; whole blocks that
        // overshoot (15 and 40 min) take it off the bookends instead.
        const off = realSeconds(w, ivId) - minutes * 60;
        const unfilled = w.notes.some(n => n.startsWith('Only '));
        if (off < 0 && !unfilled) fail(`${label} runs ${-off}s short of the ${minutes} min picked`);
        if (off > 0) fail(`${label} runs ${off}s over the ${minutes} min picked`);
        if (w.warmupSec < 60 || w.cooldownSec < 60) fail(`${label}: bookends squeezed to nothing`);
        if (off === 0) exact++;
        const { warm } = checkBookends(label, w, equipment, blockedTags);
        // with the gear and nothing left out, the warm-up ends on a light go
        // at the first block's movement
        const lead = WARMUP_REHEARSAL[EXERCISES[w.blocks[0].ids[0]].pattern];
        if (equipLabel === 'full kit' && !blockedTags.length && warm.length >= 2 && !warm.some(m => lead.includes(m.id))) {
          fail(`${label}: the warm-up has no go at block 1's ${EXERCISES[w.blocks[0].ids[0]].pattern} (${warm.map(m => m.id).join(', ')})`);
        }

        // A sentence, not a capital in the middle of one.
        if (/, [A-Z]/.test(w.blurb)) fail(`${label} blurb has a capital mid-sentence: "${w.blurb}"`);

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
// Every length runs to the second in every style: pick 20 minutes and the
// timer says 20:00. 15 and 40 get there by trimming the bookends, keeping
// the blocks a favourite saved at that length was built with.
for (const minutes of minutesList) {
  for (const ivId of Object.keys(INTERVALS)) {
    const w = generateWorkout({ minutes, people: 1, intervalId: ivId, regions: REGION_IDS,
      equipment: ALL_EQUIP, seed: 4000 + minutes, recent: [] });
    if (w.error) { fail(`${ivId} at ${minutes} min: ${w.error}`); continue; }
    if (realSeconds(w, ivId) !== minutes * 60) fail(`${ivId} at ${minutes} min runs ${realSeconds(w, ivId)}s, not ${minutes * 60}s`);
    if (w.name !== `Full Body · ${minutes} min`) fail(`${ivId} at ${minutes} min is called "${w.name}"`);
  }
}
// and 15 and 40 keep the blocks they always had, so a favourite saved at
// either length rebuilds the same moves
for (const [minutes, n] of [[15, 3], [40, 7]]) {
  const plan = planBlocks(minutes, INTERVALS[DEFAULT_INTERVAL]);
  if (plan.blocks !== n) fail(`${minutes} min plans ${plan.blocks} blocks, not the ${n} it was built with before`);
}

// --------------------------------------------- 8b. mixed sessions
// Every mix of two or three styles, in every order, at every length: it
// either lands exactly on the minutes asked for, warm-up and cool-down
// included (to within a minute when it's blocks only), with each style
// true to itself, or it's refused as too short.
const styleIds = Object.keys(INTERVALS);
const mixes = [];
for (const a of styleIds) for (const b of styleIds) {
  if (b === a) continue;
  mixes.push([a, b]);
  for (const c of styleIds) if (c !== a && c !== b) mixes.push([a, b, c]);
}
let mixBuilt = 0, mixRefused = 0;
mixes.forEach((mix, mi) => {
  for (const minutes of minutesList) {
    const plan = planMix(minutes, mix);
    const w = generateWorkout({ minutes, people: 2, intervalId: 'mix', mix, regions: REGION_IDS,
      equipment: EQUIP_CASES[mi % EQUIP_CASES.length][1], seed: 1000 + mi * 10 + minutes, recent: [] });
    const label = `mix ${mix.join('/')} at ${minutes} min`;
    if (plan.error) {
      if (!w.error) fail(`${label}: built although the plan says it doesn't fit`);
      mixRefused++;
      continue;
    }
    if (w.error) { fail(`${label}: ${w.error}`); continue; }
    mixBuilt++;
    const real = w.warmupSec + w.cooldownSec + (w.sections.length - 1) * w.changeoverSec
               + w.sections.reduce((t, x) => t + sectionSeconds(x), 0);
    const flex = mix.some(isFlexible);
    if (flex ? real !== minutes * 60 : Math.abs(real - minutes * 60) > 60) {
      fail(`${label}: runs ${real}s, not ${minutes * 60}s`);
    }
    let next = 0;
    w.sections.forEach((x, i) => {
      if (x.intervalId !== mix[i]) fail(`${label}: section ${i + 1} is ${x.intervalId}, not ${mix[i]}`);
      if (x.start !== next || x.count < 1) fail(`${label}: section ${i + 1} doesn't follow on from the last`);
      next = x.start + x.count;
      if (isFlexible(x.intervalId) ? (x.count !== 1 || x.minutes < FLEX_MIN_MINUTES) : x.minutes) {
        fail(`${label}: section ${i + 1} (${x.intervalId}) isn't true to its style`);
      }
    });
    if (next !== w.blocks.length) fail(`${label}: sections cover ${next} of ${w.blocks.length} blocks`);
    if (w.warmupSec < 60 || w.cooldownSec < 60) fail(`${label}: bookends squeezed to nothing`);
    checkBlocks(label, w, EQUIP_CASES[mi % EQUIP_CASES.length][1]);
    checkBookends(label, w, EQUIP_CASES[mi % EQUIP_CASES.length][1]);
  }
});

// ------------------------------------------------- 8c. surf fitness
// The Surf goal builds only from surf exercises, gets pop-up and paddle
// work in as soon as there's room for two blocks, keeps two people off
// shared gear, and fits a mix as well as a single style.
let surfBuilt = 0;
for (const [equipLabel, equipment] of EQUIP_CASES) {
  for (const minutes of minutesList) {
    for (const ivId of [...Object.keys(INTERVALS), 'mix']) {
      const mix = ivId === 'mix' ? ['emom', 'short', 'amrap'] : undefined;
      const w = generateWorkout({ minutes, people: 2, intervalId: ivId, mix, goal: 'surf', equipment,
        regions: ['legs'], seed: 5000 + minutes + surfBuilt, recent: [] });
      const label = `surf, ${equipLabel}, ${minutes} min, ${ivId}`;
      if (w.error) {
        if (!(ivId === 'mix' && planMix(minutes, mix).error)) fail(`${label}: ${w.error}`);
        continue;
      }
      surfBuilt++;
      const ids = w.blocks.flatMap(b => b.ids);
      ids.forEach(id => { if (!(EXERCISES[id].surf || []).length) fail(`${label}: ${id} isn't a surf exercise`); });
      if (w.blocks.length >= 2) {
        for (const need of ['popup', 'paddle']) {
          if (!ids.some(id => EXERCISES[id].surf.includes(need))) fail(`${label}: no ${need} work`);
        }
      }
      if (w.request.goal !== 'surf') fail(`${label}: the request doesn't remember the surf goal`);
      checkBlocks(label, w, equipment);
      // a surfer's warm-up: shoulder prep and a slow pop-up first, then the
      // upper back turning
      const { warm } = checkBookends(label, w, equipment);
      const has = (fn) => warm.some(m => EXERCISES[m.id] && fn(m.id));
      if (!has(id => id === 'popUp')) fail(`${label}: no pop-up in the warm-up (${warm.map(m => m.id).join(', ')})`);
      if (!has(id => (EXERCISES[id].surf || []).includes('shoulders'))) fail(`${label}: no shoulder prep in the warm-up (${warm.map(m => m.id).join(', ')})`);
      if (warm.length >= 3 && !has(id => id === 'thoracicRotation')) fail(`${label}: no upper-back rotation in the warm-up`);
      if (warm[warm.length - 1].id !== 'popUp') fail(`${label}: the warm-up should end on the pop-up, it ends on ${warm[warm.length - 1].id}`);
    }
  }
}
// Surf hides the target areas, so its notes and errors never name them,
// and a note says which parts of surfing had to go.
{
  const areaLabels = REGIONS.map(r => r.label);
  for (const [equipLabel, equipment] of EQUIP_CASES) for (const blockedTags of TAG_CASES) {
    const w = generateWorkout({ minutes: 20, people: 1, intervalId: 'short', goal: 'surf', equipment, blockedTags,
      regions: REGION_IDS, seed: 6100, recent: [] });
    const said = w.error || w.notes.join(' ');
    const named = areaLabels.filter(l => said.includes(l));
    if (named.length) fail(`surf, ${equipLabel}, no:${blockedTags.join(',') || '-'}: names target areas (${named.join(', ')}): ${said}`);
  }
  const legsOnly = generateWorkout({ minutes: 20, people: 1, intervalId: 'short', goal: 'surf', equipment: bodyOnly,
    blockedTags: ['floor'], regions: REGION_IDS, seed: 6101, recent: [] });
  if (!legsOnly.notes.some(n => n.includes('paddle strength'))) fail(`surf, bodyweight, no floor work: no note that paddling was skipped: ${legsOnly.notes.join(' ')}`);
  const none = generateWorkout({ minutes: 20, people: 1, intervalId: 'short', goal: 'surf', equipment: bodyOnly,
    excluded: ids, regions: REGION_IDS, seed: 6102, recent: [] });
  if (!none.error || /target areas/.test(none.error)) fail(`surf with everything left out: "${none.error}"`);
}

// ------------------------------------------------------ 8d. programs
// Every day of every program builds at every length (the program screen
// offers them all; a mix too long for the time runs as its first style),
// with every kit and every leave-out, and the build-up keeps targets
// sensible.
let programDays = 0;
for (const prog of PROGRAMS) {
  const total = prog.weeks * prog.days.length;
  if (prog.repScale.length !== prog.weeks) fail(`${prog.id}: a rep scale for each of its ${prog.weeks} weeks`);
  for (let n = 0; n < total; n++) {
    const day = programDay(prog, n);
    const label = `${prog.id} day ${n + 1} (${day.name})`;
    if (day.week < 1 || day.week > prog.weeks) fail(`${label}: week ${day.week}`);
    if (day.stretch) {
      if (!STRETCH_ROUTINES.some(r => r.id === day.stretch)) fail(`${label}: no stretch routine "${day.stretch}"`);
      continue;
    }
    const min = day.mix ? mixMinimumMinutes(day.mix) : 10;
    if (!min || min > day.minutes) fail(`${label}: suggests ${day.minutes} min but needs ${min}`);
    for (const minutes of minutesList) {
      const [equipLabel, equipment] = EQUIP_CASES[(n + minutes) % EQUIP_CASES.length];
      const blockedTags = TAG_CASES[(n + minutes) % TAG_CASES.length];
      const { intervalId, mix, short } = programStyle(day, minutes);
      if (!!short !== !!(day.mix && minutes < min)) fail(`${label}, ${minutes} min: ran as ${intervalId}, the mix needs ${min}`);
      if (short && intervalId !== day.mix[0]) fail(`${label}, ${minutes} min: too short for the mix should run ${day.mix[0]}, got ${intervalId}`);
      const w = generateWorkout({ minutes, people: 2, intervalId, mix,
        goal: prog.goal, surfFocus: day.focus, repScale: day.repScale, workRest: day.workRest, equipment, blockedTags,
        regions: REGION_IDS, seed: 9000 + n * 100 + minutes, recent: [] });
      if (w.error) { fail(`${label}, ${minutes} min, ${equipLabel}, no:${blockedTags.join(',') || '-'}: ${w.error}`); continue; }
      programDays++;
      if (w.repScale !== day.repScale) fail(`${label}: the build-up didn't reach the workout`);
      if (JSON.stringify(w.workRest) !== JSON.stringify(day.workRest) || JSON.stringify(w.request.workRest) !== JSON.stringify(day.workRest)) {
        fail(`${label}: the week's split (${JSON.stringify(day.workRest)}) didn't reach the workout and its request`);
      }
      // a split is timing only: the same seed picks the same moves without it, and the session runs as long
      if (day.workRest) {
        const flat = generateWorkout({ minutes, people: 2, intervalId, mix, goal: prog.goal, surfFocus: day.focus, repScale: day.repScale,
          equipment, blockedTags, regions: REGION_IDS, seed: 9000 + n * 100 + minutes, recent: [] });
        if (flat.exerciseIds.join() !== w.exerciseIds.join()) fail(`${label}: the week's split changed the moves`);
        const secs = (x) => (x.sections || [{ intervalId: x.intervalId, count: x.blocks.length, blockRestSec: x.blockRestSec }])
          .reduce((t, sec) => t + sec.count * blockSeconds(sectionInterval(sec, x.workRest)), 0);
        if (secs(w) !== secs(flat)) fail(`${label}: the week's split changed how long the blocks run`);
      }
      checkBlocks(`${label}, ${minutes} min`, w, equipment);
      checkBookends(`${label}, ${minutes} min`, w, equipment, blockedTags);
      const left = w.blocks.flatMap(b => b.ids).filter(id => EXERCISES[id].tags.some(t => blockedTags.includes(t)));
      if (left.length) fail(`${label}, ${minutes} min: left out ${blockedTags.join(',')} but got ${left.join(', ')}`);
      const style = day.mix ? day.mix[0] : day.style;
      if (!INTERVALS[style].reps) continue;           // timed styles have no reps to scale
      const ctx = { ...ctxFor(style, equipment), repScale: day.repScale };
      w.blocks.flatMap(b => b.ids).forEach(id => {
        const d = describeEx(id, ctx);
        if (!d.reps || /^0|NaN/.test(d.reps)) fail(`${label}: ${id} reads "${d.reps}"`);
      });
    }
  }
}

// --------------------------------------------------- 8e. the export script
// scripts/export-sequence.mjs hands the Garmin work the steps the timer
// runs. Every style exports at its real length with no empty steps, EMOM
// targets and AMRAP / For Time laps come through, and what it can't do (a
// classic as a mix) is refused with a reason rather than exported wrong.
let exported = 0;
{
  const run = (args) => JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts/export-sequence.mjs'), ...args], { encoding: 'utf8' }));
  const power = CLASSICS.find(w => w.id === 'power-hour');
  const pb = A.classicBookends(power);
  const powerSec = pb.warmupSec + pb.cooldownSec + power.blocks.length * 240 + (power.blocks.length - 1) * power.blockRestSec;
  const cases = [
    ...Object.keys(INTERVALS).map(id => [`generated ${id}, 20 min`, ['--generate', '--minutes', '20', '--interval', id], 1200, id]),
    ...Object.keys(INTERVALS).map(id => [`power-hour as ${id}, two people`, ['power-hour', '--interval', id, '--people', '2'], powerSec, id]),
    ['generated mix, 30 min', ['--generate', '--minutes', '30', '--interval', 'mix', '--mix', 'emom,short,amrap'], 1800, 'mix']
  ];
  for (const [label, args, want, style] of cases) {
    let out;
    try { out = run(args); } catch (e) { fail(`export ${label}: ${String(e.stderr || e).trim()}`); continue; }
    exported++;
    if (out.totalSeconds !== want) fail(`export ${label}: ${out.totalSeconds}s, the timer runs ${want}s`);
    if (out.steps.some(x => !(x.seconds > 0))) fail(`export ${label}: a step with no length`);
    const work = out.steps.filter(x => x.kind === 'work');
    const iv = INTERVALS[style];
    if (iv && iv.reps && !iv.lap && work.some(x => x.seconds !== 60 || !x.reps)) fail(`export ${label}: an EMOM minute without its reps`);
    if (iv && iv.lap && work.some(x => !x.lap || !x.lap.length || !x.lap.every(e => e.reps) || (iv.forTime && !(x.laps > 0)))) {
      fail(`export ${label}: a lap step without its exercises, reps or laps`);
    }
    if (iv && iv.lap && args.includes('2') && work.some(x => !x.lapB)) fail(`export ${label}: no lap for person B`);
    if (style === 'mix' && (out.interval.id !== 'mix' || out.steps.filter(x => x.kind === 'changeover').length !== 2)) {
      fail(`export ${label}: not three sections with a changeover between each`);
    }
  }
  try {
    run(['power-hour', '--interval', 'mix']);
    fail('export: a classic as a mix should be refused');
  } catch (e) {
    if (!/a classic runs in one style/.test(String(e.stderr))) fail(`export: a classic as a mix is refused without saying why: ${e.stderr}`);
  }
}

// ------------------------------------------------------- 8f. FIT picks
// Left to FIT, the style is worked out from the time, the goal and the
// sessions before, with nothing random: the same three always pick the
// same style (so the home card names what Start builds). Whatever the
// sessions were, the pick fits the minutes (a mix only from half an hour,
// and only one that fits; a long session a steadier style), builds to the
// second, and changes from one session to the next, going round every
// style on offer before any comes back (in another order after a mix,
// which counts as each style in it too). And each style says how it works
// in one plain sentence, with the seconds it really runs at.
let picksChecked = 0;
{
  const fitPicks = A.fitPicks, styleHow = A.styleHow;
  const all = [...Object.keys(INTERVALS), 'mix'];
  const asSession = (p) => (p.intervalId === 'mix' ? ['mix', ...p.mix] : [p.intervalId]);
  // some sessions before: none, the program's, random ones (seeded), stretching and junk
  const rand = (() => { let x = 7; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const histories = [[], [['long']], [['short'], ['short'], ['emom']], [['mix', 'emom', 'amrap'], ['fortime']], [null, 'junk', ['toString'], []]];
  for (let i = 0; i < 20; i++) histories.push(Array.from({ length: Math.floor(rand() * 14) }, () => asSession(
    (() => { const id = all[Math.floor(rand() * all.length)]; return id === 'mix' ? { intervalId: 'mix', mix: ['emom', 'short', 'amrap'] } : { intervalId: id }; })())));
  for (const goal of ['general', 'surf']) {
    for (const minutes of minutesList) {
      const pool = new Set();
      for (const h of histories) {
        const label = `FIT picks, ${goal}, ${minutes} min after ${JSON.stringify(h)}`;
        const pick = fitPicks(minutes, goal, h);
        picksChecked++;
        if (JSON.stringify(fitPicks(minutes, goal, JSON.parse(JSON.stringify(h)))) !== JSON.stringify(pick)) fail(`${label}: picks differently the second time`);
        const ok = pick && (pick.intervalId === 'mix' ? Array.isArray(pick.mix) && pick.mix.length >= 2 && pick.mix.every(id => INTERVALS[id]) : INTERVALS[pick.intervalId] && pick.mix === undefined);
        if (!ok) { fail(`${label}: not a style: ${JSON.stringify(pick)}`); continue; }
        pool.add(pick.intervalId);
        if (pick.intervalId === 'mix' && (minutes < 30 || planMix(minutes, pick.mix).error)) fail(`${label}: a mix that doesn't fit`);
        if (minutes >= 45 && !['long', 'emom', 'mix'].includes(pick.intervalId)) fail(`${label}: ${pick.intervalId} for three quarters of an hour or more`);
        const w = generateWorkout({ minutes, people: 2, intervalId: pick.intervalId, mix: pick.mix, goal: goal === 'surf' ? 'surf' : undefined,
          regions: REGION_IDS, equipment: ALL_EQUIP, excluded: [], blockedTags: [], seed: 500 + picksChecked, recent: [] });
        if (w.error) { fail(`${label}: ${w.error}`); continue; }
        const secs = w.sections || [{ intervalId: w.intervalId, count: w.blocks.length, minutes: 0, blockRestSec: w.blockRestSec }];
        const real = w.warmupSec + w.cooldownSec + (secs.length - 1) * (w.changeoverSec || 0) + secs.reduce((t, x) => t + sectionSeconds(x), 0);
        if (real !== minutes * 60) fail(`${label}: builds ${real}s, not ${minutes * 60}s`);
        if (w.request.intervalId !== pick.intervalId || JSON.stringify(w.request.mix) !== JSON.stringify(pick.mix)) fail(`${label}: the build's request doesn't keep the style`);
        // and the same request and seed build it again exactly, as a favourite or a link does
        const again = generateWorkout({ ...w.request, equipment: ALL_EQUIP, excluded: [], seed: w.seed });
        if (again.error || again.exerciseIds.join() !== w.exerciseIds.join() || JSON.stringify(again.sections) !== JSON.stringify(w.sections)) fail(`${label}: its request and seed build something else`);
      }
      // session after session: never the same twice running, and round every style on offer before one comes back
      const offered = all.filter(id => id === 'mix' ? minutes >= 30 : minutes < 45 || id === 'long' || id === 'emom');
      let h = [];
      const run = [];
      for (let n = 0; n < offered.length * 2; n++) {
        const pick = fitPicks(minutes, goal, h);
        run.push(pick.intervalId);
        h = [asSession(pick), ...h];
      }
      const label = `FIT picks, ${goal}, ${minutes} min, session after session (${run.join(',')})`;
      if (run.some((id, n) => n && id === run[n - 1])) fail(`${label}: the same style twice running`);
      if (new Set(run.slice(0, offered.length)).size !== offered.length) fail(`${label}: doesn't go round every style before one comes back`);
      if (new Set(run.slice(offered.length)).size !== offered.length) fail(`${label}: doesn't keep going round every style`);
      if (minutes < 30 && pool.has('mix')) fail(`${label}: a mix under half an hour`);
    }
  }
  // a first session is a timed style, and a mix counts as each style in it
  if (fitPicks(20, 'general', []).intervalId !== 'short' || fitPicks(20, 'surf', []).intervalId !== 'long') fail('FIT picks: a first session should be short bursts, or for surfing long efforts');
  if (['emom', 'short', 'amrap'].includes(fitPicks(20, 'general', [['mix', 'emom', 'short', 'amrap'], ['long']]).intervalId)) fail('FIT picks: just after a mix, it picks a style from the mix');
  // how each style works: one sentence, plain, with the real numbers
  const said = [...Object.values(INTERVALS).map(iv => [iv.id, styleHow(iv)]),
    ['long at 45/15', styleHow(withWorkRest(INTERVALS.long, { long: [45, 15] }))],
    ['AMRAP in a 7-minute section', styleHow(sectionInterval({ intervalId: 'amrap', start: 0, count: 1, minutes: 7, blockRestSec: 0 }))],
    ['For Time in a 6-minute section', styleHow(sectionInterval({ intervalId: 'fortime', start: 0, count: 1, minutes: 6, blockRestSec: 0 }))]];
  said.forEach(([id, text]) => {
    if (typeof text !== 'string' || !/^[A-Z].{20,90}\.$/.test(text) || /[—–]|\.\s+[A-Z]|undefined|NaN/.test(text)) fail(`styleHow ${id}: not one plain sentence: "${text}"`);
  });
  const want = { short: '20s, rest 10s, 8 rounds', long: '40s, rest 20s, 4 rounds', 'long at 45/15': '45s, rest 15s, 4 rounds',
                 amrap: 'in 4 minutes', 'AMRAP in a 7-minute section': 'in 7 minutes', fortime: '4-minute cap', 'For Time in a 6-minute section': '6-minute cap' };
  said.forEach(([id, text]) => { if (want[id] && !text.includes(want[id])) fail(`styleHow ${id}: should say "${want[id]}": "${text}"`); });
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
       `, so the recency weighting is not working`);
}

// ------------------------------------------ 11. a favourite replays exactly
// The app stores a workout's request and seed and rebuilds from those. The
// recency list weights the picks, so it has to be part of the stored request
// or the replay quietly differs from what was saved.
{
  const first = generateWorkout({
    minutes: 30, people: 2, intervalId: 'long', regions: ['legs', 'core'],
    equipment: ALL_EQUIP, excluded: [], blockedTags: ['impact'], seed: 31337,
    recent: ids.slice(0, 25)
  });
  const again = first.error ? first
    : generateWorkout({ ...first.request, equipment: ALL_EQUIP, excluded: [], seed: first.seed });
  if (first.error || again.error) fail(`replay check could not build: ${first.error || again.error}`);
  else if (JSON.stringify(first.exerciseIds) !== JSON.stringify(again.exerciseIds)) {
    fail('rebuilding a workout from its stored request and seed gave a different workout');
  }
}

// ------------------------- 11b. levels change the reps, never the moves
// Each person's level rides on the request, so a favourite or a link
// rebuilds the same reps for them; the same seed picks the same moves with
// or without levels, in every style, and only rep targets differ.
let levelsChecked = 0;
{
  const levels = { a: 1.3, b: 0.7 };
  const strip = (lines) => lines.map(x => x.replace(/×[^ ,/|]+/g, ''));
  for (const [intervalId, mix] of [...Object.keys(INTERVALS).map(id => [id]), ['mix', ['emom', 'short', 'amrap']]]) {
    for (const seed of [5, 808, 31337]) {
      const opts = { minutes: 25, people: 2, intervalId, mix, regions: REGION_IDS, equipment: ALL_EQUIP, excluded: [], blockedTags: [], seed, recent: ids.slice(10, 30) };
      const plain = generateWorkout(opts);
      const lv = generateWorkout({ ...opts, repScales: { wayne: 1.3, '#b': 0.7 } });
      if (plain.error || lv.error) continue;
      levelsChecked++;
      const label = `seed ${seed} ${intervalId}${mix ? ` ${mix.join(',')}` : ''}`;
      if (JSON.stringify(lv.request.repScales) !== '{"wayne":1.3,"#b":0.7}') fail(`${label}: the levels didn't reach the request`);
      const again = generateWorkout({ ...lv.request, equipment: ALL_EQUIP, excluded: [], seed });
      if (JSON.stringify(again.repScales) !== JSON.stringify(lv.repScales)) fail(`${label}: rebuilt from its request, the levels came back different`);
      const shape = (w) => JSON.stringify(w.blocks.map(b => [b.make, b.ids]));
      if (shape(plain) !== shape(lv) || shape(again) !== shape(lv)) { fail(`${label}: levels changed the moves`); continue; }
      const flat = expandIds(plain, 2), scaled = expandIds(lv, 2, levels);
      if (JSON.stringify(strip(flat)) !== JSON.stringify(strip(scaled))) fail(`${label}: levels changed who does what or the timings`);
      const timed = !intervalId.startsWith('mix') && !INTERVALS[intervalId].reps;
      if (timed && JSON.stringify(flat) !== JSON.stringify(scaled)) fail(`${label}: levels changed a timed session`);
      if (!timed && JSON.stringify(flat) === JSON.stringify(scaled)) fail(`${label}: levels of 1.3 and 0.7 left every rep target as it was`);
    }
  }
}

// ------------------------------- 12. seeds must not depend on the sort engine
// Safari and Chrome sort with different algorithms, so a comparator runs a
// different number of times in each. If the generator drew random numbers
// inside a comparator, one seed would build one workout on the iPad and
// another on the phone, and a saved favourite would not travel. Rebuild a
// few seeds under a deliberately different sort and demand identical output.
{
  const nativeSort = Array.prototype.sort;
  const build = (seed) => {
    const w = generateWorkout({
      minutes: 30, people: 2, intervalId: 'short', regions: REGION_IDS,
      equipment: ALL_EQUIP, excluded: [], blockedTags: [], seed, recent: ids.slice(40, 60)
    });
    if (w.error) return `error: ${w.error}`;
    // the warm-up sorts its parts too
    const opts = { blockedTags: ['floor'] };
    return `${w.exerciseIds.join(',')} | ${JSON.stringify([warmupPlan(w, opts), cooldownPlan(w, opts), cooldownPlan(w, {})])}`;
  };
  const seeds = [1, 77, 4242, 90210];
  const withNative = seeds.map(build);
  // A stable insertion sort: correct, but it calls the comparator in a
  // completely different pattern from V8's TimSort.
  Array.prototype.sort = function (cmp) {
    const c = cmp || ((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
    for (let i = 1; i < this.length; i++) {
      const v = this[i];
      let j = i - 1;
      while (j >= 0 && c(this[j], v) > 0) { this[j + 1] = this[j]; j--; }
      this[j + 1] = v;
    }
    return this;
  };
  let withOther;
  try { withOther = seeds.map(build); } finally { Array.prototype.sort = nativeSort; }
  seeds.forEach((seed, i) => {
    if (withNative[i] !== withOther[i]) {
      fail(`seed ${seed} builds a different workout under a different sort algorithm, ` +
           `so it would differ between Safari and Chrome`);
    }
  });
}

// ---------------- 12b. the warm-up leaves the main blocks as they were
// The warm-up and cool-down are worked out from the session after it's
// built and draw nothing from the generator's random numbers, so every
// seed builds the same main blocks as the last release (origin/main, where
// git knows it): a link shared before this, or a favourite saved before it
// kept its moves, rebuilds what it always did. If a change to the
// generator means to change the picks, those links and favourites change
// with it.
let sameAsMain = 0;
{
  let mainSrc = null;
  try {
    mainSrc = SRC.map(f => execFileSync('git', ['show', `origin/main:${f}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).join('\n');
  } catch (e) { /* no git or no origin/main here: nothing to compare with */ }
  if (mainSrc) {
    const M = loadApp(mainSrc);
    const shape = (w) => w.error ? `error: ${w.error}`
      : JSON.stringify([w.name, w.blocks.map(b => [b.name, b.ids]), w.warmupSec, w.cooldownSec, w.blockRestSec,
                        (w.sections || []).map(x => [x.intervalId, x.start, x.count, x.minutes])]);
    const styles = [...Object.keys(INTERVALS).map(id => [id]), ['mix', ['emom', 'short', 'amrap']]];
    for (const [intervalId, mix] of styles) {
      for (const goal of [undefined, 'surf']) {
        for (const [i, [equipLabel, equipment]] of EQUIP_CASES.entries()) {
          for (const seed of [3, 4242, 90210]) {
            const minutes = minutesList[(seed + i) % minutesList.length];
            const blockedTags = TAG_CASES[(seed + i) % TAG_CASES.length];
            const opts = { minutes, people: 2, intervalId, mix, goal, regions: REGION_IDS, equipment, excluded: [], blockedTags, seed, recent: ids.slice(5, 25) };
            const now = shape(generateWorkout(opts)), then = shape(M.generateWorkout(opts));
            sameAsMain++;
            if (now !== then) fail(`seed ${seed} ${intervalId}${goal ? ' surf' : ''} ${minutes} min, ${equipLabel}: builds different main blocks from origin/main, so links and favourites made before would change`);
          }
        }
      }
    }
  }
}

// ---------------------------------- 13. favourites never change
// A favourite (and a history entry, and a session saved part-way) keeps
// the exercises it was built with (FROZEN WORKOUTS in js/workouts.js), so
// a change to the library or the generator can't change it. Every style
// has to come back from its frozen copy, through JSON, exactly as built:
// the same moves for each person in every round, the same laps, the same
// bookends. Then a frozen favourite checked in here has to keep running
// the same rounds whatever the generator does next, and anything that's
// the wrong shape, or names a move that's gone, has to be refused so the
// app builds it from its seed instead.
// Every round of a workout as the timer hands it out: who does what, at
// what load and target, and for a single-arm lift which arm.
function expandIds(w, people, levels = {}) {
  const duo = people === 2;
  const arm = (ex) => (/^Left arm/.test(ex.cue) ? 'L' : /^Right arm/.test(ex.cue) ? 'R' : '');
  const one = (ex) => (ex ? `${ex.id}${arm(ex)}${ex.reps ? `×${ex.reps}` : ''}` : '-');
  const secs = w.sections || [{ intervalId: w.intervalId, start: 0, count: w.blocks.length, minutes: 0, blockRestSec: w.blockRestSec }];
  const out = [`bookends ${w.warmupSec}/${w.cooldownSec}/${w.blockRestSec}/${w.changeoverSec || 0}`];
  secs.forEach(sec => {
    const iv = sectionInterval(sec, w.workRest);
    const ctxOf = (who) => ({ rounds: iv.rounds, workSec: iv.workSec, restSec: iv.restSec, reps: !!iv.reps, lap: !!iv.lap,
                              hasEquip: () => true, repScale: w.repScale, level: levels[who] });
    const ctx = ctxOf('a'), ctxB = ctxOf('b');
    w.blocks.slice(sec.start, sec.start + sec.count).forEach((block, i) => {
      if (iv.lap) {
        const c = amrapCircuits(block, ctx, duo);
        const b = duo ? amrapCircuits(block, ctxB, true).b : null;
        out.push(`${sec.start + i} lap ${c.a.map(one).join(',')} | ${(b || []).map(one).join(',')}`);
        return;
      }
      for (let r = 1; r <= iv.rounds; r++) {
        const x = duo ? { a: block.duo(r, ctx).a, b: block.duo(r, ctxB).b } : { a: block.solo(r, ctx), b: null };
        out.push(`${sec.start + i}.${r} ${one(x.a)} / ${one(x.b)}`);
      }
    });
  });
  return out;
}
let frozenChecked = 0;
{
  const styles = [...Object.keys(INTERVALS).map(id => [id]), ['mix', ['emom', 'short', 'amrap']], ['mix', ['long', 'fortime']]];
  for (const [intervalId, mix] of styles) {
    for (const seed of [11, 4242, 7919, 31337]) {
      for (const goal of [undefined, 'surf']) {
        // and again at a program week's split, with two people's levels
        for (const extra of [{}, { workRest: { long: [45, 15], short: [25, 5] }, repScales: { wayne: 1.2, '#b': 0.8 } }]) {
          const w = generateWorkout({
            minutes: 30, people: 2, intervalId, mix, goal, regions: REGION_IDS, equipment: ALL_EQUIP,
            excluded: [], blockedTags: [], seed, recent: ids.slice(0, 20), ...extra
          });
          if (w.error) continue;
          const label = `seed ${seed} ${intervalId}${mix ? ` ${mix.join(',')}` : ''}${goal ? ' surf' : ''}${extra.workRest ? ' split+levels' : ''}`;
          const back = thawWorkout(JSON.parse(JSON.stringify(freezeWorkout(w))), w.seed, w.request);
          if (!back) { fail(`frozen ${label}: did not come back from its frozen copy`); continue; }
          frozenChecked++;
          [1, 2].forEach(people => {
            if (JSON.stringify(expandIds(back, people)) !== JSON.stringify(expandIds(w, people))) {
              fail(`frozen ${label}: runs differently from the workout it froze, for ${people}`);
            }
          });
          ['name', 'tagline', 'blurb', 'focus', 'intervalId', 'repScale', 'seed', 'id'].forEach(k => {
            if (back[k] !== w[k]) fail(`frozen ${label}: ${k} came back as ${back[k]}, was ${w[k]}`);
          });
          ['workRest', 'repScales'].forEach(k => {
            if (JSON.stringify(back[k]) !== JSON.stringify(w[k])) fail(`frozen ${label}: ${k} came back as ${JSON.stringify(back[k])}, was ${JSON.stringify(w[k])}`);
          });
          if (back.exerciseIds.join() !== w.exerciseIds.join()) fail(`frozen ${label}: different exercise list`);
          if (!back.generated || back.request !== w.request) fail(`frozen ${label}: lost its generated flag or request`);
        }
      }
    }
  }
}
{
  // A favourite as saved: one block from each block helper, short bursts
  // for two people. If this fails, a change to the block helpers (or to the
  // moves below) would quietly change every favourite already saved.
  const GOLDEN = {
    v: 1, name: 'Full Body · 20 min', tagline: 'Sharp bursts', blurb: '5 blocks built for full body.', focus: 'whole-body',
    intervalId: 'short', warmupSec: 180, cooldownSec: 150, blockRestSec: 45, notes: [],
    builtWith: { equipment: { kb15: true, kb10: true }, excluded: [] },
    blocks: [
      { make: 'swap', name: 'Goblet squats', ids: ['gobletSquat15', 'gobletSquat10'] },
      { make: 'cycle', name: 'Core mix', ids: ['crunch', 'flutterKicks', 'reverseCrunch', 'tuckUp'] },
      { make: 'alt', name: 'Push-ups & Superman YTW', ids: ['pushup', 'supermanYtw'] },
      { make: 'same', name: 'Burpees', ids: ['burpee'] },
      { make: 'swapAlt', name: 'KB clean & press (alt arms)', ids: ['kbCleanPress15', 'kbCleanPress10'] }
    ]
  };
  const GOLDEN_ROUNDS = [
    'bookends 180/150/45/0',
    ...[1, 2, 3, 4].map(r => `0.${r} gobletSquat15 / gobletSquat10`), ...[5, 6, 7, 8].map(r => `0.${r} gobletSquat10 / gobletSquat15`),
    '1.1 crunch / flutterKicks', '1.2 flutterKicks / reverseCrunch', '1.3 reverseCrunch / tuckUp', '1.4 tuckUp / crunch',
    '1.5 crunch / flutterKicks', '1.6 flutterKicks / reverseCrunch', '1.7 reverseCrunch / tuckUp', '1.8 tuckUp / crunch',
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(r => (r % 2 ? `2.${r} pushup / supermanYtw` : `2.${r} supermanYtw / pushup`)),
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(r => `3.${r} burpee / burpee`),
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(r => {
      const s = r % 2 ? 'L' : 'R';
      return r <= 4 ? `4.${r} kbCleanPress15${s} / kbCleanPress10${s}` : `4.${r} kbCleanPress10${s} / kbCleanPress15${s}`;
    })
  ];
  const request = { minutes: 20, people: 2, intervalId: 'short', regions: REGION_IDS, blockedTags: [], recent: [] };
  const gold = thawWorkout(JSON.parse(JSON.stringify(GOLDEN)), 424242, request);
  const gone = GOLDEN.blocks.flatMap(b => b.ids).filter(id => !EXERCISES[id]);
  if (gone.length) fail(`golden favourite: ${gone.join(', ')} left the library, so favourites with them are built again from their seed; pick other moves for the golden`);
  else if (!gold) fail('golden favourite: no longer comes back from its frozen copy');
  else {
    const got = expandIds(gold, 2);
    const bad = got.findIndex((x, i) => x !== GOLDEN_ROUNDS[i]);
    if (got.length !== GOLDEN_ROUNDS.length || bad >= 0) {
      fail(`golden favourite: round ${bad} runs "${got[bad]}", it was saved as "${GOLDEN_ROUNDS[bad]}"`);
    }
    if (gold.builtWith.equipment.kb15 !== true || gold.id !== 'gen-424242' || gold.exerciseIds.length !== 11) {
      fail('golden favourite: lost its gear, id or exercise list');
    }
  }
  // the wrong shape, or a move that's gone: built from the seed instead
  const broken = (f) => thawWorkout(f, 424242, request);
  const copy = () => JSON.parse(JSON.stringify(GOLDEN));
  const cases = {
    'a move no longer in the library': (f) => { f.blocks[1].ids[2] = 'noSuchMove'; },
    'a block helper that does not exist': (f) => { f.blocks[0].make = 'toString'; },
    'a swap with three moves': (f) => { f.blocks[0].ids.push('crunch'); },
    'an unknown style': (f) => { f.intervalId = 'tabata9'; },
    'no blocks': (f) => { f.blocks = []; },
    'a mix whose sections miss a block': (f) => { f.intervalId = 'mix'; f.mix = ['short', 'long']; f.changeoverSec = 75;
      f.sections = [{ intervalId: 'short', start: 0, count: 2, minutes: 0, blockRestSec: 30 }, { intervalId: 'long', start: 2, count: 2, minutes: 0, blockRestSec: 30 }]; },
    'a warm-up that is not a number': (f) => { f.warmupSec = '180'; },
    'a split that runs past four minutes': (f) => { f.workRest = { short: [25, 10] }; },
    'another version': (f) => { f.v = 2; }
  };
  Object.entries(cases).forEach(([what, spoil]) => {
    const f = copy();
    spoil(f);
    if (broken(f) !== null) fail(`a frozen favourite with ${what} should be refused, so it's built from its seed`);
  });
  if (thawWorkout(copy(), 0, request) !== null || thawWorkout(copy(), 424242, null) !== null) fail('a frozen favourite needs its seed and request');
  if (Object.keys(BLOCK_MAKERS).join() !== 'same,alt,cycle,swap,swapAlt') fail('BLOCK_MAKERS should cover every block helper');
}

// ------------------------------------------------------------- swaps
// A move swapped (SWAPS in js/workouts.js, swapCandidates in
// js/generator.js), for every move of every block of a sweep of builds,
// for one person and for both. What's offered suits the gear and the
// leave-outs, is new to the block (never the same move at another
// weight), comes in threes at most, the same each time, and never needs
// gear the other person could be holding at that moment, with them in
// either spot. Swapped in, it changes that person's moves where the block
// had the move, and nothing else: not the other person's, not another
// round. And swaps from storage or a link come back checked.
let swapsChecked = 0, swapsOffered = 0, swapsNone = 0;
{
  const keys = { a: 'wayne', b: 'dave' }, swappedRound = { a: 'dave', b: 'wayne' };
  // every round of a block for two people, with each spot's swaps in
  const rounds = (block, w, bi, k, iv) => {
    const maps = swapMaps(w, bi, k);
    const ctx = (m) => ({ ...ctxFor(iv), hasEquip: () => true, swaps: m });
    if (INTERVALS[iv].lap) {
      const lapA = amrapCircuits(block, ctx(maps.a), true).a, lapB = amrapCircuits(block, ctx(maps.b), true, ctx(maps.a)).b;
      return [{ a: lapA.map(x => x.id).join(','), b: lapB.map(x => x.id).join(','), lapA, lapB }];
    }
    const out = [];
    for (let r = 1; r <= INTERVALS[iv].rounds; r++) out.push({ a: block.duo(r, ctx(maps.a)).a.id, b: block.duo(r, ctx(maps.b)).b.id });
    return out;
  };
  const sweep = (where, w, iv, goal, equipment, excluded, blockedTags) => {
        w.blocks.forEach((block, bi) => block.ids.forEach(from => [null, 'a', 'b'].forEach(who => {
          const label = `swap [${where}] block ${bi + 1} ${from} for ${who || 'both'}`;
          const opts = { equipment, excluded, blockedTags, recent: [], surf: goal === 'surf', lap: !!INTERVALS[iv].lap, who, swaps: { a: {}, b: {} } };
          const got = swapCandidates(block, from, opts);
          swapsChecked++;
          swapsOffered += got.length;
          if (!got.length) swapsNone++;
          if (got.length > 3 || new Set(got).size !== got.length) fail(`${label}: offers ${got.join(', ')}`);
          if (swapCandidates(block, from, opts).join() !== got.join()) fail(`${label}: offers something else the second time`);
          const before = rounds(block, w, bi, keys, iv);
          got.forEach(to => {
            const ex = EXERCISES[to];
            if (!ex) { fail(`${label}: offers unknown ${to}`); return; }
            if (!ex.equipment.every(e => equipment[e] !== false)) fail(`${label}: offers ${to}, which needs gear that's off`);
            if (excluded.includes(to) || ex.tags.some(t => blockedTags.includes(t))) fail(`${label}: offers ${to}, which is left out`);
            if (block.ids.includes(to) || block.ids.some(id => EXERCISES[id].img === ex.img)) fail(`${label}: offers ${to}, already in the block`);
            if (swapCandidates(block, from, { ...opts, only: to }).join() !== to) fail(`${label}: ${to} isn't safe when asked on its own`);
            const sw = { ...w, swaps: [{ block: bi, from, to, ...(who ? { who: keys[who] } : {}) }] };
            const slot = block.shape === 'swap' ? block.ids : [from];
            // with them either way round, nobody's holding the other one's gear
            [keys, swappedRound].forEach(k => rounds(block, sw, bi, k, iv).forEach((x, r) => {
              if (x.lapA) {
                x.lapA.forEach(m => x.lapB.forEach(n => { if (sharesSingle(m.id, n.id)) fail(`${label} -> ${to}: the laps share gear: ${m.id} + ${n.id}`); }));
              } else if (sharesSingle(x.a, x.b)) fail(`${label} -> ${to}: round ${r + 1} has ${x.a} + ${x.b} at once`);
            }));
            // only the person who swapped, only where the move was
            const after = rounds(block, sw, bi, keys, iv);
            after.forEach((x, r) => ['a', 'b'].forEach(k => {
              const mine = !who || who === k;
              if (x.lapA) {
                // a lap: the one who swapped has it (A's as it is, a mate's
                // too when it was only theirs), the other's lap is as it was
                // or better, never a move sent to bodyweight that wasn't
                const lap = k === 'a' ? x.lapA : x.lapB, was = k === 'a' ? before[r].lapA : before[r].lapB;
                if (mine && (k === 'a' || who === 'b') && !lap.some(m => m.id === to)) fail(`${label} -> ${to}: ${k}'s lap hasn't got it: ${x[k]}`);
                if (!mine && k === 'b' && lap.some(m => m.adapted && was.some(n => n.base === m.base && !n.adapted))) fail(`${label} -> ${to}: sent a move of b's lap to bodyweight: ${x.b}`);
                if (!mine && k === 'a' && x.a !== before[r].a) fail(`${label} -> ${to}: changed a's lap too`);
                return;
              }
              const changed = x[k] !== before[r][k];
              const due = mine && slot.includes(before[r][k]);
              if (changed !== due || (due && x[k] !== to)) fail(`${label} -> ${to}: round ${r + 1} gives ${k} ${x[k]}, was ${before[r][k]}`);
            }));
          });
        })));
  };
  const cases = [['full kit', ALL_EQUIP], ['no kettlebells', noKb], ['bodyweight only', bodyOnly]];
  for (const [equipLabel, equipment] of cases) {
    for (const seed of [3, 77, 1201, 9001]) {
      for (const [iv, goal] of [['short', undefined], ['long', 'surf'], ['amrap', undefined], ['emom', undefined]]) {
        const blockedTags = seed === 77 ? ['impact'] : [];
        const excluded = seed === 1201 ? ['pushup', 'airSquat', 'plankHold'] : [];
        const w = generateWorkout({ minutes: 30, people: 2, intervalId: iv, goal, regions: REGION_IDS, equipment, excluded, blockedTags, seed, recent: [] });
        if (!w.error) sweep(`${equipLabel} | seed ${seed} | ${iv}${goal ? ' surf' : ''}`, w, iv, goal, equipment, excluded, blockedTags);
      }
    }
  }
  // and the classics, which run in whatever style is picked
  CLASSICS.forEach(w => ['short', 'fortime'].forEach(iv => sweep(`${w.id} | ${iv}`, w, iv, undefined, ALL_EQUIP, [], [])));
  if (swapsOffered < swapsChecked) fail(`swaps: offered only ${swapsOffered} moves over ${swapsChecked} asks`);
  // a swap for one person over one for both, a two-weight block's pair
  // swapped as one, and a swap for both you put back for one of you
  const pairBlock = A.blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10');
  const sw = { blocks: [pairBlock, blockCycle('t', ['crunch', 'flutterKicks', 'reverseCrunch', 'tuckUp'])],
               swaps: [{ block: 0, from: 'gobletSquat10', to: 'airSquat' }, { block: 0, from: 'gobletSquat15', to: 'tempoSquat', who: 'dave' },
                       { block: 1, from: 'crunch', to: 'deadBug', who: 'wayne' }, { block: 1, from: 'tuckUp', to: 'vUp', who: 'nobody' }] };
  const m0 = swapMaps(sw, 0, { a: 'wayne', b: 'dave' }), m1 = swapMaps(sw, 1, { a: 'dave', b: 'wayne' });
  if (JSON.stringify(m0) !== '{"a":{"gobletSquat15":"airSquat","gobletSquat10":"airSquat"},"b":{"gobletSquat15":"tempoSquat","gobletSquat10":"tempoSquat"}}') {
    fail(`swapMaps: a swap for both, then one person's over it, a pair as one: ${JSON.stringify(m0)}`);
  }
  if (JSON.stringify(m1) !== '{"a":{},"b":{"crunch":"deadBug"}}') fail(`swapMaps: a person's swap goes with their name: ${JSON.stringify(m1)}`);
  // checked as they come back: junk dropped, what's left as it was
  const junk = [null, 'x', { block: 0, from: 'crunch', to: 'crunch' }, { block: -1, from: 'crunch', to: 'deadBug' },
                { block: 1.5, from: 'crunch', to: 'deadBug' }, { block: 1, from: 'noSuchMove', to: 'deadBug' },
                { block: 1, from: 'crunch', to: 'noSuchMove' }, { block: 1, from: 'crunch', to: 'deadBug', who: '' },
                { block: 1, from: 'crunch', to: 'deadBug', who: 'x'.repeat(31) }, { block: 1, from: 'crunch', to: 'deadBug', who: 7 },
                { block: 1, from: 'crunch', to: 'deadBug', who: 'wayne', extra: 'gone' }, { block: 0, from: 'crunch', to: 'deadBug' },
                { block: 5, from: 'crunch', to: 'deadBug' }];
  const kept = cleanSwaps(JSON.parse(JSON.stringify(junk)), sw);
  if (JSON.stringify(kept) !== '[{"block":1,"from":"crunch","to":"deadBug","who":"wayne"}]') fail(`cleanSwaps kept ${JSON.stringify(kept)}`);
  if (cleanSwaps(junk).length !== 3 || cleanSwaps('nope').length || cleanSwaps(Array(80).fill({ block: 0, from: 'crunch', to: 'tuckUp' })).length !== 60) {
    fail('cleanSwaps: without a workout, only the shape is checked, sixty at most');
  }
  // the spare bells: a mate's lap takes another bell where there's one
  // (ctx.spare), rather than its bodyweight version, and with none spare
  // goes to bodyweight as before
  const lap = blockAlt('t', 'kbSwing15', 'kbPress10');
  const base = { ...ctxFor('amrap'), loads: { kb15: '24kg', kb10: '16kg' } };
  const spare = amrapCircuits(lap, { ...base, spare: (taken) => (taken.length === 2 ? { kb15: '12kg', kb10: '8kg' } : {}) }, true);
  const none = amrapCircuits(lap, { ...base, spare: () => ({}) }, true);
  if (spare.b.map(x => x.display).join(' | ') !== 'Single-arm KB press · 8kg | KB swings · 12kg' || spare.a.map(x => x.display).join(' | ') !== 'KB swings · 24kg | Single-arm KB press · 16kg') {
    fail(`spare bells: a mate's lap should take the spares: ${spare.a.map(x => x.display).join(' | ')} / ${spare.b.map(x => x.display).join(' | ')}`);
  }
  if (none.b.some(x => EXERCISES[x.id].equipment.length)) fail(`spare bells: with none spare, the mate's lap goes bodyweight: ${none.b.map(x => x.id).join()}`);
}

// ------------------------------------------------------------- report
const reused = ids.filter(id => EXERCISES[id].equipment.length === 0).length;
console.log(`exercises          ${ids.length} (${reused} bodyweight)`);
console.log(`3D movements       ${Object.keys(MOVES).length}, ${need.length} files precached`);
console.log(`classics           ${CLASSICS.length} + ${STRETCH_ROUTINES.length} stretch routines`);
console.log(`mixed sessions     ${mixBuilt} built, ${mixRefused} correctly refused as too short`);
console.log(`surf fitness       ${surfBuilt} sessions, surf exercises only, pop-ups and paddling in each`);
console.log(`programs           ${programDays} program-day builds, every day at every length, leave-outs kept`);
console.log(`export script      ${exported} exports, every style, lengths match the timer`);
console.log(`FIT picks          ${picksChecked} picks: the same each time, fit the minutes, build to the second, go round every style`);
console.log(`generator sweep    ${generated} combinations, ${errored} correctly refused, ${exact} to the second`);
console.log(`session overlap    ${Math.round(worstOverlap * 100)}% worst case between consecutive`);
console.log(`frozen favourites  ${frozenChecked} built and frozen, the same run after thawing; the golden one unchanged`);
console.log(`personal levels    ${levelsChecked} builds with two levels: the same moves, only the reps differ`);
console.log(`swaps              ${swapsChecked} asks, ${swapsOffered} moves offered (${swapsNone} with none), each safe for two, only the one person's moves changed`);
console.log(`warm-up, cool-down ${bookendsChecked} sessions: real moves and stretches, to the second, nothing that jumps`);
console.log(`main blocks        ${sameAsMain ? `${sameAsMain} builds the same as origin/main` : 'not compared (no origin/main here)'}`);
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
