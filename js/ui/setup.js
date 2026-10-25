/* Setup-Assistent (SPEC §7): Spieler · Armee · Armeeliste · Mission · Tisch · Sekundär · Prüfen & Start.
 * Route #/g/CODE/setup[/0|/1] – ctx.me = 0/1 (eigenes Handy) oder null (Desktop/Lobby: beide Spieler).
 * Lokaler UI-Zustand (Schritt, Suche, Fixed-Auswahl) liegt je Spielcode in UI, damit State-Pushes ihn nicht verlieren.
 * Events: einmalige Delegation auf root (root.__setupBound), Aktionen über data-action / data-field. */
import { esc, btn, chip, badge, confirmSheet, toast, colorOf, playerLabel } from './components.js';
import { prepareQr, qrReady, joinUrl } from './qr.js';
import { randomLayoutAction } from './random-layout.js';
import { sequenceStrip } from './sequence.js';
import { armyStep, unitsStep, missionStep, tableStep, tableSet, mountTablePreview, tableLabel, secStep, facListHtml, openUnitSheet, openImportSheet, importSavedArmy, dpLimit, dpOf, SIZE_LABEL } from './setup-steps.js';

const STEPS = [
  { id: 'players', label: 'Players' },
  { id: 'army', label: 'Army' },
  { id: 'units', label: 'Army list' },
  { id: 'mission', label: 'Mission' },
  { id: 'table', label: 'Table' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'check', label: 'Review & start' }
];
const STAGE_LABEL = { setup: 'Setup', deploy: 'Deployment', battle: 'Battle', over: 'Finished' };
const DEBOUNCE_MS = 600;

const UI = {};
function uiFor(code) {
  return UI[code] || (UI[code] = { step: 0, tab: 0, search: ['', ''], secMode: [null, null], fixedSel: [[], []], facOpen: [false, false], pending: false, timers: {} });
}
let cur = null; // { root, ctx, ui }

/* ═══════════════ Einstieg ═══════════════ */
export function render(root, ctx) {
  const ui = uiFor(ctx.code);
  if (typeof ctx.me === 'number' && ui.tab !== ctx.me) ui.tab = ctx.me;
  cur = { root, ctx, ui };
  bind(root);
  applyColors(ctx.state);
  const ae = document.activeElement;
  if (root.contains(ae) && isTyping(ae)) { ui.pending = true; return; }   // nicht unter den Fingern wegrendern
  ui.pending = false;
  paint();
}

/* ───────── Steps in the history: the phone's back button / back gesture goes to the previous step ─────────
 * A step further on puts one history entry on (same URL, state { brSetup, step }); "back" pops it and shows the step
 * below. Popups put their own entries on top (components.js sheet) – their back steps land on the current step again. */
function markStep(code, step) {
  const h = history.state;
  if (h && h.brSheet) return;                                     // a popup's entry is on top
  if (h && h.brSetup === code && h.step === step) return;
  try { history.replaceState({ brSetup: code, step }, ''); } catch { /* no history */ }
}
function goStep(n) {
  const { ctx, ui } = cur;
  const to = Math.max(0, Math.min(STEPS.length - 1, n));
  if (to === ui.step) return;
  // forward: a new entry; backward with the in-app buttons: the current entry shows the lower step (the entry below may
  // not be this setup's – e.g. after coming back from another screen – so the app never steps back in the history itself)
  if (to > ui.step) { try { history.pushState({ brSetup: ctx.code, step: to }, ''); } catch { /* no history */ } }
  else markStep(ctx.code, to);
  ui.step = to;
  window.scrollTo({ top: 0 });
  paint();
}
window.addEventListener('popstate', () => {
  if (!cur || document.body.dataset.view !== 'setup') return;
  const h = history.state;
  if (!h || h.brSheet || h.brSetup !== cur.ctx.code || h.step === cur.ui.step) return;
  cur.ui.step = h.step;
  window.scrollTo({ top: 0 });
  paint();
});

function isTyping(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'submit'].includes(el.type);
}

