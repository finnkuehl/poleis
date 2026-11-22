import { describe, expect, it } from 'vitest';
import { populationConfig, type CityLevel, type Goods } from '../../data';
import { addBuilding, addCity, at, makeTestState } from '../testing';
import { cityStats, runPopulation } from './population';

const rows = ['ppppppp', 'ppppppp', 'ppppppp'];

/** A city at (1,1) with `houses` extra houses (+6 housing each). */
function setup(
  opts: { goods?: Goods; residents?: number; level?: CityLevel; houses?: number } = {},
) {
  const s = makeTestState(rows, { goods: opts.goods });
  const id = addCity(s, at(1, 1), { residents: opts.residents, level: opts.level, radius: 5 });
  for (let i = 0; i < (opts.houses ?? 0); i++) addBuilding(s, 'house', at(2 + i, 1));
  return { s, id, city: s.cities[0], goods: s.players[0].goods };
}

describe('food', () => {
  it('eats fish before grain', () => {
    const { s, goods } = setup({ goods: { fish: 1, grain: 5 }, residents: 4 });
    const [r] = runPopulation(s, 0);
    expect(goods.fish).toBe(0);
    expect(goods.grain).toBe(4);
    expect(r.foodNeeded).toBe(2);
    expect(r.foodEaten).toEqual({ fish: 1, grain: 1 });
    expect(r.fed).toBe(true);
  });
  it('grain alone feeds residents', () => {
    const { s, goods } = setup({ goods: { grain: 3 }, residents: 4 });
    const [r] = runPopulation(s, 0);
    expect(goods.grain).toBe(1);
    expect(r.foodEaten).toEqual({ grain: 2 });
    expect(r.fed).toBe(true);
  });
  it('rounds the food need up', () => {
    const { s, goods } = setup({ goods: { fish: 5 }, residents: 5, houses: 1 });
    runPopulation(s, 0);
    expect(goods.fish).toBe(2);
  });
  it('hunger: eats what is there and loses 1 resident', () => {
    const { s, city, goods } = setup({ goods: { fish: 1 }, residents: 4 });
    const [r] = runPopulation(s, 0);
    expect(goods.fish).toBe(0);
    expect(r.fed).toBe(false);
    expect(city.residents).toBe(3);
    expect(r.residentsBefore).toBe(4);
    expect(r.residentsAfter).toBe(3);
  });
  it('never drops below 1 resident', () => {
    const { s, city } = setup({ residents: 1 });
    runPopulation(s, 0);
    expect(city.residents).toBe(populationConfig.minResidents);
  });
});

describe('growth', () => {
  it('+1 per turn up to the housing cap', () => {
    const { s, city } = setup({ goods: { fish: 20 }, residents: 4, houses: 1 });
    runPopulation(s, 0);
    expect(city.residents).toBe(5);
    city.residents = 10;
    runPopulation(s, 0);
    expect(city.residents).toBe(10);
  });
  it('a polis grows +2 (with its oil) but not beyond the housing', () => {
    const { s, city } = setup({
      goods: { fish: 20, oil: 5 },
      residents: 4,
      houses: 1,
      level: 'polis',
    });
    runPopulation(s, 0);
    expect(city.residents).toBe(6);
    city.residents = 9;
    runPopulation(s, 0);
    expect(city.residents).toBe(10);
  });
  it('no growth without food', () => {
    const { s, city } = setup({ residents: 2, houses: 1 });
    runPopulation(s, 0);
    expect(city.residents).toBe(1);
  });
  it('residents above housing move out', () => {
    const { s, city } = setup({ goods: { fish: 20 }, residents: 8 });
    runPopulation(s, 0);
    expect(city.residents).toBe(4);
  });
});

describe('taxes', () => {
  it('rounds down: 5 residents without the bonus -> 2 drachmas', () => {
    // No food: 6 -> 5 residents (hunger), so no bonus: floor(5 / 2) = 2.
    const { s, goods } = setup({ residents: 6, houses: 1 });
    runPopulation(s, 0);
    expect(goods.drachmas).toBe(2);
  });
  it('5 residents with the bonus -> 3 drachmas (2 * 1.5)', () => {
    // Fed: 4 -> 5 residents (cap 8), needs of a settlement (food only) are met.
    const { s, goods } = setup({ goods: { fish: 10 }, residents: 4, houses: 1 });
    const [r] = runPopulation(s, 0);
    expect(r.residentsAfter).toBe(5);
    expect(r.needsMet).toBe(true);
    expect(goods.drachmas).toBe(3);
  });
  it('bonus is rounded down: 6 residents in a polis -> 3 * 1.5 = 4', () => {
    const { s, goods } = setup({ goods: { fish: 10, oil: 5 }, level: 'polis', houses: 1 });
    const [r] = runPopulation(s, 0);
    expect(r.residentsAfter).toBe(6);
    expect(goods.drachmas).toBe(4);
  });
});

