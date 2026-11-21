// Advancing a city and marketplace trading, through applyAction.

import { describe, expect, it } from 'vitest';
import type { Goods } from '../data';
import { applyAction, type Action } from './actions';
import { advanceCheck } from './rules';
import type { GameState } from './state';
import { addBuilding, addCity, at, makeTestState } from './testing';

const POLIS_COST: Goods = { planks: 20, stone: 20, drachmas: 30 };

function cityState(goods: Goods = {}, residents = 20, streak = 3): GameState {
  const s = makeTestState(['ppppp', 'ppppp', 'ppppp'], { goods });
  addCity(s, at(1, 1), { radius: 4, residents });
  s.cities[0].supplyStreak = streak;
  return s;
}

function code(s: GameState, a: Action): string {
  const r = applyAction(s, a);
  return r.ok ? 'ok' : r.error.code;
}

describe('advanceCity', () => {
  const advance = (id: number): Action => ({ type: 'advanceCity', cityId: id });

  it('fails in order: notOwnCity, notEnoughResidents, supplyNotReady, notAffordable', () => {
    expect(code(cityState(POLIS_COST), advance(99))).toBe('notOwnCity');
    const other = cityState(POLIS_COST);
    other.cities[0].owner = 1;
    expect(code(other, advance(other.cities[0].id))).toBe('notOwnCity');

    const id = 1;
    expect(code(cityState({}, 19, 0), advance(id))).toBe('notEnoughResidents');
    const r = applyAction(cityState({}, 20, 2), advance(id));
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'supplyNotReady', good: 'oil', turns: 3 },
    });
    const poor = applyAction(cityState({ planks: 20, stone: 5 }), advance(id));
    expect(poor).toMatchObject({
      ok: false,
      error: { code: 'notAffordable', missing: { stone: 15, drachmas: 30 } },
    });
  });

  it('success pays the cost, raises the level and resets the streak', () => {
    const s = cityState({ ...POLIS_COST, wood: 5 });
    const r = applyAction(s, advance(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cities[0]).toMatchObject({ level: 'polis', supplyStreak: 0 });
    expect(r.state.players[0].goods).toMatchObject({ planks: 0, stone: 0, drachmas: 0, wood: 5 });
    expect(s.cities[0].level).toBe('settlement');
  });

  it('metropolis needs 50 residents, a wine streak and bronze', () => {
    const s = cityState({ planks: 40, stone: 40, drachmas: 80 }, 50, 3);
    s.cities[0].level = 'polis';
    const r = applyAction(s, advance(1));
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'notAffordable', missing: { bronze: 10 } },
    });
    const check = advanceCheck(s, 1)!;
    expect(check.supply.good).toBe('wine');
    s.players[0].goods.bronze = 10;
    const ok = applyAction(s, advance(1));
    expect(ok.ok && ok.state.cities[0].level).toBe('metropolis');
    s.cities[0].supplyStreak = 2;
    expect(code(s, advance(1))).toBe('supplyNotReady');
  });

  it('the top level gives cityMaxLevel', () => {
    const s = cityState({}, 60);
    s.cities[0].level = 'metropolis';
    expect(code(s, advance(1))).toBe('cityMaxLevel');
    expect(advanceCheck(s, 1)).toMatchObject({ to: null, canAdvance: false });
  });

  it('advanceCheck reflects every field', () => {
    expect(advanceCheck(cityState(), 99)).toBeNull();
    const s = cityState({ planks: 25, stone: 5 }, 12, 1);
    expect(advanceCheck(s, 1)).toEqual({
      to: 'polis',
      residents: { have: 12, need: 20, ok: false },
      supply: { good: 'oil', streak: 1, turns: 3, ok: false },
      cost: { cost: POLIS_COST, missing: { stone: 15, drachmas: 30 }, ok: false },
      canAdvance: false,
    });
    const ready = advanceCheck(cityState(POLIS_COST), 1)!;
    expect(ready).toMatchObject({ canAdvance: true, cost: { missing: {}, ok: true } });
  });
});

describe('trade', () => {
  function marketState(goods: Goods): GameState {
    const s = cityState(goods, 4, 0);
    addBuilding(s, 'marketplace', at(2, 1));
    return s;
  }
  const trade = (good: 'wood' | 'drachmas', direction: 'sell' | 'buy', lots: number): Action => ({
    type: 'trade',
    good,
    direction,
    lots,
  });

  it('sells 2 goods per drachma and buys 1 good for 3 drachmas', () => {
    const s = marketState({ wood: 10, drachmas: 7 });
    const sold = applyAction(s, trade('wood', 'sell', 3));
    expect(sold.ok && sold.state.players[0].goods).toMatchObject({ wood: 4, drachmas: 10 });
    const bought = applyAction(s, trade('wood', 'buy', 2));
    expect(bought.ok && bought.state.players[0].goods).toMatchObject({ wood: 12, drachmas: 1 });
  });

  it('needs a connected, staffed, unpaused marketplace', () => {
    const none = cityState({ wood: 10 }, 4, 0);
    expect(code(none, trade('wood', 'sell', 1))).toBe('noMarketplace');
    const far = cityState({ wood: 10 }, 4, 0);
    addBuilding(far, 'marketplace', at(4, 0));
    expect(code(far, trade('wood', 'sell', 1))).toBe('noMarketplace');
    const paused = marketState({ wood: 10 });
    paused.buildings[1].paused = true;
    expect(code(paused, trade('wood', 'sell', 1))).toBe('noMarketplace');
  });

  it('rejects drachmas, short stock and invalid lots', () => {
    const s = marketState({ wood: 3, drachmas: 5 });
    expect(code(s, trade('drachmas', 'sell', 1))).toBe('cannotTradeGood');
    expect(applyAction(s, trade('wood', 'sell', 2))).toMatchObject({
      ok: false,
      error: { code: 'notAffordable', missing: { wood: 1 } },
    });
    expect(applyAction(s, trade('wood', 'buy', 2))).toMatchObject({
      ok: false,
      error: { code: 'notAffordable', missing: { drachmas: 1 } },
    });
    expect(code(s, trade('wood', 'sell', 0))).toBe('invalidAmount');
    expect(code(s, trade('wood', 'sell', 1.5))).toBe('invalidAmount');
  });
});
