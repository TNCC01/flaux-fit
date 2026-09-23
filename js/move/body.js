/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  THE 3D BODY
  ===========
  A mannequin with adult proportions (1.75 m, segment lengths from standard
  anthropometric tables) and a pose engine that reads the movement data in
  js/moves/. Shared by the viewer (move.html) and the checker
  (scripts/move-check.mjs), so what gets checked is what gets shown.

  World: metres, Y up, the figure faces +Z, +X is the figure's LEFT.
  The floor is y = 0.

  A key pose is a plain object; every field is optional:

    pelvis: { pos: [x, y, z], pitch, yaw, roll }
            pos is the hip-joint centre (standing: [0, 0.93, 0]).
            pitch + tips the body forward (a hip hinge; 90 = lying face
            down), yaw + turns to the figure's left, roll + lifts the left
            hip. y may be 'auto' to drop the body until its lowest point
            touches the floor.
    spine:  { flex, side, twist }  flex + bends forward, - arches back;
            side + bends to the left; twist + turns the chest left.
            Shared 40 / 60 between the lower and upper back.
    neck:   { flex, side, twist }  same sense, for the head.
    legs:   { L: leg, R: leg }  (R: 'mirror' copies L across the midline)
    arms:   { L: arm, R: arm }

    leg, by target (IK):  { foot: [x, y, z], knee: 'fwd' | 'out' | [dx,dy,dz],
                            toeOut: deg, heel: deg }
            foot is the ankle joint in world metres. A foot flat on the
            floor has its ankle at y = 0.07. heel lifts the heel with the
            ball of the foot planted (a calf raise), toeOut turns the foot
            out. knee is the way the kneecap points.
    leg, by angles (FK):  { hip: { flex, abd, rot }, knee, ankle }
            hip flex + lifts the thigh forward; abd + moves it out to its
            own side; rot + turns the knee out. knee + bends. ankle +
            points the toes up (dorsiflexion), - points them down.

    arm, by target (IK):  { hand: [x, y, z], elbow: 'back' | 'out' | ...,
                            palm: 'floor' }
            hand is the wrist joint in world metres. elbow is the way the
            point of the elbow faces. palm: 'floor' lays the hand flat on
            the floor, fingers forward.
    arm, by angles (FK):  { shoulder: { elev, plane, twist }, elbow, wrist }
            elev is how far the arm is raised from hanging (0) through
            level (90) to overhead (180). plane is the direction it is
            raised in: 0 straight forward, 90 out to the side, 180 behind.
            twist turns the arm about its own length. elbow + bends.

  Direction words for knee / elbow hints are world directions: 'fwd' +Z,
  'back' -Z, 'up', 'down', 'out' (the limb's own side), 'in'.
*/
import * as THREE from '../../vendor/three/three.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;

// ---------------------------------------------------------- proportions
// Segment lengths for a 1.75 m adult (Drillis & Contini / Winter ratios).
export const DIM = {
  hipHalf: 0.09,        // hip joint centres either side of the midline
  thigh: 0.43,
  shin: 0.43,
  ankle: 0.07,          // ankle joint above the sole
  footFront: 0.19,      // ankle to toe tip
  footBack: 0.055,      // ankle to back of the heel
  lumbar: 0.10,
  thorax: 0.23,         // lower back joint to shoulder line
  neck: 0.27,           // thorax joint to the base of the skull
  shoulderHalf: 0.19,
  upperArm: 0.30,
  forearm: 0.26,
  hand: 0.18,
  headR: 0.105,
};
export const STAND_HIP = DIM.thigh + DIM.shin + DIM.ankle;     // 0.93

// ---------------------------------------------------------- skeleton
function joint(name, parent, x, y, z) {
  const o = new THREE.Bone();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

export function buildSkeleton() {
  const root = new THREE.Object3D();
  const pelvis = joint('pelvis', root, 0, STAND_HIP, 0);
  const lumbar = joint('lumbar', pelvis, 0, 0.09, -0.015);
  const thorax = joint('thorax', lumbar, 0, DIM.lumbar + 0.04, 0);
  const neck = joint('neck', thorax, 0, 0.255, -0.01);
  const head = joint('head', neck, 0, 0.075, 0.015);
  const J = { root, pelvis, lumbar, thorax, neck, head };
  for (const s of ['L', 'R']) {
    const x = s === 'L' ? 1 : -1;
    J['shoulder' + s] = joint('shoulder' + s, thorax, x * DIM.shoulderHalf, 0.215, -0.02);
    J['elbow' + s] = joint('elbow' + s, J['shoulder' + s], 0, -DIM.upperArm, 0);
    J['wrist' + s] = joint('wrist' + s, J['elbow' + s], 0, -DIM.forearm, 0);
    J['hip' + s] = joint('hip' + s, pelvis, x * DIM.hipHalf, 0, 0);
    J['knee' + s] = joint('knee' + s, J['hip' + s], 0, -DIM.thigh, 0);
    J['ankle' + s] = joint('ankle' + s, J['knee' + s], 0, -DIM.shin, 0);
  }
  return J;
}

// ---------------------------------------------------------- rotations
const qx = (deg) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), deg * D2R);
const qy = (deg) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), deg * D2R);
const qz = (deg) => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), deg * D2R);
const mul = (...qs) => qs.reduce((a, b) => a.multiply(b), new THREE.Quaternion());

