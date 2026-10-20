# FIT to Garmin: handoff for the Garmin session

**Goal:** let the user follow a FIT workout on their Garmin watch instead of
the phone. The watch guides each timed interval (exercise name on screen plus
vibration at every change), matching what the web app does at
fit.flaux.com.au.

**Repo:** `TNCC01/flaux-fit`. The web app is static files deployed to Vercel,
auto-deploying from `main`. **The Garmin work does not change the web app.**

**Ask the user which Garmin watch model they have** (e.g. Forerunner 265,
Fenix 7, Venu 3, Instinct 2) before choosing an approach, because feature support
varies by model.

---

## Do not copy the data model into this file

An earlier version of this document contained the entire exercise dictionary
and every workout, pasted verbatim. It went stale as soon as the library
changed, and a stale copy is worse than no copy, because it looks authoritative.

Instead, **ask the app for what you need.** `scripts/export-sequence.mjs`
reads the same source the app runs on and prints a workout already expanded
into timed steps:

```sh
node scripts/export-sequence.mjs --list
node scripts/export-sequence.mjs power-hour
node scripts/export-sequence.mjs power-hour --interval long --people 1
node scripts/export-sequence.mjs power-hour --interval emom --gear kb15,kb10
node scripts/export-sequence.mjs --generate --minutes 30 --regions legs,core
node scripts/export-sequence.mjs --generate --minutes 30 --interval mix --mix emom,short,amrap
```

`--interval` takes any of the five styles below, or `mix` with `--generate`
(a classic runs in one style, so asking for a classic as a mix is refused
with a reason). `--gear` lists the kit on hand, or `none` for bodyweight;
by default everything is on.

Output shape:

```json
{
  "id": "kb-blitz",
  "name": "KB Blitz",
  "interval": { "id": "long", "rounds": 4, "workSec": 40, "restSec": 20 },
  "totalSeconds": 870,
  "stepCount": 19,
  "steps": [
    { "kind": "warmup", "intensity": "warmup", "seconds": 180,
      "name": "Warm-up", "note": "Easy movement" },
    { "kind": "work", "intensity": "active", "seconds": 40,
      "name": "Goblet squats · 15kg", "note": "Bell at the chest" }
  ]
}
```

Each step maps 1:1 onto a Garmin `WorkoutStepMesg`:

| Garmin field | Source |
|---|---|
| `duration_type` | always `time` |
| `duration_time` | `step.seconds` |
| `wkt_step_name` | `step.name` |
| `intensity` | `step.intensity` (already `warmup` / `active` / `rest` / `cooldown`) |

Some steps carry more than a name and a time, for the styles that count reps:

| Field | On | Holds |
|---|---|---|
| `reps` | EMOM work steps | the target for that minute, e.g. `"8 reps"`, `"20s each side"` |
| `lap` | AMRAP and For Time work steps | the exercises in one lap, each `{ name, reps }` |
| `lapB` | the same, with `--people 2` | person B's lap |
| `laps` | For Time work steps | how many laps to finish inside the cap |

`note` always spells the same thing out in words, so a model that only shows
the step name and a line of text still gets the target.

---

## What changed since this doc was first written

Worth knowing before you start, because it affects step counts and names:

- **Five interval styles, plus a mix.** Every block is 240s whichever style
  runs it, so a workout is the same length in any of them, but the step count
  changes a lot, which matters if you hit a step-count ceiling on the target
  model:
  - `short`: 8 × (20s work + 10s rest), 16 steps a block.
  - `long`: 4 × (40s work + 20s rest), 8 steps a block.
  - `emom`: 4 × 60s, one step a minute with the rep target in `reps`; the
    rest is whatever's left of the minute, so there's no rest step.
  - `amrap`: one 240s step a block; `lap` lists the exercises to go round.
  - `fortime`: one 240s step a block (the cap), with `laps` to finish. On the
    watch it runs to the cap; finishing early just means more rest.
  - `mix`: two or three of the above back to back, each a section of its own,
    with a 75s `changeover` step (intensity `rest`) between sections. EMOM,
    AMRAP and For Time sections can run longer than 4 minutes in a mix.
- **Most workouts are now generated, not preset.** The 16 named classics are
  still there and still exportable by id. For anything else, use
  `--generate` with the same inputs the app takes.
- **Exercise names are short, with the load appended** (`Goblet squats · 15kg`)
  and the coaching detail moved to `note`. Garmin truncates step names at
  ~15 characters on some models, so prefer `name` and consider trimming the
  load suffix if the model is tight on space.
- **Warm-up and cool-down scale with session length** (2 to 6 minutes each),
  they are no longer always 5 + 5. Blocks come in four-minute lumps, so the
  cool-down also takes up any time they leave short of the minutes asked for:
  a 20-minute session is 20:00 exactly.
- **Single-person export is still the sensible default** for a watch. Passing
  `--people 2` puts person B's movement in `note`.

---

## Two approaches (recommend starting with Route 1)

### Route 1: Garmin structured-workout `.FIT` files (recommended)
Garmin watches natively support structured workouts: a list of timed steps,
each with a name and duration, that the watch walks you through, buzzing at
every change. FIT's block structure maps onto this directly.

Build a generator (standalone script, Python or Node) that consumes the JSON
above and emits one `.FIT` file per workout. Suggested library: Garmin's
official **FIT SDK** (`garmin-fit-sdk`), or the Python `fit-tool` package, to
encode `WorkoutMesg` + `WorkoutStepMesg` records. The user loads the files
onto the watch (USB, drop into `GARMIN/Workouts/`), or pushes via Garmin
Connect if the toolchain supports it.

Check early: a 60-minute workout expands to about 170 steps in `short`, 90
in `long`, 50 in `emom` and 20 in `amrap` or `fortime`, and some models cap
workout step counts.

### Route 2: Connect IQ native watch app (bigger project, later)
A Monkey C app mirroring FIT (menu, round bars, equipment logic). Full
experience but a real app-dev effort: Connect IQ SDK, simulator, sideloading
or store listing. Only worth it if Route 1 leaves gaps.

---

## Source of truth

If you need to read the data directly rather than via the export:

| What | Where |
|---|---|
| Movement dictionary, regions, stretches | `js/exercises.js` |
| Interval definitions, block helpers, named classics | `js/workouts.js` |
| Workout generation | `js/generator.js` |
| Sequence expansion (`buildSequence`) | `js/app.js` |

`node scripts/selfcheck.mjs` validates all of it and is the fastest way to
confirm an assumption still holds.
