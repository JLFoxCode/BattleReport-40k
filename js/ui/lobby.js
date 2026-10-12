/* Lobby: Spiel anlegen, Liste, Code eingeben, Rolle wählen (SPEC §7). */
import { api } from '../net.js';
import { esc, btn, sheet, confirmSheet, toast, badge } from './components.js';
import { listFinished } from '../archive.js';
import { checkDataUpdate, getDataStatus, onDataStatus, loadDataInfo } from '../data-update.js';
import { askDataUpdate, checkForUpdates } from './update-popup.js';

let games = null;      // zuletzt geladene Liste
let loading = false;
let loadErr = null;
let lastRoot = null;
let lastCtx = null;
let refreshTimer = null;

const STAGE_LABEL = { setup: 'Setup', deploy: 'Deployment', battle: 'Battle', over: 'Finished' };
const STAGE_KIND = { setup: 'muted', deploy: 'warn', battle: 'ok', over: '' };

const ROLES = [
  { view: 'table', label: 'Score (tablet)', kind: 'primary' },
  { view: 'player', me: 0, label: 'Player 1 (phone)', kind: 'primary', cls: 'p0' },
  { view: 'player', me: 1, label: 'Player 2 (phone)', kind: 'primary', cls: 'p1' },
  { view: 'watch', label: 'Spectator', kind: 'ghost' },
  { view: 'setup', label: 'Setup', kind: 'ghost' }
];

export function render(root, ctx) {
  lastRoot = root;
  lastCtx = ctx;
  if (games === null && !loading) load();
  const host = location.host;
  const last = ctx.lastGame ? ctx.lastGame() : null;
  const lastExists = last && games && games.some(g => g.code === last.code);

  root.innerHTML = `
  <div class="lobby">
    <header class="hero">
      <div class="hero-kicker">Warhammer 40,000 · 11th Edition</div>
      <h1 class="title hero-title">Battle Report 40k</h1>
      <p class="muted">Create a game, pick a role: Score on the tablet in the middle of the table, rulebook on each player's phone – every device sees the same state.</p>
      <div class="row hero-actions">
        ${btn({ label: 'New game', kind: 'primary', cta: true, action: 'new' })}
        ${lastExists ? btn({ label: `Continue: ${last.code} · ${roleLabel(last)}`, kind: 'ghost', cta: true, action: 'continue' }) : ''}
        <a class="btn ghost sm lobby-rules" href="#/rules">Rulebook</a>
      </div>
    </header>

${nearbySection()}

    <section class="card join">
      <div class="title">Join game</div>
      <form class="row join-form" data-form="join" autocomplete="off">
        <input class="code-input" name="code" maxlength="4" placeholder="CODE" inputmode="latin" autocapitalize="characters" spellcheck="false" aria-label="Enter code">
        <select name="role" aria-label="Role">
          <option value="table">Score (tablet)</option>
          <option value="p/0">Player 1 (phone)</option>
          <option value="p/1">Player 2 (phone)</option>
          <option value="setup">Setup</option>
        </select>
        ${btn({ label: 'Join', kind: 'primary', type: 'submit' })}
      </form>
      ${window.BR ? '' : `<p class="muted hint">Tablet in the middle of the table: <code>http://${esc(host)}/#/g/CODE/table</code> · Phone player 1: <code>http://${esc(host)}/#/g/CODE/p/0</code> · Phone player 2: <code>http://${esc(host)}/#/g/CODE/p/1</code></p>
      <p class="muted hint">Battle Report 40k is an app for <b>Android</b> and <b>Windows</b>: <a class="apk" href="https://github.com/JLFoxCode/BattleReport-40k/releases/latest" target="_blank" rel="noopener">download the latest release</a>. Devices without the app (e.g. iPhone) can still join a game by scanning its QR code.</p>
      ${devServerHtml()}`}
      ${devInfoHtml()}
      ${dataStatusHtml()}
    </section>

    <section class="games">
      <div class="row between">
        <div class="title">Existing games</div>
        ${btn({ label: 'Refresh', kind: 'ghost', small: true, action: 'reload', disabled: loading })}
      </div>
      ${renderList(host)}
    </section>
    ${finishedSection()}
  </div>`;

  if (!root.__lobbyBound) {
    root.__lobbyBound = true;
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
  }
  if (!refreshTimer) refreshTimer = setInterval(() => { if (document.body.dataset.view === 'lobby' && document.visibilityState === 'visible') load(true); else { clearInterval(refreshTimer); refreshTimer = null; } }, 10000);
}

