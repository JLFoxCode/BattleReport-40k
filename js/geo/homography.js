/* ═══════════════════════════════════════════════════════════════════
   Homographie (js/geo/homography.js) – rein, ohne DOM, Node-testbar.

   Konventionen
     H = 9 Zahlen, zeilenweise [h11 h12 h13 h21 h22 h23 h31 h32 h33], h33 = 1 (normalisiert).
     apply(H, [u, v]) → [x, y]   (projektiv: w = h31·u + h32·v + h33)
     "Bild" = Pixel (Ursprung oben links), "Tisch" = Zoll (Ursprung oben links, 44 × 60).

   API
     dlt(src, dst)                     → H aus ≥ 4 Punktpaaren (DLT, Hartley-normalisiert)
     apply(H, p) · invert(H) · compose(A, B) (= A·B, B zuerst) · normalize(H) · rescale(H, sx, sy)
     rms(H, pairs)                     → RMS-Abstand ‖apply(H, src) − dst‖ über pairs = [[src, dst], …]
     fitFromSquares(markers, size, o)  → { ok, H, k1, w, h, rms, perMarker, used, anchor }   (SPEC §11)
     markerResiduals(calib, markers)   → [{ id, rms, maxDev, side }]  (Prüfen mit gespeicherter Kalibrierung)
     frameFromCorners(H, corners4, o)  → { H: F·H, F, frameRms, scale, rot }   (Tischrahmen 44 × 60)
     undistort(p, k1, w, h) · distort(p, k1, w, h) · toPlane(calib, p) · fromPlane(calib, p)
     toCss(H, w, h, o) · cssMatrix3d(P)   → CSS-matrix3d für das SVG-Overlay

   Linsenverzerrung (k1): radial um die Bildmitte, normiert mit s = max(w, h) / 2:
     n = (p − c) / s,  n' = n · (1 + k1·|n|²)  (entzerrt),  H wirkt auf entzerrte Pixel.
   ═══════════════════════════════════════════════════════════════════ */

export const TABLE = [44, 60];
export const TABLE_CORNERS = [[0, 0], [44, 0], [44, 60], [0, 60]];   // TL, TR, BR, BL (Angreiferkante oben)

/* ───────── Grundoperationen ───────── */
export function apply(H, p) {
  const u = p[0], v = p[1];
  const w = H[6] * u + H[7] * v + H[8];
  const iw = w === 0 ? 0 : 1 / w;
  return [(H[0] * u + H[1] * v + H[2]) * iw, (H[3] * u + H[4] * v + H[5]) * iw];
}

export function normalize(H) {
  const s = H[8];
  if (!s || !Number.isFinite(s) || Math.abs(s) < 1e-12) {
    const n = Math.hypot(...H) || 1;
    return H.map(x => x / n);
  }
  return H.map(x => x / s);
}

export function compose(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  }
  return normalize(C);
}

export function invert(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det || !Number.isFinite(det)) throw new Error('Homographie nicht invertierbar');
  const inv = [
    A, -(b * i - c * h), b * f - c * e,
    B, a * i - c * g, -(a * f - c * d),
    C, -(a * h - b * g), a * e - b * d
  ].map(x => x / det);
  return normalize(inv);
}

/** H wirkt auf Pixel eines Bildes mit Maß (w, h); für ein skaliertes Bild (w·sx, h·sy) → H · diag(1/sx, 1/sy, 1). */
export function rescale(H, sx, sy = sx) {
  return normalize([H[0] / sx, H[1] / sy, H[2], H[3] / sx, H[4] / sy, H[5], H[6] / sx, H[7] / sy, H[8]]);
}

export const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const isH = H => Array.isArray(H) && H.length === 9 && H.every(Number.isFinite);

export function rms(H, pairs) {
  if (!pairs || !pairs.length) return NaN;
  let s = 0;
  for (const [src, dst] of pairs) {
    const q = apply(H, src);
    s += (q[0] - dst[0]) ** 2 + (q[1] - dst[1]) ** 2;
  }
  return Math.sqrt(s / pairs.length);
}

