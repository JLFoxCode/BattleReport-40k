/* Deathwatch – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/deathwatch.json; effect texts are short English summaries of the CHANGE only. */

export default {
  faction: 'deathwatch',
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
    'deathwatch--black-spear-task-force': [
      { id: 'kill-teams', name: 'Kill Teams', kind: 'always', source: 'detachment', effect: 'KILL TEAM units with mixed Toughness: attacks use the majority (ties: highest) Toughness to wound' },
      { id: 'mission-tactics', name: 'Mission Tactics', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'furor', name: 'Furor Tactics', limit: 'battle', effect: 'ADEPTUS ASTARTES weapons gain [SUSTAINED HITS 1]' },
          { id: 'malleus', name: 'Malleus Tactics', limit: 'battle', effect: 'ADEPTUS ASTARTES weapons gain [LETHAL HITS]' },
          { id: 'purgatus', name: 'Purgatus Tactics', limit: 'battle', effect: 'ADEPTUS ASTARTES attacks that score a Critical Hit gain [PRECISION]' }
        ] }
    ],
    'deathwatch--deathwatch-support': [
      { id: 'mission-tactics', name: 'Mission Tactics', kind: 'always', source: 'detachment', effect: 'KILL TEAM units: Devastator Doctrine active → attacks gain [SUSTAINED HITS 1] · Tactical Doctrine → [LETHAL HITS] · Assault Doctrine → [PRECISION] vs units within 9"' }
    ],
    'deathwatch--gladius-task-force': [
      { id: 'combat-doctrines', name: 'Combat Doctrines', kind: 'always', source: 'detachment', effect: 'Active Combat Doctrine applies to all ADEPTUS ASTARTES units from your army (each doctrine once per battle)' }
    ],
    'deathwatch--assault-brethren': [
      { id: 'assault-mastery', name: 'Assault Mastery', kind: 'always', source: 'detachment', effect: 'Assault Doctrine can be selected one additional time per battle' }
    ],
    'deathwatch--tactical-brethren': [
      { id: 'tactical-mastery', name: 'Tactical Mastery', kind: 'always', source: 'detachment', effect: 'Tactical Doctrine can be selected one additional time per battle' }
    ],
    'deathwatch--devastator-brethren': [
      { id: 'devastator-mastery', name: 'Devastator Mastery', kind: 'always', source: 'detachment', effect: 'Devastator Doctrine can be selected one additional time per battle' }
    ],
    'deathwatch--terminator-storm-force': [
      { id: 'death-blow', name: 'Death Blow', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES TERMINATOR units: +1 to Charge rolls' }
    ],
    'deathwatch--tacticus-attack-force': [
      { id: 'wrath-of-the-chapter', name: 'Wrath of the Chapter', kind: 'always', source: 'detachment', effect: 'TACTICUS units: re-roll Advance rolls' }
    ],
    'deathwatch--tacticus-firestorm-force': [
      { id: 'codex-fire-patterns', name: 'Codex Fire-patterns', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'TACTICUS units: [RAPID FIRE] bonus applies up to the weapon’s maximum range' }
    ],
    'deathwatch--phobos-shadow-force': [
      { id: 'shadow-masters', name: 'Shadow Masters', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'PHOBOS / SCOUT SQUAD units after shooting: stay hidden, or Normal move up to D6" (then no charge this turn)' }
    ],
    'deathwatch--phobos-shock-force': [
      { id: 'vanguard-ambushers', name: 'Vanguard Ambushers', kind: 'always', source: 'detachment', effect: 'PHOBOS units hidden at the end of your Movement phase: re-roll Wound rolls of 1 until end of turn' }
    ],
    'deathwatch--gravis-linebreaker-force': [
      { id: 'walking-fortress', name: 'Walking Fortress', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'GRAVIS units that made a Normal move this turn: ranged attacks lose [HEAVY] and get +1 to Hit' }
    ],
    'deathwatch--gravis-siege-force': [
      { id: 'indomitable-defence', name: 'Indomitable Defence', kind: 'always', source: 'detachment', effect: 'GRAVIS units within range of an objective: −1 to Wound against them if the attack’s S > T' }
    ],
    'deathwatch--stormlance-task-force': [
      { id: 'lightning-assault', name: 'Lightning Assault', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can charge after Advancing or Falling Back' }
    ],
    'deathwatch--ironclad-champions': [
      { id: 'enduring-vengeance', name: 'Enduring Vengeance', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES DREADNOUGHT units: re-roll Hit rolls of 1' }
    ],
    'deathwatch--gauntlet-task-force': [
      { id: 'combined-deployment', name: 'Combined Deployment', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'After an ADEPTUS ASTARTES TRANSPORT shoots: one enemy unit hit is assailed until end of turn – attacks vs it by units that disembarked this turn gain [SUSTAINED HITS 1]' }
    ],
    'deathwatch--ironstorm-spearhead': [
      { id: 'armoured-wrath', name: 'Armoured Wrath', kind: 'always', source: 'detachment', effect: 'Once per phase per ADEPTUS ASTARTES unit: re-roll one Hit, Wound or Damage roll' }
    ],
    'deathwatch--boarding-strike': [
      { id: 'drive-home-the-blade', name: 'Drive Home the Blade', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTUS ASTARTES units within 1" of an open Hatchway: ranged weapons gain [SUSTAINED HITS 1] vs one enemy unit on the other side (this phase)' }
    ],
    'deathwatch--pilum-strike-team': [
      { id: 'relentless-salvoes', name: 'Relentless Salvoes', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can shoot after Advancing or Falling Back' }
    ],
    'deathwatch--terminator-assault': [
      { id: 'sacred-oath', name: 'Sacred Oath', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'until your next Command phase', when: 'Start of your Command phase, when selecting the Oath of Moment target', effect: 'ADEPTUS ASTARTES attacks vs your Oath of Moment target: re-roll the Wound roll' }
    ],
    'deathwatch--shield-of-the-void': [
      { id: 'focused-response', name: 'Focused Response', kind: 'always', source: 'detachment', effect: 'Overwatch: ADEPTUS ASTARTES hit on unmodified 5+ · −1 to Hit for attacks vs ADEPTUS ASTARTES units that are Set To Defend' }
    ]
  },
  stratAddons: {}
};
