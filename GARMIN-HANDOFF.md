# FIT → Garmin — handoff for the Garmin session

**Goal:** let the user follow a FIT workout on their Garmin watch instead of
the phone — the watch guides each timed interval (exercise name on screen +
vibration at every change), matching what the web app does at
fit.flaux.com.au.

**Repo:** `TNCC01/flaux-fit`. The web app is static files deployed to Vercel,
auto-deploying from `main`. **The Garmin work does not change the web app.**

**Ask the user which Garmin watch model they have** (e.g. Forerunner 265,
Fenix 7, Venu 3, Instinct 2) before choosing an approach — feature support
varies by model.

---

## Do not copy the data model into this file

An earlier version of this document contained the entire exercise dictionary
and every workout, pasted verbatim. It went stale as soon as the library
changed, and a stale copy is worse than no copy — it looks authoritative.

Instead, **ask the app for what you need.** `scripts/export-sequence.mjs`
reads the same source the app runs on and prints a workout already expanded
into timed steps:

```sh
node scripts/export-sequence.mjs --list
node scripts/export-sequence.mjs power-hour
node scripts/export-sequence.mjs power-hour --interval long --people 1
node scripts/export-sequence.mjs --generate --minutes 30 --regions legs,core
```

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

---

## What changed since this doc was first written

Worth knowing before you start, because it affects step counts and names:

- **Two interval styles.** `short` is the original 8 × (20s + 10s); `long` is
  4 × (40s + 20s). Both are 240s per block and 160s of work, so a workout is
  the same length either way — but `long` produces roughly **half the steps**,
  which matters if you hit a step-count ceiling on the target model. Pass
  `--interval long` to get the shorter file.
- **Most workouts are now generated, not preset.** The 16 named classics are
  still there and still exportable by id. For anything else, use
  `--generate` with the same inputs the app takes.
- **Exercise names are short, with the load appended** (`Goblet squats · 15kg`)
  and the coaching detail moved to `note`. Garmin truncates step names at
  ~15 characters on some models, so prefer `name` and consider trimming the
  load suffix if the model is tight on space.
- **Warm-up and cool-down scale with session length** (2–5 minutes each),
  they are no longer always 5 + 5.
- **Single-person export is still the sensible default** for a watch. Passing
  `--people 2` puts person B's movement in `note`.

---

## Two approaches (recommend starting with Route 1)

### Route 1 — Garmin structured-workout `.FIT` files (recommended)
Garmin watches natively support structured workouts: a list of timed steps,
each with a name and duration, that the watch walks you through, buzzing at
every change. FIT's block structure maps onto this directly.

Build a generator (standalone script, Python or Node) that consumes the JSON
above and emits one `.FIT` file per workout. Suggested library: Garmin's
official **FIT SDK** (`garmin-fit-sdk`), or the Python `fit-tool` package, to
encode `WorkoutMesg` + `WorkoutStepMesg` records. The user loads the files
onto the watch (USB, drop into `GARMIN/Workouts/`), or pushes via Garmin
Connect if the toolchain supports it.

Check early: the 60-minute workouts expand to ~160 steps in `short` mode
(~85 in `long`), and some models cap workout step counts.

### Route 2 — Connect IQ native watch app (bigger project, later)
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
