// Painted terrain: built ONCE when the map view is created, never per frame.
// `ground` (one Graphics, flat): first the sea under the whole map (sea.ts: a depth texture of
//   the distance to land, turquoise shallows into deep blue; seamless swells and ripples; sun
//   glints), then the land fills with soft wavy borders where the terrain changes (meadows covered
//   by a seamless painted grass texture, meadow.ts), large color washes that flow across tiles,
//   color bleed between land types, the rolling hill country with its valleys where roads run
//   (relief.ts) under a layer of dry grass, beaches with wet sand, small cliffs, faint outlines,
//   layered foam and rocks in the surf.
// `rows` (one Graphics per map row, back to front): meadow clusters (flower drifts, clover,
//   tufts, stones), reefs, shoals and seaweed, grass and pebbles, then trees, the texture on the
//   hills, the mountain massifs and terraces. No decorative boats: ships are real units. The rows
//   are sorted together with the buildings (zIndex = rowDepthKey), so a mountain of a lower row
//   covers a building of the row above. Footprints, roads and the explored area change what
//   stands on a tile; only the rows they touch are repainted.
// Light comes from the upper left, so shadows fall to the lower right (docs/ART.md).
import {
  BufferImageSource,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';
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
  type RoadGeometry,
} from './geometry';
import { crownRadius, woodlandTrees, type TreePlan, type WoodKind, type WoodTree } from './forest';
import { ATLAS_GRID, meadowLayout, type MeadowCluster, type MeadowSite } from './meadow';
import {
  depthAt,
  glintLayout,
  mapOutline,
  reefLayout,
  REEF_COLUMNS,
  REEF_ROWS,
  seaDepthField,
  seaDepthPixels,
  type DepthField,
  type ReefPatch,
} from './sea';
import {
  coastCliffs,
  hillMounds,
  massifPlans,
  roadDistance,
  roadMasks,
  sliceDepthKey,
  sliceOfY,
} from './relief';
import {
  cutStanding,
  fillShape,
  hillDetails,
  maquisStanding,
  massifStanding,
  mountainFootDetails,
  paintHillMounds,
  reliefTexture,
  terraceStanding,
  type Decal,
  type Shape,
  type Standing,
} from './reliefPaint';
import {
  distanceToEdges,
  distanceToWavyEdges,
  edgeWave,
  ellipsePoints,
  beachEdges,
  cliffEdges,
  footprintRowsToRepaint,
  forestTrees,
  insideFootprint,
  isWater,
  mixColor,
  smoothNoise,
  taperedStroke,
  tileHash,
  tileRng,
  waveAt,
  WAVE_SEGMENTS,
  type FootprintShape,
  type TreeSpot,
} from './terrain';
import type { FootprintKind, TerrainArt, TreeArtId, TreeSprite } from './terrainArt';
import { theme } from './theme';

const P = theme.terrainPaint;
const F = P.forest;
const G = P.meadow;
const SEA = P.sea;

/** All six edges (for "keep away from the tile border" checks). */
const ALL_EDGES: readonly boolean[] = [true, true, true, true, true, true];

/**
 * Area around a tile centre (ellipse radii in px) where the terrain draws no standing objects
 * and no decals ('unit': only trees, shrubs and rocks make room; absent kind = 'building').
 */
export interface TileFootprint {
  hex: Hex;
  rx: number;
  ry: number;
  kind?: FootprintKind;
  /** The ellipse's center offset from the tile center (px; absent = 0). */
  cx?: number;
  cy?: number;
}

