/* ═══════════════════════════════════════════════════════════════════
   Fotoansicht (js/ui/photo.js) – SPEC §11

   render(root, ctx)                      Route #/g/CODE/photo[/0|/1]  (me = Spielerindex oder 'desktop')
   createPhotoView(el, opts) → view       einbettbar (z. B. in player.js)
     opts = {
       net,                               createNet-Instanz (Fotoliste, Live-Updates, Signale)   – Pflicht
       me: 0 | 1 | 'desktop',             für place/Signale
       dispatch(action),                  für unit.place / objective.override
       state, derived, data,              Spielzustand (auch später über update())
       tool: 'measure' | 'range' | 'place' | 'control',   Startwerkzeug
       mode: 'photo' | 'rect',            Originalfoto mit Overlay | entzerrte Draufsicht
       rangeInches: 6, ppi: 14, margin: 2,
       camera: { H, k1, w, h, rms },      Kamera-Kalibrierung (sonst per net.getCamera())
       follow: true,                      neuestes Foto automatisch anzeigen
       onTool(tool), onMeasure({ from, to, dist }), onPhoto(photo)
     }
     view = { setPhoto(photo), setTool(tool), setMode(mode), update(state, derived), destroy(),
              getPhoto(), getCalib(), fit(), refresh() }
   renderRectified(source, calib, { ppi, out, margin }) → Promise<canvas>
     entzerrte Draufsicht (WebGL-Fragment-Shader inkl. k1; Fallback 16×16-Dreiecksnetz mit 2D-Canvas)

   Koordinaten: Tipp → Inhalt-px (Bildpixel bzw. Draufsicht-px) → Tischebene in Zoll (toPlane/fromPlane).
   Kalibrierung je Foto: photo.H (+k1, w, h) · sonst Kamera-Kalibrierung (auf Fotogröße skaliert) ·
   sonst „Nicht kalibriert“ + manuelles Antippen der 4 Tischecken (DLT auf 44×60).
   ═══════════════════════════════════════════════════════════════════ */
import { esc, toast, inch, playerLabel } from './components.js';
import { createMap, OBJ_RANGE } from './map.js';
import { toPlane, fromPlane, invert, rescale, isH, toCss, frameFromCorners, TABLE, TABLE_CORNERS } from '../geo/homography.js';

const TOOLS = [
  { id: 'measure', label: 'Messen', icon: '↔' },
  { id: 'range', label: 'Reichweite', icon: '◎' },
  { id: 'place', label: 'Setzen', icon: '⌖' },
  { id: 'control', label: 'Kontrolle', icon: '⚑' }
];
const MAP_K = 20;                 // px je Zoll für das Overlay-Element (Fotomodus)
const TAP_PX = 8;
const MAX_MEASURES = 5;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

