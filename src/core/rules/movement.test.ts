import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { hexEquals } from '../hex';
import { addRoad, addUnit, at, makeTestState } from '../testing';
import { reachableTiles } from './movement';

const costTo = (s: ReturnType<typeof makeTestState>, id: number, col: number, row = 0) =>
  reachableTiles(s, id).find((r) => hexEquals(r.hex, at(col, row)))?.cost;

describe('reachableTiles', () => {
  it('plains cost 1 per tile, scout (3 moves) goes 3 tiles', () => {
    const s = makeTestState(['pppppppp']);
    const id = addUnit(s, 'scout', at(0, 0));
    expect(costTo(s, id, 3)).toBe(3);
    expect(costTo(s, id, 4)).toBeUndefined();
  });

  it('forest costs 2: scout can go plains + forest', () => {
    const s = makeTestState(['ppfpp']);
    const id = addUnit(s, 'scout', at(0, 0));
    expect(costTo(s, id, 2)).toBe(3);
    expect(costTo(s, id, 3)).toBeUndefined();
  });

  it('roads halve the cost (minimum 0.5)', () => {
    const s = makeTestState(['pppppp']);
    for (const c of [1, 2, 3, 4]) addRoad(s, at(c, 0));
    const id = addUnit(s, 'scout', at(0, 0));
    expect(costTo(s, id, 1)).toBe(0.5);
    expect(costTo(s, id, 4)).toBe(2);
    expect(costTo(s, id, 5)).toBe(3);
  });

  it('water and mountains block', () => {
    const s = makeTestState(['pmpcp']);
    const id = addUnit(s, 'scout', at(0, 0));
    expect(costTo(s, id, 1)).toBeUndefined();
    const t = makeTestState(['ppcpp']);
    const id2 = addUnit(t, 'scout', at(1, 0));
    expect(costTo(t, id2, 2)).toBeUndefined();
    expect(costTo(t, id2, 3)).toBeUndefined();
  });

  it('another unit blocks its tile', () => {
    const s = makeTestState(['ppp']);
    const id = addUnit(s, 'scout', at(0, 0));
    addUnit(s, 'spearman', at(1, 0), { owner: 1 });
    expect(costTo(s, id, 1)).toBeUndefined();
  });

  it('1-tile rule: a 1-move unit may enter forest/hills once, then has 0 moves', () => {
    const s = makeTestState(['pfh']);
    const id = addUnit(s, 'spearman', at(0, 0));
    expect(costTo(s, id, 1)).toBe(2);
    const res = applyAction(s, { type: 'move', unitId: id, to: at(1, 0) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const u = res.state.units[0];
    expect(u.movesLeft).toBe(0);
    expect(u.hasMoved).toBe(true);
    expect(u.acted).toBe(true);
    expect(reachableTiles(res.state, id)).toEqual([]);
    // The rule does not apply to a second step.
    expect(costTo(s, id, 2)).toBeUndefined();
  });
});

describe('move action', () => {
  it('moves, pays the cost and does not mutate the input', () => {
    const s = makeTestState(['pppp']);
    const id = addUnit(s, 'scout', at(0, 0));
    const res = applyAction(s, { type: 'move', unitId: id, to: at(2, 0) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.units[0]).toMatchObject({ hex: at(2, 0), movesLeft: 1, hasMoved: true });
    expect(s.units[0].hex).toEqual(at(0, 0));
  });

  it('errors for foreign or unknown units and unreachable targets', () => {
    const s = makeTestState(['pppppp']);
    const own = addUnit(s, 'spearman', at(0, 0));
    const foreign = addUnit(s, 'spearman', at(3, 0), { owner: 1 });
    const unknown = applyAction(s, { type: 'move', unitId: 99, to: at(1, 0) });
    expect(unknown.ok === false && unknown.error.code).toBe('notOwnUnit');
    const other = applyAction(s, { type: 'move', unitId: foreign, to: at(4, 0) });
    expect(other.ok === false && other.error.code).toBe('notOwnUnit');
    const far = applyAction(s, { type: 'move', unitId: own, to: at(2, 0) });
    expect(far.ok === false && far.error.code).toBe('cannotReach');
  });
});
