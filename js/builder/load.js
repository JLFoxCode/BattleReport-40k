/* Loads the BSData catalogues the army builder needs (from the app: /bsdata/*.json, updated by the unit data update)
 * and the catalogue index data/datasheets/bs-catalogues.json (written by the converter). Systems are cached per catalogue. */
import { BSystem } from './bs-engine.js';
import { MAP } from '../data/bsdata-convert-core.js';

const base = new URL('../../', import.meta.url);
let indexP = null;
const systems = new Map();

export function catalogueIndex() {
  if (!indexP) indexP = fetch(new URL('data/datasheets/bs-catalogues.json', base), { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('Catalogue index missing (' + r.status + ') – update the unit data'); return r.json(); })
    .catch(e => { indexP = null; throw e; });
  return indexP;
}

// Grand alliances and the families inside them (the BSData names carry "Imperium - Adeptus Astartes - …" themselves)
export const ALLIANCES = ['Imperium', 'Chaos', 'Xenos'];
const SUBGROUP = { 'Chaos Space Marines': 'Heretic Astartes', 'Death Guard': 'Heretic Astartes', "Emperor's Children": 'Heretic Astartes', 'Thousand Sons': 'Heretic Astartes',
  'World Eaters': 'Heretic Astartes', Aeldari: 'Aeldari', Drukhari: 'Aeldari', 'Imperial Knights': 'Imperial Knights & Agents', 'Agents of the Imperium': 'Imperial Knights & Agents',
  'Chaos Daemons': 'Daemons & Knights', 'Chaos Knights': 'Daemons & Knights', Tyranids: 'Tyranids', 'Genestealer Cults': 'Tyranids' };
const FIRST = ['Space Marines', 'Chaos Space Marines', 'Aeldari', 'Tyranids'];   // the codex army before its variants

/** Catalogues a player can build an army from (no libraries, no game system), with the app faction id they belong to. */
export async function playableCatalogues() {
  const idx = await catalogueIndex();
  const byId = new Map(idx.map(c => [c.id, c]));
  const fidOfFile = new Map(MAP.map(([id, file]) => [file, id]));
  const factionOf = c => {
    const seen = new Set();
    const walk = x => { if (!x || seen.has(x.id)) return null; seen.add(x.id); const f = fidOfFile.get(x.file); if (f) return f; for (const l of x.links) { const r = walk(byId.get(l.id)); if (r) return r; } return null; };
    return walk(c);
  };
  return idx.filter(c => !c.gameSystem && !c.library && !/Unaligned|Titanicus|Library/i.test(c.name))
    .map(c => {
      const parts = c.name.split(' - ');
      const label = parts[parts.length - 1];
      const alliance = ALLIANCES.includes(parts[0]) ? parts[0] : 'Xenos';
      const group = parts.length > 2 ? parts[1] : (SUBGROUP[label] || null);
      return { id: c.id, file: c.file, name: c.name, label, alliance, group, faction: factionOf(c) };
    })
    .sort((a, b) => ALLIANCES.indexOf(a.alliance) - ALLIANCES.indexOf(b.alliance)
      || String(a.group || a.label).localeCompare(String(b.group || b.label))   // families sit among the single armies (alphabetical)
      || (FIRST.includes(a.label) ? 0 : 1) - (FIRST.includes(b.label) ? 0 : 1) || a.label.localeCompare(b.label));
}

/** BSystem for a catalogue (+ every catalogue it links, + the game system). */
export async function systemFor(catalogueId) {
  if (systems.has(catalogueId)) return systems.get(catalogueId);
  const p = (async () => {
    const idx = await catalogueIndex();
    const byId = new Map(idx.map(c => [c.id, c]));
    const need = new Set();
    const add = id => { const c = byId.get(id); if (!c || need.has(id)) return; need.add(id); for (const l of c.links) add(l.id); };
    add(catalogueId);
    const gst = idx.find(c => c.gameSystem);
    if (gst) need.add(gst.id);
    const docs = await Promise.all([...need].map(async id => {
      const r = await fetch(new URL('bsdata/' + encodeURIComponent(byId.get(id).file), base));
      if (!r.ok) throw new Error('Could not load ' + byId.get(id).file + ' (' + r.status + ')');
      return r.json();
    }));
    return new BSystem(docs);
  })();
  systems.set(catalogueId, p);
  p.catch(() => systems.delete(catalogueId));
  return p;
}
