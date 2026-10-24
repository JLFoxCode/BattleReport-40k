// Half-table games (44" × 30"): two games on one 44" × 60" table, or a single game on half a table.
// There is no official half-size format in the 11th edition – Incursion (1000 points) is played on the full 44" × 60"
// battlefield with the Chapter Approved Deployment cards, and neither the Mission Deck nor the Event Companion has
// 44" × 30" maps. So a half-table game uses the Chapter Approved Deployment card scaled to half length: the 44" width
// stays, every length along the table (zone depth, objective positions, the territory line) is halved – a casual,
// clearly unofficial option. The players stand at the 44" edges of the half (Attacker's edge y = 0, Defender's edge
// y = 30 of the half).
import { WH } from './rules.js';

export const HALF_SIZE = [44, 30];
export const HALF_DEPLOYMENTS = WH.DEPLOYMENTS.slice();

/** The scaled card in the half's own frame (44 × 30): { zones: { a, d }, line, circle, objectives: [{ kind, owner, pos }] }. */
export function halfMap(name) {
  const m = WH.DEPLOYMENT_MAPS[name];
  if (!m) return null;
  const sc = ([x, y]) => [x, y / 2];
  const zones = m.zones || {};
  return {
    zones: { a: (zones.a || []).map(sc), d: (zones.d || []).map(sc) },
    line: (zones.line || m.line) ? (zones.line || m.line).map(sc) : null,
    circle: (zones.circle || m.circle) ? [(zones.circle || m.circle)[0], (zones.circle || m.circle)[1] / 2, (zones.circle || m.circle)[2] / 2] : null,
    home: { a: sc(m.home.a), d: sc(m.home.d) }, exp: [sc(m.exp[0]), sc(m.exp[1])], centre: [22, 15],
    objectives: [
      { kind: 'home', owner: 'a', pos: sc(m.home.a) }, { kind: 'home', owner: 'd', pos: sc(m.home.d) },
      { kind: 'exp', pos: sc(m.exp[0]) }, { kind: 'exp', pos: sc(m.exp[1]) }, { kind: 'central', pos: [22, 15] }
    ]
  };
}
export const HALF_MAPS = Object.fromEntries(HALF_DEPLOYMENTS.map(n => [n, halfMap(n)]).filter(e => e[1]));

/** The scaled card in table coordinates of the 44" × 60" table: the half's y offset added (near half y0 = 0, far half
 *  y0 = 30); objective names and home owners resolved for the given Attacker (player index). */
export function halfMapAt(name, y0, attacker) {
  const m = HALF_MAPS[name];
  if (!m) return null;
  const sh = ([x, y]) => [x, y + y0];
  const att = attacker === 1 ? 1 : 0;
  return {
    zones: { a: m.zones.a.map(sh), d: m.zones.d.map(sh) },
    line: m.line ? m.line.map(sh) : null,
    circle: m.circle ? [m.circle[0], m.circle[1] + y0, m.circle[2]] : null,
    objectives: m.objectives.map(o => ({ pos: sh(o.pos), kind: o.kind, name: o.kind === 'home' ? (o.owner === 'a' ? 'Attacker Home' : 'Defender Home') : o.kind === 'central' ? 'Centre' : 'Expansion', home: o.kind === 'home' ? (o.owner === 'a' ? att : 1 - att) : null }))
  };
}
