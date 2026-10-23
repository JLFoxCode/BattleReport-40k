/* Passthrough camera of the Quest 3 in the browser: after the site's camera permission the Quest browser lists the
 * two passthrough cameras as "camera 1 / camera 2, facing back" (the "facing front" one is Meta's virtual avatar
 * camera – useless). getUserMedia on a back camera gives up to 1280×1280 @ 30 fps and keeps streaming inside the
 * immersive session (verified 2026-10-23). This module grabs frames, downsamples them and detects the printed
 * ArUco (ARUCO_MIP_36h12) corner markers (vr/print/table-markers-10x15.pdf) with js-aruco2.
 *
 *   const cam = createCamera({ onFrame });   cam.start() → Promise, cam.stop(), cam.state() → { on, label, w, h, fps, markers }
 *   onFrame({ t, w, h, markers: [{ id, corners: [{x, y}×4] }] })   corners in full-frame pixels, clockwise from top-left
 */
import { AR } from './vendor/aruco.js';

export function createCamera(opts = {}) {
  const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
  const scale = opts.scale || 0.5;                 // detect on a downsampled copy (640² from 1280²) – ~10 fps on the Quest
  const interval = opts.interval || 80;
  let stream = null, video = null, timer = null, canvas = null, ctx = null;
  const st = { on: false, label: '', w: 0, h: 0, fps: 0, markers: [], frames: 0, error: '' };
  let fpsT = 0, fpsN = 0;

  async function pickDevice() {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    // prefer the passthrough cameras; the user-facing device is the avatar camera
    const back = devs.filter(d => /back|environment/i.test(d.label));
    return back[0] || null;
  }

  async function start() {
    if (st.on) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('No camera API in this browser');
    // first call: ask for permission so the device labels become visible, then pick the back camera
    let dev = await pickDevice();
    if (!dev) {
      const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      probe.getTracks().forEach(t => t.stop());
      dev = await pickDevice();
    }
    const constraints = dev ? { deviceId: { exact: dev.deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } };
    stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
    const track = stream.getVideoTracks()[0];
    st.label = track.label || (dev ? dev.label : '');
    video = document.createElement('video');
    video.srcObject = stream; video.muted = true; video.playsInline = true;
    await video.play();
    st.w = video.videoWidth; st.h = video.videoHeight;
    canvas = document.createElement('canvas');
    canvas.width = Math.round(st.w * scale); canvas.height = Math.round(st.h * scale);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    st.on = true; st.error = '';
    fpsT = performance.now(); fpsN = 0;
    timer = setInterval(tick, interval);
  }

  function tick() {
    if (!st.on || video.readyState < 2) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = detector.detect(img);
      const k = 1 / scale;
      // the dictionary tolerates 12 bit errors (tau) – that lets small sub-squares inside a marker pass as other ids:
      // keep only clean reads (≤ 2 bit errors) of a plausible size (≥ 24 px in the downsampled frame)
      const ok = found.filter(m => (m.hammingDistance || 0) <= 2 && Math.hypot(m.corners[1].x - m.corners[0].x, m.corners[1].y - m.corners[0].y) >= 24);
      st.markers = ok.map(m => ({ id: m.id, hd: m.hammingDistance || 0, corners: m.corners.map(c => ({ x: c.x * k, y: c.y * k })) }));
      st.frames++; fpsN++;
      const now = performance.now();
      if (now - fpsT > 1000) { st.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsT = now; fpsN = 0; }
      if (opts.onFrame) opts.onFrame({ t: now, w: st.w, h: st.h, markers: st.markers });
    } catch (e) { st.error = String(e && e.message || e); }
  }

  function stop() {
    if (timer) clearInterval(timer); timer = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video = null; st.on = false; st.markers = []; st.fps = 0;
  }

  /** JPEG data URL of the current full frame (for remote checks). */
  function snapshot(q = 0.7) {
    if (!video) return null;
    const c = document.createElement('canvas'); c.width = st.w; c.height = st.h;
    c.getContext('2d').drawImage(video, 0, 0);
    return c.toDataURL('image/jpeg', q);
  }

  return { start, stop, snapshot, state: () => st };
}
