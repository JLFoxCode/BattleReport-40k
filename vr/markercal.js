/* Marker calibration – pure maths, no DOM / three.js (unit-tested with node).
 *
 * The four printed corner sheets (vr/print/table-markers-10x15.pdf) put one square ArUco marker in each table corner,
 * its centre 50 mm from both table edges, its edges parallel to the table edges. The Quest's passthrough camera
 * (vr/camera.js) sees the markers; the headset reports its own pose (WebXR viewer pose) for every camera frame.
 *
 * Unknowns, solved from a handful of frames taken while the user looks around the table:
 *   f            focal length of the camera in pixels (principal point = image centre, square pixels)
 *   X            rigid transform head → camera (constant for the headset; stored once calibrated)
 *   Y            rigid transform world → table (what we are after; re-solved live with X and f fixed)
 *   per marker   which corner of the table it sits in and how the sheet is turned (0/90/180/270°)
 * Model: pixel = project(f, inv(T_world_head · X) · Y · P_table) for every detected marker corner P_table.
 * Solved by Levenberg–Marquardt with a numeric Jacobian (small problem: ≤ 13 parameters, a few hundred residuals).
 *
 * Conventions: lengths in metres; the table frame has x along the 44" edge, y along the 60" edge, z up (right-handed,
 * seen from above x right / y away = the same frame as calib.js: ex, ey, up). Poses are 4×4 column-major arrays
 * (three.js order). Rotations are parametrised as rotation vectors (axis · angle).
 */
export const IN = 0.0254;
export const TABLE = [44 * IN, 60 * IN];
export let MARKER_INSET = 0.050;              // marker centre from both table edges (10×15 print at 100 %)
export let MARKER_SIZE = 0.0525;              // black square of the marker (6 of 8 cells of the 70 mm print)
/** The sheets printed at another scale (e.g. 10×15 fitted onto A4 ≈ ×1.98): everything on the sheet scales alike. */
export function setMarkerScale(scale) { MARKER_INSET = 0.050 * scale; MARKER_SIZE = 0.0525 * scale; }

// ---------------------------------------------------------------- small linear algebra (column-major 4×4)
export const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
export function inv(m) {
  // rigid transform inverse (rotation transpose, translation rotated back)
  const r = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const t = [m[12], m[13], m[14]];
  const o = I4();
  o[0] = r[0]; o[1] = r[3]; o[2] = r[6];
  o[4] = r[1]; o[5] = r[4]; o[6] = r[7];
  o[8] = r[2]; o[9] = r[5]; o[10] = r[8];
  o[12] = -(o[0] * t[0] + o[4] * t[1] + o[8] * t[2]);
  o[13] = -(o[1] * t[0] + o[5] * t[1] + o[9] * t[2]);
  o[14] = -(o[2] * t[0] + o[6] * t[1] + o[10] * t[2]);
  return o;
}
export function apply(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
/** rotation vector (rx, ry, rz) + translation → 4×4 */
export function fromRT(rv, t) {
  const th = Math.hypot(rv[0], rv[1], rv[2]);
  const m = I4();
  if (th < 1e-12) { m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; }
  const kx = rv[0] / th, ky = rv[1] / th, kz = rv[2] / th, c = Math.cos(th), s = Math.sin(th), v = 1 - c;
  m[0] = c + kx * kx * v; m[4] = kx * ky * v - kz * s; m[8] = kx * kz * v + ky * s;
  m[1] = ky * kx * v + kz * s; m[5] = c + ky * ky * v; m[9] = ky * kz * v - kx * s;
  m[2] = kz * kx * v - ky * s; m[6] = kz * ky * v + kx * s; m[10] = c + kz * kz * v;
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
/** 4×4 → rotation vector + translation */
export function toRT(m) {
  const tr = m[0] + m[5] + m[10];
  let th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  let rv;
  if (th < 1e-9) rv = [0, 0, 0];
  else if (Math.abs(th - Math.PI) < 1e-6) {
    // 180°: axis from the diagonal
    const ax = Math.sqrt(Math.max(0, (m[0] + 1) / 2)), ay = Math.sqrt(Math.max(0, (m[5] + 1) / 2)), az = Math.sqrt(Math.max(0, (m[10] + 1) / 2));
    rv = [ax * th, ay * th, az * th];
  } else {
    const k = th / (2 * Math.sin(th));
    rv = [(m[6] - m[9]) * k, (m[8] - m[2]) * k, (m[1] - m[4]) * k];
  }
  return { rv, t: [m[12], m[13], m[14]] };
}
export const rotZ = a => fromRT([0, 0, a], [0, 0, 0]);

// ---------------------------------------------------------------- marker geometry on the table
/** The 4 corners (table metres, z = 0) of the marker in table corner `corner` (0: (0,0), 1: (44",0), 2: (44",60"),
 *  3: (0,60")), the sheet turned by `turn` quarter turns. Order = the detector's order (clockwise in the image
 *  starting at the marker's own top-left). */
export function markerCorners(corner, turn) {
  const cx = corner === 1 || corner === 2 ? TABLE[0] - MARKER_INSET : MARKER_INSET;
  const cy = corner >= 2 ? TABLE[1] - MARKER_INSET : MARKER_INSET;
  const h = MARKER_SIZE / 2;
  // the marker's own frame: top-left (-h, +h), top-right (+h, +h), bottom-right (+h, -h), bottom-left (-h, -h), y up
  const base = [[-h, h], [h, h], [h, -h], [-h, -h]];
  const a = turn * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  return base.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c, 0]);
}

