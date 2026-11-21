// Pure helpers for fog of war and unit tokens (no PixiJS, easy to test).
import { theme } from './theme';

export type FogState = 'hidden' | 'dim' | 'clear';

/** Fog state of one tile: never seen -> hidden, seen before but not now -> dim, else clear. */
export function fogState(
  explored: readonly boolean[],
  visible: readonly boolean[],
  index: number,
): FogState {
  if (visible[index]) return 'clear';
  return explored[index] ? 'dim' : 'hidden';
}

/** Cheap signature of the whole fog (one char per tile) to detect when a redraw is needed. */
export function fogSignature(explored: readonly boolean[], visible: readonly boolean[]): string {
  let s = '';
  for (let i = 0; i < visible.length; i++) {
    const f = fogState(explored, visible, i);
    s += f === 'clear' ? 'c' : f === 'dim' ? 'd' : 'h';
  }
  return s;
}

/** HP bar color by HP share (0..1): green -> ochre -> red. */
export function hpBarColor(share: number): number {
  if (share > 0.6) return theme.hpBarGoodColor;
  if (share > 0.3) return theme.hpBarMidColor;
  return theme.hpBarLowColor;
}

/** Vertical offset of a unit token (negative = up): up when a building shares the tile. */
export function unitTokenOffset(hasBuilding: boolean, hexSize: number): number {
  return hasBuilding ? -hexSize * theme.unitOnBuildingOffsetFactor : 0;
}