const hipQ = (h, side) => mul(qx(-(h.flex || 0)), qz((h.abd || 0) * side), qy((h.rot || 0) * side));
const shoulderQ = (s, side) => mul(qy((s.plane || 0) * side), qx(-(s.elev || 0)), qy((s.twist || 0) * side));
const trunkQ = (a = {}, share = 1) =>
  mul(qy((a.twist || 0) * share), qx((a.flex || 0) * share), qz(-(a.side || 0) * share));
const pelvisQ = (p = {}) => mul(qy(p.yaw || 0), qx(p.pitch || 0), qz(-(p.roll || 0)));

const WORLD_DIR = {
  fwd: V(0, 0, 1), back: V(0, 0, -1), up: V(0, 1, 0), down: V(0, -1, 0),
  left: V(1, 0, 0), right: V(-1, 0, 0),
};
function hintDir(h, side, fallback) {
  if (Array.isArray(h)) return V(...h).normalize();
  if (h === 'out') return V(side, 0, 0);
  if (h === 'in') return V(-side, 0, 0);
  return (WORLD_DIR[h] || fallback).clone();
}

// A world-space basis -> the joint's local quaternion under its parent.
function localFromWorld(obj, xAxis, yAxis, zAxis) {
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const qw = new THREE.Quaternion().setFromRotationMatrix(m);
  const qp = new THREE.Quaternion();
  obj.parent.getWorldQuaternion(qp);
  return qp.invert().multiply(qw);
}

// Two-bone IK in world space. `bendSign` is +1 when the middle joint's
// apex faces along the hint (knee: kneecap), -1 when the limb folds
// towards the hint side of the frame (elbow flexes forward, so its point
// faces the hint and the forearm swings away from it).
function solveTwoBone(a, b, c, rootPos, target, pole, L1, L2, kneeLike) {
  const toT = target.clone().sub(rootPos);
  let d = toT.length();
  const reach = L1 + L2;
  const miss = Math.max(0, d - reach);
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), reach - 1e-4);
  const dir = toT.normalize();
  // the pole with the reach direction removed
  let p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p = V(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  p.normalize();
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const mid = rootPos.clone().add(dir.clone().multiplyScalar(cosA * L1)).add(p.clone().multiplyScalar(sinA * L1));
  const end = rootPos.clone().add(dir.clone().multiplyScalar(d));
  // upper segment: local -Y runs root -> mid; local Z faces the apex for a
  // knee (it flexes with +X, swinging the shin to -Z), away for an elbow
  const y1 = rootPos.clone().sub(mid).normalize();
  let z1 = p.clone().sub(y1.clone().multiplyScalar(p.dot(y1))).normalize();
  if (!kneeLike) z1.negate();
  const x1 = new THREE.Vector3().crossVectors(y1, z1).normalize();
  a.quaternion.copy(localFromWorld(a, x1, y1, z1));
  a.updateMatrixWorld(true);
  const y2 = mid.clone().sub(end).normalize();
  const ang = Math.acos(Math.min(1, Math.max(-1, y1.dot(y2)))) / D2R;
  b.quaternion.copy(kneeLike ? qx(ang) : qx(-ang));
  b.updateMatrixWorld(true);
  return miss;
}

