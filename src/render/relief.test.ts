import { describe, expect, it } from 'vitest';
import { hexCorners, hexToPixel, pixelToHex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { at, makeTestState } from '../core/testing';
import { depthKey } from './artLayout';
import { edgeNeighborHex } from './geometry';
import {
  artPoint,
  coastCliffs,
  cornerHeight,
  cornerOwner,
  cornerPoint,
  edgeMound,
  facetLight,
  hillMounds,
  isStarShaped,
  massifFacets,
  massifPlan,
  massifPlans,
  mineArtPoint,
  mineArtTransform,
  mineCut,
  nicheFloor,
  quarryNiche,
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
import { beachEdges, cliffEdges, distanceToEdges, tileRng } from './terrain';
import { theme } from './theme';

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

  it('the mine face stays aligned with the moved and scaled sprite', () => {
    const t = mineArtTransform(size);
    expect(t.y).toBeCloseTo(theme.terrainPaint.cuts.mineShift * size, 9);
    expect(t.scale).toBe(theme.terrainPaint.cuts.mineScale);
    // The sprite: its anchor (canvas 128 / 176) on the tile center + shift, scaled by t.scale.
    // So canvas point (x, y) lands on center + shift + (x - 128, y - 176) * k * scale.
    const k = (0.92 * Math.sqrt(3) * size) / 208;
    const sprite = (x: number, y: number): { x: number; y: number } => ({
      x: c.x + t.x + (x - 128) * k * t.scale,
      y: c.y + t.y + (y - 176) * k * t.scale,
    });
    const cut = mineCut(c, size);
    const check = (p: { x: number; y: number; z: number }, x: number, y: number): void => {
      const s = sprite(x, y);
      expect(p.x).toBeCloseTo(s.x, 0);
      expect(p.y - p.z).toBeCloseTo(s.y, 0);
      expect(Math.abs(p.x - s.x)).toBeLessThan(0.05);
      expect(Math.abs(p.y - p.z - s.y)).toBeLessThan(0.05);
    };
    // The contract points of mine.py: face foot and top, tunnel opening center
    check(cut.foot[0], 117.2, 154.4);
    check(cut.foot[1], 149.6, 170.6);
    check(cut.top[0], 117.2, 117.3);
    check(cut.top[1], 149.6, 133.5);
    check(mineArtPoint(c, -10, -15, 8, size), 133.4, 151.9);
    // The face runs out into the slope on both sides (its outline reaches the ground there)
    expect(cut.face[0].z).toBe(0);
    expect(cut.face[3].z).toBe(0);
    // ... and it now stands in front of the tile center (the mountain's outer foot)
    expect(Math.min(cut.foot[0].y, cut.foot[1].y)).toBeGreaterThan(c.y);
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

  it('a mine tile is a whole mountain: peak at the center, all saddles, the face at its foot', () => {
    const s = makeTestState(['mmmmm', 'mmmmm', 'mmmmm', 'mmmmm', 'mmmmm']);
    const h = at(2, 2);
    const c = hexToPixel(h, size);
    const fp = { rx: 0.5 * size, ry: 0.3 * size, kind: 'mineCut' as const };
    const plans = massifPlans(s.map, h, size, fp);
    const free = massifPlan(s.map, h, size, null);
    // The peak: full height, at or near the tile center (not pulled back)
    expect(plans[0].apex.z).toBeCloseTo(free.apex.z, 6);
    expect(Math.abs(plans[0].apex.y - c.y)).toBeLessThan(0.25 * size);
    expect(Math.abs(plans[0].apex.x - c.x)).toBeLessThan(0.15 * size);
    // Saddles toward all mountain neighbors (the front ones through small flanks)
    const all = plans.flatMap((p) => p.base);
    for (let e = 0; e < 6; e++) expect(all).toContainEqual(ridgeSaddle(h, e, size));
    // The face is the main massif's front foot
    const cut = mineCut(c, size);
    expect(plans[0].base).toContainEqual(cut.top[0]);
    expect(plans[0].base).toContainEqual(cut.top[1]);
    // No deep niche: right in front of the face there is no mountain
    const covered = (p: { x: number; y: number }): boolean =>
      plans.some((plan) => isInside(p, plan.base));
    const front = { x: (cut.foot[0].x + cut.foot[1].x) / 2, y: cut.foot[1].y + 0.12 * size };
    expect(covered(front)).toBe(false);
    // ... and behind the face, mountain everywhere back to the rear edges
    expect(covered({ x: c.x, y: c.y - 0.5 * size })).toBe(true);
    expect(covered({ x: c.x - 0.6 * size, y: c.y })).toBe(true);
    expect(covered({ x: c.x + 0.6 * size, y: c.y })).toBe(true);
  });

  it('without mountain neighbors in front a mine tile has no flanks', () => {
    const s = makeTestState(['mmmmm', 'mmmmm', 'mmmmm', 'ppppp', 'ppppp']);
    const plans = massifPlans(s.map, at(2, 2), size, { rx: 10, ry: 6, kind: 'mineCut' });
    expect(plans).toHaveLength(1);
  });

  it('the quarry niche: flanks mirror each other about its axis and stay inside the tile', () => {
    const c = hexToPixel(at(2, 2), size);
    const n = quarryNiche(c, size);
    const [fl, fr] = n.frontFoot;
    expect(n.axis - fl.x).toBeCloseTo(fr.x - n.axis, 9);
    expect(fl.y).toBeCloseTo(fr.y, 9);
    const [pl, pr] = n.peaks;
    expect(n.axis - pl.x).toBeCloseTo(pr.x - n.axis, 9);
    expect(pl.y).toBeCloseTo(pr.y, 9);
    const all = [1, 1, 1, 1, 1, 1].map(Boolean);
    for (const p of [...n.frontFoot, ...n.frontTop, ...n.backFoot, ...n.peaks, ...n.joins]) {
      expect(distanceToEdges({ x: p.x - c.x, y: p.y - c.y }, all, size)).toBeGreaterThan(0);
    }
    expect(n.frontTop[0].z).toBeLessThan(n.backTop[0].z);
    const floor = nicheFloor(c, n, size);
    for (const p of floor) {
      expect(distanceToEdges({ x: p.x - c.x, y: p.y - c.y }, all, size)).toBeGreaterThan(-1e-9);
    }
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
        const plans = massifPlans(s.map, h, size, { rx: 0.6 * size, ry: 0.4 * size, kind });
        for (const plan of plans) expect(isStarShaped(plan.apex, plan.base)).toBe(true);
      }
    }
  });
});

