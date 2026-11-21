// Game rules (pure functions): goods, territory, placement, road connection,
// workers and production. Combat and victory follow in later milestones.
// Functions that change the state say so and mutate the passed object (the caller clones).

export * from './errors';
export * from './goods';
export * from './territory';
export * from './placement';
export * from './connection';
export * from './workers';
export * from './population';
export * from './production';
export * from './roads';
