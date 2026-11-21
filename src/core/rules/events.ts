// Game events for the turn summary (docs/GAME_DESIGN.md, section 10). Functions mutate the state.

import type { Hex } from '../hex';
import { inBounds, tileIndex } from '../map';
import type { GameEvent, GameState, PlayerId } from '../state';
import { visibleTiles } from './vision';

/**
 * Who knows about an event: the involved players plus every alive player who currently
 * sees `hex`. Ascending, no duplicates.
 */
export function playersSeeing(state: GameState, hex: Hex, involved: PlayerId[]): PlayerId[] {
  const seen = new Set(involved);
  if (inBounds(state.map, hex)) {
    const i = tileIndex(state.map, hex);
    for (const p of state.players) {
      if (p.alive && !seen.has(p.id) && visibleTiles(state, p.id)[i]) seen.add(p.id);
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** Adds an event to the state. */
export function addEvent(state: GameState, event: GameEvent): void {
  state.events.push(event);
}
