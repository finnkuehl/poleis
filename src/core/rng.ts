// Seeded random number generator (Mulberry32).
// Own RNG instead of Math.random: determinism - same seed = same game.
// The state is a plain JSON object and can therefore live in the GameState.

export interface Rng {
  /** uint32 */
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Returns a number in [0, 1) and changes rng.state. */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, maxInclusive]. */
export function nextInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(nextFloat(rng) * (maxInclusive - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return nextFloat(rng) < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: empty list');
  return items[nextInt(rng, 0, items.length - 1)];
}

/** Fisher-Yates, in place; returns the same list. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Digit text -> that number; otherwise FNV-1a-32 hash; empty -> 0. */
export function seedFromText(text: string): number {
  const t = text.trim();
  if (t === '') return 0;
  if (/^\d+$/.test(t)) return Number(t) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
