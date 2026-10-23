/* Table calibration: three touched corners → a frame that maps battlefield inches to world metres.
 * Battlefield coordinates as in data/rules.js: x along the 44" Attacker's edge, y along the 60" long edge,
 * Attacker's edge at y = 0. The player stands at the Attacker's edge facing the table and taps
 *   1. the corner on their RIGHT  → (0, 0)
 *   2. the corner on their LEFT   → (44, 0)
 *   3. any corner of the Defender's edge (only decides which way y goes)
 * Pure functions (no DOM, no three.js) so they can be unit-tested with node. Points are {x, y, z} in metres, y up. */

export const IN = 0.0254;          // metres per inch
export const BOARD = [44, 60];     // width (x) × length (y) in inches

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = a => Math.sqrt(dot(a, a));
const norm = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

/** Frame from three corner points, or null when the first two are too close (< 10 cm).
 *  Always right-handed (x × up = y), so it can be stored as a WebXR anchor pose: the order of the first two taps
 *  does not matter – the corner that puts the Defender's edge in front becomes (0, 0).
 *  { origin, ex, ey, up, height, edge (measured length of the Attacker's edge in inches) } */
export function frameFromCorners(p0, p1, p2) {
  if (!p0 || !p1 || !p2) return null;
  const up = { x: 0, y: 1, z: 0 };
  const e = sub(p1, p0);
  const flat = { x: e.x, y: 0, z: e.z };           // the table is horizontal – ignore the height difference
  if (len(flat) < 0.1) return null;
  let ex = norm(flat);
  let ey = norm(cross(ex, up));                     // perpendicular to the Attacker's edge, horizontal, right-handed
  let o = p0;
  const toDef = sub(p2, p0);
  if (dot({ x: toDef.x, y: 0, z: toDef.z }, ey) < 0) { ex = { x: -ex.x, y: 0, z: -ex.z }; ey = { x: -ey.x, y: 0, z: -ey.z }; o = p1; }
  const height = (p0.y + p1.y + p2.y) / 3;
  return { origin: { x: o.x, y: height, z: o.z }, ex, ey, up, height, edge: len(flat) / IN };
}

/** Battlefield inches → world metres. */
export function toWorld(frame, bx, by, bz = 0) {
  const { origin: o, ex, ey, up } = frame;
  const X = bx * IN, Y = by * IN, Z = bz * IN;
  return { x: o.x + ex.x * X + ey.x * Y + up.x * Z, y: o.y + ex.y * X + ey.y * Y + up.y * Z, z: o.z + ex.z * X + ey.z * Y + up.z * Z };
}

/** World metres → battlefield inches (bz = height above the table). */
export function toBoard(frame, p) {
  const d = sub(p, frame.origin);
  return { x: dot(d, frame.ex) / IN, y: dot(d, frame.ey) / IN, z: dot(d, frame.up) / IN };
}

/** Intersection of a ray (origin, direction in world metres) with the table plane, as battlefield inches, or null. */
export function rayToBoard(frame, origin, dir) {
  const denom = dot(dir, frame.up);
  if (Math.abs(denom) < 1e-6) return null;
  const t = dot(sub(frame.origin, origin), frame.up) / denom;
  if (t < 0) return null;
  return toBoard(frame, { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t });
}

/** 4×4 column-major matrix (three.js Matrix4.fromArray order) that places the table group: local X = board x,
 *  local Z = board y, local Y = up, 1 unit = 1 metre. */
export function frameMatrix(frame) {
  const { origin: o, ex, ey, up } = frame;
  return [ex.x, ex.y, ex.z, 0, up.x, up.y, up.z, 0, ey.x, ey.y, ey.z, 0, o.x, o.y, o.z, 1];
}

/** Serialisable copy for localStorage (and back). */
export const packFrame = f => f && { origin: f.origin, ex: f.ex, ey: f.ey, up: f.up, height: f.height, edge: f.edge };
export function unpackFrame(o) {
  if (!o || !o.origin || !o.ex || !o.ey) return null;
  return { origin: o.origin, ex: o.ex, ey: o.ey, up: o.up || { x: 0, y: 1, z: 0 }, height: o.height, edge: o.edge };
}

/** Snap a board coordinate to a grid (inches). */
export const snap = (v, step = 0.5) => Math.round(v / step) * step;

/** Point (inches) inside the battlefield? */
export const onBoard = p => p.x >= 0 && p.x <= BOARD[0] && p.y >= 0 && p.y <= BOARD[1];
