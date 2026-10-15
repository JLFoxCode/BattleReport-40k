/* Lobby: Spiel anlegen, Liste, Code eingeben, Rolle wählen (SPEC §7). */
import { api } from '../net.js';
import { esc, btn, sheet, confirmSheet, toast, badge, colorOf } from './components.js';
import { listFinished } from '../archive.js';
import { checkDataUpdate, getDataStatus, onDataStatus, loadDataInfo } from '../data-update.js';
import { askDataUpdate, checkForUpdates } from './update-popup.js';
import { armyChoices } from './armies.js';
import { getLang, setLang, keepTerms, setKeepTerms } from '../i18n.js';
import { guideOn, setGuideOn } from './tutorial.js';

let games = null;      // zuletzt geladene Liste
let loading = false;
let loadErr = null;
let lastRoot = null;
let lastCtx = null;
let refreshTimer = null;

// The page comes from this device's own server (app / desktop = 127.0.0.1): only then are the listed games this device's
// games, and only then may they be deleted (a guest phone sees the host's games and must not delete them)
const onHost = () => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(location.hostname);
const STAGE_LABEL = { setup: 'Setup', deploy: 'Deployment', battle: 'Battle', over: 'Finished' };
const STAGE_KIND = { setup: 'muted', deploy: 'warn', battle: 'ok', over: '' };

const ROLES = [
  { view: 'table', label: 'Score (tablet)', kind: 'primary' },
  { view: 'player', me: 0, label: 'Player 1 (phone)', kind: 'primary', cls: 'p0' },
  { view: 'player', me: 1, label: 'Player 2 (phone)', kind: 'primary', cls: 'p1' },
  { view: 'watch', label: 'Spectator', kind: 'ghost' },
  { view: 'setup', label: 'Setup', kind: 'ghost' }
];

