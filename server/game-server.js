/* Battle Report 40k – game server as a module (SPEC §6 + §10).
 * Used by the dev server (server.js) and the Windows desktop app (desktop/main.js). Same behaviour as the Android
 * app's GameServer.java: static files + JSON API + SSE, action log persisted as <gamesDir>/<CODE>.json, state = replay
 * of the log through the engine, finished games closed after 2 min (signal "game.closed").
 * No npm dependencies.
 *
 *   const srv = await startGameServer({ root, gamesDir, overlayDir, bsdataDir, port, host, onGamesChanged, log, extraApi, info, engine })
 *   → { port, stop(), summaries() }
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const HEARTBEAT_MS = 15000;
const CLOSE_AFTER_MS = 2 * 60 * 1000;
const PHOTO_MAX = 20 * 1024 * 1024;
const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png' };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // without I and O

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const VIRTUAL_IF = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|vbox|Loopback|ZeroTier|Tailscale|TAP-|Bluetooth/i;

/** LAN IPv4 addresses of this machine (no loopback / link-local); real Wi-Fi/Ethernet adapters before virtual ones. */
export function lanIps() {
  const real = [], virt = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (!(a.family === 'IPv4' || a.family === 4) || a.internal || a.address.startsWith('169.254.')) continue;
      (VIRTUAL_IF.test(name) ? virt : real).push(a.address);
    }
  }
  return [...real, ...virt];
}

/** All IPv4 URLs (incl. loopback) – for the startup log. */
export function lanUrls(port) {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' || a.family === 4) out.push({ name, url: `http://${a.address}:${port}/` });
    }
  }
  return out;
}

