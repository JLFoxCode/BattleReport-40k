/* Score (Tablet in der Tischmitte, SPEC v4) – Route #/g/CODE/table, ctx.me = 'desktop'.
 * Beide Spieler bedienen dasselbe Gerät: Runde/Zug/Phase, Punkte, CP, Primär-/Sekundärwertung als antippbare
 * Bedingungszeilen, Missionsziele (Übersteuerung), „Nächste Phase“, Wertungs-Sheet, Reiter „Mehr“ (Verlauf, Korrekturen).
 * Kein Spielfeld, keine Einheiten. Export: render(root, ctx). Events: eine Delegation auf root (root.__tableBound).
 * UI-Zustand je Spielcode liegt in UI (überlebt Re-Renders bei jedem State-Push). */
import { WH } from '../../data/rules.js';
import { CORE } from '../../data/core.js';
import { esc, btn, badge, chip, sheet, confirmSheet, toast, colorOf } from './components.js';
import { prepareQr, qrReady, qrSvg, joinUrl } from './qr.js';

/* ───────── Originaltexte (englisch, unverändert) aus data/orig/* – Loader wird nachgeladen, falls vorhanden ───────── */
const ORIG = { mod: undefined, missions: null, fac: new Map() };
async function origMod() {
  if (ORIG.mod === undefined) ORIG.mod = await import('../data/orig.js').catch(() => null);
  return ORIG.mod;
}
async function origMissions() {
  const m = await origMod();
  if (!m || !m.loadMissionsOrig) return null;
  if (!ORIG.missions) ORIG.missions = await m.loadMissionsOrig().catch(() => null);
  return ORIG.missions;
}
async function origFaction(id) {
  const m = await origMod();
  if (!m || !m.loadOrig || !id) return null;
  if (!ORIG.fac.has(id)) ORIG.fac.set(id, await m.loadOrig(id).catch(() => null));
  return ORIG.fac.get(id);
}
/** BattleScribe/Wahapedia markup (^^, **) aus Originaltexten entfernen – der Wortlaut bleibt unverändert. */
function cleanOrig(t) { return String(t == null ? '' : t).replace(/\^\^/g, '').replace(/\*\*/g, ''); }
/** Block mit dem englischen Originaltext (unverändert). */
function origBlock(text, label = 'Original text') {
  if (!text) return '';
  return `<div class="orig-block"><div class="orig-label">${esc(label)}</div><div class="orig-text">${esc(cleanOrig(text))}</div></div>`;
}
/** Kernregel-Einträge (Kurzfassung) nach Titel/Tag/ID suchen. */
function coreEntries(re) {
  const all = [...(CORE.general || []), ...(CORE.turnStart || [])];
  return all.filter(g => re.test(g.title + ' ' + (g.tags || []).join(' ') + ' ' + g.id));
}
function coreList(entries) {
  return entries.length ? `<dl class="info-dl" data-no-i18n>${entries.map(g => `<dt>${esc(g.title)}</dt><dd>${esc(g.text)}</dd>`).join('')}</dl>` : '';
}
function infoBtn(action, data, title = 'Info') {
  return btn({ icon: 'i', kind: 'ghost', cls: 'info', action, data, title });
}
function openTextSheet(title, bodyHtml, cls = '') {
  sheet({ title, cls, body: bodyHtml, actions: [{ label: 'Close', kind: 'ghost' }] });
}

const UI = {};
function uiFor(code) {
  return UI[code] || (UI[code] = { tab: 'score', sheet: null, ctx: null, dismissed: null, checks: {}, logN: 60 });
}
let cur = null; // { root, ctx, ui }

const pName = (s, i) => (s && s.players && s.players[i] && s.players[i].name) || `Player ${Number(i) + 1}`;
const phaseIdx = id => Math.max(0, WH.PHASES.findIndex(p => p.id === id));
const SRC_LABEL = { primary: 'Primary', secondary: 'Secondary', bonus: 'Bonus' };
const WHEN_LABEL = { cmd: 'End of Command phase', turn: 'End of turn', end: 'End of battle' };
const STAGE_LABEL = { setup: 'Setup', deploy: 'Deployment', battle: 'Battle', over: 'Finished' };