/* ───────── Entzerrte Draufsicht ───────── */
let glCanvas = null, glState = null;
function initGL() {
  if (glState) return glState;
  glCanvas = document.createElement('canvas');
  const gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false }) || glCanvas.getContext('experimental-webgl');
  if (!gl) throw new Error('WebGL nicht verfügbar');
  const vs = `attribute vec2 a; varying vec2 v; void main(){ v = vec2((a.x+1.0)*0.5, (1.0-a.y)*0.5); gl_Position = vec4(a,0.0,1.0); }`;
  const fs = `precision highp float; varying vec2 v; uniform sampler2D t; uniform mat3 Hinv; uniform vec2 size; uniform float k1; uniform vec2 box; uniform vec2 ext;
    void main(){
      vec2 plane = box + v * ext;
      vec3 p = Hinv * vec3(plane, 1.0);
      vec2 px = p.xy / p.z;
      if (k1 != 0.0) {
        vec2 c = size * 0.5; float s = max(size.x, size.y) * 0.5;
        vec2 tgt = (px - c) / s; vec2 n = tgt;
        for (int i = 0; i < 8; i++) { float f = 1.0 + k1 * dot(n, n); n = tgt / f; }
        px = c + n * s;
      }
      vec2 uv = px / size;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 || p.z <= 0.0 && false) { gl_FragColor = vec4(0.07, 0.09, 0.1, 1.0); return; }
      gl_FragColor = texture2D(t, uv);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('WebGL-Programm: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const u = n => gl.getUniformLocation(prog, n);
  glState = { gl, prog, tex, u: { Hinv: u('Hinv'), size: u('size'), k1: u('k1'), box: u('box'), ext: u('ext'), t: u('t') }, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096, texKey: null };
  return glState;
}
function sourceSize(src) {
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) return [src.naturalWidth, src.naturalHeight];
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight];
  return [src.width, src.height];
}
/**
 * renderRectified(source, calib, { ppi = 14, out, margin = 2 }) → canvas (out oder neu)
 * Zeichnet das Bild entzerrt: Ausgabe (44 + 2·margin) × (60 + 2·margin) Zoll bei ppi px/Zoll.
 */
export async function renderRectified(source, calib, o = {}) {
  const ppi = o.ppi || 14, margin = o.margin != null ? o.margin : 2;
  const [TW, TH] = TABLE;
  const outW = Math.round((TW + 2 * margin) * ppi), outH = Math.round((TH + 2 * margin) * ppi);
  const out = o.out || document.createElement('canvas');
  out.width = outW; out.height = outH;
  if (!isH(calib?.H)) throw new Error('Keine Kalibrierung');
  let [sw, sh] = sourceSize(source);
  let src = source, cal = calib;
  if (!sw || !sh) throw new Error('Bild hat keine Größe');
  // Großes Bild ggf. auf Texturlimit verkleinern
  let gls = null;
  try { gls = initGL(); } catch (e) { gls = null; }
  const maxTex = gls ? gls.maxTex : 4096;
  if (Math.max(sw, sh) > maxTex) {
    const f = maxTex / Math.max(sw, sh);
    const c = document.createElement('canvas'); c.width = Math.round(sw * f); c.height = Math.round(sh * f);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    cal = { H: rescale(calib.H, c.width / sw, c.height / sh), k1: calib.k1 || 0, w: c.width, h: c.height };
    src = c; sw = c.width; sh = c.height;
  } else if (cal.w && cal.h && (cal.w !== sw || cal.h !== sh)) {
    cal = { H: rescale(calib.H, sw / cal.w, sh / cal.h), k1: calib.k1 || 0, w: sw, h: sh };
  } else cal = { H: calib.H, k1: calib.k1 || 0, w: sw, h: sh };

  if (gls) {
    try {
      const { gl, tex, u } = gls;
      glCanvas.width = outW; glCanvas.height = outH;
      gl.viewport(0, 0, outW, outH);
      gl.useProgram(gls.prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const Hinv = invert(cal.H);
      gl.uniformMatrix3fv(u.Hinv, false, new Float32Array([Hinv[0], Hinv[3], Hinv[6], Hinv[1], Hinv[4], Hinv[7], Hinv[2], Hinv[5], Hinv[8]]));
      gl.uniform2f(u.size, sw, sh);
      gl.uniform1f(u.k1, cal.k1 || 0);
      gl.uniform2f(u.box, -margin, -margin);
      gl.uniform2f(u.ext, TW + 2 * margin, TH + 2 * margin);
      gl.uniform1i(u.t, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const ctx = out.getContext('2d');
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(glCanvas, 0, 0);
      return out;
    } catch (e) { console.warn('WebGL-Entzerrung fehlgeschlagen, Fallback Dreiecksnetz', e); }
  }
  // Fallback: 16×16 Dreiecksnetz, affine Patches (ohne Linsenkorrektur innerhalb der Patches, Eckpunkte exakt)
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#12171b'; ctx.fillRect(0, 0, outW, outH);
  const N = 16;
  const bw = TW + 2 * margin, bh = TH + 2 * margin;
  const dst = [], srcP = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const px = -margin + (i / N) * bw, py = -margin + (j / N) * bh;
    dst.push([(px + margin) * ppi, (py + margin) * ppi]);
    srcP.push(fromPlane(cal, [px, py]));
  }
  const tri = (d0, d1, d2, s0, s1, s2) => {
    // Affine Abbildung s → d
    const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (!det || !Number.isFinite(det)) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
    const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
    const e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const ex = p => [p[0] + Math.sign(p[0] - cx) * 0.7, p[1] + Math.sign(p[1] - cy) * 0.7];   // Nahtlücken schließen
    ctx.save();
    ctx.beginPath();
    const q0 = ex(d0), q1 = ex(d1), q2 = ex(d2);
    ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
    ctx.setTransform(a, b, c, d, e, f);
    try { ctx.drawImage(src, 0, 0); } catch {}
    ctx.restore();
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * (N + 1) + i;
    tri(dst[k], dst[k + 1], dst[k + N + 1], srcP[k], srcP[k + 1], srcP[k + N + 1]);
    tri(dst[k + 1], dst[k + N + 2], dst[k + N + 1], srcP[k + 1], srcP[k + N + 2], srcP[k + N + 1]);
  }
  return out;
}

/* ───────── Ansicht ───────── */
export function createPhotoView(el, opts = {}) {
  const o = Object.assign({ tool: 'measure', mode: 'photo', rangeInches: 6, ppi: 14, margin: 2, follow: true, me: 'desktop' }, opts);
  const net = o.net;
  let state = o.state || null, derived = o.derived || {};
  let photos = [];
  let photo = null;              // aktuelles Foto (Metadaten)
  let natW = 0, natH = 0;        // Bildgröße
  let calib = null;              // { H, k1, w, h, rms, source: 'photo'|'camera'|'manual' }
  let camera = o.camera && isH(o.camera.H) ? o.camera : null;
  let mode = o.mode === 'rect' ? 'rect' : 'photo';
  let tool = TOOLS.some(t => t.id === o.tool) ? o.tool : 'measure';
  let rangeR = clamp(Number(o.rangeInches) || 6, 1, 24);
  let placing = null;            // unitId
  let corners = null;            // manuelle Ecken (Bildpixel) während der Eingabe
  let measureA = null;           // erster Messpunkt (Ebene) bei Zwei-Tipp-Messung
  let measures = [];             // [{ id, from, to, dist, by, mine, ts }]
  let ranges = [];               // [{ c, r }]
  let destroyed = false;
  let rectDirty = true;
  const zoom = { s: 1, tx: 0, ty: 0, fitted: false };
  let cw = 0, ch = 0;            // Inhaltsgröße (px)
  const ppi = o.ppi, margin = o.margin;
  const [TW, TH] = TABLE;

  el.classList.add('pv');
  el.innerHTML = `
    <div class="pv-head">
      <select class="pv-pick" data-pick aria-label="Foto wählen"><option value="">Kein Foto</option></select>
      <div class="pv-modes" role="group" aria-label="Darstellung">
        <button class="chip sm${mode === 'photo' ? ' on' : ''}" type="button" data-mode="photo">Foto</button>
        <button class="chip sm${mode === 'rect' ? ' on' : ''}" type="button" data-mode="rect">Draufsicht</button>
      </div>
      <button class="badge" type="button" data-calib title="Kalibrierung">–</button>
      <button class="btn ghost sm icon" type="button" data-action="fit" title="Einpassen" aria-label="Einpassen">⤢</button>
      <button class="btn ghost sm icon" type="button" data-action="shoot" title="Foto jetzt (Deckenkamera)" aria-label="Foto jetzt">📷</button>
    </div>
    <div class="pv-stage" data-stage>
      <div class="pv-zoom" data-zoom>
        <div class="pv-content" data-content>
          <img class="pv-img" data-img alt="Tischfoto" draggable="false">
          <canvas class="pv-rect" data-rect hidden></canvas>
          <div class="pv-mapwrap" data-mapwrap><div class="pv-map" data-map></div></div>
          <svg class="pv-draw" data-draw></svg>
        </div>
      </div>
      <div class="pv-empty" data-empty>Noch kein Foto – „Foto jetzt“ an der Deckenkamera oder im Kamera-Tab auslösen.</div>
      <div class="pv-big" data-big hidden></div>
      <div class="pv-hint" data-hint></div>
    </div>
    <div class="pv-tools sticky-bottom" data-tools></div>`;
  const q = s => el.querySelector(s);
  const stage = q('[data-stage]'), zoomEl = q('[data-zoom]'), content = q('[data-content]');
  const img = q('[data-img]'), rect = q('[data-rect]'), mapwrap = q('[data-mapwrap]'), draw = q('[data-draw]');
  const hint = q('[data-hint]'), big = q('[data-big]');
  const map = createMap(q('[data-map]'), { fill: true, rot: 0, interactive: false });
  if (state) map.update(state, derived);

  /* ── Koordinaten ── */
  const canPlane = () => !!(calib && isH(calib.H));
  function contentToPlane(p) {
    if (mode === 'rect') return [p[0] / ppi - margin, p[1] / ppi - margin];
    return canPlane() ? toPlane(calib, p) : null;
  }
  function planeToContent(p) {
    if (mode === 'rect') return [(p[0] + margin) * ppi, (p[1] + margin) * ppi];
    return canPlane() ? fromPlane(calib, p) : null;
  }
  function clientToContent(x, y) {
    const r = stage.getBoundingClientRect();
    return [(x - r.left - zoom.tx) / zoom.s, (y - r.top - zoom.ty) / zoom.s];
  }

  /* ── Zoom / Pan ── */
  function applyZoom() {
    zoomEl.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.s})`;
    draw.style.setProperty('--zoom', zoom.s);
  }
  function fit() {
    if (!cw || !ch) return;
    const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
    zoom.s = Math.min(sw / cw, sh / ch);
    zoom.tx = (sw - cw * zoom.s) / 2; zoom.ty = (sh - ch * zoom.s) / 2;
    zoom.fitted = true;
    applyZoom();
  }
  function zoomAt(factor, cx, cy) {
    const r = stage.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const minS = Math.min((stage.clientWidth || 1) / (cw || 1), (stage.clientHeight || 1) / (ch || 1)) * 0.5;
    const ns = clamp(zoom.s * factor, minS, 12);
    const k = ns / zoom.s;
    zoom.tx = px - (px - zoom.tx) * k; zoom.ty = py - (py - zoom.ty) * k; zoom.s = ns;
    applyZoom();
  }
  const pointers = new Map();
  let gesture = null;             // { kind: 'pan'|'pinch'|'measure'|'tap', ... }
  stage.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.pv-hint, .pv-big')) return;
    try { stage.setPointerCapture(ev.pointerId); } catch {}
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: [(a.x + b.x) / 2, (a.y + b.y) / 2], s0: zoom.s, tx0: zoom.tx, ty0: zoom.ty, moved: true };
      drawTemp(null);
      return;
    }
    const isPan = ev.button === 1 || ev.button === 2 || (ev.pointerType === 'mouse' && ev.ctrlKey);
    const c = clientToContent(ev.clientX, ev.clientY);
    gesture = { kind: tool === 'measure' && !isPan && !corners ? 'measure' : 'pan', id: ev.pointerId, start: [ev.clientX, ev.clientY], c0: c, tx0: zoom.tx, ty0: zoom.ty, moved: false };
    ev.preventDefault();
  });
  stage.addEventListener('pointermove', ev => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const r = stage.getBoundingClientRect();
      const k = clamp(gesture.s0 * (d / (gesture.d0 || 1)), 0.05, 12) / gesture.s0;
      const px0 = gesture.mid0[0] - r.left, py0 = gesture.mid0[1] - r.top;
      zoom.s = gesture.s0 * k;
      zoom.tx = (mid[0] - r.left) - (px0 - gesture.tx0) * k;
      zoom.ty = (mid[1] - r.top) - (py0 - gesture.ty0) * k;
      applyZoom();
      return;
    }
    if (gesture.id !== ev.pointerId) return;
    const dx = ev.clientX - gesture.start[0], dy = ev.clientY - gesture.start[1];
    if (!gesture.moved && Math.hypot(dx, dy) < TAP_PX) return;
    gesture.moved = true;
    if (gesture.kind === 'pan') { zoom.tx = gesture.tx0 + dx; zoom.ty = gesture.ty0 + dy; applyZoom(); }
    else if (gesture.kind === 'measure') {
      const c = clientToContent(ev.clientX, ev.clientY);
      const A = contentToPlane(gesture.c0), B = contentToPlane(c);
      drawTemp(A && B ? { from: A, to: B } : null);
    }
    ev.preventDefault();
  });
  const endPointer = ev => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.delete(ev.pointerId);
    try { stage.releasePointerCapture(ev.pointerId); } catch {}
    const g = gesture;
    if (!g) return;
    if (g.kind === 'pinch') { if (pointers.size === 0) gesture = null; return; }
    if (g.id !== ev.pointerId) return;
    gesture = null;
    if (ev.type === 'pointercancel') { drawTemp(null); return; }
    if (!g.moved) { onTap(clientToContent(ev.clientX, ev.clientY)); return; }
    if (g.kind === 'measure') {
      drawTemp(null);
      const A = contentToPlane(g.c0), B = contentToPlane(clientToContent(ev.clientX, ev.clientY));
      if (A && B) addMeasure(A, B);
    }
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('wheel', ev => { ev.preventDefault(); zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX, ev.clientY); }, { passive: false });
  stage.addEventListener('contextmenu', ev => ev.preventDefault());
  stage.addEventListener('dblclick', ev => { ev.preventDefault(); fit(); });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!destroyed && !zoom.fitted) fit(); }) : null;
  ro?.observe(stage);

  /* ── Werkzeuge ── */
  function onTap(c) {
    if (corners) {                                           // manuelle Tischecken
      if (mode !== 'photo') { setMode('photo'); }
      corners.push([clamp(c[0], 0, natW), clamp(c[1], 0, natH)]);
      if (corners.length === 4) finishCorners(); else { renderDraw(); updateHint(); }
      return;
    }
    const p = contentToPlane(c);
    if (!p) { toast('Nicht kalibriert – zuerst die Tischecken antippen', 'warn'); startCorners(); return; }
    if (tool === 'measure') {
      if (!measureA) { measureA = p; renderDraw(); updateHint(); }
      else { const A = measureA; measureA = null; addMeasure(A, p); }
    } else if (tool === 'range') {
      ranges = [{ c: p, r: rangeR }];
      renderDraw();
    } else if (tool === 'place') {
      if (!placing) { toast('Erst eine Einheit wählen', 'warn'); return; }
      if (typeof o.me !== 'number') { toast('Nur als Spieler möglich', 'warn'); return; }
      const u = myUnits().find(x => x.id === placing);
      const r = Math.max(0.5, +u?.r || 1);
      const pos = { x: +clamp(p[0], r, TW - r).toFixed(2), y: +clamp(p[1], r, TH - r).toFixed(2) };
      if (typeof o.dispatch === 'function') {
        const res = o.dispatch({ type: 'unit.place', player: o.me, unitId: placing, pos });
        Promise.resolve(res).then(st => { if (st !== null) toast(`${u?.name || placing} gesetzt auf ${fmt(pos.x)}" / ${fmt(pos.y)}"`, 'ok', 1500); });
      }
      ranges = []; renderDraw();
    } else if (tool === 'control') {
      const ob = nearestObjective(p);
      if (!ob) { toast('Kein Missionsziel in der Nähe – näher am Marker tippen', 'warn'); return; }
      const cycle = [null, 0, 1, 'none'];
      const next = cycle[(cycle.indexOf(ob.override === undefined ? null : ob.override) + 1) % cycle.length];
      if (typeof o.dispatch === 'function') o.dispatch({ type: 'objective.override', objectiveId: ob.id, override: next });
      const lbl = next === null ? 'automatisch' : next === 'none' ? 'niemand' : playerLabel(state, next);
      toast(`${ob.id}: Kontrolle → ${lbl}`, '', 1500);
    }
  }
  function nearestObjective(p) {
    let best = null, bd = Infinity;
    for (const ob of state?.objectives || []) {
      const pos = Array.isArray(ob.pos) ? ob.pos : [ob.pos?.x, ob.pos?.y];
      const d = Math.hypot(p[0] - pos[0], p[1] - pos[1]);
      if (d < bd) { bd = d; best = ob; }
    }
    return best && bd <= OBJ_RANGE + 1 ? best : null;
  }
  function myUnits() {
    if (typeof o.me !== 'number') return [];
    return (state?.players?.[o.me]?.units || []).filter(u => u.status !== 'destroyed');
  }
  function addMeasure(A, B, by = o.me, mine = true, id = uid()) {
    const dist = +Math.hypot(A[0] - B[0], A[1] - B[1]).toFixed(2);
    measures.unshift({ id, from: A, to: B, dist, by, mine, ts: Date.now() });
    if (measures.length > MAX_MEASURES) measures.length = MAX_MEASURES;
    renderDraw(); renderToolExtra(); showBig(`${fmt(dist)}"` + (mine ? '' : ` · ${byLabel(by)}`));
    if (mine) {
      if (typeof o.onMeasure === 'function') o.onMeasure({ from: A, to: B, dist });
      if (net?.signal) net.signal({ type: 'measure', id, from: A, to: B, dist, by: o.me, photo: photo?.id });
    }
  }
  function byLabel(by) { return typeof by === 'number' ? playerLabel(state, by) : by === 'desktop' ? 'Desktop' : String(by || '?'); }
  let bigTimer = 0;
  function showBig(text) {
    big.textContent = text; big.hidden = false;
    clearTimeout(bigTimer); bigTimer = setTimeout(() => { big.hidden = true; }, 6000);
  }

  /* ── Manuelle Ecken ── */
  function startCorners() {
    if (!photo || !natW) return;
    corners = []; measureA = null; setMode('photo'); renderDraw(); updateHint();
  }
  async function finishCorners() {
    const pts = corners; corners = null;
    try {
      const fr = frameFromCorners(null, pts);
      calib = { H: fr.H, k1: 0, w: natW, h: natH, rms: null, source: 'manual' };
      rectDirty = true;
      applyCalib();
      toast('Tischecken gesetzt – Messungen beziehen sich auf die Tischebene', 'ok');
      if (net?.updatePhoto && photo) {
        try { await net.updatePhoto(photo.id, { H: fr.H, k1: 0, w: natW, h: natH, rms: null }); } catch (e) { toast('Kalibrierung nicht gespeichert: ' + e.message, 'warn'); }
      }
    } catch (e) { toast('Ecken ungültig: ' + e.message, 'bad'); }
    updateHint();
  }

  /* ── Zeichnen ── */
  function renderDraw() {
    if (!cw || !ch) { draw.innerHTML = ''; return; }
    draw.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    draw.setAttribute('width', cw); draw.setAttribute('height', ch);
    const parts = [];
    const pt = p => planeToContent(p);
    const line = (A, B, cls, label) => {
      const a = pt(A), b = pt(B);
      if (!a || !b) return;
      parts.push(`<line class="m-line ${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><circle class="m-dot ${cls}" cx="${a[0]}" cy="${a[1]}"/><circle class="m-dot ${cls}" cx="${b[0]}" cy="${b[1]}"/>`);
      if (label) parts.push(`<text class="m-lbl ${cls}" x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}" dy="-0.6em">${esc(label)}</text>`);
    };
    measures.slice().reverse().forEach((m, i, arr) => line(m.from, m.to, (m.mine ? 'mine' : 'other') + (i === arr.length - 1 ? ' last' : ''), `${fmt(m.dist)}"${m.mine ? '' : ' ' + byLabel(m.by)}`));
    for (const r of ranges) {
      const pts = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const c = pt([r.c[0] + r.r * Math.cos(a), r.c[1] + r.r * Math.sin(a)]); if (c) pts.push(c.join(',')); }
      const c = pt(r.c);
      if (pts.length === 64 && c) parts.push(`<polygon class="m-range" points="${pts.join(' ')}"/><circle class="m-dot mine" cx="${c[0]}" cy="${c[1]}"/><text class="m-lbl mine" x="${c[0]}" y="${c[1]}" dy="-0.6em">${fmt(r.r)}"</text>`);
    }
    if (measureA) { const a = pt(measureA); if (a) parts.push(`<circle class="m-dot mine pulse" cx="${a[0]}" cy="${a[1]}"/>`); }
    if (corners && mode === 'photo') {
      corners.forEach((c, i) => parts.push(`<circle class="m-corner" cx="${c[0]}" cy="${c[1]}"/><text class="m-lbl corner" x="${c[0]}" y="${c[1]}" dx="0.8em" dy="-0.4em">${i + 1}</text>`));
      if (corners.length > 1) parts.push(`<polyline class="m-frame" points="${corners.map(c => c.join(',')).join(' ')}"/>`);
    }
    draw.innerHTML = parts.join('');
  }
  let tempEl = null;
  function drawTemp(m) {
    if (!m) { if (tempEl) { tempEl.remove(); tempEl = null; } big.hidden = big.hidden; return; }
    const a = planeToContent(m.from), b = planeToContent(m.to);
    if (!a || !b) return;
    const d = Math.hypot(m.from[0] - m.to[0], m.from[1] - m.to[1]);
    if (!tempEl) { tempEl = document.createElementNS('http://www.w3.org/2000/svg', 'g'); draw.appendChild(tempEl); }
    tempEl.innerHTML = `<line class="m-line mine temp" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><circle class="m-dot mine" cx="${a[0]}" cy="${a[1]}"/><text class="m-lbl mine" x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}" dy="-0.6em">${fmt(d)}"</text>`;
    showBig(`${fmt(d)}"`);
  }

  /* ── Darstellung ── */
  function applyCalib() {
    const badge = q('[data-calib]');
    if (calib && isH(calib.H)) {
      const r = calib.rms;
      const src = calib.source === 'camera' ? 'Kamera' : calib.source === 'manual' ? 'manuell' : 'Foto';
      badge.textContent = `${src}${Number.isFinite(r) ? ' ±' + r.toFixed(2).replace('.', ',') + '"' : ''}`;
      badge.className = 'badge ' + (Number.isFinite(r) ? (r <= 0.25 ? 'ok' : 'warn') : 'ok');
      badge.title = 'Kalibrierung · tippen: Tischecken neu antippen';
    } else {
      badge.textContent = 'Nicht kalibriert'; badge.className = 'badge bad'; badge.title = 'Tippen: Tischecken antippen';
    }
    layoutContent();
    updateHint();
  }
  function layoutContent() {
    if (!photo || !natW) { content.style.width = content.style.height = '0px'; return; }
    if (mode === 'photo') {
      cw = natW; ch = natH;
      img.hidden = false; rect.hidden = true;
      mapwrap.style.width = `${TW * MAP_K}px`; mapwrap.style.height = `${TH * MAP_K}px`;
      mapwrap.style.left = '0'; mapwrap.style.top = '0';
      if (canPlane()) { mapwrap.hidden = false; mapwrap.style.transform = toCss(calib.H, natW, natH, { elem: [TW * MAP_K, TH * MAP_K], display: [natW, natH] }); }
      else mapwrap.hidden = true;
    } else {
      cw = Math.round((TW + 2 * margin) * ppi); ch = Math.round((TH + 2 * margin) * ppi);
      img.hidden = true; rect.hidden = false;
      mapwrap.hidden = !canPlane();
      mapwrap.style.transform = 'none';
      mapwrap.style.left = `${margin * ppi}px`; mapwrap.style.top = `${margin * ppi}px`;
      mapwrap.style.width = `${TW * ppi}px`; mapwrap.style.height = `${TH * ppi}px`;
      if (rectDirty && canPlane()) {
        rectDirty = false;
        renderRectified(img, calib, { ppi, out: rect, margin }).catch(e => { toast('Draufsicht: ' + e.message, 'bad'); });
      } else if (!canPlane()) { rect.width = cw; rect.height = ch; const c = rect.getContext('2d'); c.fillStyle = '#12171b'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#8E9BA6'; c.font = `${ppi * 1.2}px sans-serif`; c.textAlign = 'center'; c.fillText('Nicht kalibriert', cw / 2, ch / 2); }
    }
    content.style.width = `${cw}px`; content.style.height = `${ch}px`;
    if (!zoom.fitted) fit();
    renderDraw();
  }
  function setMode(m) {
    if (m !== 'photo' && m !== 'rect') return;
    if (m === mode) return;
    mode = m;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    zoom.fitted = false;
    layoutContent();
    updateHint();
  }
  function updateHint() {
    let t = '';
    if (corners) t = `Tischecke ${corners.length + 1} von 4 antippen: ${['oben links (Angreifer-Kante)', 'oben rechts', 'unten rechts', 'unten links'][corners.length]}`;
    else if (!photo) t = '';
    else if (!canPlane()) t = 'Nicht kalibriert – auf das rote Badge tippen und die 4 Tischecken antippen';
    else if (tool === 'measure') t = measureA ? 'Zweiten Punkt antippen' : 'Zwei Punkte antippen oder ziehen · an der Basis der Modelle messen';
    else if (tool === 'range') t = `Antippen: Kreis mit ${fmt(rangeR)}" Radius`;
    else if (tool === 'place') t = placing ? `${myUnits().find(u => u.id === placing)?.name || placing}: auf die Basis der Einheit tippen` : 'Einheit unten wählen, dann aufs Foto tippen';
    else if (tool === 'control') t = 'Missionsziel antippen: automatisch → Spieler 1 → Spieler 2 → niemand';
    hint.textContent = t; hint.hidden = !t;
  }

  /* ── Werkzeugleiste ── */
  function renderTools() {
    const bar = q('[data-tools]');
    const tools = TOOLS.filter(t => t.id !== 'place' || typeof o.me === 'number');
    bar.innerHTML = `<div class="pv-toolrow">${tools.map(t => `<button class="chip${tool === t.id ? ' on' : ''}" type="button" data-tool="${t.id}"><span aria-hidden="true">${t.icon}</span> ${t.label}</button>`).join('')}</div><div class="pv-toolextra" data-extra></div>`;
    renderToolExtra();
  }
  let unitsKey = '';
  function renderToolExtra() {
    const ex = q('[data-extra]');
    if (!ex) return;
    if (tool === 'measure') {
      ex.innerHTML = measures.length
        ? `<div class="pv-measures">${measures.map(m => `<span class="chip sm${m.mine ? '' : ' other'}" title="${esc(byLabel(m.by))}">${fmt(m.dist)}"${m.mine ? '' : ' · ' + esc(byLabel(m.by))}</span>`).join('')}<button class="btn ghost sm" type="button" data-action="clear">Löschen</button></div>`
        : `<span class="muted small">Letzte 5 Messungen erscheinen hier – auch die der anderen Geräte.</span>`;
    } else if (tool === 'range') {
      ex.innerHTML = `<div class="row"><span class="label" style="margin:0">Radius</span><div class="stepper sm"><button type="button" data-action="r-" aria-label="kleiner">−</button><span class="stepper-value">${fmt(rangeR)}"</span><button type="button" data-action="r+" aria-label="größer">+</button></div>
        <div class="chips">${[3, 6, 9, 12, 24].map(v => `<button class="chip sm${rangeR === v ? ' on' : ''}" type="button" data-r="${v}">${v}"</button>`).join('')}</div></div>`;
    } else if (tool === 'place') {
      const units = myUnits();
      unitsKey = units.map(u => `${u.id}:${u.pos ? 1 : 0}:${u.models}`).join('|');
      if (placing && !units.some(u => u.id === placing)) placing = null;
      ex.innerHTML = `<div class="row nowrap"><select data-unit aria-label="Einheit"><option value="">Einheit wählen …</option>${units.map(u => `<option value="${esc(u.id)}"${placing === u.id ? ' selected' : ''}>${esc(u.name)} · ${u.models}${u.pos ? '' : ' · nicht auf dem Feld'}${u.reserve && u.reserve !== 'none' ? ' · Reserve' : ''}</option>`).join('')}</select></div>`;
    } else if (tool === 'control') {
      const objs = state?.objectives || [];
      ex.innerHTML = `<div class="chips">${objs.map(ob => { const c = derived?.control?.[ob.id]?.ctrl ?? ob.ctrl; const ov = ob.override; return `<span class="chip sm ${c === 0 ? 'p0 on' : c === 1 ? 'p1 on' : ''}" title="${ov == null ? 'automatisch' : 'übersteuert'}">${esc(ob.id)}${ov != null ? ' ✎' : ''}</span>`; }).join('') || '<span class="muted small">Keine Missionsziele</span>'}</div>`;
    }
  }
  function setTool(t) {
    if (!TOOLS.some(x => x.id === t)) return;
    tool = t; measureA = null; corners = null;
    if (t !== 'range') ranges = [];
    el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    renderToolExtra(); renderDraw(); updateHint();
    if (typeof o.onTool === 'function') o.onTool(t);
  }
  el.addEventListener('click', ev => {
    const t = ev.target.closest('[data-tool], [data-action], [data-mode], [data-r], [data-calib]');
    if (!t || !el.contains(t)) return;
    if (t.dataset.tool) setTool(t.dataset.tool);
    else if (t.dataset.mode) setMode(t.dataset.mode);
    else if (t.dataset.r) { rangeR = Number(t.dataset.r); if (ranges[0]) ranges[0].r = rangeR; renderToolExtra(); renderDraw(); updateHint(); }
    else if (t.hasAttribute('data-calib')) { if (photo) { if (corners) { corners = null; renderDraw(); updateHint(); } else startCorners(); } }
    else if (t.dataset.action === 'fit') { fit(); }
    else if (t.dataset.action === 'shoot') { if (net?.signal) { net.signal({ type: 'capture', by: o.me }); toast('Foto angefordert – Hände weg vom Tisch', '', 1800); } }
    else if (t.dataset.action === 'clear') { measures = measures.filter(m => !m.mine); renderToolExtra(); renderDraw(); }
    else if (t.dataset.action === 'r-' || t.dataset.action === 'r+') { rangeR = clamp(rangeR + (t.dataset.action === 'r+' ? 1 : -1), 1, 24); if (ranges[0]) ranges[0].r = rangeR; renderToolExtra(); renderDraw(); updateHint(); }
  });
  el.addEventListener('change', ev => {
    if (ev.target.matches('[data-unit]')) { placing = ev.target.value || null; updateHint(); }
    else if (ev.target.matches('[data-pick]')) { const p = photos.find(x => String(x.id) === ev.target.value); if (p) setPhoto(p, true); }
  });

  /* ── Fotos ── */
  function photoLabel(p) {
    const ph = (o.data?.WH?.PHASES || []).find(x => x.id === p.phase);
    const by = p.by === 'camera' ? 'Kamera' : typeof p.by === 'number' ? playerLabel(state, p.by) : (p.by || '');
    let t = ''; try { t = new Date(p.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch {}
    return `#${p.id} · R${p.round ?? '–'} Z${p.turn != null ? p.turn + 1 : '–'} ${ph ? ph.name : (p.phase || '')} · ${t}${by ? ' · ' + by : ''}`;
  }
  function renderPicker() {
    const sel = q('[data-pick]');
    const list = photos.slice().sort((a, b) => Number(b.id) - Number(a.id));
    sel.innerHTML = list.length ? list.map(p => `<option value="${esc(p.id)}"${photo && p.id === photo.id ? ' selected' : ''}>${esc(photoLabel(p))}</option>`).join('') : '<option value="">Kein Foto</option>';
    q('[data-empty]').hidden = !!photo;
  }
  function calibFor(p) {
    if (p && isH(p.H) && natW) {
      const pw = Number(p.w) || natW, ph = Number(p.h) || natH;
      return { H: pw === natW && ph === natH ? p.H : rescale(p.H, natW / pw, natH / ph), k1: Number(p.k1) || 0, w: natW, h: natH, rms: p.rms == null ? NaN : Number(p.rms), source: 'photo' };
    }
    if (camera && isH(camera.H) && natW && camera.w && camera.h) {
      return { H: rescale(camera.H, natW / camera.w, natH / camera.h), k1: Number(camera.k1) || 0, w: natW, h: natH, rms: camera.rms == null ? NaN : Number(camera.rms), source: 'camera' };
    }
    return null;
  }
  let loadSeq = 0;
  function setPhoto(p, manual = false) {
    if (!p) { photo = null; natW = natH = 0; img.removeAttribute('src'); renderPicker(); layoutContent(); updateHint(); return; }
    const same = photo && photo.id === p.id;
    photo = p;
    if (!photos.some(x => x.id === p.id)) photos.push(p);
    if (manual) o.follow = String(p.id) === String(latestId());
    renderPicker();
    if (same && natW) { calib = calibFor(p); rectDirty = true; applyCalib(); return; }
    const my = ++loadSeq;
    natW = natH = 0; calib = null; corners = null; measureA = null; ranges = [];
    img.onload = () => {
      if (my !== loadSeq) return;
      natW = img.naturalWidth; natH = img.naturalHeight;
      calib = calibFor(photo); rectDirty = true;              // photo (nicht p): Metadaten können inzwischen per SSE aktualisiert sein
      zoom.fitted = false;
      applyCalib(); updateHint();
      if (typeof o.onPhoto === 'function') o.onPhoto(p);
    };
    img.onerror = () => { if (my === loadSeq) toast('Foto konnte nicht geladen werden', 'bad'); };
    img.src = p.url || (net ? net.photoUrl(p.id) : '');
  }
  const latestId = () => photos.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  async function loadList() {
    if (!net?.listPhotos) return;
    try {
      photos = (await net.listPhotos()) || [];
    } catch (e) { toast('Fotos konnten nicht geladen werden: ' + e.message, 'warn'); photos = []; }
    if (destroyed) return;
    renderPicker();
    const latest = photos.find(p => Number(p.id) === latestId());
    if (latest && (!photo || o.follow)) setPhoto(latest);
  }
  async function loadCamera() {
    if (camera || !net?.getCamera) return;
    try { const c = await net.getCamera(); if (c && isH(c.H)) { camera = c; if (photo && natW && (!calib || calib.source === 'camera')) { calib = calibFor(photo); rectDirty = true; applyCalib(); } } } catch {}
  }
  const unsubs = [];
  if (net?.onPhoto) unsubs.push(net.onPhoto(ev => {
    if (destroyed || !ev || !ev.photo) return;
    const p = ev.photo;
    if (ev.kind === 'delete') { photos = photos.filter(x => x.id !== p.id); if (photo && photo.id === p.id) { photo = null; loadList(); } else renderPicker(); return; }
    const i = photos.findIndex(x => x.id === p.id);
    if (i >= 0) photos[i] = p; else photos.push(p);
    if (ev.kind === 'new') { if (o.follow || !photo) setPhoto(p); else { renderPicker(); toast('Neues Foto #' + p.id, '', 1500); } }
    else if (photo && photo.id === p.id) { photo = p; if (natW && (!calib || calib.source !== 'manual' || isH(p.H))) { calib = calibFor(p); rectDirty = true; applyCalib(); } renderPicker(); }
    else renderPicker();
  }));
  if (net?.onSignal) unsubs.push(net.onSignal(sig => {
    if (destroyed || !sig) return;
    if (sig.type === 'measure' && sig.from && sig.to) {
      if (measures.some(m => m.id === sig.id)) return;        // eigenes Echo
      addMeasure(sig.from, sig.to, sig.by, false, sig.id || uid());
    } else if (sig.type === 'camera' && sig.camera) {
      camera = isH(sig.camera.H) ? sig.camera : null;
      if (photo && natW && (!calib || calib.source === 'camera')) { calib = calibFor(photo); rectDirty = true; applyCalib(); }
    }
  }));

  function update(s, d) {
    if (destroyed) return;
    state = s || state; derived = d || derived;
    map.update(state, derived);
    if (tool === 'place') { const k = myUnits().map(u => `${u.id}:${u.pos ? 1 : 0}:${u.models}`).join('|'); if (k !== unitsKey) renderToolExtra(); }
    else if (tool === 'control') renderToolExtra();
  }
  function destroy() {
    destroyed = true;
    for (const u of unsubs) { try { u(); } catch {} }
    ro?.disconnect();
    map.destroy();
    clearTimeout(bigTimer);
    el.innerHTML = ''; el.classList.remove('pv');
  }

  renderTools(); updateHint(); applyZoom();
  loadList(); loadCamera();

  return {
    setPhoto, setTool, setMode, update, destroy, fit,
    getPhoto: () => photo, getCalib: () => calib, getTool: () => tool,
    refresh: () => { rectDirty = true; layoutContent(); }
  };
}

/* ───────── Route #/g/CODE/photo ───────── */
let inst = null;
export function render(root, ctx) {
  if (!inst || inst.code !== ctx.code || inst.me !== ctx.me || !root.contains(inst.el)) {
    if (inst) { try { inst.view.destroy(); } catch {} }
    root.innerHTML = `
      <div class="photo-page">
        <div class="topbar">
          <a class="btn ghost icon" href="${esc(typeof ctx.me === 'number' ? `#/g/${ctx.code}/p/${ctx.me}` : `#/g/${ctx.code}/desktop`)}" aria-label="Zurück">←</a>
          <span class="title">Tischfoto · ${esc(ctx.code)}</span>
          <span class="spacer"></span>
          <span class="badge ${typeof ctx.me === 'number' ? 'p' + ctx.me : ''}" style="--pc:var(--p${typeof ctx.me === 'number' ? ctx.me : 0})">${esc(typeof ctx.me === 'number' ? playerLabel(ctx.state, ctx.me) : 'Desktop')}</span>
        </div>
        <div class="photo-view" data-view></div>
      </div>`;
    const el = root.querySelector('[data-view]');
    const view = createPhotoView(el, { net: ctx.net, me: ctx.me, dispatch: ctx.dispatch, state: ctx.state, derived: ctx.derived, data: ctx.data });
    inst = { code: ctx.code, me: ctx.me, el: root.firstElementChild, view };
    if (typeof window !== 'undefined') window.sb40kPhoto = view;      // Debugging in der Konsole
  }
  inst.view.update(ctx.state, ctx.derived);
}
