// Kartengenerierung aus einem Seed: Festland, Inseln, Terrain, Küstenwasser.
// Alle Zahlen stehen in src/data/mapgen.ts.

export { generateMap, generateMapWithStats } from './generate';
export { findLandmasses, isPassableConnected } from './landmass';
