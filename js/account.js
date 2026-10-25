/* Account on the online server (server/online-server.mjs + server/auth.js): sign in, and keep this device's army lists
 * (js/builder/store.js) and finished games (js/archive.js) in sync with the account – build a list on the PC, use it on
 * the phone at the game night. Games themselves still run where they are hosted (the host device's app on the LAN, or
 * the online server for players apart).
 *   mode 'same'   – the page comes from the online server itself (e.g. an iPhone browser on the domain): cookie
 *                   session (HttpOnly, SameSite=Strict); without a session the app shows the sign-in screen first.
 *   mode 'remote' – any other page (installed app on 127.0.0.1, LAN test server): the online server is reached by its
 *                   address with a Bearer token, kept in localStorage like the other settings.
 * The lists always stay on the device too (offline everything keeps working). Sync: the newer updatedAt wins, equal →
 * the account; lists that were only on this device before signing in are uploaded only when the user says so.
 *   initAccount(), needsLogin(), accountInfo(), onAccount(fn), login(), register(), logout(), changePassword(),
 *   sync(), uploadLocal(), localOnly(), serverAddress(), DEFAULT_SERVER */
import { listArmies, saveArmy, deleteArmy, onArmyChange } from './builder/store.js';
import { listFinished, loadFinished, saveFinished, deleteFinished, onArchiveChange, archiveId } from './archive.js';

/** Address of the online server offered in the installed apps (editable there): the PC's own domain (ONLINE.md). */
export const DEFAULT_SERVER = 'https://battlereport.jlpicture.de';   // the online server for the account sync (Online-Https.cmd on the PC, own domain)

const LS = 'br40k.account';
const fresh = () => ({ synced: {}, pending: [], pendingDel: [], arch: {}, archDel: [], offered: false });
let cfg = readCfg();
const st = { mode: 'none', user: null, syncing: false, lastSync: null, error: null, offline: false };
const subs = new Set();

function readCfg() {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || 'null');
    if (v && typeof v === 'object') {
      const c = Object.assign(fresh(), v);
      // the online server moved (tunnel address → own domain): the account and its token are the same server's – they
      // move with it, nobody has to sign in again after an update
      if (c.server && c.server !== DEFAULT_SERVER && !/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/i.test(c.server)) { c.server = DEFAULT_SERVER; try { localStorage.setItem(LS, JSON.stringify(c)); } catch {} }
      return c;
    }
  } catch {}
  return Object.assign(fresh(), { server: '', user: null, token: null });
}
function saveCfg() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) { console.warn('account settings', e); } }
function emit(ev) { for (const fn of subs) { try { fn(ev, accountInfo()); } catch (e) { console.error(e); } } }
/** fn(event, info) – events: 'login', 'logout', 'sync', 'change', 'offer' (local lists could be uploaded). */
export function onAccount(fn) { subs.add(fn); return () => subs.delete(fn); }

// "Continue without account" on the online server's website: the page runs from the browser's storage like the app
const GUEST_KEY = 'br40k.guest';
let guest = false;
try { guest = localStorage.getItem(GUEST_KEY) === '1'; } catch {}
function setGuest(v) { guest = !!v; try { if (v) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); } catch {} }
export function continueAsGuest() { setGuest(true); emit('guest'); }
export const needsLogin = () => st.mode === 'same' && !st.user && !guest;
/** On the online server without an account (after "Continue without account"). */
export const isGuest = () => st.mode === 'same' && !st.user && guest;
export const serverAddress = () => (st.mode === 'same' ? location.origin : cfg.server || DEFAULT_SERVER || '');
export function accountInfo() {
  return { mode: st.mode, user: st.user, guest: isGuest(), server: serverAddress(), syncing: st.syncing, lastSync: st.lastSync, error: st.error, offline: st.offline, localOnly: st.user ? localOnly().length : 0, lastUser: cfg.user || '' };
}

/** Signed in with the account from the installed app (token) – online games can be created and opened. */
export const canOnline = () => !!(st.user && (st.mode === 'remote' || st.mode === 'same'));
/** Create a game on the online server with the account. → { code } */
export async function createOnlineGame(names) {
  if (!canOnline()) throw new Error('Sign in under Account first');
  return req('POST', '/api/games', names && names.length ? { names } : {});
}
/** Address that opens the website signed in at this hash (the app's token becomes a cookie session there). */
export async function onlineUrl(hash) {
  if (st.mode === 'same') return location.origin + '/' + (hash || '');
  const r = await req('POST', '/api/handoff', {});
  return cfg.server + '/handoff?c=' + encodeURIComponent(r.code) + '&to=' + encodeURIComponent(hash || '');
}

