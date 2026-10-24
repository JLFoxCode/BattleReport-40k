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
import { CORE as CORE_RULES } from '../../data/core.js';
import { BSystem, view as bsView, categoriesOfSel, addSel, autoSync, setCount, chooseInGroup, limits, selsOf, totalCost } from '../builder/bs-engine.js';


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
  // + the allied Titans (Library - Titans, imported by many armies; found through the ally packs chaos-knights / imperial-knights)
  ['chaos-knights', 'Chaos - Chaos Knights.json', ['Chaos Knights', 'Titanicus Traitoris']],
  ['chaos-space-marines', 'Chaos - Chaos Space Marines.json', ['Heretic Astartes']],
  ['dark-angels', 'Imperium - Dark Angels.json', ['Adeptus Astartes', 'Dark Angels']],
  ['death-guard', 'Chaos - Death Guard.json', ['Death Guard', 'Plague Legions']],
  ['deathwatch', 'Imperium - Deathwatch.json', ['Adeptus Astartes', 'Deathwatch']],
  ['drukhari', 'Aeldari - Drukhari.json', ['Drukhari', 'Harlequins']],
  ['emperors-children', "Chaos - Emperor's Children.json", ["Emperor's Children", 'Legions of Excess']],
  ['genestealer-cults', 'Genestealer Cults.json', ['Genestealer Cults', 'Tyranids']],
  ['grey-knights', 'Imperium - Grey Knights.json', ['Grey Knights']],
  ['imperial-agents', 'Imperium - Agents of the Imperium.json', ['Agents of the Imperium']],
  ['imperial-knights', 'Imperium - Imperial Knights.json', ['Imperial Knights', 'Adeptus Titanicus']],
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
  const CAT_IDS = new Set(); for (const c of cats.values()) for (const ce of c.categoryEntries || []) CAT_IDS.add(ce.id);
  // unit-type keywords: a model type with another one than the unit's main models is a companion (Sir Hekhtur, INFANTRY,
  // with the Canis Rex knight, VEHICLE) – its keywords are listed per model (modelKeywords), not as the unit's
  const TYPE_KW = /^(INFANTRY|VEHICLE|MONSTER|MOUNTED|BEAST|SWARM)$/;
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
      // … and so do rules on it: the faction rule a catalogue gives the units it links (CSM 'Dark Pacts' on Chaos Lords
      // linked from a library, Chaos Daemons 'Disciples of Be'lakor', Agents 'Assigned Agents', World Eaters 'Blessings of Khorne')
      out.push({ ...t, name: l.name || t.name, categoryLinks: [...(t.categoryLinks || []), ...(l.categoryLinks || [])], ...((l.profiles || []).length ? { profiles: [...(t.profiles || []), ...l.profiles] } : {}),
        ...((l.infoLinks || []).length ? { infoLinks: [...(t.infoLinks || []), ...l.infoLinks] } : {}), ...((l.rules || []).length ? { rules: [...(t.rules || []), ...l.rules] } : {}), __link: l, ...(imported ? { __imported: cat } : {}) });
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
    // the faction a catalogue belongs to: a listed supplement (Imperial Fists → Space Marines), else the first faction
    // catalogue it links – allied packs (Agents, Knights, Daemons) only if nothing else (Imperial Fists also link the
    // Agents of the Imperium; their units belong to Space Marines, not to the Agents file)
    const ALLY_FIDS = new Set(['imperial-agents', 'imperial-knights', 'chaos-daemons', 'chaos-knights']);
    const factionOfCat = c => {
      for (const [sf, list] of Object.entries(SUPPLEMENTS)) if (list.includes(c.__file)) return sf;
      const find = allies => { const seen = new Set(); const walk = x => { if (!x || seen.has(x.id)) return null; seen.add(x.id); const f = fidOfFile.get(x.__file); if (f && (allies || !ALLY_FIDS.has(f))) return f; if (f) return null; for (const l of x.catalogueLinks || []) { const r = walk(cats.get(l.targetId)); if (r) return r; } return null; }; return walk(c); };
      return find(false) || find(true);
    };
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
  const RULE_CAT = new Map();   // faction rule (upper-case name) → catalogue that defines it
  function convertUnit(root, factionId, acceptedKw, catNames = null) {
    const u = {
      id: slug(root.name), name: cleanName(root.name), points: [], composition: '', models: [], profiles: [], keywords: [], factionKeywords: [],
      ranged: [], melee: [], abilities: { core: [], faction: [], unit: [], wargear: [], invul: null, damaged: null }, leader: null, support: null, transport: null, options: [], modelsRange: [1, 1]
    };
    const factionRules = {};
    const modelCats = [];  // category names of the unit's model entries
    const seenW = new Set(), seenP = new Set(), seenA = new Set(), seenCore = new Set();
    let curModel = null;   // name of the model entry being walked (depth > 0) – a faction rule linked there belongs to that model
    const facFrom = {};    // faction ability → Set of model entries that carry it, or null when the unit itself links it (every model)
    if (!unitGateStats.has(factionId)) unitGateStats.set(factionId, { tagged: new Map(), other: new Set() });
    const stats = unitGateStats.get(factionId);
    let inh = [];  // von übergeordneten (Wargear-)Einträgen geerbte Detachment-Abhängigkeit
    // ids (entries, links, categories) of the walked ancestors: "hidden unless ancestor instanceOf X" (Daemonic Allegiance
    // profiles only on a Daemon Prince) is evaluated against them; only plain condition lists of ancestor instanceOf checks
    let anc = new Set();
    let optWg = null;  // nearest optional (min 0) upgrade above: { name, hasAbility }
    let curWg = null;  // nearest upgrade above (optional or not): { name, hasAbility }
    let comp = null;   // name of the companion model being walked (see companions)
    let optHidden = false;   // inside an option that may be hidden for the unit on its own
    // default state of the unit on its own: entries inside it with their minimum count (everything else counts 0)
    const inUnit = new Map();
    const catAny = new Set((root.categoryLinks || []).map(c => c.targetId));   // categories anywhere in the unit (no Crusade …)
    const mTypes = [];   // model entries: { id, name, kws (keywords of the model entry), max }
    (function pre(n, d, gmax, on) {
      if (!n || d > 8) return;
      const live = x => on && x.hidden !== true && !SKIP_RE.test(S(x.name));   // on: not inside a hidden/Crusade subtree
      for (const g of n.selectionEntryGroups || []) { const c = selConstraints(g); pre(g, d + 1, c.max != null ? c.max : gmax, live(g)); }
      const model = (e, cls, c) => {
        for (const cl of cls) if (cl && cl.targetId) catAny.add(cl.targetId);
        if (e.type !== 'model' || mTypes.some(m => m.id === e.id)) return;
        const kws = cls.filter(cl => cl && cl.hidden !== true && cl.name && !helperCat(cl.targetId) && !/^Faction:/i.test(cl.name) && !/\bLoadout$|\bHeavy Weapon$|^Unit Champion$/i.test(S(cl.name))).map(cl => up(cleanName(cl.name)));
        mTypes.push({ id: e.id, name: cleanName(e.name), kws, max: c.max != null ? c.max : (gmax != null ? gmax : (c.min != null ? c.min : 1)) });
      };
      for (const e of n.selectionEntries || []) { if (!inUnit.has(e.id)) { inUnit.set(e.id, selConstraints(e).min || 0); if (live(e)) model(e, e.categoryLinks || [], selConstraints(e)); pre(e, d + 1, null, live(e)); } }
      for (const l of n.entryLinks || []) { const t = resolve(l); if (t && !inUnit.has(t.id)) { const c = selConstraints({ constraints: [...(t.constraints || []), ...(l.constraints || [])] }); const mn = c.min || 0; inUnit.set(t.id, mn); inUnit.set(l.id, mn); const lv = l.hidden !== true && live({ ...t, name: l.name || t.name }); if (lv) model({ ...t, name: l.name || t.name }, [...(t.categoryLinks || []), ...(l.categoryLinks || [])], c); pre(t, d + 1, null, lv); } }
    })(root, 0, null, true);
    // companion models (see TYPE_KW): main = the model named like the unit, else the most numerous model type(s)
    const companions = new Set();
    {
      const named = mTypes.filter(m => up(m.name) === up(cleanName(root.name)));
      const mx = Math.max(0, ...mTypes.map(m => m.max));
      const main = named.length ? named : mTypes.filter(m => m.max === mx);
      const mainTypes = new Set([...(root.categoryLinks || []).map(c => up(cleanName(c.name))), ...main.flatMap(m => m.kws)].filter(k => TYPE_KW.test(k)));
      if (mainTypes.size) for (const m of mTypes) if (!main.includes(m) && m.kws.some(k => TYPE_KW.test(k) && !mainTypes.has(k))) companions.add(m.id);
    }
    const dCond = c => {
      const v = Number(c.value);
      if (/instanceOf/i.test(c.type)) {
        if (NOT_SELECTED_FORCES.has(c.childId)) return c.type === 'notInstanceOf';
        if (c.scope === 'ancestor') { const hit = anc.has(c.childId); return c.type === 'instanceOf' ? hit : !hit; }
        return null;
      }
      if (NOT_SELECTED_FORCES.has(c.childId)) { const r = cmp(0, c.type, v); return r === undefined ? null : r; }
      // associations (led by / attached to …): the unit on its own is attached to nothing – Command Squads' FEEL NO PAIN
      // only with an Ogryn Bodyguard, Necron Warriors' only led by a Technomancer, Wyches' FIGHTS FIRST only with Lelith
      if (c.field === 'associations') { const r = cmp(0, c.type, v); return r === undefined ? null : r; }
      // a category that nothing in the unit carries (outside Crusade): none of it in the unit (Space Wolves 'Lone Wolf')
      if (c.field === 'selections' && CAT_IDS.has(c.childId) && !catAny.has(c.childId) && ['self', 'parent', 'unit', 'root-entry', 'model-or-unit'].includes(c.scope)) { const r = cmp(0, c.type, v); return r === undefined ? null : r; }
      if (c.field !== 'selections' || !c.childId || DET_NAME.has(c.childId)) return null;
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
      // wargear ability named other than its wargear (Daemon Prince: 'Seductive Gambit' only with the Slaanesh allegiance):
      // `wargear` names the option it comes with
      const wgTag = kind === 'wargear' && curWg && up(curWg.name) !== up(name) ? { wargear: curWg.name } : {};
      if (dets.length) { noteTag(name, dets); (kind === 'wargear' ? u.abilities.wargear : u.abilities.unit).push({ name, text, detachment: detTag(dets), ...wgTag }); return; }
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
        // "… even if a PRIMUS, MAGUS, or ACOLYTE ICONWARD model has already been attached to it": who may lead the
        // bodyguard as well (alsoWith: names/keywords, one per entry)
        const ev = /even if (?:an? |one )?([^.\n]+?)(?: (?:models?|units?))? (?:has|have) already been attached/i.exec(S(text).replace(/\*\*|\^\^|\*/g, '').replace(/[ \t ]+/g, ' '));
        if (ev) { const w = ev[1].split(/,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+/).map(x => cleanName(x)).filter(Boolean); if (w.length) u[att].alsoWith = [...new Set([...(u[att].alsoWith || []), ...w])]; }
        if (att === 'leader') return;
      }
      if ((m = /^Invulnerable Save\s*\((\d\+\*?)\)/i.exec(name))) { if (!u.abilities.invul) u.abilities.invul = m[1]; if (!text) return; }
      if (/^Damaged\b/i.test(name)) { u.abilities.damaged = text ? name + ': ' + text : name; return; }
      (kind === 'wargear' ? u.abilities.wargear : u.abilities.unit).push({ name, text, ...wgTag });
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
        if (!optWg.hasAbility) { const k = 'wargear|' + optWg.name + '|' + up(name); if (!seenA.has(k)) { seenA.add(k); u.abilities.wargear.push({ name: optWg.name + ': ' + cleanName(name), text: S(target.description), wargear: optWg.name, ...(gstRuleIds.has(target.id) ? { core: true } : {}) }); } }
        return;
      }
      // rule linked from (mandatory) wargear that has an ability text of its own: that text says when it applies (Collar of
      // Khorne: Feel No Pain 3+ only against Psychic Attacks, Alchemyk Counteragents: 6+ only against mortal wounds) – the
      // wargear ability is listed, the rule is no unconditional core ability of the unit
      if (curWg && curWg.hasAbility) return;
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
        // a companion model's rule (Sir Hekhtur's LONE OPERATIVE with Canis Rex) is marked like BSData marks model-only rules
        const k = up(name) + (comp ? ' (' + up(comp) + ' MODEL ONLY)' : ''); if (!seenCore.has(k)) { seenCore.add(k); u.abilities.core.push(k); }
      } else {
        const k = up(name);
        if (!u.abilities.faction.includes(k)) { u.abilities.faction.push(k); factionRules[k] = S(target.description); RULE_CAT.set(k, catOf(target)); }
        // which model entry carries it (Cabal of Sorcerers on the Aspiring Sorcerer only): linked by the unit itself → every model
        if (!(k in facFrom) || facFrom[k]) { if (curModel) (facFrom[k] = facFrom[k] || new Set()).add(curModel); else facFrom[k] = null; }
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
      // hidden by default: only walked when a detachment shows it (Pantheon of Woe's Necrodermal Bindings on the C'tan
      // Shards) – then tagged with that detachment
      if (!node || (node.hidden === true && depth > 0 && !gating(node, node.__linkObj).dets.length) || depth > 12) return;
      if (seen.has(node)) return; seen.add(node);
      const name = S(node.name);
      if (depth > 0 && SKIP_RE.test(name)) return;
      if (depth > 0 && (ancHidden(node) || (node.__linkObj && ancHidden(node.__linkObj)))) return;
      const isModel = node.type === 'model' || (depth === 0 && node.type === 'unit');
      const k = node.type === 'upgrade' ? 'wargear' : (node.type ? 'unit' : kind);
      const savedInh = inh, savedAnc = anc, savedOpt = optWg, savedPm = pmods, savedWg = curWg, savedComp = comp, savedOH = optHidden, savedCur = curModel;
      // groups above that may be hidden for the unit on its own (Crusade "Specialisms" …)
      if (depth > 0 && !node.type && (node.modifiers || []).some(m => m.field === 'hidden' && m.type === 'set' && (m.value === true || m.value === 'true') && dGroup({ type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups }) !== false)) optHidden = true;
      anc = new Set([...anc, ...ancIds(node)]);
      { const pm = [...profModsOf(node), ...profModsOf(node.__linkObj)]; if (pm.length) pmods = [...pmods, ...pm]; }
      if (depth > 0 && node.type === 'upgrade') {
        const hasAbility = (node.profiles || []).some(p => p.typeName === 'Abilities') || (node.infoLinks || []).some(l => l.type === 'profile' && (resolve(l) || {}).typeName === 'Abilities');
        curWg = { name: cleanName(name), hasAbility };
        if (!(selConstraints(node).min >= 1)) {
          // offered to the unit on its own? (not a Crusade specialism or a detachment upgrade such as Steel Hammer's Character Upgrade)
          const hidMay = o => (o && o.modifiers || []).some(m => m.field === 'hidden' && m.type === 'set' && (m.value === true || m.value === 'true') && dGroup({ type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups }) !== false);
          if (hidMay(node) || hidMay(node.__linkObj)) optHidden = true;
          optWg = curWg;
          // an option that adds keywords to the unit (Daemon Prince allegiance KHORNE …, CSM Mark of Chaos): which ones
          const add = (node.modifiers || []).filter(m => m.field === 'category' && m.type === 'add' && !m.conditions && !m.conditionGroups && ['root-entry', 'unit', 'parent', undefined].includes(m.scope) && !helperCat(m.value))
            .map(m => idx.get(m.value)).filter(c => c && c.name && !/^Faction:/i.test(c.name)).map(c => up(cleanName(c.name)));
          if (add.length && !optHidden) { u.keywordOptions = u.keywordOptions || []; if (!u.keywordOptions.some(o => o.option === curWg.name)) u.keywordOptions.push({ option: curWg.name, keywords: [...new Set(add)] }); }
        }
      }
      if (node.type === 'model' && companions.has(node.id)) comp = cleanName(name);
      if (node.type === 'model' && depth > 0) curModel = cleanName(name);
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
        modelCats.push({ id: node.id, name: cleanName(name), cats: [...(node.categoryLinks || []), ...((node.__linkObj && node.__linkObj.categoryLinks) || [])]
          .filter(cl => cl && cl.hidden !== true && cl.name && !helperCat(cl.targetId) && !/\bLoadout$|\bHeavy Weapon$|^Unit Champion$/i.test(S(cl.name))).map(cl => cl.name) });   // not BSData helper categories
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
      inh = savedInh; anc = savedAnc; optWg = savedOpt; pmods = savedPm; curWg = savedWg; comp = savedComp; optHidden = savedOH; curModel = savedCur;
    }
    walk(root, 'unit', 0, null, new Set());
    // faction abilities only some model entries carry (abilities.factionModels: "CABAL OF SORCERERS": ["Aspiring Sorcerer"]) –
    // the unit has the ability only while such a model is alive; linked by the unit itself or by every model → not listed
    {
      const names = new Set(u.models.map(m => m.name));
      const fm = {};
      for (const [k, s] of Object.entries(facFrom)) { if (!s) continue; const arr = [...s].filter(n => names.has(n)); if (arr.length && arr.length < names.size) fm[k] = arr; }
      if (Object.keys(fm).length) u.abilities.factionModels = fm;
    }
    // a SUPPORT unit whose attach text BSData still names 'Leader' (GSC Biophagus, Clamavus, Locus, Nexos): the core
    // ability decides – it attaches as a support unit
    if (u.leader && !u.support && u.abilities.core.some(c => /^SUPPORT\b/.test(c)) && !u.abilities.core.some(c => /^LEADER\b/.test(c))) {
      u.support = u.leader; u.leader = null;
      u.abilities.unit.push({ name: 'Support', text: u.support.text });
    }
    const wCanon = new Map(); for (const w of [...u.ranged, ...u.melee]) if (!wCanon.has(w.name.toLowerCase())) wCanon.set(w.name.toLowerCase(), w.name);
    const wName = n => (u.ranged.some(w => w.name === n) || u.melee.some(w => w.name === n) ? n : wCanon.get(String(n).toLowerCase()) || n);
    u.models = u.models.map(m => ({ name: m.name, min: m.min != null ? m.min : (m.max != null ? 0 : 1), max: m.max != null ? m.max : (m.min != null ? m.min : 1), weapons: [...new Set([...m.weapons].map(wName))] }));

    // Keywords – as the army builder's engine evaluates them for this catalogue (category modifiers included, e.g. an
    // INFANTRY correction or RAVENWING inside Dark Angels); without the engine the raw category links
    // Model-level keywords count for the unit (OFFICER of a Command Squad's commander, PSYKER of an Aspiring Sorcerer),
    // except those of a companion model (Sir Hekhtur's INFANTRY with Canis Rex); keywords that not every model type of the
    // unit has are also listed per model in u.modelKeywords (Wahapedia "SZAREKH MODEL: CHARACTER; THE SILENT KING").
    const kwOf = n => { n = cleanName(n); if (!n || /^(Configuration|Unit|Warlord|Legends)$/i.test(n) || /^Allies:/i.test(n)) return null; return n; };   // "Allies: …" marks what may be allied in, no keyword
    for (const c of [...(catNames ? catNames.map(name => ({ name })) : (root.categoryLinks || []).filter(cl => !helperCat(cl.targetId))), ...modelCats.flatMap(mc => mc.cats.filter(n => !companions.has(mc.id) || /^Faction:/i.test(n)).map(name => ({ name })))]) {
      const n = kwOf(c.name);
      if (!n) continue;
      const m = /^Faction:\s*(.+)$/i.exec(n);
      if (m) { const f = up(m[1]); if (!u.factionKeywords.includes(f)) u.factionKeywords.push(f); }
      else { const kw = up(n); if (!u.keywords.includes(kw)) u.keywords.push(kw); }
    }
    {
      const unitKw = new Set((catNames || (root.categoryLinks || []).filter(cl => !helperCat(cl.targetId)).map(c => c.name)).map(kwOf).filter(Boolean).map(up));
      const per = new Map();
      for (const mc of modelCats) { if (!per.has(mc.name)) per.set(mc.name, new Set()); for (const n of mc.cats) { const k = kwOf(n); if (k && !/^Faction:/i.test(k)) per.get(mc.name).add(up(k)); } }
      if (per.size > 1) {
        const sets = [...per.values()];
        const common = new Set([...sets[0]].filter(k => sets.every(s => s.has(k))));
        const mk = {};
        for (const [nm, s] of per) { const x = [...s].filter(k => !common.has(k) && !unitKw.has(k)); if (x.length) mk[nm] = x; }
        if (Object.keys(mk).length) u.modelKeywords = mk;
      }
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
  // weapon profile as one line (an enhancement that is a weapon: TL-4Ø9, Da Gobshot Thunderbuss, Imperium's Sword):
  // "Da Gobshot Thunderbuss – 24", A 6, BS 4+, S 7, AP -2, D 2 [LETHAL HITS: non-MONSTER/VEHICLE] [RAPID FIRE 6]"
  const isWeaponP = p => p.typeName === 'Ranged Weapons' || p.typeName === 'Melee Weapons' || p.typeName === "C'tan Powers";
  const weaponLine = p => {
    const w = parseWeapon(p.typeName === "C'tan Powers" ? { ...p, typeName: 'Ranged Weapons' } : p);
    return w.name + (w.profile ? ' (' + w.profile + ')' : '') + ' – ' + [w.range || 'Melee', 'A ' + w.A, w.BS != null ? 'BS ' + w.BS : 'WS ' + w.WS, 'S ' + w.S, 'AP ' + w.AP, 'D ' + w.D].join(', ') + w.abilities.map(a => ' [' + a + ']').join('');
  };
  const textOfProfile = p => /Abilities$/.test(p.typeName || '') ? S(char(p, 'Description') || char(p, 'Descriptions')) : isWeaponP(p) ? weaponLine(p) : (p.characteristics || []).map(c => S(c.$text)).filter(Boolean).join('\n');
  // Regeltexte eines Eintrags (rules, Profile, infoLinks auf Regeln/Profile/InfoGroups, infoGroups) – nur sichtbare
  function rulesOf(node, ctx, where) {
    const out = [], seen = new Set();
    // core: Verweis auf eine Kern-/Waffenregel des Game Systems (z. B. Stealth, Lethal Hits), die die Regel verleiht
    // weapon: the parsed weapon of a weapon profile (enhancement weapons for the bearer's datasheet); not part of `rules`
    const add = (name, text, core, weapon) => { name = cleanName(name); text = S(text); if (!name && !text) return; const k = name + '|' + text.replace(/[\^*]/g, '').replace(/\s+/g, ' '); if (seen.has(k)) return; seen.add(k); const r = core ? { name, text, core: true } : { name, text }; if (weapon) Object.defineProperty(r, 'weapon', { value: weapon, enumerable: false }); out.push(r); };
    const wOf = p => (isWeaponP(p) ? parseWeapon(p.typeName === "C'tan Powers" ? { ...p, typeName: 'Ranged Weapons' } : p) : null);
    const fromGroup = g => {
      for (const r of g.rules || []) if (!isHidden(r, ctx)) add(r.name, r.description);
      for (const p of g.profiles || []) if (!isHidden(p, ctx)) add(p.name, textOfProfile(p), false, wOf(p));
    };
    fromGroup(node);
    for (const l of node.infoLinks || []) {
      if (isHidden(l, ctx)) continue;
      const t = resolve(l);
      if (!t) { unresolved.push(where + ': infoLink "' + (l.name || l.targetId) + '" in "' + node.name + '" nicht auflösbar'); continue; }
      const core = catOf(t) === gst;
      if (l.type === 'rule') add(linkName(l, t), t.description, core);
      else if (l.type === 'profile') add(linkName(l, t), textOfProfile(t), core, wOf(t));
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
  // enhancement id → bodyguard units it lets its bearer lead: the leaders' "Leading" associations (New Recruit) allow a
  // unit when an and-group holds "unit instanceOf X" + "enhancement selected" (Ork Kill Kommanda → Kommandos)
  // category → detachments that give it to units (Death Guard "Contagion Engines" adds CONTAGION ENGINE): enhancements
  // offered only below such a category belong to that detachment
  const CAT_DET = new Map();
  for (const o of idx.values()) {
    const mods = [...((o && o.modifiers) || []), ...((o && o.modifierGroups) || []).flatMap(g => (g.modifiers || []).map(m => ({ ...m, conditions: [...(m.conditions || []), ...(g.conditions || [])], conditionGroups: [...(m.conditionGroups || []), ...(g.conditionGroups || [])] })))];
    for (const m of mods) {
      if (m.field !== 'category' || m.type !== 'add' || !CAT_IDS.has(m.value)) continue;
      const ids = []; JSON.stringify([m.conditions || [], m.conditionGroups || []]).replace(/"childId":"([^"]+)"/g, (_, id) => { if (DET_NAME.has(id)) ids.push(id); return ''; });
      for (const d of ids) { if (!CAT_DET.has(m.value)) CAT_DET.set(m.value, new Set()); CAT_DET.get(m.value).add(d); }
    }
  }
  const ENH_LEADS = new Map();
  for (const o of idx.values()) {
    for (const a of (o && o.associations) || []) {
      if (!/^Leading$/i.test(S(a.name))) continue;
      (function grp(g) {
        const cs = g.conditions || [];
        const enh = cs.filter(c => c.type === 'atLeast' && (costOf(idx.get(c.childId) || {}, ENH_ID) || 0) > 0).map(c => c.childId);
        const units = cs.filter(c => c.type === 'instanceOf' && c.childId).map(c => cleanName((idx.get(c.childId) || {}).name || c.childName)).filter(Boolean);
        if (g.type !== 'or' && enh.length && units.length) for (const e of enh) { if (!ENH_LEADS.has(e)) ENH_LEADS.set(e, new Set()); for (const n of units) ENH_LEADS.get(e).add(n); }
        for (const h of g.conditionGroups || []) grp(h);
      })({ type: 'or', conditionGroups: a.conditionGroups || [], conditions: [] });
    }
  }
  function buildArmyData(fid, cat, kws, ruleUse, unitsOfArmy, factionRules, extraCats = []) {
    const ctx0 = { cat, det: null, detIds: null };
    // Armeeregeln: Fraktionsregeln der Einheiten + Regeln/Regel-Infolinks auf Ebene des eigenen Katalogs.
    // Behalten: Text "If your Army Faction is <Hauptfraktion>" bzw. ohne diese Klausel bei ≥ 40 % der Einheiten (oder Katalogebene).
    const norm = s => up(S(s).replace(/[\^*]/g, '')).replace(/[’`]/g, "'").trim();
    const primary = norm(kws[0]);
    // Candidates: the faction rules the faction's own units link (ruleUse), the rules on the catalogue itself and on the
    // libraries it imports (Aeldari Library: "Corsairs and Travelling Players … If your Army Faction is DRUKHARI"), and
    // rules the datasheets refer to by name ("Lancer's Duty (Bondsman)" → Bondsman).
    // Kept: a text "If your Army Faction is (not) X" only for X = the faction; without it, a rule of the faction's units
    // unless another faction's catalogue defines it (Transhuman Strategist, Librarius, Curse of the Wulfen, Kill Team),
    // a catalogue rule of the faction's own catalogues.
    const ownSet = new Set([cat, ...extraCats, ...[...byFile.values()].filter(c => c.library && S(c.name).startsWith(S(cat.name)))]);
    const fidOfCatObj = c => (c ? fidOfFile.get(c.__file) || null : null);
    const cand = new Map();
    for (const [k, n] of ruleUse) cand.set(k, { key: k, text: factionRules[k] || '', n, src: RULE_CAT.get(k) || null });
    const reachC = new Set(); for (const c of ownSet) for (const id of reachableCats(c)) reachC.add(id);
    for (const cid of reachC) {
      const c = cats.get(cid); if (!c || c === gst) continue;
      for (const r of c.rules || []) if (!isHidden(r, ctx0) && (ownSet.has(c) || /Army Faction is/i.test(S(r.description)))) if (!cand.has(up(r.name))) cand.set(up(r.name), { key: up(r.name), text: S(r.description), n: Infinity, display: cleanName(r.name), src: c, cat: true });
    }
    for (const l of cat.infoLinks || []) {
      if (l.type !== 'rule' || isHidden(l, ctx0)) continue;
      const t = resolve(l); if (!t) continue;
      const nm = linkName(l, t); const k = up(nm);
      cand.set(k, { key: k, text: S(t.description), n: Math.max(Infinity, cand.get(k)?.n || 0), display: cleanName(nm), src: catOf(t), cat: true });
    }
    {
      const abNames = new Set(); for (const u of unitsOfArmy) for (const a of [...(u.abilities.unit || []), ...(u.abilities.wargear || [])]) for (const m of S(a.name).matchAll(/\(([^()]+)\)/g)) abNames.add(up(m[1]));
      for (const c of ownSet) for (const r of c.sharedRules || []) if (abNames.has(up(r.name)) && !cand.has(up(r.name))) cand.set(up(r.name), { key: up(r.name), text: S(r.description), n: Infinity, display: cleanName(r.name), src: c, cat: true });
    }
    const armyRules = [];
    for (const c of [...cand.values()].sort((a, b) => b.n - a.n)) {
      const m = /Army Faction is\s+(?:not\s+)?([^,.]+)/i.exec(c.text);
      const other = c.src && !ownSet.has(c.src) && fidOfCatObj(c.src) && fidOfCatObj(c.src) !== fid;
      const keep = m ? norm(m[1]) === primary : !other && (c.n >= 1);
      if (keep) armyRules.push({ name: c.display || displayName(c.key, cat), text: c.text });
    }
    // tables BSData keeps as entries of their own: the Code Chivalric selection (Deed / Quality profiles), the Thousand
    // Sons "Rituals reference" (Destiny's Ruin, Temporal Surge, Doombolt, Twist of Fate) → appended to the army rule
    for (const ar of armyRules) {
      const words = up(ar.name);
      const hits = [];
      for (const cid of reachC) {
        const c = cats.get(cid); if (!c || c === gst) continue;
        for (const e of [...(c.selectionEntries || []), ...(c.sharedSelectionEntries || [])]) {
          if (e.type !== 'upgrade' || hits.includes(e)) continue;
          const ref = /^(.+?)\s+reference$/i.exec(S(e.name));
          const stem = ref ? up(ref[1]).replace(/S$/, '') : null;
          if (up(e.name) === words || (stem && stem.length > 3 && up(ar.text).includes(stem))) hits.push(e);
        }
      }
      const lines = [];
      for (const e of hits) for (const x of [e, ...(e.selectionEntries || [])]) {
        const ps = (x.profiles || []).filter(p => p.hidden !== true && !isWeaponP(p) && p.typeName !== 'Unit');
        const d6 = p => { const v = char(p, 'D6'); const m = /\d+/.exec(v); return m ? Number(m[0]) : 99; };
        for (const p of ps.slice().sort((a, b) => d6(a) - d6(b))) {
          const main = char(p, 'Description') || char(p, 'Effect') || '';
          const extra = (p.characteristics || []).filter(k => !['Description', 'Effect'].includes(k.name) && S(k.$text)).map(k => k.name + ' ' + S(k.$text));
          // "Deed (D6 1 or 2) – We vow to lay low the tyrant...", "Destiny's Ruin (Psychic) (Warp Charge 5)"
          const head = up(p.typeName) === up(x.name) ? S(p.typeName) + (extra.length ? ' (' + extra.join(', ') + ')' : '') + ' – ' + cleanName(p.name) : cleanName(p.name) + (extra.length ? ' (' + extra.join(', ') + ')' : '');
          lines.push('**' + head + ':** ' + S(main));
        }
      }
      if (lines.length) ar.text = ar.text + '\n\n' + lines.join('\n\n');
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
        // an enhancement: an upgrade with "Enhancements" cost, or with points in a group "Enhancements" (Agents of the
        // Imperium, Sororitas Hagiomnifex carry no Enhancements cost) – or a link to one that carries the costs itself
        // (Venator Omni-Auspex in "Phobos Shadow Force Enhancements")
        const lnk = o.targetId && o.type === 'selectionEntry' && (costOf(o, ENH_ID) || 0) > 0 && typeof o.id === 'string' ? resolve(o) : null;
        const enhUp = x => x && x.type === 'upgrade' && typeof x.id === 'string' && ((costOf(x, ENH_ID) || 0) > 0 || (costOf(x, PTS_ID) != null && chain(x).slice(1).some(g => !g.type && /^Enhancements$/i.test(S(g.name)))));
        if (lnk || enhUp(o)) {
          if (enhSeen.has(o.id)) return; enhSeen.add(o.id);
          const ch = lnk ? chain(o) : chain(o);
          if (lnk) { o = { ...lnk, id: o.id, name: o.name || lnk.name, costs: o.costs, modifiers: [...(lnk.modifiers || []), ...(o.modifiers || [])], modifierGroups: [...(lnk.modifierGroups || []), ...(o.modifierGroups || [])] }; ch[0] = o; }
          const refs = new Set();
          for (const x of ch) for (const r of condRefs(x)) { if (detIds.has(r)) refs.add(r); else if (detByName.has(nkey(r))) refs.add(detByName.get(nkey(r)).id); else for (const d of CAT_DET.get(r) || []) if (detIds.has(d)) refs.add(d); }
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
            const text = rs.filter(r => !r.core).map(r => (r.name && r.name !== name && !r.weapon ? '**' + r.name + ':** ' : '') + r.text).join('\n\n');
            const core = rs.filter(r => r.core).map(r => up(r.name));
            const rec = core.length ? { name, cost: costOf(o, PTS_ID), text, core } : { name, cost: costOf(o, PTS_ID), text };
            // a weapon the bearer gets (its datasheet can list it) and extra bodyguard units the bearer may lead (BSData
            // 'Leading' association conditions: Kill Kommanda → KOMMANDOS, Kaptin's Hat → FLASH GITZ)
            const ws = rs.filter(r => r.weapon).map(r => r.weapon);
            if (ws.length) rec.weapons = ws;
            if (ENH_LEADS.has(o.id)) rec.leads = [...ENH_LEADS.get(o.id)];
            d.enhancements.push(rec);
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
  // the root node of an entry – through the same link when there are several (Library - Titans links each titan twice:
  // as Titanicus Traitoris and as Adeptus Titanicus, with different faction keywords)
  const rootNode = (catId, e) => { const ns = SYS.rootNodes(catId); return (e.__link && ns.find(x => x.id === e.id && x.linkId === e.__link.id)) || ns.find(x => x.id === e.id); };
  const engineKeywords = (catId, e) => {
    if (!SYS) return null;
    try {
      const n = rootNode(catId, e);
      if (!n) return null;
      const V = bsView(SYS, { id: 'kw', catalogueId: catId, limit: 0, sel: [{ id: 'kw1', t: n.token, n: 1, ch: [] }] });
      const w = V.force.ch[0];
      return w ? [...categoriesOfSel(V, w)].filter(id => !helperCat(id)).map(id => SYS.categoryNames.get(id)).filter(Boolean) : null;
    } catch { return null; }
  };

  // ───────── Unit sizes, points and composition via the builder engine ─────────
  // The unit as the builder creates it (mandatory models and wargear, defaults), then grown one model at a time as far
  // as the data allows (no error for the unit that the smallest unit does not have): model count and points per size
  // (so every BSData cost modifier counts – modifier groups, repeats, conditions on option groups …), the composition of
  // the smallest and of the largest unit.
  const engineSizes = (catId, e) => {
    if (!SYS) return null;
    try {
      const n = rootNode(catId, e);
      if (!n) return null;
      const measure = (r, at = 0) => {
        const V = bsView(SYS, r); const w = V.force.ch[at];
        if (!w || !w.node) return null;
        const models = [], packs = [];   // packs: other selections with models inside ("1 Shock Trooper Sergeant and 9 Shock Troopers" ×2 = 20 models)
        (function f(x, mult) { let any = false; for (const c of x.ch) { const k = mult * c.n; if (c.node && c.node.type === 'model') { models.push({ c, k }); any = true; } if (f(c, k)) { any = true; if (c.node && c.node.type !== 'model') packs.push({ c, k }); } } return any; })(w, 1);
        const cnt = models.reduce((s, m) => s + m.k, 0) + (w.node.type === 'model' ? 1 : 0);
        // points of the unit, its models and model packs – without wargear, which has costs of its own (a Leman Russ's
        // lascannon +5, a Ravager's dark lances): the datasheet's points as BSData prices the unit
        const own = c => totalCost(V, c) / Math.max(1, c.n) - (c.ch || []).reduce((s, k) => s + totalCost(V, k), 0);
        const pk = new Set(packs.map(p => p.c));
        let pts = own(w);
        (function f(x, mult) { for (const c of x.ch) if (c.node && (c.node.type === 'model' || pk.has(c))) { pts += mult * c.n * own(c); f(c, mult * c.n); } })(w, 1);
        return { r, V, w, models, packs, cnt, pts: Math.round(pts * 100) / 100, errs: unitErrs(V, w) };
      };
      const sum = (V, p, node) => selsOf(V, p, node).reduce((s, x) => s + x.n, 0);
      // the unit's own option limits (min/max per parent, hidden), as validate() checks them below a unit – without the
      // army-wide checks (no constraint on a unit or model entry counts models through a childId)
      const unitErrs = (V, w) => {
        const errs = new Set();
        (function chk(sel) {
          (function visit(nodes) {
            for (const k of nodes) {
              if (SKIP_RE.test(S(k.name))) continue;
              const sl = selsOf(V, sel, k), have = sl.reduce((s, x) => s + x.n, 0);
              const l = limits(V, k, k.group ? null : sl[0] || null, sel);
              if (have && l.hidden) errs.add('hidden ' + k.token);
              if (l.max >= 0 && have > l.max) errs.add('max ' + k.token);
              if (!l.hidden && l.min > have) errs.add('min ' + k.token);
              if (k.group && !l.hidden) visit(V.sys.children(k));
            }
          })(V.sys.children(sel.node));
          for (const c of sel.ch) if (c.node) chk(c);
        })(w);
        return errs;
      };
      const m0 = measure(autoSync(SYS, addSel(SYS, { id: 'sz', catalogueId: catId, limit: 0, sel: [] }, null, n.token, 1)));
      if (!m0) return null;
      const states = [m0];
      let cur = m0;
      for (let step = 0; step < 40; step++) {
        let next = null;
        // models first, the biggest stack first (9 Boyz before their Nob), then the order of the data; then the packs
        const bySize = l => l.slice().sort((a, b) => b.c.n - a.c.n);
        for (const { c } of [...bySize(cur.models), ...bySize(cur.packs)]) {
          const p = c.parent, l = limits(cur.V, c.node, c, p);
          if (l.max >= 0 && sum(cur.V, p, c.node) >= l.max) continue;
          if (c.groups.some(g => { const lg = limits(cur.V, g, null, p); return lg.max >= 0 && sum(cur.V, p, g) >= lg.max; })) continue;
          const m = measure(autoSync(SYS, setCount(cur.r, c.s.id, c.n + 1)));
          if (!m || m.cnt <= cur.cnt || [...m.errs].some(x => !m0.errs.has(x))) continue;
          next = m; break;
        }
        const ok = m => m && m.cnt > cur.cnt && ![...m.errs].some(x => !m0.errs.has(x));
        // … then an optional model not taken yet (Broadside Shas'ui 0-2 next to the Shas'vre)
        if (!next) {
          const sels = [cur.w]; (function f(x) { for (const c of x.ch) if (c.node && c.node.type !== 'model') { sels.push(c); f(c); } })(cur.w);
          outer: for (const s of sels) {
            const opts = [];
            (function visit(nodes, prefix, d) {
              for (const k of nodes) {
                if (d > 4 || SKIP_RE.test(S(k.name))) continue;
                const l = limits(cur.V, k, null, s);
                if (l.hidden || l.max === 0) continue;
                const tok = prefix ? prefix + '>' + k.token : k.token;
                if (k.group) { if (l.max < 0 || sum(cur.V, s, k) < l.max) visit(SYS.children(k), tok, d + 1); }
                else if (k.type === 'model' && !sum(cur.V, s, k)) opts.push(tok);
              }
            })(SYS.children(s.node), '', 0);
            for (const tok of opts) { const m = measure(autoSync(SYS, addSel(SYS, cur.r, s.s.id, tok, 1))); if (ok(m)) { next = m; break outer; } }
          }
        }
        // … then a bigger alternative of an exclusive choice ("1 Shock Trooper Sergeant and 9 Shock Troopers" → "2 … and
        // 18 …", Kill Team "5 models" → "10 models"): the smallest step up
        if (!next) {
          for (const { c } of [...cur.packs, ...cur.models]) {
            const g = c.groups[c.groups.length - 1], p = c.parent;
            if (!g || limits(cur.V, g, null, p).max !== 1) continue;
            const gTok = c.s.t.split('>').slice(0, -1).join('>');
            for (const alt of SYS.children(g)) {
              if (alt.group || alt === c.node) continue;
              const l = limits(cur.V, alt, null, p); if (l.hidden || l.max === 0) continue;
              const m = measure(autoSync(SYS, chooseInGroup(SYS, cur.r, p.s.id, gTok, gTok + '>' + alt.token)));
              if (ok(m) && (!next || m.cnt < next.cnt)) next = m;
            }
            if (next) break;
          }
        }
        if (!next) break;
        states.push(cur = next);
      }
      // points of the k-th copy of the unit in one army (BSData: "2nd+ / 3rd+ unit" costs), same size and loadout
      const reId = (s, k) => ({ ...s, id: s.id + '_' + k, ch: (s.ch || []).map(c => reId(c, k)) });
      states.copyPts = (st, k) => { const m = measure({ ...st.r, sel: Array.from({ length: k }, (_, i) => reId(st.r.sel[0], i)) }, k - 1); return m ? m.pts : null; };
      return states;
    } catch { return null; }
  };
  // points brackets (a run of sizes with the same points → its largest size, as New Recruit: 10 → 85, 20 → 170),
  // modelsRange, composition ("a-b label": the model's option group named like "4-9 Flesh Hounds", else the model)
  const applySizes = (u, states) => {
    const last = states[states.length - 1];
    if (!states[0].cnt) return;
    u.modelsRange = [states[0].cnt, last.cnt];
    const pts = new Map(); for (const s of states) if (!pts.has(s.cnt)) pts.set(s.cnt, s.pts);
    const out = [];
    for (const [k, p] of [...pts].sort((a, b) => a[0] - b[0])) { if (out.length && out[out.length - 1].pts === p) out[out.length - 1].models = k; else out.push({ models: k, pts: p }); }
    if (out.some(p => p.pts > 0) || !u.points.length) u.points = out;
    // more expensive further copies (Night Spinner 165, 3rd+ 195): pointsTiers [{ copy: 3, points: [{models, pts}] }] –
    // the first copy whose points differ from the copy before (copies 2–4 checked)
    if (states.copyPts && out.some(p => p.pts > 0)) {
      const st = new Map(); for (const s of states) st.set(s.cnt, s);
      let prev = out.map(p => p.pts);
      for (let k = 2; k <= 4; k++) {
        const pk = out.map(p => states.copyPts(st.get(p.models), k));
        if (pk.some(x => x == null)) break;
        if (pk.some((x, i) => x !== prev[i])) { (u.pointsTiers = u.pointsTiers || []).push({ copy: k, points: out.map((p, i) => ({ models: p.models, pts: pk[i] })) }); prev = pk; }
      }
    }
    if (states[0].w.node.type === 'model' && !states[0].models.length) return;   // single model: '1 <name>' as before
    const label = c => { for (let i = c.groups.length - 1; i >= 0; i--) { const g = c.groups[i]; const k = selConstraints({ constraints: g.constraints }); if ((k.min != null || k.max != null) && !/^(Unit Composition|Core|Either:?|Models?)$/i.test(groupName(g.name))) return groupName(g.name); } return cleanName(c.node.name); };
    const tally = s => { const t = new Map(); for (const { c, k } of s.models) t.set(label(c), (t.get(label(c)) || 0) + k); return t; };
    const lo = tally(states[0]), hi = tally(last);
    const parts = [...new Set([...lo.keys(), ...hi.keys()])].map(l => { const a = lo.get(l) || 0, b = hi.get(l) || 0; return (a === b ? a : Math.min(a, b) + '-' + Math.max(a, b)) + ' ' + l; });
    if (parts.length) u.composition = parts.join(', ');
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
      { const sz = engineSizes(oc.id, e); if (sz) { applySizes(unit, sz); if (opts.onSizes) opts.onSizes(fid, unit.name, sz.map(s => [s.cnt, s.pts])); } }
      if (oc !== cat) unit.catalogue = S(oc.name);
      Object.assign(factionRules, fr);
      // army rule candidates: counted on the faction's own units (its first faction keyword, not Legends) – a Legends
      // Heresy tank or an allied Harlequin does not make its rule an army rule of this faction
      // (a rule the faction's own catalogue defines counts on any of its units: Agents 'Kill Team', only on Legends kill teams)
      for (const k of unit.abilities.faction) if ((!unit.legends && unit.factionKeywords.includes(up(kws[0]))) || [cat, ...(SUPPLEMENTS[fid] || []).map(f => byFile.get(f))].includes(RULE_CAT.get(k))) ruleUse.set(k, (ruleUse.get(k) || 0) + 1);
      units.push(unit);
    }
    // doppelte IDs eindeutig machen (Legends-Einheiten zuletzt, damit reguläre Einheiten ihre ID behalten)
    const ids = new Map();
    for (const un of [...units.filter(x => !x.legends), ...units.filter(x => x.legends)]) { const n = (ids.get(un.id) || 0) + 1; ids.set(un.id, n); if (n > 1) un.id = un.id + '-' + n; }
    units.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.legends ? 1 : 0) - (b.legends ? 1 : 0));
    const name = FACTIONS.find(f => f.id === fid)?.name || fid;
    const army = buildArmyData(fid, cat, kws, ruleUse, units, factionRules, (SUPPLEMENTS[fid] || []).map(f => byFile.get(f)).filter(Boolean));
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
  // A faction rule that is a detachment's rule (BSData still links the 10th-edition army rule TEMPLAR VOWS to every Space
  // Marines datasheet; in 11th it is the rule of the Vow-Sworn Crusaders detachment): no army rule, no datasheet FACTION
  // ability of any faction
  {
    const detRules = new Set(armyReport.flatMap(r => r.detachments.flatMap(d => d.rules.filter(x => !x.core).map(x => up(x.name)))));
    for (const r of armyReport) { for (let i = r.armyRules.length - 1; i >= 0; i--) if (detRules.has(up(r.armyRules[i].name))) r.armyRules.splice(i, 1); }
    for (const f of Object.values(files_)) {
      for (const u of f.units || []) u.abilities.faction = u.abilities.faction.filter(k => !detRules.has(k));
      for (const k of Object.keys(f.factionRules || {})) if (detRules.has(k)) delete f.factionRules[k];
    }
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
  // Where the game system file still has an older wording, the 11th-edition core rule text wins: the rulebook glossary
  // entries quoted word for word (data/core.js, `orig: true`) – e.g. 24.08 DEADLY DEMISE "Each time a model with this
  // ability is destroyed" (BSData: "a model in this unit", plus a 10th-edition example). Markup and examples alone are
  // no difference; cross-references ("See [CLOSE-QUARTERS].") never replace a full text.
  {
    const plain = s => S(s).replace(/\*\*|\*|\^\^/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/\s*Example:.*$/s, '').replace(/\s*Designer.s Note:.*$/s, '').replace(/:\s*-\s*/g, ': ').trim().toLowerCase();
    for (const g of (CORE_RULES && CORE_RULES.glossary) || []) {
      if (!g || !g.orig || !g.text || /^.{0,80}\bSee \[/.test(g.text) && g.text.length < 160) continue;
      const k = up(g.term).replace(/^ANTI-X Y\+$/, 'ANTI').replace(/\s+(X\+?|X")$/, '');
      if (!core[k] || plain(core[k]) === plain(g.text)) continue;
      core[k] = S(g.text);
    }
  }
  files_['core-abilities.json'] = core;
  // Catalogue index for the army builder (js/builder): which repo file holds which catalogue and what it links
  files_['bs-catalogues.json'] = [...byFile.entries()].map(([file, r]) => ({ id: r.id, file, name: S(r.name), gameSystem: r === gst, library: !!r.library,
    links: (r.catalogueLinks || []).map(l => ({ id: l.targetId, root: !!l.importRootEntries })) }));
  return { files: files_, report: reportMd, unresolved, stats: { units: total, bytes: totalBytes, coreRules: Object.keys(core).length, ...reportTotals } };
}
