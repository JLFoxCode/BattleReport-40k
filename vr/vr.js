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
import * as THREE from './vendor/three.module.min.js';   // no import map: the online server's CSP allows no inline scripts
import { WH } from '../data/rules.js';
import { TERRAIN_KINDS } from '../data/terrain.js';
import { LAYOUTS11, PARTS11, DISPOSITIONS11, VARIANTS11, findLayout11 } from '../data/layouts11.js';
import { IN, BOARD, frameFromCorners, frameMatrix, packFrame, unpackFrame, snap, onBoard } from './calib.js';
import { PX, paintBoard, rectCorners, pieceAt, layoutPieces, pieceHeight } from './board.js';
import { connect, session as apiSession, listGames } from './net.js';
import { Panel, Hud } from './panel.js';
import { createCamera } from './camera.js';
import { generate as generateLayout } from './layoutgen.js';
import { guessLayout, solveAll, fromRT, toRT, apply as mApply, fitPlane, setMarkerScale } from './markercal.js';

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
  tool: 'move',                // move | calib | tape | ring | capture
  ringR: 6,
  base: 0,                     // tape / rings measure from the tapped point
  tapeA: null,
  capPts: [],                  // corners of a real terrain piece touched so far (capture tool)
  marks: [],                   // { kind: 'ring' | 'tape', … } on the board texture
  band: 'none', grid: false, mirror: false,
  layoutId: null, pieces: [], selected: -1,
  drag: null,                  // { ctrl, idx, dx, dy } while a piece is held
  xr: { session: null, anchor: null, anchorId: null, mode: null },
  step: 0.01,                  // fine adjustment step in metres (1 cm / 1 mm)
  mcal: null,                  // running marker calibration { obs, ids, lastT, lastHead, t0 }
  mtrack: false,               // live marker tracking (re-solves the table pose from every still camera frame)
  camcal: store.get('camcal', null),   // { f, X } – this headset's camera: focal length + head→camera transform
  markers: store.get('markers', null), // { [id]: { corner, turn } } – where the printed sheets lie
  Y: null,                     // table pose (table → world, 4×4) when known from markers
  board: 'full',               // 'full' = Strike Force 44×60 | 'near' / 'far' = one Incursion 44×30 half | 'both' = two Incursion games on one table
  editHalf: 'near',            // with 'both': the half that terrain tools, card and attacker apply to
  halves: Object.assign({ near: { deployment: null, attacker: 0 }, far: { deployment: null, attacker: 0 } }, store.get('halves', {})),
  markerScale: store.get('markerScale', 1),  // print scale of the corner sheets: 1 = 10×15 at 100 %, 1.98 = fitted onto A4
  // play aid without a game: deployment card, attacker and layout chosen here and kept on the headset
  local: Object.assign({ mission: { deployment: null, attacker: 0, terrainLayout: null, dispA: 'Take and Hold', dispD: 'Take and Hold', variant: 'A', layout11: null }, players: [{ name: 'Player 1', color: 0 }, { name: 'Player 2', color: 1 }], objectives: [], stage: 'setup' }, store.get('local', {})),
  track: 'room',               // room: the table follows its WebXR anchor | local: fixed in the reference space
  scan: true,                  // show the planes of the room scan (plane-detection)
  planes: []                   // detected planes { label, y, corners: [{x, y, z}] } (world), refreshed every ~0.5 s
};

/** What the overlay shows: the connected game, else the local choices. */
const cur = () => app.state || app.local;
const saveLocal = () => store.set('local', { mission: app.local.mission });

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
boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.generateMipmaps = false; boardTex.minFilter = THREE.LinearFilter;
const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
boardMesh.rotation.x = -Math.PI / 2;
boardMesh.position.set(W / 2, 0.002, L / 2);
content.add(boardMesh);

const objGroup = new THREE.Group(); content.add(objGroup);
const terrainGroup = new THREE.Group(); content.add(terrainGroup);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.4 * IN, 0.6 * IN, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; content.add(hoverRing);
const calibDots = new THREE.Group(); scene.add(calibDots);

// in-headset UI: 3D panel (no dom-overlay in the Quest browser) + HUD text in front of the camera
/** One button per layout (by name), four per row. */
/** The 11th-edition Event Companion layout in use (local play aid): chosen by the two Force Dispositions + A/B/C. */
const eventLayout = () => (!app.state && app.local.mission.layout11) ? LAYOUTS11.find(l => l.id === app.local.mission.layout11) || null : null;
const dispRow = (key, who) => ({ tab: 'mission', key, buttons: DISPOSITIONS11.map(n => ({ label: n, a: { [who]: n } })) });
function refreshLayoutRows() { /* layouts are chosen in the Mission tab now */ }
const panel = new Panel(THREE, {
  tabs: [{ id: 'table', label: 'Table' }, { id: 'mission', label: 'Mission' }, { id: 'terrain', label: 'Terrain' }, { id: 'deploy', label: 'Deploy' }, { id: 'camera', label: 'Camera' }, { id: 'system', label: 'System' }],
  rows: [
    // Mission: pick the game, then its Deployment card (zones + objectives on the table)
    { tab: 'mission', title: 'Game' },
    { tab: 'mission', key: 'games', buttons: [{ label: 'Loading games…', a: { act: 'games' } }] },
    { tab: 'mission', title: 'Event layout (11th ed. Event Companion): Attacker\'s Force Disposition' },
    dispRow('dispA', 'dispA'),
    { tab: 'mission', title: 'Defender\'s Force Disposition' },
    dispRow('dispD', 'dispD'),
    { tab: 'mission', buttons: [{ label: 'Layout A', a: { variant: 'A' } }, { label: 'Layout B', a: { variant: 'B' } }, { label: 'Layout C', a: { variant: 'C' } }, { label: 'Apply event layout', a: { act: 'applyLayout11' }, w: 1.6 }, { label: 'Clear', a: { act: 'clearLayout11' } }] },
    { tab: 'mission', title: 'Pick-up game instead: deployment card of the mission deck' },
    { tab: 'mission', buttons: WH.DEPLOYMENTS.slice(0, 3).map(n => ({ label: n, a: { deployment: n } })) },
    { tab: 'mission', buttons: WH.DEPLOYMENTS.slice(3, 6).map(n => ({ label: n, a: { deployment: n } })) },
    { tab: 'mission', title: 'Attacker' },
    { tab: 'mission', buttons: [{ label: 'Player 1 attacks', a: { attacker: 0 } }, { label: 'Player 2 attacks', a: { attacker: 1 } }] },
    // Table: calibration, fine adjustment, tracking
    { tab: 'table', title: 'Calibration: point the ray at three table corners (right, left, far) and press the trigger' },
    { tab: 'table', buttons: [{ label: 'Calibrate (3 corners)', a: { tool: 'calib' }, w: 1.6 }, { label: 'Recall saved table', a: { act: 'recall' }, w: 1.2 }, { label: 'Mirror', a: { act: 'mirror' } }, { label: 'Room scan', a: { act: 'scan' } }] },
    { tab: 'table', title: 'Battlefield' },
    { tab: 'table', buttons: [{ label: 'Strike Force 44\u00d760', a: { act: 'board', v: 'full' }, w: 1.3 }, { label: 'Incursion near', a: { act: 'board', v: 'near' } }, { label: 'Incursion far', a: { act: 'board', v: 'far' } }, { label: '2\u00d7 Incursion (both)', a: { act: 'board', v: 'both' }, w: 1.3 }] },
    { tab: 'table', buttons: [{ label: 'Edit: near field', a: { act: 'editHalf', v: 'near' }, w: 1.2 }, { label: 'Edit: far field', a: { act: 'editHalf', v: 'far' }, w: 1.2 }] },
    { tab: 'table', title: 'Fine adjustment' },
    { tab: 'table', buttons: [{ label: 'Step 1 cm', a: { act: 'step', v: 0.01 } }, { label: 'Step 1 mm', a: { act: 'step', v: 0.001 } }, { label: '↑ up', a: { act: 'nudge', v: 'z+' } }, { label: '↓ down', a: { act: 'nudge', v: 'z-' } }] },
    { tab: 'table', buttons: [{ label: '← x', a: { act: 'nudge', v: 'x-' } }, { label: 'x →', a: { act: 'nudge', v: 'x+' } }, { label: '← y', a: { act: 'nudge', v: 'y-' } }, { label: 'y →', a: { act: 'nudge', v: 'y+' } }, { label: '⟲ 0.5°', a: { act: 'nudge', v: 'r-' } }, { label: '⟳ 0.5°', a: { act: 'nudge', v: 'r+' } }] },
    { tab: 'table', title: 'Tracking' },
    { tab: 'table', buttons: [{ label: 'Room anchor', a: { act: 'track', v: 'room' } }, { label: 'Local (fixed)', a: { act: 'track', v: 'local' } }, { label: '6" grid', a: { act: 'grid' } }] },
    // Terrain
    { tab: 'terrain', title: 'Layout (✓ = recommended for the chosen deployment card)' },
    { tab: 'terrain', buttons: [{ label: 'Terrain of the event layout', a: { act: 'reset' }, w: 1.5 }, { label: 'No terrain', a: { layout: '' } }, { label: 'Capture piece', a: { tool: 'capture' }, w: 1.3 }] },
    { tab: 'terrain', title: 'Random layout, 11th ed. style: point-symmetric, every objective inside a terrain area, sightlines broken' },
    { tab: 'terrain', buttons: [{ label: 'Generate random layout', a: { act: 'gen' }, w: 1.6 }, { label: 'Re-roll', a: { act: 'gen' } }, { label: '★ Favourite', a: { act: 'fav' } }] },
    { tab: 'terrain', title: 'Recent random layouts (tap = restore exactly)' },
    { tab: 'terrain', key: 'recent', buttons: [{ label: 'none yet', a: { act: 'noop' }, w: 3 }] },
    { tab: 'terrain', title: 'Favourites' },
    { tab: 'terrain', key: 'favs', buttons: [{ label: 'none yet', a: { act: 'noop' }, w: 3 }] },
    { tab: 'terrain', title: 'Pieces (trigger: grab & move, twist: rotate, B/Y: delete)' },
    { tab: 'terrain', buttons: [{ label: 'Move', a: { tool: 'move' } }, { label: '⟲ 15°', a: { act: 'rotl' } }, { label: '⟳ 15°', a: { act: 'rotr' } }, { label: 'Delete', a: { act: 'del' } }] },
    { tab: 'terrain', buttons: [{ label: '+ 6×4', a: { add: '6x4' } }, { label: '+ 10×5', a: { add: '10x5' } }, { label: '+ 12×6', a: { add: '12x6' } }, { label: '+ crater', a: { add: '6x6', kind: 'crater' } }, { label: '+ wall', a: { add: '6x1', kind: 'wall' } }] },
    // Deployment helpers
    { tab: 'deploy', title: 'Tape = distance between two points · rings = range from a point' },
    { tab: 'deploy', buttons: [{ label: '9" band', a: { act: 'band' } }, { label: 'Tape', a: { tool: 'tape' } }, { label: 'Clear marks', a: { act: 'clear' } }] },
    { tab: 'deploy', buttons: [{ label: '3" ring', a: { ring: 3 } }, { label: '6" ring', a: { ring: 6 } }, { label: '9" ring', a: { ring: 9 } }, { label: '12" ring', a: { ring: 12 } }] },
    // Camera: passthrough camera + corner markers (vr/print/table-markers-10x15.pdf)
    { tab: 'camera', title: 'Experimental: marker calibration (camera, printed corner sheets)' },
    { tab: 'camera', buttons: [{ label: 'Marker calibration', a: { act: 'mcal' }, w: 1.4 }, { label: 'Finish now', a: { act: 'mcalDone' } }, { label: 'Cancel', a: { act: 'mcalCancel' } }, { label: 'Tracking', a: { act: 'mtrack' } }] },
    { tab: 'camera', title: 'Passthrough camera' },
    { tab: 'camera', buttons: [{ label: 'Camera on', a: { act: 'cam', v: 'on' } }, { label: 'Camera off', a: { act: 'cam', v: 'off' } }] },
    { tab: 'camera', buttons: [{ label: 'Forget camera calibration', a: { act: 'camReset' }, w: 1.5 }] },
    { tab: 'camera', title: 'Corner sheets printed as (black square / centre from the corner)' },
    { tab: 'camera', buttons: [{ label: '10×15 at 100 % (5.25 cm / 5 cm)', a: { act: 'mscale', v: 1 }, w: 1.4 }, { label: 'Fitted on A4 (10.4 cm / 9.9 cm)', a: { act: 'mscale', v: 1.98 }, w: 1.4 }] },
    { tab: 'camera', buttons: [{ label: 'Square − 5 mm', a: { act: 'mscaleStep', v: -5 } }, { label: 'Square + 5 mm', a: { act: 'mscaleStep', v: 5 } }] },
    // System
    { tab: 'system', title: 'Panel & session' },
    { tab: 'system', buttons: [{ label: 'Panel here', a: { act: 'panel' } }, { label: 'Undo', a: { act: 'undo' } }, { label: 'Leave headset', a: { act: 'enter' } }] }
  ]
}, { width: 0.55 });
panel.mesh.visible = false;
scene.add(panel.mesh);
panel.setState(a => (a.tool && a.tool === app.tool) || (a.ring && app.tool === 'ring' && a.ring === app.ringR)
  || (a.act === 'band' && app.band === 'infiltrate') || (a.act === 'grid' && app.grid) || (a.act === 'mirror' && app.mirror)
  || (a.act === 'track' && a.v === app.track) || (a.act === 'scan' && app.scan) || (a.act === 'step' && a.v === app.step)
  || (a.base !== undefined && Number(a.base) === app.base)
  || (a.act === 'cam' && ((a.v === 'on') === cam.state().on))
  || (a.act === 'mcal' && !!app.mcal) || (a.act === 'mtrack' && app.mtrack) || (a.act === 'board' && a.v === app.board) || (a.act === 'editHalf' && a.v === app.editHalf)
  || (a.act === 'mscale' && Math.abs(Number(a.v) - app.markerScale) < 0.02)
  || (a.layout !== undefined && (a.layout || null) === app.layoutId)
  || (a.open !== undefined && a.open === app.code)
  || (a.dispA !== undefined && app.local.mission.dispA === a.dispA) || (a.dispD !== undefined && app.local.mission.dispD === a.dispD) || (a.variant !== undefined && app.local.mission.variant === a.variant)
  || (a.deployment !== undefined && (app.board === 'both' ? app.halves[app.editHalf].deployment : cur().mission.deployment) === a.deployment)
  || (a.attacker !== undefined && (app.board === 'both' ? app.halves[app.editHalf].attacker : cur().mission.attacker) === a.attacker));
