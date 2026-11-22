import { describe, expect, it } from 'vitest';
import { at, makeTestState } from '../core/testing';
import { tileIndex } from '../core/map';
import type { Building } from '../core/state';
import {
  buildingsShownTo,
  fogEdgeMask,
  fogShade,
  fogSignature,
  fogState,
  hpBarColor,
  unitTokenOffset,
  type FogState,
} from './fog';
import { edgeNeighborHex } from './geometry';
import { theme } from './theme';

describe('fogState', () => {
  const explored = [false, true, true];
  const visible = [false, false, true];
  it('classifies tiles', () => {
    expect(fogState(explored, visible, 0)).toBe('hidden');
    expect(fogState(explored, visible, 1)).toBe('dim');
    expect(fogState(explored, visible, 2)).toBe('clear');
  });
  it('signature changes with visibility', () => {
    expect(fogSignature(explored, visible)).toBe('hdc');
    expect(fogSignature(explored, [true, false, true])).toBe('cdc');
  });
});

describe('hpBarColor', () => {
  it('goes green -> ochre -> red', () => {
    expect(hpBarColor(1)).toBe(theme.hpBarGoodColor);
    expect(hpBarColor(0.5)).toBe(theme.hpBarMidColor);
    expect(hpBarColor(0.1)).toBe(theme.hpBarLowColor);
  });
});

describe('unitTokenOffset', () => {
  it('moves up only on buildings', () => {
    expect(unitTokenOffset(false, 32)).toBe(0);
    expect(unitTokenOffset(true, 32)).toBeLessThan(0);
  });
});

describe('fogEdgeMask', () => {
  it('marks the edges whose neighbor has the target fog state', () => {
    const s = makeTestState(['ppppp', 'ppppp', 'ppppp', 'ppppp', 'ppppp']);
    const fog: FogState[] = s.map.tiles.map(() => 'clear');
    const h = at(2, 2);
    const east = edgeNeighborHex(h, 0);
    const west = edgeNeighborHex(h, 3);
    fog[tileIndex(s.map, east)] = 'hidden';
    fog[tileIndex(s.map, west)] = 'dim';
    expect(fogEdgeMask(s.map, h, fog, 'hidden')).toEqual([true, false, false, false, false, false]);
    expect(fogEdgeMask(s.map, h, fog, 'dim')).toEqual([false, false, false, true, false, false]);
  });
  it('the map border never counts', () => {
    const s = makeTestState(['pp', 'pp']);
    const fog: FogState[] = s.map.tiles.map(() => 'hidden');
    const mask = fogEdgeMask(s.map, at(0, 0), fog, 'hidden');
    expect(mask.filter(Boolean).length).toBeLessThan(6);
  });
});

describe('fogShade', () => {
  it('lies in [0, 1] and changes slowly between neighboring tiles', () => {
    for (let x = -500; x < 3000; x += 37) {
      for (let y = -500; y < 3000; y += 41) {
        const v = fogShade(x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        // One hex step (55 px) changes the shade only a little
        expect(Math.abs(fogShade(x + 55, y) - v)).toBeLessThan(0.25);
      }
    }
  });
});

describe('buildingsShownTo', () => {
  function withBuildings() {
    // Nothing explored yet; the viewer (0) has explored only the tile of building 2
    const state = makeTestState(['pppp', 'pppp'], { explored: false });
    const building = (id: number, owner: number, col: number, row: number): Building => ({
      id,
      type: 'house',
      owner,
      hex: at(col, row),
      paused: false,
    });
    state.buildings = [
      building(1, 1, 0, 0), // enemy, unexplored
      building(2, 1, 2, 0), // enemy, explored (remembered even when not visible)
      building(3, 0, 3, 1), // own, always shown
    ];
    state.players[0].explored[tileIndex(state.map, at(2, 0))] = true;
    return state;
  }

  it('hides buildings on tiles the viewer has not explored', () => {
    const ids = buildingsShownTo(withBuildings(), 0, false).map((b) => b.id);
    expect(ids).toEqual([2, 3]);
  });

  it('shows every building with the reveal test option', () => {
    const state = withBuildings();
    expect(buildingsShownTo(state, 0, true)).toBe(state.buildings);
  });

  it('shows no foreign buildings to a viewer without exploration data', () => {
    const ids = buildingsShownTo(withBuildings(), 7, false).map((b) => b.id);
    expect(ids).toEqual([]);
  });
});
