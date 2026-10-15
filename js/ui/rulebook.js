/* Rulebook – global searchable reference (routes #/rules and #/g/CODE/rules).
 *
 * render(root, ctx): works without a game; with a game, the factions of both armies are preloaded for unit search.
 * Module state (query, open entries/sections, loaded datasheets, original texts) lives in S so re-renders keep it.
 * Index: static part built once (core rules, glossary, missions, core + faction stratagems); mission sequence steps
 * and unit datasheets are added lazily (loadMissionsOrig / loadDatasheets). Async repaints only when the rules view is active.
 */
import { CORE } from '../../data/core.js';
import { WH } from '../../data/rules.js';
import { FACTIONS } from '../../data/factions/index.js';
import { esc, btn } from './components.js';
import { TERMS, EXACT_TERMS } from '../i18n-de.js';
import { datasheetCard } from './datasheet.js';
import { loadDatasheets } from '../data/datasheets.js';
import { loadMissionsOrig, loadOrig, origStratagem, origPrimary, origSecondary, origTwist, normKey, normKeyBase } from '../data/orig.js';

const TYPE_LABEL = {
  core: 'Core rule', step: 'Phase step', glossary: 'Glossary',
  primary: 'Mission', secondary: 'Mission', twist: 'Mission', sequence: 'Mission',
  corestrat: 'Core stratagem', armyrule: 'Army rule', detrule: 'Detachment rule', strat: 'Stratagem', unit: 'Unit'
};
const GROUPS = [
  ['core', 'Core rules'], ['step', 'Phase steps'], ['glossary', 'Glossary'], ['mission', 'Missions'],
  ['corestrat', 'Core stratagems'], ['armyrule', 'Army rules'], ['detrule', 'Detachment rules'], ['strat', 'Stratagems'], ['unit', 'Units']
];
const MISSION_TYPES = { primary: 1, secondary: 1, twist: 1, sequence: 1 };
const MAX_RESULTS = 150;
const SNIP = 200;

// ---------------------------------------------------------------- Module state
const S = {
  q: '',
  open: new Set(),          // expanded entry ids
  secs: new Set(['core']),  // open browse sections
  faction: null,            // faction page (id) or null
  dets: new Set(),          // open detachments on faction page
  unitsShown: new Set(),    // faction pages with the units list open
  ds: new Map(),            // factionId → { units, entries }
  dsLoading: new Set(),
  orig: new Map(),          // factionId → orig json | null
  origLoading: new Set(),
  missions: undefined,      // missions orig json | null (undefined = not loaded)
  missionsLoading: false,
  preloadedFor: null
};
const ALL = new Map();      // entry id → entry (static + dynamic)
let STATIC = null;
let SEQ = [];
let timer = null;
let lastRoot = null;
let lastCtx = null;

