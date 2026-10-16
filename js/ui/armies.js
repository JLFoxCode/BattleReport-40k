/* Army builder ("My armies"), modelled on New Recruit: #/armies = saved lists, #/armies/<id> = editor.
 * Everything comes from the BSData catalogues (js/builder/bs-engine.js): units, model counts, wargear options,
 * enhancements, points and every restriction of the data. Lists are stored on this device (js/builder/store.js). */
import { esc, btn, toast, sheet, confirmSheet, promptSheet, autoNote, whenSheetsSettled } from './components.js';
import { listArmies, loadArmy, saveArmy, deleteArmy, armyId } from '../builder/store.js';
import { playableCatalogues, systemFor, ALLIANCES } from '../builder/load.js';
import * as E from '../builder/bs-engine.js';
import { summarize, armyText } from '../builder/export.js';
import { importArmyFile, importText, switchOn } from '../builder/import.js';
import { loadDatasheets, normName, ALLY_PACKS } from '../data/datasheets.js';
import { datasheetCard, datasheetGroupCard } from './datasheet.js';
import { leaderBuffs } from './player-common.js';
import { leaderTargets } from './player-tabs.js';
import { loadOrig, origDetachment, origDetachmentRule, origEnhancements } from '../data/orig.js';
import { kwList, kwify } from './keywords.js';
import { ruleBoxes, roleSections, roleOf } from './army-book.js';
import { profileChanges } from '../builder/profiles.js';

const dsCache = new Map();   // faction id → datasheet package (or 'loading')