/* ───────── App only: games hosted by other devices on the same Wi-Fi (window.BR = Android bridge, DNS-SD) ───────── */
let nearbyTimer = null, nearbyKey = '';
function nearbyList() { try { return JSON.parse(window.BR.nearby()) || []; } catch { return []; } }
function nearbySection() {
  if (!window.BR) return '';
  if (!nearbyTimer) nearbyTimer = setInterval(() => {
    if (document.body.dataset.view !== 'lobby') { clearInterval(nearbyTimer); nearbyTimer = null; return; }
    const key = JSON.stringify(nearbyList());
    if (key !== nearbyKey && lastRoot && lastCtx) render(lastRoot, lastCtx);
  }, 2000);
  const list = nearbyList();
  nearbyKey = JSON.stringify(list);
  return `
    <section class="card nearby">
      <div class="title">Games nearby</div>
      ${list.length ? `<div class="grid game-grid">${list.map(g => `
        <article class="card game" data-host="${esc(g.host)}" data-port="${esc(g.port)}" data-ncode="${esc(g.code)}">
          <div class="row between game-head"><div class="code">${esc(g.code)}</div>${badge(STAGE_LABEL[g.stage] || g.stage || '–', STAGE_KIND[g.stage] || '')}</div>
          <div class="game-players"><span class="pname p0">${esc(g.p0 || 'Player 1')}</span><span class="muted vs">vs</span><span class="pname p1">${esc(g.p1 || 'Player 2')}</span></div>
          <div class="row roles">
            ${btn({ label: `${g.p0 || 'Player 1'} (phone)`, kind: 'primary', cls: 'p0', small: true, action: 'remote', data: { route: 'p/0' } })}
            ${btn({ label: `${g.p1 || 'Player 2'} (phone)`, kind: 'primary', cls: 'p1', small: true, action: 'remote', data: { route: 'p/1' } })}
            ${btn({ label: 'Scoreboard', kind: 'ghost', small: true, action: 'remote', data: { route: 'table' } })}
            ${btn({ label: 'Spectator', kind: 'ghost', small: true, action: 'remote', data: { route: 'watch' } })}
          </div>
        </article>`).join('')}</div>`
      : '<p class="muted small">Searching the Wi-Fi … A game appears here as soon as a device in the same network creates one with this app.</p>'}
      <p class="muted hint">A game you create here is hosted by this device – the other devices find it automatically, or scan the QR codes shown at "Roll off for the first turn".</p>
    </section>`;
}

/* Finished games stored on THIS device (the host closes a game when it is over; every connected device keeps a copy). */
function finishedSection() {
  const list = listFinished();
  if (!list.length) return '';
  return `<section class="games finished">
      <div class="title">Finished games <span class="muted xs">saved on this device</span></div>
      <div class="grid game-grid">${list.map(g => `
        <a class="card game" href="#/archive/${esc(g.code)}">
          <div class="row between game-head"><div class="code">${esc(g.code)}</div>${badge('Finished', '')}</div>
          <div class="game-players"><span class="pname p0">${esc(g.players[0] || 'Player 1')}</span> <b>${esc(g.vp[0] ?? '')}</b><span class="muted vs">:</span><b>${esc(g.vp[1] ?? '')}</b> <span class="pname p1">${esc(g.players[1] || 'Player 2')}</span></div>
          <div class="muted small">${g.savedAt ? fmtDate(g.savedAt) : ''}</div>
        </a>`).join('')}</div>
    </section>`;
}

