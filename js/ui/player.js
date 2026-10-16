/* Player phone – export render(root, ctx) for #/g/CODE/p/0|1.
 *
 * render() builds one skeleton per (code, me, stage, tab) and on every state push patches only the sections
 * ([data-sec]) so open <details>, scroll position and the search box survive. UI state (tab, filter, open details)
 * lives per code+player in player-common.js (uiState); tab/filter are kept in localStorage.
 * The phone books nothing but stratagem use/undo, once-per-X ability use/undo and resource counters; phases are never set here.
 * Events: one delegation on root.
 * Layout: pinned head + tabs; ≥ 900 px a two-column grid with general-info tiles on the right (data-sec="side").
 */
import { esc, toast, colorOf, autoNote, sheet, confirmSheet } from './components.js';
import { WH } from '../../data/rules.js';
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
  if (!['army', 'missions', 'strats', 'units'].includes(ui.tab)) ui.tab = 'army';
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
      // deployment info, in the battle the "+1 CP" rule offers (Add / Skip) above every tab
      put('deploy', stage === 'deploy' ? T.renderDeploy(ctx, ui) : T.renderCpOffers(ctx));
      put('side', T.renderSide(ctx, ui));
      put('guide', compactGuide(guideHtml(state, me)));
      bindGuide(root, ctx.rerender);
      switch (ui.tab) {
        case 'missions':
          put('filters', '');
          put('body', T.renderMissions(ctx, ui));
          break;
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
    syncSheets(ctx, ui);
  } catch (e) {
    console.error('player render', e);
    put('body', `<div class="card bad"><div class="title">Render error</div><pre class="muted xs">${esc(e && e.stack || e)}</pre></div>`);
  }
}

/** Phase guide on the phone: collapsed to its one-line summary unless the player opened it (remembered by tutorial.js). */
function compactGuide(html) {
  if (!html) return '';
  let open = false;
  try { open = localStorage.getItem('br40k.guideOpen') === '1'; } catch {}
  return open ? html : html.replace(/ open data-guide>/, ' data-guide>');
}

/** Popups that follow the game state on the player's own phone:
 *  – the player's own scoring (pending score of this player) opens once per scoring; closing it leaves "Score now" in Missions;
 *  – at the start of the player's Command phase (or a battle round): the start-of-turn picks (Combat Doctrines, Waaagh! …). */
function syncSheets(ctx, ui) {
  const s = ctx.state;
  if (!s) return;
  const key = s.stage === 'battle' ? S.pendingKey(s, ctx.me) : null;   // only this player's own open part
  if (ui.scoreSheet && ui.scoreSheet.key !== key) { const c = ui.scoreSheet.close; ui.scoreSheet = null; c(); }
  if (key && !ctx.spectator && !ui.scoreSheet && ui.scoreDismissed !== key) S.openScoreSheet(ctx, ui);
  if (ui.startSheet) { ui.startSheet.refresh(); return; }
  if (ctx.spectator || s.stage !== 'battle' || key) return;
  const skey = `${s.round}|${s.turn}`;
  const lsKey = `sb40k.pl.start.${ui.key}`;
  if (ui.startShown === undefined) { try { ui.startShown = localStorage.getItem(lsKey) || null; } catch { ui.startShown = null; } }
  if (ui.startShown === skey) return;
  const picks = T.startPicks(ctx);
  if (!picks.length) return;
  ui.startShown = skey;
  try { localStorage.setItem(lsKey, skey); } catch {}
  openStartSheet(ctx, ui, picks.map(it => it.key));
}

/** Start-of-turn prompt: the open choices / toggles with their normal controls (handled by H like in the Army tab). */
function openStartSheet(ctx, ui, keys) {
  const body = () => {
    const c = ui.ctx || ctx;
    const items = keys.map(k => fxItem(c, c.me, k)).filter(Boolean);
    return `<p class="muted small">Start of your ${c.state.turn === c.me ? 'turn' : 'battle round'} · Round ${esc(c.state.round)} – choose now (you can change it later in the Army tab under Active effects).</p>
      <div class="fx-list">${items.map(it => T.fxRow(c, c.me, it)).join('')}</div>`;
  };
  let el0 = null;
  const close = sheet({
    title: 'Start of turn',
    cls: 'p' + ctx.me + ' start-sheet',
    body: body(),
    actions: [{ label: 'Done', kind: 'primary', cta: true }],
    onOpen: el => {
      el0 = el;
      el.addEventListener('click', e => {
        const a = e.target.closest('[data-action]');
        if (!a || a.disabled || a.classList.contains('disabled')) return;
        const fn = H[a.dataset.action];
        if (!fn) return;
        e.preventDefault();
        Promise.resolve().then(() => fn(a, ui.ctx || ctx, ui)).catch(err => { console.error(err); toast(err && err.message ? err.message : String(err), 'bad'); });
      });
    },
    onClose: () => { ui.startSheet = null; }
  });
  ui.startSheet = { close, refresh: () => { const b = el0 && el0.querySelector('.sheet-body'); if (b) b.innerHTML = body(); } };
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
  if (e.fx) { gotoEffect(ctx, ui, e.fx); return; }   // a Combat Doctrine / Waaagh!: chosen under Active effects
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
/** Army tab: scroll to an Active effects row and flash it. */
function gotoEffect(ctx, ui, key) {
  if (ui.tab !== 'army') { ui.tab = 'army'; uiSave(ui); ctx.rerender(); }
  setTimeout(() => {
    const row = document.querySelector(`.pl [data-fx="${CSS.escape(key)}"]`);
    if (!row) return;
    const pin = document.querySelector('.pl-pin');
    const top = row.getBoundingClientRect().top + window.scrollY - ((pin ? pin.offsetHeight : 0) + 8);
    try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch { window.scrollTo(0, Math.max(0, top)); }
    row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1600);
  }, 30);
}
/** Keyword chip of a stratagem card: your units with that keyword (or excluded by it). */
H['kw.units'] = (el, ctx) => S.openKwUnitsSheet(ctx, el.dataset.kwu, !!el.dataset.not);

