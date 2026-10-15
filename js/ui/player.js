/* Player phone – export render(root, ctx) for #/g/CODE/p/0|1.
 *
 * render() builds one skeleton per (code, me, stage, tab) and on every state push patches only the sections
 * ([data-sec]) so open <details>, scroll position and the search box survive. UI state (tab, filter, open details)
 * lives per code+player in player-common.js (uiState); tab/filter are kept in localStorage.
 * The phone books nothing but stratagem use/undo, once-per-X ability use/undo and resource counters; phases are never set here.
 * Events: one delegation on root.
 * Layout: pinned head + tabs; ≥ 900 px a two-column grid with general-info tiles on the right (data-sec="side").
 */
import { esc, toast, colorOf, autoNote } from './components.js';
import { guideHtml, bindGuide } from './tutorial.js';
import { uiState, uiSave, fxItem, choicePicked, toggleOn, resourceFor, optionCost, switchCostOf } from './player-common.js';
import * as T from './player-tabs.js';
import * as S from './player-sheets.js';
import { openImportSheet } from './setup-steps.js';

// ---------------------------------------------------------------- Render
export function render(root, ctx) {
  const { state, me } = ctx;
  if (!state) return;
  if (!(me === 0 || me === 1)) {
    root.innerHTML = `<div class="pl"><div class="card center"><div class="title">Invalid player role</div><p><a class="btn ghost" href="#/">Lobby</a></p></div></div>`;
    return;
  }
  const ui = uiState(ctx.code, me);
  ui.ctx = ctx;
  root.__plCtx = ctx;
  root.__plUi = ui;
  bind(root);
  setPlayerColors(state);
  const stage = state.stage;
  if (!['army', 'strats', 'units'].includes(ui.tab)) ui.tab = 'army';
  const key = `${ctx.code}|${me}|${stage}|${ui.tab}`;
  if (root.dataset.plKey !== key) {
    root.dataset.plKey = key;
    root.innerHTML = skeleton(stage, ui, me);
    root.scrollTop = 0;
  }
  const sec = name => root.querySelector(`[data-sec="${name}"]`);
  const put = (name, html) => { const el = sec(name); if (el) el.innerHTML = html; };
  try {
    if (stage === 'setup') {
      put('body', T.renderSetupStage(ctx));
    } else if (stage === 'over') {
      put('body', T.renderOver(ctx));
    } else {
      put('head', T.renderHead(ctx, ui));
      put('tabs', T.renderTabs(ctx, ui));
      put('deploy', stage === 'deploy' ? T.renderDeploy(ctx, ui) : '');
      put('side', T.renderSide(ctx, ui));
      put('guide', guideHtml(state, me));
      bindGuide(root, ctx.rerender);
      switch (ui.tab) {
        case 'strats':
          put('filters', T.renderStratFilters(ctx, ui));
          put('body', T.renderStrats(ctx, ui));
          break;
        case 'units':
          put('filters', '');
          patchUnits(root, ctx, ui);
          break;
        default:
          put('filters', '');
          put('body', T.renderArmy(ctx, ui));
      }
      const fl = sec('filters');
      if (fl) fl.classList.toggle('hidden', ui.tab !== 'strats');
      const pin = root.querySelector('.pl-pin');
      if (pin) root.style.setProperty('--pin-h', pin.offsetHeight + 'px');
      if (stage === 'battle') autoEffects(ctx, ui);
      if (stage === 'battle' && ui.tab === 'strats') followPhase(root, ctx, ui);
    }
  } catch (e) {
    console.error('player render', e);
    put('body', `<div class="card bad"><div class="title">Render error</div><pre class="muted xs">${esc(e && e.stack || e)}</pre></div>`);
  }
}

/** Threshold effects follow the resource at the start of the own turn / during the own Command phase (T.fxAutoActions).
 * One dispatch per (key, value, state seq) – the next state push makes the stored value match. */
function autoEffects(ctx, ui) {
  const acts = T.fxAutoActions(ctx, ui);
  if (!acts.length) return;
  ui.fxSent = ui.fxSent || new Set();
  acts.forEach(a => {
    const k = `${a.key}|${a.value}|${ctx.state.seq}`;
    if (ui.fxSent.has(k)) return;
    ui.fxSent.add(k);
    Promise.resolve(ctx.dispatch(a)).catch(err => console.warn('effect auto-set', err));
  });
}

