/* Random terrain layout generator – competitive, fair, GW-style. Pure functions (unit-tested with node).
 *
 * Fairness by construction: every layout is point-symmetric about the battlefield centre (180° rotation), so both
 * players get the same terrain. Competitive by rules checked on every candidate:
 *   - the standard tournament set: Strike Force 44"×60" = 6× 12"×6" tall ruins, 2× 10"×5" tall, 4× 6"×4" low;
 *     Incursion 44"×30" = 3× 12"×6", 1× 10"×5", 2× 6"×4"
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
 *  gw10       – Chapter Approved 2025-26 tournament set: 12"×6" ×6, 10"×5" ×2 (tall), 6"×4" ×4 (low)
 *  half       – Incursion 44"×30": half a set */
export const SETS = {
  armageddon: { size: [44, 60], centre: [8, 11.5, true], pieces: [[7, 11.5, true], [7, 11.5, true], [6, 4, false], [6, 4, false], [10, 2.5, false], [6, 2, false], [6, 2, false]] },
  gw10: { size: [44, 60], centre: [12, 6, true], pieces: [[12, 6, true], [12, 6, true], [10, 5, true], [6, 4, false], [6, 4, false]] },
  half: { size: [44, 30], centre: [8, 11.5, true], pieces: [[7, 11.5, true], [6, 4, false], [6, 2, false]] }
};
SETS.full = SETS.armageddon;

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- geometry
const corners = p => {
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), hw = p.w / 2, hh = p.h / 2;
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
  const fits = poly => poly.every(c => c[0] >= 1 && c[0] <= W - 1 && c[1] >= 1 && c[1] <= L - 1) && polys.every(q => gap(poly, q) >= 2);
  const add = (p, m) => { placed.push(p); polys.push(corners(p)); if (m) { placed.push(m); polys.push(corners(m)); } };
  // objectives of the first half (their partners are the mirror images); the centre one separately
  const objs = (objectives || []).filter(o => Math.hypot(o[0] - cx, o[1] - cy) > 1);
  const firstHalf = []; const used = new Set();
  for (let i = 0; i < objs.length; i++) {
    if (used.has(i)) continue;
    const o = objs[i];
    const j = objs.findIndex((q, k) => k !== i && !used.has(k) && Math.hypot(q[0] - (W - o[0]), q[1] - (L - o[1])) < 1);
    if (j >= 0) used.add(j);
    used.add(i); firstHalf.push(o);
  }
  const hasCentre = (objectives || []).some(o => Math.hypot(o[0] - cx, o[1] - cy) <= 1);
  const pieces = set.pieces.slice();
  const tallIdx = pieces.map((p, i) => (p[2] ? i : -1)).filter(i => i >= 0);
  // centre piece
  if (set.centre && (hasCentre || !objectives || !objectives.length)) {
    const [w, h, tall] = set.centre;
    const rot = ROTS[Math.floor(rand() * ROTS.length)];
    const p = { kind: 'ruin', w, h, rot, tall, x: cx, y: cy };
    if (!fits(corners(p))) return null;
    add(p, null);
  }
  // one tall piece over each first-half objective, the objective well inside the footprint
  const cover = [];
  for (const o of firstHalf) {
    const k = tallIdx.find(i => !cover.includes(i));
    if (k === undefined) break;
    cover.push(k);
    const [w, h, tall] = pieces[k];
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const rot = ROTS[Math.floor(rand() * ROTS.length)], r = rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      const lx = (rand() - 0.5) * (w - 3), ly = (rand() - 0.5) * (h - 3);           // objective ≥ 1.5" inside the edges
      const p = { kind: 'ruin', w, h, rot, tall, x: +(o[0] - (lx * c - ly * sn)).toFixed(2), y: +(o[1] - (lx * sn + ly * c)).toFixed(2) };
      const m = { kind: 'ruin', w, h, rot, tall, x: +(W - p.x).toFixed(2), y: +(L - p.y).toFixed(2) };
      const pp = corners(p), mp = corners(m);
      if (!fits(pp) || gap(pp, mp) < 2 || !fits(mp)) continue;
      add(p, m); ok = true;
    }
    if (!ok) return null;
  }
  // the rest at random
  for (let i = 0; i < pieces.length; i++) {
    if (cover.includes(i)) continue;
    const [w, h, tall] = pieces[i];
    let ok = false;
    for (let t = 0; t < 40 && !ok; t++) {
      const rot = ROTS[Math.floor(rand() * ROTS.length)];
      const p = { kind: 'ruin', w, h, rot, tall, x: +(1 + rand() * (W - 2)).toFixed(2), y: +(1 + rand() * (L / 2 + 3)).toFixed(2) };
      const m = { kind: 'ruin', w, h, rot, tall, x: +(W - p.x).toFixed(2), y: +(L - p.y).toFixed(2) };
      const pp = corners(p), mp = corners(m);
      if (!fits(pp) || gap(pp, mp) < 2 || !fits(mp)) continue;
      add(p, m); ok = true;
    }
    if (!ok) return null;
  }
  return placed;
}

export const FAIL = {};                      // why candidates were rejected (debugging / tuning)
const fail = why => { FAIL[why] = (FAIL[why] || 0) + 1; return false; };
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
      if (cov / n > 0.34) return fail('zone blocked');
    }
  }
  // no open lane along the long axis (sampled every 3", ≥ 90 % of them blocked by a tall piece)
  let lanes = 0, lanesBlocked = 0;
  for (let x = 2; x <= W - 2; x += 3) { lanes++; if (tallPolys.some(t => segHits([x, 0], [x, L], t))) lanesBlocked++; }
  if (lanesBlocked < lanes * 0.9) return fail('lane');
  // 11th edition: every objective lies within a terrain area (well inside it)
  for (const o of objectives || []) {
    if (!polys.some(p => inPoly(o, p) && distToPoly(o, p) === 0)) return fail('objective outside terrain');
  }
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
  if (frac < 0.7) return fail('too open');
  if (frac > 0.97) return fail('too closed');
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
  let best = null;
  const tries = opts.tries || 1500;
  for (let i = 0; i < tries; i++) {
    const pieces = candidate(rand, set, opts.objectives || []);
    if (!pieces) { FAIL.placement = (FAIL.placement || 0) + 1; continue; }
    const score = evaluate(pieces, set, opts.objectives || [], opts.zones || null);
    if (score === false) continue;
    if (!best || score > best.score) best = { pieces, score };
  }
  if (!best) return null;
  const pieces = best.pieces.map((p, i) => Object.assign({ id: 'g' + i }, p, p.tall ? { walls: wallsFor(p, set) } : {}));
  return { seed, pieces, score: best.score, tries, size: set.size };
}
