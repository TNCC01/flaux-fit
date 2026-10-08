/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, surf fitness: pop-ups, paddling, shoulder care and
  stance work. See js/moves/README.md.
*/

const r3 = (v) => Math.round(v * 1000) / 1000;
// up on the toes: the ankle target for a foot whose flat ankle sits at
// `flat`, heel raised `deg` degrees about the toe tip (see gear.js)
function onToes(flat, deg) {
  const a = ((20.22 + deg) * Math.PI) / 180, L = 0.2025;
  return [flat[0], r3(L * Math.sin(a)), r3(flat[2] + 0.19 - L * Math.cos(a))];
}

// ---------------------------------------------------------- the board line
// Lying on the board: face down along Z, head to +Z. The hands sit flat
// beside the lower ribs and stay on the same spots for the whole pop-up,
// so they never slide.
const HAND_Z = 0.24;
const HANDS = (elbow) => ({ L: { hand: [0.22, 0.03, HAND_Z], elbow, palm: 'floor' }, R: 'mirror' });
const PRONE_Z = -0.1;                     // hip joints while lying down

// Regular stance (left foot forward): side-on to the board line, facing -X,
// the left side towards the nose (+Z). The front foot lands just behind the
// hands, between them; the back foot about where the knees were.
const FRONT = [0.1, 0.07, 0.14];
const BACK = [0.1, 0.07, -0.42];
const STANCE_LEGS = {
  L: { foot: FRONT, toeOut: 20, knee: [-1, 0, 0.15] },
  R: { foot: BACK, toeOut: -5, knee: [-1, 0, 0.3] },
};

const prone = (label) => ({
  label,
  pelvis: { pos: [0, 0.11, PRONE_Z], pitch: 90 },
  spine: { flex: -14 },
  neck: { flex: -18 },
  legs: { L: { hip: { flex: 0, abd: 3 }, knee: 0, ankle: -50 }, R: 'mirror' },
  arms: HANDS([0.4, 1, -0.6]),
});

const stance = (label, extra = {}) => ({
  label,
  pelvis: { pos: [0.15, 0.64, -0.14], yaw: -90, pitch: 20 },
  spine: { flex: 6, twist: 22 },
  neck: { flex: -8, twist: 50 },
  legs: STANCE_LEGS,
  arms: {
    L: { shoulder: { elev: 62, plane: 55 }, elbow: 25 },
    R: { shoulder: { elev: 38, plane: 85 }, elbow: 35 },
  },
  ...extra,
});

// the pop: press, then the feet come through under the chest in one go
const POP = {
  prone: prone('On the board'),
  press: {
    label: 'Press',
    pelvis: { pos: [0, 0.36, -0.1], pitch: 68 },
    spine: { flex: -8 },
    neck: { flex: -14 },
    legs: { L: { foot: [0.1, 0.12, -0.92], knee: 'down', ankle: -30 }, R: 'mirror' },
    arms: HANDS([0.4, 0.4, -1]),
  },
  drive: {
    label: 'Hips up',
    pelvis: { pos: [0.02, 0.58, -0.08], pitch: 92, yaw: -6 },
    spine: { flex: 20, twist: 3 },
    neck: { flex: -34 },
    legs: {
      L: { foot: [0.08, 0.3, -0.45], knee: [0, -0.5, 1], ankle: -10 },
      R: { foot: [-0.02, 0.28, -0.5], knee: [-0.2, -0.5, 1], ankle: -10 },
    },
    arms: HANDS([0.4, 0.4, -1]),
  },
  tuck: {
    label: 'Feet through',
    pelvis: { pos: [0.04, 0.44, -0.12], pitch: 75, yaw: -18 },
    spine: { flex: 18, twist: 8 },
    neck: { flex: -28, twist: 4 },
    legs: {
      L: { foot: [0.06, 0.15, -0.15], knee: [-0.1, 0.3, 1] },
      R: { foot: [0.12, 0.15, -0.42], knee: [-1, -0.2, 0.2] },
    },
    arms: HANDS([0.4, 0.4, -1]),
  },
  stance: stance('Surf stance'),
};

