/* Reducer: reduce(state, action) → neuer State (SPEC §3). Rein und deterministisch:
 * Zeitstempel aus action.ts, Zufall nur über engine/rng.js (state.rngState). */
import { WH } from '../data/rules.js';
import { factionById, detachmentById } from '../data/factions/index.js';
import { shuffle } from './rng.js';
import { dist, pointInPolygon, round2 } from './geometry.js';
import { deriveBase, zoneOf, activePlayer } from './derive.js';
import { checkpointItems, checkpointKey, applyCaps, vpTotals, CAPS } from './scoring.js';
import { stratById, stratCheck, useKeyPhase } from './stratagems.js';

export const ACTIONS = {
  GAME_INIT: 'game.init', OPTS_SET: 'opts.set', PLAYER_SET: 'player.set', PLAYER_ARMY: 'player.army',
  UNIT_ADD: 'unit.add', UNIT_UPDATE: 'unit.update', UNIT_REMOVE: 'unit.remove', ARMY_IMPORT: 'army.import',
  PLAYER_READY: 'player.ready', MISSION_SET: 'mission.set', OBJECTIVES_BUILD: 'objectives.build',
  SECONDARIES_MODE: 'secondaries.mode', STAGE_DEPLOY: 'stage.deploy', UNIT_PLACE: 'unit.place',
  UNIT_RESERVE: 'unit.reserve', UNIT_STATUS: 'unit.status', UNIT_MODELS: 'unit.models', STAGE_BATTLE: 'stage.battle',
  PHASE_NEXT: 'phase.next', PHASE_SET: 'phase.set', CP_ADJUST: 'cp.adjust', STRAT_USE: 'strat.use', STRAT_UNDO: 'strat.undo',
  SEC_DRAW: 'sec.draw', SEC_DISCARD: 'sec.discard', SEC_ACHIEVE: 'sec.achieve',
  OBJECTIVE_OVERRIDE: 'objective.override', OBJECTIVE_MARK: 'objective.mark', OBJECTIVE_STICKY: 'objective.sticky',
  SCORE_ADD: 'score.add', SCORE_REMOVE: 'score.remove', SCORE_CONFIRM: 'score.confirm', SCORE_CORRECT: 'score.correct', CP_OFFER: 'cp.offer',
  RESOURCE_SET: 'resource.set', NOTE_ADD: 'note.add', GAME_END: 'game.end', GAME_RESET: 'game.reset',
  ABILITY_USE: 'ability.use', ABILITY_UNDO: 'ability.undo', EFFECT_SET: 'effect.set'
};
export const ACTION_TYPES = Object.values(ACTIONS);

const PHASE_IDS = WH.PHASES.map(p => p.id);
const DP_LIMIT = { strike: 3, incursion: 2 };
// Detachment Points: by game size (Incursion 2, Strike Force 3) unless set by hand in the game options (opts.dp)
const dpLimitOf = s => (s.opts.dp != null ? num(s.opts.dp, 3) : DP_LIMIT[s.opts.size] || 3);
const STATUSES = ['ok', 'shocked', 'destroyed'];
const RESERVES = ['none', 'strategic', 'deepstrike', 'transport'];
const SIZES = ['strike', 'incursion'];
// points limit by game size (core 25.03) – switching the size moves a default limit along
const SIZE_POINTS = { strike: 2000, incursion: 1000 };
const LOCKS = ['phase', 'round'];

const fail = msg => { throw new Error(msg); };
const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const isIdx = p => p === 0 || p === 1;
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Token-Radius nach Modellzahl (Zoll). */
export function radiusFor(models) {
  const m = num(models, 1);
  if (m <= 1) return 0.6;
  if (m <= 5) return 1.0;
  if (m <= 10) return 1.5;
  if (m <= 20) return 2.2;
  return 3;
}

function emptySecondaries() {
  return { mode: 'tactical', fixed: [], deck: [], hand: [], discard: [], achieved: [], toDraw: 0, redrawUsed: false, cpDiscardTurn: null };
}

function emptyPlayer(i) {
  return {
    name: 'Player ' + (i + 1), color: i, faction: null, detachments: [], ready: false, cp: 0,
    vp: { primary: 0, secondary: 0, bonus: 0 }, secondaries: emptySecondaries(), resources: [], units: [], effects: {}
  };
}

export function initialState(code, seed) {
  return {
    v: 1, code: String(code || 'XXXX'), createdAt: null, seq: 0,
    stage: 'setup',
    opts: { stratLock: 'phase', autoScore: true, points: 2000, size: 'strike', phases: 'off', dp: null },
    rngState: (num(seed, 123456) >>> 0),
    mission: { deployment: null, dispositions: [null, null], primary: [null, null], twist: null, mirrored: null, attacker: null, first: null, terrainLayout: null },
    players: [emptyPlayer(0), emptyPlayer(1)],
    objectives: [],
    round: 0, turn: 0, phase: 'command',
    scores: [], kills: [], moves: [], stratUses: [], abilityUses: [], log: [],
    pending: null,
    ctrlAtTurnStart: {},
    checkpointsDone: [],
    ids: 0,
    unitSeq: 0
  };
}

// ───────── Helfer ─────────
function nid(s, prefix) {
  if (prefix === 'u') { s.unitSeq = (s.unitSeq || 0) + 1; return 'u' + s.unitSeq; }
  s.ids = (s.ids || 0) + 1; return prefix + s.ids;
}

function log(s, action, text, player, data) {
  s.log.push({
    id: nid(s, 'l'), ts: action && action.ts != null ? action.ts : null,
    round: s.round, turn: s.turn, phase: s.phase,
    player: player != null ? player : (action && isIdx(action.by) ? action.by : null),
    type: action ? action.type : 'log', text, data: data == null ? null : data
  });
}

function pIdx(s, p) {
  if (!isIdx(p)) fail('Invalid player');
  return s.players[p];
}
function pName(s, p) { return isIdx(p) ? s.players[p].name : 'Player'; }

function unitOf(s, p, unitId) {
  const pl = pIdx(s, p);
  const u = pl.units.find(x => x.id === unitId);
  if (!u) fail('Unit not found');
  return u;
}

function objOf(s, id) {
  const o = s.objectives.find(x => x.id === id);
  if (!o) fail('Objective not found');
  return o;
}

function recalcVp(s) {
  s.players.forEach((pl, p) => { pl.vp = vpTotals(s, p); });
}

/** Kontrolle neu berechnen (nach Positions-/Statusänderung); sticky wird bei Übernahme gelöscht. */
function recalcControl(s) {
  const base = deriveBase(s);
  for (const o of s.objectives) {
    const c = base.control[o.id];
    if (!c) continue;
    o.ctrl = c.ctrl;
    o.oc = c.oc;
    if ((o.sticky === 0 || o.sticky === 1) && c.ctrl === 1 - o.sticky) o.sticky = null;
  }
  return base;
}

function normalizeUnit(s, raw, p, keepId) {
  const u = raw || {};
  const models = Math.max(0, Math.floor(num(u.models, 1)));
  const modelsStart = Math.max(models, Math.floor(num(u.modelsStart, models)));
  const keywords = Array.isArray(u.keywords) ? u.keywords.map(k => String(k).toUpperCase()) : [];
  const character = !!u.character || keywords.includes('CHARACTER');
  if (character && !keywords.includes('CHARACTER')) keywords.push('CHARACTER');
  return {
    id: keepId ? String(u.id) : (u.id && !s.players.some(pl => pl.units.some(x => x.id === u.id)) ? String(u.id) : nid(s, 'u')),
    name: String(u.name || 'Unit').trim() || 'Unit',
    models, modelsStart,
    oc: Math.max(0, num(u.oc, 1)), move: Math.max(0, num(u.move, 6)), wounds: Math.max(1, num(u.wounds, 1)),
    keywords, character, points: Math.max(0, num(u.points, 0)),
    r: u.r != null ? Math.max(0.3, num(u.r, radiusFor(models))) : radiusFor(models),
    pos: u.pos && Number.isFinite(num(u.pos.x, NaN)) ? { x: num(u.pos.x), y: num(u.pos.y) } : null,
    reserve: RESERVES.includes(u.reserve) ? u.reserve : 'none',
    status: STATUSES.includes(u.status) ? u.status : 'ok',
    startPos: null,
    // Aus dem Listenimport: gewählte Ausrüstung, Enhancements, Warlord (für die Datenblatt-Anzeige)
    wargear: Array.isArray(u.wargear) ? u.wargear.map(w => typeof w === 'string' ? { name: w, count: 1 } : { name: String(w.name || ''), count: Math.max(1, num(w.count, 1)) }).filter(w => w.name) : [],
    enhancements: Array.isArray(u.enhancements) ? u.enhancements.map(String) : [],
    warlord: !!u.warlord,
    // Leader attachment from the list import (names as written in the export; resolved to units by the UI)
    leading: u.leading ? String(u.leading) : null,
    attachedTo: u.attachedTo ? String(u.attachedTo) : null,
    // profile changes from the army builder (enhancements, wargear) – shown on the datasheets
    mods: u.mods && typeof u.mods === 'object' ? u.mods : null,
    // "+1 CP at the start of the battle round / your Command phase" rules of this unit (found in its datasheet at import)
    cpRules: Array.isArray(u.cpRules) ? u.cpRules.filter(r => r && CP_WHEN.includes(r.when)).slice(0, 8).map(r => ({
      name: String(r.name || 'Rule').slice(0, 60), when: r.when, req: r.req === 'warlord' ? 'warlord' : 'onField', cp: Math.max(1, Math.min(3, Math.floor(num(r.cp, 1))))
    })) : []
  };
}
const CP_WHEN = ['roundStart', 'commandStart'];

/** Start of a battle round / of a Command phase: the units' "+1 CP" rules (Da Boss, Transhuman Strategist: your WARLORD
 *  has the ability; Grand Strategist …: the model is on the battlefield) become OFFERS (s.cpOffers) – the app cannot know
 *  whether the model is still on the battlefield, so the player confirms each one (cp.offer). Offers of the previous turn
 *  expire. Old games' units have no cpRules → no offers. */
function offerCpRules(s, p, roundStart) {
  const offers = [];
  s.players.forEach((pl, i) => {
    const seen = new Set();
    for (const u of pl.units) for (const r of u.cpRules || []) {
      if (u.status === 'destroyed' || seen.has(r.name)) continue;   // marked destroyed: certainly not
      if (!(r.when === 'roundStart' ? roundStart : (r.when === 'commandStart' && i === p))) continue;
      if (r.req === 'warlord' && !u.warlord) continue;
      seen.add(r.name);
      offers.push({ id: nid(s, 'co'), player: i, name: r.name, unitId: u.id, unitName: u.name, cp: r.cp, when: r.when, req: r.req, round: s.round, turn: s.turn });
    }
  });
  if (offers.length || (s.cpOffers && s.cpOffers.length)) s.cpOffers = offers;
}

