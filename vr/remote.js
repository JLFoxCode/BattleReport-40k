/* VR remote control (phone / PC): sends UI actions to the headset through the game server (signal { type: 'vr', … },
 * the same keys as the buttons in vr/index.html) and shows what the headset reports back (signal 'vr.status').
 * Part of the separate VR module – nothing of the app loads it. */
import { TERRAIN_LAYOUTS } from '../data/terrain.js';
import { connect } from './net.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
let net = null;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2500);
}
function setStatus(s) {
  const el = $('#status'); el.dataset.s = s;
  el.textContent = { online: 'Connected', reconnecting: 'Reconnecting…', offline: 'No connection', login: 'Sign in required', notfound: 'Game not found', idle: 'No game' }[s] || s;
  $('#login').hidden = s !== 'login';
}
function showHeadset(st) {
  const layout = TERRAIN_LAYOUTS.find(t => t.id === st.layout);
  $('#hs-text').textContent = [
    st.xr ? (st.xr === 'ar' ? 'In mixed reality' : 'In VR') : 'Page open, not in the headset yet',
    st.calibrated ? `calibrated (edge ${st.edge}")` : 'not calibrated',
    'tool: ' + st.tool + (st.tool === 'ring' ? ' ' + st.ringR + '"' : ''),
    (layout ? layout.name : 'no layout') + ', ' + st.pieces + ' pieces',
    st.band === 'infiltrate' ? '9" band on' : '', st.grid ? 'grid on' : '', st.mirror ? 'mirrored' : ''
  ].filter(Boolean).join(' · ');
  $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === st.tool));
  $$('[data-ring]').forEach(b => b.classList.toggle('on', st.tool === 'ring' && Number(b.dataset.ring) === st.ringR));
  $('[data-act=band]').classList.toggle('on', st.band === 'infiltrate');
  $('[data-act=grid]').classList.toggle('on', !!st.grid);
  $('[data-act=mirror]').classList.toggle('on', !!st.mirror);
  $('#layout').value = st.layout || '';
}

function send(a) {
  if (!net) { toast('Open a game first'); return; }
  net.signal(Object.assign({ type: 'vr' }, a));
}
function openGame(c) {
  const code = String(c || '').trim().toUpperCase();
  if (net) { net.close(); net = null; }
  $('#code').value = code;
  if (!code) { setStatus('idle'); return; }
  try { localStorage.setItem('vr.code', JSON.stringify(code)); } catch {}
  location.hash = '#/g/' + code;
  setStatus('offline');
  net = connect(code, {
    onStatus: s => { setStatus(s); if (s === 'online') send({ act: 'ping' }); },
    onSignal: sig => { if (sig && sig.type === 'vr.status') showHeadset(sig); }
  });
}

$('#layout').innerHTML = '<option value="">No terrain layout</option>' + TERRAIN_LAYOUTS.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
$('#layout').addEventListener('change', e => send({ layout: e.target.value || '' }));
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = Object.assign({}, b.dataset);
  if (a.act === 'open') { openGame($('#code').value); return; }
  if (a.send === 'text') { send({ text: $('#text').value.trim() }); toast('Sent'); return; }
  send(a);
});
$('#code').addEventListener('keydown', e => { if (e.key === 'Enter') openGame(e.target.value); });
const m = location.hash.match(/#\/g\/([A-Z0-9]{3,8})/i);
let saved = '';
try { saved = JSON.parse(localStorage.getItem('vr.code') || '""'); } catch {}
openGame(m ? m[1] : saved);
