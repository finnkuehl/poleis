import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { addBuilding, addCity, addRoad, at, makeTestState } from '../testing';
import { connectedBuildingIds } from './connection';
import { tileIndex } from '../map';
import { planRoad, roadConnection, roadField } from './roads';

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

  it('a road can end at an own mine on a mountain, which then connects', () => {
    const s = makeTestState(['ppppm'], { goods: { wood: 10 } });
    const center = addCity(s, at(0, 0));
    const mine = addBuilding(s, 'mine', at(4, 0));
    const r = planRoad(s, 0, at(0, 0), at(4, 0));
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.newTiles).toHaveLength(3);
    const built = applyAction(s, { type: 'buildRoad', from: at(0, 0), to: at(4, 0) });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(connectedBuildingIds(built.state, 0).has(mine)).toBe(true);
    expect(connectedBuildingIds(built.state, 0).has(center)).toBe(true);
  });

  it('a mountain without an own building is still not usable', () => {
    const s = makeTestState(['ppppm']);
    expect(planRoad(s, 0, at(0, 0), at(4, 0)).ok).toBe(false);
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

describe('roadField / roadConnection', () => {
  it('a tile next to the network needs no road', () => {
    const s = makeTestState(OPEN);
    addCity(s, at(0, 1), { radius: 6 });
    const field = roadField(s, 0);
    expect(roadConnection(s, field, at(1, 1))).toEqual({ cost: 0, target: null });
  });

  it('counts the new road tiles and names the end of the road', () => {
    const s = makeTestState(OPEN);
    addCity(s, at(0, 1), { radius: 6 });
    const field = roadField(s, 0);
    const info = roadConnection(s, field, at(4, 1));
    expect(info?.cost).toBe(3);
    expect(info?.target).toEqual(at(0, 1));
  });

  it('reuses an existing road', () => {
    const s = makeTestState(OPEN);
    addCity(s, at(0, 1), { radius: 6 });
    addRoad(s, at(1, 1));
    addRoad(s, at(2, 1));
    const info = roadConnection(s, roadField(s, 0), at(4, 1));
    expect(info?.cost).toBe(1);
    expect(info?.target).toEqual(at(2, 1));
  });

  it('is null when the network cannot be reached', () => {
    // An ocean strip separates the city from the tile.
    const s = makeTestState(['pppoppp', 'pppoppp', 'pppoppp']);
    addCity(s, at(0, 1), { radius: 6 });
    expect(roadConnection(s, roadField(s, 0), at(5, 1))).toBeNull();
  });
});
