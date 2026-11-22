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
    units: {
      spawned: 0,
      upkeepEaten: {},
      upkeepPaid: 0,
      hungry: false,
      unpaid: false,
      starving: false,
      lost: 0,
    },
    captured: [],
    orders: [],
  };
}

describe('turnSummary', () => {
  it('is empty without news', () => {
    expect(turnSummary(report(cityReport({})))).toEqual([]);
    expect(turnSummary({ ...report(), cities: [] })).toEqual([]);
  });
  it('joins growth and taxes with commas', () => {
    const r = report(cityReport({ residentsAfter: 7, taxes: 3 }));
    expect(turnSummary(r)).toEqual([
      { text: 'Turn 5, City: +1 resident, +3 drachmas', kind: 'info' },
    ]);
  });
  it('uses plurals', () => {
    const r = report(cityReport({ residentsAfter: 8, taxes: 1 }));
    expect(turnSummary(r)[0]?.text).toBe('Turn 5, City: +2 residents, +1 drachma');
  });
  it('reports hunger as an error, still showing taxes', () => {
    const r = report(cityReport({ fed: false, residentsAfter: 5, taxes: 2 }));
    expect(turnSummary(r)).toEqual([
      { text: 'Turn 5, City: +2 drachmas', kind: 'info' },
      { text: 'Hunger in City: lost 1 resident', kind: 'error' },
    ]);
  });
  it('reports hunger without a loss at the minimum', () => {
    const r = report(cityReport({ fed: false, residentsBefore: 1, residentsAfter: 1 }));
    expect(turnSummary(r)).toEqual([{ text: 'Hunger in City: too little food.', kind: 'error' }]);
  });
  it('announces cities that are ready to advance', () => {
    const r = report(cityReport({ taxes: 3 }));
    expect(turnSummary(r, { canAdvance: { 1: 'polis' } })).toEqual([
      { text: 'Turn 5, City: +3 drachmas', kind: 'info' },
      { text: 'City is ready to advance to Polis', kind: 'info' },
    ]);
  });
  it('reports new units by name or by count', () => {
    const r = {
      ...report(),
      units: {
        spawned: 2,
        upkeepEaten: {},
        upkeepPaid: 0,
        hungry: false,
        unpaid: false,
        starving: false,
        lost: 0,
      },
    };
    expect(turnSummary(r, { spawnedUnits: ['spearman', 'settler'] })).toEqual([
      { text: 'Spearman is ready', kind: 'info' },
      { text: 'Settler is ready', kind: 'info' },
    ]);
    expect(turnSummary(r)).toEqual([{ text: '2 units are ready', kind: 'info' }]);
    expect(turnSummary({ ...r, units: { ...r.units, spawned: 1 } })).toEqual([
      { text: '1 unit is ready', kind: 'info' },
    ]);
  });
  it('reports hungry and lost units as errors', () => {
    const r = {
      ...report(),
      units: {
        spawned: 0,
        upkeepEaten: {},
        upkeepPaid: 0,
        hungry: true,
        unpaid: false,
        starving: true,
        lost: 1,
      },
    };
    expect(turnSummary(r)).toEqual([
      { text: 'Your units are hungry: each lost 2 HP', kind: 'error' },
      { text: '1 unit was lost (hunger or missing pay)', kind: 'error' },
    ]);
  });
  it('says soldiers were not paid, or hungry and not paid', () => {
    const units = {
      spawned: 0,
      upkeepEaten: {},
      upkeepPaid: 0,
      hungry: false,
      unpaid: true,
      starving: true,
      lost: 0,
    };
    expect(turnSummary({ ...report(), units })).toEqual([
      { text: 'Your soldiers were not paid: each lost 2 HP', kind: 'error' },
    ]);
    expect(turnSummary({ ...report(), units: { ...units, hungry: true } })).toEqual([
      { text: 'Your soldiers were hungry and not paid: each lost 2 HP', kind: 'error' },
    ]);
  });
  it('reports move orders after the unit lines and before captured cities', () => {
    const r = {
      ...report(),
      units: {
        spawned: 1,
        upkeepEaten: {},
        upkeepPaid: 0,
        hungry: false,
        unpaid: false,
        starving: false,
        lost: 0,
      },
      captured: [3],
      orders: [
        { unitId: 1, unitType: 'scout' as const, outcome: 'arrived' as const },
        { unitId: 2, unitType: 'spearman' as const, outcome: 'enemySpotted' as const },
        { unitId: 3, unitType: 'settler' as const, outcome: 'blocked' as const },
      ],
    };
    expect(turnSummary(r)).toEqual([
      { text: '1 unit is ready', kind: 'info' },
      { text: 'Scout arrived', kind: 'info' },
      { text: 'Spearman stopped: enemy in sight', kind: 'error' },
      { text: 'Settler stopped: the way is blocked', kind: 'error' },
      { text: 'You captured City!', kind: 'info' },
    ]);
  });
  it('reports captured cities', () => {
    expect(turnSummary({ ...report(), captured: [3] }, { cityNames: { 3: 'Argos' } })).toEqual([
      { text: 'You captured Argos!', kind: 'info' },
    ]);
    expect(turnSummary({ ...report(), captured: [3, 4] })).toEqual([
      { text: 'You captured 2 cities!', kind: 'info' },
    ]);
    // Cities are named in the lines when the names are known.
    const named = turnSummary(report(cityReport({ taxes: 3 })), { cityNames: { 1: 'Delphi' } });
    expect(named[0]?.text).toBe('Turn 5, Delphi: +3 drachmas');
  });
});
