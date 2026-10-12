/* Imperial Agents – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/imperial-agents.json; effect texts are short English summaries of the CHANGE only.
 * Assigned Agents is an army-building rule only and has no in-game effect here. */
const IMPERIAL_INSIGHTS = { id: 'imperial-insights', name: 'Imperial Insights', kind: 'always', source: 'detachment', effect: 'Replaces Assigned Agents · Secure Site: objective is Secured immediately · then Normal move up to D6" (still cannot shoot or charge)' };

export default {
  faction: 'imperial-agents',
  effects: [
    { id: 'kill-team', name: 'Kill Team', kind: 'always', source: 'army', effect: 'Attacks vs this unit use the majority Toughness (ties: highest) · Terminator/Outrider/Biker/jump pack models take 2 transport slots · all models count as INFANTRY for terrain' }
  ],
  detachments: {
    'imperial-agents--ordo-malleus-daemon-hunters': [
      { id: 'destroy-the-daemonic', name: 'Destroy the Daemonic', kind: 'always', source: 'detachment', effect: 'INQUISITOR / INQUISITORIAL AGENTS / ORDO MALLEUS attacks: re-roll Hit rolls of 1 · vs DAEMON units also re-roll Wound rolls of 1' }
    ],
    'imperial-agents--ordo-xenos-alien-hunters': [
      {
        id: 'mission-tactics', name: 'Deathwatch Mission Tactics', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'furor', name: 'Furor Tactics', limit: 'battle', effect: 'DEATHWATCH weapons have [SUSTAINED HITS 1]' },
          { id: 'malleus', name: 'Malleus Tactics', limit: 'battle', effect: 'DEATHWATCH weapons have [LETHAL HITS]' },
          { id: 'purgatus', name: 'Purgatus Tactics', limit: 'battle', effect: 'DEATHWATCH attacks: Critical Wound = [PRECISION]' }
        ]
      }
    ],
    'imperial-agents--imperialis-fleet': [
      {
        id: 'at-all-costs', name: 'At All Costs', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'eliminate', name: 'Eliminate At All Costs', effect: 'One enemy unit: AGENTS OF THE IMPERIUM attacks vs it +1 to Hit' },
          { id: 'acquire', name: 'Acquire At All Costs', effect: 'One objective marker: AGENTS OF THE IMPERIUM units within range +1 Ld, +1 OC and 5+ invulnerable save' }
        ]
      }
    ],
    'imperial-agents--ordo-hereticus-purgation-force': [
      { id: 'root-out-heresy', name: 'Root Out Heresy', kind: 'always', source: 'detachment', effect: 'ADEPTUS ARBITES / INQUISITOR / INQUISITORIAL AGENTS / ORDO HERETICUS: ranged weapons have [IGNORES COVER] · attacks vs CHAOS units of 5+ models have [SUSTAINED HITS 1]' }
    ],
    'imperial-agents--veiled-blade-elimination-force': [
      { id: 'extremis-sanction', name: 'Extremis Sanction', kind: 'always', source: 'detachment', effect: 'OFFICIO ASSASSINORUM: Overkill, Soulless Horror and Shieldbreaker twice per battle (max. once per battle round) · units have their Extremis ability (extra points)' }
    ],
    'imperial-agents--voidship-s-company': [
      IMPERIAL_INSIGHTS,
      { id: 'beseechment-codes', name: 'Beseechment Codes', kind: 'always', source: 'detachment', effect: 'VOIDFARERS Normal move: can operate a closed Hatchway within 1" during the move (no enemy within 1" of it, once per turn)' }
    ],
    'imperial-agents--interdiction-team': [
      IMPERIAL_INSIGHTS,
      { id: 'chastisor-auto-vox', name: 'Chastisor Auto-Vox', kind: 'always', source: 'detachment', effect: 'Opponent’s Command phase: enemy units within 3" of ADEPTUS ARBITES take a Battle-shock test (−1 if Below Half-strength; max. one per phase)' }
    ]
  },
  stratAddons: {}
};
