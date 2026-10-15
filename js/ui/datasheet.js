/* datasheet.js – Datenblatt-Karte im Layout von New Recruit / GW-Datasheet.
 * Eingabe: Datenblatt aus data/datasheets/<faction>.json (Schema siehe tools/bsdata-convert.mjs)
 * plus optional die importierte Listeneinheit (Modellzahl, gewählte Ausrüstung, Enhancements) und die aufgelöste
 * Leader-Anbindung (opt.attach) aus der Liste.
 *
 * Aufbau (wie New Recruit): Kopf mit Name + Punkte · Leader-Zeile (Leading/Led by) · Werte-Kacheln M T SV W LD OC (+ INV) ·
 * BUFFS FROM <LEADER> (nur Bodyguard) · RANGED WEAPONS · MELEE WEAPONS · ABILITIES · WARGEAR ABILITIES · ENHANCEMENTS ·
 * LEADER · TRANSPORT · UNIT COMPOSITION / Optionen · Keywords-Leiste + Faction Keywords.
 */
import { esc } from './components.js';
import { kwify, kwList } from './keywords.js';
import { normName as normKey } from '../data/datasheets.js';   // same normalisation as the callers' detachment/enhancement lists

const STAT_KEYS = [['M', 'M'], ['T', 'T'], ['SV', 'SV'], ['W', 'W'], ['LD', 'LD'], ['OC', 'OC']];

/** Weapon name → how many the unit has; the same weapon on several model types is added up (7 pulse carbines on the
 *  Pathfinders + 1 on the Shas'ui = 8). */
function wargearCounts(list) {
  const m = new Map();
  for (const w of list) { const k = normName(typeof w === 'string' ? w : w.name); m.set(k, (m.get(k) || 0) + (typeof w === 'string' ? 1 : (Number(w.count) || 1))); }
  return m;
}

