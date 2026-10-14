/* Army builder ("My armies"), modelled on New Recruit: #/armies = saved lists, #/armies/<id> = editor.
 * Everything comes from the BSData catalogues (js/builder/bs-engine.js): units, model counts, wargear options,
 * enhancements, points and every restriction of the data. Lists are stored on this device (js/builder/store.js). */
import { esc, btn, toast, sheet, confirmSheet, promptSheet } from './components.js';
import { listArmies, loadArmy, saveArmy, deleteArmy, armyId } from '../builder/store.js';
import { playableCatalogues, systemFor, ALLIANCES } from '../builder/load.js';
import * as E from '../builder/bs-engine.js';
import { summarize, armyText } from '../builder/export.js';
import { loadDatasheets, matchUnit, normName } from '../data/datasheets.js';
import { datasheetCard, datasheetGroupCard } from './datasheet.js';
import { leaderBuffs } from './player-common.js';
import { leaderTargets } from './player-tabs.js';
import { kwList, kwify } from './keywords.js';

const dsCache = new Map();   // faction id → datasheet package (or 'loading')

const DP = '82ae-1066-5107-6ae0';
const DP_LIMIT = { 1000: 2, 2000: 3 };
// Detachment Points to buy detachments with: by battle size (Incursion 2, Strike Force 3) unless set by hand (army.dp)
const dpLimitOf = a => (a.dp != null ? Number(a.dp) : DP_LIMIT[a.limit] || 3);
const dpUsed = V => V.force.ch.reduce((x, w) => x + E.totalCost(V, w, DP), 0);
const CAT_ORDER = ['Configuration', 'Epic Hero', 'Character', 'Battleline', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Monster', 'Vehicle', 'Dedicated Transport', 'Fortification'];
const byRole = (a, b) => ((CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99)) || a.localeCompare(b);
const HIDE_ROOT = /^(Show\/Hide|Show Legends|Show Unaligned|Show Crucible|Order of Battle|Experience Points|Legendary Veterans|Weapon Modifications)/i;
const SIZES = [{ pts: 1000, name: 'Incursion' }, { pts: 2000, name: 'Strike Force' }];

let lastRoot = null, lastCtx = null;
const ed = { id: null, army: null, sys: null, loading: false, error: null, openUnit: null, cfgOpen: false, modelPick: {} };

export function render(root, ctx) {
  lastRoot = root; lastCtx = ctx;
  if (!root.__armiesBound) { root.__armiesBound = true; root.addEventListener('click', onClick); bindLongPress(root); }
  const id = typeof ctx.me === 'string' && ctx.me ? ctx.me : null;
  if (!id) { ed.id = null; root.innerHTML = listHtml(); return; }
  if (ed.id !== id) { ed.id = id; ed.army = loadArmy(id); ed.sys = null; ed.error = null; }
  if (!ed.army) { root.innerHTML = `<div class="card"><div class="title">Army not found</div><p><a class="btn ghost" href="#/armies">Back to My armies</a></p></div>`; return; }
  if (!ed.sys) {
    root.innerHTML = `<div class="card center muted">${ed.error ? `<div class="title">Could not load the data</div><p>${esc(ed.error)}</p>` : `<div class="title">Loading ${esc(ed.army.catalogueName || '')} …</div>`}</div>`;
    if (!ed.loading && !ed.error) {
      ed.loading = true;
      systemFor(ed.army.catalogueId).then(sys => { ed.sys = sys; syncOnOpen(sys); }).catch(e => { ed.error = e.message || String(e); })
        .finally(() => { ed.loading = false; if (lastRoot && ed.id === id) render(lastRoot, lastCtx); });
    }
    return;
  }
  root.innerHTML = editorHtml();
  if (ed.openUnit) refreshUnitSheet();
}
const rerender = () => { if (lastRoot && lastCtx) render(lastRoot, lastCtx); };

/* Long press on a unit of the list (≈ ½ s without moving): duplicate / delete. Moving the finger (scrolling) cancels it. */
let lpTimer = null, lpStart = null, lpFired = false;
function bindLongPress(root) {
  const cancel = () => { clearTimeout(lpTimer); lpTimer = null; };
  root.addEventListener('pointerdown', e => {
    const row = e.target.closest('.arm-unit');
    lpFired = false;
    if (!row || (e.pointerType === 'mouse' && e.button !== 0)) return;
    lpStart = { x: e.clientX, y: e.clientY };
    cancel();
    lpTimer = setTimeout(() => { lpTimer = null; lpFired = true; if (navigator.vibrate) try { navigator.vibrate(15); } catch {} unitMenu(row.dataset.id); }, 500);
  });
  root.addEventListener('pointermove', e => { if (lpTimer && lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => root.addEventListener(t, cancel));
  root.addEventListener('contextmenu', e => { if (e.target.closest('.arm-unit')) e.preventDefault(); });   // no system menu on long press
  // the click that ends a long press does not also open the unit
  root.addEventListener('click', e => { if (lpFired && e.target.closest('.arm-unit')) { e.stopPropagation(); e.preventDefault(); lpFired = false; } }, true);
}
function unitMenu(id) {
  const V = E.view(ed.sys, ed.army);
  const w = V.byId.get(id);
  if (!w) return;
  const name = unitName(V, w);
  sheet({
    title: name, cls: 'arm-unit-menu',
    body: `<p class="muted small">${E.totalCost(V, w)} pts</p>`,
    actions: [
      { label: 'Delete', kind: 'ghost', onClick: () => { apply(r => E.removeSel(r, id)); toast(`${name} deleted`, 'ok', 1500); } },
      { label: 'Duplicate', kind: 'primary', onClick: () => { apply(r => E.duplicateSel(r, id)); toast(`${name} duplicated`, 'ok', 1500); } }
    ]
  });
}

/* ═══════════════ List of saved armies ═══════════════ */
function listHtml() {
  const list = listArmies();
  return `<div class="armies">
    <header class="arm-head">
      <a class="btn ghost sm" href="#/">‹ Menu</a>
      <h1 class="title">My armies</h1>
      ${btn({ label: 'New army', kind: 'primary', action: 'arm-new' })}
    </header>
    ${list.length ? `<div class="arm-list">${list.map(a => {
      const s = a.summary || {};
      const over = a.limit && s.points > a.limit;
      return `<article class="card arm-card" data-id="${esc(a.id)}">
        <button type="button" class="arm-open" data-action="arm-open" data-id="${esc(a.id)}">
          <span class="arm-name">${esc(a.name || 'Army')}</span>
          <span class="arm-sub muted">${esc(a.catalogueLabel || a.catalogueName || '')}${s.detachments && s.detachments.length ? ' · ' + esc(s.detachments.join(', ')) : ''}</span>
        </button>
        <div class="arm-meta">
          <span class="arm-pts${over ? ' bad' : ''}"><b>${esc(s.points || 0)}</b> / ${esc(a.limit || '–')} pts</span>
          ${s.errors ? `<span class="badge warn">${esc(s.errors)} problem${s.errors === 1 ? '' : 's'}</span>` : `<span class="badge ok">valid</span>`}
          <span class="arm-actions">
            ${btn({ label: 'Copy', kind: 'ghost', small: true, action: 'arm-dup', data: { id: a.id } })}
            ${btn({ label: 'Delete', kind: 'ghost', small: true, action: 'arm-del', data: { id: a.id } })}
          </span>
        </div>
      </article>`;
    }).join('')}</div>` : `<div class="card empty-armies"><p>No army lists yet.</p><p class="muted small">Build your army right here – units, wargear, enhancements and points straight from the New Recruit data (BSData). Saved lists can be taken into any game.</p></div>`}
  </div>`;
}

async function newArmy() {
  let cats;
  try { cats = await playableCatalogues(); } catch (e) { toast(e.message || String(e), 'bad'); return; }
  let pick = null, alliance = ALLIANCES[0];
  // Faction picker: grand alliance tabs, then the armies – families (Adeptus Astartes, Heretic Astartes, Aeldari …) as groups
  const listHtml = () => {
    const mine = cats.filter(c => c.alliance === alliance);
    let html = '', grp = null;
    for (const c of mine) {
      if (c.group !== grp) {
        if (grp) html += '</div>';
        grp = c.group;
        if (grp) html += `<div class="fac-group"><div class="fac-group-h">${esc(grp)}</div>`;
      }
      html += `<button type="button" class="fac-item${pick && pick.id === c.id ? ' on' : ''}${c.group ? ' in-group' : ''}" data-cat="${esc(c.id)}">${esc(c.label)}</button>`;
    }
    if (grp) html += '</div>';
    return html;
  };
  const body = `<label class="field"><span>Name</span><input type="text" name="name" placeholder="e.g. Votann 2000" autocomplete="off"></label>
    <div class="field"><span class="label">Faction</span>
      <div class="seg fac-tabs" role="tablist">${ALLIANCES.map(a => `<button type="button" class="seg-btn${a === alliance ? ' on' : ''}" data-alliance="${esc(a)}" role="tab">${esc(a)}</button>`).join('')}</div>
      <div class="fac-list">${listHtml()}</div></div>
    <div class="field"><span class="label">Battle size</span><div class="chips">${SIZES.map((s, i) => `<label class="chip${i === 1 ? ' on' : ''}"><input type="radio" name="size" value="${s.pts}"${i === 1 ? ' checked' : ''} hidden>${esc(s.name)} · ${s.pts} pts</label>`).join('')}</div></div>`;
  sheet({
    title: 'New army', body, cls: 'arm-new-sheet',
    onOpen: el => {
      const sync = () => {
        el.querySelector('.fac-list').innerHTML = listHtml();
        el.querySelectorAll('[data-alliance]').forEach(b => b.classList.toggle('on', b.dataset.alliance === alliance));
        const ok = el.querySelector('[data-sheet-action="1"]');
        if (ok) { ok.disabled = !pick; ok.textContent = pick ? `Create ${pick.label} army` : 'Choose a faction'; }
      };
      el.addEventListener('change', e => { if (e.target.name === 'size') el.querySelectorAll('.chips .chip').forEach(c => c.classList.toggle('on', c.querySelector('input').checked)); });
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-alliance]');
        if (t) { alliance = t.dataset.alliance; sync(); return; }
        const c = e.target.closest('[data-cat]');
        if (c) { pick = cats.find(x => x.id === c.dataset.cat) || null; sync(); }
      });
      sync();
    },
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Choose a faction', kind: 'primary', disabled: true, onClick: (close, el) => {
      if (!pick) return false;
      const limit = Number((el.querySelector('input[name=size]:checked') || {}).value) || 2000;
      const name = el.querySelector('input[name=name]').value.trim() || `${pick.label} ${limit}`;
      createArmy(pick, name, limit);
    } }]
  });
}
async function createArmy(cat, name, limit) {
  const army = { id: armyId(), name, catalogueId: cat.id, catalogueName: cat.name, catalogueLabel: cat.label, file: cat.file, faction: cat.faction, limit, sel: [] };
  let sys;
  try { sys = await systemFor(cat.id); } catch (e) { toast(e.message || String(e), 'bad'); return; }
  // mandatory configuration (Battle Size, Detachment, Force Disposition …) right away; battle size preselected
  let r = army;
  const V0 = E.view(sys, r);
  for (const n of sys.rootNodes(r.catalogueId)) {
    const l = E.limits(V0, n, null, V0.force);
    if (!l.hidden && l.min > 0 && n.type === 'upgrade') r = E.addSel(sys, r, null, n.token);
  }
  r = setBattleSize(sys, r, limit);
  saveWithSummary(sys, r);
  lastCtx.nav('#/armies/' + r.id);
}
function setBattleSize(sys, r, limit) {
  const V = E.view(sys, r);
  const bs = V.force.ch.find(w => w.node && w.node.name === 'Battle Size');
  if (!bs) return Object.assign({}, r, { limit });
  const g = sys.children(bs.node).find(k => k.group && k.name === 'Battle Size');
  const opt = g && sys.children(g).find(o => new RegExp('\\(' + limit + ' Point').test(o.name));
  if (!opt) return Object.assign({}, r, { limit });
  return Object.assign(E.chooseInGroup(sys, r, bs.s.id, g.token, g.token + '>' + opt.token), { limit });
}

