/* Finished games, stored on THIS device (the host closes a game once it is over – see server.js / GameServer.java).
 * App: window.BR (Android bridge) keeps them in the app's own storage, independent of the page origin (a phone that
 * played via the host's address finds them again in its own app). Browser without app: localStorage.
 * Entry: { code, savedAt, state (final state), actions (full log) }; list() returns meta only.
 * Signed in to an online account (js/account.js): the account syncs them via onArchiveChange (id: archiveId). */
const LS_PREFIX = 'br40k.finished.';
const listeners = new Set();
/** fn(kind 'save' | 'delete', entry | code) after a change made by the app (not for opt.silent – the account sync). */
export function onArchiveChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (kind, v) => { for (const fn of listeners) { try { fn(kind, v); } catch (e) { console.warn('onArchiveChange', e); } } };

/** Id of a finished game in an account: game codes repeat over time, so the creation time is part of it
 *  (same rule as server/auth.js archiveId). */
export function archiveId(entry) {
  const code = String((entry && entry.code) || '').toUpperCase();
  const t = Date.parse(entry && entry.state && entry.state.createdAt);
  return Number.isFinite(t) ? code + '-' + t.toString(36) : code;
}

function meta(entry) {
  const s = entry.state || {};
  const pl = s.players || [];
  const vpOf = p => (p && p.vp ? (p.vp.primary || 0) + (p.vp.secondary || 0) + (p.vp.bonus || 0) : 0);
  return { code: entry.code, savedAt: entry.savedAt, players: pl.map(p => (p && p.name) || ''), vp: pl.map(vpOf), round: s.round || 0 };
}

export function saveFinished(entry, opt = {}) {
  const full = JSON.stringify(entry), m = JSON.stringify(meta(entry));
  let ok = false;
  try {
    if (window.BR && typeof window.BR.saveGame === 'function') { window.BR.saveGame(entry.code, m, full); ok = true; }
  } catch (e) { console.warn('BR.saveGame', e); }
  if (!ok) { try { localStorage.setItem(LS_PREFIX + entry.code, full); ok = true; } catch (e) { console.warn('localStorage', e); return false; } }
  if (!opt.silent) emit('save', entry);
  return ok;
}

export function listFinished() {
  try {
    if (window.BR && typeof window.BR.listGames === 'function') return JSON.parse(window.BR.listGames() || '[]');
  } catch (e) { console.warn('BR.listGames', e); }
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) { try { out.push(meta(JSON.parse(localStorage.getItem(k)))); } catch {} }
    }
  } catch {}
  return out.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

export function loadFinished(code) {
  try {
    if (window.BR && typeof window.BR.loadGame === 'function') { const t = window.BR.loadGame(code); return t ? JSON.parse(t) : null; }
  } catch (e) { console.warn('BR.loadGame', e); }
  try { const t = localStorage.getItem(LS_PREFIX + code); return t ? JSON.parse(t) : null; } catch { return null; }
}

export function deleteFinished(code, opt = {}) {
  if (!opt.silent) { const e = loadFinished(code); if (e) emit('delete', e); }
  try { if (window.BR && typeof window.BR.deleteGame === 'function') { window.BR.deleteGame(code); return; } } catch {}
  try { localStorage.removeItem(LS_PREFIX + code); } catch {}
}

/** Hash of the archive view; inside the app on a joined phone (page from the host) it switches back to the own app. */
export function archiveHref(code) {
  const local = /^(127\.|localhost)/.test(location.hostname);
  return window.BR && !local ? `http://127.0.0.1:${(window.BR.port && window.BR.port()) || 8417}/index.html#/archive/${code}` : `#/archive/${code}`;
}
