/* Player phone – HTML building blocks: pinned head, the three tabs (Army · Stratagems · Army list), the right column
 * of tiles (≥ 900 px) and the Setup/Deploy/Over stages. Pure (ctx, ui) → HTML; interaction via data-action
 * (delegation in player.js). The page explains no core rules – the Rulebook view (#/g/CODE/rules) does that. */
import { WH } from '../../data/rules.js';
import { esc, btn, chip } from './components.js';
import {
  pName, phaseOf, stepper, stratCard, armyOf, myUnits,
  detailsRule, detailsOpen, enhancementOf, leaderBuffs, origData, origMod, ensureOrig, cleanOrig, resShort, stratPhaseId, phasePill, turnBadge,
  effectItems, resourceFor, thresholdActive, thresholdDerive, choicePicked, toggleOn, counterNow, effectsOf, optionCost
} from './player-common.js';
import { DS, ensureDatasheets } from './player-common.js';
import { datasheetCard, datasheetMissing, datasheetGroupCard, memberWargearAbilities, abilityVisible } from './datasheet.js';
import { matchUnit, normName } from '../data/datasheets.js';

export const TABS = [['army', 'Army'], ['strats', 'Stratagems'], ['units', 'Army list']];
const OWN_PHASES = ['command', 'movement', 'shooting', 'charge', 'fight', 'end'];

// ---------------------------------------------------------------- Current game state (helper data)
export function nowOf(ctx) {
  const { state, me } = ctx;
  const battle = state.stage === 'battle';
  return { battle, side: battle ? (state.turn === me ? 'own' : 'opp') : null, phase: battle ? state.phase : null, round: state.round };
}
export const myUnitsCount = ctx => myUnits(ctx.state, ctx.me).length;

// ---------------------------------------------------------------- Head (pinned): round · whose turn · CP · VP · ⋯
export function renderHead(ctx, ui) {
  const { state, derived, me } = ctx;
  const opp = 1 - me;
  const now = nowOf(ctx);
  const vp = derived.vp || [{ total: 0 }, { total: 0 }];
  const cp = (state.players[me] || {}).cp || 0;
  const who = now.battle ? `<span class="pl-who p${state.turn}">${esc(pName(state, state.turn))}${state.turn === me ? ' (you)' : ''}</span>` : `<span class="pl-who muted">${state.stage === 'deploy' ? 'Deployment' : state.stage === 'over' ? 'Battle over' : 'Setup'}</span>`;
  return `<div class="pl-status">
      <div class="pl-status-main">
        <div class="pl-round">${now.battle ? `Round ${state.round}<span class="muted">/5</span>` : esc(state.stage === 'deploy' ? 'Deployment' : 'Setup')}</div>
        <div class="pl-turn p${now.battle ? state.turn : me}">${now.battle ? `${now.side === 'own' ? 'Your turn' : "Opponent's turn"} · ${who}` : who}</div>
      </div>
      <div class="pl-kpis">
        <div class="kpi p${me}"><b>${cp}</b><small>CP</small></div>
        ${headResources(ctx)}
        <div class="kpi vp"><b><span class="text-p${me}">${vp[me].total}</span><span class="muted">:</span><span class="text-p${opp}">${vp[opp].total}</span></b><small>VP</small></div>
      </div>
      <button class="btn ghost icon pl-more" type="button" data-action="more.open" aria-label="Settings, notes and links">⋯</button>
    </div>`;
}

/** Army resource counter(s) in the pinned head, next to CP: compact stepper + short name ("YP"). */
function headResources(ctx) {
  const { state, me } = ctx;
  const resources = (state.players[me] || {}).resources || [];
  return resources.map((r, index) => `<div class="kpi res p${me} pl-hres" title="${esc(r.name)}${r.max != null ? ' / max ' + r.max : ''}">
      ${stepper({ value: r.value || 0, min: 0, max: r.max, action: 'res.step', data: { index }, small: true, player: me, cls: 'hres' })}
      <small>${esc(resShort(r.name))}</small></div>`).join('');
}

export function renderTabs(ctx, ui) {
  return TABS.map(([id, label]) => chip({ label, on: ui.tab === id, action: 'tab', data: { tab: id }, cls: 'tab' })).join('');
}

/* ═══════════════ Tab 1: Army – ONLY what currently changes the game (data/effects, SCHEMA.md) ═══════════════ */
const scopePill = s => (s ? `<span class="fx-scope">${esc(s)}</span>` : '');
const fxInfoBtn = (p, key, name) => `<button type="button" class="btn ghost icon ds-info fx-info" data-action="fx.info" data-p="${p}" data-key="${esc(key)}" aria-label="Original text of ${esc(name)}">i</button>`;
const hint = parts => { const t = parts.filter(Boolean); return t.length ? `<div class="fx-hint">${t.map(esc).join(' · ')}</div>` : ''; };
/** Use of an effect option / toggle (ability.use key) that blocks it right now, or null. */
export function fxUse(state, p, key, limit) { return abilityUseOf(state, p, { key, limit: limit || 'battle' }); }
const rangeLabel = s => (s.min != null && s.max != null ? `${s.min}–${s.max}` : s.min != null ? `${s.min}+` : s.max != null ? `≤${s.max}` : '');