// ---------------------------------------------------------------- projection
/** table point → pixel. cam = inv(world→camera pose) i.e. the camera's view matrix (world → camera), Y = world→table pose
 *  (table → world). Camera looks down -z (WebXR / three.js), image x right, image y down, principal point at the centre. */
export function project(f, cxy, viewCam, Y, P, dist) {
  const w = apply(Y, P);                 // table → world
  const c = apply(viewCam, w);           // world → camera
  if (c[2] >= -1e-6) return null;        // behind the camera
  let x = c[0] / -c[2], y = c[1] / -c[2];
  if (dist) {                            // radial distortion k1 r² + k2 r⁴ (the Quest cameras are wide-angle)
    const r2 = x * x + y * y, k = 1 + dist[0] * r2 + dist[1] * r2 * r2;
    x *= k; y *= k;
  }
  return [cxy[0] + f * x, cxy[1] - f * y];
}

// ---------------------------------------------------------------- Levenberg–Marquardt (numeric Jacobian)
export function lm(residualFn, p0, opts = {}) {
  let p = p0.slice();
  let lambda = opts.lambda || 1e-3;
  const maxIter = opts.maxIter || 60, eps = opts.eps || 1e-6;
  let r = residualFn(p), cost = dot(r, r);
  for (let it = 0; it < maxIter; it++) {
    const n = p.length, m = r.length;
    const J = new Array(n);
    for (let j = 0; j < n; j++) {
      const h = (opts.steps && opts.steps[j]) || 1e-6;
      const q = p.slice(); q[j] += h;
      const rj = residualFn(q);
      J[j] = new Float64Array(m);
      for (let i = 0; i < m; i++) J[j][i] = (rj[i] - r[i]) / h;
    }
    // normal equations: (JᵀJ + λ diag) δ = -Jᵀr
    const A = new Array(n * n).fill(0), g = new Array(n).fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) { let s = 0; for (let i = 0; i < m; i++) s += J[a][i] * J[b][i]; A[a * n + b] = s; A[b * n + a] = s; }
      let s = 0; for (let i = 0; i < m; i++) s += J[a][i] * r[i]; g[a] = -s;
    }
    let improved = false;
    for (let tries = 0; tries < 8 && !improved; tries++) {
      const M = A.slice();
      for (let a = 0; a < n; a++) M[a * n + a] += lambda * (A[a * n + a] + 1e-9);
      const d = solve(M, g, n);
      if (!d) { lambda *= 10; continue; }
      const q = p.map((v, i) => v + d[i]);
      const rq = residualFn(q), cq = dot(rq, rq);
      if (cq < cost) { p = q; r = rq; const rel = (cost - cq) / Math.max(cost, 1e-12); cost = cq; lambda = Math.max(lambda / 3, 1e-9); improved = true; if (rel < eps) return { p, cost, iter: it + 1 }; }
      else lambda *= 10;
    }
    if (!improved) break;
  }
  return { p, cost, iter: maxIter };
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function solve(A, b, n) {
  // Gaussian elimination with partial pivoting
  const M = A.slice(), v = b.slice();
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[piv * n + c])) piv = r;
    if (Math.abs(M[piv * n + c]) < 1e-14) return null;
    if (piv !== c) { for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[piv * n + k]; M[piv * n + k] = t; } const t = v[c]; v[c] = v[piv]; v[piv] = t; }
    for (let r = c + 1; r < n; r++) { const fct = M[r * n + c] / M[c * n + c]; if (!fct) continue; for (let k = c; k < n; k++) M[r * n + k] -= fct * M[c * n + k]; v[r] -= fct * v[c]; }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = v[r]; for (let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k]; x[r] = s / M[r * n + r]; }
  return x;
}