/* ───────── Lineare Algebra (klein, dicht) ───────── */
function solve(A, b) {           // Gauß mit Spaltenpivot; A: n×n (Array von Zeilen), b: n → x
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) throw new Error('singular');
    if (p !== c) [M[p], M[c]] = [M[c], M[p]];
    const piv = M[c][c];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Eigenvektor zum kleinsten Eigenwert einer symmetrischen Matrix (Jacobi-Rotationen). */
function smallestEigenvector(S) {
  const n = S.length;
  const A = S.map(r => r.slice());
  const V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < n; i++) if (A[i][i] < A[best][best]) best = i;
  return V.map(row => row[best]);
}

function normalizer(pts) {        // Hartley: Schwerpunkt → 0, mittlerer Abstand → √2
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let d = 0;
  for (const p of pts) d += Math.hypot(p[0] - cx, p[1] - cy);
  d /= pts.length;
  const s = d > 1e-12 ? Math.SQRT2 / d : 1;
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
}

/** DLT aus ≥ 4 Punktpaaren: src[i] → dst[i]. */
export function dlt(src, dst) {
  if (!src || !dst || src.length < 4 || src.length !== dst.length) throw new Error('DLT braucht ≥ 4 Punktpaare');
  const Ts = normalizer(src), Td = normalizer(dst);
  const rows = [];
  for (let i = 0; i < src.length; i++) {
    const [u, v] = apply(Ts, src[i]);
    const [x, y] = apply(Td, dst[i]);
    rows.push([-u, -v, -1, 0, 0, 0, x * u, x * v, x]);
    rows.push([0, 0, 0, -u, -v, -1, y * u, y * v, y]);
  }
  const S = Array.from({ length: 9 }, () => new Array(9).fill(0));
  for (const r of rows) for (let i = 0; i < 9; i++) for (let j = i; j < 9; j++) S[i][j] += r[i] * r[j];
  for (let i = 0; i < 9; i++) for (let j = 0; j < i; j++) S[i][j] = S[j][i];
  const h = smallestEigenvector(S);
  return compose(invert(Td), compose(h, Ts));
}

/* ───────── Verzerrung ───────── */
function distParams(k1, w, h) {
  if (!k1 || !w || !h) return null;
  return { cx: w / 2, cy: h / 2, s: Math.max(w, h) / 2, k1 };
}
export function undistort(p, k1, w, h) {
  const d = distParams(k1, w, h);
  if (!d) return [p[0], p[1]];
  const nx = (p[0] - d.cx) / d.s, ny = (p[1] - d.cy) / d.s;
  const f = 1 + d.k1 * (nx * nx + ny * ny);
  return [d.cx + nx * f * d.s, d.cy + ny * f * d.s];
}
export function distort(p, k1, w, h) {
  const d = distParams(k1, w, h);
  if (!d) return [p[0], p[1]];
  const tx = (p[0] - d.cx) / d.s, ty = (p[1] - d.cy) / d.s;
  let nx = tx, ny = ty;
  for (let i = 0; i < 12; i++) {           // Fixpunkt: n = n' / (1 + k1·|n|²)
    const f = 1 + d.k1 * (nx * nx + ny * ny);
    const ex = tx / f - nx, ey = ty / f - ny;
    nx += ex; ny += ey;
    if (ex * ex + ey * ey < 1e-20) break;
  }
  return [d.cx + nx * d.s, d.cy + ny * d.s];
}
/** calib = { H, k1?, w?, h? }: Bildpixel → Tisch (Zoll). */
export function toPlane(calib, p) { return apply(calib.H, undistort(p, calib.k1, calib.w, calib.h)); }
/** calib = { H, k1?, w?, h?, Hinv? }: Tisch (Zoll) → Bildpixel. */
export function fromPlane(calib, p) {
  const Hinv = calib.Hinv || (calib.Hinv = invert(calib.H));
  return distort(apply(Hinv, p), calib.k1, calib.w, calib.h);
}