// back down: turn square, hands either side of the front foot, step back to
// a plank and lower to the floor
const PLANK_P = { pos: [0, 0.402, r3(HAND_Z - 0.39)], pitch: 71 };
const PLANK_FOOT = [0.1, 0.122, -0.96];
const DOWN = {
  lunge: {
    label: 'Hands down',
    pelvis: { pos: [0.02, 0.47, -0.2], pitch: 74 },
    spine: { flex: 14 },
    neck: { flex: -10 },
    legs: {
      L: { foot: FRONT, toeOut: 0, knee: [0, 0, 1] },
      R: { foot: onToes([0.1, 0.07, -0.5], 40), toeOut: -5, knee: [0, -0.2, 1], heel: -40 },
    },
    arms: HANDS([0.4, 0.2, -1]),
  },
  stepR: {
    pass: true,
    pelvis: { pos: [0.01, 0.46, -0.2], pitch: 72 },
    spine: { flex: 8 },
    neck: { flex: -8 },
    legs: {
      L: { foot: FRONT, toeOut: 0, knee: [0, 0, 1] },
      R: { foot: [-0.06, 0.2, -0.8], knee: 'down', ankle: -20 },
    },
    arms: HANDS([0.4, 0.2, -1]),
  },
  backR: {
    label: 'Step back',
    pelvis: { pos: [0.01, 0.4, -0.19], pitch: 68 },
    spine: { flex: 5 },
    neck: { flex: -6 },
    legs: {
      L: { foot: FRONT, toeOut: 0, knee: [0, 0, 1] },
      R: { foot: [-0.1, 0.122, -0.96], knee: 'down', ankle: -30 },
    },
    arms: HANDS([0.4, 0.2, -1]),
  },
  stepL: {
    pass: true,
    pelvis: { pos: [0, 0.48, -0.19], pitch: 80 },
    spine: { flex: 14 },
    neck: { flex: -4 },
    legs: {
      L: { foot: [0.1, 0.25, -0.78], knee: [0, -0.3, 1], ankle: -20 },
      R: { foot: [-0.1, 0.122, -0.96], knee: 'down', ankle: -30 },
    },
    arms: HANDS([0.4, 0.2, -1]),
  },
  plank: {
    label: 'Plank',
    pelvis: PLANK_P,
    neck: { flex: 8 },
    legs: { L: { foot: PLANK_FOOT, knee: 'down', ankle: -30 }, R: 'mirror' },
    arms: HANDS([0.6, 0.2, -1]),
  },
  lower: {
    label: 'Lower down',
    pelvis: { pos: [0, 0.14, r3(HAND_Z - 0.33)], pitch: 86 },
    neck: { flex: 0 },
    legs: { L: { foot: PLANK_FOOT, knee: 'down', ankle: -30 }, R: 'mirror' },
    arms: HANDS([0.5, 0.6, -1]),
  },
};

// sprawl: from standing with the front foot already on its stance spot,
// drop the hands, kick the feet back and land flat on the floor
const TALL_FEET = { L: { foot: FRONT, toeOut: 8 }, R: { foot: [-0.14, 0.07, FRONT[2]], toeOut: 8 } };
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };
const SPRAWL = {
  tall: { label: 'Stand tall', pelvis: { pos: [-0.02, 0.93, FRONT[2]] }, legs: TALL_FEET, arms: ARMS_DOWN },
  drop: {
    label: 'Hands down',
    pelvis: { pos: [-0.02, 0.4, -0.08], pitch: 72 },
    spine: { flex: 16 },
    neck: { flex: -10 },
    legs: { L: { ...TALL_FEET.L, knee: [0.05, 0, 1] }, R: { ...TALL_FEET.R, knee: [-0.05, 0, 1] } },
    arms: HANDS([0.4, 0, -1]),
  },
  kick: {
    pass: true,
    pelvis: { pos: [-0.01, 0.55, -0.04], pitch: 86 },
    spine: { flex: 8 },
    neck: { flex: -10 },
    legs: { L: { foot: [0.1, 0.34, -0.62], knee: 'down', ankle: -20 }, R: 'mirror' },
    arms: HANDS([0.4, 0.2, -1]),
  },
  sprawl: {
    label: 'Sprawl',
    pelvis: { pos: [0, 0.11, PRONE_Z], pitch: 90 },
    spine: { flex: -22 },
    neck: { flex: -14 },
    legs: { L: { hip: { flex: 0, abd: 4 }, knee: 0, ankle: -50 }, R: 'mirror' },
    arms: HANDS([0.4, 1, -0.8]),
  },
  // stand up from the stance: the back foot steps up beside the front one
  // and the body turns to face the front
  stepUp: {
    pass: true,
    pelvis: { pos: [0.02, 0.84, -0.04], yaw: -45, pitch: 6 },
    neck: { twist: 20 },
    legs: { L: { foot: FRONT, toeOut: 14, knee: [-0.6, 0, 1] }, R: { foot: [-0.04, 0.22, -0.14], knee: [-0.6, 0, 1], ankle: -15 } },
    arms: { L: { shoulder: { elev: 30, plane: 60 }, elbow: 20 }, R: { shoulder: { elev: 25, plane: 70 }, elbow: 25 } },
  },
};

// bottom turn: compress low, chest and arms turn towards the toe side with
// the front arm leading, then rise as the shoulders come back round
const TURN = {
  compress: stance('Compress and turn', {
    pelvis: { pos: [0.17, 0.55, -0.14], yaw: -90, pitch: 28 },
    spine: { flex: 2, twist: 4, side: 6 },
    neck: { flex: -10, twist: 52 },
    arms: {
      L: { shoulder: { elev: 70, plane: 62 }, elbow: 8 },
      R: { shoulder: { elev: 28, plane: 40 }, elbow: 45 },
    },
  }),
  rise: stance('Rise', {
    pelvis: { pos: [0.13, 0.7, -0.14], yaw: -90, pitch: 12 },
    spine: { flex: 2, twist: 32 },
    neck: { flex: -10, twist: 45 },
    arms: {
      L: { shoulder: { elev: 80, plane: 85 }, elbow: 15 },
      R: { shoulder: { elev: 50, plane: 110 }, elbow: 25 },
    },
  }),
};

