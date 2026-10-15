/* Original core rules (11th edition) – loaded on the device, never shipped with the app.
 *
 * The app does not carry GW's rule texts. On request the device fetches the free core rules page from Wahapedia once
 * (through the native shell: the page sends no CORS headers), splits it into the numbered sections (01.04 Measuring
 * Distances, 03.03 Coherency …) and keeps them on the device. The tutorial and the rulebook show a section next to
 * their own explanation: getSection('03.03').
 *
 * Stored: localStorage 'br40k.coreOrig' = { v, fetchedAt, url, sections: [{ num, title, level, html }] }
 */
export const CORE_URL = 'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/';
const KEY = 'br40k.coreOrig';
const V = 2;   // 2: dice values of the hit/wound/save tables kept (05.01 …) – older copies are downloaded again

let cache = null;
export function originals() {
  if (cache) return cache;
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.v === V && Array.isArray(o.sections)) cache = o; } catch {}
  return cache;
}
export const hasOriginals = () => !!originals();
/** One section by its number ('03.03') – with its numbered subsections ('03.03.01') appended. */
export function getSection(num) {
  const o = originals();
  if (!o) return null;
  const i = o.sections.findIndex(s => s.num === num);
  if (i < 0) return null;
  const s = o.sections[i];
  const subs = [];
  for (let j = i + 1; j < o.sections.length && o.sections[j].num.startsWith(num + '.'); j++) subs.push(o.sections[j]);
  return { num: s.num, title: s.title, html: s.html + subs.map(x => `<h4>${x.title} <span class="orig-num">${x.num}</span></h4>${x.html}`).join('') };
}
export function forgetOriginals() { cache = null; try { localStorage.removeItem(KEY); } catch {} }

/** The page comes through the app's own game server (GET /api/rules-page?p=core-rules): the page sends no CORS
 *  headers, so the browser part cannot load it itself. Older app versions do not have that route yet. */
async function fetchPage(page) {
  let res;
  try { res = await fetch('/api/rules-page?p=' + encodeURIComponent(page)); }
  catch (e) { throw new Error('No connection to the app server'); }
  const o = await res.json().catch(() => ({}));
  if (res.status === 404 || (!res.ok && !o.error)) throw new Error('This app version cannot download the rules yet – please install the latest update');
  if (!res.ok || !o.html) throw new Error(o.error || 'Download failed');
  return o.html;
}

/** Download + parse + store. → the stored object */
export async function downloadOriginals() {
  const html = await fetchPage('core-rules');
  const sections = parseCoreRules(html);
  if (sections.length < 40) throw new Error('The page did not look like the core rules (' + sections.length + ' sections)');
  const o = { v: V, fetchedAt: new Date().toISOString(), url: CORE_URL, sections };
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { throw new Error('Not enough storage on the device: ' + e.message); }
  cache = o;
  return o;
}

