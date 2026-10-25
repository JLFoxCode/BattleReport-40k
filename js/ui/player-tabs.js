/* Player phone – HTML building blocks: pinned head, the three tabs (Army · Stratagems · Army list), the right column
 * of tiles (≥ 900 px) and the Setup/Deploy/Over stages. Pure (ctx, ui) → HTML; interaction via data-action
 * (delegation in player.js). The page explains no core rules – the Rulebook view (#/g/CODE/rules) does that. */
import { WH } from '../../data/rules.js';
import { esc, btn, chip, badge } from './components.js';
import {
  pName, phaseOf, stepper, stratCard, stratWhose, matchUnitAny, armyOf, myUnits,
  detailsRule, detailsOpen, enhancementOf, leaderBuffs, origData, origMod, ensureOrig, cleanOrig, resShort, stratPhaseId, phasePill, turnBadge,
  effectItems, resourceFor, thresholdActive, thresholdDerive, choicePicked, toggleOn, counterNow, effectsOf, optionCost,
  headLabel, unitGroups, affectsLine, stratKwList, condRow, cpOnlyReason
} from './player-common.js';
import { DS, ensureDatasheets } from './player-common.js';
import { ruleBoxes, roleSections, roleOf as bookRole } from './army-book.js';
import { datasheetCard, datasheetMissing, datasheetGroupCard, memberWargearAbilities, abilityVisible, optionKeywords } from './datasheet.js';
import { normName } from '../data/datasheets.js';

export const TABS = [['army', 'Army'], ['missions', 'Missions'], ['strats', 'Stratagems'], ['units', 'Army list']];
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
        <div class="pl-round">${now.battle ? `Round ${state.round}<span class="muted">/5</span>` : esc(state.stage === 'deploy' ? 'Deployment' : 'Setup')}${now.battle && state.opts && state.opts.phases === 'manual' ? ` ${phasePill(now.phase)}` : ''}</div>
        <div class="pl-turn p${now.battle ? state.turn : me}">${now.battle ? (ctx.spectator ? `${esc(pName(state, state.turn))}'s turn` : now.side === 'own' ? `Your turn<span class="pl-turn-who"> · ${who}</span>` : `Opponent's turn · ${who}`) : who}</div>
      </div>
      <div class="pl-kpis">
        <div class="kpi p${me}"><b>${cp}</b><small>CP</small></div>
        ${headResources(ctx)}
        <button type="button" class="kpi vp pl-vp" data-action="score.view" aria-label="Score breakdown"><b><span class="text-p${me}">${vp[me].total}</span><span class="muted">:</span><span class="text-p${opp}">${vp[opp].total}</span></b><small>VP</small></button>
      </div>
      <button class="btn ghost icon pl-more" type="button" data-action="more.open" aria-label="Settings, notes and links">⋯</button>
    </div>`;
}

/** Once-per-battle toggle of the army effects that a resource counter mirrors ("War Cry (Waaagh!) – once per battle", max 1,
 *  ↔ toggle "Waaagh!"): the toggle drives the counter, the counter is not shown in the head. → effect item | null */
export function linkedToggleOf(ctx, p, r) {
  if (!r || !(r.max === 1 || /once per battle/i.test(r.name || ''))) return null;
  const { status, items } = effectItems(ctx, p);
  if (status !== 'ok') return null;
  const rn = nk(r.name);
  return items.find(it => it.e.kind === 'toggle' && it.e.limit === 'battle' && nk(it.e.name).length >= 4 && rn.includes(nk(it.e.name))) || null;
}
/** Resource index a toggle item drives, or -1. */
export function linkedResourceOf(ctx, p, item) {
  const list = (ctx.state.players[p] || {}).resources || [];
  return list.findIndex(r => { const t = linkedToggleOf(ctx, p, r); return !!t && t.key === item.key; });
}

/** Army resource counter(s) in the pinned head, next to CP: compact stepper + readable short name ("YP", "Fate Dice").
 *  A counter driven by a toggle (Waaagh!) stays out of the head – the toggle in Active effects sets it. */
function headResources(ctx) {
  const { state, me } = ctx;
  const resources = (state.players[me] || {}).resources || [];
  return resources.map((r, index) => linkedToggleOf(ctx, me, r) ? '' : `<div class="kpi res p${me} pl-hres" title="${esc(r.name)}${r.max != null ? ' / max ' + r.max : ''}">
      ${stepper({ value: r.value || 0, min: 0, max: r.max, action: 'res.step', data: { index }, small: true, player: me, cls: 'hres' })}
      <small>${esc(headLabel(r.name))}</small></div>`).join('');
}

/** Missions tab needs attention: Tactical cards to draw, or the player's own scoring is waiting for confirmation. */
export function missionsDue(ctx) {
  const { state, me } = ctx;
  if (state.stage !== 'battle' || ctx.spectator) return false;
  const sec = (state.players[me] || {}).secondaries || {};
  return (sec.mode === 'tactical' && (sec.toDraw || 0) > 0) || myParts(state, me).length > 0 || (state.cpOffers || []).some(o => o.player === me);
}

/** Open parts of the pending scoring: merged (pending.parts = [{ player, when, key, items, done }], one sheet per end of
 *  turn on the tablet) or the classic single one (pending.player / when / items). */
export function scoreParts(s) {
  const pend = s && s.stage === 'battle' && s.pending;
  if (!pend || pend.kind !== 'score') return [];
  if (Array.isArray(pend.parts)) return pend.parts.filter(x => !x.done);
  return [{ player: pend.player, when: pend.when, key: pend.key || `${s.round}:${s.turn}:${pend.when}:${pend.player}`, items: pend.items || [] }];
}
/** The player's own open part(s) – the phone shows and confirms only these. */
export const myParts = (s, me) => scoreParts(s).filter(x => x.player === me);
/** "End of turn" / "End of Anna's turn" / "End of battle" for the parts of player me (joined with +). */
export function partsLabel(state, me, parts) {
  const ws = [...new Set(parts.map(x => x.when))];
  return ws.map(w => (w === 'turn' && me !== state.turn ? `End of ${pName(state, state.turn)}'s turn` : (WHEN_LABEL[w] || w))).join(' + ');
}

/** Open "+1 CP" rule offers of this player (state.cpOffers – Da Boss, Grand Strategist …): Add / Skip, shown above every
 *  tab. Never booked by themselves: only the player knows whether the model is still on the battlefield. */
export function renderCpOffers(ctx) {
  const { state, me } = ctx;
  if (state.stage !== 'battle' || ctx.spectator) return '';
  return (state.cpOffers || []).filter(o => o.player === me).map(o => `<div class="card p${me} mis-due cp-offer">
      <div class="card-head"><div class="title">${esc(o.name)}: +${esc(o.cp)} CP?</div></div>
      <p class="small muted">${o.req === 'warlord' ? `Only if your WARLORD (${esc(o.unitName)}) is on the battlefield.` : `Only if ${esc(o.unitName)} is on the battlefield.`}</p>
      <div class="row">${btn({ label: `Add ${o.cp} CP`, kind: `p${me}`, small: true, action: 'cp.offer', data: { id: o.id, ok: 1 } })}${btn({ label: 'Skip', kind: 'ghost', small: true, action: 'cp.offer', data: { id: o.id, ok: 0 } })}</div>
    </div>`).join('');
}

