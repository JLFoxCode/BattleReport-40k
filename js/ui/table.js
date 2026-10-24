/* Score (Tablet in der Tischmitte, SPEC v4) – Route #/g/CODE/table, ctx.me = 'desktop'.
 * Beide Spieler bedienen dasselbe Gerät: Runde/Zug/Phase, Punkte, CP, Primär-/Sekundärwertung als antippbare
 * Bedingungszeilen, Missionsziele (Übersteuerung), „Nächste Phase“, Wertungs-Sheet, Reiter „Mehr“ (Verlauf, Korrekturen).
 * Kein Spielfeld, keine Einheiten. Export: render(root, ctx). Events: eine Delegation auf root (root.__tableBound).
 * UI-Zustand je Spielcode liegt in UI (überlebt Re-Renders bei jedem State-Push). */
import { WH } from '../../data/rules.js';
import { CORE } from '../../data/core.js';
import { reduce } from '../../engine/index.js';
import { esc, btn, badge, chip, sheet, confirmSheet, toast, colorOf } from './components.js';
import { prepareQr, qrReady, qrSvg, joinUrl } from './qr.js';
import { api } from '../net.js';
import { sequenceStrip } from './sequence.js';

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
  return entries.length ? `<dl class="info-dl" data-no-i18n>${entries.map(g => `<dt>${esc(g.title)}</dt><dd>${esc(g.text).replace(/\n/g, '<br>')}</dd>`).join('')}</dl>` : '';
}
function infoBtn(action, data, title = 'Info') {
  return btn({ icon: 'i', kind: 'ghost', cls: 'info', action, data, title });
}
function openTextSheet(title, bodyHtml, cls = '') {
  sheet({ title, cls, body: bodyHtml, actions: [{ label: 'Close', kind: 'ghost' }] });
}

const UI = {};
function uiFor(code) {
  return UI[code] || (UI[code] = { tab: 'score', sheet: null, ctx: null, dismissed: null, checks: {}, logN: 60, drafts: {}, waitKey: null, seen: {}, qrOpen: {}, presNet: null });
}
const scoreKey = it => it.src + '|' + it.card + '|' + (it.ci == null ? null : it.ci);

/** A toast with one action button (e.g. "Correct last scoring"); the toast never blocks the buttons underneath. */
function toastAction(msg, kind, label, fn, ms = 7000) {
  const kill = toast(msg, kind, ms);
  const host = document.querySelector('.toasts');
  const el = host && host.lastElementChild;
  if (el) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost sm toast-act'; b.textContent = label;
    b.addEventListener('click', ev => { ev.stopPropagation(); kill(); fn(); });
    el.appendChild(b);
    el.classList.add('has-act');
  }
  return kill;
}

/* Presence: the players' devices say "hello" (js/main.js) – their QR codes fold away on this device. */
function watchPresence(ctx) {
  const ui = cur.ui;
  if (!ctx.net || ui.presNet === ctx.net || typeof ctx.net.onSignal !== 'function') return;
  ui.presNet = ctx.net;
  ctx.net.onSignal(sig => {
    if (!sig || sig.type !== 'hello' || !(sig.me === 0 || sig.me === 1)) return;
    const was = Date.now() - (ui.seen[sig.me] || 0) < 60000;
    ui.seen[sig.me] = Date.now();
    ui.presSig = [0, 1].map(p => connected(ui, p)).join();
    if (!was && cur && cur.ui === ui && document.body.dataset.view === 'table') paint();
  });
  if (typeof ctx.net.signal === 'function') ctx.net.signal({ type: 'who' });
  // a phone that went quiet counts as gone after 60 s: the scoring sheet then opens here again
  if (!ui.presTimer) ui.presTimer = setInterval(() => {
    const sig = [0, 1].map(p => connected(ui, p)).join();
    if (sig === ui.presSig) return;
    ui.presSig = sig;
    if (cur && cur.ui === ui && document.body.dataset.view === 'table') { paint(); syncSheet(); }
  }, 5000);
}
const connected = (ui, p) => Date.now() - (ui.seen[p] || 0) < 60000;
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
  if (!ctx.spectator) watchPresence(ctx);
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
      ${sequenceStrip(ctx, !!uiFor(code).seqOpen)}
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
        ${btn({ label: 'Battle table (3D)', kind: 'ghost', action: 'go', data: { hash: `#/g/${code}/3d` }, title: 'The table as a 3D model: zones, objectives, terrain' })}
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
      ${sequenceStrip(ctx, !!ui.seqOpen)}
      <div class="card pad0">
        <ul class="list dep-list">
          ${item('roles', `<span class="text-p${att}">${esc(pName(s, att))}</span> is the Attacker · <span class="text-p${def}">${esc(pName(s, def))}</span> is the Defender`,
            'The Attacker uses the Attacker deployment zone of the deployment map, the Defender the opposite one.')}
          <li class="dep-item first ${first != null ? 'done' : ''}">
            <span class="ck">${first != null ? '✓' : ''}</span>
            <div class="main">
              <div class="name">Roll off for the first turn ${infoBtn('dep-info', { key: 'first' }, 'Rules text')}</div>
              <div class="sub">Roll off: both players roll, the winner takes the first turn. Pre-battle rules (e.g. Scouts) are resolved alternately afterwards, starting with the player taking the first turn.${first != null ? ` First turn: <b class="text-p${first}">${esc(pName(s, first))}</b>` : ''}</div>
              <div class="row first-row">${[0, 1].map(p => btn({ label: pName(s, p), kind: `p${p}`, cls: first === p ? '' : 'ghost', action: 'first', data: { p } })).join('')}</div>
              <div class="row qr-row">${[0, 1].map(p => connected(ui, p) && !ui.qrOpen[p]
                ? `<div class="qr-card p${p} qr-done"><div class="small"><b class="text-p${p}">✓ ${esc(pName(s, p))}</b>'s phone is connected</div>${btn({ label: 'Show QR code', kind: 'ghost', small: true, action: 'qr-show', data: { p } })}</div>`
                : `<div class="qr-card p${p}">${qrReady() ? qrSvg(joinUrl(code, p)) : '<div class="qr-wait xs muted">QR code loading…</div>'}<div class="xs muted">Scan to open the rules of <b class="text-p${p}">${esc(pName(s, p))}</b></div></div>`).join('')}</div>
            </div>
          </li>
        </ul>
      </div>
      <div class="mt">
        ${btn({ label: first != null ? `Start battle – ${pName(s, first)} takes the first turn` : 'Start battle (choose first turn first)', kind: 'primary', cta: true, action: 'battle', disabled: first == null })}
      </div>
      <div class="row mt">
        ${btn({ label: 'Go to setup', kind: 'ghost', action: 'go', data: { hash: `#/g/${code}/setup` } })}
        ${btn({ label: 'Battle table (3D)', kind: 'ghost', action: 'go', data: { hash: `#/g/${code}/3d` }, title: 'The table as a 3D model: zones, objectives, terrain' })}
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
      ${btn({ label: 'Battle table (3D)', kind: 'ghost', small: true, action: 'go', data: { hash: `#/g/${ctx.code}/3d` }, cls: 'tbl-3d', title: 'The table as a 3D model: zones, objectives, terrain' })}
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
        <button type="button" class="kpi lg p0 vp-btn" data-action="correct" data-p="0" title="Correct the last scoring of ${esc(pName(s, 0))}"><span class="kpi-value">${esc(vp[0].total)}</span><span class="kpi-label">${esc(pName(s, 0))}</span></button>
        <button class="cpbox" type="button" data-action="cp-sheet" data-p="0" aria-label="Adjust CP ${esc(pName(s, 0))}"><b>${esc(cp[0])}</b><span>CP</span></button>
      </div>
      <button type="button" class="head-mid" data-action="phase-info" title="Rules for the current phase">
        <div class="head-round"><span class="muted">Round</span> <b>${esc(s.round)}</b><span class="muted">/5</span> · <span class="muted">Turn</span> <b class="text-p${t}">${esc(pName(s, t))}</b></div>
        ${turnBlocks(s)}
        ${phaseStrip(s, idx)}
      </button>
      <div class="head-vp p1">
        <button class="cpbox" type="button" data-action="cp-sheet" data-p="1" aria-label="Adjust CP ${esc(pName(s, 1))}"><b>${esc(cp[1])}</b><span>CP</span></button>
        <button type="button" class="kpi lg p1 vp-btn" data-action="correct" data-p="1" title="Correct the last scoring of ${esc(pName(s, 1))}"><span class="kpi-value">${esc(vp[1].total)}</span><span class="kpi-label">${esc(pName(s, 1))}</span></button>
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

