// endTurn(state): production, consumption, growth, next player.

import type { GameState } from './state';
import { runProduction } from './rules/production';

/**
 * Ends the current turn and returns the new state (the input stays untouched).
 * Single player for now: the turn counter goes up and the production of the new turn runs.
 */
export function endTurn(state: GameState): GameState {
  const next = structuredClone(state);
  // M5: the AI civilizations take their turns here (each with the same actions as the human),
  // then `currentPlayer` returns to the human player.
  next.turn += 1;
  // Start of the player's turn (docs/GAME_DESIGN.md, section 2):
  // M3: consumption (food), growth/shrinking and taxes run before/after production.
  next.lastReport = runProduction(next, next.currentPlayer);
  return next;
}