/** One row per effect: only the active state / option(s). opts.readOnly → no controls (opponent); opts.compact → tile. */
function fxRow(ctx, p, it, opts = {}) {
  const { state } = ctx;
  const e = it.e;
  const ro = !!opts.readOnly || !!opts.compact;
  const compact = !!opts.compact;
  const head = (title, sub) => `<div class="fx-top"><span class="fx-name">${esc(title)}${sub ? `<span class="fx-sep">:</span> <span class="fx-state">${esc(sub)}</span>` : ''}</span>${scopePill(e.scope)}${compact ? '' : fxInfoBtn(p, it.key, e.name)}</div>`;
  const line = t => (t ? `<div class="fx-effect">${esc(t)}</div>` : '');
  if (e.kind === 'threshold') {
    const a = thresholdActive(ctx, p, it);
    const cur = a.state;
    const seg = ro ? '' : `<div class="seg" role="group" aria-label="${esc(e.name)} state">${(e.states || []).map(s => {
      const on = !!cur && s.id === cur.id;
      return `<button type="button" class="seg-btn${on ? ' on' : ''}" data-action="fx.set" data-p="${p}" data-key="${esc(it.key)}" data-value="${esc(s.id)}" aria-pressed="${on}">${esc(s.name)}${rangeLabel(s) ? `<small>${esc(rangeLabel(s))} ${esc(a.res ? resShort(a.res.r.name) : '')}</small>` : ''}</button>`;
    }).join('')}</div>`;
    return `<div class="fx-row fx-threshold big" data-fx="${esc(it.key)}">${head(e.name, cur ? cur.name : '–')}${line(cur && cur.effect)}${seg}${compact ? '' : hint([e.decidedAt])}</div>`;
  }
  if (e.kind === 'choice') {
    const picked = choicePicked(state, p, it);
    const sel = (e.options || []).filter(o => picked.includes(o.id));
    if (compact && !sel.length) return '';
    const chips = ro ? '' : `<div class="seg wrap" role="group" aria-label="${esc(e.name)}">${(e.options || []).map(o => {
      const on = picked.includes(o.id);
      const used = o.limit === 'battle' && !on && !!fxUse(state, p, `opt:${it.key}:${o.id}`, 'battle');
      const oc = optionCost(it, o, picked);
      const cost = oc ? oc.cost : 0;
      const res = cost ? resourceFor(state, p, oc.resource) : null;
      const short = res ? resShort(res.r.name) : resShort(oc ? oc.resource : '');
      const poor = !on && cost > 0 && (!res || (Number(res.r.value) || 0) < cost);
      const sub = [cost ? `−${cost} ${short}` : '', o.limit === 'battle' ? (used ? 'used' : 'once per battle') : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="seg-btn${on ? ' on' : ''}${used ? ' used' : ''}${poor && !used ? ' poor' : ''}" data-action="fx.pick" data-p="${p}" data-key="${esc(it.key)}" data-value="${esc(o.id)}" aria-pressed="${on}"${used || poor || state.stage === 'over' ? ' disabled' : ''}>${esc(o.name)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    }).join('')}</div>`;
    const body = sel.length ? sel.map(o => `<div class="fx-effect">${sel.length > 1 ? `<b>${esc(o.name)}:</b> ` : ''}${esc(o.effect || '')}</div>`).join('') : `<div class="fx-none">${ro ? 'Nothing chosen' : 'Nothing chosen – pick:'}</div>`;
    return `<div class="fx-row fx-choice${sel.length ? '' : ' idle'}" data-fx="${esc(it.key)}">${head(e.name, sel.length === 1 ? sel[0].name : '')}${body}${chips}${compact ? '' : hint([e.when, e.duration])}</div>`;
  }
  if (e.kind === 'toggle') {
    const on = toggleOn(state, p, it);
    if (ro && !on) return '';
    const used = !on && !!e.limit && !!fxUse(state, p, `tog:${it.key}`, e.limit);
    const sw = ro ? '' : `<button type="button" class="fx-switch${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-action="fx.toggle" data-p="${p}" data-key="${esc(it.key)}"${used || state.stage !== 'battle' ? ' disabled' : ''}><span class="knob"></span><span class="sw-l">${on ? 'On' : used ? 'Used' : 'Off'}</span></button>`;
    return `<div class="fx-row fx-toggle${on ? '' : ' idle'}" data-fx="${esc(it.key)}"><div class="fx-top"><span class="fx-name">${esc(e.name)}</span>${scopePill(e.scope)}${sw}${compact ? '' : fxInfoBtn(p, it.key, e.name)}</div>${on ? line(e.effect) : ''}${compact ? '' : hint([e.limit ? limitLabel(e.limit) : '', e.when, e.duration])}</div>`;
  }
  if (e.kind === 'counter') {
    const c = counterNow(state, p, e);
    return `<div class="fx-row fx-counter" data-fx="${esc(it.key)}">${head(e.name, c ? c.label : '')}${line(c ? c.effect : e.effect)}</div>`;
  }
  return `<div class="fx-row fx-always" data-fx="${esc(it.key)}">${head(e.name, '')}${line(e.effect)}</div>`;
}

/** Fallback without an effects file: names only, original text behind (i). */
function fxFallback(ctx, p, opts = {}) {
  const { faction, detachments } = armyOf(ctx, p);
  if (!faction) return '<p class="muted small empty">No faction chosen.</p>';
  const o = origData(faction.id);
  const mod = origMod();
  if (!o) ensureOrig(faction.id, ctx.rerender);
  const rules = o && mod && mod.origArmyRules ? mod.origArmyRules(o) : [];
  const btn2 = (key, n) => (opts.compact ? '' : fxInfoBtn(p, key, n));
  const rows = (rules.length ? rules.map(r => r.name) : [faction.name]).map(n => `<div class="fx-row fx-name-only"><div class="fx-top"><span class="fx-name"><span class="muted">Army rule:</span> ${esc(n)}</span>${btn2('orig:army', n)}</div></div>`);
  detachments.forEach(d => rows.push(`<div class="fx-row fx-name-only"><div class="fx-top"><span class="fx-name"><span class="muted">Detachment:</span> ${esc(d.name)}</span>${btn2(`orig:det:${d.id}`, d.name)}</div></div>`));
  return rows.join('');
}

