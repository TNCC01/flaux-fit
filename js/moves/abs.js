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
        arms: { L: { shoulder: { elev: 70, plane: 2 }, elbow: 6 }, R: 'mirror' },
      },
      fold: {
        label: 'Fold',
        pelvis: { pos: [0, 'auto', 0], pitch: -45 },
        spine: { flex: 15 },
        legs: { L: { hip: { flex: 100 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 100, plane: 0 }, elbow: 4 }, R: 'mirror' },
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
        arms: { L: { shoulder: { elev: 80, plane: 6 }, elbow: 10 }, R: 'mirror' },
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
        legs: { L: { hip: { flex: 95, abd: 6 }, knee: 100 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 35, plane: -25 }, elbow: 70 }, R: 'mirror' },
      },
      left: {
        label: 'Turn left',
        pelvis: { pos: [0, 'auto', 0], pitch: -45, yaw: 8 },
        spine: { flex: 10, twist: 50 },
        neck: { twist: 15 },
        legs: { L: { hip: { flex: 95, abd: 6 }, knee: 100 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 35, plane: -25 }, elbow: 70 }, R: 'mirror' },
      },
      right: {
        label: 'Turn right',
        pelvis: { pos: [0, 'auto', 0], pitch: -45, yaw: -8 },
        spine: { flex: 10, twist: -50 },
        neck: { twist: -15 },
        legs: { L: { hip: { flex: 95, abd: 6 }, knee: 100 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 35, plane: -25 }, elbow: 70 }, R: 'mirror' },
      },
    },
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: 0.7,
  },
  sidePlankThread: {
    camera: { yaw: 10, pitch: 12 },
    keys: {
      reach: {
        label: 'Reach up',
        pelvis: { pos: [0, 0.54, 0], roll: -60 },
        legs: { L: { foot: [0.68, 0.07, 0.14], knee: 'fwd', ankle: 0 }, R: { foot: [0.7, 0.055, -0.03], knee: 'fwd', ankle: 0 } },
        arms: { L: { shoulder: { elev: 118, plane: 90 }, elbow: 4 }, R: { hand: [-0.475, 0.03, -0.03], elbow: 'back', palm: 'floor' } },
      },
      thread: {
        label: 'Thread',
        pelvis: { pos: [0, 0.5, 0.08], roll: -60 },
        spine: { twist: -40, flex: 10 },
        legs: { L: { foot: [0.68, 0.07, 0.14], knee: 'fwd', ankle: 0 }, R: { foot: [0.7, 0.055, -0.03], knee: 'fwd', ankle: 0 } },
        arms: { L: { hand: [-0.3, 0.3, -0.15], elbow: 'up' }, R: { hand: [-0.475, 0.03, -0.03], elbow: 'back', palm: 'floor' } },
      },
    },
    seq: ['reach', 'thread'],
    tempo: 1.4,
  },
  crabReach: {
    camera: { yaw: 60, pitch: 10 },
    keys: {
      crab: {
        label: 'Crab',
        pelvis: { pos: [0, 0.36, 0], pitch: -60 },
        legs: { L: { foot: [0.15, 0.07, 0.4], knee: 'up' }, R: 'mirror' },
        arms: { L: { hand: [0.22, 0.03, -0.45], elbow: 'back', palm: 'floor' }, R: 'mirror' },
      },
      reachL: {
        label: 'Right hand, left toe',
        pelvis: { pos: [0, 0.5, 0], pitch: -75 },
        spine: { flex: 30, twist: 45 },
        legs: { R: { foot: [-0.15, 0.07, 0.4], knee: 'up' }, L: { hip: { flex: 115, abd: -8 }, knee: 10, ankle: -15 } },
        arms: { L: { hand: [0.22, 0.03, -0.45], elbow: 'back', palm: 'floor' }, R: { hand: [-0.03, 1.23, -0.13], elbow: 'out' } },
      },
      reachR: {
        label: 'Left hand, right toe',
        pelvis: { pos: [0, 0.5, 0], pitch: -75 },
        spine: { flex: 30, twist: -45 },
        legs: { L: { foot: [0.15, 0.07, 0.4], knee: 'up' }, R: { hip: { flex: 115, abd: -8 }, knee: 10, ankle: -15 } },
        arms: { R: { hand: [-0.22, 0.03, -0.45], elbow: 'back', palm: 'floor' }, L: { hand: [0.03, 1.23, -0.13], elbow: 'out' } },
      },
    },
    seq: ['crab', 'reachL', 'crab', 'reachR'],
    tempo: [0.8, 1.0, 0.8, 1.0],
    holds: { crab: 0.2, reachL: 0.3, reachR: 0.3 },
  },
  dbWoodchop: {
    camera: { yaw: 20, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }],
    keys: {
      low: {
        label: 'Low',
        pelvis: { pos: [0, 0.78, -0.06], pitch: 35, yaw: -25 },
        spine: { flex: 15, twist: -35 },
        legs: { L: { foot: [0.2, 0.07, 0], toeOut: 10, knee: [0.2, 0, 1] }, R: { foot: [-0.2, 0.07, 0], toeOut: 10, knee: [-0.4, 0, 1] } },
        arms: { L: { hand: [-0.26, 0.7, 0.23], elbow: 'out' }, R: { hand: [-0.31, 0.66, 0.19], elbow: 'out' } },
      },
      mid: {
        label: 'Through the middle',
        pelvis: { pos: [0, 0.88, -0.02], pitch: 10 },
        spine: { flex: 2 },
        legs: { L: { foot: [0.2, 0.07, 0], toeOut: 10, knee: [0.2, 0, 1] }, R: { foot: [-0.2, 0.07, 0], toeOut: 10, knee: [-0.2, 0, 1] } },
        arms: { L: { hand: [0.02, 1.08, 0.5], elbow: 'out' }, R: { hand: [-0.04, 1.06, 0.49], elbow: 'out' } },
      },
      high: {
        label: 'High',
        pelvis: { pos: [0, 0.92, 0], yaw: 25 },
        spine: { flex: -3, twist: 25 },
        legs: { L: { foot: [0.2, 0.07, 0], toeOut: 10 }, R: { foot: [-0.2, 0.07, 0], toeOut: -20, heel: 30, knee: [0.4, 0, 1] } },
        arms: { L: { hand: [0.4, 1.62, 0.22], elbow: 'down' }, R: { hand: [0.34, 1.6, 0.24], elbow: 'down' } },
      },
    },
    seq: ['low', 'mid', 'high', 'mid'],
    tempo: [0.5, 0.5, 0.8, 0.8],
    holds: { mid: 0, high: 0.3, low: 0.3 },
  },
  ringTuckHold: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'rings' }],
    keys: {
      support: {
        label: 'Support',
        pelvis: { pos: [0, 1.1, 0] },
        legs: { L: { hip: { flex: 5 }, knee: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.27, 1.0, 0.0], elbow: 'back' }, R: 'mirror' },
      },
      tuck: {
        label: 'Tuck hold',
        pelvis: { pos: [0, 1.1, 0], pitch: -15 },
        spine: { flex: 10 },
        legs: { L: { hip: { flex: 115 }, knee: 125 }, R: 'mirror' },
        arms: { L: { hand: [0.27, 1.0, 0.0], elbow: 'back' }, R: 'mirror' },
      },
    },
    seq: ['support', 'tuck'],
    tempo: [1, 1],
    holds: { tuck: 3 },
  },
};
