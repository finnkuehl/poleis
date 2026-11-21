// Multi-turn move orders (docs/GAME_DESIGN.md, section 7: move orders).
// A unit with an order walks as far as it can each turn along the cheapest path.

import { militaryConfig, TERRAIN, UNITS, type UnitId } from '../../data';
import { distance, findPath, hexEquals, type Hex } from '../hex';
import { inBounds, terrainAt, tileIndex } from '../map';
import type { GameState, PlayerId, Unit } from '../state';
import { updateCapturing } from './capture';
import type { RuleError } from './errors';
import { hiddenEnemyIds, stepCost } from './movement';
import { updateExplored, visibleTiles } from './vision';

/** Where a unit stands at the end of a turn's walk. */
export interface OrderStop {
  hex: Hex;
  /** 0 = this turn, 1 = after next turn's walk, ... */
  turn: number;
}

export interface OrderPlan {
  /** All tiles from the unit's tile to the destination, both included. */
  path: Hex[];
  /** Where the unit stands at the end of each turn's walk, in order; the last one is the destination. A turn in which it cannot move has no stop. */
  stops: OrderStop[];
  /** Turn of the last stop = turns until arrival (0 = arrives this turn). */
  turns: number;
}

export type OrderOutcome = 'underway' | 'arrived' | 'blocked' | 'enemySpotted';

export interface OrderReport {
  unitId: number;
  unitType: UnitId;
  outcome: Exclude<OrderOutcome, 'underway'>;
}

/**
 * Number of steps along `costs` (cost of entering each next path tile) that fit into one turn.
 * A unit that has not moved yet this turn may always make one step (1-tile rule).
 */
function stepsThisTurn(
  costs: number[],
  from: number,
  movesLeft: number,
  hasMoved: boolean,
): number {
  let moves = movesLeft;
  let moved = hasMoved;
  let steps = 0;
  for (let i = from; i < costs.length; i++) {
    const cost = costs[i];
    if (cost <= moves) moves -= cost;
    else if (!moved) moves = Math.max(0, moves - cost);
    else break;
    moved = true;
    steps++;
  }
  return steps;
}

/** Plans the walk to `to` without changing anything. */
export function planMoveOrder(
  state: GameState,
  unitId: number,
  to: Hex,
): { ok: true; plan: OrderPlan } | { ok: false; error: RuleError } {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: { code: 'notOwnUnit' } };
  const noPath = { ok: false as const, error: { code: 'noPath' as const } };
  if (hexEquals(unit.hex, to) || !inBounds(state.map, to)) return noPath;
  if (!state.players[unit.owner]?.explored[tileIndex(state.map, to)]) return noPath;
  const terrain = terrainAt(state.map, to);
  if (!terrain || TERRAIN[terrain].moveCost === null) return noPath;
  const hidden = hiddenEnemyIds(state, unit);
  if (state.units.some((u) => u.id !== unit.id && hexEquals(u.hex, to) && !hidden.has(u.id))) {
    return { ok: false, error: { code: 'destinationOccupied' } };
  }
  const found = findPath(unit.hex, to, (a, b) => stepCost(state, unit, a, b, hidden), {
    minStepCost: militaryConfig.minStepCost,
  });
  if (!found) return noPath;
  const path = found.path;
  const costs: number[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    costs.push(stepCost(state, unit, path[i], path[i + 1], hidden) ?? 0);
  }
  const stops: OrderStop[] = [];
  let idx = 0;
  let turn = 0;
  while (idx < costs.length) {
    const steps =
      turn === 0
        ? unit.attacked
          ? 0
          : stepsThisTurn(costs, idx, unit.movesLeft, unit.hasMoved)
        : stepsThisTurn(costs, idx, UNITS[unit.type].movement, false);
    idx += steps;
    if (steps > 0) stops.push({ hex: path[idx], turn });
    if (idx < costs.length) turn++;
  }
  return { ok: true, plan: { path, stops, turns: turn } };
}

/** Ids of enemy units within the unit's vision, ascending. */
export function enemiesInSight(state: GameState, unit: Unit): number[] {
  return state.units
    .filter((u) => u.owner !== unit.owner && distance(u.hex, unit.hex) <= militaryConfig.visionUnit)
    .map((u) => u.id)
    .sort((a, b) => a - b);
}

/**
 * Walks this turn's part of the unit's order. Mutates the state.
 * Callers only call it for units with an order (without one it does nothing).
 */
export function walkOrder(state: GameState, unit: Unit): OrderOutcome {
  const order = unit.order;
  if (!order) return 'underway';
  const isNew = (id: number) => !order.seenEnemies.includes(id);
  if (enemiesInSight(state, unit).some(isNew)) {
    unit.order = null;
    return 'enemySpotted';
  }
  const planned = planMoveOrder(state, unit.id, order.to);
  if (!planned.ok) {
    unit.order = null;
    return 'blocked';
  }
  const { path } = planned.plan;
  const hidden = hiddenEnemyIds(state, unit);
  for (let i = 1; i < path.length && !unit.attacked; i++) {
    const next = path[i];
    const cost = stepCost(state, unit, unit.hex, next, hidden);
    if (cost === null) {
      unit.order = null;
      return 'blocked';
    }
    if (cost > unit.movesLeft && unit.hasMoved) break;
    // Any unit, also an unseen one, stops the walk in front of it.
    if (state.units.some((u) => u.id !== unit.id && hexEquals(u.hex, next))) {
      unit.order = null;
      return 'blocked';
    }
    unit.hex = next;
    unit.movesLeft = Math.max(0, unit.movesLeft - cost);
    unit.hasMoved = true;
    unit.acted = true;
    updateCapturing(state, unit);
    updateExplored(state, unit.owner);
    if (enemiesInSight(state, unit).some(isNew)) {
      unit.order = null;
      return 'enemySpotted';
    }
  }
  if (hexEquals(unit.hex, order.to)) {
    unit.order = null;
    return 'arrived';
  }
  return 'underway';
}

/** Walks the orders of all units of the player (ascending unit id). Mutates the state. */
export function runMoveOrders(state: GameState, player: PlayerId): OrderReport[] {
  const reports: OrderReport[] = [];
  const units = state.units
    .filter((u) => u.owner === player && u.order)
    .sort((a, b) => a.id - b.id);
  for (const unit of units) {
    const outcome = walkOrder(state, unit);
    if (outcome !== 'underway') reports.push({ unitId: unit.id, unitType: unit.type, outcome });
  }
  return reports;
}

/** Gives the unit an order and walks this turn's part right away. Mutates the state. */
export function setMoveOrder(
  state: GameState,
  player: PlayerId,
  unitId: number,
  to: Hex,
): RuleError | null {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.owner !== player) return { code: 'notOwnUnit' };
  const planned = planMoveOrder(state, unitId, to);
  if (!planned.ok) return planned.error;
  const visible = visibleTiles(state, player);
  unit.order = {
    to,
    seenEnemies: state.units
      .filter((u) => u.owner !== player && visible[tileIndex(state.map, u.hex)])
      .map((u) => u.id)
      .sort((a, b) => a - b),
  };
  walkOrder(state, unit);
  return null;
}
