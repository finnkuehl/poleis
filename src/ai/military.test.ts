// Military AI: exploring, defending, attacking, settling, the wonder crew, fairness, peace time.
// The simulations use 3 AIs on 3 seeds for 80 rounds. The human only ends turns; in the
// "defended" runs it gets 3 hoplites in its city (and a huge food stock so they do not
// starve), so the AIs cannot simply eliminate it in the first rounds and also meet each other.

import { beforeAll, describe, expect, it } from 'vitest';
import { applyAction } from '../core/actions';
import { neighbors, type Hex } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules';
import { type GameEvent, type GameState, type PlayerId } from '../core/state';
import { aiConfig, TERRAIN, UNITS, type UnitId } from '../data';
import { simulate, type SimulationResult } from './testing';
import { takeAiTurn } from './turn';
import type { Candidate } from './types';

const SEEDS = ['1', '2', '3'];
const ROUNDS = 80;

function addUnit(
  state: GameState,
  type: UnitId,
  owner: PlayerId,
  hex: Hex,
  fixedId?: number,
): void {
  const def = UNITS[type];
  state.units.push({
    id: fixedId ?? state.nextId++,
    type,
    owner,
    hex,
    hp: def.hp,
    movesLeft: def.movement,
    hasMoved: false,
    acted: false,
    attacked: false,
    capturing: null,
    order: null,
    aboard: null,
  });
}

/** Test setup: three hoplites in the human's city and plenty of food. */
function defendHuman(state: GameState): void {
  const center = state.cities.find((c) => c.owner === 0)!.center;
  const spots = [center, ...neighbors(center)]
    .filter((h) => {
      const t = state.map.tiles[tileIndex(state.map, h)];
      return TERRAIN[t].moveCost !== null;
    })
    .slice(0, 3);
  for (const h of spots) addUnit(state, 'hoplite', 0, h);
  state.players[0].goods.fish = 5000;
}

interface Run {
  result: SimulationResult;
  events: GameEvent[];
  startExplored: Record<PlayerId, number>;
  /** States after some rounds (for the fairness tests, so no extra simulation is needed). */
  snapshots: Map<number, GameState>;
}

const runs = new Map<string, Run>();

function runOf(seed: string, defended: boolean): Run {
  const events: GameEvent[] = [];
  const startExplored: Record<PlayerId, number> = {};
  const snapshots = new Map<number, GameState>();
  const result = simulate(seed, ROUNDS, {
    setup: (s) => {
      if (defended) defendHuman(s);
      for (const p of s.players) startExplored[p.id] = p.explored.filter(Boolean).length;
    },
    onRound: (round, s) => {
      events.push(...s.events);
      if ([20, 36, 40, 60].includes(round)) snapshots.set(round, s);
    },
  });
  return { result, events, startExplored, snapshots };
}

beforeAll(() => {
  for (const seed of SEEDS) runs.set(`${seed}:defended`, runOf(seed, true));
  runs.set('2:open', runOf('2', false));
}, 240000);

const all = (): Run[] => SEEDS.map((s) => runs.get(`${s}:defended`)!);
const civOf = (state: GameState, id: PlayerId): string | null =>
  state.players.find((p) => p.id === id)?.civ ?? null;

describe('AI military (3 AIs, 80 rounds)', () => {
  it('no AI attacks or captures before the peace time is over', () => {
    for (const run of [...all(), runs.get('2:open')!]) {
      for (const e of run.events) {
        if (e.type === 'attack' && e.attacker !== 0) {
          expect(e.turn).toBeGreaterThanOrEqual(aiConfig.peaceUntilTurn);
        }
        if (e.type === 'cityCaptured') {
          expect(e.turn).toBeGreaterThanOrEqual(aiConfig.peaceUntilTurn);
        }
      }
    }
  });

  it('no AI places its world wonder before the wonder turn', () => {
    for (const run of all()) {
      for (const e of run.events) {
        if (e.type === 'wonderStarted') {
          expect(e.turn).toBeGreaterThanOrEqual(aiConfig.wonderFromTurn);
        }
      }
    }
  });

  it('every AI explores', () => {
    for (const seed of SEEDS) {
      const run = runs.get(`${seed}:defended`)!;
      for (const p of run.result.state.players.filter((x) => !x.isHuman)) {
        const now = p.explored.filter(Boolean).length;
        expect(now, `${seed}/${p.civ}`).toBeGreaterThan(run.startExplored[p.id] + 60);
      }
    }
  });

  it('AIs found second cities on most seeds', () => {
    let seedsWith = 0;
    const counts: number[] = [];
    for (const run of all()) {
      const n = run.events.filter((e) => e.type === 'cityFounded').length;
      counts.push(n);
      if (n > 0) seedsWith += 1;
    }
    expect(seedsWith, `cities founded per seed: ${counts}`).toBeGreaterThanOrEqual(2);
  });

  it('AIs order settlers at the city center, no barracks needed', () => {
    let fromCenterWithoutBarracks = 0;
    let atBarracks = 0;
    for (const seed of SEEDS) {
      simulate(seed, 40, {
        onRound: (_round, state) => {
          for (const t of state.training) {
            if (t.unit !== 'settler' || t.owner === 0) continue;
            const b = state.buildings.find((x) => x.id === t.barracksId);
            if (b?.type === 'barracks') atBarracks += 1;
            const hasBarracks = state.buildings.some(
              (x) => x.owner === t.owner && x.type === 'barracks',
            );
            if (b?.type === 'cityCenter' && !hasBarracks) fromCenterWithoutBarracks += 1;
          }
        },
      });
    }
    expect(atBarracks).toBe(0);
    expect(fromCenterWithoutBarracks).toBeGreaterThan(0);
  }, 60_000);

  it('Sparta attacks most; Athens and Corinth only rarely', () => {
    const attacks: Record<string, number> = { sparta: 0, athens: 0, corinth: 0 };
    for (const run of all()) {
      for (const e of run.events) {
        if (e.type === 'attack' && e.attacker !== 0) {
          attacks[civOf(run.result.state, e.attacker)!] += 1;
        }
      }
    }
    const note = JSON.stringify(attacks);
    expect(attacks.sparta, note).toBeGreaterThan(attacks.athens);
    expect(attacks.sparta, note).toBeGreaterThan(attacks.corinth);
  });

  it('at least one city is captured', () => {
    const turns: number[] = [];
    for (const run of [...all(), runs.get('2:open')!]) {
      for (const e of run.events) if (e.type === 'cityCaptured') turns.push(e.turn);
    }
    expect(turns.length).toBeGreaterThanOrEqual(1);
  });

  it('is fast per AI turn', () => {
    for (const run of all()) {
      expect(run.result.ms / run.result.aiTurns).toBeLessThan(150);
    }
  });
});

