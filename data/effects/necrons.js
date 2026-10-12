/* Necrons – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/necrons.json; effect texts are short English summaries of the CHANGE only. Necrons have no faction resource. */
const transdimensional = { id: 'transdimensional-reinforcement', name: 'Transdimensional Reinforcement', kind: 'always', source: 'detachment', effect: 'Replaces Reanimation Protocols (non-CHARACTER units) · Once per battle per unit, your Command phase (or when destroyed): D6 per destroyed model, each 5+ returns one model with full wounds' };

export default {
  faction: 'necrons',
  effects: [
    { id: 'reanimation-protocols', name: 'Reanimation Protocols', kind: 'always', source: 'army', scope: 'Command', effect: 'End of your Command phase: each unit with Reanimation Protocols on the battlefield heals D3 wounds' }
  ],
  detachments: {
    'necrons--starshatter-arsenal': [
      { id: 'relentless-onslaught', name: 'Relentless Onslaught', kind: 'always', source: 'detachment', effect: 'NECRONS attacks (not MONSTER) vs a unit within range of an objective marker: +1 to Hit · NECRONS VEHICLE / MOUNTED ranged weapons (not TITANIC) have [ASSAULT]' }
    ],
    'necrons--awakened-dynasty': [
      { id: 'command-protocols', name: 'Command Protocols', kind: 'always', source: 'detachment', effect: 'Units led by a NECRONS CHARACTER: +1 to Hit' }
    ],
    'necrons--canoptek-court': [
      { id: 'power-matrix', name: 'Power Matrix', kind: 'always', source: 'detachment', effect: 'CRYPTEK / CANOPTEK attacks: re-roll Hit rolls of 1; wholly within your Power Matrix: re-roll the Hit roll · Power Matrix: your deployment zone, plus No Man’s Land / the enemy deployment zone while you control at least half of its objective markers (checked at the start of each phase)' }
    ],
    'necrons--obeisance-phalanx': [
      { id: 'worthy-foes', name: 'Worthy Foes', kind: 'always', source: 'detachment', effect: 'Your Command phase: select one enemy unit – NOBLE / LYCHGUARD / TRIARCH attacks vs it +1 to Wound until your next Command phase' }
    ],
    'necrons--pantheon-of-woe': [
      { id: 'cosmic-distortion', name: 'Cosmic Distortion', kind: 'always', source: 'detachment', effect: 'Enemy units within 6" of a NECRONS MONSTER are unravelling: attacks vs them improve AP by 1 · Start of each phase: a NECRONS MONSTER can suffer 3 mortal wounds to extend its aura to 9" this phase' }
    ],
    'necrons--cryptek-conclave': [
      { id: 'technosorcerous-augmentations', name: 'Technosorcerous Augmentations', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'CRYPTEK ranged weapons have [ASSAULT]' },
      { id: 'technosorcerous-selection', name: 'Technosorcerous Augmentations (selection)', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Shooting phase: CRYPTEK unit selected to shoot', duration: 'this phase',
        options: [
          { id: 'anti-infantry', name: '[ANTI-INFANTRY 3+]', effect: 'Ranged weapons have [ANTI-INFANTRY 3+]' },
          { id: 'anti-mounted', name: '[ANTI-MOUNTED 4+]', effect: 'Ranged weapons have [ANTI-MOUNTED 4+]' },
          { id: 'assault', name: '[ASSAULT]', effect: 'Ranged weapons have [ASSAULT]' },
          { id: 'heavy', name: '[HEAVY]', effect: 'Ranged weapons have [HEAVY]' },
          { id: 'ignores-cover', name: '[IGNORES COVER]', effect: 'Ranged weapons have [IGNORES COVER]' }
        ] }
    ],
    'necrons--annihilation-legion': [
      { id: 'annihilation-protocol', name: 'Annihilation Protocol', kind: 'always', source: 'detachment', effect: 'DESTROYER CULT / FLAYED ONES: re-roll Charge rolls, +1 if a charge target is Below Half-strength · DESTROYER CULT ranged attacks vs the closest eligible target: +1 AP' }
    ],
    'necrons--cursed-legion': [
      { id: 'cold-fervour', name: 'Cold Fervour', kind: 'always', source: 'detachment', effect: 'DESTROYER CULT weapons: +2 Strength' },
      { id: 'cold-fervour-spread', name: 'Cold Fervour (triggered)', kind: 'toggle', source: 'detachment', limit: 'turn', duration: 'until the end of the turn',
        when: 'First time each turn a DESTROYER CULT unit destroys a unit or makes it Below Half-strength', effect: 'Other NECRONS weapons (not DESTROYER CULT / MONSTER / TITANIC): +2 Strength' }
    ],
    'necrons--hypercrypt-legion': [
      { id: 'hyperphasing', name: 'Hyperphasing', kind: 'always', source: 'detachment', effect: 'End of your opponent’s turn: up to 1/2/3 unengaged NECRONS units into Strategic Reserves' }
    ],
    'necrons--the-phaerons-armoury': [
      { id: 'empowered-engines', name: 'Empowered Engines', kind: 'always', source: 'detachment', effect: 'NECRONS TITANIC FLY units: +6" Move' }
    ],
    'necrons--skyshroud-spearhead': [
      { id: 'transdimensional-deployment', name: 'Transdimensional Deployment', kind: 'always', source: 'detachment', effect: 'TOMB BLADES have Deep Strike · TOMB BLADES that made an ingress move this turn: ranged attacks +1 to Hit' }
    ],
    'necrons--hand-of-the-dynasty': [
      { id: 'hypermotility-protocols', name: 'Hypermotility Protocols', kind: 'always', source: 'detachment', effect: 'IMMORTALS / NECRON WARRIORS ranged attacks have [ASSAULT] · Advancing does not prevent them from starting an action' }
    ],
    'necrons--tomb-ship-complement': [
      transdimensional,
      { id: 'conquest-protocols', name: 'Conquest Protocols', kind: 'always', source: 'detachment', effect: 'NECRONS attacks while the attacker or target is within range of an objective marker: Critical Wound improves AP by 1' }
    ],
    'necrons--deranged-outcasts': [
      transdimensional,
      { id: 'terrifying-charge', name: 'Terrifying Charge', kind: 'always', source: 'detachment', scope: 'Charge', effect: 'NECRONS unit declares a charge: each target takes a Leadership test; if failed −1 to Hit until the end of the turn' }
    ],
    'necrons--canoptek-harvesters': [
      transdimensional,
      { id: 'retribution-protocols', name: 'Retribution Protocols', kind: 'always', source: 'detachment', effect: 'Enemy unit that destroyed a CRYPTEK: NECRONS attacks vs it can re-roll the Hit roll until the end of the battle' }
    ],
    'necrons--harbinger-cabal': [
      transdimensional,
      { id: 'arcanoscientific-expertise', name: 'Arcanoscientific Expertise', kind: 'choice', source: 'detachment', pick: 'multi', max: 3,
        when: 'Your Command phase: one per CRYPTEK unit', duration: 'until your next Command phase',
        options: [
          { id: 'hyperlocation-stutter', name: 'Hyperlocation Stutter (Aura)', effect: 'NECRONS units within 6": +2 to Advance rolls' },
          { id: 'transharmonic-disruption', name: 'Transharmonic Disruption (Aura)', effect: 'NECRONS units within 6": +1 Strength to weapons' },
          { id: 'quantum-interface', name: 'Quantum Interface (Aura)', effect: 'NECRONS units within 6": 5+ invulnerable save' }
        ] }
    ]
  },
  stratAddons: {}
};