const hud = new Hud(THREE, { width: 0.5 });
hud.mesh.position.set(0, -0.17, -0.7);
camera.add(hud.mesh);
scene.add(camera);
let toastText = '', toastUntil = 0, noteText = '';
// room scan (WebXR plane-detection): outlines of the detected planes, the table's corners snap the calibration taps
const planeGroup = new THREE.Group(); scene.add(planeGroup);
const planeMat = { table: new THREE.LineBasicMaterial({ color: 0x4ad6ff }), other: new THREE.LineBasicMaterial({ color: 0x8d99ae, transparent: true, opacity: 0.5 }) };
let planesAt = 0;
const isTable = l => /table|desk/i.test(l || '');
function readPlanes(xrFrame) {
  const ref = renderer.xr.getReferenceSpace();
  const set = xrFrame.detectedPlanes;
  app.planesDebug = { has: 'detectedPlanes' in xrFrame, size: set ? set.size : null, meshes: xrFrame.detectedMeshes ? xrFrame.detectedMeshes.size : null };
  if (!set || !ref || performance.now() - planesAt < 500) return;
  planesAt = performance.now();
  const out = [];
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const pl of set) {
    const pose = xrFrame.getPose(pl.planeSpace, ref);
    if (!pose || !pl.polygon || pl.polygon.length < 3) continue;
    m.fromArray(pose.transform.matrix);
    const corners = pl.polygon.map(p => { v.set(p.x, 0, p.z).applyMatrix4(m); return { x: v.x, y: v.y, z: v.z }; });
    out.push({ label: pl.semanticLabel || '', orientation: pl.orientation, y: corners.reduce((s, c) => s + c.y, 0) / corners.length, corners });
  }
  app.planes = out;
  planeGroup.clear();
  if (app.scan) for (const p of out) {
    if (p.orientation !== 'horizontal' && !isTable(p.label)) continue;
    const pts = p.corners.map(c => new THREE.Vector3(c.x, c.y + 0.004, c.z));
    planeGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), isTable(p.label) ? planeMat.table : planeMat.other));
  }
}
const scannedTable = () => app.planes.find(p => isTable(p.label)) || null;
/** A calibration tap near the scanned table: height from the scan, xz snapped to the nearest scanned corner (<= 12 cm). */
function snapToScan(p) {
  const t = scannedTable(); if (!t) return { p, snapped: false };
  const q = { x: p.x, y: t.y, z: p.z };
  let best = null, bd = 0.12;
  for (const c of t.corners) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
  if (best) { q.x = best.x; q.z = best.z; }
  return { p: q, snapped: !!best };
}
// passthrough camera + marker detection (vr/camera.js); frames are consumed by the marker calibration (later)
const cam = createCamera({ onFrame: f => { app.camFrame = f; } });
/** Put the panel 0.75 m in front of the head, a little below eye level, facing the user. */
function placePanel() {
  const pos = new THREE.Vector3(), dir = new THREE.Vector3();
  camera.getWorldPosition(pos); camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  panel.mesh.position.copy(pos).addScaledVector(dir, 0.75); panel.mesh.position.y -= 0.12;
  panel.mesh.lookAt(pos.x, panel.mesh.position.y, pos.z);
  panel.mesh.visible = true;
}
function hudRefresh() {
  const now = performance.now();
  const lines = [];
  if (noteText) lines.push({ text: noteText, big: true, color: '#4ad6ff' });
  if (app.tool === 'calib') {
    lines.push({ text: $('#calib-info').textContent, color: '#ffd966' });
    const t = scannedTable();
    lines.push({ text: t ? `Room scan: table found (${t.corners.length} corners) - taps snap to its corners and height` : 'Room scan: no table in the scan - taps use the controller position' });
  }
  else if (app.tool === 'capture') lines.push({ text: 'Capture: touch the corners of the real piece (' + app.capPts.length + '/3)', color: '#ffd966' });
  if (toastText && now < toastUntil) lines.push({ text: toastText });
  if (app.mcal) {
    const m = app.mcal;
    const need = m.ids.size < 2 ? 'Look at another corner sheet.' : m.views.length < 3 ? 'Now step to another spot and look at a sheet again.' : m.obs.length < 8 ? 'Hold still on a sheet for a moment.' : 'Enough for a result – keep going for accuracy or press Finish now.';
    lines.push({ text: `In view now: ${m.inView.length ? m.inView.map(i => 'sheet ' + (i + 1)).join(', ') : 'no marker'}`, big: true, color: m.inView.length ? '#7fe3a0' : '#ffd966' });
    lines.push({ text: `Collected: sheets ${Array.from(m.ids).map(i => i + 1).join(', ') || '–'} (${m.ids.size}/2+) · frames ${m.obs.length}/8+ · viewpoints ${m.views.length}/3+ · sheet scale ${app.markerScale.toFixed(2)}` });
    lines.push({ text: need + ' Look at the sheets from above (40-80 cm). Also step back once so that TWO sheets are in view together.', color: '#ffd966' });
  } else if (app.mtrack) lines.push({ text: 'Marker tracking on', color: '#9ef' });
  const cs = cam.state();
  if (cs.on) lines.push({ text: `Camera ${cs.w}×${cs.h} · ${cs.fps} fps · markers: ${cs.markers.length ? cs.markers.map(m => m.id + 1).join(', ') : 'none'}` + (cs.error ? ' · ' + cs.error : ''), color: '#9ef' });
  const st = cur();
  if (!noteText && app.tool !== 'calib' && app.board === 'both') {
    const near = app.halves.near, far = app.halves.far;
    lines.push({ text: `Near field: ${near.deployment || 'no card'} \u00b7 Far field: ${far.deployment || 'no card'} \u00b7 editing: ${app.editHalf}`, color: '#9aa3b2' });
  } else if (!noteText && app.tool !== 'calib') {
    const L = eventLayout();
    const head = L ? `${L.attacker.disposition} vs ${L.defender.disposition} · Layout ${L.variant}` : (st.mission.deployment || 'No layout \– Mission tab: dispositions + Apply event layout');
    const layoutNote = app.layoutId && !L ? ' · ' + ((layoutById(app.layoutId) || {}).name || '') : app.layoutId && String(app.layoutId).startsWith('random-') ? ' · random terrain' : '';
    lines.push({ text: head + layoutNote + (app.state ? '' : ' · local'), color: '#9aa3b2' });
  }
  hud.set(lines);
}

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

