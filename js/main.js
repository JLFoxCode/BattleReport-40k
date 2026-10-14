/* Schlachtbericht 40k – Router, Store, Dispatch (SPEC §7).
 *
 * Routen:  #/                       Lobby
 *          #/g/CODE/setup[/0|/1]    Setup-Assistent (optional: eigener Spielerindex)
 *          #/g/CODE/p/0 | p/1       Regelwerk (Handy je Spieler, SPEC v4)
 *          #/g/CODE/desktop         Großbild
 *          #/g/CODE/map[/0|/1]      Vollbild-Spielfeld (Tablet), optional als Spieler
 *          #/g/CODE/table           Spielstand (Tablet in der Tischmitte, SPEC v4)
 *          #/g/CODE/camera          Deckenkamera-Quelle (ein Browser-Tab, §12)
 *          #/g/CODE/photo[/0|/1]    Tischfoto mit Messwerkzeugen (§11), optional als Spieler
 *          #/print/markers          Druckseite QR-Marker (ohne Spiel, §11)
 *          #/rules | #/g/CODE/rules Regelbuch (globale Suche; ohne Spiel nutzbar)
 *
 * Jedes UI-Modul exportiert render(root, ctx) mit
 *   ctx = { state, derived, me, code, view, online, dispatch, undo, nav, net, rerender, data: { WH, FACTIONS, TERRAIN_LAYOUTS } }
 */
import { derive } from '../engine/index.js';
import { WH } from '../data/rules.js';
import { FACTIONS } from '../data/factions/index.js';
import { TERRAIN_LAYOUTS } from '../data/terrain.js';
import { createNet, api } from './net.js';
import { saveFinished, archiveHref } from './archive.js';
import * as archiveView from './ui/archive-view.js';
import { checkOnOpen } from './ui/update-popup.js';
import { openJoinSheet } from './ui/qr.js';
import { installKeywordInfo } from './ui/keywords.js';
import { startI18n } from './i18n.js';
import { toast, esc } from './ui/components.js';
import * as lobby from './ui/lobby.js';
import * as setup from './ui/setup.js';
import * as player from './ui/player.js';
import * as desktop from './ui/desktop.js';
import * as map from './ui/map.js';
import * as table from './ui/table.js';
import * as camera from './ui/camera.js';
import * as markers from './ui/markers.js';
import * as photo from './ui/photo.js';
import * as rulebook from './ui/rulebook.js';
import * as armies from './ui/armies.js';
import * as tutorial from './ui/tutorial.js';

const LS_KEY = 'sb40k.last';
const MODULES = { lobby, setup, player, desktop, map, table, camera, markers, photo, rules: rulebook, archive: archiveView, armies, learn: tutorial };
const data = Object.freeze({ WH, FACTIONS, TERRAIN_LAYOUTS });

// ---------------------------------------------------------------- Store
export const store = {
  state: null,
  derived: null,
  me: null,          // 0 | 1 | 'desktop' | null
  online: false,
  code: null,
  view: 'lobby'
};
let net = null;
let unsubState = null;
let unsubStatus = null;
let lastRoute = null;

// ---------------------------------------------------------------- DOM-Gerüst
const app = document.getElementById('app');
app.innerHTML = `
  <nav class="appbar" id="appbar" aria-label="Navigation"></nav>
  <div class="statusbar" id="statusbar" role="status"></div>
  <div id="view" class="view"></div>`;
const statusbar = document.getElementById('statusbar');
const appbar = document.getElementById('appbar');
const viewHost = document.getElementById('view');
// Jede Ansicht bekommt ein eigenes Wurzelelement: so bleiben Klick-Handler und Zustände der Module sauber getrennt
let viewRoot = null;
let viewRootKey = null;
function rootFor(view, code, me) {
  const key = `${view}|${code || ''}|${me}`;
  if (viewRoot && viewRootKey === key && viewRoot.isConnected) return viewRoot;
  viewHost.innerHTML = '';
  viewRoot = document.createElement('div');
  viewRoot.className = 'view-inner view-' + view;
  viewHost.appendChild(viewRoot);
  viewRootKey = key;
  return viewRoot;
}

