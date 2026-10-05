/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, small home equipment: the pull-up bar, resistance bands
  and the medicine ball. See js/moves/README.md.
*/
import { TWIST_MUSCLES, twistKeys } from './abs.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// up on the toes: the ankle target for a foot whose flat ankle sits at
// `flat`, heel raised `deg` degrees about the toe tip (see legs.js)
function onToes(flat, deg) {
  const a = ((20.22 + deg) * Math.PI) / 180, L = 0.2025;
  return [flat[0], r3(L * Math.sin(a)), r3(flat[2] + 0.19 - L * Math.cos(a))];
}

// ---------------------------------------------------------- pull-up bar
// The bar is at 2.45 m, high enough that the feet hang well clear of the
// floor at full arm length. Wrist targets are fitted so the middle of the palm
// sits on the bar in every pose (the hand wraps it), so nothing slides.
const BAR = [{ type: 'pullupBar', y: 2.45, z: 0, width: 1.1 }];
const onBar = (hand, extra = {}) => ({ L: { hand, ...extra }, R: 'mirror' });
// legs together and quiet, knees softly bent, a touch in front of the body
const HANG_LEGS = { L: { hip: { flex: 12, abd: -1 }, knee: 22, ankle: -20 }, R: 'mirror' };
// hanging from an overhand grip a little wider than the shoulders
const HANG = { pelvis: { pos: [0, 1.39, 0.02], pitch: -2 }, legs: HANG_LEGS,
  arms: onBar([0.325, 2.38, -0.004], { elbow: 'out', turn: 0, shrug: 0.02 }) };

// ---------------------------------------------------------- bands
const BAND_FEET = { L: { foot: [0.12, 0.07, 0], toeOut: 6 }, R: 'mirror' };
// standing on the middle of the band, an end in each hand
const UNDERFOOT = [
  { type: 'band', from: 'footL', to: 'handL', handles: true, rest: 1.0 },
  { type: 'band', from: 'footR', to: 'handR', handles: true, rest: 1.0 },
];
// band pull-apart: arms out in front at shoulder height, palms down
const pullArms = (plane) => ({ L: { shoulder: { elev: 88, plane }, elbow: 4, turn: -90 }, R: 'mirror' });
// lateral walk: quarter squat, feet stepping along the X axis
const QS = (x) => ({ pos: [x, 0.8, -0.08], pitch: 22 });
const plant = (x, s) => ({ foot: [x, 0.07, 0.01], toeOut: 10, knee: [0.3 * s, 0, 1] });
const step = (x, s) => ({ foot: [x, 0.13, 0.0], knee: [0.3 * s, 0, 1], ankle: 5 });
const WALK_ARMS = { L: { shoulder: { elev: 25, plane: 20 }, elbow: 95 }, R: 'mirror' };
// glute bridge with a mini band
const BRIDGE_FEET = (knee) => ({ L: { foot: [0.16, 0.07, 0.5], toeOut: 10, knee }, R: 'mirror' });
const FLOOR_ARMS = { L: { hand: [0.27, 0.04, 0.1], elbow: 'up' }, R: 'mirror' };

// ---------------------------------------------------------- medicine ball
const BALL = [{ type: 'ball', hand: 'both', r: 0.12 }];
// a pose mirrored left to right: sides swapped, X flipped, turns reversed
const flipX = (v) => (Array.isArray(v) ? [-v[0], ...v.slice(1)] : v);
function mirrorPose(k) {
  const o = { ...k };
  if (k.pelvis) o.pelvis = { ...k.pelvis, pos: flipX(k.pelvis.pos), yaw: -(k.pelvis.yaw || 0), roll: -(k.pelvis.roll || 0) };
  for (const t of ['spine', 'neck']) if (k[t]) o[t] = { ...k[t], twist: -(k[t].twist || 0), side: -(k[t].side || 0) };
  if (k.ball) o.ball = flipX(k.ball);
  const limb = (l) => ({ ...l, foot: flipX(l.foot), hand: flipX(l.hand), knee: flipX(l.knee), elbow: flipX(l.elbow) });
  for (const g of ['legs', 'arms']) if (k[g]) o[g] = { L: limb(k[g].R), R: limb(k[g].L) };
  return o;
}
// russian twist keys with the hands on the sides of the ball; at each side
// the ball sits a little further back so the far arm still reaches
function ballTwist() {
  const keys = twistKeys(0.12);
  for (const n of ['left', 'right']) for (const s of ['L', 'R']) {
    const a = keys[n].arms[s];
    keys[n].arms[s] = { ...a, hand: [a.hand[0], a.hand[1], r3(a.hand[2] - 0.04)] };
  }
  return keys;
}
const mirrorKeys = (keys) => Object.fromEntries(Object.entries(keys).map(([n, k]) => [n, mirrorPose(k)]));

