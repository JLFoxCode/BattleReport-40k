/* Player phone – sheets: the stratagem popup (rule text + use controls: cost stepper, CP reduction, optional target unit),
 * the "⋯" sheet (settings, note, links) and the leader-buff info sheet. Sheets live outside the view root, so their clicks are handled here. */
import { WH } from '../../data/rules.js';
import { esc, sheet, toast, chip, btn, autoNote } from './components.js';
import {
  stepper, cpBadge, affectedUnits, myUnits, pName, cleanOrig, stratPhaseId, stratIn, phasePill, turnBadge, stratSrc, stratKwList, kwLine,
  stratOrigBlock, stratUseState, stratAddonsOf, resourceFor, resShort, fxItem, armyOf, origData, origMod, ensureOrig, enhancementOf
} from './player-common.js';
import { buffsOfId, abilityTracker, abilityByKey, abilityUseOf, entryLabel, phaseUsesOf, PHASE_CHOICES } from './player-tabs.js';

/** Tracker entries whose text reduces a Stratagem's CP cost; amount = CP reduction (Infinity = free / 0 CP).
 * CP gains ("you gain 1CP", "roll one D6: on a 5+") and CP increases ("twice/three times that Stratagem's … CP cost") are not reductions. */
const CP_RED_RE = /\bCP\b|\dCP\b|regardless of any other uses/i;
const CP_HOW_RE = /\bless\b|\breduc(?:e|ed|es|ing)\b|\binstead of\b|\bfor 0 ?CP\b|\b0 ?CP\b|\bcosts? 0\b|\bfree\b|[-−–]\s?1 ?CP\b|regardless of any other uses/i;
const CP_GAIN_RE = /\bgain(?:s|ed)? (?:\d|one|D\d)\s?CP\b|\byou gain\b|\broll one D6[:,]? on a\b|\bregain\b/i;
const CP_MORE_RE = /\b(?:twice|two times|three times|double)\b[^.]*?\bStratagem['’]?s?\b[^.]*?\bCP\b|\bincreas(?:e|ed|es)\b[^.]*?\bCP\b|\b(?:\d|one) ?CP more\b/i;
export function cpReductions(ctx, strat = null) {
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return abilityTracker(ctx).filter(e => CP_RED_RE.test(e.text) && CP_HOW_RE.test(e.text) && !CP_GAIN_RE.test(e.text) && !CP_MORE_RE.test(e.text)).filter(e => {
    // "… with the Command Re-roll Stratagem …" / "… with the Rapid Ingress stratagem …" (Teleport Homer): only for that Stratagem
    const only = /\bthe ([A-Z][A-Za-z’'\- ]*?) [Ss]tratagem\b/.exec(e.text);
    return !strat || !only || norm(only[1]) === norm(strat.name);
  }).map(e => {
    const t = e.text;
    let amount = 1;
    if (/\bfor 0 ?CP\b|\b0 ?CP\b|\bcosts? 0\b|\bfree\b|\binstead of\b/i.test(t) && !/\breduc|\bless\b|[-−–]\s?1 ?CP\b/i.test(t)) amount = Infinity;
    const m = /(\d)\s*CP\s+less\b|\bby\s+(\d)\s*CP\b|\breduced?\b[^.]*?\bby\s+(\d)\b|[-−–]\s?(\d) ?CP\b/i.exec(t);
    if (m) amount = Number(m[1] || m[2] || m[3] || m[4]) || 1;
    // a price for the reduction ("spend 1YP") is paid with it
    const pay = /\bspend (\d+) ?([A-Z]{2,4})\b/.exec(t);
    return Object.assign({ amount, pay: pay ? { n: Number(pay[1]), res: pay[2] } : null }, e);
  });
}

/** Stratagem popup: name, cost, phase + turn, source, summary, verbatim original text, keywords – and the Use controls at the bottom. */
export function openStratSheet(ctx, ui, stratId, secPhase) {
  const c0 = ui.ctx || ctx;
  const { state, me, derived } = c0;
  const s0 = (derived.stratagems[me] || []).find(x => x.id === stratId);
  if (!s0) { toast('Stratagem not found', 'bad'); return; }
  // as used in the phase of the section it was opened from (owner and once-per-phase lock of that phase)
  const phase = stratPhaseId(s0, secPhase, state.phase);
  const s = stratIn(s0, c0, phase);
  const pl = state.players[me];
  const printed = Number(s.cost) || 0;
  let cost = printed;
  let red = null;   // chosen CP reduction (tracker entry) or null
  const maxCost = Math.max(cost, 3, pl.cp || 0);
  const cp = pl.cp || 0;
  const st = stratUseState(s, c0);
  const { use, used, fits, inBattle } = st;
  const units = myUnits(state, me);
  const kws = stratKwList(s);
  const hits = new Set(affectedUnits(units, kws, c0).map(u => u.id));
  const sorted = units.slice().sort((a, b) => (hits.has(b.id) ? 1 : 0) - (hits.has(a.id) ? 1 : 0));
  const unitOpts = sorted.map(u => `<option value="${esc(u.id)}"${u.status === 'shocked' ? ' disabled' : ''}>${esc(u.name)} (${u.models})${hits.has(u.id) ? ' ✓' : ''}${u.status === 'shocked' ? ' – Battle-shocked' : ''}</option>`).join('');
  const reds = fits && !used ? cpReductions(c0, s) : [];
  const cpOnly = st.cpOnly && reds.length > 0;   // short of CP: usable only when a reduction applies to this Stratagem
  // Stratagem add-ons bought with an army resource (data/effects stratAddons, e.g. +1 YP: [SUSTAINED HITS 1])
  const addons = stratAddonsOf(c0, s).map(a => Object.assign({}, a, { res: resourceFor(state, me, a.resource) }));
  const picks = new Map();   // add-on id → amount spent
  const addonCost = a => (a.cost === 'any' ? (picks.get(a.id) || 0) : Number(a.cost) || 0);
  const spentOn = index => addons.filter(a => picks.has(a.id) && a.res && a.res.index === index).reduce((x, a) => x + addonCost(a), 0);
  const resNow = a => (a.res ? Number(a.res.r.value) || 0 : 0);
  const cpDeltaSum = () => addons.filter(a => picks.has(a.id)).reduce((x, a) => x + (Number(a.cpDelta) || 0), 0);
  let baseCost = printed;   // printed cost after a CP reduction ability; add-ons with cpDelta apply on top
  const recost = () => { cost = Math.max(0, baseCost + cpDeltaSum()); };
  const addonRow = () => {
    if (!addons.length) return '';
    const interactive = fits && !used && (s.available || cpOnly);
    const chips = addons.map(a => {
      const on = picks.has(a.id);
      const short = a.res ? resShort(a.res.r.name) : resShort(a.resource || '');
      const left = a.res ? resNow(a) - spentOn(a.res.index) : 0;
      const need = a.cost === 'any' ? 1 : Number(a.cost) || 0;
      const dis = !interactive || (!on && (!a.res || need > left));
      const cpd = Number(a.cpDelta) || 0;
      const label = `${a.cost === 'any' ? '+X' : '+' + (Number(a.cost) || 0)} ${short}: ${String(a.name || '').replace(/^\+\s*/, '')}${cpd && !/CP/.test(String(a.name || '')) ? ` (${cpd > 0 ? '+' : '−'}${Math.abs(cpd)} CP)` : ''}`;
      const amt = on && a.cost === 'any' ? `<div class="stepper sm addon-amt"><button type="button" data-adelta="-1" data-id="${esc(a.id)}"${(picks.get(a.id) || 0) <= 1 ? ' disabled' : ''} aria-label="Less">−</button><span class="stepper-value">${picks.get(a.id) || 0}</span><button type="button" data-adelta="1" data-id="${esc(a.id)}"${left <= 0 ? ' disabled' : ''} aria-label="More">+</button></div>` : '';
      return `<div class="addon${on ? ' on' : ''}">${chip({ html: `<span class="addon-check" aria-hidden="true">${on ? '✓' : ''}</span><b>${esc(label)}</b>`, on, action: 'addon.pick', data: { id: a.id }, cls: 'sm addon-chip' + (dis ? ' disabled' : '') })}${amt}
        ${a.effect ? `<div class="addon-eff xs">${esc(a.effect)}</div>` : ''}</div>`;
    }).join('');
    const idx = [...new Set(addons.filter(a => a.res).map(a => a.res.index))];
    const after = idx.map(i => { const a = addons.find(x => x.res && x.res.index === i); const sh = esc(resShort(a.res.r.name)); return `${resNow(a)} ${sh} now · Resource after use: <b>${resNow(a) - spentOn(i)} ${sh}</b>`; }).join(' · ');
    return `<div class="label">Add-ons</div><div class="addons">${chips}</div>${after ? `<p class="muted xs">${after}</p>` : ''}`;
  };
  const canUse = fits && !used && (s.available || cpOnly);
  const blocked = fits && !used && !canUse ? (s.reason || 'Not available') : '';
  const redRow = () => reds.length ? `<div class="label">CP reduction</div><div class="chips red-chips">
      ${chip({ label: 'None', on: !red, action: 'red.pick', data: { key: '' }, cls: 'sm' })}
      ${reds.map(e => {
        const u = abilityUseOf(state, me, e);
        return chip({ html: `${esc(e.name)} <span class="muted xs">· ${esc(e.source)} · ${esc(entryLabel(e))}${e.pay ? ` · costs ${e.pay.n} ${esc(e.pay.res)}` : ''}${u ? ' · used' : ''}</span>`, on: !!red && red.key === e.key, action: 'red.pick', data: { key: e.key }, cls: 'sm' + (u ? ' disabled' : '') });
      }).join('')}</div>
      <p class="muted xs">Choosing a reduction marks that ability as used (before the Stratagem is booked).</p>` : '';
  const costRow = () => `<div class="row between"><span class="label" style="margin:0">CP cost${red || cost !== printed ? ` <span class="muted xs">(printed ${printed})</span>` : ''}</span>${stepper({ value: cost, min: 0, max: maxCost, action: 'noop', data: { f: 'cost' }, player: me })}</div>
    <p class="muted xs">You have ${cp} CP · CP after use: <b>${cost > cp ? '–' : cp - cost}</b>.${cost > cp ? ` <span class="text-bad">Not enough CP (${cp}/${cost}).</span>` : ''}</p>`;
  const syncUse = el => {
    const b = el.querySelector('[data-sheet-action="1"]');
    if (!b) return;
    const short = cost > cp;
    b.disabled = short;
    b.textContent = short ? 'Not enough CP' : 'Use';
  };
  const render = el => {
    el.querySelector('#strat-cost').innerHTML = costRow(); el.querySelector('#strat-red').innerHTML = redRow();
    const ad = el.querySelector('#strat-addons'); if (ad) ad.innerHTML = addonRow();
    syncUse(el);
  };
  // Use section at the bottom of the popup
  let useHtml = '';
  if (used) useHtml = `<div class="strat-use used"><span class="badge used">Used (${use.cost} CP)</span><span class="muted xs">this ${state.opts && state.opts.stratLock === 'round' ? 'battle round' : 'phase'}</span></div>`;
  else if (canUse) useHtml = `<div class="strat-use"><div class="label">Use</div>
      ${cpOnly ? `<p class="muted xs">${esc(s.reason)} – usable with a CP reduction.</p>` : ''}
      ${addons.length ? `<div id="strat-addons">${addonRow()}</div>` : ''}
      <div id="strat-red">${redRow()}</div>
      <div id="strat-cost">${costRow()}</div>
      ${units.length ? `<label class="field"><span>Unit (optional)</span><select name="unit"><option value="">– no unit –</option>${unitOpts}</select></label>` : ''}
      <p class="muted xs">A unit can only be targeted by one Stratagem per phase; Battle-shocked units cannot be targeted by your own Stratagems.</p></div>`;
  else if (blocked) useHtml = `<div class="strat-use"><p class="strat-reason xs text-warn">Not available: ${esc(blocked)}</p></div>`;
  else useHtml = `<div class="strat-use"><p class="muted xs">${inBattle ? 'Not usable in the current phase / turn.' : 'Usable during the battle.'}</p></div>`;
  // "Any phase" stratagems while the phases are not tracked: the player says which phase it is used in, so the once-per-phase
  // lock (and one stratagem per unit and phase) applies to that phase instead of the whole turn
  const tracked = state.opts && state.opts.phases === 'manual';
  const anyPh = (Array.isArray(s0.ph) && s0.ph.length ? s0.ph : ['any']).includes('any');
  const phaseRow = inBattle && !tracked && anyPh && s.fits !== false ? `<div class="strat-use-phase"><div class="label">Used in</div><div class="chips">
      ${['any', 'command', 'movement', 'shooting', 'charge', 'fight'].map(id => chip({ label: id === 'any' ? 'Not specified' : WH.PHASES.find(p => p.id === id).name, on: s.usePhase === id, action: 'strat.phase', data: { phase: id }, cls: 'sm' })).join('')}
    </div><p class="muted xs">Each Stratagem once per phase – pick the phase to use it again later in this turn.</p></div>` : '';
  const actions = [{ label: used ? 'Close' : 'Cancel', kind: 'ghost' }];
  let closeSelf = null;
  if (used) actions.push({
    label: 'Undo', kind: 'primary',
    onClick: (closeFn) => {
      const c = ui.ctx || ctx;
      c.dispatch({ type: 'strat.undo', player: me, useId: use.id }).then(r => { if (r) { toast(`${s.name} undone`, 'ok', 2000); closeFn(); } })
        .catch(err => toast(err && err.message ? err.message : String(err), 'bad'));
      return false;
    }
  });
  else if (fits) actions.push({
    label: canUse ? (cost > cp ? 'Not enough CP' : 'Use') : (blocked || 'Not available'), kind: 'primary', cta: true, disabled: !canUse || cost > cp,
    onClick: (closeFn, el) => {
      const c = ui.ctx || ctx;
      if (cost > (c.state.players[me].cp || 0)) { toast('Not enough CP', 'bad'); return false; }
      const sel = el.querySelector('select[name=unit]');
      const unitId = sel ? sel.value || '' : '';
      (async () => {
        const auto = [];
        if (red) {
          const r = await c.dispatch({ type: 'ability.use', player: me, key: red.key, name: red.name, limit: red.limit, source: red.source, note: `CP reduction for ${s.name}` });
          if (!r) { toast(`${red.name} could not be used – Stratagem not booked`, 'bad'); return; }
          auto.push(`${red.name} marked as used (${entryLabel(red)}) – ${red.amount === Infinity ? 'Stratagem for 0 CP' : '−' + red.amount + ' CP on the Stratagem'}`);
          if (red.pay) {   // e.g. Ancestral Crest: spend 1YP
            const res = (((r.players || [])[me] || {}).resources || []).map((x, index) => ({ x, index })).find(o => resShort(o.x.name) === red.pay.res || new RegExp('\\(' + red.pay.res + '\\)').test(o.x.name));
            if (res && await c.dispatch({ type: 'resource.set', player: me, index: res.index, value: Math.max(0, (Number(res.x.value) || 0) - red.pay.n) })) auto.push(`−${red.pay.n} ${red.pay.res} · ${red.name} (${res.x.name}: ${Number(res.x.value) || 0} → ${Math.max(0, (Number(res.x.value) || 0) - red.pay.n)})`);
            else auto.push(`${red.pay.n} ${red.pay.res} for ${red.name} NOT booked – no such resource, correct it by hand`);
          }
        }
        // phase = the phase it is used in (booking key for once per phase / one stratagem per unit and phase)
        const r = await c.dispatch({ type: 'strat.use', player: me, stratId: s.id, cost, unitId: unitId || undefined, phase: s.usePhase !== 'any' ? s.usePhase : undefined });
        if (!r) return;
        const chosen = addons.filter(a => picks.has(a.id) && a.res && addonCost(a) > 0);
        const spent = [];
        for (const index of [...new Set(chosen.map(a => a.res.index))]) {
          const total = chosen.filter(a => a.res.index === index).reduce((x, a) => x + addonCost(a), 0);
          const cur = ((r.players || (c.state && c.state.players) || [])[me] || {}).resources || [];
          const before = Number((cur[index] || {}).value) || 0;
          const rr = await c.dispatch({ type: 'resource.set', player: me, index, value: Math.max(0, before - total) });
          if (rr) spent.push(`−${total} ${resShort((cur[index] || {}).name || '')}`);
        }
        auto.unshift(`−${cost} CP · ${s.name}${cost !== printed ? ` (printed ${printed} CP)` : ''}`);
        if (chosen.length) auto.push(...chosen.map(a => `Add-on: ${String(a.name || '').replace(/^\+\s*/, '')}`));
        auto.push(...spent);
        autoNote(`${s.name} used`, auto);
        closeFn();
      })().catch(err => toast(err && err.message ? err.message : String(err), 'bad'));
      return false;   // the sheet closes itself after a successful booking
    }
  });
  return (closeSelf = sheet({
    title: s.name,
    cls: 'p' + me + ' strat-sheet ph-' + phase,
    body: `<div class="strat-sheet-head">
        ${cpBadge(s.cost, inBattle ? cp : Infinity)}${phasePill(phase)}${turnBadge(s.whose)}${stratSrc(s)}
        ${s.once ? '<span class="badge xs">once per battle</span>' : ''}${s.notRound1 ? '<span class="badge xs">not in round 1</span>' : ''}
      </div>
      ${s.t ? `<p class="strat-t">${esc(s.t)}</p>` : ''}
      ${stratOrigBlock(s, c0)}
      ${s.plus && s.plus.name ? `<div class="orig-block"><div class="orig-label">${esc(s.plus.name)} (+${Number(s.plus.cost) || 0} CP – raise the CP cost below)</div><div class="orig-text">${esc(cleanOrig(s.plus.text || ''))}</div></div>` : ''}
      ${kwLine(kws)}
      
      ${addons.length && !canUse ? `<div class="strat-addons-info">${addonRow()}</div>` : ''}
      ${phaseRow}${useHtml}`,
    actions,
    onOpen: (el) => {
      if (phaseRow) el.addEventListener('click', e => {
        const pc = e.target.closest('[data-action="strat.phase"]');
        if (!pc) return;
        e.preventDefault(); e.stopPropagation();
        if (pc.dataset.phase === s.usePhase) return;
        if (closeSelf) closeSelf();
        openStratSheet(ctx, ui, stratId, pc.dataset.phase);   // re-evaluated for that phase (use state, lock)
      });
      if (!canUse) return;
      syncUse(el);
      el.addEventListener('click', e => {
        const ap = e.target.closest('[data-action="addon.pick"]');
        if (ap) {
          e.preventDefault();
          if (ap.classList.contains('disabled')) return;
          const a = addons.find(x => x.id === ap.dataset.id);
          if (!a) return;
          if (picks.has(a.id)) picks.delete(a.id); else picks.set(a.id, a.cost === 'any' ? 1 : Number(a.cost) || 0);
          if (Number(a.cpDelta)) recost();
          render(el);
          return;
        }
        const ad = e.target.closest('[data-adelta]');
        if (ad) {
          e.preventDefault();
          const a = addons.find(x => x.id === ad.dataset.id);
          if (!a || !picks.has(a.id) || !a.res) return;
          const others = spentOn(a.res.index) - addonCost(a);
          const cap = Number.isFinite(Number(a.max)) ? Number(a.max) : Infinity;   // add-on may cap the amount (e.g. Augmented Assault: up to 2)
          const v = Math.max(1, Math.min(resNow(a) - others, cap, (picks.get(a.id) || 0) + Number(ad.dataset.adelta)));
          picks.set(a.id, v);
          render(el);
          return;
        }
        const b = e.target.closest('[data-delta]');
        if (b) {
          cost = Math.max(0, Math.min(maxCost, cost + Number(b.dataset.delta)));
          render(el);
          return;
        }
        const r = e.target.closest('[data-action="red.pick"]');
        if (!r || r.classList.contains('disabled')) return;
        e.preventDefault();
        const key = r.dataset.key || '';
        red = key ? reds.find(x => x.key === key) || null : null;
        baseCost = red ? Math.max(0, printed - (red.amount === Infinity ? printed : red.amount)) : printed;
        recost();
        render(el);
      });
    }
  }));
}

/** Verbatim text of a once-per-X tracker entry. */
export function openAbilitySheet(ctx, ui, key) {
  const c = ui.ctx || ctx;
  const e = abilityByKey(c, key);
  if (!e) { toast('Ability not found', 'bad'); return; }
  const use = abilityUseOf(c.state, c.me, e);
  return sheet({
    title: e.name,
    cls: 'p' + c.me,
    body: `<div class="row between"><span class="muted small">${esc(e.source)}</span><span class="badge lim">${esc(entryLabel(e))}</span></div>
      <div class="orig-block"><div class="orig-label">Original text</div><div class="orig-text">${esc(cleanOrig(e.text))}</div></div>
      <p class="muted small">${use ? `Used in battle round ${use.round}${e.limit !== 'battle' ? ` (${use.turn === c.me ? 'your' : "opponent's"} turn)` : ''}.` : 'Available.'}</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

/** "⋯" sheet: settings (stratagem lock, auto scoring), note, links (Score tablet, Rulebook, Lobby, Setup). */
export function openMoreSheet(ctx, ui) {
  const { me, code } = ctx;
  const cur = () => (ui.ctx || ctx);
  const settings = () => {
    const st = cur().state;
    const lock = (st.opts && st.opts.stratLock) || 'phase';
    return `<div class="label">Stratagem lock</div>
      <div class="chips">${chip({ label: 'Per phase (rule)', on: lock === 'phase', action: 'opt.set', data: { key: 'stratLock', value: 'phase' }, cls: 'sm' })}${chip({ label: 'Per round (house rule)', on: lock === 'round', action: 'opt.set', data: { key: 'stratLock', value: 'round' }, cls: 'sm' })}</div>
      <p class="muted xs lock-text">${esc((WH.STRAT_LOCK || {})[lock] || '')}</p>`;
  };
  return sheet({
    title: 'More',
    cls: 'p' + me,
    body: `<div class="more-sec"><div class="title sm">Views</div><div class="row wrap">
        ${btn({ label: 'Score (tablet)', kind: 'ghost', small: true, action: 'nav', data: { href: ctx.roleHash(code, 'desktop', 'table') } })}
        ${btn({ label: 'Rulebook', kind: 'ghost', small: true, action: 'nav', data: { href: `#/g/${code}/rules` } })}
        ${btn({ label: 'Lobby', kind: 'ghost', small: true, action: 'nav', data: { href: '#/' } })}
        ${btn({ label: 'Setup', kind: 'ghost', small: true, action: 'nav', data: { href: ctx.roleHash(code, me, 'setup') } })}
      </div></div>
      <div class="more-sec"><div class="title sm">Note</div>
        <div class="row nowrap"><input type="text" data-draft placeholder="e.g. dice result, agreement …" value="${esc(ui.noteDraft || '')}" maxlength="300">${btn({ label: 'Save', kind: 'primary', small: true, action: 'note.add' })}</div>
      </div>
      <div class="more-sec"><div class="title sm">Settings</div><div id="more-settings">${settings()}</div></div>
      <p class="muted xs center">Game ${esc(code)} · ${esc(pName(ctx.state, me))}</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }],
    onOpen: (el, close) => {
      const refresh = () => { const box = el.querySelector('#more-settings'); if (box) box.innerHTML = settings(); };
      const saveNote = async () => {
        const input = el.querySelector('[data-draft]');
        const text = ((input && input.value) || '').trim();
        if (!text) { toast('Note is empty', 'warn'); return; }
        const r = await cur().dispatch({ type: 'note.add', player: me, text });
        if (r) { ui.noteDraft = ''; if (input) input.value = ''; toast('Note saved', 'ok', 1500); }
      };
      el.addEventListener('input', e => { if (e.target.matches('[data-draft]')) ui.noteDraft = e.target.value; });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-draft]')) { e.preventDefault(); saveNote().catch(err => toast(err.message, 'bad')); } });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-change="opt.auto"]')) cur().dispatch({ type: 'opts.set', key: 'autoScore', value: !!t.checked }).then(refresh).catch(err => toast(err.message, 'bad'));
      });
      el.addEventListener('click', e => {
        const a = e.target.closest('[data-action]');
        if (!a) return;
        const act = a.dataset.action;
        if (act === 'nav') { e.preventDefault(); if (typeof close === 'function') close(); cur().nav(a.dataset.href); return; }
        if (act === 'note.add') { e.preventDefault(); saveNote().catch(err => toast(err.message, 'bad')); return; }
        if (act === 'opt.set') { e.preventDefault(); cur().dispatch({ type: 'opts.set', key: a.dataset.key, value: a.dataset.value }).then(refresh).catch(err => toast(err.message, 'bad')); }
      });
    }
  });
}

