/* Warhammer 40,000 – 11th Edition · Chapter Approved Mission Deck 2026-27
 * Game data for the tracker. Mission texts are short condensations of the scoring
 * conditions, written from the original card wording – the physical card is authoritative.
 *
 * Condition schema:
 *  w   Timing: 'cmd'  = end of your Command phase
 *              'cmd5' = end of your Command phase (battle round 5: end of your turn)
 *              'turn' = end of your turn
 *              'any'  = end of a turn (either player's turn)
 *              'opp'  = end of your opponent's turn / end of the fifth battle round
 *              'oppt' = end of your opponent's turn only (no "or the end of the fifth battle round" clause)
 *              'end'  = end of the battle (not subject to the 15 VP per round limit)
 *  r   [from, to] battle rounds
 *  k   'bool' | 'per' | 'choice'
 *  vp  victory points (secondary missions may use {F: fixed, T: tactical})
 *  max cap per scoring
 *  a   automation: proposes a value from the game state (c = context)
 */

const DISPOSITIONS = [
  { id: 'th', name: 'Take and Hold', de: 'Hold' },
  { id: 'pf', name: 'Purge the Foe', de: 'Purge' },
  { id: 'di', name: 'Disruption', de: 'Disrupt' },
  { id: 're', name: 'Reconnaissance', de: 'Recon' },
  { id: 'pa', name: 'Priority Assets', de: 'Assets' }
];

// MATRIX[my disposition][opponent's disposition] -> primary mission
const MATRIX = {
  th: { th: 'battlefield_dominance', pf: 'immovable_object', di: 'determined_acquisition', re: 'purge_and_secure', pa: 'inescapable_dominion' },
  pf: { th: 'unstoppable_force', pf: 'meatgrinder', di: 'punishment', re: 'consecrate', pa: 'destroyers_wrath' },
  di: { th: 'death_trap', pf: 'delaying_action', di: 'outmanoeuvre', re: 'smoke_and_mirrors', pa: 'locate_and_deny' },
  re: { th: 'reconnaissance_sweep', pf: 'triangulation', di: 'surveil_the_foe', re: 'gather_intel', pa: 'search_and_scour' },
  pa: { th: 'secure_asset', pf: 'vital_link', di: 'extract_relic', re: 'vanguard_operation', pa: 'sabotage' }
};

const ALL = [1, 5], R2 = [2, 5];
const NH4 = { w: 'cmd5', r: R2, k: 'bool', vp: 4, t: 'You control one or more objectives (excluding your home objective)', a: c => c.myNonHome >= 1 };
const MORE = vp => ({ w: 'cmd5', r: R2, k: 'bool', vp, t: 'You control more objectives than your opponent', a: c => c.myObjs > c.oppObjs });
const KILL = vp => ({ w: 'turn', r: ALL, k: 'bool', vp, t: 'One or more enemy units were destroyed this turn', a: c => c.kills() > 0 });

