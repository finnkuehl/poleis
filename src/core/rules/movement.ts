// Unit movement: which tiles a unit can reach this turn (docs/GAME_DESIGN.md, section 7).

import { militaryConfig, TERRAIN } from '../../data';
import { hexEquals, neighbors, reachable, type Hex } from '../hex';
import { inBounds, terrainAt, tileIndex } from '../map';
import type { GameState, Unit } from '../state';

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

/**
 * Movement points needed to enter `to`, or null if the unit cannot enter it.
 * Terrain cost, halved on a road (never below the minimum step cost). Buildings do not block.
 */
export function stepCost(state: GameState, unit: Unit, _from: Hex, to: Hex): number | null {
  if (!isFreeLand(state, to, unit.id)) return null;
  const terrain = terrainAt(state.map, to);
  const base = terrain ? TERRAIN[terrain].moveCost : null;
  if (base === null) return null;
  const onRoad = state.roads[tileIndex(state.map, to)];
  const cost = onRoad ? base * militaryConfig.roadFactor : base;
  return Math.max(militaryConfig.minStepCost, cost);
}

/**
 * Tiles the unit can reach this turn, with the movement points the trip costs.
 * A unit that has not moved yet this turn may always enter one neighboring tile.
 */
export function reachableTiles(state: GameState, unitId: number): { hex: Hex; cost: number }[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return [];
  const result = reachable(unit.hex, (from, to) => stepCost(state, unit, from, to), unit.movesLeft);
  if (!unit.hasMoved) {
    for (const n of neighbors(unit.hex)) {
      if (result.some((r) => hexEquals(r.hex, n))) continue;
      const cost = stepCost(state, unit, unit.hex, n);
      if (cost !== null) result.push({ hex: n, cost });
    }
  }
  return result;
}
