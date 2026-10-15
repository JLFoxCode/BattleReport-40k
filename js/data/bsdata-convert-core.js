// Isomorphic BSData → datasheet conversion (browser/WebView + Node). No Node APIs, no dependencies.
// Converts BattleScribe-JSON catalogues of BSData/wh40k-11e into the objects written to data/datasheets/
// (<faction>.json, index.json, core-abilities.json) plus the markdown of data/bsdata-rules-report.md.
// The vendor data is only read as parsed JSON, never executed. Note: the passed catalogue objects are annotated
// in place (`__file` on each catalogue root) — pass fresh parses if you need them pristine.
//
//   import { convertAll, requiredFiles } from './bsdata-convert-core.js';
//   const { files, report, unresolved, stats } = convertAll({ 'Necrons.json': json, ... }, { version: sha });
//
// Output per faction: factionRules (object), armyRules [{name,text}],
// detachments [{name,dp,rules:[{name,text}],enhancements:[{name,cost,text}]}], units.

import { FACTIONS as DEFAULT_FACTIONS } from '../../data/factions/index.js';
import { BSystem, view as bsView, categoriesOfSel } from '../builder/bs-engine.js';


// ───────── Mapping: unsere Fraktions-IDs → BSData-Katalogdatei + akzeptierte "Faction: X"-Keywords ─────────
// Chapter-/Legions-Kataloge importieren per catalogueLinks (importRootEntries) die Basis-Einträge (z. B. Space Marines);
// die Keyword-Liste filtert verbündete Fremdfraktionen (Agents, Knights, Unaligned Forces, Titans) heraus.
export const MAP = [
  ['adepta-sororitas', 'Imperium - Adepta Sororitas.json', ['Adepta Sororitas']],
  ['adeptus-custodes', 'Imperium - Adeptus Custodes.json', ['Adeptus Custodes']],
  ['adeptus-mechanicus', 'Imperium - Adeptus Mechanicus.json', ['Adeptus Mechanicus']],
  ['aeldari', 'Aeldari - Craftworlds.json', ['Asuryani', 'Ynnari', 'Harlequins']],
  ['astra-militarum', 'Imperium - Astra Militarum.json', ['Astra Militarum']],
  ['black-templars', 'Imperium - Black Templars.json', ['Adeptus Astartes', 'Black Templars']],
  ['blood-angels', 'Imperium - Blood Angels.json', ['Adeptus Astartes', 'Blood Angels']],
  ['chaos-daemons', 'Chaos - Chaos Daemons.json', ['Legiones Daemonica']],
  ['chaos-knights', 'Chaos - Chaos Knights.json', ['Chaos Knights']],
  ['chaos-space-marines', 'Chaos - Chaos Space Marines.json', ['Heretic Astartes']],
  ['dark-angels', 'Imperium - Dark Angels.json', ['Adeptus Astartes', 'Dark Angels']],
  ['death-guard', 'Chaos - Death Guard.json', ['Death Guard', 'Plague Legions']],
  ['deathwatch', 'Imperium - Deathwatch.json', ['Adeptus Astartes', 'Deathwatch']],
  ['drukhari', 'Aeldari - Drukhari.json', ['Drukhari', 'Harlequins']],
  ['emperors-children', "Chaos - Emperor's Children.json", ["Emperor's Children", 'Legions of Excess']],
  ['genestealer-cults', 'Genestealer Cults.json', ['Genestealer Cults', 'Tyranids']],
  ['grey-knights', 'Imperium - Grey Knights.json', ['Grey Knights']],
  ['imperial-agents', 'Imperium - Agents of the Imperium.json', ['Agents of the Imperium']],
  ['imperial-knights', 'Imperium - Imperial Knights.json', ['Imperial Knights']],
  ['leagues-of-votann', 'Leagues of Votann.json', ['Leagues of Votann']],
  ['necrons', 'Necrons.json', ['Necrons']],
  ['orks', 'Orks.json', ['Orks']],
  ['space-marines', 'Imperium - Space Marines.json', ['Adeptus Astartes']],
  ['space-wolves', 'Imperium - Space Wolves.json', ['Adeptus Astartes', 'Space Wolves']],
  ['tau-empire', "T'au Empire.json", ["T'au Empire"]],
  ['thousand-sons', 'Chaos - Thousand Sons.json', ['Thousand Sons', 'Scintillating Legions']],
  ['tyranids', 'Tyranids.json', ['Tyranids']],
  ['world-eaters', 'Chaos - World Eaters.json', ['World Eaters', 'Blood Legions']]
];

// Unterbäume, die keine Datenblatt-Information tragen (Crusade, Enhancements, Warlord-Marker, Boarding Actions …)
// ("Crusade\b": the Crusade subtree, not units/groups like "Crusaders" – Crusader Squad's models sit in a group "Crusaders")
const SKIP_RE = /^(Crusade\b|Enhancements?\b|Enhancement Upgrades|Warlord$|Weapon Upgrades|Weapon Modifications|Battle Honours|Battle Tallies|Legendary Veterans|Experience Points|Battle Scars|Chaos Boons|Boarding Acti|Bestest Bossloot|Crusade Relics|Battle Traits|Tyrannic War|Pariah Nexus|Waaagh!boss$|Terminator Honours|Show\/Hide)/i;
const PTS_ID = '51b2-306e-1021-d207';
// Waffenfähigkeiten (stehen bereits im Waffenprofil) – nicht als Kernfähigkeit der Einheit führen
const WEAPON_RULE_RE = /^(Pistol|Hazardous|Devastating Wounds|Assault|Extra Attacks|Twin-linked|Anti|Sustained Hits|Heavy|Melta|Blast|Precision|Indirect Fire|Lance|Lethal Hits|Ignores Cover|Rapid Fire|Torrent|One Shot|Cleave|Close-quarters|Psychic)\b/i;

/** Repo file names the conversion reads. The converter indexes every catalogue (cross-catalogue links, foreign
 *  detachment ids), so all BattleScribe *.json files of the repo are needed; non-JSON files (README.md …) are not. */
