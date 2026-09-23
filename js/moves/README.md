# Authoring 3D movements

The tap-through viewer (`move.html#<exerciseId>`) plays a 3D demonstration of each
movement with coaching notes. The data lives here, one file per family, keyed by the
animation name (`img` in `js/exercises.js`). Several exercises can share one
animation (air squats and tempo squats both use `bwSquat`), so write the coaching
for the movement they share. When a variant needs its own 3D version (the kettlebell
Russian twist), key a record by the exercise id itself (`russianTwistKb`): the viewer
prefers it over the shared animation.

The in-workout SVG prompts (`img/exercises/`, from `scripts/gen-anims.py`) are a
separate, lighter system. This is the reference version: it has to be right.

## The bar

Best-practice form as a good strength coach or physio would teach it: joint angles
in believable human ranges, the right positions at each phase, feet and hands
planted where they stay planted, sensible tempo. Not a caricature, not a stick
figure. When in doubt, pick the textbook version of the movement.

## Files and families

| file | family |
| --- | --- |
| `legs.js` | squats, calf raises, box jumps, thrusters |
| `lunge.js` | split squats, lunges, step-ups, cossack |
| `hinge.js` | deadlifts, RDLs, swings, snatch, bridges, hip thrusts, kickbacks |
| `push.js` | push-up variants, floor presses, ring push-ups |
| `press.js` | overhead presses, pike and handstand work, dips, raises, triceps |
| `pull.js` | rows, curls, chin-ups and hangs, shrugs, upright rows, carries |
| `core.js` | planks, bear holds, dead bugs, bird dogs, side planks, crawls, get-ups |
| `abs.js` | crunches, sit-up family, leg raises, twists, woodchops |
| `cardio.js` | jumps, jacks, burpees, climbers, running drills, skipping |

`bwSquat` (legs.js), `pushup` (push.js) and `barbellPress` (press.js) are worked
examples: read them first.

## Coordinates

Metres. Y is up, the floor is y = 0. The figure faces **+Z**; **+X is the figure's
left**. A standing figure (1.75 m) has:

| point | where |
| --- | --- |
| hip joints (pelvis.pos is their midpoint) | x ±0.09, y 0.93 standing |
| shoulder joints | x ±0.19, about 0.445 above and 0.035 behind the hip joints along the trunk |
| head centre | about 0.66 above the hip joints |
| thigh, shin | 0.43 each |
| upper arm, forearm | 0.30, 0.26 (wrist to fingertip 0.18) |
| ankle joint when the foot is flat | y 0.07 |
| wrist joint when the palm is flat on the floor | y 0.03 |
| foot | toe tip 0.19 in front of the ankle, heel 0.055 behind |

A leg can reach 0.86 from hip joint to ankle, an arm 0.56 from shoulder to wrist.
Targets beyond that fail the check.

## A movement record

```js
name: {
  camera: { yaw: 40, pitch: 8 },     // opening view: yaw 0 front, 90 the left side
  props: [ { type: 'kettlebell', hand: 'R' } ],
  muscles: { primary: ['glutes', 'hamstrings'], secondary: ['core', 'forearms'] },
  coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
  keys: { start: { label: 'Start', ...pose }, end: { label: 'Top', ...pose } },
  seq: ['start', 'end'],             // play order; loops back to the first
  tempo: [1.8, 1.0],                 // seconds for each move in seq (or one number)
  holds: { end: 0.3 },               // pause on arriving at a pose (default 0.25; 0 for a jump's peak)
}
```

Muscle names: `quads hamstrings glutes adductors calves core obliques lowerBack chest
shoulders triceps biceps forearms lats upperBack traps hipFlexors`.

### A pose (all fields optional)

The full reference is the comment at the top of `js/move/body.js`. In short:

- `pelvis: { pos: [x, y, z], pitch, yaw, roll }`: pitch + tips forward (90 lies face
  down, head to +Z), - tips back (-90 lies face up, head to -Z). `y: 'auto'` drops the
  body until its lowest point touches the floor (handy for lying and kneeling poses
  built from angles).
