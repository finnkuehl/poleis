import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/state';
import { playAiTurns } from './play';

describe('playAiTurns', () => {
  it('plays all AI turns and returns to the human with turn + 1', () => {
    let s = createGameState('5', { settings: { aiCount: 3 } });
    s = { ...s, currentPlayer: 1 };
    const before = createGameState('5', { settings: { aiCount: 3 } });
    expect(before.currentPlayer).toBe(0);
    const out = playAiTurns(s);
    expect(out.currentPlayer).toBe(0);
    expect(out.turn).toBe(s.turn + 1);
    // The input stays untouched.
    expect(s.currentPlayer).toBe(1);
  });

  it('is a no-op on the human turn', () => {
    const s = createGameState('5', { settings: { aiCount: 2 } });
    expect(playAiTurns(s)).toBe(s);
  });

  it('runs the actions of `decide` and skips failed ones', () => {
    const s0 = createGameState('5', { settings: { aiCount: 1 } });
    const s = { ...s0, currentPlayer: 1 };
    const out = playAiTurns(s, (_state, player) => [
      { type: 'demolish', hex: { q: -99, r: -99 } },
      { type: 'build', building: 'house', hex: s.cities.find((c) => c.owner === player)!.center },
    ]);
    expect(out.currentPlayer).toBe(0);
  });

  it('stops without looping if the human is out of the game', () => {
    const s0 = createGameState('5', { settings: { aiCount: 2 } });
    const s = { ...s0, currentPlayer: 1 };
    s.players[0].alive = false;
    expect(playAiTurns(s)).toBe(s);
  });

  it('human out in the middle: stops', () => {
    // The human's last city is gone before the AI turns end: no endless loop.
    const s0 = createGameState('5', { settings: { aiCount: 2 } });
    const s = { ...s0, currentPlayer: 1 };
    s.cities = s.cities.filter((c) => c.owner !== 0);
    const out = playAiTurns(s);
    expect(out.players[0].alive).toBe(false);
    expect(out.turn).toBeLessThanOrEqual(s.turn + 1);
  });
});