describe('needs', () => {
  it('a settlement never touches oil, even when it is in stock', () => {
    const { s, goods } = setup({ goods: { fish: 10, oil: 3, wine: 2 }, residents: 12, houses: 2 });
    const [r] = runPopulation(s, 0);
    expect(goods.oil).toBe(3);
    expect(goods.wine).toBe(2);
    expect(r.needsConsumed).toEqual({});
    expect(r.needsMet).toBe(true); // a settlement only needs food
  });
  it('a polis uses 1 oil per 10 residents (rounded up) and no wine', () => {
    const { s, goods } = setup({
      goods: { fish: 10, oil: 5, wine: 3 },
      level: 'polis',
      residents: 12,
      houses: 2,
    });
    const [r] = runPopulation(s, 0);
    expect(goods.oil).toBe(3); // ceil(12 / 10) = 2
    expect(goods.wine).toBe(3);
    expect(r.needsConsumed).toEqual({ oil: 2 });
  });
  it('polis: with oil needsMet, without oil only the bonuses are lost', () => {
    const a = setup({ goods: { fish: 5, oil: 2 }, level: 'polis' });
    const ra = runPopulation(a.s, 0)[0];
    expect(ra.needsMet).toBe(true);
    expect(ra.needsConsumed).toEqual({ oil: 1 });
    expect(a.goods.oil).toBe(1);
    const b = setup({ goods: { fish: 5 }, level: 'polis' });
    const rb = runPopulation(b.s, 0)[0];
    expect(rb.needsMet).toBe(false);
    expect(b.city.level).toBe('polis');
    expect(rb.taxes).toBe(Math.floor(rb.residentsAfter / 2));
  });
  it('+1 growth when the needs are met on a level with needs', () => {
    const base = populationConfig.growthPerTurn.polis;
    const bonus = populationConfig.growthBonusNeedsMet;
    expect(bonus).toBeGreaterThan(0);
    const met = setup({ goods: { fish: 5, oil: 2 }, level: 'polis', residents: 4, houses: 2 });
    runPopulation(met.s, 0);
    expect(met.city.residents).toBe(4 + base + bonus);
    // Needs not met: base growth only, no shrinking.
    const unmet = setup({ goods: { fish: 5 }, level: 'polis', residents: 4, houses: 2 });
    runPopulation(unmet.s, 0);
    expect(unmet.city.residents).toBe(4 + base);
  });
  it('a settlement gets no growth bonus', () => {
    const { s, city } = setup({ goods: { fish: 5, oil: 2 }, residents: 4, houses: 2 });
    runPopulation(s, 0);
    expect(city.residents).toBe(4 + populationConfig.growthPerTurn.settlement);
  });
  it('metropolis needs both oil and wine', () => {
    const a = setup({ goods: { fish: 5, oil: 1 }, level: 'metropolis' });
    const ra = runPopulation(a.s, 0)[0];
    expect(ra.needsMet).toBe(false);
    expect(ra.needsConsumed).toEqual({ oil: 1 }); // covered needs are still consumed
    const b = setup({ goods: { fish: 5, oil: 1, wine: 1 }, level: 'metropolis' });
    expect(runPopulation(b.s, 0)[0].needsMet).toBe(true);
  });
  it('a city without food has needsMet false even with oil', () => {
    const { s } = setup({ goods: { oil: 2 }, level: 'polis' });
    expect(runPopulation(s, 0)[0].needsMet).toBe(false);
  });
});

describe('cityStats', () => {
  it('reports the numbers for the UI', () => {
    const { s, id } = setup({ goods: { fish: 2, oil: 1 }, residents: 4, houses: 1 });
    const stats = cityStats(s, id);
    expect(stats.residents).toBe(4);
    expect(stats.housing).toBe(10);
    expect(stats.foodPerTurn).toBe(2);
    expect(stats.needs).toEqual([]);
    // No oil production: makes 0 / needs ceil(4 / 10) = 1 for the Polis.
    expect(stats.supply).toEqual({ good: 'oil', made: 0, needed: 1, ok: false });
    expect(stats.growthPerTurn).toBe(populationConfig.growthPerTurn.settlement);
    expect(stats.taxPerTurn).toBe(3); // 2 * 1.5, food and needs in stock
  });
  it('tax without bonus if food is missing; no supply at max level', () => {
    const { s, id } = setup({ level: 'metropolis', residents: 4 });
    const stats = cityStats(s, id);
    expect(stats.supply).toBeNull();
    expect(stats.needs.map((n) => [n.good, n.amount, n.inStock])).toEqual([
      ['oil', 1, false],
      ['wine', 1, false],
    ]);
    expect(stats.taxPerTurn).toBe(2);
  });
});