// ---------------------------------------------------------------- the calibration
/** obs: [{ head: 4×4 (head → world), w, h, markers: [{ id, corners: [{x, y}×4] }] }]
 *  layout: { [id]: { corner, turn } } (known or guessed); X0, f0: initial guesses.
 *  Solves f, X, Y (and optionally keeps X / f fixed). Returns { f, X, Y, rms, n }. */
/** Base frame of a plane { p: point on it, n: unit normal (up) }: columns x (horizontal), y, z = n. */
export function planeBase(plane) {
  const n = plane.n;
  let x = [1, 0, 0]; const d = n[0] * x[0] + n[1] * x[1] + n[2] * x[2];
  x = [x[0] - n[0] * d, x[1] - n[1] * d, x[2] - n[2] * d]; const l = Math.hypot(...x); x = x.map(v => v / l);
  const y = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, n[0], n[1], n[2], 0, plane.p[0], plane.p[1], plane.p[2], 1];
}
/** Least-squares plane through world points (y up): { p, n } with n pointing up, or null. */
export function fitPlane(pts) {
  if (!pts || pts.length < 3) return null;
  const c = [0, 1, 2].map(k => pts.reduce((s, q) => s + q[k], 0) / pts.length);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const q of pts) { const a = q[0] - c[0], b = q[1] - c[1], d = q[2] - c[2]; xx += a * a; xy += a * b; xz += a * d; yy += b * b; yz += b * d; zz += d * d; }
  // normal = eigenvector of the smallest eigenvalue – for a near-horizontal plane solve y = αx + βz + γ (regression on y)
  const det = xx * zz - xz * xz; if (Math.abs(det) < 1e-12) return null;
  const al = (xy * zz - yz * xz) / det, be = (yz * xx - xy * xz) / det;
  let n = [-al, 1, -be]; const l = Math.hypot(...n); n = n.map(v => v / l);
  return { p: c, n };
}
export function solveAll(obs, layout, init, fix = {}, maxIter = 80) {
  const cxy0 = init.cxy || [obs[0].w / 2, obs[0].h / 2];
  const dist0 = init.dist || [0, 0];
  const X0 = toRT(init.X || I4()), Y0 = toRT(init.Y || I4());
  const f0 = init.f || obs[0].w * 0.75;
  const B = init.plane ? planeBase(init.plane) : null, Binv = B ? inv(B) : null;
  // parameter vector: [f?, dist k1 k2 + principal point?, X rv(3) t(3)?, Y: rv(3) t(3) | with a plane: x y yaw]
  const p0 = []; const idx = {};
  if (!fix.f) { idx.f = p0.length; p0.push(f0); }
  if (!fix.dist) { idx.d = p0.length; p0.push(dist0[0], dist0[1], cxy0[0], cxy0[1]); }
  if (!fix.X) { idx.X = p0.length; p0.push(...X0.rv, ...X0.t); }
  idx.Y = p0.length;
  if (B) { const L = mul(Binv, init.Y || B); p0.push(L[12], L[13], Math.atan2(L[1], L[0])); }
  else p0.push(...Y0.rv, ...Y0.t);
  const tPrior = init.tPrior || null, wPrior = init.wPrior || 60;     // X translation prior: 1 cm off ≈ 0.6 px
  const unpack = p => ({
    f: fix.f ? f0 : p[idx.f],
    dist: fix.dist ? dist0 : [p[idx.d], p[idx.d + 1]],
    cxy: fix.dist ? cxy0 : [p[idx.d + 2], p[idx.d + 3]],
    X: fix.X ? (init.X || I4()) : fromRT(p.slice(idx.X, idx.X + 3), p.slice(idx.X + 3, idx.X + 6)),
    Y: B ? mul(B, fromRT([0, 0, p[idx.Y + 2]], [p[idx.Y], p[idx.Y + 1], 0])) : fromRT(p.slice(idx.Y, idx.Y + 3), p.slice(idx.Y + 3, idx.Y + 6))
  });
  const residuals = p => {
    const { f, dist, cxy, X, Y } = unpack(p);
    const out = [];
    if (tPrior && !fix.X) { const t = [X[12], X[13], X[14]]; for (let k = 0; k < 3; k++) out.push((t[k] - tPrior[k]) * wPrior); }
    for (const o of obs) {
      const viewCam = inv(mul(o.head, X));
      for (const m of o.markers) {
        const L = layout[m.id]; if (!L) continue;
        const P = markerCorners(L.corner, L.turn);
        for (let k = 0; k < 4; k++) {
          const q = project(f, cxy, viewCam, Y, P[k], dist);
          if (!q) { out.push(50, 50); continue; }
          out.push((q[0] - m.corners[k].x) / 1, (q[1] - m.corners[k].y) / 1);
        }
      }
    }
    return out;
  };
  const steps = p0.map((v, i) => (idx.f === i ? 1 : idx.d !== undefined && i >= idx.d && i < idx.d + 2 ? 1e-4 : idx.d !== undefined && i >= idx.d + 2 && i < idx.d + 4 ? 0.5 : 1e-5));
  const r = lm(residuals, p0, { maxIter, steps });
  const nPrior = tPrior && !fix.X ? 3 : 0;
  const n = r.p.length ? (residuals(r.p).length - nPrior) / 2 : 0;
  const { f, dist, cxy, X, Y } = unpack(r.p);
  return { f, dist, cxy, X, Y, rms: n ? Math.sqrt(r.cost / (n * 2)) : Infinity, n, iter: r.iter };
}

