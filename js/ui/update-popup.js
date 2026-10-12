/* When the app opens (once per app start, only with internet): check for newer unit data (New Recruit / BSData) and
 * – once a source is configured – a newer app version; offer each update in a popup (Update now / Later). */
import { confirmSheet, toast } from './components.js';
import { checkDataUpdate } from '../data-update.js';

const fmt = iso => { try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso || ''; } };

/** Popup: offer new unit data. Resolves true = install now. */
export function askDataUpdate(info) {
  return confirmSheet({
    title: 'New unit data available',
    text: `New Recruit's data (BSData) has been updated${info.latestDate ? ' on ' + fmt(info.latestDate) : ''}${info.files != null ? ` – ${info.files} file${info.files === 1 ? '' : 's'} changed` : ''}. `
      + 'Datasheets, abilities, army and detachment rules and enhancements will be updated on this device (takes a few seconds, games are not affected).',
    ok: 'Update now',
    cancel: 'Later'
  });
}

/** Release app: newest GitHub release of the repo in releaseInfo() (tag "v2.0.<versionCode>"; assets: *.apk for Android,
 *  BattleReport40k-Setup-*.exe for Windows). Newer than the installed version → popup → download + installer
 *  (Android: BR.installApk → system installer; Windows: BR.installUpdate → setup, the app restarts). DEV app: skipped,
 *  it updates itself from the PC. Returns true if the user started an app update. */
let appState = 'unknown';   // last result of the app version check: current | available

/* ── Partial update: release/web-index.json of the release tag (SHA-1 per web file) vs. the app's own /web-index.json;
 *    only files with a different hash are downloaded (raw files of the tag), stored by the app (BR.saveWeb) and applied
 *    (BR.applyWebUpdate: Android reloads engine + page, Windows restarts). Returns true (started) / false (declined) /
 *    null (not possible → full update). */
