/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, anti-movement core, side planks, crawls: see js/moves/README.md.
*/

// ---------------------------------------------------------- helpers
const r3 = (v) => Math.round(v * 1000) / 1000;
const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => r3(v + (b[i] - v) * t)) : r3(a + (b - a) * t));
const flipX = (v) => [-v[0], v[1], v[2]];

// ---------------------------------------------------------- planks
// Feet on the toes, legs straight behind, shared by every plank so the feet
// never slide between the forearm and the hand positions.
const PLANK_FEET = { L: { foot: [0.09, 0.12, -1.26], knee: 'down', ankle: 0 }, R: 'mirror' };
const WIDE_FEET = { L: { foot: [0.15, 0.12, -1.25], knee: 'down', ankle: 0 }, R: 'mirror' };
// forearm plank: elbows under the shoulders, forearms flat, hands forward
const FOREARM = { hand: [0.14, 0.03, 0.28], elbow: [0, -1, -0.5], palm: 'floor' };
const FOREARM_P = { pos: [0, 0.24, -0.409], pitch: 82 };
// high plank: hands under the shoulders, arms straight
const PALM = { hand: [0.2, 0.03, -0.03], elbow: [0.5, 0, -1], palm: 'floor' };
const HIGH_P = { pos: [0, 0.405, -0.447], pitch: 71 };
const mirrorArm = (a) => ({ ...a, hand: flipX(a.hand), elbow: Array.isArray(a.elbow) ? flipX(a.elbow) : a.elbow });

// ---------------------------------------------------------- side plank
// On the right forearm, facing +Z, head to -X: elbow under the shoulder,
// feet stacked. roll - lowers the right side (the engine's roll + tips the
// body onto its left side).
const SIDE_ELBOW = { hand: [-0.46, 0.03, 0.26], elbow: [0, -1, -0.3], palm: 'floor' };
const SIDE_FEET = {
  L: { foot: [0.827, 0.133, 0], knee: 'fwd', ankle: 0 },
  R: { foot: [0.797, 0.048, 0], knee: 'fwd', ankle: 0 },
};
const TOP_ARM_UP = { shoulder: { elev: 111, plane: 90 } };

// ---------------------------------------------------------- all fours
// Hands under the shoulders, knees under the hips.
const QUAD_HAND = { hand: [0.19, 0.03, -0.02], elbow: [0.4, 0, -1], palm: 'floor' };


// ---------------------------------------------------------- crawls
// Opposite hand and foot step together. `hand` and `foot` give each limb's
// planted spot; a lift pose carries the moving pair halfway, off the floor.
function gait(base, steps) {
  const keys = {}, seq = [];
  let st = { hL: base.hand.slice(), hR: flipX(base.hand), fL: base.foot.slice(), fR: flipX(base.foot), p: base.pelvis.pos.slice() };
  const pose = (s, label, liftH, liftF) => ({
    label,
    pelvis: { ...base.pelvis, pos: s.p },
    spine: base.spine, neck: base.neck,
    legs: {
      L: { ...base.leg, foot: s.fL.map((v, i) => (i === 1 ? r3(v + (liftF === 'L' ? base.footLift : 0)) : v)) },
      R: { ...base.leg, foot: s.fR.map((v, i) => (i === 1 ? r3(v + (liftF === 'R' ? base.footLift : 0)) : v)),
        knee: Array.isArray(base.leg.knee) ? flipX(base.leg.knee) : base.leg.knee },
    },
    arms: {
      L: { ...base.arm, hand: s.hL.map((v, i) => (i === 1 ? r3(v + (liftH === 'L' ? base.handLift : 0)) : v)) },
      R: { ...base.arm, hand: s.hR.map((v, i) => (i === 1 ? r3(v + (liftH === 'R' ? base.handLift : 0)) : v)),
        elbow: Array.isArray(base.arm.elbow) ? flipX(base.arm.elbow) : base.arm.elbow },
    },
  });
  keys.k0 = pose(st, base.label);
  seq.push('k0');
  steps.forEach(([hand, foot, d, label], i) => {
    const next = { ...st };
    next[`h${hand}`] = st[`h${hand}`].map((v, j) => r3(v + d[j]));
    next[`f${foot}`] = st[`f${foot}`].map((v, j) => r3(v + d[j]));
    next.p = st.p.map((v, j) => r3(v + d[j] / 2));
    const mid = {
      ...st, [`h${hand}`]: mix(st[`h${hand}`], next[`h${hand}`], 0.5), [`f${foot}`]: mix(st[`f${foot}`], next[`f${foot}`], 0.5),
      p: mix(st.p, next.p, 0.5),
    };
    keys[`l${i}`] = pose(mid, null, hand, foot);
    delete keys[`l${i}`].label;
    keys[`k${i + 1}`] = pose(next, label);
    if (!label) delete keys[`k${i + 1}`].label;
    seq.push(`l${i}`, `k${i + 1}`);
    st = next;
  });
  // the last planted pose matches the first: drop it so the loop closes
  const last = seq.pop();
  delete keys[last];
  return { keys, seq };
}