/** Full verbatim text of a leader ability that buffs the led unit. */
export function openBuffSheet(ctx, ui, leaderId, index) {
  const c = ui.ctx || ctx;
  const { leader, buffs } = buffsOfId(c, leaderId);
  const b = buffs[index];
  if (!leader || !b) { toast('Ability not found', 'bad'); return; }
  return sheet({
    title: b.name,
    cls: 'p' + c.me,
    body: `<div class="kws">${b.badges.map(k => `<span class="kw${/^\[/.test(k) ? ' ab' : ''}">${esc(k)}</span>`).join('')}</div>
      <div class="orig-block"><div class="orig-label">${b.src === 'enhancement' ? 'Enhancement' : 'Ability'} – original text</div><div class="orig-text">${esc(cleanOrig(b.text))}</div></div>
      <p class="muted small">Source: ${esc(leader.name)} – ${esc(b.name)}</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

/* ───────── Original text of an active effect (army rule / detachment rule / enhancement), verbatim ───────── */
const nk = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function pickRules(rules, names) {
  const ks = names.filter(Boolean).map(nk);
  const hit = rules.filter(r => ks.some(k => nk(r.name) === k || (k && nk(r.name).includes(k)) || (k && k.includes(nk(r.name)) && nk(r.name).length > 3)));
  return hit.length ? hit : rules;
}
const origBlocks = rules => rules.map(r => `<div class="orig-block"><div class="orig-label">${esc(cleanOrig(r.name || 'Original text'))}</div><div class="orig-text">${esc(cleanOrig(r.text || ''))}</div></div>`).join('');
export function openEffectSheet(ctx, ui, p, key) {
  const c = ui.ctx || ctx;
  const pl = c.state.players[p] || {};
  const { faction, detachments } = armyOf(c, p);
  if (!faction) return;
  const o = origData(faction.id);
  const mod = origMod();
  if (!o) ensureOrig(faction.id, c.rerender);
  const it = /^orig:/.test(key) ? null : fxItem(c, p, key);
  const isDet = /^orig:det:/.test(key) || (it && it.det);
  const det = isDet ? (it && it.det) || detachments.find(d => `orig:det:${d.id}` === key) : null;
  let title = it ? it.e.name : det ? det.name : faction.name;
  let body = '';
  if (!o || !mod) body = '<p class="muted small">Loading original text … (reopen in a moment)</p>';
  else if (it && it.e.source === 'enhancement') {
    const e = p === c.me ? enhancementOf(c, it.e.enhancement || it.e.name) : null;
    body = e ? origBlocks([{ name: e.name, text: e.text }]) : '<p class="muted small">Not in the BSData (New Recruit) data.</p>';
  } else if (det) {
    const rules = mod.origDetachmentRule ? mod.origDetachmentRule(o, det.name) : [];
    body = rules.length ? origBlocks(it ? pickRules(rules, [it.e.name, ...((it.e.options || []).map(x => x.name))]) : rules) : '<p class="muted small">Not in the BSData (New Recruit) data.</p>';
  } else {
    const rules = mod.origArmyRules ? mod.origArmyRules(o) : [];
    body = rules.length ? origBlocks(it ? pickRules(rules, [it.e.name]) : rules) : '<p class="muted small">Not in the BSData (New Recruit) data.</p>';
  }
  const src = it ? (it.det ? `${it.det.name} · Detachment rule` : it.e.source === 'enhancement' ? 'Enhancement' : `${faction.name} · Army rule`) : det ? 'Detachment rule' : 'Army rule';
  return sheet({ title, cls: 'p' + p, body: `<p class="muted small">${esc(src)}${p !== c.me ? ` · ${esc(pName(c.state, p))}` : ''}</p>${body}`, actions: [{ label: 'Close', kind: 'ghost' }] });
}
export function openEnhancementSheet(ctx, ui, name) {
  const c = ui.ctx || ctx;
  const e = enhancementOf(c, name);
  if (!e) { toast('Not in the BSData (New Recruit) data', 'warn'); return; }
  return sheet({ title: e.name, cls: 'p' + c.me, body: `${e.cost ? `<p class="muted small">${esc(String(e.cost))} pts</p>` : ''}${origBlocks([{ name: 'Enhancement – original text', text: e.text }])}`, actions: [{ label: 'Close', kind: 'ghost' }] });
}

/** Once-per-phase ability: pick the phase it was used in (this turn); a lit phase = used there, tap again to undo. */
export function openPhaseUseSheet(ctx, e) {
  let st = ctx.state;   // dispatch resolves with the new state
  const body = () => {
    const uses = phaseUsesOf(st, ctx.me, e);
    return `<p class="muted small">${esc(e.source || '')} · once per phase. In which phase of this turn did you use it?</p>
      <div class="phase-pick">${PHASE_CHOICES.map(p => { const u = uses.find(x => x.phase === p.id);
        return `<button type="button" class="score-tog${u ? ' on' : ''}" data-phase="${esc(p.id)}" aria-pressed="${!!u}">${u ? '✓ ' : ''}${esc(p.full)}</button>`; }).join('')}</div>`;
  };
  sheet({
    title: e.name, body: body(), cls: 'phase-use',
    actions: [{ label: 'Done', kind: 'primary' }],
    onOpen: el => el.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-phase]'); if (!b) return;
      const u = phaseUsesOf(st, ctx.me, e).find(x => x.phase === b.dataset.phase);
      const r = u ? await ctx.dispatch({ type: 'ability.undo', player: ctx.me, useId: u.id })
                  : await ctx.dispatch({ type: 'ability.use', player: ctx.me, key: e.key, name: e.name, limit: 'phase', source: e.source, phase: b.dataset.phase });
      if (r) { st = r; el.querySelector('.sheet-body').innerHTML = body(); }
    })
  });
}
