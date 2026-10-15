/* T'au Empire – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/tau-empire.json; effect texts are short English summaries of the CHANGE only. T'au have no faction resource. */
const voidCombat = { id: 'void-combat-discipline', name: 'Void Combat Discipline', kind: 'always', source: 'detachment', effect: 'Replaces For the Greater Good · Ranged attacks ignore other models in the unit for visibility · Can Set Overwatch after Advancing or Falling Back' };

const montka = 'T’AU EMPIRE ranged weapons have [ASSAULT] · Guided units: ranged weapons have [LETHAL HITS]';
const kauyon = 'T’AU EMPIRE ranged weapons have [SUSTAINED HITS 1] · Guided units vs their Spotted unit: ignore modifiers to BS and the Hit roll';

export default {
  faction: 'tau-empire',
  effects: [
    { id: 'for-the-greater-good', name: 'For the Greater Good', kind: 'choice', source: 'army', pick: 'one',
      when: 'Start of your Shooting phase: select Observer units, each marks one visible enemy as Spotted', duration: 'this phase',
      options: [
        { id: 'guided', name: 'Guided', effect: 'Guided units vs a Spotted unit: improve BS by 1' },
        { id: 'guided-markerlight', name: 'Guided (MARKERLIGHT Observer)', effect: 'Guided units vs a unit Spotted by a MARKERLIGHT Observer: improve BS by 1 · [IGNORES COVER]' }
      ] }
  ],
  detachments: {
    'tau-empire--mont-ka': [
      { id: 'killing-blow', name: 'Killing Blow', kind: 'counter', source: 'detachment', byRound: { 1: montka, 2: montka, 3: montka, 4: null, 5: null } }
    ],
    'tau-empire--retaliation-cadre': [
      { id: 'bonded-heroes', name: 'Bonded Heroes', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'T’AU EMPIRE BATTLESUIT ranged attacks vs a unit within 12": +1 Strength; within 8": also +1 AP' }
    ],
    'tau-empire--kauyon': [
      { id: 'patient-hunter', name: 'Patient Hunter', kind: 'counter', source: 'detachment', byRound: { 3: kauyon, 4: kauyon, 5: kauyon } }
    ],
    'tau-empire--kroot-hunting-pack': [
      { id: 'hunters-instincts', name: 'Hunter’s Instincts', kind: 'always', source: 'detachment', effect: 'KROOT attacks: +1 to Hit vs a target below its Starting Strength; also +1 to Wound if it is Below Half-strength' },
      { id: 'skirmish-fighters', name: 'Skirmish Fighters', kind: 'always', source: 'detachment', effect: 'KROOT models: 6+ invulnerable save vs melee, 5+ vs ranged attacks' }
    ],
    'tau-empire--auxiliary-cadre': [
      { id: 'integrated-command-structure', name: 'Integrated Command Structure', kind: 'always', source: 'detachment', effect: 'KROOT / VESPID STINGWINGS (Harnessed Alien Instincts): your Shooting phase, one visible enemy within 12" is prey-marked (+3" detection range) · GHOSTKEEL / STEALTH BATTLESUITS (Aura): KROOT / VESPID STINGWINGS within 6" stay hidden after shooting' }
    ],
    'tau-empire--experimental-prototype-cadre': [
      { id: 'superior-craftmanship', name: 'Superior Craftmanship', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'BATTLESUIT CHARACTER ranged attacks: +6" Range' }
    ],
    'tau-empire--advanced-acquisition-cadre': [
      { id: 'expert-fieldcraft', name: 'Expert Fieldcraft', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'PATHFINDER TEAM / STEALTH BATTLESUITS: shooting does not prevent the unit from being hidden' }
    ],
    'tau-empire--starfire-cadre': [
      voidCombat,
      { id: 'markerlight-precision', name: 'Markerlight Precision', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'T’AU EMPIRE ranged attacks (not KROOT) vs an enemy visible to an unengaged MARKERLIGHT unit: improve BS by 1 · [SUSTAINED HITS 1]' }
    ],
    'tau-empire--kroot-raiding-party': [
      voidCombat,
      { id: 'guerrilla-ambushers', name: 'Guerrilla Ambushers', kind: 'always', source: 'detachment', effect: 'Enemy unit selected to fire Overwatch: on a 4+ it cannot target KROOT units this turn' }
    ]
  },
  stratAddons: {}
};