/** Undo group of one tablet press ("End turn" / "Next phase"): its automatic phase steps, the scoring confirmed on the
 *  way and the continuation share one id, so a single Undo takes the whole step back (server undoSpan()). */
const newGroup = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const grouped = a => (cur.ui.group ? Object.assign(a, { group: cur.ui.group }) : a);

/** End the current turn from the tablet: run through the remaining phases (stops at pending scorings, which reopen the sheet).
 *  cont = continued after a confirmed scoring (keeps the press's undo group). */
async function endTurn(cont) {
  const { ctx, ui } = cur;
  const c = () => (cur.ui.ctx || cur.ctx);
  let s = c().state;
  if (!s || s.stage !== 'battle') { ui.endingTurn = false; ui.group = null; return; }
  if (s.pending) { ui.endingTurn = true; return openScoreSheet(); }
  ui.endingTurn = true;
  if (!cont || !ui.group) ui.group = newGroup();
  const startRound = s.round, startTurn = s.turn;
  for (let i = 0; i < 8; i++) {
    // Command-phase scoring joins the end-of-turn sheet; both players' end-of-turn scoring in one sheet (merge)
    const r = await c().dispatch(grouped({ type: 'phase.next', endTurn: true, track: true, merge: true }));
    if (!r) { ui.endingTurn = false; ui.group = null; return; }
    if (r.pending) { ui.waitKey = pendingKey(r); return; }   // scoring sheet opens via syncSheet; maybeContinue() goes on
    if (r.stage !== 'battle' || r.round !== startRound || r.turn !== startTurn) break;
  }
  ui.endingTurn = false;
  ui.group = null;
}