// Simple line icons of the main menu (stroke = currentColor)
const ICON = {
  play: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  join: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>',
  army: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v6"/><path d="M9 11h6"/>',
  learn: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  rules: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/>',
  history: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
  app: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/>'
};
const icon = k => `<svg class="menu-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const PAGES = { join: 'Join game', history: 'Finished games', app: 'App & data' };

export function render(root, ctx) {
  lastRoot = root;
  lastCtx = ctx;
  const page = PAGES[ctx.me] ? ctx.me : null;
  if (games === null && !loading) load(!page);
  const last = ctx.lastGame ? ctx.lastGame() : null;
  // a finished game is under 'Finished games', not 'Continue game'
  const lastExists = last && games && games.some(g => g.code === last.code && g.stage !== 'over');
  // keep what is being typed when the page refreshes itself (nearby games, game list)
  const form = root.querySelector('[data-form=join]');
  const keep = form ? { code: form.code.value, role: (form.querySelector('input[name=role]:checked') || {}).value, focus: document.activeElement === form.code } : null;
  root.innerHTML = page ? pageHtml(page) : homeHtml(last, lastExists);
  const nf = root.querySelector('[data-form=join]');
  if (nf && keep) {
    nf.code.value = keep.code;
    nf.querySelectorAll('input[name=role]').forEach(i => { i.checked = i.value === keep.role; i.closest('.chip').classList.toggle('on', i.checked); });
    if (keep.focus) nf.code.focus();
  }
  if (!root.__lobbyBound) {
    root.__lobbyBound = true;
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', e => {
      if (e.target.name !== 'role') return;
      e.target.closest('.role-pick').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
    });
  }
  if (!refreshTimer) refreshTimer = setInterval(() => { if (document.body.dataset.view === 'lobby' && document.visibilityState === 'visible') load(true); else { clearInterval(refreshTimer); refreshTimer = null; } }, 10000);
}

/* Title screen: a clear menu – the game first, then everything around it */
function homeHtml(last, lastExists) {
  const nearbyL = window.BR ? nearbyList() : [];
  const nearby = nearbyL.length;
  if (window.BR) { watchNearby(); nearbyKey = JSON.stringify(nearbyL); }
  const finished = listFinished().length;
  let armies = 0;
  try { armies = armyChoices().length; } catch {}
  const tile = o => {
    const inner = `${icon(o.icon)}<span class="menu-label">${esc(o.label)}</span><span class="menu-sub">${esc(o.sub)}</span>`;
    return o.href ? `<a href="${o.href}" class="menu-tile${o.main ? ' main' : ''}">${inner}</a>`
      : `<button type="button" data-action="${o.action}" class="menu-tile${o.main ? ' main' : ''}">${inner}</button>`;
  };
  return `
  <div class="lobby home">
    <header class="hero">
      <div class="hero-kicker">Warhammer 40,000 · 11th Edition</div>
      <h1 class="title hero-title">Battle Report 40k</h1>
    </header>
    ${lastExists ? `<button type="button" class="continue-card" data-action="continue">
        <span class="cont-text"><span class="cont-kicker">Continue game</span><span class="cont-code">${esc(last.code)}</span></span>
        <span class="cont-role">${esc(roleLabel(last))}</span><span class="cont-go" aria-hidden="true">›</span></button>` : ''}
    <nav class="menu-grid" aria-label="Main menu">
      ${tile({ action: 'new', icon: 'play', label: 'New game', sub: 'Host a battle on this device', main: true })}
      ${tile({ href: '#/play/join', icon: 'join', label: 'Join game', sub: nearby ? `${nearby} game${nearby === 1 ? '' : 's'} nearby` : 'Nearby or by code' })}
      ${tile({ href: '#/armies', icon: 'army', label: 'My armies', sub: armies ? `${armies} list${armies === 1 ? '' : 's'}` : 'Build your army lists' })}
      ${tile({ href: '#/learn', icon: 'learn', label: 'Learn to play', sub: 'Step by step, phase by phase' })}
      ${tile({ href: '#/rules', icon: 'rules', label: 'Rulebook', sub: 'Core rules & missions' })}
      ${tile({ href: '#/play/history', icon: 'history', label: 'Finished games', sub: finished ? `${finished} saved` : 'Results & battle logs' })}
      ${tile({ href: '#/play/app', icon: 'app', label: 'App & data', sub: 'Updates & unit data' })}
    </nav>
  </div>`;
}

function pageHtml(page) {
  const host = location.host;
  const head = `<header class="page-head"><a class="btn ghost sm" href="#/">‹ Menu</a><h1 class="title">${esc(PAGES[page])}</h1>${page === 'join' ? btn({ label: 'Refresh', kind: 'ghost', small: true, action: 'reload', disabled: loading }) : '<span></span>'}</header>`;
  if (page === 'join') {
    return `<div class="lobby page">${head}
    ${nearbySection()}
    <section class="card join">
      <div class="title">Join by code</div>
      <form class="join-form" data-form="join" autocomplete="off">
        <input class="code-input" name="code" maxlength="4" placeholder="CODE" inputmode="latin" autocapitalize="characters" spellcheck="false" aria-label="Enter code">
        <div class="chips role-pick" role="radiogroup" aria-label="Role">
          ${[['p/0', 'Player 1'], ['p/1', 'Player 2'], ['table', 'Scoreboard'], ['watch', 'Spectator'], ['setup', 'Setup']].map(([v, l], i) => `<label class="chip${i === 0 ? ' on' : ''}"><input type="radio" name="role" value="${v}"${i === 0 ? ' checked' : ''} hidden>${l}</label>`).join('')}
        </div>
        ${btn({ label: 'Join', kind: 'primary', cta: true, type: 'submit' })}
      </form>
      ${window.BR ? '' : `<p class="muted hint">Battle Report 40k is an app for <b>Android</b> and <b>Windows</b>: <a class="apk" href="https://github.com/JLFoxCode/BattleReport-40k/releases/latest" target="_blank" rel="noopener">download the latest release</a>. Devices without the app (e.g. iPhone) can still join a game by scanning its QR code.</p>${devServerHtml()}`}
    </section>
    <section class="games">
      <div class="title">${onHost() ? 'Games on this device' : 'Games on the host device'}</div>
      ${renderList(host)}
    </section>
  </div>`;
  }
  if (page === 'history') {
    const f = finishedSection();
    return `<div class="lobby page">${head}${f || '<div class="card muted empty">No finished games on this device yet.</div>'}</div>`;
  }
  return `<div class="lobby page">${head}
    <section class="card lang-card">
      <div class="title">Language</div>
      <div class="chips">${[['en', 'English'], ['de', 'Deutsch']].map(([l, n]) => `<button type="button" class="chip${getLang() === l ? ' on' : ''}" data-action="lang" data-lang="${l}" data-no-i18n>${n}</button>`).join('')}</div>
      <label class="lang-terms"><input type="checkbox" data-action="keep-terms"${keepTerms() ? ' checked' : ''}> <span>Game terms in English</span></label>
      <label class="lang-terms"><input type="checkbox" data-action="guide"${guideOn() ? ' checked' : ''}> <span>Show the guide during games</span></label>
      <p class="muted xs">German: the interface is in German; rules texts stay in their English original as long as no official German version is available in the data. “Game terms in English” keeps terms like Stratagem, CP, Command phase or Leader in English.</p>
    </section>
    <section class="card app-info">${devInfoHtml() || '<p class="muted">Running in the browser – updates come with the app.</p>'}${dataStatusHtml()}</section>
  </div>`;
}

/* ───────── App only: games hosted by other devices on the same Wi-Fi (window.BR = Android bridge, DNS-SD) ───────── */
let nearbyTimer = null, nearbyKey = '';
function nearbyList() { try { return JSON.parse(window.BR.nearby()) || []; } catch { return []; } }
function watchNearby() {
  if (!nearbyTimer) nearbyTimer = setInterval(() => {
    if (document.body.dataset.view !== 'lobby') { clearInterval(nearbyTimer); nearbyTimer = null; return; }
    const key = JSON.stringify(nearbyList());
    if (key !== nearbyKey && lastRoot && lastCtx) render(lastRoot, lastCtx);
  }, 2000);
}
function nearbySection() {
  if (!window.BR) return '';
  watchNearby();
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
      <p class="muted hint">A game you create on this device is hosted by it – the other devices find it automatically, or scan the QR codes shown at "Roll off for the first turn".</p>
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
  if (!games.length) return `<div class="card muted empty">${onHost() ? 'No games on this device yet.' : 'No games on the host device yet.'}</div>`;
  return `<div class="grid game-grid">${games.map(g => `
    <article class="card game" data-code="${esc(g.code)}"${Array.isArray(g.colors) ? ` style="${g.colors.map((c, i) => (c == null ? '' : `--p${i}:${colorOf(c)};`)).join('')}"` : ''}>
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
        ${onHost() ? btn({ label: 'Delete', kind: 'danger', small: true, action: 'delete' }) : ''}
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
  if (action === 'lang') { if (b.dataset.lang !== getLang()) setLang(b.dataset.lang); return; }
  if (action === 'keep-terms') { setKeepTerms(b.checked); return; }
  if (action === 'guide') { setGuideOn(b.checked); return; }
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
