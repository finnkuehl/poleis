// Hilfsfunktionen für die Karte (Index <-> Hex, Terrain-Abfrage).

import type { TerrainId } from '../data/terrain';
import { axialToOffset, offsetToAxial, type Hex } from './hex';
import type { MapState } from './state';

export function inBounds(map: MapState, h: Hex): boolean {
  const { col, row } = axialToOffset(h);
  return col >= 0 && col < map.width && row >= 0 && row < map.height;
}

/** Index in `map.tiles`; -1 wenn das Feld außerhalb der Karte liegt. */
export function tileIndex(map: MapState, h: Hex): number {
  if (!inBounds(map, h)) return -1;
  const { col, row } = axialToOffset(h);
  return row * map.width + col;
}

export function hexAtIndex(map: MapState, index: number): Hex {
  return offsetToAxial({ col: index % map.width, row: Math.floor(index / map.width) });
}

export function terrainAt(map: MapState, h: Hex): TerrainId | undefined {
  const i = tileIndex(map, h);
  return i < 0 ? undefined : map.tiles[i];
}

/** Alle Felder in Index-Reihenfolge. */
export function allHexes(map: MapState): Hex[] {
  const result: Hex[] = [];
  for (let i = 0; i < map.tiles.length; i++) result.push(hexAtIndex(map, i));
  return result;
}