function applyColors(state) {
  const app = document.documentElement; // on :root so popups (appended outside #app) get the player colours too
  if (!app || !state || !state.players) return;
  app.style.setProperty('--p0', colorOf(state.players[0].color));
  app.style.setProperty('--p1', colorOf(state.players[1].color));
}

function paint() {
  const { root, ctx, ui } = cur;
  const s = ctx.state;
  if (!s) return;
  // Der Wurzelknoten wird von allen Modulen geteilt: nie nachträglich in eine andere Ansicht hineinrendern
  if (document.body.dataset.view !== 'setup' || !root.isConnected) { ui.pending = false; return; }
  if (s.stage !== 'setup') { root.innerHTML = summary(ctx); return; }
  ui.step = Math.max(0, Math.min(STEPS.length - 1, ui.step));
  markStep(ctx.code, ui.step);
  root.innerHTML = `
    <div class="setup wrap">
      ${header(ctx, ui)}
      ${sequenceStrip(ctx, !!ui.seqOpen)}
      <section class="step-body" data-step="${STEPS[ui.step].id}">
        <h2 class="title step-title"><span class="step-no">${ui.step + 1}</span>${esc(STEPS[ui.step].label)}</h2>
        ${stepHtml(ctx, ui)}
      </section>
      <div class="step-nav sticky-bottom">
        ${btn({ label: '‹ Back', kind: 'ghost', action: 'prev', disabled: ui.step === 0 })}
        <span class="spacer"></span>
        ${ui.step < STEPS.length - 1 ? btn({ label: `Next: ${STEPS[ui.step + 1].label} ›`, kind: 'primary', action: 'next', disabled: STEPS[ui.step].id === 'table' && tableState(s) !== 'ok', title: STEPS[ui.step].id === 'table' && tableState(s) !== 'ok' ? 'Choose a layout to continue – the setup goes on once the table is set.' : '' }) : ''}
      </div>
    </div>`;
  if (STEPS[ui.step].id === 'table') mountTablePreview(root, ctx);   // the live 2D table (SVG) into its box
}

/* ═══════════════ Kopf: Schritte / Fortschritt ═══════════════ */
function header(ctx, ui) {
  const me = typeof ctx.me === 'number' ? ctx.me : null;
  return `
    <header class="setup-head">
      <div class="row between nowrap">
        <div class="min0">
          <div class="xs muted">Setup · Game <b>${esc(ctx.code)}</b>${me != null ? ` · <span class="text-p${me}">${esc(playerLabel(ctx.state, me))}</span>` : ''}</div>
          <h1 class="title">Prepare the battle</h1>
        </div>
        <div class="row nowrap">
          ${btn({ label: 'Undo', kind: 'ghost', small: true, action: 'undo' })}
          <a class="btn ghost sm" href="#/">Lobby</a>
        </div>
      </div>
      <nav class="steps scroll-x" aria-label="Steps">${STEPS.map((st, i) => {
        const d = stepDone(ctx, ui, i);
        return `<button type="button" class="step-chip ${i === ui.step ? 'cur' : ''} ${d}" data-action="step" data-i="${i}" aria-current="${i === ui.step ? 'step' : 'false'}">
          <span class="step-dot">${d === 'ok' ? '✓' : i + 1}</span><span class="step-label">${esc(st.label)}</span></button>`;
      }).join('')}</nav>
      ${waitBanner(ctx, ui)}
    </header>`;
}

/** "X is waiting for you": one player is ready, the other (this phone's player) is not yet. */
function waitBanner(ctx, ui) {
  const s = ctx.state, me = typeof ctx.me === 'number' ? ctx.me : null;
  const ready = [0, 1].filter(p => s.players[p].ready);
  if (ready.length !== 1) return '';
  const r = ready[0], o = 1 - r;
  if (me === r) return `<div class="ready-banner p${r}"><span>✓ You are ready – waiting for <b class="text-p${o}">${esc(playerLabel(s, o))}</b></span></div>`;
  const toCheck = ui.step !== STEPS.length - 1 ? btn({ label: 'Review & start', kind: `p${o}`, small: true, action: 'step', data: { i: STEPS.length - 1 } }) : '';
  return `<div class="ready-banner p${o}"><span><b class="text-p${r}">${esc(playerLabel(s, r))}</b> is ready and waiting for ${me === o ? 'you' : `<b class="text-p${o}">${esc(playerLabel(s, o))}</b>`}</span>${toCheck}</div>`;
}

