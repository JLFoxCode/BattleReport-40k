/* ═══════════════════════════════════════════════════════════════════
   Battle table (js/ui/table3d.js) – the game's table as a 3D model to compare with the real one: deployment zones,
   the objective markers with their control range (the terrain area of a terrain objective, otherwise 3"), the terrain layout (Event Companion or Chapter Approved) with its dense and
   light areas and recommended walls, and the units placed on the 2D map. No tracking: the model is turned, zoomed and
   panned by hand (one finger / left button = orbit, two fingers / right button = pan, pinch / wheel = zoom), always seen
   from above the table – never from below it. Layers can be switched on and off; the choice is kept on the device.

   render(root, ctx) – view 'table3d' (#/g/CODE/3d, #/g/CODE/3d/0|1, #/g/CODE/3d/w for a spectator).
   Battlefield inches (44 × 60), origin top left, Attacker's edge at y = 0 like data/rules.js; table x → X, y → Z, up = Y.
   ═══════════════════════════════════════════════════════════════════ */
import { WH } from '../../data/rules.js';
import { TERRAIN_LAYOUTS } from '../../data/terrain.js';
import { LAYOUTS11, PARTS11, DISPOSITIONS11, VARIANTS11, findLayout11 } from '../../data/layouts11.js';
import { esc, btn, chip, toast, colorOf } from './components.js';

const [MAP_W, MAP_H] = WH.MAP_SIZE || [44, 60];
const OBJ_R = 20 / 25.4;                 // 40 mm objective marker
const OBJ_RANGE = 3 + OBJ_R;             // "within range of an objective marker"
const LAYERS = [
  ['zones', 'Zones'], ['objectives', 'Objectives'], ['ranges', 'Control range'], ['dense', 'Dense terrain'],
  ['light', 'Light terrain'], ['walls', 'Walls'], ['units', 'Units'], ['grid', 'Grid'], ['labels', 'Labels']
];
const LS_LAYERS = 'sb40k.t3d.layers';
const COL = { table: 0x1b222a, tableSide: 0x0f1419, grid: 0xffffff, dense: 0x8a9aa8, light: 0xd3b35a, wall: 0xe6ecf2, obj: 0x6b757d, edge: 0xdde3ea };

let THREE = null;                         // three.js, loaded on first use (690 kB – only this view needs it)
const instances = new WeakMap();          // root element → instance

