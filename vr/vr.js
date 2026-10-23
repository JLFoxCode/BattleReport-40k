/* Battle Report 40k – VR / Mixed Reality table setup (Meta Quest 3, WebXR in the Quest browser).
 * A separate "app in the app": served from /vr/ by the online server, opened on the headset with a game code.
 * Shares only the server API (vr/net.js) and the read-only data files (data/rules.js, data/terrain.js) with the app;
 * nothing of the app loads anything from here.
 *
 *  1. Calibrate: touch three table corners with the controller tip (or index finger) → table frame, stored as a
 *     WebXR anchor (persistent when the browser supports it) and in localStorage.
 *  2. Deployment zones, territory line and the 5 objectives of the game's Deployment card on the real table.
 *  3. Terrain planning: GW layouts from data/terrain.js as translucent blocks, move with the trigger, rotate with
 *     the thumbstick, add / remove pieces; custom positions are kept per game on the headset.
 *  4. Deployment helpers: tape measure, range rings, the 9" band around the enemy deployment zone.
 * Without a headset the page shows the same scene as a 3D preview (mouse: drag = orbit, wheel = zoom). */
import * as THREE from 'three';
import { WH } from '../data/rules.js';
import { TERRAIN_LAYOUTS, TERRAIN_KINDS } from '../data/terrain.js';
import { IN, BOARD, frameFromCorners, frameMatrix, packFrame, unpackFrame, snap, onBoard } from './calib.js';
import { PX, paintBoard, rectCorners, pieceAt, layoutPieces, pieceHeight } from './board.js';
import { connect, session as apiSession } from './net.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem('vr.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('vr.' + k); else localStorage.setItem('vr.' + k, JSON.stringify(v)); } catch {} }
};
const colorHex = p => { const c = WH.COLORS[(p && p.color) | 0] || WH.COLORS[0]; return c.d; };

// ---------------------------------------------------------------- app state
const app = {
  code: null, net: null, state: null, status: 'idle',
  frame: null,                 // calibrated table frame (calib.js) – null until calibrated or restored
  calibPts: [],                // corners touched so far
  tool: 'move',                // move | calib | tape | ring
  ringR: 6,
  tapeA: null,
  marks: [],                   // { kind: 'ring' | 'tape', … } on the board texture
  band: 'none', grid: false, mirror: false,
  layoutId: null, pieces: [], selected: -1,
  drag: null,                  // { ctrl, idx, dx, dy } while a piece is held
  xr: { session: null, anchor: null, anchorId: null, mode: null }
};

// ---------------------------------------------------------------- three.js scene
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.02, 50);

const table = new THREE.Group();          // placed by the calibration frame / anchor (metres, right-handed)
table.matrixAutoUpdate = false;
scene.add(table);
const content = new THREE.Group();        // 1 unit = 1 m; local X = board x, Z = board y; mirrored on request
table.add(content);

const W = BOARD[0] * IN, L = BOARD[1] * IN;
const boardCanvas = document.createElement('canvas');
boardCanvas.width = BOARD[0] * PX; boardCanvas.height = BOARD[1] * PX;
const boardTex = new THREE.CanvasTexture(boardCanvas);
boardTex.colorSpace = THREE.SRGBColorSpace;
const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
boardMesh.rotation.x = -Math.PI / 2;
boardMesh.position.set(W / 2, 0.002, L / 2);
content.add(boardMesh);

const objGroup = new THREE.Group(); content.add(objGroup);
const terrainGroup = new THREE.Group(); content.add(terrainGroup);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.4 * IN, 0.6 * IN, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; content.add(hoverRing);
const calibDots = new THREE.Group(); scene.add(calibDots);

// preview only (no headset): a dark floor so the table is visible
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x1b1f27 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, -0.001, L / 2); scene.add(floor);
const floorGrid = new THREE.GridHelper(6, 24, 0x333a48, 0x2a3040); floorGrid.position.set(W / 2, 0, L / 2); scene.add(floorGrid);

function setPreviewFrame() {
  // no calibration: table at the origin of the reference space (preview) – in VR mode also 0.75 m above the floor
  const h = renderer.xr.isPresenting ? 0.75 : 0;
  table.matrix.fromArray([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, h, 0, 1]);
  table.matrixWorldNeedsUpdate = true;
}
setPreviewFrame();

