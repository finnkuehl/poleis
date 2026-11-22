// Pure helpers for the relief of hills and mountains (no PixiJS, easy to test): where the hill
// mounds lie, how mountain tiles join into ranges (shared saddles and corners), the terrace under
// a building on a slope, the draw order of terrain rows between the buildings, the roads the
// terrain keeps free, and the pixels of the soft shading textures.
// Everything here only affects the look; it never changes game logic.
import { hexCorners, hexToPixel, pixelToHex, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { MapState } from '../core/state';
import type { TerrainId } from '../data/terrain';
import { depthKey } from './artLayout';
import { edgeNeighborHex, mapEdgeNeighborIndex, type RoadGeometry } from './geometry';
import { distanceToEdges, isWater, smoothNoise, tileRng, type FootprintShape } from './terrain';
import { theme } from './theme';

const H = theme.terrainPaint.hills;
const M = theme.terrainPaint.mountains;

/** A point in the landscape: x / y on the ground (world px, y = south / down), z = height (px). */
export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Screen position of a raised point (oblique view: height goes straight up). */
export function project(p: P3): Point {
  return { x: p.x, y: p.y - p.z };
}

/** True when `a` comes before `b` (by row, then column): that tile owns shared features. */
function before(a: Hex, b: Hex): boolean {
  return a.r < b.r || (a.r === b.r && a.q < b.q);
}

function terrainOf(map: MapState, h: Hex): TerrainId | null {
  const i = tileIndex(map, h);
  return i < 0 ? null : map.tiles[i];
}

// ---------------------------------------------------------------------------------------------
// Draw order
// ---------------------------------------------------------------------------------------------

/**
 * zIndex of a terrain detail row in the sorted container of the buildings (`depthKey`): after
 * every building of the row above, before every building of this row. So a mountain of a lower
 * row covers a building of the row above, and a building covers the terrain of its own row.
 */
export function rowDepthKey(row: number): number {
  return depthKey({ q: 0, r: row }) - 2048;
}

// ---------------------------------------------------------------------------------------------
// Hills
// ---------------------------------------------------------------------------------------------

/** One broad hill mound: base center (world px), half width, height, lit color index. */
export interface HillMound {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: number;
}

/** Front bulge of a mound's base (px). */
export function moundDepth(m: HillMound): number {
  return m.w * H.depth;
}

/** Outline points of a mound, for the fit test: feet, front, crest, flanks. */
function moundProbes(m: HillMound): { base: Point[]; top: Point[] } {
  const d = moundDepth(m);
  return {
    base: [
      { x: m.x - m.w * 0.92, y: m.y },
      { x: m.x + m.w * 0.92, y: m.y },
      { x: m.x, y: m.y + d },
      { x: m.x - m.w * 0.6, y: m.y + d * 0.8 },
      { x: m.x + m.w * 0.6, y: m.y + d * 0.8 },
    ],
    top: [
      { x: m.x, y: m.y - m.h },
      { x: m.x - m.w * 0.55, y: m.y - m.h * 0.7 },
      { x: m.x + m.w * 0.55, y: m.y - m.h * 0.7 },
    ],
  };
}

/**
 * Does the mound fit? Its base must lie on hills (foothills: hills or mountains), its upper part
 * on land, and everything stays clear of the beach (`shoreDist` = distance of a world point to
 * the nearest shore of the tile it lies in, Infinity inland).
 */
function moundFits(
  map: MapState,
  m: HillMound,
  size: number,
  shoreDist: (p: Point) => number,
  baseOn: readonly TerrainId[],
): boolean {
  const { base, top } = moundProbes(m);
  for (const p of base) {
    const t = terrainOf(map, pixelToHex(p, size));
    if (!t || !baseOn.includes(t)) return false;
    if (shoreDist(p) < H.shoreMargin * size) return false;
  }
  for (const p of top) {
    const t = terrainOf(map, pixelToHex(p, size));
    if (!t || isWater(t)) return false;
    if (shoreDist(p) < H.shoreMargin * size * 0.8) return false;
  }
  return true;
}

/** Shrinks a mound until it fits (up to 4 steps); null if it never does. */
function fitMound(
  map: MapState,
  m: HillMound,
  size: number,
  shoreDist: (p: Point) => number,
  baseOn: readonly TerrainId[],
): HillMound | null {
  let cur = m;
  for (let i = 0; i < 5; i++) {
    if (moundFits(map, cur, size, shoreDist, baseOn)) return cur;
    cur = { ...cur, w: cur.w * 0.84, h: cur.h * 0.86 };
    if (cur.w < 0.18 * size) return null;
  }
  return null;
}

/**
 * The mound on the edge between hill tile `h` and its neighbor across `edge` (also a hill tile),
 * or null if that edge has none: the same answer whichever of the two tiles asks (the first tile
 * by row, then column owns it).
 */
export function edgeMound(h: Hex, edge: number, size: number): HillMound | null {
  const nb = edgeNeighborHex(h, edge);
  const own = before(h, nb);
  const base = own ? h : nb;
  const baseEdge = own ? edge : (edge + 3) % 6;
  const rng = tileRng(base.q, base.r, 610 + baseEdge);
  if (rng() >= H.edgeChance) return null;
  const corners = hexCorners(hexToPixel(base, size), size);
  const a = corners[baseEdge];
  const b = corners[(baseEdge + 1) % 6];
  const t = 0.5 + (rng() - 0.5) * 0.3;
  const j = (v: number): number => 1 + (rng() - 0.5) * 2 * v;
  return {
    x: a.x + (b.x - a.x) * t,
    // The base sits a little in front of the edge, so the crest rises over it
    y: a.y + (b.y - a.y) * t + (0.1 + (rng() - 0.5) * 0.1) * size,
    w: H.edgeW * size * j(H.jitter),
    h: H.edgeH * size * j(H.jitter),
    tone: Math.floor(rng() * H.tones.length),
  };
}

/**
 * All hill mounds of the map, back to front (by base y). Per hill tile: a broad mound in the
 * middle and a smaller one at the back; a mound on most edges between two hill tiles (so they
 * join), a foothill on every edge toward a mountain tile and now and then a low mound spilling
 * into a neighboring meadow. Mounds that do not fit shrink or
 * are left out (never on water or the beach, never with their foot on other terrain).
 */
export function hillMounds(
  map: MapState,
  size: number,
  shoreDist: (p: Point) => number,
): HillMound[] {
  const out: HillMound[] = [];
  const tone = (x: number, y: number, r: number): number => {
    // Regions of the same tone (smooth noise), with a little randomness
    const n = smoothNoise(x / (5 * size), y / (5 * size), 9) + (r - 0.5) * 0.08;
    return Math.max(0, Math.min(H.tones.length - 1, Math.floor(n * H.tones.length)));
  };
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== 'hills') continue;
    const hex = hexAtIndex(map, i);
    const c = hexToPixel(hex, size);
    const rng = tileRng(hex.q, hex.r, 600);
    const j = (v: number): number => 1 + (rng() - 0.5) * 2 * v;
    const add = (m: HillMound | null, baseOn: readonly TerrainId[] = ['hills']): void => {
      const fit = m && fitMound(map, m, size, shoreDist, baseOn);
      if (fit) out.push(fit);
    };
    add({
      x: c.x + (rng() - 0.5) * 0.4 * size,
      y: c.y - (0.36 + (rng() - 0.5) * 0.1) * size,
      w: H.backW * size * j(H.jitter),
      h: H.backH * size * j(H.jitter),
      tone: tone(c.x, c.y - 0.4 * size, rng()),
    });
    add({
      x: c.x + (rng() - 0.5) * 0.16 * size,
      y: c.y + (H.centerY + (rng() - 0.5) * 0.06) * size,
      w: H.centerW * size * j(H.jitter * 0.6),
      h: H.centerH * size * j(H.jitter * 0.6),
      tone: tone(c.x, c.y, rng()),
    });
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(map, hex, e);
      if (n < 0) continue;
      const other = map.tiles[n];
      if (other === 'hills' && n > i) {
        const m = edgeMound(hex, e, size);
        if (m) add(m);
      }
      if (other === 'plains') {
        // Now and then a low mound spills over into the meadow: the hills ease out
        const srng = tileRng(hex.q, hex.r, 630 + e);
        if (srng() >= theme.terrainPaint.spillMoundChance) continue;
        const corners = hexCorners(c, size);
        const a = corners[e];
        const b = corners[(e + 1) % 6];
        const t = 0.35 + srng() * 0.3;
        const ex = a.x + (b.x - a.x) * t;
        const ey = a.y + (b.y - a.y) * t;
        const len = Math.hypot(c.x - ex, c.y - ey) || 1;
        const f = -0.12 * size;
        add(
          {
            x: ex + ((c.x - ex) / len) * f,
            y: ey + ((c.y - ey) / len) * f + 0.06 * size,
            w: (0.26 + srng() * 0.08) * size,
            h: (0.12 + srng() * 0.05) * size,
            tone: 1,
          },
          ['plains', 'hills'],
        );
      }
      if (other === 'mountains') {
        const frng = tileRng(hex.q, hex.r, 620 + e);
        const corners = hexCorners(c, size);
        const a = corners[e];
        const b = corners[(e + 1) % 6];
        const t = 0.5 + (frng() - 0.5) * 0.3;
        const ex = a.x + (b.x - a.x) * t;
        const ey = a.y + (b.y - a.y) * t;
        // Pushed into the hill tile; its far side runs under the massif
        const f = H.footShift * size;
        const len = Math.hypot(c.x - ex, c.y - ey) || 1;
        add(
          {
            x: ex + ((c.x - ex) / len) * f,
            y: ey + ((c.y - ey) / len) * f + 0.08 * size,
            w: H.footW * size * (1 + (frng() - 0.5) * 2 * H.jitter),
            h: H.footH * size * (1 + (frng() - 0.5) * 2 * H.jitter),
            tone: 0,
          },
          ['hills', 'mountains'],
        );
      }
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Upper outline of a mound from its left foot over the crest to its right foot (`n` + 1 points),
 * then the front of its base back to the left foot: a closed shape (world px).
 */
export function moundOutline(m: HillMound, n = 12): Point[] {
  const pts: Point[] = [];
  const d = moundDepth(m);
  // Every mound a little different: crest shifted to one side, rounder or flatter
  const rng = tileRng(Math.round(m.x * 4), Math.round(m.y * 4), 670);
  const skew = (rng() - 0.5) * 0.5;
  const power = 1 + rng() * 0.7;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 - 1;
    // Broad, rounded crest with soft feet; t is bent so the crest sits at `skew`
    const u = t < skew ? (t - skew) / (1 + skew) : (t - skew) / (1 - skew);
    const bell = Math.pow(Math.max(0, 1 - u * u), power);
    pts.push({ x: m.x + m.w * t, y: m.y - m.h * bell });
  }
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push({ x: m.x + m.w * Math.cos(a), y: m.y + d * Math.sin(a) });
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Mountains
// ---------------------------------------------------------------------------------------------

/** The three names (hex + corner index) of one hex corner, and the canonical one. */
export function cornerOwner(h: Hex, corner: number): { hex: Hex; corner: number } {
  // Corner i of h is corner i + 4 of the neighbor across edge i, and corner i + 2 of the one
  // across edge i - 1 (see `hexCorners` and `EDGE_DIRECTION`)
  const n1 = edgeNeighborHex(h, corner);
  const n2 = edgeNeighborHex(h, (corner + 5) % 6);
  let best = { hex: h, corner };
  if (before(n1, best.hex)) best = { hex: n1, corner: (corner + 4) % 6 };
  if (before(n2, best.hex)) best = { hex: n2, corner: (corner + 2) % 6 };
  return best;
}

/** World position of a hex corner, computed from its canonical tile (bit-identical for all three). */
export function cornerPoint(h: Hex, corner: number, size: number): Point {
  const o = cornerOwner(h, corner);
  return hexCorners(hexToPixel(o.hex, size), size)[o.corner];
}

/**
 * Height of a hex corner in a mountain range: raised when all three tiles around it are
 * mountains (inside a range), else on the ground. The same for all three tiles.
 */
export function cornerHeight(map: MapState, h: Hex, corner: number, size: number): number {
  const tiles = [h, edgeNeighborHex(h, corner), edgeNeighborHex(h, (corner + 5) % 6)];
  if (!tiles.every((t) => terrainOf(map, t) === 'mountains')) return 0;
  const o = cornerOwner(h, corner);
  const rng = tileRng(o.hex.q, o.hex.r, 720 + o.corner);
  return (M.cornerMin + rng() * (M.cornerMax - M.cornerMin)) * size;
}

/**
 * Saddle on the edge between mountain tile `h` and its neighbor across `edge`: a raised point on
 * the edge where the slopes of both peaks meet (the ridge of the range). Identical for both tiles.
 */
export function ridgeSaddle(h: Hex, edge: number, size: number): P3 {
  const nb = edgeNeighborHex(h, edge);
  const own = before(h, nb);
  const base = own ? h : nb;
  const baseEdge = own ? edge : (edge + 3) % 6;
  const rng = tileRng(base.q, base.r, 700 + baseEdge);
  const corners = hexCorners(hexToPixel(base, size), size);
  const a = corners[baseEdge];
  const b = corners[(baseEdge + 1) % 6];
  const t = 0.5 + (rng() - 0.5) * 0.3;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: (M.saddleMin + rng() * (M.saddleMax - M.saddleMin)) * size,
  };
}

