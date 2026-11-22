import { describe, expect, it } from 'vitest';
import { CIV_IDS, MAP_SIZES, UNITS, gameConfig, type MapSize } from '../data';
import { applyAction, type Action } from './actions';
import { distance, hexEquals } from './hex';
import { eliminatePlayers } from './rules';
import { createGameState, isPassive, type GameState } from './state';
import { addCity, addUnit, at, makeTestState } from './testing';

function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`Action failed: ${r.error.code}`);
  return r.state;
}

describe('createGameState with AI civilizations', () => {
  const sizes = Object.keys(MAP_SIZES) as MapSize[];
  for (const mapSize of sizes) {
    for (const aiCount of [1, 2, 3]) {
      for (const seed of ['1', '7', 'abc']) {
        it(`${aiCount} AI, ${mapSize} map, seed ${seed}`, () => {
          const s = createGameState(seed, { settings: { aiCount, mapSize, playerColor: 2 } });
          expect(s.map.width).toBe(MAP_SIZES[mapSize].width);
          expect(s.map.height).toBe(MAP_SIZES[mapSize].height);
          expect(s.players).toHaveLength(1 + aiCount);
          expect(s.players.map((p) => p.id)).toEqual(s.players.map((_, i) => i));
          expect(s.players[0]).toMatchObject({ isHuman: true, civ: null, color: 2, alive: true });
          const ais = s.players.slice(1);
          expect(ais.every((p) => !p.isHuman && p.civ !== null && !isPassive(p))).toBe(true);
          const civs = ais.map((p) => p.civ);
          expect(new Set(civs).size).toBe(aiCount);
          for (const civ of civs) expect(CIV_IDS).toContain(civ);
          const colors = s.players.map((p) => p.color);
          expect(new Set(colors).size).toBe(1 + aiCount);
          expect(Math.max(...colors)).toBeLessThan(gameConfig.playerColorCount);
          // One city per player, on distinct tiles, with the start residents and goods.
          expect(s.cities).toHaveLength(1 + aiCount);
          for (const p of s.players) {
            expect(s.cities.filter((c) => c.owner === p.id)).toHaveLength(1);
            expect(p.goods.wood).toBe(20);
          }
          const centers = s.cities.map((c) => c.center);
          for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
              expect(hexEquals(centers[i], centers[j])).toBe(false);
            }
          }
          for (const p of s.players) expect(s.territory).toContain(p.id);
          // Deterministic.
          const again = createGameState(seed, { settings: { aiCount, mapSize, playerColor: 2 } });
          expect(again).toEqual(s);
        });
      }
    }
  }

  it('the colors of the AIs are the remaining ones in ascending order', () => {
    const s = createGameState('1', { settings: { aiCount: 3, playerColor: 1 } });
    expect(s.players.map((p) => p.color)).toEqual([1, 0, 2, 3]);
  });

  it('the human name and settings are stored', () => {
    const s = createGameState('1', { settings: { playerName: 'Rhodes', turnLimit: 50 } });
    expect(s.players[0].name).toBe('Rhodes');
    expect(s.settings.turnLimit).toBe(50);
    expect(s.settings.victory).toEqual({ points: true, wonder: true, conquest: true });
  });

  it('defaults: one player, same start as before', () => {
    const s = createGameState('1');
    expect(s.players).toHaveLength(1);
    expect(s.settings).toEqual(gameConfig.defaultSettings);
    expect(s.map.width).toBe(30);
    expect(s.cities).toHaveLength(1);
    expect(s.events).toEqual([]);
    expect(s.nextId).toBe(2);
  });

  it('aiCount is ignored in test mode (sandbox)', () => {
    const s = createGameState('1', { sandbox: true, settings: { aiCount: 3 } });
    expect(s.players).toHaveLength(2);
    expect(isPassive(s.players[1])).toBe(true);
    expect(s.players[1].color).not.toBe(s.players[0].color);
  });
});

