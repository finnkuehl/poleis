import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { createGameState, type GameState } from '../state';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../testing';
import { endTurn } from '../turn';

const RICH = { planks: 50, bronze: 50, bread: 50, drachmas: 50, grain: 50 };

/** 5x5 plains, city at (2,2) with barracks next to it at (1,2). */
function world(opts: { level?: 'settlement' | 'polis' | 'metropolis'; residents?: number } = {}) {
  const s = makeTestState(['ppppp', 'ppppp', 'ppppp', 'ppppp', 'ppppp'], { goods: RICH });
  addCity(s, at(2, 2), { level: opts.level, residents: opts.residents ?? 4 });
  const barracks = addBuilding(s, 'barracks', at(1, 2));
  return { s, barracks };
}

function train(s: GameState, barracksId: number, unit: 'spearman' | 'settler' | 'hoplite') {
  return applyAction(s, { type: 'train', barracksId, unit });
}

describe('train', () => {
  it('pays the cost and queues an order', () => {
    const { s, barracks } = world();
    const res = train(s, barracks, 'spearman');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players[0].goods.planks).toBe(48);
    expect(res.state.players[0].goods.bronze).toBe(49);
    expect(res.state.training).toEqual([{ barracksId: barracks, unit: 'spearman', owner: 0 }]);
    expect(res.state.units).toHaveLength(0);
  });

  it('settler takes 2 residents and needs at least 3', () => {
    const { s, barracks } = world({ residents: 4 });
    const res = train(s, barracks, 'settler');
    expect(res.ok && res.state.cities[0].residents).toBe(2);
    const small = world({ residents: 2 });
    const bad = train(small.s, small.barracks, 'settler');
    expect(bad.ok === false && bad.error.code).toBe('notEnoughResidents');
  });

  it('allows one order per barracks per turn', () => {
    const { s, barracks } = world();
    const first = train(s, barracks, 'spearman');
    if (!first.ok) throw new Error('first order failed');
    const second = train(first.state, barracks, 'spearman');
    expect(second.ok === false && second.error.code).toBe('alreadyTraining');
  });

  it('checks level, ownership and cost', () => {
    const { s, barracks } = world();
    const low = train(s, barracks, 'hoplite');
    expect(low.ok === false && low.error).toMatchObject({ code: 'levelTooLow', level: 'polis' });
    const polis = world({ level: 'polis' });
    expect(train(polis.s, polis.barracks, 'hoplite').ok).toBe(true);
    const wrong = train(s, 999, 'spearman');
    expect(wrong.ok === false && wrong.error.code).toBe('notOwnBuilding');
    const cityId = s.cities[0].id;
    expect(train(s, cityId, 'spearman').ok).toBe(false);
    s.players[0].goods.bronze = 0;
    const poor = train(s, barracks, 'spearman');
    expect(poor.ok === false && poor.error).toMatchObject({
      code: 'notAffordable',
      missing: { bronze: 1 },
    });
  });

  it('the unit appears next turn on the barracks tile', () => {
    const { s, barracks } = world();
    const res = train(s, barracks, 'spearman');
    if (!res.ok) throw new Error('failed');
    const next = endTurn(res.state);
    expect(next.units).toHaveLength(1);
    expect(next.units[0]).toMatchObject({ type: 'spearman', hex: at(1, 2), hp: 10, movesLeft: 1 });
    expect(next.training).toEqual([]);
    expect(next.lastReport?.units.spawned).toBe(1);
  });

  it('uses a free neighbor if the barracks tile is taken, waits if all are blocked', () => {
    const { s, barracks } = world();
    const res = train(s, barracks, 'spearman');
    if (!res.ok) throw new Error('failed');
    const blocker = addUnit(res.state, 'scout', at(1, 2));
    const next = endTurn(res.state);
    const fresh = next.units.find((u) => u.type === 'spearman');
    expect(fresh).toBeDefined();
    expect(fresh!.hex).not.toEqual(at(1, 2));

    // Block the tile and all six neighbors with units that eat nothing special (stock is rich).
    const { s: s2, barracks: b2 } = world();
    const r2 = train(s2, b2, 'spearman');
    if (!r2.ok) throw new Error('failed');
    const st = r2.state;
    const around = [at(1, 2), at(0, 2), at(2, 2), at(0, 1), at(1, 1), at(0, 3), at(1, 3)];
    for (const h of around) addUnit(st, 'spearman', h, { owner: 1 });
    const waiting = endTurn(st);
    expect(waiting.units.filter((u) => u.owner === 0)).toHaveLength(0);
    expect(waiting.training).toHaveLength(1);
    // Free a tile: it appears next turn.
    waiting.units = waiting.units.filter(
      (u) => !(u.owner === 1 && u.hex.q === at(1, 2).q && u.hex.r === at(1, 2).r),
    );
    const later = endTurn(waiting);
    expect(later.units.filter((u) => u.owner === 0)).toHaveLength(1);
    expect(blocker).toBeGreaterThan(0);
  });
});

