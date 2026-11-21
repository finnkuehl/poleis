// GameState-Typen (reines, JSON-serialisierbares Objekt).

import type { TerrainId } from '../data/terrain';
import { generateMap } from './mapgen';
import { createRng, seedFromText, type Rng } from './rng';

export interface MapState {
  width: number;
  height: number;
  /** Index = row * width + col (Offset-Koordinaten, odd-r). */
  tiles: TerrainId[];
}

export interface GameState {
  version: 1;
  seedText: string;
  map: MapState;
  rng: Rng;
}

/** Neues Spiel: Seed-Text → Karte; der RNG-Zustand ist der nach der Generierung. */
export function createGameState(seedText: string): GameState {
  const { map, rng } = generateMap(seedFromText(seedText));
  return { version: 1, seedText, map, rng: createRng(rng.state) };
}