function applyFrame() {
  if (app.frame) table.matrix.fromArray(frameMatrix(app.frame)); else setPreviewFrame();
  table.matrixWorldNeedsUpdate = true;
  floor.visible = floorGrid.visible = !app.frame && app.xr.mode !== 'ar';
}
function applyMirror() {
  content.scale.x = app.mirror ? -1 : 1;
  content.position.x = app.mirror ? W : 0;
}

// ---------------------------------------------------------------- board + objectives + terrain
const objMat = {};
function repaint() {
  const s = app.state;
  const map = s && s.mission && s.mission.deployment ? WH.DEPLOYMENT_MAPS[s.mission.deployment] : null;
  const players = (s && s.players) || [];
  const colors = [colorHex(players[0]), colorHex(players[1])];
  const objectives = s && s.objectives && s.objectives.length ? s.objectives : map ? [
    { pos: map.home.a, name: 'Attacker Home', home: s && s.mission.attacker === 1 ? 1 : 0 },
    { pos: map.home.d, name: 'Defender Home', home: s && s.mission.attacker === 1 ? 0 : 1 },
    { pos: map.exp[0], name: 'Expansion 1' }, { pos: map.exp[1], name: 'Expansion 2' }, { pos: [22, 30], name: 'Centre' }] : [];
  paintBoard(boardCanvas.getContext('2d'), {
    map, attacker: s && s.mission ? s.mission.attacker : null, colors, names: players.map(p => p.name),
    objectives, band: app.band, grid: app.grid, marks: app.marks
  });
  boardTex.needsUpdate = true;

  // objective poles (visible from across the table)
  while (objGroup.children.length) objGroup.remove(objGroup.children[0]);
  for (const ob of objectives) {
    const col = ob.home != null ? colors[ob.home] : '#F2C94C';
    const mat = objMat[col] || (objMat[col] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * IN, 0.25 * IN, 4 * IN, 12), mat);
    pole.position.set(ob.pos[0] * IN, 2 * IN, ob.pos[1] * IN);
    objGroup.add(pole);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.6 * IN, 12, 8), mat);
    top.position.set(ob.pos[0] * IN, 4 * IN, ob.pos[1] * IN);
    objGroup.add(top);
  }
  $('#mission').textContent = s ? [s.mission.deployment || 'No deployment card yet', s.mission.terrainLayout ? 'Terrain: ' + (layoutById(s.mission.terrainLayout) || {}).name : ''].filter(Boolean).join(' · ') : '';
}

const KIND_COLOR = { ruin: 0x8d99ae, wall: 0xc9a86a, crate: 0x7fb069, crater: 0x6b4f3a, wood: 0x3d8b5f };
function buildTerrain() {
  while (terrainGroup.children.length) { const c = terrainGroup.children[0]; terrainGroup.remove(c); }
  app.pieces.forEach((p, i) => {
    const h = pieceHeight(p.kind);
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w * IN, h * IN, p.h * IN),
      new THREE.MeshBasicMaterial({ color: KIND_COLOR[p.kind] || 0x8d99ae, transparent: true, opacity: i === app.selected ? 0.55 : 0.3, side: THREE.DoubleSide, depthWrite: false }));
    box.position.y = h * IN / 2;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: i === app.selected ? 0xffffff : 0xdde3ea, transparent: true, opacity: 0.9 }));
    edges.position.y = h * IN / 2;
    g.add(box, edges);
    g.position.set(p.x * IN, 0, p.y * IN);
    g.rotation.y = -(p.rot || 0) * Math.PI / 180;
    g.userData.idx = i;
    terrainGroup.add(g);
  });
  $('#pieces').textContent = app.pieces.length ? app.pieces.length + ' pieces' + (app.selected >= 0 ? ' · selected: ' + describe(app.pieces[app.selected]) : '') : 'No terrain';
}
const describe = p => `${TERRAIN_KINDS[p.kind] || p.kind} ${p.w}"×${p.h}" @ ${p.x.toFixed(1)}/${p.y.toFixed(1)} ${p.rot | 0}°`;
const layoutById = id => TERRAIN_LAYOUTS.find(t => t.id === id) || null;

