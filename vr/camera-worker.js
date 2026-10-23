/* Marker detection off the main thread: receives downsampled RGBA frames from vr/camera.js, runs js-aruco2 and
 * posts the markers back. Module worker (import of the bundled library). */
import { AR } from './vendor/aruco.js';

const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });

self.onmessage = e => {
  const { id, w, h, data, k, t } = e.data;
  let markers = [], error = '';
  try {
    const found = detector.detect({ width: w, height: h, data });
    // the dictionary tolerates 12 bit errors – keep only clean reads of a plausible size
    markers = found
      .filter(m => (m.hammingDistance || 0) <= 2 && Math.hypot(m.corners[1].x - m.corners[0].x, m.corners[1].y - m.corners[0].y) >= 24)
      .map(m => ({ id: m.id, hd: m.hammingDistance || 0, corners: m.corners.map(c => ({ x: c.x * k, y: c.y * k })) }));
  } catch (err) { error = String(err && err.message || err); }
  self.postMessage({ id, t, markers, error });
};
