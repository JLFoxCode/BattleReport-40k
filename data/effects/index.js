/* Effects per faction (data/effects/SCHEMA.md). Files that do not exist yet resolve to null. */
const cache = new Map();
export async function loadEffects(factionId) {
  if (!factionId) return null;
  if (cache.has(factionId)) return cache.get(factionId);
  let mod = null;
  try { mod = (await import(`./${factionId}.js`)).default || null; } catch { mod = null; }
  cache.set(factionId, mod);
  return mod;
}