const DP = '82ae-1066-5107-6ae0';
const DP_LIMIT = { 1000: 2, 2000: 3 };
// Detachment Points to buy detachments with: from the data (Incursion 2, or 3 with a 3-DP detachment; Strike Force 3;
// Onslaught 4) unless set by hand (army.dp); without the data loaded: by battle size
const dpLimitOf = a => {
  if (a.dp != null) return Number(a.dp);
  if (ed.sys && a.catalogueId === (ed.army && ed.army.catalogueId)) {
    try { const v = E.rosterMax(E.view(ed.sys, a), DP); if (v != null) return v; } catch {}
  }
  return DP_LIMIT[a.limit] || (Number(a.limit) <= 1000 ? 2 : 3);
};
const sizeName = pts => (SIZES.find(x => x.pts === Number(pts)) || {}).name || 'Custom';
const dpUsed = V => V.force.ch.reduce((x, w) => x + E.totalCost(V, w, DP), 0);
const CAT_ORDER = ['Configuration', 'Epic Hero', 'Character', 'Battleline', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Monster', 'Vehicle', 'Dedicated Transport', 'Fortification'];
const byRole = (a, b) => ((CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99)) || a.localeCompare(b);
// model names of a unit's leader (not a CHARACTER – the one who leads his squad): shown first in the unit
const LEAD_RE = /\b(Sergeant|Superior|Exarch|Watchmaster|Theyn|Hesyr|Shas'(ui|vre)|Sybarite|Acothyst|Hekatrix|Kill-broker|Tempestor|Justicar|Aspiring Champion|Sword Brother|Nob|Pack Leader|Huntmaster|Alpha|Alphus|Champion|Spotter|Fire Coordinator)\b/i;
const HIDE_ROOT = /^(Show\/Hide|Show Legends|Show Unaligned|Show Crucible|Order of Battle|Experience Points|Legendary Veterans|Weapon Modifications)/i;
const SIZES = [{ pts: 1000, name: 'Incursion' }, { pts: 2000, name: 'Strike Force' }];
const NOT_READY = /NOT READY/i;   // placeholder entries of the data: hidden in the choices (the data stays as it is)

let lastRoot = null, lastCtx = null;
const ed = { id: null, army: null, sys: null, loading: false, error: null, openUnit: null, cfgOpen: false, modelPick: {} };

export function render(root, ctx) {
  lastRoot = root; lastCtx = ctx;
  if (!root.__armiesBound) {
    root.__armiesBound = true; root.addEventListener('click', onClick); bindLongPress(root);
    // the chosen detachments' boxes (rule · enhancements · stratagems) stay open across re-renders
    root.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details[data-det]')) { ed.detOpen = ed.detOpen || new Set(); if (d.open) ed.detOpen.add(d.dataset.det); else ed.detOpen.delete(d.dataset.det); } }, true);
  }
  const [id0, mode] = typeof ctx.me === 'string' && ctx.me ? ctx.me.split('/') : [null, null];
  const id = id0 || null;
  ed.mode = mode || null;
  if (!id) { ed.id = null; root.innerHTML = listHtml(); return; }
  if (ed.id !== id) { ed.id = id; ed.army = loadArmy(id); ed.sys = null; ed.error = null; ed.saveOk = null; }
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
  if (ed.mode === 'view') {
    if (!root.__bookBound) {
      root.__bookBound = true;
      root.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details[data-key^="book:"]')) { if (d.open) bookOpenSet.add(d.dataset.key); else bookOpenSet.delete(d.dataset.key); } }, true);
      root.addEventListener('input', e => { if (e.target.matches('[data-book-search]')) { ed.bookQ = e.target.value; bookFilter(root); } });
    }
    root.innerHTML = playHtml();
    bookFilter(root);
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
      <div class="arm-head-act">${btn({ label: '⇩ Import list', kind: 'ghost', small: true, action: 'arm-import' })}${btn({ label: 'New army', kind: 'primary', action: 'arm-new' })}</div>
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

let closeNew = () => {};
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
  const body = `<button type="button" class="arm-import-btn" data-import>⇩ Import from New Recruit <span class="muted xs">text export or roster file (.ros / .rosz)</span></button>
    <label class="field"><span>Name</span><input type="text" name="name" placeholder="e.g. Votann 2000" autocomplete="off"></label>
    <div class="field"><span class="label">Faction</span>
      <div class="seg fac-tabs" role="tablist">${ALLIANCES.map(a => `<button type="button" class="seg-btn${a === alliance ? ' on' : ''}" data-alliance="${esc(a)}" role="tab">${esc(a)}</button>`).join('')}</div>
      <div class="fac-list">${listHtml()}</div></div>
    <div class="field"><span class="label">Battle size</span><div class="chips">${SIZES.map((s, i) => `<label class="chip${i === 1 ? ' on' : ''}"><input type="radio" name="size" value="${s.pts}"${i === 1 ? ' checked' : ''} hidden>${esc(s.name)} · ${s.pts} pts</label>`).join('')}<label class="chip"><input type="radio" name="size" value="custom" hidden>Custom</label></div>
      <input type="number" name="custom" class="arm-custom-in" min="100" step="50" inputmode="numeric" placeholder="Points, e.g. 1500" hidden></div>`;
  sheet({
    title: 'New army', body, cls: 'arm-new-sheet', focus: false,
    onOpen: (el, close) => {
      closeNew = close;
      const sync = () => {
        el.querySelector('.fac-list').innerHTML = listHtml();
        el.querySelectorAll('[data-alliance]').forEach(b => b.classList.toggle('on', b.dataset.alliance === alliance));
        const ok = el.querySelector('[data-sheet-action="1"]');
        if (ok) { ok.disabled = !pick; ok.textContent = pick ? `Create ${pick.label} army` : 'Choose a faction'; }
      };
      el.addEventListener('change', e => {
        if (e.target.name !== 'size') return;
        el.querySelectorAll('.chips .chip').forEach(c => { const i = c.querySelector('input'); if (i) c.classList.toggle('on', i.checked); });
        const cu = el.querySelector('input[name=custom]'); cu.hidden = e.target.value !== 'custom'; if (!cu.hidden) cu.focus();
      });
      el.addEventListener('click', e => {
        if (e.target.closest('[data-import]')) { closeNew(); openImport(); return; }
        const t = e.target.closest('[data-alliance]');
        if (t) { alliance = t.dataset.alliance; sync(); return; }
        const c = e.target.closest('[data-cat]');
        if (c) { pick = cats.find(x => x.id === c.dataset.cat) || null; sync(); }
      });
      sync();
    },
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Choose a faction', kind: 'primary', disabled: true, onClick: (close, el) => {
      if (!pick) return false;
      const sv = (el.querySelector('input[name=size]:checked') || {}).value;
      const limit = sv === 'custom' ? Math.floor(Number(el.querySelector('input[name=custom]').value)) : Number(sv) || 2000;
      if (!(limit >= 100)) { toast('Enter a points limit for the custom game', 'warn'); return false; }
      const name = el.querySelector('input[name=name]').value.trim() || `${pick.label} ${limit}`;
      createArmy(pick, name, limit);   // closes the sheet once the army is saved (it stays open if saving fails)
      return false;
    } }]
  });
}
/** The import report of an army (army.importNotes): what could not be taken over 1:1, grouped by importance. */
function importReportHtml(army) {
  const notes = army.importNotes || [];
  const groups = [
    ['error', 'Not imported', 'These were left out – add them by hand if you need them.'],
    ['warn', 'Different from the list', 'Imported, but not exactly as in the list – please check.'],
    ['rule', 'Rule problems in the imported army', 'The army as imported breaks these rules (state at the import).'],
    ['info', 'Notes', '']
  ];
  const sum = army.summary || {};
  const body = `<p><b>${esc(army.name)}</b> · ${esc(army.catalogueLabel || '')} · ${sum.points || 0} pts</p>
    ${notes.length ? groups.map(([lv, title, sub]) => {
      const list = notes.filter(n => n.level === lv);
      return list.length ? `<div class="imp-grp imp-${lv}"><div class="imp-h">${lv === 'error' ? '✕' : lv === 'info' ? 'ⓘ' : '⚠'} ${esc(title)} <span class="badge">${list.length}</span></div>${sub ? `<p class="muted xs">${esc(sub)}</p>` : ''}<ul class="arm-problist">${list.map(n => `<li>${esc(n.text)}</li>`).join('')}</ul></div>` : '';
    }).join('') : '<p class="text-ok">Everything was imported exactly as in the list.</p>'}`;
  return body;
}
function openImportReport(army, fresh = false) {
  sheet({
    title: fresh ? 'Import done' : 'Import report', cls: 'arm-import-report', body: importReportHtml(army),
    actions: [
      ...((army.importNotes || []).length ? [{ label: 'Hide report', kind: 'ghost', onClick: () => dismissImport(army.id) }] : []),
      { label: 'OK', kind: 'primary' }
    ]
  });
}
/** The import report is no longer needed (it stays reachable in the problems pop-up until then). */
function dismissImport(id = ed.id) {
  const a = id && loadArmy(id);
  if (!a || !a.importNotes) return;
  delete a.importNotes;
  const saved = saveArmy(a);
  if (ed.id === id) { ed.army = saved || a; savedState(!!saved); }
  rerender();
}
/** Import from New Recruit: a file (.txt text export, .ros/.rosz roster) or pasted text → a new army, opened in the editor. */
function openImport(fallbackCat = null) {
  const body = `<p class="small muted">Paste a list – a New Recruit text export, a GW app list or a list copied from Reddit, a forum or a chat – or choose a file (New Recruit <b>.txt</b> or roster <b>.rosz</b>). Units, models, wargear, enhancements and the Warlord are matched by name; the import becomes a new army.${fallbackCat ? ' Without a faction line in the list, the faction of this army is used.' : ''}</p>
    <label class="field"><span>Paste the list</span><textarea name="text" rows="9" placeholder="Paste the army list here" spellcheck="false"></textarea></label>
    <div class="field"><span>or choose a file</span><div class="arm-file-row"><label class="btn ghost small arm-file-btn">Choose file<input type="file" name="file" accept=".txt,.ros,.rosz,text/plain" hidden></label><span class="arm-file-name muted small">No file chosen</span></div></div>`;
  sheet({
    title: 'Import army', body, cls: 'arm-import-sheet wide', focus: false,
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Import', kind: 'primary', onClick: (close, el) => {
      const file = el.querySelector('input[type=file]').files[0];
      const text = el.querySelector('textarea').value;
      if (!file && !text.trim()) { toast('Choose a file or paste the export', 'warn'); return false; }
      toast('Importing …', 'ok', 1500);
      (file ? importArmyFile(file) : importText(text, { catalogueId: fallbackCat })).then(res => {
        const saved = saveWithSummary(res.sys, res.army, { verify: true });
        if (!saved) { toast(SAVE_FAIL, 'bad', 7000); return; }   // the sheet stays open with the pasted list
        close();
        lastCtx.nav('#/armies/' + saved.id);
        whenSheetsSettled(() => openImportReport(saved, true));
      }).catch(err => toast('Import failed: ' + (err && err.message ? err.message : err), 'bad', 6000));
      return false;
    } }]
  });
  // the native file input would show the OS language ("Datei auswählen"): own button, chosen name next to it
  const fi = document.querySelector('.arm-import-sheet input[type=file]');
  const fn = document.querySelector('.arm-import-sheet .arm-file-name');
  if (fi && fn) fi.addEventListener('change', () => { fn.textContent = fi.files && fi.files[0] ? fi.files[0].name : 'No file chosen'; });
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
  // Chaos Daemons: the units of the four gods are behind Show/Hide switches in the data – on for a Daemons army
  if (/Chaos Daemons/i.test(cat.label || cat.name || '')) r = switchOn(sys, r, /^Show (Khorne|Nurgle|Slaanesh|Tzeentch) Daemons$/i);
  // not stored: no editor for a list that does not exist ("Army not found")
  if (!saveWithSummary(sys, r, { verify: true })) { toast(SAVE_FAIL, 'bad', 7000); return false; }
  closeNew();
  lastCtx.nav('#/armies/' + r.id);
  return true;
}
const SAVE_FAIL = 'Could not save the army on this device (storage full or blocked) – nothing was created.';
function setBattleSize(sys, r, limit) {
  const V = E.view(sys, r);
  const bs = V.force.ch.find(w => w.node && w.node.name === 'Battle Size');
  if (!bs) return Object.assign({}, r, { limit });
  const g = sys.children(bs.node).find(k => k.group && k.name === 'Battle Size');
  // a custom size uses the rules of the nearest standard size (up to 1000 pts Incursion, above Strike Force)
  const std = limit <= 1000 ? 1000 : 2000;
  const opt = g && sys.children(g).find(o => new RegExp('\\(' + std + ' Point').test(o.name));
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
// the data's "Show/Hide Options" entry is a unit only in form: its switches live in the configuration panel
const isUnitSel = w => w.node && (w.node.type === 'unit' || w.node.type === 'model') && !/^Show\/Hide Options$/i.test(w.node.name);
/** The unit's own converted datasheet – exact (normalised) name only: a fuzzy match would show another unit's
 *  card and LEADER list (Land Raider Excelsior → Land Raider, Chaos Lord → Lord of Change). No datasheet → null. */
const sheetIndex = new WeakMap();
function sheetOf(pack, name) {
  if (!pack || !name) return null;
  let idx = sheetIndex.get(pack);
  if (!idx) {
    idx = new Map();
    for (const u of pack.units || []) { const k = normName(u.name); if (k && !idx.has(k)) idx.set(k, u); }
    sheetIndex.set(pack, idx);
  }
  return idx.get(normName(name)) || null;
}
const leadersOf = (V, b) => V.force.ch.filter(x => x.s.lead === b.s.id && isUnitSel(x));
const plainText = s => String(s || '').replace(/[*^]/g, '');
const allText = x => { const o = []; (function f(y) { if (typeof y === 'string') o.push(y); else if (y && typeof y === 'object') Object.values(y).forEach(f); })(x); return plainText(o.join('\n')); };
/** Does unit `x` carry the keyword (or name) `kw` ("COMMAND SQUAD", "WARLOCKS", "Yvraine")? */
function hasKeyword(V, x, kw, pack) {
  const k = normName(kw), ds = sheetOf(pack, unitName(V, x));
  return !!k && (normName(unitName(V, x)) === k || (ds && (ds.keywords || []).some(t => normName(t) === k)));
}
/** Why the leaders `ls` may not all lead the bodyguard `b`, '' if they may. Core rules: one Leader unit per bodyguard
 *  unit unless a datasheet says otherwise – the bodyguard's own text ("up to two Leader units … no more than one of those
 *  units is a COMMAND SQUAD unit", "Starting Strength of 20 … not duplicates") or the leader's ("… even if one WARLOCKS
 *  unit has already been attached to it"). */
function leaderLimit(V, b, all, pack) {
  if (all.length < 2 || !pack) return '';
  // core rules 24.22: one Leader unit AND one Support unit – the support unit does not count as a leader
  const sup = all.filter(x => (attachRule(sheetOf(pack, unitName(V, x))) || {}).kind === 'support'), ls = all.filter(x => !sup.includes(x));
  if (sup.length > 2 || (sup.length === 2 && !evenIf(V, sup[0], sup[1], pack) && !evenIf(V, sup[1], sup[0], pack))) return `Supported by ${sup.map(x => unitName(V, x)).join(', ')} – a bodyguard unit can only have one Support unit attached`;
  if (ls.length < 2) return '';
  const head = `Led by ${ls.map(x => unitName(V, x)).join(', ')} – `;   // the problem list names the unit itself
  const bt = allText((sheetOf(pack, unitName(V, b)) || {}).abilities);
  const up = /up to (two|three|four|\d+) Leader units/i.exec(bt), ss = /Starting Strength of (\d+)/i.exec(bt);
  const max = up && (!ss || countModels(b) >= +ss[1]) ? ({ two: 2, three: 3, four: 4 }[up[1].toLowerCase()] || +up[1]) : 1;
  if (max > 1) {
    if (ls.length > max) return head + `at most ${max} Leader units can be attached`;
    const one = /no more than one of those units is an? (.+?) unit/i.exec(bt);
    if (one && ls.filter(x => hasKeyword(V, x, one[1], pack)).length > 1) return head + `no more than one of them can be a ${one[1].trim().toUpperCase()} unit`;
    if (/not duplicates/i.test(bt) && new Set(ls.map(x => normName(unitName(V, x)))).size < ls.length) return head + 'the Leader units must not be duplicates';
    return '';
  }
  if (ls.length === 2 && (evenIf(V, ls[0], ls[1], pack) || evenIf(V, ls[1], ls[0], pack))) return '';
  return head + 'a bodyguard unit can only have one Leader unit attached';
}
/** May `a` join a bodyguard unit that `o` has already joined? Its LEADER / SUPPORT names `o` in alsoWith (Locus: "even if a
 *  PRIMUS, MAGUS, or ACOLYTE ICONWARD model has already been attached") or in its "even if … has already been attached" text. */
function evenIf(V, a, o, pack) {
  const s = sheetOf(pack, unitName(V, a)) || {};
  const aw = [...((s.leader || {}).alsoWith || []), ...((s.support || {}).alsoWith || [])];
  if (aw.some(k => hasKeyword(V, o, k, pack))) return true;
  const e = /even if (?:one |an? )?(.+?) (?:unit |model )?has already been attached/i.exec(plainText((s.leader || s.support || {}).text));
  return !!e && hasKeyword(V, o, e[1], pack);
}
/** Units an enhancement of `w` lets it lead as well (detachment enhancements' `leads`: Kill Kommanda → Kommandos). */
function enhLeads(V, w, pack) {
  const mine = new Set(w.ch.filter(c => c.node && c.groups.some(g => /Enhancement/i.test(g.name))).map(c => normName(unitName(V, c))));
  if (!mine.size || !pack) return [];
  return (pack.detachments || []).flatMap(d => d.enhancements || []).filter(e => (e.leads || []).length && mine.has(normName(e.name))).flatMap(e => e.leads);
}
/** How a unit joins a bodyguard unit: { kind: 'leader' | 'support', names: [normalised bodyguard names] } from its
 *  datasheet's LEADER or SUPPORT ("This model can be attached to the following units: …"), null if it does not. */
function attachRule(ds) {
  const kind = ds && (ds.leader ? 'leader' : ds.support ? 'support' : null);
  if (!kind) return null;
  const l = ds[kind];
  return { kind, names: (l.canLead || []).length ? l.canLead.map(normName) : leaderTargets({ leader: l }) };
}
/** Units of the list the leader / support unit `w` may join (datasheet LEADER / SUPPORT: attached to the following units …). */
function leaderCands(V, w, pack) {
  if (!pack) return null;
  const sheet = n => sheetOf(pack, n);
  const own = attachRule(sheet(unitName(V, w))), extra = enhLeads(V, w, pack);
  if (!own && !extra.length) return null;
  // an enhancement may add a unit to the LEADER list (or make a character a leader of just that unit)
  const rule = own || { kind: 'leader', names: [] };
  const allowed = new Set(own && !rule.names.length ? [] : [...rule.names, ...extra].map(tight));
  return V.force.ch.filter(x => x !== w && isUnitSel(x) && !attachRule(sheet(unitName(V, x))) && (!allowed.size || canJoin(allowed, unitName(V, x), sheet(unitName(V, x)))));
}
/* A LEADER / SUPPORT list names datasheets by their keyword (core rules 19.01): "Acolyte Hybrids" takes both "Acolyte
   Hybrids with Autopistols" and "… with Hand Flamers" (keyword ACOLYTE HYBRIDS); spaces do not matter ("HANDFLAMERS"). */
const tight = s => normName(s).replace(/[^a-z0-9]/g, '');
function canJoin(allowed, name, ds) {
  return [name, ds && ds.name, ...((ds && ds.keywords) || [])].some(n => n && allowed.has(tight(n)));
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
  // one enhancement per unit (core rules) – also when they come from two detachments' enhancement groups, which the
  // data's per-group limits do not catch; detachment "Upgrades" are no enhancements
  for (const w of V.force.ch) {
    if (!isUnitSel(w)) continue;
    const enh = [];
    (function f(x) { for (const c of x.ch) { if (!c.node) continue; if (c.groups.some(g => /Enhancement/i.test(g.name))) { if (!c.groups.some(g => /Upgrade/i.test(g.name) && !/Enhancement/i.test(g.name)) && !/Upgrade/i.test(c.node.name)) enh.push(c); } else f(c); } })(w);
    if (enh.length > 1 && !out.some(p => p.sel && rootOf(V, p.sel) === w && /enhancement/i.test(p.msg)))
      out.push({ sel: w.s.id, msg: `${enh.length} enhancements (${enh.map(c => unitName(V, c)).join(', ')}) – a unit can only have one enhancement` });
  }
  // leaders: how many may join one bodyguard unit (datasheets of the army's faction, once loaded)
  const pack = dsCache.get((V.roster && V.roster.faction) || (ed.army && ed.army.faction));
  if (pack && typeof pack === 'object') for (const b of V.force.ch) {
    const why = isUnitSel(b) ? leaderLimit(V, b, leadersOf(V, b), pack) : '';
    if (why) out.push({ sel: b.s.id, msg: why });
    // core rules 25.04: each support unit must be attached to a bodyguard unit
    if (isUnitSel(b) && !(b.s.lead && V.byId.get(b.s.lead)) && (attachRule(sheetOf(pack, unitName(V, b))) || {}).kind === 'support')
      out.push({ sel: b.s.id, msg: 'Support unit not attached – each support unit must be attached to a bodyguard unit' });
  }
  return out;
}
function saveWithSummary(sys, r, opt = {}) {
  try { r = Object.assign({}, r, { sel: E.nameSels(sys, r).sel }); } catch {}   // names kept for later data updates
  const V = E.view(sys, r);
  const s = summarize(sys, r);
  r.summary = { points: E.totalPoints(V), errors: problems(V).length, detachments: s.detachments, size: s.size };
  const saved = saveArmy(r, opt);
  // not stored: the editor keeps the change in memory (nothing is lost while it stays open) and says so in its bar
  if (ed.id === r.id) { ed.army = saved || Object.assign({}, r); savedState(!!saved); }
  return saved;
}
/** The "Saved" mark in the editor bar (there is no Save button: every change is stored on this device right away). */
function savedState(ok) {
  const was = ed.saveOk;
  ed.saveOk = ok;
  if (!ok && was !== false) toast('Could not save the army on this device – your changes are kept while the editor stays open. Free some storage and try again.', 'bad', 7000);
  // a short flash after each save (the editor re-renders right after a change – the flag carries it over)
  clearTimeout(savedState.t);
  ed.saveFlash = ok;
  if (ok) savedState.t = setTimeout(() => { ed.saveFlash = false; }, 600);
  const el = document.querySelector('.arm-saved');
  if (el) el.outerHTML = savedHtml();
}
const savedHtml = () => (ed.saveOk === false
  ? '<button type="button" class="arm-saved bad" data-action="arm-resave" title="Not saved – tap to try again">⚠ Not saved</button>'
  : `<span class="arm-saved${ed.saveFlash ? ' flash' : ''}" title="Every change is saved on this device automatically" aria-live="polite">✓ Saved</span>`);
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
    if (!w.node || /^Show\/Hide Options$/i.test(w.node.name)) continue;   // its switches are in the configuration panel
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
      <div class="arm-total-box"><div class="arm-total${over ? ' bad' : ''}"><b>${pts}</b><small>/ ${esc(army.limit || '–')} pts</small></div>${savedHtml()}</div>
      <button type="button" class="arm-prob ${probs.length ? 'warn' : 'ok'}" data-action="arm-problems" aria-label="Problems">${probs.length ? '⚠ ' + probs.length : '✓'}</button>
    </header>
    ${viewToggle(army.id, false)}
    ${armyRulesHtml()}
    ${(() => { const loose = looseLeaders(V, dsPack()); return loose.length ? `<div class="arm-lead-info">ⓘ ${loose.length === 1 ? '1 leader is' : loose.length + ' leaders are'} not attached to a unit yet: ${loose.map(w => `<button type="button" class="arm-link" data-action="arm-unit" data-id="${esc(w.s.id)}">${esc(unitName(V, w))}</button>`).join(', ')}</div>` : ''; })()}
    ${order.map(c => c === 'Configuration' ? configHtml(V, groups.get(c), byUnit) : `
      <section class="arm-sec">
        <div class="arm-sec-h">${esc(c)}</div>
        ${groups.get(c).map(w => unitRow(V, w, byUnit.get(w.s.id) || [])).join('')}
      </section>`).join('')}
    <div class="arm-add">${btn({ label: '+ Add unit', kind: 'primary', cta: true, action: 'arm-add' })}</div>
    <div class="arm-foot row">
      ${btn({ label: 'Copy as text', kind: 'ghost', small: true, action: 'arm-text' })}
      ${btn({ label: '⇩ Import list', kind: 'ghost', small: true, action: 'arm-import' })}
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
      return `<div class="arm-cfg${probs.length ? ' has-prob' : ''}" data-cfg="${esc(w.s.id)}"><div class="arm-cfg-h">${esc(E.effective(V, w.node, w, w.parent).name)}${probs.length ? `<button type="button" class="arm-tri" data-action="arm-probs" data-ids="${esc(w.s.id)}" aria-label="Show problems" title="Show problems">⚠</button>` : ''}</div>
        ${/^Detachments?$/.test(w.node.name) ? dpRow(V) + `<div class="arm-det-cmp"><button type="button" class="arm-cmp" data-action="arm-detcmp" data-id="${esc(w.s.id)}">All detachments: rules, enhancements, stratagems</button></div>` : ''}
        ${/^Code Chivalric$/i.test(w.node.name) ? '<div class="muted xs arm-cfg-note">The Oath (one Deed and one Quality) is chosen or rolled at the start of the battle – in the game under “Active effects”.</div>' : ''}
        ${optionsHtml(V, w, true)}
        ${/^Detachments?$/.test(w.node.name) ? chosenDetsHtml(V, w) : ''}
        </div>`;
    }).join('')}
    ${showHideHtml(V)}
  </section>`;
}

/** Opens the army configuration and scrolls to one of its entries (from the problems list). */
function jumpToConfig(id) {
  ed.cfgOpen = true;
  rerender();
  const root = lastRoot;
  const el = root && ((id && root.querySelector(`.arm-cfg[data-cfg="${CSS.escape(id)}"]`)) || root.querySelector('.arm-config'));
  if (!el) return;
  try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { el.scrollIntoView(); }
  el.classList.remove('arm-jumped'); void el.offsetWidth; el.classList.add('arm-jumped');
}

/* "Show/Hide Options" of the data: switches that make more units selectable (Chaos Daemons' four gods, Legends,
   allies such as Imperial Knights or Agents of the Imperium …) – the same switches New Recruit offers. */
function showHideRoot(V) {
  return ed.sys.rootNodes(ed.army.catalogueId).find(n => /^Show\/Hide Options$/i.test(n.name) && !E.limits(V, n, null, V.force).hidden && ed.sys.children(n).some(k => !k.group));
}
function showHideHtml(V) {
  const root = showHideRoot(V);
  if (!root) return '';
  const w = V.force.ch.find(x => x.node === root || (x.node && x.node.token === root.token));
  const kids = ed.sys.children(root).filter(k => !k.group && !E.limits(V, k, null, w || V.force).hidden);
  if (!kids.length) return '';
  return `<div class="arm-cfg arm-showhide"><div class="arm-cfg-h">Show units</div>
    <div class="muted xs">Switches from the data: which further units can be selected (e.g. Legends, allies).</div>
    <div class="arm-choices">${kids.map(k => {
      const on = w && w.ch.some(c => c.s.t === k.token);
      return `<button type="button" class="arm-check${on ? ' on' : ''}" data-action="arm-show" data-t="${esc(k.token)}"><span class="arm-box" aria-hidden="true">${on ? '✓' : ''}</span><span>${esc(k.name.replace(/^Show\s+/i, ''))}</span></button>`;
    }).join('')}</div></div>`;
}
/** Switch one Show/Hide option on/off (adds the Show/Hide entry when needed, removes it when empty). */
function toggleShow(t) {
  apply(r => {
    const V = E.view(ed.sys, r);
    const root = showHideRoot(V);
    if (!root) return null;
    let w = V.force.ch.find(x => x.node && x.node.token === root.token);
    if (!w) {
      // the entry comes with the data's default switches (Legends, Titans …): a switch among them is on now – done
      r = E.addSel(ed.sys, r, null, root.token); w = E.view(ed.sys, r).force.ch.find(x => x.node && x.node.token === root.token);
      if (w && w.ch.some(c => c.s.t === t)) return r;
    }
    const on = w.ch.find(c => c.s.t === t);
    if (on) { r = E.removeSel(r, on.s.id); if (w.ch.length === 1) r = E.removeSel(r, w.s.id); }
    else r = E.addSel(ed.sys, r, w.s.id, t);
    return r;
  });
}

function dpRow(V) {
  const used = dpUsed(V), lim = dpLimitOf(ed.army), auto = ed.army.dp == null;
  return `<div class="arm-dp${used > lim ? ' bad' : ''}">
    <div class="arm-dp-main"><span class="arm-dp-val"><b>${used}</b> / ${lim} DP</span><span class="muted xs">${auto ? sizeName(ed.army.limit) + (sizeName(ed.army.limit) === 'Custom' ? ' ' + ed.army.limit + ' pts' : '') + ': ' + lim + ' Detachment Points' : 'Set by hand'}</span></div>
    <div class="stepper sm"><button type="button" data-action="arm-dp" data-d="-1"${lim <= 0 ? ' disabled' : ''} aria-label="Fewer Detachment Points">−</button><span class="stepper-value">${lim}</span><button type="button" data-action="arm-dp" data-d="1"${lim >= 9 ? ' disabled' : ''} aria-label="More Detachment Points">+</button></div>
    ${auto ? '' : `<button type="button" class="chip sm" data-action="arm-dp-auto">By battle size</button>`}
    <div class="muted xs arm-dp-help">Detachment Points (DP): every detachment costs DP (shown next to it); the battle size sets how many you can spend – Incursion 2, Strike Force 3.</div>
  </div>`;
}

/** Why a detachment option does not fit: "needs 3 DP – 2 left (Incursion)", '' if it fits (or costs no DP). With the
 *  limit from the data, the option is tried on a copy – the data may raise the limit for it (Incursion: 3 DP for a
 *  single 3-DP detachment). */
function dpShort(V, x, pw, t) {
  const d = E.nodeCost(V, x, null, pw, DP);
  if (!d || !pw || pw.kind !== 'sel') return '';
  const used = dpUsed(V), lim = dpLimitOf(ed.army);
  if (used + d <= lim) return '';
  if (ed.army.dp == null) {
    try {
      const V2 = E.view(ed.sys, E.addSel(ed.sys, ed.army, pw.s.id, t));
      const lim2 = E.rosterMax(V2, DP);
      if (lim2 != null && dpUsed(V2) <= lim2) return '';
    } catch {}
  }
  const size = ed.army.dp == null ? ` (${sizeName(ed.army.limit)})` : '';
  return `needs ${d} DP – ${Math.max(0, lim - used)} of ${lim} left${size}`;
}

/** The faction's army rule(s) on top, collapsed – to read again at any time. */
function armyRulesHtml() {
  const pack = dsPack();
  const rules = (pack && pack.armyRules) || [];
  if (!rules.length) return '';
  const rich = t => kwify(esc(String(t || '').replace(/\^\^/g, '').replace(/\*\*/g, ''))).replace(/\n/g, '<br>');
  return `<details class="arm-rules"${ed.rulesOpen ? ' open' : ''}><summary><span class="arm-sec-h">Army rules</span><span class="arm-rules-names">${esc(rules.map(r => r.name).join(' · '))}</span></summary>
    <div class="arm-rules-body">${rules.map(r => `<div class="det-rule"><b>${esc(r.name)}:</b> ${rich(r.text)}</div>`).join('')}</div></details>`;
}

/* ───────── Detachments side by side: rule, enhancements and stratagems of each one (tap = take / drop) ───────── */
/** Rule, enhancements and stratagems of a detachment (original texts: Wahapedia; BSData / New Recruit as fallback). */
function detParts(name, orig, pack) {
  const od = orig ? origDetachment(orig, name) : null;
  const bsd = pack && pack.detachments ? pack.detachments.find(d => normName(d.name) === normName(name)) : null;
  const r = orig ? origDetachmentRule(orig, name) : [];
  const e = orig ? origEnhancements(orig, name) : [];
  return {
    rules: r.length ? r : ((od && od.rule) || (bsd && bsd.rules) || []),
    enh: e.length ? e : ((bsd && bsd.enhancements) || []),
    strats: od && od.stratagems ? Object.values(od.stratagems) : []
  };
}
// BSData markup: ^^**KEYWORD**^^ is a keyword (UPPERCASE, as on the cards), <ins>…</ins> is emphasis only
const richText = t => kwify(esc(String(t || '').replace(/<\/?ins>/gi, '').replace(/\^\^\*\*(.+?)\*\*\^\^/g, (_, k) => k.toUpperCase()).replace(/\^\^/g, '').replace(/\*\*/g, ''))).replace(/\n/g, '<br>');
function stratItem(st) {
  return `<div class="det-item det-strat"><div><b>${esc(st.name)}</b> <span class="badge num cp">${esc(st.costText || (st.cost + 'CP'))}</span>${st.category ? ` <span class="muted xs">${esc(st.category)}</span>` : ''}</div>
    ${st.when ? `<div><b class="xs">WHEN</b> ${richText(st.when)}</div>` : ''}${st.target ? `<div><b class="xs">TARGET</b> ${richText(st.target)}</div>` : ''}${st.effect ? `<div><b class="xs">EFFECT</b> ${richText(st.effect)}</div>` : ''}${st.restrictions ? `<div><b class="xs">RESTRICTIONS</b> ${richText(st.restrictions)}</div>` : ''}</div>`;
}
/** The three parts as collapsible sections – the names visible while closed. */
function detPartsHtml(p) {
  const sec = (title, list, body) => list.length ? `<details class="det-sec"><summary><b>${esc(title)} (${list.length})</b> <span class="det-names">${esc(list.map(x => x.name).join(' · '))}</span></summary>${body}</details>` : '';
  return (p.rules.map(r => `<div class="det-rule"><b>${esc(r.name)}:</b> ${richText(r.text)}</div>`).join('') || '<p class="muted xs">Rule not in the data.</p>')
    + sec('Enhancements', p.enh, p.enh.map(e => `<div class="det-item"><b>${esc(e.name)}${e.cost ? ` (${esc(e.cost)} pts)` : ''}:</b> ${richText(e.text)}</div>`).join(''))
    + (p.strats.length ? sec('Stratagems', p.strats, p.strats.map(stratItem).join('')) : '<p class="muted xs">Stratagems: not in the data for this detachment.</p>');
}
const detOrig = new Map();   // faction → original texts (or 'loading')
/** Under the detachment choice: what the chosen detachment(s) unlock. */
function chosenDetsHtml(V, w) {
  const fid = ed.army.faction;
  let orig = fid ? detOrig.get(fid) : null;
  if (fid && orig === undefined) { detOrig.set(fid, 'loading'); loadOrig(fid).then(o => detOrig.set(fid, o || null)).catch(() => detOrig.set(fid, null)).then(rerender); }
  if (orig === 'loading') orig = null;
  const chosen = w.ch.filter(c => c.node).map(c => E.effective(V, c.node, c, w).name);
  if (!chosen.length) return '<p class="muted xs arm-det-none">Choose a detachment – its rule, enhancements and stratagems then show here.</p>';
  return `<div class="arm-det-chosen">${chosen.map(name => `<details class="arm-det-box"${(ed.detOpen || new Set()).has(name) ? ' open' : ''} data-det="${esc(name)}"><summary><span class="arm-sec-h">${esc(name)}</span> <span class="muted xs">rule · enhancements · stratagems</span></summary><div class="det-body">${detPartsHtml(detParts(name, orig, dsPack()))}</div></details>`).join('')}</div>`;
}
async function openDetCompare(detSelId) {
  const fid = ed.army.faction;
  let orig = null;
  try { orig = fid ? await loadOrig(fid) : null; } catch {}
  const pack = dsPack();
  const sys = ed.sys;
  const build = () => {
    const V = E.view(sys, ed.army);
    const w = V.byId.get(detSelId);
    if (!w) return '<p class="muted">No detachment choice in this army.</p>';
    const g = sys.children(w.node).find(k => k.group);
    if (!g) return '';
    const kids = sys.children(g).filter(x => !E.limits(V, x, null, w).hidden && (!NOT_READY.test(x.name) || w.ch.some(c => c.s.t === g.token + '>' + x.token)));
    const rich = t => kwify(esc(String(t || '').replace(/\^\^/g, '').replace(/\*\*/g, ''))).replace(/\n/g, '<br>');
    return `<p class="muted xs">${dpUsed(V)} / ${dpLimitOf(ed.army)} Detachment Points (DP) used – every detachment costs DP, the battle size sets how many you can spend. Tap a detachment to take it or drop it; open the sections to read everything.</p>` + kids.map(x => {
      const t = g.token + '>' + x.token;
      const on = w.ch.find(c => c.s.t === t);
      const name = E.limits(V, x, on || null, w).name;
      const dp = E.nodeCost(V, x, on || null, w, DP);
      const parts = detParts(name, orig, pack);
      const why = on ? '' : dpShort(V, x, w, t);
      return `<div class="cmp-opt det-opt${on ? ' on' : ''}${why ? ' arm-dp-over' : ''}" style="--oc:${optColor('det', t)}">
        <div class="cmp-opt-h" role="button" tabindex="0" data-dtok="${esc(t)}"><span class="arm-dot" aria-hidden="true"></span><b>${esc(name)}</b> <span class="arm-cost arm-dpc">${dp} DP</span>${on ? ' <span class="badge ok">chosen</span>' : why ? `<span class="cmp-pick arm-why">${esc(why)}</span>` : '<span class="cmp-pick">Tap to take</span>'}</div>
        <div class="det-body">
          ${detPartsHtml(parts)}
        </div></div>`;
    }).join('');
  };
  sheet({
    title: 'Detachments', body: build(), cls: 'arm-cmp-sheet wide',
    onOpen: el => el.addEventListener('click', e => {
      const h = e.target.closest('[data-dtok]');
      if (!h) return;
      const V = E.view(sys, ed.army), w = V.byId.get(detSelId);
      if (!w) return;
      const on = w.ch.find(c => c.s.t === h.dataset.dtok);
      apply(r => (on ? E.removeSel(r, on.s.id) : E.addSel(sys, r, detSelId, h.dataset.dtok)));
      const body = el.querySelector('.sheet-body'), top = body.scrollTop;
      body.innerHTML = build();
      body.scrollTop = top;
    }),
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
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
  E.profilesOf(sys, node).forEach(add);   // own, infoLink and info-group profiles
  if (depth < 3) for (const k of sys.children(node)) {
    if (k.group) continue;
    const min = k.constraints.filter(c => c.type === 'min' && c.field === 'selections' && c.scope === 'parent').reduce((x, c) => Math.max(x, Number(c.value) || 0), 0);
    if (min > 0) out.push(...weaponsOf(k, n * min, depth + 1));
  }
  return out;
}
/** Weapon name as the converted datasheets have it ("➤ Plasma pistol - standard" → "Plasma pistol"). */
const weaponBase = s => { const t = String(s || '').replace(/\s*\[Legends\]\s*/ig, ' ').replace(/\s+/g, ' ').trim(); const m = /^➤\s*(.+?)\s+[-–]\s+(.+)$/.exec(t); return m ? m[1].trim() : t.replace(/^➤\s*/, ''); };
/** Wargear of a list unit for its datasheet card: every chosen selection – also inside containers ("Pistol,
 *  Master-crafted Bolter & Melee Weapon" → its chosen pistol and melee weapon) – by the weapon profiles it carries
 *  itself or through infoLinks ("2 Heavy Bolters" → Heavy bolter ×2, "Bolt Pistol and Boltgun" → both, "Force weapon" →
 *  "Force weapon [Psychic]"); a selection without weapon profiles by its own name (Storm shield …), plus its ability
 *  profiles (wargear abilities). Counts multiply down the tree (models × per model). */
function wargearOf(V, w) {
  const out = [];
  const take = (x, n) => {
    const ws = [...new Set(weaponsOf(x.node, 1, 3).map(p => weaponBase(p.name)))];
    const per = x.node.type === 'model' ? 1 : Number((/^(\d+)\s*x?\s+\S/i.exec(unitName(V, x)) || [])[1]) || 1;
    ws.forEach(name => out.push({ name, count: n * per }));
    if (x === w || x.node.type === 'model') return;
    if (!ws.length) out.push({ name: unitName(V, x), count: n });
    effectsOf(x.node, 2).forEach(e => out.push({ name: e.name, count: n }));
  };
  take(w, 1);
  (function walk(x, mult) {
    for (const c of x.ch) {
      if (!c.node || c.groups.some(g => /Enhancement/i.test(g.name)) || /^Warlord$/i.test(c.node.name)) continue;
      const n = mult * (c.n || 1);
      take(c, n);
      walk(c, n);
    }
  })(w, 1);
  return out;
}
/** Effects a piece of wargear brings (BSData "Abilities" profiles, also linked ones): [{ name, text }]. */
function effectsOf(node, depth = 0) {
  const sys = ed.sys, out = [];
  // abilities, and other described profiles of the data (Imperial Knights Oath: Deed / Quality with their D6 result,
  // Aeldari Battle Focus …) – not weapons or unit profiles
  const add = p => {
    if (!p || /Weapons|^Unit$|^Transport$/i.test(p.typeName || '')) return;
    const d = (p.characteristics || []).find(c => /Description/i.test(c.name));
    if (!d || !d.$text) return;
    const own = /Abilities/i.test(p.typeName || '');
    const extra = (p.characteristics || []).filter(c => c !== d && c.$text).map(c => `${c.name}: ${c.$text}`).join(' · ');
    out.push({ name: (own ? '' : p.typeName + ' – ') + p.name, text: String(d.$text).replace(/\^\^/g, '').replace(/\*\*/g, '') + (extra ? ` (${extra})` : '') });
  };
  node.profiles.forEach(add);
  for (const l of node.infoLinks) { const t = sys.idx.get(l.targetId); if (t && l.type === 'profile') add(t); }
  if (depth < 2) for (const k of sys.children(node)) {
    if (k.group) continue;
    const min = k.constraints.filter(c => c.type === 'min' && c.field === 'selections' && c.scope === 'parent').reduce((x, c) => Math.max(x, Number(c.value) || 0), 0);
    if (min > 0) out.push(...effectsOf(k, depth + 1));
  }
  // one effect once: an option's own profile and the shared entry inside it can both carry it with different texts
  // ("…and 1 Relic Shield": "Wounds characteristic of 6" + the shared Relic Shield's "Add 1 to … Wounds") – the
  // option's own (found first) is the one for this option
  const seen = new Set();
  return out.filter(e => { const k = e.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** What a bundle option holds when it brings no profile itself ("Pistol and Melee Weapon"): its parts, each choice with
 *  its options – [{ name, opts: [names] }]. */
function bundleOf(x) {
  const out = [];
  for (const k of ed.sys.children(x)) {
    if (/^(Crusade\b|Weapon Modifications|Weapon Upgrades)/i.test(k.name)) continue;
    if (k.group) {
      const opts = ed.sys.children(k).filter(o => !o.group).map(o => o.name);
      if (opts.length) out.push({ name: k.name, opts });
    } else out.push({ name: k.name, opts: [] });
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
      ${(() => {
        const fx = effectsOf(x);
        if (fx.length) return `<div class="cmp-fx">${effectHtml(fx)}</div>`;
        if (ws.length) return '';
        // a bundle ("Pistol and Melee Weapon"): its parts, and the weapons it can hold
        const parts = bundleOf(x);
        if (!parts.length) return '<p class="muted xs">No profile in the data.</p>';
        const seen = new Set();
        const inner = sys.children(x).flatMap(k => (k.group ? sys.children(k).filter(o => !o.group) : [k])).flatMap(o => weaponsOf(o)).filter(w0 => { const k0 = w0.name + '|' + w0.ch.Range + '|' + w0.ch.S; if (seen.has(k0)) return false; seen.add(k0); return true; });
        return `<div class="cmp-fx cmp-bundle">${parts.map(p => `<div><b>${esc(p.name)}</b>${p.opts.length ? ` – choose: ${esc(p.opts.join(' / '))}` : ''}</div>`).join('')}</div>`
          + (inner.length ? `<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th>Weapon</th><th>Range</th><th>A</th><th>BS/WS</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${inner.map(w0 => row(Object.assign({}, w0, { n: 1 }), color)).join('')}</tbody></table></div>` : '');
      })()}
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
          // one option of a single choice: done – back to the unit, which shows the new wargear
          if (!on) { close(); return; }
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
  // room left in the enclosing groups ("Support Systems (1-4)"): no '+' beyond it
  const capRoom = Math.min(Infinity, ...caps.map(c => c.max - c.total));
  const each = pw.kind === 'sel' && pw.node && pw.node.type === 'model' && pw.n > 1 ? pw.n : 0;
  const eachTag = each ? ` <span class="arm-each">each of the ${each}</span>` : '';
  /* Head count: a model can be added while the entry and every enclosing group (e.g. the unit's 10 models AND the
     heavy weapons' 2) have room; if only a group both models share is full, it can be swapped in for another model. */
  const roomFor = (tok, lim, sels) => {
    const own = lim.max < 0 ? Infinity : lim.max - sels.reduce((x, c) => x + c.n, 0);
    const room = Math.min(own, ...caps.map(c => c.max - c.total));
    if (room > 0) { const src = replaces(tok, lim, sels); return src ? { add: false, swap: src } : { add: true }; }
    if (own <= 0) return { add: false };
    // the model that gives way: never one from a group that still has room (a second special weapon swaps a plain trooper,
    // not the first special weapon); then one of the same category (standard for standard, heavy for heavy), the biggest group
    const par = t => t.split('>').slice(0, -1).join('>');
    const inRoomy = x => caps.filter(c => c.max - c.total > 0 && tok.startsWith(c.tok + '>') && x.s.t.startsWith(c.tok + '>')).length;
    const srcs = (pw.ch || []).filter(x => x.node && x.node.type === 'model' && !sels.includes(x) && x.n > E.limits(V, x.node, x, pw).min)
      .sort((p, q) => (inRoomy(p) - inRoomy(q)) || ((par(q.s.t) === par(tok)) - (par(p.s.t) === par(tok))) || q.n - p.n);
    const src = srcs.find(x => caps.every(c => c.max - c.total > 0 || (x.s.t.startsWith(c.tok + '>') && tok.startsWith(c.tok + '>'))));
    return src ? { add: false, swap: src } : { add: false };
  };
  /* A special model type replaces a standard one even while the unit has room ("1 Rubric Marine's inferno boltgun can be
     replaced with 1 soulreaper cannon"): (a) the data lowers another model type's maximum when it comes in (Skitarii
     Rangers: one galvanic rifle less per special weapon), or (b) it has a maximum of its own below that of a standard
     model type of the same unit composition group (Intercessor w/ grenade launcher, Scarab Occult heavy weapons). The unit
     grows with the standard model's '+'. Returns the stack that gives one model, or null. */
  const replaces = (tok, lim, sels) => {
    if (!pid) return null;
    const models = (pw.ch || []).filter(x => x.node && x.node.type === 'model' && !sels.includes(x) && !LEAD_RE.test(x.node.name));
    if (!models.length) return null;
    const lims = new Map(models.map(x => [x, E.limits(V, x.node, x, pw)]));
    const after = new Map();   // limits once the new model is in (Intercessors: min 4 → 3 with a grenade launcher)
    try {
      const V2 = E.view(sys, E.addSel(sys, ed.army, pid, tok));
      const p2 = V2.byId.get(pid);
      for (const x of models) { const x2 = p2 && V2.byId.get(x.s.id); if (x2) after.set(x, E.limits(V2, x2.node, x2, p2)); }
    } catch {}
    const minAfter = x => (after.get(x) || lims.get(x)).min;
    for (const x of models) {
      const l = lims.get(x), m2 = (after.get(x) || l).max;
      if (m2 >= 0 && x.n > m2 && !(l.max >= 0 && x.n > l.max) && x.n - 1 >= minAfter(x)) return x;
    }
    if (lim.max < 0 || LEAD_RE.test(lim.name || '')) return null;
    // the standard model sits in the special one's group or in a group around it – not in a sibling group (Crusader
    // Squad: a Neophyte is no swap for an Initiate)
    const par = t => t.split('>').slice(0, -1).join('>');
    const around = t => !!par(t) && (par(tok) === par(t) || par(tok).startsWith(par(t) + '>'));
    return models.filter(x => { const l = lims.get(x); return x.n - 1 >= minAfter(x) && x.n > 1 && (l.max < 0 || l.max > lim.max) && around(x.s.t); })
      .sort((p, q) => q.n - p.n)[0] || null;
  };
  // the unit's leader model (Sergeant, Superior, Exarch, Nob …) first, then the other models; special weapons follow
  // after them anyway (specialsOn / specials). The data often lists the Sergeant after the troopers' group.
  const isLead = k => !k.group && k.type === 'model' && LEAD_RE.test(k.name);
  const leadGroup = k => k.group && (() => { const ms = sys.children(k).filter(x => x.type === 'model' || x.group); return ms.length > 0 && ms.every(isLead); })();
  nodes = [...nodes].sort((a, b) => ((isLead(b) || leadGroup(b)) - (isLead(a) || leadGroup(a))));
  for (const k of nodes) {
    if (/^(Crusade\b|Weapon Modifications|Battle Scars|Battle Honours|Override points limit)/i.test(k.name)) continue;   // not "Crusaders"
    const lim = E.limits(V, k, null, pw);
    const tok = pfx(k.token);
    if (k.group) {
      const inGroup = (pw.ch || []).filter(c => c.s.t.startsWith(tok + '>'));
      if (lim.hidden && !inGroup.length) continue;
      const altOf = new Map();   // option → selection to take back so it comes again
      let kids = sys.children(k).filter(x => {
        if (inGroup.some(c => c.s.t === tok + '>' + x.token || c.s.t.startsWith(tok + '>' + x.token + '>'))) return true;
        if (NOT_READY.test(x.name)) return false;   // a placeholder of the data ("Deathwatch Support (ITS NOT READY)") – not offered
        // a sub-group whose options are all hidden (another detachment's enhancements) shows nothing: no empty heading
        const anyVisible = (y, d) => !E.limits(V, y, null, pw).hidden && (!y.group || (d < 4 && sys.children(y).some(z => anyVisible(z, d + 1))));
        if (anyVisible(x, 0)) return true;
        if (!inGroup.length || !pid) return false;
        const back = altVisible(pid, tok, x, inGroup);
        if (back) altOf.set(x, back);
        return !!back;
      });
      if (!kids.length) continue;
      const leafs = kids.every(x => !x.group && x.type !== 'model');
      // wargear the model always has (the option's own min = max, taken): "Equipped with", no checkbox to untick – a
      // "Wargear" group without limits holding the fixed weapons (Sanguinary Priest, Stonesinger, Exalted Sorcerer …)
      let shown = inGroup;
      if (leafs && (lim.max !== 1 || kids.length === 1)) {
        const must = new Map();
        for (const x of kids) {
          const on = inGroup.find(c => c.s.t === tok + '>' + x.token);
          const l = on ? E.limits(V, x, on, pw) : null;
          if (l && !altOf.has(x) && l.min > 0 && l.min === l.max) must.set(x, on);
        }
        if (must.size) {
          for (const [x, on] of must) { fixed.push(E.limits(V, x, on, pw).name); fixedFx.push(...effectsOf(x)); html += nested(V, on, depth, compact); }
          kids = kids.filter(x => !must.has(x));
          shown = inGroup.filter(c => ![...must.values()].includes(c));
          if (!kids.length) continue;
        }
      }
      const total = inGroup.reduce((x, c) => x + c.n, 0);
      const range = lim.max === 1 ? '' : `<span class="arm-range${lim.max >= 0 && total > lim.max || total < lim.min ? ' bad' : ''}">${total}${lim.max >= 0 ? ' / ' + lim.max : ''}</span>`;
      const multi = leafs && lim.max !== 1 && kids.every(x => E.limits(V, x, null, pw).max === 1);
      if (leafs && (lim.max === 1 || multi)) {
        const same = depth === 0 && pw.node && lim.name === pw.node.name;   // "Detachment" inside "Detachment": one heading is enough
        const weaponish = kids.length > 1 && !/^Detachments?$/i.test(lim.name) && kids.some(x => weaponsOf(x).length || effectsOf(x).length);
        const cmp = weaponish ? `<button type="button" class="arm-cmp" data-action="arm-cmp" data-p="${esc(pid)}" data-g="${esc(tok)}">Compare</button>` : '';
        // several of the group, but each option only once ("up to two drones, but no duplicates")
        const noDup = multi && lim.max > 1 ? ` <span class="muted xs">· up to ${lim.max}, max 1 of each</span>` : '';
        const headTxt = `${same ? '' : esc(lim.name)}${lim.min ? '' : ' <span class="muted xs">optional</span>'}${noDup}${eachTag}`;
        const whys = [];   // detachments that need more DP than are left – said below the choices (outside the data names)
        html += `<div class="arm-grp">${same && lim.min && !cmp ? '' : `<div class="arm-gh">${headTxt}${cmp}</div>`}<div class="arm-choices">${kids.map((x, xi) => {
          const t = tok + '>' + x.token;
          const on = inGroup.find(c => c.s.t === t);
          const cost = on ? E.totalCost(V, on) / Math.max(1, on.n) : optCost(V, x, pw, t);
          const dot = weaponish ? `<span class="arm-dot" style="--oc:${optColor(pid, t)}" aria-hidden="true"></span>` : '';
          const back = altOf.get(x);
          // one more of a multi-choice group: not beyond the group's (or an enclosing group's) maximum
          const full = multi && !on && !back && ((lim.max >= 0 && total >= lim.max) || capRoom <= 0);
          const dpWhy = on ? '' : dpShort(V, x, pw, t);   // a detachment that costs more DP than are left
          if (dpWhy) {
            const nm = E.limits(V, x, null, pw).name;
            whys.push(`<li><span data-no-i18n>${esc(nm)}</span>: ${esc(dpWhy)}</li>`);
            return `<button type="button" class="arm-opt arm-dp-over" data-action="arm-op" data-op="${multi ? 'add' : 'choose'}" data-p="${esc(pid)}" data-g="${esc(tok)}" data-t="${esc(t)}" title="${esc(dpWhy)}">${multi ? '<span class="arm-box" aria-hidden="true"></span>' : ''}${dot}${esc(nm)} <span class="arm-cost arm-dpc">${E.nodeCost(V, x, null, pw, DP)} DP ⚠</span></button>`;
          }
          return `<button type="button" class="arm-opt${on ? ' on' : ''}" data-action="arm-op" data-op="${back ? 'rm' : on ? (lim.min && !multi ? 'noop' : 'rm') : multi ? 'add' : 'choose'}" data-p="${esc(pid)}" data-g="${esc(tok)}" data-t="${esc(t)}"${back ? ` data-id="${esc(back.s.id)}"` : on ? ` data-id="${esc(on.s.id)}"` : ''}${full ? ' disabled' : ''}>${multi ? `<span class="arm-box" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}${dot}${esc(E.limits(V, x, on || null, pw).name)}${cost ? ` <span class="arm-cost">+${cost}</span>` : ''}${(() => { const d = E.nodeCost(V, x, on || null, pw, DP); return d ? ` <span class="arm-cost arm-dpc">${d} DP</span>` : ''; })()}</button>`;
        }).join('')}</div>${whys.length ? `<ul class="arm-why-list">${whys.join('')}</ul>` : ''}${shown.map(c => effectHtml(c.node ? effectsOf(c.node) : [])).join('')}${shown.map(c => nested(V, c, depth, compact)).join('')}</div>`;
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
    const cost = sels.length ? E.totalCost(V, sels[0]) / Math.max(1, sels[0].n) : optCost(V, k, pw, tok);
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
        const canAdd = (lim.max < 0 || total < lim.max) && capRoom > 0;
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
      html += `<button type="button" class="arm-check${c ? ' on' : ''}" data-action="arm-op" data-op="${c ? 'rm' : 'add'}" data-p="${esc(pid)}" data-t="${esc(tok)}"${c ? ` data-id="${esc(c.s.id)}"` : capRoom > 0 ? '' : ' disabled'}>
        <span class="arm-box" aria-hidden="true">${c ? '✓' : ''}</span><span>${esc(name)}</span>${cost ? `<span class="arm-cost">+${cost} pts</span>` : ''}</button>${effectHtml(effectsOf(k))}${c ? nested(V, c, depth, compact) : ''}`;
    }
  }
  // ONE box per model category (standard models / heavy weapons …): every model type with how many the unit has,
  // − / + for the chosen one ("+" swaps when the unit is full), its equipment, and Compare. Nothing jumps around.
  const pickKey = (pid || 'force') + '|' + prefix;
  const short = n => String(n).replace(/^.*?\bw\/\s*/i, '');
  const boxHtml = () => {
    // one model type: a box only if it has no choices of its own – or none of it is in the unit yet (an optional group
    // such as Broadside "Shas'ui (0-2)" needs its "+ Add"; once added, its model card has the stepper)
    if (others.length < 2 && !(others.length === 1 && (!others[0].own || !others[0].n))) return '';
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
        <span class="arm-mbox-sel">${mdot(sel.k)}<b>${esc(short(sel.name))}</b>${sel.cost ? ` <span class="arm-cost">${sel.cost} pts</span>` : ''}<span class="muted xs">${last && sel.r.swap && !sel.r.add ? ' · + swaps one ' + esc(short(unitName(V, sel.r.swap))) : sel.max > 0 ? ' · max ' + sel.max : ''}</span></span>
        ${last ? `<div class="stepper sm">${minus}<span class="stepper-value">${sel.n}</span>${plus}</div>` : ''}
      </div>
      ${last ? '' : `<button type="button" class="btn sm${can ? ' primary' : ''} arm-madd-big" data-action="arm-op" data-op="add" data-key="${esc(pickKey)}" data-p="${esc(pid)}" data-t="${esc(sel.tok)}"${sel.r.swap ? ` data-from="${esc(sel.r.swap.s.id)}"` : ''}${can ? '' : ' disabled'}>+ Add ${esc(short(sel.name))}${sel.r.swap && !sel.r.add ? ` <span class="arm-madd-sub">replaces one ${esc(short(unitName(V, sel.r.swap)))}</span>` : ''}</button>`}
      ${sel.gear.length && !sel.own ? `<div class="arm-fixed"><span class="arm-fixed-l">Each equipped with</span> ${esc(sel.gear.join(' · '))}</div>` : sel.own ? '<div class="muted xs">Its weapons are chosen in its card below.</div>' : ''}
    </div>`;
  };
  html = boxHtml() + html + specialsOn.join('') + specials.join('');
  return (fixed.length ? `<div class="arm-fixed"><span class="arm-fixed-l">${each ? 'Each equipped with' : 'Equipped with'}</span> ${esc(fixed.join(' · '))}${effectHtml(fixedFx)}</div>` : '') + html;
}
/** Points of one option not chosen yet, with what it brings along (the weapons inside "2 ectoplasma cannons", a model's
 *  default wargear): the option is added to a copy of the army and costed there. */
function optCost(V, x, pw, t) {
  const own = E.nodeCost(V, x, null, pw);
  if (!pw || pw.kind !== 'sel' || !ed.sys.children(x).some(k => !/^(Crusade\b|Weapon Modifications|Weapon Upgrades)/i.test(k.name))) return own;
  try {
    const r2 = E.addSel(ed.sys, ed.army, pw.s.id, t);
    const V2 = E.view(ed.sys, r2);
    const p2 = V2.byId.get(pw.s.id);
    const w = p2 && p2.ch[p2.ch.length - 1];
    return w && w.node === x ? E.totalCost(V2, w) / Math.max(1, w.n) : own;
  } catch { return own; }
}
/** Does a model type have choices of its own (weapon groups, optional wargear)? */
function hasChoices(V, k, c, pw) {
  return ed.sys.children(k).some(x => {
    if (/^(Crusade\b|Weapon Modifications)/i.test(x.name)) return false;
    const l = E.limits(V, x, null, c || pw);
    return !l.hidden && (x.group || l.max !== l.min);
  });
}
/** Fixed equipment of a model type (entries it always has). */
function fixedGear(V, k, c, pw) {
  return ed.sys.children(k).filter(x => !x.group && !/^(Crusade\b|Weapon Modifications)/i.test(x.name)).filter(x => { const l = E.limits(V, x, null, c || pw); return !l.hidden && l.min > 0 && l.min === l.max; }).map(x => E.limits(V, x, null, c || pw).name);
}
/** Would option x of group gtok (below selection pid) be available without the group's current choice?
 *  Returns the selection to take back for it (it then comes again by itself – see autoSync), or null. */
function altVisible(pid, gtok, x, inGroup) {
  try {
    let r = ed.army;
    for (const c of inGroup) r = E.removeSel(r, c.s.id);
    const V2 = E.view(ed.sys, r);
    const p2 = V2.byId.get(pid);
    return p2 && !E.limits(V2, x, null, p2).hidden ? inGroup[0] : null;
  } catch { return null; }
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
      if (/^(Crusade\b|Weapon Modifications)/i.test(k.name)) continue;
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
    ${sizeHtml(V, w)}
    ${leadHtml(V, w)}
    ${optionsHtml(V, w, false)}
    ${dsHtml(V, w)}`;
}