/** Normalised origin of a typed server address; http only for this PC itself (no passwords in clear text). */
export function normServer(s) {
  s = String(s || '').trim().replace(/\/+$/, '');
  if (!s) throw new Error('Enter the address of the online server');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { throw new Error('This is not a valid address'); }
  if (u.protocol === 'http:' && !/^(127\.0\.0\.1|localhost)$/i.test(u.hostname)) throw new Error('Use the https:// address of the online server');
  return u.origin;
}

// ------------------------------------------------------------ requests
async function req(method, path, body, o = {}) {
  const remote = (o.mode || st.mode) === 'remote';
  const base = remote ? (o.server || cfg.server) : '';
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = o.token !== undefined ? o.token : cfg.token;
  if (remote && token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: remote ? 'omit' : 'same-origin', mode: remote ? 'cors' : 'same-origin', signal: AbortSignal.timeout ? AbortSignal.timeout(o.timeout || 20000) : undefined });
  } catch (e) {
    throw Object.assign(new Error('The online server cannot be reached'), { offline: true });
  }
  let data = null;
  try { const t = await res.text(); data = t ? JSON.parse(t) : null; } catch { data = null; }
  if (res.status === 401 && data && data.login && !o.noSignout) signedOut();
  if (!res.ok) throw Object.assign(new Error((data && data.error) || 'Server error ' + res.status), { status: res.status, data });
  return data;
}
function signedOut() {
  if (!st.user) return;
  st.user = null;
  if (st.mode === 'remote') { cfg.token = null; saveCfg(); }
  emit('logout');
}
/** net.js: an /api request on this origin came back 401 (the session expired) → the sign-in screen. */
window.addEventListener('br-auth-required', () => { if (st.mode === 'same') signedOut(); });

// ------------------------------------------------------------ start
export async function initAccount() {
  let s = null;
  // the server may be restarting right now (an update): a failed or 5xx answer is retried a few times before the device
  // counts as not signed in – the session cookie / token is still there
  for (let i = 0; i < 4 && !s; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500));
    try {
      const r = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
      if (r.ok) s = await r.json();
      else if (r.status < 500) break;
    } catch {}
  }
  if (s && s.auth) {
    st.mode = 'same';
    st.user = s.user || null;
    if (st.user) adopt(location.origin, st.user, null);
  } else if (cfg.server && cfg.token && cfg.user) {
    st.mode = 'remote';
    st.user = cfg.user;   // offline: still signed in, the lists on the device keep working
  }
  if (st.user) setTimeout(() => { sync().catch(() => {}); reportLocalGames(true).catch(() => {}); }, 50);
}
/** The device's sync records belong to one account on one server; another account starts fresh. */
function adopt(server, user, token) {
  if (cfg.user !== user || (cfg.server || '') !== server) cfg = Object.assign(fresh(), { server, user, token: null });
  cfg.server = server; cfg.user = user;
  if (token !== null) cfg.token = token;
  saveCfg();
}

// ------------------------------------------------------------ sign in / out
export async function login({ username, password, server }) {
  return signIn('/api/login', { username, password }, server);
}
export async function register({ username, password, invite, server }) {
  return signIn('/api/register', { username, password, invite }, server);
}
async function signIn(path, body, server) {
  if (st.mode === 'same') {
    const r = await req('POST', path, body, { noSignout: true });
    st.user = r.user;
    adopt(location.origin, r.user, null);
  } else {
    const origin = normServer(server);
    const r = await req('POST', path, Object.assign({ token: true }, body), { mode: 'remote', server: origin, token: null, noSignout: true });
    st.mode = 'remote';
    st.user = r.user;
    adopt(origin, r.user, r.token);
  }
  st.error = null;
  setGuest(false);
  emit('login');
  sync().catch(() => {});
  return st.user;
}
/** Sign out: what is safe in the account is removed from this device (it comes back when signing in again); lists
 *  changed here that could not be uploaded yet stay. */
export async function logout() {
  try { await sync(); } catch {}
  try { await req('POST', '/api/logout', {}, { noSignout: true, timeout: 6000 }); } catch {}
  const synced = cfg.synced || {};
  for (const a of listArmies()) if (synced[a.id] && String(a.updatedAt || '') <= synced[a.id] && !cfg.pending.includes(a.id)) deleteArmy(a.id, { silent: true });
  for (const m of listFinished()) { const e = loadFinished(m.code); if (e && cfg.arch[archiveId(e)]) deleteFinished(m.code, { silent: true }); }
  cfg = Object.assign(fresh(), { server: cfg.server, user: cfg.user, token: null });
  saveCfg();
  st.user = null;
  if (st.mode === 'remote') st.mode = 'none';
  emit('logout');
}
export async function changePassword(old, password) {
  const r = await req('POST', '/api/password', { old, password });
  if (r && r.token) { cfg.token = r.token; saveCfg(); }
  return true;
}