/** Tables are level: keep only yaw + position of a pose, up = world up (removes any tilt from anchors or solvers). */
function levelMatrix(m) {
  const ex = new THREE.Vector3(m[0], 0, m[2]);
  if (ex.lengthSq() < 1e-8) ex.set(1, 0, 0); else ex.normalize();
  const up = new THREE.Vector3(0, 1, 0), ez = new THREE.Vector3().crossVectors(ex, up).normalize();   // local z = board y
  return [ex.x, ex.y, ex.z, 0, 0, 1, 0, 0, ez.x, ez.y, ez.z, 0, m[12], m[13], m[14], 1];
}
function applyFrame() {
  if (app.frame) table.matrix.fromArray(levelMatrix(frameMatrix(app.frame))); else setPreviewFrame();
  table.matrixWorldNeedsUpdate = true;
  floor.visible = floorGrid.visible = !app.frame && app.xr.mode !== 'ar';
}
function applyMirror() {
  content.scale.x = app.mirror ? -1 : 1;
  content.position.x = app.mirror ? W : 0;
}

// ---------------------------------------------------------------- board + objectives + terrain
const objMat = {};
/** Battlefield extent on the table (inches): Strike Force = the whole 44×60 table, Incursion = one 44×30 half. */
function fieldRect() {
  if (app.board === 'near') return { y0: 0, y1: 30 };
  if (app.board === 'far') return { y0: 30, y1: 60 };
  if (app.board === 'both') return app.editHalf === 'far' ? { y0: 30, y1: 60 } : { y0: 0, y1: 30 };
  return { y0: 0, y1: 60 };
}
/** the two Incursion fields when both are shown: [{ y0, y1, name, active }] */
function fields() {
  if (app.board !== 'both') return null;
  return ['near', 'far'].map(k => ({ y0: k === 'far' ? 30 : 0, y1: k === 'far' ? 60 : 30, key: k, name: app.halves[k].deployment || 'Incursion (no card)', active: k === app.editHalf }));
}
const saveHalves = () => store.set('halves', app.halves);
function rebuildBoard() { repaint(); }
function repaint() {
  const s = cur();
  const L = eventLayout();
  const att = s && s.mission.attacker === 1 ? 1 : 0;
  const map = L ? { zones: L.zones } : s && s.mission && s.mission.deployment ? WH.DEPLOYMENT_MAPS[s.mission.deployment] : null;
  const players = (s && s.players) || [];
  const colors = [colorHex(players[0]), colorHex(players[1])];
  const objectives = L ? L.objectives.map((o, i) => ({ pos: o.pos, name: o.kind === 'home' ? (o.owner === 'a' ? 'Attacker Home' : 'Defender Home') : o.kind === 'central' ? 'Central' : 'Expansion', home: o.kind === 'home' ? (o.owner === 'a' ? att : 1 - att) : null }))
    : s && s.objectives && s.objectives.length ? s.objectives : map ? [
    { pos: map.home.a, name: 'Attacker Home', home: att },
    { pos: map.home.d, name: 'Defender Home', home: 1 - att },
    { pos: map.exp[0], name: 'Expansion 1' }, { pos: map.exp[1], name: 'Expansion 2' }, { pos: [22, 30], name: 'Centre' }] : [];
  const field = fieldRect();
  const half = app.board !== 'full';
  paintBoard(boardCanvas.getContext('2d'), {
    map: half ? null : map, attacker: s && s.mission ? s.mission.attacker : null, colors, names: players.map(p => p.name),
    objectives: half ? [] : objectives, band: app.band, grid: app.grid, marks: app.marks, field, fields: fields()
  });
  boardTex.needsUpdate = true;

  // objective poles (visible from across the table)
  while (objGroup.children.length) objGroup.remove(objGroup.children[0]);
  for (const ob of (half ? [] : objectives)) {
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
const TALL_COLOR = 0x8d99ae, LOW_COLOR = 0x2f8fc4, WALL_COLOR = 0xdde3ea;
const labelCache = {};
/** Small text sprite (canvas) – the size / class label on top of a piece. */
function labelSprite(text) {
  if (!labelCache[text]) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(14,17,23,0.75)'; g.fillRect(0, 0, 512, 128);
    g.font = '700 34px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    labelCache[text] = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false });
  }
  const sp = new THREE.Sprite(labelCache[text]);
  sp.scale.set(6 * IN, 1.5 * IN, 1); sp.renderOrder = 8;
  return sp;
}
/** Height (inches) a piece is drawn with: the card's terrain key (tall > 4", low ≤ 2") or the kind. */
const heightOf = p => p.tall === true ? 5 : p.tall === false ? 2 : pieceHeight(p.kind);
function buildTerrain() {
  while (terrainGroup.children.length) { const c = terrainGroup.children[0]; terrainGroup.remove(c); }
  app.pieces.forEach((p, i) => {
    const h = heightOf(p);
    const g = new THREE.Group();
    if (p.parts && p.parts.length) {
      // Event Companion area: a flat plate marks the terrain area, on it the individual features the players put down –
      // green dense ruin parts (lettered as on the card), yellow light cover (table orientation around the area's centre)
      const low = p.tall === false;
      const plateMat = new THREE.MeshBasicMaterial({ color: low ? 0x9a8650 : 0x8b96a3, transparent: true, opacity: i === app.selected ? 0.5 : 0.25, side: THREE.DoubleSide, depthWrite: false });
      let plate;
      if (p.poly && p.poly.length >= 3) {
        const geo = new THREE.ExtrudeGeometry(new THREE.Shape(p.poly.map(([x, y]) => new THREE.Vector2(x * IN, y * IN))), { depth: 0.1 * IN, bevelEnabled: false });
        geo.rotateX(Math.PI / 2); geo.translate(0, 0.1 * IN, 0); plate = new THREE.Mesh(geo, plateMat);
      } else { plate = new THREE.Mesh(new THREE.BoxGeometry(p.w * IN, 0.1 * IN, p.h * IN), plateMat); plate.position.y = 0.05 * IN; }
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: i === app.selected ? 0xffffff : (low ? 0xe0c060 : 0xdde3ea), transparent: true, opacity: 0.9 }));
      rim.position.copy(plate.position);
      g.add(plate, rim);
      g.position.set(p.x * IN, 0, p.y * IN); g.rotation.y = -(p.rot || 0) * Math.PI / 180; g.userData.idx = i;
      terrainGroup.add(g);
      const pg = new THREE.Group(); pg.position.set(p.x * IN, 0, p.y * IN); pg.userData.idx = i;
      const ar = (p.rot || 0) * Math.PI / 180, ac = Math.cos(ar), as = Math.sin(ar);
      let hw = p.w / 2, hh = p.h / 2, cx0 = 0, cy0 = 0;
      if (p.poly && p.poly.length >= 3) { const xs = p.poly.map(v => v[0]), ys = p.poly.map(v => v[1]); hw = (Math.max(...xs) - Math.min(...xs)) / 2; hh = (Math.max(...ys) - Math.min(...ys)) / 2; cx0 = (Math.min(...xs) + Math.max(...xs)) / 2; cy0 = (Math.min(...ys) + Math.max(...ys)) / 2; }
      // outline point (relative to the area centre) → clipped to the area: the plate is the feature's boundary
      const clip = (tx, ty) => { let lx = tx * ac + ty * as - cx0, ly = -tx * as + ty * ac - cy0; lx = Math.max(-hw, Math.min(hw, lx)) + cx0; ly = Math.max(-hh, Math.min(hh, ly)) + cy0; return [lx * ac - ly * as, lx * as + ly * ac]; };
      const boxes = [];
      for (const pt of p.parts) {
        const tpl = PARTS11[pt.t]; if (!tpl) continue;
        const ph = pt.k === 'dense' ? 5 : 2;
        const r = (pt.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
        const mat = new THREE.MeshBasicMaterial({ color: pt.k === 'dense' ? 0x1f8f74 : 0xd9a21b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
        for (const poly of tpl.poly) {
          const shape = new THREE.Shape(poly.map(([x, y0]) => { const y = pt.flip ? -y0 : y0; const [bx, by] = clip(pt.x + x * c - y * sn, pt.y + x * sn + y * c); return new THREE.Vector2((bx - pt.x) * IN, (by - pt.y) * IN); }));
          const geo = new THREE.ExtrudeGeometry(shape, { depth: ph * IN, bevelEnabled: false });
          geo.rotateX(Math.PI / 2); geo.translate(0, ph * IN, 0);
          const m = new THREE.Mesh(geo, mat); m.position.set(pt.x * IN, 0, pt.y * IN);
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
          e.position.copy(m.position);
          // footprint on the plate (ground level) – where the piece really stands, whatever the viewing angle
          const fp = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints().map(v => new THREE.Vector3(v.x, 0.12 * IN, v.y))), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
          fp.position.copy(m.position);
          pg.add(m, e, fp);
          const bb = { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 };
          for (const [x, y0] of poly) { const y = pt.flip ? -y0 : y0; const tx = pt.x + x * c - y * sn, ty = pt.y + x * sn + y * c; const lx = tx * ac + ty * as, ly = -tx * as + ty * ac; bb.minx = Math.min(bb.minx, lx); bb.maxx = Math.max(bb.maxx, lx); bb.miny = Math.min(bb.miny, ly); bb.maxy = Math.max(bb.maxy, ly); }
          boxes.push(bb);
        }
        if (pt.label) { const lb = labelSprite(pt.label); lb.scale.set(2.4 * IN, 0.6 * IN, 1); lb.position.set(pt.x * IN, (ph + 0.8) * IN, pt.y * IN); pg.add(lb); }
      }
      // corners no feature reaches: white corner marker along the two edges meeting there (plate's rotated group)
      const cmat = new THREE.MeshBasicMaterial({ color: 0xf2f5f8, transparent: true, opacity: 0.9 });
      const verts = p.poly && p.poly.length >= 3 ? p.poly : [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
      const insideV = (x, y) => { let ins = false; for (let i2 = 0, j2 = verts.length - 1; i2 < verts.length; j2 = i2++) { const [xi, yi] = verts[i2], [xj, yj] = verts[j2]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
      verts.forEach((v, vi) => {
        const [cx, cy] = v;
        if (boxes.some(b => b.minx <= cx + 1.2 && b.maxx >= cx - 1.2 && b.miny <= cy + 1.2 && b.maxy >= cy - 1.2)) return;
        for (const q of [verts[(vi + 1) % verts.length], verts[(vi + verts.length - 1) % verts.length]]) {
          const dx = q[0] - cx, dy = q[1] - cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          const Lc = Math.min(1.5, len / 2), t = 0.25, hc = 0.5;
          let nx = -uy, ny = ux;
          if (!insideV(cx + ux * Lc / 2 + nx * 0.3, cy + uy * Lc / 2 + ny * 0.3)) { nx = -nx; ny = -ny; }
          const bar = new THREE.Mesh(new THREE.BoxGeometry(Lc * IN, hc * IN, t * IN), cmat);
          bar.position.set((cx + ux * Lc / 2 + nx * t / 2) * IN, (hc / 2 + 0.1) * IN, (cy + uy * Lc / 2 + ny * t / 2) * IN);
          bar.rotation.y = -Math.atan2(uy, ux);
          g.add(bar);
        }
      });
      terrainGroup.add(pg);
      return;
    }
    const col = p.tall === true ? TALL_COLOR : p.tall === false ? LOW_COLOR : (KIND_COLOR[p.kind] || 0x8d99ae);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: i === app.selected ? 0.5 : (p.tall === false ? 0.28 : 0.22), side: THREE.DoubleSide, depthWrite: false });
    let box;
    if (p.poly && p.poly.length >= 3) {
      // irregular footprint: extrude the outline (table x → local X, table y → local Z)
      const shape = new THREE.Shape(p.poly.map(([x, y]) => new THREE.Vector2(x * IN, y * IN)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h * IN, bevelEnabled: false });
      geo.rotateX(Math.PI / 2); geo.translate(0, h * IN, 0);       // shape in XY → lies in XZ, extruded upwards
      box = new THREE.Mesh(geo, mat);
    } else {
      box = new THREE.Mesh(new THREE.BoxGeometry(p.w * IN, h * IN, p.h * IN), mat);
      box.position.y = h * IN / 2;
    }
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: i === app.selected ? 0xffffff : 0xdde3ea, transparent: true, opacity: 0.9 }));
    edges.position.copy(box.position);
    g.add(box, edges);
    // low cover (≤ 2"): the card prescribes only the height – crates / rubble / barricades; drawn as a slab with
    // small blocks on top so it reads differently from the tall ruins
    if (p.tall === false) {
      const n = Math.max(2, Math.round(p.w / 2));
      for (let k = 0; k < n; k++) {
        const bx = -p.w / 2 + (k + 0.5) * (p.w / n);
        const crate = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.4, p.w / n * 0.7) * IN, 1 * IN, Math.min(1.4, p.h * 0.5) * IN), new THREE.MeshBasicMaterial({ color: 0x5fb3e6, transparent: true, opacity: 0.45, depthWrite: false }));
        crate.position.set(bx * IN, (h + 0.5) * IN, 0); g.add(crate);
      }
    }
    // recommended Ruins wall placement: solid slabs 0.35" thick along the marked local edges, inset 0.3"
    if (p.tall && p.walls) {
      const t = 0.35, inset = 0.3, wh = h;
      const slab = (sx, sz, px, pz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx * IN, wh * IN, sz * IN), new THREE.MeshBasicMaterial({ color: WALL_COLOR, transparent: true, opacity: 0.6, depthWrite: false }));
        m.position.set(px * IN, wh * IN / 2, pz * IN); g.add(m);
      };
      for (const e of p.walls) {
        if (e === 'n') slab(p.w - 2 * inset, t, 0, -p.h / 2 + inset + t / 2);
        if (e === 's') slab(p.w - 2 * inset, t, 0, p.h / 2 - inset - t / 2);
        if (e === 'w') slab(t, p.h - 2 * inset, -p.w / 2 + inset + t / 2, 0);
        if (e === 'e') slab(t, p.h - 2 * inset, p.w / 2 - inset - t / 2, 0);
      }
    }
    // label: size + class
    const lbl = labelSprite(`${p.w}"×${p.h}" ${p.tall === true ? 'dense: tall ruin >4" (walls = L)' : p.tall === false ? 'light: low cover ≤2" (crates, rubble, barricade)' : (TERRAIN_KINDS[p.kind] || p.kind)}`);
    lbl.position.set(0, (h + 1.2) * IN, 0); g.add(lbl);
    g.position.set(p.x * IN, 0, p.y * IN);
    g.rotation.y = -(p.rot || 0) * Math.PI / 180;
    g.userData.idx = i;
    terrainGroup.add(g);
  });
  $('#pieces').textContent = app.pieces.length ? app.pieces.length + ' pieces' + (app.selected >= 0 ? ' · selected: ' + describe(app.pieces[app.selected]) : '') : 'No terrain';
}
const describe = p => `${p.tall === true ? 'tall' : p.tall === false ? 'low' : (TERRAIN_KINDS[p.kind] || p.kind)} ${p.w}"×${p.h}" @ ${p.x.toFixed(1)}/${p.y.toFixed(1)} ${p.rot | 0}°`;
const layoutById = id => { const L = id && LAYOUTS11.find(l => l.id === id); return L ? { id, name: `${L.attacker.disposition} vs ${L.defender.disposition} ${L.variant}`, pieces: L.pieces } : (id && String(id).startsWith('random-') ? { id, name: 'Random layout #' + id.slice(7), pieces: [] } : null); };