/* ───────── parser ───────── */
const SKIP = '.tooltip_templates, .noprint, script, style, noscript, img, svg, iframe, .btnFaqErrataToggle, .faqErrataEye, .img-inv, .contentsWrap, [class*="page_ads"], .page_breaker_ads, .CornerSeeAlso';
const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'TR', 'TABLE', 'BR', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION']);
const NUM = /\s(\d\d(?:\.\d\d){0,2})\s*$/;
const NUM_FIRST = /^(\d\d(?:\.\d\d){1,2})\s+(.+)$/;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML of the Wahapedia core rules page → [{ num, title, level, html }] (html: <p>, <b>, <i>, <ul><li>, <h4>). */
export function parseCoreRules(pageHtml) {
  const doc = new DOMParser().parseFromString(pageHtml, 'text/html');
  const root = doc.querySelector('#wahMainContent') || doc.body;
  root.querySelectorAll(SKIP).forEach(n => n.remove());
  const sections = [];
  let cur = null;
  let para = '';      // inline html of the paragraph being built
  let list = null;    // open <ul> items
  const flush = () => {
    const t = para.replace(/\s+/g, ' ').trim();
    para = '';
    if (!t || !cur) return;
    if (list) list.push(t); else cur.parts.push(`<p>${t}</p>`);
  };
  const closeList = () => { flush(); if (list && cur) { if (list.length) cur.parts.push(`<ul>${list.map(x => `<li>${x}</li>`).join('')}</ul>`); } list = null; };
  const heading = el => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    let m = NUM.exec(' ' + text), num = null, title = text;
    if (m) { num = m[1]; title = text.slice(0, text.length - m[1].length).trim(); }
    else if ((m = NUM_FIRST.exec(text))) { num = m[1]; title = m[2]; }
    closeList();
    if (num) {
      cur = { num, title, level: num.split('.').length, parts: [] };
      sections.push(cur);
    } else if (cur && !/^(BASIC RULES|THE BATTLE ROUND|BATTLEFIELDS AND TACTICS|ADVANCED RULES|REFERENCE|Disable Ads)$/i.test(text)) {
      cur.parts.push(`<h4>${esc(title)}</h4>`);
    } else if (/^Disable Ads$/i.test(text)) cur = null;
  };
  const boxHeading = el => {
    const num = el.querySelector('.h_number').textContent.trim();
    const title = [...el.childNodes].filter(x => !(x.nodeType === 1 && x.classList.contains('h_number'))).map(x => x.textContent).join('').replace(/\s+/g, ' ').trim();
    if (!/^\d\d(\.\d\d){0,2}$/.test(num)) { para += esc(title); return; }
    closeList();
    // a box quoted inside another chapter (LEADER 24.22 within 19 Attached Units) stays part of that chapter
    if (cur && num.slice(0, 2) !== cur.num.slice(0, 2)) { cur.parts.push(`<h4>${esc(title)} <span class="orig-num">${num}</span></h4>`); return; }
    cur = { num, title: title.replace(/\s*\/\s*/g, ' / '), level: num.split('.').length, parts: [] };
    sections.push(cur);
  };
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) { para += esc(c.nodeValue); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName;
      if (/^H[1-4]$/.test(tag)) { heading(c); continue; }
      // rule boxes (NORMAL MOVE 09.05, NORMAL FIGHT 12.05, [BLAST] 24.05 …): name + number in one element, kept as printed
      if ((c.classList.contains('str11Name') || c.classList.contains('abName')) && c.querySelector('.h_number')) { boxHeading(c); continue; }
      // dice faces are empty elements drawn by CSS (<div class="cruD6">): keep their value as a number ("Unmodified 6 CRITICAL HIT", "2+")
      const die = /(?:^|\s)cruD([1-6])(?:\s|$)/.exec(c.className || '');
      if (die) { para += ` <b>${die[1]}</b>`; continue; }
      if (tag === 'UL' || tag === 'OL') { closeList(); list = []; walk(c); closeList(); continue; }
      if (tag === 'LI') { flush(); walk(c); flush(); continue; }
      if (tag === 'B' || tag === 'STRONG') { para += '<b>'; walk(c); para += '</b>'; continue; }
      if (tag === 'I' || tag === 'EM') { para += '<i>'; walk(c); para += '</i>'; continue; }
      if (BLOCK.has(tag)) { flush(); if (tag !== 'BR') { walk(c); flush(); } continue; }
      if (tag === 'TD' || tag === 'TH') { para += ' '; walk(c); para += ' '; continue; }
      walk(c);   // span, a, font …: inline
    }
  })(root);
  closeList();
  return sections.map(s => ({ num: s.num, title: s.title, level: s.level, html: s.parts.join('').replace(/<b>\s*<\/b>|<i>\s*<\/i>/g, '').replace(/<b>([1-6])<\/b>\s*<b>\+<\/b>/g, '<b>$1+</b>') }));
}
