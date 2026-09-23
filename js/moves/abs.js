/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data: see js/moves/README.md.
*/
const LIE = -90;
const LY = 0.13;
const HANDS_HEAD = { L: { shoulder: { elev: 140, plane: 105, twist: 0 }, elbow: 130 }, R: 'mirror' };
const ARMS_SIDE = { L: { shoulder: { elev: 18, plane: 108 }, elbow: 4, palm: 'floor' }, R: 'mirror' };
const FEET_FLAT = { L: { foot: [0.13, 0.07, 0.5], knee: 'up', toeOut: 4 }, R: 'mirror' };

export default {
  crunch: {
    camera: { yaw: 70, pitch: 12 },
    keys: {
      down: {
        label: 'Down',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        legs: FEET_FLAT,
        arms: HANDS_HEAD,
      },
      up: {
        label: 'Curl up',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        spine: { flex: 40 },
        neck: { flex: 10 },
        legs: FEET_FLAT,
        arms: HANDS_HEAD,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.0, 1.6],
  },
  reverseCrunch: {
    camera: { yaw: 70, pitch: 12 },
    keys: {
      table: {
        label: 'Tabletop',
        pelvis: { pos: [0, 'auto', 0], pitch: LIE },
        legs: { L: { hip: { flex: 90 }, knee: 90 }, R: 'mirror' },
        arms: ARMS_SIDE,
      },
      curl: {
        label: 'Hips curl',
        pelvis: { pos: [0, 'auto', -0.035], pitch: -125 },
        spine: { flex: 35 },
        legs: { L: { hip: { flex: 100 }, knee: 100 }, R: 'mirror' },
        arms: ARMS_SIDE,
      },
    },
    seq: ['table', 'curl'],
    tempo: [1.0, 1.8],
  },
  legRaise: {
    camera: { yaw: 70, pitch: 12 },
    keys: {
      down: {
        label: 'Down',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        legs: { L: { hip: { flex: 5 }, knee: 2 }, R: 'mirror' },
        arms: ARMS_SIDE,
      },
      up: {
        label: 'Up',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        legs: { L: { hip: { flex: 90 }, knee: 2 }, R: 'mirror' },
        arms: ARMS_SIDE,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.2, 2.4],
  },
  flutterKicks: {
    camera: { yaw: 70, pitch: 12 },
    keys: {
      a: {
        label: 'Kick',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        neck: { flex: 20 },
        legs: { L: { hip: { flex: 26 }, knee: 2 }, R: { hip: { flex: 8 }, knee: 2 } },
        arms: ARMS_SIDE,
      },
      b: {
        label: 'Switch',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        neck: { flex: 20 },
        legs: { L: { hip: { flex: 8 }, knee: 2 }, R: { hip: { flex: 26 }, knee: 2 } },
        arms: ARMS_SIDE,
      },
    },
    seq: ['a', 'b'],
    tempo: 0.4,
    holds: { a: 0, b: 0 },
  },
  vSit: {
    camera: { yaw: 70, pitch: 10 },
    keys: {
      open: {
        label: 'Lean back',
        pelvis: { pos: [0, 'auto', 0], pitch: -60 },
        spine: { flex: 5 },
        legs: { L: { hip: { flex: 60 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 70, plane: 20 }, elbow: 6 }, R: 'mirror' },
      },
      fold: {
        label: 'Fold',
        pelvis: { pos: [0, 'auto', 0], pitch: -45 },
        spine: { flex: 15 },
        legs: { L: { hip: { flex: 100 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 100, plane: 10 }, elbow: 4 }, R: 'mirror' },
      },
    },
    seq: ['open', 'fold'],
    tempo: [1.4, 1.4],
  },
  vUp: {
    camera: { yaw: 70, pitch: 10 },
    keys: {
      flat: {
        label: 'Long body',
        pelvis: { pos: [0, 'auto', 0], pitch: LIE },
        legs: { L: { hip: { flex: 4 }, knee: 2 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 170, plane: 20 }, elbow: 4 }, R: 'mirror' },
      },
      top: {
        label: 'Touch',
        pelvis: { pos: [0, 'auto', 0], pitch: -45 },
        spine: { flex: 20 },
        legs: { L: { hip: { flex: 100 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 95, plane: 5 }, elbow: 4 }, R: 'mirror' },
      },
    },
    seq: ['flat', 'top'],
    tempo: [0.9, 1.3],
  },
  tuckUp: {
    camera: { yaw: 70, pitch: 10 },
    keys: {
      long: {
        label: 'Long body',
        pelvis: { pos: [0, 'auto', 0], pitch: LIE },
        spine: { flex: 10 },
        legs: { L: { hip: { flex: 10 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 165, plane: 20 }, elbow: 6 }, R: 'mirror' },
      },
      tuck: {
        label: 'Tuck',
        pelvis: { pos: [0, 'auto', 0], pitch: -40 },
        spine: { flex: 10 },
        legs: { L: { hip: { flex: 125 }, knee: 125 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 75, plane: 25 }, elbow: 20 }, R: 'mirror' },
      },
    },
    seq: ['long', 'tuck'],
    tempo: [0.9, 1.2],
  },
  bicycleCrunch: {
    camera: { yaw: 40, pitch: 20 },
    keys: {
      left: {
        label: 'Right elbow, left knee',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        spine: { flex: 30, twist: 30 },
        legs: { L: { hip: { flex: 100 }, knee: 100 }, R: { hip: { flex: 30 }, knee: 10 } },
        arms: HANDS_HEAD,
      },
      right: {
        label: 'Left elbow, right knee',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        spine: { flex: 30, twist: -30 },
        legs: { R: { hip: { flex: 100 }, knee: 100 }, L: { hip: { flex: 30 }, knee: 10 } },
        arms: HANDS_HEAD,
      },
    },
    seq: ['left', 'right'],
    tempo: [1.0, 1.0],
  },
  russianTwist: {
    camera: { yaw: 20, pitch: 15 },
    keys: {
      mid: {
        label: 'Centre',
        pelvis: { pos: [0, 'auto', 0], pitch: -45 },
        spine: { flex: 10 },
        legs: { L: { hip: { flex: 110, abd: 6 }, knee: 90 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 60, plane: -20 }, elbow: 80 }, R: 'mirror' },
      },
      left: {
        label: 'Turn left',
        pelvis: { pos: [0, 'auto', 0], pitch: -45, yaw: 5 },
        spine: { flex: 10, twist: 40 },
        legs: { L: { hip: { flex: 110, abd: 6 }, knee: 90 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 60, plane: -20 }, elbow: 80 }, R: 'mirror' },
      },
      right: {
        label: 'Turn right',
        pelvis: { pos: [0, 'auto', 0], pitch: -45, yaw: -5 },
        spine: { flex: 10, twist: -40 },
        legs: { L: { hip: { flex: 110, abd: 6 }, knee: 90 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 60, plane: -20 }, elbow: 80 }, R: 'mirror' },
      },
    },
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: 0.7,
  },
};
