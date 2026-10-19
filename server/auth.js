/* Battle Report 40k – accounts for the online server (server/online-server.mjs). No npm dependencies (node:crypto only).
 *
 *   const auth = createAuth({ dataDir, log, limits })
 *   await auth.init()
 *   startGameServer({ …, auth })        // game-server.js calls the hooks below
 *
 * Data (all below dataDir, outside the repo):
 *   users.json      { users: { <name>: { salt, hash, created, pwChangedAt } } }  – scrypt, per-user salt
 *   invites.json    { invites: { <CODE>: { created } } }                         – single use: removed on register
 *   sessions.json   { <sha256(token)>: { user, kind: 'cookie'|'token', created, expires, touched } }
 *   members.json    { <GAME CODE>: { creator, members: [names], at } }           – who created / joined which game
 *   armies/<user>/<id>.json, armies/<user>/_deleted.json   – the user's army lists (+ tombstones for the other devices)
 *   archive/<user>/<id>.json, archive/<user>/_deleted.json – finished games (id = CODE-<createdAt base36>)
 * users.json / invites.json are re-read when they change on disk (the admin CLI writes them while the server runs).
 * Requests through the Cloudflare tunnel arrive from 127.0.0.1 with CF-Connecting-IP / X-Forwarded-* headers: only then
 * are those headers trusted (client IP, https); the admin page answers only on 127.0.0.1 WITHOUT those headers. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const USER_RE = /^[a-z0-9_-]{3,24}$/;
const ARMY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ARCHIVE_ID_RE = /^[A-Z]{4}(-[a-z0-9]{1,16})?$/;
const INVITE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;
const TOUCH_MS = 3600 * 1000;           // sliding expiry: renewed at most once an hour
const PURGE_MS = 15 * 60 * 1000;        // expired sessions / stale rate-limit counters are dropped this often
const COOKIE = 'br_session';
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;
const LIMIT_AUTH_BODY = 16 * 1024;
const LIMIT_ARMY = 2 * 1024 * 1024;
const LIMIT_ARCHIVE = 8 * 1024 * 1024;
const MAX_ARMIES = 500, MAX_ARCHIVE = 2000;
const APP_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;   // the installed apps' own pages (Electron / Android)
const TUNNEL_HEADERS = ['cf-connecting-ip', 'cf-ray', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'cdn-loop', 'forwarded'];

/** Id of a finished game in an account: the code alone repeats over time, so the creation time is part of it.
 *  Same rule as js/archive.js archiveId(). */
export function archiveId(entry) {
  const code = String((entry && entry.code) || '').toUpperCase();
  const t = Date.parse(entry && entry.state && entry.state.createdAt);
  return Number.isFinite(t) ? code + '-' + t.toString(36) : code;
}

