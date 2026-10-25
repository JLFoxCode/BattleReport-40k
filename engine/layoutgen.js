/* Random terrain layout generator – competitive, fair, GW-style. Pure functions (unit-tested with node).
 *
 * Fairness by construction: every layout is point-symmetric about the battlefield centre (180° rotation), so both
 * players get the same terrain. Competitive by rules checked on every candidate:
 *   - the standard tournament set: Strike Force 44"×60" = 6× 12"×6" tall ruins, 2× 10"×5" tall, 4× 6"×4" low;
 *     half table 44"×30" (casual; 11th-edition Incursion uses the full 44"×60") = 3× 12"×6", 1× 10"×5", 2× 6"×4"
 *   - pieces fully on the board, ≥ 2" apart (model movement), ≥ 1" from the edge
 *   - no open firing lane along the long axis: every straight line from one short edge to the other (sampled every
 *     2") crosses a tall piece; most lines between the two deployment bands are blocked (≥ 70 %)
 *   - every objective has a tall piece within 6" (cover to fight over) but no piece within 1.5" of the marker
 *   - the centre has a tall piece within 8"; each table quarter has at least one tall piece
 * Candidates are drawn from a seeded RNG and scored; the best of N is returned (deterministic per seed).
 * Output: the data/terrain.js piece format { kind, x, y, w, h, rot, tall, walls }, with the L-walls of tall pieces
 * facing the centre. */

/* Piece sets: one half of the battlefield; the generator mirrors every piece through the centre (180°), except the
 * optional centre piece ('centre': true) which sits on the central objective and is its own mirror image.
 *  armageddon – Warhammer 40,000 11th edition Event Companion (Oct 2026) terrain area footprints: 7"×11.5" ×4 and
 *               8"×11.5" ×2 (dense ruins, tall), 6"×4" ×4, 10"×2.5" ×2, 6"×2" ×4 (light, low) = 16 areas
 *  half       – half table 44"×30" (casual game on half a table): half a set */
import { LAYOUTS11 } from '../data/layouts11.js';
/* Calibrated on the 45 official layouts (measured 2026-10-23): 12 dense + 4 light areas – dense: 7×11.5 ×4,
 * 8×11.5 polygon ×2 (the central block), 10×2.5 ×2, 6×4 ×2, 6×2 ×2; light: 6×4 ×2, 6×2 ×2. Sightlines between the
 * deployment zones 94–100 % blocked, 14–27 % of each zone covered by terrain, areas may touch, ≥ 1.9" from the edge,
 * objectives (nearly) always inside dense areas, the central objective inside the interlocking 8×11.5 pair. */
export const SETS = {
  armageddon: { size: [44, 60], centreBlock: true, pieces: [[7, 11.5, true], [7, 11.5, true], [10, 2.5, true], [6, 4, true], [6, 4, false], [6, 2, true], [6, 2, false]] },
  half: { size: [44, 30], centre: 'wedge', pieces: [[7, 11.5, true], [6, 4, true], [6, 2, false]] }   // half the Armageddon set: one wedge plate in the centre, 2× 7×11.5, 2× 6×4, 2× 6×2
};
SETS.full = SETS.armageddon;
/** The official centre block of the Event Companion layouts: one 12"×10" rectangle (the two interlocking plates) with its
 *  ruin parts and cover pieces in the corners; reused by the generator at any angle. WEDGE = one of the card's separated
 *  8"×11.5" wedge plates (outline in its local frame) with its parts, for the point-symmetric pair. */
const CENTRE_BLOCK = (() => {
  const b = LAYOUTS11.flatMap(l => l.pieces).find(p => p.w === 12 && p.h === 10 && !p.poly);
  return b ? { w: 12, h: 10, rot: b.rot || 0, parts: b.parts || [] } : null;
})();
const WEDGE = (() => {
  const p = LAYOUTS11.flatMap(l => l.pieces).find(p => p.poly);
  return p ? { w: p.w, h: p.h, rot: p.rot || 0, poly: p.poly, parts: p.parts || [] } : null;
})();
/** The official parts of a piece turned with it: positions and rotations relative to the piece's centre (table orientation). */
/** Official features per footprint (first Event Companion plate of that size and class): generated plates get the same
 *  ruin sections / cover pieces, turned with the plate. */