function saveTerrain() { if (app.code) store.set('terrain.' + app.code, { layout: app.layoutId, pieces: app.pieces }); }
function setLayout(id, { fromState = false } = {}) {
  app.layoutId = id || null;
  app.pieces = layoutPieces(layoutById(id));
  app.selected = -1;
  buildTerrain(); saveTerrain();
  $('#layout').value = id || '';
  if (!fromState && app.net && app.state && app.state.stage !== 'over') {
    app.net.dispatch({ type: 'mission.set', terrainLayout: id || null }).catch(e => toast(e.message));
  }
}
function selectPiece(i) { app.selected = i; buildTerrain(); }
function addPiece(w, h, kind = 'ruin') {
  app.pieces.push({ id: 'c' + Date.now().toString(36), kind, x: 22, y: 30, w, h, rot: 0 });
  selectPiece(app.pieces.length - 1); saveTerrain();
}
function removeSelected() { if (app.selected < 0) return; app.pieces.splice(app.selected, 1); app.selected = -1; buildTerrain(); saveTerrain(); }
function rotateSelected(deg) { const p = app.pieces[app.selected]; if (!p) return; p.rot = ((p.rot || 0) + deg + 360) % 360; buildTerrain(); saveTerrain(); }

// ---------------------------------------------------------------- pointing at the table
const _ray = new THREE.Ray(), _inv = new THREE.Matrix4(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
/** World ray → board inches { x, y } or null. */
function boardHit(origin, dir) {
  content.updateWorldMatrix(true, false);
  _inv.copy(content.matrixWorld).invert();
  _ray.origin.copy(origin); _ray.direction.copy(dir);
  _ray.applyMatrix4(_inv);
  if (!_ray.intersectPlane(_plane, _hit)) return null;
  return { x: _hit.x / IN, y: _hit.z / IN };
}
/** World point → board inches (height above the table in z). */
function boardPoint(p) {
  content.updateWorldMatrix(true, false);
  const v = p.clone().applyMatrix4(_inv.copy(content.matrixWorld).invert());
  return { x: v.x / IN, y: v.z / IN, z: v.y / IN };
}

function pressAt(hit, src) {
  if (!hit) return;
  if (app.tool === 'tape') {
    if (!app.tapeA) { app.tapeA = [hit.x, hit.y]; toast('Tape: tap the second point'); }
    else { app.marks.push({ kind: 'tape', a: app.tapeA, b: [hit.x, hit.y] }); app.tapeA = null; repaint(); }
    return;
  }
  if (app.tool === 'ring') { app.marks.push({ kind: 'ring', x: hit.x, y: hit.y, r: app.ringR }); repaint(); return; }
  // move: grab a piece
  const i = pieceAt(app.pieces, hit);
  selectPiece(i);
  if (i >= 0) app.drag = { src, idx: i, dx: app.pieces[i].x - hit.x, dy: app.pieces[i].y - hit.y };
}
function dragTo(hit) {
  const d = app.drag; if (!d || !hit) return;
  const p = app.pieces[d.idx]; if (!p) return;
  p.x = snap(hit.x + d.dx, 0.5); p.y = snap(hit.y + d.dy, 0.5);
  const g = terrainGroup.children[d.idx]; if (g) g.position.set(p.x * IN, 0, p.y * IN);
}
function release() { if (app.drag) { app.drag = null; buildTerrain(); saveTerrain(); } }

// ---------------------------------------------------------------- calibration
function calibTap(worldPos) {
  app.calibPts.push({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4ad6ff }));
  dot.position.copy(worldPos); calibDots.add(dot);
  const n = app.calibPts.length;
  if (n < 3) { setCalibText(n); return; }
  const f = frameFromCorners(app.calibPts[0], app.calibPts[1], app.calibPts[2]);
  calibDots.clear();
  app.calibPts = [];
  if (!f) { toast('The first two corners are too close together – start again'); setCalibText(0); return; }
  app.frame = f;
  store.set('frame', packFrame(f));
  applyFrame();
  createAnchor().catch(() => {});
  app.tool = 'move'; syncTools();
  $('#calib-info').textContent = `Calibrated · Attacker's edge measured ${f.edge.toFixed(1)}" (expected 44")`;
  toast(`Table calibrated – edge ${f.edge.toFixed(1)}"`);
}
function setCalibText(n) {
  const steps = ['Stand at the Attacker\'s edge. Touch the corner on your RIGHT with the controller tip and press the trigger.',
    'Now the corner on your LEFT (the other end of the Attacker\'s edge).',
    'Now any corner of the Defender\'s edge (the far side).'];
  $('#calib-info').textContent = `Step ${n + 1} of 3 – ${steps[n]}`;
}
function startCalibration() {
  app.calibPts = []; calibDots.clear(); app.frame = null; app.xr.anchor = null;
  store.set('frame', null); store.set('anchor', null);
  applyFrame();
  app.tool = 'calib'; syncTools(); setCalibText(0);
}
async function createAnchor() {
  const s = app.xr.session, xrFrame = renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  if (!s || !xrFrame || !ref || typeof xrFrame.createAnchor !== 'function' || !app.frame) return;
  const f = app.frame;
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.ex.x, f.ex.y, f.ex.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.ey.x, f.ey.y, f.ey.z));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const anchor = await xrFrame.createAnchor(new XRRigidTransform(f.origin, { x: q.x, y: q.y, z: q.z, w: q.w }), ref);
  app.xr.anchor = anchor;
  if (typeof anchor.requestPersistentHandle === 'function') {
    try { app.xr.anchorId = await anchor.requestPersistentHandle(); store.set('anchor', app.xr.anchorId); } catch {}
  }
}
async function restoreAnchor(session) {
  const id = store.get('anchor', null);
  if (!id || typeof session.restorePersistentAnchor !== 'function') return false;
  try { app.xr.anchor = await session.restorePersistentAnchor(id); app.xr.anchorId = id; return true; } catch { store.set('anchor', null); return false; }
}

