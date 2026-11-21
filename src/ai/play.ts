// Runs the AI turns. For now a placeholder: `decide` returns no actions, so AI turns just end.

import { applyAction, type Action } from '../core/actions';
import type { GameState, PlayerId } from '../core/state';

/**
 * While it is an AI civilization's turn (and the human is still in the game): applies the
 * actions `decide` returns (failed ones are skipped), then ends that turn. At most one turn
 * per player per call. Pure like `applyAction`: returns the new state.
 */
export function playAiTurns(
  state: GameState,
  decide: (state: GameState, player: PlayerId) => Action[] = () => [],
): GameState {
  let current = state;
  for (let turns = 0; turns < state.players.length; turns++) {
    const human = current.players.find((p) => p.isHuman);
    if (current.result || !human || !human.alive || current.currentPlayer === human.id) break;
    const player = current.currentPlayer;
    for (const action of decide(current, player)) {
      if (action.type === 'endTurn') continue;
      const result = applyAction(current, action);
      if (result.ok) current = result.state;
    }
    const ended = applyAction(current, { type: 'endTurn' });
    if (!ended.ok) break;
    current = ended.state;
  }
  return current;
}
