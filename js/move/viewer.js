/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  3D MOVEMENT VIEWER (move.html)

    move.html                  the library: every movement, by body region
    move.html#<exerciseId>     one movement (an id from js/exercises.js, or
                               an animation name like 'bwSquat')
    ?embed=1                   inside the app's overlay: no library link
    ?check=<name>[,<name>]     contact sheet + numeric checks, for
                               scripts/move-check.mjs
*/
import * as THREE from '../../vendor/three/three.min.js';
import { buildSkeleton, buildBody, bodyPoints, applyState, DIM, MUSCLE_REGIONS } from './body.js';
import { timeline, poseAt, buildProps } from './motion.js';
import { MOVES } from '../moves/index.js';

const PALETTE = {
  bg: 0x0a1514, floor: 0x10201f, skin: 0xb9c9c5, accent: 0x2dd4bf,
  primary: 0xf43f5e, secondary: 0xfb923c, iron: 0x8a9696, gear: 0xfbbf24,
  wood: 0x6b5a45, wall: 0x1a2c2b,
};
const params = new URLSearchParams(location.search);
const EMBED = params.has('embed');
const CHECK = params.get('check');
const $ = (id) => document.getElementById(id);
// js/exercises.js is a classic script: its const is a global binding, not a window property
const EX = typeof EXERCISES !== 'undefined' ? EXERCISES : {};  // eslint-disable-line no-undef

// exercise id or animation name -> { id, ex, base, move }
function resolve(key) {
  const ex = EX[key];
  const base = ex ? ex.img : key;
  const move = MOVES[base];
  if (!move) return null;
  return { id: ex ? key : null, ex, base, move };
}

// ---------------------------------------------------------- the scene
function makeStage(canvas, { shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!CHECK });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.Fog(PALETTE.bg, 6, 14);

  scene.add(new THREE.HemisphereLight(0xdff7f3, 0x0b1a19, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eead4, 1.4);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);

  // a round platform with faint distance rings, and a floor that only
  // shows the shadow
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
  return { renderer, scene, camera, key };
}

function makeFigure(scene, move) {
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
function motionBounds(fig) {
  const box = new THREE.Box3();
  for (let i = 0; i <= 48; i++) {
    poseAt(fig.J, fig.tl, (fig.tl.total * i) / 48);
    for (const p of bodyPoints(fig.J)) box.expandByPoint(p);
    // held equipment reaches past the hands (a barbell's plates)
    if ((fig.move.props || []).some(p => /bell|dumbbell/.test(p.type)))
      for (const s of ['L', 'R']) box.expandByPoint(fig.J['wrist' + s].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)));
  }
  box.expandByScalar(0.08);
  return box;
}

function placeCamera(camera, box, yawDeg, pitchDeg = 8, aspect = 1) {
  // fit the rep's bounding sphere, so no angle crops it
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const c = sph.center;
  const vfov = (camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const r = (sph.radius * 0.92) / Math.sin(Math.min(vfov, hfov) / 2);
  const yaw = (yawDeg * Math.PI) / 180, pitch = (pitchDeg * Math.PI) / 180;
  camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * r, c.y + Math.sin(pitch) * r, c.z + Math.cos(yaw) * Math.cos(pitch) * r);
  camera.lookAt(c);
  return c;
}

// ---------------------------------------------------------- one movement
const VIEWS = [
  { id: 'three', label: '3/4', yaw: 38, pitch: 10 },
  { id: 'front', label: 'Front', yaw: 0, pitch: 4 },
  { id: 'side', label: 'Side', yaw: 90, pitch: 4 },
  { id: 'back', label: 'Back', yaw: 180, pitch: 6 },
  { id: 'top', label: 'Above', yaw: 30, pitch: 62 },
];