function readLayers() {
  const on = {}; LAYERS.forEach(([k]) => (on[k] = true));
  try { Object.assign(on, JSON.parse(localStorage.getItem(LS_LAYERS) || '{}')); } catch {}
  return on;
}
function saveLayers(on) { try { localStorage.setItem(LS_LAYERS, JSON.stringify(on)); } catch {} }
/** Footprint of a terrain piece in table inches: the rotated rectangle or its irregular outline. */
function footprint(p) {
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  const pts = p.poly && p.poly.length >= 3 ? p.poly : [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
  return pts.map(([x, y]) => [p.x + x * c - y * sn, p.y + x * sn + y * c]);
}
function inPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPiece = (pt, p) => inPoly(pt, footprint(p));
const cssColor = (hex) => (typeof hex === 'string' && hex[0] === '#' ? parseInt(hex.slice(1), 16) : 0x9aa4b2);

/* ───────── What is on the table (from the game state) ───────── */
export function tableData(state) {
  const m = (state && state.mission) || {};
  const att = m.attacker === 1 ? 1 : 0;
  let tl = m.terrainLayout || null;
  let ec = tl ? LAYOUTS11.find(l => l.id === tl) || null : null;
  // no layout chosen yet: assume Layout A of the two Force Dispositions (the game's official pairing) – marked as assumed
  let assumed = false;
  if (!tl && Array.isArray(m.dispositions)) {
    const nameOf = id => { const d = (WH.DISPOSITIONS || []).find(x => x.id === id); return d ? d.name : null; };
    const L = findLayout11(nameOf(m.dispositions[att]), nameOf(m.dispositions[1 - att]), 'A');
    if (L) { ec = L; tl = L.id; assumed = true; }
  }
  const ca = !ec && tl ? TERRAIN_LAYOUTS.find(l => l.id === tl) || null : null;
  const dep = m.deployment ? WH.DEPLOYMENT_MAPS[m.deployment] || null : null;
  const zones = ec ? ec.zones : dep ? dep.zones : null;
  const line = !ec && dep ? (dep.zones && dep.zones.line) || dep.line || null : null;
  const circle = !ec && dep ? (dep.zones && dep.zones.circle) || dep.circle || null : null;
  const stObjs = Array.isArray(state && state.objectives) ? state.objectives : [];
  const ctrlOf = (ob) => {
    if (!ob) return null;
    if (ob.override === 0 || ob.override === 1) return ob.override;
    if (ob.override === 'none') return null;
    return ob.ctrl == null ? null : ob.ctrl;
  };
  let objectives;
  if (ec) {
    // the layout's objectives; control from the game's marker at (nearly) the same spot, if any
    objectives = ec.objectives.map((o, i) => {
      const p = { x: o.pos[0], y: o.pos[1] };
      const near = stObjs.find(s => s.pos && Math.hypot((s.pos.x ?? s.pos[0]) - p.x, (s.pos.y ?? s.pos[1]) - p.y) < 2);
      const home = o.kind === 'home' ? (o.owner === 'a' ? att : 1 - att) : null;
      return { id: near ? near.id : 'l' + i, name: o.kind === 'home' ? (o.owner === 'a' ? 'Attacker Home' : 'Defender Home') : o.kind === 'central' ? 'Center' : 'Expansion', pos: p, home, exp: o.kind === 'exp', ctrl: ctrlOf(near) };
    });
  } else {
    objectives = stObjs.filter(o => o && o.pos).map(o => ({ id: o.id, name: o.name || o.id, pos: { x: o.pos.x ?? o.pos[0], y: o.pos.y ?? o.pos[1] }, home: o.home === 0 || o.home === 1 ? o.home : null, exp: !!o.exp, ctrl: ctrlOf(o) }));
  }
  const pieces = ec ? ec.pieces : ca ? ca.pieces : [];
  // 11th edition: an objective inside a terrain area is a terrain objective – a model is within range of it while it is
  // within that terrain area (otherwise: within 3" horizontally). → area = footprint of that terrain area, or null
  for (const o of objectives) { const i = pieces.findIndex(p => inPiece(o.pos, p)); o.area = i >= 0 ? footprint(pieces[i]) : null; }
  const terrainName = ec ? `${ec.attacker.disposition} vs ${ec.defender.disposition} · Layout ${ec.variant}${assumed ? ' (assumed)' : ''}` : ca ? ca.name : tl && String(tl).startsWith('random-') ? `Random layout #${String(tl).slice(7)}` : null;
  const units = [];
  ((state && state.players) || []).forEach((pl, pi) => (pl && pl.units || []).forEach(u => {
    if (u && u.pos && u.status !== 'destroyed') units.push({ id: u.id, player: pi, name: u.name || '?', models: u.models, r: Math.max(.5, +u.r || 1), pos: { x: u.pos.x ?? u.pos[0], y: u.pos.y ?? u.pos[1] }, shocked: u.status === 'shocked' });
  }));
  return { att, zones, line, circle, objectives, pieces, terrainName, terrainId: tl, assumed, random: !!(tl && !ec && !ca && String(tl).startsWith('random-')), deployment: m.deployment || null, units,
    names: ((state && state.players) || []).map(p => (p && p.name) || '?'), colors: ((state && state.players) || []).map(p => colorOf(p && p.color)) };
}

/* ───────── View ───────── */
export function render(root, ctx) {
  let inst = instances.get(root);
  if (!inst) { inst = createInstance(root, ctx); instances.set(root, inst); }
  inst.ctx = ctx;
  inst.update();
}

function createInstance(root, ctx) {
  const inst = { root, ctx, layers: readLayers(), three: null, pick: false, dataKey: '', theta: null };
  root.innerHTML = `<div class="t3d">
      <div class="t3d-bar">
        ${btn({ label: '‹ Back', kind: 'ghost', small: true, action: 'back' })}
        <span class="t3d-title" data-title></span>
        <span class="spacer"></span>
        ${btn({ label: 'Layout', kind: 'ghost', small: true, action: 'pick', title: 'Choose the terrain layout' })}
        ${btn({ label: 'Flip side', kind: 'ghost', small: true, action: 'flip', title: 'Look from the other table edge' })}
        ${btn({ label: 'Top', kind: 'ghost', small: true, action: 'top', title: 'Straight from above' })}
        ${btn({ label: 'Reset', kind: 'ghost', small: true, action: 'reset', title: 'Reset the view' })}
        ${document.fullscreenEnabled ? btn({ icon: '⛶', kind: 'ghost', small: true, action: 'full', title: 'Fullscreen' }) : ''}
      </div>
      <div class="t3d-stage"><canvas class="t3d-canvas"></canvas><div class="t3d-loading muted">Loading 3D view …</div></div>
      <div class="t3d-pick" data-pick hidden></div>
      <div class="t3d-foot">
        <div class="t3d-layers chips" data-layers></div>
        <div class="t3d-note xs muted" data-note></div>
      </div>
    </div>`;
  const q = (s) => root.querySelector(s);
  inst.el = { title: q('[data-title]'), note: q('[data-note]'), layers: q('[data-layers]'), pick: q('[data-pick]'), stage: q('.t3d-stage'), canvas: q('.t3d-canvas'), loading: q('.t3d-loading') };

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action, d = a.dataset, c = inst.ctx;
    if (act === 'back') { e.preventDefault(); c.nav(backHash(c)); return; }
    if (act === 'layer') { inst.layers[d.key] = !inst.layers[d.key]; saveLayers(inst.layers); paintLayers(inst); if (inst.three) inst.three.applyLayers(); return; }
    if (act === 'flip') { inst.three && inst.three.flip(); return; }
    if (act === 'top') { inst.three && inst.three.top(); return; }
    if (act === 'reset') { inst.three && inst.three.reset(); return; }
    if (act === 'full') { toggleFullscreen(root); return; }
    if (act === 'pick') { inst.pick = !inst.pick; paintPicker(inst); return; }
    if (act === 'pick-set') {
      if (c.spectator) { toast('Spectator – view only', 'warn', 1800); return; }
      const sel = (n) => { const s = root.querySelector(`[data-pick-${n}]`); return s ? s.value : ''; };
      const L = findLayout11(sel('a'), sel('d'), sel('v'));
      if (!L) { toast('No layout for this pairing', 'warn'); return; }
      c.dispatch({ type: 'mission.set', terrainLayout: L.id }).then(() => { inst.pick = false; paintPicker(inst); }).catch(err => toast(err.message, 'bad'));
      return;
    }
    if (act === 'pick-ca') {
      if (c.spectator) { toast('Spectator – view only', 'warn', 1800); return; }
      c.dispatch({ type: 'mission.set', terrainLayout: d.id || null }).then(() => { inst.pick = false; paintPicker(inst); }).catch(err => toast(err.message, 'bad'));
    }
  });
  // selects of the picker: variant chips update the attacker/defender mission names
  root.addEventListener('change', e => { if (e.target.closest('[data-pick]')) paintPickHint(inst); });
  paintLayers(inst);

  inst.update = () => {
    const c = inst.ctx, s = c.state;
    if (!s) return;
    const data = tableData(s);
    inst.data = data;
    inst.el.title.textContent = data.terrainName || data.deployment || 'Battle table';
    inst.el.note.innerHTML = noteHtml(inst, data);
    paintPicker(inst);
    if (!THREE) {
      loadThree().then(() => { if (root.isConnected) { inst.three = createScene(inst); inst.three.setData(inst.data); inst.el.loading.remove(); } })
        .catch(err => { inst.el.loading.textContent = 'The 3D view needs WebGL – ' + (err && err.message || err); });
    } else if (!inst.three) {
      try { inst.three = createScene(inst); inst.el.loading.remove(); } catch (err) { inst.el.loading.textContent = 'The 3D view needs WebGL – ' + (err && err.message || err); return; }
      inst.three.setData(data);
    } else inst.three.setData(data);
  };
  return inst;
}

