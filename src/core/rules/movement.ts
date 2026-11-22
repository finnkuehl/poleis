// Unit movement: which tiles a unit can reach this turn (docs/GAME_DESIGN.md, section 7).
// Land units walk on land, ships sail on water. A land unit boards an adjacent own transport
// ship and a passenger lands on an adjacent free land tile; both end its move (M6 rules).

import { militaryConfig, TERRAIN, UNITS } from '../../data';
import { hexEquals, neighbors, reachable, type Hex } from '../hex';
import { inBounds, terrainAt, tileIndex } from '../map';
import type { GameState, Unit } from '../state';
import { visibleTiles } from './vision';

/** The unit standing on the tile (passengers are not counted: they ride on a ship). */
export function unitAt(state: GameState, h: Hex): Unit | undefined {
  return state.units.find((u) => u.aboard === null && hexEquals(u.hex, h));
}

/** The units aboard the ship, ascending id. */
export function passengersOf(state: GameState, shipId: number): Unit[] {
  return state.units.filter((u) => u.aboard === shipId).sort((a, b) => a.id - b.id);
}

/** Is the unit a ship (sails on water)? */
export function isShip(unit: Unit): boolean {
  return UNITS[unit.type].domain === 'sea';
}

/** Is the tile a water tile (coast or ocean) inside the map? */
export function isWaterTile(state: GameState, h: Hex): boolean {
  if (!inBounds(state.map, h)) return false;
  const terrain = terrainAt(state.map, h);
  return terrain !== undefined && TERRAIN[terrain].isWater;
}

/** Can a ship sail onto the tile (water tile, no other unit on it)? */
export function isFreeWater(state: GameState, h: Hex, ignoreUnitId = -1): boolean {
  if (!isWaterTile(state, h)) return false;
  return !state.units.some(
    (u) => u.id !== ignoreUnitId && u.aboard === null && hexEquals(u.hex, h),
  );
}

/** Can a land unit stand on the tile (walkable terrain, nobody else there)? */
export function isFreeLand(state: GameState, h: Hex, ignoreUnitId = -1): boolean {
  if (!inBounds(state.map, h)) return false;
  const terrain = terrainAt(state.map, h);
  if (!terrain || TERRAIN[terrain].moveCost === null) return false;
  return !state.units.some(
    (u) => u.id !== ignoreUnitId && u.aboard === null && hexEquals(u.hex, h),
  );
}

/** Moves the unit to the tile; the passengers of a ship travel along. Mutates. */
export function moveUnitTo(state: GameState, unit: Unit, to: Hex): void {
  unit.hex = to;
  for (const p of state.units) if (p.aboard === unit.id) p.hex = to;
}

/**
 * Removes dead units (0 HP or less) and the passengers of ships that are gone. Mutates.
 * Returns how many units were removed.
 */
export function pruneUnits(state: GameState): number {
  const before = state.units.length;
  let units = state.units.filter((u) => u.hp > 0);
  const ids = new Set(units.map((u) => u.id));
  units = units.filter((u) => u.aboard === null || ids.has(u.aboard));
  state.units = units;
  return before - units.length;
}

/** Options for movement queries. */
export interface ReachOptions {
  /** Display only: enemy units on tiles the owner cannot currently see do not block. */
  ignoreHiddenUnits?: boolean;
}

/** One tile a unit can move to. `kind` is set for the two steps that end the move. */
export interface ReachTile {
  hex: Hex;
  cost: number;
  /** 'board' = onto an own transport ship, 'land' = off a ship onto land (both end the move). */
  kind?: 'board' | 'land';
}

/** Ids of enemy units the owner cannot currently see (they must not leak through the highlights). */
export function hiddenEnemyIds(state: GameState, unit: Unit): Set<number> {
  const visible = visibleTiles(state, unit.owner);
  const ids = new Set<number>();
  for (const u of state.units) {
    if (u.owner === unit.owner) continue;
    if (!visible[tileIndex(state.map, u.hex)]) ids.add(u.id);
  }
  return ids;
}

