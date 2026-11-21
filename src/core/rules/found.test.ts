import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { addBuilding, addCity, addRoad, addUnit, at, makeTestState } from '../testing';
import { tileIndex } from '../map';
import type { Hex } from '../hex';
import type { GameState } from '../state';

const ROWS = Array.from({ length: 9 }, () => 'p'.repeat(14));

function found(s: GameState, unitId: number) {
  return applyAction(s, { type: 'foundCity', unitId });
}
const code = (r: ReturnType<typeof found>) => (r.ok ? 'ok' : r.error.code);

function world(opts: { ownAll?: boolean } = {}) {
  const s = makeTestState(ROWS, { ownAll: opts.ownAll ?? false });
  addCity(s, at(2, 4), { radius: 1 });
  return s;
}

describe('foundCity', () => {
  it('founds a city with 2 residents and claims free tiles only', () => {
    const s = world();
    addCity(s, at(11, 4), { owner: 1 });
    const id = addUnit(s, 'settler', at(7, 4));
    const res = found(s, id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const st = res.state;
    expect(st.units).toHaveLength(0);
    const city = st.cities[st.cities.length - 1];
    expect(city).toMatchObject({ owner: 0, residents: 2, level: 'settlement', supplyStreak: 0 });
    expect(city.center).toEqual(at(7, 4));
    expect(st.buildings.find((b) => b.id === city.id)?.type).toBe('cityCenter');
    const i = tileIndex(st.map, at(7, 4));
    expect(st.territory[i]).toBe(0);
    expect(st.tileCity[i]).toBe(city.id);
    const near = tileIndex(st.map, at(8, 4));
    expect(st.territory[near]).toBe(0);
    expect(st.tileCity[near]).toBe(city.id);
    // Old territory is untouched.
    expect(st.tileCity[tileIndex(st.map, at(2, 4))]).toBe(s.cities[0].id);
  });

  it('does not take tiles that already belong to somebody', () => {
    const s = world();
    const enemy = addCity(s, at(10, 4), { owner: 1, radius: 2 });
    const id = addUnit(s, 'settler', at(6, 4));
    const res = found(s, id);
    if (!res.ok) throw new Error(res.error.code);
    const t: Hex = at(8, 4);
    expect(res.state.territory[tileIndex(res.state.map, t)]).toBe(1);
    expect(res.state.tileCity[tileIndex(res.state.map, t)]).toBe(enemy);
  });

  it('errors', () => {
    const s = makeTestState(['pppppppppppppp', 'ppppppppppppfp', ...ROWS.slice(2)], {
      ownAll: false,
    });
    addCity(s, at(2, 4), { radius: 1 });
    const spear = addUnit(s, 'spearman', at(7, 4));
    expect(code(found(s, 999))).toBe('notOwnUnit');
    expect(code(found(s, spear))).toBe('notASettler');
    const enemyUnit = addUnit(s, 'settler', at(9, 7), { owner: 1 });
    expect(code(found(s, enemyUnit))).toBe('notOwnUnit');

    const forest = addUnit(s, 'settler', at(12, 1));
    expect(code(found(s, forest))).toBe('wrongTerrain');

    const built = addUnit(s, 'settler', at(9, 4));
    addBuilding(s, 'storehouse', at(9, 4));
    expect(code(found(s, built))).toBe('tileOccupied');

    addCity(s, at(12, 7), { owner: 1, radius: 2 });
    const foreign = addUnit(s, 'settler', at(10, 7));
    // distance to (12,7) is 2 but check foreign territory first
    expect(code(found(s, foreign))).toBe('foreignTerritory');

    const close = addUnit(s, 'settler', at(4, 4));
    expect(code(found(s, close))).toBe('tooCloseToCity');
    const ok = addUnit(s, 'settler', at(6, 4));
    expect(code(found(s, ok))).toBe('ok');
  });

  it('refuses a tile with a road', () => {
    const s = world();
    const id = addUnit(s, 'settler', at(7, 4));
    addRoad(s, at(7, 4));
    expect(code(found(s, id))).toBe('tileOccupied');
  });
});
