/* Rules keywords ([PISTOL], [SUSTAINED HITS 1], [ANTI-INFANTRY 4+] …) as tappable tags: a tap opens what the keyword
 * does – the core rule text from the game system (BSData, data/datasheets/core-abilities.json) and the rule sections
 * it refers to ("hazard rolls (06.03)"). One document-wide listener (installKeywordInfo, main.js), so the tags work in
 * every view and popup. Section numbers in any keyword text become tappable too (→ tutorial.js openOrig). */
import { esc, sheet } from './components.js';
import { loadCoreAbilities, loadDatasheets, ALLY_PACKS } from '../data/datasheets.js';
import { getSection, CORE_URL } from '../rules-orig.js';

/* Faction abilities (the datasheet's "FACTION: CABAL OF SORCERERS" line): the army rule only says "models with this
 * ability" – the tag opens that army rule and lists the units that have the ability. The rule text lives in the faction's
 * datasheet pack (armyRules, BSData); abilities of allied units live in the ally's pack. */
const ABILITY_HOME = {
  'ASSIGNED AGENTS': 'imperial-agents', 'KILL TEAM': 'imperial-agents', 'DARK PACTS': 'chaos-space-marines', 'COMBAT DOCTRINES': 'space-marines',
  'THE SHADOW OF CHAOS': 'chaos-daemons', 'DISPARATE PATHS': 'aeldari', 'BATTLE FOCUS': 'aeldari', 'VOICE OF COMMAND': 'astra-militarum',
  'SYNAPSE': 'tyranids', 'SHADOW IN THE WARP': 'tyranids', 'DOCTRINA IMPERATIVES': 'adeptus-mechanicus', 'BONDSMAN': 'imperial-knights'
};
const upName = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const sameRule = (a, b) => { const x = upName(a), y = upName(b); return x === y || x.replace(/\s*\(.*\)$/, '') === y.replace(/\s*\(.*\)$/, ''); };
/** Tag of a faction ability: like a keyword tag, with the faction it belongs to (its pack holds the army rule). */
export function facAbTag(name, facId, model, unit) {
  const n = String(name || '').trim();
  if (!n) return '';
  return `<button type="button" class="kw-tag fac" data-kw="${esc(n)}" data-fac="${esc(facId || '')}"${model ? ` data-model="${esc(model)}" data-unit="${esc(unit || '')}"` : ''}>[${esc(n.toUpperCase())}]</button>`;
}
/** The model-bound note of a keyword / ability tag: whose it is and that it goes when that model goes. */
function boundNote(name, model, unit) {
  if (!model) return '';
  const own = unit && unit !== model;
  const many = /\s\/\s/.test(model);
  return `<p class="kw-bound"><b data-no-i18n>[${esc(upName(name))}]</b> ${own ? esc(many ? 'belongs to the models' : 'belongs to the model') : esc('comes from the attached Leader')} <b data-no-i18n>${esc(model)}</b>${own ? ` ${esc('of')} <b data-no-i18n>${esc(unit)}</b>` : ''}. ${own
    ? esc('The unit has it only while that model is alive – once it is destroyed, the unit no longer counts as having it (for rules, Stratagems and abilities that ask for it).')
    : esc('The unit has it only while that Leader is attached and alive – once he is destroyed or leaves, it is gone.')}</p>`;
}
/** The army rule behind a faction ability → { rule, pack, id } | null (own faction first, then the ability's home pack, then the ally packs). */
async function armyRuleFor(name, facHint) {
  const ids = [...new Set([facHint, ABILITY_HOME[upName(name)], ...ALLY_PACKS].filter(Boolean))];
  for (const id of ids) {
    const pack = await loadDatasheets(id).catch(() => null);
    const rule = pack && (pack.armyRules || []).find(r => sameRule(r.name, name));
    if (rule) return { rule, pack, id };
  }
  return null;
}
const richRule = t => kwify(esc(String(t || '').replace(/\^\^/g, ''))).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

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
/** A core rules section number ("06.03") as a tappable reference – opens the original section (tutorial.js). */
const SECTION = /\(((?:0[1-9]|1\d|2\d)\.\d\d(?:\.\d\d)?)\)/g;
export const refify = html => String(html).replace(SECTION, (m, n) => `(<button type="button" class="kw-ref" data-tut-ref="${n}">${n}</button>)`);
/** Already escaped HTML: every [KEYWORD] becomes a tag, every section number "(06.03)" a reference. */
export function kwify(html) {
  return refify(String(html).replace(/\[([A-Za-z][A-Za-z0-9 :'’+\-\/"]*)\]/g, (m, k) => kwTag(k)));
}

/** Rule text of a keyword: exact name, else without its value ("SUSTAINED HITS 1" → SUSTAINED HITS, "ANTI-INFANTRY 4+" → ANTI).
 *  A keyword restriction ("LETHAL HITS: NON-MONSTER/VEHICLE", 24.01), a datasheet condition ("FIGHTS FIRST*") and a bracket note
 *  ("DEADLY DEMISE D6+3 (SZAREKH MODEL ONLY)") are split off first: → { key, text, restr, star, note } | null.
 *  Only values (numbers, dice, "+") are dropped – a different word is a different ability ([PSYCHIC ASSASSIN] ≠ [PSYCHIC]). */
function lookup(core, name) {
  if (!core) return null;
  let up = String(name).toUpperCase().replace(/\s+/g, ' ').trim();
  const exact = core[up] ? { key: up, text: core[up] } : null;
  if (exact) return exact;
  let note = '';
  up = up.replace(/\s*\(([^)]*)\)\s*$/, (m, x) => { note = x; return ''; });
  let restr = '';
  const rm = /^([^:]+?)\s*:\s*(.+)$/.exec(up);
  if (rm) { up = rm[1]; restr = rm[2]; }
  const star = /\*$/.test(up) && !core[up];
  if (star) up = up.replace(/\s*\*+$/, '');
  const base = up.replace(/(?:\s+[D\d+"*-]+)+$/, '');
  const tries = [up, up.replace(/ /g, '-'), up.replace(/-/g, ' '), base, base.replace(/ /g, '-'), /^ANTI-/.test(up) ? 'ANTI' : ''];
  for (const t of tries) if (t && core[t]) return { key: t, text: core[t], restr, star, note };
  return null;
}
const clean = t => String(t || '').replace(/\^\^/g, '').replace(/\*\*(.+?)\*\*/g, '$1');

/* The sections the keyword texts refer to: their title and the app's short explanation (data/core.js ids), shown
 * while the original core rules are not on the device. A section missing here still gets its tappable reference. */
const REFS = {
  '04.01': ['Select Weapons'],
  '05.03': ['Save Rolls', 'sho-allocate'],
  '06.03': ['Hazard Rolls', 'sho-hazard', 'gen-mortal'],
  '10.05': ['Assault Shooting', 'sho-eligible'],
  '10.06': ['Close-quarters Shooting', 'sho-eligible', 'sho-monster'],
  '10.07': ['Indirect Shooting', 'sho-indirect'],
  '12.04': ['Fight Step', 'fgt-order'],
  '13.06': ['Terrain and Movement', 'mov-terrain'],
  '13.08': ['Benefit of Cover', 'sho-cover'],
  '20.04': ['Ingress Move', 'mov-reserves'],
  '21.03': ['Flying Models', 'mov-fly']
};
let coreRules = null;
async function shortRules() {
  if (coreRules) return coreRules;
  try {
    const { CORE } = await import('../../data/core.js');
    coreRules = new Map([...Object.values(CORE.phases).flatMap(p => p.rules), ...(CORE.turnStart || []), ...(CORE.general || [])].map(r => [r.id, r]));
  } catch { coreRules = new Map(); }
  return coreRules;
}
/** "Referenced rules": the original section when the core rules are on the device, else the app's short explanation. */
async function refsHtml(text) {
  const nums = [...new Set([...String(text).matchAll(SECTION)].map(m => m[1]))];
  if (!nums.length) return '';
  const short = await shortRules();
  let anyOrig = false;
  const parts = nums.map(n => {
    const orig = getSection(n);
    const [title, ...ids] = REFS[n] || [];
    const head = `<h3 class="kw-ref-h"><span class="kw-ref-num">${esc(n)}</span> ${esc(orig ? orig.title : title || 'Core rules')}</h3>`;
    if (orig) { anyOrig = true; return `<section class="kw-ref-sec">${head}<div class="orig-sec" data-no-i18n lang="en">${refify(orig.html)}</div></section>`; }
    const rules = ids.map(id => short.get(id)).filter(Boolean);
    return `<section class="kw-ref-sec">${head}${rules.map(r => `<div class="kw-short"><b>${esc(r.title)}</b><div class="kw-rule" data-no-i18n lang="en">${kwify(esc(r.text))}</div></div>`).join('')}
      <button type="button" class="tut-ref" data-tut-ref="${esc(n)}">📖 <b>${esc(n)}</b> Original text</button></section>`;
  });
  return `<div class="kw-refs"><p class="kw-refs-h">Referenced rules</p>${parts.join('')}
    <p class="muted xs">${anyOrig ? 'Original text: Warhammer 40,000 Core Rules (Games Workshop), via ' + esc(CORE_URL.replace(/^https:\/\//, '')) : 'Short explanation of this app – the original text is a tap away (download once).'}</p></div>`;
}

/** Markdown-style *emphasis* (examples, designer's notes in the BSData texts) → italic, without the asterisks. */
const emph = html => String(html).replace(/(^|[\s(>])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:<]|$)/g, '$1<i>$2</i>');

async function openKeyword(name, facHint, model, unit) {
  const core = await loadCoreAbilities();
  const hit = lookup(core, name);
  const bound = boundNote(name, model, unit);
  if (!hit) {
    const ar = await armyRuleFor(name, facHint);
    if (ar) {
      const facName = (ar.pack.faction && ar.pack.faction.name) || (ar.pack.name) || ar.id;
      // the units with the ability – with the model that carries it when only some models do (abilities.factionModels)
      const units = (ar.pack.units || []).filter(u => ((u.abilities || {}).faction || []).some(a => sameRule(a, name)))
        .map(u => { const fm = ((u.abilities || {}).factionModels || {}); const k = Object.keys(fm).find(x => sameRule(x, name)); return u.name + (k ? ` (${fm[k].join(' / ')})` : ''); });
      sheet({
        title: `[${upName(name)}]`,
        body: `${bound}<p class="muted small">${esc('Faction ability – the army rule of')} <b data-no-i18n>${esc(facName)}</b>. ${esc('A unit has it only while a model with this ability is in it – an attached Leader brings it along and takes it with him when he dies.')}</p>
          <div class="kw-rule" data-no-i18n lang="en"><b>${esc(ar.rule.name)}</b><br>${emph(richRule(ar.rule.text))}</div>
          ${units.length ? `<div class="label">${esc('Units with this ability')} <span class="muted">(${units.length})</span></div><p class="small" data-no-i18n>${units.map(esc).join(' · ')}</p>` : ''}
          <p class="muted xs">${esc('Army rule (BSData / New Recruit).')}</p>`,
        cls: 'kw-sheet',
        actions: [{ label: 'Close', kind: 'ghost' }]
      });
      return;
    }
  }
  const refs = hit ? await refsHtml(clean(hit.text)) : '';
  const up = String(name).toUpperCase();
  // value = what follows the rule name, without restriction / asterisk / note ("SUSTAINED HITS 2: NON-MONSTER/VEHICLE" → 2)
  const bare = up.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*:.*$/, '').replace(/\s*\*+$/, '');
  const value = hit && hit.key !== bare && bare.replace(/-/g, ' ').startsWith(hit.key.replace(/-/g, ' ')) ? bare.slice(hit.key.length).replace(/^[\s-]+/, '') : '';
  const xy = value && /^ANTI/.test(hit.key) ? value.match(/^(.+?)\s+(\d\+)$/) : null;
  const extra = hit ? [
    xy ? `${esc(hit.key)}: X = <b>${esc(xy[1])}</b>, Y = <b>${esc(xy[2])}</b> in the rule below.`
      : value ? `${esc(hit.key)} with the value <b>${esc(value)}</b> – the rule below uses it as “x”.` : '',
    hit.restr ? `Only against a target with one or more of the keywords after the colon (24.01): <b data-no-i18n>${esc(hit.restr)}</b> – a NON- keyword means a target without it.` : '',
    hit.star ? 'The asterisk (*) means the datasheet limits this ability – see the unit\'s abilities for the condition.' : '',
    hit.note ? `Datasheet note: <b data-no-i18n>${esc(hit.note)}</b>.` : ''
  ].filter(Boolean) : [];
  sheet({
    title: `[${up}]`,
    body: bound + (hit
      ? `${extra.map(x => `<p class="muted small">${refify(x)}</p>`).join('')}<div class="kw-rule" data-no-i18n lang="en">${emph(kwify(esc(clean(hit.text)))).replace(/\n/g, '<br>')}</div><p class="muted xs">Core rule (BSData / New Recruit).</p>${refs}`
      : `<p class="muted">${model ? esc('A keyword has no rule text of its own – rules, Stratagems and abilities refer to it by name.') : esc('No core rule with this name – if it is an ability of a datasheet, its text is in the unit\'s abilities.')}</p>`),
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
    openKeyword(b.dataset.kw, b.dataset.fac || '', b.dataset.model || '', b.dataset.unit || '');
  }, true);
}
