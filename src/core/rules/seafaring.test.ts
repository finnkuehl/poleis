// M6 seafaring: ships, boarding, landing, ship combat, harbor.

import { describe, expect, it } from 'vitest';
import { applyAction, type Action } from '../actions';
import { hexEquals, neighbors } from '../hex';
import { tileIndex } from '../map';
import type { GameState } from '../state';
import { addBuilding, addCity, addRoad, addUnit, at, makeTestState } from '../testing';
import { GOOD_IDS, UNITS, type Stock } from '../../data';
import { attackTargets, combatPreview } from './combat';
import { connectedBuildingIds } from './connection';
import { checkPlacement } from './placement';
import { planMoveOrder } from './orders';
import { passengersOf, reachableTiles, unitAt } from './movement';
import { visibleTiles } from './vision';
import { endTurn } from '../turn';

/** Mainland (cols 0-1), a strait (cols 2-4, coast), an island (cols 5-8). */
const STRAIT = ['ppcccpppp', 'ppcccpppp', 'ppcccpppp', 'ppcccpppp', 'ppcccpppp'];

function rich(rows: string[]): GameState {
  const s = makeTestState(rows);
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = 1000;
  s.players[0].goods = goods;
  return s;
}

function addEnemy(s: GameState): void {
  s.players.push({
    id: 1,
    isHuman: false,
    civ: null,
    name: '',
    color: 1,
    alive: true,
    goods: { ...s.players[0].goods },
    explored: s.map.tiles.map(() => true),
    lowPriorityGoods: [],
  });
  // A player without a city is out of the game (its units would disappear).
  addCity(s, at(s.map.width - 1, 0), { owner: 1, radius: 0 });
}

function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`Action failed: ${r.error.code}`);
  return r.state;
}

const codeOf = (s: GameState, a: Action): string => {
  const r = applyAction(s, a);
  return r.ok ? 'ok' : r.error.code;
};

const move = (unitId: number, col: number, row: number): Action => ({
  type: 'move',
  unitId,
  to: at(col, row),
});
const unitOf = (s: GameState, id: number) => s.units.find((u) => u.id === id)!;
const has = (s: GameState, id: number, col: number, row: number) =>
  reachableTiles(s, id).some((r) => hexEquals(r.hex, at(col, row)));

describe('movement domains', () => {
  it('ships sail on water for 1 point per tile and never enter land', () => {
    const s = makeTestState(STRAIT);
    const ship = addUnit(s, 'transport', at(3, 2));
    const tiles = reachableTiles(s, ship);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(['coast', 'ocean']).toContain(s.map.tiles[tileIndex(s.map, t.hex)]);
      expect(t.kind).toBeUndefined();
    }
    expect(tiles.find((t) => hexEquals(t.hex, at(4, 2)))?.cost).toBe(1);
    expect(has(s, ship, 5, 2)).toBe(false);
    expect(has(s, ship, 1, 2)).toBe(false);
  });

  it('land units never enter water on their own', () => {
    const s = makeTestState(STRAIT);
    const scout = addUnit(s, 'scout', at(1, 2));
    expect(has(s, scout, 2, 2)).toBe(false);
    expect(codeOf(s, move(scout, 2, 2))).toBe('cannotReach');
  });

  it('roads do not matter at sea; ships are blocked by other units', () => {
    const s = makeTestState(STRAIT);
    addRoad(s, at(2, 2));
    const ship = addUnit(s, 'trireme', at(3, 2));
    expect(reachableTiles(s, ship).find((t) => hexEquals(t.hex, at(2, 2)))?.cost).toBe(1);
    addUnit(s, 'trireme', at(4, 2));
    expect(has(s, ship, 4, 2)).toBe(false);
  });

  it('ships follow multi-turn move orders over water', () => {
    const s = rich(['pccccccccc']);
    addCity(s, at(0, 0), { radius: 0 });
    const ship = addUnit(s, 'transport', at(1, 0));
    const plan = planMoveOrder(s, ship, at(9, 0));
    expect(plan.ok && plan.plan.turns).toBe(2);
    let t = act(s, { type: 'setOrder', unitId: ship, to: at(9, 0) });
    expect(unitOf(t, ship).hex).toEqual(at(4, 0));
    t = act(t, { type: 'endTurn' });
    expect(unitOf(t, ship).hex).toEqual(at(7, 0));
    t = act(t, { type: 'endTurn' });
    expect(unitOf(t, ship).hex).toEqual(at(9, 0));
    expect(unitOf(t, ship).order).toBeNull();
  });

  it('a ship cannot be ordered to land, a land unit not to water', () => {
    const s = makeTestState(STRAIT);
    const ship = addUnit(s, 'transport', at(3, 2));
    const scout = addUnit(s, 'scout', at(0, 0));
    const toLand = planMoveOrder(s, ship, at(6, 2));
    expect(toLand.ok).toBe(false);
    expect(planMoveOrder(s, scout, at(3, 2)).ok).toBe(false);
  });
});

