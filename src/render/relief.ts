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
import {
  distanceToEdges,
  edgeWave,
  isWater,
  smoothNoise,
  tileRng,
  WAVE_SEGMENTS,
  type FootprintShape,
} from './terrain';
import { theme } from './theme';

const P = theme.terrainPaint;
const H = theme.terrainPaint.hills;
const M = theme.terrainPaint.mountains;
const CUT = theme.terrainPaint.cuts;

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

/**
 * The terrain details are painted in slices: every map row has a back slice (ground points above
 * its tile centers, slice 2 * row) and a front slice (at or below them, slice 2 * row + 1). The
 * back slice sorts before the buildings of its row, the front slice after them and before the
 * row below, so trees, mountains and buildings all draw back to front by their ground point.
 */
export function sliceDepthKey(slice: number): number {
  const row = Math.floor(slice / 2);
  return slice % 2 === 0 ? rowDepthKey(row) : depthKey({ q: 0, r: row }) + 2047;
}

/** Slice of a ground point at world y (clamped to the map's `height` rows). */
export function sliceOfY(y: number, size: number, height: number): number {
  const rowStep = 1.5 * size;
  const row = Math.max(0, Math.min(height - 1, Math.round(y / rowStep)));
  const slice = 2 * row + (y >= row * rowStep ? 1 : 0);
  return Math.max(0, Math.min(2 * height - 1, slice));
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
 * Does the mound fit? Its base must lie on `baseOn` terrain, its upper part on land, everything
 * stays clear of the beach (`shoreDist` = distance of a world point to the nearest shore of the
 * tile it lies in, Infinity inland), and its crest keeps off every road corridor.
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
  return clearOfCorridors(map, m, size);
}

/** Small moves tried before a mound that does not fit is shrunk (hex sizes). */
const NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 0.07],
  [0, -0.07],
  [0.07, 0],
  [-0.07, 0],
];

/**
 * Fits a mound: at full size it may move a little to find room between the corridors, then it
 * shrinks (up to 4 steps); null if it never fits.
 */
function fitMound(
  map: MapState,
  m: HillMound,
  size: number,
  shoreDist: (p: Point) => number,
  baseOn: readonly TerrainId[],
): HillMound | null {
  let cur = m;
  for (let i = 0; i < 5; i++) {
    for (const [dx, dy] of i === 0 ? NUDGES : NUDGES.slice(0, 1)) {
      const moved = { ...cur, x: cur.x + dx * size, y: cur.y + dy * size };
      if (moundFits(map, moved, size, shoreDist, baseOn)) return moved;
    }
    cur = { ...cur, w: cur.w * 0.86, h: cur.h * 0.84 };
    if (cur.w < 0.16 * size) return null;
  }
  return null;
}

/** Every road corridor of a tile and its center (a mask for `roadDistance`). */
const ALL_CORRIDORS = 127;

/**
 * The road corridors: on every tile the lines from its center to the middle of each edge (where
 * a road runs once it is built). No mound crest comes closer than `corridorBand` to them, nor
 * closer than `saddleRadius` to a tile center (a unit stands there), so the roads always run
 * through valleys and over saddles, never over a hill.
 */
function clearOfCorridors(map: MapState, m: HillMound, size: number): boolean {
  const band = H.corridorBand * size;
  const saddle = H.saddleRadius * size;
  for (const p of crestPoints(m)) {
    const h = pixelToHex(p, size);
    if (tileIndex(map, h) < 0) continue;
    const c = hexToPixel(h, size);
    const rel = { x: p.x - c.x, y: p.y - c.y };
    if (Math.hypot(rel.x, rel.y) < saddle) return false;
    if (roadDistance(rel, ALL_CORRIDORS, size) < band) return false;
  }
  return true;
}

/** Points spread over a mound's crest (see `onMoundCrest`): four per column of its outline. */
function crestPoints(m: HillMound): Point[] {
  const outline = moundOutline(m);
  const pts: Point[] = [];
  for (let i = 0; i <= MOUND_SEGMENTS; i++) {
    const top = outline[i];
    const rise = m.y - top.y;
    if (rise < H.crestShare * m.h) continue;
    for (const f of [0, 1 / 3, 2 / 3, 1]) pts.push({ x: top.x, y: top.y + rise * f });
  }
  return pts;
}

