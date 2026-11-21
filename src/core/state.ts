// GameState types (plain, JSON-serializable object).

import type { TerrainId } from '../data/terrain';
import { generateMap } from './mapgen';
import { createRng, seedFromText, type Rng } from './rng';

export interface MapState {
  width: number;
  height: number;
  /** Index = row * width + col (offset coordinates, odd-r). */
  tiles: TerrainId[];
}

export interface GameState {
  version: 1;
  seedText: string;
  map: MapState;
  rng: Rng;
}

/** New game: seed text -> map; the RNG state is the one after generation. */
export function createGameState(seedText: string): GameState {
  const { map, rng } = generateMap(seedFromText(seedText));
  return { version: 1, seedText, map, rng: createRng(rng.state) };
}