const PARTS_BY_SIZE = (() => {
  const m = {};
  for (const L of LAYOUTS11) for (const p of L.pieces) {
    if (p.poly || !p.parts || !p.parts.length) continue;
    const k = `${p.w}x${p.h}:${p.tall ? 1 : 0}`;
    if (!m[k]) m[k] = { rot: p.rot || 0, parts: p.parts };
  }
  return m;
})();
const withParts = (p) => {
  if (p.parts) return p;
  const tpl = PARTS_BY_SIZE[`${p.w}x${p.h}:${p.tall ? 1 : 0}`] || PARTS_BY_SIZE[`${p.h}x${p.w}:${p.tall ? 1 : 0}`];
  if (!tpl) return p;
  const swapped = !PARTS_BY_SIZE[`${p.w}x${p.h}:${p.tall ? 1 : 0}`];           // template drawn with w/h the other way round
  p.parts = partsAt(tpl, (p.rot || 0) + (swapped ? 90 : 0));
  return p;
};
const partsAt = (tpl, rot) => {
  const a = (rot - tpl.rot) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return tpl.parts.map(pt => Object.assign({}, pt, { x: +(pt.x * c - pt.y * s).toFixed(2), y: +(pt.x * s + pt.y * c).toFixed(2), rot: ((pt.rot || 0) + rot - tpl.rot + 360) % 360 }));
};
export const FAIL = {};                      // why candidates were rejected (debugging / tuning)
const fail = why => { FAIL[why] = (FAIL[why] || 0) + 1; return false; };
const EDGE = 1.5;                            // official footprints keep ≥ 1.9" from the table edge (their features may overhang)
const rotPoint = ([x, y], q) => { const a = q * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- geometry
const corners = p => {
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  if (p.poly) return p.poly.map(([dx, dy]) => [p.x + dx * c - dy * s, p.y + dx * s + dy * c]);
  const hw = p.w / 2, hh = p.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => [p.x + dx * c - dy * s, p.y + dx * s + dy * c]);
};
const axes = poly => poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
const proj = (poly, ax) => { let lo = Infinity, hi = -Infinity; for (const p of poly) { const v = p[0] * ax[0] + p[1] * ax[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
/** separating-axis gap between two convex polygons (≥ 0 = apart by that much, < 0 = overlapping) */
export function gap(a, b) {
  let best = -Infinity;
  for (const ax of axes(a).concat(axes(b))) { const [l1, h1] = proj(a, ax), [l2, h2] = proj(b, ax); best = Math.max(best, Math.max(l2 - h1, l1 - h2)); }
  return best;
}
const segCross = (p, q, a, b) => { const d = (x1, y1, x2, y2, x3, y3) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1); const d1 = d(p[0], p[1], q[0], q[1], a[0], a[1]), d2 = d(p[0], p[1], q[0], q[1], b[0], b[1]), d3 = d(a[0], a[1], b[0], b[1], p[0], p[1]), d4 = d(a[0], a[1], b[0], b[1], q[0], q[1]); return d1 * d2 < 0 && d3 * d4 < 0; };
const inPoly = (pt, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
/** does the segment p–q pass through the polygon? */
export function segHits(p, q, poly) {
  if (inPoly(p, poly) || inPoly(q, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (segCross(p, q, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
}
const distToPoly = (pt, poly) => { if (inPoly(pt, poly)) return 0; let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const vx = b[0] - a[0], vy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / (vx * vx + vy * vy || 1))); d = Math.min(d, Math.hypot(pt[0] - a[0] - vx * t, pt[1] - a[1] - vy * t)); } return d; };

// ---------------------------------------------------------------- generation
// mostly axis-aligned like the GW layouts, sometimes diagonal
const ROTS = [0, 90, 0, 90, 0, 90, 45, 135, 0, 90];
/** Constructive: 11th edition puts every objective inside a terrain area, so the tall pieces are placed over the
 *  objectives first (one per objective of the first half; the mirror image covers the partner objective; the centre
 *  objective gets the self-symmetric centre piece). The remaining pieces are placed one by one with their mirror
 *  images, rejecting positions that leave the board or come closer than 2" to anything placed so far. */
function candidate(rand, set, objectives) {
  const [W, L] = set.size, cx = W / 2, cy = L / 2;
  const placed = [], polys = [];
  const fits = poly => poly.every(c => c[0] >= EDGE && c[0] <= W - EDGE && c[1] >= EDGE && c[1] <= L - EDGE) && polys.every(q => gap(poly, q) >= 0);
  const add = (p, m) => { placed.push(withParts(p)); polys.push(corners(p)); if (m) { placed.push(withParts(m)); polys.push(corners(m)); } };
  // objectives of the first half (their partners are the mirror images); the centre one separately
  // one central objective near the middle (the official single-central layouts put it up to ~4" off centre, inside
  // the interlocking block); two central objectives → the polygons go elsewhere as a pair
  const centrals = (objectives || []).filter(o => Math.hypot(o[0] - cx, o[1] - cy) <= 5);
  const hasCentre = centrals.length === 1;
  const objs = (objectives || []).filter(o => !(centrals.length === 1 && o === centrals[0]));
  const firstHalf = []; const used = new Set();
  for (let i = 0; i < objs.length; i++) {
    if (used.has(i)) continue;
    const o = objs[i];
    const j = objs.findIndex((q, k) => k !== i && !used.has(k) && Math.hypot(q[0] - (W - o[0]), q[1] - (L - o[1])) < 1);
    if (j >= 0) used.add(j);
    used.add(i); firstHalf.push(o);
  }
  let pieces = set.pieces.slice();
  // the 8×11.5 polygon pair: with a single central objective the official interlocking centre block (17 of the 45
  // official layouts, at any angle), otherwise a normal point-symmetric pair placed like the other pieces
  const useBlock = set.centreBlock && CENTRE_BLOCK && hasCentre;
  if (set.centreBlock && WEDGE && !useBlock) pieces = [[WEDGE.w, WEDGE.h, true, WEDGE.poly]].concat(pieces);
  const tallIdx = pieces.map((p, i) => (p[2] ? i : -1)).filter(i => i >= 0);
  if (useBlock) {
    const ang = 15 * Math.floor(rand() * 24);
    const block = { kind: 'ruin', w: CENTRE_BLOCK.w, h: CENTRE_BLOCK.h, rot: ang, tall: true, x: cx, y: cy, parts: partsAt(CENTRE_BLOCK, ang) };
    if (!corners(block).every(c => c[0] >= EDGE && c[0] <= W - EDGE && c[1] >= EDGE && c[1] <= L - EDGE)) { FAIL.centre = (FAIL.centre || 0) + 1; return null; }
    placed.push(block); polys.push(corners(block));
  } else if (set.centre && (hasCentre || !objectives || !objectives.length)) {
    const rot = ROTS[Math.floor(rand() * ROTS.length)];
    const p = set.centre === 'wedge' && WEDGE
      ? { kind: 'ruin', w: WEDGE.w, h: WEDGE.h, rot, tall: true, x: cx, y: cy, poly: WEDGE.poly, parts: partsAt(WEDGE, rot) }   // one of the card's wedge plates with its parts
      : (([w, h, tall]) => ({ kind: 'ruin', w, h, rot, tall, x: cx, y: cy }))(set.centre);
    if (!fits(corners(p))) return null;
    add(p, null);
  }
  // one tall piece over each first-half objective, the objective well inside the footprint
  const cover = [];
  for (const o of firstHalf) {
    if (polys.some(q => inPoly(o, q))) continue;                 // already inside the centre block
    const k = tallIdx.find(i => !cover.includes(i));
    if (k === undefined) break;
    cover.push(k);
    const [w, h, tall, shape] = pieces[k];
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const rot = ROTS[Math.floor(rand() * ROTS.length)], r = rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      const lx = (rand() - 0.5) * (w - 3), ly = (rand() - 0.5) * (h - 3);           // objective ≥ 1.5" inside the edges
      const p = Object.assign({ kind: 'ruin', w, h, rot, tall, x: +(o[0] - (lx * c - ly * sn)).toFixed(2), y: +(o[1] - (lx * sn + ly * c)).toFixed(2) }, shape ? { poly: shape, parts: partsAt(WEDGE, rot) } : {});
      const m = Object.assign({ kind: 'ruin', w, h, rot: shape ? (rot + 180) % 360 : rot, tall, x: +(W - p.x).toFixed(2), y: +(L - p.y).toFixed(2) }, shape ? { poly: shape, parts: partsAt(WEDGE, (rot + 180) % 360) } : {});
      const pp = corners(p), mp = corners(m);
      if (!fits(pp) || gap(pp, mp) < 0 || !fits(mp)) continue;
      add(p, m); ok = true;
    }
    if (!ok) { FAIL.cover = (FAIL.cover || 0) + 1; return null; }
  }
  // the rest at random
  for (let i = 0; i < pieces.length; i++) {
    if (cover.includes(i)) continue;
    const [w, h, tall, shape] = pieces[i];
    let ok = false;
    for (let t = 0; t < 40 && !ok; t++) {
      const rot = ROTS[Math.floor(rand() * ROTS.length)];
      const p = Object.assign({ kind: 'ruin', w, h, rot, tall, x: +(1 + rand() * (W - 2)).toFixed(2), y: +(1 + rand() * (L / 2 + 3)).toFixed(2) }, shape ? { poly: shape, parts: partsAt(WEDGE, rot) } : {});
      const m = Object.assign({ kind: 'ruin', w, h, rot: shape ? (rot + 180) % 360 : rot, tall, x: +(W - p.x).toFixed(2), y: +(L - p.y).toFixed(2) }, shape ? { poly: shape, parts: partsAt(WEDGE, (rot + 180) % 360) } : {});
      const pp = corners(p), mp = corners(m);
      if (!fits(pp) || gap(pp, mp) < 0 || !fits(mp)) continue;
      add(p, m); ok = true;
    }
    if (!ok) { FAIL.rest = (FAIL.rest || 0) + 1; return null; }
  }
  return placed;
}


/** random point inside a polygon (rejection sampling in its bounding box) */
function pointIn(poly, r) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let i = 0; i < 40; i++) { const p = [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0)]; if (inPoly(p, poly)) return p; }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}
/** Hard rules → false, else a score (higher = better).
 *  objectives: [[x, y], …] (inches) or []; zones: { a, d } deployment polygons of the card (optional). */
