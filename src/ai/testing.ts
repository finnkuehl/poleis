// TEST-ONLY helpers for the AI tests. Do not import this file from game code.

import { applyAction } from '../core/actions';
import { createGameState, type GameState, type PlayerId } from '../core/state';
import { playAiTurns } from './play';
import { takeAiTurn, type AiTurnStats } from './turn';

export interface SimulationResult {
  state: GameState;
  /** First round (1-based) in which each AI player owned a building of the type. */
  firstRound: (player: PlayerId, building: string) => number | null;
  applied: number;
  failed: number;
  /** Number of AI turns played and the time they took in milliseconds. */
  aiTurns: number;
  ms: number;
}

/**
 * Plays `rounds` rounds: the human only ends the turn, every AI plays with `takeAiTurn`.
 * `onRound(round, state)` is called after each round.
 */
export function simulate(
  seed: string,
  rounds: number,
  options: { aiCount?: number; onRound?: (round: number, state: GameState) => void } = {},
): SimulationResult {
  let state = createGameState(seed, { settings: { aiCount: options.aiCount ?? 3 } });
  const first = new Map<string, number>();
  let applied = 0;
  let failed = 0;
  let aiTurns = 0;
  let ms = 0;
  const stats = (s: AiTurnStats): void => {
    applied += s.applied;
    failed += s.failed;
    aiTurns += 1;
  };
  for (let round = 1; round <= rounds && !state.result; round++) {
    const ended = applyAction(state, { type: 'endTurn' });
    if (!ended.ok) throw new Error('the human could not end the turn');
    const started = performance.now();
    state = playAiTurns(ended.state, (s, player) => takeAiTurn(s, player, { onStats: stats }));
    ms += performance.now() - started;
    for (const b of state.buildings) {
      const k = `${b.owner}:${b.type}`;
      if (!first.has(k)) first.set(k, round);
    }
    options.onRound?.(round, state);
  }
  return {
    state,
    firstRound: (player, building) => first.get(`${player}:${building}`) ?? null,
    applied,
    failed,
    aiTurns,
    ms,
  };
}
