import { describe, expect, it } from 'vitest';
import { scoreOf } from '../core/rules/score';
import { createGameState } from '../core/state';
import { wonderConfig } from '../data';
import { en } from '../i18n/en';
import { civName, scoreBreakdown, scoreRows, wonderText } from './scoreText';

describe('civName', () => {
  it('uses the typed name, trimmed, or the default name for the human', () => {
    expect(civName(createGameState('s', { settings: { playerName: '  Ilios ' } }), 0)).toBe(
      'Ilios',
    );
    expect(civName(createGameState('s'), 0)).toBe(en.defaultPlayerName);
  });

  it('uses the civilization name for AIs and a fixed name for the test enemy', () => {
    const state = createGameState('s', { settings: { aiCount: 2 } });
    for (const p of state.players.filter((q) => !q.isHuman)) {
      expect(civName(state, p.id)).toBe(en.civs[p.civ ?? 'athens']);
    }
    expect(civName(createGameState('s', { sandbox: true }), 1)).toBe(en.passiveEnemyName);
    expect(civName(state, 99)).toBe('');
  });
});

describe('wonderText', () => {
  it('shows progress, completion or nothing', () => {
    expect(wonderText(null)).toBeNull();
    expect(wonderText(2)).toBe(`Wonder 2 of ${wonderConfig.buildTurns}`);
    expect(wonderText(wonderConfig.buildTurns)).toBe(en.scores.wonderComplete);
  });
});

describe('scoreRows', () => {
  const state = createGameState('rows', { settings: { aiCount: 3, playerColor: 2 } });

  it('lists every civilization, best first, and marks the viewer', () => {
    const rows = scoreRows(state, 0);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.isViewer).map((r) => r.player)).toEqual([0]);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i - 1].points).toBeGreaterThanOrEqual(rows[i].points);
    expect(rows.find((r) => r.player === 0)?.color).toBe(2);
    expect(rows.every((r) => !r.out && r.wonder === null)).toBe(true);
  });

  it('marks civilizations that are out of the game and shows wonder progress', () => {
    const s = createGameState('rows', { settings: { aiCount: 1 } });
    s.players[1].alive = false;
    s.buildings.push({
      id: 99,
      type: 'wonder',
      owner: 0,
      hex: { q: 0, r: 0 },
      paused: false,
      progress: 2,
    });
    const rows = scoreRows(s, 0);
    expect(rows.find((r) => r.player === 1)?.out).toBe(true);
    expect(rows.find((r) => r.player === 0)?.wonder).toBe(`Wonder 2 of ${wonderConfig.buildTurns}`);
  });
});

describe('scoreBreakdown', () => {
  it('ends with the total of the viewer', () => {
    const state = createGameState('breakdown');
    const lines = scoreBreakdown(state, 0);
    const total = lines[lines.length - 1];
    expect(total.label).toBe(en.scores.total);
    expect(total.points).toBe(scoreOf(state, 0).total);
    expect(lines.slice(0, -1).reduce((sum, l) => sum + l.points, 0)).toBe(total.points);
  });
});