// ---------------------------------------------------------- the pose
const mirrorVec = (v) => [-v[0], v[1], v[2]];
function sidePart(group, s) {
  if (!group) return null;
  const v = group[s];
  if (v === 'mirror') {
    const o = group[s === 'L' ? 'R' : 'L'];
    if (!o || o === 'mirror') return null;
    const m = { ...o };
    if (o.foot) m.foot = mirrorVec(o.foot);
    if (o.hand) m.hand = mirrorVec(o.hand);
    if (Array.isArray(o.knee)) m.knee = mirrorVec(o.knee);
    if (Array.isArray(o.elbow)) m.elbow = mirrorVec(o.elbow);
    return m;
  }
  return v || null;
}

/*
  Normalise a key pose into a state that can be applied and blended:
  numbers for the trunk, and per limb either an IK target or FK angles.
*/
export function normalise(k) {
  const st = {
    pelvis: { pos: (k.pelvis && k.pelvis.pos) || [0, STAND_HIP, 0],
              pitch: 0, yaw: 0, roll: 0, ...(k.pelvis || {}) },
    spine: { flex: 0, side: 0, twist: 0, ...(k.spine || {}) },
    neck: { flex: 0, side: 0, twist: 0, ...(k.neck || {}) },
    legs: {}, arms: {},
  };
  for (const s of ['L', 'R']) {
    const side = s === 'L' ? 1 : -1;
    const lg = sidePart(k.legs, s) || { foot: [side * 0.1, DIM.ankle, 0.0] };
    st.legs[s] = lg.foot
      ? { ik: true, foot: lg.foot.slice(), knee: lg.knee || 'fwd', toeOut: lg.toeOut ?? 8,
          heel: lg.heel || 0, ankle: lg.ankle }
      : { ik: false, hip: { flex: 0, abd: 0, rot: 0, ...(lg.hip || {}) },
          knee: lg.knee || 0, ankle: lg.ankle || 0 };
    const am = sidePart(k.arms, s) || { shoulder: { elev: 4, plane: 90 }, elbow: 8 };
    st.arms[s] = am.hand
      ? { ik: true, hand: am.hand.slice(), elbow: am.elbow || 'back', palm: am.palm || null,
          wrist: am.wrist || 0 }
      : { ik: false, shoulder: { elev: 0, plane: 0, twist: 0, ...(am.shoulder || {}) },
          elbow: am.elbow || 0, wrist: am.wrist || 0, palm: am.palm || null };
  }
  return st;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function lerpObj(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k] ?? a[k], t) : a[k];
  return o;
}

