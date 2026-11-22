// Pure geometry helpers for the map layers (no PixiJS, easy to test).
import { HEX_DIRECTIONS, hexAdd, hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { GameState, MapState, PlayerId } from '../core/state';

/**
 * Edge i of a tile connects corner i and corner i+1 (see `hexCorners`).
 * Corners sit at angles -30, 30, 90, 150, 210, 270 degrees (screen y points down), so the
 * edges face E, SE, SW, W, NW, NE. Value = index into HEX_DIRECTIONS (E, NE, NW, W, SW, SE).
 */
export const EDGE_DIRECTION: readonly number[] = [0, 5, 4, 3, 2, 1];

/** Neighbor hex across edge `edge` (may lie outside the map). */
export function edgeNeighborHex(h: Hex, edge: number): Hex {
  return hexAdd(h, HEX_DIRECTIONS[EDGE_DIRECTION[edge]]);
}

/** Neighbor tile index across edge `edge`, or -1 if it is outside the map. */
export function mapEdgeNeighborIndex(map: MapState, h: Hex, edge: number): number {
  return tileIndex(map, edgeNeighborHex(h, edge));
}

/** Neighbor tile index across edge `edge`, or -1 if it is outside the map. */
export function edgeNeighborIndex(state: GameState, h: Hex, edge: number): number {
  return mapEdgeNeighborIndex(state.map, h, edge);
}

/** Point `dist` away from `a` in the direction of `b`. */
function toward(a: Point, b: Point, dist: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: a.x + (dx / len) * dist, y: a.y + (dy / len) * dist };
}

/** Distance from a corner (along the bisector or a neighboring edge) to sit `depth` inside an edge. */
const INSET_STEP = 1 / Math.sin(Math.PI / 3);

/**
 * Both endpoints of edge `edge`, moved `depth` into the tile (corners from `hexCorners`).
 * Where the neighboring edge is part of the same line (`prevIn` / `nextIn`) the point lies on
 * the corner bisector, so consecutive edges join. Otherwise it slides along that neighboring
 * edge: the neighbor tile's line ends at exactly the same point, so lines run on seamlessly
 * from tile to tile (beaches, borders, fog edges).
 */
export function insetEdge(
  center: Point,
  corners: readonly Point[],
  edge: number,
  depth: number,
  prevIn: boolean,
  nextIn: boolean,
): [Point, Point] {
  const s = depth * INSET_STEP;
  const a = corners[edge];
  const b = corners[(edge + 1) % 6];
  const start = toward(a, prevIn ? center : corners[(edge + 5) % 6], s);
  const end = toward(b, nextIn ? center : corners[(edge + 2) % 6], s);
  return [start, end];
}

/** Unit vector from the tile center through the middle of edge `edge` (edge e faces 60° * e). */
export function edgeOutward(edge: number): Point {
  const a = (Math.PI / 3) * edge;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * A line along edge `edge` (corner `edge` -> corner `edge + 1`), `depth` px inside the tile,
 * that follows a wavy edge: `offsets[i]` pushes the point at t = i / n outward (n =
 * offsets.length - 1; offsets[0] and offsets[n] should be 0 so the curve ends in the corners).
 * `follow` is the share of the wave the line follows (1 = parallel to the curve), `extra[i]` an
 * optional additional inward depth per point. The two ends are those of `insetEdge`, so lines of
 * neighboring edges and tiles join exactly as with straight edges. With depth 0, follow 1 and no
 * extra, this is the wavy edge itself.
 */
export function wavyInsetLine(
  center: Point,
  corners: readonly Point[],
  edge: number,
  offsets: readonly number[],
  depth: number,
  prevIn: boolean,
  nextIn: boolean,
  follow = 1,
  extra?: readonly number[],
): Point[] {
  const [s, e] = insetEdge(center, corners, edge, depth, prevIn, nextIn);
  const out = edgeOutward(edge);
  const n = offsets.length - 1;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = offsets[i] * follow - (extra ? extra[i] : 0);
    pts.push({ x: s.x + (e.x - s.x) * t + out.x * w, y: s.y + (e.y - s.y) * t + out.y * w });
  }
  return pts;
}

