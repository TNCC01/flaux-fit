/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, anti-movement core, side planks, crawls: see js/moves/README.md.
*/

// ---------------------------------------------------------- helpers
const r3 = (v) => Math.round(v * 1000) / 1000;
const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => r3(v + (b[i] - v) * t)) : r3(a + (b - a) * t));
const flipX = (v) => [-v[0], v[1], v[2]];

// ---------------------------------------------------------- planks
// Feet on the toes, legs straight behind, shared by every plank so the feet
// never slide between the forearm and the hand positions.
const PLANK_FEET = { L: { foot: [0.09, 0.12, -1.26], knee: 'down', ankle: 0 }, R: 'mirror' };
const WIDE_FEET = { L: { foot: [0.15, 0.12, -1.25], knee: 'down', ankle: 0 }, R: 'mirror' };
// forearm plank: elbows under the shoulders, forearms flat, hands forward
const FOREARM = { hand: [0.14, 0.03, 0.28], elbow: [0, -1, -0.5], palm: 'floor' };
const FOREARM_P = { pos: [0, 0.24, -0.409], pitch: 82 };
// high plank: hands under the shoulders, arms straight
const PALM = { hand: [0.2, 0.03, -0.03], elbow: [0.5, 0, -1], palm: 'floor' };
const HIGH_P = { pos: [0, 0.405, -0.447], pitch: 71 };
const mirrorArm = (a) => ({ ...a, hand: flipX(a.hand), elbow: Array.isArray(a.elbow) ? flipX(a.elbow) : a.elbow });

// ---------------------------------------------------------- side plank
// On the right forearm, facing +Z, head to -X: elbow under the shoulder,
// feet stacked. roll - lowers the right side (the engine's roll + tips the
// body onto its left side).
const SIDE_ELBOW = { hand: [-0.46, 0.03, 0.26], elbow: [0, -1, -0.3], palm: 'floor' };
const SIDE_FEET = {
  L: { foot: [0.827, 0.137, 0], knee: 'fwd', ankle: 0 },
  R: { foot: [0.797, 0.052, 0], knee: 'fwd', ankle: 0 },
};
const TOP_ARM_UP = { shoulder: { elev: 111, plane: 90 } };

// ---------------------------------------------------------- all fours
// Hands under the shoulders, knees under the hips.
const QUAD_HAND = { hand: [0.19, 0.03, -0.02], elbow: [0.4, 0, -1], palm: 'floor' };


// ---------------------------------------------------------- crawls
// Opposite hand and foot step together. `hand` and `foot` give each limb's
// planted spot; a lift pose carries the moving pair halfway, off the floor.
function gait(base, steps) {
  const keys = {}, seq = [];
  let st = { hL: base.hand.slice(), hR: flipX(base.hand), fL: base.foot.slice(), fR: flipX(base.foot), p: base.pelvis.pos.slice() };
  const pose = (s, label, liftH, liftF) => ({
    label,
    pelvis: { ...base.pelvis, pos: s.p },
    spine: base.spine, neck: base.neck,
    legs: {
      L: { ...base.leg, foot: s.fL.map((v, i) => (i === 1 ? r3(v + (liftF === 'L' ? base.footLift : 0)) : v)) },
      R: { ...base.leg, foot: s.fR.map((v, i) => (i === 1 ? r3(v + (liftF === 'R' ? base.footLift : 0)) : v)),
        knee: Array.isArray(base.leg.knee) ? flipX(base.leg.knee) : base.leg.knee },
    },
    arms: {
      L: { ...base.arm, hand: s.hL.map((v, i) => (i === 1 ? r3(v + (liftH === 'L' ? base.handLift : 0)) : v)) },
      R: { ...base.arm, hand: s.hR.map((v, i) => (i === 1 ? r3(v + (liftH === 'R' ? base.handLift : 0)) : v)),
        elbow: Array.isArray(base.arm.elbow) ? flipX(base.arm.elbow) : base.arm.elbow },
    },
  });
  keys.k0 = pose(st, base.label);
  seq.push('k0');
  steps.forEach(([hand, foot, d, label], i) => {
    const next = { ...st };
    next[`h${hand}`] = st[`h${hand}`].map((v, j) => r3(v + d[j]));
    next[`f${foot}`] = st[`f${foot}`].map((v, j) => r3(v + d[j]));
    next.p = st.p.map((v, j) => r3(v + d[j] / 2));
    const mid = {
      ...st, [`h${hand}`]: mix(st[`h${hand}`], next[`h${hand}`], 0.5), [`f${foot}`]: mix(st[`f${foot}`], next[`f${foot}`], 0.5),
      p: mix(st.p, next.p, 0.5),
    };
    keys[`l${i}`] = pose(mid, null, hand, foot);
    delete keys[`l${i}`].label;
    keys[`k${i + 1}`] = pose(next, label);
    if (!label) delete keys[`k${i + 1}`].label;
    seq.push(`l${i}`, `k${i + 1}`);
    st = next;
  });
  // the last planted pose matches the first: drop it so the loop closes
  const last = seq.pop();
  delete keys[last];
  return { keys, seq };
}

const CRAB = {
  label: 'Hips up',
  pelvis: { pos: [0, 0.4, 0], pitch: -61 },
  neck: { flex: 34 },
  leg: { knee: [0.2, 1, 0.6] }, foot: [0.15, 0.07, 0.42], footLift: 0.07,
  arm: { elbow: [0, 0, -1], palm: 'floor' }, hand: [0.2, 0.03, -0.4], handLift: 0.07,
};
const CRAB_STEP = 0.15;
const crab = gait(CRAB, [
  ['R', 'L', [0, 0, CRAB_STEP], 'Step forward'], ['L', 'R', [0, 0, CRAB_STEP]],
  ['R', 'L', [0, 0, CRAB_STEP]], ['L', 'R', [0, 0, CRAB_STEP]],
  ['R', 'L', [0, 0, -CRAB_STEP], 'Step back'], ['L', 'R', [0, 0, -CRAB_STEP]],
  ['R', 'L', [0, 0, -CRAB_STEP]], ['L', 'R', [0, 0, -CRAB_STEP]],
]);