function showMove(r) {
  const { ex, move } = r;
  document.title = `${ex ? ex.name : move.title || r.base} · FIT`;
  $('library').hidden = true;
  $('detail').hidden = false;
  $('backLink').hidden = EMBED;
  $('moveName').textContent = ex ? ex.name : (move.title || r.base);
  $('moveCue').textContent = ex && ex.cue ? ex.cue : '';

  const canvas = $('stage');
  const { renderer, scene, camera } = makeStage(canvas);
  const fig = makeFigure(scene, move);
  const box = motionBounds(fig);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.49;

  let view = VIEWS.find(v => v.yaw === (move.camera && move.camera.yaw)) || { ...VIEWS[0], ...(move.camera || {}) };
  const frame = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    controls.target.copy(placeCamera(camera, box, view.yaw, view.pitch, camera.aspect));
    controls.update();
  };
  new ResizeObserver(frame).observe(canvas);

  // view buttons
  const vb = $('views');
  vb.innerHTML = '';
  for (const v of VIEWS) {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.className = 'chip';
    b.onclick = () => { view = v; frame(); mark(); };
    b.dataset.view = v.id;
    vb.appendChild(b);
  }
  const mark = () => vb.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === view.id));
  mark();

  // playback
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed = 1, clock = 0, last = performance.now();
  const playBtn = $('play');
  const setPlay = (p) => { playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(!p)); };
  setPlay(playing);
  playBtn.onclick = () => setPlay(!playing);
  const speedBtn = $('speed');
  speedBtn.onclick = () => { speed = speed === 1 ? 0.5 : speed === 0.5 ? 0.25 : 1; speedBtn.textContent = `${speed}x`; };

  // phase chips: jump to a key pose and hold it
  const phases = $('phases');
  phases.innerHTML = '';
  const seen = new Set();
  for (const a of fig.tl.arrivals()) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    const k = move.keys[a.name];
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = k.label || a.name;
    b.onclick = () => { clock = a.time; setPlay(false); };
    phases.appendChild(b);
  }

  const phaseLabel = $('phaseLabel');
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) clock += dt * speed;
    const { step } = poseAt(fig.J, fig.tl, clock);
    fig.props(clock);
    const k = move.keys[step.to];
    const txt = (clock % fig.tl.total) >= step.t1 ? (k.label || '') : (move.keys[step.from].label ? `${move.keys[step.from].label} → ${k.label || ''}` : '');
    if (phaseLabel.textContent !== txt) phaseLabel.textContent = txt;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  renderCoaching(r);
}

function list(el, items, ordered) {
  el.innerHTML = '';
  const wrap = document.createElement(ordered ? 'ol' : 'ul');
  for (const t of items) {
    const li = document.createElement('li');
    li.textContent = t;
    wrap.appendChild(li);
  }
  el.appendChild(wrap);
}

function renderCoaching({ ex, move }) {
  const c = move.coaching || {};
  const sec = (id, items, ordered) => {
    const s = $(id);
    s.hidden = !(items && items.length);
    if (!s.hidden) list(s.querySelector('.body'), items, ordered);
  };
  sec('secSetup', c.setup);
  sec('secSteps', c.steps, true);
  sec('secCues', c.cues);
  sec('secMistakes', c.mistakes);
  const muscles = $('muscles');
  muscles.innerHTML = '';
  const mus = move.muscles || {};
  const names = { quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', adductors: 'Inner thighs',
    calves: 'Calves', core: 'Abs', obliques: 'Obliques', lowerBack: 'Lower back', chest: 'Chest',
    shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Grip and forearms',
    lats: 'Lats', upperBack: 'Upper back', traps: 'Traps', hipFlexors: 'Hip flexors', neck: 'Neck' };
  for (const [kind, arr] of [['primary', mus.primary], ['secondary', mus.secondary]]) {
    for (const m of arr || []) {
      const s = document.createElement('span');
      s.className = `muscle ${kind}`;
      s.textContent = names[m] || m;
      muscles.appendChild(s);
    }
  }
  $('secMuscles').hidden = !muscles.children.length;
  const facts = [];
  if (c.breathing) facts.push(['Breathing', c.breathing]);
  if (c.tempo) facts.push(['Tempo', c.tempo]);
  if (ex && ex.alt) facts.push(['Easier option', ex.alt]);
  const f = $('facts');
  f.innerHTML = '';
  for (const [k, v] of facts) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    f.append(dt, dd);
  }
  $('secFacts').hidden = !facts.length;
}

// ---------------------------------------------------------- the library
const REGION_NAMES = { push: 'Chest and shoulders', pull: 'Back and arms', core: 'Core and abs',
  legs: 'Legs and glutes', cardio: 'Cardio' };
