// Texts and rows for the scores sheet and the end screen (pure, no DOM).
import { scoreboard, scoreOf } from '../core/rules/score';
import { isPassive, type GameState, type PlayerId } from '../core/state';
import { wonderConfig } from '../data';
import { en } from '../i18n/en';
import { fill } from '../i18n/format';

/** Display name of a civilization: the human's typed (or default) name, an AI's civilization, the test enemy. */
export function civName(state: GameState, player: PlayerId): string {
  const p = state.players.find((q) => q.id === player);
  if (!p) return '';
  if (p.isHuman) return state.settings.playerName.trim() || p.name.trim() || en.defaultPlayerName;
  if (p.civ) return en.civs[p.civ];
  return isPassive(p) ? en.passiveEnemyName : p.name;
}

export interface ScoreRowView {
  player: PlayerId;
  /** Index into the player colors. */
  color: number;
  name: string;
  points: number;
  /** "Wonder 2 of 5", "Wonder complete" or null if the civilization has no wonder. */
  wonder: string | null;
  /** Out of the game (lost its last city). */
  out: boolean;
  isViewer: boolean;
}

/** Text for the wonder progress of one civilization; null = no wonder. */
export function wonderText(progress: number | null): string | null {
  if (progress === null) return null;
  if (progress >= wonderConfig.buildTurns) return en.scores.wonderComplete;
  return fill(en.scores.wonderProgress, { done: progress, total: wonderConfig.buildTurns });
}

/** One row per civilization (also ones the viewer has not met), best first. */
export function scoreRows(state: GameState, viewer: PlayerId): ScoreRowView[] {
  return scoreboard(state).map((row) => ({
    player: row.player,
    color: state.players.find((p) => p.id === row.player)?.color ?? row.player,
    name: civName(state, row.player),
    points: row.total,
    wonder: wonderText(row.wonderProgress),
    out: !row.alive,
    isViewer: row.player === viewer,
  }));
}

export interface BreakdownLine {
  label: string;
  points: number;
}

/** The viewer's points by source, then the total as the last line. */
export function scoreBreakdown(state: GameState, viewer: PlayerId): BreakdownLine[] {
  const s = scoreOf(state, viewer);
  return [
    { label: en.scores.residents, points: s.residents },
    { label: en.scores.buildings, points: s.buildings },
    { label: en.scores.territory, points: s.territory },
    { label: en.scores.levels, points: s.levels },
    { label: en.scores.temples, points: s.temples },
    { label: en.scores.wonder, points: s.wonder },
    { label: en.scores.total, points: s.total },
  ];
}
