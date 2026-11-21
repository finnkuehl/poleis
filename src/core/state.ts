// GameState types (plain, JSON-serializable object).

import {
  BUILDINGS,
  economyConfig,
  GOOD_IDS,
  militaryConfig,
  populationConfig,
  TERRAIN,
  UNITS,
  type BuildingId,
  type CityLevel,
  type Stock,
  type TerrainId,
  type UnitId,
} from '../data';
import { distance, neighbors, type Hex } from './hex';
import { terrainAt, tileIndex } from './map';
import { generateMap, findLandmasses, findStartPositions } from './mapgen';
import { createCity } from './rules/found';
import { claimTerritory } from './rules/territory';
import { updateAllExplored } from './rules/vision';
import type { TurnReport } from './rules/production';
import { createRng, nextInt, seedFromText, type Rng } from './rng';

export interface MapState {
  width: number;
  height: number;
  /** Index = row * width + col (offset coordinates, odd-r). */
  tiles: TerrainId[];
}

export type PlayerId = number;

export interface PlayerState {
  id: PlayerId;
  isHuman: boolean;
  /** Shared stock of the civilization. */
  goods: Stock;
  /** Per tile index: has the player ever seen this tile (fog of war)? */
  explored: boolean[];
}

export interface Building {
  id: number;
  type: BuildingId;
  owner: PlayerId;
  hex: Hex;
  /** Paused buildings get no workers and produce nothing. */
  paused: boolean;
}

export interface City {
  /** Id of its city-center building. */
  id: number;
  owner: PlayerId;
  center: Hex;
  level: CityLevel;
  residents: number;
  /** Turns in a row the next level's supply good was supplied. */
  supplyStreak: number;
}

/** A multi-turn move order (docs/GAME_DESIGN.md §7, move orders). */
export interface MoveOrder {
  /** Destination tile. */
  to: Hex;
  /** Ids of enemy units already seen during this order; they do not stop it. */
  seenEnemies: number[];
}

export interface Unit {
  /** From the shared `nextId` counter. */
  id: number;
  type: UnitId;
  owner: PlayerId;
  hex: Hex;
  hp: number;
  /** Movement points left this turn (may be fractional, e.g. 0.5). */
  movesLeft: number;
  /** Moved this turn (for the "first step is always allowed" rule). */
  hasMoved: boolean;
  /** Moved or attacked this turn (acting units do not heal). */
  acted: boolean;
  /** Attacked this turn (one attack per turn). */
  attacked: boolean;
  /** Id of the enemy city whose center the unit stands on to capture it, else null. */
  capturing: number | null;
  /** Active multi-turn move order, or null. */
  order: MoveOrder | null;
}

/** A unit ordered in a barracks; it appears at the start of the owner's next turn. */
export interface TrainingOrder {
  barracksId: number;
  unit: UnitId;
  owner: PlayerId;
}

export interface GameState {
  version: 1;
  seedText: string;
  map: MapState;
  rng: Rng;
  /** Current turn, starts at 1. */
  turn: number;
  /** Whose turn it is (0 = the human player). */
  currentPlayer: PlayerId;
  players: PlayerState[];
  /** In build order (lower id = older). */
  buildings: Building[];
  /** Per tile index: is there a road? */
  roads: boolean[];
  /** Per tile index: owning PlayerId, -1 = nobody. */
  territory: number[];
  /** All cities, in creation order (id = id of the city center). */
  cities: City[];
  /** Per tile index: id of the city whose territory it is, -1 = none. */
  tileCity: number[];
  /** All units (ids come from `nextId`). */
  units: Unit[];
  /** Units ordered this turn, waiting to appear. */
  training: TrainingOrder[];
  /** Id of the next building or unit. */
  nextId: number;
  /** Result of the latest production (for the UI). */
  lastReport: TurnReport | null;
}

/** New game: seed text -> map; the RNG state is the one after generation. */
export function createGameState(seedText: string, options: { sandbox?: boolean } = {}): GameState {
  const { map, rng } = generateMap(seedFromText(seedText));
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = 0;
  for (const [id, amount] of Object.entries(
    options.sandbox ? economyConfig.sandboxGoods : economyConfig.startGoods,
  )) {
    goods[id as keyof Stock] = amount;
  }
  // Starting city: same RNG as the map generation, so everything depends on the seed only.
  const gameRng = createRng(rng.state);
  const start = findStartPositions(map, 1, gameRng)[0];
  const territory = map.tiles.map(() => -1);
  const state: GameState = {
    version: 1,
    seedText,
    map,
    rng: gameRng,
    turn: 1,
    currentPlayer: 0,
    players: [{ id: 0, isHuman: true, goods, explored: map.tiles.map(() => false) }],
    buildings: [{ id: 1, type: 'cityCenter', owner: 0, hex: start, paused: false }],
    roads: map.tiles.map(() => false),
    territory,
    cities: [
      {
        id: 1,
        owner: 0,
        center: start,
        level: 'settlement',
        residents: populationConfig.startResidents,
        supplyStreak: 0,
      },
    ],
    tileCity: map.tiles.map(() => -1),
    units: [],
    training: [],
    nextId: 2,
    lastReport: null,
  };
  claimTerritory(state, start, BUILDINGS.cityCenter.territoryRadius, 0, 1);
  if (options.sandbox) addPassiveEnemy(state, start);
  updateAllExplored(state);
  return state;
}

/**
 * Test mode: a passive civilization (player 1) with one city and two spearmen.
 * Picked with the seeded RNG after the human start, so the human's start stays unchanged.
 */
function addPassiveEnemy(state: GameState, humanCenter: Hex): void {
  const { min, max, preferred } = militaryConfig.sandboxEnemyDistance;
  const walkableNeighbor = (h: Hex) =>
    neighbors(h).find((n) => {
      const t = terrainAt(state.map, n);
      return t !== undefined && TERRAIN[t].moveCost !== null;
    });
  const mainland = (findLandmasses(state.map)[0] ?? []).filter(
    (h) =>
      terrainAt(state.map, h) === 'plains' &&
      state.territory[tileIndex(state.map, h)] === -1 &&
      walkableNeighbor(h) !== undefined,
  );
  let pool = mainland.filter((h) => {
    const d = distance(humanCenter, h);
    return d >= min && d <= max;
  });
  if (pool.length > 0) {
    // Closest to the preferred distance; the RNG breaks ties.
    const best = Math.min(...pool.map((h) => Math.abs(distance(humanCenter, h) - preferred)));
    pool = pool.filter((h) => Math.abs(distance(humanCenter, h) - preferred) === best);
  } else {
    // Fallback: the farthest valid plains tile.
    const far = Math.max(-1, ...mainland.map((h) => distance(humanCenter, h)));
    pool = mainland.filter((h) => distance(humanCenter, h) === far);
  }
  if (pool.length === 0) return;
  const center = pool[nextInt(state.rng, 0, pool.length - 1)];
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = 0;
  state.players.push({
    id: 1,
    isHuman: false,
    goods,
    explored: state.map.tiles.map(() => false),
  });
  createCity(state, 1, center, populationConfig.startResidents);
  const spearman = UNITS.spearman;
  const spots = [center, walkableNeighbor(center) as Hex];
  for (const hex of spots) {
    state.units.push({
      id: state.nextId++,
      type: 'spearman',
      owner: 1,
      hex,
      hp: spearman.hp,
      movesLeft: spearman.movement,
      hasMoved: false,
      acted: false,
      attacked: false,
      capturing: null,
      order: null,
    });
  }
}