describe('boarding', () => {
  it('a land unit boards an adjacent own transport and its move ends', () => {
    const s = makeTestState(STRAIT);
    const ship = addUnit(s, 'transport', at(2, 2));
    const settler = addUnit(s, 'settler', at(1, 2));
    expect(reachableTiles(s, settler).find((r) => hexEquals(r.hex, at(2, 2)))?.kind).toBe('board');
    const t = act(s, move(settler, 2, 2));
    const u = unitOf(t, settler);
    expect(u.aboard).toBe(ship);
    expect(u.hex).toEqual(at(2, 2));
    expect(u.movesLeft).toBe(0);
    expect(u.hasMoved).toBe(true);
    expect(passengersOf(t, ship).map((p) => p.id)).toEqual([settler]);
    // The ship is the unit on the tile, not the passenger.
    expect(unitAt(t, at(2, 2))?.id).toBe(ship);
    // The move is over.
    expect(reachableTiles(t, settler)).toEqual([]);
  });

  it('even a fast unit that boarded cannot go on this turn', () => {
    const s = makeTestState(STRAIT);
    addUnit(s, 'transport', at(2, 2));
    const scout = addUnit(s, 'scout', at(1, 2));
    const t = act(s, move(scout, 2, 2));
    expect(unitOf(t, scout).movesLeft).toBe(0);
    expect(codeOf(t, move(scout, 1, 2))).toBe('cannotReach');
  });

  it('the capacity is 2', () => {
    const s = makeTestState(STRAIT);
    const ship = addUnit(s, 'transport', at(2, 2));
    const a = addUnit(s, 'settler', at(1, 2));
    const b = addUnit(s, 'spearman', at(1, 1));
    const c = addUnit(s, 'archer', at(1, 3));
    let t = act(s, move(a, 2, 2));
    t = act(t, move(b, 2, 2));
    expect(passengersOf(t, ship)).toHaveLength(2);
    expect(codeOf(t, move(c, 2, 2))).toBe('shipFull');
    expect(UNITS.transport.capacity).toBe(2);
  });

  it('needs adjacency and an own ship', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    addUnit(s, 'transport', at(3, 2));
    const far = addUnit(s, 'scout', at(1, 2));
    expect(codeOf(s, move(far, 3, 2))).toBe('cannotReach');
    addUnit(s, 'transport', at(2, 4), { owner: 1 });
    const near = addUnit(s, 'scout', at(1, 4));
    expect(codeOf(s, move(near, 2, 4))).toBe('cannotReach');
  });

  it('other ships (trireme) take no passengers', () => {
    const s = makeTestState(STRAIT);
    addUnit(s, 'trireme', at(2, 2));
    const scout = addUnit(s, 'scout', at(1, 2));
    expect(codeOf(s, move(scout, 2, 2))).toBe('cannotReach');
  });
});