/* ═══════════════ Einstieg ═══════════════ */
export function render(root, ctx) {
  const ui = uiFor(ctx.code);
  ui.ctx = ctx;
  cur = { root, ctx, ui };
  bind(root);
  applyColors(ctx.state);
  paint();
  syncSheet();
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
  if (document.body.dataset.view !== 'table' || !root.isConnected) return;
  let body;
  if (s.stage === 'setup') body = setupStage(ctx);
  else if (s.stage === 'deploy') body = deployStage(ctx, ui);
  else if (s.stage === 'over') body = overStage(ctx, ui);
  else body = battleStage(ctx, ui);
  // Scrollposition über das Neuzeichnen hinweg halten (sonst springt die Seite bei jedem Tipp nach oben)
  const y = window.scrollY;
  const inner = root.querySelector('.tbl-main');
  const innerTop = inner ? inner.scrollTop : 0;
  const h = root.offsetHeight;
  root.style.minHeight = h + 'px';
  root.innerHTML = `<div class="tbl stage-${esc(s.stage)}" data-tab="${esc(ui.tab)}">${body}</div>`;
  const inner2 = root.querySelector('.tbl-main');
  if (inner2 && innerTop > 0) inner2.scrollTop = innerTop;
  if (y > 0) window.scrollTo(0, y);
  requestAnimationFrame(() => {
    root.style.minHeight = '';
    if (inner2 && innerTop > 0 && Math.abs(inner2.scrollTop - innerTop) > 2) inner2.scrollTop = innerTop;
    if (y > 0 && Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  });
}

/* ═══════════════ Stage setup ═══════════════ */
function setupStage(ctx) {
  const s = ctx.state, m = s.mission, code = ctx.code;
  const facName = p => { const f = ctx.data.FACTIONS.find(x => x.id === s.players[p].faction); return f ? f.name : 'no faction'; };
  return `
    <div class="tbl-simple wrap">
      <header class="tbl-top">
        <div class="xs muted">Game <b>${esc(code)}</b> · ${esc(STAGE_LABEL.setup)}</div>
        <h1 class="title">Score – setup in progress</h1>
      </header>
      <div class="tbl-two">${[0, 1].map(p => `
        <div class="card p${p}">
          <div class="card-head"><div class="title">${esc(pName(s, p))}</div>${s.players[p].ready ? badge('ready', 'ok') : badge('open', 'warn')}</div>
          <div class="small">${esc(facName(p))}</div>
          <div class="xs muted">${esc(s.players[p].detachments.map(id => { const f = ctx.data.FACTIONS.find(x => x.id === s.players[p].faction); return ((f && (f.detachments || []).find(d => d.id === id)) || { name: id }).name; }).join(', ') || 'no Detachment')}</div>
          <div class="xs muted">Secondary: ${s.players[p].secondaries.mode === 'fixed' ? 'Fixed – ' + esc((s.players[p].secondaries.fixed || []).map(id => (WH.SECONDARY[id] || { name: id }).name).join(', ') || '–') : 'Tactical'}</div>
        </div>`).join('')}</div>
      <div class="card mt">
        <div class="card-head"><div class="title">Mission</div></div>
        <div class="small">${esc(m.deployment || 'Deployment map missing')} · Attacker: ${m.attacker != null ? esc(pName(s, m.attacker)) : '–'}</div>
        <div class="xs muted">Primary: ${m.primary.map(id => esc(id ? (WH.PRIMARY[id] || {}).name : '–')).join(' / ')}</div>
      </div>
      <div class="mt">
        ${btn({ label: 'Go to setup', kind: 'primary', cta: true, action: 'go', data: { hash: `#/g/${code}/setup` } })}
        <p class="xs muted center mt">Once both players are ready and setup has started "Go to deployment", the deployment checklist appears here.</p>
      </div>
      <div class="row mt"><a class="btn ghost" href="#/">Lobby</a></div>
    </div>`;
}

/* ═══════════════ Stage deploy: Checkliste ═══════════════ */
function deployStage(ctx, ui) {
  if (!qrReady()) prepareQr().then(ch => { if (ch && document.body.dataset.view === 'table') ctx.rerender(); }).catch(() => {});
  const s = ctx.state, m = s.mission, code = ctx.code;
  const att = m.attacker === 1 ? 1 : 0, def = 1 - att;
  const first = m.first;
  const chk = ui.checks;
  const item = (key, title, sub, extra) => `
    <li class="dep-item ${chk[key] ? 'done' : ''}" data-action="check" data-key="${esc(key)}">
      <span class="ck">${chk[key] ? '✓' : ''}</span>
      <div class="main"><div class="name">${title} ${infoBtn('dep-info', { key }, 'Rules text')}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      ${extra || ''}
    </li>`;
  return `
    <div class="tbl-simple wrap">
      <header class="tbl-top">
        <div class="xs muted">Game <b>${esc(code)}</b> · ${esc(STAGE_LABEL.deploy)} · ${esc(m.deployment || '')}</div>
        <h1 class="title">Deployment</h1>
      </header>
      <div class="card pad0">
        <ul class="list dep-list">
          ${item('roles', `<span class="text-p${att}">${esc(pName(s, att))}</span> is the Attacker · <span class="text-p${def}">${esc(pName(s, def))}</span> is the Defender`,
            'The Attacker uses the Attacker deployment zone of the deployment map, the Defender the opposite one.')}
          ${item('reserves', 'Declare Battle Formations', 'Before deploying, each player secretly notes which Leaders are attached to which units, which units start embarked in TRANSPORTS and which start in Reserves (Strategic Reserves, Deep Strike); then both reveal them.')}
          ${item('alt', 'Deploy alternately', `<span class="text-p${def}">${esc(pName(s, def))}</span> (Defender) deploys first: one unit each, alternating, wholly within your own deployment zone, until all units are deployed or in Reserves. After deploying a TITANIC unit, skip your next deployment. Redeployments afterwards alternate, starting with the Attacker.`)}
          <li class="dep-item first ${first != null ? 'done' : ''}">
            <span class="ck">${first != null ? '✓' : ''}</span>
            <div class="main">
              <div class="name">Roll off for the first turn ${infoBtn('dep-info', { key: 'first' }, 'Rules text')}</div>
              <div class="sub">Roll off: both players roll, the winner takes the first turn. Pre-battle rules (e.g. Scouts) are resolved alternately afterwards, starting with the player taking the first turn.${first != null ? ` First turn: <b class="text-p${first}">${esc(pName(s, first))}</b>` : ''}</div>
              <div class="row first-row">${[0, 1].map(p => btn({ label: pName(s, p), kind: `p${p}`, cls: first === p ? '' : 'ghost', action: 'first', data: { p } })).join('')}</div>
              <div class="row qr-row">${[0, 1].map(p => `<div class="qr-card p${p}">${qrReady() ? qrSvg(joinUrl(code, p)) : '<div class="qr-wait xs muted">QR code loading…</div>'}<div class="xs muted">Scan to open the rules of <b class="text-p${p}">${esc(pName(s, p))}</b></div></div>`).join('')}</div>
            </div>
          </li>
        </ul>
      </div>
      <div class="mt">
        ${btn({ label: first != null ? `Start battle – ${pName(s, first)} takes the first turn` : 'Start battle (choose first turn first)', kind: 'primary', cta: true, action: 'battle', disabled: first == null })}
      </div>
      <div class="row mt">
        ${btn({ label: 'Go to setup', kind: 'ghost', action: 'go', data: { hash: `#/g/${code}/setup` } })}
        ${btn({ label: 'Undo', kind: 'ghost', action: 'undo' })}
        <a class="btn ghost" href="#/">Lobby</a>
      </div>
    </div>`;
}

/* ═══════════════ Stage battle ═══════════════ */
function battleStage(ctx, ui) {
  const s = ctx.state;
  return `
    ${head(ctx)}
    <nav class="tbl-tabs" aria-label="View">
      ${chip({ label: 'Score', on: ui.tab === 'score', action: 'tab', data: { tab: 'score' } })}
      ${chip({ label: 'More', on: ui.tab === 'more', action: 'tab', data: { tab: 'more' } })}
      <span class="spacer"></span>
      <span class="xs muted code">Game ${esc(ctx.code)}</span>
    </nav>
    <main class="tbl-main">
      ${ui.tab === 'more' ? moreTab(ctx, ui) : scoreTab(ctx, ui)}
    </main>
    <footer class="tbl-cta">${ctaHtml(ctx)}</footer>`;
}

function head(ctx) {
  const s = ctx.state, d = ctx.derived || {};
  const t = s.turn;
  const idx = phaseIdx(s.phase);
  const vp = d.vp || [0, 1].map(p => ({ total: 0 }));
  const cp = d.cp || s.players.map(p => p.cp || 0);
  return `
    <header class="tbl-head p${t}">
      <div class="head-vp p0">
        <div class="kpi lg p0"><span class="kpi-value">${esc(vp[0].total)}</span><span class="kpi-label">${esc(pName(s, 0))}</span></div>
        <button class="cpbox" type="button" data-action="cp-sheet" data-p="0" aria-label="Adjust CP ${esc(pName(s, 0))}"><b>${esc(cp[0])}</b><span>CP</span></button>
      </div>
      <button type="button" class="head-mid" data-action="phase-info" title="Rules for the current phase">
        <div class="head-round"><span class="muted">Round</span> <b>${esc(s.round)}</b><span class="muted">/5</span> · <span class="muted">Turn</span> <b class="text-p${t}">${esc(pName(s, t))}</b></div>
        ${turnBlocks(s)}
        ${phaseStrip(s, idx)}
      </button>
      <div class="head-vp p1">
        <button class="cpbox" type="button" data-action="cp-sheet" data-p="1" aria-label="Adjust CP ${esc(pName(s, 1))}"><b>${esc(cp[1])}</b><span>CP</span></button>
        <div class="kpi lg p1"><span class="kpi-value">${esc(vp[1].total)}</span><span class="kpi-label">${esc(pName(s, 1))}</span></div>
      </div>
    </header>`;
}

/** Two blocks in the players' colours, in turn order of the round; the active player's block is lit. */
function turnBlocks(s) {
  const first = s.mission.first == null ? 0 : s.mission.first;
  const order = [first, 1 - first];
  return `<div class="turnblocks">${order.map((p, k) => `<div class="tblock p${p} ${s.turn === p ? 'cur' : (k === 0 ? 'done' : '')}"><span class="tblock-k">${k === 0 ? '1st turn' : '2nd turn'}</span><span class="tblock-n">${esc(pName(s, p))}</span></div>`).join('')}</div>`;
}

/** The five phases of the turn (07.02); the current one is lit, finished ones dimmed. End of turn lights no phase. */
function phaseStrip(s, idx) {
  return `<div class="phasestrip">${WH.PHASES.filter(p => p.id !== 'end').map((p, i) => `<span class="pseg ph-${esc(p.id)} ${i < idx ? 'done' : i === idx ? 'cur' : ''}">${esc(p.name)}</span>`).join('')}</div>`;
}

/** Ten turns of the battle (round 1 first player … round 5 second player) as a progress bar. */
function turnBar(s) {
  const first = s.mission.first == null ? 0 : s.mission.first;
  const order = [first, 1 - first];
  const curIdx = (Math.max(1, s.round) - 1) * 2 + (s.turn === first ? 0 : 1);
  const segs = [];
  for (let r = 1; r <= 5; r++) for (let k = 0; k < 2; k++) {
    const i = (r - 1) * 2 + k, p = order[k];
    segs.push(`<span class="tseg p${p} ${i < curIdx ? 'done' : i === curIdx ? 'cur' : ''}" title="Round ${r} – ${esc(pName(s, p))}">${k === 0 ? `<i>${r}</i>` : ''}</span>`);
  }
  return `<div class="turnbar">${segs.join('')}</div>`;
}

/** End the current turn from the tablet: run through the remaining phases (stops at pending scorings, which reopen the sheet). */
async function endTurn() {
  const { ctx, ui } = cur;
  const c = () => (cur.ui.ctx || cur.ctx);
  let s = c().state;
  if (!s || s.stage !== 'battle') { ui.endingTurn = false; return; }
  if (s.pending) { ui.endingTurn = true; return openScoreSheet(); }
  ui.endingTurn = true;
  const startRound = s.round, startTurn = s.turn;
  for (let i = 0; i < 8; i++) {
    const r = await c().dispatch({ type: 'phase.next', endTurn: true, track: true }); // Command-phase scoring joins the end-of-turn popup
    if (!r) { ui.endingTurn = false; return; }
    if (r.pending) return;                      // scoring sheet opens via syncSheet; confirmScore continues the turn
    if (r.stage !== 'battle' || r.round !== startRound || r.turn !== startTurn) break;
  }
  ui.endingTurn = false;
}

function ctaHtml(ctx) {
  const s = ctx.state;
  if (s.stage !== 'battle') return '';
  if (s.pending && s.pending.kind === 'score') {
    return btn({ label: `Confirm scoring – ${pName(s, s.pending.player)}`, kind: `p${s.pending.player}`, cta: true, action: 'open-score', cls: 'pulse-soft' });
  }
  const lastTurn = s.round >= 5 && s.turn !== (s.mission.first == null ? 0 : s.mission.first);
  const label = lastTurn ? 'End battle – final scoring' : `End turn of ${pName(s, s.turn)} – scoring, then ${pName(s, 1 - s.turn)}`;
  // Command → Movement → Shooting → Charge → Fight (07.02) step by step; from the Fight phase the turn ends
  const idx = WH.PHASES.findIndex(p => p.id === s.phase);
  const next = idx >= 0 && idx < WH.PHASES.length - 2 ? WH.PHASES[idx + 1] : null;
  if (!next) return btn({ label, kind: 'primary', cta: true, action: 'next', cls: `cta-p${s.turn}` });
  return `<div class="cta-row">
    ${btn({ label: `Next phase: ${next.full}`, kind: 'primary', cta: true, action: 'phase-next', cls: `cta-p${s.turn}` })}
    ${btn({ label: lastTurn ? 'End battle' : 'End turn', kind: 'ghost', action: 'next', cls: 'cta-side', title: label })}
  </div>`;
}

/** One phase on (tablet "Next phase"); leaving the Command phase may open its scoring first (confirmScore continues). */
async function nextPhase() {
  const { ctx, ui } = cur;
  const s = ctx.state;
  if (!s || s.stage !== 'battle') return;
  ui.dismissed = null;
  if (s.pending) return openScoreSheet();
  ui.endingTurn = false;
  return (ui.ctx || ctx).dispatch({ type: 'phase.next', track: true });
}

/* ───────── Reiter Score ───────── */
function scoreTab(ctx, ui) {
  // Objective-marker tiles removed on request: control is scored via the condition rows / scoring popup
  return `
    <section class="tbl-cols">
      ${[0, 1].map(p => `<div class="pcol p${p}" data-p="${p}">${playerColumn(ctx, p)}</div>`).join('')}
    </section>`;
}

function objectivesHtml(ctx) {
  const s = ctx.state, d = ctx.derived || {};
  const objs = s.objectives || [];
  if (!objs.length) return `<div class="card flat muted center">No objective markers (deployment map missing).</div>`;
  const ctrl = d.control || {};
  const twist = s.mission.twist ? WH.TWISTS.find(t => t.id === s.mission.twist) : null;
  return `
    <div class="objs-head"><span class="xs muted">Objective markers · tap cycles ${esc(pName(s, 0))} → ${esc(pName(s, 1))} → none → auto</span>${infoBtn('obj-info', {}, 'Objective control rules')}
      ${twist ? `<span class="spacer"></span><span class="xs"><b>Twist:</b> ${esc(twist.name)}</span>${infoBtn('twist-info', { id: twist.id }, 'Twist')}` : ''}</div>
    <section class="tbl-objs">
      ${objs.map(o => {
        const c = ctrl[o.id] ? ctrl[o.id].ctrl : o.ctrl;
        const who = c === 0 || c === 1 ? c : null;
        const label = o.kind === 'home' ? `Home ${o.home != null ? pName(s, o.home) : ''}` : o.kind === 'exp' ? (o.id === 'o3' ? 'Exp. 1' : 'Exp. 2') : 'Centre';
        const mode = o.override == null ? 'Auto' : o.override === 'none' ? 'None' : 'Manual';
        return `<button type="button" class="obj ${who != null ? 'p' + who + ' held' : 'free'} ${o.override == null ? 'auto' : ''}" data-action="obj" data-id="${esc(o.id)}" title="${esc(o.name)}">
          <span class="obj-label">${esc(label)}</span>
          <span class="obj-who">${who != null ? esc(pName(s, who)) : 'free'}</span>
          <span class="obj-mode">${esc(mode)}</span>
        </button>`;
      }).join('')}
    </section>`;
}

function playerColumn(ctx, p) {
  const s = ctx.state, d = ctx.derived || {};
  const pl = s.players[p];
  const sc = (d.scoring || [])[p] || { primary: { conds: [] }, secondaries: [], caps: null };
  const vp = (d.vp || [])[p] || { primary: 0, secondary: 0, bonus: 0, total: 0 };
  const isTurn = s.turn === p;
  return `
    <div class="pcol-head">
      <span class="dot"></span><span class="pcol-name">${esc(pName(s, p))}</span>
      ${isTurn ? badge('active turn', `p${p}`) : ''}
      <span class="spacer"></span>
      <span class="pcol-vp muted xs">P ${esc(vp.primary)} · S ${esc(vp.secondary)}${vp.bonus ? ' · B ' + esc(vp.bonus) : ''}</span>
    </div>
    ${primaryCard(ctx, p, sc)}
    ${secondariesHtml(ctx, p, sc)}
    ${capsHtml(sc)}
    ${resourcesHtml(ctx, p, pl)}`;
}

function primaryCard(ctx, p, sc) {
  const pr = sc.primary || {};
  if (!pr.card) return `<div class="card flat muted center">No Primary Mission.</div>`;
  return `
    <div class="card scard primary p${p}">
      <div class="card-head">
        <div class="title">${esc(pr.name)}</div>
        ${badge('Primary', `p${p}`)}
        ${btn({ icon: 'i', kind: 'ghost', cls: 'info', action: 'info', data: { p, src: 'primary', card: pr.card }, title: 'Description' })}
      </div>
      <div class="conds">${condRows(ctx, p, 'primary', pr.card, pr.conds || [])}</div>
    </div>`;
}

function secondariesHtml(ctx, p, sc) {
  const s = ctx.state;
  const sec = s.players[p].secondaries || {};
  const list = sc.secondaries || [];
  let out = '';
  if (sec.mode === 'tactical') {
    const canDraw = (sec.toDraw || 0) > 0;
    out += `<div class="sec-bar">
      <span class="muted xs">Tactical · Hand ${esc((sec.hand || []).length)} · Deck ${esc((sec.deck || []).length)} · achieved ${esc((sec.achieved || []).length)}</span>
      <span class="spacer"></span>
      ${btn({ label: canDraw ? `Draw (${sec.toDraw})` : 'Draw', kind: canDraw ? `p${p}` : 'ghost', small: true, action: 'sec-draw', data: { p }, disabled: !canDraw })}
    </div>`;
    if (!list.length && !canDraw) out += `<div class="card flat muted center small">No cards in hand.</div>`;
  }
  for (const c of list) {
    const drawnHint = drawnHintShown(s, p, c.card) ? `<div class="xs text-warn sec-hint">${esc(c.drawn.text)}${returnBtn(s, p, c.card)}</div>` : '';
    out += `
      <div class="card scard secondary p${p}" data-card="${esc(c.card)}">
        <div class="card-head">
          <div class="title">${esc(c.name)}</div>
          ${badge(c.fixed && sec.mode === 'fixed' ? 'Fixed' : 'Secondary', '')}
          ${btn({ icon: 'i', kind: 'ghost', cls: 'info', action: 'info', data: { p, src: 'secondary', card: c.card }, title: 'Description' })}
        </div>
        ${drawnHint}
        <div class="conds">${condRows(ctx, p, 'secondary', c.card, c.conds || [])}</div>
        ${sec.mode === 'tactical' ? `<div class="card-foot">
          ${btn({ label: 'Achieved', kind: 'ok', small: true, action: 'sec-achieve', data: { p, card: c.card } })}
          ${btn({ label: 'Discard', kind: 'ghost', small: true, action: 'sec-discard', data: { p, card: c.card } })}
        </div>` : ''}
      </div>`;
  }
  return out;
}

/** Condition rows of a card: only those whose battle-round window includes the current round; the rest as a short note. */
function condRows(ctx, p, src, card, conds) {
  const s = ctx.state, round = s.round || 1;
  const first = s.mission.first == null ? 0 : s.mission.first;
  const lastTurn = round >= 5 && s.turn !== first;          // second turn of round 5 = end of the battle
  const inWindow = c => !Array.isArray(c.r) || (round >= c.r[0] && round <= c.r[1]);
  const endOnly = c => (c.w || c.when) === 'end' && !lastTurn;   // "END OF THE BATTLE" conditions only in the final turn
  const now = conds.filter(c => inWindow(c) && !endOnly(c));
  const later = conds.filter(c => !inWindow(c) && Array.isArray(c.r) && c.r[0] > round);
  const atEnd = conds.filter(c => inWindow(c) && endOnly(c));
  const vpTxt = c => `${c.vp != null ? esc(c.vp) + ' VP' : 'VP'}${c.k === 'per' ? ' each' : ''}`;
  const notes = [
    ...later.map(c => `From round ${esc(c.r[0])}: ${esc(c.text)} (${vpTxt(c)})`),
    ...atEnd.map(c => `End of the battle: ${esc(c.text)} (${vpTxt(c)})`)
  ];
  const laterNote = notes.length ? `<div class="crow later xs muted">${notes.join(' · ')}</div>` : '';
  return now.map(c => condRow(ctx, p, src, card, c)).join('') + laterNote;
}

/** Diesen Zug gebuchte Einträge einer Bedingung. */
function bookedEntries(s, p, src, card, ci) {
  return (s.scores || []).filter(x => x.player === p && x.src === src && x.card === card && x.ci === ci && x.round === s.round && x.turn === s.turn);
}

function condRow(ctx, p, src, card, c) {
  const booked = Number(c.scoredThisTurn) || 0;
  const rr = Array.isArray(c.r) && (c.r[0] !== 1 || c.r[1] !== 5) ? ` · R${c.r[0]}${c.r[1] !== c.r[0] ? '–' + c.r[1] : ''}` : '';
  const vpLabel = c.vp != null ? `${c.vp} VP` : (c.opts || []).map(o => `${o.vp}`).join('/') + ' VP';
  const meta = `${esc(c.whenLabel || '')}${esc(rr)}${c.active ? ` · <span class="text-warn">due now</span>` : ''}`;
  const data = `data-p="${p}" data-src="${esc(src)}" data-card="${esc(card)}" data-ci="${esc(c.ci)}" data-k="${esc(c.k)}"`;
  let ctl;
  if (c.k === 'per') {
    // Count of triggers; VP = count × unit, capped at max ("2 VP each, max. 5" → 2 / 4 / 5 VP)
    const unit = Number(c.vp) || 1;
    const max = c.max != null ? Number(c.max) : null;
    const n = Math.ceil(booked / unit);
    ctl = `<div class="stepper sm p${p}">
      <button type="button" data-action="cond-step" data-delta="-1" ${data} ${booked <= 0 ? 'disabled' : ''} aria-label="Less">−</button>
      <span class="stepper-value">${esc(n)}×</span>
      <button type="button" data-action="cond-step" data-delta="1" ${data} ${max != null && booked >= max ? 'disabled' : ''} aria-label="More">+</button>
    </div><span class="muted xs step-vp">= ${esc(booked)} VP</span>`;
  } else if (c.k === 'choice') {
    ctl = `<button type="button" class="cond-tap ${booked > 0 ? 'on' : ''}" data-action="cond-choice" ${data}><span class="cond-vp">${booked > 0 ? esc(booked) + ' VP' : esc(vpLabel)}</span><span class="cond-state">${booked > 0 ? 'Booked' : 'Choose'}</span></button>`;
  } else {
    ctl = `<button type="button" class="cond-tap ${booked > 0 ? 'on' : ''}" data-action="cond-bool" ${data}><span class="cond-vp">${esc(vpLabel)}</span><span class="cond-state">${booked > 0 ? 'Booked' : 'Book'}</span></button>`;
  }
  return `<div class="crow ${c.sub ? 'sub' : ''} ${c.active ? 'active' : ''} ${booked > 0 ? 'booked' : ''}">
    <div class="crow-main">
      <div class="crow-text"><span class="crow-cond">${esc(c.text)}</span>${c.k === 'per' ? ` <span class="muted crow-each">(${esc(c.vp)} VP each${c.max != null ? ', max. ' + esc(c.max) : ''})</span>` : ''}</div>
      ${c.opts ? `<div class="crow-opts muted xs">${c.opts.map(o => esc(o.t) + ' (' + esc(o.vp) + ' VP)').join(' · ')}</div>` : ''}
      <div class="crow-meta xs muted">${meta}${booked > 0 ? ` · <span class="text-ok">booked ${esc(booked)} VP</span>` : ''}</div>
    </div>
    <div class="crow-ctl">${infoBtn('cond-info', { p, src, card, ci: c.ci }, 'Wording of this condition')}${ctl}</div>
  </div>`;
}

function capsHtml(sc) {
  const c = sc.caps;
  if (!c) return '';
  const u = c.used || {};
  const cell = (label, used, max) => `<span class="cap ${used >= max ? 'full' : ''}"><span class="cap-l">${esc(label)}</span><b>${esc(used)}</b>/${esc(max)}</span>`;
  return `<div class="caps">${infoBtn('caps-info', {}, 'Limits')}
    ${cell('Primary round', u.primaryRound || 0, c.primaryRound)}${cell('Primary battle', u.primaryBattle || 0, c.primaryBattle)}
    ${cell('Secondary round', u.secRound || 0, c.secRound)}${cell('Secondary battle', u.secBattle || 0, c.secBattle)}
  </div>`;
}

function resourcesHtml(ctx, p, pl) {
  const res = pl.resources || [];
  if (!res.length) return '';
  return `<div class="card flat res-card">
    ${res.map((r, i) => `<div class="res-row">
      <div class="main"><div class="name">${esc(r.name)} ${infoBtn('res-info', { p, i }, 'Rule for this counter')}</div>${r.max != null ? `<div class="sub xs muted">max. ${esc(r.max)}</div>` : ''}</div>
      <div class="stepper sm p${p}">
        <button type="button" data-action="res" data-p="${p}" data-i="${i}" data-delta="-1" ${r.value <= 0 ? 'disabled' : ''} aria-label="Less">−</button>
        <span class="stepper-value">${esc(r.value || 0)}</span>
        <button type="button" data-action="res" data-p="${p}" data-i="${i}" data-delta="1" ${r.max != null && r.value >= r.max ? 'disabled' : ''} aria-label="More">+</button>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ───────── Reiter Mehr ───────── */
function moreTab(ctx, ui) {
  const s = ctx.state;
  return `
    <section class="more">
      <div class="card">
        <div class="card-head"><div class="title">Corrections</div></div>
        <div class="more-grid">
          ${btn({ label: 'Undo (last action)', kind: 'ghost', action: 'undo' })}
          ${btn({ label: 'Set phase', kind: 'ghost', action: 'phase-set' })}
          ${btn({ label: 'End battle', kind: 'danger', action: 'end-game' })}
          ${btn({ label: 'Back to setup', kind: 'ghost', action: 'go', data: { hash: `#/g/${ctx.code}/setup` } })}
          <a class="btn ghost" href="#/">Lobby</a>
        </div>
        <div class="cp-grid">${[0, 1].map(p => `<div class="cp-row p${p}">
          <div class="main"><div class="name text-p${p}">${esc(pName(s, p))}</div><div class="sub xs muted">Command points</div></div>
          <div class="stepper p${p}">
            <button type="button" data-action="cp" data-p="${p}" data-delta="-1" ${(s.players[p].cp || 0) <= 0 ? 'disabled' : ''} aria-label="Less">−</button>
            <span class="stepper-value">${esc(s.players[p].cp || 0)}</span>
            <button type="button" data-action="cp" data-p="${p}" data-delta="1" aria-label="More">+</button>
          </div>
        </div>`).join('')}</div>
      </div>
      ${logHtml(ctx, ui)}
    </section>`;
}

function logHtml(ctx, ui) {
  const s = ctx.state;
  const all = (s.log || []).slice().reverse();
  const list = all.slice(0, ui.logN);
  return `<div class="card pad0 log-card">
    <div class="card-head log-head"><div class="title">Log</div><span class="muted xs">${esc(all.length)} entries, newest first</span></div>
    <ul class="list log">${list.map(l => `<li class="list-item ${l.player === 0 || l.player === 1 ? 'p' + l.player : ''} ${l.data && l.data.warning ? 'warn' : ''}">
      <div class="main"><div class="ltxt">${esc(l.text)}</div><div class="sub xs">${l.round ? `R${esc(l.round)} · ${esc(pName(s, l.turn))} · ${esc((WH.PHASES.find(p => p.id === l.phase) || {}).name || l.phase)}` : esc(STAGE_LABEL[s.stage] || '')}${l.ts ? ' · ' + esc(fmtTime(l.ts)) : ''}</div></div>
    </li>`).join('') || '<li class="list-item muted">No entries yet.</li>'}</ul>
    ${all.length > list.length ? `<div class="log-more">${btn({ label: 'Show more', kind: 'ghost', small: true, action: 'log-more' })}</div>` : ''}
  </div>`;
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

/* ═══════════════ Stage over: Endstand ═══════════════ */
function overStage(ctx, ui) {
  const s = ctx.state, d = ctx.derived || {};
  const vp = d.vp || [0, 1].map(p => ({ primary: 0, secondary: 0, bonus: 0, total: 0 }));
  const winner = vp[0].total === vp[1].total ? null : vp[0].total > vp[1].total ? 0 : 1;
  const rounds = [1, 2, 3, 4, 5];
  const sum = (p, src, r) => (s.scores || []).filter(x => x.player === p && x.src === src && x.round === r).reduce((a, x) => a + x.vp, 0);
  const bonusDone = (s.scores || []).some(x => x.src === 'bonus');
  return `
    <div class="tbl-simple wrap over">
      <header class="tbl-top center">
        <div class="xs muted">Game <b>${esc(ctx.code)}</b> · ${esc(STAGE_LABEL.over)}</div>
        <h1 class="title">${winner == null ? 'Draw' : `<span class="text-p${winner}">${esc(pName(s, winner))}</span> wins`}</h1>
      </header>
      <div class="scoreboard">${[0, 1].map(p => `
        <div class="card p${p} ${winner === p ? 'winner' : ''}">
          <div class="kpi lg p${p}"><span class="kpi-value">${esc(vp[p].total)}</span><span class="kpi-label">${esc(pName(s, p))}</span></div>
          <div class="sb-split muted small">Primary ${esc(vp[p].primary)} · Secondary ${esc(vp[p].secondary)}${(() => { const br = (s.scores || []).filter(x => x.player === p && x.src === 'bonus' && x.card === 'battle-ready').reduce((a, x) => a + x.vp, 0); const mod = vp[p].bonus - br;
            return (br ? ' · Battle Ready ' + esc(br) : '') + (mod ? ' · Modifier ' + esc(mod) : ''); })()}</div>
        </div>`).join('')}</div>
      <div class="card pad0 mt">
        <table class="rtable">
          <thead><tr><th>Round</th><th class="text-p0" colspan="2">${esc(pName(s, 0))}</th><th class="text-p1" colspan="2">${esc(pName(s, 1))}</th></tr>
          <tr class="xs muted"><th></th><th>Primary</th><th>Secondary</th><th>Primary</th><th>Secondary</th></tr></thead>
          <tbody>${rounds.map(r => `<tr><td>${r}</td><td>${sum(0, 'primary', r)}</td><td>${sum(0, 'secondary', r)}</td><td>${sum(1, 'primary', r)}</td><td>${sum(1, 'secondary', r)}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td>${esc(vp[0].primary)}</td><td>${esc(vp[0].secondary)}</td><td>${esc(vp[1].primary)}</td><td>${esc(vp[1].secondary)}</td></tr></tbody>
        </table>
      </div>
      <div class="more-grid mt">
        ${btn({ label: 'Undo', kind: 'ghost', action: 'undo' })}
        ${btn({ label: 'Set phase', kind: 'ghost', action: 'phase-set' })}
        <a class="btn ghost" href="#/">Lobby</a>
      </div>
      <div class="mt">${logHtml(ctx, ui)}</div>
    </div>`;
}

/* ═══════════════ Sheets ═══════════════ */
function pendingKey(s) { const p = s.pending; return p ? (p.key || `${s.round}:${s.turn}:${p.when}:${p.player}`) : null; }

/** Nach jedem State-Push: Wertungs-Sheet öffnen/schließen. */
function syncSheet() {
  const { ctx, ui } = cur;
  if (ctx.spectator) return;   // spectators never get the scoring / draw popups
  const s = ctx.state;
  const key = s && s.pending && s.pending.kind === 'score' && s.stage === 'battle' ? pendingKey(s) : null;
  if (ui.sheet && ui.sheet.kind === 'score' && ui.sheet.key !== key) { ui.sheet.close(); ui.sheet = null; }
  if (key && ui.sheet && ui.sheet.kind === 'draw') { ui.sheet.close(); ui.sheet = null; }   // scoring takes precedence
  if (key && !ui.sheet && ui.dismissed !== key) { openScoreSheet(); return; }
  // New turn with Tactical Missions: ask to draw the cards right away (once per turn), showing them in full
  if (!key && s && s.stage === 'battle' && !ui.sheet) {
    const p = s.turn, sec = s.players[p].secondaries || {};
    const dkey = `${s.code}|${s.createdAt || ''}|${s.round}|${s.turn}`;
    // Start of every turn (Tactical and Fixed): draw new cards and/or recall the active Secondary Missions
    const startOfTurn = s.phase === 'command' || (sec.mode === 'tactical' && (sec.toDraw || 0) > 0);
    // remembered across reloads (per device), so the sheet does not come back after every reload
    if (ui.drawShown === undefined) { try { ui.drawShown = localStorage.getItem('br40k-drawShown') || null; } catch { ui.drawShown = null; } }
    if (startOfTurn && ui.drawShown !== dkey) {
      ui.drawShown = dkey;
      try { localStorage.setItem('br40k-drawShown', dkey); } catch { /* private mode */ }
      openDrawSheet(p);
    }
  }
}

/** Full text of a Secondary Mission card: verbatim original if available, else the condition list from the data. */
function secCardHtml(s, p, card, o) {
  const def = WH.SECONDARY[card];
  if (!def) return '';
  const mode = s.players[p].secondaries.mode;
  const vpT = v => (v && typeof v === 'object' ? (mode === 'fixed' ? v.F : v.T) : v);
  const conds = (def.c || []).map(c => `<li>${esc(c.t)} <span class="muted xs">· ${c.k === 'choice' ? esc((c.opts || []).map(x => `${x.t}: ${vpT(x.vp)} VP`).join(' / ')) : `${esc(vpT(c.vp))} VP${c.k === 'per' ? ' each' : ''}${c.max != null ? `, max. ${esc(c.max)}` : ''}`} · ${esc(WH.TIMING_LABELS[c.w] || c.w)}</span></li>`).join('');
  return `<div class="card sec-full">
    <div class="card-head"><div class="title">${esc(def.name)}</div>${def.fixed ? badge('Fixed-eligible', '') : ''}</div>
    ${origBlock(o && (o.text || o), 'Original card text')}
    ${!o ? `<ul class="info-conds" data-no-i18n>${conds}</ul>` : ''}
    ${def.note ? `<p class="small"><b>Action:</b> ${esc(def.note)}</p>` : ''}
    ${drawnHintShown(s, p, card) ? `<p class="small text-warn"><b>When drawn:</b> ${esc(def.drawn.text)}${returnBtn(s, p, card)}</p>` : ''}
  </div>`;
}
/** May this hand card be shuffled back / discarded per its own card rule right now? ("active" = in the hand) */
function canReturnCard(s, p, card) {
  const def = WH.SECONDARY[card], sec = s.players[p].secondaries || {};
  if (!def || !def.drawn || sec.mode !== 'tactical' || !(sec.hand || []).includes(card)) return false;
  const d = def.drawn;
  return (d.kind === 'round1' && s.round === 1) || (d.kind === 'conflict' && (sec.hand || []).includes(d.other)) || d.kind === 'target';
}
/** The card's "when drawn" rule applies: Tactical only (Fixed Missions are never drawn), round-1 rules in round 1,
 *  Plunder/Cleanse only while the other card is active. */
function drawnHintShown(s, p, card) {
  const def = WH.SECONDARY[card], sec = s.players[p].secondaries || {};
  if (!def || !def.drawn || sec.mode !== 'tactical') return false;
  const d = def.drawn;
  if (d.kind === 'round1') return s.round === 1;
  if (d.kind === 'conflict') return (sec.hand || []).includes(d.other);
  return true;
}
function returnBtn(s, p, card) {
  if (!canReturnCard(s, p, card)) return '';
  const discard = WH.SECONDARY[card].drawn.kind === 'target';
  return ' ' + btn({ label: discard ? 'Discard & draw a new card' : 'Draw a new card & shuffle this back', kind: 'ghost', small: true, action: 'sec-return', data: { p, card } });
}

/** Popup at the start of a turn: draw the Tactical cards, read them in full, then the rest of the hand in full. */
async function openDrawSheet(p) {
  const { ctx, ui } = cur;
  const key = `draw|${ctx.state.code}|${ctx.state.round}|${ctx.state.turn}`;
  if (ui.sheet && ui.sheet.key === key) return;
  if (ui.sheet) { ui.sheet.close(); ui.sheet = null; }
  const mo = await origMissions();
  const orig = card => (mo && ORIG.mod ? ORIG.mod.origSecondary(mo, card) : null);
  let drawn = [];
  const body = () => {
    const s = (cur.ui.ctx || cur.ctx).state;
    const sec = s.players[p].secondaries || {};
    if (sec.mode === 'fixed') {
      const fx = sec.fixed || [];
      return `<p class="muted small">Start of ${esc(pName(s, p))}'s turn · Round ${esc(s.round)} · Your Fixed Secondary Missions (active all battle):</p>
        ${fx.length ? fx.map(c => secCardHtml(s, p, c, orig(c))).join('') : '<p class="muted small">No Fixed Missions chosen.</p>'}`;
    }
    const hand = sec.hand || [];
    const rest = hand.filter(c => !drawn.includes(c));
    return `<p class="muted small">Start of ${esc(pName(s, p))}'s turn · Round ${esc(s.round)} · ${(sec.toDraw || 0) > 0 ? `Tactical Missions: draw ${esc(sec.toDraw)} card${sec.toDraw === 1 ? '' : 's'}, read them, then review your active cards.` : 'Read your new cards, then review your active Secondary Missions.'}</p>
      ${(sec.toDraw || 0) > 0 ? `<div class="row center mt mb">${btn({ label: `Draw ${sec.toDraw} card${sec.toDraw === 1 ? '' : 's'}`, kind: 'p' + p, cta: true, action: 'draw-now', data: { p } })}</div>` : ''}
      ${drawn.length ? `<h3 class="title mt">Drawn now</h3>${drawn.map(c => secCardHtml(s, p, c, orig(c))).join('')}` : ''}
      ${rest.length ? `<h3 class="title mt">${drawn.length ? 'Already active' : 'Active Secondary Missions'}</h3>${rest.map(c => secCardHtml(s, p, c, orig(c))).join('')}` : (!drawn.length && !(sec.toDraw || 0) ? '<p class="muted small">No cards in hand.</p>' : '')}`;
  };
  const close = sheet({
    title: 'Secondary Missions – ' + pName(ctx.state, p),
    cls: 'tbl-draw p' + p,
    body: body(),
    actions: [{ label: 'Close', kind: 'ghost' }],
    onOpen: el => {
      el.addEventListener('click', async e => {
        const rb = e.target.closest('[data-action="sec-return"]');
        if (rb) {
          rb.disabled = true;
          const before0 = ((cur.ui.ctx || cur.ctx).state.players[p].secondaries.hand || []).slice();
          const r0 = await (cur.ui.ctx || cur.ctx).dispatch({ type: 'sec.discard', player: p, card: rb.dataset.card, reason: 'return', cardRule: true });
          // the card rule draws the new card right away: it shows under "Drawn now"
          if (r0) drawn = drawn.filter(c => c !== rb.dataset.card).concat((r0.players[p].secondaries.hand || []).filter(c => !before0.includes(c)));
          el.querySelector('.sheet-body').innerHTML = body(); return;
        }
        const b = e.target.closest('[data-action="draw-now"]');
        if (!b) return;
        b.disabled = true;
        const before = ((cur.ui.ctx || cur.ctx).state.players[p].secondaries.hand || []).slice();
        const r = await (cur.ui.ctx || cur.ctx).dispatch({ type: 'sec.draw', player: p, cardRule: true });
        if (r) drawn = (r.players[p].secondaries.hand || []).filter(c => !before.includes(c));
        el.querySelector('.sheet-body').innerHTML = body();
      });
    },
    onClose: () => { if (ui.sheet && ui.sheet.key === key) ui.sheet = null; }
  });
  ui.sheet = { kind: 'draw', key, close };
}

function openScoreSheet() {
  const { ctx, ui } = cur;
  const s = ctx.state;
  const pend = s.pending;
  if (!pend || pend.kind !== 'score') { toast('No scoring pending', 'warn'); return; }
  const key = pendingKey(s);
  if (ui.sheet && ui.sheet.kind === 'score' && ui.sheet.key === key) return;
  if (ui.sheet) { ui.sheet.close(); ui.sheet = null; }
  const player = pend.player;
  const sc = ((ctx.derived || {}).scoring || [])[player] || null;
  // Popup for the player whose turn it is NOT (their cards that score at the end of the opponent's turn)
  const oppScoring = pend.when === 'turn' && player !== s.turn;
  const condOf = it => {
    if (!sc) return null;
    if (it.src === 'primary') return sc.primary && sc.primary.card === it.card ? (sc.primary.conds || []).find(c => c.ci === it.ci) || null : null;
    const sec = (sc.secondaries || []).find(x => x.card === it.card);
    return sec ? (sec.conds || []).find(c => c.ci === it.ci) || null : null;
  };
  // Bereits per Tipp gebuchte VP dieses Zuges vom Vorschlag abziehen (sonst doppelt)
  const items = pend.items.map(it => {
    const c = condOf(it);
    const already = c ? Number(c.scoredThisTurn) || 0 : 0;
    // No automation: the players select what was achieved; VP follow from the card
    const unit = c && c.vp != null ? Number(c.vp) : it.unit != null ? Number(it.unit) : (it.vp != null && it.k !== 'per' ? Number(it.vp) : 0);
    // Pre-select what was already booked on the score page this turn – the popup shows the total, only the difference is booked
    return Object.assign({}, it, { vp: already, suggest: already, already, auto: false, unit, n: unit > 0 ? Math.round(already / unit) : 0, opts: c && c.opts ? c.opts : null, max: c && c.max != null ? Number(c.max) : (it.max != null ? Number(it.max) : null) });
  });
  const autoScore = false;
  const maxOf = it => (it.max != null ? Number(it.max) : 15);
  const mod = { vp: 0 };   // manual modifier (corrections, rules the card list cannot express)
  let edited = false;
  // Two kinds of input only (user decision): a toggle button that lights up when the condition is met – named stages
  // (e.g. Cleanse "one objective" / "two or more") get one toggle each, lighting one clears the others – and
  // "X VP each" as a counter (− n +) that stops at the max.
  const yesNo = (vp, on) => `<button type="button" class="score-tog${on ? ' on' : ''}" data-opt="${esc(vp)}" aria-pressed="${on}">${on ? '✓ Achieved' : 'Not achieved'}</button>`;
  const rowHtml = (it, i) => {
    let ctl, sub = '';
    if (it.opts) {
      ctl = `<div class="score-stages">${it.opts.map(o => { const v = Number(o.vp) || 0;
        return `<div class="score-stage"><span class="score-stage-t">${esc(o.t)} <b class="score-stage-vp">· ${esc(v)} VP</b></span>${yesNo(v, it.vp === v)}</div>`; }).join('')}</div>`;
    } else if (it.k === 'per') {
      const cap = maxOf(it);
      sub = `${esc(it.unit)} VP each${it.max != null ? ` · max. ${esc(it.max)} VP` : ''}`;
      ctl = `<div class="score-count"><div class="stepper sm p${player}">
          <button type="button" data-n="-1" ${it.n <= 0 ? 'disabled' : ''} aria-label="Fewer">−</button>
          <span class="stepper-value">${esc(it.n)}</span>
          <button type="button" data-n="1" ${it.vp >= cap ? 'disabled' : ''} aria-label="More">+</button>
        </div><span class="score-eq">= <b>${esc(it.vp)} VP</b></span></div>`;
    } else {
      sub = `${esc(it.unit)} VP`;
      ctl = yesNo(it.unit, it.vp > 0);
    }
    return `<div class="score-item" data-i="${i}">
      <div class="score-main">
        <div class="score-card">${badge(SRC_LABEL[it.src] || it.src, it.src === 'primary' ? 'ok' : 'warn')} <b>${esc(it.name)}</b></div>
        <div class="score-text">${esc(it.text || '')}</div>
        ${sub || it.already ? `<div class="score-sub muted xs">${sub}${it.already ? (sub ? ' · ' : '') + '<span class="text-ok">' + esc(it.already) + ' VP already booked</span>' : ''}</div>` : ''}
      </div>
      <div class="score-ctl2">${ctl}</div>
    </div>`;
  };
  const totalVp = () => items.reduce((a, i) => a + i.vp, 0) + mod.vp;
  const bodyHtml = () => `${oppScoring
      ? `<p class="score-banner p${player}"><b class="text-p${player}">${esc(pName(s, player))}</b> scores now – missions that count at the end of <b class="text-p${s.turn}">${esc(pName(s, s.turn))}</b>'s turn · Round ${esc(s.round)}</p>`
      : `<p class="muted small">${esc(WHEN_LABEL[pend.when] || pend.when)} · Round ${esc(s.round)}</p>`}
      <div class="score-list">${items.map(rowHtml).join('') || '<p class="muted small">Nothing to score right now.</p>'}</div>
      <div class="score-item score-mod">
        <div class="score-main"><div class="score-card"><b>Modifier</b></div><div class="score-text muted small">Manual correction for anything the list above cannot express (booked as a separate entry).</div></div>
        <div class="score-ctl"><div class="stepper sm p${player}">
          <button type="button" data-mod="-1" ${mod.vp <= -15 ? 'disabled' : ''} aria-label="Less">−</button>
          <span class="stepper-value">${mod.vp > 0 ? '+' : ''}${esc(mod.vp)}</span>
          <button type="button" data-mod="1" ${mod.vp >= 15 ? 'disabled' : ''} aria-label="More">+</button>
        </div></div>
      </div>
`;
  const totalHtml = () => `<div class="score-total"><span>Total</span><b>${totalVp()} VP</b></div>`;
  const labelFor = () => (autoScore && !edited ? 'Apply suggestions' : 'Confirm scoring');
  const close = sheet({
    title: oppScoring
      ? `Scoring – ${pName(s, player)} (opponent) · End of ${pName(s, s.turn)}'s turn`
      : 'Scoring – ' + pName(s, player) + ' · ' + ({ cmd: 'End of Command phase', turn: 'End of turn', end: 'End of battle' }[pend.when] || pend.when),
    cls: 'tbl-score p' + player,
    body: bodyHtml(),
    actions: [
      { label: labelFor(), kind: 'primary', cta: true, onClick: async () => {
        // Book only what is new compared with the score page; lowering below the booked value removes those entries first
        const delta = items.map(it => Object.assign({}, it, { vp: it.vp - (it.already || 0) }));
        const dec = delta.filter(it => it.vp < 0);
        if (dec.length) await unbookFor(player, dec);
        const add = delta.filter(it => it.vp > 0).concat(mod.vp ? [{ src: 'bonus', card: 'modifier', ci: null, vp: mod.vp }] : []);
        await confirmScore(player, add);
      } }
    ],
    onOpen: el => {
      // Total sits directly above the confirm button (sheet footer)
      const foot = el.querySelector('.sheet-foot');
      const tot = document.createElement('div'); tot.className = 'score-total foot-total'; tot.innerHTML = totalHtml();
      if (foot) foot.parentNode.insertBefore(tot, foot);
      const refreshTotal = () => { tot.innerHTML = totalHtml(); };
      el.addEventListener('click', e => {
        const m = e.target.closest('[data-mod]');
        if (m) { mod.vp = Math.max(-15, Math.min(15, mod.vp + Number(m.dataset.mod))); el.querySelector('.sheet-body').innerHTML = bodyHtml(); refreshTotal(); return; }
        const n = e.target.closest('[data-n]');
        const o = e.target.closest('[data-opt]');
        const a = e.target.closest('[data-ach]');
        if (!n && !o && !a) return;
        const row = e.target.closest('.score-item');
        if (!row) return;
        const it = items[Number(row.dataset.i)];
        if (!it) return;
        if (n) { it.n = Math.max(0, it.n + Number(n.dataset.n)); it.vp = Math.min(maxOf(it), it.n * it.unit); if (Number(n.dataset.n) > 0 && it.vp >= maxOf(it)) it.n = Math.ceil(it.vp / it.unit); }
        else if (o) { const v = Number(o.dataset.opt) || 0; it.vp = it.vp === v ? 0 : v; }
        else it.vp = it.vp > 0 ? 0 : it.unit;
        edited = items.some(x => x.vp !== x.suggest);
        el.querySelector('.sheet-body').innerHTML = bodyHtml();
        refreshTotal();
        const ok = el.querySelector('[data-sheet-action="1"]');
        if (ok) ok.textContent = labelFor();
      });
    },
    onClose: () => { if (ui.sheet && ui.sheet.key === key) { ui.sheet = null; ui.dismissed = key; } }
  });
  ui.sheet = { kind: 'score', key, close };
}

/** Remove score-page bookings of this turn for conditions the popup lowered (newest entries first). */
async function unbookFor(player, list) {
  const c = cur.ui.ctx || cur.ctx;
  for (const it of list) {
    let need = -it.vp;
    const s = c.state;
    const entries = (s.scores || []).filter(x => x.player === player && x.src === it.src && x.card === it.card && x.ci === it.ci && x.round === s.round && x.turn === s.turn).reverse();
    for (const e of entries) { if (need <= 0) break; await c.dispatch({ type: 'score.remove', scoreId: e.id }); need -= e.vp; }
  }
}

async function confirmScore(player, items) {
  const c = cur.ui.ctx || cur.ctx;
  const payload = items.map(it => ({ src: it.src, card: it.card, ci: it.ci, vp: it.vp }));
  // the VP actually booked (after the caps), not the sum asked for
  const booked = st => (st.scores || []).filter(x => x.player === player).reduce((a, x) => a + (Number(x.vp) || 0), 0);
  const before = booked(c.state);
  const s = await c.dispatch({ type: 'score.confirm', player, items: payload, achieve: true });
  if (!s) return;
  toast(`Scoring confirmed: ${booked(s) - before} VP for ${pName(s, player)}`, 'ok');
  if (s.stage !== 'battle' || s.pending) return;
  // The scoring blocked the phase change: continue – the whole turn if the tablet is ending it, otherwise just one phase
  if (cur.ui.endingTurn) await endTurn();
  else await (cur.ui.ctx || c).dispatch({ type: 'phase.next', track: true });
}

async function openInfoSheet(p, src, card) {
  const { ctx } = cur;
  const s = ctx.state;
  const def = src === 'primary' ? WH.PRIMARY[card] : WH.SECONDARY[card];
  if (!def) return;
  const mode = s.players[p].secondaries.mode;
  const vpT = v => (v && typeof v === 'object' ? (mode === 'fixed' ? v.F : v.T) : v);
  const mo = await origMissions();
  const o = mo && ORIG.mod ? (src === 'primary' ? ORIG.mod.origPrimary(mo, card) : ORIG.mod.origSecondary(mo, card)) : null;
  sheet({
    title: def.name,
    cls: 'p' + p,
    body: `
      ${origBlock(o && (o.text || o), 'Original card text')}
      ${def.desc ? `<p data-no-i18n>${esc(def.desc)}</p>` : ''}
      ${def.note ? `<p class="small"><b>Note:</b> ${esc(def.note)}</p>` : ''}
      ${def.drawn ? `<p class="small text-warn"><b>When drawn:</b> ${esc(def.drawn.text)}</p>` : ''}
      <ul class="info-conds" data-no-i18n>${(def.c || []).map(c => `<li class="${c.sub ? 'sub' : ''}"><span class="vp">${c.k === 'choice' ? esc((c.opts || []).map(o => vpT(o.vp)).join('/')) : esc(vpT(c.vp))} VP${c.k === 'per' ? ' each' : ''}${c.max != null ? ', max. ' + esc(c.max) : ''}</span><span>${esc(c.t)}${c.opts ? ' – ' + esc(c.opts.map(o => `${o.t} (${vpT(o.vp)} VP)`).join(' · ')) : ''}<span class="muted xs"> · ${esc(WH.TIMING_LABELS[c.w] || c.w)}${c.r && (c.r[0] !== 1 || c.r[1] !== 5) ? ` · R${c.r[0]}${c.r[1] !== c.r[0] ? '–' + c.r[1] : ''}` : ''}</span></span></li>`).join('')}</ul>
      ${def.trk && def.trk.length ? `<p class="xs muted">Counters for this mission: ${esc(def.trk.map(t => t.label).join(', '))} – not tracked automatically here, book the points as agreed.</p>` : ''}`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

/* ───────── Info-Sheets: Kurzfassung + englischer Originaltext ───────── */
async function openCondInfo(p, src, card, ci) {
  const { ctx } = cur;
  const s = ctx.state;
  const def = src === 'primary' ? WH.PRIMARY[card] : WH.SECONDARY[card];
  if (!def) return;
  const c = (def.c || [])[ci];
  if (!c) return;
  const mode = s.players[p].secondaries.mode;
  const vpT = v => (v && typeof v === 'object' ? (mode === 'fixed' ? v.F : v.T) : v);
  const mo = await origMissions();
  const o = mo && ORIG.mod ? (src === 'primary' ? ORIG.mod.origPrimary(mo, card) : ORIG.mod.origSecondary(mo, card)) : null;
  openTextSheet(def.name, `
    <p><b>${esc(c.t)}</b></p>
    <p class="small">${c.k === 'choice' ? esc((c.opts || []).map(x => `${x.t}: ${vpT(x.vp)} VP`).join(' · ')) : `${esc(vpT(c.vp))} VP${c.k === 'per' ? ' each' : ''}${c.max != null ? `, max. ${esc(c.max)} VP` : ''}`}
      · Timing: ${esc(WH.TIMING_LABELS[c.w] || c.w)}${c.r && (c.r[0] !== 1 || c.r[1] !== 5) ? ` · Round ${esc(c.r[0])}–${esc(c.r[1])}` : ''}</p>
    ${def.desc ? `<p class="small muted" data-no-i18n>${esc(def.desc)}</p>` : ''}
    ${def.note ? `<p class="small"><b>Note:</b> ${esc(def.note)}</p>` : ''}
    ${origBlock(o && (o.text || o), 'Original card text')}
    ${o ? '' : '<p class="xs muted">Original text not available yet.</p>'}`, 'p' + p);
}
async function openObjInfo() {
  const entries = coreEntries(/missionsziel|objective|kontroll|\bOC\b/i);
  const mo = await origMissions();
  const g = mo && mo.general ? Object.entries(mo.general).filter(([k]) => /objective|control/i.test(k)) : [];
  openTextSheet('Objective control', `
    <p class="small">Tapping a marker cycles control: ${esc(pName(cur.ctx.state, 0))} → ${esc(pName(cur.ctx.state, 1))} → none → auto. Auto only works with unit positions; without a battlefield the setting stays manual.</p>
    ${coreList(entries)}
    ${g.map(([k, v]) => origBlock(v, 'Original text: ' + k)).join('')}`);
}
async function openTwistInfo(id) {
  const t = WH.TWISTS.find(x => x.id === id);
  if (!t) return;
  const mo = await origMissions();
  const o = mo && ORIG.mod ? ORIG.mod.origTwist(mo, id) : null;
  openTextSheet('Twist: ' + t.name, `<p data-no-i18n>${esc(t.t || '')}</p>${origBlock(o && (o.text || o), 'Original text')}`);
}
function openPhaseInfo() {
  const s = cur.ctx.state;
  const ph = WH.PHASES.find(x => x.id === s.phase) || {};
  const c = (CORE.phases || {})[s.phase] || {};
  openTextSheet(ph.full || 'Phase', `
    ${c.order && c.order.length ? `<p class="small"><b>Sequence</b></p><ol class="info-ol">${c.order.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${coreList(c.rules || [])}
    ${s.phase === 'command' ? coreList(CORE.turnStart || []) : ''}`);
}
async function openCapsInfo() {
  const mo = await origMissions();
  const g = mo && mo.general ? Object.entries(mo.general).filter(([k]) => /victory|points|limit|score|scoring/i.test(k)) : [];
  openTextSheet('Limits', `
    <p class="small">Primary Mission: max. 15 VP per battle round and 45 VP per battle. Secondary Missions: max. 15 VP per battle round and 45 VP per battle, with Fixed Missions max. 20 VP per card. Battle Ready army: 10 VP at the end of the battle. Total max. 100 VP. The tablet caps automatically.</p>
    ${g.map(([k, v]) => origBlock(v, 'Original text: ' + k)).join('')}`);
}
async function openResInfo(p, i) {
  const s = cur.ctx.state;
  const r = (s.players[p].resources || [])[i];
  if (!r) return;
  const o = await origFaction(s.players[p].faction);
  const army = o && ORIG.mod && ORIG.mod.origArmyRules ? ORIG.mod.origArmyRules(o) : [];
  openTextSheet(r.name, `<p>${esc(r.text || 'Army counter – see the Army Rule on the phone.')}</p>${(army || []).map(a => origBlock(a.text, 'Original text: ' + a.name)).join('')}`, 'p' + p);
}
async function openDepInfo(key) {
  const mo = await origMissions();
  const seq = mo && mo.sequence ? mo.sequence : [];
  const pick = re => seq.filter(x => re.test(x.step || '')).map(x => origBlock(x.text, 'Original text: ' + x.step)).join('');
  const map = {
    roles: ['Attacker and Defender', coreList(coreEntries(/angreifer|attacker|defender|aufstellung|deploy/i)), pick(/attacker|defender/i)],
    alt: ['Deploy alternately', coreList(coreEntries(/aufstell|deploy|kohärenz|coherency/i)), pick(/deploy/i)],
    reserves: ['Reserves', coreList(coreEntries(/reserve|deep strike|scouts|infiltrat|transport/i)), pick(/reserve|declare/i)],
    first: ['First turn', coreList(coreEntries(/erster zug|first turn|pre-battle|vorspiel|scouts/i)), pick(/first turn|pre-battle/i)]
  };
  const [title, de, en] = map[key] || ['Deployment', '', ''];
  openTextSheet(title, `${de}${en}${!en ? '<p class="xs muted">Original text not available yet.</p>' : ''}`);
}

function openChoiceSheet(p, src, card, ci) {
  const { ctx } = cur;
  const s = ctx.state;
  const sc = ((ctx.derived || {}).scoring || [])[p];
  const list = src === 'primary' ? (sc.primary.conds || []) : (((sc.secondaries || []).find(x => x.card === card) || {}).conds || []);
  const c = list.find(x => x.ci === ci);
  if (!c) return;
  const name = src === 'primary' ? sc.primary.name : ((sc.secondaries || []).find(x => x.card === card) || {}).name;
  const booked = Number(c.scoredThisTurn) || 0;
  sheet({
    title: name || 'Scoring',
    cls: 'p' + p,
    body: `<p class="small" data-no-i18n>${esc(c.text)}</p>
      <div class="col choice-list">
        <button type="button" class="btn ${booked === 0 ? 'primary' : 'ghost'} cta" data-choice="0">None (0 VP)</button>
        ${(c.opts || []).map(o => `<button type="button" class="btn ${booked === o.vp ? 'primary' : 'ghost'} cta" data-choice="${esc(o.vp)}">${esc(o.t)} (${esc(o.vp)} VP)</button>`).join('')}
      </div>`,
    actions: [{ label: 'Cancel', kind: 'ghost' }],
    onOpen: (el, close) => {
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-choice]');
        if (!b) return;
        close();
        await setCondVp(p, src, card, ci, Number(b.dataset.choice));
      });
    }
  });
}

/** Setzt die diesen Zug gebuchten VP einer Bedingung auf genau `vp` (vorhandene Einträge entfernen, dann neu buchen). */
async function setCondVp(p, src, card, ci, vp) {
  const c = cur.ui.ctx || cur.ctx;
  const entries = bookedEntries(c.state, p, src, card, ci);
  for (const e of entries) { if (!(await c.dispatch({ type: 'score.remove', scoreId: e.id }))) return; }
  if (vp > 0) await (cur.ui.ctx || c).dispatch({ type: 'score.add', player: p, src, card, ci, vp, when: 'manual' });
}

function openCpSheet(p) {
  const { ctx } = cur;
  const s = ctx.state;
  let close;
  const body = () => {
    const cp = (cur.ui.ctx || ctx).state.players[p].cp || 0;
    return `<div class="cp-sheet">
      <div class="kpi lg p${p}"><span class="kpi-value">${esc(cp)}</span><span class="kpi-label">CP</span></div>
      <div class="row center-row">
        <button type="button" class="btn p${p} ghost big" data-cp="-1" ${cp <= 0 ? 'disabled' : ''}>−1</button>
        <button type="button" class="btn p${p} big" data-cp="1">+1</button>
      </div>
      <p class="xs muted center">Players use Stratagems on their phones (CP are deducted automatically). Use this only for corrections and rules such as "discard at end of turn".</p>
    </div>`;
  };
  close = sheet({
    title: `CP – ${pName(s, p)}`,
    cls: 'p' + p,
    body: body(),
    actions: [{ label: 'Done', kind: 'ghost' }],
    onOpen: el => {
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-cp]');
        if (!b) return;
        const r = await (cur.ui.ctx || ctx).dispatch({ type: 'cp.adjust', player: p, delta: Number(b.dataset.cp) });
        if (r && el.isConnected) el.querySelector('.sheet-body').innerHTML = body();
      });
    }
  });
}

function openDiscardSheet(p, card) {
  const { ctx } = cur;
  const s = ctx.state;
  const sec = s.players[p].secondaries;
  const name = (WH.SECONDARY[card] || { name: card }).name;
  const ownCmd = s.stage === 'battle' && s.turn === p && s.phase === 'command';
  const canRedraw = !sec.redrawUsed && (s.players[p].cp || 0) >= 1 && ownCmd;
  sheet({
    title: `Discard "${name}"`,
    cls: 'p' + p,
    body: `<p class="small muted">Discard at end of turn: in your own turn, once per turn, +1 CP at the end of the turn. Discard and redraw: 1 CP, once per battle, at the end of your Command phase (${sec.redrawUsed ? 'already used' : ownCmd ? 'still available' : 'not now'}).</p>
      <div class="col">
        <button type="button" class="btn cta" data-reason="end">Discard (end of turn)${s.turn === p && sec.cpDiscardTurn !== s.round + ':' + s.turn ? ' · +1 CP' : ''}</button>
        <button type="button" class="btn cta ghost" data-reason="redraw" ${canRedraw ? '' : 'disabled'}>Discard and redraw (1 CP)</button>
      </div>`,
    actions: [{ label: 'Cancel', kind: 'ghost' }],
    onOpen: (el, close) => {
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-reason]');
        if (!b) return;
        close();
        (cur.ui.ctx || ctx).dispatch({ type: 'sec.discard', player: p, card, reason: b.dataset.reason });
      });
    }
  });
}

function openPhaseSetSheet() {
  const { ctx } = cur;
  const s = ctx.state;
  sheet({
    title: 'Set round / turn / phase',
    body: `<p class="muted small">Manual jump – logged as a warning. Pending scoring is discarded.</p>
      <div class="col">
        <label class="field"><span>Battle round</span><select name="round">${[1, 2, 3, 4, 5].map(r => `<option value="${r}"${r === Math.max(1, s.round) ? ' selected' : ''}>Round ${r}</option>`).join('')}</select></label>
        <label class="field"><span>Turn</span><select name="turn">${[0, 1].map(p => `<option value="${p}"${p === s.turn ? ' selected' : ''}>${esc(pName(s, p))}</option>`).join('')}</select></label>
        <label class="field"><span>Phase</span><select name="phase">${WH.PHASES.map(p => `<option value="${p.id}"${p.id === s.phase ? ' selected' : ''}>${esc(p.full)}</option>`).join('')}</select></label>
      </div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Set', kind: 'primary', onClick: (closeFn, el) => {
        const round = Number(el.querySelector('select[name=round]').value);
        const turn = Number(el.querySelector('select[name=turn]').value);
        const phase = el.querySelector('select[name=phase]').value;
        (cur.ui.ctx || ctx).dispatch({ type: 'phase.set', round, turn, phase });
      } }
    ]
  });
}

function openEndSheet() {
  const { ctx, ui } = cur;
  const s = ctx.state;
  if (s.stage !== 'battle') return;
  sheet({
    title: 'End battle',
    body: `<p class="muted small">Ends the battle now. Pending end-of-battle scoring is requested first; the game is over after the last confirmation.</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'End battle', kind: 'danger', cls: 'solid', onClick: () => {
        ui.dismissed = null;
        (cur.ui.ctx || ctx).dispatch({ type: 'game.end' }).then(r => {
          if (!r) return;
          if (r.pending && r.pending.kind === 'score' && r.pending.when !== 'end') toast('Confirm the open scoring first – the end-of-battle scoring follows.', 'warn', 5000);
          else if (r.pending && r.pending.kind === 'score') toast('Confirm the end-of-battle scoring – the game ends automatically afterwards.', 'warn', 5000);
          else toast('Battle ended', 'ok');
        });
      } }
    ]
  });
}

/* ═══════════════ Events ═══════════════ */
function bind(root) {
  if (root.__tableBound) return;
  root.__tableBound = true;
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.chip[data-action],li[data-action]')) { e.preventDefault(); onClick(e); }
  });
}

async function onClick(e) {
  const el = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el || el.disabled || el.classList.contains('disabled')) return;
  const { ctx, ui } = cur;
  const s = ctx.state, d = el.dataset, a = d.action;
  const p = d.p != null ? Number(d.p) : null;
  switch (a) {
    case 'tab': ui.tab = d.tab; return paint();
    case 'go': return ctx.nav(d.hash);
    case 'undo': return ctx.undo();
    case 'log-more': ui.logN += 100; return paint();
    case 'check': ui.checks[d.key] = !ui.checks[d.key]; return paint();
    case 'first': return ctx.dispatch({ type: 'mission.set', first: p });
    case 'battle': { const r = await ctx.dispatch({ type: 'stage.battle', track: true }); if (r) toast(`The battle begins – ${pName(r, r.turn)} takes the first turn`, 'ok', 3000); return; }
    case 'next': {
      if (s.pending) return openScoreSheet();
      ui.dismissed = null;
      return endTurn();
    }
    case 'phase-next': return nextPhase();
    case 'open-score': ui.dismissed = null; return openScoreSheet();
    case 'obj': {
      const o = (s.objectives || []).find(x => x.id === d.id);
      if (!o) return;
      const next = o.override == null ? 0 : o.override === 0 ? 1 : o.override === 1 ? 'none' : null;
      return ctx.dispatch({ type: 'objective.override', objectiveId: o.id, override: next });
    }
    case 'cond-bool': {
      const ci = Number(d.ci);
      const entries = bookedEntries(s, p, d.src, d.card, ci);
      if (entries.length) { for (const en of entries) { if (!(await (ui.ctx || ctx).dispatch({ type: 'score.remove', scoreId: en.id }))) return; } return; }
      const c = findCond(ctx, p, d.src, d.card, ci);
      return ctx.dispatch({ type: 'score.add', player: p, src: d.src, card: d.card, ci, vp: c ? c.vp : 0, when: 'manual' });
    }
    case 'cond-step': {
      const ci = Number(d.ci), delta = Number(d.delta);
      const c = findCond(ctx, p, d.src, d.card, ci);
      if (!c) return;
      // One trigger more/less: total = min(count × unit, max) – e.g. 2 VP each, max. 5: 0 → 2 → 4 → 5 and back
      const unit = Number(c.vp) || 1;
      const max = c.max != null ? Number(c.max) : Infinity;
      const booked = Number(c.scoredThisTurn) || 0;
      const n = Math.ceil(booked / unit);
      if (delta > 0) {
        const add = Math.min((n + 1) * unit, max) - booked;
        if (add <= 0) return;
        return ctx.dispatch({ type: 'score.add', player: p, src: d.src, card: d.card, ci, vp: add, when: 'manual' });
      }
      let remove = booked - Math.min(Math.max(n - 1, 0) * unit, max);
      const entries = bookedEntries(s, p, d.src, d.card, ci);
      let cur = ctx;
      for (let i = entries.length - 1; i >= 0 && remove > 0; i--) {
        const e = entries[i];
        if (!(await cur.dispatch({ type: 'score.remove', scoreId: e.id }))) return;
        cur = ui.ctx || ctx;
        remove -= e.vp;
      }
      // Removed too much (one big entry, e.g. 5 VP from the end-of-turn popup) → book the rest again
      if (remove < 0) return cur.dispatch({ type: 'score.add', player: p, src: d.src, card: d.card, ci, vp: -remove, when: 'manual' });
      return;
    }
    case 'cond-choice': return openChoiceSheet(p, d.src, d.card, Number(d.ci));
    case 'info': return openInfoSheet(p, d.src, d.card);
    case 'cond-info': return openCondInfo(p, d.src, d.card, Number(d.ci));
    case 'obj-info': return openObjInfo();
    case 'twist-info': return openTwistInfo(d.id);
    case 'phase-info': return openPhaseInfo();
    case 'caps-info': return openCapsInfo();
    case 'res-info': return openResInfo(p, Number(d.i));
    case 'dep-info': return openDepInfo(d.key);
    case 'sec-draw': return ctx.dispatch({ type: 'sec.draw', player: p, cardRule: true });
    case 'sec-achieve': {
      const name = (WH.SECONDARY[d.card] || { name: d.card }).name;
      if (await confirmSheet({ title: `"${name}" achieved?`, text: 'The card moves to the "achieved" pile. Book its points beforehand via the condition rows (or the end-of-turn scoring).', ok: 'Achieved', kind: 'primary' })) return (ui.ctx || ctx).dispatch({ type: 'sec.achieve', player: p, card: d.card });
      return;
    }
    case 'sec-discard': return openDiscardSheet(p, d.card);
    case 'sec-return': return ctx.dispatch({ type: 'sec.discard', player: p, card: d.card, reason: 'return', cardRule: true });
    case 'res': {
      const r = s.players[p].resources[Number(d.i)];
      if (!r) return;
      return ctx.dispatch({ type: 'resource.set', player: p, index: Number(d.i), value: (r.value || 0) + Number(d.delta) });
    }
    case 'cp': return ctx.dispatch({ type: 'cp.adjust', player: p, delta: Number(d.delta) });
    case 'cp-sheet': return openCpSheet(p);
    case 'phase-set': return openPhaseSetSheet();
    case 'end-game': return openEndSheet();
  }
}

function findCond(ctx, p, src, card, ci) {
  const sc = ((ctx.derived || {}).scoring || [])[p];
  if (!sc) return null;
  const list = src === 'primary' ? (sc.primary && sc.primary.card === card ? sc.primary.conds : []) : (((sc.secondaries || []).find(x => x.card === card) || {}).conds || []);
  return (list || []).find(c => c.ci === ci) || null;
}