/* Unit data (New Recruit / BSData): status line + automatic check when the app is online (js/data-update.js). */
let dataWatch = false;
function dataStatusHtml() {
  if (!window.BR) return '';
  if (!dataWatch) {
    dataWatch = true;
    onDataStatus(() => { if (lastRoot && lastCtx && document.body.dataset.view === 'lobby') render(lastRoot, lastCtx); });
    loadDataInfo();   // the check itself runs when the app opens (update-popup.js) or via Check now
  }
  const d = getDataStatus();
  const ver = d.version ? d.version.slice(0, 7) + (d.date ? ' · ' + fmtDate(d.date) : '') : '…';
  const busy = d.state === 'checking' || d.state === 'updating';
  const cls = d.state === 'error' ? 'text-warn' : d.state === 'updated' || d.state === 'current' ? 'text-ok' : 'muted';
  return `<p class="hint ${cls}">Unit data (New Recruit / BSData): ${esc(ver)}${d.msg ? ' · ' + esc(d.msg) : ''} ${busy ? '' : btn({ label: 'Check now', kind: 'ghost', small: true, action: 'data-check' })}</p>`;
}

/** In the DEV app: which build, and whether the auto-update reaches the PC (window.BR.devInfo, Android bridge). */
function devInfoHtml() {
  let i = null;
  try { i = window.BR && window.BR.devInfo ? JSON.parse(window.BR.devInfo()) : null; } catch { i = null; }
  if (!i) return '';
  if (!i.dev) return '<p class="muted hint">App version ' + esc(i.versionCode) + ' · new versions and unit data are offered when the app opens with internet. ' + btn({ label: 'Check for updates', kind: 'ghost', small: true, action: 'app-update-check' }) + '</p>';
  const ago = t => (t ? Math.round((Date.now() - t) / 1000) + ' s ago' : 'never');
  const ok = i.lastOk && Date.now() - i.lastOk < 30000;
  return `<p class="hint ${ok ? 'text-ok' : 'text-warn'}">DEV app ${esc(i.versionCode)} · auto-update from ${esc(i.server)} · last contact: ${esc(ago(i.lastOk))}${i.lastError && !ok ? ' · error: ' + esc(i.lastError) : ''}</p>`;
}

