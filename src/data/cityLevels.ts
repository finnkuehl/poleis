// City levels: needs and the requirements to advance (see docs/GAME_DESIGN.md, section 6).

import type { CityLevel } from './buildings';
import type { GoodId, Goods } from './goods';

/** All levels from lowest to highest. */
export const CITY_LEVELS: readonly CityLevel[] = ['settlement', 'polis', 'metropolis'];

/** A need besides food: 1 of `good` per `residentsPer` residents each turn (rounded up). */
export interface Need {
  good: GoodId;
  residentsPer: number;
}

/** Requirements to advance to the next level. */
export interface Advance {
  to: CityLevel;
  // Residents the city needs.
  minResidents: number;
  // This good must be supplied (at the next level's rate) ...
  supplyGood: GoodId;
  // ... for this many turns in a row.
  supplyTurns: number;
  // Goods paid once when advancing.
  cost: Goods;
}

export interface CityLevelDef {
  /** Needs of this level besides food. */
  needs: readonly Need[];
  /** How to reach the next level (null = highest level). */
  next: Advance | null;
}

export const CITY_LEVEL_DEFS: Record<CityLevel, CityLevelDef> = {
  settlement: {
    needs: [],
    next: {
      to: 'polis',
      minResidents: 20,
      supplyGood: 'oil',
      supplyTurns: 3,
      cost: { planks: 20, stone: 20, drachmas: 30 },
    },
  },
  polis: {
    needs: [{ good: 'oil', residentsPer: 10 }],
    next: {
      to: 'metropolis',
      minResidents: 50,
      supplyGood: 'wine',
      supplyTurns: 3,
      cost: { planks: 40, stone: 40, bronze: 10, drachmas: 80 },
    },
  },
  metropolis: {
    needs: [
      { good: 'oil', residentsPer: 10 },
      { good: 'wine', residentsPer: 10 },
    ],
    next: null,
  },
};
