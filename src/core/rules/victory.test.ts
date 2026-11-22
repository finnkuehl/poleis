import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { playAiTurns } from '../../ai/play';
import { addBuilding, addCity, addUnit, at, makeTestState } from '../testing';
import { isPassive, type GameState } from '../state';
import { scoreboard, scoreOf } from './score';
import { checkPlacement } from './placement';
import { previewProduction } from './production';
import { endTurn } from '../turn';
import { declarePointsVictory } from './victory';

const rows = Array.from({ length: 7 }, () => 'ppppppp');
const wonderCost = { stone: 40, planks: 20, bronze: 20, wine: 10 };

/** One human with a Metropolis (4+ residents) at (0,3), wonder goods in stock. */
function setup(): GameState {
  const s = makeTestState(rows, { goods: { ...wonderCost, grain: 50 } });
  addCity(s, at(0, 3), { radius: 6, level: 'metropolis', residents: 6 });
  return s;
}

/** Adds a second, alive civilization with a far-away city; the human stays player 0. */
function addRival(s: GameState): void {
  s.players.push({
    ...structuredClone(s.players[0]),
    id: 1,
    isHuman: false,
    civ: 'sparta',
    color: 1,
  });
  addCity(s, at(6, 6), { owner: 1, radius: 1 });
  // The territory of the rival city must not eat the human's tiles used by the tests.
}

/** Ends the human turn and returns to the human (the rival turn passes). */
function nextHumanTurn(s: GameState): GameState {
  let cur = endTurn(s);
  while (cur.currentPlayer !== 0 && !cur.result) cur = endTurn(cur);
  return cur;
}

function placeWonder(s: GameState, hex = at(1, 3)) {
  return applyAction(s, { type: 'build', building: 'wonder', hex });
}

describe('score', () => {
  it('adds up residents, buildings, territory, levels, temples and a finished wonder', () => {
    const s = makeTestState(rows, { ownAll: false });
    addCity(s, at(1, 1), { radius: 1, level: 'polis', residents: 5 }); // 7 tiles
    addCity(s, at(5, 5), { radius: 0, level: 'metropolis', residents: 3 }); // 1 tile
    addBuilding(s, 'temple', at(2, 1));
    const w = addBuilding(s, 'wonder', at(3, 3));
    s.buildings[s.buildings.length - 1].progress = 5;
    void w;
    const score = scoreOf(s, 0);
    expect(score.residents).toBe(8);
    expect(score.buildings).toBe(2 * 4); // 2 centers, temple, wonder
    expect(score.territory).toBe(8);
    expect(score.levels).toBe(20 + 50);
    expect(score.temples).toBe(15);
    expect(score.wonder).toBe(150);
    expect(score.total).toBe(8 + 8 + 8 + 70 + 15 + 150);
  });

  it('an unfinished wonder gives only its building points', () => {
    const s = setup();
    const before = scoreOf(s, 0);
    const after = placeWonder(s);
    if (!after.ok) throw new Error('placement failed');
    const score = scoreOf(after.state, 0);
    expect(score.wonder).toBe(0);
    expect(score.total).toBe(before.total + 2);
  });

  it('scoreboard sorts by points, then residents, then lower id and flags passive players', () => {
    const s = makeTestState(rows, { ownAll: false });
    for (const id of [1, 2]) {
      s.players.push({ ...structuredClone(s.players[0]), id, isHuman: false, civ: null });
    }
    addCity(s, at(0, 0), { radius: 0, residents: 4, owner: 0 });
    addCity(s, at(3, 0), { radius: 0, residents: 4, owner: 1 });
    addCity(s, at(6, 0), { radius: 0, residents: 4, owner: 2 });
    const board = scoreboard(s);
    expect(board.map((r) => r.player)).toEqual([0, 1, 2]);
    expect(board[1].passive).toBe(true);
    expect(board[0].passive).toBe(false);
    expect(board[0].wonderProgress).toBeNull();
    // More residents beats a lower id at equal points: swap residents and one tile.
    s.cities.find((c) => c.owner === 2)!.residents = 5;
    s.territory[0] = -1; // player 0 loses a tile -> total 1 lower than player 2's before
    const board2 = scoreboard(s);
    expect(board2[0].player).toBe(2);
    expect(isPassive(s.players[1])).toBe(true);
  });

  it('breaks a points tie by residents', () => {
    const s = makeTestState(rows, { ownAll: false });
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
    // Player 0: 4 residents, 2 building points, 1 tile = 7. Player 1: 5 residents, 2, 1 = 8... equalize
    addCity(s, at(0, 0), { radius: 0, residents: 4, owner: 0 });
    addCity(s, at(3, 0), { radius: 0, residents: 4, owner: 1 });
    s.cities[1].level = 'polis'; // +20 for player 1
    s.cities[0].residents = 24; // +20 residents for player 0 -> equal totals
    const board = scoreboard(s);
    expect(board[0].total).toBe(board[1].total);
    expect(board[0].player).toBe(0); // more residents
  });
});