const PRIMARY = {
  // ───────── Take and Hold ─────────
  battlefield_dominance: {
    name: 'Battlefield Dominance', deck: 'th', desc: 'Classic holding mission. In the first and second battle round you score for controlling more objectives than your opponent. From the second round onwards you score for each objective you control, with a bonus for each objective other than your home objective if you also control your home objective.',
    c: [
      { w: 'turn', r: [1, 2], k: 'bool', vp: 2, t: 'You control more objectives than your opponent', a: c => c.myObjs > c.oppObjs },
      { w: 'cmd5', r: R2, k: 'per', vp: 3, t: 'For each objective you control', a: c => c.myObjs },
      { w: 'cmd5', r: R2, k: 'per', vp: 2, sub: 1, t: '+ for each of those objectives (excluding your home objective) if you control your home objective', a: c => c.ownHome ? c.myNonHome : 0 }
    ]
  },
  immovable_object: {
    name: 'Immovable Object', deck: 'th', desc: 'Rewards holding the centre and many objectives: VP at the end of your turn for controlling a central objective, and VP for each objective you control (excluding your home objective) at the end of your Command phase in rounds 2–4 and at the end of your turn in round 5.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 3, t: 'You control one or more central objectives', a: c => c.central },
      { w: 'cmd', r: [2, 4], k: 'per', vp: 5, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'turn', r: [5, 5], k: 'per', vp: 5, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome }
    ]
  },
  determined_acquisition: {
    name: 'Determined Acquisition', deck: 'th', desc: 'Rewards taking ground: VP for each objective you control that you did not control at the start of the turn, plus VP for each objective you control, with a bonus for each of those within your opponent\'s territory.',
    c: [
      { w: 'turn', r: ALL, k: 'per', vp: 2, t: 'For each objective you control that you did not control at the start of the turn (excluding your home objective)', a: c => c.newNonHome },
      { w: 'cmd5', r: R2, k: 'per', vp: 3, t: 'For each objective you control', a: c => c.myObjs },
      { w: 'cmd5', r: R2, k: 'per', vp: 3, sub: 1, t: '+ for each of those objectives that is within your opponent\'s territory', a: c => c.inOppTerr }
    ]
  },
  purge_and_secure: {
    name: 'Purge and Secure', deck: 'th', desc: 'Purge and hold: VP for destroying enemy units at objectives (by a friendly unit within range of an objective, or enemy units that started the turn within range of one), for each objective you control (excluding your home objective) and for newly taken objectives.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 3, t: 'One or more enemy units were destroyed this turn by a friendly unit within range of an objective – OR one or more enemy units that started the turn within range of an objective were destroyed this turn', a: c => c.kills('obj') > 0 },
      { w: 'cmd5', r: R2, k: 'per', vp: 4, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'turn', r: R2, k: 'bool', vp: 3, t: 'You control one or more objectives you did not control at the start of the turn (excluding your home objective)', a: c => c.newNonHome > 0 }
    ]
  },
  inescapable_dominion: {
    name: 'Inescapable Dominion', deck: 'th', desc: 'Rewards broad control: VP for controlling three or more objectives at the end of your turn, two or more at the end of your Command phase, more objectives than your opponent, and your opponent\'s home objective at the end of the battle.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'You control three or more objectives', a: c => c.myObjs >= 3 },
      { w: 'cmd5', r: R2, k: 'bool', vp: 5, t: 'You control two or more objectives', a: c => c.myObjs >= 2 },
      MORE(4),
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'You control your opponent\'s home objective', a: c => c.oppHome }
    ]
  },
  // ───────── Purge the Foe ─────────
  unstoppable_force: {
    name: 'Unstoppable Force', deck: 'pf', desc: 'Push forward: VP for destroying enemy units, for each objective you control (excluding your home objective), for newly taken objectives and, at the end of the battle, for controlling a central objective.',
    c: [
      KILL(3),
      { w: 'cmd5', r: R2, k: 'per', vp: 4, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'turn', r: R2, k: 'bool', vp: 3, t: 'You control one or more objectives you did not control at the start of the turn (excluding your home objective)', a: c => c.newNonHome > 0 },
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'You control one or more central objectives', a: c => c.central }
    ]
  },
  meatgrinder: {
    name: 'Meatgrinder', deck: 'pf', desc: 'Pure killing: VP for destroying enemy units, for destroying more enemy units this turn than you lost in the previous turn, for controlling one or more objectives (excluding your home objective) and for controlling your opponent\'s home objective.',
    c: [
      KILL(3),
      NH4,
      { w: 'turn', r: R2, k: 'bool', vp: 5, t: 'More enemy units were destroyed this turn than friendly units were destroyed in the previous turn', a: c => c.kills() > c.lossesPrev },
      { w: 'turn', r: R2, k: 'bool', vp: 5, t: 'You control your opponent\'s home objective', a: c => c.oppHome }
    ]
  },
  punishment: {
    name: 'Punishment', deck: 'pf', desc: 'At the start of your turn you select one to three enemy units to be condemned. VP when a condemned unit leaves the battlefield, plus VP for controlling objectives, for controlling more objectives than your opponent and, at the end of the battle, for your opponent\'s home objective.',
    note: 'Start of your turn: select one to three enemy units on the battlefield that are within range of objectives and/or destroyed a friendly unit in the previous turn to be condemned – if you cannot, select one enemy unit on the battlefield. Mark "Condemned" in the kill log.',
    c: [
      { w: 'any', r: ALL, k: 'bool', vp: 5, t: 'One or more condemned enemy units left the battlefield this turn', a: c => c.kills('cond') > 0 },
      NH4,
      MORE(5),
      { w: 'end', r: ALL, k: 'bool', vp: 8, t: 'You control your opponent\'s home objective', a: c => c.oppHome }
    ]
  },
  consecrate: {
    name: 'Consecrate', deck: 'pf', desc: 'Units that destroy an enemy unit become consecration units and can consecrate an objective within range at the end of your turn. VP for consecrated objectives, for controlling objectives, for controlling more objectives than your opponent and, at the end of the battle, if your opponent\'s home objective is consecrated.',
    note: 'Each time a friendly unit destroys a unit, it becomes a consecration unit. At the end of your turn, each consecration unit can consecrate one objective it is within range of (excluding your home objective) that is not yet consecrated (place an operation marker).',
    trk: [{ id: 'cons', label: 'Consecrated objectives', obj: true, mark: 'Consecrated' }],
    c: [
      { w: 'turn', r: ALL, k: 'choice', t: 'Objectives consecrated', opts: [{ t: 'One or two consecrated', vp: 3 }, { t: 'Three or more consecrated', vp: 6 }], a: c => c.trk('cons') >= 3 ? 1 : c.trk('cons') >= 1 ? 0 : -1 },
      NH4,
      MORE(4),
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'Your opponent\'s home objective is consecrated', a: c => c.markOn('cons', 'oppHome') }
    ]
  },
  destroyers_wrath: {
    name: "Destroyer's Wrath", deck: 'pf', desc: 'Kill and out-kill: VP for destroying enemy units, for destroying more enemy units this turn than you lost in the previous turn, for controlling objectives and for controlling more objectives than your opponent.',
    c: [
      KILL(3),
      NH4,
      MORE(6),
      { w: 'turn', r: R2, k: 'bool', vp: 4, t: 'More enemy units were destroyed this turn than friendly units were destroyed in the previous turn', a: c => c.kills() > c.lossesPrev }
    ]
  },
  // ───────── Disruption ─────────
  death_trap: {
    name: 'Death Trap', deck: 'di', desc: 'With the Booby Trap action you trap terrain areas. VP for each terrain area trapped this turn (bonus if it is an objective), for destroying enemy units that started the turn in a trapped terrain area, and for controlling objectives.',
    note: 'Booby Trap action (your Shooting phase, unlimited, each unit in a different terrain area): a friendly unit within range of an objective (excluding your home objective) or within a terrain area not within your deployment zone traps that terrain area immediately (place an operation marker).',
    c: [
      { w: 'turn', r: ALL, k: 'per', vp: 2, t: 'For each terrain area trapped this turn' },
      { w: 'turn', r: ALL, k: 'per', vp: 3, sub: 1, t: '+ for each of those terrain areas that is an objective' },
      { w: 'turn', r: ALL, k: 'bool', vp: 3, t: 'One or more enemy units that started the turn within a trapped terrain area were destroyed', a: c => c.kills('terr') > 0 },
      NH4
    ]
  },
  delaying_action: {
    name: 'Delaying Action', deck: 'di', desc: 'VP for each enemy unit destroyed this turn, for controlling one or more objectives (excluding your home objective) and, from the second battle round, for controlling a central objective and an expansion objective at the same time.',
    c: [
      { w: 'turn', r: ALL, k: 'per', vp: 2, t: 'For each enemy unit destroyed this turn', a: c => c.kills() },
      NH4,
      { w: 'turn', r: R2, k: 'bool', vp: 3, t: 'You control one or more central objectives and one or more expansion objectives', a: c => c.central && c.anyExp }
    ]
  },
  outmanoeuvre: {
    name: 'Outmanoeuvre', deck: 'di', desc: 'Everything revolves around objectives other than your home objective: their value rises over the battle rounds (4, 5, then 6 VP each). Controlling your opponent\'s home objective scores heavily at the end of your turn.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 10, t: 'You control your opponent\'s home objective', a: c => c.oppHome },
      { w: 'turn', r: [1, 1], k: 'per', vp: 4, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'cmd', r: [2, 3], k: 'per', vp: 5, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'turn', r: [4, 5], k: 'per', vp: 6, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome }
    ]
  },
  smoke_and_mirrors: {
    name: 'Smoke and Mirrors', deck: 'di', desc: 'With the Decoy action you decoy objectives. VP for each decoyed objective (bonus within your opponent\'s territory), for controlling objectives and, at the end of the battle, if four or more objectives are decoyed.',
    note: 'Decoy action (your Shooting phase, unlimited, each unit at a different objective): a friendly unit within range of an objective (excluding your home objective) that is not decoyed; completes at the end of your turn if the unit controls that objective → the objective is decoyed (place an operation marker).',
    trk: [{ id: 'dec', label: 'Decoyed objectives', obj: true, mark: 'Decoyed' }, { id: 'decOpp', label: 'of those within your opponent\'s territory', derive: 'dec', where: 'oppTerr' }],
    c: [
      { w: 'turn', r: ALL, k: 'per', vp: 2, t: 'For each objective that is decoyed', a: c => c.trk('dec') },
      { w: 'turn', r: ALL, k: 'per', vp: 2, sub: 1, t: '+ for each of those objectives that is within your opponent\'s territory', a: c => c.trk('decOpp') },
      NH4,
      { w: 'end', r: ALL, k: 'bool', vp: 10, t: 'Four or more objectives are decoyed', a: c => c.trk('dec') >= 4 }
    ]
  },
  locate_and_deny: {
    name: 'Locate and Deny', deck: 'di', desc: 'At the start of the battle you place five operation markers in terrain areas not within your deployment zone; your opponent can remove them with Sensor Sweep. VP for destroying enemy units at objectives, for controlling objectives and when only one of your markers remains, guarded by your units.',
    note: 'Start of the battle: select five terrain areas not within your deployment zone and place one of your operation markers within each. Your opponent can remove them with the Sensor Sweep action.',
    trk: [{ id: 'mk', label: 'Your operation markers on the battlefield' }],
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'One or more enemy units that started the turn within range of an objective were destroyed', a: c => c.kills('obj') > 0 },
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'Only one of your operation markers is on the battlefield, one or more of your units are within the same terrain area as it and no enemy units are within that terrain area' },
      NH4,
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'Only one of your operation markers is on the battlefield, one or more of your units are within the same terrain area as it and no enemy units are within that terrain area' }
    ]
  },
  // ───────── Reconnaissance ─────────
  reconnaissance_sweep: {
    name: 'Reconnaissance Sweep', deck: 're', desc: 'Recon by presence: VP for friendly units wholly within three or four different table quarters (not within 6" of the centre), for each enemy unit destroyed and for controlling one or more objectives (excluding your home objective).',
    c: [
      { w: 'turn', r: ALL, k: 'choice', t: 'Friendly units wholly within different table quarters and not within 6" of the centre of the battlefield', opts: [{ t: 'Three or more units in three quarters', vp: 3 }, { t: 'Four or more units in four quarters', vp: 6 }] },
      { w: 'turn', r: ALL, k: 'per', vp: 1, t: 'For each enemy unit destroyed this turn', a: c => c.kills() },
      Object.assign({}, NH4, { vp: 3 })
    ]
  },
  triangulation: {
    name: 'Triangulation', deck: 're', desc: 'With the Triangulate action (from the second battle round) you mark objectives. VP for controlling objectives, for triangulated objectives and, at the end of the battle, for controlling four or more objectives.',
    note: 'Triangulate action (your Shooting phase, from the second battle round, once per turn): a friendly unit within range of an objective (excluding your home objective); completes at the end of your turn if the unit controls that objective → place an operation marker.',
    trk: [{ id: 'tri', label: 'Triangulated objectives', obj: true, mark: 'Triangulated' }],
    c: [
      NH4,
      { w: 'turn', r: R2, k: 'choice', t: 'Objectives triangulated', opts: [{ t: 'One objective', vp: 3 }, { t: 'Two objectives', vp: 6 }, { t: 'Three or more objectives', vp: 10 }], a: c => Math.min(c.trk('tri'), 3) - 1 },
      { w: 'end', r: ALL, k: 'bool', vp: 10, t: 'You control four or more objectives', a: c => c.myObjs >= 4 }
    ]
  },
  surveil_the_foe: {
    name: 'Surveil the Foe', deck: 're', desc: 'With the Surveil the Foe action you surveil enemy units. VP for surveilled units, for controlling objectives, for controlling more objectives than your opponent and when none of your opponent\'s operation markers are on the battlefield.',
    note: 'Surveil the Foe action (your Shooting phase, unlimited, completes immediately): select one enemy unit within 18" of and visible to your unit – it is surveilled until the end of the turn. Each time a friendly unit ends a move within range of an objective that has your opponent\'s operation markers within range of it, remove those markers.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'One or more enemy units were surveilled this turn (unless each of those units is within range of an objective that has an operation marker within range of it)' },
      NH4,
      MORE(4),
      { w: 'turn', r: R2, k: 'bool', vp: 5, t: 'None of your opponent\'s operation markers are on the battlefield' }
    ]
  },
  gather_intel: {
    name: 'Gather Intel', deck: 're', desc: 'With the Extract Intelligence action (from the second battle round) you place operation markers at objectives. VP for a central objective in round 1, for completed actions, for controlling objectives and, at the end of the battle, for three or more markers and for a marker at your opponent\'s home objective.',
    note: 'Extract Intelligence action (your Shooting phase, from the second battle round, unlimited, each unit at a different objective): a unit within range of an objective (excluding your home objective) that has none of your operation markers within range; completes at the end of your turn if the unit controls that objective → place an operation marker.',
    trk: [{ id: 'mk', label: 'Your operation markers at objectives', obj: true, mark: 'Marker' }],
    c: [
      { w: 'turn', r: [1, 1], k: 'bool', vp: 6, t: 'You control one or more central objectives', a: c => c.central },
      NH4,
      { w: 'turn', r: R2, k: 'per', vp: 7, t: 'For each friendly unit that completed the Extract Intelligence action this turn' },
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'Three or more of your operation markers are on the battlefield', a: c => c.trk('mk') >= 3 },
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'One of your operation markers is within range of your opponent\'s home objective', a: c => c.markOn('mk', 'oppHome') }
    ]
  },
  search_and_scour: {
    name: 'Search and Scour', deck: 're', desc: 'VP for controlling a central objective, for destroying enemy units that started the turn within a terrain area, for each objective you control (excluding your home objective) and, at the end of the battle, if no enemy units are wholly within your territory.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 3, t: 'You control one or more central objectives', a: c => c.central },
      { w: 'turn', r: ALL, k: 'bool', vp: 2, t: 'One or more enemy units that started the turn within a terrain area were destroyed', a: c => c.kills('terr') > 0 },
      { w: 'cmd5', r: R2, k: 'per', vp: 4, t: 'For each objective you control (excluding your home objective)', a: c => c.myNonHome },
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'No enemy units are wholly within your territory' }
    ]
  },
  // ───────── Priority Assets ─────────
  secure_asset: {
    name: 'Secure Asset', deck: 'pa', desc: 'With the Secure Asset action you secure the asset. VP for the action, for destroying enemy units that started the turn near a central objective, for controlling objectives and for controlling three or more objectives.',
    note: 'Secure Asset action (your Shooting phase, once per turn): a friendly unit within range of an objective (excluding your home objective); completes at the end of your turn if the unit controls that objective.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'A friendly unit secured the asset this turn' },
      { w: 'turn', r: ALL, k: 'bool', vp: 2, t: 'One or more enemy units that started the turn within range of a central objective were destroyed', a: c => c.kills('cen') > 0 },
      NH4,
      { w: 'cmd5', r: R2, k: 'bool', vp: 4, t: 'You control three or more objectives', a: c => c.myObjs >= 3 }
    ]
  },
  vital_link: {
    name: 'Vital Link', deck: 'pa', desc: 'With the Maintain Control action you place operation markers at central objectives. VP for controlling central objectives (bonus per marker), for controlling objectives (bonus for a central one) and, at the end of the battle, for your opponent\'s home objective.',
    note: 'Maintain Control action (your Shooting phase, once per turn): a friendly unit within range of a central objective; completes at the end of your turn if the unit controls that objective → place an operation marker within range of it.',
    trk: [{ id: 'mk', label: 'Your operation markers at central objectives', obj: true, mark: 'Marker', only: 'central' }],
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 2, t: 'You control one or more central objectives', a: c => c.central },
      { w: 'turn', r: ALL, k: 'per', vp: 1, sub: 1, t: '+ for each of your operation markers within range of one of those (controlled) objectives', a: c => c.marksCtrl('mk') },
      NH4,
      { w: 'cmd5', r: R2, k: 'bool', vp: 4, sub: 1, t: '+ one or more of those objectives is a central objective', a: c => c.central },
      { w: 'end', r: ALL, k: 'bool', vp: 10, t: 'You control your opponent\'s home objective', a: c => c.oppHome }
    ]
  },
  extract_relic: {
    name: 'Extract Relic', deck: 'pa', desc: 'With the Sensor Sweep action you remove operation markers. VP for the action, for destroying enemy units at objectives, for controlling objectives and when only one of your opponent\'s operation markers remains, guarded by your units.',
    note: 'Sensor Sweep action (your Shooting phase, once per turn): a friendly unit within range of a central objective; completes at the end of your turn if the unit controls that objective → remove one operation marker from the battlefield (cannot be started if only one operation marker is on the battlefield).',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'A friendly unit performed a sensor sweep this turn' },
      { w: 'turn', r: ALL, k: 'bool', vp: 3, t: 'One or more enemy units that started the turn within range of an objective were destroyed', a: c => c.kills('obj') > 0 },
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'Only one of your opponent\'s operation markers is on the battlefield, one or more of your units are within the same terrain area as it and no enemy units are within that terrain area' },
      NH4,
      { w: 'end', r: ALL, k: 'bool', vp: 5, t: 'Only one of your opponent\'s operation markers is on the battlefield, one or more of your units are within the same terrain area as it and no enemy units are within that terrain area' }
    ]
  },
  vanguard_operation: {
    name: 'Vanguard Operation', deck: 'pa', desc: 'With the Vanguard Operation action you push into terrain within your opponent\'s territory. VP for completed actions, for destroying enemy units, for controlling objectives and, at the end of the battle, for your opponent\'s home objective.',
    note: 'Vanguard Operation action (your Shooting phase, once per turn): a friendly unit within a terrain area that is within your opponent\'s territory; completes at the end of your turn if no enemy units are within that terrain area.',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 4, t: 'A friendly unit performed a vanguard operation this turn' },
      Object.assign({}, KILL(2)),
      NH4,
      { w: 'end', r: ALL, k: 'bool', vp: 10, t: 'You control your opponent\'s home objective', a: c => c.oppHome }
    ]
  },
  sabotage: {
    name: 'Sabotage', deck: 'pa', desc: 'With the Sabotage action (each unit at a different objective) your units commit sabotage. VP for each unit that committed sabotage, with a bonus for those within range of an objective in your opponent\'s territory, plus VP for controlling objectives.',
    note: 'Sabotage action (your Shooting phase, unlimited, each unit at a different objective): a unit within range of an objective (excluding your home objective); completes at the end of your turn if the unit controls that objective.',
    c: [
      { w: 'turn', r: ALL, k: 'per', vp: 3, t: 'For each friendly unit that committed sabotage this turn' },
      { w: 'turn', r: ALL, k: 'per', vp: 2, sub: 1, t: '+ for each of those units within range of an objective in your opponent\'s territory' },
      NH4
    ]
  }
};

