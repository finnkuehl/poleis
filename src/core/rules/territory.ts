// Territory: which tile belongs to which player.

import { range, type Hex } from '../hex';
import { inBounds, tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';

/**
 * Claims all tiles within `radius` of `center` that nobody owns yet (first claim wins).
 * `cityId` is the city the tiles belong to (-1 = none); it is written to `tileCity`
 * for every tile that has no city yet. Mutates.
 */
export function claimTerritory(
  state: GameState,
  center: Hex,
  radius: number,
  owner: PlayerId,
  cityId = -1,
): void {
  for (const h of range(center, radius)) {
    if (!inBounds(state.map, h)) continue;
    const i = tileIndex(state.map, h);
    if (state.territory[i] === -1) state.territory[i] = owner;
    if (cityId >= 0 && state.territory[i] === owner && state.tileCity[i] === -1) {
      state.tileCity[i] = cityId;
    }
  }
}

/** Owner of the tile; -1 = nobody or outside the map. */
export function ownerAt(state: GameState, h: Hex): number {
  const i = tileIndex(state.map, h);
  return i < 0 ? -1 : state.territory[i];
}
