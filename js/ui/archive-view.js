/* Finished game stored on this device – route #/archive/CODE. Read-only, works without any server.
 * Final score, VP per round and the full log of the battle (from js/archive.js). */
import { derive } from '../../engine/index.js';
import { WH } from '../../data/rules.js';
import { esc, btn, confirmSheet, toast, colorOf } from './components.js';
import { loadFinished, deleteFinished } from '../archive.js';

const pName = (s, p) => ((s.players || [])[p] || {}).name || `Player ${p + 1}`;

export function render(root, ctx) {
  const code = ctx.archive;
  const entry = code ? loadFinished(code) : null;
  if (!entry || !entry.state) {
    root.innerHTML = `<div class="card center muted"><div class="title">Game ${esc(code || '')} is not stored on this device.</div><p><a href="#/">Back to lobby</a></p></div>`;
    return;
  }
  const s = entry.state;
  const app = document.documentElement;
  (s.players || []).forEach((p, i) => app.style.setProperty('--p' + i, colorOf(p.color)));
  let d = {};
  try { d = derive(s); } catch (e) { console.warn('derive', e); }
  const vp = d.vp || [0, 1].map(p => { const v = (s.players[p] || {}).vp || {}; return { primary: v.primary || 0, secondary: v.secondary || 0, bonus: v.bonus || 0, total: (v.primary || 0) + (v.secondary || 0) + (v.bonus || 0) }; });
  const winner = vp[0].total === vp[1].total ? null : vp[0].total > vp[1].total ? 0 : 1;
  const sum = (p, src, r) => (s.scores || []).filter(x => x.player === p && x.src === src && x.round === r).reduce((a, x) => a + x.vp, 0);
  const log = (s.log || []).slice().reverse();
  root.innerHTML = `
    <div class="tbl-simple wrap over archive">
      <header class="tbl-top center">
        <div class="xs muted">Game <b>${esc(code)}</b> · finished · saved on this device ${entry.savedAt ? esc(new Date(entry.savedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}</div>
        <h1 class="title">${winner == null ? 'Draw' : `<span class="text-p${winner}">${esc(pName(s, winner))}</span> wins`}</h1>
      </header>
      <div class="scoreboard">${[0, 1].map(p => `
        <div class="card p${p} ${winner === p ? 'winner' : ''}">
          <div class="kpi lg p${p}"><span class="kpi-value">${esc(vp[p].total)}</span><span class="kpi-label">${esc(pName(s, p))}</span></div>
          <div class="sb-split muted small">Primary ${esc(vp[p].primary)} · Secondary ${esc(vp[p].secondary)}${vp[p].bonus ? ' · Modifier ' + esc(vp[p].bonus) : ''}</div>
        </div>`).join('')}</div>
      <div class="card pad0 mt">
        <table class="rtable">
          <thead><tr><th>Round</th><th class="text-p0" colspan="2">${esc(pName(s, 0))}</th><th class="text-p1" colspan="2">${esc(pName(s, 1))}</th></tr>
          <tr class="xs muted"><th></th><th>Primary</th><th>Secondary</th><th>Primary</th><th>Secondary</th></tr></thead>
          <tbody>${[1, 2, 3, 4, 5].map(r => `<tr><td>${r}</td><td>${sum(0, 'primary', r)}</td><td>${sum(0, 'secondary', r)}</td><td>${sum(1, 'primary', r)}</td><td>${sum(1, 'secondary', r)}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td>${esc(vp[0].primary)}</td><td>${esc(vp[0].secondary)}</td><td>${esc(vp[1].primary)}</td><td>${esc(vp[1].secondary)}</td></tr></tbody>
        </table>
      </div>
      <div class="row mt"><a class="btn ghost" href="#/">Lobby</a>${btn({ label: 'Delete from this device', kind: 'danger', action: 'arch-delete' })}</div>
      <div class="card pad0 log-card mt">
        <div class="card-head log-head"><div class="title">Log</div><span class="muted xs">${esc(log.length)} entries, newest first</span></div>
        <ul class="list log">${log.map(l => `<li class="list-item ${l.player === 0 || l.player === 1 ? 'p' + l.player : ''}"><div class="main"><div class="ltxt">${esc(l.text)}</div><div class="sub xs">${l.round ? `R${esc(l.round)} · ${esc(pName(s, l.turn))} · ${esc((WH.PHASES.find(p => p.id === l.phase) || {}).name || l.phase || '')}` : ''}</div></div></li>`).join('')}</ul>
      </div>
    </div>`;
  root.__archCode = code;
  if (!root.__archBound) {
    root.__archBound = true;
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-action="arch-delete"]');
      if (!b || document.body.dataset.view !== 'archive') return;
      const c = root.__archCode;
      if (!(await confirmSheet({ title: `Delete game ${c}?`, text: 'Removes the saved game from this device only.', ok: 'Delete', kind: 'danger' }))) return;
      deleteFinished(c);
      toast(`Game ${c} deleted from this device`, 'ok');
      location.hash = '#/';
    });
  }
}
