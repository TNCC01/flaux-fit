/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, pushing family: see js/moves/README.md.
*/
export default {
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
        legs: { L: { foot: [0.08, 0.122, -1.262], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.26, 0.03, -0.06], elbow: [0.7, 0.2, -1], palm: 'floor' }, R: 'mirror' },
      },
      bottom: {
        label: 'Chest low',
        pelvis: { pos: [0, 0.197, -0.405], pitch: 85 },
        neck: { flex: 4 },
        legs: { L: { foot: [0.08, 0.122, -1.262], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.26, 0.03, -0.06], elbow: [0.7, 0.4, -1], palm: 'floor' }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.6, 1.0],
    holds: { bottom: 0.2, top: 0.4 },
  },
};
