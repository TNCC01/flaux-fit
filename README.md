# FIT, the Flaux workout timer

A fast, opinionated interval + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Static files, no build step. Deploys to Vercel.

## How it works

On a first visit FIT asks who's training (just you, or you and a mate) and
what gear you've got, with everything unticked, including the weights of
any kettlebells, dumbbells or barbell you tick, and saves the answer as the
Home gear set. After that the home screen has three cards:

- **Today** (Build a workout): how long you've got and how many of you,
  filled in from last time, where you're training once there's more than
  one place, a line with the style and goal, and Start. **Change** opens
  the full setup: what it's for, how many of you, your gear, how long
  you've got and the style. Target areas and anything you'd rather not do
  sit under **More options**, closed by default, with a line saying what's
  set ("Whole body · nothing left out") so a choice from last time can't
  catch you out. While Surf Fit is on and today's session is still to do,
  the card is that session instead, with "Something else today" to set it
  aside for the day.
- **Programs**: a session a day that builds week by week (Surf Fit). The
  card says where you're up to ("Surf Fit · week 2 of 6").
- **Saved & ready-made**: your favourites and recent sessions, the 16 named
  classics, and the stretch routines (the Stretching filter shows just
  those).

Built workouts are **generated on the spot** rather than
pulled from a table of presets. The input space (10 equipment items × 8
durations × 2 people × 5 workout styles × 31 region combinations ×
arbitrary exclusions) is far too large for presets to cover, which is why
short preset sessions used to feel like a trimmed-down copy of the long
ones. The generator composes from the whole library every time and
remembers what recent sessions used, so consecutive workouts differ. In
testing, back-to-back 30-minute sessions share under a quarter of their
movements.

## Workout styles

All five run a **240-second block**, so switching between them never
changes how long a workout takes, only how each minute is spent. The two
timed styles also do the **same 160 seconds of work**:

| Style | Rounds | Work | Rest | Feel |
|---|---|---|---|---|
| Short bursts | 8 | 20s | 10s | More stops, more recovery |
| Long efforts | 4 | 40s | 20s | Half the stops, so it burns more |
| EMOM | 4 | the reps | rest of the minute | Faster reps, more rest |
| AMRAP | 1 | as many laps as you can | none | Your own pace, keep score |
| For Time | 1 | a set number of laps | whatever's left of the 4 min cap | Race the clock |

In an EMOM each exercise has a rep target (`emom` in `js/exercises.js`):
a count, a count per side, or a timed effort for holds and carries, pitched
to take 30 to 40 seconds so there's time left in the minute to recover. The
card shows it above the name ("12 reps", "8 each side", "40s"). One number
for everyone for now; levels can come later.

In an AMRAP each block becomes one four-minute lap of its exercises, each
at about two thirds of its EMOM target since they're done back to back.
The card lists the lap (tap an exercise to see its figure) with a "+1
round" counter at the top. The score is saved with the session in history,
and the next time you open the same workout the counter shows last time's
number to beat. With two people, B starts one exercise along, and anything
in B's lap that needs a kettlebell, the barbell, the rope or the rings that
A's lap also uses goes to its bodyweight version, because the two of you
won't be in step.

**Surf fitness** is a goal you pick at the top of setup, alongside General
fitness. It builds from exercises tagged with what they do for surfing
(`surf` in `js/exercises.js`: pop-up, paddle, legs, rotation, shoulders) in
a set rhythm: pop-up power while you're fresh, then paddling, legs and
balance, shoulder care, pop-ups again, paddling, rotation. It works with
every style, Mix, two people and any gear. Twelve exercises are surf
specific (pop-ups, sprawl to pop-up, pop-up to bottom turn, prone paddling,
prone swimmers, band paddle pulls, duck-dive and scap push-ups, band
external rotations, surf stance holds, deep squat holds, open-book
rotations), and Surf Mobility in the stretch library covers hips, upper
back, shoulders and ankles.

