/* Random terrain layout for the game (js/ui/random-layout.js): the generator in engine/layoutgen.js places the Armageddon
 * footprints by the Event Companion principles around the game's Deployment card – on the 44"×60" battlefield the full set,
 * on a half table (opts.board 'half', 44"×30") half the set. The result travels with the game (mission.terrainPieces), so
 * every device and the VR headset show the same table. → { type: 'mission.set', terrainLayout, terrainPieces } or null */
import { generate } from '../../engine/layoutgen.js';
import { deploymentMapOf } from '../../engine/derive.js';

export function randomLayoutAction(state, seed) {
  const half = state && state.opts && state.opts.board === 'half';
  const map = deploymentMapOf(state);
  const objectives = map ? [map.home.a, map.home.d, map.exp[0], map.exp[1], map.centre || (half ? [22, 15] : [22, 30])] : [];
  const r = generate({ seed: seed >>> 0 || undefined, board: half ? 'half' : 'full', objectives, zones: map ? map.zones : null, tries: 1500 });
  if (!r || !r.pieces) return null;
  const pieces = r.pieces.map(p => Object.assign({ kind: 'ruin', x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot || 0, tall: !!p.tall }, p.poly ? { poly: p.poly } : {}, p.parts ? { parts: p.parts } : {}));
  return { type: 'mission.set', terrainLayout: 'random-' + r.seed, terrainPieces: pieces };
}
