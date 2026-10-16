/* Regelwerk-Handy – gemeinsame Helfer und UI-Zustand je Spielcode+Spieler (SPEC v4 „Handy Regelwerk“).
 * Wird von player.js, player-tabs.js und player-sheets.js genutzt. Alle Funktionen liefern escaped HTML oder reine Daten. */
import { WH } from '../../data/rules.js';
import { esc, badge } from './components.js';
import { kwify } from './keywords.js';
import { loadDatasheets, matchUnit, normName, ALLY_PACKS } from '../data/datasheets.js';
import { memberWargearAbilities, abilityVisible, optionKeywords } from './datasheet.js';

// ---------------------------------------------------------------- Kernregeln (data/core.js) – optional, wird nachgeladen
export const EMPTY_CORE = { phases: {}, turnStart: [], general: [], glossary: [] };
let CORE = EMPTY_CORE;
let coreLoaded = false;
let coreWaiters = [];
export const core = () => CORE;
export const coreReady = () => coreLoaded;
/** Lädt data/core.js einmalig; cb wird nach dem (Fehl-)Laden aufgerufen. */
export function loadCore(cb) {
  if (coreLoaded) return;
  if (typeof cb === 'function') coreWaiters.push(cb);
  if (coreWaiters.length > 1) return;
  import('../../data/core.js').then(m => {
    const c = (m && (m.CORE || m.default)) || null;
    if (c && typeof c === 'object') CORE = Object.assign({}, EMPTY_CORE, c);
  }).catch(e => { console.warn('data/core.js not available', e && e.message); }).then(() => {
    coreLoaded = true;
    const w = coreWaiters; coreWaiters = [];
    w.forEach(f => { try { f(); } catch (err) { console.error(err); } });
  });
}

// ---------------------------------------------------------------- UI-Zustand (überlebt Re-Renders bei jedem State-Push)
const STORE = new Map();
const LS_PREFIX = 'sb40k.pl.';
function lsLoad(key) { try { return JSON.parse(localStorage.getItem(LS_PREFIX + key) || 'null') || {}; } catch { return {}; } }
export function uiState(code, me) {
  const key = `${code}|${me}`;
  let u = STORE.get(key);
  if (!u) {
    const saved = lsLoad(key);
    u = {
      key, tab: ['army', 'missions', 'strats', 'units'].includes(saved.tab) ? saved.tab : 'army',
      sfilter: ['all', 'now', 'core', 'det'].includes(saved.sfilter) ? saved.sfilter : 'all',
      collapsed: !!saved.collapsed, open: new Set(), closed: new Set(), noteDraft: '', search: '', lastPhaseKey: null, ctx: null
    };
    STORE.set(key, u);
  }
  return u;
}
export function uiSave(ui) {
  try { localStorage.setItem(LS_PREFIX + ui.key, JSON.stringify({ tab: ui.tab, sfilter: ui.sfilter, collapsed: ui.collapsed })); } catch {}
}

// ---------------------------------------------------------------- Labels & kleine Datenhelfer
export const pName = (state, i) => (state && state.players && state.players[i] && state.players[i].name) || `Player ${Number(i) + 1}`;
export const phaseOf = id => WH.PHASES.find(p => p.id === id) || WH.PHASES[0];
export const SIDE_LABELS = { own: 'My turn', opp: "Opponent's turn", any: 'Any time' };
export const KW_STOP = new Set(['CP', 'SP', 'VP', 'DP', 'OC', 'AP', 'W3', 'W6', 'D3', 'D6', 'WS', 'BS', 'OOP', 'WANN', 'ZIEL', 'WHEN', 'TARGET', 'EFFECT', 'FAQ', 'GW', 'AOC', 'FNP', 'INV']);

export function cardName(src, card) {
  if (src === 'primary') return (WH.PRIMARY[card] || {}).name || card || '–';
  if (src === 'secondary') return (WH.SECONDARY[card] || {}).name || card || '–';
  return card === 'modifier' ? 'Modifier' : 'Bonus';
}

/** Eigene Einheiten (nicht vernichtet). */
export function myUnits(state, me) {
  return ((state.players[me] || {}).units || []).filter(u => u.status !== 'destroyed');
}

/** Fraktions-/Detachment-Daten (inkl. reminders) direkt aus FACTIONS – derived.armyRules trägt keine reminders. */
export function armyOf(ctx, p) {
  const pl = ctx.state.players[p] || {};
  const fac = pl.faction ? (ctx.data.FACTIONS || []).find(f => f.id === pl.faction) || null : null;
  const dets = (pl.detachments || []).map(id => (fac && (fac.detachments || []).find(d => d.id === id)) || { id, name: id, dp: 0, rule: '', strats: [], reminders: [] });
  return { faction: fac, detachments: dets };
}

/** Erinnerungen (Fraktion + Detachments) gefiltert nach Phase und Zug. whose: 'own' | 'opp' – 'either' passt immer. */
export function remindersFor(ctx, p, phase, whose) {
  const { faction, detachments } = armyOf(ctx, p);
  const out = [];
  const take = (list, src) => (Array.isArray(list) ? list : []).forEach(r => {
    if (!r || !r.text) return;
    if (r.phase !== phase) return;
    const w = r.whose || 'either';
    if (whose && w !== 'either' && w !== whose) return;
    out.push({ text: r.text, src, whose: w });
  });
  if (faction) take(faction.reminders, faction.name);
  detachments.forEach(d => take(d.reminders, d.name));
  return out;
}