export interface TerrainLayer {
  /** Flat painted ground (static). */
  ground: Graphics;
  /**
   * Decals, standing objects and tree sprites in slices: two Containers per map row (index
   * 2 * row = the back half of the row, 2 * row + 1 = the front half), each with
   * zIndex = sliceDepthKey(index). Add them to the container that sorts the buildings by
   * depthKey: the back half draws before the row's buildings, the front half after them.
   * They are cullable (with a cullArea) for a culler run by the app.
   */
  rows: readonly Container[];
  /**
   * Clears room for buildings: decals and standing objects whose ground point lies inside a
   * footprint ellipse (clipped to its hex) are left out; on hills and mountains the tile gets a
   * terrace edge in front of the footprint, and a mountain's massif moves to the back of the
   * tile. Repaints only the rows that changed; the same footprints again do nothing.
   */
  setFootprints(footprints: readonly TileFootprint[]): void;
  /** Trees, shrubs, rocks and tufts keep off the roads (tile indices, see roadGeometry). */
  setRoads(roads: RoadGeometry): void;
  /**
   * Tiles not explored (false) get no decals or standing objects, so tall mountains or trees of
   * a hidden tile cannot reach out of the fog. null = everything explored.
   */
  setExplored(explored: readonly boolean[] | null): void;
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

interface TilePlan {
  decals: Decal[];
  standing: Standing[];
  /** Drawn trees and shrubs (sprites of the tree art). */
  sprites: TreePlan[];
}

function flat(points: readonly Point[]): number[] {
  const out: number[] = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
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

/** Lays a grass texture over the map: `texelsPerHex` of its pixels per hex size, repeating. */
function grassMatrix(size: number): Matrix {
  const k = size / G.texelsPerHex;
  return new Matrix(k, 0, 0, k, 0, 0);
}

/**
 * Land fills: one flat color per terrain, so tiles of the same terrain read as one surface,
 * laid over the sea (painted under the whole map first). Meadows get the painted grass instead:
 * one seamless texture laid over all of them in map space (its mean color is the meadow color),
 * so it runs on from tile to tile without a seam.
 */
function paintFills(g: Graphics, tiles: readonly Tile[], size: number): void {
  const groups = new FillGroups();
  const meadows: number[][] = [];
  for (const t of tiles) {
    if (isWater(t.terrain)) continue;
    const poly = flat(wavyTileOutline(t.corners, t.waves));
    if (t.terrain === 'plains') meadows.push(poly);
    else groups.add(theme.terrainColors[t.terrain], 1, poly);
  }
  groups.fill(g);
  if (meadows.length === 0) return;
  for (const poly of meadows) g.poly(poly);
  g.fill({ texture: reliefTexture('meadow'), matrix: grassMatrix(size), textureSpace: 'global' });
}

/** A light layer of dry golden grass over the hills (and their mounds), seamless like the meadow. */
function paintHillGrass(g: Graphics, tiles: readonly Tile[], size: number): void {
  let any = false;
  for (const t of tiles) {
    if (t.terrain !== 'hills') continue;
    g.poly(flat(wavyTileOutline(t.corners, t.waves)));
    any = true;
  }
  if (!any) return;
  g.fill({
    texture: reliefTexture('hillGrass'),
    matrix: grassMatrix(size),
    textureSpace: 'global',
    alpha: G.hillAlpha,
  });
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
    // The sea gets its light and shade from its own depth painting
    if (isWater(t.terrain)) continue;
    const [light, dark] = P.washColors[t.terrain];
    // A wash must not reach over an edge to another terrain (or over the map border)
    const foreign = t.across.map((n) => n !== t.terrain);
    const rng = tileRng(t.hex.q, t.hex.r, 10);
    for (let k = 0; k < P.washCount; k++) {
      const p = { x: (rng() - 0.5) * 1.6 * size, y: (rng() - 0.5) * 1.7 * size };
      const rr = rng();
      const seed = rng();
      if (distanceToEdges(p, ALL_EDGES, size) < 0) continue;
      const room = distanceToWavyEdges(p, foreign, t.waves, size);
      const r = Math.min((P.washRadiusMin + rr * (P.washRadiusMax - P.washRadiusMin)) * size, room);
      if (r < 0.16 * size) continue;
      const x = t.center.x + p.x;
      const y = t.center.y + p.y;
      const n = smoothNoise(x / scale, y / scale, 1) - 0.5;
      // Noise values cluster around the middle: stretch them, 3 strength levels
      const level = Math.round(Math.min(1, Math.max(0, Math.abs(n) * 6 - 0.1)) * 3);
      if (level === 0) continue;
      const color = n > 0 ? light : dark;
      const alpha = (P.washAlpha * P.washStrength[t.terrain] * level) / 3;
      const shapeRng = tileRng(t.hex.q, t.hex.r, 11 + Math.floor(seed * 1000));
      for (const f of [1, 0.72, 0.44]) {
        groups.add(color, alpha, ellipsePoints(x, y, r * f, r * f * 0.66, 10, 0.14, shapeRng));
      }
    }
  }
  groups.fill(g);
}

/**
 * Forest floor: soft pools of shade between the trunks and a few sunflecks, kept inside the wood
 * (they never reach over an edge to other terrain).
 */
function paintForestFloor(g: Graphics, tiles: readonly Tile[], size: number): void {
  const groups: Shape[] = [];
  for (const t of tiles) {
    if (t.terrain !== 'forest') continue;
    const open = t.across.map((n) => n !== 'forest');
    const rng = tileRng(t.hex.q, t.hex.r, 15);
    const blob = (
      count: number,
      rMin: number,
      rMax: number,
      color: number,
      alpha: number,
    ): void => {
      for (let k = 0; k < count; k++) {
        const p = { x: (rng() - 0.5) * 1.5 * size, y: (rng() - 0.5) * 1.6 * size };
        const want = (rMin + rng() * (rMax - rMin)) * size;
        if (distanceToEdges(p, ALL_EDGES, size) < 0) continue;
        const r = Math.min(want, distanceToWavyEdges(p, open, t.waves, size) * 0.9);
        if (r < 0.1 * size) continue;
        groups.push({
          poly: ellipsePoints(t.center.x + p.x, t.center.y + p.y, r, r * 0.66, 12),
          color,
          alpha,
          texture: 'spot',
        });
      }
    };
    blob(F.floorShadeCount, 0.28, 0.48, P.shadowColor, F.floorShadeAlpha);
    blob(F.sunfleckCount, 0.12, 0.22, F.sunfleckColor, F.sunfleckAlpha);
  }
  for (const shape of groups) fillShape(g, shape);
}

/**
 * The sea under the whole map: inside the map outline the depth texture (the distance to land
 * painted from turquoise shallows into deep blue, one texture for the whole map), the long swells
 * over all water and the fine ripples on coastal water (both seamless, their average color is
 * the water's). The land is painted over it. Returns the depth texture (owned by the layer).
 */
/** The distance to land over the whole map; the shore is the wavy edge between land and water. */
function depthFieldOf(map: MapState, tiles: readonly Tile[], size: number): DepthField {
  return seaDepthField(map, size, (p) => {
    const i = tileIndex(map, pixelToHex(p, size));
    if (i < 0) return false;
    const t = tiles[i];
    const d = shoreDistance(t, { x: p.x - t.center.x, y: p.y - t.center.y }, size);
    // A water tile's point beyond its wavy shore lies on land, and the other way round
    return isWater(t.terrain) ? d < 0 : d >= 0;
  });
}

function paintSeaBase(
  g: Graphics,
  tiles: readonly Tile[],
  map: MapState,
  field: DepthField,
  size: number,
): Texture {
  const depth = new Texture({
    source: new BufferImageSource({
      resource: seaDepthPixels(field, size),
      width: field.n,
      height: field.n,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied-alpha',
    }),
  });
  const outline = flat(mapOutline(map, size));
  g.poly(outline).fill({
    texture: depth,
    matrix: new Matrix(field.cell, 0, 0, field.cell, field.x0, field.y0),
    textureSpace: 'global',
  });
  const scaled = (texels: number): Matrix => new Matrix(size / texels, 0, 0, size / texels, 0, 0);
  g.poly(outline).fill({
    texture: reliefTexture('swell'),
    matrix: scaled(SEA.swellTexels),
    textureSpace: 'global',
  });
  let coast = false;
  for (const t of tiles) {
    if (t.terrain !== 'coast') continue;
    g.poly(flat(wavyTileOutline(t.corners, t.waves)));
    coast = true;
  }
  if (coast) {
    g.fill({
      texture: reliefTexture('ripple'),
      matrix: scaled(SEA.rippleTexels),
      textureSpace: 'global',
    });
  }
  return depth;
}

/**
 * Sun glints on the water: tiny sparkles, sparse, more on the open sea and toward the sun in the
 * upper left of the map, never right at the shore.
 */
function paintGlints(g: Graphics, tiles: readonly Tile[], size: number): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.center.x);
    minY = Math.min(minY, t.center.y);
    maxX = Math.max(maxX, t.center.x);
    maxY = Math.max(maxY, t.center.y);
  }
  const sparkles: number[][] = [];
  for (const t of tiles) {
    if (!isWater(t.terrain)) continue;
    const u = (t.center.x - minX) / Math.max(1, maxX - minX);
    const v = (t.center.y - minY) / Math.max(1, maxY - minY);
    const glints = glintLayout(
      tileRng(t.hex.q, t.hex.r, 240),
      size,
      t.terrain === 'ocean' ? 1 : 0,
      1 - (u + v) / 2,
      (p) => shoreDistance(t, p, size) >= 0.3 * size,
    );
    for (const gl of glints) {
      const x = t.center.x + gl.x;
      const y = t.center.y + gl.y;
      const r = gl.r;
      // A four-pointed sparkle: long and flat across, shorter up and down
      sparkles.push([x - r, y, x, y - 0.16 * r, x + r, y, x, y + 0.16 * r]);
      sparkles.push([x - 0.14 * r, y, x, y - 0.55 * r, x + 0.14 * r, y, x, y + 0.45 * r]);
    }
  }
  fillAll(g, sparkles, SEA.glintColor, SEA.glintAlpha);
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
  return cliffEdges(t.terrain, t.shore, (e) => tileHash(t.hex.q, t.hex.r, 140 + e));
}