/** A mountain tile's massif: the peak and the closed foot line (clockwise on screen). */
export interface MassifPlan {
  apex: P3;
  base: P3[];
}

/**
 * The massif of a mountain tile. Its foot runs around the tile: at edges toward other mountain
 * tiles along the shared corners and saddle (so the slopes of both tiles meet there), else a bit
 * inside the tile (further inside toward water). With a building (`fp`) the massif sits at the
 * back of the tile: its front foot follows the back of the footprint, so the building stands at
 * the foot of its peak.
 */
export function massifPlan(
  map: MapState,
  h: Hex,
  size: number,
  fp: FootprintShape | null,
): MassifPlan {
  const c = hexToPixel(h, size);
  const corners = hexCorners(c, size);
  const rng = tileRng(h.q, h.r, 730);
  const across: (TerrainId | null)[] = [];
  for (let e = 0; e < 6; e++) across.push(terrainOf(map, edgeNeighborHex(h, e)));
  const mountain = (e: number): boolean => across[(e + 6) % 6] === 'mountains';
  const water = (e: number): boolean => {
    const t = across[(e + 6) % 6];
    return t !== null && isWater(t);
  };
  const inset = (p: Point, f: number): P3 => ({
    x: c.x + (p.x - c.x) * f,
    y: c.y + (p.y - c.y) * f,
    z: 0,
  });
  // 12 foot points: corner e, then the middle of edge e
  const loop: P3[] = [];
  for (let e = 0; e < 6; e++) {
    const jitter = (rng() - 0.5) * 0.08;
    if (mountain(e - 1) || mountain(e)) {
      const p = cornerPoint(h, e, size);
      loop.push({ ...p, z: cornerHeight(map, h, e, size) });
    } else {
      const f = (water(e - 1) || water(e) ? M.shoreInset : M.footInset) + jitter;
      loop.push(inset(corners[e], f));
    }
    const mid = {
      x: (corners[e].x + corners[(e + 1) % 6].x) / 2,
      y: (corners[e].y + corners[(e + 1) % 6].y) / 2,
    };
    const midJitter = (rng() - 0.5) * 0.1;
    if (mountain(e)) loop.push(ridgeSaddle(h, e, size));
    else loop.push(inset(mid, (water(e) ? M.shoreInset : M.footInset) + midJitter));
  }
  const peakRng = tileRng(h.q, h.r, 731);
  if (!fp) {
    // Whole ranges higher or lower (smooth noise), each peak a little different
    const high = smoothNoise(c.x / (6 * size), c.y / (6 * size), 21) * 0.65 + peakRng() * 0.35;
    return {
      apex: {
        x: c.x + (peakRng() - 0.5) * 0.24 * size,
        y: c.y + (-0.04 + (peakRng() - 0.5) * 0.16) * size,
        z: (M.peakMin + high * (M.peakMax - M.peakMin)) * size,
      },
      base: loop,
    };
  }
  // With a building: keep the back of the foot (upper left corner .. upper right corner, over
  // the top) and close it along the back of the footprint, from east to west
  const back = [8, 9, 10, 11, 0].map((i) => loop[i]);
  const limit = 0.94 * (Math.sqrt(3) / 2) * size;
  const arc: P3[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = -(i / steps) * Math.PI;
    const x = Math.max(-limit, Math.min(limit, Math.cos(a) * fp.rx * 1.02));
    arc.push({ x: c.x + x, y: c.y + Math.sin(a) * fp.ry * 1.02, z: 0 });
  }
  // The loop: the back (west -> east), then the arc (east -> over the back -> west)
  const yMid = -(fp.ry + 0.9 * size) / 2;
  return {
    apex: {
      x: c.x + (peakRng() - 0.5) * 0.2 * size,
      y: c.y + Math.max(yMid, -0.8 * size),
      z: M.buildingPeak * size * (0.92 + peakRng() * 0.16),
    },
    base: [...back, ...arc],
  };
}

