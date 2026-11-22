// The AI and ships (M6): it never builds harbors or ships and is not confused by enemy ships.

import { describe, expect, it } from 'vitest';
import { applyAction } from '../core/actions';
import { neighbors } from '../core/hex';
import { tileIndex } from '../core/map';
import { createGameState, type GameState } from '../core/state';
import { aiConfig, TERRAIN, UNITS, type UnitId } from '../data';
import { buildContext } from './context';
import { GENERATORS } from './generators';
import { simulate } from './testing';
import { isAllowed, takeAiTurn } from './turn';

function waterNear(state: GameState, from: { q: number; r: number }, skip = 0) {
  const found: { q: number; r: number }[] = [];
  const seen = new Set<string>();
  let ring = [from];
  for (let d = 0; d < 8; d++) {
    const next: { q: number; r: number }[] = [];
    for (const h of ring) {
      for (const n of neighbors(h)) {
        const k = `${n.q},${n.r}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const t = state.map.tiles[tileIndex(state.map, n)];
        if (t === undefined) continue;
        if (TERRAIN[t].isWater) found.push(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return found[skip];
}

function addShip(state: GameState, type: UnitId, owner: number, hex: { q: number; r: number }) {
  const id = state.nextId++;
  const def = UNITS[type];
  state.units.push({
    id,
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
  return id;
}

describe('AI and seafaring', () => {
  it('never builds a harbor and never trains ships (filter)', () => {
    expect(
      isAllowed({
        action: { type: 'build', building: 'harbor', hex: { q: 0, r: 0 } },
        utility: 99,
        reason: '',
        key: 'a',
      }),
    ).toBe(false);
    for (const unit of ['transport', 'trireme'] as const) {
      expect(
        isAllowed({
          action: { type: 'train', barracksId: 1, unit },
          utility: 99,
          reason: '',
          key: 'b',
        }),
      ).toBe(false);
    }
    expect(
      isAllowed({
        action: { type: 'train', barracksId: 1, unit: 'spearman' },
        utility: 9,
        reason: '',
        key: 'c',
      }),
    ).toBe(true);
    expect(aiConfig.neverBuild).toContain('harbor');
  });

  it('no AI civilization owns a harbor or a ship after 40 rounds', () => {
    const r = simulate('7', 40, { aiCount: 2 });
    for (const b of r.state.buildings) {
      if (b.owner !== 0) expect(b.type).not.toBe('harbor');
    }
    for (const u of r.state.units) {
      if (u.owner !== 0) expect(UNITS[u.type].domain).toBe('land');
    }
  }, 120000);

  it('does not crash with enemy ships and passengers around its cities', () => {
    let state = createGameState('sea-ai', { settings: { aiCount: 1 } });
    state.turn = 20;
    const aiCity = state.cities.find((c) => c.owner === 1)!;
    const ship = addShip(state, 'transport', 0, waterNear(state, aiCity.center, 0));
    addShip(state, 'trireme', 0, waterNear(state, aiCity.center, 1));
    const passenger = addShip(state, 'spearman', 0, waterNear(state, aiCity.center, 0));
    state.units.find((u) => u.id === passenger)!.aboard = ship;
    state.currentPlayer = 1;
    const ctx = buildContext(state, 1);
    const candidates = GENERATORS.flatMap((g) => g(ctx));
    // Nobody in view: the AI plans nothing against ships or passengers.
    expect(ctx.state.units.length).toBeGreaterThan(0);
    for (const c of candidates) {
      if (c.action?.type === 'move' || c.action?.type === 'setOrder') {
        expect(c.action.unitId).not.toBe(ship);
      }
      if (c.action?.type === 'attack') expect(c.action.targetId).not.toBe(passenger);
    }
    state = takeAiTurn(state, 1);
    expect(state.units.find((u) => u.id === ship)).toBeDefined();
    // The AI can end its turn and the world goes on.
    const ended = applyAction(state, { type: 'endTurn' });
    expect(ended.ok).toBe(true);
  });

  it('an AI archer shoots an enemy ship that comes within range', () => {
    const state = createGameState('sea-ai-archer', { settings: { aiCount: 1 } });
    state.turn = 30;
    state.currentPlayer = 1;
    const aiCity = state.cities.find((c) => c.owner === 1)!;
    const water = waterNear(state, aiCity.center, 0);
    // An AI archer on land, two tiles from a water tile holding the human's trireme.
    const landNext = neighbors(water).find((n) => {
      const t = state.map.tiles[tileIndex(state.map, n)];
      return t !== undefined && TERRAIN[t].moveCost !== null;
    });
    expect(landNext).toBeDefined();
    if (!landNext) return;
    const archer = addShip(state, 'archer', 1, landNext);
    const tri = addShip(state, 'trireme', 0, water);
    const next = takeAiTurn(state, 1);
    const before = state.units.find((u) => u.id === tri)!.hp;
    const after = next.units.find((u) => u.id === tri)?.hp ?? 0;
    expect(next.units.some((u) => u.id === archer)).toBe(true);
    expect(after).toBeLessThan(before);
  });
});