/** Light markup of the data files (**bold**) → safe HTML. */
function rich(text) {
  return kwify(esc(String(text == null ? '' : text).replace(/\^\^/g, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'));
}

/* Profile changes of the list (enhancements, wargear, abilities – js/builder/profiles.js):
   unit.mods = { weapons: { [key]: { chars, base, keywords, notes } }, models: { [key]: { chars, base, notes } } } */
const modKey = s => normName(String(s || '').replace(/^[^A-Za-z0-9]+/, ''));
function weaponMod(mods, w) {
  const bag = mods && mods.weapons;
  if (!bag) return null;
  return bag[modKey(w.name + (w.profile ? ' ' + w.profile : ''))] || bag[modKey(w.name + (w.profile ? ' - ' + w.profile : ''))] || (w.profile ? null : bag[modKey(w.name)]) || null;
}
function modelMod(mods, p, single) {
  const bag = mods && mods.models;
  if (!bag) return null;
  const vals = Object.values(bag);
  return bag[modKey(p.name)] || (single && vals.length === 1 ? vals[0] : null);
}
/** A value cell: changed values highlighted, the original as tooltip. */
function cell(v, m, key) {
  const ch = m && m.chars && m.chars[key] != null;
  return ch ? `<td class="ds-mod" title="was ${esc(String(m.base[key] ?? ''))}">${esc(String(m.chars[key]))}</td>` : `<td>${esc(String(v ?? ''))}</td>`;
}
const modTags = m => (m ? `${(m.keywords || []).length ? `<span class="ds-wabil ds-mod-kw">${kwList(m.keywords)}</span>` : ''}${(m.notes || []).map(n => `<span class="ds-mod-src">★ ${esc(n)}</span>`).join('')}` : '');

function statRow(p, m = null) {
  const v = (k) => (m && m.chars && m.chars[k] != null ? m.chars[k] : p[k]);
  const c = (k) => (m && m.chars && m.chars[k] != null ? ` ds-mod" title="was ${esc(String(m.base[k] ?? '–'))}` : '');
  const inv = v('INV');
  return `<div class="ds-stats">${STAT_KEYS.map(([k, label]) => `<div class="ds-stat${c(k)}"><span class="ds-stat-k">${label}</span><span class="ds-stat-v">${esc(String(v(k) ?? '–'))}</span></div>`).join('')}${inv ? `<div class="ds-stat inv${c('INV')}"><span class="ds-stat-k">INV</span><span class="ds-stat-v">${esc(String(inv))}</span></div>` : ''}</div>${m && (m.notes || []).length ? `<div class="ds-mod-notes">${m.notes.map(n => `<span class="ds-mod-src">★ ${esc(n)}</span>`).join('')}</div>` : ''}`;
}

function weaponName(w, count, m = null) {
  return `<span class="ds-wname">${esc(w.name)}${count > 1 ? ` <span class="ds-wcount">×${count}</span>` : ''}${w.profile ? ` <span class="ds-wprofile">– ${esc(w.profile)}</span>` : ''}</span>${(w.abilities || []).length ? `<span class="ds-wabil">${kwList(w.abilities)}</span>` : ''}${modTags(m)}`;
}

function weaponTable(list, kind, chosen, mods = null) {
  if (!list || !list.length) return '';
  const skill = kind === 'ranged' ? 'BS' : 'WS';
  // With an army list only the chosen weapons are shown (options not taken are left out)
  const shown = chosen && chosen.size ? list.filter(w => chosen.get(normName(w.name))) : list;
  if (!shown.length) return '';
  const rows = shown.map(w => {
    const n = chosen ? chosen.get(normName(w.name)) : undefined;
    const sel = chosen && chosen.size ? ' sel' : '';
    const m = weaponMod(mods, w);
    return `<tr class="ds-wrow${sel}${m && Object.keys(m.chars || {}).length ? ' ds-wmod' : ''}"><td class="ds-wcell-name">${weaponName(w, n || 0, m)}</td>${cell(w.range, m, 'range')}${cell(w.A, m, 'A')}${cell(w[skill], m, skill)}${cell(w.S, m, 'S')}${cell(w.AP, m, 'AP')}${cell(w.D, m, 'D')}</tr>`;
  }).join('');
  return `<div class="ds-section"><div class="ds-section-h">${kind === 'ranged' ? 'RANGED WEAPONS' : 'MELEE WEAPONS'}</div>
    <table class="ds-weapons"><thead><tr><th></th><th>RANGE</th><th>A</th><th>${skill}</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Normalisierung für den Abgleich von Ausrüstungsnamen (muss zu js/data/datasheets.js passen). */
export function normName(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[’'`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Abilities BSData only shows with a certain detachment (a.detachment, e.g. Votann "Guerrilla Adepts" = Persecution
 *  Prospect rule): visible only if the player plays it. dets = normalised names of the player's detachments, null = no
 *  player context (rulebook) → shown, tagged with the detachment. */
export function abilityVisible(a, dets, enhs = null) {
  if (!a || (!a.detachment && !a.enhancement)) return true;
  if (!dets) return true;
  // enhs = normalised enhancement names of the unit and its attached leader(s): BSData also gates abilities on an
  // enhancement of the bearer (Aeldari "Runes of Warding" → Feel No Pain), sometimes tagged like a detachment
  const e = enhs || [];
  return [].concat(a.detachment || []).some(n => dets.includes(normKey(n)) || e.includes(normKey(n)))
    || [].concat(a.enhancement || []).some(n => e.includes(normKey(n)));
}
const detTag = a => (a && (a.detachment || a.enhancement) ? ` <span class="ds-tag">${esc([].concat(a.detachment || [], a.enhancement || []).join(' / '))}</span>` : '');
function abilityList(items, mark) {
  return items.map(a => `<div class="ds-ab${mark && mark.has(a.name) ? ' ds-ab-buff' : ''}"><b>${esc(a.name)}:</b> ${rich(a.text || '')}${mark && mark.has(a.name) ? ' <span class="ds-tag">affects led unit</span>' : ''}${detTag(a)}</div>`).join('');
}

/** Buff block on a bodyguard card: badges per ability with an (i) button (data-action="buff.info"). */
function buffsBlock(attach) {
  const leader = attach.name;
  const buffs = attach.buffs || [];
  if (!buffs.length) return `<div class="ds-section ds-buffs"><div class="ds-section-h">BUFFS FROM ${esc(String(leader).toUpperCase())}</div><div class="ds-ab muted">No abilities of ${esc(leader)} that affect the led unit were recognised.</div></div>`;
  return `<div class="ds-section ds-buffs"><div class="ds-section-h">BUFFS FROM ${esc(String(leader).toUpperCase())}</div>
    ${buffs.map((b, i) => `<div class="ds-buff">
      <div class="ds-buff-head"><b>${esc(b.name)}</b>${b.src === 'enhancement' ? ' <span class="ds-tag">enhancement</span>' : ''}
        <button type="button" class="btn ghost icon ds-info" data-action="buff.info" data-leader="${esc(attach.leaderId || '')}" data-buff="${i}" aria-label="Show full text of ${esc(b.name)}">i</button></div>
      <div class="ds-buff-badges"><span class="ds-buff-scope">${esc(b.scope)}:</span> ${b.badges.length ? b.badges.map(k => `<span class="kw${/^\[/.test(k) ? ' ab' : ''}">${esc(k)}</span>`).join('') : '<span class="muted xs">see text</span>'}</div>
    </div>`).join('')}</div>`;
}

function attachLine(attach) {
  if (!attach) return '';
  return `<div class="ds-attach ${esc(attach.role)}${attach.resolved ? '' : ' unresolved'}">${attach.role === 'leader' ? 'Leading' : 'Led by'}: <b>${esc(attach.name)}</b>${attach.resolved ? '' : ' <span class="muted">(not in list)</span>'}</div>`;
}

/**
 * Datenblatt als HTML.
 * @param {object} ds    Datenblatt
 * @param {object} [opt] { unit (Listeneinheit: models, wargear[], enhancements[], warlord), compact (Kopf+Werte, Rest aufklappbar), open, key,
 *                         enhancements: [{ name, cost, text }], attach: { role: 'leader'|'bodyguard', name, resolved, leaderId, buffs[], marks: Set } }
 */
export function datasheetCard(ds, opt = {}) {
  const unit = opt.unit || null;
  let chosen = unit && Array.isArray(unit.wargear) && unit.wargear.length
    ? wargearCounts(unit.wargear) : null;
  // Safety: if none of the listed names matches a weapon of the datasheet, show all weapons instead of none
  if (chosen && ![...(ds.ranged || []), ...(ds.melee || [])].some(w => chosen.has(normName(w.name)))) chosen = null;
  const pts = unit && unit.points ? `${unit.points} pts` : (ds.points && ds.points.length ? ds.points.map(p => `${p.models ? p.models + ' × ' : ''}${p.pts} pts`).join(' · ') : '');
  const models = unit ? `${unit.models} model${unit.models === 1 ? '' : 's'}` : (ds.modelsRange ? `${ds.modelsRange[0]}${ds.modelsRange[1] && ds.modelsRange[1] !== ds.modelsRange[0] ? '–' + ds.modelsRange[1] : ''} models` : '');
  const ab = ds.abilities || {};
  const attach = opt.attach || null;
  const marks = attach && attach.role === 'leader' ? attach.marks : null;
  const profiles = (ds.profiles && ds.profiles.length) ? ds.profiles : [{ name: ds.name, M: '–', T: '–', SV: '–', W: '–', LD: '–', OC: '–' }];
  const enh = Array.isArray(opt.enhancements) ? opt.enhancements : (unit && (unit.enhancements || []).map(e => ({ name: typeof e === 'string' ? e : e.name, text: '' }))) || [];
  const body = `${opt.top || ''}
    ${profiles.map(p => `${profiles.length > 1 ? `<div class="ds-profile-name">${esc(p.name)}</div>` : ''}${statRow(p, modelMod(unit && unit.mods, p, profiles.length === 1))}`).join('')}
    ${attach && attach.role === 'bodyguard' && attach.resolved ? buffsBlock(attach) : ''}
    ${weaponTable(ds.ranged, 'ranged', chosen, unit && unit.mods)}
    ${weaponTable(ds.melee, 'melee', chosen, unit && unit.mods)}
    <div class="ds-section"><div class="ds-section-h">ABILITIES</div>
      ${(ab.core || []).length ? `<div class="ds-ab"><b>CORE:</b> ${kwList(ab.core)}</div>` : ''}
      ${(ab.faction || []).length ? `<div class="ds-ab"><b>FACTION:</b> ${ab.faction.map(esc).join(', ')}</div>` : ''}
      ${abilityList((ab.unit || []).filter(a => abilityVisible(a, opt.detachments || null, opt.enhNames || null) && notSupportAb(ds)(a)), marks)}
      ${ab.invul ? `<div class="ds-ab ds-inv"><b>INVULNERABLE SAVE:</b> ${esc(String(ab.invul))}</div>` : ''}
      ${ab.damaged ? `<div class="ds-ab"><b>DAMAGED:</b> ${rich(ab.damaged)}</div>` : ''}
    </div>
    ${(() => { const wg = unit ? memberWargearAbilities(ds, unit) : (ab.wargear || []); return wg.length ? `<div class="ds-section"><div class="ds-section-h">WARGEAR ABILITIES</div>${abilityList(wg, marks)}</div>` : ''; })()}
    ${enh.length ? `<div class="ds-section"><div class="ds-section-h">ENHANCEMENTS</div>${enh.map(e => `<div class="ds-ab${marks && marks.has(e.name) ? ' ds-ab-buff' : ''}"><b>${esc(e.name)}${e.cost ? ` (${esc(String(e.cost))} pts)` : ''}${e.text ? ':' : ''}</b> ${e.text ? rich(e.text) : '<span class="muted xs">text not on file</span>'}</div>`).join('')}</div>` : ''}
    ${['leader', 'support'].map(k => ds[k] ? `<div class="ds-section"><div class="ds-section-h">${k.toUpperCase()}</div><div class="ds-ab">${ds[k].text ? rich(ds[k].text) : (ds[k].canLead || []).length ? `This model can be attached to the following units:<ul class="ds-list">${ds[k].canLead.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div></div>` : '').join('')}
    ${ds.transport ? `<div class="ds-section"><div class="ds-section-h">TRANSPORT</div><div class="ds-ab">${rich(ds.transport)}</div></div>` : ''}
    ${ds.composition || (ds.options || []).length ? `<div class="ds-section"><div class="ds-section-h">UNIT COMPOSITION</div>${ds.composition ? `<div class="ds-ab">${rich(ds.composition)}</div>` : ''}${(ds.options || []).length ? `<ul class="ds-list ds-options">${ds.options.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <div class="ds-keywords"><span class="ds-kw-label">KEYWORDS:</span> ${(ds.keywords || []).map(k => `<span class="ds-kw">${esc(k)}</span>`).join('')}</div>
    ${(ds.factionKeywords || []).length ? `<div class="ds-keywords faction"><span class="ds-kw-label">FACTION KEYWORDS:</span> ${ds.factionKeywords.map(k => `<span class="ds-kw">${esc(k)}</span>`).join('')}</div>` : ''}`;
  const flags = [unit && unit.warlord ? '<span class="ds-tag wl">Warlord</span>' : '', enh.length ? `<span class="ds-tag">${enh.length} enhancement${enh.length === 1 ? '' : 's'}</span>` : ''].filter(Boolean).join('');
  const head = `<div class="ds-head"><div class="ds-head-main"><div class="ds-title">${esc(ds.name)}${flags}</div>${attachLine(attach)}</div><div class="ds-meta">${esc(models)}${models && pts ? ' · ' : ''}${esc(pts)}</div></div>`;
  if (opt.compact) {
    return `<details class="ds-card"${opt.key ? ` data-key="${esc(opt.key)}"` : ''}${opt.defaultOpen ? ' data-default-open="1"' : ''}${opt.open ? ' open' : ''}><summary>${head}</summary><div class="ds-body">${body}</div></details>`;
  }
  return `<div class="ds-card open">${head}<div class="ds-body">${body}</div></div>`;
}

/** Hinweiskarte, wenn zu einer Listeneinheit kein Datenblatt gefunden wurde. */
export function datasheetMissing(unit, opt = {}) {
  const attach = opt.attach || null;
  return `<div class="ds-card missing"><div class="ds-head"><div class="ds-head-main"><div class="ds-title">${esc(unit.name)}</div>${attachLine(attach)}</div><div class="ds-meta">${unit.models} model${unit.models === 1 ? '' : 's'}${unit.points ? ` · ${unit.points} pts` : ''}</div></div>
    <div class="ds-body">${attach && attach.role === 'bodyguard' && attach.resolved ? buffsBlock(attach) : ''}
    ${(unit.wargear || []).length ? `<div class="ds-ab"><b>Wargear:</b> ${unit.wargear.map(w => esc(typeof w === 'string' ? w : (w.count > 1 ? w.count + '× ' : '') + w.name)).join(', ')}</div>` : ''}
    <div class="ds-ab muted">No datasheet found. Check the unit name or update the datasheets.</div></div></div>`;
}

/* ═══════════════ Leader + led unit as ONE card ═══════════════
 * The attached unit acts as one: stats of the leader(s) above those of the unit, all weapons in one table, abilities of
 * both. Rows that belong only to the leader are coloured (.from-leader) and tagged with the leader's name.
 * Leader buffs: weapon abilities from a leader ability ("weapons … in that unit have the [LETHAL HITS] ability") are shown
 * as a marker on every affected weapon ("[LETHAL HITS]*" + (i)); other buffs (invulnerable save, FNP, Deep Strike …) as
 * chips under the stats. (i) opens the full text of the leader ability (data-action="buff.info").
 *
 * group = { body: { ds, unit, enh }, leaders: [{ ds, unit, enh, buffs: [{ name, text, src, badges, scope }] }] }  */
// Weapon abilities in any spelling ("[LETHAL HITS]", "[Lethal Hits]") – shown uppercase like on the datasheets
const WEAPON_AB = () => /\[[A-Za-z][A-Za-z0-9 :'’+\-\/]*\]/g;
const clean = t => String(t || '').replace(/\^\^|\*\*/g, '');
/** Which weapons a leader buff gives a weapon ability to: 'ranged' | 'melee' | 'all' | null (no weapon ability). */
function buffWeaponScope(text) {
  const t = clean(text);
  if (!WEAPON_AB().test(t)) return null;
  const r = /ranged (?:weapons|attacks)/i.test(t), m = /melee (?:weapons|attacks)/i.test(t);
  if (r && !m) return 'ranged';
  if (m && !r) return 'melee';
  // "weapons … have [X]" or "models in that unit have the [X] ability" → every weapon of the unit
  return /weapons|attacks|models in that unit|that unit has/i.test(t) ? 'all' : null;
}
/** What a leader buff gives the whole unit, taken word for word from its text (numbers and terms unchanged):
 *  "5+ invulnerable save", "Feel No Pain 4+ against Psychic Attacks", "Scouts 6"", "+1 Objective Control" …
 *  Empty if the wording is not recognised – then only the name is shown (full text behind (i)). */
export function buffEffects(text) {
  const t = clean(text).replace(/\s+/g, ' ');
  const out = [];
  const add = s => { s = s.trim(); if (s && !out.includes(s)) out.push(s); };
  for (const m of t.matchAll(/(\d\+) invulnerable save/gi)) add(m[1] + ' invulnerable save');
  for (const m of t.matchAll(/Feel No Pain (\d\+)(?: ability)?( against [^.,;]+)?/gi)) add('Feel No Pain ' + m[1] + (m[2] ? m[2].replace(/ ability$/i, '') : ''));
  for (const m of t.matchAll(/ha(?:ve|s) the ((?:Scouts \d+"|Infiltrators|Deep Strike|Fights First|Stealth|Lone Operative|Feel No Pain \d\+)[^.,;]*?) abilit/gi)) if (!/Feel No Pain/i.test(m[1])) add(m[1]);
  if (/ha(?:ve|s) the Benefit of Cover/i.test(t)) add('Benefit of Cover');
  for (const m of t.matchAll(/add (\d+"?|one) to the ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) characteristic/g)) add('+' + (m[1] === 'one' ? '1' : m[1]) + ' ' + m[2]);
  for (const m of t.matchAll(/add (\d+|one) to (Advance and Charge|Advance|Charge|Hit|Wound) rolls?/gi)) add('+' + (m[1] === 'one' ? '1' : m[1]) + ' to ' + m[2] + ' rolls');
  for (const m of t.matchAll(/re-roll (Advance and Charge|Advance|Charge|Hit|Wound|Battle-shock) rolls?/gi)) add('re-roll ' + m[1] + ' rolls');
  for (const m of t.matchAll(/eligible to ((?:shoot|declare a charge)(?: and (?:shoot|declare a charge))?) in a turn in which it ((?:Advanced|Fell Back)(?: or (?:Advanced|Fell Back))?)/gi)) add(m[1] + ' after ' + m[2]);
  return out;
}
const chosenMap = unit => (unit && Array.isArray(unit.wargear) && unit.wargear.length
  ? wargearCounts(unit.wargear) : null);
/** Weapons of one member: only the chosen ones (falls back to all if no name matches, like datasheetCard). */
function memberWeapons(ds, unit, kind) {
  const list = (kind === 'ranged' ? ds.ranged : ds.melee) || [];
  let chosen = chosenMap(unit);
  if (chosen && ![...(ds.ranged || []), ...(ds.melee || [])].some(w => chosen.has(normName(w.name)))) chosen = null;
  return list.filter(w => !chosen || chosen.get(normName(w.name))).map(w => ({ w, n: chosen ? chosen.get(normName(w.name)) : 0 }));
}
/** The plain "Support" ability repeats the datasheet's SUPPORT section (ds.support) – shown there only. */
const notSupportAb = ds => a => !(ds && ds.support && /^Support$/i.test(String(a.name || '').trim()));
/** Wargear abilities only for wargear the unit actually has. */
export function memberWargearAbilities(ds, unit) {
  const ab = (ds && ds.abilities && ds.abilities.wargear) || [];
  const chosen = chosenMap(unit);
  return chosen ? ab.filter(a => a.detachment || a.enhancement || chosen.has(normName(a.name))) : ab;   // detachment/enhancement-granted ones are no wargear choice
}

export function datasheetGroupCard(group, opt = {}) {
  const body = group.body, leaders = group.leaders || [];
  // every leader its own colour – what a leader adds to the unit carries it (several leaders: combined buffs at a glance)
  const LDR = ['#ECAA48', '#B48CFF', '#46C8C0', '#F07FA8'];
  const colorById = new Map(leaders.map((l, i) => [l.unit.id, LDR[i % LDR.length]]));
  const colorByName = new Map(leaders.map((l, i) => [l.ds.name, LDR[i % LDR.length]]));
  const st = c => (c ? ` style="--ldr:${c}"` : '');
  const leaderNames = leaders.map(l => `<span class="ldr-name"${st(colorById.get(l.unit.id))}>${esc(l.ds.name)}</span>`).join(' + ');
  const tagOf = name => `<span class="ds-tag ldr"${st(colorByName.get(name))}>${esc(name)}</span>`;
  // Leader buffs, numbered for (i): { leaderId, index, buff, leaderName, scope }
  const buffs = leaders.flatMap(l => (l.buffs || []).map((b, i) => ({ leaderId: l.unit.id, index: i, buff: b, leaderName: l.ds.name, scope: buffWeaponScope(b.text) })));
  const info = b => (opt.noInfo ? '' : `<button type="button" class="btn ghost icon ds-info ds-info-sm" data-action="buff.info" data-leader="${esc(b.leaderId)}" data-buff="${b.index}" aria-label="${esc(b.buff.name)} – from ${esc(b.leaderName)}">i</button>`);
  // ── stats: leaders first, then the unit
  const statBlock = (ds, isLeader, color, mods) => {
    const profiles = (ds.profiles && ds.profiles.length) ? ds.profiles : [{ name: ds.name, M: '–', T: '–', SV: '–', W: '–', LD: '–', OC: '–' }];
    return profiles.map(p => `<div class="ds-profile-name${isLeader ? ' from-leader' : ''}"${st(color)}>${esc(p.name)}</div>${statRow(p, modelMod(mods, p, profiles.length === 1))}`).join('');
  };
  // ── unit-wide buffs (no weapon ability): chips under the stats
  const unitBuffs = buffs.filter(b => !b.scope);
  // the effect itself first ("5+ invulnerable save"), the ability and the leader small underneath
  const unitBuffHtml = unitBuffs.length ? `<div class="ds-unitbuffs">${unitBuffs.map(b => {
    const fx = buffEffects(b.buff.text);
    return `<span class="ds-unitbuff"${st(colorById.get(b.leaderId))}>${fx.length ? `<b>${fx.map(esc).join(' · ')}</b><span class="ds-unitbuff-src">${esc(b.buff.name)} · ${esc(b.leaderName)}</span>` : `${esc(b.buff.name)}<span class="ds-unitbuff-src">${esc(b.leaderName)}</span>`}${info(b)}</span>`;
  }).join('')}</div>` : '';
  // ── weapons: unit + leaders in one table per kind; same weapon with the same profile in both → one row (a leader's
  //    own version of a same-named weapon – other values or abilities – keeps its own row)
  const weaponRows = kind => {
    const rows = new Map();
    const add = (entry, owner, mods) => {
      const w = entry.w, m = weaponMod(mods, w);   // a bearer-only change (enhancement) also keeps the bearer's row apart
      const k = [normName(w.name), w.profile || '', w.range, w.A, w.BS, w.WS, w.S, w.AP, w.D, (w.abilities || []).join(','), m ? JSON.stringify([m.chars, m.keywords || [], m.notes || []]) : ''].join('|');
      const r = rows.get(k);
      if (r) { r.n += entry.n; if (r.owner !== owner) r.owner = 'both'; }
      else rows.set(k, { w: entry.w, n: entry.n, owner });
    };
    memberWeapons(body.ds, body.unit, kind).forEach(e => add(e, 'unit', body.unit && body.unit.mods));
    leaders.forEach(l => memberWeapons(l.ds, l.unit, kind).forEach(e => add(e, l.ds.name, l.unit && l.unit.mods)));
    return [...rows.values()];
  };
  const weaponTable2 = kind => {
    const rows = weaponRows(kind);
    if (!rows.length) return '';
    const skill = kind === 'ranged' ? 'BS' : 'WS';
    const html = rows.map(r => {
      const own = (r.w.abilities || []).map(a => `[${String(a).toUpperCase()}]`);
      const marks = buffs.filter(b => b.scope === 'all' || b.scope === kind).flatMap(b => (clean(b.buff.text).match(WEAPON_AB()) || [])
        .map(x => x.toUpperCase()).filter(x => !own.includes(x)).map(x => `<span class="ds-wbuff"${st(colorById.get(b.leaderId))}>${esc(x)}*${info(b)}</span>`));
      const leaderOnly = r.owner !== 'unit' && r.owner !== 'both';
      const ownerUnit = leaderOnly ? (leaders.find(l => l.ds.name === r.owner) || {}).unit : body.unit;
      const m = weaponMod(ownerUnit && ownerUnit.mods, r.w) || (r.owner === 'both' ? leaders.map(l => weaponMod(l.unit.mods, r.w)).find(Boolean) : null);
      return `<tr class="ds-wrow${leaderOnly ? ' from-leader' : ''}"${leaderOnly ? st(colorByName.get(r.owner)) : ''}><td class="ds-wcell-name">${weaponName(r.w, r.n, m)}${leaderOnly ? tagOf(r.owner) : ''}${marks.length ? `<span class="ds-wbuffs">${[...new Set(marks)].join('')}</span>` : ''}</td>${cell(r.w.range, m, 'range')}${cell(r.w.A, m, 'A')}${cell(r.w[skill], m, skill)}${cell(r.w.S, m, 'S')}${cell(r.w.AP, m, 'AP')}${cell(r.w.D, m, 'D')}</tr>`;
    }).join('');
    return `<div class="ds-section"><div class="ds-section-h">${kind === 'ranged' ? 'RANGED WEAPONS' : 'MELEE WEAPONS'}</div>
      <table class="ds-weapons"><thead><tr><th></th><th>RANGE</th><th>A</th><th>${skill}</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${html}</tbody></table></div>`;
  };
  // ── abilities: the unit's first, then leader-only ones (coloured); identical names (shared abilities) only once
  const dets = opt.detachments || null;
  const enhNames = [body, ...leaders].flatMap(m => (m.enh || []).map(e => normKey(e.name || e)).concat((m.unit.enhancements || []).map(normKey)));
  const unitAb = [].concat((body.ds.abilities || {}).unit || [], memberWargearAbilities(body.ds, body.unit)).filter(a => abilityVisible(a, dets, enhNames));
  const seen = new Set(unitAb.map(a => normName(a.name)));
  const leaderAb = leaders.flatMap(l => [].concat((l.ds.abilities || {}).unit || [], memberWargearAbilities(l.ds, l.unit)).filter(a => abilityVisible(a, dets, enhNames) && notSupportAb(l.ds)(a))
    .filter(a => { const k = normName(a.name); if (seen.has(k)) return false; seen.add(k); return true; }).map(a => Object.assign({ leaderName: l.ds.name }, a)));
  const abRow = (a, leader) => `<div class="ds-ab${leader ? ' from-leader' : ''}"${leader ? st(colorByName.get(leader)) : ''}><b>${esc(a.name)}:</b> ${rich(a.text || '')}${leader ? tagOf(leader) : ''}${detTag(a)}</div>`;
  const core = [...new Set([...((body.ds.abilities || {}).core || []), ...leaders.flatMap(l => (l.ds.abilities || {}).core || [])])];
  const fac = [...new Set([...((body.ds.abilities || {}).faction || []), ...leaders.flatMap(l => (l.ds.abilities || {}).faction || [])])];
  const invs = [body, ...leaders].map(m => (m.ds.abilities || {}).invul).filter(Boolean);
  const enh = leaders.flatMap(l => (l.enh || []).map(e => Object.assign({ leaderName: l.ds.name }, e))).concat((body.enh || []).map(e => Object.assign({ leaderName: null }, e)));
  const kwUnit = new Set(body.ds.keywords || []);
  const kwLeader = [...new Set(leaders.flatMap(l => l.ds.keywords || []))].filter(k => !kwUnit.has(k));
  const members = [body.unit, ...leaders.map(l => l.unit)];
  const pts = members.reduce((t, u) => t + (Number(u.points) || 0), 0);
  const models = members.reduce((t, u) => t + (Number(u.models) || 0), 0);
  const html = `${opt.top || ''}
    ${leaders.map(l => statBlock(l.ds, true, colorById.get(l.unit.id), l.unit.mods)).join('')}
    ${statBlock(body.ds, false, null, body.unit && body.unit.mods)}
    ${unitBuffHtml}
    ${weaponTable2('ranged')}
    ${weaponTable2('melee')}
    <div class="ds-section"><div class="ds-section-h">ABILITIES</div>
      ${core.length ? `<div class="ds-ab"><b>CORE:</b> ${kwList(core)}</div>` : ''}
      ${fac.length ? `<div class="ds-ab"><b>FACTION:</b> ${fac.map(esc).join(', ')}</div>` : ''}
      ${unitAb.map(a => abRow(a, null)).join('')}
      ${leaderAb.map(a => abRow(a, a.leaderName)).join('')}
      ${invs.length ? `<div class="ds-ab ds-inv"><b>INVULNERABLE SAVE:</b> ${[...new Set(invs.map(String))].map(esc).join(' / ')}</div>` : ''}
    </div>
    ${enh.length ? `<div class="ds-section"><div class="ds-section-h">ENHANCEMENTS</div>${enh.map(e => `<div class="ds-ab${e.leaderName ? ' from-leader' : ''}"${e.leaderName ? st(colorByName.get(e.leaderName)) : ''}><b>${esc(e.name)}${e.cost ? ` (${esc(String(e.cost))} pts)` : ''}${e.text ? ':' : ''}</b> ${e.text ? rich(e.text) : '<span class="muted xs">not in the BSData (New Recruit) data</span>'}${e.leaderName ? tagOf(e.leaderName) : ''}</div>`).join('')}</div>` : ''}
    <div class="ds-keywords"><span class="ds-kw-label">KEYWORDS:</span> ${[...kwUnit].map(k => `<span class="ds-kw">${esc(k)}</span>`).join('')}${kwLeader.map(k => `<span class="ds-kw from-leader"${st(colorById.get((leaders.find(l => (l.ds.keywords || []).includes(k)) || { unit: {} }).unit.id))}>${esc(k)}</span>`).join('')}</div>`;
  const head = `<div class="ds-head"><div class="ds-head-main"><div class="ds-title">${leaderNames} + ${esc(body.ds.name)}</div><div class="ds-attach leader">Attached unit · acts as one unit</div></div><div class="ds-meta">${models} models${pts ? ` · ${pts} pts` : ''}</div></div>`;
  return `<details class="ds-card ds-group"${opt.key ? ` data-key="${esc(opt.key)}"` : ''}${opt.defaultOpen ? ' data-default-open="1"' : ''}${opt.open ? ' open' : ''}><summary>${head}</summary><div class="ds-body">${html}</div></details>`;
}
