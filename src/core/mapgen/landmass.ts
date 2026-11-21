// Finding and checking landmasses.

import { TERRAIN } from '../../data/terrain';
import { hexKey, neighbors, type Hex } from '../hex';
import { hexAtIndex, tileIndex } from '../map';
import type { MapState } from '../state';

/** Connected non-water areas, largest first (tie: smallest index first). */
export function findLandmasses(map: MapState): Hex[][] {
  const seen = new Array<boolean>(map.tiles.length).fill(false);
  const result: Hex[][] = [];
  for (let start = 0; start < map.tiles.length; start++) {
    if (seen[start] || TERRAIN[map.tiles[start]].isWater) continue;
    const group: Hex[] = [];
    const queue = [start];
    seen[start] = true;
    for (let head = 0; head < queue.length; head++) {
      const h = hexAtIndex(map, queue[head]);
      group.push(h);
      for (const n of neighbors(h)) {
        const ni = tileIndex(map, n);
        if (ni < 0 || seen[ni] || TERRAIN[map.tiles[ni]].isWater) continue;
        seen[ni] = true;
        queue.push(ni);
      }
    }
    result.push(group);
  }
  // Array.sort is stable: areas of equal size stay in index order.
  return result.sort((a, b) => b.length - a.length);
}

/** Are all non-mountain tiles of the list connected to each other (via tiles of the list)? */
export function isPassableConnected(map: MapState, cells: readonly Hex[]): boolean {
  const passable = new Map<string, Hex>();
  for (const c of cells) {
    if (map.tiles[tileIndex(map, c)] !== 'mountains') passable.set(hexKey(c), c);
  }
  if (passable.size <= 1) return true;
  const first = passable.values().next().value as Hex;
  const seen = new Set<string>([hexKey(first)]);
  const queue = [first];
  for (let head = 0; head < queue.length; head++) {
    for (const n of neighbors(queue[head])) {
      const k = hexKey(n);
      if (!passable.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen.size === passable.size;
}
