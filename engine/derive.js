/* Abgeleitete Daten (SPEC §4). deriveBase() = Kontrolle/Territorium/Zählungen (vom Reducer genutzt),
 * derive() = vollständiges Objekt für den Client. */
import { WH } from '../data/rules.js';
import { halfMap } from '../data/half-table.js';
import { LAYOUTS11 } from '../data/layouts11.js';
import { factionById, detachmentById } from '../data/factions/index.js';
import { pt, dist, pointInPolygon, centroid, sideOfLine } from './geometry.js';
import { stratsWithAvailability, fitsPhase } from './stratagems.js';
import { autoContext, evalCard, playerCards, currentMoment, checkpointKey, checkpointItems, capUsage, vpTotals, CAPS, turnNo } from './scoring.js';

/** Reichweite um einen Missionsziel-Marker: 3" + Markerradius (40 mm ≈ 0.79"). */
export const OBJ_RANGE = 3 + 0.79;

export function activePlayer(state) {
  if (state.stage === 'battle' || state.stage === 'over') return state.turn === 1 ? 1 : 0;
  return state.mission && state.mission.first != null ? state.mission.first : 0;
}

export function attackerOf(state) { return state.mission && state.mission.attacker === 1 ? 1 : 0; }

/** Battlefield size [w, h] in inches: 44×60, or 44×30 for a half-table game (opts.board 'half' – unofficial, see data/half-table.js). */
export function boardSize(state) { return state && state.opts && state.opts.board === 'half' ? [44, 30] : (WH.MAP_SIZE || [44, 60]); }
/** The game's Deployment card as { zones: { a, d }, line, circle, home: { a, d }, exp: [..], centre } – the Chapter Approved
 *  card, or the same card scaled to half length for a half-table game. */
/** The 11th-edition Event Companion layout of the game (mission.terrainLayout): the table – deployment zones, the
 *  objectives (inside terrain areas) and the terrain areas. null without one (half table, generated layout). */
export function eventLayoutOf(state) {
  const id = state && state.mission && state.mission.terrainLayout;
  if (!id || (state.opts && state.opts.board === 'half')) return null;
  return LAYOUTS11.find(l => l.id === id) || null;
}
/** Footprint of a terrain area in table inches: the rotated rectangle or its irregular outline. */
export function footprint(p) {
  const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  const pts = p.poly && p.poly.length >= 3 ? p.poly : [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
  return pts.map(([x, y]) => [p.x + x * c - y * sn, p.y + x * sn + y * c]);
}
/** The terrain area an objective marker sits in – a terrain objective's range is that whole area (11th edition) – as
 *  its outline, or null when the marker is in the open (then: within 3" horizontally). */
export function objectiveArea(pos, pieces) {
  const p = (pieces || []).find(q => q && q.w > 0 && pointInPolygon(pos, footprint(q)));
  return p ? footprint(p) : null;
}
function distToPoly(pos, poly) {
  const q = pt(pos); let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(q.x - (ax + t * dx), q.y - (ay + t * dy)));
  }
  return best;
}

export function deploymentMapOf(state) {
  const L = eventLayoutOf(state);
  if (L) {
    // the layout is the table: its zones and its objectives; the territory line of the Deployment card with the same
    // zone shape (the layouts carry none)
    const card = WH.DEPLOYMENT_MAPS[deploymentForLayout(L.id)] || null;
    const home = { a: null, d: null }, exp = []; let centre = null;
    for (const o of L.objectives || []) {
      if (o.kind === 'home') home[o.owner === 'a' ? 'a' : 'd'] = o.pos;
      else if (o.kind === 'central') centre = o.pos;
      else exp.push(o.pos);
    }
    return { zones: { a: L.zones.a, d: L.zones.d }, line: card ? ((card.zones && card.zones.line) || card.line || null) : null, circle: null, home, exp, centre: centre || [22, 30], pieces: L.pieces, layout: L };
  }
  const name = state && state.mission && state.mission.deployment;
  if (!name) return null;
  if (state.opts && state.opts.board === 'half') { const m = halfMap(name); return m ? Object.assign({}, m, { zones: m.zones }) : null; }
  const m = WH.DEPLOYMENT_MAPS[name];
  if (!m) return null;
  return { zones: { a: m.zones.a, d: m.zones.d }, line: (m.zones && m.zones.line) || m.line || null, circle: (m.zones && m.zones.circle) || m.circle || null, home: m.home, exp: m.exp, centre: [22, 30] };
}