// Secondary missions · fixed: can be chosen as a Fixed Mission
const SECONDARY = {
  no_prisoners: {
    name: 'No Prisoners',
    c: [{ w: 'any', r: ALL, k: 'per', vp: 2, max: 5, t: 'For each enemy unit destroyed this turn', a: c => c.kills() }]
  },
  overwhelming_force: {
    name: 'Overwhelming Force',
    c: [{ w: 'any', r: ALL, k: 'per', vp: 3, max: 5, t: 'For each enemy unit that started the turn within range of an objective and is destroyed', a: c => c.kills('obj') }]
  },
  plunder: {
    name: 'Plunder',
    note: 'Plunder action (your Shooting phase, once per turn): a unit within a terrain area that is not within your territory plunders it immediately.',
    drawn: { kind: 'conflict', other: 'cleanse', text: 'If Cleanse is active for you, you can shuffle Plunder back into your deck and draw a new card.' },
    c: [{ w: 'turn', r: ALL, k: 'bool', vp: 5, t: 'A terrain area was plundered this turn' }]
  },
  display_of_might: {
    name: 'Display of Might',
    c: [
      { w: 'turn', r: ALL, k: 'bool', vp: 2, t: 'More friendly units than enemy units (excluding AIRCRAFT and battle-shocked units) wholly within No Man\'s Land' },
      { w: 'oppt', r: ALL, k: 'bool', vp: 5, t: 'End of your opponent\'s turn: more friendly units than enemy units (excluding AIRCRAFT and battle-shocked units) wholly within No Man\'s Land' }
    ]
  },
  outflank: {
    name: 'Outflank',
    c: [{ w: 'turn', r: ALL, k: 'choice', t: 'Friendly units (excluding AIRCRAFT and battle-shocked units) at battlefield edges', opts: [{ t: 'One or more within 6" of a battlefield edge and not within your territory', vp: 3 }, { t: 'Two or more within 6" of opposite battlefield edges, one or more of them not within your territory', vp: 5 }] }]
  },
  beacon: {
    name: 'Beacon',
    drawn: { kind: 'unit', text: 'Select one friendly unit on the battlefield or embarked within a TRANSPORT on the battlefield to be your beacon unit.' },
    c: [{ w: 'opp', r: ALL, k: 'choice', t: 'Your beacon unit is on the battlefield …', opts: [{ t: '… and not within your deployment zone', vp: 3 }, { t: '… and not within your territory', vp: 5 }] }]
  },
  cleanse: {
    name: 'Cleanse',
    note: 'Cleanse action (your Shooting phase, unlimited, each unit at a different objective, excluding your home objective): completes at the end of your turn if the unit is controlling that objective.',
    drawn: { kind: 'conflict', other: 'plunder', text: 'If Plunder is active for you, you can shuffle Cleanse back into your deck and draw a new card.' },
    c: [{ w: 'turn', r: ALL, k: 'choice', t: 'Objectives cleansed by your army this turn', opts: [{ t: 'One objective', vp: 2 }, { t: 'Two or more objectives', vp: 5 }] }]
  },
  grievous_blow: {
    name: 'A Grievous Blow', fixed: true,
    drawn: { kind: 'target', text: 'If there are no enemy units with a starting strength of 13+ on the battlefield, you can discard this card and draw a new one.' },
    c: [{ w: 'any', r: ALL, k: 'per', vp: { F: 4, T: 5 }, max: 5, t: 'For each enemy unit with a starting strength of 13+ destroyed this turn', a: c => c.kills('big') }]
  },
  defend_stronghold: {
    name: 'Defend Stronghold',
    drawn: { kind: 'round1', forced: true, text: 'Drawn in the first battle round: shuffle it back into your deck and draw a new card.' },
    c: [
      { w: 'opp', r: R2, k: 'bool', vp: 3, t: 'You control your home objective', a: c => c.ownHome },
      { w: 'opp', r: R2, k: 'bool', vp: 2, sub: 1, t: '+ no enemy units are within your deployment zone' }
    ]
  },
  engage_on_all_fronts: {
    name: 'Engage on All Fronts', fixed: true,
    c: [{ w: 'turn', r: ALL, k: 'choice', t: 'Presence in table quarters (friendly unit wholly within the quarter, not within 6" of the centre of the battlefield)', opts: [{ t: 'Three table quarters', vp: { F: 2, T: 3 } }, { t: 'Four table quarters', vp: { F: 4, T: 5 } }] }]
  },
  secure_no_mans_land: {
    name: "Secure No Man's Land",
    c: [{ w: 'turn', r: ALL, k: 'bool', vp: 5, t: 'You control two or more objectives within No Man\'s Land (excluding your home objective)', a: c => c.nml >= 2 }]
  },
  forward_position: {
    name: 'Forward Position',
    drawn: { kind: 'round1', text: 'Drawn in the first battle round: you can shuffle it back into your deck and draw a new card.' },
    c: [{ w: 'turn', r: ALL, k: 'bool', vp: 5, t: 'You control your opponent\'s home objective and/or each expansion objective', a: c => c.oppHome || c.allExp }]
  },
  centre_ground: {
    name: 'Centre Ground',
    c: [{ w: 'turn', r: ALL, k: 'choice', t: 'Friendly unit (excluding AIRCRAFT and battle-shocked units) within 3" of the centre of the battlefield …', opts: [{ t: '… and no enemy units within 3" of the centre', vp: 3 }, { t: '… and no enemy units within 6" of the centre', vp: 5 }] }]
  },
  assassination: {
    name: 'Assassination', fixed: true,
    c: [
      { w: 'any', r: ALL, k: 'per', vp: 3, mode: 'F', t: 'For each enemy CHARACTER model destroyed this turn', a: c => c.kills('chr') },
      { w: 'any', r: ALL, k: 'per', vp: 1, mode: 'F', sub: 1, t: '+ for each of those models with a W of 4 or more', a: c => c.kills('chr4') },
      { w: 'any', r: ALL, k: 'bool', vp: 5, mode: 'T', t: 'One or more enemy CHARACTER models were destroyed this turn, or all enemy CHARACTER models have been destroyed during the battle', a: c => c.kills('chr') > 0 }
    ]
  },
  tempting_target: {
    name: 'A Tempting Target',
    drawn: { kind: 'objective', text: 'Your opponent selects one objective (excluding home objectives) within No Man\'s Land to be your tempting target.' },
    c: [{ w: 'turn', r: ALL, k: 'bool', vp: 5, t: 'You control your tempting target', a: c => c.tempting }]
  },
  behind_enemy_lines: {
    name: 'Behind Enemy Lines',
    drawn: { kind: 'round1', text: 'Drawn in the first battle round: you can shuffle it back into your deck and draw a new card.' },
    c: [{ w: 'turn', r: ALL, k: 'per', vp: 3, max: 5, t: 'For each friendly unit (excluding AIRCRAFT and battle-shocked units) wholly within your opponent\'s deployment zone' }]
  },
  bring_it_down: {
    name: 'Bring It Down', fixed: true,
    drawn: { kind: 'target', text: 'If there are no enemy models with a W of 10 or more on the battlefield, you can discard this card and draw a new one.' },
    c: [{ w: 'any', r: ALL, k: 'per', vp: { F: 4, T: 5 }, max: 5, t: 'For each enemy model with a W of 10 or more destroyed this turn', a: c => c.kills('w10') }]
  },
  burden_of_trust: {
    name: 'Burden of Trust',
    note: 'When drawn and at the start of each of your turns: for each objective, you can select one friendly unit on the battlefield to guard it. The objective is guarded while that unit is within range of it and you control it.',
    drawn: { kind: 'guard', text: 'When drawn and at the start of each of your turns: for each objective, you can select one friendly unit on the battlefield to guard it.' },
    c: [{ w: 'opp', r: ALL, k: 'per', vp: 2, max: 5, t: 'For each objective guarded by your army' }]
  }
};

