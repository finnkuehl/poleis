// Player colors for the HTML UI (the map uses the same numbers via render/theme.ts).
import { theme } from '../render/theme';
import { en } from '../i18n/en';

/** Number of selectable colors. */
export const PLAYER_COLOR_COUNT = theme.playerColors.length;

/** CSS color ("#6e3a8e") of a player color index; wraps around for unknown indexes. */
export function playerCssColor(index: number): string {
  const colors = theme.playerColors;
  const n = colors[((index % colors.length) + colors.length) % colors.length];
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Display name of a player color index ("Tyrian purple"). */
export function playerColorName(index: number): string {
  const names = en.colors;
  return names[((index % names.length) + names.length) % names.length];
}