describe('landing', () => {
  /** A transport at (4,2) with a settler aboard that has full moves (next turn). */
  function ferry() {
    const s = makeTestState(STRAIT);
    const ship = addUnit(s, 'transport', at(4, 2));
    const settler = addUnit(s, 'settler', at(4, 2));
    unitOf(s, settler).aboard = ship;
    return { s, ship, settler };
  }

  it('lands on an adjacent free land tile and the move ends', () => {
    const { s, settler } = ferry();
    expect(reachableTiles(s, settler).find((r) => hexEquals(r.hex, at(5, 2)))?.kind).toBe('land');
    const t = act(s, move(settler, 5, 2));
    const u = unitOf(t, settler);
    expect(u.aboard).toBeNull();
    expect(u.hex).toEqual(at(5, 2));
    expect(u.movesLeft).toBe(0);
    expect(unitAt(t, at(5, 2))?.id).toBe(settler);
  });

  it('cannot land the turn it boarded', () => {
    const s = makeTestState(STRAIT);
    addUnit(s, 'transport', at(2, 2));
    const settler = addUnit(s, 'settler', at(1, 2));
    const t = act(s, move(settler, 2, 2));
    expect(codeOf(t, move(settler, 1, 2))).toBe('cannotReach');
  });

  it('needs free land: not water, not far, not an occupied tile', () => {
    const { s, settler } = ferry();
    expect(codeOf(s, move(settler, 3, 2))).toBe('cannotReach');
    expect(codeOf(s, move(settler, 7, 2))).toBe('cannotReach');
    addEnemy(s);
    addUnit(s, 'spearman', at(5, 2), { owner: 1 });
    expect(codeOf(s, move(settler, 5, 2))).toBe('cannotReach');
  });

  it('cannot land on mountains', () => {
    const s = makeTestState(['cc', 'mc']);
    const ship = addUnit(s, 'transport', at(1, 0));
    const scout = addUnit(s, 'scout', at(1, 0));
    unitOf(s, scout).aboard = ship;
    expect(neighbors(at(1, 0)).some((n) => hexEquals(n, at(0, 1)))).toBe(true);
    expect(reachableTiles(s, scout)).toEqual([]);
  });

  it('a unit that stepped onto the enemy city center starts capturing', () => {
    const s = makeTestState(['ccp']);
    addEnemy(s);
    addCity(s, at(2, 0), { owner: 1, radius: 0 });
    const ship = addUnit(s, 'transport', at(1, 0));
    const spear = addUnit(s, 'spearman', at(1, 0));
    unitOf(s, spear).aboard = ship;
    const t = act(s, move(spear, 2, 0));
    expect(unitOf(t, spear).capturing).not.toBeNull();
  });
});

describe('ships carry their passengers', () => {
  it('passengers travel with the ship (also with an order) and the ship can still sail', () => {
    const s = rich(STRAIT);
    addCity(s, at(0, 0), { radius: 1 });
    const ship = addUnit(s, 'transport', at(2, 2));
    const settler = addUnit(s, 'settler', at(1, 2));
    let t = act(s, move(settler, 2, 2));
    // Same turn: sail on.
    t = act(t, move(ship, 4, 2));
    expect(unitOf(t, ship).hex).toEqual(at(4, 2));
    expect(unitOf(t, settler).hex).toEqual(at(4, 2));
    expect(unitOf(t, settler).aboard).toBe(ship);
    // Order for the ship: passengers follow every turn.
    t = act(t, { type: 'endTurn' });
    t = act(t, { type: 'setOrder', unitId: ship, to: at(3, 4) });
    expect(unitOf(t, settler).hex).toEqual(unitOf(t, ship).hex);
    expect(unitOf(t, ship).hex).toEqual(at(3, 4));
  });

  it('passengers have no orders and cannot found cities or attack', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const ship = addUnit(s, 'transport', at(4, 2));
    const settler = addUnit(s, 'settler', at(4, 2));
    const archer = addUnit(s, 'archer', at(4, 2));
    unitOf(s, settler).aboard = ship;
    unitOf(s, archer).aboard = ship;
    const foe = addUnit(s, 'spearman', at(5, 2), { owner: 1 });
    expect(codeOf(s, { type: 'setOrder', unitId: settler, to: at(7, 2) })).toBe(
      'passengerCannotAct',
    );
    expect(codeOf(s, { type: 'foundCity', unitId: settler })).toBe('passengerCannotAct');
    expect(codeOf(s, { type: 'attack', unitId: archer, targetId: foe })).toBe('passengerCannotAct');
    expect(attackTargets(s, archer)).toEqual([]);
  });
});