/**
 * Beaches on land tiles along the water (pebbles below mountains), following the curved shore:
 * dry sand, wet sand at the waterline and the light broken line where the last wave reached.
 */
function paintBeaches(g: Graphics, tiles: readonly Tile[], size: number): void {
  const sandFringe: number[][] = [];
  const sand: number[][] = [];
  const pebbleFringe: number[][] = [];
  const pebbles: number[][] = [];
  const wet: number[][] = [];
  const swash: number[][] = [];
  for (const t of tiles) {
    if (isWater(t.terrain) || !t.shore.some(Boolean)) continue;
    const beach = beachEdges(t.shore, cliffMask(t));
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
      // The reach of the last wave: a light broken line on the wet sand
      const line = wavyInsetLine(
        t.center,
        t.corners,
        e,
        t.waves[e] ?? STRAIGHT,
        SEA.swashInset,
        beach[(e + 5) % 6],
        beach[(e + 1) % 6],
      );
      swash.push(...dashes(line, 3, 0.75, 1.1, rng));
    }
  }
  fillAll(g, sandFringe, P.sandColor, P.beachFringeAlpha);
  fillAll(g, pebbleFringe, P.pebbleColor, P.beachFringeAlpha);
  fillAll(g, sand, P.sandColor);
  fillAll(g, pebbles, P.pebbleColor);
  fillAll(g, wet, P.sandWetColor, P.beachWetAlpha);
  fillAll(g, swash, P.foamColor, SEA.swashAlpha);
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

/** Broken strokes along a line: `dashes` pieces between 0.06 and 0.94, some left out. */
function dashes(
  line: readonly Point[],
  count: number,
  keep: number,
  width: number,
  rng: () => number,
): number[][] {
  const out: number[][] = [];
  const step = 0.88 / count;
  for (let i = 0; i < count; i++) {
    const s0 = 0.06 + i * step + rng() * step * 0.25;
    const s1 = s0 + step * (0.45 + rng() * 0.4);
    if (rng() >= keep) continue;
    out.push(taperedStroke(subPolyline(line, s0, Math.min(0.94, s1)), width));
  }
  return out;
}

/**
 * Foam along the shore of coastal water, in layers from the land outward: a soft wide band, the
 * bright line at the waterline, a broken line and a faint, more broken third line. Rocky shores
 * (cliffs, mountains) get wider, brighter surf; below a cliff face that hangs into the water the
 * foam starts at the foot of the face.
 */
