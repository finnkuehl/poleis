import { describe, expect, it } from 'vitest';
import { HEX_DIRECTIONS, hexAdd, hexToPixel } from '../core/hex';
import { tileIndex } from '../core/map';
import type { GameState } from '../core/state';
import { at, makeTestState } from '../core/testing';
import { EDGE_DIRECTION, edgeMidpoint, roadGeometry, territoryEdges } from './geometry';

describe('EDGE_DIRECTION', () => {
  it('each edge faces the neighbor it is mapped to', () => {
    const size = 32;
    const c = hexToPixel({ q: 0, r: 0 }, size);
    for (let e = 0; e < 6; e++) {
      const nb = hexToPixel(HEX_DIRECTIONS[EDGE_DIRECTION[e]], size);
      const mid = edgeMidpoint(c, size, e);
      // Edge midpoint lies exactly halfway to the neighbor center
      expect(mid.x).toBeCloseTo(nb.x / 2);
      expect(mid.y).toBeCloseTo(nb.y / 2);
    }
  });
});

function emptyState(): GameState {
  const s = makeTestState(Array(12).fill('pppppppppppp'));
  s.roads = s.roads.map(() => false);
  s.territory = s.territory.map(() => -1);
  s.buildings = [];
  return s;
}

describe('territoryEdges', () => {
  it('a single tile has all 6 edges', () => {
    const s = emptyState();
    const h = at(4, 3);
    s.territory[tileIndex(s.map, h)] = 0;
    const edges = territoryEdges(s, 0);
    expect(edges).toHaveLength(1);
    expect(edges[0].edges).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('shared edges between two tiles of the same owner are skipped', () => {
    const s = emptyState();
    const a = at(4, 3);
    const b = hexAdd(a, HEX_DIRECTIONS[0]); // east of a
    s.territory[tileIndex(s.map, a)] = 0;
    s.territory[tileIndex(s.map, b)] = 0;
    const edges = territoryEdges(s, 0);
    const ea = edges.find((t) => t.tile === tileIndex(s.map, a));
    const eb = edges.find((t) => t.tile === tileIndex(s.map, b));
    expect(ea?.edges).toEqual([1, 2, 3, 4, 5]); // edge 0 (east) is missing
    expect(eb?.edges).toEqual([0, 1, 2, 4, 5]); // edge 3 (west) is missing
  });

  it('draws an edge next to another owner', () => {
    const s = emptyState();
    const a = at(4, 3);
    s.territory[tileIndex(s.map, a)] = 0;
    s.territory[tileIndex(s.map, hexAdd(a, HEX_DIRECTIONS[0]))] = 1;
    expect(territoryEdges(s, 0)[0].edges).toContain(0);
    expect(territoryEdges(s, 2)).toEqual([]);
  });
});

describe('roadGeometry', () => {
  it('connects adjacent road tiles once and gives lone roads a stub', () => {
    const s = emptyState();
    const a = at(4, 3);
    const b = hexAdd(a, HEX_DIRECTIONS[0]);
    const c = at(8, 8);
    for (const h of [a, b, c]) s.roads[tileIndex(s.map, h)] = true;
    const g = roadGeometry(s);
    expect(g.segments).toHaveLength(1);
    expect(g.stubs).toEqual([tileIndex(s.map, c)]);
  });

  it('connects a road to an adjacent building of the same owner only', () => {
    const s = emptyState();
    const a = at(4, 3);
    const bHex = hexAdd(a, HEX_DIRECTIONS[0]);
    const ia = tileIndex(s.map, a);
    s.roads[ia] = true;
    s.territory[ia] = 0;
    s.buildings = [{ id: 1, type: 'house', owner: 1, hex: bHex, paused: false }];
    expect(roadGeometry(s).segments).toHaveLength(0);
    s.buildings = [{ id: 1, type: 'house', owner: 0, hex: bHex, paused: false }];
    const g = roadGeometry(s);
    expect(g.segments).toEqual([[ia, tileIndex(s.map, bHex)]]);
    expect(g.stubs).toEqual([]);
  });
});