/** Top of a mound's drawn outline at x (world px), null beyond its feet. */
export function moundTopAt(
  m: HillMound,
  x: number,
  outline: readonly Point[] = moundOutline(m),
): number | null {
  const t = (x - m.x) / m.w;
  if (!(t >= -1 && t <= 1)) return null;
  const f = ((t + 1) / 2) * MOUND_SEGMENTS;
  const i = Math.min(MOUND_SEGMENTS - 1, Math.floor(f));
  return outline[i].y + (outline[i + 1].y - outline[i].y) * (f - i);
}

/**
 * Is `p` on the crest of mound `m`: inside its body above the base line, where the mound rises
 * to at least `crestShare` of its height? Its low feet and the front of its base do not count
 * (a road may run along them). `outline`: the mound's outline, if already known.
 */
export function onMoundCrest(
  m: HillMound,
  p: Point,
  outline: readonly Point[] = moundOutline(m),
): boolean {
  const top = moundTopAt(m, p.x, outline);
  if (top === null || m.y - top < H.crestShare * m.h) return false;
  return p.y >= top && p.y <= m.y;
}

/** Odd corners (1, 3, 5) have an edge running straight up from them, even ones straight down. */
function upCorner(corner: number): boolean {
  return corner % 2 === 1;
}

/**
 * The mound on hex corner `corner` of `h`, where three hill (or mountain) tiles meet: the same
 * whichever of the three tiles asks. The corridors between the three tile centers form a
 * triangle around the corner. Below a corner with an edge running down from it that triangle is
 * wide at the bottom, like a mound: a big one, its base well below the corner. Around a corner
 * with an edge running up the triangle is wide at the top: a smaller mound just below the corner.
 */
export function cornerMound(h: Hex, corner: number, size: number): HillMound {
  const o = cornerOwner(h, corner);
  const rng = tileRng(o.hex.q, o.hex.r, 640 + o.corner);
  const p = cornerPoint(h, corner, size);
  const j = (v: number): number => 1 + (rng() - 0.5) * 2 * v;
  const up = upCorner(corner);
  return {
    x: p.x + (rng() - 0.5) * 2 * H.cornerJitter * size,
    y: p.y + ((up ? H.upCornerDrop : H.cornerDrop) + (rng() - 0.5) * H.cornerJitter) * size,
    w: (up ? H.upCornerW : H.cornerW) * size * j(H.jitter),
    h: (up ? H.upCornerH : H.cornerH) * size * j(H.jitter),
    tone: 0,
  };
}

/**
 * The mound on the edge between `h` and its neighbor across `edge`, near one end of it (`end`
 * 0 = corner `edge`, 1 = corner `edge + 1`), where a tile of other terrain meets the two: it
 * straddles their edge so the two hill tiles join, and stays off the corridor that crosses the
 * middle of the edge. The same whichever of the two tiles asks.
 */
export function joinMound(h: Hex, edge: number, end: 0 | 1, size: number): HillMound {
  const nb = edgeNeighborHex(h, edge);
  const own = before(h, nb);
  const base = own ? h : nb;
  const baseEdge = own ? edge : (edge + 3) % 6;
  // Corner `edge` of h is the far end (corner edge + 4) of the neighbor's edge
  const baseEnd = own ? end : 1 - end;
  const rng = tileRng(base.q, base.r, 610 + baseEdge * 2 + baseEnd);
  const near = cornerPoint(base, (baseEdge + baseEnd) % 6, size);
  const far = cornerPoint(base, (baseEdge + 1 - baseEnd) % 6, size);
  const t = H.joinT * (1 + (rng() - 0.5) * 0.5);
  const j = (v: number): number => 1 + (rng() - 0.5) * 2 * v;
  return {
    x: near.x + (far.x - near.x) * t,
    y: near.y + (far.y - near.y) * t + (rng() - 0.5) * 0.04 * size,
    w: H.joinW * size * j(H.jitter),
    h: H.joinH * size * j(H.jitter),
    tone: 0,
  };
}

/** Terrain a mound joining hill tiles may stand on (foothills run under the mountain massifs). */
const HILL_LIKE: readonly TerrainId[] = ['hills', 'mountains'];

function hillLike(t: TerrainId | null): boolean {
  return t === 'hills' || t === 'mountains';
}

