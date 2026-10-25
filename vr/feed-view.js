/* Live view of the headset (vr/feed.html): receives the WebRTC stream that vr/feed.js sends from the headset – the
 * passthrough picture with the table overlay. Signalling through the game's server (POST …/signal → SSE 'signal'),
 * the video goes peer to peer in the Wi-Fi. ?host=<origin> when the game lives on another device (vr/net.js). */
import { connect, HOST } from './net.js';

const $ = s => document.querySelector(s);
const id = 'v-' + Math.random().toString(36).slice(2, 8);
let net = null, pc = null, headset = null, askTimer = null, code = '';

function setStatus(s) {
  const el = $('#status');
  el.dataset.s = s;
  el.textContent = { online: 'Connected', reconnecting: 'Reconnecting…', offline: 'No connection', login: 'Sign in required', notfound: 'Game not found', idle: 'No game' }[s] || s;
  $('#login').hidden = s !== 'login';
}
function wait(text) { $('#wait').hidden = !text; if (text) $('#wait-text').textContent = text; }
function info(text) { $('#info').textContent = text; }
const send = obj => { if (net) net.signal(Object.assign({ from: id }, obj)); };

/** Ask the headset for the stream (repeated until a picture arrives – the headset may open the game later). */
function ask() {
  clearTimeout(askTimer);
  if (!net) return;
  send({ type: 'vr.feed', role: 'want' });
  askTimer = setTimeout(ask, 4000);
}
function closePeer() {
  if (pc) { try { pc.close(); } catch {} pc = null; }
  if (headset) send({ type: 'vr.feed', role: 'bye', to: headset });
  headset = null;
  $('#video').srcObject = null;
}
async function onOffer(sig) {
  closePeer();
  headset = sig.from;
  pc = new RTCPeerConnection({ iceServers: [] });
  pc.onicecandidate = e => { if (e.candidate) send({ type: 'vr.feed', role: 'ice', to: headset, cand: e.candidate.toJSON() }); };
  pc.ontrack = e => {
    const v = $('#video');
    if (v.srcObject !== e.streams[0]) { v.srcObject = e.streams[0]; v.play().catch(() => {}); }
    clearTimeout(askTimer);
    wait('');
    info('Live from the headset – ' + (HOST ? 'game on ' + HOST.replace(/^https?:\/\//, '') : 'game on this server'));
  };
  pc.onconnectionstatechange = () => {
    if (pc && ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) { wait('Connection to the headset lost – asking again …'); closePeer(); ask(); }
  };
  await pc.setRemoteDescription({ type: 'offer', sdp: sig.sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send({ type: 'vr.feed', role: 'answer', to: headset, sdp: pc.localDescription.sdp });
  wait('Headset found – connecting …');
}
function onSignal(sig) {
  if (!sig || sig.type !== 'vr.feed' || sig.from === id) return;
  if (sig.to && sig.to !== id) return;
  if (sig.role === 'offer') onOffer(sig).catch(e => info('WebRTC: ' + (e && e.message || e)));
  else if (sig.role === 'ice' && pc && sig.cand) pc.addIceCandidate(sig.cand).catch(() => {});
  else if (sig.role === 'bye') { closePeer(); wait('The headset stopped the live view.'); ask(); }
}

function openGame(c) {
  code = String(c || '').trim().toUpperCase();
  closePeer();
  if (net) { net.close(); net = null; }
  $('#code').value = code;
  if (!code) { setStatus('idle'); wait('Enter the game code.'); return; }
  try { localStorage.setItem('vr.code', JSON.stringify(code)); } catch {}
  location.hash = '#/g/' + code;
  setStatus('offline');
  wait('Waiting for the headset …');
  net = connect(code, {
    onStatus: s => { setStatus(s); if (s === 'online') ask(); },
    onSignal
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'open') openGame($('#code').value);
  else if (b.dataset.act === 'ask') ask();
  else if (b.dataset.act === 'full') { const v = $('#video'); (v.requestFullscreen ? v.requestFullscreen() : v.webkitEnterFullscreen && v.webkitEnterFullscreen()); }
});
$('#code').addEventListener('keydown', e => { if (e.key === 'Enter') openGame(e.target.value); });
addEventListener('pagehide', () => closePeer());
if (!window.RTCPeerConnection) wait('This browser has no WebRTC – the live view needs a current Chrome, Edge, Safari or the app.');
const m = location.hash.match(/#\/g\/([A-Z0-9]{3,8})/i);
let saved = '';
try { saved = JSON.parse(localStorage.getItem('vr.code') || '""'); } catch {}
openGame(m ? m[1] : saved);