/** 'ok' | 'warn' | '' je Schritt (für die Chips und die Checkliste). */
function stepDone(ctx, ui, i) {
  const s = ctx.state;
  const ps = typeof ctx.me === 'number' ? [ctx.me] : [0, 1];
  const all = f => ps.every(f), any = f => ps.some(f);
  switch (STEPS[i].id) {
    case 'players': return all(p => !!s.players[p].name) ? 'ok' : 'warn';
    case 'army': { const f = p => !!s.players[p].faction && s.players[p].detachments.length > 0; return all(f) ? 'ok' : any(f) ? 'warn' : ''; }
    case 'units': return all(p => s.players[p].units.length > 0) ? 'ok' : 'warn';   // not required to start, but it powers the phone
    case 'mission': return missionState(s);
    case 'table': return tableState(s);
    case 'secondary': return all(p => secOk(ctx, ui, p)) ? 'ok' : 'warn';
    case 'check': return all(p => s.players[p].ready) ? 'ok' : any(p => s.players[p].ready) ? 'warn' : '';
  }
  return '';
}
function missionState(s) {
  const m = s.mission;
  const parts = [m.dispositions.every(Boolean), m.attacker === 0 || m.attacker === 1, m.primary.every(Boolean)];
  return parts.every(Boolean) ? 'ok' : parts.some(Boolean) ? 'warn' : '';
}
/** The table is set once an Event Companion layout is chosen (it brings zones, objectives, terrain and its Deployment
 *  card); on the casual half table once a layout's zones are. The setup only goes on from the Table step then. */
function tableState(s) {
  return tableSet(s) ? 'ok' : s.mission.dispositions.every(Boolean) ? 'warn' : '';
}
function secOk(ctx, ui, p) {
  const sec = ctx.state.players[p].secondaries;
  if (ui.secMode[p] && ui.secMode[p] !== sec.mode) return false;
  return sec.mode === 'tactical' || (sec.mode === 'fixed' && (sec.fixed || []).length === 2);
}

/* ═══════════════ Schritt-Inhalte ═══════════════ */
function stepHtml(ctx, ui) {
  switch (STEPS[ui.step].id) {
    case 'players': return optionsCard(ctx) + cols(ctx, ui, p => playerCard(ctx, p));
    case 'army': return cols(ctx, ui, p => armyStep(ctx, ui, p));
    case 'units': return cols(ctx, ui, p => unitsStep(ctx, ui, p));
    case 'mission': return missionStep(ctx, ui);
    case 'table': return tableStep(ctx, ui);
    case 'secondary': return cols(ctx, ui, p => secStep(ctx, ui, p));
    case 'check': return checkStep(ctx, ui);
  }
  return '';
}

/** Zwei Spielerspalten (Desktop nebeneinander, Handy als Tabs) bzw. nur die eigene. */
function cols(ctx, ui, fn) {
  const s = ctx.state;
  const ps = typeof ctx.me === 'number' ? [ctx.me] : [0, 1];
  const tabs = ps.length === 2 ? `<div class="setup-tabs">${ps.map(p => chip({ label: playerLabel(s, p), cls: `p${p}`, on: ui.tab === p, action: 'tab', data: { p } })).join('')}</div>` : '';
  return tabs + `<div class="setup-cols tab${ui.tab} ${ps.length === 1 ? 'single' : ''}">${ps.map(p => `
    <div class="pcol p${p}" data-p="${p}">
      <div class="pcol-head"><span class="dot"></span>${esc(playerLabel(s, p))}${s.players[p].ready ? badge('ready', 'ok') : ''}</div>
      ${fn(p)}
    </div>`).join('')}</div>`;
}

