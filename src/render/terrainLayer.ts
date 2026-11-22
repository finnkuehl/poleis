// Painted terrain: built ONCE when the map view is created, never per frame.
// `ground` (one Graphics, flat): tile fills with soft wavy borders where the terrain changes,
//   large color washes that flow across tiles, color bleed between land types, sea blends,
//   beaches, small cliffs, faint outlines, foam, waves and rocks in the surf.
// `details` (a Container with one Graphics per map row, back to front): grass, flowers and
//   pebbles, then hills, peaks, trees and boats. Footprints (see `setFootprints`) clear room for
//   buildings; only the rows they touch are repainted.
// Light comes from the upper left, so shadows fall to the lower right (docs/ART.md).
import { Container, Graphics } from 'pixi.js';
import { hexCorners, hexToPixel, pixelToHex, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { MapState } from '../core/state';
import type { TerrainId } from '../data/terrain';
import {
  edgeOutward,
  mapEdgeNeighborIndex,
  subPolyline,
  wavyInsetLine,
  wavyTileOutline,
} from './geometry';
import {
  distanceToEdges,
  distanceToWavyEdges,
  edgeWave,
  ellipsePoints,
  footprintRowsToRepaint,
  forestTrees,
  hillMounds,
  insideFootprint,
  isWater,
  mountainPeaks,
  smoothNoise,
  taperedStroke,
  tileHash,
  tileRng,
  waveAt,
  WAVE_SEGMENTS,
  type FootprintShape,
  type MoundSpot,
  type PeakSpot,
  type TreeSpot,
} from './terrain';
import { theme } from './theme';

const P = theme.terrainPaint;

/** All six edges (for "keep away from the tile border" checks). */
const ALL_EDGES: readonly boolean[] = [true, true, true, true, true, true];

/** Area around a tile centre (ellipse radii in px) where the terrain draws no standing objects and no decals. */
export interface TileFootprint {
  hex: Hex;
  rx: number;
  ry: number;
}

export interface TerrainLayer {
  /** Flat painted ground (static). */
  ground: Graphics;
  /** Decals and standing objects: one Graphics per map row, painted back to front. */
  details: Container;
  /**
   * Clears room for buildings: decals and standing objects whose ground point lies inside a
   * footprint ellipse (clipped to its hex) are left out. Repaints only the rows that changed;
   * the same footprints again do nothing. [] brings everything back.
   */
  setFootprints(footprints: readonly TileFootprint[]): void;
}

interface Tile {
  index: number;
  hex: Hex;
  terrain: TerrainId;
  center: Point;
  corners: Point[];
  /** Terrain across each edge, null at the map border. */
  across: (TerrainId | null)[];
  /** Edges where land meets water (beach on land, foam on water). */
  shore: boolean[];
  /** Offsets of the wavy edges (null = straight edge: same terrain or map border). */
  waves: (number[] | null)[];
}

/** A filled polygon of a standing object. */
interface Shape {
  poly: number[];
  color: number;
  alpha: number;
}

/** A standing object (tree, mound, peak, shrub, boat) with its ground point in world px. */
interface Standing {
  x: number;
  y: number;
  shadow: number[] | null;
  shadowAlpha: number;
  shapes: Shape[];
}

/** A flat decal (grass tuft, flower, pebble) of one color group, ground point in world px. */
interface Decal {
  x: number;
  y: number;
  group: number;
  poly: number[];
}

interface TilePlan {
  decals: Decal[];
  /** In paint order (back to front within the tile). */
  standing: Standing[];
}

function flat(points: readonly Point[]): number[] {
  const out: number[] = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Points of a quadratic curve from a over control c to b (n segments, a excluded). */
function quadPoints(a: Point, c: Point, b: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    });
  }
  return pts;
}

/** Fills all polygons at once (one draw instruction). */
function fillAll(g: Graphics, polys: readonly number[][], color: number, alpha = 1): void {
  if (polys.length === 0) return;
  for (const p of polys) g.poly(p);
  g.fill({ color, alpha });
}

/** Polygons grouped by color and alpha, filled with one instruction per group. */
class FillGroups {
  private groups = new Map<string, { color: number; alpha: number; polys: number[][] }>();
  add(color: number, alpha: number, poly: number[]): void {
    const key = `${color}:${alpha}`;
    let group = this.groups.get(key);
    if (!group) {
      group = { color, alpha, polys: [] };
      this.groups.set(key, group);
    }
    group.polys.push(poly);
  }
  fill(g: Graphics): void {
    for (const { color, alpha, polys } of this.groups.values()) fillAll(g, polys, color, alpha);
  }
}

/**
 * Strokes all straight lines at once (one draw instruction). Butt caps on purpose: a round
 * cap costs ~30 vertices, a butt-capped line only 4.
 */
function strokeLines(
  g: Graphics,
  lines: readonly (readonly [Point, Point])[],
  style: { color: number; alpha: number; width: number },
): void {
  if (lines.length === 0) return;
  for (const [a, b] of lines) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  g.stroke({ ...style, cap: 'butt' });
}

/** How far the edge between two terrains bulges (fraction of the hex size); 0 = straight. */
function waveAmplitude(a: TerrainId, b: TerrainId): number {
  if (a === b) return 0;
  const wa = isWater(a);
  const wb = isWater(b);
  if (wa !== wb) return P.shoreWave;
  return wa ? P.seaWave : P.landWave;
}

function buildTiles(map: MapState, size: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    const hex = hexAtIndex(map, i);
    const terrain = map.tiles[i];
    const center = hexToPixel(hex, size);
    const across: (TerrainId | null)[] = [];
    const shore: boolean[] = [];
    const waves: (number[] | null)[] = [];
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(map, hex, e);
      const other = n < 0 ? null : map.tiles[n];
      across.push(other);
      shore.push(other !== null && isWater(other) !== isWater(terrain));
      const amp = other === null ? 0 : waveAmplitude(terrain, other);
      waves.push(amp > 0 ? edgeWave(hex, e, amp * size) : null);
    }
    tiles.push({
      index: i,
      hex,
      terrain,
      center,
      corners: hexCorners(center, size),
      across,
      shore,
      waves,
    });
  }
  return tiles;
}

/** Distance of a point (relative to the tile center) to the tile's (curved) shore. */
function shoreDistance(t: Tile, p: Point, size: number): number {
  return distanceToWavyEdges(p, t.shore, t.waves, size);
}