// ---------------------------------------------------------------- XR input
const controllers = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  ray.scale.z = 2; c.add(ray);
  c.userData.i = i;
  c.addEventListener('selectstart', () => onSelectStart(i));
  c.addEventListener('selectend', () => release());
  c.addEventListener('connected', e => { c.userData.source = e.data; });
  c.addEventListener('disconnected', () => { c.userData.source = null; });
  scene.add(c);
  const hand = renderer.xr.getHand(i);
  scene.add(hand);
  return { c, hand, stick: 0 };
});
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function ctrlRay(i) {
  const c = controllers[i].c;
  c.updateWorldMatrix(true, false);
  _o.setFromMatrixPosition(c.matrixWorld);
  _d.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion())).normalize();
  return { origin: _o, dir: _d };
}
/** Where the controller tip / index finger is (world). */
function tipPos(i) {
  const { hand, c } = controllers[i];
  const j = hand && hand.joints && hand.joints['index-finger-tip'];
  if (j && j.visible !== false && j.matrixWorld) return new THREE.Vector3().setFromMatrixPosition(j.matrixWorld);
  return new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
}
function onSelectStart(i) {
  if (app.tool === 'calib') { calibTap(tipPos(i)); return; }
  const r = ctrlRay(i);
  pressAt(boardHit(r.origin, r.dir), i);
}
function pollGamepads() {
  const s = app.xr.session; if (!s) return;
  for (const src of s.inputSources) {
    const gp = src.gamepad; if (!gp) continue;
    const idx = src.handedness === 'left' ? 0 : 1;
    const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
    const st = controllers[idx];
    if (Math.abs(ax) > 0.7 && st.stick === 0) { st.stick = Math.sign(ax); if (app.selected >= 0) rotateSelected(15 * st.stick); }
    else if (Math.abs(ax) < 0.3) st.stick = 0;
    // B / Y (buttons[5]) deletes the held / selected piece
    const b = gp.buttons[5];
    if (b && b.pressed && !st.btn5) { st.btn5 = true; if (app.selected >= 0 && app.tool === 'move') removeSelected(); }
    else if (b && !b.pressed) st.btn5 = false;
  }
}