/* ───────── Levenberg–Marquardt (numerische Jacobi-Matrix) ───────── */
function lm(residualFn, p0, opts = {}) {
  const maxIter = opts.maxIter || 100;
  let p = p0.slice();
  let r = residualFn(p);
  let cost = r.reduce((s, x) => s + x * x, 0);
  let lambda = opts.lambda || 1e-3;
  const n = p.length, m = r.length;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    // Jacobi (Vorwärtsdifferenzen)
    const J = new Array(n);
    for (let k = 0; k < n; k++) {
      const step = 1e-6 * Math.max(1, Math.abs(p[k]));
      const pk = p.slice(); pk[k] += step;
      const rk = residualFn(pk);
      const col = new Float64Array(m);
      for (let i = 0; i < m; i++) col[i] = (rk[i] - r[i]) / step;
      J[k] = col;
    }
    const JtJ = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtr = new Array(n).fill(0);
    for (let a = 0; a < n; a++) {
      const ca = J[a];
      for (let b = a; b < n; b++) {
        const cb = J[b];
        let s = 0;
        for (let i = 0; i < m; i++) s += ca[i] * cb[i];
        JtJ[a][b] = s; JtJ[b][a] = s;
      }
      let s = 0;
      for (let i = 0; i < m; i++) s += ca[i] * r[i];
      Jtr[a] = -s;
    }
    let improved = false;
    for (let tries = 0; tries < 12; tries++) {
      const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v + lambda * Math.max(v, 1e-9) : v)));
      let delta;
      try { delta = solve(A, Jtr); } catch { lambda *= 10; continue; }
      const pn = p.map((v, i) => v + delta[i]);
      const rn = residualFn(pn);
      const cn = rn.reduce((s, x) => s + x * x, 0);
      if (cn < cost) {
        const rel = (cost - cn) / Math.max(cost, 1e-30);
        p = pn; r = rn; cost = cn; lambda = Math.max(lambda / 5, 1e-12); improved = true;
        if (rel < 1e-12 || Math.hypot(...delta) < 1e-12) { iter++; return { p, r, cost, iterations: iter, converged: true }; }
        break;
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  return { p, r, cost, iterations: iter, converged: iter < maxIter };
}

/* ───────── Metrische Entzerrung aus losen Quadraten (SPEC §11) ───────── */
function canonical(S) { return [[0, 0], [S, 0], [S, S], [0, S]]; }
function sqCorner(S, j, tx, ty, th) {
  const c = canonical(S)[j], cs = Math.cos(th), sn = Math.sin(th);
  return [cs * c[0] - sn * c[1] + tx, sn * c[0] + cs * c[1] + ty];
}
/** Starre Passung (Drehung + Verschiebung) des kanonischen Quadrats S auf 4 Punkte q. */
function fitRigid(S, q) {
  const c = canonical(S);
  let mcx = 0, mcy = 0, mqx = 0, mqy = 0;
  for (let j = 0; j < 4; j++) { mcx += c[j][0]; mcy += c[j][1]; mqx += q[j][0]; mqy += q[j][1]; }
  mcx /= 4; mcy /= 4; mqx /= 4; mqy /= 4;
  let num = 0, den = 0;
  for (let j = 0; j < 4; j++) {
    const ax = c[j][0] - mcx, ay = c[j][1] - mcy, bx = q[j][0] - mqx, by = q[j][1] - mqy;
    num += ax * by - ay * bx; den += ax * bx + ay * by;
  }
  const th = Math.atan2(num, den);
  const cs = Math.cos(th), sn = Math.sin(th);
  return { th, tx: mqx - (cs * mcx - sn * mcy), ty: mqy - (sn * mcx + cs * mcy) };
}
function pointRms(res) {        // res: Float64Array [dx, dy, dx, dy, …] → RMS-Punktabstand
  let s = 0;
  for (let i = 0; i < res.length; i += 2) s += res[i] * res[i] + res[i + 1] * res[i + 1];
  return Math.sqrt(s / (res.length / 2));
}