function renderAppbar() {
  const { code, view, me, state } = store;
  if (!code && view !== 'rules') { appbar.innerHTML = ''; appbar.classList.remove('show'); document.body.classList.remove('has-appbar'); return; }
  document.body.classList.add('has-appbar');
  if (!code) {
    // Rulebook without a game: reduced bar (home + Rulebook)
    appbar.classList.add('show');
    appbar.innerHTML = `
    <a class="ab-home" href="#/" title="Lobby">⌂</a>
    <span class="ab-code">Rulebook</span>
    <div class="ab-roles"><a class="ab-role on" href="#/rules">Rulebook</a></div>`;
    return;
  }
  const names = state && state.players ? state.players.map(p => p.name) : ['Player 1', 'Player 2'];
  const items = store.spectator ? [
    ['table', 'desktop', `#/g/${code}/watch`, 'Score'],
    ['player', 0, `#/g/${code}/watch/0`, names[0]],
    ['player', 1, `#/g/${code}/watch/1`, names[1]],
    ['rules', null, `#/g/${code}/rules`, 'Rulebook']
  ] : [
    ['table', 'desktop', `#/g/${code}/table`, 'Score'],
    ['player', 0, `#/g/${code}/p/0`, names[0]],
    ['player', 1, `#/g/${code}/p/1`, names[1]],
    ['setup', null, `#/g/${code}/setup`, 'Setup'],
    ['rules', null, `#/g/${code}/rules`, 'Rulebook']
  ];
  const cur = (v, m) => view === v && (v !== 'player' || store.me === m);
  const stage = state ? state.stage : '';
  const canUndo = state && state.seq > 1 && !store.spectator;
  appbar.classList.add('show');
  // Wide screens: all views in the bar. Phones: code + current view, everything else in the ☰ menu (no crowding).
  const curItem = items.find(([v, m]) => cur(v, m));
  const links = items.map(([v, m, href, label]) => `<a class="ab-role${cur(v, m) ? ' on' : ''}${typeof m === 'number' ? ' p' + m : ''}" href="${href}">${esc(label)}</a>`).join('');
  appbar.innerHTML = `
    <a class="ab-home" href="#/" title="Lobby">⌂</a>
    ${store.spectator ? '<span class="ab-spec" title="View only – nothing can be changed">Spectator</span>' : ''}
    <span class="ab-code">${esc(code)}${stage ? ` <span class="ab-stage">${esc({ setup: 'Setup', deploy: 'Deployment', battle: 'Round ' + (state.round || 0), over: 'Finished' }[stage] || stage)}</span>` : ''}</span>
    ${curItem ? `<span class="ab-cur${typeof curItem[1] === 'number' ? ' p' + curItem[1] : ''}">${esc(curItem[3])}</span>` : ''}
    <div class="ab-roles">${links}</div>
    <button class="ab-undo ab-wide ab-join" type="button" data-ab="join" title="Join with another device (QR codes)">QR</button>
    <button class="ab-undo ab-wide" type="button" data-ab="undo" title="Undo"${canUndo ? '' : ' disabled'}>↶</button>
    <button class="ab-undo ab-reload ab-wide" type="button" data-ab="reload" title="Reload">↻</button>
    <button class="ab-undo ab-menu" type="button" data-ab="menu" title="Menu" aria-haspopup="true" aria-expanded="false">☰</button>
    <div class="ab-drop" role="menu">${links}
      <button type="button" class="ab-role ab-drop-join" data-ab="join">Join with another device (QR)</button>
      <div class="ab-drop-row"><button type="button" data-ab="undo"${canUndo ? '' : ' disabled'}>↶ Undo</button><button type="button" data-ab="reload">↻ Reload</button></div>
    </div>`;
}
appbar.addEventListener('click', async e => {
  const b = e.target.closest('[data-ab]');
  if (!b) return;
  if (b.dataset.ab === 'undo') { b.disabled = true; try { await undo(); } finally { renderAppbar(); } }
  if (b.dataset.ab === 'reload') location.reload();
  if (b.dataset.ab === 'join') { appbar.classList.remove('menu-open'); openJoinSheet(store.code, store.state && store.state.players ? store.state.players.map(p => p.name) : []); }
  if (b.dataset.ab === 'menu') { const open = appbar.classList.toggle('menu-open'); b.setAttribute('aria-expanded', String(open)); }
});
// close the ☰ menu on navigation or a tap outside
appbar.addEventListener('click', e => { if (e.target.closest('.ab-drop a')) appbar.classList.remove('menu-open'); });
document.addEventListener('click', e => { if (!e.target.closest('.appbar')) appbar.classList.remove('menu-open'); });