/* ───────── Schritt 1: Spieler + Optionen ───────── */
function playerCard(ctx, p) {
  const s = ctx.state, pl = s.players[p], other = s.players[1 - p];
  return `
    <label class="field"><span>Name</span><input type="text" data-field="name" data-p="${p}" value="${esc(pl.name)}" maxlength="40" placeholder="Player ${p + 1}" autocomplete="off"></label>
    <div class="label">Colour</div>
    <div class="swatches">${ctx.data.WH.COLORS.map((c, i) => {
      const taken = other.color === i;
      return `<button type="button" class="swatch ${pl.color === i ? 'on' : ''}" style="--sw:${esc(c.d)};--swl:${esc(c.l)}" data-action="color" data-p="${p}" data-c="${i}" title="${esc(c.name)}${taken ? ' (taken by opponent)' : ''}" aria-label="${esc(c.name)}" ${taken ? 'disabled' : ''}><span class="sw-l"></span><span class="sw-d"></span></button>`;
    }).join('')}</div>
    <div class="muted xs">${esc(ctx.data.WH.COLORS[pl.color] ? ctx.data.WH.COLORS[pl.color].name : '')} – light/dark depending on the theme</div>`;
}

function optionsCard(ctx) {
  const o = ctx.state.opts, WH = ctx.data.WH;
  // 11th edition: both battle sizes are played on the 44"×60" battlefield with the same Deployment cards and layouts (Chapter
  // Approved 2026-27 / Event Companion name no Incursion maps)
  const sizeNote = { strike: 'Strike Force · 2000 points · 3 Detachment Points · battlefield 44"×60"', incursion: 'Incursion · 1000 points · 2 Detachment Points · same 44"×60" battlefield, Deployment cards and layouts as Strike Force' };
  const dp = dpLimit(ctx.state), dpAuto = o.dp == null;
  return `
    <div class="card opts-card">
      <div class="card-head"><div class="title">Game options</div></div>
      <div class="grid opts-grid">
        <label class="field"><span>Game size</span>
          <select data-field="size">${Object.keys(SIZE_LABEL).map(k => `<option value="${k}" ${o.size === k ? 'selected' : ''}>${esc(SIZE_LABEL[k])}</option>`).join('')}</select>
          <span class="xs muted">${esc(sizeNote[o.size] || '')}</span>
        </label>
        <label class="field"><span>Points limit</span><input type="number" data-field="points" value="${esc(o.points)}" min="100" step="50" inputmode="numeric"></label>
      </div>
      <div class="label mt">Battlefield</div>
      <div class="chips">${chip({ label: '44"×60" (official)', on: (o.board || 'full') === 'full', action: 'opt', data: { key: 'board', value: 'full' } })}${chip({ label: '44"×30" half table (unofficial)', on: o.board === 'half', action: 'opt', data: { key: 'board', value: 'half' } })}</div>
      ${o.board === 'half' ? `<p class="xs muted">${esc('Half table: two games on one 44"×60" table. Unofficial – the 11th edition has no half-size format: the Deployment card is scaled to half length and the terrain comes from the random generator (half the Armageddon set).')}</p>` : ''}
      <div class="label mt">Detachment Points</div>
      <div class="row dp-row">
        <div class="stepper"><button type="button" data-action="dp-step" data-delta="-1"${dp <= 0 ? ' disabled' : ''} aria-label="Fewer">−</button><span class="stepper-value">${dp}</span><button type="button" data-action="dp-step" data-delta="1"${dp >= 9 ? ' disabled' : ''} aria-label="More">+</button></div>
        ${chip({ label: 'By game size', on: dpAuto, action: 'dp-auto', cls: 'sm' })}
      </div>
      <p class="xs muted">${dpAuto ? 'Incursion 2 DP, Strike Force 3 DP – set by hand for other agreements.' : 'Set by hand – “By game size” goes back to Incursion 2 / Strike Force 3.'} Detachments are bought with these points.</p>
      <div class="label mt">Stratagem lock</div>
      <div class="chips">${['phase', 'round'].map(k => chip({ label: k === 'phase' ? 'Per phase (rule)' : 'Per round (house rule)', on: o.stratLock === k, action: 'opt', data: { key: 'stratLock', value: k } })).join('')}</div>
      <p class="xs muted lock-text">${esc(WH.STRAT_LOCK[o.stratLock] || '')}</p>
    </div>`;
}

