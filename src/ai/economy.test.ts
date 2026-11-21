import { beforeAll, describe, expect, it } from 'vitest';
import { applyAction } from '../core/actions';
import { connectedBuildingIds, emptyStock, previewProduction } from '../core/rules';
import type { GameState, PlayerId } from '../core/state';
import { addBuilding, addCity, at, makeTestState } from '../core/testing';
import { BUILDINGS, populationConfig, type BuildingId } from '../data';
import { buildContext } from './context';
import { roadCandidates } from './economy';
import { simulate, type SimulationResult } from './testing';
import { chooseCandidate } from './turn';
import type { Candidate } from './types';

const SEEDS = ['1', '2', '3'];
const ROUNDS = 50;

interface Run {
  result: SimulationResult;
  /** Houses per player after round 20. */
  housesAt20: Record<PlayerId, number>;
  /** Rounds in which a worker building was left unconnected at the end of the round. */
  unconnectedRounds: string[];
}

const runs = new Map<string, Run>();

function countOf(state: GameState, player: PlayerId, type: BuildingId): number {
  return state.buildings.filter((b) => b.owner === player && b.type === type).length;
}

function unconnected(state: GameState, player: PlayerId): string[] {
  const connected = connectedBuildingIds(state, player);
  return state.buildings
    .filter((b) => b.owner === player && BUILDINGS[b.type].workers > 0 && !connected.has(b.id))
    .map((b) => b.type);
}

beforeAll(() => {
  for (const seed of SEEDS) {
    const housesAt20: Record<PlayerId, number> = {};
    const unconnectedRounds: string[] = [];
    const result = simulate(seed, ROUNDS, {
      onRound: (round, state) => {
        for (const p of state.players.filter((x) => !x.isHuman)) {
          const bad = unconnected(state, p.id);
          if (bad.length > 0) unconnectedRounds.push(`${seed}:${round}:${p.civ}:${bad.join(',')}`);
          if (round === 20) housesAt20[p.id] = countOf(state, p.id, 'house');
        }
      },
    });
    runs.set(seed, { result, housesAt20, unconnectedRounds });
  }
}, 120000);

describe('AI economy after 50 rounds (3 AIs)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: every AI has a working basic economy`, () => {
      const { state } = runs.get(seed)!.result;
      const ais = state.players.filter((p) => !p.isHuman);
      expect(ais).toHaveLength(3);
      for (const p of ais) {
        // (An AI that lost its last city to an attack has no economy left to check.)
        if (!p.alive) continue;
        const label = `${seed}/${p.civ}`;
        expect(countOf(state, p.id, 'woodcutter'), `${label} woodcutter`).toBeGreaterThanOrEqual(1);
        expect(countOf(state, p.id, 'quarry'), `${label} quarry`).toBeGreaterThanOrEqual(1);
        expect(countOf(state, p.id, 'house'), `${label} houses`).toBeGreaterThanOrEqual(2);
        // A food source that actually works: a fishery, or a bakery (farm + bakery).
        const report = previewProduction(state, p.id);
        const producing = (type: BuildingId): boolean =>
          state.buildings.some(
            (b) =>
              b.owner === p.id &&
              b.type === type &&
              report.buildings.some((r) => r.buildingId === b.id && r.status.kind === 'producing'),
          );
        expect(producing('fishery') || producing('bakery'), `${label} food`).toBe(true);
        const residents = state.cities
          .filter((c) => c.owner === p.id)
          .reduce((sum, c) => sum + c.residents, 0);
        expect(residents, `${label} residents`).toBeGreaterThan(populationConfig.startResidents);
      }
    });

    it(`seed ${seed}: no worker building stays unconnected`, () => {
      expect(runs.get(seed)!.unconnectedRounds).toEqual([]);
    });

    it(`seed ${seed}: almost no action fails`, () => {
      const { applied, failed } = runs.get(seed)!.result;
      expect(applied).toBeGreaterThan(50);
      expect(failed).toBeLessThanOrEqual(Math.ceil(applied * 0.02));
    });
  }

  it('some AIs grow clearly beyond the start (reach Polis)', () => {
    // (Units, settlers and war cost growth: with the military AI fewer reach Polis than before.)
    let polis = 0;
    for (const seed of SEEDS) {
      const { state } = runs.get(seed)!.result;
      for (const p of state.players.filter((x) => !x.isHuman)) {
        if (state.cities.some((c) => c.owner === p.id && c.level !== 'settlement')) polis += 1;
      }
    }
    expect(polis).toBeGreaterThanOrEqual(2);
  });

  it('Sparta (warrior) builds its barracks no later than Athens (merchant), usually much earlier', () => {
    let earlier = 0;
    for (const seed of SEEDS) {
      const { result } = runs.get(seed)!;
      const civId = (civ: string): PlayerId => result.state.players.find((p) => p.civ === civ)!.id;
      const sparta = result.firstRound(civId('sparta'), 'barracks');
      const athens = result.firstRound(civId('athens'), 'barracks') ?? Infinity;
      // (On seed 2 Sparta has no free plains left for a barracks at all.)
      if (sparta === null) continue;
      expect(sparta, `seed ${seed}`).toBeLessThanOrEqual(athens);
      if (sparta < athens) earlier += 1;
    }
    expect(earlier).toBeGreaterThanOrEqual(2);
  });

  it('Corinth (builder) has built more houses than Athens (merchant) by round 20 (all seeds together)', () => {
    let corinth = 0;
    let athens = 0;
    for (const seed of SEEDS) {
      const { result, housesAt20 } = runs.get(seed)!;
      corinth += housesAt20[result.state.players.find((p) => p.civ === 'corinth')!.id];
      athens += housesAt20[result.state.players.find((p) => p.civ === 'athens')!.id];
    }
    expect(corinth).toBeGreaterThan(athens);
  });

  it('is fast: a few milliseconds per AI turn', () => {
    for (const seed of SEEDS) {
      const { ms, aiTurns } = runs.get(seed)!.result;
      expect(ms).toBeLessThan(20000);
      expect(ms / aiTurns).toBeLessThan(100);
    }
  });
});