/* Unit size in one tap: the datasheet's sizes (5 / 10, 10 / 20 …) as chips instead of tapping '+' five times. Only for
   units whose models sit directly in the unit (a unit whose size is an option of the data has that option as its choice);
   the standard model stack (not the Sergeant / Nob …) grows or shrinks. */
function sizeMain(w) {
  if (w.ch.some(c => c.node && c.node.type !== 'model' && c.ch.some(k => k.node && k.node.type === 'model'))) return null;
  return w.ch.filter(c => c.node && c.node.type === 'model' && !LEAD_RE.test(c.node.name)).sort((a, b) => b.n - a.n)[0] || null;
}
function sizeHtml(V, w) {
  const ds = sheetOf(dsPack(), unitName(V, w));
  const sizes = [...new Set(((ds && ds.points) || []).map(p => Number(p.models)).filter(n => n > 1))].sort((a, b) => a - b);
  const main = sizes.length > 1 && sizeMain(w);
  if (!main) return '';
  const cur = countModels(w);
  return `<div class="arm-size"><span class="arm-gh">Unit size</span><div class="arm-choices">${sizes.map(n => {
    const want = main.n + n - cur;
    return `<button type="button" class="chip${n === cur ? ' on' : ''}" data-action="arm-op" data-op="size" data-id="${esc(main.s.id)}" data-n="${want}"${want < 1 ? ' disabled' : ''}>${n} models</button>`;
  }).join('')}</div></div>`;
}

