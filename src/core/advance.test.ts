// Advancing a city and marketplace trading, through applyAction.

import { describe, expect, it } from 'vitest';
import type { Goods } from '../data';
import { applyAction, type Action } from './actions';
import { advanceCheck, previewProduction } from './rules';
import type { GameState } from './state';
import { addBuilding, addCity, at, makeTestState } from './testing';

const POLIS_COST: Goods = { planks: 20, stone: 20, drachmas: 30 };

/** A city at (1,1); `oil` = true adds an olive grove + oil press (2 oil per turn) next to it. */
function cityState(goods: Goods = {}, residents = 20, oil = false): GameState {
  const s = makeTestState(['ppppp', 'ppppp', 'ppppp'], { goods });
  addCity(s, at(1, 1), { radius: 4, residents });
  if (oil) {
    addBuilding(s, 'oliveGrove', at(2, 1));
    addBuilding(s, 'oilPress', at(3, 1));
  }
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
    expect(code(cityState({}, 19, true), advance(id))).toBe('notEnoughResidents');
    // No oil production: makes 0, needs ceil(20 / 10) = 2 per turn (stock does not help).
    const r = applyAction(cityState({ ...POLIS_COST, oil: 50 }, 20), advance(id));
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'supplyNotReady', good: 'oil', made: 0, needed: 2 },
    });
    const poor = applyAction(cityState({ planks: 20, stone: 5 }, 20, true), advance(id));
    expect(poor).toMatchObject({
      ok: false,
      error: { code: 'notAffordable', missing: { stone: 15, drachmas: 30 } },
    });
  });

  it('success pays the cost and raises the level', () => {
    const s = cityState({ ...POLIS_COST, wood: 5 }, 20, true);
    const r = applyAction(s, advance(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cities[0]).toMatchObject({ level: 'polis' });
    expect(r.state.players[0].goods).toMatchObject({ planks: 0, stone: 0, drachmas: 0, wood: 5 });
    expect(s.cities[0].level).toBe('settlement');
  });

  it('metropolis needs 50 residents, wine production and bronze', () => {
    const s = cityState({ planks: 40, stone: 40, drachmas: 80, bronze: 10 }, 50);
    s.cities[0].level = 'polis';
    // 50 residents need ceil(50 / 10) = 5 wine at the Metropolis; nothing makes wine yet.
    const r = applyAction(s, advance(1));
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'supplyNotReady', good: 'wine', made: 0, needed: 5 },
    });
    const check = advanceCheck(s, 1)!;
    expect(check.supply).toEqual({ good: 'wine', made: 0, needed: 5, ok: false });
    // With a (fake) production report of 5 wine per turn the supply is fine.
    const report = previewProduction(s, 0);
    report.buildings.push({
      buildingId: 1,
      status: { kind: 'producing' },
      produced: { wine: 5 },
      consumed: {},
    });
    expect(advanceCheck(s, 1, report)).toMatchObject({
      supply: { made: 5, needed: 5, ok: true },
      canAdvance: true,
    });
  });

  it('made / needed counts the needs of all other own cities', () => {
    const s = makeTestState(['ppppppppp', 'ppppppppp', 'ppppppppp'], {
      goods: { ...POLIS_COST },
    });
    const a = addCity(s, at(1, 1), { residents: 20 });
    // A second city that already is a Polis with 20 residents: it uses 2 oil per turn.
    addCity(s, at(7, 1), { residents: 20, level: 'polis' });
    addBuilding(s, 'oliveGrove', at(2, 1));
    addBuilding(s, 'oilPress', at(3, 1));
    // One press makes 2 oil; city A would need 2 itself + 2 for the Polis = 4.
    expect(advanceCheck(s, a)).toMatchObject({
      supply: { good: 'oil', made: 2, needed: 4, ok: false },
      canAdvance: false,
    });
    addBuilding(s, 'oliveGrove', at(2, 0));
    addBuilding(s, 'oilPress', at(3, 0));
    expect(advanceCheck(s, a)).toMatchObject({
      supply: { made: 4, needed: 4, ok: true },
      canAdvance: true,
    });
  });

  it('the top level gives cityMaxLevel', () => {
    const s = cityState({}, 60);
    s.cities[0].level = 'metropolis';
    expect(code(s, advance(1))).toBe('cityMaxLevel');
    expect(advanceCheck(s, 1)).toMatchObject({ to: null, canAdvance: false });
  });

  it('advanceCheck reflects every field', () => {
    expect(advanceCheck(cityState(), 99)).toBeNull();
    const s = cityState({ planks: 25, stone: 5 }, 12, true);
    expect(advanceCheck(s, 1)).toEqual({
      to: 'polis',
      residents: { have: 12, need: 20, ok: false },
      supply: { good: 'oil', made: 2, needed: 2, ok: true },
      cost: { cost: POLIS_COST, missing: { stone: 15, drachmas: 30 }, ok: false },
      canAdvance: false,
    });
    const ready = advanceCheck(cityState(POLIS_COST, 20, true), 1)!;
    expect(ready).toMatchObject({ canAdvance: true, cost: { missing: {}, ok: true } });
  });
});

describe('trade', () => {
  function marketState(goods: Goods): GameState {
    const s = cityState(goods, 4);
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
    const none = cityState({ wood: 10 }, 4);
    expect(code(none, trade('wood', 'sell', 1))).toBe('noMarketplace');
    const far = cityState({ wood: 10 }, 4);
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
