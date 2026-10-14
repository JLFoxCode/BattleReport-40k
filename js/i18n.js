/* Language of the interface (English / Deutsch). The app is written in English; for German the visible interface text
 * is translated on the fly (MutationObserver), rules content is never touched: texts from the rules sources stay in their
 * original English as long as no official German version is available (data has none). Game terms (Stratagem, CP, phases …)
 * go through a glossary of official GW German terms – the option "game terms in English" keeps them English.
 *   setLang('de'|'en'), getLang(), setKeepTerms(bool), keepTerms(), startI18n()   (main.js) */
import { PHRASES, TERMS, EXACT_TERMS, EXACT, PATTERNS } from './i18n-de.js';

const LS_LANG = 'br40k.lang', LS_TERMS = 'br40k.keepTerms';
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export const getLang = () => (read(LS_LANG, '') || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en'));
export const keepTerms = () => read(LS_TERMS, '0') === '1';
export function setLang(l) { write(LS_LANG, l === 'de' ? 'de' : 'en'); location.reload(); }
export function setKeepTerms(on) { write(LS_TERMS, on ? '1' : '0'); location.reload(); }

/* Content areas: original rules texts, names from the data, keywords – never translated */
export const SKIP = [
  '.orig-text', '.orig-block', '.strat-orig', '.strat-t', '.ds-ab', '.ds-wname', '.ds-wabil', '.ds-kw', '.ds-keywords', '.ds-profile-name',
  '.ds-title', '.ds-tag', '.ds-unitbuff', '.ds-wbuff', '.ds-list', '.kw-tag', '.kw-rule', '.det-body', '.det-rule', '.arm-effect', '.cmp-w', '.cmp-kw',
  '.arm-name', '.arm-u-main b', '.arm-row-name', '.arm-model-name', '.arm-opt', '.arm-check span:not(.arm-cost)', '.fac-item', '.arm-addrow > span:first-child',
  '.arm-cfg-line', '.arm-rules-names', '.arm-rules-body', '.cmp-opt-h b', '.strat-name', '.strat-name-btn', '.abil-name', '.abil-src', '.fx-name', '.rule-text',
  '.pname', '.code', '.cont-code', '.unit-name', '.ds-attach', '.rb-body', '.rb-text', '.mission-text', '.sec-text', '.score-text', '.score-card b',
  '.stage-text', '.log-text', '.lock-text', '.enh-text', '.dep-name', '.cond-list', '.crow', '.conds', '.fx-effect', '.fx-hint', '.dep-item .sub', '.disp-chips b', '.sec-rules li', '.mode-chips .badge',
  '[data-no-i18n]', 'code', 'pre', 'textarea', 'input', 'select'
].join(',');

let re = null, map = null, termRe = null, termMap = null;
// whole-line templates (^…) run before the phrases, the others after them; longest first
const byLen = (a, b) => b[0].length - a[0].length;
const prePats = PATTERNS.filter(p => p[0].startsWith('^')).sort(byLen).map(([p, fn]) => [new RegExp(p, 'g'), fn]);
const pats = PATTERNS.filter(p => !p[0].startsWith('^')).sort(byLen).map(([p, fn]) => [new RegExp(p, 'g'), fn]);
function build() {
  map = new Map(Object.entries(PHRASES));
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  re = keys.length ? new RegExp('(?<![A-Za-z])(' + keys.join('|') + ')(?![A-Za-z])', 'g') : null;
  if (!keepTerms()) {
    termMap = new Map(Object.entries(TERMS));
    const tk = [...termMap.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    termRe = new RegExp('(?<![A-Za-z])(' + tk.join('|') + ')(?![A-Za-z])', 'g');
  }
}
export function tr(s) {
  if (getLang() !== 'de' || !s) return s;
  if (!map) build();
  const whole = String(s).trim();
  if (EXACT[whole]) return String(s).replace(whole, EXACT[whole]);
  if (EXACT_TERMS[whole]) return keepTerms() ? s : String(s).replace(whole, EXACT_TERMS[whole]);
  let out = String(s);
  for (const [p, fn] of prePats) out = out.replace(p, fn);
  if (re) out = out.replace(re, m => map.get(m));
  for (const [p, fn] of pats) out = out.replace(p, fn);
  if (termRe) out = out.replace(termRe, m => termMap.get(m));
  return out;
}

const skipped = el => !!(el && el.closest && el.closest(SKIP));
// what this layer has written itself is not translated again (no loop, no double translation)
const done = new WeakMap();
function translateText(n) {
  const p = n.parentElement;
  if (!p || skipped(p)) return;
  const v = n.nodeValue;
  if (done.get(n) === v || !/[A-Za-z]/.test(v)) return;
  const t = tr(v);
  done.set(n, t);
  if (t !== v) n.nodeValue = t;
}
function translateAttrs(el) {
  if (el.__i18nAttr || skipped(el)) return;
  el.__i18nAttr = true;
  for (const a of ['placeholder', 'title', 'aria-label']) {
    const v = el.getAttribute(a);
    if (v && /[A-Za-z]/.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
  }
}
function translateNode(root) {
  if (!root) return;
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1 || skipped(root)) return;
  translateAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === 1 ? (skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT)
  });
  const texts = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) texts.push(n);
  texts.forEach(translateText);
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateAttrs);
}

let started = false;
export function startI18n() {
  document.documentElement.lang = getLang();
  if (started || getLang() !== 'de') return;
  started = true;
  build();
  translateNode(document.body);
  // attribute changes are not observed (a translated attribute would trigger itself)
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}