describe('ship combat', () => {
  it('a trireme attacks ships and land units next to the water', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const tri = addUnit(s, 'trireme', at(3, 2));
    const ship = addUnit(s, 'transport', at(4, 2), { owner: 1 });
    const shore = addUnit(s, 'spearman', at(5, 3), { owner: 1 });
    const inland = addUnit(s, 'spearman', at(7, 2), { owner: 1 });
    const targets = attackTargets(s, tri).map((u) => u.id);
    expect(targets).toContain(ship);
    expect(targets).not.toContain(inland);
    // A land unit next to the water: move the trireme next to it.
    unitOf(s, tri).hex = at(4, 3);
    expect(attackTargets(s, tri).map((u) => u.id)).toContain(shore);
    const r = applyAction(s, { type: 'attack', unitId: tri, targetId: ship });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // A transport (8 HP) is no match for a trireme: it sinks and cannot counter.
      expect(r.state.units.some((u) => u.id === ship)).toBe(false);
      expect(unitOf(r.state, tri).hp).toBe(UNITS.trireme.hp);
    }
  });

  it('archers shoot ships within range 2; melee units cannot attack ships', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const archer = addUnit(s, 'archer', at(1, 2));
    const spear = addUnit(s, 'spearman', at(1, 3));
    const ship = addUnit(s, 'transport', at(3, 2), { owner: 1 });
    expect(attackTargets(s, archer).map((u) => u.id)).toEqual([ship]);
    const hit = applyAction(s, { type: 'attack', unitId: archer, targetId: ship });
    expect(hit.ok).toBe(true);
    // The spearman is next to a ship (distance 1) but must be refused with the right reason.
    unitOf(s, ship).hex = at(2, 3);
    expect(attackTargets(s, spear)).toEqual([]);
    expect(codeOf(s, { type: 'attack', unitId: spear, targetId: ship })).toBe('cannotAttackShip');
  });

  it('transports cannot attack; ships never capture', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const ship = addUnit(s, 'transport', at(4, 2));
    const foe = addUnit(s, 'spearman', at(5, 2), { owner: 1 });
    expect(codeOf(s, { type: 'attack', unitId: ship, targetId: foe })).toBe('notInRange');
    expect(UNITS.transport.canCapture).toBe(false);
    expect(UNITS.trireme.canCapture).toBe(false);
  });

  it('passengers cannot be attacked directly; the ship takes the hit', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const ship = addUnit(s, 'transport', at(4, 2));
    const settler = addUnit(s, 'settler', at(4, 2));
    unitOf(s, settler).aboard = ship;
    const tri = addUnit(s, 'trireme', at(3, 2), { owner: 1 });
    s.currentPlayer = 1;
    expect(attackTargets(s, tri).map((u) => u.id)).toEqual([ship]);
    expect(codeOf(s, { type: 'attack', unitId: tri, targetId: settler })).toBe('notEnemy');
  });

  it('sinking a ship kills its passengers', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const ship = addUnit(s, 'transport', at(4, 2), { hp: 1 });
    const a = addUnit(s, 'settler', at(4, 2));
    const b = addUnit(s, 'scout', at(4, 2));
    unitOf(s, a).aboard = ship;
    unitOf(s, b).aboard = ship;
    const tri = addUnit(s, 'trireme', at(3, 2), { owner: 1 });
    s.currentPlayer = 1;
    const t = act(s, { type: 'attack', unitId: tri, targetId: ship });
    expect(t.units.map((u) => u.id)).toEqual([tri]);
  });

  it('a ship that starves to death takes its passengers down', () => {
    const s = makeTestState(STRAIT);
    addCity(s, at(0, 0), { radius: 0 });
    const ship = addUnit(s, 'transport', at(4, 2), { hp: 2, acted: true });
    const a = addUnit(s, 'scout', at(4, 2), { acted: true });
    unitOf(s, a).aboard = ship;
    const t = endTurn(s);
    expect(t.units).toEqual([]);
    expect(t.lastReport?.units.lost).toBe(2);
  });

  it('the preview treats ships as water units (no terrain bonus)', () => {
    const s = makeTestState(STRAIT);
    addEnemy(s);
    const tri = addUnit(s, 'trireme', at(3, 2));
    const ship = addUnit(s, 'transport', at(4, 2), { owner: 1 });
    const p = combatPreview(s, tri, ship);
    expect(p.damage).toBeGreaterThan(0);
    expect(p.counter).toBe(0);
  });
});