function backHash(c) {
  if (c.spectator) return `#/g/${c.code}/watch`;
  return typeof c.me === 'number' ? `#/g/${c.code}/p/${c.me}` : `#/g/${c.code}/table`;
}
function toggleFullscreen(root) {
  const el = root.querySelector('.t3d');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (el && el.requestFullscreen) el.requestFullscreen().catch(() => toast('Fullscreen is not available here', 'warn'));
}
function paintLayers(inst) {
  inst.el.layers.innerHTML = LAYERS.map(([k, label]) => chip({ label, on: !!inst.layers[k], action: 'layer', data: { key: k }, cls: 'sm' })).join('');
}
function noteHtml(inst, data) {
  const parts = [];
  if (data.assumed) parts.push('No terrain layout chosen yet – Layout A of your two Force Dispositions is assumed. “Layout” or the setup sets the real one.');
  else if (!data.terrainId) parts.push('No terrain layout chosen yet – “Layout” picks one of the 45 Event Companion layouts.');
  else if (data.random) parts.push('Random layout: its pieces are only known on the VR headset that generated it – pick an official layout here to see terrain.');
  if (!data.zones) parts.push('No deployment zones: choose the Deployment card in the setup' + (data.terrainId ? '' : ' or an Event Companion layout') + '.');
  if (data.units.length) parts.push(`${data.units.length} unit${data.units.length === 1 ? '' : 's'} from the 2D map.`);
  parts.push('Drag = turn · pinch / wheel = zoom · two fingers or right button = move · double tap = reset.');
  return esc(parts.join(' '));
}
function paintPicker(inst) {
  const el = inst.el.pick, c = inst.ctx, s = c.state;
  el.hidden = !inst.pick;
  if (!inst.pick || !s) { el.innerHTML = ''; return; }
  const m = s.mission || {};
  const att = m.attacker === 1 ? 1 : 0;
  const cur = m.terrainLayout && LAYOUTS11.find(l => l.id === m.terrainLayout);
  const dispA = cur ? cur.attacker.disposition : (m.dispositions || [])[att] || DISPOSITIONS11[0];
  const dispD = cur ? cur.defender.disposition : (m.dispositions || [])[1 - att] || DISPOSITIONS11[0];
  const variant = cur ? cur.variant : 'A';
  const opt = (list, v) => list.map(x => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  el.innerHTML = `<div class="t3d-pick-row">
      <label class="field"><span>Attacker's Force Disposition</span><select data-pick-a>${opt(DISPOSITIONS11, dispA)}</select></label>
      <label class="field"><span>Defender's Force Disposition</span><select data-pick-d>${opt(DISPOSITIONS11, dispD)}</select></label>
      <label class="field"><span>Layout</span><select data-pick-v>${opt(VARIANTS11, variant)}</select></label>
      ${btn({ label: 'Apply event layout', kind: 'primary', small: true, action: 'pick-set', disabled: !!c.spectator })}
    </div>
    <div class="t3d-pick-hint xs muted" data-pick-hint></div>
    <div class="t3d-pick-row chips">${(TERRAIN_LAYOUTS || []).map(t => chip({ label: t.short || t.name, on: m.terrainLayout === t.id, action: 'pick-ca', data: { id: t.id }, cls: 'sm' })).join('')}${chip({ label: 'No terrain', on: !m.terrainLayout, action: 'pick-ca', data: { id: '' }, cls: 'sm' })}</div>`;
  paintPickHint(inst);
}
function paintPickHint(inst) {
  const root = inst.root, h = root.querySelector('[data-pick-hint]');
  if (!h) return;
  const v = (n) => { const s = root.querySelector(`[data-pick-${n}]`); return s ? s.value : ''; };
  const L = findLayout11(v('a'), v('d'), v('v'));
  h.textContent = L ? `Event Companion p. ${L.page}: ${L.attacker.mission} (Attacker) / ${L.defender.mission} (Defender) · ${L.pieces.length} terrain areas, ${L.pieces.filter(p => p.tall).length} dense` : 'No layout for this pairing';
}

async function loadThree() {
  if (THREE) return THREE;
  THREE = await import('../../vendor/three.module.min.js');
  return THREE;
}

/* ───────── three.js scene ───────── */
function createScene(inst) {
  const { canvas, stage } = inst.el;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b0f14, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 600);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800);   // 'Top': true plan view, no perspective (compare with the card)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3340, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(30, 70, -10); scene.add(sun);

  // the table itself
  const table = new THREE.Group(); scene.add(table);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 1, 1.2, MAP_H + 1), new THREE.MeshLambertMaterial({ color: COL.tableSide }));
  slab.position.set(MAP_W / 2, -0.61, MAP_H / 2); table.add(slab);
  const topFace = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshLambertMaterial({ color: COL.table }));
  topFace.rotation.x = -Math.PI / 2; topFace.position.set(MAP_W / 2, 0, MAP_H / 2); table.add(topFace);
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(MAP_W, 0.02, 0), new THREE.Vector3(MAP_W, 0.02, MAP_H), new THREE.Vector3(0, 0.02, MAP_H)]), new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.6 }));
  table.add(edge);
  const gGrid = new THREE.Group(); table.add(gGrid);
  {
    const pts = [], major = [];
    for (let x = 6; x < MAP_W; x += 6) (x === MAP_W / 2 ? major : pts).push(new THREE.Vector3(x, 0.015, 0), new THREE.Vector3(x, 0.015, MAP_H));
    for (let y = 6; y < MAP_H; y += 6) (y === MAP_H / 2 ? major : pts).push(new THREE.Vector3(0, 0.015, y), new THREE.Vector3(MAP_W, 0.015, y));
    gGrid.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.1 })));
    gGrid.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(major), new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.28 })));
  }
  const groups = { zones: new THREE.Group(), objectives: new THREE.Group(), ranges: new THREE.Group(), dense: new THREE.Group(), light: new THREE.Group(), walls: new THREE.Group(), units: new THREE.Group(), labels: new THREE.Group(), grid: gGrid, edges: new THREE.Group() };
  for (const k of ['zones', 'objectives', 'ranges', 'dense', 'light', 'walls', 'units', 'labels', 'edges']) scene.add(groups[k]);

  /* labels: canvas sprites, sizes in inches */
  const labelCache = new Map();
  function label(text, { w = 6, h = 1.5, color = '#fff', bg = 'rgba(0,0,0,.45)', size = 30 } = {}) {
    const key = `${text}|${color}|${bg}|${size}`;
    let tex = labelCache.get(key);
    if (!tex) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      g.font = `bold ${size}px "Saira Condensed", "Segoe UI", sans-serif`;
      const tw = Math.min(500, g.measureText(text).width + 24);
      g.fillStyle = bg; g.beginPath(); g.roundRect((512 - tw) / 2, 28, tw, 72, 14); g.fill();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 64, 490);
      tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
      labelCache.set(key, tex);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(w, h, 1); sp.renderOrder = 20;
    return sp;
  }
  const clear = (g) => { while (g.children.length) { const c = g.children[0]; g.remove(c); c.geometry && c.geometry.dispose && c.geometry.dispose(); if (c.material && c.material.dispose && !(c instanceof THREE.Sprite)) c.material.dispose(); } };
  const flatPoly = (pts, y) => { const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))); const geo = new THREE.ShapeGeometry(s); geo.rotateX(Math.PI / 2); geo.translate(0, y, 0); return geo; };
  const outline = (pts, y, color, opacity = 0.9) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, y, z))), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  const circlePts = (cx, cz, r, n = 72) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cz + r * Math.sin(i / n * Math.PI * 2)]);

  let keys = {};
  function setData(d) {
    const kZ = JSON.stringify([d.zones, d.line, d.circle, d.att, d.colors, d.names]);
    if (kZ !== keys.z) { keys.z = kZ; buildZones(d); }
    const kO = JSON.stringify([d.objectives, d.colors]);   // includes each objective's terrain area
    if (kO !== keys.o) { keys.o = kO; buildObjectives(d); }
    const kT = d.terrainId + '|' + d.pieces.length;
    if (kT !== keys.t) { keys.t = kT; buildTerrain(d); }
    const kU = JSON.stringify([d.units, d.colors]);
    if (kU !== keys.u) { keys.u = kU; buildUnits(d); }
    applyLayers();
    if (view.theta == null) reset();
    dirty = true;
  }
  function buildZones(d) {
    clear(groups.zones); clear(groups.edges);
    const colA = cssColor(d.colors[d.att]), colD = cssColor(d.colors[1 - d.att]);
    if (d.zones) {
      for (const z of ['a', 'd']) {
        const poly = d.zones[z]; if (!poly || poly.length < 3) continue;
        const col = z === 'a' ? colA : colD;
        const m = new THREE.Mesh(flatPoly(poly, 0.03), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
        groups.zones.add(m, outline(poly, 0.05, col, 0.95));
      }
      if (d.circle) groups.zones.add(outline(circlePts(d.circle[0], d.circle[1], d.circle[2]), 0.05, COL.edge, 0.5));
      if (d.line && d.line.length >= 2) groups.zones.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(d.line.map(([x, z]) => new THREE.Vector3(x, 0.05, z))), new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.7 })));
    }
    // table edges: who stands where
    const la = label(`Attacker's edge · ${d.names[d.att] || ''}`, { w: 14, h: 3.5, color: d.colors[d.att] || '#fff' }); la.position.set(MAP_W / 2, 0.6, -2.4); groups.edges.add(la);
    const ld = label(`Defender's edge · ${d.names[1 - d.att] || ''}`, { w: 14, h: 3.5, color: d.colors[1 - d.att] || '#fff' }); ld.position.set(MAP_W / 2, 0.6, MAP_H + 2.4); groups.edges.add(ld);
  }
  function buildObjectives(d) {
    clear(groups.objectives); clear(groups.ranges);
    for (const o of d.objectives) {
      const col = o.ctrl === 0 || o.ctrl === 1 ? cssColor(d.colors[o.ctrl]) : COL.obj;
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(OBJ_R, OBJ_R, 0.2, 32), new THREE.MeshLambertMaterial({ color: col }));
      marker.position.set(o.pos.x, 0.1, o.pos.y);
      const rim = outline(circlePts(o.pos.x, o.pos.y, OBJ_R + 0.08, 48), 0.21, 0xffffff, 0.9);
      groups.objectives.add(marker, rim);
      if (o.home != null) {        // home objective: a small flag pole in the owner's colour
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), new THREE.MeshBasicMaterial({ color: cssColor(d.colors[o.home]) }));
        pole.position.set(o.pos.x, 1.3, o.pos.y); groups.objectives.add(pole);
      }
      if (o.area) {
        // terrain objective (11th edition): the whole terrain area is the objective – highlight its footprint
        const fill = new THREE.Mesh(flatPoly(o.area, 0.045), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
        groups.ranges.add(fill, outline(o.area, 0.07, col, 0.95));
      } else {
        const ring = new THREE.Mesh(new THREE.RingGeometry(OBJ_RANGE - 0.12, OBJ_RANGE, 72), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(o.pos.x, 0.06, o.pos.y);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(OBJ_RANGE, 72), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
        disc.rotation.x = -Math.PI / 2; disc.position.set(o.pos.x, 0.04, o.pos.y);
        groups.ranges.add(ring, disc);
      }
      const lb = label(o.name, { w: 7, h: 1.75, size: 34 }); lb.position.set(o.pos.x, o.home != null ? 3.2 : 1.6, o.pos.y); lb.userData.layer = 'objectives'; groups.labels.add(lb);
    }
  }
  const heightOf = p => p.tall === true ? 5 : p.tall === false ? 2 : ({ ruin: 5, wall: 2, crate: 2.5, crater: 0.25, wood: 3 })[p.kind] || 3;
  const PART_COL = { dense: 0x1f8f74, light: 0xd9a21b };          // the card's legend: green = dense, yellow = light
  /** A feature's outline(s) relative to its own centre, in table orientation (template mirrored, then rotated) and clipped
   *  to its terrain area: the plate is the feature's boundary, nothing sticks out (the card draws e.g. the pipes longer). */
  function partOutlines(tpl, pt, area) {
    const r = (pt.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const ar = (area.rot || 0) * Math.PI / 180, ac = Math.cos(ar), as = Math.sin(ar);
    let hw = area.w / 2, hh = area.h / 2, cx = 0, cy = 0;
    if (area.poly && area.poly.length >= 3) { const xs = area.poly.map(v => v[0]), ys = area.poly.map(v => v[1]); hw = (Math.max(...xs) - Math.min(...xs)) / 2; hh = (Math.max(...ys) - Math.min(...ys)) / 2; cx = (Math.min(...xs) + Math.max(...xs)) / 2; cy = (Math.min(...ys) + Math.max(...ys)) / 2; }
    return tpl.poly.map(poly => poly.map(([x0, y0]) => {
      const y = pt.flip ? -y0 : y0;
      const tx = pt.x + x0 * c - y * s, ty = pt.y + x0 * s + y * c;                 // relative to the area centre
      let lx = tx * ac + ty * as - cx, ly = -tx * as + ty * ac - cy;                 // area's local frame
      lx = Math.max(-hw, Math.min(hw, lx)); ly = Math.max(-hh, Math.min(hh, ly));
      lx += cx; ly += cy;
      const bx = lx * ac - ly * as, by = lx * as + ly * ac;                          // back to table orientation
      return [bx - pt.x, by - pt.y];
    }));
  }
  /** Bounding box of a feature in its area's local frame (unrotated plate coordinates). */
  function partLocalBox(tpl, pt, area) {
    const r = (pt.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const ar = (area.rot || 0) * Math.PI / 180, ac = Math.cos(ar), as = Math.sin(ar);
    const b = { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 };
    for (const poly of tpl.poly) for (const [x0, y0] of poly) {
      const y = pt.flip ? -y0 : y0;
      const tx = pt.x + x0 * c - y * s, ty = pt.y + x0 * s + y * c;
      const lx = tx * ac + ty * as, ly = -tx * as + ty * ac;
      b.minx = Math.min(b.minx, lx); b.maxx = Math.max(b.maxx, lx); b.miny = Math.min(b.miny, ly); b.maxy = Math.max(b.maxy, ly);
    }
    return b;
  }
  /** Corners of the plate no feature reaches get a white corner marker (two short bars) – shows how far the terrain
   *  feature extends when the table is set up and later during play. Added to the plate's (rotated) group. */
  function cornerMarkers(p, boxes, g) {
    let hw = p.w / 2, hh = p.h / 2, cx0 = 0, cy0 = 0;
    if (p.poly && p.poly.length >= 3) { const xs = p.poly.map(v => v[0]), ys = p.poly.map(v => v[1]); hw = (Math.max(...xs) - Math.min(...xs)) / 2; hh = (Math.max(...ys) - Math.min(...ys)) / 2; cx0 = (Math.min(...xs) + Math.max(...xs)) / 2; cy0 = (Math.min(...ys) + Math.max(...ys)) / 2; }
    const mat = new THREE.MeshLambertMaterial({ color: 0xf2f5f8 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = cx0 + sx * hw, cy = cy0 + sy * hh;
      if (p.poly && p.poly.length >= 3 && !p.poly.some(([x, y]) => Math.abs(x - cx) < 0.3 && Math.abs(y - cy) < 0.3)) continue;   // wedge: only real corners
      const covered = boxes.some(b => b.minx <= cx + 1.2 && b.maxx >= cx - 1.2 && b.miny <= cy + 1.2 && b.maxy >= cy - 1.2);
      if (covered) continue;
      const L = Math.min(1.5, hw, hh), t = 0.25, h = 0.5;
      const bx = new THREE.Mesh(new THREE.BoxGeometry(L, h, t), mat); bx.position.set(cx - sx * L / 2, h / 2 + 0.12, cy - sy * t / 2);
      const bz = new THREE.Mesh(new THREE.BoxGeometry(t, h, L), mat); bz.position.set(cx - sx * t / 2, h / 2 + 0.12, cy - sy * L / 2);
      g.add(bx, bz);
    }
  }
  function extrude(poly, h) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); geo.translate(0, h, 0);            // shape in XY → lies in XZ, extruded upwards
    return geo;
  }
  function buildTerrain(d) {
    clear(groups.dense); clear(groups.light); clear(groups.walls);
    for (const c of [...groups.labels.children]) if (c.userData.layer === 'terrain') groups.labels.remove(c);
    d.pieces.forEach(p => {
      const h = heightOf(p), low = p.tall === false;
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.y); g.rotation.y = -(p.rot || 0) * Math.PI / 180;
      if (p.parts && p.parts.length) {
        // Event Companion area: a flat plate marks the terrain area (its boundary is what the rules use); on it stand the
        // individual features the players put down – green dense ruin parts (lettered), yellow light cover
        const plateMat = new THREE.MeshLambertMaterial({ color: low ? 0x9a8650 : 0x8b96a3, transparent: true, opacity: 0.4, depthWrite: false });
        const plate = new THREE.Mesh(p.poly && p.poly.length >= 3 ? extrude(p.poly, 0.12) : new THREE.BoxGeometry(p.w, 0.12, p.h), plateMat);
        if (!(p.poly && p.poly.length >= 3)) plate.position.y = 0.06;
        const rim = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry, 20), new THREE.LineBasicMaterial({ color: low ? 0xe0c060 : 0xdde3ea, transparent: true, opacity: 0.9 }));
        rim.position.copy(plate.position);
        g.add(plate, rim);
        (low ? groups.light : groups.dense).add(g);
        const pg = { dense: new THREE.Group(), light: new THREE.Group() };
        pg.dense.position.set(p.x, 0, p.y); pg.light.position.set(p.x, 0, p.y);
        for (const pt of p.parts) {
          const tpl = PARTS11[pt.t]; if (!tpl) continue;
          const ph = pt.k === 'dense' ? 5 : 2;
          const mat = new THREE.MeshLambertMaterial({ color: PART_COL[pt.k] || 0x8d99ae, transparent: true, opacity: 0.92 });
          for (const poly of partOutlines(tpl, pt, p)) {
            const geo = extrude(poly, ph);
            const m = new THREE.Mesh(geo, mat); m.position.set(pt.x, 0, pt.y);
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
            e.position.copy(m.position);
            // footprint on the plate (bright line at ground level): where the piece really stands, whatever the viewing angle
            const fp = outline(poly, 0.14, 0xffffff, 0.9); fp.position.copy(m.position);
            pg[pt.k === 'dense' ? 'dense' : 'light'].add(m, e, fp);
          }
          if (pt.label) {
            const lb = label(pt.label, { w: 2.4, h: 1.2, size: 46, bg: 'rgba(10,70,55,.92)' });
            lb.position.set(p.x + pt.x, ph + 0.9, p.y + pt.y); lb.userData.layer = 'terrain'; lb.userData.low = pt.k !== 'dense'; groups.labels.add(lb);
          }
        }
        cornerMarkers(p, p.parts.map(pt => PARTS11[pt.t] ? partLocalBox(PARTS11[pt.t], pt, p) : null).filter(Boolean), g);
        groups.dense.add(pg.dense); groups.light.add(pg.light);
        const lb = label(`${p.w}"×${p.h}" ${low ? 'light' : 'dense'} area`, { w: 5.5, h: 1.25, size: 28, bg: 'rgba(0,0,0,.3)' });
        lb.position.set(p.x, 0.5, p.y); lb.userData.layer = 'terrain'; lb.userData.low = low; groups.labels.add(lb);
        return;
      }
      // Chapter Approved layouts: the area as a block (dense: tall ruin with its recommended walls, light: low cover)
      const mat = new THREE.MeshLambertMaterial({ color: low ? COL.light : COL.dense, transparent: true, opacity: low ? 0.55 : 0.75 });
      let body;
      if (p.poly && p.poly.length >= 3) body = new THREE.Mesh(extrude(p.poly, h), mat);
      else { body = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.h), mat); body.position.y = h / 2; }
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 20), new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.75 }));
      edges.position.copy(body.position);
      g.add(body, edges);
      if (low) {                 // light terrain: a few crates on the slab so it reads as low cover
        const n = Math.max(2, Math.round(p.w / 2));
        for (let k = 0; k < n; k++) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.4, p.w / n * 0.7), 0.9, Math.min(1.4, p.h * 0.5)), new THREE.MeshLambertMaterial({ color: 0xb08d3a }));
          crate.position.set(-p.w / 2 + (k + 0.5) * (p.w / n), h + 0.45, 0); g.add(crate);
        }
      }
      (low ? groups.light : groups.dense).add(g);
      // recommended Ruins walls (Chapter Approved layouts): slabs along the marked local edges
      if (p.tall && p.walls) {
        const wg = new THREE.Group(); const t = 0.35, inset = 0.3;
        const slabAt = (sx, sz, px, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), new THREE.MeshLambertMaterial({ color: COL.wall, transparent: true, opacity: 0.85 })); m.position.set(px, h / 2, pz); wg.add(m); };
        for (const e of p.walls) {
          if (e === 'n') slabAt(p.w - 2 * inset, t, 0, -p.h / 2 + inset + t / 2);
          if (e === 's') slabAt(p.w - 2 * inset, t, 0, p.h / 2 - inset - t / 2);
          if (e === 'w') slabAt(t, p.h - 2 * inset, -p.w / 2 + inset + t / 2, 0);
          if (e === 'e') slabAt(t, p.h - 2 * inset, p.w / 2 - inset - t / 2, 0);
        }
        wg.position.copy(g.position); wg.rotation.copy(g.rotation); groups.walls.add(wg);
      }
      const lb = label(`${p.w}"×${p.h}" ${low ? 'light' : 'dense'}`, { w: 5, h: 1.25, size: 30, bg: 'rgba(0,0,0,.3)' });
      lb.position.set(p.x, h + 0.9, p.y); lb.userData.layer = 'terrain'; lb.userData.low = low; groups.labels.add(lb);
    });
  }
  function buildUnits(d) {
    clear(groups.units);
    for (const c of [...groups.labels.children]) if (c.userData.layer === 'units') groups.labels.remove(c);
    for (const u of d.units) {
      const col = cssColor(d.colors[u.player]);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(u.r, u.r, 1.1, 32), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: u.shocked ? 0.55 : 0.9 }));
      m.position.set(u.pos.x, 0.55, u.pos.y);
      groups.units.add(m, outline(circlePts(u.pos.x, u.pos.y, u.r + 0.05, 48), 1.12, 0xffffff, 0.8));
      const lb = label(`${u.name}${u.models != null ? ' · ' + u.models : ''}`, { w: Math.max(6, u.r * 4), h: Math.max(6, u.r * 4) / 4, size: 30, color: d.colors[u.player] || '#fff' });
      lb.position.set(u.pos.x, 2.2, u.pos.y); lb.userData.layer = 'units'; groups.labels.add(lb);
    }
  }
  function applyLayers() {
    const on = inst.layers;
    for (const k of ['zones', 'objectives', 'ranges', 'dense', 'light', 'walls', 'units', 'grid']) groups[k].visible = !!on[k];
    groups.edges.visible = !!on.labels;
    groups.labels.visible = !!on.labels;
    for (const c of groups.labels.children) {
      const L = c.userData.layer;
      c.visible = L === 'terrain' ? (c.userData.low ? !!on.light : !!on.dense) : L === 'units' ? !!on.units : !!on.objectives;
    }
    dirty = true;
  }

  /* camera: orbit around a point on the table, never below the table plane */
  const view = { theta: null, phi: 0.9, dist: 70, tx: MAP_W / 2, tz: MAP_H / 2 };
  const PHI_MIN = 0.03, PHI_MAX = 1.47, D_MIN = 8, D_MAX = 160;
  function homeTheta() {
    const c = inst.ctx, d = inst.data || {};
    if (typeof c.me === 'number') return c.me === (d.att ?? 0) ? Math.PI : 0;   // from the player's own table edge
    return 0;                                                                     // shared display: from the Defender's edge
  }
  function reset() { view.theta = homeTheta(); view.phi = 0.9; view.dist = 70; view.tx = MAP_W / 2; view.tz = MAP_H / 2; view.ortho = false; dirty = true; }
  function flip() { view.theta += Math.PI; dirty = true; }
  function top() { view.phi = PHI_MIN; view.tx = MAP_W / 2; view.tz = MAP_H / 2; view.dist = 78; view.ortho = true; dirty = true; }
  let aspect = 1;
  function place() {
    if (view.ortho) {
      // plan view straight down, the table edge the player looks from at the bottom of the screen
      ortho.position.set(view.tx, 300, view.tz);
      ortho.up.set(-Math.sin(view.theta), 0, -Math.cos(view.theta));
      ortho.lookAt(view.tx, 0, view.tz);
      const hh = view.dist * 0.45, hw = hh * aspect;
      ortho.left = -hw; ortho.right = hw; ortho.top = hh; ortho.bottom = -hh; ortho.updateProjectionMatrix();
      return;
    }
    const s = Math.sin(view.phi);
    camera.position.set(view.tx + view.dist * s * Math.sin(view.theta), view.dist * Math.cos(view.phi), view.tz + view.dist * s * Math.cos(view.theta));
    camera.up.set(0, 1, 0);
    camera.lookAt(view.tx, 0, view.tz);
  }

  /* pointer: 1 pointer = orbit (secondary button: pan), 2 pointers = pinch zoom + pan, wheel = zoom, double tap = reset */
  const pts = new Map(); let lastMid = null, lastSpan = 0, lastTap = 0, panMode = false;
  const pan = (dx, dy) => {
    const k = view.dist * 0.0016;
    const fx = Math.sin(view.theta), fz = Math.cos(view.theta);          // camera → target direction on the table plane
    view.tx += (-fz * dx - fx * dy) * k; view.tz += (fx * dx - fz * dy) * k;
    view.tx = Math.max(-6, Math.min(MAP_W + 6, view.tx)); view.tz = Math.max(-6, Math.min(MAP_H + 6, view.tz));
    dirty = true;
  };
  const zoom = (f) => { view.dist = Math.max(D_MIN, Math.min(D_MAX, view.dist * f)); dirty = true; };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panMode = e.button === 1 || e.button === 2;
    if (pts.size === 1) { const now = performance.now(); if (now - lastTap < 320) reset(); lastTap = now; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; lastSpan = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      if (panMode) pan(dx, dy);
      else { view.theta -= dx * 0.006; view.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, view.phi - dy * 0.005)); if (view.ortho && Math.abs(dy) > 2) view.ortho = false; dirty = true; }   // tilting leaves the plan view
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, span = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastMid) pan(mid.x - lastMid.x, mid.y - lastMid.y);
      if (lastSpan > 0 && span > 0) zoom(lastSpan / span);
      lastMid = mid; lastSpan = span;
    }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) { lastMid = null; lastSpan = 0; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  /* size + render loop (renders only when something changed) */
  let dirty = true, destroyed = false;
  function resize() {
    const w = stage.clientWidth || 300, h = stage.clientHeight || 300;
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  (function loop() {
    if (destroyed) return;
    if (!stage.isConnected) { destroyed = true; ro.disconnect(); renderer.dispose(); return; }
    if (dirty) { dirty = false; place(); renderer.render(scene, view.ortho ? ortho : camera); }
    requestAnimationFrame(loop);
  })();
  return { setData, applyLayers, reset, flip, top };
}
