import { describe, expect, it } from 'vitest';
import { hexCorners, hexToPixel, pixelToHex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import type { MapState } from '../core/state';
import { mapEdgeNeighborIndex } from './geometry';
import {
  depthAt,
  glintLayout,
  mapOutline,
  reefAtlasPixels,
  reefLayout,
  REEF_CELLS,
  REEF_COLUMNS,
  REEF_ROWS,
  ripplePixels,
  seaColor,
  seaDepthField,
  seaDepthPixels,
  swellPixels,
} from './sea';
import { isWater, tileRng } from './terrain';
import { theme } from './theme';

const S = theme.terrainPaint.sea;
const size = 32;

/** Land test by tile (the straight hex edges are enough for these tests). */
const landOf =
  (map: MapState) =>
  (p: Point): boolean => {
    const i = tileIndex(map, pixelToHex(p, size));
    return i >= 0 && !isWater(map.tiles[i]);
  };

/** The average color of a wave texture laid over `base`, and the image itself (r, g, b floats). */
function composite(px: Uint8Array, n: number, base: number): { mean: number[]; rgb: Float32Array } {
  const b = [(base >> 16) & 255, (base >> 8) & 255, base & 255];
  const rgb = new Float32Array(n * n * 3);
  const mean = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const a = px[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) {
      const v = px[i * 4 + k] + b[k] * (1 - a);
      rgb[i * 3 + k] = v;
      mean[k] += v / (n * n);
    }
  }
  return { mean, rgb };
}

/** Mean color difference between columns a and b (or rows, `rows`) of an n x n image. */
function lineDiff(rgb: Float32Array, n: number, a: number, b: number, rows = false): number {
  let sum = 0;
  for (let t = 0; t < n; t++) {
    const ia = rows ? a * n + t : t * n + a;
    const ib = rows ? b * n + t : t * n + b;
    for (let k = 0; k < 3; k++) sum += Math.abs(rgb[ia * 3 + k] - rgb[ib * 3 + k]);
  }
  return sum / (n * 3);
}

describe('mapOutline', () => {
  it('is one closed loop around all tiles (its area is the area of every tile together)', () => {
    const map: MapState = { width: 12, height: 10, tiles: new Array(120).fill('ocean') };
    const outline = mapOutline(map, size);
    let area = 0;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      area += a.x * b.y - b.x * a.y;
    }
    const hexArea = ((3 * Math.sqrt(3)) / 2) * size * size;
    expect(Math.abs(area / 2)).toBeCloseTo(map.tiles.length * hexArea, 0);
    // Each map border edge once: 2 per column on top and bottom, more along the sides
    expect(outline.length).toBeGreaterThan(2 * 2 * 12 + 2 * 10);
  });
});

describe('sea depth', () => {
  const { map } = generateMap(7, { width: 24, height: 24 });
  const field = seaDepthField(map, size, landOf(map));

  it('is the distance to land: zero on land, growing out to sea', () => {
    // One island tile in an ocean: depth at a point d px from its edge is about d
    const island: MapState = { width: 9, height: 9, tiles: new Array(81).fill('ocean') };
    island.tiles[4 * 9 + 4] = 'plains';
    const f = seaDepthField(island, size, landOf(island));
    const c = hexToPixel(hexAtIndex(island, 4 * 9 + 4), size);
    const apothem = (Math.sqrt(3) / 2) * size;
    expect(depthAt(f, c.x, c.y)).toBe(0);
    for (const d of [0.5, 1, 2]) {
      const v = depthAt(f, c.x + apothem + d * size, c.y);
      expect(Math.abs(v - d)).toBeLessThan(0.2);
    }
    expect(depthAt(f, c.x + apothem + 2 * size, c.y)).toBeGreaterThan(
      depthAt(f, c.x + apothem + size, c.y),
    );
  });

  it('runs on smoothly across every edge between two water tiles (no hex patchwork)', () => {
    let edges = 0;
    for (let i = 0; i < map.tiles.length; i++) {
      if (!isWater(map.tiles[i])) continue;
      const h = hexAtIndex(map, i);
      const c = hexToPixel(h, size);
      const corners = hexCorners(c, size);
      for (let e = 0; e < 6; e++) {
        const n = mapEdgeNeighborIndex(map, h, e);
        if (n < 0 || !isWater(map.tiles[n])) continue;
        const nc = hexToPixel(hexAtIndex(map, n), size);
        const mx = (corners[e].x + corners[(e + 1) % 6].x) / 2;
        const my = (corners[e].y + corners[(e + 1) % 6].y) / 2;
        // Half a px on either side of the edge, toward each tile center
        const ux = (nc.x - c.x) / Math.hypot(nc.x - c.x, nc.y - c.y);
        const uy = (nc.y - c.y) / Math.hypot(nc.x - c.x, nc.y - c.y);
        const a = { x: mx - ux * 0.5, y: my - uy * 0.5 };
        const b = { x: mx + ux * 0.5, y: my + uy * 0.5 };
        const da = depthAt(field, a.x, a.y);
        const db = depthAt(field, b.x, b.y);
        expect(Math.abs(da - db)).toBeLessThan(0.05);
        const ca = seaColor(da, a.x, a.y, size);
        const cb = seaColor(db, b.x, b.y, size);
        for (const s of [16, 8, 0]) {
          expect(Math.abs(((ca >> s) & 255) - ((cb >> s) & 255))).toBeLessThanOrEqual(4);
        }
        edges++;
      }
    }
    expect(edges).toBeGreaterThan(300);
  });

  it('paints turquoise shallows and deep blue far out, with no hard steps between texels', () => {
    const px = seaDepthPixels(field, size);
    const n = field.n;
    let biggest = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x + 1 < n; x++) {
        if (field.depth[y * n + x] <= 0 || field.depth[y * n + x + 1] <= 0) continue;
        for (let k = 0; k < 3; k++) {
          biggest = Math.max(
            biggest,
            Math.abs(px[(y * n + x) * 4 + k] - px[(y * n + x + 1) * 4 + k]),
          );
        }
      }
    }
    // The steepest change is right at the shore (bright shallows), still well under a jump
    expect(biggest).toBeLessThan(60);
    const blue = (c: number): number => c & 255;
    const red = (c: number): number => (c >> 16) & 255;
    const near = seaColor(0.2, 0, 0, size);
    const far = seaColor(6, 0, 0, size);
    // Shallow: light and green-blue; deep: dark blue
    expect(red(near)).toBeGreaterThan(red(far) + 60);
    expect(blue(near)).toBeGreaterThan(blue(far));
  });
});