function updateStatusbar() {
  const needsNet = !!store.code;
  const offline = needsNet && !store.online;
  statusbar.className = 'statusbar' + (offline ? ' show offline' : '');
  statusbar.innerHTML = offline
    ? `<span class="dot bad"></span> Connection to the server lost – reconnecting …`
    : '';
  document.body.classList.toggle('offline', offline);
}

// ---------------------------------------------------------------- Routing
export function parseHash(hash = location.hash) {
  const h = (hash || '').replace(/^#/, '');
  const parts = h.split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'print' && parts[1] === 'markers') return { view: 'markers', code: null, me: null };
  if (parts[0] === 'rules') return { view: 'rules', code: null, me: null };
  // army builder: list of saved armies / one army in the editor
  // main menu pages: join a game, finished games, app & data
  // Learn to play: chapter list / one step (#/learn/<chapter>/<step>)
  if (parts[0] === 'learn') return { view: 'learn', code: null, me: parts[1] ? parts.slice(1, 3).join('/') : null };
  if (parts[0] === 'play') return { view: 'lobby', code: null, me: parts[1] || null };
  if (parts[0] === 'armies') return { view: 'armies', code: null, me: parts[1] ? decodeURIComponent(parts[1]) : null };
  // finished game stored on this device (no server needed)
  if (parts[0] === 'archive' && parts[1]) return { view: 'archive', code: null, me: null, archive: String(parts[1]).toUpperCase() };
  if (parts[0] !== 'g' || !parts[1]) return { view: 'lobby', code: null, me: null };
  const code = String(parts[1]).toUpperCase();
  const v = parts[2] || 'setup';
  const idx = parts[3] != null && /^[01]$/.test(parts[3]) ? Number(parts[3]) : null;
  if (v === 'p') return { view: 'player', code, me: idx == null ? 0 : idx };
  // Spectator: follows the game read-only – score view (watch) or a player's army (watch/0, watch/1)
  if (v === 'watch') return idx == null ? { view: 'table', code, me: 'desktop', spectator: true } : { view: 'player', code, me: idx, spectator: true };
  if (v === 'desktop') return { view: 'desktop', code, me: 'desktop' };
  if (v === 'table') return { view: 'table', code, me: 'desktop' };
  if (v === 'camera') return { view: 'camera', code, me: 'camera' };
  if (v === 'photo') return { view: 'photo', code, me: idx == null ? 'desktop' : idx };
  if (v === 'map') return { view: 'map', code, me: idx == null ? 'desktop' : idx };
  if (v === 'setup') return { view: 'setup', code, me: idx };
  if (v === 'rules') return { view: 'rules', code, me: null };
  return { view: 'setup', code, me: null };
}

export function nav(hash) {
  if (!hash) hash = '#/';
  if (!hash.startsWith('#')) hash = '#' + (hash.startsWith('/') ? '' : '/') + hash;
  if (location.hash === hash) route(); else location.hash = hash;
}

export function roleHash(code, me, view) {
  if (view === 'rules') return code ? `#/g/${code}/rules` : '#/rules';
  if (view === 'desktop') return `#/g/${code}/desktop`;
  if (view === 'table') return `#/g/${code}/table`;
  if (view === 'camera') return `#/g/${code}/camera`;
  if (view === 'photo') return `#/g/${code}/photo${typeof me === 'number' ? '/' + me : ''}`;
  if (view === 'map') return `#/g/${code}/map${typeof me === 'number' ? '/' + me : ''}`;
  if (view === 'setup') return `#/g/${code}/setup${typeof me === 'number' ? '/' + me : ''}`;
  return `#/g/${code}/p/${typeof me === 'number' ? me : 0}`;
}

