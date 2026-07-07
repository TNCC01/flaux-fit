# FIT → Garmin — handoff for the Garmin session

**Goal:** let the user follow a FIT workout on their Garmin watch instead of
the phone — the watch guides each timed interval (exercise name on screen +
vibration at every change), matching what the web app does at fit.flaux.com.au.

**Repo:** `TNCC01/flaux-fit` (this repo). The web app is a single static
`index.html`, deployed to Vercel, auto-deploys from `main`. Latest commit as
of this handoff: `11864e8`. **The Garmin work does not change the web app.**

**Ask the user which Garmin watch model they have** (e.g. Forerunner 265,
Fenix 7, Venu 3, Instinct 2) before choosing an approach — feature support
varies by model.

---

## Two approaches (recommend starting with Route 1)

### Route 1 — Garmin structured-workout `.FIT` files (recommended)
Garmin watches natively support "structured workouts": a list of timed steps,
each with a name and a duration, that the watch walks you through, buzzing at
every step change. FIT's tabata structure maps onto this directly.

Build a generator (standalone script, e.g. Python or Node) that reads the
workout definitions below and emits one `.FIT` workout file per workout.
Suggested library: Garmin's official **FIT SDK** (`garmin-fit-sdk`), or the
Python `fit-tool` package, to encode `WorkoutMesg` + `WorkoutStepMesg`
records. The user loads the files onto the watch (plug in via USB, drop into
the `GARMIN/Workouts/` folder), or pushes via Garmin Connect if the toolchain
supports it.

Each step: `duration_type = time`, `duration_time = <seconds>`,
`wkt_step_name = <exercise task string>`, `intensity = active` for work /
`rest` for rests / `warmup` / `cooldown` accordingly.

### Route 2 — Connect IQ native watch app (bigger project, later)
A Monkey C app that mirrors FIT (menu, round bars, equipment logic). Full
experience but a real app-dev effort: Garmin Connect IQ SDK, simulator,
sideloading or store listing. Only worth it if Route 1 leaves gaps.

---

## The data model (authoritative copy is `index.html` on `main`)

Everything below is copied from `index.html`. If in any doubt, the source of
truth is `index.html` at commit `11864e8`:
- `EQUIPMENT` + `EXERCISES`: lines ~741–915
- block helpers + `resolveEx`: lines ~836–914
- `workouts` array: lines ~917–1231
- `TABATA` constant + `buildSequence` (exact expansion): lines ~1298–1386

### Timing model
- **Tabata workout** expands to: warm-up (if `warmupSec>0`) → for each block:
  8 rounds of [20s work + 10s rest] → a block-rest between consecutive blocks
  → cool-down (if `cooldownSec>0`).
- `const TABATA = { rounds: 8, workSec: 20, restSec: 10 };`
- Every workout currently uses `warmupSec: 300, cooldownSec: 300` (5 min each).
  `blockRestSec` is 30/45/60 depending on the workout.
- **Stretch workouts** (2 of them, `format: 'stretch'`) are just a list of
  named holds, each with its own `hold` seconds — no work/rest structure.

### For Garmin, use single-person mode
The app supports 1 or 2 people. For a watch, generate the **solo** sequence:
call each block's `solo(round)` for round 1..8. The exact web-app expansion
(`buildSequence`, single-person path) is reproduced at the end of this file.

### Block helpers — how a block becomes 8 rounds (solo)
- `blockSame(name, id)` → every round: `id`
- `blockAlt(name, idA, idB)` → round odd: `idA`, round even: `idB`
- `blockCycle(name, [ids])` → round r: `ids[(r-1) % ids.length]`
- `blockSwap(name, heavyId, lightId)` → rounds 1–4: `heavyId`, rounds 5–8: `lightId`
- `blockCleanPress()` → id `kbCleanPress15` rounds 1–4, `kbCleanPress10` rounds
  5–8; append " (left arm)" on odd rounds, " (right arm)" on even rounds to the
  task string. Block name: `KB clean & press (alt arms)`.

