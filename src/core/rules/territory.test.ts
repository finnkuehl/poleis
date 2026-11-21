import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { tileIndex } from '../map';
import { addCity, at, makeTestState } from '../testing';
import { claimTerritory, ownerAt, territoryGain } from './territory';

const rows = Array.from({ length: 9 }, () => 'ppppppppp');

describe('territory', () => {
  it('radius 2 in the middle claims 19 tiles', () => {
    const s = makeTestState(rows, { ownAll: false });
    claimTerritory(s, at(4, 4), 2, 0);
    expect(s.territory.filter((o) => o === 0)).toHaveLength(19);
    expect(ownerAt(s, at(4, 4))).toBe(0);
    expect(ownerAt(s, at(0, 0))).toBe(-1);
    expect(ownerAt(s, at(-5, 0))).toBe(-1);
  });
  it('first claim wins', () => {
    const s = makeTestState(rows, { ownAll: false });
    claimTerritory(s, at(4, 4), 2, 0);
    claimTerritory(s, at(4, 4), 3, 1);
    expect(ownerAt(s, at(4, 4))).toBe(0);
    expect(s.territory.filter((o) => o === 0)).toHaveLength(19);
    expect(s.territory.filter((o) => o === 1)).toHaveLength(37 - 19);
  });
  it('ignores tiles outside the map', () => {
    const s = makeTestState(rows, { ownAll: false });
    claimTerritory(s, at(0, 0), 2, 0);
    expect(s.territory.filter((o) => o === 0).length).toBeLessThan(19);
  });
});

describe('border tower', () => {
  function towerSetup() {
    const s = makeTestState(rows, { goods: { wood: 10, stone: 10 }, ownAll: false });
    addCity(s, at(3, 3), { radius: 1 });
    return s;
  }

  it('claims unclaimed tiles of radius 2 for the tower city, never foreign ones', () => {
    const s = towerSetup();
    // A tile of another owner within reach of the tower.
    s.territory[tileIndex(s.map, at(5, 4))] = 1;
    const tower = at(4, 3);
    const gain = territoryGain(s, tower, 2);
    const before = s.territory.filter((o) => o === 0).length;
    const r = applyAction(s, { type: 'build', building: 'borderTower', hex: tower });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.state;
    expect(gain.length).toBeGreaterThan(0);
    expect(t.territory.filter((o) => o === 0)).toHaveLength(before + gain.length);
    for (const h of gain) {
      expect(ownerAt(t, h)).toBe(0);
      expect(t.tileCity[tileIndex(t.map, h)]).toBe(t.cities[0].id);
    }
    expect(ownerAt(t, at(5, 4))).toBe(1);
    expect(t.tileCity[tileIndex(t.map, at(5, 4))]).toBe(-1);
    expect(territoryGain(t, tower, 2)).toEqual([]);
  });

  it('territoryGain is smaller at the map edge and next to foreign land', () => {
    const s = makeTestState(rows, { ownAll: false });
    const open = territoryGain(s, at(4, 4), 2).length;
    expect(open).toBe(19);
    expect(territoryGain(s, at(0, 0), 2).length).toBeLessThan(open);
    s.territory[tileIndex(s.map, at(4, 5))] = 1;
    expect(territoryGain(s, at(4, 4), 2)).toHaveLength(open - 1);
  });
});
