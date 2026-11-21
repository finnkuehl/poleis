import { describe, expect, it } from 'vitest';
import { mapgenConfig as cfg } from '../../data/mapgen';
import { TERRAIN, TERRAIN_IDS, type TerrainId } from '../../data/terrain';
import { neighbors, type Hex } from '../hex';
import { allHexes, hexAtIndex, terrainAt } from '../map';
import { createGameState, type MapState } from '../state';
import { findLandmasses, generateMap, isPassableConnected } from './index';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

const isWater = (map: MapState, h: Hex): boolean => {
  const t = terrainAt(map, h);
  return t !== undefined && TERRAIN[t].isWater;
};
const hasLandNeighbor = (map: MapState, h: Hex): boolean =>
  neighbors(h).some((n) => {
    const t = terrainAt(map, n);
    return t !== undefined && !TERRAIN[t].isWater;
  });
const share = (map: MapState, cells: Hex[], id: TerrainId): number =>
  cells.filter((c) => terrainAt(map, c) === id).length / cells.length;

describe('Determinism', () => {
  it('same seed gives an identical map and RNG', () => {
    expect(generateMap(7)).toEqual(generateMap(7));
  });
  it('different seeds give different maps', () => {
    expect(generateMap(1).map.tiles).not.toEqual(generateMap(2).map.tiles);
  });
  it('GameState survives a JSON round trip', () => {
    const state = createGameState('hello');
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(createGameState('hello')).toEqual(state);
  });
});

describe('Maps 30x30, seeds 1-50', () => {
  const maps = SEEDS.map((s) => generateMap(s).map);

  it('size and valid terrain values', () => {
    for (const map of maps) {
      expect(map.tiles.length).toBe(map.width * map.height);
      for (const t of map.tiles) expect(TERRAIN_IDS).toContain(t);
    }
  });

  it('outermost ring is water', () => {
    for (const map of maps) {
      allHexes(map).forEach((h, i) => {
        const col = i % map.width;
        const row = Math.floor(i / map.width);
        if (col === 0 || row === 0 || col === map.width - 1 || row === map.height - 1) {
          expect(isWater(map, h)).toBe(true);
        }
      });
    }
  });

  it('coast exactly when water has a land neighbor', () => {
    for (const map of maps) {
      map.tiles.forEach((t, i) => {
        if (!TERRAIN[t].isWater) return;
        const near = hasLandNeighbor(map, hexAtIndex(map, i));
        expect(t).toBe(near ? 'coast' : 'ocean');
      });
    }
  });

  it('mainland 42-48 %, 3-6 islands within the size range', () => {
    for (const map of maps) {
      const land = findLandmasses(map);
      const total = map.width * map.height;
      expect(land[0].length / total).toBeGreaterThanOrEqual(0.42);
      expect(land[0].length / total).toBeLessThanOrEqual(0.48);
      expect(land.length - 1).toBeGreaterThanOrEqual(cfg.islandCount.min);
      expect(land.length - 1).toBeLessThanOrEqual(cfg.islandCount.max);
      for (const island of land.slice(1)) {
        expect(island.length).toBeGreaterThanOrEqual(cfg.islandSize.min);
        expect(island.length).toBeLessThanOrEqual(cfg.islandSize.max);
      }
    }
  });

  it('every landmass is connected for land units', () => {
    for (const map of maps) {
      for (const land of findLandmasses(map)) expect(isPassableConnected(map, land)).toBe(true);
    }
  });

  it('terrain shares, and islands with more hills+forest', () => {
    for (const map of maps) {
      const [main, ...islands] = findLandmasses(map);
      expect(
        Math.abs(share(map, main, 'mountains') - cfg.mainlandTerrain.mountains),
      ).toBeLessThanOrEqual(0.04);
      expect(Math.abs(share(map, main, 'hills') - cfg.mainlandTerrain.hills)).toBeLessThanOrEqual(
        0.04,
      );
      expect(Math.abs(share(map, main, 'forest') - cfg.mainlandTerrain.forest)).toBeLessThanOrEqual(
        0.04,
      );
      const all = islands.flat();
      const rich = (cells: Hex[]) => share(map, cells, 'hills') + share(map, cells, 'forest');
      expect(rich(all)).toBeGreaterThan(rich(main));
    }
  });

  it('mountains form chains', () => {
    let mountains = 0;
    let chained = 0;
    for (const map of maps) {
      map.tiles.forEach((t, i) => {
        if (t !== 'mountains') return;
        mountains++;
        if (neighbors(hexAtIndex(map, i)).some((n) => terrainAt(map, n) === 'mountains')) chained++;
      });
    }
    expect(chained / mountains).toBeGreaterThanOrEqual(0.6);
  });
});

describe('Maps 40x40', () => {
  it('same rules, fast enough', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const t0 = performance.now();
      const { map } = generateMap(seed, { width: 40, height: 40 });
      expect(performance.now() - t0).toBeLessThan(300);
      expect(map.tiles.length).toBe(1600);
      const land = findLandmasses(map);
      expect(land.length - 1).toBeGreaterThanOrEqual(3);
      expect(land.length - 1).toBeLessThanOrEqual(6);
      for (const l of land) expect(isPassableConnected(map, l)).toBe(true);
      expect(land[0].length / 1600).toBeGreaterThanOrEqual(0.42);
      expect(land[0].length / 1600).toBeLessThanOrEqual(0.48);
    }
  });
});
