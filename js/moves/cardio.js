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
};