function ctaHtml(ctx) {
  const s = ctx.state;
  if (s.stage !== 'battle') return '';
  if (s.pending && s.pending.kind === 'score') {
    const ps = openParts(s).map(x => x.player).filter((p, i, a) => a.indexOf(p) === i);
    // the players' phones are connected: they confirm there – the tablet waits (and can still confirm here)
    if (!ctx.spectator && phonesConfirm(s)) {
      return `<div class="cta-row"><div class="cta-wait">Waiting for ${ps.map(p => `<b class="text-p${p}">${esc(pName(s, p))}</b>`).join(' & ')} to confirm on ${ps.length > 1 ? 'their phones' : 'their phone'}</div>
        ${btn({ label: 'Confirm here', kind: 'ghost', action: 'open-score', cls: 'cta-side' })}</div>`;
    }
    return btn({ label: `Confirm scoring – ${ps.map(p => pName(s, p)).join(' & ')}`, kind: ps.length === 1 ? `p${ps[0]}` : 'primary', cta: true, action: 'open-score', cls: 'pulse-soft' });
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
  ui.group = newGroup();
  const r = await (ui.ctx || ctx).dispatch(grouped({ type: 'phase.next', track: true, merge: true }));
  if (!r || !r.pending) ui.group = null;      // a scoring that blocks the step keeps the group for the continuation
  else ui.waitKey = pendingKey(r);
  return r;
}

/** The open parts of the pending scoring: merged (pending.parts) or the single classic one. */
function openParts(s) {
  const pend = s && s.pending;
  if (!pend || pend.kind !== 'score') return [];
  if (Array.isArray(pend.parts)) return pend.parts.filter(x => !x.done);
  return [{ player: pend.player, when: pend.when, key: pend.key, items: pend.items || [] }];
}
const partsSig = s => openParts(s).map(x => x.key).join('+');
/** Every player with an open part has their phone connected → they confirm there; the tablet does not push its sheet. */
const phonesConfirm = s => { const ps = openParts(s).map(x => x.player); return ps.length > 0 && ps.every(p => connected(cur.ui, p)); };

/** The pending scoring the tablet waits for (after End turn / Next phase) is resolved – by the tablet's Confirm or by the
 *  players on their phones: go on with the step (the whole turn, or one phase). Runs once per scoring. */
function maybeContinue() {
  const { ui } = cur;
  const c = ui.ctx || cur.ctx;
  const s = c.state;
  if (!ui.waitKey || !s || (s.pending && pendingKey(s) === ui.waitKey)) return;
  ui.waitKey = null;
  if (s.stage !== 'battle') { ui.group = null; ui.endingTurn = false; return; }
  if (s.pending) { ui.waitKey = pendingKey(s); return; }   // a new scoring followed (e.g. end of battle) – its own sheet
  if (ui.endingTurn) { endTurn(true); return; }
  c.dispatch(grouped({ type: 'phase.next', track: true, merge: true })).then(r => {
    if (r && r.pending) ui.waitKey = pendingKey(r); else ui.group = null;
  });
}

/* ───────── Reiter Score ───────── */
function scoreTab(ctx, ui) {
  // Objective strip: who holds which marker – persists between turns and pre-fills the objective rows of the scoring sheet
  return `
    ${noticesHtml(ctx)}
    ${objectivesHtml(ctx)}
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
  const pos = anyPositions(s);
  return `
    <div class="objs-head"><span class="xs muted">Objective control · tap a marker: ${esc(pName(s, 0))} → ${esc(pName(s, 1))} → ${pos ? 'none → auto' : 'nobody'} · stays set between turns and pre-fills the scoring</span>${infoBtn('obj-info', {}, 'Objective control rules')}
      ${twist ? `<span class="spacer"></span><span class="xs"><b>Twist:</b> ${esc(twist.name)}</span>${infoBtn('twist-info', { id: twist.id }, 'Twist')}` : ''}</div>
    <section class="tbl-objs">
      ${objs.map(o => {
        const c = ctrl[o.id] ? ctrl[o.id].ctrl : o.ctrl;
        const who = c === 0 || c === 1 ? c : null;
        const label = o.kind === 'home' ? `Home ${o.home != null ? pName(s, o.home) : ''}` : o.kind === 'exp' ? (o.id === 'o3' ? 'Exp. 1' : 'Exp. 2') : 'Centre';
        const mode = !pos ? '' : o.override == null ? 'Auto' : o.override === 'none' ? 'None' : 'Manual';
        return `<button type="button" class="obj ${who != null ? 'p' + who + ' held' : 'free'} ${o.override == null ? 'auto' : ''}" data-action="obj" data-id="${esc(o.id)}" title="${esc(o.name)}">
          <span class="obj-label">${esc(label)}</span>
          <span class="obj-who">${who != null ? esc(pName(s, who)) : 'free'}</span>
          <span class="obj-mode">${esc(mode)}</span>
        </button>`;
      }).join('')}
    </section>`;
}

/** Units placed on a battlefield map (map view): only then does "auto" control mean anything. */
const anyPositions = s => (s.players || []).some(pl => (pl.units || []).some(u => u.pos));

/** Non-modal lines above the score: "+1 CP" rule offers (Add / Skip – never booked by themselves) and, after round 1,
 *  the active player's Fixed Missions instead of a popup. */
function noticesHtml(ctx) {
  const s = ctx.state, out = [];
  for (const o of s.cpOffers || []) {
    const cond = o.req === 'warlord' ? `only if your WARLORD (${o.unitName}) is on the battlefield` : `only if ${o.unitName} is on the battlefield`;
    out.push(`<div class="tbl-note p${o.player}"><span class="tbl-note-t"><b class="text-p${o.player}">${esc(pName(s, o.player))}</b> · ${esc(o.name)}: +${esc(o.cp)} CP? <span class="muted">(${esc(cond)})</span></span>
      <span class="tbl-note-act">${btn({ label: 'Add', kind: `p${o.player}`, small: true, action: 'cp-offer', data: { p: o.player, id: o.id, ok: 1 } })}${btn({ label: 'Skip', kind: 'ghost', small: true, action: 'cp-offer', data: { p: o.player, id: o.id, ok: 0 } })}</span></div>`);
  }
  const p = s.turn, sec = (s.players[p] && s.players[p].secondaries) || {};
  if (s.stage === 'battle' && sec.mode === 'fixed' && s.round > 1 && s.phase === 'command' && (sec.fixed || []).length) {
    out.push(`<div class="tbl-note p${p}"><span class="tbl-note-t">Start of <b class="text-p${p}">${esc(pName(s, p))}</b>'s turn · Fixed Secondary Missions: ${esc(sec.fixed.map(id => (WH.SECONDARY[id] || { name: id }).name).join(' · '))}</span></div>`);
  }
  return out.length ? `<div class="tbl-notes">${out.join('')}</div>` : '';
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
    const drawnHint = drawnHintShown(s, p, c.card) ? `<div class="xs text-warn sec-hint"><span class="rule-text">${esc(c.drawn.text)}</span>${drawnExtra(s, p, c.card)}</div>` : '';
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
          ${btn({ label: 'Correct last scoring', kind: 'ghost', action: 'correct' })}
          ${btn({ label: 'Move host to another device…', kind: 'ghost', action: 'move-host' })}
          ${btn({ label: 'Back to setup', kind: 'ghost', action: 'go', data: { hash: `#/g/${ctx.code}/setup` } })}
          <a class="btn ghost" href="#/">Lobby</a>
          ${ctx.spectator ? '' : btn({ label: 'Delete this game', kind: 'danger', action: 'delete-game', title: 'Removes the game from the host – all devices leave it' })}
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
/** Key of the pending scoring: the merged set (mkey) stays the same while the players confirm their parts. */
function pendingKey(s) { const p = s.pending; return p ? (p.mkey || p.key || `${s.round}:${s.turn}:${p.when}:${p.player}`) : null; }

/** Nach jedem State-Push: Wertungs-Sheet öffnen/schließen. */
function syncSheet() {
  const { ctx, ui } = cur;
  if (ctx.spectator) return;   // spectators never get the scoring / draw popups
  const s = ctx.state;
  const key = s && s.pending && s.pending.kind === 'score' && s.stage === 'battle' ? pendingKey(s) : null;
  const closeSheet = () => { const sh = ui.sheet; ui.sheet = null; sh.close(); };   // not a dismissal by the user
  // closed when resolved; rebuilt when a player confirmed their part on the phone (edits of the rest are kept)
  if (ui.sheet && ui.sheet.kind === 'score' && (ui.sheet.key !== key || ui.sheet.sig !== partsSig(s))) closeSheet();
  if (key && ui.sheet && ui.sheet.kind === 'draw') closeSheet();   // scoring takes precedence
  // the sheet opens by itself only when a player of the scoring has no phone connected (else "Waiting for … / Confirm here")
  if (key && !ui.sheet && ui.dismissed !== key && !phonesConfirm(s)) { openScoreSheet(); return; }
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
      // Fixed Missions: the popup only in round 1 – later a line above the score (noticesHtml)
      if (!(sec.mode === 'fixed' && s.round > 1)) openDrawSheet(p);
    }
  }
  maybeContinue();
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
    ${def.note ? `<p class="small"><b>Action:</b> <span class="rule-text">${esc(def.note)}</span></p>` : ''}
    ${drawnHintShown(s, p, card) ? `<p class="small text-warn"><b>When drawn:</b> <span class="rule-text">${esc(def.drawn.text)}</span>${drawnExtra(s, p, card)}</p>` : ''}
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
function returnBtn(s, p, card, strong) {
  if (!canReturnCard(s, p, card)) return '';
  const discard = WH.SECONDARY[card].drawn.kind === 'target';
  return ' ' + btn({ label: discard ? 'Discard & draw a new card' : 'Draw a new card & shuffle this back', kind: strong ? `p${p}` : 'ghost', small: true, action: 'sec-return', data: { p, card } });
}
/** A Grievous Blow / Bring It Down without a target in the opponent's army list: suggested (the players decide – the
 *  list does not say what is on the battlefield). null = cannot tell (no list). */
