// Road connection: which buildings are connected to a storage building?

import { BUILDINGS } from '../../data';
import { neighbors } from '../hex';
import { hexAtIndex, inBounds, tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';

/**
 * Breadth-first search from all storage buildings (city center, storehouse) of the player.
 * It moves over road tiles in the player's territory and over the player's buildings.
 * Every building on a reached tile is connected (storages included).
 */
export function connectedBuildingIds(state: GameState, player: PlayerId): Set<number> {
  const own = state.buildings.filter((b) => b.owner === player);
  const byTile = new Map<number, number[]>();
  for (const b of own) {
    const i = tileIndex(state.map, b.hex);
    byTile.set(i, [...(byTile.get(i) ?? []), b.id]);
  }

  const visited = new Set<number>();
  let queue: number[] = [];
  for (const b of own) {
    if (!BUILDINGS[b.type].isStorage) continue;
    const i = tileIndex(state.map, b.hex);
    if (!visited.has(i)) {
      visited.add(i);
      queue.push(i);
    }
  }

  while (queue.length > 0) {
    const next: number[] = [];
    for (const i of queue) {
      for (const n of neighbors(hexAtIndex(state.map, i))) {
        if (!inBounds(state.map, n)) continue;
        const ni = tileIndex(state.map, n);
        if (visited.has(ni)) continue;
        const passable = byTile.has(ni) || (state.roads[ni] && state.territory[ni] === player);
        if (!passable) continue;
        visited.add(ni);
        next.push(ni);
      }
    }
    queue = next;
  }

  const result = new Set<number>();
  for (const [tile, ids] of byTile) if (visited.has(tile)) for (const id of ids) result.add(id);
  return result;
}
