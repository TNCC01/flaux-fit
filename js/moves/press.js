/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.
  3D movement data, overhead pressing and arms: see js/moves/README.md.
*/
const STANCE = { L: { foot: [0.12, 0.07, 0], toeOut: 8 }, R: 'mirror' };
const ARM_DOWN = { shoulder: { elev: 6, plane: 90 }, elbow: 10 };

// Wall walks and the wall handstand: a chest-to-wall walk up from a push-up.
// Each stage is a whole-body pose; between stages one hand and the opposite
// foot step at a time (lifted on the way, then planted), so nothing slides.
const WALL_Z = -1.35;                   // wall centre; its face is at z -1.30
const lerpN = (a, b, t) => Math.round((a + (b - a) * t) * 1000) / 1000;
const WALL_STAGES = [
  // label, pelvis [y, z], pitch, hands z, feet [y, z], ankle
  { label: 'Push-up', pelvis: [0.41, -0.39], pitch: 72, hand: -0.06, foot: [0.122, -1.15], ankle: 0 },
  { label: 'Feet on wall', pelvis: [0.575, -0.4], pitch: 94, hand: -0.06, foot: [0.6, -1.21], ankle: 20 },
  { label: 'Straight line', pelvis: [0.729, -0.478], pitch: 115, hand: -0.06, foot: [1.095, -1.21], ankle: 30 },
  { label: 'Step', pelvis: [0.814, -0.575], pitch: 127, hand: -0.2, foot: [1.342, -1.21], ankle: 38 },
  { label: 'Step', pelvis: [0.869, -0.664], pitch: 136, hand: -0.33, foot: [1.488, -1.21], ankle: 42 },
  { label: 'Step', pelvis: [0.912, -0.754], pitch: 144, hand: -0.465, foot: [1.601, -1.21], ankle: -65 },
  { label: 'Step', pelvis: [0.945, -0.844], pitch: 151, hand: -0.6, foot: [1.686, -1.21], ankle: -60 },
  { label: 'Step', pelvis: [0.971, -0.931], pitch: 158, hand: -0.73, foot: [1.748, -1.21], ankle: -55 },
  { label: 'Step', pelvis: [0.990, -1.016], pitch: 164, hand: -0.86, foot: [1.793, -1.21], ankle: -50 },
  { label: 'Step', pelvis: [1.004, -1.102], pitch: 170, hand: -0.99, foot: [1.823, -1.21], ankle: -45 },
  { label: 'Handstand', pelvis: [1.013, -1.183], pitch: 176, hand: -1.115, foot: [1.862, -1.21], ankle: -40 },
];
function wallPose(st, hands, feet, extra = {}) {
  // kneecaps face the way the body faces; elbows point back towards the feet
  const p = (st.pitch * Math.PI) / 180;
  const front = [0, lerpN(0, -Math.sin(p), 1), lerpN(0, Math.cos(p), 1)];
  const elbow = (x) => [x, lerpN(0, 0.3 - Math.cos(p), 1), lerpN(0, -Math.sin(p), 1)];
  return {
    label: st.label,
    pelvis: { pos: [0, st.pelvis[0], st.pelvis[1]], pitch: st.pitch },
    legs: {
      L: { foot: [0.1, feet.L[0], feet.L[1]], knee: front, ankle: feet.L[2] },
      R: { foot: [-0.1, feet.R[0], feet.R[1]], knee: front, ankle: feet.R[2] },
    },
    arms: {
      L: { hand: [0.25, hands.L[0], hands.L[1]], elbow: elbow(0.4), palm: 'floor' },
      R: { hand: [-0.25, hands.R[0], hands.R[1]], elbow: elbow(-0.4), palm: 'floor' },
    },
    ...extra,
  };
}
// every key pose of the walk up: [name, pose]
function wallWalkUp() {
  const out = [];
  const S = WALL_STAGES;
  const handAt = (st) => [0.03, st.hand];
  const footAt = (st) => [st.foot[0], st.foot[1], st.ankle];
  const mid = (a, b, t) => ({ label: 'Step', pelvis: [lerpN(a.pelvis[0], b.pelvis[0], t), lerpN(a.pelvis[1], b.pelvis[1], t)],
    pitch: lerpN(a.pitch, b.pitch, t) });
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    const moveHands = a.hand !== b.hand;
    // lifted in the air halfway between two spots: hands up off the floor,
    // feet off the wall (or the floor)
    const liftH = (p, q) => [0.1, lerpN(p[1], q[1], 0.5)];
    const liftF = (p, q) => [lerpN(p[0], q[0], 0.5) + 0.04, lerpN(p[1], q[1], 0.5) + 0.08, lerpN(p[2], q[2], 0.5)];
    const hA = handAt(a), hB = handAt(b), fA = footAt(a), fB = footAt(b);
    out.push([`s${i}a`, wallPose(mid(a, b, 0.25), { L: hA, R: moveHands ? liftH(hA, hB) : hA }, { L: liftF(fA, fB), R: fA }, { pass: true })]);
    out.push([`s${i}b`, wallPose(mid(a, b, 0.6), { L: hA, R: hB }, { L: fB, R: fA })]);
    out.push([`s${i}c`, wallPose(mid(a, b, 0.75), { L: moveHands ? liftH(hA, hB) : hA, R: hB }, { L: fB, R: liftF(fA, fB) }, { pass: true })]);
    out.push([`s${i + 1}`, wallPose(b, { L: hB, R: hB }, { L: fB, R: fB })]);
  }
  return out;
}
const WALL_UP = wallWalkUp();
const WALL_KEYS = Object.fromEntries([['s0', wallPose(WALL_STAGES[0], { L: [0.03, -0.06], R: [0.03, -0.06] },
  { L: [0.122, -1.15, 0], R: [0.122, -1.15, 0] })], ...WALL_UP]);