// Apply a normalised state to the skeleton. `limbQ` optionally carries
// pre-solved local quaternions (for FK <-> IK blends).
export function applyState(J, st, limbQ) {
  const P = st.pelvis;
  J.pelvis.position.set(P.pos[0], typeof P.pos[1] === 'number' ? P.pos[1] : STAND_HIP, P.pos[2]);
  J.pelvis.quaternion.copy(pelvisQ(P));
  J.lumbar.quaternion.copy(trunkQ(st.spine, 0.4));
  J.thorax.quaternion.copy(trunkQ(st.spine, 0.6));
  J.neck.quaternion.copy(trunkQ(st.neck, 0.6));
  J.head.quaternion.copy(trunkQ(st.neck, 0.4));
  J.root.updateMatrixWorld(true);
  const misses = [];
  for (const s of ['L', 'R']) {
    const side = s === 'L' ? 1 : -1;
    const hip = J['hip' + s], knee = J['knee' + s], ankle = J['ankle' + s];
    const lg = st.legs[s];
    if (limbQ && limbQ['leg' + s]) {
      const q = limbQ['leg' + s];
      hip.quaternion.copy(q[0]); knee.quaternion.copy(q[1]); ankle.quaternion.copy(q[2]);
      J.root.updateMatrixWorld(true);
    } else if (lg.ik) {
      const root = hip.getWorldPosition(V(0, 0, 0));
      const pole = hintDir(lg.knee, side, V(0, 0, 1));
      const miss = solveTwoBone(hip, knee, ankle, root, V(...lg.foot), pole, DIM.thigh, DIM.shin, true);
      if (miss > 0.02) misses.push(`${s} foot out of reach by ${(miss * 100).toFixed(0)} cm`);
      footOrient(J, s, lg);
    } else {
      hip.quaternion.copy(hipQ(lg.hip, side));
      knee.quaternion.copy(qx(lg.knee));
      ankle.quaternion.copy(qx(-lg.ankle));
      J.root.updateMatrixWorld(true);
    }
    const sh = J['shoulder' + s], el = J['elbow' + s], wr = J['wrist' + s];
    const am = st.arms[s];
    if (limbQ && limbQ['arm' + s]) {
      const q = limbQ['arm' + s];
      sh.quaternion.copy(q[0]); el.quaternion.copy(q[1]); wr.quaternion.copy(q[2]);
      J.root.updateMatrixWorld(true);
    } else if (am.ik) {
      const root = sh.getWorldPosition(V(0, 0, 0));
      const pole = hintDir(am.elbow, side, V(0, 0, -1));
      const miss = solveTwoBone(sh, el, wr, root, V(...am.hand), pole, DIM.upperArm, DIM.forearm, false);
      if (miss > 0.02) misses.push(`${s} hand out of reach by ${(miss * 100).toFixed(0)} cm`);
      handOrient(J, s, am);
    } else {
      sh.quaternion.copy(shoulderQ(am.shoulder, side));
      el.quaternion.copy(qx(-am.elbow));
      wr.quaternion.copy(qx(-am.wrist));
      J.root.updateMatrixWorld(true);
      if (am.palm) handOrient(J, s, am);
    }
  }
  if (P.pos[1] === 'auto') dropToFloor(J);
  J.root.updateMatrixWorld(true);
  return misses;
}

// Feet: flat on the floor (with the toe-out and any heel lift) when the
// ankle is low, otherwise following the shin with the given ankle angle.
function footOrient(J, s, lg) {
  const side = s === 'L' ? 1 : -1;
  const ankle = J['ankle' + s];
  const ap = ankle.getWorldPosition(V(0, 0, 0));
  const pelvisFwd = V(0, 0, 1).applyQuaternion(J.pelvis.getWorldQuaternion(new THREE.Quaternion()));
  pelvisFwd.y = 0;
  if (pelvisFwd.lengthSq() < 1e-4) pelvisFwd.set(0, 0, 1);
  pelvisFwd.normalize();
  const yaw = Math.atan2(pelvisFwd.x, pelvisFwd.z) / D2R + (lg.toeOut || 0) * side;
  const grounded = ap.y < DIM.ankle + 0.03 || lg.heel;
  if (grounded && lg.ankle === undefined) {
    // flat: the foot's own frame is level, turned by yaw, heel lifted
    const qw = mul(qy(yaw), qx(-(lg.heel || 0)));
    const qp = new THREE.Quaternion();
    ankle.parent.getWorldQuaternion(qp);
    ankle.quaternion.copy(qp.invert().multiply(qw));
  } else {
    ankle.quaternion.copy(qx(-(lg.ankle ?? -25)));
    ankle.updateMatrixWorld(true);
    // a rigid foot can't bend its toes, so tip it at the ankle until the
    // toes rest on the floor instead of going through it (push-ups, planks)
    const toe = () => ankle.localToWorld(V(0, -DIM.ankle + 0.02, DIM.footFront)).y;
    if (toe() < 0.01) {
      const base = ankle.quaternion.clone();
      let best = null;
      for (let a = 2; a <= 80 && !best; a += 2) {
        for (const dir of [1, -1]) {
          ankle.quaternion.copy(base).multiply(qx(dir * a));
          ankle.updateMatrixWorld(true);
          if (toe() >= 0.01) { best = ankle.quaternion.clone(); break; }
        }
      }
      ankle.quaternion.copy(best || base);
    }
  }
  ankle.updateMatrixWorld(true);
}