export function renderTabs(ctx, ui) {
  const due = missionsDue(ctx);
  return TABS.map(([id, label]) => chip({ html: `${esc(label)}${id === 'missions' && due ? '<span class="tab-dot" aria-label="action needed"></span>' : ''}`, on: ui.tab === id, action: 'tab', data: { tab: id }, cls: 'tab' + (id === 'missions' && due ? ' due' : '') })).join('');
}

/* ═══════════════ Tab 1: Army – ONLY what currently changes the game (data/effects, SCHEMA.md) ═══════════════ */
const scopePill = s => (s ? `<span class="fx-scope">${esc(s)}</span>` : '');
const fxInfoBtn = (p, key, name) => `<button type="button" class="btn ghost icon ds-info fx-info" data-action="fx.info" data-p="${p}" data-key="${esc(key)}" aria-label="Original text of ${esc(name)}">i</button>`;
const hint = parts => { const t = parts.filter(Boolean); return t.length ? `<div class="fx-hint">${t.map(esc).join(' · ')}</div>` : ''; };
/** Use of an effect option / toggle (ability.use key) that blocks it right now, or null. */
export function fxUse(state, p, key, limit) { return abilityUseOf(state, p, { key, limit: limit || 'battle' }); }
const rangeLabel = s => (s.min != null && s.max != null ? `${s.min}–${s.max}` : s.min != null ? `${s.min}+` : s.max != null ? `≤${s.max}` : '');