function saveTerrain() { if (app.code) store.set('terrain.' + app.code, { layout: app.layoutId, pieces: app.pieces }); }
// ---------------------------------------------------------------- undo (right grip without the panel in the ray, or panel button)
const undoStack = [];
function pushUndo(what) {
  undoStack.push({ what, pieces: JSON.parse(JSON.stringify(app.pieces)), marks: JSON.parse(JSON.stringify(app.marks)), calibPts: app.calibPts.slice(), capPts: app.capPts.slice(), tapeA: app.tapeA, selected: app.selected, layoutId: app.layoutId });
  if (undoStack.length > 50) undoStack.shift();
}
function undo() {
  const u = undoStack.pop();
  if (!u) { toast('Nothing to undo'); return; }
  app.pieces = u.pieces; app.marks = u.marks; app.calibPts = u.calibPts; app.capPts = u.capPts; app.tapeA = u.tapeA; app.selected = u.selected;
  if (u.layoutId !== app.layoutId) { app.layoutId = u.layoutId; $('#layout').value = u.layoutId || ''; }
  calibDots.clear();
  for (const c of app.calibPts) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4ad6ff })); dot.position.set(c.x, c.y, c.z); calibDots.add(dot); }
  if (app.tool === 'calib') setCalibText(app.calibPts.length);
  buildTerrain(); saveTerrain(); repaint(); sendStatus();
  toast('Undo: ' + u.what);
}
/** Put the chosen Event Companion layout on the table: its deployment zones, objectives and the 16 terrain areas. */
function applyEventLayout() {
  const m = app.local.mission;
  const L = findLayout11(m.dispA, m.dispD, m.variant);
  if (!L) { toast('No layout for this pairing'); return; }
  if (app.board !== 'full') { toast('Event layouts are 44\×60 \– switch the battlefield to Strike Force'); return; }
  pushUndo('event layout');
  m.layout11 = L.id; m.deployment = null; saveLocal();
  // attacker's edge is y = 0 in the data; the layout is used as printed (swap sides with Mirror / attacker choice)
  app.layoutId = L.id;
  app.pieces = L.pieces.map((p, i) => Object.assign({ id: 'e' + i }, p));
  app.selected = -1;
  buildTerrain(); saveTerrain(); repaint();
  toast(`${L.attacker.disposition} vs ${L.defender.disposition} \– Layout ${L.variant} (${L.attacker.mission} / ${L.defender.mission})`);
}
function setLayout(id, { fromState = false } = {}) {
  if (!fromState) pushUndo('layout');
  app.layoutId = id || null;
  const L11 = id && LAYOUTS11.find(l => l.id === id);
  app.pieces = L11 ? L11.pieces.map((p, i) => Object.assign({ id: 'e' + i }, p)) : layoutPieces(layoutById(id));
  app.selected = -1;
  buildTerrain(); saveTerrain();
  $('#layout').value = id || '';
  if (!fromState && app.net && app.state && app.state.stage !== 'over') {
    app.net.dispatch({ type: 'mission.set', terrainLayout: id || null }).catch(e => toast(e.message));
  }
  if (!app.state) { app.local.mission.terrainLayout = id || null; saveLocal(); }
}
/** Random fair layout for the current battlefield (full table or the chosen Incursion half) and deployment card. */
/** history of random layouts: [{ seed, board, half, deployment, fav, t }] newest first, kept on the headset */
function historyAdd(e) {
  app.history = (app.history || []).filter(h => h.seed !== e.seed);
  app.history.unshift(e);
  const favs = app.history.filter(h => h.fav), rest = app.history.filter(h => !h.fav).slice(0, 12);
  app.history = favs.concat(rest);
  store.set('history', app.history); refreshHistoryRows();
}
function refreshHistoryRows() {
  const h = app.history || [];
  const lbl = e => `#${String(e.seed).slice(-5)} ${e.board === 'full' ? '44×60' : e.half + ' half'}${e.deployment ? ' · ' + e.deployment.split(' ')[0] : ''}${e.fav ? ' ★' : ''}`;
  const recent = h.filter(e => !e.fav).slice(0, 4), favs = h.filter(e => e.fav).slice(0, 8);
  panel.setRow('recent', recent.length ? recent.map(e => ({ label: lbl(e), a: { gen: e.seed } })) : [{ label: 'none yet', a: { act: 'noop' }, w: 3 }]);
  panel.setRow('favs', favs.length ? favs.map(e => ({ label: lbl(e), a: { gen: e.seed } })) : [{ label: 'none yet – generate one and press ★ Favourite', a: { act: 'noop' }, w: 3 }]);
}
function toggleFavourite() {
  const seed = app.layoutId && String(app.layoutId).startsWith('random-') ? app.layoutId.slice(7) : null;
  const e = seed && (app.history || []).find(h => String(h.seed) === seed);
  if (!e) { toast('Generate a random layout first'); return; }
  e.fav = !e.fav; store.set('history', app.history); refreshHistoryRows();
  toast(e.fav ? `Layout #${String(e.seed).slice(-5)} saved as favourite` : 'Favourite removed');
}
function restoreRandom(e) {
  app.board = e.board; if (e.half) app.editHalf = e.half;
  if (e.deployment && !app.state) { if (app.board === 'both') app.halves[app.editHalf].deployment = e.deployment; else app.local.mission.deployment = e.deployment; }
  generateRandomLayout(e.seed);
}
function generateRandomLayout(seed) {
  const half = app.board !== 'full';
  const L = eventLayout();
  const map = L ? { zones: L.zones } : cur().mission.deployment ? WH.DEPLOYMENT_MAPS[cur().mission.deployment] : null;
  const objectives = !half && L ? L.objectives.map(o => o.pos) : !half && map ? [map.home.a, map.home.d, map.exp[0], map.exp[1], [22, 30]] : [];
  const r = generateLayout({ seed, board: half ? 'half' : 'full', objectives, zones: !half && map ? map.zones : null, tries: 1500 });
  if (!r) { toast('No fair layout found – try again'); return; }
  historyAdd({ seed: r.seed, board: app.board, half: half ? app.editHalf : null, deployment: cur().mission.deployment || null, fav: !!(app.history || []).find(h => h.seed === r.seed && h.fav), t: Date.now() });
  pushUndo('random layout');
  const f = fieldRect(), y0 = f.y0;
  app.layoutId = 'random-' + r.seed;
  const fresh = r.pieces.map(p => Object.assign({}, p, { id: p.id + '-' + y0, y: +(p.y + y0).toFixed(2) }));
  // one half of a two-field table: keep the other field's pieces
  app.pieces = half ? app.pieces.filter(p => p.y < f.y0 || p.y >= f.y1).concat(fresh) : fresh;
  app.selected = -1;
  buildTerrain(); saveTerrain();
  if (!app.state) { app.local.mission.terrainLayout = app.layoutId; saveLocal(); }
  toast(`Random layout #${r.seed} (${r.pieces.length} pieces, ${r.pieces.filter(p => p.tall).length} tall)`);
}
function selectPiece(i) { app.selected = i; buildTerrain(); }
function addPiece(w, h, kind = 'ruin') {
  pushUndo('add piece');
  const f = fieldRect();
  app.pieces.push({ id: 'c' + Date.now().toString(36), kind, x: 22, y: (f.y0 + f.y1) / 2, w, h, rot: 0 });
  selectPiece(app.pieces.length - 1); saveTerrain();
}
function removeSelected() { if (app.selected < 0) return; pushUndo('delete piece'); app.pieces.splice(app.selected, 1); app.selected = -1; buildTerrain(); saveTerrain(); }
/** Capture a real terrain piece: touch corner A, the adjacent corner B (one edge) and any corner C of the opposite
 *  edge → an axis-aligned block rotated like that edge. Board inches. */