// ---------------------------------------------------------------- Keyword-Chips
// Keywords: bracketed abilities, or runs of UPPERCASE words (Unicode, e.g. KÂHL) joined by OF/THE/AND – "LEAGUES OF VOTANN" stays one keyword
const FACTION_KWS = ['LEAGUES OF VOTANN', 'ADEPTUS ASTARTES', 'ADEPTUS CUSTODES', 'ADEPTUS MECHANICUS', 'ADEPTA SORORITAS', 'ASTRA MILITARUM', 'AGENTS OF THE IMPERIUM', 'IMPERIAL KNIGHTS', 'GREY KNIGHTS', 'CHAOS KNIGHTS', 'HERETIC ASTARTES', 'DEATH GUARD', 'THOUSAND SONS', 'WORLD EATERS', "EMPEROR'S CHILDREN", 'LEGIONES DAEMONICA', 'GENESTEALER CULTS', 'BLACK TEMPLARS', 'BLOOD ANGELS', 'DARK ANGELS', 'SPACE WOLVES', "T'AU EMPIRE", 'ORKS', 'NECRONS', 'TYRANIDS', 'AELDARI', 'DRUKHARI', 'DEATHWATCH', 'ASURYANI', 'HARLEQUINS', 'YNNARI'];
const KW_WORD = String.raw`\p{Lu}[\p{Lu}'’\-]{2,}`;
const KW_RE = new RegExp(String.raw`\[[^\]]+\]|(?<![\p{L}])${KW_WORD}(?:\s+(?:OF|THE|AND)\s+${KW_WORD}|\s+${KW_WORD})*(?![\p{L}])`, 'gu');
/** Keywords eines Stratagems: strat.kw oder aus target + when extrahiert (Großbuchstaben ≥ 3, eckige Fähigkeiten). */
export function stratKeywords(s) {
  if (Array.isArray(s.kw) && s.kw.length) return s.kw.map(k => String(k).toUpperCase());
  const text = `${s.target || ''} ${s.when || ''}`;
  const out = [];
  for (const m of text.match(KW_RE) || []) {
    let k = m.replace(/\s+/g, ' ').trim();
    if (!k || KW_STOP.has(k.replace(/[\[\]]/g, ''))) continue;
    // "LEAGUES OF VOTANN INFANTRY" → faction keyword + rest
    const fac = FACTION_KWS.find(f => k.startsWith(f + ' '));
    const parts = fac ? [fac, k.slice(fac.length + 1).trim()] : [k];
    for (const part of parts) if (part && (/^\[.*\]$/.test(part) || part.length >= 3) && !KW_STOP.has(part) && !out.includes(part)) out.push(part);
  }
  return out;
}
// ---------------------------------------------------------------- Datenblätter (data/datasheets/<fraktion>.json) – Cache je Fraktion, Zuordnung je Einheit
export const DS = { cache: new Map(), loading: new Set(), byUnit: new Map() };
/** Lädt das Datenblatt-Paket einer Fraktion einmalig in DS.cache; rerender wird nach dem (Fehl-)Laden aufgerufen. */
export function ensureDatasheets(factionId, rerender) {
  if (!factionId || DS.cache.has(factionId) || DS.loading.has(factionId)) return;
  DS.loading.add(factionId);
  loadDatasheets(factionId).then(d => DS.cache.set(factionId, d || { units: [] })).catch(() => DS.cache.set(factionId, { units: [] }))
    .then(() => { DS.loading.delete(factionId); if (typeof rerender === 'function') rerender(); });
}
/** Datenblatt einer Listen-Einheit des Spielers (gecacht je Fraktion+Name); null solange nicht geladen/gefunden. Löst das Laden aus. */
export function unitDatasheet(ctx, unit, p = ctx.me) {
  const fac = (ctx.state.players[p] || {}).faction;
  if (!fac || !unit) return null;
  const data = DS.cache.get(fac);
  if (!data) { ensureDatasheets(fac, ctx.rerender); return null; }
  const key = `${fac}|${String(unit.name || '')}`;
  if (!DS.byUnit.has(key)) {
    const hit = matchUnitAny(data, unit.name, ctx.rerender);
    if (!hit && !ALLY_PACKS.every(id => DS.cache.has(id))) return null;   // allied packs still loading – ask again later
    DS.byUnit.set(key, hit);
  }
  return DS.byUnit.get(key);
}
/** Datasheet of a list unit by its exact name: the army's own pack, else an allied pack (ALLY_PACKS: Imperial Agents / Knights,
 *  Chaos Daemons / Knights – loaded on demand, null until then). */
export function matchUnitAny(data, name, rerender) {
  const own = data && data.units && data.units.length ? matchUnit(data.units, name) : null;
  if (own) return own;
  for (const id of ALLY_PACKS) {
    const d = DS.cache.get(id);
    if (!d) { ensureDatasheets(id, rerender); continue; }
    const hit = d.units && d.units.length ? matchUnit(d.units, name) : null;
    if (hit) return hit;
  }
  return null;
}

/** Einheiten des Spielers, deren Keywords/Name zu den Chips passen (eckige Fähigkeiten zählen nicht).
 * Mit ctx werden zusätzlich die Keywords des aufgelösten Datenblatts (keywords + factionKeywords) berücksichtigt –
 * aus Text importierte Listen tragen selbst nur CHARACTER/BATTLELINE. Ganzer Chip zuerst, dann wortweise. */
