/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, squat and lunge family: see js/moves/README.md.
*/
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };

// ---------------------------------------------------------- helpers
const r3 = (v) => Math.round(v * 1000) / 1000;

// A point carried on the trunk: [x, up from the hip joints, forward], for a
// pelvis at `pos` tipped forward by `pitch` degrees (add about half of any
// spine flex). Puts hands, a bell or a bar where the chest actually is.
function onTrunk(pos, pitch, [x, up, fwd]) {
  const a = (pitch * Math.PI) / 180;
  return [r3(pos[0] + x), r3(pos[1] + up * Math.cos(a) - fwd * Math.sin(a)),
    r3(pos[2] + up * Math.sin(a) + fwd * Math.cos(a))];
}

// Up on the toes: the ankle target for a foot whose flat ankle sits at
// `flat`, with the heel raised `deg` degrees about the front of the foot
// (the rigid foot pivots on its toe tip, which stays where it was, so the foot doesn't slide). Note the
// engine's `heel` lifts the toes for positive values, so pair this with
// heel: -deg.
function onToes(flat, deg) {
  const a = ((20.22 + deg) * Math.PI) / 180, L = 0.2025;
  return [flat[0], r3(L * Math.sin(a)), r3(flat[2] + 0.19 - L * Math.cos(a))];
}
// the pelvis rise and shift that goes with it, for straight legs
const toesUp = (deg) => { const t = onToes([0, 0.07, 0], deg); return [r3(t[1] - 0.07), t[2]]; };

// hands together in front of the breastbone
const clasp = (pos, pitch) =>
  ({ L: { hand: onTrunk(pos, pitch, [0.045, 0.28, 0.25]), elbow: [0.6, -1, -0.2] }, R: 'mirror' });

// a kettlebell held by the horns at the chest (goblet): hands hooked over
// the handle, the bell hanging against the breastbone
const goblet = (pos, pitch) =>
  ({ L: { hand: onTrunk(pos, pitch, [0.07, 0.37, 0.2]), elbow: [0.3, -1, 0.2], wrist: -160 }, R: 'mirror' });

// one kettlebell racked on the right: hand at the collarbone, elbow tucked
// down in front of the ribs, bell resting against the outside of the forearm
const kbRack = (pos, pitch) =>
  ({ hand: onTrunk(pos, pitch, [-0.075, 0.4, 0.16]), elbow: [-0.3, -1, 0.4], wrist: -170 });

// a barbell in the front rack: bar on the front of the shoulders, elbows up
const barRack = (pos, pitch, elbow = [0.35, -0.7, 1]) =>
  ({ L: { hand: onTrunk(pos, pitch, [0.23, 0.4, 0.15]), elbow, wrist: -65 }, R: 'mirror' });

// arms hanging straight from the shoulders (dumbbells at the sides)
function hang(pos, pitch) {
  const sh = onTrunk(pos, pitch, [0.19, 0.445, -0.035]);
  return { L: { hand: [0.225, r3(sh[1] - 0.535), sh[2]], elbow: 'out' }, R: 'mirror' };
}

// the squat stance shared by most of the family
const FOOT = [0.15, 0.07, 0.01];
const stance = (knee = [0.25, 0, 1], foot = FOOT, toeOut = 15) => ({ L: { foot, toeOut, knee }, R: 'mirror' });
const STAND = stance();
const DEEP = stance([0.3, 0, 1]);
const TOP = [0, 0.93, 0];

