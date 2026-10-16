/* Wertung: Automatik-Kontext a(c), Bedingungen, Checkpoints, Caps.
 * Alle Funktionen sind rein. "base" ist das Ergebnis von deriveBase(state) aus derive.js
 * (active, control, counts, territory, zones, nml). */
import { WH } from '../data/rules.js';

// Mission Deck 'Determine Victor': Primary 45 + Secondary 45 + Battle Ready army 10 = 100 VP
export const CAPS = { primaryRound: 15, primaryBattle: 45, secRound: 15, secBattle: 45, fixedCard: 20, battleReady: 10, total: 100 };
export const BATTLE_READY = { card: 'battle-ready', name: 'Battle Ready', text: 'Each player scores 10VP if their army is painted to a Battle Ready standard.' };
export const WHEN_MOMENTS = ['cmd', 'turn', 'end'];

/** Fortlaufende Zugnummer (1 = erster Zug der Runde 1); 0 vor Schlachtbeginn. */
export function turnNoOf(round, turn, first) {
  if (!round || round < 1) return 0;
  const f = first == null ? 0 : first;
  return (round - 1) * 2 + (turn === f ? 1 : 2);
}
export function turnNo(state) { return turnNoOf(state.round, state.turn, state.mission.first); }

export function checkpointKey(state, when, player) { return state.round + ':' + state.turn + ':' + when + ':' + player; }

/** Welcher Wertungs-Moment steht gerade an (ohne Berücksichtigung erledigter Checkpoints)? */
export function currentMoment(state) {
  if (state.pending && state.pending.kind === 'score') return state.pending.when;
  if (state.stage === 'over') return 'end';
  if (state.stage !== 'battle') return null;
  if (state.phase === 'command') return 'cmd';
  if (state.phase === 'end') return 'turn';
  return null;
}

/** Passt die Bedingung c zum Moment `when` für Spieler p? */
export function condMatches(c, state, p, when) {
  if (!c || !when) return false;
  const round = state.round;
  const r = Array.isArray(c.r) ? c.r : [1, 5];
  if (when !== 'end' && (round < r[0] || round > r[1])) return false;
  const isActive = state.turn === p;
  const first = state.mission.first == null ? 0 : state.mission.first;
  switch (c.w) {
    case 'cmd': return when === 'cmd' && isActive;
    case 'cmd5': return isActive && (round < 5 ? when === 'cmd' : when === 'turn');
    case 'turn': return when === 'turn' && isActive;
    case 'any': return when === 'turn';
    case 'opp': return when === 'turn' && (!isActive || (round === 5 && state.turn !== first));
    case 'oppt': return when === 'turn' && !isActive;
    case 'end': return when === 'end';
    default: return false;
  }
}

function markKey(p, key) { return 'p' + p + ':' + key; }

