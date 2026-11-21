import { describe, expect, it } from 'vitest';
import { neighbors } from '../hex';
import { at, addBuilding, addRoad, makeTestState } from '../testing';
import { connectedBuildingIds } from './connection';

const rows = Array.from({ length: 7 }, () => 'ppppppp');

describe('connection', () => {
  it('storage itself is connected', () => {
    const s = makeTestState(rows);
    const c = addBuilding(s, 'cityCenter', at(3, 3));
    expect([...connectedBuildingIds(s, 0)]).toEqual([c]);
  });
  it('neighbor building is connected, distant one is not', () => {
    const s = makeTestState(rows);
    addBuilding(s, 'cityCenter', at(3, 3));
    const near = addBuilding(s, 'farm', neighbors(at(3, 3))[0]);
    const far = addBuilding(s, 'farm', at(0, 0));
    const ids = connectedBuildingIds(s, 0);
    expect(ids.has(near)).toBe(true);
    expect(ids.has(far)).toBe(false);
  });
  it('connected via a road chain', () => {
    const s = makeTestState(rows);
    addBuilding(s, 'cityCenter', at(0, 3));
    for (const col of [1, 2, 3]) addRoad(s, at(col, 3));
    const farm = addBuilding(s, 'farm', at(4, 3));
    expect(connectedBuildingIds(s, 0).has(farm)).toBe(true);
  });
  it('connected via a chain of adjacent buildings', () => {
    const s = makeTestState(rows);
    addBuilding(s, 'cityCenter', at(0, 3));
    addBuilding(s, 'house', at(1, 3));
    addBuilding(s, 'house', at(2, 3));
    const farm = addBuilding(s, 'farm', at(3, 3));
    expect(connectedBuildingIds(s, 0).has(farm)).toBe(true);
  });
  it('a gap breaks the connection; a storehouse is a new start', () => {
    const s = makeTestState(rows);
    addBuilding(s, 'cityCenter', at(0, 3));
    addRoad(s, at(1, 3));
    const farm = addBuilding(s, 'farm', at(4, 3));
    expect(connectedBuildingIds(s, 0).has(farm)).toBe(false);
    addBuilding(s, 'storehouse', at(5, 3));
    expect(connectedBuildingIds(s, 0).has(farm)).toBe(true);
  });
  it('a road outside the own territory does not connect', () => {
    const s = makeTestState(rows);
    addBuilding(s, 'cityCenter', at(0, 3));
    for (const col of [1, 2, 3]) addRoad(s, at(col, 3));
    s.territory[3 * 7 + 2] = -1;
    const farm = addBuilding(s, 'farm', at(4, 3));
    expect(connectedBuildingIds(s, 0).has(farm)).toBe(false);
  });
});
