import { describe, expect, it } from 'vitest';
import { hexToPixel, pixelToHex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import type { MapState } from '../core/state';
import { crownRadius, woodlandTrees } from './forest';
import { edgeNeighborHex } from './geometry';
import { apothem, distanceToEdges } from './terrain';

const size = 32;
const inland = (): number => Infinity;

/** Distance of a world point to the nearest straight edge of its tile toward non-forest. */
function openDistance(map: MapState): (p: Point) => number {
  return (p) => {
    const h = pixelToHex(p, size);
    const c = hexToPixel(h, size);
    const mask: boolean[] = [];
    for (let e = 0; e < 6; e++) {
      const i = tileIndex(map, edgeNeighborHex(h, e));
      mask.push(i < 0 || map.tiles[i] !== 'forest');
    }
    return distanceToEdges({ x: p.x - c.x, y: p.y - c.y }, mask, size);
  };
}

describe('woodlandTrees', () => {
  const { map } = generateMap(3, { width: 30, height: 30 });
  const open = openDistance(map);
  const trees = woodlandTrees(map, size, inland, open);

  it('is deterministic', () => {
    expect(woodlandTrees(map, size, inland, open)).toEqual(trees);
  });

  it('stands only on forest tiles, every tree on the tile it belongs to', () => {
    expect(trees.length).toBeGreaterThan(200);
    for (const t of trees) {
      const i = tileIndex(map, pixelToHex(t, size));
      expect(i).toBe(t.tile);
      expect(map.tiles[i]).toBe('forest');
    }
  });

  it('crowns reach over edges only into other forest tiles', () => {
    for (const t of trees) {
      expect(crownRadius(t.kind, size) * t.scale).toBeLessThanOrEqual(open(t) + 1e-9);
    }
  });

  it('the canopy runs on across edges between forest tiles (no seam)', () => {
    // Trees close to a shared forest-forest edge on both sides of it
    let crossing = 0;
    for (const t of trees) {
      const h = hexAtIndex(map, t.tile);
      const c = hexToPixel(h, size);
      for (let e = 0; e < 6; e++) {
        const n = tileIndex(map, edgeNeighborHex(h, e));
        if (n < 0 || map.tiles[n] !== 'forest') continue;
        const a = (Math.PI / 3) * e;
        const toEdge = apothem(size) - ((t.x - c.x) * Math.cos(a) + (t.y - c.y) * Math.sin(a));
        if (toEdge < crownRadius(t.kind, size) * t.scale) crossing++;
      }
    }
    expect(crossing).toBeGreaterThan(trees.length * 0.1);
  });

  it('is dense: a forest tile surrounded by forest holds a full canopy', () => {
    const perTile = new Map<number, number>();
    for (const t of trees) perTile.set(t.tile, (perTile.get(t.tile) ?? 0) + 1);
    let inner = -1;
    for (let i = 0; i < map.tiles.length && inner < 0; i++) {
      if (map.tiles[i] !== 'forest') continue;
      const h = hexAtIndex(map, i);
      let all = true;
      for (let e = 0; e < 6; e++) {
        const n = tileIndex(map, edgeNeighborHex(h, e));
        if (n < 0 || map.tiles[n] !== 'forest') all = false;
      }
      if (all) inner = i;
    }
    expect(inner).toBeGreaterThanOrEqual(0);
    expect(perTile.get(inner) ?? 0).toBeGreaterThan(15);
    // The beach stays free
    const shore = (): number => 0;
    expect(woodlandTrees(map, size, shore, open)).toHaveLength(0);
  });
});
