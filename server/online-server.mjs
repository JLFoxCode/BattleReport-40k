// Battle Report 40k – ONLINE server: runs on this Windows PC, reachable from the internet only through a Cloudflare
// Tunnel (HTTPS ends at Cloudflare; this server listens on 127.0.0.1 only). Every player signs in with an account
// (invite code from the admin): army lists and finished games live in the account, games are hosted here.
//
//   node server/online-server.mjs [--port 8420] [--data <dir>]       (or Online-Server.cmd in the repo root)
//   env: BR_ONLINE_PORT, BR_ONLINE_DATA (default B:\BattleReportServer\data)
//   admin: node server/online-admin.mjs invite | users | reset-password <user> | delete-user <user> | status | reload | update
//          or http://127.0.0.1:<port>/admin on this PC (never through the tunnel)
// Normally started by server/online-supervisor.mjs (Online-Server.cmd) as a child with an IPC channel: the supervisor
// owns the public port and forwards connections; this process listens on an ephemeral loopback port and reports it.
// A rolling restart (reload) starts a successor, drains this process (SSE clients get 'server.reload') and exits it.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { startGameServer } from './game-server.js';
import { createAuth } from './auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
export const defaultDataDir = () => 'B:/BattleReportServer/data';

/** Starts the online server → { port, dataDir, stop() }. Used by the CLI below and by the tests. */
export async function startOnlineServer(o = {}) {
  const dataDir = path.resolve(o.dataDir || defaultDataDir());
  const log = o.log || console;
  const auth = createAuth({ dataDir, log, limits: o.limits });
  await auth.init();
  const srv = await startGameServer({
    root: ROOT,
    port: o.port == null ? 8420 : Number(o.port),
    host: '127.0.0.1',                                   // never on the LAN / internet directly – only via the tunnel
    gamesDir: path.join(dataDir, 'games'),
    bsdataDir: path.join(ROOT, 'vendor-data', 'bsdata', 'wh40k-11e-main'),
    // only the web app itself – not the repo (server, tests, dev, desktop, android, docs …)
    staticAllow: ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'engine', 'data', 'icons', 'vendor', 'bsdata', 'web-index.json'],
    info: { name: 'Online server' },
    auth,
    log
  });
  return { port: srv.port, dataDir, auth, stop: () => srv.stop(), drain: ms => srv.drain(ms), sync: () => srv.sync(), stats: () => srv.stats() };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && typeof process.send === 'function') {
  // ---- child of the supervisor: ephemeral port, commands over IPC (status / sync / drain / exit)
  const dataDir = arg('data') || process.env.BR_ONLINE_DATA || defaultDataDir();
  const quiet = { log: (...a) => console.log(new Date().toISOString().slice(11, 19), '[' + process.pid + ']', ...a), info: () => {}, warn: console.warn, error: console.error };
  const s = await startOnlineServer({ port: Number(arg('port') || 0), dataDir, log: quiet });
  const started = Date.now();
  const status = () => { const m = process.memoryUsage(); return Object.assign({ pid: process.pid, port: s.port, rss: m.rss, heapUsed: m.heapUsed, uptime: Date.now() - started }, s.stats()); };
  const send = msg => { try { process.send(msg); } catch {} };
  let leaving = false;
  const leave = async (how, code = 0) => {
    if (leaving) return; leaving = true;
    try { await (how === 'drain' ? s.drain() : s.stop()); } catch (e) { console.error(e); }
    send({ type: 'drained' });
    setTimeout(() => process.exit(code), 100);   // the 'drained' message leaves first
  };
  process.on('message', async msg => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'status') send(Object.assign({ type: 'status', id: msg.id }, status()));
    else if (msg.type === 'sync') { try { await s.sync(); send({ type: 'synced', id: msg.id, ok: true }); } catch (e) { send({ type: 'synced', id: msg.id, ok: false, error: e.message }); } }
    else if (msg.type === 'drain') leave('drain');
    else if (msg.type === 'exit') leave('stop');
  });
  process.on('disconnect', () => leave('stop'));   // the supervisor is gone: nothing reaches this port any more
  process.on('SIGINT', () => {});                  // Ctrl+C in the console window: the supervisor drives the shutdown
  process.on('SIGTERM', () => leave('stop'));
  send(Object.assign({ type: 'ready' }, status()));
} else if (isMain) {
  const port = Number(arg('port') || process.env.BR_ONLINE_PORT || 8420);
  const dataDir = arg('data') || process.env.BR_ONLINE_DATA || defaultDataDir();
  const quiet = { log: (...a) => console.log(new Date().toISOString().slice(11, 19), ...a), info: () => {}, warn: console.warn, error: console.error };
  const s = await startOnlineServer({ port, dataDir, log: quiet });
  console.log('\nBattle Report 40k – online server (single process – Online-Server.cmd runs it under the supervisor with reload)\n');
  console.log('  Local:     http://127.0.0.1:' + s.port + '/          (this PC only)');
  console.log('  Admin:     http://127.0.0.1:' + s.port + '/admin     (invite codes, users – this PC only)');
  console.log('  Data:      ' + s.dataDir);
  console.log('\n  Internet:  start the Cloudflare tunnel in a second window:');
  console.log('               Online-Tunnel.cmd        (quick tunnel → random https://….trycloudflare.com address)');
  console.log('             or a named tunnel with your own domain (see ONLINE.md).');
  console.log('  Invite:    node server/online-admin.mjs invite   → give the code to a player for "Create account".\n');
  const bye = async () => { await s.stop(); process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}
