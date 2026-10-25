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
// Repo of the releases + shell version (release/app-release.json; packaged: www/app-release.json)
const RELEASE = (() => {
  for (const f of [path.join(WEB_ROOT, 'app-release.json'), path.resolve(HERE, '..', 'release', 'app-release.json')]) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  }
  return { repo: 'JLFoxCode/BattleReport-40k', shell: {} };
})();

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const USER = app.getPath('userData');
const GAMES_DIR = path.join(USER, 'games');
const OVERLAY_DIR = path.join(USER, 'data-overlay');
const FINISHED_DIR = path.join(USER, 'finished');
const VERSION_CODE = Number(String(app.getVersion()).split('.')[2]) || 0;
// Partial update (only the changed web files of a newer release): written straight into the installed app (per-user,
// writable); web-version.txt = version they belong to. A full update (installer) replaces all files anyway.
const WEB_VERSION_FILE = path.join(USER, 'web-version.txt');
const webVersion = () => { try { const v = Number(fs.readFileSync(WEB_VERSION_FILE, 'utf8').trim()) || 0; return v > VERSION_CODE ? v : 0; } catch { return 0; } };
const WEB_PATH_OK = rel => typeof rel === 'string' && !rel.includes('..') && !rel.includes('\\') && !rel.startsWith('/') && !rel.startsWith('data/datasheets/')
  && (/^(index\.html|engine-host\.html|manifest\.webmanifest|sw\.js|web-index\.json)$/.test(rel) || /^(js|css|engine|data|vendor|icons|vr)\/[A-Za-z0-9_./ '’()+,-]+$/.test(rel));

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
sync('devInfo', () => JSON.stringify({ versionCode: Math.max(VERSION_CODE, webVersion()), installed: VERSION_CODE, shell: Number((RELEASE.shell || {}).windows) || 0, dev: false }));
// Partial app update (js/ui/update-popup.js): one changed web file (base64) → into the app; then version; then restart
// Downloaded files go to a staging folder first and are copied into the app all at once in applyWebUpdate, so an
// interrupted download never leaves a half-updated app (the staging folder is discarded on the next start).
const STAGING = path.join(USER, 'web-staging');
sync('saveWeb', (rel, b64) => {
  if (!PACKED || !WEB_PATH_OK(rel)) return false;
  const f = path.join(STAGING, rel);
  if (!path.resolve(f).startsWith(path.resolve(STAGING) + path.sep)) return false;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(String(b64 || ''), 'base64'));
  return true;
});
let pendingWebVersion = 0;
sync('setWebVersion', code => { pendingWebVersion = Number(code) || 0; return null; });
sync('applyWebUpdate', () => {
  const copy = (from, to) => { for (const e of fs.readdirSync(from, { withFileTypes: true })) { const s = path.join(from, e.name), d = path.join(to, e.name); if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); } else fs.copyFileSync(s, d); } };
  try {
    if (fs.existsSync(STAGING)) copy(STAGING, WEB_ROOT);
    if (pendingWebVersion) fs.writeFileSync(WEB_VERSION_FILE, String(pendingWebVersion));
  } finally { fs.rmSync(STAGING, { recursive: true, force: true }); }
  setTimeout(() => { app.relaunch(); app.exit(0); }, 200);
  return null;
});
try { fs.rmSync(STAGING, { recursive: true, force: true }); } catch {}   // leftover of an interrupted update
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

// Army lists of the army builder (js/builder/store.js): userData/armies/<id>.json
const ARMY_DIR = path.join(USER, 'armies');
const isArmyId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
sync('saveArmy', (id, json) => {
  if (!isArmyId(id)) return null;
  fs.mkdirSync(ARMY_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARMY_DIR, id + '.json'), json == null ? '' : String(json), 'utf8');
  return null;
});
sync('listArmies', () => {
  let files = [];
  try { files = fs.readdirSync(ARMY_DIR).filter(n => n.endsWith('.json')); } catch {}
  const list = [];
  for (const n of files) { try { const o = JSON.parse(read(path.join(ARMY_DIR, n))); if (o && typeof o === 'object' && !Array.isArray(o)) list.push(o); } catch {} }
  return JSON.stringify(list);
});
sync('deleteArmy', id => { if (isArmyId(id)) { try { fs.unlinkSync(path.join(ARMY_DIR, id + '.json')); } catch {} } return null; });

// Release app update (update popup, GitHub Releases): download the setup, run it silently (/S, no setup window) and let it
// start the new version afterwards (--force-run), then quit so the files can be replaced. Errors → window.__appUpdateError
ipcMain.on('br:openBrowser', (e, url) => { if (/^https?:\/\/[A-Za-z0-9.\-]+(:\d+)?\//.test(String(url))) shell.openExternal(String(url)); });
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
