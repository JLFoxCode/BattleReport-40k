/* Setup-Assistent – Schritt-Renderer 2–5 (Armee, Armeeliste, Mission, Sekundär) + Sheets.
 * Reine HTML-Erzeuger; Events werden in setup.js per Delegation abgefangen (data-action / data-field).
 * All texts English, card names/keywords 1:1 as printed by GW in uppercase. */
import { esc, btn, chip, badge, sheet, confirmSheet, toast, playerLabel } from './components.js';
import { mapThumb } from './map.js';
import { radiusFor, parseArmyText } from '../../engine/reduce.js';
import { loadOrig, origArmyRules, origDetachmentRule } from '../data/orig.js';
import { loadDatasheets, matchUnit, normName, ALLY_PACKS } from '../data/datasheets.js';
import { armyChoices, armyForGame } from './armies.js';
import { WH } from '../../data/rules.js';
import { LAYOUTS11, VARIANTS11, findLayout11 } from '../../data/layouts11.js';

/* Army rule + detachment rules: BSData (New Recruit) only – one source for everything about the army. */
const BS = new Map(); // factionId → loaded data | null (loading) | false (none)
function bsOf(ctx, facId) {
  if (!BS.has(facId)) { BS.set(facId, null); loadOrig(facId).then(o => { BS.set(facId, o || false); if (ctx.rerender) ctx.rerender(); }); }
  return BS.get(facId) || null;
}
const ruleTexts = rules => rules.map(r => `<div class="rule-text"><b>${esc(r.name)}</b>
${esc(String(r.text || '').replace(/\^\^/g, '').replace(/\*\*/g, ''))}</div>`).join('');

export const DP_LIMIT = { strike: 3, incursion: 2 };
export const SIZE_LABEL = { strike: 'Strike Force', incursion: 'Incursion' };
const RESERVE_LABEL = { none: 'Deploy on the battlefield', strategic: 'Strategic Reserves', deepstrike: 'Deep Strike', transport: 'Embarked in a transport' };

