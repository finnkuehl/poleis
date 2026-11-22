import { describe, expect, it } from 'vitest';
import {
  ATLAS_CELLS,
  ATLAS_GRID,
  hillGrassPixels,
  meadowAtlasPixels,
  meadowGrassPixels,
  meadowLayout,
  type MeadowSite,
} from './meadow';
import { tileRng } from './terrain';
import { theme } from './theme';

const G = theme.terrainPaint.meadow;
const size = 32;

/** Mean absolute color difference between two columns of an n x n RGBA texture. */
function columnDiff(px: Uint8Array, n: number, a: number, b: number): number {
  let sum = 0;
  for (let y = 0; y < n; y++) {
    for (let k = 0; k < 3; k++) sum += Math.abs(px[(y * n + a) * 4 + k] - px[(y * n + b) * 4 + k]);
  }
  return sum / (n * 3);
}

describe('grass textures', () => {
  const n = 128;
  const meadow = meadowGrassPixels(n);

  it('the meadow grass is opaque and has the meadow color on average', () => {
    const sum = [0, 0, 0];
    for (let i = 0; i < n * n; i++) {
      expect(meadow[i * 4 + 3]).toBe(255);
      for (let k = 0; k < 3; k++) sum[k] += meadow[i * 4 + k];
    }
    const c = theme.terrainColors.plains;
    const want = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    for (let k = 0; k < 3; k++) expect(Math.abs(sum[k] / (n * n) - want[k])).toBeLessThan(2.5);
  });

  it('has painted detail (not one flat color) and tiles without a seam', () => {
    const inner = columnDiff(meadow, n, 40, 41);
    expect(inner).toBeGreaterThan(3);
    // Across the wrap the columns differ no more than any two neighboring columns do
    expect(columnDiff(meadow, n, n - 1, 0)).toBeLessThan(inner * 1.6);
    const rowDiff = (a: number, b: number): number => {
      let sum = 0;
      for (let x = 0; x < n; x++) {
        for (let k = 0; k < 3; k++)
          sum += Math.abs(meadow[(a * n + x) * 4 + k] - meadow[(b * n + x) * 4 + k]);
      }
      return sum / (n * 3);
    };
    expect(rowDiff(n - 1, 0)).toBeLessThan(rowDiff(60, 61) * 1.6);
  });

  it('the dry grass of the hills is strokes on a transparent ground', () => {
    const hill = hillGrassPixels(n);
    let covered = 0;
    for (let i = 0; i < n * n; i++) {
      const a = hill[i * 4 + 3];
      // Premultiplied: no channel above its alpha
      for (let k = 0; k < 3; k++) expect(hill[i * 4 + k]).toBeLessThanOrEqual(a);
      if (a > 0) covered++;
    }
    expect(covered / (n * n)).toBeGreaterThan(0.1);
    expect(covered / (n * n)).toBeLessThan(0.85);
  });

  it('is deterministic', () => {
    expect(meadowGrassPixels(64)).toEqual(meadowGrassPixels(64));
    expect(hillGrassPixels(64)).toEqual(hillGrassPixels(64));
  });
});

describe('meadow atlas', () => {
  const cell = 64;
  const px = meadowAtlasPixels(cell);
  const n = cell * ATLAS_GRID;
  const alphaAt = (x: number, y: number): number => px[(y * n + x) * 4 + 3];

  it('every cell holds a cluster that fades out inside its cell (no bleeding)', () => {
    const used = new Set(Object.values(ATLAS_CELLS).flat());
    expect(used.size).toBe(ATLAS_GRID * ATLAS_GRID);
    for (const index of used) {
      const ox = (index % ATLAS_GRID) * cell;
      const oy = Math.floor(index / ATLAS_GRID) * cell;
      let middle = 0;
      for (let y = oy + cell / 4; y < oy + (3 * cell) / 4; y++) {
        for (let x = ox + cell / 4; x < ox + (3 * cell) / 4; x++) if (alphaAt(x, y) > 128) middle++;
      }
      expect(middle).toBeGreaterThan(20);
      for (let k = 0; k < cell; k++) {
        expect(alphaAt(ox + k, oy)).toBe(0);
        expect(alphaAt(ox + k, oy + cell - 1)).toBe(0);
        expect(alphaAt(ox, oy + k)).toBe(0);
        expect(alphaAt(ox + cell - 1, oy + k)).toBe(0);
      }
    }
  });
});

describe('meadowLayout', () => {
  const site = (over: Partial<MeadowSite> = {}): MeadowSite => ({
    density: 1,
    damp: 0,
    dampSide: null,
    dry: 0.2,
    flowers: 0.5,
    open: true,
    ok: () => true,
    ...over,
  });
  /** Clusters over many tiles. */
  const many = (s: MeadowSite) =>
    Array.from({ length: 300 }, (_, i) => meadowLayout(tileRng(i, 3, 20), size, s));

  it('is deterministic', () => {
    expect(meadowLayout(tileRng(4, 5, 20), size, site())).toEqual(
      meadowLayout(tileRng(4, 5, 20), size, site()),
    );
  });

  it('denser beside forests and water, sparser beside hills', () => {
    const count = (density: number): number =>
      many(site({ density })).reduce((n, l) => n + l.clusters.length, 0);
    expect(count(G.densityRange[1])).toBeGreaterThan(count(1) * 1.3);
    expect(count(G.densityRange[0])).toBeLessThan(count(1) * 0.7);
  });

  it('lush tufts gather on the damp side, flowers in flowery regions', () => {
    const lush = many(site({ damp: 1, dampSide: { x: 1, y: 0 } }))
      .flatMap((l) => l.clusters)
      .filter((c) => c.kind === 'lush');
    expect(lush.length).toBeGreaterThan(100);
    expect(lush.reduce((s, c) => s + c.x, 0) / lush.length).toBeGreaterThan(0.25 * size);
    const flowers = (f: number): number =>
      many(site({ flowers: f }))
        .flatMap((l) => l.clusters)
        .filter((c) => c.layer === 2).length;
    expect(flowers(1)).toBeGreaterThan(flowers(0) * 2.5);
  });

  it('keeps every cluster where the site allows it; lone trees only on open meadow', () => {
    const ok = (p: { x: number; y: number }, r: number): boolean => p.x + r < 0;
    for (const l of many(site({ ok, open: false }))) {
      for (const c of l.clusters) expect(c.x + c.rx).toBeLessThan(0);
      for (const p of l.plants) expect(p.kind).toBe('shrub');
    }
    const plants = many(site()).flatMap((l) => l.plants);
    expect(plants.some((p) => p.kind !== 'shrub')).toBe(true);
    for (const l of many(site())) {
      for (const c of l.clusters) expect(ATLAS_CELLS[c.kind]).toContain(c.cell);
    }
  });
});