const WALL_SEQ_UP = ['s0', ...WALL_UP.map(([n]) => n)];

export default {
  pikePushup: {
    camera: { yaw: 80, pitch: 10 },
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'chest', 'core'] },
    coaching: {
      setup: [
        'Start in a push-up, then walk the feet in and lift the hips high so the body makes an upside-down V.',
        'Hands a little wider than the shoulders, fingers spread and pointing forward.',
        'Legs as straight as your hamstrings allow, weight on the balls of the feet.',
      ],
      steps: [
        'Keep the hips high and bend the elbows, lowering the top of the head towards the floor just in front of the hands.',
        'Let the elbows travel back at about 45 degrees, not straight out to the sides.',
        'Stop when the head is a few centimetres off the floor.',
        'Push the floor away until the arms are straight, pressing the chest back towards the thighs.',
      ],
      cues: ['Hips high', 'Crown to the floor', 'Elbows back, not out'],
      mistakes: [
        'Letting the hips drop so it turns into a normal push-up and the shoulders do less of the work.',
        'Flaring the elbows straight out, which crowds the front of the shoulder.',
        'Lowering the face or chin instead of the top of the head, which cranks the neck.',
        'Bouncing the head off the floor: stop just short and press.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you press up.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      top: {
        label: 'Hips high',
        pelvis: { pos: [0, 0.77, -0.666], pitch: 140 },
        legs: { L: { foot: [0.1, 0.1, -1.16], knee: 'fwd', ankle: -30 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 0.03, 0], elbow: [0.35, 0.7, -0.8], palm: 'floor' }, R: 'mirror' },
      },
      bottom: {
        label: 'Crown down',
        pelvis: { pos: [0, 0.612, -0.481], pitch: 137 },
        legs: { L: { foot: [0.1, 0.1, -1.16], knee: 'fwd', ankle: -30 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 0.03, 0], elbow: [0.35, 0.7, -0.8], palm: 'floor' }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { top: 0.4, bottom: 0.2 },
  },
  elevatedPikePushup: {
    camera: { yaw: 80, pitch: 10 },
    props: [{ type: 'bench', pos: [0, 0, -0.9], size: [1.0, 0.45, 0.35] }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'chest', 'core'] },
    coaching: {
      setup: [
        'Put the feet on a bench or sturdy chair behind you and walk the hands in until the hips are stacked over the shoulders.',
        "Hands a little wider than the shoulders, about a forearm's length from the bench.",
        'Trunk close to vertical, legs straight or softly bent, weight on the balls of the feet.',
      ],
      steps: [
        'Brace the trunk and keep the hips high over the shoulders.',
        'Bend the elbows and lower the top of the head towards the floor just in front of the hands.',
        'Elbows track back at about 45 degrees, forearms close to vertical.',
        'Press the floor away until the arms are straight and the shoulders are pushed up towards the ears.',
      ],
      cues: ['Feet on the bench', 'Stack the shoulders', 'Crown to the floor'],
      mistakes: [
        'Hands too far from the bench, so the body slopes and the chest does the work.',
        'Arching the lower back and letting the ribs flare.',
        'Elbows flaring straight out to the sides.',
        'Dropping the head fast and bouncing: lower under control.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you press up.',
      tempo: 'About 2 seconds down, a brief pause, 1 second up.',
    },
    keys: {
      top: {
        label: 'Hips stacked',
        pelvis: { pos: [0, 1.0, -0.17], pitch: 166 },
        legs: { L: { foot: [0.1, 0.655, -0.92], knee: 'fwd', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 0.03, 0], elbow: [0.4, 0.7, -0.8], palm: 'floor' }, R: 'mirror' },
      },
      bottom: {
        label: 'Crown down',
        pelvis: { pos: [0, 0.813, -0.072], pitch: 171 },
        legs: { L: { foot: [0.1, 0.655, -0.92], knee: 'fwd', ankle: 0 }, R: 'mirror' },
        arms: { L: { hand: [0.24, 0.03, 0], elbow: [0.4, 0.7, -0.8], palm: 'floor' }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [2.0, 1.2],
    holds: { top: 0.4, bottom: 0.2 },
  },
  wallHandstand: {
    camera: { yaw: 90, pitch: 8 },
    props: [{ type: 'wall', z: WALL_Z }],
    muscles: { primary: ['shoulders', 'core'], secondary: ['triceps', 'upperBack', 'traps', 'glutes', 'forearms'] },
    coaching: {
      setup: [
        'Start in a push-up with the soles of your feet against the base of a wall.',
        'Clear the space around you and use a mat or soft floor under the hands.',
        'Hands shoulder-width apart, fingers spread and gripping the floor.',
      ],
      steps: [
        'Walk the feet up the wall a step at a time until the body makes a straight line.',
        'Walk the hands in towards the wall, one small step at a time, as the feet climb higher.',
        'Stop with the hands about a hand-length from the wall, chest facing it and toes touching it.',
        'Hold: arms locked, shoulders pushed up to the ears, ribs down, glutes and legs squeezed.',
        'To come down, walk the hands out and the feet down the same way, slowly.',
      ],
      cues: ['Walk the feet up', 'Push the floor away', 'Squeeze everything'],
      mistakes: [
        'Arching the lower back into a banana shape instead of keeping the ribs down.',
        'Letting the shoulders sink towards the floor instead of pushing tall through the arms.',
        'Taking big lunging steps: small steps keep you in control.',
        'Holding the breath the whole time. Short, steady breaths through the nose.',
      ],
      breathing: 'Breathe steadily through the nose during the hold, bracing the trunk on each breath out.',
      tempo: 'Take 5 to 10 seconds to walk up, hold for your target time, then walk down just as slowly.',
    },
    keys: { ...WALL_KEYS, s10: { ...WALL_KEYS.s10, label: 'Hold' } },
    seq: [...WALL_SEQ_UP, ...WALL_SEQ_UP.slice(1, -1).reverse()],
    tempo: 0.26,
    holds: { s10: 5, s0: 0.8 },
  },
  wallWalk: {
    camera: { yaw: 90, pitch: 8 },
    props: [{ type: 'wall', z: WALL_Z }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['core', 'upperBack', 'chest', 'glutes'] },
    coaching: {
      setup: [
        'Start in a push-up with the soles of your feet against the base of a wall.',
        'Clear the space around you and use a mat or soft floor under the hands.',
        'Hands shoulder-width apart, glutes and abs switched on.',
      ],
      steps: [
        'Walk the feet up the wall until the body makes a straight line from hands to feet.',
        'Walk the hands in towards the wall in small steps as the feet climb higher.',
        'Go as close to the wall as you can control, aiming for the chest to almost touch it.',
        'Pause, then walk the hands back out and the feet back down to the push-up.',
      ],
      cues: ['Walk the hands in, then back out', 'Small steps', 'Ribs down, arms long'],
      mistakes: [
        'Letting the hips sag or the lower back arch as the body gets steeper.',
        'Taking big steps with the hands, which makes it easy to lose balance.',
        'Bending the elbows as you step: keep the arms long and push the floor away.',
        'Rushing the way down instead of walking out with control.',
      ],
      breathing: "Keep breathing in short breaths with each step, don't hold your breath.",
      tempo: 'Steady, controlled steps: about 5 seconds up, a short pause, 5 seconds down.',
    },
    keys: WALL_KEYS,
    seq: [...WALL_SEQ_UP, ...WALL_SEQ_UP.slice(1, -1).reverse()],
    tempo: 0.24,
    holds: { s10: 0.8, s0: 0.6 },
  },
  benchDips: {
    camera: { yaw: 60, pitch: 8 },
    props: [{ type: 'bench', pos: [0, 0, -0.3], size: [1.0, 0.45, 0.35] }],
    muscles: { primary: ['triceps'], secondary: ['chest', 'shoulders'] },
    coaching: {
      setup: [
        'Sit on the edge of a sturdy bench with your hands next to your hips, fingers over the front edge.',
        'Walk the feet out and slide the hips just off the bench, arms straight.',
        'Knees bent with feet flat is easier, legs straight is harder.',
      ],
      steps: [
        'Bend the elbows straight back and lower the hips towards the floor, keeping the back close to the bench.',
        'Keep the shoulders down away from the ears and the chest open.',
        'Lower until the upper arms are about level with the floor, or as far as the shoulders are comfortable.',
        'Press through the heels of the hands to straighten the arms.',
      ],
      cues: ['Elbows straight back', 'Back close to the bench', 'Shoulders down'],
      mistakes: [
        'Elbows flaring out to the sides, which moves the load off the triceps.',
        'Letting the hips drift away from the bench so the shoulders roll forward.',
        'Dropping too deep, which strains the front of the shoulder.',
        'Pushing up with the legs instead of the arms.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you press up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        pelvis: { pos: [0, 0.585, -0.025] },
        legs: { L: { foot: [0.14, 0.07, 0.45], knee: [0.1, 1, 0.4] }, R: 'mirror' },
        arms: { L: { hand: [0.2, 0.48, -0.19], elbow: 'back', palm: 'floor' }, R: 'mirror' },
      },
      bottom: {
        label: 'Elbows bent',
        pelvis: { pos: [0, 0.408, -0.02], pitch: 4 },
        legs: { L: { foot: [0.14, 0.07, 0.45], knee: [0.1, 1, 0.4] }, R: 'mirror' },
        arms: { L: { hand: [0.2, 0.48, -0.19], elbow: 'back', palm: 'floor' }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { top: 0.4, bottom: 0.2 },
  },
  ringDip: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'rings' }],
    muscles: { primary: ['triceps', 'chest'], secondary: ['shoulders', 'core', 'forearms'] },
    coaching: {
      setup: [
        'Set the rings about hip height or higher, and jump or press up to straight arms.',
        'Hands beside the hips, rings turned out slightly, shoulders pushed down away from the ears.',
        'Knees bent and feet off the floor, body still. Use bench dips instead if the rings are too high.',
      ],
      steps: [
        'Lean slightly forward and bend the elbows, letting them travel straight back.',
        'Lower until the shoulders are about level with the elbows, keeping the rings close to the body.',
        'Press back up to straight arms, finishing with the rings by the hips.',
      ],
      cues: ['Rings close to the body', 'Elbows back', 'Shoulders down'],
      mistakes: [
        'Letting the rings drift away from the body, which strains the shoulders.',
        'Shrugging up towards the ears at the bottom.',
        'Swinging the legs to get up.',
        'Going deeper than the shoulders can control.',
      ],
      breathing: 'Breathe in on the way down, breathe out as you press up.',
      tempo: 'About 2 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Support',
        pelvis: { pos: [0, 1.2, 0] },
        legs: { L: { hip: { flex: 5, abd: 2 }, knee: 70, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.27, 1.095, 0.02], elbow: 'back', turn: 20 }, R: 'mirror' },
      },
      bottom: {
        label: 'Bottom',
        pelvis: { pos: [0, 0.981, 0.002], pitch: 28 },
        legs: { L: { hip: { flex: 26, abd: 2 }, knee: 70, ankle: -20 }, R: 'mirror' },
        arms: { L: { hand: [0.27, 1.095, 0.02], elbow: 'back', turn: 20 }, R: 'mirror' },
      },
    },
    seq: ['top', 'bottom'],
    tempo: [1.8, 1.1],
    holds: { top: 0.4, bottom: 0.2 },
  },
  dbSkullcrusher: {
    camera: { yaw: 70, pitch: 14 },
    props: [{ type: 'bench', pos: [0, 0, -0.26], size: [0.32, 0.42, 1.0] }, { type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['triceps'], secondary: ['shoulders', 'forearms', 'core'] },
    coaching: {
      setup: [
        'Lie on your back on a bench or the floor, feet flat.',
        'Hold the dumbbells above the shoulders with straight arms, palms facing each other.',
        'Tip the arms back slightly towards your head so the triceps stay loaded.',
      ],
      steps: [
        'Keep the upper arms still and bend the elbows to lower the dumbbells towards the forehead.',
        'Let the weights come down beside the head, just above the forehead.',
        'Straighten the elbows to press the weights back to the start.',
      ],
      cues: ['Elbows still', 'Lower to the forehead', 'Squeeze to straight arms'],
      mistakes: [
        'Letting the elbows flare out to the sides.',
        'Moving the upper arms so it turns into a press or a pullover.',
        'Lowering too fast and losing control near the face.',
        'Arching the lower back off the bench.',
      ],
      breathing: 'Breathe in as you lower, breathe out as you straighten the arms.',
      tempo: 'About 2 to 3 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        pelvis: { pos: [0, 0.56, 0.1], pitch: -90 },
        legs: { L: { foot: [0.24, 0.07, 0.56], knee: [0.3, 1, 0.3], toeOut: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.168, 1.067, -0.483], elbow: [-0.012, 0.293, -0.062] }, R: 'mirror' },
      },
      mid: {
        label: 'Lower',
        pass: true,
        pelvis: { pos: [0, 0.56, 0.1], pitch: -90 },
        legs: { L: { foot: [0.24, 0.07, 0.56], knee: [0.3, 1, 0.3], toeOut: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.173, 0.898, -0.655], elbow: [-0.012, 0.293, -0.062] }, R: 'mirror' },
      },
      bottom: {
        label: 'By the forehead',
        pelvis: { pos: [0, 0.56, 0.1], pitch: -90 },
        legs: { L: { foot: [0.24, 0.07, 0.56], knee: [0.3, 1, 0.3], toeOut: 10 }, R: 'mirror' },
        arms: { L: { hand: [0.182, 0.673, -0.623], elbow: [-0.012, 0.293, -0.062] }, R: 'mirror' },
      },
    },
    seq: ['top', 'mid', 'bottom', 'mid'],
    tempo: [1.2, 0.9, 0.6, 0.5],
    holds: { top: 0.4, bottom: 0.2, mid: 0 },
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
    flow: ['pass'],
    seq: ['rack', 'pass', 'lockout', 'pass'],
    tempo: [0.6, 0.6, 1.0, 0.9],
    holds: { lockout: 0.5, rack: 0.4, pass: 0 },
  },
  dbPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: {
      setup: [
        'Stand with feet hip-width and a dumbbell in each hand at shoulder height, palms facing forward.',
        'Elbows under the wrists, slightly in front of the body.',
        'Glutes squeezed and ribs pulled down.',
      ],
      steps: [
        'Brace the trunk.',
        'Press both dumbbells straight up, keeping the forearms vertical.',
        'Finish with the arms locked out beside the ears and the weights over the middle of the foot.',
        'Lower under control back to the shoulders.',
      ],
      cues: ['Press tall, ribs down', 'Forearms vertical', 'Arms by the ears'],
      mistakes: [
        'Leaning back and arching the lower back to finish the press.',
        'Letting the elbows drift behind the body at the bottom.',
        'Pressing the weights out wide instead of up.',
        'Stopping short of a full lockout.',
      ],
      breathing: 'Breathe in and brace at the bottom, breathe out as you press.',
      tempo: 'About 1 to 2 seconds up, a moment at the top, 2 seconds down.',
    },
    keys: {
      rack: {
        label: 'Shoulders',
        legs: STANCE,
        arms: { L: { hand: [0.33, 1.42, 0.08], elbow: [0.6, -1, 0.5], turn: -45 }, R: 'mirror' },
      },
      mid: {
        label: 'Press',
        pass: true,
        legs: STANCE,
        arms: { L: { hand: [0.35, 1.66, 0.05], elbow: [0.6, -1, 0.3], turn: -45 }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.21, 1.93, -0.01], elbow: [1, -0.3, 0], turn: 0 }, R: 'mirror' },
      },
    },
    flow: ['mid'],
    seq: ['rack', 'mid', 'top', 'mid'],
    tempo: [0.6, 0.6, 1.0, 1.0],
    holds: { top: 0.4, rack: 0.3, mid: 0 },
  },
  dbArnoldPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: {
      setup: [
        'Stand or sit tall with the dumbbells in front of the shoulders at chin height, palms facing you.',
        'Elbows in front of the body and close together.',
        'Glutes and abs switched on, ribs down.',
      ],
      steps: [
        'As you start to press, open the elbows out to the sides.',
        'Rotate the palms as the dumbbells rise, so they face forward by the time the arms pass the forehead.',
        'Lock the arms out beside the ears.',
        'Lower back down along the same path, turning the palms back towards you.',
      ],
      cues: ['Rotate the palms as you press', 'Open the elbows', 'Ribs down'],
      mistakes: [
        'Rotating the palms before pressing, then doing a normal press.',
        'Leaning back to get the weights up.',
        'Using weights so heavy the rotation turns into a swing.',
        'Rushing the lowering.',
      ],
      breathing: 'Breathe in at the bottom, breathe out as you press and turn.',
      tempo: 'About 2 seconds up, a moment at the top, 2 seconds down.',
    },
    keys: {
      start: {
        label: 'Palms to you',
        legs: STANCE,
        arms: { L: { hand: [0.19, 1.4, 0.15], elbow: [0.2, -1, 0.3], turn: 90 }, R: 'mirror' },
      },
      turn: {
        label: 'Open and turn',
        pass: true,
        legs: STANCE,
        arms: { L: { hand: [0.32, 1.52, 0.06], elbow: [1, -0.6, 0.2], turn: 45 }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.21, 1.93, -0.01], elbow: [1, -0.3, 0], turn: 0 }, R: 'mirror' },
      },
    },
    flow: ['turn'],
    seq: ['start', 'turn', 'top', 'turn'],
    tempo: [0.7, 0.8, 0.9, 1.0],
    holds: { top: 0.4, start: 0.3, turn: 0 },
  },
  dbPushPress: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders', 'triceps', 'quads'], secondary: ['glutes', 'core', 'upperBack', 'calves'] },
    coaching: {
      setup: [
        'Stand with feet hip-width, dumbbells at the shoulders with palms facing forward.',
        'Elbows under the wrists, weight across the whole foot.',
        'Trunk braced, ribs down.',
      ],
      steps: [
        'Dip by bending the knees a little, keeping the chest tall and the heels down.',
        'Drive straight back up through the legs, rising onto the toes as the legs straighten.',
        'Use that drive to press the dumbbells overhead to a full lockout beside the ears.',
        'Lower the weights to the shoulders, softening the knees to take the load.',
      ],
      cues: ['Dip the knees, drive overhead', 'Chest tall in the dip', 'Finish with straight arms'],
      mistakes: [
        'Dipping too deep, like a squat, which kills the drive.',
        'Tipping forward onto the toes during the dip.',
        'Pressing before the legs have finished driving.',
        'Arching the lower back at the top.',
      ],
      breathing: 'Breathe in and brace before the dip, breathe out as you drive up.',
      tempo: 'Quick dip and drive, a moment at the top, 1 to 2 seconds to lower.',
    },
    keys: {
      rack: {
        label: 'Shoulders',
        legs: STANCE,
        arms: { L: { hand: [0.32, 1.42, 0.08], elbow: [0.6, -1, 0.5], turn: -45 }, R: 'mirror' },
      },
      dip: {
        label: 'Dip',
        pelvis: { pos: [0, 0.83, -0.03] },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.32, 1.32, 0.05], elbow: [0.6, -1, 0.5], turn: -45 }, R: 'mirror' },
      },
      drive: {
        label: 'Drive',
        pass: true,
        pelvis: { pos: [0, 0.97, 0.01] },
        legs: { L: { foot: [0.12, 0.11, 0.01], toeOut: 8, heel: -18 }, R: 'mirror' },
        arms: { L: { hand: [0.34, 1.7, 0.05], elbow: [0.6, -1, 0.3], turn: -45 }, R: 'mirror' },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: { hand: [0.21, 1.93, -0.01], elbow: [1, -0.3, 0], turn: 0 }, R: 'mirror' },
      },
      lower: {
        label: 'Lower',
        pass: true,
        legs: STANCE,
        arms: { L: { hand: [0.35, 1.66, 0.05], elbow: [0.6, -1, 0.3], turn: -45 }, R: 'mirror' },
      },
      catch: {
        label: 'Soft knees',
        pass: true,
        pelvis: { pos: [0, 0.9, -0.01] },
        legs: { L: { foot: [0.12, 0.07, 0], toeOut: 8, knee: [0.15, 0, 1] }, R: 'mirror' },
        arms: { L: { hand: [0.32, 1.39, 0.07], elbow: [0.6, -1, 0.5], turn: -45 }, R: 'mirror' },
      },
    },
    flow: ['drive', 'lower'],
    seq: ['rack', 'dip', 'drive', 'top', 'lower', 'catch'],
    tempo: [0.55, 0.3, 0.3, 0.8, 0.6, 0.5],
    holds: { dip: 0, drive: 0, top: 0.4, lower: 0, catch: 0, rack: 0.4 },
  },
  dbFrontRaise: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders'], secondary: ['upperBack', 'core', 'chest'] },
    coaching: {
      setup: [
        'Stand tall with a dumbbell in each hand in front of the thighs, palms facing you.',
        'Elbows softly bent, shoulders down away from the ears.',
        'Feet hip-width, knees soft, abs switched on.',
      ],
      steps: [
        'Raise the dumbbells forward and up with straight arms (soft elbows).',
        'Stop when the hands are at about eye height.',
        'Pause briefly, then lower slowly back to the thighs.',
      ],
      cues: ['To eye height', 'No swinging', 'Shoulders down'],
      mistakes: [
        'Swinging the body or leaning back to get the weight up.',
        'Shrugging the shoulders up towards the ears.',
        'Going too heavy, which turns the lift into a heave.',
        'Dropping the weights on the way down.',
      ],
      breathing: 'Breathe out as you raise, breathe in as you lower.',
      tempo: 'About 1 to 2 seconds up, a brief pause, 2 to 3 seconds down.',
    },
    keys: {
      down: {
        label: 'Arms down',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 8, plane: 10 }, elbow: 10, turn: -90 }, R: 'mirror' },
      },
      top: {
        label: 'Eye height',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 102, plane: 10 }, elbow: 8, turn: -90 }, R: 'mirror' },
      },
    },
    seq: ['down', 'top'],
    tempo: [1.3, 2.0],
    holds: { top: 0.4, down: 0.3 },
  },
  lateralRaise: {
    camera: { yaw: 20, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }, { type: 'dumbbell', hand: 'R' }],
    muscles: { primary: ['shoulders'], secondary: ['traps', 'upperBack'] },
    coaching: {
      setup: [
        'Stand tall with a dumbbell in each hand by your sides, palms facing in.',
        'Elbows softly bent, shoulders down away from the ears.',
        'Feet hip-width and a slight lean forward from the hips is fine.',
      ],
      steps: [
        'Raise the arms out to the sides, leading with the elbows.',
        'Keep the hands slightly lower than the elbows, palms facing the floor at the top.',
        'Stop at shoulder height.',
        'Lower slowly back to your sides.',
      ],
      cues: ['Elbows lead', 'Stop at shoulder height', 'Shoulders down'],
      mistakes: [
        'Shrugging the weight up with the upper traps.',
        'Swinging the body to get the dumbbells moving.',
        'Lifting the hands higher than the elbows.',
        'Going above shoulder height, which pinches the shoulder.',
      ],
      breathing: 'Breathe out as you raise, breathe in as you lower.',
      tempo: 'About 1 to 2 seconds up, a brief pause, 2 to 3 seconds down.',
    },
    keys: {
      down: {
        label: 'Arms down',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 10, plane: 75, twist: 180 }, elbow: 15, turn: 90 }, R: 'mirror' },
      },
      top: {
        label: 'Shoulder height',
        legs: STANCE,
        arms: { L: { shoulder: { elev: 88, plane: 75, twist: 180 }, elbow: 15, turn: 90 }, R: 'mirror' },
      },
    },
    seq: ['down', 'top'],
    tempo: [1.2, 2.0],
    holds: { top: 0.4, down: 0.3 },
  },
  dbOverheadTricep: {
    camera: { yaw: 60, pitch: 6 },
    props: [{ type: 'dumbbell', hand: 'L' }],
    muscles: { primary: ['triceps'], secondary: ['shoulders', 'core'] },
    coaching: {
      setup: [
        'Stand tall and hold one dumbbell overhead with both hands, arms straight.',
        'Elbows close to the ears, pointing up and slightly forward.',
        "Glutes and abs switched on so the lower back doesn't arch.",
      ],
      steps: [
        'Keep the upper arms still and bend the elbows to lower the dumbbell behind the head.',
        'Lower until the elbows are bent to about 90 degrees or a little more.',
        'Straighten the arms to press the dumbbell back overhead.',
      ],
      cues: ['One dumbbell, elbows by the ears', 'Upper arms still', 'Ribs down'],
      mistakes: [
        'Elbows flaring wide, which takes the load off the triceps.',
        'Arching the lower back as the weight goes behind the head.',
        'Moving the upper arms forward and back instead of hinging at the elbow.',
        'Lowering fast and hitting the head or neck.',
      ],
      breathing: 'Breathe in as you lower, breathe out as you straighten the arms.',
      tempo: 'About 2 to 3 seconds down, 1 second up.',
    },
    keys: {
      top: {
        label: 'Arms straight',
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.894, 0.058], elbow: [-0.05, 0.29, 0.06] }, R: { hand: [-0.025, 1.894, 0.058], elbow: [0.05, 0.29, 0.06] } },
      },
      mid: {
        label: 'Lower',
        pass: true,
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.685, -0.204], elbow: [-0.05, 0.29, 0.06], turn: -90 }, R: { hand: [-0.025, 1.685, -0.204], elbow: [0.05, 0.29, 0.06], turn: -90 } },
      },
      bottom: {
        label: 'Behind the head',
        legs: STANCE,
        arms: { L: { hand: [0.025, 1.517, -0.151], elbow: [-0.05, 0.29, 0.06], turn: -125 }, R: { hand: [-0.025, 1.517, -0.151], elbow: [0.05, 0.29, 0.06], turn: -125 } },
      },
    },
    flow: ['mid'],
    seq: ['top', 'mid', 'bottom', 'mid'],
    tempo: [1.2, 0.8, 0.6, 0.6],
    holds: { top: 0.4, bottom: 0.2, mid: 0 },
  },
  kbPressSingle: {
    camera: { yaw: 40, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R', grip: 'rack' }],
    muscles: { primary: ['shoulders', 'triceps'], secondary: ['core', 'obliques', 'upperBack', 'glutes'] },
    coaching: {
      setup: [
        'Clean the bell to the rack: handle in the palm, bell on the back of the forearm, fist near the collarbone.',
        'Elbow tucked in against the ribs, wrist straight.',
        'Feet hip-width, glutes squeezed and ribs pulled down.',
      ],
      steps: [
        'Brace the trunk and squeeze the free hand into a fist.',
        'Press the bell up, letting the elbow move slightly out to the side as the forearm stays vertical.',
        'Finish with the arm locked out beside the ear and the bell resting on the back of the forearm.',
        'Lower slowly back to the rack, pulling the elbow down into place.',
      ],
      cues: ['Ribs down, press tall', 'Forearm vertical', 'Squeeze the glutes'],
      mistakes: [
        'Leaning back or to the side to finish the rep.',
        'Pressing the bell out in front of the face instead of straight up.',
        'Bending the wrist back so the bell drags on the joint.',
        'Letting the shoulder shrug up at the start instead of setting it first.',
      ],
      breathing: 'Breathe in and brace in the rack, breathe out as you press.',
      tempo: 'About 1 to 2 seconds up, a moment at the top, 2 seconds down.',
    },
    keys: {
      rack: {
        label: 'Rack',
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.11, 1.37, 0.13], elbow: [-0.4, -1, 0.3] } },
      },
      mid: {
        label: 'Press',
        pass: true,
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.36, 1.6, 0.05], elbow: [-0.4, -1, 0.3] } },
      },
      top: {
        label: 'Lockout',
        legs: STANCE,
        arms: { L: ARM_DOWN, R: { hand: [-0.2, 1.925, -0.01], elbow: [-1, -0.3, 0] } },
      },
    },
    flow: ['mid'],
    seq: ['rack', 'mid', 'top', 'mid'],
    tempo: [0.6, 0.6, 1.0, 0.9],
    holds: { top: 0.5, rack: 0.4, mid: 0 },
  },
  kbCleanPress: {
    camera: { yaw: 50, pitch: 6 },
    props: [{ type: 'kettlebell', hand: 'R', grip: 'auto' }],
    muscles: { primary: ['shoulders', 'glutes', 'hamstrings'], secondary: ['triceps', 'core', 'upperBack', 'forearms'] },
    coaching: {
      setup: [
        'Kettlebell on the floor between the feet, feet about hip-width or a little wider.',
        'Hinge at the hips with a flat back and grip the handle with one hand.',
        'Shoulders over the bell, free arm relaxed by your side.',
      ],
      steps: [
        'Drive the floor away and snap the hips forward, keeping the bell close to the body.',
        'Let the elbow bend and guide the bell round the hand into the rack: bell on the back of the forearm, fist by the collarbone, elbow tucked in.',
        'Brace, squeeze the glutes and press the bell straight up until the arm is locked out by the ear.',
        'Lower under control to the rack, then let the bell swing down and hinge to put it back on the floor.',
      ],
      cues: ['One motion, floor to overhead', 'Keep the bell close', 'Ribs down at the top'],
      mistakes: [
        'Swinging the bell out in a wide arc so it crashes onto the forearm.',
        'Rounding the back to pick the bell up instead of hinging at the hips.',
        'Leaning back to finish the press instead of keeping the ribs down.',
        'Letting the wrist bend back under the bell: keep it straight.',
      ],
      breathing: 'Breathe in at the bottom, breathe out as the hips snap, breathe in again in the rack, out as you press.',
      tempo: 'Clean in about 1 second, a pause in the rack, 1 to 2 seconds to press, 2 seconds to lower.',
    },
    keys: {
      floor: {
        label: 'Grip',
        pelvis: { pos: [0, 0.62, -0.31], pitch: 60 },
        spine: { flex: 3 }, neck: { flex: -22 },
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: { shoulder: { elev: 58, plane: 12 }, elbow: 12 }, R: { hand: [-0.03, 0.31, 0.12], elbow: 'back' } },
      },
      pull: {
        label: 'Hips snap',
        pelvis: { pos: [0, 0.91, -0.03], pitch: 6 },
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12, knee: [0.3, 0, 1] }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.14, 1.05, 0.14], elbow: [-0.7, 0.3, -0.5] } },
      },
      rack: {
        label: 'Rack',
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.11, 1.37, 0.13], elbow: [-0.4, -1, 0.3] } },
      },
      mid: {
        label: 'Press',
        pass: true,
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.36, 1.6, 0.05], elbow: [-0.4, -1, 0.3] } },
      },
      top: {
        label: 'Lockout',
        legs: { L: { foot: [0.17, 0.07, 0], toeOut: 12 }, R: 'mirror' },
        arms: { L: ARM_DOWN, R: { hand: [-0.18, 1.92, -0.01], elbow: 'back' } },
      },
    },
    flow: ['pull', 'mid'],
    seq: ['floor', 'pull', 'rack', 'mid', 'top', 'mid', 'rack', 'pull'],
    tempo: [0.5, 0.35, 0.6, 0.6, 0.9, 0.8, 0.5, 0.6],
    holds: { floor: 0.4, pull: 0, rack: 0.3, mid: 0, top: 0.5 },
  },
  kbHalo: {
    camera: { yaw: 30, pitch: 8 },
    props: [{ type: 'kettlebell', hand: 'both' }],
    muscles: { primary: ['shoulders'], secondary: ['core', 'obliques', 'upperBack', 'triceps'] },
    coaching: {
      setup: [
        'Hold the kettlebell upside down by the horns, bell above the hands, at chest height.',
        'Feet hip-width, knees soft, glutes and abs switched on.',
        'Ribs pulled down so the lower back stays neutral.',
      ],
      steps: [
        'Move the bell round one side of the head, close to the ear.',
        'Carry it behind the head with the elbows pointing up and forward, bell behind the neck.',
        'Bring it round the other side and back to the front at chest height.',
        'Change direction each rep or each set.',
      ],
      cues: ['Circle the head', 'Ribs locked', 'Keep it close'],
      mistakes: [
        'Arching the lower back or leaning the body instead of moving the arms.',
        'Making the circle so wide that the bell pulls you off balance.',
        'Dropping the head forward to make room instead of keeping it tall.',
        'Rushing: slow circles make the shoulders work harder.',
      ],
      breathing: 'Breathe steadily, a breath in as the bell goes round, out as it comes back to the front.',
      tempo: 'About 3 to 4 seconds per circle.',
    },
    keys: {
h0: { label: 'In front', legs: STANCE, arms: { L: { hand: [0.05, 1.36, 0.25], elbow: [-0.081, -0.238, 0.164] }, R: { hand: [-0.05, 1.36, 0.25], elbow: [-0.095, -0.123, 0.257] } } },
      h30: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [-0.083, 1.434, 0.244], elbow: [-0.071, -0.104, 0.272] }, R: { hand: [-0.17, 1.434, 0.194], elbow: [-0.199, -0.08, 0.21] } } },
      h60: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [-0.198, 1.485, 0.172], elbow: [-0.138, 0.061, 0.259] }, R: { hand: [-0.248, 1.485, 0.085], elbow: [-0.229, -0.076, 0.178] } } },
      h90: { label: 'Right side', pass: true, legs: STANCE, arms: { L: { hand: [-0.26, 1.5, 0.05], elbow: [-0.211, 0.106, 0.185] }, R: { hand: [-0.26, 1.5, -0.05], elbow: [-0.291, 0.018, 0.071] } } },
      h120: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [-0.195, 1.493, -0.084], elbow: [-0.279, -0.11, 0.015] }, R: { hand: [-0.245, 1.493, -0.17], elbow: [-0.26, 0.149, 0.022] } } },
      h150: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [-0.073, 1.486, -0.176], elbow: [-0.231, -0.147, -0.124] }, R: { hand: [-0.159, 1.486, -0.226], elbow: [-0.062, 0.292, -0.029] } } },
      h180: { label: 'Behind', pass: true, legs: STANCE, arms: { L: { hand: [0.05, 1.48, -0.2], elbow: [0.02, 0.29, -0.076] }, R: { hand: [-0.05, 1.48, -0.2], elbow: [-0.059, 0.267, -0.123] } } },
      h210: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [0.159, 1.486, -0.226], elbow: [0.062, 0.292, -0.029] }, R: { hand: [0.073, 1.486, -0.176], elbow: [0.256, -0.139, -0.07] } } },
      h240: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [0.245, 1.493, -0.17], elbow: [0.26, 0.149, 0.022] }, R: { hand: [0.195, 1.493, -0.084], elbow: [0.279, -0.11, 0.015] } } },
      h270: { label: 'Left side', pass: true, legs: STANCE, arms: { L: { hand: [0.26, 1.5, -0.05], elbow: [0.291, 0.018, 0.071] }, R: { hand: [0.26, 1.5, 0.05], elbow: [0.211, 0.106, 0.185] } } },
      h300: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [0.248, 1.485, 0.085], elbow: [-0.005, -0.076, 0.29] }, R: { hand: [0.198, 1.485, 0.172], elbow: [0.138, 0.061, 0.259] } } },
      h330: { label: 'Round', pass: true, legs: STANCE, arms: { L: { hand: [0.17, 1.434, 0.194], elbow: [-0.084, -0.193, 0.214] }, R: { hand: [0.083, 1.434, 0.244], elbow: [0.071, -0.104, 0.272] } } },
    },
    flow: ['h30', 'h60', 'h90', 'h120', 'h150', 'h180', 'h210', 'h240', 'h270', 'h300', 'h330'],
    seq: ['h0', 'h30', 'h60', 'h90', 'h120', 'h150', 'h180', 'h210', 'h240', 'h270', 'h300', 'h330'],
    tempo: 0.3,
    holds: { h0: 0.3, h30: 0, h60: 0, h90: 0, h120: 0, h150: 0, h180: 0, h210: 0, h240: 0, h270: 0, h300: 0, h330: 0 },
  },
};