function captureTap(p) {
  if (!p) return;
  pushUndo('capture corner');
  app.capPts.push([p.x, p.y]);
  const n = app.capPts.length;
  if (n < 3) { toast(n === 1 ? 'Capture: now the next corner along one edge' : 'Capture: now a corner of the opposite edge'); return; }
  const [a, b, c] = app.capPts; app.capPts = [];
  const ex = [b[0] - a[0], b[1] - a[1]], w = Math.hypot(ex[0], ex[1]);
  if (w < 1) { toast('Corners too close together – start again'); return; }
  const ux = ex[0] / w, uy = ex[1] / w, nx = -uy, ny = ux;                 // unit edge + normal
  const hSigned = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny, h = Math.abs(hSigned), sgn = Math.sign(hSigned) || 1;
  if (h < 1) { toast('Third corner must be on the opposite edge – start again'); return; }
  const cx = (a[0] + b[0]) / 2 + nx * sgn * h / 2, cy = (a[1] + b[1]) / 2 + ny * sgn * h / 2;
  const rot = ((Math.atan2(uy, ux) * 180 / Math.PI) % 360 + 360) % 360;
  const [W2, H2] = [Math.round(w * 2) / 2, Math.round(h * 2) / 2];
  app.pieces.push({ id: 'c' + Date.now().toString(36), kind: 'ruin', x: snap(cx, 0.25), y: snap(cy, 0.25), w: W2, h: H2, rot: Math.round(rot) });
  selectPiece(app.pieces.length - 1); saveTerrain();
  toast(`Captured ${W2}" × ${H2}" at ${Math.round(rot)}°`);
}
function rotateSelected(deg) { const p = app.pieces[app.selected]; if (!p) return; pushUndo('rotate'); p.rot = ((p.rot || 0) + deg + 360) % 360; buildTerrain(); saveTerrain(); }

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
    pushUndo('tape');
    if (!app.tapeA) { app.tapeA = [hit.x, hit.y]; toast('Tape: tap the second point'); }
    else { app.marks.push({ kind: 'tape', a: app.tapeA, b: [hit.x, hit.y], base: app.base }); app.tapeA = null; repaint(); }
    return;
  }
  if (app.tool === 'ring') { pushUndo('ring'); app.marks.push({ kind: 'ring', x: hit.x, y: hit.y, r: app.ringR, base: app.base }); repaint(); return; }
  // move: grab a piece
  const i = pieceAt(app.pieces, hit);
  selectPiece(i);
  if (i >= 0) { pushUndo('move piece'); app.drag = { src, idx: i, dx: app.pieces[i].x - hit.x, dy: app.pieces[i].y - hit.y, rot0: app.pieces[i].rot || 0, yaw0: typeof src === 'number' ? ctrlYaw(src) : null }; }
}
/** Yaw of a controller (degrees, world, about the up axis). */
function ctrlYaw(i) {
  const q = controllers[i].c.getWorldQuaternion(new THREE.Quaternion());
  const d = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  return Math.atan2(d.x, d.z) * 180 / Math.PI;
}
function dragTo(hit, yaw) {
  const d = app.drag; if (!d || !hit) return;
  const p = app.pieces[d.idx]; if (!p) return;
  p.x = snap(hit.x + d.dx, 0.5); p.y = snap(hit.y + d.dy, 0.5);
  if (yaw != null && d.yaw0 != null) {
    let delta = yaw - d.yaw0; delta = ((delta + 540) % 360) - 180;            // twist since the grab, -180..180
    p.rot = (Math.round((d.rot0 + (app.mirror ? -delta : delta)) / 5) * 5 + 360) % 360;
  }
  const g = terrainGroup.children[d.idx]; if (g) { g.position.set(p.x * IN, 0, p.y * IN); g.rotation.y = -(p.rot || 0) * Math.PI / 180; }
}
function release() { if (app.drag) { app.drag = null; buildTerrain(); saveTerrain(); } }