function paintSurf(g: Graphics, tiles: readonly Tile[], map: MapState, size: number): void {
  const soft: number[][] = [];
  const foam: number[][] = [];
  const foamOuter: number[][] = [];
  const foamThird: number[][] = [];
  const half = P.foamWidth / 2;
  for (const t of tiles) {
    if (t.terrain !== 'coast') continue;
    for (let e = 0; e < 6; e++) {
      if (!t.shore[e]) continue;
      const rng = tileRng(t.hex.q, t.hex.r, 60 + e);
      const n = mapEdgeNeighborIndex(map, t.hex, e);
      const land = n >= 0 ? tiles[n] : null;
      const back = (e + 3) % 6;
      const rocky = land !== null && (land.terrain === 'mountains' || cliffMask(land)[back]);
      // A face hangs from the land's front edges (1, 2) down into this water
      const hang =
        rocky && (back === 1 || back === 2)
          ? (land.terrain === 'mountains'
              ? (P.mountains.coastFront[0] + P.mountains.coastFront[1]) / 2
              : P.cliffHeight * 0.75) * size
          : 0;
      const k = rocky ? SEA.cliffFoam : 1;
      const prev = t.shore[(e + 5) % 6];
      const next = t.shore[(e + 1) % 6];
      const offsets = t.waves[e] ?? STRAIGHT;
      soft.push(
        edgeBand(
          t,
          e,
          hang * 0.8,
          hang + SEA.foamSoftDepth * size * k,
          t.shore,
          wobble(rng, 0.03 * size),
          true,
          true,
        ),
      );
      foam.push(
        edgeBand(t, e, hang + P.foamInset - half * k, hang + P.foamInset + half * k, t.shore),
      );
      const line = (depth: number): Point[] =>
        wavyInsetLine(t.center, t.corners, e, offsets, hang + depth, prev, next);
      foamOuter.push(...dashes(line(P.foamOuterInset * k), 3, 0.8, P.foamWidth * 0.85, rng));
      foamThird.push(...dashes(line(SEA.foamThirdInset * k), 3, 0.5, P.foamWidth * 0.7, rng));
    }
  }
  fillAll(g, soft, P.foamColor, SEA.foamSoftAlpha);
  fillAll(g, foamThird, P.foamColor, SEA.foamThirdAlpha);
  fillAll(g, foamOuter, P.foamColor, P.foamOuterAlpha);
  fillAll(g, foam, P.foamColor, P.foamAlpha);
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
    // Mountains drop into the sea with their own massif (reliefPaint.ts); low cliffs on hills
    if (t.terrain !== 'hills') continue;
    const cliffs = cliffMask(t);
    const height = P.cliffHeight * size * 0.75;
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

/**
 * Flat ground of the whole map (the sea with its depth, waves and glints, land fills and the
 * painted meadow grass, washes, bleed, hill mounds and their dry grass, beaches, outlines, foam,
 * surf rocks, cliffs). Returns the layer's own depth texture.
 */
function paintGround(
  g: Graphics,
  tiles: readonly Tile[],
  map: MapState,
  field: DepthField,
  size: number,
): Texture {
  const depth = paintSeaBase(g, tiles, map, field, size);
  paintGlints(g, tiles, size);
  paintFills(g, tiles, size);
  paintWashes(g, tiles, size);
  paintForestFloor(g, tiles, size);
  paintBleed(g, tiles, size);
  paintHillMounds(g, hillMounds(map, size, shoreDistanceAt(map, tiles, size)), size);
  paintHillGrass(g, tiles, size);
  paintBeaches(g, tiles, size);
  paintOutlines(g, tiles, map);
  paintSurf(g, tiles, map, size);
  paintSurfRocks(g, tiles, size);
  paintCliffs(g, tiles, size);
  return depth;
}

// ---------------------------------------------------------------------------------------------
// Details (planned once, painted per row)
// ---------------------------------------------------------------------------------------------

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

/**
 * What the meadow layout needs to know about a plains tile: denser beside forests and water,
 * sparser beside hills; lush toward the damp side; drier beside hills and in the golden regions
 * of the washes; more flowers in some regions (a smooth noise over the map). Clusters keep off
 * the beach and inside the meadow (they may run on into a neighboring meadow).
 */
function meadowSite(t: Tile, size: number, shoreDist: (p: Point) => number): MeadowSite {
  let forest = 0;
  let water = 0;
  let hills = 0;
  let dx = 0;
  let dy = 0;
  for (let e = 0; e < 6; e++) {
    const n = t.across[e];
    if (n === null) continue;
    if (n === 'forest' || isWater(n)) {
      dx += Math.cos((Math.PI / 3) * e);
      dy += Math.sin((Math.PI / 3) * e);
    }
    if (n === 'forest') forest++;
    else if (isWater(n)) water++;
    else if (n === 'hills' || n === 'mountains') hills++;
  }
  const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
  const [lo, hi] = G.densityRange;
  const density = Math.max(
    lo,
    Math.min(hi, 1 + forest * G.densityForest + water * G.densityWater + hills * G.densityHills),
  );
  const len = Math.hypot(dx, dy);
  const { x, y } = t.center;
  const flowers = smoothNoise(x / (G.flowerNoise * size), y / (G.flowerNoise * size), 24);
  const golden = smoothNoise(x / (P.washNoiseScale * size), y / (P.washNoiseScale * size), 1);
  const foreign = t.across.map((n) => n !== 'plains');
  return {
    density,
    damp: clamp01((forest + water) / 3),
    dampSide: len > 0.01 ? { x: dx / len, y: dy / len } : null,
    dry: clamp01(hills * 0.25 + (golden - 0.5) * 2.5),
    flowers: clamp01((flowers - 0.3) * 2.2),
    open: forest === 0,
    ok: (p, r) =>
      distanceToWavyEdges(p, foreign, t.waves, size) >= r * 0.7 &&
      shoreDist(p) >= P.beachFringeDepth * size + r * 0.5,
  };
}

/** Cells of the meadow atlas as texture matrices (see `fillCluster`). */
const CELL_MATRICES: readonly Matrix[] = Array.from(
  { length: ATLAS_GRID * ATLAS_GRID },
  (_, i) =>
    new Matrix(ATLAS_GRID, 0, 0, ATLAS_GRID, -(i % ATLAS_GRID), -Math.floor(i / ATLAS_GRID)),
);

/** A meadow cluster as a decal: a quad that shows its cell of the meadow atlas. */
function clusterDecal(c: Point, cl: MeadowCluster): Decal {
  const x = c.x + cl.x;
  const y = c.y + cl.y;
  const { rx, ry } = cl;
  return {
    x,
    y,
    color: cl.tint,
    alpha: cl.alpha,
    poly: [x - rx, y - ry, x + rx, y - ry, x + rx, y + ry, x - rx, y + ry],
    cell: cl.cell,
    rx,
    ry,
    layer: cl.layer,
  };
}

/** Cells of the reef atlas as texture matrices. */
const REEF_MATRICES: readonly Matrix[] = Array.from(
  { length: REEF_COLUMNS * REEF_ROWS },
  (_, i) =>
    new Matrix(REEF_COLUMNS, 0, 0, REEF_ROWS, -(i % REEF_COLUMNS), -Math.floor(i / REEF_COLUMNS)),
);

/** A reef patch as a decal: a quad that shows its cell of the reef atlas. */
function reefDecal(c: Point, patch: ReefPatch): Decal {
  const x = c.x + patch.x;
  const y = c.y + patch.y;
  const { rx, ry } = patch;
  return {
    x,
    y,
    color: 0xffffff,
    alpha: patch.alpha,
    poly: [x - rx, y - ry, x + rx, y - ry, x + rx, y + ry, x - rx, y + ry],
    cell: patch.cell,
    atlas: 'reef',
    rx,
    ry,
    layer: -1,
  };
}

/** Paints a meadow cluster or reef patch: its atlas cell stretched over the quad (local texture space). */
function fillCluster(g: Graphics, d: Decal): void {
  const reef = d.atlas === 'reef';
  g.poly(d.poly).fill({
    texture: reliefTexture(reef ? 'reefAtlas' : 'meadowAtlas'),
    matrix: (reef ? REEF_MATRICES : CELL_MATRICES)[d.cell ?? 0],
    color: d.color,
    alpha: d.alpha,
    textureSpace: 'local',
  });
}

/** Which tree art is loaded, by kind (see `artOf`). */
type ArtKinds = Readonly<Record<WoodKind, boolean>>;

/**
 * Plans the decals, standing objects and tree sprites of one tile (deterministic, independent of
 * footprints). `wood`: the woodland trees standing on this tile (with tree art), else null.
 */
function planTile(
  t: Tile,
  size: number,
  art: ArtKinds,
  wood: readonly WoodTree[] | null,
  map: MapState,
  field: DepthField,
): TilePlan {
  const decals: Decal[] = [];
  const standing: Standing[] = [];
  const sprites: TreePlan[] = [];
  /** A spill tree beside a forest: a sprite with tree art, else drawn in code. */
  const spill = (tree: TreeSpot): void => {
    const kind: WoodKind = tree.kind === 'cypress' ? 'cypress' : 'pine';
    if (art[kind]) {
      const x = t.center.x + tree.x;
      const y = t.center.y + tree.y;
      const variant = Math.floor(tileHash(Math.round(x), Math.round(y), 820) * 1000);
      sprites.push({ x, y, kind, variant, scale: (tree.scale / P.spillTreeScale) * 0.75 });
    } else {
      standing.push(treeStanding(t.center.x + tree.x, t.center.y + tree.y, tree, size));
    }
  };
  const c = t.center;
  const shoreDist = (p: Point): number => shoreDistance(t, p, size);

  if (t.terrain === 'plains') {
    // Meadow: clusters of flowers, clover, tufts and stones, now and then a shrub or a lone tree
    const { clusters, plants } = meadowLayout(
      tileRng(t.hex.q, t.hex.r, 20),
      size,
      meadowSite(t, size, shoreDist),
    );
    for (const cl of clusters) decals.push(clusterDecal(c, cl));
    for (const pl of plants) {
      const tree: WoodTree = { ...pl, x: c.x + pl.x, y: c.y + pl.y, tile: t.index };
      if (art[pl.kind]) sprites.push(tree);
      else standing.push(codeTree(tree, size));
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
          color: P.rockShade,
          alpha: 1,
          poly: ellipsePoints(p.x, p.y, r, r * 0.66, 7, 0.2, rng),
        });
        decals.push({
          x: p.x,
          y: p.y,
          color: P.rockLight,
          alpha: 1,
          poly: ellipsePoints(p.x - 0.25 * r, p.y - 0.22 * r, r * 0.62, r * 0.38, 6),
        });
      }
    }
  }

  if (t.terrain === 'forest') {
    if (wood) {
      // Dense woodland of tree sprites (kinds without art fall back to code-drawn trees)
      for (const tree of wood) {
        if (art[tree.kind]) sprites.push(tree);
        else standing.push(codeTree(tree, size));
      }
    } else {
      const trees = forestTrees(
        tileRng(t.hex.q, t.hex.r, 30),
        size,
        t.shore,
        P.cypressShare,
        shoreDist,
      );
      for (const tree of trees) {
        standing.push(treeStanding(c.x + tree.x, c.y + tree.y, tree, size));
      }
    }
  } else if (t.terrain === 'hills') {
    // Dry grass, maquis, olive trees and limestone on the slopes (the mounds are in the ground)
    const details = hillDetails(
      c,
      size,
      tileRng(t.hex.q, t.hex.r, 31),
      (p, margin) => {
        if (distanceToEdges(p, ALL_EDGES, size) < 0.07 * size) return false;
        return shoreDist(p) >= margin * size + P.beachDepth * size;
      },
      { olive: art.olive, shrub: art.shrub },
    );
    decals.push(...details.decals);
    standing.push(...details.standing);
    sprites.push(...details.sprites);
    for (const tree of spillTrees(t, size)) spill(tree);
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
          color: P.screeColor,
          alpha: 1,
          poly: ellipsePoints(p.x, p.y, r, r * 0.6, 5, 0.25, srng),
        });
      }
    }
  } else if (t.terrain === 'mountains') {
    // Scree and boulders at the foot (the massif itself depends on footprints: see paintRow)
    const foot = mountainFootDetails(c, size, tileRng(t.hex.q, t.hex.r, 32), (p) => {
      if (distanceToEdges(p, ALL_EDGES, size) < 0.06 * size) return false;
      return shoreDist(p) >= 0.3 * size;
    });
    decals.push(...foot.decals);
    standing.push(...foot.standing.sort((a, b) => a.y - b.y));
  } else if (t.terrain === 'plains') {
    for (const tree of spillTrees(t, size)) spill(tree);
  } else if (t.terrain === 'coast') {
    // A few reefs, shoals and seaweed patches (no decorative boats: ships are real units)
    // They may reach into the next water tile, but keep off the land, the map border and the
    // middle of every tile (a ship stands there)
    const patches = reefLayout(tileRng(t.hex.q, t.hex.r, 230), size, (p, r) => {
      const x = c.x + p.x;
      const y = c.y + p.y;
      if (depthAt(field, x, y) * size < SEA.reefShore * size + r) return false;
      const h = pixelToHex({ x, y }, size);
      if (tileIndex(map, h) < 0) return false;
      const hc = hexToPixel(h, size);
      if (Math.hypot(x - hc.x, y - hc.y) < SEA.reefCenterClear * size + r * 0.4) return false;
      for (const [dx, dy] of [
        [-r, 0],
        [r, 0],
        [0, -r],
        [0, r],
      ]) {
        if (tileIndex(map, pixelToHex({ x: x + dx, y: y + dy }, size)) < 0) return false;
      }
      return true;
    });
    for (const patch of patches) decals.push(reefDecal(c, patch));
  }
  return { decals, standing, sprites };
}