const CRAB = {
  label: 'Hips up',
  pelvis: { pos: [0, 0.4, 0], pitch: -66 },
  neck: { flex: 18 },
  leg: { knee: [0.2, 1, 0.6] }, foot: [0.15, 0.07, 0.42], footLift: 0.07,
  arm: { elbow: [0, 0, -1], palm: 'floor' }, hand: [0.2, 0.03, -0.42], handLift: 0.07,
};
const CRAB_STEP = 0.15;
const crab = gait(CRAB, [
  ['R', 'L', [0, 0, CRAB_STEP], 'Step forward'], ['L', 'R', [0, 0, CRAB_STEP]],
  ['R', 'L', [0, 0, CRAB_STEP]], ['L', 'R', [0, 0, CRAB_STEP]],
  ['R', 'L', [0, 0, -CRAB_STEP], 'Step back'], ['L', 'R', [0, 0, -CRAB_STEP]],
  ['R', 'L', [0, 0, -CRAB_STEP]], ['L', 'R', [0, 0, -CRAB_STEP]],
]);

const BEAR = {
  label: 'Bear position',
  pelvis: { pos: [0, 0.51, -0.46], pitch: 86 },
  leg: { knee: 'down', ankle: 0 }, foot: [0.1, 0.13, -0.886], footLift: 0.05,
  arm: QUAD_HAND_ARM(), hand: [0.19, 0.03, -0.02], handLift: 0.07,
};
function QUAD_HAND_ARM() { return { elbow: [0.4, 0, -1], palm: 'floor' }; }
const BEAR_STEP = 0.16;
const bearFwd = gait(BEAR, [
  ['R', 'L', [0, 0, BEAR_STEP], 'Crawl forward'], ['L', 'R', [0, 0, BEAR_STEP]],
  ['R', 'L', [0, 0, BEAR_STEP]], ['L', 'R', [0, 0, BEAR_STEP]],
  ['R', 'L', [0, 0, -BEAR_STEP], 'Crawl back'], ['L', 'R', [0, 0, -BEAR_STEP]],
  ['R', 'L', [0, 0, -BEAR_STEP]], ['L', 'R', [0, 0, -BEAR_STEP]],
]);
const bearSide = gait(BEAR, [
  ['R', 'L', [-BEAR_STEP, 0, 0], 'Crawl right'], ['L', 'R', [-BEAR_STEP, 0, 0]],
  ['R', 'L', [-BEAR_STEP, 0, 0]], ['L', 'R', [-BEAR_STEP, 0, 0]],
  ['L', 'R', [BEAR_STEP, 0, 0], 'Crawl left'], ['R', 'L', [BEAR_STEP, 0, 0]],
  ['L', 'R', [BEAR_STEP, 0, 0]], ['R', 'L', [BEAR_STEP, 0, 0]],
]);

