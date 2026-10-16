/* Player phone – sheets: the stratagem popup (rule text + use controls: cost stepper, CP reduction, optional target unit),
 * the "⋯" sheet (settings, note, links) and the leader-buff info sheet. Sheets live outside the view root, so their clicks are handled here. */
import { WH } from '../../data/rules.js';
import { esc, sheet, toast, chip, btn, autoNote } from './components.js';
import {
  stepper, cpBadge, affectedUnits, myUnits, pName, cleanOrig, stratPhaseId, stratIn, phasePill, turnBadge, stratSrc, stratKwList, kwLine,
  stratOrigBlock, stratUseState, stratAddonsOf, resourceFor, resShort, fxItem, armyOf, origData, origMod, ensureOrig, enhancementOf,
  unitGroups, srcBadge, cardName
} from './player-common.js';
import { buffsOfId, abilityByKey, abilityUseOf, entryLabel, phaseUsesOf, PHASE_CHOICES, cpReductions, resolveLeaders, ensureMissionsOrig, missionsOrig, myParts, partsLabel, objLabel, bonusRows } from './player-tabs.js';
import { reduce } from '../../engine/index.js';
export { cpReductions };

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
  // attached units are one unit (leader + bodyguard, like the Army list): one entry, booked on the bodyguard
  const groups = unitGroups(units, resolveLeaders(units)).map(g => Object.assign(g, { hit: g.units.some(u => hits.has(u.id)) }));
  const sorted = groups.slice().sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0));
  const unitOpts = sorted.map(g => `<option value="${esc(g.id)}"${g.shocked ? ' disabled' : ''}>${esc(g.name)} (${g.models})${g.hit ? ' ✓' : ''}${g.shocked ? ' – Battle-shocked' : ''}</option>`).join('');
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
      el.addEventListener('click', e => {
        const k = e.target.closest('[data-action="kw.units"]');
        if (!k) return;
        e.preventDefault(); e.stopPropagation();
        openKwUnitsSheet(ui.ctx || ctx, k.dataset.kwu, !!k.dataset.not);
      });
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
  const use = e.fx ? abilityUseOf(c.state, c.me, { key: e.fxUseKey, limit: e.fxLimit }) : abilityUseOf(c.state, c.me, e);
  return sheet({
    title: e.name,
    cls: 'p' + c.me,
    body: `<div class="row between"><span class="muted small">${esc(e.source)}</span><span class="badge lim">${esc(entryLabel(e))}</span></div>
      <div class="orig-block"><div class="orig-label">Original text</div><div class="orig-text">${esc(cleanOrig(e.text))}</div></div>
      <p class="muted small">${e.fx && e.fxOn ? 'Active now (chosen under Active effects).' : use ? `Used in battle round ${use.round}${e.limit !== 'battle' ? ` (${use.turn === c.me ? 'your' : "opponent's"} turn)` : ''}.` : 'Available.'}${e.fx ? ' Set it in the Army tab under Active effects.' : ''}</p>`,
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
        ${btn({ label: 'Score view (read-only)', kind: 'ghost', small: true, action: 'nav', data: { href: `#/g/${code}/watch` } })}
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

/* ───────── Keyword chip of a stratagem: the player's units with (or excluded by) that keyword ───────── */
export function openKwUnitsSheet(ctx, kw, not) {
  const units = myUnits(ctx.state, ctx.me);
  const m = /^(.+?)(?: \(unless (.+)\))?$/.exec(String(kw || '')) || [];
  const base = (m[1] || String(kw || '')).trim();
  const unless = m[2] ? m[2].split('/').map(x => x.trim()).filter(Boolean) : [];
  const groups = unitGroups(units, resolveLeaders(units));
  const withKw = new Set(affectedUnits(units, [base], ctx).map(u => u.id));
  const unlessSet = new Set(unless.length ? affectedUnits(units, unless, ctx).map(u => u.id) : []);
  let list = groups.filter(g => g.units.some(u => withKw.has(u.id)));
  if (not) list = list.filter(g => !g.units.some(u => unlessSet.has(u.id)));
  const ul = list.length ? `<ul class="kwu-list">${list.map(g => `<li><b>${esc(g.name)}</b> <span class="muted xs">(${esc(g.models)})</span></li>`).join('')}</ul>` : '';
  const body = !units.length ? '<p class="muted small">No army list imported – add it in the Army list tab.</p>'
    : not ? `<p class="small">Units with the keyword <b>${esc(base)}</b>${unless.length ? ` (unless they are ${esc(unless.join(' or '))})` : ''} cannot be selected for this Stratagem.</p>${list.length ? `<div class="label">Your units excluded</div>${ul}` : '<p class="muted small">None of your units is excluded.</p>'}`
    : `<div class="label">Your units with ${esc(base)}</div>${ul || '<p class="muted small">None of your units has this keyword.</p>'}`;
  return sheet({ title: not ? `NOT ${base}` : `[${base}]`, cls: 'p' + ctx.me + ' kwu-sheet', body, actions: [{ label: 'Close', kind: 'ghost' }] });
}

/* ───────── Missions ───────── */
/** Full card text: verbatim original when available, else the condition list of the data. */
export function openMissionInfo(ctx, ui, src, card) {
  const c = ui.ctx || ctx;
  const def = src === 'primary' ? WH.PRIMARY[card] : WH.SECONDARY[card];
  if (!def) return null;
  ensureMissionsOrig();
  const o = missionsOrig(src, card);
  const mode = ((c.state.players[c.me] || {}).secondaries || {}).mode;
  const vpT = v => (v && typeof v === 'object' ? (mode === 'fixed' ? v.F : v.T) : v);
  const conds = (def.c || []).filter(x => !x.mode || (x.mode === 'F') === (mode === 'fixed')).map(x => `<li class="${x.sub ? 'sub' : ''}"><b>${x.k === 'choice' ? esc((x.opts || []).map(q => vpT(q.vp)).join('/')) : esc(vpT(x.vp))} VP${x.k === 'per' ? ' each' : ''}${x.max != null ? ', max. ' + esc(x.max) : ''}</b> · ${esc(x.t)}<span class="muted xs"> · ${esc(WH.TIMING_LABELS[x.w] || x.w)}</span></li>`).join('');
  return sheet({
    title: def.name,
    cls: 'p' + c.me + ' mis-sheet',
    body: `${o ? `<div class="orig-block"><div class="orig-label">Original card text</div><div class="orig-text">${esc(cleanOrig(o))}</div></div>` : ''}
      <div class="label">Scoring</div><ul class="info-conds">${conds}</ul>
      ${def.note ? `<p class="small"><b>Note:</b> <span class="rule-text">${esc(def.note)}</span></p>` : ''}
      ${def.drawn ? `<p class="small text-warn"><b>When drawn:</b> <span class="rule-text">${esc(def.drawn.text)}</span></p>` : ''}`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

/** Discard a Tactical card: at the end of your turn (+1 CP once per turn, in your own turn) or – once per battle, end of your
 *  Command phase – for 1 CP with a new card drawn. */
export function openDiscardSheet(ctx, ui, card) {
  const c = ui.ctx || ctx;
  const { state, me } = c;
  const sec = state.players[me].secondaries || {};
  const name = cardName('secondary', card);
  const own = state.turn === me;
  const cpGain = own && sec.cpDiscardTurn !== `${state.round}:${state.turn}`;
  const canRedraw = !sec.redrawUsed && own && state.phase === 'command' && (state.players[me].cp || 0) >= 1;
  const run = reason => (closeFn) => {
    const before = (sec.hand || []).slice();
    // redraw: the new card is drawn right away (drawNow)
    (ui.ctx || ctx).dispatch(Object.assign({ type: 'sec.discard', player: me, card, reason }, reason === 'redraw' ? { drawNow: true } : {})).then(r => {
      if (!r) return;
      const drew = reason === 'redraw' ? ((r.players[me].secondaries || {}).hand || []).filter(x => !before.includes(x)) : [];
      toast(reason === 'redraw' ? (drew.length ? `${name} discarded · drew ${drew.map(x => cardName('secondary', x)).join(', ')}` : `${name} discarded · no card left to draw`) : `${name} discarded${cpGain ? (state.phase === 'end' ? ' · +1 CP' : ' · +1 CP at the end of your turn') : ''}`, 'ok', 3000);
      closeFn();
    }).catch(err => toast(err && err.message ? err.message : String(err), 'bad'));
    return false;
  };
  const actions = [{ label: 'Cancel', kind: 'ghost' }];
  if (canRedraw) actions.push({ label: 'Discard & redraw (1 CP)', kind: 'ghost', onClick: run('redraw') });
  actions.push({ label: cpGain ? 'Discard · +1 CP' : 'Discard', kind: 'primary', cta: true, onClick: run('end') });
  return sheet({
    title: `Discard “${name}”?`,
    cls: 'p' + me,
    body: `<p class="small">${cpGain ? (state.phase === 'end' ? 'You gain 1 CP now (once per turn).' : 'You gain 1 CP at the end of your turn (once per turn).') : own ? 'No CP – you already discarded a card this turn.' : 'No CP – it is not your turn.'}</p>
      ${canRedraw ? '<p class="small muted">Or, once per battle at the end of your Command phase: spend 1 CP to discard it and draw a new card.</p>' : sec.redrawUsed ? '<p class="muted xs">Discard &amp; redraw already used this battle.</p>' : ''}`,
    actions
  });
}

/** "When drawn" picks on the phone: Beacon – one friendly unit; Burden of Trust – one friendly unit per objective. Stored as
 *  the player effect 'sec:<card>' (effect.set), the same as the tablet's picker. */
export function openPickSheet(ctx, ui, card) {
  const c = ui.ctx || ctx;
  const s = c.state, p = c.me;
  const units = (s.players[p].units || []).filter(u => u.status !== 'destroyed');
  const cur0 = ((s.players[p].effects || {})['sec:' + card] || {}).value;
  const def = WH.SECONDARY[card] || { name: card };
  const done = async value => {
    const cc = ui.ctx || ctx;
    const display = value == null ? null : card === 'beacon' ? (units.find(u => u.id === value) || {}).name : value.map(x => { const [o, u] = x.split(':'); const ob = (s.objectives || []).find(y => y.id === o); return (ob ? objLabel(s, ob) : o) + ': ' + ((units.find(y => y.id === u) || {}).name || u); }).join(', ');
    const r = await cc.dispatch({ type: 'effect.set', player: p, key: 'sec:' + card, value, label: def.name + (card === 'beacon' ? ' – beacon unit' : ' – guards'), display });
    if (r) toast(card === 'beacon' ? 'Beacon unit selected' : 'Guards saved', 'ok', 2000);
  };
  if (card === 'beacon') {
    return sheet({
      title: `${def.name} – select the beacon unit`, cls: 'p' + p,
      body: `<p class="small muted rule-text">${esc(def.drawn ? def.drawn.text : '')}</p><div class="col pick-list">${units.map(u => `<button type="button" class="btn ${cur0 === u.id ? `p${p}` : 'ghost'} cta" data-unit="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>`,
      actions: [{ label: 'Cancel', kind: 'ghost' }],
      onOpen: (el, close) => el.addEventListener('click', e => { const b = e.target.closest('[data-unit]'); if (!b) return; close(); done(b.dataset.unit).catch(err => toast(err && err.message ? err.message : String(err), 'bad')); })
    });
  }
  const have = {};
  for (const x of Array.isArray(cur0) ? cur0 : []) { const [o, u] = String(x).split(':'); have[o] = u; }
  const objs = s.objectives || [];
  return sheet({
    title: `${def.name} – select the guards`, cls: 'p' + p,
    body: `<p class="small muted rule-text">${esc(def.drawn ? def.drawn.text : '')}</p>
      ${objs.map(o => `<label class="field"><span>${esc(objLabel(s, o))}</span><select name="${esc(o.id)}"><option value="">– no guard –</option>${units.map(u => `<option value="${esc(u.id)}"${have[o.id] === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`).join('') || '<p class="muted small">No objective markers (deployment map missing).</p>'}`,
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: (close, el) => {
      const v = objs.map(o => { const sel = el.querySelector(`select[name="${o.id}"]`); return sel && sel.value ? o.id + ':' + sel.value : null; }).filter(Boolean);
      done(v.length ? v : null).catch(err => toast(err && err.message ? err.message : String(err), 'bad'));
    } }]
  });
}

/** Key of player me's open part(s) of the pending scoring (null = nothing for this player to confirm). */
export function pendingKey(s, me) { const ps = myParts(s, me); return ps.length ? ps.map(x => x.key).join('+') : null; }
const SRC_LABEL = { primary: 'Primary', secondary: 'Secondary', bonus: 'Bonus' };

/** The player's own scoring popup (this player's open part(s) of the pending scoring – with the merged end-of-turn sheet
 *  pending.parts, only their own): toggles for achieved conditions, counters for "X VP each", a modifier, the total after
 *  the caps; objective rows pre-filled from the tablet's objective strip. Confirm books score.confirm { player } with the
 *  tablet's undo group (state.pendingGroup: one Undo there takes back the whole End-turn step); achieve: Tactical cards
 *  that scored are discarded. The phone never changes the phase – the score device continues once all parts are confirmed. */
export function openScoreSheet(ctx, ui) {
  const c0 = ui.ctx || ctx;
  const s = c0.state, me = c0.me;
  const parts = myParts(s, me);
  if (!parts.length) { toast('No scoring pending for you', 'warn'); return null; }
  const key = pendingKey(s, me);
  if (ui.scoreSheet && ui.scoreSheet.key === key) return null;
  if (ui.scoreSheet) { ui.scoreSheet.close(); ui.scoreSheet = null; }
  const player = me;
  const sc = ((c0.derived || {}).scoring || [])[player] || null;
  const condOf = it => {
    if (!sc) return null;
    if (it.src === 'primary') return sc.primary && sc.primary.card === it.card ? (sc.primary.conds || []).find(x => x.ci === it.ci) || null : null;
    const sec = (sc.secondaries || []).find(x => x.card === it.card);
    return sec ? (sec.conds || []).find(x => x.ci === it.ci) || null : null;
  };
  // already booked this turn (tapped on the score device) counts as pre-selected – only the difference is booked
  const items = parts.flatMap(part => part.items.map(it => {
    const c = condOf(it);
    const already = c ? Number(c.scoredThisTurn) || 0 : 0;
    const unit = c && c.vp != null ? Number(c.vp) : it.unit != null ? Number(it.unit) : (it.vp != null && it.k !== 'per' ? Number(it.vp) : 0);
    // objective control (the tablet's strip) pre-fills; kills, actions and markers stay at "nothing" until tapped
    const pre = !!it.obj && Number(it.suggest) > 0;
    const vp = pre ? already + Number(it.suggest) : already;
    return Object.assign({}, it, { when: part.when, vp, already, prefill: pre, unit, n: unit > 0 ? Math.round(vp / unit) : 0, opts: c && c.opts ? c.opts : null, max: c && c.max != null ? Number(c.max) : (it.max != null ? Number(it.max) : null) });
  }));
  const maxOf = it => (it.max != null ? Number(it.max) : 15);
  const mod = { vp: 0 };
  const yesNo = (vp, on) => `<button type="button" class="score-tog${on ? ' on' : ''}" data-opt="${esc(vp)}" aria-pressed="${on}">${on ? '✓ Achieved' : 'Not achieved'}</button>`;
  const rowHtml = (it, i) => {
    let ctl, sub = '';
    if (it.opts) {
      ctl = `<div class="score-stages">${it.opts.map(o => { const v = Number(o.vp) || 0;
        return `<div class="score-stage"><span class="score-stage-t"><span class="rule-text">${esc(o.t)}</span> <b class="score-stage-vp">· ${esc(v)} VP</b></span>${yesNo(v, it.vp === v)}</div>`; }).join('')}</div>`;
    } else if (it.k === 'per') {
      sub = `${esc(it.unit)} VP each${it.max != null ? ` · max. ${esc(it.max)} VP` : ''}`;
      ctl = `<div class="score-count"><div class="stepper sm p${player}">
          <button type="button" data-n="-1" ${it.n <= 0 ? 'disabled' : ''} aria-label="Fewer">−</button>
          <span class="stepper-value">${esc(it.n)}</span>
          <button type="button" data-n="1" ${it.vp >= maxOf(it) ? 'disabled' : ''} aria-label="More">+</button>
        </div><span class="score-eq">= <b>${esc(it.vp)} VP</b></span></div>`;
    } else {
      sub = `${esc(it.unit)} VP`;
      ctl = yesNo(it.unit, it.vp > 0);
    }
    return `<div class="score-item" data-i="${i}">
      <div class="score-main">
        <div class="score-card"><span class="badge ${it.src === 'primary' ? 'ok' : 'warn'}">${esc(SRC_LABEL[it.src] || it.src)}</span> <b>${esc(it.name)}</b></div>
        <div class="score-text">${esc(it.text || '')}</div>
        ${(() => { const h = [sub, it.already ? `<span class="text-ok">${esc(it.already)} VP already booked</span>` : '', it.prefill ? '<span class="text-warn">pre-filled from the objective strip – check</span>' : ''].filter(Boolean);
          return h.length ? `<div class="score-sub muted xs">${h.join(' · ')}</div>` : ''; })()}
      </div>
      <div class="score-ctl2">${ctl}</div>
    </div>`;
  };
  const plan = () => {
    const delta = items.map(it => Object.assign({}, it, { vp: it.vp - (it.already || 0) }));
    return { dec: delta.filter(it => it.vp < 0), add: delta.filter(it => it.vp > 0).concat(mod.vp ? [{ src: 'bonus', card: 'modifier', ci: null, vp: mod.vp }] : []) };
  };
  const unbookIds = (st, list) => {
    const ids = [];
    for (const it of list) {
      let need = -it.vp;
      const entries = (st.scores || []).filter(x => x.player === player && x.src === it.src && x.card === it.card && x.ci === it.ci && x.round === st.round && x.turn === st.turn).reverse();
      for (const e of entries) { if (need <= 0) break; ids.push(e.id); need -= e.vp; }
    }
    return ids;
  };
  const sum = st => (st.scores || []).filter(x => x.player === player).reduce((a, x) => a + (Number(x.vp) || 0), 0);
  // only this player's part (score.confirm { player }); group = the tablet step waiting for this scoring
  const withGroup = (a, st) => (st && typeof st.pendingGroup === 'string' && st.pendingGroup ? Object.assign(a, { group: st.pendingGroup }) : a);
  const confirmAction = (add, st) => withGroup({ type: 'score.confirm', player, items: add.map(it => ({ src: it.src, card: it.card, ci: it.ci, vp: it.vp })), achieve: true }, st);
  // VP actually booked after the caps: the same steps on a copy of the state (null = cannot tell)
  const cappedVp = () => {
    try {
      const st0 = (ui.ctx || ctx).state;
      if (!st0 || !st0.pending || pendingKey(st0, player) !== key) return null;
      const { dec, add } = plan();
      let st = st0;
      for (const id of unbookIds(st0, dec)) st = reduce(st, { type: 'score.remove', scoreId: id });
      st = reduce(st, confirmAction(add, null));
      return items.reduce((a, i) => a + (i.already || 0), 0) + sum(st) - sum(st0);
    } catch { return null; }
  };
  const totalVp = () => items.reduce((a, i) => a + i.vp, 0) + mod.vp;
  const label = partsLabel(s, player, parts);
  const bodyHtml = () => `<p class="muted small">${esc(label)} · Round ${esc(s.round)}</p>
      <div class="score-list">${items.map(rowHtml).join('') || '<p class="muted small">Nothing to score right now.</p>'}</div>
      <div class="score-item score-mod">
        <div class="score-main"><div class="score-card"><b>Modifier</b></div><div class="score-text muted small">Manual correction for anything the list above cannot express (booked as a separate entry).</div></div>
        <div class="score-ctl"><div class="stepper sm p${player}">
          <button type="button" data-mod="-1" ${mod.vp <= -15 ? 'disabled' : ''} aria-label="Less">−</button>
          <span class="stepper-value">${mod.vp > 0 ? '+' : ''}${esc(mod.vp)}</span>
          <button type="button" data-mod="1" ${mod.vp >= 15 ? 'disabled' : ''} aria-label="More">+</button>
        </div></div>
      </div>`;
  const totalHtml = () => {
    const raw = totalVp(), capped = cappedVp();
    const shown = capped == null ? raw : capped;
    return `<span>Total</span><span class="score-total-v">${capped != null && capped !== raw ? `<small class="muted score-uncapped">(${raw} VP before the caps)</small> ` : ''}<b>${shown} VP</b></span>`;
  };
  const close = sheet({
    title: 'Your scoring · ' + label,
    cls: 'tbl-score pl-score p' + player,
    body: bodyHtml(),
    actions: [{ label: 'Confirm scoring', kind: 'primary', cta: true, onClick: (closeFn) => {
      (async () => {
        const c = ui.ctx || ctx;
        if (!c.state.pending || pendingKey(c.state, player) !== key) { toast('This scoring was already confirmed', 'warn'); closeFn(); return; }
        const { dec, add } = plan();
        const shown = cappedVp();   // before unbooking (the preview runs the same steps on the current state)
        for (const id of unbookIds(c.state, dec)) await c.dispatch(withGroup({ type: 'score.remove', scoreId: id }, c.state));
        const c2 = ui.ctx || c;
        const r = await c2.dispatch(confirmAction(add, c2.state));
        if (!r) return;
        toast(`Scoring confirmed${shown != null ? `: ${shown} VP` : ''}`, 'ok');
        closeFn();
      })().catch(err => toast(err && err.message ? err.message : String(err), 'bad'));
      return false;
    } }],
    onOpen: el => {
      const foot = el.querySelector('.sheet-foot');
      const tot = document.createElement('div'); tot.className = 'score-total foot-total'; tot.innerHTML = totalHtml();
      if (foot) foot.parentNode.insertBefore(tot, foot);
      el.addEventListener('click', e => {
        const m = e.target.closest('[data-mod]');
        if (m) { mod.vp = Math.max(-15, Math.min(15, mod.vp + Number(m.dataset.mod))); el.querySelector('.sheet-body').innerHTML = bodyHtml(); tot.innerHTML = totalHtml(); return; }
        const n = e.target.closest('[data-n]');
        const o = e.target.closest('[data-opt]');
        if (!n && !o) return;
        const row = e.target.closest('.score-item');
        const it = row ? items[Number(row.dataset.i)] : null;
        if (!it) return;
        if (n) { it.n = Math.max(0, it.n + Number(n.dataset.n)); it.vp = Math.min(maxOf(it), it.n * it.unit); if (Number(n.dataset.n) > 0 && it.vp >= maxOf(it)) it.n = Math.ceil(it.vp / it.unit); }
        else { const v = Number(o.dataset.opt) || 0; it.vp = it.vp === v ? 0 : v; }
        it.prefill = false;
        el.querySelector('.sheet-body').innerHTML = bodyHtml();
        tot.innerHTML = totalHtml();
      });
    },
    onClose: () => { if (ui.scoreSheet && ui.scoreSheet.key === key) { ui.scoreSheet = null; ui.scoreDismissed = key; } }
  });
  ui.scoreSheet = { key, close };
  return close;
}

/** Read-only score breakdown ("0:0 VP" in the head): totals by source and VP per battle round for both players. */
export function openScoreView(ctx, ui) {
  const c = ui.ctx || ctx;
  const { state, derived, me } = c;
  const vp = (derived && derived.vp) || [{ total: 0, primary: 0, secondary: 0, bonus: 0 }, { total: 0, primary: 0, secondary: 0, bonus: 0 }];
  const scores = state.scores || [];
  const sumOf = list => list.reduce((a, x) => a + (Number(x.vp) || 0), 0);
  const per = (p, r) => sumOf(scores.filter(x => x.player === p && x.round === r && x.when !== 'end'));
  const rounds = [1, 2, 3, 4, 5].filter(r => r <= Math.max(1, state.round || 1));
  const endRow = scores.some(x => x.when === 'end') ? `<tr><td>End of battle</td><td>${sumOf(scores.filter(x => x.player === 0 && x.when === 'end'))}</td><td>${sumOf(scores.filter(x => x.player === 1 && x.when === 'end'))}</td></tr>` : '';
  const caps = (((derived && derived.scoring) || [])[me] || {}).caps;
  const head = `<thead><tr><th></th><th class="text-p0">${esc(pName(state, 0))}</th><th class="text-p1">${esc(pName(state, 1))}</th></tr></thead>`;
  const mine = scores.filter(x => x.player === me).slice().reverse().slice(0, 12);
  return sheet({
    title: 'Score',
    cls: 'p' + me + ' score-view',
    body: `<table class="vp-table">${head}<tbody>
        <tr><td>Primary</td><td>${vp[0].primary}</td><td>${vp[1].primary}</td></tr>
        <tr><td>Secondary</td><td>${vp[0].secondary}</td><td>${vp[1].secondary}</td></tr>
        ${bonusRows(state, vp)}
        <tr class="total"><td>Total</td><td>${vp[0].total}</td><td>${vp[1].total}</td></tr></tbody></table>
      <div class="label">By battle round</div>
      <table class="vp-table">${head}<tbody>${rounds.map(r => `<tr><td>Round ${r}</td><td>${per(0, r)}</td><td>${per(1, r)}</td></tr>`).join('')}${endRow}</tbody></table>
      ${caps && state.stage === 'battle' ? `<p class="muted xs">You can still score this round: Primary ${esc(caps.left.primaryRound)} VP · Secondary ${esc(caps.left.secRound)} VP (battle: ${esc(caps.left.primaryBattle)} / ${esc(caps.left.secBattle)} VP left).</p>` : ''}
      ${mine.length ? `<div class="label">Your latest entries</div><ul class="score-log">${mine.map(x => `<li><span class="muted xs">R${esc(x.round)}</span> ${srcBadge(x.src)} ${esc(cardName(x.src, x.card))} <b>${x.vp > 0 ? '+' : ''}${esc(x.vp)} VP</b></li>`).join('')}</ul>` : ''}`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}
