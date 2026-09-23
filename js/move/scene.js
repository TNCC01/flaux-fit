/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  THE 3D STAGE, shared by the full viewer (move.html) and the figures on
  the workout cards (js/move/deck.js): the lights, floor and palette, a
  figure with its muscles lit and its equipment, and a camera that frames
  the whole rep from any angle.
*/
import * as THREE from '../../vendor/three/three.min.js';
import { buildSkeleton, buildBody, bodyPoints, MUSCLE_REGIONS } from './body.js';
import { timeline, poseAt, buildProps } from './motion.js';
import { MOVES } from '../moves/index.js';

export const PALETTE = {
  bg: 0x0a1514, floor: 0x10201f, skin: 0xb9c9c5, accent: 0x2dd4bf,
  primary: 0xf43f5e, secondary: 0xfb923c, iron: 0x8a9696, gear: 0xfbbf24,
  wood: 0x6b5a45, wall: 0x35504d,
};

// exercise id or animation name -> { id, ex, base, move }
export function resolveMove(key, EX = {}) {
  const ex = EX[key];
  // an exercise can have its own 3D record (a loaded variant) even when it
  // shares its workout animation with another
  const base = ex && MOVES[key] ? key : ex ? ex.img : key;
  const move = MOVES[base];
  if (!move) return null;
  return { id: ex ? key : null, ex, base, move };
}

export function makeRenderer(canvas, { preserve = false, shadows = true, maxRatio = 2 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(maxRatio, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// Lights, a round platform with faint distance rings, and a camera.
export function buildScene({ shadowSize = 2048 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.Fog(PALETTE.bg, 6, 14);

  scene.add(new THREE.HemisphereLight(0xdff7f3, 0x0b1a19, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eead4, 1.4);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.95 }));
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);
  for (const r of [0.5, 1, 1.5, 2]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r + 0.004, 96),
      new THREE.MeshBasicMaterial({ color: 0x1f3b39, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    scene.add(ring);
  }
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  return { scene, camera, key };
}

export function makeFigure(scene, move) {
  const J = buildSkeleton();
  scene.add(J.root);
  const mats = buildBody(J, PALETTE, move.muscles);
  // light the working muscles
  const tint = (names, color, amount) => {
    for (const n of names || []) {
      for (const region of MUSCLE_REGIONS[n] || []) {
        const m = mats[region];
        if (!m || m.userData.tinted >= amount) continue;
        m.color.set(PALETTE.skin).lerp(new THREE.Color(color), amount);
        m.emissive.set(color).multiplyScalar(amount * 0.25);
        m.userData.tinted = amount;
      }
    }
  };
  const mus = move.muscles || {};
  tint(mus.secondary, PALETTE.secondary, 0.35);
  tint(mus.primary, PALETTE.primary, 0.6);
  const tl = timeline(move);
  const props = buildProps(scene, J, move.props, PALETTE);
  return { J, tl, props, move };
}

// The whole rep's extent, so the camera frames every part of it.
export function motionBounds(fig) {
  const box = new THREE.Box3();
  // every point the rep passes through, for the cards' tight framing
  const points = [];
  const add = (p) => { box.expandByPoint(p); points.push(p.clone()); };
  for (let i = 0; i <= 48; i++) {
    poseAt(fig.J, fig.tl, (fig.tl.total * i) / 48);
    for (const p of bodyPoints(fig.J)) add(p);
    // held equipment reaches past the hands (a barbell's plates)
    if ((fig.move.props || []).some(p => /bell|dumbbell/.test(p.type)))
      for (const s of ['L', 'R']) add(fig.J['wrist' + s].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)));
  }
  box.expandByScalar(0.08);
  box.points = points;
  return box;
}

export function placeCamera(camera, box, yawDeg, pitchDeg = 8, aspect = 1, { tight = false } = {}) {
  const vfov = (camera.fov * Math.PI) / 180;
  const tanV = Math.tan(vfov / 2), tanH = tanV * aspect;
  const yaw = (yawDeg * Math.PI) / 180, pitch = (pitchDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  let c, r;
  if (tight && box.points) {
    // fit the points the rep passes through as seen from this angle (the
    // small workout cards): fills the frame, but zooms a little as the
    // figure turns. Two passes: fit, then centre on what the camera sees.
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const up = dir.clone().cross(right);
    const pad = 0.1;                             // metres, for limb thickness
    c = box.getCenter(new THREE.Vector3());
    for (let pass = 0; pass < 2; pass++) {
      r = 0;
      const q = new THREE.Vector3();
      for (const p of box.points) {
        q.subVectors(p, c);
        const z = q.dot(dir);
        r = Math.max(r, z + (Math.abs(q.dot(right)) + pad) / tanH, z + (Math.abs(q.dot(up)) + pad) / tanV);
      }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of box.points) {
        q.subVectors(p, c);
        const d = r - q.dot(dir);
        const x = q.dot(right) / d, y = q.dot(up) / d;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      c.addScaledVector(right, ((x0 + x1) / 2) * r).addScaledVector(up, ((y0 + y1) / 2) * r);
    }
    r *= 1.02;
  } else {
    // fit the rep's bounding sphere, so no angle crops it
    const sph = box.getBoundingSphere(new THREE.Sphere());
    c = sph.center;
    r = (sph.radius * 0.92) / Math.min(Math.sin(vfov / 2), Math.sin(Math.atan(tanH)));
  }
  camera.position.copy(c).addScaledVector(dir, r);
  camera.lookAt(c);
  return c;
}
