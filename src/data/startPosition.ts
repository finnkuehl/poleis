// Rules for choosing where a civilization starts (its first city center).
// Used by src/core/mapgen/startPositions.ts. See docs/GAME_DESIGN.md (start bullet).
// Change the numbers here to make starts easier or harder.

export const startPositionConfig = {
  // Area checked around the city center (= city territory radius).
  radius: 2,
  // At least this many forest tiles in that area (wood for the woodcutter).
  minForest: 2,
  // At least this many hills or mountain tiles in that area (stone, ore).
  minHillsOrMountains: 1,
  // At least this many plains tiles in that area (room to build), center included.
  minPlains: 6,
  // Extra score if coastal water lies in the area (a fishery is possible).
  coastBonus: 3,
  // Minimum distance between two start positions (later: AI civilizations).
  minDistanceBetweenStarts: 8,
  // The first start is picked randomly among the best-scoring share of candidates (0.2 = best 20 %).
  topShare: 0.2,
  // Score: each terrain kind only counts up to this many tiles (more variety beats a huge pile of one kind).
  scoreCapForest: 5,
  scoreCapHillsOrMountains: 4,
  scoreCapPlains: 10,
} as const;
