/* Passthrough camera of the Quest 3 in the browser: after the site's camera permission the Quest browser lists the
 * two passthrough cameras as "camera 1 / camera 2, facing back" (= on the back of the device, looking forward at the
 * table; the "facing front" one is Meta's virtual avatar camera – useless). getUserMedia on a back camera gives up to
 * 1280×1280 @ 30 fps and keeps streaming inside the immersive session (verified 2026-10-23).
 * This module grabs frames, downsamples them and hands them to a Web Worker (vr/camera-worker.js) that detects the
 * printed ArUco corner markers (vr/print/table-markers-10x15.pdf) – off the main thread, so the VR frame rate stays up.
 *
 *   const cam = createCamera({ onFrame });   cam.start() → Promise, cam.stop(), cam.state() → { on, label, w, h, fps, markers }
 *   onFrame({ t, w, h, markers: [{ id, corners: [{x, y}×4] }] })   corners in full-frame pixels, clockwise from top-left
 */
export function createCamera(opts = {}) {
  const scale = opts.scale || 0.4;                 // detect on a 512² copy of the 1280² frame
  const interval = opts.interval || 120;           // ms between frames handed to the worker (≈ 8 fps)
  let stream = null, video = null, timer = null, canvas = null, ctx = null, worker = null, busy = false, seq = 0;
  const st = { on: false, label: '', w: 0, h: 0, fps: 0, markers: [], frames: 0, error: '' };
  let fpsT = 0, fpsN = 0;

  async function pickDevice() {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const back = devs.filter(d => /back|environment/i.test(d.label));   // the passthrough cameras
    return back[0] || null;
  }

  async function start() {
    if (st.on) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('No camera API in this browser');
    let dev = await pickDevice();
    if (!dev) {
      // first time: the permission prompt – afterwards the device labels are visible and the back camera can be picked
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
    worker = new Worker(new URL('./camera-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      busy = false;
      const { markers, error } = e.data;
      st.markers = markers; st.error = error || '';
      st.frames++; fpsN++;
      const now = performance.now();
      if (now - fpsT > 1000) { st.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsT = now; fpsN = 0; }
      if (opts.onFrame) opts.onFrame({ t: e.data.t, w: st.w, h: st.h, markers });
    };
    worker.onerror = e => { st.error = 'worker: ' + (e.message || e); busy = false; };
    st.on = true; st.error = '';
    fpsT = performance.now(); fpsN = 0;
    timer = setInterval(tick, interval);
  }

  function tick() {
    if (!st.on || busy || !video || video.readyState < 2) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      busy = true;
      worker.postMessage({ id: ++seq, t: performance.now(), w: img.width, h: img.height, data: img.data, k: 1 / scale }, [img.data.buffer]);
    } catch (e) { st.error = String(e && e.message || e); busy = false; }
  }

  function stop() {
    if (timer) clearInterval(timer); timer = null;
    if (worker) worker.terminate(); worker = null; busy = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video = null; st.on = false; st.markers = []; st.fps = 0;
  }

  /** JPEG data URL of the current full frame (remote checks). */
  function snapshot(q = 0.7) {
    if (!video) return null;
    const c = document.createElement('canvas'); c.width = st.w; c.height = st.h;
    c.getContext('2d').drawImage(video, 0, 0);
    return c.toDataURL('image/jpeg', q);
  }

  return { start, stop, snapshot, state: () => st };
}