/** Leader: which unit of the list it leads (taken into the game as "Leading …"). */
function leadHtml(V, w) {
  const cands = leaderCands(V, w, dsPack());
  if (!cands || !cands.length) return '';
  const cur = w.s.lead && V.byId.get(w.s.lead) ? w.s.lead : '';
  const nth = x => { const same = cands.filter(y => unitName(V, y) === unitName(V, x)); return same.length > 1 ? ` #${same.indexOf(x) + 1}` : ''; };
  // a bodyguard that already has as many leaders as its datasheet allows is not offered (only shown, with who leads it)
  const full = x => { const ls = leadersOf(V, x).filter(y => y !== w); return cur !== x.s.id && ls.length && leaderLimit(V, x, [...ls, w], dsPack()) ? ls : null; };
  const support = (attachRule(sheetOf(dsPack(), unitName(V, w))) || {}).kind === 'support';
  // every candidate with its model count and who leads it already ("Necron Warriors (10) – led by Technomancer"),
  // so two units of the same name can be told apart
  return `<div class="arm-grp arm-lead"><div class="arm-gh">${support ? 'Supports' : 'Leads'}${cur ? '' : ' <span class="arm-loose">not attached</span>'}</div><div class="arm-choices">
    <button type="button" class="arm-opt${cur ? '' : ' on'}" data-action="arm-op" data-op="lead" data-id="${esc(w.s.id)}" data-to="">None</button>
    ${cands.map(x => {
      const ls = full(x), others = leadersOf(V, x).filter(y => y !== w), m = countModels(x);
      return `<button type="button" class="arm-opt${cur === x.s.id ? ' on' : ''}" data-action="arm-op" data-op="lead" data-id="${esc(w.s.id)}" data-to="${esc(x.s.id)}"${ls ? ' disabled' : ''}>${esc(unitName(V, x) + nth(x))}${m ? ` <span class="arm-cost">(${m})</span>` : ''}${others.length ? ` <span class="arm-ledby">– led by ${esc(others.map(y => unitName(V, y)).join(', '))}</span>` : ''}</button>`;
    }).join('')}</div></div>`;
}

