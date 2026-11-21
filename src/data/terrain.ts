// Terrain values (see docs/GAME_DESIGN.md, section 3).
// Only numbers and rules live here, no texts (names come from i18n).

export type TerrainId = 'ocean' | 'coast' | 'plains' | 'forest' | 'hills' | 'mountains';

export interface TerrainDef {
  /** Water tile? Only ships can travel on water. */
  isWater: boolean;
  /** Movement cost for land units. null = cannot be entered (water: ships only, mountains: impassable). */
  moveCost: number | null;
  /** Defense multiplier (1.5 = 50 % stronger). null = no bonus ("–"). */
  defenseBonus: number | null;
  /** Can you build directly on the tile? (Forest: no, the woodcutter stands next to it.) */
  buildable: boolean;
}

/** All terrain types in a fixed order (e.g. for loops and tests). */
export const TERRAIN_IDS: readonly TerrainId[] = [
  'ocean',
  'coast',
  'plains',
  'forest',
  'hills',
  'mountains',
];

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  // Deep water, ships only.
  ocean: { isWater: true, moveCost: null, defenseBonus: null, buildable: false },
  // Water right next to land; fishery and harbor are built next to it.
  coast: { isWater: true, moveCost: null, defenseBonus: null, buildable: false },
  // Standard tile: 1 movement point, buildable.
  plains: { isWater: false, moveCost: 1, defenseBonus: 1.0, buildable: true },
  // Wood source: 2 movement points, defense x1.5, not directly buildable.
  forest: { isWater: false, moveCost: 2, defenseBonus: 1.5, buildable: false },
  // Quarry, mine, vineyard: 2 movement points, defense x1.5, buildable.
  hills: { isWater: false, moveCost: 2, defenseBonus: 1.5, buildable: true },
  // Impassable, not buildable (mine/quarry stand next to it).
  mountains: { isWater: false, moveCost: null, defenseBonus: null, buildable: false },
};
