/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  TIMELINE AND EQUIPMENT for the 3D movement viewer.

  A movement record (see js/moves/) plays its key poses in `seq` order and
  loops. tempo[i] is the seconds to move from seq[i] to the next pose (one
  number applies to every move), holds[name] the seconds to pause on
  arriving at that pose. Moves ease in and out, like a controlled rep. A
  key pose with `pass: true` is a waypoint: the motion flows through it
  without slowing (use it to steer a bar path or a swing).
*/
import * as THREE from '../../vendor/three/three.min.js';
import { normalise, blendState, applyState, DIM } from './body.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function timeline(move) {
  const seq = move.seq || Object.keys(move.keys);
  const states = {};
  for (const name of new Set(seq)) {
    if (!move.keys[name]) throw new Error(`seq names "${name}" but keys has no such pose`);
    states[name] = normalise(move.keys[name]);
  }
  const tempo = Array.isArray(move.tempo) ? move.tempo : seq.map(() => move.tempo || 1.2);
  const holds = move.holds || {};
  const steps = [];
  let t = 0;
  seq.forEach((from, i) => {
    const to = seq[(i + 1) % seq.length];
    const dur = tempo[i] ?? tempo[tempo.length - 1] ?? 1.2;
    const hold = holds[to] ?? 0.25;
    steps.push({ from, to, t0: t, t1: t + dur, t2: t + dur + hold });
    t += dur + hold;
  });
  const total = t;
  // a key pose marked `pass` is moved through without stopping: the moves
  // either side of it share one ease, from the last stop to the next
  steps.forEach((s, i) => {
    let a = i, b = i;
    while (a > 0 && move.keys[steps[a - 1].to].pass) a--;
    while (b < steps.length - 1 && move.keys[steps[b].to].pass) b++;
    s.g = { a, b, t0: steps[a].t0, t1: steps[b].t1 };
  });
  for (const s of steps) if (move.keys[s.to].pass) s.t2 = s.t1;
  return {
    seq, states, steps, total,
    // time (s) -> the pose to show
    at(time) {
      const u = ((time % total) + total) % total;
      let s = steps.find(x => u < x.t2) || steps[steps.length - 1];
      if (u >= s.t1) return { a: states[s.from], b: states[s.to], f: 1, step: s };
      if (s.g.a === s.g.b) return { a: states[s.from], b: states[s.to], f: ease((u - s.t0) / (s.t1 - s.t0)), step: s };
      // eased along the whole run, then linear within the move it lands in
      const gt = s.g.t0 + ease((u - s.g.t0) / (s.g.t1 - s.g.t0)) * (s.g.t1 - s.g.t0);
      for (let i = s.g.a; i <= s.g.b; i++) if (gt <= steps[i].t1 || i === s.g.b) { s = steps[i]; break; }
      const f = Math.min(1, Math.max(0, (gt - s.t0) / (s.t1 - s.t0)));
      return { a: states[s.from], b: states[s.to], f, step: s };
    },
    // when each key pose is reached, for the phase buttons
    arrivals() {
      return steps.map(s => ({ name: s.to, time: s.t1 }));
    },
  };
}

export function poseAt(J, tl, time) {
  const { a, b, f, step } = tl.at(time);
  const { st, limbQ } = blendState(J, a, b, f);
  const misses = applyState(J, st, limbQ);
  return { step, misses };
}