/** Datasheet of the unit (profiles, weapons, abilities) below its options – with the chosen wargear. */
function dsHtml(V, w, play = false) {
  const fid = ed.army.faction;
  if (!fid) return '';
  const pack = dsCache.get(fid);
  if (!pack) {
    dsCache.set(fid, 'loading');
    loadDatasheets(fid).then(d => dsCache.set(fid, d || { units: [] })).catch(() => dsCache.set(fid, { units: [] })).then(() => { refreshUnitSheet(); if (ed.mode === 'view') rerender(); });
    return '';
  }
  if (pack === 'loading') return '<p class="muted small">Loading datasheet …</p>';
  const name = E.effective(V, w.node, w, w.parent).name;
  const ds = sheetOf(pack, name);
  if (!ds) return '';
  const dets = summarize(ed.sys, ed.army).detachments.map(normName);
  // the attached unit as one group (leaders + bodyguard): "group" profile modifiers reach all of them
  const groupOf = x => { const body = x.s.lead ? V.byId.get(x.s.lead) : x; return body ? [body, ...V.force.ch.filter(y => y.s.lead === body.s.id)] : [x]; };
  const member = x => {
    const u = summarize(ed.sys, { ...ed.army, sel: [x.s] }).units[0];
    if (!u) return null;
    const wargear = wargearOf(V, x);
    let mods = null;
    try { mods = profileChanges(V, x, groupOf(x)); } catch (e) { console.warn('profiles', e); }
    return { id: x.s.id, name: u.name, models: u.models, points: u.pts, wargear, warlord: u.warlord, enhancements: u.enhancements.map(e => e.name), mods, keywords: u.keywords };
  };
  const u = member(w);
  // leaders attached to this unit: one group datasheet, every leader's buffs in its own colour
  const leaders = V.force.ch.filter(x => x.s.lead === w.s.id && isUnitSel(x)).map(x => {
    const lds = sheetOf(pack, unitName(V, x));
    if (!lds) return null;
    const lu = member(x);
    const enh = enhOf(V, x);
    return { ds: lds, unit: lu, enh, buffs: leaderBuffs(lds, enh, lu, dets) };
  }).filter(Boolean);
  const head = play ? '' : `<div class="arm-ds-h"><span class="arm-sec-h">Datasheet</span><span class="muted xs">tap the box to open it</span></div>`;
  if (leaders.length && u) {
    return `<div class="arm-ds">${head}${play ? '' : `<p class="muted xs">Led by ${leaders.map(l => esc(l.ds.name)).join(' + ')} – what a leader adds is shown in its colour.</p>`}${datasheetGroupCard({ body: { ds, unit: u, enh: enhOf(V, w) }, leaders }, { open: play ? bookOpen('book:u:' + w.s.id) : true, key: play ? 'book:u:' + w.s.id : undefined, noInfo: true, detachments: dets })}</div>`;
  }
  return `<div class="arm-ds">${head}${datasheetCard(ds, { compact: true, open: play && bookOpen('book:u:' + w.s.id), key: play ? 'book:u:' + w.s.id : undefined, detachments: dets, enhNames: u ? u.enhancements.map(e => normName(e)) : [], enhancements: enhOf(V, w), unit: u })}</div>`;
}

