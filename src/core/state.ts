// GameState types (plain, JSON-serializable object).

import { economyConfig, GOOD_IDS, type BuildingId, type Stock, type TerrainId } from '../data';
import type { Hex } from './hex';
import { generateMap } from './mapgen';
import type { TurnReport } from './rules/production';
import { createRng, seedFromText, type Rng } from './rng';

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
}

export interface Building {
  id: number;
  type: BuildingId;
  owner: PlayerId;
  hex: Hex;
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
  /** Id of the next building. */
  nextId: number;
  /** Result of the latest production (for the UI). */
  lastReport: TurnReport | null;
}

/** New game: seed text -> map; the RNG state is the one after generation. */
export function createGameState(seedText: string): GameState {
  const { map, rng } = generateMap(seedFromText(seedText));
  const goods = {} as Stock;
  for (const id of GOOD_IDS) goods[id] = 0;
  for (const [id, amount] of Object.entries(economyConfig.startGoods)) {
    goods[id as keyof Stock] = amount;
  }
  return {
    version: 1,
    seedText,
    map,
    rng: createRng(rng.state),
    turn: 1,
    currentPlayer: 0,
    players: [{ id: 0, isHuman: true, goods }],
    buildings: [],
    roads: map.tiles.map(() => false),
    territory: map.tiles.map(() => -1),
    nextId: 1,
    lastReport: null,
  };
}
