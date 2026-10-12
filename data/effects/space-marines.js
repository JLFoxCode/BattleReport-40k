/* Space Marines – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/space-marines.json; effect texts are short English summaries of the CHANGE only. */

export default {
  faction: 'space-marines',
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
    'space-marines--medusas-wrath': [
      { id: 'armoured-wrath', name: 'Armoured Wrath', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units selected to shoot or fight: re-roll one Hit, Wound or Damage roll (within 6" of CANNOK VAR / IRON FATHER FEIRROS: one of each)' }
    ],
    'space-marines--ceramite-sentinels': [
      { id: 'adaptive-defence', name: 'Adaptive Defence', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units within a terrain feature: re-roll Hit rolls of 1 and Wound rolls of 1 · gain ENTRENCHED while within terrain, not set up this turn and no model moved more than 3"' }
    ],
    'space-marines--blade-of-ultramar': [
      { id: 'mastered-doctrines', name: 'Mastered Doctrines', kind: 'always', source: 'detachment', effect: 'Combat Doctrine at the start of up to three Command phases, applies to all ADEPTUS ASTARTES units · repeats allowed while MARNEUS CALGAR is on the battlefield' }
    ],
    'space-marines--shadowmark-talon': [
      { id: 'masters-of-shadow', name: 'Masters of Shadow', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'Ranged attacks vs ADEPTUS ASTARTES units: target has the Benefit of Cover unless the attacker is within 12" · AETHON SHAAN on the battlefield: Into Darkness for 0CP once per battle round' }
    ],
    'space-marines--forgefathers-seekers': [
      { id: 'vulkans-quest', name: 'Vulkan’s Quest', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTUS ASTARTES ranged weapons gain [ASSAULT] · +1 S vs units within 12" · VULKAN HE’STAN: INFERNUS SQUAD units can start an Action after Advancing or shoot after starting an Action' }
    ],
    'space-marines--spearpoint-task-force': [
      { id: 'storm-swift-onslaught', name: 'Storm-Swift Onslaught', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can charge after Advancing or Falling Back · SUBODEN KHAN that destroyed a unit this Fight phase and is not engaged: Normal move up to 6" at the end of the phase' }
    ],
    'space-marines--gladius-task-force': [
      { id: 'combat-doctrines', name: 'Combat Doctrines', kind: 'always', source: 'detachment', effect: 'Active Combat Doctrine applies to all ADEPTUS ASTARTES units from your army (each doctrine once per battle)' }
    ],
    'space-marines--assault-brethren': [
      { id: 'assault-mastery', name: 'Assault Mastery', kind: 'always', source: 'detachment', effect: 'Assault Doctrine can be selected one additional time per battle' }
    ],
    'space-marines--tactical-brethren': [
      { id: 'tactical-mastery', name: 'Tactical Mastery', kind: 'always', source: 'detachment', effect: 'Tactical Doctrine can be selected one additional time per battle' }
    ],
    'space-marines--devastator-brethren': [
      { id: 'devastator-mastery', name: 'Devastator Mastery', kind: 'always', source: 'detachment', effect: 'Devastator Doctrine can be selected one additional time per battle' }
    ],
    'space-marines--terminator-storm-force': [
      { id: 'death-blow', name: 'Death Blow', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES TERMINATOR units: +1 to Charge rolls' }
    ],
    'space-marines--tacticus-attack-force': [
      { id: 'wrath-of-the-chapter', name: 'Wrath of the Chapter', kind: 'always', source: 'detachment', effect: 'TACTICUS units: re-roll Advance rolls' }
    ],
    'space-marines--tacticus-firestorm-force': [
      { id: 'codex-fire-patterns', name: 'Codex Fire-patterns', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'TACTICUS units: [RAPID FIRE] bonus applies up to the weapon’s maximum range' }
    ],
    'space-marines--phobos-shadow-force': [
      { id: 'shadow-masters', name: 'Shadow Masters', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'PHOBOS / SCOUT SQUAD units after shooting: stay hidden, or Normal move up to D6" (then no charge this turn)' }
    ],
    'space-marines--phobos-shock-force': [
      { id: 'vanguard-ambushers', name: 'Vanguard Ambushers', kind: 'always', source: 'detachment', effect: 'PHOBOS units hidden at the end of your Movement phase: re-roll Wound rolls of 1 until end of turn' }
    ],
    'space-marines--gravis-linebreaker-force': [
      { id: 'walking-fortress', name: 'Walking Fortress', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'GRAVIS units that made a Normal move this turn: ranged attacks lose [HEAVY] and get +1 to Hit' }
    ],
    'space-marines--gravis-siege-force': [
      { id: 'indomitable-defence', name: 'Indomitable Defence', kind: 'always', source: 'detachment', effect: 'GRAVIS units within range of an objective: −1 to Wound against them if the attack’s S > T' }
    ],
    'space-marines--stormlance-task-force': [
      { id: 'lightning-assault', name: 'Lightning Assault', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can charge after Advancing or Falling Back' }
    ],
    'space-marines--ironclad-champions': [
      { id: 'enduring-vengeance', name: 'Enduring Vengeance', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES DREADNOUGHT units: re-roll Hit rolls of 1' }
    ],
    'space-marines--gauntlet-task-force': [
      { id: 'combined-deployment', name: 'Combined Deployment', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'After an ADEPTUS ASTARTES TRANSPORT shoots: one enemy unit hit is assailed until end of turn – attacks vs it by units that disembarked this turn gain [SUSTAINED HITS 1]' }
    ],
    'space-marines--ironstorm-spearhead': [
      { id: 'armoured-wrath', name: 'Armoured Wrath', kind: 'always', source: 'detachment', effect: 'Once per phase per ADEPTUS ASTARTES unit: re-roll one Hit, Wound or Damage roll' }
    ],
    'space-marines--boarding-strike': [
      { id: 'drive-home-the-blade', name: 'Drive Home the Blade', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTUS ASTARTES units within 1" of an open Hatchway: ranged weapons gain [SUSTAINED HITS 1] vs one enemy unit on the other side (this phase)' }
    ],
    'space-marines--pilum-strike-team': [
      { id: 'relentless-salvoes', name: 'Relentless Salvoes', kind: 'always', source: 'detachment', effect: 'ADEPTUS ASTARTES units can shoot after Advancing or Falling Back' }
    ],
    'space-marines--terminator-assault': [
      { id: 'sacred-oath', name: 'Sacred Oath', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'until your next Command phase', when: 'Start of your Command phase, when selecting the Oath of Moment target', effect: 'ADEPTUS ASTARTES attacks vs your Oath of Moment target: re-roll the Wound roll' }
    ],
    'space-marines--shield-of-the-void': [
      { id: 'focused-response', name: 'Focused Response', kind: 'always', source: 'detachment', effect: 'Overwatch: ADEPTUS ASTARTES hit on unmodified 5+ · −1 to Hit for attacks vs ADEPTUS ASTARTES units that are Set To Defend' }
    ]
  },
  stratAddons: {}
};