describe('harbor', () => {
  function port(level: 'settlement' | 'polis' | 'metropolis' = 'polis') {
    const s = makeTestState(STRAIT, {
      goods: { planks: 50, bronze: 50, stone: 50, bread: 50 },
    });
    addCity(s, at(0, 2), { level, radius: 2 });
    const harbor = addBuilding(s, 'harbor', at(1, 2));
    return { s, harbor };
  }

  it('is built on plains next to coast, from Polis', () => {
    const s = makeTestState(STRAIT, { goods: { planks: 50, stone: 50 } });
    addCity(s, at(0, 2), { level: 'polis', radius: 3 });
    expect(checkPlacement(s, 0, 'harbor', at(1, 2))).toBeNull();
    expect(checkPlacement(s, 0, 'harbor', at(0, 1))?.code).toBe('needsNeighbor');
    expect(checkPlacement(s, 0, 'harbor', at(3, 2))?.code).toBe('wrongTerrain');
    const low = makeTestState(STRAIT, { goods: { planks: 50, stone: 50 } });
    addCity(low, at(0, 2), { level: 'settlement', radius: 3 });
    expect(checkPlacement(low, 0, 'harbor', at(1, 2))?.code).toBe('levelTooLow');
  });

  it('is a connection point like a storehouse', () => {
    const s = makeTestState(['pppppppp']);
    addBuilding(s, 'cityCenter', at(0, 0));
    const harbor = addBuilding(s, 'harbor', at(5, 0));
    const farm = addBuilding(s, 'farm', at(6, 0));
    const ids = connectedBuildingIds(s, 0);
    expect(ids.has(harbor)).toBe(true);
    expect(ids.has(farm)).toBe(true);
  });

  it('trains a ship that appears next turn on a free water tile next to the harbor', () => {
    const { s, harbor } = port();
    const t = act(s, { type: 'train', barracksId: harbor, unit: 'transport' });
    expect(t.players[0].goods.planks).toBe(50 - 6);
    expect(t.units).toHaveLength(0);
    const u = endTurn(t);
    expect(u.units).toHaveLength(1);
    const ship = u.units[0];
    expect(ship.type).toBe('transport');
    expect(ship.aboard).toBeNull();
    expect(neighbors(at(1, 2)).some((n) => hexEquals(n, ship.hex))).toBe(true);
    expect(['coast', 'ocean']).toContain(u.map.tiles[tileIndex(u.map, ship.hex)]);
    expect(u.training).toEqual([]);
  });

  it('waits while no water tile next to the harbor is free', () => {
    const { s, harbor } = port();
    addEnemy(s);
    const water = neighbors(at(1, 2)).filter((n) => s.map.tiles[tileIndex(s.map, n)] === 'coast');
    expect(water.length).toBeGreaterThan(0);
    const blockers = water.map((h) => addUnit(s, 'spearman', h, { owner: 1 }));
    let t = act(s, { type: 'train', barracksId: harbor, unit: 'transport' });
    t = endTurn(t);
    expect(t.units.filter((u) => u.type === 'transport')).toHaveLength(0);
    expect(t.training).toHaveLength(1);
    t.units = t.units.filter((u) => !blockers.includes(u.id));
    t = endTurn(t);
    expect(t.units.filter((u) => u.type === 'transport')).toHaveLength(1);
    expect(t.training).toEqual([]);
  });

  it('checks level, building type and one order per turn', () => {
    const { s, harbor } = port('polis');
    expect(codeOf(s, { type: 'train', barracksId: harbor, unit: 'trireme' })).toBe('levelTooLow');
    expect(codeOf(s, { type: 'train', barracksId: harbor, unit: 'spearman' })).toBe(
      'wrongTrainingBuilding',
    );
    const barracks = addBuilding(s, 'barracks', at(1, 1));
    expect(codeOf(s, { type: 'train', barracksId: barracks, unit: 'transport' })).toBe(
      'wrongTrainingBuilding',
    );
    const t = act(s, { type: 'train', barracksId: harbor, unit: 'transport' });
    expect(codeOf(t, { type: 'train', barracksId: harbor, unit: 'transport' })).toBe(
      'alreadyTraining',
    );
    const m = port('metropolis');
    expect(codeOf(m.s, { type: 'train', barracksId: m.harbor, unit: 'trireme' })).toBe('ok');
  });
});

