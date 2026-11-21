// Territory: which tile belongs to which player.

import { range, type Hex } from '../hex';
import { inBounds, tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';

/** Claims all tiles within `radius` of `center` that nobody owns yet (first claim wins). Mutates. */
export function claimTerritory(
  state: GameState,
  center: Hex,
  radius: number,
  owner: PlayerId,
): void {
  for (const h of range(center, radius)) {
    if (!inBounds(state.map, h)) continue;
    const i = tileIndex(state.map, h);
    if (state.territory[i] === -1) state.territory[i] = owner;
  }
}

/** Owner of the tile; -1 = nobody or outside the map. */
export function ownerAt(state: GameState, h: Hex): number {
  const i = tileIndex(state.map, h);
  return i < 0 ? -1 : state.territory[i];
}
