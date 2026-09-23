/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, jumps, jacks, burpees, climbers, running and skipping:
  see js/moves/README.md.
*/

// ---------------------------------------------------------- helpers
const ARMS_DOWN = { L: { shoulder: { elev: 6, plane: 90 }, elbow: 10 }, R: 'mirror' };

// Mirror a whole pose across the midline (left <-> right).
function flipLimb(l) {
  if (!l || typeof l !== 'object') return l;
  const m = { ...l };
  if (l.foot) m.foot = [-l.foot[0], l.foot[1], l.foot[2]];
  if (l.hand) m.hand = [-l.hand[0], l.hand[1], l.hand[2]];
  if (Array.isArray(l.knee)) m.knee = [-l.knee[0], l.knee[1], l.knee[2]];
  if (Array.isArray(l.elbow)) m.elbow = [-l.elbow[0], l.elbow[1], l.elbow[2]];
  return m;
}
function flipGroup(g) {
  if (!g) return g;
  const L = g.L === 'mirror' ? flipLimb(g.R) : g.L;
  const R = g.R === 'mirror' ? flipLimb(g.L) : g.R;
  return { L: flipLimb(R), R: flipLimb(L) };
}
function flipTrunk(t) {
  if (!t) return t;
  return { ...t, ...(t.side !== undefined && { side: -t.side }), ...(t.twist !== undefined && { twist: -t.twist }) };
}
function mirrorPose(p, label) {
  const o = { ...p, label: label || p.label };
  if (p.pelvis) {
    o.pelvis = { ...p.pelvis };
    if (p.pelvis.pos) o.pelvis.pos = [-p.pelvis.pos[0], p.pelvis.pos[1], p.pelvis.pos[2]];
    if (p.pelvis.yaw) o.pelvis.yaw = -p.pelvis.yaw;
    if (p.pelvis.roll) o.pelvis.roll = -p.pelvis.roll;
  }
  if (p.spine) o.spine = flipTrunk(p.spine);
  if (p.neck) o.neck = flipTrunk(p.neck);
  if (p.legs) o.legs = flipGroup(p.legs);
  if (p.arms) o.arms = flipGroup(p.arms);
  return o;
}

// Move a pose along the floor (z), planted targets included.
function shiftPose(p, dz, label) {
  const o = { ...p, label: label || p.label };
  if (p.pelvis && p.pelvis.pos) o.pelvis = { ...p.pelvis, pos: [p.pelvis.pos[0], p.pelvis.pos[1], p.pelvis.pos[2] + dz] };
  for (const g of ['legs', 'arms']) {
    if (!p[g]) continue;
    o[g] = {};
    for (const s of ['L', 'R']) {
      const l = p[g][s];
      if (l && typeof l === 'object') {
        o[g][s] = { ...l };
        if (l.foot) o[g][s].foot = [l.foot[0], l.foot[1], l.foot[2] + dz];
        if (l.hand) o[g][s].hand = [l.hand[0], l.hand[1], l.hand[2] + dz];
      } else o[g][s] = l;
    }
  }
  return o;
}
function shiftKeys(keys, dz) {
  const o = {};
  for (const [k, v] of Object.entries(keys)) o[k] = shiftPose(v, dz);
  return o;
}

// Standing tall, feet hip-width, at floor position z.
const standAt = (z, label = 'Stand tall') => ({
    label,
    pelvis: { pos: [0, 0.93, z] },
    legs: { L: { foot: [0.12, 0.07, z], toeOut: 8 }, R: 'mirror' },
    arms: ARMS_DOWN,
});

// A standing broad jump from feet at z0 to feet at z1, flight height h.
function broadKeys(z0, z1, h) {
  const d = z1 - z0;
  return {
    load: {
      label: 'Swing back',
      pelvis: { pos: [0, 0.66, z0 - 0.16], pitch: 42 },
      spine: { flex: 8 },
      neck: { flex: -16 },
      legs: { L: { foot: [0.12, 0.07, z0], toeOut: 8, knee: [0.2, 0, 1] }, R: 'mirror' },
      arms: { L: { shoulder: { elev: -50, plane: 2 }, elbow: 6 }, R: 'mirror' },
    },
    takeoff: {
      label: 'Take-off',
      pelvis: { pos: [0, 0.95, z0 + 0.2], pitch: 22 },
      neck: { flex: -8 },
      legs: { L: { foot: [0.12, 0.13, z0 - 0.02], ankle: -45 }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 150, plane: 5 }, elbow: 10 }, R: 'mirror' },
    },
    flight: {
      label: 'Flight',
      pelvis: { pos: [0, 0.93 + h, z0 + d * 0.5], pitch: 14 },
      spine: { flex: 6 },
      legs: { L: { foot: [0.12, 0.07 + h * 1.8, z0 + d * 0.5 + 0.12], knee: 'fwd', ankle: -10 }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 115, plane: 5 }, elbow: 15 }, R: 'mirror' },
    },
    reach: {
      label: 'Feet reach',
      pelvis: { pos: [0, 0.9, z1 - 0.2], pitch: 24 },
      spine: { flex: 8 },
      legs: { L: { foot: [0.12, 0.2, z1 + 0.02], knee: 'fwd', ankle: 5 }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 80, plane: 8 }, elbow: 15 }, R: 'mirror' },
    },
    land: {
      label: 'Soft landing',
      pelvis: { pos: [0, 0.62, z1 - 0.17], pitch: 40 },
      spine: { flex: 8 },
      neck: { flex: -16 },
      legs: { L: { foot: [0.12, 0.07, z1], toeOut: 10, knee: [0.25, 0, 1] }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 72, plane: 10 }, elbow: 15 }, R: 'mirror' },
    },
    tall: standAt(z1, 'Stand tall'),
  };
}
const BROAD_SEQ = ['load', 'takeoff', 'flight', 'reach', 'land', 'tall'];