// ---------------------------------------------------------- prone work
// Face down, chest and thighs just off the floor, head up looking forward.
const LIFTED = {
  pelvis: { pos: [0, 0.11, 0], pitch: 90 },
  spine: { flex: -16 },
  neck: { flex: -20 },
  legs: { L: { hip: { flex: -7, abd: 4 }, knee: 0, ankle: -50 }, R: 'mirror' },
};
// one paddle stroke, by phase (left hand targets; the right arm runs half a
// stroke behind): reach long in front, pull back along the floor beside the
// chest with the elbow high, finish by the hip, recover through the air
const STROKE = [
  { hand: [0.21, 0.15, 0.92], elbow: [0.3, 1, 0] },                       // reach
  { hand: [0.33, 0.12, 0.4], elbow: [0.7, 1, 0] },                       // pull
  { hand: [0.27, 0.12, -0.08], elbow: [0.3, 1, -0.2] },                   // finish by the hip
  { hand: [0.36, 0.42, 0.42], elbow: [0.5, 1, -0.4] },                    // recover, elbow high
];
const flipArm = (a) => ({ ...a, hand: [-a.hand[0], a.hand[1], a.hand[2]], elbow: [-a.elbow[0], a.elbow[1], a.elbow[2]] });
const paddle = (i, label) => ({
  ...LIFTED,
  ...(label && { label }),
  arms: { L: STROKE[i], R: flipArm(STROKE[(i + 2) % 4]) },
});

const SWIM = {
  over: { label: 'Arms overhead', ...LIFTED, arms: { L: { shoulder: { elev: 165, plane: 110, twist: 90 }, elbow: 4 }, R: 'mirror' } },
  wide: { pass: true, ...LIFTED, arms: { L: { shoulder: { elev: 95, plane: 112, twist: 90 }, elbow: 6 }, R: 'mirror' } },
  back: { label: 'Hands to back', ...LIFTED, arms: { L: { hand: [0.06, 0.27, 0.12], elbow: [1, 1, 0] }, R: 'mirror' } },
};

// ---------------------------------------------------------- band paddle
// hinged at the hips about 45 degrees, back flat; band anchored in a door
// in front at about the height of the head in the hinge, so it runs past
// the ribs to the hip at the end of the pull
const ANCHOR = [0, 1.4, 1.35];
const HINGE = {
  pelvis: { pos: [0, 0.86, -0.14], pitch: 45 },
  neck: { flex: -18 },
  legs: { L: { foot: [0.13, 0.07, 0], toeOut: 6, knee: [0.15, 0, 1] }, R: 'mirror' },
};
const REACH = { shoulder: { elev: 145, plane: 8 }, elbow: 4, turn: -90 };
const TO_HIP = { shoulder: { elev: 14, plane: 40 }, elbow: 4, turn: -90 };

// ---------------------------------------------------------- dive bomber
const DD_HANDS = (elbow) => ({ L: { hand: [0.24, 0.03, 0], elbow, palm: 'floor' }, R: 'mirror' });
const DD_FEET = { L: { foot: [0.14, 0.122, -1.2], knee: 'down', ankle: -30 }, R: 'mirror' };

// ---------------------------------------------------------- high plank
const HP_HANDS = { L: { hand: [0.2, 0.03, -0.03], elbow: [0.5, 0, -1], palm: 'floor' }, R: 'mirror' };
const HP_FEET = { L: { foot: [0.09, 0.12, -1.26], knee: 'down', ankle: 0 }, R: 'mirror' };

// ---------------------------------------------------------- open book
// lying on the right side, head to -X, facing +Z, hips and knees at 90
const SIDE_LIE = {
  pelvis: { pos: [0, 0.19, 0], roll: -90 },
  spine: { side: 10 },
  neck: { side: -14 },
  legs: { L: { hip: { flex: 90, abd: 0 }, knee: 90, ankle: -10 }, R: { hip: { flex: 90, abd: 0 }, knee: 90, ankle: -10 } },
};
const BOOK_ARM = (plane) => ({ shoulder: { elev: 90, plane }, elbow: 3 });
// the bottom arm stays long on the floor in front the whole time
const FLOOR_ARM = { hand: [-0.49, 0.03, 0.5], elbow: [0, 1, -0.2], palm: 'floor' };