// Hands: flat on the floor, fingers forward, or continuing the forearm.
function handOrient(J, s, am) {
  const wr = J['wrist' + s];
  const side = s === 'L' ? 1 : -1;
  if (am.palm === 'floor') {
    const pelvisFwd = V(0, 0, 1).applyQuaternion(J.pelvis.getWorldQuaternion(new THREE.Quaternion()));
    pelvisFwd.y = 0;
    if (pelvisFwd.lengthSq() < 1e-4) pelvisFwd.set(0, 0, 1);
    pelvisFwd.normalize();
    // hand local -Y (towards the fingers) -> forward; palm (-X on the left
    // hand, +X on the right) -> down
    const yAxis = pelvisFwd.clone().negate();
    const xAxis = V(0, side, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    wr.quaternion.copy(localFromWorld(wr, xAxis, yAxis, zAxis));
  } else {
    wr.quaternion.copy(qx(-(am.wrist || 0)));
  }
  wr.updateMatrixWorld(true);
}

// Sample points on the body surface, for floor contact and checks.
export function bodyPoints(J) {
  const pts = [];
  const add = (obj, local) => pts.push(obj.localToWorld(V(...local)));
  for (const s of ['L', 'R']) {
    add(J['ankle' + s], [0, -DIM.ankle, DIM.footFront]);
    add(J['ankle' + s], [0, -DIM.ankle, -DIM.footBack]);
    add(J['knee' + s], [0, 0, 0.05]);
    add(J['wrist' + s], [0, -DIM.hand * 0.8, 0]);
    add(J['elbow' + s], [0, 0, -0.04]);
    add(J['shoulder' + s], [0, 0, 0]);
  }
  add(J.pelvis, [0, -0.08, -0.1]);           // seat
  add(J.pelvis, [0, 0, 0.1]);                 // front of hips
  add(J.thorax, [0, 0.12, -0.12]);            // upper back
  add(J.thorax, [0, 0.12, 0.12]);             // chest
  add(J.head, [0, 0.1, 0]);
  add(J.head, [0, 0.1, 0.1]);
  add(J.head, [0, 0.1, -0.1]);
  return pts;
}

function dropToFloor(J) {
  J.root.updateMatrixWorld(true);
  const minY = Math.min(...bodyPoints(J).map(p => p.y));
  J.pelvis.position.y -= minY;
  J.root.updateMatrixWorld(true);
}

// Local quaternions of every limb joint, for FK <-> IK blending.
export function limbQuats(J) {
  const out = {};
  for (const s of ['L', 'R']) {
    out['leg' + s] = ['hip', 'knee', 'ankle'].map(n => J[n + s].quaternion.clone());
    out['arm' + s] = ['shoulder', 'elbow', 'wrist'].map(n => J[n + s].quaternion.clone());
  }
  return out;
}

/*
  Blend two normalised states. Limbs that are IK at both ends blend their
  targets (feet stay planted if the targets match); any other pairing
  blends the solved joint rotations.
*/
export function blendState(J, a, b, t) {
  const st = {
    pelvis: { ...lerpObj(a.pelvis, b.pelvis, t) },
    spine: lerpObj(a.spine, b.spine, t),
    neck: lerpObj(a.neck, b.neck, t),
    legs: {}, arms: {},
  };
  const pa = a.pelvis.pos, pb = b.pelvis.pos;
  const autoY = pa[1] === 'auto' || pb[1] === 'auto';
  st.pelvis.pos = autoY ? [lerp(pa[0], pb[0], t), 'auto', lerp(pa[2], pb[2], t)] : lerpArr(pa, pb, t);
  let limbQ = null;
  for (const s of ['L', 'R']) {
    for (const [grp, key, tgt] of [['legs', 'leg', 'foot'], ['arms', 'arm', 'hand']]) {
      const la = a[grp][s], lb = b[grp][s];
      if (la.ik && lb.ik) {
        const out = { ...la, [tgt]: lerpArr(la[tgt], lb[tgt], t) };
        const ha = hintVec(la, grp, s), hb = hintVec(lb, grp, s);
        out[grp === 'legs' ? 'knee' : 'elbow'] = ha.lerp(hb, t).toArray();
        if (grp === 'legs') {
          out.toeOut = lerp(la.toeOut, lb.toeOut, t);
          out.heel = lerp(la.heel || 0, lb.heel || 0, t);
          if (la.ankle !== undefined || lb.ankle !== undefined)
            out.ankle = lerp(la.ankle ?? 0, lb.ankle ?? 0, t);
        } else {
          out.wrist = lerp(la.wrist || 0, lb.wrist || 0, t);
        }
        if (la.palm !== lb.palm) out.palm = t < 0.5 ? la.palm : lb.palm;
        st[grp][s] = out;
      } else {
        limbQ = limbQ || {};
        const qa = solvedQuats(J, a)[key + s], qb = solvedQuats(J, b)[key + s];
        limbQ[key + s] = qa.map((q, i) => q.clone().slerp(qb[i], t));
        st[grp][s] = la.ik ? lb : la;
      }
    }
  }
  return { st, limbQ };
}

function hintVec(l, grp, s) {
  const side = s === 'L' ? 1 : -1;
  const h = grp === 'legs' ? l.knee : l.elbow;
  return hintDir(h, side, grp === 'legs' ? V(0, 0, 1) : V(0, 0, -1));
}

const solvedCache = new WeakMap();
function solvedQuats(J, st) {
  if (!solvedCache.has(st)) {
    applyState(J, st);
    solvedCache.set(st, limbQuats(J));
  }
  return solvedCache.get(st);
}

// ---------------------------------------------------------- the mesh
// A clean mannequin: tapered, muscled segments on the skeleton, joints
// capped with spheres so nothing opens up as it bends.
const SEG = 28;
function lathe(profile, len, mat) {
  // profile: [[t 0..1 down the segment, radius], ...]
  const pts = profile.map(([t, r]) => new THREE.Vector2(r, -t * len));
  const g = new THREE.LatheGeometry(pts, SEG);
  return new THREE.Mesh(g, mat);
}
function ellipsoid(rx, ry, rz, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.scale.set(rx, ry, rz);
  return m;
}
function sphere(r, mat) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
}