// ---------------------------------------------------------- equipment
// Props follow the hands every frame. Types:
//   dumbbell { hand: 'L' | 'R' }         kettlebell { hand: 'L' | 'R' | 'both',
//                                          grip: 'hand' (default, in line with
//                                          the hand) | 'hang' (straight down) |
//                                          'rack' (on the back of the forearm) |
//                                          'auto' (rack while the hand is above
//                                          the elbow, in line below it) }
//   barbell {}  (between the hands)      rings {}  straps to both hands
//   rope {}     skipping rope            box { pos, size }  bench { pos, size }
//   wall { z }  a wall behind (-) or in front (+)
export function buildProps(scene, J, list, palette) {
  const metal = new THREE.MeshStandardMaterial({ color: palette.iron, roughness: 0.35, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: palette.gear, roughness: 0.45, metalness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.8 });
  const updates = [];
  const shadow = (m) => { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
  const grip = (s) => J['wrist' + s].localToWorld(new THREE.Vector3(0, -0.07, 0.005));

  for (const p of list || []) {
    if (p.type === 'dumbbell') {
      // the handle runs across the palm (the hand's local Z), so the grip is
      // set by the forearm: turn 0 palms in (hammer), + palms up, - palms down
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 16), metal);
      bar.rotation.x = Math.PI / 2;
      g.add(bar);
      for (const z of [-0.1, 0.1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 24), accent);
        w.rotation.x = Math.PI / 2; w.position.z = z; g.add(w);
      }
      scene.add(shadow(g));
      updates.push(() => {
        const w = J['wrist' + p.hand];
        g.position.copy(grip(p.hand));
        g.quaternion.copy(w.getWorldQuaternion(new THREE.Quaternion()));
      });
    } else if (p.type === 'kettlebell') {
      const g = new THREE.Group();
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 20), accent);
      bell.scale.y = 0.95; bell.position.y = -0.14;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 10, 24, Math.PI * 1.25), metal);
      // the handle's crossbar runs across the palm, like a dumbbell's
      handle.rotation.set(0, Math.PI / 2, -Math.PI * 0.125); handle.position.y = -0.03;
      g.add(bell, handle);
      scene.add(shadow(g));
      updates.push(() => {
        if (p.grip === 'hang' || p.grip === 'rack' || p.grip === 'auto') {
          // hang: straight down from the grip, whatever the hand does.
          // rack: resting on the back of the forearm, handle in the hand.
          // auto: what a real bell does, resting on the forearm while the
          // hand is above the elbow, in line with the arm while it is below
          const s = p.hand === 'both' ? 'L' : p.hand;
          const at = p.hand === 'both' ? grip('L').add(grip('R')).multiplyScalar(0.5) : grip(s);
          g.position.copy(at);
          const side = s === 'L' ? 1 : -1;
          const w = J['wrist' + s], e = J['elbow' + s];
          const wp = w.getWorldPosition(new THREE.Vector3()), ep = e.getWorldPosition(new THREE.Vector3());
          const back = new THREE.Vector3(side, 0, 0).transformDirection(w.matrixWorld);
          const rack = back.multiplyScalar(0.55).add(ep.clone().sub(wp).normalize().multiplyScalar(0.85)).normalize();
          let d = new THREE.Vector3(0, -1, 0);
          if (p.grip === 'rack') d = rack;
          else if (p.grip === 'auto') {
            const inLine = new THREE.Vector3(0, -1, 0).transformDirection(w.matrixWorld);
            const up = wp.clone().sub(ep).normalize().y;           // forearm pointing up: + 
            const k = Math.min(1, Math.max(0, (up + 0.15) / 0.5));
            d = inLine.multiplyScalar(1 - k).add(rack.multiplyScalar(k)).normalize();
          }
          g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
          return;
        }
        if (p.hand === 'both') {
          const a = grip('L'), b = grip('R');
          g.position.copy(a.add(b).multiplyScalar(0.5));
          // hang between the hands, in line with the forearms
          g.quaternion.copy(J.wristL.getWorldQuaternion(new THREE.Quaternion())
            .slerp(J.wristR.getWorldQuaternion(new THREE.Quaternion()), 0.5));
        } else {
          g.position.copy(grip(p.hand));
          g.quaternion.copy(J['wrist' + p.hand].getWorldQuaternion(new THREE.Quaternion()));
        }
      });
    } else if (p.type === 'barbell') {
      const g = new THREE.Group();
      const len = p.length || 1.5;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 16), metal);
      bar.rotation.z = Math.PI / 2;
      g.add(bar);
      for (const x of [-(len / 2 - 0.12), len / 2 - 0.12]) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(p.plate || 0.16, p.plate || 0.16, 0.04, 32), accent);
        plate.rotation.z = Math.PI / 2; plate.position.x = x; g.add(plate);
      }
      scene.add(shadow(g));
      updates.push(() => {
        const a = grip('L'), b = grip('R');
        g.position.copy(a.clone().add(b).multiplyScalar(0.5));
        const axis = a.sub(b).normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);
      });
    } else if (p.type === 'rings') {
      const top = p.top || 2.7;
      const g = new THREE.Group();
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 10, 32), wood);
      const ringR = ringL.clone();
      const strapGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 8);
      const strapL = new THREE.Mesh(strapGeo, accent), strapR = new THREE.Mesh(strapGeo, accent);
      g.add(ringL, ringR, strapL, strapR);
      scene.add(shadow(g));
      updates.push(() => {
        for (const [s, ring, strap] of [['L', ringL, strapL], ['R', ringR, strapR]]) {
          const h = grip(s);
          ring.position.copy(h);
          ring.rotation.set(0, Math.PI / 2, 0);
          const anchor = new THREE.Vector3(h.x, top, h.z * 0.3);
          const mid = anchor.clone().add(h).multiplyScalar(0.5);
          strap.position.copy(mid.setY(mid.y + 0.045));
          strap.scale.y = Math.max(0.01, anchor.distanceTo(h) - 0.09);
          strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anchor.clone().sub(h).normalize());
        }
      });
    } else if (p.type === 'rope') {
      const mat = new THREE.MeshStandardMaterial({ color: palette.gear, roughness: 0.6 });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      scene.add(shadow(mesh));
      updates.push((time) => {
        const a = grip('L'), b = grip('R');
        const spin = (time / (p.period || 0.5)) * Math.PI * 2 * (p.turns || 1);
        // the loop swings around the body: under the feet, up behind
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const r = Math.max(0.2, mid.y - 0.02);
        const bow = new THREE.Vector3(0, -Math.cos(spin) * r, Math.sin(spin) * r * 0.9);
        const curve = new THREE.CatmullRomCurve3([
          a, a.clone().add(bow.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0.05, 0, 0)),
          mid.clone().add(bow),
          b.clone().add(bow.clone().multiplyScalar(0.55)).add(new THREE.Vector3(-0.05, 0, 0)), b,
        ]);
        mesh.geometry.dispose();
        mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.007, 6, false);
      });
    } else if (p.type === 'box' || p.type === 'bench') {
      const [w, h, d] = p.size || (p.type === 'box' ? [0.5, 0.45, 0.4] : [1.2, 0.45, 0.35]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      const [x, , z] = p.pos || [0, 0, 0];
      m.position.set(x, h / 2, z);
      scene.add(shadow(m));
    } else if (p.type === 'wall') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 0.1), new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.9 }));
      m.position.set(0, 1.3, p.z ?? -0.4);
      m.receiveShadow = true;
      scene.add(m);
    }
  }
  return (time) => updates.forEach(u => u(time));
}

export { DIM };
