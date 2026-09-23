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
    arms: ARMS_DOWN,
  },
  stepL: {
    label: 'Step wide',
    pelvis: { pos: [0.08, 0.89, -0.02], pitch: 4 },
    legs: { L: air(0.45, 0.15, 0, 0, 'fwd', 10), R: flat(-0.1, 0.07, 0, 8) },
    arms: { L: { shoulder: { elev: 30, plane: 20 }, elbow: 60 }, R: 'mirror' },
  },
  sitL: {
    label: 'Sit into the hip',
    pelvis: { pos: [0.67, 0.56, -0.16], pitch: 34 },
    spine: { flex: 4 },
    neck: { flex: -16 },
    legs: { L: flat(0.85, 0.07, 0, 12, [0.25, 0, 1]), R: flat(-0.1, 0.07, 0, 8) },
    arms: { L: { shoulder: { elev: 55, plane: -25 }, elbow: 100 }, R: 'mirror' },
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
    arms: ARMS_DOWN,
  },
  bottomR: {
    label: 'Bottom',
    pelvis: { pos: [0.04, 0.52, -0.16], pitch: 8 },
    legs: { L: flat(0.1, 0.07, 0.05, 8), R: ball('R', 0.25, -0.62, 40, 0, [0.2, -1, 0.6]) },
    arms: { L: { shoulder: { elev: 40, plane: -20 }, elbow: 110 }, R: 'mirror' },
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

export default {
  splitSquat: {
    camera: { yaw: 60, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'calves', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
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
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
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
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
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
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
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
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: RL,
    seq: RL_SEQ,
    tempo: RL_TEMPO,
    holds: RL_HOLDS,
  },

  overheadLunge: {
    camera: { yaw: 50, pitch: 8 },
    props: [{ type: 'dumbbell', hand: 'L' }],
    muscles: { primary: ['quads', 'glutes', 'shoulders'], secondary: ['core', 'obliques', 'triceps', 'upperBack'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      stand: overhead(RL.stand, [0.17, 1.89, -0.03]),
      swingR: overhead(RL.swingR, [0.17, 1.86, -0.09]),
      touchR: overhead(RL.touchR, [0.17, 1.76, -0.27]),
      bottomR: overhead(RL.bottomR, [0.17, 1.51, -0.36]),
      swingL: overhead(RL.swingL, [0.17, 1.86, -0.09]),
      touchL: overhead(RL.touchL, [0.17, 1.76, -0.27]),
      bottomL: overhead(RL.bottomL, [0.17, 1.51, -0.36]),
    },
    seq: RL_SEQ,
    tempo: RL_TEMPO.map(t => t * 1.15),
    holds: RL_HOLDS,
  },

  walkingLunge: {
    camera: { yaw: 75, pitch: 8 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'calves', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
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
    seq: ['stand', 'swingL', 'touchL', 'bottomL', 'passR', 'touchR', 'bottomR', 'passL', 'finish'],
    tempo: [0.45, 0.4, 0.9, 0.8, 0.5, 0.9, 0.8, 0.45, 0.02],
    holds: { swingL: 0, touchL: 0, touchR: 0, passR: 0, passL: 0, bottomL: 0.25, bottomR: 0.25, finish: 0.5, stand: 0.4 },
  },

  lateralLunge: {
    camera: { yaw: 20, pitch: 10 },
    muscles: { primary: ['quads', 'glutes', 'adductors'], secondary: ['hamstrings', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: LAT,
    seq: ['stand', 'stepL', 'sitL', 'stepL', 'stand', 'stepR', 'sitR', 'stepR'],
    tempo: [0.45, 1.0, 0.8, 0.45, 0.45, 1.0, 0.8, 0.45],
    holds: { stepL: 0, stepR: 0, sitL: 0.3, sitR: 0.3, stand: 0.35 },
  },

  curtsyLunge: {
    camera: { yaw: 30, pitch: 10 },
    muscles: { primary: ['glutes', 'quads'], secondary: ['adductors', 'hamstrings', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: CUR,
    seq: ['stand', 'swingR', 'bottomR', 'swingR', 'stand', 'swingL', 'bottomL', 'swingL'],
    tempo: [0.5, 1.0, 0.8, 0.45, 0.5, 1.0, 0.8, 0.45],
    holds: { swingR: 0, swingL: 0, bottomR: 0.3, bottomL: 0.3, stand: 0.35 },
  },

  cossackSquat: {
    camera: { yaw: 15, pitch: 10 },
    muscles: { primary: ['adductors', 'quads', 'glutes'], secondary: ['hamstrings', 'calves', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: COS,
    seq: ['wide', 'left', 'wide', 'right'],
    tempo: [1.6, 1.2, 1.6, 1.2],
    holds: { left: 0.4, right: 0.4, wide: 0.35 },
  },
};
