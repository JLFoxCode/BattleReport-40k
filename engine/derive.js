/* Abgeleitete Daten (SPEC §4). deriveBase() = Kontrolle/Territorium/Zählungen (vom Reducer genutzt),
 * derive() = vollständiges Objekt für den Client. */
import { WH } from '../data/rules.js';
import { halfMap } from '../data/half-table.js';
import { factionById, detachmentById } from '../data/factions/index.js';
import { dist, pointInPolygon, centroid, sideOfLine } from './geometry.js';
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
export function deploymentMapOf(state) {
  const name = state && state.mission && state.mission.deployment;
  if (!name) return null;
  if (state.opts && state.opts.board === 'half') { const m = halfMap(name); return m ? Object.assign({}, m, { zones: m.zones }) : null; }
  const m = WH.DEPLOYMENT_MAPS[name];
  if (!m) return null;
  return { zones: { a: m.zones.a, d: m.zones.d }, line: (m.zones && m.zones.line) || m.line || null, circle: (m.zones && m.zones.circle) || m.circle || null, home: m.home, exp: m.exp, centre: [22, 30] };
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