/* ───────── Schritt 6: Prüfen & Start ───────── */
function checkStep(ctx, ui) {
  const s = ctx.state, m = s.mission, WH = ctx.data.WH;
  const ps = typeof ctx.me === 'number' ? [ctx.me] : [0, 1];
  const items = [];
  for (const p of [0, 1]) {
    const pl = s.players[p], fac = pl.faction ? ctx.data.FACTIONS.find(f => f.id === pl.faction) : null;
    const name = playerLabel(s, p);
    items.push([!!pl.name, `${name}: Name`, pl.name]);
    items.push([!!fac && pl.detachments.length > 0, `${name}: Army`, fac ? `${fac.name} – ${pl.detachments.map(id => (fac.detachments.find(d => d.id === id) || { name: id }).name).join(', ')} (${dpOf(fac, pl.detachments)}/${dpLimit(s, fac, pl.detachments)} DP)` : 'no faction chosen']);
    const pts = pl.units.reduce((a, u) => a + (Number(u.points) || 0), 0);
    items.push([true, `${name}: Army list`, pl.units.length ? `${pl.units.length} units · ${pts}/${s.opts.points} points` : 'no list yet – the phone then has no datasheets, Stratagem targets or automatic army rules']);
    const sec = pl.secondaries;
    items.push([secOk(ctx, ui, p), `${name}: Secondary`, sec.mode === 'fixed' ? `Fixed – ${(sec.fixed || []).map(id => (WH.SECONDARY[id] || { name: id }).name).join(', ') || 'no cards yet'}` : 'Tactical (deck will be shuffled)']);
  }
  items.push([missionState(s) === 'ok', 'Mission', missionState(s) === 'ok'
    ? `${m.attacker != null ? playerLabel(s, m.attacker) + ' is the Attacker' : 'Attacker missing'} · Primary: ${m.primary.map(id => id ? (WH.PRIMARY[id] || {}).name : '–').join(' / ')}${m.twist ? ' · Twist: ' + ((WH.TWISTS.find(t => t.id === m.twist) || {}).name || m.twist) : ''}`
    : 'Dispositions or Attacker missing']);
  items.push([tableState(s) === 'ok', 'Table', tableState(s) === 'ok' ? tableLabel(ctx) : 'Table not set – choose a layout in the Table step']);
  items.push([s.players.every(p => p.ready), 'Both players ready', s.players.map(p => `${p.name}: ${p.ready ? 'ready' : 'not ready'}`).join(' · ')]);
  const allOk = items.every(i => i[0]);
  return `
    <div class="card checklist-card">
      <ul class="checklist">${items.map(([ok, t, sub]) => `<li class="${ok ? 'ok' : 'warn'}"><span class="ck">${ok ? '✓' : '!'}</span><div><div class="ck-t">${esc(t)}</div><div class="xs muted">${esc(sub)}</div></div></li>`).join('')}</ul>
    </div>
    <div class="ready-row">${ps.map(p => {
      const r = s.players[p].ready;
      // an action, not a status: "I'm ready" – once tapped it shows the state and how to take it back
      const lbl = ps.length > 1 ? `<span class="ready-lbl">${esc(playerLabel(s, p))}</span>` : '';
      return btn({ html: `${lbl}<span class="ready-state">${r ? '✓ Ready' : 'I’m ready'}</span>${r ? '<span class="ready-sub">tap to take it back</span>' : ''}`, kind: r ? 'ok' : `p${p}`, cta: true, cls: `ready-btn ${r ? 'is-ready' : ''}`, action: 'ready', data: { p, on: r ? 0 : 1 } });
    }).join('')}</div>
    <div class="mt">
      ${btn({ label: 'Go to deployment', kind: 'primary', cta: true, action: 'deploy', cls: allOk ? '' : 'not-yet' })}
      ${allOk ? '' : `<p class="xs muted center mt">See the checklist for what is missing – starting will tell you what is still open.</p>`}
    </div>`;
}

