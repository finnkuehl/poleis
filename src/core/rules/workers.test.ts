import { describe, expect, it } from 'vitest';
import { at, addBuilding, makeTestState } from '../testing';
import { connectedBuildingIds } from './connection';
import { assignWorkers, population } from './workers';

const rows = Array.from({ length: 5 }, () => 'ppppp');

/** City center at (0,2), a row of buildings next to each other leading away from it. */
function setup() {
  const s = makeTestState(rows);
  addBuilding(s, 'cityCenter', at(0, 2));
  return s;
}

describe('workers', () => {
  it('population sums housing', () => {
    const s = setup();
    addBuilding(s, 'house', at(1, 2));
    addBuilding(s, 'farm', at(2, 2));
    expect(population(s, 0)).toBe(8);
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