describe('turn order', () => {
  it('human -> AI 1 -> AI 2 -> human with turn + 1', () => {
    let s = createGameState('3', { settings: { aiCount: 2 } });
    expect(s.turn).toBe(1);
    s = act(s, { type: 'endTurn' });
    expect([s.currentPlayer, s.turn]).toEqual([1, 1]);
    // The start of the AI's turn ran: the residents paid taxes.
    expect(s.lastReport).not.toBeNull();
    expect(s.lastReport?.player).toBe(1);
    expect(s.players[1].goods.drachmas).toBeGreaterThan(0);
    s = act(s, { type: 'endTurn' });
    expect([s.currentPlayer, s.turn]).toEqual([2, 1]);
    s = act(s, { type: 'endTurn' });
    expect([s.currentPlayer, s.turn]).toEqual([0, 2]);
  });

  it('single player: the human again, turn + 1', () => {
    const s = act(createGameState('3'), { type: 'endTurn' });
    expect([s.currentPlayer, s.turn]).toEqual([0, 2]);
  });
});

describe('passive enemy (test mode)', () => {
  it('is skipped and does nothing over several turns', () => {
    let s = createGameState('1', { sandbox: true });
    const enemyCity = s.cities.find((c) => c.owner === 1);
    expect(enemyCity).toBeDefined();
    const residents = enemyCity?.residents;
    const hp = UNITS.spearman.hp;
    const goods = { ...s.players[1].goods };
    for (let i = 0; i < 4; i++) {
      s = act(s, { type: 'endTurn' });
      expect(s.currentPlayer).toBe(0);
    }
    expect(s.turn).toBe(5);
    expect(s.cities.find((c) => c.owner === 1)?.residents).toBe(residents);
    expect(s.units.filter((u) => u.owner === 1).every((u) => u.hp === hp)).toBe(true);
    expect(s.players[1].goods).toEqual(goods);
  });
});

/** Human city at (0,0), AI 1 city at (6,2) with a spearman, a human spearman next to it. */
/** Event types without the city fire (the duel's cities shoot at units in range). */
const noShots = (s: GameState) => s.events.filter((e) => e.type !== 'defenseShot');

function duel() {
  const s = makeTestState(['pppppppp', 'pppppppp', 'pppppppp', 'pppppppp'], { ownAll: false });
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
  addCity(s, at(0, 0));
  const enemyCity = addCity(s, at(6, 2), { owner: 1 });
  const hero = addUnit(s, 'spearman', at(5, 2));
  return { s, enemyCity, hero };
}

describe('elimination', () => {
  it('an AI that loses its only city is out, its units go, it is skipped', () => {
    const { s: start, enemyCity, hero } = duel();
    // Conquest would end the game here; this test is about the elimination itself.
    start.settings.victory = { ...start.settings.victory, conquest: false };
    let s = start;
    addUnit(s, 'spearman', at(7, 3), { owner: 1 });
    s.training.push({ barracksId: 999, unit: 'spearman', owner: 1 });
    s = act(s, { type: 'move', unitId: hero, to: at(6, 2) });
    expect(s.units.find((u) => u.id === hero)?.capturing).toBe(enemyCity);
    // The AI's turn, then the human's: the capture happens at the start of the human's turn.
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].alive).toBe(true);
    s = act(s, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(0);
    expect(s.cities.find((c) => c.id === enemyCity)?.owner).toBe(0);
    expect(s.players[1].alive).toBe(false);
    expect(s.units.filter((u) => u.owner === 1)).toHaveLength(0);
    expect(s.training.filter((t) => t.owner === 1)).toHaveLength(0);
    expect(noShots(s).map((e) => e.type)).toEqual(['cityCaptured', 'eliminated']);
    expect(noShots(s)[1]).toMatchObject({ type: 'eliminated', player: 1, seenBy: [0, 1] });
    // Skipped from now on.
    const next = act(s, { type: 'endTurn' });
    expect([next.currentPlayer, next.turn]).toEqual([0, s.turn + 1]);
    // Running the check again changes nothing.
    expect(eliminatePlayers(structuredClone(next))).toEqual([]);
  });
});

