/* Army lists of the army builder, stored on THIS device. App: window.BR keeps them in the app's own storage
 * (independent of the page origin – a phone that joined a game on another device still finds its lists).
 * Browser without app: localStorage. A list = roster of js/builder/bs-engine.js + { name, faction, file, updatedAt }.
 * Signed in to an online account (js/account.js): the lists stay here as well, the account syncs them via onArmyChange. */
const LS_PREFIX = 'br40k.army.';
const bridge = name => window.BR && typeof window.BR[name] === 'function';
const listeners = new Set();
/** fn(kind 'save' | 'delete', army | id) after every change made by the app (not for opt.silent – the account sync). */
export function onArmyChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (kind, v) => { for (const fn of listeners) { try { fn(kind, v); } catch (e) { console.warn('onArmyChange', e); } } };

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
/** Saves the list; returns the saved list, or null when it could not be stored (bridge error, storage full / blocked).
 *  opt.verify: read it back afterwards (the app's bridge does not report write errors) – for a new list, before the
 *  editor opens it. opt.keepStamp: keep the list's updatedAt (a copy from the account); opt.silent: no onArmyChange. */
export function saveArmy(army, opt = {}) {
  const a = opt.keepStamp && army.updatedAt ? Object.assign({}, army) : Object.assign({}, army, { updatedAt: new Date().toISOString() });
  let json;
  try { json = JSON.stringify(a); } catch (e) { console.warn('saveArmy', e); return null; }
  if (bridge('saveArmy')) {
    try { window.BR.saveArmy(a.id, json); } catch (e) { console.warn('BR.saveArmy', e); return null; }
    if (opt.verify) {
      const back = loadArmy(a.id);
      if (!back || back.updatedAt !== a.updatedAt) { console.warn('BR.saveArmy: not found after saving', a.id); return null; }
    }
    if (!opt.silent) emit('save', a);
    return a;
  }
  try {
    localStorage.setItem(LS_PREFIX + a.id, json);
    if (localStorage.getItem(LS_PREFIX + a.id) !== json) return null;
  } catch (e) { console.warn('localStorage', e); return null; }
  if (!opt.silent) emit('save', a);
  return a;
}
export function deleteArmy(id, opt = {}) {
  if (!opt.silent) emit('delete', id);
  try { if (bridge('deleteArmy')) { window.BR.deleteArmy(id); return; } } catch {}
  try { localStorage.removeItem(LS_PREFIX + id); } catch {}
}
export const armyId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
