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

// ---------------------------------------------------------------------------------------------
// Road tracks: worn dirt tracks that bend smoothly through the tiles (docs/ART.md "Roads")
// ---------------------------------------------------------------------------------------------

/** Deterministic hash in [0, 1) of two ints and a salt (a local copy: terrain.ts imports this file). */
function roadHash(a: number, b: number, salt: number): number {
  let h =
    Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Look of a piece of road: earth track, or light stone paving next to a city center. */
export type TrackStyle = 'dirt' | 'paved';

/** One piece of track inside one tile: a sampled center line with a width at every point. */
export interface TrackPiece {
  tile: number;
  style: TrackStyle;
  points: Point[];
  /** Full width (world px) at every point; it runs to 0 where a dead end fades out. */
  widths: number[];
  /** Part of a junction: its ruts fade out toward its middle (the worn crossing). */
  junction?: boolean;
  /** Runs into a building's yard: its ruts fade out toward its end. */
  yard?: boolean;
}

/** A worn spot where tracks meet (junction) or a lone road tile. */
export interface TrackCrossing {
  tile: number;
  style: TrackStyle;
  center: Point;
  r: number;
}

export interface RoadTracks {
  pieces: TrackPiece[];
  crossings: TrackCrossing[];
}

/** Sizes of the tracks (fractions of the hex size unless noted). */
export interface TrackParams {
  /** Average track width */
  width: number;
  /** Width varies by up to this share between edges and tiles */
  widthVar: number;
  /** The track crosses an edge up to this far beside its midpoint, and a tile up to this far beside its center */
  edgeJitter: number;
  centerJitter: number;
  /** A track onto a building tile ends this share of the way from its midpoint to the center (the yard) */
  buildingEnd: number;
  /** ... onto a city center: at the plaza's edge */
  plazaEnd: number;
  /** Samples per half piece (edge to center) */
  samples: number;
}

/** Cubic Hermite curve from p0 to p1 with tangents t0, t1 (n samples after p0, p0 included). */
function hermite(p0: Point, p1: Point, t0: Point, t1: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    pts.push({
      x: h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
      y: h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
    });
  }
  return pts;
}

function scaled(v: Point, k: number): Point {
  return { x: v.x * k, y: v.y * k };
}

function unit(v: Point): Point {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/** Tiles paved like the city: every city center tile and its direct neighbors. */
export function pavedTiles(state: GameState): Set<number> {
  const out = new Set<number>();
  for (const b of state.buildings) {
    if (b.type !== 'cityCenter') continue;
    const i = tileIndex(state.map, b.hex);
    if (i < 0) continue;
    out.add(i);
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(state.map, b.hex, e);
      if (n >= 0) out.add(n);
    }
  }
  return out;
}

/**
 * A smooth curve from one road edge through the point `c` (near the tile center) to another:
 * it crosses each edge at right angles and passes `c` heading from the first edge to the second.
 */
function throughCenter(
  a: { mid: Point; inward: Point },
  b: { mid: Point; inward: Point },
  c: Point,
  n: number,
): Point[] {
  const la = Math.hypot(c.x - a.mid.x, c.y - a.mid.y);
  const lb = Math.hypot(c.x - b.mid.x, c.y - b.mid.y);
  const through = scaled({ x: b.mid.x - a.mid.x, y: b.mid.y - a.mid.y }, 0.5);
  const first = hermite(a.mid, c, scaled(a.inward, la), through, n);
  const second = hermite(c, b.mid, through, scaled(b.inward, -lb), n).slice(1);
  return [...first, ...second];
}

/**
 * The road network as smooth tracks (world px), from `roadGeometry`:
 * - every connection crosses its shared edge at one point (near the edge midpoint, a little
 *   beside it, the same from both tiles) at right angles to the edge, with one width there, so
 *   the tracks of neighboring tiles run on without a kink;
 * - a tile with two road edges: one curve through (near) its center;
 * - a dead end: the track fades out toward the center;
 * - a junction: curves between neighboring arms (they cut the corners like worn paths) and a
 *   worn crossing spot in the middle, so no star of straight lines;
 * - onto a building tile: the track ends softly in its yard (at the plaza's edge for a city center);
 * - a lone road tile: only a worn spot.
 * On city center tiles and their neighbors the pieces are paved.
 */
