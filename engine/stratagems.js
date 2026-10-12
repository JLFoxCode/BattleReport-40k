/* Stratageme: Liste je Spieler (Kern + Detachments) und Verfügbarkeitsprüfung.
 * Regeln (SPEC §5): Phase passt, whose passt zum Zug, CP ≥ Kosten, Sperre (phase|round),
 * Insane Bravery 1×/Schlacht (once), Rapid Ingress nicht in Runde 1 (notRound1),
 * eine Einheit max. 1 Stratagem pro Phase als Ziel, kampfgeschockte Einheiten kein Ziel eigener Stratageme. */
import { WH } from '../data/rules.js';
import { factionById, detachmentById } from '../data/factions/index.js';

/** Alle Stratageme eines Spielers (ohne Verfügbarkeit). */
export function stratList(state, p) {
  const pl = state.players[p];
  const out = WH.STRATAGEMS.map(s => Object.assign({}, s, { kind: 'core', detName: null }));
  const fac = pl && pl.faction ? factionById(pl.faction) : null;
  for (const detId of (pl && pl.detachments) || []) {
    const det = fac ? detachmentById(fac.id, detId) : null;
    if (!det) continue;
    for (const s of det.strats || []) out.push(Object.assign({}, s, { kind: 'detachment', detName: det.name, detId: det.id }));
  }
  return out;
}

export function stratById(state, p, stratId) {
  return stratList(state, p).find(s => s.id === stratId) || null;
}

export function usesOf(state, p, stratId) {
  return (state.stratUses || []).filter(u => u.player === p && u.stratId === stratId);
}

/** Phases are not tracked by the players (opts.phases !== 'manual'): a stratagem is booked under its own phase. */
export function phasesTracked(state) { return !!(state && state.opts && state.opts.phases === 'manual'); }
export function useKeyPhase(state, strat) {
  if (phasesTracked(state)) return state.phase;
  const ph = Array.isArray(strat && strat.ph) ? strat.ph : ['any'];
  return ph.includes('any') ? 'any' : ph[0];
}

export function usedThisPhase(state, p, stratId, strat) {
  const key = strat ? useKeyPhase(state, strat) : state.phase;
  return usesOf(state, p, stratId).filter(u => u.round === state.round && u.turn === state.turn && u.phase === key).length;
}

export function usedThisRound(state, p, stratId) {
  return usesOf(state, p, stratId).filter(u => u.round === state.round).length;
}

/** Passt das Stratagem grundsätzlich in die aktuelle Phase / den aktuellen Zug? */
export function fitsPhase(state, p, strat) {
  const ph = Array.isArray(strat.ph) && strat.ph.length ? strat.ph : ['any'];
  const phaseOk = !phasesTracked(state) || ph.includes('any') || ph.includes(state.phase);
  const own = state.turn === p;
  const whose = strat.whose || 'either';
  const whoseOk = whose === 'either' || (whose === 'own' && own) || (whose === 'opp' && !own);
  return phaseOk && whoseOk;
}

/** Verfügbarkeitsprüfung → { ok, reason, cost }. cost optional (Popup-Kosten, auch 0). */
export function stratCheck(state, p, strat, cost, unitId) {
  const c = cost == null ? Number(strat.cost) || 0 : Number(cost);
  const res = r => ({ ok: false, reason: r, cost: c });
  if (!strat) return res('Unknown Stratagem');
  if (state.stage !== 'battle') return res('Battle not in progress');
  const pl = state.players[p];
  if (!pl) return res('Unknown player');
  const ph = Array.isArray(strat.ph) && strat.ph.length ? strat.ph : ['any'];
  if (phasesTracked(state) && !(ph.includes('any') || ph.includes(state.phase))) {
    const names = ph.map(id => { const x = WH.PHASES.find(q => q.id === id); return x ? x.full : id; });
    return res('Only in: ' + names.join(', '));
  }
  const own = state.turn === p;
  const whose = strat.whose || 'either';
  if (whose === 'own' && !own) return res('Only in your own turn');
  if (whose === 'opp' && own) return res('Only in your opponent\'s turn');
  if (strat.notRound1 && state.round === 1) return res('Not in battle round 1');
  if (strat.once && usesOf(state, p, strat.id).length > 0) return res('Once per battle – already used');
  const lock = (state.opts && state.opts.stratLock) || 'phase';
  if (lock === 'round') {
    if (usedThisRound(state, p, strat.id) > 0) return res('Already used this battle round (house rule)');
  } else if (usedThisPhase(state, p, strat.id, strat) > 0) return res('Already used this phase');
  if (c < 0) return res('Invalid cost');
  if ((pl.cp || 0) < c) return res('Not enough CP (' + (pl.cp || 0) + '/' + c + ')');
  if (unitId) {
    const owner = state.players.findIndex(q => (q.units || []).some(u => u.id === unitId));
    const unit = owner >= 0 ? state.players[owner].units.find(u => u.id === unitId) : null;
    if (!unit) return res('Unit not found');
    if (owner === p && unit.status === 'shocked') return res('Battle-shocked units cannot be targeted by your own Stratagems');
    if (unit.status === 'destroyed') return res('Unit is destroyed');
    const targeted = (state.stratUses || []).some(u => u.player === p && u.unitId === unitId && u.round === state.round && u.turn === state.turn && u.phase === useKeyPhase(state, strat));
    if (targeted) return res('This unit was already targeted by a Stratagem this phase');
  }
  return { ok: true, reason: '', cost: c };
}

/** Liste mit Verfügbarkeit für derive(). */
export function stratsWithAvailability(state, p) {
  return stratList(state, p).map(s => {
    const chk = stratCheck(state, p, s, null, null);
    return Object.assign({}, s, {
      available: chk.ok, reason: chk.reason,
      usedThisPhase: usedThisPhase(state, p, s.id, s),
      usedThisRound: usedThisRound(state, p, s.id),
      usedTotal: usesOf(state, p, s.id).length,
      fits: state.stage === 'battle' && fitsPhase(state, p, s)
    });
  });
}