/** Rough world position of each marker id from the marker's pixel size (distance = f·size/edge) and the head pose
 *  with the initial X: good enough to tell 44" from 60" and 74". */
export function roughPositions(obs, init) {
  const f = init.f || obs[0].w * 0.75, X = init.X || I4();
  const acc = {};
  for (const o of obs) {
    const T = mul(o.head, X);
    for (const m of o.markers) {
      const c = m.corners;
      const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
      let edge = 0; for (let k = 0; k < 4; k++) edge += Math.hypot(c[(k + 1) % 4].x - c[k].x, c[(k + 1) % 4].y - c[k].y) / 4;
      const d = f * MARKER_SIZE / edge;
      const dir = [(cx - o.w / 2) / f, -(cy - o.h / 2) / f, -1];
      const n = Math.hypot(dir[0], dir[1], dir[2]);
      const pc = [dir[0] / n * d, dir[1] / n * d, dir[2] / n * d];
      const pw = apply(T, pc);
      (acc[m.id] = acc[m.id] || []).push(pw);
    }
  }
  const out = {};
  for (const id in acc) { const a = acc[id]; out[id] = [0, 1, 2].map(k => a.reduce((s, p) => s + p[k], 0) / a.length); }
  return out;
}
const CORNER_XY = [[0, 0], [TABLE[0], 0], [TABLE[0], TABLE[1]], [0, TABLE[1]]];

/** Which corner each marker id sits in and how the sheet is turned. Corner assignment from the rough inter-marker
 *  distances (all permutations scored), the turns from the reprojection error with the coarse solution; the best
 *  candidate is refined with a full solve. Returns { layout, f, X, Y, rms, n }. */
