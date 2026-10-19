// Battle Report 40k – supervisor of the online server: restarts and updates WITHOUT visible downtime.
//
//   node server/online-supervisor.mjs [--port 8420] [--data <dir>] [--restart-at 05:00]      (= Online-Server.cmd)
//   env: BR_ONLINE_PORT, BR_ONLINE_DATA, BR_ONLINE_RESTART_AT ('off' = no scheduled restart)
//
// How it works (Windows cannot share a listening port between processes, so the supervisor owns it):
//   - This process listens on 127.0.0.1:<port> (the Cloudflare tunnel's target) and forwards every TCP connection
//     unchanged to the current child (server/online-server.mjs, forked with IPC, ephemeral loopback port).
//   - reload = rolling restart: start a successor child (it loads games + accounts, binds, reports 'ready');
//     hold new connections for a moment; drain the old child (no new requests, SSE clients get 'server.reload',
//     in-flight requests finish, all writes + account data flushed); the successor re-reads everything from disk
//     ('sync') so nothing is lost; switch the forwarding target; release the held connections; the old child exits.
//     Phones reconnect their event stream automatically (js/net.js) and get the full state again.
//   - Control: loopback-only HTTP on an ephemeral port, recorded with a secret token in <data>/supervisor.json –
//     server/online-admin.mjs status | reload | update.
//   - Hygiene: a scheduled rolling restart once a day (default 05:00 local) only when no game had an action in the
//     last 30 minutes (otherwise retried every 30 minutes); memory (rss) of both processes logged hourly.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(HERE, 'online-server.mjs');
export const CONTROL_FILE = 'supervisor.json';
const QUIET_MS = 30 * 60 * 1000;          // scheduled restart only when no action for this long
const RETRY_MS = 30 * 60 * 1000;          // … otherwise try again after this
const MEM_LOG_MS = 60 * 60 * 1000;
const READY_TIMEOUT_MS = 90 * 1000;       // a successor must come up within this time (loading games, scrypt …)
const DRAIN_TIMEOUT_MS = 12 * 1000;
const HOLD_TIMEOUT_MS = 15 * 1000;        // held connections are answered 503 if the switch takes longer

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const defaultDataDir = () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BattleReport40k-online');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mb = n => (n / 1048576).toFixed(1) + ' MB';

