# FIT, the Flaux workout timer

A fast, opinionated interval + stretching timer for a home gym with a fixed
equipment set and one or two people training.

Static files, no build step. Deploys to Vercel.

## How it works

On a first visit FIT asks who's training (just you, or you and a mate) and
what gear you've got, with everything unticked, including the weights of
any kettlebells, dumbbells or barbell you tick (kettlebells ticked with no
bell picked asks for the bells before Done), and saves the answer as the
Home gear set. Someone whose first visit is a shared link gets the workout
straight away and the question on the way home. After that the home screen
has three cards:

- **Today** (Build a workout): how long you've got and how many of you,
  filled in from last time, where you're training once there's more than
  one place, a line with the style and goal, and Start. **Change** opens
  the full setup: what it's for, how many of you, your gear, how long
  you've got and the style. Target areas and anything you'd rather not do
  sit under **More options**, closed by default, with a line saying what's
  set ("Whole body · nothing left out") so a choice from last time can't
  catch you out. While Surf Fit is on and today's session is still to do,
  the card is that session instead, with "Something else today" to set it
  aside for the day (a reload the same day keeps that).
- **Programs**: a session a day that builds week by week (Surf Fit). The
  card says where you're up to ("Surf Fit · week 2 of 6").
- **Saved & ready-made**: your favourites and recent sessions, the 16 named
  classics, and the stretch routines (the Stretching filter shows just
  those). A classic runs in the style last picked in setup, and its card
  says which. At the bottom, **Your data**: back it up, or move it to
  another device or into the home-screen app.

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
card shows it above the name ("12 reps", "8 each side", "40s").

**Levels.** At the end of a session each person taps how it was: Too easy,
About right or Cooked (one tap each, and optional; the same answer again
takes it back). FIT keeps a level for each person by name (by spot, A or
B, for someone with no name), starting at 1: two Too easy in a row move it
up 0.1, one Cooked moves it down 0.1, and it stays between 0.7 and 1.3, so
one rough day can't undo weeks of work. The next workout built from the
Today card, Build a workout or a program day scales each person's rep
targets by their own level (`nextLevel`, `repScales` in `js/workouts.js`),
so with two of you each gets their own reps from the same moves, and the
card says why ("+1 rep: you said too easy"). Only rep targets move: the
moves, the clock and the timed styles stay as built, and an EMOM's timed
efforts still leave 15 seconds of the minute. The levels go on the
workout's request by name, so a favourite comes back with the same reps
for each person, Wayne keeps his own if he and Dave swap spots, and a new
mate gets the plain targets. The classics and stretch routines don't use
levels. After a session all on the clock (Short bursts, Long efforts) the
answer says the reps change "next time there are reps to do".

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
targets start at 80% and build over the six weeks to 110% (`repScale`),
and each person's own level goes on top. The two timed days build by
working longer and resting less (`workRest`, one split a week, every one
still a four-minute block): Paddle power's long efforts go 30s on and 30s
off in week 1, then 35/25, 40/20, 40/20 and 45/15 in weeks 5 and 6;
Pop-ups & legs' short bursts go 15/15, then 20/10 for three weeks, then
25/5. The day's card says this week's ("45s on, 15s off this week"), and
the split goes on the request, so a favourite or a link of the day runs
it again exactly. Each day builds through the generator
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
warm-up and cool-down included (one of each, at the start and the end). Short bursts and long efforts
keep their four-minute blocks; EMOM, AMRAP and For Time stretch or shrink in
whole minutes to take up the rest, any spare minute going to the EMOM, and
leftover seconds go on the cool-down. A 30-minute EMOM, short bursts and
AMRAP mix is a 4-minute warm-up, a 6-minute EMOM, two short-burst blocks,
a 6-minute AMRAP and a 3-minute cool-down, with a 75-second changeover
between styles that says what's coming and how it works. Setup shows that
breakdown as you pick. Times shorter than the mix fits in are dimmed, on
setup and the home card, and turning Mix on or adding a style moves the
time up to the shortest that fits, so a mix can't be refused for want of
time. All the
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
  10-minute workout in 10 minutes of walking. Blocks come in four-minute
  lumps, so the cool-down takes up any time they leave short, and when
  they run over (15 and 40 minutes) the bookends give it back, so every
  length runs to the minute: 20 minutes runs 20:00
- A guided warm-up of real moves, each with its figure, about 30 to 45
  seconds apiece ("Warm-up 2 of 5: Lateral lunges"): something easy to get
  the blood moving, the hips, the upper back turning, the shoulders, then a
  light go at the session's first move. A surf session warms up with
  shoulder prep, open-book rotations and a slow pop-up. Nothing jumps or
  runs, it keeps to the gear and leave-outs (No floor work keeps it
  standing), and two people do each move together. The cool-down is
  stretches for what was worked, standing first, both sides of a stretch
  back to back. Skip skips the whole warm-up or cool-down in one tap. Both
  are worked out from the session (WARM-UP AND COOL-DOWN in
  `js/workouts.js`), never from the generator's random numbers, so saved
  favourites and shared links rebuild the same main blocks as before; the
  self-check compares a sample of seeds against origin/main
