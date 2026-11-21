import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/state';
import { playerColorOf } from './playerColor';
import { theme } from './theme';

describe('playerColorOf', () => {
  it('uses the color chosen in the state', () => {
    const state = createGameState('colors', { settings: { playerColor: 3 } });
    expect(playerColorOf(state, 0)).toBe(theme.playerColors[3]);
  });

  it('falls back to the owner index for unknown players', () => {
    const state = createGameState('colors');
    expect(playerColorOf(state, 2)).toBe(theme.playerColors[2]);
    expect(playerColorOf(state, 5)).toBe(theme.playerColors[1]);
  });
});
