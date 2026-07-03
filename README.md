# FIT — Flaux workout timer

A fast, opinionated Tabata + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Single static `index.html`. No build step. Deploys to Vercel.

## What's in the library

- 13 workouts from 10 minutes up to an hour, with menu duration labels
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
- Two-frame demonstration photos on the workout screen for most exercises
  (toggleable), stored in `img/exercises/` as `<base>-{0,1}.jpg` so richer
  media (GIF/video) can drop in later
- Wake lock, audio cues, two-tap reset, screen-on while training

## Equipment supported

15kg kettlebell · 10kg kettlebell · 10kg barbell · dumbbells (set) ·
skipping rope · gymnastic rings · gravel driveway (~1 min round trip).
Bodyweight is always available; deselected gear falls back to it.

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

## Media credits

Exercise demonstration photos are from the
[Free Exercise DB](https://github.com/yuhonas/free-exercise-db)
(public domain, Unlicense), resized and bundled locally.

## Domain

Production: `fit.flaux.com.au` (CNAME → `cname.vercel-dns.com`)
