import { describe, expect, it } from 'vitest';
import {
  bankImage,
  fbm,
  flagstoneTileImage,
  gravelTileImage,
  pavingImage,
  pavingReliefImage,
  periodicNoise,
  rutReliefImage,
  slabRows,
  type PixelImage,
} from './roadTextures';
import { theme } from './theme';

const S = theme.road.textures;

function alphaAt(img: PixelImage, x: number, y: number): number {
  return img.pixels[(y * img.width + x) * 4 + 3];
}

/** Largest premultiplied-color step between two columns (x0, x1) over all rows. */
function columnStep(img: PixelImage, x0: number, x1: number): number {
  let worst = 0;
  for (let y = 0; y < img.height; y++) {
    for (let k = 0; k < 4; k++) {
      const a = img.pixels[(y * img.width + x0) * 4 + k];
      const b = img.pixels[(y * img.width + x1) * 4 + k];
      worst = Math.max(worst, Math.abs(a - b));
    }
  }
  return worst;
}

describe('noise', () => {
  it('repeats exactly at its period, so textures tile without a seam', () => {
    for (const [x, y] of [
      [0.3, 0.7],
      [2.9, 1.1],
      [5.5, 3.25],
    ]) {
      expect(periodicNoise(x + 8, y, 8, 4, 3)).toBeCloseTo(periodicNoise(x, y, 8, 4, 3), 12);
      expect(periodicNoise(x, y + 4, 8, 4, 3)).toBeCloseTo(periodicNoise(x, y, 8, 4, 3), 12);
      expect(fbm(x / 8 + 1, y / 4, 3, 2, 3, 5)).toBeCloseTo(fbm(x / 8, y / 4, 3, 2, 3, 5), 12);
    }
  });
});

describe('road textures', () => {
  it('have power-of-two sizes (they repeat and get mipmaps on every device)', () => {
    const pot = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;
    for (const n of [
      S.gravelSize,
      S.flagstoneSize,
      S.rutSize.along,
      S.rutSize.across,
      S.pavingSize.along,
      S.pavingSize.across,
      S.bankSize.along,
      S.bankSize.across,
    ]) {
      expect(pot(n)).toBe(true);
    }
  });

  it('are the same every time (deterministic)', () => {
    expect(gravelTileImage(64).pixels).toEqual(gravelTileImage(64).pixels);
    expect(rutReliefImage(128, 32).pixels).toEqual(rutReliefImage(128, 32).pixels);
  });

  it('are premultiplied (no color brighter than its alpha)', () => {
    for (const img of [rutReliefImage(128, 64), pavingImage(128, 64), bankImage(64, 32)]) {
      for (let i = 0; i < img.pixels.length; i += 4) {
        const a = img.pixels[i + 3];
        expect(Math.max(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2])).toBeLessThanOrEqual(
          a,
        );
      }
    }
  });

  it('the gravel and flagstone tiles are opaque and join seamlessly at their edges', () => {
    for (const img of [gravelTileImage(S.gravelSize), flagstoneTileImage(S.flagstoneSize)]) {
      for (let y = 0; y < img.height; y += 7) {
        for (let x = 0; x < img.width; x += 7) expect(alphaAt(img, x, y)).toBe(255);
      }
      // The last column runs on into the first one about as smoothly as two inner columns
      const inner = columnStep(img, 100, 101);
      expect(columnStep(img, img.width - 1, 0)).toBeLessThanOrEqual(Math.max(inner, 1) * 3);
    }
  });

  it('the strips repeat along the road and fade out toward their sides', () => {
    const ruts = rutReliefImage(S.rutSize.along, S.rutSize.across);
    const relief = pavingReliefImage(S.pavingSize.along, S.pavingSize.across);
    for (const img of [ruts, relief]) {
      for (let x = 0; x < img.width; x += 16) {
        expect(alphaAt(img, x, 0)).toBeLessThan(10);
        expect(alphaAt(img, x, img.height - 1)).toBeLessThan(10);
      }
    }
    expect(columnStep(ruts, ruts.width - 1, 0)).toBeLessThan(40);
    // The paving is opaque between its curbs
    const paving = pavingImage(S.pavingSize.along, S.pavingSize.across);
    for (let x = 0; x < paving.width; x += 9) {
      expect(alphaAt(paving, x, paving.height / 2)).toBe(255);
      expect(alphaAt(paving, x, Math.round(paving.height * 0.1))).toBe(255);
    }
  });

  it('lays the slabs in rows of 2-3 with the joints shifted from row to row', () => {
    const rows = slabRows(12, 0.2, 71);
    expect(rows).toHaveLength(12);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      expect(r.joints.length === 1 || r.joints.length === 2).toBe(true);
      expect(r.tones).toHaveLength(r.joints.length + 1);
      for (const j of r.joints) expect(Math.abs(j)).toBeLessThan(0.8);
      // Never the same joint as the row before (running bond)
      const prev = rows[(i + rows.length - 1) % rows.length];
      if (i > 0 && r.joints.length === 1 && prev.joints.length === 1) {
        expect(Math.abs(r.joints[0] - prev.joints[0])).toBeGreaterThan(0.1);
      }
    }
  });
});