/** Anker wählen: der Marker, dessen Einzel-Homographie die übrigen Marker am besten als Quadrate erklärt
 *  (Median der starren Passungsfehler). Verhindert, dass ein schiefer Anker seinen Fehler auf alle anderen verteilt. */
function pickAnchor(norm, sizes) {
  const n = norm.length;
  if (n < 3) return 0;
  let best = 0, bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    let H0;
    try { H0 = dlt(norm[i], canonical(sizes[i])); } catch { continue; }
    if (!H0.every(Number.isFinite)) continue;
    const errs = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const q = norm[j].map(pt => apply(H0, pt));
      const f = fitRigid(sizes[j], q);
      let e = 0;
      for (let k = 0; k < 4; k++) { const t = sqCorner(sizes[j], k, f.tx, f.ty, f.th); e += (q[k][0] - t[0]) ** 2 + (q[k][1] - t[1]) ** 2; }
      errs.push(Math.sqrt(e / 4));
    }
    errs.sort((a, b) => a - b);
    const score = errs[Math.floor(errs.length / 2)];
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function fitOnce(msIn, sizeOf, useK1, cx, cy, s) {
  const n = msIn.length;
  // Normalisierte Bildkoordinaten (Konditionierung, Verzerrungszentrum)
  const normIn = msIn.map(m => m.corners.map(p => [(p[0] - cx) / s, (p[1] - cy) / s]));
  const a0 = pickAnchor(normIn, msIn.map(sizeOf));
  const ms = [msIn[a0], ...msIn.filter((_, i) => i !== a0)];
  const norm = [normIn[a0], ...normIn.filter((_, i) => i !== a0)];
  const undist = (p, k1) => { if (!k1) return p; const f = 1 + k1 * (p[0] * p[0] + p[1] * p[1]); return [p[0] * f, p[1] * f]; };
  const S0 = sizeOf(ms[0]);
  let H0;
  try { H0 = dlt(norm[0], canonical(S0)); } catch { return null; }
  if (!H0.every(Number.isFinite)) return null;
  const p0 = H0.slice(0, 8);
  for (let i = 1; i < n; i++) {
    const q = norm[i].map(pt => apply(H0, pt));
    const f = fitRigid(sizeOf(ms[i]), q);
    p0.push(f.tx, f.ty, f.th);
  }
  if (useK1) p0.push(0);
  const resid = p => {
    const H = [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 1];
    const k1 = useK1 ? p[p.length - 1] : 0;
    const out = new Float64Array(8 * n);
    for (let i = 0; i < n; i++) {
      const S = sizeOf(ms[i]);
      const tx = i ? p[8 + 3 * (i - 1)] : 0, ty = i ? p[9 + 3 * (i - 1)] : 0, th = i ? p[10 + 3 * (i - 1)] : 0;
      for (let j = 0; j < 4; j++) {
        const q = apply(H, undist(norm[i][j], k1));
        const t = sqCorner(S, j, tx, ty, th);
        out[8 * i + 2 * j] = q[0] - t[0];
        out[8 * i + 2 * j + 1] = q[1] - t[1];
      }
    }
    return out;
  };
  const fit = n > 1 ? lm(resid, p0) : { p: p0, r: resid(p0), iterations: 0, converged: true };
  const p = fit.p;
  const Hn = [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 1];
  const k1 = useK1 ? p[p.length - 1] : 0;
  const per = ms.map((m, i) => ({ id: m.id, size: sizeOf(m), rms: pointRms(fit.r.subarray(8 * i, 8 * i + 8)), used: true }));
  // Entnormalisieren: H_final = Hn · T,  T: (entzerrtes) Pixel → normalisiert
  const T = [1 / s, 0, -cx / s, 0, 1 / s, -cy / s, 0, 0, 1];
  return { H: compose(Hn, T), k1, rms: pointRms(fit.r), per, anchor: ms[0].id, iterations: fit.iterations, converged: fit.converged };
}