/**
 * All hill mounds of the map, back to front (by base y). The road corridors of every tile (from
 * its center to the middle of each edge) stay valleys: the mounds sit in the six sectors between
 * them, toward the corners, and the tile center is a low saddle where units stand. Per corner
 * of a hill tile:
 * - three hill (or mountain) tiles meet there: one mound on the shared corner;
 * - only one neighbor is a hill (or mountain): a mound on their shared edge near the corner, so
 *   the two tiles join (toward a mountain it is a foothill that runs under the massif);
 * - no neighbor is: a smaller mound inside the tile toward the corner;
 * and most corners get a shoulder: a smaller mound in the tile's own sector toward it.
 * Now and then a low mound spills into a neighboring meadow near a corner. Mounds that do not fit
 * shrink or are left out (never on water or the beach, never with their foot on other terrain,
 * never with their crest over a road corridor).
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
    const add = (m: HillMound, baseOn: readonly TerrainId[] = ['hills']): void => {
      const fit = fitMound(map, { ...m, tone: tone(m.x, m.y, rng()) }, size, shoreDist, baseOn);
      if (fit) out.push(fit);
    };
    for (let k = 0; k < 6; k++) {
      const a = edgeNeighborHex(hex, k); // shares corners k and k + 1
      const b = edgeNeighborHex(hex, (k + 5) % 6); // shares corners k - 1 and k
      const ta = terrainOf(map, a);
      const tb = terrainOf(map, b);
      if (hillLike(ta) && hillLike(tb)) {
        // The first hill tile around the corner adds it
        if ((ta === 'hills' && before(a, hex)) || (tb === 'hills' && before(b, hex))) continue;
        if (tileRng(hex.q, hex.r, 605 + k)() < H.cornerChance)
          add(cornerMound(hex, k, size), HILL_LIKE);
      } else if (hillLike(ta) || hillLike(tb)) {
        const edge = hillLike(ta) ? k : (k + 5) % 6;
        const other = hillLike(ta) ? a : b;
        if (terrainOf(map, other) === 'hills' && before(other, hex)) continue;
        add(joinMound(hex, edge, edge === k ? 0 : 1, size), HILL_LIKE);
      }
      // In the tile's own sector toward the corner: a smaller mound between the corner and the
      // center (a shoulder in front of or behind the corner mound; alone at a lone corner, where
      // it may ease out into a meadow beyond)
      const lone = !hillLike(ta) && !hillLike(tb);
      const srng = tileRng(hex.q, hex.r, 650 + k);
      if (!lone && srng() >= H.shoulderChance) continue;
      const angle = (Math.PI / 3) * k - Math.PI / 6;
      const d = H.sectorDist * size * (1 + (srng() - 0.5) * 0.2);
      const j = (v: number): number => 1 + (srng() - 0.5) * 2 * v;
      const f = lone ? 1 : H.shoulderShare;
      add(
        {
          x: c.x + Math.cos(angle) * d,
          y: c.y + Math.sin(angle) * d,
          w: H.sectorW * f * size * j(H.jitter),
          h: H.sectorH * f * size * j(H.jitter),
          tone: 0,
        },
        lone ? ['hills', 'plains'] : ['hills'],
      );
    }
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(map, hex, e);
      if (n < 0 || map.tiles[n] !== 'plains') continue;
      // Now and then a low mound spills over into the meadow near one end of the edge
      const srng = tileRng(hex.q, hex.r, 630 + e);
      if (srng() >= P.spillMoundChance) continue;
      const corners = hexCorners(c, size);
      const a = corners[e];
      const b = corners[(e + 1) % 6];
      const t = srng() < 0.5 ? 0.15 + srng() * 0.12 : 0.73 + srng() * 0.12;
      const ex = a.x + (b.x - a.x) * t;
      const ey = a.y + (b.y - a.y) * t;
      const len = Math.hypot(c.x - ex, c.y - ey) || 1;
      const f = -0.1 * size;
      add(
        {
          x: ex + ((c.x - ex) / len) * f,
          y: ey + ((c.y - ey) / len) * f + 0.04 * size,
          w: (0.24 + srng() * 0.08) * size,
          h: (0.11 + srng() * 0.05) * size,
          tone: 1,
        },
        ['plains', 'hills'],
      );
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Segments of a mound's upper outline (`moundOutline`). */
const MOUND_SEGMENTS = 12;

/**
 * Upper outline of a mound from its left foot over the crest to its right foot
 * (MOUND_SEGMENTS + 1 points), then the front of its base back to the left foot: a closed shape
 * (world px).
 */