// ------------------------------------------------------------ sync
let applying = false;              // the sync writes to the device itself – not a change by the user
let syncing = null, again = false, timer = null;
const later = (ms = 1500) => { clearTimeout(timer); timer = setTimeout(() => sync().catch(() => {}), ms); };

onArmyChange((kind, v) => {
  if (applying || !st.user) return;
  if (kind === 'save') { if (!cfg.pending.includes(v.id)) cfg.pending.push(v.id); }
  else { cfg.pending = cfg.pending.filter(x => x !== v); if (cfg.synced[v]) { delete cfg.synced[v]; if (!cfg.pendingDel.includes(v)) cfg.pendingDel.push(v); } }
  saveCfg();
  later();
});
onArchiveChange((kind, e) => {
  if (applying || !st.user) return;
  const id = archiveId(e);
  if (kind === 'delete') { delete cfg.arch[id]; if (!cfg.archDel.includes(id)) cfg.archDel.push(id); }
  else cfg.archDel = cfg.archDel.filter(x => x !== id);
  saveCfg();
  later();
});
window.addEventListener('online', () => { if (st.user) later(300); });
document.addEventListener('visibilitychange', () => { if (st.user && document.visibilityState === 'visible' && (!st.lastSync || Date.now() - st.lastSync > 60000)) later(300); });

/* The installed app reports the games it hosts in its Wi-Fi (LAN address + codes) to the online server while signed
 * in, every minute while the app is visible – the website then lists them under "Join game" with links into the Wi-Fi
 * (a browser cannot discover Wi-Fi games itself). Nothing is reported without an account or without a Wi-Fi address. */
let lastLocalKey = '';
export async function reportLocalGames(force = false) {
  if (!window.BR || st.mode !== 'remote' || !st.user || !cfg.token) return;
  let info = null, list = null;
  try {
    [info, list] = await Promise.all([fetch('/api/info', { cache: 'no-store' }).then(r => r.json()), fetch('/api/games', { cache: 'no-store' }).then(r => r.json())]);
  } catch { return; }
  const lan = info && Array.isArray(info.lan) && info.lan[0];
  if (!lan || !info.port) return;
  const games = (Array.isArray(list) ? list : []).filter(g => g && g.stage !== 'over').map(g => ({ code: g.code, stage: g.stage, players: g.players || [] }));
  const body = { host: `${lan}:${info.port}`, device: (window.BR.platform && window.BR.platform()) || 'app', games };
  const key = JSON.stringify(body);
  if (!force && key === lastLocalKey && Date.now() - (reportLocalGames.at || 0) < 55000) return;
  try { await req('POST', '/api/local-games', body, { timeout: 8000, noSignout: true }); lastLocalKey = key; reportLocalGames.at = Date.now(); } catch {}
}
setInterval(() => { if (document.visibilityState === 'visible') reportLocalGames().catch(() => {}); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reportLocalGames().catch(() => {}); });
/** The signed-in account's Wi-Fi games on its other devices (website) → [{ host, device, games: [{ code, stage, players }] }] */
export async function localGamesOfAccount() {
  if (st.mode !== 'same' || !st.user) return [];
  const r = await req('GET', '/api/local-games', undefined, { timeout: 8000, noSignout: true });
  return (r && r.hosts) || [];
}

/** Lists on this device that are not in the account (and were not made while signed in). */
export function localOnly() {
  return listArmies().filter(a => !cfg.synced[a.id] && !cfg.pending.includes(a.id));
}
/** Uploads the lists that were only on this device. */
export async function uploadLocal(ids) {
  const list = localOnly().filter(a => !ids || ids.includes(a.id));
  for (const a of list) if (!cfg.pending.includes(a.id)) cfg.pending.push(a.id);
  saveCfg();
  await sync();
  return list.length;
}

export function sync() {
  if (!st.user) return Promise.resolve(false);
  if (syncing) { again = true; return syncing; }
  st.syncing = true;
  emit('change');
  syncing = (async () => {
    try {
      const pulled = (await syncArmies()) + (await syncArchive());
      st.lastSync = Date.now(); st.error = null; st.offline = false;
      if (pulled) emit('sync');
      if (!cfg.offered && localOnly().length) { cfg.offered = true; saveCfg(); emit('offer'); }
      return true;
    } catch (e) {
      st.error = e.message; st.offline = !!e.offline;
      throw e;
    } finally {
      saveCfg();
      st.syncing = false; syncing = null;
      emit('change');
      if (again) { again = false; later(200); }
    }
  })();
  return syncing;
}

