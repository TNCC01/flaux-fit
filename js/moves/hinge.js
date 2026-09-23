/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, hip hinge and glute family: see js/moves/README.md.
*/

// standing hinge stance: feet hip-width, planted
const HIP_FEET = { L: { foot: [0.12, 0.07, 0], toeOut: 6, knee: 'fwd' }, R: 'mirror' };

export default {
  barbellRdl: {
    camera: { yaw: 70, pitch: 6 },
    props: [{ type: 'barbell', length: 1.5, plate: 0.13 }],
    keys: {
      top: {
        label: 'Lockout',
        legs: HIP_FEET,
        arms: { L: { hand: [0.24, 0.84, 0.1] }, R: 'mirror' },
      },
      bottom: {
        label: 'Mid-shin',
        pelvis: { pos: [0, 0.87, -0.19], pitch: 82 },
        neck: { flex: -12 },
        legs: HIP_FEET,
        arms: { L: { hand: [0.24, 0.42, 0.09] }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.2, 1.3],
    holds: { top: 0.5, bottom: 0.2 },
  },
};