export function affectedUnits(units, kws, ctx = null) {
  const plain = kws.filter(k => !/^[[!]/.test(k));
  // exclusions: "!TITANIC", conditional "!VEHICLE (unless CHARACTER/WALKER)"
  const excl = kws.filter(k => k.startsWith('!')).map(k => { const m = /^!(.+?)(?: \(unless (.+)\))?$/.exec(k); return { kw: m[1], unless: m[2] ? m[2].split('/') : [] }; });
  if (!plain.length && !excl.some(x => x.unless.length)) return []; // e.g. Fire Overwatch: any unit – no list
  return units.filter(u => {
    const ds = ctx ? unitDatasheet(ctx, u) : null;
    const ks = [].concat(u.keywords || [], (ds && ds.keywords) || [], optionKeywords(ds, u), (ds && ds.factionKeywords) || []).map(k => String(k).toUpperCase().replace(/\s+/g, ' ').trim());
    const name = String(u.name || '').toUpperCase();
    const has = k => ks.includes(k) || k.split(' ').every(w => ks.includes(w)) || (name && name.includes(k));
    return (!plain.length || plain.some(has)) && !excl.some(x => has(x.kw) && !x.unless.some(has));
  });
}

// ---------------------------------------------------------------- Schwellen in Armeeregel-Texten (z. B. „ab 7“, „7+“)
const THR_RE = /\b(?:ab|bei|mit|von|at|from|with|of)\s+(\d{1,2})\b|\b(\d{1,2})\s*\+/;
/** Absätze einer Regel mit erkannter Schwelle: [{ text, thr }]. */
export function ruleParagraphs(rule) {
  return String(rule || '').split(/\n{2,}|\n/).map(t => t.trim()).filter(Boolean).map(text => {
    const m = text.match(THR_RE);
    const thr = m ? Number(m[1] || m[2]) : null;
    return { text, thr: Number.isFinite(thr) ? thr : null };
  });
}
/** Index des aktiven Absatzes für den Zählerwert (höchste Schwelle ≤ value), sonst -1. */
export function activeParagraph(paras, value) {
  let best = -1, bestThr = -Infinity;
  paras.forEach((p, i) => { if (p.thr != null && p.thr <= value && p.thr > bestThr) { best = i; bestThr = p.thr; } });
  return best;
}

// ---------------------------------------------------------------- Kleine HTML-Bausteine
function dataAttrs(data) {
  return Object.entries(data || {}).map(([k, v]) => (v == null ? '' : ` data-${k}="${esc(v)}"`)).join('');
}

/** stepper({ value, min, max, action, data, small, player, cls }) – Buttons tragen data-action + data-delta (±1). */
export function stepper(o) {
  const v = Number(o.value) || 0;
  const min = o.min == null ? 0 : o.min;
  const d = dataAttrs(o.data);
  return `<div class="stepper${o.small ? ' sm' : ''}${o.player === 0 || o.player === 1 ? ' p' + o.player : ''}${o.cls ? ' ' + esc(o.cls) : ''}">
    <button type="button" data-action="${esc(o.action)}" data-delta="-1"${d}${v <= min ? ' disabled' : ''} aria-label="Less">−</button>
    <span class="stepper-value">${v}</span>
    <button type="button" data-action="${esc(o.action)}" data-delta="1"${d}${o.max != null && v >= o.max ? ' disabled' : ''} aria-label="More">+</button>
  </div>`;
}

/** Short label of a resource name for the pinned head: "Yield Points (YP)" → "YP", "Fate Dice" → "FD", "Faith" → "Faith". */
export function resShort(name) {
  const n = String(name || '').trim();
  const m = /\(([A-Za-z]{1,4})\)/.exec(n);
  if (m) return m[1].toUpperCase();
  if (n.length <= 5) return n;
  const words = n.replace(/\(.*?\)/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.length > 1 ? words.map(w => w[0]).join('').toUpperCase().slice(0, 4) : n.slice(0, 5);
}
/** Readable label of a resource for the pinned head: an abbreviation in brackets ("Yield Points (YP)" → "YP"), else the
 *  name without its bracket / dash suffix ("War Cry (Waaagh!) – once per battle" → "War Cry") when short, else resShort. */
export function headLabel(name) {
  const n = String(name || '').trim();
  if (/\(([A-Z]{1,4})\)/.test(n)) return resShort(n);
  const base = n.replace(/\s*[–—-]\s.*$/, '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (base && base.length <= 12) return base;
  const words = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.length > 1 ? words.map(w => w[0]).join('').toUpperCase().slice(0, 4) : resShort(n);
}

/** Is a stratagem's unavailability only the CP shortage? Then "Use" stays open – an ability may reduce the cost. */
export const cpOnlyReason = s => !s.available && /^Not enough CP/i.test(s.reason || '');

export function cpBadge(cost, cp) {
  const c = Number(cost) || 0;
  return `<span class="badge num cp ${cp < c ? 'bad' : ''}" title="${cp < c ? 'Not enough CP' : 'CP cost'}">${c} CP</span>`;
}

export function detailsRule(ui, key, summary, inner, cls = '') {
  return `<details class="rule${cls ? ' ' + esc(cls) : ''}" data-key="${esc(key)}"${ui.open.has(key) ? ' open' : ''}><summary>${esc(summary || '')}</summary><div class="rule-text">${inner}</div></details>`;
}
/** Like detailsRule, but open by default (closed state is remembered in ui.closed). summary may be HTML (summaryHtml). */
export function detailsOpen(ui, key, summary, inner, cls = '', summaryHtml = false) {
  return `<details class="rule${cls ? ' ' + esc(cls) : ''}" data-key="${esc(key)}" data-default-open="1"${ui.closed.has(key) ? '' : ' open'}><summary>${summaryHtml ? summary : esc(summary || '')}</summary><div class="rule-text">${inner}</div></details>`;
}

/** Light markup of the data files (**bold**, ^^) → safe HTML (escaped first). Line breaks become <br>. */
export function rich(text) {
  return esc(String(text == null ? '' : text).replace(/\^\^/g, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------- Leader buffs (abilities of a leader that affect the led unit)
export const BUFF_RE = /leading a unit|while this model is leading|attached unit|that unit|the unit (?:this model|it) is (?:attached to|leading)|bodyguard|this model['’]s unit|(?:each |every )?models? in this unit|this unit/i;
const BADGE_RE = /\[[A-Z][A-Z0-9 :'’+\-\/]*\]/g;
/** Badges of a buff text: bracketed weapon abilities first, then uppercase keywords (stop words removed). */
export function buffBadges(text) {
  const t = String(text || '').replace(/\*\*/g, '');
  const out = [];
  for (const m of t.match(BADGE_RE) || []) { const k = m.replace(/\s+/g, ' '); if (!out.includes(k)) out.push(k); }
  const rest = t.replace(BADGE_RE, ' ');
  for (const m of rest.match(/\b[A-Z][A-Z'’]{2,}(?:\s+[A-Z][A-Z'’]{2,})*\b/g) || []) {
    const k = m.replace(/\s+/g, ' ').trim();
    if (KW_STOP.has(k) || out.includes(k)) continue;
    out.push(k);
  }
  return out.slice(0, 10);
}
/** What the buff applies to, from the wording. */
export function buffScope(text) {
  const t = String(text || '');
  const r = /ranged (?:attacks|weapons)/i.test(t), m = /melee (?:attacks|weapons)/i.test(t);
  if (r && m) return 'Attacks';
  if (r) return 'Ranged weapons';
  if (m) return 'Melee weapons';
  return 'Unit';
}
/** Abilities of a leader datasheet (unit + wargear abilities, plus resolved enhancements) that affect the unit it leads. */
/** Only rules that apply while the model leads a unit ("While this model / the bearer is leading a unit …"). */
const LEADING_RE = /is leading a unit|while (?:this model|the bearer) is leading|leading a unit|attached unit|that unit|bodyguard/i;
export function leaderBuffs(ds, enhancements = [], unit = null, dets = null) {
  const ab = (ds && ds.abilities) || {};
  // wargear abilities only for wargear the leader actually has (unit = list entry with wargear[])
  const list = [].concat(ab.unit || [], unit ? memberWargearAbilities(ds, unit) : (ab.wargear || [])).map(a => ({ name: a.name, text: a.text || '', src: 'ability', detachment: a.detachment, enhancement: a.enhancement }))
    .concat((enhancements || []).filter(e => e && e.text).map(e => ({ name: e.name, text: e.text, src: 'enhancement' })));
  const enhNames = (enhancements || []).map(e => normName(e.name || e)).concat(((unit && unit.enhancements) || []).map(normName));
  return list.filter(a => LEADING_RE.test(a.text) && abilityVisible(a, dets, enhNames)).map(a => Object.assign(a, { badges: buffBadges(a.text), scope: buffScope(a.text) }));
}

/** Absätze (durch Leerzeile/Zeilenumbruch getrennt) als <p>. */
export function paras(text) {
  return String(text || '').split(/\n{2,}|\n/).map(t => t.trim()).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
}

export function phaseLabels(s) {
  const ph = Array.isArray(s.ph) && s.ph.length ? s.ph : ['any'];
  if (ph.includes('any')) return 'Any phase';
  return ph.map(id => phaseOf(id).full).join(', ');
}

/* ───────── Phase colour (one colour per phase: CSS --ph-<id>) ───────── */
export const PHASE_IDS = ['command', 'movement', 'shooting', 'charge', 'fight', 'end', 'any'];
/** Phase id a stratagem is shown under: the section phase when given, else the current phase if it fits, else its first phase ('any'). */
export function stratPhaseId(s, secPhase, curPhase) {
  if (secPhase && PHASE_IDS.includes(secPhase)) return secPhase;
  const ph = Array.isArray(s.ph) && s.ph.length ? s.ph : ['any'];
  if (curPhase && ph.includes(curPhase)) return curPhase;
  return PHASE_IDS.includes(ph[0]) ? ph[0] : 'any';
}
export const phaseName = id => id === 'any' ? 'Any phase' : phaseOf(id).name;
/** Small coloured phase pill: "SHOOTING". */
export function phasePill(id) {
  const pid = PHASE_IDS.includes(id) ? id : 'any';
  return `<span class="ph-pill ph-${esc(pid)}">${esc(pid === 'any' ? 'Any phase' : phaseOf(pid).name)}</span>`;
}
/** Turn badge: "My turn" / "Opponent's turn" / "Either turn". */
export function turnBadge(whose) {
  const w = whose === 'own' ? 'own' : whose === 'opp' ? 'opp' : 'either';
  return `<span class="turn-badge ${w}">${esc(w === 'own' ? 'My turn' : w === 'opp' ? "Opponent's turn" : 'Either turn')}</span>`;
}

/* ───────── Keyword line: [INFANTRY] [CHARACTER] – weapon-ability tags ([LETHAL HITS]) stay as they are ───────── */
/** Keywords from the "(excluding … units)" clauses of TARGET and WHEN ("when a friendly ORKS VEHICLE unit (excluding WALKER
 *  units) …") – units with these keywords can NOT be targeted. */
export function stratExcluded(s) {
  const out = [];
  const EX = /excluding ([^)]*?)(?:\)|$|\.(?:\s|$)|;)/gi;
  const target = String(s.target || '') + '\n' + String(s.when || '');
  const rest = target.replace(EX, ' '); // keyword also required elsewhere in TARGET (e.g. Shield of Honour) → not an exclusion
  for (const m of target.matchAll(EX)) {
    for (const k of m[1].match(KW_RE) || []) {
      const kw = k.replace(/\s+/g, ' ').trim();
      if (kw && !KW_STOP.has(kw) && !out.includes(kw) && !rest.includes(kw)) out.push(kw);
    }
  }
  return out;
}
/** Conditional exclusions of TARGET: "A VEHICLE unit can only be selected if it is a CHARACTER or WALKER unit" / "You can only
 *  select a VEHICLE unit if it is a CHARACTER/WALKER unit" (Heroic Intervention) → [{ kw: 'VEHICLE', unless: ['CHARACTER', 'WALKER'] }]. */
export function stratConditional(s) {
  const K = String.raw`[A-Z][A-Z'’\- ]*?`;
  const RES = [new RegExp(String.raw`\bAn? (${K}) unit can only be selected if it is an? (${K}(?:\s*(?:\/|\bor\b)\s*${K})*) unit`, 'g'),
    new RegExp(String.raw`\bcan only select an? (${K}) unit if it is an? (${K}(?:\s*(?:\/|\bor\b)\s*${K})*) unit`, 'g')];
  const t = String(s.target || '');
  return RES.flatMap(re => [...t.matchAll(re)].map(m => ({ kw: m[1].trim(), unless: m[2].split(/\s*(?:\/|\bor\b)\s*/).map(x => x.trim()).filter(Boolean) })));
}
/** Keyword chips of a stratagem: target keywords, then excluded ones as "!KEYWORD" (rendered "NOT …", used as exclusion) and
 *  conditional ones as "!VEHICLE (unless CHARACTER/WALKER)". */
export function stratKwList(s) {
  const base = Array.isArray(s.kw) && s.kw.length ? s.kw.map(k => String(k).toUpperCase().trim()).filter(Boolean) : stratKeywords(s);
  const excl = stratExcluded(s);
  const cond = stratConditional(s);
  const condKws = cond.flatMap(c => [c.kw, ...c.unless]);
  return [...base.filter(k => !excl.includes(k) && !condKws.includes(k)), ...excl.map(k => '!' + k), ...cond.map(c => `!${c.kw} (unless ${c.unless.join('/')})`)];
}
/** Tappable keyword line: [LETHAL HITS] opens the core-rule popup (data-kw, keywords.js), unit keywords ([INFANTRY],
 *  NOT TITANIC) open the list of your units with that keyword (data-action="kw.units"). */
export function kwLine(kws) {
  if (!kws || !kws.length) return '';
  return `<div class="kws">${kws.map(k => {
    if (/^\[.*\]$/.test(k)) return `<button type="button" class="kw ab kw-btn" data-kw="${esc(k.slice(1, -1))}">${esc(k)}</button>`;
    const not = k.startsWith('!');
    const kw = not ? k.slice(1) : k;
    return `<button type="button" class="kw kw-btn${not ? ' not' : ''}" data-action="kw.units" data-kwu="${esc(kw)}"${not ? ' data-not="1"' : ''}>${not ? 'NOT ' + esc(kw) : '[' + esc(kw) + ']'}</button>`;
  }).join(' ')}</div>`;
}
/** Units of the list as the game sees them: a leader attached to a unit forms one unit with its bodyguard.
 *  links = resolveLeaders(units) (player-tabs.js) → [{ id (bodyguard), units: [bodyguard, ...leaders], name, models, shocked }]. */
export function unitGroups(units, links) {
  const leaderOf = new Map();
  units.forEach(u => { const l = links && links.get(u.id); if (l && l.leading && units.includes(l.leading)) { if (!leaderOf.has(l.leading.id)) leaderOf.set(l.leading.id, []); leaderOf.get(l.leading.id).push(u); } });
  const merged = new Set([...leaderOf.values()].flat().map(u => u.id));
  return units.filter(u => !merged.has(u.id)).map(u => {
    const ls = leaderOf.get(u.id) || [];
    const all = [u, ...ls];
    return { id: u.id, units: all, name: all.map(x => x.name).join(' + '), models: all.reduce((a, x) => a + (Number(x.models) || 0), 0), shocked: all.some(x => x.status === 'shocked') };
  });
}
/** Does the stratagem target one of your own units (TARGET names a friendly / your unit, not only an enemy one)? */
export const targetsFriendly = s => { const t = String((s && s.target) || ''); return !t || /\bfriendly\b|\byour\b|\bfrom your army\b/i.test(t) || !/\benemy\b/i.test(t); };
/** "Affects:" line of a stratagem card – the player's eligible units (attached units as one entry). '' when no list. */
export function affectsLine(s, kws, ctx, groups) {
  const units = myUnits(ctx.state, ctx.me);
  if (!units.length || !targetsFriendly(s)) return '';
  const plain = kws.filter(k => !/^[[!]/.test(k));
  const cond = kws.some(k => /^!.+\(unless /.test(k));
  if (!plain.length && !cond) return '';   // any unit (e.g. Fire Overwatch, Command Re-roll)
  const hits = new Set(affectedUnits(units, kws, ctx).map(u => u.id));
  const list = (groups || units.map(u => ({ id: u.id, units: [u], name: u.name }))).filter(g => g.units.some(u => hits.has(u.id)));
  if (!list.length) return `<div class="affects xs muted"><b>Affects:</b> none of your units</div>`;
  const MAX = 6;
  const names = list.slice(0, MAX).map(g => esc(g.name)).join(', ');
  return `<div class="affects xs"><b>Affects:</b> ${names}${list.length > MAX ? ` <span class="muted">+${list.length - MAX} more</span>` : ''}</div>`;
}

/** Owner of a stratagem in one of its phases: phw (per phase, from a WHEN that mixes owners – "Your Shooting phase or the
 *  Fight phase" → shooting: own, fight: either) wins over the overall whose. */
export function stratWhose(s, phase) {
  return (s && s.phw && phase && s.phw[phase]) || (s && s.whose) || 'either';
}
/** Phase a use is booked under (once per phase, one stratagem per unit and phase): the tracked phase; untracked phases →
 *  the phase the player uses it in (its section), else its only phase / 'any' (as engine/stratagems.js useKeyPhase). */
export function stratUseKey(s, state, phase) {
  if (state.opts && state.opts.phases === 'manual') return state.phase;
  const ph = Array.isArray(s.ph) && s.ph.length ? s.ph : ['any'];
  if (phase && PHASE_IDS.includes(phase) && phase !== 'any' && (ph.includes(phase) || ph.includes('any'))) return phase;
  return ph.includes('any') ? 'any' : ph[0];
}
/** The stratagem as used in one phase (section): whose of that phase, use phase, and availability re-checked for that phase's
 *  once-per-phase lock (derive() checks it without knowing the phase). */
export function stratIn(s, ctx, phase) {
  const { state, me } = ctx;
  const key = stratUseKey(s, state, phase);
  const whose = stratWhose(s, phase);
  const out = Object.assign({}, s, { whose, usePhase: key });
  // not this player's turn for that phase ("Your Shooting phase or the Fight phase" in the opponent's Shooting phase)
  if (whose !== 'either' && whose !== (state.turn === me ? 'own' : 'opp')) Object.assign(out, { fits: false, available: false, reason: whose === 'own' ? 'Only in your own turn' : 'Only in your opponent\'s turn' });
  // tracked phases (tablet steps through them): a section of another phase is not usable now
  else if (state.opts && state.opts.phases === 'manual' && state.stage === 'battle' && phase && phase !== 'any' && phase !== state.phase) Object.assign(out, { fits: false, available: false, reason: 'Only in the ' + phaseOf(phase).full });
  const lockPhase = !(state.opts && state.opts.stratLock === 'round');
  if (!lockPhase || state.stage !== 'battle' || out.fits === false) return out;
  const usedHere = (state.stratUses || []).some(u => u.player === me && u.stratId === s.id && u.round === state.round && u.turn === state.turn && u.phase === key);
  if (usedHere && s.available) Object.assign(out, { available: false, reason: 'Already used this phase' });
  else if (!usedHere && !s.available && s.reason === 'Already used this phase') {
    const cp = (state.players[me] || {}).cp || 0, c = Number(s.cost) || 0;
    Object.assign(out, cp < c ? { reason: 'Not enough CP (' + cp + '/' + c + ')' } : { available: true, reason: '' });
  }
  return out;
}

/** Use state of a stratagem for the player: { use, used, fits, cpOnly, dim, inBattle }. */
export function stratUseState(s, ctx) {
  const { state, me } = ctx;
  const uses = (state.stratUses || []).filter(u => u.player === me && u.stratId === s.id);
  const lockRound = state.opts && state.opts.stratLock === 'round';
  const key = s.usePhase || stratUseKey(s, state, null);
  const use = [...uses].reverse().find(u => u.round === state.round && (lockRound || (u.turn === state.turn && u.phase === key))) || null;
  const inBattle = state.stage === 'battle';
  const fits = inBattle && !!s.fits;
  const used = fits && !!use;
  const cpOnly = fits && cpOnlyReason(s);
  return { use, used, fits, cpOnly, dim: fits && !used && !s.available && !cpOnly, inBattle };
}

/** Source badge: "Core" or the detachment name. */
export const stratSrc = s => `<span class="src ${s.kind === 'detachment' ? 'det' : 'core'}">${esc(s.kind === 'detachment' ? s.detName : 'Core')}</span>`;

/* ───────── Originaltexte (englisch, unverändert) ───────── */
const ORIG = { mod: undefined, fac: new Map(), loading: new Set() };
export function ensureOrig(factionId, rerender) {
  if (!factionId || ORIG.fac.has(factionId) || ORIG.loading.has(factionId)) return;
  ORIG.loading.add(factionId);
  (async () => {
    try {
      if (ORIG.mod === undefined) ORIG.mod = await import('../data/orig.js').catch(() => null);
      const data = ORIG.mod && ORIG.mod.loadOrig ? await ORIG.mod.loadOrig(factionId).catch(() => null) : null;
      ORIG.fac.set(factionId, data || null);
    } finally { ORIG.loading.delete(factionId); if (typeof rerender === 'function' && ORIG.fac.get(factionId)) rerender(); }
  })();
}
export function origData(factionId) { return ORIG.fac.get(factionId) || null; }
export function origMod() { return ORIG.mod || null; }
/** Enhancement text for a name on the list (searched in all of the player's detachments). → { name, cost, text } | null */
export function enhancementOf(ctx, name) {
  const pl = ctx.state.players[ctx.me] || {};
  const o = origData(pl.faction);
  const mod = origMod();
  if (!o || !mod || !mod.origEnhancements) { ensureOrig(pl.faction, ctx.rerender); return null; }
  const k = mod.normKey(name);
  const { detachments } = armyOf(ctx, ctx.me);
  for (const d of detachments) {
    for (const e of mod.origEnhancements(o, d.name) || []) {
      const en = String(e.name || '').replace(/^[-–•\s]+/, '');
      if (mod.normKey(en) === k) return { name: en, cost: e.cost, text: String(e.text || "") };
    }
  }
  return null;
}
/** Originaltext eines Stratagems: Core aus WH.STRATAGEMS[].orig, Detachment aus data/orig/<faction>.json. */
export function origForStrat(s, ctx) {
  if (s.orig && (s.orig.when || s.orig.effect)) return s.orig;
  const pl = ctx.state.players[ctx.me] || {};
  const o = origData(pl.faction);
  if (!o || !ORIG.mod || !ORIG.mod.origStratagem) { ensureOrig(pl.faction, ctx.rerender); return null; }
  try { return ORIG.mod.origStratagem(o, s.detName, s.name) || null; } catch { return null; }
}
/** Strip BattleScribe/Wahapedia markup (^^, **) from original texts; the wording itself stays unchanged. */
export function cleanOrig(t) { return String(t == null ? '' : t).replace(/\^\^/g, '').replace(/\*\*/g, ''); }
export function origBlock(o, label = 'Original text') {
  if (!o) return '';
  const parts = typeof o === 'string' ? [o] : [
    o.when ? 'WHEN: ' + o.when : '', o.target ? 'TARGET: ' + o.target : '', o.effect ? 'EFFECT: ' + o.effect : '',
    (o.restrictions || o.restr) ? 'RESTRICTIONS: ' + (o.restrictions || o.restr) : '', (!o.when && !o.effect && o.text) ? o.text : ''
  ].filter(Boolean);
  if (!parts.length) return '';
  return `<div class="orig-block"><div class="orig-label">${esc(label)}</div><div class="orig-text">${kwify(esc(cleanOrig(parts.join('\n'))))}</div></div>`;
}

/** Original text of a stratagem (verbatim), falling back to the when/target/effect/restr fields of the data file. */
export function stratOrigBlock(s, ctx) {
  const o = origForStrat(s, ctx);
  if (o) return origBlock(o);
  return origBlock({ when: s.when, target: s.target, effect: s.effect, restrictions: s.restr });
}

/**
 * Stratagem card (Stratagems tab). opts.phase = phase id of the section (colour), opts.sec = section id.
 * Compact: name + (i), CP badge, phase pill, source, one-line summary, keyword line, "Use" / "Used · Undo".
 * Everything else (original text, use controls) lives in the popup (strat.open).
 */
export function stratCard(s0, ctx, ui, opts = {}) {
  const { state, me } = ctx;
  const pl = state.players[me] || {};
  const cp = pl.cp || 0;
  const phase = stratPhaseId(s0, opts.phase, state.phase);
  const s = stratIn(s0, ctx, phase);
  const { use, used, fits, cpOnly, dim, inBattle } = stratUseState(s, ctx);
  const kws = stratKwList(s);
  const open = `data-action="strat.open" data-strat="${esc(s.id)}"${opts.phase ? ` data-phase="${esc(phase)}"` : ''}`;
  // Verbatim original WHEN/EFFECT, no summaries (avoids errors); TARGET is covered by the keyword chips.
  const o = origForStrat(s, ctx) || { when: s.when, effect: s.effect || s.t };
  const addons = stratAddonsOf(ctx, s);
  const addonRes = [...new Set(addons.map(a => resShort(a.resource || '')).filter(Boolean))];
  const addonBadge = addons.length ? `<span class="badge xs addon-badge" title="${esc(addons.map(a => a.name).join(' · '))}">+${esc(addonRes.join('/') || 'add-on')}</span>` : '';
  // short of CP: "Use" only when a CP reduction of the army could pay for it (opts.canReduce), else greyed "needs N CP";
  // not usable for another reason: no Use button – the reason line says why (one message, no contradicting button)
  const reducible = cpOnly && !!opts.canReduce;
  let foot = '';
  if (used) foot = `<span class="badge used">Used (${use.cost} CP)</span><button class="btn ghost sm undo" type="button" data-action="strat.undo" data-use="${esc(use.id)}">Undo</button>`;
  else if (fits && s.available) foot = `<button class="btn sm primary" type="button" ${open}>Use</button>`;
  else if (fits && reducible) foot = `<button class="btn sm" type="button" ${open}>Use</button>`;
  else if (fits && cpOnly) foot = `<button class="btn sm needs-cp" type="button" disabled>needs ${Number(s.cost) || 0} CP</button>`;
  return `<article class="strat ph-${esc(phase)}${used ? ' used' : ''}${dim ? ' dim' : ''}${cpOnly && !reducible && !used ? ' short-cp' : ''}" data-strat-card="${esc(s.id)}">
    <div class="strat-top">
      <h3 class="strat-name"><button type="button" class="strat-name-btn" ${open}>${esc(s.name)}</button></h3>
      <button type="button" class="btn ghost icon ds-info strat-info" ${open} aria-label="Show rule and use ${esc(s.name)}">i</button>
      ${cpBadge(s.cost, inBattle ? cp : Infinity)}
    </div>
    <div class="strat-tags">${phasePill(phase)}${stratSrc(s)}${addonBadge}${s.once ? '<span class="badge xs">once per battle</span>' : ''}${s.notRound1 ? '<span class="badge xs">not in round 1</span>' : ''}</div>
    ${o.when ? `<p class="strat-orig"><b>WHEN</b> ${kwify(esc(cleanOrig(o.when)))}</p>` : ''}
    ${o.effect ? `<p class="strat-orig"><b>EFFECT</b> ${kwify(esc(cleanOrig(o.effect)))}</p>` : ''}
    ${dim && s.reason ? `<div class="strat-reason xs text-warn">Not available: ${esc(s.reason)}</div>` : reducible && !used ? `<div class="strat-reason xs muted">${esc(s.reason)} – usable with a CP reduction</div>` : ''}
    ${kwLine(kws)}
    ${opts.affects || ''}
    ${foot ? `<div class="strat-foot">${foot}</div>` : ''}
  </article>`;
}

/** Bedingungszeile einer Missionskarte (nur Anzeige, keine Buchung). */
export function condRow(c, opts = {}) {
  const vp = c.vp != null ? `${c.vp} VP${c.k === 'per' ? ' each' : ''}${c.k === 'per' && c.max != null ? ` (max ${c.max})` : ''}` : (c.opts || []).map(o => `${o.vp} VP`).join(' / ');
  const rr = Array.isArray(c.r) && (c.r[0] !== 1 || c.r[1] !== 5) ? ` · R${c.r[0]}${c.r[1] !== c.r[0] ? '–' + c.r[1] : ''}` : '';
  return `<li class="cond${c.sub ? ' sub' : ''}${opts.markActive && c.active ? ' active' : ''}">
    <div class="cond-main"><div class="cond-text">${esc(c.text)}</div>
    ${c.opts ? `<div class="cond-opts muted xs">${c.opts.map(o => esc(o.t) + ' (' + o.vp + ' VP)').join(' · ')}</div>` : ''}
    <div class="cond-when muted xs">${esc(opts.whenLabel || c.whenLabel || WH.TIMING_LABELS[c.when] || c.when || '')}${esc(rr)}${c.auto ? ' · automatic' : ''}${opts.markActive && c.active ? ' · <span class="text-warn">due now</span>' : ''}${Number(c.scoredThisTurn) > 0 ? ` · <span class="text-ok">booked ${esc(c.scoredThisTurn)} VP this turn</span>` : ''}</div></div>
    <div class="cond-vp">${esc(vp)}</div>
  </li>`;
}

export const srcBadge = src => badge(src === 'primary' ? 'Primary' : src === 'secondary' ? 'Secondary' : 'Bonus', src === 'primary' ? 'ok' : src === 'secondary' ? 'warn' : '');

/* ───────── Current effects (data/effects/<faction>.js, schema: data/effects/SCHEMA.md) ─────────
 * Pure data helpers: which effects of a player's army exist, which state / option is active right now. */
const FX = { fac: new Map(), loading: new Set() };
/** Loads data/effects/<faction>.js once; rerender after it arrived (also when there is no file → null). */
export function ensureEffects(factionId, rerender) {
  if (!factionId || FX.fac.has(factionId) || FX.loading.has(factionId)) return;
  FX.loading.add(factionId);
  import('../../data/effects/index.js').then(m => m.loadEffects(factionId)).catch(() => null)
    .then(d => { FX.fac.set(factionId, d && typeof d === 'object' ? d : null); FX.loading.delete(factionId); if (typeof rerender === 'function') rerender(); });
}
/** Effects data of a faction: object, null (no file) or undefined (still loading – triggers the load). */
export function effectsOf(ctx, factionId) {
  if (!factionId) return null;
  if (!FX.fac.has(factionId)) { ensureEffects(factionId, ctx && ctx.rerender); return undefined; }
  return FX.fac.get(factionId);
}
const fxNorm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Resource of player p by name (exact, short name, or the only one): { index, r } | null. */
export function resourceFor(state, p, name) {
  const list = ((state.players[p] || {}).resources) || [];
  if (!list.length) return null;
  const n = fxNorm(name);
  let i = name ? list.findIndex(r => fxNorm(r.name) === n) : -1;
  if (i < 0 && name) i = list.findIndex(r => fxNorm(resShort(r.name)) === fxNorm(resShort(name)));
  if (i < 0 && list.length === 1) i = 0;
  return i < 0 ? null : { index: i, r: list[i] };
}

/** Effect entries of player p: { status: 'loading'|'none'|'ok', items: [{ e, key, det, src }] }.
 * Army effects + effects of each chosen detachment; enhancement effects only when the enhancement is on the list. */
export function effectItems(ctx, p) {
  const pl = ctx.state.players[p] || {};
  const fx = effectsOf(ctx, pl.faction);
  if (fx === undefined) return { status: 'loading', items: [] };
  if (!fx) return { status: 'none', items: [] };
  const { faction, detachments } = armyOf(ctx, p);
  const enh = new Set(myUnits(ctx.state, p).flatMap(u => u.enhancements || []).map(fxNorm));
  const keep = e => e && e.id && e.kind && (e.source !== 'enhancement' || enh.has(fxNorm(e.enhancement || e.name)));
  const items = [];
  (fx.effects || []).filter(keep).forEach(e => items.push({ e, key: `army:${e.id}`, det: null, src: faction ? faction.name : 'Army rule' }));
  const dmap = fx.detachments || {};
  detachments.forEach(d => {
    const fid = pl.faction || '';
    const list = dmap[d.id] || dmap[String(d.id).replace(fid + '--', '')] || dmap[`${fid}--${d.id}`] || Object.entries(dmap).find(([k]) => fxNorm(k) === fxNorm(d.name))?.[1] || [];
    list.filter(keep).forEach(e => items.push({ e, key: `det:${d.id}:${e.id}`, det: d, src: d.name }));
  });
  // Dependencies: a detachment effect can replace army effects – explicit `replaces: [effectId]`, or a detachment
  // choice whose options are the states of an army threshold (Mercenary Oathband → Prioritised Efficiency). Never both.
  const gone = new Set();
  items.filter(it => it.det).forEach(it => {
    (Array.isArray(it.e.replaces) ? it.e.replaces : it.e.replaces ? [it.e.replaces] : []).forEach(id => gone.add(`army:${id}`));
    if (it.e.kind !== 'choice') return;
    const ids = new Set((it.e.options || []).map(o => o.id));
    items.filter(a => !a.det && a.e.kind === 'threshold' && (a.e.states || []).length && a.e.states.every(st => ids.has(st.id))).forEach(a => {
      gone.add(a.key);
      if (!it.e.default) { const st = thresholdStart(a.e); if (st) it.defaultOpt = st.id; }
      it.switchRes = a.e.resource;
    });
  });
  return { status: 'ok', items: items.filter(it => !gone.has(it.key)) };
}
/** Cost of switching a pick-one choice to another option: explicit `switchCost` (+ `resource`), or "spend N YP … switch" in `when`. */
export function switchCostOf(it) {
  const e = it.e;
  if (e.pick === 'multi') return null;
  if (Number(e.switchCost) > 0) return { cost: Number(e.switchCost), resource: e.resource || it.switchRes || '' };
  const m = /spend\s+(\d+)\s*([A-Za-z]{1,6})\b[^.]*\bswitch/i.exec(String(e.when || ''));
  return m ? { cost: Number(m[1]), resource: e.resource || it.switchRes || m[2] } : null;
}
/** Resource cost of picking option o now: option cost, or the switch cost when another option is active. → { cost, resource } | null */
export function optionCost(it, o, picked) {
  if (Number(o.cost) > 0) return { cost: Number(o.cost), resource: o.resource || it.e.resource || '' };
  const sw = switchCostOf(it);
  return sw && picked.length && !picked.includes(o.id) ? sw : null;
}
export function fxItem(ctx, p, key) { return effectItems(ctx, p).items.find(x => x.key === key) || null; }

const inRange = (s, v) => (s.min == null || v >= s.min) && (s.max == null || v <= s.max);
/** Threshold state for a resource value. */
export function thresholdDerive(e, value) { const st = e.states || []; return st.find(s => inRange(s, value)) || st[0] || null; }
/** State at the start of the battle: e.start, else the lowest state (only max), else the first. */
export function thresholdStart(e) {
  const st = e.states || [];
  return (e.start && st.find(s => s.id === e.start)) || st.find(s => s.min == null && s.max != null) || st[0] || null;
}
/** Active threshold state of an item: stored value (set this battle) → else start state (before battle / round 1) → else derived. */
export function thresholdActive(ctx, p, item) {
  const { state } = ctx;
  const e = item.e;
  const stored = (((state.players[p] || {}).effects) || {})[item.key];
  const res = resourceFor(state, p, e.resource);
  const value = res ? Number(res.r.value) || 0 : 0;
  const byId = id => (e.states || []).find(s => s.id === id) || null;
  if (stored && byId(stored.value)) return { state: byId(stored.value), how: 'set', stored, value, res };
  if (state.stage !== 'battle' || (state.round || 0) <= 1) return { state: thresholdStart(e), how: 'start', stored: null, value, res };
  return { state: thresholdDerive(e, value), how: 'derived', stored: null, value, res };
}

/** Has a stored pick/toggle run out (duration text vs. the round/turn it was set in)? */
export function fxExpired(state, me, stored, duration) {
  if (!stored) return true;
  if (state.stage !== 'battle') return false;
  const d = String(duration || '').toLowerCase();
  const same = stored.round === state.round && stored.turn === state.turn;
  if (/next (command phase|turn)|start of your next/.test(d)) return state.turn === me && !same;
  if (/phase|\bturn\b/.test(d)) return !same;
  if (/round/.test(d)) return stored.round !== state.round;
  return false;
}
/** Selected option ids of a choice item (empty when expired). */
export function choicePicked(state, p, item) {
  const stored = (((state.players[p] || {}).effects) || {})[item.key];
  const def = item.e.default || item.defaultOpt;
  if (!stored && def) return [String(def)];   // start of the battle (e.g. Hostile Acquisition)
  if (!stored || stored.value == null || fxExpired(state, p, stored, item.e.duration)) return [];
  const v = Array.isArray(stored.value) ? stored.value : [stored.value];
  const ids = new Set((item.e.options || []).map(o => o.id));
  return v.map(String).filter(id => ids.has(id));
}
/** Is a toggle item on right now? */
export function toggleOn(state, p, item) {
  const stored = (((state.players[p] || {}).effects) || {})[item.key];
  return !!(stored && stored.value === true && !fxExpired(state, p, stored, item.e.duration));
}
/** Current value of a counter item: { label, effect } | null. */
export function counterNow(state, p, e) {
  if (e.byRound && typeof e.byRound === 'object') {
    const r = Math.max(1, state.round || 1);
    const keys = Object.keys(e.byRound).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    // the value of the last listed round up to now; before the first listed round (Patient Hunter: rounds 3–5) or a round
    // listed as null (an effect that ends) it does not apply
    const k = keys.filter(x => x <= r).pop();
    const v = k == null ? null : e.byRound[k];
    if (v == null || v === '') return { label: `Round ${r}`, effect: 'Not active in this battle round', inactive: true };
    return { label: `Round ${r}`, effect: String(v) };
  }
  if (Array.isArray(e.tiers) && e.tiers.length) {
    const res = resourceFor(state, p, e.resource);
    const v = res ? Number(res.r.value) || 0 : 0;
    const t = e.tiers.filter(x => (x.min == null ? 0 : x.min) <= v).sort((a, b) => (a.min || 0) - (b.min || 0)).pop();
    return { label: `${v} ${res ? resShort(res.r.name) : ''}`.trim(), effect: t ? t.effect : '' };
  }
  return null;
}

/** Stratagem add-ons of a stratagem (stratAddons keyed by name, case-insensitive) for player p: [] when none. */
export function stratAddonsOf(ctx, s, p = ctx.me) {
  const fx = effectsOf(ctx, (ctx.state.players[p] || {}).faction);
  const map = fx && fx.stratAddons;
  if (!map || !s) return [];
  const k = fxNorm(s.name);
  const hit = Object.entries(map).find(([name]) => fxNorm(name) === k);
  return hit && Array.isArray(hit[1]) ? hit[1] : [];
}
