// Integration: whole economy flows, driven only through applyAction.

import { describe, expect, it } from 'vitest';
import type { Goods } from '../data';
import { applyAction, type Action } from './actions';
import { checkPlacement, validPlacements } from './rules';
import type { BuildingStatus } from './rules';
import { createGameState, type GameState } from './state';
import { addBuilding, addCity, at, makeTestState } from './testing';

function run(state: GameState, ...actions: Action[]): GameState {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`action ${JSON.stringify(a)} failed: ${r.error.code}`);
    s = r.state;
  }
  return s;
}

function statusOf(s: GameState, id: number): BuildingStatus | undefined {
  return s.lastReport?.buildings.find((b) => b.buildingId === id)?.status;
}

function setup(rows: string[], wood = 20, stone = 10, extra: Goods = {}): GameState {
  const s = makeTestState(rows, { goods: { wood, stone, ...extra }, ownAll: false });
  addCity(s, at(1, 1), { radius: 6 });
  return s;
}

describe('economy flow', () => {
  it('woodcutter next to the city center: wood = 20 - 2 + 2', () => {
    const s = setup(['pppppp', 'pppfpp', 'pppppp']);
    const t = run(s, { type: 'build', building: 'woodcutter', hex: at(2, 1) }, { type: 'endTurn' });
    expect(t.players[0].goods.wood).toBe(20);
    expect(t.turn).toBe(2);
  });

  it('sawmill needs a road, then turns wood into planks in the same turn', () => {
    const s = setup(['ppppppppp', 'ppppppppp', 'ppppppppp']);
    let t = run(s, { type: 'build', building: 'sawmill', hex: at(6, 1) }, { type: 'endTurn' });
    const sawmillId = t.buildings.find((b) => b.type === 'sawmill')!.id;
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'notConnected' });
    t = run(t, { type: 'buildRoad', from: at(1, 1), to: at(6, 1) }, { type: 'endTurn' });
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'producing' });
    expect(t.players[0].goods.planks).toBe(2);
  });

  it('workers: 4 residents, a 5th worker waits until a house is built and the city grew', () => {
    // City center at (1,1); all builds below are direct neighbors of it. Grain feeds the city.
    const s = setup(['phpp', 'pppf', 'pppp'], 40, 20, { grain: 20 });
    let t = run(
      s,
      { type: 'build', building: 'farm', hex: at(0, 1) },
      { type: 'build', building: 'woodcutter', hex: at(2, 1) },
      { type: 'build', building: 'quarry', hex: at(1, 0) },
      { type: 'build', building: 'sawmill', hex: at(1, 2) },
      { type: 'endTurn' },
    );
    const sawmillId = t.buildings.find((b) => b.type === 'sawmill')!.id;
    expect(statusOf(t, sawmillId)).toMatchObject({ kind: 'missingWorkers' });
    t = run(t, { type: 'build', building: 'house', hex: at(2, 0) }, { type: 'endTurn' });
    // The house gives room, but the 5th resident only moves in at the end of this turn.
    expect(statusOf(t, sawmillId)).toMatchObject({ kind: 'missingWorkers' });
    expect(t.cities[0].residents).toBe(5);
    t = run(t, { type: 'endTurn' });
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'producing' });
  });
});

describe('turn order', () => {
  it('grain grown in this turn can be eaten in the same turn; delta is combined', () => {
    const s = makeTestState(['ppppp']);
    addCity(s, at(0, 0), { radius: 4 });
    addBuilding(s, 'farm', at(1, 0)); // 4 grain, 2 workers
    const t = run(s, { type: 'endTurn' });
    // 4 grain from the farm + 2 from the city center, 2 eaten (4 residents), 4 kept; 4 -> 4 residents (no free housing).
    expect(t.players[0].goods.grain).toBe(4);
    expect(t.players[0].goods.drachmas).toBe(3);
    expect(t.lastReport?.delta).toEqual({ grain: 4, drachmas: 3 });
    expect(t.lastReport?.cities).toHaveLength(1);
    expect(t.lastReport?.cities[0]).toMatchObject({ fed: true, foodEaten: { grain: 2 }, taxes: 3 });
  });
});

describe('city center grain', () => {
  it('a new game without other food keeps its 4 residents fed', () => {
    let s = createGameState('grain-test');
    for (let i = 0; i < 6; i++) {
      s = run(s, { type: 'endTurn' });
      expect(s.cities[0].residents).toBe(4);
    }
  });
  it('2 residents are fed by the city center grain alone', () => {
    const s = makeTestState(['ppppp']);
    addCity(s, at(0, 0), { radius: 2 });
    s.cities[0].residents = 2;
    const t = run(s, { type: 'endTurn' });
    expect(t.lastReport?.cities[0]).toMatchObject({ fed: true, foodEaten: { grain: 1 } });
    expect(t.players[0].goods.grain).toBe(1);
  });
});

describe('determinism', () => {
  it('same seed + same actions = same state', () => {
    const play = (): GameState => {
      let s = createGameState('det');
      s = run(
        s,
        { type: 'build', building: 'house', hex: validPlacements(s, 0, 'house')[0] },
        { type: 'endTurn' },
        { type: 'endTurn' },
      );
      return s;
    };
    expect(play()).toEqual(play());
  });
});

describe('advancing to polis', () => {
  it('grow to 20 residents, supply oil 3 turns, advance, then build a vineyard on hills', () => {
    const s = makeTestState(['hpppppp', 'pppppppp'.slice(0, 7), 'ppppppp'], {
      goods: { grain: 200, oil: 60, planks: 40, stone: 40, drachmas: 30, wood: 30 },
      ownAll: false,
    });
    addCity(s, at(3, 1), { radius: 4 });
    for (const h of [at(2, 1), at(4, 1), at(2, 0), at(4, 0)]) addBuilding(s, 'house', h);
    // 4 houses + city center = 28 housing; the city grows by 1 per turn, from 4 to 20 in 16 turns.
    let t = s;
    for (let i = 0; i < 16; i++) t = run(t, { type: 'endTurn' });
    expect(t.cities[0].residents).toBe(20);
    expect(t.cities[0].supplyStreak).toBeGreaterThanOrEqual(3);
    t = run(t, { type: 'advanceCity', cityId: t.cities[0].id });
    expect(t.cities[0].level).toBe('polis');
    expect(checkPlacement(t, 0, 'vineyard', at(0, 0))).toBeNull();
    t = run(t, { type: 'build', building: 'vineyard', hex: at(0, 0) });
    expect(t.buildings.some((b) => b.type === 'vineyard')).toBe(true);
  });
});
