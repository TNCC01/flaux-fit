/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, hip hinge and glute family: see js/moves/README.md.

  Hinges tip the pelvis (pitch) with the spine left neutral, so the back
  stays flat and the hips travel back. Loads held in straight arms use hand
  targets with an extra key where the bar passes the knees, so the bar path
  stays on the legs through the whole rep.
*/

// standing hinge stance: feet hip-width, planted
const HIP_FEET = { L: { foot: [0.12, 0.07, 0], toeOut: 6, knee: 'fwd' }, R: 'mirror' };
const KB_FEET = { L: { foot: [0.17, 0.07, 0], toeOut: 12, knee: [0.2, 0, 1] }, R: 'mirror' };
const SWING_FEET = { L: { foot: [0.2, 0.07, 0], toeOut: 12, knee: [0.25, 0, 1] }, R: 'mirror' };
const SUMO_FEET = { L: { foot: [0.36, 0.07, 0.02], toeOut: 32, knee: [0.6, 0, 1] }, R: 'mirror' };
// arms hanging by the sides
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };
// hands behind the head, elbows wide
const HANDS_HEAD = { L: { shoulder: { elev: 145, plane: 110, twist: 30 }, elbow: 125 }, R: 'mirror' };
// a bar across the upper back, hands just outside the shoulders
const BAR_BACK = { L: { shoulder: { elev: 28, plane: 125 }, elbow: 150 }, R: 'mirror' };

// lying face up, knees bent: pelvis pitch -90 puts the head towards -Z
const BRIDGE_FEET = { L: { foot: [0.13, 0.07, 0.42], toeOut: 4, knee: 'up' }, R: 'mirror' };
const FLOOR_ARMS = { L: { hand: [0.27, 0.04, 0.08], elbow: 'down' }, R: 'mirror' };

// hands and knees
const QUAD_PELVIS = { pos: [0, 0.48, 0], pitch: 82 };
const QUAD_HANDS = { L: { hand: [0.2, 0.03, 0.44], elbow: 'back', palm: 'floor' }, R: 'mirror' };
const QUAD_KNEE_L = { foot: [0.1, 0.1, -0.42], knee: 'down', ankle: -70 };