export async function startGameServer(opts = {}) {
  const ROOT = path.resolve(opts.root || process.cwd());
  const GAMES_DIR = path.resolve(opts.gamesDir || path.join(ROOT, 'games'));
  const OVERLAY = opts.overlayDir ? path.resolve(opts.overlayDir) : null;
  const BSDATA = opts.bsdataDir ? path.resolve(opts.bsdataDir) : null;
  const HOST = opts.host || '0.0.0.0';
  const log = opts.log || console;
  const onGamesChanged = typeof opts.onGamesChanged === 'function' ? opts.onGamesChanged : null;
  const extraApi = typeof opts.extraApi === 'function' ? opts.extraApi : null;
  let PORT = opts.port == null ? 8417 : Number(opts.port);

  // ---------------------------------------------------------------- engine
  let engine = opts.engine;
  if (!engine || typeof engine === 'string') {
    const p = engine || path.join(ROOT, 'engine', 'index.js');
    const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
    engine = await import(pathToFileURL(abs).href);
  }
  const { initialState, reduce } = engine;
  if (typeof initialState !== 'function' || typeof reduce !== 'function') throw new Error('Engine does not export initialState/reduce');

  // ---------------------------------------------------------------- games
  /** @type {Map<string, { code: string, actions: object[], state: object, clients: Set<http.ServerResponse> }>} */
  const games = new Map();
  let stopped = false;

  function newCode() {
    for (let tries = 0; tries < 1000; tries++) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!games.has(c)) return c;
    }
    throw new Error('No free game code');
  }
  const isCode = c => typeof c === 'string' && /^[A-Z]{4}$/.test(c);

  function replay(code, actions) {
    let state = initialState(code, 0);
    let seq = 0;
    for (const a of actions) {
      state = reduce(state, a);
      seq++;
      state.seq = seq;
    }
    state.seq = seq;
    return state;
  }

  // one write per game at a time: two devices acting at once must not race on the same .tmp file
  function persist(game) {
    game.persisting = (game.persisting || Promise.resolve()).then(async () => {
      try {
        await fsp.mkdir(GAMES_DIR, { recursive: true });
        const tmp = path.join(GAMES_DIR, game.code + '.json.tmp');
        await fsp.writeFile(tmp, JSON.stringify({ code: game.code, actions: game.actions }));
        await fsp.rename(tmp, path.join(GAMES_DIR, game.code + '.json'));
      } catch (e) {
        log.error('Persist failed for', game.code, e);
      }
    });
    return game.persisting;
  }

  async function loadGames() {
    await fsp.mkdir(GAMES_DIR, { recursive: true });
    const files = (await fsp.readdir(GAMES_DIR)).filter(f => /^[A-Z]{4}\.json$/.test(f));
    let ok = 0;
    for (const f of files) {
      const code = f.slice(0, 4);
      try {
        const raw = JSON.parse(await fsp.readFile(path.join(GAMES_DIR, f), 'utf8'));
        const actions = Array.isArray(raw.actions) ? raw.actions : [];
        const state = replay(code, actions);
        games.set(code, { code, actions, state, clients: new Set(), photos: await loadPhotos(code), camera: await loadCamera(code) });
        checkClose(games.get(code));
        ok++;
      } catch (e) {
        log.error(`Game ${code} could not be loaded (skipped):`, e && e.message ? e.message : e);
      }
    }
    log.log(`${ok}/${files.length} games loaded.`);
  }

  function applyAction(game, action) {
    const a = Object.assign({}, action, { ts: new Date().toISOString() });
    const next = reduce(game.state, a); // throws on an invalid action
    game.actions.push(a);
    game.state = next;
    game.state.seq = game.actions.length;
    return a;
  }

  // Finished game: every connected device stores its own copy (js/archive.js); after a grace period (undo possible) the
  // server closes the game – signal "game.closed", disconnect, remove. Same behaviour as the app's GameServer.java.
  function checkClose(game) {
    const over = game.state && game.state.stage === 'over';
    if (over && !game.closeTimer && !stopped) game.closeTimer = setTimeout(() => closeGame(game.code), CLOSE_AFTER_MS);
    if (!over && game.closeTimer) { clearTimeout(game.closeTimer); game.closeTimer = null; }
  }
  async function closeGame(code) {
    const g = games.get(code);
    if (!g || !g.state || g.state.stage !== 'over') return;
    sseSend(g, 'signal', { type: 'game.closed', code, ts: Date.now() });
    for (const c of g.clients) { try { c.end(); } catch {} }
    games.delete(code);
    try { await fsp.unlink(path.join(GAMES_DIR, code + '.json')); } catch {}
    try { await fsp.rm(path.join(GAMES_DIR, code), { recursive: true, force: true }); } catch {}
    log.log('Game ' + code + ' finished and closed.');
    changed();
  }

  function broadcastState(game) {
    checkClose(game);
    sseSend(game, 'state', game.state);
  }

  function sseSend(game, event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of game.clients) {
      try { res.write(payload); } catch { game.clients.delete(res); }
    }
  }

  function summary(game) {
    const s = game.state || {};
    return {
      code: game.code,
      createdAt: s.createdAt || null,
      stage: s.stage || null,
      players: (s.players || []).map(p => (p && p.name) || ''),
      colors: (s.players || []).map(p => (p && Number.isInteger(p.color) ? p.color : null)),   // player colours for the join list
      round: s.round || 0,
      seq: game.actions.length
    };
  }
  const summaries = () => [...games.values()].map(summary)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  /** After every change of the game list / a game (for DNS-SD advertising). */
  function changed() {
    if (!onGamesChanged || stopped) return;
    try { onGamesChanged(summaries()); } catch (e) { log.error('onGamesChanged', e); }
  }

  // ---------------------------------------------------------------- photos (SPEC §11)
  const photoDir = code => path.join(GAMES_DIR, code, 'photos');
  const photoMetaFile = code => path.join(GAMES_DIR, code, 'photos.json');

  async function loadPhotos(code) {
    try {
      const raw = JSON.parse(await fsp.readFile(photoMetaFile(code), 'utf8'));
      return Array.isArray(raw) ? raw : Array.isArray(raw.photos) ? raw.photos : [];
    } catch { return []; }
  }
  async function persistPhotos(game) {
    try {
      await fsp.mkdir(photoDir(game.code), { recursive: true });
      const tmp = photoMetaFile(game.code) + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(game.photos));
      await fsp.rename(tmp, photoMetaFile(game.code));
    } catch (e) { log.error('Saving photo metadata failed', game.code, e); }
  }
  function photoPublic(p) {
    return Object.assign({}, p, { url: `/api/games/${p.code}/photos/${p.id}${p.file.endsWith('.png') ? '.png' : '.jpg'}` });
  }

  // ---------------------------------------------------------------- camera calibration (SPEC §12)
  const cameraFile = code => path.join(GAMES_DIR, code, 'camera.json');
  const emptyCamera = () => ({ H: null, rms: null, markers: [], updatedAt: null });
  async function loadCamera(code) {
    try { return Object.assign(emptyCamera(), JSON.parse(await fsp.readFile(cameraFile(code), 'utf8'))); }
    catch { return emptyCamera(); }
  }
  async function persistCamera(game) {
    try {
      await fsp.mkdir(path.join(GAMES_DIR, game.code), { recursive: true });
      const tmp = cameraFile(game.code) + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(game.camera));
      await fsp.rename(tmp, cameraFile(game.code));
    } catch (e) { log.error('Saving camera calibration failed', game.code, e); }
  }

  // ---------------------------------------------------------------- static files
  const FORBIDDEN_TOP = new Set(['games', 'node_modules']);
  function isForbidden(rel) {
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length) return false;
    if (FORBIDDEN_TOP.has(parts[0])) return true;
    return parts.some(p => p.startsWith('.') || p.startsWith('_backup-'));
  }
  /** Regular file below base for rel ("/x/y.json") – a directory serves its index.html – or null. */
  async function fileIn(base, rel) {
    const abs = path.resolve(base, '.' + rel);
    if (abs !== base && !abs.startsWith(base + path.sep)) return null;
    let st;
    try { st = await fsp.stat(abs); } catch { return null; }
    if (st.isDirectory()) {
      const f = path.join(abs, 'index.html');
      try { st = await fsp.stat(f); } catch { return null; }
      return st.isFile() ? { file: f, st } : null;
    }
    return st.isFile() ? { file: abs, st } : null;
  }

  async function serveStatic(req, res, pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { throw httpError(400, 'Invalid path'); }
    if (rel === '/' || rel === '') rel = '/index.html';
    rel = rel.replace(/\\/g, '/');
    if (rel.includes('\0') || isForbidden(rel)) throw httpError(404, 'Not found');
    // Order: data overlay (on-device data updates) → bundled raw BSData (/bsdata/*) → web root
    let hit = OVERLAY ? await fileIn(OVERLAY, rel) : null;
    if (!hit && BSDATA && rel.startsWith('/bsdata/')) hit = await fileIn(BSDATA, rel.slice('/bsdata'.length));
    if (!hit) hit = await fileIn(ROOT, rel);
    if (!hit) throw httpError(404, 'Not found');
    const { file, st } = hit;
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => { try { res.destroy(); } catch {} });
    stream.pipe(res);
  }

  // ---------------------------------------------------------------- API
  function getGame(code) {
    if (!isCode(code)) throw httpError(400, 'Invalid game code');
    const g = games.get(code);
    if (!g) throw httpError(404, 'Game not found');
    return g;
  }

  async function handleApi(req, res, url) {
    const m = req.method;
    const parts = url.pathname.split('/').filter(Boolean); // ['api','games',CODE,...]

    // Host-specific routes (e.g. the dev manifest); return true when handled
    if (extraApi && (await extraApi(req, res, url)) === true) return;

    // /api/rules-page?p=core-rules – the free 11th-edition rules page from Wahapedia, fetched for the device (tutorial
    // originals, js/rules-orig.js); the page sends no CORS headers. Only these fixed pages, nothing else is proxied.
    if (parts.length === 2 && parts[1] === 'rules-page' && m === 'GET') {
      const p = url.searchParams.get('p');
      if (!RULE_PAGES.includes(p)) return sendJson(res, 400, { error: 'Unknown rules page' });
      try {
        const r = await fetch('https://wahapedia.ru/wh40k11ed/the-rules/' + p + '/', { headers: { 'User-Agent': 'BattleReport40k' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return sendJson(res, 200, { html: await r.text() });
      } catch (e) {
        return sendJson(res, 502, { error: 'Download failed: ' + (e && e.message ? e.message : e) });
      }
    }

    // /api/info – LAN addresses, so devices can build join links / QR codes
    if (parts.length === 2 && parts[1] === 'info' && m === 'GET') {
      return sendJson(res, 200, Object.assign({ port: PORT, lan: lanIps() }, opts.info || {}));
    }

    // /api/games
    if (parts.length === 2 && parts[1] === 'games') {
      if (m === 'GET') return sendJson(res, 200, summaries());
      if (m === 'POST') {
        const body = await readJson(req);
        const code = newCode();
        const seed = (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1;
        const game = { code, actions: [], state: initialState(code, seed), clients: new Set(), photos: [], camera: emptyCamera() };
        try {
          applyAction(game, { type: 'game.init', code, seed, by: null });
          const names = Array.isArray(body.names) ? body.names : [];
          names.slice(0, 2).forEach((n, i) => {
            const name = String(n == null ? '' : n).trim();
            if (name) applyAction(game, { type: 'player.set', player: i, name, by: null });
          });
        } catch (e) {
          return sendJson(res, 400, { error: e && e.message ? e.message : String(e) });
        }
        games.set(code, game);
        await persist(game);
        changed();
        return sendJson(res, 201, { code, state: game.state });
      }
      throw httpError(405, 'Method not allowed');
    }

    // /api/games/:code[/...]
    if (parts.length >= 3 && parts[1] === 'games') {
      const code = String(parts[2]).toUpperCase();
      const sub = parts[3] || null;

      if (!sub) {
        if (m === 'GET') return sendJson(res, 200, getGame(code).state);
        if (m === 'DELETE') {
          // only the device hosting the game (its own app/browser = loopback) may delete it – not a guest phone on the Wi-Fi
          if (!isLoopback(req)) throw httpError(403, 'Only the device hosting the game can delete it');
          const g = getGame(code);
          sseSend(g, 'signal', { type: 'game.deleted', code, ts: Date.now() });
          for (const c of g.clients) { try { c.end(); } catch {} }
          if (g.closeTimer) { clearTimeout(g.closeTimer); g.closeTimer = null; }
          games.delete(code);
          try { await fsp.unlink(path.join(GAMES_DIR, code + '.json')); } catch {}
          try { await fsp.rm(path.join(GAMES_DIR, code), { recursive: true, force: true }); } catch {}
          changed();
          return sendJson(res, 200, { ok: true, code });
        }
        throw httpError(405, 'Method not allowed');
      }

      if (sub === 'actions' && m === 'POST') {
        const g = getGame(code);
        const body = await readJson(req);
        const action = body && body.action && typeof body.action === 'object' ? body.action : body;
        if (!action || typeof action.type !== 'string') throw httpError(400, 'Action without type');
        try {
          applyAction(g, action);
        } catch (e) {
          return sendJson(res, 400, { error: e && e.message ? e.message : String(e) });
        }
        await persist(g);
        broadcastState(g);
        changed();
        return sendJson(res, 200, { seq: g.state.seq, state: g.state });
      }

      if (sub === 'undo' && m === 'POST') {
        const g = getGame(code);
        if (g.actions.length <= 1) return sendJson(res, 400, { error: 'Nothing to undo' });
        // A player's phone ({ by: 0 | 1 }) only undoes its own last action; the scoreboard / setup (no player) undoes any
        const body = await readJson(req);
        const by = body && (body.by === 0 || body.by === 1) ? body.by : null;
        const last = g.actions[g.actions.length - 1];
        // one undo takes back the whole trailing group (one "End turn" press with its automatic phase steps)
        const n = undoSpan(g.actions);
        if (by != null && g.actions.slice(-n).some(a => a.by !== by)) {
          const entry = (g.state.log || []).slice().reverse().find(l => l.type === last.type);
          return sendJson(res, 409, { error: 'The last action was not made on this phone' + (entry ? ' (“' + entry.text + '”)' : '') + ' – it can only be undone there or on the scoreboard.' });
        }
        const actions = g.actions.slice(0, -n);
        let state;
        try { state = replay(code, actions); }
        catch (e) { return sendJson(res, 400, { error: 'Undo failed: ' + (e && e.message ? e.message : e) }); }
        g.actions = actions;
        g.state = state;
        await persist(g);
        broadcastState(g);
        changed();
        return sendJson(res, 200, { seq: g.state.seq, state: g.state, undone: n });
      }

      if (sub === 'events' && m === 'GET') {
        const g = getGame(code);
        res.writeHead(200, {
          // no charset + no-transform: otherwise a proxy (Cloudflare tunnel, dev only) buffers/compresses the stream
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store, no-transform',
          'Content-Encoding': 'identity',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(': verbunden\n\n');
        res.write(`event: state\ndata: ${JSON.stringify(g.state)}\n\n`);
        g.clients.add(res);
        const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch { cleanup(); } }, HEARTBEAT_MS);
        const cleanup = () => { clearInterval(hb); g.clients.delete(res); };
        req.on('close', cleanup);
        res.on('error', cleanup);
        return;
      }

      if (sub === 'log' && m === 'GET') {
        const g = getGame(code);
        const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
        return sendJson(res, 200, { code, seq: g.actions.length, actions: g.actions.slice(since) });
      }

      if (sub === 'pointer' && m === 'POST') {
        const g = getGame(code);
        const body = await readJson(req);
        const p = {
          src: typeof body.src === 'string' ? body.src : 'unknown',
          x: Number(body.x), y: Number(body.y),
          down: !!body.down,
          tool: body.tool == null ? null : String(body.tool),
          unitId: body.unitId == null ? null : String(body.unitId),
          r: body.r == null ? null : Number(body.r),
          ts: Date.now()
        };
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw httpError(400, 'x/y missing');
        sseSend(g, 'pointer', p);
        sseSend(g, 'signal', Object.assign({ type: 'pointer' }, p));
        return sendJson(res, 200, { ok: true });
      }

      // Volatile message to all views (not persisted, no reducer) – §12
      if (sub === 'signal' && m === 'POST') {
        const g = getGame(code);
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'JSON object expected');
        if (typeof body.type !== 'string' || !body.type) throw httpError(400, 'type missing');
        const sig = Object.assign({}, body, { ts: Date.now() });
        sseSend(g, 'signal', sig);
        return sendJson(res, 200, { ok: true });
      }

      // Camera calibration per game – §12
      if (sub === 'camera') {
        const g = getGame(code);
        if (m === 'GET') return sendJson(res, 200, g.camera);
        if (m === 'PUT' || m === 'PATCH') {
          const body = await readJson(req);
          const patch = body && body.camera && typeof body.camera === 'object' ? body.camera : body;
          if (patch.H !== undefined) {
            if (patch.H !== null && !isH(patch.H)) throw httpError(400, 'H must be 9 numbers or null');
            g.camera.H = patch.H;
          }
          if (patch.rms !== undefined) g.camera.rms = patch.rms == null ? null : Number(patch.rms);
          if (patch.markers !== undefined) { if (!Array.isArray(patch.markers)) throw httpError(400, 'markers must be an array'); g.camera.markers = patch.markers; }
          for (const k of ['k1', 'w', 'h', 'device', 'note']) if (patch[k] !== undefined) g.camera[k] = patch[k];
          g.camera.updatedAt = new Date().toISOString();
          await persistCamera(g);
          sseSend(g, 'signal', { type: 'camera', camera: g.camera, ts: Date.now() });
          return sendJson(res, 200, g.camera);
        }
        if (m === 'DELETE') {
          g.camera = emptyCamera();
          await persistCamera(g);
          sseSend(g, 'signal', { type: 'camera', camera: g.camera, ts: Date.now() });
          return sendJson(res, 200, g.camera);
        }
        throw httpError(405, 'Method not allowed');
      }

      if (sub === 'photos') {
        const g = getGame(code);
        const rest = parts[4] || null;

        if (!rest && m === 'GET') return sendJson(res, 200, g.photos.map(photoPublic));

        if (!rest && m === 'POST') {
          const ctRaw = String(req.headers['content-type'] || '');
          let buf = await readBody(req, PHOTO_MAX + 64 * 1024);
          let type = ctRaw.split(';')[0].trim().toLowerCase();
          if (type === 'multipart/form-data') {
            const part = firstMultipartFile(buf, ctRaw); // boundary is case-sensitive
            if (!part) throw httpError(400, 'No image in multipart body');
            buf = part.data; type = part.type || sniffImage(buf);
          }
          if (!PHOTO_TYPES[type]) type = sniffImage(buf);
          if (!PHOTO_TYPES[type]) throw httpError(415, 'Only image/jpeg or image/png');
          if (!buf.length) throw httpError(400, 'Empty image');
          if (buf.length > PHOTO_MAX) throw httpError(413, 'Image too large (max. 20 MB)');
          const n = g.photos.reduce((mx, p) => Math.max(mx, Number(p.id) || 0), 0) + 1;
          const id = String(n);
          const file = id + PHOTO_TYPES[type];
          await fsp.mkdir(photoDir(code), { recursive: true });
          await fsp.writeFile(path.join(photoDir(code), file), buf);
          const q = url.searchParams;
          const st = g.state || {};
          const byRaw = q.get('by');
          const photo = {
            id, code, ts: new Date().toISOString(),
            by: byRaw == null || byRaw === '' ? null : (/^[01]$/.test(byRaw) ? Number(byRaw) : byRaw),
            round: clampInt(q.get('round'), st.round ?? null), turn: clampInt(q.get('turn'), st.turn ?? null),
            phase: q.get('phase') || st.phase || null,
            file, type, size: buf.length, markers: [], H: null, rms: null, note: ''
          };
          g.photos.push(photo);
          await persistPhotos(g);
          const pub = photoPublic(photo);
          sseSend(g, 'photo', { kind: 'new', photo: pub });
          return sendJson(res, 201, { photo: pub });
        }

        if (!rest) throw httpError(405, 'Method not allowed');

        const id = rest.replace(/\.(jpe?g|png)$/i, '');
        const photo = g.photos.find(p => p.id === id);
        if (!photo) throw httpError(404, 'Photo not found');

        if (m === 'GET') {
          const file = path.join(photoDir(code), photo.file);
          let st;
          try { st = await fsp.stat(file); } catch { throw httpError(404, 'Image file missing'); }
          res.writeHead(200, { 'Content-Type': photo.type || 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': st.size });
          const stream = fs.createReadStream(file);
          stream.on('error', () => { try { res.destroy(); } catch {} });
          stream.pipe(res);
          return;
        }
        if (m === 'PUT' || m === 'PATCH') {
          const body = await readJson(req);
          const patch = body && body.photo && typeof body.photo === 'object' ? body.photo : body;
          if (patch.markers !== undefined) { if (!Array.isArray(patch.markers)) throw httpError(400, 'markers must be an array'); photo.markers = patch.markers; }
          if (patch.H !== undefined) {
            if (patch.H !== null && !isH(patch.H)) throw httpError(400, 'H must be 9 numbers or null');
            photo.H = patch.H;
          }
          if (patch.rms !== undefined) photo.rms = patch.rms == null ? null : Number(patch.rms);
          if (patch.note !== undefined) photo.note = String(patch.note == null ? '' : patch.note).slice(0, 2000);
          if (patch.k1 !== undefined) photo.k1 = patch.k1 == null ? null : Number(patch.k1);
          if (patch.w !== undefined) photo.w = clampInt(patch.w);
          if (patch.h !== undefined) photo.h = clampInt(patch.h);
          if (patch.round !== undefined) photo.round = clampInt(patch.round);
          if (patch.turn !== undefined) photo.turn = clampInt(patch.turn);
          if (patch.phase !== undefined) photo.phase = patch.phase == null ? null : String(patch.phase);
          photo.updatedAt = new Date().toISOString();
          await persistPhotos(g);
          const pub = photoPublic(photo);
          sseSend(g, 'photo', { kind: 'meta', photo: pub });
          return sendJson(res, 200, { photo: pub });
        }
        if (m === 'DELETE') {
          g.photos = g.photos.filter(p => p !== photo);
          try { await fsp.unlink(path.join(photoDir(code), photo.file)); } catch {}
          await persistPhotos(g);
          sseSend(g, 'photo', { kind: 'delete', photo: photoPublic(photo) });
          return sendJson(res, 200, { ok: true, id });
        }
        throw httpError(405, 'Method not allowed');
      }

      throw httpError(404, 'Unknown route');
    }

    throw httpError(404, 'Unknown route');
  }

  // ---------------------------------------------------------------- server
  async function handler(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Method not allowed');
      await serveStatic(req, res, url.pathname);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status === 500) log.error('Error at', req.method, req.url, e);
      if (res.headersSent) { try { res.end(); } catch {} return; }
      sendJson(res, status, { error: (e && e.message) || 'Internal error' });
    }
  }

  await loadGames();
  const server = http.createServer(handler);
  server.on('clientError', (err, socket) => {
    try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch {}
  });
  const sockets = new Set();
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

  function clearTimers() { for (const g of games.values()) if (g.closeTimer) { clearTimeout(g.closeTimer); g.closeTimer = null; } }

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, HOST, () => { server.off('error', reject); resolve(); });
    });
  } catch (e) {
    stopped = true;
    clearTimers();
    throw e;
  }
  PORT = server.address().port;
  server.on('error', e => log.error('server error:', e));
  changed();

  return {
    port: PORT,
    server,
    summaries,
    stop() {
      stopped = true;
      clearTimers();
      for (const g of games.values()) for (const c of g.clients) { try { c.end(); } catch {} }
      return new Promise(resolve => {
        server.close(() => resolve());
        for (const s of sockets) { try { s.destroy(); } catch {} }
      });
    }
  };
}