// a loaded squat bottom (bell or bar at the chest): a little more upright
const FRONT_BOTTOM = [0, 0.44, -0.15];

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

  // ------------------------------------------------------------ squat pulses
  squatPulse: {
    camera: { yaw: 45 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'core'] },
    coaching: {
      setup: [
        'Feet shoulder-width apart, toes turned out slightly.',
        'Hands together in front of the chest.',
        'Squat down to the bottom of your range to start the set.',
      ],
      steps: [
        'Sit down into a full squat with the chest up and the knees over the toes.',
        'Rise only about halfway, to where the thighs are just above parallel.',
        'Sink straight back to the bottom and pulse again, staying low the whole set.',
        'Keep the weight on the whole foot and the back flat on every pulse.',
        'When the set is done, stand all the way up.',
      ],
      cues: ['Stay low', 'Small, steady pulses', 'Knees out, chest up'],
      mistakes: [
        'Standing up too far between pulses, which gives the legs a rest.',
        'Bouncing hard off the bottom instead of moving under control.',
        'Letting the knees drift in as the legs tire.',
        'Tipping the chest to the floor so the back does the work.',
      ],
      breathing: 'Short, steady breaths: out as you rise, in as you sink. Do not hold your breath.',
      tempo: 'About half a second up and half a second down, no rest at the top.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        pelvis: { pos: TOP },
        legs: STAND,
        arms: clasp(TOP, 0),
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.45, -0.19], pitch: 30 },
        spine: { flex: 5 },
        neck: { flex: -14 },
        legs: DEEP,
        arms: clasp([0, 0.45, -0.19], 32),
      },
      pulse: {
        label: 'Halfway',
        pelvis: { pos: [0, 0.6, -0.17], pitch: 27 },
        spine: { flex: 4 },
        neck: { flex: -12 },
        legs: stance([0.28, 0, 1]),
        arms: clasp([0, 0.6, -0.17], 29),
      },
    },
    seq: ['stand', 'bottom', 'pulse', 'bottom', 'pulse', 'bottom', 'pulse', 'bottom'],
    tempo: [1.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.2],
    holds: { stand: 0.6, bottom: 0.08, pulse: 0.05 },
  },

  // ------------------------------------------------------------ sumo squat
  sumoSquat: {
    camera: { yaw: 25, pitch: 6 },
    muscles: { primary: ['quads', 'glutes', 'adductors'], secondary: ['hamstrings', 'core'] },
    coaching: {
      setup: [
        'Feet wide, about one and a half times shoulder-width.',
        'Toes turned out 30 to 45 degrees, whatever your hips allow.',
        'Hands together at the chest, standing tall.',
      ],
      steps: [
        'Brace, then bend the knees and sit straight down between the heels.',
        'Push the knees out so they stay in line with the toes the whole way.',
        'Keep the chest up: the trunk stays more upright than in a normal squat.',
        'Lower until the thighs are about parallel, or as low as the knees stay out.',
        'Drive through the heels and squeeze the glutes and inner thighs to stand.',
      ],
      cues: ['Wide stance, toes out', 'Knees follow the toes', 'Sit straight down'],
      mistakes: [
        'Knees caving in past the toes, which twists the knee.',
        'Turning the toes out further than the hips can follow.',
        'Leaning forward and sticking the hips back like a narrow squat.',
        'Rolling onto the inside edges of the feet.',
      ],
      breathing: 'Breathe in and brace on the way down, breathe out as you stand.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        pelvis: { pos: [0, 0.89, 0] },
        legs: stance([0.64, 0, 0.77], [0.3, 0.07, 0.02], 40),
        arms: clasp([0, 0.89, 0], 0),
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.5, -0.07], pitch: 16 },
        spine: { flex: 3 },
        neck: { flex: -8 },
        legs: stance([0.7, 0, 0.72], [0.3, 0.07, 0.02], 40),
        arms: clasp([0, 0.5, -0.07], 18),
      },
    },
    seq: ['stand', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { bottom: 0.35, stand: 0.5 },
  },

  // ------------------------------------------------------------ squat to reach
  squatReach: {
    camera: { yaw: 45 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['shoulders', 'upperBack', 'core'] },
    coaching: {
      setup: [
        'Feet shoulder-width apart, toes turned out slightly.',
        'Stand tall, arms reaching overhead.',
      ],
      steps: [
        'Squat down, bringing the arms forward as the hips sit back.',
        'Get to a comfortable depth with the back flat and heels down.',
        'Drive up through the whole foot and, as you stand, sweep both arms up overhead.',
        'Finish tall: legs straight, glutes squeezed, arms by the ears, ribs down.',
      ],
      cues: ['Sit back, arms forward', 'Stand and reach for the ceiling', 'Ribs down at the top'],
      mistakes: [
        'Arching the lower back to get the arms overhead.',
        'Reaching before the legs have finished the work.',
        'Heels lifting at the bottom.',
        'Shrugging the neck short instead of reaching long.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you stand and reach.',
      tempo: 'About 2 seconds down, 1 second up into the reach.',
    },
    keys: {
      reach: {
        label: 'Reach',
        pelvis: { pos: TOP },
        spine: { flex: -2 },
        neck: { flex: -6 },
        legs: STAND,
        arms: { L: { shoulder: { elev: 168, plane: 25 }, elbow: 4 }, R: 'mirror' },
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.43, -0.2], pitch: 32 },
        spine: { flex: 6 },
        neck: { flex: -14 },
        legs: DEEP,
        arms: { L: { shoulder: { elev: 80, plane: 8 }, elbow: 6 }, R: 'mirror' },
      },
    },
    seq: ['reach', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { reach: 0.5, bottom: 0.25 },
  },

  // ------------------------------------------------------------ squat jumps
  jumpSquat: {
    camera: { yaw: 60, pitch: 4 },
    muscles: { primary: ['quads', 'glutes', 'calves'], secondary: ['hamstrings', 'core', 'shoulders'] },
    coaching: {
      setup: [
        'Feet shoulder-width apart, toes turned out slightly.',
        'Clear space above and around you, and a floor that is not slippery.',
      ],
      steps: [
        'Dip into a squat to about parallel, swinging the arms back.',
        'Drive the floor away hard, swinging the arms forward and up, and jump straight up.',
        'In the air, keep the body tall and the legs straight under you.',
        'Land softly on the balls of the feet, then let the heels come down as the knees and hips bend.',
        'Absorb the landing, reset, and go straight into the next jump.',
      ],
      cues: ['Arms back, then drive up', 'Land soft and quiet', 'Knees over the toes on landing'],
      mistakes: [
        'Landing stiff-legged, which jars the knees and back.',
        'Knees caving in as you land.',
        'Jumping forward instead of straight up.',
        'Rushing reps so the squat depth shrinks to a bob.',
      ],
      breathing: 'Breathe in as you dip, breathe out as you jump.',
      tempo: 'Quick dip and explode up, land and settle for a moment before the next jump.',
    },
    keys: {
      stand: {
        label: 'Ready',
        legs: STAND,
        arms: ARMS_DOWN,
      },
      dip: {
        label: 'Load',
        pelvis: { pos: [0, 0.56, -0.18], pitch: 34 },
        spine: { flex: 5 },
        neck: { flex: -16 },
        legs: stance([0.28, 0, 1]),
        arms: { L: { shoulder: { elev: 50, plane: 172 }, elbow: 12 }, R: 'mirror' },
      },
      takeoff: {
        label: 'Drive',
        pelvis: { pos: [0, 0.995, 0.06], pitch: 4 },
        neck: { flex: -4 },
        legs: { L: { foot: onToes(FOOT, 40), toeOut: 15, knee: [0.25, 0, 1], heel: -40 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 140, plane: 15 }, elbow: 10 }, R: 'mirror' },
      },
      air: {
        label: 'In the air',
        pelvis: { pos: [0, 1.2, 0.05], pitch: 2 },
        legs: { L: { foot: [0.15, 0.36, 0.05], toeOut: 15, knee: [0.25, 0, 1], ankle: -35 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 150, plane: 20 }, elbow: 12 }, R: 'mirror' },
      },
      land: {
        label: 'Soft landing',
        pelvis: { pos: [0, 0.68, -0.15], pitch: 28 },
        spine: { flex: 4 },
        neck: { flex: -12 },
        legs: stance([0.28, 0, 1]),
        arms: { L: { shoulder: { elev: 60, plane: 10 }, elbow: 12 }, R: 'mirror' },
      },
    },
    seq: ['stand', 'dip', 'takeoff', 'air', 'land'],
    tempo: [0.9, 0.3, 0.22, 0.32, 0.8],
    holds: { dip: 0.05, takeoff: 0, air: 0, land: 0.25, stand: 0.4 },
  },

  // ------------------------------------------------------------ assisted pistol
  pistolSquat: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'rings' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'core', 'lats'] },
    coaching: {
      setup: [
        'Stand facing the rings (or a doorframe) and hold them at chest height, arms bent.',
        'Balance on one foot, the other leg just off the floor in front.',
        'Standing foot flat, weight over the middle of the foot.',
      ],
      steps: [
        'Sit the hips back and down on the standing leg, reaching the free leg forward as you go.',
        'Keep the standing knee in line with the middle toes and the heel down.',
        'Let the arms straighten as you lower, using the rings only as much as you need.',
        'Go as deep as you can control, then drive through the whole foot to stand.',
        'Do all the reps on one side, then swap legs.',
      ],
      cues: ['Knee over the toes', 'Heel stays down', 'Pull only as much as you need'],
      mistakes: [
        'Knee caving in towards the middle.',
        'Heel lifting at the bottom.',
        'Hauling yourself up with the arms instead of the leg.',
        'Dropping into the bottom without control.',
      ],
      breathing: 'Breathe in as you lower, breathe out as you drive up.',
      tempo: 'About 3 seconds down, a brief pause, 1 to 2 seconds up.',
    },
    keys: {
      top: {
        label: 'One leg',
        pelvis: { pos: [0.035, 0.92, 0] },
        legs: {
          L: { foot: [0.09, 0.07, 0.01], toeOut: 8, knee: [0.12, 0, 1] },
          R: { hip: { flex: 30 }, knee: 40, ankle: -10 },
        },
        arms: { L: { hand: [0.22, 1.12, 0.38], elbow: [0.4, -1, -0.6] }, R: 'mirror' },
      },
      mid: {
        label: 'Lowering',
        pelvis: { pos: [0.04, 0.66, -0.12], pitch: 24 },
        spine: { flex: 5 },
        neck: { flex: -12 },
        legs: {
          L: { foot: [0.09, 0.07, 0.01], toeOut: 8, knee: [0.14, 0, 1] },
          R: { hip: { flex: 95 }, knee: 25, ankle: -5 },
        },
        arms: { L: { hand: [0.22, 1.03, 0.42], elbow: [0.4, -1, -0.6] }, R: 'mirror' },
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0.045, 0.4, -0.2], pitch: 36 },
        spine: { flex: 8 },
        neck: { flex: -18 },
        legs: {
          L: { foot: [0.09, 0.07, 0.01], toeOut: 8, knee: [0.15, 0, 1] },
          R: { hip: { flex: 128 }, knee: 12, ankle: 5 },
        },
        arms: { L: { hand: [0.22, 0.95, 0.44], elbow: [0.4, -1, -0.6] }, R: 'mirror' },
      },
    },
    seq: ['top', 'mid', 'bottom', 'mid'],
    tempo: [1.4, 1.4, 0.75, 0.75],
    holds: { bottom: 0.4, top: 0.5, mid: 0 },
  },

  // ------------------------------------------------------------ wall sit
  wallSit: {
    camera: { yaw: 75, pitch: 6 },
    props: [{ type: 'wall', z: -0.215 }],
    muscles: { primary: ['quads'], secondary: ['glutes', 'adductors', 'core'] },
    coaching: {
      setup: [
        'Stand with your back flat against a wall.',
        'Walk the feet out about a thigh-length from the wall, hip-width apart.',
      ],
      steps: [
        'Slide down the wall until the thighs are parallel to the floor.',
        'Knees stacked over the ankles, shins vertical, knees in line with the toes.',
        'Keep the lower back, upper back and head against the wall.',
        'Reach the arms forward, or cross them on the chest. Hands stay off the thighs.',
        'Hold for the time, breathing steadily, then slide back up.',
      ],
      cues: ['Thighs parallel', 'Back flat on the wall', 'Knees over the ankles'],
      mistakes: [
        'Feet too close to the wall, so the knees push out past the toes.',
        'Resting the hands on the thighs, which takes the load off the legs.',
        'Sitting too high to make it easier.',
        'Holding the breath.',
      ],
      breathing: 'Slow, steady breaths through the whole hold.',
      tempo: 'Slide down over 2 seconds, then hold still for the set time.',
    },
    keys: {
      top: {
        label: 'Back to the wall',
        pelvis: { pos: [0, 0.8, 0] },
        legs: { L: { foot: [0.12, 0.07, 0.43], toeOut: 8, knee: [0.1, 0, 1] }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      hold: {
        label: 'Hold',
        pelvis: { pos: [0, 0.5, 0] },
        legs: { L: { foot: [0.12, 0.07, 0.43], toeOut: 8, knee: [0.1, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 84, plane: 4 }, elbow: 6 }, R: 'mirror' },
      },
      breathe: {
        label: 'Breathe',
        pelvis: { pos: [0, 0.503, 0] },
        spine: { flex: -2 },
        neck: { flex: -2 },
        legs: { L: { foot: [0.12, 0.07, 0.43], toeOut: 8, knee: [0.1, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 86, plane: 4 }, elbow: 6 }, R: 'mirror' },
      },
    },
    seq: ['top', 'hold', 'breathe', 'hold', 'breathe', 'hold', 'breathe', 'hold'],
    tempo: [2.0, 1.6, 1.8, 1.6, 1.8, 1.6, 1.8, 1.6],
    holds: { top: 0.8, hold: 0.3, breathe: 0.2 },
  },

  // ------------------------------------------------------------ calf raises
  calfRaise: {
    camera: { yaw: 70, pitch: 2 },
    muscles: { primary: ['calves'], secondary: ['core'] },
    coaching: {
      setup: [
        'Feet hip-width apart, toes pointing forward.',
        'Stand tall, knees straight but not locked.',
        'A hand lightly on a wall is fine for balance.',
      ],
      steps: [
        'Push through the balls of the feet and lift the heels as high as they go.',
        'Pause at the top, with the weight over the big and second toes.',
        'Lower the heels slowly all the way back to the floor.',
      ],
      cues: ['Slow up, slower down', 'Tall body, straight line', 'Weight over the big toe'],
      mistakes: [
        'Bouncing through the reps so the tendon does the work.',
        'Rolling out onto the little toes at the top.',
        'Leaning forward instead of rising straight up.',
        'Cutting the range short at the top.',
      ],
      breathing: 'Breathe out as you rise, breathe in as you lower.',
      tempo: 'About 1 to 2 seconds up, a 1 second pause, 3 seconds down.',
    },
    keys: {
      down: {
        label: 'Heels down',
        legs: { L: { foot: [0.11, 0.07, 0], toeOut: 5, knee: 'fwd' }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      up: {
        label: 'Up high',
        pelvis: { pos: [0, 0.93 + toesUp(40)[0], toesUp(40)[1]] },
        legs: { L: { foot: onToes([0.11, 0.07, 0], 40), toeOut: 5, knee: 'fwd', heel: -40 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
    },
    seq: ['down', 'up'],
    tempo: [1.5, 2.8],
    holds: { up: 0.8, down: 0.4 },
  },

  // ------------------------------------------------------------ single-leg calf raises
  singleLegCalfRaise: {
    camera: { yaw: 70, pitch: 2 },
    props: [{ type: 'wall', z: 0.6 }],
    muscles: { primary: ['calves'], secondary: ['core', 'glutes'] },
    coaching: {
      setup: [
        'Stand facing a wall, fingertips on it at shoulder height.',
        'Balance on one foot, the other foot tucked behind the ankle.',
        'The wall is for balance only: do not push on it.',
      ],
      steps: [
        'Rise onto the ball of the standing foot, lifting the heel as high as it goes.',
        'Pause at the top, weight over the big toe.',
        'Lower slowly until the heel is back on the floor.',
        'Do all the reps on one side, then swap feet.',
      ],
      cues: ['All the way up', 'Slow on the way down', 'Hands light on the wall'],
      mistakes: [
        'Pushing on the wall to help the lift.',
        'Bouncing out of the bottom.',
        'Rolling out onto the little toe.',
        'Bending the knee to fake the height.',
      ],
      breathing: 'Breathe out as you rise, breathe in as you lower.',
      tempo: 'About 1 to 2 seconds up, a 1 second pause, 3 seconds down.',
    },
    keys: {
      down: {
        label: 'Heel down',
        pelvis: { pos: [0.035, 0.93, 0] },
        legs: {
          L: { foot: [0.09, 0.07, 0], toeOut: 5, knee: 'fwd' },
          R: { hip: { flex: 4, abd: -4 }, knee: 70, ankle: -20 },
        },
        arms: { L: { hand: [0.24, 1.36, 0.45], elbow: [0.3, -1, -0.2], wrist: -50 }, R: 'mirror' },
      },
      up: {
        label: 'Up high',
        pelvis: { pos: [0.035, 0.93 + toesUp(40)[0], toesUp(40)[1]] },
        legs: {
          L: { foot: onToes([0.09, 0.07, 0], 40), toeOut: 5, knee: 'fwd', heel: -40 },
          R: { hip: { flex: 4, abd: -4 }, knee: 70, ankle: -20 },
        },
        arms: { L: { hand: [0.24, 1.36, 0.45], elbow: [0.3, -1, -0.2], wrist: -50 }, R: 'mirror' },
      },
    },
    seq: ['down', 'up'],
    tempo: [1.5, 2.8],
    holds: { up: 0.8, down: 0.4 },
  },

  // ------------------------------------------------------------ box jumps
  boxJump: {
    camera: { yaw: 80, pitch: 6 },
    props: [{ type: 'box', pos: [0, 0, 0.55], size: [0.6, 0.4, 0.4] }],
    muscles: { primary: ['quads', 'glutes', 'calves'], secondary: ['hamstrings', 'core', 'shoulders'] },
    coaching: {
      setup: [
        'Stand about a foot-length from a solid box that will not slide or tip.',
        'Feet hip-width, arms by your sides.',
        'Start with a low box: height comes later.',
      ],
      steps: [
        'Swing the arms back as you dip the hips and knees.',
        'Swing the arms forward and jump up, lifting the knees to bring the feet onto the box.',
        'Land softly with the whole foot on the box, knees over the toes, in a half squat.',
        'Stand up tall on the box.',
        'Step down backwards, one foot at a time. Do not jump down.',
      ],
      cues: ['Jump up, step down', 'Land soft and quiet', 'Stand tall on top'],
      mistakes: [
        'Jumping down off the box, which loads the tendons hard for no benefit.',
        'Landing in a deep squat because the box is too high.',
        'Knees caving in on the landing.',
        'Landing with the heels hanging off the edge.',
      ],
      breathing: 'Breathe in as you load, breathe out as you jump. Reset your breath on the box.',
      tempo: 'Explosive jump, a pause standing on the box, a slow controlled step down.',
    },
    keys: {
      stand: {
        label: 'Ready',
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 10 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      load: {
        label: 'Load',
        pelvis: { pos: [0, 0.62, -0.16], pitch: 34 },
        spine: { flex: 4 },
        neck: { flex: -18 },
        legs: { L: { foot: [0.13, 0.07, 0.02], toeOut: 10, knee: [0.2, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 55, plane: 172 }, elbow: 12 }, R: 'mirror' },
      },
      takeoff: {
        label: 'Take off',
        pelvis: { pos: [0, 0.99, 0.08], pitch: 8 },
        neck: { flex: -6 },
        legs: { L: { foot: onToes([0.13, 0.07, 0.02], 40), toeOut: 10, knee: [0.2, 0, 1], heel: -40 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 135, plane: 15 }, elbow: 10 }, R: 'mirror' },
      },
      flight: {
        label: 'Knees up',
        pelvis: { pos: [0, 1.12, 0.3], pitch: 20 },
        spine: { flex: 4 },
        neck: { flex: -14 },
        legs: { L: { foot: [0.13, 0.62, 0.18], toeOut: 10, knee: [0.2, 0.2, 1], ankle: -15 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 110, plane: 12 }, elbow: 14 }, R: 'mirror' },
      },
      land: {
        label: 'Land soft',
        pelvis: { pos: [0, 0.98, 0.42], pitch: 32 },
        spine: { flex: 4 },
        neck: { flex: -16 },
        legs: { L: { foot: [0.13, 0.47, 0.55], toeOut: 10, knee: [0.2, 0, 1], heel: -0.01 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 70, plane: 10 }, elbow: 12 }, R: 'mirror' },
      },
      top: {
        label: 'Stand tall',
        pelvis: { pos: [0, 1.33, 0.55] },
        legs: { L: { foot: [0.13, 0.47, 0.55], toeOut: 10, heel: -0.01 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      stepBack: {
        label: 'Step back',
        pelvis: { pos: [0, 1.2, 0.47], pitch: 12 },
        neck: { flex: 8 },
        legs: {
          L: { foot: [0.13, 0.47, 0.55], toeOut: 10, knee: [0.15, 0, 1], heel: -0.01 },
          R: { foot: [-0.13, 0.6, 0.18], toeOut: 10, knee: [-0.1, -0.3, 1], ankle: -10 },
        },
        arms: { L: { shoulder: { elev: 25, plane: 60 }, elbow: 15 }, R: 'mirror' },
      },
      stepDown: {
        label: 'Step down',
        pelvis: { pos: [0, 0.84, 0.27], pitch: 12 },
        neck: { flex: 8 },
        legs: {
          L: { foot: [0.13, 0.47, 0.55], toeOut: 10, knee: [0.15, 0, 1], heel: -0.01 },
          R: { foot: [-0.13, 0.07, 0.02], toeOut: 10, knee: [-0.1, 0, 1] },
        },
        arms: { L: { shoulder: { elev: 25, plane: 60 }, elbow: 15 }, R: 'mirror' },
      },
      follow: {
        label: 'Other foot',
        pelvis: { pos: [0, 0.9, 0.12], pitch: 6 },
        legs: {
          L: { foot: [0.13, 0.52, 0.2], toeOut: 10, knee: [0.15, 0.2, 1], ankle: -10 },
          R: { foot: [-0.13, 0.07, 0.02], toeOut: 10, knee: [-0.1, 0, 1] },
        },
        arms: { L: { shoulder: { elev: 15, plane: 70 }, elbow: 12 }, R: 'mirror' },
      },
    },
    seq: ['stand', 'load', 'takeoff', 'flight', 'land', 'top', 'stepBack', 'stepDown', 'follow'],
    tempo: [0.8, 0.3, 0.22, 0.3, 0.8, 0.7, 0.7, 0.5, 0.5],
    holds: { load: 0.05, takeoff: 0, flight: 0, land: 0.15, top: 0.5, stepBack: 0.05, stepDown: 0.1, follow: 0, stand: 0.5 },
  },

  // ------------------------------------------------------------ goblet squat
  gobletSquat: {
    camera: { yaw: 45 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'core', 'upperBack'] },
    coaching: {
      setup: [
        'Hold the kettlebell by the horns, bell hanging against the breastbone.',
        'Elbows pointing down, tucked close to the ribs.',
        'Feet shoulder-width apart, toes turned out slightly.',
      ],
      steps: [
        'Brace, then sit down between the heels, keeping the bell tight to the chest.',
        'Let the elbows track inside the knees as you reach the bottom.',
        'Keep the chest tall so the bell stays over the middle of the foot.',
        'Drive through the whole foot to stand, squeezing the glutes at the top.',
      ],
      cues: ['Bell at the chest', 'Elbows inside the knees', 'Chest tall'],
      mistakes: [
        'Letting the bell drift away from the chest, which pulls the back round.',
        'Heels lifting as the weight comes forward.',
        'Knees caving in on the way up.',
        'Cutting depth short: the bell lets most people sit lower, so use it.',
      ],
      breathing: 'Breathe in and brace at the top, breathe out as you stand.',
      tempo: 'About 2 to 3 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        legs: STAND,
        arms: goblet(TOP, 0),
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: FRONT_BOTTOM, pitch: 22 },
        spine: { flex: 4 },
        neck: { flex: -10 },
        legs: DEEP,
        arms: goblet(FRONT_BOTTOM, 24),
      },
    },
    seq: ['stand', 'bottom'],
    tempo: [2.2, 1.1],
    holds: { bottom: 0.4, stand: 0.5 },
  },

  // ------------------------------------------------------------ KB front squat
  kbFrontSquat: {
    camera: { yaw: -40 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['core', 'obliques', 'upperBack'] },
    coaching: {
      setup: [
        'Clean the bell into the front rack: handle across the palm, bell resting on the outside of the forearm.',
        'Wrist straight, elbow tucked down against the ribs, hand near the collarbone.',
        'Feet shoulder-width, toes turned out slightly, free arm relaxed out to the side.',
      ],
      steps: [
        'Brace hard, especially on the side without the bell, so you do not lean.',
        'Sit down between the heels, keeping the rack tight and the chest tall.',
        'Go to at least parallel with the knees tracking over the toes.',
        'Drive up through the whole foot, staying square.',
        'Do half the reps, then swap the bell to the other side.',
      ],
      cues: ['In the front rack', 'Elbow on the ribs', 'Stay square'],
      mistakes: [
        'Leaning or twisting towards the bell.',
        'Bent wrist, so the bell hangs off the hand instead of sitting on the forearm.',
        'Elbow drifting out to the side and the bell pulling you forward.',
        'Heels lifting at the bottom.',
      ],
      breathing: 'Breathe in and brace at the top, breathe out as you stand.',
      tempo: 'About 2 to 3 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      stand: {
        label: 'Front rack',
        legs: STAND,
        arms: { L: { shoulder: { elev: 32, plane: 80 }, elbow: 14 }, R: kbRack(TOP, 0) },
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: FRONT_BOTTOM, pitch: 22 },
        spine: { flex: 4 },
        neck: { flex: -10 },
        legs: DEEP,
        arms: { L: { shoulder: { elev: 62, plane: 45 }, elbow: 12 }, R: kbRack(FRONT_BOTTOM, 24) },
      },
    },
    seq: ['stand', 'bottom'],
    tempo: [2.2, 1.1],
    holds: { bottom: 0.4, stand: 0.5 },
  },

  // ------------------------------------------------------------ KB thruster
  kbThruster: {
    camera: { yaw: -45, pitch: 4 },
    props: [{ type: 'kettlebell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes', 'shoulders'], secondary: ['triceps', 'core', 'obliques', 'upperBack'] },
    coaching: {
      setup: [
        'Bell in the front rack on one side: wrist straight, elbow tucked to the ribs.',
        'Feet shoulder-width, toes turned out slightly, free arm out to the side.',
      ],
      steps: [
        'Brace and squat down with the rack tight and the chest tall.',
        'Drive up hard out of the bottom.',
        'As the legs straighten, let that drive carry the bell straight up past the face.',
        'Lock the arm out overhead with the bicep by the ear and the bell over the middle of the foot.',
        'Lower the bell back to the rack under control and flow into the next squat. Swap sides halfway.',
      ],
      cues: ['Squat, then drive overhead', 'Legs start the press', 'Bicep by the ear'],
      mistakes: [
        'Pressing with the arm before the legs have finished driving.',
        'Leaning back or sideways to finish the press.',
        'Letting the bell crash back into the rack.',
        'Losing the chest at the bottom so the bell pulls you forward.',
      ],
      breathing: 'Breathe in at the top of the rack, breathe out as you drive the bell up.',
      tempo: 'About 2 seconds down, then one fast smooth drive to lockout.',
    },
    keys: {
      rack: {
        label: 'Front rack',
        legs: STAND,
        arms: { L: { shoulder: { elev: 38, plane: 85 }, elbow: 14 }, R: kbRack(TOP, 0) },
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: FRONT_BOTTOM, pitch: 22 },
        spine: { flex: 4 },
        neck: { flex: -10 },
        legs: DEEP,
        arms: { L: { shoulder: { elev: 62, plane: 50 }, elbow: 12 }, R: kbRack(FRONT_BOTTOM, 24) },
      },
      drive: {
        label: 'Drive',
        neck: { flex: -10 },
        legs: STAND,
        arms: { L: { shoulder: { elev: 45, plane: 85 }, elbow: 14 },
          R: { hand: [-0.15, 1.6, 0.08], elbow: [-0.7, -1, 0.3], wrist: -170 } },
      },
      lockout: {
        label: 'Lockout',
        legs: STAND,
        arms: { L: { shoulder: { elev: 45, plane: 85 }, elbow: 14 },
          R: { hand: [-0.2, 1.92, 0.0], elbow: 'out', wrist: -170 } },
      },
    },
    seq: ['rack', 'bottom', 'drive', 'lockout'],
    tempo: [2.0, 0.7, 0.35, 1.2],
    holds: { bottom: 0.1, drive: 0, lockout: 0.5, rack: 0.4 },
  },

  // ------------------------------------------------------------ barbell thruster
  barbellThruster: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['quads', 'glutes', 'shoulders'], secondary: ['triceps', 'core', 'upperBack'] },
    coaching: {
      setup: [
        'Bar resting on the front of the shoulders, hands just outside shoulder-width.',
        'Elbows up and forward, fingers can open slightly under the bar.',
        'Feet shoulder-width, toes turned out slightly.',
      ],
      steps: [
        'Brace and front squat down, elbows high and chest tall.',
        'Drive up hard out of the bottom, keeping the bar over the middle of the foot.',
        'As the hips straighten, let the drive carry the bar off the shoulders and press it straight up.',
        'Move the head back to let the bar past the face, then push it through under the bar at lockout.',
        'Lower the bar back to the shoulders and go straight into the next squat.',
      ],
      cues: ['Front squat into a press', 'Elbows up at the bottom', 'Bar path straight up'],
      mistakes: [
        'Elbows dropping at the bottom so the bar rolls forward and the back rounds.',
        'Pressing early, before the hips have finished extending.',
        'Pushing the bar forward around the face instead of moving the head.',
        'Leaning back and arching at lockout.',
      ],
      breathing: 'Breathe in and brace in the rack, breathe out as you drive through the press.',
      tempo: 'About 2 seconds down, then one fast drive from the bottom to lockout.',
    },
    keys: {
      rack: {
        label: 'Front rack',
        legs: STAND,
        arms: barRack(TOP, 0),
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.44, -0.14], pitch: 20 },
        spine: { flex: 2 },
        neck: { flex: -10 },
        legs: DEEP,
        arms: barRack([0, 0.44, -0.14], 21, [0.35, -0.4, 1]),
      },
      drive: {
        label: 'Drive',
        neck: { flex: -14 },
        legs: STAND,
        arms: { L: { hand: [0.24, 1.62, 0.1], elbow: [0.8, -1, 0.3], wrist: -30 }, R: 'mirror' },
      },
      lockout: {
        label: 'Lockout',
        spine: { flex: -2 },
        legs: STAND,
        arms: { L: { hand: [0.26, 1.93, 0.0], elbow: 'out' }, R: 'mirror' },
      },
    },
    seq: ['rack', 'bottom', 'drive', 'lockout'],
    tempo: [2.0, 0.7, 0.35, 1.2],
    holds: { bottom: 0.1, drive: 0, lockout: 0.5, rack: 0.4 },
  },

  // ------------------------------------------------------------ dumbbell squat
  dbSquat: {
    camera: { yaw: 40 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'forearms', 'core', 'upperBack'] },
    coaching: {
      setup: [
        'A dumbbell in each hand, arms hanging by your sides, palms facing in.',
        'Feet shoulder-width apart, toes turned out slightly.',
        'Shoulders back and down, chest up.',
      ],
      steps: [
        'Brace, then sit the hips back and down, letting the arms hang straight.',
        'Keep the dumbbells beside you, not swinging forward.',
        'Lower until the thighs are at least parallel, knees over the toes.',
        'Drive through the whole foot to stand tall.',
      ],
      cues: ['Chest up', 'Arms long, like hooks', 'Knees out over the toes'],
      mistakes: [
        'Letting the weights pull the shoulders forward and round the upper back.',
        'Bending the elbows or lifting the weights with the arms.',
        'Heels lifting at the bottom.',
        'Knees caving in on the way up.',
      ],
      breathing: 'Breathe in and brace at the top, breathe out as you stand.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      stand: {
        label: 'Stand tall',
        legs: STAND,
        arms: hang(TOP, 0),
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.46, -0.18], pitch: 28 },
        spine: { flex: 4 },
        neck: { flex: -14 },
        legs: DEEP,
        arms: hang([0, 0.46, -0.18], 30),
      },
    },
    seq: ['stand', 'bottom'],
    tempo: [2.0, 1.1],
    holds: { bottom: 0.35, stand: 0.5 },
  },
};
