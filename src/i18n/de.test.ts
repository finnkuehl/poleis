import { describe, expect, it } from 'vitest';
import { de } from './de';

/** Sammelt alle Blätter (auch in verschachtelten Objekten) mit ihrem Pfad. */
function leaves(value: unknown, path: string): [string, unknown][] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  }
  return [[path, value]];
}

describe('i18n/de', () => {
  it('enthält nur nicht-leere Texte', () => {
    for (const [path, value] of leaves(de, 'de')) {
      expect(typeof value, path).toBe('string');
      expect((value as string).trim().length, path).toBeGreaterThan(0);
    }
  });
});
