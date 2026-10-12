/* Battle Report 40k – Windows desktop app (Electron). Works like the Android app (android/src/.../MainActivity.java +
 * HostService.java): the built-in game server (server/game-server.js) hosts the games created here, every unfinished
 * game is advertised via DNS-SD (_br40k._tcp, server/mdns.js), games of other devices are found the same way
 * (window.BR.nearby()). Everything works offline; data lives in %APPDATA%/Battle Report 40k.
 */
import { app, BrowserWindow, ipcMain, shell, Menu, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Packaged: web app in ./www, server in ./server (desktop/build.sh). Unpackaged dev run (`npm start` in desktop/): the repo.
const PACKED = fs.existsSync(path.join(HERE, 'www', 'index.html'));
const WEB_ROOT = PACKED ? path.join(HERE, 'www') : path.resolve(HERE, '..');
const SERVER_DIR = fs.existsSync(path.join(HERE, 'server', 'game-server.js')) ? path.join(HERE, 'server') : path.resolve(HERE, '..', 'server');
const BSDATA_DIR = PACKED ? null : path.resolve(HERE, '..', 'vendor-data', 'bsdata', 'wh40k-11e-main');
const ICON = path.join(WEB_ROOT, 'icons', 'icon-512.png');
const PORT0 = 8417;
const RELEASE = { repo: 'JLFoxCode/BattleReport-40k' };

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const USER = app.getPath('userData');
const GAMES_DIR = path.join(USER, 'games');
const OVERLAY_DIR = path.join(USER, 'data-overlay');
const FINISHED_DIR = path.join(USER, 'finished');
const VERSION_CODE = Number(String(app.getVersion()).split('.')[2]) || 0;

let win = null, srv = null, mdns = null, lanIps = () => [];
let port = PORT0;

const log = {
  log: (...a) => console.log('[server]', ...a),
  error: (...a) => console.error('[server]', ...a)
};

async function startServer() {
  const gs = await import(pathToFileURL(path.join(SERVER_DIR, 'game-server.js')).href);
  const { createMdns } = await import(pathToFileURL(path.join(SERVER_DIR, 'mdns.js')).href);
  lanIps = gs.lanIps;
  mdns = createMdns({ type: '_br40k._tcp', log });
  let lastErr;
  for (let p = PORT0; p < PORT0 + 20; p++) {
    try {
      srv = await gs.startGameServer({
        root: WEB_ROOT, gamesDir: GAMES_DIR, overlayDir: OVERLAY_DIR, bsdataDir: BSDATA_DIR,
        port: p, host: '0.0.0.0', log, info: { app: true, platform: 'windows' },
        onGamesChanged: list => { try { mdns.setGames(p, list); } catch (e) { log.error('mdns', e); } }
      });
      port = srv.port;
      break;
    } catch (e) {
      lastErr = e;
      if (e && e.code !== 'EADDRINUSE' && e.code !== 'EACCES') throw e;
    }
  }
  if (!srv) throw lastErr || new Error('No free port');
  mdns.startBrowse();
  log.log(`game server on port ${port} (web root ${WEB_ROOT})`);
}

const localUrl = () => `http://127.0.0.1:${port}/index.html`;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'Battle Report 40k', icon: ICON, backgroundColor: '#0F1216', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', e => e.preventDefault());   // keep "Battle Report 40k"
  const wc = win.webContents;
  // External links (https) → system browser; LAN game hosts (http) stay in the app (joining a game of another device)
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    if (/^http:/i.test(url)) { wc.loadURL(url); return { action: 'deny' }; }
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (/^https:/i.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  // The server needs a moment on first start – retry the start page
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && String(url).startsWith('http://127.0.0.1')) setTimeout(() => { if (win && !win.isDestroyed()) wc.loadURL(localUrl()); }, 500);
  });
  wc.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))) { wc.reload(); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12') { wc.toggleDevTools(); e.preventDefault(); }
  });
  win.on('closed', () => { win = null; });
  wc.loadURL(localUrl());
}

// ---------------------------------------------------------------- window.BR bridge (same API as the Android app)
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const isCode = c => typeof c === 'string' && /^[A-Z]{4}$/.test(c);
const sync = (name, fn) => ipcMain.on('br:' + name, (e, ...args) => {
  try { e.returnValue = fn(...args); } catch (err) { console.error('BR.' + name, err); e.returnValue = null; }
});

