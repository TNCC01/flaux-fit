# Garmin workout files

One `.fit` structured workout per workout in the app (18 files), generated
from `index.html` by `scripts/generate-fit.mjs`. On the watch each interval
shows the exercise name and the watch vibrates at every change - work, rest,
block rest, warm-up, cool-down. Timings match the app exactly: 5-minute
warm-up and cool-down, 8 rounds of 20s work / 10s rest per block, and each
workout's own block rests.

Exercise names use solo mode (one person wearing the watch) with all
equipment assumed present. Tabata workouts load as Cardio, the two stretch
flows as Yoga.

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

1. Press **Start**, choose **Cardio** (or **Yoga** for the two stretch flows).
2. Hold **Up** to open the menu, then **Training > Workouts**.
3. Pick the workout and press **Start**. The watch walks you through every
   step and vibrates at each change. **Lap** skips ahead a step if needed.

## Regenerating

After the workouts array in `index.html` changes:

```
node scripts/generate-fit.mjs
```

No dependencies, just Node. The generator reads the app's real `EXERCISES`
dictionary, block helpers, and `buildSequence` straight out of `index.html`,
so the watch files always match the app.

## Notes on watch limits

- Repeated rounds are collapsed into Garmin repeat steps to keep files small.
  The largest workout (Power Hour) is 85 steps; The Long Haul is 82. These are
  well within a modern Garmin's capacity, but they are the two to test first.
- Step names are capped at 39 characters; a few of the longest exercise names
  are truncated on screen but stay recognisable.