- A line on the first-visit screen: check with your doctor if you have an
  injury or health condition, and stop if anything hurts
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
  progress as they save, so neither writes over the other; a tab still on
  an older version has its stale copy merged in rather than taken, and one
  on the last release (which hears the others but has no levels) has its
  lists taken, with this tab's levels kept and written back. On an
  iPhone or iPad the home-screen app keeps its own storage, separate from
  Safari's, and the Add to Home Screen hint says so and says how to bring
  your data across
- Favourites that never change. A favourite keeps the exercises it was
  built with (each block's moves and how they're handed out, which also
  says who does what with two people), and so does each built session in
  history and a session saved part-way, so an update to the library or
  the generator can't quietly swap them; the gear still adapts on the
  cards, as for a classic. A favourite saved before this is built from
  its seed the next time it's opened at the first place (Home, where
  favourites were saved) and keeps that from then on; opened at another
  place first, it adapts to the gear there, as it always did; one
  naming a move that has since left the library is built from its seed
  and says so. Share links are still the seed and the request
- Your data, at the bottom of Saved & ready-made. **Save a backup** saves
  a dated file of everything, levels included (`FIT backup 2026-10-20.json`;
  on an iPhone or iPad through the share sheet, so Save to Files or
  AirDrop). **Copy to
  another device** puts the same on the clipboard as text, or in a box to
  copy by hand when there's no clipboard. **Restore** takes the file or
  the pasted text, runs it through the same checks as the stored
  settings, says what it found ("12 sessions, 2 favourites, 2 places
  (Home, Mate's place) and Surf Fit week 3") against what's there now, and
  asks before replacing anything ("Nothing is saved here yet" on a new
  device). The file picker asks for the backup, so an iPhone opens Files
  rather than Photos. Once restored, the page goes to where it says so.
  What it replaced is kept, so **Put back
  what was here before** undoes it until the next restore. The first-visit
  question links straight to Restore, for the home-screen app (which
  starts empty) or a new iPad
- Wall-clock timer, wake lock (kept through a pause), audio cues that still
  play with an iPhone on silent (a setting, since it pauses other music;
  FIT gives the sound back when you leave the workout, and after time in
  the background the first tap brings the beeps back for sure, while a
  scroll leaves the sound that's playing alone),
  two-tap reset, and two taps on Menu once a workout is going. Tap the
  timer to pause or resume; Start, Skip and Reset stay on screen however
  long the cards get, in one row on a phone
- A finish screen with Done (home, or back to the program for a program
  day), Start over, and Save and Share. It says what was done: the
  minutes, the blocks and any skipped ("16 min done · 4 of 5 blocks, 1
  skipped", with the clock at the time it ran), each AMRAP and For Time
  score against last time ("Block 2 AMRAP: 5 rounds (last time 4)"), and
  on a program day where that leaves it ("Day 9 of 42 done. Next: Pop-ups
  & legs"). Then How was that? on each person's card (see Levels), kept
  with the session in history. Skipping to the end without ever pressing
  Start doesn't count as a session done, and the screen says so; skipped
  through inside a minute, it says the session ended early ("Ended early,
  day ticked off" on a program day, which still moves on) and doesn't
  ask how it was. A block counts as skipped when a round of it (or most
  of its time) is left out, not when the skip comes in its last rest or
  last few seconds; an AMRAP or For Time left out with no score says
  skipped, one as good as done keeps what was logged. Shuffle builds at each person's level today, whatever
  the favourite or link it came from was built at
- Never loses your place. A session under way is saved as it goes (every
  five seconds, and on a pause, a skip, a score and whenever the app goes
  out of view), under its own key rather than with the settings. After a
  reload, or a phone that closed the tab, the Today card offers "Resume
  Paddle power from 8:00, block 2" with Resume and Discard for twelve
  hours (on a program day, the day's own Start becomes a small "Start a
  fresh one instead"): Resume builds the same workout again, for the same
  people, and picks up at the start of the round, move or stretch it was
  in, which is the time the card gives, paused, and says so under the
  block's name ("Picked up at 9:30, the start of round 5 of block 2"),
  with its scores, lap picks and program day. It isn't offered when FIT opens on a shared link, and
  it's cleared by finishing, Reset, Start over and two taps on Menu. Back
  after more than 20 seconds away with the clock running, FIT stops where
  the clock has got to and asks "You were away 3:12. Go back to 8:20?":
  Go back puts it where you left, paused; I kept going carries on (Resume
  stays hidden until one is tapped). A shorter spell just carries on
- A phone on its side gets its own layout: the timer and its buttons on
  the left, the two people side by side on the right, all on one screen
- Share a workout as a link. The seed and the request that built it are
  packed into the URL, so it opens the exact same session on any phone or
  tablet, for the same number of people, with no account and no server
  involved. The message says the minutes, style and people, and Share stays
  on screen once the workout is going. A link passed on keeps the gear it
  was first built with, so the third person gets the same session too.
  It carries each named person's level, so on the other device Wayne's
  reps reach whoever is called Wayne there and nobody else, and someone
  else opening it gets the plain targets; the other device's own levels
  are never put on it, since it's the sender's session
- Opens at once, signal or not. After the first visit a service worker
  keeps a copy of the whole app and the 3D figures, and FIT runs from it,
  so it opens in a garage on one bar of signal as fast as it does with no
  wifi at all. A new release comes in the background and shows "New
  version ready, tap to update" (never over a workout)

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

## Offline and updates

`sw.js` fetches every file of a release into a cache of its own when it
installs (the app shell and the 3D figures: three.js, the mannequin and
every movement's data, about 300 KB over the wire), all or nothing, past
the browser's own cache. From then on every file is served from that
copy, so the app opens at once on any connection, and the files it runs
on always belong to one release: never a new `index.html` beside an old
`app.js`.

A release only reaches phones when `sw.js` changes. The browser checks it
as the app loads, and the app asks again when it comes back to the front
(at most every half hour, since the home-screen app can stay open for
days). A new one installs the new release into a new cache and waits;
the app shows "New version ready, tap to update" (hidden during a
workout), and the tap has the waiting worker take over, delete the old
cache and reload the page. A tab mid-workout when another tab taps
reloads once you leave the workout. Untapped, the new release takes over
the next time FIT is closed and opened.

So every release that changes a file the worker lists has to bump
`VERSION` in `sw.js` and set `FILES_HASH` to the fingerprint of those
files. `scripts/selfcheck.mjs` computes it and fails until they match,
printing the new value ("app files changed: bump VERSION in sw.js and
update the hash to …"), and fails where git can see `origin/main` with
the files changed under the same `VERSION`. The hash is part of the
cache's name, so even a forgotten bump can't install new files over the
copy that's running.

A page whose scripts fail while it loads (only possible without the
worker: the very first visit, or a phone still on the network-first
worker from before this) has the waiting release, or the first one still
installing, take over at once, since a broken page has nothing to lose,
and loads again from it. With nothing new waiting yet, it asks the
browser to look for one first, and with none at all it loads again once.
A genuine bug fails once and stays put rather than reloading forever.
Nothing is saved until the stored settings have been read, so a page
that broke on its way up can never write a new visitor's defaults over
everything kept. When `PERSISTED` gains a key, bump `PREFS_SCHEMA`, so a
save from a tab still on the last release (which leaves the key out) can
be told apart: its lists are taken (it hears the others' saves, so they're
current), and what it leaves out (now the levels: the storage listener in
`js/app.js` checks for them) is kept from this tab and written back.

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
interval style, that duration labels match what the timer actually runs
and that a session runs to the minutes picked, that the export script for
the Garmin work matches the timer in every style, and that all 1240 generator input combinations either build a valid workout
or refuse for a good reason. It also proves a workout rebuilds exactly from
its stored request and seed, and that a seed builds the same workout
whatever sort algorithm the browser uses. Safari and Chrome sort
differently, and a favourite saved on the iPad has to come back identical
on the phone. Every style comes back from a favourite's frozen copy
exactly as built, a checked-in golden favourite (one block from each block
helper) still runs the same rounds, and a frozen copy that's the wrong
shape or names a move that's gone is refused. Every rung of a program's
work/rest ladder runs its block in 240 seconds and reaches the build;
the level rules (two Too easy up, one Cooked down, 0.7 to 1.3) hold, and
the same seed with levels picks the same moves in every style with only
the rep targets different. It also checks that every
file the pages load is precached and that `FILES_HASH` in `sw.js` is
current (see Offline and updates).

`node scripts/e2e.mjs` serves the app itself and drives it in headless
Chromium at iPad size: every path from the welcome screen, saving and
replaying a favourite, the interval preference surviving a replay, history,
the timer recovering time after a suspension, exclusions, stretch, text
size, a share link opened in a fresh browser context, corrupt preferences,
picking a session back up after a reload and coming back after time away,
a phone-width layout and a phone on its side, favourites and history
keeping their moves through a library change, backing up, copying and
restoring your data on a second device (and putting it back), the finish
screen's summary and How was that? (two Too easy taps lifting one
person's EMOM reps above the other's, kept through a favourite, a swap of
spots and a link), Surf Fit's timed days building week by week, the app
opening with the network switched off and at once with a six-second
network, a new release waiting for its tap and never running beside the
old one, a page whose scripts fail handing over to the release
waiting, and the first open of a release through the last one's worker
on a slow page losing nothing.
It fails on any console error.

Both run on every pull request through GitHub Actions, along with the 3D
movement check.

## Deploy

```sh
vercel deploy --prod
```

Production: `fit.flaux.com.au` (CNAME -> `cname.vercel-dns.com`)