/** Stratagems tab with tracked phases: when the tablet moves to another phase, scroll to that phase's section. */
function followPhase(root, ctx, ui) {
  const s = ctx.state;
  if (!(s.opts && s.opts.phases === 'manual')) return;
  const key = `${ctx.code}|${s.round}|${s.turn}|${s.phase}`;
  if (ui.lastPhaseKey === key) return;
  ui.lastPhaseKey = key;
  const sec = root.querySelector('section.phase.cur:not(.side-any)');
  if (!sec) return;
  const pin = root.querySelector('.pl-pin');
  const top = sec.getBoundingClientRect().top + window.scrollY - ((pin ? pin.offsetHeight : 0) + 8);
  requestAnimationFrame(() => { try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch { window.scrollTo(0, Math.max(0, top)); } });
}

/** Army list tab: keep the search input (focus/cursor), replace only the list. */
function patchUnits(root, ctx, ui) {
  const body = root.querySelector('[data-sec="body"]');
  if (!body) return;
  const keep = body.querySelector('.search');
  if (!keep || !T.myUnitsCount(ctx)) { body.innerHTML = T.renderUnits(ctx, ui); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = T.renderUnitList(ctx, ui);
  [...body.children].forEach(c => { if (c !== keep) c.remove(); });
  while (tmp.firstChild) body.appendChild(tmp.firstChild);
}

function skeleton(stage, ui, me) {
  if (stage === 'setup' || stage === 'over') return `<div class="pl p${me}"><div data-sec="body"></div></div>`;
  return `<div class="pl battle p${me}">
    <div class="pl-pin">
      <div class="pl-head" data-sec="head"></div>
      <nav class="pl-tabs" data-sec="tabs" role="tablist"></nav>
      <div class="pl-filters chips" data-sec="filters"></div>
    </div>
    <div class="pl-grid">
      <div class="pl-body pl-main">
        <div data-sec="guide"></div>
        <div data-sec="deploy"></div>
        <div data-sec="body" class="pl-flow"></div>
      </div>
      <aside class="pl-side" data-sec="side" aria-label="Overview"></aside>
    </div>
  </div>`;
}

function setPlayerColors(state) {
  const app = document.documentElement; // on :root so popups (appended outside #app) get the player colours too
  if (!app) return;
  for (let i = 0; i < 2; i++) {
    const p = state.players && state.players[i];
    if (p) app.style.setProperty('--p' + i, colorOf(p.color));
  }
}

// ---------------------------------------------------------------- Actions (delegation)
const H = {};
H.noop = () => {};
H.nav = (el, ctx) => ctx.nav(el.dataset.href);
H['army-import'] = (el, ctx) => openImportSheet(ctx, ctx.me); // add the army list after the setup
H.tab = (el, ctx, ui) => { ui.tab = el.dataset.tab; uiSave(ui); ctx.rerender(); };
H.sfilter = (el, ctx, ui) => { ui.sfilter = el.dataset.filter; uiSave(ui); ctx.rerender(); };
H['more.open'] = (el, ctx, ui) => S.openMoreSheet(ctx, ui);

H['strat.open'] = (el, ctx, ui) => S.openStratSheet(ctx, ui, el.dataset.strat, el.dataset.phase);
H['strat.undo'] = async (el, ctx, ui) => {
  const use = (ctx.state.stratUses || []).find(u => u.id === el.dataset.use);
  const r = await ctx.dispatch({ type: 'strat.undo', player: ctx.me, useId: el.dataset.use });
  if (r) toast(`${use ? use.stratName : 'Stratagem'} undone`, 'ok', 2000);
};
/** "Usable this turn" tile: jump to the stratagem card in the Stratagems tab (section of the current turn) and flash it. */
H['strat.goto'] = (el, ctx, ui) => {
  const id = el.dataset.strat;
  if (ui.tab !== 'strats') { ui.tab = 'strats'; uiSave(ui); }
  if (ui.sfilter !== 'all') { ui.sfilter = 'all'; uiSave(ui); }
  ctx.rerender();
  setTimeout(() => {
    const root = document.getElementById('app') || document;
    const sel = `[data-strat-card="${CSS.escape(id)}"]`;
    const card = root.querySelector(`.phase.cur ${sel}`) || root.querySelector(sel);
    if (!card) return;
    const pin = root.querySelector('.pl-pin');
    const top = card.getBoundingClientRect().top + window.scrollY - ((pin ? pin.offsetHeight : 0) + 8);
    try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch { window.scrollTo(0, Math.max(0, top)); }
    card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1600);
  }, 30);
};
/** Reserves card: the unit has arrived on the battlefield (no longer in reserves). */
H['unit.arrived'] = (el, ctx) => ctx.dispatch({ type: 'unit.update', player: ctx.me, unitId: el.dataset.unit, patch: { reserve: 'none' } });
H['unit.attach'] = (el, ctx) => ctx.dispatch({ type: 'unit.update', player: ctx.me, unitId: el.dataset.unit, patch: { leading: el.value || null, attachedTo: null } });
H['buff.info'] = (el, ctx, ui) => S.openBuffSheet(ctx, ui, el.dataset.leader, Number(el.dataset.buff));
/** Once-per-X tracker row: available → ability.use, used → ability.undo of the blocking use. */
H['ability.toggle'] = async (el, ctx, ui) => {
  const e = T.abilityByKey(ctx, el.dataset.key);
  if (!e) { toast('Ability not found', 'bad'); return; }
  if (e.limit === 'phase') { S.openPhaseUseSheet(ctx, e); return; }
  const use = T.abilityUseOf(ctx.state, ctx.me, e);
  if (use) {
    const r = await ctx.dispatch({ type: 'ability.undo', player: ctx.me, useId: use.id });
    if (r) toast(`${e.name}: use undone`, 'ok', 2000);
  } else {
    const r = await ctx.dispatch({ type: 'ability.use', player: ctx.me, key: e.key, name: e.name, limit: e.limit, source: e.source });
    if (r) toast(`${e.name} used (${T.limitLabel(e.limit)})`, 'ok', 2000);
  }
};
H['ability.info'] = (el, ctx, ui) => S.openAbilitySheet(ctx, ui, el.dataset.key);
H['res.step'] = (el, ctx, ui) => {
  const index = Number(el.dataset.index), delta = Number(el.dataset.delta);
  const r = (ctx.state.players[ctx.me].resources || [])[index];
  if (!r) return;
  return ctx.dispatch({ type: 'resource.set', player: ctx.me, index, value: Math.max(0, (r.value || 0) + delta) });
};

