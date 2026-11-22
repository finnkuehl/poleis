import { describe, expect, it } from 'vitest';
import { militaryConfig, UNITS } from '../../data';
import type { GameState } from '../state';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../testing';
import { endTurn } from '../turn';
import { runDefense } from './defense';

/** 12x5 plains, human (player 0) plus an enemy player 1; all tiles unowned. */
function world(): GameState {
  const s = makeTestState(
    ['pppppppppppp', 'pppppppppppp', 'pppppppppppp', 'pppppppppppp', 'pppppppppppp'],
    { ownAll: false },
  );
  s.players.push({
    id: 1,
    isHuman: false,
    civ: 'sparta',
    name: '',
    color: 1,
    alive: true,
    goods: { ...s.players[0].goods },
    explored: s.map.tiles.map(() => false),
    lowPriorityGoods: [],
  });
  // Past the peace time, so the cities fire.
  s.turn = militaryConfig.defense.defenseFromTurn;
  return s;
}

const shots = (s: GameState) => s.events.filter((e) => e.type === 'defenseShot');
const hpOf = (s: GameState, id: number) => s.units.find((u) => u.id === id)?.hp;

describe('city and tower fire', () => {
  it('a city shoots at an enemy unit within 2 tiles, not at 3', () => {
    const s = world();
    addCity(s, at(2, 2));
    const near = addUnit(s, 'spearman', at(4, 2), { owner: 1 });
    const far = addUnit(s, 'spearman', at(5, 2), { owner: 1 });
    runDefense(s, 0);
    expect(hpOf(s, near)).toBe(UNITS.spearman.hp - 3);
    expect(hpOf(s, far)).toBe(UNITS.spearman.hp);
    expect(shots(s)).toHaveLength(1);
    expect(shots(s)[0]).toMatchObject({
      shooter: 0,
      victim: 1,
      source: 'city',
      unit: 'spearman',
      damage: 3,
      killed: false,
    });
  });

  it('city damage depends on the level, towers do 2', () => {
    const damages = [] as number[];
    for (const level of ['settlement', 'polis', 'metropolis'] as const) {
      const s = world();
      addCity(s, at(2, 2), { level });
      const u = addUnit(s, 'hoplite', at(3, 2), { owner: 1 });
      runDefense(s, 0);
      damages.push(UNITS.hoplite.hp - (hpOf(s, u) ?? 0));
    }
    expect(damages).toEqual([3, 4, 5]);
    expect(militaryConfig.defense.towerDamage).toBe(2);
    const s = world();
    addBuilding(s, 'borderTower', at(2, 2), 0);
    const u = addUnit(s, 'hoplite', at(3, 2), { owner: 1 });
    runDefense(s, 0);
    expect(hpOf(s, u)).toBe(UNITS.hoplite.hp - 2);
    expect(shots(s)[0]).toMatchObject({ source: 'tower', damage: 2 });
  });

  it('own units are never shot; the passive-style other owner counts as enemy', () => {
    const s = world();
    addCity(s, at(2, 2));
    const own = addUnit(s, 'spearman', at(3, 2), { owner: 0 });
    runDefense(s, 0);
    expect(hpOf(s, own)).toBe(UNITS.spearman.hp);
    expect(shots(s)).toHaveLength(0);
  });

  it('shoots in order: city centers first, then towers, each by id', () => {
    const s = world();
    // The tower is placed first (lower id) but the city center still shoots first.
    addBuilding(s, 'borderTower', at(2, 1), 0);
    addCity(s, at(2, 3));
    addBuilding(s, 'borderTower', at(3, 2), 0);
    const u = addUnit(s, 'hoplite', at(3, 2), { owner: 1, hp: 20 });
    // City at (2,3) -> 3 dmg; towers 2 dmg each.
    runDefense(s, 0);
    expect(shots(s).map((e) => (e.type === 'defenseShot' ? e.source : ''))).toEqual([
      'city',
      'tower',
      'tower',
    ]);
    expect(hpOf(s, u)).toBe(20 - 3 - 2 - 2);
  });

  it('target choice: capturer first, then lowest hp, then nearest, then id', () => {
    const s = world();
    addCity(s, at(2, 2));
    const healthy = addUnit(s, 'spearman', at(3, 2), { owner: 1 });
    const weak = addUnit(s, 'spearman', at(4, 2), { owner: 1, hp: 4 });
    runDefense(s, 0);
    // Lowest hp beats nearest.
    expect(hpOf(s, weak)).toBe(1);
    expect(hpOf(s, healthy)).toBe(UNITS.spearman.hp);

    // Capturer beats lowest hp.
    const c = world();
    const cityC = addCity(c, at(2, 2));
    const weakC = addUnit(c, 'spearman', at(3, 2), { owner: 1, hp: 2 });
    const capturer = addUnit(c, 'spearman', at(2, 2), { owner: 1 });
    c.units.find((u) => u.id === capturer)!.capturing = cityC;
    runDefense(c, 0);
    expect(hpOf(c, capturer)).toBe(UNITS.spearman.hp - 3);
    expect(hpOf(c, weakC)).toBe(2);

    // Same hp: nearest, then lowest id.
    const n = world();
    addCity(n, at(2, 2));
    const far = addUnit(n, 'spearman', at(4, 2), { owner: 1 });
    const near = addUnit(n, 'spearman', at(3, 2), { owner: 1 });
    runDefense(n, 0);
    expect(hpOf(n, near)).toBe(UNITS.spearman.hp - 3);
    expect(hpOf(n, far)).toBe(UNITS.spearman.hp);

    const t = world();
    addCity(t, at(2, 2));
    const first = addUnit(t, 'spearman', at(3, 2), { owner: 1 });
    const second = addUnit(t, 'spearman', at(2, 3), { owner: 1 });
    runDefense(t, 0);
    expect(hpOf(t, first)).toBeLessThan(UNITS.spearman.hp);
    expect(hpOf(t, second)).toBe(UNITS.spearman.hp);
  });

  it('kills are removed right away, the next shooter picks a new target', () => {
    const s = world();
    addCity(s, at(2, 2));
    addBuilding(s, 'borderTower', at(2, 1), 0);
    const weak = addUnit(s, 'spearman', at(3, 2), { owner: 1, hp: 2 });
    const other = addUnit(s, 'spearman', at(4, 2), { owner: 1 });
    runDefense(s, 0);
    expect(s.units.some((u) => u.id === weak)).toBe(false);
    expect(hpOf(s, other)).toBe(UNITS.spearman.hp - 2);
    expect(shots(s)[0]).toMatchObject({ killed: true, damage: 2 });
  });

  it('passengers are not targets; the ship is, and sinking it takes them along', () => {
    const s = makeTestState(['pppcccc', 'pppcccc', 'pppcccc'], { ownAll: false });
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'sparta' });
    s.turn = militaryConfig.defense.defenseFromTurn;
    addCity(s, at(1, 1));
    const ship = addUnit(s, 'transport', at(3, 1), { owner: 1, hp: 2 });
    const rider = addUnit(s, 'spearman', at(3, 1), { owner: 1, hp: 1 });
    s.units.find((u) => u.id === rider)!.aboard = ship;
    runDefense(s, 0);
    // The passenger (hp 1) would be the weakest, but the ship takes the shot and sinks.
    expect(s.units.some((u) => u.id === ship)).toBe(false);
    expect(s.units.some((u) => u.id === rider)).toBe(false);
  });

  it('there is no counterattack', () => {
    const s = world();
    addCity(s, at(2, 2));
    const archer = addUnit(s, 'archer', at(3, 2), { owner: 1 });
    runDefense(s, 0);
    expect(s.units.filter((u) => u.owner === 0)).toHaveLength(0);
    expect(hpOf(s, archer)).toBe(UNITS.archer.hp - 3);
  });

  it('shots never cancel a capture', () => {
    const s = world();
    const city = addCity(s, at(2, 2), { owner: 1 });
    const hero = addUnit(s, 'spearman', at(2, 2), { owner: 0 });
    s.units.find((u) => u.id === hero)!.capturing = city;
    runDefense(s, 1);
    expect(hpOf(s, hero)).toBe(UNITS.spearman.hp - 3);
    expect(s.units.find((u) => u.id === hero)?.capturing).toBe(city);
  });

  it('endTurn: the city shoots at the start of its owner turn; captured towers shoot for the new owner', () => {
    const s = world();
    s.settings.victory = { ...s.settings.victory, conquest: false };
    addCity(s, at(0, 0));
    // A second city keeps player 1 in the game after the capture.
    addCity(s, at(11, 4), { owner: 1, radius: 0 });
    const city = addCity(s, at(6, 2), { owner: 1 });
    const tower = addBuilding(s, 'borderTower', at(7, 2), 1);
    s.tileCity[7 + 2 * 12] = city;
    s.tileCity[6 + 2 * 12] = city;
    const hero = addUnit(s, 'spearman', at(6, 2), { owner: 0 });
    s.units.find((u) => u.id === hero)!.capturing = city;
    // Player 1's turn: city and tower shoot the capturer (3 + 2).
    const t1 = endTurn(s);
    expect(t1.currentPlayer).toBe(1);
    expect(hpOf(t1, hero)).toBe(UNITS.spearman.hp - 5);
    expect(t1.units.find((u) => u.id === hero)?.capturing).toBe(city);
    // Player 0's turn: the capture goes through and the tower now belongs to player 0.
    const t2 = endTurn(t1);
    expect(t2.cities.find((c) => c.id === city)?.owner).toBe(0);
    expect(t2.buildings.find((b) => b.id === tower)?.owner).toBe(0);
    // An enemy next to the captured tower is shot by the new owner in the same turn start.
    const s3 = structuredClone(t1);
    addUnit(s3, 'spearman', at(8, 2), { owner: 1 });
    const t3 = endTurn(s3);
    expect(shots(t3).some((e) => e.type === 'defenseShot' && e.shooter === 0)).toBe(true);
  });

  it('test mode: the passive enemy never has a turn, so its city shoots at the start of the human turn', () => {
    const s = world();
    // Player 1 becomes the passive test-mode enemy (not human, no civilization)
    s.players[1].civ = null;
    addCity(s, at(8, 2), { owner: 1 });
    const mine = addUnit(s, 'spearman', at(6, 2), { owner: 0 });
    s.currentPlayer = 0;
    const after = endTurn(s);
    expect(after.currentPlayer).toBe(0);
    expect(hpOf(after, mine)).toBeLessThan(UNITS.spearman.hp);
  });

  it('no fire in peace time, except the passive test-mode enemy', () => {
    const s = world();
    s.turn = militaryConfig.defense.defenseFromTurn - 1;
    addCity(s, at(2, 2));
    const u = addUnit(s, 'spearman', at(3, 2), { owner: 1 });
    runDefense(s, 0);
    expect(hpOf(s, u)).toBe(UNITS.spearman.hp);
    // Player 1 becomes the passive enemy (no civilization, not human): it fires from turn 1.
    s.players[1].civ = null;
    const v = world();
    v.turn = 1;
    v.players[1].civ = null;
    addCity(v, at(2, 2), { owner: 1 });
    const mine = addUnit(v, 'spearman', at(3, 2), { owner: 0 });
    runDefense(v, 1);
    expect(hpOf(v, mine)).toBe(UNITS.spearman.hp - 3);
  });

  it('the passive enemy city shoots its capturer before the capture happens', () => {
    const s = world();
    s.turn = 1;
    s.players[1].civ = null;
    s.settings.victory = { ...s.settings.victory, conquest: false };
    addCity(s, at(0, 0));
    const city = addCity(s, at(6, 2), { owner: 1 });
    const hero = addUnit(s, 'spearman', at(6, 2), { owner: 0 });
    s.units.find((u) => u.id === hero)!.capturing = city;
    s.currentPlayer = 1;
    const t = endTurn(s);
    expect(t.currentPlayer).toBe(0);
    expect(t.cities.find((c) => c.id === city)?.owner).toBe(0);
    // (The unit may heal a little afterwards, so the event is checked, not the HP.)
    expect(shots(t)[0]).toMatchObject({ shooter: 1, victim: 0, damage: 3 });
  });
});