describe('determinism', () => {
  it('same seed + same rounds give identical states', () => {
    const a = simulate('2', 30).state;
    const b = simulate('2', 30).state;
    expect(a).toEqual(b);
  });
});

describe('takeAiTurn on a small map', () => {
  it('connects a building that stands away from the network', () => {
    const s = makeTestState(['ppppppp', 'ppppppp', 'ppppppp', 'ppppppp', 'ppppppp'], {
      goods: { wood: 20 },
    });
    addCity(s, at(0, 2), { radius: 6 });
    addBuilding(s, 'farm', at(4, 2));
    const ctx = buildContext(s, 0);
    const [candidate] = roadCandidates(ctx);
    expect(candidate.action).toMatchObject({ type: 'buildRoad' });
    const result = applyAction(s, candidate.action!);
    if (!result.ok) throw new Error('the road should be buildable');
    const farm = result.state.buildings.find((b) => b.type === 'farm')!;
    expect(connectedBuildingIds(result.state, 0).has(farm.id)).toBe(true);
    // Nothing left to connect.
    expect(roadCandidates(buildContext(result.state, 0))).toEqual([]);
  });

  it('knows that a tile next to the network needs no road', () => {
    const s = makeTestState(['ppppppp', 'ppppppp', 'ppppppp']);
    addCity(s, at(0, 1), { radius: 6 });
    const ctx = buildContext(s, 0);
    expect(ctx.roadInfo(at(1, 1))).toEqual({ cost: 0, target: null });
    expect(ctx.roadInfo(at(4, 1))?.cost).toBe(3);
  });
});

describe('chooseCandidate', () => {
  const stock = { ...emptyStock(), wood: 10, stone: 10 };
  const make = (key: string, utility: number, extra: Partial<Candidate> = {}): Candidate => ({
    action: { type: 'endTurn' },
    utility,
    reason: key,
    key,
    ...extra,
  });

  it('takes the highest utility; ties go to the first one', () => {
    const picked = chooseCandidate([make('a', 50), make('b', 70), make('c', 70)], stock, new Set());
    expect(picked?.key).toBe('b');
  });

  it('stops at the minimum utility and skips failed keys', () => {
    expect(chooseCandidate([make('a', 5)], stock, new Set())).toBeNull();
    expect(chooseCandidate([make('a', 50), make('b', 40)], stock, new Set(['a']))?.key).toBe('b');
  });

  it('skips what it cannot pay, and keeps goods for a reserved wish', () => {
    const picked = chooseCandidate(
      [
        make('big', 90, { cost: { wood: 15 }, reserve: true }),
        make('small', 60, { cost: { wood: 8 } }),
        make('income', 50, { cost: { wood: 8 }, bypassReserve: true }),
      ],
      { ...stock, wood: 10 },
      new Set(),
    );
    // "big" is not affordable and reserves 15 wood, so "small" must not spend it; "income" may.
    expect(picked?.key).toBe('income');
  });
});
