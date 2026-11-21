// Residents and worker assignment.

import { BUILDINGS, wonderConfig, type BuildingCategory } from '../../data';
import { tileIndex } from '../map';
import type { Building, GameState, PlayerId } from '../state';

/** Worker priority: food first, then raw materials, processing, and city buildings last. */
const CATEGORY_ORDER: readonly BuildingCategory[] = ['food', 'raw', 'processing', 'city'];

/** True for a world wonder that has all its working turns done. */
export function isWonderComplete(building: Building): boolean {
  return building.type === 'wonder' && (building.progress ?? 0) >= wonderConfig.buildTurns;
}

/** Workers a building needs: 0 for a completed wonder, else the building's own number. */
export function workersNeeded(building: Building): number {
  return isWonderComplete(building) ? 0 : BUILDINGS[building.type].workers;
}

/** Id of the city whose territory the building stands in; -1 = none. */
export function cityIdOf(state: GameState, building: Building): number {
  const i = tileIndex(state.map, building.hex);
  return i < 0 ? -1 : state.tileCity[i];
}

/** Housing of a city: sum of the housing of its buildings (city center and houses). */
export function housing(state: GameState, cityId: number): number {
  return state.buildings
    .filter((b) => cityIdOf(state, b) === cityId)
    .reduce((sum, b) => sum + BUILDINGS[b.type].housing, 0);
}

/** Residents of the player: the sum over all of the player's cities. */
export function population(state: GameState, player: PlayerId): number {
  return state.cities.filter((c) => c.owner === player).reduce((sum, c) => sum + c.residents, 0);
}

/**
 * Distributes residents as workers (building id -> assigned workers), city by city:
 * the residents of a city staff the buildings in that city's territory.
 * Only connected, unpaused buildings that need workers get any. Order: category, then older
 * first. Crews are all-or-nothing: a building gets its full crew only if enough residents
 * remain, otherwise it gets 0 and the next building (maybe with a smaller crew) is tried.
 */
export function assignWorkers(
  state: GameState,
  player: PlayerId,
  connected: ReadonlySet<number>,
): Record<number, number> {
  const assigned: Record<number, number> = {};
  for (const city of state.cities.filter((c) => c.owner === player)) {
    let remaining = city.residents;
    for (const category of CATEGORY_ORDER) {
      const group = state.buildings
        .filter(
          (b) =>
            b.owner === player &&
            !b.paused &&
            connected.has(b.id) &&
            cityIdOf(state, b) === city.id &&
            BUILDINGS[b.type].category === category &&
            workersNeeded(b) > 0,
        )
        .sort((a, b) => a.id - b.id);
      for (const b of group) {
        const needed = workersNeeded(b);
        const n = remaining >= needed ? needed : 0;
        assigned[b.id] = n;
        remaining -= n;
      }
    }
  }
  return assigned;
}