function noTarget(s, p, card) {
  const d = (WH.SECONDARY[card] || {}).drawn;
  if (!d || d.kind !== 'target') return null;
  const opp = (s.players[1 - p].units || []).filter(u => u.status !== 'destroyed');
  if (!opp.length) return null;
  if (card === 'grievous_blow') return !opp.some(u => Number(u.modelsStart || u.models) >= 13);
  if (card === 'bring_it_down') return !opp.some(u => Number(u.wounds) >= 10);
  return null;
}
/** Picked units of Beacon / Burden of Trust (stored as player effects 'sec:<card>'). */
function pickedText(s, p, card) {
  const e = ((s.players[p].effects || {})['sec:' + card] || {}).value;
  if (e == null) return '';
  const unit = id => ((s.players[p].units || []).find(u => u.id === id) || { name: '?' }).name;
  if (card === 'beacon') return 'Beacon unit: ' + unit(String(e));
  const objName = id => { const o = (s.objectives || []).find(x => x.id === id); return o ? objLabel(s, o) : id; };
  const list = (Array.isArray(e) ? e : []).map(x => String(x).split(':')).map(([o, u]) => objName(o) + ' – ' + unit(u));
  return list.length ? 'Guards: ' + list.join(' · ') : '';
}
/** What the "when drawn" rule asks for, as buttons: discard / shuffle back, select the beacon unit / the guards. */
function drawnExtra(s, p, card) {
  const d = (WH.SECONDARY[card] || {}).drawn || {};
  const nt = noTarget(s, p, card);
  let out = nt ? `<span class="sec-nt"> No unit in ${esc(pName(s, 1 - p))}'s army list qualifies.</span>` : '';
  out += returnBtn(s, p, card, nt);
  if ((d.kind === 'unit' || d.kind === 'guard') && (s.players[p].units || []).length) {
    const pick = pickedText(s, p, card);
    out += `${pick ? `<span class="sec-picked"> ${esc(pick)}.</span>` : ''} ` + btn({ label: d.kind === 'unit' ? (pick ? 'Change beacon unit' : 'Select beacon unit') : (pick ? 'Change guards' : 'Select guards'), kind: pick ? 'ghost' : `p${p}`, small: true, action: 'sec-pick', data: { p, card } });
  }
  return out;
}
const objLabel = (s, o) => (o.kind === 'home' ? `Home ${o.home != null ? pName(s, o.home) : ''}` : o.kind === 'exp' ? (o.id === 'o3' ? 'Expansion 1' : 'Expansion 2') : 'Centre');