// Walk backwards from feet at z0 to feet at z1 in four steps.
function walkKeys(z0, z1) {
  const d = z0 - z1;
  const zs = { R1: z0 - d / 3, L1: z0 - (2 * d) / 3 };
  const pose = (label, pz, py, L, R) => ({
      label,
      pelvis: { pos: [0, py, pz] },
      legs: { L: { foot: L, toeOut: 8 }, R: { foot: R, toeOut: 8 } },
      arms: ARMS_DOWN,
  });
  const lift = (a, b) => (a + b) / 2;
  return {
    w1: pose('Walk back', z0 - 0.04, 0.92, [0.12, 0.07, z0], [-0.12, 0.14, lift(z0, zs.R1)]),
    w2: pose('Walk back', (z0 + zs.R1) / 2, 0.9, [0.12, 0.07, z0], [-0.12, 0.07, zs.R1]),
    w3: pose('Walk back', zs.R1 - 0.02, 0.92, [0.12, 0.14, lift(z0, zs.L1)], [-0.12, 0.07, zs.R1]),
    w4: pose('Walk back', (zs.R1 + zs.L1) / 2, 0.9, [0.12, 0.07, zs.L1], [-0.12, 0.07, zs.R1]),
    w5: pose('Walk back', zs.L1 - 0.02, 0.92, [0.12, 0.07, zs.L1], [-0.12, 0.14, lift(zs.R1, z1)]),
    w6: pose('Walk back', (zs.L1 + z1) / 2, 0.9, [0.12, 0.07, zs.L1], [-0.12, 0.07, z1]),
    w7: pose('Walk back', z1 + 0.02, 0.92, [0.12, 0.13, lift(zs.L1, z1)], [-0.12, 0.07, z1]),
  };
}
const WALK_SEQ = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];

// Burpee floor work, feet standing at z = 0 (shift with shiftKeys).
const B_HANDS = { L: { hand: [0.22, 0.03, 0.4], elbow: [0.6, 0.2, -1], palm: 'floor' }, R: 'mirror' };
const BURPEE_FLOOR = {
  squat: {
    label: 'Hands down',
    pelvis: { pos: [0, 0.43, -0.12], pitch: 62 },
    spine: { flex: 26 },
    neck: { flex: -6 },
    legs: { L: { foot: [0.13, 0.07, 0], toeOut: 10, knee: [0.3, 0, 1] }, R: 'mirror' },
    arms: B_HANDS,
  },
  hop: {
    label: 'Jump the feet',
    pelvis: { pos: [0, 0.55, -0.02], pitch: 85 },
    spine: { flex: 10 },
    legs: { L: { foot: [0.11, 0.3, -0.64], knee: 'down' }, R: 'mirror' },
    arms: B_HANDS,
  },
  plank: {
    label: 'Plank',
    pelvis: { pos: [0, 0.402, 0.03], pitch: 71 },
    neck: { flex: 10 },
    legs: { L: { foot: [0.09, 0.122, -0.78], knee: 'down', ankle: 0 }, R: 'mirror' },
    arms: B_HANDS,
  },
  chest: {
    label: 'Chest to floor',
    pelvis: { pos: [0, 0.13, 0.08], pitch: 87 },
    neck: { flex: 2 },
    legs: { L: { foot: [0.09, 0.122, -0.78], knee: 'down', ankle: 0 }, R: 'mirror' },
    arms: { L: { hand: [0.22, 0.03, 0.4], elbow: [0.7, 0.4, -1], palm: 'floor' }, R: 'mirror' },
  },
};

const SKI_LEFT = {
  label: 'Land left',
  pelvis: { pos: [0.2, 0.8, -0.07], pitch: 20, roll: -4 },
  spine: { flex: 4 },
  neck: { flex: -10 },
  legs: { L: { foot: [0.33, 0.07, 0.02], toeOut: 4, knee: [0.1, 0, 1] }, R: { foot: [0.17, 0.07, 0.02], toeOut: 4, knee: [0.1, 0, 1] } },
  arms: { L: { shoulder: { elev: 35, plane: 15 }, elbow: 75 }, R: 'mirror' },
};

