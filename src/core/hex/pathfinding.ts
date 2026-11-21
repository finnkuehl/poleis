// A* pathfinding on the hex grid.
// Generic on purpose: the caller decides what a step costs (terrain, roads, ...).
// Used for roads in M2 and for unit movement in M4.

import { distance, hexKey, neighbors, type Hex } from './coords';

export interface PathResult {
  /** All tiles from start to goal, both included. */
  path: Hex[];
  /** Sum of all step costs along the path. */
  cost: number;
}

export interface PathOptions {
  /**
   * Lowest cost any single step can have. It scales the heuristic (straight-line distance).
   * Must never be larger than the real cheapest step, otherwise paths may not be optimal.
   * Default 0 = no heuristic (plain Dijkstra), which is always correct, also with 0-cost steps (roads).
   */
  minStepCost?: number;
  /** Do not explore paths that are more expensive than this. */
  maxCost?: number;
}

interface HeapEntry {
  hex: Hex;
  g: number;
  h: number;
  f: number;
  /** Insertion counter: makes the order fully deterministic. */
  seq: number;
}

/** Order: lower f first, then lower h, then older entry. */
function isBefore(a: HeapEntry, b: HeapEntry): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.h !== b.h) return a.h < b.h;
  return a.seq < b.seq;
}

/** Small binary min-heap (no dependency needed). */
class MinHeap {
  private items: HeapEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: HeapEntry): void {
    const items = this.items;
    items.push(entry);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!isBefore(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop(): HeapEntry {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as HeapEntry;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < items.length && isBefore(items[l], items[best])) best = l;
        if (r < items.length && isBefore(items[r], items[best])) best = r;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }
}

/**
 * Cheapest path from `start` to `goal`.
 * `stepCost(from, to)` = cost (>= 0) to enter `to` coming from `from`, or null if `to` cannot be entered.
 * Returns null if the goal cannot be reached (within `maxCost`).
 * Deterministic: same input = same path (ties are broken by a fixed rule).
 */
export function findPath(
  start: Hex,
  goal: Hex,
  stepCost: (from: Hex, to: Hex) => number | null,
  options: PathOptions = {},
): PathResult | null {
  const minStep = options.minStepCost ?? 0;
  const maxCost = options.maxCost ?? Infinity;
  const startKey = hexKey(start);
  const goalKey = hexKey(goal);
  if (startKey === goalKey) return { path: [start], cost: 0 };

  const bestCost = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, Hex>();
  const done = new Set<string>();
  const open = new MinHeap();
  let seq = 0;
  const h0 = distance(start, goal) * minStep;
  open.push({ hex: start, g: 0, h: h0, f: h0, seq: seq++ });

  while (open.size > 0) {
    const cur = open.pop();
    const curKey = hexKey(cur.hex);
    // Outdated heap entry (a cheaper way to this tile was found later).
    if (done.has(curKey)) continue;
    done.add(curKey);

    if (curKey === goalKey) {
      const path: Hex[] = [cur.hex];
      let key = curKey;
      while (key !== startKey) {
        const prev = cameFrom.get(key) as Hex;
        path.push(prev);
        key = hexKey(prev);
      }
      path.reverse();
      return { path, cost: cur.g };
    }

    for (const next of neighbors(cur.hex)) {
      const nextKey = hexKey(next);
      if (done.has(nextKey)) continue;
      const step = stepCost(cur.hex, next);
      if (step === null) continue;
      const g = cur.g + step;
      if (g > maxCost) continue;
      const known = bestCost.get(nextKey);
      if (known !== undefined && known <= g) continue;
      bestCost.set(nextKey, g);
      cameFrom.set(nextKey, cur.hex);
      const h = distance(next, goal) * minStep;
      open.push({ hex: next, g, h, f: g + h, seq: seq++ });
    }
  }
  return null;
}

/**
 * All tiles reachable from `start` with a total cost of at most `maxCost` (start not included).
 * `stepCost(from, to)` as in `findPath`. Dijkstra flood; the result is sorted by cost, then by
 * discovery order, so it is deterministic.
 */
export function reachable(
  start: Hex,
  stepCost: (from: Hex, to: Hex) => number | null,
  maxCost: number,
): { hex: Hex; cost: number }[] {
  const startKey = hexKey(start);
  const bestCost = new Map<string, number>([[startKey, 0]]);
  const done = new Set<string>();
  const result: { hex: Hex; cost: number }[] = [];
  const open = new MinHeap();
  let seq = 0;
  open.push({ hex: start, g: 0, h: 0, f: 0, seq: seq++ });
  while (open.size > 0) {
    const cur = open.pop();
    const curKey = hexKey(cur.hex);
    if (done.has(curKey)) continue;
    done.add(curKey);
    if (curKey !== startKey) result.push({ hex: cur.hex, cost: cur.g });
    for (const next of neighbors(cur.hex)) {
      const nextKey = hexKey(next);
      if (done.has(nextKey)) continue;
      const step = stepCost(cur.hex, next);
      if (step === null) continue;
      const g = cur.g + step;
      if (g > maxCost) continue;
      const known = bestCost.get(nextKey);
      if (known !== undefined && known <= g) continue;
      bestCost.set(nextKey, g);
      open.push({ hex: next, g, h: 0, f: g, seq: seq++ });
    }
  }
  return result;
}
