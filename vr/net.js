/* Minimal client for the game server: GET state, SSE "state" events, POST actions. Deliberately independent of
 * js/net.js – the VR module shares nothing with the app but the server API (and the read-only data files). */

async function request(method, url, body) {
  const res = await fetch(url, {
    method, cache: 'no-store',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Server error ${res.status}`);
    err.status = res.status; err.login = !!(data && data.login);
    throw err;
  }
  return data;
}

export const session = () => request('GET', '/api/session').catch(() => ({ auth: false, user: null }));
export const listGames = () => request('GET', '/api/games');

/** connect(code, { onState, onStatus, onSignal }) → { state(), dispatch(action), signal(obj), close() }
 *  signal: POST …/signal – the server broadcasts it as SSE "signal" to every device of the game (VR remote control). */
export function connect(code, h = {}) {
  const base = `/api/games/${encodeURIComponent(code)}`;
  let state = null, es = null, closed = false, timer = null;
  const set = s => { if (!s) return; state = s; if (h.onState) h.onState(s); };
  const status = s => { if (h.onStatus) h.onStatus(s); };
  const open = () => {
    if (closed) return;
    es = new EventSource(`${base}/events`);
    es.addEventListener('state', e => { try { set(JSON.parse(e.data)); } catch {} });
    es.addEventListener('signal', e => { if (!h.onSignal) return; try { h.onSignal(JSON.parse(e.data)); } catch {} });
    es.onopen = () => status('online');
    es.onerror = () => { status('reconnecting'); };     // EventSource retries by itself
  };
  const start = () => request('GET', base).then(s => { set(s); open(); }).catch(e => {
    if (e.login || e.status === 401) status('login');
    else if (e.status === 404) status('notfound');
    else { status('offline'); timer = setTimeout(() => { if (!closed) start(); }, 3000); }
  });
  start();
  return {
    state: () => state,
    signal: obj => request('POST', `${base}/signal`, obj).catch(() => {}),
    dispatch: async action => { const r = await request('POST', `${base}/actions`, { action }); if (r && r.state) set(r.state); return r; },
    close: () => { closed = true; if (es) es.close(); if (timer) clearTimeout(timer); }
  };
}