const SKATE_LEFT = {
  label: 'Land left',
  pelvis: { pos: [0.42, 0.74, -0.05], pitch: 34, roll: -3 },
  spine: { flex: 8, twist: 10 },
  neck: { flex: -14, twist: -6 },
  legs: {
    L: { foot: [0.5, 0.07, 0.02], toeOut: 6, knee: [0.05, 0, 1] },
    R: { foot: [0.3, 0.2, -0.38], knee: [0, -0.5, 1] },
  },
  arms: {
    L: { shoulder: { elev: -40, plane: 5 }, elbow: 20 },
    R: { shoulder: { elev: 60, plane: -25 }, elbow: 25 },
  },
};

// ---------------------------------------------------------- running in place
// Left knee up (or heel up), right foot on the ball of the foot.
const HK_LEFT = {
  label: 'Left knee up',
  pelvis: { pos: [0, 0.95, 0], pitch: -2 },
  legs: {
    L: { hip: { flex: 92, abd: 2 }, knee: 95, ankle: 5 },
    R: { foot: [-0.1, 0.12, 0.01], heel: 20, toeOut: 5 },
  },
  arms: {
    L: { shoulder: { elev: -35, plane: 0 }, elbow: 85 },
    R: { shoulder: { elev: 55, plane: -5 }, elbow: 85 },
  },
};
const HK_MID = {
  label: 'Switch',
  pelvis: { pos: [0, 0.94, 0] },
  legs: { L: { foot: [0.1, 0.12, 0.01], heel: 20, toeOut: 5 }, R: 'mirror' },
  arms: { L: { shoulder: { elev: 10, plane: 0 }, elbow: 85 }, R: 'mirror' },
};
const BK_LEFT = {
  label: 'Left heel up',
  pelvis: { pos: [0, 0.95, 0], pitch: 4 },
  legs: {
    L: { hip: { flex: 8, abd: 2 }, knee: 130, ankle: -30 },
    R: { foot: [-0.1, 0.12, 0.01], heel: 20, toeOut: 5 },
  },
  arms: {
    L: { shoulder: { elev: -30, plane: 0 }, elbow: 90 },
    R: { shoulder: { elev: 40, plane: -5 }, elbow: 90 },
  },
};
const SPRINT_LEFT = {
  label: 'Left knee drive',
  pelvis: { pos: [0, 0.96, 0.02], pitch: 8 },
  spine: { flex: 3 },
  legs: {
    L: { hip: { flex: 80, abd: 2 }, knee: 105, ankle: 5 },
    R: { foot: [-0.1, 0.13, -0.08], heel: 25, toeOut: 3 },
  },
  arms: {
    L: { shoulder: { elev: -50, plane: 0 }, elbow: 80 },
    R: { shoulder: { elev: 70, plane: -5 }, elbow: 85 },
  },
};
// flight after the left drive: left foot coming down, right heel kicking up
const SPRINT_FLY_L = {
  label: 'Flight',
  pelvis: { pos: [0, 1.0, 0.02], pitch: 8 },
  spine: { flex: 3 },
  legs: {
    L: { foot: [0.1, 0.2, 0.06], knee: 'fwd', ankle: 0 },
    R: { hip: { flex: 0, abd: 2 }, knee: 115, ankle: -25 },
  },
  arms: { L: { shoulder: { elev: 5, plane: 0 }, elbow: 85 }, R: 'mirror' },
};

// ---------------------------------------------------------- climbers
// Straight-arm plank with the hands under the shoulders at z = 0.
const MC_HANDS = { L: { hand: [0.2, 0.03, 0], elbow: [0.7, 0.2, -1], palm: 'floor' }, R: 'mirror' };
const MC_BACK = { foot: [0.09, 0.122, -1.2], knee: 'down', ankle: 0 };
const MC_LEFT = {
  label: 'Left knee in',
  pelvis: { pos: [0, 0.41, -0.39], pitch: 71 },
  neck: { flex: 12 },
  legs: {
    L: { foot: [0.11, 0.2, -0.52], knee: [0, -1, 0.6] },
    R: { ...MC_BACK, foot: [-0.09, 0.122, -1.2] },
  },
  arms: MC_HANDS,
};
const MCX_LEFT = {
  label: 'Left knee across',
  pelvis: { pos: [0, 0.42, -0.39], pitch: 71, roll: 4 },
  spine: { twist: -4 },
  neck: { flex: 12 },
  legs: {
    L: { foot: [-0.08, 0.21, -0.52], knee: [-0.7, -1, 0.6] },
    R: { ...MC_BACK, foot: [-0.09, 0.122, -1.2] },
  },
  arms: MC_HANDS,
};

