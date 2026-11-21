import { describe, expect, it } from 'vitest';
import { CITY_LEVEL_DEFS, CITY_LEVELS } from './cityLevels';
import { BUILDING_IDS, BUILDINGS } from './buildings';
import { economyConfig } from './economy';
import { GOOD_IDS, GOODS } from './goods';

describe('data', () => {
  it('uses only valid goods in costs, inputs and outputs', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDINGS[id];
      for (const goods of [def.cost, def.inputs, def.outputs]) {
        for (const [good, amount] of Object.entries(goods)) {
          expect(GOOD_IDS, `${id}: ${good}`).toContain(good);
          expect(amount).toBeGreaterThan(0);
        }
      }
    }
    for (const good of Object.keys(economyConfig.startGoods)) expect(GOOD_IDS).toContain(good);
  });
  it('has a definition for every good and building', () => {
    for (const id of GOOD_IDS) expect(GOODS[id].icon.length).toBeGreaterThan(0);
    expect(BUILDING_IDS).toHaveLength(Object.keys(BUILDINGS).length);
  });
  it('food is bread and fish only', () => {
    expect(GOOD_IDS.filter((g) => GOODS[g].isFood)).toEqual(['fish', 'bread']);
  });
  it('matches the design table', () => {
    expect(BUILDINGS.woodcutter).toMatchObject({
      cost: { wood: 2 },
      workers: 1,
      outputs: { wood: 2 },
    });
    expect(BUILDINGS.bakery).toMatchObject({ inputs: { grain: 2 }, outputs: { bread: 3 } });
    expect(BUILDINGS.smelter).toMatchObject({
      inputs: { ore: 2, wood: 1 },
      outputs: { bronze: 1 },
    });
    expect(BUILDINGS.farm.workers).toBe(2);
    expect(BUILDINGS.cityCenter).toMatchObject({
      housing: 4,
      isStorage: true,
      territoryRadius: 2,
      playerCanBuild: false,
    });
    expect(economyConfig.startGoods).toEqual({ wood: 20, stone: 10 });
  });
  it('every city level supplies a good that the next level needs', () => {
    for (const level of CITY_LEVELS) {
      const next = CITY_LEVEL_DEFS[level].next;
      if (!next) continue;
      expect(CITY_LEVEL_DEFS[next.to].needs.some((n) => n.good === next.supplyGood)).toBe(true);
    }
  });
});
