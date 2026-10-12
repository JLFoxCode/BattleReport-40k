/* Adeptus Mechanicus – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/adeptus-mechanicus.json; effect texts are short English summaries of the CHANGE only. */
const CLOSE_QUARTERS = {
  id: 'close-quarters-doctrinas', name: 'Close-quarters Doctrinas', kind: 'choice', source: 'detachment', pick: 'one',
  when: 'Start of the battle round (replaces Doctrina Imperatives)', duration: 'battle round',
  options: [
    { id: 'assault', name: '[ASSAULT]', effect: 'Ranged weapons gain [ASSAULT]' },
    { id: 'ignores-cover', name: '[IGNORES COVER]', effect: 'Ranged weapons gain [IGNORES COVER]' },
    { id: 'pistol', name: '[PISTOL]', effect: 'Ranged weapons gain [PISTOL]' }
  ]
};

export default {
  faction: 'adeptus-mechanicus',
  effects: [
    { id: 'doctrina-imperatives', name: 'Doctrina Imperatives', kind: 'choice', source: 'army', pick: 'one',
      when: 'Start of the battle round', duration: 'battle round',
      options: [
        { id: 'protector', name: 'Protector Imperative', effect: 'Ranged weapons gain [HEAVY], +1 BS · BATTLELINE units or units within 6" of a friendly ADEPTUS MECHANICUS BATTLELINE unit: −1 to Hit for melee attacks against them' },
        { id: 'conqueror', name: 'Conqueror Imperative', effect: 'Ranged weapons gain [ASSAULT], melee weapons +1 WS · BATTLELINE units or units within 6" of a friendly ADEPTUS MECHANICUS BATTLELINE unit: improve AP by 1' }
      ] }
  ],
  detachments: {
    'adeptus-mechanicus--haloscreed-battle-clade': [
      { id: 'noospheric-transference', name: 'Noospheric Transference', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Command phase (HALO OVERRIDE units: Incursion 1, Strike Force 2, Onslaught 3)', duration: 'until your next Command phase',
        options: [
          { id: 'electromotive-energisation', name: 'Electromotive Energisation', effect: 'HALO OVERRIDE units: +2" Move' },
          { id: 'microactuator-bracing', name: 'Microactuator Bracing', effect: 'HALO OVERRIDE units: +1 Toughness' },
          { id: 'predation-protocols', name: 'Predation Protocols', effect: 'HALO OVERRIDE units can charge after Advancing' },
          { id: 'muted-servomotors', name: 'Muted Servomotors', effect: 'HALO OVERRIDE units have Stealth' }
        ] }
    ],
    'adeptus-mechanicus--eradication-cohort': [
      { id: 'murderous-imperative', name: 'Murderous Imperative', kind: 'always', source: 'detachment', effect: 'SKITARII attacks: Protector Imperative → re-roll Hit rolls of 1 · Conqueror Imperative → re-roll Wound rolls of 1' }
    ],
    'adeptus-mechanicus--data-psalm-conclave': [
      { id: 'benediction-of-the-omnissiah', name: 'Benediction of the Omnissiah', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the first battle round', duration: 'battle',
        options: [
          { id: 'panegyric-procession', name: 'Panegyric Procession', effect: 'CULT MECHANICUS ranged attacks vs targets within half range: improve AP by 1' },
          { id: 'citation-in-savagery', name: 'Citation in Savagery', effect: 'CULT MECHANICUS units that charged this turn: +1 S and +1 A to melee weapons when selected to fight' }
        ] }
    ],
    'adeptus-mechanicus--explorator-maniple': [
      { id: 'acquisition-at-any-cost', name: 'Acquisition at any cost', kind: 'always', source: 'detachment', effect: 'ADEPTUS MECHANICUS attacks: re-roll Wound rolls of 1 if the attacker or the target is within range of your Acquisition objective marker (selected each Command phase)' }
    ],
    'adeptus-mechanicus--skitarii-hunter-cohort': [
      { id: 'skitarii-hunter-cohort', name: 'Skitarii Hunter Cohort', kind: 'always', source: 'detachment', effect: 'SKITARII INFANTRY / SKITARII MOUNTED / IRONSTRIDER BALLISTARII units have Stealth' }
    ],
    'adeptus-mechanicus--cohort-cybernetica': [
      { id: 'cyber-psalm-programming', name: 'Cyber Psalm-Programming', kind: 'always', source: 'detachment', effect: 'LEGIO CYBERNETICA units: +2" Move · +1 OC (not Battle-shocked)' }
    ],
    'adeptus-mechanicus--rad-zone-corps': [
      { id: 'rad-bombardment', name: 'Rad-bombardment', kind: 'always', source: 'detachment', effect: 'Start of battle round 1: Bombardment on enemy units in their deployment zone (stand firm: 3+ D3 mortal wounds · take cover: Battle-shocked, 5+ D3 mortal wounds) · Your Command phase, rounds 2–5: each enemy unit in its deployment zone on 3+ suffers 1 mortal wound and takes a Battle-shock test' }
    ],
    'adeptus-mechanicus--luminen-auto-choir': [
      { id: 'cyber-static-canticles', name: 'Cyber-static Canticles', kind: 'always', source: 'detachment', effect: 'CORPUSCARII ranged attacks gain [LETHAL HITS] · FULGURITE units heal D3 wounds after fighting' }
    ],
    'adeptus-mechanicus--lords-of-the-forge': [
      { id: 'war-form-mantles', name: 'War-form Mantles', kind: 'always', source: 'detachment', effect: 'TECH-PRIEST models: 4+ invulnerable save, Feel No Pain 5+ · Baffling Data Screed when selected to shoot (2+: enemy VEHICLE within 12" takes a Battle-shock roll at −1, or stay hidden)' }
    ],
    'adeptus-mechanicus--cohort-acquisitus': [
      { id: 'noospheric-recon', name: 'Noospheric Recon', kind: 'always', source: 'detachment', effect: 'PTERAXII / INFILTRATORS / RANGERS / SERBERYS RAIDERS / SERBERYS SULPHURHOUNDS gain RECON AUGURY · In your Shooting phase, analyse one visible enemy unit within 12" – analysed units have +3" detection range' }
    ],
    'adeptus-mechanicus--electromartyrs': [
      CLOSE_QUARTERS,
      { id: 'overload-machine-spirits', name: 'Overload Machine Spirits', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'When selected to shoot (optional): ranged weapons improve AP by 1 and gain [HAZARDOUS] this phase' }
    ],
    'adeptus-mechanicus--response-clade': [
      CLOSE_QUARTERS,
      { id: 'procedural-elimination', name: 'Procedural Elimination', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round', duration: 'battle round',
        options: [
          { id: 'melee', name: 'Melee attacks', effect: 'SKITARII melee attacks: re-roll Hit rolls of 1' },
          { id: 'ranged', name: 'Ranged attacks', effect: 'SKITARII ranged attacks: re-roll Hit rolls of 1' }
        ] }
    ],
    'adeptus-mechanicus--machine-cult': [
      CLOSE_QUARTERS,
      { id: 'canticles-of-the-omnissiah', name: 'Canticles of the Omnissiah', kind: 'always', source: 'detachment', effect: 'TECH-PRIEST / ELECTRO-PRIESTS units: +1 to Advance rolls, Charge rolls and Battle-shock tests' }
    ]
  },
  stratAddons: {}
};