/* ───────── Datasheet view (#/armies/<id>/view): the army as a datasheet book – nothing to edit, everything to play ───────── */
/** The switch between editing and the datasheet view (same place in both). */
function viewToggle(id, on) {
  return `<a class="arm-viewtoggle${on ? ' on' : ''}" href="#/armies/${esc(id)}${on ? '' : '/view'}" role="switch" aria-checked="${on}">
    <span class="arm-switch" aria-hidden="true"><i></i></span><span class="arm-viewtoggle-t">Datasheet view</span><span class="muted xs">${on ? 'read only – switch off to edit' : 'all units as datasheets, to play'}</span></a>`;
}
const origCache = new Map();   // faction id → original texts (detachment rules, enhancements, stratagems) or 'loading'
function playHtml() {
  const { sys, army } = ed;
  const V = E.view(sys, army);
  const s = summarize(sys, army);
  const pack = dsPack();
  const fid = army.faction;
  let orig = fid ? origCache.get(fid) : null;
  if (fid && orig === undefined) { origCache.set(fid, 'loading'); loadOrig(fid).then(o => origCache.set(fid, o || null)).catch(() => origCache.set(fid, null)).then(() => { if (ed.mode === 'view') rerender(); }); }
  if (orig === 'loading') orig = null;
  const pts = E.totalPoints(V);
  const rules = {
    armyRules: (pack && pack.armyRules) || [],
    detachments: s.detachments.map(name => {
      const od = orig ? origDetachment(orig, name) : null;
      const bsd = pack && pack.detachments ? pack.detachments.find(d => normName(d.name) === normName(name)) : null;
      const r = (orig ? origDetachmentRule(orig, name) : []).length ? origDetachmentRule(orig, name) : ((od && od.rule) || (bsd && bsd.rules) || []);
      return { name, rules: r, strats: od && od.stratagems ? Object.values(od.stratagems) : [] };
    }),
    enhancements: V.force.ch.filter(isUnitSel).flatMap(w => enhOf(V, w).map(e => ({ ...e, on: unitName(V, w) })))
  };
  // units by role (from their keywords); a leader is shown inside the box of the unit he leads
  const kwById = new Map(s.units.map(u => [u.id, u.keywords || []]));
  const items = V.force.ch.filter(w => isUnitSel(w) && !(w.s.lead && V.byId.get(w.s.lead))).map(w => {
    const leaders = V.force.ch.filter(x => x.s.lead === w.s.id).map(x => unitName(V, x));
    const hay = [unitName(V, w), ...leaders, ...(kwById.get(w.s.id) || [])].join(' ').toLowerCase();
    const card = dsHtml(V, w, true) || `<div class="card muted small">${esc(unitName(V, w))}: no datasheet in the data.</div>`;
    return { role: roleOf(kwById.get(w.s.id)), html: `<div class="book-unit" data-hay="${esc(hay)}">${card}</div>` };
  });
  const line = [army.catalogueLabel || army.catalogueName, s.size, s.detachments.join(' + '), s.disposition].filter(Boolean).map(esc).join(' · ');
  return `<div class="armies arm-play">
    <header class="arm-bar">
      <a class="btn ghost sm" href="#/armies/${esc(army.id)}" aria-label="Back to the editor">‹</a>
      <div class="arm-title arm-play-title"><span class="arm-name">${esc(army.name)}</span><span class="arm-sub muted">${line}</span></div>
      <div class="arm-total"><b>${pts}</b><small>/ ${esc(army.limit || '–')} pts</small></div>
    </header>
    ${viewToggle(army.id, true)}
    <div class="arm-play-tools"><input type="search" class="book-search" data-book-search placeholder="Find a unit by name or keyword …" value="${esc(ed.bookQ || '')}" autocomplete="off" aria-label="Find a unit"><button type="button" class="btn ghost sm" data-action="arm-print">Print / PDF</button></div>
    ${ruleBoxes(rules, bookOpen)}
    <div class="book-units">${roleSections(items)}</div>
    <p class="muted xs arm-play-foot">${esc(army.name)} · ${pts} pts · Battle Report 40k</p>
  </div>`;
}
// open boxes of the book (army rule, detachment, units) – kept while the view re-renders
const bookOpenSet = new Set();
const bookOpen = key => bookOpenSet.has(key);
function bookFilter(root) {
  const q = String(ed.bookQ || '').trim().toLowerCase();
  root.querySelectorAll('.book-unit').forEach(u => { u.hidden = !!q && !u.dataset.hay.includes(q); });
  root.querySelectorAll('.book-sec').forEach(sec => { sec.hidden = !sec.querySelector('.book-unit:not([hidden])'); });
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
/** Catalogue each root entry comes from (entry id → catalogue name): the army's own units vs. allies. */
const ownerCache = new WeakMap();
function ownerOf(sys, n) {
  let m = ownerCache.get(sys);
  if (!m) {
    m = new Map();
    for (const c of sys.cats.values()) for (const k of ['selectionEntries', 'sharedSelectionEntries', 'sharedSelectionEntryGroups']) for (const e of c[k] || []) if (e && e.id && !m.has(e.id)) m.set(e.id, c.name);
    ownerCache.set(sys, m);
  }
  return m.get(n.id) || '';
}
/** Is catalogue `src` part of the army's own faction (the army's catalogue, its library, the Space Marines codex of a
 *  chapter, the Heresy Legends of its faction)? Everything else – Agents of the Imperium, Imperial Knights, Titans,
 *  daemons for a Chaos Space Marine army, unaligned forces – is an ally. */
const OWN_FAMILY = { 'Space Marines': /Adeptus Astartes/i, Titans: /Titanicus/i, Aeldari: /Aeldari|Drukhari/i };
function ownCatalogue(src, army) {
  if (!src || src === army || /Astartes Heresy Legends/i.test(src)) return true;
  const key = allyLabel(src);
  if (OWN_FAMILY[key] && OWN_FAMILY[key].test(army)) return true;
  // "Chaos - Daemons Library" → Chaos Daemons, "Imperium - Astra Militarum - Library" → Astra Militarum
  return army.split(' - ').some(s => s.trim() === key || s.trim().endsWith(' ' + key));
}
const allyLabel = src => (/Warhammer 40,000/i.test(src) ? 'Core rules' : src.split(' - ').map(s => s.replace(/\s*\bLibrary\b\s*/i, '').trim()).filter(s => s && !/^(Imperium|Chaos|Xenos|Library)$/i.test(s)).pop() || src);
/** Search text: lower case, accents off ("Attachés" → "attaches"), punctuation as spaces. */
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** Every word of the query is found inside the name ("attach" → Regimental Attachés, "loota" → Lootas, "big mek" → Big Mek in Mega Armour). */
const matches = (hay, q) => { const ws = fold(q).split(' ').filter(Boolean); return ws.every(w => hay.includes(w)); };
function openAdd(q0 = '') {
  const sys = ed.sys;
  const V = E.view(sys, ed.army);
  const armyCat = (sys.cats.get(ed.army.catalogueId) || {}).name || ed.army.catalogueName || '';
  const roots = sys.rootNodes(ed.army.catalogueId).filter(n => ['unit', 'model'].includes(n.type) && !HIDE_ROOT.test(n.name));
  // units the data hides behind a Show/Hide switch (Legends, Crucible …): found by the search too, with the switch
  const sw = showHideRoot(V), swOn = sw && V.force.ch.find(x => x.node && x.node.token === sw.token);
  const switches = sw ? sys.children(sw).filter(k => !k.group && !(swOn && swOn.ch.some(c => c.s.t === k.token))) : [];
  const hiddenHits = [];
  const rows = roots.map(n => {
    const l = E.limits(V, n, null, V.force);
    if (l.hidden) {
      const tag = (/\[(Legends|Crucible)\]/i.exec(l.name) || [])[1];
      const s = tag && switches.find(k => new RegExp('^Show ' + tag, 'i').test(k.name));
      hiddenHits.push({ name: l.name, key: fold(l.name), sw: s || null });
      return null;
    }
    const src = ownerOf(sys, n);
    return { n, l, ...addInfo(V, n), cat: sys.categoryNames.get(n.primaryCategory) || 'Other', src, ally: !ownCatalogue(src, armyCat) };
  }).filter(Boolean);
  rows.sort((a, b) => a.l.name.localeCompare(b.l.name));
  // the same name twice (Ministorum Priest of the Astra Militarum at 35 pts and of the Agents of the Imperium at 40):
  // each row says where it comes from (and Legends)
  const dupName = new Set(rows.map(r => r.l.name).filter((x, i, a) => a.indexOf(x) !== i));
  const rest = ed.army.limit ? Number(ed.army.limit) - E.totalPoints(V) : Infinity;   // points left
  const rowHtml = r => {
    const full = r.max >= 0 && r.have >= r.max;
    const over = !full && r.pts > rest;
    const tag = dupName.has(r.l.name) ? ` <span class="arm-src muted xs">${esc(allyLabel(r.src))}</span>` : '';
    return `<div class="arm-addline" data-name="${esc(fold(r.l.name))}">
      <button type="button" class="arm-addrow${over ? ' over' : ''}" data-tok="${esc(r.n.token)}"${full ? ' disabled' : ''}${over ? ' title="More than the points left"' : ''}>
        <span class="arm-add-n">${esc(r.l.name)}${tag}</span><span class="arm-have muted xs">${haveTxt(r)}</span><span class="arm-u-pts">${r.pts}</span><span class="arm-plus" aria-hidden="true">+</span></button>
      <button type="button" class="arm-info" data-info="${esc(r.n.token)}" aria-label="Datasheet of ${esc(r.l.name)}" title="Datasheet">i</button></div>`;
  };
  const own = rows.filter(r => !r.ally), allies = rows.filter(r => r.ally);
  const cats = [...new Set(own.map(r => r.cat))].sort(byRole);
  const allySrc = [...new Set(allies.map(r => allyLabel(r.src)))].sort();
  const body = `<div class="arm-add-top"><input type="search" class="arm-search" placeholder="Search units" autocomplete="off" enterkeyhint="go" aria-label="Search units">
    <div class="arm-roles">${cats.map(c => `<button type="button" class="chip sm" data-jump="${esc(c)}">${esc(c)}</button>`).join('')}${allies.length ? `<button type="button" class="chip sm" data-jump="__allies">Allies</button>` : ''}</div></div>
    <div class="arm-addlist">${cats.map(c => `<div class="arm-sec-h" data-role="${esc(c)}">${esc(c)}</div>${own.filter(r => r.cat === c).map(rowHtml).join('')}`).join('')}
    ${allies.length ? `<details class="arm-allies" data-role="__allies"><summary><span class="arm-sec-h">Allies</span> <span class="muted xs">${esc(allySrc.join(' · '))} – other catalogues this army may include</span> <span class="badge">${allies.length}</span></summary>
      ${allySrc.map(s => `<div class="arm-ally-h" data-role="ally:${esc(s)}">${esc(s)}</div>${allies.filter(r => allyLabel(r.src) === s).map(rowHtml).join('')}`).join('')}</details>` : ''}
    <p class="arm-noresult muted" hidden>No units found</p><div class="arm-hidden-hits" hidden></div></div>`;
  let added = 0;
  const touch = matchMedia('(pointer: coarse)').matches;
  sheet({
    title: 'Add units', body, cls: 'arm-add-sheet wide', focus: !touch,
    onOpen: (el, closeAdd) => {
      const q = el.querySelector('.arm-search');
      const allyBox = el.querySelector('.arm-allies');
      let allyWasOpen = false;
      const filter = () => {
        const s = q.value.trim();
        el.querySelectorAll('.arm-addline').forEach(b => { b.hidden = !!s && !matches(b.dataset.name, s); });
        // headings without a visible row go away
        el.querySelectorAll('.arm-addlist .arm-sec-h[data-role], .arm-ally-h').forEach(h => { let n = h.nextElementSibling, any = false; while (n && n.classList.contains('arm-addline')) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
        if (allyBox) {
          const any = !!allyBox.querySelector('.arm-addline:not([hidden])');
          allyBox.hidden = !any;
          if (s && any) { if (!allyBox.dataset.auto) { allyWasOpen = allyBox.open; allyBox.dataset.auto = '1'; } allyBox.open = true; }
          else if (!s && allyBox.dataset.auto) { allyBox.open = allyWasOpen; delete allyBox.dataset.auto; }
        }
        el.querySelector('.arm-noresult').hidden = !s || !!el.querySelector('.arm-addline:not([hidden])');
        // matches the data hides behind a switch: named, with the switch to show them
        const hh = el.querySelector('.arm-hidden-hits');
        const hits = s ? hiddenHits.filter((h, i, a) => h.sw && matches(h.key, s) && a.findIndex(y => y.name === h.name) === i) : [];
        hh.hidden = !hits.length;
        hh.innerHTML = hits.length ? `<p class="muted xs">Not shown – the data hides ${hits.length === 1 ? 'this unit' : 'these units'} behind a switch:</p><ul>${hits.slice(0, 8).map(h => `<li>${esc(h.name)}</li>`).join('')}</ul>${[...new Map(hits.map(h => [h.sw.token, h.sw])).values()].map(k => `<button type="button" class="btn ghost sm" data-show-sw="${esc(k.token)}">${esc(k.name)}</button>`).join(' ')}` : '';
      };
      q.addEventListener('input', filter);
      if (q0) { q.value = q0; filter(); }
      // Enter adds the only / top hit
      q.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!q.value.trim()) return;
        const top = el.querySelector('.arm-addline:not([hidden]) .arm-addrow:not(:disabled)');
        if (top) add(top);
      });
      const refresh = (b) => {
        const V2 = E.view(ed.sys, ed.army);
        // every row: copies and limits (a shared category limit changes with any unit), the next copy's price on this
        // one, and whether it still fits into the points left
        const all = ed.sys.rootNodes(ed.army.catalogueId);
        const rest = ed.army.limit ? Number(ed.army.limit) - E.totalPoints(V2) : Infinity;
        el.querySelectorAll('.arm-addrow').forEach(x => {
          const node = all.find(n => n.token === x.dataset.tok);
          if (!node) return;
          const info = addInfo(V2, node, x === b);
          const hv = x.querySelector('.arm-have');
          hv.textContent = haveTxt(info);
          if (x === b) { hv.classList.toggle('added', info.have > 0); x.querySelector('.arm-u-pts').textContent = info.pts; }
          x.disabled = info.max >= 0 && info.have >= info.max;
          const over = !x.disabled && Number(x.querySelector('.arm-u-pts').textContent) > rest;
          x.classList.toggle('over', over);
          if (over) x.title = 'More than the points left'; else x.removeAttribute('title');
        });
        return V2;
      };
      const add = b => {
        // add and stay in the list: first all units, then set them up
        apply(r => E.addSel(ed.sys, r, null, b.dataset.tok));
        const V2 = refresh(b);
        b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
        added++;
        const t = el.querySelector('.sheet-head .title');
        if (t) t.textContent = `Add units · ${added} added · ${E.totalPoints(V2)} pts`;
        // with a keyboard the search stays ready for the next unit (text selected: type over it)
        if (!touch && q.value.trim()) { try { q.focus({ preventScroll: true }); q.select(); } catch {} }
      };
      el.addEventListener('click', e => {
        const j = e.target.closest('[data-jump]');
        if (j) {
          const h = el.querySelector(`.arm-addlist [data-role="${CSS.escape(j.dataset.jump)}"]`);
          const body = el.querySelector('.sheet-body');
          if (h && h.tagName === 'DETAILS') h.open = true;
          if (h && body) body.scrollTo({ top: h.offsetTop - el.querySelector('.arm-add-top').offsetHeight - 4, behavior: 'smooth' });
          return;
        }
        const shw = e.target.closest('[data-show-sw]');
        if (shw) { const s = q.value; closeAdd(); toggleShow(shw.dataset.showSw); toast(`${shw.textContent}: on`, 'ok', 1500); openAdd(s); return; }
        const inf = e.target.closest('[data-info]');
        if (inf) { const r = rows.find(x => x.n.token === inf.dataset.info); if (r) openAddInfo(r); return; }
        const b = e.target.closest('.arm-addrow');
        if (!b || b.disabled) return;
        add(b);
      });
    },
    actions: [{ label: 'Done', kind: 'primary' }]
  });
}
/** The datasheet of a unit before it is added (the 'i' of a row in Add units): the faction's own datasheets, then the
 *  ally packs (Agents of the Imperium, Imperial Knights, daemons …). */