/** Next occurrence of "HH:MM" (local time) after `from` → timestamp; null for 'off' / invalid. */
export function nextTimeOfDay(hhmm, from = Date.now()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const d = new Date(from);
  d.setHours(h, mi, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * startSupervisor({ port, dataDir, restartAt, log, entry, readyTimeoutMs, drainTimeoutMs })
 *   → { port, controlPort, token, dataDir, reload(reason), status(), update(), stop() }
 * port 0 = any free port (tests). restartAt: 'HH:MM' | 'off'.
 */
export async function startSupervisor(o = {}) {
  const dataDir = path.resolve(o.dataDir || defaultDataDir());
  const log = o.log || console;
  const entry = o.entry || ENTRY;
  const restartAt = o.restartAt == null ? '05:00' : String(o.restartAt);
  const readyTimeoutMs = o.readyTimeoutMs || READY_TIMEOUT_MS;
  const drainTimeoutMs = o.drainTimeoutMs || DRAIN_TIMEOUT_MS;
  const quietMs = o.quietMs == null ? QUIET_MS : o.quietMs;
  const retryMs = o.retryMs == null ? RETRY_MS : o.retryMs;
  fs.mkdirSync(dataDir, { recursive: true });

  // ------------------------------------------------------------ children
  let current = null;            // { child, pid, port, since, exited }
  let generation = 0;
  let reloading = null;          // Promise while a rolling restart runs
  let holding = false;           // the switch itself (old child draining, successor syncing): new connections wait
  let stopping = false;
  let restartTimer = null;       // crash restart
  const history = [];            // last reload results (for status)

  function spawnChild() {
    const gen = ++generation;
    const child = fork(entry, ['--data', dataDir, '--port', '0'], { stdio: ['ignore', o.quietChild ? 'ignore' : 'inherit', 'inherit', 'ipc'], windowsHide: true });
    const rec = { child, pid: child.pid, port: 0, since: Date.now(), gen, exited: false, exitCode: null, waiters: new Map(), nextId: 1 };
    child.on('message', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ready') { rec.port = Number(msg.port) || 0; rec.pid = msg.pid || rec.pid; }
      const w = msg.id != null ? rec.waiters.get(msg.id) : rec.waiters.get(msg.type);
      if (w) { rec.waiters.delete(msg.id != null ? msg.id : msg.type); w.resolve(msg); }
    });
    child.on('exit', (code, signal) => {
      rec.exited = true; rec.exitCode = code;
      for (const w of rec.waiters.values()) w.reject(new Error('server process ended (' + (signal || code) + ')'));
      rec.waiters.clear();
      if (current === rec && !rec.retiring && !stopping) {
        current = null;
        log.error(`Server process ${rec.pid} ended unexpectedly (${signal || 'code ' + code}) – restarting.`);
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if (!current && !stopping && !reloading) bringUp('crash restart').catch(e => log.error('Restart failed:', e.message)); }, 1000);
      }
    });
    child.on('error', e => log.error('Server process error:', e.message));
    return rec;
  }
  /** Waits for a message of `type` (or with `id`) from the child. */
  function waitFor(rec, key, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (rec.exited) return reject(new Error('server process ended'));
      const t = setTimeout(() => { rec.waiters.delete(key); reject(new Error('timeout waiting for ' + key)); }, timeoutMs);
      rec.waiters.set(key, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
    });
  }
  function ask(rec, type, timeoutMs = 5000) {
    const id = rec.nextId++;
    const p = waitFor(rec, id, timeoutMs);
    try { rec.child.send({ type, id }); } catch (e) { rec.waiters.delete(id); return Promise.reject(e); }
    return p;
  }
  function tell(rec, type) { try { rec.child.send({ type }); } catch {} }
  async function startChild() {
    const rec = spawnChild();
    const ready = waitFor(rec, 'ready', readyTimeoutMs);
    try { await ready; } catch (e) { try { rec.child.kill(); } catch {} throw new Error('The new server did not start: ' + e.message); }
    if (!rec.port) { try { rec.child.kill(); } catch {} throw new Error('The new server reported no port'); }
    return rec;
  }
  async function endChild(rec, how) {
    rec.retiring = true;
    if (rec.exited) return;
    const done = waitFor(rec, 'drained', drainTimeoutMs + 3000).catch(() => null);
    tell(rec, how);
    await done;
    const t0 = Date.now();
    while (!rec.exited && Date.now() - t0 < 3000) await sleep(50);
    if (!rec.exited) { log.warn(`Server process ${rec.pid} did not exit – killing it.`); try { rec.child.kill(); } catch {} }
  }
  async function bringUp(reason) {
    const rec = await startChild();
    current = rec;
    releaseHeld();
    log.log(`Server process ${rec.pid} is serving (${reason}).`);
    return rec;
  }

  // ------------------------------------------------------------ TCP forwarding (the public port)
  let held = [];                 // connections that arrived during the switch
  let holdTimer = null;
  const conns = new Set();
  /** Forwards one client connection to a child. The bytes of a request that got no answer yet are kept: when the child
   *  closes the connection before answering (the keep-alive race while it drains – the client sent a request on an idle
   *  connection the server was just closing), the request is sent again to the current child instead of failing.
   *  While a child drains every request is replayed (it never closes a connection mid-request); otherwise (a crash) only
   *  GET / HEAD, which cannot have changed anything. */
  function forward(socket, target) {
    let up = null, pending = [], pendingBytes = 0, replayable = true, dead = false;
    const PENDING_MAX = 1024 * 1024;
    const attach = t => {
      const u = net.connect({ host: '127.0.0.1', port: t.port });
      up = u;
      u.on('connect', () => { for (const b of pending) u.write(b); });
      u.on('data', d => {
        pending = []; pendingBytes = 0; replayable = true;        // the answer started: nothing to replay any more
        if (!socket.write(d)) { u.pause(); socket.once('drain', () => u.resume()); }
      });
      u.on('error', () => {});
      u.on('close', hadError => {
        if (up !== u || dead) return;
        up = null;
        const method = pending.length ? /^(\w+) /.exec(pending[0].toString('latin1', 0, 12)) : null;
        const idempotent = !!method && (method[1] === 'GET' || method[1] === 'HEAD');
        const canReplay = pending.length && replayable && current && current !== t && !current.exited && (t.retiring && !hadError || idempotent);
        if (canReplay) { attach(current); return; }
        dead = true; socket.end();
      });
    };
    socket.on('data', d => {
      pending.push(d); pendingBytes += d.length;
      if (pendingBytes > PENDING_MAX) { pending = []; pendingBytes = 0; replayable = false; }   // uploads are not replayed
      if (up && !up.destroyed) { if (!up.write(d)) { socket.pause(); up.once('drain', () => socket.resume()); } }
      else if (!dead && current && !current.exited) attach(current);   // detached (the child closed an idle connection): continue on the current child
      else { dead = true; socket.end(); }
    });
    socket.on('end', () => { dead = true; if (up) up.end(); });
    socket.on('close', () => { dead = true; if (up) up.destroy(); });
    socket.on('error', () => { dead = true; if (up) up.destroy(); });
    attach(target);
  }
  function refuse(socket) {
    const body = 'The server is restarting – please try again in a moment.';
    try { socket.end(`HTTP/1.1 503 Service Unavailable\r\nContent-Type: text/plain; charset=utf-8\r\nRetry-After: 2\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`); } catch {}
  }
  function onConnection(socket) {
    conns.add(socket); socket.on('close', () => conns.delete(socket));
    socket.setNoDelay(true);
    if (holding || !current) {
      held.push(socket);
      if (!holdTimer) holdTimer = setTimeout(() => { holdTimer = null; const h = held; held = []; for (const s of h) refuse(s); }, HOLD_TIMEOUT_MS);
      return;
    }
    forward(socket, current);
  }
  function releaseHeld() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    const h = held; held = [];
    for (const s of h) { if (s.destroyed) continue; if (current) forward(s, current); else refuse(s); }
  }
  const server = net.createServer(onConnection);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(o.port == null ? 8420 : Number(o.port), '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const port = server.address().port;

  // ------------------------------------------------------------ rolling restart
  function reload(reason = 'reload') {
    if (reloading) return reloading;
    reloading = (async () => {
      const t0 = Date.now();
      const old = current;
      log.log(`Rolling restart (${reason}) …`);
      let fresh;
      try { fresh = await startChild(); }
      catch (e) { log.error(e.message + ' – the running server stays.'); history.push({ at: new Date().toISOString(), reason, ok: false, error: e.message }); throw e; }
      holding = true;                                              // from here new connections wait until the successor has synced
      if (old && !old.exited) await endChild(old, 'drain');       // drain: finishes requests, flushes, closes SSE with 'server.reload'
      let synced = null;
      try { synced = await ask(fresh, 'sync', 30000); } catch (e) { synced = { ok: false, error: e.message }; }
      if (!synced || !synced.ok) log.error('The new server could not re-read the data: ' + (synced && synced.error));
      current = fresh;
      const ms = Date.now() - t0;
      log.log(`Server process ${fresh.pid} is serving (${reason}, ${old ? 'replaced ' + old.pid + ', ' : ''}${ms} ms).`);
      history.push({ at: new Date().toISOString(), reason, ok: true, ms, pid: fresh.pid });
      if (history.length > 20) history.shift();
    })().finally(() => { reloading = null; holding = false; releaseHeld(); });
    return reloading;
  }

  // ------------------------------------------------------------ status
  const started = Date.now();
  async function childStatus() {
    if (!current || current.exited) return null;
    try { const s = await ask(current, 'status', 3000); delete s.type; delete s.id; return s; } catch (e) { return { pid: current.pid, error: e.message }; }
  }
  async function status() {
    const child = await childStatus();
    return {
      supervisor: { pid: process.pid, port, controlPort, dataDir, uptime: Date.now() - started, rss: process.memoryUsage().rss, connections: conns.size, held: held.length, reloading: !!reloading },
      server: child,
      schedule: { restartAt: nextRestartAt ? new Date(nextRestartAt).toISOString() : null, configured: restartAt, quietMinutes: quietMs / 60000 },
      reloads: history.slice(-5)
    };
  }
  function logMemory() {
    childStatus().then(s => log.log(`Memory: supervisor ${mb(process.memoryUsage().rss)}, server ${s && s.rss ? mb(s.rss) + ' (' + s.games + ' games, ' + s.clients + ' event streams)' : 'n/a'}`)).catch(() => {});
  }
  const memTimer = setInterval(logMemory, MEM_LOG_MS); memTimer.unref();

  // ------------------------------------------------------------ scheduled rolling restart (memory hygiene)
  let nextRestartAt = nextTimeOfDay(restartAt);
  async function scheduledTick() {
    if (!nextRestartAt || Date.now() < nextRestartAt || reloading || stopping) return;
    const s = await childStatus();
    const busy = s && s.lastActionAt && Date.now() - s.lastActionAt < quietMs;
    if (busy) {
      nextRestartAt = Date.now() + retryMs;
      log.log(`Scheduled restart postponed – a game was active ${Math.round((Date.now() - s.lastActionAt) / 60000)} min ago (next try ${new Date(nextRestartAt).toLocaleTimeString()}).`);
      return;
    }
    nextRestartAt = nextTimeOfDay(restartAt);
    try { await reload('scheduled'); } catch {}
  }
  const schedTimer = setInterval(() => { scheduledTick().catch(e => log.error('Scheduled restart:', e.message)); }, o.tickMs || 60 * 1000);
  schedTimer.unref();

  // ------------------------------------------------------------ control port (loopback only, token in <data>/supervisor.json)
  const token = crypto.randomBytes(24).toString('base64url');
  const control = http.createServer(async (req, res) => {
    const reply = (code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
    try {
      if (req.headers['x-control-token'] !== token) return reply(403, { error: 'Forbidden' });
      if (req.method === 'GET' && req.url === '/status') return reply(200, await status());
      if (req.method === 'POST' && req.url === '/reload') {
        if (reloading) return reply(409, { error: 'A restart is already running' });
        try { await reload('admin'); return reply(200, { ok: true, status: await status() }); }
        catch (e) { return reply(500, { error: e.message }); }
      }
      reply(404, { error: 'Unknown command' });
    } catch (e) { reply(500, { error: e.message }); }
  });
  await new Promise((resolve, reject) => { control.once('error', reject); control.listen(0, '127.0.0.1', () => { control.off('error', reject); resolve(); }); });
  const controlPort = control.address().port;
  const controlFile = path.join(dataDir, CONTROL_FILE);
  fs.writeFileSync(controlFile, JSON.stringify({ pid: process.pid, port, controlPort, token, started: new Date(started).toISOString() }, null, 1));

  // ------------------------------------------------------------ go
  await bringUp('start');

  return {
    port, controlPort, token, dataDir, reload, status,
    get nextRestartAt() { return nextRestartAt; },
    async stop() {
      stopping = true;
      clearInterval(memTimer); clearInterval(schedTimer); clearTimeout(restartTimer);
      if (reloading) { try { await reloading; } catch {} }
      try { fs.unlinkSync(controlFile); } catch {}
      const closed = Promise.all([new Promise(r => control.close(() => r())), new Promise(r => server.close(() => r()))]);
      for (const s of held) refuse(s);
      if (current && !current.exited) await endChild(current, 'exit');
      for (const s of conns) { try { s.destroy(); } catch {} }   // open keep-alive connections would hold close() back
      await closed;
    }
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(arg('port') || process.env.BR_ONLINE_PORT || 8420);
  const dataDir = arg('data') || process.env.BR_ONLINE_DATA || defaultDataDir();
  const restartAt = arg('restart-at') || process.env.BR_ONLINE_RESTART_AT || '05:00';
  const log = { log: (...a) => console.log(new Date().toISOString().slice(11, 19), '[sup]', ...a), warn: (...a) => console.warn(new Date().toISOString().slice(11, 19), '[sup]', ...a), error: (...a) => console.error(new Date().toISOString().slice(11, 19), '[sup]', ...a) };
  const s = await startSupervisor({ port, dataDir, restartAt, log });
  console.log('\nBattle Report 40k – online server (supervised)\n');
  console.log('  Local:     http://127.0.0.1:' + s.port + '/          (this PC only)');
  console.log('  Admin:     http://127.0.0.1:' + s.port + '/admin     (invite codes, users – this PC only)');
  console.log('  Data:      ' + s.dataDir);
  console.log('  Restart:   ' + (s.nextRestartAt ? 'daily at ' + restartAt + ' when no game is active (rolling, no downtime)' : 'no scheduled restart') + '; now: node server/online-admin.mjs reload');
  console.log('  Update:    Online-Update.cmd  (git pull + reload only if the server code changed; web files are live at once)');
  console.log('  Status:    node server/online-admin.mjs status');
  console.log('\n  Internet:  start the Cloudflare tunnel in a second window (Online-Tunnel.cmd / named tunnel, see ONLINE.md).\n');
  let leaving = false;
  const bye = async () => { if (leaving) return; leaving = true; console.log('\nShutting down …'); await s.stop(); process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}