/** One triangle of a massif in 3D. */
export interface Facet {
  a: P3;
  b: P3;
  c: P3;
  /** Sunlight 0..1 (light from the upper left and above). */
  light: number;
}

const LIGHT = ((): P3 => {
  const v = { x: -0.55, y: -0.45, z: 0.7 };
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
})();

/** Sunlight of a triangle: 0 (facing away) .. 1 (facing the sun). */
export function facetLight(a: P3, b: P3, c: P3): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  if (nz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return Math.max(0, (nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z) / l);
}

/**
 * The facets of a massif, back to front: an upper ring from the peak to a shoulder halfway down
 * every slope, a lower ring from the shoulders to the foot. The shoulders are raised or lowered
 * a little, so the faces break like real rock.
 */
export function massifFacets(plan: MassifPlan, size: number, rng: () => number): Facet[] {
  const { apex, base } = plan;
  const shoulders = base.map((b) => {
    const k = 0.5 + (rng() - 0.5) * 0.16;
    const z = apex.z + (b.z - apex.z) * k + (rng() - 0.5) * 2 * M.shoulderBump * size;
    return {
      x: apex.x + (b.x - apex.x) * k + (rng() - 0.5) * 2 * M.shoulderShift * size,
      y: apex.y + (b.y - apex.y) * k + (rng() - 0.5) * M.shoulderShift * size,
      z: Math.max(b.z + 0.05 * size, Math.min(apex.z - 0.1 * size, z)),
    };
  });
  const facets: Facet[] = [];
  const n = base.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const tri = (a: P3, b: P3, c: P3): void => {
      facets.push({ a, b, c, light: facetLight(a, b, c) });
    };
    tri(apex, shoulders[i], shoulders[j]);
    tri(shoulders[i], base[i], base[j]);
    tri(shoulders[i], base[j], shoulders[j]);
  }
  // Painter's order: faces further back (smaller ground y) first
  const key = (f: Facet): number => Math.max(f.a.y, f.b.y, f.c.y) + (f.a.y + f.b.y + f.c.y) / 3;
  return facets.sort((a, b) => key(a) - key(b));
}

