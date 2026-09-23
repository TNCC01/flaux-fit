/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data: see js/moves/README.md.
*/
const LIE = -90;
const TW_Y = 0.127;
const TW_LEGS = { L: { hip: { flex: 95, abd: 6 }, knee: 100 }, R: 'mirror' };
const LY = 0.13;
const HANDS_HEAD = { L: { shoulder: { elev: 140, plane: 105, twist: 0 }, elbow: 130 }, R: 'mirror' };
const BIKE_BASE = { shoulder: { elev: 125, plane: 80 }, elbow: 145 };
const BIKE_CROSS = { shoulder: { elev: 108, plane: 55, twist: -10 }, elbow: 150 };
const ARMS_SIDE = { L: { shoulder: { elev: 18, plane: 108 }, elbow: 4, palm: 'floor' }, R: 'mirror' };
const FEET_FLAT = { L: { foot: [0.13, 0.07, 0.5], knee: 'up', toeOut: 4 }, R: 'mirror' };

// Russian twists: sitting back on the sit bones, heels light, the ribs turn
// the hands from one hip to the other. `gap` is half the space between the
// wrists (wider on the kettlebell horns).
const TWIST_MUSCLES = { primary: ['obliques', 'core'], secondary: ['hipFlexors', 'lowerBack'] };
function twistKeys(gap, wrist = 0) {
  return {
    mid: {
      label: 'Centre',
      pelvis: { pos: [0, TW_Y, 0], pitch: -45 },
      spine: { flex: 10 },
      legs: TW_LEGS,
      arms: { L: { hand: [gap, 0.5, 0.1], elbow: 'down', wrist }, R: { hand: [-gap, 0.5, 0.1], elbow: 'down', wrist } },
    },
    left: {
      label: 'Turn left',
      pelvis: { pos: [0, TW_Y, 0], pitch: -45, yaw: 8 },
      spine: { flex: 10, twist: 50 },
      neck: { twist: 15 },
      legs: TW_LEGS,
      arms: { L: { hand: [0.3, 0.34, 0.06 - gap], elbow: 'down', wrist }, R: { hand: [0.27, 0.35, 0.06 + gap], elbow: 'down', wrist } },
    },
    right: {
      label: 'Turn right',
      pelvis: { pos: [0, TW_Y, 0], pitch: -45, yaw: -8 },
      spine: { flex: 10, twist: -50 },
      neck: { twist: -15 },
      legs: TW_LEGS,
      arms: { R: { hand: [-0.3, 0.34, 0.06 - gap], elbow: 'down', wrist }, L: { hand: [-0.27, 0.35, 0.06 + gap], elbow: 'down', wrist } },
    },
  };
}
function twistCoaching(bell) {
  return {
    setup: [
      'Sit with knees bent and heels resting lightly on the floor, or just off it.',
      'Lean back to about 45 degrees with a long, tall spine.',
      bell ? 'Hold the kettlebell by the horns in front of the chest, elbows soft.'
        : 'Hands together in front of the chest, elbows soft.',
    ],
    steps: [
      'Turn the ribs to the left and take the hands beside the left hip.',
      'Come back through the middle with the chest still tall.',
      'Turn to the right and take the hands beside the right hip.',
      'Keep the knees and feet still while the trunk does the turning.',
    ],
    cues: bell ? ['Bell across the body', 'Rotate from the ribs', 'Heels light']
      : ['Rotate from the ribs', 'Heels light', 'Chest tall'],
    mistakes: [
      'Only swinging the arms while the chest stays square.',
      'Rounding the back and slumping onto the tailbone.',
      'Knees rocking side to side with the hands.',
      bell ? 'Using a bell so heavy you lose the lean and the tall chest.'
        : 'Rushing so the turn gets smaller and smaller.',
    ],
    breathing: 'Breathe out as you turn to each side.',
    tempo: 'About 1 second to each side, touching the middle between.',
  };
}

