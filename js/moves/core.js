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

export default {
  t: {
    keys: {
      a: { pelvis: FOREARM_P, legs: PLANK_FEET, arms: { L: FOREARM, R: 'mirror' } },
      b: { pelvis: HIGH_P, legs: WIDE_FEET, arms: { L: PALM, R: mirrorArm(PALM) } },
    },
  },
};
