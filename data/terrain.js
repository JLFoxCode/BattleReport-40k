// Terrain pieces for the 40k tracker – the piece format shared by the Event Companion layouts (data/layouts11.js), the
// random generator (engine/layoutgen.js) and the VR table setup. Inches, origin top left, battlefield 44" (x) × 60" (y).
// x,y = centre of the piece; w = extent along x before rotation, h along y; rot = degrees clockwise; tall = dense
// (blocks line of sight) / false = light (cover only); poly = irregular outline relative to (x, y); parts = the
// individual terrain features on the area (see data/layouts11.js). The layouts themselves are the 11th-edition Event
// Companion's – the 10th-edition Chapter Approved layouts are gone.
export const TERRAIN_KINDS = { ruin: 'Ruine', wall: 'Mauer', crate: 'Container', crater: 'Krater', wood: 'Wald' };
