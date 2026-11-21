// Settlers founding new cities (docs/GAME_DESIGN.md, section 7).

import { BUILDINGS, militaryConfig } from '../../data';
import { distance, hexEquals } from '../hex';
import { terrainAt, tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';
import type { RuleError } from './errors';
import { claimTerritory, ownerAt } from './territory';

/** null = the settler may found a city where it stands, otherwise the first violated rule. */
export function checkFoundCity(
  state: GameState,
  player: PlayerId,
  unitId: number,
): RuleError | null {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.owner !== player) return { code: 'notOwnUnit' };
  if (unit.type !== 'settler') return { code: 'notASettler' };
  if (terrainAt(state.map, unit.hex) !== 'plains') {
    return { code: 'wrongTerrain', terrains: ['plains'] };
  }
  if (state.buildings.some((b) => hexEquals(b.hex, unit.hex))) return { code: 'tileOccupied' };
  const owner = ownerAt(state, unit.hex);
  if (owner !== -1 && owner !== player) return { code: 'foreignTerritory' };
  const tooClose = state.cities.some(
    (c) => distance(c.center, unit.hex) < militaryConfig.foundMinDistance,
  );
  if (tooClose) return { code: 'tooCloseToCity' };
  return null;
}

/** Founds the city (the caller checked `checkFoundCity`); the settler is used up. Mutates. */
export function foundCity(state: GameState, unitId: number): number {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) throw new Error('foundCity: unknown unit');
  state.units = state.units.filter((u) => u.id !== unitId);
  return createCity(state, unit.owner, unit.hex, militaryConfig.newCityResidents);
}

/** Adds a city-center building + City and claims the free land around it. Returns the city id. */
export function createCity(
  state: GameState,
  owner: PlayerId,
  hex: { q: number; r: number },
  residents: number,
  radius = BUILDINGS.cityCenter.territoryRadius,
): number {
  const id = state.nextId++;
  state.buildings.push({ id, type: 'cityCenter', owner, hex, paused: false });
  state.cities.push({ id, owner, center: hex, level: 'settlement', residents, supplyStreak: 0 });
  // The center tile is always the city's, even if somebody's territory reached it.
  const i = tileIndex(state.map, hex);
  state.territory[i] = owner;
  state.tileCity[i] = id;
  claimTerritory(state, hex, radius, owner, id);
  return id;
}
