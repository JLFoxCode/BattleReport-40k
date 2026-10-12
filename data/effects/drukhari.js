/* Drukhari – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/drukhari.json; effect texts are short English summaries of the CHANGE only.
 * Power from Pain has no tiers: Pain abilities live on the datasheets and are switched on per unit/phase. */
const PAIN = 'Pain Tokens';

const feastOfPain = { id: 'feast-of-pain', name: 'Feast of Pain', kind: 'always', source: 'detachment', effect: 'Start of the battle: +1 Pain token' };

export default {
  faction: 'drukhari',
  effects: [
    { id: 'power-from-pain', name: 'Power from Pain', kind: 'always', source: 'army', effect: 'Gain 1 Pain token at the start of your Command phase, per destroyed enemy unit and per failed enemy Battle-shock test · Spend Pain tokens to Empower a unit until the end of the phase: its Pain abilities take effect (incl. all Leader/Bodyguard units of an Attached unit)' }
  ],
  detachments: {
    'drukhari--reaper-s-wager': [
      { id: 'callous-competition', name: 'Callous Competition', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle: DRUKHARI winning · switches each time a DRUKHARI / HARLEQUINS unit destroys an enemy unit', duration: 'until changed',
        options: [
          { id: 'drukhari-winning', name: 'DRUKHARI winning', effect: 'DRUKHARI attacks: re-roll Hit rolls of 1 · HARLEQUINS (losing) attacks: re-roll Hit rolls of 1 and Wound rolls of 1' },
          { id: 'harlequins-winning', name: 'HARLEQUINS winning', effect: 'HARLEQUINS attacks: re-roll Hit rolls of 1 · DRUKHARI (losing) attacks: re-roll Hit rolls of 1 and Wound rolls of 1' }
        ] }
    ],
    'drukhari--realspace-raiders': [
      { id: 'alliance-of-agony', name: 'Alliance of Agony', kind: 'always', source: 'detachment', effect: 'Start of the battle: +2 Pain tokens per combination in your army: ARCHON + KABALITE WARRIORS · SUCCUBUS + WYCHES · HAEMONCULUS + WRACKS' }
    ],
    'drukhari--skysplinter-assault': [
      { id: 'rain-of-cruelty', name: 'Rain of Cruelty', kind: 'always', source: 'detachment', effect: 'DRUKHARI unit disembarks from a TRANSPORT: ranged weapons have [IGNORES COVER] and melee weapons have [LANCE] until the end of the turn' }
    ],
    'drukhari--spectacle-of-spite': [
      { id: 'combat-drugs', name: 'Combat Drugs', kind: 'choice', source: 'detachment', pick: 'multi', max: 2,
        when: 'Start of your Command phase: select one (each once per battle) or roll two D6 at random', duration: 'until your next Command phase',
        options: [
          { id: 'adrenalight', name: '1. Adrenalight', effect: 'WYCH CULT melee weapons: +1 Attacks' },
          { id: 'hypex', name: '2. Hypex', effect: 'WYCH CULT models: +2" Move' },
          { id: 'serpentin', name: '3. Serpentin', effect: 'WYCH CULT melee weapons: improve WS by 1' },
          { id: 'painbringer', name: '4. Painbringer', effect: 'WYCH CULT models: +1 Toughness' },
          { id: 'grave-lotus', name: '5. Grave Lotus', effect: 'WYCH CULT melee weapons: +1 Strength' },
          { id: 'splintermind', name: '6. Splintermind', effect: 'WYCH CULT models: improve Leadership by 1 · ranged weapons: improve BS by 1' }
        ] }
    ],
    'drukhari--covenite-coterie': [
      { id: 'stitchflesh-abominations', name: 'Stitchflesh Abominations', kind: 'always', source: 'detachment', effect: 'Attacks vs HAEMONCULUS COVENS units with S > T: −1 to Wound' }
    ],
    'drukhari--kabalite-cartel': [
      { id: 'murderous-agenda', name: 'Murderous Agenda', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the first battle round (select Contract and enemy Contract unit)', duration: 'until the Contract is completed',
        options: [
          { id: 'trophy-hunters', name: 'Trophy Hunters', effect: 'Contract: one CHARACTER unit · KABAL / BLADES FOR HIRE attacks vs the Contract unit have [PRECISION]' },
          { id: 'sow-fear-and-terror', name: 'Sow Fear and Terror', effect: 'Contract: one INFANTRY / MOUNTED unit (completed when all non-CHARACTER models are destroyed) · KABAL / BLADES FOR HIRE attacks vs INFANTRY / MOUNTED have [SUSTAINED HITS 1]' },
          { id: 'show-of-strength', name: 'Show of Strength', effect: 'Contract: one MONSTER / VEHICLE unit · KABAL / BLADES FOR HIRE attacks vs MONSTER / VEHICLE have [LETHAL HITS]' }
        ] },
      { id: 'contract-completed', name: 'Contract completed', kind: 'always', source: 'detachment', scope: 'Command', effect: 'Start of your Command phase: Contract unit destroyed → +3 Pain tokens' }
    ],
    'drukhari--kabalite-agonysts': [
      { id: 'contracted-harvest', name: 'Contracted Harvest', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'BLADES FOR HIRE / KABAL ranged attacks have [SUSTAINED HITS 1] vs non-MONSTER/VEHICLE' }
    ],
    'drukhari--exhibition-of-slaughter': [
      { id: 'exacting-cruelty', name: 'Exacting Cruelty', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'WYCH CULT melee attacks have [LETHAL HITS] vs non-MONSTER/VEHICLE' }
    ],
    'drukhari--tools-of-torment': [
      { id: 'darkest-artifice', name: 'Darkest Artifice', kind: 'always', source: 'detachment', effect: 'Attacks vs CRONOS / TALOS units with S > T: −1 to Wound' }
    ],
    'drukhari--space-lane-raiders': [
      feastOfPain,
      { id: 'commorrite-rivalries', name: 'Commorrite Rivalries', kind: 'always', source: 'detachment', effect: 'DRUKHARI CHARACTER destroys an enemy CHARACTER unit: +1 Pain token · Battlefield Command Stratagem: spend 1 Pain token for −1CP' }
    ],
    'drukhari--kabalite-corsairs': [
      feastOfPain,
      { id: 'raid-and-pillage', name: 'Raid and Pillage', kind: 'always', source: 'detachment', effect: 'DRUKHARI unit destroys an enemy unit that was within range of an objective marker controlled by your opponent at the start of the phase: +1 Pain token · Your Command phase: spend 1 Pain token to Secure an objective marker you control with a KABAL unit in range' }
    ],
    'drukhari--ship-killer-cult': [
      feastOfPain,
      { id: 'appetite-for-adulation', name: 'Appetite for Adulation', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'Fight phase: two or more enemy units destroyed by DRUKHARI units this phase → +1 Pain token · WYCH CULT unit Empowered in the Fight phase: melee weapons have [ANTI-INFANTRY 4+] until the end of the phase' }
    ],
    'drukhari--painbringers': [
      feastOfPain,
      { id: 'regenerative-agony', name: 'Regenerative Agony', kind: 'always', source: 'detachment', effect: 'Four or more successful Feel No Pain rolls for HAEMONCULUS COVENS models in one phase: +1 Pain token · First HAEMONCULUS COVENS unit Empowered each battle round, D6: 2–5 one model regains 1 lost wound, 6 up to 2 lost wounds (WRACKS: one destroyed model returns instead)' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  stratAddons: {
    'Instinctive Spite': [{ id: 'wound', name: '+1 to Wound', resource: PAIN, cost: 1, effect: 'Also +1 to the Wound roll' }],
    'Postmortality': [{ id: 'spend', name: 'Spend 1–3 Pain tokens', resource: PAIN, cost: 'any', effect: 'Model returns with wounds remaining equal to the Pain tokens spent (1–3)' }],
    'Connoisseurs of Pain': [{ id: 'ap', name: 'Spend 1 Pain token', resource: PAIN, cost: 1, effect: 'Worsen AP of attacks vs your unit by 1 · HAEMONCULUS COVENS still on the battlefield at the end of the phase: +1 Pain token' }]
  }
};