const DEPLOYMENTS = ['Tipping Point', 'Sweeping Engagement', 'Search and Destroy', 'Hammer and Anvil', 'Dawn of War', 'Crucible of Battle'];

const TWISTS = [
  { id: 'nowhere', name: 'Nowhere to Hide', t: 'Terrain features do not have the Solid rule – line of sight can be drawn through any gap in a terrain feature.' },
  { id: 'mirrored', name: 'Mirrored World', t: 'Both players replace their Primary Mission with the same one of: Battlefield Dominance, Meatgrinder, Outmanoeuvre, Gather Intel, Sabotage (agree on one, or roll a D6: 1–5 as listed, 6 = roll again).' },
  { id: 'scrambled', name: 'Scrambled Communications', t: 'The players exchange their Primary Mission cards.' },
  { id: 'pride', name: 'Martial Pride', t: 'A BATTLELINE unit can start an action in a turn in which it made an advance move, and can shoot in a turn in which it started an action.' },
  { id: 'ruin', name: 'Ruinscape', t: 'When a unit makes a normal or advance move, models in that unit have the MOBILE keyword until that move ends.' },
  { id: 'night', name: 'Night Fighting', t: 'Each unit is not visible to enemy models unless they are within 18" of it, and cannot be targeted by [INDIRECT FIRE] weapons unless the attacking model is within 18" of it.' }
];
const MIRRORED = ['battlefield_dominance', 'meatgrinder', 'outmanoeuvre', 'gather_intel', 'sabotage'];

