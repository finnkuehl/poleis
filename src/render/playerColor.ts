// The color of a player on the map: taken from the game state (the human picks it in the start menu).
import type { GameState } from '../core/state';
import { theme } from './theme';

/** Pixi color of `owner`. Falls back to the owner index if the player is missing from the state. */
export function playerColorOf(state: GameState, owner: number): number {
  const colors = theme.playerColors;
  const index = state.players.find((p) => p.id === owner)?.color ?? owner;
  return colors[((index % colors.length) + colors.length) % colors.length];
}
