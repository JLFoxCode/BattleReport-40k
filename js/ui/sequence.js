/* Mission sequence (js/ui/sequence.js) – the Warhammer Event Companion's steps 1–12 as confirmation stops, so everyone
 * knows what to do right now: some steps are done by what the game knows (dispositions chosen, layout set, Attacker
 * rolled, first turn rolled, battle started), the rest the players confirm by hand (game action 'sequence.set', so every
 * device shows the same stop). sequenceSteps(state) → [{ n, key, title, text, done, auto, stage }];
 * sequenceStrip(ctx, stage) → HTML of the current stop (+ the whole list on demand). */
import { esc, btn } from './components.js';

const SETUP = 'setup', DEPLOY = 'deploy';
export function sequenceSteps(state) {
  const s = state || {}, m = s.mission || {}, pl = s.players || [], seq = s.sequence || {};
  const disp = Array.isArray(m.dispositions) && m.dispositions[0] && m.dispositions[1];
  const half = s.opts && s.opts.board === 'half';
  const layout = !!m.terrainLayout && (!String(m.terrainLayout).startsWith('random-') || Array.isArray(m.terrainPieces));
  const steps = [
    { n: 1, key: 'muster', stage: SETUP, auto: true, done: pl.length === 2 && (pl.every(p => p.ready) || (pl.every(p => p.faction) && !!disp)) || s.stage !== 'setup',
      title: 'Muster armies', text: 'Each player loads their army roster (Army step) and selects one Force Disposition available to their detachment – noted on the roster.' },
    { n: 2, key: 'mission', stage: SETUP, auto: true, done: !!disp && !!(m.primary && m.primary[0] && m.primary[1]),
      title: 'Determine mission', text: 'Each player finds the opponent\'s Force Disposition on their own card: the Primary Mission listed there is theirs. The app shows both once both Dispositions are chosen.' },
    { n: 3, key: 'layout', stage: SETUP, auto: true, done: layout,
      title: 'Determine a layout', text: half ? 'Half table: generate the layout for this half table (Table step → Random layout).' : 'Choose layout A, B or C of your two Force Dispositions (Table step). Events usually go A, B, C in order.' },
    { n: 4, key: 'battlefield', stage: SETUP, auto: false, done: !!seq.battlefield,
      title: 'Create the battlefield', text: 'Set up the terrain areas and the terrain features on them exactly as the layout shows – open the Battle table (3D), turn on Measurements, and place the real pieces by the distances shown. Confirm when the table is built.' },
    { n: 5, key: 'attacker', stage: SETUP, auto: true, done: m.attacker === 0 || m.attacker === 1,
      title: 'Determine Attacker and Defender', text: 'Agree which real table edges are the Attacker\'s and the Defender\'s edge of the card. Then roll off: the winner decides who is the Attacker – set it in the Mission step.' },
    { n: 6, key: 'secondaries', stage: SETUP, auto: false, done: !!seq.secondaries,
      title: 'Select Secondary Missions', text: 'Each player secretly notes Tactical or Fixed (and which two Fixed Missions), then both reveal at once – enter the choice in the Secondary step. Confirm when both are revealed.' },
    { n: 7, key: 'formations', stage: DEPLOY, auto: false, done: !!seq.formations,
      title: 'Declare Battle Formations', text: 'Each player secretly notes which units start embarked in which TRANSPORTS and which start in strategic reserves, then both reveal at once.' },
    { n: 8, key: 'deploy', stage: DEPLOY, auto: false, done: !!seq.deploy,
      title: 'Deploy armies', text: 'Starting with the Defender, set up one unit at a time wholly within your own deployment zone (a TITANIC unit: skip your next turn to set up). Confirm when both armies stand.' },
    { n: 9, key: 'redeploy', stage: DEPLOY, auto: false, done: !!seq.redeploy,
      title: 'Redeploy units', text: 'Rules that let you redeploy after both armies are deployed are resolved now, alternating, starting with the Attacker (Scouts, Infiltrators\' redeploys …). Confirm when done or if nobody has such rules.' },
    { n: 10, key: 'first', stage: DEPLOY, auto: true, done: m.first === 0 || m.first === 1,
      title: 'Determine first turn', text: 'Roll off: the winner takes the first turn – set it below.' },
    { n: 11, key: 'prebattle', stage: DEPLOY, auto: false, done: !!seq.prebattle,
      title: 'Resolve pre-battle rules', text: 'Alternating, starting with the player who takes the first turn, resolve pre-battle rules of your units. Confirm when done.' },
    { n: 12, key: 'begin', stage: DEPLOY, auto: true, done: s.stage === 'battle' || s.stage === 'over',
      title: 'Begin the battle', text: 'The first battle round begins – “Start battle” on the score display.' }
  ];
  return steps;
}

/** The current stop as a strip (the first step not done), with “Done” for manual steps and an expandable full list. */
export function sequenceStrip(ctx, open) {
  const steps = sequenceSteps(ctx.state);
  const stage = ctx.state.stage;
  // the current stop: the first open step of this stage or later (setup steps left open stay in the list, but once
  // deployment has begun the table shows what to do now)
  const cur = steps.find(st => !st.done && (stage === 'setup' || st.stage !== 'setup')) || null;
  const doneN = steps.filter(st => st.done).length;
  const row = st => `<li class="seq-item ${st.done ? 'done' : ''} ${cur && st.key === cur.key ? 'cur' : ''}">
      <span class="seq-n">${st.done ? '✓' : st.n}</span>
      <div class="seq-main"><div class="seq-title">${esc(st.title)}</div><div class="seq-text xs muted">${esc(st.text)}</div></div>
      ${!st.auto && !ctx.spectator && (st.stage === stage || (stage !== 'setup' && st.stage === 'setup')) ? (st.done ? btn({ label: 'Reopen', kind: 'ghost', small: true, action: 'seq-undo', data: { key: st.key } }) : btn({ label: 'Done', kind: 'primary', small: true, action: 'seq-done', data: { key: st.key } })) : ''}
    </li>`;
  return `<section class="card seq ${open ? 'open' : ''}">
      <div class="seq-head">
        <span class="seq-badge">Now</span>
        ${cur ? `<div class="seq-cur"><div class="seq-title"><span class="seq-n">${cur.n}</span> ${esc(cur.title)}</div><div class="seq-text small">${esc(cur.text)}</div>
          ${cur.stage !== stage && stage === 'setup' ? `<div class="xs muted">${esc('This step follows on the score display once setup is finished (“Go to deployment”).')}</div>` : ''}</div>`
          : `<div class="seq-cur"><div class="seq-title">${esc('Mission sequence complete')}</div></div>`}
        <div class="seq-actions">
          ${cur && !cur.auto && !ctx.spectator && cur.stage === stage ? btn({ label: 'Done', kind: 'primary', action: 'seq-done', data: { key: cur.key } }) : ''}
          ${btn({ label: `${doneN}/${steps.length}`, kind: 'ghost', small: true, action: 'seq-toggle', title: 'Mission sequence (Warhammer Event Companion)' })}
        </div>
      </div>
      ${open ? `<ul class="list seq-list">${steps.map(row).join('')}</ul><p class="xs muted seq-src">Warhammer Event Companion – Mission Sequence, steps 1–12.</p>` : ''}
    </section>`;
}
