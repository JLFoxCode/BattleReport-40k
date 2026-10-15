/* The army as a book of collapsible boxes – the same picture in the army builder's "Datasheet view" and in a game's
 * "Army list" tab: on top the army rule, the detachment rule(s) and the enhancements taken, then every unit's datasheet
 * (closed, tap to open) grouped by role. The callers build the datasheet cards; this module only lays them out.
 */
import { esc } from './components.js';
import { kwify } from './keywords.js';

// role of a unit from its keywords – the order of the sections
export const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification', 'Other'];
export function roleOf(keywords) {
  const k = new Set((keywords || []).map(x => String(x).toUpperCase()));
  for (const r of ROLES) if (k.has(r.toUpperCase())) return r;
  return 'Other';
}
const byRole = (a, b) => ROLES.indexOf(a) - ROLES.indexOf(b);

const rich = t => kwify(esc(String(t || '').replace(/\^\^/g, '').replace(/\*\*/g, ''))).replace(/\n/g, '<br>');
const box = (key, title, sub, body, open) =>
  `<details class="ds-card book-box" data-key="${esc(key)}"${open ? ' open' : ''}><summary><div class="ds-head book-head"><span class="book-kind">${esc(title)}</span><span class="book-names">${esc(sub)}</span></div></summary><div class="ds-body book-body">${body}</div></details>`;

/** Rule boxes: { armyRules: [{name,text}], detachments: [{ name, rules: [{name,text}], strats: [...] }], enhancements: [{ name, on, text }] }.
 *  isOpen(key) → whether a box is open (remembered by the caller). */
export function ruleBoxes(r, isOpen = () => false) {
  const out = [];
  if ((r.armyRules || []).length) {
    out.push(box('book:army', 'Army rule', r.armyRules.map(x => x.name).join(' · '),
      r.armyRules.map(x => `<div class="det-rule"><b>${esc(x.name)}:</b> ${rich(x.text)}</div>`).join(''), isOpen('book:army')));
  }
  for (const d of r.detachments || []) {
    const key = 'book:det:' + d.name;
    const body = ((d.rules || []).map(x => `<div class="det-rule"><b>${esc(x.name)}:</b> ${rich(x.text)}</div>`).join('') || '<p class="muted xs">Rule not in the data.</p>')
      + ((d.strats || []).length ? `<details class="det-sec"><summary>Stratagems (${d.strats.length})</summary>${d.strats.map(stratHtml).join('')}</details>` : '');
    out.push(box(key, 'Detachment · ' + d.name, (d.rules || []).map(x => x.name).join(' · '), body, isOpen(key)));
  }
  if ((r.enhancements || []).length) {
    out.push(box('book:enh', 'Enhancements', r.enhancements.map(e => e.name).join(' · '),
      r.enhancements.map(e => `<div class="det-item"><b>${esc(e.name)}</b>${e.on ? ` <span class="muted xs">on ${esc(e.on)}</span>` : ''}${e.text ? `: ${rich(e.text)}` : ''}</div>`).join(''), isOpen('book:enh')));
  }
  return out.length ? `<div class="book-rules">${out.join('')}</div>` : '';
}
function stratHtml(st) {
  return `<div class="det-item det-strat"><div><b>${esc(st.name)}</b> <span class="badge num cp">${esc(st.costText || (st.cost + 'CP'))}</span>${st.category ? ` <span class="muted xs">${esc(st.category)}</span>` : ''}</div>
    ${st.when ? `<div><b class="xs">WHEN</b> ${rich(st.when)}</div>` : ''}${st.target ? `<div><b class="xs">TARGET</b> ${rich(st.target)}</div>` : ''}${st.effect ? `<div><b class="xs">EFFECT</b> ${rich(st.effect)}</div>` : ''}${st.restrictions ? `<div><b class="xs">RESTRICTIONS</b> ${rich(st.restrictions)}</div>` : ''}</div>`;
}

/** Unit cards grouped by role: items [{ role, html }] (in list order) → sections with a heading each. */
export function roleSections(items) {
  const groups = new Map();
  for (const it of items) { if (!groups.has(it.role)) groups.set(it.role, []); groups.get(it.role).push(it.html); }
  return [...groups.keys()].sort(byRole).map(r => `<section class="book-sec"><div class="book-sec-h">${esc(r)}</div>${groups.get(r).join('')}</section>`).join('');
}
