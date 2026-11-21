import { describe, expect, it } from 'vitest';
import { at, makeTestState } from '../testing';
import { claimTerritory, ownerAt } from './territory';

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