export function roadTracks(state: GameState, size: number, params: TrackParams): RoadTracks {
  const map = state.map;
  const { segments, stubs } = roadGeometry(state);
  const paved = pavedTiles(state);
  const styleOf = (i: number): TrackStyle => (paved.has(i) ? 'paved' : 'dirt');
  const center = (i: number): Point => hexToPixel(hexAtIndex(map, i), size);
  const w0 = params.width * size;
  interface Arm {
    edge: number;
    mid: Point;
    /** Inward direction (from the edge toward this tile's center). */
    inward: Point;
    width: number;
  }
  const arms = new Map<number, Arm[]>();
  const addArm = (tile: number, arm: Arm): void => {
    const list = arms.get(tile);
    if (list) list.push(arm);
    else arms.set(tile, [arm]);
  };
  for (const [a, b] of segments) {
    const ca = center(a);
    const cb = center(b);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    // Seen from the lower index, so both tiles get the same point and width
    const along = unit({ x: -(center(hi).y - center(lo).y), y: center(hi).x - center(lo).x });
    const shift = (roadHash(lo, hi, 301) - 0.5) * 2 * params.edgeJitter * size;
    const mid = {
      x: (ca.x + cb.x) / 2 + along.x * shift,
      y: (ca.y + cb.y) / 2 + along.y * shift,
    };
    const width = w0 * (1 + (roadHash(lo, hi, 302) - 0.5) * 2 * params.widthVar);
    const ha = hexAtIndex(map, a);
    let edge = 0;
    for (let e = 0; e < 6; e++) if (mapEdgeNeighborIndex(map, ha, e) === b) edge = e;
    addArm(a, { edge, mid, inward: unit({ x: ca.x - cb.x, y: ca.y - cb.y }), width });
    addArm(b, {
      edge: (edge + 3) % 6,
      mid,
      inward: unit({ x: cb.x - ca.x, y: cb.y - ca.y }),
      width,
    });
  }
  const pieces: TrackPiece[] = [];
  const crossings: TrackCrossing[] = [];
  const n = params.samples;
  for (const [tile, list] of arms) {
    list.sort((u, v) => u.edge - v.edge);
    const c0 = center(tile);
    const style = styleOf(tile);
    const h = hexAtIndex(map, tile);
    const wobble = (k: number): number =>
      1 + 0.5 * params.widthVar * Math.sin(k * 1.7 + roadHash(h.q, h.r, 305) * 6.28);
    if (!state.roads[tile]) {
      // Onto a building tile: the track runs into the yard and ends softly there
      const plaza = state.buildings.some(
        (b) => b.type === 'cityCenter' && tileIndex(map, b.hex) === tile,
      );
      const k = plaza ? params.plazaEnd : params.buildingEnd;
      for (const arm of list) {
        const end = {
          x: arm.mid.x + (c0.x - arm.mid.x) * k,
          y: arm.mid.y + (c0.y - arm.mid.y) * k,
        };
        const len = Math.hypot(end.x - arm.mid.x, end.y - arm.mid.y);
        const points = hermite(arm.mid, end, scaled(arm.inward, len), scaled(arm.inward, len), n);
        // It spreads a little into the yard and ends in a worn spot there (no point)
        const widths = points.map((_, i) => arm.width * (plaza ? 1 : 1 + (0.25 * i) / n));
        pieces.push({ tile, style, points, widths, yard: !plaza });
        if (!plaza) crossings.push({ tile, style, center: end, r: arm.width * 0.7 });
      }
      continue;
    }
    // A road tile: its track runs a little beside the exact center
    const jx = (roadHash(h.q, h.r, 303) - 0.5) * 2 * params.centerJitter * size;
    const jy = (roadHash(h.q, h.r, 304) - 0.5) * 2 * params.centerJitter * size;
    const c = { x: c0.x + jx, y: c0.y + jy };
    const wc = w0 * (1 + (roadHash(h.q, h.r, 306) - 0.5) * 2 * params.widthVar);
    if (list.length === 1) {
      // Dead end: the track fades out at the center
      const arm = list[0];
      const len = Math.hypot(c.x - arm.mid.x, c.y - arm.mid.y);
      const points = hermite(arm.mid, c, scaled(arm.inward, len), scaled(arm.inward, len), n);
      // ... narrowing and ending in a small worn spot, not in a point
      const widths = points.map((_, i) => arm.width * (1 - 0.55 * (i / n) ** 1.5));
      pieces.push({ tile, style, points, widths });
      crossings.push({ tile, style, center: c, r: arm.width * 0.42 });
      continue;
    }
    if (list.length === 2) {
      // One smooth curve through the center
      const [a, b] = list;
      const points = throughCenter(a, b, c, n);
      const widths = points.map((_, i) => {
        const t = i / (points.length - 1);
        const edge =
          t < 0.5 ? a.width + (wc - a.width) * t * 2 : wc + (b.width - wc) * (t - 0.5) * 2;
        return edge * (i === 0 || i === points.length - 1 ? 1 : wobble(i));
      });
      pieces.push({ tile, style, points, widths });
      continue;
    }
    // Junction: smooth curves between neighboring arms through (near) the center, so they run
    // in like the tracks of a two-way tile and merge in a worn crossing in the middle
    for (let k = 0; k < list.length; k++) {
      const a = list[k];
      const b = list[(k + 1) % list.length];
      const points = throughCenter(a, b, c, n);
      const widths = points.map((_, i) => {
        const t = i / (points.length - 1);
        return (
          (a.width + (b.width - a.width) * t) * (i === 0 || i === points.length - 1 ? 1 : wobble(i))
        );
      });
      pieces.push({ tile, style, points, widths, junction: true });
    }
    crossings.push({ tile, style, center: c, r: wc * 1.25 });
  }
  for (const s of stubs) {
    crossings.push({ tile: s, style: styleOf(s), center: center(s), r: w0 * 0.7 });
  }
  return { pieces, crossings };
}

