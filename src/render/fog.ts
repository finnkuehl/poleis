// Pure helpers for fog of war and unit tokens (no PixiJS, easy to test).
import type { Hex } from '../core/hex';
import { tileIndex } from '../core/map';
import type { Building, GameState, MapState, PlayerId } from '../core/state';
import { mapEdgeNeighborIndex } from './geometry';
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

/**
 * One boolean per edge: does the neighbor across it have fog state `target`? Used for the soft
 * feathered fog edge. Edges at the map border are false.
 */
export function fogEdgeMask(
  map: MapState,
  h: Hex,
  fog: readonly FogState[],
  target: FogState,
): boolean[] {
  const mask: boolean[] = [];
  for (let e = 0; e < 6; e++) {
    const n = mapEdgeNeighborIndex(map, h, e);
    mask.push(n >= 0 && fog[n] === target);
  }
  return mask;
}

/**
 * Smooth, cloud-like brightness of the unexplored fog at a world position, in [0, 1].
 * Neighboring tiles get similar values, so the fog shows soft patches instead of a checkerboard.
 */
export function fogShade(x: number, y: number): number {
  const v =
    Math.sin(x * 0.0061 + y * 0.0037) +
    Math.sin(x * -0.0029 + y * 0.0071 + 1.3) +
    0.5 * Math.sin(x * 0.0113 - y * 0.0089 + 2.1);
  return Math.max(0, Math.min(1, 0.5 + v / 5));
}

/**
 * The buildings `viewer` may see: those on tiles it has explored (enemy buildings it saw once stay
 * remembered) and its own. Buildings on unexplored tiles are left out entirely, because tall art,
 * rings and labels reach into the neighbor tiles, which the fog of the hidden tile does not cover.
 * `revealAll` (test option): every tile counts as explored.
 */
export function buildingsShownTo(
  state: GameState,
  viewer: PlayerId,
  revealAll: boolean,
): readonly Building[] {
  if (revealAll) return state.buildings;
  const explored = state.players.find((p) => p.id === viewer)?.explored ?? [];
  return state.buildings.filter(
    (b) => b.owner === viewer || explored[tileIndex(state.map, b.hex)] === true,
  );
}

/** HP bar color by HP share (0..1): green -> ochre -> red. */
export function hpBarColor(share: number): number {
  if (share > 0.6) return theme.hpBarGoodColor;
  if (share > 0.3) return theme.hpBarMidColor;
  return theme.hpBarLowColor;
}