const DEEP = (label, dx, roll, side) => ({
  label,
  pelvis: { pos: [dx, 0.34, -0.17], pitch: 30, roll },
  spine: { flex: 0, side },
  neck: { flex: -12 },
  legs: {
    L: { foot: [0.2, 0.07, 0.02], toeOut: 22, knee: [0.55, 0.2, 1] },
    R: { foot: [-0.2, 0.07, 0.02], toeOut: 22, knee: [-0.55, 0.2, 1] },
  },
  arms: { L: { hand: [r3(dx + 0.035), 0.64, 0.27], elbow: [0.8, -1, 0.2], turn: 10 }, R: { hand: [r3(dx - 0.035), 0.64, 0.27], elbow: [-0.8, -1, 0.2], turn: 10 } },
});

const MOVES = {
  popUp: {
    camera: { yaw: -60, pitch: 12 },
    muscles: { primary: ['chest', 'triceps', 'hipFlexors', 'core'], secondary: ['shoulders', 'quads', 'glutes'] },
    coaching: {
      setup: [
        'Lie face down as if on your board, legs straight and together, toes pointed.',
        'Hands flat on the floor beside your lower ribs, not up by the shoulders, elbows tucked in to your sides.',
        'Lift the chest a little and look forward, like you are watching the wave come.',
      ],
      steps: [
        'Push the floor away hard and fast, straightening the arms as the chest comes up.',
        'In the same movement drive the hips up and snap both knees in under your chest.',
        'Bring both feet through together and land side-on: left foot between where your hands were, right foot about where your knees were.',
        'Land low with knees bent, feet a bit wider than the shoulders, chest up, arms out for balance and eyes looking forward over the front shoulder.',
        'Hold the stance for a moment, then put the hands down either side of the front foot, step back to a plank and lower to the floor under control.',
      ],
      cues: ['Hands by the ribs', 'Push, hips up, feet through', 'Land low and quiet', 'Eyes forward'],
      mistakes: [
        'Getting up to the knees first, or one foot at a time: that is two slow movements, and on a wave it costs you the drop.',
        'Hands up by the shoulders, which leaves no room for the feet to come through and puts the shoulders in a weak spot.',
        'Looking down at your feet as they land, which pulls the chest down and throws your balance.',
        'Landing tall with straight legs, or with the feet too narrow, so there is nothing to absorb the board moving.',
      ],
      breathing: 'Breathe in on the board, breathe out hard on the push. Breathe steadily in the stance.',
      tempo: 'The pop is one quick movement, well under a second. Take your time getting back down.',
    },
    keys: { ...POP, ...DOWN },
    flow: ['press', 'drive', 'tuck'],
    seq: ['prone', 'press', 'drive', 'tuck', 'stance', 'lunge', 'stepR', 'backR', 'stepL', 'plank', 'lower'],
    tempo: [0.22, 0.15, 0.15, 0.22, 0.8, 0.3, 0.3, 0.3, 0.3, 0.9, 0.6],
    holds: { prone: 0.7, stance: 1.0, lunge: 0.2, backR: 0.05, plank: 0.15, lower: 0.1 },
  },

  sprawlPopUp: {
    camera: { yaw: -60, pitch: 12 },
    muscles: { primary: ['chest', 'triceps', 'quads', 'core'], secondary: ['shoulders', 'hipFlexors', 'glutes', 'calves'] },
    coaching: {
      setup: [
        'Stand tall with the feet about hip-width apart.',
        'Clear floor in front of and behind you, about your own height.',
      ],
      steps: [
        'Squat down and put the hands flat on the floor just in front of the feet.',
        'Kick both feet straight back and let the hips drop to the floor, chest up, like lying on your board.',
        'Without pausing, push the floor away, drive the hips up and bring both feet through into your surf stance, side-on and low.',
        'Hold the stance for a moment, eyes forward, then step the back foot up and stand tall facing the front.',
        'Go straight into the next rep.',
      ],
      cues: ['Down, back, flat', 'Pop straight up', 'Land low', 'Stand tall, go again'],
      mistakes: [
        'Pausing on the floor between the sprawl and the pop, which takes the conditioning out of it.',
        'Hips staying high in the sprawl, so you never practise the pop from flat.',
        'Popping up to the knees first as you tire. Slow down rather than let the pop break into two moves.',
        'Landing with straight legs or feet too close together.',
      ],
      breathing: 'Breathe out as the feet kick back and again as you pop up. Get a breath in as you stand.',
      tempo: 'About 3 seconds a rep, quick on the way down and the pop, a short hold in the stance.',
    },
    keys: { ...SPRAWL, press: POP.press, drive: POP.drive, tuck: POP.tuck, stance: POP.stance },
    flow: ['drop', 'kick', 'press', 'drive', 'tuck', 'stepUp'],
    seq: ['tall', 'drop', 'kick', 'sprawl', 'press', 'drive', 'tuck', 'stance', 'stepUp'],
    tempo: [0.35, 0.2, 0.25, 0.2, 0.15, 0.15, 0.22, 0.35, 0.35],
    holds: { tall: 0.3, sprawl: 0.15, stance: 0.6 },
  },

  popUpTurn: {
    camera: { yaw: -60, pitch: 12 },
    muscles: { primary: ['chest', 'triceps', 'quads', 'obliques'], secondary: ['shoulders', 'hipFlexors', 'glutes', 'core'] },
    coaching: {
      setup: [
        'Lie face down as if on your board, hands flat beside the lower ribs and elbows tucked.',
        'Chest lifted a little, eyes forward.',
      ],
      steps: [
        'Pop up in one movement into a low surf stance, side-on, knees bent.',
        'Compress: sink lower through the knees and ankles, keeping the chest up.',
        'Turn the head and shoulders towards your toes and lead with the front arm, as if setting up a bottom turn.',
        'Rise out of it as the shoulders come back round, then put the hands down, step back and lower to the floor.',
      ],
      cues: ['Pop, land low', 'Sink and look', 'Front arm leads', 'Rise through the legs'],
      mistakes: [
        'Bending at the waist to get low instead of bending the knees and ankles.',
        'Turning the arms only: the head and shoulders turn together, the hips follow.',
        'Standing up tall to start the turn, which takes the power away.',
        'Rushing the pop to get to the turn: land balanced first.',
      ],
      breathing: 'Breathe out hard on the pop, breathe in as you settle, out as you compress and turn.',
      tempo: 'Quick pop, then about 1 second down into the turn and 1 second up.',
    },
    keys: { ...POP, ...TURN, ...DOWN },
    flow: ['press', 'drive', 'tuck'],
    seq: ['prone', 'press', 'drive', 'tuck', 'stance', 'compress', 'rise', 'lunge', 'stepR', 'backR', 'stepL', 'plank', 'lower'],
    tempo: [0.22, 0.15, 0.15, 0.22, 0.9, 0.9, 0.8, 0.3, 0.3, 0.3, 0.3, 0.9, 0.6],
    holds: { prone: 0.7, stance: 0.4, compress: 0.4, rise: 0.4, lunge: 0.2, backR: 0.05, plank: 0.15, lower: 0.1 },
  },

  pronePaddle: {
    camera: { yaw: 50, pitch: 16 },
    muscles: { primary: ['lats', 'upperBack', 'shoulders'], secondary: ['lowerBack', 'triceps', 'glutes', 'traps'] },
    coaching: {
      setup: [
        'Lie face down with the legs straight and together, toes pointed.',
        'Lift the chest and thighs just off the floor, like lying on your board with the chest up.',
        'Head up a little, eyes looking forward, not up at the ceiling.',
      ],
      steps: [
        'Reach one arm long in front of you, hand low as if it is going into the water.',
        'Pull it back past the shoulder and ribs to the hip, as if pulling water.',
        'Lift the elbow and bring the hand forward through the air to reach again.',
        'As one arm pulls, the other recovers: keep a smooth, steady rhythm.',
      ],
      cues: ['Long reach', 'Pull to the hip', 'Chest stays up', 'Smooth and steady'],
      mistakes: [
        'Letting the chest drop to the floor as the arms tire.',
        'Short choppy strokes that stop at the shoulder instead of finishing at the hip.',
        'Cranking the head back to look up, which strains the neck.',
        'Kicking or bending the knees: the legs stay long and quiet.',
      ],
      breathing: 'Breathe steadily through the nose and mouth, about one breath every two strokes.',
      tempo: 'About one stroke a second with each arm, like a steady paddle back out.',
    },
    keys: { s0: paddle(0, 'Reach'), s1: paddle(1), s2: paddle(2, 'Pull to the hip'), s3: paddle(3) },
    flow: ['s1', 's2', 's3'],
    seq: ['s0', 's1', 's2', 's3'],
    tempo: 0.45,
    holds: { s0: 0, s1: 0, s2: 0, s3: 0 },
  },

  proneSwimmer: {
    camera: { yaw: 35, pitch: 28 },
    muscles: { primary: ['upperBack', 'shoulders', 'lowerBack'], secondary: ['traps', 'lats', 'glutes'] },
    coaching: {
      setup: [
        'Lie face down with the legs straight, toes pointed.',
        'Lift the chest just off the floor, eyes looking down a little ahead of you.',
        'Arms straight out overhead, just off the floor, thumbs pointing up.',
      ],
      steps: [
        'Keep the arms long and sweep them out wide and round, just off the floor.',
        'Keep going until the hands meet behind the lower back, bending the elbows a little at the end.',
        'Sweep them back out wide and round to overhead the same way.',
        'Keep the chest lifted the whole set.',
      ],
      cues: ['Thumbs up', 'Arms off the floor', 'Chest stays up'],
      mistakes: [
        'Letting the arms drag on the floor, which takes the work off the upper back.',
        'Shrugging the shoulders up to the ears.',
        'Arching hard through the lower back to get the chest higher.',
        'Rushing, so the arms swing rather than sweep.',
      ],
      breathing: 'Breathe out as the arms sweep back to the hips, in as they go overhead.',
      tempo: 'About 2 seconds each way, a short pause at each end.',
    },
    keys: SWIM,
    seq: ['over', 'wide', 'back', 'wide'],
    tempo: [1.0, 1.0, 1.0, 1.0],
    holds: { over: 0.4, back: 0.4, wide: 0 },
  },

  bandPaddlePull: {
    camera: { yaw: 70, pitch: 10 },
    props: [
      { type: 'band', from: ANCHOR, to: 'handL', handles: true, rest: 0.9 },
      { type: 'band', from: ANCHOR, to: 'handR', handles: true, rest: 0.9 },
    ],
    muscles: { primary: ['lats', 'triceps'], secondary: ['upperBack', 'core', 'shoulders', 'hamstrings'] },
    coaching: {
      setup: [
        'Anchor the band in a door in front of you, about level with your head once you hinge forward, and hold a handle in each hand.',
        'Step back until the band has some tension with the arms reaching up and forward.',
        'Feet hip-width, knees soft, hinge forward at the hips to about 45 degrees with a flat back.',
      ],
      steps: [
        'Keep one arm reaching forward and pull the other down in a long arc to the hip, elbow nearly straight.',
        'Let it go back up under control as the other arm pulls down.',
        'Keep swapping arms like paddle strokes, with the trunk still.',
      ],
      cues: ['Long arms', 'Pull to the hip', 'Flat back, hips still'],
      mistakes: [
        'Bending the elbow so it turns into a row.',
        'Rounding the back or standing up as you pull.',
        'Twisting the trunk to help the arm through.',
        'Letting the band snap the arm back up.',
      ],
      breathing: 'Breathe steadily, about one breath for each pair of strokes.',
      tempo: 'About 1 second down, 1 second back for each arm.',
    },
    keys: {
      pullL: { label: 'Left to the hip', ...HINGE, arms: { L: TO_HIP, R: REACH } },
      pullR: { label: 'Right to the hip', ...HINGE, arms: { L: REACH, R: TO_HIP } },
    },
    seq: ['pullL', 'pullR'],
    tempo: [1.0, 1.0],
    holds: { pullL: 0.2, pullR: 0.2 },
  },

  duckDivePushup: {
    camera: { yaw: 75, pitch: 10 },
    muscles: { primary: ['chest', 'shoulders', 'triceps'], secondary: ['core', 'lowerBack', 'hamstrings'] },
    coaching: {
      setup: [
        'Start in a push-up position, hands a little wider than the shoulders and feet a little wider than the hips.',
        'Walk the feet in a step and push the hips up high so the body makes an upside-down V.',
        'Head between the arms, arms straight.',
      ],
      steps: [
        'Bend the elbows and swoop the chest down and forward, skimming just above the floor between the hands.',
        'Keep going forward and up: straighten the arms, lift the chest and let the hips sink towards the floor.',
        'Pause with the chest up and shoulders down away from the ears.',
        'Reverse the same path: bend the elbows, chest low, and push the hips back up to the V.',
      ],
      cues: ['Hips high', 'Chest skims the floor', 'Up and through', 'Same way back'],
      mistakes: [
        'Dropping straight down and pushing up like a normal push-up, which misses the swoop.',
        'Letting the hips crash to the floor before the chest is through.',
        'Shrugging the shoulders up to the ears at the top.',
        'Hands or feet shuffling as you move.',
      ],
      breathing: 'Breathe in as you swoop down and through, breathe out as you push back up to the V.',
      tempo: 'About 2 seconds through and 2 seconds back.',
    },
    keys: {
      pike: {
        label: 'Hips high',
        pelvis: { pos: [0, 0.76, -0.64], pitch: 136 },
        neck: { flex: 10 },
        legs: DD_FEET,
        arms: DD_HANDS([0.4, 0, -1]),
      },
      dip: {
        pass: true,
        pelvis: { pos: [0, 0.5, -0.56], pitch: 112 },
        neck: { flex: -6 },
        legs: DD_FEET,
        arms: DD_HANDS([0.7, 0.4, -1]),
      },
      skim: {
        label: 'Chest skims',
        pass: true,
        pelvis: { pos: [0, 0.25, -0.37], pitch: 86 },
        spine: { flex: -8 },
        neck: { flex: -14 },
        legs: DD_FEET,
        arms: DD_HANDS([0.7, 0.4, -1]),
      },
      up: {
        label: 'Chest up',
        pelvis: { pos: [0, 0.29, -0.36], pitch: 74 },
        spine: { flex: -30 },
        neck: { flex: -18 },
        legs: DD_FEET,
        arms: DD_HANDS([0.4, 0, -1]),
      },
    },
    seq: ['pike', 'dip', 'skim', 'up', 'skim', 'dip'],
    tempo: [0.7, 0.6, 0.7, 0.7, 0.6, 0.7],
    holds: { pike: 0.4, up: 0.4 },
  },

  scapPushup: {
    camera: { yaw: 80, pitch: 12 },
    muscles: { primary: ['upperBack', 'shoulders'], secondary: ['chest', 'core', 'traps'] },
    coaching: {
      setup: [
        'Start in a high plank: hands under the shoulders, arms straight, legs straight behind on the balls of the feet.',
        'One straight line from head to heels, glutes and abs switched on.',
      ],
      steps: [
        'Keep the arms locked and let the chest sink down between the shoulder blades as they squeeze together.',
        'Push the floor away so the shoulder blades spread apart and the upper back rounds slightly.',
        'Pause, then let the chest sink again.',
      ],
      cues: ['Arms stay straight', 'Sink, then push the floor away', 'Small movement'],
      mistakes: [
        'Bending the elbows so it turns into a small push-up.',
        'Letting the hips sag or pike up while the shoulders move.',
        'Shrugging the shoulders up to the ears instead of moving them in and out.',
        'Rushing: the movement is only a few centimetres, so make it slow and deliberate.',
      ],
      breathing: 'Breathe in as the chest sinks, out as you push the floor away.',
      tempo: 'About 1 second each way, a short pause at the top.',
    },
    keys: {
      sink: { label: 'Chest sinks', pelvis: { pos: [0, 0.368, -0.447], pitch: 71 }, spine: { flex: 0 }, neck: { flex: 8 },
        legs: HP_FEET, arms: { L: { ...HP_HANDS.L, reach: -0.045 }, R: 'mirror' } },
      push: { label: 'Push away', pelvis: { pos: [0, 0.44, -0.447], pitch: 71 }, spine: { flex: 5 }, neck: { flex: 14 },
        legs: HP_FEET, arms: { L: { ...HP_HANDS.L, reach: 0.015 }, R: 'mirror' } },
    },
    seq: ['sink', 'push'],
    tempo: [1.0, 1.0],
    holds: { sink: 0.3, push: 0.4 },
  },

  bandExternalRotation: {
    camera: { yaw: -20, pitch: 30 },
    props: [{ type: 'band', from: [0.7, 1.06, 0.2], to: 'handR', rest: 0.5 }],
    muscles: { primary: ['shoulders', 'upperBack'], secondary: ['traps', 'forearms'] },
    coaching: {
      setup: [
        'Anchor the band at elbow height to your left, on a door handle or post, and stand side-on to it.',
        'Hold the band in the right hand with the elbow tucked in against your side, bent to 90 degrees.',
        'Forearm across the belly, thumb up, standing tall.',
      ],
      steps: [
        'Keep the elbow pinned to your side and rotate the forearm out, away from the belly.',
        'Go as far as you can without the elbow leaving your side, about to straight ahead or a little past.',
        'Pause, then let the forearm come back across the belly slowly.',
        'Do all your reps, then turn around and work the left arm.',
      ],
      cues: ['Elbow glued to your side', 'Rotate, do not swing', 'Slow on the way back'],
      mistakes: [
        'Letting the elbow drift away from the side, which turns it into a different movement.',
        'Twisting the trunk to move the band.',
        'Using a band so heavy you have to jerk it.',
        'Bending the wrist instead of turning the whole forearm.',
      ],
      breathing: 'Breathe out as you rotate out, breathe in on the way back.',
      tempo: 'About 1 second out, a short pause, 2 seconds back.',
    },
    keys: {
      in: { label: 'Across the belly', legs: { L: { foot: [0.12, 0.07, 0], toeOut: 6 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 6, plane: 60 }, elbow: 10 }, R: { shoulder: { elev: 4, plane: 0, twist: -38 }, elbow: 90 } } },
      out: { label: 'Rotate out', legs: { L: { foot: [0.12, 0.07, 0], toeOut: 6 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 6, plane: 60 }, elbow: 10 }, R: { shoulder: { elev: 4, plane: 0, twist: 55 }, elbow: 90 } } },
    },
    seq: ['in', 'out'],
    tempo: [1.0, 1.8],
    holds: { in: 0.3, out: 0.4 },
  },

  surfStanceHold: {
    camera: { yaw: -60, pitch: 10 },
    muscles: { primary: ['quads', 'glutes', 'core'], secondary: ['adductors', 'calves', 'obliques', 'hamstrings'] },
    coaching: {
      setup: [
        'Stand side-on in your surf stance: left foot forward for regular, right foot forward for goofy.',
        'Feet a little wider than the shoulders, front foot turned slightly forward, back foot across.',
        'Knees and ankles bent, chest up, arms out loosely, eyes looking forward over the front shoulder.',
      ],
      steps: [
        'Shift your weight slowly onto the front foot, staying low.',
        'Shift it back onto the back foot.',
        'Come back to the middle and sink a little lower, then rise back to your riding height.',
        'Keep it smooth, like riding a wave, for the whole hold.',
      ],
      cues: ['Low and soft', 'Chest up, eyes forward', 'Weight moves, feet stay'],
      mistakes: [
        'Standing up tall with straight legs.',
        'Bending at the waist to get low instead of bending the knees.',
        'Feet too close together, which makes you wobble.',
        'Looking down at the feet.',
      ],
      breathing: 'Breathe slowly and steadily through the whole hold.',
      tempo: 'Slow: about 2 seconds for each weight shift.',
    },
    keys: {
      ride: stance('Riding'),
      front: stance('Weight forward', { pelvis: { pos: [0.15, 0.62, -0.06], yaw: -90, pitch: 22 } }),
      back: stance('Weight back', { pelvis: { pos: [0.15, 0.62, -0.22], yaw: -90, pitch: 18 } }),
      low: stance('Compress', { pelvis: { pos: [0.17, 0.56, -0.14], yaw: -90, pitch: 26 },
        arms: { L: { shoulder: { elev: 55, plane: 50 }, elbow: 30 }, R: { shoulder: { elev: 32, plane: 80 }, elbow: 40 } } }),
    },
    seq: ['ride', 'front', 'ride', 'back', 'ride', 'low'],
    tempo: [1.8, 1.8, 1.8, 1.8, 1.4, 1.4],
    holds: { ride: 0.3, front: 0.5, back: 0.5, low: 0.5 },
  },

  deepSquatHold: {
    camera: { yaw: 30, pitch: 10 },
    muscles: { primary: ['quads', 'glutes', 'adductors'], secondary: ['calves', 'lowerBack', 'core', 'hamstrings'] },
    coaching: {
      setup: [
        'Feet a bit wider than the hips, toes turned out a little.',
        'Sit straight down as deep as you can with the heels flat.',
        'Hands together in front of the chest, elbows inside the knees.',
      ],
      steps: [
        'Settle at the bottom with the chest up and the heels down.',
        'Use the elbows to push the knees gently out over the toes.',
        'Sway slowly from side to side, letting the weight move between the feet.',
        'Stand up slowly when the time is up.',
      ],
      cues: ['Heels down', 'Chest up', 'Elbows push the knees out', 'Breathe and relax into it'],
      mistakes: [
        'Heels lifting off the floor: widen the feet or turn the toes out a bit more.',
        'Knees falling in towards each other.',
        'Rounding the back and dropping the chest.',
        'Bouncing at the bottom instead of settling.',
      ],
      breathing: 'Slow, relaxed breaths. Let each breath out take you a little deeper.',
      tempo: 'A slow sway, about 2 seconds each way.',
    },
    keys: { mid: DEEP('Deep squat', 0, 0, 0), left: DEEP('Sway left', 0.05, -3, -3), right: DEEP('Sway right', -0.05, 3, 3) },
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: [1.8, 1.8, 1.8, 1.8],
    holds: { mid: 0.4, left: 0.5, right: 0.5 },
  },

  thoracicRotation: {
    camera: { yaw: -50, pitch: 35 },
    muscles: { primary: ['upperBack', 'obliques'], secondary: ['chest', 'shoulders', 'lowerBack'] },
    coaching: {
      setup: [
        'Lie on your right side with the hips and knees bent to 90 degrees, knees stacked.',
        'Arms straight out in front at shoulder height, palms together.',
        'A small pillow or folded towel under the head is fine.',
      ],
      steps: [
        'Keep the knees together and lift the top arm up and over, following the hand with your eyes.',
        'Let the chest turn towards the ceiling and the arm open out to the other side, as far as it goes comfortably.',
        'Pause and breathe out, then bring the arm back over to the start.',
        'Do all your reps, then lie on the other side.',
      ],
      cues: ['Knees stay stacked', 'Eyes follow the hand', 'Open like a book'],
      mistakes: [
        'Letting the top knee slide back, which twists the lower back instead of the upper back.',
        'Bending the elbow and throwing the arm instead of reaching it long.',
        'Forcing the hand to the floor: go only as far as feels comfortable.',
        'Holding the breath.',
      ],
      breathing: 'Breathe out as you open, in as you come back.',
      tempo: 'Slow: about 2 to 3 seconds each way, a pause when open.',
    },
    keys: {
      closed: { label: 'Arms together', ...SIDE_LIE, arms: { L: BOOK_ARM(0), R: FLOOR_ARM } },
      mid: { pass: true, ...SIDE_LIE, spine: { side: 10, twist: 28 }, neck: { side: -8, twist: 30 }, arms: { L: BOOK_ARM(90), R: FLOOR_ARM } },
      open: { label: 'Open', ...SIDE_LIE, spine: { side: 8, twist: 55 }, neck: { side: -4, twist: 50 }, arms: { L: BOOK_ARM(145), R: FLOOR_ARM } },
    },
    seq: ['closed', 'mid', 'open', 'mid'],
    tempo: [1.2, 1.2, 1.2, 1.2],
    holds: { closed: 0.6, open: 0.8 },
  },
};

export default MOVES;
