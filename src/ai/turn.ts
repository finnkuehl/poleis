// One AI turn: repeatedly pick the action with the highest utility and apply it.
// Pure and deterministic (no random numbers, no clock): same state in, same state out.

import { applyAction } from '../core/actions';
import { canAfford } from '../core/rules';
import { aiConfig, GOOD_IDS, type Goods, type Stock } from '../data';
import type { GameState, PlayerId } from '../core/state';
import { buildContext } from './context';
import { GENERATORS } from './generators';
import type { Candidate } from './types';

export interface AiTurnStats {
  applied: number;
  failed: number;
}

export interface AiTurnOptions {
  /** Called once at the end of the turn (for tests and debugging). */
  onStats?: (stats: AiTurnStats) => void;
  /** Called for every applied action (for tests and debugging). */
  onAction?: (candidate: Candidate) => void;
}

/** The best candidate that can be done now (ties: the first one generated), or null. */
export function chooseCandidate(
  candidates: readonly Candidate[],
  stock: Stock,
  failed: ReadonlySet<string>,
): Candidate | null {
  const sorted = candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.utility - a.c.utility || a.i - b.i);
  // Goods kept for wishes that are not affordable yet.
  const reserved: Goods = {};
  for (const { c } of sorted) {
    if (c.utility <= aiConfig.minUtility) break;
    if (failed.has(c.key)) continue;
    const cost = c.cost ?? {};
    if (c.action === null || !canAfford(stock, cost)) {
      if (c.reserve) {
        for (const id of GOOD_IDS) if (cost[id]) reserved[id] = (reserved[id] ?? 0) + cost[id];
      }
      continue;
    }
    if (!c.bypassReserve) {
      // The goods must also cover what is reserved and what the AI always keeps.
      const blocked = GOOD_IDS.some(
        (id) =>
          (cost[id] ?? 0) > 0 &&
          stock[id] - (reserved[id] ?? 0) - (aiConfig.keepStock[id] ?? 0) < (cost[id] ?? 0),
      );
      if (blocked) continue;
    }
    return c;
  }
  return null;
}

/** Plays the economy of `player`'s turn (does not end the turn). Returns the new state. */
export function takeAiTurn(
  state: GameState,
  player: PlayerId,
  options: AiTurnOptions = {},
): GameState {
  let current = state;
  const failed = new Set<string>();
  const stats: AiTurnStats = { applied: 0, failed: 0 };
  for (let step = 0; step < aiConfig.maxActionsPerTurn; step++) {
    const ctx = buildContext(current, player);
    const candidates = GENERATORS.flatMap((generate) => generate(ctx));
    const chosen = chooseCandidate(candidates, ctx.stock, failed);
    if (!chosen || !chosen.action) break;
    const result = applyAction(current, chosen.action);
    if (result.ok) {
      current = result.state;
      stats.applied += 1;
      options.onAction?.(chosen);
    } else {
      failed.add(chosen.key);
      stats.failed += 1;
    }
  }
  options.onStats?.(stats);
  return current;
}
