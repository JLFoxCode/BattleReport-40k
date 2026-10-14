/* Rules keywords ([PISTOL], [SUSTAINED HITS 1], [ANTI-INFANTRY 4+] …) as tappable tags: a tap opens what the keyword
 * does – the core rule text from the game system (BSData, data/datasheets/core-abilities.json). One document-wide
 * listener (installKeywordInfo, main.js), so the tags work in every view and popup. */
import { esc, sheet } from './components.js';
import { loadCoreAbilities } from '../data/datasheets.js';

/** Tag of one keyword, shown in brackets: [PISTOL]. */
export function kwTag(name) {
  const n = String(name || '').trim().replace(/^\[|\]$/g, '');
  if (!n) return '';
  return `<button type="button" class="kw-tag" data-kw="${esc(n)}">[${esc(n.toUpperCase())}]</button>`;
}
/** Comma list of keywords ("Sustained Hits 1, Heavy") → tags. */
export function kwList(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(/\s*,\s*/);
  return arr.map(x => String(x).trim()).filter(x => x && x !== '-').map(kwTag).join(' ');
}
/** Already escaped HTML: every [KEYWORD] becomes a tag. */
export function kwify(html) {
  return String(html).replace(/\[([A-Za-z][A-Za-z0-9 :'’+\-\/"]*)\]/g, (m, k) => kwTag(k));
}

/** Rule text of a keyword: exact name, else without its value ("SUSTAINED HITS 1" → SUSTAINED HITS, "ANTI-INFANTRY 4+" → ANTI). */
function lookup(core, name) {
  if (!core) return null;
  const up = String(name).toUpperCase().replace(/\s+/g, ' ').trim();
  const tries = [up, up.replace(/\s+[D\d+"*-]+$/, ''), up.replace(/\s+\S+$/, ''), up.split('-')[0], up.split(' ')[0]];
  for (const t of tries) if (t && core[t]) return { key: t, text: core[t] };
  return null;
}
const clean = t => String(t || '').replace(/\^\^/g, '').replace(/\*\*(.+?)\*\*/g, '$1');

async function openKeyword(name) {
  const core = await loadCoreAbilities();
  const hit = lookup(core, name);
  const up = String(name).toUpperCase();
  const value = hit && hit.key !== up ? up.slice(hit.key.length).replace(/^[\s-]+/, '') : '';
  sheet({
    title: `[${up}]`,
    body: hit
      ? `${value ? `<p class="muted small">${esc(hit.key)} with the value <b>${esc(value)}</b> – the rule below uses it as “x”.</p>` : ''}<div class="kw-rule">${kwify(esc(clean(hit.text))).replace(/\n/g, '<br>')}</div><p class="muted xs">Core rule (BSData / New Recruit).</p>`
      : '<p class="muted">No rule text on file for this keyword.</p>',
    cls: 'kw-sheet',
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}

let installed = false;
export function installKeywordInfo() {
  if (installed) return;
  installed = true;
  // capture: a tag inside a tappable card (e.g. a weapon option) only opens the info, it does not pick the card
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-kw]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    openKeyword(b.dataset.kw);
  }, true);
}