/** A woodland tree whose kind has no art: drawn in code (oaks as broad pines, shrubs as maquis). */
function codeTree(tree: WoodTree, size: number): Standing {
  if (tree.kind === 'shrub' || tree.kind === 'olive') {
    const rng = tileRng(Math.round(tree.x), Math.round(tree.y), 830);
    return maquisStanding(tree.x, tree.y, 0.075 * size * tree.scale, rng);
  }
  const spot: TreeSpot = {
    kind: tree.kind === 'cypress' ? 'cypress' : 'pine',
    x: 0,
    y: 0,
    scale: tree.scale * (tree.kind === 'oak' ? 0.95 : 1),
  };
  return treeStanding(tree.x, tree.y, spot, size);
}

/** What a slice needs to know about the current footprints, roads and explored tiles. */
interface PaintState {
  /** Footprints of buildings (incl. mine / quarry cuts), merged per tile. */
  footprints: ReadonlyMap<number, FootprintShape>;
  /** Footprints of units (only trees, shrubs and rocks make room), merged per tile. */
  units: ReadonlyMap<number, FootprintShape>;
  roads: readonly number[];
  explored: readonly boolean[] | null;
}

/** Trees, shrubs and rocks keep this far (fraction of the hex size) from the middle of a road. */
const ROAD_CLEAR = 0.24;
/** Grass tufts, flowers and pebbles keep this far. */
const ROAD_CLEAR_DECAL = 0.2;