export function evaluate(pieces, set, objectives, zones) {
  const [W, L] = set.size;
  const polys = pieces.map(corners);
  const tallPolys = polys.filter((_, i) => pieces[i].tall);
  // deployment zones: at most a third of each zone covered by terrain (room to deploy)
  if (zones) {
    const r0 = rng(777);
    for (const z of [zones.a, zones.d]) {
      let cov = 0, n = 60;
      for (let k = 0; k < n; k++) { const pt = pointIn(z, r0); if (polys.some(q => inPoly(pt, q))) cov++; }
      if (cov / n > 0.30) return fail('zone blocked');
      if (cov / n < 0.10) return fail('zone bare');
    }
  }
  // no open lane along the long axis (sampled every 3", ≥ 90 % of them blocked by a tall piece)
  let lanes = 0, lanesBlocked = 0;
  for (let x = 2; x <= W - 2; x += 2) { lanes++; if (tallPolys.some(t => segHits([x, 0], [x, L], t))) lanesBlocked++; }
  if (lanesBlocked < lanes * 0.7) return fail('lane');
  // 11th edition: every objective lies within a terrain area – home and central ones inside a dense (tall) area
  for (const o of objectives || []) {
    // the interlocking centre polygons count as one terrain area: a marker in their seam is inside
    const inside = polys.filter((p, i) => inPoly(o, p) || (pieces[i].poly && distToPoly(o, p) < 2));
    if (!inside.length) return fail('objective outside terrain');
    const central = Math.hypot(o[0] - W / 2, o[1] - L / 2) < 8, home = Math.min(o[1], L - o[1]) < 16;
    if ((central || home) && !inside.some(p => tallPolys.includes(p))) return fail('objective not in dense');
  }
  // dense terrain inside each deployment zone (the official layouts have 2–8 tall areas in the zones)
  if (zones) for (const z of [zones.a, zones.d]) if (!pieces.some(p => p.tall && inPoly([p.x, p.y], z))) return fail('zone without dense');
  // centre covered, every quarter has a tall piece
  if (!tallPolys.some(t => distToPoly([W / 2, L / 2], t) <= 8)) return fail('centre open');
  const quarters = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([qx, qy]) => pieces.some(p => (p.x < W / 2) === (qx === 0) && (p.y < L / 2) === (qy === 0)));
  if (quarters.some(q => !q)) return fail('empty quarter');
  // score: fraction of blocked sightlines between the two deployment zones of the card (else the 12" bands at the
  // short edges)
  let blocked = 0, n = 0;
  const r = rng(12345);
  for (let k = 0; k < 200; k++) {
    const a = zones ? pointIn(zones.a, r) : [r() * W, r() * 12], b = zones ? pointIn(zones.d, r) : [r() * W, L - r() * 12];
    n++; if (tallPolys.some(t => segHits(a, b, t))) blocked++;
  }
  const frac = blocked / n;
  if (frac < 0.92) return fail('too open');
  // prefer spread: mean nearest-neighbour gap around 3–6"
  let spread = 0;
  for (let i = 0; i < polys.length; i++) { let g = Infinity; for (let j = 0; j < polys.length; j++) if (j !== i) g = Math.min(g, gap(polys[i], polys[j])); spread += Math.min(g, 8); }
  spread /= polys.length;
  return frac * 100 + spread * 2;
}

