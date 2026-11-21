// Marketplace trading (docs/GAME_DESIGN.md, section 6).

import type { PlayerId, GameState } from '../state';
import { previewProduction } from './production';

/** The player has at least one connected, unpaused, fully staffed marketplace. */
export function canTrade(state: GameState, player: PlayerId): boolean {
  const report = previewProduction(state, player);
  return state.buildings.some(
    (b) =>
      b.owner === player &&
      b.type === 'marketplace' &&
      report.buildings.some((r) => r.buildingId === b.id && r.status.kind === 'working'),
  );
}
