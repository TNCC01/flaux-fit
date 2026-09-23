/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, squat and lunge family: see js/moves/README.md.
*/
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };

// A point carried on the trunk: [x, up from the hip joints, forward], for a
// pelvis at `pos` tipped forward by `pitch` degrees. Used to put hands
// (clasped at the chest, a bell, a bar in the rack) where the chest is.
function onTrunk(pos, pitch, [x, up, fwd]) {
  const a = (pitch * Math.PI) / 180;
  const r = (v) => Math.round(v * 1000) / 1000;
  return [r(pos[0] + x), r(pos[1] + up * Math.cos(a) - fwd * Math.sin(a)), r(pos[2] + up * Math.sin(a) + fwd * Math.cos(a))];
}
// hands together in front of the breastbone
function clasp(pos, pitch) {
  return { L: { hand: onTrunk(pos, pitch, [0.045, 0.27, 0.25]), elbow: [0.6, -1, -0.2] }, R: 'mirror' };
}

// the squat stance shared by most of the family
const FOOT = [0.15, 0.07, 0.01];
const stance = (knee = [0.25, 0, 1], foot = FOOT, toeOut = 15) =>
  ({ L: { foot, toeOut, knee }, R: 'mirror' });
const STAND = stance();
const DEEP = stance([0.3, 0, 1]);

export default {
  bwSquat: {
    camera: { yaw: 40 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'core'] },
    coaching: {
      setup: [
        'Feet about shoulder-width apart, toes turned out 10 to 20 degrees.',
        'Weight spread across the whole foot: big toe, little toe and heel.',
        'Stand tall with the ribs stacked over the pelvis.',
      ],
      steps: [
        'Brace your trunk, then sit the hips back and down at the same time as the knees bend.',
        'Let the knees travel forward over the toes, tracking in line with the middle toes.',
        'Reach the arms forward as a counterbalance while you lower.',
        'Go as deep as you can while the back stays neutral: hip crease at or below the knee is the goal.',
        'Drive the floor away through the whole foot and stand up tall, squeezing the glutes at the top.',
      ],
      cues: ['Knees out over the toes', 'Chest proud, back flat', 'Whole foot on the floor'],
      mistakes: [
        'Knees caving in towards each other on the way up.',
        'Heels lifting, which puts the load on the toes and knees.',
        'Rounding the lower back at the bottom ("butt wink") from going deeper than your hips allow.',
        'Folding the chest to the floor so the squat turns into a good morning.',
      ],
      breathing: 'Breathe in and brace before you descend, breathe out as you stand.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        pelvis: { pos: [0, 0.93, 0] },
        legs: { L: { foot: [0.15, 0.07, 0.01], toeOut: 15, knee: [0.25, 0, 1] }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.43, -0.2], pitch: 32 },
        spine: { flex: 6 },
        neck: { flex: -14 },
        legs: { L: { foot: [0.15, 0.07, 0.01], toeOut: 15, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 82, plane: 8 }, elbow: 6 }, R: 'mirror' },
      },
    },
    seq: ['stand', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { bottom: 0.35, stand: 0.5 },
  },

  calfRaise: {
    camera: { yaw: 70, pitch: 4 },
    muscles: { primary: ['calves'], secondary: ['core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      down: {
        label: 'Heels down',
        legs: { L: { foot: [0.11, 0.07, 0], toeOut: 5 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      up: {
        label: 'Up tall',
        pelvis: { pos: [0, 1.0, 0.05] },
        legs: { L: { foot: [0.11, 0.14, 0.05], toeOut: 5, heel: 35 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.5, 2.5],
  },

  gobletSquat: {
    camera: { yaw: 50 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'core', 'upperBack'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: Object.fromEntries([-100, -130, -160].map(w => ['w' + w, {
        label: 'w' + w,
        legs: STAND,
        arms: { L: { hand: [0.07, 1.3, 0.2], elbow: [0.3, -1, 0.2], wrist: w }, R: 'mirror' },
      }])),
    seq: ['w-100', 'w-130', 'w-160'],
  },

  dbSquat: {
    camera: { yaw: 40 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['forearms', 'core', 'upperBack'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      stand: {
        label: 'Stand tall',
        legs: STAND,
        arms: { L: { hand: [0.22, 0.83, -0.03], elbow: 'out' }, R: 'mirror' },
      },
    },
    seq: ['stand'],
  },

  kbFrontSquat: {
    camera: { yaw: 50 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['core', 'upperBack'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      a: {
        label: 'w0',
        legs: STAND,
        arms: { L: ARMS_DOWN.L, R: { hand: [-0.08, 1.33, 0.14], elbow: [-0.3, -1, 0.3], wrist: -130 } },
      },
      b: {
        label: 'w150',
        legs: STAND,
        arms: { L: ARMS_DOWN.L, R: { hand: [-0.08, 1.33, 0.14], elbow: [-0.3, -1, 0.3], wrist: -160 } },
      },
      c: {
        label: 'w-150',
        legs: STAND,
        arms: { L: ARMS_DOWN.L, R: { hand: [-0.08, 1.33, 0.14], elbow: [-0.3, -1, 0.3], wrist: -180 } },
      },
    },
    seq: ['a', 'b', 'c'],
  },
};