export function createAuth(opts = {}) {
  const DIR = path.resolve(opts.dataDir || '.');
  const log = opts.log || console;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const L = Object.assign({ loginFails: 10, loginWindowMs: 15 * 60 * 1000, registerTries: 10, registerWindowMs: 60 * 60 * 1000 }, opts.limits || {});
  const F = { users: path.join(DIR, 'users.json'), invites: path.join(DIR, 'invites.json'), sessions: path.join(DIR, 'sessions.json'), members: path.join(DIR, 'members.json') };

  // ------------------------------------------------------------ files
  function readJsonFile(file, dflt) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') log.error('Could not read', file, e.message); return dflt; }
  }
  function writeJsonFile(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
    for (let i = 0; ; i++) {
      try { fs.renameSync(tmp, file); return; }
      catch (e) { if (i >= 5 || !/EPERM|EBUSY|EACCES/.test(e.code)) { try { fs.unlinkSync(tmp); } catch {} throw e; } }
      const until = Date.now() + 20 * (i + 1); while (Date.now() < until) { /* short wait: a reader holds the file (Windows) */ }
    }
  }
  /** A JSON file that is re-read when another process (the admin CLI) changed it. */
  function shared(file, dflt) {
    let cache = null, mtime = -1;
    return {
      get() {
        let m = 0;
        try { m = fs.statSync(file).mtimeMs; } catch { m = 0; }
        if (cache === null || m !== mtime) { cache = readJsonFile(file, dflt()); mtime = m; }
        return cache;
      },
      /** read-modify-write against the file's current content */
      update(fn) {
        cache = null;
        const v = this.get();
        const r = fn(v);
        writeJsonFile(file, v);
        try { mtime = fs.statSync(file).mtimeMs; } catch {}
        cache = v;
        return r;
      }
    };
  }
  const usersF = shared(F.users, () => ({ users: {} }));
  const invitesF = shared(F.invites, () => ({ invites: {} }));
  const users = () => usersF.get().users || {};

  // server-only state, written debounced
  let sessions = {}, members = {};
  const dirty = { sessions: false, members: false };
  let flushTimer = null, ready = false;
  function markDirty(k) {
    if (!ready) return;   // the admin CLI (no init): sessions / members belong to the running server – it checks the user itself
    dirty[k] = true;
    if (!flushTimer) flushTimer = setTimeout(flush, 1000);
  }
  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    try {
      if (dirty.sessions) { dirty.sessions = false; writeJsonFile(F.sessions, sessions); }
      if (dirty.members) { dirty.members = false; writeJsonFile(F.members, members); }
    } catch (e) { log.error('Saving account data failed', e); }
  }

  /** Loads sessions / members from disk (again – a successor server calls it once more right before it takes over). */
  async function init() {
    fs.mkdirSync(DIR, { recursive: true });
    sessions = readJsonFile(F.sessions, {});
    members = readJsonFile(F.members, {});
    ready = true;
    purge();
    flush();
    if (!purgeTimer) { purgeTimer = setInterval(purge, PURGE_MS); if (purgeTimer.unref) purgeTimer.unref(); }
  }
  /** Memory hygiene: expired sessions and stale rate-limit counters go (also called periodically). → counts */
  let purgeTimer = null;
  function purge() {
    const t = now();
    let sess = 0, counters = 0;
    for (const [k, s] of Object.entries(sessions)) if (!s || !(s.expires > t)) { delete sessions[k]; sess++; }
    if (sess) dirty.sessions = true;
    const windowMs = Math.max(L.loginWindowMs, L.registerWindowMs);
    for (const [k, arr] of hits) {
      const keep = arr.filter(x => t - x < windowMs);
      if (keep.length) hits.set(k, keep); else { hits.delete(k); counters++; }
    }
    return { sessions: sess, counters, sessionsLeft: Object.keys(sessions).length, countersLeft: hits.size };
  }

  // ------------------------------------------------------------ passwords
  const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(String(pw), salt, KEYLEN, SCRYPT, (e, k) => (e ? rej(e) : res(k))));
  async function hashPassword(pw) {
    const salt = crypto.randomBytes(16);
    return { salt: salt.toString('base64'), hash: (await scrypt(pw, salt)).toString('base64') };
  }
  const DUMMY = { salt: crypto.randomBytes(16).toString('base64'), hash: crypto.randomBytes(KEYLEN).toString('base64') };
  async function checkPassword(rec, pw) {
    const r = rec || DUMMY;   // unknown user: same work, so the time does not tell whether the name exists
    const want = Buffer.from(r.hash, 'base64');
    const got = await scrypt(pw, Buffer.from(r.salt, 'base64'));
    return !!rec && want.length === got.length && crypto.timingSafeEqual(want, got);
  }
  const validPassword = pw => typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;
  const normName = n => String(n == null ? '' : n).trim().toLowerCase();

  // ------------------------------------------------------------ users / invites (also used by the admin CLI)
  function createInvites(n = 1) {
    const out = [];
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const pick = () => { let s = ''; const b = crypto.randomBytes(8); for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return s.slice(0, 4) + '-' + s.slice(4); };
    invitesF.update(v => {
      v.invites = v.invites || {};
      for (let i = 0; i < Math.max(1, Math.min(100, n | 0)); i++) { let c; do c = pick(); while (v.invites[c]); v.invites[c] = { created: new Date(now()).toISOString() }; out.push(c); }
    });
    return out;
  }
  const listInvites = () => Object.entries(invitesF.get().invites || {}).map(([code, i]) => ({ code, created: i.created }));
  function revokeInvite(code) { return invitesF.update(v => { const had = !!(v.invites && v.invites[code]); if (had) delete v.invites[code]; return had; }); }
  const listUsers = () => Object.entries(users()).map(([name, u]) => ({
    name, created: u.created,
    armies: countFiles(path.join(DIR, 'armies', name)), archive: countFiles(path.join(DIR, 'archive', name)),
    sessions: Object.values(sessions).filter(s => s.user === name).length
  }));
  function countFiles(d) { try { return fs.readdirSync(d).filter(f => f.endsWith('.json') && !f.startsWith('_')).length; } catch { return 0; } }
  async function setPassword(name, pw) {
    name = normName(name);
    if (!USER_RE.test(name) || !users()[name]) throw httpError(404, 'No such user');
    if (!validPassword(pw)) throw httpError(400, 'The password needs at least 8 characters');
    const h = await hashPassword(pw);
    usersF.update(v => { Object.assign(v.users[name], h, { pwChangedAt: now() }); });
    dropSessions(name);
  }
  function deleteUser(name) {
    name = normName(name);
    if (!USER_RE.test(name)) throw httpError(400, 'Invalid user name');
    const had = usersF.update(v => { const h = !!v.users[name]; delete v.users[name]; return h; });
    if (!had) throw httpError(404, 'No such user');
    for (const kind of ['armies', 'archive']) { try { fs.rmSync(userDir(kind, name), { recursive: true, force: true }); } catch {} }
    dropSessions(name);
    for (const m of Object.values(members)) { m.members = (m.members || []).filter(u => u !== name); if (m.creator === name) m.creator = null; }
    markDirty('members');
  }
  function dropSessions(name, except) {
    for (const [k, s] of Object.entries(sessions)) if (s.user === name && k !== except) delete sessions[k];
    markDirty('sessions');
  }
  const tempPassword = () => crypto.randomBytes(9).toString('base64url');

  // ------------------------------------------------------------ request helpers
  const sock = req => String((req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
  const loopback = req => /^(::1|127\.\d+\.\d+\.\d+)$/.test(sock(req));
  const tunneled = req => loopback(req) && TUNNEL_HEADERS.some(h => req.headers[h] != null);
  function clientIp(req) {
    if (loopback(req)) {
      const cf = req.headers['cf-connecting-ip'];
      if (cf) return String(cf).trim().slice(0, 64);
      const xff = req.headers['x-forwarded-for'];
      if (xff) return String(xff).split(',')[0].trim().slice(0, 64);
    }
    return sock(req);
  }
  function isHttps(req) {
    if (req.socket && req.socket.encrypted) return true;
    if (!loopback(req)) return false;
    if (String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https') return true;
    return /"scheme"\s*:\s*"https"/.test(String(req.headers['cf-visitor'] || ''));
  }
  /** Admin page: only this PC itself, directly (not through the tunnel), and only under its own local host name
   *  (Host check against DNS rebinding). */
  function isLocalAdmin(req) {
    if (!loopback(req) || tunneled(req)) return false;
    return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(req.headers.host || ''));
  }
  function cookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
  }
  const tokenKey = t => crypto.createHash('sha256').update(String(t)).digest('hex');
  function bearer(req) {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(String(req.headers.authorization || ''));
    return m ? m[1] : null;
  }

  // ------------------------------------------------------------ sessions
  function newSession(name, kind) {
    const token = crypto.randomBytes(32).toString('base64url');
    const t = now();
    sessions[tokenKey(token)] = { user: name, kind, created: t, touched: t, expires: t + SESSION_MS };
    markDirty('sessions');
    return token;
  }
  /** → { user, kind, key } of a valid session (Bearer token or cookie), or null. Renews the expiry (sliding). */
  function identify(req) {
    if (req.__auth !== undefined) return req.__auth;
    let tok = bearer(req), kind = 'token';
    if (!tok) { tok = cookies(req)[COOKIE]; kind = 'cookie'; }
    let out = null;
    if (tok && /^[A-Za-z0-9_-]{20,200}$/.test(tok)) {
      const key = tokenKey(tok);
      const s = sessions[key];
      const u = s && users()[s.user];
      const t = now();
      if (s && (s.expires < t || !u || s.created < (u.pwChangedAt || 0) || s.created < Date.parse(u.created || 0))) { delete sessions[key]; markDirty('sessions'); }
      else if (s) {
        if (t - (s.touched || 0) > TOUCH_MS) { s.touched = t; s.expires = t + SESSION_MS; markDirty('sessions'); }
        out = { user: s.user, kind, key };
      }
    }
    req.__auth = out;
    return out;
  }
  function sessionCookie(req, token, maxAge) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
  }

  /** A state-changing request authenticated by the cookie must come from this site's own page (SameSite=Strict does not
   *  stop other *.trycloudflare.com tunnels – they count as the same site). Bearer requests carry no ambient credentials. */
  function sameOriginOk(req) {
    const site = req.headers['sec-fetch-site'];
    if (site) return site === 'same-origin' || site === 'none';
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const host = String(req.headers['x-forwarded-host'] && loopback(req) ? req.headers['x-forwarded-host'] : req.headers.host || '').toLowerCase();
      return new URL(origin).host.toLowerCase() === host;
    } catch { return false; }
  }
  /** Called by the game server for every /api request that is not an auth route: → user name, or sends 401/403. */
  function requireUser(req, res) {
    const s = identify(req);
    if (!s) { sendJson(res, 401, { error: 'Please sign in', login: true }); return null; }
    if (s.kind === 'cookie' && req.method !== 'GET' && req.method !== 'HEAD' && !sameOriginOk(req)) { sendJson(res, 403, { error: 'Request from another site refused' }); return null; }
    return s.user;
  }

  // ------------------------------------------------------------ rate limits
  const hits = new Map();   // key → [timestamps]
  function hitCount(key, windowMs) {
    const t = now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (arr.length) hits.set(key, arr); else hits.delete(key);
    return arr.length;
  }
  function hit(key) { const arr = hits.get(key) || []; arr.push(now()); hits.set(key, arr); if (hits.size > 50000) hits.clear(); }
  function limited(res, windowMs) {
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    sendJson(res, 429, { error: 'Too many attempts – please wait a while and try again.' });
  }

  // ------------------------------------------------------------ CORS + security headers
  /** CORS only for the installed apps' own pages (http://127.0.0.1:* / http://localhost:*), never a wildcard, no
   *  credentials (the apps send a Bearer token). → true when the request was a preflight and is answered. */
  function cors(req, res) {
    const origin = req.headers.origin;
    const ok = origin && APP_ORIGIN.test(origin);
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (ok) {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
      }
      res.writeHead(ok ? 204 : 403, { 'Content-Length': 0 });
      res.end();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ game membership
  function onGameCreated(user, code) { members[code] = { creator: user, members: [user], at: new Date(now()).toISOString() }; markDirty('members'); }
  function onGameSeen(user, code) {
    const m = members[code] || (members[code] = { creator: null, members: [], at: new Date(now()).toISOString() });
    if (!m.members.includes(user)) { m.members.push(user); markDirty('members'); }
  }
  const canList = (user, code) => !!(members[code] && members[code].members.includes(user));
  const isCreator = (user, code) => !!(members[code] && members[code].creator === user);
  function onGameRemoved(code) { if (members[code]) { delete members[code]; markDirty('members'); } }
  /** The server closes a finished game: every account that played it gets it in its archive. */
  function onGameClosed(code, state, actions) {
    const m = members[code];
    if (m && state) {
      const entry = { code, savedAt: new Date(now()).toISOString(), state, actions: actions || [] };
      const id = archiveId(entry);
      for (const u of m.members) {
        if (!users()[u]) continue;
        try {
          const f = itemFile('archive', u, id);
          const old = readJsonFile(f, null);
          if (!old || String(old.savedAt || '') < entry.savedAt) writeJsonFile(f, entry);
        } catch (e) { log.error('Archiving', code, 'for', u, 'failed', e.message); }
      }
    }
    onGameRemoved(code);
  }

  // ------------------------------------------------------------ per-user files (armies, archive)
  function userDir(kind, user) {
    if (!USER_RE.test(user) || (kind !== 'armies' && kind !== 'archive')) throw httpError(400, 'Invalid user');
    const base = path.join(DIR, kind);
    const d = path.resolve(base, user);
    if (!d.startsWith(base + path.sep)) throw httpError(400, 'Invalid user');
    return d;
  }
  function itemFile(kind, user, id) {
    const re = kind === 'armies' ? ARMY_ID_RE : ARCHIVE_ID_RE;
    if (typeof id !== 'string' || !re.test(id)) throw httpError(400, 'Invalid id');
    const d = userDir(kind, user);
    const f = path.resolve(d, id + '.json');
    if (path.dirname(f) !== d) throw httpError(400, 'Invalid id');
    return f;
  }
  function listItems(kind, user) {
    const d = userDir(kind, user);
    let files = [];
    try { files = fs.readdirSync(d).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch {}
    return files.map(f => readJsonFile(path.join(d, f), null)).filter(Boolean);
  }
  const tombFile = (kind, user) => path.join(userDir(kind, user), '_deleted.json');
  function tombstones(kind, user) {
    const t = readJsonFile(tombFile(kind, user), {});
    const cut = new Date(now() - 180 * 24 * 3600 * 1000).toISOString();   // half a year is enough for every device to see it
    for (const [k, v] of Object.entries(t)) if (String(v) < cut) delete t[k];
    return t;
  }
  function setTomb(kind, user, id, on) {
    const t = tombstones(kind, user);
    if (on) t[id] = new Date(now()).toISOString(); else if (!(id in t)) return; else delete t[id];
    writeJsonFile(tombFile(kind, user), t);
  }
  function archiveMeta(e) {
    const s = e.state || {};
    const pl = s.players || [];
    const vpOf = p => (p && p.vp ? (p.vp.primary || 0) + (p.vp.secondary || 0) + (p.vp.bonus || 0) : 0);
    return { id: archiveId(e), code: e.code, savedAt: e.savedAt, players: pl.map(p => (p && p.name) || ''), vp: pl.map(vpOf), round: s.round || 0 };
  }

  // ------------------------------------------------------------ routes
  /** Auth, account and admin routes. → true when handled. */
  async function handle(req, res, url) {
    const p = url.pathname, m = req.method;
    if (p === '/admin' || p.startsWith('/admin/')) { await handleAdmin(req, res, url); return true; }
    if (!p.startsWith('/api/')) return false;
    const parts = p.split('/').filter(Boolean);

    if (p === '/api/session' && m === 'GET') {
      const s = identify(req);
      sendJson(res, 200, { auth: true, user: s ? s.user : null, kind: s ? s.kind : null });
      return true;
    }
    if (p === '/api/login' && m === 'POST') { await login(req, res); return true; }
    if (p === '/api/register' && m === 'POST') { await register(req, res); return true; }
    if (p === '/api/logout' && m === 'POST') {
      const s = identify(req);
      if (s) { delete sessions[s.key]; markDirty('sessions'); }
      res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/password' && m === 'POST') {
      const user = requireUser(req, res); if (!user) return true;
      const body = await readJson(req, LIMIT_AUTH_BODY);
      const ip = clientIp(req);
      if (hitCount('login:' + ip, L.loginWindowMs) >= L.loginFails) { limited(res, L.loginWindowMs); return true; }
      if (!(await checkPassword(users()[user], body.old))) { hit('login:' + ip); sendJson(res, 403, { error: 'The current password is wrong' }); return true; }
      if (!validPassword(body.password)) { sendJson(res, 400, { error: 'The password needs at least 8 characters' }); return true; }
      await setPassword(user, body.password);      // ends every session of the user …
      const s = identify(req);
      const token = newSession(user, s ? s.kind : 'cookie');   // … except a fresh one for this device
      if (!s || s.kind === 'cookie') res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor(SESSION_MS / 1000)));
      sendJson(res, 200, Object.assign({ ok: true }, s && s.kind === 'token' ? { token } : {}));
      return true;
    }
    if (parts[1] === 'armies' || parts[1] === 'archive') {
      const user = requireUser(req, res); if (!user) return true;
      await handleItems(parts[1], user, parts[2] ? decodeId(parts[2]) : null, req, res, parts.length);
      return true;
    }
    return false;
  }
  const decodeId = s => { try { return decodeURIComponent(s); } catch { return '\0'; } };

  async function login(req, res) {
    const body = await readJson(req, LIMIT_AUTH_BODY);
    const wantToken = body.token === true;
    if (!wantToken && !sameOriginOk(req)) return sendJson(res, 403, { error: 'Request from another site refused' });
    const ip = clientIp(req), name = normName(body.username);
    if (hitCount('login:' + ip, L.loginWindowMs) >= L.loginFails || (USER_RE.test(name) && hitCount('user:' + name, L.loginWindowMs) >= L.loginFails)) return limited(res, L.loginWindowMs);
    const rec = USER_RE.test(name) ? users()[name] : null;
    const ok = await checkPassword(rec, typeof body.password === 'string' ? body.password.slice(0, 200) : '');
    if (!ok) {
      hit('login:' + ip); if (USER_RE.test(name)) hit('user:' + name);
      return sendJson(res, 401, { error: 'Wrong user name or password' });
    }
    hits.delete('user:' + name);
    const token = newSession(name, wantToken ? 'token' : 'cookie');
    if (!wantToken) res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor(SESSION_MS / 1000)));
    log.log('Login: ' + name + ' (' + ip + ')');
    return sendJson(res, 200, Object.assign({ ok: true, user: name }, wantToken ? { token } : {}));
  }

  async function register(req, res) {
    const body = await readJson(req, LIMIT_AUTH_BODY);
    const wantToken = body.token === true;
    if (!wantToken && !sameOriginOk(req)) return sendJson(res, 403, { error: 'Request from another site refused' });
    const ip = clientIp(req);
    if (hitCount('register:' + ip, L.registerWindowMs) >= L.registerTries) return limited(res, L.registerWindowMs);
    hit('register:' + ip);
    const name = normName(body.username);
    const invite = String(body.invite == null ? '' : body.invite).trim().toUpperCase().replace(/\s+/g, '');
    if (!USER_RE.test(name)) return sendJson(res, 400, { error: 'User name: 3–24 characters, only a–z, 0–9, _ and -' });
    if (!validPassword(body.password)) return sendJson(res, 400, { error: 'The password needs at least 8 characters' });
    if (!INVITE_RE.test(invite) || !(invitesF.get().invites || {})[invite]) return sendJson(res, 403, { error: 'Invalid or already used invite code' });
    if (users()[name]) return sendJson(res, 409, { error: 'This user name is taken' });
    const h = await hashPassword(body.password);
    // invite check + use + user creation in one read-modify-write of each file (the code is gone before anyone else can use it)
    const used = invitesF.update(v => { if (!v.invites || !v.invites[invite]) return false; delete v.invites[invite]; return true; });
    if (!used) return sendJson(res, 403, { error: 'Invalid or already used invite code' });
    const made = usersF.update(v => { v.users = v.users || {}; if (v.users[name]) return false; v.users[name] = Object.assign({ created: new Date(now()).toISOString(), pwChangedAt: 0 }, h); return true; });
    if (!made) return sendJson(res, 409, { error: 'This user name is taken' });
    const token = newSession(name, wantToken ? 'token' : 'cookie');
    if (!wantToken) res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor(SESSION_MS / 1000)));
    log.log('New account: ' + name + ' (' + ip + ')');
    return sendJson(res, 201, Object.assign({ ok: true, user: name }, wantToken ? { token } : {}));
  }

  /** /api/armies[/id] and /api/archive[/id] – only the signed-in user's own files. */
  async function handleItems(kind, user, id, req, res, nParts) {
    const m = req.method;
    if (nParts > 3) throw httpError(404, 'Unknown route');
    if (!id) {
      if (m !== 'GET') throw httpError(405, 'Method not allowed');
      const items = listItems(kind, user);
      if (kind === 'armies') return sendJson(res, 200, { armies: items.map(a => ({ id: a.id, name: a.name || '', faction: a.faction || null, updatedAt: a.updatedAt || null })), deleted: tombstones(kind, user) });
      return sendJson(res, 200, { games: items.map(archiveMeta).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))), deleted: tombstones(kind, user) });
    }
    const f = itemFile(kind, user, id);
    if (m === 'GET') {
      const v = readJsonFile(f, null);
      if (!v) throw httpError(404, 'Not found');
      return sendJson(res, 200, v);
    }
    if (m === 'PUT') {
      const body = await readJson(req, kind === 'armies' ? LIMIT_ARMY : LIMIT_ARCHIVE);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'JSON object expected');
      const old = readJsonFile(f, null);
      if (kind === 'armies') {
        if (body.id !== id) throw httpError(400, 'The id in the list does not match');
        if (typeof body.updatedAt !== 'string' || !body.updatedAt) throw httpError(400, 'updatedAt missing');
        // the account wins: an older copy from a device that was offline does not overwrite a newer list
        if (old && String(old.updatedAt || '') > body.updatedAt) return sendJson(res, 409, { error: 'The account has a newer version of this list', army: old });
      } else {
        if (!/^[A-Z]{4}$/.test(String(body.code || '')) || archiveId(body) !== id) throw httpError(400, 'The id does not match the game');
        if (!body.state || typeof body.state !== 'object') throw httpError(400, 'state missing');
        if (old && String(old.savedAt || '') > String(body.savedAt || '')) return sendJson(res, 409, { error: 'The account has a newer copy of this game', game: archiveMeta(old) });
      }
      if (!old && listItems(kind, user).length >= (kind === 'armies' ? MAX_ARMIES : MAX_ARCHIVE)) throw httpError(413, 'Too many entries in this account');
      writeJsonFile(f, body);
      setTomb(kind, user, id, false);
      return sendJson(res, 200, { ok: true, id, updatedAt: body.updatedAt || null, savedAt: body.savedAt || null });
    }
    if (m === 'DELETE') {
      try { fs.unlinkSync(f); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      setTomb(kind, user, id, true);
      return sendJson(res, 200, { ok: true, id });
    }
    throw httpError(405, 'Method not allowed');
  }

  // ------------------------------------------------------------ admin page (this PC only, not through the tunnel)
  async function handleAdmin(req, res, url) {
    if (!isLocalAdmin(req)) throw httpError(404, 'Not found');
    const p = url.pathname, m = req.method;
    if ((p === '/admin' || p === '/admin/') && m === 'GET') return sendText(res, 200, 'text/html; charset=utf-8', ADMIN_HTML);
    if (p === '/admin/admin.js' && m === 'GET') return sendText(res, 200, 'text/javascript; charset=utf-8', ADMIN_JS);
    if (!p.startsWith('/admin/api/')) throw httpError(404, 'Not found');
    // only the admin page itself: a custom header (needs a CORS preflight, which is refused) + own origin
    const origin = req.headers.origin;
    if (req.headers['x-admin-request'] !== '1' || (origin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin)) || (origin && new URL(origin).host !== String(req.headers.host))) throw httpError(403, 'Forbidden');
    const what = p.slice('/admin/api/'.length);
    if (what === 'state' && m === 'GET') return sendJson(res, 200, { users: listUsers(), invites: listInvites() });
    if (m !== 'POST') throw httpError(405, 'Method not allowed');
    const body = await readJson(req, LIMIT_AUTH_BODY);
    if (what === 'invite') return sendJson(res, 200, { codes: createInvites(Number(body.n) || 1) });
    if (what === 'revoke-invite') return sendJson(res, 200, { ok: revokeInvite(String(body.code || '')) });
    if (what === 'reset-password') { const pw = tempPassword(); await setPassword(body.user, pw); return sendJson(res, 200, { ok: true, password: pw }); }
    if (what === 'delete-user') { deleteUser(body.user); return sendJson(res, 200, { ok: true }); }
    throw httpError(404, 'Not found');
  }

  function stop() { if (purgeTimer) { clearInterval(purgeTimer); purgeTimer = null; } flush(); }

  return {
    init, stop, flush, purge, handle, cors, identify, requireUser, clientIp, isHttps, isLocalAdmin, tunneled,
    onGameCreated, onGameSeen, canList, isCreator, onGameRemoved, onGameClosed,
    createInvites, listInvites, revokeInvite, listUsers, setPassword, deleteUser, tempPassword
  };
}

