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
- Share a workout as a link. The seed and the request that built it are
  packed into the URL, so it opens the exact same session on any phone or
  tablet, with no account and no server involved
- Works offline after the first visit. A service worker caches the app
  and every animation, so it opens in the gym with no wifi

Two people never get handed the same single-instance item (one 15kg KB, one
10kg KB, one barbell, one rope, one set of rings) in the same round. That
holds for generated and named workouts alike, and for solo builds too,
since a workout can be reopened later with two people selected.

## Layout

```
index.html              markup only
sw.js                   service worker: offline cache
css/app.css
js/exercises.js         the movement dictionary + regions + stretches
js/workouts.js          intervals, block helpers, the named classics
js/generator.js         builds a workout to order
js/app.js               views, setup flows, rendering, timer
img/exercises/*.svg     generated, do not hand-edit
scripts/gen-anims.py    pose source for the animations
scripts/selfcheck.mjs   data + generator validation
scripts/e2e.mjs         drives the app in headless Chromium
scripts/export-sequence.mjs   expand a workout to timed steps as JSON
.github/workflows/      runs every check on each pull request
```

## Offline

`sw.js` caches the app shell and all 145 animations when it installs, on
the first visit. The app files are served network-first with a four-second
timeout, so online you always get the current version and a flaky
connection falls back to the cache rather than hanging; the animations are
served cache-first and refreshed in the background. Bump `VERSION` in
`sw.js` to force old caches out, though nothing depends on remembering to.

## Local dev

```sh
python3 -m http.server 4173      # then open http://localhost:4173
```

## Checks

```sh
npm install                      # once: Playwright, for the browser suite
npx playwright install chromium  # once
npm test                         # self-check, then the browser suite
```

`node scripts/selfcheck.mjs` needs nothing installed. It validates every
exercise's fields, that every movement has artwork and a bodyweight
fallback, that no block hands one item to two people in any round of either
interval style, that duration labels match what the timer actually runs,
and that all 496 generator input combinations either build a valid workout
or refuse for a good reason. It also proves a workout rebuilds exactly from
its stored request and seed, and that a seed builds the same workout
whatever sort algorithm the browser uses. Safari and Chrome sort
differently, and a favourite saved on the iPad has to come back identical
on the phone.

`node scripts/e2e.mjs` serves the app itself and drives it in headless
Chromium at iPad size: every path from the welcome screen, saving and
replaying a favourite, the interval preference surviving a replay, history,
the timer recovering time after a suspension, exclusions, stretch, text
size, a share link opened in a fresh browser context, corrupt preferences,
a phone-width layout, and the app opening with the network switched off.
It fails on any console error.

Both run on every pull request through GitHub Actions, along with a check
that the animations on disk still match their poses.

After editing poses:

```sh
python3 scripts/gen-anims.py
```

## Deploy

```sh
vercel deploy --prod
```

Production: `fit.flaux.com.au` (CNAME -> `cname.vercel-dns.com`)
