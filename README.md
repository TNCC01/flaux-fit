# FIT, the Flaux workout timer

A fast, opinionated interval + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Static files, no build step. Deploys to Vercel.

## How it works

The home screen asks how you want to train:

- **Just pick for me**: equipment, how long you've got, how many of you. Go.
- **Let me choose**: the same, plus which areas of the body to target and
  anything you'd rather not do.
- **Stretch & mobility**: three mobility routines, no gear, no pressure.
- **Workouts**: what you did recently, anything you saved, and the 16
  named classics.

Workouts in the first two paths are **generated on the spot** rather than
pulled from a table of presets. The input space (6 equipment items × 8
durations × 2 people × 2 interval styles × 31 region combinations ×
arbitrary exclusions) is far too large for presets to cover, which is why
short preset sessions used to feel like a trimmed-down copy of the long
ones. The generator composes from the whole library every time and
remembers what recent sessions used, so consecutive workouts differ. In
testing, back-to-back 30-minute sessions share under a quarter of their
movements.

## Interval styles

Both run a **240-second block** and the **same 160 seconds of work**, so
switching between them never changes how long a workout takes, only how
long each effort lasts:

| Style | Rounds | Work | Rest | Feel |
|---|---|---|---|---|
| Short bursts | 8 | 20s | 10s | More stops, more recovery |
| Long efforts | 4 | 40s | 20s | Half the stops, so it burns more |

Cues that name a time ("swap sides at 10s", "change every 5s") are written
from the live interval, so they stay truthful in both styles. Weight-swap
blocks change load at the halfway round, derived from the round count
rather than hardcoded.

## What's in the library

- **157 movements** across five body regions (chest & shoulders, back &
  arms, core & abs, legs & glutes, cardio) and fourteen movement patterns
- **145 hand-authored animations**, one per movement. Poses are
  joint coordinates in `scripts/gen-anims.py`, interpolated and baked to
  self-animating SVGs in `img/exercises/<base>.svg`
- **16 named workouts** and **3 stretch routines**
- Equipment picker: tap off gear you haven't got and nothing needing it
  gets picked
- Target-area picker: a tappable body diagram and matching labels, both
  driving the same selection
- Exclusions: four quick constraint filters (no jumping / floor work /
  overhead / running) plus a searchable list of every movement
- Warm-up and cool-down that scale with the session instead of wrapping a
  10-minute workout in 10 minutes of walking
- Injury alternative for every movement
- Adjustable exercise text size, for reading across a room
- Workout history, so a generated session you liked but forgot to save is
  still there afterwards, with one tap to reopen it or save it properly.
  Deliberately browser-only: it sits in localStorage with the other
  preferences, there is no account and no server, and clearing the browser
  clears it too
- Wall-clock timer, wake lock, audio cues, two-tap reset

Two people never get handed the same single-instance item (one 15kg KB, one
10kg KB, one barbell, one rope, one set of rings) in the same round. That
holds for generated and named workouts alike, and for solo builds too,
since a workout can be reopened later with two people selected.

## Layout

```
index.html              markup only
css/app.css
js/exercises.js         the movement dictionary + regions + stretches
js/workouts.js          intervals, block helpers, the named classics
js/generator.js         builds a workout to order
js/app.js               views, setup flows, rendering, timer
img/exercises/*.svg     generated, do not hand-edit
scripts/gen-anims.py    pose source for the animations
scripts/selfcheck.mjs   data + generator validation
scripts/export-sequence.mjs   expand a workout to timed steps as JSON
```

## Local dev

```sh
python3 -m http.server 4173      # then open http://localhost:4173
```

## Checks

Run before committing:

```sh
node scripts/selfcheck.mjs
```

It validates every exercise's fields, that every movement has artwork and a
bodyweight fallback, that no block hands one item to two people in any
round of either interval style, that duration labels match what the timer
actually runs, and that all 496 generator input combinations either build a
valid workout or refuse for a good reason.

It also guards three CSS patterns that break press-and-drag scrolling on
iOS while leaving a fast flick working, which makes them easy to miss and
impossible to catch in a desktop browser or on Android: any non-`auto`
`touch-action`, a `transform` inside an `:active` rule, and a `transition`
that includes `transform`.

## Why the app scrolls a container, not the document

`#scroller` is a fixed, full-viewport element with `overflow-y: auto`, and
everything lives inside it.

On iPadOS a slow press-and-drag starting on page content gets claimed by the
system drag-and-drop gesture and never becomes a document scroll. A fast
flick wins the race first, which is why flicking always worked. Since the
cards cover most of the screen, that left almost nowhere to drag from. It
reproduces on old builds too, so it is not something this rework introduced,
and it does not happen on Android or on a desktop browser.

An element with `overflow-y: auto` gets its own scroll view, and a drag
inside one scrolls it from anywhere, buttons included. On iPad this costs
nothing, because Safari's toolbar is always visible there and from the home
screen there is no toolbar at all.

`scroll-test.html` is the on-device harness used to narrow this down. It can
go once the fix is confirmed.

After editing poses:

```sh
python3 scripts/gen-anims.py
```

## Deploy

```sh
vercel deploy --prod
```

Production: `fit.flaux.com.au` (CNAME -> `cname.vercel-dns.com`)