// Core Stratagems · 11th Edition (source: Core Rules, section 15 "Stratagems")
//  whose   'own' = your turn · 'opp' = opponent's turn · 'either' = either player's turn
//  ph      phase ids from PHASES in which the stratagem is used; ['any'] = any phase
//  timing  timing within the phase (display only): 'start' | 'end' | 'during' | 'any'
//  plus    optional additional mode { name, cost, text } (only Heroic Intervention → Into the Fray)
//  orig    original English rules text (WHEN / TARGET / EFFECT / RESTRICTIONS); when/target/effect/restr mirror it
//  once    only once per battle · notRound1 not during the first battle round · t = one-sentence summary
// General rule: each player cannot use the same stratagem more than once in the same phase; each player
// cannot target the same unit with more than one stratagem in the same phase; a player cannot target
// their own battle-shocked units with stratagems.
const STRATAGEMS = [
  {
    id: 'reroll', name: 'Command Re-roll', cost: 1, plus: null, whose: 'either', ph: ['any'], timing: 'any', type: 'Core Stratagem',
    when: 'Any phase, just after you make one of the following rolls for a friendly unit or model: an Advance roll, a Charge roll, a Damage roll, a Hazardous roll, a Hit roll, a Save roll, a Wound roll, or a roll to determine the number of attacks made with a weapon.',
    target: 'That unit or model.',
    effect: 'You re-roll that roll. If you rolled more than one dice together (e.g. the Hit rolls of several attacks), you select one of those dice and re-roll only that one – excluding Charge rolls, which you must re-roll in full.',
    restr: '',
    orig: {
      when: 'Any phase, just after you make one of the following rolls for a friendly unit or model:\n- Advance roll\n- Charge roll\n- Damage roll\n- Hazard roll\n- Hit roll\n- Save roll\n- Wound roll\n- A roll to determine the number of attacks generated with a weapon.',
      target: 'That unit or model.',
      effect: 'You re-roll that roll. If you are rolling more than one dice together, select one of those dice to re-roll (excluding charge rolls, which you must re-roll in full).',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'Re-roll one Advance, Charge, Damage, Hazardous, Hit, Save, Wound or number-of-attacks roll – only one dice if several were rolled together, Charge rolls in full.'
  },
  {
    id: 'insane', name: 'Insane Bravery', cost: 1, plus: null, whose: 'own', ph: ['command'], timing: 'during', type: 'Core Stratagem',
    when: 'Battle-shock step of your Command phase, just before you make a Battle-shock roll for a friendly unit.',
    target: 'That unit.',
    effect: 'That Battle-shock roll is automatically successful.',
    restr: 'You cannot use this Stratagem more than once per battle.',
    orig: {
      when: 'Battle-shock step of your Command phase, just before you make a battle-shock roll for a friendly unit.',
      target: 'That unit.',
      effect: 'That battle-shock roll is automatically successful.',
      restr: 'You cannot use this stratagem more than once per battle.'
    },
    once: true, notRound1: false,
    t: 'A Battle-shock roll is automatically successful – once per battle only.'
  },
  {
    id: 'explosives', name: 'Explosives', cost: 1, plus: null, whose: 'own', ph: ['shooting'], timing: 'during', type: 'Core Stratagem',
    when: 'Your Shooting phase.',
    target: 'One friendly unengaged EXPLOSIVES unit (GRENADES units count as EXPLOSIVES units) that is eligible to shoot and did not make an Advance move this turn.',
    effect: 'Select one EXPLOSIVES model in your unit, then select one unengaged enemy unit that is within 8" of and visible to that model. Roll six D6: for each 4+, that enemy unit suffers 1 mortal wound.',
    restr: '',
    orig: {
      when: 'Your Shooting phase.',
      target: 'One friendly unengaged EXPLOSIVES/GRENADES unit that is eligible to shoot and did not make an advance move this turn.',
      effect: 'Resolve the following sequence:\n- Select one EXPLOSIVES/GRENADES model in your unit.\n- Select one unengaged enemy unit within 8" of and visible to that model.\n- Roll six D6: for each 4+, that enemy unit suffers 1 mortal wound (06.02).',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'Unengaged EXPLOSIVES unit that did not advance: one unengaged enemy unit within 8" and visible – roll six D6, each 4+ inflicts 1 mortal wound.'
  },
  {
    id: 'crushing', name: 'Crushing Impact', cost: 1, plus: null, whose: 'own', ph: ['charge'], timing: 'during', type: 'Core Stratagem',
    when: 'Your Charge phase, just after a friendly MONSTER or VEHICLE unit ends a Charge move.',
    target: 'That MONSTER or VEHICLE unit.',
    effect: 'Select one enemy unit that is engaged with your unit, then select one model in your unit that is engaged with that enemy unit. Roll a number of D6 equal to that model\'s Toughness characteristic: for each 1, your unit suffers 1 mortal wound; for each 5+, that enemy unit suffers 1 mortal wound (to a maximum of 6 mortal wounds).',
    restr: '',
    orig: {
      when: 'Your Charge phase, just after a friendly MONSTER/VEHICLE unit ends a charge move.',
      target: 'That MONSTER/VEHICLE unit.',
      effect: 'Resolve the following sequence:\n- Select one enemy unit engaged with your unit.\n- Select one model in your unit engaged with that enemy unit.\n- Roll a number of D6 equal to the T characteristic of that model: for each 1, your unit suffers 1 mortal wound; for each 5+, that enemy unit suffers 1 mortal wound (to a maximum of 6 mortal wounds per unit).',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'After a MONSTER/VEHICLE ends a Charge move: roll D6 equal to its Toughness – each 5+ inflicts 1 mortal wound on an engaged enemy unit (max. 6), each 1 inflicts 1 mortal wound on your unit.'
  },
  {
    id: 'epic', name: 'Epic Challenge', cost: 1, plus: null, whose: 'either', ph: ['fight'], timing: 'during', type: 'Core Stratagem',
    when: 'Fight phase, just after a friendly CHARACTER unit is selected to fight.',
    target: 'That CHARACTER unit.',
    effect: 'Select one CHARACTER model in your unit. Until the end of the phase, that model\'s melee weapons have the [PRECISION] ability.',
    restr: '',
    orig: {
      when: 'Fight phase, just after a friendly CHARACTER unit is selected to fight.',
      target: 'That CHARACTER unit.',
      effect: 'Select one CHARACTER model in your unit. Until the end of the phase, that model’s melee weapons have the [PRECISION] ability.',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'When a CHARACTER unit is selected to fight, one CHARACTER model\'s melee weapons have [PRECISION] until the end of the phase.'
  },
  {
    id: 'ingress', name: 'Rapid Ingress', cost: 1, plus: null, whose: 'opp', ph: ['movement'], timing: 'end', type: 'Core Stratagem',
    when: 'End of your opponent\'s Movement phase.',
    target: 'One friendly unit that is in Strategic Reserves (excluding AIRCRAFT units).',
    effect: 'Your unit makes an Ingress move: it is set up on the battlefield following the Ingress rules for Strategic Reserves, as if it were your Movement phase.',
    restr: 'You cannot use this Stratagem during the first battle round.',
    orig: {
      when: 'End of your opponent’s Movement phase.',
      target: 'One friendly unit that is in strategic reserves (excluding AIRCRAFT).',
      effect: 'Your unit makes an ingress move (20.04).',
      restr: 'You cannot use this stratagem during the first battle round.'
    },
    once: false, notRound1: true,
    t: 'End of your opponent\'s Movement phase: one unit in Strategic Reserves (excluding AIRCRAFT) makes an Ingress move – not during the first battle round.'
  },
  {
    id: 'overwatch', name: 'Fire Overwatch', cost: 1, plus: null, whose: 'opp', ph: ['movement'], timing: 'end', type: 'Core Stratagem',
    when: 'End of your opponent\'s Movement phase.',
    target: 'One friendly unengaged unit (excluding TITANIC units).',
    effect: 'Your unit shoots using Snap Shooting: it can only target one visible enemy unit within 24" (which must be an eligible target), each attack only scores a hit on an unmodified Hit roll of 6 (regardless of Ballistic Skill or modifiers), Hit rolls cannot be re-rolled, and afterwards your unit is not eligible to start an action until the end of the phase.',
    restr: '',
    orig: {
      when: 'End of your opponent’s Movement phase.',
      target: 'One friendly unengaged unit (excluding TITANIC units).',
      // the EFFECT names snap shooting – its rule (15.09) follows verbatim
      effect: 'Your unit shoots using snap shooting.\n\nSNAP SHOOTING (15.09)\nWHILE SHOOTING:\n- You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target).\n- Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers). Those hits are not critical hits.\n- You cannot re-roll hit rolls.\nAFTER SHOOTING: Until the end of the phase, your unit is not eligible to start an action.',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'End of your opponent\'s Movement phase: one unengaged unit (excluding TITANIC) shoots using Snap Shooting at one visible enemy unit within 24" – hits only on unmodified 6s, no re-rolls.'
  },
  {
    id: 'smoke', name: 'Smokescreen', cost: 1, plus: null, whose: 'opp', ph: ['shooting'], timing: 'start', type: 'Core Stratagem',
    when: 'Start of your opponent\'s Shooting phase.',
    target: 'One friendly SMOKE unit.',
    effect: 'Until the end of the phase, each time an attack targets your SMOKE unit, or targets a unit that is not fully visible to the attacking model because of models in your SMOKE unit, the target has the Benefit of Cover against that attack.',
    restr: '',
    orig: {
      when: 'Start of your opponent’s Shooting phase.',
      target: 'One friendly SMOKE unit.',
      effect: 'Until the end of the phase, each time an attack targets either your SMOKE unit, or a unit that is not fully visible to the attacking model because of one or more models in your SMOKE unit, the target has the benefit of cover against that attack (13.08).',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'Start of your opponent\'s Shooting phase: one SMOKE unit (and units it obscures) has the Benefit of Cover until the end of the phase.'
  },
  {
    id: 'heroic', name: 'Heroic Intervention', cost: 1,
    plus: { name: 'Into the Fray', cost: 1, text: 'Additional mode (+1 CP): when making the Charge roll, if the result (after modifiers) is greater than 6, change it to 6; when selecting charge targets, you can select any enemy units within 6" of your unit and within the maximum charge distance.' },
    whose: 'opp', ph: ['charge'], timing: 'end', type: 'Core Stratagem',
    when: 'End of your opponent\'s Charge phase.',
    target: 'One friendly unengaged unit that is within 12" of one or more enemy units. A VEHICLE unit can only be selected if it is a CHARACTER or WALKER unit.',
    effect: 'Resolve a charge with your unit. Before making the Charge roll, select one of the following modes: Leap to Defend – when selecting the targets of the charge, you can only select enemy units that made a Charge move this phase and are within the maximum charge distance. Into the Fray (this Stratagem costs 1 additional CP) – when making the Charge roll, if the result (after modifiers) is greater than 6, change it to 6; you can select any enemy units within 6" of your unit and within the maximum charge distance as targets of the charge.',
    restr: '',
    orig: {
      when: 'End of your opponent’s Charge phase.',
      target: 'One friendly unengaged unit within 12" of one or more enemy units. You can only select a VEHICLE unit if it is a CHARACTER/WALKER unit.',
      effect: 'Resolve a charge with your unit (11.02). While doing so, before making the charge roll, you must select one of the following modes:\n- Leap to Defend: When selecting charge targets, you can only select enemy units that made a charge move this phase and are within the maximum distance.\n- Into the Fray (+1CP):\n  - When making the charge roll, if the result is greater than 6 (after modifiers), change it to 6.\n  - When selecting charge targets, you can select any enemy units that are within 6" of your unit and within the maximum distance.',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'End of your opponent\'s Charge phase: one unengaged unit within 12" of an enemy resolves a charge – Leap to Defend (only enemy units that charged this phase) or Into the Fray (+1 CP, Charge roll capped at 6, any enemy unit within 6").'
  },
  {
    id: 'counter', name: 'Counteroffensive', cost: 2, plus: null, whose: 'opp', ph: ['fight'], timing: 'during', type: 'Core Stratagem',
    when: 'Fight step of your opponent\'s Fight phase, just after an enemy unit has resolved its attacks.',
    target: 'One friendly unit that is eligible to fight.',
    effect: 'Until the end of the phase, your unit has the Fights First ability and it must be the next unit you select to fight.',
    restr: '',
    orig: {
      when: 'Fight step of your opponent’s Fight phase, just after an enemy unit has resolved its attacks.',
      target: 'One friendly unit that is eligible to fight.',
      effect: 'Until the end of the phase, your unit has the Fights First ability and it must be the next unit you select to fight (12.04).',
      restr: ''
    },
    once: false, notRound1: false,
    t: 'After an enemy unit has resolved its attacks: one friendly unit eligible to fight gains Fights First and must be the next unit you select to fight (2 CP).'
  }
];
// Printed texts are the Core Rules' own wording: WHEN / TARGET / EFFECT / RESTRICTIONS of every core stratagem are the
// verbatim original (orig); summaries (t) are not kept – the app shows original texts only.
for (const s of STRATAGEMS) { if (s.orig) { s.when = s.orig.when; s.target = s.orig.target; s.effect = s.orig.effect; s.restr = s.orig.restr; } delete s.t; }

const PHASES = [
  { id: 'command', name: 'Command', full: 'Command phase' },
  { id: 'movement', name: 'Movement', full: 'Movement phase' },
  { id: 'shooting', name: 'Shooting', full: 'Shooting phase' },
  { id: 'charge', name: 'Charge', full: 'Charge phase' },
  { id: 'fight', name: 'Fight', full: 'Fight phase' },
  { id: 'end', name: 'End', full: 'End of turn' }
];

// Reminders per phase (active player / opponent)
const PHASE_TIPS = {
  command: [
    'Both players gain 1 CP (booked automatically).',
    'Battle-shock roll for each of your units that is battle-shocked or at or below half-strength. Success = no longer battle-shocked.',
    'Battle-shocked units: OC "–", cannot be targeted by your stratagems, cannot start or complete actions.',
    'Use Command abilities, then end of Command phase (primary scoring from round 2).'
  ],
  movement: [
    'Each unit: remain stationary, normal move, advance, or fall back. Coherency: 2" / 9" horizontally.',
    'Ingress from strategic reserves: more than 8" from enemy units, within 6" of a battlefield edge. Not in round 1.',
    'Opponent: Fire Overwatch / Rapid Ingress at the end of the phase.'
  ],
  shooting: [
    'Start mission actions (primary and secondary missions).',
    'Hidden units (INFANTRY/BEASTS/SWARM in light/dense terrain, no ranged attacks this or last turn) are only visible within 15".',
    'Opponent: Smokescreen at the start of the phase.'
  ],
  charge: [
    'Charge: 2D6. Engagement range in the 11th Edition: 2" horizontally, 5" vertically.',
    'Crushing Impact after a MONSTER/VEHICLE ends a charge move.',
    'Opponent: Heroic Intervention at the end of the phase.'
  ],
  fight: [
    'Fights First units first, then alternate. Pile in / consolidate 3".',
    'Epic Challenge for CHARACTER units · Opponent: Counteroffensive (2 CP).'
  ],
  end: [
    'First non-mission rules, then mission scoring for both players (active player first).',
    'Tactical cards: achieved cards are discarded; discard further cards = +1 CP.'
  ]
};

const COLORS = [
  { id: 'blue', name: 'Ultramarine', l: '#2F5FC4', d: '#6F97F2' },
  { id: 'red', name: 'Blood Red', l: '#B23A31', d: '#E06A5E' },
  { id: 'green', name: 'Green', l: '#2D7A4B', d: '#5CC08A' },
  { id: 'gold', name: 'Gold', l: '#A87A12', d: '#E0B447' },
  { id: 'purple', name: 'Violet', l: '#6B45A8', d: '#A887E6' },
  { id: 'bone', name: 'Bone', l: '#6E6552', d: '#CFC3A5' }
];

// Checklist per phase (11th Edition) · you = active player, opp = opponent (one short item per line)
const PHASE_GUIDE = {
  command: {
    you: [
      'Start of Turn step: resolve rules triggered at the start of your turn (e.g. Punishment: select condemned units, Burden of Trust: select guards).',
      'Gain Core CP: both players gain 1 CP (booked automatically).',
      'Battle-shock step: make one battle-shock roll (2D6 vs Ld) for each of your units that is battle-shocked or at or below half-strength – success = no longer battle-shocked.',
      'Battle-shocked units: OC "–", cannot be targeted by your stratagems, cannot start an action and cannot complete one they started.',
      'Insane Bravery (1 CP, once per battle): one battle-shock roll is automatically successful.',
      'Tactical: at the start of the Command phase draw two Secondary Mission cards (they stay active alongside cards you still hold). Once per battle at the end of the Command phase: 1 CP → discard one card and draw a new one.',
      'Command Abilities: resolve rules triggered "in your Command phase".',
      'End of Command phase: primary scoring from round 2 ("end of your Command phase" conditions).'
    ],
    opp: [
      'Also gains 1 CP (Core CP).',
      'No battle-shock step for their units – only the active player rolls.',
      'Command Re-roll (1 CP) is available for their own rolls at any time.'
    ]
  },
  movement: {
    you: [
      'Each unit: remain stationary, normal move, advance (+D6"), or fall back (engaged units only).',
      'Check coherency at the end of each move; TRANSPORTS: resolve embarking and disembark moves (rapid / tactical / combat).',
      'Units that advanced or fell back: restrictions on shooting, charging and actions apply until the end of the turn.',
      'Reinforcements: ingress moves from strategic reserves (within 6" of a battlefield edge, more than 8" from enemy units) – not in round 1; not in your opponent\'s deployment zone before round 3.',
      'Command Re-roll (1 CP): re-roll an advance roll.'
    ],
    opp: [
      'End of the phase: Fire Overwatch (1 CP) – one unengaged unit (excluding TITANIC) shoots using snap shooting at one visible enemy unit within 24".',
      'End of the phase: Rapid Ingress (1 CP) – one unit in strategic reserves makes an ingress move, not in round 1.'
    ]
  },
  shooting: {
    you: [
      'Start mission actions (primary and secondary missions, see the Missions tab).',
      'Select eligible units one at a time, choose the shooting type (normal / assault / close-quarters / indirect), select targets, resolve attacks (visibility, range, cover).',
      'Hidden units (INFANTRY/BEASTS/SWARM in a light/dense terrain area, no ranged attacks this or last turn) are only visible within 15".',
      'Explosives (1 CP): one unengaged EXPLOSIVES unit that did not advance – roll six D6 against an enemy unit within 8", each 4+ inflicts 1 mortal wound.',
      'Command Re-roll (1 CP): re-roll a hit, wound, damage, hazard or number-of-attacks roll.'
    ],
    opp: [
      'Start of the phase: Smokescreen (1 CP) – one SMOKE unit (and units it obscures) has the benefit of cover until the end of the phase.',
      'Command Re-roll (1 CP): re-roll a save roll.'
    ]
  },
  charge: {
    you: [
      'Declare a charge: select targets within 12", roll 2D6, the charge move must end engaged with every charge target.',
      'Units that advanced or fell back cannot declare a charge (unless a rule says otherwise).',
      'Crushing Impact (1 CP): just after a MONSTER/VEHICLE unit ends a charge move.',
      'Command Re-roll (1 CP): re-roll a failed charge roll in full.'
    ],
    opp: [
      'End of the phase: Heroic Intervention (1 CP, +1 CP for Into the Fray) – one unengaged unit within 12" of an enemy unit resolves a charge.'
    ]
  },
  fight: {
    you: [
      'Pile in (3"), active player first. Then Fights First combats (units that charged and Fights First units), then all remaining combats, alternating.',
      'Each unit: select weapons, select targets, resolve attacks, then consolidate (3").',
      'Epic Challenge (1 CP): one CHARACTER model\'s melee weapons have [PRECISION] until the end of the phase.',
      'Command Re-roll (1 CP): re-roll a hit, wound or damage roll.'
    ],
    opp: [
      'Fights alternately as well – their own Fights First units also fight in the first step.',
      'Counteroffensive (2 CP): just after an enemy unit has resolved its attacks, one of their units gains Fights First and fights next.',
      'Epic Challenge (1 CP) can also be used in the opponent\'s turn.'
    ]
  },
  end: {
    you: [
      'First resolve all non-mission rules triggered at the end of your turn; remove models that are out of coherency.',
      'Then mission scoring: the active player first, then the opponent ("end of your turn" / "end of a turn" conditions; in round 5 also "end of Command phase (R5: end of turn)").',
      'Tactical cards: achieved cards are discarded; discard further cards = +1 CP.',
      'After the second turn of the round the next battle round starts – after round 5 the end-of-battle scoring follows.'
    ],
    opp: [
      'Scores their own "end of your opponent\'s turn" / "end of a turn" conditions (e.g. Display of Might, Defend Stronghold, Burden of Trust).',
      'Discards achieved tactical cards; discarding further cards = +1 CP.'
    ]
  }
};

// Kill-sheet tags for "enemy unit destroyed" · short = short label for lists
const KILL_TAGS = [
  { id: 'obj', label: 'Started the turn within range of an objective', short: 'At objective', hint: 'Purge and Secure · Locate and Deny · Extract Relic · Overwhelming Force' },
  { id: 'cen', label: '… within range of a central objective', short: 'Central objective', hint: 'Secure Asset' },
  { id: 'terr', label: 'Started the turn within a terrain area', short: 'Terrain', hint: 'Death Trap (trapped terrain area) · Search and Scour' },
  { id: 'cond', label: 'Condemned unit (Punishment)', short: 'Condemned', hint: 'Only for the Punishment primary mission' },
  { id: 'big', label: 'Starting strength of 13+ models', short: '13+ models', hint: 'A Grievous Blow' },
  { id: 'chr', label: 'CHARACTER model', short: 'CHARACTER', hint: 'Assassination' },
  { id: 'chr4', label: 'CHARACTER with W 4+', short: 'W4+', hint: 'Assassination (Fixed): +1 VP for each CHARACTER with a W of 4 or more' },
  { id: 'w10', label: 'Model with W 10+', short: 'W10+', hint: 'Bring It Down' }
];

// Explanations for the stratagem lock (opts.stratLock)
const STRAT_LOCK = {
  phase: '11th Edition rule: each player cannot use the same stratagem more than once in the same phase, and cannot target the same unit with more than one stratagem in the same phase. In addition: Insane Bravery only once per battle, Rapid Ingress not during the first battle round, battle-shocked units cannot be targeted by their controlling player\'s stratagems.',
  round: 'House rule: each stratagem can only be used once per battle round (in addition to the rule that a unit can only be the target of one stratagem per phase). Insane Bravery remains once per battle, Rapid Ingress not during the first battle round.'
};

// Display labels
const TIMING_LABELS = { cmd: 'End of your Command phase', cmd5: 'End of your Command phase (round 5: end of your turn)', turn: 'End of your turn', any: 'End of any turn', opp: 'End of opponent\'s turn / end of round 5', oppt: 'End of opponent\'s turn', end: 'End of the battle' };
const WHOSE_LABELS = { own: 'Your turn', opp: "Opponent's turn", either: 'Either turn' };
const TIMING_WORDS = { start: 'Start', end: 'End', during: 'During', any: '' };

// Name suggestions for per-player army resource counters
const RES_PRESETS = [{ name: 'Yield Points (Votann)' }, { name: 'Waaagh! Tracker (Orks)' }, { name: 'Miracle Dice (Adepta Sororitas)' }, { name: 'Fate Dice (Aeldari)', max: 6 }, { name: 'Pain Tokens (Drukhari)' }, { name: 'Blood Tithe (Khorne Daemonkin)' }, { name: 'Resurgence Points (Genestealer Cults)' }, { name: 'Custom counter' }];


// ───────── Deployment cards (Chapter Approved 2026-27) ─────────
// Coordinates in inches on a 44" wide × 60" long battlefield, Attacker's edge at the top (or left),
// exactly as on the Deployment card. zones = deployment zones as polygons (a = Attacker, d = Defender),
// line = dashed territory boundary, home = home objectives, exp = expansion objectives, centre always at (22,30);
// with two central objectives (D6 = 6) they are located 6" either side of the centre along the territory boundary.
const arc = (cx, cy, r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([+(cx + r * Math.cos(t)).toFixed(2), +(cy + r * Math.sin(t)).toFixed(2)]); } return out; };
const DEPLOYMENT_MAPS = {
  'Tipping Point': {
    zones: { a: [[0, 0], [44, 0], [44, 12], [22, 12], [22, 20], [0, 20]], d: [[44, 60], [0, 60], [0, 48], [22, 48], [22, 40], [44, 40]] },
    line: [[0, 34], [44, 26]], home: { a: [11, 14], d: [33, 46] }, exp: [[38, 24], [6, 36]]
  },
  'Sweeping Engagement': {
    zones: { a: [[0, 0], [14, 0], [14, 30], [8, 30], [8, 60], [0, 60]], d: [[44, 0], [36, 0], [36, 30], [30, 30], [30, 60], [44, 60]] },
    line: [[25, 0], [19, 60]], home: { a: [10, 14], d: [34, 46] }, exp: [[30, 10], [14, 50]]
  },
  'Search and Destroy': {
    zones: {
      a: [[0, 0], [22, 0]].concat(arc(22, 30, 9, -90, -180, 8), [[0, 30]]),
      d: [[44, 60], [22, 60]].concat(arc(22, 30, 9, 90, 0, 8), [[44, 30]])
    },
    line: [[0, 60], [44, 0]], home: { a: [10, 14], d: [34, 46] }, exp: [[34, 14], [10, 46]], circle: [22, 30, 9]
  },
  'Hammer and Anvil': {
    zones: { a: [[0, 0], [44, 0], [44, 18], [0, 18]], d: [[0, 60], [44, 60], [44, 42], [0, 42]] },
    line: [[0, 30], [44, 30]], home: { a: [10, 14], d: [34, 46] }, exp: [[36, 24], [8, 36]]
  },
  'Dawn of War': {
    zones: { a: [[0, 0], [12, 0], [12, 60], [0, 60]], d: [[44, 0], [32, 0], [32, 60], [44, 60]] },
    line: [[22, 0], [22, 60]], home: { a: [10, 30], d: [34, 30] }, exp: [[25, 10], [19, 50]]
  },
  'Crucible of Battle': {
    zones: { a: [[0, 0], [44, 0], [0, 30]], d: [[44, 60], [0, 60], [44, 30]] },
    line: [[0, 45], [44, 15]], home: { a: [10, 12], d: [34, 48] }, exp: [[34, 15], [10, 45]]
  }
};
const MAP_SIZE = [44, 60];

/* Datasheet rules that give CP without a roll – offered by the engine at the right moment (unit.cpRules, set at the
 * army import → s.cpOffers, confirmed by the player with cp.offer; never booked by themselves): army rules a unit has as
 * a faction ability (Da Boss, Transhuman Strategist) and unit abilities. Matched against the BSData text without markup. */
const CP_RULES = [
  { scope: 'army', when: 'roundStart', req: 'warlord', cp: 1, re: /^At the start of the battle round, if a model with this ability is your WARLORD, gain 1 ?CP\.?$/i },
  { scope: 'unit', when: 'commandStart', req: 'onField', cp: 1, re: /^At the start of your Command phase, if this model is on the battlefield, you gain 1 ?CP\.?$/i }
];

export const WH = { DISPOSITIONS, MATRIX, PRIMARY, SECONDARY, DEPLOYMENTS, TWISTS, MIRRORED, STRATAGEMS, PHASES, PHASE_TIPS, PHASE_GUIDE, KILL_TAGS, STRAT_LOCK, TIMING_LABELS, WHOSE_LABELS, TIMING_WORDS, RES_PRESETS, COLORS, DEPLOYMENT_MAPS, MAP_SIZE, CP_RULES };
