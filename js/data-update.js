/* Unit data update in the app (no PC, no server): when the device is online, ask GitHub whether New Recruit's data repo
 * (BSData/wh40k-11e) has a newer commit than the data in use. If so: download ONLY the changed catalogue files, take the
 * rest from the app (bundled /bsdata/ or earlier updates), convert everything on the device with the same converter as
 * the PC (js/data/bsdata-convert-core.js) and store the result in the app (window.BR.saveData → files/data-overlay,
 * served by the app's own server before the bundled data). Offline the app simply keeps the last data.
 * Status for the lobby: getDataStatus() / onDataStatus(fn). */
const REPO = 'BSData/wh40k-11e';
const API = `https://api.github.com/repos/${REPO}`;
const RAW = sha => `https://raw.githubusercontent.com/${REPO}/${sha}/`;
const LS_CHECK = 'br40k.dataCheck';

let status = { state: 'idle', version: null, date: null, latest: null, msg: '' };
const subs = new Set();
function set(patch) { status = Object.assign({}, status, patch); for (const fn of subs) { try { fn(status); } catch (e) { console.error(e); } } }
export const getDataStatus = () => status;
export function onDataStatus(fn) { subs.add(fn); return () => subs.delete(fn); }

const getJson = async (url, opt) => { const r = await fetch(url, Object.assign({ cache: 'no-store' }, opt)); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
const getText = async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };
/** Fingerprint of the converter code: data converted by an older converter is converted again. */
async function converterHash() {
  const t = await getText(new URL('./data/bsdata-convert-core.js', import.meta.url).href);
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** Current data: version (BSData commit) + date of the data in use (overlay or bundled). */
export async function loadDataInfo() {
  try {
    const idx = await getJson(new URL('../data/datasheets/index.json', import.meta.url).href);
    set({ version: idx.version || null, date: idx.versionDate || null, convertedBy: idx.convertedBy || null });
  } catch (e) { console.warn('data info', e); }
  return status;
}

/** Check against GitHub; if New Recruit's repo has newer data, OFFER the update: opts.ask(info) → Promise<boolean>
 *  (popup when the app opens, see main.js). Only a newer converter (same data) is applied silently – no download.
 *  Only inside the app (window.BR). */
export async function checkDataUpdate(opts = {}) {
  if (!window.BR || typeof window.BR.saveData !== 'function') return status;
  if (status.state === 'checking' || status.state === 'updating') return status;
  await loadDataInfo();
  if (!navigator.onLine) { set({ state: 'offline', msg: 'No internet – using the data on this device.' }); return status; }
  set({ state: 'checking', msg: 'Checking New Recruit data (BSData) …' });
  try {
    const head = await getJson(`${API}/commits/main`, { headers: { Accept: 'application/vnd.github+json' } });
    try { localStorage.setItem(LS_CHECK, String(Date.now())); } catch {}
    const latest = head.sha, latestDate = (head.commit && head.commit.committer && head.commit.committer.date) || null;
    set({ latest, latestDate });
    const conv = await converterHash();
    if (latest === status.version) {
      if (!status.convertedBy || status.convertedBy === conv) { set({ state: 'current', msg: 'Unit data is up to date.' }); return status; }
      await update(status.version, latest, latestDate, conv, new Set());   // converter changed: convert again, nothing to download
      return status;
    }
    let changed = null;
    try { const cmp = await getJson(`${API}/compare/${status.version}...${latest}`); changed = new Set((cmp.files || []).map(x => x.filename).filter(n => /.json$/i.test(n) && !n.includes('/'))); } catch { changed = null; }
    set({ state: 'available', msg: 'New unit data available.' });
    const info = { from: status.version, latest, latestDate, files: changed ? changed.size : null };
    if (opts.ask && await opts.ask(info)) await update(status.version, latest, latestDate, conv, changed);
    else set({ msg: 'New unit data available – not installed yet.' });
  } catch (e) {
    console.warn('data update', e);
    set({ state: 'error', msg: 'Update check failed – using the data on this device. (' + (e && e.message ? e.message : e) + ')' });
  }
  return status;
}

async function update(from, to, toDate, conv, knownChanged) {
  set({ state: 'updating', msg: 'Downloading new unit data …' });
  // All catalogue files of the new commit (repo root, *.json)
  const tree = await getJson(`${API}/git/trees/${to}`);
  const names = (tree.tree || []).filter(t => t.type === 'blob' && /\.json$/i.test(t.path) && !t.path.includes('/')).map(t => t.path);
  // Changed since the data in use (if the compare works, else: download everything)
  // knownChanged: from the check (null = compare failed → download everything)
  const changed = knownChanged === undefined ? null : knownChanged;
  const core = await import('./data/bsdata-convert-core.js');
  const needed = typeof core.requiredFiles === 'function' ? core.requiredFiles(names) : names;
  const cats = {};
  let n = 0, dl = 0;
  for (const name of needed) {
    const remote = !changed || changed.has(name);
    set({ msg: `${remote ? 'Downloading' : 'Loading'} ${name} (${++n}/${needed.length}) …` });
    const text = remote ? await getText(RAW(to) + encodeURIComponent(name)) : await getText(new URL('../bsdata/' + encodeURIComponent(name), import.meta.url).href);
    cats[name] = JSON.parse(text);
    if (remote) { window.BR.saveData('bsdata/' + name, text); dl++; }
  }
  set({ msg: `Converting ${needed.length} files on the device …` });
  await new Promise(r => setTimeout(r, 30));   // let the status paint
  const out = core.convertAll(cats, { version: to });
  const files = out.files || {};
  const idx = Object.assign({}, files['index.json'] || {}, { versionDate: toDate, convertedBy: conv, updatedAt: new Date().toISOString() });
  const text = (name, obj) => (typeof core.fileText === 'function' ? core.fileText(name, obj) : JSON.stringify(obj));   // same bytes as the PC converter
  for (const [fname, obj] of Object.entries(files)) if (fname !== 'index.json') window.BR.saveData('data/datasheets/' + fname, text(fname, obj));
  window.BR.saveData('data/datasheets/index.json', text('index.json', idx));   // last: marks the update as complete
  set({ state: 'updated', version: to, date: toDate, convertedBy: conv, msg: `Unit data updated (${dl} file${dl === 1 ? '' : 's'} downloaded) – reloading …` });
  setTimeout(() => location.reload(), 1500);   // datasheet caches start fresh
}
