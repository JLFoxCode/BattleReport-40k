/* Thousand Sons – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/thousand-sons.json; Ritual effects from the Rituals profiles in
 * vendor-data/bsdata/wh40k-11e-main/Chaos - Thousand Sons.json (not in the orig army rule text).
 * Effect texts are short English summaries of the CHANGE only. */
const TWISTING_FATE = { id: 'twisting-fate', name: 'Twisting Fate', kind: 'always', source: 'detachment', effect: 'Replaces Cabal of Sorcerers · Any player spends CP on a Stratagem: D6 (+1 in Ascendance – TS PSYKER on the battlefield and you control at least as many objectives) – 1–2 opponent gains 1CP, 6+ you gain 1CP' };

export default {
  faction: 'thousand-sons',
  effects: [
    {
      id: 'cabal-of-sorcerers', name: 'Cabal of Sorcerers – Rituals', kind: 'choice', source: 'army', pick: 'multi', max: 4,
      when: 'Start of your Shooting phase (Psychic test per Ritual; each Ritual once per turn)', duration: 'this phase',
      options: [
        { id: 'destinys-ruin', name: 'Destiny’s Ruin (WC 5)', effect: 'One enemy unit within 24": THOUSAND SONS / SCINTILLATING LEGION attacks vs it re-roll Hit rolls of 1 (10+: re-roll the Hit roll)' },
        { id: 'temporal-surge', name: 'Temporal Surge (WC 6)', effect: 'One friendly unit within 24" (not engaged): Normal move up to D6" (10+: 6") · cannot charge this turn' },
        { id: 'doombolt', name: 'Doombolt (WC 7)', effect: 'One enemy unit within 24": D3 mortal wounds (11+: D3+3)' },
        { id: 'twist-of-fate', name: 'Twist of Fate (WC 9)', effect: 'One enemy unit within 24": THOUSAND SONS / SCINTILLATING LEGION attacks vs it improve AP by 1 (12+: by 2)' }
      ]
    }
  ],
  detachments: {
    'thousand-sons--grand-coven': [
      {
        id: 'kindred-sorcery', name: 'Kindred Sorcery', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'imbued-manifestation', name: 'Imbued Manifestation', limit: 'battle', effect: '+6" range on ranged PSYCHIC weapons of THOUSAND SONS models' },
          { id: 'psychic-maelstrom', name: 'Psychic Maelstrom', limit: 'battle', effect: 'THOUSAND SONS attacks with PSYCHIC weapons: +1 to Wound' },
          { id: 'wrath-of-the-immaterium', name: 'Wrath of the Immaterium', limit: 'battle', effect: 'THOUSAND SONS PSYCHIC weapons have [DEVASTATING WOUNDS]' }
        ]
      }
    ],
    'thousand-sons--hexwarp-thrallband': [
      { id: 'flow-of-magic', name: 'Flow of Magic', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS Psychic Attacks: re-roll Wound rolls of 1 · +1 to Wound instead if wholly within your Flow of Magic (your deployment zone; No Man’s Land / enemy deployment zone this phase if you control at least half of its objectives)' }
    ],
    'thousand-sons--rubricae-phalanx': [
      { id: 'all-is-dust', name: 'All is Dust', kind: 'always', source: 'detachment', effect: 'Attacks with unmodified Damage 1 allocated to RUBRICAE models: +1 to armour saves' }
    ],
    'thousand-sons--warpforged-cabal': [
      { id: 'warpfire-infusion', name: 'Warpfire Infusion', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS VEHICLE shoots/fights: re-roll one Hit, one Wound or one Damage roll (all three if within 6" of a friendly THOUSAND SONS PSYKER) · Deadly Demise on 5+ while within 6" of a friendly THOUSAND SONS PSYKER' }
    ],
    'thousand-sons--warpmeld-pact': [
      { id: 'warpmeld-sacrifice', name: 'Warpmeld Sacrifice', kind: 'always', source: 'detachment', effect: 'TZEENTCH MUTANT INFANTRY/MOUNTED, Warpmeld Sacrifice (D3 mortal wounds at end of phase): when targeted −1 to Wound against it, or when shooting/fighting +1 to Wound · TZAANGORS are BATTLELINE with +1 OC (not Battle-shocked)' }
    ],
    'thousand-sons--changehost-of-deceit': [
      { id: 'infernal-pacts', name: 'Infernal Pacts', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS PSYKER within 6" of and visible to a SCINTILLATING LEGIONS unit: 4+ invulnerable save vs ranged attacks · SCINTILLATING LEGIONS PSYKER within 6" of and visible to a THOUSAND SONS unit has Cabal of Sorcerers' }
    ],
    'thousand-sons--sekhetar-cohort': [
      { id: 'ensorcelled-animus', name: 'Ensorcelled Animus', kind: 'always', source: 'detachment', effect: 'SEKHETAR ROBOTS attacks have [PSYCHIC] · SEKHETAR ROBOTS within 12" of a friendly THOUSAND SONS PSYKER: +1 WS on melee attacks' }
    ],
    'thousand-sons--servants-of-change': [
      { id: 'all-seeing-mutant-hordes', name: 'All-seeing Mutant Hordes', kind: 'always', source: 'detachment', effect: 'TZAANGORS are BATTLELINE · Your Shooting phase: enemy units have +6" detection range while a MUTANT unit is shooting' }
    ],
    'thousand-sons--ritual-of-regeneration': [
      { id: 'sorcerous-invigoration', name: 'Sorcerous Invigoration', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS PSYKER unit (not MONSTER) manifests a Ritual: heals D3 wounds (once per turn per unit)' }
    ],
    'thousand-sons--chosen-cabal': [
      TWISTING_FATE,
      { id: 'witchsight', name: 'Witchsight', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS ranged weapons have [IGNORES COVER]' }
    ],
    'thousand-sons--devoted-thralls': [
      TWISTING_FATE,
      { id: 'fervent-devotees', name: 'Fervent Devotees', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS melee weapons have [SUSTAINED HITS 1] vs enemy units within range of an objective marker' }
    ],
    'thousand-sons--fateseekers': [
      TWISTING_FATE,
      { id: 'methodical-conquest', name: 'Methodical Conquest', kind: 'always', source: 'detachment', effect: 'THOUSAND SONS Overwatch hits on unmodified 5+ · SCARAB OCCULT TERMINATORS can Set Overwatch and Secure Site in the same turn' }
    ]
  },
  stratAddons: {}
};
