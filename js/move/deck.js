/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  3D FIGURES ON THE WORKOUT CARDS

  The workout screen (and the "coming up" thumbnails) show each exercise as
  the same 3D figure the full viewer uses. Browsers allow only a handful of
  WebGL contexts per page, and the coming-up sheet can show eight figures,
  so there is ONE renderer: each frame it draws every visible figure in
  turn into its own corner of an offscreen canvas and copies it onto that
  card's 2D canvas.

  Each figure opens at its movement's authored best angle. Dragging
  sideways on a card turns it (it stays turned until the exercise
  changes); a plain tap is left alone, so the card's own click handler
  still opens the full viewer. Figures only draw while on screen and the
  page is visible, at 30 fps on the cards and 15 on thumbnails, to go easy
  on the battery. With reduced motion they hold a single pose.

  window.FitDeck.show(el, exerciseIdOrAnimation, { thumb })
  window.FitDeck.clear(el)
*/
import { poseAt } from './motion.js';
import { resolveMove, makeRenderer, buildScene, makeFigure, motionBounds, placeCamera } from './scene.js';

const EX = typeof EXERCISES !== 'undefined' ? EXERCISES : {};  // eslint-disable-line no-undef
const still = matchMedia('(prefers-reduced-motion: reduce)');

let renderer = null, failed = false, bufW = 0, bufH = 0;
const views = new Map();            // card element -> view

function ensureRenderer() {
  if (renderer || failed) return renderer;
  try {
    renderer = makeRenderer(document.createElement('canvas'), { preserve: true, maxRatio: 1 });
  } catch (e) {
    failed = true;                   // no WebGL: the cards stay as plain text
  }
  return renderer;
}

function makeView(el, key, thumb) {
  const r = resolveMove(key, EX);
  if (!r || !ensureRenderer()) return null;
  const { scene, camera } = buildScene({ shadowSize: thumb ? 512 : 1024 });
  const fig = makeFigure(scene, r.move);
  const box = motionBounds(fig);
  const canvas = document.createElement('canvas');
  canvas.className = 'fig3d';
  el.prepend(canvas);
  const cam = r.move.camera || {};
  const view = {
    el, key, thumb, canvas, ctx: canvas.getContext('2d'), scene, camera, fig, box,
    yaw0: cam.yaw ?? 38, pitch: cam.pitch ?? 8, yaw: cam.yaw ?? 38,
    // start each figure somewhere into its rep so a row of thumbnails isn't in lockstep
    clock: thumb ? Math.random() * fig.tl.total : 0, last: 0, drawn: 0,
  };
  // reduced motion: hold the pose the rep builds to (its second key pose)
  const arrive = fig.tl.arrivals();
  view.stillAt = arrive.length ? arrive[0].time : 0;
  if (!thumb) dragToTurn(view);
  return view;
}

// Sideways drag turns the figure; a tap passes through to the card.
function dragToTurn(view) {
  const c = view.canvas;
  let start = null;
  c.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, yaw: view.yaw, moved: false, id: e.pointerId };
  });
  c.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      start.moved = true;
      c.setPointerCapture(e.pointerId);
    }
    if (start.moved) view.yaw = start.yaw - dx * 0.6;
  });
  const end = () => { if (start && start.moved) view.dragged = true; start = null; };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', () => { start = null; });
  // swallow the click that ends a drag, so it doesn't open the full viewer
  c.addEventListener('click', (e) => {
    if (view.dragged) { view.dragged = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
}

function dispose(view) {
  view.canvas.remove();
  view.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

function show(el, key, { thumb = false } = {}) {
  const cur = views.get(el);
  if (cur && cur.key === key) return;
  if (cur) { dispose(cur); views.delete(el); }
  if (!key) return;
  const view = makeView(el, key, thumb);
  if (view) { views.set(el, view); start(); }
}

function clear(el) {
  const cur = views.get(el);
  if (cur) { dispose(cur); views.delete(el); }
}

// ---------------------------------------------------------- the loop
let running = false;
function start() {
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

function frame(now) {
  if (!views.size) { running = false; return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const view of [...views.values()]) {
    if (!view.el.isConnected) { dispose(view); views.delete(view.el); continue; }
    const dt = view.last ? Math.min(0.1, (now - view.last) / 1000) : 0;
    view.last = now;
    if (!still.matches) view.clock += dt;
    // off screen or hidden (demos switched off): keep time, skip drawing
    const cw = view.canvas.clientWidth, ch = view.canvas.clientHeight;
    if (!cw || !ch || view.el.offsetParent === null) continue;
    const fps = view.thumb ? 15 : 30;
    if (now - view.drawn < 1000 / fps - 4) continue;
    view.drawn = now;
    const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (view.canvas.width !== w || view.canvas.height !== h) { view.canvas.width = w; view.canvas.height = h; }
    // one shared drawing buffer, grown to the largest card
    if (w > bufW || h > bufH) {
      bufW = Math.max(bufW, w); bufH = Math.max(bufH, h);
      renderer.setSize(bufW, bufH, false);
    }
    poseAt(view.fig.J, view.fig.tl, still.matches ? view.stillAt : view.clock);
    view.fig.props(view.clock);
    view.camera.aspect = w / h;
    view.camera.updateProjectionMatrix();
    placeCamera(view.camera, view.box, view.yaw, view.pitch, w / h, { tight: true });
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.render(view.scene, view.camera);
    // WebGL draws bottom-up: the view sits at the bottom of the buffer
    view.ctx.clearRect(0, 0, w, h);
    view.ctx.drawImage(renderer.domElement, 0, bufH - h, w, h, 0, 0, w, h);
  }
  requestAnimationFrame(frame);
}

window.FitDeck = { show, clear, get available() { return !failed; } };
// the app may have asked for figures before this module finished loading
window.dispatchEvent(new Event('fitdeck-ready'));