/**
 * fitFromSquares(markers, size, opts)
 *   markers: [{ id, corners: [[u,v]×4] (TL,TR,BR,BL wie vom Detektor), size? }]
 *   size:    Standard-Kantenlänge in Zoll (markers[i].size hat Vorrang)
 *   opts:    { k1: bool (nur ab 5 Markern wirksam), width, height (Bildmaß, nötig für k1), minMarkers: 1 }
 * → { ok, H, k1, w, h, rms, perMarker: [{ id, rms, used, size }], used, anchor, iterations }
 *   H bildet (entzerrte) Bildpixel auf die Tischebene ab; Marker `anchor` liegt auf (0,0)-(S,S).
 */
export function fitFromSquares(markers, size, opts = {}) {
  const all = (markers || []).filter(m => m && Array.isArray(m.corners) && m.corners.length === 4 && m.corners.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])));
  const sizeOf = m => (Number(m.size) > 0 ? Number(m.size) : Number(size) > 0 ? Number(size) : 4);
  const w = Number(opts.width) || 0, h = Number(opts.height) || 0;
  const fail = (reason) => ({ ok: false, reason, H: null, k1: 0, w, h, rms: NaN, perMarker: all.map(m => ({ id: m.id, size: sizeOf(m), rms: NaN, used: false })), used: 0, anchor: null, iterations: 0 });
  if (!all.length) return fail('Keine Marker');
  // Normalisierung: Bildmitte, wenn bekannt (nötig für k1), sonst Schwerpunkt der Ecken
  let cx, cy, s;
  if (w && h) { cx = w / 2; cy = h / 2; s = Math.max(w, h) / 2; }
  else {
    const pts = all.flatMap(m => m.corners);
    cx = pts.reduce((a, p) => a + p[0], 0) / pts.length; cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    s = Math.max(1, ...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  }
  let active = all.slice();
  const dropped = new Map();
  const useK1For = n => !!opts.k1 && n >= 5 && w > 0 && h > 0;
  const minOutlier = opts.minOutlier != null ? opts.minOutlier : 0.02;
  // Ausreißer per Leave-one-out: Passung OHNE Marker i. Ein schiefer Marker verfälscht jede Passung, in der er
  // steckt (auch H/k1) – nur die Passung ohne ihn ist sauber. Kriterium: RMS ohne i < Median(RMS ohne j) / 3
  // (und sein eigenes Residuum unter dieser Passung > 3 × diese RMS, mind. minOutlier). Je Runde ein Marker.
  for (let round = 0; round < all.length && active.length >= 4; round++) {
    const info = active.map((m, i) => {
      const rest = active.filter((_, j) => j !== i);
      const r = fitOnce(rest, sizeOf, useK1For(rest.length), cx, cy, s);
      if (!r) return { rms: Infinity, own: Infinity };
      return { rms: r.rms, own: markerResiduals({ H: r.H, k1: r.k1, w, h }, [m], sizeOf(m))[0].rms };
    });
    const sorted = info.map(x => x.rms).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    let best = 0;
    for (let i = 1; i < info.length; i++) if (info[i].rms < info[best].rms) best = i;
    const b = info[best];
    if (!(med > minOutlier) || !(b.rms < med / 3) || !(b.own > Math.max(minOutlier, 3 * b.rms))) break;
    dropped.set(active[best].id, b.own);
    active = active.filter((_, i) => i !== best);
  }
  let res = fitOnce(active, sizeOf, useK1For(active.length), cx, cy, s);
  if (!res) return fail('Marker-Geometrie entartet');
  if (active.length === 3) {                                  // kleiner Satz: klassische Regel auf der Passung selbst
    const sorted = res.per.map(p => p.rms).sort((a, b) => a - b);
    const thr = Math.max(3 * sorted[1], minOutlier);
    const bad = res.per.filter(p => p.rms > thr);
    if (bad.length === 1) {
      for (const b of bad) dropped.set(b.id, b.rms);
      active = active.filter(m => !dropped.has(m.id));
      res = fitOnce(active, sizeOf, false, cx, cy, s) || res;
    }
  }
  const perMarker = all.map(m => {
    const p = res.per.find(x => x.id === m.id);
    return p ? { id: m.id, size: p.size, rms: p.rms, used: true } : { id: m.id, size: sizeOf(m), rms: dropped.get(m.id) ?? NaN, used: false };
  });
  return {
    ok: Number.isFinite(res.rms) && res.H.every(Number.isFinite) && active.length >= (opts.minMarkers || 1),
    H: res.H, k1: res.k1, w, h, rms: res.rms, perMarker, used: active.length, anchor: res.anchor,
    iterations: res.iterations, converged: res.converged
  };
}