describe('world wonder', () => {
  it('needs a Metropolis', () => {
    const s = setup();
    s.cities[0].level = 'polis';
    expect(checkPlacement(s, 0, 'wonder', at(1, 3))).toEqual({
      code: 'levelTooLow',
      level: 'metropolis',
    });
  });

  it('pays the whole cost, sets progress 0 and adds a wonderStarted event', () => {
    const s = setup();
    const r = placeWonder(s);
    if (!r.ok) throw new Error('placement failed');
    const w = r.state.buildings.find((b) => b.type === 'wonder')!;
    expect(w.progress).toBe(0);
    expect(r.state.players[0].goods).toMatchObject({ stone: 0, planks: 0, bronze: 0, wine: 0 });
    expect(r.state.events).toMatchObject([
      { type: 'wonderStarted', player: 0, hex: at(1, 3), seenBy: [0] },
    ]);
  });

  it('allows only one per civilization', () => {
    const s = setup();
    const r = placeWonder(s);
    if (!r.ok) throw new Error('placement failed');
    r.state.players[0].goods = { ...r.state.players[0].goods, ...wonderCost };
    const second = placeWonder(r.state, at(2, 3));
    expect(second).toEqual({ ok: false, error: { code: 'wonderLimit' } });
  });

  it('advances only with full crew, connection and no pause; completes after 5 turns', () => {
    let s = setup();
    const r = placeWonder(s);
    if (!r.ok) throw new Error('placement failed');
    s = r.state;
    const progress = () => s.buildings.find((b) => b.type === 'wonder')!.progress;
    // Fully staffed (6 residents, needs 4) and next to the city center.
    expect(previewProduction(s, 0).buildings.find((b) => b.buildingId > 1)?.status).toEqual({
      kind: 'wonderBuilding',
      progress: 0,
      total: 5,
    });
    // Paused: no progress.
    const wonderHex = at(1, 3);
    let t = applyAction(s, { type: 'togglePause', hex: wonderHex });
    if (!t.ok) throw new Error('pause failed');
    s = nextHumanTurn(t.state);
    expect(progress()).toBe(0);
    // Too few residents: no progress.
    s.cities[0].residents = 3;
    s = nextHumanTurn(s);
    expect(progress()).toBe(0);
    s.cities[0].residents = 6;
    // Not paused any more, but disconnected (too far from storage): no progress.
    t = applyAction(s, { type: 'togglePause', hex: wonderHex });
    if (!t.ok) throw new Error('unpause failed');
    s = t.state;
    s.buildings.find((b) => b.type === 'wonder')!.hex = at(5, 3);
    s = nextHumanTurn(s);
    expect(progress()).toBe(0);
    s.buildings.find((b) => b.type === 'wonder')!.hex = wonderHex;
    for (let i = 1; i <= 4; i++) {
      s = nextHumanTurn(s);
      expect(progress()).toBe(i);
      expect(s.events.some((e) => e.type === 'wonderCompleted')).toBe(false);
    }
    s = nextHumanTurn(s);
    expect(progress()).toBe(5);
    expect(s.events.filter((e) => e.type === 'wonderCompleted')).toHaveLength(1);
    expect(s.lastReport?.buildings.find((b) => b.buildingId > 1)?.status).toEqual({
      kind: 'wonderComplete',
    });
    // Complete: needs no workers any more, even with no residents left.
    s.result = null;
    s.cities[0].residents = 0;
    s = nextHumanTurn(s);
    expect(progress()).toBe(5);
    expect(s.lastReport?.buildings.find((b) => b.buildingId > 1)?.status).toEqual({
      kind: 'wonderComplete',
    });
  });
});

function finishWonder(s: GameState): GameState {
  const r = placeWonder(s);
  if (!r.ok) throw new Error('placement failed');
  let cur = r.state;
  for (let i = 0; i < 5; i++) cur = nextHumanTurn(cur);
  return cur;
}

