// Title and reason line of the end screen (pure, no DOM).
import type { GameState, PlayerId } from '../core/state';
import { en } from '../i18n/en';
import { fill, formatTurns } from '../i18n/format';
import { civName } from './scoreText';

export interface EndText {
  /** true = the viewer won. */
  victory: boolean;
  title: string;
  reason: string;
}

/** What to say when the game is over; null while it still runs. */
export function endText(state: GameState, viewer: PlayerId): EndText | null {
  const result = state.result;
  if (!result) return null;
  const victory = result.winner === viewer;
  const turns = formatTurns(result.turn);
  const winner = result.winner === null ? '' : civName(state, result.winner);
  let reason: string;
  switch (result.reason) {
    case 'wonder':
      reason = victory ? en.endScreen.reasonWonderYou : en.endScreen.reasonWonderOther;
      break;
    case 'conquest':
      reason = victory ? en.endScreen.reasonConquestYou : en.endScreen.reasonConquestOther;
      break;
    case 'points':
      reason = victory ? en.endScreen.reasonPointsYou : en.endScreen.reasonPointsOther;
      break;
    case 'eliminated':
      reason = en.endScreen.reasonEliminated;
      break;
  }
  if (result.winner === null && result.reason !== 'eliminated') reason = en.endScreen.reasonUnknown;
  return {
    victory,
    title: victory ? en.endScreen.victory : en.endScreen.defeat,
    reason: fill(reason, { civ: winner, turns }),
  };
}