/** Active effect rows of player p (HTML). */
export function fxList(ctx, p, opts = {}) {
  const { status, items } = effectItems(ctx, p);
  if (status === 'loading') return '<p class="muted small empty">Loading …</p>';
  if (status === 'none') return fxFallback(ctx, p, opts);
  const rows = items.map(it => fxRow(ctx, p, it, opts)).filter(Boolean);
  return rows.length ? rows.join('') : '<p class="muted small empty">No army effect active.</p>';
}

/** Auto rule for threshold effects (mirrors "decided at the end of your Command phase"):
 * own turn starts and the stored state is from another turn → set the state derived from the resource value;
 * the resource changes during the own Command phase → follow it. Manual corrections stay (they do not change the resource). */
export function fxAutoActions(ctx, ui) {
  const { state, me } = ctx;
  if (state.stage !== 'battle' || state.turn !== me) return [];
  const { status, items } = effectItems(ctx, me);
  if (status !== 'ok') return [];
  ui.fxRes = ui.fxRes || {};
  const out = [];
  items.filter(it => it.e.kind === 'threshold').forEach(it => {
    const stored = ((state.players[me].effects) || {})[it.key];
    const res = resourceFor(state, me, it.e.resource);
    const v = res ? Number(res.r.value) || 0 : 0;
    const want = thresholdDerive(it.e, v);
    const fresh = !stored || stored.round !== state.round || stored.turn !== state.turn;
    const lastV = ui.fxRes[it.key];
    ui.fxRes[it.key] = v;
    const resChanged = lastV != null && lastV !== v && state.phase === 'command';
    if (want && (fresh || (resChanged && stored.value !== want.id))) out.push({ type: 'effect.set', player: me, key: it.key, value: want.id, label: it.e.name, display: want.name });
  });
  return out;
}

function enhancementsOfList(ctx) {
  const out = [];
  myUnits(ctx.state, ctx.me).forEach(u => (u.enhancements || []).forEach(name => {
    const e = enhancementOf(ctx, name);
    out.push({ name: e ? e.name : name, cost: e ? e.cost : null, text: e ? e.text : '', unit: u.name });
  }));
  return out;
}
const nk = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Short effect line of an enhancement from the effects file (source 'enhancement'), or null. */
function enhLine(ctx, name) {
  const { items } = effectItems(ctx, ctx.me);
  const hit = items.find(it => it.e.source === 'enhancement' && nk(it.e.enhancement || it.e.name) === nk(name));
  return hit ? hit.e.effect || '' : null;
}

export function renderArmy(ctx, ui) {
  const { state, me } = ctx;
  const opp = 1 - me;
  const pl = state.players[me] || {};
  const now = nowOf(ctx);
  const fxCard = `<div class="card p${me} fx-card"><div class="card-head"><div class="title">Active effects</div>${now.battle ? `<span class="muted xs">Round ${state.round} · ${now.side === 'own' ? 'your turn' : "opponent's turn"}</span>` : ''}</div>
    <div class="fx-list">${fxList(ctx, me)}</div></div>`;
  const enh = enhancementsOfList(ctx);
  const origLoaded = !!origData(pl.faction);
  const enhHtml = `<div class="card enh-card"><div class="card-head"><div class="title">Enhancements</div><span class="badge">${enh.length}</span></div>
    ${enh.length ? enh.map(e => {
      const sl = enhLine(ctx, e.name);
      return `<div class="enh"><div class="enh-head"><b>${esc(e.name)}</b><span class="enh-unit">${esc(e.unit)}</span>${e.text ? `<button type="button" class="btn ghost icon ds-info fx-info" data-action="enh.info" data-name="${esc(e.name)}" aria-label="Original text of ${esc(e.name)}">i</button>` : ''}</div>
      ${sl != null ? `<div class="enh-text">${esc(sl)}</div>` : e.text ? `<div class="enh-text clamp">${esc(cleanOrig(e.text))}</div>` : `<div class="muted xs">${origLoaded ? 'Not in the BSData (New Recruit) data.' : 'Loading …'}</div>`}</div>`;
    }).join('')
      : `<p class="muted small">No enhancements in your list${myUnits(state, me).length ? '' : ' (no army list imported)'}.</p>`}
  </div>`;
  const oppHtml = `<div class="card p${opp} opp-card">${detailsRule(ui, 'army:opp', `Opponent: ${pName(state, opp)} – active effects`, `<div class="fx-list">${fxList(ctx, opp, { readOnly: true })}</div>`)}</div>`;
  return `${fxCard}
    ${renderAbilityCard(ctx, ui)}
    ${enhHtml}
    ${oppHtml}`;
}

/* ═══════════════ Once-per-X ability tracker (army rule · detachment rules · datasheets · enhancements) ═══════════════ */
const LIMIT_LABEL = { battle: 'once per battle', round: 'once per battle round', turn: 'once per turn', phase: 'once per phase' };
/** Limit of a rule text (the name is scanned too, e.g. "Keep Huntin'! (Once per battle round, per army)"), or null if it is not a once-per-X rule.
 * "twice per battle" → 'battle' (see limitUses); "once per phase" and "only make one … move per phase" → 'phase' (booked like a turn limit). */
