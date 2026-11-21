import { describe, expect, it } from 'vitest';
import { en } from './en';

/** Collects all leaves (including those in nested objects) with their path. */
function leaves(value: unknown, path: string): [string, unknown][] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  }
  return [[path, value]];
}

describe('i18n/en', () => {
  it('contains only non-empty texts', () => {
    for (const [path, value] of leaves(en, 'en')) {
      expect(typeof value, path).toBe('string');
      expect((value as string).trim().length, path).toBeGreaterThan(0);
    }
  });
});