- `spine`, `neck: { flex, side, twist }`: flex + forward, - arched back.
- Legs and arms by **target** (IK, world coordinates) or by **angles** (FK):
  - `legs: { L: { foot: [x,y,z], knee: 'fwd', toeOut: 10, heel: 0 }, R: 'mirror' }`
  - `legs: { L: { hip: { flex, abd, rot }, knee, ankle }, R: ... }`
  - `arms: { L: { hand: [x,y,z], elbow: 'back', palm: 'floor', wrist: 0 }, R: 'mirror' }`
  - `arms: { L: { shoulder: { elev, plane, twist }, elbow, wrist }, R: ... }`
  - `'mirror'` copies the other side across the midline (targets flip x).
- Knee and elbow hints are directions the kneecap / point of the elbow faces:
  `'fwd' 'back' 'up' 'down' 'out' 'in'` or a vector like `[0.3, 0, 1]`.

Use targets for anything planted (feet on the floor, hands on the floor or a bench,
hands on a bar path) and give **the same target in every pose where it stays put**,
so it doesn't slide. Use angles for limbs moving freely through the air (an arm
swing, a leg lift, a kick) so they swing in arcs.

A foot whose ankle is near the floor (y under 0.1) is laid flat automatically. `heel`
tips it about the ankle: **negative raises the heel** onto the ball of the foot (raise
the ankle target too, so the ball stays on the floor), positive lifts the toes onto
the heel. A foot resting on a box or bench top isn't flattened automatically; a tiny
`heel: 0.01` keeps it level. Feet off the floor point their toes softly
(`ankle` overrides). A foot resting on its toes (push-ups, planks) tips itself so the
toes rest on the floor.

### Equipment

`props` follow the hands every frame:

- `{ type: 'dumbbell', hand: 'L' }` (one per hand)
- `{ type: 'kettlebell', hand: 'R' }` or `hand: 'both'` (held between the hands)
- `{ type: 'barbell', length: 1.5, plate: 0.13 }` (between the hands; 10 kg bar)
- `{ type: 'rings' }` straps to both hands (hands must be up in the air)
- `{ type: 'rope', period: 0.5 }` skipping rope turning around the body
- `{ type: 'box', pos: [x, 0, z], size: [w, h, d] }`, `{ type: 'bench', ... }`, `{ type: 'wall', z: -0.4 }`

A box or bench top is at y = size[1]. Put feet or hands on it with targets.

## Coaching text

Readers are everyday people training at home. Write in plain Australian English:

- **setup**: 2 to 4 short sentences on starting position.
- **steps**: 3 to 5, in order.
- **cues**: 2 to 4 short phrases someone could say out loud.
- **mistakes**: 3 or 4 common faults and why they matter.
- **breathing**, **tempo**: one line each.

No em dashes (use commas, colons or full stops). No hype words (transformative,
seamless, robust, leverage, utilise). Say "use", "keep", "push". Be specific:
"hips level with the shoulders" beats "maintain proper alignment". Don't make medical
claims; the page already carries a general note.

Labels (`keys.<name>.label`) show on screen as the figure reaches each pose: 1 to 3
words, like "Bottom", "Lockout", "Knee drive".

## Checking your work

```sh
node scripts/move-check.mjs --joints --out /tmp/mine.png name1 name2
node scripts/move-check.mjs --big --out /tmp/mine.png name1      # bigger pictures
```

It renders each key pose and the halfway point of each move from the front, side
and three-quarters into a PNG, prints `FAIL` lines for mechanical faults (unreachable
targets, body through the floor), and with `--joints` prints where the shoulders,
hips, elbows, knees, wrists and ankles land in each pose so you can place targets
against them.

Then **look at the picture**. The checker can't see bad form: a knee caving in, a
rounded back on a deadlift, an arm through the torso, a heel off the floor that
shouldn't be. Fix and re-run until it's clean and looks like a coach demonstrating.

Run `node scripts/move-check.mjs` with no names to check everything.