describe('victory', () => {
  it('wonder victory on: the first completion wins at once', () => {
    const s = setup();
    addRival(s);
    const out = finishWonder(s);
    expect(out.result).toEqual({ winner: 0, reason: 'wonder', turn: out.turn });
  });

  it('wonder victory off: no result, but +150 points', () => {
    const s = setup();
    addRival(s);
    s.settings.victory = { points: true, wonder: false, conquest: true };
    const out = finishWonder(s);
    expect(out.result).toBeNull();
    expect(scoreOf(out, 0).wonder).toBe(150);
    expect(scoreboard(out).find((r) => r.player === 0)?.wonderProgress).toBe(5);
  });

  it('conquest: the last civilization standing wins', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 0));
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: null });
    addCity(s, at(6, 6), { owner: 1, radius: 1 });
    // The rival (passive) loses its city; at the human's next turn start it is out.
    s.cities = s.cities.filter((c) => c.owner !== 1);
    const out = endTurn(s);
    expect(out.players[1].alive).toBe(false);
    expect(out.result).toEqual({ winner: 0, reason: 'conquest', turn: out.turn });
  });

  it('conquest off: no result when the others are out', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 0));
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: null });
    s.settings.victory = { points: false, wonder: true, conquest: false };
    expect(endTurn(s).result).toBeNull();
  });

  it('a single-player test state has no conquest', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 0));
    expect(endTurn(s).result).toBeNull();
  });

  it('human out of the game: defeat without winner', () => {
    const s = makeTestState(rows);
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
    addCity(s, at(6, 6), { owner: 1, radius: 1 });
    s.currentPlayer = 0;
    const out = endTurn(s);
    expect(out.currentPlayer).toBe(1);
    expect(out.players[0].alive).toBe(false);
    expect(out.result).toEqual({ winner: null, reason: 'eliminated', turn: out.turn });
  });

  it('a capture of the last city ends the game for the human', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 0));
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
    addCity(s, at(6, 6), { owner: 1, radius: 1 });
    const u = addUnit(s, 'spearman', at(0, 0), { owner: 1 });
    s.units.find((x) => x.id === u)!.capturing = s.cities[0].id;
    s.currentPlayer = 0;
    const out = endTurn(s);
    expect(out.result?.reason).toBe('eliminated');
  });

  it('points at the turn limit: the best player wins, the game does not enter the next turn', () => {
    const s = makeTestState(rows, { ownAll: false });
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
    addCity(s, at(0, 0), { radius: 1, residents: 4 });
    addCity(s, at(6, 6), { owner: 1, radius: 1, residents: 9 });
    s.settings.turnLimit = 3;
    s.settings.victory = { points: true, wonder: false, conquest: false };
    let cur = s;
    while (!cur.result) cur = endTurn(cur);
    expect(cur.turn).toBe(3);
    expect(cur.currentPlayer).toBe(1);
    expect(cur.result).toEqual({ winner: 1, reason: 'points', turn: 3 });
  });

  it('points tie: more residents wins, then the lower id', () => {
    const base = () => {
      const s = makeTestState(rows, { ownAll: false });
      s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
      addCity(s, at(0, 0), { radius: 1, residents: 4 });
      addCity(s, at(6, 6), { owner: 1, radius: 1, residents: 4 });
      s.settings.victory = { points: true, wonder: false, conquest: false };
      return s;
    };
    /** Takes tiles from player 1 until both players have the same points. */
    const equalize = (s: GameState) => {
      while (scoreOf(s, 1).total > scoreOf(s, 0).total) s.territory[s.territory.indexOf(1)] = -1;
      expect(scoreOf(s, 1).total).toBe(scoreOf(s, 0).total);
    };
    // Fully tied: the lower id wins.
    let s = base();
    equalize(s);
    declarePointsVictory(s, 1);
    expect(s.result?.winner).toBe(0);
    // Player 1 has more residents at equal points: player 1 wins.
    s = base();
    s.cities[1].residents = 6;
    s.territory[s.territory.indexOf(1)] = -1;
    s.territory[s.territory.indexOf(1)] = -1;
    equalize(s);
    expect(scoreboard(s)[0].total).toBe(scoreboard(s)[1].total);
    declarePointsVictory(s, 1);
    expect(s.result?.winner).toBe(1);
  });

  it('has no turn limit when points are off', () => {
    const s = makeTestState(rows);
    addCity(s, at(0, 0));
    s.settings.turnLimit = 2;
    s.settings.victory = { points: false, wonder: true, conquest: true };
    let cur = s;
    for (let i = 0; i < 5; i++) cur = endTurn(cur);
    expect(cur.result).toBeNull();
    expect(cur.turn).toBe(6);
  });

  it('rejects every action once the game is over', () => {
    const s = setup();
    s.result = { winner: 0, reason: 'points', turn: 1 };
    for (const action of [
      { type: 'endTurn' },
      { type: 'build', building: 'house', hex: at(1, 3) },
      { type: 'demolish', hex: at(1, 3) },
    ] as const) {
      expect(applyAction(s, action)).toEqual({ ok: false, error: { code: 'gameOver' } });
    }
  });

  it('playAiTurns stops on a result', () => {
    const s = makeTestState(rows);
    s.players.push({ ...structuredClone(s.players[0]), id: 1, isHuman: false, civ: 'athens' });
    addCity(s, at(0, 0));
    addCity(s, at(6, 6), { owner: 1, radius: 1 });
    s.currentPlayer = 1;
    s.result = { winner: 0, reason: 'points', turn: 1 };
    expect(playAiTurns(s)).toBe(s);
  });
});
