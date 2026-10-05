/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  TIMELINE AND EQUIPMENT for the 3D movement viewer.

  A movement record (see js/moves/) plays its key poses in `seq` order and
  loops. tempo[i] is the seconds to move from seq[i] to the next pose (one
  number applies to every move), holds[name] the seconds to pause on
  arriving at that pose. Moves ease in and out, like a controlled rep. A
  key pose with `pass: true`, or named in the record's `flow` list, is a
  waypoint: the motion flows through it without slowing (use it to steer a
  bar path or a swing, never at a point where the motion reverses).
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
  const flow = new Set([...(move.flow || []), ...seq.filter(n => move.keys[n].pass)]);
  steps.forEach((s, i) => {
    let a = i, b = i;
    while (a > 0 && flow.has(steps[a - 1].to)) a--;
    while (b < steps.length - 1 && flow.has(steps[b].to)) b++;
    s.g = { a, b, t0: steps[a].t0, t1: steps[b].t1 };
  });
  for (const s of steps) if (flow.has(s.to)) s.t2 = s.t1;
  return {
    seq, states, steps, total, keys: move.keys,
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
//   wall { z }  a wall behind (-) or in front (+); { x } a wall to the left
//               (+) or right (-) instead; width (3 m); target: a mark at
//               that height
//   pullupBar { y, z, width }  a fixed bar across the X axis (hands grip it
//               with targets in the move: wrists about 0.07 under the bar)
//   band { from, to, handles }  an elastic band between two points that
//               move: 'handL' | 'handR' | 'footL' | 'footR' (under the arch)
//               or a fixed world point [x, y, z] (a door anchor); thinner as
//               it stretches. { loop: 'knees' } is a mini band around both
//               thighs just above the knees.
//   ball { hand: 'both', r }  a medicine ball between the hands. A key pose
//               with `ball: [x, y, z]` puts it at that world point instead
//               (thrown, slammed, on the floor), blended through the
//               timeline: leaving the hands it peels away from them as the
//               move goes on, coming back it travels to where the hands
//               will be when the move lands. Keys without `ball` hold it.
export function buildProps(scene, J, list, palette, tl) {
  const metal = new THREE.MeshStandardMaterial({ color: palette.iron, roughness: 0.35, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: palette.gear, roughness: 0.45, metalness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.8 });
  const band = new THREE.MeshStandardMaterial({ color: palette.band ?? 0xa78bfa, roughness: 0.55, metalness: 0 });
  const updates = [];
  const extra = [];       // points past the body the camera should frame
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
      const h = Math.max(2.6, (p.target || 0) + 0.5);
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.width ?? 3, h, 0.1), new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.9 }));
      const side = p.x !== undefined;
      const at = side ? p.x : p.z ?? -0.4;
      m.position.set(side ? at : 0, h / 2, side ? 0 : at);
      if (side) m.rotation.y = Math.PI / 2;
      m.receiveShadow = true;
      scene.add(m);
      if (p.target) {
        // a target ring on the face towards the figure
        const face = at - Math.sign(at) * 0.052;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.022, 8, 40),
          new THREE.MeshBasicMaterial({ color: palette.gear }));
        ring.position.set(side ? face : 0, p.target, side ? 0 : face);
        if (side) ring.rotation.y = Math.PI / 2;
        scene.add(ring);
      }
    } else if (p.type === 'pullupBar') {
      // a bar across the X axis on two short brackets that run up and back
      // to the mounting (a doorframe or beam above)
      const y = p.y ?? 2.25, z = p.z ?? 0, w = p.width ?? 1.1;
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, w, 20), metal);
      bar.rotation.z = Math.PI / 2;
      g.add(bar);
      for (const x of [-w / 2, w / 2]) {
        const up = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.04), accent);
        up.position.set(x, 0.07, 0); g.add(up);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.17), accent);
        back.position.set(x, 0.15, -0.065); g.add(back);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.012), metal);
        plate.position.set(x, 0.15, -0.155); g.add(plate);
      }
      g.position.set(0, y, z);
      scene.add(shadow(g));
      extra.push(() => [new THREE.Vector3(-w / 2 - 0.05, y + 0.2, z), new THREE.Vector3(w / 2 + 0.05, y + 0.2, z)]);
    } else if (p.type === 'band' && p.loop) {
      // a mini band around both thighs just above the knees: a flat strip
      // that hugs the outside of each thigh and runs across front and back
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(),
        new THREE.MeshStandardMaterial({ color: palette.band ?? 0xa78bfa, roughness: 0.55, flatShading: true, side: THREE.DoubleSide }));
      scene.add(shadow(mesh));
      updates.push(() => {
        const at = (s) => {
          const h = J['hip' + s].getWorldPosition(new THREE.Vector3());
          const k = J['knee' + s].getWorldPosition(new THREE.Vector3());
          return { c: h.clone().lerp(k, 0.8), d: k.sub(h).normalize() };
        };
        const L = at('L'), R = at('R');
        const n = L.d.clone().add(R.d).normalize();                  // down the thighs
        const u = L.c.clone().sub(R.c);
        u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();      // across, left
        const f = new THREE.Vector3().crossVectors(n, u).normalize();
        const r = 0.06, pts = [];
        // round the outside of the left thigh, across, round the right
        for (let i = 0; i <= 12; i++) {
          const a = -Math.PI / 2 + (i / 12) * Math.PI;
          pts.push(L.c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(f, Math.sin(a) * r));
        }
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI / 2 + (i / 12) * Math.PI;
          pts.push(R.c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(f, Math.sin(a) * r));
        }
        mesh.geometry.dispose();
        mesh.geometry = stripGeometry(pts, n, 0.05, 0.006, true);
      });
    } else if (p.type === 'band') {
      // an elastic band between two points that move every frame; it thins
      // as it stretches, so the pull reads
      const point = (e) => {
        if (Array.isArray(e)) return new THREE.Vector3(...e);
        const s = e.slice(-1);
        if (e.startsWith('hand')) return grip(s);
        // under the arch of the foot, on the sole
        return J['ankle' + s].localToWorld(new THREE.Vector3(0, -DIM.ankle + 0.004, 0.05));
      };
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), band);
      const g = new THREE.Group();
      g.add(strap);
      const handles = [];
      for (const e of [p.from, p.to]) {
        if (Array.isArray(e)) {
          // a door anchor: a small stopper at the fixed point
          const nub = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), metal);
          nub.position.set(...e);
          g.add(nub);
        } else if (p.handles && e.startsWith('hand')) {
          const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.13, 14), accent);
          hdl.rotation.x = Math.PI / 2;
          const hg = new THREE.Group();
          hg.add(hdl);
          g.add(hg);
          handles.push([hg, e.slice(-1)]);
        }
      }
      scene.add(shadow(g));
      const rest = p.rest ?? 0.5;
      updates.push(() => {
        const a = point(p.from), b = point(p.to);
        const len = Math.max(0.01, a.distanceTo(b));
        const k = Math.min(1.5, Math.max(0.55, Math.sqrt(rest / len)));
        strap.position.copy(a).add(b).multiplyScalar(0.5);
        strap.scale.set(0.016 * k, len, 0.004 * k + 0.002);
        strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        for (const [hg, s] of handles) {
          hg.position.copy(grip(s));
          hg.quaternion.copy(J['wrist' + s].getWorldQuaternion(new THREE.Quaternion()));
        }
      });
    } else if (p.type === 'ball') {
      const r = p.r ?? 0.12;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 22), accent));
      const seamMat = new THREE.MeshStandardMaterial({ color: palette.iron, roughness: 0.7 });
      for (const rot of [[0, 0, 0], [0, Math.PI / 2, 0]]) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.002, r * 0.05, 8, 48), seamMat);
        seam.rotation.set(...rot);
        g.add(seam);
      }
      scene.add(shadow(g));
      const between = () => grip('L').add(grip('R')).multiplyScalar(0.5);
      // where the hands hold it in each key pose, for a ball coming back to
      // them (worked out now, before anything is shown)
      const held = {};
      if (tl) for (const name of new Set(tl.seq)) { applyState(J, tl.states[name]); held[name] = between(); }
      const spot = (k) => (k && Array.isArray(k.ball) ? new THREE.Vector3(...k.ball) : null);
      const pos = new THREE.Vector3();
      updates.push((time) => {
        pos.copy(between());
        if (tl) {
          const { f, step } = tl.at(time);
          const a = spot(tl.keys[step.from]), b = spot(tl.keys[step.to]);
          if (a && b) pos.copy(a).lerp(b, f);
          else if (b) pos.lerp(b, f);                          // leaving the hands
          else if (a) pos.copy(a).lerp(held[step.to], f);       // coming back
        }
        g.position.copy(pos);
        g.quaternion.copy(J.wristL.getWorldQuaternion(new THREE.Quaternion())
          .slerp(J.wristR.getWorldQuaternion(new THREE.Quaternion()), 0.5));
      });
      extra.push(() => [pos.clone().setY(pos.y + r), pos.clone().setY(pos.y - r)]);
    }
  }
  const update = (time) => updates.forEach(u => u(time));
  // points the props reach past the body (a bar's ends, a thrown ball), for
  // framing the camera: call after update()
  update.points = () => extra.flatMap(e => e());
  return update;
}

// A flat strip (width w along `across`, thickness t) through a list of
// points, open or closed: a rubber band that still reads edge on.
function stripGeometry(pts, across, w, t, closed) {
  const n = pts.length;
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const next = pts[Math.min(n - 1, i + 1)], prev = pts[Math.max(0, i - 1)];
    const tan = (closed ? pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]) : next.clone().sub(prev)).normalize();
    const out = new THREE.Vector3().crossVectors(tan, across).normalize();
    const a = across.clone().multiplyScalar(w / 2), o = out.multiplyScalar(t / 2);
    for (const [sa, so] of [[1, 1], [-1, 1], [-1, -1], [1, -1]])
      pos.push(p.x + a.x * sa + o.x * so, p.y + a.y * sa + o.y * so, p.z + a.z * sa + o.z * so);
  }
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = j * 4 + k, d = j * 4 + ((k + 1) % 4);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export { DIM };