/** What lies in one slice (see `sliceOfY`), each item with the tile it belongs to. */
interface SliceItems {
  decals: { tile: number; item: Decal }[];
  standing: { tile: number; item: Standing }[];
  sprites: { tile: number; item: TreePlan }[];
  /** Tiles of this row whose relief depends on footprints (mountains, hills): back slices only. */
  relief: number[];
}

/** One slice on screen: its Graphics (decals, code-drawn objects) and the tree sprites above. */
interface SliceView {
  root: Container;
  g: Graphics;
}

/** Tree art ids by kind (the loaded ones are picked from these). */
const ART_IDS: Readonly<Record<WoodKind, readonly TreeArtId[]>> = {
  pine: ['pine1', 'pine2', 'pine3'],
  oak: ['oak1', 'oak2', 'oak3'],
  cypress: ['cypress1', 'cypress2'],
  shrub: ['shrub1', 'shrub2', 'shrub3'],
  olive: ['olive1', 'olive2'],
};

/** The loaded tree sprites by kind, each with its art id (empty lists when nothing is loaded). */
function artOf(art: TerrainArt | undefined): Record<WoodKind, LoadedTree[]> {
  const pick = (kind: WoodKind): LoadedTree[] => {
    const out: LoadedTree[] = [];
    for (const id of ART_IDS[kind]) {
      const sprite = art?.trees[id];
      if (sprite) out.push({ id, sprite });
    }
    return out;
  };
  return {
    pine: pick('pine'),
    oak: pick('oak'),
    cypress: pick('cypress'),
    shrub: pick('shrub'),
    olive: pick('olive'),
  };
}

/** One loaded tree art file. */
interface LoadedTree {
  id: TreeArtId;
  sprite: TreeSprite;
}

/** Which kind wins when two footprints share a tile: a cut, then a building, then a field. */
const KIND_RANK: Readonly<Record<FootprintKind, number>> = {
  field: 0,
  unit: 0,
  building: 1,
  mineCut: 2,
  quarryCut: 2,
};

/**
 * Merges footprints per tile; `keep` selects which kinds. Two on one tile: the larger radii win,
 * the center offset of the larger one stays, and the kind by KIND_RANK.
 */
function mergeFootprints(
  map: MapState,
  list: readonly TileFootprint[],
  keep: (kind: FootprintKind) => boolean,
): Map<number, FootprintShape> {
  const out = new Map<number, FootprintShape>();
  for (const fp of list) {
    const kind = fp.kind ?? 'building';
    if (!keep(kind)) continue;
    const i = tileIndex(map, fp.hex);
    if (i < 0) continue;
    const shape: FootprintShape = { rx: fp.rx, ry: fp.ry, kind };
    if (fp.cx) shape.cx = fp.cx;
    if (fp.cy) shape.cy = fp.cy;
    const old = out.get(i);
    if (!old) {
      out.set(i, shape);
      continue;
    }
    const bigger = fp.rx * fp.ry > old.rx * old.ry ? shape : old;
    const merged: FootprintShape = {
      rx: Math.max(old.rx, fp.rx),
      ry: Math.max(old.ry, fp.ry),
      kind: KIND_RANK[kind] > KIND_RANK[old.kind ?? 'building'] ? kind : old.kind,
    };
    if (bigger.cx) merged.cx = bigger.cx;
    if (bigger.cy) merged.cy = bigger.cy;
    out.set(i, merged);
  }
  return out;
}

/**
 * Paints one slice: its decals, then the code-drawn standing objects back to front (in back
 * slices also the mountain massifs and the terraces under buildings on slopes), then the tree
 * sprites back to front.
 */
