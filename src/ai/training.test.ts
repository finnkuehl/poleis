import { describe, expect, it } from 'vitest';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../core/testing';
import { buildContext } from './context';
import { trainingCandidates } from './training';

/** An AI (player 0 in the test state) with a city, a barracks and plenty of goods. */
function context(units: number, drachmaIncome: number) {
  const s = makeTestState(['ppppppp', 'ppppppp', 'ppppppp'], {
    goods: { planks: 50, bronze: 50, stone: 50, grain: 50, fish: 50, drachmas: 10 },
  });
  s.turn = 60;
  addCity(s, at(3, 1), { residents: 4 });
  addBuilding(s, 'barracks', at(2, 1));
  for (let i = 0; i < units; i++) addUnit(s, 'spearman', at(i, 0));
  const ctx = buildContext(s, 0);
  // Isolate the money rule: plenty of food, a chosen drachma income per turn.
  ctx.foodProd = 99;
  ctx.drachmaIncome = drachmaIncome;
  return ctx;
}

const trains = (ctx: ReturnType<typeof context>) =>
  trainingCandidates(ctx).filter((c) => c.action?.type === 'train');

describe('AI trains within its money', () => {
  it('trains a unit when the income stays at the margin after its pay', () => {
    // Builder margin is 0: income 1 - pay 1 = 0 is enough.
    expect(trains(context(0, 1)).length).toBeGreaterThan(0);
  });

  it('does not train when the income would drop below the margin', () => {
    expect(trains(context(0, 0))).toEqual([]);
    // The pay of units already in the field is subtracted from the income.
    expect(trains(context(3, 3))).toEqual([]);
  });

  it('sees a hidden deficit: 2 income, 6 units, no drachmas in stock', () => {
    const ctx = context(6, 2);
    ctx.personality = 'warrior';
    ctx.stock.drachmas = 0;
    // Real income 2 - 6 = -4; even the warrior's margin (-1) is far away.
    expect(trains(ctx)).toEqual([]);
  });
});