export function guessLayout(obs, ids, init) {
  const pos = roughPositions(obs, init);
  const perms = permutations([0, 1, 2, 3], ids.length);
  const score = perm => {
    let s = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const pi = pos[ids[i]], pj = pos[ids[j]]; if (!pi || !pj) continue;
      const d = Math.hypot(pi[0] - pj[0], pi[1] - pj[1], pi[2] - pj[2]);
      const a = CORNER_XY[perm[i]], b = CORNER_XY[perm[j]];
      s += Math.abs(d - Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    return s;
  };
  const scored = perms.map(p => ({ perm: p, s: score(p) })).sort((a, b) => a.s - b.s);
  const cands = scored.filter(x => x.s <= scored[0].s * 1.5 + 0.05).slice(0, 4);
  let best = null;
  for (const { perm } of cands) {
    const layout = {};
    ids.forEach((id, i) => { layout[id] = { corner: perm[i], turn: 0 }; });
    const Y0 = initY(pos, ids, perm);
    const common = { plane: init.plane, tPrior: init.tPrior, wPrior: init.wPrior };
    const coarse = solveAll(obs, layout, Object.assign({ f: init.f, X: init.X, Y: Y0 || init.Y }, common), { dist: true }, 30);
    // per-marker turn: evaluate the 4 options with the coarse (f, X, Y)
    for (const id of ids) {
      let bt = 0, be = Infinity;
      for (let t = 0; t < 4; t++) { layout[id].turn = t; const e = markerError(obs, layout, coarse, id); if (e < be) { be = e; bt = t; } }
      layout[id].turn = bt;
    }
    const r = solveAll(obs, layout, Object.assign({ f: coarse.f, X: coarse.X, Y: coarse.Y, dist: init.dist, cxy: init.cxy }, common), init.freeDist ? {} : { dist: true });
    if (!best || r.rms < best.rms) best = Object.assign({ layout: JSON.parse(JSON.stringify(layout)) }, r);
  }
  return best;
}
/** Initial table pose from the rough marker positions: table z = world up (tables are level), x along the
 *  44" edge fitted to the marker centres. Needs ≥ 2 markers, else null. */
export function initY(pos, ids, perm) {
  const pts = [];
  ids.forEach((id, i) => { if (pos[id]) pts.push({ w: pos[id], t: [CORNER_XY[perm[i]][0] + (perm[i] === 1 || perm[i] === 2 ? -MARKER_INSET : MARKER_INSET), CORNER_XY[perm[i]][1] + (perm[i] >= 2 ? -MARKER_INSET : MARKER_INSET)] }); });
  if (pts.length < 2) return null;
  // horizontal fit: find yaw θ and translation so that R(θ)·t + o ≈ w (xz plane), height = mean y
  let sa = 0, sb = 0, cwx = 0, cwz = 0, ctx = 0, cty = 0, h = 0;
  for (const p of pts) { cwx += p.w[0]; cwz += p.w[2]; ctx += p.t[0]; cty += p.t[1]; h += p.w[1]; }
  const n = pts.length; cwx /= n; cwz /= n; ctx /= n; cty /= n; h /= n;
  // table (x, y) → world (x, -z)?  world forward is -z: map table x → world x, table y → world -z (z up stays y up)
  for (const p of pts) { const tx = p.t[0] - ctx, ty = p.t[1] - cty, wx = p.w[0] - cwx, wz = -(p.w[2] - cwz); sa += tx * wz - ty * wx; sb += tx * wx + ty * wz; }
  const th = Math.atan2(sa, sb);
  // Y = T(o) · Ryaw(th) · Rx(-90°): table z → world y, table y → world -z
  const R = mul(fromRT([0, th, 0], [0, 0, 0]), fromRT([-Math.PI / 2, 0, 0], [0, 0, 0]));
  const c = apply(R, [ctx, cty, 0]);
  R[12] = cwx - c[0]; R[13] = h - c[1]; R[14] = cwz - c[2];
  return R;
}
/** mean reprojection error (px) of one marker id for a given solution */
export function markerError(obs, layout, sol, id) {
  let s = 0, n = 0;
  const cxy = [obs[0].w / 2, obs[0].h / 2];
  for (const o of obs) {
    const viewCam = inv(mul(o.head, sol.X));
    for (const m of o.markers) {
      if (m.id !== id) continue;
      const P = markerCorners(layout[id].corner, layout[id].turn);
      for (let k = 0; k < 4; k++) { const q = project(sol.f, sol.cxy || cxy, viewCam, sol.Y, P[k], sol.dist); if (!q) { s += 100; n++; continue; } s += Math.hypot(q[0] - m.corners[k].x, q[1] - m.corners[k].y); n++; }
    }
  }
  return n ? s / n : Infinity;
}
function permutations(arr, k) {
  if (k === 0) return [[]];
  const out = [];
  for (let i = 0; i < arr.length; i++) { const rest = arr.slice(0, i).concat(arr.slice(i + 1)); for (const p of permutations(rest, k - 1)) out.push([arr[i]].concat(p)); }
  return out;
}
