/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, pulling, arms and carries: see js/moves/README.md.
*/
const FEET = { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' };
const NOTES = { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' };
const DB2 = [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }];

// Walking on the spot for the carries: each foot lifts and sets down on its
// own mark (so nothing slides), the pelvis shifts a little over the standing
// leg, and any free arm swings against the opposite leg. `arms(phase)` gives
// the arms for 'L' (left foot up), 'R' (right foot up) and 'both'.
function walk(arms, extra = {}) {
  const foot = (x) => ({ foot: [x, 0.07, 0], toeOut: 6 });
  const lift = (x) => ({ foot: [x, 0.19, -0.04], knee: 'fwd', toeOut: 6, ankle: -8 });
  return {
    both: { label: 'Step', ...extra, pelvis: { pos: [0, 0.925, 0] },
      legs: { L: foot(0.11), R: foot(-0.11) }, arms: arms('both') },
    liftL: { label: 'Left step', ...extra, pelvis: { pos: [-0.025, 0.93, 0.005] },
      legs: { L: lift(0.11), R: foot(-0.11) }, arms: arms('L') },
    liftR: { label: 'Right step', ...extra, pelvis: { pos: [0.025, 0.93, 0.005] },
      legs: { L: foot(0.11), R: lift(-0.11) }, arms: arms('R') },
  };
}
const WALK_SEQ = ['both', 'liftL', 'both', 'liftR'];
const WALK_TEMPO = 0.3;
const WALK_HOLDS = { both: 0, liftL: 0.02, liftR: 0.02 };
// a free arm swinging against the legs: forward when the other foot is up
const swing = (side, phase) => {
  if (phase === 'both') return { shoulder: { elev: 6, plane: 90 }, elbow: 12 };
  const fwd = (side === 'L') === (phase === 'R');
  return fwd ? { shoulder: { elev: 22, plane: 8 }, elbow: 22 } : { shoulder: { elev: 16, plane: 172 }, elbow: 8 };
};

export default {
  dbCurl: {
    camera: { yaw: 40 },
    props: DB2,
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET,
        arms: { L: { shoulder: { elev: 4, plane: 0 }, elbow: 8 }, R: 'mirror' } },
      up: { label: 'Squeeze', legs: FEET,
        arms: { L: { shoulder: { elev: 10, plane: 0 }, elbow: 138 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 2.0], holds: { up: 0.35, down: 0.3 },
  },
  barbellCurl: {
    camera: { yaw: 40 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET,
        arms: { L: { shoulder: { elev: 12, plane: 20 }, elbow: 8 }, R: 'mirror' } },
      up: { label: 'Squeeze', legs: FEET,
        arms: { L: { shoulder: { elev: 12, plane: 12 }, elbow: 138 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 2.0], holds: { up: 0.35, down: 0.3 },
  },
  dbShrug: {
    camera: { yaw: 20 },
    props: DB2,
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET,
        arms: { L: { shoulder: { elev: 7, plane: 90 }, elbow: 4 }, R: 'mirror' } },
      up: { label: 'Shoulders up', legs: FEET, neck: { flex: 8 },
        arms: { L: { shoulder: { elev: 7, plane: 90 }, elbow: 2 }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [0.8, 1.4], holds: { up: 0.8, down: 0.3 },
  },
  dbUprightRow: {
    camera: { yaw: 30 },
    props: DB2,
    coaching: NOTES,
    keys: {
      down: { label: 'Arms long', legs: FEET, arms: { L: { hand: [0.12, 0.84, 0.09], elbow: [1, 0, 0] }, R: 'mirror' } },
      up: { label: 'Elbows high', legs: FEET, arms: { L: { hand: [0.12, 1.22, 0.1], elbow: [1, 0.5, 0] }, R: 'mirror' } },
    },
    seq: ['down', 'up'], tempo: [1.0, 1.8], holds: { up: 0.3, down: 0.3 },
  },
  kbRackHold: {
    camera: { yaw: 30 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      a: { label: 'Breathe in', legs: FEET, spine: { flex: -1.5 },
        arms: { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: { hand: [-0.1, 1.18, 0.15], elbow: [-0.05, -1, 0.35], wrist: 65 } } },
      b: { label: 'Breathe out', legs: FEET, spine: { flex: 0.5 },
        arms: { L: { shoulder: { elev: 5, plane: 90 }, elbow: 10 }, R: { hand: [-0.1, 1.175, 0.15], elbow: [-0.05, -1, 0.35], wrist: 65 } } },
    },
    seq: ['a', 'b'], tempo: [1.8, 2.2], holds: { a: 0.3, b: 0.4 },
  },
  kbSuitcaseHold: {
    camera: { yaw: 20 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      a: { label: 'Breathe in', legs: FEET, spine: { flex: -1.5 },
        arms: { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: { shoulder: { elev: 11, plane: 90 }, elbow: 2 } } },
      b: { label: 'Breathe out', legs: FEET, spine: { flex: 0.5 },
        arms: { L: { shoulder: { elev: 5, plane: 90 }, elbow: 10 }, R: { shoulder: { elev: 11, plane: 90 }, elbow: 2 } } },
    },
    seq: ['a', 'b'], tempo: [1.8, 2.2], holds: { a: 0.3, b: 0.4 },
  },
  barbellRow: {
    camera: { yaw: 60 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    coaching: NOTES,
    keys: {
      hang: { label: 'Arms long', pelvis: { pos: [0, 0.86, -0.2], pitch: 52 }, neck: { flex: -16 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.23, 0.63, 0.12], elbow: 'back' }, R: 'mirror' } },
      top: { label: 'Bar to belly', pelvis: { pos: [0, 0.86, -0.2], pitch: 52 }, neck: { flex: -16 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.23, 0.95, 0.06], elbow: [0.25, 0.6, -1] }, R: 'mirror' } },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.6], holds: { top: 0.4, hang: 0.3 },
  },
  dbRow: {
    camera: { yaw: 60 },
    props: DB2,
    coaching: NOTES,
    keys: {
      hang: { label: 'Arms long', pelvis: { pos: [0, 0.86, -0.2], pitch: 52 }, neck: { flex: -16 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.2, 0.63, 0.12], elbow: 'back' }, R: 'mirror' } },
      top: { label: 'Squeeze', pelvis: { pos: [0, 0.86, -0.2], pitch: 52 }, neck: { flex: -16 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.21, 0.96, 0.0], elbow: [0.15, 0.6, -1] }, R: 'mirror' } },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.6], holds: { top: 0.4, hang: 0.3 },
  },
  kbRow: {
    camera: { yaw: 60 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    coaching: NOTES,
    keys: {
      hang: { label: 'Arm long', pelvis: { pos: [0, 0.84, -0.2], pitch: 55 }, neck: { flex: -16 },
        legs: { L: { foot: [0.14, 0.07, 0.14], toeOut: 6, knee: [0.1, 0, 1] }, R: { foot: [-0.14, 0.07, -0.34], toeOut: 12, knee: [-0.1, 0, 1] } },
        arms: { L: { hand: [0.14, 0.62, 0.12], elbow: [1, 0, -0.3] }, R: { hand: [-0.2, 0.62, 0.14], elbow: 'back' } } },
      top: { label: 'Elbow to hip', pelvis: { pos: [0, 0.84, -0.2], pitch: 55 }, neck: { flex: -16 },
        legs: { L: { foot: [0.14, 0.07, 0.14], toeOut: 6, knee: [0.1, 0, 1] }, R: { foot: [-0.14, 0.07, -0.34], toeOut: 12, knee: [-0.1, 0, 1] } },
        arms: { L: { hand: [0.14, 0.62, 0.12], elbow: [1, 0, -0.3] }, R: { hand: [-0.21, 0.9, -0.04], elbow: [-0.1, 0.5, -1] } } },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.6], holds: { top: 0.4, hang: 0.3 },
  },
  dbRowSingle: {
    camera: { yaw: 60 },
    props: [{ type: 'dumbbell', hand: 'R' }, { type: 'bench', pos: [0.28, 0, 0.8], size: [0.35, 0.45, 1.2] }],
    coaching: NOTES,
    keys: {
      hang: { label: 'Long arm', pelvis: { pos: [0, 0.82, -0.2], pitch: 72 }, neck: { flex: -10 },
        legs: { L: { foot: [0.15, 0.07, 0.05], toeOut: 6, knee: [0.1, 0, 1] }, R: { foot: [-0.15, 0.07, -0.4], toeOut: 12, knee: [-0.1, 0, 1] } },
        arms: { L: { hand: [0.24, 0.48, 0.3], elbow: 'back', palm: 'floor' }, R: { hand: [-0.2, 0.46, 0.25], elbow: 'back' } } },
      top: { label: 'Elbow to hip', pelvis: { pos: [0, 0.82, -0.2], pitch: 72 }, neck: { flex: -10 },
        legs: { L: { foot: [0.15, 0.07, 0.05], toeOut: 6, knee: [0.1, 0, 1] }, R: { foot: [-0.15, 0.07, -0.4], toeOut: 12, knee: [-0.1, 0, 1] } },
        arms: { L: { hand: [0.24, 0.48, 0.3], elbow: 'back', palm: 'floor' }, R: { hand: [-0.21, 0.8, -0.05], elbow: [-0.1, 0.6, -1] } } },
    },
    seq: ['hang', 'top'], tempo: [1.1, 1.8], holds: { top: 0.4, hang: 0.3 },
  },
  dbRearDeltFly: {
    camera: { yaw: 30, pitch: 14 },
    props: DB2,
    coaching: NOTES,
    keys: {
      hang: { label: 'Arms hang', pelvis: { pos: [0, 0.85, -0.2], pitch: 62 }, neck: { flex: -14 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 62, plane: 8, twist: -90 }, elbow: 20 }, R: 'mirror' } },
      top: { label: 'Arms wide', pelvis: { pos: [0, 0.85, -0.2], pitch: 62 }, neck: { flex: -14 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 88, plane: 88, twist: -90 }, elbow: 20 }, R: 'mirror' } },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.8], holds: { top: 0.4, hang: 0.3 },
  },
  renegadeRow: {
    camera: { yaw: 50, pitch: 14 },
    props: DB2,
    coaching: NOTES,
    keys: {
      plank: { label: 'Plank', pelvis: { pos: [0, 0.47, -0.45], pitch: 67 }, neck: { flex: 8 },
        legs: { L: { foot: [0.2, 0.122, -1.22], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.2, 0.13, -0.03], elbow: 'back' }, R: 'mirror' } },
      rowR: { label: 'Row right', pelvis: { pos: [0.02, 0.47, -0.45], pitch: 67 }, neck: { flex: 8 },
        legs: { L: { foot: [0.2, 0.122, -1.22], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.2, 0.13, -0.03], elbow: 'back' }, R: { hand: [-0.2, 0.5, -0.3], elbow: [-0.2, 1, -0.6] } } },
      rowL: { label: 'Row left', pelvis: { pos: [-0.02, 0.47, -0.45], pitch: 67 }, neck: { flex: 8 },
        legs: { L: { foot: [0.2, 0.122, -1.22], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { R: { hand: [-0.2, 0.13, -0.03], elbow: 'back' }, L: { hand: [0.2, 0.5, -0.3], elbow: [0.2, 1, -0.6] } } },
    },
    seq: ['plank', 'rowR', 'plank', 'rowL'], tempo: [1.0, 1.3, 1.0, 1.3], holds: { rowR: 0.3, rowL: 0.3, plank: 0.3 },
  },
  superman: {
    camera: { yaw: 60, pitch: 16 },
    coaching: NOTES,
    keys: {
      down: { label: 'Face down', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, neck: { flex: 10 },
        legs: { L: { hip: { flex: 0, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 170, plane: 12 }, elbow: 5 }, R: 'mirror' } },
      lift: { label: 'Lift', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -22 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: -14, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 170, plane: 12 }, elbow: 5 }, R: 'mirror' } },
      pull: { label: 'Elbows back', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -23 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: -14, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 55, plane: 115, twist: -38 }, elbow: 100 }, R: 'mirror' } },
      sweep: { label: 'Sweep', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -23 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: -14, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 112, plane: 108, twist: -60 }, elbow: 30 }, R: 'mirror' } },
    },
    seq: ['down', 'lift', 'sweep', 'pull', 'sweep', 'lift'], tempo: [1.0, 0.7, 0.7, 0.7, 0.7, 1.0], holds: { lift: 0.4, sweep: 0, pull: 0.5, down: 0.4 },
  },
  supermanYtw: {
    camera: { yaw: 30, pitch: 30 },
    coaching: NOTES,
    keys: {
      Y: { label: 'Y', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -10 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: 0, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 145, plane: 102, twist: 90 }, elbow: 3 }, R: 'mirror' } },
      T: { label: 'T', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -10 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: 0, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 90, plane: 108, twist: 90 }, elbow: 3 }, R: 'mirror' } },
      W: { label: 'W', pelvis: { pos: [0, 'auto', 0], pitch: 90 }, spine: { flex: -10 }, neck: { flex: 8 },
        legs: { L: { hip: { flex: 0, abd: 4 }, knee: 0, ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 55, plane: 118, twist: -38 }, elbow: 100 }, R: 'mirror' } },
    },
    seq: ['Y', 'T', 'W'], tempo: [1.2, 1.2, 1.4], holds: { Y: 0.6, T: 0.6, W: 0.6 },
  },
  kbFarmersWalk: {
    camera: { yaw: 30 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    coaching: NOTES,
    keys: walk((ph) => ({ L: swing('L', ph), R: { shoulder: { elev: 11, plane: 90 }, elbow: 2 } })),
    seq: WALK_SEQ, tempo: WALK_TEMPO, holds: WALK_HOLDS,
  },
  farmersWalk: {
    camera: { yaw: 30 },
    props: [{ type: 'dumbbell', hand: 'R' }],
    coaching: NOTES,
    keys: walk((ph) => ({ L: swing('L', ph), R: { shoulder: { elev: 8, plane: 90 }, elbow: 2 } })),
    seq: WALK_SEQ, tempo: WALK_TEMPO, holds: WALK_HOLDS,
  },
  dbFarmersWalk: {
    camera: { yaw: 30 },
    props: DB2,
    coaching: NOTES,
    keys: walk(() => ({ L: { shoulder: { elev: 8, plane: 90 }, elbow: 2 }, R: 'mirror' })),
    seq: WALK_SEQ, tempo: WALK_TEMPO, holds: WALK_HOLDS,
  },
  dbOverheadCarry: {
    camera: { yaw: 30 },
    props: DB2,
    coaching: NOTES,
    keys: walk(() => ({ L: { hand: [0.22, 1.92, -0.02], elbow: 'out' }, R: 'mirror' })),
    seq: WALK_SEQ, tempo: WALK_TEMPO, holds: WALK_HOLDS,
  },
  kbHighPull: {
    camera: { yaw: 60 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    coaching: NOTES,
    keys: {
      hinge: { label: 'Hinge', pelvis: { pos: [0, 0.8, -0.2], pitch: 50 }, neck: { flex: -14 },
        legs: { L: { foot: [0.17, 0.07, 0.02], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.045, 0.575, 0.11], elbow: 'out' }, R: 'mirror' } },
      drive: { label: 'Hips through', pelvis: { pos: [0, 0.925, 0] }, neck: { flex: 0 },
        legs: { L: { foot: [0.17, 0.07, 0.02], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.065, 0.88, 0.15], elbow: 'out' }, R: 'mirror' } },
      pull: { label: 'Elbows high', pelvis: { pos: [0, 0.93, 0] }, spine: { flex: -2 },
        legs: { L: { foot: [0.17, 0.07, 0.02], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.09, 1.2, 0.2], elbow: [1, 0.8, -0.3] }, R: 'mirror' } },
    },
    seq: ['hinge', 'drive', 'pull', 'drive'], tempo: [0.5, 0.35, 0.55, 0.6], holds: { hinge: 0.25, drive: 0, pull: 0.2 },
  },
  ringHang: {
    camera: { yaw: 40, pitch: 4 },
    props: [{ type: 'rings', top: 2.9 }],
    coaching: NOTES,
    keys: {
      a: { label: 'Hang', pelvis: { pos: [0, 1.35, 0.035], pitch: -2 },
        legs: { L: { hip: { flex: 6 }, knee: 8, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 2.35, 0], elbow: 'out' }, R: 'mirror' } },
      b: { label: 'Breathe', pelvis: { pos: [0, 1.355, 0.035], pitch: -2 }, spine: { flex: -1.5 },
        legs: { L: { hip: { flex: 7 }, knee: 9, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 2.35, 0], elbow: 'out' }, R: 'mirror' } },
    },
    seq: ['a', 'b'], tempo: [1.8, 2.2], holds: { a: 0.3, b: 0.4 },
  },
  ringChinup: {
    camera: { yaw: 50, pitch: 4 },
    props: [{ type: 'rings', top: 2.9 }],
    coaching: NOTES,
    keys: {
      hang: { label: 'Long arms', pelvis: { pos: [0, 1.35, 0.035], pitch: -2 },
        legs: { L: { hip: { flex: 8 }, knee: 25, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 2.35, 0], elbow: [0.3, -0.3, 1] }, R: 'mirror' } },
      half: { label: 'Halfway', pelvis: { pos: [0, 1.6, 0.03], pitch: -6 },
        legs: { L: { hip: { flex: 10 }, knee: 28, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 2.35, 0], elbow: [0.15, -1, 0.8] }, R: 'mirror' } },
      top: { label: 'Chest to rings', pelvis: { pos: [0, 1.86, 0.03], pitch: -12 },
        legs: { L: { hip: { flex: 12 }, knee: 30, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 2.35, 0], elbow: [0.15, -1, 0.7] }, R: 'mirror' } },
    },
    seq: ['hang', 'half', 'top', 'half'], tempo: [0.6, 0.6, 1.0, 1.0], holds: { hang: 0.4, half: 0, top: 0.35 },
  },
  ringRow: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'rings', top: 2.4 }],
    coaching: NOTES,
    keys: {
      hang: { label: 'Arms long', pelvis: { pos: [0, 0.636, -0.051], pitch: -50 },
        legs: { L: { foot: [0.1, 0.09, 0.6], knee: [0, 1, 0.6], ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.22, 1.16, 0.06], elbow: 'down' }, R: 'mirror' } },
      top: { label: 'Chest to rings', pelvis: { pos: [0, 0.803, 0.137], pitch: -33 },
        legs: { L: { foot: [0.1, 0.09, 0.6], knee: [0, 1, 0.8], ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.22, 1.16, 0.06], elbow: [0.4, -0.6, -0.8] }, R: 'mirror' } },
    },
    seq: ['hang', 'top'], tempo: [1.0, 1.6], holds: { top: 0.4, hang: 0.3 },
  },
};