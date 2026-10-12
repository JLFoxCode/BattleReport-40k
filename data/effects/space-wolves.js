/* Space Wolves – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/space-wolves.json; effect texts are short English summaries of the CHANGE only. */

export default {
  faction: 'space-wolves',
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
    'space-wolves--champions-of-fenris': [
      { id: 'the-great-wolf-watches', name: 'The Great Wolf Watches', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES INFANTRY CHARACTER units: Heroic Intervention once per battle round per unit, regardless of other uses this phase' }
    ],
    'space-wolves--saga-of-the-beastslayer': [
      { id: 'legendary-slayers', name: 'Legendary Slayers', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES attacks vs CHARACTER / MONSTER / VEHICLE units gain [LETHAL HITS]' },
      { id: 'saga-completed', name: 'Saga of the Beastslayer completed', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'rest of the battle', when: 'Beastslayer tally ≥ target (half the enemy CHARACTER / MONSTER / VEHICLE units, rounded up)', effect: 'All ADEPTUS ASTARTES attacks gain [LETHAL HITS]' }
    ],
    'space-wolves--saga-of-the-great-wolf': [
      { id: 'master-of-wolves', name: 'Master of Wolves', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of your Command phase (LOGAN GRIMNAR: one repeat per battle)', duration: 'until your next Command phase',
        options: [
          { id: 'encircling-jaws', name: 'Encircling Jaws', limit: 'battle', effect: 'ADEPTUS ASTARTES units: re-roll Advance and Charge rolls' },
          { id: 'hunters-eye', name: 'Hunter’s Eye', limit: 'battle', effect: 'ADEPTUS ASTARTES ranged attacks: +1 to Hit' },
          { id: 'ferocious-strike', name: 'Ferocious Strike', limit: 'battle', effect: 'ADEPTUS ASTARTES units selected to fight: weapons gain [LETHAL HITS] or [SUSTAINED HITS 1] (choose)' }
        ] }
    ],
    'space-wolves--gladius-task-force': [
      { id: 'combat-doctrines', name: 'Combat Doctrines', kind: 'always', source: 'detachment', effect: 'Active Combat Doctrine applies to all ADEPTUS ASTARTES units from your army (each doctrine once per battle)' }
    ],
    'space-wolves--assault-brethren': [
      { id: 'assault-mastery', name: 'Assault Mastery', kind: 'always', source: 'detachment', effect: 'Assault Doctrine can be selected one additional time per battle' }
    ],
    'space-wolves--tactical-brethren': [
      { id: 'tactical-mastery', name: 'Tactical Mastery', kind: 'always', source: 'detachment', effect: 'Tactical Doctrine can be selected one additional time per battle' }
    ],
    'space-wolves--devastator-brethren': [
      { id: 'devastator-mastery', name: 'Devastator Mastery', kind: 'always', source: 'detachment', effect: 'Devastator Doctrine can be selected one additional time per battle' }
    ],
    'space-wolves--terminator-storm-force': [
      { id: 'death-blow', name: 'Death Blow', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES TERMINATOR units: +1 to Charge rolls' }
    ],
    'space-wolves--tacticus-attack-force': [
      { id: 'wrath-of-the-chapter', name: 'Wrath of the Chapter', kind: 'always', source: 'detachment', effect: 'TACTICUS units: re-roll Advance rolls' }
    ],
    'space-wolves--tacticus-firestorm-force': [
      { id: 'codex-fire-patterns', name: 'Codex Fire-patterns', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'TACTICUS units: [RAPID FIRE] bonus applies up to the weapon’s maximum range' }
    ],
    'space-wolves--phobos-shadow-force': [
      { id: 'shadow-masters', name: 'Shadow Masters', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'PHOBOS / SCOUT SQUAD units after shooting: stay hidden, or Normal move up to D6" (then no charge this turn)' }
    ],
    'space-wolves--phobos-shock-force': [
      { id: 'vanguard-ambushers', name: 'Vanguard Ambushers', kind: 'always', source: 'detachment', effect: 'PHOBOS units hidden at the end of your Movement phase: re-roll Wound rolls of 1 until end of turn' }
    ],
    'space-wolves--gravis-linebreaker-force': [
      { id: 'walking-fortress', name: 'Walking Fortress', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'GRAVIS units that made a Normal move this turn: ranged attacks lose [HEAVY] and get +1 to Hit' }
    ],
    'space-wolves--gravis-siege-force': [
      { id: 'indomitable-defence', name: 'Indomitable Defence', kind: 'always', source: 'detachment', effect: 'GRAVIS units within range of an objective: −1 to Wound against them if the attack’s S > T' }
    ],
    'space-wolves--stormlance-task-force': [
      { id: 'lightning-assault', name: 'Lightning Assault', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can charge after Advancing or Falling Back' }
    ],
    'space-wolves--ironclad-champions': [
      { id: 'enduring-vengeance', name: 'Enduring Vengeance', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES DREADNOUGHT units: re-roll Hit rolls of 1' }
    ],
    'space-wolves--gauntlet-task-force': [
      { id: 'combined-deployment', name: 'Combined Deployment', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'After an ADEPTUS ASTARTES TRANSPORT shoots: one enemy unit hit is assailed until end of turn – attacks vs it by units that disembarked this turn gain [SUSTAINED HITS 1]' }
    ],
    'space-wolves--ironstorm-spearhead': [
      { id: 'armoured-wrath', name: 'Armoured Wrath', kind: 'always', source: 'detachment', effect: 'Once per phase per ADEPTUS ASTARTES unit: re-roll one Hit, Wound or Damage roll' }
    ],
    'space-wolves--boarding-strike': [
      { id: 'drive-home-the-blade', name: 'Drive Home the Blade', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTUS ASTARTES units within 1" of an open Hatchway: ranged weapons gain [SUSTAINED HITS 1] vs one enemy unit on the other side (this phase)' }
    ],
    'space-wolves--pilum-strike-team': [
      { id: 'relentless-salvoes', name: 'Relentless Salvoes', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can shoot after Advancing or Falling Back' }
    ],
    'space-wolves--terminator-assault': [
      { id: 'sacred-oath', name: 'Sacred Oath', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'until your next Command phase', when: 'Start of your Command phase, when selecting the Oath of Moment target', effect: 'ADEPTUS ASTARTES attacks vs your Oath of Moment target: re-roll the Wound roll' }
    ],
    'space-wolves--shield-of-the-void': [
      { id: 'focused-response', name: 'Focused Response', kind: 'always', source: 'detachment', effect: 'Overwatch: ADEPTUS ASTARTES hit on unmodified 5+ · −1 to Hit for attacks vs ADEPTUS ASTARTES units that are Set To Defend' }
    ]
  },
  stratAddons: {}
};