// ---------------------------------------------------------- lateral shuffle
function shuffleKeys() {
  const Y = 0.76;
  const arms = { L: { shoulder: { elev: 30, plane: 25 }, elbow: 70 }, R: 'mirror' };
  const pose = (label, px, py, lx, ly, rx, ry) => ({
    label,
    pelvis: { pos: [px, py, -0.08], pitch: 26 },
    spine: { flex: 5 },
    neck: { flex: -14 },
    legs: {
      L: { foot: [lx, ly, 0.02], toeOut: 6, knee: [0.25, 0, 1] },
      R: { foot: [rx, ry, 0.02], toeOut: 6, knee: [-0.25, 0, 1] },
    },
    arms,
  });
  const W = 0.27, S = 0.3, LIFT = 0.11;
  const keys = {};
  const seq = [];
  const stance = (c) => pose('Athletic stance', c, Y, c + W, 0.07, c - W, 0.07);
  // moving left (+x) from c: lead left foot out, trail right foot follows
  const left = (c, n) => {
    keys['la' + n] = pose('Lead foot out', c + 0.08, Y + 0.01, c + W + S / 2, LIFT, c - W, 0.07);
    keys['lb' + n] = pose('Push off', c + 0.15, Y - 0.02, c + W + S, 0.07, c - W, 0.07);
    keys['lc' + n] = pose('Feet follow', c + 0.24, Y + 0.01, c + W + S, 0.07, c - W + S / 2, LIFT);
    seq.push('la' + n, 'lb' + n, 'lc' + n);
  };
  const right = (c, n) => {
    keys['ra' + n] = pose('Lead foot out', c - 0.08, Y + 0.01, c + W, 0.07, c - W - S / 2, LIFT);
    keys['rb' + n] = pose('Push off', c - 0.15, Y - 0.02, c + W, 0.07, c - W - S, 0.07);
    keys['rc' + n] = pose('Feet follow', c - 0.24, Y + 0.01, c + W - S / 2, LIFT, c - W - S, 0.07);
    seq.push('ra' + n, 'rb' + n, 'rc' + n);
  };
  keys.s0 = stance(-S); seq.push('s0');
  left(-S, 1); keys.s1 = stance(0); seq.push('s1');
  left(0, 2); keys.s2 = stance(S); seq.push('s2');
  right(S, 1); seq.push('s1');
  right(0, 2);
  return { keys, seq };
}
const SHUFFLE = shuffleKeys();

// ---------------------------------------------------------- shuttle run
// A running stride with the stance foot planted at z, facing +Z (face 1)
// or -Z (face -1); the other knee drives up.
function stride(label, z, face, stance) {
  const sg = stance === 'L' ? 1 : -1;
  const swing = stance === 'L' ? 'R' : 'L';
  const legs = {
    [stance]: { foot: [sg * face * 0.1, 0.11, z], heel: 15, toeOut: 4, knee: [0, 0, face] },
    [swing]: { hip: { flex: 70, abd: 2 }, knee: 100, ankle: 0 },
  };
  const arms = {
    [swing]: { shoulder: { elev: -45, plane: 0 }, elbow: 85 },
    [stance]: { shoulder: { elev: 60, plane: -5 }, elbow: 85 },
  };
  return {
    label,
    pelvis: { pos: [0, 0.95, z + face * 0.08], yaw: face > 0 ? 0 : 180, pitch: 12 },
    spine: { flex: 3 },
    legs, arms,
  };
}

