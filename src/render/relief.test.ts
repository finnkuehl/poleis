import { describe, expect, it } from 'vitest';
import { hexCorners, hexToPixel, pixelToHex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { at, makeTestState } from '../core/testing';
import { depthKey } from './artLayout';
import { edgeNeighborHex } from './geometry';
import {
  artPoint,
  cornerHeight,
  cornerOwner,
  cornerPoint,
  edgeMound,
  facetLight,
  hillMounds,
  isStarShaped,
  massifFacets,
  massifPlan,
  mineCut,
  moundShadePixels,
  quarryCut,
  ridgeSaddle,
  roadDistance,
  roadMasks,
  rowDepthKey,
  sliceDepthKey,
  sliceOfY,
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

describe('terrain slices (half rows between the buildings)', () => {
  it('back slice before the buildings of its row, front slice after them', () => {
    const { map } = generateMap(5, { width: 40, height: 40 });
    for (let i = 0; i < map.tiles.length; i++) {
      const h = hexAtIndex(map, i);
      expect(sliceDepthKey(2 * h.r)).toBeLessThan(depthKey(h));
      expect(sliceDepthKey(2 * h.r + 1)).toBeGreaterThan(depthKey(h));
      expect(sliceDepthKey(2 * h.r + 1)).toBeLessThan(sliceDepthKey(2 * h.r + 2));
      if (h.r > 0) expect(sliceDepthKey(2 * h.r - 1)).toBeLessThan(depthKey(h));
    }
  });

  it('sliceOfY: half rows by the ground point, back to front', () => {
    const row = 1.5 * size;
    expect(sliceOfY(-10, size, 10)).toBe(0);
    expect(sliceOfY(0, size, 10)).toBe(1);
    expect(sliceOfY(3 * row - 1, size, 10)).toBe(6);
    expect(sliceOfY(2.6 * row, size, 10)).toBe(6);
    expect(sliceOfY(2.4 * row, size, 10)).toBe(5);
    expect(sliceOfY(3 * row, size, 10)).toBe(7);
    expect(sliceOfY(3.4 * row, size, 10)).toBe(7);
    expect(sliceOfY(3.6 * row, size, 10)).toBe(8);
    expect(sliceOfY(99 * row, size, 10)).toBe(19);
    // Never out of order: a point further down never lands in an earlier slice
    let prev = 0;
    for (let y = -40; y < 600; y += 3) {
      const s = sliceOfY(y, size, 10);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
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

describe('mine and quarry cuts (geometry shared with the art)', () => {
  const c = { x: 0, y: 0 };
  /** Canvas units of the art (256 canvas, tile center at 128 / 176) of a landscape point. */
  const canvas = (p: { x: number; y: number; z: number }): number[] => {
    const k = (0.92 * Math.sqrt(3) * size) / 208;
    return [128 + p.x / k, 176 + (p.y - p.z) / k];
  };
  const near = (p: { x: number; y: number; z: number }, x: number, y: number): void => {
    const [cx, cy] = canvas(p);
    expect(cx).toBeCloseTo(x, 0);
    expect(cy).toBeCloseTo(y, 0);
    expect(Math.abs(cx - x)).toBeLessThan(0.15);
    expect(Math.abs(cy - y)).toBeLessThan(0.15);
  };

  it('artPoint maps the art world onto the canvas contract', () => {
    near(artPoint(c, 0, 0, 0, size), 128, 176);
    // The tunnel opening center (a -10, b -15, z 8)
    near(artPoint(c, -10, -15, 8, size), 133.4, 151.9);
  });

  it('the mine face stands where the art expects it', () => {
    const cut = mineCut(c, size);
    near(cut.foot[0], 117.2, 154.4);
    near(cut.foot[1], 149.6, 170.6);
    near(cut.top[0], 117.2, 117.3);
    near(cut.top[1], 149.6, 133.5);
    // The face runs out into the slope on both sides (its outline reaches the ground there)
    expect(cut.face[0].z).toBe(0);
    expect(cut.face[3].z).toBe(0);
  });

  it('the quarry steps stand where the art expects them', () => {
    const steps = [...quarryCut(c, size).steps].reverse();
    const feet = [
      [101.0, 151.7, 144.2, 173.3],
      [111.8, 134.3, 144.2, 150.6],
      [122.6, 117.0, 144.2, 127.8],
    ];
    const tops = [
      [101.0, 139.7, 144.2, 161.4],
      [111.8, 122.4, 144.2, 138.6],
      [122.6, 105.1, 144.2, 115.9],
    ];
    const ends = [
      [155.0, 156.0],
      [155.0, 133.2],
      [155.0, 110.5],
    ];
    steps.forEach((step, i) => {
      near(step.front[0], feet[i][0], feet[i][1]);
      near(step.front[1], feet[i][2], feet[i][3]);
      near(step.front[3], tops[i][0], tops[i][1]);
      near(step.front[2], tops[i][2], tops[i][3]);
      near(step.end[2], ends[i][0], ends[i][1]);
    });
  });

  it('a mine tile keeps its peak and the saddles toward neighboring mountains', () => {
    const s = makeTestState(['mmmmm', 'mmmmm', 'mmmmm', 'mmmmm', 'mmmmm']);
    const h = at(2, 2);
    const fp = { rx: 0.5 * size, ry: 0.3 * size, kind: 'mineCut' as const };
    const plan = massifPlan(s.map, h, size, fp);
    const free = massifPlan(s.map, h, size, null);
    expect(plan.apex.z).toBeGreaterThan(free.apex.z * 0.8);
    // East, west and the three back edges keep their shared saddle
    for (const e of [0, 3, 4, 5]) expect(plan.base).toContainEqual(ridgeSaddle(h, e, size));
    // ... and the face is part of the foot
    const cut = mineCut(hexToPixel(h, size), size);
    expect(plan.base).toContainEqual(cut.top[0]);
    expect(plan.base).toContainEqual(cut.top[1]);
  });

  it('cut massifs never fold, whatever the neighbors are', () => {
    const terrains = ['m', 'p', 'c'];
    for (let combo = 0; combo < 3 ** 6; combo++) {
      const rows = ['ppppp', 'ppppp', 'ppppp', 'ppppp', 'ppppp'].map((r) => r.split(''));
      const h = at(2, 2);
      rows[2][2] = 'm';
      for (let e = 0; e < 6; e++) {
        const n = edgeNeighborHex(h, e);
        const t = terrains[Math.floor(combo / 3 ** e) % 3];
        const col = n.q + (n.r - (n.r & 1)) / 2;
        rows[n.r][col] = t;
      }
      const s = makeTestState(rows.map((r) => r.join('')));
      for (const kind of ['mineCut', 'quarryCut'] as const) {
        const plan = massifPlan(s.map, h, size, { rx: 0.6 * size, ry: 0.4 * size, kind });
        expect(isStarShaped(plan.apex, plan.base)).toBe(true);
      }
    }
  });
});