export default {
  // ------------------------------------------------------------ good mornings
  goodMorning: {
    camera: { yaw: 70, pitch: 6 },
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'core'] },
    keys: {
      top: { label: 'Stand tall', legs: HIP_FEET, arms: HANDS_HEAD },
      bottom: {
        label: 'Hinge',
        pelvis: { pos: [0, 0.89, -0.16], pitch: 72 },
        neck: { flex: -12 },
        legs: HIP_FEET,
        arms: HANDS_HEAD,
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.0, 1.4],
    holds: { top: 0.4, bottom: 0.3 },
  },

  barbellGoodMorning: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'upperBack', 'core'] },
    keys: {
      top: { label: 'Bar on back', legs: HIP_FEET, arms: BAR_BACK },
      bottom: {
        label: 'Hinge',
        pelvis: { pos: [0, 0.89, -0.17], pitch: 70 },
        neck: { flex: -12 },
        legs: HIP_FEET,
        arms: BAR_BACK,
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.2, 1.5],
    holds: { top: 0.5, bottom: 0.3 },
  },

  // ------------------------------------------------------------ RDLs
  barbellRdl: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'upperBack', 'forearms'] },
    keys: {
      top: { label: 'Lockout', legs: HIP_FEET, arms: { L: { hand: [0.24, 0.84, 0.1] }, R: 'mirror' } },
      knee: {
        label: 'Past the knees',
        pelvis: { pos: [0, 0.9, -0.1], pitch: 40 },
        neck: { flex: -6 },
        legs: HIP_FEET,
        arms: { L: { hand: [0.24, 0.72, 0.1] }, R: 'mirror' },
      },
      bottom: {
        label: 'Mid-shin',
        pelvis: { pos: [0, 0.87, -0.21], pitch: 88 },
        neck: { flex: -15 },
        legs: HIP_FEET,
        arms: { L: { hand: [0.24, 0.39, 0.09] }, R: 'mirror' },
      },
    },
    seq: ['top', 'knee', 'bottom', 'knee'],
    tempo: [1.1, 1.1, 0.7, 0.7],
    holds: { top: 0.5, knee: 0, bottom: 0.2 },
  },

  dbRdl: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'upperBack', 'forearms'] },
    keys: {
      top: { label: 'Stand tall', legs: HIP_FEET, arms: { L: { hand: [0.17, 0.845, 0.12] }, R: 'mirror' } },
      knee: {
        label: 'Past the knees',
        pelvis: { pos: [0, 0.9, -0.1], pitch: 40 },
        neck: { flex: -6 },
        legs: HIP_FEET,
        arms: { L: { hand: [0.17, 0.715, 0.12] }, R: 'mirror' },
      },
      bottom: {
        label: 'Mid-shin',
        pelvis: { pos: [0, 0.87, -0.21], pitch: 88 },
        neck: { flex: -15 },
        legs: HIP_FEET,
        arms: { L: { hand: [0.17, 0.385, 0.11] }, R: 'mirror' },
      },
    },
    seq: ['top', 'knee', 'bottom', 'knee'],
    tempo: [1.1, 1.1, 0.7, 0.7],
    holds: { top: 0.5, knee: 0, bottom: 0.2 },
  },

  // ------------------------------------------------------------ kettlebell deadlifts
  kbDeadlift: {
    camera: { yaw: 60, pitch: 8 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['glutes', 'hamstrings'], secondary: ['quads', 'lowerBack', 'forearms'] },
    keys: {
      floor: {
        label: 'Bell on the floor',
        pelvis: { pos: [0, 0.67, -0.33], pitch: 74 },
        neck: { flex: -15 },
        legs: KB_FEET,
        arms: { L: { hand: [0.045, 0.305, 0.05] }, R: 'mirror' },
      },
      knee: {
        label: 'Past the knees',
        pelvis: { pos: [0, 0.83, -0.17], pitch: 38 },
        neck: { flex: -8 },
        legs: KB_FEET,
        arms: { L: { hand: [0.045, 0.67, 0.06] }, R: 'mirror' },
      },
      top: { label: 'Stand tall', legs: KB_FEET, arms: { L: { hand: [0.045, 0.86, 0.1] }, R: 'mirror' } },
    },
    seq: ['floor', 'knee', 'top', 'knee'],
    tempo: [0.8, 0.8, 1.0, 1.0],
    holds: { floor: 0.4, knee: 0, top: 0.4 },
  },

  kbSumoDeadlift: {
    camera: { yaw: 35, pitch: 8 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['glutes', 'quads', 'adductors'], secondary: ['hamstrings', 'lowerBack', 'forearms'] },
    keys: {
      floor: {
        label: 'Bell on the floor',
        pelvis: { pos: [0, 0.5, -0.2], pitch: 46 },
        neck: { flex: -10 },
        legs: SUMO_FEET,
        arms: { L: { hand: [0.045, 0.31, 0.05] }, R: 'mirror' },
      },
      top: {
        label: 'Stand tall',
        pelvis: { pos: [0, 0.884, 0] },
        legs: SUMO_FEET,
        arms: { L: { hand: [0.045, 0.81, 0.08] }, R: 'mirror' },
      },
    },
    seq: ['floor', 'top'],
    tempo: [1.0, 1.8],
    holds: { floor: 0.4, top: 0.4 },
  },

  // ------------------------------------------------------------ swings and snatch
  kbSwing: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['glutes', 'hamstrings'], secondary: ['core', 'lowerBack', 'forearms', 'shoulders'] },
    keys: {
      hike: {
        label: 'Hike',
        pelvis: { pos: [0, 0.85, -0.2], pitch: 70 },
        neck: { flex: -15 },
        legs: SWING_FEET,
        arms: { L: { shoulder: { elev: 25, plane: -35 }, elbow: 3 }, R: 'mirror' },
      },
      float: {
        label: 'Float',
        legs: SWING_FEET,
        arms: { L: { shoulder: { elev: 84, plane: -15 }, elbow: 3 }, R: 'mirror' },
      },
    },
    seq: ['hike', 'float'],
    tempo: [0.6, 0.6],
    holds: { hike: 0.05, float: 0.1 },
  },

  kbSwingSingle: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['glutes', 'hamstrings'], secondary: ['obliques', 'core', 'forearms', 'shoulders'] },
    keys: {
      hike: {
        label: 'Hike',
        pelvis: { pos: [0, 0.85, -0.2], pitch: 70 },
        neck: { flex: -15 },
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 25, plane: -45 }, elbow: 3 },
          L: { shoulder: { elev: 30, plane: 25 }, elbow: 15 },
        },
      },
      float: {
        label: 'Float',
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 84, plane: -12 }, elbow: 3 },
          L: { shoulder: { elev: 35, plane: 60 }, elbow: 20 },
        },
      },
    },
    seq: ['hike', 'float'],
    tempo: [0.6, 0.6],
    holds: { hike: 0.05, float: 0.1 },
  },

  kbSnatch: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['glutes', 'hamstrings', 'shoulders'], secondary: ['upperBack', 'traps', 'core', 'forearms'] },
    keys: {
      hike: {
        label: 'Hike',
        pelvis: { pos: [0, 0.85, -0.2], pitch: 70 },
        neck: { flex: -15 },
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 25, plane: -45 }, elbow: 3 },
          L: { shoulder: { elev: 30, plane: 25 }, elbow: 15 },
        },
      },
      pull: {
        label: 'Elbow high',
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 90, plane: 65, twist: -80 }, elbow: 140 },
          L: { shoulder: { elev: 30, plane: 60 }, elbow: 20 },
        },
      },
      lockout: {
        label: 'Lockout',
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 172, plane: 20 }, elbow: 0, wrist: 80 },
          L: { shoulder: { elev: 25, plane: 70 }, elbow: 15 },
        },
      },
    },
    seq: ['hike', 'pull', 'lockout', 'pull'],
    tempo: [0.55, 0.35, 0.5, 0.45],
    holds: { hike: 0.05, pull: 0, lockout: 0.6 },
  },

  // ------------------------------------------------------------ single-leg deadlifts
  singleLegRdl: {
    camera: { yaw: 70, pitch: 6 },
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['core', 'adductors'] },
    keys: {
      top: {
        label: 'Stand tall',
        pelvis: { pos: [0.02, 0.925, 0] },
        legs: {
          L: { foot: [0.1, 0.07, 0], toeOut: 4, knee: 'fwd' },
          R: { hip: { flex: 0 }, knee: 45, ankle: -10 },
        },
        arms: ARMS_DOWN,
      },
      bottom: {
        label: 'Reach',
        pelvis: { pos: [0.02, 0.89, -0.08], pitch: 80 },
        neck: { flex: -12 },
        legs: {
          L: { foot: [0.1, 0.07, 0], toeOut: 4, knee: 'fwd' },
          R: { hip: { flex: -2 }, knee: 4, ankle: 0 },
        },
        arms: { L: { shoulder: { elev: 84, plane: -8 }, elbow: 4 }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.0, 1.4],
    holds: { top: 0.5, bottom: 0.4 },
  },

  kbSingleLegRdl: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['core', 'obliques', 'forearms'] },
    keys: {
      top: {
        label: 'Stand tall',
        pelvis: { pos: [0.02, 0.925, 0] },
        legs: {
          L: { foot: [0.1, 0.07, 0], toeOut: 4, knee: 'fwd' },
          R: { hip: { flex: 0 }, knee: 45, ankle: -10 },
        },
        arms: {
          R: { shoulder: { elev: 4, plane: 0 }, elbow: 4 },
          L: { shoulder: { elev: 12, plane: 80 }, elbow: 10 },
        },
      },
      bottom: {
        label: 'Hinge',
        pelvis: { pos: [0.02, 0.89, -0.08], pitch: 80 },
        neck: { flex: -12 },
        legs: {
          L: { foot: [0.1, 0.07, 0], toeOut: 4, knee: 'fwd' },
          R: { hip: { flex: -2 }, knee: 4, ankle: 0 },
        },
        arms: {
          R: { shoulder: { elev: 80, plane: -12 }, elbow: 4 },
          L: { shoulder: { elev: 60, plane: 45 }, elbow: 10 },
        },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.2, 1.5],
    holds: { top: 0.5, bottom: 0.4 },
  },
};
