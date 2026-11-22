// What the AI knows for its military decisions. Fairness rule: enemy units only count on tiles
// the player currently sees; enemy cities only on tiles the player has explored.

import { distance, hexEquals, neighbors, type Hex } from '../core/hex';
import { hexAtIndex, inBounds, terrainAt, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules';
import type { City, GameState, PlayerId, Unit } from '../core/state';
import { aiConfig, TERRAIN, UNITS } from '../data';
import type { AiContext } from './context';

export interface View {
  ctx: AiContext;
  state: GameState;
  me: PlayerId;
  /** Peace time: no attacks, no capturing. */
  peace: boolean;
  visible: boolean[];
  explored: boolean[];
  /** Own units, ascending id. */
  units: Unit[];
  /** Enemy units on currently visible tiles. */
  enemies: Unit[];
  /** Cities of other alive civilizations whose center tile is explored. */
  enemyCities: City[];
  /** Index of every tile with a known unit (own or visible enemy). */
  occupied: Set<number>;
}

const cache = new WeakMap<AiContext, View>();

export function viewOf(ctx: AiContext): View {
  const cached = cache.get(ctx);
  if (cached) return cached;
  const { state, player } = ctx;
  const visible = visibleTiles(state, player);
  const explored = state.players.find((p) => p.id === player)?.explored ?? [];
  const idx = (h: Hex): number => tileIndex(state.map, h);
  const alive = new Set(state.players.filter((p) => p.alive).map((p) => p.id));
  const units = state.units.filter((u) => u.owner === player).sort((a, b) => a.id - b.id);
  // Enemy ships and their passengers are ignored: the AI only reasons about the land war
  // (seafaring AI comes later). Archers may still shoot ships through `attackTargets`.
  const enemies = state.units.filter(
    (u) =>
      u.owner !== player &&
      u.aboard === null &&
      UNITS[u.type].domain === 'land' &&
      visible[idx(u.hex)],
  );
  const occupied = new Set<number>();
  for (const u of [...units, ...enemies]) occupied.add(idx(u.hex));
  const view: View = {
    ctx,
    state,
    me: player,
    peace: ctx.turn < aiConfig.peaceUntilTurn,
    visible,
    explored,
    units,
    enemies,
    enemyCities: state.cities
      .filter((c) => c.owner !== player && alive.has(c.owner) && explored[idx(c.center)])
      .sort((a, b) => a.id - b.id),
    occupied,
  };
  cache.set(ctx, view);
  return view;
}

export const isCombat = (u: Unit): boolean =>
  u.type === 'spearman' || u.type === 'archer' || u.type === 'hoplite' || u.type === 'horseman';

export const hpShare = (u: Unit): number => u.hp / UNITS[u.type].hp;

/** attack x HP share, the strength measure. */
export const strength = (u: Unit): number => UNITS[u.type].attack * hpShare(u);

export function walkable(state: GameState, h: Hex): boolean {
  if (!inBounds(state.map, h)) return false;
  const t = terrainAt(state.map, h);
  return t !== undefined && TERRAIN[t].moveCost !== null;
}

/** Explored walkable tile without a known unit. */
export function freeKnown(view: View, h: Hex): boolean {
  if (!walkable(view.state, h)) return false;
  const i = tileIndex(view.state.map, h);
  return view.explored[i] && !view.occupied.has(i);
}

export function isEnemyCenter(view: View, h: Hex): boolean {
  return view.enemyCities.some((c) => hexEquals(c.center, h));
}

/** Is the tile inside the player's own territory? */
export function ownTerritory(view: View, h: Hex): boolean {
  const i = tileIndex(view.state.map, h);
  return i >= 0 && view.state.territory[i] === view.me;
}

/** Own city centers. */
export function ownCenters(view: View): Hex[] {
  return view.ctx.cities.map((c) => c.city.center);
}

/** Distance from the hex to the nearest of the given hexes (Infinity if none). */
export function nearestDistance(h: Hex, list: readonly Hex[]): number {
  let best = Infinity;
  for (const o of list) best = Math.min(best, distance(h, o));
  return best;
}

/**
 * Breadth-first search over explored walkable tiles from `from` (units are ignored).
 * Returns the step count per tile index (-1 = not reachable) and the tiles in visiting order.
 */
export function landSearch(view: View, from: Hex): { dist: Int32Array; order: number[] } {
  const map = view.state.map;
  const dist = new Int32Array(map.tiles.length).fill(-1);
  const order: number[] = [];
  const start = tileIndex(map, from);
  if (start < 0) return { dist, order };
  dist[start] = 0;
  let queue = [start];
  while (queue.length > 0) {
    const next: number[] = [];
    for (const i of queue) {
      for (const n of neighbors(hexAtIndex(map, i))) {
        const ni = tileIndex(map, n);
        if (ni < 0 || dist[ni] >= 0 || !view.explored[ni] || !walkable(view.state, n)) continue;
        dist[ni] = dist[i] + 1;
        order.push(ni);
        next.push(ni);
      }
    }
    queue = next;
  }
  return { dist, order };
}