// ---------------------------------------------------------------- mouse preview (no headset)
const mouse = { down: false, orbit: false, lx: 0, ly: 0, theta: -0.4, phi: 1.0, dist: 2.4 };
const rc = new THREE.Raycaster();
function mouseRay(e) {
  const r = canvas.getBoundingClientRect();
  rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return { origin: rc.ray.origin, dir: rc.ray.direction };
}
function placeCamera() {
  if (renderer.xr.isPresenting) return;
  const cx = W / 2, cz = L / 2;
  camera.position.set(cx + mouse.dist * Math.sin(mouse.phi) * Math.sin(mouse.theta), mouse.dist * Math.cos(mouse.phi), cz + mouse.dist * Math.sin(mouse.phi) * Math.cos(mouse.theta));
  camera.lookAt(cx, 0, cz);
}
canvas.addEventListener('pointerdown', e => {
  if (renderer.xr.isPresenting) return;
  canvas.setPointerCapture(e.pointerId);
  mouse.down = true; mouse.lx = e.clientX; mouse.ly = e.clientY;
  const r = mouseRay(e), hit = boardHit(r.origin, r.dir);
  if (app.tool === 'calib') { toast('Calibration needs the headset – in the preview the table sits at the origin'); return; }
  const before = app.drag;
  pressAt(hit, 'mouse');
  mouse.orbit = !app.drag && !before && app.tool === 'move';
});
canvas.addEventListener('pointermove', e => {
  if (renderer.xr.isPresenting) return;
  const r = mouseRay(e), hit = boardHit(r.origin, r.dir);
  hoverRing.visible = !!hit && onBoard(hit); if (hit) hoverRing.position.set(hit.x * IN, 0.003, hit.y * IN);
  if (!mouse.down) return;
  if (app.drag) { dragTo(hit); return; }
  if (mouse.orbit) {
    mouse.theta -= (e.clientX - mouse.lx) * 0.006; mouse.phi = Math.min(1.5, Math.max(0.15, mouse.phi - (e.clientY - mouse.ly) * 0.006));
    mouse.lx = e.clientX; mouse.ly = e.clientY; placeCamera();
  }
});
canvas.addEventListener('pointerup', () => { mouse.down = false; mouse.orbit = false; release(); });
canvas.addEventListener('wheel', e => { mouse.dist = Math.min(6, Math.max(0.6, mouse.dist * (e.deltaY > 0 ? 1.1 : 0.9))); placeCamera(); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') rotateSelected(e.shiftKey ? -15 : 15);
  if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
  if (e.key === 'Escape') { selectPiece(-1); }
});
addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- render loop
renderer.setAnimationLoop(() => {
  const xrFrame = renderer.xr.getFrame();
  if (xrFrame && app.xr.anchor) {
    const pose = xrFrame.getPose(app.xr.anchor.anchorSpace, renderer.xr.getReferenceSpace());
    if (pose) { table.matrix.fromArray(pose.transform.matrix); table.matrixWorldNeedsUpdate = true; }
  }
  if (renderer.xr.isPresenting) {
    pollGamepads();
    let hover = null;
    for (let i = 0; i < 2; i++) {
      const src = controllers[i].c.userData.source; if (!src) continue;
      const r = ctrlRay(i), hit = boardHit(r.origin, r.dir);
      if (app.drag && app.drag.src === i) dragTo(hit);
      if (hit && onBoard(hit)) hover = hit;
    }
    hoverRing.visible = !!hover && app.tool !== 'calib';
    if (hover) hoverRing.position.set(hover.x * IN, 0.003, hover.y * IN);
  } else placeCamera();
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------- XR session
async function enterXR() {
  if (!navigator.xr) { toast('WebXR is not available in this browser'); return; }
  const ui = $('#ui');
  const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const mode = ar ? 'immersive-ar' : 'immersive-vr';
  let session;
  try {
    session = await navigator.xr.requestSession(mode, {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['dom-overlay', 'hand-tracking', 'anchors', 'hit-test', 'bounded-floor'],
      domOverlay: { root: ui }
    });
  } catch (e) { toast('Could not start the XR session: ' + (e && e.message ? e.message : e)); return; }
  app.xr.session = session; app.xr.mode = ar ? 'ar' : 'vr';
  document.body.dataset.xr = app.xr.mode;
  session.addEventListener('end', () => {
    app.xr.session = null; app.xr.anchor = null; app.xr.mode = null; delete document.body.dataset.xr;
    applyFrame(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    $('#enter').textContent = 'Enter headset';
  });
  await renderer.xr.setSession(session);
  $('#enter').textContent = 'Leave';
  applyFrame();
  if (await restoreAnchor(session)) toast('Table position restored from the last session');
  else if (app.frame) toast('Table position from the last calibration – recalibrate if it does not fit');
  else { startCalibration(); toast('Calibrate the table first'); }
}

// ---------------------------------------------------------------- UI
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3500);
}
function syncTools() {
  $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === app.tool));
  $$('[data-ring]').forEach(b => b.classList.toggle('on', Number(b.dataset.ring) === app.ringR && app.tool === 'ring'));
  $('#band').classList.toggle('on', app.band === 'infiltrate');
  $('#grid').classList.toggle('on', app.grid);
  $('#mirror').classList.toggle('on', app.mirror);
  $('#calib-panel').hidden = app.tool !== 'calib';
}
function setStatus(s) {
  app.status = s;
  const el = $('#status');
  el.dataset.s = s;
  el.textContent = { online: 'Connected', reconnecting: 'Reconnecting…', offline: 'No connection', login: 'Sign in required', notfound: 'Game not found', idle: 'No game' }[s] || s;
  $('#login').hidden = s !== 'login';
}
function onState(s) {
  app.state = s;
  $('#players').textContent = s.players.map(p => p.name).join(' vs ');
  const id = s.mission && s.mission.terrainLayout ? s.mission.terrainLayout : null;
  if (id !== app.layoutId) {
    const saved = store.get('terrain.' + app.code, null);
    if (saved && saved.layout === id && Array.isArray(saved.pieces)) { app.layoutId = id; app.pieces = saved.pieces; app.selected = -1; buildTerrain(); $('#layout').value = id || ''; }
    else setLayout(id, { fromState: true });
  }
  repaint();
}
function openGame(code) {
  code = String(code || '').trim().toUpperCase();
  if (app.net) { app.net.close(); app.net = null; }
  app.code = code || null; app.state = null; app.marks = []; app.layoutId = null; app.pieces = []; app.selected = -1;
  $('#code').value = code;
  if (!code) { setStatus('idle'); repaint(); buildTerrain(); return; }
  store.set('code', code);
  location.hash = '#/g/' + code;
  setStatus('offline');
  app.net = connect(code, { onState, onStatus: setStatus });
  const saved = store.get('terrain.' + code, null);
  if (saved && Array.isArray(saved.pieces)) { app.layoutId = saved.layout || null; app.pieces = saved.pieces; buildTerrain(); $('#layout').value = app.layoutId || ''; }
  repaint();
}