/* ═══════════════ Zusammenfassung (stage ≠ setup) ═══════════════ */
function summary(ctx) {
  const s = ctx.state, m = s.mission, WH = ctx.data.WH, code = ctx.code;
  // opened via localhost: the LAN address (as the QR codes use it), so other devices can open the links
  if (!qrReady()) prepareQr().then(ch => { if (ch && ctx.rerender) ctx.rerender(); }).catch(() => {});
  const host = joinUrl(code, 0).replace(/^https?:\/\//, '').replace(/\/index\.html#.*$/, '');
  const facName = p => { const f = ctx.data.FACTIONS.find(x => x.id === s.players[p].faction); return f ? f.name : 'no faction'; };
  return `
    <div class="setup wrap summary">
      <header class="setup-head">
        <div class="xs muted">Game <b>${esc(code)}</b> · ${esc(STAGE_LABEL[s.stage] || s.stage)}</div>
        <h1 class="title">${s.stage === 'deploy' ? 'Deployment in progress' : s.stage === 'battle' ? `Battle · Round ${s.round}` : 'Battle over'}</h1>
      </header>
      <div class="setup-cols always">${[0, 1].map(p => `
        <div class="card p${p}">
          <div class="card-head"><div class="title">${esc(playerLabel(s, p))}</div>${badge(`${s.players[p].units.length} unit${s.players[p].units.length === 1 ? '' : 's'}`)}</div>
          <div class="small">${esc(facName(p))}</div>
          <div class="xs muted">${esc(s.players[p].detachments.map(id => { const f = ctx.data.FACTIONS.find(x => x.id === s.players[p].faction); return ((f && (f.detachments || []).find(d => d.id === id)) || { name: id }).name; }).join(', ') || '–')}</div>
          <div class="xs muted">Secondary: ${s.players[p].secondaries.mode === 'fixed' ? 'Fixed – ' + esc((s.players[p].secondaries.fixed || []).map(id => (WH.SECONDARY[id] || { name: id }).name).join(', ')) : 'Tactical'}</div>
        </div>`).join('')}</div>
      <div class="card mt">
        <div class="card-head"><div class="title">Mission</div></div>
        <div class="small">${esc(m.deployment || '–')} · Attacker: ${m.attacker != null ? esc(playerLabel(s, m.attacker)) : '–'}</div>
        <div class="xs muted">Primary: ${m.primary.map(id => esc(id ? (WH.PRIMARY[id] || {}).name : '–')).join(' / ')}${m.twist ? ' · Twist ' + esc((WH.TWISTS.find(t => t.id === m.twist) || {}).name || m.twist) : ''}</div>
      </div>
      <div class="card mt">
        <div class="card-head"><div class="title">Continue on the devices</div></div>
        <p class="small muted">Tablet in the middle of the table (Score): <code>http://${esc(host)}/#/g/${esc(code)}/table</code> · one phone per player (rules): <code>…/p/0</code> or <code>…/p/1</code>.</p>
        <div class="role-grid">
          ${btn({ label: 'Score (tablet)', kind: 'primary', cta: true, action: 'go', data: { hash: ctx.roleHash(code, 'desktop', 'table') } })}
          ${btn({ label: `${playerLabel(s, 0)} (phone)`, kind: 'p0', cta: true, action: 'go', data: { hash: ctx.roleHash(code, 0, 'player') } })}
          ${btn({ label: `${playerLabel(s, 1)} (phone)`, kind: 'p1', cta: true, action: 'go', data: { hash: ctx.roleHash(code, 1, 'player') } })}
        </div>
      </div>
      <div class="row mt">
        ${btn({ label: 'Back to setup', kind: 'danger', action: 'reset' })}
        ${btn({ label: 'Undo', kind: 'ghost', action: 'undo' })}
      </div>
    </div>`;
}

/* ═══════════════ Events ═══════════════ */
function bind(root) {
  if (root.__setupBound) return;
  root.__setupBound = true;
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="checkbox"],[role="radio"],.chip[data-action]')) { e.preventDefault(); onClick(e); }
  });
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  // "choose faction by hand" stays open across re-renders
  root.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.facDetails != null && cur) cur.ui.facOpen[Number(d.dataset.facDetails)] = d.open; }, true);
  root.addEventListener('focusout', () => { const ui = cur && cur.ui; if (ui && ui.pending) setTimeout(() => { if (ui.pending && cur && !(cur.root.contains(document.activeElement) && isTyping(document.activeElement))) { ui.pending = false; paint(); } }, 0); });
}

