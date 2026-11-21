import { describe, expect, it } from 'vitest';
import { chance, createRng, nextFloat, nextInt, pick, seedFromText, shuffle } from './rng';

const seq = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => nextFloat(rng));
};

describe('rng', () => {
  it('gleicher Seed liefert gleiche Folge, anderer Seed andere', () => {
    expect(seq(1, 100)).toEqual(seq(1, 100));
    expect(seq(1, 100)).not.toEqual(seq(2, 100));
  });

  it('nextFloat liegt in [0,1)', () => {
    for (const v of seq(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt hält Grenzen ein und trifft beide Enden', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.has(2)).toBe(true);
    expect(seen.has(5)).toBe(true);
  });

  it('chance respektiert 0 und 1', () => {
    const rng = createRng(9);
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
  });

  it('ist JSON-serialisierbar und setzt die Folge identisch fort', () => {
    const a = createRng(42);
    for (let i = 0; i < 10; i++) nextFloat(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(nextFloat(b)).toBe(nextFloat(a));
    expect(nextFloat(b)).toBe(nextFloat(a));
  });

  it('shuffle ist eine Permutation, pick wirft bei leerer Liste', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(createRng(5), [...items]);
    expect([...result].sort((x, y) => x - y)).toEqual(items);
    expect(() => pick(createRng(1), [])).toThrow();
    expect(items).toContain(pick(createRng(1), items));
  });

  it('seedFromText', () => {
    expect(seedFromText('123')).toBe(123);
    expect(seedFromText(' 42 ')).toBe(42);
    expect(seedFromText('athen')).toBe(seedFromText('athen'));
    expect(seedFromText('athen')).not.toBe(seedFromText('sparta'));
    expect(seedFromText('')).toBe(0);
  });
});
