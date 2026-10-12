/* Adeptus Custodes – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/adeptus-custodes.json; effect texts are short English summaries of the CHANGE only. */
const FOCUSED_KATAH = {
  id: 'focused-katah', name: 'Focused Ka’tah', kind: 'choice', source: 'detachment', pick: 'one',
  when: 'Start of the Fight phase (replaces the per-unit stance)', duration: 'this phase',
  options: [
    { id: 'dacatarai', name: 'Dacatarai Stance', limit: 'battle', effect: 'Melee weapons gain [SUSTAINED HITS 1]' },
    { id: 'rendax', name: 'Rendax Stance', limit: 'battle', effect: 'Melee weapons gain [LETHAL HITS]' }
  ]
};

export default {
  faction: 'adeptus-custodes',
  effects: [
    { id: 'martial-katah', name: 'Martial Ka’tah', kind: 'choice', source: 'army', pick: 'one',
      when: 'Each time a unit is selected to fight (per unit)', duration: 'until that unit has finished making its attacks',
      options: [
        { id: 'dacatarai', name: 'Dacatarai Stance', effect: 'Melee weapons gain [SUSTAINED HITS 1]' },
        { id: 'rendax', name: 'Rendax Stance', effect: 'Melee weapons gain [LETHAL HITS]' }
      ] }
  ],
  detachments: {
    'adeptus-custodes--lions-of-the-emperor': [
      { id: 'against-all-odds', name: 'Against All Odds', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES units (not VEHICLE) with no other friendly unit within 6": +1 to Hit and +1 to Wound' }
    ],
    'adeptus-custodes--talons-of-the-emperor': [
      { id: 'null-aegis', name: 'Null Aegis (Aura)', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES units within 6" of an ANATHEMA PSYKANA unit: Feel No Pain 5+ vs Psychic Attacks and mortal wounds' },
      { id: 'deadly-unity', name: 'Deadly Unity (Aura)', kind: 'always', source: 'detachment', effect: 'ANATHEMA PSYKANA units within 6" of another ADEPTUS CUSTODES unit: +1 to Hit' }
    ],
    'adeptus-custodes--auric-champions': [
      { id: 'assemblage-of-might', name: 'Assemblage of Might', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES CHARACTER attacks vs the enemy unit selected at the start of your Command phase: +1 to Wound' }
    ],
    'adeptus-custodes--shield-host': [
      { id: 'martial-mastery', name: 'Martial Mastery', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round', duration: 'battle round',
        options: [
          { id: 'crit-5', name: 'Critical Hits on 5+', effect: 'Melee attacks of models with Martial Ka’tah: Critical Hit on unmodified 5+' },
          { id: 'ap', name: 'Improve AP', effect: 'Melee weapons of models with Martial Ka’tah: improve AP by 1' }
        ] }
    ],
    'adeptus-custodes--null-maiden-vigil': [
      { id: 'creeping-dread', name: 'Creeping Dread (Aura)', kind: 'always', source: 'detachment', effect: 'Opponent’s Battle-shock step: enemy PSYKER units or units below Starting Strength within 12" of ANATHEMA PSYKANA models must take a Battle-shock test (−1 if Below Half-strength)' }
    ],
    'adeptus-custodes--solar-spearhead': [
      { id: 'auric-armour', name: 'Auric Armour', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES VEHICLE units: at Starting Strength +2 OC (not AIRCRAFT / Battle-shocked) · below Starting Strength re-roll Hit rolls of 1 · Below Half-strength also re-roll Wound rolls of 1' },
      { id: 'moritoi-ancients', name: 'Moritoi Ancients', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES WALKER units: +2" Move, +1 to Advance and Charge rolls' }
    ],
    'adeptus-custodes--tharanatoi-hammerblow': [
      { id: 'the-hammer-falls', name: 'The Hammer Falls', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES TERMINATOR units that made an ingress move this turn: re-roll Charge rolls' }
    ],
    'adeptus-custodes--silent-hunters': [
      { id: 'skin-crawling-disorientation', name: 'Skin-crawling Disorientation', kind: 'always', source: 'detachment', effect: 'ANATHEMA PSYKANA units can start an action after an advance move · In your Shooting phase, null one visible enemy unit within 12" – nulled units have +3" detection range' }
    ],
    'adeptus-custodes--might-of-the-moritoi': [
      { id: 'march-of-the-honoured-dead', name: 'March of the Honoured Dead', kind: 'always', source: 'detachment', effect: 'ADEPTUS CUSTODES WALKER units: +2" M, +1 to Advance and Charge rolls' }
    ],
    'adeptus-custodes--voyagers-in-darkness': [
      FOCUSED_KATAH,
      { id: 'overwhelming-magnificence', name: 'Overwhelming Magnificence', kind: 'always', source: 'detachment', effect: 'Enemy units within Engagement Range of ADEPTUS CUSTODES units: −1 OC' }
    ],
    'adeptus-custodes--black-ship-guardians': [
      FOCUSED_KATAH,
      { id: 'priority-quarry', name: 'Priority Quarry', kind: 'always', source: 'detachment', effect: 'Up to 2 quarries (one must be the enemy WARLORD): ANATHEMA PSYKANA attacks vs them re-roll Hit rolls of 1 and can charge them even if not visible' }
    ]
  },
  stratAddons: {}
};
