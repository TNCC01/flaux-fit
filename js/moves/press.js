/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, overhead pressing and arms: see js/moves/README.md.
*/
export default {
  zzTest: {
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'kettlebell', hand: 'R' }],
    keys: {
      a: { label: 'A', arms: { L: { hand: [0.26, 1.42, 0.03], elbow: 'down' }, R: { hand: [-0.24, 1.40, 0.08], elbow: [-0.2,-1,0.4], wrist: -60 } } },
      b: { label: 'B', arms: { L: { hand: [0.18, 1.92, 0.0], elbow: 'out' }, R: { hand: [-0.17, 1.92, 0.0], elbow: 'out', wrist: -90 } } },
      c: { label: 'C', arms: { L: { hand: [0.18, 1.92, 0.0], elbow: 'out', wrist: 60 }, R: { hand: [-0.17, 1.92, 0.0], elbow: 'out', wrist: 90 } } },
    },
    seq: ['a','b','c'],
  },
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
};