export function requiredFiles(allRepoFileNames) {
  return [...allRepoFileNames].filter(f => /\.json$/i.test(f)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The main catalogue file per app faction id (MAP); a faction whose file is missing is skipped and listed in `unresolved`. */
export const FACTION_CATALOGUES = MAP.map(([id, file]) => ({ id, file }));

/** Serialized text of an output file, byte-identical to what the CLI writes (faction files compact, index/core indented). */
export function fileText(name, obj) {
  return name === 'index.json' || name === 'core-abilities.json' ? JSON.stringify(obj, null, 1) : JSON.stringify(obj);
}

/**
 * @param {Map<string, object|string>|Object<string, object|string>} catalogues  repo file name → parsed JSON (or JSON text)
 * @param {{version?: string, keepLegends?: boolean, factions?: object[], log?: (s: string) => void, warn?: (s: string) => void}} [opts]
 * @returns {{files: Object<string, object>, report: string, unresolved: string[], stats: object}}
 */
export function convertAll(catalogues, opts = {}) {
  const version = opts.version == null || opts.version === '' ? 'unknown' : String(opts.version);
  const KEEP_LEGENDS = opts.keepLegends !== false;   // the builder offers Legends units → converted unless switched off
  const FACTIONS = opts.factions || DEFAULT_FACTIONS || [];
  const log = opts.log || (() => {});
  const warn = opts.warn || log;

  // ───────── Laden ─────────
  const entries0 = catalogues instanceof Map ? [...catalogues.entries()] : Object.entries(catalogues || {});
  // Deterministic order (= alphabetical repo listing, as readdirSync on the CLI): the first definition of an id wins.
  const files = entries0.map(([f]) => f).filter(f => /\.json$/i.test(f)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const byName = new Map(entries0);
  const cats = new Map();      // catalogue id → root
  const byFile = new Map();    // file name → root
  const idx = new Map();       // element id → element (erste Definition gewinnt)
  const parentOf = new Map();  // element → nächstes übergeordnetes Element mit id (für Bedingungen an Gruppen)
  let gst = null;
  for (const f of files) {
    let j;
    try { j = byName.get(f); if (typeof j === 'string') j = JSON.parse(j); } catch (e) { warn('Überspringe ' + f + ': ' + e.message); continue; }
    if (!j || typeof j !== 'object') continue;
    const r = j.catalogue || j.gameSystem;
    if (!r || typeof r !== 'object') continue;
    r.__file = f;
    cats.set(r.id, r); byFile.set(f, r);
    if (j.gameSystem) gst = r;
    (function walk(o, par) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (const x of o) walk(x, par); return; }
      if (typeof o.id === 'string') { if (!idx.has(o.id)) idx.set(o.id, o); if (par) parentOf.set(o, par); }
      const next = typeof o.id === 'string' ? o : par;
      for (const k of Object.keys(o)) if (k !== '__file') walk(o[k], next);
    })(r, null);
  }
  if (!gst) throw new Error('Keine Game-System-Datei (.gst-Äquivalent) in den übergebenen Katalogen gefunden');
  const gstRuleIds = new Set((gst.sharedRules || []).map(r => r.id));


  // ───────── Hilfsfunktionen ─────────
  const S = v => (v == null ? '' : String(v)).replace(/\r/g, '').trim();
  const up = s => S(s).toUpperCase();
  const slug = s => S(s).toLowerCase().replace(/\[legends\]/g, '').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const numOrStr = v => { const s = S(v); return /^-?\d+$/.test(s) ? Number(s) : (s || null); };
  const char = (p, name) => { const c = (p.characteristics || []).find(c => c.name === name); return c ? S(c.$text) : ''; };
  const resolve = l => (l && l.targetId ? idx.get(l.targetId) : null);
  // BSData helper category (hidden categoryEntry that no modifier unhides: Leader, Support, Non-Kroot, AC Walker …) – no keyword
  const helperCat = id => { const c = id ? idx.get(id) : null; return !!c && c.hidden === true && !(c.modifiers || []).some(m => m.field === 'hidden'); };
  const isLegendsName = n => /\[legends\]/i.test(n || '');
  const groupName = n => cleanName(n).replace(/^\d+\s*[-–]\s*\d+\s+/, '').replace(/^\d+\s+/, '');
  const cleanName = n => S(n).replace(/\s*\[Legends\]\s*/ig, ' ').replace(/\s+/g, ' ').trim();

  // Name-Modifikatoren auf infoLinks (z. B. "Deadly Demise" + "D3", "Feel No Pain" + "5+"): nur unbedingte, sonst der erste.
  function linkName(link, target) {
    let name = S(link.name || (target && target.name));
    const mods = (link.modifiers || []).filter(m => m.field === 'name');
    const uncond = mods.filter(m => !m.conditions && !m.conditionGroups);
    // only conditional ones: the one for the unit on its own (conditions = something absent, e.g. Electro-Priests
    // "5+" unless led by a Tech-Priest Dominus → "4+"), else the first
    const absentC = c => (c.type === 'lessThan' && Number(c.value) <= 1) || ((c.type === 'equalTo' || c.type === 'atMost') && Number(c.value) === 0) || c.type === 'notInstanceOf';
    const dflt = mods.find(m => !m.conditionGroups && (m.conditions || []).length && m.conditions.every(absentC));
    for (const m of (uncond.length ? uncond : dflt ? [dflt] : mods.slice(0, 1))) {
      if (m.type === 'set') name = S(m.value);
      else if (m.type === 'append') name = (name + (m.join != null ? m.join : ' ') + S(m.value)).replace(/\s+/g, ' ').trim();
    }
    return name;
  }
  function linkHiddenUnconditionally(link) {
    return (link.modifiers || []).some(m => m.field === 'hidden' && m.type === 'set' && m.value === true && !m.conditions && !m.conditionGroups);
  }
  function selConstraints(o) {
    const c = { min: null, max: null };
    for (const k of o.constraints || []) {
      if (k.field !== 'selections') continue;
      if (!['parent', 'self', 'unit-self'].includes(k.scope) && !(k.scope && k.scope.length > 12)) continue;
      if (k.type === 'min' && c.min == null) c.min = Number(k.value);
      if (k.type === 'max' && c.max == null) c.max = Number(k.value);
    }
    return c;
  }

  // Wurzel-Einträge eines Katalogs inkl. importierter Kataloge (catalogueLinks mit importRootEntries)
  // __imported: the entry comes from a catalogue imported via importRootEntries (allies such as Agents, Knights) – only
  // entries of the catalogue itself are offered regardless of their faction keyword (Corsairs in Drukhari, Shadow Legion
  // in Chaos Daemons, Questor Forgepact/Iconoclast Fiefdom units in the Knights catalogues)
  function rootEntries(cat, seen = new Set(), out = [], imported = false) {
    if (!cat || seen.has(cat.id)) return out;
    seen.add(cat.id);
    for (const e of cat.selectionEntries || []) out.push(imported ? { ...e, __imported: cat } : e);
    for (const l of cat.entryLinks || []) {
      const t = resolve(l);
      if (!t || l.hidden === true) continue;
      if (t.type !== 'unit' && t.type !== 'model') continue;
      // profiles on the root link count for the unit (Sicarian Infiltrators 'Voices in the Code')
      out.push({ ...t, name: l.name || t.name, categoryLinks: [...(t.categoryLinks || []), ...(l.categoryLinks || [])], ...((l.profiles || []).length ? { profiles: [...(t.profiles || []), ...l.profiles] } : {}), __link: l, ...(imported ? { __imported: cat } : {}) });
    }
    for (const cl of cat.catalogueLinks || []) if (cl.importRootEntries) rootEntries(cats.get(cl.targetId), seen, out, true);
    return out;
  }
  // "Faction: X" keywords of an entry incl. those on its models (Traitor Enforcer carries it only on the models)
  function factionKws(e) {
    const out = new Set();
    const add = cl => { for (const c of cl || []) if (/^Faction:/i.test(c.name || '')) out.add(up(c.name.replace(/^Faction:\s*/i, ''))); };
    add(e.categoryLinks);
    (function walk(n, d) {
      if (!n || d > 4) return;
      for (const g of n.selectionEntryGroups || []) walk(g, d + 1);
      for (const c of n.selectionEntries || []) { if (c.type === 'model') add(c.categoryLinks); walk(c, d + 1); }
      for (const l of n.entryLinks || []) { const t = resolve(l); if (t && t.type === 'model') { add(t.categoryLinks); add(l.categoryLinks); } if (t && !t.type) walk(t, d + 1); }
    })(e, 0);
    return [...out];
  }
  // Playable catalogues per app faction (as the builder maps them, js/builder/load.js): the MAP catalogue + catalogues
  // that link to it, e.g. the Space Marines chapter supplements (Ultramarines … with their own characters)
  const fidOfFile = new Map(MAP.map(([id, file]) => [file, id]));
  const ownCats = fid => {
    const main = [...byFile.entries()].find(([f]) => fidOfFile.get(f) === fid)?.[1];
    const factionOfCat = c => { const seen = new Set(); const walk = x => { if (!x || seen.has(x.id)) return null; seen.add(x.id); const f = fidOfFile.get(x.__file); if (f) return f; for (const l of x.catalogueLinks || []) { const r = walk(cats.get(l.targetId)); if (r) return r; } return null; }; return walk(c); };
    const extra = [...byFile.values()].filter(c => c !== gst && c !== main && !c.library && !/Unaligned|Titanicus|Library/i.test(S(c.name)) && !fidOfFile.has(c.__file) && factionOfCat(c) === fid)
      .sort((a, b) => (a.__file < b.__file ? -1 : a.__file > b.__file ? 1 : 0));
    return main ? [main, ...extra] : extra;
  };

  // ───────── Waffen & Profile ─────────
  function parseWeapon(p) {
    let name = cleanName(p.name), profile = null;
    // profile lines: "➤ Bolt rifle - standard", "➤ Plasma pistol- supercharge", "➤ Grenade Launcher (Frag)",
    // "➤ Melta Rifle HUNTER:Monster/Vehicle", or only "➤ Flamestorm Gauntlets" (one profile, no suffix)
    const m = /^➤\s*(.+?)\s*[-–]\s+(.+)$/.exec(name) || /^➤\s*(.+?)\s*\(([^()]+)\)$/.exec(name) || /^➤\s*(.+?)\s+(HUNTER:.+)$/i.exec(name);
    if (m) { name = m[1].trim(); profile = m[2].trim(); }
    else name = name.replace(/^➤\s*/, '');
    const ranged = p.typeName === 'Ranged Weapons';
    const kw = char(p, 'Keywords');
    const abilities = kw && kw !== 'undefined' && kw !== '-' ? kw.split(',').map(s => up(s)).filter(s => s && s !== 'UNDEFINED') : [];
    const w = { name, range: S(char(p, 'Range')) || (ranged ? '' : 'Melee'), A: S(char(p, 'A')) };
    if (ranged) w.BS = S(char(p, 'BS')); else w.WS = S(char(p, 'WS'));
    w.S = numOrStr(char(p, 'S')); w.AP = numOrStr(char(p, 'AP')); w.D = numOrStr(char(p, 'D'));
    w.abilities = abilities;
    if (profile) w.profile = profile;
    return w;
  }
  // Bodyguard units of a Leader/Support text: "… attached to the following unit(s):" followed by a bullet list
  // ("- **BOYZ**", "■ Outrider Squad", "- **^^Guardian Defenders^^**") or a comma list ("ASSAULT INTERCESSOR SQUAD, …");
  // text after the list ("You can attach this model … even if …") is not part of it.
  function attachTargets(text) {
    const t = S(text);
    const m = /attached to the following units?\s*:([\s\S]*)$/i.exec(t);
    const clean = x => cleanName(x.replace(/\*\*|\^\^|\*/g, '').replace(/[.;]\s*$/, ''));
    const ok = x => x && x.length <= 60 && !/:/.test(x);
    const out = [];
    if (m) {
      for (const line of m[1].split('\n')) {
        const l = line.trim();
        if (!l) continue;
        const b = /^[-•■▪●]\s*(.+)$/.exec(l);
        if (b) { const n = clean(b[1]); if (ok(n)) out.push(n); continue; }
        if (out.length) break;               // sentence after the list
        if (/\b(units?|excluding|which|that|share|model)\b/.test(l)) break;   // prose ("INFANTRY DAEMON units (excluding …) which …"), no list
        for (const x of l.split(',')) { const n = clean(x); if (ok(n)) out.push(n); }
        break;
      }
    }
    if (!out.length) for (const x of t.matchAll(/\*\*([^*\n]+?)\*\*/g)) { const n = clean(x[1]); if (ok(n)) out.push(n); }
    return [...new Set(out)];
  }
  function parseUnitProfile(p) {
    const inv = S(char(p, 'InSv'));
    return {
      name: cleanName(p.name), M: S(char(p, 'M')), T: numOrStr(char(p, 'T')), SV: S(char(p, 'Sv')), W: numOrStr(char(p, 'W')),
      LD: S(char(p, 'LD')), OC: numOrStr(char(p, 'OC')), INV: inv && inv !== '-' && inv !== 'N/A' ? inv : null
    };
  }

  // ───────── Detachment-abhängige Sichtbarkeit (Fähigkeiten, Waffen, Wargear) ─────────
  // Detachment-ID → Name (Upgrades mit "Detachment Points" bzw. direkt in einer Gruppe "Detachment(s)")
  const DET_NAME = new Map();
  for (const o of idx.values()) {
    if (!o || typeof o !== 'object') continue;
    if (o.type === 'upgrade' && (o.costs || []).some(c => c.typeId === '82ae-1066-5107-6ae0')) DET_NAME.set(o.id, cleanName(o.name));
    if (/^Detachments?$/i.test(S(o.name)) && !o.type) for (const e of [...(o.selectionEntries || []), ...(o.entryLinks || [])]) if (e.type === 'upgrade' || e.targetId) DET_NAME.set(e.targetId || e.id, cleanName(e.name));
  }
  // hidden-Modifikatoren (inkl. modifierGroups samt deren Bedingungen) eines Elements
  function hiddenModsOf(o) {
    const out = [];
    if (!o) return out;
    for (const m of o.modifiers || []) if (m.field === 'hidden') out.push({ m, extra: [] });
    (function grp(gs, extra) {
      for (const g of gs || []) {
        const ex = [...extra, ...(g.conditions || []), ...(g.conditionGroups || [])];
        for (const m of g.modifiers || []) if (m.field === 'hidden') out.push({ m, extra: ex });
        grp(g.modifierGroups, ex);
      }
    })(o.modifierGroups, []);
    return out;
  }
  // Sichtbarkeit abhängig von einem Detachment? → { dets: [Namen], other: bedingt versteckt aus anderem Grund }
  function gating(...objs) {
    const dets = new Set(); let other = false;
    for (const o of objs) for (const { m, extra } of hiddenModsOf(o)) {
      // alle Bedingungen (auch verschachtelt) einsammeln, die ein Detachment betreffen
      const all = [];
      (function collect(xs) { for (const c of xs || []) { if (c.childId) all.push(c); collect(c.conditions); collect(c.conditionGroups); } })([...(m.conditions || []), ...(m.conditionGroups || []), ...extra]);
      const detConds = all.filter(c => DET_NAME.has(c.childId));
      if (!detConds.length) { if (all.length || m.conditions || m.conditionGroups || extra.length) other = true; continue; }
      const hideTrue = m.value === true || m.value === 'true';
      for (const c of detConds) {
        const v = Number(c.value);
        const absent = (c.type === 'lessThan' && v <= 1) || (c.type === 'equalTo' && v === 0) || (c.type === 'atMost' && v === 0) || c.type === 'notInstanceOf';
        const present = (c.type === 'atLeast' && v >= 1) || (c.type === 'greaterThan' && v >= 0) || (c.type === 'equalTo' && v >= 1) || c.type === 'instanceOf';
        // versteckt solange Detachment fehlt bzw. eingeblendet sobald gewählt → verlangt dieses Detachment
        if ((hideTrue && absent) || (!hideTrue && present)) dets.add(DET_NAME.get(c.childId));
        else other = true;  // z. B. "versteckt, wenn Detachment X gewählt" – nicht als Voraussetzung markieren
      }
    }
    return { dets: [...dets], other };
  }
  const detTag = dets => (dets.length === 1 ? dets[0] : [...dets]);
  const unitGateStats = new Map();  // fid → { tagged: Map(name → Set(Detachments)), other: Set(Namen) }

  // ───────── Einheit konvertieren ─────────
  const unresolved = [];
  function convertUnit(root, factionId, acceptedKw, catNames = null) {
    const u = {
      id: slug(root.name), name: cleanName(root.name), points: [], composition: '', models: [], profiles: [], keywords: [], factionKeywords: [],
      ranged: [], melee: [], abilities: { core: [], faction: [], unit: [], wargear: [], invul: null, damaged: null }, leader: null, support: null, transport: null, options: [], modelsRange: [1, 1]
    };
    const factionRules = {};
    const modelCats = [];  // category names of the unit's model entries
    const seenW = new Set(), seenP = new Set(), seenA = new Set(), seenCore = new Set();
    if (!unitGateStats.has(factionId)) unitGateStats.set(factionId, { tagged: new Map(), other: new Set() });
    const stats = unitGateStats.get(factionId);
    let inh = [];  // von übergeordneten (Wargear-)Einträgen geerbte Detachment-Abhängigkeit
    // ids (entries, links, categories) of the walked ancestors: "hidden unless ancestor instanceOf X" (Daemonic Allegiance
    // profiles only on a Daemon Prince) is evaluated against them; only plain condition lists of ancestor instanceOf checks
    let anc = new Set();
    let optWg = null;  // nearest optional (min 0) upgrade above: { name, hasAbility }
    // default state of the unit on its own: entries inside it with their minimum count (everything else counts 0)
    const inUnit = new Map();
    (function pre(n, d) {
      if (!n || d > 8) return;
      for (const g of n.selectionEntryGroups || []) pre(g, d + 1);
      for (const e of n.selectionEntries || []) { if (!inUnit.has(e.id)) { inUnit.set(e.id, selConstraints(e).min || 0); pre(e, d + 1); } }
      for (const l of n.entryLinks || []) { const t = resolve(l); if (t && !inUnit.has(t.id)) { const mn = selConstraints({ constraints: [...(t.constraints || []), ...(l.constraints || [])] }).min || 0; inUnit.set(t.id, mn); inUnit.set(l.id, mn); pre(t, d + 1); } }
    })(root, 0);
    const dCond = c => {
      const v = Number(c.value);
      if (/instanceOf/i.test(c.type)) {
        if (NOT_SELECTED_FORCES.has(c.childId)) return c.type === 'notInstanceOf';
        if (c.scope === 'ancestor') { const hit = anc.has(c.childId); return c.type === 'instanceOf' ? hit : !hit; }
        return null;
      }
      if (NOT_SELECTED_FORCES.has(c.childId)) { const r = cmp(0, c.type, v); return r === undefined ? null : r; }
      if ((c.field !== 'selections' && c.field !== 'associations') || !c.childId || DET_NAME.has(c.childId)) return null;   // associations: led by …
      const t = idx.get(c.childId);
      if (!t || !t.type || !['unit', 'model', 'upgrade'].includes(t.type)) return null;   // categories, 'model', unknown → undecidable
      const r = cmp(inUnit.get(c.childId) || 0, c.type, v);
      return r === undefined ? null : r;
    };
    const dGroup = g => { const xs = [...(g.conditions || []).map(dCond), ...(g.conditionGroups || []).map(dGroup)]; return g.type === 'or' ? or3(xs) : and3(xs); };
    // profile modifiers of the walked entries ("affects": "profiles.Ranged Weapons" / "entries.profiles.…"), unconditional
    // or with plain ancestor conditions – e.g. a Lord Exultant's pistols BS 2+, Tormentors' plasma pistol + PRECISION
    let pmods = [];
    const profModsOf = o => {
      const out = [];
      for (const m of (o && o.modifiers) || []) {
        const mm = /^(?:entries\.)?profiles\.(.+)$/.exec(S(m.affects));
        if (!mm || m.conditionGroups || !['set', 'append', 'increment', 'decrement'].includes(m.type)) continue;
        const cs = m.conditions || [];
        if (!cs.every(c => c.scope === 'ancestor' && (c.type === 'instanceOf' || c.type === 'notInstanceOf'))) continue;
        if (!cs.every(c => (c.type === 'instanceOf') === anc.has(c.childId))) continue;
        out.push({ typeName: mm[1], field: m.field, type: m.type, value: m.value, join: m.join });
      }
      return out;
    };
    const applyPm = p => {
      const ms = pmods.filter(m => m.typeName === p.typeName);
      if (!ms.length) return p;
      return { ...p, characteristics: (p.characteristics || []).map(c => {
        let t = S(c.$text), hit = false;
        for (const m of ms) {
          if (m.field !== c.typeId) continue;
          hit = true;
          if (m.type === 'set') t = S(m.value);
          else if (m.type === 'append') t = t && t !== '-' ? t + (m.join != null ? m.join : ' ') + S(m.value) : S(m.value);
          else if (/^-?\d+$/.test(t) && /^-?\d+$/.test(S(m.value))) t = String(Number(t) + (m.type === 'increment' ? 1 : -1) * Number(m.value));
        }
        return hit ? { ...c, $text: t } : c;
      }) };
    };
    const ancIds = n => [n.id, n.__linkObj && n.__linkObj.id, n.__linkObj && n.__linkObj.targetId, n.__link && n.__link.id, n.__link && n.__link.targetId, ...(n.categoryLinks || []).map(c => c.targetId)].filter(Boolean);
    const ancHidden = o => {
      for (const m of (o && o.modifiers) || []) {
        if (m.field !== 'hidden' || m.type !== 'set' || !(m.value === true || m.value === 'true') || m.conditionGroups) continue;
        const cs = m.conditions || [];
        if (!cs.length || !cs.every(c => c.scope === 'ancestor' && (c.type === 'instanceOf' || c.type === 'notInstanceOf'))) continue;
        if (cs.every(c => (c.type === 'instanceOf') === anc.has(c.childId))) return true;
      }
      return false;
    };
    // Detachment-Abhängigkeit für ein Element (+ Link) bestimmen, mit geerbter zusammenführen
    const gateOf = (label, ...objs) => {
      const g = gating(...objs);
      if (g.other && !g.dets.length && label) stats.other.add(cleanName(label));
      return [...new Set([...inh, ...g.dets])];
    };
    const noteTag = (name, dets) => { if (!dets.length) return; const k = cleanName(name); if (!stats.tagged.has(k)) stats.tagged.set(k, new Set()); for (const d of dets) stats.tagged.get(k).add(d); };
    // key includes the type: a weapon with a ranged AND a melee profile of the same name (ripper gun, laser lance …) keeps both
    const addWeapon = (p, dets = []) => { const w = parseWeapon(p); const k = p.typeName + '|' + w.name + '|' + (w.profile || '') + '|' + dets.join(','); if (seenW.has(k)) return w; seenW.add(k);
      // same weapon spelt with other capitals and identical stats ('Shuriken Pistol' / 'Shuriken pistol' on Corsair Voidscarred): one row
      const ki = (k + '|' + JSON.stringify({ ...w, name: 0 })).toLowerCase(); if (seenW.has(ki)) return w; seenW.add(ki);
      if (dets.length) { w.detachment = detTag(dets); noteTag(w.name, dets); } (p.typeName === 'Ranged Weapons' ? u.ranged : u.melee).push(w); return w; };
    const addAbility = (name, text, kind, dets = []) => {
      name = cleanName(name); text = S(text);
      if (!name) return;
      const k = kind + '|' + name + '|' + dets.join(',');
      if (seenA.has(k)) return; seenA.add(k);
      // nur mit bestimmtem Detachment sichtbar → als eigene Fähigkeit mit "detachment"-Markierung (UI filtert)
      if (dets.length) { noteTag(name, dets); (kind === 'wargear' ? u.abilities.wargear : u.abilities.unit).push({ name, text, detachment: detTag(dets) }); return; }
      let m;
      // LEADER → u.leader, SUPPORT (11th ed., core rules 24.22: a support unit leads a bodyguard unit like a leader,
      // one leader + one support per bodyguard) → u.support; both { canLead: [bodyguard names], text }.
      // The Support ability also stays in abilities.unit (shown as before).
      const att = /^leader$/i.test(name) || /^leader\b/i.test(name) && /attached to the following/i.test(text) ? 'leader'
        : (/^support$/i.test(name) || /^support\b/i.test(name)) && /attached to the following/i.test(text) ? 'support' : null;
      if (att) {
        const canLead = attachTargets(text);
        const prev = u[att];
        u[att] = prev ? { canLead: [...new Set([...prev.canLead, ...canLead])], text: prev.text + '\n' + text } : { canLead: [...new Set(canLead)], text };
        if (att === 'leader') return;
      }
      if ((m = /^Invulnerable Save\s*\((\d\+\*?)\)/i.exec(name))) { if (!u.abilities.invul) u.abilities.invul = m[1]; if (!text) return; }
      if (/^Damaged\b/i.test(name)) { u.abilities.damaged = text ? name + ': ' + text : name; return; }
      (kind === 'wargear' ? u.abilities.wargear : u.abilities.unit).push({ name, text });
    };
    const addRule = (link, target) => {
      let name = linkName(link, target);
      if (!name || WEAPON_RULE_RE.test(name)) return;
      const dets = gateOf(name, link, target);
      if (dets.length) {
        // Regel nur mit bestimmtem Detachment → nicht in core/faction, sondern als markierte Fähigkeit mit Regeltext
        const k = 'rule|' + up(name) + '|' + dets.join(',');
        if (!seenA.has(k)) { seenA.add(k); noteTag(name, dets); u.abilities.unit.push({ name: cleanName(name), text: S(target.description), detachment: detTag(dets), ...(gstRuleIds.has(target.id) ? { core: true } : {}) }); }
        return;
      }
      // rule that only comes with optional wargear (Impulsor: Orbital Comms Array → Scouts 6", Reiver: Grav-chute → Deep
      // Strike): not the unit's own core ability; the wargear's ability text says it – without one, a wargear ability
      if (optWg) {
        if (!optWg.hasAbility) { const k = 'wargear|' + optWg.name + '|' + up(name); if (!seenA.has(k)) { seenA.add(k); u.abilities.wargear.push({ name: optWg.name + ': ' + cleanName(name), text: S(target.description), ...(gstRuleIds.has(target.id) ? { core: true } : {}) }); } }
        return;
      }
      // conditionally hidden: evaluated for the unit on its own (no leader/enhancement/optional wargear, no Crusade/Boarding
      // Actions) – hidden then → not the unit's own ability (Skitarii FEEL NO PAIN 5+ only led by a Dominus, T'au DEEP STRIKE
      // only in Boarding Actions); visible then → its own; undecidable → marked with *
      {
        const hm = (link.modifiers || []).filter(m => m.field === 'hidden' && m.type === 'set' && (m.value === true || m.value === 'true') && (m.conditions || m.conditionGroups));
        if (hm.length) {
          const st = hm.map(m => dGroup({ type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups }));
          if (st.some(x => x === true)) return;
          if (!st.every(x => x === false)) name += '*';
        }
      }
      if (gstRuleIds.has(target.id) || /^(Deep Strike|Deadly Demise|Feel No Pain|Scouts|Stealth|Fights First|Lone Operative|Infiltrators|Leader|Damaged|Firing Deck|Hover|Super-Heavy Walker|Psychic|Fortification)\b/i.test(name)) {
        if (/^Damaged\b/i.test(name)) { u.abilities.damaged = u.abilities.damaged || name.replace(/\*$/, ''); return; }
        if (/^Invulnerable Save\s*\((\d\+\*?)\)/i.test(name)) { u.abilities.invul = u.abilities.invul || /\((\d\+\*?)\)/.exec(name)[1]; return; }
        const k = up(name); if (!seenCore.has(k)) { seenCore.add(k); u.abilities.core.push(k); }
      } else {
        const k = up(name);
        if (!u.abilities.faction.includes(k)) { u.abilities.faction.push(k); factionRules[k] = S(target.description); }
      }
    };
    const handleProfile = (p, kind, link) => {
      if (!p || p.hidden === true || ancHidden(p) || (link && ancHidden(link))) return false;
      if (pmods.length) p = applyPm(p);
      const dets = p.typeName === 'Unit' || p.typeName === 'Transport' ? [] : gateOf(p.name, p, link);
      switch (p.typeName) {
        case 'Unit': { const pr = parseUnitProfile(p); if (!seenP.has(pr.name)) { seenP.add(pr.name); u.profiles.push(pr); if (pr.INV && !u.abilities.invul) u.abilities.invul = pr.INV; } return; }
        case 'Ranged Weapons': case 'Melee Weapons': addWeapon(p, dets); return;
        case 'Abilities': addAbility(p.name, char(p, 'Description'), kind, dets); return;
        case 'Psychic Abilities': addAbility(p.name, char(p, 'Descriptions') || char(p, 'Description'), kind, dets); return;
        case 'Transport': u.transport = u.transport || S(char(p, 'Capacity')); return;
        default: { const txt = (p.characteristics || []).map(c => S(c.$text)).filter(Boolean).join(' '); if (txt) addAbility(p.name, txt, kind, dets); }
      }
    };
    // Rekursiver Durchlauf; kind = 'unit' (Einheit/Modell) | 'wargear' (Upgrade)
    function walk(node, kind, depth, modelCtx, seen) {
      if (!node || (node.hidden === true && depth > 0) || depth > 12) return;
      if (seen.has(node)) return; seen.add(node);
      const name = S(node.name);
      if (depth > 0 && SKIP_RE.test(name)) return;
      if (depth > 0 && (ancHidden(node) || (node.__linkObj && ancHidden(node.__linkObj)))) return;
      const isModel = node.type === 'model' || (depth === 0 && node.type === 'unit');
      const k = node.type === 'upgrade' ? 'wargear' : (node.type ? 'unit' : kind);
      const savedInh = inh, savedAnc = anc, savedOpt = optWg, savedPm = pmods;
      anc = new Set([...anc, ...ancIds(node)]);
      { const pm = [...profModsOf(node), ...profModsOf(node.__linkObj)]; if (pm.length) pmods = [...pmods, ...pm]; }
      if (depth > 0 && node.type === 'upgrade' && !(selConstraints(node).min >= 1)) {
        const hasAbility = (node.profiles || []).some(p => p.typeName === 'Abilities') || (node.infoLinks || []).some(l => l.type === 'profile' && (resolve(l) || {}).typeName === 'Abilities');
        optWg = { name: cleanName(name), hasAbility };
      }
      if (depth > 0) inh = gateOf(null, node, node.__linkObj);
      // "C'tan Powers" (Tesseract Vault): a ranged-weapon profile type of its own (Range/A/BS/S/AP/D/Keywords)
      for (const p0 of node.profiles || []) { const p = p0.typeName === "C'tan Powers" ? { ...p0, typeName: 'Ranged Weapons' } : p0; if (handleProfile(p, k) !== false && modelCtx && (p.typeName === 'Ranged Weapons' || p.typeName === 'Melee Weapons')) modelCtx.weapons.add(parseWeapon(p).name); }
      for (const l of node.infoLinks || []) {
        if (l.hidden === true || linkHiddenUnconditionally(l)) continue;
        const t = resolve(l); if (!t) continue;
        if (l.type === 'profile') { const p = { ...t, name: linkName(l, t), ...(t.typeName === "C'tan Powers" ? { typeName: 'Ranged Weapons' } : {}) }; if (handleProfile(p, k, l) !== false && modelCtx && (p.typeName === 'Ranged Weapons' || p.typeName === 'Melee Weapons')) modelCtx.weapons.add(parseWeapon(p).name); }
        else if (l.type === 'rule') addRule(l, t);
        else if (l.type === 'infoGroup') { const sv = inh; inh = gateOf(null, l, t); for (const p of t.profiles || []) handleProfile(p, k); for (const r of t.rules || []) addRule({ name: r.name }, r); inh = sv; }
      }
      for (const r of node.rules || []) { if (r.hidden === true) continue; if (gstRuleIds.has(r.id)) addRule({ name: r.name }, r); else addAbility(r.name, r.description, k, gateOf(r.name, r)); }
      for (const g of node.infoGroups || []) { const sv = inh; inh = gateOf(null, g); for (const p of g.profiles || []) handleProfile(p, k); for (const r of g.rules || []) addRule({ name: r.name }, r); inh = sv; }
      let ctx = modelCtx;
      if (node.type === 'model' && depth > 0) {
        const c = selConstraints(node);
        // Modell ohne eigene Grenzen in einer begrenzten Gruppe ("4-9 Hearthguard") erbt deren Bereich
        if (c.min == null && c.max == null && node.__groupRange) { c.min = node.__groupRange.min; c.max = node.__groupRange.max; }
        ctx = { name: cleanName(name), min: c.min, max: c.max, weapons: new Set() };
        u.models.push(ctx);
        // model-level keywords (OFFICER of a Command Squad's commander, CHARACTER of Saint Celestine, a faction keyword on the models)
        for (const cl of [...(node.categoryLinks || []), ...((node.__linkObj && node.__linkObj.categoryLinks) || [])]) if (cl && cl.hidden !== true && cl.name && !helperCat(cl.targetId) && !/\bLoadout$|\bHeavy Weapon$|^Unit Champion$/i.test(S(cl.name))) modelCats.push(cl.name);   // not BSData helper categories
      }
      const gr = !node.type ? (() => { const c = selConstraints(node); return c.min != null || c.max != null ? c : node.__groupRange; })() : null;
      const children = [];
      for (const g of node.selectionEntryGroups || []) children.push(g);
      for (const e of node.selectionEntries || []) children.push(e);
      for (const l of node.entryLinks || []) { if (l.hidden === true) continue; const t = resolve(l); if (t) children.push({ ...t, name: l.name || t.name, constraints: [...(t.constraints || []), ...(l.constraints || [])], __link: true, __linkObj: l }); }
      // Optionen: Gruppen mit ≥ 2 wählbaren Kindern innerhalb eines Modells/der Einheit
      if (!node.type && children.length >= 2 && !SKIP_RE.test(name)) {
        const names = children.filter(c => c.hidden !== true && !SKIP_RE.test(S(c.name))).map(c => cleanName(c.name)).filter(Boolean);
        if (names.length >= 2) u.options.push((ctx ? ctx.name + ' – ' : '') + name + ': ' + names.join(' | '));
      }
      for (const c of children) walk(gr && c.type === 'model' && !c.__groupRange ? { ...c, __groupRange: gr } : (gr && !c.type && !c.__groupRange ? { ...c, __groupRange: gr } : c), k, depth + 1, ctx, seen);
      if (isModel && depth === 0 && node.type === 'model') {
        const ctx0 = { name: cleanName(name), min: 1, max: 1, weapons: new Set() };
        u.models.push(ctx0);
        for (const w of [...u.ranged, ...u.melee]) ctx0.weapons.add(w.name);
      }
      inh = savedInh; anc = savedAnc; optWg = savedOpt; pmods = savedPm;
    }
    walk(root, 'unit', 0, null, new Set());
    const wCanon = new Map(); for (const w of [...u.ranged, ...u.melee]) if (!wCanon.has(w.name.toLowerCase())) wCanon.set(w.name.toLowerCase(), w.name);
    const wName = n => (u.ranged.some(w => w.name === n) || u.melee.some(w => w.name === n) ? n : wCanon.get(String(n).toLowerCase()) || n);
    u.models = u.models.map(m => ({ name: m.name, min: m.min != null ? m.min : (m.max != null ? 0 : 1), max: m.max != null ? m.max : (m.min != null ? m.min : 1), weapons: [...new Set([...m.weapons].map(wName))] }));

    // Keywords – as the army builder's engine evaluates them for this catalogue (category modifiers included, e.g. an
    // INFANTRY correction or RAVENWING inside Dark Angels); without the engine the raw category links
    for (const c of [...(catNames ? catNames.map(name => ({ name })) : (root.categoryLinks || []).filter(cl => !helperCat(cl.targetId))), ...modelCats.map(name => ({ name }))]) {
      const n = cleanName(c.name);
      if (!n || /^(Configuration|Unit|Warlord|Legends)$/i.test(n) || /^Allies:/i.test(n)) continue;   // "Allies: …" marks what may be allied in, no keyword
      const m = /^Faction:\s*(.+)$/i.exec(n);
      if (m) { const f = up(m[1]); if (!u.factionKeywords.includes(f)) u.factionKeywords.push(f); }
      else { const kw = up(n); if (!u.keywords.includes(kw)) u.keywords.push(kw); }
    }
    if (isLegendsName(root.name) || root.hidden === true || (root.categoryLinks || []).some(c => /legends/i.test(c.name))) u.legends = true;

    // Modellzahl: Gruppen mit Constraints auf oberster Ebene, sonst Modelle
    const range = [0, 0]; let any = false;
    const parts = [];
    function count(node, depth) {
      for (const g of node.selectionEntryGroups || []) {
        if (g.hidden === true || SKIP_RE.test(S(g.name))) continue;
        const c = selConstraints(g);
        const hasModels = JSON.stringify(g).includes('"type":"model"');
        if (!hasModels) continue;
        if (c.min != null || c.max != null) { any = true; range[0] += c.min || 0; range[1] += c.max != null ? c.max : (c.min || 0); parts.push((c.min != null && c.max != null && c.min !== c.max ? c.min + '-' + c.max : (c.max != null ? c.max : c.min || 0)) + ' ' + groupName(g.name)); }
        else count(g, depth + 1);
      }
      for (const e of node.selectionEntries || []) {
        if (e.hidden === true || e.type !== 'model') continue;
        const c = selConstraints(e); any = true;
        const mn = c.min != null ? c.min : 1, mx = c.max != null ? c.max : mn;
        range[0] += mn; range[1] += mx; parts.push((mn !== mx ? mn + '-' + mx : mn) + ' ' + cleanName(e.name));
      }
      for (const l of node.entryLinks || []) { const t = resolve(l); if (t && t.type === 'model' && l.hidden !== true) { const c = selConstraints({ constraints: [...(t.constraints || []), ...(l.constraints || [])] }); any = true; const mn = c.min != null ? c.min : 1, mx = c.max != null ? c.max : mn; range[0] += mn; range[1] += mx; parts.push((mn !== mx ? mn + '-' + mx : mn) + ' ' + cleanName(l.name || t.name)); } }
    }
    if (root.type === 'unit') count(root, 0);
    u.modelsRange = any && range[1] > 0 ? [Math.max(1, range[0]), Math.max(range[0], range[1], 1)] : [1, 1];
    u.composition = parts.length ? parts.join(', ') : '1 ' + u.name;

    // Punkte: Basis + set-Modifikatoren mit Modellzahl-Bedingung
    const base = (root.costs || []).find(c => c.typeId === PTS_ID || c.name === 'pts');
    const basePts = base ? Number(base.value) : null;
    const thresholds = new Map();
    for (const m of root.modifiers || []) {
      if (m.field !== PTS_ID) continue;
      if (m.type !== 'set') { if (m.type === 'increment' || m.type === 'decrement') { /* Mehrfach-/Kontext-Zuschläge (z. B. 3. Einheit) ignorieren */ } continue; }
      const conds = [...(m.conditions || []), ...(m.conditionGroups || []).flatMap(g => g.conditions || [])];
      const sel = conds.find(c => c.field === 'selections' && ['atLeast', 'greaterThan', 'equalTo', 'atMost', 'lessThan'].includes(c.type));
      if (!sel || conds.length !== 1) { unresolved.push(factionId + ' / ' + u.name + ': Punkte-Modifikator (' + m.type + ' ' + m.value + ') mit ' + conds.length + ' Bedingung(en) nicht aufgelöst'); continue; }
      const v = Number(sel.value);
      let thr = null;
      if (sel.type === 'atLeast' || sel.type === 'equalTo') thr = v; else if (sel.type === 'greaterThan') thr = v + 1;
      if (thr == null) { unresolved.push(factionId + ' / ' + u.name + ': Punkte-Bedingung ' + sel.type + ' ' + v + ' nicht aufgelöst'); continue; }
      if (sel.childId !== 'model') { const t = idx.get(sel.childId); if (t && t.type !== 'model' && !t.selectionEntries && !t.entryLinks) { unresolved.push(factionId + ' / ' + u.name + ': Punkte-Schwelle bezieht sich auf "' + (t.name || sel.childId) + '" (als Modellzahl interpretiert)'); } }
      thresholds.set(thr, Number(m.value));
    }
    if (basePts != null) {
      // Staffeln [ab Modellzahl, Punkte]; ausgegeben wird die Obergrenze je Staffel (wie New Recruit: 10 → 85, 20 → 170)
      const brackets = [[u.modelsRange[0], basePts]];
      for (const [models, pts] of [...thresholds].sort((a, b) => a[0] - b[0])) { if (models > u.modelsRange[0]) brackets.push([models, pts]); else brackets[0][1] = pts; }
      if (brackets.at(-1)[0] > u.modelsRange[1]) u.modelsRange[1] = brackets.at(-1)[0];
      u.points = brackets.map(([from, pts], i) => ({ models: i + 1 < brackets.length ? Math.max(from, brackets[i + 1][0] - 1) : Math.max(from, u.modelsRange[1]), pts }));
    } else unresolved.push(factionId + ' / ' + u.name + ': keine Punktkosten');
    u.options = [...new Set(u.options)].slice(0, 40);
    return { unit: u, factionRules };
  }

  // ───────── Armee-/Detachment-Regeln & Enhancements ─────────
  // Detachments: Upgrade-Einträge unter dem Konfigurations-Eintrag "Detachment" (Kosten "Detachment Points").
  // Enhancements: Einträge mit Kosten "Enhancements"; die Zuordnung zum Detachment steckt in den hidden-Modifikatoren
  // (am Eintrag oder an übergeordneten Gruppen), deren Bedingungen die Detachment-ID referenzieren.
  // Sichtbarkeit je Fraktion: kleiner Bedingungs-Auswerter (primary-catalogue; Crusade-/Boarding-Force = nicht gewählt;
  // gewähltes Detachment). Unbekannte Bedingungen gelten als "unbestimmt" (blenden nichts aus).
  const DP_ID = '82ae-1066-5107-6ae0';
  const ENH_ID = 'f759-1bc4-cb3a-f0d2';
  const NOT_SELECTED_FORCES = new Set(['cac3-71d1-ea4b-795d', 'ff7b-8f73-1756-650a', '1d6e-2579-8e7f-1ed4']); // Crusade Force/Army, Boarding Actions
  // BSData verlinkt "Templar Vows" auch an allgemeine Space-Marines-Einheiten (Katalog-Infolink); Armeeregel nur der Black Templars
  const ARMY_RULE_ONLY = { 'TEMPLAR VOWS': ['black-templars'] };
  // Supplement-Kataloge ohne eigene App-Fraktion: deren Detachments werden der Basisfraktion zugeschlagen (Feld "supplement")
  const SUPPLEMENTS = { 'space-marines': ['Imperium - Imperial Fists.json', 'Imperium - Iron Hands.json', 'Imperium - Raven Guard.json', 'Imperium - Salamanders.json', 'Imperium - Ultramarines.json', 'Imperium - White Scars.json'] };
  const ALL_DET = new Set();  // alle Detachment-IDs + -Namen aller Kataloge (Enhancements fremder Fraktionen erkennen)
  const costOf = (o, typeId) => { const c = (o.costs || []).find(c => c.typeId === typeId); return c ? Number(c.value) : null; };
  const cmp = (n, type, v) => ({ atLeast: n >= v, greaterThan: n > v, lessThan: n < v, atMost: n <= v, equalTo: n === v, notEqualTo: n !== v })[type];
  const and3 = xs => xs.some(x => x === false) ? false : (xs.every(x => x === true) ? true : null);
  const or3 = xs => xs.some(x => x === true) ? true : (xs.every(x => x === false) ? false : null);
  // ctx: { cat (primärer Katalog), det (gewähltes Detachment-Element oder null), detIds (Set der Detachment-IDs) }
  function evalCond(c, ctx) {
    const v = Number(c.value);
    if (c.scope === 'primary-catalogue' && /instanceOf/i.test(c.type)) {
      const t = cats.get(c.childId);
      const hit = c.childId === ctx.cat.id || c.childId === ctx.cat.name || (!!t && t.name === ctx.cat.name);
      return c.type === 'instanceOf' ? hit : (c.type === 'notInstanceOf' ? !hit : null);
    }
    if (NOT_SELECTED_FORCES.has(c.childId)) {
      if (c.type === 'instanceOf') return false;
      if (c.type === 'notInstanceOf') return true;
      const r = cmp(0, c.type, v); return r === undefined ? null : r;
    }
    if (ctx.detIds && ctx.detIds.has(c.childId) && c.field === 'selections' && ['force', 'roster', 'primary-catalogue'].includes(c.scope)) {
      const r = cmp(ctx.det && ctx.det.id === c.childId ? 1 : 0, c.type, v); return r === undefined ? null : r;
    }
    return null;
  }
  function evalGroup(g, ctx) {
    const xs = [...(g.conditions || []).map(c => evalCond(c, ctx)), ...(g.conditionGroups || []).map(h => evalGroup(h, ctx))];
    return g.type === 'or' ? or3(xs) : and3(xs);
  }
  const modApplies = (m, ctx) => and3([...(m.conditions || []).map(c => evalCond(c, ctx)), ...(m.conditionGroups || []).map(g => evalGroup(g, ctx))]);
  const allMods = o => [...(o.modifiers || []), ...(o.modifierGroups || []).filter(g => !g.conditions && !g.conditionGroups).flatMap(g => g.modifiers || [])];
  function isHidden(o, ctx) {
    if (!o) return false;
    // standardmäßig versteckt, aber per Modifikator für bestimmte Träger eingeblendet (z. B. nur für ANCIENT) → zählt als verfügbar
    if (o.hidden === true) return !allMods(o).some(m => m.field === 'hidden' && m.type === 'set' && (m.value === false || m.value === 'false') && modApplies(m, ctx) !== false);
    return allMods(o).some(m => m.field === 'hidden' && m.type === 'set' && (m.value === true || m.value === 'true') && modApplies(m, ctx) === true);
  }
  // in hidden-Modifikatoren referenzierte IDs/Namen
  function condRefs(o) {
    const out = [];
    for (const m of allMods(o)) if (m.field === 'hidden') JSON.stringify(m).replace(/"child(?:Id|Name)":"([^"]+)"/g, (_, id) => { out.push(id); return ''; });
    return out;
  }
  // Katalog, in dem ein Element definiert ist
  function catOf(o) { let x = o; while (x && !cats.has(x.id)) x = parentOf.get(x); return x || null; }
  // Element + übergeordnete Elemente bis zur Katalogwurzel
  function chain(o) { const out = []; for (let x = o; x && !cats.has(x.id); x = parentOf.get(x)) out.push(x); return out; }
  // alle verlinkten Kataloge (auch ohne importRootEntries, z. B. Libraries)
  function reachableCats(cat, seen = new Set()) {
    if (!cat || seen.has(cat.id)) return seen; seen.add(cat.id);
    for (const cl of cat.catalogueLinks || []) reachableCats(cats.get(cl.targetId), seen);
    return seen;
  }
  const textOfProfile = p => /Abilities$/.test(p.typeName || '') ? S(char(p, 'Description') || char(p, 'Descriptions')) : (p.characteristics || []).map(c => S(c.$text)).filter(Boolean).join('\n');
  // Regeltexte eines Eintrags (rules, Profile, infoLinks auf Regeln/Profile/InfoGroups, infoGroups) – nur sichtbare
  function rulesOf(node, ctx, where) {
    const out = [], seen = new Set();
    // core: Verweis auf eine Kern-/Waffenregel des Game Systems (z. B. Stealth, Lethal Hits), die die Regel verleiht
    const add = (name, text, core) => { name = cleanName(name); text = S(text); if (!name && !text) return; const k = name + '|' + text.replace(/[\^*]/g, '').replace(/\s+/g, ' '); if (seen.has(k)) return; seen.add(k); out.push(core ? { name, text, core: true } : { name, text }); };
    const fromGroup = g => {
      for (const r of g.rules || []) if (!isHidden(r, ctx)) add(r.name, r.description);
      for (const p of g.profiles || []) if (!isHidden(p, ctx)) add(p.name, textOfProfile(p));
    };
    fromGroup(node);
    for (const l of node.infoLinks || []) {
      if (isHidden(l, ctx)) continue;
      const t = resolve(l);
      if (!t) { unresolved.push(where + ': infoLink "' + (l.name || l.targetId) + '" in "' + node.name + '" nicht auflösbar'); continue; }
      const core = catOf(t) === gst;
      if (l.type === 'rule') add(linkName(l, t), t.description, core);
      else if (l.type === 'profile') add(linkName(l, t), textOfProfile(t), core);
      else if (l.type === 'infoGroup') fromGroup(t);
    }
    for (const g of node.infoGroups || []) if (!isHidden(g, ctx)) fromGroup(g);
    return out;
  }
  // Detachment Points: am Eintrag oder am Link; set-Modifikatoren (z. B. andere Kosten je Chapter) auswerten
  const DET_LINK = new WeakMap();  // Detachment-Element → entryLink, über den es gefunden wurde
  function dpOf(d, ctx) {
    const link = DET_LINK.get(d);
    let dp = costOf(d, DP_ID); if (dp == null && link) dp = costOf(link, DP_ID);
    for (const m of [...allMods(d), ...(link ? allMods(link) : [])]) if (m.field === DP_ID && m.type === 'set' && modApplies(m, ctx) === true) dp = Number(m.value);
    return dp;
  }
  // Wurzel-Einträge (alle Typen) inkl. importRootEntries-Kataloge
  function configRoots(cat, seen = new Set(), out = []) {
    if (!cat || seen.has(cat.id)) return out; seen.add(cat.id);
    for (const e of cat.selectionEntries || []) out.push({ node: e, via: null });
    for (const l of cat.entryLinks || []) { const t = resolve(l); if (t) out.push({ node: t, via: l }); }
    for (const cl of cat.catalogueLinks || []) if (cl.importRootEntries) configRoots(cats.get(cl.targetId), seen, out);
    return out;
  }
  function findDetachments(cat, ctx, dangling = []) {
    const dets = [], seenD = new Set();
    // Detachment = Upgrade mit Kosten "Detachment Points" (am Eintrag oder Link) oder Upgrade direkt in einer Gruppe "Detachment(s)"
    function visit(node, depth, seen, parentName, link) {
      if (!node || depth > 8 || seen.has(node)) return; seen.add(node);
      if (depth > 0 && node.type && node.type !== 'upgrade') return;
      if (depth > 0 && node.type === 'upgrade' && (costOf(node, DP_ID) != null || (link && costOf(link, DP_ID) != null) || /^Detachments?$/i.test(S(parentName)))) {
        if (!seenD.has(node.id)) { seenD.add(node.id); dets.push(node); if (link) DET_LINK.set(node, link); }
        return;
      }
      for (const g of node.selectionEntryGroups || []) if (!isHidden(g, ctx)) visit(g, depth + 1, seen, g.name);
      for (const e of node.selectionEntries || []) if (!isHidden(e, ctx)) visit(e, depth + 1, seen, node.name);
      for (const l of node.entryLinks || []) {
        if (isHidden(l, ctx)) continue;
        const t = resolve(l);
        if (!t) { if (!dangling.includes(cleanName(l.name))) dangling.push(cleanName(l.name)); continue; }
        if (!isHidden(t, ctx)) visit(t, depth + 1, seen, node.name, l);
      }
    }
    const isConfig = o => !!o && (o.categoryLinks || []).some(c => /^Configuration$/i.test(S(c.name)));
    for (const { node, via } of configRoots(cat)) {
      if (!/^Detachments?$/i.test(S((via && via.name) || node.name))) continue;
      if (!isConfig(node) && !isConfig(via)) continue;
      if (isHidden(via, ctx) || isHidden(node, ctx)) continue;
      visit(node, 0, new Set(), null, null);
    }
    return dets;
  }
  // Anzeigename einer Regel in Original-Schreibweise (aus der Regel-Definition)
  function displayName(K, cat) {
    for (const cid of reachableCats(cat)) {
      const c = cats.get(cid);
      for (const r of [...(c.sharedRules || []), ...(c.rules || [])]) if (up(r.name) === K) return cleanName(r.name);
    }
    if (gst) for (const r of gst.sharedRules || []) if (up(r.name) === K) return cleanName(r.name);
    return K;
  }
  for (const o of idx.values()) {
    if (!o || typeof o !== 'object') continue;
    if (o.type === 'upgrade' && (o.costs || []).some(c => c.typeId === DP_ID)) { ALL_DET.add(o.id); ALL_DET.add(S(o.name)); }
    if (/^Detachments?$/i.test(S(o.name)) && !o.type) for (const e of [...(o.selectionEntries || []), ...(o.entryLinks || [])]) { ALL_DET.add(e.targetId || e.id); ALL_DET.add(S(e.name)); }
  }
  function buildArmyData(fid, cat, kws, ruleUse, unitCount, factionRules, extraCats = []) {
    const ctx0 = { cat, det: null, detIds: null };
    // Armeeregeln: Fraktionsregeln der Einheiten + Regeln/Regel-Infolinks auf Ebene des eigenen Katalogs.
    // Behalten: Text "If your Army Faction is <Hauptfraktion>" bzw. ohne diese Klausel bei ≥ 40 % der Einheiten (oder Katalogebene).
    const norm = s => up(S(s).replace(/[\^*]/g, '')).replace(/[’`]/g, "'").trim();
    const primary = norm(kws[0]);
    const cand = new Map();
    for (const [k, n] of ruleUse) cand.set(k, { key: k, text: factionRules[k] || '', n });
    for (const r of cat.rules || []) if (!isHidden(r, ctx0)) cand.set(up(r.name), { key: up(r.name), text: S(r.description), n: Infinity, display: cleanName(r.name) });
    for (const l of cat.infoLinks || []) {
      if (l.type !== 'rule' || isHidden(l, ctx0)) continue;
      const t = resolve(l); if (!t) continue;
      const nm = linkName(l, t); const k = up(nm);
      cand.set(k, { key: k, text: S(t.description), n: Math.max(Infinity, cand.get(k)?.n || 0), display: cleanName(nm) });
    }
    const armyRules = [];
    for (const c of [...cand.values()].sort((a, b) => b.n - a.n)) {
      if (ARMY_RULE_ONLY[c.key] && !ARMY_RULE_ONLY[c.key].includes(fid)) continue;
      const m = /Army Faction is\s+([^,.]+)/i.exec(c.text);
      const keep = m ? norm(m[1]) === primary : c.n >= Math.max(1, unitCount * 0.4);
      if (keep) armyRules.push({ name: c.display || displayName(c.key, cat), text: c.text });
    }
    // Detachments + Regeln (Hauptkatalog, danach Supplement-Kataloge, z. B. Space-Marines-Chapter ohne eigene Fraktion)
    const recs = [], seenDet = new Set(), dangling = [];
    for (const c of [cat, ...extraCats]) {
      for (const d of findDetachments(c, { cat: c, det: null, detIds: null }, dangling)) {
        if (seenDet.has(d.id)) continue; seenDet.add(d.id);
        recs.push({ obj: d, cat: c });
      }
    }
    const detIds = new Set(recs.map(r => r.obj.id));
    const nkey = s => S(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const detByName = new Map(recs.map(r => [nkey(r.obj.name), r.obj]));
    const detachments = recs.map(({ obj: d, cat: c }) => {
      const ctx = { cat: c, det: d, detIds };
      const rec = { name: cleanName(d.name), dp: dpOf(d, ctx), catalogue: catOf(d)?.name || null };
      if (c !== cat) rec.supplement = c.name;
      return Object.assign(rec, { rules: rulesOf(d, ctx, fid), enhancements: [], __obj: d, __cat: c });
    });
    // Enhancements: Einträge mit Kosten "Enhancements" in allen erreichbaren Katalogen.
    // Zuordnung über hidden-Bedingungen (ID/childName des Detachments) an Eintrag/Gruppen,
    // sonst über den Gruppennamen "<Detachment> Enhancements".
    const enhSeen = new Set(), unlinked = new Set();
    const reach = new Set(); for (const c of [cat, ...extraCats]) for (const id of reachableCats(c)) reach.add(id);
    for (const cid of reach) {
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (o.type === 'upgrade' && typeof o.id === 'string' && (costOf(o, ENH_ID) || 0) > 0) {
          if (enhSeen.has(o.id)) return; enhSeen.add(o.id);
          const ch = chain(o);
          const refs = new Set();
          for (const x of ch) for (const r of condRefs(x)) { if (detIds.has(r)) refs.add(r); else if (detByName.has(nkey(r))) refs.add(detByName.get(nkey(r)).id); }
          if (!refs.size && !ch.some(x => condRefs(x).some(r => ALL_DET.has(r)))) {
            for (const x of ch.slice(1)) { const m = /^(.+?)\s+Enhancements?$/i.exec(S(x.name)); const d = m && detByName.get(nkey(m[1])); if (d) { refs.add(d.id); break; } }
          }
          if (!refs.size) {
            // fremde Detachments (per Bedingung oder Gruppenname "<Detachment> Enhancements") still überspringen
            const grp = ch.slice(1).map(x => /^(.+?)\s+Enhancements?$/i.exec(S(x.name))?.[1]).find(Boolean);
            if (ch.some(x => isHidden(x, ctx0)) || ch.some(x => condRefs(x).some(r => ALL_DET.has(r))) || (grp && ALL_DET.has(grp))) return;
            unlinked.add(cleanName(o.name) + (grp && dangling.includes(grp) ? ' (→ unresolvable detachment link "' + grp + '")' : ''));
            return;
          }
          const name = cleanName(o.name);
          for (const d of detachments) {
            if (!refs.has(d.__obj.id)) continue;
            const ctx = { cat: d.__cat, det: d.__obj, detIds };
            if (ch.some(x => isHidden(x, ctx))) continue;
            if (d.enhancements.some(e => e.name === name)) continue;
            const rs = rulesOf(o, ctx, fid);
            const text = rs.filter(r => !r.core).map(r => (r.name && r.name !== name ? '**' + r.name + ':** ' : '') + r.text).join('\n\n');
            const core = rs.filter(r => r.core).map(r => up(r.name));
            d.enhancements.push(core.length ? { name, cost: costOf(o, PTS_ID), text, core } : { name, cost: costOf(o, PTS_ID), text });
          }
          return;
        }
        for (const k of Object.keys(o)) if (k !== '__file') walk(o[k]);
      })(cats.get(cid));
    }
    for (const d of detachments) { delete d.__obj; delete d.__cat; }
    for (const n of dangling) unresolved.push(fid + ': Detachment-Link "' + n + '" verweist auf nicht vorhandenen Eintrag');
    return { armyRules, detachments, unlinkedEnhancements: [...unlinked], danglingDetachments: dangling };
  }

  // ───────── Keywords via the builder engine ─────────
  // The unit alone (no choices made): only what holds for every list of this faction – keywords a choice adds
  // (Character Upgrade, an allegiance …) come with the army from the builder.
  let SYS = null;
  try { SYS = new BSystem(files.map(f => { const j = byName.get(f); return typeof j === 'string' ? JSON.parse(j) : j; }).filter(Boolean)); }
  catch (e) { warn('Keywords: engine not available (' + e.message + ') – raw category links used'); }
  const engineKeywords = (catId, e) => {
    if (!SYS) return null;
    try {
      const n = SYS.rootNodes(catId).find(x => x.id === e.id);
      if (!n) return null;
      const V = bsView(SYS, { id: 'kw', catalogueId: catId, limit: 0, sel: [{ id: 'kw1', t: n.token, n: 1, ch: [] }] });
      const w = V.force.ch[0];
      return w ? [...categoriesOfSel(V, w)].filter(id => !helperCat(id)).map(id => SYS.categoryNames.get(id)).filter(Boolean) : null;
    } catch { return null; }
  };

  // ───────── Fraktionen ─────────
  const files_ = {};
  const index = { source: 'BSData/wh40k-11e', version, factions: [] };
  let total = 0, totalBytes = 0;
  const armyReport = [];
  for (const [fid, file, kws] of MAP) {
    const cat = byFile.get(file);
    if (!cat) { warn('FEHLT: ' + file + ' für ' + fid); unresolved.push(fid + ': Katalogdatei ' + file + ' fehlt'); continue; }
    const accept = new Set(kws.map(up));
    // every unit the builder offers for this faction: the faction's catalogues (main + supplements such as Ultramarines);
    // entries imported from other catalogues (allies) only with an accepted faction keyword
    const own = ownCats(fid);
    const units = []; const seenIds = new Set(); const factionRules = {}; const ruleUse = new Map();
    for (const oc of own) for (const e of rootEntries(oc)) {
      if (e.type !== 'unit' && e.type !== 'model') continue;
      // hidden by default: only when a modifier can show it (e.g. "HIDDEN UNTIL LEGENDS" Marneus Calgar with Honour Guard) –
      // converted as Legends then; never shown (old Tactical Squad …) → not offered, no (empty) datasheet
      if (e.hidden === true && !allMods(e).some(m => m.field === 'hidden' && (m.value === false || m.value === 'false'))) continue;
      if (e.__imported) {
        // imported: an accepted faction keyword; without any (BSData gap, e.g. Drop Pod, Knight Magaera) when it comes
        // from a faction catalogue (Space Marines → chapters) or the faction's own library ("Chaos - Chaos Knights Library")
        const fk = factionKws(e), src = e.__imported;
        if (fk.length ? !fk.some(k => accept.has(k)) : !(fidOfFile.has(src.__file) || S(src.name).startsWith(S(cat.name)))) continue;
      }
      if (seenIds.has(e.id)) continue; seenIds.add(e.id);
      const { unit, factionRules: fr } = convertUnit(e, fid, accept, engineKeywords(oc.id, e));
      if (unit.legends && !KEEP_LEGENDS) continue;
      if (oc !== cat) unit.catalogue = S(oc.name);
      Object.assign(factionRules, fr);
      for (const k of unit.abilities.faction) ruleUse.set(k, (ruleUse.get(k) || 0) + 1);
      units.push(unit);
    }
    // doppelte IDs eindeutig machen (Legends-Einheiten zuletzt, damit reguläre Einheiten ihre ID behalten)
    const ids = new Map();
    for (const un of [...units.filter(x => !x.legends), ...units.filter(x => x.legends)]) { const n = (ids.get(un.id) || 0) + 1; ids.set(un.id, n); if (n > 1) un.id = un.id + '-' + n; }
    units.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.legends ? 1 : 0) - (b.legends ? 1 : 0));
    const name = FACTIONS.find(f => f.id === fid)?.name || fid;
    const army = buildArmyData(fid, cat, kws, ruleUse, units.length, factionRules, (SUPPLEMENTS[fid] || []).map(f => byFile.get(f)).filter(Boolean));
    armyReport.push({ fid, name, ...army });
    // Abilities gated on a selection that is not a detachment but an ENHANCEMENT (e.g. Aeldari "Runes of Warding" →
    // Feel No Pain 4+ for the led unit): move the tag to `enhancement` so the app shows them when the bearer is there.
    {
      const nk = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
      const dets = new Set(army.detachments.map(d => nk(d.name)));
      const enhs = new Set(army.detachments.flatMap(d => (d.enhancements || []).map(e => nk(e.name))));
      for (const u of units) for (const a of [].concat(u.abilities?.unit || [], u.abilities?.wargear || [])) {
        if (!a.detachment) continue;
        const tags = [].concat(a.detachment);
        const asDet = tags.filter(t => dets.has(nk(t)) || !enhs.has(nk(t)));
        const asEnh = tags.filter(t => !dets.has(nk(t)) && enhs.has(nk(t)));
        if (!asEnh.length) continue;
        if (asDet.length) a.detachment = asDet.length === 1 ? asDet[0] : asDet; else delete a.detachment;
        a.enhancement = asEnh.length === 1 ? asEnh[0] : asEnh;
      }
    }
    const out = { faction: fid, name, source: 'BSData/wh40k-11e', version, catalogue: cat.name, factionRules, armyRules: army.armyRules, detachments: army.detachments, units };
    const json = JSON.stringify(out);
    files_[fid + '.json'] = out;
    totalBytes += json.length; total += units.length;
    index.factions.push({ id: fid, name, units: units.length, file: fid + '.json' });
    log(fid.padEnd(22) + String(units.length).padStart(4) + ' Einheiten ' + String(army.detachments.length).padStart(3) + ' Det. ' + String(army.detachments.reduce((n, d) => n + d.enhancements.length, 0)).padStart(3) + ' Enh.  ' + (json.length / 1024).toFixed(0).padStart(5) + ' KB  ← ' + file);
  }
  files_['index.json'] = index;

  // ───────── Bericht: BSData-Armeeregeln/Detachments/Enhancements vs. App-Daten (data/factions) ─────────
  let reportMd, reportTotals;
  {
    const nk = s => S(s).replace(/\s*\([^)]*\)\s*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const L = ['# BSData rules coverage', '', 'Generated by `tools/bsdata-convert.mjs` from BSData/wh40k-11e commit `' + version + '`.', '',
      'Counts = what BSData provides per faction (army rules, detachments selectable in that catalogue incl. allied/linked ones, detachment rules without core-rule references, enhancements linked to a detachment).',
      'Name comparison against `data/factions/<faction>.js` (normalized: case, diacritics, punctuation).', '',
      'Boarding Actions detachments of the app are excluded from the comparison (listed per faction).', '', '"Det.-gated abilities" = distinct unit abilities/weapons/rules that BSData only shows with a specific detachment; they are emitted with a `detachment` tag (name or array of names).', '', '| Faction | Army rules | Detachments | Det. rules | Enhancements | Det. w/o rules | Det. w/o enh. | Det.-gated abilities | Missing in BSData | Only in BSData |', '|---|---|---|---|---|---|---|---|---|---|'];
    const details = [];
    const tot = { a: 0, d: 0, r: 0, e: 0 };
    for (const r of armyReport) {
      const app = FACTIONS.find(f => f.id === r.fid) || FACTIONS.find(f => nk(f.name) === nk(r.name));
      const allApp = (app?.detachments || []);
      const boarding = allApp.filter(d => /\(Boarding Actions\)\s*$/i.test(d.name));
      const appDets = allApp.filter(d => !boarding.includes(d));
      const bsKeys = new Set(r.detachments.map(d => nk(d.name)));
      const appKeys = new Set(appDets.map(d => nk(d.name)));
      const missing = appDets.filter(d => !bsKeys.has(nk(d.name))).map(d => d.name);
      const extra = r.detachments.filter(d => !appKeys.has(nk(d.name))).map(d => d.name);
      const nR = r.detachments.reduce((n, d) => n + d.rules.filter(x => !x.core).length, 0), nE = r.detachments.reduce((n, d) => n + d.enhancements.length, 0);
      const noRules = r.detachments.filter(d => !d.rules.some(x => !x.core)).map(d => d.name), noEnh = r.detachments.filter(d => !d.enhancements.length).map(d => d.name);
      tot.a += r.armyRules.length; tot.d += r.detachments.length; tot.r += nR; tot.e += nE;
      const gst2 = unitGateStats.get(r.fid); const nTag = gst2 ? gst2.tagged.size : 0; tot.t = (tot.t || 0) + nTag;
      L.push('| ' + r.fid + ' | ' + r.armyRules.length + ' | ' + r.detachments.length + ' | ' + nR + ' | ' + nE + ' | ' + noRules.length + ' | ' + noEnh.length + ' | ' + nTag + ' | ' + missing.length + ' | ' + extra.length + ' |');
      // App-Enhancements (falls vorhanden) ohne BSData-Treffer
      const bsEnh = new Set(r.detachments.flatMap(d => d.enhancements.map(e => nk(e.name))));
      const appEnh = [...(app?.enhancements || []), ...appDets.flatMap(d => d.enhancements || [])].map(e => (typeof e === 'string' ? e : e.name)).filter(Boolean);
      const enhMiss = appEnh.filter(n => !bsEnh.has(nk(n)));
      const lines = [];
      if (r.armyRules.length) lines.push('- Army rules: ' + r.armyRules.map(a => a.name).join(', '));
      if (missing.length) lines.push('- In app, not in BSData: ' + missing.join(', '));
      if (boarding.length) lines.push('- App Boarding Actions detachments (not part of the BSData matched-play detachment list): ' + boarding.map(d => d.name.replace(/\s*\(Boarding Actions\)\s*$/i, '')).join(', '));
      const sup = r.detachments.filter(d => d.supplement).map(d => d.name + ' [' + d.supplement.replace(/^.* - /, '') + ']');
      if (sup.length) lines.push('- Supplement detachments: ' + sup.join(', '));
      if (extra.length) lines.push('- In BSData, not in app: ' + extra.join(', '));
      if (noRules.length) lines.push('- Detachments without rule text: ' + noRules.join(', '));
      if (noEnh.length) lines.push('- Detachments without enhancements: ' + noEnh.join(', '));
      if (r.danglingDetachments.length) lines.push('- BSData detachment links whose target entry is missing in the data (cannot be resolved): ' + r.danglingDetachments.join(', '));
      const gs = unitGateStats.get(r.fid);
      if (gs && gs.tagged.size) lines.push('- Detachment-gated unit abilities/weapons (tagged `detachment`): ' + [...gs.tagged].map(([n, ds]) => n + ' [' + [...ds].join(', ') + ']').join(', '));
      if (gs && gs.other.size) lines.push('- Unit abilities hidden by other (non-detachment) conditions, emitted unchanged: ' + [...gs.other].sort().join(', '));
      if (r.unlinkedEnhancements.length) lines.push('- BSData enhancements not linked to any detachment (skipped): ' + r.unlinkedEnhancements.join(', '));
      if (appEnh.length) lines.push('- App enhancements: ' + appEnh.length + (enhMiss.length ? ', without BSData match: ' + enhMiss.join(', ') : ', all matched'));
      details.push('### ' + r.fid + ' (' + r.name + ')', '', ...(lines.length ? lines : ['- complete match']), '');
    }
    L.push('| **Total** | ' + tot.a + ' | ' + tot.d + ' | ' + tot.r + ' | ' + tot.e + ' | | | ' + (tot.t || 0) + ' | | |', '');
    const appEnhTotal = FACTIONS.reduce((n, f) => n + (f.enhancements || []).length + (f.detachments || []).reduce((m, d) => m + (d.enhancements || []).length, 0), 0);
    if (!appEnhTotal) L.push('App data (`data/factions`) currently contains no enhancements, so there is nothing to compare on that side.', '');
    L.push('## Details', '', ...details);
    reportMd = L.join('\n') + '\n';
    reportTotals = { armyRules: tot.a, detachments: tot.d, detachmentRules: tot.r, enhancements: tot.e, gatedAbilities: tot.t || 0 };
  }

  // ───────── Kernfähigkeiten / Waffenfähigkeiten aus dem Game System ─────────
  const core = {};
  for (const r of gst.sharedRules || []) { const k = up(r.name); if (!core[k]) core[k] = S(r.description); }
  for (const p of gst.sharedProfiles || []) if (p.typeName === 'Abilities') { const k = up(p.name); if (!core[k]) core[k] = char(p, 'Description'); }
  files_['core-abilities.json'] = core;
  // Catalogue index for the army builder (js/builder): which repo file holds which catalogue and what it links
  files_['bs-catalogues.json'] = [...byFile.entries()].map(([file, r]) => ({ id: r.id, file, name: S(r.name), gameSystem: r === gst, library: !!r.library,
    links: (r.catalogueLinks || []).map(l => ({ id: l.targetId, root: !!l.importRootEntries })) }));
  return { files: files_, report: reportMd, unresolved, stats: { units: total, bytes: totalBytes, coreRules: Object.keys(core).length, ...reportTotals } };
}
