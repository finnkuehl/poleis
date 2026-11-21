import { describe, expect, it } from 'vitest';
import { applyAction, type Action } from '../actions';
import { GOOD_IDS, type Stock } from '../../data';
import { tileIndex } from '../map';
import type { GameState } from '../state';
import { addCity, addUnit, at, makeTestState } from '../testing';
import { planMoveOrder } from './orders';

const ROW = 'pppppppppp';

/** Applies an action that must succeed. */
function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`Action failed: ${r.error.code}`);
  return r.state;
}

/** A state with plenty of goods so that upkeep never kills a unit. */
function richState(rows: string[]): GameState {
  const s = makeTestState(rows);
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = 1000;
  s.players[0].goods = goods;
  return s;
}

/** Adds player 1 with a far-away city (a player without a city would be out of the game). */
const addPlayer1 = (s: GameState) => {
  s.players.push({
    id: 1,
    isHuman: false,
    civ: null,
    name: '',
    color: 1,
    alive: true,
    goods: { ...s.players[0].goods },
    explored: s.map.tiles.map(() => true),
  });
  addCity(s, at(s.map.width - 1, s.map.height - 1), { owner: 1, radius: 0 });
};

const unitOf = (s: GameState, id: number) => s.units.find((u) => u.id === id)!;

describe('planMoveOrder', () => {
  it('splits the walk into turns (scout, 3 moves per turn)', () => {
    const s = makeTestState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0));
    const r = planMoveOrder(s, id, at(7, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.path).toHaveLength(8);
    expect(r.plan.stops).toEqual([
      { hex: at(3, 0), turn: 0 },
      { hex: at(6, 0), turn: 1 },
      { hex: at(7, 0), turn: 2 },
    ]);
    expect(r.plan.turns).toBe(2);
  });

  it('has no turn-0 stop if the unit cannot move this turn', () => {
    const s = makeTestState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0), { movesLeft: 0, hasMoved: true });
    const r = planMoveOrder(s, id, at(3, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.stops).toEqual([{ hex: at(3, 0), turn: 1 }]);
    expect(r.plan.turns).toBe(1);
  });

  it('1-tile rule: a spearman crosses forest one tile per turn', () => {
    const s = makeTestState(['pfffp']);
    const id = addUnit(s, 'spearman', at(0, 0));
    const r = planMoveOrder(s, id, at(4, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.stops.map((x) => x.turn)).toEqual([0, 1, 2, 3]);
    expect(r.plan.stops.map((x) => x.hex)).toEqual([at(1, 0), at(2, 0), at(3, 0), at(4, 0)]);
  });

  it('reports errors', () => {
    const s = makeTestState(['pppcpp']);
    const id = addUnit(s, 'scout', at(0, 0));
    const code = (to: ReturnType<typeof at>) => {
      const r = planMoveOrder(s, id, to);
      return r.ok ? 'ok' : r.error.code;
    };
    expect(code(at(0, 0))).toBe('noPath');
    expect(code(at(3, 0))).toBe('noPath'); // water
    expect(code(at(20, 0))).toBe('noPath'); // out of bounds
    s.players[0].explored[tileIndex(s.map, at(2, 0))] = false;
    expect(code(at(2, 0))).toBe('noPath'); // not explored
    s.players[0].explored[tileIndex(s.map, at(2, 0))] = true;
    addUnit(s, 'spearman', at(2, 0), { owner: 1 });
    expect(code(at(2, 0))).toBe('destinationOccupied');
    expect(planMoveOrder(s, 999, at(2, 0))).toEqual({ ok: false, error: { code: 'notOwnUnit' } });
  });

  it('rejects an order for a foreign unit', () => {
    const s = makeTestState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0), { owner: 1 });
    const r = applyAction(s, { type: 'setOrder', unitId: id, to: at(3, 0) });
    expect(r).toEqual({ ok: false, error: { code: 'notOwnUnit' } });
  });
});

describe('setOrder action and endTurn', () => {
  it('walks right away and continues each turn until it arrives', () => {
    let s = richState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(7, 0) });
    expect(unitOf(s, id).hex).toEqual(at(3, 0));
    expect(unitOf(s, id).order).not.toBeNull();
    s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).hex).toEqual(at(6, 0));
    expect(s.lastReport?.orders).toEqual([]);
    s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).hex).toEqual(at(7, 0));
    expect(unitOf(s, id).order).toBeNull();
    expect(s.lastReport?.orders).toEqual([{ unitId: id, unitType: 'scout', outcome: 'arrived' }]);
  });

  it('stops with "blocked" when a unit stands in the way', () => {
    let s = richState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(7, 0) });
    addUnit(s, 'spearman', at(5, 0));
    s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).order).toBeNull();
    expect(unitOf(s, id).hex).toEqual(at(3, 0));
    expect(s.lastReport?.orders).toEqual([{ unitId: id, unitType: 'scout', outcome: 'blocked' }]);
  });
});

