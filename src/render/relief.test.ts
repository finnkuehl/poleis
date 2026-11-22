import { describe, expect, it } from 'vitest';
import { hexCorners, hexToPixel, pixelToHex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { at, makeTestState } from '../core/testing';
import { depthKey } from './artLayout';
import { edgeNeighborHex } from './geometry';
import {
  cornerHeight,
  cornerOwner,
  cornerPoint,
  edgeMound,
  facetLight,
  hillMounds,
  massifFacets,
  massifPlan,
  moundShadePixels,
  ridgeSaddle,
  roadDistance,
  roadMasks,
  rowDepthKey,
  softSpotPixels,
  terraceArc,
} from './relief';
import { distanceToEdges, tileRng } from './terrain';

const size = 32;
const inland = (): number => Infinity;

describe('rowDepthKey (terrain rows between the buildings)', () => {
  it('a terrain row sorts after every building of the row above and before its own row', () => {
    const { map } = generateMap(5, { width: 40, height: 40 });
    for (let i = 0; i < map.tiles.length; i++) {
      const h = hexAtIndex(map, i);
      expect(depthKey(h)).toBeGreaterThan(rowDepthKey(h.r));
      expect(depthKey(h)).toBeLessThan(rowDepthKey(h.r + 1));
    }
    expect(rowDepthKey(3)).toBeLessThan(rowDepthKey(4));
  });
});

describe('corners and saddles are shared by the neighboring tiles', () => {
  it('cornerOwner and cornerPoint give the same corner from all three tiles', () => {
    for (const h of [
      { q: 0, r: 0 },
      { q: 4, r: -3 },
      { q: -2, r: 5 },
    ]) {
      for (let c = 0; c < 6; c++) {
        const own = cornerOwner(h, c);
        const n1 = edgeNeighborHex(h, c);
        const n2 = edgeNeighborHex(h, (c + 5) % 6);
        expect(cornerOwner(n1, (c + 4) % 6)).toEqual(own);
        expect(cornerOwner(n2, (c + 2) % 6)).toEqual(own);
        const p = cornerPoint(h, c, size);
        expect(cornerPoint(n1, (c + 4) % 6, size)).toEqual(p);
        expect(cornerPoint(n2, (c + 2) % 6, size)).toEqual(p);
        // ... and it really is that corner of h
        const mine = hexCorners(hexToPixel(h, size), size)[c];
        expect(p.x).toBeCloseTo(mine.x, 9);
        expect(p.y).toBeCloseTo(mine.y, 9);
      }
    }
  });

  it('ridgeSaddle is identical from both tiles and lies on their shared edge', () => {
    for (let e = 0; e < 6; e++) {
      const a = { q: 2, r: 3 };
      const b = edgeNeighborHex(a, e);
      const s = ridgeSaddle(a, e, size);
      expect(ridgeSaddle(b, (e + 3) % 6, size)).toEqual(s);
      expect(s.z).toBeGreaterThan(0);
      // Halfway between the two centers (up to the shift along the edge)
      const ca = hexToPixel(a, size);
      const cb = hexToPixel(b, size);
      expect(Math.hypot(s.x - ca.x, s.y - ca.y)).toBeCloseTo(Math.hypot(s.x - cb.x, s.y - cb.y), 6);
    }
  });

  it('cornerHeight: raised only where three mountain tiles meet, the same for all three', () => {
    const s = makeTestState(['mmmmm', 'mmmmm', 'mmppm', 'mmmmm', 'mmmmm']);
    const map = s.map;
    const inner = at(1, 1);
    for (let c = 0; c < 6; c++) {
      const v = cornerHeight(map, inner, c, size);
      expect(cornerHeight(map, edgeNeighborHex(inner, c), (c + 4) % 6, size)).toBe(v);
      expect(cornerHeight(map, edgeNeighborHex(inner, (c + 5) % 6), (c + 2) % 6, size)).toBe(v);
    }
    const plains = at(2, 2);
    expect(map.tiles[tileIndex(map, plains)]).toBe('plains');
    for (let c = 0; c < 6; c++) expect(cornerHeight(map, plains, c, size)).toBe(0);
  });
});

describe('massifPlan', () => {
  const s = makeTestState(['ppppp', 'pmmmp', 'pmmmp', 'ppppp', 'ppppp']);
  const map = s.map;

  it('neighboring mountain tiles share the foot points on their common edge (a ridge)', () => {
    const a = at(1, 1);
    for (let e = 0; e < 6; e++) {
      const b = edgeNeighborHex(a, e);
      if (map.tiles[tileIndex(map, b)] !== 'mountains') continue;
      const pa = massifPlan(map, a, size, null).base;
      const pb = massifPlan(map, b, size, null).base;
      // Edge e of a: corner e, middle (saddle), corner e + 1  ==  edge e + 3 of b, reversed
      const mine = [pa[2 * e], pa[2 * e + 1], pa[(2 * e + 2) % 12]];
      const eb = (e + 3) % 6;
      const theirs = [pb[(2 * eb + 2) % 12], pb[2 * eb + 1], pb[2 * eb]];
      expect(mine).toEqual(theirs);
      expect(mine[1].z).toBeGreaterThan(0);
    }
  });

  it('keeps the foot inside the tile and the peak high', () => {
    const h = at(2, 2);
    const plan = massifPlan(map, h, size, null);
    const c = hexToPixel(h, size);
    for (const b of plan.base) {
      expect(
        distanceToEdges({ x: b.x - c.x, y: b.y - c.y }, [true, true, true, true, true, true], size),
      ).toBeGreaterThan(-1e-9);
    }
    expect(plan.apex.z).toBeGreaterThan(size * 0.9);
  });

  it('with a building the massif sits behind the footprint', () => {
    const h = at(2, 1);
    const fp = { rx: 0.85 * size, ry: 0.55 * size };
    const plan = massifPlan(map, h, size, fp);
    const c = hexToPixel(h, size);
    expect(plan.apex.y - c.y).toBeLessThan(-fp.ry);
    for (const b of plan.base) {
      const x = (b.x - c.x) / fp.rx;
      const y = (b.y - c.y) / fp.ry;
      // On or outside the footprint ellipse, never in front of the tile center
      expect(x * x + y * y).toBeGreaterThan(0.9);
      expect(b.y - c.y).toBeLessThan(1e-6);
    }
  });

  it('facets cover the massif back to front and get sunlight in 0..1', () => {
    const plan = massifPlan(map, at(2, 2), size, null);
    const facets = massifFacets(plan, size, tileRng(1, 2, 3));
    expect(facets.length).toBe(plan.base.length * 3);
    for (const f of facets) {
      expect(f.light).toBeGreaterThanOrEqual(0);
      expect(f.light).toBeLessThanOrEqual(1);
    }
    // A face toward the upper left (the sun) is brighter than one toward the lower right
    const up = { x: 0, y: 0, z: 10 };
    const west = facetLight(up, { x: -10, y: -10, z: 0 }, { x: -10, y: 10, z: 0 });
    const east = facetLight(up, { x: 10, y: 10, z: 0 }, { x: 10, y: -10, z: 0 });
    expect(west).toBeGreaterThan(east);
  });
});

describe('hill mounds', () => {
  it('the mound on a shared edge is the same from both tiles, and straddles the edge', () => {
    let found = 0;
    for (let q = -4; q < 4; q++) {
      for (let e = 0; e < 6; e++) {
        const a = { q, r: 1 };
        const b = edgeNeighborHex(a, e);
        const m = edgeMound(a, e, size);
        expect(edgeMound(b, (e + 3) % 6, size)).toEqual(m);
        if (!m) continue;
        found++;
        // The mound reaches into both tiles
        const tilesTouched = new Set<string>();
        for (const dx of [-0.9, 0, 0.9]) {
          for (const dy of [-0.4, 0, 0.3]) {
            const h = pixelToHex({ x: m.x + dx * m.w, y: m.y + dy * m.w }, size);
            tilesTouched.add(`${h.q},${h.r}`);
          }
        }
        expect(tilesTouched.has(`${a.q},${a.r}`)).toBe(true);
        expect(tilesTouched.has(`${b.q},${b.r}`)).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(10);
  });

  it('mounds stand on hills only, never on water, sorted back to front', () => {
    const { map } = generateMap(7, { width: 30, height: 30 });
    const mounds = hillMounds(map, size, inland);
    expect(mounds.length).toBeGreaterThan(0);
    for (let k = 1; k < mounds.length; k++) {
      expect(mounds[k].y).toBeGreaterThanOrEqual(mounds[k - 1].y);
    }
    const terrainAt = (x: number, y: number): string | null => {
      const i = tileIndex(map, pixelToHex({ x, y }, size));
      return i < 0 ? null : map.tiles[i];
    };
    for (const m of mounds) {
      expect(['hills', 'mountains', 'plains']).toContain(terrainAt(m.x, m.y));
      expect(['ocean', 'coast', null]).not.toContain(terrainAt(m.x, m.y - m.h));
    }
  });

  it('is deterministic', () => {
    const { map } = generateMap(11, { width: 20, height: 20 });
    expect(hillMounds(map, size, inland)).toEqual(hillMounds(map, size, inland));
  });
});

describe('terraceArc', () => {
  it('runs along the front of the footprint, inside the hex', () => {
    for (const fp of [
      { rx: 0.86 * size, ry: 0.55 * size },
      { rx: 0.88 * size, ry: 0.88 * size },
      { rx: 0.5 * size, ry: 0.3 * size },
    ]) {
      const arc = terraceArc(fp, size);
      expect(arc.length).toBeGreaterThan(4);
      // From the right side to the left, all in front of the center
      expect(arc[0].x).toBeGreaterThan(arc[arc.length - 1].x);
      const all = [true, true, true, true, true, true];
      for (const p of arc) {
        expect(p.y).toBeGreaterThan(0);
        expect(distanceToEdges(p, all, size)).toBeGreaterThan(0);
      }
      // Its lowest point lies at the front of the ellipse (unless the hex pulls it in)
      const front = arc[Math.floor(arc.length / 2)];
      expect(front.y).toBeLessThanOrEqual(fp.ry + 1e-9);
      expect(front.y).toBeGreaterThan(fp.ry * 0.85);
    }
  });
});

describe('roads (the terrain keeps off them)', () => {
  it('roadMasks marks the edges toward the connected tile on both sides', () => {
    const s = makeTestState(['ppppp', 'ppppp', 'ppppp']);
    const a = at(1, 1);
    const b = at(2, 1);
    const ia = tileIndex(s.map, a);
    const ib = tileIndex(s.map, b);
    const masks = roadMasks(s.map, { segments: [[ia, ib]], stubs: [tileIndex(s.map, at(0, 2))] });
    // b lies east of a: edge 0 of a, edge 3 of b
    expect(masks[ia]).toBe((1 << 0) | 64);
    expect(masks[ib]).toBe((1 << 3) | 64);
    expect(masks[tileIndex(s.map, at(0, 2))]).toBe(64);
    expect(masks[tileIndex(s.map, at(4, 0))]).toBe(0);
  });

  it('roadDistance: 0 on the road line, large beside it, Infinity without a road', () => {
    const east = (1 << 0) | 64;
    expect(roadDistance({ x: 10, y: 0 }, east, size)).toBeCloseTo(0, 9);
    expect(roadDistance({ x: 10, y: 8 }, east, size)).toBeCloseTo(8, 9);
    expect(roadDistance({ x: -10, y: 0 }, east, size)).toBeCloseTo(10, 9);
    expect(roadDistance({ x: 3, y: 4 }, 64, size)).toBeCloseTo(5, 9);
    expect(roadDistance({ x: 0, y: 0 }, 0, size)).toBe(Infinity);
  });
});

describe('shading textures', () => {
  it('soft spot: opaque in the middle, transparent at the rim, premultiplied white', () => {
    const n = 16;
    const px = softSpotPixels(n);
    expect(px).toHaveLength(n * n * 4);
    const at = (x: number, y: number): number[] => [
      ...px.slice((y * n + x) * 4, (y * n + x) * 4 + 4),
    ];
    expect(at(0, 0)[3]).toBe(0);
    expect(at(n / 2, n / 2)[3]).toBeGreaterThan(240);
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4]).toBe(px[i * 4 + 3]);
    }
  });

  it('mound shading: lit upper left, darker lower right, fading out at the bottom', () => {
    const n = 32;
    const px = moundShadePixels(n);
    const lum = (x: number, y: number): number => {
      const i = (y * n + x) * 4;
      return px[i] / Math.max(1, px[i + 3]);
    };
    const alpha = (x: number, y: number): number => px[(y * n + x) * 4 + 3];
    expect(lum(8, 4)).toBeGreaterThan(lum(24, 18));
    expect(alpha(n / 2, 2)).toBe(255);
    expect(alpha(n / 2, n - 1)).toBeLessThan(20);
    // Premultiplied: color never above alpha
    for (let i = 0; i < n * n; i++) expect(px[i * 4]).toBeLessThanOrEqual(px[i * 4 + 3]);
  });
});