// ---------------------------------------------------------------- helpers
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function sendText(res, status, type, text) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, done = false;
    const fail = e => { if (!done) { done = true; reject(e); } };
    if (Number(req.headers['content-length']) > limit) { fail(httpError(413, 'Request too large')); req.resume(); return; }
    req.on('data', c => { size += c.length; if (size > limit) { fail(httpError(413, 'Request too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      if (done) return; done = true;
      const t = Buffer.concat(chunks).toString('utf8');
      if (!t.trim()) return resolve({});
      try { resolve(JSON.parse(t)); } catch { reject(httpError(400, 'Invalid JSON')); }
    });
    req.on('error', fail);
  });
}

const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Battle Report 40k – online server admin</title>
<style>body{font:15px system-ui,sans-serif;background:#0f1216;color:#e8e6e1;margin:0;padding:24px;max-width:900px}h1{font-size:20px}h2{font-size:16px;margin-top:28px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #2a2f36;padding:6px 8px;text-align:left}button{background:#2a3340;color:#fff;border:1px solid #3d4757;border-radius:6px;padding:6px 12px;cursor:pointer}
button.danger{background:#5a1f1f;border-color:#7a2a2a}code{background:#1c2128;padding:2px 6px;border-radius:4px}.muted{color:#9aa0a6}#out{margin:12px 0;padding:10px;background:#1c2128;border-radius:6px;display:none;white-space:pre-wrap}</style>
</head><body><h1>Battle Report 40k – online server</h1><p class="muted">This page only works on this PC (http://127.0.0.1), never through the tunnel.</p>
<div id="out"></div>
<h2>Invite codes</h2><p><button id="inv1">New invite code</button> <button id="inv5">5 codes</button></p><table id="invites"></table>
<h2>Users</h2><table id="users"></table><script src="/admin/admin.js"></script></body></html>`;

const ADMIN_JS = `const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(what, body) {
  const r = await fetch('/admin/api/' + what, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'X-Admin-Request': '1' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}
function show(t) { const o = $('#out'); o.style.display = 'block'; o.textContent = t; }
async function load() {
  const s = await api('state');
  $('#invites').innerHTML = '<tr><th>Code</th><th>Created</th><th></th></tr>' + (s.invites.map(i => '<tr><td><code>' + esc(i.code) + '</code></td><td>' + esc(i.created) + '</td><td><button data-revoke="' + esc(i.code) + '">Revoke</button></td></tr>').join('') || '<tr><td colspan="3" class="muted">No open invite codes</td></tr>');
  $('#users').innerHTML = '<tr><th>User</th><th>Since</th><th>Armies</th><th>Finished games</th><th>Sessions</th><th></th></tr>' + (s.users.map(u => '<tr><td>' + esc(u.name) + '</td><td>' + esc(String(u.created || '').slice(0, 10)) + '</td><td>' + u.armies + '</td><td>' + u.archive + '</td><td>' + u.sessions + '</td><td><button data-reset="' + esc(u.name) + '">Reset password</button> <button class="danger" data-del="' + esc(u.name) + '">Delete</button></td></tr>').join('') || '<tr><td colspan="6" class="muted">No users yet</td></tr>');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.id === 'inv1' || b.id === 'inv5') { const r = await api('invite', { n: b.id === 'inv1' ? 1 : 5 }); show('New invite code(s) – each works once:\\n' + r.codes.join('\\n')); }
    else if (b.dataset.revoke) await api('revoke-invite', { code: b.dataset.revoke });
    else if (b.dataset.reset && confirm('Reset the password of ' + b.dataset.reset + '? All their devices are signed out.')) { const r = await api('reset-password', { user: b.dataset.reset }); show('Temporary password for ' + b.dataset.reset + ': ' + r.password + '\\n(they can change it under Account → Change password)'); }
    else if (b.dataset.del && confirm('Delete ' + b.dataset.del + ' with all their armies and finished games? This cannot be undone.')) { await api('delete-user', { user: b.dataset.del }); show('Deleted ' + b.dataset.del); }
    await load();
  } catch (err) { show('Error: ' + err.message); }
});
load().catch(err => show('Error: ' + err.message));`;
