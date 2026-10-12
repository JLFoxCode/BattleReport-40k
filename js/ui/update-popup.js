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

/** Release app: newest GitHub release of the repo in assets/app-release.json (tag "v2.0.<versionCode>", asset *.apk).
 *  Newer than the installed version → popup → download + system installer (window.BR.installApk). DEV app: skipped,
 *  it updates itself from the PC. Returns true if the user started an app update. */
async function checkAppUpdate() {
  let rel = {}, me = {};
  try { rel = JSON.parse(window.BR.releaseInfo ? window.BR.releaseInfo() : '{}'); me = JSON.parse(window.BR.devInfo ? window.BR.devInfo() : '{}'); } catch {}
  if (!rel.repo || me.dev || !window.BR.installApk) return false;
  const r = await fetch(`https://api.github.com/repos/${rel.repo}/releases/latest`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return false;
  const latest = await r.json();
  const code = Number(String(latest.tag_name || '').split(/[.\-]/).pop()) || 0;
  const apk = (latest.assets || []).find(a => /\.apk$/i.test(a.name));
  if (!apk || !(code > Number(me.versionCode || 0))) return false;
  const ok = await confirmSheet({
    title: 'New app version available',
    text: `Battle Report 40k ${latest.tag_name}${latest.published_at ? ' from ' + fmt(latest.published_at) : ''} is available (installed: ${me.versionCode}).`
      + (latest.body ? ' ' + String(latest.body).slice(0, 300) : '') + ' Android will ask you to confirm the installation; your games stay on the device.',
    ok: 'Update now', cancel: 'Later'
  });
  if (!ok) return false;
  window.__appUpdateError = m => toast('App update failed: ' + m, 'bad', 6000);
  toast('Downloading the new app version …', 'ok', 4000);
  window.BR.installApk(apk.browser_download_url);
  return true;
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