/* ───────── Active effects (Army tab): threshold state, choice options, toggles ───────── */
const sameTurn = (u, st) => !!u && u.round === st.round && u.turn === st.turn;
H['fx.set'] = async (el, ctx, ui) => {
  const it = fxItem(ctx, ctx.me, el.dataset.key);
  if (!it) return;
  const st = (it.e.states || []).find(x => x.id === el.dataset.value);
  if (!st) return;
  const r = await ctx.dispatch({ type: 'effect.set', player: ctx.me, key: it.key, value: st.id, label: it.e.name, display: st.name });
  if (r) toast(`${it.e.name}: ${st.name}`, 'ok', 1500);
};
H['fx.pick'] = async (el, ctx, ui) => {
  const { state, me } = ctx;
  const it = fxItem(ctx, me, el.dataset.key);
  if (!it) return;
  const e = it.e;
  const o = (e.options || []).find(x => x.id === el.dataset.value);
  if (!o) return;
  const multi = e.pick === 'multi';
  const picked = choicePicked(state, me, it);
  const useKey = `opt:${it.key}:${o.id}`;
  const oc = optionCost(it, o, picked);
  const cost = oc ? oc.cost : 0;
  const res = cost ? resourceFor(state, me, oc.resource) : null;
  const stored = ((state.players[me].effects) || {})[it.key];
  let next;
  const auto = [];
  if (picked.includes(o.id) && !multi && (e.default || it.defaultOpt || switchCostOf(it))) return;   // always one active – switch instead
  if (picked.includes(o.id)) {
    next = picked.filter(x => x !== o.id);
    // mis-tap correction (picked this turn): give the once-per-battle use and the spent resource back
    let refund = sameTurn(stored, state);
    if (o.limit === 'battle') {
      const u = T.fxUse(state, me, useKey, 'battle');
      refund = sameTurn(u, state);
      if (refund && await ctx.dispatch({ type: 'ability.undo', player: me, useId: u.id })) auto.push(`${o.name}: once-per-battle use given back`);
    }
    if (refund && res) {
      const cur = (ctx.state.players[me].resources || [])[res.index] || res.r;
      if (await ctx.dispatch({ type: 'resource.set', player: me, index: res.index, value: (Number(cur.value) || 0) + cost })) auto.push(`+${cost} ${res.r.name} given back (${Number(cur.value) || 0} → ${(Number(cur.value) || 0) + cost})`);
    }
  } else {
    next = multi ? picked.concat(o.id) : [o.id];
    if (multi && e.max && next.length > e.max) { toast(`${e.name}: at most ${e.max}`, 'warn'); return; }
    if (cost && (!res || (Number(res.r.value) || 0) < cost)) { toast(`${o.name}: needs ${cost} ${res ? res.r.name : o.resource || ''}`, 'warn'); return; }
    if (o.limit === 'battle') {
      const r = await ctx.dispatch({ type: 'ability.use', player: me, key: useKey, name: `${e.name}: ${o.name}`, limit: 'battle', source: it.src });
      if (!r) return;
      auto.push(`${o.name} marked as used (once per battle)`);
    }
    if (cost && res) {
      const r = await ctx.dispatch({ type: 'resource.set', player: me, index: res.index, value: Math.max(0, (Number(res.r.value) || 0) - cost) });
      if (!r) return;
      auto.push(`−${cost} ${res.r.name} · ${o.name} (${Number(res.r.value) || 0} → ${Math.max(0, (Number(res.r.value) || 0) - cost)})`);
    }
  }
  const names = (e.options || []).filter(x => next.includes(x.id)).map(x => x.name);
  const value = next.length ? (multi ? next : next[0]) : null;
  const r = await ctx.dispatch({ type: 'effect.set', player: me, key: it.key, value, label: e.name, display: names.length ? names.join(', ') : null });
  if (r) autoNote(`${e.name}: ${names.length ? names.join(', ') : 'none'}`, auto);
};
H['fx.toggle'] = async (el, ctx, ui) => {
  const { state, me } = ctx;
  const it = fxItem(ctx, me, el.dataset.key);
  if (!it) return;
  const e = it.e;
  const useKey = `tog:${it.key}`;
  if (toggleOn(state, me, it)) {
    if (e.limit) { const u = T.fxUse(state, me, useKey, e.limit); if (sameTurn(u, state)) await ctx.dispatch({ type: 'ability.undo', player: me, useId: u.id }); }
    await ctx.dispatch({ type: 'effect.set', player: me, key: it.key, value: null, label: e.name });
    return;
  }
  if (e.limit) {
    const r = await ctx.dispatch({ type: 'ability.use', player: me, key: useKey, name: e.name, limit: e.limit, source: it.src });
    if (!r) return;
  }
  const r = await ctx.dispatch({ type: 'effect.set', player: me, key: it.key, value: true, label: e.name, display: 'on' });
  if (r) autoNote(`${e.name} on`, e.limit ? [`${e.name} marked as used (${T.limitLabel(e.limit)})`] : []);
};
H['fx.info'] = (el, ctx, ui) => S.openEffectSheet(ctx, ui, Number(el.dataset.p), el.dataset.key);
H['enh.info'] = (el, ctx, ui) => S.openEnhancementSheet(ctx, ui, el.dataset.name);

