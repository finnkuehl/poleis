import { describe, expect, it } from 'vitest';
import type { CityReport } from '../core/rules/population';
import type { TurnReport } from '../core/rules/production';
import { turnSummary } from './turnSummary';

function cityReport(over: Partial<CityReport>): CityReport {
  return {
    cityId: 1,
    residentsBefore: 6,
    residentsAfter: 6,
    foodNeeded: 3,
    foodEaten: {},
    fed: true,
    needsMet: true,
    needsConsumed: {},
    supplied: null,
    supplyStreak: 0,
    taxes: 0,
    ...over,
  };
}

function report(...cities: CityReport[]): TurnReport {
  return {
    turn: 5,
    player: 0,
    delta: {},
    buildings: [],
    cities,
    units: { spawned: 0, upkeepEaten: {}, starving: false, lost: 0 },
  };
}

describe('turnSummary', () => {
  it('is empty without news', () => {
    expect(turnSummary(report(cityReport({})))).toEqual([]);
    expect(turnSummary({ ...report(), cities: [] })).toEqual([]);
  });
  it('joins growth and taxes with commas', () => {
    const r = report(cityReport({ residentsAfter: 7, taxes: 3 }));
    expect(turnSummary(r)).toEqual([{ text: 'Turn 5: +1 resident, +3 drachmas', kind: 'info' }]);
  });
  it('uses plurals', () => {
    const r = report(cityReport({ residentsAfter: 8, taxes: 1 }));
    expect(turnSummary(r)[0]?.text).toBe('Turn 5: +2 residents, +1 drachma');
  });
  it('reports hunger as an error, still showing taxes', () => {
    const r = report(cityReport({ fed: false, residentsAfter: 5, taxes: 2 }));
    expect(turnSummary(r)).toEqual([
      { text: 'Turn 5: +2 drachmas', kind: 'info' },
      { text: 'Hunger: lost 1 resident', kind: 'error' },
    ]);
  });
  it('reports hunger without a loss at the minimum', () => {
    const r = report(cityReport({ fed: false, residentsBefore: 1, residentsAfter: 1 }));
    expect(turnSummary(r)).toEqual([
      { text: 'Hunger: the city has too little food.', kind: 'error' },
    ]);
  });
  it('shows supply progress only when supplied and the context is known', () => {
    const r = report(cityReport({ supplied: true, supplyStreak: 2 }));
    expect(turnSummary(r)).toEqual([]);
    expect(turnSummary(r, { supply: { 1: { good: 'oil', turnsNeeded: 3 } } })).toEqual([
      { text: 'Oil supplied 2 of 3 turns', kind: 'info' },
    ]);
    const missed = report(cityReport({ supplied: false }));
    expect(turnSummary(missed, { supply: { 1: { good: 'oil', turnsNeeded: 3 } } })).toEqual([]);
  });
  it('stops reporting supply once the goal is reached', () => {
    const ctx = { supply: { 1: { good: 'oil' as const, turnsNeeded: 3 } } };
    expect(turnSummary(report(cityReport({ supplied: true, supplyStreak: 3 })), ctx)).toEqual([
      { text: 'Oil supplied 3 of 3 turns', kind: 'info' },
    ]);
    expect(turnSummary(report(cityReport({ supplied: true, supplyStreak: 16 })), ctx)).toEqual([]);
  });
  it('announces cities that are ready to advance', () => {
    const r = report(cityReport({ taxes: 3 }));
    expect(turnSummary(r, { canAdvance: { 1: 'polis' } })).toEqual([
      { text: 'Turn 5: +3 drachmas', kind: 'info' },
      { text: 'Ready to advance to Polis', kind: 'info' },
    ]);
  });
});
