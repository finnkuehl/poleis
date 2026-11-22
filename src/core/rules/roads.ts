// Road planning: cheapest path (fewest new road tiles) between two tiles.

import { BUILDINGS, economyConfig, TERRAIN, type Goods } from '../../data';
import { hexEquals, findPath, neighbors, type Hex } from '../hex';
import { hexAtIndex, inBounds, tileIndex, terrainAt } from '../map';
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

/**
 * Own territory and no building of another player. Walkable land is required,
 * except on a tile with one of the player's own buildings (e.g. a mine on a mountain).
 */
function usable(state: GameState, player: PlayerId, h: Hex): boolean {
  if (!inBounds(state.map, h)) return false;
  if (ownerAt(state, h) !== player) return false;
  if (state.buildings.some((b) => b.owner === player && hexEquals(b.hex, h))) return true;
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

/** `RoadField.dist` of a tile that cannot reach the network. */
export const ROAD_UNREACHABLE = 1 << 20;

/** The road network of a player and the cheapest way to it from every tile. */
export interface RoadField {
  /** Per tile index: part of the connected network (same rule as `connectedBuildingIds`). */
  connected: boolean[];
  /** Per tile index: new road tiles needed to reach the network (`ROAD_UNREACHABLE` = no way). */
  dist: Int32Array;
  /** Per tile index: the previous tile on the cheapest way to the network (-1 = none). */
  parent: Int32Array;
}

/**
 * Breadth-first search over the connected network, then a 0-1 breadth-first search outwards
 * (existing roads and own buildings cost 0, every other usable tile costs 1 new road tile).
 */
export function roadField(state: GameState, player: PlayerId): RoadField {
  const map = state.map;
  const own = state.buildings.filter((b) => b.owner === player);
  const hasOwnBuilding = map.tiles.map(() => false);
  for (const b of own) hasOwnBuilding[tileIndex(map, b.hex)] = true;

  // The connected network.
  const connected = map.tiles.map(() => false);
  let queue: number[] = [];
  for (const b of own) {
    if (!BUILDINGS[b.type].isStorage) continue;
    const i = tileIndex(map, b.hex);
    if (!connected[i]) {
      connected[i] = true;
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const next: number[] = [];
    for (const i of queue) {
      for (const n of neighbors(hexAtIndex(map, i))) {
        if (!inBounds(map, n)) continue;
        const ni = tileIndex(map, n);
        if (connected[ni]) continue;
        if (!(hasOwnBuilding[ni] || (state.roads[ni] && state.territory[ni] === player))) continue;
        connected[ni] = true;
        next.push(ni);
      }
    }
    queue = next;
  }

  // The cheapest way to the network.
  const passable = (i: number): boolean =>
    state.territory[i] === player && (hasOwnBuilding[i] || TERRAIN[map.tiles[i]].moveCost !== null);
  const dist = new Int32Array(map.tiles.length).fill(ROAD_UNREACHABLE);
  const parent = new Int32Array(map.tiles.length).fill(-1);
  const levels: number[][] = [[]];
  for (let i = 0; i < connected.length; i++) {
    if (connected[i]) {
      dist[i] = 0;
      levels[0].push(i);
    }
  }
  for (let d = 0; d < levels.length; d++) {
    const level = levels[d];
    for (let k = 0; k < level.length; k++) {
      const i = level[k];
      if (dist[i] !== d) continue;
      for (const n of neighbors(hexAtIndex(map, i))) {
        if (!inBounds(map, n)) continue;
        const ni = tileIndex(map, n);
        if (!passable(ni)) continue;
        const nd = d + (state.roads[ni] || hasOwnBuilding[ni] ? 0 : 1);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          parent[ni] = i;
          (levels[nd] ??= []).push(ni);
        }
      }
    }
  }
  return { connected, dist, parent };
}

/**
 * Road tiles needed to connect a building standing on `hex`: `cost` 0 with `target` null means
 * it already touches the network; otherwise `target` is the connected tile where the new road
 * ends. Null when the network cannot be reached.
 */
export function roadConnection(
  state: GameState,
  field: RoadField,
  hex: Hex,
): { cost: number; target: Hex | null } | null {
  const map = state.map;
  if (tileIndex(map, hex) < 0) return null;
  let best = -1;
  for (const n of neighbors(hex)) {
    if (!inBounds(map, n)) continue;
    const ni = tileIndex(map, n);
    if (field.dist[ni] >= ROAD_UNREACHABLE) continue;
    if (field.connected[ni]) return { cost: 0, target: null };
    if (best < 0 || field.dist[ni] < field.dist[best]) best = ni;
  }
  if (best < 0) return null;
  // Follow the parents to the connected tile where the new road ends.
  let at = best;
  while (field.parent[at] >= 0 && !field.connected[at]) at = field.parent[at];
  return { cost: field.dist[best], target: hexAtIndex(map, at) };
}