/** Point inside a closed polygon of P3 (ground x / y; even-odd rule). */
function isInside(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

describe('coast mountains drop into the sea', () => {
  // A mountain with water below (south-east, south-west) and behind (north-west)
  const s = makeTestState(['ccccc', 'ccccc', 'ccmpc', 'ccccc', 'ccccc']);
  const h = at(2, 2);
  const c = hexToPixel(h, size);

  it('the massif runs to the shoreline, at cliff height', () => {
    const plan = massifPlan(s.map, h, size, null);
    for (const e of [1, 2, 3, 4, 5]) {
      const mid = plan.base[2 * e + 1];
      const r = Math.hypot(mid.x - c.x, mid.y - c.y);
      // On the (wavy) shore, about the apothem away, and raised
      expect(Math.abs(r - (Math.sqrt(3) / 2) * size)).toBeLessThan(0.15 * size);
      expect(mid.z).toBeGreaterThan(0.1 * size);
    }
  });

  it('cliff faces on the water edges facing the viewer, none on the back edges', () => {
    const cliffs = coastCliffs(s.map, h, size);
    expect(cliffs).toHaveLength(2);
    for (const cliff of cliffs) {
      expect(cliff.top.every((p) => p.z > 0)).toBe(true);
      // Its foot is the waterline at the shore, in front of (below) its top on screen
      expect(cliff.water[0]).toEqual({ x: cliff.top[0].x, y: cliff.top[0].y });
    }
  });

  it('no beach in front of mountains; hills keep theirs (or a low cliff below them)', () => {
    const shore = [true, true, true, true, true, true];
    const never = (): number => 1;
    const always = (): number => 0;
    expect(beachEdges(shore, cliffEdges('mountains', shore, never))).toEqual(
      shore.map(() => false),
    );
    expect(beachEdges(shore, cliffEdges('hills', shore, never))).toEqual(shore);
    const hillCliffs = cliffEdges('hills', shore, always);
    expect(hillCliffs).toEqual([false, true, true, false, false, false]);
    expect(beachEdges(shore, cliffEdges('plains', shore, always))).toEqual(shore);
  });
});