function initUi() {
  const sel = $('#layout');
  sel.innerHTML = '<option value="">No terrain layout</option>' + TERRAIN_LAYOUTS.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  sel.addEventListener('change', () => setLayout(sel.value || null));
  const ui = $('#ui');
  ui.addEventListener('beforexrselect', e => e.preventDefault());     // taps on the overlay are not table taps
  ui.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset;
    if (a.tool) { app.tool = a.tool; app.tapeA = null; if (a.tool === 'calib') startCalibration(); }
    else if (a.ring) { app.tool = 'ring'; app.ringR = Number(a.ring); }
    else if (a.add) { const [w, h] = a.add.split('x').map(Number); addPiece(w, h, a.kind || 'ruin'); }
    else if (a.act === 'rotl') rotateSelected(-15);
    else if (a.act === 'rotr') rotateSelected(15);
    else if (a.act === 'del') removeSelected();
    else if (a.act === 'reset') setLayout(app.layoutId, { fromState: true });
    else if (a.act === 'clear') { app.marks = []; app.tapeA = null; repaint(); }
    else if (a.act === 'band') app.band = app.band === 'infiltrate' ? 'none' : 'infiltrate';
    else if (a.act === 'grid') app.grid = !app.grid;
    else if (a.act === 'mirror') { app.mirror = !app.mirror; applyMirror(); }
    else if (a.act === 'enter') { if (app.xr.session) app.xr.session.end(); else enterXR(); }
    else if (a.act === 'open') openGame($('#code').value);
    else if (a.act === 'panel') { const p = $('#panels'); p.hidden = !p.hidden; b.textContent = p.hidden ? 'Menu' : 'Hide'; }
    syncTools(); repaint();
  });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') openGame(e.target.value); });
  syncTools();
}

async function main() {
  initUi();
  app.frame = unpackFrame(store.get('frame', null));
  applyFrame(); applyMirror();
  if (app.frame) $('#calib-info').textContent = `Last calibration: edge ${app.frame.edge.toFixed(1)}" – stored on this headset`;
  const xrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  $('#enter').hidden = !(xrOk || vrOk);
  $('#xr-note').textContent = xrOk ? 'Mixed reality (passthrough) available' : vrOk ? 'VR available (no passthrough – the table is shown at 75 cm height)' : 'No headset detected – 3D preview. Open this page in the Meta Quest browser.';
  const ses = await apiSession();
  if (ses && ses.user) $('#user').textContent = ses.user;
  const m = location.hash.match(/#\/g\/([A-Z0-9]{3,8})/i);
  openGame(m ? m[1] : store.get('code', ''));
  buildTerrain(); repaint();
}
main();