export default {
  crunch: {
    camera: { yaw: 70, pitch: 12 },
    muscles: { primary: ['core'], secondary: ['obliques', 'hipFlexors'] },
    coaching: {
      setup: [
        'Lie on your back with knees bent and feet flat, hip-width apart.',
        'Fingertips lightly at the sides of your head, elbows wide.',
        'Lower back resting on the floor, not pushed hard into it.',
      ],
      steps: [
        'Breathe out and draw the ribs down towards the hips.',
        'Curl the head, then the shoulders, then the shoulder blades off the floor.',
        'Pause at the top with the lower back still on the floor.',
        'Lower one vertebra at a time until the head rests again.',
      ],
      cues: ['Ribs to hips', 'Chin off the chest', 'Elbows stay wide'],
      mistakes: [
        'Pulling on the head with the hands, which strains the neck.',
        'Tucking the chin hard into the chest instead of keeping a fist of space.',
        'Sitting all the way up with the hip flexors: that is a sit-up, not a crunch.',
        'Dropping back down fast and losing tension.',
      ],
      breathing: 'Breathe out as you curl up, breathe in as you lower.',
      tempo: 'About 1 second up, a short pause, 2 seconds down.',
    },
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
    muscles: { primary: ['core'], secondary: ['obliques', 'hipFlexors'] },
    coaching: {
      setup: [
        'Lie on your back, arms long by your sides with palms down.',
        'Lift the legs to tabletop: hips and knees bent to about 90 degrees.',
        'Press the lower back gently towards the floor.',
      ],
      steps: [
        'Breathe out and curl the tailbone up, rolling the hips off the floor.',
        'Bring the knees towards the chest, keeping the knee angle the same.',
        'Pause with the hips just off the floor and the upper back still down.',
        'Lower the hips back one vertebra at a time to tabletop.',
      ],
      cues: ['Curl the hips off the floor', 'Knees to chest, not over the head', 'Slow on the way down'],
      mistakes: [
        'Swinging the legs to throw the hips up instead of curling with the abs.',
        'Pushing hard through the hands to lift.',
        'Dropping the hips down fast so the lower back arches.',
        'Rolling too far onto the neck.',
      ],
      breathing: 'Breathe out as the hips curl up, breathe in as you lower.',
      tempo: 'About 1 second up, a short pause, 2 seconds down.',
    },
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
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['obliques'] },
    coaching: {
      setup: [
        'Lie on your back with the legs straight and together.',
        'Arms long by your sides, palms pressing lightly into the floor.',
        'Draw the belly button in so the lower back rests flat.',
      ],
      steps: [
        'Keep the legs straight and lift them until they point at the ceiling.',
        'Lower them slowly, only as far as the back stays flat on the floor.',
        'Stop with the heels just above the floor, then lift again.',
      ],
      cues: ['Lower slowly', 'Keep the back flat', 'Legs long and together'],
      mistakes: [
        'The lower back arching off the floor as the legs come down, which loads the spine.',
        'Swinging the legs with momentum.',
        'Bending the knees a lot to make it easier without meaning to.',
        'Holding the breath.',
      ],
      breathing: 'Breathe in as the legs rise, breathe out as you lower them under control.',
      tempo: 'About 1 second up, 2 to 3 seconds down.',
    },
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
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['quads'] },
    coaching: {
      setup: [
        'Lie on your back with the legs straight and arms by your sides.',
        'Press the lower back towards the floor and lift the head slightly.',
        'Raise both heels just off the floor.',
      ],
      steps: [
        'Kick one leg up a little as the other lowers, keeping both legs straight.',
        'Keep the kicks small: a hand-width or two between the feet.',
        'Keep a steady rhythm while the back stays flat.',
      ],
      cues: ['Small fast kicks', 'Legs low', 'Back stays flat'],
      mistakes: [
        'The lower back lifting off the floor, which shifts the work to the spine.',
        'Big, slow swings that turn it into a leg raise.',
        'Bent knees and floppy feet.',
        'Holding the breath.',
      ],
      breathing: 'Short, steady breaths through the whole set.',
      tempo: 'Quick and even, about two kicks a second.',
    },
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
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['obliques', 'quads'] },
    coaching: {
      setup: [
        'Sit on the floor and lean back until you balance on your sit bones.',
        'Lift the legs straight, heels off the floor.',
        'Arms reach forward alongside the legs.',
      ],
      steps: [
        'Lean back and lower the legs a little to open the V, staying balanced.',
        'Fold: lift the legs and chest towards each other.',
        'Reach the hands towards the toes at the top of the fold.',
        'Open again under control without touching the floor.',
      ],
      cues: ['Fold, hands to the toes', 'Chest tall', 'Balance on the sit bones'],
      mistakes: [
        'Rounding the whole back and collapsing onto the tailbone.',
        'Letting the feet touch down between reps.',
        'Rushing, so balance comes from swinging.',
        'Shoulders shrugged up to the ears.',
      ],
      breathing: 'Breathe out as you fold, breathe in as you open.',
      tempo: 'About 1 second to fold, 1 to 2 seconds to open.',
    },
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
        spine: { flex: 25 },
        legs: { L: { hip: { flex: 100 }, knee: 4 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 80, plane: 4 }, elbow: 4 }, R: 'mirror' },
      },
    },
    seq: ['open', 'fold'],
    tempo: [1.4, 1.4],
  },
  vUp: {
    camera: { yaw: 70, pitch: 10 },
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['obliques', 'quads'] },
    coaching: {
      setup: [
        'Lie flat on your back with arms straight overhead and legs straight.',
        'Press the lower back towards the floor before you start.',
      ],
      steps: [
        'Breathe out and lift the arms and legs together, keeping both straight.',
        'Meet the hands and feet over the hips, balancing on your sit bones.',
        'Lower back down slowly, arms and legs at the same time.',
        'Touch the floor lightly and go again.',
      ],
      cues: ['Arms and legs meet over the hips', 'Legs straight', 'Lower slowly'],
      mistakes: [
        'Throwing the arms to get up, then crashing down.',
        'Bending the knees a lot.',
        'Arching the lower back as you lower.',
        'Lifting the arms but leaving the legs behind.',
      ],
      breathing: 'Breathe out on the way up, breathe in on the way down.',
      tempo: 'About 1 second up, 1 to 2 seconds down.',
    },
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
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['obliques'] },
    coaching: {
      setup: [
        'Lie on your back with the legs long and heels just off the floor.',
        'Arms overhead, shoulders just lifted off the floor.',
      ],
      steps: [
        'Breathe out and sit up as you pull the knees in towards the chest.',
        'Balance on your sit bones with the chest tall and arms reaching past the knees.',
        'Extend back out to the long position under control.',
      ],
      cues: ['Knees to chest', 'Sit tall', 'Control the way down'],
      mistakes: [
        'Rounding forward and dropping the chest onto the knees.',
        'Flopping back down to the floor between reps.',
        'Using a big arm swing to get up.',
      ],
      breathing: 'Breathe out as you tuck, breathe in as you extend.',
      tempo: 'About 1 second in, 1 second out.',
    },
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
    camera: { yaw: 30, pitch: 25 },
    muscles: { primary: ['obliques', 'core'], secondary: ['hipFlexors'] },
    coaching: {
      setup: [
        'Lie on your back with fingertips at the sides of your head, elbows wide.',
        'Curl the shoulders off the floor and lift the legs to tabletop.',
        'Lower back resting on the floor.',
      ],
      steps: [
        'Turn the ribs to bring the right elbow towards the left knee as the right leg straightens.',
        'Pass back through the middle with the shoulders still off the floor.',
        'Switch: left elbow towards the right knee as the left leg straightens.',
        'Keep swapping sides in a slow, steady rhythm.',
      ],
      cues: ['Elbow towards the opposite knee', 'Turn from the ribs', 'Long leg stays low'],
      mistakes: [
        'Pulling the head forward with the hands.',
        'Just flapping the elbows instead of turning the chest.',
        'Pedalling fast with no rotation.',
        'Letting the lower back arch as the leg straightens.',
      ],
      breathing: 'Breathe out each time you turn.',
      tempo: 'About 1 second per side, with a clear turn each time.',
    },
    keys: {
      left: {
        label: 'Right elbow, left knee',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        spine: { flex: 40, twist: 45 },
        legs: { L: { hip: { flex: 110 }, knee: 110 }, R: { hip: { flex: 25 }, knee: 6 } },
        arms: { L: BIKE_BASE, R: BIKE_CROSS },
      },
      right: {
        label: 'Left elbow, right knee',
        pelvis: { pos: [0, LY, 0], pitch: LIE },
        spine: { flex: 40, twist: -45 },
        legs: { R: { hip: { flex: 110 }, knee: 110 }, L: { hip: { flex: 25 }, knee: 6 } },
        arms: { L: BIKE_CROSS, R: BIKE_BASE },
      },
    },
    seq: ['left', 'right'],
    tempo: [1.0, 1.0],
  },
  russianTwist: {
    camera: { yaw: 20, pitch: 15 },
    muscles: TWIST_MUSCLES,
    coaching: twistCoaching(false),
    keys: twistKeys(0.035),
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: 0.7,
  },
  // the 10 kg version: same movement, hands on the kettlebell horns (to use
  // it, point the kettlebell exercise's img at this name)
  russianTwistKb: {
    camera: { yaw: 20, pitch: 15 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: TWIST_MUSCLES,
    coaching: twistCoaching(true),
    keys: twistKeys(0.05, -80),
    seq: ['mid', 'left', 'mid', 'right'],
    tempo: 0.8,
  },
  sidePlankThread: {
    camera: { yaw: 10, pitch: 12 },
    muscles: { primary: ['obliques', 'core'], secondary: ['shoulders', 'glutes'] },
    coaching: {
      setup: [
        'Side plank on a straight arm, hand under the shoulder.',
        'Feet staggered, top foot in front, body in one line from head to heels.',
        'Top arm reaches up to the ceiling.',
      ],
      steps: [
        'Keep the hips lifted and turn the chest towards the floor.',
        'Sweep the top arm down and reach it under the ribs as far as you can.',
        'Unwind and reach the arm back up to the ceiling.',
        'Do all the reps on one side, then swap.',
      ],
      cues: ['Reach under the ribs', 'Hips stay high', 'Push the floor away'],
      mistakes: [
        'Hips sagging towards the floor during the thread.',
        'Sinking into the support shoulder instead of pushing the floor away.',
        'Swinging the arm without turning the ribs.',
      ],
      breathing: 'Breathe out as you thread through, breathe in as you open up.',
      tempo: 'About 1 to 2 seconds each way.',
    },
    keys: {
      reach: {
        label: 'Reach up',
        pelvis: { pos: [0, 0.54, 0], roll: -60 },
        legs: { L: { foot: [0.68, 0.07, 0.14], knee: 'fwd', ankle: 0 }, R: { foot: [0.7, 0.055, -0.03], knee: 'fwd', ankle: 0 } },
        arms: { L: { shoulder: { elev: 118, plane: 90 }, elbow: 4 }, R: { hand: [-0.475, 0.03, -0.03], elbow: 'back', palm: 'floor' } },
      },
      thread: {
        label: 'Thread',
        pelvis: { pos: [0, 0.515, 0.08], roll: -60 },
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
    muscles: { primary: ['core', 'obliques', 'glutes'], secondary: ['shoulders', 'triceps', 'hamstrings'] },
    coaching: {
      setup: [
        'Sit with feet flat in front and hands on the floor behind the hips.',
        'Lift the hips off the floor into a crab position.',
      ],
      steps: [
        'Drive the hips up and kick the left leg up towards the ceiling.',
        'Reach the right hand across to touch the left toe, turning the chest.',
        'Return the hand and foot to the floor, back into the crab.',
        'Repeat with the right leg and left hand, alternating each rep.',
      ],
      cues: ['Kick up, touch the opposite toe', 'Hips high', 'Push through the planted hand'],
      mistakes: [
        'Letting the hips drop as you reach.',
        'Sinking into the support shoulder with a bent, loose arm.',
        'Bending the kicking knee right in so the reach becomes tiny.',
      ],
      breathing: 'Breathe out as you kick and reach.',
      tempo: 'About 1 second up, 1 second down, alternating sides.',
    },
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
    muscles: { primary: ['obliques', 'core'], secondary: ['shoulders', 'glutes', 'quads'] },
    coaching: {
      setup: [
        'Stand with feet wider than the hips, both hands holding one dumbbell.',
        'Bend the knees and hinge to take the dumbbell to the outside of the right hip.',
      ],
      steps: [
        'Drive through the legs and turn the ribs to bring the dumbbell up across the body.',
        'Finish with arms long above the left shoulder, pivoting the right foot.',
        'Lower back down along the same diagonal with control.',
        'Do all the reps on one side, then swap.',
      ],
      cues: ['Hip to opposite shoulder', 'Turn from the ribs', 'Pivot the back foot'],
      mistakes: [
        'Lifting with the arms only, with no turn through the trunk.',
        'Twisting the knee because the back foot stays locked.',
        'Rounding the lower back at the bottom.',
        'Rushing the lowering.',
      ],
      breathing: 'Breathe out as you chop up, breathe in as you lower.',
      tempo: 'About 1 second up, 1 to 2 seconds down.',
    },
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
        arms: { L: { hand: [0.03, 1.1, 0.52], elbow: 'out' }, R: { hand: [-0.03, 1.08, 0.51], elbow: 'out' } },
      },
      rise: {
        label: 'Rise',
        pelvis: { pos: [0, 0.91, -0.01], yaw: 10 },
        spine: { twist: 15 },
        legs: { L: { foot: [0.2, 0.07, 0], toeOut: 10 }, R: { foot: [-0.2, 0.115, 0], toeOut: 0, heel: -15, knee: [0.2, 0, 1] } },
        arms: { L: { hand: [0.24, 1.4, 0.44], elbow: 'down' }, R: { hand: [0.18, 1.39, 0.46], elbow: 'down' } },
      },
      high: {
        label: 'High',
        pelvis: { pos: [0, 0.92, 0], yaw: 20 },
        spine: { flex: -3, twist: 30 },
        legs: { L: { foot: [0.2, 0.07, 0], toeOut: 10 }, R: { foot: [-0.2, 0.155, 0], toeOut: -20, heel: -30, knee: [0.4, 0, 1] } },
        arms: { L: { hand: [0.4, 1.58, 0.22], elbow: 'down' }, R: { hand: [0.34, 1.57, 0.25], elbow: 'down' } },
      },
    },
    seq: ['low', 'mid', 'rise', 'high', 'rise', 'mid'],
    tempo: [0.45, 0.35, 0.35, 0.55, 0.5, 0.55],
    holds: { mid: 0, rise: 0, high: 0.3, low: 0.3 },
  },
  ringTuckHold: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'rings' }],
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['triceps', 'shoulders', 'chest'] },
    coaching: {
      setup: [
        'Set the rings about hip height and press up to straight arms.',
        'Hands by the hips, shoulders pushed down away from the ears.',
      ],
      steps: [
        'Lift the knees towards the chest with the feet off the floor.',
        'Hold with straight arms, shoulders down and the chest tall.',
        'Lower the legs with control and step down.',
      ],
      cues: ['Knees up', 'Shoulders active', 'Arms locked straight'],
      mistakes: [
        'Shoulders shrugging up towards the ears.',
        'Bent elbows that let the body sink.',
        'Leaning far back to keep the knees up.',
      ],
      breathing: 'Breathe steadily through the hold; do not hold your breath.',
      tempo: 'Hold for the set time, about 10 to 20 seconds.',
    },
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