/* Only on the developer's PC server (GET /api/info → dev: true): download links for the DEV app and the local release build. */
let serverInfo;
function devServerHtml() {
  if (serverInfo === undefined) {
    serverInfo = null;
    fetch('/api/info', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(i => { serverInfo = i || {}; if (serverInfo.dev && lastRoot && lastCtx && document.body.dataset.view === 'lobby') render(lastRoot, lastCtx); });
  }
  if (!serverInfo || !serverInfo.dev) return '';
  return `<p class="muted hint"><b>Dev server:</b> <a class="apk" href="/app/BattleReport40k-dev.apk" download>DEV app</a> (updates itself from this PC) · <a class="apk" href="/app/BattleReport40k.apk" download>local release build</a></p>`;
}

function roleLabel(last) {
  if (!last) return '';
  if (last.view === 'player') return `Player ${Number(last.me) + 1}`;
  if (last.view === 'table') return 'Score';
  if (last.view === 'desktop') return 'Desktop';
  if (last.view === 'map') return 'Battlefield';
  return 'Setup';
}

function renderList(host) {
  if (loadErr) return `<div class="card bad"><p>Could not load the list: ${esc(loadErr)}</p></div>`;
  if (games === null) return `<div class="card muted">Loading …</div>`;
  if (!games.length) return `<div class="card muted empty">No games yet. Create a new one above.</div>`;
  return `<div class="grid game-grid">${games.map(g => `
    <article class="card game" data-code="${esc(g.code)}">
      <div class="row between game-head">
        <div class="code">${esc(g.code)}</div>
        ${badge(STAGE_LABEL[g.stage] || g.stage || '–', STAGE_KIND[g.stage] || '')}
      </div>
      <div class="game-players">
        <span class="pname p0">${esc(g.players && g.players[0] || 'Player 1')}</span>
        <span class="muted vs">vs</span>
        <span class="pname p1">${esc(g.players && g.players[1] || 'Player 2')}</span>
      </div>
      <div class="muted small">${g.stage === 'battle' || g.stage === 'over' ? `Round ${esc(g.round || 0)} · ` : ''}${g.createdAt ? fmtDate(g.createdAt) : ''}</div>
      <div class="row roles">
        ${ROLES.map(r => btn({ label: r.label, kind: r.kind, cls: r.cls, small: true, action: 'open', data: { view: r.view, me: r.me == null ? '' : r.me } })).join('')}
      </div>
      <div class="row between game-foot">
        <span class="muted tiny">http://${esc(host)}/#/g/${esc(g.code)}/table</span>
        ${btn({ label: 'Delete', kind: 'danger', small: true, action: 'delete' })}
      </div>
    </article>`).join('')}</div>`;
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

async function load(silent) {
  if (loading) return;
  loading = true;
  if (!silent) loadErr = null;
  try {
    const list = await api.listGames();
    games = Array.isArray(list) ? list : [];
    loadErr = null;
  } catch (e) {
    if (!silent || games === null) loadErr = e && e.message ? e.message : String(e);
  } finally {
    loading = false;
    if (lastRoot && lastCtx && document.body.dataset.view === 'lobby') render(lastRoot, lastCtx);
  }
}

function hashFor(code, view, me) {
  if (view === 'player') return `#/g/${code}/p/${me === '' || me == null ? 0 : me}`;
  return `#/g/${code}/${view}`;
}

function onClick(e) {
  const b = e.target.closest('[data-action]');
  if (!b || !lastCtx) return;
  const action = b.dataset.action;
  const card = b.closest('[data-code]');
  const code = card ? card.dataset.code : null;
  if (action === 'new') return newGame();
  if (action === 'data-check') { checkDataUpdate({ ask: askDataUpdate }); return; }
  if (action === 'app-update-check') { checkForUpdates(); return; }
  if (action === 'remote') {
    const c = b.closest('[data-ncode]');
    if (c) location.href = `http://${c.dataset.host}:${c.dataset.port}/index.html#/g/${c.dataset.ncode}/${b.dataset.route}`;
    return;
  }
  if (action === 'reload') return load();
  if (action === 'continue') {
    const last = lastCtx.lastGame();
    if (last && last.hash) lastCtx.nav(last.hash);
    return;
  }
  if (action === 'open' && code) return lastCtx.nav(hashFor(code, b.dataset.view, b.dataset.me));
  if (action === 'delete' && code) return deleteGame(code);
}

function onSubmit(e) {
  const f = e.target.closest('[data-form="join"]');
  if (!f) return;
  e.preventDefault();
  const code = String(f.code.value || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { toast('Code: 4 letters, e.g. KXWA', 'warn'); f.code.focus(); return; }
  const remote = window.BR && !(games || []).some(g => g.code === code) && nearbyList().find(g => g.code === code);
  if (remote) { location.href = `http://${remote.host}:${remote.port}/index.html#/g/${code}/${f.role.value}`; return; }
  lastCtx.nav(`#/g/${code}/${f.role.value}`);
}

function newGame() {
  sheet({
    title: 'New game',
    body: `
      <p class="muted">Names are optional and can be changed in setup.</p>
      <label class="field"><span>Player 1</span><input type="text" name="n0" placeholder="Name" maxlength="24" autocomplete="off"></label>
      <label class="field"><span>Player 2</span><input type="text" name="n1" placeholder="Name" maxlength="24" autocomplete="off"></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Create game', kind: 'primary', cta: true, keep: true, onClick: async (close, el) => {
        const names = [el.querySelector('[name=n0]').value.trim(), el.querySelector('[name=n1]').value.trim()];
        const b = el.querySelector('[data-sheet-action="1"]');
        if (b) b.disabled = true;
        try {
          const r = await api.createGame(names.some(Boolean) ? names : []);
          close();
          toast(`Game ${r.code} created`, 'ok');
          games = null;
          lastCtx.nav(`#/g/${r.code}/setup`);
        } catch (err) {
          toast(err && err.message ? err.message : 'Could not create game', 'bad');
          if (b) b.disabled = false;
        }
      } }
    ],
    onOpen: (el, close) => {
      el.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); const b = el.querySelector('[data-sheet-action="1"]'); if (b) b.click(); }
      }));
    }
  });
}

async function deleteGame(code) {
  const ok = await confirmSheet({ title: `Delete game ${code}?`, text: 'All actions and the score will be removed permanently.', ok: 'Delete', kind: 'danger' });
  if (!ok) return;
  try {
    await api.deleteGame(code);
    if (lastCtx.forgetGame) lastCtx.forgetGame(code);
    toast(`Game ${code} deleted`, 'ok');
    games = (games || []).filter(g => g.code !== code);
    render(lastRoot, lastCtx);
    load(true);
  } catch (e) {
    toast(e && e.message ? e.message : 'Could not delete game', 'bad');
  }
}