describe('turn: healing, reset, upkeep', () => {
  it('heals +2 idle outside own territory and +4 inside, not after acting, capped', () => {
    const s = makeTestState(['pppp'], { ownAll: false });
    s.territory[0] = 0; // only tile (0,0) is ours
    const inside = addUnit(s, 'spearman', at(0, 0), { hp: 3 });
    const outside = addUnit(s, 'spearman', at(2, 0), { hp: 3 });
    const acted = addUnit(s, 'spearman', at(1, 0), { hp: 3, acted: true });
    const nearFull = addUnit(s, 'spearman', at(3, 0), { hp: 9 });
    s.players[0].goods.bread = 50;
    const next = endTurn(s);
    const hp = (id: number) => next.units.find((u) => u.id === id)!.hp;
    expect(hp(inside)).toBe(7);
    expect(hp(outside)).toBe(5);
    expect(hp(acted)).toBe(3);
    expect(hp(nearFull)).toBe(10);
  });

  it('resets movement and flags', () => {
    const s = makeTestState(['pppp']);
    s.players[0].goods.bread = 5;
    const id = addUnit(s, 'scout', at(0, 0), { movesLeft: 0, hasMoved: true, acted: true });
    const u = endTurn(s).units.find((x) => x.id === id)!;
    expect(u).toMatchObject({ movesLeft: 3, hasMoved: false, acted: false });
  });

  it('units eat 1 food each after the residents (fish first)', () => {
    const s = makeTestState(['ppppp', 'ppppp', 'ppppp']);
    addCity(s, at(2, 1), { residents: 4 });
    s.players[0].goods.fish = 1;
    s.players[0].goods.bread = 5;
    addUnit(s, 'spearman', at(0, 0));
    addUnit(s, 'spearman', at(4, 2));
    const next = endTurn(s);
    // City eats 2 (fish 1 + bread 1) and produces 1 bread; units eat 2 bread.
    expect(next.lastReport?.units).toEqual({
      spawned: 0,
      upkeepEaten: { bread: 2 },
      starving: false,
      lost: 0,
    });
    expect(next.players[0].goods.bread).toBe(5 + 1 - 1 - 2);
    expect(next.lastReport?.delta.bread).toBe(1 - 1 - 2);
    expect(next.units.every((u) => u.hp === 10)).toBe(true);
  });

  it('starving units lose 2 HP each; units at 0 HP are removed', () => {
    const s = makeTestState(['pppp']);
    const a = addUnit(s, 'spearman', at(0, 0), { acted: true });
    const b = addUnit(s, 'scout', at(1, 0), { hp: 2, acted: true });
    s.players[0].goods.bread = 1;
    const next = endTurn(s);
    expect(next.lastReport?.units).toMatchObject({
      starving: true,
      lost: 1,
      upkeepEaten: { bread: 1 },
    });
    // Idle healing happened before hunger (acted -> no healing here).
    expect(next.units.find((u) => u.id === a)?.hp).toBe(8);
    expect(next.units.find((u) => u.id === b)).toBeUndefined();
  });
});

describe('determinism and JSON', () => {
  it('same actions give the same state; units survive a JSON round trip', () => {
    const run = () => {
      let s = createGameState('units-det', { sandbox: true });
      const center = s.buildings[0].hex;
      void center;
      s.units.push({
        id: s.nextId++,
        type: 'scout',
        owner: 0,
        hex: s.cities[0].center,
        hp: 5,
        movesLeft: 3,
        hasMoved: false,
        acted: false,
        attacked: false,
        capturing: null,
      });
      s = endTurn(s);
      return s;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.units.filter((u) => u.owner === 0)).toHaveLength(1);
  });
});
