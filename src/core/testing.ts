// TEST-ONLY helpers. Do not import this file from game code.

import {
  BUILDINGS,
  GOOD_IDS,
  UNITS,
  populationConfig,
  type BuildingId,
  type CityLevel,
  type Goods,
  type Stock,
  type TerrainId,
  type UnitId,
} from '../data';
import { offsetToAxial, type Hex } from './hex';
import { tileIndex } from './map';
import { createRng } from './rng';
import { claimTerritory } from './rules/territory';
import type { GameState, PlayerId } from './state';

const CHARS: Record<string, TerrainId> = {
  p: 'plains',
  f: 'forest',
  h: 'hills',
  m: 'mountains',
  c: 'coast',
  o: 'ocean',
};

/** Hex at offset position (col, row) - handy in tests. */
export function at(col: number, row: number): Hex {
  return offsetToAxial({ col, row });
}

/**
 * Builds a GameState from ASCII rows (p plains, f forest, h hills, m mountains, c coast,
 * o ocean). One human player (id 0). `ownAll` (default true) gives all tiles to player 0.
 */
export function makeTestState(
  rows: string[],
  opts: { goods?: Goods; ownAll?: boolean } = {},
): GameState {
  const width = rows[0].length;
  const tiles = rows.flatMap((row) =>
    [...row].map((ch) => {
      const t = CHARS[ch];
      if (!t) throw new Error(`Unknown map character "${ch}"`);
      return t;
    }),
  );
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = opts.goods?.[id] ?? 0;
  return {
    version: 1,
    seedText: 'test',
    map: { width, height: rows.length, tiles },
    rng: createRng(1),
    turn: 1,
    currentPlayer: 0,
    players: [{ id: 0, isHuman: true, goods }],
    buildings: [],
    roads: tiles.map(() => false),
    territory: tiles.map(() => ((opts.ownAll ?? true) ? 0 : -1)),
    cities: [],
    tileCity: tiles.map(() => -1),
    units: [],
    training: [],
    nextId: 1,
    lastReport: null,
  };
}

/** Inserts a building without any checks; returns its id. */
export function addBuilding(state: GameState, type: BuildingId, h: Hex, owner = 0): number {
  const id = state.nextId++;
  state.buildings.push({ id, type, owner, hex: h, paused: false });
  return id;
}

/** Puts a road on the tile without any checks. */
export function addRoad(state: GameState, h: Hex): void {
  state.roads[tileIndex(state.map, h)] = true;
}

/**
 * Founds a city: city-center building + City + territory claim (radius 2 unless `radius`
 * is given). Returns the city id.
 */
export function addCity(
  state: GameState,
  h: Hex,
  opts: { residents?: number; level?: CityLevel; owner?: PlayerId; radius?: number } = {},
): number {
  const owner = opts.owner ?? 0;
  const id = addBuilding(state, 'cityCenter', h, owner);
  state.cities.push({
    id,
    owner,
    center: h,
    level: opts.level ?? 'settlement',
    residents: opts.residents ?? populationConfig.startResidents,
    supplyStreak: 0,
  });
  claimTerritory(state, h, opts.radius ?? BUILDINGS.cityCenter.territoryRadius, owner, id);
  return id;
}

/** Inserts a unit (full HP and moves unless given) without any checks; returns its id. */
export function addUnit(
  state: GameState,
  type: UnitId,
  h: Hex,
  opts: {
    owner?: PlayerId;
    hp?: number;
    movesLeft?: number;
    hasMoved?: boolean;
    acted?: boolean;
    attacked?: boolean;
  } = {},
): number {
  const id = state.nextId++;
  const def = UNITS[type];
  state.units.push({
    id,
    type,
    owner: opts.owner ?? 0,
    hex: h,
    hp: opts.hp ?? def.hp,
    movesLeft: opts.movesLeft ?? def.movement,
    hasMoved: opts.hasMoved ?? false,
    acted: opts.acted ?? false,
    attacked: opts.attacked ?? false,
    capturing: null,
  });
  return id;
}