function paintSlice(
  view: SliceView,
  items: SliceItems,
  map: MapState,
  tiles: readonly Tile[],
  state: PaintState,
  art: Readonly<Record<WoodKind, readonly LoadedTree[]>>,
  size: number,
): void {
  const { g, root } = view;
  g.clear();
  if (root.children.length > 1) for (const child of root.removeChildren(1)) child.destroy();
  const { footprints, units, roads, explored } = state;
  /** Is a ground point free? Decals ignore units; standing objects make room for both. */
  const free = (x: number, y: number, standing: boolean): boolean => {
    const h = pixelToHex({ x, y }, size);
    const i = tileIndex(map, h);
    if (i < 0) return true;
    const c = hexToPixel(h, size);
    const rel = { x: x - c.x, y: y - c.y };
    const fp = footprints.get(i);
    // Fields on hills lie on top of the slope: only standing objects make room there
    if (fp && (standing || fp.kind !== 'field') && insideFootprint(rel, fp, size)) return false;
    const unit = units.get(i);
    if (standing && unit && insideFootprint(rel, unit, size)) return false;
    const clear = standing ? ROAD_CLEAR : ROAD_CLEAR_DECAL;
    return roadDistance(rel, roads[i], size) >= clear * size;
  };
  const shown = (tile: number): boolean => explored === null || explored[tile] === true;
  /** A decal with a size (a meadow cluster) shows only where all of it is free. */
  const freeDecal = (d: Decal): boolean => {
    if (!free(d.x, d.y, false)) return false;
    if (d.rx === undefined || d.ry === undefined) return true;
    const rx = d.rx * 0.8;
    const ry = d.ry * 0.8;
    return (
      free(d.x - rx, d.y, false) &&
      free(d.x + rx, d.y, false) &&
      free(d.x, d.y - ry, false) &&
      free(d.x, d.y + ry, false)
    );
  };

  // Meadow clusters first (patches, stones, flowers; back to front), then the small decals
  const decals = new FillGroups();
  const clusters: Decal[] = [];
  for (const { tile, item } of items.decals) {
    if (!shown(tile) || !freeDecal(item)) continue;
    if (item.cell === undefined) decals.add(item.color, item.alpha, item.poly);
    else clusters.push(item);
  }
  clusters.sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0) || a.y - b.y || a.x - b.x);
  for (const d of clusters) fillCluster(g, d);
  decals.fill(g);

  const visible: Standing[] = [];
  for (const { tile, item } of items.standing) {
    if (shown(tile) && (item.behindBuilding || free(item.x, item.y, true))) visible.push(item);
  }
  const massifs: Standing[] = [];
  for (const i of items.relief) {
    if (!shown(i)) continue;
    const t = tiles[i];
    // A field keeps the hill (or mountain) whole: no terrace, no cut
    const tileFp = footprints.get(i) ?? null;
    const fp = tileFp?.kind === 'field' ? null : tileFp;
    // A mine or quarry digs into the slope; any other building stands on a terrace
    const cut = fp?.kind === 'mineCut' || fp?.kind === 'quarryCut' ? fp.kind : null;
    if (cut) visible.push(cutStanding(t.center, cut, t.terrain, size));
    else if (fp) visible.push(...terraceStanding(t.center, fp, t.terrain, size));
    if (t.terrain === 'mountains') {
      // The main massif, then the flanks around a mine or quarry; cliffs into the sea in front
      const plans = massifPlans(map, t.hex, size, fp);
      const cliffs = cut ? [] : coastCliffs(map, t.hex, size);
      plans.forEach((plan, k) => {
        massifs.push(massifStanding(plan, size, 760 + k, k === 0 ? cliffs : []));
      });
    }
  }
  // Back to front; the massifs stand behind everything else in their slice
  visible.sort((a, b) => a.y - b.y);
  visible.unshift(...massifs);

  const trees: TreePlan[] = [];
  for (const { tile, item } of items.sprites) {
    if (shown(tile) && free(item.x, item.y, true)) trees.push(item);
  }
  trees.sort((a, b) => a.y - b.y || a.x - b.x);

  // All ground shadows first, so no shadow lies on an object
  const shadows = new FillGroups();
  for (const s of visible) if (s.shadow) shadows.add(P.shadowColor, s.shadowAlpha, s.shadow);
  if (F.spriteShadowAlpha > 0) {
    for (const t of trees) {
      const r = crownRadius(t.kind, size) * t.scale;
      shadows.add(
        P.shadowColor,
        F.spriteShadowAlpha,
        ellipsePoints(t.x + r * 0.35, t.y + r * 0.08, r * 1.05, r * 0.38, 10),
      );
    }
  }
  shadows.fill(g);
  for (const s of visible) for (const shape of s.shapes) fillShape(g, shape);

  for (const t of trees) {
    const choices = art[t.kind];
    if (choices.length === 0) continue;
    const tex = choices[t.variant % choices.length].sprite;
    const sprite = new Sprite(tex.texture);
    sprite.anchor.set(tex.anchorX, tex.anchorY);
    sprite.scale.set(tex.scale * t.scale);
    sprite.position.set(t.x, t.y);
    // A little brighter or darker each (never mirrored: that would flip the light)
    sprite.tint = mixColor(F.tintMin, 0xffffff, tileHash(Math.round(t.x), Math.round(t.y), 840));
    root.addChild(sprite);
  }
}

/** Tile indices whose road mask, explored flag or footprint changed (null = all). */
function changedTiles<T>(prev: readonly T[], next: readonly T[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < next.length; i++) if (prev[i] !== next[i]) out.push(i);
  return out;
}

/** Rows to repaint for changed tiles: their own row and the rows above and below. */
function rowsAround(tiles: readonly number[], width: number, height: number): number[] {
  const rows = new Set<number>();
  for (const i of tiles) {
    const row = Math.floor(i / width);
    for (let r = row - 1; r <= row + 1; r++) if (r >= 0 && r < height) rows.add(r);
  }
  return [...rows].sort((a, b) => a - b);
}

/** World point -> distance to the shore of the tile it lies in (Infinity off the map / inland). */
function shoreDistanceAt(map: MapState, tiles: readonly Tile[], size: number) {
  return (p: Point): number => {
    const i = tileIndex(map, pixelToHex(p, size));
    if (i < 0) return Infinity;
    const t = tiles[i];
    return shoreDistance(t, { x: p.x - t.center.x, y: p.y - t.center.y }, size);
  };
}

