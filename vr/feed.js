/* Live view of the headset for phones and PCs in the Wi-Fi (vr/feed.html): what the person in the headset sees –
 * the passthrough camera's picture with the table overlay (zones, objectives, terrain, rings) drawn on top – streamed
 * with WebRTC, peer to peer in the LAN. The game server only carries the signalling (POST …/signal → SSE 'signal' to
 * every device of the game), no video passes through it.
 *
 *   const feed = createFeed({ THREE, scene, store })
 *   feed.start()  → camera + offscreen renderer + composite canvas; feed.stop(); feed.on
 *   feed.tick(camera)            every frame from the render loop: renders the overlay from the headset's view pose
 *                                (~15 fps, the rest of the frames are skipped) and composes it over the camera picture
 *   feed.onSignal(sig, send)     'vr.feed' signals of the viewers: want → offer, answer, ice
 *   feed.fov(delta)              the passthrough camera's field of view is not readable – adjust it until the overlay
 *                                sits on the real table in the live picture (stored on the headset)
 * Picture: 640×480 (the camera gives up to 1280² – more than a phone screen needs and the headset has to stay at 90 Hz). */
export function createFeed({ THREE, scene, store }) {
  const W = 640, H = 480, FPS = 15;
  const st = { on: false, cam: false, viewers: 0, error: '' };
  let stream = null, video = null, gl = null, feedCam = null, comp = null, ctx = null, out = null, last = 0;
  const peers = new Map();                                 // viewer id → RTCPeerConnection
  let fov = Number(store.get('feed.fov', 62)) || 62;      // vertical fov (°) of the composed picture
  const id = 'hs-' + Math.random().toString(36).slice(2, 8);

  async function pickBack() {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    return devs.filter(d => /back|environment/i.test(d.label))[0] || null;
  }
  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('No camera API in this browser');
    let dev = await pickBack();
    if (!dev) {
      const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      probe.getTracks().forEach(t => t.stop());
      dev = await pickBack();
    }
    const video_ = dev ? { deviceId: { exact: dev.deviceId }, width: { ideal: 640 }, height: { ideal: 640 }, frameRate: { ideal: FPS, max: 30 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: FPS, max: 30 } };
    const s = await navigator.mediaDevices.getUserMedia({ video: video_ });
    video = document.createElement('video');
    video.srcObject = s; video.muted = true; video.playsInline = true;
    await video.play();
    return s;
  }

  async function start() {
    if (st.on) return;
    comp = document.createElement('canvas'); comp.width = W; comp.height = H;
    ctx = comp.getContext('2d');
    const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
    gl = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    gl.setPixelRatio(1); gl.setSize(W, H, false); gl.setClearColor(0x000000, 0);
    feedCam = new THREE.PerspectiveCamera(fov, W / H, 0.05, 50);
    feedCam.matrixAutoUpdate = false;
    try { stream = await openCamera(); st.cam = true; st.error = ''; }
    catch (e) { st.cam = false; st.error = String(e && e.message || e); }   // no camera: the overlay alone on a dark ground
    out = comp.captureStream(FPS);
    st.on = true;
    for (const p of peers.values()) attachTracks(p);
  }
  function stop() {
    st.on = false;
    for (const [k, p] of peers) { try { p.close(); } catch {} peers.delete(k); }
    st.viewers = 0;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) { video.srcObject = null; video = null; }
    if (out) { out.getTracks().forEach(t => t.stop()); out = null; }
    if (gl) { gl.dispose(); gl = null; }
    comp = null; ctx = null; feedCam = null; st.cam = false;
  }

  /** From the render loop: compose a frame every 1000 / FPS ms from the current view pose. */
  function tick(camera) {
    if (!st.on || !gl) return;
    const now = performance.now();
    if (now - last < 1000 / FPS) return;
    last = now;
    // the headset's view: in an XR session the renderer's camera is an array camera whose world matrix is the head
    feedCam.matrix.copy(camera.matrixWorld);
    feedCam.updateMatrixWorld(true);
    if (feedCam.fov !== fov) { feedCam.fov = fov; feedCam.updateProjectionMatrix(); }
    gl.render(scene, feedCam);
    if (video && video.readyState >= 2) {
      // cover-fit the (square) camera picture
      const vw = video.videoWidth || W, vh = video.videoHeight || H, k = Math.max(W / vw, H / vh), dw = vw * k, dh = vh * k;
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else { ctx.fillStyle = '#10151c'; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(gl.domElement, 0, 0);
  }

  // ---------------------------------------------------------------- WebRTC (one connection per viewer)
  function attachTracks(pc) { if (out) for (const t of out.getTracks()) pc.addTrack(t, out); }
  async function offerTo(viewer, send) {
    if (!st.on) return;
    const old = peers.get(viewer); if (old) { try { old.close(); } catch {} }
    const pc = new RTCPeerConnection({ iceServers: [] });     // LAN only: host candidates, no STUN needed
    peers.set(viewer, pc); st.viewers = peers.size;
    attachTracks(pc);
    pc.onicecandidate = e => { if (e.candidate) send({ type: 'vr.feed', role: 'ice', from: id, to: viewer, cand: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { if (peers.get(viewer) === pc) peers.delete(viewer); st.viewers = peers.size; }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'vr.feed', role: 'offer', from: id, to: viewer, sdp: pc.localDescription.sdp });
  }
  /** 'vr.feed' signals from the viewers (and our own, which come back through the server – ignored by from/to). */
  async function onSignal(sig, send) {
    if (!sig || sig.type !== 'vr.feed' || sig.from === id) return false;
    if (sig.role === 'want') { if (st.on) offerTo(sig.from, send).catch(e => { st.error = String(e && e.message || e); }); return true; }
    if (sig.to !== id) return false;
    const pc = peers.get(sig.from);
    if (!pc) return true;
    try {
      if (sig.role === 'answer') await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
      else if (sig.role === 'ice' && sig.cand) await pc.addIceCandidate(sig.cand);
      else if (sig.role === 'bye') { pc.close(); peers.delete(sig.from); st.viewers = peers.size; }
    } catch (e) { st.error = String(e && e.message || e); }
    return true;
  }
  function setFov(delta) { fov = Math.max(30, Math.min(110, fov + delta)); store.set('feed.fov', fov); return fov; }

  return { start, stop, tick, onSignal, fov: setFov, get on() { return st.on; }, state: () => Object.assign({ fov, id }, st) };
}
