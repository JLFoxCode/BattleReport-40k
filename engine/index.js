/* Engine-Einstieg (Server + Browser): export { initialState, reduce, derive, ACTIONS, OBJ_RANGE } */
export { initialState, reduce, ACTIONS, ACTION_TYPES, parseArmyText, radiusFor } from './reduce.js';
export { derive, deriveBase, computeControl, territoryFn, nmlFn, zoneOf, zonesOf, unitInRange, activePlayer, attackerOf, nextCheckpoint, OBJ_RANGE } from './derive.js';
export { CAPS, turnNo, turnNoOf, autoContext, evalCondition, condMatches, checkpointItems, applyCaps, capUsage, vpTotals, currentMoment, activeSecondaries, playerCards } from './scoring.js';
export { stratList, stratById, stratCheck, stratsWithAvailability, fitsPhase } from './stratagems.js';
export { mulberry32, nextInt, nextFloat, shuffle, roll } from './rng.js';
export { dist, pointInPolygon, centroid, sideOfLine, circlesIntersect, clamp, round2 } from './geometry.js';