/** World point -> distance to the nearest edge of its tile toward anything but forest. */
function openDistanceAt(map: MapState, tiles: readonly Tile[], size: number) {
  return (p: Point): number => {
    const i = tileIndex(map, pixelToHex(p, size));
    if (i < 0) return 0;
    const t = tiles[i];
    const open = t.across.map((n) => n !== 'forest');
    return distanceToWavyEdges({ x: p.x - t.center.x, y: p.y - t.center.y }, open, t.waves, size);
  };
}

/** Creates the static terrain layers for a map; `art`: the drawn trees (else trees drawn in code). */
export function createTerrainLayer(map: MapState, size: number, art?: TerrainArt): TerrainLayer {
  const tiles = buildTiles(map, size);
  const ground = new Graphics();
  const field = depthFieldOf(map, tiles, size);
  const depth = paintGround(ground, tiles, map, field, size);
  // The depth texture belongs to this map only: freed with the ground
  ground.once('destroyed', () => depth.destroy(true));

  const sprites = artOf(art);
  const kinds: ArtKinds = {
    pine: sprites.pine.length > 0,
    oak: sprites.oak.length > 0,
    cypress: sprites.cypress.length > 0,
    shrub: sprites.shrub.length > 0,
    olive: sprites.olive.length > 0,
  };
  // With tree art the forests become dense woodland, else the code-drawn trees stay
  const woodland = kinds.pine || kinds.oak || kinds.cypress;
  const woodByTile = new Map<number, WoodTree[]>();
  if (woodland) {
    // The exact crown of the variant that will be drawn (kinds without art: the nominal one)
    const crownOf = (kind: WoodKind, variant: number): number => {
      const loaded = sprites[kind];
      if (loaded.length === 0) return F.crown[kind];
      return F.treeCrowns[loaded[variant % loaded.length].id];
    };
    const trees = woodlandTrees(
      map,
      size,
      shoreDistanceAt(map, tiles, size),
      openDistanceAt(map, tiles, size),
      crownOf,
    );
    for (const tree of trees) {
      const list = woodByTile.get(tree.tile);
      if (list) list.push(tree);
      else woodByTile.set(tree.tile, [tree]);
    }
  }
  const plans = tiles.map((t) =>
    planTile(t, size, kinds, woodland ? (woodByTile.get(t.index) ?? []) : null, map, field),
  );

  // Sort every item into the slice of its ground point
  const sliceCount = 2 * map.height;
  const slices: SliceItems[] = [];
  for (let s = 0; s < sliceCount; s++)
    slices.push({ decals: [], standing: [], sprites: [], relief: [] });
  const sliceOf = (y: number): number => sliceOfY(y, size, map.height);
  plans.forEach((plan, i) => {
    const row = Math.floor(i / map.width);
    for (const d of plan.decals) slices[sliceOf(d.y)].decals.push({ tile: i, item: d });
    for (const s of plan.standing) {
      slices[s.behindBuilding ? 2 * row : sliceOf(s.y)].standing.push({ tile: i, item: s });
    }
    for (const t of plan.sprites) slices[sliceOf(t.y)].sprites.push({ tile: i, item: t });
    const terrain = tiles[i].terrain;
    if (terrain === 'mountains' || terrain === 'hills') slices[2 * row].relief.push(i);
  });

  const state: PaintState = {
    footprints: new Map<number, FootprintShape>(),
    units: new Map<number, FootprintShape>(),
    roads: new Array<number>(map.tiles.length).fill(0),
    explored: null,
  };
  const mapWidth = (map.width + 1) * Math.sqrt(3) * size;
  const views: SliceView[] = slices.map((_, s) => {
    const root = new Container();
    const g = new Graphics();
    root.addChild(g);
    root.zIndex = sliceDepthKey(s);
    // Off-screen slices are skipped by the culler (if the app runs one): the slice's ground
    // band plus room for tall mountains and trees above it and shadows below
    const row = Math.floor(s / 2);
    const top = (row - 0.75) * 1.5 * size - 2 * size;
    root.cullable = true;
    root.cullArea = new Rectangle(-2 * size, top, mapWidth + 4 * size, 4.6 * size);
    root.cullableChildren = false;
    // Its own render group: the sprites keep their batches while the camera pans and zooms
    // (only the group moves), about 7x cheaper per frame than plain containers on a full map
    root.isRenderGroup = true;
    return { root, g };
  });
  const paintRows = (rows: readonly number[]): void => {
    for (const r of rows) {
      for (const s of [2 * r, 2 * r + 1]) {
        paintSlice(views[s], slices[s], map, tiles, state, sprites, size);
      }
    }
  };
  paintRows(Array.from({ length: map.height }, (_, r) => r));

  return {
    ground,
    rows: views.map((v) => v.root),
    setFootprints(list) {
      const buildings = mergeFootprints(map, list, (k) => k !== 'unit');
      const units = mergeFootprints(map, list, (k) => k === 'unit');
      const dirty = new Set([
        ...footprintRowsToRepaint(state.footprints, buildings, map.width, map.height),
        ...footprintRowsToRepaint(state.units, units, map.width, map.height),
      ]);
      state.footprints = buildings;
      state.units = units;
      paintRows([...dirty].sort((a, b) => a - b));
    },
    setRoads(roads) {
      const next = roadMasks(map, roads);
      const dirty = rowsAround(changedTiles(state.roads, next), map.width, map.height);
      state.roads = next;
      paintRows(dirty);
    },
    setExplored(explored) {
      const prev = state.explored;
      const next = explored === null ? null : [...explored];
      let changed: number[];
      if (prev === null && next === null) changed = [];
      else if (prev === null || next === null) changed = tiles.map((t) => t.index);
      else changed = changedTiles(prev, next);
      state.explored = next;
      paintRows(rowsAround(changed, map.width, map.height));
    },
  };
}
