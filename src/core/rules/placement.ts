// Placement rules for buildings.

import {
  BUILDINGS,
  CITY_LEVELS,
  CITY_LEVEL_DEFS,
  wonderConfig,
  type BuildingId,
  type TerrainId,
} from '../../data';
import { hexEquals, neighbors, type Hex } from '../hex';
import { allHexes, inBounds, tileIndex, terrainAt } from '../map';
import type { GameState, PlayerId } from '../state';
import type { RuleError } from './errors';
import { canAfford, missingGoods } from './goods';
import { ownerAt } from './territory';

export interface PlacementOptions {
  /** Skip the cost check (e.g. for the city center at game start or for previews). */
  ignoreCost?: boolean;
}

function hasNeighborTerrain(state: GameState, h: Hex, terrains: readonly TerrainId[]): boolean {
  return neighbors(h).some((n) => {
    const t = terrainAt(state.map, n);
    return t !== undefined && terrains.includes(t);
  });
}

/** Watchtowers the player has in one city, and the most that city may have at its level. */
export function towerUsage(
  state: GameState,
  player: PlayerId,
  cityId: number,
): { used: number; max: number } {
  const city = state.cities.find((c) => c.id === cityId);
  const used = state.buildings.filter(
    (b) =>
      b.type === 'borderTower' &&
      b.owner === player &&
      state.tileCity[tileIndex(state.map, b.hex)] === cityId,
  ).length;
  return { used, max: city ? CITY_LEVEL_DEFS[city.level].maxTowers : 0 };
}

/** Watchtowers over all cities of the player: total used, total limit, and whether any city has room. */
export function towerTotals(
  state: GameState,
  player: PlayerId,
): { used: number; max: number; hasRoom: boolean } {
  let used = 0;
  let max = 0;
  let hasRoom = false;
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const u = towerUsage(state, player, c.id);
    used += u.used;
    max += u.max;
    if (u.used < u.max) hasRoom = true;
  }
  return { used, max, hasRoom };
}

/** null = the building may be placed here, otherwise the first rule that is violated. */
export function checkPlacement(
  state: GameState,
  player: PlayerId,
  type: BuildingId,
  h: Hex,
  opts: PlacementOptions = {},
): RuleError | null {
  const def = BUILDINGS[type];
  if (!inBounds(state.map, h)) return { code: 'outOfBounds' };
  if (!def.playerCanBuild) return { code: 'cannotBuildType' };
  if (ownerAt(state, h) !== player) return { code: 'notOwnTerritory' };
  // The tile's city must have reached the building's level.
  const city = state.cities.find((c) => c.id === state.tileCity[tileIndex(state.map, h)]);
  // (A tile without a city counts as the lowest level.)
  const level = city?.level ?? CITY_LEVELS[0];
  if (CITY_LEVELS.indexOf(level) < CITY_LEVELS.indexOf(def.minLevel)) {
    return { code: 'levelTooLow', level: def.minLevel };
  }
  if (
    type === 'wonder' &&
    state.buildings.filter((b) => b.type === 'wonder' && b.owner === player).length >=
      wonderConfig.maxPerCivilization
  ) {
    return { code: 'wonderLimit' };
  }
  if (state.buildings.some((b) => hexEquals(b.hex, h)) || state.roads[tileIndex(state.map, h)]) {
    return { code: 'tileOccupied' };
  }

  const terrain = terrainAt(state.map, h) as TerrainId;
  const fits = def.placement.some(
    (o) => o.on.includes(terrain) && (!o.nextTo || hasNeighborTerrain(state, h, o.nextTo)),
  );
  if (!fits) {
    const partial = def.placement.find((o) => o.on.includes(terrain) && o.nextTo);
    if (partial?.nextTo) return { code: 'needsNeighbor', terrains: partial.nextTo };
    const allowed: TerrainId[] = [];
    for (const o of def.placement) for (const t of o.on) if (!allowed.includes(t)) allowed.push(t);
    return { code: 'wrongTerrain', terrains: allowed };
  }

  // A city captured with more towers than its limit keeps them but cannot build new ones.
  if (type === 'borderTower' && city) {
    const { used, max } = towerUsage(state, player, city.id);
    if (used >= max) return { code: 'towerLimit', max };
  }
  if (!opts.ignoreCost) {
    const stock = state.players.find((p) => p.id === player)?.goods;
    if (stock && !canAfford(stock, def.cost)) {
      return { code: 'notAffordable', missing: missingGoods(stock, def.cost) };
    }
  }
  return null;
}

/** All tiles where `checkPlacement` returns null. */
export function validPlacements(
  state: GameState,
  player: PlayerId,
  type: BuildingId,
  opts: PlacementOptions = {},
): Hex[] {
  return allHexes(state.map).filter((h) => checkPlacement(state, player, type, h, opts) === null);
}
