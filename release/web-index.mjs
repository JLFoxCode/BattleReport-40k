// Writes release/web-index.json: every web file of the app with SHA-1 and size, plus the version (versionCode) of this
// build. Committed with each release; the apps compare it with their own copy and download only the changed files
// (raw files of the release tag on GitHub) – see js/ui/update-popup.js. Called by android/build.sh and desktop/build.sh.
//   node release/web-index.mjs <versionCode>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// What the app serves; unit data (data/datasheets) has its own updater (js/data-update.js)
export const WEB = ['index.html', 'engine-host.html', 'manifest.webmanifest', 'sw.js', 'js', 'css', 'engine', 'data', 'vendor', 'icons'];
const SKIP = rel => rel.startsWith('data/datasheets/') || /(^|\/)\./.test(rel) || /-report\.md$/.test(rel);

export function webIndex(version) {
  const files = {};
  const walk = rel => {
    const abs = path.join(ROOT, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) { for (const n of fs.readdirSync(abs).sort()) walk(rel + '/' + n); return; }
    if (SKIP(rel)) return;
    const buf = fs.readFileSync(abs);
    files[rel] = { h: crypto.createHash('sha1').update(buf).digest('hex'), s: buf.length };
  };
  for (const w of WEB) if (fs.existsSync(path.join(ROOT, w))) walk(w);
  return { version: Number(version) || 0, files };
}

const code = process.argv[2];
if (code) {
  const idx = webIndex(code);
  fs.writeFileSync(path.join(ROOT, 'release', 'web-index.json'), JSON.stringify(idx));
  console.log(`release/web-index.json: ${Object.keys(idx.files).length} files, version ${idx.version}`);
}
