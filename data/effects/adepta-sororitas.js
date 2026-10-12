/* Adepta Sororitas – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/adepta-sororitas.json; effect texts are short English summaries of the CHANGE only. */
const MD = 'Miracle Dice';

export default {
  faction: 'adepta-sororitas',
  effects: [
    { id: 'acts-of-faith', name: 'Acts of Faith', kind: 'always', source: 'army', scope: 'Any phase', effect: 'Units with Acts of Faith: 1 Act of Faith per phase – replace one Hit, Wound, Damage, Save, Advance, Charge or Battle-shock dice with a Miracle dice (counts as unmodified)' }
  ],
  detachments: {
    'adepta-sororitas--hallowed-martyrs': [
      { id: 'the-blood-of-martyrs', name: 'The Blood of Martyrs', kind: 'always', source: 'detachment', effect: 'ADEPTA SORORITAS attacks: +1 to Hit if the unit is below Starting Strength · also +1 to Wound if Below Half-strength' }
    ],
    'adepta-sororitas--champions-of-faith': [
      { id: 'righteous-purpose', name: 'Righteous Purpose', kind: 'always', source: 'detachment', effect: 'Up to 3 ADEPTA SORORITAS units Righteous (selected in your Command phase, until your next): +1" M, +1 Ld · BATTLE SISTERS SQUAD / CELESTIAN INSIDIANTS / CELESTIAN SACRESANTS / PARAGON WARSUITS: +1 WS and BS' },
      { id: 'sacresants-oc', name: 'Celestian Sacresants', kind: 'always', source: 'detachment', effect: 'CELESTIAN SACRESANTS units (not Battle-shocked): +1 OC' }
    ],
    'adepta-sororitas--bringers-of-flame': [
      { id: 'fervent-purgation', name: 'Fervent Purgation', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTA SORORITAS ranged weapons gain [ASSAULT] · +1 S vs units within 6"' }
    ],
    'adepta-sororitas--penitent-host': [
      { id: 'desperate-for-redemption', name: 'Desperate for Redemption', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round', duration: 'battle round',
        options: [
          { id: 'path-of-the-penitent', name: 'The Path of the Penitent', limit: 'battle', effect: 'PENITENT models: +3" Move' },
          { id: 'absolution-in-battle', name: 'Absolution in Battle', limit: 'battle', effect: 'PENITENT units that charged this turn: +1 A and +1 S to melee weapons when selected to fight' },
          { id: 'death-before-disgrace', name: 'Death Before Disgrace', limit: 'battle', effect: 'PENITENT models destroyed by a melee attack before fighting: on 2+ fight after the attacking unit, then removed' }
        ] }
    ],
    'adepta-sororitas--army-of-faith': [
      { id: 'sacred-rites', name: 'Sacred Rites', kind: 'always', source: 'detachment', effect: 'ADEPTA SORORITAS units: up to 2 Acts of Faith per phase' }
    ],
    'adepta-sororitas--sanctified-orators': [
      { id: 'hymns-of-battle', name: 'Hymns of Battle', kind: 'always', source: 'detachment', effect: 'ADEPTA SORORITAS CHARACTER units: +1 Ld · Enhancements from this detachment do not count towards the Enhancement limit' }
    ],
    'adepta-sororitas--chorus-of-condemnation': [
      { id: 'angelic-judgement', name: 'Angelic Judgement', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ADEPTA SORORITAS INFANTRY FLY units: in your Shooting phase, condemn one visible enemy unit within 12" – condemned units have +3" detection range' }
    ],
    'adepta-sororitas--sacred-champions': [
      { id: 'holy-quest', name: 'Holy Quest', kind: 'always', source: 'detachment', effect: 'CELESTIAN units’ attacks: +1 BS and WS' }
    ],
    'adepta-sororitas--pious-protectors': [
      { id: 'minor-miracles', name: 'Minor Miracles', kind: 'always', source: 'detachment', effect: 'Start-of-turn Miracle dice only in your turn · +1 to the value of every Miracle dice gained (max. 6)' },
      { id: 'the-emperor-protects', name: 'The Emperor Protects', kind: 'always', source: 'detachment', effect: 'ADEPTA SORORITAS units (not ARCO-FLAGELLANTS / REPENTIA SQUAD) within range of an objective marker: 4+ invulnerable save (3+ if they performed Secure Site in your previous Shooting phase)' }
    ],
    'adepta-sororitas--penitents-and-pilgrims': [
      { id: 'minor-miracles', name: 'Minor Miracles', kind: 'always', source: 'detachment', effect: 'Start-of-turn Miracle dice only in your turn · +1 to the value of every Miracle dice gained (max. 6)' },
      { id: 'bloody-redemption', name: 'Bloody Redemption', kind: 'always', source: 'detachment', effect: 'First Miracle dice each turn from a destroyed ARCO-FLAGELLANTS / REPENTIA SQUAD unit has a value of 6' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  stratAddons: {
    'Divine Intervention': [
      { id: 'md1', name: 'Discard 1 Miracle dice', resource: MD, cost: 1, effect: '+1 to the D3 roll for wounds remaining' },
      { id: 'md2', name: 'Discard 2 Miracle dice', resource: MD, cost: 2, effect: '+2 to the D3 roll for wounds remaining' },
      { id: 'md3', name: 'Discard 3 Miracle dice', resource: MD, cost: 3, effect: '+3 to the D3 roll for wounds remaining' }
    ],
    'Final Testament': [{ id: 'md1', name: '+1 to the D6', resource: MD, cost: 1, effect: '+1 to the D6 roll (fight on 4+)' }],
    'Prayer of Precision': [{ id: 'rr-hit', name: 'Re-roll Hit rolls', resource: MD, cost: 1, effect: 'Re-roll the Hit roll instead of only 1s' }],
    'Radiant Illumination': [{ id: 'charge-2', name: '−2 Charge', resource: MD, cost: 1, effect: 'Subtract 2 from Charge rolls instead of 1' }]
  }
};
