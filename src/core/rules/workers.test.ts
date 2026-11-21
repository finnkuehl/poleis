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
  it('each city staffs its own buildings', () => {
    const s = makeTestState(['ppppppppppppp']);
    const a = addCity(s, at(0, 0), { radius: 2, residents: 1 });
    const b = addCity(s, at(10, 0), { radius: 2, residents: 4 });
    const wcA = addBuilding(s, 'woodcutter', at(1, 0));
    const farmB = addBuilding(s, 'farm', at(9, 0));
    const outside = addBuilding(s, 'woodcutter', at(5, 0));
    addRoad(s, at(2, 0));
    addRoad(s, at(3, 0));
    addRoad(s, at(4, 0));
    addRoad(s, at(6, 0));
    addRoad(s, at(7, 0));
    addRoad(s, at(8, 0));
    expect(a).not.toBe(b);
    const w = assignWorkers(s, 0, connectedBuildingIds(s, 0));
    expect(w[wcA]).toBe(1);
    expect(w[farmB]).toBe(2);
    expect(w[outside]).toBeUndefined();
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