export default {
  plank: {
    camera: { yaw: 60, pitch: 12 },
    keys: {
      hold: { label: 'Forearm plank', pelvis: FOREARM_P, legs: PLANK_FEET, arms: { L: FOREARM, R: 'mirror' } },
      breathe: { label: 'Breathe', pelvis: { pos: [0, 0.244, -0.409], pitch: 81.8 }, legs: PLANK_FEET,
        arms: { L: FOREARM, R: 'mirror' } },
    },
    seq: ['hold', 'breathe'],
    tempo: [2, 2],
    holds: { hold: 0.6, breathe: 0.6 },
  },

  plankShoulderTaps: {
    camera: { yaw: 35, pitch: 14 },
    keys: {
      plank: { label: 'High plank', pelvis: HIGH_P, legs: WIDE_FEET, arms: { L: PALM, R: 'mirror' } },
      tapR: { label: 'Right tap', pelvis: { ...HIGH_P, pos: [0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { L: PALM, R: { hand: [0.08, 0.48, 0.02], elbow: [-0.3, -1, 0.2] } } },
      tapL: { label: 'Left tap', pelvis: { ...HIGH_P, pos: [-0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { R: mirrorArm(PALM), L: { hand: [-0.08, 0.48, 0.02], elbow: [0.3, -1, 0.2] } } },
    },
    seq: ['plank', 'tapR', 'plank', 'tapL'],
    tempo: [0.6, 0.6, 0.6, 0.6],
    holds: { plank: 0.2, tapR: 0.25, tapL: 0.25 },
  },

  plankReach: {
    camera: { yaw: 35, pitch: 14 },
    keys: {
      plank: { label: 'High plank', pelvis: HIGH_P, legs: WIDE_FEET, arms: { L: PALM, R: 'mirror' } },
      reachR: { label: 'Right reach', pelvis: { ...HIGH_P, pos: [0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { L: PALM, R: { hand: [-0.18, 0.62, 0.49], elbow: [0, -1, 0] } } },
      reachL: { label: 'Left reach', pelvis: { ...HIGH_P, pos: [-0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { R: mirrorArm(PALM), L: { hand: [0.18, 0.62, 0.49], elbow: [0, -1, 0] } } },
    },
    seq: ['plank', 'reachR', 'plank', 'reachL'],
    tempo: [0.9, 0.9, 0.9, 0.9],
    holds: { plank: 0.3, reachR: 0.6, reachL: 0.6 },
  },

  plankUpDown: {
    camera: { yaw: 50, pitch: 12 },
    keys: {
      fore: { label: 'Forearms', pelvis: FOREARM_P, legs: PLANK_FEET, arms: { L: FOREARM, R: 'mirror' } },
      halfR: { label: 'One hand', pelvis: { pos: [-0.02, 0.3, -0.43], pitch: 77, roll: 8 }, spine: { twist: -26 },
        legs: PLANK_FEET, arms: { L: FOREARM, R: mirrorArm(PALM) } },
      high: { label: 'Hands', pelvis: HIGH_P, legs: PLANK_FEET, arms: { L: PALM, R: 'mirror' } },
      halfL: { label: 'One hand', pelvis: { pos: [0.02, 0.3, -0.43], pitch: 77, roll: -8 }, spine: { twist: 26 },
        legs: PLANK_FEET, arms: { R: mirrorArm(FOREARM), L: PALM } },
    },
    seq: ['fore', 'halfR', 'high', 'halfL', 'fore', 'halfL', 'high', 'halfR'],
    tempo: 0.7,
    holds: { fore: 0.3, high: 0.3, halfR: 0.1, halfL: 0.1 },
  },

  plankJack: {
    camera: { yaw: 30, pitch: 14 },
    keys: {
      in: { label: 'Feet together', pelvis: HIGH_P, legs: { L: { foot: [0.06, 0.12, -1.26], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
      air: { pelvis: { ...HIGH_P, pos: [0, 0.425, -0.447] }, legs: { L: { foot: [0.19, 0.19, -1.24], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
      out: { label: 'Feet wide', pelvis: HIGH_P, legs: { L: { foot: [0.32, 0.12, -1.22], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
    },
    seq: ['in', 'air', 'out', 'air'],
    tempo: 0.18,
    holds: { in: 0.08, out: 0.08, air: 0 },
  },

  bearHold: {
    camera: { yaw: 70, pitch: 10 },
    keys: {
      kneel: { label: 'All fours', pelvis: { pos: [0, 0.48, -0.46], pitch: 84 },
        legs: { L: { foot: [0.1, 0.13, -0.886], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
      hover: { label: 'Knees hover', pelvis: { pos: [0, 0.51, -0.46], pitch: 86 },
        legs: { L: { foot: [0.1, 0.13, -0.886], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
    },
    seq: ['kneel', 'hover'],
    tempo: [0.8, 0.8],
    holds: { kneel: 0.6, hover: 3 },
  },

  hollow: {
    camera: { yaw: 80, pitch: 8 },
    keys: {
      hold: { label: 'Hollow hold', pelvis: { pos: [0, 'auto', 0], pitch: -82 }, spine: { flex: 20 }, neck: { flex: 12 },
        legs: { L: { hip: { flex: 30, abd: -2 }, knee: 0, ankle: -20 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 172, plane: 4 }, elbow: 0 }, R: 'mirror' } },
      back: { label: 'Rock back', pelvis: { pos: [0, 'auto', 0.05], pitch: -94 }, spine: { flex: 20 }, neck: { flex: 12 },
        legs: { L: { hip: { flex: 30, abd: -2 }, knee: 0, ankle: -20 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 172, plane: 4 }, elbow: 0 }, R: 'mirror' } },
      fwd: { label: 'Rock forward', pelvis: { pos: [0, 'auto', -0.05], pitch: -72 }, spine: { flex: 20 }, neck: { flex: 12 },
        legs: { L: { hip: { flex: 30, abd: -2 }, knee: 0, ankle: -20 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 172, plane: 4 }, elbow: 0 }, R: 'mirror' } },
    },
    seq: ['hold', 'back', 'fwd', 'back', 'fwd'],
    tempo: [0.6, 0.7, 0.7, 0.7, 0.6],
    holds: { hold: 2.5, back: 0, fwd: 0 },
  },

  deadBug: {
    camera: { yaw: 70, pitch: 14 },
    keys: {
      top: { label: 'Arms up, knees up', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { L: { hip: { flex: 90 }, knee: 90, ankle: 0 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 90, plane: 0 } }, R: 'mirror' } },
      extR: { label: 'Left arm, right leg', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { L: { hip: { flex: 90 }, knee: 90, ankle: 0 }, R: { hip: { flex: 10 }, knee: 4, ankle: 0 } },
        arms: { R: { shoulder: { elev: 90, plane: 0 } }, L: { shoulder: { elev: 170, plane: 0 } } } },
      extL: { label: 'Right arm, left leg', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { R: { hip: { flex: 90 }, knee: 90, ankle: 0 }, L: { hip: { flex: 10 }, knee: 4, ankle: 0 } },
        arms: { L: { shoulder: { elev: 90, plane: 0 } }, R: { shoulder: { elev: 170, plane: 0 } } } },
    },
    seq: ['top', 'extR', 'top', 'extL'],
    tempo: [1.6, 1.2, 1.6, 1.2],
    holds: { top: 0.3, extR: 0.4, extL: 0.4 },
  },

  birdDog: {
    camera: { yaw: 60, pitch: 12 },
    keys: {
      quad: { label: 'All fours', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { L: { foot: [0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
      reachL: { label: 'Left arm, right leg', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { L: { foot: [0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, R: { hip: { flex: -8 }, knee: 0, ankle: 0 } },
        arms: { R: mirrorArm(QUAD_HAND), L: { shoulder: { elev: 172, plane: 0 }, elbow: 0 } } },
      reachR: { label: 'Right arm, left leg', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { R: { foot: [-0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, L: { hip: { flex: -8 }, knee: 0, ankle: 0 } },
        arms: { L: QUAD_HAND, R: { shoulder: { elev: 172, plane: 0 }, elbow: 0 } } },
    },
    seq: ['quad', 'reachL', 'quad', 'reachR'],
    tempo: [1.3, 1.1, 1.3, 1.1],
    holds: { quad: 0.3, reachL: 1, reachR: 1 },
  },

  sidePlankHold: {
    camera: { yaw: 20, pitch: 8 },
    keys: {
      hold: { label: 'Side plank', pelvis: { pos: [0, 0.37, 0], roll: -71 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
      breathe: { label: 'Breathe', pelvis: { pos: [0, 0.375, 0], roll: -71.3 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
    },
    seq: ['hold', 'breathe'],
    tempo: [2, 2],
    holds: { hold: 0.6, breathe: 0.6 },
  },

  sideBridge: {
    camera: { yaw: 20, pitch: 8 },
    keys: {
      up: { label: 'Hips high', pelvis: { pos: [0, 0.37, 0], roll: -71 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
      dip: { label: 'Dip', pelvis: { pos: [-0.01, 0.24, 0], roll: -70 }, spine: { side: 22 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
    },
    seq: ['up', 'dip'],
    tempo: [1.2, 0.9],
    holds: { up: 0.5, dip: 0.15 },
  },

  crabWalk: {
    camera: { yaw: 70, pitch: 12 },
    keys: crab.keys,
    seq: crab.seq,
    tempo: 0.32,
    holds: Object.fromEntries(crab.seq.map((k) => [k, 0])),
  },

  bearCrawl: {
    camera: { yaw: 70, pitch: 12 },
    keys: bearFwd.keys,
    seq: bearFwd.seq,
    tempo: 0.3,
    holds: Object.fromEntries(bearFwd.seq.map((k) => [k, 0])),
  },

  bearCrawlLateral: {
    camera: { yaw: 20, pitch: 14 },
    keys: bearSide.keys,
    seq: bearSide.seq,
    tempo: 0.3,
    holds: Object.fromEntries(bearSide.seq.map((k) => [k, 0])),
  },
};
