# FIT — Flaux workout timer

A fast, opinionated Tabata + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Single static `index.html`. No build step. Deploys to Vercel.

## What's in the library

- 11 workouts spanning 10–45 minutes
- Focus filters: whole body, upper, lower, core, stretching
- 1-person and 2-person modes — equipment never doubles up on single-instance
  gear (one 15kg KB, one 10kg KB, one 10kg barbell, one set of rings, etc.)
- Round-by-round assignments per person, with weight swaps mid-block
- Injury alternative for every movement
- Wake lock, audio cues, two-tap reset, screen-on while training

## Equipment assumed

15kg kettlebell · 10kg kettlebell · 10kg barbell · dumbbells (set) ·
skipping rope · gymnastic rings · gravel driveway (~1 min round trip).

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
