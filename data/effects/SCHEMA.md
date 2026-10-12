# Effects schema – what is currently in effect for an army

The Army tab shows ONLY what currently changes the game for the player's army: active buffs and modifiers,
in short English ("+1 to Hit rolls vs units within range of an objective"), never rule explanations.
Verbatim originals stay available behind an (i) button (source: data/orig/<faction>.json).

File per faction: `data/effects/<factionId>.js`

```js
export default {
  faction: 'leagues-of-votann',
  effects: [ /* army-rule effects, always evaluated */ ],
  detachments: { '<detachment id>': [ /* effects of that detachment */ ] },
  stratAddons: { '<stratagem id>': [ /* optional upgrades bought with a resource */ ] }
};
```

## Effect kinds

Every effect has `{ id, name, kind, source: 'army' | 'detachment' | 'enhancement' }` plus:

| kind | meaning | extra fields |
|---|---|---|
| `always` | permanently active | `effect` (short text), `scope?` ("Shooting", "Fight", "Any phase") |
| `threshold` | exactly ONE state active, decided by a resource value | `resource` (resource name as in the faction `resource.name`), `decidedAt` (text, e.g. "End of your Command phase"), `states: [{ id, name, min?, max?, effect }]` (min/max inclusive; states never overlap) |
| `choice` | the player picks one option; the pick is active until changed or until the limit resets | `options: [{ id, name, effect, limit? ('battle' = each option once per battle), cost?, resource? }]` (cost/resource: picking the option spends that resource, e.g. Blood Tithe), `pick: 'one'` or `'multi'` (`max`), `duration` ("until your next Command phase", "this phase", "battle round", "battle"), `when` (text: when the pick is made) |
| `toggle` | on/off, e.g. a once-per-battle activation that lasts a while | `effect`, `limit` ('battle' | 'round' | 'turn'), `duration` (text), `when` (text) |
| `counter` | a value the effect scales with (Contagion range by round, Blood Tithe tiers …) | `byRound?: { 1: '3"', 2: '6"', 3: '9"' }` or `tiers: [{ min, effect }]` with `resource` |

Dependencies and extras:
- `replaces: [effectId]` on a detachment effect hides those army effects while that detachment is chosen (e.g. Mercenary Oathband replaces Prioritised Efficiency).
- `default` (option/state id) = the starting pick; `switchCost` + `resource` = cost to change a pick-one choice.
- Add-ons with `cost: 'any'` may set `max` (the amount stepper is capped).

Rules:
- `effect` texts: short English, describe the CHANGE ("Ranged weapons gain [ASSAULT]"), keywords uppercase, no flavour, no "you can…" explanations of procedure.
- Conditions that are pure table state (e.g. "while within range of an objective") stay in the effect text.
- Every effect must be derived from the verbatim original (army rule / detachment rule / enhancement) – nothing invented.
- Unit-level abilities are NOT here (they live on the datasheets).

## Stratagem add-ons (resource upgrades)

```js
stratAddons: {
  'Fury of the Hearth': [   // keyed by stratagem NAME (case-insensitive match)
    { id: 'sh1', name: '+[SUSTAINED HITS 1]', resource: 'Yield Points (YP)', cost: 1, effect: 'Ranged weapons also gain [SUSTAINED HITS 1]' }
  ]
}
```
`cost` (number, or `'any'`) is deducted from the resource when the stratagem is used with that add-on.
Optional `cpDelta` (e.g. `-1`) changes the stratagem's CP cost when the add-on is chosen (Aeldari Seer Council Fate dice).
Detachment keys in `detachments` are our detachment ids from data/factions (see `factionById(id).detachments[].id`).
Reference implementation: `data/effects/leagues-of-votann.js`.

## Game state (engine)

`players[p].effects = { '<effectKey>': { value, round, turn } }` via action
`effect.set { player, key, value }` (value: state id, option id, array of option ids, true/false, or null to clear).
Keys: `army:<effectId>`, `det:<detachmentId>:<effectId>`.
Used options with `limit: 'battle'` are tracked via `ability.use` with key `opt:<effectKey>:<optionId>`.
