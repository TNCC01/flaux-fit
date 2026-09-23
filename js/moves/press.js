/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, overhead pressing and arms: see js/moves/README.md.
*/
const STANCE = { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' };
const ARM_DOWN = { shoulder: { elev: 6, plane: 90 }, elbow: 10 };

export default {
  barbellPress: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core', 'glutes'] },
    coaching: {
      setup: [
        'Bar resting on the front of the shoulders, hands just outside shoulder-width.',
        'Elbows slightly in front of the bar, forearms close to vertical.',
        'Feet hip-width, glutes squeezed and ribs pulled down so the lower back does not arch.',
      ],
      steps: [
        'Take a breath and brace the trunk.',
        'Pull the chin back and press the bar straight up past the face.',
        'Once the bar clears the forehead, move the head forward "through the window" under the bar.',
        'Lock the elbows out with the bar over the middle of the foot, shoulders shrugged up to the ears.',
        'Lower under control back to the front of the shoulders, moving the head back out of the way.',
      ],
      cues: ['Ribs down, glutes tight', 'Bar path straight up', 'Head through at the top'],
      mistakes: [
        'Leaning back and arching the lower back to finish the press.',
        'Pushing the bar forward around the face instead of moving the face.',
        'Elbows flaring out to the sides at the start.',
        'Using the legs to kick the bar up: that is a push press.',
      ],
      breathing: 'Breathe in and brace at the bottom, breathe out through the lockout.',
      tempo: '1 to 2 seconds up, a moment at lockout, 2 seconds down.',
    },
    keys: {
      rack: {
        label: 'Front rack',
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' },
        arms: { L: { hand: [0.23, 1.33, 0.12], elbow: [0.35, -1, 0.7], wrist: -65 }, R: 'mirror' },
      },
      pass: {
        label: 'Past the face',
        neck: { flex: -14 },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 1.64, 0.1], elbow: [0.8, -1, 0.3], wrist: -30 }, R: 'mirror' },
      },
      lockout: {
        label: 'Lockout',
        spine: { flex: -2 },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' },
        arms: { L: { hand: [0.26, 1.93, 0.0], elbow: 'out' }, R: 'mirror' },
      },
    },
    seq: ['rack', 'pass', 'lockout', 'pass'],
    tempo: [0.6, 0.6, 1.0, 0.9],
    holds: { lockout: 0.5, rack: 0.4, pass: 0 },
  },
  dbPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      rack: {
        label: 'Shoulders',
        legs: STANCE,
        arms: { L: { hand: [0.33, 1.42, 0.08], elbow: [0.6, -1, 0.5] }, R: 'mirror' },
      },
      mid: {
        label: 'Press',
        legs: STANCE,
        arms: { L: { hand: [0.3, 1.66, 0.05], elbow: [0.8, -1, 0.3] }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.17, 1.92, 0.0], elbow: 'back' }, R: 'mirror' },
      },
    },
    seq: ['rack', 'mid', 'top', 'mid'],
    tempo: [0.6, 0.6, 0.9, 0.9],
    holds: { top: 0.4, rack: 0.3, mid: 0 },
  },
  dbArnoldPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      start: {
        label: 'Palms to you',
        legs: STANCE,
        arms: { L: { hand: [0.19, 1.4, 0.15], elbow: [0.2, -1, 0.3] }, R: 'mirror' },
      },
      turn: {
        label: 'Open and turn',
        legs: STANCE,
        arms: { L: { hand: [0.32, 1.52, 0.06], elbow: [1, -0.6, 0.2] }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.17, 1.92, 0.0], elbow: 'back' }, R: 'mirror' },
      },
    },
    seq: ['start', 'turn', 'top', 'turn'],
    tempo: [0.7, 0.8, 0.9, 1.0],
    holds: { top: 0.4, start: 0.3, turn: 0 },
  },
  dbPushPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps', 'quads'], secondary: ['glutes', 'core', 'upperBack', 'calves'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      rack: {
        label: 'Shoulders',
        legs: STANCE,
        arms: { L: { hand: [0.3, 1.42, 0.1], elbow: [0.5, -1, 0.7] }, R: 'mirror' },
      },
      dip: {
        label: 'Dip',
        pelvis: { pos: [0, 0.83, -0.03] },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.3, 1.32, 0.07], elbow: [0.5, -1, 0.7] }, R: 'mirror' },
      },
      drive: {
        label: 'Drive',
        pelvis: { pos: [0, 0.97, 0.01] },
        legs: { L: { foot: [0.12, 0.11, 0.01], toeOut: 8, heel: 18 }, R: 'mirror' },
        arms: { L: { hand: [0.27, 1.62, 0.06], elbow: [0.8, -1, 0.3] }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.17, 1.92, 0.0], elbow: 'back' }, R: 'mirror' },
      },
    },
    seq: ['rack', 'dip', 'drive', 'top', 'rack'],
    tempo: [0.6, 0.25, 0.35, 1.3, 0.1],
    holds: { dip: 0, drive: 0, top: 0.4, rack: 0.4 },
  },
  dbFrontRaise: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      down: {
        label: 'Arms down',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 8, plane: 10 }, elbow: 10 }, R: 'mirror' },
      },
      top: {
        label: 'Eye height',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 102, plane: 10 }, elbow: 8 }, R: 'mirror' },
      },
    },
    seq: ['down', 'top'],
    tempo: [1.3, 2.0],
    holds: { top: 0.4, down: 0.3 },
  },
  lateralRaise: {
    camera: { yaw: 20, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders'], secondary: ['traps', 'upperBack'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      down: {
        label: 'Arms down',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 10, plane: 75, twist: 180 }, elbow: 15 }, R: 'mirror' },
      },
      top: {
        label: 'Shoulder height',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 88, plane: 75, twist: 180 }, elbow: 15 }, R: 'mirror' },
      },
    },
    seq: ['down', 'top'],
    tempo: [1.2, 2.0],
    holds: { top: 0.4, down: 0.3 },
  },
  dbOverheadTricep: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }],
    muscles: { primary: ['triceps'], secondary: ['shoulders', 'core'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      top: {
        label: 'Arms straight',
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.894, 0.058], elbow: [-0.05, 0.29, 0.06] }, R: { hand: [-0.025, 1.894, 0.058], elbow: [0.05, 0.29, 0.06] } },
      },
      mid: {
        label: 'Lower',
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.685, -0.204], elbow: [-0.05, 0.29, 0.06] }, R: { hand: [-0.025, 1.685, -0.204], elbow: [0.05, 0.29, 0.06] } },
      },
      bottom: {
        label: 'Behind the head',
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.517, -0.151], elbow: [-0.05, 0.29, 0.06] }, R: { hand: [-0.025, 1.517, -0.151], elbow: [0.05, 0.29, 0.06] } },
      },
    },
    seq: ['top', 'mid', 'bottom', 'mid'],
    tempo: [1.2, 0.8, 0.6, 0.6],
    holds: { top: 0.4, bottom: 0.2, mid: 0 },
  },
  kbPressSingle: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['core', 'obliques', 'upperBack', 'glutes'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      rack: {
        label: 'Rack',
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.11, 1.37, 0.13], elbow: [-0.4, -1, 0.3], wrist: -150 } },
      },
      mid: {
        label: 'Press',
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.27, 1.64, 0.04], elbow: [-0.6, -1, 0.2], wrist: -150 } },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.18, 1.92, -0.01], elbow: 'back', wrist: -150 } },
      },
    },
    seq: ['rack', 'mid', 'top', 'mid'],
    tempo: [0.6, 0.6, 1.0, 0.9],
    holds: { top: 0.5, rack: 0.4, mid: 0 },
  },
  kbCleanPress: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'glutes', 'hamstrings'], secondary: ['triceps', 'core', 'upperBack', 'forearms'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
      floor: {
        label: 'Grip',
        pelvis: { pos: [0, 0.62, -0.31], pitch: 60 },
        spine: { flex: 3 }, neck: { flex: -22 },
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 58, plane: 12 }, elbow: 12 }, R: { hand: [-0.03, 0.31, 0.12], elbow: 'back' } },
      },
      pull: {
        label: 'Hips snap',
        pelvis: { pos: [0, 0.91, -0.03], pitch: 6 },
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.14, 1.05, 0.14], elbow: [-0.7, 0.3, -0.5], wrist: -40 } },
      },
      rack: {
        label: 'Rack',
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.11, 1.37, 0.13], elbow: [-0.4, -1, 0.3], wrist: -150 } },
      },
      mid: {
        label: 'Press',
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.27, 1.64, 0.04], elbow: [-0.6, -1, 0.2], wrist: -150 } },
      },
      top: {
        label: 'Lockout',
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.18, 1.92, -0.01], elbow: 'back', wrist: -150 } },
      },
    },
    seq: ['floor', 'pull', 'rack', 'mid', 'top', 'mid', 'rack', 'pull'],
    tempo: [0.5, 0.35, 0.6, 0.6, 0.9, 0.8, 0.5, 0.6],
    holds: { floor: 0.4, pull: 0, rack: 0.3, mid: 0, top: 0.5 },
  },
  kbHalo: {
    camera: { yaw: 30, pitch: 8 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['shoulders'], secondary: ['core', 'obliques', 'upperBack', 'triceps'] },
    coaching: { setup: [], steps: [], cues: [], mistakes: [], breathing: '', tempo: '' },
    keys: {
h0: { label: 'In front', legs: STANCE, arms: { L: { hand: [0.05, 1.36, 0.25], elbow: [-0.028, -0.23, 0.191] }, R: { hand: [-0.05, 1.36, 0.25], elbow: [0.028, -0.23, 0.191] } } },
      h30: { label: 'Round', legs: STANCE, arms: { L: { hand: [-0.082, 1.481, 0.242], elbow: [-0.141, -0.116, 0.238] }, R: { hand: [-0.168, 1.481, 0.192], elbow: [0.025, -0.152, 0.257] } } },
      h60: { label: 'Round', legs: STANCE, arms: { L: { hand: [-0.192, 1.569, 0.168], elbow: [-0.191, 0.019, 0.231] }, R: { hand: [-0.242, 1.569, 0.082], elbow: [-0.08, 0.001, 0.289] } } },
      h90: { label: 'Right side', legs: STANCE, arms: { L: { hand: [-0.25, 1.6, 0.05], elbow: [-0.226, 0.103, 0.168] }, R: { hand: [-0.25, 1.6, -0.05], elbow: [-0.143, 0.147, 0.219] } } },
      h120: { label: 'Round', legs: STANCE, arms: { L: { hand: [-0.242, 1.57, -0.082], elbow: [-0.248, 0.119, 0.121] }, R: { hand: [-0.192, 1.57, -0.168], elbow: [-0.124, 0.259, 0.087] } } },
      h150: { label: 'Round', legs: STANCE, arms: { L: { hand: [-0.168, 1.489, -0.192], elbow: [-0.275, 0.081, 0.088] }, R: { hand: [-0.082, 1.489, -0.242], elbow: [-0.032, 0.289, -0.075] } } },
      h180: { label: 'Behind', legs: STANCE, arms: { L: { hand: [-0.05, 1.38, -0.25], elbow: [-0.068, 0.2, -0.213] }, R: { hand: [0.05, 1.38, -0.25], elbow: [0.068, 0.2, -0.213] } } },
      h210: { label: 'Round', legs: STANCE, arms: { L: { hand: [0.082, 1.489, -0.242], elbow: [0.049, 0.283, -0.087] }, R: { hand: [0.168, 1.489, -0.192], elbow: [0.294, -0.04, 0.042] } } },
      h240: { label: 'Round', legs: STANCE, arms: { L: { hand: [0.192, 1.57, -0.168], elbow: [0.124, 0.259, 0.087] }, R: { hand: [0.242, 1.57, -0.082], elbow: [0.263, 0.084, 0.117] } } },
      h270: { label: 'Left side', legs: STANCE, arms: { L: { hand: [0.25, 1.6, -0.05], elbow: [0.227, 0.121, 0.155] }, R: { hand: [0.25, 1.6, 0.05], elbow: [0.226, 0.103, 0.168] } } },
      h300: { label: 'Round', legs: STANCE, arms: { L: { hand: [0.242, 1.569, 0.082], elbow: [0.267, 0.048, 0.128] }, R: { hand: [0.192, 1.569, 0.168], elbow: [0.145, 0.095, 0.245] } } },
      h330: { label: 'Round', legs: STANCE, arms: { L: { hand: [0.168, 1.481, 0.192], elbow: [0.229, 0.052, 0.186] }, R: { hand: [0.082, 1.481, 0.242], elbow: [0.053, -0.033, 0.293] } } },
    },
    seq: ['h0', 'h30', 'h60', 'h90', 'h120', 'h150', 'h180', 'h210', 'h240', 'h270', 'h300', 'h330'],
    tempo: 0.3,
    holds: { h0: 0.3, h30: 0, h60: 0, h90: 0, h120: 0, h150: 0, h180: 0, h210: 0, h240: 0, h270: 0, h300: 0, h330: 0 },
  },
};