// ---------------------------------------------------------------- Index
const norm = s => String(s == null ? '' : s).toLowerCase();
function mk(e) {
  e.hay = norm([e.title, e.text, e.sub, e.extra].filter(Boolean).join(' '));
  e.thay = norm(e.title);
  ALL.set(e.id, e);
  return e;
}
function stratMeta(s) {
  const ph = Array.isArray(s.ph) ? s.ph : ['any'];
  const full = p => { const x = WH.PHASES.find(y => y.id === p); return x ? x.full : p; };
  // owner per phase when the WHEN mixes them: "Shooting phase (Your turn), Fight phase (Either turn)"
  if (s.phw && !ph.includes('any')) return `${s.cost || 0} CP · ${ph.map(p => `${full(p)} (${WH.WHOSE_LABELS[s.phw[p]] || 'Either turn'})`).join(', ')}`;
  const phases = ph.includes('any') ? 'Any phase' : ph.map(full).join(', ');
  return `${s.cost || 0} CP · ${phases} · ${WH.WHOSE_LABELS[s.whose] || 'Either turn'}`;
}
function staticIndex() {
  if (STATIC) return STATIC;
  const out = [];
  const add = e => out.push(mk(e));
  for (const [pid, ph] of Object.entries(CORE.phases || {})) {
    (ph.order || []).forEach((o, i) => add({ id: `step:${pid}:${i}`, type: 'step', title: `${ph.title} – step ${i + 1}`, text: o, sub: ph.title, phase: pid }));
    (ph.rules || []).forEach(r => add({ id: `core:${pid}:${r.id}`, type: 'core', title: r.title, text: r.text, sub: ph.title, tags: r.tags, phase: pid, extra: (r.tags || []).join(' ') }));
  }
  (CORE.turnStart || []).forEach(r => add({ id: `core:ts:${r.id}`, type: 'core', title: r.title, text: r.text, sub: 'Start of turn', phase: 'turnStart' }));
  (CORE.general || []).forEach(r => add({ id: `core:gen:${r.id}`, type: 'core', title: r.title, text: r.text, sub: 'Reference', tags: r.tags, phase: 'general', extra: (r.tags || []).join(' ') }));
  (CORE.glossary || []).forEach((g, i) => add({ id: `glos:${i}`, type: 'glossary', title: g.term, text: g.text, verbatim: !!g.orig }));
  Object.entries(WH.PRIMARY || {}).forEach(([k, m]) => add({ id: `prim:${k}`, type: 'primary', title: m.name, text: m.desc || (m.c || []).map(c => c.t).join(' '), extra: (m.c || []).map(c => c.t).join(' '), sub: 'Primary mission', key: k, conds: m.c || [], note: m.note }));
  Object.entries(WH.SECONDARY || {}).forEach(([k, m]) => add({ id: `sec:${k}`, type: 'secondary', title: m.name, text: m.note || (m.c || []).map(c => c.t).join(' '), extra: (m.c || []).map(c => c.t).join(' '), sub: 'Secondary mission', key: k, conds: m.c || [], note: m.note }));
  (WH.TWISTS || []).forEach(t => add({ id: `twist:${t.id}`, type: 'twist', title: t.name, text: t.t, sub: 'Twist', key: t.id }));
  (WH.STRATAGEMS || []).forEach(s => add({ id: `cstrat:${s.id}`, type: 'corestrat', title: s.name, text: s.t || s.effect, extra: [s.when, s.target, s.effect, s.restr].join(' '), sub: stratMeta(s), strat: s }));
  FACTIONS.forEach(f => {
    (f.detachments || []).forEach(d => {
      (d.strats || []).forEach(s => add({ id: `strat:${d.id}:${s.id}`, type: 'strat', title: s.name, text: s.t || s.effect, extra: [s.when, s.target, s.effect, s.restr, (s.kw || []).join(' ')].join(' '), sub: `${f.name} · ${d.name} · ${s.cost || 0} CP`, fac: f.id, det: d.name, strat: s }));
    });
  });
  STATIC = out;
  return out;
}
/** Army rules, detachment rules and enhancements of a faction – BSData (New Recruit) only. */
function ruleEntries(facId, d) {
  const f = FACTIONS.find(x => x.id === facId);
  const fname = f ? f.name : facId;
  const out = [];
  const plain = t => String(t || '').replace(/\^\^|\*\*/g, '');   // snippet / search text without BSData markup (full view: mdBold)
  (d.armyRules || []).forEach((r, i) => out.push(mk({ id: `army:${facId}:${i}`, type: 'armyrule', title: `${r.name} – army rule`, text: plain(r.text), sub: fname, fac: facId, rules: [r] })));
  (d.detachments || []).forEach((det, i) => out.push(mk({ id: `det:${facId}:${i}`, type: 'detrule', title: `${det.name} – detachment rule`, text: (det.rules || []).map(r => r.name + ': ' + plain(r.text)).join(' '),
    extra: (det.enhancements || []).map(e => e.name + ' ' + (e.text || '')).join(' '), sub: `${fname} · ${det.name}${det.dp != null ? ` · ${det.dp} DP` : ''}`, fac: facId, det: det.name, rules: det.rules || [], enh: det.enhancements || [] })));
  return out;
}
function unitEntries(facId, units) {
  const f = FACTIONS.find(x => x.id === facId);
  return (units || []).map(u => {
    const ab = u.abilities || {};
    const text = [u.composition, (ab.core || []).length ? 'CORE: ' + ab.core.join(', ') : '', (ab.faction || []).length ? 'FACTION: ' + ab.faction.join(', ') : '', ...(ab.unit || []).map(a => a.name + ': ' + (a.text || ''))].filter(Boolean).join(' · ');
    const extra = [(u.keywords || []).join(' '), (u.factionKeywords || []).join(' '), ...(ab.wargear || []).map(a => a.name + ' ' + (a.text || '')), ...(u.ranged || []).map(w => w.name), ...(u.melee || []).map(w => w.name), ab.damaged || ''].join(' ');
    return mk({ id: `unit:${facId}:${u.id}`, type: 'unit', title: u.name, text, extra, sub: f ? f.name : facId, fac: facId, unit: u });
  });
}
function allEntries() {
  let out = staticIndex();
  if (SEQ.length) out = out.concat(SEQ);
  for (const v of S.ds.values()) if (v.entries.length) out = out.concat(v.entries);
  return out;
}

