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
};
