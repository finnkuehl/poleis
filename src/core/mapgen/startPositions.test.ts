import { describe, expect, it } from 'vitest';
import { startPositionConfig as cfg } from '../../data/startPosition';
import { distance, hexKey, range } from '../hex';
import { terrainAt } from '../map';
import { createRng, seedFromText } from '../rng';
import { findLandmasses, generateMap } from './index';
import { findStartPositions } from './startPositions';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe('findStartPositions', () => {
  it('count 1: plains on the mainland, area meets all minimums', () => {
    for (const seed of SEEDS) {
      const { map, rng } = generateMap(seed);
      const [pos] = findStartPositions(map, 1, rng);
      const mainland = new Set(findLandmasses(map)[0].map(hexKey));
      expect(mainland.has(hexKey(pos)), `seed ${seed}`).toBe(true);
      expect(terrainAt(map, pos)).toBe('plains');
      const area = range(pos, cfg.radius).map((h) => terrainAt(map, h));
      expect(
        area.every((t) => t !== undefined),
        `seed ${seed}`,
      ).toBe(true);
      expect(area.filter((t) => t === 'forest').length, `seed ${seed}`).toBeGreaterThanOrEqual(
        cfg.minForest,
      );
      expect(
        area.filter((t) => t === 'hills' || t === 'mountains').length,
        `seed ${seed}`,
      ).toBeGreaterThanOrEqual(cfg.minHillsOrMountains);
      expect(area.filter((t) => t === 'plains').length, `seed ${seed}`).toBeGreaterThanOrEqual(
        cfg.minPlains,
      );
    }
  });

  it('count 4: distinct positions on the mainland, far enough apart', () => {
    let relaxed = 0;
    let below6 = 0;
    for (const seed of SEEDS) {
      const { map, rng } = generateMap(seed);
      const positions = findStartPositions(map, 4, rng);
      const mainland = new Set(findLandmasses(map)[0].map(hexKey));
      expect(new Set(positions.map(hexKey)).size, `seed ${seed}`).toBe(4);
      for (const p of positions) expect(mainland.has(hexKey(p))).toBe(true);
      let minDist = Infinity;
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++)
          minDist = Math.min(minDist, distance(positions[i], positions[j]));
      if (minDist < cfg.minDistanceBetweenStarts) relaxed++;
      if (minDist < 6) below6++;
    }
    // Measured (seeds 1-50): distance < 8 for 8 seeds, < 6 for 3 seeds (34, 42, 49: too few good spots on the mainland).
    expect(relaxed).toBeLessThanOrEqual(8);
    expect(below6).toBeLessThanOrEqual(3);
  });

  it('is deterministic', () => {
    for (const seed of SEEDS) {
      const { map, rng } = generateMap(seed);
      const a = findStartPositions(map, 3, createRng(rng.state));
      const b = findStartPositions(map, 3, createRng(rng.state));
      expect(a).toEqual(b);
    }
  });
});

describe('findStartPositions with 4 civilizations', () => {
  it('seed 49 (normal map) keeps the starts far enough apart', () => {
    const { map, rng } = generateMap(seedFromText('49'));
    const positions = findStartPositions(map, 4, rng);
    let minDist = Infinity;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        minDist = Math.min(minDist, distance(positions[i], positions[j]));
    expect(minDist).toBeGreaterThanOrEqual(cfg.minDistanceBetweenStarts);
  });

  it('count 1 is not affected by the relaxation (same RNG use as before)', () => {
    const { map, rng } = generateMap(7);
    const copy = createRng(rng.state);
    const [a] = findStartPositions(map, 1, rng);
    const [b] = findStartPositions(map, 1, copy);
    expect(a).toEqual(b);
    expect(rng.state).toBe(copy.state);
  });
});
