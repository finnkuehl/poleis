import { describe, expect, it } from 'vitest';
import { createGameState, type GameResult } from '../core/state';
import { endFigure } from './endScreen';

function ended(result: GameResult | null, playerColor = 0) {
  const state = createGameState('end', { settings: { aiCount: 2, playerColor } });
  state.result = result;
  return state;
}

describe('endFigure', () => {
  it('is null while the game runs', () => {
    expect(endFigure(ended(null), 0)).toBeNull();
  });

  it('shows the wonder in the winner color after a wonder victory', () => {
    expect(endFigure(ended({ winner: 0, reason: 'wonder', turn: 60 }, 2), 0)).toEqual({
      building: 'wonder',
      color: 2,
      muted: false,
    });
  });

  it('shows the city center after a victory by points or conquest', () => {
    for (const reason of ['points', 'conquest'] as const) {
      const state = ended({ winner: 0, reason, turn: 120 });
      expect(endFigure(state, 0)).toEqual({
        building: 'cityCenter',
        color: state.players[0].color,
        muted: false,
      });
    }
  });

  it('shows a greyed temple on a defeat, also when the last city fell', () => {
    expect(endFigure(ended({ winner: 1, reason: 'wonder', turn: 60 }), 0)).toMatchObject({
      building: 'temple',
      muted: true,
    });
    expect(endFigure(ended({ winner: null, reason: 'eliminated', turn: 30 }), 0)).toMatchObject({
      building: 'temple',
      muted: true,
    });
  });
});