// ---------------------------------------------------------------- Search
// German game terms (as the German UI / tutorial teaches them) → the English terms of the rules texts
let deTerms = null;
function enQuery(q) {
  if (!deTerms) {
    const m = new Map();
    const add = (de, en) => { const k = norm(de); if (k && !m.has(k)) m.set(k, norm(en)); };
    for (const [en, de] of [...Object.entries(TERMS), ...Object.entries(EXACT_TERMS)]) add(de, en);
    Object.entries({ Deckung: 'cover', Gelände: 'terrain', Geländestück: 'terrain feature', Vorrücken: 'advance', Zurückfallen: 'fall back',
      Nahkampf: 'fight', Fernkampf: 'shooting', Bewegung: 'movement', Angriff: 'charge', Sichtbarkeit: 'visible', Moral: 'battle-shock',
      Transporter: 'transport', Aussteigen: 'disembark', Einsteigen: 'embark', Schlachtrunde: 'battle round', Sperrfeuer: 'overwatch' }).forEach(([de, en]) => add(de, en));
    // whole words only ("sp" must not touch "space")
    deTerms = [...m.entries()].sort((a, b) => b[0].length - a[0].length)
      .map(([de, en]) => [new RegExp('(^|[^a-z0-9äöüß])' + de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z0-9äöüß])', 'g'), en]);
  }
  let out = norm(q);
  for (const [re, en] of deTerms) out = out.replace(re, (x, pre) => pre + en);
  return out;
}
function tokens(q) { return enQuery(q).split(/\s+/).filter(Boolean); }
function search(q) {
  const toks = tokens(q);
  if (!toks.length) return { toks, groups: [], total: 0 };
  if (!S.allDs) { S.allDs = true; FACTIONS.forEach(f => ensureDs(f.id)); } // army/detachment rules live in the BSData files
  const hits = [];
  for (const e of allEntries()) {
    let ok = true;
    for (const t of toks) if (!e.hay.includes(t)) { ok = false; break; }
    if (ok) hits.push(e);
  }
  const rank = e => toks.every(t => e.thay.includes(t)) ? 0 : 1;
  const groups = [];
  for (const [gid, label] of GROUPS) {
    const list = hits.filter(e => (gid === 'mission' ? MISSION_TYPES[e.type] : e.type === gid));
    if (!list.length) continue;
    list.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'en'));
    groups.push({ id: gid, label, list });
  }
  return { toks, groups, total: hits.length };
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hl(s, toks) {
  const h = esc(s);
  if (!toks || !toks.length) return h;
  const re = new RegExp('(' + toks.map(t => reEsc(esc(t))).join('|') + ')', 'gi');
  return h.replace(re, '<mark>$1</mark>');
}
function snippet(text, toks) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  let start = 0;
  if (toks && toks.length) {
    const low = t.toLowerCase();
    let pos = -1;
    for (const k of toks) { const p = low.indexOf(k); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
    if (pos > SNIP - 80) start = Math.max(0, pos - 60);
  }
  const s = t.slice(start, start + SNIP);
  return (start ? '… ' : '') + s + (start + SNIP < t.length ? ' …' : '');
}

// ---------------------------------------------------------------- Lazy data
function repaint() { if (document.body.dataset.view === 'rules' && lastRoot && lastRoot.isConnected) paint(); }
async function ensureDs(facId) {
  if (!facId || S.ds.has(facId) || S.dsLoading.has(facId)) return;
  S.dsLoading.add(facId);
  try {
    const d = await loadDatasheets(facId);
    const units = d && Array.isArray(d.units) ? d.units : [];
    S.ds.set(facId, { units, entries: unitEntries(facId, units).concat(d ? ruleEntries(facId, d) : []) });
  } catch { S.ds.set(facId, { units: [], entries: [] }); }
  finally { S.dsLoading.delete(facId); repaint(); }
}
async function ensureOrig(facId) {
  if (!facId || S.orig.has(facId) || S.origLoading.has(facId)) return;
  S.origLoading.add(facId);
  try { S.orig.set(facId, await loadOrig(facId)); } catch { S.orig.set(facId, null); }
  finally { S.origLoading.delete(facId); repaint(); }
}
async function ensureMissions() {
  if (S.missions !== undefined || S.missionsLoading) return;
  S.missionsLoading = true;
  try {
    const m = await loadMissionsOrig();
    S.missions = m || null;
    if (m && Array.isArray(m.sequence)) {
      SEQ = m.sequence.map((st, i) => mk({ id: `seq:${i}`, type: 'sequence', title: (st.n != null ? st.n + '. ' : '') + st.step, text: st.text, sub: 'Mission sequence', verbatim: true }));
    }
  } catch { S.missions = null; }
  finally { S.missionsLoading = false; repaint(); }
}

