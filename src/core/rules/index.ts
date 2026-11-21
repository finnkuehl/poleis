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
export * from './advance';
export * from './trade';
export * from './movement';
export * from './orders';
export * from './units';
export * from './combat';
export * from './capture';
export * from './found';
export * from './vision';
export * from './economy';
export * from './events';
export * from './elimination';