/* ═══════════════ Editor ═══════════════ */
/** Datasheets of the army's faction (leader rules); loads once, then re-renders. */
function dsPack() {
  const fid = ed.army && ed.army.faction;
  if (!fid) return null;
  const p = dsCache.get(fid);
  if (!p) {
    dsCache.set(fid, 'loading');
    loadDatasheets(fid).then(d => dsCache.set(fid, d || { units: [] })).catch(() => dsCache.set(fid, { units: [] })).then(() => { rerender(); refreshUnitSheet(); });
    return null;
  }
  return p === 'loading' ? null : p;
}
const unitName = (V, w) => E.effective(V, w.node, w, w.parent).name;
const isUnitSel = w => w.node && (w.node.type === 'unit' || w.node.type === 'model');
/** Units of the list the leader `w` may lead (datasheet "Leader": attached to the following units …). */
function leaderCands(V, w, pack) {
  if (!pack) return null;
  const sheet = n => matchUnit(pack.units || [], n);
  const allowed = leaderTargets(sheet(unitName(V, w)));
  if (!allowed) return null;
  return V.force.ch.filter(x => x !== w && isUnitSel(x) && !leaderTargets(sheet(unitName(V, x)))
    && (!allowed.length || allowed.includes(normName(unitName(V, x))) || allowed.includes(normName((sheet(unitName(V, x)) || {}).name))));
}
/** Leaders that could lead a unit of the list but lead none. */
function looseLeaders(V, pack) {
  return V.force.ch.filter(w => {
    if (!isUnitSel(w)) return false;
    const c = leaderCands(V, w, pack);
    return c && c.length && !(w.s.lead && V.byId.get(w.s.lead));
  });
}

function problems(V) {
  const out = E.validate(V);
  const dp = dpUsed(V), lim = dpLimitOf(V.roster);
  if (dp > lim) out.push({ sel: null, msg: `Detachments: ${dp} Detachment Points used – only ${lim} available` });
  return out;
}
function saveWithSummary(sys, r) {
  const V = E.view(sys, r);
  const s = summarize(sys, r);
  r.summary = { points: E.totalPoints(V), errors: problems(V).length, detachments: s.detachments, size: s.size };
  const saved = saveArmy(r);
  if (ed.id === r.id) ed.army = saved;
  return saved;
}
const rootOf = (V, id) => { let w = V.byId.get(id); while (w && w.parent && w.parent.kind === 'sel') w = w.parent; return w; };
const catName = (sys, w) => sys.categoryNames.get(w.node && w.node.primaryCategory) || 'Other';

function editorHtml() {
  resetOptColors();
  const { sys, army } = ed;
  const V = E.view(sys, army);
  const probs = problems(V);
  const pts = E.totalPoints(V);
  const over = army.limit && pts > army.limit;
  const byUnit = new Map();
  for (const p of probs) { const u = p.sel ? rootOf(V, p.sel) : null; const k = u ? u.s.id : ''; byUnit.set(k, (byUnit.get(k) || []).concat(p)); }
  const groups = new Map();
  for (const w of V.force.ch) {
    if (!w.node) continue;
    const c = catName(sys, w);
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(w);
  }
  const order = [...groups.keys()].sort(byRole);
  const general = byUnit.get('') || [];
  return `<div class="armies arm-editor">
    <header class="arm-bar">
      <a class="btn ghost sm" href="#/armies" aria-label="Back to My armies">‹</a>
      <button type="button" class="arm-title" data-action="arm-rename"><span class="arm-name">${esc(army.name)}</span><span class="arm-sub muted">${esc(army.catalogueLabel || army.catalogueName || '')}</span></button>
      <div class="arm-total${over ? ' bad' : ''}"><b>${pts}</b><small>/ ${esc(army.limit || '–')} pts</small></div>
      <button type="button" class="arm-prob ${probs.length ? 'warn' : 'ok'}" data-action="arm-problems" aria-label="Problems">${probs.length ? '⚠ ' + probs.length : '✓'}</button>
    </header>
    ${(() => { const loose = looseLeaders(V, dsPack()); return loose.length ? `<div class="arm-lead-info">ⓘ ${loose.length === 1 ? '1 leader is' : loose.length + ' leaders are'} not attached to a unit yet: ${loose.map(w => `<button type="button" class="arm-link" data-action="arm-unit" data-id="${esc(w.s.id)}">${esc(unitName(V, w))}</button>`).join(', ')}</div>` : ''; })()}
    ${order.map(c => c === 'Configuration' ? configHtml(V, groups.get(c), byUnit) : `
      <section class="arm-sec">
        <div class="arm-sec-h">${esc(c)}</div>
        ${groups.get(c).map(w => unitRow(V, w, byUnit.get(w.s.id) || [])).join('')}
      </section>`).join('')}
    <div class="arm-add">${btn({ label: '+ Add unit', kind: 'primary', cta: true, action: 'arm-add' })}</div>
    <div class="arm-foot row">
      ${btn({ label: 'Copy as text', kind: 'ghost', small: true, action: 'arm-text' })}
      ${btn({ label: 'Battle size', kind: 'ghost', small: true, action: 'arm-size' })}
    </div>
  </div>`;
}

function unitRow(V, w, probs) {
  const name = E.effective(V, w.node, w, w.parent).name;
  const models = countModels(w);
  const enh = w.ch.filter(c => c.groups.some(g => /Enhancement/i.test(g.name))).map(c => E.effective(V, c.node, c, c.parent).name);
  const warlord = w.ch.some(c => c.node && /^Warlord$/i.test(c.node.name));
  const pack = dsPack(), cands = leaderCands(V, w, pack), led = w.s.lead && V.byId.get(w.s.lead);
  const leadTxt = led ? `→ ${esc(unitName(V, led))}` : cands && cands.length ? '<span class="arm-loose">not attached</span>' : '';
  const ledBy = V.force.ch.filter(x => x.s.lead === w.s.id).map(x => unitName(V, x));
  return `<button type="button" class="arm-unit${probs.length ? ' has-prob' : ''}" data-action="arm-unit" data-id="${esc(w.s.id)}">
    <span class="arm-u-main"><b>${esc(name)}</b>
      <span class="muted xs">${[models > 1 ? models + ' models' : '', warlord ? 'Warlord' : '', enh.length ? esc(enh.join(', ')) : '', leadTxt, ledBy.length ? 'led by ' + esc(ledBy.join(', ')) : ''].filter(Boolean).join(' · ')}</span></span>
    ${probs.length ? '<span class="arm-u-warn" aria-label="Has problems">⚠</span>' : ''}
    <span class="arm-u-pts">${E.totalCost(V, w)}</span>
  </button>`;
}
const countModels = w => w.ch.reduce((x, c) => x + (!c.node ? 0 : c.node.type === 'model' ? c.n : c.node.type === 'upgrade' ? c.n * countModels(c) : 0), 0) || (w.node && w.node.type === 'model' ? w.n : 0);

