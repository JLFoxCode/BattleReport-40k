// Battle Report 40k – admin CLI of the online server (works on the data files; the running server picks the changes up).
//   node server/online-admin.mjs invite [n]               n single-use invite codes
//   node server/online-admin.mjs invites                  open invite codes
//   node server/online-admin.mjs users                    accounts
//   node server/online-admin.mjs reset-password <user> [new password]   (without: a random temporary one is printed)
//   node server/online-admin.mjs delete-user <user>       account with all its armies and finished games
//   node server/online-admin.mjs status                   running supervisor + server (memory, games, next restart)
//   node server/online-admin.mjs reload                   rolling restart now (no downtime for the players)
//   node server/online-admin.mjs update                   git pull --ff-only in the repo; reload only if server code changed
//   --data <dir> / env BR_ONLINE_DATA: data directory (default %APPDATA%\BattleReport40k-online)
//   --repo <dir>: repository for `update` (default: this checkout)
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.js';
import { CONTROL_FILE } from './online-supervisor.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const dataDir = opt('data') || process.env.BR_ONLINE_DATA || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BattleReport40k-online');
const repoDir = path.resolve(opt('repo') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const [cmd, a1, a2] = args;
const auth = createAuth({ dataDir, log: { log() {}, info() {}, warn: console.warn, error: console.error } });

// ---------------------------------------------------------------- supervisor control (server/online-supervisor.mjs)
function controlInfo() {
  const f = path.join(dataDir, CONTROL_FILE);
  let info = null;
  try { info = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  if (!info || !info.controlPort || !info.token) throw new Error('The supervisor is not running (no ' + f + ') – start Online-Server.cmd.');
  return info;
}
/** → the JSON answer of the supervisor; throws when it is not reachable (stale file) or refuses. */
export async function control(method, cmd, info = controlInfo()) {
  let r;
  try { r = await fetch(`http://127.0.0.1:${info.controlPort}/${cmd}`, { method, headers: { 'X-Control-Token': info.token } }); }
  catch { throw new Error('The supervisor does not answer on port ' + info.controlPort + ' – is Online-Server.cmd running? (stale ' + CONTROL_FILE + ')'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
  return data;
}
const mb = n => (Number(n) / 1048576).toFixed(1) + ' MB';
const ago = t => (t ? Math.round((Date.now() - t) / 60000) + ' min ago' : 'never');
const dur = ms => { const m = Math.floor(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
function printStatus(s) {
  const sv = s.supervisor || {}, c = s.server;
  console.log(`Supervisor  pid ${sv.pid}  port ${sv.port}  up ${dur(sv.uptime)}  rss ${mb(sv.rss)}  connections ${sv.connections}${sv.reloading ? '  (restart running)' : ''}`);
  if (c && !c.error) console.log(`Server      pid ${c.pid}  up ${dur(c.uptime)}  rss ${mb(c.rss)}  heap ${mb(c.heapUsed)}  games ${c.games}  event streams ${c.clients}  last action ${ago(c.lastActionAt)}`);
  else console.log('Server      ' + (c ? 'not answering: ' + c.error : 'not running'));
  const sch = s.schedule || {};
  console.log(`Schedule    daily restart at ${sch.configured}` + (sch.restartAt ? ` – next ${new Date(sch.restartAt).toLocaleString()} (only when no action for ${sch.quietMinutes} min)` : ' – off'));
  for (const r of s.reloads || []) console.log(`Reload      ${r.at}  ${r.reason}  ${r.ok ? 'ok ' + r.ms + ' ms (pid ' + r.pid + ')' : 'FAILED: ' + r.error}`);
}

/** git pull --ff-only, then a rolling restart only when server code changed. Static web files are live at once. */
export async function update({ repo = repoDir, reloadFn = () => control('POST', 'reload'), log = console.log } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  if (dirty) throw new Error('The working copy has local changes to tracked files – not updating:\n' + dirty);
  const before = git('rev-parse', 'HEAD');
  const out = git('pull', '--ff-only');
  const after = git('rev-parse', 'HEAD');
  if (before === after) { log('Already up to date (' + after.slice(0, 7) + ').'); return { updated: false, before, after, files: [], reloaded: false }; }
  const files = git('diff', '--name-only', before, after).split(/\r?\n/).filter(Boolean);
  log(`Updated ${before.slice(0, 7)} → ${after.slice(0, 7)}: ${files.length} file(s) changed.` + (out.includes('Fast-forward') ? '' : '\n' + out));
  // the server process imports server/*.js and engine/* once – only those need a restart; everything else is read per request
  const needsReload = files.some(f => /^(server|engine)\//.test(f) || f === 'package.json');
  if (!needsReload) { log('Only web files changed – they are live now, no restart needed.'); return { updated: true, before, after, files, reloaded: false }; }
  log('Server code changed (' + files.filter(f => /^(server|engine)\//.test(f)).join(', ') + ') – rolling restart …');
  let reloaded = false;
  try { await reloadFn(); reloaded = true; log('Restart done – the new server code is running.'); }
  catch (e) { log('Restart not done: ' + e.message + '\nThe web files are live; restart the server (reload) when it runs.'); }
  return { updated: true, before, after, files, reloaded };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) try {
  if (cmd === 'invite') {
    const codes = auth.createInvites(Number(a1) || 1);
    console.log('Invite code(s) – each works once for "Create account":');
    for (const c of codes) console.log('  ' + c);
  } else if (cmd === 'invites') {
    const l = auth.listInvites();
    console.log(l.length ? l.map(i => '  ' + i.code + '   ' + i.created).join('\n') : 'No open invite codes.');
  } else if (cmd === 'users') {
    const l = auth.listUsers();
    console.log(l.length ? l.map(u => `  ${u.name.padEnd(24)} since ${String(u.created || '').slice(0, 10)}   ${u.armies} armies, ${u.archive} finished games`).join('\n') : 'No accounts yet.');
  } else if (cmd === 'reset-password' && a1) {
    const pw = a2 || auth.tempPassword();
    await auth.setPassword(a1, pw);
    console.log(`Password of ${a1.toLowerCase()} reset – all their devices are signed out.` + (a2 ? '' : `\nTemporary password: ${pw}`));
  } else if (cmd === 'delete-user' && a1) {
    auth.deleteUser(a1);
    console.log(`Account ${a1.toLowerCase()} deleted (with its armies and finished games).`);
  } else if (cmd === 'status') {
    printStatus(await control('GET', 'status'));
  } else if (cmd === 'reload') {
    console.log('Rolling restart …');
    const r = await control('POST', 'reload');
    printStatus(r.status);
  } else if (cmd === 'update') {
    await update();
  } else {
    console.log('Usage: node server/online-admin.mjs invite [n] | invites | users | reset-password <user> [password] | delete-user <user> | status | reload | update   [--data <dir>] [--repo <dir>]');
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 1;
}
