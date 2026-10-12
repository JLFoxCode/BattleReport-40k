/* ═══════════════════════════════════════════════════════════════════
   Deckenkamera (js/ui/camera.js) – Rolle `camera`, Route #/g/CODE/camera (SPEC §12)

   Ein Browser-Tab am Server-PC (http://localhost:8417 → Secure Context, getUserMedia ohne HTTPS).
   - Live-Vorschau der USB-Webcam, Gerätewahl, Auflösungsanzeige
   - Auto-Auslösung bei Zustandsübergängen (deploy→battle, movement→shooting, charge→fight, Zugwechsel)
     und bei Signal { type: 'capture' } – 1,5 s warten, dann Vollbild-Frame als JPEG (0,9) hochladen,
     gespeicherte Kalibrierung (H, k1, rms) an das Foto hängen
   - Kalibrieren: Marker erkennen → metrische Entzerrung (fitFromSquares) → Tischecken anklicken →
     Rahmen (frameFromCorners) → Vorschau → speichern (Server camera.json + localStorage)
   - Prüfen: Marker hinlegen → Residuen unter der gespeicherten H → Warnung > 0,5"
   Das Modul hält seine Instanz über Re-Renders (main.js rendert bei jedem State-Update).
   ═══════════════════════════════════════════════════════════════════ */
import { esc, toast, sheet } from './components.js';
import { createMap } from './map.js';
import { detectMarkers, drawDetections } from '../geo/markers.js';
import { fitFromSquares, frameFromCorners, markerResiduals, rescale, isH, TABLE } from '../geo/homography.js';
import { renderRectified } from './photo.js';

const LS_TRIG = 'sb40k.cam.triggers';
const LS_DEV = 'sb40k.cam.device';
const lsCalibKey = code => `sb40k.cam.calib.${code}`;
const DEFAULT_TRIG = { battle: true, shooting: true, fight: true, turn: true, signal: true };
const CAPTURE_DELAY = 1500;
const MARKER_SIZE = 4;

let inst = null;

export function render(root, ctx) {
  if (!inst || inst.code !== ctx.code || !root.contains(inst.el)) {
    if (inst) { try { inst.destroy(); } catch {} }
    inst = createCamera(root, ctx);
  }
  inst.update(ctx);
}

const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return ''; } };
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'Zeitüberschreitung')), ms))]);
const phaseName = (ctx, id) => { const ph = (ctx.data?.WH?.PHASES || []).find(p => p.id === id); return ph ? ph.name : (id || '–'); };

function loadTriggers() { try { return Object.assign({}, DEFAULT_TRIG, JSON.parse(localStorage.getItem(LS_TRIG) || '{}')); } catch { return { ...DEFAULT_TRIG }; } }
function saveTriggers(t) { try { localStorage.setItem(LS_TRIG, JSON.stringify(t)); } catch {} }