/** Automatik-Kontext für Spieler p (SPEC §4). Unbekannte Felder liefern 0. */
export function autoContext(state, base, p) {
  const o = 1 - p;
  const objs = state.objectives || [];
  const ctrlOf = x => (base.control[x.id] ? base.control[x.id].ctrl : x.ctrl);
  const mine = objs.filter(x => ctrlOf(x) === p);
  const theirs = objs.filter(x => ctrlOf(x) === o);
  const isOwnHome = x => x.home === p;
  const isOppHome = x => x.home === o;
  const nonHome = mine.filter(x => !isOwnHome(x));
  const exps = objs.filter(x => x.exp);
  const first = state.mission.first;
  const tn = turnNo(state);
  const killsOf = (pl, t) => (state.kills || []).filter(k => k.player === pl && turnNoOf(k.round, k.turn, first) === t);
  const hasMark = (x, key) => !!(x.marks && x.marks[markKey(p, key)]);
  const marked = (key, pred) => objs.filter(x => hasMark(x, key) && (!pred || pred(x)));
  const primary = WH.PRIMARY[state.mission.primary[p]] || {};
  const trkDefs = primary.trk || [];
  const inOppTerr = x => base.territory(x.pos) === o;
  const snapshot = state.ctrlAtTurnStart || {};

  const ctx = {
    myObjs: mine.length,
    oppObjs: theirs.length,
    myNonHome: nonHome.length,
    ownHome: mine.some(isOwnHome),
    oppHome: mine.some(isOppHome),
    central: mine.filter(x => x.central).length,
    inOppTerr: mine.filter(inOppTerr).length,
    newNonHome: nonHome.filter(x => snapshot[x.id] !== p).length,
    anyExp: mine.some(x => x.exp),
    allExp: exps.length > 0 && exps.every(x => ctrlOf(x) === p),
    nml: nonHome.filter(x => base.nml(x.pos)).length,
    kills: tag => killsOf(p, tn).filter(k => !tag || (Array.isArray(k.tags) && k.tags.includes(tag))).length,
    lossesPrev: killsOf(o, tn - 1).length,
    trk: id => {
      const def = trkDefs.find(t => t.id === id);
      if (def && def.derive) return marked(def.derive, def.where === 'oppTerr' ? inOppTerr : null).length;
      return marked(id).length;
    },
    markOn: (id, which) => {
      if (which === 'oppHome') return objs.some(x => isOppHome(x) && hasMark(x, id));
      if (which === 'ownHome') return objs.some(x => isOwnHome(x) && hasMark(x, id));
      if (which === 'central') return objs.some(x => x.central && hasMark(x, id));
      if (which == null) return marked(id).length > 0;
      return objs.some(x => x.id === which && hasMark(x, id));
    },
    marksCtrl: id => marked(id, x => ctrlOf(x) === p).length,
    tempting: objs.some(x => hasMark(x, 'tempting') && ctrlOf(x) === p),
    round: state.round, turn: state.turn, player: p
  };
  return new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : 0) });
}

/* Conditions that only read objective control (held objectives, home objective, "more than your opponent" …): the
 * scoring sheet pre-fills them from the objective strip; kill counts, markers and actions are never pre-filled.
 * Found by running the condition against a probe that records which context fields it reads. */
const OBJ_KEYS = new Set(['myObjs', 'oppObjs', 'myNonHome', 'ownHome', 'oppHome', 'central', 'inOppTerr', 'newNonHome', 'anyExp', 'allExp', 'nml', 'tempting', 'round', 'turn', 'player']);
const objMemo = new WeakMap();
export function objectiveBased(c) {
  if (!c || typeof c.a !== 'function') return false;
  if (objMemo.has(c)) return objMemo.get(c);
  const used = new Set();
  const fn = () => 0;
  const probe = new Proxy({}, { get: (t, k) => { used.add(k); return ['kills', 'trk', 'markOn', 'marksCtrl'].includes(k) ? fn : 0; } });
  try { c.a(probe); } catch { /* treated as not objective-based */ }
  const ok = [...used].some(k => !['round', 'turn', 'player'].includes(k)) && [...used].every(k => OBJ_KEYS.has(k));
  objMemo.set(c, ok);
  return ok;
}

/** Siegpunkte aus vp (Zahl oder {F,T}) je Modus. */
export function vpOf(v, mode) {
  if (v && typeof v === 'object') return Number(mode === 'fixed' ? v.F : v.T) || 0;
  return Number(v) || 0;
}

/** Bedingung auswerten → { count, choice, vp, raw } */
export function evalCondition(c, ctx, mode, parent) {
  let raw = null;
  if (typeof c.a === 'function') { try { raw = c.a(ctx); } catch (e) { raw = null; } }
  let count = 0, choice = -1, vp = 0;
  if (c.k === 'per') {
    count = Math.max(0, Math.floor(Number(raw) || 0));
    vp = count * vpOf(c.vp, mode);
    if (c.max != null) vp = Math.min(vp, Number(c.max));
  } else if (c.k === 'choice') {
    choice = (typeof raw === 'number' && Number.isFinite(raw)) ? Math.floor(raw) : -1;
    const opt = choice >= 0 && Array.isArray(c.opts) ? c.opts[choice] : null;
    vp = opt ? vpOf(opt.vp, mode) : 0;
    if (!opt) choice = -1;
  } else { // bool
    count = raw ? 1 : 0;
    vp = raw ? vpOf(c.vp, mode) : 0;
  }
  if (c.sub && parent && !parent.vp) vp = 0; // Unterbedingung zählt nur, wenn die Hauptbedingung erfüllt ist
  return { count, choice, vp, raw };
}