// ---------------------------------------------------------------- HTML helpers
const mdBold = s => esc(String(s).replace(/\^\^/g, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function origBlock(html, label = 'Original text', loading = false) {
  if (loading) return `<div class="orig-block"><div class="orig-label">${esc(label)}</div><div class="muted small">Loading …</div></div>`;
  if (!html) return '';
  return `<div class="orig-block"><div class="orig-label">${esc(label)}</div><div class="orig-text">${html}</div></div>`;
}
function stratBody(s, toks, pre = '') {
  const row = (k, v) => v ? `<div class="rb-strat-row"><b>${k}:</b> <span class="rb-text">${hl(v, toks)}</span></div>` : '';
  return `${pre}${row('WHEN', s.when)}${row('TARGET', s.target)}${row('EFFECT', s.effect)}${row('RESTRICTIONS', s.restr || s.restrictions)}`;
}
/** VP value of a condition: a number, or { F, T } = Fixed / Tactical (secondary missions). */
const vpText = v => (v && typeof v === 'object' ? `${v.F} VP Fixed / ${v.T} VP Tactical` : `${v} VP`);
const MODE_LABEL = { F: 'Fixed only', T: 'Tactical only' };
function condList(conds) {
  if (!conds || !conds.length) return '';
  return `<ul class="rb-conds">${conds.map(c => {
    // staged conditions ("choice"): one VP value per option
    const vp = c.k === 'choice' ? 'VP' : `${c.sub ? '+' : ''}${vpText(c.vp)}${c.k === 'per' ? ' each' : ''}${c.max ? ` (max ${c.max})` : ''}`;
    const opts = c.k === 'choice' && Array.isArray(c.opts) ? `<ul class="rb-opts">${c.opts.map(o => `<li><b class="rb-vp">${esc(vpText(o.vp))}</b> ${esc(o.t)}</li>`).join('')}</ul>` : '';
    const when = [WH.TIMING_LABELS[c.w] || c.w, c.w === 'end' ? '' : `rounds ${c.r ? c.r.join('–') : '1–5'}`, MODE_LABEL[c.mode] || ''].filter(Boolean).join(' · ');
    return `<li><b class="rb-vp">${esc(vp)}</b> ${esc(c.t)}${opts}<div class="xs muted">${esc(when)}</div></li>`;
  }).join('')}</ul>`;
}
function typeBadge(e) {
  const t = MISSION_TYPES[e.type] ? 'mission' : e.type;
  return `<span class="rb-type" data-t="${esc(t)}">${esc(TYPE_LABEL[e.type] || e.type)}</span>`;
}
function tagChips(tags) {
  return Array.isArray(tags) && tags.length ? `<div class="rb-tags">${tags.map(t => `<span class="rb-tag">${esc(t)}</span>`).join('')}</div>` : '';
}

/** Full (expanded) content of an entry incl. original text where available. */
function fullHtml(e, toks) {
  const text = `<div class="rb-text">${hl(e.text, toks)}</div>`;
  switch (e.type) {
    case 'core': return text + tagChips(e.tags);
    case 'step': return text;
    case 'glossary': return e.verbatim ? origBlock(hl(e.text, toks), 'Original text (verbatim)') : text;
    case 'sequence': return origBlock(hl(e.text, toks), 'Original text (verbatim)');
    case 'primary': case 'secondary': case 'twist': {
      ensureMissions();
      let orig = null;
      if (S.missions) orig = e.type === 'primary' ? origPrimary(S.missions, e.key) : e.type === 'secondary' ? origSecondary(S.missions, e.key) : origTwist(S.missions, e.key);
      const extra = e.type === 'twist' ? '' : condList(e.conds);
      const note = e.note && e.text !== e.note ? `<p class="muted small">${hl(e.note, toks)}</p>` : '';
      return text + note + extra + (S.missions === undefined || S.missionsLoading ? origBlock('', 'Original text', true) : origBlock(orig && orig.text ? hl(orig.text, toks) : ''));
    }
    case 'corestrat': {
      const s = e.strat;
      const o = s.orig;
      return stratBody(s, toks, `<div class="rb-sub">${esc(stratMeta(s))}${s.once ? ' · once per battle' : ''}${s.notRound1 ? ' · not in the first battle round' : ''}</div>`)
        + (o ? origBlock(stratBody(o, toks)) : '');
    }
    case 'strat': {
      const s = e.strat;
      ensureOrig(e.fac);
      const o = S.orig.has(e.fac) ? origStratagem(S.orig.get(e.fac), e.det, s.name) : null;
      const kw = (s.kw || []).length ? tagChips(s.kw) : '';
      return stratBody(s, toks, `<div class="rb-sub">${esc(stratMeta(s))}</div>`) + kw
        + (S.orig.has(e.fac) ? origBlock(o ? (o.text ? `<div class="rb-text">${hl(o.text, toks)}</div>` : stratBody(o, toks)) : '') : origBlock('', 'Original text', true));
    }
    case 'armyrule': case 'detrule': {
      // BSData (New Recruit) text only
      const rules = (e.rules || []).filter(r => !r.core).map(r => `<div class="rb-orig-rule"><b>${esc(r.name)}</b><div class="rb-text">${mdBold(r.text || '')}</div></div>`).join('');
      const enh = (e.enh || []).map(x => `<div class="rb-orig-rule"><b>${esc(x.name)}${x.cost != null ? ` (${esc(String(x.cost))} pts)` : ''}</b><div class="rb-text">${mdBold(x.text || '')}</div></div>`).join('');
      return rules + (enh ? `<div class="rb-sub mt">Enhancements</div>${enh}` : '');
    }
    case 'unit': return `<div class="rb-ds">${datasheetCard(e.unit, {})}</div>`;
    default: return text;
  }
}

function rowHtml(e, toks, opts = {}) {
  const open = S.open.has(e.id);
  const sub = opts.noSub ? '' : (e.sub ? `<div class="rb-sub">${hl(e.sub, toks)}</div>` : '');
  return `<div class="rb-row${open ? ' open' : ''}" data-rb="toggle" data-id="${esc(e.id)}" role="button" tabindex="0" aria-expanded="${open ? 'true' : 'false'}">
    <div class="rb-row-head">${opts.noType ? '' : typeBadge(e)}<span class="rb-title">${hl(e.title, toks)}</span><span class="rb-caret" aria-hidden="true">${open ? '▴' : '▾'}</span></div>
    ${sub}
    ${open ? `<div class="rb-full">${fullHtml(e, toks)}</div>` : `<div class="rb-snip">${hl(snippet(e.text, toks), toks)}</div>`}
  </div>`;
}
function rows(list, toks, opts) { return list.map(e => rowHtml(e, toks, opts)).join(''); }

// ---------------------------------------------------------------- Views
function unitChips() {
  const loaded = [...S.ds.keys()].map(id => FACTIONS.find(f => f.id === id)).filter(Boolean);
  const loading = [...S.dsLoading].map(id => FACTIONS.find(f => f.id === id)).filter(Boolean);
  return `<div class="rb-chips">
    <label class="rb-chips-label" for="rb-fac">Search units of:</label>
    <select id="rb-fac" data-rb="facsel" aria-label="Load datasheets of a faction">
      <option value="">– choose faction –</option>
      <option value="__all"${FACTIONS.every(f => S.ds.has(f.id)) ? ' disabled' : ''}>All factions (every datasheet)</option>
      ${FACTIONS.map(f => `<option value="${esc(f.id)}"${S.ds.has(f.id) ? ' disabled' : ''}>${esc(f.name)}${S.ds.has(f.id) ? ' ✓' : ''}</option>`).join('')}
    </select>
    ${loaded.map(f => `<span class="chip sm on">${esc(f.name)} · ${S.ds.get(f.id).units.length}</span>`).join('')}
    ${loading.map(f => `<span class="chip sm">${esc(f.name)} …</span>`).join('')}
  </div>`;
}

function resultsHtml(q) {
  const r = search(q);
  if (!r.total) return `<p class="muted center rb-empty">No match for “${esc(q)}”.${S.ds.size ? '' : ' Units are only searched for loaded factions – pick one above.'}</p>`;
  let shown = 0;
  const html = r.groups.map(g => {
    if (shown >= MAX_RESULTS) return '';
    const list = g.list.slice(0, MAX_RESULTS - shown);
    shown += list.length;
    return `<section class="rb-group"><div class="rb-group-h">${esc(g.label)} <span class="rb-count">${g.list.length}</span></div>${rows(list, r.toks)}</section>`;
  }).join('');
  return `<div class="rb-total muted small">${r.total} result${r.total === 1 ? '' : 's'}${r.total > MAX_RESULTS ? ` · showing the first ${MAX_RESULTS} – refine your search` : ''}</div>${html}`;
}

function section(id, title, count, inner, lvl = 1) {
  const open = S.secs.has(id);
  return `<section class="rb-sec lvl${lvl}${open ? ' open' : ''}">
    <button class="rb-sec-h" type="button" data-rb="sec" data-sec="${esc(id)}" aria-expanded="${open ? 'true' : 'false'}"><span class="rb-sec-t">${esc(title)}</span>${count != null ? `<span class="rb-count">${esc(count)}</span>` : ''}<span class="rb-caret" aria-hidden="true">${open ? '▴' : '▾'}</span></button>
    ${open ? `<div class="rb-sec-b">${inner()}</div>` : ''}
  </section>`;
}

function browseHtml() {
  const E = staticIndex();
  const by = t => E.filter(e => e.type === t);
  const phaseIds = Object.keys(CORE.phases || {});
  const coreCount = by('core').length + by('step').length;
  const glos = by('glossary').slice().sort((a, b) => a.title.localeCompare(b.title, 'en'));
  const letters = [];
  glos.forEach(g => { const L = (g.title[0] || '#').toUpperCase(); let x = letters.find(l => l.L === L); if (!x) { x = { L, list: [] }; letters.push(x); } x.list.push(g); });
  const prim = by('primary'), sec = by('secondary'), tw = by('twist'), cs = by('corestrat');

  const coreInner = () => [
    section('phase:turnStart', 'Start of turn / battle round', E.filter(e => e.phase === 'turnStart').length, () => rows(E.filter(e => e.phase === 'turnStart'), [], { noType: true, noSub: true }), 2),
    ...phaseIds.map(pid => {
      const ph = CORE.phases[pid];
      const steps = E.filter(e => e.type === 'step' && e.phase === pid);
      const rl = E.filter(e => e.type === 'core' && e.phase === pid);
      return section('phase:' + pid, ph.title, rl.length, () => `${steps.length ? `<ol class="rb-order">${steps.map(s => `<li>${esc(s.text)}</li>`).join('')}</ol>` : ''}${rows(rl, [], { noType: true, noSub: true })}`, 2);
    }),
    section('phase:general', 'Reference', E.filter(e => e.phase === 'general').length, () => rows(E.filter(e => e.phase === 'general'), [], { noType: true, noSub: true }), 2)
  ].join('');

  const glosInner = () => letters.map(l => `<div class="rb-letter">${esc(l.L)}</div>${rows(l.list, [], { noType: true })}`).join('');

  const missionsInner = () => {
    ensureMissions();
    return [
      section('m:primary', 'Primary missions', prim.length, () => rows(prim, [], { noType: true, noSub: true }), 2),
      section('m:secondary', 'Secondary missions', sec.length, () => rows(sec, [], { noType: true, noSub: true }), 2),
      section('m:twist', 'Twists', tw.length, () => rows(tw, [], { noType: true, noSub: true }), 2),
      section('m:sequence', 'Mission sequence', SEQ.length || null, () => SEQ.length ? rows(SEQ, [], { noType: true, noSub: true }) : `<p class="muted small">${S.missions === null ? 'Mission sequence not available (data/orig/missions.json).' : 'Loading …'}</p>`, 2)
    ].join('');
  };

  const facInner = () => `<div class="rb-faclist">${FACTIONS.map(f => `<button class="rb-fac" type="button" data-rb="faction" data-fac="${esc(f.id)}"><span class="rb-fac-name">${esc(f.name)}</span><span class="rb-fac-meta">${f.group ? esc(f.group) + ' · ' : ''}${f.detachments.length} detachment${f.detachments.length === 1 ? '' : 's'}${S.ds.has(f.id) ? ' · units loaded' : ''}</span><span class="rb-caret">›</span></button>`).join('')}</div>`;

  return [
    section('core', 'Core rules by phase', coreCount, coreInner),
    section('glossary', 'Glossary (A–Z)', glos.length, glosInner),
    section('missions', 'Missions', prim.length + sec.length + tw.length, missionsInner),
    section('corestrat', 'Core stratagems', cs.length, () => rows(cs, [], { noType: true })),
    section('factions', 'Factions', FACTIONS.length, facInner)
  ].join('');
}

function factionPage(f) {
  const E = staticIndex();
  const res = f.resource;
  const rem = Array.isArray(f.reminders) ? f.reminders : [];
  ensureDs(f.id);   // army/detachment rules come from the faction's BSData file (ruleEntries: army:<fac>:<i>, det:<fac>:<i>)
  const ds = S.ds.get(f.id);
  const showUnits = S.unitsShown.has(f.id);
  const loading = S.dsLoading.has(f.id);
  const ruleList = ds ? ds.entries.filter(e => e.type === 'armyrule' || e.type === 'detrule') : [];
  const armies = ruleList.filter(e => e.type === 'armyrule');
  // BSData detachment by name: exact, else without a bracket suffix ("Blade of Ultramar (Ultramarines)")
  const detRule = d => ruleList.find(e => e.type === 'detrule' && normKey(e.det) === normKey(d.name)) || ruleList.find(e => e.type === 'detrule' && normKeyBase(e.det) === normKeyBase(d.name));
  const none = what => `<p class="muted small">${ds ? `No ${what} on file.` : 'Loading rules …'}</p>`;
  const remLabel = r => ({ roundStart: 'Start of battle round', turnStart: 'Start of turn', always: 'Always' }[r.phase] || (WH.PHASES.find(p => p.id === r.phase) || {}).full || r.phase) + (r.whose && r.whose !== 'either' ? ` · ${WH.WHOSE_LABELS[r.whose] || r.whose}` : '');
  return `<div class="rb-facpage">
    <div class="rb-fachead">${btn({ label: '‹ Factions', kind: 'ghost', small: true, data: { rb: 'back' } })}<h2 class="title rb-factitle">${esc(f.name)}</h2>${f.group ? `<span class="badge">${esc(f.group)}</span>` : ''}</div>
    ${armies.length ? `<div class="rb-blk"><div class="rb-blk-t">Army rule</div>${armies.map(a => rowHtml(a, [], { noType: true, noSub: true })).join('')}</div>` : none('army rule')}
    ${res ? `<div class="rb-blk"><div class="rb-blk-t">Resource</div><div class="card flat rb-res"><b>${esc(res.name)}</b>${res.max != null ? ` <span class="muted small">(max ${esc(res.max)})</span>` : ''}${res.text ? `<div class="small rb-text">${esc(res.text)}</div>` : ''}</div></div>` : ''}
    ${rem.length ? `<div class="rb-blk"><div class="rb-blk-t">Reminders</div><ul class="rb-rem">${rem.map(r => `<li><span class="rb-rem-ph">${esc(remLabel(r))}</span><div class="rb-text">${esc(r.text)}</div></li>`).join('')}</ul></div>` : ''}
    <div class="rb-blk"><div class="rb-blk-t">Detachments <span class="rb-count">${f.detachments.length}</span></div>
      ${f.detachments.map(d => {
        const open = S.dets.has(d.id);
        const rule = detRule(d);
        const strats = E.filter(e => e.type === 'strat' && e.fac === f.id && e.det === d.name);
        return `<section class="rb-sec lvl2${open ? ' open' : ''}">
          <button class="rb-sec-h" type="button" data-rb="det" data-det="${esc(d.id)}" aria-expanded="${open ? 'true' : 'false'}"><span class="rb-sec-t">${esc(d.name)}</span><span class="rb-count">${d.dp ? `${esc(d.dp)} DP · ` : ''}${strats.length} strat${strats.length === 1 ? '' : 's'}</span><span class="rb-caret" aria-hidden="true">${open ? '▴' : '▾'}</span></button>
          ${open ? `<div class="rb-sec-b">${rule ? rowHtml(rule, [], { noSub: true }) : ds && d.rule ? `<div class="rb-orig-rule"><div class="rb-text" data-no-i18n lang="en">${esc(d.rule).replace(/\n/g, '<br>')}</div></div>` : none('detachment rule')}${strats.length ? rows(strats, [], { noSub: true }) : ''}</div>` : ''}
        </section>`;
      }).join('')}
    </div>
    <div class="rb-blk"><div class="rb-blk-t">Units</div>
      ${showUnits && ds ? (ds.units.length ? `<p class="muted small">${ds.units.length} datasheets – tap to expand.</p><div class="rb-units">${ds.units.map(u => datasheetCard(u, { compact: true })).join('')}</div>` : '<p class="muted small">No datasheets available for this faction.</p>')
        : btn({ label: loading ? 'Loading units …' : `Units${ds ? ` (${ds.units.length})` : ''}`, kind: 'primary', disabled: loading, data: { rb: 'units', fac: f.id } })}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Render / paint
function paint() {
  const body = lastRoot && lastRoot.querySelector('#rb-body');
  if (!body) return;
  const q = S.q.trim();
  const fac = S.faction ? FACTIONS.find(f => f.id === S.faction) : null;
  body.innerHTML = unitChips() + (q ? resultsHtml(q) : fac ? factionPage(fac) : browseHtml());
  const clr = lastRoot.querySelector('.rb-clear');
  if (clr) clr.hidden = !q;
}

export function render(root, ctx) {
  lastRoot = root;
  lastCtx = ctx;
  staticIndex();
  // With a game: preload the datasheets of both armies once per game code
  const st = ctx && ctx.state;
  if (st && Array.isArray(st.players) && S.preloadedFor !== ctx.code) {
    S.preloadedFor = ctx.code;
    st.players.forEach(p => { if (p && p.faction) ensureDs(p.faction); });
  }
  if (root.__rbBound) { paint(); return; }
  root.__rbBound = true;
  root.innerHTML = `
    <div class="rb-bar">
      <input type="search" id="rb-q" class="rb-q" placeholder="Search rules, missions, stratagems, units…" value="${esc(S.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Search the rulebook" enterkeyhint="search">
      <button class="btn ghost icon rb-clear" type="button" data-rb="clear" aria-label="Clear search"${S.q ? '' : ' hidden'}>✕</button>
    </div>
    <div class="rb-body" id="rb-body"></div>`;
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  paint();
}

function setQuery(q) {
  S.q = q;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; paint(); }, 120);
}
function onInput(e) {
  if (e.target && e.target.id === 'rb-q') setQuery(e.target.value);
}
function onChange(e) {
  const t = e.target;
  if (t && t.dataset.rb === 'facsel' && t.value) {
    const id = t.value;
    t.value = '';
    if (id === '__all') FACTIONS.forEach(f => ensureDs(f.id)); else ensureDs(id);
    paint();
  }
}
function onKey(e) {
  const t = e.target;
  if (t && t.id === 'rb-q' && e.key === 'Escape') { t.value = ''; setQuery(''); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('rb-row') && t.dataset.rb === 'toggle') {
    e.preventDefault();
    toggleEntry(t.dataset.id, t);
  }
}
function toggleEntry(id, rowEl) {
  if (!id) return;
  if (S.open.has(id)) S.open.delete(id); else S.open.add(id);
  // Repaint only the row when possible (keeps scroll position stable)
  const e = ALL.get(id);
  if (e && rowEl && rowEl.isConnected) {
    const tmp = document.createElement('div');
    const noType = !rowEl.querySelector(':scope > .rb-row-head > .rb-type');
    const noSub = !rowEl.querySelector(':scope > .rb-sub');
    tmp.innerHTML = rowHtml(e, tokens(S.q), { noType, noSub });
    rowEl.replaceWith(tmp.firstElementChild);
  } else paint();
}
function onClick(e) {
  const b = e.target.closest('[data-rb]');
  if (!b || !lastRoot.contains(b)) return;
  const act = b.dataset.rb;
  if (act === 'toggle') {
    // Clicks inside the expanded body (datasheet details, links) do not collapse the row
    const full = e.target.closest('.rb-full');
    if (full && b.contains(full)) return;
    toggleEntry(b.dataset.id, b);
    return;
  }
  if (act === 'clear') {
    const inp = lastRoot.querySelector('#rb-q');
    if (inp) { inp.value = ''; inp.focus(); }
    setQuery('');
    return;
  }
  if (act === 'sec') {
    const id = b.dataset.sec;
    if (S.secs.has(id)) S.secs.delete(id); else S.secs.add(id);
    paint();
    return;
  }
  if (act === 'faction') {
    S.faction = b.dataset.fac || null;
    paint();
    try { lastRoot.querySelector('.rb-facpage').scrollIntoView({ block: 'start' }); } catch {}
    return;
  }
  if (act === 'back') { S.faction = null; S.secs.add('factions'); paint(); return; }
  if (act === 'det') {
    const id = b.dataset.det;
    if (S.dets.has(id)) S.dets.delete(id); else S.dets.add(id);
    paint();
    return;
  }
  if (act === 'units') {
    const id = b.dataset.fac;
    S.unitsShown.add(id);
    ensureDs(id);
    paint();
  }
}

/** Debug/testing helpers (no UI): current state and raw search. */
export const _rb = { S, search, allEntries };