function buildObjectives(s) {
  const map = WH.DEPLOYMENT_MAPS[s.mission.deployment];
  if (!map) return [];
  const att = s.mission.attacker === 1 ? 1 : s.mission.attacker === 0 ? 0 : null;
  const def = att == null ? null : 1 - att;
  const prev = s.objectives || [];
  const keep = (id) => { const o = prev.find(x => x.id === id); return o ? { marks: o.marks || {}, override: o.override == null ? null : o.override, sticky: o.sticky == null ? null : o.sticky } : { marks: {}, override: null, sticky: null }; };
  const mk = (id, name, kind, pos, home) => Object.assign({ id, name, kind, pos: pos.slice(), home, exp: kind === 'exp', central: kind !== 'home', ctrl: null, oc: [0, 0] }, keep(id));
  const objs = [
    mk('o1', 'Attacker Home', 'home', map.home.a, att),
    mk('o2', 'Defender Home', 'home', map.home.d, def),
    mk('o3', 'Expansion 1', 'exp', map.exp[0], null),
    mk('o4', 'Expansion 2', 'exp', map.exp[1], null),
    mk('o5', 'Center', 'central', [22, 30], null)
  ];
  return objs;
}

function computePrimary(s) {
  const d = s.mission.dispositions;
  const prim = [null, null];
  for (let i = 0; i < 2; i++) {
    const my = d[i], op = d[1 - i];
    if (my && op && WH.MATRIX[my] && WH.MATRIX[my][op]) prim[i] = WH.MATRIX[my][op];
  }
  if (s.mission.twist === 'scrambled') prim.reverse();
  if (s.mission.twist === 'mirrored') {
    const m = s.mission.mirrored && WH.MIRRORED.includes(s.mission.mirrored) ? s.mission.mirrored : (prim[0] || prim[1] ? WH.MIRRORED[0] : null);
    if (m) { prim[0] = m; prim[1] = m; }
  }
  s.mission.primary = prim;
}

function ensureDeck(s, p) {
  const sec = s.players[p].secondaries;
  if (sec.mode !== 'tactical' || sec.deck.length || sec.hand.length || sec.discard.length) return;
  const r = shuffle(s.rngState, Object.keys(WH.SECONDARY));
  s.rngState = r.next;
  sec.deck = r.arr;
}

function setStartPositions(s, p) {
  for (const u of s.players[p].units) u.startPos = u.pos ? { x: u.pos.x, y: u.pos.y } : null;
}

/** Beginn eines Zuges: CP +1 für beide, Snapshot, startPos, Kampfschock-Reset, Tactical-Karten. */
function enterCommand(s, action) {
  const p = s.turn;
  const base = recalcControl(s);
  s.ctrlAtTurnStart = {};
  for (const o of s.objectives) s.ctrlAtTurnStart[o.id] = base.control[o.id] ? base.control[o.id].ctrl : null;
  setStartPositions(s, p);
  // Older games: battle-shock ended by itself here. Games started with phase tracking (s.shockByRoll) follow 08.03: a unit
  // stays battle-shocked until its battle-shock roll in the Battle-shock step succeeds (cleared by hand).
  let unshocked = 0;
  if (!s.shockByRoll) for (const u of s.players[p].units) if (u.status === 'shocked') { u.status = 'ok'; unshocked++; }
  s.players.forEach(pl => { pl.cp = (pl.cp || 0) + 1; });
  const sec = s.players[p].secondaries;
  if (sec.mode === 'tactical') { ensureDeck(s, p); sec.toDraw = (sec.toDraw || 0) + 2; }
  log(s, action, 'Battle round ' + s.round + ', ' + pName(s, p) + '\'s turn: Command phase. Both players gain 1 CP.' + (sec.mode === 'tactical' ? ' ' + pName(s, p) + ' draws 2 Secondary Mission cards.' : '') + (unshocked ? ' Battle-shock removed from ' + unshocked + ' unit(s).' : ''), p, { round: s.round, turn: p });
  offerCpRules(s, p, p === (isIdx(s.mission.first) ? s.mission.first : 0));
  if (unshocked) recalcControl(s);
}

/** Wertung eintragen (mit Caps). Gibt den Eintrag zurück (oder null bei 0 SP). */
function addScore(s, action, { player, src, card, ci, vp, when, auto, round, turn }) {
  const p = player;
  pIdx(s, p);
  if (!['primary', 'secondary', 'bonus'].includes(src)) fail('Invalid score source');
  let v = Math.round(num(vp, 0));
  let note = '';
  const r = round == null ? s.round : round, t = turn == null ? s.turn : turn;   // score.correct books into an earlier turn
  if (v > 0) {
    const capped = applyCaps(s, p, { src, card, vp: v, when, round: r });
    if (capped.clamped) {
      note = ' (capped: ' + capped.reason + ', ' + v + ' → ' + capped.vp + ')';
      v = capped.vp;
    }
  }
  const cardName = src === 'primary' ? ((WH.PRIMARY[card] || {}).name || card) : src === 'secondary' ? ((WH.SECONDARY[card] || {}).name || card) : (card === 'modifier' ? 'Modifier' : card === 'battle-ready' ? 'Battle Ready' : 'Bonus');
  const entry = { id: nid(s, 's'), player: p, round: r, turn: t, when: when || 'manual', src, card: card || null, ci: ci == null ? null : ci, vp: v, auto: !!auto };
  if (v !== 0) s.scores.push(entry);
  recalcVp(s);
  if (v !== 0 || note) log(s, action, pName(s, p) + ': ' + (v >= 0 ? '+' : '') + v + ' VP ' + (src === 'primary' ? 'Primary' : src === 'secondary' ? 'Secondary' : 'Bonus') + ' – ' + cardName + (ci != null ? ' [' + (ci + 1) + ']' : '') + note, p, { score: entry, clamped: !!note });
  return v !== 0 ? entry : null;
}

/** Checkpoint prüfen; erzeugt pending, falls Bedingungen aktiv sind. Gibt true zurück, wenn pending gesetzt wurde. */
function runCheckpoint(s, action, base, p, when, withCmd) {
  const key = checkpointKey(s, when, p);
  if (s.checkpointsDone.includes(key)) return false;
  s.checkpointsDone.push(key);
  let items = checkpointItems(s, base, p, when);
  // Deferred Command-phase scoring (End turn on the tablet): cmd conditions first, all in one popup
  const cmdKey = checkpointKey(s, 'cmd', p);
  if (withCmd && !s.checkpointsDone.includes(cmdKey)) {
    s.checkpointsDone.push(cmdKey);
    items = checkpointItems(s, base, p, 'cmd').concat(items);
    delete s.cmdDeferred;
  }
  if (!items.length) return false;
  s.pending = { kind: 'score', player: p, when, key, items };
  const label = { cmd: 'End of Command phase', turn: 'End of turn', end: 'End of battle' }[when] || when;
  log(s, action, 'Scoring ' + label + ' for ' + pName(s, p) + ': ' + items.length + ' condition(s) to check', p, { when, items });
  return true;
}

/** Several checkpoints in ONE pending scoring (tablet: one sheet per end of turn with a section per player – the
 *  active player's end of turn and the opponent's reactive missions, in the last turn also the end of the battle).
 *  list = [{ p, when, withCmd }]. pending.parts = [{ player, when, key, items, done }]; each player confirms their part
 *  (score.confirm { player } on their phone) or the tablet confirms all at once (score.confirm { parts }).
 *  pending.player / when / key / items mirror the first open part (older clients). */
function runMerged(s, action, base, list) {
  const parts = [];
  for (const { p, when, withCmd } of list) {
    const key = checkpointKey(s, when, p);
    if (s.checkpointsDone.includes(key)) continue;
    s.checkpointsDone.push(key);
    let items = checkpointItems(s, base, p, when);
    const cmdKey = checkpointKey(s, 'cmd', p);
    if (withCmd && !s.checkpointsDone.includes(cmdKey)) {
      s.checkpointsDone.push(cmdKey);
      items = checkpointItems(s, base, p, 'cmd').concat(items);
      delete s.cmdDeferred;
    }
    if (items.length) parts.push({ player: p, when, key, items, done: false });
  }
  if (!parts.length) return false;
  s.pending = { kind: 'score', player: parts[0].player, when: parts[0].when, key: parts[0].key, items: parts[0].items, mkey: parts.map(x => x.key).join('+'), parts };
  const label = { cmd: 'End of Command phase', turn: 'End of turn', end: 'End of battle' };
  for (const part of parts) log(s, action, 'Scoring ' + (label[part.when] || part.when) + ' for ' + pName(s, part.player) + ': ' + part.items.length + ' condition(s) to check', part.player, { when: part.when, items: part.items, merged: true });
  return true;
}

function finishBattle(s, action) {
  s.stage = 'over';
  s.pending = null;
  delete s.cpOffers;
  log(s, action, 'Battle over. Final score: ' + s.players.map(pl => pl.name + ' ' + (pl.vp.primary + pl.vp.secondary + pl.vp.bonus) + ' VP').join(' – ') + '.', null);
}

// ───────── Armee-Import ─────────
const SECTION_RE = /^(CHARACTERS?|BATTLELINE|DEDICATED TRANSPORTS?|OTHER DATASHEETS?|ALLIED UNITS?|FORTIFICATIONS?|CHARAKTERE|KERNEINHEITEN|TRANSPORTER|ANDERE EINHEITEN)\s*:?\s*$/i;
const UNIT_RE = /^(?:[•\-\*]\s*)?(?:(\d+)\s*x\s+)?(.+?)\s*[\(\[]\s*(\d+)\s*(?:pts?|points?|punkte|pkt|p)\.?\s*[\)\]]\s*$/i;
const MODEL_RE = /^(?:[•\-\*]\s*)?(\d+)\s*x\s+(.+?)\s*$/i;
const SIZE_RE = /^(strike force|incursion|onslaught|combat patrol|boarding action)/i;
// New-Recruit-/WTC-Format: "Char1: 1x Warboss (65 pts): Warlord, Power klaw", "Enhancement: X (+25 pts)", "Leading Boyz[1]", "5 with Choppa, Slugga"
const CHAR_RE = /^Char\d+\s*:\s*/i;
const UNIT_SUFFIX_RE = /^(.*?[\)\]])\s*(?:\[\s*\+?\d+\s*(?:pts?|points?|punkte|pkt)\.?\s*\])?\s*(?::\s*(.+))?$/i;
const ENH_RE = /^(?:[•\-\*◦○]\s*)?Enhancements?\s*:\s*(.+?)\s*(?:[\(\[]\s*\+?\s*\d[\d ,.]*\s*(?:pts?|points?|punkte|pkt|p)\.?\s*[\)\]])?\s*$/i;
const WARLORD_RE = /^(?:[•\-\*◦○]\s*)?Warlord\s*$/i;
// "[n]" = the n-th unit of that name in the list (two same-named bodyguard units stay apart)
const LEAD_RE = /^(?:[•\-\*◦○]\s*)?(Leading|Attached to)\s+(.+?)\s*(?:\[(\d+)\])?\s*$/i;
// New Recruit "ATTACHED UNITS" block: "Attached unit 1" = one group; in it the leader(s) ("• Attached as: Leader (Character)")
// and the led unit ("• Attached as: Bodyguard")
const ATTACHED_HDR_RE = /^ATTACHED UNITS?\s*:?\s*$/i;
const ATTACHED_GROUP_RE = /^Attached unit\s+(\d+)\s*:?\s*$/i;
const ATTACHED_AS_RE = /^(?:[•\-\*◦○]\s*)?Attached as\s*:\s*(.+?)\s*$/i;
const WITH_RE = /^(?:[•\-\*◦○]\s*)?(\d+)\s+with\s+(.+)$/i;
const GEAR_RE = /^(?:(\d+)\s*x?\s+)?(.+?)\s*$/i;