/** Beacon: one friendly unit; Burden of Trust: one friendly unit per objective (player effect 'sec:<card>'). */
function openPickSheet(p, card, after) {
  const c = cur.ui.ctx || cur.ctx;
  const s = c.state;
  const units = (s.players[p].units || []).filter(u => u.status !== 'destroyed');
  const cur0 = ((s.players[p].effects || {})['sec:' + card] || {}).value;
  const def = WH.SECONDARY[card] || { name: card };
  const done = async value => {
    const display = value == null ? null : card === 'beacon' ? (units.find(u => u.id === value) || {}).name : value.map(x => { const [o, u] = x.split(':'); const ob = (s.objectives || []).find(y => y.id === o); return (ob ? objLabel(s, ob) : o) + ': ' + ((units.find(y => y.id === u) || {}).name || u); }).join(', ');
    const r = await c.dispatch({ type: 'effect.set', player: p, key: 'sec:' + card, value, label: def.name + (card === 'beacon' ? ' – beacon unit' : ' – guards'), display });
    if (r && after) after();
  };
  if (card === 'beacon') {
    sheet({
      title: `${def.name} – select the beacon unit`, cls: 'p' + p,
      body: `<p class="small muted rule-text">${esc(def.drawn ? def.drawn.text : '')}</p><div class="col pick-list">${units.map(u => `<button type="button" class="btn ${cur0 === u.id ? `p${p}` : 'ghost'} cta" data-unit="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>`,
      actions: [{ label: 'Cancel', kind: 'ghost' }],
      onOpen: (el, close) => el.addEventListener('click', e => { const b = e.target.closest('[data-unit]'); if (!b) return; close(); done(b.dataset.unit); })
    });
    return;
  }
  const have = {};
  for (const x of Array.isArray(cur0) ? cur0 : []) { const [o, u] = String(x).split(':'); have[o] = u; }
  const objs = (s.objectives || []);
  sheet({
    title: `${def.name} – select the guards`, cls: 'p' + p,
    body: `<p class="small muted rule-text">${esc(def.drawn ? def.drawn.text : '')}</p>
      ${objs.map(o => `<label class="field"><span>${esc(objLabel(s, o))}</span><select name="${esc(o.id)}"><option value="">– no guard –</option>${units.map(u => `<option value="${esc(u.id)}"${have[o.id] === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`).join('') || '<p class="muted small">No objective markers (deployment map missing).</p>'}`,
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: (close, el) => {
      const v = objs.map(o => { const sel = el.querySelector(`select[name="${o.id}"]`); return sel && sel.value ? o.id + ':' + sel.value : null; }).filter(Boolean);
      done(v.length ? v : null);
    } }]
  });
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
        const pk = e.target.closest('[data-action="sec-pick"]');
        if (pk) { openPickSheet(p, pk.dataset.card, () => { if (el.isConnected) el.querySelector('.sheet-body').innerHTML = body(); }); return; }
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

/* ───────── Scoring editor (shared by the end-of-turn sheet and the correction sheet) ─────────
 * Two kinds of input only (user decision): a toggle that lights up when the condition is met – named stages (e.g.
 * Cleanse "one objective" / "two or more") get one toggle each – and "X VP each" as a counter (− n +) up to the max.
 * A section = one player: { player, label, note, items: [{ src, card, ci, name, text, k, unit, opts, max, vp, n, already, when }], mod }. */
const maxOf = it => (it.max != null ? Number(it.max) : 15);
function condOfItem(ctx, p, it) {
  const sc = ((ctx.derived || {}).scoring || [])[p];
  if (!sc) return null;
  if (it.src === 'primary') return sc.primary && sc.primary.card === it.card ? (sc.primary.conds || []).find(c => c.ci === it.ci) || null : null;
  const sec = (sc.secondaries || []).find(x => x.card === it.card);
  return sec ? (sec.conds || []).find(c => c.ci === it.ci) || null : null;
}
function editorRow(sec, si, it, i) {
  const yesNo = (vp, on) => `<button type="button" class="score-tog${on ? ' on' : ''}" data-opt="${esc(vp)}" aria-pressed="${on}">${on ? '✓ Achieved' : 'Not achieved'}</button>`;
  let ctl, sub = '';
  if (it.opts) {
    ctl = `<div class="score-stages">${it.opts.map(o => { const v = Number(o.vp) || 0;
      return `<div class="score-stage"><span class="score-stage-t"><span class="rule-text">${esc(o.t)}</span> <b class="score-stage-vp">· ${esc(v)} VP</b></span>${yesNo(v, it.vp === v)}</div>`; }).join('')}</div>`;
  } else if (it.k === 'per') {
    sub = `${esc(it.unit)} VP each${it.max != null ? ` · max. ${esc(it.max)} VP` : ''}`;
    ctl = `<div class="score-count"><div class="stepper sm p${sec.player}">
        <button type="button" data-n="-1" ${it.n <= 0 ? 'disabled' : ''} aria-label="Fewer">−</button>
        <span class="stepper-value">${esc(it.n)}</span>
        <button type="button" data-n="1" ${it.vp >= maxOf(it) ? 'disabled' : ''} aria-label="More">+</button>
      </div><span class="score-eq">= <b>${esc(it.vp)} VP</b></span></div>`;
  } else {
    sub = `${esc(it.unit)} VP`;
    ctl = yesNo(it.unit, it.vp > 0);
  }
  const hints = [sub, it.already && !sec.absolute ? `<span class="text-ok">${esc(it.already)} VP already booked</span>` : '', it.prefill ? '<span class="text-warn">pre-filled from the objective strip – check</span>' : ''].filter(Boolean);
  return `<div class="score-item" data-s="${si}" data-i="${i}">
    <div class="score-main">
      <div class="score-card">${badge(SRC_LABEL[it.src] || it.src, it.src === 'primary' ? 'ok' : 'warn')} <b>${esc(it.name)}</b></div>
      <div class="score-text">${esc(it.text || '')}</div>
      ${hints.length ? `<div class="score-sub muted xs">${hints.join(' · ')}</div>` : ''}
    </div>
    <div class="score-ctl2">${ctl}</div>
  </div>`;
}
function editorHtml(sections) {
  return sections.map((sec, si) => `<section class="score-sec p${sec.player}">
    ${sections.length > 1 || sec.label ? `<h3 class="score-sec-h"><b class="text-p${sec.player}">${esc(sec.pname)}</b> <span class="muted small">· ${esc(sec.label || '')}</span></h3>` : ''}
    ${sec.note ? `<p class="muted xs score-sec-note">${sec.note}</p>` : ''}
    <div class="score-list">${sec.items.map((it, i) => editorRow(sec, si, it, i)).join('') || '<p class="muted small">Nothing to score right now.</p>'}</div>
    <div class="score-item score-mod" data-s="${si}">
      <div class="score-main"><div class="score-card"><b>Modifier</b></div><div class="score-text muted small">Manual correction for anything the list above cannot express (booked as a separate entry).</div></div>
      <div class="score-ctl"><div class="stepper sm p${sec.player}">
        <button type="button" data-mod="-1" ${sec.mod.vp <= -15 ? 'disabled' : ''} aria-label="Less">−</button>
        <span class="stepper-value">${sec.mod.vp > 0 ? '+' : ''}${esc(sec.mod.vp)}</span>
        <button type="button" data-mod="1" ${sec.mod.vp >= 15 ? 'disabled' : ''} aria-label="More">+</button>
      </div></div>
    </div>
  </section>`).join('');
}
/** A tap in the editor → true when something changed. */
function editorClick(sections, e) {
  const row = e.target.closest('.score-item');
  if (!row || row.dataset.s == null) return false;
  const sec = sections[Number(row.dataset.s)];
  if (!sec) return false;
  const m = e.target.closest('[data-mod]');
  if (m) { sec.mod.vp = Math.max(-15, Math.min(15, sec.mod.vp + Number(m.dataset.mod))); return true; }
  const n = e.target.closest('[data-n]'), o = e.target.closest('[data-opt]');
  if (!n && !o) return false;
  const it = sec.items[Number(row.dataset.i)];
  if (!it) return false;
  if (n) { it.n = Math.max(0, it.n + Number(n.dataset.n)); it.vp = Math.min(maxOf(it), it.n * it.unit); if (Number(n.dataset.n) > 0 && it.vp >= maxOf(it)) it.n = Math.ceil(it.vp / it.unit); }
  else if (it.opts) { const v = Number(o.dataset.opt) || 0; it.vp = it.vp === v ? 0 : v; }
  else it.vp = it.vp > 0 ? 0 : it.unit;
  it.prefill = false;
  return true;
}
/** Editor row from a pending / logged item: VP unit from the card, stages, max; vp = the value to show. */
function editorItem(ctx, p, it, vp, already) {
  let c = condOfItem(ctx, p, it);
  if (!c && it.src !== 'bonus') {
    // card no longer active (e.g. achieved and discarded): VP, stages and max straight from the card data
    const def = (it.src === 'primary' ? WH.PRIMARY : WH.SECONDARY)[it.card];
    const d = def && (def.c || [])[it.ci];
    const fixed = ctx.state.players[p].secondaries.mode === 'fixed';
    const vpT = v => (v && typeof v === 'object' ? Number(fixed ? v.F : v.T) : Number(v));
    if (d) c = { vp: d.k === 'choice' ? null : vpT(d.vp), opts: d.k === 'choice' ? (d.opts || []).map(o => ({ t: o.t, vp: vpT(o.vp) })) : null, max: d.max };
  }
  const unit = c && c.vp != null ? Number(c.vp) : it.unit != null ? Number(it.unit) : (it.max != null && it.k !== 'per' && it.src === 'bonus' ? Number(it.max) : (it.vp != null && it.k !== 'per' ? Number(it.vp) : 0));
  return Object.assign({}, it, { vp, already, unit, n: unit > 0 ? Math.round(vp / unit) : 0, opts: c && c.opts ? c.opts : (it.opts || null), max: c && c.max != null ? Number(c.max) : (it.max != null ? Number(it.max) : null) });
}

function openScoreSheet() {
  const { ctx, ui } = cur;
  const s = ctx.state;
  const pend = s.pending;
  if (!pend || pend.kind !== 'score') { toast('No scoring pending', 'warn'); return; }
  const key = pendingKey(s), sig = partsSig(s);
  if (ui.sheet && ui.sheet.kind === 'score' && ui.sheet.key === key && ui.sheet.sig === sig) return;
  if (ui.sheet) { const sh = ui.sheet; ui.sheet = null; sh.close(); }
  const parts = openParts(s);
  const merged = Array.isArray(pend.parts);
  const players = parts.map(x => x.player).filter((p, i, a) => a.indexOf(p) === i);
  const WHEN = { cmd: 'End of Command phase', turn: 'End of turn', end: 'End of the battle' };
  // one section per player (their end-of-turn / reactive / end-of-battle parts together)
  const sections = players.map(p => {
    const mine = parts.filter(x => x.player === p);
    const whens = mine.map(x => x.when);
    const label = whens.includes('turn') && whens.includes('end') ? (p === s.turn ? 'End of turn and end of the battle' : `End of ${pName(s, s.turn)}'s turn and end of the battle`)
      : whens[0] === 'end' ? 'End of the battle' : whens[0] === 'cmd' ? 'End of Command phase'
      : p === s.turn ? 'End of your turn' : `Missions that score at the end of ${pName(s, s.turn)}'s turn`;
    const draft = ui.drafts[key + '|' + p];
    const items = mine.flatMap(part => part.items.map(it => {
      const c = condOfItem(ctx, p, it);
      const already = c ? Number(c.scoredThisTurn) || 0 : 0;
      // objective control (strip) pre-fills; kills, actions and markers stay at "nothing" until tapped
      const pre = it.obj && Number(it.suggest) > 0;
      const vp = draft && draft.vp[scoreKey(it)] != null ? draft.vp[scoreKey(it)] : (pre ? already + Number(it.suggest) : already);
      return Object.assign(editorItem(ctx, p, it, vp, already), { when: part.when, prefill: !draft && pre });
    }));
    return { player: p, pname: pName(s, p), label: merged || players.length > 1 ? label : (WHEN[pend.when] || pend.when) + ' · Round ' + s.round, items, mod: { vp: draft ? draft.mod : 0 },
      note: merged ? `${esc(pName(s, p))} can also confirm this part on their own phone.` : '' };
  });
  const saveDrafts = () => { for (const sec of sections) ui.drafts[key + '|' + sec.player] = { vp: Object.fromEntries(sec.items.map(it => [scoreKey(it), it.vp])), mod: sec.mod.vp }; };
  // What the confirm books per player: only the difference to the score page; lowered rows unbook their entries first
  const plans = () => sections.map(sec => {
    const delta = sec.items.map(it => Object.assign({}, it, { vp: it.vp - (it.already || 0) }));
    return { player: sec.player, dec: delta.filter(it => it.vp < 0), add: delta.filter(it => it.vp > 0).concat(sec.mod.vp ? [{ src: 'bonus', card: 'modifier', ci: null, vp: sec.mod.vp }] : []) };
  });
  const strip = list => list.map(it => ({ src: it.src, card: it.card, ci: it.ci, vp: it.vp }));
  const confirmAction = pl => (merged
    ? { type: 'score.confirm', parts: pl.map(x => ({ player: x.player, items: strip(x.add) })), achieve: true }
    : { type: 'score.confirm', player: pl[0].player, items: strip(pl[0].add), achieve: true });
  // VP actually booked after the caps (15 per round, 45 Primary / Secondary, 20 per Fixed card – 100 in all): the same
  // steps run through the engine on a copy of the state. null = cannot tell.
  const cappedVp = () => {
    try {
      const st0 = (cur.ui.ctx || cur.ctx).state;
      if (!st0 || !st0.pending || pendingKey(st0) !== key) return null;
      const sum = (st, p) => (st.scores || []).filter(x => x.player === p).reduce((a, x) => a + (Number(x.vp) || 0), 0);
      const pl = plans();
      let st = st0;
      for (const x of pl) for (const id of unbookIds(st0, x.player, x.dec)) st = reduce(st, { type: 'score.remove', scoreId: id });
      st = reduce(st, confirmAction(pl));
      return sections.map(sec => sec.items.reduce((a, i) => a + (i.already || 0), 0) + sum(st, sec.player) - sum(st0, sec.player));
    } catch { return null; }
  };
  const totalHtml = () => {
    const capped = cappedVp();
    return sections.map((sec, i) => {
      const raw = sec.items.reduce((a, it) => a + it.vp, 0) + sec.mod.vp;
      const shown = capped == null ? raw : capped[i];
      return `<span class="score-total-p"><span class="text-p${sec.player}">${esc(sec.pname)}</span> ${capped != null && shown !== raw ? `<small class="muted score-uncapped">(${raw} before the caps)</small> ` : ''}<b>${shown} VP</b></span>`;
    }).join('<span class="muted"> · </span>');
  };
  const close = sheet({
    title: players.length > 1 ? `Scoring – ${players.map(p => pName(s, p)).join(' & ')} · Round ${s.round}` : `Scoring – ${pName(s, players[0])} · ${sections[0].label}`,
    cls: 'tbl-score' + (players.length === 1 ? ' p' + players[0] : ''),
    body: editorHtml(sections),
    actions: [
      { label: players.length > 1 ? 'Confirm scoring (both players)' : 'Confirm scoring', kind: 'primary', cta: true, onClick: async () => {
        const pl = plans();
        for (const x of pl) if (x.dec.length) await unbookFor(x.player, x.dec);
        for (const sec of sections) delete ui.drafts[key + '|' + sec.player];
        if (!ui.waitKey) ui.waitKey = key;   // reopened after a reload: go on by one step afterwards
        await confirmScore(pl, confirmAction);
      } }
    ],
    onOpen: el => {
      const foot = el.querySelector('.sheet-foot');
      const tot = document.createElement('div'); tot.className = 'score-total foot-total'; tot.innerHTML = `<span>Total</span><span class="score-total-v">${totalHtml()}</span>`;
      if (foot) foot.parentNode.insertBefore(tot, foot);
      el.addEventListener('click', e => {
        if (!editorClick(sections, e)) return;
        saveDrafts();
        el.querySelector('.sheet-body').innerHTML = editorHtml(sections);
        tot.innerHTML = `<span>Total</span><span class="score-total-v">${totalHtml()}</span>`;
      });
    },
    onClose: () => { if (ui.sheet && ui.sheet.key === key) { ui.sheet = null; ui.dismissed = key; } }
  });
  ui.sheet = { kind: 'score', key, sig, close };
}