export default {
  // ======================================================== jacks
  jumpingJacks: {
    camera: { yaw: 20, pitch: 6 },
    muscles: { primary: ['calves', 'shoulders'], secondary: ['glutes', 'adductors', 'quads', 'core'] },
    coaching: {
      setup: [
        'Stand tall with the feet together and the arms by your sides.',
        'Weight on the balls of the feet, knees soft.',
      ],
      steps: [
        'Jump the feet out to a bit wider than the shoulders as the arms sweep out to the sides.',
        'Land softly on the balls of the feet with the knees bent a little, arms all the way overhead.',
        'Jump the feet back together as the arms sweep back down to your sides.',
        'Keep a steady rhythm, staying light on the feet.',
      ],
      cues: ['Arms all the way overhead', 'Light on the toes', 'Soft knees'],
      mistakes: [
        'Arms stopping at shoulder height, which halves the work for the shoulders.',
        'Landing flat-footed with straight knees, which jars the knees and lower back.',
        'Knees caving in as the feet land wide.',
      ],
      breathing: 'Breathe steadily, in time with the jumps if you can.',
      tempo: 'Quick and even, about one jack a second.',
    },
    keys: {
      in: {
        label: 'Feet together',
        pelvis: { pos: [0, 0.9, 0] },
        legs: { L: { foot: [0.1, 0.095, 0], heel: 10, toeOut: 6 }, R: 'mirror' },
        arms: ARMS_DOWN,
      },
      air: {
        label: 'Jump',
        pelvis: { pos: [0, 1.0, 0] },
        legs: { L: { foot: [0.2, 0.16, 0.01], toeOut: 8 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 95, plane: 88 }, elbow: 8 }, R: 'mirror' },
      },
      out: {
        label: 'Arms overhead',
        pelvis: { pos: [0, 0.87, 0] },
        legs: { L: { foot: [0.33, 0.095, 0], heel: 10, toeOut: 15, knee: [0.35, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 176, plane: 88 }, elbow: 8 }, R: 'mirror' },
      },
    },
    seq: ['in', 'air', 'out', 'air'],
    tempo: [0.17, 0.15, 0.17, 0.15],
    holds: { air: 0, out: 0.04, in: 0.06 },
  },

  sealJack: {
    camera: { yaw: 25, pitch: 6 },
    muscles: { primary: ['calves', 'chest', 'shoulders'], secondary: ['upperBack', 'glutes', 'adductors', 'core'] },
    coaching: {
      setup: [
        'Stand tall with the feet together.',
        'Arms straight out in front at shoulder height, palms together.',
      ],
      steps: [
        'Jump the feet out wide as the arms open out to the sides at shoulder height.',
        'Land softly on the balls of the feet with the knees bent a little.',
        'Jump the feet back together as the arms swing in and clap out in front.',
        'Keep the arms at shoulder height the whole time.',
      ],
      cues: ['Clap out front, not overhead', 'Open the chest wide', 'Light on the toes'],
      mistakes: [
        'Arms drifting up overhead, which turns it into a normal jumping jack.',
        'Arms dropping below shoulder height as you tire.',
        'Landing heavy with locked knees.',
      ],
      breathing: 'Breathe steadily, in time with the jumps.',
      tempo: 'Quick and even, about one rep a second.',
    },
    keys: {
      in: {
        label: 'Clap in front',
        pelvis: { pos: [0, 0.9, 0] },
        legs: { L: { foot: [0.1, 0.095, 0], heel: 10, toeOut: 6 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 86, plane: -13 }, elbow: 4 }, R: 'mirror' },
      },
      air: {
        label: 'Jump',
        pelvis: { pos: [0, 1.0, 0] },
        legs: { L: { foot: [0.2, 0.16, 0.01], toeOut: 8 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 86, plane: 45 }, elbow: 6 }, R: 'mirror' },
      },
      out: {
        label: 'Arms wide',
        pelvis: { pos: [0, 0.87, 0] },
        spine: { flex: -3 },
        legs: { L: { foot: [0.33, 0.095, 0], heel: 10, toeOut: 15, knee: [0.35, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 86, plane: 102 }, elbow: 6 }, R: 'mirror' },
      },
    },
    seq: ['in', 'air', 'out', 'air'],
    tempo: [0.17, 0.15, 0.17, 0.15],
    holds: { air: 0, out: 0.04, in: 0.06 },
  },

  jackSquat: {
    camera: { yaw: 30, pitch: 6 },
    muscles: { primary: ['quads', 'glutes'], secondary: ['adductors', 'calves', 'core'] },
    coaching: {
      setup: [
        'Stand tall with the feet together.',
        'Hands clasped in front of the chest, elbows down.',
      ],
      steps: [
        'Jump the feet out to wider than the shoulders, toes turned out a little.',
        'Land softly and sink straight into a squat, knees pushing out over the toes.',
        'Hips down to about knee height with the chest up.',
        'Drive up out of the squat and jump the feet back together, landing on soft knees.',
      ],
      cues: ['Jack out, then squat', 'Knees out over the toes', 'Chest up'],
      mistakes: [
        'Knees caving in as you land wide and squat.',
        'Rounding forward and letting the chest drop to the knees.',
        'Stepping instead of jumping, or landing with straight legs.',
      ],
      breathing: 'Breathe in as you land and squat, out as you jump the feet in.',
      tempo: 'Jump out, a quick squat, jump in: about 1.5 seconds a rep.',
    },
    keys: {
      in: {
        label: 'Feet together',
        pelvis: { pos: [0, 0.91, 0] },
        legs: { L: { foot: [0.1, 0.07, 0], toeOut: 8 }, R: 'mirror' },
        arms: { L: { hand: [0.06, 1.2, 0.2], elbow: [0.3, -1, 0] }, R: 'mirror' },
      },
      air: {
        label: 'Jump',
        pelvis: { pos: [0, 1.01, -0.02], pitch: 4 },
        legs: { L: { foot: [0.21, 0.17, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: { hand: [0.06, 1.3, 0.21], elbow: [0.3, -1, 0] }, R: 'mirror' },
      },
      landOut: {
        label: 'Land wide',
        pelvis: { pos: [0, 0.82, -0.05], pitch: 12 },
        legs: { L: { foot: [0.35, 0.07, 0.02], toeOut: 22, knee: [0.45, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.06, 1.07, 0.22], elbow: [0.3, -1, 0] }, R: 'mirror' },
      },
      squat: {
        label: 'Squat',
        pelvis: { pos: [0, 0.56, -0.14], pitch: 26 },
        spine: { flex: 4 },
        neck: { flex: -10 },
        legs: { L: { foot: [0.35, 0.07, 0.02], toeOut: 22, knee: [0.5, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.06, 0.71, 0.18], elbow: [0.3, -1, 0] }, R: 'mirror' },
      },
      landIn: {
        label: 'Land soft',
        pelvis: { pos: [0, 0.84, -0.05], pitch: 10 },
        legs: { L: { foot: [0.1, 0.07, 0], toeOut: 8 }, R: 'mirror' },
        arms: { L: { hand: [0.06, 1.09, 0.21], elbow: [0.3, -1, 0] }, R: 'mirror' },
      },
    },
    seq: ['in', 'air', 'landOut', 'squat', 'air', 'landIn'],
    tempo: [0.2, 0.16, 0.35, 0.3, 0.16, 0.3],
    holds: { air: 0, landOut: 0, squat: 0.1, landIn: 0.03, in: 0.1 },
  },
  // ======================================================== burpees
  burpee: {
    camera: { yaw: 70, pitch: 10 },
    muscles: { primary: ['quads', 'chest', 'glutes'], secondary: ['triceps', 'shoulders', 'core', 'calves'] },
    coaching: {
      setup: [
        'Stand tall with the feet about hip-width apart.',
        'Give yourself room: about your own height of clear floor behind you.',
      ],
      steps: [
        'Squat down and put your hands flat on the floor just in front of your feet, shoulder-width apart.',
        'With your weight on your hands, jump both feet back into a straight-arm plank.',
        'Lower your chest to the floor, then push back up to the plank.',
        'Jump the feet back in behind the hands, landing flat in a low squat.',
        'Drive up through the legs and jump, reaching the arms overhead, then land on soft knees.',
      ],
      cues: ['Chest to floor', 'Hands stay put', 'Jump at the top'],
      mistakes: [
        'Hips sagging when the feet land in the plank, which strains the lower back.',
        'Letting the hands walk or slide instead of staying planted.',
        'Landing the jump on straight legs instead of bending the knees to soak it up.',
        'Feet landing too far back from the hands on the way in, so you have to fold the back to stand.',
      ],
      breathing: 'Breathe out as you push up from the floor and again as you jump.',
      tempo: 'Steady and smooth, about 3 to 4 seconds a rep.',
    },
    keys: {
      stand: standAt(0),
      ...BURPEE_FLOOR,
      drive: {
        label: 'Drive up',
        pelvis: { pos: [0, 0.97, 0.01], pitch: 4 },
        legs: { L: { foot: [0.12, 0.12, 0], ankle: -40 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 130, plane: 15 }, elbow: 12 }, R: 'mirror' },
      },
      air: {
        label: 'Jump, arms up',
        pelvis: { pos: [0, 1.13, 0] },
        legs: { L: { foot: [0.12, 0.26, 0.01], ankle: -30 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 170, plane: 20 }, elbow: 6 }, R: 'mirror' },
      },
      land: {
        label: 'Soft landing',
        pelvis: { pos: [0, 0.76, -0.08], pitch: 16 },
        neck: { flex: -6 },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.2, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 60, plane: 20 }, elbow: 20 }, R: 'mirror' },
      },
    },
    seq: ['stand', 'squat', 'hop', 'plank', 'chest', 'plank', 'hop', 'squat', 'drive', 'air', 'land'],
    tempo: [0.45, 0.16, 0.16, 0.45, 0.45, 0.16, 0.16, 0.25, 0.16, 0.2, 0.35],
    holds: { squat: 0.05, hop: 0, plank: 0.05, chest: 0.1, drive: 0, air: 0, land: 0.08, stand: 0.2 },
  },

  squatThrust: {
    camera: { yaw: 70, pitch: 10 },
    muscles: { primary: ['quads', 'core'], secondary: ['shoulders', 'hipFlexors', 'glutes', 'triceps'] },
    coaching: {
      setup: [
        'Stand tall with the feet about hip-width apart.',
        'Clear floor behind you for the plank.',
      ],
      steps: [
        'Squat down and put your hands flat on the floor just in front of your feet.',
        'Jump both feet back into a straight-arm plank, hips level with the shoulders.',
        'Straight away, jump the feet back in behind the hands.',
        'Stand up tall. No push-up and no jump at the top.',
      ],
      cues: ['Hands down, feet back and in', 'Hips level in the plank', 'Hands stay put'],
      mistakes: [
        'Hips sagging or piking up high as the feet land back.',
        'Hands sliding or walking about on the floor.',
        'Feet landing short on the way in, so you stand up with a rounded back.',
      ],
      breathing: 'Breathe out as the feet jump back and again as you stand.',
      tempo: 'Quick, about 2 seconds a rep.',
    },
    keys: {
      stand: standAt(0),
      ...BURPEE_FLOOR,
    },
    seq: ['stand', 'squat', 'hop', 'plank', 'hop', 'squat'],
    tempo: [0.4, 0.15, 0.15, 0.15, 0.15, 0.4],
    holds: { squat: 0.04, hop: 0, plank: 0.1, stand: 0.15 },
  },

  burpeeBroadJump: {
    camera: { yaw: 80, pitch: 10 },
    muscles: { primary: ['quads', 'glutes', 'chest'], secondary: ['hamstrings', 'triceps', 'shoulders', 'core', 'calves'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart.',
        'Clear floor behind you for the plank and in front of you for the jump.',
      ],
      steps: [
        'Do a full burpee: hands down, jump back to a plank, chest to the floor, push up, jump the feet in.',
        'From the squat, swing the arms back and load the hips.',
        'Swing the arms forward and jump forward as far as you can control.',
        'Land with both feet together, knees bent and hips back, and hold the landing for a moment.',
        'Walk back to the start, or turn around and go again from where you land.',
      ],
      cues: ['Burpee, then jump forward', 'Swing the arms', 'Stick the landing'],
      mistakes: [
        'Landing on straight legs or on the heels, which jars the knees.',
        'Knees caving in as you land.',
        'Rushing the burpee so the hips sag in the plank.',
        'Jumping further than you can land under control.',
      ],
      breathing: 'Breathe out on the push-up and again on the jump.',
      tempo: 'About 5 seconds a rep, with a moment to hold each landing.',
    },
    keys: {
      stand: standAt(-0.35),
      ...shiftKeys(BURPEE_FLOOR, -0.35),
      ...broadKeys(-0.35, 0.35, 0.14),
      ...walkKeys(0.35, -0.35),
    },
    seq: ['stand', 'squat', 'hop', 'plank', 'chest', 'plank', 'hop', 'squat', ...BROAD_SEQ, ...WALK_SEQ],
    tempo: [0.45, 0.16, 0.16, 0.45, 0.45, 0.16, 0.16, 0.3,
      0.35, 0.2, 0.18, 0.15, 0.14, 0.5,
      0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
    holds: { squat: 0.05, hop: 0, plank: 0.05, chest: 0.1, load: 0.05, takeoff: 0, flight: 0, reach: 0,
      land: 0.35, tall: 0.15, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, stand: 0.2 },
  },

  // ======================================================== jumps
  broadJump: {
    camera: { yaw: 85, pitch: 8 },
    muscles: { primary: ['glutes', 'quads', 'hamstrings'], secondary: ['calves', 'core', 'shoulders'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart and toes pointing forward.',
        'Clear space in front of you, at least a couple of metres.',
      ],
      steps: [
        'Swing the arms back as you push the hips back and bend the knees.',
        'Swing the arms forward and up hard as you drive through the whole foot and jump forward.',
        'Bring the knees up and reach the feet forward in the air.',
        'Land with both feet at once, knees bent and hips back, and hold the landing.',
        'Stand up, walk back to the start and reset.',
      ],
      cues: ['Swing and jump', 'Land soft, hips back', 'Walk back and reset'],
      mistakes: [
        'Landing on straight legs, which sends the shock into the knees and back.',
        'Knees caving in on the landing.',
        'Jumping so far you fall forward or have to step to catch yourself.',
        'Not using the arms, which costs a lot of distance.',
      ],
      breathing: 'Breathe in as you load, out as you jump.',
      tempo: 'One quality jump, hold the landing, walk back: about 4 seconds a rep.',
    },
    keys: {
      stand: standAt(-0.5),
      ...broadKeys(-0.5, 0.5, 0.2),
      ...walkKeys(0.5, -0.5),
    },
    seq: ['stand', ...BROAD_SEQ, ...WALK_SEQ],
    tempo: [0.55, 0.22, 0.2, 0.18, 0.15, 0.55, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
    holds: { load: 0.08, takeoff: 0, flight: 0, reach: 0, land: 0.45, tall: 0.2,
      w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, stand: 0.3 },
  },

  tuckJump: {
    camera: { yaw: 70, pitch: 6 },
    muscles: { primary: ['quads', 'glutes', 'hipFlexors'], secondary: ['calves', 'core', 'hamstrings'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart.',
        'Arms relaxed by your sides, ready to swing.',
      ],
      steps: [
        'Dip into a quarter squat and swing the arms back.',
        'Swing the arms up and jump straight up as high as you can.',
        'At the top, pull both knees up towards the chest.',
        'Straighten the legs back under you before you land.',
        'Land softly on the balls of the feet, sinking the hips back with the knees bent, then reset.',
      ],
      cues: ['Knees to chest', 'Land soft', 'Legs back down before you land'],
      mistakes: [
        'Bending forward to meet the knees instead of lifting the knees up.',
        'Landing with the knees still tucked or on stiff legs.',
        'Knees caving in on the landing.',
        'Rushing into the next rep before you are balanced.',
      ],
      breathing: 'Breathe in on the dip, out hard on the jump.',
      tempo: 'Explosive jump, soft landing, a short reset: about 2 seconds a rep.',
    },
    keys: {
      stand: standAt(0),
      dip: {
        label: 'Dip',
        pelvis: { pos: [0, 0.72, -0.12], pitch: 30 },
        spine: { flex: 5 },
        neck: { flex: -12 },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.2, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: -40, plane: 0 }, elbow: 10 }, R: 'mirror' },
      },
      drive: {
        label: 'Take-off',
        pelvis: { pos: [0, 1.0, 0.01], pitch: 0 },
        legs: { L: { foot: [0.12, 0.15, 0], ankle: -45 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 125, plane: 15 }, elbow: 15 }, R: 'mirror' },
      },
      tuck: {
        label: 'Knees to chest',
        pelvis: { pos: [0, 1.25, 0], pitch: 6 },
        spine: { flex: 12 },
        legs: { L: { hip: { flex: 105, abd: 6 }, knee: 115, ankle: -15 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 70, plane: 25 }, elbow: 25 }, R: 'mirror' },
      },
      drop: {
        label: 'Legs down',
        pelvis: { pos: [0, 1.0, 0], pitch: 4 },
        legs: { L: { foot: [0.12, 0.17, 0.03], knee: 'fwd', ankle: -20 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 60, plane: 25 }, elbow: 25 }, R: 'mirror' },
      },
      land: {
        label: 'Soft landing',
        pelvis: { pos: [0, 0.72, -0.12], pitch: 30 },
        spine: { flex: 5 },
        neck: { flex: -12 },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.2, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 55, plane: 15 }, elbow: 25 }, R: 'mirror' },
      },
    },
    seq: ['stand', 'dip', 'drive', 'tuck', 'drop', 'land'],
    tempo: [0.4, 0.18, 0.2, 0.2, 0.14, 0.45],
    holds: { dip: 0.04, drive: 0, tuck: 0, drop: 0, land: 0.2, stand: 0.3 },
  },

  skiJump: {
    camera: { yaw: 25, pitch: 8 },
    muscles: { primary: ['calves', 'quads', 'glutes'], secondary: ['adductors', 'core', 'hamstrings'] },
    coaching: {
      setup: [
        'Feet together, knees and hips bent a little like a skier.',
        'Picture a line on the floor just to one side of your feet.',
        'Elbows bent, hands in front of you.',
      ],
      steps: [
        'Keeping the feet together, hop sideways over the line.',
        'Land on the balls of both feet at once, knees bent to soak it up.',
        'Rebound straight back over the line to the other side.',
        'Keep the chest facing forward and the hips level the whole time.',
      ],
      cues: ['Feet together', 'Hop side to side', 'Quiet landings'],
      mistakes: [
        'Feet splitting apart so one lands before the other.',
        'Landing on stiff legs, which jars the knees.',
        'Leaning the whole trunk sideways instead of moving with the legs.',
      ],
      breathing: 'Breathe steadily, in time with the hops.',
      tempo: 'Quick and springy, about two hops a second.',
    },
    keys: {
      left: SKI_LEFT,
      right: mirrorPose(SKI_LEFT, 'Land right'),
      air: {
        label: 'Hop',
        pelvis: { pos: [0, 1.0, -0.04], pitch: 14 },
        spine: { flex: 4 },
        legs: { L: { foot: [0.08, 0.2, -0.02], knee: 'fwd', ankle: -25 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 35, plane: 15 }, elbow: 75 }, R: 'mirror' },
      },
    },
    seq: ['left', 'air', 'right', 'air'],
    tempo: 0.2,
    holds: { left: 0.05, right: 0.05, air: 0 },
  },

  skaterHops: {
    camera: { yaw: 20, pitch: 8 },
    muscles: { primary: ['glutes', 'quads'], secondary: ['adductors', 'calves', 'hamstrings', 'core'] },
    coaching: {
      setup: [
        'Stand on one leg with a soft knee, hips pushed back and chest a little forward.',
        'The other foot hovers behind the standing ankle.',
      ],
      steps: [
        'Push off the standing leg and bound sideways.',
        'Land softly on the other foot, bending the knee and sitting the hips back.',
        'Let the free leg swing behind the landing leg and the opposite arm reach across.',
        'Hold the landing for a moment, then bound back the other way.',
      ],
      cues: ['Bound side to side', 'Land soft', 'Knee over the toes'],
      mistakes: [
        'Landing on a straight leg, which jars the knee and hip.',
        'The landing knee caving inwards.',
        'Putting the back foot down to catch your balance.',
        'Small shuffling hops instead of a real bound.',
      ],
      breathing: 'Breathe out as you push off, in as you land.',
      tempo: 'About one bound a second, with a controlled landing each time.',
    },
    keys: {
      left: SKATE_LEFT,
      right: mirrorPose(SKATE_LEFT, 'Land right'),
      air: {
        label: 'Bound',
        pelvis: { pos: [0, 0.98, -0.03], pitch: 20 },
        spine: { flex: 4 },
        legs: { L: { foot: [0.14, 0.2, -0.08], knee: 'fwd', ankle: -30 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 25, plane: 60 }, elbow: 25 }, R: 'mirror' },
      },
    },
    seq: ['left', 'air', 'right', 'air'],
    tempo: [0.3, 0.26, 0.3, 0.26],
    holds: { left: 0.15, right: 0.15, air: 0 },
  },
};
