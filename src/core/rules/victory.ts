// Victory and defeat (docs/GAME_DESIGN.md, section 10). All functions mutate the state and
// never overwrite an existing `result`.

import type { GameResult, GameState, PlayerId } from '../state';
import { scoreboard } from './score';

function setResult(state: GameState, result: GameResult): void {
  if (!state.result) state.result = result;
}

/**
 * After the eliminations: the human is out -> defeat; else, with the conquest victory on,
 * the last alive civilization wins. (Needs at least two players in the game.)
 */
export function checkEliminationResult(state: GameState): void {
  const human = state.players.find((p) => p.isHuman);
  if (human && !human.alive) {
    setResult(state, { winner: null, reason: 'eliminated', turn: state.turn });
    return;
  }
  if (!state.settings.victory.conquest || state.players.length < 2) return;
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 1) {
    setResult(state, { winner: alive[0].id, reason: 'conquest', turn: state.turn });
  }
}

/** A wonder was completed: with the wonder victory on, its owner wins. */
export function declareWonderVictory(state: GameState, owner: PlayerId): void {
  if (!state.settings.victory.wonder) return;
  setResult(state, { winner: owner, reason: 'wonder', turn: state.turn });
}

/** True if the points victory is on and `turn` (the turn counter) is past the turn limit. */
export function pastTurnLimit(state: GameState, turn: number): boolean {
  return state.settings.victory.points && turn > state.settings.turnLimit;
}

/** Ends the game on points: the best alive player of the scoreboard wins. */
export function declarePointsVictory(state: GameState, turn: number): void {
  const best = scoreboard(state).find((r) => r.alive);
  setResult(state, { winner: best ? best.player : null, reason: 'points', turn });
}
