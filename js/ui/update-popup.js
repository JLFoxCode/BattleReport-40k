/* When the app opens (once per app start, only with internet): check for a newer app version (popup: Update now / Later)
 * and for newer unit data (New Recruit / BSData) – new unit data is offered in a banner that does not block the app,
 * once per data version; "Check for updates" / "Check now" in the menu ask in a popup. */
import { confirmSheet, toast, esc } from './components.js';
import { checkDataUpdate, onDataStatus } from '../data-update.js';
import { getLang } from '../i18n.js';

const loc = () => (getLang() === 'de' ? 'de-DE' : 'en-GB');
const fmt = iso => { try { return new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso || ''; } };
const fmtDay = iso => { try { return new Date(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return iso || ''; } };
const filesChanged = n => (n != null ? `${n} file${n === 1 ? '' : 's'} changed` : '');

/** Popup: offer new unit data. Resolves true = install now. (One sentence per paragraph – each is translated whole.) */
export function askDataUpdate(info) {
  return confirmSheet({
    title: 'New unit data available',
    body: `<p>${info.latestDate ? `New Recruit's data (BSData) has been updated on ${esc(fmt(info.latestDate))}.` : 'New Recruit\'s data (BSData) has been updated.'}${info.files != null ? `</p><p class="muted small">${esc(filesChanged(info.files))}` : ''}</p>`
      + '<p>Datasheets, abilities, army and detachment rules and enhancements will be updated on this device (takes a few seconds, games are not affected).</p>',
    ok: 'Update now',
    cancel: 'Later'
  });
}

/* ── Banner when the app opens: new unit data, with an Update button; does not block the menu. Shown once per data
 *    version (BSData commit) – afterwards the menu line "Unit data …" says it is available (Check now). */
const LS_OFFERED = 'br40k.dataOffered';
let banner = null;   // { el, done(result) }
export function closeDataBanner() { if (banner) banner.done(false); }
export function bannerAsk(info) {
  try { if (localStorage.getItem(LS_OFFERED) === info.latest) return Promise.resolve(false); localStorage.setItem(LS_OFFERED, info.latest); } catch {}
  closeDataBanner();
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'upd-banner';
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="upd-banner-t"><b>New unit data available</b>${info.latestDate ? `<span class="muted xs">New Recruit data from ${esc(fmtDay(info.latestDate))}</span>` : ''}${info.files != null ? `<span class="muted xs">${esc(filesChanged(info.files))}</span>` : ''}</div>
      <button type="button" class="btn primary sm" data-upd="ok">Update</button>
      <button type="button" class="btn ghost icon" data-upd="x" aria-label="Later">✕</button>`;
    // another check starting (Check now) ends this offer
    const off = onDataStatus(s => { if (s.state === 'checking' || s.state === 'updating') done(false); });
    const done = r => {
      if (!banner || banner.el !== el) return;
      banner = null;
      off();
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
      resolve(r);
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-upd]'); if (b) done(b.dataset.upd === 'ok'); });
    banner = { el, done };
    document.body.appendChild(el);
  });
}

/** Release app: newest GitHub release of the repo in releaseInfo() (tag "v2.0.<versionCode>"). Newer than the installed
 *  version → popup → only the changed web files (partial update, no installer needed); a new native part (shell) → the
 *  installer of the newest release that has one (assets: *.apk for Android, BattleReport40k-Setup-*.exe for Windows;
 *  Android: BR.installApk → system installer; Windows: BR.installUpdate → setup, the app restarts). DEV app: skipped,
 *  it updates itself from the PC. Returns true if the user started an app update. */
let appState = 'unknown';   // last result of the app version check: current | available

/* ── Partial update: release/web-index.json of the release tag (SHA-1 per web file) vs. the app's own /web-index.json;
 *    only files with a different hash are downloaded (raw files of the tag), stored by the app (BR.saveWeb) and applied
 *    (BR.applyWebUpdate: Android reloads engine + page, Windows restarts). Returns true (started) / false (declined) /
 *    null (not possible → full update). */
const rawUrl = (repo, tag, p) => `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/${p.split('/').map(encodeURIComponent).join('/')}`;
/** Release notes (written in English, content – not translated). */
const relNotes = body => (body ? `<p class="muted small" data-no-i18n lang="en">${esc(String(body).slice(0, 300))}</p>` : '');
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
    body: `<p>${esc(`Battle Report 40k ${tag}${latest.published_at ? ' from ' + fmt(latest.published_at) : ''} is available (installed: ${me.versionCode}).`)}</p>`
      + `<p>${esc(`Only the changes are downloaded: ${changed.length} file${changed.length === 1 ? '' : 's'}, ${kb(bytes)}.`)}</p>`
      + relNotes(latest.body) + '<p>Your games stay on this device.</p>',
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
  // newest release by version code – web-only releases carry no installer and are not marked "latest" on GitHub
  // (that stays the last release with installers, the download link for new devices)
  const r = await fetch(`https://api.github.com/repos/${rel.repo}/releases?per_page=30`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return false;
  const codeOf = x => Number(String(x.tag_name || '').split(/[.\-]/).pop()) || 0;
  const list = (await r.json()).filter(x => !x.draft && !x.prerelease).sort((a, b) => codeOf(b) - codeOf(a));
  const latest = list[0];
  const code = latest ? codeOf(latest) : 0;
  if (!(code > Number(me.versionCode || 0))) { appState = 'current'; return false; }
  appState = 'available';
  // Partial update if the native part (shell) of the new version is the one installed: only the changed web files
  try { const done = await partialUpdate(rel.repo, latest, code, me, platform); if (done !== null) return done; }
  catch (e) { console.warn('partial update', e); }   // → full update below
  // full update: the installer of the newest release that has one (a new shell always comes with its installers)
  const isInstaller = a => (platform === 'windows' ? /setup.*\.exe$/i : /\.apk$/i).test(a.name);
  const full = list.find(x => (x.assets || []).some(isInstaller));
  if (!full || !(codeOf(full) > Number(me.versionCode || 0))) return false;
  const apk = full.assets.find(isInstaller);
  const ok = await confirmSheet({
    title: 'New app version available',
    body: `<p>${esc(`Battle Report 40k ${full.tag_name}${full.published_at ? ' from ' + fmt(full.published_at) : ''} is available (installed: ${me.versionCode}).`)}</p>`
      + relNotes(full.body) + `<p>${platform === 'windows' ? 'The update installs in the background and the app restarts by itself; your games stay on this computer.' : 'Android will ask you to confirm the installation; your games stay on the device.'}</p>`,
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
  closeDataBanner();   // its pending offer ends – this check asks again (popup)
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
  const st = await checkDataUpdate({ ask: bannerAsk });
  if (st.state === 'error') toast('Could not check for new unit data – using the data on this device.', 'warn', 4000);
}