describe('ships see and eat like units', () => {
  it('a ship reveals the tiles around it', () => {
    const s = makeTestState(STRAIT, { explored: false });
    const ship = addUnit(s, 'transport', at(3, 2));
    const vis = visibleTiles(s, 0);
    expect(vis[tileIndex(s.map, unitOf(s, ship).hex)]).toBe(true);
    expect(vis[tileIndex(s.map, at(5, 2))]).toBe(true);
    expect(vis[tileIndex(s.map, at(8, 4))]).toBe(false);
  });

  it('upkeep is 1 food per ship', () => {
    const s = makeTestState(STRAIT, { goods: { bread: 10 } });
    addCity(s, at(0, 0), { radius: 0 });
    addUnit(s, 'transport', at(3, 2));
    addUnit(s, 'trireme', at(3, 3));
    const t = endTurn(s);
    expect(t.lastReport?.units.upkeepEaten).toEqual({ bread: 2 });
  });
});

describe('settling an island', () => {
  it('a settler ferried to an island founds a city there', () => {
    const s = rich(STRAIT);
    addCity(s, at(0, 2), { radius: 1 });
    const ship = addUnit(s, 'transport', at(2, 2));
    const settler = addUnit(s, 'settler', at(1, 2));
    let t = act(s, move(settler, 2, 2));
    t = act(t, move(ship, 4, 2));
    t = act(t, { type: 'endTurn' });
    expect(codeOf(t, { type: 'foundCity', unitId: settler })).toBe('passengerCannotAct');
    t = act(t, move(settler, 5, 2));
    t = act(t, { type: 'foundCity', unitId: settler });
    expect(t.units.some((u) => u.id === settler)).toBe(false);
    const city = t.cities[t.cities.length - 1];
    expect(city.center).toEqual(at(5, 2));
    expect(city.residents).toBe(2);
  });
});

describe('determinism', () => {
  it('same actions give the same state, also through JSON', () => {
    const run = () => {
      let s = rich(STRAIT);
      addCity(s, at(0, 2), { radius: 1 });
      const ship = addUnit(s, 'transport', at(2, 2));
      const settler = addUnit(s, 'settler', at(1, 2));
      s = act(s, move(settler, 2, 2));
      s = act(s, { type: 'setOrder', unitId: ship, to: at(4, 4) });
      s = act(s, { type: 'endTurn' });
      return s;
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