function createCamera(root, ctx0) {
  const code = ctx0.code;
  let ctx = ctx0;
  let net = ctx0.net;
  let stream = null, track = null, devices = [];
  let deviceId = (() => { try { return localStorage.getItem(LS_DEV) || ''; } catch { return ''; } })();
  let calib = null;               // { H, k1, rms, w, h, markers, frameCorners, updatedAt, source }
  let fileFrame = null;           // Canvas aus Datei (Test ohne Kamera)
  let prevState = ctx0.state || null;
  let pending = null;             // laufende/angesetzte Aufnahme
  let lastCapture = null;         // { id, ts, reason, w, h }
  let destroyed = false;
  let wakeLock = null;
  const triggers = loadTriggers();
  const logLines = [];

  root.innerHTML = `
    <div class="cam">
      <div class="topbar">
        <a class="btn ghost icon" href="#/" aria-label="Zur Lobby">←</a>
        <span class="title">Deckenkamera · ${esc(code)}</span>
        <span class="badge" data-online>offline</span>
        <span class="spacer"></span>
        <a class="btn ghost sm" href="#/g/${esc(code)}/photo" target="_blank" rel="noopener">Fotoansicht ↗</a>
        <a class="btn ghost sm" href="#/print/markers" target="_blank" rel="noopener">Marker drucken ↗</a>
      </div>
      <div class="cam-main">
        <div class="col">
          <div class="cam-preview" data-preview>
            <video autoplay muted playsinline data-video></video>
            <canvas class="cam-overlay" data-overlay></canvas>
            <div class="cam-res" data-res>–</div>
          </div>
          <div class="card cam-log-card"><div class="card-head"><span class="title">Protokoll</span><span class="spacer"></span><button class="btn ghost sm" data-action="clearlog">Leeren</button></div><div class="cam-log" data-log></div></div>
        </div>
        <div class="cam-side">
          <div class="card">
            <div class="card-head"><span class="title">Kamera</span></div>
            <div class="field mb"><label>Gerät</label><select data-devices><option value="">Standard (Rückkamera, 4K bevorzugt)</option></select></div>
            <div class="row">
              <button class="btn" data-action="start">Kamera starten</button>
              <button class="btn ghost" data-action="stop">Stopp</button>
              <label class="btn ghost" title="Testbild aus Datei (ohne Kamera)">Datei … <input type="file" accept="image/*" data-file hidden></label>
            </div>
          </div>
          <div class="card cam-actions-card">
            <div class="card-head"><span class="title">Aktionen</span></div>
            <div class="cam-actions">
              <button class="btn cta primary" data-action="capture">Foto jetzt</button>
              <button class="btn" data-action="calibrate">Kalibrieren</button>
              <button class="btn" data-action="check">Prüfen</button>
            </div>
          </div>
          <div class="card cam-status">
            <div class="card-head"><span class="title">Status</span></div>
            <dl data-status></dl>
          </div>
          <div class="card cam-triggers">
            <div class="card-head"><span class="title">Auto-Auslösung</span></div>
            ${[['battle', 'Aufstellung → Schlacht'], ['turn', 'Jeder Zugwechsel'], ['shooting', 'Bewegung → Schussphase'], ['fight', 'Angriff → Nahkampfphase'], ['signal', 'Signal „Foto jetzt“ von anderen Geräten']]
              .map(([k, l]) => `<label class="check"><input type="checkbox" data-trig="${k}" ${triggers[k] ? 'checked' : ''}> ${l}</label>`).join('')}
            <p class="muted xs mb" style="margin-top:6px">Nach dem Auslösen wartet die Kamera 1,5 s (Hände weg vom Tisch).</p>
          </div>
        </div>
      </div>
    </div>`;
  const el = root.firstElementChild;
  const q = sel => el.querySelector(sel);
  const video = q('[data-video]');
  const overlay = q('[data-overlay]');
  const preview = q('[data-preview]');

  /* ── Protokoll ── */
  function log(msg, kind = '') {
    logLines.unshift({ t: fmtTime(new Date().toISOString()), msg, kind });
    if (logLines.length > 40) logLines.length = 40;
    const box = q('[data-log]');
    if (box) box.innerHTML = logLines.map(l => `<div class="${esc(l.kind)}">${esc(l.t)}  ${esc(l.msg)}</div>`).join('');
  }

  /* ── Kamera ── */
  async function listDevices() {
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    } catch { devices = []; }
    const sel = q('[data-devices]');
    sel.innerHTML = `<option value="">Standard (Rückkamera, 4K bevorzugt)</option>` +
      devices.map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === deviceId ? ' selected' : ''}>${esc(d.label || 'Kamera ' + (i + 1))}</option>`).join('');
  }
  async function startStream() {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      showNoCam('getUserMedia nicht verfügbar – diesen Tab unter http://localhost:8417 öffnen (Secure Context).');
      return;
    }
    const videoC = { width: { ideal: 3840 }, height: { ideal: 2160 } };
    if (deviceId) videoC.deviceId = { exact: deviceId }; else videoC.facingMode = 'environment';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoC, audio: false });
    } catch (e) {
      if (deviceId) {            // Gerät weg → Standard
        deviceId = ''; try { localStorage.removeItem(LS_DEV); } catch {}
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false }); } catch (e2) { showNoCam('Kamera nicht verfügbar: ' + e2.message); return; }
      } else { showNoCam('Kamera nicht verfügbar: ' + e.message); return; }
    }
    track = stream.getVideoTracks()[0] || null;
    video.srcObject = stream;
    try { await video.play(); } catch {}
    const nc = preview.querySelector('.cam-nocam'); if (nc) nc.remove();
    video.style.display = '';
    await listDevices();
    const st = track?.getSettings?.() || {};
    log(`Kamera gestartet: ${track?.label || '?'} ${st.width || video.videoWidth}×${st.height || video.videoHeight}`, 'ok');
    updateRes();
    track?.addEventListener('ended', () => { log('Kamerastream beendet', 'warn'); updateRes(); });
    requestWakeLock();
  }
  function stopStream() {
    if (stream) { for (const t of stream.getTracks()) { try { t.stop(); } catch {} } }
    stream = null; track = null; video.srcObject = null;
    updateRes();
  }
  function showNoCam(msg) {
    log(msg, 'bad');
    video.style.display = 'none';
    let nc = preview.querySelector('.cam-nocam');
    if (!nc) { nc = document.createElement('div'); nc.className = 'cam-nocam'; preview.appendChild(nc); }
    nc.textContent = msg + ' – Alternativ: „Datei …“ für ein Testbild.';
  }
  function updateRes() {
    const r = q('[data-res]');
    if (stream && video.videoWidth) r.textContent = `${video.videoWidth}×${video.videoHeight}`;
    else if (fileFrame) r.textContent = `Datei ${fileFrame.width}×${fileFrame.height}`;
    else r.textContent = 'keine Kamera';
    renderStatus();
  }
  video.addEventListener('loadedmetadata', updateRes);
  video.addEventListener('resize', updateRes);

  async function requestWakeLock() {
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }
  const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
  document.addEventListener('visibilitychange', onVis);

  /** Vollbild-Frame als Canvas: ImageCapture.takePhoto (volle Sensorauflösung) oder Videobild; sonst Datei. */
  async function grabFrame() {
    if (stream && video.videoWidth) {
      let bitmap = null;
      if (track && typeof ImageCapture !== 'undefined') {
        try {
          const ic = new ImageCapture(track);
          const blob = await withTimeout(ic.takePhoto(), 5000, 'takePhoto Zeitüberschreitung');
          bitmap = await createImageBitmap(blob);
        } catch (e) { bitmap = null; }
      }
      const c = document.createElement('canvas');
      if (bitmap && bitmap.width >= video.videoWidth) { c.width = bitmap.width; c.height = bitmap.height; c.getContext('2d').drawImage(bitmap, 0, 0); }
      else { c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0); }
      if (bitmap) { try { bitmap.close(); } catch {} }
      return c;
    }
    if (fileFrame) return fileFrame;
    throw new Error('Kein Kamerabild – Kamera starten oder Datei wählen');
  }
  const toJpeg = canvas => new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('JPEG-Kodierung fehlgeschlagen'))), 'image/jpeg', 0.9));

  /* ── Aufnahme ── */
  function capture(reason) {
    if (pending) { log(`Aufnahme (${reason}) – bereits eine Aufnahme angesetzt`, 'warn'); return pending; }
    pending = (async () => {
      try {
        log(`Auslöser: ${reason} – warte 1,5 s …`);
        showCountdown(CAPTURE_DELAY);
        await new Promise(r => setTimeout(r, CAPTURE_DELAY));
        if (destroyed) return;
        const frame = await grabFrame();
        flash();
        const blob = await toJpeg(frame);
        const s = ctx.state || {};
        const photo = await net.uploadPhoto(blob, { by: 'camera', round: s.round, turn: s.turn, phase: s.phase });
        lastCapture = { id: photo.id, ts: photo.ts || new Date().toISOString(), reason, w: frame.width, h: frame.height, size: blob.size };
        log(`Foto #${photo.id} hochgeladen (${frame.width}×${frame.height}, ${(blob.size / 1024).toFixed(0)} kB)`, 'ok');
        if (calib && isH(calib.H)) {
          const H = rescale(calib.H, frame.width / calib.w, frame.height / calib.h);
          await net.updatePhoto(photo.id, { H, rms: calib.rms, k1: calib.k1 || 0, w: frame.width, h: frame.height });
          log(`Kalibrierung an Foto #${photo.id} angehängt (±${(calib.rms || 0).toFixed(2)}")`);
        } else {
          log('Keine Kalibrierung – Foto ohne H (Spieler können Ecken manuell antippen)', 'warn');
        }
      } catch (e) {
        log('Aufnahme fehlgeschlagen: ' + e.message, 'bad');
        toast('Aufnahme fehlgeschlagen: ' + e.message, 'bad');
      } finally {
        pending = null;
        renderStatus();
      }
    })();
    return pending;
  }
  function flash() { preview.classList.remove('flash'); void preview.offsetWidth; preview.classList.add('flash'); setTimeout(() => preview.classList.remove('flash'), 400); }
  function showCountdown(ms) {
    let cd = preview.querySelector('.cam-countdown');
    if (!cd) { cd = document.createElement('div'); cd.className = 'cam-countdown'; preview.appendChild(cd); }
    const end = Date.now() + ms;
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0 || destroyed) { cd.remove(); return; }
      cd.textContent = (left / 1000).toFixed(1);
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ── Kalibrierung laden/speichern ── */
  function loadLocalCalib() { try { return JSON.parse(localStorage.getItem(lsCalibKey(code)) || 'null'); } catch { return null; } }
  function acceptCalib(c, source) {
    if (!c || !isH(c.H) || !c.w || !c.h) return false;
    calib = { H: c.H, k1: Number(c.k1) || 0, rms: c.rms == null ? null : Number(c.rms), w: Number(c.w), h: Number(c.h), markers: c.markers || [], frameCorners: c.frameCorners || (calib?.frameCorners) || null, updatedAt: c.updatedAt || null, source };
    renderStatus();
    return true;
  }
  async function loadCalib() {
    const local = loadLocalCalib();
    try {
      const srv = await net.getCamera();
      if (srv && isH(srv.H)) {
        acceptCalib(Object.assign({}, srv, { frameCorners: local?.frameCorners }), 'server');
        log(`Kalibrierung vom Server (${fmtTime(srv.updatedAt)}, ±${(srv.rms || 0).toFixed(2)}")`);
        return;
      }
    } catch (e) { log('Kalibrierung vom Server nicht ladbar: ' + e.message, 'warn'); }
    if (local && acceptCalib(local, 'local')) {
      log('Kalibrierung aus localStorage');
      try { await net.setCamera({ H: local.H, k1: local.k1 || 0, rms: local.rms, markers: local.markers || [], w: local.w, h: local.h }); } catch {}
    } else log('Keine Kalibrierung vorhanden – bitte „Kalibrieren“', 'warn');
  }
  async function saveCalib(c) {
    calib = Object.assign({}, c, { updatedAt: new Date().toISOString(), source: 'local' });
    try { localStorage.setItem(lsCalibKey(code), JSON.stringify(calib)); } catch {}
    try {
      // Hinweis: der Server speichert H, k1, rms, markers, w, h (frameCorners bleiben lokal).
      const srv = await net.setCamera({ H: c.H, k1: c.k1 || 0, rms: c.rms, markers: c.markers || [], w: c.w, h: c.h, frameCorners: c.frameCorners, device: track?.label || null });
      calib.updatedAt = srv?.updatedAt || calib.updatedAt; calib.source = 'server';
      log(`Kalibrierung gespeichert (±${(c.rms || 0).toFixed(2)}", ${c.markers?.length || 0} Marker)`, 'ok');
      toast('Kalibrierung gespeichert', 'ok');
    } catch (e) {
      log('Kalibrierung nur lokal gespeichert: ' + e.message, 'warn');
      toast('Server nicht erreichbar – Kalibrierung nur lokal gespeichert', 'warn');
    }
    renderStatus();
  }

  /* ── Prüfen ── */
  async function check() {
    if (!calib) { toast('Keine Kalibrierung vorhanden – erst kalibrieren', 'warn'); return; }
    try {
      log('Prüfen: Bild aufnehmen und Marker erkennen …');
      const frame = await grabFrame();
      const markers = await detectMarkers(frame, { onProgress: m => log(m) });
      if (!markers.length) { toast('Keine Marker erkannt', 'warn'); log('Prüfen: keine Marker erkannt', 'warn'); return; }
      const cal = { H: rescale(calib.H, frame.width / calib.w, frame.height / calib.h), k1: calib.k1 || 0, w: frame.width, h: frame.height };
      const res = markerResiduals(cal, markers, MARKER_SIZE);
      const worst = Math.max(...res.map(r => r.maxDev));
      drawOverlay(frame, markers.map(m => Object.assign({}, m, { rms: res.find(r => r.id === m.id)?.rms, used: (res.find(r => r.id === m.id)?.maxDev || 0) <= 0.5 })));
      const kind = worst > 0.5 ? 'warn' : 'ok';
      log(`Prüfen: ${markers.length} Marker, größte Abweichung ${worst.toFixed(2)}"`, kind);
      sheet({
        title: worst > 0.5 ? 'Neu kalibrieren!' : 'Kalibrierung stimmt',
        cls: kind,
        body: `<p class="${worst > 0.5 ? 'text-warn' : 'text-ok'}"><b>Größte Abweichung ${worst.toFixed(2)}"</b> ${worst > 0.5 ? '– Tisch oder Kamera wurde bewegt. Bitte Marker auslegen und neu kalibrieren.' : '– alles im Rahmen (Grenze 0,5").'}</p>
          <table class="cam-marker-list" style="width:100%;border-collapse:collapse"><tr class="muted xs"><th align="left">Marker</th><th align="right">Seite</th><th align="right">RMS</th><th align="right">max.</th></tr>
          ${res.map(r => `<tr><td>${esc(r.id)}</td><td align="right">${r.side.toFixed(2)}"</td><td align="right">${r.rms.toFixed(2)}"</td><td align="right" class="${r.maxDev > 0.5 ? 'text-bad' : ''}">${r.maxDev.toFixed(2)}"</td></tr>`).join('')}</table>`,
        actions: worst > 0.5 ? [{ label: 'Später', kind: 'ghost' }, { label: 'Jetzt kalibrieren', kind: 'primary', onClick: () => { setTimeout(calibrate, 50); } }] : [{ label: 'OK', kind: 'primary' }]
      });
    } catch (e) { log('Prüfen fehlgeschlagen: ' + e.message, 'bad'); toast(e.message, 'bad'); }
  }
  function drawOverlay(frame, markers) {
    overlay.width = frame.width; overlay.height = frame.height;
    const c = overlay.getContext('2d');
    c.clearRect(0, 0, overlay.width, overlay.height);
    drawDetections(c, markers, 1, { lineWidth: Math.max(3, frame.width / 500), fontPx: Math.max(16, frame.width / 60) });
    overlay.style.display = '';
    setTimeout(() => { if (!destroyed) overlay.style.display = 'none'; }, 8000);
  }

  /* ── Kalibrieren ── */
  async function calibrate() {
    let frame;
    try { frame = await grabFrame(); } catch (e) { toast(e.message, 'bad'); return; }
    openCalibPanel(frame);
  }

  function openCalibPanel(frame0) {
    let frame = frame0;
    let markers = [], fit = null, pts = [], final = null, step = 1, busy = false;
    let miniMap = null;
    const panel = document.createElement('div');
    panel.className = 'cam-calib';
    document.body.appendChild(panel);
    const W = () => frame.width, H = () => frame.height;

    function close() { miniMap?.destroy(); panel.remove(); document.removeEventListener('keydown', onKey); }
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    function draw() {
      panel.innerHTML = `
        <div class="topbar">
          <button class="btn ghost icon" data-x aria-label="Abbrechen">✕</button>
          <span class="title">Kalibrieren · Schritt ${step}/3 – ${step === 1 ? 'Marker erkennen' : step === 2 ? 'Tischecken anklicken' : 'Prüfen & speichern'}</span>
          <span class="spacer"></span>
          ${step > 1 ? '<button class="btn ghost" data-back>Zurück</button>' : ''}
          ${step === 1 ? `<button class="btn" data-recapture ${busy ? 'disabled' : ''}>Neu aufnehmen</button><button class="btn primary" data-next ${!fit?.ok || busy ? 'disabled' : ''}>Weiter: Tischecken</button>` : ''}
          ${step === 2 ? `<button class="btn ghost sm" data-undo ${pts.length ? '' : 'disabled'}>Letzten Punkt löschen</button><button class="btn primary" data-next ${pts.length === 4 ? '' : 'disabled'}>Weiter: Prüfen</button>` : ''}
          ${step === 3 ? `<button class="btn primary" data-save ${final ? '' : 'disabled'}>Speichern</button>` : ''}
        </div>
        <div class="cam-calib-body">
          <div class="cam-calib-stage" data-stage></div>
          <div class="cam-calib-side" data-side></div>
        </div>`;
      panel.querySelector('[data-x]').onclick = close;
      panel.querySelector('[data-back]')?.addEventListener('click', () => { step -= 1; draw(); });
      panel.querySelector('[data-recapture]')?.addEventListener('click', async () => { try { frame = await grabFrame(); } catch (e) { toast(e.message, 'bad'); return; } markers = []; fit = null; draw(); });
      panel.querySelector('[data-next]')?.addEventListener('click', () => { step += 1; draw(); });
      panel.querySelector('[data-undo]')?.addEventListener('click', () => { pts.pop(); draw(); });
      panel.querySelector('[data-save]')?.addEventListener('click', async () => {
        if (!final) return;
        await saveCalib({ H: final.H, k1: fit.k1 || 0, rms: fit.rms, w: W(), h: H(), markers: markers.map(m => ({ id: m.id, size: m.size, corners: m.corners, used: fit.perMarker.find(p => p.id === m.id)?.used !== false })), frameCorners: pts.slice(), frameRms: final.frameRms, scale: final.scale });
        close();
      });
      if (step === 1) drawStep1(); else if (step === 2) drawStep2(); else drawStep3();
    }

    function stageCanvas(withOverlay) {
      const stage = panel.querySelector('[data-stage]');
      stage.innerHTML = `<div class="stage-inner"><canvas data-frame></canvas>${withOverlay ? `<svg class="cam-pick" viewBox="0 0 ${W()} ${H()}" preserveAspectRatio="none"></svg>` : ''}</div>`;
      const c = stage.querySelector('canvas');
      const maxW = 1920;
      const sc = Math.min(1, maxW / W());
      c.width = Math.round(W() * sc); c.height = Math.round(H() * sc);
      c.getContext('2d').drawImage(frame, 0, 0, c.width, c.height);
      return { canvas: c, scale: sc, svg: stage.querySelector('svg') };
    }

    async function drawStep1() {
      const { canvas, scale } = stageCanvas(false);
      const side = panel.querySelector('[data-side]');
      side.innerHTML = `<div class="card"><div class="card-head"><span class="title">Marker erkennen</span></div>
        <ol class="small"><li>4–6 gedruckte Marker (${MARKER_SIZE}") lose und <b>flach</b> auf dem Tisch verteilen (jeder Quadrant + Mitte).</li><li>Erkennung läuft automatisch; bei Bedarf „Neu aufnehmen“.</li></ol>
        <div data-progress class="muted small">Erkenne Marker …</div></div>
        <div class="card" data-result></div>`;
      if (!markers.length && !busy) {
        busy = true; draw.busy = true;
        try {
          markers = await detectMarkers(frame, { onProgress: m => { const p = panel.querySelector('[data-progress]'); if (p) p.textContent = m; } });
          fit = markers.length ? fitFromSquares(markers, MARKER_SIZE, { k1: true, width: W(), height: H() }) : null;
        } catch (e) { toast('Erkennung fehlgeschlagen: ' + e.message, 'bad'); log('Erkennung: ' + e.message, 'bad'); }
        busy = false;
        if (step === 1) { draw(); return; }
      }
      const p = panel.querySelector('[data-progress]');
      const res = panel.querySelector('[data-result]');
      if (!markers.length) {
        if (p) p.textContent = 'Keine Marker erkannt.';
        res.className = 'card warn'; res.innerHTML = `<div class="title">Keine Marker erkannt</div><p class="small">Licht, Schärfe und Abstand prüfen; Marker müssen vollständig im Bild sein (Version 1, 21 Module – aus 1,6 m Höhe mit 4K ≈ 12 px je Modul).</p>`;
        return;
      }
      if (p) p.textContent = `${markers.length} Marker erkannt.`;
      const ok = fit && fit.ok;
      res.className = 'card ' + (ok ? (fit.rms <= 0.15 ? 'ok' : 'warn') : 'bad');
      res.innerHTML = `<div class="card-head"><span class="title">Metrische Entzerrung</span><span class="badge ${ok ? (fit.rms <= 0.15 ? 'ok' : 'warn') : 'bad'}">${ok ? '±' + fit.rms.toFixed(2) + '"' : 'fehlgeschlagen'}</span></div>
        ${ok ? `<p class="small muted">${fit.used} von ${markers.length} Markern verwendet · k1 = ${(fit.k1 || 0).toFixed(4)} ${fit.used < 5 ? '(Linsenkorrektur ab 5 Markern)' : ''} · Anker ${esc(fit.anchor)}</p>` : `<p class="small">${esc(fit?.reason || 'Geometrie entartet')}</p>`}
        <div class="cam-marker-list">${(fit?.perMarker || markers.map(m => ({ id: m.id, rms: NaN, used: false }))).map(m => `<div class="row between"><span>${esc(m.id)} <span class="muted xs">${m.size || MARKER_SIZE}"</span></span><span class="${m.used ? '' : 'text-bad'}">${m.used ? '±' + m.rms.toFixed(3) + '"' : 'verworfen (' + (Number.isFinite(m.rms) ? m.rms.toFixed(2) + '"' : '–') + ')'}</span></div>`).join('')}</div>`;
      const c = canvas.getContext('2d');
      drawDetections(c, markers.map(m => Object.assign({}, m, { rms: fit?.perMarker.find(x => x.id === m.id)?.rms, used: fit?.perMarker.find(x => x.id === m.id)?.used })), scale, { lineWidth: Math.max(2, canvas.width / 600), fontPx: Math.max(14, canvas.width / 70) });
    }

    function drawStep2() {
      const { svg } = stageCanvas(true);
      const side = panel.querySelector('[data-side]');
      const names = ['1 · oben links', '2 · oben rechts', '3 · unten rechts', '4 · unten links'];
      side.innerHTML = `<div class="card"><div class="card-head"><span class="title">Tischecken anklicken</span></div>
        <p class="small">Die 4 Ecken der Spielfläche (44" × 60") <b>in dieser Reihenfolge</b> anklicken – so, wie das Spielfeld in der App liegt:
        <b>Angreifer-Kante = oben</b> (kurze 44"-Kante), Ursprung oben links.</p>
        <ol class="small">${names.map((n, i) => `<li class="${pts[i] ? 'text-ok' : i === pts.length ? '' : 'muted'}">${n}${pts[i] ? ' ✓' : i === pts.length ? ' ← jetzt' : ''}</li>`).join('')}</ol>
        <p class="muted xs">Punkte lassen sich nachträglich ziehen. Gemessen wird die Plattenkante auf Spielflächenhöhe.</p></div>`;
      const r = Math.max(6, W() / 150);
      function paint() {
        svg.innerHTML = (pts.length === 4 ? `<polygon class="frame" points="${pts.map(p => p.join(',')).join(' ')}"/>` : pts.length > 1 ? `<polyline class="frame" fill="none" points="${pts.map(p => p.join(',')).join(' ')}"/>` : '') +
          pts.map((p, i) => `<circle class="pt done" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="${r}"/><text class="pt-lbl" x="${p[0] + r * 1.3}" y="${p[1] - r * 0.6}" font-size="${r * 2.4}">${i + 1}</text>`).join('');
      }
      paint();
      const toImg = ev => { const b = svg.getBoundingClientRect(); return [Math.max(0, Math.min(W(), (ev.clientX - b.left) / b.width * W())), Math.max(0, Math.min(H(), (ev.clientY - b.top) / b.height * H()))]; };
      let drag = null;
      svg.addEventListener('pointerdown', ev => {
        const t = ev.target.closest?.('.pt');
        if (t) { drag = { i: Number(t.dataset.i), moved: false }; try { svg.setPointerCapture(ev.pointerId); } catch {} ev.preventDefault(); return; }
        if (pts.length < 4) { pts.push(toImg(ev)); if (pts.length === 4) draw(); else { paint(); drawStep2Side(); } }
      });
      svg.addEventListener('pointermove', ev => { if (!drag) return; pts[drag.i] = toImg(ev); drag.moved = true; paint(); });
      svg.addEventListener('pointerup', ev => { if (drag) { try { svg.releasePointerCapture(ev.pointerId); } catch {} drag = null; } });
      function drawStep2Side() { const items = side.querySelectorAll('li'); items.forEach((li, i) => { li.className = pts[i] ? 'text-ok' : i === pts.length ? '' : 'muted'; li.textContent = names[i] + (pts[i] ? ' ✓' : i === pts.length ? ' ← jetzt' : ''); }); panel.querySelector('[data-undo]').disabled = !pts.length; }
    }

    async function drawStep3() {
      const stage = panel.querySelector('[data-stage]');
      const side = panel.querySelector('[data-side]');
      try {
        final = frameFromCorners(fit.H, pts, { k1: fit.k1 || 0, w: W(), h: H() });
      } catch (e) { final = null; side.innerHTML = `<div class="card bad">${esc(e.message)}</div>`; return; }
      const saveBtn = panel.querySelector('[data-save]'); if (saveBtn) saveBtn.disabled = false;
      const scaleDev = Math.abs(final.scale - 1);
      const calibNew = { H: final.H, k1: fit.k1 || 0, w: W(), h: H() };
      const ppi = Math.max(4, Math.floor(Math.min((stage.clientWidth - 24) / (TABLE[0] + 4), (window.innerHeight - 160) / (TABLE[1] + 4))));
      stage.innerHTML = `<div class="cam-rect" style="width:${(TABLE[0] + 4) * ppi}px;height:${(TABLE[1] + 4) * ppi}px"><canvas class="warp" data-rect></canvas><div class="grid-overlay" data-grid style="left:${2 * ppi}px;top:${2 * ppi}px;width:${TABLE[0] * ppi}px;height:${TABLE[1] * ppi}px"></div></div>`;
      const out = stage.querySelector('[data-rect]');
      try {
        await renderRectified(frame, calibNew, { ppi, out, margin: 2 });
      } catch (e) { log('Entzerrte Vorschau fehlgeschlagen: ' + e.message, 'warn'); }
      const gridEl = stage.querySelector('[data-grid]');
      miniMap?.destroy();
      miniMap = createMap(gridEl, { fill: true, rot: 0, interactive: false, terrain: ctx.data?.TERRAIN_LAYOUTS || [] });
      miniMap.update(ctx.state, ctx.derived);
      gridEl.querySelector('.map')?.style.setProperty('background', 'transparent');
      side.innerHTML = `<div class="card ${scaleDev > 0.02 ? 'warn' : 'ok'}"><div class="card-head"><span class="title">Ergebnis</span><span class="badge ${fit.rms <= 0.15 ? 'ok' : 'warn'}">±${fit.rms.toFixed(2)}"</span></div>
        <dl class="cam-status-dl" style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0;font-size:14px">
          <dt class="muted">Marker</dt><dd>${fit.used} verwendet, RMS ${fit.rms.toFixed(3)}"</dd>
          <dt class="muted">Linse k1</dt><dd>${(fit.k1 || 0).toFixed(4)}</dd>
          <dt class="muted">Rahmen</dt><dd>Eckfehler ${final.frameRms.toFixed(2)}", Maßstab ${final.scale.toFixed(3)}${scaleDev > 0.02 ? ' <span class="text-warn">(≠ 1: Markergröße oder Tischmaß weicht ab)</span>' : ''}</dd>
          <dt class="muted">Bild</dt><dd>${W()}×${H()} px · ${(W() / 44 / final.scale).toFixed(0)} px/Zoll grob</dd>
        </dl>
        <p class="small mt">Die Draufsicht zeigt das Foto entzerrt; das Raster (6") und die Spielfeldkante müssen auf der Platte liegen. Wenn nicht: „Zurück“ und Ecken nachziehen.</p></div>`;
    }

    draw();
  }

  /* ── Status ── */
  function renderStatus() {
    const dl = q('[data-status]');
    if (!dl) return;
    const s = ctx.state || {};
    const st = track?.getSettings?.() || {};
    const items = [
      ['Verbindung', ctx.online ? '<span class="text-ok">online</span>' : '<span class="text-bad">offline</span>'],
      ['Kamera', stream ? `${esc(track?.label || 'aktiv')} · ${st.width || video.videoWidth}×${st.height || video.videoHeight}` : fileFrame ? `Datei ${fileFrame.width}×${fileFrame.height}` : '<span class="text-warn">keine</span>'],
      ['Spiel', `${esc(s.stage || '–')} · R${s.round ?? 0} Z${(s.turn ?? 0) + 1} · ${esc(phaseName(ctx, s.phase))}`],
      ['Letztes Foto', lastCapture ? `#${esc(lastCapture.id)} ${fmtTime(lastCapture.ts)} · ${esc(lastCapture.reason)} · ${lastCapture.w}×${lastCapture.h}` : '–'],
      ['Kalibrierung', calib ? `<span class="${(calib.rms || 0) <= 0.15 ? 'text-ok' : 'text-warn'}">±${(calib.rms || 0).toFixed(2)}"</span> · ${calib.markers?.length || 0} Marker · ${calib.w}×${calib.h} · k1 ${(calib.k1 || 0).toFixed(3)} · ${fmtTime(calib.updatedAt) || ''}` : '<span class="text-warn">nicht kalibriert</span>'],
      ['Aufnahme', pending ? '<span class="pulse">läuft …</span>' : 'bereit']
    ];
    dl.innerHTML = items.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const ob = q('[data-online]');
    if (ob) { ob.textContent = ctx.online ? 'online' : 'offline'; ob.className = 'badge ' + (ctx.online ? 'ok' : 'bad'); }
  }

  /* ── Ereignisse ── */
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'start') startStream();
    else if (a === 'stop') { stopStream(); log('Kamera gestoppt'); }
    else if (a === 'capture') capture('manuell');
    else if (a === 'calibrate') calibrate();
    else if (a === 'check') check();
    else if (a === 'clearlog') { logLines.length = 0; q('[data-log]').innerHTML = ''; }
  });
  q('[data-devices]').addEventListener('change', e => { deviceId = e.target.value; try { localStorage.setItem(LS_DEV, deviceId); } catch {} startStream(); });
  el.addEventListener('change', e => {
    const t = e.target.closest('[data-trig]');
    if (t) { triggers[t.dataset.trig] = t.checked; saveTriggers(triggers); log(`Auslöser „${t.dataset.trig}“ ${t.checked ? 'an' : 'aus'}`); }
  });
  q('[data-file]').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
      fileFrame = c;
      if (!stream) { video.style.display = 'none'; let nc = preview.querySelector('.cam-nocam'); if (!nc) { nc = document.createElement('div'); nc.className = 'cam-nocam'; preview.appendChild(nc); } nc.textContent = `Testbild: ${f.name} (${c.width}×${c.height})`; }
      log(`Testbild geladen: ${f.name} ${c.width}×${c.height}`);
      updateRes();
    } catch (err) { toast('Bild konnte nicht geladen werden', 'bad'); }
    e.target.value = '';
  });

  const unsubSignal = net.onSignal(sig => {
    if (!sig || destroyed) return;
    if (sig.type === 'capture') { if (triggers.signal) capture('Signal' + (sig.by != null ? ' von ' + sig.by : '')); else log('Signal „capture“ ignoriert (deaktiviert)', 'warn'); }
    else if (sig.type === 'camera' && sig.camera) {
      if (isH(sig.camera.H)) { if (!calib || sig.camera.updatedAt !== calib.updatedAt) { acceptCalib(Object.assign({}, sig.camera, { frameCorners: calib?.frameCorners }), 'server'); log('Kalibrierung vom Server aktualisiert'); } }
      else if (calib) { calib = null; renderStatus(); log('Kalibrierung auf dem Server gelöscht', 'warn'); }
    }
  });

  function update(nctx) {
    ctx = nctx; net = nctx.net || net;
    const s = nctx.state, p = prevState;
    if (s && p && s !== p && s.seq !== p.seq) {
      let why = null;
      if (p.stage === 'deploy' && s.stage === 'battle') why = triggers.battle ? 'Schlachtbeginn' : null;
      else if (s.stage === 'battle' && (p.round !== s.round || p.turn !== s.turn)) why = triggers.turn ? `Zugwechsel R${s.round} Z${(s.turn ?? 0) + 1}` : null;
      else if (s.stage === 'battle' && p.phase === 'movement' && s.phase === 'shooting') why = triggers.shooting ? 'Bewegung → Schussphase' : null;
      else if (s.stage === 'battle' && p.phase === 'charge' && s.phase === 'fight') why = triggers.fight ? 'Angriff → Nahkampfphase' : null;
      if (why) capture(why);
    }
    if (s) prevState = s;
    renderStatus();
  }
  function destroy() {
    destroyed = true;
    unsubSignal();
    stopStream();
    document.removeEventListener('visibilitychange', onVis);
    if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; }
    document.querySelectorAll('.cam-calib').forEach(n => n.remove());
  }

  // Start
  log(`Kamera-Tab für Spiel ${code} geöffnet (${location.origin})`);
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && location.protocol !== 'https:') log('Hinweis: Kamera-Zugriff braucht http://localhost:8417 oder HTTPS (SPEC §12, Variante A/B).', 'warn');
  loadCalib();
  listDevices().then(() => startStream());
  renderStatus();

  return { code, el, update, destroy };
}