/**
 * Outline of a tile as points: straight edges where `waves[e]` is null, otherwise the wavy edge
 * (see `wavyInsetLine`). Each corner appears once; neighbors that use the same (reversed)
 * offsets for their shared edge fit together without gaps.
 */
export function wavyTileOutline(
  corners: readonly Point[],
  waves: readonly (readonly number[] | null)[],
): Point[] {
  const pts: Point[] = [];
  for (let e = 0; e < 6; e++) {
    const a = corners[e];
    const offsets = waves[e];
    pts.push(a);
    if (!offsets) continue;
    const b = corners[(e + 1) % 6];
    const out = edgeOutward(e);
    const n = offsets.length - 1;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const w = offsets[i];
      pts.push({ x: a.x + (b.x - a.x) * t + out.x * w, y: a.y + (b.y - a.y) * t + out.y * w });
    }
  }
  return pts;
}

/** Part of a polyline between t0 and t1 (0 = first point, 1 = last point, by point index). */
export function subPolyline(points: readonly Point[], t0: number, t1: number): Point[] {
  const n = points.length - 1;
  if (n < 1) return [...points];
  const at = (u: number): Point => {
    const f = Math.max(0, Math.min(n, u * n));
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const a = points[i];
    const b = points[i + 1];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const out: Point[] = [at(t0)];
  for (let i = Math.floor(t0 * n) + 1; i < t1 * n; i++) out.push(points[i]);
  out.push(at(t1));
  return out;
}

export interface InsetRun {
  /** Points of the line, `depth` inside the tile edges. */
  points: Point[];
  /** True when all 6 edges are set (the line is a closed ring). */
  closed: boolean;
}

/**
 * Lines `depth` inside the edges set in `mask` (6 booleans): consecutive edges are chained into
 * one line (wrapping around corner 0), so they can be stroked with clean joins.
 */
export function insetRuns(
  center: Point,
  corners: readonly Point[],
  mask: readonly boolean[],
  depth: number,
): InsetRun[] {
  if (mask.every(Boolean)) {
    const ring = [];
    for (let e = 0; e < 6; e++) ring.push(insetEdge(center, corners, e, depth, true, true)[0]);
    return [{ points: ring, closed: true }];
  }
  const runs: InsetRun[] = [];
  for (let e = 0; e < 6; e++) {
    // A run starts at a set edge whose previous edge is not set
    if (!mask[e] || mask[(e + 5) % 6]) continue;
    const points = [insetEdge(center, corners, e, depth, false, mask[(e + 1) % 6])[0]];
    let edge = e;
    for (;;) {
      const next = mask[(edge + 1) % 6];
      points.push(insetEdge(center, corners, edge, depth, true, next)[1]);
      if (!next) break;
      edge = (edge + 1) % 6;
    }
    runs.push({ points, closed: false });
  }
  return runs;
}

/**
 * Filled bands along the edges set in `mask`, from the edge `depth` into the tile: one
 * 4-point polygon [corner, corner, inset, inset] per edge. Neighboring bands only share
 * sides, so translucent fills do not overlap.
 */
export function insetBands(
  center: Point,
  corners: readonly Point[],
  mask: readonly boolean[],
  depth: number,
): Point[][] {
  return insetStrips(center, corners, mask, 0, depth);
}

/**
 * Like `insetBands`, but the band runs from `from` to `to` inside the edge (a strip parallel
 * to the edge, e.g. a foam or border line). Strips of neighboring tiles meet exactly.
 */
export function insetStrips(
  center: Point,
  corners: readonly Point[],
  mask: readonly boolean[],
  from: number,
  to: number,
): Point[][] {
  const strips: Point[][] = [];
  for (let e = 0; e < 6; e++) {
    if (!mask[e]) continue;
    const prev = mask[(e + 5) % 6];
    const next = mask[(e + 1) % 6];
    const [s0, e0] =
      from === 0
        ? [corners[e], corners[(e + 1) % 6]]
        : insetEdge(center, corners, e, from, prev, next);
    const [s1, e1] = insetEdge(center, corners, e, to, prev, next);
    strips.push([s0, e0, e1, s1]);
  }
  return strips;
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

/** 6 booleans (one per edge) from a list of edge indices. */
export function edgeMaskOf(edges: readonly number[]): boolean[] {
  const mask = [false, false, false, false, false, false];
  for (const e of edges) mask[e] = true;
  return mask;
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
