import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/state';
import type { GameResult } from '../core/state';
import { en } from '../i18n/en';
import { endText } from './endText';

function ended(result: GameResult | null) {
  const state = createGameState('end', { settings: { aiCount: 1, playerName: 'Ilios' } });
  state.result = result;
  return state;
}

describe('endText', () => {
  it('is null while the game runs', () => {
    expect(endText(ended(null), 0)).toBeNull();
  });

  it('says Victory with the reason for each way to win', () => {
    expect(endText(ended({ winner: 0, reason: 'wonder', turn: 40 }), 0)).toEqual({
      victory: true,
      title: en.endScreen.victory,
      reason: en.endScreen.reasonWonderYou,
    });
    expect(endText(ended({ winner: 0, reason: 'conquest', turn: 40 }), 0)?.reason).toBe(
      en.endScreen.reasonConquestYou,
    );
    expect(endText(ended({ winner: 0, reason: 'points', turn: 120 }), 0)?.reason).toBe(
      'You have the most points after 120 turns.',
    );
  });

  it('says Defeat and names the winner when a rival wins', () => {
    const rival = ended({ winner: 1, reason: 'wonder', turn: 50 });
    const name = en.civs[rival.players[1].civ ?? 'athens'];
    const text = endText(rival, 0);
    expect(text?.victory).toBe(false);
    expect(text?.title).toBe(en.endScreen.defeat);
    expect(text?.reason).toBe(`${name} completed the world wonder first.`);
    expect(endText(ended({ winner: 1, reason: 'points', turn: 120 }), 0)?.reason).toContain(
      '120 turns',
    );
  });

  it('says the last city fell when the human is eliminated', () => {
    const text = endText(ended({ winner: null, reason: 'eliminated', turn: 33 }), 0);
    expect(text).toEqual({
      victory: false,
      title: en.endScreen.defeat,
      reason: en.endScreen.reasonEliminated,
    });
  });
});