/** Walls: the L of a tall piece faces the centre (two edges towards the centre). */
function wallsFor(p, set) {
  const [W, L] = set.size;
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = W / 2 - p.x, dy = L / 2 - p.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;       // centre in the piece's local frame
  return (lx >= 0 ? 'e' : 'w') + (ly >= 0 ? 's' : 'n');
}

/** generate({ seed, board: 'full' | 'half', objectives, tries }) → { seed, pieces, score, tries } (pieces in table
 *  inches for the full table; for 'half' the y of the chosen half must be added by the caller). */
export function generate(opts = {}) {
  const set = SETS[opts.board === 'half' ? 'half' : (opts.set && SETS[opts.set]) ? opts.set : 'armageddon'];
  const seed = (opts.seed >>> 0) || Math.floor(Math.random() * 0xffffffff);
  const rand = rng(seed);
  let best = null, valid = 0;
  const tries = opts.tries || 1500, enough = opts.enough || 12;     // best of the first `enough` valid candidates
  for (let i = 0; i < tries && valid < enough; i++) {
    const pieces = candidate(rand, set, opts.objectives || []);
    if (!pieces) { FAIL.placement = (FAIL.placement || 0) + 1; continue; }
    const score = evaluate(pieces, set, opts.objectives || [], opts.zones || null);
    if (score === false) continue;
    valid++;
    if (!best || score > best.score) best = { pieces, score };
  }
  if (!best) return null;
  const pieces = best.pieces.map((p, i) => Object.assign({ id: 'g' + i }, p, p.tall && !p.poly ? { walls: wallsFor(p, set) } : {}));
  return { seed, pieces, score: best.score, tries, size: set.size };
}