/** Maximal erreichbare SP einer Bedingung (für die UI-Begrenzung). */
export function condMax(c, mode) {
  if (c.k === 'per') return c.max != null ? Number(c.max) : null;
  if (c.k === 'choice') return Math.max(0, ...(c.opts || []).map(o => vpOf(o.vp, mode)));
  return vpOf(c.vp, mode);
}

export function condApplies(c, mode) {
  if (!c.mode) return true;
  return (c.mode === 'F') === (mode === 'fixed');
}

/** Aktive Sekundärkarten (ids) eines Spielers. */
export function activeSecondaries(player) {
  const s = player.secondaries || {};
  return s.mode === 'fixed' ? (s.fixed || []).slice() : (s.hand || []).slice();
}

/** Karten eines Spielers (Primär + aktive Sekundär) als [{ src, card, def }]. */
export function playerCards(state, p) {
  const pl = state.players[p];
  const out = [];
  const prim = state.mission.primary[p];
  if (prim && WH.PRIMARY[prim]) out.push({ src: 'primary', card: prim, def: WH.PRIMARY[prim] });
  for (const id of activeSecondaries(pl)) {
    if (WH.SECONDARY[id]) out.push({ src: 'secondary', card: id, def: WH.SECONDARY[id] });
  }
  return out;
}

function scoredThisTurn(state, p, src, card, ci) {
  return (state.scores || []).filter(s => s.player === p && s.src === src && s.card === card && s.ci === ci && s.round === state.round && s.turn === state.turn)
    .reduce((a, s) => a + s.vp, 0);
}

/** Bewertung aller Bedingungen einer Karte für Spieler p zum Moment `when` (null = kein Checkpoint). */
export function evalCard(state, base, p, entry, when, ctx) {
  const mode = state.players[p].secondaries.mode;
  const conds = [];
  let parent = null;
  (entry.def.c || []).forEach((c, ci) => {
    if (!condApplies(c, mode)) return;
    const res = evalCondition(c, ctx, mode, c.sub ? parent : null);
    if (!c.sub) parent = res;
    const active = condMatches(c, state, p, when);
    conds.push({
      ci, text: c.t, when: c.w, whenLabel: WH.TIMING_LABELS[c.w] || c.w, r: c.r, k: c.k, sub: !!c.sub,
      vp: c.k === 'choice' ? null : vpOf(c.vp, mode),
      opts: c.k === 'choice' ? (c.opts || []).map(o => ({ t: o.t, vp: vpOf(o.vp, mode) })) : null,
      max: condMax(c, mode),
      active, suggest: active ? res.vp : 0, suggestRaw: res.vp, count: res.count, choice: res.choice,
      auto: typeof c.a === 'function', obj: objectiveBased(c),
      scoredThisTurn: scoredThisTurn(state, p, entry.src, entry.card, ci)
    });
  });
  return conds;
}

/** Vorschlagsliste für einen Checkpoint (leer, wenn keine Bedingung aktiv ist). */
export function checkpointItems(state, base, p, when) {
  const ctx = autoContext(state, base, p);
  const items = [];
  for (const entry of playerCards(state, p)) {
    const conds = evalCard(state, base, p, entry, when, ctx);
    for (const c of conds) {
      if (!c.active) continue;
      // bereits in diesem Zug manuell gebuchte SP (z. B. am Tablet angetippt) nicht erneut vorschlagen
      const already = c.scoredThisTurn || 0;
      const open = Math.max(0, (c.suggest || 0) - already);
      items.push({ src: entry.src, card: entry.card, name: entry.def.name, ci: c.ci, vp: open, suggest: open, already, auto: !!c.auto, obj: !!c.obj, text: c.text, k: c.k, count: c.count, choice: c.choice, max: c.max, sub: c.sub });
    }
  }
  // end of the battle: 10 VP for a Battle Ready army (the players decide – never suggested)
  if (when === 'end' && !(state.scores || []).some(s => s.player === p && s.src === 'bonus' && s.card === BATTLE_READY.card)) {
    items.push({ src: 'bonus', card: BATTLE_READY.card, name: BATTLE_READY.name, ci: null, vp: 0, suggest: 0, already: 0, auto: false, text: BATTLE_READY.text, unit: CAPS.battleReady, max: CAPS.battleReady });
  }
  return items;
}

