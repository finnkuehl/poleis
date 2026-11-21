// endTurn(state): production, consumption, growth, next player.

import { GOOD_IDS, type Goods } from '../data';
import { isPassive, type GameState } from './state';
import { runPopulation } from './rules/population';
import { runProduction } from './rules/production';
import { updateAllExplored } from './rules/vision';
import { captureCities } from './rules/capture';
import { eliminatePlayers } from './rules/elimination';
import { runMoveOrders } from './rules/orders';
import { healAndResetUnits, runUpkeep, spawnUnits } from './rules/units';

/**
 * Ends the current player's turn and returns the new state (the input stays untouched).
 * The turn passes to the next alive, non-passive player in `players` order; when the order
 * wraps around, the turn counter goes up. Then the start-of-turn sequence runs for the
 * new current player. When the human ends the turn, the event list is cleared first.
 */
export function endTurn(state: GameState): GameState {
  const next = structuredClone(state);
  if (next.players.find((p) => p.id === next.currentPlayer)?.isHuman) next.events = [];
  advanceToNextPlayer(next);
  const player = next.currentPlayer;
  const stock = next.players.find((p) => p.id === player)?.goods;
  if (!stock) throw new Error(`Unknown player ${player}`);
  const before = { ...stock };
  // Start of the player's turn (docs/GAME_DESIGN.md, section 2):
  // Units standing on an enemy city center take it over.
  const captured = captureCities(next, player);
  // Players without a city are out of the game.
  eliminatePlayers(next, player);
  // Units first: heal, reset, new units appear.
  healAndResetUnits(next, player);
  const spawned = spawnUnits(next, player);
  // Units with a move order continue walking.
  const orders = runMoveOrders(next, player);
  // Then production, consumption, growth and taxes; the units eat last (after the residents).
  const report = runProduction(next, player);
  report.cities = runPopulation(next, player);
  report.units = { spawned, ...runUpkeep(next, player, stock) };
  // Combined net change of production, population and upkeep.
  const delta: Goods = {};
  for (const id of GOOD_IDS) {
    const d = stock[id] - before[id];
    if (d !== 0) delta[id] = d;
  }
  report.delta = delta;
  report.captured = captured;
  report.orders = orders;
  next.lastReport = report;
  updateAllExplored(next);
  return next;
}

/** Sets `currentPlayer` to the next alive, non-passive player; raises `turn` when the order wraps. */
function advanceToNextPlayer(state: GameState): void {
  const count = state.players.length;
  const index = Math.max(
    0,
    state.players.findIndex((p) => p.id === state.currentPlayer),
  );
  for (let step = 1; step <= count; step++) {
    const candidate = state.players[(index + step) % count];
    if (!candidate.alive || isPassive(candidate)) continue;
    if (index + step >= count) state.turn += 1;
    state.currentPlayer = candidate.id;
    return;
  }
  // Nobody can play: only the counter moves on.
  state.turn += 1;
}
