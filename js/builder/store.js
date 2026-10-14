/* Army lists of the army builder, stored on THIS device. App: window.BR keeps them in the app's own storage
 * (independent of the page origin – a phone that joined a game on another device still finds its lists).
 * Browser without app: localStorage. A list = roster of js/builder/bs-engine.js + { name, faction, file, updatedAt }. */
const LS_PREFIX = 'br40k.army.';
const bridge = name => window.BR && typeof window.BR[name] === 'function';

export function listArmies() {
  let out = [];
  try { if (bridge('listArmies')) out = JSON.parse(window.BR.listArmies() || '[]'); } catch (e) { console.warn('BR.listArmies', e); }
  if (!bridge('listArmies')) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) { try { out.push(JSON.parse(localStorage.getItem(k))); } catch {} }
      }
    } catch {}
  }
  return out.filter(a => a && a.id).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
export function loadArmy(id) { return listArmies().find(a => a.id === id) || null; }
export function saveArmy(army) {
  const a = Object.assign({}, army, { updatedAt: new Date().toISOString() });
  const json = JSON.stringify(a);
  try { if (bridge('saveArmy')) { window.BR.saveArmy(a.id, json); return a; } } catch (e) { console.warn('BR.saveArmy', e); }
  try { localStorage.setItem(LS_PREFIX + a.id, json); } catch (e) { console.warn('localStorage', e); }
  return a;
}
export function deleteArmy(id) {
  try { if (bridge('deleteArmy')) { window.BR.deleteArmy(id); return; } } catch {}
  try { localStorage.removeItem(LS_PREFIX + id); } catch {}
}
export const armyId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