// Rings up the trunk (heights from the hip joints; half-width, half-depth,
// forward offset), rounded into a torso and skinned to pelvis, lower back
// and ribcage.
const TORSO = [
  [-0.11, 0.1, 0.075, -0.005], [-0.07, 0.165, 0.115, -0.015], [-0.02, 0.178, 0.122, -0.02],
  [0.04, 0.168, 0.113, -0.01], [0.1, 0.15, 0.1, 0.0], [0.16, 0.143, 0.098, 0.004],
  [0.22, 0.15, 0.104, 0.006], [0.29, 0.162, 0.115, 0.008], [0.35, 0.172, 0.124, 0.01],
  [0.41, 0.178, 0.122, 0.006], [0.45, 0.17, 0.108, -0.004], [0.48, 0.13, 0.085, -0.012],
  [0.505, 0.07, 0.058, -0.012], [0.515, 0.0, 0.0, -0.012],
];
function torsoRegion(y, cx, cz) {
  // cx: -1..1 across (left +), cz: -1..1 back to front
  if (cz > 0.35) return y > 0.3 ? 'chest' : y > 0.0 ? 'core' : 'hipFlexors';
  if (cz < -0.35) return y > 0.36 ? 'traps' : y > 0.2 ? 'lats' : y > 0.0 ? 'lowerBack' : 'glutes';
  return y > 0.3 ? 'lats' : y > -0.02 ? 'core' : 'glutes';
}
function torsoMesh(J, palette, tintOf) {
  const M = 48;
  const pos = [], col = [], si = [], sw = [], idx = [];
  const base = J.pelvis.position.y;
  const lumbarY = 0.09, thoraxY = 0.23;
  const skin = new THREE.Color(palette.skin);
  TORSO.forEach(([y, w, d, z0]) => {
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      // a softened rectangle: flatter front and back than a plain ellipse
      const k = 0.35;
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 1 - k), sz = Math.sign(s) * Math.pow(Math.abs(s), 1 - k);
      pos.push(w * sx, base + y, z0 + d * sz * (s > 0 ? 1 : 0.92));
      const region = torsoRegion(y, c, s);
      const t = tintOf[region];
      const color = t ? skin.clone().lerp(new THREE.Color(t[0]), t[1]) : skin;
      col.push(color.r, color.g, color.b);
      // skin weights: pelvis (0), lower back (1), ribcage (2)
      let wp = 0, wl = 0, wt = 0;
      if (y < lumbarY - 0.05) wp = 1;
      else if (y < lumbarY + 0.05) { wl = (y - (lumbarY - 0.05)) / 0.1; wp = 1 - wl; }
      else if (y < thoraxY - 0.04) wl = 1;
      else if (y < thoraxY + 0.06) { wt = (y - (thoraxY - 0.04)) / 0.1; wl = 1 - wt; }
      else wt = 1;
      si.push(0, 1, 2, 0);
      sw.push(wp, wl, wt, 0);
    }
  });
  const R = TORSO.length;
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < M; i++) {
      const a = r * M + i, b = r * M + ((i + 1) % M), c = (r + 1) * M + i, e = (r + 1) * M + ((i + 1) % M);
      idx.push(a, c, b, b, c, e);
    }
  }
  // close the bottom
  const bottom = pos.length / 3;
  pos.push(0, base + TORSO[0][0] - 0.01, TORSO[0][3]);
  col.push(...col.slice(0, 3));
  si.push(0, 1, 2, 0); sw.push(1, 0, 0, 0);
  for (let i = 0; i < M; i++) idx.push(bottom, (i + 1) % M, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.SkinnedMesh(g, new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.55,
    sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x9ff5ea),
  }));
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  J.root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([J.pelvis, J.lumbar, J.thorax]);
  m.bind(skeleton);
  return m;
}

