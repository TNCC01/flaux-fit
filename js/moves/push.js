/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, pushing family: see js/moves/README.md.
*/

// A push-up body is one straight line from the ankles to the head, pivoting
// on the feet. These place the hip joints and give the shoulder line for a
// given body angle (pitch), so hands can be set under the shoulders.
const LEG = 0.86;                       // hip joint to ankle, leg straight
const cosd = (d) => Math.cos((d * Math.PI) / 180);
const sind = (d) => Math.sin((d * Math.PI) / 180);
const r3 = (v) => Math.round(v * 1000) / 1000;
// feet: ankle [x, y, z] of the left foot (the right mirrors it)
// ankle: the toes are tucked under, heels up, sole facing back
const plank = (feet, pitch, ankle = -30) => ({
  pelvis: { pos: [0, r3(feet[1] + LEG * cosd(pitch)), r3(feet[2] + LEG * sind(pitch))], pitch },
  legs: { L: { foot: feet, knee: 'down', ankle }, R: 'mirror' },
});
const onFloor = (hand, elbow) => ({ L: { hand, elbow, palm: 'floor' }, R: 'mirror' });

// the floor push-up's feet, shared by the variations that start there
const TOES = [0.08, 0.122, -1.262];

// lying on the back, knees bent and feet flat (floor presses)
const SUPINE = {
  pelvis: { pos: [0, 0.13, 0], pitch: -90 },
  legs: { L: { foot: [0.15, 0.07, 0.54], knee: [0.15, 1, 0], toeOut: 6 }, R: 'mirror' },
};

const FLOOR_PRESS_TEXT = {
  mistakes: [
    'Letting the elbows flare straight out to the sides, which crowds the front of the shoulder.',
    'Bouncing the elbows off the floor instead of pausing, which takes the work away from the chest and triceps.',
    'Wrists bent back under the weight: keep the knuckles pointing at the ceiling.',
    'Lifting the hips or arching the back to finish the press.',
  ],
  breathing: 'Breathe in on the way down and during the pause, breathe out as you press.',
};