const enc = encodeURIComponent;
function writeLocalArmy(a) { applying = true; try { return saveArmy(a, { keepStamp: true, silent: true }); } finally { applying = false; } }

/** → number of lists changed on this device */
async function syncArmies() {
  let changed = 0;
  for (const id of cfg.pendingDel.slice()) {
    await req('DELETE', '/api/armies/' + enc(id));
    cfg.pendingDel = cfg.pendingDel.filter(x => x !== id);
  }
  const r = await req('GET', '/api/armies');
  const remote = new Map((r.armies || []).map(a => [a.id, a]));
  const deleted = r.deleted || {};
  const local = new Map(listArmies().map(a => [a.id, a]));
  const pull = async id => { const a = await req('GET', '/api/armies/' + enc(id)); if (a && writeLocalArmy(a)) { cfg.synced[id] = a.updatedAt; changed++; } };
  const push = async a => {
    try { await req('PUT', '/api/armies/' + enc(a.id), a); cfg.synced[a.id] = a.updatedAt; }
    catch (e) { if (e.status === 409 && e.data && e.data.army && writeLocalArmy(e.data.army)) { cfg.synced[a.id] = e.data.army.updatedAt; changed++; } else throw e; }
    cfg.pending = cfg.pending.filter(x => x !== a.id);
  };
  for (const [id, m] of remote) {
    const l = local.get(id);
    if (!l) { await pull(id); continue; }
    const lu = String(l.updatedAt || ''), ru = String(m.updatedAt || '');
    if (lu > ru) await push(l);
    else { if (ru > lu) await pull(id); else cfg.synced[id] = ru; cfg.pending = cfg.pending.filter(x => x !== id); }
  }
  for (const [id, l] of local) {
    if (remote.has(id)) continue;
    const lu = String(l.updatedAt || '');
    const gone = deleted[id] && String(deleted[id]) > lu;   // deleted in the account (on another device) after the last change here
    if (cfg.pending.includes(id)) {
      if (gone) { applying = true; try { deleteArmy(id, { silent: true }); } finally { applying = false; } cfg.pending = cfg.pending.filter(x => x !== id); changed++; }
      else await push(l);
    } else if (cfg.synced[id]) {
      if (lu > cfg.synced[id]) await push(l);        // changed here since: keep it
      else { applying = true; try { deleteArmy(id, { silent: true }); } finally { applying = false; } delete cfg.synced[id]; changed++; }
    }
    // else: only on this device – uploaded when the user says so (uploadLocal)
  }
  return changed;
}

async function syncArchive() {
  let changed = 0;
  for (const id of cfg.archDel.slice()) {
    await req('DELETE', '/api/archive/' + enc(id));
    cfg.archDel = cfg.archDel.filter(x => x !== id);
  }
  const r = await req('GET', '/api/archive');
  const remote = new Map((r.games || []).map(g => [g.id, g]));
  const deleted = r.deleted || {};
  const locals = listFinished().map(m => loadFinished(m.code)).filter(e => e && e.code);
  const byId = new Map(locals.map(e => [archiveId(e), e]));
  const write = e => { applying = true; try { return saveFinished(e, { silent: true }); } finally { applying = false; } };
  const push = async (id, e) => {
    try { await req('PUT', '/api/archive/' + enc(id), e); cfg.arch[id] = e.savedAt; }
    catch (err) { if (err.status !== 409) throw err; }
  };
  for (const [id, e] of byId) {
    const rm = remote.get(id);
    if (!rm) {
      if (deleted[id]) { if (cfg.arch[id]) { applying = true; try { deleteFinished(e.code, { silent: true }); } finally { applying = false; } delete cfg.arch[id]; changed++; } continue; }
      await push(id, e);
    } else if (String(e.savedAt || '') > String(rm.savedAt || '')) await push(id, e);
    else if (String(rm.savedAt || '') > String(e.savedAt || '')) { const full = await req('GET', '/api/archive/' + enc(id)); if (full && write(full)) { cfg.arch[id] = full.savedAt; changed++; } }
    else cfg.arch[id] = rm.savedAt;
  }
  for (const [id, rm] of remote) {
    if (byId.has(id)) continue;
    // this device keeps one finished game per code: an older game with the same code stays only in the account
    const same = locals.find(e => e.code === rm.code);
    if (same && String(same.savedAt || '') >= String(rm.savedAt || '')) continue;
    const full = await req('GET', '/api/archive/' + enc(id));
    if (full && write(full)) { cfg.arch[id] = full.savedAt; changed++; }
  }
  return changed;
}