// ---------------------------------------------------------------------------------------------
// Terraces
// ---------------------------------------------------------------------------------------------

/**
 * The front edge of the terrace under a building (relative to the tile center): the middle part
 * of the front of its footprint ellipse (`span` = share of the lower half), from the right to the
 * left (`n` + 1 points), kept inside the hex. Toward the sides the terrace runs out into the slope.
 */
export function terraceArc(fp: FootprintShape, size: number, span = 0.62, n = 10): Point[] {
  const pts: Point[] = [];
  const limit = 0.93 * (Math.sqrt(3) / 2) * size;
  const all = [true, true, true, true, true, true];
  const from = ((1 - span) / 2) * Math.PI;
  for (let i = 0; i <= n; i++) {
    const a = from + (i / n) * span * Math.PI;
    let p = { x: Math.cos(a) * fp.rx, y: Math.sin(a) * fp.ry };
    // Pull points that would leave the hex back toward the center
    const d = distanceToEdges(p, all, size);
    const margin = (Math.sqrt(3) / 2) * size - limit;
    if (d < margin) {
      const r = Math.hypot(p.x, p.y) || 1;
      const k = Math.max(0, (r - (margin - d)) / r);
      p = { x: p.x * k, y: p.y * k };
    }
    pts.push(p);
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Roads (the terrain keeps its trees, shrubs and rocks off them)
// ---------------------------------------------------------------------------------------------

/**
 * Per tile: bit e (0..5) = a road leaves the tile center across edge e, bit 6 = the tile has a
 * road (or a road ends at its building). 0 = no road.
 */
export function roadMasks(map: MapState, roads: RoadGeometry): number[] {
  const masks = new Array<number>(map.tiles.length).fill(0);
  const link = (a: number, b: number): void => {
    const ha = hexAtIndex(map, a);
    for (let e = 0; e < 6; e++) {
      if (mapEdgeNeighborIndex(map, ha, e) === b) masks[a] |= (1 << e) | 64;
    }
  };
  for (const [a, b] of roads.segments) {
    link(a, b);
    link(b, a);
  }
  for (const s of roads.stubs) masks[s] |= 64;
  return masks;
}

/**
 * Distance of `p` (relative to the tile center) to the road of a tile with `mask` (Infinity
 * without a road): to the lines from the center to the middle of every road edge, or to the
 * center for a lone road tile.
 */
export function roadDistance(p: Point, mask: number, size: number): number {
  if (mask === 0) return Infinity;
  let best = Math.hypot(p.x, p.y);
  const reach = (Math.sqrt(3) / 2) * size;
  for (let e = 0; e < 6; e++) {
    if (!(mask & (1 << e))) continue;
    const a = (Math.PI / 3) * e;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const along = Math.max(0, Math.min(reach, p.x * dx + p.y * dy));
    best = Math.min(best, Math.hypot(p.x - dx * along, p.y - dy * along));
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Shading textures (pixels; terrainLayer.ts turns them into PixiJS textures)
// ---------------------------------------------------------------------------------------------

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Premultiplied RGBA pixels (n x n) of a soft round spot: white, fully opaque in the middle,
 * fading smoothly to transparent at the rim. Tinted, it paints soft shadows and glows.
 */
export function softSpotPixels(n: number): Uint8Array {
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = ((x + 0.5) / n) * 2 - 1;
      const v = ((y + 0.5) / n) * 2 - 1;
      const r2 = u * u + v * v;
      const a = r2 >= 1 ? 0 : (1 - r2) * (1 - r2);
      const k = Math.round(a * 255);
      const i = (y * n + x) * 4;
      px[i] = k;
      px[i + 1] = k;
      px[i + 2] = k;
      px[i + 3] = k;
    }
  }
  return px;
}

/**
 * Premultiplied RGBA pixels (n x n) of the shading of a hill mound, mapped onto the mound's
 * bounding box: brightest at the upper left (the sun), darker toward the lower right, opaque at
 * the top and fading out toward the front of the base and the feet, so the mound eases into the
 * ground around it. Tinted with the mound's lit color.
 */
export function moundShadePixels(n: number): Uint8Array {
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      const s = (u - 0.42) * 1.25 + (v - 0.3) * 0.75;
      const lum = 1 - 0.42 * smoothstep(-0.45, 0.75, s);
      const a = smoothstep(1, 0.6, v) * smoothstep(0, 0.12, u) * smoothstep(1, 0.88, u);
      const i = (y * n + x) * 4;
      const k = Math.round(lum * a * 255);
      px[i] = k;
      px[i + 1] = k;
      px[i + 2] = k;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/**
 * Premultiplied RGBA pixels (n x n) of the shading of a rock face, mapped onto the face's
 * bounding box: opaque, a little lighter at the top and darker toward its foot (where less sky
 * light reaches). Tinted with the face's color.
 */
export function faceShadePixels(n: number): Uint8Array {
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      const lum = 1 - 0.2 * v * v - 0.05 * u;
      const i = (y * n + x) * 4;
      const k = Math.round(lum * 255);
      px[i] = k;
      px[i + 1] = k;
      px[i + 2] = k;
      px[i + 3] = 255;
    }
  }
  return px;
}
