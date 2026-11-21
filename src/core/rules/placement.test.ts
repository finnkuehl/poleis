import { describe, expect, it } from 'vitest';
import { at, addBuilding, addCity, addRoad, makeTestState } from '../testing';
import { checkPlacement, validPlacements } from './placement';

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
  it('woodcutter: next to forest ok, on forest wrong, without forest needs neighbor', () => {
    const s = makeTestState(['pfp', 'ppp', 'ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'woodcutter', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'woodcutter', at(1, 0))?.code).toBe('wrongTerrain');
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
  it('quarry on hills and on plains next to mountains', () => {
    const s = makeTestState(['hpm', 'ppp', 'ppp'], { goods: rich });
    expect(checkPlacement(s, 0, 'quarry', at(0, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'quarry', at(1, 0))).toBeNull();
    expect(checkPlacement(s, 0, 'quarry', at(1, 2))).toEqual({
      code: 'needsNeighbor',
      terrains: ['mountains'],
    });
    expect(checkPlacement(s, 0, 'quarry', at(2, 0))?.code).toBe('wrongTerrain');
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
