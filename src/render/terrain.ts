// Pure helpers for the painted terrain (no PixiJS, easy to test): a deterministic hash per
// tile, color math, noise, wavy edges, shore detection, footprints and the layout of trees
// (hills and mountains: relief.ts).
// Everything here only affects the look; it never changes game logic.
import type { Hex, Point } from '../core/hex';
import { tileIndex } from '../core/map';
import type { MapState } from '../core/state';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { edgeNeighborHex } from './geometry';
import { theme } from './theme';

/** Deterministic hash of a tile position (+ salt) in [0, 1). Same tile -> same value, always. */
export function tileHash(q: number, r: number, salt = 0): number {
  let h =
    Math.imul(q | 0, 0x27d4eb2d) ^ Math.imul(r | 0, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Small deterministic random sequence for one tile (mulberry32), values in [0, 1). */
export function tileRng(q: number, r: number, salt = 0): () => number {
  let a = Math.floor(tileHash(q, r, salt) * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear mix of two 0xRRGGBB colors (t = 0 -> a, t = 1 -> b). */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Multiplies all channels of a color by `f` (> 1 lighter, < 1 darker), clamped to 0..255. */
export function scaleColor(c: number, f: number): number {
  const ch = (shift: number): number =>
    Math.max(0, Math.min(255, Math.round(((c >> shift) & 0xff) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Fill color of one tile: the terrain color, brightened or darkened a little per tile; some
 * meadows lean golden. Deterministic (same tile, same color).
 */
export function tileBaseColor(t: TerrainId, h: Hex): number {
  const p = theme.terrainPaint;
  let color: number = theme.terrainColors[t];
  if (t === 'plains') {
    // Squared, so most meadows stay green and only some turn clearly golden
    color = mixColor(color, p.plainsGoldenColor, tileHash(h.q, h.r, 2) ** 2 * p.plainsGoldenMax);
  }
  const v = isWater(t) ? p.waterVariation : p.landVariation;
  return scaleColor(color, 1 + (tileHash(h.q, h.r, 3) - 0.5) * 2 * v);
}

/**
 * Smooth value noise in [0, 1): random values on an integer lattice (from `tileHash`), blended
 * with smoothstep. Continuous in x and y, so neighboring tiles get nearly the same value.
 */
export function valueNoise(x: number, y: number, salt = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v00 = tileHash(x0, y0, salt);
  const v10 = tileHash(x0 + 1, y0, salt);
  const v01 = tileHash(x0, y0 + 1, salt);
  const v11 = tileHash(x0 + 1, y0 + 1, salt);
  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

/** Two octaves of `valueNoise` (large shapes plus some detail), still in [0, 1). */
export function smoothNoise(x: number, y: number, salt = 0): number {
  return valueNoise(x, y, salt) * 0.7 + valueNoise(x * 2.3 + 17.1, y * 2.3 + 5.7, salt + 1) * 0.3;
}

/** Number of segments of a wavy tile edge (more = smoother curve, more vertices). */
export const WAVE_SEGMENTS = 8;

/**
 * Offsets (px) of the wavy edge between tile `h` and its neighbor across `edge`, one per point
 * at t = i / WAVE_SEGMENTS along the edge (corner `edge` -> corner `edge + 1`), measured outward
 * from `h` (positive = `h` bulges into the neighbor). Both ends are 0, so the curve ends exactly
 * in the hex corners. The curve belongs to the pair of tiles: the neighbor gets the same curve
 * from its side (its offsets are this array reversed and negated). |offset| <= amplitude.
 */
export function edgeWave(h: Hex, edge: number, amplitude: number, salt = 0): number[] {
  const nb = edgeNeighborHex(h, edge);
  // The tile that comes first (by row, then column) owns the curve
  const own = h.r < nb.r || (h.r === nb.r && h.q < nb.q);
  const base = own ? h : nb;
  const baseEdge = own ? edge : (edge + 3) % 6;
  const rng = tileRng(base.q, base.r, 500 + salt * 7 + baseEdge);
  // A sine series is 0 at both ends: one bulge, an S-curve and a smaller ripple
  const c1 = (rng() * 2 - 1) * 1;
  const c2 = (rng() * 2 - 1) * 0.6;
  const c3 = (rng() * 2 - 1) * 0.3;
  const scale = amplitude / Math.max(1, Math.abs(c1) + Math.abs(c2) + Math.abs(c3));
  const offsets: number[] = [];
  for (let i = 0; i <= WAVE_SEGMENTS; i++) {
    const t = i / WAVE_SEGMENTS;
    if (i === 0 || i === WAVE_SEGMENTS) {
      offsets.push(0);
      continue;
    }
    const v =
      c1 * Math.sin(Math.PI * t) + c2 * Math.sin(2 * Math.PI * t) + c3 * Math.sin(3 * Math.PI * t);
    offsets.push(v * scale);
  }
  if (own) return offsets;
  // Seen from the other tile: same curve, walked the other way round with the normal flipped
  return offsets.reverse().map((v) => (v === 0 ? 0 : -v));
}

/** Wave offset at t (0..1) along an edge, linearly interpolated between the points. */
export function waveAt(offsets: readonly number[], t: number): number {
  const n = offsets.length - 1;
  const f = Math.max(0, Math.min(n, t * n));
  const i = Math.min(n - 1, Math.floor(f));
  return offsets[i] + (offsets[i + 1] - offsets[i]) * (f - i);
}

/**
 * Like `distanceToEdges`, but to wavy edges: `waves[e]` are the offsets of edge e (null =
 * straight). A point exactly on the curve has distance 0.
 */
export function distanceToWavyEdges(
  p: Point,
  mask: readonly boolean[],
  waves: readonly (readonly number[] | null)[],
  size: number,
): number {
  let best = Infinity;
  const a = apothem(size);
  for (let e = 0; e < 6; e++) {
    if (!mask[e]) continue;
    const angle = (Math.PI / 3) * e;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    let d = a - (p.x * nx + p.y * ny);
    const offsets = waves[e];
    if (offsets) {
      // Edge direction runs from corner e to corner e + 1 (normal turned by +90°)
      const along = p.x * -ny + p.y * nx;
      d += waveAt(offsets, along / size + 0.5);
    }
    best = Math.min(best, d);
  }
  return best;
}

/** Size of a footprint (ellipse radii in px around a tile center). */
export interface FootprintShape {
  rx: number;
  ry: number;
}

/**
 * True when `p` (relative to the tile center) lies inside the footprint: inside the ellipse AND
 * inside the hex (a footprint larger than the hex covers the whole tile, never its neighbors).
 */
export function insideFootprint(p: Point, fp: FootprintShape, size: number): boolean {
  if (fp.rx <= 0 || fp.ry <= 0) return false;
  if ((p.x * p.x) / (fp.rx * fp.rx) + (p.y * p.y) / (fp.ry * fp.ry) > 1) return false;
  return distanceToEdges(p, ALL_EDGES, size) >= 0;
}

const ALL_EDGES: readonly boolean[] = [true, true, true, true, true, true];

/**
 * Map rows whose terrain details must be repainted when the footprints change from `prev` to
 * `next` (keys = tile indices). Objects of a tile can stand a little over its edge, so the rows
 * above and below a changed tile are repainted too. Sorted; empty when nothing changed.
 */
export function footprintRowsToRepaint(
  prev: ReadonlyMap<number, FootprintShape>,
  next: ReadonlyMap<number, FootprintShape>,
  width: number,
  height: number,
): number[] {
  const rows = new Set<number>();
  const mark = (index: number): void => {
    const row = Math.floor(index / width);
    for (let r = row - 1; r <= row + 1; r++) if (r >= 0 && r < height) rows.add(r);
  };
  for (const [i, a] of prev) {
    const b = next.get(i);
    if (!b || b.rx !== a.rx || b.ry !== a.ry) mark(i);
  }
  for (const i of next.keys()) if (!prev.has(i)) mark(i);
  return [...rows].sort((x, y) => x - y);
}

/** True when the terrain is water (ocean or coast). */
export function isWater(t: TerrainId): boolean {
  return TERRAIN[t].isWater;
}

/**
 * One boolean per edge (edge order as in `geometry.ts`): does the neighbor across this edge
 * pass `test`? Edges at the map border are false.
 */
export function edgeMask(map: MapState, h: Hex, test: (neighbor: TerrainId) => boolean): boolean[] {
  const mask: boolean[] = [];
  for (let e = 0; e < 6; e++) {
    const i = tileIndex(map, edgeNeighborHex(h, e));
    mask.push(i >= 0 && test(map.tiles[i]));
  }
  return mask;
}

/** Edges where land meets water: for a land tile the water edges (beach), for water the land edges (foam). */
export function shoreMask(map: MapState, h: Hex): boolean[] {
  const i = tileIndex(map, h);
  if (i < 0) return [false, false, false, false, false, false];
  const water = isWater(map.tiles[i]);
  return edgeMask(map, h, (n) => isWater(n) !== water);
}

/** Apothem (center to edge midpoint) of a hex with corner radius `size`. */
export function apothem(size: number): number {
  return (size * Math.sqrt(3)) / 2;
}

/**
 * Distance of a point (relative to the tile center) to the nearest edge in `mask`
 * (Infinity if no edge is set). Edge e faces the direction of angle 60° * e (screen y down).
 */
export function distanceToEdges(p: Point, mask: readonly boolean[], size: number): number {
  let best = Infinity;
  const a = apothem(size);
  for (let e = 0; e < 6; e++) {
    if (!mask[e]) continue;
    const angle = (Math.PI / 3) * e;
    const d = a - (p.x * Math.cos(angle) + p.y * Math.sin(angle));
    best = Math.min(best, d);
  }
  return best;
}

/** Points of an ellipse as a polygon [x0, y0, x1, y1, ...]; `wobble` (0..1) roughens the outline. */
export function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
  wobble = 0,
  rng?: () => number,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    const f = wobble > 0 && rng ? 1 + (rng() - 0.5) * 2 * wobble : 1;
    pts.push(cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f);
  }
  return pts;
}

/**
 * A brush stroke as a filled polygon [x0, y0, ...]: follows `line`, `width` thick in the middle
 * and pointed at both ends. Much cheaper than a stroke with round caps, and looks painted.
 * Lines with 2 points are subdivided so the stroke gets a body.
 */
export function taperedStroke(line: readonly Point[], width: number): number[] {
  let pts = line;
  if (pts.length === 2) {
    const [a, b] = pts;
    pts = [0, 0.3, 0.7, 1].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  }
  const n = pts.length;
  if (n < 2) return [];
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Width profile: 0 at the ends, full in the middle
    const half = (width / 2) * Math.sqrt(Math.sin((Math.PI * i) / (n - 1)));
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    const p = pts[i];
    if (i === 0 || i === n - 1) {
      left.push(p.x, p.y);
      continue;
    }
    left.push(p.x + nx, p.y + ny);
    // Other side back to front (unshift keeps the [x, y] pair order)
    right.unshift(p.x - nx, p.y - ny);
  }
  return [...left, ...right];
}

export type TreeKind = 'pine' | 'cypress';

export interface TreeSpot {
  kind: TreeKind;
  /** Foot of the tree, relative to the tile center (world px). */
  x: number;
  y: number;
  /** Size factor (1 = normal). */
  scale: number;
}

/** Slots for trees inside a forest tile (fractions of the hex size), roughly a ring + center. */
const TREE_SLOTS: readonly Point[] = [
  { x: -0.2, y: -0.42 },
  { x: 0.22, y: -0.4 },
  { x: -0.46, y: -0.08 },
  { x: 0.02, y: -0.12 },
  { x: 0.46, y: -0.06 },
  { x: -0.28, y: 0.26 },
  { x: 0.2, y: 0.24 },
  { x: -0.04, y: 0.5 },
  { x: 0.48, y: 0.38 },
];

/**
 * Trees of one forest tile, sorted back to front (by y). Spots too close to a beach
 * (`shore` edges, or the distance function `shoreDistance` for curved shores) are skipped, so
 * trees do not stand in the sand.
 */
export function forestTrees(
  rng: () => number,
  size: number,
  shore: readonly boolean[],
  cypressShare: number,
  shoreDistance: (p: Point) => number = (p) => distanceToEdges(p, shore, size),
): TreeSpot[] {
  const trees: TreeSpot[] = [];
  for (const slot of TREE_SLOTS) {
    // A few gaps make every forest tile look different
    if (rng() < 0.16) continue;
    const x = (slot.x + (rng() - 0.5) * 0.16) * size;
    const y = (slot.y + (rng() - 0.5) * 0.12) * size;
    const kind: TreeKind = rng() < cypressShare ? 'cypress' : 'pine';
    const scale = 0.8 + rng() * 0.4;
    if (shoreDistance({ x, y }) < size * 0.3) continue;
    trees.push({ kind, x, y, scale });
  }
  // At least one tree, so a forest never looks empty
  if (trees.length === 0) trees.push({ kind: 'pine', x: 0, y: 0.05 * size, scale: 1 });
  return trees.sort((a, b) => a.y - b.y);
}
