// Unit movement: which tiles a unit can reach this turn (docs/GAME_DESIGN.md, section 7).

import { militaryConfig, TERRAIN } from '../../data';
import { hexEquals, neighbors, reachable, type Hex } from '../hex';
import { inBounds, terrainAt, tileIndex } from '../map';
import type { GameState, Unit } from '../state';
import { visibleTiles } from './vision';

/** Is there any unit on the tile? */
export function unitAt(state: GameState, h: Hex): Unit | undefined {
  return state.units.find((u) => hexEquals(u.hex, h));
}

/** Can a land unit stand on the tile (walkable terrain, nobody else there)? */
export function isFreeLand(state: GameState, h: Hex, ignoreUnitId = -1): boolean {
  if (!inBounds(state.map, h)) return false;
  const terrain = terrainAt(state.map, h);
  if (!terrain || TERRAIN[terrain].moveCost === null) return false;
  return !state.units.some((u) => u.id !== ignoreUnitId && hexEquals(u.hex, h));
}

/** Options for movement queries. */
export interface ReachOptions {
  /** Display only: enemy units on tiles the owner cannot currently see do not block. */
  ignoreHiddenUnits?: boolean;
}

/** Ids of enemy units the owner cannot currently see (they must not leak through the highlights). */
function hiddenEnemyIds(state: GameState, unit: Unit): Set<number> {
  const visible = visibleTiles(state, unit.owner);
  const ids = new Set<number>();
  for (const u of state.units) {
    if (u.owner === unit.owner) continue;
    if (!visible[tileIndex(state.map, u.hex)]) ids.add(u.id);
  }
  return ids;
}

/**
 * Movement points needed to enter `to`, or null if the unit cannot enter it.
 * Only tiles explored by the unit's owner can be entered (the fog reveals nothing).
 * Terrain cost, halved on a road (never below the minimum step cost). Buildings do not block.
 */
export function stepCost(
  state: GameState,
  unit: Unit,
  _from: Hex,
  to: Hex,
  ignoredUnitIds?: ReadonlySet<number>,
): number | null {
  if (!inBounds(state.map, to)) return null;
  const i = tileIndex(state.map, to);
  if (!state.players[unit.owner]?.explored[i]) return null;
  const terrain = terrainAt(state.map, to);
  const base = terrain ? TERRAIN[terrain].moveCost : null;
  if (base === null) return null;
  const blocked = state.units.some(
    (u) => u.id !== unit.id && hexEquals(u.hex, to) && !ignoredUnitIds?.has(u.id),
  );
  if (blocked) return null;
  const onRoad = state.roads[i];
  const cost = onRoad ? base * militaryConfig.roadFactor : base;
  return Math.max(militaryConfig.minStepCost, cost);
}

/**
 * Tiles the unit can reach this turn, with the movement points the trip costs.
 * A unit that has not moved yet this turn may always enter one neighboring tile.
 * A unit that has attacked this turn reaches nothing.
 */
export function reachableTiles(
  state: GameState,
  unitId: number,
  opts: ReachOptions = {},
): { hex: Hex; cost: number }[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.attacked) return [];
  const ignored = opts.ignoreHiddenUnits ? hiddenEnemyIds(state, unit) : undefined;
  const result = reachable(
    unit.hex,
    (from, to) => stepCost(state, unit, from, to, ignored),
    unit.movesLeft,
  );
  if (!unit.hasMoved) {
    for (const n of neighbors(unit.hex)) {
      if (result.some((r) => hexEquals(r.hex, n))) continue;
      const cost = stepCost(state, unit, unit.hex, n, ignored);
      if (cost !== null) result.push({ hex: n, cost });
    }
  }
  return result;
}
