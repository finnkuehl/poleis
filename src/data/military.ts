// General military numbers (see docs/GAME_DESIGN.md, section 7).
// To rebalance: change the numbers below, save, reload the game.

export const militaryConfig = {
  // Food every unit eats per turn (after the residents; fish first, then grain).
  upkeepFood: 1,
  // Drachmas ("pay") every unit costs per turn. If food or drachmas do not last for all units,
  // every unit loses `starvationDamage` HP (once, even if both are short).
  upkeepDrachmas: 1,
  // HP every unit loses per turn if the food or the pay does not last for all units.
  starvationDamage: 2,
  // HP healed per turn by a unit that neither moved nor attacked.
  healIdle: 2,
  // Same, but standing inside the own territory.
  healOwnTerritory: 4,
  // Cost multiplier for entering a tile with a road (0.5 = half price).
  roadFactor: 0.5,
  // Movement points a ship spends per water tile (roads do not matter at sea).
  seaStepCost: 1,
  // No single step costs less than this, even with a road.
  minStepCost: 0.5,
  // Combat damage = share of attack power x attack x this factor.
  damageFactor: 4.5,
  // Defense multiplier for a unit standing on a city center.
  wallBonus: 1.5,
  // A city needs at least this many residents to train a settler.
  settlerMinCityResidents: 3,
  // A new city must be at least this many tiles from every city center.
  foundMinDistance: 4,
  // Residents of a city founded by a settler.
  newCityResidents: 2,
  // Test mode (&sandbox): distance between the human city and the passive enemy city.
  // The spot closest to `preferred` within min..max is used.
  sandboxEnemyDistance: { min: 6, max: 9, preferred: 7 },
  // Vision range of units, in tiles.
  visionUnit: 2,
  // Vision range of city centers and border towers, in tiles.
  visionCity: 3,
};