export default {
  // ====================================================== pull-up bar
  barPullUp: {
    camera: { yaw: 40, pitch: 10 },
    props: BAR,
    muscles: { primary: ['lats', 'upperBack'], secondary: ['biceps', 'forearms', 'core'] },
    coaching: {
      setup: [
        'Grip the bar with palms facing away, hands a little wider than the shoulders.',
        'Hang with long arms and the legs together, feet off the floor.',
        'Squeeze the glutes and keep a light hollow through the trunk so you do not swing.',
      ],
      steps: [
        'Pull the shoulder blades down and back to start the pull.',
        'Drive the elbows down towards the ribs and lift the chest towards the bar.',
        'Keep pulling until the chin is clearly over the bar.',
        'Lower slowly all the way to long arms before the next rep.',
      ],
      cues: ['Elbows to the back pockets', 'Chest to the bar', 'Long arms at the bottom'],
      mistakes: [
        'Kicking the legs or swinging to get up, which takes the work off the back.',
        'Half reps that stop short of straight arms.',
        'Reaching the chin up and forward instead of pulling the chest up.',
        'Shrugging the shoulders to the ears at the top.',
      ],
      breathing: 'Breathe out as you pull up, breathe in as you lower.',
      tempo: 'About 1 second up, a short pause with the chin over, 2 to 3 seconds down.',
    },
    keys: {
      hang: { label: 'Long arms', ...HANG },
      half: { label: 'Halfway', pelvis: { pos: [0, 1.65, 0.0], pitch: -6 }, legs: HANG_LEGS,
        arms: onBar([0.347, 2.388, 0.02], { elbow: [0.5, -1, 0.4], turn: -20 }) },
      top: { label: 'Chin over', pelvis: { pos: [0, 1.94, -0.01], pitch: -10 }, neck: { flex: -18 }, legs: HANG_LEGS,
        arms: onBar([0.316, 2.38, -0.006], { elbow: [0.5, -1, 0.5], turn: -50 }) },
    },
    flow: ['half'],
    seq: ['hang', 'half', 'top', 'half'], tempo: [0.6, 0.5, 1.2, 1.3], holds: { hang: 0.45, half: 0, top: 0.35 },
  },
  barChinUp: {
    camera: { yaw: 50, pitch: 10 },
    props: BAR,
    muscles: { primary: ['lats', 'biceps'], secondary: ['upperBack', 'forearms', 'core'] },
    coaching: {
      setup: [
        'Grip the bar with palms facing you, hands about shoulder-width apart.',
        'Hang with long arms and the legs together, feet off the floor.',
        'Ribs down and glutes on, so the body stays still.',
      ],
      steps: [
        'Pull the shoulder blades down to start.',
        'Drive the elbows down and in front of the ribs as you pull the chest up.',
        'Finish with the chin over the bar and the chest close to it.',
        'Lower slowly to long arms.',
      ],
      cues: ['Chest to the bar', 'Elbows down', 'Control the way down'],
      mistakes: [
        'Swinging or kicking to get the chin over.',
        'Stopping short of straight arms at the bottom.',
        'Craning the neck to get the chin over instead of pulling higher.',
        'Dropping fast instead of lowering.',
      ],
      breathing: 'Breathe out as you pull up, breathe in as you lower.',
      tempo: 'About 1 second up, a short pause at the top, 2 to 3 seconds down.',
    },
    keys: {
      hang: { label: 'Long arms', pelvis: { pos: [0, 1.37, 0.02], pitch: -2 }, legs: HANG_LEGS,
        arms: onBar([0.2, 2.38, 0], { elbow: [0.3, -0.3, 1], turn: 106, shrug: 0.02 }) },
      half: { label: 'Halfway', pelvis: { pos: [0, 1.65, 0.0], pitch: -6 }, legs: HANG_LEGS,
        arms: onBar([0.2, 2.38, 0], { elbow: [0.15, -1, 0.8], turn: 104, wrist: -40 }) },
      top: { label: 'Chin over', pelvis: { pos: [0, 1.94, -0.02], pitch: -12 }, neck: { flex: -16 }, legs: HANG_LEGS,
        arms: onBar([0.2, 2.38, 0], { elbow: [0.15, -1, 0.7], turn: 94 }) },
    },
    flow: ['half'],
    seq: ['hang', 'half', 'top', 'half'], tempo: [0.6, 0.5, 1.2, 1.3], holds: { hang: 0.45, half: 0, top: 0.35 },
  },
  hangingKneeRaise: {
    camera: { yaw: 70, pitch: 10 },
    props: BAR,
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['obliques', 'forearms', 'lats'] },
    coaching: {
      setup: [
        'Hang from the bar with an overhand grip, hands about shoulder-width or a little wider.',
        'Arms long, shoulders pulled gently down away from the ears.',
        'Legs together and still before you start.',
      ],
      steps: [
        'Brace the abs and bring the knees up towards the chest.',
        'Curl the pelvis up at the top so the tailbone lifts, not just the thighs.',
        'Pause for a moment with the knees at hip height or higher.',
        'Lower the legs slowly back to straight without swinging.',
      ],
      cues: ['Knees to the chest', 'Curl the tailbone up', 'No swinging'],
      mistakes: [
        'Swinging the legs up with momentum and then swinging back.',
        'Lifting only the thighs so the hip flexors do all the work.',
        'Letting the shoulders shrug up to the ears.',
        'Dropping the legs fast, which sets off a swing for the next rep.',
      ],
      breathing: 'Breathe out as the knees come up, breathe in as they lower.',
      tempo: 'About 1 second up, a short pause, 2 seconds down.',
    },
    keys: {
      hang: { label: 'Long hang', ...HANG },
      top: { label: 'Knees up', pelvis: { pos: [0, 1.41, 0.05], pitch: -14 }, spine: { flex: 8 }, neck: { flex: -6 },
        legs: { L: { hip: { flex: 105, abd: 2 }, knee: 100, ankle: -20 }, R: 'mirror' },
        arms: onBar([0.325, 2.38, -0.004], { elbow: 'out', turn: 0, shrug: 0.01 }) },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.8], holds: { hang: 0.4, top: 0.4 },
  },
  barDeadHang: {
    camera: { yaw: 40, pitch: 10 },
    props: BAR,
    muscles: { primary: ['forearms', 'lats'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Stand under the bar and grip it overhand, hands about shoulder-width or a little wider.',
        'Use a box or step if you need it to reach.',
        'Lift the feet so you hang with the arms long.',
      ],
      steps: [
        'Let the body hang long, then draw the shoulders gently down away from the ears.',
        'Keep the legs together and the trunk quiet.',
        'Breathe slowly and stay still for the set time.',
        'Put the feet back down before you let go.',
      ],
      cues: ['Long arms', 'Shoulders away from the ears', 'Grip hard, stay still'],
      mistakes: [
        'Sinking fully into the shoulders with no control.',
        'Swinging or kicking the legs.',
        'Bending the elbows to make it easier.',
        'Dropping off the bar instead of stepping down.',
      ],
      breathing: 'Slow, steady breaths through the hold.',
      tempo: 'Hold for the set time, around 20 to 40 seconds.',
    },
    keys: {
      a: { label: 'Hang', pelvis: { pos: [0, 1.37, 0.02], pitch: -2 }, legs: HANG_LEGS,
        arms: onBar([0.325, 2.38, -0.004], { elbow: 'out', turn: 0, shrug: 0.04 }) },
      b: { label: 'Shoulders set', pelvis: { pos: [0, 1.395, 0.02], pitch: -2 }, spine: { flex: -1.5 },
        legs: { L: { hip: { flex: 13, abd: -1 }, knee: 23, ankle: -20 }, R: 'mirror' },
        arms: onBar([0.325, 2.38, -0.004], { elbow: 'out', turn: 0, shrug: 0.015 }) },
    },
    seq: ['a', 'b'], tempo: [1.8, 2.2], holds: { a: 0.4, b: 0.5 },
  },

  // ====================================================== bands
  bandPullApart: {
    camera: { yaw: 30, pitch: 14 },
    props: [{ type: 'band', from: 'handL', to: 'handR', rest: 0.45 }],
    muscles: { primary: ['upperBack', 'shoulders'], secondary: ['traps'] },
    coaching: {
      setup: [
        'Stand tall with feet hip-width apart, knees soft.',
        'Hold the band with both hands, palms down, about shoulder-width apart.',
        'Lift the arms straight out in front to shoulder height with a little tension on the band.',
      ],
      steps: [
        'Keep the arms long and pull the hands apart and out to the sides.',
        'Squeeze the shoulder blades together as the band comes to the chest.',
        'Pause for a moment with the band touching the chest.',
        'Let the hands come back together slowly, keeping some tension.',
      ],
      cues: ['Long arms', 'Squeeze the shoulder blades', 'Band to the chest'],
      mistakes: [
        'Bending the elbows so the arms do the work instead of the upper back.',
        'Shrugging the shoulders up towards the ears.',
        'Arching the lower back and pushing the ribs out to finish.',
        'Letting the band snap back instead of controlling it.',
      ],
      breathing: 'Breathe out as you pull apart, breathe in as the hands come back.',
      tempo: 'About 1 second out, a short squeeze, 2 seconds back.',
    },
    keys: {
      front: { label: 'Arms forward', legs: BAND_FEET, arms: pullArms(4) },
      open: { label: 'Band to chest', legs: BAND_FEET, spine: { flex: -2 }, arms: pullArms(74) },
    },
    seq: ['front', 'open'], tempo: [1.0, 1.8], holds: { open: 0.4, front: 0.3 },
  },
  bandRow: {
    camera: { yaw: 70, pitch: 8 },
    props: [
      { type: 'band', from: [0, 1.2, 0.9], to: 'handL', handles: true, rest: 0.5 },
      { type: 'band', from: [0, 1.2, 0.9], to: 'handR', handles: true, rest: 0.5 },
    ],
    muscles: { primary: ['upperBack', 'lats'], secondary: ['biceps', 'shoulders', 'core'] },
    coaching: {
      setup: [
        'Anchor the band in a door at chest height and hold a handle or end in each hand.',
        'Step back until the band is taut with the arms straight out in front.',
        'Stand tall with feet hip-width apart and knees soft.',
      ],
      steps: [
        'Pull the shoulder blades back to start the row.',
        'Drive the elbows back close to the sides until the hands reach the lower ribs.',
        'Squeeze the shoulder blades together for a moment.',
        'Let the arms straighten slowly back to the start.',
      ],
      cues: ['Elbows back', 'Squeeze the shoulder blades', 'Stand tall'],
      mistakes: [
        'Leaning back to finish the pull instead of using the back.',
        'Shrugging the shoulders towards the ears.',
        'Flaring the elbows out wide.',
        'Letting the band pull the arms forward fast.',
      ],
      breathing: 'Breathe out as you row, breathe in as the arms go forward.',
      tempo: 'About 1 second in, a short squeeze, 2 seconds out.',
    },
    keys: {
      reach: { label: 'Arms long', pelvis: { pos: [0, 0.92, 0] }, legs: BAND_FEET,
        arms: { L: { hand: [0.15, 1.2, 0.48], elbow: 'out' }, R: 'mirror' } },
      row: { label: 'Squeeze', pelvis: { pos: [0, 0.92, 0] }, spine: { flex: -2 }, legs: BAND_FEET,
        arms: { L: { hand: [0.21, 1.08, 0.06], elbow: 'back' }, R: 'mirror' } },
    },
    seq: ['reach', 'row'], tempo: [1.0, 1.8], holds: { row: 0.4, reach: 0.3 },
  },
  bandOverheadPress: {
    camera: { yaw: 35, pitch: 6 },
    props: UNDERFOOT,
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core'] },
    coaching: {
      setup: [
        'Stand on the middle of the band with feet hip-width apart.',
        'Bring the ends up to the shoulders, palms facing forward, elbows under the wrists.',
        'Squeeze the glutes and pull the ribs down.',
      ],
      steps: [
        'Brace and press the hands straight up.',
        'Finish with the arms straight and the hands over the shoulders, biceps by the ears.',
        'Lower slowly back to the shoulders against the pull of the band.',
      ],
      cues: ['Ribs down', 'Press straight up', 'Slow on the way down'],
      mistakes: [
        'Arching the lower back to get the hands overhead.',
        'Pressing forward instead of up.',
        'Letting the band yank the hands back down.',
        'Standing on the band too close to one end so the sides pull unevenly.',
      ],
      breathing: 'Breathe out as you press, breathe in as you lower.',
      tempo: 'About 1 second up, 2 seconds down.',
    },
    keys: {
      rack: { label: 'Shoulders', legs: BAND_FEET,
        arms: { L: { hand: [0.3, 1.42, 0.08], elbow: [0.6, -1, 0.5], turn: -45 }, R: 'mirror' } },
      mid: { label: 'Press', pass: true, legs: BAND_FEET,
        arms: { L: { hand: [0.3, 1.66, 0.05], elbow: [0.6, -1, 0.3], turn: -45 }, R: 'mirror' } },
      top: { label: 'Lockout', legs: BAND_FEET, spine: { flex: -1 },
        arms: { L: { hand: [0.22, 1.92, 0.0], elbow: 'out', turn: -45 }, R: 'mirror' } },
    },
    seq: ['rack', 'mid', 'top', 'mid'], tempo: [0.5, 0.5, 0.9, 1.0], holds: { rack: 0.35, top: 0.4, mid: 0 },
  },
  bandCurl: {
    camera: { yaw: 40, pitch: 6 },
    props: UNDERFOOT,
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    coaching: {
      setup: [
        'Stand on the middle of the band with feet hip-width apart.',
        'Hold an end in each hand, arms long by your sides, palms facing forward.',
        'Upper arms close to the ribs, shoulders relaxed down.',
      ],
      steps: [
        'Keep the elbows still and curl the hands up towards the shoulders.',
        'Squeeze the biceps for a moment at the top.',
        'Lower slowly against the band until the arms are straight.',
      ],
      cues: ['Elbows pinned', 'Slow on the way down', 'Stand still'],
      mistakes: [
        'Swinging the body or leaning back to get the hands up.',
        'Elbows drifting forward so the shoulders take over.',
        'Stopping short of straight arms at the bottom.',
        'Letting the band snap the hands back down.',
      ],
      breathing: 'Breathe out as you curl up, breathe in as you lower.',
      tempo: 'About 1 second up, a short squeeze, 2 seconds down.',
    },
    keys: {
      down: { label: 'Arms long', legs: BAND_FEET,
        arms: { L: { shoulder: { elev: 6, plane: 20 }, elbow: 8, turn: 90 }, R: 'mirror' } },
      up: { label: 'Squeeze', legs: BAND_FEET,
        arms: { L: { shoulder: { elev: 12, plane: 15 }, elbow: 138, turn: 90 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 2.0], holds: { up: 0.35, down: 0.3 },
  },
  bandLateralWalk: {
    camera: { yaw: 20, pitch: 10 },
    props: [{ type: 'band', loop: 'knees' }],
    muscles: { primary: ['glutes'], secondary: ['quads', 'adductors', 'core'] },
    coaching: {
      setup: [
        'Put a mini band around both legs just above the knees.',
        'Feet hip-width apart, then sit into a quarter squat with the chest up.',
        'Push the knees out against the band so it stays taut.',
      ],
      steps: [
        'Step one foot out to the side, keeping the toes pointing forward.',
        'Bring the other foot in, but not all the way: keep tension on the band.',
        'Take a few steps one way, then step back the other way.',
        'Stay low at the same height the whole time.',
      ],
      cues: ['Knees out', 'Stay low', 'Toes forward'],
      mistakes: [
        'Letting the knees cave in towards each other.',
        'Standing up between steps so the hips bob up and down.',
        'Bringing the feet right together so the band goes slack.',
        'Leaning the trunk side to side instead of stepping with the legs.',
      ],
      breathing: 'Breathe steadily, a breath every step or two.',
      tempo: 'Small, controlled steps, about 1 second each.',
    },
    keys: {
      a: { label: 'Quarter squat', pelvis: QS(0), spine: { flex: 4 }, arms: WALK_ARMS,
        legs: { L: plant(0.17, 1), R: plant(-0.17, -1) } },
      lMid: { label: 'Step out', pass: true, pelvis: QS(0.06), spine: { flex: 4 }, arms: WALK_ARMS,
        legs: { L: step(0.31, 1), R: plant(-0.17, -1) } },
      wide: { label: 'Wide', pelvis: QS(0.14), spine: { flex: 4 }, arms: WALK_ARMS,
        legs: { L: plant(0.45, 1), R: plant(-0.17, -1) } },
      rMid: { label: 'Follow', pass: true, pelvis: QS(0.22), spine: { flex: 4 }, arms: WALK_ARMS,
        legs: { L: plant(0.45, 1), R: step(-0.03, -1) } },
      b: { label: 'Feet set', pelvis: QS(0.28), spine: { flex: 4 }, arms: WALK_ARMS,
        legs: { L: plant(0.45, 1), R: plant(0.11, -1) } },
    },
    seq: ['a', 'lMid', 'wide', 'rMid', 'b', 'rMid', 'wide', 'lMid'],
    tempo: 0.4, holds: { a: 0.15, wide: 0.15, b: 0.15, lMid: 0, rMid: 0 },
  },
  bandGluteBridge: {
    camera: { yaw: 50, pitch: 16 },
    props: [{ type: 'band', loop: 'knees' }],
    muscles: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
    coaching: {
      setup: [
        'Put a mini band around both legs just above the knees.',
        'Lie on your back, knees bent, feet flat and a little wider than hip-width.',
        'Arms long by your sides, palms down.',
      ],
      steps: [
        'Push the knees out against the band so it is taut.',
        'Push through the heels and lift the hips until shoulders, hips and knees make one line.',
        'At the top press the knees out a little further and squeeze the glutes.',
        'Lower slowly, keeping the knees out.',
      ],
      cues: ['Knees out', 'Push through the heels', 'Squeeze at the top'],
      mistakes: [
        'Letting the band pull the knees in.',
        'Arching the lower back to get the hips higher.',
        'Feet too far away so the hamstrings take over.',
        'Dropping the hips instead of lowering.',
      ],
      breathing: 'Breathe out as you lift, breathe in as you lower.',
      tempo: '1 second up, 1 to 2 seconds squeeze, 2 seconds down.',
    },
    keys: {
      down: { label: 'Hips down', pelvis: { pos: [0, 0.117, 0], pitch: -87 },
        legs: BRIDGE_FEET([0.12, 1, 0]), arms: FLOOR_ARMS },
      up: { label: 'Knees out', pelvis: { pos: [0, 0.28, -0.06], pitch: -115 }, neck: { flex: 42 },
        legs: BRIDGE_FEET([0.28, 1, 0.1]), arms: FLOOR_ARMS },
    },
    seq: ['down', 'up'], tempo: [1.0, 1.6], holds: { up: 1.0, down: 0.3 },
  },

  // ====================================================== medicine ball
  ballSlam: {
    camera: { yaw: 60, pitch: 6 },
    props: BALL,
    muscles: { primary: ['lats', 'core'], secondary: ['shoulders', 'glutes', 'quads', 'triceps'] },
    coaching: {
      setup: [
        'Use a slam ball, one made not to bounce.',
        'Stand with feet shoulder-width apart, ball held in both hands at the chest.',
        'Brace the trunk before the first rep.',
      ],
      steps: [
        'Lift the ball overhead and rise onto the toes, reaching tall.',
        'Pull the ball down hard with the whole trunk and slam it into the floor just in front of the feet.',
        'Follow it down with the hips back and the knees bent.',
        'Squat to pick it up with a flat back, then stand and go again.',
      ],
      cues: ['Tall, then slam', 'Hips back as it hits', 'Flat back to pick it up'],
      mistakes: [
        'Only using the arms instead of snapping the trunk down.',
        'Rounding the back to pick the ball up.',
        'Slamming it so close to the feet that it bounces into the shins or face.',
        'Using a bouncy ball that rebounds back up.',
      ],
      breathing: 'Breathe in as the ball goes up, breathe out hard as you slam.',
      tempo: 'Fast and powerful down, a steady reset between reps.',
    },
    keys: {
      overhead: { label: 'Reach tall', pelvis: { pos: [0, 0.98, 0.04] }, spine: { flex: -4 }, neck: { flex: -8 },
        legs: { L: { foot: onToes([0.15, 0.07, 0.0], 18), heel: -18, toeOut: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.172, 1.902, 0.057], elbow: 'out', turn: 90 }, R: 'mirror' } },
      release: { label: 'Slam', pass: true, pelvis: { pos: [0, 0.86, -0.05], pitch: 18 }, spine: { flex: 10 },
        legs: { L: { foot: [0.15, 0.07, 0.0], toeOut: 10, knee: [0.2, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.138, 1.244, 0.458], elbow: 'down' }, R: 'mirror' } },
      slam: { label: 'Hits the floor', ball: [0, 0.12, 0.4],
        pelvis: { pos: [0, 0.66, -0.2], pitch: 42 }, spine: { flex: 10 }, neck: { flex: -10 },
        legs: { L: { foot: [0.15, 0.07, 0.0], toeOut: 10, knee: [0.25, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.15, 0.55, 0.38], elbow: 'out' }, R: 'mirror' } },
      pickup: { label: 'Pick it up', ball: [0, 0.12, 0.4],
        pelvis: { pos: [0, 0.43, -0.12], pitch: 55 }, spine: { flex: 10 }, neck: { flex: -24 },
        legs: { L: { foot: [0.15, 0.07, 0.0], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.167, 0.187, 0.38], elbow: 'out', turn: 90 }, R: 'mirror' } },
      chest: { label: 'Stand', pass: true, pelvis: { pos: [0, 0.9, -0.02], pitch: 4 },
        legs: { L: { foot: [0.15, 0.07, 0.0], toeOut: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.142, 1.206, 0.266], elbow: 'down', turn: -8 }, R: 'mirror' } },
    },
    seq: ['overhead', 'release', 'slam', 'pickup', 'chest'],
    tempo: [0.3, 0.25, 0.6, 0.9, 0.6], holds: { overhead: 0.25, release: 0, slam: 0.25, pickup: 0.2, chest: 0 },
  },
  wallBall: {
    camera: { yaw: 75, pitch: 8 },
    props: [{ type: 'wall', z: 0.8, width: 1.2, target: 3.0 }, ...BALL],
    muscles: { primary: ['quads', 'glutes', 'shoulders'], secondary: ['triceps', 'core', 'calves'] },
    coaching: {
      setup: [
        'Stand facing a wall, about an arm and a half away, feet shoulder-width and toes slightly out.',
        'Hold the ball at the chest with the hands under and to the sides of it, elbows down.',
        'Pick a target on the wall about 3 metres up.',
      ],
      steps: [
        'Sit into a full squat with the chest up and the ball held at the chest.',
        'Drive up hard through the whole foot.',
        'As the legs straighten, push the ball up and throw it at the target.',
        'Catch it above the head on the way down and sink straight into the next squat.',
      ],
      cues: ['Chest up, ball high', 'Legs throw the ball', 'Catch and sink'],
      mistakes: [
        'Throwing with the arms only and not using the legs.',
        'Half squats, cutting the depth to get more reps.',
        'Standing too close or too far so the ball comes back over your head or short.',
        'Catching with straight arms and then pausing before the next squat.',
      ],
      breathing: 'Breathe in on the way down, breathe out hard as you drive and throw.',
      tempo: 'Smooth and continuous: catch, squat and throw in one rhythm.',
    },
    keys: {
      squat: { label: 'Squat', pelvis: { pos: [0, 0.46, -0.16], pitch: 26 }, spine: { flex: 4 }, neck: { flex: -16 },
        legs: { L: { foot: [0.17, 0.07, 0.01], toeOut: 18, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.161, 0.704, 0.222], elbow: [0.3, -1, 0.2], turn: 16 }, R: 'mirror' } },
      drive: { label: 'Drive', pass: true, pelvis: { pos: [0, 0.8, -0.06], pitch: 12 }, neck: { flex: -14 },
        legs: { L: { foot: [0.17, 0.07, 0.01], toeOut: 18, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.161, 1.067, 0.21], elbow: [0.3, -1, 0.2], turn: 18 }, R: 'mirror' } },
      throw: { label: 'Throw', pass: true, pelvis: { pos: [0, 0.99, 0.02] }, neck: { flex: -22 },
        legs: { L: { foot: onToes([0.17, 0.07, 0.01], 14), heel: -14, toeOut: 18 }, R: 'mirror' },
        arms: { L: { hand: [0.178, 1.808, 0.268], elbow: 'out', turn: 100 }, R: 'mirror' } },
      flight: { label: 'Hit the target', ball: [0, 3.0, 0.63], pelvis: { pos: [0, 0.93, 0] }, neck: { flex: -28 },
        legs: { L: { foot: [0.17, 0.07, 0.01], toeOut: 18 }, R: 'mirror' },
        arms: { L: { hand: [0.2, 1.9, 0.2], elbow: 'out' }, R: 'mirror' } },
      catch: { label: 'Catch', pass: true, pelvis: { pos: [0, 0.9, -0.02], pitch: 4 }, neck: { flex: -20 },
        legs: { L: { foot: [0.17, 0.07, 0.01], toeOut: 18, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.189, 1.576, 0.296], elbow: 'out', turn: 106 }, R: 'mirror' } },
    },
    seq: ['squat', 'drive', 'throw', 'flight', 'catch'],
    tempo: [0.4, 0.25, 0.45, 0.5, 0.65], holds: { squat: 0.15, flight: 0, drive: 0, throw: 0, catch: 0 },
  },
  ballRotationalThrow: {
    camera: { yaw: 10, pitch: 10 },
    props: [{ type: 'wall', x: -1.4 }, ...BALL],
    muscles: { primary: ['obliques', 'core'], secondary: ['shoulders', 'glutes', 'chest'] },
    coaching: {
      setup: [
        'Stand side-on to a solid wall, about 1 to 1.5 metres away, feet a little wider than the shoulders.',
        'Hold the ball at the chest with both hands and soften the knees.',
        'Brace the trunk.',
      ],
      steps: [
        'Turn away from the wall and take the ball back beside the far hip, loading the back leg.',
        'Drive from the back foot, turn the hips and then the chest towards the wall.',
        'Let the arms follow and throw the ball into the wall at about chest height.',
        'Catch it as it comes back and absorb it into the next turn away.',
      ],
      cues: ['Hips turn first', 'Pivot the back foot', 'Throw through the wall'],
      mistakes: [
        'Throwing with the arms while the hips stay still.',
        'Rounding the back as you load.',
        'Keeping the back foot flat so the knee twists.',
        'Standing so close that the ball comes back too fast to catch.',
      ],
      breathing: 'Breathe in as you load, breathe out sharply on the throw.',
      tempo: 'A steady load, then fast through the throw.',
    },
    // authored throwing to the left, then mirrored so the wall is on the
    // figure's right and every camera angle sees past it
    keys: mirrorKeys({
      load: { label: 'Load', pelvis: { pos: [-0.04, 0.86, -0.04], pitch: 10, yaw: -20 }, spine: { flex: 8, twist: -40 },
        neck: { twist: 30 },
        legs: { L: { foot: [0.22, 0.07, 0.0], toeOut: 10, knee: [0.2, 0, 1] }, R: { foot: [-0.22, 0.07, 0.0], toeOut: 10, knee: [-0.2, 0, 1] } },
        arms: { L: { hand: [-0.204, 0.983, 0.273], elbow: 'down', turn: -10 }, R: { hand: [-0.37, 0.974, 0.002], elbow: 'back', turn: 70 } } },
      throw: { label: 'Turn and throw', pass: true, pelvis: { pos: [0.02, 0.9, 0.0], pitch: 4, yaw: 20 },
        spine: { twist: 40 }, neck: { twist: -10 },
        legs: { L: { foot: [0.22, 0.07, 0.0], toeOut: 10, knee: [0.4, 0, 1] },
          R: { foot: onToes([-0.22, 0.07, 0.0], 25), heel: -25, toeOut: 40, knee: [0.6, 0, 1] } },
        arms: { L: { hand: [0.34, 1.151, 0.03], elbow: 'down', turn: -16 }, R: { hand: [0.326, 1.159, 0.309], elbow: 'down', turn: 4 } } },
      hit: { label: 'Into the wall', ball: [1.23, 1.2, 0.15], pelvis: { pos: [0.04, 0.9, 0.0], pitch: 4, yaw: 25 },
        spine: { twist: 45 }, neck: { twist: -10 },
        legs: { L: { foot: [0.22, 0.07, 0.0], toeOut: 10, knee: [0.4, 0, 1] },
          R: { foot: onToes([-0.22, 0.07, 0.0], 25), heel: -25, toeOut: 40, knee: [0.6, 0, 1] } },
        arms: { L: { hand: [0.5, 1.2, 0.05], elbow: 'down' }, R: { hand: [0.5, 1.2, 0.3], elbow: 'down' } } },
      catch: { label: 'Catch', pass: true, pelvis: { pos: [0.02, 0.88, -0.02], pitch: 6, yaw: 15 }, spine: { twist: 30 },
        legs: { L: { foot: [0.22, 0.07, 0.0], toeOut: 10, knee: [0.3, 0, 1] }, R: { foot: [-0.22, 0.07, 0.0], toeOut: 10, knee: [-0.2, 0, 1] } },
        arms: { L: { hand: [0.334, 1.122, 0.045], elbow: 'down', turn: -18 }, R: { hand: [0.317, 1.138, 0.322], elbow: 'down', turn: 2 } } },
    }),
    seq: ['load', 'throw', 'hit', 'catch'],
    tempo: [0.35, 0.3, 0.55, 0.6], holds: { load: 0.25, hit: 0, throw: 0, catch: 0 },
  },
  russianTwistBall: {
    camera: { yaw: 20, pitch: 15 },
    props: BALL,
    muscles: TWIST_MUSCLES,
    coaching: {
      setup: [
        'Sit with knees bent and heels resting lightly on the floor, or just off it.',
        'Lean back to about 45 degrees with a long, tall spine.',
        'Hold the medicine ball in both hands in front of the chest, elbows soft.',
      ],
      steps: [
        'Turn the ribs to the left and take the ball beside the left hip.',
        'Come back through the middle with the chest still tall.',
        'Turn to the right and take the ball beside the right hip.',
        'Keep the knees and feet still while the trunk does the turning.',
      ],
      cues: ['Ball across the body', 'Rotate from the ribs', 'Heels light'],
      mistakes: [
        'Only swinging the arms while the chest stays square.',
        'Rounding the back and slumping onto the tailbone.',
        'Knees rocking side to side with the ball.',
        'Banging the ball on the floor instead of controlling it.',
      ],
      breathing: 'Breathe out as you turn to each side.',
      tempo: 'About 1 second to each side, touching the middle between.',
    },
    keys: ballTwist(),
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: 0.8,
  },
};
