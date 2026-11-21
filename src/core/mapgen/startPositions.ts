// Automatic start positions on the mainland.
// Deterministic: same map + same RNG state = same result. Only the seeded RNG is used.

import { startPositionConfig as cfg } from '../../data/startPosition';
import { TERRAIN } from '../../data/terrain';
import { distance, range, type Hex } from '../hex';
import { inBounds, terrainAt } from '../map';
import { createRng, nextInt, type Rng } from '../rng';
import type { MapState } from '../state';
import { findLandmasses } from './landmass';

interface Candidate {
  hex: Hex;
  score: number;
  forest: number;
  hillsOrMountains: number;
  plains: number;
}

/**
 * Score = min(forest, capF) + min(hillsOrMountains, capH) + min(plains, capP) / 2 + coastBonus (if coast nearby).
 * Caps and bonus live in src/data/startPosition.ts.
 */
function evaluate(map: MapState, center: Hex): Candidate | null {
  const area = range(center, cfg.radius);
  if (!area.every((h) => inBounds(map, h))) return null;
  let forest = 0;
  let hillsOrMountains = 0;
  let plains = 0;
  let coast = false;
  for (const h of area) {
    const t = terrainAt(map, h);
    if (t === 'forest') forest++;
    else if (t === 'hills' || t === 'mountains') hillsOrMountains++;
    else if (t === 'plains') plains++;
    else if (t === 'coast') coast = true;
  }
  const score =
    Math.min(forest, cfg.scoreCapForest) +
    Math.min(hillsOrMountains, cfg.scoreCapHillsOrMountains) +
    Math.min(plains, cfg.scoreCapPlains) / 2 +
    (coast ? cfg.coastBonus : 0);
  return { hex: center, score, forest, hillsOrMountains, plains };
}

/**
 * Picks `count` start positions (city centers) on the mainland.
 *
 * Relaxation if there are fewer than `count` candidates (in this order, step by step):
 *  1. fewer plains required (minPlains down to 0),
 *  2. fewer forest tiles required (minForest down to 0).
 * Hills/mountains are never relaxed. If still not enough candidates: Error.
 * Distance: further starts take the candidate with the largest distance to the chosen ones.
 * For several starts, if the result is closer than minDistanceBetweenStarts, the minimums
 * above are relaxed further (bigger pool); the attempt with the largest minimum distance wins
 * (ties: the earlier, stricter attempt).
 */
export function findStartPositions(map: MapState, count: number, rng: Rng): Hex[] {
  const mainland = findLandmasses(map)[0];
  if (!mainland) throw new Error('findStartPositions: the map has no land');

  const base: Candidate[] = [];
  for (const h of mainland) {
    if (terrainAt(map, h) !== 'plains' || !TERRAIN.plains.buildable) continue;
    const c = evaluate(map, h);
    if (c && c.hillsOrMountains >= cfg.minHillsOrMountains) base.push(c);
  }
  // `mainland` is in index order, so `base` is too: the index order is the tie-breaker everywhere below.

  const attempts: Array<[number, number]> = [];
  for (let p = cfg.minPlains; p >= 0; p--) attempts.push([p, cfg.minForest]);
  for (let f = cfg.minForest - 1; f >= 0; f--) attempts.push([0, f]);

  let best: { chosen: Candidate[]; minDist: number; rngState: number } | null = null;
  let biggestPool = 0;
  for (const [minPlains, minForest] of attempts) {
    const pool = base.filter((c) => c.plains >= minPlains && c.forest >= minForest);
    biggestPool = Math.max(biggestPool, pool.length);
    if (pool.length < count) continue;
    // Each attempt works on a copy of the RNG; only the kept attempt advances the real one.
    const attemptRng = createRng(rng.state);
    const chosen = choose(pool, count, attemptRng);
    const minDist = minPairDistance(chosen);
    if (!best || minDist > best.minDist) best = { chosen, minDist, rngState: attemptRng.state };
    // One start: no distance to keep. Several: stop at the first attempt that is far enough.
    if (count === 1 || minDist >= cfg.minDistanceBetweenStarts) break;
  }
  if (!best) {
    throw new Error(
      `findStartPositions: only ${biggestPool} suitable start positions on the mainland, ${count} requested`,
    );
  }
  rng.state = best.rngState;
  return best.chosen.map((c) => c.hex);
}

/** Smallest distance between any two of the candidates (Infinity for one). */
function minPairDistance(chosen: Candidate[]): number {
  let min = Infinity;
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      min = Math.min(min, distance(chosen[i].hex, chosen[j].hex));
    }
  }
  return min;
}

/** Picks `count` candidates from the pool: the first at random among the best, the rest far apart. */
function choose(pool: Candidate[], count: number, rng: Rng): Candidate[] {
  // First position: random among the best-scoring candidates.
  const ranked = pool
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.score - a.c.score || a.index - b.index);
  const topCount = Math.max(1, Math.ceil(ranked.length * cfg.topShare));
  const first = ranked[nextInt(rng, 0, topCount - 1)].c;
  const chosen: Candidate[] = [first];

  // Further positions: largest minimum distance to the chosen ones; ties by score, then index.
  while (chosen.length < count) {
    let best: { c: Candidate; dist: number } | null = null;
    for (const c of pool) {
      if (chosen.includes(c)) continue;
      const dist = Math.min(...chosen.map((o) => distance(o.hex, c.hex)));
      if (!best || dist > best.dist || (dist === best.dist && c.score > best.c.score)) {
        best = { c, dist };
      }
    }
    chosen.push((best as { c: Candidate }).c);
  }
  return chosen;
}
