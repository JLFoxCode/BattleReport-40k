/* Battlefield overlay painted into a 2D canvas (one texture on the table plane) + pure geometry for terrain
 * pieces. Battlefield inches, origin top-left (Attacker's edge at y = 0), exactly as data/rules.js and data/terrain.js. */
import { BOARD } from './calib.js';

export const PX = 16;                                  // texture pixels per inch (704 × 960)
export const OBJ_RADIUS = 20 / 25.4;                   // 40 mm objective marker
export const OBJ_RANGE = 3 + OBJ_RADIUS;               // "within range of an objective marker": 3" from its edge

/** Rotated rectangle (x, y centre; w along x, h along y; rot in degrees clockwise) → 4 corners. */
export function rectCorners(p) {
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const hw = p.w / 2, hh = p.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => [p.x + dx * c - dy * s, p.y + dx * s + dy * c]);
}

/** Point inside the rotated rectangle? */
export function inRect(p, q) {
  const r = -(q.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - q.x, dy = p.y - q.y;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= q.w / 2 && Math.abs(ly) <= q.h / 2;
}

/** Topmost piece under a board point (last in the list wins), or -1. */
export function pieceAt(pieces, p) {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const q = pieces[i];
    if (q.poly && q.poly.length >= 3) { if (inPolyRel(p, q)) return i; }
    else if (inRect(p, q)) return i;
  }
  return -1;
}
/** point inside an irregular footprint (outline relative to the piece centre, rotated by rot) */
function inPolyRel(p, q) {
  const r = -(q.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - q.x, dy = p.y - q.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
  let inside = false;
  for (let i = 0, j = q.poly.length - 1; i < q.poly.length; j = i++) {
    const a = q.poly[i], b = q.poly[j];
    if ((a[1] > ly) !== (b[1] > ly) && lx < (b[0] - a[0]) * (ly - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Deep copy of a layout's pieces with ids. */
export const layoutPieces = layout => (layout && Array.isArray(layout.pieces) ? layout.pieces : []).map((p, i) => Object.assign({ id: 't' + i, kind: p.kind || 'ruin', x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot || 0 }, p.tall != null ? { tall: !!p.tall } : {}, p.walls ? { walls: p.walls } : {}, p.poly ? { poly: p.poly } : {}));

/** Height (inches) a piece is drawn with. */
export const pieceHeight = kind => ({ ruin: 5, wall: 2, crate: 2.5, crater: 0.25, wood: 3 })[kind] || 3;

const hex = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Paint the overlay. o = { map (WH.DEPLOYMENT_MAPS entry or null), attacker (player index or null), colors: [hex, hex],
 *  names: [str, str], objectives: [{ pos: [x, y], kind, name, home }], band: 'none'|'infiltrate', grid: bool,
 *  marks: [{ kind: 'ring', x, y, r } | { kind: 'tape', a: [x, y], b: [x, y] }] } */
export function paintBoard(ctx, o) {
  const W = BOARD[0] * PX, H = BOARD[1] * PX;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(PX, PX);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // battlefield edge: the whole 44×60 battlefield; one half-table game (rest shaded); or two half-table fields
  const field = o.field || { y0: 0, y1: BOARD[1] };
  if (o.fields) {
    for (const f of o.fields) {
      ctx.strokeStyle = f.active ? 'rgba(255,230,80,0.95)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = f.active ? 0.25 : 0.15;
      ctx.strokeRect(0.1, f.y0 + 0.1, BOARD[0] - 0.2, f.y1 - f.y0 - 0.2);
      ctx.font = 'bold 1.5px sans-serif'; ctx.fillStyle = f.active ? 'rgba(255,230,80,0.9)' : 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${f.key} field \u00b7 ${f.name}${f.active ? ' \u00b7 editing' : ''}`, BOARD[0] / 2, f.y0 + 2);
      // centre marker of each field
      ctx.beginPath(); ctx.arc(BOARD[0] / 2, (f.y0 + f.y1) / 2, 0.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    }
  } else {
    if (field.y0 > 0) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, BOARD[0], field.y0); }
    if (field.y1 < BOARD[1]) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, field.y1, BOARD[0], BOARD[1] - field.y1); }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.15;
    ctx.strokeRect(0, field.y0, BOARD[0], field.y1 - field.y0);
    if (field.y1 - field.y0 < BOARD[1]) {
      ctx.font = 'bold 1.6px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Half table 44\" \u00d7 30\"', BOARD[0] / 2, (field.y0 + field.y1) / 2);
    }
  }

  if (o.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let x = 6; x < BOARD[0]; x += 6) { ctx.moveTo(x, 0); ctx.lineTo(x, BOARD[1]); }
    for (let y = 6; y < BOARD[1]; y += 6) { ctx.moveTo(0, y); ctx.lineTo(BOARD[0], y); }
    ctx.stroke();
  }

  const drawMap = (map, attacker) => {
    const att = attacker === 1 ? 1 : 0;                 // without a roll-off: player 1 attacks
    const colA = (o.colors && o.colors[att]) || '#2F5FC4', colD = (o.colors && o.colors[1 - att]) || '#B23A31';
    const poly = (pts, fill, stroke) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 0.25; ctx.stroke();
    };
    poly(map.zones.a, hex(colA, 0.22), hex(colA, 0.95));
    poly(map.zones.d, hex(colD, 0.22), hex(colD, 0.95));

    // "more than 9\" from the enemy deployment zone" (Infiltrators, Scouts) – the forbidden band, from each zone
    if (o.band === 'infiltrate') {
      for (const [z, col] of [[map.zones.a, colA], [map.zones.d, colD]]) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, BOARD[0], BOARD[1]); ctx.clip();
        ctx.beginPath(); z.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        ctx.strokeStyle = hex(col, 0.14); ctx.lineWidth = 18; ctx.stroke();     // 9" either side, inside is covered by the zone itself
        ctx.setLineDash([0.6, 0.4]); ctx.strokeStyle = hex(col, 0.9); ctx.lineWidth = 0.1;
        ctx.beginPath(); z.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        ctx.lineWidth = 18.1; ctx.stroke();                                       // thin dashed 9" contour (outer edge of the band)
        ctx.restore();
      }
    }

    // territory boundary
    if (map.line) {
      ctx.setLineDash([1, 0.6]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.15;
      ctx.beginPath(); ctx.moveTo(map.line[0][0], map.line[0][1]); ctx.lineTo(map.line[1][0], map.line[1][1]); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (map.circle) {
      ctx.setLineDash([1, 0.6]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.12;
      ctx.beginPath(); ctx.arc(map.circle[0], map.circle[1], map.circle[2], 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // zone labels (readable from the Defender's side, like the card)
    ctx.font = 'bold 1.6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = (pts, text, col) => {
      let cx = 0, cy = 0; pts.forEach(([x, y]) => { cx += x; cy += y; }); cx /= pts.length; cy /= pts.length;
      ctx.fillStyle = hex(col, 0.9); ctx.fillText(text, cx, cy);
    };
    label(map.zones.a, ((o.names && o.names[att]) || 'Attacker') + ' · Attacker', colA);
    label(map.zones.d, ((o.names && o.names[1 - att]) || 'Defender') + ' · Defender', colD);
  };
  if (o.map) drawMap(o.map, o.attacker);
  for (const l of o.layers || []) if (l.map) drawMap(l.map, l.attacker);      // half-table fields: one card each

  // objectives: 40 mm marker + 3" control range
  for (const ob of o.objectives || []) {
    const [x, y] = ob.pos;
    const col = ob.home != null && o.colors && o.colors[ob.home] ? o.colors[ob.home] : '#F2C94C';
    ctx.beginPath(); ctx.arc(x, y, OBJ_RANGE, 0, Math.PI * 2);
    ctx.fillStyle = hex(col, 0.12); ctx.fill();
    ctx.setLineDash([0.5, 0.35]); ctx.strokeStyle = hex(col, 0.85); ctx.lineWidth = 0.12; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, OBJ_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hex(col, 0.9); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.08; ctx.stroke();
    ctx.font = 'bold 1.1px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ob.name || '', x, y + OBJ_RANGE + 0.9);
  }

  // measuring marks
  for (const m of o.marks || []) {
    const br = (m.base || 0) / 25.4 / 2;                      // base radius in inches (0 = hull / tapped point)
    if (m.kind === 'ring') {
      // range measured from the base edge: the ring is r + base radius from the centre
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + br, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80,220,255,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(80,220,255,0.95)'; ctx.lineWidth = 0.12; ctx.stroke();
      if (br) { ctx.beginPath(); ctx.arc(m.x, m.y, br, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(80,220,255,0.8)'; ctx.lineWidth = 0.08; ctx.stroke(); }
      ctx.font = 'bold 1.2px sans-serif'; ctx.fillStyle = 'rgba(80,220,255,1)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(m.r + '"' + (br ? ' from base edge' : ''), m.x, m.y - m.r - br - 0.8);
    } else if (m.kind === 'tape') {
      // dimension line: a straight line with perpendicular end ticks – the distance counts from tick to tick
      const d = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
      const ux = d ? (m.b[0] - m.a[0]) / d : 1, uy = d ? (m.b[1] - m.a[1]) / d : 0, nx = -uy, ny = ux, tick = 0.9;
      ctx.strokeStyle = 'rgba(255,230,80,0.95)'; ctx.lineWidth = 0.14; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(m.a[0], m.a[1]); ctx.lineTo(m.b[0], m.b[1]); ctx.stroke();
      for (const [x, y] of [m.a, m.b]) { ctx.beginPath(); ctx.moveTo(x + nx * tick, y + ny * tick); ctx.lineTo(x - nx * tick, y - ny * tick); ctx.stroke(); }
      ctx.lineCap = 'round';
      ctx.font = 'bold 1.3px sans-serif'; ctx.fillStyle = 'rgba(255,230,80,1)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.toFixed(1) + '"', (m.a[0] + m.b[0]) / 2 + nx * 1.2, (m.a[1] + m.b[1]) / 2 + ny * 1.2);
    }
  }
  ctx.restore();
}