/** Score-page bookings of this turn to remove for conditions the popup lowered (newest entries first). */
function unbookIds(s, player, list) {
  const ids = [];
  for (const it of list) {
    let need = -it.vp;
    const entries = (s.scores || []).filter(x => x.player === player && x.src === it.src && x.card === it.card && x.ci === it.ci && x.round === s.round && x.turn === s.turn).reverse();
    for (const e of entries) { if (need <= 0) break; ids.push(e.id); need -= e.vp; }
  }
  return ids;
}
async function unbookFor(player, list) {
  const c = cur.ui.ctx || cur.ctx;
  for (const id of unbookIds(c.state, player, list)) await c.dispatch(grouped({ type: 'score.remove', scoreId: id }));
}

/** One Confirm for all sections; the step goes on via maybeContinue() (also when the phones confirmed). */
async function confirmScore(plans, actionOf) {
  const c = cur.ui.ctx || cur.ctx;
  // the VP actually booked (after the caps), not the sum asked for
  const booked = (st, p) => (st.scores || []).filter(x => x.player === p).reduce((a, x) => a + (Number(x.vp) || 0), 0);
  const st0 = c.state;
  const before = plans.map(x => booked(st0, x.player));
  const s = await c.dispatch(grouped(actionOf(plans)));
  if (!s) return;
  const msg = plans.map((x, i) => `${booked(s, x.player) - before[i]} VP for ${pName(s, x.player)}`).join(' · ');
  const who = plans.map(x => x.player);
  toastAction(`Scoring confirmed: ${msg}`, 'ok', 'Correct last scoring', () => openCorrectSheet(who.length === 1 ? who[0] : null), 6000);
  maybeContinue();
}

