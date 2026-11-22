import { describe, expect, it } from 'vitest';
import { at, addBuilding, addCity, addRoad, makeTestState } from '../testing';
import { connectedBuildingIds } from './connection';
import { assignWorkers, housing, population } from './workers';

const rows = Array.from({ length: 5 }, () => 'ppppp');

/** City center at (0,2), a row of buildings next to each other leading away from it. */
function setup() {
  const s = makeTestState(rows);
  addCity(s, at(0, 2), { radius: 6 });
  return s;
}

/** Two cities on a row of plains, joined by a road; the given residents live in A and B. */
function twoCities(residentsA: number, residentsB: number) {
  const s = makeTestState(['ppppppppppppp']);
  addCity(s, at(0, 0), { radius: 2, residents: residentsA });
  addCity(s, at(10, 0), { radius: 2, residents: residentsB });
  for (const x of [3, 4, 5, 6, 7, 8]) addRoad(s, at(x, 0));
  return s;
}

describe('workers', () => {
  it('population sums residents, housing sums the housing of the city', () => {
    const s = setup();
    addBuilding(s, 'house', at(1, 2));
    addBuilding(s, 'farm', at(2, 2));
    expect(population(s, 0)).toBe(4);
    expect(housing(s, s.cities[0].id)).toBe(10);
  });
  it('residents below housing: only the residents work', () => {
    const s = setup();
    s.cities[0].residents = 2;
    addBuilding(s, 'house', at(1, 2));
    const farm = addBuilding(s, 'farm', at(2, 2));
    const wc = addBuilding(s, 'woodcutter', at(3, 2));
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[farm], w[wc]]).toEqual([2, 0]);
  });
  it('residents of one city staff a building in another city', () => {
    const s = twoCities(0, 4); // nobody lives in city A
    const farmA = addBuilding(s, 'farm', at(1, 0));
    const wcB = addBuilding(s, 'woodcutter', at(9, 0));
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[farmA], w[wcB]]).toEqual([2, 1]);
  });
  it('orders by category, then id, across cities', () => {
    const s = twoCities(1, 2); // 3 residents in total
    const wcA = addBuilding(s, 'woodcutter', at(1, 0)); // raw, 1, city A, oldest
    const farmB = addBuilding(s, 'farm', at(9, 0)); // food, 2, city B
    const wcB = addBuilding(s, 'woodcutter', at(11, 0)); // raw, 1, city B
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[farmB], w[wcA], w[wcB]]).toEqual([2, 1, 0]);
  });
  it('skips a crew that does not fit across cities and tries the next', () => {
    const s = twoCities(1, 2); // 3 residents in total
    const mineA = addBuilding(s, 'mine', at(1, 0)); // raw, 2
    const mineB = addBuilding(s, 'mine', at(9, 0)); // raw, 2 -> no 2 left
    const wcB = addBuilding(s, 'woodcutter', at(11, 0)); // raw, 1 -> still staffed
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[mineA], w[mineB], w[wcB]]).toEqual([2, 0, 1]);
  });
  it('a paused building gets no workers; they go to the next building', () => {
    const s = setup();
    const farm = addBuilding(s, 'farm', at(1, 2));
    const farm2 = addBuilding(s, 'farm', at(2, 2));
    const farm3 = addBuilding(s, 'farm', at(3, 2));
    s.buildings.find((b) => b.id === farm)!.paused = true;
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect(w[farm]).toBeUndefined();
    expect([w[farm2], w[farm3]]).toEqual([2, 2]);
  });
  it('food before raw before processing, regardless of age', () => {
    const s = setup(); // 4 residents
    const sawmill = addBuilding(s, 'sawmill', at(1, 2)); // processing, 1
    const woodcutter = addBuilding(s, 'woodcutter', at(2, 2)); // raw, 1
    const farm = addBuilding(s, 'farm', at(3, 2)); // food, 2
    const mine = addBuilding(s, 'mine', at(4, 2)); // raw, 2
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect(w[farm]).toBe(2);
    expect(w[woodcutter]).toBe(1);
    expect(w[mine]).toBe(0); // only 1 of 2 left: no partial crew
    expect(w[sawmill]).toBe(1); // smaller crew later in order still gets staffed
  });
  it('skips a building whose crew does not fit and continues', () => {
    const s = setup(); // 4 residents
    addBuilding(s, 'farm', at(1, 2)); // food, 2 -> 2 left
    addBuilding(s, 'woodcutter', at(2, 2)); // raw, 1 -> 1 left
    const mine = addBuilding(s, 'mine', at(3, 2)); // raw, 2 -> does not fit
    const late = addBuilding(s, 'woodcutter', at(4, 2)); // raw, 1 (newer) -> still staffed
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[mine], w[late]]).toEqual([0, 1]);
  });
  it('staffs a crew when exactly enough residents remain', () => {
    const s = setup(); // 4 residents
    const farm = addBuilding(s, 'farm', at(1, 2)); // 2
    const mine = addBuilding(s, 'mine', at(2, 2)); // 2
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[farm], w[mine]]).toEqual([2, 2]);
  });
  it('older buildings first within a category', () => {
    const s = setup();
    const a = addBuilding(s, 'farm', at(1, 2));
    const b = addBuilding(s, 'farm', at(2, 2));
    const c = addBuilding(s, 'farm', at(3, 2));
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[a], w[b], w[c]]).toEqual([2, 2, 0]);
  });
  it('only connected buildings get workers', () => {
    const s = setup();
    const lonely = addBuilding(s, 'farm', at(4, 4));
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect(w[lonely]).toBeUndefined();
  });
});