// ---------------------------------------------------------------- calibration
function calibTap(worldPos) {
  pushUndo('corner tap');
  const sn = snapToScan({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  worldPos = new THREE.Vector3(sn.p.x, sn.p.y, sn.p.z);
  if (sn.snapped) toast('Snapped to a corner of the scanned table');
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
  const steps = ['Stand at the Attacker\'s edge. Point the controller ray at the corner on your RIGHT (the yellow dot marks the spot) and press the trigger.',
    'Now the corner on your LEFT (the other end of the Attacker\'s edge).',
    'Now any corner of the Defender\'s edge (the far side).'];
  $('#calib-info').textContent = `Step ${n + 1} of 3 – ${steps[n]}`;
}
// ---------------------------------------------------------------- marker calibration (camera + printed corner sheets)
const headPose = () => camera.matrixWorld.elements.slice();
function stillEnough(a, b) {
  if (!a || !b) return true;
  const dt = Math.hypot(a[12] - b[12], a[13] - b[13], a[14] - b[14]);
  const dz = a[8] * b[8] + a[9] * b[9] + a[10] * b[10];
  return dt < 0.012 && dz > Math.cos(1.5 * Math.PI / 180);
}
function mcalStart() {
  if (!renderer.xr.isPresenting) { toast('Marker calibration needs the headset'); return; }
  app.mcal = { obs: [], ids: new Set(), lastT: 0, views: [], prevHead: null, t0: performance.now(), lastKeep: 0, inView: [] };
  app.mtrack = false;
  cam.start().then(() => { cam.setInterval(150); toast('Look at the corner sheets one after the other, move a little between looks'); }).catch(e => { toast('Camera: ' + (e.message || e)); app.mcal = null; });
}
function mcalCancel() {
  app.mcal = null;
  if (!app.mtrack) cam.stop();
  toast('Marker calibration cancelled');
}
function mcalTick() {
  const m = app.mcal; if (!m) return;
  const fr = app.camFrame; if (!fr || fr.t === m.lastT) return;
  m.lastT = fr.t;
  const head = headPose();
  const still = stillEnough(head, m.prevHead); m.prevHead = head;
  m.inView = fr.markers.map(x => x.id);
  if (!fr.markers.length || !still) return;                 // only still frames: the camera image lags the head pose
  if (fr.t - m.lastKeep < 250) return;                       // ~4 frames per second are plenty
  m.lastKeep = fr.t;
  m.obs.push({ head, w: fr.w, h: fr.h, gaze: app.gazeHit, markers: fr.markers.map(x => ({ id: x.id, corners: x.corners.map(c => ({ x: c.x, y: c.y })) })) });
  fr.markers.forEach(x => m.ids.add(x.id));
  // distinct viewpoints (≥ 5 cm or ≥ 8° apart) – the solver needs a few of them
  if (!m.views.some(v => Math.hypot(v[12] - head[12], v[13] - head[13], v[14] - head[14]) < 0.05 && (v[8] * head[8] + v[9] * head[9] + v[10] * head[10]) > Math.cos(8 * Math.PI / 180))) m.views.push(head);
  if (m.ids.size >= 3 && m.obs.length >= 24 && m.views.length >= 5) mcalFinish(false);
}
function mcalFinish(manual) {
  const m = app.mcal; if (!m) return;
  const ids = Array.from(m.ids).sort((a, b) => a - b);
  if (ids.length < 2 || m.obs.length < 8 || m.views.length < 3) {
    if (manual) toast(`Not enough yet: ${ids.length} of 2+ markers, ${m.obs.length} of 8+ frames, ${m.views.length} of 3+ viewpoints`);
    return;
  }
  app.mcal = null;
  const w = m.obs[0].w;
  // the table plane from where the gaze hit the table while the sheets were in view (hit-test), tilt-checked
  const gaze = m.obs.map(o => o.gaze).filter(Boolean);
  let plane = fitPlane(gaze);
  if (plane && plane.n[1] < Math.cos(12 * Math.PI / 180)) plane = null;                 // not a level surface: ignore
  if (!plane && gaze.length) { const ys = gaze.map(g => g[1]).sort((a, b) => a - b); plane = { p: [gaze[0][0], ys[ys.length >> 1], gaze[0][2]], n: [0, 1, 0] }; }
  const tPrior = [0, -0.02, -0.05];                                                        // camera: a little below / in front of the eyes
  // solve from the neutral start and – if this headset was calibrated before – from the stored camera values; keep the better
  const inits = [{ f: w * 1.3, X: fromRT([0, 0, 0], tPrior), plane, tPrior, wPrior: 150 }];
  if (app.camcal && app.camcal.f > w * 0.5 && app.camcal.f < w * 2.5) inits.push({ f: app.camcal.f, X: app.camcal.X, plane, tPrior, wPrior: 150 });
  let res = null;
  for (const init of inits) {
    try { const r = guessLayout(m.obs, ids, init); if (!res || r.rms < res.rms) res = r; } catch (e) { console.warn('calibration', e); }
  }
  if (!res) { toast('Calibration failed'); return; }
  app.mcalLast = { obs: m.obs, ids, res, plane };     // kept for analysis (BRVR.mcalLast)
  const tx = res && [res.X[12], res.X[13], res.X[14]];
  const headY = m.obs.reduce((s, o) => s + o.head[13], 0) / m.obs.length;
  const bad = !res ? 'no solution' : !(res.rms < 12) ? `error ${res.rms.toFixed(1)} px` : (res.f < w * 0.5 || res.f > w * 2.5) ? 'implausible focal length' : Math.hypot(...tx) > 0.2 ? 'implausible camera offset' : res.Y[9] < Math.cos(15 * Math.PI / 180) ? 'table not level' : res.Y[13] > headY - 0.3 ? 'table too high' : '';
  if (bad) { cam.stop(); toast(`Calibration rejected (${bad}) – look at the sheets from above, from 2–3 spots, with two sheets in view at times`); return; }
  if (!plane) toast('No table surface from the headset – using the markers alone');
  app.camcal = { f: res.f, X: res.X, dist: [0, 0], cxy: [w / 2, w / 2], tPrior }; store.set('camcal', app.camcal);
  app.markers = res.layout; store.set('markers', app.markers);
  setTableFromY(res.Y, true);
  app.mtrack = true; cam.setInterval(1000);                // tracking: one frame a second keeps the table in place
  toast(`Table calibrated from ${ids.length} markers, ${m.obs.length} frames, error ${res.rms.toFixed(1)} px${res.rms > 5 ? ' (coarse)' : ''} – tracking on`);
  pushUndo('marker calibration');
}
/** Table pose (table → world) → the frame used by everything else; anchor unless tracking live. */
function setTableFromY(Y, anchor) {
  Y = levelMatrix(Y).map((v, i) => (i === 4 || i === 6) ? 0 : v);   // level: table y stays in the ground plane
  // levelMatrix returns columns [ex, up, ez]; the table pose wants [ex, ey, up]
  const L = levelMatrix(Y); Y = [L[0], L[1], L[2], 0, L[8], L[9], L[10], 0, 0, 1, 0, 0, L[12], L[13], L[14], 1];
  app.Y = Y;
  const o = mApply(Y, [0, 0, 0]);
  app.frame = { origin: { x: o[0], y: o[1], z: o[2] }, ex: { x: Y[0], y: Y[1], z: Y[2] }, ey: { x: Y[4], y: Y[5], z: Y[6] }, up: { x: Y[8], y: Y[9], z: Y[10] }, height: o[1], edge: 44 };
  store.set('frame', packFrame(app.frame));
  if (app.xr.anchor) { try { app.xr.anchor.delete(); } catch {} app.xr.anchor = null; store.set('anchor', null); }
  applyFrame();
  if (anchor && !app.mtrack) createAnchor().catch(() => {});
  $('#calib-info').textContent = 'Calibrated from the corner markers';
}
let trackHead = null, trackT = 0;
function trackTick() {
  if (!app.mtrack || !app.camcal || !app.markers) return;
  const fr = app.camFrame; if (!fr || fr.t === trackT) return; trackT = fr.t;
  const head = headPose();
  const still = stillEnough(head, trackHead); trackHead = head;
  if (!still) return;
  const usable = fr.markers.filter(x => app.markers[x.id]);
  if (!usable.length) return;
  const obs = [{ head, w: fr.w, h: fr.h, markers: usable }];
  const Y0 = app.Y || (app.frame ? frameToY(app.frame) : null); if (!Y0) return;
  let r;
  const plane = { p: [Y0[12], Y0[13], Y0[14]], n: [Y0[8], Y0[9], Y0[10]] };
  try { r = solveAll(obs, app.markers, { f: app.camcal.f, X: app.camcal.X, Y: Y0, dist: app.camcal.dist, cxy: app.camcal.cxy, plane }, { f: true, X: true, dist: true }, 25); } catch { return; }
  if (!(r.rms < 8)) return;
  // smooth: blend rotation vector + translation
  const a = toRT(Y0), b = toRT(r.Y), k = 0.35;
  const Y = fromRT(a.rv.map((v, i) => v + (b.rv[i] - v) * k), a.t.map((v, i) => v + (b.t[i] - v) * k));
  setTableFromY(Y, false);
}
const frameToY = f => [f.ex.x, f.ex.y, f.ex.z, 0, f.ey.x, f.ey.y, f.ey.z, 0, f.up.x, f.up.y, f.up.z, 0, f.origin.x, f.origin.y, f.origin.z, 1];
/** Fine adjustment of the calibrated table: x/y along the table's own axes, z = height, r = rotation about the
 *  table's origin corner. Rewrites the frame, the stored copy and the anchor. */
function nudge(v) {
  if (!app.frame) { toast('Calibrate first'); return; }
  if (app.xr.anchor) app.frame = frameFromMatrix(table.matrix.elements);   // start from the anchored pose
  const f = app.frame;
  const st = app.step, sign = v.endsWith('+') ? 1 : -1;
  const add = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k, z: p.z + d.z * k });
  if (v[0] === 'x') f.origin = add(f.origin, f.ex, sign * st);
  else if (v[0] === 'y') f.origin = add(f.origin, f.ey, sign * st);
  else if (v[0] === 'z') { f.origin = add(f.origin, f.up, sign * st); f.height = f.origin.y; }
  else if (v[0] === 'r') {
    const a = sign * 0.5 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const rot = d => ({ x: d.x * c + d.z * s, y: 0, z: -d.x * s + d.z * c });   // about world up
    f.ex = rot(f.ex); f.ey = rot(f.ey);
  }
  store.set('frame', packFrame(f));
  app.Y = frameToY(f);
  if (app.xr.anchor) { try { app.xr.anchor.delete(); } catch {} app.xr.anchor = null; store.set('anchor', null); }
  applyFrame();
  if (!app.mtrack) createAnchor().catch(() => {});
  toast(`Adjusted ${v} by ${v[0] === 'r' ? '0.5°' : (st * 1000) + ' mm'}`);
}
function startCalibration() {
  app.calibPts = []; calibDots.clear(); app.frame = null; app.xr.anchor = null;
  store.set('frame', null); store.set('anchor', null);
  applyFrame();
  app.tool = 'calib'; syncTools(); setCalibText(0);
}
/** Anchor the table in the headset's room map. XRFrame.createAnchor only works inside the animation frame, so the
 *  request is queued and done in the render loop (makeAnchor). The anchor is made persistent (UUID stored) so the
 *  table comes back in the same place in later sessions - the room scan + the headset's spatial memory do the rest. */