/** The Chapter Approved Deployment card whose zones an 11th-edition Event Companion layout uses – the layouts carry the
 *  same six zone shapes (inset by ¼" from the edges), found by the overlap of the Attacker's zone on a 1" grid. The game
 *  engine (objectives, "within your deployment zone") works with that card; null when no card fits. */
const DEP_OF_LAYOUT = new Map();
export function deploymentForLayout(layoutId) {
  if (!layoutId) return null;
  if (DEP_OF_LAYOUT.has(layoutId)) return DEP_OF_LAYOUT.get(layoutId);
  const L = LAYOUTS11.find(l => l.id === layoutId);
  let best = null;
  if (L && L.zones && L.zones.a) {
    // the cards' polygons repeat a point here and there – a zero-length edge would count every point as "on the edge"
    const clean = poly => { const c = poly.filter((q, i) => !i || q[0] !== poly[i - 1][0] || q[1] !== poly[i - 1][1]); const l = c[c.length - 1]; return c.length > 3 && l[0] === c[0][0] && l[1] === c[0][1] ? c.slice(0, -1) : c; };
    const grid = poly => { const g = new Set(); poly = clean(poly); for (let x = .5; x < 44; x++) for (let y = .5; y < 60; y++) if (pointInPolygon({ x, y }, poly)) g.add(x + ',' + y); return g; };
    const A = grid(L.zones.a);
    let bestIou = 0;
    for (const name of Object.keys(WH.DEPLOYMENT_MAPS || {})) {
      const B = grid(WH.DEPLOYMENT_MAPS[name].zones.a);
      let inter = 0; for (const k of A) if (B.has(k)) inter++;
      const iou = inter / (A.size + B.size - inter || 1);
      if (iou > bestIou) { bestIou = iou; best = name; }
    }
    if (bestIou < .85) best = null;
  }
  DEP_OF_LAYOUT.set(layoutId, best);
  return best;
}

export function zonesOf(state) {
  const map = deploymentMapOf(state);
  if (!map) return { a: [], d: [], line: null, circle: null };
  return { a: map.zones.a, d: map.zones.d, line: map.line, circle: map.circle || null };
}

/** Aufstellungszone (Polygon) eines Spielers. */
export function zoneOf(state, p) {
  const z = zonesOf(state);
  return attackerOf(state) === p ? z.a : z.d;
}

/** Territorium-Funktion: Seite der Grenzlinie → Spielerindex. */
export function territoryFn(state) {
  const z = zonesOf(state);
  const att = attackerOf(state);
  if (!z.line || !z.a.length) return () => att;
  const ref = centroid(z.a);
  const refSide = sideOfLine(ref, z.line[0], z.line[1]);
  return pos => {
    if (!pos) return null;
    const s = sideOfLine(pos, z.line[0], z.line[1]);
    if (s === 0) return null;
    return s === refSide ? att : 1 - att;
  };
}

/** Niemandsland: Punkt liegt in keiner Aufstellungszone. */
export function nmlFn(state) {
  const z = zonesOf(state);
  return pos => !!pos && !pointInPolygon(pos, z.a) && !pointInPolygon(pos, z.d);
}

/** Ist die Einheit in Reichweite des Missionsziels? */
export function unitInRange(unit, obj) {
  if (!unit || !unit.pos || !obj || !obj.pos) return false;
  if (unit.status === 'destroyed') return false;
  // 11th edition terrain objective: a unit is within range of it while it is within that terrain area – here: the unit's
  // centre inside the area or its base touching the outline
  if (Array.isArray(obj.area) && obj.area.length >= 3) return pointInPolygon(unit.pos, obj.area) || distToPoly(unit.pos, obj.area) <= (Number(unit.r) || 0) + 1e-9;
  return dist(unit.pos, obj.pos) <= OBJ_RANGE + (Number(unit.r) || 0) + 1e-9;
}