export function buildBody(J, palette, muscles = {}) {
  const mats = {};
  // muscle group -> highlight colour and strength, for the trunk's paint
  const tintOf = {};
  for (const [list, color, amt] of [[muscles.secondary, palette.secondary, 0.35], [muscles.primary, palette.primary, 0.6]])
    for (const n of list || []) for (const r of MUSCLE_REGIONS[n] || []) tintOf[r] = [color, amt];
  const mat = (region) => {
    if (!mats[region]) {
      mats[region] = new THREE.MeshPhysicalMaterial({
        color: palette.skin, roughness: 0.48, metalness: 0.0,
        clearcoat: 0.3, clearcoatRoughness: 0.55, sheen: 0.5, sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0x9ff5ea), emissive: new THREE.Color(0x000000),
      });
      mats[region].userData.region = region;
    }
    return mats[region];
  };
  const put = (parent, mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // the trunk: one smooth skinned mesh from the hips to the base of the
  // neck, so it bends as a whole, with the muscle groups painted on
  J.root.add(torsoMesh(J, palette, tintOf));
  for (const x of [-1, 1]) put(J.pelvis, ellipsoid(0.08, 0.085, 0.07, mat('glutes')), x * 0.068, -0.02, -0.05);
  const girdle = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, DIM.shoulderHalf * 2 - 0.1, 8, 16), mat('traps'));
  girdle.rotation.z = Math.PI / 2;
  put(J.thorax, girdle, 0, 0.205, -0.018);
  // neck and head; the visor band makes the facing read from any angle
  put(J.neck, lathe([[0, 0.05], [0.5, 0.045], [1, 0.048]], 0.1, mat('neck')), 0, 0.09, 0);
  put(J.head, ellipsoid(DIM.headR * 0.86, DIM.headR * 1.08, DIM.headR * 0.98, mat('head')), 0, 0.1, 0.012);
  put(J.head, ellipsoid(0.056, 0.05, 0.06, mat('head')), 0, 0.035, 0.045);
  const visorMat = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent,
    emissiveIntensity: 0.9, roughness: 0.25 });
  const visor = new THREE.Mesh(new THREE.TorusGeometry(DIM.headR * 0.93, 0.016, 10, 40, Math.PI * 0.62), visorMat);
  // the arc is centred on the face: it starts 0.31 of a half-turn left of front
  visor.rotation.set(Math.PI / 2, 0, Math.PI * 0.19);
  put(J.head, visor, 0, 0.118, 0.012);

  for (const s of ['L', 'R']) {
    const side = s === 'L' ? 1 : -1;
    // deltoid cap rides with the arm; arm and forearm taper into the joints
    put(J['shoulder' + s], ellipsoid(0.06, 0.072, 0.064, mat('shoulders')), side * 0.012, -0.018, 0);
    put(J['shoulder' + s], lathe([[0, 0.05], [0.2, 0.048], [0.55, 0.043], [0.85, 0.037], [1, 0.035]],
      DIM.upperArm, mat('biceps')));
    put(J['elbow' + s], sphere(0.035, mat('arms')));
    put(J['elbow' + s], lathe([[0, 0.036], [0.2, 0.041], [0.55, 0.034], [0.88, 0.027], [1, 0.026]],
      DIM.forearm, mat('forearms')));
    put(J['wrist' + s], sphere(0.026, mat('forearms')));
    // hand: a mitten, palm facing the body at rest, with a thumb
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, DIM.hand - 0.06, 6, 12), mat('hands'));
    hand.scale.set(0.62, 1, 1.45);
    put(J['wrist' + s], hand, 0, -DIM.hand / 2 + 0.012, 0);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 4, 8), mat('hands'));
    thumb.rotation.x = -0.6;
    put(J['wrist' + s], thumb, 0, -0.045, 0.03);
    // leg
    put(J['hip' + s], sphere(0.08, mat('glutes')), side * 0.008, -0.012, -0.004);
    put(J['hip' + s], lathe([[0, 0.084], [0.15, 0.086], [0.5, 0.07], [0.85, 0.052], [1, 0.048]],
      DIM.thigh, mat('quads')));
    put(J['knee' + s], sphere(0.048, mat('legs')));
    put(J['knee' + s], lathe([[0, 0.048], [0.25, 0.057], [0.52, 0.046], [0.85, 0.032], [1, 0.03]],
      DIM.shin, mat('calves')));
    put(J['ankle' + s], sphere(0.031, mat('feet')));
    // foot: a rounded wedge, toes forward, sole on y = -ankle
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, DIM.footFront + DIM.footBack - 0.076, 6, 12), mat('feet'));
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1.15, 1, 0.75);
    put(J['ankle' + s], foot, 0, -DIM.ankle + 0.029, (DIM.footFront - DIM.footBack) / 2);
  }
  return mats;
}

// Muscle groups the data names -> the mesh regions that light up.
export const MUSCLE_REGIONS = {
  quads: ['quads'], hamstrings: ['quads'], glutes: ['glutes'], adductors: ['quads'],
  calves: ['calves'], core: ['core'], obliques: ['core'], lowerBack: ['lowerBack'],
  chest: ['chest'], shoulders: ['shoulders'], triceps: ['biceps'], biceps: ['biceps'],
  forearms: ['forearms', 'hands'], lats: ['lats'], upperBack: ['traps', 'lats'], traps: ['traps'],
  hipFlexors: ['glutes', 'quads'], neck: ['neck'],
};