/** Chat/forum unit lines → the New Recruit form UNIT_RE reads: "Name - 90" / "Name (90): …" / "Overlord (115 pts) - Warlord, X" /
 *  "3 Skorpekh Destroyers (85 pts)" / "Lychguard x5 (80 pts)" / "Autarch w/ Mantle of Wisdom (Warlord) - 90". Bullet lines stay. */
function chatUnitLine(t) {
  if (/^[•\-\*◦○]/.test(t)) return t;
  let s = t, gear = [];
  const dash = /^(.+?)\s+[-–—]\s+(\d+)\s*(?:pts?|points?|punkte|pkt)?\.?\s*$/i.exec(s);
  if (dash && !/[\(\[]\s*\d+\s*(?:pts?|points?|punkte|pkt|p)?\.?\s*[\)\]]/i.test(dash[1])) {
    let name = dash[1];
    if (/\(\s*warlord\s*\)/i.test(name)) { gear.push('Warlord'); name = name.replace(/\s*\(\s*warlord\s*\)/i, ''); }
    const w = /^(.+?)\s+(?:w\/|with)\s+(.+)$/i.exec(name);
    if (w) { name = w[1]; gear.push(w[2]); }
    s = `${name.trim()} (${dash[2]} pts)`;
  } else {
    const bare = /^(.+?)\s*\(\s*(\d+)\s*\)\s*(?::\s*(.*))?$/.exec(s);
    if (bare && +bare[2] >= 10) { s = `${bare[1]} (${bare[2]} pts)`; if (bare[3]) gear.push(bare[3]); }
    const after = /^(.+?[\)\]])\s+[-–—]\s+(.+)$/.exec(s);
    if (after && /\d\s*(?:pts?|points?|punkte|pkt|p)\.?\s*[\)\]]$/i.test(after[1])) { s = after[1]; gear.push(after[2]); }
  }
  if (!/[\(\[]\s*\d+\s*(?:pts?|points?|punkte|pkt|p)\.?\s*[\)\]]/i.test(s)) return t;
  s = s.replace(/^(\d+)\s+(?!x\s)(?=\D)/i, '$1x ')                               // "3 Skorpekh Destroyers" → "3x …"
    .replace(/^([^\(\[]+?)\s+x\s*(\d+)\s*(?=[\(\[])/i, '$2x $1 ');               // "Lychguard x5 (80 pts)" → "5x Lychguard"
  return gear.length ? `${s}: ${gear.join(', ')}` : s;
}

// "9x Choppa, 9 with Slugga, Power klaw" → [{ name, count }] (Standardzahl = Modellzahl der Zeile)
function parseGear(str, defCount, into, flags) {
  for (const part of String(str || '').split(/\s*,\s*/)) {
    const p = part.trim();
    if (!p) continue;
    if (/^warlord$/i.test(p)) { flags.warlord = true; continue; }
    const wm = /^(\d+)\s+with\s+(.+)$/i.exec(p);
    if (wm) { parseGear(wm[2], num(wm[1], 1), into, flags); continue; }
    const gm = GEAR_RE.exec(p);
    if (!gm || !gm[2]) continue;
    into.push({ name: gm[2].trim(), count: gm[1] ? num(gm[1], 1) : Math.max(1, defCount || 1) });
  }
}
function mergeGear(list) {
  const out = []; const idx = new Map();
  for (const g of list) {
    if (!g || !g.name) continue;
    const k = g.name.toLowerCase();
    if (idx.has(k)) out[idx.get(k)].count += g.count; else { idx.set(k, out.length); out.push({ name: g.name, count: g.count }); }
  }
  return out;
}

export function parseArmyText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const units = [];
  let section = '';
  let cur = null;
  let sawSection = false;
  let firstPointsLine = true;
  let attachGroup = 0;
  const docHasSub = lines.some(l => /^\s*[◦○]/.test(l)); // GW-App-Format: Ausrüstung als Unterpunkte
  const docHasSection = lines.some(l => SECTION_RE.test(l.trim()) || ATTACHED_HDR_RE.test(l.trim()));
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^[+&=#]/.test(t)) continue;                       // Kopfblock ("+ FACTION KEYWORD: …", "++++", "& Enhancement …")
    const indent = raw.length - raw.replace(/^[\s ]+/, '').length;
    if (SECTION_RE.test(t)) { section = t.toUpperCase(); sawSection = true; cur = null; attachGroup = 0; continue; }
    if (ATTACHED_HDR_RE.test(t)) { section = 'ATTACHED UNITS'; sawSection = true; cur = null; continue; }
    const ag = ATTACHED_GROUP_RE.exec(t);
    if (ag) { attachGroup = num(ag[1], 0) || attachGroup + 1; cur = null; continue; }
    const aa = ATTACHED_AS_RE.exec(t);
    if (aa) { if (cur && attachGroup) { cur.attachGroup = attachGroup; cur.attachRole = /leader/i.test(aa[1]) ? 'leader' : 'bodyguard'; } continue; }
    const em = ENH_RE.exec(t);
    if (em) { if (cur) cur.enhancements.push(em[1].trim()); continue; }
    if (WARLORD_RE.test(t)) { if (cur) cur.warlord = true; continue; }
    const lm = LEAD_RE.exec(t);
    if (lm) { if (cur) { const k = /^lead/i.test(lm[1]) ? 'leading' : 'attachedTo'; cur[k] = lm[2].trim(); cur[k + 'Nth'] = lm[3] ? num(lm[3], 0) : 0; } continue; }
    const noChar = chatUnitLine(t.replace(CHAR_RE, ''));
    const sm = UNIT_SUFFIX_RE.exec(noChar);
    const um = UNIT_RE.exec(sm ? sm[1] : noChar);
    if (um) {
      const name = um[2].trim();
      const pts = num(um[3], 0);
      if (SIZE_RE.test(name)) { cur = null; continue; }
      // Armee-Kopfzeile ("Meine Armee (2000 Points)") vor dem ersten Abschnitt überspringen – also a small list's title
      // ("Scratch Orks (460 Points)") when the list has sections (GW app / New Recruit: units only stand in sections)
      if (!sawSection && firstPointsLine && (pts >= 500 || docHasSection)) { firstPointsLine = false; cur = null; continue; }
      firstPointsLine = false;
      cur = { name, points: pts, lineCount: um[1] ? num(um[1], 1) : 0, items: [], section, gear: [], enhancements: [], warlord: false, leading: null, attachedTo: null };
      if (sm && sm[2]) parseGear(sm[2], cur.lineCount || 1, cur.gear, cur);
      units.push(cur);
      continue;
    }
    if (!cur) continue;
    const last = cur.items[cur.items.length - 1];
    if (/^[◦○]/.test(t)) {                                  // Wargear unter einer Modellzeile (GW-App)
      if (last) { last.children += 1; last.kinds.add('sub'); }
      parseGear(t.replace(/^[◦○]\s*/, ''), 1, cur.gear, cur);
      continue;
    }
    const wm = WITH_RE.exec(t);
    if (wm) { if (last) { last.children += 1; last.kinds.add('with'); } parseGear(wm[2], num(wm[1], 1), cur.gear, cur); continue; }
    const mm = MODEL_RE.exec(t);
    const bullet = /^[•\-\*]/.test(t);
    if (mm) {
      const count = num(mm[1], 0);
      let rest = mm[2];
      let modelName = rest, gearStr = '';
      const ci = rest.indexOf(':');
      if (ci >= 0) { modelName = rest.slice(0, ci).trim(); gearStr = rest.slice(ci + 1); }
      else if (bullet && rest.includes(',')) { modelName = rest.slice(0, rest.indexOf(',')).trim(); gearStr = rest.slice(rest.indexOf(',') + 1); }
      // Tiefer eingerückte Zeile unter einer Aufzählung = Ausrüstung dieser Modellzeile, keine eigene Modellzeile
      if (last && last.bullet && indent > last.indent && ci < 0) {
        last.children += 1; last.kinds.add(bullet ? 'bullet' : 'plain');
        parseGear(rest, count, cur.gear, cur);
        continue;
      }
      const item = { count, bullet, children: 0, indent, name: modelName, colon: ci >= 0, kinds: new Set() };
      cur.items.push(item);
      if (gearStr) parseGear(gearStr, count, cur.gear, cur);
      continue;
    }
    if (bullet) {                                           // "- Boss Nob: Power klaw" / "-9 Shoota, 9 Slugga"
      const body = t.replace(/^[•\-\*]\s*/, '');
      const ci = body.indexOf(':');
      parseGear(ci >= 0 ? body.slice(ci + 1) : body, 1, cur.gear, cur);
    }
  }
  return units.map(u => {
    // Modellzeilen: "Nx Name" ohne Aufzählungszeichen oder Aufzählungen mit Wargear-Unterpunkten (GW-App);
    // Aufzählungen ohne Unterpunkte sind bei Einzelmodellen die Ausrüstung → nicht zählen.
    // Hat die Einheit keine Zeilen mit Unterpunkten (New Recruit, gekürzte Listen), zählt die größte "Nx"-Aufzählung
    // (z. B. "• 10x Boy" neben "• 2x Big shoota"); reine "1x"-Aufzählungen bleiben Ausrüstung.
    const hasChildren = u.items.some(i => i.children > 0);
    const plain = u.items.filter(i => !i.bullet).reduce((a, i) => a + i.count, 0);
    const withKids = u.items.filter(i => i.bullet && i.children > 0).reduce((a, i) => a + i.count, 0);
    const bulletMax = (hasChildren || docHasSub) ? 0 : u.items.filter(i => i.bullet && i.count > 1).reduce((a, i) => Math.max(a, i.count), 0);
    const fromItems = plain + withKids + bulletMax;
    const models = Math.max(1, u.lineCount || fromItems || 1);
    const isChar = /^CHARA/.test(u.section) || u.attachRole === 'leader';
    const kw = [];
    if (isChar) kw.push('CHARACTER');
    if (/^BATTLELINE/.test(u.section)) kw.push('BATTLELINE');
    // Aufzählungen, die keine Modellzeilen sind (Einzelmodell: "• 1x Power klaw"; nur Fortsetzungszeilen darunter), sind Ausrüstung
    const gear = [...u.gear];
    for (const i of u.items) {
      if (i.colon || !i.bullet) continue;
      const onlyPlainKids = i.children > 0 && [...i.kinds].every(k => k === 'plain');
      const counted = i.children > 0 ? !onlyPlainKids : (!hasChildren && !docHasSub && i.count > 1 && i.count === bulletMax);
      if (!counted && i.name && !/^\d/.test(i.name)) gear.push({ name: i.name, count: Math.max(1, i.count) });
    }
    return {
      name: u.name, models, modelsStart: models, points: u.points, oc: 1, move: 6, wounds: 1, keywords: kw, character: isChar, r: radiusFor(models),
      wargear: mergeGear(gear), enhancements: [...new Set(u.enhancements)], warlord: !!u.warlord, leading: u.leading, attachedTo: u.attachedTo,
      leadingNth: u.leadingNth || 0, attachedToNth: u.attachedToNth || 0,
      attachGroup: u.attachGroup || 0, attachRole: u.attachRole || null,
      modelLines: u.items.filter(i => i.count > 0 && i.name).map(i => ({ count: i.count, name: i.name }))   // army builder import: model types
    };
  });
}

// ───────── Aktionen ─────────
const H = {};

H['game.init'] = (s0, a) => {
  const s = initialState(a.code, a.seed);
  s.createdAt = a.ts || null;
  log(s, a, 'Game ' + s.code + ' created.', null, { seed: s.rngState });
  return s;
};

H['opts.set'] = (s, a) => {
  const k = a.key;
  if (!(k in s.opts) && k !== 'dp') fail('Unknown option: ' + k);
  let v = a.value;
  if (k === 'stratLock' && !LOCKS.includes(v)) fail('Invalid Stratagem lock');
  if (k === 'size' && !SIZES.includes(v)) fail('Invalid game size');
  if (k === 'autoScore') v = !!v;
  if (k === 'phases' && !['off', 'manual'].includes(v)) fail('Invalid phases option');
  if (k === 'dp' && v != null) { v = Math.floor(num(v, NaN)); if (!(v >= 0 && v <= 9)) fail('Invalid Detachment Points'); }
  if (k === 'points') { v = Math.floor(num(v, NaN)); if (!Number.isFinite(v) || v <= 0) fail('Invalid points value'); }
  if (k === 'size' && v !== s.opts.size && s.opts.points === SIZE_POINTS[s.opts.size]) s.opts.points = SIZE_POINTS[v];
  s.opts[k] = v;
  log(s, a, 'Option ' + k + ' = ' + String(v));
};

H['player.set'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const changes = [];
  if (a.name != null) { const n = String(a.name).trim(); if (!n) fail('Name must not be empty'); pl.name = n.slice(0, 40); changes.push('name “' + pl.name + '”'); }
  if (a.color != null) {
    const c = Math.floor(num(a.color, NaN));
    if (!(c >= 0 && c < WH.COLORS.length)) fail('Invalid color');
    pl.color = c; changes.push('color ' + WH.COLORS[c].name);
  }
  log(s, a, 'Player ' + (a.player + 1) + ': ' + (changes.join(', ') || 'no change'), a.player);
};

H['player.army'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (s.stage === 'battle') fail('Army cannot be changed during the battle');
  const fac = a.faction == null ? null : factionById(a.faction);
  if (a.faction != null && !fac) fail('Unknown faction');
  const dets = Array.isArray(a.detachments) ? a.detachments.filter(Boolean) : [];
  const defs = dets.map(id => { const d = fac ? detachmentById(fac.id, id) : null; if (!d) fail('Unknown Detachment: ' + id); return d; });
  const dp = defs.reduce((x, d) => x + num(d.dp, 0), 0);
  // Incursion: a 3-DP detachment may be taken as the only detachment (core 25.04: the limit becomes 3)
  const limit = s.opts.dp == null && s.opts.size === 'incursion' && defs.length === 1 && num(defs[0].dp, 0) >= 3 ? Math.max(3, dpLimitOf(s)) : dpLimitOf(s);
  if (dp > limit) fail('Too many Detachment Points: ' + dp + ' > ' + limit);
  pl.faction = fac ? fac.id : null;
  pl.detachments = defs.map(d => d.id);
  // Force Dispositions available to this army (from the saved list's detachments); without them all are offered
  const dispIds = WH.DISPOSITIONS.map(d => d.id);
  const disp = Array.isArray(a.dispositions) ? [...new Set(a.dispositions.filter(id => dispIds.includes(id)))] : [];
  if (disp.length) pl.dispositions = disp; else delete pl.dispositions;
  const res = [];
  if (fac && fac.resource && fac.resource.name) res.push({ name: fac.resource.name, value: num(fac.resource.start, 0), max: fac.resource.max == null ? null : num(fac.resource.max, null), text: fac.resource.text || '' });
  for (const d of defs) if (d.resource && d.resource.name) res.push({ name: d.resource.name, value: num(d.resource.start, 0), max: d.resource.max == null ? null : num(d.resource.max, null), text: d.resource.text || '' });
  pl.resources = res;
  log(s, a, pl.name + ': ' + (fac ? fac.name : 'no faction') + (defs.length ? ' – ' + defs.map(d => d.name).join(', ') + ' (' + dp + '/' + limit + ' DP)' : ''), a.player);
};

H['unit.add'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (s.stage === 'battle' || s.stage === 'over') fail('Units can only be added before the battle');
  const u = normalizeUnit(s, a.unit, a.player);
  pl.units.push(u);
  log(s, a, pl.name + ': unit “' + u.name + '” (' + u.models + ' models, OC ' + u.oc + ') added', a.player, { unitId: u.id });
};

H['unit.update'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const u = unitOf(s, a.player, a.unitId);
  const patch = a.patch || {};
  const keys = Object.keys(patch);
  if (s.stage === 'battle' || s.stage === 'over') {
    // leader attachment = list info, may be set later; reserve 'none' = arrived from reserves (phone reserves card)
    const bad = keys.filter(k => !['models', 'status', 'leading', 'attachedTo'].includes(k) && !(k === 'reserve' && patch.reserve === 'none'));
    if (bad.length) fail('Only models/status/leader attachment can be changed during the battle');
  }
  if (keys.includes('id')) fail('The unit ID cannot be changed');
  // the log names only the fields that really change (the setup form sends all of them; 'r' is the derived base radius)
  const changed = keys.filter(k => k !== 'r' && JSON.stringify(u[k]) !== JSON.stringify(patch[k]));
  const merged = normalizeUnit(s, Object.assign({}, u, patch, { id: u.id }), a.player, true);
  merged.id = u.id; merged.startPos = u.startPos;
  if (patch.status === 'destroyed') merged.pos = null;
  Object.assign(u, merged);
  recalcControl(s);
  log(s, a, pl.name + ': unit “' + u.name + '” updated (' + ((changed.length ? changed : keys).join(', ') || 'no change') + ')', a.player, { unitId: u.id, patch });
};

H['unit.remove'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (s.stage === 'battle' || s.stage === 'over') fail('Units cannot be removed during the battle');
  const u = unitOf(s, a.player, a.unitId);
  pl.units = pl.units.filter(x => x.id !== u.id);
  recalcControl(s);
  log(s, a, pl.name + ': unit “' + u.name + '” removed', a.player, { unitId: u.id });
};

H['army.import'] = (s, a) => {
  const pl = pIdx(s, a.player);
  // Also allowed after the setup (player phone "Add army list") – the list only feeds datasheets and "Affects"
  if (s.stage === 'over') fail('The battle is over');
  const parsed = parseArmyText(a.text);
  const nm = x => String(x || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  // from the army builder / the datasheets (resolved by the importing device): the units' keywords and their datasheet
  // values OC / M / W (in list order, matched by name)
  if (Array.isArray(a.keywords)) {
    let at = 0;
    for (const u of parsed) {
      const i = a.keywords.findIndex((k, j) => j >= at && k && nm(k.name) === nm(u.name));
      if (i < 0) continue;
      at = i + 1;
      const kw = (Array.isArray(a.keywords[i].keywords) ? a.keywords[i].keywords : []).filter(k => typeof k === 'string' && k.length < 60).slice(0, 40);
      u.keywords = [...new Set([...(u.keywords || []), ...kw.map(k => k.toUpperCase())])];
      if (u.keywords.includes('CHARACTER')) u.character = true;
      for (const k of ['oc', 'move', 'wounds']) { const v = a.keywords[i][k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100) u[k] = v; }
      u.support = a.keywords[i].support === true;
      // "+1 CP at the start of …" rules found in the unit's datasheet (normalizeUnit validates them)
      if (Array.isArray(a.keywords[i].cpRules)) u.cpRules = a.keywords[i].cpRules;
      // profile changes of the list (enhancements, wargear: S / A / AP / D, InSv …) for the datasheets – plain data, size-capped
      const mods = a.keywords[i].mods;
      if (mods && typeof mods === 'object' && JSON.stringify(mods).length < 20000) u.mods = JSON.parse(JSON.stringify(mods));
    }
  }
  const added = parsed.map(u => { const n = normalizeUnit(s, u, a.player); pl.units.push(n); return n; });
  // ATTACHED UNITS: leaders of a group lead that group's bodyguard – linked by unit id (unique even with equal names)
  const groups = new Set(parsed.map(u => u.attachGroup).filter(Boolean));
  for (const g of groups) {
    const bi = parsed.findIndex(u => u.attachGroup === g && u.attachRole === 'bodyguard');
    if (bi < 0) continue;
    parsed.forEach((u, i) => { if (u.attachGroup === g && u.attachRole === 'leader') { added[i].leading = added[bi].id; added[i].attachedTo = null; } });
  }
  // "Leading X[n]": the n-th unit named X of this list; without [n] the first one no other leader of the list leads yet
  // (each bodyguard unit has one leader unit, plus one SUPPORT unit – core 24.22) – linked by unit id, so same-named
  // bodyguard units stay apart
  const ledBy = new Set();
  const order = parsed.map((u, i) => i).sort((x, y) => (parsed[y].leadingNth ? 1 : 0) - (parsed[x].leadingNth ? 1 : 0));
  order.forEach(i => {
    const u = parsed[i];
    if (!u.leading || u.attachGroup) return;
    const same = added.filter(x => x !== added[i] && nm(x.name) === nm(u.leading));
    const role = (u.support ? 's:' : 'l:');
    const t = u.leadingNth ? same[u.leadingNth - 1] : (same.find(x => !ledBy.has(role + x.id)) || same[0]);
    if (t) { added[i].leading = t.id; ledBy.add(role + t.id); }
  });
  const pts = added.reduce((x, u) => x + u.points, 0);
  log(s, a, pl.name + ': ' + added.length + ' unit(s) imported (' + pts + ' points)' + (added.length ? '' : ' – no units recognized'), a.player, { units: added.map(u => u.id) });
};

H['player.ready'] = (s, a) => {
  const pl = pIdx(s, a.player);
  pl.ready = !!a.ready;
  log(s, a, pl.name + (pl.ready ? ' is ready.' : ' is no longer ready.'), a.player);
};

H['mission.set'] = (s, a) => {
  const m = s.mission;
  const changes = [];
  const before = { deployment: m.deployment, attacker: m.attacker };
  if ('deployment' in a) {
    if (a.deployment != null && !WH.DEPLOYMENT_MAPS[a.deployment]) fail('Unknown deployment map');
    m.deployment = a.deployment || null; changes.push('deployment ' + (m.deployment || '–'));
  }
  if ('dispositions' in a) {
    const d = Array.isArray(a.dispositions) ? a.dispositions : [null, null];
    const ids = WH.DISPOSITIONS.map(x => x.id);
    const nd = [0, 1].map(i => (d[i] == null ? m.dispositions[i] : d[i]));
    nd.forEach(x => { if (x != null && !ids.includes(x)) fail('Unknown disposition: ' + x); });
    m.dispositions = nd; changes.push('Force Dispositions ' + nd.map(x => (x && (WH.DISPOSITIONS.find(y => y.id === x) || {}).name) || x || '–').join(' / '));
  }
  if ('twist' in a) {
    if (a.twist != null && !WH.TWISTS.some(t => t.id === a.twist)) fail('Unknown twist');
    m.twist = a.twist || null; changes.push('twist ' + (m.twist || '–'));
  }
  if ('mirrored' in a) {
    if (a.mirrored != null && !WH.MIRRORED.includes(a.mirrored)) fail('Invalid Mirrored mission');
    m.mirrored = a.mirrored || null; changes.push('mirrored ' + (m.mirrored || '–'));
  }
  if ('attacker' in a) { if (a.attacker != null && !isIdx(a.attacker)) fail('Invalid Attacker'); m.attacker = a.attacker == null ? null : a.attacker; changes.push('Attacker ' + (m.attacker == null ? '–' : pName(s, m.attacker))); }
  if ('first' in a) { if (a.first != null && !isIdx(a.first)) fail('Invalid first player'); m.first = a.first == null ? null : a.first; changes.push('first turn ' + (m.first == null ? '–' : pName(s, m.first))); }
  if ('terrainLayout' in a) { m.terrainLayout = a.terrainLayout == null ? null : String(a.terrainLayout); changes.push('terrain ' + (m.terrainLayout || '–')); }
  computePrimary(s);
  if (m.deployment && (before.deployment !== m.deployment || before.attacker !== m.attacker || !s.objectives.length)) {
    s.objectives = buildObjectives(s);
    recalcControl(s);
  }
  log(s, a, 'Mission: ' + (changes.join(', ') || 'no change') + ' → Primary ' + m.primary.map(x => x ? (WH.PRIMARY[x] || {}).name || x : '–').join(' / '), null, { mission: clone(m) });
};

H['objectives.build'] = (s, a) => {
  if (!s.mission.deployment) fail('Choose a deployment map first');
  s.objectives = buildObjectives(s);
  recalcControl(s);
  log(s, a, 'Objectives for “' + s.mission.deployment + '” created (' + s.objectives.length + ')');
};

H['secondaries.mode'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (s.stage === 'battle' || s.stage === 'over') fail('Secondary mode cannot be changed during the battle');
  if (!['tactical', 'fixed'].includes(a.mode)) fail('Invalid secondary mode');
  const sec = emptySecondaries();
  sec.mode = a.mode;
  if (a.mode === 'fixed') {
    const f = Array.isArray(a.fixed) ? a.fixed.filter(Boolean) : [];
    if (f.length !== 2) fail('Fixed: choose exactly 2 cards');
    if (f[0] === f[1]) fail('Fixed: choose two different cards');
    f.forEach(id => { const c = WH.SECONDARY[id]; if (!c) fail('Unknown Secondary Mission card: ' + id); if (!c.fixed) fail('“' + c.name + '” cannot be chosen as a Fixed Mission'); });
    sec.fixed = f.slice();
  } else {
    const r = shuffle(s.rngState, Object.keys(WH.SECONDARY));
    s.rngState = r.next;
    sec.deck = r.arr;
  }
  pl.secondaries = sec;
  log(s, a, pl.name + ': Secondary Missions ' + (a.mode === 'fixed' ? 'Fixed (' + sec.fixed.map(id => WH.SECONDARY[id].name).join(', ') + ')' : 'Tactical (deck shuffled)'), a.player);
};

H['stage.deploy'] = (s, a) => {
  if (s.stage !== 'setup') fail('Only possible from setup');
  if (!s.players.every(p => p.ready)) fail('Both players must be ready');
  const m = s.mission;
  if (!m.deployment) fail('Deployment map missing');
  if (m.dispositions.some(d => !d)) fail('Dispositions missing');
  if (!isIdx(m.attacker)) fail('Attacker missing');
  if (m.primary.some(p => !p)) fail('Primary Missions missing');
  if (!s.objectives.length) s.objectives = buildObjectives(s);
  s.players.forEach((pl, p) => { pl.cp = 0; ensureDeck(s, p); });
  s.stage = 'deploy';
  s.round = 0; s.phase = 'command'; s.turn = isIdx(m.first) ? m.first : 0;
  recalcControl(s);
  log(s, a, 'Deployment begins. ' + pName(s, m.attacker) + ' is the Attacker. Both players start with 0 CP.');
};

H['unit.place'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const u = unitOf(s, a.player, a.unitId);
  if (!['deploy', 'battle'].includes(s.stage)) fail('Units can only be placed during deployment or battle');
  if (u.status === 'destroyed') fail('Destroyed units cannot be placed');
  const pos = a.pos && Number.isFinite(num(a.pos.x, NaN)) && Number.isFinite(num(a.pos.y, NaN)) ? { x: round2(num(a.pos.x)), y: round2(num(a.pos.y)) } : null;
  if (!pos) fail('Invalid position');
  const [W, Hh] = WH.MAP_SIZE;
  if (pos.x < 0 || pos.y < 0 || pos.x > W || pos.y > Hh) fail('Position outside the battlefield');
  let kind = 'move';
  if (s.stage === 'deploy') {
    if (!pointInPolygon(pos, zoneOf(s, a.player))) fail('Outside your own deployment zone');
    kind = 'deploy';
  } else if (!u.pos) kind = 'reserve';
  const from = u.pos ? { x: u.pos.x, y: u.pos.y } : null;
  const d = from ? round2(dist(from, pos)) : 0;
  u.pos = pos;
  u.reserve = 'none';
  if (s.stage === 'deploy') u.startPos = { x: pos.x, y: pos.y };
  s.moves.push({ id: nid(s, 'm'), round: s.round, turn: s.turn, phase: s.phase, player: a.player, unitId: u.id, from, to: { x: pos.x, y: pos.y }, dist: d, kind });
  recalcControl(s);
  const txt = kind === 'deploy' ? ' deployed at ' : kind === 'reserve' ? ' arrived from reserves at ' : ' moved to ';
  log(s, a, pl.name + ': “' + u.name + '”' + txt + pos.x + '/' + pos.y + (kind === 'move' ? ' (' + d + '")' : ''), a.player, { unitId: u.id, from, to: pos, dist: d, kind });
};

H['unit.reserve'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const u = unitOf(s, a.player, a.unitId);
  const r = a.reserve == null ? 'strategic' : a.reserve;
  if (!RESERVES.includes(r)) fail('Invalid reserve type');
  if (u.status === 'destroyed') fail('Destroyed units cannot be placed in reserves');
  const from = u.pos ? { x: u.pos.x, y: u.pos.y } : null;
  u.pos = null; u.reserve = r;
  s.moves.push({ id: nid(s, 'm'), round: s.round, turn: s.turn, phase: s.phase, player: a.player, unitId: u.id, from, to: null, dist: 0, kind: 'reserve' });
  recalcControl(s);
  const label = { none: 'removed from the battlefield', strategic: 'placed in Strategic Reserves', deepstrike: 'placed in Deep Strike reserves', transport: 'embarked in TRANSPORT' }[r];
  log(s, a, pl.name + ': “' + u.name + '” ' + label, a.player, { unitId: u.id, reserve: r });
};

H['unit.status'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const u = unitOf(s, a.player, a.unitId);
  if (!STATUSES.includes(a.status)) fail('Invalid status');
  const prev = u.status;
  u.status = a.status;
  if (a.models != null) u.models = Math.max(0, Math.floor(num(a.models, u.models)));
  let extra = '';
  if (a.status === 'destroyed') {
    const from = u.pos ? { x: u.pos.x, y: u.pos.y } : null;
    u.pos = null;
    u.models = 0;
    if (prev !== 'destroyed') {
      const tags = Array.isArray(a.tags) ? a.tags.filter(t => WH.KILL_TAGS.some(k => k.id === t)) : [];
      if (u.character && !tags.includes('chr')) tags.push('chr');
      if (u.modelsStart >= 13 && !tags.includes('big')) tags.push('big');
      if (u.wounds >= 10 && !tags.includes('w10')) tags.push('w10');
      const kill = { id: nid(s, 'k'), round: s.round, turn: s.turn, phase: s.phase, player: 1 - a.player, unitId: u.id, unitName: u.name, owner: a.player, tags };
      s.kills.push(kill);
      s.moves.push({ id: nid(s, 'm'), round: s.round, turn: s.turn, phase: s.phase, player: a.player, unitId: u.id, from, to: null, dist: 0, kind: 'remove' });
      extra = ' – destroyed (kill for ' + pName(s, 1 - a.player) + (tags.length ? ', tags: ' + tags.join(', ') : '') + ')';
    }
  } else if (prev === 'destroyed') {
    // Vernichtung zurücknehmen: Kill-Eintrag dieser Einheit aus diesem Zug entfernen
    const idx = s.kills.map((k, i) => (k.unitId === u.id && k.round === s.round && k.turn === s.turn ? i : -1)).filter(i => i >= 0).pop();
    if (idx != null) s.kills.splice(idx, 1);
    if (u.models === 0) u.models = a.models != null ? u.models : u.modelsStart;
    extra = ' – destruction undone';
  }
  recalcControl(s);
  const label = { ok: 'OK', shocked: 'Battle-shocked', destroyed: 'destroyed' }[a.status];
  log(s, a, pl.name + ': “' + u.name + '” → ' + label + (a.models != null && a.status !== 'destroyed' ? ' (' + u.models + ' models)' : '') + extra, a.player, { unitId: u.id, status: a.status, prev });
};

H['unit.models'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const u = unitOf(s, a.player, a.unitId);
  const m = Math.floor(num(a.models, NaN));
  if (!Number.isFinite(m) || m < 0) fail('Invalid model count');
  const prev = u.models;
  u.models = m;
  if (m > u.modelsStart) u.modelsStart = m;
  recalcControl(s);
  log(s, a, pl.name + ': “' + u.name + '” models ' + prev + ' → ' + m, a.player, { unitId: u.id, models: m });
};

H['stage.battle'] = (s, a) => {
  if (s.stage !== 'deploy') fail('Only possible from deployment');
  if (!isIdx(s.mission.first)) fail('First player missing (roll off for the first turn)');
  s.stage = 'battle';
  s.round = 1; s.turn = s.mission.first; s.phase = 'command';
  s.pending = null; s.checkpointsDone = [];
  // a.track (tablet): the tablet steps through the phases – stratagems follow the tracked phase, battle-shock per 08.03.
  // Without the flag (older logs) the game replays exactly as before.
  if (a.track) { s.opts.phases = 'manual'; s.shockByRoll = true; }
  s.players.forEach(pl => { for (const u of pl.units) u.startPos = u.pos ? { x: u.pos.x, y: u.pos.y } : null; });
  log(s, a, 'The battle begins. ' + pName(s, s.turn) + ' has the first turn.');
  enterCommand(s, a);
};

H['phase.next'] = (s, a) => {
  if (s.stage !== 'battle') fail('No battle in progress');
  if (s.pending) fail('Pending scoring: confirm it first (score.confirm)');
  // a.track: the tablet steps phase by phase – a game started before phase tracking switches to it with its first step
  if (a.track && s.opts.phases !== 'manual') { s.opts.phases = 'manual'; log(s, a, 'Phases are tracked from now on'); }
  const base = deriveBase(s);
  const active = s.turn;
  const other = 1 - active;
  const first = isIdx(s.mission.first) ? s.mission.first : 0;
  if (s.phase === 'command') {
    // a.endTurn (tablet "End turn"): the Command-phase scoring is not asked separately but joins the single
    // end-of-turn scoring popup. Without the flag (older logs, manual phase steps) it runs here as before.
    if (a.endTurn && !s.checkpointsDone.includes(checkpointKey(s, 'cmd', active))) s.cmdDeferred = true;
    else if (runCheckpoint(s, a, base, active, 'cmd')) return;
  }
  if (s.phase === 'end') {
    const lastTurn = s.round >= 5 && s.turn !== first;
    if (a.merge) {
      // a.merge (tablet): both players' end-of-turn scoring – and in the last turn the end of the battle – in one sheet
      s.mergeScore = true;
      const list = [{ p: active, when: 'turn', withCmd: !!s.cmdDeferred }, { p: other, when: 'turn' }];
      if (lastTurn) list.push({ p: active, when: 'end' }, { p: other, when: 'end' });
      if (runMerged(s, a, base, list)) return;
    } else {
      for (const p of [active, other]) if (runCheckpoint(s, a, base, p, 'turn', p === active && s.cmdDeferred)) return;
    }
    delete s.cmdDeferred;
    if (lastTurn) {
      if (!a.merge) for (const p of [active, other]) if (runCheckpoint(s, a, base, p, 'end')) return;
      finishBattle(s, a);
      return;
    }
    // end of the turn: the 1CP for discarding Tactical cards in this turn
    const asec = s.players[active].secondaries;
    if (asec.cpDiscardDue === s.round + ':' + s.turn) { s.players[active].cp += 1; asec.cpDiscardDue = null; log(s, a, pName(s, active) + ': +1 CP for discarding at the end of the turn (now ' + s.players[active].cp + ')', active); }
    // Zugwechsel
    const nextTurn = other;
    if (s.turn !== first) s.round += 1;
    s.turn = nextTurn;
    s.phase = 'command';
    enterCommand(s, a);
    return;
  }
  const idx = PHASE_IDS.indexOf(s.phase);
  s.phase = PHASE_IDS[idx + 1];
  const ph = WH.PHASES[idx + 1];
  log(s, a, pName(s, active) + ': ' + ph.full + (s.phase === 'end' ? ' – scoring pending' : ''), active, { phase: s.phase });
};

H['phase.set'] = (s, a) => {
  if (!['battle', 'over'].includes(s.stage)) fail('No battle in progress');
  const round = Math.floor(num(a.round, s.round));
  if (round < 1 || round > 5) fail('Round must be 1–5');
  const turn = a.turn == null ? s.turn : a.turn;
  if (!isIdx(turn)) fail('Invalid turn');
  const phase = a.phase == null ? s.phase : a.phase;
  if (!PHASE_IDS.includes(phase)) fail('Invalid phase');
  const prev = { round: s.round, turn: s.turn, phase: s.phase };
  s.round = round; s.turn = turn; s.phase = phase; s.pending = null; delete s.endBonus; delete s.endRequested;
  if (s.stage === 'over') s.stage = 'battle';
  // Wertungs-Checkpoints, die ab der neuen Position erneut durchlaufen werden, wieder freigeben
  const first = isIdx(s.mission.first) ? s.mission.first : 0;
  s.checkpointsDone = s.checkpointsDone.filter(k => {
    const [r, t] = k.split(':').map(Number);
    if (r > round) return false;
    if (r === round && (t === turn || (turn === first && t !== first))) return false;
    return true;
  });
  const ph = WH.PHASES.find(p => p.id === phase);
  log(s, a, 'Warning – manual jump: round ' + round + ', ' + pName(s, turn) + '\'s turn, ' + ph.full + ' (previously R' + prev.round + ' ' + pName(s, prev.turn) + ' ' + prev.phase + ')', null, { prev, warning: true });
};

/* cp.offer { player, offerId, accept } – answer a "+1 CP" rule offer (s.cpOffers): Add books the CP and logs it, Skip
 * only removes the offer (nothing logged). Either the player's own device or the tablet answers. */
H['cp.offer'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const list = s.cpOffers || [];
  const o = list.find(x => x.id === a.offerId && x.player === a.player);
  if (!o) fail('This CP offer is no longer open');
  s.cpOffers = list.filter(x => x !== o);
  if (!a.accept) return;
  pl.cp = (pl.cp || 0) + o.cp;
  log(s, a, pl.name + ': +' + o.cp + ' CP – ' + o.name + ' (' + o.unitName + (o.req === 'warlord' ? ', WARLORD' : '') + ', ' + (o.when === 'roundStart' ? 'start of the battle round' : 'start of the Command phase') + '), now ' + pl.cp + ' CP', a.player, { cpOffer: { name: o.name, unitId: o.unitId, cp: o.cp } });
};

H['cp.adjust'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const d = Math.round(num(a.delta, NaN));
  if (!Number.isFinite(d)) fail('Invalid CP change');
  const before = pl.cp;
  pl.cp = Math.max(0, before + d);
  log(s, a, pl.name + ': CP ' + before + ' → ' + pl.cp + (a.reason ? ' (' + a.reason + ')' : ''), a.player, { delta: d });
};

H['strat.use'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const strat = stratById(s, a.player, a.stratId);
  if (!strat) fail('Unknown Stratagem');
  const phase = typeof a.phase === 'string' ? a.phase : null;   // the phone's phase (phases not tracked)
  const chk = stratCheck(s, a.player, strat, a.cost == null ? null : num(a.cost, NaN), a.unitId || null, phase);
  if (!chk.ok) fail(chk.reason);
  pl.cp -= chk.cost;
  const use = { id: nid(s, 'x'), player: a.player, stratId: strat.id, stratName: strat.name, round: s.round, turn: s.turn, phase: useKeyPhase(s, strat, phase), cost: chk.cost, unitId: a.unitId || null };
  s.stratUses.push(use);
  let uName = '';
  if (a.unitId) { const owner = s.players.find(q => q.units.some(u => u.id === a.unitId)); const u = owner && owner.units.find(x => x.id === a.unitId); if (u) uName = ' on “' + u.name + '”'; }
  log(s, a, pl.name + ': Stratagem ' + strat.name + uName + ' (' + chk.cost + ' CP, ' + pl.cp + ' left)', a.player, { use });
};

H['strat.undo'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const i = s.stratUses.findIndex(u => u.id === a.useId && u.player === a.player);
  if (i < 0) fail('Stratagem use not found');
  const use = s.stratUses.splice(i, 1)[0];
  pl.cp += use.cost;
  log(s, a, pl.name + ': Stratagem ' + use.stratName + ' undone (+' + use.cost + ' CP)', a.player, { use });
};

H['sec.draw'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const sec = pl.secondaries;
  if (sec.mode !== 'tactical') fail('Only with Tactical Missions');
  if (!(sec.toDraw > 0)) fail('No cards to draw');
  ensureDeck(s, a.player);
  const drawn = [];
  const aside = [];
  while (sec.toDraw > 0) {
    const card = drawCard(s, a, a.player);
    if (!card) break;
    // a.cardRule: "If it is the first battle round, draw one new Secondary Mission card and shuffle this card back"
    // (Defend Stronghold) – resolved right away; the new card is drawn before the old one goes back
    const d = WH.SECONDARY[card] && WH.SECONDARY[card].drawn;
    if (a.cardRule && d && d.forced && d.kind === 'round1' && s.round === 1) { sec.hand.splice(sec.hand.indexOf(card), 1); aside.push(card); continue; }
    drawn.push(card);
    sec.toDraw -= 1;
  }
  sec.toDraw = 0;
  if (aside.length) {
    const r = shuffle(s.rngState, sec.deck.concat(aside));
    s.rngState = r.next; sec.deck = r.arr;
  }
  log(s, a, pl.name + ' draws ' + drawn.length + ' Secondary Mission card(s): ' + drawn.map(id => WH.SECONDARY[id].name).join(', ') + (aside.length ? ' (' + aside.map(id => WH.SECONDARY[id].name).join(', ') + ' drawn in the first battle round: shuffled back, new card drawn)' : ''), a.player, { cards: drawn, returned: aside });
};

/** One card from the deck into the hand (the discard pile is reshuffled into an empty deck) → card id | null. */
function drawCard(s, a, p) {
  const pl = s.players[p], sec = pl.secondaries;
  if (!sec.deck.length) {
    if (!sec.discard.length) return null;
    const r = shuffle(s.rngState, sec.discard);
    s.rngState = r.next; sec.deck = r.arr; sec.discard = [];
    log(s, a, pl.name + ': discard pile reshuffled', p);
  }
  const card = sec.deck.shift();
  sec.hand.push(card);
  return card;
}

H['sec.discard'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const sec = pl.secondaries;
  if (sec.mode !== 'tactical') fail('Only with Tactical Missions');
  const i = sec.hand.indexOf(a.card);
  if (i < 0) fail('Card not in hand');
  const reason = a.reason === 'redraw' ? 'redraw' : a.reason === 'return' ? 'return' : 'end';
  const name = WH.SECONDARY[a.card] ? WH.SECONDARY[a.card].name : a.card;
  if (reason === 'return') {
    const def = WH.SECONDARY[a.card] || {};
    if (!def.drawn) fail('This card cannot be returned to the deck');
    if (def.drawn.kind === 'round1' && s.round !== 1) fail('This card can only be returned in the first battle round');
    if (a.cardRule) {
      // as the card says: "draw one new … and shuffle this card back" (the new card first, so it cannot come straight back);
      // "discard this card and draw one new" (A Grievous Blow, Bring It Down) goes to the discard pile
      const d = def.drawn;
      if (!['round1', 'conflict', 'target'].includes(d.kind)) fail('This card cannot be returned to the deck');
      if (d.kind === 'conflict' && !sec.hand.includes(d.other)) fail('Only while ' + ((WH.SECONDARY[d.other] || {}).name || d.other) + ' is active for you');
      sec.hand.splice(i, 1);
      const nw = drawCard(s, a, a.player);
      const nwTxt = nw ? ', drew “' + WH.SECONDARY[nw].name + '”' : ', no card left to draw';
      if (d.kind === 'target') {
        sec.discard.push(a.card);
        log(s, a, pl.name + ': “' + name + '” discarded (card rule)' + nwTxt, a.player, { card: a.card, reason, drew: nw });
        return;
      }
      const r = shuffle(s.rngState, sec.deck.concat([a.card]));
      s.rngState = r.next; sec.deck = r.arr;
      log(s, a, pl.name + ': “' + name + '” shuffled back into the deck (card rule)' + nwTxt, a.player, { card: a.card, reason, drew: nw });
      return;
    }
    sec.hand.splice(i, 1);
    const r = shuffle(s.rngState, sec.deck.concat([a.card]));
    s.rngState = r.next; sec.deck = r.arr;
    sec.toDraw += 1;
    log(s, a, pl.name + ': “' + name + '” shuffled back into the deck (card rule), draw a new card', a.player, { card: a.card, reason });
    return;
  }
  if (reason === 'redraw') {
    if (sec.redrawUsed) fail('Redraw has already been used once this battle');
    // Mission Deck: "(Once per battle) At the end of your Command phase, you can spend 1CP to discard … and draw one new"
    if (s.stage !== 'battle' || s.turn !== a.player || s.phase !== 'command') fail('Discard and redraw only at the end of your Command phase');
    if (pl.cp < 1) fail('Not enough CP (1 needed)');
    pl.cp -= 1;
    sec.redrawUsed = true;
    sec.hand.splice(i, 1); sec.discard.push(a.card);
    // a.drawNow: the new card is drawn right away (else it waits as "1 to draw" – older logs)
    if (a.drawNow) {
      const nw = drawCard(s, a, a.player);
      log(s, a, pl.name + ': “' + name + '” discarded and redrawn (1 CP, ' + pl.cp + ' left)' + (nw ? ' – drew “' + WH.SECONDARY[nw].name + '”' : ' – no card left to draw'), a.player, { card: a.card, reason, drew: nw });
      return;
    }
    sec.toDraw += 1;
    log(s, a, pl.name + ': “' + name + '” discarded and redrawn (1 CP, ' + pl.cp + ' left)', a.player, { card: a.card, reason });
    return;
  }
  sec.hand.splice(i, 1); sec.discard.push(a.card);
  const tkey = s.round + ':' + s.turn;
  let cpTxt = '';
  if (s.turn !== a.player) cpTxt = ' (no CP – not your turn)';
  else if (sec.cpDiscardTurn !== tkey) {
    sec.cpDiscardTurn = tkey;
    // the 1CP is gained at the end of your turn (Mission Deck) – not spendable in the same turn
    if (s.phase === 'end') { pl.cp += 1; cpTxt = ' (+1 CP, now ' + pl.cp + ')'; }
    else { sec.cpDiscardDue = tkey; cpTxt = ' (+1 CP at the end of the turn)'; }
  }
  log(s, a, pl.name + ': “' + name + '” discarded at end of turn' + cpTxt, a.player, { card: a.card, reason });
};

H['sec.achieve'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const sec = pl.secondaries;
  if (sec.mode !== 'tactical') fail('Fixed Mission cards stay active for the whole battle');
  const i = sec.hand.indexOf(a.card);
  if (i < 0) fail('Card not in hand');
  sec.hand.splice(i, 1); sec.achieved.push(a.card);
  log(s, a, pl.name + ': “' + (WH.SECONDARY[a.card] || {}).name + '” achieved', a.player, { card: a.card });
};

H['objective.override'] = (s, a) => {
  const o = objOf(s, a.objectiveId);
  const v = a.override;
  if (!(v == null || v === 0 || v === 1 || v === 'none')) fail('Invalid override');
  o.override = v == null ? null : v;
  recalcControl(s);
  log(s, a, o.name + ': control ' + (v == null ? 'automatic again' : v === 'none' ? 'manual: nobody' : 'manual: ' + pName(s, v)), null, { objectiveId: o.id, override: o.override });
};

H['objective.mark'] = (s, a) => {
  const o = objOf(s, a.objectiveId);
  pIdx(s, a.player);
  const key = String(a.key || '').trim();
  if (!key) fail('Marker key missing');
  const k = 'p' + a.player + ':' + key;
  if (!o.marks) o.marks = {};
  if (a.on === false) delete o.marks[k]; else o.marks[k] = true;
  log(s, a, o.name + ': marker “' + key + '” by ' + pName(s, a.player) + (a.on === false ? ' removed' : ' set'), a.player, { objectiveId: o.id, key, on: a.on !== false });
};

H['objective.sticky'] = (s, a) => {
  const o = objOf(s, a.objectiveId);
  if (!(a.sticky == null || isIdx(a.sticky))) fail('Invalid sticky value');
  o.sticky = a.sticky == null ? null : a.sticky;
  recalcControl(s);
  log(s, a, o.name + ': sticky control ' + (o.sticky == null ? 'cleared' : 'for ' + pName(s, o.sticky)), null, { objectiveId: o.id, sticky: o.sticky });
};

H['score.add'] = (s, a) => {
  pIdx(s, a.player);
  const when = ['cmd', 'turn', 'end', 'manual'].includes(a.when) ? a.when : 'manual';
  addScore(s, a, { player: a.player, src: a.src, card: a.card, ci: a.ci, vp: a.vp, when, auto: !!a.auto });
};

H['score.remove'] = (s, a) => {
  const i = s.scores.findIndex(x => x.id === a.scoreId);
  if (i < 0) fail('Score entry not found');
  const e = s.scores.splice(i, 1)[0];
  recalcVp(s);
  log(s, a, pName(s, e.player) + ': score ' + e.vp + ' VP (' + e.src + ' ' + (e.card || '') + ') removed', e.player, { score: e });
};

const scoreKey = it => it.src + '|' + it.card + '|' + (it.ci == null ? null : it.ci);

/** Tactical: a Secondary Mission that scored VP this turn is achieved and discarded (core rules "Achieving Secondary Missions"). */
function achieveScored(s, a, p) {
  const sec = s.players[p].secondaries;
  if (sec.mode !== 'tactical') return;
  for (const card of [...sec.hand]) {
    const got = (s.scores || []).filter(x => x.player === p && x.src === 'secondary' && x.card === card && x.round === s.round && x.turn === s.turn).reduce((t, x) => t + x.vp, 0);
    if (got <= 0) continue;
    sec.hand.splice(sec.hand.indexOf(card), 1);
    sec.achieved.push(card);
    log(s, a, s.players[p].name + ': “' + (WH.SECONDARY[card] || {}).name + '” achieved (' + got + ' VP) – discarded', p, { card });
  }
}

/** End-of-battle request (game.end) after a confirmed scoring: the remaining end-of-battle scoring, then the end. */
function continueEnd(s, a, hadEnd, player) {
  if (s.stage !== 'battle' || !s.endRequested) return;
  const base = deriveBase(s);
  if (s.mergeScore) {
    if (runMerged(s, a, base, [{ p: s.turn, when: 'end' }, { p: 1 - s.turn, when: 'end' }])) return;
  } else if (hadEnd) {
    if (runCheckpoint(s, a, base, 1 - player, 'end')) return;
  } else {
    for (const p of [s.turn, 1 - s.turn]) if (runCheckpoint(s, a, base, p, 'end')) return;
  }
  delete s.endRequested;
  finishBattle(s, a);
}

/** score.confirm on a merged pending scoring (pending.parts):
 *   { player, items }          → that player's part(s) (their own phone)
 *   { parts: [{ player, items }] } → several parts at once (the tablet's single Confirm)
 *   { items } without player   → all open parts (items matched by item.player, else by card)
 *  items omitted → the part's suggestions. Items go to the part of that player listing the same condition (else its first part). */
function confirmParts(s, a, pend) {
  const open = pend.parts.filter(x => !x.done);
  const req = [];
  if (Array.isArray(a.parts)) {
    for (const r of a.parts) { if (!r || !isIdx(r.player)) fail('Invalid player'); req.push({ player: r.player, items: Array.isArray(r.items) ? r.items : null }); }
  } else if (a.player != null) req.push({ player: a.player, items: Array.isArray(a.items) ? a.items : null });
  else for (const p of [...new Set(open.map(x => x.player))]) req.push({ player: p, items: Array.isArray(a.items) ? a.items.filter(it => it && (it.player == null || it.player === p)) : null });
  for (const r of req) {
    const mine = open.filter(x => x.player === r.player);
    if (!mine.length) fail('No pending scoring for ' + pName(s, r.player));
    const plan = r.items == null ? mine.flatMap(part => part.items.map(it => ({ part, it }))) : r.items.filter(Boolean).map(it => ({ part: mine.find(pt => pt.items.some(x => scoreKey(x) === scoreKey(it))) || mine[0], it }));
    let total = 0;
    for (const { part, it } of plan) {
      if (!['primary', 'secondary', 'bonus'].includes(it.src)) continue;
      const sug = (part.items.find(x => scoreKey(x) === scoreKey(it)) || {}).suggest;
      const vp = Math.round(num(it.vp, 0));
      const e = addScore(s, a, { player: r.player, src: it.src, card: it.card, ci: it.ci, vp, when: part.when, auto: it.auto != null ? !!it.auto : (sug != null && vp === sug) });
      if (e) total += e.vp;
    }
    mine.forEach(part => { part.done = true; });
    log(s, a, pName(s, r.player) + ': scoring confirmed (' + total + ' VP)', r.player, { when: mine[0].when, total, parts: mine.map(x => x.when) });
    if (a.achieve) achieveScored(s, a, r.player);
  }
  const left = pend.parts.filter(x => !x.done);
  if (left.length) {
    Object.assign(pend, { player: left[0].player, when: left[0].when, key: left[0].key, items: left[0].items });
    return;
  }
  s.pending = null;
  continueEnd(s, a, pend.parts.some(x => x.when === 'end'), pend.parts[pend.parts.length - 1].player);
}

H['score.confirm'] = (s, a) => {
  const pend = s.pending;
  if (!pend || pend.kind !== 'score') fail('No pending scoring');
  if (Array.isArray(pend.parts)) return confirmParts(s, a, pend);
  if (a.player != null && a.player !== pend.player) fail('Pending scoring belongs to ' + pName(s, pend.player));
  const items = Array.isArray(a.items) ? a.items : pend.items;
  const suggested = {};
  for (const it of pend.items) suggested[it.src + '|' + it.card + '|' + it.ci] = it.suggest;
  let total = 0;
  for (const it of items) {
    if (!it || !['primary', 'secondary', 'bonus'].includes(it.src)) continue;
    const p = pend.player;
    const sug = suggested[it.src + '|' + it.card + '|' + it.ci];
    const vp = Math.round(num(it.vp, 0));
    const auto = it.auto != null ? !!it.auto : (sug != null && vp === sug);
    const e = addScore(s, a, { player: p, src: it.src, card: it.card, ci: it.ci, vp, when: pend.when, auto });
    if (e) total += e.vp;
  }
  s.pending = null;
  log(s, a, pName(s, pend.player) + ': scoring confirmed (' + total + ' VP)', pend.player, { when: pend.when, total });
  // Tactical: scored Secondary Missions are achieved and discarded. Only with a.achieve – older logged confirmations
  // replay unchanged.
  if (a.achieve) achieveScored(s, a, pend.player);
  // Battle ended early via game.end: after the last end-of-battle confirmation, finish the battle automatically; if
  // game.end arrived while a turn scoring was open: now the end-of-battle scoring of both players
  continueEnd(s, a, pend.when === 'end', pend.player);
};

/* score.correct { player, round, turn, when?, items: [{ src, card, ci, vp }], achieve? } – sets the VP booked for these
 * conditions in that round / turn to exactly vp (a forgotten or wrong tick after the scoring was confirmed – no undo of
 * the whole End-turn step). The entries of the condition in that turn are replaced by one entry (caps of that round). */
H['score.correct'] = (s, a) => {
  const p = a.player;
  pIdx(s, p);
  if (!['battle', 'over'].includes(s.stage)) fail('No battle in progress');
  const round = Math.floor(num(a.round, s.round));
  const turn = a.turn == null ? s.turn : a.turn;
  if (round < 1 || round > 5) fail('Round must be 1–5');
  if (!isIdx(turn)) fail('Invalid turn');
  if (!Array.isArray(a.items) || !a.items.length) fail('Nothing to correct');
  const when = ['cmd', 'turn', 'end', 'manual'].includes(a.when) ? a.when : 'manual';
  const changes = [];
  const touched = new Set();
  for (const it of a.items) {
    if (!it || !['primary', 'secondary', 'bonus'].includes(it.src)) continue;
    const card = it.card == null ? null : String(it.card);
    const ci = it.ci == null ? null : Math.floor(num(it.ci, 0));
    const target = Math.round(num(it.vp, 0));
    if (target < 0 && !(it.src === 'bonus' && card === 'modifier')) fail('VP must not be negative');
    const mine = s.scores.filter(x => x.player === p && x.src === it.src && x.card === card && (x.ci == null ? null : x.ci) === ci && x.round === round && x.turn === turn);
    const have = mine.reduce((t, x) => t + x.vp, 0);
    if (target === have) continue;
    s.scores = s.scores.filter(x => !mine.includes(x));
    const e = target !== 0 ? addScore(s, a, { player: p, src: it.src, card, ci, vp: target, when: mine.length ? mine[0].when : when, round, turn }) : null;
    const now = e ? e.vp : 0;
    const name = it.src === 'primary' ? ((WH.PRIMARY[card] || {}).name || card) : it.src === 'secondary' ? ((WH.SECONDARY[card] || {}).name || card) : (card === 'modifier' ? 'Modifier' : card === 'battle-ready' ? 'Battle Ready' : 'Bonus');
    changes.push(name + (ci != null ? ' [' + (ci + 1) + ']' : '') + ' ' + have + ' → ' + now + ' VP');
    if (it.src === 'secondary') touched.add(card);
  }
  recalcVp(s);
  // Tactical: a card that now scored in that turn is achieved; one whose only score was taken away goes back to the hand
  const sec = s.players[p].secondaries;
  if (a.achieve && sec.mode === 'tactical') {
    for (const card of touched) {
      const got = s.scores.filter(x => x.player === p && x.src === 'secondary' && x.card === card).reduce((t, x) => t + x.vp, 0);
      if (got > 0 && sec.hand.includes(card)) { sec.hand.splice(sec.hand.indexOf(card), 1); sec.achieved.push(card); }
      else if (got <= 0 && sec.achieved.includes(card)) { sec.achieved.splice(sec.achieved.indexOf(card), 1); sec.hand.push(card); }
    }
  }
  log(s, a, pName(s, p) + ': scoring corrected (round ' + round + ', ' + pName(s, turn) + '\'s turn)' + (changes.length ? ' – ' + changes.join(', ') : ' – no change'), p, { round, turn, changes });
};

H['resource.set'] = (s, a) => {
  const pl = pIdx(s, a.player);
  const i = Math.floor(num(a.index, -1));
  const r = pl.resources[i];
  if (!r) fail('Resource not found');
  let v = Math.floor(num(a.value, NaN));
  if (!Number.isFinite(v)) fail('Invalid value');
  v = Math.max(0, v);
  if (r.max != null) v = Math.min(r.max, v);
  const before = r.value;
  r.value = v;
  log(s, a, pl.name + ': ' + r.name + ' ' + before + ' → ' + v, a.player, { index: i, value: v });
};

/* ───────── Once-per-X abilities (army rules, detachment rules, datasheet abilities, enhancements) ─────────
 * ability.use { player, key, name, limit: 'battle'|'round'|'turn'|'phase', source?, note? } → abilityUses entry
 * The UI derives "used" from abilityUses: battle = any entry; round = entry with same round; turn = same round+turn. */
const LIMITS = ['battle', 'round', 'turn', 'phase'];
H['ability.use'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (!a.key || typeof a.key !== 'string') fail('Ability key missing');
  const limit = LIMITS.includes(a.limit) ? a.limit : 'turn';
  if (!s.abilityUses) s.abilityUses = [];
  // once per phase: the player names the phase it was used in (phone popup); without one the game's current phase counts
  const phase = limit === 'phase' && PHASE_IDS.includes(a.phase) ? a.phase : s.phase;
  const same = s.abilityUses.filter(u => u.player === a.player && u.key === a.key);
  const already = same.some(u => limit === 'battle' || (u.round === s.round && (limit === 'round' || (u.turn === s.turn && (limit !== 'phase' || (u.phase || null) === (phase || null))))));
  const phaseName = (WH.PHASES.find(p => p.id === phase) || {}).full;
  if (already) fail('“' + (a.name || a.key) + '” has already been used ' + (limit === 'phase' && phaseName ? 'in the ' + phaseName + ' this turn' : 'this ' + (limit === 'battle' ? 'battle' : limit === 'round' ? 'battle round' : 'turn')));
  const use = { id: nid(s, 'ab'), player: a.player, key: String(a.key), name: a.name ? String(a.name) : String(a.key), limit, source: a.source ? String(a.source) : null, round: s.round, turn: s.turn, phase };
  s.abilityUses.push(use);
  log(s, a, pl.name + ': used “' + use.name + '”' + (use.source ? ' (' + use.source + ')' : '') + (a.note ? ' – ' + String(a.note) : '') + (limit === 'phase' && phaseName ? ' in the ' + phaseName : '') + ' · once per ' + (limit === 'round' ? 'battle round' : limit), a.player, { use });
};
H['ability.undo'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (!s.abilityUses) s.abilityUses = [];
  const i = s.abilityUses.findIndex(u => u.id === a.useId && u.player === a.player);
  if (i < 0) fail('Ability use not found');
  const u = s.abilityUses.splice(i, 1)[0];
  log(s, a, pl.name + ': use of “' + u.name + '” taken back', a.player, { use: u });
};

/* Army / detachment effect state (data/effects/SCHEMA.md): threshold state, chosen option(s), toggles. */
H['effect.set'] = (s, a) => {
  const pl = pIdx(s, a.player);
  if (!a.key || typeof a.key !== 'string') fail('Effect key missing');
  if (!pl.effects) pl.effects = {};
  const prev = pl.effects[a.key] ? pl.effects[a.key].value : null;
  if (a.value == null) delete pl.effects[a.key];
  else pl.effects[a.key] = { value: Array.isArray(a.value) ? a.value.map(String) : (typeof a.value === 'boolean' ? a.value : String(a.value)), round: s.round, turn: s.turn };
  const show = v => v == null ? 'off' : Array.isArray(v) ? v.join(', ') : String(v);
  log(s, a, pl.name + ': ' + (a.label ? String(a.label) : a.key) + ' → ' + show(a.value == null ? null : (a.display != null ? a.display : a.value)) + (prev != null && a.value != null ? '' : ''), a.player, { key: a.key, value: a.value, prev });
};

H['note.add'] = (s, a) => {
  const t = String(a.text || '').trim();
  if (!t) fail('Note is empty');
  log(s, a, (isIdx(a.player) ? pName(s, a.player) + ': ' : '') + t, isIdx(a.player) ? a.player : null);
};

H['game.end'] = (s, a) => {
  if (!['battle', 'over'].includes(s.stage)) fail('No battle in progress');
  if (s.stage === 'over') fail('The battle is already over');
  if (s.pending) {
    // an end-of-turn / Command phase scoring is open: it is confirmed first, then the end-of-battle scoring follows
    if (s.pending.when === 'end' || s.endRequested) fail('The end-of-battle scoring is already requested');
    s.endRequested = true;
    log(s, a, 'End of battle requested – after the pending scoring is confirmed', null);
    return;
  }
  const base = deriveBase(s);
  s.endRequested = true;
  if (a.merge) {
    // tablet: both players' end-of-battle scoring in one sheet
    s.mergeScore = true;
    if (runMerged(s, a, base, [{ p: s.turn, when: 'end' }, { p: 1 - s.turn, when: 'end' }])) return;
  } else for (const p of [s.turn, 1 - s.turn]) if (runCheckpoint(s, a, base, p, 'end')) return;
  delete s.endRequested;
  finishBattle(s, a);
};

H['game.reset'] = (s, a) => {
  s.stage = 'setup';
  s.round = 0; s.turn = isIdx(s.mission.first) ? s.mission.first : 0; s.phase = 'command';
  s.scores = []; s.kills = []; s.moves = []; s.stratUses = []; s.pending = null; s.ctrlAtTurnStart = {}; s.checkpointsDone = [];
  delete s.cpOffers;
  s.players.forEach(pl => {
    pl.ready = false; pl.cp = 0; pl.vp = { primary: 0, secondary: 0, bonus: 0 };
    const mode = pl.secondaries.mode, fixed = pl.secondaries.fixed;
    pl.secondaries = emptySecondaries(); pl.secondaries.mode = mode; pl.secondaries.fixed = fixed;
    pl.resources.forEach(r => { r.value = 0; });
    for (const u of pl.units) { u.pos = null; u.startPos = null; u.reserve = 'none'; u.status = 'ok'; u.models = u.modelsStart; }
  });
  s.objectives = s.mission.deployment ? buildObjectives(s).map(o => Object.assign(o, { marks: {}, override: null, sticky: null })) : [];
  recalcControl(s);
  log(s, a, 'Game reset (armies and mission are kept).');
};

// Im Setup: Änderungen an Armee, Liste, Mission oder Sekundärmodus machen ein erteiltes „Bereit“ ungültig
for (const t of ['player.army', 'unit.add', 'unit.update', 'unit.remove', 'army.import', 'secondaries.mode']) {
  const f = H[t];
  H[t] = (s, a) => { const r = f(s, a); const st = r || s; if (st.stage === 'setup' && isIdx(a.player) && st.players[a.player].ready) { st.players[a.player].ready = false; log(st, a, st.players[a.player].name + ' is no longer ready (setup changed).', a.player); } return r; };
}
{
  const f = H['mission.set'];
  H['mission.set'] = (s, a) => { const r = f(s, a); const st = r || s; if (st.stage === 'setup') st.players.forEach((pl, i) => { if (pl.ready) { pl.ready = false; log(st, a, pl.name + ' is no longer ready (mission changed).', i); } }); return r; };
}

/** Reducer-Einstieg. Gibt immer einen neuen State zurück. */
export function reduce(state, action) {
  if (!action || typeof action.type !== 'string') throw new Error('Invalid action');
  const h = H[action.type];
  if (!h) throw new Error('Unknown action: ' + action.type);
  if (action.type === 'game.init') return h(null, action);
  if (!state) throw new Error('No game state – run game.init first');
  const s = clone(state);
  if (!s.checkpointsDone) s.checkpointsDone = [];
  if (!s.abilityUses) s.abilityUses = [];
  for (const pl of s.players || []) if (!pl.effects) pl.effects = {};
  if (!s.ctrlAtTurnStart) s.ctrlAtTurnStart = {};
  if (s.ids == null) s.ids = 0;
  if (s.unitSeq == null) s.unitSeq = 0;
  const out = h(s, action) || s;
  recalcVp(out);
  // undo group of the tablet step that is waiting for a scoring: a phone's score.confirm can send the same group
  // (state.pendingGroup), so one Undo on the tablet takes back the whole End-turn step including that confirmation
  if (out.pending && typeof action.group === 'string' && action.group) out.pendingGroup = action.group;
  else if (!out.pending && out.pendingGroup) delete out.pendingGroup;
  return out;
}