function configHtml(V, list, byUnit) {
  const items = list.filter(w => !HIDE_ROOT.test(w.node.name));
  const bad = items.some(w => (byUnit.get(w.s.id) || []).length);
  const open = ed.cfgOpen || bad;
  const chosen = items.flatMap(w => w.ch.map(c => E.effective(V, c.node, c, c.parent).name.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+ Point limit\)/, ''))).filter(Boolean);
  if (!open) return `<section class="arm-sec arm-config"><button type="button" class="arm-cfg-sum" data-action="arm-cfg">
      <span><span class="arm-sec-h">Army configuration</span><span class="arm-cfg-line">${esc(chosen.join(' · '))} · ${dpUsed(V)}/${dpLimitOf(ed.army)} DP</span></span><span class="btn ghost sm">Change</span></button></section>`;
  return `<section class="arm-sec arm-config">
    <div class="row between"><div class="arm-sec-h">Army configuration</div>${bad ? '' : btn({ label: 'Done', kind: 'ghost', small: true, action: 'arm-cfg' })}</div>
    ${items.map(w => {
      const probs = byUnit.get(w.s.id) || [];
      return `<div class="arm-cfg${probs.length ? ' has-prob' : ''}"><div class="arm-cfg-h">${esc(E.effective(V, w.node, w, w.parent).name)}${probs.length ? `<button type="button" class="arm-tri" data-action="arm-probs" data-ids="${esc(w.s.id)}" aria-label="Show problems" title="Show problems">⚠</button>` : ''}</div>
        ${w.node.name === 'Detachment' ? dpRow(V) : ''}
        ${optionsHtml(V, w, true)}
        </div>`;
    }).join('')}
  </section>`;
}

function dpRow(V) {
  const used = dpUsed(V), lim = dpLimitOf(ed.army), auto = ed.army.dp == null;
  return `<div class="arm-dp${used > lim ? ' bad' : ''}">
    <div class="arm-dp-main"><span class="arm-dp-val"><b>${used}</b> / ${lim} DP</span><span class="muted xs">${auto ? (ed.army.limit === 1000 ? 'Incursion' : 'Strike Force') + ': ' + lim + ' Detachment Points' : 'Set by hand'}</span></div>
    <div class="stepper sm"><button type="button" data-action="arm-dp" data-d="-1"${lim <= 0 ? ' disabled' : ''} aria-label="Fewer Detachment Points">−</button><span class="stepper-value">${lim}</span><button type="button" data-action="arm-dp" data-d="1"${lim >= 9 ? ' disabled' : ''} aria-label="More Detachment Points">+</button></div>
    ${auto ? '' : `<button type="button" class="chip sm" data-action="arm-dp-auto">By battle size</button>`}
  </div>`;
}

/* ───────── Options of a selection (generic, like New Recruit): groups, choices, counters, nested ───────── */
function optionsHtml(V, w, compact) {
  return block(V, w, ed.sys.children(w.node), '', 0, compact);
}
/* ───────── Weapon comparison of a choice (popup with the profiles of every option, one colour per option) ───────── */
/* Option colours: all choices of ONE model / unit share the palette (melee and ranged choices never get the same colours,
   so nobody thinks one goes with the other); an option that brings a melee AND a ranged weapon keeps one colour. */
const optColors = new Map(), optNext = new Map();
function optColor(pid, t) {
  const k = pid + '|' + t;
  if (!optColors.has(k)) { const n = optNext.get(pid) || 0; optNext.set(pid, n + 1); optColors.set(k, OPT_COLORS[n % OPT_COLORS.length]); }
  return optColors.get(k);
}
const resetOptColors = () => { optColors.clear(); optNext.clear(); };
const OPT_COLORS = ['#4F9DF0', '#E8A13C', '#4FC57F', '#D86ADB', '#EE6E60', '#46C8C0', '#C9B458', '#9A8CF0', '#F07FA8', '#8FD14F', '#F2C94C', '#7EA6C9'];
/** Weapon profiles an option brings: its own profiles (and linked ones) plus those of mandatory sub-entries
 *  (e.g. "2 Heavy Bolters" → 2× Heavy bolter). [{ name, type: 'ranged'|'melee', n, ch: { Range, A, BS|WS, S, AP, D, Keywords } }] */
function weaponsOf(node, n = 1, depth = 0) {
  const sys = ed.sys, out = [];
  const add = p => {
    if (!p || !/^(Ranged|Melee) Weapons$/.test(p.typeName || '')) return;
    const ch = {};
    for (const c of p.characteristics || []) ch[c.name] = c.$text == null ? '' : String(c.$text);
    out.push({ name: p.name, type: /^Ranged/.test(p.typeName) ? 'ranged' : 'melee', n, ch });
  };
  node.profiles.forEach(add);
  for (const l of node.infoLinks) {
    const t = sys.idx.get(l.targetId);
    if (!t) continue;
    if (l.type === 'profile') add(t);
    else if (l.type === 'infoGroup') (t.profiles || []).forEach(add);
  }
  for (const g of node.el.infoGroups || []) (g.profiles || []).forEach(add);
  if (depth < 3) for (const k of sys.children(node)) {
    if (k.group) continue;
    const min = k.constraints.filter(c => c.type === 'min' && c.field === 'selections' && c.scope === 'parent').reduce((x, c) => Math.max(x, Number(c.value) || 0), 0);
    if (min > 0) out.push(...weaponsOf(k, n * min, depth + 1));
  }
  return out;
}
/** Effects a piece of wargear brings (BSData "Abilities" profiles, also linked ones): [{ name, text }]. */
function effectsOf(node, depth = 0) {
  const sys = ed.sys, out = [];
  const add = p => {
    if (!p || !/Abilities/i.test(p.typeName || '')) return;
    const d = (p.characteristics || []).find(c => /Description/i.test(c.name));
    if (d && d.$text) out.push({ name: p.name, text: String(d.$text).replace(/\^\^/g, '').replace(/\*\*/g, '') });
  };
  node.profiles.forEach(add);
  for (const l of node.infoLinks) { const t = sys.idx.get(l.targetId); if (t && l.type === 'profile') add(t); }
  if (depth < 2) for (const k of sys.children(node)) {
    if (k.group) continue;
    const min = k.constraints.filter(c => c.type === 'min' && c.field === 'selections' && c.scope === 'parent').reduce((x, c) => Math.max(x, Number(c.value) || 0), 0);
    if (min > 0) out.push(...effectsOf(k, depth + 1));
  }
  return out;
}
const effectHtml = list => list.map(e => `<div class="arm-effect"><b>${esc(e.name)}:</b> ${kwify(esc(e.text))}</div>`).join('');

