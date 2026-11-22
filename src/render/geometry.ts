// Pure geometry helpers for the map layers (no PixiJS, easy to test).
import { HEX_DIRECTIONS, hexAdd, hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { Building, GameState, MapState, PlayerId } from '../core/state';

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

/**
 * `roadGeometry` as the viewer sees it: road-building pairs only to the buildings in `shown`
 * (a road never bends toward a building on a tile the viewer has not explored); a road tile left
 * without any pair becomes a lone road tile. The terrain keeps using `roadGeometry` itself.
 */
export function shownRoadGeometry(
  state: GameState,
  shown: readonly Building[] = state.buildings,
): RoadGeometry {
  const all = roadGeometry(state);
  if (shown === state.buildings) return all;
  const shownTiles = new Set(shown.map((b) => tileIndex(state.map, b.hex)));
  // Road-road pairs stay; a road-building pair (road first) only to a building in `shown`
  const segments = all.segments.filter(([, b]) => state.roads[b] || shownTiles.has(b));
  const linked = new Set(segments.flat());
  const stubs = new Set(all.stubs);
  for (const [a] of all.segments) if (!linked.has(a)) stubs.add(a);
  return { segments, stubs: [...stubs].sort((x, y) => x - y) };
}

// ---------------------------------------------------------------------------------------------
// Road tracks: gravel roads that bend smoothly through the tiles (docs/ART.md "Roads")
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

function smooth01(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Look of a piece of road: a gravel track, or light stone paving on and next to a city center. */
export type TrackStyle = 'dirt' | 'paved';

/**
 * What a piece of road does in its tile:
 * - 'through': from one road edge through (near) the center to another;
 * - 'junction': a curve between two neighboring arms of a junction (dirt) or a spoke from an arm
 *   to the center (paving), under the crossing's worn spot / paved square;
 * - 'deadEnd': from the edge to the center, fading out;
 * - 'yard': into a building's yard, fading out there;
 * - 'plaza': onto a city center, ending cleanly at its plaza.
 */
export type TrackKind = 'through' | 'junction' | 'deadEnd' | 'yard' | 'plaza';

/** One piece of road inside one tile: a sampled center line with its look at every point. */
export interface TrackPiece {
  tile: number;
  style: TrackStyle;
  kind: TrackKind;
  points: Point[];
  /** Unit direction of the road at every point; exact at the ends, so neighboring pieces join. */
  dirs: Point[];
  /** Full width of the surface (world px) at every point. */
  widths: number[];
  /**
   * Distance along the road (world px) at every point. It runs on across the joints of a chain of
   * pieces, so textures laid along the road continue from tile to tile without a seam.
   */
  along: number[];
  /** Opacity of the surface, 0..1 (fades out at dead ends and in yards). */
  fade: number[];
  /** Strength of the wheel ruts, 0..1 (they fade in junctions, yards, toward paving). */
  ruts: number[];
  /** Strength of the cut banks on hills, 0..1 (0 off the hills, growing in from other terrain). */
  banks: number[];
  /** Paving: a row of edge stones across its start / end (where it meets a gravel track). */
  curbs: [boolean, boolean];
}

/** A worn spot (gravel) or a small paved square where roads meet, end, or a lone road tile. */
export interface TrackCrossing {
  tile: number;
  style: TrackStyle;
  kind: 'junction' | 'deadEnd' | 'lone';
  center: Point;
  r: number;
}

export interface RoadTracks {
  pieces: TrackPiece[];
  crossings: TrackCrossing[];
}

/** Sizes of the tracks (fractions of the hex size unless noted). */
export interface TrackParams {
  /** Width of the gravel track */
  width: number;
  /** Paving width as a share of the gravel track's width */
  pavingWidth: number;
  /** The track crosses an edge up to this far beside its midpoint, and a tile up to this far beside its center */
  edgeJitter: number;
  centerJitter: number;
  /** A track onto a building tile ends this share of the way from its midpoint to the center (the yard) */
  buildingEnd: number;
  /** ... onto a city center: at this ellipse around the center (the plaza) */
  plazaRx: number;
  plazaRy: number;
  /** Samples per half piece (edge to center) */
  samples: number;
  /** Banks grow in from a non-hill edge over this share of the way to the center */
  bankRamp: number;
  /** Radii of crossings: junction, dead end, lone tile (shares of the track width) */
  junctionRadius: number;
  deadEndRadius: number;
  loneRadius: number;
  /** Radius of a paved square (share of the paving width) */
  squareRadius: number;
}

/** A sampled curve: points and unit directions. */
interface Curve {
  points: Point[];
  dirs: Point[];
}

/** Cubic Hermite curve from p0 to p1 with tangents t0, t1: n + 1 points (p0 included) and directions. */
function hermiteCurve(p0: Point, p1: Point, t0: Point, t1: Point, n: number): Curve {
  const points: Point[] = [];
  const dirs: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    points.push({
      x: h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
      y: h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
    });
    // Derivative of the basis: the curve's direction
    const d00 = 6 * t2 - 6 * t;
    const d10 = 3 * t2 - 4 * t + 1;
    const d01 = -6 * t2 + 6 * t;
    const d11 = 3 * t2 - 2 * t;
    dirs.push(
      unit({
        x: d00 * p0.x + d10 * t0.x + d01 * p1.x + d11 * t1.x,
        y: d00 * p0.y + d10 * t0.y + d01 * p1.y + d11 * t1.y,
      }),
    );
  }
  return { points, dirs };
}

/** Cubic Hermite curve from p0 to p1 with tangents t0, t1 (n samples after p0, p0 included). */
function hermite(p0: Point, p1: Point, t0: Point, t1: Point, n: number): Point[] {
  return hermiteCurve(p0, p1, t0, t1, n).points;
}

function scaled(v: Point, k: number): Point {
  return { x: v.x * k, y: v.y * k };
}

function unit(v: Point): Point {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/**
 * Tiles paved like the city: every city center tile and its direct neighbors. Only the city
 * centers in `shown` count (the buildings the viewer may see, fog.ts `buildingsShownTo`), so
 * paving never gives away a city on a tile the viewer has not explored.
 */
export function pavedTiles(
  state: GameState,
  shown: readonly Building[] = state.buildings,
): Set<number> {
  const out = new Set<number>();
  for (const b of shown) {
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

/** Where a road arm enters a tile: across edge `edge`, from the tile `other`. */
interface Arm {
  edge: number;
  other: number;
  /** Where the road crosses the edge (the same point from both tiles) */
  mid: Point;
  /** Inward direction (from the edge toward this tile's center) */
  inward: Point;
  /** Key of the edge crossing (shared by the pieces of both tiles that end there) */
  key: string;
}

/**
 * A smooth curve from one road edge through the point `c` (near the tile center) to another:
 * it crosses each edge at right angles and passes `c` heading from the first edge to the second.
 */
function throughCenter(a: Arm, b: Arm, c: Point, n: number): Curve {
  const la = Math.hypot(c.x - a.mid.x, c.y - a.mid.y);
  const lb = Math.hypot(c.x - b.mid.x, c.y - b.mid.y);
  const through = scaled({ x: b.mid.x - a.mid.x, y: b.mid.y - a.mid.y }, 0.5);
  const first = hermiteCurve(a.mid, c, scaled(a.inward, la), through, n);
  const second = hermiteCurve(c, b.mid, through, scaled(b.inward, -lb), n);
  return {
    points: [...first.points, ...second.points.slice(1)],
    dirs: [...first.dirs, ...second.dirs.slice(1)],
  };
}

/** A straight-ish curve from an arm's edge point inward to `end`, crossing the edge at right angles. */
function inwardCurve(arm: Arm, end: Point, n: number): Curve {
  const len = Math.hypot(end.x - arm.mid.x, end.y - arm.mid.y);
  const toEnd = unit({ x: end.x - arm.mid.x, y: end.y - arm.mid.y });
  return hermiteCurve(arm.mid, end, scaled(arm.inward, len), scaled(toEnd, len), n);
}

/** Where a line from `from` toward the center `c` meets the ellipse (rx, ry) around `c`. */
function onEllipse(from: Point, c: Point, rx: number, ry: number): Point {
  const d = { x: from.x - c.x, y: from.y - c.y };
  const k = Math.hypot(d.x / rx, d.y / ry);
  // Never past the edge point itself: a short stub at least
  const s = Math.min(0.92, 1 / (k || 1));
  return { x: c.x + d.x * s, y: c.y + d.y * s };
}

/** A piece under construction: its curve and its keys at both ends (null = no joint). */
interface Draft {
  piece: TrackPiece;
  keys: [string | null, string | null];
}

/** Reverses a piece in place (and its end keys). */
function reverseDraft(d: Draft): void {
  const p = d.piece;
  p.points.reverse();
  p.dirs.reverse();
  for (let i = 0; i < p.dirs.length; i++) p.dirs[i] = { x: -p.dirs[i].x, y: -p.dirs[i].y };
  p.widths.reverse();
  p.fade.reverse();
  p.ruts.reverse();
  p.banks.reverse();
  p.curbs.reverse();
  d.keys.reverse();
}

/**
 * Distances along the road: pieces that meet at an edge crossing shared by exactly two pieces
 * form a chain; along a chain the pieces are turned to run one way and `along` runs on from piece
 * to piece. Chains break at junctions (three or more pieces at a crossing) and at loose ends.
 */
function chainAlong(drafts: Draft[]): void {
  const ends = new Map<string, { d: number; end: 0 | 1 }[]>();
  drafts.forEach((draft, d) => {
    draft.keys.forEach((key, end) => {
      if (key === null) return;
      const list = ends.get(key);
      const entry = { d, end: end as 0 | 1 };
      if (list) list.push(entry);
      else ends.set(key, [entry]);
    });
  });
  /** The other piece end at the crossing of piece `d`'s end `end`, if exactly two meet there. */
  const across = (d: number, end: 0 | 1): { d: number; end: 0 | 1 } | null => {
    const key = drafts[d].keys[end];
    if (key === null) return null;
    const list = ends.get(key);
    if (!list || list.length !== 2) return null;
    return list[0].d === d && list[0].end === end ? list[1] : list[0];
  };
  const done = new Set<number>();
  for (let start = 0; start < drafts.length; start++) {
    if (done.has(start)) continue;
    // Walk back to the first piece of the chain (or once around a loop)
    let cur = start;
    let free: 0 | 1 = 0;
    for (let guard = 0; guard < drafts.length; guard++) {
      const prev = across(cur, free);
      if (!prev || prev.d === start || done.has(prev.d)) break;
      cur = prev.d;
      free = prev.end === 0 ? 1 : 0;
    }
    // ... then forward, turning every piece to start where the last one ended
    let s = 0;
    let entry: 0 | 1 = free;
    for (let guard = 0; guard <= drafts.length; guard++) {
      const draft = drafts[cur];
      done.add(cur);
      if (entry === 1) reverseDraft(draft);
      const p = draft.piece;
      p.along = [s];
      for (let i = 1; i < p.points.length; i++) {
        s += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y);
        p.along.push(s);
      }
      const next = across(cur, 1);
      if (!next || done.has(next.d)) break;
      cur = next.d;
      entry = next.end;
    }
  }
}

/**
 * The road network as smooth tracks (world px), from `roadGeometry`:
 * - every connection crosses its shared edge at one point (near the edge midpoint, a little
 *   beside it, the same from both tiles) at right angles to the edge, so the pieces of
 *   neighboring tiles run on without a kink (and with the same direction at the joint);
 * - a tile with two road edges: one curve through (near) its center;
 * - a dead end: the track fades out toward the center and ends in a small worn spot;
 * - a junction: gravel curves between neighboring arms (they cut the corners like worn paths)
 *   with a worn crossing in the middle; paving: spokes into a small paved square;
 * - onto a building tile: the track fades out in its yard; onto a city center it ends cleanly
 *   at the plaza;
 * - a lone road tile: only a worn spot.
 * On city center tiles and their neighbors the pieces are paved. On hills the pieces carry the
 * strength of the banks of their cut through the slope.
 */
export function roadTracks(
  state: GameState,
  size: number,
  params: TrackParams,
  shown: readonly Building[] = state.buildings,
): RoadTracks {
  const map = state.map;
  const { segments, stubs } = shownRoadGeometry(state, shown);
  const paved = pavedTiles(state, shown);
  const shownCenters = new Set(
    shown.filter((b) => b.type === 'cityCenter').map((b) => tileIndex(map, b.hex)),
  );
  const styleOf = (i: number): TrackStyle => (paved.has(i) ? 'paved' : 'dirt');
  const hill = (i: number): boolean => map.tiles[i] === 'hills';
  const center = (i: number): Point => hexToPixel(hexAtIndex(map, i), size);
  const w0 = params.width * size;
  const widthOf = (style: TrackStyle): number => (style === 'paved' ? w0 * params.pavingWidth : w0);
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
    // Seen from the lower index, so both tiles get the same point
    const along = unit({ x: -(center(hi).y - center(lo).y), y: center(hi).x - center(lo).x });
    const shift = (roadHash(lo, hi, 301) - 0.5) * 2 * params.edgeJitter * size;
    const mid = {
      x: (ca.x + cb.x) / 2 + along.x * shift,
      y: (ca.y + cb.y) / 2 + along.y * shift,
    };
    const ha = hexAtIndex(map, a);
    let edge = 0;
    for (let e = 0; e < 6; e++) if (mapEdgeNeighborIndex(map, ha, e) === b) edge = e;
    const key = `${lo}-${hi}`;
    addArm(a, { edge, other: b, mid, inward: unit({ x: ca.x - cb.x, y: ca.y - cb.y }), key });
    addArm(b, {
      edge: (edge + 3) % 6,
      other: a,
      mid,
      inward: unit({ x: cb.x - ca.x, y: cb.y - ca.y }),
      key,
    });
  }
  /** A road tile where three or more roads meet. */
  const isJunction = (i: number): boolean => state.roads[i] && (arms.get(i)?.length ?? 0) >= 3;
  const drafts: Draft[] = [];
  const crossings: TrackCrossing[] = [];
  const n = params.samples;
  for (const [tile, list] of arms) {
    list.sort((u, v) => u.edge - v.edge);
    const c0 = center(tile);
    const style = styleOf(tile);
    const w = widthOf(style);
    const h = hexAtIndex(map, tile);
    /**
     * Bank strength at share `t` of the way from `arm`'s edge to the center: full on a hill tile
     * whose neighbor across that edge is a hill too, else growing in from the edge.
     */
    const bankAt = (arm: Arm, t: number): number => {
      if (!hill(tile)) return 0;
      return hill(arm.other) ? 1 : smooth01(0, params.bankRamp, t);
    };
    /**
     * Rut strength near an edge toward paving or a junction: the ruts fade out before the stones
     * begin, and before a crossing (it is one worn place without ruts).
     */
    const rutNear = (arm: Arm, t: number): number =>
      style === 'dirt' && (styleOf(arm.other) === 'paved' || isJunction(arm.other))
        ? smooth01(0, 0.5, t)
        : 1;
    /** A piece from the curve; `look(i, t)` gives its look at point i (t = 0..1 along it). */
    const add = (
      kind: TrackKind,
      curve: Curve,
      keys: [string | null, string | null],
      look: (i: number, t: number) => { width: number; fade: number; ruts: number; banks: number },
    ): void => {
      const m = curve.points.length - 1;
      const piece: TrackPiece = {
        tile,
        style,
        kind,
        points: curve.points,
        dirs: curve.dirs,
        widths: [],
        along: [],
        fade: [],
        ruts: [],
        banks: [],
        curbs: [false, false],
      };
      for (let i = 0; i <= m; i++) {
        const l = look(i, i / m);
        piece.widths.push(l.width);
        piece.fade.push(l.fade);
        piece.ruts.push(style === 'paved' ? 0 : l.ruts);
        piece.banks.push(l.banks);
      }
      drafts.push({ piece, keys });
    };
    if (!state.roads[tile]) {
      // Onto a building tile: a city center's plaza (clean end), or a yard (fading out)
      const plaza = shownCenters.has(tile);
      for (const arm of list) {
        if (plaza) {
          const end = onEllipse(arm.mid, c0, params.plazaRx * size, params.plazaRy * size);
          add('plaza', inwardCurve(arm, end, n), [arm.key, null], (_i, t) => ({
            width: w,
            fade: 1,
            ruts: 0,
            banks: bankAt(arm, t) * (1 - t),
          }));
          continue;
        }
        const k = params.buildingEnd;
        const end = {
          x: arm.mid.x + (c0.x - arm.mid.x) * k,
          y: arm.mid.y + (c0.y - arm.mid.y) * k,
        };
        // It spreads a little into the yard and fades out there, its ruts first (paving: a
        // clean end)
        add('yard', inwardCurve(arm, end, n), [arm.key, null], (_i, t) => ({
          width: style === 'paved' ? w : w * (1 + 0.18 * t),
          fade: style === 'paved' ? 1 : 1 - smooth01(0.3, 1, t),
          ruts: (1 - smooth01(0.05, 0.6, t)) * rutNear(arm, t),
          banks: bankAt(arm, t) * (1 - smooth01(0.2, 0.9, t)),
        }));
      }
      continue;
    }
    // A road tile: its track runs a little beside the exact center
    const jx = (roadHash(h.q, h.r, 303) - 0.5) * 2 * params.centerJitter * size;
    const jy = (roadHash(h.q, h.r, 304) - 0.5) * 2 * params.centerJitter * size;
    const c = { x: c0.x + jx, y: c0.y + jy };
    if (list.length === 1) {
      // Dead end: the track narrows a little and fades out at the center, in a small worn spot
      // (paving: ends in a small paved square)
      const arm = list[0];
      add('deadEnd', inwardCurve(arm, c, n), [arm.key, null], (_i, t) => ({
        width: style === 'paved' ? w : w * (1 - 0.2 * t),
        fade: style === 'paved' ? 1 : 1 - smooth01(0.45, 1, t),
        ruts: (1 - smooth01(0.2, 0.8, t)) * rutNear(arm, t),
        banks: bankAt(arm, t),
      }));
      crossings.push({
        tile,
        style,
        kind: 'deadEnd',
        center: c,
        r: style === 'paved' ? w * params.squareRadius * 0.7 : w * params.deadEndRadius,
      });
      continue;
    }
    /**
     * Look of a curve between arms a and b through the center (t = 0 at a, 1 at b); `inner`
     * scales the ruts and banks toward its middle (they fade out inside a junction).
     */
    const between =
      (a: Arm, b: Arm, inner: (t: number) => number, ruts = 1) =>
      (_i: number, t: number): { width: number; fade: number; ruts: number; banks: number } => {
        const half = t < 0.5 ? 2 * t : 2 * (1 - t);
        const arm = t < 0.5 ? a : b;
        const k = inner(t);
        return {
          width: w,
          fade: 1,
          ruts: ruts * k * rutNear(arm, half),
          banks: bankAt(arm, half) * k,
        };
      };
    if (list.length === 2) {
      // One smooth curve through the center
      const [a, b] = list;
      add(
        'through',
        throughCenter(a, b, c, n),
        [a.key, b.key],
        between(a, b, () => 1),
      );
      continue;
    }
    if (style === 'paved') {
      // Paved junction: a spoke from every arm into a small paved square in the middle
      for (const arm of list) {
        add('junction', inwardCurve(arm, c, n), [arm.key, null], (_i, t) => ({
          width: w,
          fade: 1,
          ruts: 0,
          banks: bankAt(arm, t) * (1 - smooth01(0.3, 0.8, t)),
        }));
      }
      crossings.push({ tile, style, kind: 'junction', center: c, r: w * params.squareRadius });
      continue;
    }
    // Gravel junction: smooth curves between neighboring arms through (near) the center, so they
    // run in like the track of a two-way tile and merge in a worn crossing. One worn place: no
    // ruts (the tracks running in let theirs fade out), the banks fade toward the middle.
    for (let k = 0; k < list.length; k++) {
      const a = list[k];
      const b = list[(k + 1) % list.length];
      add(
        'junction',
        throughCenter(a, b, c, n),
        [a.key, b.key],
        between(a, b, (t) => Math.max(0, 1 - Math.sin(Math.PI * t) * 1.7), 0),
      );
    }
    crossings.push({ tile, style, kind: 'junction', center: c, r: w * params.junctionRadius });
  }
  for (const s of stubs) {
    const style = styleOf(s);
    crossings.push({
      tile: s,
      style,
      kind: 'lone',
      center: center(s),
      r: style === 'paved' ? widthOf(style) * params.squareRadius : w0 * params.loneRadius,
    });
  }
  // Paving ends with a row of edge stones where a gravel track goes on
  const gravelKeys = new Set<string>();
  for (const d of drafts) {
    if (d.piece.style !== 'dirt') continue;
    for (const k of d.keys) if (k !== null) gravelKeys.add(k);
  }
  for (const d of drafts) {
    if (d.piece.style !== 'paved') continue;
    d.piece.curbs = [
      d.keys[0] !== null && gravelKeys.has(d.keys[0]),
      d.keys[1] !== null && gravelKeys.has(d.keys[1]),
    ];
  }
  chainAlong(drafts);
  return { pieces: drafts.map((d) => d.piece), crossings };
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
 * The planned road along `path` as one piece with the look of a gravel track (for the ghosted
 * preview): directions and distances along it, full surface, ruts and no banks.
 */
export function previewPiece(path: readonly Hex[], size: number, width: number): TrackPiece {
  const points = previewTrack(path, size);
  const dirs = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    return unit({ x: b.x - a.x, y: b.y - a.y });
  });
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(
      along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  return {
    tile: -1,
    style: 'dirt',
    kind: 'through',
    points,
    dirs,
    widths: points.map(() => width * size),
    along,
    fade: points.map(() => 1),
    ruts: points.map(() => 1),
    banks: points.map(() => 0),
    curbs: [false, false],
  };
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

/**
 * Cheap key of the road network as the viewer sees it (`shown`: the buildings it may see), so
 * the tracks repaint when the network or what the viewer may see of it changes.
 */
export function roadSignature(
  state: GameState,
  shown: readonly Building[] = state.buildings,
): string {
  const { segments, stubs } = shownRoadGeometry(state, shown);
  const paved = [...pavedTiles(state, shown)].sort((a, b) => a - b);
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
