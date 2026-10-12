/* Aeldari – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/aeldari.json; effect texts are short English summaries of the CHANGE only.
 * Agile Manoeuvres are referenced by the Battle Focus army rule ("see codex"); their effects follow the
 * faction reminders in data/factions/aeldari.js. */
const FATE = 'Fate Dice';

const seersGuidance = { id: 'seers-guidance', name: 'Seers’ Guidance', kind: 'toggle', source: 'detachment', limit: 'round', duration: 'instant', when: 'Once per battle round', effect: 'Replaces Strands of Fate · Command Re-roll Stratagem for 0CP on one unit with this ability' };

export default {
  faction: 'aeldari',
  effects: [
    { id: 'strands-of-fate', name: 'Strands of Fate', kind: 'always', source: 'army', scope: 'Any phase', effect: 'Once per phase: replace one Advance, Battle-shock, Charge, Damage, Hit, Save or Wound roll with a Fate dice (counts as unmodified)' },
    {
      id: 'battle-focus', name: 'Battle Focus', kind: 'choice', source: 'army', pick: 'multi', max: 6,
      when: 'Trigger occurs: spend 1 Battle Focus token (ASURYANI: 2/4/6 per battle round, unspent lost at its end); one Agile Manoeuvre per unit per phase',
      duration: 'this phase',
      options: [
        { id: 'swift-as-the-wind', name: 'Swift as the Wind', effect: '+2" Move' },
        { id: 'flitting-shadows', name: 'Flitting Shadows', effect: 'No Fire Overwatch against this unit' },
        { id: 'star-engines', name: 'Star Engines', effect: 'VEHICLE: ranged weapons have [ASSAULT] after Advancing' },
        { id: 'opportunity-seized', name: 'Opportunity Seized', effect: 'Enemy unit Falls Back from this unit (not TITANIC): Normal move of up to D6+1"' },
        { id: 'fade-back', name: 'Fade Back', effect: 'After an enemy unit has shot, a unit hit by it (not TITANIC): Normal move of up to D6+1"' },
        { id: 'sudden-strike', name: 'Sudden Strike', effect: 'Selected to fight: Pile in and Consolidate up to 6"' }
      ]
    }
  ],
  detachments: {
    'aeldari--aspect-host': [
      { id: 'path-of-the-warrior', name: 'Path of the Warrior', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'ASPECT WARRIORS / AVATAR OF KHAINE unit selected to shoot or fight', duration: 'this phase',
        options: [
          { id: 'rr-hit-1', name: 'Re-roll Hit rolls of 1', effect: 'Re-roll Hit rolls of 1' },
          { id: 'rr-wound-1', name: 'Re-roll Wound rolls of 1', effect: 'Re-roll Wound rolls of 1' }
        ] }
    ],
    'aeldari--warhost': [
      { id: 'martial-grace', name: 'Martial Grace', kind: 'always', source: 'detachment', effect: '+1 Battle Focus token at the start of the battle round · Swift as the Wind: additional +1" Move · +1 to D6 rolls of Agile Manoeuvres' }
    ],
    'aeldari--ghosts-of-the-webway': [
      { id: 'acrobatic-onslaught', name: 'Acrobatic Onslaught', kind: 'always', source: 'detachment', effect: 'HARLEQUINS models can move through enemy models when making a Charge move' },
      { id: 'travelling-players', name: 'Travelling Players', kind: 'always', source: 'detachment', effect: 'TROUPE units have BATTLELINE · TROUPE models have OC 2' }
    ],
    'aeldari--windrider-host': [
      { id: 'ride-the-wind', name: 'Ride the Wind', kind: 'always', source: 'detachment', effect: 'ASURYANI MOUNTED / VYPER units can start in Reserves and arrive as from Strategic Reserves (battle round counts as one higher) · End of your opponent’s turn: up to 1/2/3 such unengaged units back into Strategic Reserves · WINDRIDERS have BATTLELINE' }
    ],
    'aeldari--corsair-coterie': [
      { id: 'relentless-raiders', name: 'Relentless Raiders', kind: 'always', source: 'detachment', effect: 'Enemy unit ends a Normal/Advance/Fall Back/Charge move within range of an objective marker you control: on a 2+ it suffers D3 mortal wounds · ANHRATHE (Void Thieves): objective marker in range at the end of a phase stays under your control until the opponent’s Level of Control is greater' }
    ],
    'aeldari--devoted-of-ynnead': [
      { id: 'lethal-intent', name: 'Lethal Intent', kind: 'always', source: 'detachment', effect: 'End of your opponent’s Shooting phase, if a YNNARI unit was destroyed: one YNNARI INFANTRY / MOUNTED unit within 6" of it can make a Normal move of up to D6+1"' },
      { id: 'lethal-surge', name: 'Lethal Surge', kind: 'toggle', source: 'detachment', limit: 'turn', duration: 'instant', when: 'YNNARI unit performs Fade Back', effect: 'Surge move of up to D6+1" instead of a Normal move' },
      { id: 'lethal-reprisal', name: 'Lethal Reprisal', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'Start of the Fight phase: one YNNARI unit (not TITANIC) below its Starting Strength has Fights First' },
      { id: 'servants-of-the-whispering-god', name: 'Servants of the Whispering God', kind: 'always', source: 'detachment', effect: 'ASURYANI units (not EPIC HERO) gain YNNARI' }
    ],
    'aeldari--seer-council': [
      { id: 'strands-of-fate-council', name: 'Strands of Fate (Seer Council)', kind: 'always', source: 'detachment', effect: 'Start of the first battle round: detachment Fate dice pool (3/6/9 D6) · Detachment Stratagems: discard a Fate dice showing the matching value for −1CP (Presentiment of Dread 1, Forewarned 2, Unshrouded Truth 3, Fate Inescapable 4, Isha’s Fury 5, Psychic Shield 6)' }
    ],
    'aeldari--eldritch-raiders': [
      { id: 'yriels-own', name: 'Yriel’s Own', kind: 'always', source: 'detachment', effect: 'AELDARI units can charge after Advancing · ANHRATHE / RANGERS / SHROUD RUNNERS: re-roll Advance rolls' }
    ],
    'aeldari--serpent-s-brood': [
      { id: 'boons-of-the-brood', name: 'Boons of the Brood', kind: 'always', source: 'detachment', effect: 'HARLEQUINS MOUNTED / VEHICLE weapons have [SUSTAINED HITS 1] · HARLEQUINS unit disembarks: its weapons have [SUSTAINED HITS 1] until the end of the turn' },
      { id: 'travelling-players', name: 'Travelling Players', kind: 'always', source: 'detachment', effect: 'TROUPE units have BATTLELINE · TROUPE models have OC 2' }
    ],
    'aeldari--guardian-battlehost': [
      { id: 'defend-at-all-costs', name: 'Defend at All Costs', kind: 'always', source: 'detachment', effect: 'DIRE AVENGER / GUARDIAN / SUPPORT WEAPON / WAR WALKER attacks: +1 to Hit if the attacker’s unit and/or the target is within range of an objective marker' }
    ],
    'aeldari--spirit-conclave': [
      { id: 'shepherds-of-the-dead', name: 'Shepherds of the Dead', kind: 'always', source: 'detachment', effect: 'Enemy unit that destroys an ASURYANI PSYKER gains a Vengeful Dead token: WRAITH CONSTRUCT attacks vs it +1 to Hit and +1 to Wound · WRAITHBLADES / WRAITHGUARD / WRAITHLORD within 12" of an ASURYANI PSYKER have Battle Focus · WRAITHBLADES / WRAITHGUARD have BATTLELINE' }
    ],
    'aeldari--fateful-performance': [
      { id: 'acrobatic-onslaught', name: 'Acrobatic Onslaught', kind: 'always', source: 'detachment', effect: 'HARLEQUINS units can move through enemy models while making a Charge move' }
    ],
    'aeldari--armoured-warhost': [
      { id: 'skilled-crews', name: 'Skilled Crews', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'AELDARI VEHICLE ranged attacks have [ASSAULT]' }
    ],
    'aeldari--path-of-the-outcast': [
      { id: 'far-reaching-doom', name: 'Far-reaching Doom', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'RANGERS / SHROUD RUNNERS selected to shoot: enemy units have +6" detection range until that unit has shot' }
    ],
    'aeldari--twilight-flickers': [
      { id: 'dance-of-distortion', name: 'Dance of Distortion', kind: 'always', source: 'detachment', effect: 'HARLEQUINS units have Stealth (benefit of cover vs ranged attacks)' }
    ],
    'aeldari--khaine-s-arrow': [
      seersGuidance,
      { id: 'unerring-strike', name: 'Unerring Strike', kind: 'always', source: 'detachment', scope: 'Movement', effect: 'AELDARI Normal move: can attempt to operate a closed Hatchway within 1" (no enemy within 1" of it) · −2" Move this phase if it does' }
    ],
    'aeldari--protector-host': [
      seersGuidance,
      { id: 'determined-defence', name: 'Determined Defence', kind: 'always', source: 'detachment', effect: 'GUARDIANS / DIRE AVENGERS within range of an objective marker: +1 to armour saving throws' }
    ],
    'aeldari--wraiths-of-the-void': [
      seersGuidance,
      { id: 'wraith-marked', name: 'Wraith-Marked', kind: 'always', source: 'detachment', scope: 'Command', effect: 'Your Command phase: one AELDARI unit within range of an objective marker you control takes a Leadership test (−2 for WRAITH CONSTRUCT): if passed, that objective marker is Secured' }
    ],
    'aeldari--star-dancer-masque': [
      seersGuidance,
      { id: 'faolchus-last-flight', name: 'Faolchú’s Last Flight', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'AELDARI model destroyed by a melee attack before it has fought: on a 3+ it fights before being removed' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  // Seer Council: discount from the detachment rule Strands of Fate (discard a matching Fate dice).
  stratAddons: {
    'Presentiment of Dread': [{ id: 'fate-1', name: '−1CP (Fate dice 1)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 1: −1CP' }],
    'Forewarned': [{ id: 'fate-2', name: '−1CP (Fate dice 2)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 2: −1CP' }],
    'Unshrouded Truth': [{ id: 'fate-3', name: '−1CP (Fate dice 3)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 3: −1CP' }],
    'Fate Inescapable': [{ id: 'fate-4', name: '−1CP (Fate dice 4)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 4: −1CP' }],
    'Isha’s Fury': [{ id: 'fate-5', name: '−1CP (Fate dice 5)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 5: −1CP' }],
    'Psychic Shield': [{ id: 'fate-6', name: '−1CP (Fate dice 6)', resource: FATE, cost: 1, cpDelta: -1, effect: 'Discard a Fate dice showing 6: −1CP' }]
  }
};
