# Garmin workout files

One `.fit` structured workout per workout in the app (18 files), generated
from `index.html` by `scripts/generate-fit.mjs`. On the watch each interval
shows the exercise name and the watch vibrates at every change - work, rest,
block rest, warm-up, cool-down. Timings match the app exactly: 5-minute
warm-up and cool-down, 8 rounds of 20s work / 10s rest per block, and each
workout's own block rests.

Exercise names use solo mode (one person wearing the watch) with all
equipment assumed present.

**How the name shows on the watch.** A Forerunner 255 does not read a step's
free-text name (it shows a generic "Go / Rest" for that). It reads the name
from a separate `exercise_title` (FIT mesg 264) record, matched to each step by
the `(exercise_category, exercise_name)` pair - confirmed by decoding genuine
Garmin and known-working sideloaded strength `.fit` files. So each movement is
mapped to a real Garmin catalog exercise (`EX_MAP` in the generator) and one
`exercise_title` is emitted per distinct exercise. Weight variants (15kg vs
10kg) share one exercise and are told apart by the `exercise_weight` field, so
the watch shows e.g. "Goblet Squat / 15 kg" then ".../ 10 kg". Tabata workouts
load as **Strength** (which also shows the muscle-group graphic); the two
stretch flows load as **Yoga** with each pose named verbatim.

Note: the per-exercise demo *animation* only exists for Garmin's own premade
workouts, not for sideloaded/custom ones - so expect the name, the weight, and
the category muscle-group graphic, but not a movement-specific animation loop.

## Getting them onto a Forerunner 255 Music (from a Mac)

The watch connects in MTP mode, which macOS cannot browse natively, so you
need a free MTP app such as [OpenMTP](https://openmtp.ganeshrvel.com/) (or
Android File Transfer).

1. Plug the watch into the Mac with its charging cable.
2. Open OpenMTP and wait for the watch to appear.
3. On the watch side, open the `GARMIN/NewFiles` folder (create it if it is
   not there). This is a staging inbox - do NOT drop the files straight into
   `GARMIN/Workouts`, the watch will not import them from there.
4. Copy the `.fit` files from this folder into `GARMIN/NewFiles`.
5. Safely eject the watch and unplug it. The watch imports the files on
   disconnect and files them into Workouts itself. If they do not show up,
   hold the power button and restart the watch.

## Running a workout on the watch

1. Press **Start**, choose **Strength** (or **Yoga** for the two stretch flows).
2. Hold **Up** to open the menu, then **Training > Workouts**.
3. Pick the workout and press **Start**. The watch walks you through every
   step, shows the exercise name + animation, and vibrates at each change.
   **Lap** skips ahead a step if needed.

## Regenerating

After the workouts array in `index.html` changes:

```
npm install            # once, to fetch Garmin's FIT SDK
node scripts/generate-fit.mjs
```

The generator reads the app's real `EXERCISES` dictionary, block helpers, and
`buildSequence` straight out of `index.html`, so the watch files always match
the app. Files are encoded with Garmin's official FIT SDK (`@garmin/fitsdk`),
and each gets a unique file id so the watch imports all 18 rather than
treating them as one duplicate.

Each exercise is mapped to a Garmin catalog entry in `EX_MAP` inside the
script. If you add a new exercise to `index.html` that isn't mapped, the
generator stops with an error naming it - add a line to `EX_MAP` (pick the
closest category + exercise from the FIT SDK) and re-run.

## Notes on watch limits

- Repeated rounds are collapsed into Garmin repeat steps to keep files small.
  The largest workout (Power Hour) is 85 steps; The Long Haul is 82. These are
  well within a modern Garmin's capacity, but they are the two to test first.
- Step names are capped at 39 characters; a few of the longest exercise names
  are truncated on screen but stay recognisable.