function debounce(key, fn) {
  const t = cur.ui.timers;
  clearTimeout(t[key]);
  t[key] = setTimeout(fn, DEBOUNCE_MS);
}

function onInput(e) {
  const el = e.target, f = el.dataset.field;
  if (!f) return;
  const { ctx, ui, root } = cur;
  const p = Number(el.dataset.p);
  if (f === 'name') debounce('name' + p, () => { const v = el.value.trim(); if (v && v !== ctx.state.players[p].name) ctx.dispatch({ type: 'player.set', player: p, name: v }); });
  else if (f === 'points') debounce('points', () => { const v = Number(el.value); if (v > 0 && v !== ctx.state.opts.points) ctx.dispatch({ type: 'opts.set', key: 'points', value: v }); });
  else if (f === 'search') { ui.search[p] = el.value; const list = root.querySelector(`[data-fac-list="${p}"]`); if (list) list.innerHTML = facListHtml(ctx, ui, p); }
}

function onChange(e) {
  const el = e.target, f = el.dataset.field;
  if (!f) return;
  const { ctx } = cur;
  if (f === 'size') {
    // points follow the game size unless set by hand to something else (Incursion 1000 / Strike Force 2000)
    const defPts = { strike: 2000, incursion: 1000 };
    const prev = ctx.state.opts.size, pts = Number(ctx.state.opts.points);
    ctx.dispatch({ type: 'opts.set', key: 'size', value: el.value });
    if (defPts[el.value] && (!pts || pts === defPts[prev])) ctx.dispatch({ type: 'opts.set', key: 'points', value: defPts[el.value] });
  }
  else if (f === 'stratLock') ctx.dispatch({ type: 'opts.set', key: f, value: el.value });
  else if (f === 'autoScore') ctx.dispatch({ type: 'opts.set', key: 'autoScore', value: el.checked });
  else if (f === 'twist') ctx.dispatch({ type: 'mission.set', twist: el.value || null });
  else if (f === 'mirrored') ctx.dispatch({ type: 'mission.set', mirrored: el.value || null });
}

