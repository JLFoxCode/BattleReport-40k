/* Netzwerk: JSON-API + SSE mit automatischem Reconnect (SPEC §6/§7/§10).
 *
 * createNet(code, { onStatus }) → {
 *   getState(), subscribe(fn) → unsubscribe        (nur SSE-Event "state")
 *   onPointer(fn) → unsubscribe                      (SSE-Event "pointer", §10)
 *   onPhoto(fn) → unsubscribe                        (SSE-Event "photo" { kind: 'new'|'meta'|'delete', photo }, §11)
 *   onSignal(fn) → unsubscribe                       (SSE-Event "signal" { type, ...payload, ts }, §12 – z. B. 'capture', 'camera', 'pointer')
 *   onStatus(fn) → unsubscribe, isOnline(), refresh() → Promise<state>,
 *   dispatch(action) → Promise<state>, undo() → Promise<state>, pointer(p) → Promise<void>,
 *   uploadPhoto(blob, meta?) → Promise<photo>, updatePhoto(id, patch) → Promise<photo>,
 *   listPhotos() → Promise<photo[]>, deletePhoto(id) → Promise, photoUrl(id) → string,
 *   signal(obj) → Promise<void>                      (POST /signal, obj = { type, ...payload })
 *   getCamera() → Promise<camera>, setCamera(patch) → Promise<camera>, clearCamera() → Promise<camera>
 *   close()
 * }
 * api = { listGames(), createGame(names), deleteGame(code), getState(code), getLog(code, since), listPhotos(code) }
 */

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    throw new Error('Keine Verbindung zum Server');
  }
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!res.ok) {
    const msg = (data && data.error) || `Serverfehler ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  listGames: () => request('GET', '/api/games'),
  createGame: (names) => request('POST', '/api/games', names && names.length ? { names } : {}),
  deleteGame: (code) => request('DELETE', `/api/games/${encodeURIComponent(code)}`),
  getState: (code) => request('GET', `/api/games/${encodeURIComponent(code)}`),
  getLog: (code, since = 0) => request('GET', `/api/games/${encodeURIComponent(code)}/log?since=${since | 0}`),
  listPhotos: (code) => request('GET', `/api/games/${encodeURIComponent(code)}/photos`)
};

export function createNet(code, opts = {}) {
  const base = `/api/games/${encodeURIComponent(code)}`;
  let state = null;
  let online = false;
  let closed = false;
  let es = null;
  let retry = 0;
  let timer = null;
  const stateSubs = new Set();
  const pointerSubs = new Set();
  const photoSubs = new Set();
  const signalSubs = new Set();
  const statusSubs = new Set();
  if (typeof opts.onStatus === 'function') statusSubs.add(opts.onStatus);

  function setOnline(v) {
    if (online === v) return;
    online = v;
    for (const fn of statusSubs) { try { fn(online); } catch (e) { console.error(e); } }
  }
  function pushState(s) {
    if (!s || typeof s !== 'object') return;
    // Veraltete Zustände (z. B. aus einem späten fetch) ignorieren – aber Undo verkleinert seq, daher nur strikte Prüfung bei gleichem seq.
    state = s;
    for (const fn of stateSubs) { try { fn(state); } catch (e) { console.error(e); } }
  }

  /* Polling-Fallback: manche Proxys (z. B. der Cloudflare-Quick-Tunnel des Dev-Servers) puffern SSE komplett.
   * Kommt nach dem Verbinden 4 s lang kein "state"-Event, wird der Stand alle 2 s per GET geholt, bis SSE wieder liefert. */
  let sseSeen = false, pollTimer = null, sseCheck = null, lastPolled = '';
  function startPolling() {
    if (pollTimer || closed) return;
    console.warn('SSE liefert nichts – Polling alle 2 s');
    const tick = async () => {
      try {
        const res = await fetch(base, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        setOnline(true);
        if (text !== lastPolled) { lastPolled = text; pushState(JSON.parse(text)); }
      } catch { setOnline(false); }
    };
    tick();
    pollTimer = setInterval(tick, 2000);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  function connect() {
    if (closed) return;
    if (!sseSeen && !sseCheck) sseCheck = setTimeout(() => { sseCheck = null; if (!sseSeen) startPolling(); }, 4000);
    if (es) { try { es.close(); } catch {} es = null; }
    try {
      es = new EventSource(`${base}/events`);
    } catch (e) {
      scheduleReconnect();
      return;
    }
    es.addEventListener('open', () => { retry = 0; setOnline(true); });
    es.addEventListener('state', ev => {
      sseSeen = true; stopPolling();
      try { pushState(JSON.parse(ev.data)); } catch (e) { console.error('SSE state ungültig', e); }
    });
    es.addEventListener('pointer', ev => {
      let p = null;
      try { p = JSON.parse(ev.data); } catch { return; }
      for (const fn of pointerSubs) { try { fn(p); } catch (e) { console.error(e); } }
    });
    es.addEventListener('photo', ev => {
      let p = null;
      try { p = JSON.parse(ev.data); } catch { return; }
      for (const fn of photoSubs) { try { fn(p); } catch (e) { console.error(e); } }
    });
    es.addEventListener('signal', ev => {
      let p = null;
      try { p = JSON.parse(ev.data); } catch { return; }
      for (const fn of signalSubs) { try { fn(p); } catch (e) { console.error(e); } }
    });
    es.addEventListener('error', () => {
      if (!pollTimer) setOnline(false);
      // EventSource reconnectet selbst, aber bei 404/geschlossen (readyState 2) nicht – dann selbst mit Backoff.
      if (es && es.readyState === EventSource.CLOSED) scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (closed || timer) return;
    const delay = Math.min(15000, 500 * Math.pow(2, retry++)) + Math.random() * 300;
    timer = setTimeout(() => { timer = null; connect(); }, delay);
  }

  // Bei Rückkehr in den Vordergrund / Netz wieder da: sofort neu verbinden.
  const onVisible = () => { if (!closed && document.visibilityState === 'visible' && !online) { retry = 0; connect(); } };
  const onNetUp = () => { if (!closed && !online) { retry = 0; connect(); } };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onNetUp);

  connect();

  return {
    code,
    getState: () => state,
    isOnline: () => online,
    subscribe(fn) { stateSubs.add(fn); if (state) { try { fn(state); } catch (e) { console.error(e); } } return () => stateSubs.delete(fn); },
    onPointer(fn) { pointerSubs.add(fn); return () => pointerSubs.delete(fn); },
    onPhoto(fn) { photoSubs.add(fn); return () => photoSubs.delete(fn); },
    onSignal(fn) { signalSubs.add(fn); return () => signalSubs.delete(fn); },
    onStatus(fn) { statusSubs.add(fn); try { fn(online); } catch {} return () => statusSubs.delete(fn); },
    async refresh() {
      const s = await request('GET', base);
      pushState(s);
      return s;
    },
    async dispatch(action) {
      const r = await request('POST', `${base}/actions`, { action });
      if (r && r.state) pushState(r.state);
      return r ? r.state : null;
    },
    async undo(by) {
      // by = the player whose phone asks: the server only undoes that player's own last action (the scoreboard sends none)
      const r = await request('POST', `${base}/undo`, typeof by === 'number' ? { by } : undefined);
      if (r && r.state) pushState(r.state);
      return r ? r.state : null;
    },
    async pointer(p) {
      // Feuer-und-vergessen; Fehler nur in die Konsole.
      try { await request('POST', `${base}/pointer`, p); } catch (e) { console.warn('pointer', e.message); }
    },
    /** signal({ type, ...payload }) – flüchtige Nachricht an alle Ansichten (nicht persistiert). */
    async signal(obj) {
      try { await request('POST', `${base}/signal`, obj); } catch (e) { console.warn('signal', e.message); }
    },
    getCamera: () => request('GET', `${base}/camera`),
    setCamera: (patch) => request('PUT', `${base}/camera`, patch || {}),
    clearCamera: () => request('DELETE', `${base}/camera`),
    /** uploadPhoto(blob|File|ArrayBuffer, { by, round, turn, phase }) → photo-Metadaten (inkl. url) */
    async uploadPhoto(blob, meta = {}) {
      const q = new URLSearchParams();
      for (const k of ['by', 'round', 'turn', 'phase']) if (meta[k] != null && meta[k] !== '') q.set(k, String(meta[k]));
      const type = (blob && blob.type) || meta.type || 'image/jpeg';
      let res;
      try {
        res = await fetch(`${base}/photos${q.toString() ? '?' + q : ''}`, { method: 'POST', headers: { 'Content-Type': type }, body: blob, cache: 'no-store' });
      } catch { throw new Error('Keine Verbindung zum Server'); }
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) throw Object.assign(new Error((data && data.error) || `Upload fehlgeschlagen (${res.status})`), { status: res.status });
      return data.photo;
    },
    async updatePhoto(id, patch) {
      const r = await request('PUT', `${base}/photos/${encodeURIComponent(id)}`, patch || {});
      return r ? r.photo : null;
    },
    listPhotos: () => request('GET', `${base}/photos`),
    deletePhoto: (id) => request('DELETE', `${base}/photos/${encodeURIComponent(id)}`),
    photoUrl: (id, ext = 'jpg') => `${base}/photos/${encodeURIComponent(id)}.${ext}`,
    close() {
      closed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      if (sseCheck) { clearTimeout(sseCheck); sseCheck = null; }
      stopPolling();
      if (es) { try { es.close(); } catch {} es = null; }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onNetUp);
      stateSubs.clear(); pointerSubs.clear(); photoSubs.clear(); signalSubs.clear(); statusSubs.clear();
      setOnline(false);
    }
  };
}
