import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { addBuilding, addRoad, at, makeTestState } from '../testing';
import { tileIndex } from '../map';
import { planRoad } from './roads';

const OPEN = ['ppppppp', 'ppppppp', 'ppppppp'];

describe('planRoad', () => {
  it('straight line: cost = number of new tiles', () => {
    const s = makeTestState(OPEN, { goods: { wood: 10 } });
    const r = planRoad(s, 0, at(0, 1), at(4, 1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.path).toHaveLength(5);
    expect(r.plan.newTiles).toHaveLength(5);
    expect(r.plan.cost).toEqual({ wood: 5 });
  });

  it('reuses existing roads for free', () => {
    const s = makeTestState(OPEN);
    addRoad(s, at(1, 1));
    addRoad(s, at(2, 1));
    const r = planRoad(s, 0, at(0, 1), at(4, 1));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.newTiles).toHaveLength(3);
    expect(r.plan.cost).toEqual({ wood: 3 });
  });

  it('passes through own buildings for free', () => {
    const s = makeTestState(OPEN);
    addBuilding(s, 'house', at(2, 1));
    const r = planRoad(s, 0, at(0, 1), at(4, 1));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.path.some((h) => h.q === at(2, 1).q && h.r === at(2, 1).r)).toBe(true);
    expect(r.plan.newTiles).toHaveLength(4);
  });

  it('empty plan when everything exists already', () => {
    const s = makeTestState(OPEN);
    addRoad(s, at(0, 1));
    addRoad(s, at(1, 1));
    const r = planRoad(s, 0, at(0, 1), at(1, 1));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.cost).toEqual({});
  });

  it('mountains, water and foreign territory are not usable', () => {
    const s = makeTestState(['pmp', 'pop', 'pcp']);
    expect(planRoad(s, 0, at(0, 0), at(1, 0))).toEqual({
      ok: false,
      error: { code: 'roadNotAllowed' },
    });
    expect(planRoad(s, 0, at(0, 0), at(1, 1)).ok).toBe(false);
    expect(planRoad(s, 0, at(0, 0), at(1, 2)).ok).toBe(false);
    const t = makeTestState(OPEN);
    t.territory[tileIndex(t.map, at(3, 1))] = 1;
    expect(planRoad(t, 0, at(0, 1), at(3, 1))).toEqual({
      ok: false,
      error: { code: 'roadNotAllowed' },
    });
  });

  it('a building of another player blocks a tile', () => {
    const s = makeTestState(OPEN);
    addBuilding(s, 'house', at(3, 1), 1);
    expect(planRoad(s, 0, at(0, 1), at(3, 1)).ok).toBe(false);
  });

  it('noPath when walled off', () => {
    const s = makeTestState(['pmp', 'pmp', 'pmp']);
    expect(planRoad(s, 0, at(0, 0), at(2, 0))).toEqual({ ok: false, error: { code: 'noPath' } });
  });

  it('is deterministic', () => {
    const s = makeTestState(OPEN);
    expect(planRoad(s, 0, at(0, 0), at(6, 2))).toEqual(planRoad(s, 0, at(0, 0), at(6, 2)));
  });
});

describe('buildRoad action', () => {
  it('pays and sets roads', () => {
    const s = makeTestState(OPEN, { goods: { wood: 10 } });
    const r = applyAction(s, { type: 'buildRoad', from: at(0, 1), to: at(3, 1) });
    if (!r.ok) throw new Error('expected ok');
    expect(r.state.players[0].goods.wood).toBe(6);
    expect(r.state.roads.filter(Boolean)).toHaveLength(4);
    expect(s.roads.some(Boolean)).toBe(false);
  });

  it('notAffordable reports what is missing', () => {
    const s = makeTestState(OPEN, { goods: { wood: 2 } });
    const r = applyAction(s, { type: 'buildRoad', from: at(0, 1), to: at(3, 1) });
    expect(r).toEqual({ ok: false, error: { code: 'notAffordable', missing: { wood: 2 } } });
  });
});
