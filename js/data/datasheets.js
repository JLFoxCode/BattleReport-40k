// Datenblätter (data/datasheets/<fraktion>.json, erzeugt aus BSData per tools/bsdata-convert.mjs).
// Browser-ESM ohne Abhängigkeiten: laden + cachen, Einheitennamen aus Listen-Importen zuordnen, Waffen auflösen.

const cache = new Map();   // factionId → Promise<{units, …} | null>
const BASE = new URL('../../data/datasheets/', import.meta.url);

/** Lädt das Datenblatt-Paket einer Fraktion (gecacht). Gibt null zurück, wenn es keins gibt oder das Laden scheitert. */
export function loadDatasheets(factionId) {
  const id = String(factionId || '').trim();
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    const p = fetch(new URL(id + '.json', BASE))
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d && Array.isArray(d.units) ? d : null))
      .catch(() => null);
    cache.set(id, p);
  }
  return cache.get(id);
}

/** Lädt die Kern-/Waffenfähigkeitstexte ({ 'DEEP STRIKE': '…' }) – gecacht, null bei Fehler. */
export function loadCoreAbilities() {
  if (!cache.has('core-abilities')) {
    cache.set('core-abilities', fetch(new URL('core-abilities.json', BASE)).then(r => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get('core-abilities');
}

const STRIP_WORDS = /\b(squad|squads|unit|units|team|teams|the|with|w\/|of)\b/g;

/** Normalisiert Einheitennamen für den Vergleich: klein, ohne "10x", Plural-s, Satzzeichen, "Squad"/"Unit". */
export function normName(s) {
  let t = String(s || '').toLowerCase();
  t = t.replace(/^\s*(?:char\d+\s*:\s*)?/, '').replace(/^\s*\d+\s*x\s+/, '');   // "Char1: 10x Boyz"
  t = t.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');                                   // "(85 pts)", "[Legends]"
  t = t.replace(/['’`´]/g, '').replace(/[^a-z0-9äöüß]+/g, ' ');
  t = t.replace(STRIP_WORDS, ' ');
  t = t.split(/\s+/).filter(Boolean).map(w => (w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w)).join(' ');
  return t.trim();
}

function tokens(n) { return new Set(normName(n).split(' ').filter(Boolean)); }

/** Findet das Datenblatt zu einem (importierten) Einheitennamen: only the exact normalised name – a fuzzy match would pick a
 *  different unit (its OC, M, W, keywords). On a tie the pack lists the non-Legends unit first. null if there is none. */
export function matchUnit(units, name) {
  if (!Array.isArray(units) || !units.length) return null;
  const q = normName(name);
  if (!q) return null;
  return units.find(u => normName(u.name) === q) || null;
}
/** Packs of units an army may include from another faction (allied Imperial Agents / Knights, Chaos Daemons / Knights) –
 *  looked up when the army's own pack has no unit of that name. */
export const ALLY_PACKS = ['imperial-agents', 'imperial-knights', 'chaos-daemons', 'chaos-knights'];

/** Waffe eines Datenblatts nach Name (alle Profile), null wenn unbekannt. */
export function matchWeapon(unit, name) {
  if (!unit || !name) return null;
  const q = normName(name);
  if (!q) return null;
  const all = [...(unit.ranged || []).map(w => ({ ...w, kind: 'ranged' })), ...(unit.melee || []).map(w => ({ ...w, kind: 'melee' }))];
  let hits = all.filter(w => normName(w.name) === q);
  if (!hits.length) hits = all.filter(w => { const n = normName(w.name); return n.startsWith(q) || q.startsWith(n) || n.includes(q); });
  if (!hits.length) { const qt = tokens(q); hits = all.filter(w => { const wt = tokens(w.name); let c = 0; for (const t of wt) if (qt.has(t)) c++; return c && c / Math.max(wt.size, qt.size) >= 0.6; }); }
  return hits.length ? hits : null;
}

/**
 * Hängt an importierte Listeneinheiten (parseArmyText) `datasheetId` und aufgelöste Waffen an.
 * `weapons`: [{ name, count, kind, profiles: [weaponProfile…] }] für bekannte Waffen; unbekannte Namen bleiben Strings in `unknownWargear`.
 */
export function resolveList(units, listUnits) {
  return (Array.isArray(listUnits) ? listUnits : []).map(lu => {
    const ds = matchUnit(units, lu && lu.name);
    const out = { ...lu, datasheetId: ds ? ds.id : null, weapons: [], unknownWargear: [] };
    const wg = Array.isArray(lu && lu.wargear) ? lu.wargear : [];
    for (const item of wg) {
      const name = typeof item === 'string' ? item : item && item.name;
      const count = typeof item === 'object' && item && Number.isFinite(Number(item.count)) ? Number(item.count) : 1;
      const hits = ds ? matchWeapon(ds, name) : null;
      // a weapon may have a ranged and a melee profile of the same name → one entry per kind, each with its own profiles
      if (hits) for (const kind of [...new Set(hits.map(h => h.kind))]) out.weapons.push({ name: hits.find(h => h.kind === kind).name, count, kind, profiles: hits.filter(h => h.kind === kind) });
      else if (name) out.unknownWargear.push(name);
    }
    return out;
  });
}