export function moundOutline(m: HillMound): Point[] {
  const n = MOUND_SEGMENTS;
  const pts: Point[] = [];
  const d = moundDepth(m);
  // Every mound a little different: crest shifted to one side, rounder or flatter; the feet
  // run out low and wide, so neighboring mounds flow into each other
  const rng = tileRng(Math.round(m.x * 4), Math.round(m.y * 4), 670);
  const skew = (rng() - 0.5) * 0.5;
  const power = 1.5 + rng() * 0.8;
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
 * mountains (inside a range), at cliff height where a mountain meets the sea, else on the ground.
 * The same for all three tiles.
 */
export function cornerHeight(map: MapState, h: Hex, corner: number, size: number): number {
  const tiles = [h, edgeNeighborHex(h, corner), edgeNeighborHex(h, (corner + 5) % 6)].map((t) =>
    terrainOf(map, t),
  );
  const o = cornerOwner(h, corner);
  const rng = tileRng(o.hex.q, o.hex.r, 720 + o.corner);
  const v = rng();
  if (tiles.every((t) => t === 'mountains'))
    return (M.cornerMin + v * (M.cornerMax - M.cornerMin)) * size;
  // A mountain corner on the coast: the top of the cliff that drops into the sea there
  const mountain = tiles.some((t) => t === 'mountains');
  const water = tiles.some((t) => t !== null && isWater(t));
  if (mountain && water) {
    const [lo, hi] = M.coastCorner;
    return (lo + v * (hi - lo)) * size;
  }
  return 0;
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
 * A cliff where a mountain drops into the sea, on an edge facing the viewer: its top runs along
 * the massif's foot at the shore (corner, middle, corner; raised), its foot along the waterline
 * (the tile's wavy shore, at water level).
 */
export interface CoastCliff {
  top: P3[];
  water: Point[];
}

/** Edges whose cliff face can be seen (their outward normal points down the screen). */
export const FRONT_EDGES: readonly number[] = [1, 2];
const SIDE_EDGES: readonly number[] = [0, 3];

/** The 12 foot points of a mountain tile (corner e at 2e, middle of edge e at 2e + 1). */
function footLoop(map: MapState, h: Hex, size: number): P3[] {
  const c = hexToPixel(h, size);
  const corners = hexCorners(c, size);
  const rng = tileRng(h.q, h.r, 730);
  const coastRng = tileRng(h.q, h.r, 735);
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
  const loop: P3[] = [];
  for (let e = 0; e < 6; e++) {
    const jitter = (rng() - 0.5) * 0.08;
    if (mountain(e - 1) || mountain(e) || water(e - 1) || water(e)) {
      // Shared with a mountain neighbor, or on the coast: right on the hex corner
      const p = cornerPoint(h, e, size);
      loop.push({ ...p, z: cornerHeight(map, h, e, size) });
    } else {
      loop.push(inset(corners[e], M.footInset + jitter));
    }
    const a = corners[e];
    const b = corners[(e + 1) % 6];
    const midJitter = (rng() - 0.5) * 0.1;
    const cliff = coastRng();
    if (mountain(e)) {
      loop.push(ridgeSaddle(h, e, size));
    } else if (water(e)) {
      // On the shoreline (the middle of the wavy shore), at the top of the cliff
      const wave = edgeWave(h, e, P.shoreWave * size)[WAVE_SEGMENTS / 2];
      const out = { x: Math.cos((Math.PI / 3) * e), y: Math.sin((Math.PI / 3) * e) };
      const [lo, hi] = FRONT_EDGES.includes(e)
        ? M.coastFront
        : SIDE_EDGES.includes(e)
          ? M.coastSide
          : M.coastBack;
      loop.push({
        x: (a.x + b.x) / 2 + out.x * (wave - 0.5),
        y: (a.y + b.y) / 2 + out.y * (wave - 0.5),
        z: (lo + cliff * (hi - lo)) * size,
      });
    } else {
      loop.push(inset({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, M.footInset + midJitter));
    }
  }
  return loop;
}

/** Cliffs into the sea on the tile's water edges that face the viewer. */
export function coastCliffs(map: MapState, h: Hex, size: number): CoastCliff[] {
  const loop = footLoop(map, h, size);
  const c = hexToPixel(h, size);
  const corners = hexCorners(c, size);
  const out: CoastCliff[] = [];
  for (const e of FRONT_EDGES) {
    const t = terrainOf(map, edgeNeighborHex(h, e));
    if (t === null || !isWater(t)) continue;
    const offsets = edgeWave(h, e, P.shoreWave * size);
    const n = { x: Math.cos((Math.PI / 3) * e), y: Math.sin((Math.PI / 3) * e) };
    const a = corners[e];
    const b = corners[(e + 1) % 6];
    const water = offsets.map((w, i) => {
      const u = i / WAVE_SEGMENTS;
      return { x: a.x + (b.x - a.x) * u + n.x * w, y: a.y + (b.y - a.y) * u + n.y * w };
    });
    out.push({ top: [loop[2 * e], loop[2 * e + 1], loop[(2 * e + 2) % 12]], water });
  }
  return out;
}

/**
 * The massif of a mountain tile. Its foot runs around the tile: at edges toward other mountain
 * tiles along the shared corners and saddle (so the slopes of both tiles meet there), toward the
 * sea right on the shore at the top of a cliff, else a bit inside the tile. With a building
 * (`fp`) the massif sits at the back of the tile, so the building stands at the foot of its
 * peak; a mine or quarry instead cuts into a whole massif whose flanks wrap around it (several
 * plans: the main massif first, then the flanks).
 */
export function massifPlans(
  map: MapState,
  h: Hex,
  size: number,
  fp: FootprintShape | null,
): MassifPlan[] {
  const c = hexToPixel(h, size);
  const loop = footLoop(map, h, size);
  const peakRng = tileRng(h.q, h.r, 731);
  // Whole ranges higher or lower (smooth noise), each peak a little different
  const high = smoothNoise(c.x / (6 * size), c.y / (6 * size), 21) * 0.65 + peakRng() * 0.35;
  const peak = (M.peakMin + high * (M.peakMax - M.peakMin)) * size;
  if (fp?.kind === 'mineCut' || fp?.kind === 'quarryCut') {
    return cutMassifPlans(c, loop, fp.kind, peak, peakRng, size);
  }
  if (!fp) {
    return [
      {
        apex: {
          x: c.x + (peakRng() - 0.5) * 0.24 * size,
          y: c.y + (-0.04 + (peakRng() - 0.5) * 0.16) * size,
          z: peak,
        },
        base: loop,
      },
    ];
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
  return [
    {
      apex: {
        x: c.x + (peakRng() - 0.5) * 0.2 * size,
        y: c.y + Math.max(yMid, -0.8 * size),
        z: M.buildingPeak * size * (0.92 + peakRng() * 0.16),
      },
      base: [...back, ...arc],
    },
  ];
}

/** The main massif of a mountain tile (see `massifPlans`). */
export function massifPlan(
  map: MapState,
  h: Hex,
  size: number,
  fp: FootprintShape | null,
): MassifPlan {
  return massifPlans(map, h, size, fp)[0];
}

// ---------------------------------------------------------------------------------------------
// Mine and quarry cuts (the geometry is a contract with the art: theme.terrainPaint.cuts)
// ---------------------------------------------------------------------------------------------

/** World px per art world unit (the art's canvas scale times its iso factor). */
function artUnit(size: number): number {
  return ((0.92 * Math.sqrt(3) * size) / 208) * CUT.artScale;
}

/**
 * A point of the art's world (a, b = its two ground axes, z = height, art units, around the tile
 * center `c`) as a landscape point: a runs to the screen lower right, b to the lower left.
 */
export function artPoint(c: Point, a: number, b: number, z: number, size: number): P3 {
  const k = artUnit(size);
  return { x: c.x + k * (a - b), y: c.y + (k * (a + b)) / 2, z: k * CUT.artHeight * z };
}

/**
 * Where the mine's scene stands (docs/ART.md "Mine at the mountain's foot"): its anchor relative
 * to the tile center (world px) and its scale. The drawn works (economyLayers.ts), the cut face
 * and the ledge all use this one transform, so they stay aligned with each other.
 */
export function mineArtTransform(size: number): { x: number; y: number; scale: number } {
  return { x: 0, y: CUT.mineShift * size, scale: CUT.mineScale };
}

/** Like `artPoint`, but for the mine's scene: moved and scaled by `mineArtTransform`. */
export function mineArtPoint(c: Point, a: number, b: number, z: number, size: number): P3 {
  const t = mineArtTransform(size);
  const p = artPoint({ x: 0, y: 0 }, a, b, z, size);
  return { x: c.x + t.x + p.x * t.scale, y: c.y + t.y + p.y * t.scale, z: p.z * t.scale };
}

/** The mine's rock face and the front of the massif's foot on its tile. */
export interface MineCut {
  /** The face as one outline: left run-out, foot line, right run-out, top line (6 points). */
  face: P3[];
  /** Foot of the face (left, right) and its top (left, right). */
  foot: [P3, P3];
  top: [P3, P3];
  /** Front of the massif's foot, east to west: right run-out, face top right / left, left run-out. */
  front: P3[];
}

/** The mine cut on the tile centered at `c` (theme cuts.face*, moved to the mountain's foot). */
export function mineCut(c: Point, size: number): MineCut {
  const [a0, a1] = CUT.faceA;
  const b = CUT.faceB;
  const h = CUT.faceH;
  const [ra, rb] = CUT.faceRunOut;
  const at = (a: number, bb: number, z: number): P3 => mineArtPoint(c, a, bb, z, size);
  const footL = at(a0, b, 0);
  const footR = at(a1, b, 0);
  const topL = at(a0, b, h);
  const topR = at(a1, b, h);
  const runR = at(a1 + ra, b + rb, 0);
  const runL = at(a0 - ra, b - rb, 0);
  return {
    face: [runL, footL, footR, runR, topR, topL],
    foot: [footL, footR],
    top: [topL, topR],
    front: [runR, topR, topL, runL],
  };
}

/** One quarry step: its front face (facing +b), flat top and right end face (facing +a). */
export interface QuarryStep {
  front: P3[];
  top: P3[];
  end: P3[];
}

/** The quarry's steps (back to front) and the front of the foot of what stands behind them. */
export interface QuarryCut {
  /** Back to front: the highest step first. */
  steps: QuarryStep[];
  /** East to west: right run-out, the top back corners of the right ends, then down the left side. */
  front: P3[];
}

/** The quarry cut on the tile centered at `c` (theme cuts.steps). */
export function quarryCut(c: Point, size: number): QuarryCut {
  const at = (a: number, b: number, z: number): P3 => artPoint(c, a, b, z, size);
  const steps: QuarryStep[] = [];
  let z0 = 0;
  for (const [a0, a1, bf, bb, zt] of CUT.steps) {
    steps.push({
      front: [at(a0, bf, z0), at(a1, bf, z0), at(a1, bf, zt), at(a0, bf, zt)],
      top: [at(a0, bf, zt), at(a1, bf, zt), at(a1, bb, zt), at(a0, bb, zt)],
      end: [at(a1, bf, z0), at(a1, bb, z0), at(a1, bb, zt), at(a1, bf, zt)],
    });
    z0 = zt;
  }
  const first = CUT.steps[0];
  const last = CUT.steps[CUT.steps.length - 1];
  const front: P3[] = [at(first[1] + 15, first[2] + 2, 0)];
  for (const [, a1, , bb, zt] of CUT.steps) front.push(at(a1, bb, zt));
  // Top back corner on the left, then the slope runs down the left side to the ground in front
  const [a0, , , bb, zt] = last;
  front.push(at(a0, bb, zt));
  front.push(at(a0 - 2, bb + 8, zt - 3), at(a0 - 5, -18, zt * 0.45), at(a0 - 7, first[2] + 4, 0));
  return { steps: steps.reverse(), front };
}

/** Where the peak of a cut tile may stand (hex sizes from the tile center), first choice first. */
const MINE_PEAKS: readonly (readonly [number, number])[] = [
  [0.02, -0.06],
  [0.06, -0.14],
  [-0.04, -0.14],
  [0.04, -0.24],
];
const QUARRY_PEAKS: readonly (readonly [number, number])[] = [
  [0.36, -CUT.peakBack],
  [0.3, -0.44],
  [0.3, -0.38],
  [0.26, -0.34],
];

/**
 * The niche of a mine or quarry: the works stand in it, the mountain wraps around it. A back wall
 * (the cut face, as high as it), two side walls running forward to the front of the tile
 * (symmetric about the niche's axis; their tops lean outward and get lower toward the front),
 * the scree floor between them and the ridge points where the flanks meet the main massif.
 */
export interface Niche {
  /** Back wall: foot (left, right) on the ground, top (left, right). */
  backFoot: [P3, P3];
  backTop: [P3, P3];
  /** Side walls at their front ends: foot (left, right) and top (left, right). */
  frontFoot: [P3, P3];
  frontTop: [P3, P3];
  /** The niche's axis (x, world px): the walls are mirror images about it. */
  axis: number;
  /** Ridge points where the left / right flank meets the main massif, and the flank peaks. */
  joins: [P3, P3];
  peaks: [P3, P3];
}

function niche(c: Point, backFoot: [P3, P3], backTop: [P3, P3], axis: number, size: number): Niche {
  const half = CUT.nicheFrontHalf * size;
  const y = c.y + CUT.nicheFrontY * size;
  const h = CUT.nicheFrontH * size;
  const lean = CUT.nicheLean * size;
  const at = (v: readonly number[], z: number): P3 => ({
    x: c.x + v[0] * size,
    y: c.y + v[1] * size,
    z,
  });
  const fh = CUT.flankH * size;
  return {
    backFoot,
    backTop,
    frontFoot: [
      { x: axis - half, y, z: 0 },
      { x: axis + half, y, z: 0 },
    ],
    frontTop: [
      { x: axis - half - lean, y, z: h },
      { x: axis + half + lean, y, z: h },
    ],
    axis,
    joins: [
      at(CUT.nicheJoinLeft, CUT.nicheJoinH * size),
      at(CUT.nicheJoinRight, CUT.nicheJoinH * size),
    ],
    peaks: [
      { x: axis - CUT.flankHalf * size, y: c.y + CUT.flankY * size, z: fh },
      { x: axis + CUT.flankHalf * size, y: c.y + CUT.flankY * size, z: fh },
    ],
  };
}

/** The niche of the quarry on the tile centered at `c`: in front of its lowest step. */
export function quarryNiche(c: Point, size: number): Niche {
  const [a0, a1, bf, , zt] = CUT.steps[0];
  return niche(
    c,
    [artPoint(c, a0, bf, 0, size), artPoint(c, a1, bf, 0, size)],
    [artPoint(c, a0, bf, zt, size), artPoint(c, a1, bf, zt, size)],
    artPoint(c, (a0 + a1) / 2, bf, 0, size).x,
    size,
  );
}

/**
 * The massifs of a mine or quarry tile: the main massif with the peak behind the cut (its foot
 * runs along the back and the sides of the tile, with the shared saddles and corners toward the
 * mountain neighbors, and in front along the top of the cut), plus a left and a right flank that
 * reach forward on both sides of the niche to the front of the tile (`loop` = the 12 foot points
 * of the plain massif: corner e at 2e, the middle of edge e at 2e + 1).
 */
function cutMassifPlans(
  c: Point,
  loop: readonly P3[],
  kind: 'mineCut' | 'quarryCut',
  peak: number,
  rng: () => number,
  size: number,
): MassifPlan[] {
  const jitter = (rng() - 0.5) * 0.06 * size;
  const shared = (p: P3): boolean =>
    p.z > 0 || Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - size) < 1e-6;
  const fan = (apex: P3, base: P3[]): MassifPlan | null => {
    const keep: number[] = [0];
    base.forEach((p, i) => {
      if (shared(p)) keep.push(i);
    });
    const plan = { apex, base: starShaped(apex, base, keep) };
    return isStarShaped(plan.apex, plan.base) ? plan : null;
  };
  if (kind === 'mineCut') return mineMassifPlans(c, loop, peak, jitter, fan, size);
  const n = quarryNiche(c, size);
  const [joinL, joinR] = n.joins;
  const [backL, backR] = n.backTop;
  // The top of the cut from east to west: the step outline, then down the left side
  const q = quarryCut(c, size);
  // front: run-out, the right-end top corners (steps 1..3), top back left, then the left side
  const [, c1, c2, c3, c4, lb] = q.front;
  const cutTop = [c1, c2, c3, c4, lb];
  const rightSide = [backR, c1];
  const leftSide = [lb, backL];
  // Main massif: east middle, its join with the right flank, the cut, the join with the left
  // flank, then over the back (upper left .. upper right corner)
  const mainBase = [
    loop[1],
    joinR,
    ...cutTop,
    joinL,
    loop[8],
    loop[9],
    loop[10],
    loop[11],
    loop[0],
  ];
  let main: MassifPlan | null = null;
  for (const [dx, dy] of QUARRY_PEAKS) {
    const apex = { x: c.x + dx * size + jitter, y: c.y + dy * size, z: peak * CUT.peakFactor };
    main = fan(apex, mainBase);
    if (main) break;
  }
  if (!main) {
    const apex = { x: c.x + jitter, y: c.y - CUT.peakBack * size, z: peak * CUT.peakFactor };
    main = { apex, base: starShaped(apex, mainBase, []) };
  }
  // Flanks (left skipped / right skipped if they would fold, e.g. squeezed by the coast)
  const [peakL, peakR] = n.peaks;
  const [topL, topR] = n.frontTop;
  const right = fan(peakR, [loop[1], loop[2], topR, ...rightSide, joinR]);
  const left = fan(peakL, [joinL, ...leftSide, topL, loop[6], loop[7], loop[8]]);
  return [main, ...(left ? [left] : []), ...(right ? [right] : [])];
}

/**
 * A mine tile: a whole mountain with its peak near the tile center (like an unbuilt one, all
 * shared saddles and corners around the back and the sides) whose front foot is the cut face at
 * the front of the tile. Toward a mountain (or the coast) on a front edge a small flank joins
 * the face's side to that edge; nothing else stands in front of the face, only the works.
 */
function mineMassifPlans(
  c: Point,
  loop: readonly P3[],
  peak: number,
  jitter: number,
  fan: (apex: P3, base: P3[]) => MassifPlan | null,
  size: number,
): MassifPlan[] {
  const face = mineCut(c, size);
  const [runR, topR, topL, runL] = face.front;
  // East middle, lower right corner, the face (right run-out, top right, top left, left run-out),
  // lower left corner, west middle, then over the back
  const base = [
    loop[1],
    loop[2],
    runR,
    topR,
    topL,
    runL,
    loop[6],
    loop[7],
    loop[8],
    loop[9],
    loop[10],
    loop[11],
    loop[0],
  ];
  let main: MassifPlan | null = null;
  for (const [dx, dy] of MINE_PEAKS) {
    main = fan({ x: c.x + dx * size + jitter, y: c.y + dy * size, z: peak }, base);
    if (main) break;
  }
  if (!main) {
    const apex = { x: c.x + jitter, y: c.y + MINE_PEAKS[0][1] * size, z: peak };
    main = { apex, base: starShaped(apex, base, []) };
  }
  const plans = [main];
  // Small flanks to a shared middle of a front edge (a saddle toward a mountain, a cliff top)
  const flank = (mid: P3, a: P3, b: P3): void => {
    if (mid.z <= 0) return;
    const apex = {
      x: (mid.x + a.x + b.x) / 3,
      y: (mid.y + a.y + b.y) / 3,
      z: Math.max(mid.z, a.z, b.z),
    };
    const plan = fan(apex, [a, mid, b]);
    if (plan) plans.push(plan);
  };
  flank(loop[3], loop[2], runR);
  flank(loop[5], runL, loop[6]);
  return plans;
}

/**
 * The scree floor of a niche (ground points, clockwise): the back wall's foot, the right wall,
 * a rounded front reaching toward the tile's front edges (inside the hex), the left wall.
 */
export function nicheFloor(c: Point, n: Niche, size: number): Point[] {
  const [bl, br] = n.backFoot;
  const [fl, fr] = n.frontFoot;
  const r = M.footInset * size;
  const front = [60, 75, 90, 105, 120].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
  // Keep the rounded front between the two walls
  const inner = front.filter((p) => p.x > fl.x && p.x < fr.x);
  return [bl, br, fr, ...inner, fl].map((p) => ({ x: p.x, y: p.y }));
}

/** True when `p` lies inside the convex polygon `poly` (either orientation). */
export function insideConvexPolygon(p: Point, poly: readonly Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return poly.length >= 3;
}

/**
 * The part of polygon `poly` inside the convex polygon `clip` (both clockwise on screen):
 * Sutherland-Hodgman clipping. Empty if they do not overlap.
 */
export function clipConvex(poly: readonly Point[], clip: readonly Point[]): Point[] {
  let out: Point[] = [...poly];
  // Orientation of the clip polygon: inside lies on this side of every edge
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: Point): number =>
      sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
  }
  return out;
}

/**
 * Drops foot points (never those in `keep`) until every point lies further clockwise around the
 * apex than the one before, so the faces fanned from the peak never fold over each other.
 */
export function starShaped(apex: Point, base: readonly P3[], keep: readonly number[] = []): P3[] {
  const kept = new Set(keep.map((i) => base[i]));
  const angle = (p: P3): number => Math.atan2(p.y - apex.y, p.x - apex.x);
  const step = (from: P3, to: P3): number => {
    let d = angle(to) - angle(from);
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    return d;
  };
  const out: P3[] = [];
  for (const p of base) {
    if (out.length > 0 && step(out[out.length - 1], p) <= 0) {
      if (!kept.has(p)) continue;
      // A point that has to stay: drop the droppable points before it that are in the way
      while (
        out.length > 1 &&
        !kept.has(out[out.length - 1]) &&
        step(out[out.length - 1], p) <= 0
      ) {
        out.pop();
      }
    }
    out.push(p);
  }
  return out;
}

/** True when the foot points run strictly clockwise once around the apex (no folded faces). */
export function isStarShaped(apex: Point, base: readonly P3[]): boolean {
  let total = 0;
  for (let i = 0; i < base.length; i++) {
    const p = base[i];
    const q = base[(i + 1) % base.length];
    let step = Math.atan2(q.y - apex.y, q.x - apex.x) - Math.atan2(p.y - apex.y, p.x - apex.x);
    while (step <= -Math.PI) step += 2 * Math.PI;
    while (step > Math.PI) step -= 2 * Math.PI;
    if (step <= 0) return false;
    total += step;
  }
  return Math.abs(total - 2 * Math.PI) < 1e-6;
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
