import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/state';
import { cityName } from './cityNames';
import { en } from './en';

describe('cityName', () => {
  it('walks through the list and repeats with Roman numbers', () => {
    expect(cityName(0)).toBe('Argos');
    expect(cityName(1)).toBe('Delphi');
    const n = en.cityNames.length;
    expect(cityName(n)).toBe('Argos II');
    expect(cityName(2 * n + 1)).toBe('Delphi III');
    expect(cityName(3 * n)).toBe('Argos IV');
  });
  it('has unique names and avoids the civilization names', () => {
    expect(new Set(en.cityNames).size).toBe(en.cityNames.length);
    for (const civ of Object.values(en.civs)) expect(en.cityNames).not.toContain(civ);
  });
  it('gives every city of a new game its own name index', () => {
    const s = createGameState('names', { settings: { aiCount: 3 } });
    expect(s.cities.map((c) => c.nameIndex)).toEqual(s.cities.map((_, i) => i));
  });
});