function bind(root) {
  if (root.__playerBound) return;
  root.__playerBound = true;
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el) || el.disabled || el.classList.contains('disabled')) return;
    const ctx = root.__plCtx, ui = root.__plUi;
    const fn = H[el.dataset.action];
    if (!ctx || !fn) return;
    e.preventDefault();
    Promise.resolve().then(() => fn(el, ctx, ui)).catch(err => { console.error(err); toast(err && err.message ? err.message : String(err), 'bad'); });
  });
  root.addEventListener('keydown', e => {
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[data-action][role]') && !t.matches('button,a,input,select,textarea')) {
      e.preventDefault(); t.click();
    }
  });
  let searchTimer = null;
  // <select data-change="…">: same handler map as clicks (e.g. "Attached to" picker of a leader)
  root.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (!el || !root.contains(el)) return;
    const ctx = root.__plCtx, ui = root.__plUi, fn = H[el.dataset.change];
    if (!ctx || !fn) return;
    Promise.resolve().then(() => fn(el, ctx, ui)).catch(err => { console.error(err); toast(err && err.message ? err.message : String(err), 'bad'); });
  });
  root.addEventListener('input', e => {
    const t = e.target;
    const ui = root.__plUi;
    if (!ui || !t.matches || !t.matches('[data-search]')) return;
    ui.search = t.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { const ctx = root.__plCtx; if (ctx && ui.tab === 'units') patchUnits(root, ctx, ui); }, 120);
  });
  // Remember open/closed <details> (toggle does not bubble → capture)
  root.addEventListener('toggle', e => {
    const d = e.target;
    const ui = root.__plUi;
    if (!ui || !d || d.tagName !== 'DETAILS' || !d.dataset.key) return;
    if (d.dataset.defaultOpen) { if (d.open) ui.closed.delete(d.dataset.key); else ui.closed.add(d.dataset.key); return; }
    if (d.open) ui.open.add(d.dataset.key); else ui.open.delete(d.dataset.key);
  }, true);
}