const MOVES = {
  pushup: {
    camera: { yaw: 60, pitch: 12 },
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Hands on the floor slightly wider than the shoulders, fingers spread and pointing forward.',
        'Legs straight behind you, feet together or hip-width, on the balls of the feet.',
        'One straight line from head to heels: glutes and abs switched on.',
      ],
      steps: [
        'Bend the elbows and lower the whole body together, elbows angled back about 45 degrees from the body.',
        'Keep the hips level with the shoulders all the way down.',
        'Lower until the chest is a fist-height from the floor.',
        'Push the floor away and straighten the arms, finishing with the upper back slightly spread.',
      ],
      cues: ['Body like a plank', 'Elbows back, not out wide', 'Push the floor away'],
      mistakes: [
        'Hips sagging towards the floor, which loads the lower back.',
        'Elbows flared straight out to the sides, which stresses the shoulders.',
        'Half reps: stopping well short of the floor.',
        'Leading with the chin or the hips instead of moving as one piece.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        pelvis: { pos: [0, 0.402, -0.449], pitch: 71 },
        neck: { flex: 10 },
        legs: { L: { foot: [0.08, 0.122, -1.262], knee: 'down', ankle: -30 }, R: 'mirror' },
        arms: { L: { hand: [0.26, 0.03, -0.06], elbow: [0.7, 0.2, -1], palm: 'floor' }, R: 'mirror' },
      },
      bottom: {
        label: 'Chest low',
        pelvis: { pos: [0, 0.197, -0.405], pitch: 85 },
        neck: { flex: 4 },
        legs: { L: { foot: [0.08, 0.122, -1.262], knee: 'down', ankle: -30 }, R: 'mirror' },
        arms: { L: { hand: [0.26, 0.03, -0.06], elbow: [0.7, 0.4, -1], palm: 'floor' }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.6, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },

  widePushup: {
    camera: { yaw: 30, pitch: 14 },
    muscles: { primary: ['chest', 'shoulders'], secondary: ['triceps', 'core'] },
    coaching: {
      setup: [
        'Hands on the floor about one and a half times shoulder-width, fingers pointing forward or turned slightly out.',
        'Hands in line with the middle of the chest, not up by the face.',
        'Legs straight, on the balls of the feet, one straight line from head to heels.',
      ],
      steps: [
        'Brace the trunk and lower the chest between the hands.',
        'Let the elbows travel out to the sides and a little back, staying over the wrists.',
        'Keep the hips level with the shoulders all the way down.',
        'Lower until the chest is a fist-height from the floor.',
        'Push the floor away and straighten the arms, keeping the body in one piece.',
      ],
      cues: ['Hands out wide, chest leads', 'Elbows over the wrists', 'Hips stay with the chest'],
      mistakes: [
        'Hands so wide the shoulders pinch at the bottom: go only as wide as feels comfortable.',
        'Hands too far forward, level with the face, which strains the shoulders.',
        'Hips sagging or piking up to make the rep easier.',
        'Cutting the depth short once the chest gets tired.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        ...plank(TOES, 73),
        neck: { flex: 10 },
        arms: onFloor([0.4, 0.03, -0.06], [1, 0.3, -0.4]),
      },
      bottom: {
        label: 'Chest low',
        ...plank(TOES, 85.5),
        neck: { flex: 4 },
        arms: onFloor([0.4, 0.03, -0.06], [1, 0.6, -0.3]),
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.6, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },

  diamondPushup: {
    camera: { yaw: 45, pitch: 14 },
    muscles: { primary: ['triceps', 'chest'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Hands together under the chest, thumbs and index fingers touching to make a diamond shape.',
        'Hands under the lower part of the breastbone, not up under the face.',
        'Legs straight and feet a little wider than usual for balance, one straight line from head to heels.',
      ],
      steps: [
        'Brace the trunk and bend the elbows, keeping them tucked close to the ribs and pointing back.',
        'Lower the chest towards the backs of the hands, hips level with the shoulders.',
        'Go as low as you can while the elbows stay tucked.',
        'Push hard through the palms and straighten the arms fully.',
      ],
      cues: ['Hands together under the chest', 'Elbows brush the ribs', 'Squeeze the arms straight'],
      mistakes: [
        'Elbows flaring out to the sides, which turns it into a strain on the wrists and shoulders.',
        'Hands up under the face, which puts the shoulders in a poor position.',
        'Hips sagging as the triceps tire.',
        'Only going halfway: drop to your knees if you cannot reach full depth.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        ...plank([0.1, 0.122, -1.262], 71.5),
        neck: { flex: 10 },
        arms: onFloor([0.07, 0.03, -0.13], [0.5, 0.3, -1]),
      },
      bottom: {
        label: 'Chest low',
        ...plank([0.1, 0.122, -1.262], 84),
        neck: { flex: 4 },
        arms: onFloor([0.07, 0.03, -0.13], [0.6, 0.45, -1]),
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.7, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },

  declinePushup: {
    camera: { yaw: 70, pitch: 10 },
    props: [{ type: 'bench', pos: [0, 0, -1.33], size: [1.2, 0.45, 0.35] }],
    muscles: { primary: ['chest', 'shoulders'], secondary: ['triceps', 'core'] },
    coaching: {
      setup: [
        'Toes on the bench behind you, hands on the floor slightly wider than the shoulders.',
        'Hands under the shoulders with the arms straight.',
        'Glutes and abs on so the body is one straight line from heels to head, sloping down to the hands.',
      ],
      steps: [
        'Bend the elbows and lower the whole body together, elbows angled back about 45 degrees.',
        'Keep the hips in line: they will want to sag with the feet up.',
        'Lower until the chest or chin is just off the floor.',
        'Push the floor away and straighten the arms.',
      ],
      cues: ['Feet up on the bench', 'Hips in line, not sagging', 'Push the floor away'],
      mistakes: [
        'Hips sagging, which arches the lower back.',
        'Piking the hips up to make it easier, which turns it into a shoulder press.',
        'Letting the head drop and leading with the face.',
        'Using a bench so high that the reps get short and ragged: start low.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        ...plank([0.08, 0.6, -1.3], 92.5, -25),
        neck: { flex: 0 },
        arms: onFloor([0.26, 0.03, -0.01], [0.7, 0.2, -1]),
      },
      bottom: {
        label: 'Chest low',
        ...plank([0.08, 0.6, -1.3], 106, -12),
        neck: { flex: -6 },
        arms: onFloor([0.26, 0.03, -0.01], [0.5, 0.4, -1]),
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.7, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },

  inclinePushup: {
    camera: { yaw: 70, pitch: 10 },
    props: [{ type: 'bench', pos: [0, 0, 0.145], size: [1.2, 0.45, 0.35] }],
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Hands on the edge of a bench, slightly wider than the shoulders, arms straight.',
        'Walk the feet back until the body is one straight line from head to heels.',
        'Stay on the balls of the feet with the glutes and abs switched on.',
      ],
      steps: [
        'Bend the elbows and lower the chest to the edge of the bench, elbows angled back about 45 degrees.',
        'Keep the hips in line with the shoulders the whole way.',
        'Touch or nearly touch the bench with the chest.',
        'Push the bench away and straighten the arms.',
      ],
      cues: ['Hands on the bench', 'Chest to the edge', 'Body in one line'],
      mistakes: [
        'Sticking the hips back or up so only the arms move.',
        'Elbows flaring straight out to the sides.',
        'Stopping short: the chest should come right down to the bench.',
        'Using a bench that slides: make sure it is steady before you start.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        ...plank([0.08, 0.122, -0.99], 48.5),
        neck: { flex: 12 },
        arms: {
          L: { hand: [0.26, 0.48, 0.0], elbow: [0.7, 0.2, -1], palm: 'floor' }, R: 'mirror',
        },
      },
      bottom: {
        label: 'Chest to bench',
        ...plank([0.08, 0.122, -0.99], 66),
        neck: { flex: 8 },
        arms: {
          L: { hand: [0.26, 0.48, 0.0], elbow: [0.7, 0.4, -1], palm: 'floor' }, R: 'mirror',
        },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.6, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },

  clapPushup: {
    camera: { yaw: 70, pitch: 10 },
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Standard push-up position: hands slightly wider than the shoulders, arms straight.',
        'Feet hip-width for balance, one straight line from head to heels.',
        'Get good at regular push-ups first: this adds speed and a landing.',
      ],
      steps: [
        'Lower under control until the chest is a fist-height from the floor.',
        'Push the floor away as hard and fast as you can so the hands leave the floor.',
        'Keep the body in one straight line while you are in the air.',
        'Land with the hands back under the shoulders and the elbows soft.',
        'Reset at the top, then go again.',
      ],
      cues: ['Push hard, hands leave the floor', 'Stay stiff through the middle', 'Land soft'],
      mistakes: [
        'Jumping the hips up first instead of driving with the arms, so the body folds.',
        'Landing on locked elbows, which jars the elbows and wrists.',
        'Letting the hips sag on the landing.',
        'Doing them when tired: stop the set when the hands no longer leave the floor.',
      ],
      breathing: 'Breathe in on the way down, breathe out hard as you push.',
      tempo: 'About 1 second down, then as fast as possible up; reset between reps.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        ...plank(TOES, 71),
        neck: { flex: 10 },
        arms: onFloor([0.26, 0.03, -0.06], [0.7, 0.2, -1]),
      },
      bottom: {
        label: 'Chest low',
        ...plank(TOES, 85),
        neck: { flex: 4 },
        arms: onFloor([0.26, 0.03, -0.06], [0.7, 0.4, -1]),
      },
      drive: {
        label: 'Drive',
        ...plank(TOES, 72),
        neck: { flex: 10 },
        arms: onFloor([0.26, 0.03, -0.06], [0.7, 0.25, -1]),
      },
      flight: {
        label: 'Hands off',
        ...plank(TOES, 66.5),
        neck: { flex: 10 },
        arms: onFloor([0.26, 0.12, -0.07], [0.7, 0.2, -1]),
      },
      land: {
        label: 'Soft landing',
        ...plank(TOES, 74.5),
        neck: { flex: 8 },
        arms: onFloor([0.26, 0.03, -0.06], [0.7, 0.3, -1]),
      },
    },
    seq: ['top', 'bottom', 'drive', 'flight', 'land'],
    tempo: [1.1, 0.28, 0.16, 0.2, 0.6],
    holds: { top: 0.5, bottom: 0.1, drive: 0, flight: 0, land: 0.1 },
  },

  barbellFloorPress: {
    camera: { yaw: 70, pitch: 16 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'upperBack'] },
    coaching: {
      setup: [
        'Lie on your back on the floor, knees bent and feet flat, with the bar over the chest.',
        'Hands just outside shoulder-width, knuckles to the ceiling, wrists stacked over the elbows.',
        'Squeeze the shoulder blades together and down so the upper back is tight on the floor.',
      ],
      steps: [
        'Start with the arms straight and the bar over the shoulders.',
        'Lower the bar towards the lower chest, elbows angled about 45 degrees from the body.',
        'Pause when the backs of the upper arms touch the floor, staying tight.',
        'Press the bar back up and slightly back to finish over the shoulders.',
      ],
      cues: ['Pause when the elbows land', 'Forearms straight up and down', 'Shoulders pinned to the floor'],
      ...FLOOR_PRESS_TEXT,
      tempo: 'About 2 seconds down, a 1 second pause on the floor, 1 second up.',
    },
    keys: {
      top: {
        label: 'Lockout',
        ...SUPINE,
        arms: { L: { hand: [0.33, 0.636, -0.42], elbow: [0.8, 0, 0.6] }, R: 'mirror' },
      },
      bottom: {
        label: 'Elbows down',
        ...SUPINE,
        arms: { L: { hand: [0.33, 0.3, -0.24], elbow: [0.5, -1, 0.5] }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.0],
    holds: { bottom: 0.9, top: 0.4 },
  },

  dbFloorPress: {
    camera: { yaw: 70, pitch: 16 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'upperBack'] },
    coaching: {
      setup: [
        'Lie on your back on the floor, knees bent and feet flat, a dumbbell in each hand.',
        'Palms facing your feet or turned slightly in, whichever feels better on the shoulders.',
        'Press the dumbbells up over the shoulders, arms straight.',
        'Shoulder blades squeezed together and down, upper back tight on the floor.',
      ],
      steps: [
        'Lower the dumbbells to the sides of the chest, elbows angled about 45 degrees from the body.',
        'Keep the wrists stacked over the elbows so the forearms stay vertical.',
        'Pause when the elbows touch down, without relaxing.',
        'Press the dumbbells back up so they finish over the shoulders, close but not touching.',
      ],
      cues: ['Pause when the elbows touch down', 'Wrists over elbows', 'Press up and slightly in'],
      ...FLOOR_PRESS_TEXT,
      tempo: 'About 2 seconds down, a 1 second pause on the floor, 1 second up.',
    },
    keys: {
      top: {
        label: 'Lockout',
        ...SUPINE,
        arms: { L: { hand: [0.24, 0.652, -0.43], elbow: [0.8, 0, 0.6] }, R: 'mirror' },
      },
      bottom: {
        label: 'Elbows down',
        ...SUPINE,
        arms: { L: { hand: [0.34, 0.3, -0.25], elbow: [0.5, -1, 0.5] }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.0],
    holds: { bottom: 0.9, top: 0.4 },
  },

  ringPushup: {
    camera: { yaw: 55, pitch: 10 },
    props: [{ type: 'rings' }],
    muscles: { primary: ['chest', 'triceps'], secondary: ['shoulders', 'core', 'forearms'] },
    coaching: {
      setup: [
        'Set the rings a hand-width or two off the floor, about shoulder-width apart.',
        'Grip the rings and walk the feet back into a push-up position, arms straight.',
        'Squeeze the rings in towards the body to keep them steady, one straight line from head to heels.',
      ],
      steps: [
        'Lower the chest between the rings, elbows angled back about 45 degrees.',
        'Keep the rings close to the sides of the body so they do not drift out.',
        'Go down until the rings are beside the chest.',
        'Push back up and, at the top, turn the rings out so the palms face forward.',
      ],
      cues: ['Rings turned out at the top', 'Rings close to the ribs', 'Body stays stiff'],
      mistakes: [
        'Letting the rings drift out wide, which puts the shoulders in a weak spot.',
        'Hips sagging while you fight to balance the rings.',
        'Stopping short of full depth.',
        'Rings set too high to start with, or too low to reach full depth: adjust the straps.',
      ],
      breathing: 'Breathe in on the way down, out as you push up.',
      tempo: 'About 2 seconds down, 1 second up, a moment to turn out at the top.',
    },
    keys: {
      top: {
        label: 'Turn out',
        ...plank([0.08, 0.122, -1.1], 63),
        neck: { flex: 12 },
        arms: { L: { hand: [0.27, 0.2, 0.0], elbow: [0.6, 0.1, -1] }, R: 'mirror' },
      },
      bottom: {
        label: 'Rings by chest',
        ...plank([0.08, 0.122, -1.1], 81),
        neck: { flex: 4 },
        arms: { L: { hand: [0.27, 0.2, 0.0], elbow: [0.6, 0.4, -1] }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.0],
    holds: { bottom: 0.2, top: 0.5 },
  },
};

// Tempo push-ups: the push-up, slowed down on the way down.
MOVES.tempoPushup = {
  ...MOVES.pushup,
  camera: { yaw: 75, pitch: 10 },
  coaching: {
    setup: MOVES.pushup.coaching.setup,
    steps: [
      'Brace the trunk, then take a full three seconds to lower, elbows angled back about 45 degrees.',
      'Keep the hips level with the shoulders, moving as one piece.',
      'Pause briefly with the chest a fist-height from the floor, staying tight.',
      'Push back up in about one second and straighten the arms.',
    ],
    cues: ['Three seconds down, one up', 'Count it out: one, two, three', 'Stay tight at the bottom'],
    mistakes: [
      'Rushing the first second then dropping the rest of the way.',
      'Letting the hips sag during the slow lowering.',
      'Holding the breath for the whole rep.',
      'Losing depth as the set goes on: slow and shallow misses the point.',
    ],
    breathing: 'Breathe in slowly on the way down, out as you push up.',
    tempo: '3 seconds down, a short pause, 1 second up.',
  },
  // the push-up's positions, with the toes tucked under
  keys: {
    top: { ...MOVES.pushup.keys.top, ...plank(TOES, 71) },
    bottom: { ...MOVES.pushup.keys.bottom, ...plank(TOES, 85), label: 'Pause' },
  },
  tempo: [3.0, 1.0],
  holds: { bottom: 0.5, top: 0.4 },
};

export default MOVES;
