import { describe, expect, it } from 'vitest';
import { at, addBuilding, addCity, addRoad, makeTestState } from '../testing';
import { checkPlacement, towerTotals, towerUsage, validPlacements } from './placement';

const rich = { wood: 50, stone: 50, planks: 50 };

describe('placement', () => {
  it('outOfBounds', () => {
    const s = makeTestState(['ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'house', at(5, 0))?.code).toBe('outOfBounds');
  });
  it('cannotBuildType (city center)', () => {
    const s = makeTestState(['ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'cityCenter', at(1, 0))?.code).toBe('cannotBuildType');
  });
  it('notOwnTerritory', () => {
    const s = makeTestState(['ppp'], { goods: rich, ownAll: false });
    expect(checkPlacement(s, 0, 'house', at(1, 0))?.code).toBe('notOwnTerritory');
  });
  it('tileOccupied by building or road', () => {
    const s = makeTestState(['ppp'], { goods: rich });
    addBuilding(s, 'house', at(0, 0));
    addRoad(s, at(1, 0));
    expect(checkPlacement(s, 0, 'house', at(0, 0))?.code).toBe('tileOccupied');
    expect(checkPlacement(s, 0, 'house', at(1, 0))?.code).toBe('tileOccupied');
    expect(checkPlacement(s, 0, 'house', at(2, 0))).toBeNull();
  });
  it('woodcutter: on forest ok, next to forest ok, without forest needs neighbor', () => {
    const s = makeTestState(['pfp', 'ppp', 'ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'woodcutter', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'woodcutter', at(1, 0))).toBeNull();
    const far = checkPlacement(s, 0, 'woodcutter', at(2, 2));
    expect(far).toEqual({ code: 'needsNeighbor', terrains: ['forest'] });
  });
  it('wrongTerrain lists allowed terrains', () => {
    const s = makeTestState(['pf'], { goods: rich });
    expect(checkPlacement(s, 0, 'house', at(1, 0))).toEqual({
      code: 'wrongTerrain',
      terrains: ['plains'],
    });
  });
  it('quarry on hills, on mountains and on plains next to hills/mountains', () => {
    const s = makeTestState(['hpm', 'ppp', 'ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'quarry', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'quarry', at(1, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'quarry', at(2, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'quarry', at(1, 2))).toEqual({
      code: 'needsNeighbor',
      terrains: ['hills', 'mountains'],
    });
  });
  it('mine only on mountains', () => {
    const s = makeTestState(['hpm'], { goods: rich });
    expect(checkPlacement(s, 0, 'mine', at(2, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'mine', at(0, 0))).toEqual({
      code: 'wrongTerrain',
      terrains: ['mountains'],
    });
  });
  it('fishery next to coast', () => {
    const s = makeTestState(['pcp', 'ppp', 'ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'fishery', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'fishery', at(2, 2))?.code).toBe('needsNeighbor');
  });
  it('notAffordable with exact missing, and ignoreCost', () => {
    const s = makeTestState(['ppp'], { goods: { wood: 1, stone: 2 } });
    expect(checkPlacement(s, 0, 'storehouse', at(0, 0))).toEqual({
      code: 'notAffordable',
      missing: { wood: 3 },
    });
    expect(checkPlacement(s, 0, 'storehouse', at(0, 0), { ignoreCost: true })).toBeNull();
  });
  it('validPlacements lists all valid tiles', () => {
    const s = makeTestState(['pfp'], { goods: rich });
    const valid = validPlacements(s, 0, 'house');
    expect(valid).toHaveLength(2);
  });
});

describe('level-gated placement', () => {
  it('vineyard in a settlement: levelTooLow; in a polis: hills ok, plains wrong', () => {
    const s = makeTestState(['hpp', 'ppp'], { goods: rich, ownAll: false });
    addCity(s, at(1, 1), { radius: 3 });
    expect(checkPlacement(s, 0, 'vineyard', at(0, 0))).toEqual({
      code: 'levelTooLow',
      level: 'polis',
    });
    s.cities[0].level = 'polis';
    expect(checkPlacement(s, 0, 'vineyard', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'vineyard', at(1, 0))?.code).toBe('wrongTerrain');
    expect(validPlacements(s, 0, 'vineyard')).toEqual([at(0, 0)]);
  });
  it('outside any city the territory error wins', () => {
    const s = makeTestState(['hpp', 'ppp'], { goods: rich, ownAll: false });
    addCity(s, at(0, 1), { radius: 1 });
    expect(checkPlacement(s, 0, 'temple', at(0, 0))?.code).toBe('levelTooLow');
    expect(checkPlacement(s, 0, 'temple', at(2, 0))?.code).toBe('notOwnTerritory');
  });
});

describe('watchtower limit per city', () => {
  const row = ['ppppppppp'];
  const code = (s: ReturnType<typeof makeTestState>, x: number) =>
    checkPlacement(s, 0, 'borderTower', at(x, 0))?.code ?? null;

  it('a settlement may have 1 watchtower', () => {
    const s = makeTestState(row, { goods: rich });
    const city = addCity(s, at(0, 0), { radius: 8 });
    expect(code(s, 3)).toBeNull();
    addBuilding(s, 'borderTower', at(3, 0));
    s.tileCity.fill(city);
    expect(code(s, 4)).toBe('towerLimit');
    expect(checkPlacement(s, 0, 'borderTower', at(4, 0))?.max).toBe(1);
    expect(towerUsage(s, 0, city)).toEqual({ used: 1, max: 1 });
  });

  it('a polis may have 3 and a metropolis 6', () => {
    const s = makeTestState(row, { goods: rich });
    const city = addCity(s, at(0, 0), { radius: 8, level: 'polis' });
    s.tileCity.fill(city);
    for (const x of [2, 3, 4]) {
      expect(code(s, x)).toBeNull();
      addBuilding(s, 'borderTower', at(x, 0));
    }
    expect(code(s, 5)).toBe('towerLimit');
    s.cities[0].level = 'metropolis';
    expect(towerUsage(s, 0, city).max).toBe(6);
    expect(code(s, 5)).toBeNull();
  });

  it('towers of other cities do not count', () => {
    const s = makeTestState(row, { goods: rich });
    const a = addCity(s, at(0, 0), { radius: 3 });
    const b = addCity(s, at(8, 0), { radius: 3 });
    addBuilding(s, 'borderTower', at(2, 0));
    expect(s.tileCity[2]).toBe(a);
    expect(code(s, 1)).toBe('towerLimit');
    expect(code(s, 6)).toBeNull();
    expect(towerTotals(s, 0)).toEqual({ used: 1, max: 2, hasRoom: true });
    void b;
  });

  it('a captured city over its limit keeps its towers but cannot build more', () => {
    const s = makeTestState(row, { goods: rich });
    const city = addCity(s, at(0, 0), { radius: 8 });
    s.tileCity.fill(city);
    for (const x of [2, 3, 4]) addBuilding(s, 'borderTower', at(x, 0));
    expect(towerUsage(s, 0, city)).toEqual({ used: 3, max: 1 });
    expect(code(s, 5)).toBe('towerLimit');
    expect(s.buildings.filter((b) => b.type === 'borderTower')).toHaveLength(3);
  });
});
