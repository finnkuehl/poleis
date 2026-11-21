// Road planning: cheapest path (fewest new road tiles) between two tiles.

import { economyConfig, TERRAIN, type Goods } from '../../data';
import { hexEquals, findPath, type Hex } from '../hex';
import { inBounds, tileIndex, terrainAt } from '../map';
import type { GameState, PlayerId } from '../state';
import type { RuleError } from './errors';
import { ownerAt } from './territory';

export interface RoadPlan {
  /** All tiles from start to target, both included. */
  path: Hex[];
  /** Path tiles that need a new road (no road and no building yet). */
  newTiles: Hex[];
  /** Total cost of the new road tiles. */
  cost: Goods;
}

export type RoadPlanResult = { ok: true; plan: RoadPlan } | { ok: false; error: RuleError };

/** Own territory, walkable land, and no building of another player. */
function usable(state: GameState, player: PlayerId, h: Hex): boolean {
  if (!inBounds(state.map, h)) return false;
  if (ownerAt(state, h) !== player) return false;
  const terrain = terrainAt(state.map, h);
  if (!terrain || TERRAIN[terrain].moveCost === null) return false;
  return state.buildings.every((b) => b.owner === player || !hexEquals(b.hex, h));
}

export function planRoad(state: GameState, player: PlayerId, from: Hex, to: Hex): RoadPlanResult {
  if (!usable(state, player, from) || !usable(state, player, to)) {
    return { ok: false, error: { code: 'roadNotAllowed' } };
  }
  const hasBuilding = (h: Hex): boolean => state.buildings.some((b) => hexEquals(b.hex, h));
  const result = findPath(
    from,
    to,
    (_a, b) => {
      if (!usable(state, player, b)) return null;
      // Existing roads and buildings are free, every other tile is one new road tile.
      return state.roads[tileIndex(state.map, b)] || hasBuilding(b) ? 0 : 1;
    },
    { minStepCost: 0 },
  );
  if (!result) return { ok: false, error: { code: 'noPath' } };

  const newTiles = result.path.filter(
    (h) => !state.roads[tileIndex(state.map, h)] && !hasBuilding(h),
  );
  const cost: Goods = {};
  if (newTiles.length > 0) {
    for (const [id, amount] of Object.entries(economyConfig.roadCost)) {
      cost[id as keyof Goods] = amount * newTiles.length;
    }
  }
  return { ok: true, plan: { path: result.path, newTiles, cost } };
}