/** Bereits gebuchte Summen für die Caps. */
export function capUsage(state, p, round) {
  const sc = (state.scores || []).filter(s => s.player === p);
  const sum = arr => arr.reduce((a, s) => a + s.vp, 0);
  const r = round == null ? state.round : round;   // a correction of an earlier turn counts against that round
  const inRound = s => s.round === r && s.when !== 'end';
  return {
    primaryRound: sum(sc.filter(s => s.src === 'primary' && inRound(s))),
    primaryBattle: sum(sc.filter(s => s.src === 'primary')),
    secRound: sum(sc.filter(s => s.src === 'secondary' && inRound(s))),
    secBattle: sum(sc.filter(s => s.src === 'secondary')),
    card: card => sum(sc.filter(s => s.src === 'secondary' && s.card === card)),
    bonus: sum(sc.filter(s => s.src === 'bonus'))
  };
}

/** Wendet die Caps aus SPEC §5 auf einen neuen Eintrag an → { vp, clamped, reason }. */
export function applyCaps(state, p, entry) {
  const u = capUsage(state, p, entry.round);
  let vp = Number(entry.vp) || 0;
  const orig = vp;
  const reasons = [];
  if (vp <= 0) return { vp, clamped: false, reason: '' };
  const isEnd = entry.when === 'end';
  if (entry.src === 'primary') {
    if (!isEnd && u.primaryRound + vp > CAPS.primaryRound) { vp = Math.max(0, CAPS.primaryRound - u.primaryRound); reasons.push('Primary max. ' + CAPS.primaryRound + ' VP/round'); }
    if (u.primaryBattle + vp > CAPS.primaryBattle) { vp = Math.max(0, CAPS.primaryBattle - u.primaryBattle); reasons.push('Primary max. ' + CAPS.primaryBattle + ' VP/battle'); }
  } else if (entry.src === 'secondary') {
    if (!isEnd && u.secRound + vp > CAPS.secRound) { vp = Math.max(0, CAPS.secRound - u.secRound); reasons.push('Secondary max. ' + CAPS.secRound + ' VP/round'); }
    if (u.secBattle + vp > CAPS.secBattle) { vp = Math.max(0, CAPS.secBattle - u.secBattle); reasons.push('Secondary max. ' + CAPS.secBattle + ' VP/battle'); }
    const pl = state.players[p];
    if (pl.secondaries.mode === 'fixed' && (pl.secondaries.fixed || []).includes(entry.card)) {
      const used = u.card(entry.card);
      if (used + vp > CAPS.fixedCard) { vp = Math.max(0, CAPS.fixedCard - used); reasons.push('Fixed Mission card max. ' + CAPS.fixedCard + ' VP'); }
    }
  } else if (entry.src === 'bonus' && entry.card === BATTLE_READY.card) {
    const used = (state.scores || []).filter(s => s.player === p && s.src === 'bonus' && s.card === BATTLE_READY.card).reduce((a, s) => a + s.vp, 0);
    if (used + vp > CAPS.battleReady) { vp = Math.max(0, CAPS.battleReady - used); reasons.push('Battle Ready max. ' + CAPS.battleReady + ' VP'); }
  }
  return { vp, clamped: vp !== orig, reason: reasons.join(', ') };
}

export function vpTotals(state, p) {
  const sc = (state.scores || []).filter(s => s.player === p);
  const t = { primary: 0, secondary: 0, bonus: 0 };
  for (const s of sc) { if (s.src in t) t[s.src] += s.vp; }
  return t;
}
