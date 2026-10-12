/* World Eaters – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/world-eaters.json; Blessing effects from the Blessings of Khorne profiles in
 * vendor-data/bsdata/wh40k-11e-main/Chaos - World Eaters.json (not in the orig army rule text).
 * Effect texts are short English summaries of the CHANGE only. */
const BTP = 'Blood Tithe Points (BTP)';
const SLAUGHTERERS_GLORY = { id: 'slaughterers-glory', name: 'Slaughterers’ Glory', kind: 'always', source: 'detachment', effect: 'Blessings of Khorne roll: 4D6 instead of 8D6 · only one Blessing per battle round' };

export default {
  faction: 'world-eaters',
  effects: [
    {
      id: 'blessings-of-khorne', name: 'Blessings of Khorne', kind: 'choice', source: 'army', pick: 'multi', max: 2,
      when: 'Start of the battle round (Blessings of Khorne roll, 8D6)', duration: 'battle round',
      options: [
        { id: 'unbridled-bloodlust', name: 'Unbridled Bloodlust (double 1+)', effect: '+1 to Charge rolls' },
        { id: 'rage-fuelled-invigoration', name: 'Rage-fuelled Invigoration (double 2+)', effect: 'Pile-in and Consolidation moves up to 6"' },
        { id: 'total-carnage', name: 'Total Carnage (double 3+)', effect: 'Model destroyed by a melee attack before it fought: on 4+ it fights before being removed' },
        { id: 'martial-excellence', name: 'Martial Excellence (double 4+ / triple 1+)', effect: 'Melee weapons have [SUSTAINED HITS 1]' },
        { id: 'warp-blades', name: 'Warp Blades (double 5+ / triple 2+)', effect: 'Melee weapons have [LETHAL HITS]' },
        { id: 'cleaving-blows', name: 'Cleaving Blows (double 6+)', effect: 'Improve AP of melee weapons by 1' },
        { id: 'decapitating-strikes', name: 'Decapitating Strikes (double 6+ / triple 3+)', effect: 'Melee attacks vs INFANTRY have [DEVASTATING WOUNDS]' }
      ]
    }
  ],
  detachments: {
    'world-eaters--berzerker-warband': [
      { id: 'relentless-rage', name: 'Relentless Rage', kind: 'always', source: 'detachment', effect: 'WORLD EATERS melee attacks: +1 Attacks' }
    ],
    'world-eaters--cult-of-blood': [
      {
        id: 'idols-of-khorne', name: 'Idols of Khorne', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'idol-of-infinite-rage', name: 'Idol of Infinite Rage (Aura)', limit: 'battle', effect: 'JAKHALS / GOREMONGERS within 6" (9" TITANIC) of WORLD EATERS MONSTER/TITANIC: +1 to Hit and +1 to Wound' },
          { id: 'idol-of-burning-wrath', name: 'Idol of Burning Wrath (Aura)', limit: 'battle', effect: 'JAKHALS / GOREMONGERS within 6" (9" TITANIC) of WORLD EATERS MONSTER/TITANIC: +1" Move, +1 to Advance and Charge rolls' },
          { id: 'idol-of-blessed-blood', name: 'Idol of Blessed Blood (Aura)', limit: 'battle', effect: 'JAKHALS / GOREMONGERS within 6" (9" TITANIC) of WORLD EATERS MONSTER/TITANIC: 4+ invulnerable save' }
        ]
      },
      { id: 'jakhals-battleline', name: 'Idols of Khorne – BATTLELINE', kind: 'always', source: 'detachment', effect: 'JAKHALS and GOREMONGERS units are BATTLELINE' }
    ],
    'world-eaters--possessed-slaughterband': [
      { id: 'brazen-fury', name: 'Brazen Fury', kind: 'always', source: 'detachment', effect: 'WORLD EATERS POSSESSED: opponent’s Shooting phase, after an enemy unit shot and destroyed a model in this unit – surge move up to D6"' }
    ],
    'world-eaters--khorne-daemonkin': [
      { id: 'blood-tithe-gain', name: 'Blood Tithe', kind: 'always', source: 'detachment', effect: 'BLOOD LEGIONS / WORLD EATERS unit destroys an enemy unit: D6, on 3+ gain 1 BTP' },
      {
        id: 'blood-tithe', name: 'Blood Tithe abilities', kind: 'choice', source: 'detachment', pick: 'multi', max: 4,
        when: 'Start of the Command phase (spend BTP)', duration: 'battle',
        options: [
          { id: 'enraged-abjuration', name: 'Enraged Abjuration', cost: 2, resource: 'Blood Tithe Points (BTP)', limit: 'battle', effect: 'BLOOD LEGIONS and WORLD EATERS models: Feel No Pain 5+ vs Psychic Attacks and mortal wounds' },
          { id: 'daemonic-rage', name: 'Daemonic Rage', cost: 3, resource: 'Blood Tithe Points (BTP)', limit: 'battle', effect: 'BLOOD LEGIONS melee weapons have [LANCE]' },
          { id: 'boon-of-blood', name: 'Boon of Blood', cost: 4, resource: 'Blood Tithe Points (BTP)', limit: 'battle', effect: 'BLOOD LEGIONS units: 4+ invulnerable save' },
          { id: 'might-of-khorne', name: 'Might of Khorne', cost: 5, resource: 'Blood Tithe Points (BTP)', limit: 'battle', effect: 'BLOOD LEGIONS units gain Blessings of Khorne' }
        ]
      }
    ],
    'world-eaters--goretrack-onslaught': [
      { id: 'rush-to-the-fray', name: 'Rush to the Fray', kind: 'always', source: 'detachment', effect: 'WORLD EATERS unit disembarks: +1 to Charge rolls and melee weapons have [LANCE] until end of turn' }
    ],
    'world-eaters--brazen-engines': [
      { id: 'rampaging-terrors', name: 'Rampaging Terrors', kind: 'always', source: 'detachment', effect: 'DAEMON VEHICLE, start of the Fight phase: one engaged enemy unit makes a Battle-shock roll at −1 (each enemy unit once per phase)' }
    ],
    'world-eaters--vessels-of-wrath': [
      {
        id: 'wrath-of-khorne', name: 'Wrath of Khorne', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'WORLD EATERS CHARACTER unit (not EPIC HERO) selected to fight', duration: 'this phase',
        options: [
          { id: 'cleave', name: '[CLEAVE 1]', effect: 'CHARACTER models’ melee attacks have [CLEAVE 1]' },
          { id: 'ap', name: '+1 AP', effect: 'CHARACTER models’ melee attacks have +1 AP' }
        ]
      }
    ],
    'world-eaters--butchers-of-khorne': [
      { id: 'adamantine-avalanche', name: 'Adamantine Avalanche', kind: 'always', source: 'detachment', effect: 'Start of the Fight phase, TERMINATOR SQUAD engaged: Blessings of Khorne roll – one extra Blessing active for TERMINATOR SQUAD units this phase' }
    ],
    'world-eaters--boarding-butchers': [
      SLAUGHTERERS_GLORY,
      { id: 'focused-ferocity', name: 'Focused Ferocity', kind: 'always', source: 'detachment', effect: 'WORLD EATERS unit declares a charge: each target takes a Battle-shock test' }
    ],
    'world-eaters--skullsworn': [
      SLAUGHTERERS_GLORY,
      { id: 'reap-the-tally', name: 'Reap the Tally', kind: 'always', source: 'detachment', effect: 'WORLD EATERS model (not KHÂRN THE BETRAYER) destroyed by a melee attack before it fought: on 5+ it fights before being removed' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  stratAddons: {
    'A Worthy Skull': [{ id: 'spend', name: 'Spend BTP (any)', resource: BTP, cost: 'any', effect: 'After gaining D3 BTP: activate one Blood Tithe ability' }]
  }
};
