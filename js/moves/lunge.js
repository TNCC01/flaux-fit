/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, lunge and split-stance family: see js/moves/README.md.

  Conventions in this file: the working (front) leg is the left leg unless
  a movement alternates. Feet are placed with the helpers below so that a
  foot rolling onto its ball, or onto its heel, pivots about the point
  that stays on the floor instead of sliding.
*/
const D = Math.PI / 180;

// A flat foot. On a box or bench top the ankle sits above the floor-contact
// height, so a hair of heel keeps the sole level with the surface.
const flat = (x, y, z, toeOut = 0, knee = 'fwd') =>
  ({ foot: [x, y, z], toeOut, knee, ...(y > 0.1 ? { heel: 0.01 } : {}) });

// A foot up on the ball, heel raised by `lift` degrees. (x, z) is where the
// ankle would be with the foot flat; the toe tip stays put as the heel
// rises, so the ankle moves forward and up.
function ball(side, x, z, lift, toeOut = 0, knee = 'fwd') {
  const yaw = toeOut * (side === 'L' ? 1 : -1) * D, a = lift * D;
  const fwd = 0.07 * Math.sin(a) + 0.19 * (1 - Math.cos(a));
  const y = 0.07 * Math.cos(a) + 0.19 * Math.sin(a);
  const r = (v) => +v.toFixed(3);
  // the engine's heel field: negative raises the heel
  return { foot: [r(x + Math.sin(yaw) * fwd), r(y), r(z + Math.cos(yaw) * fwd)], toeOut, heel: -lift, knee };
}

// A foot on its heel with the toes pulled up by `lift` degrees (the straight
// leg in a cossack squat). The heel stays put.
function heelDown(side, x, z, lift, toeOut = 0, knee = 'up') {
  const yaw = toeOut * (side === 'L' ? 1 : -1) * D, a = lift * D;
  const fwd = 0.055 * Math.cos(a) - 0.07 * Math.sin(a) - 0.055;
  const y = 0.07 * Math.cos(a) + 0.055 * Math.sin(a);
  const r = (v) => +v.toFixed(3);
  return { foot: [r(x + Math.sin(yaw) * fwd), r(y), r(z + Math.cos(yaw) * fwd)], toeOut, heel: lift, knee };
}

// A foot moving through the air, held level (or tipped by `tip`: + toes up).
const air = (x, y, z, tip = 0, knee = 'fwd', toeOut = 0) => ({ foot: [x, y, z], heel: tip || -0.01, knee, toeOut });

const mirrorLegs = (legs) => ({ L: mirrorLeg(legs.R), R: mirrorLeg(legs.L) });
function mirrorLeg(l) {
  const m = { ...l };
  if (l.foot) m.foot = [-l.foot[0], l.foot[1], l.foot[2]];
  if (Array.isArray(l.knee)) m.knee = [-l.knee[0], l.knee[1], l.knee[2]];
  return m;
}
function mirrorArms(arms) {
  const f = (a) => {
    if (!a || a === 'mirror') return a;
    const m = { ...a };
    if (a.hand) m.hand = [-a.hand[0], a.hand[1], a.hand[2]];
    if (Array.isArray(a.elbow)) m.elbow = [-a.elbow[0], a.elbow[1], a.elbow[2]];
    return m;
  };
  if (arms.R === 'mirror') return arms;
  if (arms.L === 'mirror') return arms;
  return { L: f(arms.R), R: f(arms.L) };
}
// The same pose with left and right swapped.
function mirrorPose(p, label) {
  const o = { ...p, label: label || p.label };
  if (p.pelvis) {
    o.pelvis = { ...p.pelvis };
    if (p.pelvis.pos) o.pelvis.pos = [-p.pelvis.pos[0], p.pelvis.pos[1], p.pelvis.pos[2]];
    if (p.pelvis.yaw) o.pelvis.yaw = -p.pelvis.yaw;
    if (p.pelvis.roll) o.pelvis.roll = -p.pelvis.roll;
  }
  for (const k of ['spine', 'neck']) if (p[k]) o[k] = { ...p[k], side: -(p[k].side || 0), twist: -(p[k].twist || 0) };
  if (p.legs) o.legs = mirrorLegs(p.legs);
  if (p.arms) o.arms = mirrorArms(p.arms);
  return o;
}

const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };
// hands loosely together in front of the chest, elbows down
const CHEST = { L: { shoulder: { elev: 12, plane: -30 }, elbow: 95 }, R: 'mirror' };
// arms long at the sides, a dumbbell in each hand with the handle pointing forward
const ARMS_DB = { L: { shoulder: { elev: 9, plane: 90, twist: 0 }, elbow: 4 }, R: 'mirror' };

