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
const BRIDGE_FEET = { L: { foot: [0.13, 0.07, 0.5], toeOut: 4, knee: 'up' }, R: 'mirror' };
const FLOOR_ARMS = { L: { hand: [0.27, 0.04, 0.1], elbow: 'up' }, R: 'mirror' };

// hands and knees
const QUAD_PELVIS = { pos: [0, 0.48, 0], pitch: 82 };
const QUAD_HANDS = { L: { hand: [0.2, 0.03, 0.44], elbow: 'back', palm: 'floor' }, R: 'mirror' };
const QUAD_KNEE_L = { foot: [0.1, 0.1, -0.42], knee: 'down', ankle: -70 };

export default {
  // ------------------------------------------------------------ good mornings
  goodMorning: {
    camera: { yaw: 70, pitch: 6 },
    muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'core'] },
    coaching: {
      setup: [
        'Feet hip-width apart, toes pointing forward or turned out slightly.',
        'Fingertips resting lightly behind your head, elbows out wide. Do not pull on your neck.',
        'Stand tall with a slight bend in the knees and the ribs stacked over the pelvis.',
      ],
      steps: [
        'Brace your trunk, then push your hips straight back as if closing a car door with your bum.',
        'Let the chest tip forward as the hips go back, keeping the back flat from tailbone to head.',
        'Keep the soft bend in the knees fixed: the shins stay close to vertical.',
        'Stop when you feel a strong stretch in the back of the thighs, usually with the chest close to level with the floor.',
        'Drive the hips forward to stand tall, squeezing the glutes at the top.',
      ],
      cues: [
        'Hips back, not down',
        'Flat back, long neck',
        'Soft knees, still shins',
      ],
      mistakes: [
        'Rounding the back to get lower, which moves the work from the hamstrings to the spine.',
        'Bending the knees more and more so it turns into a squat.',
        'Pulling the head forward with the hands, which strains the neck.',
        'Leaning back past upright at the top instead of finishing with the glutes.',
      ],
      breathing: 'Breathe in and brace as you hinge down, breathe out as you stand up.',
      tempo: 'About 2 seconds down, a brief pause, 1 to 2 seconds up.',
    },
    keys: {
      top: { label: 'Stand tall', pelvis: { pos: [0, 0.92, 0] }, legs: HIP_FEET, arms: HANDS_HEAD },
      bottom: {
        label: 'Hinge',
        pelvis: { pos: [0, 0.88, -0.18], pitch: 78 },
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
    coaching: {
      setup: [
        'Rest the bar across the meaty part of your upper back, not on your neck.',
        'Hands just outside the shoulders, pulling the bar down into your back so it stays pinned.',
        'Feet hip-width apart, knees softly bent, ribs down and trunk braced.',
      ],
      steps: [
        'Take a breath and brace, then push the hips straight back.',
        'Let the chest tip forward as the hips travel back, keeping the back flat and the bar fixed on your upper back.',
        'Keep the knee bend the same the whole way: the shins stay close to vertical.',
        'Lower until you feel a strong hamstring stretch, no further than the chest level with the floor.',
        'Drive the hips forward to return to standing and squeeze the glutes.',
      ],
      cues: [
        'Bar glued to your back',
        'Hips back, chest follows',
        'Soft knees, flat back',
      ],
      mistakes: [
        'Rounding the upper or lower back under the bar, which puts the load on the spine.',
        'Letting the bar roll up onto the neck.',
        'Turning it into a squat by bending the knees further as you go down.',
        'Going too heavy: this is a lighter accessory lift, control matters more than load.',
      ],
      breathing: 'Breathe in and brace before each rep, breathe out once you are back upright.',
      tempo: 'About 2 seconds down, a brief pause, 1 to 2 seconds up.',
    },
    keys: {
      top: { label: 'Bar on back', pelvis: { pos: [0, 0.92, 0] }, legs: HIP_FEET, arms: BAR_BACK },
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
    coaching: {
      setup: [
        'Stand tall holding the bar at the front of your thighs, hands just outside the legs, palms facing you.',
        'Feet hip-width apart, bar over the middle of your feet.',
        'Shoulders back and down, arms long, knees softly bent.',
      ],
      steps: [
        'Brace, then push the hips back and let the bar slide down the front of your thighs.',
        'Keep the bar in contact with your legs as it passes the knees; the knees stay softly bent and the shins stay vertical.',
        'Keep hinging with a flat back until the bar is around mid-shin or you feel a strong hamstring stretch.',
        'Drive the hips forward and drag the bar back up the legs to stand tall, glutes squeezed.',
      ],
      cues: [
        'Bar stays on your legs',
        'Push the hips back',
        'Chest proud, back flat',
      ],
      mistakes: [
        'Letting the bar drift away from the legs, which loads the lower back.',
        'Rounding the back to reach lower than your hamstrings allow.',
        'Bending the knees and dropping the hips so it becomes a squat or a conventional deadlift.',
        'Leaning back or shrugging at the top instead of finishing with the glutes.',
      ],
      breathing: 'Breathe in and brace at the top, hold it on the way down, breathe out as you stand.',
      tempo: 'About 2 to 3 seconds down, a brief pause, 1 to 2 seconds up.',
    },
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
    coaching: {
      setup: [
        'Stand tall with a dumbbell in each hand in front of your thighs, palms facing you.',
        'Feet hip-width apart, knees softly bent.',
        'Shoulders back and down, arms long and relaxed.',
      ],
      steps: [
        'Brace, then push the hips back and slide the dumbbells down the front of your thighs.',
        'Keep the dumbbells close to your legs as they pass the knees; the shins stay vertical.',
        'Hinge with a flat back until the dumbbells reach about mid-shin or you feel a strong hamstring stretch.',
        'Drive the hips forward and stand tall, squeezing the glutes at the top.',
      ],
      cues: [
        'Dumbbells down the shins',
        'Hips back, back flat',
        'Soft knees, still shins',
      ],
      mistakes: [
        'Letting the dumbbells hang out in front, which pulls on the lower back.',
        'Rounding the back to get the weights lower.',
        'Bending the knees too much so the hips drop into a squat.',
        'Rushing the lowering: the slow way down is where the hamstrings work hardest.',
      ],
      breathing: 'Breathe in and brace at the top, breathe out as you stand back up.',
      tempo: 'About 2 to 3 seconds down, a brief pause, 1 to 2 seconds up.',
    },
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
    coaching: {
      setup: [
        'Stand with feet a little wider than hip-width, the kettlebell on the floor between your feet, in line with your ankles.',
        'Push the hips back and bend the knees just enough to reach the handle with both hands.',
        'Back flat, shoulders slightly in front of the bell, arms straight.',
      ],
      steps: [
        'Pull the shoulders down and back to take the slack out of the arms.',
        'Brace and push the floor away, driving the hips forward as you stand.',
        'Keep the bell close, travelling straight up between your legs.',
        'Stand tall with the glutes squeezed, then push the hips back to lower the bell to the same spot.',
      ],
      cues: [
        'Bell between the feet',
        'Flat back, long arms',
        'Push the floor away',
      ],
      mistakes: [
        'Placing the bell in front of the toes, which drags you forward and rounds the back.',
        'Squatting the bell up with the hips low instead of hinging.',
        'Rounding the back to reach the floor.',
        'Leaning back at the top instead of finishing with the glutes.',
      ],
      breathing: 'Breathe in and brace before you lift, breathe out at the top.',
      tempo: 'About 1 to 2 seconds up, a brief pause, 2 seconds down.',
    },
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
    coaching: {
      setup: [
        'Stand with a wide stance, feet well outside the shoulders and toes turned out about 30 degrees.',
        'Kettlebell on the floor between your feet, under your hips.',
        'Sit the hips back and down, knees pushed out over the toes, chest up, and grip the handle with both hands.',
      ],
      steps: [
        'Pull the shoulders down and brace the trunk.',
        'Drive the floor away and push the knees out as you stand.',
        'Keep the chest up and the bell travelling straight up between your legs.',
        'Finish tall with the glutes squeezed, then sit back down between your feet to lower the bell.',
      ],
      cues: [
        'Knees out over the toes',
        'Chest up, back flat',
        'Drive the floor away',
      ],
      mistakes: [
        'Knees caving in as you stand.',
        'Hips shooting up first so the chest drops and the back rounds.',
        'Stance too narrow for the toe angle, which twists the knees.',
        'Leaning back at the top.',
      ],
      breathing: 'Breathe in and brace at the bottom, breathe out as you finish standing.',
      tempo: 'About 1 to 2 seconds up, a brief pause, 2 seconds down.',
    },
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
    coaching: {
      setup: [
        'Feet a little wider than shoulder-width, the bell on the floor about a foot in front of you.',
        'Hinge down with a flat back and grip the handle with both hands.',
        'Tip the bell back towards you so it is ready to hike.',
      ],
      steps: [
        'Hike the bell back between your legs like a football snap, forearms against the inner thighs.',
        'Snap the hips forward hard and stand tall: the hips send the bell, the arms only guide it.',
        'Let the bell float to about chest height with straight arms, glutes and abs tight at the top.',
        'As it falls, stay tall until your forearms meet your hips, then hinge back and let it swing between your legs.',
        'Repeat in a steady rhythm, then hike it back and park it on the floor to finish.',
      ],
      cues: [
        'Hike, snap, float',
        'Hips back, not down',
        'Stand tall like a plank at the top',
      ],
      mistakes: [
        'Squatting the swing: bending the knees a lot instead of pushing the hips back.',
        'Lifting the bell with the arms and shoulders.',
        'Leaning back at the top instead of standing tall.',
        'Hinging early and letting the bell drop down to the knees, which loads the lower back.',
      ],
      breathing: 'Short sharp breath out at the top of each swing, breathe in as the bell drops back.',
      tempo: 'About 1 second per swing, a smooth continuous rhythm.',
    },
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
    coaching: {
      setup: [
        'Feet a little wider than shoulder-width, the bell on the floor in front of you.',
        'Hinge down with a flat back and take the handle in one hand, thumb pointing back.',
        'Square the shoulders and hips to the front. The free arm stays relaxed by your side.',
      ],
      steps: [
        'Hike the bell back between your legs, forearm against the inner thigh.',
        'Snap the hips forward and stand tall, letting the bell float to chest height.',
        'Keep the shoulders and hips square: do not let the bell pull you into a twist.',
        'Stay tall as the bell falls, then hinge back and let it swing between your legs.',
        'Finish your reps, park the bell and swap hands.',
      ],
      cues: [
        'Resist the twist',
        'Shoulder packed down',
        'Snap the hips',
      ],
      mistakes: [
        'Letting the working shoulder get pulled forward and the trunk rotate.',
        'Lifting the bell with the arm.',
        'Squatting instead of hinging.',
        'Leaning back or to the side at the top.',
      ],
      breathing: 'Short sharp breath out at the top of each swing, breathe in on the way down.',
      tempo: 'About 1 second per swing, a smooth continuous rhythm.',
    },
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
    coaching: {
      setup: [
        'Learn two-handed and one-arm swings first.',
        'Feet a little wider than shoulder-width, the bell on the floor in front of you.',
        'Hinge down with a flat back and grip the handle in one hand.',
      ],
      steps: [
        'Hike the bell back between your legs and snap the hips forward as in a swing.',
        'As the hips finish, keep the bell close and pull the elbow high and back.',
        'Punch the hand up through the handle so the bell rolls softly onto the back of the forearm.',
        'Lock out overhead with the arm by your ear, wrist straight, ribs down and glutes tight.',
        'Drop the bell back down in front of you, let it fall, then hinge and hike it back for the next rep.',
      ],
      cues: [
        'Hike, snap, pull, punch',
        'Bell close to the body',
        'Arm by the ear at the top',
      ],
      mistakes: [
        'Swinging the bell out in a wide arc so it slams onto the forearm.',
        'Pressing the bell up with the shoulder instead of driving it with the hips.',
        'Bent wrist at lockout, which strains the wrist.',
        'Arching the lower back overhead instead of keeping the ribs down.',
      ],
      breathing: 'Breathe out sharply as the hips snap, breathe in at lockout, out again as it drops.',
      tempo: 'About 2 seconds per rep with a brief pause overhead.',
    },
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
          R: { shoulder: { elev: 80, plane: 55, twist: -75 }, elbow: 120 },
          L: { shoulder: { elev: 30, plane: 60 }, elbow: 20 },
        },
      },
      lockout: {
        label: 'Lockout',
        legs: SWING_FEET,
        arms: {
          R: { shoulder: { elev: 172, plane: 20, twist: 20 }, elbow: 0, wrist: 60 },
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
    coaching: {
      setup: [
        'Stand on one leg with a soft bend in the knee.',
        'Rest the other foot lightly behind you, toes on or just off the floor.',
        'Hips level and facing forward, arms hanging long.',
      ],
      steps: [
        'Hinge at the standing hip, tipping the chest forward as the free leg lifts behind you.',
        'Keep a straight line from head to heel on the free leg, toes pointing at the floor.',
        'Reach the hands towards the floor in front of your standing foot.',
        'Stop when your body is close to level with the floor or your hamstring stops you.',
        'Drive the standing hip forward to stand tall, then repeat and swap sides.',
      ],
      cues: [
        'Hips level, toes down',
        'Reach long, back flat',
        'Soft standing knee',
      ],
      mistakes: [
        'Letting the hip of the lifted leg rotate open towards the ceiling.',
        'Rounding the back to reach the floor.',
        'Locking or over-bending the standing knee.',
        'Rushing, which makes you lose balance.',
      ],
      breathing: 'Breathe in as you hinge, breathe out as you stand.',
      tempo: 'About 2 seconds down, a brief pause, 2 seconds up.',
    },
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
    coaching: {
      setup: [
        'Hold the kettlebell in the hand opposite your standing leg.',
        'Stand on one leg with a soft knee, the other foot lightly behind you.',
        'Hips level, shoulders back, free arm out a little for balance.',
      ],
      steps: [
        'Hinge at the standing hip, letting the free leg lift behind you as the chest tips forward.',
        'Let the bell hang straight down from the shoulder, close to the standing leg.',
        'Keep the hips square and level the whole way; the toes of the back foot point at the floor.',
        'Lower until the bell reaches about mid-shin, then drive the standing hip forward to stand tall.',
      ],
      cues: [
        'Hips level, slow',
        'Bell hangs straight down',
        'Long line from head to heel',
      ],
      mistakes: [
        'Hips twisting open as the leg lifts.',
        'The bell pulling you forward and rounding your back.',
        'Squatting down on the standing leg instead of hinging.',
        'Moving too fast to keep your balance.',
      ],
      breathing: 'Breathe in as you lower, breathe out as you stand.',
      tempo: 'About 2 to 3 seconds down, a brief pause, 2 seconds up.',
    },
    keys: {
      top: {
        label: 'Stand tall',
        pelvis: { pos: [0.02, 0.925, 0] },
        legs: {
          L: { foot: [0.1, 0.07, 0], toeOut: 4, knee: 'fwd' },
          R: { hip: { flex: 0 }, knee: 45, ankle: -10 },
        },
        arms: {
          R: { shoulder: { elev: 10, plane: 75 }, elbow: 4 },
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

  // ------------------------------------------------------------ bridges and thrusts
  gluteBridge: {
    camera: { yaw: 70, pitch: 14 },
    muscles: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
    coaching: {
      setup: [
        'Lie on your back with knees bent and feet flat, hip-width apart.',
        'Heels about a hand-length from your bum, so the shins are near vertical at the top.',
        'Arms long by your sides, palms down.',
      ],
      steps: [
        'Brace the abs and gently tuck the pelvis so the lower back is flat.',
        'Push through the heels and lift the hips until shoulders, hips and knees make one straight line.',
        'Squeeze the glutes hard at the top for a second or two.',
        'Lower the hips slowly back to the floor.',
      ],
      cues: [
        'Push through the heels',
        'Squeeze hard at the top',
        'Ribs down',
      ],
      mistakes: [
        'Arching the lower back to get the hips higher, which takes the work off the glutes.',
        'Feet too close or too far away, which moves the effort into the quads or hamstrings.',
        'Knees falling in or flaring out.',
        'Dropping straight down instead of lowering with control.',
      ],
      breathing: 'Breathe out as you lift, breathe in as you lower.',
      tempo: '1 second up, 1 to 2 seconds squeeze, 2 seconds down.',
    },
    keys: {
      down: {
        label: 'Hips down',
        pelvis: { pos: [0, 0.117, 0], pitch: -87 },
        legs: BRIDGE_FEET,
        arms: FLOOR_ARMS,
      },
      up: {
        label: 'Squeeze',
        pelvis: { pos: [0, 0.28, -0.06], pitch: -115 },
        neck: { flex: 42 },
        legs: BRIDGE_FEET,
        arms: FLOOR_ARMS,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.0, 1.6],
    holds: { up: 1.0, down: 0.3 },
  },

  singleLegBridge: {
    camera: { yaw: 70, pitch: 14 },
    muscles: { primary: ['glutes', 'hamstrings'], secondary: ['core'] },
    coaching: {
      setup: [
        'Lie on your back with one foot flat on the floor, knee bent.',
        'Straighten the other leg, keeping the thighs level with each other.',
        'Arms long by your sides, palms down.',
      ],
      steps: [
        'Brace the abs and tuck the pelvis slightly.',
        'Push through the heel of the planted foot and lift the hips.',
        'Keep the hips level and the straight leg in line with the other thigh.',
        'Squeeze at the top, then lower slowly. Finish your reps and swap sides.',
      ],
      cues: [
        'One foot down, one leg out',
        'Hips stay level',
        'Drive through the heel',
      ],
      mistakes: [
        'One hip dropping lower than the other.',
        'Arching the lower back at the top.',
        'Pushing through the toes, which shifts the work to the quads.',
        'Swinging the free leg to help lift.',
      ],
      breathing: 'Breathe out as you lift, breathe in as you lower.',
      tempo: '1 second up, a 1 second squeeze, 2 seconds down.',
    },
    keys: {
      down: {
        label: 'Hips down',
        pelvis: { pos: [0, 0.117, 0], pitch: -87 },
        legs: {
          L: { foot: [0.11, 0.07, 0.48], toeOut: 4, knee: 'up' },
          R: { hip: { flex: 46 }, knee: 2, ankle: 5 },
        },
        arms: FLOOR_ARMS,
      },
      up: {
        label: 'Squeeze',
        pelvis: { pos: [0, 0.28, -0.06], pitch: -115 },
        neck: { flex: 42 },
        legs: {
          L: { foot: [0.11, 0.07, 0.48], toeOut: 4, knee: 'up' },
          R: { hip: { flex: 2 }, knee: 2, ankle: 5 },
        },
        arms: FLOOR_ARMS,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.0, 1.6],
    holds: { up: 1.0, down: 0.3 },
  },

  frogPump: {
    camera: { yaw: 25, pitch: 16 },
    muscles: { primary: ['glutes'], secondary: ['adductors', 'core'] },
    coaching: {
      setup: [
        'Lie on your back with the heels touching and the toes turned out.',
        'Let the knees fall out wide and draw the heels in close to your bum.',
        'Arms long by your sides.',
      ],
      steps: [
        'Brace the abs and tuck the pelvis slightly.',
        'Press the heels together and into the floor and drive the hips up.',
        'Squeeze the glutes hard at the top, keeping the knees wide.',
        'Lower under control and go straight into the next rep.',
      ],
      cues: [
        'Heels together, knees wide',
        'Short, sharp squeezes',
        'Ribs down',
      ],
      mistakes: [
        'Arching the lower back instead of squeezing the glutes.',
        'Knees drifting in as you lift.',
        'Heels creeping away from the bum, which shortens the squeeze.',
        'Bouncing with no pause at the top.',
      ],
      breathing: 'Breathe out on each lift, breathe in as you lower.',
      tempo: 'Quick up, a brief squeeze, about 1 second down.',
    },
    keys: {
      down: {
        label: 'Hips down',
        pelvis: { pos: [0, 0.117, 0], pitch: -87 },
        legs: { L: { foot: [0.07, 0.07, 0.3], toeOut: 55, knee: [1, 0.5, 0] }, R: 'mirror' },
        arms: FLOOR_ARMS,
      },
      up: {
        label: 'Squeeze',
        pelvis: { pos: [0, 0.29, -0.07], pitch: -118 },
        neck: { flex: 50 },
        legs: { L: { foot: [0.07, 0.07, 0.3], toeOut: 55, knee: [1, 0.5, 0] }, R: 'mirror' },
        arms: FLOOR_ARMS,
      },
    },
    seq: ['down', 'up'],
    tempo: [0.7, 0.8],
    holds: { up: 0.5, down: 0.15 },
  },

  hipThrust: {
    camera: { yaw: 70, pitch: 10 },
    props: [{ type: 'bench', pos: [0, 0, -0.55], size: [1.2, 0.4, 0.4] }],
    muscles: { primary: ['glutes'], secondary: ['hamstrings', 'quads', 'core'] },
    coaching: {
      setup: [
        'Sit on the floor with the bottom edge of your shoulder blades against the edge of a bench or couch.',
        'Feet flat, hip-width apart, far enough out that the shins are vertical at the top.',
        'Hands on your hips, chin tucked.',
      ],
      steps: [
        'Brace and push through the heels, pivoting on the bench as the hips rise.',
        'Drive up until the trunk is level with the floor and the knees are bent at about 90 degrees.',
        'Squeeze the glutes hard at the top, ribs down and chin tucked.',
        'Lower the hips under control until they are just off the floor.',
      ],
      cues: [
        'Shoulders on the bench, drive up',
        'Chin tucked, eyes forward',
        'Shins vertical at the top',
      ],
      mistakes: [
        'Arching the lower back at the top instead of finishing with the glutes.',
        'Feet too far forward, which moves the work into the hamstrings.',
        'Throwing the head back, which tends to arch the back.',
        'The bench sliding: put it against a wall.',
      ],
      breathing: 'Breathe out as you drive up, breathe in as you lower.',
      tempo: '1 second up, a 1 second squeeze, 2 seconds down.',
    },
    keys: {
      down: {
        label: 'Hips down',
        pelvis: { pos: [0, 0.26, -0.05], pitch: -45 },
        neck: { flex: 20 },
        legs: { L: { foot: [0.15, 0.07, 0.42], toeOut: 8, knee: [0.2, 1, 0.3] }, R: 'mirror' },
        arms: { L: { hand: [0.15, 0.42, -0.02], elbow: 'out' }, R: 'mirror' },
      },
      up: {
        label: 'Lockout',
        pelvis: { pos: [0, 0.53, 0], pitch: -92 },
        neck: { flex: 40 },
        legs: { L: { foot: [0.15, 0.07, 0.42], toeOut: 8, knee: [0.2, 1, 0.3] }, R: 'mirror' },
        arms: { L: { hand: [0.15, 0.66, -0.08], elbow: 'out' }, R: 'mirror' },
      },
    },
    seq: ['down', 'up'],
    tempo: [1.1, 1.6],
    holds: { up: 0.8, down: 0.2 },
  },

  // ------------------------------------------------------------ hands and knees
  gluteKickback: {
    camera: { yaw: 80, pitch: 10 },
    muscles: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips.',
        'Back flat, neck long, eyes on the floor just in front of your hands.',
        'Brace the abs gently so the lower back does not sag.',
      ],
      steps: [
        'Keep the knee bent at 90 degrees and lift one leg, driving the heel up towards the ceiling.',
        'Lift until the thigh is in line with your body, not higher.',
        'Squeeze the glute at the top without arching the back or twisting the hips.',
        'Lower the knee back under the hip without touching the floor, then repeat and swap sides.',
      ],
      cues: [
        'Drive the heel to the ceiling',
        'Hips square to the floor',
        'No arch in the back',
      ],
      mistakes: [
        'Lifting too high so the lower back arches.',
        'Rolling the hip open to get more height.',
        'Swinging the leg instead of lifting with control.',
        'Letting the supporting shoulder or hip sag.',
      ],
      breathing: 'Breathe out as you lift, breathe in as you lower.',
      tempo: '1 second up, a brief squeeze, 1 to 2 seconds down.',
    },
    keys: {
      start: {
        label: 'Knee under hip',
        pelvis: QUAD_PELVIS,
        neck: { flex: 8 },
        legs: { L: QUAD_KNEE_L, R: { hip: { flex: 76 }, knee: 95, ankle: -45 } },
        arms: QUAD_HANDS,
      },
      kick: {
        label: 'Heel up',
        pelvis: QUAD_PELVIS,
        neck: { flex: 8 },
        legs: { L: QUAD_KNEE_L, R: { hip: { flex: -4 }, knee: 90, ankle: 0 } },
        arms: QUAD_HANDS,
      },
    },
    seq: ['start', 'kick'],
    tempo: [0.9, 1.3],
    holds: { kick: 0.6, start: 0.2 },
  },

  fireHydrant: {
    camera: { yaw: 0, pitch: 12 },
    muscles: { primary: ['glutes'], secondary: ['core', 'obliques'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips.',
        'Back flat, neck long, abs gently braced.',
        'Weight spread evenly between both hands and the supporting knee.',
      ],
      steps: [
        'Keep the knee bent at 90 degrees and lift one leg out to the side.',
        'Raise the knee as high as you can while the hips and shoulders stay square to the floor.',
        'Pause and squeeze the side of the glute.',
        'Lower slowly back under the hip, then repeat and swap sides.',
      ],
      cues: [
        'Knee out to the side, hips square',
        'Stay tall through the arms',
        'Slow and controlled',
      ],
      mistakes: [
        'Leaning the whole body away from the working leg to fake more height.',
        'Letting the lower back sag or arch.',
        'Straightening the knee as it lifts.',
        'Rushing the reps and swinging the leg.',
      ],
      breathing: 'Breathe out as the knee lifts, breathe in as it lowers.',
      tempo: '1 second up, a brief pause, 1 to 2 seconds down.',
    },
    keys: {
      start: {
        label: 'Knee under hip',
        pelvis: QUAD_PELVIS,
        neck: { flex: 8 },
        legs: { L: QUAD_KNEE_L, R: { hip: { flex: 76 }, knee: 90, ankle: -45 } },
        arms: QUAD_HANDS,
      },
      open: {
        label: 'Knee out',
        pelvis: QUAD_PELVIS,
        neck: { flex: 8 },
        legs: { L: QUAD_KNEE_L, R: { hip: { flex: 78, abd: 68 }, knee: 90, ankle: -45 } },
        arms: QUAD_HANDS,
      },
    },
    seq: ['start', 'open'],
    tempo: [0.9, 1.2],
    holds: { open: 0.6, start: 0.2 },
  },
};
