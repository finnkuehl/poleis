import { describe, expect, it } from 'vitest';
import { de } from './de';

describe('i18n/de', () => {
  it('enthält nur nicht-leere Texte', () => {
    for (const [key, value] of Object.entries(de)) {
      expect(typeof value, key).toBe('string');
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});