// ---- reverse lunge, right leg stepping back (the left side is the mirror)
const RL = {
  stand: {
    label: 'Stand tall',
    pelvis: { pos: [0, 0.92, 0] },
    legs: { L: flat(0.1, 0.07, 0, 5), R: flat(-0.1, 0.07, 0, 5) },
    arms: ARMS_DOWN,
  },
  swingR: {
    label: 'Step back',
    pelvis: { pos: [0, 0.88, -0.1], pitch: 5 },
    legs: { L: flat(0.1, 0.07, 0, 5), R: air(-0.1, 0.17, -0.45, -20) },
    arms: ARMS_DOWN,
  },
  touchR: {
    label: 'Toes down',
    pelvis: { pos: [0, 0.78, -0.3], pitch: 7 },
    legs: { L: flat(0.1, 0.07, 0, 5), R: ball('R', -0.11, -0.98, 42) },
    arms: ARMS_DOWN,
  },
  bottomR: {
    label: 'Bottom',
    pelvis: { pos: [0, 0.53, -0.4], pitch: 8 },
    legs: { L: flat(0.1, 0.07, 0, 5), R: ball('R', -0.11, -0.98, 42) },
    arms: ARMS_DOWN,
  },
};
RL.swingL = mirrorPose(RL.swingR);
RL.touchL = mirrorPose(RL.touchR);
RL.bottomL = mirrorPose(RL.bottomR);
const RL_SEQ = ['stand', 'swingR', 'touchR', 'bottomR', 'touchR', 'swingR',
  'stand', 'swingL', 'touchL', 'bottomL', 'touchL', 'swingL'];
const RL_TEMPO = [0.45, 0.35, 1.0, 0.7, 0.35, 0.4, 0.45, 0.35, 1.0, 0.7, 0.35, 0.4];
const RL_HOLDS = { swingR: 0, swingL: 0, touchR: 0, touchL: 0, bottomR: 0.3, bottomL: 0.3, stand: 0.4 };

// With the left arm locked overhead (the free arm out for balance).
function overhead(p, arm) {
  return { ...p, arms: { L: { hand: arm, elbow: 'back' }, R: { shoulder: { elev: 30, plane: 90 }, elbow: 15 } } };
}

// ---- lateral lunge to the left (the right side is the mirror)
const LAT = {
  stand: {
    label: 'Stand tall',
    pelvis: { pos: [0, 0.92, 0] },
    legs: { L: flat(0.1, 0.07, 0, 8), R: flat(-0.1, 0.07, 0, 8) },
    arms: CHEST,
  },
  stepL: {
    label: 'Step wide',
    pelvis: { pos: [0.08, 0.89, -0.02], pitch: 4 },
    legs: { L: air(0.45, 0.15, 0, 0, 'fwd', 10), R: flat(-0.1, 0.07, 0, 8) },
    arms: CHEST,
  },
  sitL: {
    label: 'Sit into the hip',
    pelvis: { pos: [0.67, 0.56, -0.16], pitch: 34 },
    spine: { flex: 4 },
    neck: { flex: -16 },
    legs: { L: flat(0.85, 0.07, 0, 12, [0.25, 0, 1]), R: flat(-0.1, 0.07, 0, 8) },
    arms: CHEST,
  },
};
LAT.stepR = mirrorPose(LAT.stepL);
LAT.sitR = mirrorPose(LAT.sitL);

// ---- curtsy lunge, right leg back and across (the left side is the mirror)
const CUR = {
  stand: LAT.stand,
  swingR: {
    label: 'Step back and across',
    pelvis: { pos: [0.02, 0.88, -0.06], pitch: 4 },
    legs: { L: flat(0.1, 0.07, 0, 8), R: air(0.05, 0.17, -0.35, -20) },
    arms: CHEST,
  },
  bottomR: {
    label: 'Bottom',
    pelvis: { pos: [0.04, 0.52, -0.16], pitch: 8 },
    legs: { L: flat(0.1, 0.07, 0.05, 8), R: ball('R', 0.25, -0.62, 40, 0, [0.2, -1, 0.6]) },
    arms: CHEST,
  },
};
CUR.swingL = mirrorPose(CUR.swingR);
CUR.bottomL = mirrorPose(CUR.bottomR);

// ---- cossack squat: a wide stance, then down to one side
const COS_W = 0.55;
const COS = {
  wide: {
    label: 'Wide stance',
    pelvis: { pos: [0, 0.78, 0] },
    legs: { L: flat(COS_W, 0.07, 0, 20, [0.3, 0, 1]), R: flat(-COS_W, 0.07, 0, 20, [-0.3, 0, 1]) },
    arms: { L: { shoulder: { elev: 30, plane: 10 }, elbow: 70 }, R: 'mirror' },
  },
  left: {
    label: 'Down to the left',
    pelvis: { pos: [0.36, 0.45, -0.12], pitch: 28 },
    neck: { flex: -14 },
    legs: { L: flat(COS_W, 0.07, 0, 20, [0.5, 0, 1]), R: heelDown('R', -COS_W, 0, 60, 20) },
    arms: { L: { shoulder: { elev: 85, plane: 5 }, elbow: 5 }, R: 'mirror' },
  },
};
COS.right = mirrorPose(COS.left, 'Down to the right');