async function openAddInfo(r) {
  const name = r.l.name;
  let ds = null;
  try {
    ds = sheetOf(await loadDatasheets(ed.army.faction), name);
    for (const p of ALLY_PACKS) { if (ds) break; ds = sheetOf(await loadDatasheets(p), name); }
  } catch {}
  const src = `<p class="muted xs">${esc(r.cat)} · ${r.pts} pts${r.ally ? ' · ' + esc(allyLabel(r.src)) : ''}</p>`;
  sheet({
    title: name, cls: 'arm-addinfo-sheet wide',
    body: src + (ds ? datasheetCard(ds, { open: true, noInfo: true }) : '<p class="muted">No datasheet in the data for this unit.</p>'),
    actions: [{ label: 'Close', kind: 'ghost' }, { label: `+ Add ${name}`, kind: 'primary', disabled: r.max >= 0 && addInfo(E.view(ed.sys, ed.army), r.n, false).have >= r.max, onClick: () => {
      const row = document.querySelector(`.arm-add-sheet .arm-addrow[data-tok="${CSS.escape(r.n.token)}"]`);
      if (row && !row.disabled) row.click(); else apply(x => E.addSel(ed.sys, x, null, r.n.token));
    } }]
  });
}
/** A row of the Add units list: copies in the army, how many are allowed (the entry's own limit and the catalogue's
 *  category limits – one EPIC HERO, three of a datasheet …; -1 = none) and what the NEXT copy costs (the 4th Rhino
 *  costs more). price = false: keep the price out (only copies and limit). */