const BEAR = {
  label: 'Bear position',
  pelvis: { pos: [0, 0.51, -0.46], pitch: 86 },
  leg: { knee: 'down', ankle: 0 }, foot: [0.1, 0.13, -0.886], footLift: 0.05,
  arm: { elbow: [0.4, 0, -1], palm: 'floor' }, hand: [0.19, 0.03, -0.02], handLift: 0.07,
};
const BEAR_STEP = 0.16;
const bearFwd = gait(BEAR, [
  ['R', 'L', [0, 0, BEAR_STEP], 'Crawl forward'], ['L', 'R', [0, 0, BEAR_STEP]],
  ['R', 'L', [0, 0, BEAR_STEP]], ['L', 'R', [0, 0, BEAR_STEP]],
  ['R', 'L', [0, 0, -BEAR_STEP], 'Crawl back'], ['L', 'R', [0, 0, -BEAR_STEP]],
  ['R', 'L', [0, 0, -BEAR_STEP]], ['L', 'R', [0, 0, -BEAR_STEP]],
]);
// sideways: the leading hand and foot step out together, then the trailing
// pair follows, so the feet never cross
const bearSide = gait(BEAR, [
  ['R', 'R', [-BEAR_STEP, 0, 0], 'Step right'], ['L', 'L', [-BEAR_STEP, 0, 0]],
  ['R', 'R', [-BEAR_STEP, 0, 0]], ['L', 'L', [-BEAR_STEP, 0, 0]],
  ['L', 'L', [BEAR_STEP, 0, 0], 'Step left'], ['R', 'R', [BEAR_STEP, 0, 0]],
  ['L', 'L', [BEAR_STEP, 0, 0]], ['R', 'R', [BEAR_STEP, 0, 0]],
]);

// Lying on the back, low back pressed down, shoulders and legs off the floor,
// arms by the ears. `pitch` rocks the whole rigid shape.
const hollowPose = (label, pitch, z) => ({
  label,
  pelvis: { pos: [0, 'auto', z], pitch }, spine: { flex: 16 }, neck: { flex: 10 },
  legs: { L: { hip: { flex: 26, abd: -2 }, knee: 0, ankle: -25 }, R: 'mirror' },
  arms: { L: { shoulder: { elev: 184, plane: 4 }, elbow: 0 }, R: 'mirror' },
});

// ---------------------------------------------------------- inchworm
// Feet stay put at z 0; the hands walk out from beside the feet to a high
// plank at z 1.26 and back. The trunk shape comes from stations along the
// walk, chosen by where the hands are (their midpoint):
//   [hands, hip y, hip z, pitch, spine flex, knee hint]
const INCH = [
  [0.32, 0.86, -0.12, 120, 35, [0, 0, 1]],     // folded, knees soft, hands down
  [0.6, 0.87, 0.14, 136, 12, [0, 0, 1]],       // pike
  [0.77, 0.87, 0.28, 144, 4, [0, -0.3, 1]],
  [0.93, 0.88, 0.46, 140, 0, [0, -0.6, 1]],    // on the balls of the feet
  [1.1, 0.66, 0.66, 104, 0, [0, -0.8, 0.6]],
  [1.26, 0.402, 0.845, 71, 0, [0, -1, 0.2]],   // high plank
];
// Up on the toes: the ankle target for a flat foot at [x, 0.07, z] with the
// heel raised `deg` about the ball of the foot, so the toes stay planted.
function onToes(x, z, deg) {
  const a = ((26.57 + deg) * Math.PI) / 180, L = 0.1565;
  return [x, r3(L * Math.sin(a)), r3(z + 0.14 - L * Math.cos(a))];
}
const INCH_HEEL = [0, 0, 0, 30, 25, 23];     // heel lift at each station
function inchPose(hL, hR, lift, label) {
  const h = (hL + hR) / 2;
  let i = 0;
  while (i < INCH.length - 2 && h > INCH[i + 1][0]) i++;
  const a = INCH[i], b = INCH[i + 1];
  const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
  const heel = mix(INCH_HEEL[i], INCH_HEEL[i + 1], t);
  const foot = heel > 0.5 ? onToes(0.1, 0, heel) : [0.1, 0.07, 0];
  const hand = (z, up) => ({ hand: [0.19, up ? 0.1 : 0.03, r3(z)], elbow: [0.4, 0, -1], palm: 'floor' });
  const pose = {
    pelvis: { pos: [0, mix(a[1], b[1], t), mix(a[2], b[2], t)], pitch: mix(a[3], b[3], t) },
    spine: { flex: mix(a[4], b[4], t) },
    neck: { flex: -6 },
    legs: { L: { foot, knee: mix(a[5], b[5], t), toeOut: 4 }, R: 'mirror' },
    arms: { L: hand(hL, lift === 'L'), R: { ...hand(hR, lift === 'R'), hand: [-0.19, lift === 'R' ? 0.1 : 0.03, r3(hR)], elbow: [-0.4, 0, -1] } },
  };
  if (label) pose.label = label;
  return pose;
}
// the hand path out: [left hand, right hand] after each step
const INCH_WALK = [[0.32, 0.32], [0.47, 0.32], [0.47, 0.62], [0.77, 0.62], [0.77, 0.92], [1.07, 0.92], [1.07, 1.26], [1.26, 1.26]];
function inchworm(withPushup) {
  const keys = {
    stand: { label: 'Stand tall', legs: { L: { foot: [0.1, 0.07, 0], toeOut: 4 }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 6, plane: 90 }, elbow: 8 }, R: 'mirror' } },
    roll: { pelvis: { pos: [0, 0.91, -0.07], pitch: 70 }, spine: { flex: 28 }, neck: { flex: 10 },
      legs: { L: { foot: [0.1, 0.07, 0], knee: 'fwd', toeOut: 4 }, R: 'mirror' },
      arms: { L: { shoulder: { elev: 88, plane: 4 }, elbow: 8 }, R: 'mirror' } },
  };
  const out = ['stand', 'roll'];
  INCH_WALK.forEach(([l, r], i) => {
    const name = `w${i}`;
    keys[name] = inchPose(l, r, null, i === 0 ? 'Hands down' : i === INCH_WALK.length - 1 ? 'Plank' : null);
    if (i > 0) {
      const [pl, pr] = INCH_WALK[i - 1];
      const mover = l !== pl ? 'L' : 'R';
      keys[`u${i}`] = inchPose((l + pl) / 2, (r + pr) / 2, mover);
      out.push(`u${i}`);
    }
    out.push(name);
  });
  const back = out.slice(1, -1).reverse();     // walk the hands back, then roll up
  let seq = [...out];
  if (withPushup) {
    keys.bottom = {
      label: 'Push-up', pelvis: { pos: [0, 0.197, 0.887], pitch: 85 }, neck: { flex: 4 },
      legs: { L: { foot: onToes(0.1, 0, 23), knee: [0, -1, 0.2], toeOut: 4 }, R: 'mirror' },
      arms: { L: { hand: [0.2, 0.03, 1.26], elbow: [0.7, 0.4, -1], palm: 'floor' }, R: { hand: [-0.2, 0.03, 1.26], elbow: [-0.7, 0.4, -1], palm: 'floor' } },
    };
    keys.w7.arms.L.hand[0] = 0.2;
    keys.w7.arms.R.hand[0] = -0.2;
    seq.push('bottom', 'w7');
  }
  seq = [...seq, ...back];
  const tempo = [], holds = {};
  for (let i = 0; i < seq.length; i++) {
    const to = seq[(i + 1) % seq.length];
    tempo.push(to === 'roll' || seq[i] === 'roll' ? 1.1 : to === 'bottom' ? 1.3 : seq[i] === 'bottom' ? 0.9 : 0.24);
    holds[to] = to === 'stand' ? 0.8 : to === 'w7' ? 0.5 : to === 'w0' ? 0.3 : to === 'bottom' ? 0.2 : 0;
  }
  // the roll-down and each lifted hand flow through; hands pause as they land
  const flow = ['roll', ...Object.keys(keys).filter(k => /^u\d/.test(k))];
  return { keys, seq, tempo, holds, flow };
}
const INCH_PLAIN = inchworm(false);
const INCH_PUSH = inchworm(true);