/**
 * A smooth preview line for a planned road along `path` (tile centers and the shared edge
 * midpoints between them, Catmull-Rom), world px.
 */
export function previewTrack(path: readonly Hex[], size: number, samples = 6): Point[] {
  const ctrl: Point[] = [];
  path.forEach((h, i) => {
    const c = hexToPixel(h, size);
    if (i > 0) {
      const p = hexToPixel(path[i - 1], size);
      ctrl.push({ x: (p.x + c.x) / 2, y: (p.y + c.y) / 2 });
    }
    ctrl.push(c);
  });
  if (ctrl.length < 3) return ctrl;
  const pts: Point[] = [ctrl[0]];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const t0 = scaled({ x: p2.x - p0.x, y: p2.y - p0.y }, 0.5);
    const t1 = scaled({ x: p3.x - p1.x, y: p3.y - p1.y }, 0.5);
    pts.push(...hermite(p1, p2, t0, t1, samples).slice(1));
  }
  return pts;
}

/**
 * Polygon [x0, y0, ...] of a band along a track's center line: `share` of the track's width at
 * every point, its middle shifted sideways by `offset` x the width (a wheel rut). Ends where the
 * width runs to 0 come to a point.
 */
export function trackRibbon(
  points: readonly Point[],
  widths: readonly number[],
  share: number,
  offset = 0,
): number[] {
  const n = points.length;
  if (n < 2) return [];
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const d = unit({ x: next.x - prev.x, y: next.y - prev.y });
    const nx = -d.y;
    const ny = d.x;
    const w = widths[i];
    const mx = points[i].x + nx * offset * w;
    const my = points[i].y + ny * offset * w;
    const half = (w * share) / 2;
    left.push(mx + nx * half, my + ny * half);
    right.unshift(mx - nx * half, my - ny * half);
  }
  // right holds the other side back to front (unshift keeps each [x, y] pair in order)
  return [...left, ...right];
}

/** Point and width every `step` px along a track's center line (stones, joints). */
export function alongTrack(
  points: readonly Point[],
  widths: readonly number[],
  step: number,
): { p: Point; dir: Point; w: number }[] {
  const out: { p: Point; dir: Point; w: number }[] = [];
  let carry = step / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let t = carry;
    while (t <= len) {
      const k = t / len;
      out.push({
        p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
        dir,
        w: widths[i - 1] + (widths[i] - widths[i - 1]) * k,
      });
      t += step;
    }
    carry = t - len;
  }
  return out;
}

/** Cheap key of the road network (same key -> no repaint of the tracks). */
export function roadSignature(state: GameState): string {
  const { segments, stubs } = roadGeometry(state);
  const paved = [...pavedTiles(state)].sort((a, b) => a - b);
  return `${segments.map(([a, b]) => `${a}-${b}`).join(',')}|${stubs.join(',')}|${paved.join(',')}`;
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
