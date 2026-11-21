import { describe, expect, it } from 'vitest';
import { allHexes } from '../core/map';
import { hexToPixel, SQRT3 } from '../core/hex';
import type { MapState } from '../core/state';
import { mapWorldBounds } from './bounds';

const map: MapState = { width: 5, height: 4, tiles: Array(20).fill('ocean') };
const size = 32;

describe('mapWorldBounds', () => {
  it('enthält alle Feldmittelpunkte plus halbe Hexbreite/-höhe Rand', () => {
    const b = mapWorldBounds(map, size);
    for (const h of allHexes(map)) {
      const p = hexToPixel(h, size);
      expect(p.x - (size * SQRT3) / 2).toBeGreaterThanOrEqual(b.x - 1e-9);
      expect(p.x + (size * SQRT3) / 2).toBeLessThanOrEqual(b.x + b.width + 1e-9);
      expect(p.y - size).toBeGreaterThanOrEqual(b.y - 1e-9);
      expect(p.y + size).toBeLessThanOrEqual(b.y + b.height + 1e-9);
    }
  });

  it('ist eng: mindestens ein Feld berührt jeden Rand', () => {
    const b = mapWorldBounds(map, size);
    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThan(0);
    // Höhe: 4 Zeilen, Zeilenabstand 1,5·size, plus 2·size Feldhöhe
    expect(b.height).toBeCloseTo(3 * 1.5 * size + 2 * size);
  });
});
