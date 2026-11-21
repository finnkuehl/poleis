// Residents and worker assignment.

import { BUILDINGS, type BuildingCategory } from '../../data';
import type { GameState, PlayerId } from '../state';

/** Worker priority: food first, then raw materials, then processing. */
const CATEGORY_ORDER: readonly BuildingCategory[] = ['food', 'raw', 'processing'];

/** Residents of the player. Interim rule until M3: housing is filled immediately. */
export function population(state: GameState, player: PlayerId): number {
  return state.buildings
    .filter((b) => b.owner === player)
    .reduce((sum, b) => sum + BUILDINGS[b.type].housing, 0);
}

/**
 * Distributes residents as workers (building id -> assigned workers).
 * Only connected buildings that need workers get any. Order: category, then older first.
 */
export function assignWorkers(
  state: GameState,
  player: PlayerId,
  connected: ReadonlySet<number>,
): Record<number, number> {
  let remaining = population(state, player);
  const assigned: Record<number, number> = {};
  for (const category of CATEGORY_ORDER) {
    const group = state.buildings
      .filter(
        (b) =>
          b.owner === player &&
          connected.has(b.id) &&
          BUILDINGS[b.type].category === category &&
          BUILDINGS[b.type].workers > 0,
      )
      .sort((a, b) => a.id - b.id);
    for (const b of group) {
      const n = Math.min(BUILDINGS[b.type].workers, remaining);
      assigned[b.id] = n;
      remaining -= n;
    }
  }
  return assigned;
}
