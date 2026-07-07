# FIT — Flaux workout timer

A fast, opinionated Tabata + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Single static `index.html`. No build step. Deploys to Vercel.

## What's in the library

- 18 workouts from 10 minutes up to an hour, with menu duration labels
  computed from real phase math
  (e.g. "23 min · 13 min work + 10 min warm-up/cool-down")
- A shared exercise dictionary (~60 movements) with equipment tags —
  workouts reference exercises by id
- Equipment picker on the menu: tap off gear you don't have and affected
  exercises swap to bodyweight fallbacks ("Adapted for your equipment")
- Focus filters: whole body, upper, lower, core, stretching
- 1-person and 2-person modes — equipment never doubles up on single-instance
  gear (one 15kg KB, one 10kg KB, one 10kg barbell, one set of rings, etc.)
- Round-by-round assignments per person, with weight swaps mid-block and
  exercise cycles for round-to-round variety
- 5-minute warm-up and cool-down bookends on every tabata workout
- Injury alternative for every movement
- Animated Tron-style android demos on the workout screen for every
  exercise (toggleable): smooth interpolated motion, alternating body
  types, and the working muscle group lit in rose. Poses are joint
  coordinates in `scripts/gen-anims.py`, baked to self-animating SVGs in
  `img/exercises/<base>.svg` — edit and re-run to tweak the look
- Wake lock, audio cues, two-tap reset, screen-on while training

## Equipment supported

15kg kettlebell · 10kg kettlebell · 10kg barbell · dumbbells (set) ·
skipping rope · gymnastic rings · gravel driveway (~1 min round trip).
Bodyweight is always available; deselected gear falls back to it.

## Garmin watch export

`garmin/` holds one structured-workout `.fit` file per workout (18 files),
generated from the workouts array by `scripts/generate-fit.mjs` (plain Node,
no dependencies). Sideload them onto a Garmin watch and it guides every
interval with the exercise name and a vibration - matching the app. The
generator reads the app's real `EXERCISES` dictionary and `buildSequence`
out of `index.html`, so it stays in sync. See [garmin/README.md](garmin/README.md)
for watch setup and `GARMIN-HANDOFF.md` for the data model.

## Local dev

```sh
# Serve the static file with any static server
python3 -m http.server 4173
# then open http://localhost:4173
```

## Deploy

```sh
vercel deploy --prod
```

## Domain

Production: `fit.flaux.com.au` (CNAME → `cname.vercel-dns.com`)