/** Every other point of a line (first and last kept): half the vertices for soft, translucent shapes. */
function coarse(points: readonly Point[]): Point[] {
  return points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
}

/**
 * Band along edge `e` from `d0` to `d1` px inside the tile, following the wavy edge.
 * `mask` says which neighboring edges carry the same band (their bands join at the corner).
 * `coarseOuter` / `coarseInner` sample that side with half the points (fine for translucent
 * bands, where a fraction of a pixel off the exact curve does not show).
 */
function edgeBand(
  t: Tile,
  e: number,
  d0: number,
  d1: number,
  mask: readonly boolean[],
  innerExtra?: readonly number[],
  coarseOuter = false,
  coarseInner = false,
): number[] {
  const offsets = t.waves[e] ?? STRAIGHT;
  const prev = mask[(e + 5) % 6];
  const next = mask[(e + 1) % 6];
  const outer = wavyInsetLine(t.center, t.corners, e, offsets, d0, prev, next);
  const inner = wavyInsetLine(t.center, t.corners, e, offsets, d1, prev, next, 1, innerExtra);
  return flat([
    ...(coarseOuter ? coarse(outer) : outer),
    ...(coarseInner ? coarse(inner) : inner).reverse(),
  ]);
}

const STRAIGHT: readonly number[] = new Array<number>(WAVE_SEGMENTS + 1).fill(0);

/** Per-point extra depth that bulges the inner side of a band a little (0 at both ends). */
function wobble(rng: () => number, amount: number): number[] {
  const extra: number[] = [];
  const c1 = rng() - 0.4;
  const c2 = (rng() - 0.5) * 0.6;
  for (let i = 0; i <= WAVE_SEGMENTS; i++) {
    const u = i / WAVE_SEGMENTS;
    extra.push((c1 * Math.sin(Math.PI * u) + c2 * Math.sin(2 * Math.PI * u)) * 2 * amount);
  }
  return extra;
}

// ---------------------------------------------------------------------------------------------
// Ground (flat, static)
// ---------------------------------------------------------------------------------------------

/** Tile fills: one flat color per terrain, so tiles of the same terrain read as one surface. */
function paintFills(g: Graphics, tiles: readonly Tile[]): void {
  const groups = new FillGroups();
  for (const t of tiles) {
    groups.add(theme.terrainColors[t.terrain], 1, flat(wavyTileOutline(t.corners, t.waves)));
  }
  groups.fill(g);
}

/**
 * Large soft washes: blobs of a lighter or darker tone placed per tile but allowed to flow over
 * edges to neighbors of the same terrain. A smooth noise over the whole map decides the tone,
 * so the variation forms regions across many tiles instead of a per-tile patchwork.
 */
function paintWashes(g: Graphics, tiles: readonly Tile[], size: number): void {
  const groups = new FillGroups();
  const scale = P.washNoiseScale * size;
  for (const t of tiles) {
    const [light, dark] = P.washColors[t.terrain];
    const water = isWater(t.terrain);
    // A wash must not reach over an edge to another terrain (or over the map border)
    const foreign = t.across.map((n) => n !== t.terrain);
    const rng = tileRng(t.hex.q, t.hex.r, 10);
    for (let k = 0; k < (water ? P.waterWashCount : P.washCount); k++) {
      const p = { x: (rng() - 0.5) * 1.6 * size, y: (rng() - 0.5) * 1.7 * size };
      const rr = rng();
      const seed = rng();
      if (distanceToEdges(p, ALL_EDGES, size) < 0) continue;
      const room = distanceToWavyEdges(p, foreign, t.waves, size);
      const r = Math.min((P.washRadiusMin + rr * (P.washRadiusMax - P.washRadiusMin)) * size, room);
      if (r < 0.16 * size) continue;
      const x = t.center.x + p.x;
      const y = t.center.y + p.y;
      const n = smoothNoise(x / scale, y / scale, water ? 2 : 1) - 0.5;
      // Noise values cluster around the middle: stretch them, 3 strength levels
      const level = Math.round(Math.min(1, Math.max(0, Math.abs(n) * 6 - 0.1)) * 3);
      if (level === 0) continue;
      const color = n > 0 ? light : dark;
      const alpha = (P.washAlpha * level) / 3;
      const shapeRng = tileRng(t.hex.q, t.hex.r, 11 + Math.floor(seed * 1000));
      for (const f of [1, 0.72, 0.44]) {
        groups.add(color, alpha, ellipsePoints(x, y, r * f, r * f * 0.66, 10, 0.14, shapeRng));
      }
    }
  }
  groups.fill(g);
}