function createAnchor() { app.wantAnchor = true; return Promise.resolve(); }
async function makeAnchor(xrFrame) {
  app.wantAnchor = false;
  const s = app.xr.session, ref = renderer.xr.getReferenceSpace();
  if (!s || !ref || typeof xrFrame.createAnchor !== 'function' || !app.frame) return;
  try {
    const f = app.frame;
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.ex.x, f.ex.y, f.ex.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.ey.x, f.ey.y, f.ey.z));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    const anchor = await xrFrame.createAnchor(new XRRigidTransform(f.origin, { x: q.x, y: q.y, z: q.z, w: q.w }), ref);
    // one saved table at a time: forget the previous persistent anchor
    const old = store.get('anchor', null);
    if (old && typeof s.deletePersistentAnchor === 'function') { try { await s.deletePersistentAnchor(old); } catch {} }
    app.xr.anchor = anchor; app.xr.anchorId = null; store.set('anchor', null);
    if (typeof anchor.requestPersistentHandle === 'function') {
      try { app.xr.anchorId = await anchor.requestPersistentHandle(); store.set('anchor', app.xr.anchorId); app.anchorSaved = true; } catch (e) { console.warn('persistent anchor', e); }
    }
  } catch (e) { console.warn('anchor', e); toast('Could not anchor the table: ' + (e.message || e)); }
}
async function restoreAnchor(session) {
  const id = store.get('anchor', null);
  if (!id || typeof session.restorePersistentAnchor !== 'function') return false;
  try { app.xr.anchor = await session.restorePersistentAnchor(id); app.xr.anchorId = id; app.anchorSaved = true; return true; }
  catch (e) { console.warn('restore anchor', e); return false; }
}
/** The table's current pose (anchor or frame) -> frame object, so fine adjustment starts from what is shown. */
function frameFromMatrix(m) {
  return { origin: { x: m[12], y: m[13], z: m[14] }, ex: { x: m[0], y: m[1], z: m[2] }, ey: { x: m[8], y: m[9], z: m[10] }, up: { x: 0, y: 1, z: 0 }, height: m[13], edge: app.frame ? app.frame.edge : 44 };
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
  // grip (side trigger): grab the panel with the ray on it, carry it, drop it where the grip is released
  c.addEventListener('squeezestart', () => {
    const ph = panelHit(i);
    if (ph) { c.attach(panel.mesh); panel.grabbed = i; return; }
    const src = c.userData.source;
    if (src && src.handedness === 'right') undo();                 // right grip away from the panel: undo
  });
  c.addEventListener('squeezeend', () => { if (panel.grabbed === i) { scene.attach(panel.mesh); panel.grabbed = null; } });
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
/** Where a tap lands (world): the hit-test point of the controller ray on the real surface (Quest: room mesh / depth),
 *  else the ray's intersection with the scanned table plane, else the controller's own position. */
function tapPoint(i) {
  const h = controllers[i].hit;
  if (h) return new THREE.Vector3(h.x, h.y, h.z);
  const t = scannedTable();
  if (t) {
    const r = ctrlRay(i);
    if (Math.abs(r.dir.y) > 1e-4) { const k = (t.y - r.origin.y) / r.dir.y; if (k > 0 && k < 3) return new THREE.Vector3(r.origin.x + r.dir.x * k, t.y, r.origin.z + r.dir.z * k); }
  }
  return tipPos(i);
}
const reticles = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd966, depthTest: false })); m.renderOrder = 9; m.visible = false; scene.add(m); return m; });
async function setupHitTest(session) {
  // gaze ray: where the user looks hits the table – gives the table plane for the marker calibration
  try { const viewer = await session.requestReferenceSpace('viewer'); app.gazeSrc = await session.requestHitTestSource({ space: viewer }); } catch { app.gazeSrc = null; }
  const make = async src => {
    if (!src.targetRaySpace || typeof session.requestHitTestSource !== 'function') return;
    try { src.__hit = await session.requestHitTestSource({ space: src.targetRaySpace }); } catch { src.__hit = null; }
  };
  for (const src of session.inputSources) await make(src);
  session.addEventListener('inputsourceschange', e => { for (const src of e.added) make(src); });
}
function readHits(xrFrame) {
  const ref = renderer.xr.getReferenceSpace(); if (!ref) return;
  app.gazeHit = null;
  if (app.gazeSrc) { const r = xrFrame.getHitTestResults(app.gazeSrc)[0]; const pose = r && r.getPose(ref); if (pose) app.gazeHit = [pose.transform.position.x, pose.transform.position.y, pose.transform.position.z]; }
  for (let i = 0; i < 2; i++) {
    const src = controllers[i].c.userData.source;
    const hs = src && src.__hit;
    let hit = null;
    if (hs) { const r = xrFrame.getHitTestResults(hs)[0]; const pose = r && r.getPose(ref); if (pose) hit = { x: pose.transform.position.x, y: pose.transform.position.y, z: pose.transform.position.z }; }
    controllers[i].hit = hit;
    const show = !!hit && (app.tool === 'calib' || app.tool === 'capture');
    reticles[i].visible = show;
    if (show) reticles[i].position.set(hit.x, hit.y, hit.z);
  }
}
/** Where the controller tip / index finger is (world). */
function tipPos(i) {
  const { hand, c } = controllers[i];
  const j = hand && hand.joints && hand.joints['index-finger-tip'];
  if (j && j.visible !== false && j.matrixWorld) return new THREE.Vector3().setFromMatrixPosition(j.matrixWorld);
  return new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
}
const _rc = new THREE.Raycaster();
/** Button of the 3D panel under the controller ray, or null. */
function panelHit(i) {
  if (!panel.mesh.visible) return null;
  const r = ctrlRay(i);
  _rc.set(r.origin, r.dir);
  const h = _rc.intersectObject(panel.mesh, false)[0];
  return h ? { b: panel.at(h.uv), uv: h.uv } : null;
}
function onSelectStart(i) {
  const ph = panelHit(i);
  if (ph) { if (ph.b) { applyAction(Object.assign({}, ph.b.a)); panel.draw(); } return; }   // a tap on the panel never reaches the table
  if (app.tool === 'calib') { calibTap(tapPoint(i)); return; }
  if (app.tool === 'capture') { captureTap(boardPoint(tapPoint(i))); return; }
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
    // A / X (buttons[4]) shows the panel in front of the user / hides it
    const a4 = gp.buttons[4];
    if (a4 && a4.pressed && !st.btn4) { st.btn4 = true; if (panel.mesh.visible) panel.mesh.visible = false; else placePanel(); }
    else if (a4 && !a4.pressed) st.btn4 = false;
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
  if (app.tool === 'capture') { captureTap(hit); return; }
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
const perf = { loopMs: 0, frameMs: 0, fps: 0, last: 0, n: 0, t0: 0 };
renderer.setAnimationLoop(() => {
  const tStart = performance.now();
  if (perf.last) perf.frameMs = perf.frameMs * 0.95 + (tStart - perf.last) * 0.05;
  perf.last = tStart; perf.n++;
  if (tStart - perf.t0 > 1000) { perf.fps = Math.round(perf.n * 1000 / (tStart - perf.t0)); perf.n = 0; perf.t0 = tStart; }
  const xrFrame = renderer.xr.getFrame();
  if (xrFrame && app.xr.anchor && app.track === 'room') {
    const pose = xrFrame.getPose(app.xr.anchor.anchorSpace, renderer.xr.getReferenceSpace());
    if (pose) { table.matrix.fromArray(levelMatrix(Array.from(pose.transform.matrix))); table.matrixWorldNeedsUpdate = true; }
  }
  if (xrFrame && app.wantAnchor) makeAnchor(xrFrame);
  if (xrFrame) { try { readPlanes(xrFrame); readHits(xrFrame); } catch (e) { /* stale hit-test source after a session restart */ } mcalTick(); trackTick(); }
  if (renderer.xr.isPresenting) {
    pollGamepads();
    let hover = null;
    for (let i = 0; i < 2; i++) {
      const src = controllers[i].c.userData.source; if (!src) continue;
      const r = ctrlRay(i), hit = boardHit(r.origin, r.dir);
      if (app.drag && app.drag.src === i) dragTo(hit, ctrlYaw(i));
      if (hit && onBoard(hit)) hover = hit;
    }
    hoverRing.visible = !!hover && app.tool !== 'calib';
    if (hover) hoverRing.position.set(hover.x * IN, 0.003, hover.y * IN);
    // panel hover (either controller)
    let ph = null;
    for (let i = 0; i < 2 && !ph; i++) if (controllers[i].c.userData.source) ph = panelHit(i);
    panel.hover(ph ? ph.uv : null);
    hudRefresh();
  } else placeCamera();
  renderer.render(scene, camera);
  perf.loopMs = perf.loopMs * 0.95 + (performance.now() - tStart) * 0.05;
});

// ---------------------------------------------------------------- XR session
async function enterXR() {
  if (!navigator.xr) { toast('WebXR is not available in this browser'); return; }
  const ui = $('#ui');
  let mode = (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)) ? 'immersive-ar' : 'immersive-vr';
  // The Quest browser sometimes refuses a session right after a failed one ("Something went wrong initializing the
  // session in the runtime"): try the full feature set, then the bare minimum, then plain VR.
  const attempts = [
    [mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'anchors', 'hit-test', 'plane-detection'] }],
    [mode, { requiredFeatures: ['local'], optionalFeatures: ['local-floor', 'hand-tracking', 'anchors', 'plane-detection'] }],
    [mode, {}],
    ['immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'anchors'] }]
  ];
  let session = null, lastErr = null;
  for (const [m, init] of attempts) {
    try { session = await navigator.xr.requestSession(m, init); mode = m; break; }
    catch (e) { lastErr = e; console.warn('requestSession', m, JSON.stringify(init), 'failed:', e && e.message); }
  }
  if (!session) { toast('Could not start the XR session: ' + (lastErr && lastErr.message ? lastErr.message : lastErr) + ' – close the browser completely and open the page again'); return; }
  const ar = mode === 'immersive-ar';
  app.xr.session = session; app.xr.mode = ar ? 'ar' : 'vr';
  document.body.dataset.xr = app.xr.mode;
  session.addEventListener('end', () => {
    app.xr.session = null; app.xr.anchor = null; app.xr.mode = null; app.gazeSrc = null; app.wantAnchor = false; delete document.body.dataset.xr;
    for (const c of controllers) { const src = c.c.userData.source; if (src) src.__hit = null; c.hit = null; }
    applyFrame(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    $('#enter').textContent = 'Enter headset';
  });
  await renderer.xr.setSession(session);
  // run at the highest refresh rate the headset offers (Quest 3: 72 / 80 / 90 / 120 Hz; default 72 feels sluggish)
  // 90 Hz: 11 ms per frame leaves room for texture uploads and the camera; 120 Hz missed frames and juddered
  try { const rates = session.supportedFrameRates; if (rates && rates.length && session.updateTargetFrameRate) { app.xr.rates = Array.from(rates); const want = rates.includes(90) ? 90 : Math.max(...rates); await session.updateTargetFrameRate(want); } } catch (e) { console.warn('frame rate', e); }
  $('#enter').textContent = 'Leave';
  applyFrame();
  setTimeout(placePanel, 600);     // after the first frames, when the head pose is known
  setupHitTest(session).catch(() => {});
  // forget anchors of earlier attempts that are not the saved table (the room map keeps only ours)
  try { const keep = store.get('anchor', null); for (const id of Array.from(session.persistentAnchors || [])) if (id !== keep && typeof session.deletePersistentAnchor === 'function') await session.deletePersistentAnchor(id); } catch (e) { console.warn('prune anchors', e); }
  if (await restoreAnchor(session)) toast('Saved table recalled from the room map');
  else if (app.frame) toast('No saved anchor - the table is placed from the last session coordinates, recalibrate if it does not fit');
  else { startCalibration(); toast('Calibrate the table first'); }
}

// ---------------------------------------------------------------- UI
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3500);
  toastText = msg; toastUntil = performance.now() + 4000;
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
  const before = app.state && app.state.mission.deployment;
  app.state = s;
  if (before !== s.mission.deployment) refreshLayoutRows();
  $('#players').textContent = s.players.map(p => p.name).join(' vs ');
  const id = s.mission && s.mission.terrainLayout ? s.mission.terrainLayout : null;
  if (id !== app.layoutId) {
    const saved = store.get('terrain.' + app.code, null);
    if (saved && saved.layout === id && Array.isArray(saved.pieces)) { app.layoutId = id; app.pieces = saved.pieces; app.selected = -1; buildTerrain(); $('#layout').value = id || ''; }
    else setLayout(id, { fromState: true });
  }
  repaint();
}
/** The account's open games as buttons in the Mission tab (needs the sign-in on the main page of this server). */
async function refreshGames() {
  let games = null, ses = null;
  try { ses = await apiSession(); if (ses && ses.user) games = await listGames(); } catch (e) { games = null; }
  app.signedIn = !!(ses && ses.user);
  if (!app.signedIn) { panel.setRow('games', [{ label: 'Not signed in – sign in on the main page of this server, then reload', a: { act: 'games' }, w: 3 }]); return; }
  const open = (games || []).filter(g => g.stage !== 'over').slice(0, 8);
  if (!open.length) { panel.setRow('games', [{ label: 'No open games – create one on the tablet, then refresh', a: { act: 'games' }, w: 3 }]); return; }
  panel.setRow('games', open.map(g => ({ label: g.code + ' ' + ((g.players || []).filter(Boolean).join(' vs ') || ''), a: { open: g.code }, w: 1.5 })).concat([{ label: '↻', a: { act: 'games' }, w: 0.5 }]));
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
  app.net = connect(code, { onState, onStatus: s => { setStatus(s); if (s === 'online') sendStatus(); }, onSignal });
  const saved = store.get('terrain.' + code, null);
  if (saved && Array.isArray(saved.pieces)) { app.layoutId = saved.layout || null; app.pieces = saved.pieces; buildTerrain(); $('#layout').value = app.layoutId || ''; }
  repaint();
}

