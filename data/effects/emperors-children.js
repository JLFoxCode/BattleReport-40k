/* Emperor's Children – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/emperors-children.json; effect texts are short English summaries of the CHANGE only. */
export default {
  faction: 'emperors-children',
  effects: [
    { id: 'thrill-seekers', name: 'Thrill Seekers', kind: 'always', source: 'army', effect: 'Can shoot and declare a charge after Advancing or Falling Back – but not targeting a unit it was in Engagement Range of at the start of the turn, or a unit already targeted by another unit’s charge or attack this phase' }
  ],
  detachments: {
    'emperors-children--coterie-of-the-conceited': [
      {
        id: 'pledges-to-the-dark-prince', name: 'Pledges to the Dark Prince', kind: 'counter', source: 'detachment', resource: 'Pact points',
        tiers: [
          { min: 1, effect: 'EMPEROR’S CHILDREN: re-roll Hit rolls of 1' },
          { min: 3, effect: 'EMPEROR’S CHILDREN: re-roll Wound rolls of 1' },
          { min: 5, effect: 'EMPEROR’S CHILDREN melee weapons: [LETHAL HITS] and [SUSTAINED HITS 1]' },
          { min: 7, effect: 'EMPEROR’S CHILDREN: Critical Hit on unmodified 5+' }
        ]
      }
    ],
    'emperors-children--carnival-of-excess': [
      { id: 'daemonic-empowerment', name: 'Daemonic Empowerment', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN within 6" of LEGIONS OF EXCESS (and vice versa) are Empowered: weapons have [SUSTAINED HITS 1] (if they already have it: Critical Hit on 5+)' }
    ],
    'emperors-children--rapid-evisceration': [
      { id: 'mechanised-murder', name: 'Mechanised Murder', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN TRANSPORT models or models that disembarked this turn: re-roll Hit rolls of 1 and Wound rolls of 1' }
    ],
    'emperors-children--peerless-bladesmen': [
      {
        id: 'exquisite-swordsmanship', name: 'Exquisite Swordsmanship', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'EMPEROR’S CHILDREN unit that charged this turn is selected to fight', duration: 'this phase',
        options: [
          { id: 'lethal-hits', name: '[LETHAL HITS]', effect: 'Melee weapons have [LETHAL HITS]' },
          { id: 'sustained-hits', name: '[SUSTAINED HITS 1]', effect: 'Melee weapons have [SUSTAINED HITS 1]' }
        ]
      }
    ],
    'emperors-children--court-of-the-phoenician': [
      { id: 'sensational-performance', name: 'Sensational Performance', kind: 'always', source: 'detachment', effect: 'Unit that charged this turn, when selected to fight: +1 S and +1 AP on melee weapons this phase – but not vs a unit it was in Engagement Range of at the start of the turn or already attacked by another unit this phase' },
      { id: 'master-of-the-pageant', name: 'Master of the Pageant', kind: 'always', source: 'detachment', effect: 'Once per battle round: Sinuous Breach or Prideful Superiority on FULGRIM costs 1CP less' }
    ],
    'emperors-children--slaaneshs-chosen': [
      { id: 'internal-rivalries', name: 'Internal Rivalries', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN CHARACTER units can ignore modifiers to Move, Advance and Charge rolls · Favoured Champions (WARLORD’s unit, then the first CHARACTER unit to destroy an enemy unit each turn): re-roll the Wound roll' }
    ],
    'emperors-children--mercurial-host': [
      { id: 'quicksilver-grace', name: 'Quicksilver Grace', kind: 'always', source: 'detachment', effect: 'Re-roll Advance rolls for EMPEROR’S CHILDREN units' }
    ],
    'emperors-children--spectacle-of-slaughter': [
      { id: 'entitled-to-victory', name: 'Entitled to Victory', kind: 'always', source: 'detachment', effect: 'FLAWLESS BLADES units have Fights First' }
    ],
    'emperors-children--frenzied-host': [
      { id: 'frantic-focus', name: 'Frantic Focus', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN BATTLELINE unit Advances or Falls Back: its BATTLELINE models’ attacks have [SUSTAINED HITS 1] until end of turn' }
    ],
    'emperors-children--elegant-brutes': [
      { id: 'eager-to-kill', name: 'Eager to Kill', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN TERMINATOR unit set up: +1 to Charge rolls until end of turn' }
    ],
    'emperors-children--sublime-strike': [
      { id: 'musk-of-torpidity', name: 'Musk of Torpidity', kind: 'always', source: 'detachment', effect: 'Replaces Thrill Seekers: can perform a Tactical Manoeuvre, or shoot and declare a charge, in a turn in which it Fell Back' },
      { id: 'dark-radiance', name: 'Dark Radiance', kind: 'always', source: 'detachment', effect: 'EMPEROR’S CHILDREN Normal/Advance/Fall Back moves: move through friendly and enemy models' }
    ]
  },
  stratAddons: {}
};
