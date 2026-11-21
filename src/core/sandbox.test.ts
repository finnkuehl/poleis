import { describe, expect, it } from 'vitest';
import { militaryConfig } from '../data';
import { distance } from './hex';
import { createGameState } from './state';

describe('sandbox passive enemy', () => {
  const { min, max } = militaryConfig.sandboxEnemyDistance;

  for (const seed of ['1', '42', 'sandbox-enemy', 'abc']) {
    it(`seed ${seed}: enemy city and two spearmen at a fair distance`, () => {
      const s = createGameState(seed, { sandbox: true });
      expect(s.players).toHaveLength(2);
      expect(s.players[1]).toMatchObject({ id: 1, isHuman: false });
      const city = s.cities.find((c) => c.owner === 1);
      expect(city).toBeDefined();
      if (!city) return;
      expect(city.residents).toBe(4);
      const d = distance(s.cities[0].center, city.center);
      expect(d).toBeGreaterThanOrEqual(min);
      expect(d).toBeLessThanOrEqual(max);
      const units = s.units.filter((u) => u.owner === 1);
      expect(units.map((u) => u.type)).toEqual(['spearman', 'spearman']);
      expect(units.some((u) => distance(u.hex, city.center) === 0)).toBe(true);
      expect(units.some((u) => distance(u.hex, city.center) === 1)).toBe(true);
      // The human city is not touched by the enemy territory.
      expect(s.territory.filter((t) => t === 1).length).toBeGreaterThan(0);
    });

    it(`seed ${seed}: the human start equals the normal game and is deterministic`, () => {
      const normal = createGameState(seed);
      const s = createGameState(seed, { sandbox: true });
      expect(s.map).toEqual(normal.map);
      expect(s.cities[0]).toEqual(normal.cities[0]);
      expect(s.buildings[0]).toEqual(normal.buildings[0]);
      const human = (t: number[]) => t.map((x) => (x === 0 ? 0 : -1));
      expect(human(s.territory)).toEqual(human(normal.territory));
      expect(JSON.stringify(createGameState(seed, { sandbox: true }))).toEqual(JSON.stringify(s));
    });
  }
});