describe('wave textures', () => {
  for (const [name, pixels, n, base] of [
    ['ripples', ripplePixels, 128, theme.terrainColors.coast],
    ['swells', swellPixels, 256, theme.terrainColors.ocean],
  ] as const) {
    const px = pixels(n);
    const { mean, rgb } = composite(px, n, base);

    it(`${name}: over their water color the average color stays that color`, () => {
      const want = [(base >> 16) & 255, (base >> 8) & 255, base & 255];
      for (let k = 0; k < 3; k++) expect(Math.abs(mean[k] - want[k])).toBeLessThan(1);
    });

    it(`${name}: painted detail, seamless across the wrap`, () => {
      // The seam between the last and the first column (row) is no different from the others
      for (const rows of [false, true]) {
        const inner = Array.from({ length: n - 1 }, (_, i) => lineDiff(rgb, n, i, i + 1, rows));
        expect(Math.max(...inner)).toBeGreaterThan(0.5);
        expect(lineDiff(rgb, n, n - 1, 0, rows)).toBeLessThanOrEqual(Math.max(...inner));
        const mean = inner.reduce((a, b) => a + b, 0) / inner.length;
        expect(lineDiff(rgb, n, n - 1, 0, rows)).toBeLessThan(mean * 4 + 0.1);
      }
    });
  }

  it('is deterministic', () => {
    expect(ripplePixels(64)).toEqual(ripplePixels(64));
    expect(swellPixels(64)).toEqual(swellPixels(64));
  });
});

describe('reefs and glints', () => {
  it('reef placement is deterministic, sparse and keeps where the site allows it', () => {
    const all = (ok: (p: Point, r: number) => boolean) =>
      Array.from({ length: 400 }, (_, i) => reefLayout(tileRng(i, 9, 230), size, ok));
    const a = all(() => true);
    expect(all(() => true)).toEqual(a);
    const share = a.filter((l) => l.length > 0).length / a.length;
    expect(share).toBeGreaterThan(S.reefChance * 0.7);
    expect(share).toBeLessThan(S.reefChance * 1.3);
    for (const patch of a.flat()) expect(REEF_CELLS[patch.kind]).toContain(patch.cell);
    for (const patch of all((p, r) => p.y - r > 0).flat()) {
      expect(patch.y - patch.rx).toBeGreaterThan(0);
    }
  });

  it('the reef atlas: every cell has a patch that fades out inside it', () => {
    const cell = 64;
    const px = reefAtlasPixels(cell);
    const w = cell * REEF_COLUMNS;
    const alpha = (x: number, y: number): number => px[(y * w + x) * 4 + 3];
    for (let index = 0; index < REEF_COLUMNS * REEF_ROWS; index++) {
      const ox = (index % REEF_COLUMNS) * cell;
      const oy = Math.floor(index / REEF_COLUMNS) * cell;
      let middle = 0;
      for (let y = oy + cell / 4; y < oy + (3 * cell) / 4; y++) {
        for (let x = ox + cell / 4; x < ox + (3 * cell) / 4; x++) if (alpha(x, y) > 60) middle++;
      }
      expect(middle).toBeGreaterThan(20);
      for (let k = 0; k < cell; k++) {
        expect(alpha(ox + k, oy)).toBe(0);
        expect(alpha(ox + k, oy + cell - 1)).toBe(0);
        expect(alpha(ox, oy + k)).toBe(0);
        expect(alpha(ox + cell - 1, oy + k)).toBe(0);
      }
    }
  });

  it('glints: deterministic, more on the open sea and toward the sun', () => {
    const count = (open: number, sun: number): number =>
      Array.from({ length: 500 }, (_, i) =>
        glintLayout(tileRng(i, 4, 240), size, open, sun, () => true),
      ).reduce((n, g) => n + g.length, 0);
    expect(count(1, 1)).toBe(count(1, 1));
    expect(count(1, 0.5)).toBeGreaterThan(count(0, 0.5) * 1.4);
    expect(count(0.5, 1)).toBeGreaterThan(count(0.5, 0) * 1.4);
  });
});
