// endTurn(state): production, consumption, growth, next player.

import { GOOD_IDS, type Goods } from '../data';
import type { GameState } from './state';
import { runPopulation } from './rules/population';
import { runProduction } from './rules/production';
import { updateAllExplored } from './rules/vision';
import { captureCities } from './rules/capture';
import { healAndResetUnits, runUpkeep, spawnUnits } from './rules/units';

/**
 * Ends the current turn and returns the new state (the input stays untouched).
 * Single player for now: the turn counter goes up, then production and population run.
 */
export function endTurn(state: GameState): GameState {
  const next = structuredClone(state);
  // M5: the AI civilizations take their turns here (each with the same actions as the human),
  // then `currentPlayer` returns to the human player.
  next.turn += 1;
  const player = next.currentPlayer;
  const stock = next.players.find((p) => p.id === player)?.goods;
  if (!stock) throw new Error(`Unknown player ${player}`);
  const before = { ...stock };
  // Start of the player's turn (docs/GAME_DESIGN.md, section 2):
  // Units standing on an enemy city center take it over.
  const captured = captureCities(next, player);
  // Units first: heal, reset, new units appear.
  healAndResetUnits(next, player);
  const spawned = spawnUnits(next, player);
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
  next.lastReport = report;
  updateAllExplored(next);
  return next;
}
