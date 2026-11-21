// Pure geometry helpers for the economy layers (no PixiJS, easy to test).
import { HEX_DIRECTIONS, hexAdd, hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { GameState, PlayerId } from '../core/state';

/**
 * Edge i of a tile connects corner i and corner i+1 (see `hexCorners`).
 * Corners sit at angles -30, 30, 90, 150, 210, 270 degrees (screen y points down), so the
 * edges face E, SE, SW, W, NW, NE. Value = index into HEX_DIRECTIONS (E, NE, NW, W, SW, SE).
 */
export const EDGE_DIRECTION: readonly number[] = [0, 5, 4, 3, 2, 1];

/** Neighbor tile index across edge `edge`, or -1 if it is outside the map. */
export function edgeNeighborIndex(state: GameState, h: Hex, edge: number): number {
  return tileIndex(state.map, hexAdd(h, HEX_DIRECTIONS[EDGE_DIRECTION[edge]]));
}

/** Midpoint of an edge (for tests and debugging). */
export function edgeMidpoint(center: Point, size: number, edge: number): Point {
  const corners = hexCorners(center, size);
  const a = corners[edge];
  const b = corners[(edge + 1) % 6];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export interface TileEdges {
  /** Tile index */
  tile: number;
  /** Edge indices (0-5) that border a different owner or the map edge */
  edges: number[];
}

/** Border edges of the territory of `player`: all edges whose neighbor has a different owner. */
export function territoryEdges(state: GameState, player: PlayerId): TileEdges[] {
  const result: TileEdges[] = [];
  for (let i = 0; i < state.territory.length; i++) {
    if (state.territory[i] !== player) continue;
    const h = hexAtIndex(state.map, i);
    const edges: number[] = [];
    for (let e = 0; e < 6; e++) {
      const n = edgeNeighborIndex(state, h, e);
      if (n < 0 || state.territory[n] !== player) edges.push(e);
    }
    if (edges.length > 0) result.push({ tile: i, edges });
  }
  return result;
}

export interface RoadGeometry {
  /** Pairs of tile indices (a < b is not guaranteed for road-building pairs), each pair once */
  segments: [number, number][];
  /** Road tiles without any segment (drawn as a dot) */
  stubs: number[];
}

/**
 * Road network to draw: from each road tile to neighbors that have a road or a building of the
 * same owner (the owner of a road tile = owner of the territory it lies in).
 */
export function roadGeometry(state: GameState): RoadGeometry {
  const buildingOwner = new Map<number, PlayerId>();
  for (const b of state.buildings) {
    const i = tileIndex(state.map, b.hex);
    if (i >= 0) buildingOwner.set(i, b.owner);
  }
  const segments: [number, number][] = [];
  const stubs: number[] = [];
  for (let i = 0; i < state.roads.length; i++) {
    if (!state.roads[i]) continue;
    const h = hexAtIndex(state.map, i);
    const owner = state.territory[i];
    let connected = false;
    for (let e = 0; e < 6; e++) {
      const n = edgeNeighborIndex(state, h, e);
      if (n < 0) continue;
      const nextRoad = state.roads[n];
      const nextBuilding = owner >= 0 && buildingOwner.get(n) === owner;
      if (!nextRoad && !nextBuilding) continue;
      connected = true;
      // Road-road pairs only from the lower index; road-building pairs always from the road
      if (nextRoad && n < i) continue;
      segments.push([i, n]);
    }
    if (!connected) stubs.push(i);
  }
  return { segments, stubs };
}

/** Convenience: pixel center of a tile index. */
export function tileCenter(state: GameState, index: number, size: number): Point {
  return hexToPixel(hexAtIndex(state.map, index), size);
}

/**
 * Midpoint of the hex edge shared by two adjacent tiles. It lies halfway between both centers,
 * so order paths start next to the unit token instead of under it.
 */
export function sharedEdgeMidpoint(a: Hex, b: Hex, size: number): Point {
  const pa = hexToPixel(a, size);
  const pb = hexToPixel(b, size);
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
}