function initUi() {
  const sel = $('#layout');
  sel.innerHTML = '<option value="">No terrain layout</option>' + LAYOUTS11.map(t => `<option value="${t.id}">${t.attacker.disposition} vs ${t.defender.disposition} \– ${t.variant}</option>`).join('');
  sel.addEventListener('change', () => setLayout(sel.value || null));
  const ui = $('#ui');
  ui.addEventListener('beforexrselect', e => e.preventDefault());     // taps on the overlay are not table taps
  ui.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    applyAction(Object.assign({}, b.dataset), b);
  });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') openGame(e.target.value); });
  syncTools();
}

/** One UI action – from a panel button (dataset) or from the remote control (signal { type: 'vr', …same keys }). */
function applyAction(a, btn) {
  if (a.tool) { app.tool = a.tool; app.tapeA = null; app.capPts = []; if (a.tool === 'calib') startCalibration(); if (a.tool === 'capture') toast('Capture: touch a corner of the real piece and press the trigger'); }
  else if (a.ring) { app.tool = 'ring'; app.ringR = Number(a.ring); }
  else if (a.add) { const [w, h] = String(a.add).split('x').map(Number); if (w > 0 && h > 0) addPiece(w, h, a.kind || 'ruin'); }
  else if (a.dispA !== undefined || a.dispD !== undefined || a.variant !== undefined) {
    if (a.dispA !== undefined) app.local.mission.dispA = a.dispA;
    if (a.dispD !== undefined) app.local.mission.dispD = a.dispD;
    if (a.variant !== undefined) app.local.mission.variant = a.variant;
    saveLocal();
  }
  else if (a.act === 'applyLayout11') applyEventLayout();
  else if (a.act === 'clearLayout11') { app.local.mission.layout11 = null; saveLocal(); }
  else if (a.base !== undefined) { app.base = Number(a.base) || 0; toast(app.base ? `Measuring from the edge of ${app.base} mm bases` : 'Measuring from the tapped point (hull)'); }
  else if (a.layout !== undefined) setLayout(a.layout || null);
  else if (a.deployment !== undefined || a.attacker !== undefined) {
    if (app.net && app.state) {
      const act = { type: 'mission.set' };
      if (a.deployment !== undefined) act.deployment = a.deployment;
      if (a.attacker !== undefined) act.attacker = Number(a.attacker);
      app.net.dispatch(act).catch(e => toast(e.message));
    } else if (app.board === 'both') {
      const h = app.halves[app.editHalf];
      if (a.deployment !== undefined) h.deployment = h.deployment === a.deployment ? null : a.deployment;
      if (a.attacker !== undefined) h.attacker = Number(a.attacker);
      saveHalves();
    } else {
      if (a.deployment !== undefined) { app.local.mission.deployment = app.local.mission.deployment === a.deployment ? null : a.deployment; if (app.local.mission.deployment) app.local.mission.layout11 = null; }
      if (a.attacker !== undefined) app.local.mission.attacker = Number(a.attacker);
      saveLocal();
    }
  }
  else if (a.text !== undefined) note(String(a.text || ''));
  else if (a.act === 'rotl') rotateSelected(-15);
  else if (a.act === 'rotr') rotateSelected(15);
  else if (a.act === 'del') removeSelected();
  else if (a.act === 'reset') { const L = eventLayout(); setLayout(L ? L.id : app.layoutId, { fromState: true }); }
  else if (a.act === 'clear') { app.marks = []; app.tapeA = null; repaint(); }
  else if (a.act === 'band') app.band = app.band === 'infiltrate' ? 'none' : 'infiltrate';
  else if (a.act === 'grid') app.grid = !app.grid;
  else if (a.act === 'mirror') { app.mirror = !app.mirror; applyMirror(); }
  else if (a.act === 'enter') { if (app.xr.session) app.xr.session.end(); else enterXR(); }
  else if (a.act === 'open') openGame($('#code').value);
  else if (a.act === 'panel') {
    if (renderer.xr.isPresenting) placePanel();
    else { const p = $('#panels'); p.hidden = !p.hidden; if (btn) btn.textContent = p.hidden ? 'Menu' : 'Hide'; }
  }
  else if (a.act === 'layoutPrev' || a.act === 'layoutNext') {
    const ids = [null].concat(TERRAIN_LAYOUTS.map(t => t.id));
    const i = Math.max(0, ids.indexOf(app.layoutId));
    setLayout(ids[(i + (a.act === 'layoutNext' ? 1 : ids.length - 1)) % ids.length]);
  }
  else if (a.act === 'track') { app.track = a.v === 'local' ? 'local' : 'room'; if (app.track === 'local' && app.frame) applyFrame(); toast(app.track === 'room' ? 'Tracking: the table follows its room anchor' : 'Tracking: the table stays fixed in the headset space'); }
  else if (a.act === 'scan') { app.scan = !app.scan; planesAt = 0; if (!app.scan) planeGroup.clear(); }
  else if (a.act === 'undo') undo();
  else if (a.act === 'recall') { const s = app.xr.session; if (!s) toast('Enter the headset first'); else restoreAnchor(s).then(ok => toast(ok ? 'Saved table recalled from the room map' : 'No saved table in the room map - calibrate once, it is saved automatically')); }
  else if (a.act === 'mcal') { if (app.mcal) mcalCancel(); else mcalStart(); }
  else if (a.act === 'mcalDone') mcalFinish(true);
  else if (a.act === 'mcalCancel') mcalCancel();
  else if (a.act === 'mtrack') {
    app.mtrack = !app.mtrack;
    if (app.mtrack) { if (!app.camcal || !app.markers) { app.mtrack = false; toast('Run the marker calibration first'); } else cam.start().then(() => cam.setInterval(1000)).catch(e => toast(String(e.message || e))); }
    else { cam.stop(); if (app.frame) createAnchor().catch(() => {}); }
  }
  else if (a.act === 'board') { app.board = a.v; if (a.v === 'near' || a.v === 'far') app.editHalf = a.v; rebuildBoard(); }
  else if (a.act === 'editHalf') { app.editHalf = a.v; repaint(); }
  else if (a.open !== undefined) openGame(a.open);
  else if (a.act === 'games') refreshGames();
  else if (a.act === 'gen') generateRandomLayout();
  else if (a.gen !== undefined) { const e = (app.history || []).find(h => String(h.seed) === String(a.gen)); if (e) restoreRandom(e); }
  else if (a.act === 'fav') toggleFavourite();
  else if (a.act === 'camReset') { app.camcal = null; app.markers = null; app.mtrack = false; store.set('camcal', null); store.set('markers', null); toast('Camera calibration forgotten – run the marker calibration again'); }
  else if (a.act === 'mscale' || a.act === 'mscaleStep') {
    app.markerScale = a.act === 'mscale' ? Number(a.v) : Math.max(0.3, app.markerScale + Number(a.v) / 52.5);
    store.set('markerScale', app.markerScale); setMarkerScale(app.markerScale);
    toast(`Sheets: black square ${(52.5 * app.markerScale).toFixed(1)} mm, centre ${(50 * app.markerScale).toFixed(1)} mm from the corner`);
  }
  else if (a.act === 'cam') {
    if (a.v === 'on') cam.start().then(() => toast('Camera: ' + cam.state().label + ' ' + cam.state().w + '×' + cam.state().h)).catch(e => toast('Camera: ' + (e && e.message || e)));
    else cam.stop();
  }
  else if (a.act === 'step') app.step = Number(a.v) || 0.01;
  else if (a.act === 'nudge') nudge(a.v);
  else if (a.tab) panel.setTab(a.tab);
  else if (a.act === 'ping') { /* status only */ }
  syncTools(); repaint(); sendStatus(); refreshLayoutRows(); panel.draw();
}
/** Text from the remote control – shown large in the headset until the next one (empty = hide). */
function note(text) {
  const el = $('#note');
  el.textContent = text; el.hidden = !text;
  noteText = text;
}
/** Tell the remote control what the headset is doing (signal 'vr.status'). */
let statusTimer = null;
function sendStatus() {
  if (!app.net) return;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => app.net.signal({
    type: 'vr.status', xr: app.xr.mode, calibrated: !!app.frame, edge: app.frame ? +app.frame.edge.toFixed(1) : null,
    tool: app.tool, ringR: app.ringR, layout: app.layoutId, pieces: app.pieces.length, selected: app.selected, band: app.band, grid: app.grid, mirror: app.mirror
  }), 150);
}
function onSignal(sig) {
  if (!sig || sig.type !== 'vr') return;
  const a = Object.assign({}, sig); delete a.type; delete a.ts;
  applyAction(a);
}

async function main() {
  initUi();
  app.history = store.get('history', []); refreshHistoryRows();
  setMarkerScale(app.markerScale);
  app.frame = unpackFrame(store.get('frame', null));
  applyFrame(); applyMirror();
  if (app.frame) $('#calib-info').textContent = `Last calibration: edge ${app.frame.edge.toFixed(1)}" – stored on this headset`;
  const xrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  $('#enter').hidden = !(xrOk || vrOk);
  $('#xr-note').textContent = xrOk ? 'Mixed reality (passthrough) available' : vrOk ? 'VR available (no passthrough – the table is shown at 75 cm height)' : 'No headset detected – 3D preview. Open this page in the Meta Quest browser.';
  const ses = await apiSession();
  if (ses && ses.user) $('#user').textContent = ses.user;
  app.signedIn = !!(ses && ses.user);
  refreshGames();
  const m = location.hash.match(/#\/g\/([A-Z0-9]{3,8})/i);
  openGame(m ? m[1] : store.get('code', ''));
  if (!app.code && app.local.mission.terrainLayout && !app.layoutId) { app.layoutId = app.local.mission.terrainLayout; app.pieces = layoutPieces(layoutById(app.layoutId)); }
  buildTerrain(); repaint();
}
main();

// debug access for remote testing over DevTools (adb) – read-only use
window.BRVR = { app, applyAction, repaint, createAnchor, restoreAnchor, planesDebug: () => app.planesDebug, cam, mcalFinish, mcalStart, mcalLast: () => app.mcalLast, perf: () => ({ loopMs: +perf.loopMs.toFixed(2), frameMs: +perf.frameMs.toFixed(2), fps: perf.fps, render: renderer.info.render, mem: renderer.info.memory, rate: app.xr.session && app.xr.session.frameRate, rates: app.xr.rates, scale: renderer.xr.getFramebufferScaleFactor ? renderer.xr.getFramebufferScaleFactor() : null }), planes: () => app.planes.map(p => ({ label: p.label, o: p.orientation, n: p.corners.length, y: +p.y.toFixed(3) })), hits: () => controllers.map(c => c.hit), sources: () => (app.xr.session ? app.xr.session.inputSources.length : 0) };