// ---------------------------------------------------------------- helpers (stateless)
/** How many trailing actions one undo takes back: all trailing actions sharing the last action's `group` (one tablet
 *  "End turn" / "Next phase" press with its automatic phase steps and scoring), else just the last one (old games have
 *  no groups). Never the game.init action at index 0. Same rule as GameServer.java undoSpan(). */
export function undoSpan(actions) {
  const n = actions.length, grp = n > 1 ? actions[n - 1].group : null;
  if (typeof grp !== 'string' || !grp) return 1;
  let k = 1;
  while (k < n - 1 && actions[n - 1 - k].group === grp) k++;
  return k;
}
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  return null;
}
/** Minimal multipart/form-data parser: returns the first file part { type, data }. */
function firstMultipartFile(buf, contentType) {
  const m = /boundary=("?)([^";]+)\1/i.exec(contentType || '');
  if (!m) return null;
  const boundary = Buffer.from('--' + m[2]);
  let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    const start = pos + boundary.length;
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break; // "--" = end
    const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd < 0) break;
    const head = buf.slice(start, headEnd).toString('utf8');
    const next = buf.indexOf(boundary, headEnd + 4);
    const dataEnd = next < 0 ? buf.length : next - 2; // without the trailing CRLF
    const data = buf.slice(headEnd + 4, dataEnd);
    const tm = /content-type:\s*([^\r\n;]+)/i.exec(head);
    const isFile = /filename=/i.test(head) || (tm && /^image\//i.test(tm[1]));
    if (isFile) return { type: tm ? tm[1].trim().toLowerCase() : null, data };
    if (next < 0) break;
    pos = next;
  }
  return null;
}
const clampInt = (v, d = null) => { if (v == null || v === '') return d; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : d; };
const isH = H => Array.isArray(H) && H.length === 9 && H.every(Number.isFinite);

const RULE_PAGES = ['core-rules', 'rules-appendix'];

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const text = (await readBody(req)).toString('utf8');
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
/** Request from this machine itself (the hosting device's own app / browser), not from another device on the network. */
function isLoopback(req) {
  const a = String((req.socket && req.socket.remoteAddress) || '');
  return /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(a);
}