describe('determinism', () => {
  it('same seed + same rounds give identical states', () => {
    const a = simulate('3', 25, { setup: defendHuman }).state;
    const b = simulate('3', 25, { setup: defendHuman }).state;
    expect(a).toEqual(b);
  });
});

describe('fairness: unseen enemy units change nothing', () => {
  const log = (state: GameState): string[] => {
    const lines: string[] = [];
    takeAiTurn(state, state.currentPlayer, {
      onAction: (c: Candidate) => lines.push(JSON.stringify(c.action)),
    });
    return lines;
  };

  /** Checks one AI turn; returns the number of actions and of unit actions it took. */
  function checkFair(base: GameState): { all: number; unit: number } {
    const me = base.currentPlayer;
    const reference = log(base);
    // Hidden land tiles, the nearest ones to the AI's own units and cities first.
    const visible = visibleTiles(base, me);
    const own = [
      ...base.units.filter((u) => u.owner === me).map((u) => u.hex),
      ...base.cities.filter((c) => c.owner === me).map((c) => c.center),
    ];
    const hidden = base.map.tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => TERRAIN[t].moveCost !== null && !visible[i])
      .map(({ i }) => hexAtIndex(base.map, i))
      .filter((h) => !base.units.some((u) => u.hex.q === h.q && u.hex.r === h.r))
      .map((h) => ({ h, d: Math.min(...own.map((o) => Math.hypot(o.q - h.q, o.r - h.r))) }))
      .sort((a, b) => a.d - b.d);
    const picks = [hidden[0], hidden[1], hidden[Math.floor(hidden.length / 2)], hidden.at(-1)!];
    for (const pick of picks) {
      const copy = structuredClone(base);
      // A fixed id, so the ids of everything created later stay the same.
      addUnit(copy, 'hoplite', 0, pick.h, 900000);
      expect(log(copy), `player ${me}, unit at ${pick.h.q},${pick.h.r}`).toEqual(reference);
    }
    return {
      all: reference.length,
      unit: reference.filter((l) => /"(move|setOrder|attack|foundCity|train)"/.test(l)).length,
    };
  }

  it('an enemy unit on a tile the AI does not see does not change its actions', () => {
    const snapshots = runs.get('3:defended')!.snapshots;
    let all = 0;
    let unit = 0;
    for (const round of [20, 40, 60]) {
      const s = snapshots.get(round)!;
      const ended = applyAction(s, { type: 'endTurn' });
      if (!ended.ok) throw new Error('could not end the turn');
      let current = ended.state;
      // Every AI in turn (each plays its turn for real before the next one is checked).
      for (let k = 0; k < 3 && current.currentPlayer !== 0; k++) {
        const r = checkFair(current);
        all += r.all;
        unit += r.unit;
        const played = applyAction(takeAiTurn(current, current.currentPlayer), { type: 'endTurn' });
        if (!played.ok) break;
        current = played.state;
      }
    }
    expect(all).toBeGreaterThanOrEqual(10);
    expect(unit).toBeGreaterThanOrEqual(3);
  });

  it('a visible enemy unit next to a city does change what the AI does', () => {
    const state = runs.get('3:defended')!.snapshots.get(36);
    const ended = applyAction(state!, { type: 'endTurn' });
    if (!ended.ok) throw new Error('could not end the turn');
    const base = ended.state;
    const reference = log(base);
    const copy = structuredClone(base);
    const center = copy.cities.find((c) => c.owner === base.currentPlayer)!.center;
    const spot = neighbors(neighbors(center)[0]).find(
      (h) =>
        TERRAIN[copy.map.tiles[tileIndex(copy.map, h)]]?.moveCost !== null &&
        !copy.units.some((u) => u.hex.q === h.q && u.hex.r === h.r),
    )!;
    addUnit(copy, 'spearman', 0, spot);
    expect(log(copy)).not.toEqual(reference);
  });
});
