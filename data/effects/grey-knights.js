/* Grey Knights – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/grey-knights.json; effect texts are short English summaries of the CHANGE only. */
const PROGNOSTICARS = { id: 'eye-of-the-prognosticars', name: 'Eye of the Prognosticars', kind: 'always', source: 'detachment', effect: 'Replaces Teleport Assault · Each time this unit is targeted with a Stratagem: D6 (+1 within range of an objective you control), on 5+ gain 1CP' };

export default {
  faction: 'grey-knights',
  effects: [
    { id: 'gate-of-infinity', name: 'Gate of Infinity', kind: 'always', source: 'army', effect: 'End of opponent’s Fight phase: up to 2/3/4 unengaged units into Strategic Reserves · they can make an ingress move in your next Movement phase (including turn 1)' }
  ],
  detachments: {
    'grey-knights--warpbane-task-force': [
      { id: 'hallowed-ground', name: 'Hallowed Ground', kind: 'always', source: 'detachment', effect: 'GREY KNIGHTS ranged attacks vs visible targets and melee attacks: re-roll Hit rolls of 1 · re-roll the Hit roll instead for PURIFIER SQUAD or units wholly within Hallowed Ground (your deployment zone, within 6" of PURIFIER SQUAD, No Man’s Land / enemy deployment zone this phase if you control at least half of its objectives)' }
    ],
    'grey-knights--banishers': [
      {
        id: 'channelled-force', name: 'Channelled Force', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'GREY KNIGHTS unit selected to fight (passed Leadership test)', duration: 'this phase',
        options: [
          { id: 'sustained-hits', name: '[SUSTAINED HITS 1]', effect: '[PSYCHIC] melee weapons also have [SUSTAINED HITS 1]' },
          { id: 'lethal-hits', name: '[LETHAL HITS]', effect: '[PSYCHIC] melee weapons also have [LETHAL HITS]' }
        ]
      }
    ],
    'grey-knights--sanctic-spearhead': [
      { id: 'mailed-fist', name: 'Mailed Fist', kind: 'always', source: 'detachment', effect: 'GREY KNIGHTS VEHICLE Advances: no Advance roll, +6" Move this phase · ranged weapons have [ASSAULT] until end of turn' }
    ],
    'grey-knights--brotherhood-strike': [
      { id: 'fury-of-titan', name: 'Fury of Titan', kind: 'always', source: 'detachment', effect: 'Unit set up via Deep Strike: re-roll Hit rolls of 1 and Wound rolls of 1 until end of turn' }
    ],
    'grey-knights--augurium-task-force': [
      { id: 'prescient-redeployment', name: 'Prescient Redeployment', kind: 'always', source: 'detachment', effect: 'Round 2+, start of your Movement phase, if Gate of Infinity was not used to the maximum: one more eligible GREY KNIGHTS unit into Strategic Reserves' }
    ],
    'grey-knights--hallowed-conclave': [
      { id: 'duty-before-all', name: 'Duty Before All', kind: 'always', source: 'detachment', effect: 'GREY KNIGHTS TERMINATOR units can shoot and declare a charge after Falling Back' }
    ],
    'grey-knights--fires-of-purgation': [
      { id: 'searing-soulflame', name: 'Searing Soulflame', kind: 'always', source: 'detachment', effect: 'Enemy unit pinned by a PURGATION SQUAD’s Righteous Persecution: Battle-shock roll at −1' }
    ],
    'grey-knights--argent-assault': [
      { id: 'dauntless-champions', name: 'Dauntless Champions', kind: 'always', source: 'detachment', effect: 'PALADIN SQUAD melee attacks with S lower than the target’s T: +1 to Wound' }
    ],
    'grey-knights--immaterial-interdiction': [
      { id: 'echojump', name: 'Echojump', kind: 'always', source: 'detachment', effect: 'Your Shooting phase, INTERCEPTOR SQUAD has shot: surge move up to D6+1" (cannot use Personal Teleporters)' }
    ],
    'grey-knights--void-purge-force': [
      PROGNOSTICARS,
      { id: 'an-urgent-duty', name: 'An Urgent Duty', kind: 'always', source: 'detachment', effect: 'GREY KNIGHTS units: +1 to Advance and Charge rolls' }
    ],
    'grey-knights--baneslayer-strike': [
      PROGNOSTICARS,
      { id: 'pre-emptive-strike', name: 'Pre-Emptive Strike', kind: 'always', source: 'detachment', effect: 'First Movement phase: one GREY KNIGHTS Reserves unit can Deep Strike more than 6" from enemy models · it cannot charge that turn' }
    ]
  },
  stratAddons: {}
};