function addInfo(V, n, price = true) {
  const l = E.limits(V, n, null, V.force);
  const have = E.selsOf(V, V.force, n).length;
  const cr = E.categoryRoom(V, n);
  let max = l.max;
  if (cr) max = Math.min(max < 0 ? Infinity : max, Math.max(have, have + cr.left));
  let pts = defaultCost(n);
  if (price && have) {
    try {
      const V2 = E.view(ed.sys, E.addSel(ed.sys, ed.army, null, n.token));
      const w = V2.force.ch[V2.force.ch.length - 1];
      if (w && w.node === n) pts = E.totalCost(V2, w);
    } catch {}
  }
  return { have, max: Number.isFinite(max) ? max : -1, pts };
}
const haveTxt = r => (r.max >= 0 ? `${r.have}/${r.max}` : r.have ? r.have + '×' : '');
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
/** An enhancement that changes one weapon ("Plasma Accelerator Rifle") needs its upgrade on that weapon ("… upgrade") –
 *  set by itself when exactly one weapon of the unit can take it; otherwise the player chooses (the data warns). */
function pickEnhancementUpgrades(sys, r) {
  for (let i = 0; i < 6; i++) {
    const V = E.view(sys, r);
    let added = false;
    for (const u of V.force.ch.filter(isUnitSel)) {
      const all = (function f(x, o = []) { for (const c of x.ch) { o.push(c); f(c, o); } return o; })(u);
      const enh = all.filter(c => c.node && c.groups.some(g => /Enhancement/i.test(g.name)) && !/upgrade$/i.test(c.node.name)).map(c => c.node.name);
      for (const en of enh) {
        const want = (en + ' upgrade').toLowerCase();
        if (all.some(c => c.node && c.node.name.toLowerCase() === want)) continue;
        const spots = [];
        for (const w of [u, ...all]) {
          if (!w.node) continue;
          (function f(n, pre, d) {
            if (d > 3) return;
            for (const k of sys.children(n)) {
              const t = pre ? pre + '>' + k.token : k.token;
              if (k.group) { if (!/^(Crusade\b|Weapon Modifications|Boarding)/i.test(k.name)) f(k, t, d + 1); }
              else if (k.name.toLowerCase() === want && !E.limits(V, k, null, w).hidden) spots.push({ w, t });
            }
          })(w.node, '', 0);
        }
        if (spots.length === 1) { r = E.addSel(sys, r, spots[0].w.s.id, spots[0].t); added = true; break; }
      }
      if (added) break;
    }
    if (!added) break;
  }
  return r;
}
function autoPick(sys, r) {
  r = pickEnhancementUpgrades(sys, r);
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
/** Rule problems inside one unit (root selection id) – for the check whether adding something breaks a rule. */
const unitProbs = (r, uid) => { try { return E.validate(E.view(ed.sys, r), { unit: uid }).map(p => p.msg); } catch { return []; } };
/** guard: root unit id – an addition that gives that unit more rule problems than before (a 5th support system, a second
 *  special weapon below 10 models, a homing beacon for every model of a stack …) is not made; the rule is shown instead. */
function apply(fn, guard = null) {
  let r = fn(ed.army);
  if (!r) return;
  const synced = autoPick(ed.sys, E.autoSync(ed.sys, r));   // wargear tied to other choices follows, unavailable choices go
  if (guard) {
    const before = unitProbs(ed.army, guard), after = unitProbs(synced, guard);
    if (after.length > before.length) {
      const nw = after.filter(m => !before.includes(m));
      toast(`Not possible – ${nw[0] || after[after.length - 1]}`, 'warn', 5000);
      return;
    }
  }
  const auto = syncDiff(r, synced);
  r = synced;
  if (auto.length) autoNote('Adjusted to the rules', auto, 'Changed automatically:');
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
  // additions inside a unit must not break its rules (checked after the change, see apply)
  const unitOf = id => { const w = id ? rootOf(E.view(sys, ed.army), id) : null; return w ? w.s.id : null; };
  switch (d.op) {
    case 'add': return apply(r => takeOne(E.addSel(sys, r, d.p || null, d.t), d.from), unitOf(d.p));
    case 'rm': return apply(r => E.removeSel(r, d.id));
    case 'choose': return apply(r => E.chooseInGroup(sys, r, d.p || null, d.g, d.t));
    case 'split': return apply(r => E.splitSel(r, d.id));
    case 'size': return apply(r => (E.findSel(r.sel, d.id) ? E.setCount(r, d.id, Math.max(1, Number(d.n) || 1)) : r), unitOf(d.id));
    case 'lead': return apply(r => { const c = JSON.parse(JSON.stringify(r)); const x = E.findSel(c.sel, d.id); if (x) { if (d.to) x.lead = d.to; else delete x.lead; } return c; });
    case 'count': return apply(r => {
      const s = E.findSel(r.sel, d.id);
      if (!s) return r;
      const n = (Number(s.n) || 0) + Number(d.d);
      return takeOne(n <= 0 ? E.removeSel(r, d.id) : E.setCount(r, d.id, n), d.from);
    }, Number(d.d) > 0 ? unitOf(d.id) : null);
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
  if (a === 'arm-import') return openImport(ed.id && ed.army ? ed.army.catalogueId : null);
  if (a === 'arm-open') return lastCtx.nav('#/armies/' + b.dataset.id);
  if (a === 'arm-del') {
    const ar = loadArmy(b.dataset.id);
    if (ar && await confirmSheet({ title: 'Delete army?', text: `“${ar.name}” will be deleted from this device.`, ok: 'Delete', kind: 'danger' })) { deleteArmy(ar.id); rerender(); }
    return;
  }
  if (a === 'arm-dup') {
    const ar = loadArmy(b.dataset.id);
    if (ar) { if (!saveArmy(Object.assign({}, ar, { id: armyId(), name: ar.name + ' (copy)' }), { verify: true })) toast('Could not save the copy on this device (storage full or blocked)', 'bad', 6000); rerender(); }
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
  if (a === 'arm-detcmp') { e.stopPropagation(); return openDetCompare(b.dataset.id); }
  if (a === 'arm-unit') return openUnit(b.dataset.id);
  if (a === 'arm-cfg') { ed.cfgOpen = !ed.cfgOpen; return rerender(); }
  if (a === 'arm-impdone') { const r = Object.assign({}, ed.army); delete r.importNotes; saveWithSummary(ed.sys, r); return rerender(); }
  if (a === 'arm-print') { try { window.print(); } catch {} return; }
  if (a === 'arm-show') return toggleShow(b.dataset.t);
  if (a === 'arm-resave') { if (saveWithSummary(ed.sys, ed.army)) toast('Army saved', 'ok', 1500); else toast('Still not saved – storage full or blocked', 'bad', 5000); return; }
  if (a === 'arm-dp' || a === 'arm-dp-auto') {
    const dp = a === 'arm-dp-auto' ? null : Math.max(0, Math.min(9, dpLimitOf(ed.army) + Number(b.dataset.d)));
    saveWithSummary(ed.sys, Object.assign({}, ed.army, { dp }));
    return rerender();
  }
  if (a === 'arm-add') return openAdd();
  if (a === 'arm-rename') {
    const n = await promptSheet({ title: 'Rename army', label: 'Name', value: ed.army.name, ok: 'Save' });
    if (n && n.trim()) { const a2 = Object.assign({}, ed.army, { name: n.trim() }); const s = saveArmy(a2); ed.army = s || a2; savedState(!!s); rerender(); }
    return;
  }
  if (a === 'arm-problems') {
    const V = E.view(ed.sys, ed.army);
    const probs = problems(V);
    // the data's notices (BSData "warning": a points-update note, an upgrade to pick …) – shown, but no rule problem
    let notes = [];
    try { notes = E.validate(V, { warnings: true }).filter(p => p.warn); } catch {}
    const imp = (ed.army.importNotes || []).length;
    // each line jumps to what it is about: a unit opens its sheet, a configuration entry (detachment, battle size …)
    // opens the army configuration there; general lines about detachments go to the detachment choice
    const detW = V.force.ch.find(w => w.node && /^Detachments?$/.test(w.node.name));
    const item = p => {
      const u = p.sel ? rootOf(V, p.sel) : null; const nm = u ? E.effective(V, u.node, u, u.parent).name : '';
      let msg = p.msg; while (nm && msg.startsWith(nm + ': ')) msg = msg.slice(nm.length + 2);   // the unit name only once
      const txt = `${u ? `<b>${esc(nm)}</b>: ` : ''}${esc(msg)}`;
      const to = u && isUnitSel(u) ? `data-junit="${esc(u.s.id)}"` : u ? `data-jcfg="${esc(u.s.id)}"` : detW && /Detachment/i.test(p.msg) ? `data-jcfg="${esc(detW.s.id)}"` : '';
      return to ? `<li><button type="button" class="arm-plink" ${to}>${txt} <span class="arm-plink-go" aria-hidden="true">›</span></button></li>` : `<li>${txt}</li>`;
    };
    sheet({
      onOpen: (el, close) => el.addEventListener('click', ev => {
        const j = ev.target.closest('[data-junit], [data-jcfg]');
        if (!j) return;
        close();
        if (j.dataset.junit) return openUnit(j.dataset.junit);
        jumpToConfig(j.dataset.jcfg);
      }),
      title: probs.length ? `${probs.length} problem${probs.length === 1 ? '' : 's'}` : 'No problems',
      body: (probs.length ? `<ul class="arm-problist">${probs.map(item).join('')}</ul>` : '<p>The list is valid.</p>')
        + (notes.length ? `<div class="arm-notes"><b>Notes from the data</b> <span class="muted xs">no rule problem</span><ul class="arm-problist arm-notelist">${notes.map(item).join('')}</ul></div>` : '')
        + (imp ? `<details class="arm-imp-sec"><summary><b>Import report</b> <span class="badge">${imp}</span> <span class="muted xs">what the import could not take over 1:1</span></summary>${importReportHtml(ed.army)}</details>` : ''),
      actions: [...(imp ? [{ label: 'Hide import report', kind: 'ghost', onClick: () => dismissImport() }] : []), { label: 'Close', kind: 'ghost' }]
    });
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
      title: 'Battle size', body: `<div class="chips">${SIZES.map(s => `<button type="button" class="chip${ed.army.limit === s.pts ? ' on' : ''}" data-size="${s.pts}">${esc(s.name)} · ${s.pts} pts</button>`).join('')}</div>
        <label class="field mt"><span>Custom points limit</span><span class="row arm-custom"><input type="number" name="pts" min="100" step="50" inputmode="numeric" value="${SIZES.some(x => x.pts === ed.army.limit) ? '' : esc(ed.army.limit)}" placeholder="e.g. 1500"><button type="button" class="btn primary" data-size-custom>Set</button></span></label>
        <p class="muted xs">A custom game uses the rules of the nearest standard size (up to 1000 pts Incursion, above that Strike Force); the Detachment Points can be set by hand.</p>`,
      onOpen: (el, close) => el.addEventListener('click', ev => {
        const c = ev.target.closest('[data-size], [data-size-custom]'); if (!c) return;
        const limit = c.dataset.size ? Number(c.dataset.size) : Math.floor(Number(el.querySelector('input[name=pts]').value));
        if (!(limit >= 100)) { toast('Enter a points limit (100 or more)', 'warn'); return; }
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
  return { text: armyText(sys, a, { faction: a.catalogueLabel }), faction: a.faction, detachments: s.detachments, name: a.name, limit: a.limit,
    keywords: s.units.map(u => ({ name: u.name, keywords: u.keywords, factionKeywords: u.factionKeywords, mods: u.mods })) };
}

/** What autoSync / autoPick changed: ['Hesyr: Concussion gauntlet removed', …] */
function syncDiff(a, b) {
  const list = r => { const V = E.view(ed.sys, r); const out = new Map(); const walk = (w, path) => { for (const c of w.ch || []) { if (!c.node) continue; const n = E.effective(V, c.node, c, c.parent).name; out.set(c.s.id, { label: (path ? path + ': ' : '') + n, n: c.n }); walk(c, c.node.type === 'model' || c.node.type === 'unit' ? n : path); } }; walk(V.force, ''); return out; };
  try {
    const A = list(a), B = list(b), out = [];
    for (const [id, x] of A) if (!B.has(id)) out.push(`${x.label} removed`);
    for (const [id, x] of B) if (!A.has(id)) out.push(`${x.label} added`);
    return out;
  } catch { return []; }
}
/** Lists saved before a fix (or after a data update) are brought in line with the data once when opened. */
function syncOnOpen(sys) {
  try {
    const before = JSON.stringify(ed.army.sel);
    const stale = E.view(sys, ed.army).stale.length;
    if (stale) setTimeout(() => toast(`New Recruit data changed: ${stale} choice${stale === 1 ? ' was' : 's were'} adjusted (found again by name, or replaced by the default). Please check the army.`, 'warn', 8000), 300);
    const r = autoPick(sys, E.autoSync(sys, ed.army));
    if (JSON.stringify(r.sel) !== before) saveWithSummary(sys, Object.assign({}, ed.army, { sel: r.sel }));
  } catch (e) { console.warn('sync', e); }
}