/** Deep ocean fades into the turquoise coast, lighter shallow water along the shore. */
function paintSea(g: Graphics, tiles: readonly Tile[], size: number): void {
  const coastIntoOcean: number[][] = [];
  const oceanIntoCoast: number[][] = [];
  const shallow: number[][] = [];
  const stacked = (out: number[][], t: Tile, mask: boolean[], depths: readonly number[]): void => {
    for (let e = 0; e < 6; e++) {
      if (!mask[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 90 + e);
      for (const d of depths) {
        // Inner sides wobble a little, so the stacked bands do not look like contour lines
        out.push(edgeBand(t, e, 0, d * size, mask, wobble(rng, 0.05 * size), true, true));
      }
    }
  };
  const shallowDepths = [P.shallowDepth / 3, (P.shallowDepth * 2) / 3, P.shallowDepth];
  for (const t of tiles) {
    if (t.terrain === 'coast') {
      stacked(
        coastIntoOcean,
        t,
        t.across.map((n) => n === 'ocean'),
        P.seaBlendDepths,
      );
      stacked(shallow, t, t.shore, shallowDepths);
    } else if (t.terrain === 'ocean') {
      stacked(
        oceanIntoCoast,
        t,
        t.across.map((n) => n === 'coast'),
        P.seaBlendDepths,
      );
    }
  }
  fillAll(g, coastIntoOcean, theme.terrainColors.ocean, P.seaBlendAlpha);
  fillAll(g, oceanIntoCoast, theme.terrainColors.coast, P.seaBlendAlpha);
  fillAll(g, shallow, P.shallowColor, P.shallowAlpha);
}

/**
 * Color bleed between land types: irregular tongues of the neighbor's color reach into the
 * tile (both tiles do this, so the change is a soft gradient around the wavy edge). The bands
 * end like beaches (`insetEdge`): they join the band of the next edge when that edge borders
 * the same terrain, otherwise they run on into the next tile, which continues them. So the
 * gradient flows around the hex corners instead of pinching to a point there.
 */
function paintBleed(g: Graphics, tiles: readonly Tile[], size: number): void {
  const groups = new FillGroups();
  const bands = P.bleedBands;
  // Share of the band depth at both ends (fixed, so the neighbor tile's band meets it exactly)
  const endShare = 0.45;
  for (const t of tiles) {
    if (isWater(t.terrain)) continue;
    for (let e = 0; e < 6; e++) {
      const other = t.across[e];
      const offsets = t.waves[e];
      if (!other || !offsets || isWater(other)) continue;
      const prevIn = t.across[(e + 5) % 6] === other;
      const nextIn = t.across[(e + 1) % 6] === other;
      const rng = tileRng(t.hex.q, t.hex.r, 120 + e);
      const ph1 = rng() * Math.PI * 2;
      const ph2 = rng() * Math.PI * 2;
      const f1 = 1 + rng() * 1.2;
      const outer = coarse(wavyInsetLine(t.center, t.corners, e, offsets, 0, false, false));
      for (let b = 1; b <= bands; b++) {
        const depth = P.bleedDepth * P.bleedReach[other] * size * (b / bands);
        const extra: number[] = [];
        for (let i = 0; i <= WAVE_SEGMENTS; i++) {
          const u = i / WAVE_SEGMENTS;
          const tongue =
            1 +
            0.55 * Math.sin(Math.PI * 2 * f1 * u + ph1) +
            0.25 * Math.sin(Math.PI * 4 * u + ph2);
          extra.push(depth * (1 - endShare) * Math.sin(Math.PI * u) ** 0.7 * tongue);
        }
        const inner = wavyInsetLine(
          t.center,
          t.corners,
          e,
          offsets,
          depth * endShare,
          prevIn,
          nextIn,
          1,
          extra,
        );
        groups.add(P.bleedColors[other], P.bleedAlpha, flat([...outer, ...inner.reverse()]));
      }
    }
  }
  groups.fill(g);
}

/** Edges of a land tile with a small cliff instead of a beach (water below hills/mountains). */
function cliffMask(t: Tile): boolean[] {
  return t.shore.map((s, e) => {
    if (!s || (e !== 1 && e !== 2)) return false;
    if (t.terrain === 'mountains') return true;
    return t.terrain === 'hills' && tileHash(t.hex.q, t.hex.r, 140 + e) < P.hillCliffChance;
  });
}

/** Beaches on land tiles along the water (pebbles below mountains), following the curved shore. */
function paintBeaches(g: Graphics, tiles: readonly Tile[], size: number): void {
  const sandFringe: number[][] = [];
  const sand: number[][] = [];
  const pebbleFringe: number[][] = [];
  const pebbles: number[][] = [];
  const wet: number[][] = [];
  for (const t of tiles) {
    if (isWater(t.terrain) || !t.shore.some(Boolean)) continue;
    const cliffs = cliffMask(t);
    const beach = t.shore.map((s, e) => s && !cliffs[e]);
    const rocky = t.terrain === 'mountains';
    const amount = P.beachWobble * size;
    for (let e = 0; e < 6; e++) {
      if (!beach[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 40 + e);
      (rocky ? pebbleFringe : sandFringe).push(
        edgeBand(t, e, 0, P.beachFringeDepth * size, beach, wobble(rng, amount), false, true),
      );
      (rocky ? pebbles : sand).push(
        edgeBand(t, e, 0, P.beachDepth * size, beach, wobble(rng, amount)),
      );
      wet.push(edgeBand(t, e, 0, P.beachWetDepth * size, beach));
    }
  }
  fillAll(g, sandFringe, P.sandColor, P.beachFringeAlpha);
  fillAll(g, pebbleFringe, P.pebbleColor, P.beachFringeAlpha);
  fillAll(g, sand, P.sandColor);
  fillAll(g, pebbles, P.pebbleColor);
  fillAll(g, wet, P.sandWetColor, P.beachWetAlpha);
}

/** Faint straight outlines (a light hint of the grid): each shared edge once, none at the shore. */
function paintOutlines(g: Graphics, tiles: readonly Tile[], map: MapState): void {
  const landLines: [Point, Point][] = [];
  const waterLines: [Point, Point][] = [];
  for (const t of tiles) {
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(map, t.hex, e);
      if (n < t.index) continue; // map border (-1) or already drawn from the other side
      if (t.shore[e]) continue;
      const line: [Point, Point] = [t.corners[e], t.corners[(e + 1) % 6]];
      (isWater(t.terrain) ? waterLines : landLines).push(line);
    }
  }
  const outline = { color: theme.outlineColor, width: theme.outlineWidth };
  strokeLines(g, waterLines, { ...outline, alpha: theme.outlineWaterAlpha });
  strokeLines(g, landLines, { ...outline, alpha: theme.outlineAlpha });
}

/** Foam along the shore, a broken wave line further out, glints and open-sea waves. */
function paintSurf(g: Graphics, tiles: readonly Tile[], size: number): void {
  const foam: number[][] = [];
  const foamOuter: number[][] = [];
  const glints: number[][] = [];
  const waves: number[][] = [];
  const half = P.foamWidth / 2;
  for (const t of tiles) {
    if (t.terrain === 'coast') {
      const rng = tileRng(t.hex.q, t.hex.r, 60);
      for (let e = 0; e < 6; e++) {
        if (!t.shore[e]) continue;
        foam.push(edgeBand(t, e, P.foamInset - half, P.foamInset + half, t.shore));
        const line = wavyInsetLine(
          t.center,
          t.corners,
          e,
          t.waves[e] ?? STRAIGHT,
          P.foamOuterInset,
          t.shore[(e + 5) % 6],
          t.shore[(e + 1) % 6],
        );
        // Two dashes per edge, some left out
        for (const [s0, s1] of [
          [0.08, 0.46],
          [0.56, 0.92],
        ]) {
          if (rng() < 0.25) continue;
          const j = (rng() - 0.5) * 0.08;
          foamOuter.push(taperedStroke(subPolyline(line, s0 + j, s1 + j), P.foamWidth * 0.9));
        }
      }
      const glintCount = rng() < 0.5 ? 1 : 2;
      for (let k = 0; k < glintCount; k++) {
        const p = { x: (rng() - 0.5) * 0.9 * size, y: (rng() - 0.5) * 0.8 * size };
        const len = (3.5 + rng() * 2.5) * (size / 32);
        if (shoreDistance(t, p, size) < 0.42 * size) continue;
        // Small wave crest: a flat arch
        const x = t.center.x + p.x;
        const y = t.center.y + p.y;
        const arch: Point[] = [];
        for (let s = 0; s <= 4; s++) {
          const u = s / 4;
          arch.push({ x: x - len / 2 + len * u, y: y - len * 0.22 * Math.sin(Math.PI * u) });
        }
        glints.push(taperedStroke(arch, 1.1));
      }
    } else if (t.terrain === 'ocean') {
      const rng = tileRng(t.hex.q, t.hex.r, 70);
      let count = rng() < P.waveChance ? 1 : 0;
      if (count && rng() < 0.3) count = 2;
      for (let k = 0; k < count; k++) {
        const x0 = t.center.x + (rng() - 0.5) * 0.9 * size;
        const y0 = t.center.y + (rng() - 0.5) * 0.9 * size;
        const w = (0.13 + rng() * 0.06) * size;
        const h = 0.06 * size;
        // "~": one sine period
        const line: Point[] = [];
        for (let s = 0; s <= 8; s++) {
          const u = s / 8;
          line.push({ x: x0 - w + 2 * w * u, y: y0 - h * Math.sin(Math.PI * 2 * u) });
        }
        waves.push(taperedStroke(line, P.waveWidth));
      }
    }
  }
  fillAll(g, waves, P.waveColor, P.waveAlpha);
  fillAll(g, foamOuter, P.foamColor, P.foamOuterAlpha);
  fillAll(g, foam, P.foamColor, P.foamAlpha);
  fillAll(g, glints, P.glintColor, P.glintAlpha);
}

/** Point on the curved edge `e` at t, moved `depth` px into the tile. */
function edgePoint(t: Tile, e: number, u: number, depth: number): Point {
  const a = t.corners[e];
  const b = t.corners[(e + 1) % 6];
  const out = edgeOutward(e);
  const w = (t.waves[e] ? waveAt(t.waves[e], u) : 0) - depth;
  return { x: a.x + (b.x - a.x) * u + out.x * w, y: a.y + (b.y - a.y) * u + out.y * w };
}

/** Rocks in the surf just off the shore, each with a ring of foam. */
function paintSurfRocks(g: Graphics, tiles: readonly Tile[], size: number): void {
  const foam: number[][] = [];
  const dark: number[][] = [];
  const light: number[][] = [];
  for (const t of tiles) {
    if (t.terrain !== 'coast') continue;
    for (let e = 0; e < 6; e++) {
      if (!t.shore[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 160 + e);
      if (rng() >= P.shoreRockChance) continue;
      const count = 1 + Math.floor(rng() * 3);
      const u0 = 0.25 + rng() * 0.5;
      for (let k = 0; k < count; k++) {
        const u = Math.max(0.12, Math.min(0.88, u0 + (rng() - 0.5) * 0.3));
        const p = edgePoint(t, e, u, (0.06 + rng() * 0.12) * size);
        const r = (0.03 + rng() * 0.035) * size;
        foam.push(ellipsePoints(p.x + 0.1 * r, p.y + 0.15 * r, r * 1.55, r * 0.95, 9, 0.15, rng));
        dark.push(ellipsePoints(p.x, p.y, r, r * 0.68, 7, 0.2, rng));
        light.push(ellipsePoints(p.x - 0.25 * r, p.y - 0.22 * r, r * 0.6, r * 0.38, 6));
      }
    }
  }
  fillAll(g, foam, P.foamColor, P.shoreRockFoamAlpha);
  fillAll(g, dark, P.rockShade);
  fillAll(g, light, P.rockLight);
}

/**
 * Small cliffs: a rock face hanging from the shore of hills/mountains into the water below,
 * made of narrow lit and shaded facets (the south-west faces catch more light than the
 * south-east ones), with a darker foot, a light top lip, foam and a soft shadow on the water.
 */
function paintCliffs(g: Graphics, tiles: readonly Tile[], size: number): void {
  const shadows: number[][] = [];
  const facets = new FillGroups();
  const feet: number[][] = [];
  const cracks: number[][] = [];
  const lips: number[][] = [];
  const foam: number[][] = [];
  const ramp = (v: number): number => {
    const k = Math.max(0, Math.min(1, v / 0.3));
    return k * k * (3 - 2 * k);
  };
  for (const t of tiles) {
    if (t.terrain !== 'hills' && t.terrain !== 'mountains') continue;
    const cliffs = cliffMask(t);
    const height = P.cliffHeight * size * (t.terrain === 'mountains' ? 1 : 0.75);
    for (let e = 0; e < 6; e++) {
      if (!cliffs[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 150 + e);
      const top = wavyInsetLine(t.center, t.corners, e, t.waves[e] ?? STRAIGHT, 0, true, true);
      const startFull = cliffs[(e + 5) % 6];
      const endFull = cliffs[(e + 1) % 6];
      const bottom: Point[] = [];
      const foot: Point[] = [];
      const shadow: Point[] = [];
      const hs: number[] = [];
      for (let i = 0; i <= WAVE_SEGMENTS; i++) {
        const u = i / WAVE_SEGMENTS;
        const inner = i > 0 && i < WAVE_SEGMENTS;
        const env = Math.min(startFull ? 1 : ramp(u), endFull ? 1 : ramp(1 - u));
        const h = height * env * (inner ? 0.8 + rng() * 0.4 : 1);
        const jx = inner ? (rng() - 0.5) * 0.04 * size : 0;
        hs.push(h);
        bottom.push({ x: top[i].x + jx, y: top[i].y + h });
        foot.push({ x: top[i].x + jx * 0.6, y: top[i].y + h * 0.6 });
        shadow.push({ x: top[i].x + jx + env * 0.06 * size, y: top[i].y + h + env * 0.1 * size });
      }
      shadows.push(flat([...bottom, ...[...shadow].reverse()]));
      // Facets: the SW face (edge 2) is lit by the sun from the upper left, the SE face less
      const lit = e === 2 ? 0.6 : 0.3;
      for (let i = 0; i < WAVE_SEGMENTS; i++) {
        const v = rng();
        const color = v < lit ? P.cliffColor : v < lit + 0.3 ? P.cliffMid : P.cliffShade;
        facets.add(color, 1, flat([top[i], top[i + 1], bottom[i + 1], bottom[i]]));
      }
      feet.push(flat([...foot, ...[...bottom].reverse()]));
      // A few dark cracks running down the face
      for (let k = 0; k < 3; k++) {
        const i = 1 + Math.floor(rng() * (WAVE_SEGMENTS - 1));
        if (hs[i] < height * 0.5) continue;
        const a = { x: top[i].x + (rng() - 0.5) * 2, y: top[i].y + hs[i] * 0.12 };
        const b = { x: a.x + (rng() - 0.5) * 2.5, y: top[i].y + hs[i] * 0.9 };
        cracks.push(taperedStroke([a, b], 1.1));
      }
      lips.push(taperedStroke(top, 1.8));
      foam.push(taperedStroke(bottom, P.foamWidth * 1.3));
    }
  }
  fillAll(g, shadows, P.shadowColor, P.shadowAlpha);
  facets.fill(g);
  fillAll(g, feet, P.cliffShade, 0.55);
  fillAll(g, cracks, P.cliffCrackColor, 0.75);
  fillAll(g, lips, P.cliffLipColor);
  fillAll(g, foam, P.foamColor, P.foamAlpha);
}

/** Flat ground of the whole map (fills, washes, bleed, water, beaches, outlines, surf, cliffs). */
function paintGround(g: Graphics, tiles: readonly Tile[], map: MapState, size: number): void {
  paintFills(g, tiles);
  paintWashes(g, tiles, size);
  paintSea(g, tiles, size);
  paintBleed(g, tiles, size);
  paintBeaches(g, tiles, size);
  paintOutlines(g, tiles, map);
  paintSurf(g, tiles, size);
  paintSurfRocks(g, tiles, size);
  paintCliffs(g, tiles, size);
}

// ---------------------------------------------------------------------------------------------
// Details (planned once, painted per row)
// ---------------------------------------------------------------------------------------------

/** Color groups of the decals (index = Decal.group). */
const DECAL_GROUPS: readonly { color: number; alpha: number }[] = [
  { color: P.grassColor, alpha: P.grassAlpha },
  { color: P.hillGrassColor, alpha: P.grassAlpha },
  { color: P.screeColor, alpha: 1 },
  { color: P.rockShade, alpha: 1 },
  { color: P.rockLight, alpha: 1 },
  ...P.flowerColors.map((color) => ({ color, alpha: 1 })),
];
const GRASS = 0;
const HILL_GRASS = 1;
const SCREE = 2;
const BOULDER_DARK = 3;
const BOULDER_LIGHT = 4;
const FLOWER = 5;

function treeStanding(fx: number, fy: number, tree: TreeSpot, size: number): Standing {
  const k = tree.scale * size;
  // Pines throw a round shadow, cypresses a long thin one
  const [rx, ry] = tree.kind === 'pine' ? [0.2 * k, 0.065 * k] : [0.17 * k, 0.045 * k];
  const shapes: Shape[] = [];
  const add = (poly: number[], color: number, alpha = 1): void => {
    shapes.push({ poly, color, alpha });
  };
  if (tree.kind === 'pine') {
    // Umbrella pine: thin trunk, wide flat canopy (dark base, lit top-left, small highlight)
    const lean = (tree.x / size) * 0.03 * k;
    add(
      [
        fx - 0.022 * k,
        fy,
        fx + 0.022 * k,
        fy,
        fx + 0.014 * k + lean,
        fy - 0.25 * k,
        fx - 0.014 * k + lean,
        fy - 0.25 * k,
      ],
      P.trunkColor,
    );
    const cx = fx + lean;
    const cy = fy - 0.3 * k;
    const rng = tileRng(Math.round(fx), Math.round(fy), 80);
    add(ellipsePoints(cx, cy, 0.2 * k, 0.105 * k, 12, 0.08, rng), theme.treeColor);
    add(
      ellipsePoints(cx - 0.035 * k, cy - 0.028 * k, 0.145 * k, 0.065 * k, 10, 0.1, rng),
      P.pineLight,
    );
    add(ellipsePoints(cx - 0.075 * k, cy - 0.045 * k, 0.06 * k, 0.028 * k, 6), P.pineHighlight);
  } else {
    // Cypress: tall dark flame, lit on the left
    const w = 0.075 * k;
    const h = 0.52 * k;
    const by = fy - 0.01 * k;
    const left: Point[] = [
      { x: fx - 0.55 * w, y: by },
      { x: fx - w, y: by - 0.2 * h },
      { x: fx - 0.95 * w, y: by - 0.42 * h },
      { x: fx - 0.7 * w, y: by - 0.65 * h },
      { x: fx - 0.35 * w, y: by - 0.86 * h },
    ];
    const tip = { x: fx + 0.04 * w, y: by - h };
    const right = left.map((p) => ({ x: 2 * fx - p.x, y: p.y })).reverse();
    add(flat([...left, tip, ...right]), P.cypressDark);
    add(
      flat([
        ...left,
        tip,
        { x: fx - 0.1 * w, y: by - 0.55 * h },
        { x: fx - 0.15 * w, y: by - 0.05 * h },
      ]),
      P.cypressLight,
    );
  }
  return {
    x: fx,
    y: fy,
    shadow: ellipsePoints(fx + 0.13 * k, fy + 0.01 * k, rx, ry, 10),
    shadowAlpha: P.shadowAlpha,
    shapes,
  };
}

function moundStanding(c: Point, m: MoundSpot, size: number): Standing {
  const left = { x: c.x + m.x - m.w, y: c.y + m.y };
  const right = { x: c.x + m.x + m.w, y: c.y + m.y };
  const top = { x: c.x + m.x, y: c.y + m.y - m.h };
  const shapes: Shape[] = [];
  // Dome = quadratic curve from left to right over (x, y - 2h); its apex is `top`
  const control = { x: top.x, y: c.y + m.y - 2 * m.h };
  shapes.push({
    poly: flat([left, ...quadPoints(left, control, right, 10)]),
    color: P.moundLight,
    alpha: 1,
  });
  // Sunlit crest: a thin crescent along the upper left of the dome
  const crestStart = { x: left.x + 0.25 * m.w, y: left.y - 0.42 * m.h };
  const crestEnd = { x: top.x + 0.12 * m.w, y: top.y + 0.02 * m.h };
  shapes.push({
    poly: flat([
      crestStart,
      ...quadPoints(crestStart, { x: left.x + 0.5 * m.w, y: top.y - 0.06 * m.h }, crestEnd, 4),
      ...quadPoints(crestEnd, { x: left.x + 0.55 * m.w, y: top.y + 0.2 * m.h }, crestStart, 4),
    ]),
    color: P.moundCrest,
    alpha: 1,
  });
  // Shaded right flank: right half of the dome, back along a softer inner curve
  const halfControl = { x: top.x + m.w / 2, y: top.y };
  const foot = { x: top.x + 0.18 * m.w, y: right.y };
  const inner = { x: top.x + 0.12 * m.w, y: top.y + 0.5 * m.h };
  shapes.push({
    poly: flat([
      top,
      ...quadPoints(top, halfControl, right, 5),
      foot,
      ...quadPoints(foot, inner, top, 4),
    ]),
    color: theme.hillColor,
    alpha: 1,
  });
  return {
    x: c.x + m.x,
    y: c.y + m.y,
    shadow: ellipsePoints(
      c.x + m.x + 0.3 * m.w,
      c.y + m.y + 0.02 * size,
      m.w * 0.95,
      Math.min(0.085 * size, m.h * 0.3),
      12,
    ),
    shadowAlpha: P.shadowAlpha * 0.75,
    shapes,
  };
}

/** A small olive shrub (dark base, lit top-left). */
function shrubStanding(x: number, y: number, r: number, rng: () => number): Standing {
  return {
    x,
    y,
    shadow: null,
    shadowAlpha: 0,
    shapes: [
      { poly: ellipsePoints(x, y, r, r * 0.72, 8, 0.12, rng), color: P.shrubDark, alpha: 1 },
      {
        poly: ellipsePoints(x - r * 0.25, y - r * 0.25, r * 0.62, r * 0.42, 7),
        color: P.shrubColor,
        alpha: 1,
      },
    ],
  };
}

function peakStanding(c: Point, p: PeakSpot, size: number): Standing {
  const rng = tileRng(Math.round(c.x + p.x), Math.round(c.y + p.y), 81);
  const j = (v: number): number => (rng() - 0.5) * v;
  const by = c.y + p.y;
  const tip = { x: c.x + p.x + p.skew, y: by - p.h };
  const left = { x: c.x + p.x - p.hw, y: by };
  const right = { x: c.x + p.x + p.hw, y: by };
  const foot = { x: c.x + p.x + 0.18 * p.hw + p.skew * 0.3, y: by };
  const ridge = { x: (tip.x + foot.x) / 2 + j(0.12 * p.hw), y: (tip.y + foot.y) / 2 };
  const leftMid = {
    x: (tip.x + left.x) / 2 - 0.05 * p.hw + j(0.08 * p.hw),
    y: (tip.y + left.y) / 2,
  };
  const rightMid = {
    x: (tip.x + right.x) / 2 + 0.04 * p.hw + j(0.08 * p.hw),
    y: (tip.y + right.y) / 2,
  };
  const shapes: Shape[] = [
    { poly: flat([left, leftMid, tip, ridge, foot]), color: P.rockLight, alpha: 1 },
    { poly: flat([tip, rightMid, right, foot, ridge]), color: theme.mountainColor, alpha: 1 },
  ];
  // A dark crevice running down the lit face
  const top = lerp(tip, ridge, 0.3);
  const bottom = lerp(left, foot, 0.45 + j(0.15));
  const cw = 0.05 * p.hw;
  shapes.push({
    poly: [top.x, top.y, bottom.x + cw, bottom.y, bottom.x - cw, bottom.y],
    color: theme.mountainColor,
    alpha: 0.45,
  });
  if (p.snow) {
    // Snow cap with a zigzag lower edge; its right side lies in the cool shade
    const sl = lerp(tip, leftMid, 0.62);
    const sr = lerp(tip, rightMid, 0.56);
    const sj = lerp(tip, ridge, 0.7);
    const z1 = { x: sl.x + (sj.x - sl.x) * 0.35, y: sl.y + (sj.y - sl.y) * 0.35 + 0.07 * p.h };
    const z2 = { x: sl.x + (sj.x - sl.x) * 0.7, y: sl.y + (sj.y - sl.y) * 0.7 - 0.02 * p.h };
    const z3 = { x: (sj.x + sr.x) / 2, y: (sj.y + sr.y) / 2 + 0.06 * p.h };
    shapes.push({ poly: flat([tip, sl, z1, z2, sj]), color: theme.mountainPeakColor, alpha: 1 });
    shapes.push({ poly: flat([tip, sj, z3, sr]), color: P.snowShade, alpha: 1 });
  }
  return {
    x: c.x + p.x,
    y: by,
    shadow: ellipsePoints(c.x + p.x + 0.35 * p.hw, by + 0.02 * size, p.hw * 0.95, 0.08 * size, 12),
    shadowAlpha: P.shadowAlpha,
    shapes,
  };
}

/** A small sailing boat on the water (hull, mast, sail), facing left or right. */
function boatStanding(x: number, y: number, size: number, rng: () => number): Standing {
  const k = size / 32;
  const dir = rng() < 0.5 ? -1 : 1;
  const len = (5.5 + rng() * 1.5) * k;
  const shapes: Shape[] = [];
  // Wake behind the boat
  const wake: Point[] = [];
  for (let s = 0; s <= 4; s++) {
    const u = s / 4;
    wake.push({ x: x - dir * (len * 0.6 + u * len * 1.4), y: y + 0.4 * k + u * u * 0.6 * k });
  }
  shapes.push({ poly: taperedStroke(wake, 1.3 * k), color: P.foamColor, alpha: P.boatWakeAlpha });
  // Hull: flat deck line, rounded keel, raised bow
  const bow = { x: x + dir * len, y: y - 1.2 * k };
  const stern = { x: x - dir * len * 0.85, y: y - 0.6 * k };
  const keel = quadPoints(bow, { x: x + dir * len * 0.2, y: y + 2.6 * k }, stern, 5);
  shapes.push({ poly: flat([bow, ...keel]), color: P.boatHullColor, alpha: 1 });
  shapes.push({
    poly: taperedStroke(
      [stern, { x, y: y - 0.3 * k }, { x: bow.x - dir * 0.6 * k, y: bow.y + 0.3 * k }],
      0.9 * k,
    ),
    color: P.boatHullLight,
    alpha: 1,
  });
  // Mast and a square sail, lit on the left
  const mx = x + dir * 0.6 * k;
  const mastTop = y - 9 * k;
  shapes.push({
    poly: [
      mx - 0.3 * k,
      y - 0.4 * k,
      mx + 0.3 * k,
      y - 0.4 * k,
      mx + 0.25 * k,
      mastTop,
      mx - 0.25 * k,
      mastTop,
    ],
    color: P.boatMastColor,
    alpha: 1,
  });
  const sw = 3.6 * k;
  const belly = dir * 1.1 * k;
  const sail = [
    { x: mx - sw, y: mastTop + 1 * k },
    { x: mx + sw, y: mastTop + 1 * k },
    { x: mx + sw * 0.9 + belly, y: mastTop + 4.5 * k },
    { x: mx + sw * 0.8, y: y - 1.6 * k },
    { x: mx - sw * 0.8, y: y - 1.6 * k },
    { x: mx - sw * 0.9 + belly, y: mastTop + 4.5 * k },
  ];
  shapes.push({ poly: flat(sail), color: P.boatSailColor, alpha: 1 });
  shapes.push({
    poly: flat([
      { x: mx + 0.1 * k, y: mastTop + 1 * k },
      sail[1],
      sail[2],
      sail[3],
      { x: mx + 0.1 * k, y: y - 1.6 * k },
    ]),
    color: P.boatSailShade,
    alpha: 1,
  });
  return {
    x,
    y,
    shadow: ellipsePoints(x + 0.8 * k, y + 1.4 * k, len * 1.05, 1.3 * k, 10),
    shadowAlpha: P.shadowAlpha * 0.8,
    shapes,
  };
}

/** Smaller trees spilling over from neighboring forest tiles (positions relative to the center). */
function spillTrees(t: Tile, size: number): TreeSpot[] {
  const trees: TreeSpot[] = [];
  for (let e = 0; e < 6; e++) {
    if (t.across[e] !== 'forest') continue;
    const rng = tileRng(t.hex.q, t.hex.r, 170 + e);
    if (rng() >= P.spillTreeChance) continue;
    const count = rng() < 0.4 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const u = 0.22 + rng() * 0.56;
      const depth = (0.1 + rng() * 0.14) * size;
      const kind = rng() < P.cypressShare ? 'cypress' : 'pine';
      const scale = P.spillTreeScale * (0.85 + rng() * 0.3);
      const p = edgePoint(t, e, u, depth);
      const rel = { x: p.x - t.center.x, y: p.y - t.center.y };
      if (shoreDistance(t, rel, size) < 0.3 * size) continue;
      trees.push({ kind, x: rel.x, y: rel.y, scale });
    }
  }
  return trees;
}

/** Plans the decals and standing objects of one tile (deterministic, independent of footprints). */
function planTile(t: Tile, size: number): TilePlan {
  const decals: Decal[] = [];
  const standing: Standing[] = [];
  const k = size / 32;
  const c = t.center;
  const shoreDist = (p: Point): number => shoreDistance(t, p, size);

  if (t.terrain === 'plains' || t.terrain === 'hills') {
    const rng = tileRng(t.hex.q, t.hex.r, 20);
    const plains = t.terrain === 'plains';
    // Random spot inside the tile, away from the beach; null if it does not fit
    const spot = (minShore: number): Point | null => {
      const p = { x: (rng() - 0.5) * 1.2 * size, y: (rng() - 0.5) * 1.1 * size };
      if (distanceToEdges(p, ALL_EDGES, size) < 0.12 * size) return null;
      if (shoreDist(p) < minShore * size) return null;
      return { x: c.x + p.x, y: c.y + p.y };
    };
    const tufts = plains ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    for (let i = 0; i < tufts; i++) {
      const p = spot(0.26);
      if (!p) continue;
      for (const side of [-1, 0, 1]) {
        const bx = p.x + side * 0.9 * k;
        const tipX = bx + side * 0.8 * k + (rng() - 0.5) * 0.6 * k;
        const tipY = p.y - (2.4 + rng() * 1.4 - Math.abs(side) * 0.5) * k;
        const poly = [bx - 0.55 * k, p.y, bx + 0.55 * k, p.y, tipX, tipY];
        decals.push({ x: p.x, y: p.y, group: plains ? GRASS : HILL_GRASS, poly });
      }
    }
    if (plains) {
      const flowerCount = Math.floor(rng() * 4);
      for (let i = 0; i < flowerCount; i++) {
        const p = spot(0.24);
        if (!p) continue;
        const color = Math.floor(rng() * P.flowerColors.length);
        const r = 1.1 * k;
        decals.push({
          x: p.x,
          y: p.y,
          group: FLOWER + color,
          poly: [p.x, p.y - r, p.x + r, p.y, p.x, p.y + r, p.x - r, p.y],
        });
      }
    }
  }

  // Boulders on sandy beaches
  if (!isWater(t.terrain) && t.terrain !== 'mountains') {
    const cliffs = cliffMask(t);
    for (let e = 0; e < 6; e++) {
      if (!t.shore[e] || cliffs[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 180 + e);
      if (rng() >= P.beachRockChance) continue;
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const p = edgePoint(t, e, 0.2 + rng() * 0.6, (0.06 + rng() * 0.08) * size);
        const r = (0.035 + rng() * 0.03) * size;
        decals.push({
          x: p.x,
          y: p.y,
          group: BOULDER_DARK,
          poly: ellipsePoints(p.x, p.y, r, r * 0.66, 7, 0.2, rng),
        });
        decals.push({
          x: p.x,
          y: p.y,
          group: BOULDER_LIGHT,
          poly: ellipsePoints(p.x - 0.25 * r, p.y - 0.22 * r, r * 0.62, r * 0.38, 6),
        });
      }
    }
  }

  if (t.terrain === 'forest') {
    const trees = forestTrees(
      tileRng(t.hex.q, t.hex.r, 30),
      size,
      t.shore,
      P.cypressShare,
      shoreDist,
    );
    for (const tree of trees) standing.push(treeStanding(c.x + tree.x, c.y + tree.y, tree, size));
  } else if (t.terrain === 'hills') {
    const rng = tileRng(t.hex.q, t.hex.r, 31);
    for (const m of hillMounds(rng, size)) standing.push(moundStanding(c, m, size));
    // Shrubs and spill trees stand on the mounds, back to front
    const onTop: Standing[] = [];
    const count = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const p = { x: (rng() - 0.5) * 1.1 * size, y: (rng() - 0.5) * 1.0 * size };
      const r = (0.06 + rng() * 0.03) * size;
      const shapeRng = tileRng(t.hex.q, t.hex.r, 33 + i);
      if (distanceToEdges(p, ALL_EDGES, size) < 0.14 * size) continue;
      if (shoreDist(p) < 0.28 * size) continue;
      onTop.push(shrubStanding(c.x + p.x, c.y + p.y, r, shapeRng));
    }
    for (const tree of spillTrees(t, size))
      onTop.push(treeStanding(c.x + tree.x, c.y + tree.y, tree, size));
    onTop.sort((a, b) => a.y - b.y);
    standing.push(...onTop);
    // Loose scree spilling over from neighboring mountains
    for (let e = 0; e < 6; e++) {
      if (t.across[e] !== 'mountains') continue;
      const srng = tileRng(t.hex.q, t.hex.r, 190 + e);
      for (let i = 0; i < 3; i++) {
        const p = edgePoint(t, e, 0.2 + srng() * 0.6, (0.05 + srng() * 0.15) * size);
        const r = (0.025 + srng() * 0.025) * size;
        decals.push({
          x: p.x,
          y: p.y,
          group: SCREE,
          poly: ellipsePoints(p.x, p.y, r, r * 0.6, 5, 0.25, srng),
        });
      }
    }
  } else if (t.terrain === 'mountains') {
    const rng = tileRng(t.hex.q, t.hex.r, 32);
    const peaks = mountainPeaks(rng, size);
    // Loose rocks on the ground (mostly hidden behind the peaks, visible at the edges)
    for (let i = 0; i < 5; i++) {
      const r = (0.035 + rng() * 0.03) * size;
      const x = c.x + (rng() - 0.5) * 1.2 * size;
      const y = c.y + (0.1 + rng() * 0.5) * size;
      const shapeRng = tileRng(t.hex.q, t.hex.r, 34 + i);
      if (distanceToEdges({ x: x - c.x, y: y - c.y }, ALL_EDGES, size) < r * 2) continue;
      decals.push({ x, y, group: SCREE, poly: ellipsePoints(x, y, r, r * 0.6, 5, 0.25, shapeRng) });
    }
    for (const p of peaks) standing.push(peakStanding(c, p, size));
  } else if (t.terrain === 'plains') {
    const items: Standing[] = [];
    for (const tree of spillTrees(t, size))
      items.push(treeStanding(c.x + tree.x, c.y + tree.y, tree, size));
    // A low rolling mound now and then next to hills
    for (let e = 0; e < 6; e++) {
      if (t.across[e] !== 'hills') continue;
      const rng = tileRng(t.hex.q, t.hex.r, 200 + e);
      if (rng() >= P.spillMoundChance) continue;
      const p = edgePoint(t, e, 0.3 + rng() * 0.4, (0.16 + rng() * 0.08) * size);
      const rel = { x: p.x - c.x, y: p.y - c.y };
      if (shoreDist(rel) < 0.32 * size) continue;
      const mound = {
        x: rel.x,
        y: rel.y,
        w: (0.22 + rng() * 0.08) * size,
        h: (0.1 + rng() * 0.05) * size,
      };
      items.push(moundStanding(c, mound, size));
    }
    items.sort((a, b) => a.y - b.y);
    standing.push(...items);
  } else if (t.terrain === 'coast') {
    const rng = tileRng(t.hex.q, t.hex.r, 210);
    if (rng() < P.boatChance) {
      const p = { x: (rng() - 0.5) * 0.8 * size, y: (rng() - 0.5) * 0.7 * size };
      if (shoreDist(p) >= 0.42 * size && distanceToEdges(p, ALL_EDGES, size) >= 0.25 * size) {
        standing.push(boatStanding(c.x + p.x, c.y + p.y, size, rng));
      }
    }
  }
  return { decals, standing };
}

/** Paints one map row: its decals first, then the standing objects tile by tile. */
function paintRow(
  g: Graphics,
  plans: readonly TilePlan[],
  cleared: (x: number, y: number) => boolean,
): void {
  g.clear();
  const decalPolys: number[][][] = DECAL_GROUPS.map(() => []);
  for (const plan of plans) {
    for (const d of plan.decals) if (!cleared(d.x, d.y)) decalPolys[d.group].push(d.poly);
  }
  DECAL_GROUPS.forEach(({ color, alpha }, i) => fillAll(g, decalPolys[i], color, alpha));
  for (const plan of plans) {
    const visible = plan.standing.filter((s) => !cleared(s.x, s.y));
    if (visible.length === 0) continue;
    // All ground shadows of the tile first, so no shadow lies on an object
    const shadows = new FillGroups();
    for (const s of visible) if (s.shadow) shadows.add(P.shadowColor, s.shadowAlpha, s.shadow);
    shadows.fill(g);
    for (const s of visible) {
      for (const shape of s.shapes)
        g.poly(shape.poly).fill({ color: shape.color, alpha: shape.alpha });
    }
  }
}

/** Creates the static terrain layers for a map. */
export function createTerrainLayer(map: MapState, size: number): TerrainLayer {
  const tiles = buildTiles(map, size);
  const ground = new Graphics();
  paintGround(ground, tiles, map, size);

  const plans = tiles.map((t) => planTile(t, size));
  const rowPlans: TilePlan[][] = [];
  for (let r = 0; r < map.height; r++) {
    rowPlans.push(plans.slice(r * map.width, (r + 1) * map.width));
  }
  let footprints = new Map<number, FootprintShape>();
  const cleared = (x: number, y: number): boolean => {
    if (footprints.size === 0) return false;
    const h = pixelToHex({ x, y }, size);
    const fp = footprints.get(tileIndex(map, h));
    if (!fp) return false;
    const c = hexToPixel(h, size);
    return insideFootprint({ x: x - c.x, y: y - c.y }, fp, size);
  };
  const details = new Container();
  const rows = rowPlans.map((plan) => {
    const g = new Graphics();
    paintRow(g, plan, cleared);
    details.addChild(g);
    return g;
  });

  return {
    ground,
    details,
    setFootprints(list) {
      const next = new Map<number, FootprintShape>();
      for (const fp of list) {
        const i = tileIndex(map, fp.hex);
        if (i < 0) continue;
        const old = next.get(i);
        next.set(
          i,
          old
            ? { rx: Math.max(old.rx, fp.rx), ry: Math.max(old.ry, fp.ry) }
            : { rx: fp.rx, ry: fp.ry },
        );
      }
      const dirty = footprintRowsToRepaint(footprints, next, map.width, map.height);
      footprints = next;
      for (const r of dirty) paintRow(rows[r], rowPlans[r], cleared);
    },
  };
}
