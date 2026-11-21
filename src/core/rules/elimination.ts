// Players who lose their last city are out of the game (docs/GAME_DESIGN.md, section 10).

import type { GameState, PlayerId } from '../state';
import { addEvent } from './events';

/**
 * Every alive player without a city is out: `alive` = false, its units and training orders
 * are removed, an `eliminated` event is added. Mutates. `except` (the player whose turn
 * starts) is never checked: only captures by others take cities away, and those are
 * caught at the capturer's turn start, so this only spares city-less test states. Returns the players who just went out.
 */
export function eliminatePlayers(state: GameState, except?: PlayerId): PlayerId[] {
  const out: PlayerId[] = [];
  for (const p of state.players) {
    if (!p.alive || p.id === except || state.cities.some((c) => c.owner === p.id)) continue;
    p.alive = false;
    state.units = state.units.filter((u) => u.owner !== p.id);
    state.training = state.training.filter((t) => t.owner !== p.id);
    addEvent(state, {
      type: 'eliminated',
      turn: state.turn,
      player: p.id,
      seenBy: state.players.map((x) => x.id),
    });
    out.push(p.id);
  }
  return out;
}