const rawUrl = (repo, tag, p) => `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/${p.split('/').map(encodeURIComponent).join('/')}`;
const kb = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function partialUpdate(repo, latest, code, me, platform) {
  if (!window.BR.saveWeb || !window.BR.applyWebUpdate) return null;
  const tag = latest.tag_name;
  const rel = await (await fetch(rawUrl(repo, tag, 'release/app-release.json'), { cache: 'no-store' })).json();
  const needShell = Number((rel.shell || {})[platform]) || 0;
  if (!needShell || needShell > (Number(me.shell) || 0)) return null;                 // native part changed → full update
  const remoteText = await (await fetch(rawUrl(repo, tag, 'release/web-index.json'), { cache: 'no-store' })).text();
  const remote = JSON.parse(remoteText);
  let local = { files: {} };
  try { local = await (await fetch('/web-index.json', { cache: 'no-store' })).json(); } catch {}
  const changed = Object.entries(remote.files || {}).filter(([p, f]) => !(local.files || {})[p] || local.files[p].h !== f.h);
  const bytes = changed.reduce((t, [, f]) => t + (f.s || 0), 0);
  const ok = await confirmSheet({
    title: 'New app version available',
    text: `Battle Report 40k ${tag}${latest.published_at ? ' from ' + fmt(latest.published_at) : ''} is available (installed: ${me.versionCode}). `
      + `Only the changes are downloaded: ${changed.length} file${changed.length === 1 ? '' : 's'}, ${kb(bytes)}.`
      + (latest.body ? ' ' + String(latest.body).slice(0, 300) : '') + ' Your games stay on this device.',
    ok: 'Update now', cancel: 'Later'
  });
  if (!ok) return false;
  toast(`Downloading ${changed.length} changed file${changed.length === 1 ? '' : 's'} (${kb(bytes)}) …`, 'ok', 4000);
  for (const [p] of changed) {
    const r = await fetch(rawUrl(repo, tag, p), { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status} ${p}`);
    if (!window.BR.saveWeb(p, toBase64(await r.arrayBuffer()))) throw new Error('could not store ' + p);
  }
  window.BR.saveWeb('web-index.json', toBase64(new TextEncoder().encode(remoteText)));   // the app's list now = this release
  window.BR.setWebVersion(String(code));
  toast(`Updated to ${tag} – restarting …`, 'ok', 3000);
  setTimeout(() => window.BR.applyWebUpdate(), 800);
  return true;
}
async function checkAppUpdate() {
  let rel = {}, me = {};
  try { rel = JSON.parse(window.BR.releaseInfo ? window.BR.releaseInfo() : '{}'); me = JSON.parse(window.BR.devInfo ? window.BR.devInfo() : '{}'); } catch {}
  const platform = window.BR.platform ? window.BR.platform() : 'android';
  const install = window.BR.installUpdate || window.BR.installApk;
  if (!rel.repo || me.dev || !install) return false;
  const r = await fetch(`https://api.github.com/repos/${rel.repo}/releases/latest`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return false;
  const latest = await r.json();
  const code = Number(String(latest.tag_name || '').split(/[.\-]/).pop()) || 0;
  const apk = (latest.assets || []).find(a => (platform === 'windows' ? /setup.*\.exe$/i : /\.apk$/i).test(a.name));
  if (!apk || !(code > Number(me.versionCode || 0))) { appState = 'current'; return false; }
  appState = 'available';
  // Partial update if the native part (shell) of the new version is the one installed: only the changed web files
  try { const done = await partialUpdate(rel.repo, latest, code, me, platform); if (done !== null) return done; }
  catch (e) { console.warn('partial update', e); }   // → full update below
  const ok = await confirmSheet({
    title: 'New app version available',
    text: `Battle Report 40k ${latest.tag_name}${latest.published_at ? ' from ' + fmt(latest.published_at) : ''} is available (installed: ${me.versionCode}).`
      + (latest.body ? ' ' + String(latest.body).slice(0, 300) : '') + (platform === 'windows' ? ' The update installs in the background and the app restarts by itself; your games stay on this computer.' : ' Android will ask you to confirm the installation; your games stay on the device.'),
    ok: 'Update now', cancel: 'Later'
  });
  if (!ok) return false;
  window.__appUpdateError = m => toast('App update failed: ' + m, 'bad', 6000);
  toast('Downloading the new app version …', 'ok', 4000);
  if (window.BR.installUpdate) window.BR.installUpdate(apk.browser_download_url); else window.BR.installApk(apk.browser_download_url);
  return true;
}

/** "Check for updates" button (lobby): app version first, then unit data – each offered in a popup. */
export async function checkForUpdates() {
  if (!window.BR) return;
  if (!navigator.onLine) { toast('No internet – the app keeps working with what it has.', 'warn'); return; }
  toast('Checking for updates …', 'ok', 2000);
  try { if (await checkAppUpdate()) return; } catch (e) { console.warn('app update check', e); }
  const st = await checkDataUpdate({ ask: askDataUpdate });
  if (appState === 'current' && st.state === 'current') toast('Everything is up to date – app and unit data.', 'ok', 4000);
  else if (st.state === 'error') toast('Could not check for new unit data.', 'warn', 4000);
}

let started = false;
/** Called once by main.js when the app starts. */
export async function checkOnOpen() {
  if (started || !window.BR) return;
  started = true;
  try { if (sessionStorage.getItem('br40k.openChecked')) return; sessionStorage.setItem('br40k.openChecked', '1'); } catch {}
  if (!navigator.onLine) return;   // offline: nothing to check, the app works with what it has
  try { if (await checkAppUpdate()) return; } catch (e) { console.warn('app update check', e); }   // the installer takes over
  const st = await checkDataUpdate({ ask: askDataUpdate });
  if (st.state === 'error') toast('Could not check for new unit data – using the data on this device.', 'warn', 4000);
}
