# FIT by Flaux - Store Listing Kit

Paste-ready copy for App Store Connect and Play Console. Pricing model:
free, nothing to buy, no ads, no subscriptions, no account. Australian
spelling, no em dashes. Every claim below is something FIT does today;
check the copy again if a feature changes.

Live URLs the consoles will ask for (no `vercel.json`, so the pages keep
their `.html`; adding `cleanUrls` would also redirect `/index.html`,
which the website's service worker fetches, so don't):
- Marketing / website: https://fit.flaux.com.au/
- Privacy policy: https://fit.flaux.com.au/privacy.html
- Support: https://fit.flaux.com.au/support.html

Both pages are new on this branch. They go live when it's merged to
`main` and Vercel deploys, and both have to load before either store
gets the app (README, Release). The app links to both at the foot of
Your data, and to the privacy policy from the Apple Health question, as
Apple asks of every app (guideline 5.1.1). Nothing on the website links
to them yet, and they're not in the service worker's offline files, on
purpose.

## App Store Connect (iOS and iPadOS)

| Field | Value | Limit |
|---|---|---|
| Name | FIT by Flaux | 12/30 |
| Subtitle | Timed workouts for your gear | 28/30 |
| Bundle ID | `au.com.flaux.fit.app` | |
| SKU | `fit-by-flaux` | |
| Primary category | Health & Fitness | |
| Secondary category | Sports (optional) | |
| Price | Free, no in-app purchases | |
| Age rating | 9+ (see below) | |
| Copyright | 2026 Wayne Cavanagh / Flaux | |

