// World wonder and victory points (docs/GAME_DESIGN.md, section 10).
// To rebalance: change the numbers below.

export const wonderConfig = {
  // Working turns (full crew + road connection + not paused) until the wonder is complete.
  buildTurns: 5,
  // How many wonders one civilization may own (a captured one counts).
  maxPerCivilization: 1,
} as const;

export const scoreConfig = {
  // Points per resident.
  perResident: 1,
  // Points per building (every building incl. city centers and the wonder, not roads).
  perBuilding: 2,
  // Points per territory tile.
  perTerritoryTile: 1,
  // Points per city by its level (not added up: a Metropolis gives 50, not 70).
  cityLevel: { settlement: 0, polis: 20, metropolis: 50 },
  // Extra points per temple (on top of its building points).
  temple: 15,
  // Extra points for a completed wonder (on top of its building points).
  wonderComplete: 150,
} as const;