function openCompare(pid, gtok) {
  const sys = ed.sys, V = E.view(sys, ed.army);
  const pw = pid ? V.byId.get(pid) : V.force;
  if (!pw) return;
  const g = sys.resolve(pw.node || null, gtok, ed.army.catalogueId);
  if (!g) return;
  const kids = sys.children(g).filter(x => !E.limits(V, x, null, pw).hidden);
  const row = (w, color) => `<tr style="--oc:${color}"><td class="cmp-w"><b>${w.n > 1 ? w.n + '× ' : ''}${esc(w.name.replace(/^➤\s*/, ''))}</b>${w.ch.Keywords && w.ch.Keywords !== '-' ? `<span class="cmp-kw">${kwList(w.ch.Keywords)}</span>` : ''}</td>
    <td>${esc(w.ch.Range || '')}</td><td>${esc(w.ch.A || '')}</td><td>${esc(w.ch.BS || w.ch.WS || '')}</td><td>${esc(w.ch.S || '')}</td><td>${esc(w.ch.AP || '')}</td><td>${esc(w.ch.D || '')}</td></tr>`;
  const glim = E.limits(V, g, null, pw);
  const multi = glim.max !== 1;   // several options (or the same one several times) may be taken
  const build = () => {
  const V1 = E.view(sys, ed.army);
  const pw1 = pid ? V1.byId.get(pid) || pw : V1.force;
  const inG = (pw1.ch || []).filter(c => c.s.t.startsWith(gtok + '>'));
  const total = inG.reduce((a, c) => a + c.n, 0);
  const groupFull = glim.max >= 0 && total >= glim.max;
  return (multi ? `<p class="cmp-count">${total}${glim.max >= 0 ? ' / ' + glim.max : ''} chosen${glim.min ? ` · at least ${glim.min}` : ''}</p>` : '') + kids.map((x, i) => {
    const color = optColor(pid, gtok + '>' + x.token);
    const ws = weaponsOf(x);
    const cost = E.nodeCost(V, x, null, pw);
    const n = inG.filter(c => c.s.t === gtok + '>' + x.token).reduce((a, c) => a + c.n, 0);
    const on = n > 0;
    const kmax = E.limits(V1, x, null, pw1).max;
    const more = multi && !groupFull && (kmax < 0 || n < kmax);
    // choice full: another option swaps in for one of the most-taken other option
    const src = multi && groupFull && (kmax < 0 || n < kmax) ? inG.filter(c => c.s.t !== gtok + '>' + x.token).sort((p, q) => q.n - p.n)[0] : null;
    const label = esc(E.limits(V, x, null, pw).name);
    const tag = multi
      ? `${on ? '<span class="badge ok">equipped</span>' : ''}${more ? `<span class="cmp-pick">Tap to add${on ? ' one more' : ''}</span>` : src ? `<span class="cmp-pick" data-src="${esc(src.s.id)}">Tap to swap in</span>` : on ? '' : '<span class="muted xs">limit reached</span>'}${on ? `<button type="button" class="cmp-minus" data-dec="${esc(x.token)}" aria-label="One ${label} less">−</button>` : ''}`
      : on ? ' <span class="badge ok">equipped</span>' : '<span class="cmp-pick">Tap to equip</span>';
    return `<div class="cmp-opt${on ? ' on' : ''}" style="--oc:${color}" role="button" tabindex="0" data-tok="${esc(x.token)}" aria-pressed="${on}" aria-label="Equip ${label}">
      <div class="cmp-opt-h"><span class="arm-dot" aria-hidden="true"></span><b>${n > 1 ? `(${n}×) ` : ''}${label}</b>${cost ? ` <span class="arm-cost">+${cost} pts</span>` : ''}${tag}${ws.length > 1 ? ` <span class="muted xs">${ws.length} profiles</span>` : ''}</div>
      ${ws.length ? `<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th>Weapon</th><th>Range</th><th>A</th><th>BS/WS</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${ws.map(w => row(w, color)).join('')}</tbody></table></div>` : ''}
      ${(() => { const fx = effectsOf(x); return fx.length ? `<div class="cmp-fx">${effectHtml(fx)}</div>` : ws.length ? '' : '<p class="muted xs">No profile in the data.</p>'; })()}
    </div>`;
  }).join('');
  };
  const intro = `<p class="muted xs">Every option with its weapons or effect – an option can bring several weapons (same colour). ${multi ? 'Tap to add an option (again), − takes one away.' : 'Tap an option to equip it.'}</p>`;
  sheet({
    title: glim.name, body: intro + build(), cls: 'arm-cmp-sheet wide',
    onOpen: (el, close) => {
      const redraw = () => {
        const body = el.querySelector('.sheet-body'), top = body.scrollTop;
        body.innerHTML = intro + build();   // popup stays open – it only shows what is equipped now
        body.scrollTop = top;
      };
      const selOf = t => { const p = pid ? E.view(ed.sys, ed.army).byId.get(pid) : E.view(ed.sys, ed.army).force; return ((p && p.ch) || []).find(c => c.s.t === t); };
      const pick = box => {
        const t = gtok + '>' + box.dataset.tok;
        const on = selOf(t);
        const name = E.limits(V, sys.resolve(pw.node || null, t, ed.army.catalogueId) || g, null, pw).name;
        if (multi) {
          const pk = box.querySelector('.cmp-pick');
          if (!pk) { toast('Limit reached for this choice', 'warn', 1500); return; }
          apply(r => takeOne(on ? E.setCount(r, on.s.id, on.s.n + 1) : E.addSel(ed.sys, r, pid || null, t), pk.dataset.src));
          toast(`${name} ${pk.dataset.src ? 'swapped in' : 'added'}`, 'ok', 1200);
        } else {
          if (on && glim.min) return;   // already equipped
          if (on) apply(r => E.removeSel(r, on.s.id));
          else apply(r => E.chooseInGroup(ed.sys, r, pid || null, gtok, t));
          toast(`${name} ${on ? 'removed' : 'equipped'}`, 'ok', 1500);
        }
        redraw();
      };
      const dec = tokOpt => {
        const on = selOf(gtok + '>' + tokOpt);
        if (!on) return;
        apply(r => (on.s.n > 1 ? E.setCount(r, on.s.id, on.s.n - 1) : E.removeSel(r, on.s.id)));
        redraw();
      };
      el.addEventListener('click', e => {
        const m = e.target.closest('[data-dec]');
        if (m) { e.stopPropagation(); dec(m.dataset.dec); return; }
        const b = e.target.closest('.cmp-opt[data-tok]'); if (b) pick(b);
      });
      el.addEventListener('keydown', e => { const b = e.target.closest('.cmp-opt[data-tok]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(b); } });
    },
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

function block(V, pw, nodes, prefix, depth, compact, caps = []) {
  const sys = ed.sys;
  const pid = pw.kind === 'sel' ? pw.s.id : '';
  const pfx = t => (prefix ? prefix + '>' + t : t);
  const fixed = [];
  const fixedFx = [];   // effects of the wargear a model always has (e.g. a crest)
  const others = [];     // model types not in the unit yet (standard models)
  const specials = [];   // model groups not in the unit yet (e.g. heavy weapons)
  const specialsOn = []; // model groups inside the unit's models that have models – after the standard models
  let html = '';
  const each = pw.kind === 'sel' && pw.node && pw.node.type === 'model' && pw.n > 1 ? pw.n : 0;
  const eachTag = each ? ` <span class="arm-each">each of the ${each}</span>` : '';
  /* Head count: a model can be added while the entry and every enclosing group (e.g. the unit's 10 models AND the
     heavy weapons' 2) have room; if only a group both models share is full, it can be swapped in for another model. */
  const roomFor = (tok, lim, sels) => {
    const own = lim.max < 0 ? Infinity : lim.max - sels.reduce((x, c) => x + c.n, 0);
    const room = Math.min(own, ...caps.map(c => c.max - c.total));
    if (room > 0) return { add: true };
    if (own <= 0) return { add: false };
    // the model that gives way: one of the same category first (standard for standard, heavy for heavy), the biggest group
    const par = t => t.split('>').slice(0, -1).join('>');
    const srcs = (pw.ch || []).filter(x => x.node && x.node.type === 'model' && !sels.includes(x) && x.n > E.limits(V, x.node, x, pw).min)
      .sort((p, q) => ((par(q.s.t) === par(tok)) - (par(p.s.t) === par(tok))) || q.n - p.n);
    const src = srcs.find(x => caps.every(c => c.max - c.total > 0 || (x.s.t.startsWith(c.tok + '>') && tok.startsWith(c.tok + '>'))));
    return src ? { add: false, swap: src } : { add: false };
  };
  for (const k of nodes) {
    if (/^(Crusade|Weapon Modifications|Battle Scars|Battle Honours|Override points limit)/i.test(k.name)) continue;
    const lim = E.limits(V, k, null, pw);
    const tok = pfx(k.token);
    if (k.group) {
      const inGroup = (pw.ch || []).filter(c => c.s.t.startsWith(tok + '>'));
      if (lim.hidden && !inGroup.length) continue;
      const kids = sys.children(k).filter(x => !E.limits(V, x, null, pw).hidden || inGroup.some(c => c.s.t === tok + '>' + x.token));
      if (!kids.length) continue;
      const leafs = kids.every(x => !x.group && x.type !== 'model');
      const total = inGroup.reduce((x, c) => x + c.n, 0);
      const range = lim.max === 1 ? '' : `<span class="arm-range${lim.max >= 0 && total > lim.max || total < lim.min ? ' bad' : ''}">${total}${lim.max >= 0 ? ' / ' + lim.max : ''}</span>`;
      const multi = leafs && lim.max !== 1 && kids.every(x => E.limits(V, x, null, pw).max === 1);
      if (leafs && (lim.max === 1 || multi)) {
        const same = depth === 0 && pw.node && lim.name === pw.node.name;   // "Detachment" inside "Detachment": one heading is enough
        const weaponish = kids.length > 1 && kids.some(x => weaponsOf(x).length || effectsOf(x).length);
        const cmp = weaponish ? `<button type="button" class="arm-cmp" data-action="arm-cmp" data-p="${esc(pid)}" data-g="${esc(tok)}">Compare</button>` : '';
        const headTxt = `${same ? '' : esc(lim.name)}${lim.min ? '' : ' <span class="muted xs">optional</span>'}${eachTag}`;
        html += `<div class="arm-grp">${same && lim.min && !cmp ? '' : `<div class="arm-gh">${headTxt}${cmp}</div>`}<div class="arm-choices">${kids.map((x, xi) => {
          const t = tok + '>' + x.token;
          const on = inGroup.find(c => c.s.t === t);
          const cost = on ? E.totalCost(V, on) / Math.max(1, on.n) : E.nodeCost(V, x, null, pw);
          const dot = weaponish ? `<span class="arm-dot" style="--oc:${optColor(pid, t)}" aria-hidden="true"></span>` : '';
          return `<button type="button" class="arm-opt${on ? ' on' : ''}" data-action="arm-op" data-op="${on ? (lim.min && !multi ? 'noop' : 'rm') : multi ? 'add' : 'choose'}" data-p="${esc(pid)}" data-g="${esc(tok)}" data-t="${esc(t)}"${on ? ` data-id="${esc(on.s.id)}"` : ''}>${multi ? `<span class="arm-box" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}${dot}${esc(E.limits(V, x, on || null, pw).name)}${cost ? ` <span class="arm-cost">+${cost}</span>` : ''}${(() => { const d = E.nodeCost(V, x, on || null, pw, DP); return d ? ` <span class="arm-cost arm-dpc">${d} DP</span>` : ''; })()}</button>`;
        }).join('')}</div>${inGroup.map(c => effectHtml(c.node ? effectsOf(c.node) : [])).join('')}${inGroup.map(c => nested(V, c, depth, compact)).join('')}</div>`;
      } else {
        const hasModels = kids.some(x => x.type === 'model' || (x.group && sys.children(x).some(y => y.type === 'model')));
        const sub = lim.max >= 0 ? [...caps, { tok, max: lim.max, total, name: lim.name }] : caps;
        const left = hasModels ? Math.min(...sub.map(c => c.max - c.total)) : Infinity;
        const head = !hasModels && lim.name === (pw.node && pw.node.name) && depth === 0 ? ''
          : `<div class="arm-gh${hasModels ? ' arm-gh-models' : ''}">${esc(lim.name)} ${lim.max >= 0 || lim.min > 0 ? range : ''}${hasModels ? '' : eachTag}${!hasModels && kids.length > 1 && kids.every(x => !x.group && x.type !== 'model') && kids.some(x => weaponsOf(x).length || effectsOf(x).length) ? `<button type="button" class="arm-cmp" data-action="arm-cmp" data-p="${esc(pid)}" data-g="${esc(tok)}">Compare</button>` : ''}${hasModels && Number.isFinite(left) ? ` <span class="arm-room${left > 0 ? '' : ' full'}">${left > 0 ? `${left} more possible` : lim.max >= 0 && total >= lim.max ? 'full' : 'unit full – swap models'}</span>` : ''}</div>`;
        const g = `<div class="arm-grp${hasModels && !inGroup.length ? ' arm-special' : ''}">${head}${block(V, pw, kids, tok, depth + 1, compact, sub)}</div>`;
        // a model group nobody of the unit is in yet (e.g. heavy weapons) comes after the models that are there
        if (hasModels && caps.length) specialsOn.push(g); else html += g;
      }
      continue;
    }
    const sels = (pw.ch || []).filter(c => c.s.t === tok);
    if (lim.hidden && !sels.length) continue;
    const name = E.limits(V, k, sels[0] || null, pw).name;
    if (k.type !== 'model' && lim.min > 0 && lim.min === lim.max && sels.length) {   // mandatory, nothing to choose
      fixed.push(name);
      fixedFx.push(...effectsOf(k));
      for (const c of sels) html += nested(V, c, depth, compact);
      continue;
    }
    const cost = sels.length ? E.totalCost(V, sels[0]) / Math.max(1, sels[0].n) : E.nodeCost(V, k, null, pw);
    if (k.type === 'model') {
      const r = roomFor(tok, lim, sels);
      const own = hasChoices(V, k, sels[0] || null, pw);
      others.push({ k, tok, name, cost, r, max: lim.max, sels, n: sels.reduce((x, c) => x + c.n, 0), own, gear: fixedGear(V, k, sels[0] || null, pw) });
      if (!own) continue;   // no choices of its own: the category box is all it needs
      sels.forEach((c, i) => {
        const canSplit = c.n > 1 && ed.sys.children(k).some(x => x.group || E.limits(V, x, null, c).max !== E.limits(V, x, null, c).min);
        html += `<div class="arm-model">
          <div class="arm-model-h">
            ${mdot(k)}<span class="arm-model-n">${c.n}×</span>
            <span class="arm-model-name">${esc(name)}${sels.length > 1 ? ` <span class="muted xs">(group ${i + 1})</span>` : ''}${cost ? ` <span class="arm-cost">${cost} pts each</span>` : ''}</span>
            <div class="stepper sm">
              <button type="button" data-action="arm-op" data-op="count" data-d="-1" data-id="${esc(c.s.id)}" aria-label="One model less">−</button>
              <button type="button" data-action="arm-op" data-op="count" data-d="1" data-id="${esc(c.s.id)}"${r.swap ? ` data-from="${esc(r.swap.s.id)}"` : ''}${r.add || r.swap ? '' : ' disabled'} aria-label="One model more">+</button>
            </div>
          </div>
          ${nested(V, c, depth, compact)}
          ${canSplit ? `<button type="button" class="arm-split-btn" data-action="arm-op" data-op="split" data-id="${esc(c.s.id)}">Equip one of these ${c.n} models differently</button>` : ''}
        </div>`;
      });
      continue;
    }
    if (lim.max !== 1) {
      const stacks = sels.length ? sels : [null];
      stacks.forEach((c, i) => {
        const n = c ? c.n : 0;
        const total = sels.reduce((x, s) => x + s.n, 0);
        const canAdd = lim.max < 0 || total < lim.max;
        html += `<div class="arm-row${c ? ' on' : ''}">
          <span class="arm-row-name">${esc(name)}${cost ? ` <span class="arm-cost">${cost} pts</span>` : ''}${sels.length > 1 ? ` <span class="muted xs">(${i + 1})</span>` : ''}</span>
          <div class="stepper sm">
            <button type="button" data-action="arm-op" data-op="${c ? 'count' : 'noop'}" data-d="-1" data-id="${c ? esc(c.s.id) : ''}"${n <= 0 ? ' disabled' : ''} aria-label="Fewer">−</button>
            <span class="stepper-value">${n}</span>
            <button type="button" data-action="arm-op" data-op="${c ? 'count' : 'add'}" data-d="1" data-id="${c ? esc(c.s.id) : ''}" data-p="${esc(pid)}" data-t="${esc(tok)}"${canAdd ? '' : ' disabled'} aria-label="More">+</button>
          </div>
        </div>${c ? nested(V, c, depth, compact) : ''}`;
      });
    } else {
      const c = sels[0];
      html += `<button type="button" class="arm-check${c ? ' on' : ''}" data-action="arm-op" data-op="${c ? 'rm' : 'add'}" data-p="${esc(pid)}" data-t="${esc(tok)}"${c ? ` data-id="${esc(c.s.id)}"` : ''}>
        <span class="arm-box" aria-hidden="true">${c ? '✓' : ''}</span><span>${esc(name)}</span>${cost ? `<span class="arm-cost">+${cost} pts</span>` : ''}</button>${effectHtml(effectsOf(k))}${c ? nested(V, c, depth, compact) : ''}`;
    }
  }
  // ONE box per model category (standard models / heavy weapons …): every model type with how many the unit has,
  // − / + for the chosen one ("+" swaps when the unit is full), its equipment, and Compare. Nothing jumps around.
  const pickKey = (pid || 'force') + '|' + prefix;
  const short = n => String(n).replace(/^.*?\bw\/\s*/i, '');
  const boxHtml = () => {
    if (others.length < 2 && !(others.length === 1 && !others[0].own)) return '';
    const sel = others.find(o => o.tok === ed.modelPick[pickKey]) || others.find(o => o.n > 0 && !o.own) || others.find(o => !o.own) || others[0];
    const last = sel.sels[sel.sels.length - 1];
    const can = sel.r.add || sel.r.swap;
    const minus = last ? `<button type="button" data-action="arm-op" data-op="count" data-d="-1" data-id="${esc(last.s.id)}" aria-label="One ${esc(short(sel.name))} less">−</button>`
      : '<button type="button" disabled aria-label="None to remove">−</button>';
    const plus = last
      ? `<button type="button" data-action="arm-op" data-op="count" data-d="1" data-id="${esc(last.s.id)}"${sel.r.swap ? ` data-from="${esc(sel.r.swap.s.id)}"` : ''}${can ? '' : ' disabled'} aria-label="One ${esc(short(sel.name))} more">+</button>`
      : `<button type="button" class="arm-madd" data-action="arm-op" data-op="add" data-key="${esc(pickKey)}" data-p="${esc(pid)}" data-t="${esc(sel.tok)}"${sel.r.swap ? ` data-from="${esc(sel.r.swap.s.id)}"` : ''}${can ? '' : ' disabled'} aria-label="Add ${esc(short(sel.name))}">+</button>`;
    return `<div class="arm-mbox">
      <div class="arm-gh">Model types${pid ? `<button type="button" class="arm-cmp" data-action="arm-mcmp" data-id="${esc(pid)}" data-cat="${esc(prefix)}">Compare</button>` : ''}</div>
      <div class="arm-choices">${others.map(o => `<button type="button" class="arm-opt${o === sel ? ' on' : ''}${o.n ? ' has' : ''}" data-action="arm-mpick" data-key="${esc(pickKey)}" data-tok="${esc(o.tok)}" title="${esc(o.name)}">${mdot(o.k)}${esc(short(o.name))}${o.n ? ` <b class="arm-cnt">${o.n}×</b>` : ''}</button>`).join('')}</div>
      <div class="arm-mbox-foot">
        <span class="arm-mbox-sel">${mdot(sel.k)}<b>${esc(short(sel.name))}</b>${sel.cost ? ` <span class="arm-cost">${sel.cost} pts</span>` : ''}<span class="muted xs">${sel.r.swap && !sel.r.add ? ' · + swaps one ' + esc(short(unitName(V, sel.r.swap))) : sel.max > 0 ? ' · max ' + sel.max : ''}</span></span>
        <div class="stepper sm">${minus}<span class="stepper-value">${sel.n}</span>${plus}</div>
      </div>
      ${sel.gear.length && !sel.own ? `<div class="arm-fixed"><span class="arm-fixed-l">Each equipped with</span> ${esc(sel.gear.join(' · '))}</div>` : sel.own ? '<div class="muted xs">Its weapons are chosen in its card below.</div>' : ''}
    </div>`;
  };
  html = boxHtml() + html + specialsOn.join('') + specials.join('');
  return (fixed.length ? `<div class="arm-fixed"><span class="arm-fixed-l">${each ? 'Each equipped with' : 'Equipped with'}</span> ${esc(fixed.join(' · '))}${effectHtml(fixedFx)}</div>` : '') + html;
}
/** Does a model type have choices of its own (weapon groups, optional wargear)? */
function hasChoices(V, k, c, pw) {
  return ed.sys.children(k).some(x => {
    if (/^(Crusade|Weapon Modifications)/i.test(x.name)) return false;
    const l = E.limits(V, x, null, c || pw);
    return !l.hidden && (x.group || l.max !== l.min);
  });
}
/** Fixed equipment of a model type (entries it always has). */
function fixedGear(V, k, c, pw) {
  return ed.sys.children(k).filter(x => !x.group && !/^(Crusade|Weapon Modifications)/i.test(x.name)).filter(x => { const l = E.limits(V, x, null, c || pw); return !l.hidden && l.min > 0 && l.min === l.max; }).map(x => E.limits(V, x, null, c || pw).name);
}
function nested(V, c, depth, compact) {
  if (!c.node || depth > 6) return '';
  const inner = block(V, c, ed.sys.children(c.node), '', depth + 1, compact);
  return inner.trim() ? `<div class="arm-nest">${inner}</div>` : '';
}

/* ───────── Unit sheet ───────── */
let unitClose = null;
function openUnit(id) {
  ed.openUnit = id;
  unitClose = sheet({
    title: '', body: '<div class="arm-usheet"></div>', cls: 'arm-unit-sheet wide',
    onOpen: el => { el.addEventListener('click', onClick); refreshUnitSheet(el); },
    onClose: () => { ed.openUnit = null; unitClose = null; },
    actions: [
      { label: 'Delete', kind: 'ghost', onClick: () => { const id0 = ed.openUnit; apply(r => E.removeSel(r, id0)); } },
      { label: 'Copy', kind: 'ghost', onClick: () => { apply(r => E.duplicateSel(r, ed.openUnit)); toast('Unit copied', 'ok', 1500); } },
      { label: 'Done', kind: 'primary' }
    ]
  });
}
/** Model types of a unit in data order: [{ node, tok }] (token path below the unit) – they get fixed colours. */
function modelTypes(unitNode) {
  const out = [];
  const walk = (n, pre, d) => {
    if (d > 3) return;
    for (const k of ed.sys.children(n)) {
      if (/^(Crusade|Weapon Modifications)/i.test(k.name)) continue;
      const t = pre ? pre + '>' + k.token : k.token;
      if (k.type === 'model') out.push({ node: k, tok: t });
      else if (k.group) walk(k, t, d + 1);
    }
  };
  walk(unitNode, '', 0);
  return out;
}
let modelColor = new Map();
const mdot = k => (modelColor.has(k) ? `<span class="arm-dot" style="--oc:${modelColor.get(k)}" aria-hidden="true"></span>` : '');

/** All model types of a unit with their weapons (one colour each); tap = the same as "+ Add" / "⇄ Swap in" in the unit sheet. */
function openModelCompare(unitId, cat = '') {
  const V = E.view(ed.sys, ed.army);
  const w = V.byId.get(unitId);
  if (!w) return;
  const parentOf = t => t.split('>').slice(0, -1).join('>');
  const types = modelTypes(w.node).filter(m => parentOf(m.tok) === cat && (!E.limits(V, m.node, null, w).hidden || (w.ch || []).some(c => c.node === m.node)));
  const key = unitId + '|' + cat;
  const sheetEl = document.querySelector('.sheet.arm-unit-sheet');
  const rowBtn = tok => sheetEl && sheetEl.querySelector(`.arm-opt[data-action="arm-mpick"][data-tok="${CSS.escape(tok)}"]`);
  const wkey = x => x.name + '|' + x.ch.Range + '|' + x.ch.A + '|' + x.ch.S + '|' + x.ch.AP + '|' + x.ch.D;
  const all = types.map(m => weaponsOf(m.node)).filter(ws => ws.length);
  const common = all.length > 1 ? all[0].filter(x => all.every(ws => ws.some(y => wkey(y) === wkey(x)))) : [];
  const commonKeys = new Set(common.map(wkey));
  const table = ws => `<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th>Weapon</th><th>Range</th><th>A</th><th>BS/WS</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${ws.map(x => `<tr><td class="cmp-w"><b>${x.n > 1 ? x.n + '× ' : ''}${esc(x.name.replace(/^➤ */, ''))}</b>${x.ch.Keywords && x.ch.Keywords !== '-' ? `<span class="cmp-kw">${kwList(x.ch.Keywords)}</span>` : ''}</td><td>${esc(x.ch.Range || '')}</td><td>${esc(x.ch.A || '')}</td><td>${esc(x.ch.BS || x.ch.WS || '')}</td><td>${esc(x.ch.S || '')}</td><td>${esc(x.ch.AP || '')}</td><td>${esc(x.ch.D || '')}</td></tr>`).join('')}</tbody></table></div>`;
  const body = (common.length ? `<div class="cmp-opt cmp-common" style="--oc:var(--muted)"><div class="cmp-opt-h"><b>Every model has</b></div>${table(common)}</div>` : '') + types.map(m => {
    const color = modelColor.get(m.node) || OPT_COLORS[0];
    const have = (w.ch || []).filter(c => c.node === m.node).reduce((x, c) => x + c.n, 0);
    const b = rowBtn(m.tok);
    const ws = weaponsOf(m.node).filter(x => !commonKeys.has(wkey(x)));
    const cost = E.nodeCost(V, m.node, null, w);
    const picked = !have && b && ed.modelPick[key] === m.tok;
    const tag = have ? `<span class="badge ok">${have} in the unit</span>` : picked ? '<span class="badge">selected</span>' : b ? '<span class="cmp-pick">Tap to select</span>' : '<span class="muted xs">not possible right now</span>';
    return `<div class="cmp-opt${have || picked ? ' on' : ''}" style="--oc:${color}"${!have && b ? ` role="button" tabindex="0" data-mt="${esc(m.tok)}"` : ''}>
      <div class="cmp-opt-h"><span class="arm-dot" aria-hidden="true"></span><b>${esc(E.limits(V, m.node, null, w).name)}</b>${cost ? ` <span class="arm-cost">${cost} pts</span>` : ''}${tag}</div>
      ${ws.length ? `<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th>Weapon</th><th>Range</th><th>A</th><th>BS/WS</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${ws.map(x => `<tr><td class="cmp-w"><b>${x.n > 1 ? x.n + '× ' : ''}${esc(x.name.replace(/^➤\s*/, ''))}</b>${x.ch.Keywords && x.ch.Keywords !== '-' ? `<span class="cmp-kw">${kwList(x.ch.Keywords)}</span>` : ''}</td><td>${esc(x.ch.Range || '')}</td><td>${esc(x.ch.A || '')}</td><td>${esc(x.ch.BS || x.ch.WS || '')}</td><td>${esc(x.ch.S || '')}</td><td>${esc(x.ch.AP || '')}</td><td>${esc(x.ch.D || '')}</td></tr>`).join('')}</tbody></table></div>` : (common.length ? '<p class="muted xs">Only the weapons every model has.</p>' : '<p class="muted xs">Weapons are chosen on the model.</p>')}
    </div>`;
  }).join('');
  sheet({
    title: 'Models – ' + unitName(V, w), body: `<p class="muted xs">The model types of this group with their weapons. Tap one to select it – then take it with “Add” / “Swap in” in the unit.</p>${body}`, cls: 'arm-cmp-sheet wide',
    onOpen: (el, close) => el.addEventListener('click', e => {
      const box = e.target.closest('.cmp-opt[data-mt]');
      if (!box) return;
      ed.modelPick[key] = box.dataset.mt;
      refreshUnitSheet();
      el.querySelectorAll('.cmp-opt[data-mt]').forEach(o => {
        const on = o.dataset.mt === box.dataset.mt;
        o.classList.toggle('on', on);
        const tag = o.querySelector('.badge, .cmp-pick');
        if (tag) tag.outerHTML = on ? '<span class="badge">selected</span>' : '<span class="cmp-pick">Tap to select</span>';
      });
    }),
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

function refreshUnitSheet(el) {
  const sh = el || document.querySelector('.sheet.arm-unit-sheet');
  if (!sh || !ed.openUnit) return;
  const V = E.view(ed.sys, ed.army);
  const w = V.byId.get(ed.openUnit);
  if (!w) { if (unitClose) unitClose(); return; }
  const probs = problems(V).filter(p => p.sel && rootOf(V, p.sel) === w);
  sh.querySelector('.sheet-head .title').innerHTML = `<span class="arm-title-t">${esc(E.effective(V, w.node, w, w.parent).name)}</span>${probs.length ? `<button type="button" class="arm-tri" data-action="arm-probs" data-ids="${esc(w.s.id)}" aria-label="Show problems" title="Show problems">⚠</button>` : ''}`;
  const types = modelTypes(w.node);
  resetOptColors();
  modelColor = new Map(types.length > 1 ? types.map((m, i) => [m.node, OPT_COLORS[i % OPT_COLORS.length]]) : []);
  ed.cmpUnit = types.length > 1 ? w.s.id : null;
  sh.querySelector('.arm-usheet').innerHTML = `
    <div class="arm-u-head"><span class="muted">${esc(catName(ed.sys, w))}</span><span class="arm-u-total"><b>${E.totalCost(V, w)}</b> pts</span></div>
    ${leadHtml(V, w)}
    ${optionsHtml(V, w, false)}
    ${dsHtml(V, w)}`;
}

/** Leader: which unit of the list it leads (taken into the game as "Leading …"). */
function leadHtml(V, w) {
  const cands = leaderCands(V, w, dsPack());
  if (!cands || !cands.length) return '';
  const cur = w.s.lead && V.byId.get(w.s.lead) ? w.s.lead : '';
  const nth = x => { const same = cands.filter(y => unitName(V, y) === unitName(V, x)); return same.length > 1 ? ` (${same.indexOf(x) + 1})` : ''; };
  return `<div class="arm-grp arm-lead"><div class="arm-gh">Leads${cur ? '' : ' <span class="arm-loose">not attached</span>'}</div><div class="arm-choices">
    <button type="button" class="arm-opt${cur ? '' : ' on'}" data-action="arm-op" data-op="lead" data-id="${esc(w.s.id)}" data-to="">None</button>
    ${cands.map(x => `<button type="button" class="arm-opt${cur === x.s.id ? ' on' : ''}" data-action="arm-op" data-op="lead" data-id="${esc(w.s.id)}" data-to="${esc(x.s.id)}">${esc(unitName(V, x) + nth(x))}</button>`).join('')}</div></div>`;
}

/** Datasheet of the unit (profiles, weapons, abilities) below its options – with the chosen wargear. */
function dsHtml(V, w) {
  const fid = ed.army.faction;
  if (!fid) return '';
  const pack = dsCache.get(fid);
  if (!pack) {
    dsCache.set(fid, 'loading');
    loadDatasheets(fid).then(d => dsCache.set(fid, d || { units: [] })).catch(() => dsCache.set(fid, { units: [] })).then(() => refreshUnitSheet());
    return '';
  }
  if (pack === 'loading') return '<p class="muted small">Loading datasheet …</p>';
  const name = E.effective(V, w.node, w, w.parent).name;
  const ds = matchUnit(pack.units || [], name);
  if (!ds) return '';
  const dets = summarize(ed.sys, ed.army).detachments.map(normName);
  const member = x => {
    const u = summarize(ed.sys, { ...ed.army, sel: [x.s] }).units[0];
    if (!u) return null;
    const wargear = [...u.gear.map(g => ({ name: g.name, count: g.n })), ...u.stacks.flatMap(m => m.gear.map(g => ({ name: g.name, count: g.n * m.n })))];
    return { id: x.s.id, name: u.name, models: u.models, points: u.pts, wargear, warlord: u.warlord, enhancements: u.enhancements.map(e => e.name) };
  };
  const u = member(w);
  // leaders attached to this unit: one group datasheet, every leader's buffs in its own colour
  const leaders = V.force.ch.filter(x => x.s.lead === w.s.id && isUnitSel(x)).map(x => {
    const lds = matchUnit(pack.units || [], unitName(V, x));
    if (!lds) return null;
    const lu = member(x);
    const enh = enhOf(V, x);
    return { ds: lds, unit: lu, enh, buffs: leaderBuffs(lds, enh, lu, dets) };
  }).filter(Boolean);
  if (leaders.length && u) {
    return `<div class="arm-ds"><p class="muted xs">Led by ${leaders.map(l => esc(l.ds.name)).join(' + ')} – what a leader adds is shown in its colour.</p>${datasheetGroupCard({ body: { ds, unit: u, enh: enhOf(V, w) }, leaders }, { open: true, noInfo: true, detachments: dets })}</div>`;
  }
  return `<div class="arm-ds">${datasheetCard(ds, { compact: true, detachments: dets, enhNames: u ? u.enhancements.map(e => normName(e.name)) : [], enhancements: enhOf(V, w), unit: u })}</div>`;
}
/** Enhancements of a unit selection with their rule text (BSData profile) – leaders' buffs come from them too. */
function enhOf(V, w) {
  return w.ch.filter(c => c.groups.some(g => /Enhancement/i.test(g.name))).map(c => {
    const p = c.node.profiles.find(x => /Abilities/i.test(x.typeName || '')) || null;
    const text = p ? ((p.characteristics || []).find(x => /Description/i.test(x.name)) || {}).$text || '' : '';
    return { name: unitName(V, c), cost: E.totalCost(V, c) || null, text: String(text) };
  });
}

/* ───────── Add unit ───────── */
function openAdd() {
  const sys = ed.sys;
  const V = E.view(sys, ed.army);
  const roots = sys.rootNodes(ed.army.catalogueId).filter(n => ['unit', 'model'].includes(n.type) && !HIDE_ROOT.test(n.name));
  const rows = roots.map(n => {
    const l = E.limits(V, n, null, V.force);
    if (l.hidden) return null;
    const have = E.selsOf(V, V.force, n).length;
    const pts = defaultCost(n);
    return { n, l, have, pts, cat: sys.categoryNames.get(n.primaryCategory) || 'Other' };
  }).filter(Boolean);
  const cats = [...new Set(rows.map(r => r.cat))].sort(byRole);
  rows.sort((a, b) => a.l.name.localeCompare(b.l.name));
  const body = `<div class="arm-add-top"><input type="search" class="arm-search" placeholder="Search units" autocomplete="off">
    <div class="arm-roles">${cats.map(c => `<button type="button" class="chip sm" data-jump="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
    <div class="arm-addlist">${cats.map(c => `<div class="arm-sec-h" data-role="${esc(c)}">${esc(c)}</div>${rows.filter(r => r.cat === c).map(r => `
      <button type="button" class="arm-addrow" data-tok="${esc(r.n.token)}" data-name="${esc(r.l.name.toLowerCase())}"${r.l.max >= 0 && r.have >= r.l.max ? ' disabled' : ''}>
        <span>${esc(r.l.name)}</span><span class="arm-have muted xs" data-max="${r.l.max}">${r.l.max >= 0 ? `${r.have}/${r.l.max}` : r.have ? r.have + '×' : ''}</span><span class="arm-u-pts">${r.pts}</span><span class="arm-plus" aria-hidden="true">+</span></button>`).join('')}`).join('')}</div>`;
  let added = 0;
  sheet({
    title: 'Add units', body, cls: 'arm-add-sheet wide',
    onOpen: el => {
      const q = el.querySelector('.arm-search');
      q.addEventListener('input', () => {
        const s = q.value.trim().toLowerCase();
        el.querySelectorAll('.arm-addrow').forEach(b => { b.hidden = !!s && !b.dataset.name.includes(s); });
        el.querySelectorAll('.arm-addlist [data-role]').forEach(h => { let n = h.nextElementSibling, any = false; while (n && !n.dataset.role) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
      });
      el.addEventListener('click', e => {
        const j = e.target.closest('[data-jump]');
        if (j) {
          const h = el.querySelector(`.arm-addlist [data-role="${CSS.escape(j.dataset.jump)}"]`);
          const body = el.querySelector('.sheet-body');
          if (h && body) body.scrollTo({ top: h.offsetTop - el.querySelector('.arm-add-top').offsetHeight - 4, behavior: 'smooth' });
          return;
        }
        const b = e.target.closest('.arm-addrow');
        if (!b || b.disabled) return;
        // add and stay in the list: first all units, then set them up
        apply(r => E.addSel(ed.sys, r, null, b.dataset.tok));
        const V2 = E.view(ed.sys, ed.army);
        const node = ed.sys.rootNodes(ed.army.catalogueId).find(n => n.token === b.dataset.tok);
        const have = node ? E.selsOf(V2, V2.force, node).length : 0;
        const hv = b.querySelector('.arm-have'), max = Number(hv.dataset.max);
        hv.textContent = max >= 0 ? `${have}/${max}` : `${have}×`;
        hv.classList.toggle('added', have > 0);
        if (max >= 0 && have >= max) b.disabled = true;
        b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
        added++;
        const t = el.querySelector('.sheet-head .title');
        if (t) t.textContent = `Add units · ${added} added · ${E.totalPoints(V2)} pts`;
      });
    },
    actions: [{ label: 'Done', kind: 'primary' }]
  });
}
const costCache = new Map();
function defaultCost(n) {
  const k = ed.army.catalogueId + '|' + n.token;
  if (costCache.has(k)) return costCache.get(k);
  let pts = 0;
  try { pts = E.totalPoints(E.view(ed.sys, E.addSel(ed.sys, { ...ed.army, sel: [] }, null, n.token))); } catch {}
  costCache.set(k, pts);
  return pts;
}

/* ───────── Changes ───────── */
/** Configuration choices with exactly one possible option (e.g. the Force Disposition of a detachment) are taken. */
function autoPick(sys, r) {
  // a configuration choice that is no longer available (e.g. the Force Disposition after a detachment change) is removed
  for (let i = 0; i < 8; i++) {
    const V = E.view(sys, r);
    const gone = V.force.ch.filter(w => w.node && w.node.type === 'upgrade').flatMap(w => w.ch)
      .find(c => c.node && (E.effective(V, c.node, c, c.parent).hidden || c.groups.some(g => E.limits(V, g, null, c.parent).hidden)));
    if (!gone) break;
    r = E.removeSel(r, gone.s.id);
  }
  for (let i = 0; i < 4; i++) {
    const V = E.view(sys, r);
    let changed = false;
    for (const w of V.force.ch) {
      if (!w.node || w.node.type !== 'upgrade') continue;
      for (const g of sys.children(w.node)) {
        if (!g.group) continue;
        const l = E.limits(V, g, null, w);
        if (l.hidden || l.min < 1 || w.ch.some(c => c.s.t.startsWith(g.token + '>'))) continue;
        const kids = sys.children(g).filter(x => !x.group && !E.limits(V, x, null, w).hidden);
        if (kids.length !== 1) continue;
        r = E.chooseInGroup(sys, r, w.s.id, g.token, g.token + '>' + kids[0].token);
        changed = true; break;
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  return r;
}
function apply(fn) {
  let r = fn(ed.army);
  if (!r) return;
  r = autoPick(ed.sys, E.autoSync(ed.sys, r));   // wargear tied to other choices follows, unavailable choices go
  r.limit = ed.army.limit;
  saveWithSummary(ed.sys, Object.assign({}, ed.army, r));
  rerender();
  refreshUnitSheet();
}
/** Swap: one model less in the stack `fromId` (when another model was added to a full group). */
function takeOne(r, fromId) {
  if (!fromId) return r;
  const s = E.findSel(r.sel, fromId);
  if (!s) return r;
  return s.n <= 1 ? E.removeSel(r, fromId) : E.setCount(r, fromId, s.n - 1);
}
function op(b) {
  const { sys } = ed;
  const d = b.dataset;
  switch (d.op) {
    case 'add': return apply(r => takeOne(E.addSel(sys, r, d.p || null, d.t), d.from));
    case 'rm': return apply(r => E.removeSel(r, d.id));
    case 'choose': return apply(r => E.chooseInGroup(sys, r, d.p || null, d.g, d.t));
    case 'split': return apply(r => E.splitSel(r, d.id));
    case 'lead': return apply(r => { const c = JSON.parse(JSON.stringify(r)); const x = E.findSel(c.sel, d.id); if (x) { if (d.to) x.lead = d.to; else delete x.lead; } return c; });
    case 'count': return apply(r => {
      const s = E.findSel(r.sel, d.id);
      if (!s) return r;
      const n = (Number(s.n) || 0) + Number(d.d);
      return takeOne(n <= 0 ? E.removeSel(r, d.id) : E.setCount(r, d.id, n), d.from);
    });
    default: return null;
  }
}

async function onClick(e) {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  if (a === 'arm-op') { e.stopPropagation(); return op(b); }
  if (a === 'arm-cmp') { e.stopPropagation(); return openCompare(b.dataset.p, b.dataset.g); }
  if (a === 'arm-mcmp') { e.stopPropagation(); return openModelCompare(b.dataset.id, b.dataset.cat || ''); }
  if (a === 'arm-mpick') { e.stopPropagation(); ed.modelPick[b.dataset.key] = b.dataset.tok; return refreshUnitSheet(); }
  if (a === 'arm-new') return newArmy();
  if (a === 'arm-open') return lastCtx.nav('#/armies/' + b.dataset.id);
  if (a === 'arm-del') {
    const ar = loadArmy(b.dataset.id);
    if (ar && await confirmSheet({ title: 'Delete army?', text: `“${ar.name}” will be deleted from this device.`, ok: 'Delete', kind: 'danger' })) { deleteArmy(ar.id); rerender(); }
    return;
  }
  if (a === 'arm-dup') {
    const ar = loadArmy(b.dataset.id);
    if (ar) { saveArmy(Object.assign({}, ar, { id: armyId(), name: ar.name + ' (copy)' })); rerender(); }
    return;
  }
  if (a === 'arm-probs') {
    e.stopPropagation();
    const V = E.view(ed.sys, ed.army);
    const owner = V.byId.get(b.dataset.ids);
    const list = problems(V).filter(p => p.sel && owner && rootOf(V, p.sel) === owner);
    sheet({ title: owner ? unitName(V, owner) : 'Problems', body: list.length ? `<ul class="arm-problist">${list.map(p => `<li>${esc(p.msg)}</li>`).join('')}</ul>` : '<p>No problems.</p>', cls: 'arm-probs-sheet', actions: [{ label: 'OK', kind: 'primary' }] });
    return;
  }
  if (a === 'arm-unit') return openUnit(b.dataset.id);
  if (a === 'arm-cfg') { ed.cfgOpen = !ed.cfgOpen; return rerender(); }
  if (a === 'arm-dp' || a === 'arm-dp-auto') {
    const dp = a === 'arm-dp-auto' ? null : Math.max(0, Math.min(9, dpLimitOf(ed.army) + Number(b.dataset.d)));
    saveWithSummary(ed.sys, Object.assign({}, ed.army, { dp }));
    return rerender();
  }
  if (a === 'arm-add') return openAdd();
  if (a === 'arm-rename') {
    const n = await promptSheet({ title: 'Rename army', label: 'Name', value: ed.army.name, ok: 'Save' });
    if (n && n.trim()) { saveArmy(Object.assign({}, ed.army, { name: n.trim() })); ed.army = loadArmy(ed.army.id); rerender(); }
    return;
  }
  if (a === 'arm-problems') {
    const V = E.view(ed.sys, ed.army);
    const probs = problems(V);
    sheet({ title: probs.length ? `${probs.length} problem${probs.length === 1 ? '' : 's'}` : 'No problems', body: probs.length ? `<ul class="arm-problist">${probs.map(p => { const u = p.sel ? rootOf(V, p.sel) : null; return `<li>${u ? `<b>${esc(E.effective(V, u.node, u, u.parent).name)}</b>: ` : ''}${esc(p.msg)}</li>`; }).join('')}</ul>` : '<p>The list is valid.</p>', actions: [{ label: 'Close', kind: 'ghost' }] });
    return;
  }
  if (a === 'arm-text') {
    const txt = armyText(ed.sys, ed.army, { faction: ed.army.catalogueLabel });
    try { await navigator.clipboard.writeText(txt); toast('List copied as text', 'ok'); }
    catch { sheet({ title: 'Army list', body: `<textarea class="arm-textout" rows="14" readonly>${esc(txt)}</textarea>`, actions: [{ label: 'Close', kind: 'ghost' }] }); }
    return;
  }
  if (a === 'arm-size') {
    sheet({
      title: 'Battle size', body: `<div class="chips">${SIZES.map(s => `<button type="button" class="chip${ed.army.limit === s.pts ? ' on' : ''}" data-size="${s.pts}">${esc(s.name)} · ${s.pts} pts</button>`).join('')}</div>`,
      onOpen: (el, close) => el.addEventListener('click', ev => {
        const c = ev.target.closest('[data-size]'); if (!c) return;
        const limit = Number(c.dataset.size);
        saveWithSummary(ed.sys, setBattleSize(ed.sys, Object.assign({}, ed.army, { limit }), limit));
        close(); rerender();
      }),
      actions: [{ label: 'Close', kind: 'ghost' }]
    });
  }
}

/* ═══════════════ Into a game ═══════════════ */
/** Saved armies for the import sheet: [{ id, name, label, points, faction }]. */
export function armyChoices() {
  return listArmies().map(a => ({ id: a.id, name: a.name, label: a.catalogueLabel || a.catalogueName || '', points: (a.summary || {}).points || 0, faction: a.faction, errors: (a.summary || {}).errors || 0 }));
}
/** { text, faction, detachments: [names] } of a saved army – loads its catalogues. */
export async function armyForGame(id) {
  const a = loadArmy(id);
  if (!a) throw new Error('Army not found');
  const sys = await systemFor(a.catalogueId);
  const s = summarize(sys, a);
  return { text: armyText(sys, a, { faction: a.catalogueLabel }), faction: a.faction, detachments: s.detachments, name: a.name, limit: a.limit };
}

/** Lists saved before a fix (or after a data update) are brought in line with the data once when opened. */
function syncOnOpen(sys) {
  try {
    const before = JSON.stringify(ed.army.sel);
    const r = autoPick(sys, E.autoSync(sys, ed.army));
    if (JSON.stringify(r.sel) !== before) saveWithSummary(sys, Object.assign({}, ed.army, { sel: r.sel }));
  } catch (e) { console.warn('sync', e); }
}