/** The last scoring a player confirmed (from the log: the checkpoint entry lists its conditions) → { round, turn, when, items }. */
function lastScoringOf(s, p) {
  const log = s.log || [];
  for (let i = log.length - 1; i >= 0; i--) {
    const l = log[i];
    if (l.player !== p || !l.data || !Array.isArray(l.data.items) || !l.data.when) continue;
    // all checkpoint entries of that player in the same round / turn (end of turn + end of battle)
    const same = log.filter(x => x.player === p && x.data && Array.isArray(x.data.items) && x.data.when && x.round === l.round && x.turn === l.turn);
    const items = [];
    for (const x of same) for (const it of x.data.items) if (!items.some(y => scoreKey(y) === scoreKey(it))) items.push(Object.assign({}, it, { when: x.data.when }));
    return { round: l.round, turn: l.turn, items };
  }
  return null;
}

/** Correct a confirmed scoring (a forgotten / wrong tick): the sheet of that turn pre-filled with what is booked; Save
 *  books only the corrections (score.correct) – no undo of the whole End-turn step. p = null → choose the player. */
function openCorrectSheet(p) {
  const c = cur.ui.ctx || cur.ctx;
  const s = c.state;
  if (p == null) {
    sheet({ title: 'Correct last scoring', body: `<div class="col">${[0, 1].map(q => `<button type="button" class="btn p${q} cta" data-q="${q}">${esc(pName(s, q))}</button>`).join('')}</div>`,
      actions: [{ label: 'Cancel', kind: 'ghost' }],
      onOpen: (el, close) => el.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) { close(); openCorrectSheet(Number(b.dataset.q)); } }) });
    return;
  }
  if (openParts(s).some(x => x.player === p)) { cur.ui.dismissed = null; openScoreSheet(); return; }   // still open: just score
  const last = lastScoringOf(s, p);
  if (!last) { toast(`${pName(s, p)} has no confirmed scoring to correct yet – book points on the condition rows.`, 'warn', 4000); return; }
  const have = it => (s.scores || []).filter(x => x.player === p && x.src === it.src && x.card === it.card && (x.ci == null ? null : x.ci) === (it.ci == null ? null : it.ci) && x.round === last.round && x.turn === last.turn).reduce((a, x) => a + x.vp, 0);
  const items = last.items.map(it => { const v = have(it); return Object.assign(editorItem(cur.ctx, p, it, v, v), { when: it.when }); });
  const modNow = have({ src: 'bonus', card: 'modifier', ci: null });
  const sec = { player: p, pname: pName(s, p), label: `Round ${last.round} · ${pName(s, last.turn)}'s turn`, items, mod: { vp: modNow }, absolute: true,
    note: 'Shows what is booked for that turn. Change what was wrong – only the difference is booked.' };
  const sections = [sec];
  sheet({
    title: `Correct scoring – ${pName(s, p)}`, cls: 'tbl-score p' + p,
    body: editorHtml(sections),
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save correction', kind: 'primary', onClick: async () => {
      const changed = items.filter(it => it.vp !== it.already);
      const byWhen = {};
      for (const it of changed) (byWhen[it.when] || (byWhen[it.when] = [])).push({ src: it.src, card: it.card, ci: it.ci, vp: it.vp });
      if (sec.mod.vp !== modNow) (byWhen.turn || (byWhen.turn = [])).push({ src: 'bonus', card: 'modifier', ci: null, vp: sec.mod.vp });
      const whens = Object.keys(byWhen);
      if (!whens.length) { toast('No change', 'ok', 1500); return; }
      let ok = true;
      for (const w of whens) ok = !!(await (cur.ui.ctx || c).dispatch({ type: 'score.correct', player: p, round: last.round, turn: last.turn, when: w, items: byWhen[w], achieve: true })) && ok;
      if (ok) toast(`Scoring of ${pName(s, p)} corrected`, 'ok');
    } }],
    onOpen: el => el.addEventListener('click', e => { if (editorClick(sections, e)) el.querySelector('.sheet-body').innerHTML = editorHtml(sections); })
  });
}