/** Kontrolle aller Missionsziele → { [id]: { ctrl, oc: [n0, n1], units: [[ids],[ids]], raw } } */
export function computeControl(state) {
  const out = {};
  for (const obj of state.objectives || []) {
    const oc = [0, 0];
    const units = [[], []];
    for (let p = 0; p < 2; p++) {
      for (const u of (state.players[p] && state.players[p].units) || []) {
        if (!unitInRange(u, obj)) continue;
        units[p].push(u.id);
        if (u.status === 'shocked') continue; // Battle-shocked: OC 0
        oc[p] += (Number(u.models) || 0) * (Number(u.oc) || 0);
      }
    }
    let raw = oc[0] > oc[1] ? 0 : oc[1] > oc[0] ? 1 : null;
    let ctrl = raw;
    const sticky = obj.sticky;
    if (sticky === 0 || sticky === 1) {
      ctrl = oc[1 - sticky] > oc[sticky] ? 1 - sticky : sticky;
    }
    if (obj.override === 0 || obj.override === 1) ctrl = obj.override;
    else if (obj.override === 'none') ctrl = null;
    out[obj.id] = { ctrl, oc, units, raw };
  }
  return out;
}

export function computeCounts(state, control, territory) {
  const objs = state.objectives || [];
  const snap = state.ctrlAtTurnStart || {};
  return [0, 1].map(p => {
    const o = 1 - p;
    const mine = objs.filter(x => control[x.id] && control[x.id].ctrl === p);
    const nonHome = mine.filter(x => x.home !== p);
    return {
      objs: mine.length,
      nonHome: nonHome.length,
      home: mine.some(x => x.home === p),
      oppHome: mine.some(x => x.home === o),
      central: mine.filter(x => x.central).length,
      inOppTerr: mine.filter(x => territory(x.pos) === o).length,
      newNonHome: nonHome.filter(x => snap[x.id] !== p).length,
      ids: mine.map(x => x.id)
    };
  });
}

/** Basisdaten (ohne Wertung/Stratageme) – vom Reducer und von derive() genutzt. */
export function deriveBase(state) {
  const control = computeControl(state);
  const territory = territoryFn(state);
  const nml = nmlFn(state);
  const counts = computeCounts(state, control, territory);
  return { active: activePlayer(state), control, counts, territory, nml, zones: zonesOf(state) };
}

function phaseInfo(state) {
  const idx = Math.max(0, WH.PHASES.findIndex(p => p.id === state.phase));
  const ph = WH.PHASES[idx] || WH.PHASES[0];
  return { id: ph.id, name: ph.name, full: ph.full, index: idx };
}

/** Nächster anstehender Checkpoint (noch nicht erledigt, mit aktiven Bedingungen) oder null. */
export function nextCheckpoint(state, base) {
  if (state.pending && state.pending.kind === 'score') return { when: state.pending.when, player: state.pending.player };
  if (state.stage !== 'battle') return null;
  const done = state.checkpointsDone || [];
  const active = base.active;
  const other = 1 - active;
  const probe = (p, when) => {
    if (done.includes(checkpointKey(state, when, p))) return null;
    return checkpointItems(state, base, p, when).length ? { when, player: p } : null;
  };
  if (state.phase === 'command') return probe(active, 'cmd');
  if (state.phase === 'end') {
    const first = state.mission.first == null ? 0 : state.mission.first;
    const lastTurn = state.round >= 5 && state.turn !== first;
    for (const p of [active, other]) { const c = probe(p, 'turn'); if (c) return c; }
    if (lastTurn) for (const p of [active, other]) { const c = probe(p, 'end'); if (c) return c; }
  }
  return null;
}

