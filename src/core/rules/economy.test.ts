import { describe, expect, it } from 'vitest';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../testing';
import { wonderConfig } from '../../data';
import { economyOverview, workerSummary } from './economy';

const rows = Array.from({ length: 5 }, () => 'ppppp');

function setup(goods = {}, residents = 4) {
  const s = makeTestState(rows, { goods });
  addCity(s, at(0, 2), { radius: 6, residents });
  return s;
}

const flow = (o: ReturnType<typeof economyOverview>, good: string) =>
  o.goods.find((g) => g.good === good);

describe('economyOverview', () => {
  it('attributes a woodcutter + sawmill chain', () => {
    const s = setup({}, 8);
    addBuilding(s, 'woodcutter', at(1, 2));
    addBuilding(s, 'woodcutter', at(2, 2));
    addBuilding(s, 'sawmill', at(3, 2));
    const o = economyOverview(s, 0);
    const wood = flow(o, 'wood')!;
    expect(wood.produced).toEqual([{ source: 'woodcutter', amount: 4, count: 2 }]);
    expect(wood.consumed).toEqual([{ source: 'building', detail: 'sawmill', amount: 2, count: 1 }]);
    expect(wood.net).toBe(2);
    expect(wood.turnsLeft).toBeNull();
    const planks = flow(o, 'planks')!;
    expect(planks.produced).toEqual([{ source: 'sawmill', amount: 2, count: 1 }]);
    expect(planks.net).toBe(2);
  });

  it('residents eat fish or bread and the turns left are counted', () => {
    const s = setup({ fish: 7 }, 8); // 8 residents eat 4 food per turn
    const fish = flow(economyOverview(s, 0), 'fish')!;
    expect(fish.consumed).toEqual([
      { source: 'residents', detail: undefined, amount: 4, count: 1 },
    ]);
    expect(fish.net).toBe(-4);
    expect(fish.turnsLeft).toBe(1);
  });

  it('unit upkeep is attributed to the units', () => {
    const s = setup({ bread: 20 }, 4);
    addUnit(s, 'spearman', at(1, 1));
    addUnit(s, 'spearman', at(2, 1));
    const bread = flow(economyOverview(s, 0), 'bread')!;
    expect(bread.consumed.find((c) => c.source === 'units')?.amount).toBe(2);
    expect(bread.consumed.find((c) => c.source === 'residents')).toBeDefined();
  });

  it('counts working, free and missing workers', () => {
    const s = setup({}, 4);
    addBuilding(s, 'farm', at(1, 2)); // 2 workers
    addBuilding(s, 'farm', at(2, 2)); // 2 workers
    addBuilding(s, 'mine', at(3, 2)); // needs 2, none left
    const w = economyOverview(s, 0).workers;
    expect(w).toMatchObject({ residents: 4, working: 4, free: 0, missing: 2 });
    expect(w.housing).toBeGreaterThan(0);
    const roomy = setup({}, 6);
    addBuilding(roomy, 'farm', at(1, 2));
    expect(economyOverview(roomy, 0).workers).toMatchObject({ working: 2, free: 4, missing: 0 });
  });

  it('does not change the real state', () => {
    const s = setup({ fish: 3 }, 6);
    addBuilding(s, 'woodcutter', at(1, 2));
    addUnit(s, 'spearman', at(1, 1));
    const before = structuredClone(s);
    economyOverview(s, 0);
    expect(s).toEqual(before);
  });

  it('skips goods without stock and flow', () => {
    const o = economyOverview(setup(), 0);
    expect(flow(o, 'ore')).toBeUndefined();
  });
});

describe('workerSummary', () => {
  it('does not count a completed wonder as missing workers', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 2), { radius: 6, residents: 0, level: 'metropolis' });
    const id = addBuilding(s, 'wonder', at(1, 2));
    const wonder = s.buildings.find((b) => b.id === id)!;
    wonder.progress = wonderConfig.buildTurns;
    expect(workerSummary(s, 0).missing).toBe(0);
  });
});

describe('economyOverview priority flags', () => {
  it('reports lowPriority and canPrioritize per good', () => {
    const s = setup({ drachmas: 3 }, 8);
    addBuilding(s, 'woodcutter', at(1, 2));
    s.players[0].lowPriorityGoods = ['wood'];
    const o = economyOverview(s, 0);
    expect(flow(o, 'wood')).toMatchObject({ lowPriority: true, canPrioritize: true });
    expect(flow(o, 'drachmas')).toMatchObject({ lowPriority: false, canPrioritize: false });
  });
});

describe('economyOverview low priority row', () => {
  it('keeps the row of a low-priority good even without stock or flows', () => {
    const s = setup({}, 1);
    addBuilding(s, 'woodcutter', at(1, 2));
    addBuilding(s, 'quarry', at(2, 2));
    s.players[0].lowPriorityGoods = ['wood'];
    const wood = flow(economyOverview(s, 0), 'wood');
    expect(wood).toMatchObject({ lowPriority: true, canPrioritize: true, stock: 0, net: 0 });
  });
});
