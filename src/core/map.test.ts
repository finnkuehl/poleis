import { describe, expect, it } from 'vitest';
import { hex } from './hex';
import { allHexes, hexAtIndex, inBounds, terrainAt, tileIndex } from './map';
import type { MapState } from './state';

const map: MapState = {
  width: 3,
  height: 2,
  tiles: ['ocean', 'coast', 'plains', 'forest', 'hills', 'mountains'],
};

describe('map', () => {
  it('Index und Hex sind umkehrbar', () => {
    for (let i = 0; i < map.tiles.length; i++) expect(tileIndex(map, hexAtIndex(map, i))).toBe(i);
  });
  it('Grenzen und Terrain-Abfrage', () => {
    expect(inBounds(map, hex(0, 0))).toBe(true);
    expect(tileIndex(map, hex(-1, 0))).toBe(-1);
    expect(terrainAt(map, hex(-1, 0))).toBeUndefined();
    expect(terrainAt(map, hexAtIndex(map, 4))).toBe('hills');
    expect(allHexes(map)).toHaveLength(6);
  });
});