Look up the resulting id in `EXERCISES` and use its `.task` string as the
Garmin step name. (Equipment adaptation via `.bw` is a menu feature; for the
`.FIT` files assume all equipment present, so just use the id's own `.task`.)

---

## EQUIPMENT + EXERCISES (verbatim)

```javascript
const EQUIPMENT = {
  kb15:      '15kg kettlebell',
  kb10:      '10kg kettlebell',
  barbell10: '10kg barbell',
  dumbbells: 'Dumbbells',
  rope:      'Skipping rope',
  rings:     'Rings'
};

const EXERCISES = {
  // Bodyweight: whole body
  airSquat:        { task: 'Air squats', equipment: [] },
  tempoSquat:      { task: 'Bodyweight squat with a slow 3s descent', equipment: [] },
  pushup:          { task: 'Push-ups', equipment: [] },
  burpee:          { task: 'Burpees', equipment: [] },
  jumpingJacks:    { task: 'Jumping jacks', equipment: [] },
  highKnees:       { task: 'High knees in place', equipment: [] },
  skaterHops:      { task: 'Skater hops side to side', equipment: [] },
  bearCrawl:       { task: 'Bear crawl forward & back', equipment: [] },
  inchworm:        { task: 'Inchworm walkouts', equipment: [] },
  sprint:          { task: 'Sprint to mailbox & back', equipment: [] },
  squatReach:      { task: 'Squat to overhead reach', equipment: [] },
  mountainClimber:     { task: 'Mountain climbers', equipment: [] },
  mountainClimberFast: { task: 'Mountain climbers (fast)', equipment: [] },
  // Bodyweight: lower
  reverseLunge:    { task: 'Reverse lunges (alternate legs)', equipment: [] },
  stepUp:          { task: 'Step-ups on a bench/box', equipment: [] },
  squatJump:       { task: 'Squat jumps', equipment: [] },
  wallSit:         { task: 'Wall sit (thighs parallel)', equipment: [] },
  gluteBridge:     { task: 'Glute bridges', equipment: [] },
  singleLegBridge: { task: 'Single-leg glute bridge (switch legs at 10s)', equipment: [] },
  cossackSquat:    { task: 'Cossack squats (side to side)', equipment: [] },
  calfRaises:      { task: 'Calf raises — slow up, slow down', equipment: [] },
  goodMorning:     { task: 'Good mornings (hands behind head)', equipment: [] },
  // Bodyweight: upper
  pikePushup:      { task: 'Pike push-ups', equipment: [] },
  tricepDips:      { task: 'Tricep dips on a bench', equipment: [] },
  supermanPull:    { task: 'Superman pulls (lat pulldown motion)', equipment: [] },
  supermanHold:    { task: 'Superman hold with pulses', equipment: [] },
  // Bodyweight: core
  plankHold:       { task: 'Plank hold (forearm or high)', equipment: [] },
  plankForearm:    { task: 'Plank (forearm)', equipment: [] },
  plankRotation:   { task: 'Plank rotation — change position every 15s', equipment: [] },
  plankShoulderTaps: { task: 'Plank shoulder taps', equipment: [] },
  hollowHold:      { task: 'Hollow body hold', equipment: [] },
  hollowRocks:     { task: 'Hollow body rocks', equipment: [] },
  vSit:            { task: 'V-sits', equipment: [] },
  deadBug:         { task: 'Dead bug (opposite arm + leg)', equipment: [] },
  birdDog:         { task: 'Bird dog (opposite arm + leg)', equipment: [] },
  legRaises:       { task: 'Lying leg raises', equipment: [] },
  bicycleCrunch:   { task: 'Bicycle crunches', equipment: [] },
  flutterKicks:    { task: 'Flutter kicks', equipment: [] },
  sidePlankDips:   { task: 'Side plank hip dips (switch sides at 10s)', equipment: [] },
  russianTwistBw:  { task: 'Russian twists (bodyweight)', equipment: [] },
  // Kettlebells
  gobletSquat15:  { task: 'Goblet squat — 15kg KB', equipment: ['kb15'], bw: 'tempoSquat' },
  gobletSquat10:  { task: 'Goblet squat — 10kg KB', equipment: ['kb10'], bw: 'tempoSquat' },
  kbSwing15:      { task: 'KB swings — 15kg', equipment: ['kb15'], bw: 'goodMorning' },
  kbSwing10:      { task: 'KB swings — 10kg', equipment: ['kb10'], bw: 'goodMorning' },
  kbDeadlift15:   { task: 'KB deadlift — 15kg', equipment: ['kb15'], bw: 'goodMorning' },
  kbRackHold15:   { task: 'KB front rack hold — 15kg', equipment: ['kb15'], bw: 'wallSit' },
  kbCleanPress15: { task: 'KB clean & press — 15kg', equipment: ['kb15'], bw: 'squatReach' },
  kbCleanPress10: { task: 'KB clean & press — 10kg', equipment: ['kb10'], bw: 'squatReach' },
  russianTwistKb: { task: 'Russian twists — 10kg KB', equipment: ['kb10'], bw: 'russianTwistBw' },
  // Barbell
  barbellPress:   { task: 'Strict press — 10kg barbell', equipment: ['barbell10'], bw: 'pikePushup' },
  barbellRow:     { task: 'Bent-over row — 10kg barbell', equipment: ['barbell10'], bw: 'supermanPull' },
  // Dumbbells
  dbPressHeavy:   { task: 'Dumbbell shoulder press (heavier pair)', equipment: ['dumbbells'], bw: 'pikePushup' },
  dbPressLight:   { task: 'Dumbbell shoulder press (lighter pair)', equipment: ['dumbbells'], bw: 'pikePushup' },
  dbLunge:        { task: 'Reverse lunges with dumbbells', equipment: ['dumbbells'], bw: 'reverseLunge' },
  dbRow:          { task: 'Bent-over dumbbell rows', equipment: ['dumbbells'], bw: 'supermanPull' },
  dbCurl:         { task: 'Dumbbell bicep curls', equipment: ['dumbbells'], bw: 'supermanPull' },
  dbLateralRaise: { task: 'Dumbbell lateral raises', equipment: ['dumbbells'], bw: 'plankShoulderTaps' },
  renegadeRow:    { task: 'Renegade rows on dumbbells', equipment: ['dumbbells'], bw: 'plankShoulderTaps' },
  dbSuitcaseCarry:{ task: 'Dumbbell suitcase carry — driveway', equipment: ['dumbbells'], bw: 'bearCrawl' },
  // Rope / rings
  skipping:       { task: 'Skipping rope', equipment: ['rope'], bw: 'highKnees' },
  ringRow:        { task: 'Ring rows (set foot position for difficulty)', equipment: ['rings'], bw: 'supermanPull' },
  ringPushup:     { task: 'Ring push-ups', equipment: ['rings'], bw: 'pushup' },
  ringDip:        { task: 'Ring dips (or bench dips)', equipment: ['rings'], bw: 'tricepDips' },
  ringTuckHold:   { task: 'Ring tuck holds (or hanging knee raises)', equipment: ['rings'], bw: 'legRaises' }
};
```

*(The live `EXERCISES` also carries `alt` (injury alternative) and `img`
(demo animation base name) on each entry — omitted here as not needed for the
watch. Full versions are in `index.html`.)*

---

## The 18 workouts (verbatim)

```javascript
const workouts = [
  { id: 'quick-spark', name: 'Quick Spark', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockAlt('Squats & Push-ups', 'airSquat', 'pushup'),
      blockCycle('Climbers, jacks & core', ['mountainClimber', 'plankHold', 'jumpingJacks', 'hollowHold'])
    ] },

  { id: 'sunrise-stretch', name: 'Sunrise Stretch', focus: 'stretching', format: 'stretch',
    stretches: [
      { name: 'Standing forward fold', hold: 60 }, { name: 'Downward dog', hold: 60 },
      { name: 'Low lunge — left', hold: 60 }, { name: 'Low lunge — right', hold: 60 },
      { name: 'Pigeon — left', hold: 60 }, { name: 'Pigeon — right', hold: 60 },
      { name: "Child's pose", hold: 60 }, { name: 'Cobra / upward dog', hold: 60 },
      { name: 'Cat-cow flow', hold: 60 }, { name: 'Neck & shoulder rolls', hold: 60 },
      { name: 'Standing chest opener', hold: 60 }
    ] },

  { id: 'core-crusher', name: 'Core Crusher', focus: 'core', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockCycle('Climbers & core burners', ['mountainClimberFast', 'bicycleCrunch', 'flutterKicks', 'plankShoulderTaps']),
      blockAlt('Hollow holds & Russian twists', 'hollowHold', 'russianTwistKb'),
      blockSame('Plank rotations (15s each: forearm / high / side-L / side-R)', 'plankRotation')
    ] },

  { id: 'cool-mobile', name: 'Cool & Mobile', focus: 'stretching', format: 'stretch',
    stretches: [
      { name: 'Cat-cow flow', hold: 60 }, { name: 'Thread the needle — left', hold: 60 },
      { name: 'Thread the needle — right', hold: 60 }, { name: 'Downward dog', hold: 60 },
      { name: 'Low lunge — left', hold: 60 }, { name: 'Low lunge — right', hold: 60 },
      { name: 'Pigeon — left', hold: 60 }, { name: 'Pigeon — right', hold: 60 },
      { name: 'Seated forward fold', hold: 60 }, { name: 'Supine spinal twist — left', hold: 60 },
      { name: 'Supine spinal twist — right', hold: 60 }, { name: '90/90 hip — left', hold: 60 },
      { name: '90/90 hip — right', hold: 60 }, { name: 'Frog stretch', hold: 60 },
      { name: 'Glute bridge hold', hold: 60 }, { name: 'Happy baby', hold: 60 },
      { name: 'Savasana / deep breathing', hold: 60 }
    ] },

  { id: 'calisthenics-core', name: 'Calisthenics Core', focus: 'core', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockAlt('Hollow rocks & V-sits', 'hollowRocks', 'vSit'),
      blockCycle('Climbers, dead bugs & bird dogs', ['mountainClimber', 'deadBug', 'birdDog', 'sidePlankDips']),
      blockAlt('Plank & Leg raises', 'plankForearm', 'legRaises')
    ] },

  { id: 'lunchbreak-burn', name: 'Lunchbreak Burn', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockAlt('Squats & Push-ups', 'airSquat', 'pushup'),
      blockCycle('Lunges, dips & lower mix', ['reverseLunge', 'tricepDips', 'goodMorning', 'calfRaises']),
      blockCycle('Burpees & core burners', ['burpee', 'hollowRocks', 'skaterHops', 'supermanPull'])
    ] },

  { id: 'kb-blitz', name: 'KB Blitz', focus: 'lower-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10')
    ] },

  { id: 'ring-rush', name: 'Ring Rush', focus: 'upper-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockCycle('Rows & presses', ['ringRow', 'pikePushup', 'dbRow', 'pushup']),
      blockCycle('Dips & curls', ['ringDip', 'dbCurl', 'ringPushup', 'dbLateralRaise'])
    ] },

  { id: 'lunchbreak-loaded', name: 'Lunchbreak Loaded', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockCycle('Press & pull mix', ['barbellPress', 'pushup', 'dbRow', 'plankShoulderTaps']),
      blockCycle('Swings & skips', ['kbSwing15', 'skipping', 'kbSwing10', 'highKnees'])
    ] },

  { id: 'loaded-core', name: 'Loaded Core', focus: 'core', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockAlt('Russian twists & Renegade rows', 'russianTwistKb', 'renegadeRow'),
      blockCycle('Hangs, planks & raises', ['ringTuckHold', 'plankShoulderTaps', 'legRaises', 'sidePlankDips']),
      blockAlt('Suitcase carry & Hollow rocks', 'dbSuitcaseCarry', 'hollowRocks')
    ] },

  { id: 'iron-legs', name: 'Iron Legs', focus: 'lower-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Lunges, step-ups & hinges', ['dbLunge', 'stepUp', 'kbDeadlift15', 'gluteBridge']),
      blockCycle('Jumps, wall sits & bridges', ['squatJump', 'wallSit', 'cossackSquat', 'singleLegBridge'])
    ] },

  { id: 'half-power', name: 'Half Power', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockCycle('Rows & push-up mix', ['ringRow', 'pushup', 'ringPushup', 'pikePushup']),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCleanPress()
    ] },

  { id: 'upper-storm', name: 'Upper Storm', focus: 'upper-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 30,
    blocks: [
      blockCycle('Barbell press, rows & planks', ['barbellPress', 'plankHold', 'barbellRow', 'plankShoulderTaps']),
      blockCycle('Rows & push-up mix', ['ringRow', 'pushup', 'ringPushup', 'pikePushup']),
      blockSwap('Dumbbell press', 'dbPressHeavy', 'dbPressLight'),
      blockCycle('Dips, curls & raises', ['ringDip', 'dbCurl', 'tricepDips', 'dbLateralRaise'])
    ] },

  { id: 'engine-builder', name: 'Engine Builder', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 45,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Push-ups, climbers & crawls', ['pushup', 'mountainClimber', 'bearCrawl', 'jumpingJacks']),
      blockAlt('Burpees & Plank', 'burpee', 'plankHold'),
      blockCycle('Rows, curls & pulls', ['ringRow', 'dbCurl', 'renegadeRow', 'supermanPull'])
    ] },

  { id: 'driveway-demon', name: 'Driveway Demon', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 45,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockAlt('Driveway sprint & KB hold', 'sprint', 'kbRackHold15'),
      blockCycle('Climbers, skaters & crawls', ['mountainClimberFast', 'skaterHops', 'highKnees', 'bearCrawl']),
      blockAlt('Push-ups & Plank', 'pushup', 'plankHold'),
      blockAlt('Ring rows & Hollow rocks', 'ringRow', 'hollowRocks')
    ] },

  { id: 'backyard-strength', name: 'Backyard Strength', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 60,
    blocks: [
      blockSwap('Goblet squats', 'gobletSquat15', 'gobletSquat10'),
      blockAlt('Ring rows & Push-ups', 'ringRow', 'pushup'),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockCycle('Skipping & push-up mix', ['skipping', 'pushup', 'inchworm', 'pikePushup']),
      blockAlt('Barbell press & Plank', 'barbellPress', 'plankHold'),
      blockAlt('Driveway sprint & KB hold', 'sprint', 'kbRackHold15'),
      blockAlt('Ring hangs & Suitcase carry', 'ringTuckHold', 'dbSuitcaseCarry'),
      blockCleanPress()
    ] },

  { id: 'power-hour', name: 'Power Hour', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 60,
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
    ] },

  { id: 'long-haul', name: 'The Long Haul', focus: 'whole-body', format: 'tabata',
    warmupSec: 300, cooldownSec: 300, blockRestSec: 60,
    blocks: [
      blockCycle('Jacks, knees & skaters', ['jumpingJacks', 'highKnees', 'skaterHops', 'mountainClimber']),
      blockAlt('Burpees & Plank', 'burpee', 'plankHold'),
      blockCycle('Skipping & squats', ['skipping', 'airSquat', 'highKnees', 'squatJump']),
      blockAlt('Driveway sprint & Wall sit', 'sprint', 'wallSit'),
      blockCycle('Climbers & core burners', ['mountainClimberFast', 'bicycleCrunch', 'flutterKicks', 'plankShoulderTaps']),
      blockAlt('Squat jumps & Push-ups', 'squatJump', 'pushup'),
      blockCycle('Crawls & bridges', ['bearCrawl', 'gluteBridge', 'inchworm', 'singleLegBridge']),
      blockSwap('KB swings', 'kbSwing15', 'kbSwing10'),
      blockAlt('Skipping & Hollow rocks', 'skipping', 'hollowRocks'),
      blockCycle('Burpee finishers', ['burpee', 'russianTwistBw', 'skaterHops', 'supermanPull'])
    ] }
];
```

---

## Exact expansion logic (verbatim `buildSequence`, single-person path)

Reproduce this to get the ordered list of timed steps for a workout. For
Garmin, call with `people = 1`. Each returned entry has `{ kind, duration,
name, a }` where `a.task` is the exercise name for that step.

```javascript
const TABATA = { rounds: 8, workSec: 20, restSec: 10 };

const warmupExercise  = { task: 'Easy movement — skip / arm circles / squats / lunges / shake out' };
const cooldownExercise = { task: 'Walk, deep breaths, stretch hammies / hips / shoulders / chest' };

// block.solo(round) returns { task, alt, adapted, img } for the resolved exercise.
function buildSequence(workout, people) {
  const seq = [];
  const isDuo = people === 2;
  const pair = (ex) => isDuo ? { a: ex, b: ex } : { a: ex, b: null };

  if (workout.format === 'tabata') {
    if (workout.warmupSec > 0) {
      seq.push({ kind: 'warmup', duration: workout.warmupSec,
        name: `Warm-up — ${Math.round(workout.warmupSec / 60 * 10) / 10} min`, ...pair(warmupExercise) });
    }
    workout.blocks.forEach((block, blockIdx) => {
      for (let round = 1; round <= TABATA.rounds; round++) {
        const s = block.solo(round);
        seq.push({ kind: 'work', duration: TABATA.workSec,
          name: `Block ${blockIdx + 1} of ${workout.blocks.length}: ${block.name}`, a: s, b: null });
        seq.push({ kind: 'rest', duration: TABATA.restSec,
          name: `Block ${blockIdx + 1} of ${workout.blocks.length}: ${block.name}`, ...pair({ task: 'Rest — breathe' }) });
      }
      if (blockIdx < workout.blocks.length - 1) {
        seq.push({ kind: 'blockrest', duration: workout.blockRestSec,
          name: `Rest — next: Block ${blockIdx + 2}: ${workout.blocks[blockIdx + 1].name}`,
          ...pair({ task: 'Hydrate, reset, swap equipment if needed' }) });
      }
    });
    if (workout.cooldownSec > 0) {
      seq.push({ kind: 'cooldown', duration: workout.cooldownSec,
        name: `Cool-down — ${Math.round(workout.cooldownSec / 60 * 10) / 10} min`, ...pair(cooldownExercise) });
    }
  } else if (workout.format === 'stretch') {
    workout.stretches.forEach((stretch, idx) => {
      seq.push({ kind: 'stretch', duration: stretch.hold,
        name: `Stretch ${idx + 1} of ${workout.stretches.length}: ${stretch.name}`, ...pair({ task: stretch.name }) });
    });
  }
  return seq;
}
```

For each entry in the returned sequence, emit one Garmin workout step:
`duration_time = entry.duration` seconds, `wkt_step_name = entry.a.task`
(the exercise) — or use `entry.name` if you prefer the "Block X: …" label —
and set `intensity` from `entry.kind` (`warmup` / `active` for work /
`rest` for rest+blockrest / `cooldown` / `active` for stretch).

Garmin caps step names at ~15 chars on some models and workout files at a
finite step count — the 60-min workouts expand to ~160 steps, so check the
target model's limits early.