// ---- jumping split lunge: left foot forward, then the mirror
const JL = {
  downL: {
    label: 'Land and load',
    pelvis: { pos: [0, 0.57, -0.06], pitch: 8 },
    legs: { L: flat(0.11, 0.07, 0.36, 5), R: ball('R', -0.11, -0.65, 42) },
    arms: { L: { shoulder: { elev: -25, plane: 5 }, elbow: 40 }, R: { shoulder: { elev: 40, plane: 5 }, elbow: 80 } },
  },
  airA: {
    label: 'Swap in the air',
    pelvis: { pos: [0, 1.08, -0.05], pitch: 3 },
    legs: { L: air(0.11, 0.36, -0.12, -25, 'fwd'), R: air(-0.11, 0.36, 0.1, -10, 'fwd') },
    arms: { L: { shoulder: { elev: 10, plane: 5 }, elbow: 70 }, R: 'mirror' },
  },
};
JL.downR = mirrorPose(JL.downL);
JL.airB = mirrorPose(JL.airA);

// ---- step-ups: a knee-height box in front, left foot working
const BOX = { type: 'box', pos: [0, 0, 0.32], size: [0.6, 0.4, 0.45] };   // front edge z 0.095, top 0.4
const ON_BOX_L = flat(0.1, 0.47, 0.3, 3);
const ON_BOX_R = flat(-0.1, 0.47, 0.3, 3);

