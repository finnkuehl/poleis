// Pure helpers for the painted terrain (no PixiJS, easy to test): a deterministic hash per
// tile, color math, shore detection and the layout of trees, mounds and peaks.
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
 * (`shore` edges) are skipped, so trees do not stand in the sand.
 */
export function forestTrees(
  rng: () => number,
  size: number,
  shore: readonly boolean[],
  cypressShare: number,
): TreeSpot[] {
  const trees: TreeSpot[] = [];
  for (const slot of TREE_SLOTS) {
    // A few gaps make every forest tile look different
    if (rng() < 0.16) continue;
    const x = (slot.x + (rng() - 0.5) * 0.16) * size;
    const y = (slot.y + (rng() - 0.5) * 0.12) * size;
    const kind: TreeKind = rng() < cypressShare ? 'cypress' : 'pine';
    const scale = 0.8 + rng() * 0.4;
    if (distanceToEdges({ x, y }, shore, size) < size * 0.3) continue;
    trees.push({ kind, x, y, scale });
  }
  // At least one tree, so a forest never looks empty
  if (trees.length === 0) trees.push({ kind: 'pine', x: 0, y: 0.05 * size, scale: 1 });
  return trees.sort((a, b) => a.y - b.y);
}

export interface MoundSpot {
  /** Middle of the mound's base line, relative to the tile center (world px). */
  x: number;
  y: number;
  /** Half width and height of the mound (world px). */
  w: number;
  h: number;
}

/** 2-3 rolling, overlapping mounds of one hills tile, sorted back to front. */
export function hillMounds(rng: () => number, size: number): MoundSpot[] {
  const j = (v: number): number => (rng() - 0.5) * v;
  const mound = (x: number, y: number, w: number, h: number): MoundSpot => ({
    x: (x + j(0.1)) * size,
    y: (y + j(0.06)) * size,
    w: (w + j(0.08)) * size,
    h: (h + j(0.06)) * size,
  });
  const mounds = [mound(-0.12, 0.36, 0.62, 0.34), mound(0.3, 0.12, 0.48, 0.3)];
  if (rng() < 0.75) mounds.push(mound(-0.24, -0.14, 0.42, 0.26));
  return mounds.sort((a, b) => a.y - b.y);
}

export interface PeakSpot {
  /** Middle of the peak's base line, relative to the tile center (world px). */
  x: number;
  y: number;
  /** Half width of the base, height (world px), horizontal shift of the tip. */
  hw: number;
  h: number;
  skew: number;
  /** Snow cap on top? */
  snow: boolean;
}

/** One big peak in front plus 1-2 smaller ones behind, sorted back to front. */
export function mountainPeaks(rng: () => number, size: number): PeakSpot[] {
  const j = (v: number): number => (rng() - 0.5) * v * size;
  const peaks: PeakSpot[] = [];
  const left = rng() < 0.5;
  // Back peak, to one side
  peaks.push({
    x: (left ? -0.28 : 0.28) * size + j(0.08),
    y: 0.08 * size + j(0.06),
    hw: 0.4 * size + j(0.06),
    h: 0.7 * size + j(0.08),
    skew: j(0.1),
    snow: rng() < 0.8,
  });
  // Low side peak on the other side (sometimes)
  if (rng() < 0.6) {
    peaks.push({
      x: (left ? 0.36 : -0.36) * size + j(0.06),
      y: 0.22 * size + j(0.06),
      hw: 0.26 * size + j(0.05),
      h: 0.38 * size + j(0.06),
      skew: j(0.08),
      snow: false,
    });
  }
  // Main peak in front
  peaks.push({
    x: j(0.1),
    y: 0.42 * size + j(0.04),
    hw: 0.56 * size + j(0.06),
    h: 0.94 * size + j(0.08),
    skew: j(0.12),
    snow: true,
  });
  return peaks.sort((a, b) => a.y - b.y);
}