// Incursion with a 3-DP detachment as the only detachment: 3 (core 25.04; as in the data's army roster and the engine)
export const dpLimit = (state, fac, dets) => {
  if (state.opts.dp != null) return Number(state.opts.dp);
  const base = DP_LIMIT[state.opts.size] || 3;
  const big = fac && (dets || []).length === 1 && Number(((fac.detachments || []).find(d => d.id === dets[0]) || {}).dp) >= 3;
  return state.opts.size === 'incursion' && big ? Math.max(3, base) : base;
};
// Boarding Actions detachments belong to Boarding Actions battles only (hidden in BSData) – not offered for Incursion / Strike Force
const isBoarding = d => /\(Boarding Actions\)\s*$/i.test(d.name || '');
export const dpOf = (fac, ids) => (ids || []).reduce((s, id) => { const d = fac && fac.detachments.find(x => x.id === id); return s + (d ? Number(d.dp) || 0 : 0); }, 0);
const facOf = (ctx, p) => { const id = ctx.state.players[p].faction; return id ? ctx.data.FACTIONS.find(f => f.id === id) || null : null; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');

/* ═══════════════ Schritt 2: Armee ═══════════════ */
/** Saved lists of "My armies" – one tap sets faction, Detachment and the army list (army-pick → importSavedArmy). */
export function savedListsHtml(p, title = 'From My armies') {
  let saved = [];
  try { saved = armyChoices(); } catch { saved = []; }
  if (!saved.length) return '';
  return `<div class="card p${p} saved-lists">
      <div class="card-head"><div class="title">${esc(title)}</div></div>
      <p class="muted small">One tap sets faction, Detachment and the army list.</p>
      <div class="arm-pick">${saved.map(a => `<button type="button" class="arm-pickrow" data-action="army-pick" data-p="${p}" data-army="${esc(a.id)}">
        <span><b>${esc(a.name)}</b><span class="muted xs"> ${esc(a.label)}</span></span><span class="muted xs">${esc(a.points)} pts${a.errors ? ' · ⚠ ' + esc(a.errors) : ''}</span></button>`).join('')}</div>
    </div>`;
}

export function armyStep(ctx, ui, p) {
  const { state } = ctx;
  const pl = state.players[p];
  const fac = facOf(ctx, p);
  if (!fac) {
    const saved = savedListsHtml(p);
    if (!saved) return facPicker(ctx, ui, p);
    const open = ui.facOpen && ui.facOpen[p];
    return `${saved}
      <details class="fac-manual" data-fac-details="${p}"${open ? ' open' : ''}><summary>Or choose faction and Detachment by hand</summary>${facPicker(ctx, ui, p)}</details>`;
  }
  const limit = dpLimit(state, fac, pl.detachments);
  const dp = dpOf(fac, pl.detachments);
  const kind = dp > limit ? 'bad' : dp === limit ? 'ok' : pl.detachments.length ? 'warn' : '';
  return `
    <div class="card p${p} fac-card">
      <div class="card-head">
        <div class="title">${esc(fac.name)}</div>
        ${fac.group ? badge(fac.group) : ''}
        ${btn({ label: 'Change', kind: 'ghost', small: true, action: 'fac-clear', data: { p } })}
      </div>
      ${(() => { const o = bsOf(ctx, fac.id); const r = o ? origArmyRules(o) : []; return r.length ? `<details class="rule"><summary>Army rule</summary>${ruleTexts(r)}</details>` : `<p class="muted small">${o === null ? 'Loading army rule …' : 'Army rule not in the BSData (New Recruit) data.'}</p>`; })()}
      ${fac.resource && fac.resource.name ? `<p class="small muted">Resource counter: ${esc(fac.resource.name)}</p>` : ''}
    </div>
    <div class="row between dp-row">
      <div class="title">Detachments (DP ${dp}/${limit})</div>
      <span class="dp-meter ${kind}">DP ${dp}/${limit}</span>
    </div>
    <p class="muted small">${esc(SIZE_LABEL[state.opts.size] || state.opts.size)}: up to ${limit} Detachment Points. Several Detachments are allowed as long as the DP total fits.</p>
    <div class="det-list">${fac.detachments.filter(d => !isBoarding(d) || pl.detachments.includes(d.id)).map(d => {
      const on = pl.detachments.includes(d.id), list = pl.detachments.concat(d.id);
      return detCard(d, p, on, !on && dpOf(fac, list) > dpLimit(state, fac, list), bsOf(ctx, fac.id));
    }).join('')}</div>`;
}

function detCard(d, p, on, wouldExceed, bs) {
  const n = (d.strats || []).length;
  return `
    <div class="card det-card ${on ? 'on' : ''} ${wouldExceed ? 'disabled' : ''}" data-action="det" data-p="${p}" data-id="${esc(d.id)}" role="checkbox" aria-checked="${on}" tabindex="0">
      <div class="det-head">
        <span class="det-check" aria-hidden="true">${on ? '✓' : ''}</span>
        <span class="det-name">${esc(d.name)}</span>
        ${badge(`${Number(d.dp) || 0} DP`, on ? 'ok' : wouldExceed ? 'bad' : '')}
        ${badge(n ? `${n} Stratagem${n === 1 ? '' : 's'}` : 'no Stratagems', n ? '' : 'used')}
      </div>
      ${(() => { const r = bs ? origDetachmentRule(bs, d.name) : []; return r.length ? `<details class="rule" data-stop><summary>Detachment rule</summary>${ruleTexts(r)}</details>` : `<div class="muted xs det-norule">${bs ? 'Detachment rule not in the BSData (New Recruit) data.' : 'Loading …'}</div>`; })()}
    </div>`;
}

function facPicker(ctx, ui, p) {
  return `
    <label class="field">
      <span>Search faction</span>
      <input type="search" data-field="search" data-p="${p}" value="${esc(ui.search[p] || '')}" placeholder="e.g. Orks, Necrons, Space Marines" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <div class="fac-list" data-fac-list="${p}">${facListHtml(ctx, ui, p)}</div>`;
}

/** Gruppierte Fraktionsliste (wird beim Tippen direkt gepatcht). */
export function facListHtml(ctx, ui, p) {
  const q = norm(ui.search[p]);
  const groups = new Map();
  for (const f of ctx.data.FACTIONS) {
    if (q && !norm(f.name).includes(q) && !norm(f.group).includes(q)) continue;
    const g = f.group || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  if (!groups.size) return `<p class="muted center">No faction found.</p>`;
  let out = '';
  for (const [g, list] of groups) {
    out += `<div class="divider">${esc(g)}</div><div class="fac-grid">`;
    out += list.map(f => `
      <button class="btn fac-btn" type="button" data-action="fac-pick" data-p="${p}" data-id="${esc(f.id)}" ${f.detachments.length ? '' : 'disabled title="No Detachments on file"'}>
        <span class="fac-name">${esc(f.name)}</span>
        <span class="xs muted">${f.detachments.length} Detachments</span>
      </button>`).join('');
    out += `</div>`;
  }
  return out;
}

/* ═══════════════ Schritt 3: Armeeliste ═══════════════ */
export function unitsStep(ctx, ui, p) {
  const { state } = ctx;
  const pl = state.players[p];
  const total = pl.units.reduce((s, u) => s + (Number(u.points) || 0), 0);
  const limit = Number(state.opts.points) || 0;
  const kind = total > limit ? 'bad' : total === 0 ? '' : 'ok';
  return `
    <p class="muted small units-note">Your army list brings the datasheets, the Stratagem targets and the army rules to your phone (e.g. Da Boss offers its +1 CP at the start of each battle round). Take it from My armies or import an export from New Recruit / the GW app.</p>
    ${pl.units.length ? '' : savedListsHtml(p)}
    <div class="row between units-head">
      <div class="kpi left ${kind ? 'text-' + kind : ''}"><b>${total}<span class="muted"> / ${limit}</span></b><small>points · ${pl.units.length} unit${pl.units.length === 1 ? '' : 's'}</small></div>
      <div class="row">
        ${btn({ label: 'Import', kind: 'ghost', action: 'import', data: { p } })}
        ${btn({ label: 'Add unit', kind: 'primary', action: 'unit-add', data: { p } })}
      </div>
    </div>
    ${total > limit ? `<p class="text-bad small">Army is ${total - limit} points over the limit.</p>` : ''}
    ${pl.units.length ? `<div class="card pad0"><ul class="list unit-list">${pl.units.map(u => unitItem(u, p)).join('')}</ul></div>`
      : `<div class="card flat center muted empty">No units yet. Add them manually or import the export from the GW app / New Recruit.</div>`}`;
}

function unitItem(u, p) {
  const kw = (u.keywords || []).filter(k => k !== 'CHARACTER');
  return `
    <li class="list-item tap unit-item" data-action="unit-edit" data-p="${p}" data-id="${esc(u.id)}">
      <div class="main">
        <div class="name">${esc(u.name)} ${u.character ? badge('CHARACTER', 'warn') : ''}</div>
        <div class="sub">${u.models} model${u.models === 1 ? '' : 's'} · OC ${u.oc} · M ${u.move}" · W ${u.wounds}${u.reserve && u.reserve !== 'none' ? ' · ' + esc(RESERVE_LABEL[u.reserve] || u.reserve) : ''}${kw.length ? `<br><span class="kw">${kw.map(esc).join(' · ')}</span>` : ''}</div>
      </div>
      <span class="pts">${Number(u.points) || 0}<small> pts</small></span>
    </li>`;
}

/** Sheet: Einheit anlegen / bearbeiten (unit = null → neu). */
export function openUnitSheet(ctx, p, unit) {
  const u = unit || { name: '', models: 5, oc: 1, move: 6, wounds: 1, keywords: [], character: false, points: 0, reserve: 'none', r: null };
  const rAuto = !unit || Math.abs((u.r || 0) - radiusFor(u.models)) < 1e-6;
  const num = (name, label, val, min, step) => `<label class="field"><span>${label}</span><input type="number" name="${name}" value="${esc(val)}" min="${min}" step="${step || 1}" inputmode="decimal"></label>`;
  const body = `
    <form class="unit-form" autocomplete="off">
      <label class="field"><span>Name</span><input type="text" name="name" value="${esc(u.name)}" placeholder="e.g. Boyz" required maxlength="60"></label>
      <div class="grid4">
        ${num('models', 'Models', u.models, 1)}
        ${num('oc', 'OC', u.oc, 0)}
        ${num('move', 'M (inches)', u.move, 0)}
        ${num('wounds', 'W', u.wounds, 1)}
      </div>
      <label class="field"><span>Keywords (comma-separated)</span><input type="text" name="keywords" value="${esc((u.keywords || []).filter(k => k !== 'CHARACTER').join(', '))}" placeholder="INFANTRY, BATTLELINE"></label>
      <label class="check"><input type="checkbox" name="character" ${u.character ? 'checked' : ''}> CHARACTER</label>
      <div class="grid4 two">
        ${num('points', 'Points', u.points, 0, 5)}
        <label class="field"><span>Token radius (inches)</span><input type="number" name="r" value="${rAuto ? '' : esc(u.r)}" placeholder="${radiusFor(u.models)}" min="0.3" step="0.1" inputmode="decimal"></label>
      </div>
      <label class="field"><span>Reserve</span>
        <select name="reserve">${Object.entries(RESERVE_LABEL).map(([k, v]) => `<option value="${k}" data-i18n ${u.reserve === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </label>
      <p class="muted xs">Token radius: automatic by number of models as long as the field is left empty.</p>
    </form>`;
  const read = el => {
    const f = el.querySelector('form');
    const g = n => f.elements[n];
    const name = g('name').value.trim();
    if (!name) { toast('Name missing', 'warn'); g('name').focus(); return null; }
    const out = {
      name, models: Number(g('models').value) || 1, oc: Number(g('oc').value) || 0, move: Number(g('move').value) || 0,
      wounds: Number(g('wounds').value) || 1, points: Number(g('points').value) || 0, reserve: g('reserve').value,
      character: g('character').checked,
      keywords: g('keywords').value.split(/[,;\n]/).map(k => k.trim().toUpperCase()).filter(Boolean)
    };
    const r = g('r').value.trim();
    out.r = r ? Number(r) : radiusFor(out.models);
    return out;
  };
  const actions = [];
  if (unit) actions.push({ label: 'Delete', kind: 'danger', keep: true, onClick: async (close) => {
    if (await confirmSheet({ title: 'Delete unit?', text: `“${unit.name}” will be removed from the army list.`, ok: 'Delete', kind: 'danger' })) {
      close();
      ctx.dispatch({ type: 'unit.remove', player: p, unitId: unit.id });
    }
  } });
  actions.push({ label: 'Cancel', kind: 'ghost' });
  actions.push({ label: unit ? 'Save' : 'Add', kind: 'primary', onClick: (close, el) => {
    const data = read(el);
    if (!data) return false;
    if (unit) ctx.dispatch({ type: 'unit.update', player: p, unitId: unit.id, patch: data });
    else ctx.dispatch({ type: 'unit.add', player: p, unit: data });
  } });
  sheet({
    title: unit ? 'Edit unit' : 'Add unit', cls: `p${p}`, body, actions,
    onOpen(el) {
      const f = el.querySelector('form');
      const rIn = f.elements.r, mIn = f.elements.models;
      mIn.addEventListener('input', () => { rIn.placeholder = radiusFor(Number(mIn.value) || 1); });
      f.addEventListener('submit', e => { e.preventDefault(); el.querySelector('.sheet-foot .btn.primary')?.click(); });
    }
  });
}

/** Sheet: Textimport (GW-App / New Recruit). */
export function openImportSheet(ctx, p) {
  const saved = armyChoices();
  const body = (saved.length ? `<div class="label">From My armies</div><div class="arm-pick">${saved.map(a => `<button type="button" class="arm-pickrow" data-army="${esc(a.id)}">
      <span><b>${esc(a.name)}</b><span class="muted xs"> ${esc(a.label)}</span></span><span class="muted xs">${esc(a.points)} pts${a.errors ? ' · ⚠ ' + esc(a.errors) : ''}</span></button>`).join('')}</div>
    <div class="label mt">Or import a text export</div>` : '') + `
    <p class="small muted">Text export from New Recruit (choose file or paste text). Units, number of models and wargear are recognised and linked to the datasheets.</p>
    <label class="field"><span>File (.txt)</span><input type="file" name="file" accept=".txt,text/plain"></label>
    <label class="field"><span>or paste text</span><textarea name="text" rows="8" placeholder="Paste the export from New Recruit or the GW app here" spellcheck="false"></textarea></label>`;
  sheet({
    title: `Import – ${playerLabel(ctx.state, p)}`, cls: `p${p} wide`, body,
    onOpen: (el, close) => {
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-army]');
        if (!b) return;
        close();
        await importSavedArmy(ctx, p, b.dataset.army);
      });
      const inp = el.querySelector('input[type=file]');
      if (inp) inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        if (f) el.querySelector('textarea').value = await f.text();
      });
    },
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Import', kind: 'primary', onClick: async (close, el) => {
        const text = el.querySelector('textarea').value;
        if (!text.trim()) { toast('No text pasted', 'warn'); return false; }
        close();
        // a second import would add the whole list again: replace the units (before the battle) or add to them
        let st1 = ctx.state;
        const have = st1.players[p].units;
        if (have.length && st1.stage !== 'battle' && st1.stage !== 'over'
          && await confirmSheet({ title: 'Replace units?', text: `${have.length} unit(s) are already in the list. Remove them and import the pasted list?`, ok: 'Replace', cancel: 'Add to them' })) {
          for (const u of have.slice()) st1 = (await ctx.dispatch({ type: 'unit.remove', player: p, unitId: u.id })) || st1;
        }
        const before = st1.players[p].units.length;
        const st = await ctx.dispatch({ type: 'army.import', player: p, text, keywords: await importEntries(ctx.state.players[p].faction, text) });
        if (st && st.players) {
          const n = st.players[p].units.length - before;
          toast(n > 0 ? `${n} unit${n === 1 ? '' : 's'} imported` : 'No units recognised – check the format', n > 0 ? 'ok' : 'warn');
        }
      } }
    ]
  });
}

/** A list from "My armies" into the game: faction + detachment (before the battle) and the units. */
export async function importSavedArmy(ctx, p, id) {
  let a;
  try { a = await armyForGame(id); } catch (e) { toast(e.message || String(e), 'bad'); return; }
  let st0 = ctx.state;
  let sizeNote = '', armyFailed = false;
  // the game size follows the lists (limit of the saved list, else its points; the other player's list counts too) –
  // unless the points limit was set by hand
  if (st0.stage === 'setup') {
    const SIZE_PTS = { strike: 2000, incursion: 1000 };
    let listPts = Number(a.limit) || 0;
    if (!listPts) { try { listPts = Number((armyChoices().find(x => x.id === id) || {}).points) || 0; } catch { listPts = 0; } }
    const otherPts = st0.players[1 - p].units.reduce((t, u) => t + (Number(u.points) || 0), 0);
    if (listPts > 0) {
      const want = Math.max(listPts, otherPts) <= 1000 ? 'incursion' : 'strike';
      if (want !== st0.opts.size && Number(st0.opts.points) === SIZE_PTS[st0.opts.size]) {
        const st = await ctx.dispatch({ type: 'opts.set', key: 'size', value: want });
        if (st) { st0 = st; sizeNote = ` · game size ${SIZE_LABEL[want]} (${st.opts.points} points)`; }
      }
    }
  }
  if (st0.stage !== 'battle' && st0.stage !== 'over' && a.faction) {
    const fac = (ctx.data.FACTIONS || []).find(f => f.id === a.faction);
    const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    // "Blade of Ultramar" (list) = "Blade of Ultramar (Ultramarines)" (game data): exact name first, then without the suffix
    const bare = s => norm(String(s || '').replace(/\s*\([^)]*\)\s*$/, ''));
    const all = fac ? fac.detachments || [] : [];
    const dets = a.detachments.map(n => all.find(d => norm(d.name) === norm(n)) || all.find(d => !isBoarding(d) && bare(d.name) === bare(n))).filter(Boolean).map(d => d.id);
    // the Force Dispositions its detachments make available (written by the builder's list text)
    const avail = /^\+\s*FORCE DISPOSITIONS AVAILABLE:\s*(.+?)\s*$/im.exec(a.text || '');
    const dispositions = avail ? avail[1].split(',').map(n => (ctx.data.WH.DISPOSITIONS || []).find(d => norm(d.name) === norm(n))).filter(Boolean).map(d => d.id) : [];
    const sa = await ctx.dispatch({ type: 'player.army', player: p, faction: a.faction, detachments: [...new Set(dets)], dispositions });
    if (sa) st0 = sa; else armyFailed = true;
    if (sa && a.detachments.length && dets.length < a.detachments.length) armyFailed = true;   // a Detachment of the list is unknown here
    // the list's Force Disposition (chosen in My armies) is this player's Disposition for the mission
    const fd = /^\+\s*FORCE DISPOSITION:\s*(.+?)\s*$/im.exec(a.text || '');
    const disp = fd && (ctx.data.WH.DISPOSITIONS || []).find(d => norm(d.name) === norm(fd[1].replace(/^\d+\.\s*/, '')));
    if (disp && st0.stage === 'setup' && st0.mission.dispositions[p] !== disp.id) {
      const dd = [null, null]; dd[p] = disp.id;
      st0 = (await ctx.dispatch({ type: 'mission.set', dispositions: dd })) || st0;
    }
  }
  const pl = st0.players[p];
  if (pl.units.length && !(await confirmSheet({ title: 'Replace units?', text: `${pl.units.length} unit(s) are already in the list. Remove them and take “${a.name}”?`, ok: 'Replace', cancel: 'Add to them' }))) {
    // keep the existing units
  } else if (pl.units.length && st0.stage !== 'battle' && st0.stage !== 'over') {
    for (const u of pl.units.slice()) await ctx.dispatch({ type: 'unit.remove', player: p, unitId: u.id });
  }
  const st = await ctx.dispatch({ type: 'army.import', player: p, text: a.text, keywords: await importEntries(a.faction, a.text, a.keywords) });
  if (!st || !st.players) { toast(`“${a.name}” could not be taken into the game – nothing was imported`, 'bad'); return; }
  if (armyFailed) toast(`“${a.name}”: units taken, but the faction / Detachment could not be set completely – check step 2 (Army)`, 'warn', 6000);
  else toast(`“${a.name}” taken into the game${sizeNote}`, 'ok', sizeNote ? 4500 : undefined);
}

const statNum = v => { const m = /\d+(?:\.\d+)?/.exec(String(v == null ? '' : v)); return m ? Number(m[0]) : 0; };
/** OC / M / W of a list unit from its datasheet: the profile of its most numerous model type (else the first profile). */
function datasheetStats(ds, lu) {
  const P = Array.isArray(ds && ds.profiles) ? ds.profiles : [];
  if (!P.length) return {};
  let pr = P[0];
  for (const l of (lu.modelLines || []).slice().sort((x, y) => y.count - x.count)) {
    const hit = P.find(x => normName(x.name) === normName(l.name));
    if (hit) { pr = hit; break; }
  }
  return { oc: statNum(pr.OC), move: statNum(pr.M), wounds: Math.max(1, statNum(pr.W)) };
}
/** "+1 CP at the start of …" rules of a datasheet without a roll (WH.CP_RULES): its faction abilities that are army rules
 *  (Da Boss, Transhuman Strategist – WARLORD) and its own abilities (Grand Strategist – on the battlefield). */
function cpRulesOf(ds, pack) {
  const clean = t => String(t || '').replace(/\*\*|\^\^/g, '').replace(/\s+/g, ' ').trim();
  const rules = WH.CP_RULES || [];
  const out = [];
  const ab = (ds && ds.abilities) || {};
  const army = (pack && pack.armyRules) || [];
  for (const f of ab.faction || []) {
    const r = army.find(x => normName(x.name) === normName(f));
    const m = r && rules.find(x => x.scope === 'army' && x.re.test(clean(r.text)));
    if (m) out.push({ name: r.name, when: m.when, req: m.req, cp: m.cp });
  }
  for (const a of ab.unit || []) {
    const m = rules.find(x => x.scope === 'unit' && x.re.test(clean(a.text)));
    if (m) out.push({ name: String(a.name || '').replace(/\s*\(.*\)\s*$/, ''), when: m.when, req: m.req, cp: m.cp });
  }
  return out;
}

/** army.import entries, one per unit of the list (in list order): the unit's datasheet values OC / M / W and – for a
 *  pasted list – its datasheet keywords; `given` = the army builder's entries (keywords, profile changes) for the list. */
export async function importEntries(factionId, text, given) {
  const units = parseArmyText(text);
  const data = factionId ? await loadDatasheets(factionId) : null;
  let allies = null;   // allied packs (Imperial Agents / Knights, Chaos Daemons / Knights) – loaded only when needed
  let pack = data;   // the datasheet file the last unit was found in (its army rules belong to that unit)
  const find = async name => {
    const own = data && Array.isArray(data.units) ? matchUnit(data.units, name) : null;
    pack = data;
    if (own || !factionId) return own;
    if (!allies) allies = (await Promise.all(ALLY_PACKS.filter(id => id !== factionId).map(id => loadDatasheets(id)))).filter(Boolean);
    for (const d of allies) { const hit = matchUnit(d.units, name); if (hit) { pack = d; return hit; } }
    return null;
  };
  const key = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  let at = 0;
  const out = [];
  for (const lu of units) {
    const j = Array.isArray(given) ? given.findIndex((k, i) => i >= at && k && key(k.name) === key(lu.name)) : -1;
    if (j >= 0) at = j + 1;
    const e = Object.assign({ name: lu.name }, j >= 0 ? given[j] : null);
    const ds = await find(lu.name);
    if (ds) {
      Object.assign(e, datasheetStats(ds, lu));
      if (j < 0) e.keywords = (ds.keywords || []).slice();
      if (ds.support) e.support = true;   // SUPPORT unit: may join a bodyguard unit next to its leader (core 24.22)
      const cp = cpRulesOf(ds, pack);
      if (cp.length) e.cpRules = cp;
    }
    out.push(e);
  }
  return out;
}

/** Force Dispositions available to a player's army (mission deck: "available to them (as determined when mustering
 *  armies)"): the union of its detachments' `dispositions` (ids) – null when the data does not say (all offered). */
function dispAllowed(ctx, p) {
  const fac = facOf(ctx, p), pl = ctx.state.players[p];
  const ds = fac ? (fac.detachments || []).filter(d => pl.detachments.includes(d.id) && Array.isArray(d.dispositions) && d.dispositions.length) : [];
  if (ds.length) return new Set(ds.flatMap(d => d.dispositions));
  // a list from My armies brings the dispositions its detachments allow (player.army { dispositions })
  return Array.isArray(pl.dispositions) && pl.dispositions.length ? new Set(pl.dispositions) : null;
}

/* ═══════════════ Schritt 4: Mission ═══════════════ */
export function missionStep(ctx, ui) {
  const { state, data } = ctx;
  const WH = data.WH;
  const m = state.mission;
  const att = m.attacker === 1 ? 1 : 0;
  const twist = WH.TWISTS.find(t => t.id === m.twist) || null;
  const samePrimary = !!m.primary[0] && m.primary[0] === m.primary[1];   // one card, not the same text twice
  return `
    <h3 class="title">Deployment</h3>
    <div class="dep-grid">${WH.DEPLOYMENTS.map(name => `
      <div class="card dep-card ${m.deployment === name ? 'active' : ''}" data-action="dep" data-name="${esc(name)}" role="radio" aria-checked="${m.deployment === name}" tabindex="0">
        ${mapThumb(name, att)}
        <div class="dep-name">${esc(name)}</div>
      </div>`).join('')}</div>

    <h3 class="title mt">Attacker / Defender</h3>
    <p class="muted small">The Attacker deploys in the upper zone (top of the map = Attacker's edge).</p>
    <div class="chips">${[0, 1].map(p => chip({ label: `${playerLabel(state, p)} is the Attacker`, cls: `p${p}`, on: m.attacker === p, action: 'attacker', data: { p } })).join('')}
      ${m.attacker != null ? `<span class="muted small self-center">${esc(playerLabel(state, 1 - m.attacker))} is the Defender</span>` : ''}</div>

    <h3 class="title mt">Dispositions → Primary mission</h3>
    <p class="muted small">Each player chooses a Disposition. The Primary Mission results from your own and your opponent's Disposition.</p>
    <div class="setup-cols tab${ui.tab} always">${[0, 1].map(p => `
      <div class="pcol p${p}" data-p="${p}">
        <div class="pcol-head"><span class="dot"></span>${esc(playerLabel(state, p))}</div>
        <div class="chips disp-chips">${WH.DISPOSITIONS.filter(d => { const ok = dispAllowed(ctx, p); return !ok || ok.has(d.id) || m.dispositions[p] === d.id; }).map(d => chip({ html: `<b>${esc(d.name)}</b>`, cls: `p${p} disp`, on: m.dispositions[p] === d.id, action: 'disp', data: { p, id: d.id } })).join('')}</div>
        ${samePrimary ? '' : primaryCard(WH, m.primary[p], p)}
      </div>`).join('')}</div>
    ${samePrimary ? `<p class="small muted same-primary">Both players have the same Primary Mission:</p>${primaryCard(WH, m.primary[0], m.attacker === 1 ? 1 : 0)}` : ''}

    <h3 class="title mt">Terrain layout</h3>
    ${terrainSection(ctx, m, att)}

    <h3 class="title mt">Twist</h3>
    <div class="grid twist-row">
      <label class="field"><span>Twist</span>
        <select data-field="twist"><option value="">No Twist</option>${WH.TWISTS.map(t => `<option value="${t.id}" ${m.twist === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      </label>
      ${m.twist === 'mirrored' ? `<label class="field"><span>Mirrored mission</span>
        <select data-field="mirrored">${WH.MIRRORED.map(id => `<option value="${id}" ${(m.mirrored || WH.MIRRORED[0]) === id ? 'selected' : ''}>${esc(WH.PRIMARY[id] ? WH.PRIMARY[id].name : id)}</option>`).join('')}</select>
      </label>` : ''}
    </div>
    ${twist ? `<p class="small twist-text"><b>${esc(twist.name)}:</b> ${esc(twist.t)}</p>` : ''}`;
}

/** Terrain layout of the game: the Event Companion layout (A/B/C) for the two Force Dispositions – the official table for
 *  this pairing, with zones, objectives inside terrain areas and 16 terrain areas – or one of the Chapter Approved layouts. */
function terrainSection(ctx, m, att) {
  const WH = ctx.data.WH;
  if (ctx.state.opts && ctx.state.opts.board === 'half') {
    const cur = m.terrainLayout || null;
    return `
    <p class="muted small">${esc('Half table: the Event Companion layouts are for the 44"×60" battlefield – generate a layout for this half table instead.')}</p>
    <div class="chips terrain-chips">
      ${btn({ label: String(cur || '').startsWith('random-') ? 'New random layout' : 'Random layout', kind: 'primary', small: true, action: 'terrain-random' })}
      ${chip({ label: 'No terrain layout', cls: 'sm', on: !cur, action: 'terrain', data: { id: '' } })}
      ${String(cur || '').startsWith('random-') ? `<span class="muted small self-center">${esc('Generated layout: half the Armageddon set placed by the Event Companion principles around this Deployment card.')}</span>` : ''}
    </div>`;
  }
  const nameOf = id => { const d = (WH.DISPOSITIONS || []).find(x => x.id === id); return d ? d.name : null; };
  const dispA = nameOf(m.dispositions[att]), dispD = nameOf(m.dispositions[1 - att]);
  const cur = m.terrainLayout || null;
  const curEc = cur && LAYOUTS11.find(l => l.id === cur);
  const pairing = dispA && dispD ? VARIANTS11.map(v => findLayout11(dispA, dispD, v)).filter(Boolean) : [];
  const other = curEc && !pairing.some(l => l.id === curEc.id) ? curEc : null;
  return `
    <p class="muted small">Warhammer Event Companion (11th edition): three official layouts per pairing of Force Dispositions – deployment zones, objectives inside terrain areas and 16 terrain areas. The 3D battle table shows the chosen layout.</p>
    <div class="chips terrain-chips">
      ${pairing.length ? pairing.map(l => chip({ html: `<b>Layout ${esc(l.variant)}</b> <span class="muted">${esc(l.attacker.disposition)} vs ${esc(l.defender.disposition)}</span>`, on: cur === l.id, action: 'terrain', data: { id: l.id } })).join('')
        : `<span class="muted small self-center">Choose both Dispositions – then the three Event Companion layouts of this pairing appear here.</span>`}
      ${other ? chip({ html: `<b>Layout ${esc(other.variant)}</b> <span class="muted">${esc(other.attacker.disposition)} vs ${esc(other.defender.disposition)}</span>`, on: true, action: 'terrain', data: { id: other.id } }) : ''}
    </div>
    <div class="chips terrain-chips mt">
      ${(ctx.data.TERRAIN_LAYOUTS || []).map(t => chip({ label: t.short || t.name, cls: 'sm', on: cur === t.id, action: 'terrain', data: { id: t.id } })).join('')}
      ${chip({ label: 'No terrain layout', cls: 'sm', on: !cur, action: 'terrain', data: { id: '' } })}
      ${btn({ label: String(cur || '').startsWith('random-') ? 'New random layout' : 'Random layout', kind: 'ghost', small: true, action: 'terrain-random', title: 'The full Armageddon set placed by the Event Companion principles around the Deployment card' })}
    </div>
    ${cur && !curEc && !(ctx.data.TERRAIN_LAYOUTS || []).some(t => t.id === cur) ? `<p class="muted xs">Current: ${esc(cur)} (set by the VR headset).</p>` : ''}`;
}

function primaryCard(WH, id, p) {
  const c = id ? WH.PRIMARY[id] : null;
  if (!c) return `<div class="card flat muted center prim-card empty">The Primary Mission appears once both Dispositions are chosen.</div>`;
  return `
    <div class="card prim-card p${p}">
      <div class="card-head"><div class="title">${esc(c.name)}</div>${badge('Primary', `p${p}`)}</div>
      <p class="small">${esc(c.desc || '')}</p>
      <ul class="cond-list">${(c.c || []).map(x => `<li class="${x.sub ? 'sub' : ''}"><span class="vp">${vpText(x.vp)}</span><span>${esc(x.t)}${x.k === 'per' ? ' (each)' : ''}<span class="muted xs"> · ${esc(WH.TIMING_LABELS[x.w] || x.w)}${x.r && (x.r[0] !== 1 || x.r[1] !== 5) ? ` · R${x.r[0]}${x.r[1] !== x.r[0] ? `–${x.r[1]}` : ""}` : ''}</span></span></li>`).join('')}</ul>
    </div>`;
}

const vpText = (vp, mode) => {
  const v = vp && typeof vp === 'object' ? (mode === 'T' ? vp.T : vp.F) : vp;
  return v == null ? '' : `${v} VP`;
};

/** Kleine SVG-Vorschau eines Geländelayouts (44×60, Ursprung oben links). */
export function terrainThumb(layout) {
  let s = `<svg class="map-thumb terrain-thumb" viewBox="0 0 44 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="44" height="60" fill="var(--map-bg,#171D22)"/>
    <path d="M22 0V60M0 30H44" stroke="rgba(255,255,255,.12)" stroke-width=".3"/>`;
  for (const p of (layout && layout.pieces) || []) {
    const k = p.kind || 'ruin';
    const shape = k === 'crater' || k === 'wood'
      ? `<ellipse class="terrain ${esc(k)}" rx="${p.w / 2}" ry="${p.h / 2}"/>`
      : `<rect class="terrain ${esc(k)}" x="${-p.w / 2}" y="${-p.h / 2}" width="${p.w}" height="${p.h}" rx=".3"/>`;
    s += `<g transform="translate(${+p.x} ${+p.y}) rotate(${+(p.rot || 0)})">${shape}</g>`;
  }
  return s + `<rect width="44" height="60" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".5"/></svg>`;
}

/* ═══════════════ Schritt 5: Sekundärmissionen ═══════════════ */
export function secStep(ctx, ui, p) {
  const WH = ctx.data.WH;
  const sec = ctx.state.players[p].secondaries || { mode: 'tactical', fixed: [] };
  const mode = ui.secMode[p] || sec.mode;
  const sel = mode === 'fixed' ? (ui.fixedSel[p].length ? ui.fixedSel[p] : sec.fixed || []) : [];
  const fixedCards = Object.entries(WH.SECONDARY).filter(([, c]) => c.fixed);
  return `
    <div class="chips mode-chips">
      ${chip({ label: 'Tactical', cls: `p${p}`, on: mode === 'tactical', action: 'sec-mode', data: { p, mode: 'tactical' } })}
      ${chip({ label: 'Fixed', cls: `p${p}`, on: mode === 'fixed', action: 'sec-mode', data: { p, mode: 'fixed' } })}
      ${mode === 'fixed' ? badge(sel.length === 2 && sec.mode === 'fixed' ? 'saved' : `${sel.length}/2 chosen`, sel.length === 2 && sec.mode === 'fixed' ? 'ok' : 'warn') : badge('Deck: 18 cards', 'ok')}
    </div>
    ${mode === 'tactical' ? `
      <div class="card flat small sec-rules">
        <b>Tactical Missions</b>
        <ul>
          <li>At the start of each of your Command phases draw 2 cards (your hand grows, completed cards are discarded).</li>
          <li>Once per battle at the end of your Command phase: 1 CP → discard one card and draw a new one.</li>
          <li>End of turn: discard unachieved cards → +1 CP (once, regardless of how many).</li>
          <li>Max 15 VP per round, 45 VP per battle.</li>
        </ul>
      </div>` : `
      <div class="card flat small sec-rules">
        <b>Fixed Missions</b> – choose exactly two fixed cards; they apply for the whole battle (max 20 VP per card, 15 VP per round). Only the four Fixed-capable cards can be chosen; they score with the lower “F” values.
      </div>
      <div class="sec-grid">${fixedCards.map(([id, c]) => secCard(WH, id, c, p, sel.includes(id))).join('')}</div>`}`;
}

function secCard(WH, id, c, p, on) {
  const conds = (c.c || []).filter(x => !x.mode || x.mode === 'F');
  return `
    <div class="card sec-card ${on ? 'on' : ''}" data-action="sec-fixed" data-p="${p}" data-id="${esc(id)}" role="checkbox" aria-checked="${on}" tabindex="0">
      <div class="det-head"><span class="det-check" aria-hidden="true">${on ? '✓' : ''}</span><span class="det-name">${esc(c.name)}</span>${badge('Fixed', on ? 'ok' : '')}</div>
      <ul class="cond-list">${conds.map(x => x.k === 'choice'
        ? `<li><span class="vp"></span><span>${esc(x.t)}: ${(x.opts || []).map(o => `${esc(o.t)} (${vpText(o.vp, 'F')})`).join(' · ')}</span></li>`
        : `<li class="${x.sub ? 'sub' : ''}"><span class="vp">${vpText(x.vp, 'F')}</span><span>${esc(x.t)}${x.max ? `<span class="muted xs"> · max ${x.max}</span>` : ''}</span></li>`).join('')}</ul>
    </div>`;
}