// ---------------------------------------------------------- kettlebell
// windmill stance: feet a bit wider than the hips, both turned about 35
// degrees to the left, away from the bell in the right hand
const WM_FEET = {
  L: { foot: [0.2, 0.07, 0.04], toeOut: 35, knee: [0.7, 0, 1] },
  R: { foot: [-0.2, 0.07, 0], toeOut: -35, knee: [0.5, 0, 1] },
};

// half get-up: right knee bent with the foot flat, left leg straight out at
// about 30 degrees, left arm on the floor at about 45 degrees. The left hand
// stays planted from lying to sitting up on it.
const TGU_LEGS = {
  R: { foot: [-0.2, 0.07, 0.42], knee: 'up' },
  L: { foot: [0.5, 0.08, 0.72], knee: 'up', ankle: -10 },
};
const TGU_POST = { hand: [0.57, 0.03, -0.065], elbow: [0.3, -1, -0.6], palm: 'floor' };

// ---------------------------------------------------------- coaching
const TEXT = {
  plank: {
    muscles: { primary: ['core'], secondary: ['shoulders', 'glutes', 'obliques', 'quads'] },
    coaching: {
      setup: [
        'Forearms on the floor with the elbows directly under the shoulders, forearms parallel.',
        'Legs straight behind you, feet hip-width apart, up on the balls of the feet.',
        'For a high plank, use straight arms with the hands under the shoulders instead.',
      ],
      steps: [
        'Lift the hips so the body makes one straight line from the head to the heels.',
        'Pull the ribs down towards the hips and squeeze the glutes, so the lower back does not sag.',
        'Push the floor away through the forearms so the upper back stays slightly spread, not sunk between the shoulders.',
        'Keep the neck long, eyes on the floor just ahead of the hands, and hold while breathing steadily.',
      ],
      cues: ['Ribs down, glutes tight', 'Elbows under the shoulders', 'Long line, head to heels', 'Keep breathing'],
      mistakes: [
        'Hips sagging towards the floor, which hangs the load on the lower back.',
        'Hips piked up high, which takes the work away from the trunk.',
        'Shoulders sinking between the shoulder blades instead of pushing the floor away.',
        'Holding the breath, which makes the hold shorter and harder than it needs to be.',
      ],
      breathing: 'Slow, steady breaths through the nose if you can. Never hold your breath.',
      tempo: 'A still hold for the set time. Stop when the hips start to sag.',
    },
  },
  plankShoulderTaps: {
    muscles: { primary: ['core', 'obliques'], secondary: ['shoulders', 'chest', 'triceps', 'glutes'] },
    coaching: {
      setup: [
        'High plank: hands under the shoulders, arms straight, body in one line.',
        'Feet a little wider than hip-width. Wider is easier to keep still.',
        'Glutes and abs switched on before the first tap.',
      ],
      steps: [
        'Shift your weight onto the left hand without letting the hips swing.',
        'Lift the right hand and tap the left shoulder, then put the hand back under the right shoulder.',
        'Repeat on the other side, tapping the right shoulder with the left hand.',
        'Keep alternating slowly. The hips should stay level the whole time, as if balancing a cup of water on the lower back.',
      ],
      cues: ['Hips still', 'Tap and plant', 'Squeeze the glutes', 'Feet wide if you wobble'],
      mistakes: [
        'Hips rocking side to side with every tap, which turns it into a hip shuffle.',
        'Rushing the taps, so momentum does the work instead of the trunk.',
        'Hips sagging or piking as you tire.',
        'Hand landing out in front of the shoulder instead of back under it.',
      ],
      breathing: 'Breathe out on each tap, in as the hand goes back down.',
      tempo: 'About 1 second per tap, a short pause with both hands down.',
    },
  },
  plankReach: {
    muscles: { primary: ['core', 'obliques'], secondary: ['shoulders', 'upperBack', 'glutes'] },
    coaching: {
      setup: [
        'High plank: hands under the shoulders, arms straight, body in one line.',
        'Feet wider than hip-width for a stable base.',
        'Brace the trunk and squeeze the glutes.',
      ],
      steps: [
        'Shift your weight onto the left hand, keeping the hips level.',
        'Reach the right arm straight out in front, about shoulder height, thumb up.',
        'Hold for a moment without the hips twisting, then place the hand back under the shoulder.',
        'Repeat with the left arm and keep alternating.',
      ],
      cues: ['Hips level', 'Reach long', 'Push the floor away', 'Slow and still'],
      mistakes: [
        'Hips rotating up on the side of the reaching arm.',
        'Lower back sagging while one hand is off the floor.',
        'Reaching up high instead of straight forward, which arches the back.',
        'Feet too close together, which makes it hard to stay still.',
      ],
      breathing: 'Breathe out as you reach, in as the hand comes back to the floor.',
      tempo: 'About 1 second out, a 1 second hold, 1 second back.',
    },
  },
  plankUpDown: {
    muscles: { primary: ['core', 'triceps'], secondary: ['shoulders', 'chest', 'obliques', 'glutes'] },
    coaching: {
      setup: [
        'Start in a forearm plank: elbows under the shoulders, body in one straight line.',
        'Feet a little wider than hip-width to help keep the hips still.',
        'Squeeze the glutes and pull the ribs down.',
      ],
      steps: [
        'Place the right hand on the floor under the right shoulder and press up.',
        'Place the left hand under the left shoulder and press up into a high plank.',
        'Lower back down onto the right forearm, then the left forearm.',
        'Next rep, lead with the left arm, so both sides get the same work.',
      ],
      cues: ['Forearms to hands and back', 'Hips as still as you can', 'Hands under the shoulders'],
      mistakes: [
        'Big hip sway from side to side on each change.',
        'Piking the hips up to make the press easier.',
        'Hands landing out in front of the shoulders, which strains the wrists and shoulders.',
        'Always leading with the same arm.',
      ],
      breathing: 'Breathe out as you press up, in as you lower to the forearms.',
      tempo: 'About 1 second per arm, controlled rather than fast.',
    },
  },
  plankJack: {
    muscles: { primary: ['core', 'shoulders'], secondary: ['glutes', 'adductors', 'calves', 'chest'] },
    coaching: {
      setup: [
        'High plank: hands under the shoulders, arms straight, feet together.',
        'Body in one straight line from head to heels.',
        'Brace the trunk before the first jump.',
      ],
      steps: [
        'Jump both feet out wide at the same time, landing softly on the balls of the feet.',
        'Jump them straight back together.',
        'Keep the hips at the same height and the shoulders over the hands on every jump.',
        'Keep a steady rhythm, like a jumping jack with the hands on the floor.',
      ],
      cues: ['Jump the feet wide and back', 'Hips stay level', 'Soft, quiet feet'],
      mistakes: [
        'Hips bouncing up and down with every jump.',
        'Shoulders drifting back behind the hands.',
        'Landing heavily, which jars the hips and lower back.',
        'Letting the lower back sag as you tire.',
      ],
      breathing: 'Short, rhythmic breaths. Keep breathing throughout.',
      tempo: 'Quick: about 2 jumps a second, out and in.',
    },
  },
  bearHold: {
    muscles: { primary: ['core', 'quads'], secondary: ['shoulders', 'hipFlexors', 'triceps'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips.',
        'Tuck the toes under so you are on the balls of the feet.',
        'Back flat, neck long, eyes on the floor just ahead of the hands.',
      ],
      steps: [
        'Brace the trunk and push the floor away with the hands.',
        'Lift the knees about an inch (2 to 3 cm) off the floor.',
        'Hold still with the back flat and the hips level with the shoulders.',
        'Lower the knees gently to finish.',
      ],
      cues: ['Knees hovering an inch off the floor', 'Back flat like a table', 'Push the floor away'],
      mistakes: [
        'Lifting the hips high, which turns it into a downward dog.',
        'Rounding or arching the lower back.',
        'Knees drifting forward or back, away from under the hips.',
        'Holding the breath.',
      ],
      breathing: 'Slow, steady breaths into the belly and sides. Keep the brace as you breathe.',
      tempo: 'A still hold for the set time.',
    },
  },
  hollow: {
    muscles: { primary: ['core'], secondary: ['hipFlexors', 'obliques', 'quads'] },
    coaching: {
      setup: [
        'Lie on your back, arms overhead by the ears, legs straight and together.',
        'Press the lower back flat into the floor before anything lifts.',
      ],
      steps: [
        'Lift the shoulders, arms and head off the floor, chin slightly tucked.',
        'Lift the straight legs a little way off the floor, toes pointed.',
        'Hold a shallow banana shape with the lower back stuck to the floor.',
        'For hollow rocks, keep that exact shape and rock from the shoulder blades to the hips and back.',
      ],
      cues: ['Low back pressed flat', 'Ribs down', 'Stay rigid, rock from the shoulders'],
      mistakes: [
        'Lower back arching off the floor. Raise the legs or bend the knees until it stays flat.',
        'Legs so low the back arches, or so high the work disappears.',
        'Bending at the hips during rocks, so the body folds instead of rocking as one piece.',
        'Straining the neck: the head follows the shoulders, it does not lead.',
      ],
      breathing: 'Short, steady breaths. Keep the ribs down as you breathe.',
      tempo: 'Holds: still for the set time. Rocks: about 1 second each way.',
    },
  },
  deadBug: {
    muscles: { primary: ['core'], secondary: ['hipFlexors', 'obliques'] },
    coaching: {
      setup: [
        'Lie on your back, arms straight up over the shoulders.',
        'Lift the legs so the hips and knees are bent to 90 degrees, shins level with the floor.',
        'Press the lower back gently into the floor and pull the ribs down.',
      ],
      steps: [
        'Slowly lower the left arm overhead and straighten the right leg out, both hovering just off the floor.',
        'Keep the lower back pressed down the whole time.',
        'Bring the arm and leg back to the start.',
        'Repeat with the right arm and left leg, and keep alternating.',
      ],
      cues: ['Opposite arm and leg', 'Ribs down', 'Low back stays flat', 'Slow is better'],
      mistakes: [
        'Lower back arching off the floor as the leg goes out. Shorten the reach until it stays flat.',
        'Moving the same side arm and leg.',
        'Rushing, so momentum does the work.',
        'Dropping the arm or leg onto the floor instead of hovering.',
      ],
      breathing: 'Breathe out slowly as you reach, in as you come back.',
      tempo: 'About 2 seconds out, a brief pause, 2 seconds back.',
    },
  },
  birdDog: {
    muscles: { primary: ['core', 'glutes'], secondary: ['lowerBack', 'shoulders', 'upperBack'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips.',
        'Back flat, neck long, eyes on the floor.',
        'Brace the trunk as if about to be poked in the belly.',
      ],
      steps: [
        'Reach the left arm forward and the right leg back at the same time.',
        'Stop when both are level with the back: arm by the ear, heel pushing back.',
        'Hold for a moment with the hips level, then return to all fours.',
        'Repeat with the right arm and left leg, and keep alternating.',
      ],
      cues: ['Opposite arm and leg', 'No wobble', 'Hips level', 'Long, not high'],
      mistakes: [
        'Lifting the leg higher than the back, which arches the lower back.',
        'Hip on the lifting side rolling up towards the ceiling.',
        'Rushing, which hides the wobble instead of fixing it.',
        'Looking up and craning the neck.',
      ],
      breathing: 'Breathe out as you reach, in as you return.',
      tempo: 'About 1 to 2 seconds out, a 1 second hold, 1 second back.',
    },
  },
  sidePlankHold: {
    muscles: { primary: ['obliques', 'core'], secondary: ['glutes', 'shoulders', 'adductors'] },
    coaching: {
      setup: [
        'Lie on your side with the bottom elbow directly under the shoulder, forearm pointing forward.',
        'Legs straight, feet stacked on top of each other.',
        'Easier option: stagger the feet with the top foot in front, or keep the bottom knee down.',
      ],
      steps: [
        'Push the forearm into the floor and lift the hips until the body is one straight line.',
        'Stack the top shoulder over the bottom one and the top hip over the bottom one.',
        'Reach the top arm to the ceiling or rest the hand on the hip.',
        'Hold, then lower with control and switch sides.',
      ],
      cues: ['Stack the shoulders', 'Hips high', 'Push the floor away'],
      mistakes: [
        'Hips sagging towards the floor.',
        'Rolling the chest towards the floor or the ceiling instead of staying stacked.',
        'Elbow out in front of the shoulder, which strains the shoulder.',
        'Shoulder sinking up to the ear instead of pushing away from the floor.',
      ],
      breathing: 'Slow, steady breaths. Never hold your breath.',
      tempo: 'A still hold for the set time on each side.',
    },
  },
  sideBridge: {
    muscles: { primary: ['obliques', 'core'], secondary: ['glutes', 'shoulders'] },
    coaching: {
      setup: [
        'Side plank on the forearm: elbow under the shoulder, feet stacked.',
        'Body in one straight line with the hips high.',
      ],
      steps: [
        'Lower the hips towards the floor under control, stopping just before they touch.',
        'Drive the bottom hip back up past the start, squeezing the side of the waist.',
        'Keep the shoulders stacked and the chest facing forward the whole time.',
        'Finish the reps on one side, then switch.',
      ],
      cues: ['Dip and drive the hip up', 'Shoulders stacked', 'Control the way down'],
      mistakes: [
        'Dropping the hips onto the floor and bouncing out.',
        'Twisting the chest to the floor to get the hips up.',
        'Elbow creeping away from under the shoulder.',
        'Shoulder collapsing towards the ear.',
      ],
      breathing: 'Breathe in as you dip, out as you drive the hip up.',
      tempo: 'About 1 second down, 1 second up.',
    },
  },
  crabWalk: {
    muscles: { primary: ['triceps', 'glutes'], secondary: ['shoulders', 'core', 'hamstrings'] },
    coaching: {
      setup: [
        'Sit with the knees bent and feet flat, hip-width apart.',
        'Hands on the floor behind the hips, fingers pointing towards the feet.',
        'Push through the hands and feet to lift the hips off the floor.',
      ],
      steps: [
        'Keep the hips high, nearly level with the knees.',
        'Step the right hand and left foot forward together, then the left hand and right foot.',
        'Take a few steps forward, then walk back the same way.',
        'Keep the chest open and the shoulders down away from the ears.',
      ],
      cues: ['Hips high', 'Opposite hand and foot', 'Chest open'],
      mistakes: [
        'Hips sinking towards the floor between steps.',
        'Shoulders shrugging up to the ears.',
        'Huge steps that throw the balance around.',
        'Elbows bending as you tire, so the hips drop and the arms stop doing the work.',
      ],
      breathing: 'Keep breathing in a steady rhythm with the steps.',
      tempo: 'About 2 steps a second, smooth rather than fast.',
    },
  },
  bearCrawl: {
    muscles: { primary: ['core', 'shoulders'], secondary: ['quads', 'triceps', 'hipFlexors'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips, toes tucked.',
        'Lift the knees an inch or two off the floor.',
        'Back flat, hips level with the shoulders.',
      ],
      steps: [
        'Step the right hand and left foot forward a short way together.',
        'Then step the left hand and right foot.',
        'Take a few steps forward, then crawl back the same way.',
        'Keep the knees low and the back flat the whole time.',
      ],
      cues: ['Hips low', 'Opposite hand and foot', 'Small steps', 'Knees just off the floor'],
      mistakes: [
        'Hips high in the air, which turns it into a walk on all fours.',
        'Back rounding or swaying side to side.',
        'Big steps that make the hips twist.',
        'Knees dragging on the floor.',
      ],
      breathing: 'Keep breathing in a steady rhythm. Do not hold your breath.',
      tempo: 'Small, steady steps: about 2 a second.',
    },
  },
  bearCrawlLateral: {
    muscles: { primary: ['core', 'shoulders'], secondary: ['quads', 'glutes', 'adductors', 'triceps'] },
    coaching: {
      setup: [
        'On hands and knees: hands under the shoulders, knees under the hips, toes tucked.',
        'Lift the knees an inch or two off the floor.',
        'Back flat, hips level with the shoulders.',
      ],
      steps: [
        'Step the right hand and right foot out to the right together.',
        'Bring the left hand and left foot across to meet them, back to shoulder and hip width.',
        'Take a few steps to the right, then crawl back to the left.',
        'Keep the knees low and the hips level the whole way.',
      ],
      cues: ['Sideways, knees off the floor', 'Hips level', 'Small steps'],
      mistakes: [
        'Knees dropping to the floor or hips rising high.',
        'Hips swaying and twisting with each step.',
        'Hands or feet crossing over each other.',
        'Rushing, so the back rounds.',
      ],
      breathing: 'Keep breathing in a steady rhythm with the steps.',
      tempo: 'Small, steady steps: about 2 a second.',
    },
  },
  inchworm: {
    muscles: { primary: ['core', 'hamstrings'], secondary: ['shoulders', 'chest', 'triceps', 'calves'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart.',
        'The feet stay in the same spot for the whole rep.',
      ],
      steps: [
        'Hinge forward and fold down until the hands are flat on the floor just in front of the feet. Bend the knees as much as you need.',
        'Walk the hands forward one at a time, letting the heels rise as the hips come down.',
        'Stop in a high plank with the hands under the shoulders and the body in a straight line.',
        'Walk the hands back towards the feet, lifting the hips as you go.',
        'Roll up to standing and go again.',
      ],
      cues: ['Walk the hands out to a plank', 'Feet stay put', 'Brace in the plank'],
      mistakes: [
        'Walking the feet in or out instead of keeping them planted.',
        'Hips sagging when you reach the plank.',
        'Taking huge hand steps that collapse the trunk.',
        'Forcing straight legs in the fold: bend the knees if the hamstrings are tight.',
      ],
      breathing: 'Breathe out as you fold, steady breaths as you walk, in as you stand.',
      tempo: 'Unhurried: about 4 to 6 seconds out and the same back.',
    },
  },
  inchwormPushup: {
    muscles: { primary: ['chest', 'core', 'hamstrings'], secondary: ['triceps', 'shoulders', 'calves'] },
    coaching: {
      setup: [
        'Stand tall with the feet hip-width apart.',
        'The feet stay in the same spot for the whole rep.',
      ],
      steps: [
        'Fold down until the hands are flat on the floor in front of the feet, bending the knees as needed.',
        'Walk the hands out one at a time to a high plank, hands under the shoulders.',
        'Do one push-up: lower the whole body together, elbows back at about 45 degrees, then press up.',
        'Walk the hands back to the feet and roll up to standing.',
      ],
      cues: ['Walk out, one push-up, walk back', 'Feet stay put', 'Body like a plank'],
      mistakes: [
        'Hips sagging in the plank or the push-up.',
        'Elbows flared straight out to the sides in the push-up.',
        'Walking the feet instead of the hands.',
        'Half push-ups: lower until the chest is a fist-height off the floor.',
      ],
      breathing: 'Breathe in on the way down in the push-up, out as you press up. Keep breathing as you walk.',
      tempo: 'Steady walk out, about 2 seconds down and 1 second up in the push-up, steady walk back.',
    },
  },
  kbWindmill: {
    muscles: { primary: ['obliques', 'shoulders'], secondary: ['core', 'hamstrings', 'glutes', 'upperBack'] },
    coaching: {
      setup: [
        'Press or clean the kettlebell overhead in the right hand, arm locked straight.',
        'Feet a little wider than the hips, both turned about 45 degrees to the left.',
        'Eyes on the bell, shoulder packed down away from the ear.',
      ],
      steps: [
        'Push the hips back and out to the right, over the right foot.',
        'Hinge sideways and slide the left hand down the inside of the left leg, left knee softly bent.',
        'Keep the right arm vertical and locked, so the bell stays stacked over the shoulder.',
        'Go as low as you can with a long spine, the hand to the shin or the floor.',
        'Drive the hips forward and stand back up, keeping your eyes on the bell.',
      ],
      cues: ['Locked overhead', 'Hinge sideways', 'Eyes on the bell', 'Hips back and out'],
      mistakes: [
        'Bending the overhead elbow or letting the bell drift forward or back.',
        'Bending sideways at the waist instead of hinging at the hips.',
        'Rounding the back to reach lower than your hips allow.',
        'Taking your eyes off the bell.',
      ],
      breathing: 'Breathe in at the top, breathe out slowly on the way down, in again as you stand.',
      tempo: 'Slow: about 2 to 3 seconds down, 2 seconds up.',
    },
  },
  halfGetup: {
    muscles: { primary: ['core', 'shoulders'], secondary: ['obliques', 'triceps', 'upperBack', 'glutes'] },
    coaching: {
      setup: [
        'Lie on your back with the kettlebell pressed straight up in the right hand, arm locked.',
        'Right knee bent with the foot flat near the hip. Left leg straight and out at about 30 degrees.',
        'Left arm on the floor at about 45 degrees from the body, palm down.',
      ],
      steps: [
        'Eyes on the bell. Push through the right heel and punch the bell to the ceiling.',
        'Roll up onto the left elbow, keeping the right arm vertical.',
        'Press through the left hand and straighten the arm to sit up tall, chest open.',
        'Reverse it with control: back to the elbow, then down to the floor.',
        'Do all the reps on one side, then switch hands and sides.',
      ],
      cues: ['Floor to elbow to hand', 'Eyes on the bell', 'Arm vertical, wrist straight'],
      mistakes: [
        'Letting the bell arm drift off vertical as you come up.',
        'Crunching straight up instead of rolling to the elbow.',
        'Bent wrist under the bell instead of a straight, stacked wrist.',
        'Shoulder of the posting arm sinking towards the ear.',
      ],
      breathing: 'Breathe out as you roll up to each position, in as you settle. Do not hold your breath for long.',
      tempo: 'Slow and deliberate: about 2 seconds for each stage, a pause in each position.',
    },
  },
};

