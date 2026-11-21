import { describe, expect, it } from 'vitest';
import { militaryConfig } from '../../data';
import { applyAction } from '../actions';
import { distance, hexEquals, neighbors } from '../hex';
import { hexAtIndex, tileIndex } from '../map';
import { createGameState } from '../state';
import { addBuilding, addUnit, at, makeTestState } from '../testing';
import { isVisible, updateExplored, visibleTiles } from './vision';

const exploredHexes = (s: ReturnType<typeof createGameState>, p = 0) =>
  s.players[p].explored.flatMap((e, i) => (e ? [hexAtIndex(s.map, i)] : []));

describe('fog of war', () => {
  it('new game: explored = tiles within city vision of the city center', () => {
    const s = createGameState('vision');
    const center = s.cities[0].center;
    s.players[0].explored.forEach((e, i) => {
      const inRange = distance(center, hexAtIndex(s.map, i)) <= militaryConfig.visionCity;
      expect(e).toBe(inRange);
    });
    expect(exploredHexes(s).length).toBeGreaterThan(1);
  });

  it('unit sees radius 2, border tower radius 3', () => {
    const s = makeTestState(Array(15).fill('p'.repeat(15)));
    const u = at(7, 7);
    addUnit(s, 'spearman', u);
    let vis = visibleTiles(s, 0);
    s.map.tiles.forEach((_, i) => {
      expect(vis[i]).toBe(distance(u, hexAtIndex(s.map, i)) <= 2);
    });
    const s2 = makeTestState(Array(15).fill('p'.repeat(15)));
    addBuilding(s2, 'borderTower', u);
    vis = visibleTiles(s2, 0);
    s2.map.tiles.forEach((_, i) => {
      expect(vis[i]).toBe(distance(u, hexAtIndex(s2.map, i)) <= 3);
    });
    expect(isVisible(s2, 0, u)).toBe(true);
  });

  it('tiles stay explored after the unit leaves but are no longer visible', () => {
    const s = makeTestState(Array(15).fill('p'.repeat(15)));
    const id = addUnit(s, 'spearman', at(2, 7));
    updateExplored(s, 0);
    const old = at(2, 7);
    const unit = s.units.find((x) => x.id === id)!;
    unit.hex = at(12, 7);
    updateExplored(s, 0);
    expect(s.players[0].explored[tileIndex(s.map, old)]).toBe(true);
    expect(isVisible(s, 0, old)).toBe(false);
    expect(isVisible(s, 0, at(12, 7))).toBe(true);
  });

  it('move extends explored', () => {
    const s = createGameState('vision');
    const c = s.cities[0].center;
    const unitId = addUnit(s, 'spearman', c);
    const target = neighbors(c).find((n) => tileIndex(s.map, n) >= 0)!;
    const before = s.players[0].explored.filter(Boolean).length;
    const r = applyAction(s, { type: 'move', unitId, to: target });
    if (!r.ok) throw new Error('move failed');
    const after = r.state.players[0].explored.filter(Boolean).length;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(r.state.players[0].explored[tileIndex(s.map, target)]).toBe(true);
  });

  it('a spawned unit extends explored on endTurn', () => {
    const s = makeTestState(Array(15).fill('p'.repeat(15)));
    s.training.push({ barracksId: 99, unit: 'spearman', owner: 0 });
    const b = addBuilding(s, 'barracks', at(7, 7));
    s.training[0].barracksId = b;
    s.buildings.push({
      id: s.nextId++,
      type: 'cityCenter',
      owner: 0,
      hex: at(1, 1),
      paused: false,
    });
    s.cities.push({
      id: s.nextId - 1,
      owner: 0,
      center: at(1, 1),
      level: 'settlement',
      residents: 3,
      supplyStreak: 0,
    });
    const r = applyAction(s, { type: 'endTurn' });
    if (!r.ok) throw new Error('endTurn failed');
    expect(r.state.units.length).toBe(1);
    expect(r.state.players[0].explored[tileIndex(s.map, at(7, 7))]).toBe(true);
  });

  it('founding a city extends explored (city vision 3)', () => {
    const s = makeTestState(
      Array.from({ length: 9 }, () => 'p'.repeat(14)),
      { ownAll: false },
    );
    addBuilding(s, 'cityCenter', at(2, 4));
    s.cities.push({
      id: 1,
      owner: 0,
      center: at(2, 4),
      level: 'settlement',
      residents: 3,
      supplyStreak: 0,
    });
    const id = addUnit(s, 'settler', at(9, 4));
    updateExplored(s, 0);
    const far = at(12, 4);
    expect(s.players[0].explored[tileIndex(s.map, far)]).toBe(false);
    const r = applyAction(s, { type: 'foundCity', unitId: id });
    if (!r.ok) throw new Error('found failed');
    expect(r.state.players[0].explored[tileIndex(s.map, far)]).toBe(true);
  });

  it('sandbox: separate explored areas per player', () => {
    const s = createGameState('vision', { sandbox: true });
    expect(s.players).toHaveLength(2);
    const enemy = s.cities.find((c) => c.owner === 1)!;
    const human = s.cities.find((c) => c.owner === 0)!;
    expect(distance(enemy.center, human.center)).toBeGreaterThan(militaryConfig.visionCity);
    expect(s.players[0].explored[tileIndex(s.map, enemy.center)]).toBe(false);
    expect(s.players[1].explored[tileIndex(s.map, enemy.center)]).toBe(true);
    expect(s.players[1].explored[tileIndex(s.map, human.center)]).toBe(false);
  });

  it('stays JSON-plain and deterministic', () => {
    const a = createGameState('vision', { sandbox: true });
    const b = createGameState('vision', { sandbox: true });
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(hexEquals(a.cities[0].center, b.cities[0].center)).toBe(true);
  });
});