/**
 * Movement points needed to enter `to`, or null if the unit cannot enter it by walking/sailing.
 * Only tiles explored by the unit's owner can be entered (the fog reveals nothing).
 * Land units: terrain cost, halved on a road (never below the minimum step cost); buildings do
 * not block. Ships: `seaStepCost` per water tile. Passengers never move by themselves, and
 * boarding / landing is not a normal step (see `reachableTiles`).
 */
export function stepCost(
  state: GameState,
  unit: Unit,
  _from: Hex,
  to: Hex,
  ignoredUnitIds?: ReadonlySet<number>,
): number | null {
  if (unit.aboard !== null) return null;
  if (!inBounds(state.map, to)) return null;
  const i = tileIndex(state.map, to);
  if (!state.players[unit.owner]?.explored[i]) return null;
  const terrain = terrainAt(state.map, to);
  if (!terrain) return null;
  const sea = isShip(unit);
  if (sea && !TERRAIN[terrain].isWater) return null;
  const base = sea ? militaryConfig.seaStepCost : TERRAIN[terrain].moveCost;
  if (base === null) return null;
  const blocked = state.units.some(
    (u) =>
      u.id !== unit.id && u.aboard === null && hexEquals(u.hex, to) && !ignoredUnitIds?.has(u.id),
  );
  if (blocked) return null;
  if (sea) return base;
  const cost = state.roads[i] ? base * militaryConfig.roadFactor : base;
  return Math.max(militaryConfig.minStepCost, cost);
}

/** Can the transport ship take one more passenger? */
export function hasFreeCapacity(state: GameState, ship: Unit): boolean {
  return passengersOf(state, ship.id).length < UNITS[ship.type].capacity;
}

/**
 * The one-step moves that end the move: a land unit onto an adjacent own transport ship with
 * room, a passenger onto an adjacent free land tile (explored, walkable, nobody there).
 */
function transitionTiles(
  state: GameState,
  unit: Unit,
  ignored: ReadonlySet<number> | undefined,
): ReachTile[] {
  const out: ReachTile[] = [];
  if (isShip(unit) || (unit.movesLeft <= 0 && unit.hasMoved)) return out;
  const explored = state.players[unit.owner]?.explored;
  for (const n of neighbors(unit.hex)) {
    if (!inBounds(state.map, n)) continue;
    const i = tileIndex(state.map, n);
    if (!explored?.[i]) continue;
    const occupant = state.units.find(
      (u) => u.aboard === null && hexEquals(u.hex, n) && !ignored?.has(u.id),
    );
    if (unit.aboard === null) {
      // Board: own transport ship with free capacity.
      if (
        occupant &&
        occupant.owner === unit.owner &&
        UNITS[occupant.type].capacity > 0 &&
        hasFreeCapacity(state, occupant)
      ) {
        out.push({ hex: n, cost: militaryConfig.minStepCost, kind: 'board' });
      }
    } else if (!occupant) {
      // Land: free walkable land.
      const terrain = terrainAt(state.map, n);
      const base = terrain ? TERRAIN[terrain].moveCost : null;
      if (base !== null && base !== undefined) {
        out.push({ hex: n, cost: Math.max(militaryConfig.minStepCost, base), kind: 'land' });
      }
    }
  }
  return out;
}

/**
 * Tiles the unit can reach this turn, with the movement points the trip costs.
 * A unit that has not moved yet this turn may always enter one neighboring tile.
 * A unit that has attacked this turn reaches nothing.
 * Boarding a ship and landing are single steps (`kind`), not part of a longer walk.
 */
export function reachableTiles(
  state: GameState,
  unitId: number,
  opts: ReachOptions = {},
): ReachTile[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.attacked) return [];
  const ignored = opts.ignoreHiddenUnits ? hiddenEnemyIds(state, unit) : undefined;
  // Passengers can only land.
  if (unit.aboard !== null) return transitionTiles(state, unit, ignored);
  const result: ReachTile[] = reachable(
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
  result.push(...transitionTiles(state, unit, ignored));
  return result;
}