describe('enemies', () => {
  it('an enemy that was already visible does not stop the walk', () => {
    let s = richState([ROW, ROW, ROW]);
    addPlayer1(s);
    const id = addUnit(s, 'scout', at(0, 1));
    addUnit(s, 'spearman', at(1, 0), { owner: 1 });
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 1) });
    expect(unitOf(s, id).hex).not.toEqual(at(0, 1));
    expect(unitOf(s, id).order).not.toBeNull();
    for (let i = 0; i < 5 && unitOf(s, id).order; i++) s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).hex).toEqual(at(8, 1));
    expect(s.lastReport?.orders.at(-1)?.outcome).toBe('arrived');
  });

  it('an enemy that comes into sight stops the unit where it first sees it', () => {
    let s = richState([ROW + 'pp']);
    addPlayer1(s);
    const id = addUnit(s, 'scout', at(0, 0));
    addUnit(s, 'spearman', at(8, 0), { owner: 1 });
    s = act(s, { type: 'setOrder', unitId: id, to: at(7, 0) });
    expect(unitOf(s, id).hex).toEqual(at(3, 0));
    s = act(s, { type: 'endTurn' });
    // Vision is 2 tiles: the enemy on col 8 is first seen from col 6.
    expect(unitOf(s, id).hex).toEqual(at(6, 0));
    expect(unitOf(s, id).order).toBeNull();
    expect(s.lastReport?.orders).toEqual([
      { unitId: id, unitType: 'scout', outcome: 'enemySpotted' },
    ]);
  });

  it('an enemy that moves into sight between turns stops the unit before it walks', () => {
    let s = richState([ROW]);
    addPlayer1(s);
    const id = addUnit(s, 'scout', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 0) });
    addUnit(s, 'spearman', at(5, 0), { owner: 1 });
    s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).hex).toEqual(at(3, 0));
    expect(s.lastReport?.orders).toEqual([
      { unitId: id, unitType: 'scout', outcome: 'enemySpotted' },
    ]);
  });
});

describe('fog of war', () => {
  it('an unseen enemy does not change the planned path (no information leak)', () => {
    const without = makeTestState([ROW]);
    const idA = addUnit(without, 'scout', at(0, 0));
    const withEnemy = makeTestState([ROW]);
    const idB = addUnit(withEnemy, 'scout', at(0, 0));
    addUnit(withEnemy, 'spearman', at(6, 0), { owner: 1 });
    const a = planMoveOrder(without, idA, at(8, 0));
    const b = planMoveOrder(withEnemy, idB, at(8, 0));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.plan.path).toEqual(a.plan.path);
  });

  it('the walk stops in front of an unseen enemy as soon as it is seen', () => {
    let s = richState([ROW]);
    addPlayer1(s);
    const id = addUnit(s, 'scout', at(0, 0));
    addUnit(s, 'spearman', at(6, 0), { owner: 1 });
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 0) });
    s = act(s, { type: 'endTurn' });
    // It sees the enemy from col 4 (distance 2), long before it could bump into it.
    expect(unitOf(s, id).hex).toEqual(at(4, 0));
    expect(s.lastReport?.orders[0].outcome).toBe('enemySpotted');
  });
});

describe('ending an order', () => {
  it('a manual move clears the order', () => {
    let s = richState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 0) });
    s = act(s, { type: 'endTurn' });
    // The walk used up the moves; give them back for the manual move.
    Object.assign(unitOf(s, id), { movesLeft: 3, hasMoved: false });
    s = act(s, { type: 'move', unitId: id, to: at(7, 0) });
    expect(unitOf(s, id).order).toBeNull();
  });

  it('cancelOrder clears the order (also if there is none)', () => {
    let s = richState([ROW]);
    const id = addUnit(s, 'scout', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 0) });
    s = act(s, { type: 'cancelOrder', unitId: id });
    expect(unitOf(s, id).order).toBeNull();
    s = act(s, { type: 'cancelOrder', unitId: id });
    const foreign = addUnit(s, 'scout', at(0, 0), { owner: 1 });
    expect(applyAction(s, { type: 'cancelOrder', unitId: foreign })).toEqual({
      ok: false,
      error: { code: 'notOwnUnit' },
    });
  });

  it('an attack on a unit with an order clears it', () => {
    let s = richState([ROW]);
    addPlayer1(s);
    const id = addUnit(s, 'scout', at(0, 0), { hp: 100 });
    s = act(s, { type: 'setOrder', unitId: id, to: at(8, 0) });
    const attacker = addUnit(s, 'spearman', at(4, 0), { owner: 1 });
    s.currentPlayer = 1;
    s = act(s, { type: 'attack', unitId: attacker, targetId: id });
    expect(unitOf(s, id).order).toBeNull();
  });
});

describe('determinism and capture', () => {
  it('same setup and actions give the same state', () => {
    const run = () => {
      let s = richState([ROW, ROW]);
      const id = addUnit(s, 'scout', at(0, 0));
      s = act(s, { type: 'setOrder', unitId: id, to: at(9, 1) });
      s = act(s, { type: 'endTurn' });
      s = act(s, { type: 'endTurn' });
      return act(s, { type: 'endTurn' });
    };
    expect(run()).toEqual(run());
  });

  it('a unit that arrives on an enemy city center starts capturing', () => {
    let s = richState([ROW]);
    addPlayer1(s);
    const city = addCity(s, at(5, 0), { owner: 1 });
    const id = addUnit(s, 'spearman', at(0, 0));
    s = act(s, { type: 'setOrder', unitId: id, to: at(5, 0) });
    for (let i = 0; i < 6 && unitOf(s, id).order; i++) s = act(s, { type: 'endTurn' });
    expect(unitOf(s, id).hex).toEqual(at(5, 0));
    expect(unitOf(s, id).capturing).toBe(city);
  });
});
