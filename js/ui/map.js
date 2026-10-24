/* ═══════════════════════════════════════════════════════════════════
   Spielfeld (js/ui/map.js) – SVG-Karte 44" × 60", Zoll als Einheit.

   createMap(el, opts) → { update(state, derived), setOptions(partial), destroy(), toTable(clientX, clientY) }
   mapThumb(deploymentName, attacker) → SVG-String (Vorschau für Auswahl)

   Optionen (alle optional):
     rot: 0 | 90 | 180 | 270 | 'auto'   Drehung ('auto': 90°, wenn Container breiter als hoch)
     maxVh: 70                          max. Höhe des Spielfelds in vh (nur ohne fill)
     fill: false                        true = SVG füllt den Container (Container bestimmt Größe)
     interactive: false                 Zeigerinteraktion an/aus
     player: 0 | 1 | 'any' | null       wessen Token gezogen werden dürfen
     zoneOnly: false                    Ablegen nur in der eigenen Aufstellungszone (Deploy)
     tool: 'move' | 'measure' | 'range' Werkzeug
     rangeInches: 6                     Radius für tool 'range'
     placing: unitId | null             nächster Tipp aufs Feld platziert diese Einheit
     selected: unitId | null            hervorgehobene Einheit (weißer Ring)
     showMoveRange: true                Bewegungsreichweite (u.move) beim Ziehen anzeigen
     terrain: [ { id, pieces: [ { kind, x, y, w, h, rot } ] } ]   Geländelayouts (x,y = Mitte)
     onMove(unitId, {x,y}, dist)        Token losgelassen (gültig)
     onInvalid(msg)                     Ablegen ungültig (zoneOnly)
     onSelect(unitId)                   Tipp auf Token
     onObjective(objectiveId)           Tipp auf Missionsziel
     onTap({x,y})                       Tipp auf leeres Feld
     onPlace(unitId, {x,y})             Platzieren (opts.placing)
     onMeasure(from, to, dist)          Messwerkzeug losgelassen
     onRange(center, r)                 Reichweitenwerkzeug losgelassen
   ═══════════════════════════════════════════════════════════════════ */
import { WH } from '../../data/rules.js';
import { LAYOUTS11, PARTS11 } from '../../data/layouts11.js';

export const OBJ_RANGE = 3.79;          // 3" + Markerradius (40 mm ≈ 0.79")
export const OBJ_R = 0.79;
const [MAP_W, MAP_H] = WH.MAP_SIZE || [44, 60];
const NS = 'http://www.w3.org/2000/svg';
const TAP_PX = 8;                       // Bewegung in Pixeln, ab der ein Tipp zum Ziehen wird

const DEFAULTS = {
  rot: 'auto', maxVh: 70, fill: false, interactive: false, player: null, zoneOnly: false,
  tool: 'move', rangeInches: 6, placing: null, selected: null, showMoveRange: true, terrain: []
};