async function onClick(e) {
  if (e.target.closest && e.target.closest('details[data-stop]')) return;   // Regeltext auf-/zuklappen, nicht die Karte wählen
  const el = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el || el.disabled || el.classList.contains('disabled')) return;
  const { ctx, ui } = cur;
  const s = ctx.state, d = el.dataset, a = d.action;
  const p = d.p != null ? Number(d.p) : null;
  const go = () => paint();
  switch (a) {
    case 'step': return goStep(Number(d.i));
    case 'prev': return goStep(ui.step - 1);
    case 'next': return goStep(ui.step + 1);
    case 'tab': ui.tab = p; return go();
    case 'undo': return ctx.undo();
    case 'go': return ctx.nav(d.hash);
    case 'color': return ctx.dispatch({ type: 'player.set', player: p, color: Number(d.c) });
    case 'opt': return ctx.dispatch({ type: 'opts.set', key: d.key, value: d.value });
    case 'seq-done': return ctx.dispatch({ type: 'sequence.set', key: d.key, done: true });
    case 'seq-undo': return ctx.dispatch({ type: 'sequence.set', key: d.key, done: false });
    case 'seq-toggle': ui.seqOpen = !ui.seqOpen; return render(cur.root, ctx);
    case 'dp-step': return ctx.dispatch({ type: 'opts.set', key: 'dp', value: Math.max(0, Math.min(9, dpLimit(s) + Number(d.delta))) });
    case 'dp-auto': return ctx.dispatch({ type: 'opts.set', key: 'dp', value: null });

    case 'fac-pick': ui.search[p] = ''; return ctx.dispatch({ type: 'player.army', player: p, faction: d.id, detachments: [] });
    case 'fac-clear': return ctx.dispatch({ type: 'player.army', player: p, faction: null, detachments: [] });
    case 'det': {
      const pl = s.players[p], fac = ctx.data.FACTIONS.find(f => f.id === pl.faction);
      const list = pl.detachments.includes(d.id) ? pl.detachments.filter(x => x !== d.id) : pl.detachments.concat(d.id);
      const dp = dpOf(fac, list), limit = dpLimit(s, fac, list);
      if (dp > limit) return toast(`Too many Detachment Points: ${dp} > ${limit}`, 'warn');
      return ctx.dispatch({ type: 'player.army', player: p, faction: pl.faction, detachments: list });
    }
    case 'army-pick': {
      // one tap: faction, Detachment, army list (and the game size) from a saved list
      el.disabled = true;
      try { await importSavedArmy(ctx, p, d.army); } finally { el.disabled = false; }
      const st = (cur && cur.ctx.state) || s;
      if (typeof ctx.me === 'number' && ui.step === 1 && st.players[p].faction && st.players[p].units.length) goStep(3);   // faction + list done → Mission
      return;
    }
    case 'unit-add': return openUnitSheet(ctx, p, null);
    case 'unit-edit': return openUnitSheet(ctx, p, s.players[p].units.find(u => u.id === d.id) || null);
    case 'import': return openImportSheet(ctx, p);

    case 'attacker': return ctx.dispatch({ type: 'mission.set', attacker: s.mission.attacker === p ? null : p });
    case 'disp': { if (s.mission.dispositions[p] === d.id) return;   // null = „behalten“ im Reducer, Abwählen gibt es nicht
      const disp = [null, null]; disp[p] = d.id; return ctx.dispatch({ type: 'mission.set', dispositions: disp }); }
    case 'terrain': return ctx.dispatch({ type: 'mission.set', terrainLayout: d.id || null });
    case 'terrain-random': {
      if (!s.mission.deployment) return toast('Choose a layout first – its deployment zones are needed.', 'warn');
      const a = randomLayoutAction(s);
      return a ? ctx.dispatch(a) : toast('No fair layout found – try again', 'warn');
    }

    case 'sec-mode': {
      if (d.mode === 'tactical') { ui.secMode[p] = null; ui.fixedSel[p] = []; return ctx.dispatch({ type: 'secondaries.mode', player: p, mode: 'tactical' }); }
      ui.secMode[p] = 'fixed'; ui.fixedSel[p] = (s.players[p].secondaries.fixed || []).slice(); return go();
    }
    case 'sec-fixed': {
      let sel = ui.fixedSel[p].length ? ui.fixedSel[p].slice() : (s.players[p].secondaries.fixed || []).slice();
      if (sel.includes(d.id)) sel = sel.filter(x => x !== d.id); else { sel.push(d.id); if (sel.length > 2) sel.shift(); }
      ui.fixedSel[p] = sel; ui.secMode[p] = 'fixed';
      if (sel.length === 2) { const st = await ctx.dispatch({ type: 'secondaries.mode', player: p, mode: 'fixed', fixed: sel }); if (st) { ui.secMode[p] = null; ui.fixedSel[p] = []; } }
      else go();
      return;
    }

    case 'ready': return ctx.dispatch({ type: 'player.ready', player: p, ready: d.on === '1' });
    case 'deploy': { const st = await ctx.dispatch({ type: 'stage.deploy' }); if (st) toast('Deployment begins – continue on the tablet (Score) and the phones', 'ok', 4000); return; }
    case 'reset': if (await confirmSheet({ title: 'Back to setup?', text: 'Positions, scores and the log of this battle will be reset. Armies and mission are kept.', ok: 'Reset', kind: 'danger' })) ctx.dispatch({ type: 'game.reset' }); return;
  }
}