export function limitOf(text, name = '') {
  const t = `${String(name || '')} ${String(text || '')}`;
  if (/\b(?:once|twice) per (?:battle )?round\b/i.test(t)) return 'round';
  if (/\b(?:once|twice) per battle\b/i.test(t)) return 'battle';
  if (/\b(?:once|twice) per turn\b/i.test(t)) return 'turn';
  if (/\b(?:once|twice) per phase\b/i.test(t)) return 'phase';
  if (/\bonly (?:make|use|do|perform|issue|take|select|be affected by)\b[^.;]{0,60}?\bone\b[^.;]{0,60}?\bper (?:phase|turn)\b/i.test(t)) return 'turn';
  if (/\bone time only\b|\bonly once\b/i.test(t)) return 'battle';
  return null;
}
/** Number of uses the wording allows (2 for "twice per …", else 1). The tracker books a single use; the badge says "twice". */
export const limitUses = (text, name = '') => (/\btwice per (?:battle round|battle|round|turn|phase)\b/i.test(`${name || ''} ${text || ''}`) ? 2 : 1);
export const limitLabel = l => LIMIT_LABEL[l] || l;
/** Badge text of a tracker entry ("twice per battle" when the wording allows two uses). */
export const entryLabel = e => (e && e.uses > 1 ? limitLabel(e.limit).replace(/^once/, 'twice') : limitLabel(e && e.limit));
const keyOf = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** Paragraphs of a rule text, each with the last bold/short heading above it (or the fallback name): [{ name, text }]. */
function namedParagraphs(text, fallback) {
  const out = [];
  let head = fallback;
  for (const raw of String(text || '').split(/\n{2,}|\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const plain = cleanOrig(t).replace(/:\s*$/, '').trim();
    // A mixed-case lead-in ending with ":" ("Unless otherwise stated:") introduces bullets of the same rule – not a heading
    if (/:\s*$/.test(t) && !/^\*\*/.test(t) && /\p{Ll}/u.test(plain)) { head = fallback; continue; }
    const isHead = /^\*\*[^*]+\*\*:?$/.test(t) || (plain.length <= 48 && !/[.!?]/.test(plain) && !/^[-•]/.test(t));
    if (isHead) { head = plain; continue; }
    const m = /^([A-Z][A-Z0-9 '’\-\/]{2,40}):\s+/.exec(plain);   // "METHODICAL ANNIHILATION: Each time …"
    out.push({ name: m ? m[1].trim() : head, text: cleanOrig(t) });
  }
  return out;
}
/** Trackable once-per-X abilities of the player's army: [{ key, name, limit, source, kind, text }]. Missing data is loaded (rerender on arrival). */
export function abilityTracker(ctx) {
  const { state, me } = ctx;
  const { faction, detachments } = armyOf(ctx, me);
  const out = [];
  const seen = new Set();
  const add = (key, name, text, source, kind) => {
    const limit = limitOf(text, name);
    if (!limit || seen.has(key)) return;
    // Army and detachment rules often repeat the same rule (e.g. Combat Doctrines) – one toggle per name and limit
    const dupKey = (kind === 'army' || kind === 'detachment') ? `rule:${keyOf(name)}:${limit}` : null;
    if (dupKey && seen.has(dupKey)) return;
    if (dupKey) seen.add(dupKey);
    seen.add(key);
    out.push({ key, name: String(name || key), limit, uses: limitUses(text, name), source, kind, text: cleanOrig(text) });
  };
  if (!faction) return out;
  const o = origData(faction.id);
  const mod = origMod();
  if (!o) ensureOrig(faction.id, ctx.rerender);
  // (a) army rule(s) – BSData (New Recruit) only, one source for everything about the army
  const armyRules = o && mod && mod.origArmyRules ? mod.origArmyRules(o) : [];
  const src = `${faction.name} · army rule`;
  armyRules.forEach(r => namedParagraphs(r.text, r.name).forEach(pp => add(`army:${keyOf(pp.name)}`, pp.name, pp.text, src, 'army')));
  // (b) detachment rule(s)
  detachments.forEach(d => {
    const rules = o && mod && mod.origDetachmentRule ? mod.origDetachmentRule(o, d.name) : [];
    const list = rules.flatMap(r => namedParagraphs(r.text, r.name));
    list.forEach(pp => add(`det:${d.id}:${keyOf(pp.name)}`, pp.name, pp.text, `${d.name} · Detachment rule`, 'detachment'));
  });
  // (c) datasheet abilities + leader text of every unit in the list (one entry per unit instance: "Warboss (1)")
  const units = myUnits(state, me);
  if (units.length && !DS.cache.has(faction.id)) ensureDatasheets(faction.id, ctx.rerender);
  const data = DS.cache.get(faction.id) || { units: [] };
  const counts = new Map();
  units.forEach(u => counts.set(u.name, (counts.get(u.name) || 0) + 1));
  const nth = new Map();
  units.forEach(u => {
    const n = (nth.get(u.name) || 0) + 1; nth.set(u.name, n);
    const label = counts.get(u.name) > 1 ? `${u.name} (${n})` : u.name;
    const ds = data.units.length ? matchUnit(data.units, u.name) : null;
    if (ds) {
      const ab = ds.abilities || {};
      [].concat(ab.unit || [], memberWargearAbilities(ds, u)).filter(a => abilityVisible(a, myDetNames(ctx), (u.enhancements || []).map(normName))).forEach(a => add(`unit:${u.id}:${keyOf(a.name)}`, a.name, a.text, label, 'unit'));
      if (ds.leader && ds.leader.text) add(`unit:${u.id}:leader`, `${ds.name} – Leader`, ds.leader.text, label, 'unit');
    }
    // (d) enhancements of the list
    (u.enhancements || []).forEach(name => {
      const e = enhancementOf(ctx, name);
      if (e && e.text) add(`enh:${keyOf(e.name)}`, e.name, e.text, `Enhancement · ${label}`, 'enhancement');
    });
  });
  return out;
}
/** The abilityUses entry that blocks `entry` right now (battle: any; round: same round; turn/phase: same round+turn), or null. */
export function abilityUseOf(state, me, entry) {
  const uses = (state.abilityUses || []).filter(u => u.player === me && u.key === entry.key);
  return [...uses].reverse().find(u => entry.limit === 'battle' || (u.round === state.round && (entry.limit === 'round' || u.turn === state.turn))) || null;
}
export function abilityByKey(ctx, key) { return abilityTracker(ctx).find(e => e.key === key) || null; }

function abilityRows(ctx, entries) {
  const { state, me } = ctx;
  const inBattle = state.stage === 'battle';
  return `<ul class="abil-list">${entries.map(e => {
    const use = abilityUseOf(state, me, e);
    const when = use ? (e.limit === 'battle' ? `R${use.round}` : `R${use.round} · ${use.turn === me ? 'your turn' : 'opp. turn'}`) : '';
    return `<li class="abil${use ? ' used' : ''} kind-${esc(e.kind)}">
      <button type="button" class="abil-toggle" data-action="ability.toggle" data-key="${esc(e.key)}"${inBattle ? '' : ' disabled'} aria-pressed="${use ? 'true' : 'false'}" aria-label="${esc(e.name)}: ${use ? 'used – tap to undo' : 'available – tap to mark as used'}">
        <span class="abil-main"><b class="abil-name">${esc(e.name)}</b><span class="abil-src muted xs">${esc(e.source)}</span></span>
        <span class="abil-right"><span class="badge lim">${esc(entryLabel(e))}</span><span class="abil-state ${use ? 'used' : 'avail'}">${use ? `used (${esc(when)})` : (inBattle ? 'available' : 'in battle')}</span></span>
      </button>
      <button type="button" class="btn ghost icon ds-info abil-info" data-action="ability.info" data-key="${esc(e.key)}" aria-label="Show text of ${esc(e.name)}">i</button>
    </li>`;
  }).join('')}</ul>`;
}
export function renderAbilityCard(ctx, ui) {
  const entries = abilityTracker(ctx);
  const inner = entries.length ? abilityRows(ctx, entries) : `<p class="muted small empty">No once-per-battle/round/turn abilities recognised${myUnits(ctx.state, ctx.me).length ? '' : ' (no army list imported)'}.</p>`;
  return `<div class="card p${ctx.me} abil-card">${detailsOpen(ui, 'army:abil', `<span class="army-title"><span class="title">Once-per abilities</span><span class="badge">${entries.length}</span></span>`, inner, 'abil-d', true)}</div>`;
}

/* ═══════════════ Tab 2: Stratagems – fixed sections in play order, one colour per phase ═══════════════ */
export function renderStratFilters(ctx, ui) {
  const f = [['all', 'All'], ['own', 'My turn'], ['opp', "Opponent's turn"]];
  return f.map(([id, label]) => chip({ label, on: ui.sfilter === id, action: 'sfilter', data: { filter: id }, cls: 'sm' })).join('');
}

/** Fixed sections: my phases in order, opponent's phases in order, any time. */
export function stratSections() {
  return OWN_PHASES.map(id => ({ id: `own:${id}`, side: 'own', phase: id }))
    .concat(OWN_PHASES.map(id => ({ id: `opp:${id}`, side: 'opp', phase: id })))
    .concat([{ id: 'any', side: 'any', phase: null }]);
}

function stratsOf(list, sec) {
  if (sec.side === 'any') return list.filter(s => (s.ph || ['any']).includes('any'));
  return list.filter(s => (s.ph || []).includes(sec.phase) && (s.whose === 'either' || s.whose === sec.side));
}

/** Stratagems usable in the current turn (own/opponent) – for the "Usable this turn" tile. */
export function usableThisTurn(ctx) {
  const now = nowOf(ctx);
  if (!now.battle) return [];
  return (ctx.derived.stratagems[ctx.me] || []).filter(s => s.available && (s.whose === 'either' || s.whose === now.side));
}

export function renderStrats(ctx, ui) {
  const { derived, me } = ctx;
  const now = nowOf(ctx);
  const list = derived.stratagems[me] || [];
  effectsOf(ctx, (ctx.state.players[me] || {}).faction);   // stratagem add-ons (loads once, rerenders)
  const f = ui.sfilter || 'all';
  const secs = stratSections().filter(sec => f === 'all' || sec.side === 'any' || sec.side === f);
  const html = secs.map(sec => {
    const cur = now.battle && (sec.side === now.side || sec.side === 'any');
    const items = stratsOf(list, sec);
    if (!items.length) return '';
    const phase = sec.phase || 'any';
    const title = sec.side === 'any' ? 'Any time' : phaseOf(sec.phase).full;
    const badge = sec.side === 'any' ? '' : turnBadge(sec.side);
    const nowTag = now.battle && sec.side === now.side ? '<span class="side-tag now">Now</span>' : '';
    return `<section class="phase card ph-${esc(phase)} side-${esc(sec.side)}${cur ? ' cur' : ''}" data-sec-id="${esc(sec.id)}" id="sec-${esc(sec.id.replace(':', '-'))}">
      <h2 class="phase-h"><span class="phase-title">${esc(title)}</span>${badge}${nowTag}<span class="muted xs cnt">${items.length}</span></h2>
      <div class="strat-list">${items.map(s => stratCard(s, ctx, ui, { phase, sec: sec.id })).join('')}</div>
    </section>`;
  }).join('');
  return html || '<p class="muted center">No Stratagems.</p>';
}

/* ═══════════════ Tab 3: Army list – datasheets like New Recruit, but better ═══════════════ */
// DS cache + ensureDatasheets live in player-common.js (shared with affectedUnits / unitDatasheet).

/** Find a list unit by a name written in the import ("Boyz[1]", "Warboss"). Exact → prefix/contains → token overlap. */
function findListUnit(units, name, exclude) {
  const q = normName(name);
  if (!q) return null;
  const cands = units.filter(u => u !== exclude).map(u => [normName(u.name), u]);
  let hit = cands.find(([n]) => n === q);
  if (hit) return hit[1];
  hit = cands.find(([n]) => n.startsWith(q + ' ') || q.startsWith(n + ' ') || n.includes(q) || q.includes(n));
  if (hit) return hit[1];
  const qt = new Set(q.split(' '));
  let best = null, bestScore = 0;
  for (const [n, u] of cands) {
    const ut = n.split(' ').filter(Boolean);
    const common = ut.filter(t => qt.has(t)).length;
    const score = common / Math.max(ut.length, qt.size);
    if (common && score > bestScore) { bestScore = score; best = u; }
  }
  return bestScore >= 0.5 ? best : null;
}

/** Leader links of the list: Map unitId → { leading: unit|null, leadingName, ledBy: unit|null, ledByName }. */
/** Lists imported before the ATTACHED UNITS parser kept New Recruit's "Attached as: Leader (Character)" / "Bodyguard"
 *  as wargear. In the export each group lists its leader(s) first, then the bodyguard → rebuild the links from that order. */
const roleOf = u => ((u.wargear || []).some(w => /^leader\b/i.test(w.name || w)) ? 'leader' : (u.wargear || []).some(w => /^bodyguard$/i.test(w.name || w)) ? 'bodyguard' : null);
function legacyAttachments(units) {
  const out = units.map(u => Object.assign({}, u));
  let pending = [];
  for (const u of out) {
    const r = roleOf(u);
    if (r === 'leader') pending.push(u);
    // a link set by hand (picker, "leading" field) always wins – only empty leaders are filled from the export order
    else if (r === 'bodyguard') { pending.forEach(L => { if (!L.leading && !L.attachedTo) L.leading = u.id; }); pending = []; }
  }
  return out;
}

export function resolveLeaders(unitsIn) {
  const units = legacyAttachments(unitsIn);
  const orig = new Map(unitsIn.map(u => [u.id, u]));
  const links = new Map();
  const get = u => { u = orig.get(u.id) || u; let l = links.get(u.id); if (!l) { l = { leading: null, leadingName: null, ledBy: null, ledByName: null }; links.set(u.id, l); } return l; };
  for (const u of units) {
    if (u.leading) {
      const l = get(u);
      // set in the app: unit id (unique even with two units of the same name); from the import: the name as written
      const byId = units.find(x => x.id === u.leading && x !== u);
      l.leadingName = byId ? byId.name : u.leading;
      const t0 = byId || findListUnit(units, u.leading, u);
      const t = t0 && (orig.get(t0.id) || t0), self = orig.get(u.id) || u;   // hand out the original unit objects
      if (t) { l.leading = t; const lt = get(t); if (!lt.ledBy) { lt.ledBy = self; lt.ledByName = lt.ledByName || u.name; } }
    }
    if (u.attachedTo) {
      const l = get(u);
      l.ledByName = u.attachedTo;
      const t0 = findListUnit(units, u.attachedTo, u);
      const t = t0 && (orig.get(t0.id) || t0), self = orig.get(u.id) || u;
      if (t) { l.ledBy = t; const lt = get(t); if (!lt.leading) { lt.leading = self; lt.leadingName = lt.leadingName || u.name; } }
    }
  }
  return links;
}

/** Normalised names of the player's detachments (for detachment-bound abilities, see abilityVisible). */
function myDetNames(ctx) { return armyOf(ctx, ctx.me).detachments.map(d => normName(d.name)); }

/** Units a leader may be attached to: from the datasheet's Leader text ("… attached to the following units: A, B"). */
function leaderTargets(ds) {
  const l = ds && ds.leader;
  if (!l) return null;
  const names = (l.canLead || []).length ? l.canLead : String(l.text || '').replace(/^[^:]*:/, '').split(/,|\band\b|\n|•/).map(x => x.replace(/[*^.]/g, '').trim()).filter(Boolean);
  return names.map(normName);
}
/** "Attached to" picker for a leader (select, data-change="unit.attach"). */
function attachPicker(u, ds, units, sheets, links) {
  const allowed = leaderTargets(ds);
  if (!allowed) return '';
  const cands = units.filter(x => x !== u && !leaderTargets(sheets.get(x.id)) && (!allowed.length || allowed.includes(normName(x.name)) || allowed.includes(normName((sheets.get(x.id) || {}).name))));
  if (!cands.length) return '';
  const cur = (links.get(u.id) || {}).leading;
  const nth = x => { const same = units.filter(y => y.name === x.name); return same.length > 1 ? ` (${same.indexOf(x) + 1})` : ''; };
  return `<label class="ds-attach-pick"><span>${esc(u.name)} attached to</span><select data-change="unit.attach" data-unit="${esc(u.id)}">
    <option value="">– not attached –</option>${cands.map(x => `<option value="${esc(x.id)}"${cur === x ? ' selected' : ''}>${esc(x.name + nth(x))}</option>`).join('')}</select></label>`;
}

/** Enhancements of a unit resolved against the original texts. */
function unitEnhancements(ctx, u) {
  return (u.enhancements || []).map(name => { const e = enhancementOf(ctx, name); return e ? e : { name, cost: null, text: '' }; });
}

/** Buffs the leader unit `leader` grants to its bodyguard (datasheet abilities + enhancements). */
export function buffsOf(ctx, data, leader) {
  const ds = data.units.length ? matchUnit(data.units, leader.name) : null;
  return leaderBuffs(ds, unitEnhancements(ctx, leader), leader, myDetNames(ctx));
}
/** Buffs of a leader unit by id (for the info sheet). */
export function buffsOfId(ctx, leaderId) {
  const pl = ctx.state.players[ctx.me] || {};
  const leader = myUnits(ctx.state, ctx.me).find(u => u.id === leaderId);
  if (!leader) return { leader: null, buffs: [] };
  return { leader, buffs: buffsOf(ctx, DS.cache.get(pl.faction) || { units: [] }, leader) };
}

export function renderUnits(ctx, ui) {
  const { state, me } = ctx;
  const units = myUnits(state, me);
  if (!units.length) {
    return `<div class="card"><div class="title">No army list</div><p class="muted small">Add your list from New Recruit (file or text). Each unit then appears here as a datasheet with stats, weapons, abilities, enhancements and leader attachments.</p>
      ${btn({ label: 'Add army list', kind: `p${me}`, cta: true, action: 'army-import' })}</div>`;
  }
  return `<div class="search card"><input type="search" data-search placeholder="Filter units by name or keyword …" value="${esc(ui.search || '')}" autocomplete="off" aria-label="Filter units"></div>${renderUnitList(ctx, ui)}
    <div class="row center mt">${btn({ label: 'Add army list', kind: 'ghost', small: true, action: 'army-import' })}</div>`;
}

export function renderUnitList(ctx, ui) {
  const { state, me } = ctx;
  const pl = state.players[me] || {};
  const units = myUnits(state, me);
  const fac = pl.faction;
  if (fac && !DS.cache.has(fac)) { ensureDatasheets(fac, ctx.rerender); return `<div class="ds-wrap"><div class="card muted small">Loading datasheets …</div></div>`; }
  const data = DS.cache.get(fac) || { units: [] };
  if (units.some(u => (u.enhancements || []).length) && !origData(fac)) ensureOrig(fac, ctx.rerender);
  const links = resolveLeaders(units);
  const q = String(ui.search || '').trim().toLowerCase();
  const sheets = new Map(units.map(u => [u.id, data.units.length ? matchUnit(data.units, u.name) : null]));
  // Leader + led unit = one card: every leader whose target is in the list (with datasheets on both sides) joins it
  const leadersOf = new Map();
  for (const u of units) {
    const l = links.get(u.id);
    if (l && l.leading && sheets.get(u.id) && sheets.get(l.leading.id)) {
      if (!leadersOf.has(l.leading.id)) leadersOf.set(l.leading.id, []);
      leadersOf.get(l.leading.id).push(u);
    }
  }
  const merged = new Set([...leadersOf.values()].flat().map(u => u.id));
  const hayOf = u => { const ds = sheets.get(u.id); return [u.name, ...(u.keywords || []), ...((ds && ds.keywords) || []), ...((ds && ds.factionKeywords) || [])].join(' ').toLowerCase(); };
  const shown = units.filter(u => !merged.has(u.id) && (!q || [u, ...(leadersOf.get(u.id) || [])].some(m => hayOf(m).includes(q))));
  const cards = shown.map((u, i) => {
    const ds = sheets.get(u.id);
    const key = `ds:${u.id}`;
    const first = i === 0;
    const open = first ? !ui.closed.has(key) : ui.open.has(key);
    const ldrs = leadersOf.get(u.id);
    if (ldrs && ds) {
      return datasheetGroupCard({
        body: { ds, unit: u, enh: unitEnhancements(ctx, u) },
        leaders: ldrs.map(L => ({ ds: sheets.get(L.id), unit: L, enh: unitEnhancements(ctx, L), buffs: buffsOf(ctx, data, L) }))
      }, { open, key, defaultOpen: first, detachments: myDetNames(ctx), top: ldrs.map(L => attachPicker(L, sheets.get(L.id), units, sheets, links)).join('') });
    }
    const l = links.get(u.id) || {};
    let attach = null;
    if (l.leadingName || l.leading) {
      attach = { role: 'leader', name: l.leading ? l.leading.name : l.leadingName, resolved: !!l.leading, marks: new Set(leaderBuffs(ds, unitEnhancements(ctx, u), u, myDetNames(ctx)).map(b => b.name)) };
    } else if (l.ledByName || l.ledBy) {
      attach = { role: 'bodyguard', name: l.ledBy ? l.ledBy.name : l.ledByName, resolved: !!l.ledBy, leaderId: l.ledBy ? l.ledBy.id : '', buffs: l.ledBy ? buffsOf(ctx, data, l.ledBy) : [] };
    }
    return ds ? datasheetCard(ds, { unit: u, compact: true, open, key, defaultOpen: first, enhancements: unitEnhancements(ctx, u), attach, detachments: myDetNames(ctx), enhNames: [u, l.ledBy].filter(Boolean).flatMap(m => (m.enhancements || []).map(normName)), top: attachPicker(u, ds, units, sheets, links) }) : datasheetMissing(u, { attach });
  }).join('');
  const found = units.filter(u => sheets.get(u.id)).length;
  const pts = units.reduce((x, u) => x + (u.points || 0), 0);
  return `<div class="ds-wrap p${me}">
    <p class="muted xs ds-summary">${units.length} unit${units.length === 1 ? '' : 's'}${pts ? ` · ${pts} pts` : ''} · ${found}/${units.length} with a datasheet${data.version ? ` · data ${esc(String(data.version))}` : ''}${!data.units.length ? ' · no datasheets available for this faction' : ''}${q ? ` · ${shown.length} match${shown.length === 1 ? '' : 'es'}` : ''}</p>
    ${cards || '<p class="muted small center">No unit matches.</p>'}</div>`;
}

/* ═══════════════ Right column (≥ 900 px): general-info tiles ═══════════════ */
export function renderSide(ctx, ui) {
  const { state, derived, me } = ctx;
  const opp = 1 - me;
  const now = nowOf(ctx);
  const vp = derived.vp || [{ total: 0 }, { total: 0 }];
  const pl = state.players[me] || {};
  const tiles = [];
  tiles.push(`<div class="card tile tile-kpi"><div class="tile-title">Points</div><div class="pl-kpis">
    <div class="kpi p${me}"><b>${pl.cp || 0}</b><small>CP</small></div>
    <div class="kpi vp"><b><span class="text-p${me}">${vp[me].total}</span><span class="muted">:</span><span class="text-p${opp}">${vp[opp].total}</span></b><small>VP</small></div></div></div>`);
  tiles.push(`<div class="card tile tile-now p${now.battle ? state.turn : me}"><div class="tile-title">Now</div>
    <div class="tile-big">${now.battle ? `Round ${state.round}<span class="muted">/5</span>` : esc(state.stage === 'deploy' ? 'Deployment' : 'Setup')}</div>
    ${now.battle ? `<div class="pl-turn p${state.turn}">${now.side === 'own' ? 'Your turn' : "Opponent's turn"} · ${esc(pName(state, state.turn))}</div>` : ''}</div>`);
  tiles.push(`<div class="card tile tile-fx p${me}"><div class="tile-title">Active effects</div><div class="fx-list">${fxList(ctx, me, { compact: true })}</div></div>`);
  const resources = pl.resources || [];
  if (resources.length) {
    tiles.push(`<div class="card tile tile-res p${me}"><div class="tile-title">Resource</div>${resources.map((r, index) => `<div class="res"><div class="row between nowrap"><div class="res-name">${esc(r.name)}${r.max != null ? `<span class="muted xs"> / max ${r.max}</span>` : ''}</div>
      ${stepper({ value: r.value || 0, min: 0, max: r.max, action: 'res.step', data: { index }, small: true, player: me })}</div></div>`).join('')}</div>`);
  }
  const abil = abilityTracker(ctx);
  if (abil.length) tiles.push(`<div class="card tile tile-abil p${me}"><div class="tile-title">Once-per abilities</div>${abilityRows(ctx, abil)}</div>`);
  const usable = usableThisTurn(ctx);
  tiles.push(`<div class="card tile"><div class="tile-title">Usable this turn</div>${usable.length ? `<ul class="usable">${usable.map(s => { const ph = stratPhaseId(s, null, state.phase); return `<li><button type="button" class="usable-btn ph-${esc(ph)}" data-action="strat.goto" data-strat="${esc(s.id)}"><span class="usable-name">${esc(s.name)}</span>${phasePill(ph)}<span class="badge num cp">${Number(s.cost) || 0} CP</span></button></li>`; }).join('')}</ul>` : `<p class="muted small empty">${now.battle ? 'No Stratagem available right now.' : 'Available during the battle.'}</p>`}</div>`);
  const units = myUnits(state, me);
  if (units.length) {
    const links = resolveLeaders(units);
    const pairs = units.filter(u => { const l = links.get(u.id); return l && (l.leading || l.leadingName); }).map(u => { const l = links.get(u.id); return { leader: u.name, unit: l.leading ? l.leading.name : l.leadingName, ok: !!l.leading }; });
    tiles.push(`<div class="card tile"><div class="tile-title">Leader attachments</div>${pairs.length ? `<ul class="pairs">${pairs.map(p => `<li><b>${esc(p.leader)}</b> <span class="muted">→</span> ${esc(p.unit)}${p.ok ? '' : ' <span class="muted xs">(not in list)</span>'}</li>`).join('')}</ul>` : '<p class="muted small empty">No leader attachments in the list.</p>'}</div>`);
  }
  return tiles.join('');
}

/* ═══════════════ Stages: setup / deployment / over ═══════════════ */
export function renderSetupStage(ctx) {
  return `<div class="pl-body"><div class="card center">
      <div class="title">The game is still in setup</div>
      <p class="muted">Players, armies and mission are set in the setup. Your army, stratagems and army list will appear here afterwards.</p>
      ${btn({ label: 'Go to setup', kind: 'primary', cta: true, action: 'nav', data: { href: ctx.roleHash(ctx.code, ctx.me, 'setup') } })}
      <p class="mt">${btn({ label: 'Lobby', kind: 'ghost', small: true, action: 'nav', data: { href: '#/' } })}</p>
    </div></div>`;
}

export function renderDeploy(ctx, ui) {
  return `<div class="card p${ctx.me} deploy-card"><div class="card-head"><div class="title">Deployment</div><span class="badge warn">the Score tablet runs the sequence</span></div>
      <p class="small">Attacker/Defender, alternating deployment and the roll-off for the first turn are handled on the Score tablet. Deployment and reserve rules are in the Rulebook.</p>
      ${btn({ label: 'Rulebook', kind: 'ghost', small: true, action: 'nav', data: { href: `#/g/${ctx.code}/rules` } })}</div>`;
}

export function renderOver(ctx) {
  const { state, derived, me, code } = ctx;
  const vp = derived.vp || [{ total: 0, primary: 0, secondary: 0, bonus: 0 }, { total: 0, primary: 0, secondary: 0, bonus: 0 }];
  const winner = vp[0].total > vp[1].total ? 0 : vp[1].total > vp[0].total ? 1 : null;
  return `<div class="pl-body">
    <div class="card ${winner == null ? '' : 'p' + winner} center over-banner">
      <div class="title">${winner == null ? 'Draw' : `${esc(pName(state, winner))} wins`}</div>
      <div class="over-score"><span class="text-p0">${vp[0].total}</span><span class="muted"> : </span><span class="text-p1">${vp[1].total}</span></div>
      <div class="muted small">${esc(pName(state, 0))} vs ${esc(pName(state, 1))}</div>
    </div>
    <div class="card"><table class="vp-table"><thead><tr><th></th><th class="text-p0">${esc(pName(state, 0))}</th><th class="text-p1">${esc(pName(state, 1))}</th></tr></thead>
      <tbody><tr><td>Primary</td><td>${vp[0].primary}</td><td>${vp[1].primary}</td></tr><tr><td>Secondary</td><td>${vp[0].secondary}</td><td>${vp[1].secondary}</td></tr>
      <tr><td>Modifier</td><td>${vp[0].bonus}</td><td>${vp[1].bonus}</td></tr><tr class="total"><td>Total</td><td>${vp[0].total}</td><td>${vp[1].total}</td></tr></tbody></table></div>
    <div class="row">${btn({ label: 'Score (tablet)', kind: 'primary', action: 'nav', data: { href: ctx.roleHash(code, 'desktop', 'table') } })}${btn({ label: 'Lobby', kind: 'ghost', action: 'nav', data: { href: '#/' } })}</div>
  </div>`;
}