function remember(code, me, view) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ code, me, view, hash: roleHash(code, me, view), at: Date.now() })); } catch {}
}
export function lastGame() {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); return v && v.code ? v : null; } catch { return null; }
}
export function forgetGame(code) {
  const l = lastGame();
  if (!code || (l && l.code === code)) { try { localStorage.removeItem(LS_KEY); } catch {} }
}

let routeSeq = 0;
async function route() {
  const my = ++routeSeq;
  const r = parseHash();
  const codeChanged = r.code !== store.code;
  store.view = r.view;
  store.me = r.me;
  store.spectator = !!r.spectator;
  store.archive = r.archive || null;
  if (codeChanged) {
    disconnect();
    store.code = r.code;
    store.state = null;
    store.derived = null;
    if (r.code) await connect(r.code);
    if (my !== routeSeq) return; // inzwischen neue Route – die übernimmt
  }
  if (r.code && !r.spectator) remember(r.code, r.me, r.view);
  lastRoute = r;
  updateStatusbar();
  render();
}

function disconnect() {
  if (unsubState) { unsubState(); unsubState = null; }
  if (unsubStatus) { unsubStatus(); unsubStatus = null; }
  if (net) { try { net.close(); } catch {} net = null; }
  store.online = false;
}

async function connect(code) {
  if (!/^[A-Z]{4}$/.test(code)) {
    toast('Invalid game code: ' + code, 'bad');
    location.hash = '#/';
    return;
  }
  net = createNet(code);
  unsubStatus = net.onStatus(online => { store.online = online; updateStatusbar(); });
  unsubState = net.subscribe(s => { if (net && s && s.code === code) pushState(s); });
  // The host closes a finished game (signal "game.closed") → continue with the copy stored on this device
  const unsubClosed = net.onSignal(sig => {
    if (!sig || sig.type !== 'game.closed' || store.code !== code) return;
    toast('Game ' + code + ' was closed by the host – it is saved on this device.', 'ok', 5000);
    const href = archiveHref(code);
    if (href.startsWith('#')) nav(href); else location.href = href;
  });
  const prevUnsub = unsubStatus;
  unsubStatus = () => { if (prevUnsub) prevUnsub(); unsubClosed(); };
  // Sofort Zustand holen (schneller als SSE, und erkennt 404)
  try {
    await net.refresh();
  } catch (e) {
    if (e && e.status === 404) {
      toast(`Game ${code} does not exist (any more).`, 'bad');
      forgetGame(code);
      disconnect();
      store.code = null;
      location.hash = '#/';
    }
    // andere Fehler: SSE/Reconnect übernimmt
  }
}

/** Battle over → store the final state + full action log on THIS device (once per game code and device). */
const archived = new Set();
function archiveIfOver(s) {
  if (!s || s.stage !== 'over' || archived.has(s.code)) return;
  archived.add(s.code);
  api.getLog(s.code).then(log => {
    const ok = saveFinished({ code: s.code, savedAt: new Date().toISOString(), state: s, actions: (log && log.actions) || [] });
    if (ok) toast('Battle over – the game is saved on this device (Lobby → Finished games).', 'ok', 5000);
  }).catch(e => { archived.delete(s.code); console.warn('archive', e); });
}

function pushState(s) {
  archiveIfOver(s);
  store.state = s;
  try { store.derived = derive(s); }
  catch (e) { console.error('derive() fehlgeschlagen', e); store.derived = store.derived || {}; }
  render();
}

// ---------------------------------------------------------------- Dispatch
/** dispatch(action) → Promise<state|null>; Fehler werden als Toast gezeigt (Promise löst mit null auf). */
async function dispatch(action) {
  if (store.spectator) { toast('Spectator – view only', 'warn', 1800); return null; }
  if (!net) { toast('No game connected', 'bad'); return null; }
  if (!action || typeof action.type !== 'string') { toast('Invalid action', 'bad'); return null; }
  const a = Object.assign({}, action);
  if (a.by === undefined) a.by = store.me;
  try {
    return await net.dispatch(a);
  } catch (e) {
    console.warn('dispatch', a.type, e);
    toast(e && e.message ? e.message : 'Action failed', 'bad');
    return null;
  }
}
async function undo() {
  if (store.spectator) { toast('Spectator – view only', 'warn', 1800); return null; }
  if (!net) return null;
  try {
    const s = await net.undo();
    toast('Last action undone', 'ok', 1500);
    return s;
  } catch (e) {
    toast(e && e.message ? e.message : 'Undo failed', 'bad');
    return null;
  }
}