function buildScoring(state, base) {
  const when = currentMoment(state);
  return [0, 1].map(p => {
    const ctx = autoContext(state, base, p);
    const cards = playerCards(state, p);
    const prim = cards.find(c => c.src === 'primary') || null;
    const primary = prim
      ? { card: prim.card, name: prim.def.name, desc: prim.def.desc || '', note: prim.def.note || '', trk: prim.def.trk || [], conds: evalCard(state, base, p, prim, when, ctx) }
      : { card: null, name: '–', desc: '', note: '', trk: [], conds: [] };
    const secondaries = cards.filter(c => c.src === 'secondary').map(c => ({
      card: c.card, name: c.def.name, note: c.def.note || '', drawn: c.def.drawn || null, fixed: !!c.def.fixed,
      conds: evalCard(state, base, p, c, when, ctx)
    }));
    const u = capUsage(state, p);
    return {
      primary, secondaries,
      caps: {
        primaryRound: CAPS.primaryRound, primaryBattle: CAPS.primaryBattle, secRound: CAPS.secRound, secBattle: CAPS.secBattle, fixedCard: CAPS.fixedCard,
        used: { primaryRound: u.primaryRound, primaryBattle: u.primaryBattle, secRound: u.secRound, secBattle: u.secBattle },
        left: {
          primaryRound: Math.max(0, CAPS.primaryRound - u.primaryRound), primaryBattle: Math.max(0, CAPS.primaryBattle - u.primaryBattle),
          secRound: Math.max(0, CAPS.secRound - u.secRound), secBattle: Math.max(0, CAPS.secBattle - u.secBattle)
        }
      }
    };
  });
}

function buildGuide(state, base, phase) {
  const names = state.players.map(p => p.name);
  if (state.stage === 'setup') {
    return { title: 'Game setup', steps: ['Choose players, faction and Detachments.', 'Enter or import the army list.', 'Set the mission (deployment, dispositions, twist, Attacker).', 'Choose the secondary mode and confirm “Ready”.'], oppSteps: [], tips: [] };
  }
  if (state.stage === 'deploy') {
    return { title: 'Deployment', steps: ['Place units in your own deployment zone or put them in reserves.', 'Roll off for the first turn, then start the battle.'], oppSteps: [], tips: [] };
  }
  if (state.stage === 'over') {
    return { title: 'Battle over', steps: ['Check the final score.'], oppSteps: [], tips: [] };
  }
  const g = (WH.PHASE_GUIDE && WH.PHASE_GUIDE[phase.id]) || {};
  const tips = (WH.PHASE_TIPS && WH.PHASE_TIPS[phase.id]) || [];
  let steps = Array.isArray(g.you) ? g.you.slice() : (Array.isArray(g) ? g.slice() : tips.slice());
  const oppSteps = Array.isArray(g.opp) ? g.opp.slice() : [];
  if (!steps.length) steps = ['Resolve the phase, then “Next phase”.'];
  let title = phase.full + ' – ' + names[base.active];
  if (state.pending && state.pending.kind === 'score') {
    title = 'Confirm scoring – ' + names[state.pending.player];
    steps = ['Review and confirm the suggestions (or adjust the values).'].concat(steps);
  }
  return { title, steps, oppSteps, tips, round: state.round, active: base.active };
}

export function derive(state) {
  const base = deriveBase(state);
  const phase = phaseInfo(state);
  const stratagems = [0, 1].map(p => stratsWithAvailability(state, p));
  const phaseStrats = stratagems.map((list, p) => list.filter(s => state.stage === 'battle' && fitsPhase(state, p, s)));
  const scoring = buildScoring(state, base);
  const checkpoint = nextCheckpoint(state, base);
  const vp = [0, 1].map(p => { const t = vpTotals(state, p); return Object.assign(t, { total: t.primary + t.secondary + t.bonus }); });
  const turnMoves = (state.moves || []).filter(m => m.round === state.round && m.turn === state.turn);
  const lastKills = (state.kills || []).slice(-10).reverse();
  const armyRules = state.players.map(pl => {
    const fac = pl.faction ? factionById(pl.faction) : null;
    return {
      faction: fac ? { id: fac.id, name: fac.name, rule: fac.rule || '', resource: fac.resource || null } : null,
      detachments: (pl.detachments || []).map(id => { const d = fac ? detachmentById(fac.id, id) : null; return d ? { id: d.id, name: d.name, dp: d.dp, rule: d.rule || '', resource: d.resource || null } : { id, name: id, dp: 0, rule: '' }; })
    };
  });
  return {
    active: base.active,
    phase,
    control: base.control,
    counts: base.counts,
    territory: base.territory,
    nml: base.nml,
    zones: base.zones,
    stratagems,
    phaseStrats,
    scoring,
    checkpoint,
    pending: state.pending || null,
    cp: state.players.map(p => p.cp || 0),
    vp,
    turnMoves,
    lastKills,
    armyRules,
    guide: buildGuide(state, base, phase),
    turnNo: turnNo(state)
  };
}