/**
 * markerResiduals(calib, markers): Marker unter gespeicherter Kalibrierung prüfen.
 * → [{ id, rms (Zoll), maxDev (größte Abweichung einer Ecke), side (mittlere Seitenlänge), size }]
 */
export function markerResiduals(calib, markers, defaultSize = 4) {
  return (markers || []).map(m => {
    const S = Number(m.size) > 0 ? Number(m.size) : defaultSize;
    const q = m.corners.map(p => toPlane(calib, p));
    const f = fitRigid(S, q);
    let sum = 0, max = 0, side = 0;
    for (let j = 0; j < 4; j++) {
      const t = sqCorner(S, j, f.tx, f.ty, f.th);
      const d = Math.hypot(q[j][0] - t[0], q[j][1] - t[1]);
      sum += d * d; max = Math.max(max, d);
      side += Math.hypot(q[j][0] - q[(j + 1) % 4][0], q[j][1] - q[(j + 1) % 4][1]) / 4;
    }
    return { id: m.id, size: S, rms: Math.sqrt(sum / 4), maxDev: max, side };
  });
}

/* ───────── Tischrahmen ───────── */
/**
 * frameFromCorners(H, corners4, opts)
 *   corners4: 4 Punkte TL, TR, BR, BL der Platte (Angreiferkante = oben) – Bildpixel,
 *             oder bereits Tischebene (opts.inPlane). Mit H = null (oder opts.full) wird eine volle
 *             Homographie Bild → 44×60 per DLT bestimmt (manuelle Kalibrierung ohne Marker).
 *   opts: { k1, w, h, inPlane, rigid (kein Maßstab), full, table: [44, 60] }
 * → { H: F·H (Bild → Tisch 0..44 × 0..60), F, frameRms, scale, rot (rad) }
 */