function showLibrary() {
  $('library').hidden = false;
  $('detail').hidden = true;
  const root = $('libraryList');
  root.innerHTML = '';
  const ex = EX;
  const byRegion = {};
  for (const [id, e] of Object.entries(ex)) {
    if (!e.img || !MOVES[e.img]) continue;
    (byRegion[e.regions[0]] = byRegion[e.regions[0]] || []).push([id, e]);
  }
  for (const [region, label] of Object.entries(REGION_NAMES)) {
    const items = (byRegion[region] || []).sort((a, b) => a[1].name.localeCompare(b[1].name));
    if (!items.length) continue;
    const h = document.createElement('h2'); h.textContent = label;
    const ul = document.createElement('ul'); ul.className = 'lib';
    for (const [id, e] of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`; a.textContent = e.name;
      li.appendChild(a); ul.appendChild(li);
    }
    root.append(h, ul);
  }
  const total = Object.values(ex).filter(e => e.img).length;
  const done = Object.values(ex).filter(e => e.img && MOVES[e.img]).length;
  $('libraryCount').textContent = done < total ? `${done} of ${total} movements so far` : `${done} movements`;
}

// ---------------------------------------------------------- check mode
// Renders each key pose and the midpoints between them from four sides,
// and reports numbers the checker script reads from window.__check.
function runCheck(names) {
  document.body.classList.add('checking');
  const out = $('checkSheet');
  out.hidden = false;
  const CELL = +(params.get('size') || 210);
  const W = CELL * 1.5, H = CELL * 1.5;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const { renderer, scene, camera } = makeStage(canvas, { shadows: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  const report = {};
  for (const name of names) {
    const move = MOVES[name];
    const rep = report[name] = { errors: [], warnings: [] };
    if (!move) { rep.errors.push('no movement data'); continue; }
    let fig;
    try { fig = makeFigure(scene, move); } catch (e) { rep.errors.push(String(e.message || e)); continue; }
    const box = motionBounds(fig);
    const title = document.createElement('h3');
    title.textContent = name;
    out.appendChild(title);
    const row = document.createElement('div');
    row.className = 'checkRow';
    out.appendChild(row);
    // numeric checks over the whole loop
    let minY = Infinity, worstMiss = [];
    for (let i = 0; i <= 120; i++) {
      const t = (fig.tl.total * i) / 120;
      const { misses } = poseAt(fig.J, fig.tl, t);
      if (misses.length) worstMiss = misses;
      for (const p of bodyPoints(fig.J)) minY = Math.min(minY, p.y);
    }
    if (minY < -0.03) rep.errors.push(`body goes ${(-minY * 100).toFixed(0)} cm through the floor`);
    if (worstMiss.length) rep.errors.push(...new Set(worstMiss));
    for (const s of fig.tl.seq) {
      const st = fig.tl.states[s];
      for (const side of ['L', 'R']) {
        const l = st.legs[side];
        if (l.ik && l.foot[1] < DIM.ankle - 0.02) rep.errors.push(`${s}: ${side} ankle below the floor (y ${l.foot[1]})`);
      }
    }
    // where the joints land in each key pose, so hand and foot targets can
    // be placed against the real shoulders and hips
    rep.joints = {};
    for (const s of new Set(fig.tl.seq)) {
      applyState(fig.J, fig.tl.states[s]);
      const w = (n) => fig.J[n].getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(3));
      rep.joints[s] = { shoulderL: w('shoulderL'), shoulderR: w('shoulderR'), hipL: w('hipL'), hipR: w('hipR'),
        elbowL: w('elbowL'), kneeL: w('kneeL'), wristL: w('wristL'), ankleL: w('ankleL'), head: w('head') };
    }
    if (params.has('quick')) { scene.remove(fig.J.root); continue; }
    // frames: each key pose, and halfway into each move
    const frames = [];
    for (const st of fig.tl.steps) {
      frames.push({ t: st.t0 + (st.t1 - st.t0) / 2, label: `→ ${st.to}` });
      frames.push({ t: st.t1 + 0.001, label: move.keys[st.to].label || st.to });
    }
    const uniq = [];
    for (const f of frames) if (!uniq.some(u => u.label === f.label && !f.label.startsWith('→'))) uniq.push(f);
    for (const f of uniq) {
      const cell = document.createElement('figure');
      const cap = document.createElement('figcaption');
      cap.textContent = f.label;
      for (const v of [VIEWS[1], VIEWS[2], VIEWS[0]]) {
        poseAt(fig.J, fig.tl, f.t);
        fig.props(f.t);
        placeCamera(camera, box, v.yaw, v.pitch, 1);
        renderer.render(scene, camera);
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.width = CELL; img.height = CELL;
        cell.appendChild(img);
      }
      cell.appendChild(cap);
      row.appendChild(cell);
    }
    // clear this figure out of the scene for the next one
    scene.remove(fig.J.root);
    for (const o of [...scene.children]) if (o.isGroup || (o.isMesh && o.geometry.type !== 'CircleGeometry' && o.geometry.type !== 'RingGeometry')) scene.remove(o);
  }
  window.__check = report;
  document.body.dataset.checked = '1';
}

// ---------------------------------------------------------- start
function route() {
  // inside the app's sheet, which has its own Close button
  if (EMBED) document.body.classList.add('embed');
  document.addEventListener('keydown', (e) => {
    if (EMBED && e.key === 'Escape') parent.postMessage({ type: 'fit-move-close' }, location.origin);
  });
  if (CHECK) return runCheck(CHECK.split(','));
  const key = decodeURIComponent(location.hash.slice(1));
  const r = key && resolve(key);
  if (r) showMove(r);
  else showLibrary();
}
window.addEventListener('hashchange', () => location.reload());
route();
