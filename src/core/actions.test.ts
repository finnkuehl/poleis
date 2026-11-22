import { describe, expect, it } from 'vitest';
import { economyConfig } from '../data';
import { applyAction } from './actions';
import { range } from './hex';
import { inBounds, terrainAt, tileIndex } from './map';
import { findLandmasses } from './mapgen';
import { createGameState } from './state';
import { addBuilding, addCity, addRoad, at, makeTestState } from './testing';
import { endTurn } from './turn';

describe('createGameState sandbox', () => {
  it('starts with the big sandbox stock but the same city', () => {
    const normal = createGameState('sb');
    const sandbox = createGameState('sb', { sandbox: true });
    expect(sandbox.players[0].goods).toMatchObject(economyConfig.sandboxGoods);
    expect(sandbox.cities[0]).toEqual(normal.cities[0]);
    expect(sandbox.map).toEqual(normal.map);
  });
});

describe('createGameState', () => {
  const s = createGameState('start-city');
  it('creates the starting city with 4 residents and its territory', () => {
    expect(s.cities).toHaveLength(1);
    const city = s.cities[0];
    expect(city).toMatchObject({ id: 1, level: 'settlement', residents: 4 });
    expect(s.buildings[0].paused).toBe(false);
    for (let i = 0; i < s.territory.length; i++) {
      expect(s.tileCity[i] === city.id).toBe(s.territory[i] === 0);
    }
  });
  const center = s.buildings[0];

  it('places the city center on plains on the mainland', () => {
    expect(s.buildings).toHaveLength(1);
    expect(center.type).toBe('cityCenter');
    expect(center.owner).toBe(0);
    expect(terrainAt(s.map, center.hex)).toBe('plains');
    const mainland = findLandmasses(s.map)[0];
    expect(mainland.some((h) => h.q === center.hex.q && h.r === center.hex.r)).toBe(true);
    expect(s.nextId).toBe(2);
  });

  it('claims exactly the tiles within radius 2', () => {
    const expected = range(center.hex, 2).filter((h) => inBounds(s.map, h));
    const owned = s.territory.filter((o) => o === 0).length;
    expect(owned).toBe(expected.length);
    for (const h of expected) expect(s.territory[tileIndex(s.map, h)]).toBe(0);
  });

  it('has the start goods', () => {
    expect(s.players[0].goods.wood).toBe(20);
    expect(s.players[0].goods.stone).toBe(10);
  });

  it('is deterministic and JSON-safe', () => {
    expect(createGameState('start-city')).toEqual(s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('build', () => {
  it('pays, adds the building and increases ids', () => {
    const s = makeTestState(['ppppp', 'ppppp'], { goods: { wood: 10 } });
    const a = applyAction(s, { type: 'build', building: 'house', hex: at(1, 0) });
    if (!a.ok) throw new Error('expected ok');
    const b = applyAction(a.state, { type: 'build', building: 'house', hex: at(3, 0) });
    if (!b.ok) throw new Error('expected ok');
    expect(b.state.players[0].goods.wood).toBe(4);
    expect(b.state.buildings.map((x) => x.id)).toEqual([1, 2]);
  });

  it('returns the error and leaves the input untouched', () => {
    const s = makeTestState(['ppp'], { goods: { wood: 1 } });
    const copy = structuredClone(s);
    const r = applyAction(s, { type: 'build', building: 'house', hex: at(1, 0) });
    expect(r).toMatchObject({ ok: false, error: { code: 'notAffordable' } });
    expect(s).toEqual(copy);
    const r2 = applyAction(s, { type: 'build', building: 'house', hex: at(9, 9) });
    expect(r2).toMatchObject({ ok: false, error: { code: 'outOfBounds' } });
    expect(s).toEqual(copy);
  });
});

describe('demolish', () => {
  it('removes a building without refund', () => {
    const s = makeTestState(['ppp'], { goods: { wood: 5 } });
    addBuilding(s, 'house', at(1, 0));
    const r = applyAction(s, { type: 'demolish', hex: at(1, 0) });
    if (!r.ok) throw new Error('expected ok');
    expect(r.state.buildings).toHaveLength(0);
    expect(r.state.players[0].goods.wood).toBe(5 + 3 * economyConfig.demolishRefund);
    expect(s.buildings).toHaveLength(1);
  });

  it('removes a road', () => {
    const s = makeTestState(['ppp']);
    addRoad(s, at(1, 0));
    const r = applyAction(s, { type: 'demolish', hex: at(1, 0) });
    if (!r.ok) throw new Error('expected ok');
    expect(r.state.roads[1]).toBe(false);
  });

  it('refuses the city center and empty tiles', () => {
    const s = makeTestState(['ppp']);
    addBuilding(s, 'cityCenter', at(1, 0));
    expect(applyAction(s, { type: 'demolish', hex: at(1, 0) })).toEqual({
      ok: false,
      error: { code: 'cannotDemolishCityCenter' },
    });
    expect(applyAction(s, { type: 'demolish', hex: at(2, 0) })).toEqual({
      ok: false,
      error: { code: 'nothingToDemolish' },
    });
  });

  it('refuses a world wonder, finished or not', () => {
    const s = makeTestState(['ppp']);
    addBuilding(s, 'wonder', at(1, 0));
    expect(applyAction(s, { type: 'demolish', hex: at(1, 0) })).toEqual({
      ok: false,
      error: { code: 'cannotDemolishWonder' },
    });
    s.buildings[0].progress = 5;
    expect(applyAction(s, { type: 'demolish', hex: at(1, 0) })).toEqual({
      ok: false,
      error: { code: 'cannotDemolishWonder' },
    });
  });
});

describe('endTurn', () => {
  it('increments the turn, runs production and sets lastReport', () => {
    const s = makeTestState(['ppfpp'], { goods: { wood: 5 } });
    addCity(s, at(0, 0), { radius: 6 });
    addBuilding(s, 'woodcutter', at(1, 0));
    const next = endTurn(s);
    expect(next.turn).toBe(2);
    expect(next.players[0].goods.wood).toBe(7);
    expect(next.lastReport?.turn).toBe(2);
    expect(s.turn).toBe(1);
    expect(s.lastReport).toBeNull();
    expect(applyAction(s, { type: 'endTurn' })).toEqual({ ok: true, state: next });
  });
});

describe('togglePause', () => {
  it('pauses and resumes an own building with workers', () => {
    const s = makeTestState(['ppp']);
    addBuilding(s, 'farm', at(1, 0));
    const r = applyAction(s, { type: 'togglePause', hex: at(1, 0) });
    if (!r.ok) throw new Error('expected ok');
    expect(r.state.buildings[0].paused).toBe(true);
    expect(s.buildings[0].paused).toBe(false);
    const r2 = applyAction(r.state, { type: 'togglePause', hex: at(1, 0) });
    if (!r2.ok) throw new Error('expected ok');
    expect(r2.state.buildings[0].paused).toBe(false);
  });
  it('refuses empty tiles, foreign buildings and buildings without workers', () => {
    const s = makeTestState(['ppp']);
    addBuilding(s, 'farm', at(0, 0), 1);
    addBuilding(s, 'house', at(1, 0));
    const err = { ok: false, error: { code: 'cannotPause' } };
    expect(applyAction(s, { type: 'togglePause', hex: at(2, 0) })).toEqual(err);
    expect(applyAction(s, { type: 'togglePause', hex: at(0, 0) })).toEqual(err);
    expect(applyAction(s, { type: 'togglePause', hex: at(1, 0) })).toEqual(err);
  });
});

describe('setGoodPriority', () => {
  it('toggles a good on and off, keeping the list sorted and unique', () => {
    const s = makeTestState(['ppp']);
    const on = applyAction(s, { type: 'setGoodPriority', good: 'wood', low: true });
    if (!on.ok) throw new Error('expected ok');
    const on2 = applyAction(on.state, { type: 'setGoodPriority', good: 'stone', low: true });
    if (!on2.ok) throw new Error('expected ok');
    const again = applyAction(on2.state, { type: 'setGoodPriority', good: 'wood', low: true });
    if (!again.ok) throw new Error('expected ok');
    expect(again.state.players[0].lowPriorityGoods).toEqual(['stone', 'wood']);
    const off = applyAction(again.state, { type: 'setGoodPriority', good: 'wood', low: false });
    if (!off.ok) throw new Error('expected ok');
    expect(off.state.players[0].lowPriorityGoods).toEqual(['stone']);
    expect(s.players[0].lowPriorityGoods).toEqual([]);
  });
  it('refuses goods no building with workers produces, and is deterministic', () => {
    const s = makeTestState(['ppp']);
    expect(applyAction(s, { type: 'setGoodPriority', good: 'drachmas', low: true })).toEqual({
      ok: false,
      error: { code: 'cannotPrioritizeGood' },
    });
    const a = applyAction(s, { type: 'setGoodPriority', good: 'wood', low: true });
    const b = applyAction(s, { type: 'setGoodPriority', good: 'wood', low: true });
    expect(a).toEqual(b);
  });
});
