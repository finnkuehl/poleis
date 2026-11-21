// Integration: whole economy flows, driven only through applyAction.

import { describe, expect, it } from 'vitest';
import { applyAction, type Action } from './actions';
import { claimTerritory, validPlacements } from './rules';
import type { BuildingStatus } from './rules';
import { createGameState, type GameState } from './state';
import { addBuilding, at, makeTestState } from './testing';

function run(state: GameState, ...actions: Action[]): GameState {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`action ${JSON.stringify(a)} failed: ${r.error.code}`);
    s = r.state;
  }
  return s;
}

function statusOf(s: GameState, id: number): BuildingStatus | undefined {
  return s.lastReport?.buildings.find((b) => b.buildingId === id)?.status;
}

function setup(rows: string[], wood = 20, stone = 10): GameState {
  const s = makeTestState(rows, { goods: { wood, stone }, ownAll: false });
  const center = at(1, 1);
  addBuilding(s, 'cityCenter', center);
  claimTerritory(s, center, 6, 0);
  return s;
}

describe('economy flow', () => {
  it('woodcutter next to the city center: wood = 20 - 2 + 2', () => {
    const s = setup(['pppppp', 'pppfpp', 'pppppp']);
    const t = run(s, { type: 'build', building: 'woodcutter', hex: at(2, 1) }, { type: 'endTurn' });
    expect(t.players[0].goods.wood).toBe(20);
    expect(t.turn).toBe(2);
  });

  it('sawmill needs a road, then turns wood into planks in the same turn', () => {
    const s = setup(['ppppppppp', 'ppppppppp', 'ppppppppp']);
    let t = run(s, { type: 'build', building: 'sawmill', hex: at(6, 1) }, { type: 'endTurn' });
    const sawmillId = t.buildings.find((b) => b.type === 'sawmill')!.id;
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'notConnected' });
    t = run(t, { type: 'buildRoad', from: at(1, 1), to: at(6, 1) }, { type: 'endTurn' });
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'producing' });
    expect(t.players[0].goods.planks).toBe(2);
  });

  it('workers: 4 housed, a 5th worker waits until a house is built', () => {
    // City center at (1,1); all builds below are direct neighbors of it.
    const s = setup(['phpp', 'pppf', 'pppp'], 40, 20);
    let t = run(
      s,
      { type: 'build', building: 'farm', hex: at(0, 1) },
      { type: 'build', building: 'woodcutter', hex: at(2, 1) },
      { type: 'build', building: 'quarry', hex: at(1, 0) },
      { type: 'build', building: 'sawmill', hex: at(1, 2) },
      { type: 'endTurn' },
    );
    const sawmillId = t.buildings.find((b) => b.type === 'sawmill')!.id;
    expect(statusOf(t, sawmillId)).toMatchObject({ kind: 'missingWorkers' });
    t = run(t, { type: 'build', building: 'house', hex: at(2, 0) }, { type: 'endTurn' });
    expect(statusOf(t, sawmillId)).toEqual({ kind: 'producing' });
  });
});

describe('determinism', () => {
  it('same seed + same actions = same state', () => {
    const play = (): GameState => {
      let s = createGameState('det');
      s = run(
        s,
        { type: 'build', building: 'house', hex: validPlacements(s, 0, 'house')[0] },
        { type: 'endTurn' },
        { type: 'endTurn' },
      );
      return s;
    };
    expect(play()).toEqual(play());
  });
});