/** One row per effect: only the active state / option(s). opts.readOnly → no controls (opponent); opts.compact → tile. */
export function fxRow(ctx, p, it, opts = {}) {
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
    const ri = e.limit === 'battle' ? linkedResourceOf(ctx, p, it) : -1;
    const lr = ri >= 0 ? state.players[p].resources[ri] : null;
    // used: its once-per-X use is booked – or the counter it drives already says so (counter set by hand in older games)
    const used = !on && !!e.limit && (!!fxUse(state, p, `tog:${it.key}`, e.limit) || (!!lr && (Number(lr.value) || 0) >= (lr.max || 1)));
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

/** Choices / toggles made at the start of a turn or battle round (Combat Doctrines, Waaagh!, Oath of Moment …) that are still
 *  open now: own Command phase items on the active player's turn, battle-round items in the first turn of a round (both
 *  players). Used for the start-of-turn prompt on the phone. → [item] */
const START_CMD_RE = /^(?:start of (?:your |a |the |either player['’]s )?command phase|your command phase|either player['’]s command phase)/i;
const START_ROUND_RE = /^start of (?:the |each )?(?:first )?battle rounds?\b/i;
export function startPicks(ctx) {
  const { state, me } = ctx;
  if (state.stage !== 'battle' || state.phase !== 'command') return [];
  const { status, items } = effectItems(ctx, me);
  if (status !== 'ok') return [];
  const first = state.mission && state.mission.first != null ? state.mission.first : 0;
  const roundStart = state.turn === first;
  return items.filter(it => {
    const e = it.e, w = String(e.when || '');
    if (e.kind !== 'choice' && e.kind !== 'toggle') return false;
    const cmd = START_CMD_RE.test(w) && (state.turn === me || /either player/i.test(w));
    let round = START_ROUND_RE.test(w) && roundStart;
    if (round && /first battle round/i.test(w)) round = state.round === 1;
    const listed = /battle rounds ([\d ,and]+)/i.exec(w);
    if (round && listed) round = (listed[1].match(/\d/g) || []).map(Number).includes(state.round);
    if (!cmd && !round) return false;
    const stored = ((state.players[me].effects) || {})[it.key];
    if (stored && stored.round === state.round && stored.turn === state.turn) return false;   // already decided this turn
    if (e.kind === 'toggle') {
      if (toggleOn(state, me, it)) return false;
      if (e.limit && fxUse(state, me, `tog:${it.key}`, e.limit)) return false;
      const ri = e.limit === 'battle' ? linkedResourceOf(ctx, me, it) : -1;
      if (ri >= 0 && (Number(state.players[me].resources[ri].value) || 0) >= (state.players[me].resources[ri].max || 1)) return false;
      return true;
    }
    // choice: something left to pick (options not used up)
    return (e.options || []).some(o => !(o.limit === 'battle' && fxUse(state, me, `opt:${it.key}:${o.id}`, 'battle')));
  });
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
    ${reservesCard(ctx)}
    ${renderAbilityCard(ctx, ui)}
    ${enhHtml}
    ${oppHtml}`;
}

/** Units declared in Strategic Reserves / Deep Strike (setup list): reminder of when they may arrive (20.03, 20.04) and
 *  "Arrived" to take them off the list (unit.update reserve 'none'). Nothing shown without reserves. */
function reservesCard(ctx) {
  const { state, me } = ctx;
  if (!['deploy', 'battle'].includes(state.stage)) return '';
  const units = myUnits(state, me).filter(u => (u.reserve === 'strategic' || u.reserve === 'deepstrike') && u.status !== 'destroyed');
  if (!units.length) return '';
  const r = state.stage === 'battle' ? state.round : 0;
  const hint = r <= 1 ? 'Units in strategic reserves arrive with an ingress move (20.04) from the second battle round onwards (20.03).'
    : r === 2 ? 'Can arrive now: ingress move (20.04) – wholly within 6" of a battlefield edge, more than 8" horizontally from all enemy units; before the third battle round not within your opponent\'s deployment zone.'
      : r === 3 ? 'Last round to arrive: at the end of the third battle round, strategic reserves units that have not made an ingress move are destroyed (20.04).'
        : 'Strategic reserves units that had not arrived by the end of the third battle round are destroyed.';
  const label = { strategic: 'Strategic Reserves', deepstrike: 'Deep Strike' };
  return `<div class="card p${me} res-card"><div class="card-head"><div class="title">Reserves</div><span class="badge">${units.length}</span></div>
    <p class="small${r === 3 ? ' text-warn' : ' muted'}">${esc(hint)}</p>
    ${units.some(u => u.reserve === 'deepstrike') && r <= 3 ? `<p class="small muted">${esc('Deep Strike (24.09): in its ingress move the unit can be set up anywhere on the battlefield more than 8" horizontally from all enemy units, even within your opponent\'s deployment zone.')}</p>` : ''}
    <ul class="res-list">${units.map(u => `<li class="row"><span class="res-name"><b>${esc(u.name)}</b> <span class="muted xs">${esc(label[u.reserve])}</span></span><span class="spacer"></span>${state.stage === 'battle' && !ctx.spectator ? btn({ label: 'Arrived', kind: 'ghost', small: true, action: 'unit.arrived', data: { unit: u.id } }) : ''}</li>`).join('')}</ul>
  </div>`;
}

/* ═══════════════ Once-per-X ability tracker (army rule · detachment rules · datasheets · enhancements) ═══════════════ */
const LIMIT_LABEL = { battle: 'once per battle', round: 'once per battle round', turn: 'once per turn', phase: 'once per phase' };
/** Limit of a rule text (the name is scanned too, e.g. "Keep Huntin'! (Once per battle round, per army)"), or null if it is not a once-per-X rule.
 * "twice per battle" → 'battle' (see limitUses); "once per phase" and "only make one … move per phase" → 'phase' (booked like a turn limit). */
export function limitOf(text, name = '') {
  const t = `${String(name || '')} ${String(text || '')}`;
  // the limit belongs to each listed option, not to the rule ("You can only select each of these abilities once per battle",
  // Kindred Sorcery) – the options are tracked in Active effects
  if (/\b(?:select|choose|use|pick) each of (?:these|the following|those)\b[^.;]{0,40}\b(?:once|twice) per\b/i.test(t)) return null;
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
    // table rows ("Onslaught - 6", "A | B", "… 6\"") are no headings
    const isHead = /^\*\*[^*]+\*\*:?$/.test(t) || (plain.length <= 48 && !/[.!?|]/.test(plain) && !/^[-•]/.test(t) && !/\d+\s*["”+]?\s*$/.test(plain));
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
    const ds = matchUnitAny(data, u.name, ctx.rerender);
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
  linkFx(ctx, out);
  return out;
}
/** Tracker entries that are also an option / toggle of Active effects (a Combat Doctrine, Waaagh!) take their state from
 *  there: fx = effect key, fxUseKey/fxLimit = the use booked by the effect, fxOn = picked / on right now. */
function linkFx(ctx, entries) {
  const { status, items } = effectItems(ctx, ctx.me);
  if (status !== 'ok' || !entries.length) return;
  const { state, me } = ctx;
  const map = new Map();
  items.forEach(it => {
    const e = it.e;
    if (e.kind === 'toggle' && e.limit) {
      const v = { key: it.key, useKey: `tog:${it.key}`, limit: e.limit, on: toggleOn(state, me, it) };
      map.set(nk(e.name), v);
      // the rule may carry the name of the counter it drives ("War Cry" ↔ toggle "Waaagh!" ↔ "War Cry (Waaagh!) – once per battle")
      const ri = e.limit === 'battle' ? linkedResourceOf(ctx, me, it) : -1;
      if (ri >= 0) { const r = state.players[me].resources[ri]; v.byRes = (Number(r.value) || 0) >= (r.max || 1); map.set(nk(headLabel(r.name)), v); }
    }
    if (e.kind === 'choice') {
      const picked = choicePicked(state, me, it);
      (e.options || []).forEach(o => { if (o.limit) map.set(nk(o.name), { key: it.key, useKey: `opt:${it.key}:${o.id}`, limit: o.limit, on: picked.includes(o.id) }); });
    }
  });
  entries.forEach(en => {
    const m = map.get(nk(en.name)) || map.get(nk(String(en.name || '').replace(/\(.*?\)/g, ' ')));   // "War Cry (Once per battle, per army)"
    if (m) Object.assign(en, { fx: m.key, fxUseKey: m.useKey, fxLimit: m.limit, fxOn: m.on, fxUsed: !!m.byRes });
  });
}
/** The abilityUses entry that blocks `entry` right now (battle: any; round: same round; turn/phase: same round+turn), or null. */
export function abilityUseOf(state, me, entry) {
  const uses = (state.abilityUses || []).filter(u => u.player === me && u.key === entry.key);
  return [...uses].reverse().find(u => entry.limit === 'battle' || (u.round === state.round && (entry.limit === 'round' || u.turn === state.turn))) || null;
}
/** Once-per-phase entry: its uses in the current turn (one per phase it was used in). */
export const PHASE_CHOICES = WH.PHASES.filter(p => p.id !== 'end');
export function phaseUsesOf(state, me, entry) {
  return (state.abilityUses || []).filter(u => u.player === me && u.key === entry.key && u.round === state.round && u.turn === state.turn);
}
const phaseNames = uses => uses.map(u => (WH.PHASES.find(p => p.id === u.phase) || { name: 'this turn' }).name).join(' · ');
export function abilityByKey(ctx, key) { return abilityTracker(ctx).find(e => e.key === key) || null; }

/** Tracker entries whose text reduces a Stratagem's CP cost; amount = CP reduction (Infinity = free / 0 CP).
 * CP gains ("you gain 1CP", "roll one D6: on a 5+") and CP increases ("twice/three times that Stratagem's … CP cost") are not reductions.
 * list: precomputed cpReductions(ctx) (all Stratagems) to filter for one Stratagem without rebuilding the tracker. */
const CP_RED_RE = /\bCP\b|\dCP\b|regardless of any other uses/i;
const CP_HOW_RE = /\bless\b|\breduc(?:e|ed|es|ing)\b|\binstead of\b|\bfor 0 ?CP\b|\b0 ?CP\b|\bcosts? 0\b|\bfree\b|[-−–]\s?1 ?CP\b|regardless of any other uses/i;
const CP_GAIN_RE = /\bgain(?:s|ed)? (?:\d|one|D\d)\s?CP\b|\byou gain\b|\broll one D6[:,]? on a\b|\bregain\b/i;
const CP_MORE_RE = /\b(?:twice|two times|three times|double)\b[^.]*?\bStratagem['’]?s?\b[^.]*?\bCP\b|\bincreas(?:e|ed|es)\b[^.]*?\bCP\b|\b(?:\d|one) ?CP more\b/i;
export function cpReductions(ctx, strat = null, list = null) {
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const all = list || abilityTracker(ctx).filter(e => CP_RED_RE.test(e.text) && CP_HOW_RE.test(e.text) && !CP_GAIN_RE.test(e.text) && !CP_MORE_RE.test(e.text)).map(e => {
    const t = e.text;
    let amount = 1;
    if (/\bfor 0 ?CP\b|\b0 ?CP\b|\bcosts? 0\b|\bfree\b|\binstead of\b/i.test(t) && !/\breduc|\bless\b|[-−–]\s?1 ?CP\b/i.test(t)) amount = Infinity;
    const m = /(\d)\s*CP\s+less\b|\bby\s+(\d)\s*CP\b|\breduced?\b[^.]*?\bby\s+(\d)\b|[-−–]\s?(\d) ?CP\b/i.exec(t);
    if (m) amount = Number(m[1] || m[2] || m[3] || m[4]) || 1;
    // a price for the reduction ("spend 1YP") is paid with it
    const pay = /\bspend (\d+) ?([A-Z]{2,4})\b/.exec(t);
    return Object.assign({ amount, pay: pay ? { n: Number(pay[1]), res: pay[2] } : null }, e);
  });
  // "… with the Command Re-roll Stratagem …" / "… with the Rapid Ingress stratagem …" (Teleport Homer): only for that Stratagem
  return all.filter(e => { const only = /\bthe ([A-Z][A-Za-z’'\- ]*?) [Ss]tratagem\b/.exec(e.text); return !strat || !only || norm(only[1]) === norm(strat.name); });
}
/** Could an unused CP reduction make the Stratagem affordable right now? */
export function canReduceNow(ctx, s, list) {
  const { state, me } = ctx;
  const cp = (state.players[me] || {}).cp || 0, cost = Number(s.cost) || 0;
  return cpReductions(ctx, s, list).some(e => !abilityUseOf(state, me, e) && Math.max(0, cost - (e.amount === Infinity ? cost : e.amount)) <= cp);
}

function abilityRows(ctx, entries) {
  const { state, me } = ctx;
  const inBattle = state.stage === 'battle';
  return `<ul class="abil-list">${entries.map(e => {
    if (e.fx) {
      // state from Active effects (picked there): active now / used / available
      const use = abilityUseOf(state, me, { key: e.fxUseKey, limit: e.fxLimit }) || (e.fxUsed ? { round: '?' } : null);
      const st = e.fxOn ? 'active now' : use ? (use.round === '?' ? 'used' : `used (R${use.round})`) : inBattle ? 'available' : 'in battle';
      return `<li class="abil linked${e.fxOn ? ' on' : use ? ' used' : ''} kind-${esc(e.kind)}">
      <button type="button" class="abil-toggle" data-action="ability.toggle" data-key="${esc(e.key)}" aria-label="${esc(e.name)}: ${esc(st)} – set under Active effects">
        <span class="abil-main"><b class="abil-name">${esc(e.name)}</b><span class="abil-src muted xs">${esc(e.source)} · set under Active effects</span></span>
        <span class="abil-right"><span class="badge lim">${esc(entryLabel(e))}</span><span class="abil-state ${e.fxOn ? 'on' : use ? 'used' : 'avail'}">${esc(st)}</span></span>
      </button>
      <button type="button" class="btn ghost icon ds-info abil-info" data-action="ability.info" data-key="${esc(e.key)}" aria-label="Show text of ${esc(e.name)}">i</button>
    </li>`;
    }
    const pUses = e.limit === 'phase' ? phaseUsesOf(state, me, e) : null;
    const use = abilityUseOf(state, me, e);
    const when = pUses ? phaseNames(pUses) : use ? (e.limit === 'battle' ? `R${use.round}` : `R${use.round} · ${use.turn === me ? 'your turn' : 'opp. turn'}`) : '';
    return `<li class="abil${use ? ' used' : ''} kind-${esc(e.kind)}">
      <button type="button" class="abil-toggle" data-action="ability.toggle" data-key="${esc(e.key)}"${inBattle ? '' : ' disabled'} aria-pressed="${use ? 'true' : 'false'}" aria-label="${esc(e.name)}: ${use ? 'used – tap to undo' : 'available – tap to mark as used'}">
        <span class="abil-main"><b class="abil-name">${esc(e.name)}</b><span class="abil-src muted xs">${esc(e.source)}</span></span>
        <span class="abil-right"><span class="badge lim">${esc(entryLabel(e))}</span><span class="abil-state ${use ? 'used' : 'avail'}">${pUses && pUses.length ? `used: ${esc(when)}` : use ? `used (${esc(when)})` : (inBattle ? 'available' : 'in battle')}</span></span>
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
  return list.filter(s => (s.ph || []).includes(sec.phase) && [sec.side, 'either'].includes(stratWhose(s, sec.phase)));
}

/** Stratagems usable in the current turn (own/opponent) – for the "Usable this turn" tile. */
export function usableThisTurn(ctx) {
  const now = nowOf(ctx);
  if (!now.battle) return [];
  const fitsSide = s => (s.phw ? Object.values(s.phw) : [s.whose || 'either']).some(w => w === 'either' || w === now.side);
  return (ctx.derived.stratagems[ctx.me] || []).filter(s => s.available && fitsSide(s));
}

export function renderStrats(ctx, ui) {
  const { derived, me } = ctx;
  const now = nowOf(ctx);
  const list = derived.stratagems[me] || [];
  effectsOf(ctx, (ctx.state.players[me] || {}).faction);   // stratagem add-ons (loads once, rerenders)
  const f = ui.sfilter || 'all';
  let secs = stratSections().filter(sec => f === 'all' || sec.side === 'any' || sec.side === f);
  // tracked phases: only the current phase of the current turn is "now"; untracked: the whole turn side
  const tracked = ctx.state.opts && ctx.state.opts.phases === 'manual';
  const isNow = sec => now.battle && sec.side === now.side && (!tracked || sec.phase === now.phase);
  // "Any time" (Command Re-roll …) sits right under the Now section (tracked) / above the current turn's sections (untracked)
  if (now.battle) {
    const any = secs.find(x => x.side === 'any');
    const rest = secs.filter(x => x !== any);
    const nowIdx = rest.findIndex(x => isNow(x) && stratsOf(list, x).length);
    const at = nowIdx < 0 ? -1 : tracked ? nowIdx + 1 : nowIdx;
    if (any && at >= 0) secs = [...rest.slice(0, at), any, ...rest.slice(at)];
  }
  // shared per render: unit groups (leader + bodyguard = one unit) and the army's CP reductions
  const units = myUnits(ctx.state, me);
  const groups = units.length ? unitGroups(units, resolveLeaders(units)) : null;
  const reds = now.battle && list.some(s => cpOnlyReason(s)) ? cpReductions(ctx) : [];
  const html = secs.map(sec => {
    const cur = isNow(sec) || (now.battle && sec.side === 'any');
    const items = stratsOf(list, sec);
    if (!items.length) return '';
    const phase = sec.phase || 'any';
    const title = sec.side === 'any' ? 'Any time' : phaseOf(sec.phase).full;
    const badge = sec.side === 'any' ? '' : turnBadge(sec.side);
    const nowTag = isNow(sec) ? '<span class="side-tag now">Now</span>' : '';
    return `<section class="phase card ph-${esc(phase)} side-${esc(sec.side)}${cur ? ' cur' : ''}" data-sec-id="${esc(sec.id)}" id="sec-${esc(sec.id.replace(':', '-'))}">
      <h2 class="phase-h"><span class="phase-title">${esc(title)}</span>${badge}${nowTag}<span class="muted xs cnt">${items.length}</span></h2>
      <div class="strat-list">${items.map(s => stratCard(s, ctx, ui, { phase, sec: sec.id, affects: affectsLine(s, stratKwList(s), ctx, groups), canReduce: reds.length > 0 && cpOnlyReason(s) && canReduceNow(ctx, s, reds) })).join('')}</div>
    </section>`;
  }).join('');
  return html || '<p class="muted center">No Stratagems.</p>';
}

/* ═══════════════ Tab: Missions – Primary + Secondary Missions of this turn and the player's own mission actions ═══════════════
 * Draw (Tactical, highlighted until drawn), Achieved, Discard (+1 CP at the end of your turn, redraw), card-rule returns and the
 * player's own scoring popup (score.open → player-sheets openScoreSheet). The score device only shows the result. */
export const WHEN_LABEL = { cmd: 'End of Command phase', turn: 'End of turn', end: 'End of battle' };
const MO = { mod: null, data: undefined, loading: false };
/** Verbatim mission card texts (data/orig/missions.json) – loaded once, rerender on arrival. */
export function ensureMissionsOrig(rerender) {
  if (MO.data !== undefined || MO.loading) return;
  MO.loading = true;
  import('../data/orig.js').then(m => (m && m.loadMissionsOrig ? m.loadMissionsOrig().then(d => { MO.mod = m; MO.data = d || null; }) : (MO.data = null)))
    .catch(() => { MO.data = null; }).then(() => { MO.loading = false; if (typeof rerender === 'function' && MO.data) rerender(); });
}
/** Original text of a Primary / Secondary Mission card (string) or null. */
export function missionsOrig(src, card) {
  if (!MO.data || !MO.mod) return null;
  const o = src === 'primary' ? MO.mod.origPrimary(MO.data, card) : MO.mod.origSecondary(MO.data, card);
  return o ? (typeof o === 'string' ? o : o.text || null) : null;
}
/** Conditions of a card for the current round: now (in its round window), later (from round N), at the end of the battle. */
export function missionCondsNow(state, conds) {
  const round = state.round || 1;
  const first = state.mission && state.mission.first != null ? state.mission.first : 0;
  const lastTurn = round >= 5 && state.turn !== first;
  const inWindow = c => !Array.isArray(c.r) || (round >= c.r[0] && round <= c.r[1]);
  const endOnly = c => (c.w || c.when) === 'end' && !lastTurn;
  return { now: conds.filter(c => inWindow(c) && !endOnly(c)), later: conds.filter(c => !inWindow(c) && Array.isArray(c.r) && c.r[0] > round), atEnd: conds.filter(c => inWindow(c) && endOnly(c)) };
}
function condListHtml(state, conds) {
  const { now, later, atEnd } = missionCondsNow(state, conds || []);
  const vpTxt = c => `${c.vp != null ? esc(c.vp) + ' VP' : 'VP'}${c.k === 'per' ? ' each' : ''}`;
  // the condition text is rule content (stays English): its own span, the frame around it is interface text
  const notes = [...later.map(c => `<span>From round ${esc(c.r[0])}:</span> <span class="rule-text">${esc(c.text)}</span> <span>(${vpTxt(c)})</span>`), ...atEnd.map(c => `<span>End of the battle:</span> <span class="rule-text">${esc(c.text)}</span> <span>(${vpTxt(c)})</span>`)];
  return `${now.length ? `<ul class="conds">${now.map(c => condRow(c, { markActive: state.stage === 'battle' })).join('')}</ul>` : '<p class="muted xs">Nothing to score with this card in this battle round.</p>'}
    ${notes.length ? `<p class="muted xs mis-later">${notes.join(' · ')}</p>` : ''}`;
}
/** The card's own "when drawn" rule applies now (Tactical only; round-1 rules in round 1; conflict rules while the other card is active). */
export function drawnHintShown(state, p, card) {
  const def = WH.SECONDARY[card], sec = state.players[p].secondaries || {};
  if (!def || !def.drawn || sec.mode !== 'tactical') return false;
  const d = def.drawn;
  if (d.kind === 'round1') return state.round === 1;
  if (d.kind === 'conflict') return (sec.hand || []).includes(d.other);
  return true;
}
export function canReturnCard(state, p, card) {
  const def = WH.SECONDARY[card], sec = state.players[p].secondaries || {};
  if (!def || !def.drawn || sec.mode !== 'tactical' || !(sec.hand || []).includes(card)) return false;
  const d = def.drawn;
  return (d.kind === 'round1' && state.round === 1) || (d.kind === 'conflict' && (sec.hand || []).includes(d.other)) || d.kind === 'target';
}
/** Objective marker label (same as the tablet's objective strip). */
export const objLabel = (s, o) => (o.kind === 'home' ? `Home ${o.home != null ? pName(s, o.home) : ''}` : o.kind === 'exp' ? (o.id === 'o3' ? 'Expansion 1' : 'Expansion 2') : 'Centre');
/** Picked units of Beacon / Burden of Trust (player effect 'sec:<card>') as one line, '' when none. */
export function pickedText(s, p, card) {
  const e = (((s.players[p] || {}).effects || {})['sec:' + card] || {}).value;
  if (e == null) return '';
  const unit = id => ((s.players[p].units || []).find(u => u.id === id) || { name: '?' }).name;
  if (card === 'beacon') return 'Beacon unit: ' + unit(String(e));
  const objName = id => { const o = (s.objectives || []).find(x => x.id === id); return o ? objLabel(s, o) : id; };
  const list = (Array.isArray(e) ? e : []).map(x => String(x).split(':')).map(([o, u]) => objName(o) + ' – ' + unit(u));
  return list.length ? 'Guards: ' + list.join(' · ') : '';
}
const misInfo = (src, card, name) => `<button type="button" class="btn ghost icon ds-info mis-info" data-action="mission.info" data-src="${esc(src)}" data-card="${esc(card)}" aria-label="Card text of ${esc(name)}">i</button>`;

export function renderMissions(ctx, ui) {
  const { state, derived, me } = ctx;
  const opp = 1 - me;
  ensureMissionsOrig(ctx.rerender);
  const battle = state.stage === 'battle';
  const act = battle && !ctx.spectator;
  const sc = ((derived && derived.scoring) || [])[me] || { primary: { conds: [] }, secondaries: [] };
  const sec = (state.players[me] || {}).secondaries || {};
  const tactical = sec.mode === 'tactical';
  const out = [];
  const mine = myParts(state, me);
  const others = [...new Set(scoreParts(state).map(x => x.player).filter(p => p !== me))];
  if (mine.length) {
    out.push(`<div class="card p${me} mis-due"><div class="card-head"><div class="title">Your scoring is due</div><span class="badge warn">${esc(partsLabel(state, me, mine))}</span></div>
      <p class="small">Mark what you achieved and confirm. The score device shows the result.</p>
      ${act ? btn({ label: 'Score now', kind: `p${me}`, cta: true, action: 'score.open', cls: 'pulse-soft' }) : ''}</div>`);
  } else if (others.length) {
    const doneMine = Array.isArray(state.pending.parts) && state.pending.parts.some(x => x.player === me && x.done);
    out.push(`<div class="card mis-wait"><p class="small muted">${doneMine ? 'Your scoring is confirmed. ' : ''}Waiting for ${others.map(p => esc(pName(state, p))).join(' & ')} to confirm their scoring.</p></div>`);
  }
  if (battle && tactical && (sec.toDraw || 0) > 0) {
    const n = sec.toDraw;
    out.push(`<div class="card p${me} mis-due mis-draw"><div class="card-head"><div class="title">Draw ${n} Secondary Mission card${n === 1 ? '' : 's'}</div></div>
      <p class="small muted">Start of your turn (Tactical Missions). Deck ${esc((sec.deck || []).length)} · discard pile ${esc((sec.discard || []).length)}.</p>
      ${act ? btn({ label: `Draw ${n} card${n === 1 ? '' : 's'}`, kind: `p${me}`, cta: true, action: 'sec.draw', cls: 'pulse-soft' }) : ''}</div>`);
  }
  // Primary Mission
  const pr = sc.primary || {};
  out.push(`<div class="card p${me} mis-card mis-primary"><div class="card-head"><div class="title">${esc(pr.card ? pr.name : 'No Primary Mission')}</div>${badge('Primary', 'ok')}${pr.card ? misInfo('primary', pr.card, pr.name) : ''}</div>
    ${pr.card ? condListHtml(state, pr.conds) : ''}</div>`);
  // Secondary Missions
  const list = sc.secondaries || [];
  const tkey = `${state.round}:${state.turn}`;
  const cpNote = battle && tactical && state.turn === me && sec.cpDiscardTurn !== tkey;
  out.push(`<div class="mis-bar"><span class="title sm">Secondary Missions</span><span class="muted xs">${tactical ? `Tactical · hand ${esc((sec.hand || []).length)} · deck ${esc((sec.deck || []).length)} · achieved ${esc((sec.achieved || []).length)}${sec.redrawUsed ? ' · redraw used' : ''}` : sec.mode === 'fixed' ? 'Fixed – active all battle' : ''}</span></div>`);
  if (!list.length) out.push(`<div class="card flat muted center small">${tactical ? ((sec.toDraw || 0) > 0 ? 'Draw your cards above.' : 'No cards in hand.') : 'No Secondary Missions.'}</div>`);
  list.forEach(c => {
    const dk = ((WH.SECONDARY[c.card] || {}).drawn || {}).kind;
    // Beacon (one unit) / Burden of Trust (a guard per objective): pick on the phone, stored as effect 'sec:<card>'
    const picked = dk === 'unit' || dk === 'guard' ? pickedText(state, me, c.card) : '';
    const pickBtn = act && (dk === 'unit' || dk === 'guard') && myUnits(state, me).length ? ' ' + btn({ label: dk === 'unit' ? (picked ? 'Change beacon unit' : 'Select beacon unit') : (picked ? 'Change guards' : 'Select guards'), kind: picked ? 'ghost' : `p${me}`, small: true, action: 'sec.pick', data: { card: c.card } }) : '';
    const hint = drawnHintShown(state, me, c.card) || picked ? `<p class="xs text-warn mis-hint"><b>When drawn:</b> <span class="rule-text">${esc(c.drawn ? c.drawn.text : '')}</span>${act && canReturnCard(state, me, c.card) ? ' ' + btn({ label: WH.SECONDARY[c.card].drawn.kind === 'target' ? 'Discard & draw a new card' : 'Draw a new card & shuffle this back', kind: 'ghost', small: true, action: 'sec.return', data: { card: c.card } }) : ''}${picked ? `<span class="sec-picked"> ${esc(picked)}.</span>` : ''}${pickBtn}</p>` : '';
    const foot = act && tactical ? `<div class="mis-foot">
        ${btn({ label: 'Achieved', kind: 'ok', small: true, action: 'sec.achieve', data: { card: c.card } })}
        ${btn({ label: cpNote ? 'Discard · +1 CP' : 'Discard', kind: 'ghost', small: true, action: 'sec.discard.open', data: { card: c.card } })}
      </div>` : '';
    out.push(`<div class="card p${me} mis-card mis-sec" data-card="${esc(c.card)}"><div class="card-head"><div class="title">${esc(c.name)}</div>${badge(sec.mode === 'fixed' ? 'Fixed' : 'Secondary', 'warn')}${misInfo('secondary', c.card, c.name)}</div>
      ${hint}${condListHtml(state, c.conds)}${foot}</div>`);
  });
  if (battle && tactical && state.turn === me) out.push(`<p class="muted xs mis-rule">${cpNote ? 'Discarding a card in your turn gives +1 CP at the end of your turn (once per turn).' : 'You already discarded a card this turn – no further CP.'}${!sec.redrawUsed ? ' Once per battle, at the end of your Command phase, you can spend 1 CP to discard a card and draw a new one.' : ''}</p>`);
  // Opponent (read-only)
  const osc = ((derived && derived.scoring) || [])[opp] || { primary: {}, secondaries: [] };
  const osec = (state.players[opp] || {}).secondaries || {};
  const oppInner = `<p class="small"><b>Primary:</b> ${esc((osc.primary && osc.primary.card) ? osc.primary.name : '–')}</p>
    <p class="small"><b>Secondary${osec.mode === 'fixed' ? ' (Fixed)' : osec.mode === 'tactical' ? ' (Tactical)' : ''}:</b> ${(osc.secondaries || []).length ? (osc.secondaries || []).map(c => esc(c.name)).join(', ') : '–'}</p>`;
  out.push(`<div class="card p${opp} opp-card">${detailsRule(ui, 'mis:opp', `Opponent: ${pName(state, opp)} – active missions`, oppInner)}</div>`);
  out.push(`<div class="row center">${btn({ label: 'Score breakdown', kind: 'ghost', small: true, action: 'score.view' })}</div>`);
  return out.join('');
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

/** Units a leader (or SUPPORT unit, ds.support) may be attached to: canLead, else the datasheet's Leader text ("… attached to
 *  the following units: A, B"); both lists together when a unit has both. */
export function leaderTargets(ds) {
  const ls = [ds && ds.leader, ds && ds.support].filter(Boolean);
  if (!ls.length) return null;
  const names = ls.flatMap(l => ((l.canLead || []).length ? l.canLead : String(l.text || '').replace(/^[^:]*:/, '').split(/,|\band\b|\n|•/).map(x => x.replace(/[*^.]/g, '').trim()).filter(Boolean)));
  return [...new Set(names.map(normName))];
}
/* A LEADER / SUPPORT list names datasheets by their keyword (core rules 19.01): "Acolyte Hybrids" takes "Acolyte Hybrids
   with Autopistols" (keyword ACOLYTE HYBRIDS); spaces do not matter ("HANDFLAMERS") – the same rule as the army builder. */
const tight = s => normName(s).replace(/[^a-z0-9]/g, '');
/** May unit x (datasheet xs) join a leader whose leaderTargets are `allowed`? (empty list = any unit) */
function canJoinUnit(allowed, x, xs) {
  if (!allowed.length) return true;
  const set = new Set(allowed.map(tight));
  return [x.name, xs && xs.name, ...((xs && xs.keywords) || [])].some(n => n && set.has(tight(n)));
}
/** leaderTargets of list unit u plus the units its enhancement lets it lead (detachment enhancements' `leads` in the
 *  faction's datasheets: Kill Kommanda → Kommandos, Kaptin's Hat → Flash Gitz); null if it can lead nothing. */
function unitTargets(u, ds, data) {
  const own = leaderTargets(ds);
  const mine = new Set((u.enhancements || []).map(normName));
  const extra = mine.size ? ((data && data.detachments) || []).flatMap(d => d.enhancements || []).filter(e => (e.leads || []).length && mine.has(normName(e.name))).flatMap(e => e.leads) : [];
  if (!extra.length) return own;
  return own && !own.length ? own : [...new Set([...(own || []), ...extra.map(normName)])];
}
/** Leaders of the list that could lead one of its units but lead none yet. */
function unattachedLeaders(units, sheets, links, data) {
  return units.filter(u => {
    const allowed = unitTargets(u, sheets.get(u.id), data);
    if (!allowed || (links.get(u.id) || {}).leading || u.status === 'destroyed') return false;
    return units.some(x => x !== u && !leaderTargets(sheets.get(x.id)) && canJoinUnit(allowed, x, sheets.get(x.id)));
  });
}
/** Why the units `all` may not all join the bodyguard `b` ('' if they may) – core rules: one Leader unit and one SUPPORT
 *  unit (ds.support) per bodyguard, more Leaders only when a datasheet says so ("up to two Leader units", "Starting
 *  Strength of N", "no more than one … is a X unit", "not duplicates", "even if one X unit has already been attached"). */
function attachLimit(b, all, sheets) {
  if (all.length < 2) return '';
  const plain = s => String(s || '').replace(/[*^]/g, '');
  const sh = x => sheets.get(x.id) || {};
  const sup = all.filter(x => !sh(x).leader && sh(x).support), ls = all.filter(x => !sup.includes(x));
  const hasKw = (x, kw) => { const k = normName(kw); return !!k && (normName(x.name) === k || [...(sh(x).keywords || []), ...(x.keywords || [])].some(t => normName(t) === k)); };
  // "even if a PRIMUS, MAGUS or ACOLYTE ICONWARD model has already been attached": LEADER / SUPPORT alsoWith, else the text
  const evenIf = (a, o) => {
    const s = sh(a), aw = [...((s.leader || {}).alsoWith || []), ...((s.support || {}).alsoWith || [])];
    if (aw.some(k => hasKw(o, k))) return true;
    const e = /even if (?:one |an? )?(.+?) (?:unit |model )?has already been attached/i.exec(plain((s.leader || s.support || {}).text));
    return !!e && hasKw(o, e[1]);
  };
  if (sup.length > 2 || (sup.length === 2 && !evenIf(sup[0], sup[1]) && !evenIf(sup[1], sup[0]))) return 'only one SUPPORT unit';
  if (ls.length < 2) return '';
  const all2 = y => { const o = []; (function f(z) { if (typeof z === 'string') o.push(z); else if (z && typeof z === 'object') Object.values(z).forEach(f); })(y); return plain(o.join('\n')); };
  const bt = all2(sh(b).abilities);
  const up = /up to (two|three|four|\d+) Leader units/i.exec(bt), ss = /Starting Strength of (\d+)/i.exec(bt);
  const max = up && (!ss || (b.modelsStart || b.models || 0) >= +ss[1]) ? ({ two: 2, three: 3, four: 4 }[up[1].toLowerCase()] || +up[1]) : 1;
  if (max > 1) {
    if (ls.length > max) return `at most ${max} Leader units`;
    const one = /no more than one of those units is an? (.+?) unit/i.exec(bt);
    if (one && ls.filter(x => hasKw(x, one[1])).length > 1) return `only one ${one[1].trim().toUpperCase()} unit`;
    if (/not duplicates/i.test(bt) && new Set(ls.map(x => normName(x.name))).size < ls.length) return 'no duplicate Leader units';
    return '';
  }
  if (ls.length === 2 && (evenIf(ls[0], ls[1]) || evenIf(ls[1], ls[0]))) return '';
  return 'only one Leader unit';
}
/** "Attached to" picker for a leader (select, data-change="unit.attach"); bodyguards that already have as many
 *  leaders as their datasheet allows are listed disabled with who leads them. */
function attachPicker(u, ds, units, sheets, links, data) {
  const allowed = unitTargets(u, ds, data);
  if (!allowed) return '';
  const cands = units.filter(x => x !== u && !leaderTargets(sheets.get(x.id)) && canJoinUnit(allowed, x, sheets.get(x.id)));
  if (!cands.length) return '';
  const cur = (links.get(u.id) || {}).leading;
  const nth = x => { const same = units.filter(y => y.name === x.name); return same.length > 1 ? ` (${same.indexOf(x) + 1})` : ''; };
  const full = x => {
    if (cur === x) return null;
    const ls = units.filter(y => y !== u && (links.get(y.id) || {}).leading === x);
    return ls.length && attachLimit(x, [...ls, u], sheets) ? ls : null;
  };
  return `<label class="ds-attach-pick"><span>${esc(u.name)} attached to</span><select data-change="unit.attach" data-unit="${esc(u.id)}">
    <option value="">– not attached –</option>${cands.map(x => { const ls = full(x); return `<option value="${esc(x.id)}"${cur === x ? ' selected' : ''}${ls ? ' disabled' : ''}>${esc(x.name + nth(x))}${ls ? ` – led by ${esc(ls.map(y => y.name).join(', '))}` : ''}</option>`; }).join('')}</select></label>`;
}

/** Enhancements of a unit resolved against the original texts. */
function unitEnhancements(ctx, u) {
  return (u.enhancements || []).map(name => { const e = enhancementOf(ctx, name); return e ? e : { name, cost: null, text: '' }; });
}

/** Buffs the leader unit `leader` grants to its bodyguard (datasheet abilities + enhancements). */
export function buffsOf(ctx, data, leader) {
  const ds = matchUnitAny(data, leader.name, ctx.rerender);
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
  if (fac && !origData(fac)) ensureOrig(fac, ctx.rerender);   // army / detachment rules + enhancement texts
  const links = resolveLeaders(units);
  const q = String(ui.search || '').trim().toLowerCase();
  const sheets = new Map(units.map(u => [u.id, matchUnitAny(data, u.name, ctx.rerender)]));
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
  const hayOf = u => { const ds = sheets.get(u.id); return [u.name, ...(u.keywords || []), ...((ds && ds.keywords) || []), ...optionKeywords(ds, u), ...((ds && ds.factionKeywords) || [])].join(' ').toLowerCase(); };
  const shown = units.filter(u => !merged.has(u.id) && (!q || [u, ...(leadersOf.get(u.id) || [])].some(m => hayOf(m).includes(q))));
  // the same book as the army builder's "Datasheet view": rule boxes on top, then every unit closed, grouped by role
  const cards = shown.map(u => {
    const ds = sheets.get(u.id);
    const key = `ds:${u.id}`;
    const open = ui.open.has(key);
    const role = bookRole([...(u.keywords || []), ...((ds && ds.keywords) || [])]);
    return { role, html: card(u, ds, key, open) };
  });
  function card(u, ds, key, open) {
    const ldrs = leadersOf.get(u.id);
    if (ldrs && ds) {
      return datasheetGroupCard({
        body: { ds, unit: u, enh: unitEnhancements(ctx, u) },
        leaders: ldrs.map(L => ({ ds: sheets.get(L.id), unit: L, enh: unitEnhancements(ctx, L), buffs: buffsOf(ctx, data, L) }))
      }, { open, key, detachments: myDetNames(ctx), top: ldrs.map(L => attachPicker(L, sheets.get(L.id), units, sheets, links, data)).join('') });
    }
    const l = links.get(u.id) || {};
    let attach = null;
    if (l.leadingName || l.leading) {
      attach = { role: 'leader', name: l.leading ? l.leading.name : l.leadingName, resolved: !!l.leading, marks: new Set(leaderBuffs(ds, unitEnhancements(ctx, u), u, myDetNames(ctx)).map(b => b.name)) };
    } else if (l.ledByName || l.ledBy) {
      attach = { role: 'bodyguard', name: l.ledBy ? l.ledBy.name : l.ledByName, resolved: !!l.ledBy, leaderId: l.ledBy ? l.ledBy.id : '', buffs: l.ledBy ? buffsOf(ctx, data, l.ledBy) : [] };
    }
    return ds ? datasheetCard(ds, { unit: u, compact: true, open, key, enhancements: unitEnhancements(ctx, u), attach, detachments: myDetNames(ctx), enhNames: [u, l.ledBy].filter(Boolean).flatMap(m => (m.enhancements || []).map(normName)), top: attachPicker(u, ds, units, sheets, links, data) }) : datasheetMissing(u, { attach });
  }
  // army rule, detachment rule(s), enhancements – original texts (BSData / New Recruit), so none of them is forgotten
  const o = origData(fac), mod = origMod();
  const army = armyOf(ctx, me);
  const fromOrig = (fn, ...a) => (o && mod && mod[fn] ? mod[fn](o, ...a) || [] : []);
  const book = {
    armyRules: fromOrig('origArmyRules').length ? fromOrig('origArmyRules') : (data.armyRules || []),
    detachments: army.detachments.map(d => {
      const r = fromOrig('origDetachmentRule', d.name);
      const bsd = (data.detachments || []).find(x => normName(x.name) === normName(d.name));
      return { name: d.name, rules: r.length ? r : ((bsd && bsd.rules) || []) };
    }),
    enhancements: enhancementsOfList(ctx).map(e => ({ name: e.name, on: e.unit, text: cleanOrig(e.text) }))
  };
  const found = units.filter(u => sheets.get(u.id)).length;
  const pts = units.reduce((x, u) => x + (u.points || 0), 0);
  const loose = q ? [] : unattachedLeaders(units, sheets, links, data);
  return `<div class="ds-wrap p${me}">
    ${loose.length ? `<div class="card lead-info"><div class="lead-info-h">ⓘ ${loose.length} leader${loose.length === 1 ? '' : 's'} not attached yet</div>
      <p class="muted xs">${loose.length === 1 ? 'This character can' : 'These characters can'} lead a unit of your army – attach to give the unit the leader's abilities.</p>
      ${loose.map(L => attachPicker(L, sheets.get(L.id), units, sheets, links, data)).join('')}</div>` : ''}
    <p class="muted xs ds-summary">${units.length} unit${units.length === 1 ? '' : 's'}${pts ? ` · ${pts} pts` : ''} · ${found}/${units.length} with a datasheet${!data.units.length ? ' · no datasheets available for this faction' : ''}${q ? ` · ${shown.length} match${shown.length === 1 ? '' : 'es'}` : ''}</p>
    ${q ? '' : ruleBoxes(book, k => ui.open.has(k))}
    ${cards.length ? `<div class="book-units">${roleSections(cards)}</div>` : '<p class="muted small center">No unit matches.</p>'}</div>`;
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
  if (resources.some(r => !linkedToggleOf(ctx, me, r))) {
    tiles.push(`<div class="card tile tile-res p${me}"><div class="tile-title">Resource</div>${resources.map((r, index) => linkedToggleOf(ctx, me, r) ? '' : `<div class="res"><div class="row between nowrap"><div class="res-name">${esc(r.name)}${r.max != null ? `<span class="muted xs"> / max ${r.max}</span>` : ''}</div>
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
  // the player's own army can be added from this phone while the host sets the game up (the host sees it at once)
  const { state, me } = ctx;
  const pl = (state.players || [])[me] || {};
  const units = Array.isArray(pl.units) ? pl.units : [];
  const pts = units.reduce((t, u) => t + (Number(u.points) || 0), 0);
  const F = (ctx.data && ctx.data.FACTIONS) || [];
  const fac = pl.faction ? F.find(f => f.id === pl.faction) : null;
  const dets = (pl.detachments || []).map(id => { const d = fac && (fac.detachments || []).find(x => x.id === id); return d ? d.name : null; }).filter(Boolean);
  const armyLine = fac ? `<p data-no-i18n><b>${esc(fac.name)}</b>${dets.length ? ' · ' + esc(dets.join(', ')) : ''}${units.length ? ` · ${units.length} ${units.length === 1 ? 'unit' : 'units'} · ${pts} pts` : ''}</p>` : '';
  return `<div class="pl-body">
    <div class="card p${me}">
      <div class="title">Your army – <span data-no-i18n>${esc(pName(state, me))}</span></div>
      ${units.length ? armyLine : armyLine + '<p class="muted small">No list yet. Add your list from this device (My armies) or paste a text export – the host sees it in the setup right away.</p>'}
      ${btn({ label: units.length ? 'Replace my army list' : 'Add my army list', kind: `p${me}`, cta: !units.length, action: 'army-import' })}
    </div>
    <div class="card center">
      <div class="title">The game is still in setup</div>
      <p class="muted">Players, mission and the rest are set in the setup. Your stratagems and army list appear here afterwards.</p>
      ${btn({ label: 'Go to setup', kind: 'ghost', action: 'nav', data: { href: ctx.roleHash(ctx.code, ctx.me, 'setup') } })}
      <p class="mt">${btn({ label: 'Lobby', kind: 'ghost', small: true, action: 'nav', data: { href: '#/' } })}</p>
    </div></div>`;
}

export function renderDeploy(ctx, ui) {
  return `<div class="card p${ctx.me} deploy-card"><div class="card-head"><div class="title">Deployment</div><span class="badge warn">the Score tablet runs the sequence</span></div>
      <p class="small">Attacker/Defender, alternating deployment and the roll-off for the first turn are handled on the Score tablet. Deployment and reserve rules are in the Rulebook.</p>
      ${btn({ label: 'Rulebook', kind: 'ghost', small: true, action: 'nav', data: { href: `#/g/${ctx.code}/rules` } })}</div>`;
}

/** Bonus VP split into Battle Ready (bonus 'battle-ready') and the manual Modifier – rows only for what was booked. */
export function bonusRows(state, vp) {
  const br = [0, 1].map(p => (state.scores || []).filter(x => x.player === p && x.src === 'bonus' && x.card === 'battle-ready').reduce((a, x) => a + (Number(x.vp) || 0), 0));
  const mod = [0, 1].map(p => (Number(vp[p].bonus) || 0) - br[p]);
  return (br.some(Boolean) ? `<tr><td>Battle Ready</td><td>${br[0]}</td><td>${br[1]}</td></tr>` : '')
    + (mod.some(Boolean) ? `<tr><td>Modifier</td><td>${mod[0]}</td><td>${mod[1]}</td></tr>` : '');
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
      ${bonusRows(state, vp)}<tr class="total"><td>Total</td><td>${vp[0].total}</td><td>${vp[1].total}</td></tr></tbody></table></div>
    <div class="row">${btn({ label: 'Score view (read-only)', kind: 'primary', action: 'nav', data: { href: `#/g/${code}/watch` } })}${btn({ label: 'Lobby', kind: 'ghost', action: 'nav', data: { href: '#/' } })}</div>
  </div>`;
}
