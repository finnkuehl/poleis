import { describe, expect, it } from 'vitest';
import { distance, hex, hexKey, neighbors, type Hex } from './coords';
import { findPath, reachable } from './pathfinding';

const open = (): number => 1;

describe('findPath', () => {
  it('start equals goal gives a one-tile path', () => {
    expect(findPath(hex(2, 2), hex(2, 2), open)).toEqual({ path: [hex(2, 2)], cost: 0 });
  });

  it('open field: cost = distance, path has distance + 1 tiles, steps are adjacent', () => {
    const a = hex(0, 0);
    const b = hex(5, -3);
    for (const opts of [{}, { minStepCost: 1 }]) {
      const res = findPath(a, b, open, opts);
      expect(res).not.toBeNull();
      const { path, cost } = res!;
      expect(cost).toBe(distance(a, b));
      expect(path.length).toBe(distance(a, b) + 1);
      expect(path[0]).toEqual(a);
      expect(path[path.length - 1]).toEqual(b);
      for (let i = 1; i < path.length; i++) expect(distance(path[i - 1], path[i])).toBe(1);
    }
  });

  it('goes around a wall', () => {
    // Wall at q = 2 for r in -3..3, with open space beyond that.
    const wall = new Set<string>();
    for (let r = -3; r <= 3; r++) wall.add(hexKey(hex(2, r)));
    const cost = (_f: Hex, to: Hex): number | null =>
      wall.has(hexKey(to)) || Math.abs(to.r) > 8 || Math.abs(to.q) > 8 ? null : 1;
    const res = findPath(hex(0, 0), hex(4, 0), cost)!;
    expect(res).not.toBeNull();
    expect(res.cost).toBeGreaterThan(distance(hex(0, 0), hex(4, 0)));
    expect(res.path.some((h) => wall.has(hexKey(h)))).toBe(false);
  });

  it('returns null if the goal is unreachable', () => {
    const goal = hex(3, 0);
    const blocked = new Set(neighbors(goal).map(hexKey));
    const cost = (_f: Hex, to: Hex): number | null =>
      blocked.has(hexKey(to)) || Math.abs(to.q) > 6 || Math.abs(to.r) > 6 ? null : 1;
    expect(findPath(hex(0, 0), goal, cost)).toBeNull();
  });

  it('prefers a long free road over a short paid way (0-cost steps)', () => {
    // Road: along r = 0 from q = 0 to q = 4 is free, every other tile costs 5.
    // Start (0,0) to goal (4,0) is exactly the road, so make the goal off-road by a detour:
    // road goes (0,0)->(0,1)->(1,1)... all free; direct line costs 5 per step.
    const road = new Set(
      [hex(0, 0), hex(0, 1), hex(0, 2), hex(1, 2), hex(2, 2), hex(3, 1), hex(4, 0), hex(4, -1)].map(
        hexKey,
      ),
    );
    // Direct distance (0,0)->(4,-1) is 4, so the paid way costs 4 * 5 = 20; the road is free.
    const cost = (_f: Hex, to: Hex): number | null => (road.has(hexKey(to)) ? 0 : 5);
    // Make sure the road is actually connected step by step.
    const chain = [
      hex(0, 0),
      hex(0, 1),
      hex(0, 2),
      hex(1, 2),
      hex(2, 2),
      hex(3, 1),
      hex(4, 0),
      hex(4, -1),
    ];
    for (let i = 1; i < chain.length; i++) expect(distance(chain[i - 1], chain[i])).toBe(1);
    const res = findPath(hex(0, 0), hex(4, -1), cost, { maxCost: 30 })!;
    expect(res.cost).toBe(0);
    expect(res.path.length).toBe(chain.length);
    expect(res.path.every((h) => road.has(hexKey(h)))).toBe(true);
  });

  it('is deterministic', () => {
    const cost = (_f: Hex, to: Hex): number | null =>
      Math.abs(to.q) > 6 || Math.abs(to.r) > 6 ? null : 1;
    const a = findPath(hex(-3, 1), hex(4, -2), cost, { minStepCost: 1 });
    const b = findPath(hex(-3, 1), hex(4, -2), cost, { minStepCost: 1 });
    expect(a).toEqual(b);
  });

  it('maxCost cuts the search off', () => {
    const a = hex(0, 0);
    const b = hex(5, 0);
    expect(findPath(a, b, open, { maxCost: 4 })).toBeNull();
    expect(findPath(a, b, open, { maxCost: 5 })?.cost).toBe(5);
  });
});

describe('reachable', () => {
  it('respects the budget and reports costs without the start', () => {
    const start = hex(0, 0);
    const res = reachable(start, open, 2);
    // 6 + 12 tiles within distance 2.
    expect(res).toHaveLength(18);
    expect(res.some((r) => hexKey(r.hex) === hexKey(start))).toBe(false);
    for (const r of res) expect(r.cost).toBe(distance(start, r.hex));
  });

  it('uses the cheapest way and skips blocked tiles', () => {
    const start = hex(0, 0);
    const cost = (_from: Hex, to: Hex): number | null =>
      hexKey(to) === hexKey(hex(1, 0)) ? null : hexKey(to) === hexKey(hex(0, 1)) ? 3 : 1;
    const res = reachable(start, cost, 2);
    const keys = res.map((r) => hexKey(r.hex));
    expect(keys).not.toContain(hexKey(hex(1, 0)));
    expect(keys).not.toContain(hexKey(hex(0, 1)));
    expect(reachable(start, cost, 0)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(reachable(hex(3, -1), open, 3)).toEqual(reachable(hex(3, -1), open, 3));
  });
});
