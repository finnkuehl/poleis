// Runs the AI turns of all AI civilizations after the human ended their turn.

import { applyAction } from '../core/actions';
import type { GameState, PlayerId } from '../core/state';
import { takeAiTurn } from './turn';

/**
 * While it is an AI civilization's turn (and the human is still in the game): lets
 * `takeTurn` play the turn (it sees the result of its own actions), then ends that turn.
 * At most one turn per player per call. Pure like `applyAction`: returns the new state.
 */
export function playAiTurns(
  state: GameState,
  takeTurn: (state: GameState, player: PlayerId) => GameState = takeAiTurn,
): GameState {
  let current = state;
  for (let turns = 0; turns < state.players.length; turns++) {
    const human = current.players.find((p) => p.isHuman);
    if (current.result || !human || !human.alive || current.currentPlayer === human.id) break;
    current = takeTurn(current, current.currentPlayer);
    const ended = applyAction(current, { type: 'endTurn' });
    if (!ended.ok) break;
    current = ended.state;
  }
  return current;
}