sync('nearby', () => JSON.stringify(mdns ? mdns.list() : []));
sync('lanIps', () => JSON.stringify(lanIps()));
sync('port', () => port);
sync('platform', () => 'windows');
sync('releaseInfo', () => JSON.stringify(RELEASE));
sync('devInfo', () => JSON.stringify({ versionCode: VERSION_CODE, dev: false }));
// Unit data update (js/data-update.js): only data/datasheets/*.json and bsdata/*.json, into userData/data-overlay
sync('saveData', (rel, text) => {
  if (typeof rel !== 'string' || !/^(data\/datasheets|bsdata)\/[^/\\]+\.json$/.test(rel) || rel.includes('..')) return false;
  const f = path.join(OVERLAY_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  try { fs.writeFileSync(f, text == null ? '' : String(text), 'utf8'); } catch (e) { console.error('saveData', f, e); }
  try { return fs.statSync(f).isFile(); } catch { return false; }
});
sync('clearData', () => { fs.rmSync(OVERLAY_DIR, { recursive: true, force: true }); return null; });
// Finished games on this device (js/archive.js): userData/finished/<CODE>.json + <CODE>.meta.json
sync('saveGame', (code, meta, full) => {
  if (!isCode(code)) return null;
  fs.mkdirSync(FINISHED_DIR, { recursive: true });
  fs.writeFileSync(path.join(FINISHED_DIR, code + '.json'), full == null ? '' : String(full), 'utf8');
  fs.writeFileSync(path.join(FINISHED_DIR, code + '.meta.json'), meta == null ? '' : String(meta), 'utf8');
  return null;
});
sync('listGames', () => {
  let files = [];
  try { files = fs.readdirSync(FINISHED_DIR).filter(n => n.endsWith('.meta.json')); } catch {}
  const list = [];
  for (const n of files) { try { const o = JSON.parse(read(path.join(FINISHED_DIR, n))); if (o && typeof o === 'object' && !Array.isArray(o)) list.push(o); } catch {} }
  list.sort((x, y) => String(y.savedAt || '').localeCompare(String(x.savedAt || '')));
  return JSON.stringify(list);
});
sync('loadGame', code => (isCode(code) ? read(path.join(FINISHED_DIR, code + '.json')) : null));
sync('deleteGame', code => {
  if (!isCode(code)) return null;
  for (const f of [code + '.json', code + '.meta.json']) { try { fs.unlinkSync(path.join(FINISHED_DIR, f)); } catch {} }
  return null;
});

// Release app update (update popup, GitHub Releases): download the setup, run it silently (/S, no setup window) and let it
// start the new version afterwards (--force-run), then quit so the files can be replaced. Errors → window.__appUpdateError
ipcMain.on('br:installUpdate', (e, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) return;
  const sender = e.sender;
  const fail = err => {
    const m = JSON.stringify(String((err && err.message) || err));
    try { if (!sender.isDestroyed()) sender.executeJavaScript(`window.__appUpdateError && window.__appUpdateError(${m})`); } catch {}
  };
  const file = path.join(os.tmpdir(), `BattleReport40k-Setup-update-${Date.now()}.exe`);
  download(url, file).then(() => {
    const child = spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' });
    child.on('error', fail);
    child.unref();
    setTimeout(() => app.quit(), 300);
  }).catch(fail);
});

function download(url, file, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 10) return reject(new Error('Too many redirects'));
    const req = https.get(url, { headers: { 'User-Agent': 'BattleReport40k-Desktop', Accept: 'application/octet-stream' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        if (!next.startsWith('https://')) return reject(new Error('Insecure redirect'));
        return resolve(download(next, file, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const out = fs.createWriteStream(file);
      res.pipe(out);
      out.on('finish', () => out.close(err => (err ? reject(err) : resolve(file))));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.setTimeout(60000, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- lifecycle
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  // Camera (photos, SPEC §11/§12) etc. – the app only shows its own pages and game hosts in the LAN
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'notifications'].includes(perm)));
  try { await startServer(); }
  catch (e) { console.error('server start failed', e); }
  createWindow();
});

let quitting = false;
app.on('before-quit', e => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  const t = setTimeout(() => app.exit(0), 1500);
  Promise.allSettled([mdns && mdns.stop(), srv && srv.stop()]).then(() => { clearTimeout(t); app.exit(0); });
});
app.on('window-all-closed', () => app.quit());