describe('events', () => {
  it('attack: fields and seenBy', () => {
    const { s: start, hero } = duel();
    let s = start;
    s.players.push({ ...structuredClone(s.players[1]), id: 2, color: 2 });
    addCity(s, at(0, 3), { owner: 2, radius: 0 });
    const target = addUnit(s, 'spearman', at(6, 2), { owner: 1 });
    // A player 2 unit watches the fight (distance 2 from the target), another one is far away.
    addUnit(s, 'scout', at(4, 2), { owner: 2 });
    s = act(s, { type: 'attack', unitId: hero, targetId: target });
    expect(s.events).toHaveLength(1);
    const e = s.events[0];
    expect(e).toMatchObject({
      type: 'attack',
      turn: 1,
      attacker: 0,
      defender: 1,
      attackerUnit: 'spearman',
      defenderUnit: 'spearman',
      hex: at(6, 2),
      defenderKilled: false,
      attackerKilled: false,
      seenBy: [0, 1, 2],
    });
    if (e.type === 'attack') {
      expect(e.damage).toBeGreaterThan(0);
      expect(e.counter).toBeGreaterThan(0);
    }
  });

  it('attack: a player who does not see the tile is not in seenBy; kills are flagged', () => {
    const { s: start, hero } = duel();
    let s = start;
    s.players.push({ ...structuredClone(s.players[1]), id: 2, color: 2 });
    addCity(s, at(0, 3), { owner: 2, radius: 0 });
    const target = addUnit(s, 'spearman', at(6, 2), { owner: 1, hp: 1 });
    s = act(s, { type: 'attack', unitId: hero, targetId: target });
    expect(s.events[0]).toMatchObject({ defenderKilled: true, seenBy: [0, 1] });
  });

  it('cityCaptured', () => {
    const { s: start, enemyCity, hero } = duel();
    start.players.push({ ...structuredClone(start.players[1]), id: 2, color: 2 });
    addCity(start, at(0, 3), { owner: 2, radius: 0 });
    addCity(start, at(7, 0), { owner: 1, radius: 0 });
    let s = act(start, { type: 'move', unitId: hero, to: at(6, 2) });
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(0);
    expect(noShots(s)).toEqual([
      expect.objectContaining({
        type: 'cityCaptured',
        by: 0,
        from: 1,
        cityId: enemyCity,
        hex: at(6, 2),
        seenBy: [0, 1],
      }),
    ]);
  });

  it('cityFounded', () => {
    const s0 = makeTestState(['pppppppppppp', 'pppppppppppp', 'pppppppppppp']);
    const settler = addUnit(s0, 'settler', at(10, 1));
    addCity(s0, at(0, 1));
    const s = act(s0, { type: 'foundCity', unitId: settler });
    expect(s.events).toEqual([
      expect.objectContaining({ type: 'cityFounded', by: 0, hex: at(10, 1), seenBy: [0] }),
    ]);
  });

  it('events are cleared when the human ends the turn, not when an AI does', () => {
    const { s: start, hero } = duel();
    let s = start;
    const target = addUnit(s, 'spearman', at(6, 2), { owner: 1 });
    s = act(s, { type: 'attack', unitId: hero, targetId: target });
    expect(s.events).toHaveLength(1);
    s = act(s, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(1);
    expect(noShots(s)).toHaveLength(0);
    s.events = [];
    s.events.push({ type: 'eliminated', turn: 1, player: 5, seenBy: [0] });
    s = act(s, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(0);
    expect(noShots(s)).toHaveLength(1);
    s = act(s, { type: 'endTurn' });
    expect(noShots(s)).toHaveLength(0);
  });
});

describe('start distance', () => {
  it('AI starts are not on top of each other', () => {
    const s = createGameState('49', { settings: { aiCount: 3 } });
    const c = s.cities.map((x) => x.center);
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) expect(distance(c[i], c[j])).toBeGreaterThanOrEqual(8);
  });
});