export function frameFromCorners(H, corners4, opts = {}) {
  const [TW, TH] = opts.table || TABLE;
  const target = [[0, 0], [TW, 0], [TW, TH], [0, TH]];
  if (!corners4 || corners4.length !== 4) throw new Error('4 Tischecken nötig');
  if (!H || opts.full) {
    const Hf = dlt(corners4, target);
    return { H: Hf, F: null, frameRms: rms(Hf, corners4.map((c, i) => [c, target[i]])), scale: 1, rot: 0 };
  }
  const calib = { H, k1: opts.k1 || 0, w: opts.w, h: opts.h };
  const pl = opts.inPlane ? corners4 : corners4.map(c => toPlane(calib, c));
  // Ähnlichkeit x' = a x − b y + tx, y' = b x + a y + ty  (bzw. starr: a² + b² = 1)
  let F;
  if (opts.rigid) {
    let mx = 0, my = 0, tx = 0, ty = 0;
    for (let j = 0; j < 4; j++) { mx += pl[j][0]; my += pl[j][1]; tx += target[j][0]; ty += target[j][1]; }
    mx /= 4; my /= 4; tx /= 4; ty /= 4;
    let num = 0, den = 0;
    for (let j = 0; j < 4; j++) {
      const ax = pl[j][0] - mx, ay = pl[j][1] - my, bx = target[j][0] - tx, by = target[j][1] - ty;
      num += ax * by - ay * bx; den += ax * bx + ay * by;
    }
    const th = Math.atan2(num, den), a = Math.cos(th), b = Math.sin(th);
    F = [a, -b, tx - (a * mx - b * my), b, a, ty - (b * mx + a * my), 0, 0, 1];
  } else {
    const A = [], y = [];
    for (let j = 0; j < 4; j++) {
      A.push([pl[j][0], -pl[j][1], 1, 0]); y.push(target[j][0]);
      A.push([pl[j][1], pl[j][0], 0, 1]); y.push(target[j][1]);
    }
    const AtA = Array.from({ length: 4 }, () => new Array(4).fill(0)), Aty = new Array(4).fill(0);
    for (let r = 0; r < A.length; r++) for (let i = 0; i < 4; i++) { Aty[i] += A[r][i] * y[r]; for (let k = 0; k < 4; k++) AtA[i][k] += A[r][i] * A[r][k]; }
    const [a, b, tx, ty] = solve(AtA, Aty);
    F = [a, -b, tx, b, a, ty, 0, 0, 1];
  }
  const Hf = compose(F, H);
  const scale = Math.hypot(F[0], F[3]);
  return { H: Hf, F, frameRms: rms(F, pl.map((p, i) => [p, target[i]])), scale, rot: Math.atan2(F[3], F[0]) };
}

/* ───────── CSS ───────── */
/** 3×3-Projektivmatrix → CSS matrix3d(...) (transform-origin: 0 0). */
export function cssMatrix3d(P) {
  const f = x => (Math.abs(x) < 1e-12 ? 0 : +x.toPrecision(10));
  return `matrix3d(${f(P[0])},${f(P[3])},0,${f(P[6])},${f(P[1])},${f(P[4])},0,${f(P[7])},0,0,1,0,${f(P[2])},${f(P[5])},0,${f(P[8])})`;
}
/**
 * toCss(H, w, h, o): CSS-Transform für ein Overlay-Element, das 44 × 60 Zoll darstellt und
 * auf das (unverzerrte) Bild gelegt wird. H: Bild (Pixel, w × h) → Tisch (Zoll).
 *   o.elem    = [W, Hgt] CSS-Größe des Overlay-Elements in px (Standard: [44, 60] → 1 px = 1 Zoll)
 *   o.display = [dw, dh] CSS-Größe, in der das Bild angezeigt wird (Standard: [w, h])
 *   o.table   = [44, 60]
 *   o.inverse = true → Transform für das <img> (w × h, angezeigt dw × dh), damit es entzerrt
 *               als Draufsicht in einem Element der Größe elem erscheint (CSS-Rektifizierung ohne k1).
 * Element: position:absolute; left:0; top:0; transform-origin: 0 0.
 */
export function toCss(H, w, h, o = {}) {
  const [TW, TH] = o.table || TABLE;
  const [EW, EH] = o.elem || [TW, TH];
  const [DW, DH] = o.display || [w, h];
  if (o.inverse) {
    // img-Pixel (CSS dw×dh) → Bildpixel → Zoll → Element-px
    const P = compose([EW / TW, 0, 0, 0, EH / TH, 0, 0, 0, 1], compose(H, [w / DW, 0, 0, 0, h / DH, 0, 0, 0, 1]));
    return cssMatrix3d(P);
  }
  // Element-px → Zoll → Bildpixel → CSS-px des angezeigten Bildes
  const P = compose([DW / w, 0, 0, 0, DH / h, 0, 0, 0, 1], compose(invert(H), [TW / EW, 0, 0, 0, TH / EH, 0, 0, 0, 1]));
  return cssMatrix3d(P);
}