export default {
  splitSquat: {
    camera: { yaw: 60, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand in a long split stance: front foot flat, back foot on the ball of the foot, about a leg length apart.',
        'Feet hip-width apart side to side, like standing on train tracks, not a tightrope.',
        'Stand tall with the ribs over the pelvis and the hips square to the front.',
      ],
      steps: [
        'Brace your trunk and bend both knees at the same time.',
        'Drop the back knee straight down towards the floor, under the hip, keeping the torso upright.',
        'Let the front knee travel forward in line with the middle toes while the front heel stays down.',
        'Stop with the back knee just off the floor and the front thigh about level with the floor.',
        'Push through the whole front foot to stand back up, then repeat before swapping sides.',
      ],
      cues: [
        'Back knee straight down',
        'Front heel heavy',
        'Tall chest, hips square',
      ],
      mistakes: [
        'Stance too short, so the front heel lifts and the knee takes all the load.',
        'Feet in one line, which makes balance hard and twists the hips.',
        'Front knee caving in towards the big toe.',
        'Leaning forward and bouncing the back knee off the floor.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you push back up.',
      tempo: 'About 2 seconds down, a brief pause just off the floor, 1 second up.',
    },
    keys: {
      top: {
        label: 'Tall',
        pelvis: { pos: [0, 0.82, -0.05], pitch: 3 },
        legs: { L: flat(0.11, 0.07, 0.36, 5), R: ball('R', -0.11, -0.65, 42) },
        arms: ARMS_DOWN,
      },
      bottom: {
        label: 'Knee down',
        pelvis: { pos: [0, 0.53, -0.05], pitch: 6 },
        legs: { L: flat(0.11, 0.07, 0.36, 5), R: ball('R', -0.11, -0.65, 42) },
        arms: ARMS_DOWN,
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2, 1.2],
    holds: { bottom: 0.3, top: 0.4 },
  },

  dbSplitSquat: {
    camera: { yaw: 60, pitch: 8 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'forearms', 'traps', 'core'] },
    coaching: {
      setup: [
        'Hold a dumbbell in each hand, arms long by your sides and palms facing in.',
        'Take a long split stance, front foot flat and back foot on the ball, hip-width apart side to side.',
        'Shoulders down and back, ribs stacked over the pelvis.',
      ],
      steps: [
        'Brace your trunk and let the dumbbells hang straight down.',
        'Bend both knees and lower the back knee straight down, just short of the floor.',
        'Keep the front heel planted and the front knee tracking over the middle toes.',
        'Push through the whole front foot to stand back up, keeping the weights still at your sides.',
        'Finish all reps on one leg, then swap sides.',
      ],
      cues: [
        'Dumbbells at the sides',
        'Back knee straight down',
        'Shoulders down, chest tall',
      ],
      mistakes: [
        'Letting the dumbbells swing or drift forward, which pulls the torso over.',
        'Shrugging the shoulders up towards the ears.',
        'Short stance, so the front heel lifts.',
        'Front knee caving in on the way up.',
      ],
      breathing: 'Breathe in and brace at the top, breathe out as you drive up.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      top: {
        label: 'Tall',
        pelvis: { pos: [0, 0.82, -0.05], pitch: 3 },
        legs: { L: flat(0.11, 0.07, 0.36, 5), R: ball('R', -0.11, -0.65, 42) },
        arms: ARMS_DB,
      },
      bottom: {
        label: 'Knee down',
        pelvis: { pos: [0, 0.53, -0.05], pitch: 6 },
        legs: { L: flat(0.11, 0.07, 0.36, 5), R: ball('R', -0.11, -0.65, 42) },
        arms: ARMS_DB,
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2, 1.3],
    holds: { bottom: 0.3, top: 0.5 },
  },

  bulgarianSplitSquat: {
    camera: { yaw: 65, pitch: 8 },
    props: [{ type: 'bench', pos: [0, 0, -0.62], size: [1.2, 0.45, 0.3] }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'hipFlexors', 'core'] },
    coaching: {
      setup: [
        'Stand about a big stride in front of a bench, facing away from it.',
        'Rest the top of your back foot on the bench, laces down.',
        'Front foot flat, far enough forward that the front shin stays fairly upright at the bottom.',
      ],
      steps: [
        'Brace your trunk with a slight forward lean from the hips.',
        'Lower straight down, letting the back knee drop towards the floor.',
        'Keep the front knee in line with the middle toes and the whole front foot on the floor.',
        'Stop when the front thigh is about level with the floor.',
        'Drive through the front foot to stand up. The back leg is only there for balance.',
      ],
      cues: [
        'Rear foot on the bench',
        'Drop the back knee',
        'Push through the front heel',
      ],
      mistakes: [
        'Front foot too close to the bench, so the front heel lifts and the knee shoots forward.',
        'Pushing off the back foot instead of the front leg.',
        'Front knee caving in.',
        'Bench too high, which strains the front of the back hip.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you stand.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      top: {
        label: 'Tall',
        pelvis: { pos: [0, 0.83, -0.08], pitch: 8 },
        legs: { L: flat(0.11, 0.07, 0.28, 5), R: { foot: [-0.11, 0.49, -0.46], ankle: -65, knee: 'down' } },
        arms: ARMS_DOWN,
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.53, -0.12], pitch: 14 },
        legs: { L: flat(0.11, 0.07, 0.28, 5), R: { foot: [-0.11, 0.49, -0.46], ankle: -20, knee: 'down' } },
        arms: ARMS_DOWN,
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2, 1.3],
    holds: { bottom: 0.3, top: 0.4 },
  },

  stepDown: {
    camera: { yaw: 70, pitch: 10 },
    props: [{ type: 'box', pos: [0.06, 0, -0.06], size: [0.5, 0.2, 0.4] }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand on a low step facing forward, one whole foot on it near the front edge.',
        'Let the other foot hang just off the front edge.',
        'Stand tall with the hips level.',
      ],
      steps: [
        'Sit the hips back slightly and slowly bend the standing knee.',
        'Reach the free heel down towards the floor in front of the step, taking 3 seconds.',
        'Keep the standing knee in line with the middle toes and the pelvis level.',
        'Lightly touch the heel to the floor without putting weight on it.',
        'Push through the standing foot to straighten back up.',
      ],
      cues: [
        'Lower under control, 3 seconds',
        'Knee over the middle toes',
        'Just kiss the floor',
      ],
      mistakes: [
        'Dropping the last part of the way instead of controlling it.',
        'Standing knee caving in towards the other leg.',
        'Hip on the free side dropping or hiking up.',
        'Putting weight through the heel on the floor to push back up.',
      ],
      breathing: 'Breathe out slowly as you lower, breathe in at the bottom, out as you stand.',
      tempo: '3 seconds down, a light touch, 1 second up.',
    },
    keys: {
      top: {
        label: 'Tall on the step',
        pelvis: { pos: [0.03, 1.125, -0.06], pitch: 3 },
        legs: { L: flat(0.1, 0.27, -0.06, 3), R: air(-0.09, 0.33, 0.2, 5) },
        arms: { L: { shoulder: { elev: 20, plane: 30 }, elbow: 20 }, R: 'mirror' },
      },
      bottom: {
        label: 'Heel tap',
        pelvis: { pos: [0.03, 0.8, -0.14], pitch: 22 },
        legs: { L: flat(0.1, 0.27, -0.06, 3), R: heelDown('R', -0.09, 0.36, 15, 0, 'fwd') },
        arms: { L: { shoulder: { elev: 70, plane: 10 }, elbow: 10 }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [3, 1.2],
    holds: { bottom: 0.2, top: 0.5 },
  },

  reverseLunge: {
    camera: { yaw: 60, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand tall with feet hip-width apart.',
        'Arms relaxed by your sides, or a dumbbell in each hand for the loaded version.',
        'Weight spread across the whole foot.',
      ],
      steps: [
        'Take a long step straight back, landing on the ball of the foot.',
        'Bend both knees and lower the back knee towards the floor, under the hip.',
        'Keep most of your weight in the front foot, front shin close to vertical.',
        'Push through the front foot and bring the back leg forward to stand tall.',
        'Alternate legs each rep.',
      ],
      cues: [
        'Long step back',
        'Back knee under the hip',
        'Drive through the front foot',
      ],
      mistakes: [
        'Short step back, which forces the front knee far over the toes.',
        'Stepping back onto the same line as the front foot, so you wobble.',
        'Leaning the torso well forward over the front thigh.',
        'Pushing off the back foot to get up.',
      ],
      breathing: 'Breathe in as you step back and lower, breathe out as you stand.',
      tempo: 'About 2 seconds to step back and lower, 1 second to return.',
    },
    keys: RL,
    flow: ['swingR', 'swingL', 'touchR', 'touchL'],
    seq: RL_SEQ,
    tempo: RL_TEMPO,
    holds: RL_HOLDS,
  },

  overheadLunge: {
    camera: { yaw: 50, pitch: 8 },
    props: [{ type: 'dumbbell', hand: 'L' }],
    muscles: { primary: ['quads', 'glutes', 'shoulders'], secondary: ['core', 'obliques', 'triceps', 'upperBack'] },
    coaching: {
      setup: [
        'Press one dumbbell overhead and lock the elbow, bicep near the ear.',
        'Stack the dumbbell over the shoulder, with the shoulder pulled down away from the ear.',
        'Stand tall with feet hip-width apart, free arm out for balance.',
      ],
      steps: [
        'Brace your trunk hard and keep the ribs down.',
        'Take a long step back and lower the back knee towards the floor.',
        'Keep the dumbbell directly over the shoulder and the torso upright the whole time.',
        'Drive through the front foot back to standing.',
        'Alternate legs, then swap the weight to the other hand.',
      ],
      cues: [
        'Lock it out overhead',
        'Ribs down',
        'Weight over the shoulder, not in front',
      ],
      mistakes: [
        'Elbow softening so the weight drifts forward.',
        'Arching the lower back to keep the arm up.',
        'Leaning to the side away from the weight.',
        'Using a weight you cannot hold steady overhead.',
      ],
      breathing: 'Breathe in and brace before each step, breathe out as you stand.',
      tempo: 'About 2 seconds down, 1 second up, with the weight still.',
    },
    keys: {
      stand: overhead(RL.stand, [0.17, 1.89, -0.03]),
      swingR: overhead(RL.swingR, [0.17, 1.86, -0.09]),
      touchR: overhead(RL.touchR, [0.17, 1.76, -0.27]),
      bottomR: overhead(RL.bottomR, [0.17, 1.51, -0.36]),
      swingL: overhead(RL.swingL, [0.17, 1.86, -0.09]),
      touchL: overhead(RL.touchL, [0.17, 1.76, -0.27]),
      bottomL: overhead(RL.bottomL, [0.17, 1.51, -0.36]),
    },
    flow: ['swingR', 'swingL', 'touchR', 'touchL'],
    seq: RL_SEQ,
    tempo: RL_TEMPO.map(t => t * 1.15),
    holds: RL_HOLDS,
  },

  walkingLunge: {
    camera: { yaw: 75, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand tall with feet hip-width apart and a clear path in front of you.',
        'Arms relaxed by your sides.',
        'Look ahead, not down at your feet.',
      ],
      steps: [
        'Take a long step forward and plant the whole foot.',
        'Lower the back knee towards the floor, letting the back heel lift.',
        'Keep the front knee over the middle toes and the torso upright.',
        'Drive through the front foot and bring the back leg through into the next step.',
        'Keep going down the driveway and back.',
      ],
      cues: [
        'Long steps, stay tall',
        'Back knee towards the floor',
        'Front heel down',
      ],
      mistakes: [
        'Short, choppy steps so the front heel lifts.',
        'Feet on one line, which makes you wobble.',
        'Front knee caving in as you drive up.',
        'Rushing so the back knee slams the ground.',
      ],
      breathing: 'Breathe in as you lower, breathe out as you step through.',
      tempo: 'About 1 to 2 seconds per step, controlled all the way down.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        pelvis: { pos: [0, 0.92, 0] },
        legs: { L: flat(0.1, 0.07, 0, 5), R: flat(-0.1, 0.07, 0, 5) },
        arms: ARMS_DOWN,
      },
      swingL: {
        label: 'Step forward',
        pelvis: { pos: [0, 0.89, 0.14], pitch: 3 },
        legs: { L: air(0.1, 0.16, 0.45, 5), R: ball('R', -0.1, 0, 15) },
        arms: ARMS_DOWN,
      },
      touchL: {
        label: 'Foot down',
        pelvis: { pos: [0, 0.78, 0.48], pitch: 5 },
        legs: { L: flat(0.11, 0.07, 0.93, 5), R: ball('R', -0.11, 0, 32) },
        arms: ARMS_DOWN,
      },
      bottomL: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.53, 0.54], pitch: 7 },
        legs: { L: flat(0.11, 0.07, 0.93, 5), R: ball('R', -0.11, 0, 42) },
        arms: ARMS_DOWN,
      },
      passR: {
        label: 'Bring it through',
        pelvis: { pos: [0, 0.89, 0.98], pitch: 3 },
        legs: { L: flat(0.11, 0.07, 0.93, 5), R: air(-0.1, 0.2, 0.9, 5) },
        arms: ARMS_DOWN,
      },
      touchR: {
        label: 'Foot down',
        pelvis: { pos: [0, 0.78, 1.41], pitch: 5 },
        legs: { L: ball('L', 0.11, 0.93, 32), R: flat(-0.11, 0.07, 1.86, 5) },
        arms: ARMS_DOWN,
      },
      bottomR: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.53, 1.47], pitch: 7 },
        legs: { L: ball('L', 0.11, 0.93, 42), R: flat(-0.11, 0.07, 1.86, 5) },
        arms: ARMS_DOWN,
      },
      passL: {
        label: 'Feet together',
        pelvis: { pos: [0, 0.88, 1.8], pitch: 3 },
        legs: { L: air(0.1, 0.18, 1.7, 5), R: flat(-0.11, 0.07, 1.86, 5) },
        arms: ARMS_DOWN,
      },
      finish: {
        label: 'Stand tall',
        pelvis: { pos: [0, 0.92, 1.86] },
        legs: { L: flat(0.1, 0.07, 1.86, 5), R: flat(-0.1, 0.07, 1.86, 5) },
        arms: ARMS_DOWN,
      },
    },
    // two steps down the driveway, then the loop cuts back to the start
    flow: ['swingL', 'touchL', 'touchR', 'passR', 'passL'],
    seq: ['stand', 'swingL', 'touchL', 'bottomL', 'passR', 'touchR', 'bottomR', 'passL', 'finish'],
    tempo: [0.45, 0.4, 0.9, 0.8, 0.5, 0.9, 0.8, 0.45, 0.02],
    holds: { swingL: 0, touchL: 0, touchR: 0, passR: 0, passL: 0, bottomL: 0.25, bottomR: 0.25, finish: 0.5, stand: 0.4 },
  },

  lateralLunge: {
    camera: { yaw: 20, pitch: 10 },
    muscles: { primary: ['quads', 'glutes', 'adductors'], secondary: ['hamstrings', 'core'] },
    coaching: {
      setup: [
        'Stand tall with feet together, toes forward or turned out slightly.',
        'Hands together in front of the chest.',
        'Weight spread across both feet.',
      ],
      steps: [
        'Take a big step out to one side and plant the whole foot.',
        'Sit the hips back and down into that side, bending that knee.',
        'Keep the other leg straight with its foot flat on the floor.',
        'Keep the bent knee over the middle toes and the chest up.',
        'Push off the bent leg to return to standing, then go to the other side.',
      ],
      cues: [
        'Step wide, sit into that hip',
        'Other leg long',
        'Chest up',
      ],
      mistakes: [
        'Knee shooting forward past the toes instead of sitting the hips back.',
        'Heel of the bent leg lifting.',
        'Rounding the back to get lower.',
        'Stepping too narrow, which turns it into a squat.',
      ],
      breathing: 'Breathe in as you step and sit, breathe out as you push back.',
      tempo: 'About 2 seconds to step and lower, 1 second to return.',
    },
    keys: LAT,
    flow: ['stepL', 'stepR'],
    seq: ['stand', 'stepL', 'sitL', 'stepL', 'stand', 'stepR', 'sitR', 'stepR'],
    tempo: [0.45, 1.0, 0.8, 0.45, 0.45, 1.0, 0.8, 0.45],
    holds: { stepL: 0, stepR: 0, sitL: 0.3, sitR: 0.3, stand: 0.35 },
  },

  curtsyLunge: {
    camera: { yaw: 30, pitch: 10 },
    muscles: { primary: ['glutes', 'quads'], secondary: ['adductors', 'hamstrings', 'core'] },
    coaching: {
      setup: [
        'Stand tall with feet hip-width apart.',
        'Hands together in front of the chest.',
        'Hips and shoulders facing straight ahead.',
      ],
      steps: [
        'Step one leg back and across behind the other, landing on the ball of the foot.',
        'Bend both knees and lower the back knee towards the floor behind the front heel.',
        'Keep the front knee in line with the front toes and the hips facing forward.',
        'Drive through the front foot to return to standing.',
        'Alternate sides.',
      ],
      cues: [
        'Step back and across',
        'Hips face forward',
        'Front knee over the toes',
      ],
      mistakes: [
        'Letting the hips twist to face sideways.',
        'Front knee caving in as you lower.',
        'Crossing so far that you lose balance.',
        'Leaning the chest over the front knee.',
      ],
      breathing: 'Breathe in as you step back, breathe out as you stand.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: CUR,
    flow: ['swingR', 'swingL'],
    seq: ['stand', 'swingR', 'bottomR', 'swingR', 'stand', 'swingL', 'bottomL', 'swingL'],
    tempo: [0.5, 1.0, 0.8, 0.45, 0.5, 1.0, 0.8, 0.45],
    holds: { swingR: 0, swingL: 0, bottomR: 0.3, bottomL: 0.3, stand: 0.35 },
  },

  cossackSquat: {
    camera: { yaw: 15, pitch: 10 },
    muscles: { primary: ['adductors', 'quads', 'glutes'], secondary: ['hamstrings', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand in a very wide stance, about twice shoulder-width.',
        'Toes turned out a little, hands together in front of you.',
        'Stand tall with the weight in the middle.',
      ],
      steps: [
        'Shift your weight to one side and squat down on that leg, keeping its heel flat.',
        'Straighten the other leg as you go and pull its toes up so it rests on the heel.',
        'Sit as deep as you can with the chest up and the bent knee over the toes. Reach the arms forward for balance.',
        'Push back up through the bent leg to the middle, standing tall in the wide stance.',
        'Go straight down to the other side.',
      ],
      cues: [
        'Side to side, other leg straight',
        'Toes up on the straight leg',
        'Heel down on the bent leg',
      ],
      mistakes: [
        'Bending the straight leg, which takes the stretch out of the inner thigh.',
        'Heel of the working leg lifting.',
        'Rounding the back to get deeper.',
        'Rushing through the middle instead of standing tall between sides.',
      ],
      breathing: 'Breathe in as you lower to the side, breathe out as you come up.',
      tempo: 'About 2 seconds down, a short pause, 1 to 2 seconds back through the middle.',
    },
    keys: COS,
    seq: ['wide', 'left', 'wide', 'right'],
    tempo: [1.6, 1.2, 1.6, 1.2],
    holds: { left: 0.4, right: 0.4, wide: 0.35 },
  },

  jumpLunge: {
    camera: { yaw: 60, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings', 'adductors', 'core'] },
    coaching: {
      setup: [
        'Start in a split stance, front foot flat, back foot on the ball.',
        'Lower into a lunge with the back knee just off the floor.',
        'Arms bent, opposite arm to front leg, like running.',
      ],
      steps: [
        'Drive up hard through both legs and swing the arms.',
        'Swap legs in the air so the back leg comes forward.',
        'Land softly in a lunge with the other leg in front, knees bending to soak it up.',
        'Settle for a moment, then jump again.',
      ],
      cues: [
        'Swap legs in the air',
        'Land soft and quiet',
        'Chest tall',
      ],
      mistakes: [
        'Landing with straight legs, which jars the knees.',
        'Front knee caving in on landing.',
        'Stance getting shorter every rep.',
        'Leaning forward and landing on the toes.',
      ],
      breathing: 'Breathe out as you jump, breathe in as you land and reload.',
      tempo: 'Quick jump, controlled landing, about 1 rep every 1 to 2 seconds.',
    },
    keys: JL,
    flow: ['airA', 'airB'],
    seq: ['downL', 'airA', 'downR', 'airB'],
    tempo: [0.38, 0.42, 0.38, 0.42],
    holds: { airA: 0, airB: 0, downL: 0.3, downR: 0.3 },
  },

  stepUp: {
    camera: { yaw: 65, pitch: 8 },
    props: [BOX],
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand facing a sturdy box or step about knee height.',
        'Place one whole foot on top, heel included.',
        'Stand tall with the weight in the back foot for now.',
      ],
      steps: [
        'Lean the chest slightly forward over the top foot.',
        'Drive through the heel of the top foot to stand up onto the box.',
        'Finish tall with the hip straight, bringing the other foot up beside it.',
        'Step the same foot back down under control and repeat, then swap sides.',
      ],
      cues: [
        'Drive through the top leg',
        'Whole foot on the box',
        'Stand all the way up',
      ],
      mistakes: [
        'Pushing off the bottom foot so the top leg does little.',
        'Top knee caving in as you stand.',
        'Only the toes on the box.',
        'Dropping back down instead of lowering with control.',
      ],
      breathing: 'Breathe out as you step up, breathe in as you lower.',
      tempo: 'About 1 to 2 seconds up, 2 seconds down.',
    },
    keys: {
      start: {
        label: 'Foot on the box',
        pelvis: { pos: [0, 0.9, -0.05], pitch: 10 },
        legs: { L: ON_BOX_L, R: flat(-0.1, 0.07, -0.2, 5) },
        arms: ARMS_DOWN,
      },
      drive: {
        label: 'Lean and drive',
        pelvis: { pos: [0, 0.98, 0.1], pitch: 20 },
        spine: { flex: 4 },
        legs: { L: ON_BOX_L, R: ball('R', -0.1, -0.2, 35, 5) },
        arms: ARMS_DOWN,
      },
      rise: {
        label: 'Stand up',
        pelvis: { pos: [0.02, 1.24, 0.24], pitch: 8 },
        legs: { L: ON_BOX_L, R: air(-0.1, 0.62, -0.12, -15) },
        arms: ARMS_DOWN,
      },
      top: {
        label: 'Tall on top',
        pelvis: { pos: [0, 1.32, 0.28] },
        legs: { L: ON_BOX_L, R: ON_BOX_R },
        arms: ARMS_DOWN,
      },
      lower: {
        label: 'Step down',
        pelvis: { pos: [0.02, 1.12, 0.18], pitch: 12 },
        legs: { L: ON_BOX_L, R: air(-0.1, 0.58, -0.1) },
        arms: ARMS_DOWN,
      },
    },
    flow: ['drive', 'rise', 'lower'],
    seq: ['start', 'drive', 'rise', 'top', 'lower'],
    tempo: [0.55, 0.55, 0.45, 0.8, 0.7],
    holds: { drive: 0, rise: 0, lower: 0, top: 0.45, start: 0.35 },
  },

  stepUpJump: {
    camera: { yaw: 65, pitch: 8 },
    props: [BOX],
    muscles: { primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings', 'core', 'shoulders'] },
    coaching: {
      setup: [
        'Stand facing a sturdy box about knee height or lower.',
        'Place one whole foot on top and the other on the floor.',
        'Arms back, hips back, ready to jump.',
      ],
      steps: [
        'Swing the arms and drive hard through the top foot to jump up.',
        'Swap feet in the air, above the box.',
        'Land with the other foot on the box and the first foot on the floor.',
        'Bend both knees softly to absorb the landing, then go again.',
      ],
      cues: [
        'Explode off the box, land soft',
        'Swap feet in the air',
        'Quiet landing',
      ],
      mistakes: [
        'Landing stiff-legged, which jars the knees and back.',
        'Catching the toes on the edge of the box.',
        'Top knee caving in on take-off or landing.',
        'Using a box so high you have to hop up with your toes.',
      ],
      breathing: 'Breathe out as you jump, breathe in as you land.',
      tempo: 'Explosive jump, soft landing, a short reset between reps.',
    },
    keys: {
      loadL: {
        label: 'Load',
        pelvis: { pos: [0, 0.84, 0.0], pitch: 24 },
        spine: { flex: 4 },
        legs: { L: ON_BOX_L, R: flat(-0.1, 0.07, -0.2, 5) },
        arms: { L: { shoulder: { elev: -35, plane: 5 }, elbow: 15 }, R: 'mirror' },
      },
      airA: {
        label: 'Explode up',
        pelvis: { pos: [0, 1.48, 0.14], pitch: 4 },
        legs: { L: air(0.1, 0.76, -0.08, -15), R: air(-0.1, 0.76, -0.08, -15) },
        arms: { L: { shoulder: { elev: 130, plane: 20 }, elbow: 20 }, R: 'mirror' },
      },
      loadR: {
        label: 'Land soft',
        pelvis: { pos: [0, 0.84, 0.0], pitch: 24 },
        spine: { flex: 4 },
        legs: { L: flat(0.1, 0.07, -0.2, 5), R: ON_BOX_R },
        arms: { L: { shoulder: { elev: -35, plane: 5 }, elbow: 15 }, R: 'mirror' },
      },
    },
    flow: ['airA'],
    seq: ['loadL', 'airA', 'loadR', 'airA'],
    tempo: [0.4, 0.45, 0.4, 0.45],
    holds: { airA: 0, loadL: 0.35, loadR: 0.35 },
  },
};
