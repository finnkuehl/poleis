import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/state';
import { aiConfig } from '../data';
import { buildContext } from './context';

describe('personality lookup', () => {
  it('uses the watch personality for a player without a civ (watch mode)', () => {
    const s = createGameState('5', { settings: { aiCount: 1 } });
    expect(s.players[0].civ).toBeNull();
    expect(buildContext(s, 0).personality).toBe(aiConfig.watchPersonality);
  });

  it('uses the civ personality for an AI civilization', () => {
    const s = createGameState('5', { settings: { aiCount: 1 } });
    const ai = s.players.find((p) => p.civ !== null);
    expect(ai).toBeDefined();
    expect(buildContext(s, ai!.id).personality).not.toBeUndefined();
  });
});