Keywords (94/100 characters, no spaces after commas; the name's words
are indexed already, so FIT and Flaux aren't repeated):

```
workout,timer,interval,hiit,tabata,emom,amrap,kettlebell,home gym,stretch,surf,partner,circuit
```

Promotional text (159/170):

```
A workout built for the time and gear you have, for one person or two side by side. Voice coach, 3D moves and Apple Health. No account, no ads, nothing to buy.
```

Description (mentions Apple Health by name, as guideline 2.5.1 asks of
an app that uses HealthKit):

```
FIT builds a timed workout for the time and gear you've got, then runs the clock, calls out what's next and shows each move. For one person, or two training side by side.

Tell it how long you've got and what's in the garage, from just bodyweight to kettlebells, dumbbells, a barbell, rings and a box. FIT picks the moves, the reps and the style, and swaps anything that needs gear you haven't got for a move that doesn't.

WHAT'S IN IT
- A fresh workout each day for your time (10 to 60 minutes) and your gear
- Short bursts, long efforts, EMOM, AMRAP, For Time, or a mix, with a proper warm-up and cool-down
- Training with a mate: a card each, side by side, with your own reps and level
- A voice coach that says what's next, a beep for every change, and on iPhone a tap you can feel
- Moving 3D figures for the moves: tap one to turn it, slow it down and read how to do it
- Swap any move for one like it, before you start or during a rest
- Surf Fit: six weeks back to paddle fitness, with paddling, pop-ups and legs, and easy days built in
- Stretch routines, named classics like Power Hour, your favourites, and every session you've done

APPLE HEALTH
On iPhone and iPad, FIT can save each workout you finish to Apple Health: the kind of workout, when, and how long. It asks first, it only ever writes workouts, and it never reads your Health data.

YOURS, ON YOUR DEVICE
No account, no ads, no subscriptions, nothing to buy. FIT works offline, keeps the screen awake while you train, and keeps everything on your device. Share a workout as a link and it opens the same on any phone, no app needed.

Check with your doctor before starting if you have an injury or health condition, and stop if anything hurts.
```

What's New for 1.0.0: leave empty (a first version has none).

### Age rating

Answer every question None or No, except one:

- **Health or Wellness Topics: Yes.** Apple's definition includes
  "exercise recommendations", which is what FIT builds. Apple rates that
  9+, so FIT is 9+.
- Medical or Treatment Information: None. FIT's line about checking with
  your doctor, and its injury alternatives (another move for a sore
  knee, say), give no diagnosis and manage no condition.
- Unrestricted web access: No (the app never opens a web page).
- User-generated content, messaging, advertising, gambling, contests,
  loot boxes: No. Parental controls and age assurance: No.

`node app/scripts/asc-price-age.mjs --issuer <uuid> --apply` sets these
answers and the Free price in one go (it prints what's there first
without `--apply`).

### App Privacy (the nutrition label)

**Data Not Collected.** Checked against the code on 2 November 2026:
- FIT stores everything in the WebView's own storage on the device. There
  is no account and no FIT server.
- No network calls in `js/` (no fetch, XMLHttpRequest or beacon), no
  analytics or Vercel Analytics script, no fonts or scripts from a CDN
  (system fonts; three.js is in `vendor/`), and the 3D viewer
  (`move.html`, `js/move/`, `js/moves/`) loads only files in the app.
- The app has no service worker and fetches nothing: every file is in
  the bundle.
- Apple Health: writing a workout into HealthKit on the device is not
  "collection" (nothing reaches the developer). Nothing is read.
- A shared link's workout is in the link's # part, sent only by the
  person sharing it, to whoever they choose.

If anything is ever added that sends data off the device (analytics, a
crash reporter, an account, sync), this answer has to change first.

### App Review information

Sign-in required: No. Contact: Wayne Cavanagh, hello@flaux.ai.

Review notes:

```
FIT is a workout timer. There is no account or sign-in, and nothing to buy.

To try it: answer the two first-visit questions (who's training, and what gear), then tap Start on the home screen's Today card, and Start again on the workout. Every file FIT uses is inside the app, so it works in airplane mode from the first launch; the app makes no network requests.

Workouts are generated on the device from FIT's own library for the time and gear chosen. A voice coach (the device's built-in speech) says what's next, the iPhone gives a haptic tap at each change (firm as work starts, lighter for the rest, and a tick on each of the last three seconds), and the screen stays awake during a workout.

Privacy policy in the app: at the foot of Saved & ready-made, under Your data, and on the Apple Health question.

Apple Health: after the first workout you finish, FIT asks whether to save workouts to Apple Health. "Save to Apple Health" shows Apple's permission sheet, which asks for write access to Workouts only; FIT reads nothing. Each finished workout is then saved as one HKWorkout (its type, start and end; no calories or heart rate). It can be turned off any time under the workout ("Save to Apple Health"). To reach a finish quickly, tap "Skip block" until the end (a session skipped inside its first minute isn't saved, so let it run a minute first).
```

### Screenshots

Take them on the Simulator (see the README), at these sizes:
- 6.9-inch iPhone, 1320 x 2868: display type `APP_IPHONE_67`
- 13-inch iPad, 2064 x 2752: display type `APP_IPAD_PRO_3GEN_129`
- If App Store Connect asks for the iPhone Duo's own size once it lists
  one, take that set opened flat in the Duo simulator.

Suggested five, the same on each: home with today's workout; a workout
running with the big clock; two people side by side; the finish screen
with the Apple Health question; a 3D move. Upload with
`node app/scripts/asc-upload-screenshots.mjs --issuer <uuid> --set APP_IPHONE_67:a.png,b.png --set APP_IPAD_PRO_3GEN_129:...`.

## Play Console (Android)

| Field | Value | Limit |
|---|---|---|
| App name | FIT by Flaux | 12/30 |
| Package | `au.com.flaux.fit.app` | |
| Short description | Timed workouts for the time and gear you have, for one or two. No account. | 74/80 |
| Category | Health & Fitness | |
| Price | Free, no in-app products | |
| Ads | No | |
| Content rating (IARC) | All answers No: Everyone / PEGI 3 | |
| Target audience | 18 and over (keeps FIT out of the Families programme; nothing is for children) | |

Full description: the App Store one without what Android doesn't have
yet. No APPLE HEALTH paragraph (no Health Connect until v1.1), and no
voice coach: Android's web view has no speech, so FIT hides the voice
coach there. Put it back once Android has a text-to-speech plugin
(README, Later).

```
FIT builds a timed workout for the time and gear you've got, then runs the clock, shows what's next and how to do each move. For one person, or two training side by side.

Tell it how long you've got and what's in the garage, from just bodyweight to kettlebells, dumbbells, a barbell, rings and a box. FIT picks the moves, the reps and the style, and swaps anything that needs gear you haven't got for a move that doesn't.

WHAT'S IN IT
- A fresh workout each day for your time (10 to 60 minutes) and your gear
- Short bursts, long efforts, EMOM, AMRAP, For Time, or a mix, with a proper warm-up and cool-down
- Training with a mate: a card each, side by side, with your own reps and level
- A beep for every change, and on a phone a buzz you can feel
- Moving 3D figures for the moves: tap one to turn it, slow it down and read how to do it
- Swap any move for one like it, before you start or during a rest
- Surf Fit: six weeks back to paddle fitness, with paddling, pop-ups and legs, and easy days built in
- Stretch routines, named classics like Power Hour, your favourites, and every session you've done

YOURS, ON YOUR DEVICE
No account, no ads, no subscriptions, nothing to buy. FIT works offline, keeps the screen awake while you train, and keeps everything on your device. Share a workout as a link and it opens the same on any phone, no app needed.

Check with your doctor before starting if you have an injury or health condition, and stop if anything hurts.
```

Data safety form:
- Does the app collect or share any of the required user data types? **No.**
- That makes the rest of the form not apply: no data collected, none
  shared, nothing sent off the device to encrypt in transit, and no
  account to delete.

Health apps declaration (App content > Health apps): declare
**Activity and fitness** only. No Health Connect permissions in v1.
When Health Connect arrives (planned for v1.1), Play needs the Health
Connect permissions declaration for writing exercise sessions, with a
reason for each data type and a privacy policy that names Health
Connect: update `privacy.html` and this kit first.

Assets still to make (paths are what `app/scripts/play-publish.mjs upload-graphics` reads):
- `app/store-assets/play-icon-512.png`: 512 x 512, full square, no
  transparency (scale `app/assets/icon-only.png` down).
- `app/store-assets/feature-graphic-1024x500.png`.
- `app/store-assets/shots/phone-1-home.png` ... `phone-5-move.png` and
  `ipad13-1-home.png` ... `ipad13-5-move.png` (the same five as iOS; the
  iPad set fills both tablet slots).

## Order of operations (matches app/README.md)

1. Register the app in both consoles (bundle ID / package above).
2. Build on the Mac, run it on the iPad, an iPhone and the Duo
   simulator, and on an Android phone.
3. TestFlight and Play internal testing; check Apple Health on a real
   iPhone (a finished workout appears in Health > Browse > Activity >
   Workouts).
4. Before submitting (README, Release): layout A is the website's
   default, the branch is merged to `main` and both pages above load on
   the live site, and Mac and Vision Pro availability decided (unticked
   unless FIT has been tried there).
5. Paste this kit into both listings, upload the shots, submit.
