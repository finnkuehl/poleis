import { describe, expect, it } from 'vitest';
import { tileIndex } from '../core/map';
import { at, makeTestState } from '../core/testing';
import { edgeNeighborHex } from './geometry';
import {
  apothem,
  distanceToEdges,
  edgeMask,
  ellipsePoints,
  forestTrees,
  hillMounds,
  mixColor,
  mountainPeaks,
  scaleColor,
  shoreMask,
  taperedStroke,
  tileBaseColor,
  tileHash,
  tileRng,
} from './terrain';
import { theme } from './theme';

describe('tileHash', () => {
  it('is deterministic and lies in [0, 1)', () => {
    for (let q = -20; q < 20; q++) {
      for (let r = -5; r < 5; r++) {
        const h = tileHash(q, r);
        expect(h).toBe(tileHash(q, r));
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
      }
    }
  });

  it('differs between neighbors and salts, and is spread out', () => {
    expect(tileHash(3, 4)).not.toBe(tileHash(4, 4));
    expect(tileHash(3, 4)).not.toBe(tileHash(3, 5));
    expect(tileHash(3, 4, 1)).not.toBe(tileHash(3, 4, 2));
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += tileHash(i % 50, Math.floor(i / 50));
    // Mean of a uniform [0, 1) value is 0.5
    expect(sum / n).toBeGreaterThan(0.45);
    expect(sum / n).toBeLessThan(0.55);
  });
});

describe('tileRng', () => {
  it('gives the same sequence for the same tile', () => {
    const a = tileRng(5, 7, 3);
    const b = tileRng(5, 7, 3);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  it('values lie in [0, 1)', () => {
    const rng = tileRng(1, 2);
    for (let i = 0; i < 200; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('color helpers', () => {
  it('mixColor blends channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xff8000, 0.5)).toBe(0x804000);
  });
  it('scaleColor brightens and darkens, clamped', () => {
    expect(scaleColor(0x808080, 0.5)).toBe(0x404040);
    expect(scaleColor(0x808080, 4)).toBe(0xffffff);
  });
  it('tileBaseColor stays close to the terrain color and is deterministic', () => {
    const h = { q: 4, r: 9 };
    expect(tileBaseColor('ocean', h)).toBe(tileBaseColor('ocean', h));
    const base = theme.terrainColors.forest;
    const c = tileBaseColor('forest', h);
    const v = theme.terrainPaint.landVariation;
    for (const shift of [16, 8, 0]) {
      const ch = (c >> shift) & 0xff;
      const bch = (base >> shift) & 0xff;
      expect(Math.abs(ch - bch)).toBeLessThanOrEqual(Math.ceil(bch * v) + 1);
    }
  });
});

describe('shoreMask (beach-edge detection)', () => {
  // Row 2: land "p" between water; row 1 and 3 coast
  const s = makeTestState(['ccccc', 'ccccc', 'ccppc', 'ccccc', 'ccccc']);
  const map = s.map;

  it('a land tile has a beach exactly on its water edges', () => {
    const h = at(2, 2);
    const mask = shoreMask(map, h);
    for (let e = 0; e < 6; e++) {
      const n = tileIndex(map, edgeNeighborHex(h, e));
      const expected = n >= 0 && map.tiles[n] === 'coast';
      expect(mask[e]).toBe(expected);
    }
    // Its eastern neighbor is land, so edge 0 (east) has no beach
    expect(mask[0]).toBe(false);
    expect(mask.filter(Boolean)).toHaveLength(5);
  });

  it('a water tile has foam edges towards land only', () => {
    const h = at(0, 0);
    expect(shoreMask(map, h).some(Boolean)).toBe(false);
    const nearLand = at(1, 2);
    expect(shoreMask(map, nearLand)[0]).toBe(true);
  });

  it('edges at the map border are never set', () => {
    const corner = at(0, 0);
    const mask = edgeMask(map, corner, () => true);
    for (let e = 0; e < 6; e++) {
      const inside = tileIndex(map, edgeNeighborHex(corner, e)) >= 0;
      expect(mask[e]).toBe(inside);
    }
  });
});

describe('distanceToEdges', () => {
  it('is the apothem at the center and 0 on the edge', () => {
    const size = 32;
    const all = [true, true, true, true, true, true];
    expect(distanceToEdges({ x: 0, y: 0 }, all, size)).toBeCloseTo(apothem(size), 6);
    // Edge 0 faces east
    expect(distanceToEdges({ x: apothem(size), y: 0 }, all, size)).toBeCloseTo(0, 6);
    expect(distanceToEdges({ x: 0, y: 0 }, [false, false, false, false, false, false], size)).toBe(
      Infinity,
    );
  });
});

describe('layouts', () => {
  const size = 32;
  it('forest trees stay inside the tile, away from beaches, sorted back to front', () => {
    for (let i = 0; i < 50; i++) {
      const shore = [i % 2 === 0, false, i % 3 === 0, false, false, i % 5 === 0];
      const trees = forestTrees(tileRng(i, 1), size, shore, 0.4);
      expect(trees.length).toBeGreaterThan(0);
      for (let k = 1; k < trees.length; k++)
        expect(trees[k].y).toBeGreaterThanOrEqual(trees[k - 1].y);
      for (const t of trees) {
        expect(distanceToEdges(t, [true, true, true, true, true, true], size)).toBeGreaterThan(0);
        if (shore.some(Boolean) && trees.length > 1) {
          expect(distanceToEdges(t, shore, size)).toBeGreaterThanOrEqual(size * 0.3);
        }
      }
    }
  });
  it('mounds and peaks are sorted back to front', () => {
    for (let i = 0; i < 20; i++) {
      const m = hillMounds(tileRng(i, 2), size);
      const p = mountainPeaks(tileRng(i, 3), size);
      for (let k = 1; k < m.length; k++) expect(m[k].y).toBeGreaterThanOrEqual(m[k - 1].y);
      for (let k = 1; k < p.length; k++) expect(p[k].y).toBeGreaterThanOrEqual(p[k - 1].y);
      // The front (last) peak is the big one with snow
      expect(p[p.length - 1].snow).toBe(true);
    }
  });
});

describe('shape helpers', () => {
  it('ellipsePoints returns one point per segment', () => {
    expect(ellipsePoints(0, 0, 10, 5, 12)).toHaveLength(24);
  });
  it('taperedStroke is pointed at both ends and wide in the middle', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 0 },
      { x: 20, y: 0 },
    ];
    const poly = taperedStroke(line, 2);
    // ends once each + 3 inner points on both sides = 8 points
    expect(poly).toHaveLength(16);
    expect([poly[0], poly[1]]).toEqual([0, 0]);
    const ys = poly.filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeCloseTo(1, 6);
    expect(Math.min(...ys)).toBeCloseTo(-1, 6);
    // A 2-point dash is subdivided, so it still gets a body
    expect(taperedStroke([line[0], line[4]], 2).length).toBeGreaterThan(4);
  });
});