describe('city buildings and workers', () => {
  it('a marketplace gets a worker only after the producers', () => {
    const s = setup();
    s.cities[0].residents = 2;
    const market = addBuilding(s, 'marketplace', at(1, 2));
    const wc = addBuilding(s, 'woodcutter', at(2, 2));
    const farm = addBuilding(s, 'farm', at(3, 2));
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[farm], w[wc], w[market]]).toEqual([2, 0, 0]);
    s.cities[0].residents = 3;
    const w2 = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w2[farm], w2[wc], w2[market]]).toEqual([2, 1, 0]);
    s.cities[0].residents = 4;
    const w3 = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w3[farm], w3[wc], w3[market]]).toEqual([2, 1, 1]);
  });
});

describe('low priority goods', () => {
  const crews = (s: ReturnType<typeof setup>) => assignWorkers(s, 0, connectedBuildingIds(s, 0));

  it('a low-priority woodcutter is staffed after a quarry when residents are short', () => {
    const s = setup();
    s.cities[0].residents = 1;
    const wc = addBuilding(s, 'woodcutter', at(1, 2));
    const quarry = addBuilding(s, 'quarry', at(2, 2));
    expect([crews(s)[wc], crews(s)[quarry]]).toEqual([1, 0]);
    s.players[0].lowPriorityGoods = ['wood'];
    expect([crews(s)[wc], crews(s)[quarry]]).toEqual([0, 1]);
  });
  it('with enough residents both get crews', () => {
    const s = setup();
    s.cities[0].residents = 2;
    s.players[0].lowPriorityGoods = ['wood'];
    const wc = addBuilding(s, 'woodcutter', at(1, 2));
    const quarry = addBuilding(s, 'quarry', at(2, 2));
    expect([crews(s)[wc], crews(s)[quarry]]).toEqual([1, 1]);
  });
  it('a building built later follows the setting', () => {
    const s = setup();
    s.cities[0].residents = 1;
    s.players[0].lowPriorityGoods = ['wood'];
    const quarry = addBuilding(s, 'quarry', at(1, 2));
    const wc = addBuilding(s, 'woodcutter', at(2, 2));
    expect([crews(s)[wc], crews(s)[quarry]]).toEqual([0, 1]);
  });
  it('works across cities: the second pass comes after all cities', () => {
    const s = twoCities(1, 1);
    s.players[0].lowPriorityGoods = ['wood'];
    const wcA = addBuilding(s, 'woodcutter', at(1, 0)); // low priority, oldest
    const quarryB = addBuilding(s, 'quarry', at(9, 0));
    const wcB = addBuilding(s, 'woodcutter', at(11, 0)); // low priority
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect([w[wcA], w[quarryB], w[wcB]]).toEqual([1, 1, 0]);
  });
});
