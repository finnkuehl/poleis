import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../testing';
import { tileIndex } from '../map';
import { endTurn } from '../turn';
import type { GameState } from '../state';

/** 7x5 plains; enemy (player 1) city at (4,2) with a farm, human unit next to it. */
function world(type: 'spearman' | 'settler' | 'scout' = 'spearman') {
  const s = makeTestState(['ppppppp', 'ppppppp', 'ppppppp', 'ppppppp', 'ppppppp'], {
    ownAll: false,
  });
  s.players.push({
    id: 1,
    isHuman: false,
    civ: null,
    name: '',
    color: 1,
    alive: true,
    goods: { ...s.players[0].goods },
    explored: s.map.tiles.map(() => false),
    lowPriorityGoods: [],
  });
  const cityId = addCity(s, at(4, 2), { owner: 1 });
  const farm = addBuilding(s, 'farm', at(5, 2), 1);
  const unit = addUnit(s, type, at(3, 2));
  return { s, cityId, farm, unit };
}

function move(s: GameState, unitId: number, to: ReturnType<typeof at>) {
  const r = applyAction(s, { type: 'move', unitId, to });
  if (!r.ok) throw new Error(`move failed: ${r.error.code}`);
  return r.state;
}

describe('capturing', () => {
  it('moving onto an empty enemy city center starts it and the next turn takes it', () => {
    const { s, cityId, farm, unit } = world();
    const moved = move(s, unit, at(4, 2));
    expect(moved.units[0].capturing).toBe(cityId);
    const after = endTurn(moved);
    expect(after.cities[0].owner).toBe(0);
    expect(after.buildings.every((b) => b.owner === 0)).toBe(true);
    expect(after.buildings.find((b) => b.id === farm)?.owner).toBe(0);
    for (const i of after.tileCity.keys()) {
      if (after.tileCity[i] === cityId) expect(after.territory[i]).toBe(0);
    }
    expect(after.territory[tileIndex(after.map, at(5, 2))]).toBe(0);
    expect(after.units[0].capturing).toBeNull();
    expect(after.lastReport?.captured).toEqual([cityId]);
  });

  it('drops the old owner training orders of that city', () => {
    const { s, unit } = world();
    const barracks = addBuilding(s, 'barracks', at(4, 1), 1);
    s.training.push({ barracksId: barracks, unit: 'spearman', owner: 1 });
    const after = endTurn(move(s, unit, at(4, 2)));
    expect(after.training).toEqual([]);
  });

  it('moving away cancels the capture', () => {
    const { s, unit } = world();
    const on = move(s, unit, at(4, 2));
    on.units[0].movesLeft = 1; // pretend it may move again
    const off = move(on, unit, at(3, 2));
    expect(off.units[0].capturing).toBeNull();
    expect(endTurn(off).cities[0].owner).toBe(1);
  });

  it('being attacked cancels the capture', () => {
    const { s, unit } = world();
    const on = move(s, unit, at(4, 2));
    const enemy = addUnit(on, 'spearman', at(4, 1), { owner: 1 });
    on.currentPlayer = 1;
    const hit = applyAction(on, { type: 'attack', unitId: enemy, targetId: unit });
    if (!hit.ok) throw new Error('attack failed');
    expect(hit.state.units.find((u) => u.id === unit)?.capturing).toBeNull();
    const back = { ...hit.state, currentPlayer: 0 };
    expect(endTurn(back).cities[0].owner).toBe(1);
  });

  it('settlers cannot capture', () => {
    const { s, unit } = world('settler');
    const on = move(s, unit, at(4, 2));
    expect(on.units[0].capturing).toBeNull();
    expect(endTurn(on).cities[0].owner).toBe(1);
  });

  it('scouts cannot capture', () => {
    const { s, unit } = world('scout');
    const on = move(s, unit, at(4, 2));
    expect(on.units[0].capturing).toBeNull();
    expect(endTurn(on).cities[0].owner).toBe(1);
  });

  it('does not capture own city', () => {
    const { s, unit } = world();
    s.cities[0].owner = 0;
    expect(move(s, unit, at(4, 2)).units[0].capturing).toBeNull();
  });

  it('a scout standing on an enemy city (old save) never takes it and loses `capturing`', () => {
    const { s, cityId, unit } = world('scout');
    const scout = s.units.find((u) => u.id === unit)!;
    scout.hex = at(4, 2);
    scout.capturing = cityId;
    const t = endTurn(s);
    expect(t.cities.find((c) => c.id === cityId)?.owner).toBe(1);
    expect(t.units.find((u) => u.id === unit)?.capturing).toBeNull();
  });
});
