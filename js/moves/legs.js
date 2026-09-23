/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, squat and lunge family: see js/moves/README.md.
*/
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };

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
};
