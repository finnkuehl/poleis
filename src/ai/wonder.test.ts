import { describe, expect, it } from 'vitest';
import { applyAction } from '../core/actions';
import { neighbors } from '../core/hex';
import type { GameState } from '../core/state';
import { addBuilding, addCity, at, makeTestState } from '../core/testing';
import { buildContext } from './context';
import { wonderCandidates } from './wonder';

/** Applies the wonder candidates one by one until there are none; returns how many were applied. */
function applyAll(state: GameState): { state: GameState; applied: number } {
  let current = state;
  let applied = 0;
  for (let i = 0; i < 10; i++) {
    const [candidate] = wonderCandidates(buildContext(current, 0));
    if (!candidate?.action) break;
    const result = applyAction(current, candidate.action);
    if (!result.ok) throw new Error('the action should be possible');
    current = result.state;
    applied += 1;
  }
  return { state: current, applied };
}

function setup(): GameState {
  const rows = Array.from({ length: 9 }, () => 'ppppppppp');
  const s = makeTestState(rows, { goods: { wood: 50, stone: 50 } });
  const center = at(4, 4);
  addCity(s, center, { residents: 8, level: 'metropolis', radius: 3 });
  // All around the city center (so all are connected): a farm (food), a woodcutter, a quarry,
  // a marketplace, a sawmill and, built last, the unfinished wonder.
  const ring = neighbors(center);
  const types = ['farm', 'woodcutter', 'quarry', 'marketplace', 'sawmill', 'wonder'] as const;
  types.forEach((type, i) => {
    const id = addBuilding(s, type, ring[i]);
    if (type === 'wonder') s.buildings.find((b) => b.id === id)!.progress = 1;
  });
  return s;
}

const pausedTypes = (s: GameState): string[] =>
  s.buildings.filter((b) => b.paused).map((b) => b.type);

describe('wonder crew', () => {
  it('pauses the lowest-value non-food buildings until the wonder has its crew', () => {
    const s = setup();
    // 8 residents, 6 needed by the other buildings: only 2 are free, the wonder needs 4.
    const before = buildContext(s, 0);
    const wonder = s.buildings.find((b) => b.type === 'wonder')!;
    expect(before.statusOf.get(wonder.id)).toBe('missingWorkers');

    const { state, applied } = applyAll(s);
    expect(applied).toBe(2);
    // The marketplace and the quarry are worth the least of the staffed ones; the farm
    // (food), the sawmill and the woodcutter keep working.
    expect(pausedTypes(state).sort()).toEqual(['marketplace', 'quarry']);
    expect(buildContext(state, 0).statusOf.get(wonder.id)).toBe('wonderBuilding');
  });

  it('never pauses a food building, even if that would not be enough otherwise', () => {
    const s = setup();
    // Fewer residents: not even pausing everything non-food gives the crew.
    s.cities[0].residents = 5;
    const { state } = applyAll(s);
    expect(pausedTypes(state)).not.toContain('farm');
    expect(pausedTypes(state)).not.toContain('wonder');
  });

  it('unpauses everything once the wonder is complete', () => {
    const { state: paused } = applyAll(setup());
    expect(pausedTypes(paused)).toHaveLength(2);
    const done = structuredClone(paused);
    done.buildings.find((b) => b.type === 'wonder')!.progress = 5;
    const { state, applied } = applyAll(done);
    expect(applied).toBe(2);
    expect(pausedTypes(state)).toEqual([]);
  });

  it('does nothing when the wonder already has its workers', () => {
    const s = setup();
    s.cities[0].residents = 12;
    expect(wonderCandidates(buildContext(s, 0))).toEqual([]);
  });
});
