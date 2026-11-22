import { describe, expect, it } from 'vitest';
import { tileIndex } from '../core/map';
import { at, makeTestState } from '../core/testing';
import { edgeNeighborHex } from './geometry';
import {
  apothem,
  distanceToEdges,
  distanceToWavyEdges,
  edgeMask,
  edgeWave,
  ellipsePoints,
  footprintRowsToRepaint,
  forestTrees,
  hillMounds,
  insideFootprint,
  mixColor,
  mountainPeaks,
  scaleColor,
  shoreMask,
  smoothNoise,
  taperedStroke,
  tileBaseColor,
  tileHash,
  tileRng,
  valueNoise,
  WAVE_SEGMENTS,
  type FootprintShape,
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

describe('valueNoise / smoothNoise', () => {
  it('is deterministic, lies in [0, 1) and hits the lattice values', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37 - 20;
      const y = i * 0.53 - 31;
      const v = smoothNoise(x, y, 4);
      expect(v).toBe(smoothNoise(x, y, 4));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(valueNoise(3, -2, 1)).toBeCloseTo(tileHash(3, -2, 1), 12);
  });
  it('is continuous: tiny steps give tiny changes (no per-tile jumps)', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.113;
      const y = i * 0.071;
      expect(Math.abs(smoothNoise(x + 0.01, y) - smoothNoise(x, y))).toBeLessThan(0.03);
      expect(Math.abs(smoothNoise(x, y + 0.01) - smoothNoise(x, y))).toBeLessThan(0.03);
    }
  });
});

describe('edgeWave', () => {
  const amp = 5;
  it('ends in 0, stays within the amplitude and is deterministic', () => {
    for (let q = -3; q < 3; q++) {
      for (let e = 0; e < 6; e++) {
        const w = edgeWave({ q, r: 2 }, e, amp);
        expect(w).toHaveLength(WAVE_SEGMENTS + 1);
        expect(w[0]).toBe(0);
        expect(w[WAVE_SEGMENTS]).toBe(0);
        for (const v of w) expect(Math.abs(v)).toBeLessThanOrEqual(amp + 1e-9);
        expect(edgeWave({ q, r: 2 }, e, amp)).toEqual(w);
      }
    }
  });
  it('the neighbor sees the same curve: reversed and with the normal flipped', () => {
    for (let e = 0; e < 6; e++) {
      const a = { q: 4, r: -1 };
      const b = edgeNeighborHex(a, e);
      const wa = edgeWave(a, e, amp);
      const wb = edgeWave(b, (e + 3) % 6, amp);
      expect(wb).toEqual(wa.map((v) => (v === 0 ? 0 : -v)).reverse());
    }
  });
  it('different edges get different curves', () => {
    expect(edgeWave({ q: 0, r: 0 }, 0, amp)).not.toEqual(edgeWave({ q: 0, r: 0 }, 1, amp));
  });
});

describe('distanceToWavyEdges', () => {
  const size = 32;
  const all = [true, true, true, true, true, true];
  it('equals distanceToEdges for straight edges', () => {
    const p = { x: 3, y: -4 };
    expect(distanceToWavyEdges(p, all, [null, null, null, null, null, null], size)).toBeCloseTo(
      distanceToEdges(p, all, size),
      9,
    );
  });
  it('is 0 on the curve and grows where the tile bulges outward', () => {
    const wave = new Array<number>(WAVE_SEGMENTS + 1).fill(0);
    wave[WAVE_SEGMENTS / 2] = 4;
    const waves = [wave, null, null, null, null, null];
    const mask = [true, false, false, false, false, false];
    // Middle of edge 0 (east), pushed 4 px outward
    expect(distanceToWavyEdges({ x: apothem(size) + 4, y: 0 }, mask, waves, size)).toBeCloseTo(
      0,
      9,
    );
    expect(distanceToWavyEdges({ x: 0, y: 0 }, mask, waves, size)).toBeCloseTo(
      apothem(size) + 4,
      9,
    );
  });
});

describe('footprints', () => {
  const size = 32;
  it('insideFootprint: inside the ellipse and inside the hex', () => {
    const fp = { rx: 10, ry: 6 };
    expect(insideFootprint({ x: 0, y: 0 }, fp, size)).toBe(true);
    expect(insideFootprint({ x: 9, y: 0 }, fp, size)).toBe(true);
    expect(insideFootprint({ x: 0, y: 7 }, fp, size)).toBe(false);
    // Larger than the hex: the whole tile, but never beyond its edge
    const big = { rx: 100, ry: 100 };
    expect(insideFootprint({ x: apothem(size) - 1, y: 0 }, big, size)).toBe(true);
    expect(insideFootprint({ x: apothem(size) + 1, y: 0 }, big, size)).toBe(false);
    expect(insideFootprint({ x: 0, y: 0 }, { rx: 0, ry: 5 }, size)).toBe(false);
  });

  it('footprintRowsToRepaint: only rows around changed tiles, nothing for the same footprints', () => {
    const width = 10;
    const height = 8;
    const fp = (rx: number, ry = rx): FootprintShape => ({ rx, ry });
    const a = new Map([
      [25, fp(10)],
      [71, fp(12)],
    ]);
    expect(footprintRowsToRepaint(a, new Map(a), width, height)).toEqual([]);
    expect(footprintRowsToRepaint(new Map(), new Map(), width, height)).toEqual([]);
    // New footprint on tile 25 (row 2): rows 1..3
    expect(footprintRowsToRepaint(new Map([[71, fp(12)]]), a, width, height)).toEqual([1, 2, 3]);
    // Removed footprint on tile 71 (last row 7): rows 6..7
    expect(footprintRowsToRepaint(a, new Map([[25, fp(10)]]), width, height)).toEqual([6, 7]);
    // Changed size on tile 3 (row 0): rows 0..1
    expect(
      footprintRowsToRepaint(new Map([[3, fp(10)]]), new Map([[3, fp(10, 8)]]), width, height),
    ).toEqual([0, 1]);
  });
});