/** Shared device: how to move the host role (the server) to another device – e.g. from the phone the game was started on. */
function openMoveHostSheet() {
  const code = cur.ctx.code;
  openTextSheet('Move host to another device', `
    <p class="small">The game runs on the device that created it. To move it to this tablet / PC or another one (e.g. when the phone that hosts it must leave the table):</p>
    <ol class="info-ol" data-i18n>
      <li>On the device that should host the game, open Battle Report 40k (the app – Android or Windows).</li>
      <li>On a tablet or PC the home screen shows “Take over game ${esc(code)}”; otherwise go to <b>Join game</b> → <b>Games nearby</b> and tap <b>Take over as host</b> on game ${esc(code)}.</li>
      <li>All connected devices switch to the new host by themselves, in the same role. The old device keeps a read-only copy.</li>
    </ol>
    <p class="xs muted">Both devices must be in the same Wi-Fi. Nothing is lost: the whole history moves with the game.</p>`);
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
      ${def.drawn ? `<p class="small text-warn"><b>When drawn:</b> <span class="rule-text">${esc(def.drawn.text)}</span></p>` : ''}
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
        // discard and redraw: the new card is drawn right away
        (cur.ui.ctx || ctx).dispatch(Object.assign({ type: 'sec.discard', player: p, card, reason: b.dataset.reason }, b.dataset.reason === 'redraw' ? { drawNow: true } : {}))
          .then(r => { if (r && b.dataset.reason === 'redraw') { const nw = (r.players[p].secondaries.hand || []).find(x => !sec.hand.includes(x)); toast(nw ? `New card: ${(WH.SECONDARY[nw] || { name: nw }).name}` : 'No card left to draw', 'ok', 4000); } });
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
        (cur.ui.ctx || ctx).dispatch({ type: 'game.end', merge: true }).then(r => {
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
    case 'seq-done': return ctx.dispatch({ type: 'sequence.set', key: d.key, done: true });
    case 'seq-undo': return ctx.dispatch({ type: 'sequence.set', key: d.key, done: false });
    case 'seq-toggle': ui.seqOpen = !ui.seqOpen; return paint();
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
      // without unit positions "auto" means nobody: p0 → p1 → nobody; with a battlefield map also "none" and "auto"
      const next = !anyPositions(s) ? (o.override === 0 ? 1 : o.override === 1 ? null : 0)
        : o.override == null ? 0 : o.override === 0 ? 1 : o.override === 1 ? 'none' : null;
      return ctx.dispatch({ type: 'objective.override', objectiveId: o.id, override: next });
    }
    case 'correct': return openCorrectSheet(p);
    case 'cp-offer': return ctx.dispatch({ type: 'cp.offer', player: p, offerId: d.id, accept: d.ok === '1' });
    case 'qr-show': ui.qrOpen[p] = true; return paint();
    case 'sec-pick': return openPickSheet(p, d.card);
    case 'move-host': return openMoveHostSheet();
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
    case 'delete-game': return deleteThisGame(ctx);
  }
}

/** Delete the running game on its host (only the hosting device / the creating account may) – every device leaves it. */
async function deleteThisGame(ctx) {
  const code = ctx.code;
  const ok = await confirmSheet({ title: `Delete game ${code}?`, text: 'All actions and the score will be removed permanently on the host. Phones connected to this game return to the lobby. For a finished game use "End battle" instead – that keeps the result.', ok: 'Delete', kind: 'danger' });
  if (!ok) return;
  try {
    await api.deleteGame(code);
    if (ctx.forgetGame) ctx.forgetGame(code);
    toast(`Game ${code} deleted`, 'ok');
    ctx.nav('#/');
  } catch (e) { toast(e && e.message ? e.message : 'Could not delete game', 'bad'); }
}

function findCond(ctx, p, src, card, ci) {
  const sc = ((ctx.derived || {}).scoring || [])[p];
  if (!sc) return null;
  const list = src === 'primary' ? (sc.primary && sc.primary.card === card ? sc.primary.conds : []) : (((sc.secondaries || []).find(x => x.card === card) || {}).conds || []);
  return (list || []).find(c => c.ci === ci) || null;
}
