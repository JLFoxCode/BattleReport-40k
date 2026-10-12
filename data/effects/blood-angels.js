/* Blood Angels – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/blood-angels.json; effect texts are short English summaries of the CHANGE only. */

export default {
  faction: 'blood-angels',
  effects: [
    {
      id: 'combat-doctrines', name: 'Combat Doctrines', kind: 'choice', source: 'army', pick: 'one',
      when: 'Start of your Command phase', duration: 'until your next Command phase',
      options: [
        { id: 'assault', name: 'Assault Doctrine', limit: 'battle', effect: 'Advance moves do not prevent declaring a charge' },
        { id: 'devastator', name: 'Devastator Doctrine', limit: 'battle', effect: 'Ranged attacks gain [ASSAULT]' },
        { id: 'tactical', name: 'Tactical Doctrine', limit: 'battle', effect: 'Fall-back moves do not prevent shooting or declaring a charge' }
      ]
    }
  ],
  detachments: {
    'blood-angels--angelic-inheritors': [
      { id: 'legacy-of-the-angel', name: 'Legacy of the Angel', kind: 'choice', source: 'detachment', pick: 'multi', max: 2,
        when: 'Start of the first battle round', duration: 'battle',
        options: [
          { id: 'sanguinary-grace', name: 'Sanguinary Grace', effect: 'ADEPTUS ASTARTES CHARACTER units can shoot and charge after Falling Back' },
          { id: 'carmine-wrath', name: 'Carmine Wrath', effect: 'ADEPTUS ASTARTES CHARACTER attacks: re-roll Hit rolls of 1 and Wound rolls of 1' },
          { id: 'their-appointed-hour', name: 'Their Appointed Hour', effect: 'ADEPTUS ASTARTES CHARACTER units: re-roll Advance and Charge rolls' }
        ] }
    ],
    'blood-angels--encarmine-speartip': [
      { id: 'wrath-of-angels', name: 'Wrath of Angels', kind: 'always', source: 'detachment', effect: 'SANGUINARY GUARD units can shoot and charge after a fall-back move' }
    ],
    'blood-angels--wrath-of-the-doomed': [
      { id: 'fanatical-celerity', name: 'Fanatacal Celerity', kind: 'always', source: 'detachment', effect: 'DEATH COMPANY advance move (optional): suffer D3+1 mortal wounds, can still declare a charge' }
    ],
    'blood-angels--gladius-task-force': [
      { id: 'combat-doctrines', name: 'Combat Doctrines', kind: 'always', source: 'detachment', effect: 'Active Combat Doctrine applies to all ADEPTUS ASTARTES units from your army (each doctrine once per battle)' }
    ],
    'blood-angels--assault-brethren': [
      { id: 'assault-mastery', name: 'Assault Mastery', kind: 'always', source: 'detachment', effect: 'Assault Doctrine can be selected one additional time per battle' }
    ],
    'blood-angels--tactical-brethren': [
      { id: 'tactical-mastery', name: 'Tactical Mastery', kind: 'always', source: 'detachment', effect: 'Tactical Doctrine can be selected one additional time per battle' }
    ],
    'blood-angels--devastator-brethren': [
      { id: 'devastator-mastery', name: 'Devastator Mastery', kind: 'always', source: 'detachment', effect: 'Devastator Doctrine can be selected one additional time per battle' }
    ],
    'blood-angels--terminator-storm-force': [
      { id: 'death-blow', name: 'Death Blow', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES TERMINATOR units: +1 to Charge rolls' }
    ],
    'blood-angels--tacticus-attack-force': [
      { id: 'wrath-of-the-chapter', name: 'Wrath of the Chapter', kind: 'always', source: 'detachment', effect: 'TACTICUS units: re-roll Advance rolls' }
    ],
    'blood-angels--tacticus-firestorm-force': [
      { id: 'codex-fire-patterns', name: 'Codex Fire-patterns', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'TACTICUS units: [RAPID FIRE] bonus applies up to the weapon’s maximum range' }
    ],
    'blood-angels--phobos-shadow-force': [
      { id: 'shadow-masters', name: 'Shadow Masters', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'PHOBOS / SCOUT SQUAD units after shooting: stay hidden, or Normal move up to D6" (then no charge this turn)' }
    ],
    'blood-angels--phobos-shock-force': [
      { id: 'vanguard-ambushers', name: 'Vanguard Ambushers', kind: 'always', source: 'detachment', effect: 'PHOBOS units hidden at the end of your Movement phase: re-roll Wound rolls of 1 until end of turn' }
    ],
    'blood-angels--gravis-linebreaker-force': [
      { id: 'walking-fortress', name: 'Walking Fortress', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'GRAVIS units that made a Normal move this turn: ranged attacks lose [HEAVY] and get +1 to Hit' }
    ],
    'blood-angels--gravis-siege-force': [
      { id: 'indomitable-defence', name: 'Indomitable Defence', kind: 'always', source: 'detachment', effect: 'GRAVIS units within range of an objective: −1 to Wound against them if the attack’s S > T' }
    ],
    'blood-angels--stormlance-task-force': [
      { id: 'lightning-assault', name: 'Lightning Assault', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can charge after Advancing or Falling Back' }
    ],
    'blood-angels--ironclad-champions': [
      { id: 'enduring-vengeance', name: 'Enduring Vengeance', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES DREADNOUGHT units: re-roll Hit rolls of 1' }
    ],
    'blood-angels--gauntlet-task-force': [
      { id: 'combined-deployment', name: 'Combined Deployment', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'After an ADEPTUS ASTARTES TRANSPORT shoots: one enemy unit hit is assailed until end of turn – attacks vs it by units that disembarked this turn gain [SUSTAINED HITS 1]' }
    ],
    'blood-angels--ironstorm-spearhead': [
      { id: 'armoured-wrath', name: 'Armoured Wrath', kind: 'always', source: 'detachment', effect: 'Once per phase per ADEPTUS ASTARTES unit: re-roll one Hit, Wound or Damage roll' }
    ],
    'blood-angels--boarding-strike': [
      { id: 'drive-home-the-blade', name: 'Drive Home the Blade', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTUS ASTARTES units within 1" of an open Hatchway: ranged weapons gain [SUSTAINED HITS 1] vs one enemy unit on the other side (this phase)' }
    ],
    'blood-angels--pilum-strike-team': [
      { id: 'relentless-salvoes', name: 'Relentless Salvoes', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can shoot after Advancing or Falling Back' }
    ],
    'blood-angels--terminator-assault': [
      { id: 'sacred-oath', name: 'Sacred Oath', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'until your next Command phase', when: 'Start of your Command phase, when selecting the Oath of Moment target', effect: 'ADEPTUS ASTARTES attacks vs your Oath of Moment target: re-roll the Wound roll' }
    ],
    'blood-angels--shield-of-the-void': [
      { id: 'focused-response', name: 'Focused Response', kind: 'always', source: 'detachment', effect: 'Overwatch: ADEPTUS ASTARTES hit on unmodified 5+ · −1 to Hit for attacks vs ADEPTUS ASTARTES units that are Set To Defend' }
    ]
  },
  stratAddons: {}
};
