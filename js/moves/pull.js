/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, pulling, arms and carries: see js/moves/README.md.
*/
const FEET = { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' };
const NOTES = { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' };

export default {
  dbCurl: {
    camera: { yaw: 40 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET,
        arms: { L: { shoulder: { elev: 4, plane: 0 }, elbow: 8 }, R: 'mirror' } },
      up: { label: 'Top', legs: FEET,
        arms: { L: { shoulder: { elev: 12, plane: 0 }, elbow: 135 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 2.0],
  },
  t1: {
    camera: { yaw: 40 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      a: { legs: FEET, arms: { L: { shoulder: { elev: 3, plane: 90, twist: 90 }, elbow: 4 }, R: 'mirror' } },
      b: { legs: FEET, arms: { L: { shoulder: { elev: 3, plane: 90, twist: -90 }, elbow: 4 }, R: 'mirror' } },
    },
    seq: ['a', 'b'],
  },
  barbellCurl: {
    camera: { yaw: 40 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET,
        arms: { L: { shoulder: { elev: 12, plane: 25 }, elbow: 8 }, R: 'mirror' } },
      up: { label: 'Top', legs: FEET,
        arms: { L: { shoulder: { elev: 14, plane: 15 }, elbow: 135 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 2.0],
  },
  dbUprightRow: {
    camera: { yaw: 30 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET, arms: { L: { hand: [0.12, 0.84, 0.09], elbow: [1, 0, 0] }, R: 'mirror' } },
      up: { label: 'Elbows high', legs: FEET, arms: { L: { hand: [0.12, 1.22, 0.1], elbow: [1, 0.5, 0] }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 1.8],
  },
  kbRackHold: {
    camera: { yaw: 30 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      a: { label: 'Rack', legs: FEET, arms: { R: { hand: [-0.12, 1.3, 0.12], elbow: [-0.2, -1, 0.3], wrist: 0 } } },
      b: { label: 'Rack2', legs: FEET, arms: { R: { hand: [-0.12, 1.3, 0.12], elbow: [-0.2, -1, 0.3], wrist: -60 } } },
      c: { label: 'Rack3', legs: FEET, arms: { R: { hand: [-0.12, 1.3, 0.12], elbow: [-0.2, -1, 0.3], wrist: 60 } } },
    },
    seq: ['a', 'b', 'c'],
  },
};
