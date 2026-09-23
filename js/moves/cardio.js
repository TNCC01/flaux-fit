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
    R: { foot: [-0.1, 0.12, 0.01], heel: -20, toeOut: 5 },
  },
  arms: {
    L: { shoulder: { elev: -35, plane: 0 }, elbow: 85 },
    R: { shoulder: { elev: 55, plane: -5 }, elbow: 85 },
  },
};
const HK_MID = {
  label: 'Switch',
  pelvis: { pos: [0, 0.94, 0] },
  legs: { L: { foot: [0.1, 0.12, 0.01], heel: -20, toeOut: 5 }, R: 'mirror' },
  arms: { L: { shoulder: { elev: 10, plane: 0 }, elbow: 85 }, R: 'mirror' },
};
const BK_LEFT = {
  label: 'Left heel up',
  pelvis: { pos: [0, 0.95, 0], pitch: 4 },
  legs: {
    L: { hip: { flex: 8, abd: 2 }, knee: 130, ankle: -30 },
    R: { foot: [-0.1, 0.12, 0.01], heel: -20, toeOut: 5 },
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
    R: { foot: [-0.1, 0.13, -0.08], heel: -25, toeOut: 3 },
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
    L: { hip: { flex: 120, abd: 3 }, knee: 145, ankle: -10 },
    R: { ...MC_BACK, foot: [-0.09, 0.122, -1.2] },
  },
  arms: MC_HANDS,
};
// legs passing each other: the hips rise a touch so the knees clear the floor
const MC_MID = {
  label: 'Switch',
  pelvis: { pos: [0, 0.48, -0.41], pitch: 79 },
  neck: { flex: 12 },
  legs: { L: { foot: [0.12, 0.3, -0.95], knee: [0.6, -1, 0], ankle: -20 }, R: 'mirror' },
  arms: MC_HANDS,
};
const MCX_LEFT = {
  label: 'Left knee across',
  pelvis: { pos: [0, 0.41, -0.39], pitch: 71 },
  spine: { twist: -4 },
  neck: { flex: 12 },
  legs: {
    L: { hip: { flex: 116, abd: -20, rot: -10 }, knee: 145, ankle: -10 },
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
    [stance]: { foot: [sg * face * 0.1, 0.11, z], heel: -15, toeOut: 4, knee: [0, 0, face] },
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
        legs: { L: { foot: [0.1, 0.095, 0], heel: -10, toeOut: 6 }, R: 'mirror' },
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
        legs: { L: { foot: [0.33, 0.095, 0], heel: -10, toeOut: 15, knee: [0.35, 0, 1] }, R: 'mirror' },
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
        legs: { L: { foot: [0.1, 0.095, 0], heel: -10, toeOut: 6 }, R: 'mirror' },
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
        legs: { L: { foot: [0.33, 0.095, 0], heel: -10, toeOut: 15, knee: [0.35, 0, 1] }, R: 'mirror' },
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
  // ======================================================== running drills
  highKnees: {
    camera: { yaw: 60, pitch: 6 },
    muscles: { primary: ['hipFlexors', 'quads', 'calves'], secondary: ['core', 'glutes', 'shoulders'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart, weight on the balls of the feet.',
        'Elbows bent to about 90 degrees, hands relaxed.',
      ],
      steps: [
        'Drive one knee up to hip height as you push off the other foot.',
        'Put it straight back down under you and drive the other knee up.',
        'Pump the arms in time with the legs, opposite arm to leg.',
        'Stay tall through the trunk and land lightly on the balls of the feet.',
      ],
      cues: ['Knees to hip height', 'Fast feet', 'Stand tall'],
      mistakes: [
        'Leaning back to get the knees up, which loads the lower back.',
        'Knees only coming halfway up as you tire.',
        'Landing flat and heavy on the heels.',
      ],
      breathing: 'Quick, steady breaths. Do not hold your breath.',
      tempo: 'As fast as you can while the knees still reach hip height.',
    },
    keys: {
      left: HK_LEFT,
      mid: HK_MID,
      right: mirrorPose(HK_LEFT, 'Right knee up'),
    },
    seq: ['left', 'mid', 'right', 'mid'],
    tempo: 0.14,
    holds: { left: 0, mid: 0, right: 0 },
  },

  buttKicks: {
    camera: { yaw: 70, pitch: 6 },
    muscles: { primary: ['hamstrings', 'calves'], secondary: ['quads', 'glutes', 'core'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart, weight on the balls of the feet.',
        'Elbows bent, hands relaxed.',
      ],
      steps: [
        'Jog on the spot, flicking one heel up towards your backside.',
        'Keep the knee pointing down at the floor rather than lifting it forward.',
        'Swap legs quickly, landing lightly on the balls of the feet.',
        'Swing the arms in time with the legs.',
      ],
      cues: ['Heels to the backside', 'Quick feet', 'Knees point down'],
      mistakes: [
        'Leaning forward from the hips instead of staying tall.',
        'Letting the thigh swing forward so it becomes a slow high knee.',
        'Heavy, flat-footed landings.',
      ],
      breathing: 'Quick, steady breaths.',
      tempo: 'Quick and light, about three to four kicks a second.',
    },
    keys: {
      left: BK_LEFT,
      mid: HK_MID,
      right: mirrorPose(BK_LEFT, 'Right heel up'),
    },
    seq: ['left', 'mid', 'right', 'mid'],
    tempo: 0.13,
    holds: { left: 0, mid: 0, right: 0 },
  },

  sprint: {
    camera: { yaw: 75, pitch: 6 },
    muscles: { primary: ['quads', 'glutes', 'hamstrings', 'calves'], secondary: ['hipFlexors', 'core', 'shoulders'] },
    coaching: {
      setup: [
        'Pick a marker such as the mailbox, 20 to 40 metres away, on a flat, clear surface.',
        'Start in a split stance, leaning forward slightly.',
      ],
      steps: [
        'Drive off hard, pushing the ground back behind you.',
        'Lift the knees and pump the arms from the shoulders, elbows bent at about 90 degrees.',
        'Land on the balls of the feet under your hips, not out in front.',
        'Slow down gradually past the marker, turn, and sprint back.',
      ],
      cues: ['Push the ground away', 'Arms drive, cheek to hip', 'Tall and relaxed'],
      mistakes: [
        'Reaching the foot out in front, which acts as a brake.',
        'Swinging the arms across the body instead of front to back.',
        'Tensing the face, neck and shoulders.',
        'Stopping dead at the marker instead of slowing down over a few steps.',
      ],
      breathing: 'Breathe freely. Keep the jaw loose.',
      tempo: 'Flat out for each run, then walk or jog while you recover.',
    },
    keys: {
      left: SPRINT_LEFT,
      flyL: SPRINT_FLY_L,
      right: mirrorPose(SPRINT_LEFT, 'Right knee drive'),
      flyR: mirrorPose(SPRINT_FLY_L, 'Flight'),
    },
    seq: ['left', 'flyL', 'right', 'flyR'],
    tempo: 0.11,
    holds: { left: 0, flyL: 0, right: 0, flyR: 0 },
  },

  shuttleRun: {
    camera: { yaw: 90, pitch: 12 },
    muscles: { primary: ['quads', 'glutes', 'calves'], secondary: ['hamstrings', 'adductors', 'core'] },
    coaching: {
      setup: [
        'Mark two lines about 5 to 10 metres apart.',
        'Start behind one line in a split stance, leaning forward slightly.',
      ],
      steps: [
        'Run hard to the far line.',
        'Shorten your steps as you arrive, then sink low with the hips back and knees bent.',
        'Touch the line with the hand closest to it.',
        'Turn and push off hard back the way you came, then repeat at the other line.',
      ],
      cues: ['Out, touch, back', 'Get low to turn', 'Push off the outside foot'],
      mistakes: [
        'Bending at the waist to reach the line instead of lowering the hips.',
        'Turning on a straight leg, which strains the knee.',
        'Overrunning the line and losing time slowing down.',
      ],
      breathing: 'Breathe freely, and take a big breath on each turn.',
      tempo: 'Flat out for the set distance, then rest.',
    },
    keys: {
      a1: stride('Run', -0.55, 1, 'R'),
      a2: stride('Run', -0.05, 1, 'L'),
      a3: stride('Run', 0.45, 1, 'R'),
      touchA: {
        label: 'Low touch',
        pelvis: { pos: [-0.02, 0.5, 0.8], yaw: 90, pitch: 45 },
        spine: { flex: 22, side: -6 },
        neck: { flex: -12 },
        legs: {
          L: { foot: [0.02, 0.07, 0.5], toeOut: 15, knee: [1, 0, -0.2] },
          R: { foot: [0.02, 0.07, 1.08], toeOut: 25, knee: [1, 0, 0.3] },
        },
        arms: {
          L: { shoulder: { elev: 35, plane: 20 }, elbow: 45 },
          R: { hand: [0.3, 0.03, 1.02], elbow: [0.2, 0.3, 1], palm: 'floor' },
        },
      },
      b1: stride('Run back', 0.55, -1, 'L'),
      b2: stride('Run back', 0.05, -1, 'R'),
      b3: stride('Run back', -0.45, -1, 'L'),
      touchB: {
        label: 'Low touch',
        pelvis: { pos: [-0.02, 0.5, -0.8], yaw: 90, pitch: 45 },
        spine: { flex: 22, side: 6 },
        neck: { flex: -12 },
        legs: {
          L: { foot: [0.02, 0.07, -1.08], toeOut: 25, knee: [1, 0, -0.3] },
          R: { foot: [0.02, 0.07, -0.5], toeOut: 15, knee: [1, 0, 0.2] },
        },
        arms: {
          L: { hand: [0.3, 0.03, -1.02], elbow: [0.2, 0.3, -1], palm: 'floor' },
          R: { shoulder: { elev: 35, plane: 20 }, elbow: 45 },
        },
      },
    },
    seq: ['a1', 'a2', 'a3', 'touchA', 'b1', 'b2', 'b3', 'touchB'],
    tempo: [0.22, 0.22, 0.3, 0.35, 0.22, 0.22, 0.3, 0.35],
    holds: { a1: 0, a2: 0, a3: 0, b1: 0, b2: 0, b3: 0, touchA: 0.15, touchB: 0.15 },
  },

  lateralShuffle: {
    camera: { yaw: 10, pitch: 8 },
    muscles: { primary: ['quads', 'glutes', 'adductors'], secondary: ['calves', 'core', 'hamstrings'] },
    coaching: {
      setup: [
        'Feet a bit wider than the shoulders, knees bent, hips back, chest up.',
        'Weight on the balls of the feet, hands up in front of you.',
      ],
      steps: [
        'Push off the trailing foot and step the leading foot out to the side.',
        'Bring the trailing foot in behind it, without letting the feet touch or cross.',
        'Stay at the same low height the whole way; do not bob up and down.',
        'Shuffle a few steps one way, then change direction and come back.',
      ],
      cues: ['Stay low', 'Quick feet across', 'Feet never touch'],
      mistakes: [
        'Standing up tall between steps, which slows you down.',
        'Clicking the heels together or crossing the feet, which puts you off balance.',
        'Knees caving in as you push off.',
      ],
      breathing: 'Quick, steady breaths.',
      tempo: 'Quick, light steps: about three shuffles a second.',
    },
    keys: SHUFFLE.keys,
    seq: SHUFFLE.seq,
    tempo: 0.11,
    holds: Object.fromEntries(Object.keys(SHUFFLE.keys).map(k => [k, 0])),
  },

  // ======================================================== climbers
  mountainClimber: {
    camera: { yaw: 65, pitch: 12 },
    muscles: { primary: ['core', 'hipFlexors'], secondary: ['shoulders', 'quads', 'chest', 'triceps'] },
    coaching: {
      setup: [
        'Start in a straight-arm plank, hands under the shoulders, fingers spread.',
        'Body in one line from head to heels, on the balls of the feet.',
      ],
      steps: [
        'Drive one knee in towards the chest, keeping the hips low.',
        'Switch legs: push that foot back as the other knee drives in.',
        'Keep the shoulders over the hands and the hands planted.',
        'Build up to a quick, even rhythm, like running on the spot.',
      ],
      cues: ['Hips low', 'Drive the knees in', 'Shoulders over hands'],
      mistakes: [
        'Hips bouncing up high, which takes the work off the trunk.',
        'Shoulders drifting back behind the hands.',
        'Short, shuffling steps where the knee barely moves.',
      ],
      breathing: 'Quick, steady breaths, in time with the legs.',
      tempo: 'Quick: about two knee drives a second.',
    },
    keys: {
      left: MC_LEFT,
      mid: MC_MID,
      right: mirrorPose(MC_LEFT, 'Right knee in'),
    },
    seq: ['left', 'mid', 'right', 'mid'],
    tempo: 0.12,
    holds: { left: 0.02, mid: 0, right: 0.02 },
  },

  mountainClimberCross: {
    camera: { yaw: 40, pitch: 14 },
    muscles: { primary: ['core', 'obliques', 'hipFlexors'], secondary: ['shoulders', 'chest', 'quads'] },
    coaching: {
      setup: [
        'Start in a straight-arm plank, hands under the shoulders.',
        'Body in one line from head to heels, on the balls of the feet.',
      ],
      steps: [
        'Drive one knee across the body towards the opposite elbow.',
        'Push it back to the plank as the other knee drives across.',
        'Keep the hips low and the shoulders over the hands.',
        'Build up to a steady, even rhythm.',
      ],
      cues: ['Knee to the opposite elbow', 'Hips low', 'Hands stay put'],
      mistakes: [
        'Hips rising high or swinging side to side.',
        'Knee only coming to the middle, so the obliques miss out.',
        'Shoulders drifting back behind the hands.',
      ],
      breathing: 'Breathe out as each knee drives across.',
      tempo: 'Controlled but quick: about one knee drive a second.',
    },
    keys: {
      left: MCX_LEFT,
      mid: MC_MID,
      right: mirrorPose(MCX_LEFT, 'Right knee across'),
    },
    seq: ['left', 'mid', 'right', 'mid'],
    tempo: 0.2,
    holds: { left: 0.08, mid: 0, right: 0.08 },
  },

  // ======================================================== skipping
  ropeJumping: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'rope', period: 0.46 }],
    muscles: { primary: ['calves'], secondary: ['quads', 'shoulders', 'forearms', 'core'] },
    coaching: {
      setup: [
        'Stand on the middle of the rope and pull the handles up: they should reach about the armpits.',
        'Feet together, elbows close to your sides, hands just in front of the hips.',
      ],
      steps: [
        'Turn the rope with small circles of the wrists, not big arm swings.',
        'Hop just high enough for the rope to pass under: a few centimetres.',
        'Land lightly on the balls of the feet with soft knees.',
        'Keep a steady rhythm, eyes forward and chest up.',
      ],
      cues: ['Light on the toes', 'Wrists do the work', 'Small hops'],
      mistakes: [
        'Jumping too high, which tires you quickly and jars the knees.',
        'Swinging from the shoulders with the arms out wide.',
        'Landing on the heels.',
        'Double bouncing between turns when you mean to single skip.',
      ],
      breathing: 'Relaxed, steady breathing through the nose and mouth.',
      tempo: 'About two turns a second, one hop per turn.',
    },
    keys: {
      air: {
        label: 'Rope under',
        pelvis: { pos: [0, 0.99, 0] },
        legs: { L: { foot: [0.08, 0.15, 0.01], ankle: -15, toeOut: 4 }, R: 'mirror' },
        arms: { L: { hand: [0.29, 1.03, 0.14], elbow: [0.3, 0, -1], wrist: -20 }, R: 'mirror' },
      },
      land: {
        label: 'Land light',
        pelvis: { pos: [0, 0.92, 0] },
        legs: { L: { foot: [0.08, 0.12, 0.01], heel: -20, toeOut: 4 }, R: 'mirror' },
        arms: { L: { hand: [0.29, 0.97, 0.15], elbow: [0.3, 0, -1], wrist: -10 }, R: 'mirror' },
      },
    },
    seq: ['air', 'land'],
    tempo: [0.23, 0.23],
    holds: { air: 0, land: 0 },
  },

  doubleUnder: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'rope', period: 0.5, turns: 2 }],
    muscles: { primary: ['calves', 'quads'], secondary: ['shoulders', 'forearms', 'core', 'glutes'] },
    coaching: {
      setup: [
        'Rope sized so the handles reach about the armpits.',
        'Feet together, elbows by your sides, hands just in front of the hips.',
        'Get comfortable with fast single skips first.',
      ],
      steps: [
        'Do a few single skips to find the rhythm.',
        'Jump a little higher, straight up with the legs almost straight.',
        'Flick the wrists hard so the rope passes under twice before you land.',
        'Land softly on the balls of the feet and go straight into the next jump.',
      ],
      cues: ['Two rope passes per jump', 'Fast wrists', 'Jump tall, not tucked'],
      mistakes: [
        'Piking or tucking the legs to make room, which wears you out.',
        'Swinging the arms wide instead of turning with the wrists.',
        'Landing on the heels or with straight knees.',
      ],
      breathing: 'Keep breathing: short, relaxed breaths.',
      tempo: 'About two jumps a second, four rope turns.',
    },
    keys: {
      rise: {
        label: 'Rope under',
        pelvis: { pos: [0, 1.02, 0] },
        legs: { L: { foot: [0.08, 0.17, 0.01], ankle: -20, toeOut: 4 }, R: 'mirror' },
        arms: { L: { hand: [0.3, 1.06, 0.13], elbow: [0.3, 0, -1], wrist: -25 }, R: 'mirror' },
      },
      peak: {
        label: 'Top of the jump',
        pelvis: { pos: [0, 1.12, 0] },
        legs: { L: { foot: [0.08, 0.3, -0.01], knee: 'fwd', ankle: -15, toeOut: 4 }, R: 'mirror' },
        arms: { L: { hand: [0.3, 1.15, 0.14], elbow: [0.3, 0, -1], wrist: -10 }, R: 'mirror' },
      },
      fall: {
        label: 'Second pass',
        pelvis: { pos: [0, 1.02, 0] },
        legs: { L: { foot: [0.08, 0.17, 0.01], ankle: -20, toeOut: 4 }, R: 'mirror' },
        arms: { L: { hand: [0.3, 1.06, 0.13], elbow: [0.3, 0, -1], wrist: -25 }, R: 'mirror' },
      },
      land: {
        label: 'Land light',
        pelvis: { pos: [0, 0.9, -0.01], pitch: 3 },
        legs: { L: { foot: [0.08, 0.12, 0.01], heel: -20, toeOut: 4, knee: [0.1, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.3, 0.95, 0.15], elbow: [0.3, 0, -1], wrist: -10 }, R: 'mirror' },
      },
    },
    seq: ['rise', 'peak', 'fall', 'land'],
    tempo: [0.125, 0.125, 0.08, 0.17],
    holds: { rise: 0, peak: 0, fall: 0, land: 0 },
  },
};