/* ───────── Helfer ───────── */
function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function setAttrs(n, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null) n.removeAttribute(k);
    else if (n.getAttribute(k) !== String(v)) n.setAttribute(k, v);
  }
}
function setText(n, t) { if (n.textContent !== t) n.textContent = t; }
function cls(n, name, on) { n.classList.toggle(name, !!on); }
const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function posOf(p) {
  if (!p) return null;
  if (Array.isArray(p)) return { x: +p[0], y: +p[1] };
  if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  return null;
}
function pointInPolygon(pt, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const hit = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
function abbrev(name) {
  const words = String(name || '?').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return '?';
  const s = words.length >= 2 ? words[0][0] + words[1][0] : words[0].slice(0, 3);
  return s.toUpperCase().slice(0, 4);
}
function deploymentOf(state) {
  const name = state?.mission?.deployment;
  return (name && WH.DEPLOYMENT_MAPS[name]) || null;
}
function rootTransform(rot) {
  switch (rot) {
    case 90: return 'translate(60 0) rotate(90)';
    case 180: return 'translate(44 60) rotate(180)';
    case 270: return 'translate(0 44) rotate(270)';
    default: return '';
  }
}
function viewBoxOf(rot) { return rot === 90 || rot === 270 ? `0 0 ${MAP_H} ${MAP_W}` : `0 0 ${MAP_W} ${MAP_H}`; }

/* ───────── Hauptkomponente ───────── */
export function createMap(el, opts = {}) {
  const o = Object.assign({}, DEFAULTS, opts);
  let state = null, derived = {}, rot = 0, destroyed = false;
  let zoneKey = null, terrainKey = null;
  const unitEls = new Map();        // unitId → { g, body, name, count, lbl, player }
  const objEls = new Map();         // objectiveId → { g, marks }

  el.classList.add('map');
  el.innerHTML = '';
  const svgEl = svg('svg', { viewBox: viewBoxOf(0), preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Spielfeld' }, el);
  const root = svg('g', { class: 'map-root' }, svgEl);
  svg('rect', { class: 'map-bg', x: 0, y: 0, width: MAP_W, height: MAP_H }, root);
  const gGrid = svg('g', { class: 'map-grid-layer' }, root);
  const gZones = svg('g', { class: 'map-zones' }, root);
  const gTerrain = svg('g', { class: 'map-terrain' }, root);
  const gObjs = svg('g', { class: 'map-objectives' }, root);
  const gUnits = svg('g', { class: 'map-units' }, root);
  const gOverlay = svg('g', { class: 'map-overlay' }, root);
  svg('rect', { class: 'map-edge', x: 0, y: 0, width: MAP_W, height: MAP_H, 'pointer-events': 'none' }, root);
  buildGrid();

  /* ── Layout / Rotation ── */
  function layout() {
    const wantRot = o.rot === 'auto' ? autoRot() : (+o.rot || 0);
    el.classList.toggle('fill', !!o.fill);
    if (!o.fill) {
      const w = wantRot === 90 || wantRot === 270 ? MAP_H : MAP_W, h = w === MAP_W ? MAP_H : MAP_W;
      el.style.aspectRatio = `${w} / ${h}`;
      el.style.maxHeight = o.maxVh ? `${o.maxVh}vh` : '';
      el.style.maxWidth = o.maxVh ? `calc(${o.maxVh}vh * ${w} / ${h})` : '';
    } else {
      el.style.aspectRatio = el.style.maxHeight = el.style.maxWidth = '';
    }
    if (wantRot !== rot) {
      rot = wantRot;
      setAttrs(svgEl, { viewBox: viewBoxOf(rot) });
      setAttrs(root, { transform: rootTransform(rot) || null });
      root.querySelectorAll('.lbl').forEach(n => n.setAttribute('transform', `rotate(${-rot})`));
      terrainKey = null;                       // Geländebeschriftungen neu ausrichten
      if (state) patchTerrain();
    }
  }
  function autoRot() {
    const w = el.clientWidth || el.getBoundingClientRect().width;
    const h = o.fill ? (el.clientHeight || el.getBoundingClientRect().height)
      : (window.innerHeight * (o.maxVh || 100)) / 100;
    if (!w || !h) return rot;
    return w > h ? 90 : 0;
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!destroyed) layout(); }) : null;
  ro?.observe(el);
  layout();

  /* ── Statische Ebenen ── */
  function buildGrid() {
    let d = '';
    for (let x = 6; x < MAP_W; x += 6) d += `M${x} 0V${MAP_H}`;
    for (let y = 6; y < MAP_H; y += 6) d += `M0 ${y}H${MAP_W}`;
    svg('path', { class: 'map-grid', d }, gGrid);
    svg('path', { class: 'map-grid major', d: `M${MAP_W / 2} 0V${MAP_H}M0 ${MAP_H / 2}H${MAP_W}` }, gGrid);
  }
  function attackerIdx() { const a = state?.mission?.attacker; return a === 1 ? 1 : 0; }
  function zonePlayer(z) { return z === 'a' ? attackerIdx() : 1 - attackerIdx(); }
  function myZone() {
    if (!(o.player === 0 || o.player === 1)) return null;
    const dep = derived?.zones || deploymentOf(state)?.zones;
    if (!dep) return null;
    return o.player === attackerIdx() ? dep.a : dep.d;
  }
  function patchZones() {
    const dep = deploymentOf(state);
    const zones = derived?.zones || dep?.zones;
    const key = `${state?.mission?.deployment}|${attackerIdx()}|${o.player}|${o.zoneOnly}`;
    if (key === zoneKey) return;
    zoneKey = key;
    gZones.innerHTML = '';
    if (!zones) return;
    for (const z of ['a', 'd']) {
      if (!zones[z]) continue;
      const p = zonePlayer(z);
      svg('polygon', { class: `map-zone p${p}${o.zoneOnly && o.player === p ? ' own' : ''}`, points: zones[z].map(q => q.join(',')).join(' ') }, gZones);
    }
    const circle = zones.circle || dep?.circle;
    if (circle) svg('circle', { class: 'map-zone-circle', cx: circle[0], cy: circle[1], r: circle[2] }, gZones);
    const line = zones.line || dep?.line;
    if (line) svg('polyline', { class: 'map-line', points: line.map(q => q.join(',')).join(' ') }, gZones);
  }
  function patchTerrain() {
    const id = state?.mission?.terrainLayout;
    const layout = (o.terrain || []).find(t => t.id === id) || LAYOUTS11.find(t => t.id === id) || null;
    const key = layout ? `${id}|${layout.pieces?.length}` : 'none';
    if (key === terrainKey) return;
    terrainKey = key;
    gTerrain.innerHTML = '';
    if (!layout) return;
    for (const p of layout.pieces || []) {
      const g = svg('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot || 0})` }, gTerrain);
      const kind = p.kind || 'ruin';
      const cls = `terrain ${kind}${p.tall === true ? ' dense' : p.tall === false ? ' light' : ''}${p.parts ? ' area' : ''}`;
      if (p.poly && p.poly.length >= 3) svg('polygon', { class: cls, points: p.poly.map(q => q.join(',')).join(' ') }, g);
      else if (kind === 'crater' || kind === 'wood') svg('ellipse', { class: cls, rx: p.w / 2, ry: p.h / 2 }, g);
      else svg('rect', { class: cls, x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: .3 }, g);
      // Event Companion: the individual features on the area (table orientation, not rotated with the area)
      if (p.parts && p.parts.length) {
        const pg = svg('g', { transform: `translate(${p.x} ${p.y})` }, gTerrain);
        const ar = (p.rot || 0) * Math.PI / 180, ac = Math.cos(ar), as = Math.sin(ar);
        let hw = p.w / 2, hh = p.h / 2, cx0 = 0, cy0 = 0;
        if (p.poly && p.poly.length >= 3) { const xs = p.poly.map(v => v[0]), ys = p.poly.map(v => v[1]); hw = (Math.max(...xs) - Math.min(...xs)) / 2; hh = (Math.max(...ys) - Math.min(...ys)) / 2; cx0 = (Math.min(...xs) + Math.max(...xs)) / 2; cy0 = (Math.min(...ys) + Math.max(...ys)) / 2; }
        // outline point → clipped to the area (the plate is the feature's boundary, nothing sticks out)
        const clip = (tx, ty) => { let lx = tx * ac + ty * as - cx0, ly = -tx * as + ty * ac - cy0; lx = Math.max(-hw, Math.min(hw, lx)) + cx0; ly = Math.max(-hh, Math.min(hh, ly)) + cy0; return [lx * ac - ly * as, lx * as + ly * ac]; };
        const boxes = [];                      // each feature's bbox in the plate's local frame (for the corner markers)
        for (const pt of p.parts) {
          const tpl = PARTS11[pt.t]; if (!tpl) continue;
          const r = (pt.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
          const b = { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 };
          for (const poly of tpl.poly) for (const [x, y0] of poly) { const y = pt.flip ? -y0 : y0; const tx = pt.x + x * c - y * sn, ty = pt.y + x * sn + y * c; const lx = tx * ac + ty * as, ly = -tx * as + ty * ac; b.minx = Math.min(b.minx, lx); b.maxx = Math.max(b.maxx, lx); b.miny = Math.min(b.miny, ly); b.maxy = Math.max(b.maxy, ly); }
          boxes.push(b);
          for (const poly of tpl.poly) svg('polygon', { class: `part ${pt.k}`, points: poly.map(([x, y0]) => { const y = pt.flip ? -y0 : y0; const [bx, by] = clip(pt.x + x * c - y * sn, pt.y + x * sn + y * c); return `${bx.toFixed(2)},${by.toFixed(2)}`; }).join(' ') }, pg);
          if (pt.label) { const t = svg('text', { class: 'part-label lbl', x: pt.x, y: pt.y, transform: `rotate(${-rot} ${pt.x} ${pt.y})` }, pg); t.textContent = pt.label; }
        }
        // corners no feature reaches: white corner marker along the two edges meeting there (shows how far the feature extends)
        const verts = p.poly && p.poly.length >= 3 ? p.poly : [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
        verts.forEach((v, i) => {
          const [cx, cy] = v;
          if (boxes.some(b => b.minx <= cx + 1.2 && b.maxx >= cx - 1.2 && b.miny <= cy + 1.2 && b.maxy >= cy - 1.2)) return;
          const a = verts[(i + 1) % verts.length], b = verts[(i + verts.length - 1) % verts.length];
          const end = q => { const dx = q[0] - cx, dy = q[1] - cy, len = Math.hypot(dx, dy) || 1, L = Math.min(1.5, len / 2); return `${(cx + dx / len * L).toFixed(2)},${(cy + dy / len * L).toFixed(2)}`; };
          svg('polyline', { class: 'part corner', points: `${end(a)} ${cx},${cy} ${end(b)}` }, g);
        });
      }
      if (kind === 'ruin' && p.w >= 4 && p.h >= 3) {
        const t = svg('text', { class: 'terrain-label', transform: `rotate(${-rot - (p.rot || 0)})` }, g);
        t.textContent = `${p.w}×${p.h}`;
      }
    }
  }

  /* ── Missionsziele ── */
  function ctrlOf(ob) {
    const d = derived?.control?.[ob.id];
    if (d && d.ctrl !== undefined) return d.ctrl;
    if (ob.override === 0 || ob.override === 1) return ob.override;
    if (ob.override === 'none') return null;
    return ob.ctrl ?? null;
  }
  function patchObjectives() {
    const list = Array.isArray(state?.objectives) ? state.objectives : [];
    const seen = new Set();
    for (const ob of list) {
      const p = posOf(ob.pos);
      if (!ob?.id || !p) continue;
      seen.add(ob.id);
      let e = objEls.get(ob.id);
      if (!e) {
        const g = svg('g', { class: 'obj', 'data-obj': ob.id }, gObjs);
        svg('circle', { class: 'obj-range', r: OBJ_RANGE }, g);
        const home = svg('circle', { class: 'obj-home', r: OBJ_R + .4 }, g);
        const exp = svg('circle', { class: 'obj-exp', r: OBJ_R + .4 }, g);
        svg('circle', { class: 'obj-marker', r: OBJ_R }, g);
        const icon = svg('path', { class: 'obj-home-icon', d: 'M-.42 .05 L0 -.38 L.42 .05 L.3 .05 L.3 .4 L-.3 .4 L-.3 .05 Z' }, g);
        const marks = svg('g', { class: 'obj-marks lbl', transform: `rotate(${-rot})` }, g);
        e = { g, home, exp, icon, marks, marksKey: null };
        objEls.set(ob.id, e);
      }
      setAttrs(e.g, { transform: `translate(${p.x} ${p.y})` });
      const c = ctrlOf(ob);
      cls(e.g, 'c0', c === 0); cls(e.g, 'c1', c === 1);
      const isHome = ob.home === 0 || ob.home === 1;
      e.home.style.display = isHome ? '' : 'none';
      e.icon.style.display = isHome ? '' : 'none';
      e.exp.style.display = ob.exp && !isHome ? '' : 'none';
      const marks = Object.keys(ob.marks || {}).filter(k => ob.marks[k]);
      const mk = marks.join('|');
      if (mk !== e.marksKey) {
        e.marksKey = mk;
        e.marks.innerHTML = '';
        marks.slice(0, 6).forEach((k, i) => {
          const [pp, key] = k.split(':');
          const ang = -Math.PI / 2 + i * (Math.PI / 3);
          const g = svg('g', { class: `obj-mark ${pp || ''}`, transform: `translate(${(1.45 * Math.cos(ang)).toFixed(2)} ${(1.45 * Math.sin(ang)).toFixed(2)})` }, e.marks);
          svg('circle', { r: .45 }, g);
          svg('text', {}, g).textContent = (key || '?')[0].toUpperCase();
        });
      }
    }
    for (const [id, e] of objEls) if (!seen.has(id)) { e.g.remove(); objEls.delete(id); }
  }

  /* ── Einheiten ── */
  function canDrag(player) {
    if (!o.interactive || o.tool !== 'move') return false;
    return o.player === 'any' || o.player === player;
  }
  function patchUnits() {
    const seen = new Set();
    const players = Array.isArray(state?.players) ? state.players : [];
    players.forEach((pl, pi) => {
      for (const u of pl?.units || []) {
        const p = posOf(u.pos);
        if (!u?.id || !p || u.status === 'destroyed') continue;
        seen.add(u.id);
        let e = unitEls.get(u.id);
        if (!e) {
          const g = svg('g', { class: 'unit', 'data-unit': u.id }, gUnits);
          const body = svg('circle', { class: 'body' }, g);
          const shock = svg('circle', { class: 'ring-shock' }, g);
          const sel = svg('circle', { class: 'ring-sel' }, g);
          const lbl = svg('g', { class: 'lbl', transform: `rotate(${-rot})` }, g);
          const name = svg('text', { class: 'u-name' }, lbl);
          const count = svg('text', { class: 'u-count' }, lbl);
          e = { g, body, shock, sel, lbl, name, count, player: pi, r: 0, unit: u };
          unitEls.set(u.id, e);
        }
        e.unit = u; e.player = pi;
        const r = Math.max(.5, +u.r || 1);
        if (r !== e.r) {
          e.r = r;
          const fs = clamp(r * .55, .55, 1.1);
          setAttrs(e.body, { r });
          setAttrs(e.shock, { r: r + .22 });
          setAttrs(e.sel, { r: r + .28 });
          setAttrs(e.name, { 'font-size': fs.toFixed(2) + 'px', y: (-fs * .32).toFixed(2) });
          setAttrs(e.count, { 'font-size': (fs * .72).toFixed(2) + 'px', y: (fs * .48).toFixed(2) });
        }
        cls(e.g, 'p0', pi === 0); cls(e.g, 'p1', pi === 1);
        cls(e.g, 'shocked', u.status === 'shocked');
        cls(e.g, 'selected', (o.selected != null && o.selected === u.id) || !!u.selected);
        cls(e.g, 'draggable', canDrag(pi));
        cls(e.g, 'ghost-dim', o.placing != null && o.placing !== u.id && pi === o.player);
        setText(e.name, abbrev(u.name));
        setText(e.count, u.models != null ? String(u.models) : '');
        if (!(drag && drag.kind === 'unit' && drag.id === u.id && drag.moved)) setAttrs(e.g, { transform: `translate(${p.x} ${p.y})` });
      }
    });
    for (const [id, e] of unitEls) if (!seen.has(id)) {
      if (drag && drag.kind === 'unit' && drag.id === id) endDrag(null);
      e.g.remove(); unitEls.delete(id);
    }
  }

  /* ── Update ── */
  function update(s, d) {
    if (destroyed) return;
    state = s || null; derived = d || {};
    patchZones(); patchTerrain(); patchObjectives(); patchUnits();
  }

  /* ── Zeigerinteraktion ── */
  let drag = null;            // { kind: 'unit'|'measure'|'range', id, pointerId, start:{x,y}, cur:{x,y}, startClient, moved, target }
  let raf = 0;
  const ov = {};              // Overlay-Elemente (lazy)

  function toTable(clientX, clientY) {
    const m = root.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }
  function clampPos(p, r = 0) { return { x: clamp(p.x, r, MAP_W - r), y: clamp(p.y, r, MAP_H - r) }; }

  function ensureOverlay() {
    if (ov.line) return;
    ov.line = svg('line', { class: 'drag-line', style: 'display:none' }, gOverlay);
    ov.dot = svg('circle', { class: 'drag-dot', r: .25, style: 'display:none' }, gOverlay);
    ov.range = svg('circle', { class: 'range-circle', style: 'display:none' }, gOverlay);
    ov.moveRange = svg('circle', { class: 'move-range', style: 'display:none' }, gOverlay);
    ov.ghost = svg('g', { class: 'ghost', style: 'display:none' }, gOverlay);
    ov.ghostC = svg('circle', { r: 1 }, ov.ghost);
    ov.lblG = svg('g', { style: 'display:none' }, gOverlay);
    ov.lbl = svg('text', { class: 'drag-label lbl', transform: `rotate(${-rot})` }, ov.lblG);
  }
  function hideOverlay(keep) {
    ensureOverlay();
    for (const k of ['line', 'dot', 'range', 'moveRange', 'ghost', 'lblG']) if (!keep?.includes(k)) ov[k].style.display = 'none';
  }
  function showLabel(p, text, over) {
    ov.lblG.style.display = '';
    setAttrs(ov.lblG, { transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})` });
    setAttrs(ov.lbl, { transform: `rotate(${-rot})` });
    cls(ov.lbl, 'over', over);
    setText(ov.lbl, text);
  }
  function labelPos(a, b) {
    // Beschriftung leicht neben der Mitte der Linie, innerhalb des Feldes
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    return clampPos({ x: mx + nx * 1.6, y: my + ny * 1.6 }, 1.2);
  }

  function renderDrag() {
    raf = 0;
    if (!drag) return;
    ensureOverlay();
    const a = drag.start, b = drag.cur, dd = dist(a, b);
    if (drag.kind === 'unit') {
      const e = unitEls.get(drag.id);
      if (!e) return;
      setAttrs(e.g, { transform: `translate(${b.x.toFixed(2)} ${b.y.toFixed(2)})` });
      const mv = +e.unit.move || 0;
      const battle = !state?.stage || state.stage === 'battle';
      const over = battle && mv > 0 && dd > mv + 1e-6;
      ov.line.style.display = ''; ov.dot.style.display = '';
      setAttrs(ov.line, { x1: a.x, y1: a.y, x2: b.x.toFixed(2), y2: b.y.toFixed(2) });
      cls(ov.line, 'over', over);
      setAttrs(ov.dot, { cx: a.x, cy: a.y });
      if (o.showMoveRange && mv > 0 && battle) {
        ov.moveRange.style.display = '';
        ov.moveRange.classList.remove('p0', 'p1'); ov.moveRange.classList.add(`p${e.player}`);
        ov.moveRange.style.setProperty('--pc', `var(--p${e.player})`);
        setAttrs(ov.moveRange, { cx: a.x, cy: a.y, r: mv + e.r });
      }
      showLabel(labelPos(a, b), `${fmt(dd)}"${over ? ' !' : ''}`, over);
    } else if (drag.kind === 'measure') {
      ov.line.style.display = ''; ov.dot.style.display = '';
      setAttrs(ov.line, { x1: a.x, y1: a.y, x2: b.x.toFixed(2), y2: b.y.toFixed(2) });
      cls(ov.line, 'over', false);
      setAttrs(ov.dot, { cx: a.x, cy: a.y });
      showLabel(labelPos(a, b), `${fmt(dd)}"`, false);
    } else if (drag.kind === 'range') {
      const r = Math.max(.1, +o.rangeInches || 0);
      ov.range.style.display = '';
      setAttrs(ov.range, { cx: b.x.toFixed(2), cy: b.y.toFixed(2), r });
      showLabel(clampPos({ x: b.x, y: b.y - r - 1.2 }, 1.2), `${fmt(r)}"`, false);
    }
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(renderDrag); }

  function flashInvalid(e) {
    e.g.classList.remove('invalid'); void e.g.getBBox?.(); e.g.classList.add('invalid');
    setTimeout(() => e.g.classList.remove('invalid'), 750);
  }

  function onDown(ev) {
    if (!o.interactive || drag) return;
    if (ev.button != null && ev.button !== 0) return;
    const pt = toTable(ev.clientX, ev.clientY);
    const unitG = ev.target.closest?.('[data-unit]');
    const objG = ev.target.closest?.('[data-obj]');
    const base = { pointerId: ev.pointerId, start: pt, cur: pt, startClient: { x: ev.clientX, y: ev.clientY }, moved: false };
    if (o.tool === 'measure' || o.tool === 'range') {
      drag = Object.assign(base, { kind: o.tool });
      hideOverlay();
    } else if (unitG && o.placing == null) {
      const id = unitG.getAttribute('data-unit'), e = unitEls.get(id);
      if (!e) return;
      if (canDrag(e.player)) {
        drag = Object.assign(base, { kind: 'unit', id, start: posOf(e.unit.pos) || pt, cur: posOf(e.unit.pos) || pt, grab: { x: pt.x - (posOf(e.unit.pos)?.x ?? pt.x), y: pt.y - (posOf(e.unit.pos)?.y ?? pt.y) } });
      } else {
        drag = Object.assign(base, { kind: 'tap', target: { unit: id } });
      }
    } else if (objG && o.placing == null) {
      drag = Object.assign(base, { kind: 'tap', target: { obj: objG.getAttribute('data-obj') } });
      objG.classList.add('tapped');
    } else {
      drag = Object.assign(base, { kind: 'tap', target: {} });
      if (o.placing != null) showGhost(pt);
    }
    try { svgEl.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) {
      if (!drag && o.placing != null && o.interactive && ev.pointerType === 'mouse') showGhost(toTable(ev.clientX, ev.clientY));
      return;
    }
    const pt = toTable(ev.clientX, ev.clientY);
    if (!drag.moved && Math.hypot(ev.clientX - drag.startClient.x, ev.clientY - drag.startClient.y) < TAP_PX) return;
    drag.moved = true;
    if (drag.kind === 'tap') { if (o.placing != null) showGhost(pt); return; }
    if (drag.kind === 'unit') {
      const e = unitEls.get(drag.id);
      if (!e) { drag = null; return; }
      e.g.classList.add('dragging');
      drag.cur = clampPos({ x: pt.x - drag.grab.x, y: pt.y - drag.grab.y }, e.r);
    } else {
      drag.cur = clampPos(pt);
    }
    schedule();
    ev.preventDefault();
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    if (ev.type === 'pointercancel') { try { svgEl.releasePointerCapture(ev.pointerId); } catch { /* ignore */ } endDrag(null); }
    else endDrag(ev);
  }
  function endDrag(ev) {
    const d = drag; drag = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    try { if (ev) svgEl.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
    gObjs.querySelectorAll('.tapped').forEach(n => n.classList.remove('tapped'));
    if (!ev) {                                                // abgebrochen (pointercancel, Werkzeugwechsel, Einheit verschwand)
      hideOverlay();
      if (d.kind === 'unit') {
        const e = unitEls.get(d.id);
        if (e) { e.g.classList.remove('dragging'); setAttrs(e.g, { transform: `translate(${d.start.x} ${d.start.y})` }); }
      }
      return;
    }
    const pt = toTable(ev.clientX, ev.clientY);
    if (d.kind === 'tap' || (d.kind === 'unit' && !d.moved)) {
      hideOverlay();
      if (d.moved && o.placing == null) return;               // verschoben, aber nichts Ziehbares: kein Tipp
      if (o.placing != null) {
        const id = o.placing;
        const r = unitRadius(id);
        o.onPlace?.(id, clampPos(pt, r));
        return;
      }
      if (d.kind === 'unit') o.onSelect?.(d.id);
      else if (d.target?.unit) o.onSelect?.(d.target.unit);
      else if (d.target?.obj) o.onObjective?.(d.target.obj);
      else o.onTap?.(clampPos(pt));
      return;
    }
    if (d.kind === 'unit') {
      const e = unitEls.get(d.id);
      hideOverlay();
      if (!e) return;
      e.g.classList.remove('dragging');
      const to = d.cur, dd = dist(d.start, to);
      if (o.zoneOnly) {
        const zone = myZone();
        if (!zone || !pointInPolygon(to, zone)) {
          setAttrs(e.g, { transform: `translate(${d.start.x} ${d.start.y})` });
          flashInvalid(e);
          o.onInvalid?.('Außerhalb der Aufstellungszone');
          return;
        }
      }
      o.onMove?.(d.id, { x: +to.x.toFixed(2), y: +to.y.toFixed(2) }, +dd.toFixed(2));
      return;
    }
    if (d.kind === 'measure') {
      if (!d.moved) { hideOverlay(); return; }
      o.onMeasure?.({ ...d.start }, { ...d.cur }, +dist(d.start, d.cur).toFixed(2));   // Linie bleibt bis zum nächsten Druck sichtbar
      return;
    }
    if (d.kind === 'range') {
      renderDrag(); // Kreis bleibt sichtbar
      o.onRange?.({ ...d.cur }, +o.rangeInches || 0);
    }
  }
  function unitRadius(id) {
    const e = unitEls.get(id);
    if (e) return e.r;
    for (const pl of state?.players || []) for (const u of pl?.units || []) if (u.id === id) return Math.max(.5, +u.r || 1);
    return 1;
  }
  function showGhost(pt) {
    ensureOverlay();
    const id = o.placing;
    if (id == null) { ov.ghost.style.display = 'none'; return; }
    const r = unitRadius(id);
    const pl = o.player === 1 ? 1 : 0;
    ov.ghost.style.display = '';
    ov.ghost.classList.remove('p0', 'p1'); ov.ghost.classList.add(`p${pl}`);
    ov.ghost.style.setProperty('--pc', `var(--p${pl})`);
    const c = clampPos(pt, r);
    setAttrs(ov.ghost, { transform: `translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})` });
    setAttrs(ov.ghostC, { r });
  }

  svgEl.addEventListener('pointerdown', onDown);
  svgEl.addEventListener('pointermove', onMove);
  svgEl.addEventListener('pointerup', onUp);
  svgEl.addEventListener('pointercancel', onUp);
  svgEl.addEventListener('contextmenu', ev => { if (o.interactive) ev.preventDefault(); });

  /* ── Optionen ── */
  function applyOptionClasses() {
    el.classList.toggle('interactive', !!o.interactive);
    el.classList.toggle('placing', o.placing != null);
    for (const t of ['move', 'measure', 'range']) el.classList.toggle(`tool-${t}`, o.tool === t);
  }
  function setOptions(partial) {
    if (destroyed || !partial) return;
    const before = { ...o };
    Object.assign(o, partial);
    applyOptionClasses();
    if (before.rot !== o.rot || before.maxVh !== o.maxVh || before.fill !== o.fill) layout();
    if (before.tool !== o.tool || before.placing !== o.placing) { if (drag) endDrag(null); hideOverlay(); }
    if (o.placing == null && ov.ghost) ov.ghost.style.display = 'none';
    if (before.player !== o.player || before.zoneOnly !== o.zoneOnly) zoneKey = null;
    if (before.terrain !== o.terrain) terrainKey = null;
    if (state) update(state, derived);
  }
  applyOptionClasses();

  function destroy() {
    destroyed = true;
    ro?.disconnect();
    if (raf) cancelAnimationFrame(raf);
    svgEl.removeEventListener('pointerdown', onDown);
    svgEl.removeEventListener('pointermove', onMove);
    svgEl.removeEventListener('pointerup', onUp);
    svgEl.removeEventListener('pointercancel', onUp);
    unitEls.clear(); objEls.clear();
    el.innerHTML = '';
    el.classList.remove('map', 'interactive', 'placing', 'fill', 'tool-move', 'tool-measure', 'tool-range');
    el.style.aspectRatio = el.style.maxHeight = el.style.maxWidth = '';
  }

  return { update, setOptions, destroy, toTable, get rotation() { return rot; } };
}

/* ───────── Vorschaubild für Auswahl-Listen ───────── */
export function mapThumb(deploymentName, attacker = 0) {
  const dep = WH.DEPLOYMENT_MAPS[deploymentName];
  if (!dep) return `<svg class="map-thumb" viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="${NS}"></svg>`;
  const pa = attacker === 1 ? 1 : 0, pd = 1 - pa;
  const poly = (pts) => pts.map(q => q.join(',')).join(' ');
  const objs = [[22, 30], dep.home?.a, dep.home?.d, ...(dep.exp || [])].filter(Boolean);
  const homeKeys = new Set([dep.home?.a, dep.home?.d].filter(Boolean).map(q => q.join(',')));
  let s = `<svg class="map-thumb" viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="${NS}" aria-label="${deploymentName}">`;
  s += `<rect width="${MAP_W}" height="${MAP_H}" fill="var(--map-bg,#171D22)"/>`;
  s += `<polygon class="map-zone p${pa}" style="--pc:var(--p${pa})" points="${poly(dep.zones.a)}"/>`;
  s += `<polygon class="map-zone p${pd}" style="--pc:var(--p${pd})" points="${poly(dep.zones.d)}"/>`;
  if (dep.circle) s += `<circle class="map-zone-circle" cx="${dep.circle[0]}" cy="${dep.circle[1]}" r="${dep.circle[2]}"/>`;
  s += `<polyline class="map-line" points="${poly(dep.line)}"/>`;
  for (const q of objs) {
    const isHome = homeKeys.has(q.join(','));
    const col = isHome ? (q === dep.home.a ? `var(--p${pa})` : `var(--p${pd})`) : 'var(--muted,#8E9BA6)';
    s += `<circle class="obj-range" cx="${q[0]}" cy="${q[1]}" r="${OBJ_RANGE}" style="--oc:${col}"/>`;
    s += `<circle class="obj-marker" cx="${q[0]}" cy="${q[1]}" r="1.3" style="--oc:${col}"/>`;
  }
  s += `<rect class="map-edge" width="${MAP_W}" height="${MAP_H}"/></svg>`;
  return s;
}