const MOVES = {
  plank: {
    camera: { yaw: 60, pitch: 12 },
    keys: {
      hold: { label: 'Forearm plank', pelvis: FOREARM_P, legs: PLANK_FEET, arms: { L: FOREARM, R: 'mirror' } },
      breathe: { label: 'Breathe', pelvis: { pos: [0, 0.244, -0.409], pitch: 81.8 }, legs: PLANK_FEET,
        arms: { L: FOREARM, R: 'mirror' } },
    },
    seq: ['hold', 'breathe'],
    tempo: [2, 2],
    holds: { hold: 0.6, breathe: 0.6 },
  },

  plankShoulderTaps: {
    camera: { yaw: 35, pitch: 14 },
    keys: {
      plank: { label: 'High plank', pelvis: HIGH_P, legs: WIDE_FEET, arms: { L: PALM, R: 'mirror' } },
      tapR: { label: 'Right tap', pelvis: { ...HIGH_P, pos: [0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { L: PALM, R: { hand: [0.08, 0.455, 0.05], elbow: [-0.3, -1, 0.2] } } },
      tapL: { label: 'Left tap', pelvis: { ...HIGH_P, pos: [-0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { R: mirrorArm(PALM), L: { hand: [-0.08, 0.455, 0.05], elbow: [0.3, -1, 0.2] } } },
    },
    seq: ['plank', 'tapR', 'plank', 'tapL'],
    tempo: [0.6, 0.6, 0.6, 0.6],
    holds: { plank: 0.2, tapR: 0.25, tapL: 0.25 },
  },

  plankReach: {
    camera: { yaw: 35, pitch: 14 },
    keys: {
      plank: { label: 'High plank', pelvis: HIGH_P, legs: WIDE_FEET, arms: { L: PALM, R: 'mirror' } },
      reachR: { label: 'Right reach', pelvis: { ...HIGH_P, pos: [0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { L: PALM, R: { hand: [-0.18, 0.62, 0.49], elbow: [0, -1, 0] } } },
      reachL: { label: 'Left reach', pelvis: { ...HIGH_P, pos: [-0.02, 0.405, -0.447] }, legs: WIDE_FEET,
        arms: { R: mirrorArm(PALM), L: { hand: [0.18, 0.62, 0.49], elbow: [0, -1, 0] } } },
    },
    seq: ['plank', 'reachR', 'plank', 'reachL'],
    tempo: [0.9, 0.9, 0.9, 0.9],
    holds: { plank: 0.3, reachR: 0.6, reachL: 0.6 },
  },

  plankUpDown: {
    camera: { yaw: 50, pitch: 12 },
    keys: {
      fore: { label: 'Forearms', pelvis: FOREARM_P, legs: PLANK_FEET, arms: { L: FOREARM, R: 'mirror' } },
      halfR: { label: 'One hand', pelvis: { pos: [-0.02, 0.3, -0.43], pitch: 77, roll: 8 }, spine: { twist: -26 },
        legs: PLANK_FEET, arms: { L: FOREARM, R: mirrorArm(PALM) } },
      high: { label: 'Hands', pelvis: HIGH_P, legs: PLANK_FEET, arms: { L: PALM, R: 'mirror' } },
      halfL: { label: 'One hand', pelvis: { pos: [0.02, 0.3, -0.43], pitch: 77, roll: -8 }, spine: { twist: 26 },
        legs: PLANK_FEET, arms: { R: mirrorArm(FOREARM), L: PALM } },
    },
    seq: ['fore', 'halfR', 'high', 'halfL', 'fore', 'halfL', 'high', 'halfR'],
    tempo: 0.7,
    holds: { fore: 0.3, high: 0.3, halfR: 0.1, halfL: 0.1 },
  },

  plankJack: {
    camera: { yaw: 30, pitch: 14 },
    keys: {
      in: { label: 'Feet together', pelvis: HIGH_P, legs: { L: { foot: [0.06, 0.12, -1.26], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
      air: { pelvis: { ...HIGH_P, pos: [0, 0.425, -0.447] }, legs: { L: { foot: [0.19, 0.19, -1.24], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
      out: { label: 'Feet wide', pelvis: HIGH_P, legs: { L: { foot: [0.32, 0.12, -1.22], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: PALM, R: 'mirror' } },
    },
    flow: ['air'],
    seq: ['in', 'air', 'out', 'air'],
    tempo: 0.18,
    holds: { in: 0.08, out: 0.08, air: 0 },
  },

  bearHold: {
    camera: { yaw: 70, pitch: 10 },
    keys: {
      kneel: { label: 'All fours', pelvis: { pos: [0, 0.48, -0.46], pitch: 84 },
        legs: { L: { foot: [0.1, 0.13, -0.886], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
      hover: { label: 'Knees hover', pelvis: { pos: [0, 0.51, -0.46], pitch: 86 },
        legs: { L: { foot: [0.1, 0.13, -0.886], knee: 'down', ankle: 0 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
    },
    seq: ['kneel', 'hover'],
    tempo: [0.8, 0.8],
    holds: { kneel: 0.6, hover: 3 },
  },

  hollow: {
    camera: { yaw: 80, pitch: 8 },
    keys: {
      hold: hollowPose('Hollow hold', -86, 0),
      back: hollowPose('Rock to shoulders', -95, 0.03),
      fwd: hollowPose('Rock to hips', -78, -0.03),
    },
    seq: ['hold', 'back', 'fwd', 'back', 'fwd'],
    tempo: [0.6, 0.7, 0.7, 0.7, 0.6],
    holds: { hold: 2.5, back: 0, fwd: 0 },
  },

  deadBug: {
    camera: { yaw: 70, pitch: 14 },
    keys: {
      top: { label: 'Arms up, knees up', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { L: { hip: { flex: 90 }, knee: 90, ankle: 0 }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 90, plane: 0 } }, R: 'mirror' } },
      extR: { label: 'Left arm, right leg', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { L: { hip: { flex: 90 }, knee: 90, ankle: 0 }, R: { hip: { flex: 10 }, knee: 4, ankle: 0 } },
        arms: { R: { shoulder: { elev: 90, plane: 0 } }, L: { shoulder: { elev: 170, plane: 0 } } } },
      extL: { label: 'Right arm, left leg', pelvis: { pos: [0, 'auto', 0], pitch: -90 },
        legs: { R: { hip: { flex: 90 }, knee: 90, ankle: 0 }, L: { hip: { flex: 10 }, knee: 4, ankle: 0 } },
        arms: { L: { shoulder: { elev: 90, plane: 0 } }, R: { shoulder: { elev: 170, plane: 0 } } } },
    },
    seq: ['top', 'extR', 'top', 'extL'],
    tempo: [1.6, 1.2, 1.6, 1.2],
    holds: { top: 0.3, extR: 0.4, extL: 0.4 },
  },

  birdDog: {
    camera: { yaw: 60, pitch: 12 },
    keys: {
      quad: { label: 'All fours', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { L: { foot: [0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, R: 'mirror' },
        arms: { L: QUAD_HAND, R: 'mirror' } },
      reachL: { label: 'Left arm, right leg', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { L: { foot: [0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, R: { hip: { flex: -8 }, knee: 0, ankle: 0 } },
        arms: { R: mirrorArm(QUAD_HAND), L: { shoulder: { elev: 172, plane: 0 }, elbow: 0 } } },
      reachR: { label: 'Right arm, left leg', pelvis: { pos: [0, 0.48, -0.46], pitch: 82 },
        legs: { R: { foot: [-0.1, 0.06, -0.89], knee: 'down', ankle: -75 }, L: { hip: { flex: -8 }, knee: 0, ankle: 0 } },
        arms: { L: QUAD_HAND, R: { shoulder: { elev: 172, plane: 0 }, elbow: 0 } } },
    },
    seq: ['quad', 'reachL', 'quad', 'reachR'],
    tempo: [1.3, 1.1, 1.3, 1.1],
    holds: { quad: 0.3, reachL: 1, reachR: 1 },
  },

  sidePlankHold: {
    camera: { yaw: 20, pitch: 8 },
    keys: {
      hold: { label: 'Side plank', pelvis: { pos: [0, 0.374, 0], roll: -71 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
      breathe: { label: 'Breathe', pelvis: { pos: [0, 0.379, 0], roll: -71.3 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
    },
    seq: ['hold', 'breathe'],
    tempo: [2, 2],
    holds: { hold: 0.6, breathe: 0.6 },
  },

  sideBridge: {
    camera: { yaw: 20, pitch: 8 },
    keys: {
      up: { label: 'Hips high', pelvis: { pos: [0, 0.374, 0], roll: -71 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: TOP_ARM_UP } },
      dip: { label: 'Dip', pelvis: { pos: [-0.02, 0.19, 0], roll: -70 }, spine: { side: 30 }, legs: SIDE_FEET,
        arms: { R: SIDE_ELBOW, L: { shoulder: { elev: 140, plane: 90 } } } },
    },
    seq: ['up', 'dip'],
    tempo: [1.2, 0.9],
    holds: { up: 0.5, dip: 0.15 },
  },

  crabWalk: {
    camera: { yaw: 70, pitch: 12 },
    keys: crab.keys,
    flow: [],
    seq: crab.seq,
    tempo: 0.32,
    holds: Object.fromEntries(crab.seq.map((k) => [k, 0])),
  },

  bearCrawl: {
    camera: { yaw: 70, pitch: 12 },
    keys: bearFwd.keys,
    flow: [],
    seq: bearFwd.seq,
    tempo: 0.3,
    holds: Object.fromEntries(bearFwd.seq.map((k) => [k, 0])),
  },

  bearCrawlLateral: {
    camera: { yaw: 20, pitch: 14 },
    keys: bearSide.keys,
    flow: [],
    seq: bearSide.seq,
    tempo: 0.3,
    holds: Object.fromEntries(bearSide.seq.map((k) => [k, 0])),
  },

  inchworm: {
    camera: { yaw: 70, pitch: 10 },
    ...INCH_PLAIN,
  },

  inchwormPushup: {
    camera: { yaw: 70, pitch: 10 },
    ...INCH_PUSH,
  },

  kbWindmill: {
    camera: { yaw: 10, pitch: 8 },
    props: [{ type: 'kettlebell', hand: 'R', grip: 'auto' }],
    keys: {
      top: { label: 'Bell locked out', pelvis: { pos: [0, 0.92, 0], yaw: 30 }, neck: { flex: -20, twist: -10 },
        legs: WM_FEET,
        arms: { R: { hand: [-0.18, 1.915, 0.065], elbow: 'out' }, L: { shoulder: { elev: 10, plane: 60 }, elbow: 10 } } },
      half: { pelvis: { pos: [-0.1, 0.9, -0.04], yaw: 38, pitch: 30, roll: 10 }, spine: { twist: -30, side: 14 },
        neck: { flex: -20, twist: -25 }, legs: WM_FEET,
        arms: { R: { hand: [-0.006, 1.926, 0.085], elbow: 'out' }, L: { hand: [0.24, 0.66, 0.06], elbow: 'back' } } },
      bottom: { label: 'Hinge down', pelvis: { pos: [-0.19, 0.86, -0.08], yaw: 40, pitch: 58, roll: 22 },
        spine: { twist: -65, side: 30 }, neck: { flex: -10, twist: -70 }, legs: WM_FEET,
        arms: { R: { hand: [0.199, 1.722, 0.025], elbow: 'out' }, L: { hand: [0.16, 0.3, 0.1], elbow: 'back' } } },
    },
    flow: ['half'],
    seq: ['top', 'half', 'bottom', 'half'],
    tempo: [1.0, 1.2, 1.0, 0.9],
    holds: { top: 0.6, bottom: 0.5, half: 0 },
  },


  halfGetup: {
    camera: { yaw: 35, pitch: 14 },
    props: [{ type: 'kettlebell', hand: 'R', grip: 'auto' }],
    keys: {
      lie: { label: 'Bell pressed up', pelvis: { pos: [0, 0.125, 0], pitch: -90 }, neck: { flex: 8, twist: -15 },
        legs: TGU_LEGS, arms: { R: { hand: [-0.19, 0.64, -0.445], elbow: 'out' }, L: { ...TGU_POST, elbow: 'up' } } },
      elbow: { label: 'To the elbow', pelvis: { pos: [0, 0.1, 0], pitch: -40, roll: 20, yaw: -10 }, spine: { twist: 10 },
        neck: { flex: -10, twist: -20 }, legs: TGU_LEGS, arms: { R: { hand: [0.03, 1.02, -0.31], elbow: 'out' }, L: TGU_POST } },
      hand: { label: 'To the hand', pelvis: { pos: [0, 0.1, 0], pitch: -5 }, spine: { side: 14, twist: -15 },
        neck: { flex: -20, twist: -20 }, legs: TGU_LEGS, arms: { R: { hand: [-0.108, 1.125, -0.113], elbow: 'out' }, L: TGU_POST } },
    },
    seq: ['lie', 'elbow', 'hand', 'elbow'],
    tempo: [1.4, 1.2, 1.1, 1.3],
    holds: { lie: 0.8, elbow: 0.4, hand: 0.8 },
  },

};
for (const [name, t] of Object.entries(TEXT)) Object.assign(MOVES[name], t);

export default MOVES;
