/* Geometrie-Helfer (Zoll, Ursprung oben links). Punkte sind {x,y} oder [x,y]. */

export function pt(p) {
  if (!p) return null;
  if (Array.isArray(p)) return { x: +p[0], y: +p[1] };
  return { x: +p.x, y: +p.y };
}

export function dist(a, b) {
  const p = pt(a), q = pt(b);
  if (!p || !q) return Infinity;
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Schneiden sich zwei Kreise (oder berühren sie sich)? */
export function circlesIntersect(c1, r1, c2, r2) {
  return dist(c1, c2) <= r1 + r2 + 1e-9;
}

/** Ray-Casting-Test (Rand zählt als innen). poly = [[x,y], …] */
export function pointInPolygon(p, poly) {
  const q = pt(p);
  if (!q || !Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    // Punkt auf Kante?
    if (pointOnSegment(q, { x: xi, y: yi }, { x: xj, y: yj })) return true;
    const intersect = ((yi > q.y) !== (yj > q.y)) && (q.x < (xj - xi) * (q.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointOnSegment(p, a, b, eps = 1e-9) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > eps) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < -eps) return false;
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= len2 + eps;
}

export function centroid(poly) {
  if (!Array.isArray(poly) || !poly.length) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const v of poly) { sx += v[0]; sy += v[1]; }
  return { x: sx / poly.length, y: sy / poly.length };
}

/** Vorzeichen des Kreuzprodukts: auf welcher Seite der Linie (a→b) liegt p? (+1 / −1 / 0) */
export function sideOfLine(p, a, b) {
  const q = pt(p), A = pt(a), B = pt(b);
  const cross = (B.x - A.x) * (q.y - A.y) - (B.y - A.y) * (q.x - A.x);
  return cross > 1e-9 ? 1 : cross < -1e-9 ? -1 : 0;
}

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function round2(v) { return Math.round(v * 100) / 100; }
