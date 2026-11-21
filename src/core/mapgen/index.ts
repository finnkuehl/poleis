// Map generation from a seed: mainland, islands, terrain, coastal water.
// All numbers live in src/data/mapgen.ts.

export { generateMap, generateMapWithStats } from './generate';
export { findLandmasses, isPassableConnected } from './landmass';