/* ───────── Missions tab: the player's own mission actions ───────── */
H['score.view'] = (el, ctx, ui) => S.openScoreView(ctx, ui);
H['score.open'] = (el, ctx, ui) => { ui.scoreDismissed = null; S.openScoreSheet(ctx, ui); };
H['mission.info'] = (el, ctx, ui) => S.openMissionInfo(ctx, ui, el.dataset.src, el.dataset.card);
H['sec.draw'] = async (el, ctx) => {
  const before = (ctx.state.players[ctx.me].secondaries.hand || []).slice();
  const r = await ctx.dispatch({ type: 'sec.draw', player: ctx.me, cardRule: true });
  if (!r) return;
  const drawn = (r.players[ctx.me].secondaries.hand || []).filter(c => !before.includes(c));
  toast(drawn.length ? `Drawn: ${drawn.map(c => (WH.SECONDARY[c] || {}).name || c).join(', ')}` : 'No card left to draw', drawn.length ? 'ok' : 'warn', 3000);
};
H['sec.achieve'] = async (el, ctx, ui) => {
  const card = el.dataset.card, name = (WH.SECONDARY[card] || {}).name || card;
  if (!await confirmSheet({ title: `“${name}” achieved?`, text: 'The card moves to your achieved pile and leaves your hand. Book its VP first – your end-of-turn scoring moves scored cards there by itself.', ok: 'Achieved', kind: 'primary' })) return;
  const r = await (ui.ctx || ctx).dispatch({ type: 'sec.achieve', player: ctx.me, card });
  if (r) toast(`${name} achieved`, 'ok', 2000);
};
H['sec.discard.open'] = (el, ctx, ui) => S.openDiscardSheet(ctx, ui, el.dataset.card);
H['sec.pick'] = (el, ctx, ui) => S.openPickSheet(ctx, ui, el.dataset.card);
/** "+1 CP" rule offer (Da Boss …): Add books the CP, Skip only removes the offer. */
H['cp.offer'] = async (el, ctx, ui) => {
  const ok = el.dataset.ok === '1';
  const o = (ctx.state.cpOffers || []).find(x => x.id === el.dataset.id);
  el.disabled = true;
  const r = await (ui.ctx || ctx).dispatch({ type: 'cp.offer', player: ctx.me, offerId: el.dataset.id, accept: ok });
  if (r && ok && o) toast(`+${o.cp} CP – ${o.name}`, 'ok', 2000);
};
H['sec.return'] = async (el, ctx) => {
  const r = await ctx.dispatch({ type: 'sec.discard', player: ctx.me, card: el.dataset.card, reason: 'return', cardRule: true });
  if (r) toast('Card rule applied – new card drawn', 'ok', 2500);
};
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
  // a once-per-battle counter that mirrors this toggle ("War Cry (Waaagh!) – once per battle") follows it
  const ri = e.limit === 'battle' ? T.linkedResourceOf(ctx, me, it) : -1;
  const lr = ri >= 0 ? state.players[me].resources[ri] : null;
  if (toggleOn(state, me, it)) {
    let undone = false;
    if (e.limit) { const u = T.fxUse(state, me, useKey, e.limit); if (sameTurn(u, state)) undone = !!await ctx.dispatch({ type: 'ability.undo', player: me, useId: u.id }); }
    await ctx.dispatch({ type: 'effect.set', player: me, key: it.key, value: null, label: e.name });
    if (undone && lr && (Number(lr.value) || 0) > 0) await ctx.dispatch({ type: 'resource.set', player: me, index: ri, value: 0 });
    return;
  }
  if (e.limit) {
    const r = await ctx.dispatch({ type: 'ability.use', player: me, key: useKey, name: e.name, limit: e.limit, source: it.src });
    if (!r) return;
  }
  const r = await ctx.dispatch({ type: 'effect.set', player: me, key: it.key, value: true, label: e.name, display: 'on' });
  const auto = e.limit ? [`${e.name} marked as used (${T.limitLabel(e.limit)})`] : [];
  if (r && lr && (Number(lr.value) || 0) < (lr.max || 1) && await ctx.dispatch({ type: 'resource.set', player: me, index: ri, value: lr.max || 1 })) auto.push(`${lr.name}: ${Number(lr.value) || 0} → ${lr.max || 1}`);
  if (r) autoNote(`${e.name} on`, auto);
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