// ---------------------------------------------------------------- Render
let rendering = false;
let renderQueued = false;
const mapInstances = new WeakMap();

function buildCtx() {
  return {
    state: store.state, derived: store.derived, me: store.me, code: store.code, view: store.view, online: store.online,
    dispatch, undo, nav, net, rerender: render, data, roleHash, lastGame, forgetGame, archive: store.archive, spectator: !!store.spectator
  };
}

function render() {
  if (rendering) { renderQueued = true; return; }
  rendering = true;
  try {
    const ctx = buildCtx();
    const view = store.view;
    document.body.dataset.view = view;
    document.body.dataset.me = String(store.me);
    if (store.spectator) document.body.dataset.spectator = '1'; else delete document.body.dataset.spectator;
    const mod = MODULES[view] || lobby;
    const root = rootFor(view, store.code, store.me);
    renderAppbar();
    if (store.code && !store.state) {
      root.innerHTML = `<div class="card center muted connecting"><div class="title">Connecting to game ${esc(store.code || '')} …</div>
        <p>Taking too long? Is the server running? <a href="#/">Back to lobby</a></p></div>`;
      return;
    }
    if (typeof mod.render === 'function') {
      mod.render(root, ctx);
    } else if (view === 'map' && typeof mod.createMap === 'function') {
      // map.js liefert nur createMap(el, opts) – als Vollbildansicht einbetten und patchen.
      let inst = mapInstances.get(root);
      if (!inst || inst.code !== store.code || inst.me !== store.me) {
        root.innerHTML = `<div class="map-full" id="map-full"></div>`;
        const el = document.getElementById('map-full');
        const me = typeof store.me === 'number' ? store.me : null;
        const m = mod.createMap(el, {
          interactive: me != null, player: me,
          zoneOnly: store.state && store.state.stage === 'deploy',
          onMove: (unitId, pos, dist) => dispatch({ type: 'unit.place', player: me, unitId, pos, dist }),
          onPointer: p => net && net.pointer(Object.assign({ src: 'map' }, p))
        });
        inst = { code: store.code, me: store.me, map: m };
        mapInstances.set(root, inst);
      }
      inst.map.update(store.state, store.derived);
    } else {
      root.innerHTML = `<div class="card"><div class="title">Module "${esc(view)}" has no render()</div></div>`;
    }
  } catch (e) {
    console.error('render', e);
    (viewRoot || viewHost).innerHTML = `<div class="card bad"><div class="title">Rendering error</div><pre class="muted">${esc(e && e.stack || e)}</pre>
      <p><a class="btn ghost" href="#/">Back to lobby</a></p></div>`;
  } finally {
    rendering = false;
    if (renderQueued) { renderQueued = false; queueMicrotask(render); }
  }
}

// ---------------------------------------------------------------- Globale Fehler → Toast
window.addEventListener('error', e => {
  const msg = e && e.message ? e.message : 'Unknown error';
  console.error(e.error || e);
  toast('Error: ' + msg, 'bad');
});
window.addEventListener('unhandledrejection', e => {
  const r = e && e.reason;
  const msg = r && r.message ? r.message : String(r || 'Unknown error');
  console.error(r);
  toast('Error: ' + msg, 'bad');
});

// Tastatur: Strg+Z / Cmd+Z → Rückgängig (nur außerhalb von Eingabefeldern, nur mit Spiel)
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (net) { e.preventDefault(); undo(); }
  }
});

installKeywordInfo();   // [KEYWORD] tags everywhere open their rule
tutorial.installTutorialLinks();   // [data-tut-ref] chips open the original core rule section
startI18n();           // German interface (js/i18n.js)
window.addEventListener('hashchange', () => { route(); });
route();
// App start (Android app only, with internet): offer new unit data / a new app version in a popup
setTimeout(() => { checkOnOpen().catch(e => console.warn('update check', e)); }, 1200);

// Für Debugging in der Konsole
window.sb40k = { store, nav, dispatch, undo, data, get net() { return net; } };