**Programs** (a card on the home screen) run a session a day that
builds week by week. The first is **Surf Fit**, six weeks on a weekly
rhythm: paddle power, pop-ups and legs, mobility, an engine mix (EMOM then
AMRAP), paddle and shoulders, pop-ups and turns, and an easy day. Rep
targets start at 80% and build over the six weeks to 110% (`repScale`);
timed days have no reps to scale. Each day builds through the generator
with the day's style and focus, at whatever length you pick, with today's
people, gear and weights, and leaves out whatever Build a workout leaves
out (the day's card says what, with a Change link). Every length is on
offer: picked shorter than its mix needs, the Engine day runs its EMOM on
its own (`programStyle`). Progress moves on when a day is done, not by the
calendar, so a missed day waits; "I surfed today" counts a surf instead,
with an Undo straight after in case of a mis-tap. The screen shows the
week, the day, a streak and a strip of this week's days. Programs are
defined in `PROGRAMS` in `js/workouts.js`.

**Mix** runs two or three of these styles back to back in one session,
in the order you tap them, and still fits the minutes you picked exactly,
warm-up and cool-down included (one of each). Short bursts and long efforts
keep their four-minute blocks; EMOM, AMRAP and For Time stretch or shrink in
whole minutes to take up the rest, any spare minute going to the EMOM, and
leftover seconds go on the cool-down. A 30-minute EMOM, short bursts and
AMRAP mix is a 4-minute warm-up, a 6-minute EMOM, two short-burst blocks,
a 6-minute AMRAP and a 3-minute cool-down, with a 75-second changeover
between styles that says what's coming and how it works. Setup shows that
breakdown as you pick, or the shortest session the mix fits in. All the
exercises are picked in one pass, so muscle groups and gear are spread
across the whole session, not chosen per section.

For Time uses the same laps with a set amount of work: 3 rounds of a lap
of three or more exercises, 4 of two, 5 of one, which lands around three
minutes for most people. The clock counts up, each person taps Done when
they finish (the time is saved like an AMRAP score, and shows as "Last
time" next go), and once everyone's done the rest of the four-minute cap
counts down as rest. Miss the cap and it's logged as capped. A block
skipped before anyone scores shows as "–" in history, not 0 or capped.

Cues that name a time ("swap sides at 10s", "change every 5s") are written
from the live interval, so they stay truthful in both styles. Weight-swap
blocks change load at the halfway round, derived from the round count
rather than hardcoded.

## What's in the library

- **183 movements** across five body regions (chest & shoulders, back &
  arms, core & abs, legs & glutes, cardio) and fourteen movement patterns
- **A 3D figure for every movement**, shown on the workout card at its
  best angle. Drag sideways to turn it. Tap it and a sheet opens over the
  timer with the full view: the figure at a coached tempo, the working
  muscles lit, and set-up steps, cues, common mistakes and breathing.
  `move.html` on its own is the library of all of them. See "3D
  movements" below
- **What's coming up**: during a rest, a button shows the next block's
  exercises as small moving figures, each opening the full view
- **16 named workouts** and **3 stretch routines**
- Equipment picker: kettlebells, a barbell, dumbbells, a skipping rope,
  rings, a pull-up bar, resistance bands, a medicine or slam ball and a box
  or bench. Tap off gear you haven't got and nothing needing it gets
  picked; moves that stand on a box or bench fall back to a floor version. Under kettlebells, dumbbells and the barbell, tick the
  weights you own (or what the bar is loaded to). The heaviest bell goes to
  swings, squats and deadlifts and the one nearest two thirds of it to
  presses and single-arm work, likewise for dumbbell pairs, and every card
  shows the real weight. Exercises name roles ("the heavier bell"), not
  weights, so favourites and share links keep working whatever you own
- Gear sets: save the gear and weights for each place you train ("Home",
  "Mate's place") and switch between them with one tap. Changes made in
  setup go into the selected set
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
  The last 200 sessions are kept, each with who trained (so a score stays
  with the person who made it after a rename, and "Last time" follows the
  person, not the spot) and, for a program day, its name and where it sits
  ("Pop-ups & legs", "Surf Fit · Week 1, Day 2"). Clear history takes two
  taps. Deliberately browser-only: it sits in localStorage with the other
  preferences, there is no account and no server, and clearing the browser
  clears it too. Once there's a finished session, a favourite or a program,
  FIT asks the browser to keep its storage (`navigator.storage.persist`).
  Two tabs open at once take each other's history, favourites and program
  progress as they save, so neither writes over the other. On an iPhone or
  iPad the home-screen app keeps its own storage, separate from Safari's,
  and the Add to Home Screen hint says so
- Wall-clock timer, wake lock (kept through a pause), audio cues that still
  play with an iPhone on silent (a setting, since it pauses other music),
  two-tap reset, and two taps on Menu once a workout is going. Tap the
  timer to pause or resume; on a phone, Start, Skip and Reset stay on
  screen however long the cards get
- A finish screen with Done (home, or back to the program for a program
  day), Start over, and Save and Share. Skipping to the end without ever
  pressing Start doesn't count as a session done
- Share a workout as a link. The seed and the request that built it are
  packed into the URL, so it opens the exact same session on any phone or
  tablet, with no account and no server involved
- Works offline after the first visit. A service worker caches the app
  and the 3D figures, so it opens in the gym with no wifi

Two people never get handed the same single-instance item (one 15kg KB, one
10kg KB, one barbell, one rope, one set of rings) in the same round. That
holds for generated and named workouts alike, and for solo builds too,
since a workout can be reopened later with two people selected.

## Layout

```
index.html              markup only
move.html               the 3D movement viewer and library
sw.js                   service worker: offline cache
css/app.css
js/exercises.js         the movement dictionary + regions + stretches
js/workouts.js          intervals, block helpers, the named classics
js/generator.js         builds a workout to order
js/app.js               views, setup flows, rendering, timer
js/move/                3D mannequin, pose engine, viewer, workout cards
js/moves/               3D movement data and coaching, by family
vendor/three/           three.js, vendored (scripts/vendor-three.sh)
scripts/move-check.mjs  checks the 3D data and renders contact sheets
scripts/selfcheck.mjs   data + generator validation
scripts/e2e.mjs         drives the app in headless Chromium
scripts/export-sequence.mjs   expand a workout to timed steps as JSON
.github/workflows/      runs every check on each pull request
```

## Offline

`sw.js` caches the app shell and the 3D figures (three.js, the mannequin
and every movement's data, about 300 KB over the wire) when it installs,
on the first visit. Everything is served network-first with a four-second
timeout, so online you always get the current version and a flaky
connection falls back to the cache rather than hanging. Bump `VERSION` in
`sw.js` to force old caches out, though nothing depends on remembering to.

## 3D movements

The same 3D figure shows on the workout cards, in the coming-up
thumbnails and in the full viewer. Each movement is key poses on a rigged
1.75 m mannequin with adult proportions, written as anatomical joint
angles or as world-space hand and foot targets (two-bone IK keeps planted
feet and hands planted), played at a coached tempo with any equipment
riding in the hands. `js/moves/README.md` is the authoring guide.

`node scripts/move-check.mjs [names]` renders every key pose from the
front, side and three-quarters into a contact sheet and fails on a target
a limb can't reach or a body through the floor; CI runs it with `--quick`
and `--all-required`.

On the workout screen, `js/move/deck.js` draws every figure through one
shared WebGL renderer (browsers allow only a few contexts per page),
copying each into its card's own canvas. Figures draw only while on screen,
at 30 fps on the cards and 15 on thumbnails, and hold a still pose when the
device asks for reduced motion.

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
exercise's fields, that every movement has 3D data and a bodyweight
fallback, that no block hands one item to two people in any round of either
interval style, that duration labels match what the timer actually runs,
and that all 1240 generator input combinations either build a valid workout
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

Both run on every pull request through GitHub Actions, along with the 3D
movement check.

## Deploy

```sh
vercel deploy --prod
```

Production: `fit.flaux.com.au` (CNAME -> `cname.vercel-dns.com`)
