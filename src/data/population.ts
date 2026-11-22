// Residents, food and taxes (see docs/GAME_DESIGN.md, section 6).
// To rebalance: change the numbers below, save, reload the game.

export const populationConfig = {
  // Residents of a brand-new city (its city center is full right away).
  startResidents: 4,
  // 1 food is eaten per this many residents each turn (rounded up).
  residentsPerFood: 2,
  // Food goods in the order they are eaten (fish first, grain is kept back for settlers and horsemen).
  foodOrder: ['fish', 'grain'] as const,
  // Residents that move in per turn if the city is fed and has free housing.
  growthPerTurn: { settlement: 1, polis: 2, metropolis: 2 },
  // Residents lost per turn if there is not enough food.
  starvationLoss: 1,
  // A city never drops below this many residents.
  minResidents: 1,
  // 1 drachma of tax per this many residents (rounded down).
  residentsPerTax: 2,
  // Extra tax (0.5 = +50 %) if all needs of the city's level are covered.
  taxBonus: 0.5,
};
