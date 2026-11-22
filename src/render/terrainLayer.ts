// Painted terrain: drawn ONCE into two Graphics when the map view is created, never per frame.
// `ground`: tile fills, sea blends, beaches, faint outlines, foam and waves (all flat).
// `details`: grass, flowers, then hills, peaks and trees tile by tile (back to front).
// Light comes from the upper left, so shadows fall to the lower right (docs/ART.md).
import { Graphics } from 'pixi.js';
import { hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex } from '../core/map';
import type { MapState } from '../core/state';
import type { TerrainId } from '../data/terrain';
import { insetBands, insetEdge, insetRuns, insetStrips, mapEdgeNeighborIndex } from './geometry';
import {
  distanceToEdges,
  edgeMask,
  ellipsePoints,
  forestTrees,
  hillMounds,
  isWater,
  mountainPeaks,
  shoreMask,
  tileBaseColor,
  taperedStroke,
  tileRng,
  type MoundSpot,
  type PeakSpot,
  type TreeSpot,
} from './terrain';
import { theme } from './theme';

const P = theme.terrainPaint;

/** Ground tiles are drawn this much larger (px) so no hairline seams show between them. */
const SEAM_PAD = 0.5;

/** All six edges (for "keep away from the tile border" checks). */
const ALL_EDGES: readonly boolean[] = [true, true, true, true, true, true];

export interface TerrainLayer {
  ground: Graphics;
  details: Graphics;
}

interface Tile {
  hex: Hex;
  terrain: TerrainId;
  center: Point;
  corners: Point[];
  /** Edges where land meets water (beach on land, foam on water). */
  shore: boolean[];
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

/**
 * Band along `mask` edges whose inner side wobbles a little (beach). Each edge is one polygon;
 * the inner side bulges by up to `wobble` px, but meets the neighbors exactly at its ends.
 */
function wobblyBands(
  tile: Tile,
  mask: readonly boolean[],
  depth: number,
  wobble: number,
  salt: number,
): number[][] {
  const polys: number[][] = [];
  const { center, corners } = tile;
  for (let e = 0; e < 6; e++) {
    if (!mask[e]) continue;
    const rng = tileRng(tile.hex.q, tile.hex.r, salt + e);
    const [start, end] = insetEdge(center, corners, e, depth, mask[(e + 5) % 6], mask[(e + 1) % 6]);
    const a = corners[e];
    const b = corners[(e + 1) % 6];
    const mid = lerp(a, b, 0.5);
    const len = Math.hypot(center.x - mid.x, center.y - mid.y) || 1;
    const n = { x: (center.x - mid.x) / len, y: (center.y - mid.y) / len };
    const pts: Point[] = [a, b, end];
    for (const t of [0.25, 0.5, 0.75]) {
      const p = lerp(end, start, t);
      const bulge = 4 * t * (1 - t) * (rng() - 0.4) * 2 * wobble;
      pts.push({ x: p.x + n.x * bulge, y: p.y + n.y * bulge });
    }
    pts.push(start);
    polys.push(flat(pts));
  }
  return polys;
}

/** Ground fills, sea blends, beaches, outlines, foam and waves. */
function paintGround(g: Graphics, tiles: readonly Tile[], map: MapState, size: number): void {
  // 1. Tile fills, each with its own slight color variation
  for (const t of tiles) {
    g.poly(flat(hexCorners(t.center, size + SEAM_PAD))).fill(tileBaseColor(t.terrain, t.hex));
  }

  // 2. Water blends: deep ocean fades into the turquoise coast, shallow water along the shore.
  // Stacked translucent bands of growing depth: the color fades out in small steps.
  const coastIntoOcean: number[][] = [];
  const oceanIntoCoast: number[][] = [];
  const shallow: number[][] = [];
  const stacked = (out: number[][], t: Tile, mask: boolean[], depths: readonly number[]): void => {
    if (!mask.some(Boolean)) return;
    for (const d of depths) {
      for (const b of insetBands(t.center, t.corners, mask, d * size)) out.push(flat(b));
    }
  };
  const shallowDepths = [P.shallowDepth / 3, (P.shallowDepth * 2) / 3, P.shallowDepth];
  for (const t of tiles) {
    if (t.terrain === 'coast') {
      stacked(
        coastIntoOcean,
        t,
        edgeMask(map, t.hex, (n) => n === 'ocean'),
        P.seaBlendDepths,
      );
      stacked(shallow, t, t.shore, shallowDepths);
    } else if (t.terrain === 'ocean') {
      stacked(
        oceanIntoCoast,
        t,
        edgeMask(map, t.hex, (n) => n === 'coast'),
        P.seaBlendDepths,
      );
    }
  }
  fillAll(g, coastIntoOcean, theme.terrainColors.ocean, P.seaBlendAlpha);
  fillAll(g, oceanIntoCoast, theme.terrainColors.coast, P.seaBlendAlpha);
  fillAll(g, shallow, P.shallowColor, P.shallowAlpha);

  // 3. Beaches on land tiles along the water (pebbles below mountains)
  const sandFringe: number[][] = [];
  const sand: number[][] = [];
  const pebbleFringe: number[][] = [];
  const pebbles: number[][] = [];
  const wet: number[][] = [];
  for (const t of tiles) {
    if (isWater(t.terrain) || !t.shore.some(Boolean)) continue;
    const rocky = t.terrain === 'mountains';
    const wobble = P.beachWobble * size;
    (rocky ? pebbleFringe : sandFringe).push(
      ...wobblyBands(t, t.shore, P.beachFringeDepth * size, wobble, 40),
    );
    (rocky ? pebbles : sand).push(...wobblyBands(t, t.shore, P.beachDepth * size, wobble, 50));
    for (const b of insetBands(t.center, t.corners, t.shore, P.beachWetDepth * size)) {
      wet.push(flat(b));
    }
  }
  fillAll(g, sandFringe, P.sandColor, P.beachFringeAlpha);
  fillAll(g, pebbleFringe, P.pebbleColor, P.beachFringeAlpha);
  fillAll(g, sand, P.sandColor);
  fillAll(g, pebbles, P.pebbleColor);
  fillAll(g, wet, P.sandWetColor, P.beachWetAlpha);

  // 4. Faint outlines: each shared edge once; none between land and water (the beach shows it)
  const landLines: [Point, Point][] = [];
  const changeLines: [Point, Point][] = [];
  const waterLines: [Point, Point][] = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    for (let e = 0; e < 6; e++) {
      const n = mapEdgeNeighborIndex(map, t.hex, e);
      if (n < i) continue; // map border (-1) or already drawn from the other side
      const other = map.tiles[n];
      const line: [Point, Point] = [t.corners[e], t.corners[(e + 1) % 6]];
      const w1 = isWater(t.terrain);
      const w2 = isWater(other);
      if (w1 && w2) waterLines.push(line);
      else if (w1 !== w2) continue;
      else if (other === t.terrain) landLines.push(line);
      else changeLines.push(line);
    }
  }
  const outline = { color: theme.outlineColor, width: theme.outlineWidth };
  strokeLines(g, waterLines, { ...outline, alpha: theme.outlineWaterAlpha });
  strokeLines(g, landLines, { ...outline, alpha: theme.outlineAlpha });
  strokeLines(g, changeLines, { ...outline, alpha: theme.outlineChangeAlpha });

  // 5. Foam along the shore, a broken wave line further out, glints and open-sea waves.
  // All drawn as filled shapes (strips and pointed brush strokes): cheap and painterly.
  const foam: number[][] = [];
  const foamOuter: number[][] = [];
  const glints: number[][] = [];
  const waves: number[][] = [];
  const half = P.foamWidth / 2;
  for (const t of tiles) {
    if (t.terrain === 'coast') {
      for (const s of insetStrips(
        t.center,
        t.corners,
        t.shore,
        P.foamInset - half,
        P.foamInset + half,
      )) {
        foam.push(flat(s));
      }
      const rng = tileRng(t.hex.q, t.hex.r, 60);
      for (const run of insetRuns(t.center, t.corners, t.shore, P.foamOuterInset)) {
        const pts = run.closed ? [...run.points, run.points[0]] : run.points;
        for (let i = 1; i < pts.length; i++) {
          // Two dashes per edge, some left out
          for (const [s0, s1] of [
            [0.08, 0.46],
            [0.56, 0.92],
          ]) {
            if (rng() < 0.25) continue;
            const j = (rng() - 0.5) * 0.08;
            const dash = [lerp(pts[i - 1], pts[i], s0 + j), lerp(pts[i - 1], pts[i], s1 + j)];
            foamOuter.push(taperedStroke(dash, P.foamWidth * 0.9));
          }
        }
      }
      const glintCount = rng() < 0.5 ? 1 : 2;
      for (let k = 0; k < glintCount; k++) {
        const p = { x: (rng() - 0.5) * 0.9 * size, y: (rng() - 0.5) * 0.8 * size };
        if (distanceToEdges(p, t.shore, size) < 0.42 * size) continue;
        // Small wave crest: a flat arch
        const len = (3.5 + rng() * 2.5) * (size / 32);
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

/** Flat ground decoration: sunny patches, grass tufts and flowers (all tiles grouped). */
function paintGroundDecals(g: Graphics, tiles: readonly Tile[], size: number): void {
  const patches: number[][] = [];
  const grass: number[][] = [];
  const hillGrass: number[][] = [];
  const flowers: number[][][] = P.flowerColors.map(() => []);
  const k = size / 32;
  for (const t of tiles) {
    if (t.terrain !== 'plains' && t.terrain !== 'hills') continue;
    const rng = tileRng(t.hex.q, t.hex.r, 20);
    const plains = t.terrain === 'plains';
    if (plains && rng() < P.sunPatchChance) {
      const rx = (0.22 + rng() * 0.12) * size;
      const cx = t.center.x + (rng() - 0.5) * 0.5 * size;
      const cy = t.center.y + (rng() - 0.5) * 0.4 * size;
      patches.push(ellipsePoints(cx, cy, rx, rx * 0.55, 10, 0.14, rng));
    }
    // Random spot inside the tile, away from the beach; null if it does not fit
    const spot = (minShore: number): Point | null => {
      const p = { x: (rng() - 0.5) * 1.2 * size, y: (rng() - 0.5) * 1.1 * size };
      if (distanceToEdges(p, ALL_EDGES, size) < 0.12 * size) return null;
      if (distanceToEdges(p, t.shore, size) < minShore * size) return null;
      return { x: t.center.x + p.x, y: t.center.y + p.y };
    };
    const tufts = plains ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    for (let i = 0; i < tufts; i++) {
      const p = spot(0.26);
      if (!p) continue;
      for (const side of [-1, 0, 1]) {
        const bx = p.x + side * 0.9 * k;
        const tipX = bx + side * 0.8 * k + (rng() - 0.5) * 0.6 * k;
        const tipY = p.y - (2.4 + rng() * 1.4 - Math.abs(side) * 0.5) * k;
        (plains ? grass : hillGrass).push([bx - 0.55 * k, p.y, bx + 0.55 * k, p.y, tipX, tipY]);
      }
    }
    if (!plains) continue;
    const flowerCount = Math.floor(rng() * 4);
    for (let i = 0; i < flowerCount; i++) {
      const p = spot(0.24);
      if (!p) continue;
      const r = 1.1 * k;
      const color = Math.floor(rng() * flowers.length);
      flowers[color].push([p.x, p.y - r, p.x + r, p.y, p.x, p.y + r, p.x - r, p.y]);
    }
  }
  fillAll(g, patches, P.sunPatchColor, P.sunPatchAlpha);
  fillAll(g, grass, P.grassColor, P.grassAlpha);
  fillAll(g, hillGrass, P.hillGrassColor, P.grassAlpha);
  P.flowerColors.forEach((color, i) => fillAll(g, flowers[i], color));
}

function paintTrees(g: Graphics, c: Point, trees: readonly TreeSpot[], size: number): void {
  // All ground shadows of the tile first, so no shadow lies on a tree
  const shadows: number[][] = [];
  for (const tree of trees) {
    const k = tree.scale * size;
    const fx = c.x + tree.x;
    const fy = c.y + tree.y;
    // Pines throw a round shadow, cypresses a long thin one
    const [rx, ry] = tree.kind === 'pine' ? [0.2 * k, 0.065 * k] : [0.17 * k, 0.045 * k];
    shadows.push(ellipsePoints(fx + 0.13 * k, fy + 0.01 * k, rx, ry, 10));
  }
  fillAll(g, shadows, P.shadowColor, P.shadowAlpha);

  for (const tree of trees) {
    const k = tree.scale * size;
    const fx = c.x + tree.x;
    const fy = c.y + tree.y;
    if (tree.kind === 'pine') {
      // Umbrella pine: thin trunk, wide flat canopy (dark base, lit top-left, small highlight)
      const lean = (tree.x / size) * 0.03 * k;
      g.poly([
        fx - 0.022 * k,
        fy,
        fx + 0.022 * k,
        fy,
        fx + 0.014 * k + lean,
        fy - 0.25 * k,
        fx - 0.014 * k + lean,
        fy - 0.25 * k,
      ]).fill(P.trunkColor);
      const cx = fx + lean;
      const cy = fy - 0.3 * k;
      const rng = tileRng(Math.round(fx), Math.round(fy), 80);
      g.poly(ellipsePoints(cx, cy, 0.2 * k, 0.105 * k, 12, 0.08, rng)).fill(theme.treeColor);
      g.poly(
        ellipsePoints(cx - 0.035 * k, cy - 0.028 * k, 0.145 * k, 0.065 * k, 10, 0.1, rng),
      ).fill(P.pineLight);
      g.poly(ellipsePoints(cx - 0.075 * k, cy - 0.045 * k, 0.06 * k, 0.028 * k, 6)).fill(
        P.pineHighlight,
      );
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
      g.poly(flat([...left, tip, ...right])).fill(P.cypressDark);
      g.poly(
        flat([
          ...left,
          tip,
          { x: fx - 0.1 * w, y: by - 0.55 * h },
          { x: fx - 0.15 * w, y: by - 0.05 * h },
        ]),
      ).fill(P.cypressLight);
    }
  }
}

function paintMounds(g: Graphics, c: Point, mounds: readonly MoundSpot[], size: number): void {
  const shadows = mounds.map((m) =>
    ellipsePoints(c.x + m.x + 0.3 * m.w, c.y + m.y + 0.02 * size, m.w * 0.95, 0.085 * size, 12),
  );
  fillAll(g, shadows, P.shadowColor, P.shadowAlpha * 0.75);
  for (const m of mounds) {
    const left = { x: c.x + m.x - m.w, y: c.y + m.y };
    const right = { x: c.x + m.x + m.w, y: c.y + m.y };
    const top = { x: c.x + m.x, y: c.y + m.y - m.h };
    // Dome = quadratic curve from left to right over (x, y - 2h); its apex is `top`
    const control = { x: top.x, y: c.y + m.y - 2 * m.h };
    g.poly(flat([left, ...quadPoints(left, control, right, 10)])).fill(P.moundLight);
    // Sunlit crest: a thin crescent along the upper left of the dome
    const crestStart = { x: left.x + 0.25 * m.w, y: left.y - 0.42 * m.h };
    const crestEnd = { x: top.x + 0.12 * m.w, y: top.y + 0.02 * m.h };
    g.poly(
      flat([
        crestStart,
        ...quadPoints(crestStart, { x: left.x + 0.5 * m.w, y: top.y - 0.06 * m.h }, crestEnd, 4),
        ...quadPoints(crestEnd, { x: left.x + 0.55 * m.w, y: top.y + 0.2 * m.h }, crestStart, 4),
      ]),
    ).fill(P.moundCrest);
    // Shaded right flank: right half of the dome, back along a softer inner curve
    const halfControl = { x: top.x + m.w / 2, y: top.y };
    const foot = { x: top.x + 0.18 * m.w, y: right.y };
    const inner = { x: top.x + 0.12 * m.w, y: top.y + 0.5 * m.h };
    g.poly(
      flat([
        top,
        ...quadPoints(top, halfControl, right, 5),
        foot,
        ...quadPoints(foot, inner, top, 4),
      ]),
    ).fill(theme.hillColor);
  }
}

/** Small olive shrubs dotted over a hills tile (dark base, lit top-left). */
function paintShrubs(g: Graphics, t: Tile, size: number, rng: () => number): void {
  const count = 2 + Math.floor(rng() * 3);
  const dark: number[][] = [];
  const light: number[][] = [];
  for (let i = 0; i < count; i++) {
    const p = { x: (rng() - 0.5) * 1.1 * size, y: (rng() - 0.5) * 1.0 * size };
    if (distanceToEdges(p, ALL_EDGES, size) < 0.14 * size) continue;
    if (distanceToEdges(p, t.shore, size) < 0.28 * size) continue;
    const r = (0.06 + rng() * 0.03) * size;
    const x = t.center.x + p.x;
    const y = t.center.y + p.y;
    dark.push(ellipsePoints(x, y, r, r * 0.72, 8, 0.12, rng));
    light.push(ellipsePoints(x - r * 0.25, y - r * 0.25, r * 0.62, r * 0.42, 7));
  }
  fillAll(g, dark, P.shrubDark);
  fillAll(g, light, P.shrubColor);
}

function paintPeaks(
  g: Graphics,
  c: Point,
  peaks: readonly PeakSpot[],
  size: number,
  rng: () => number,
): void {
  const shadows = peaks.map((p) =>
    ellipsePoints(c.x + p.x + 0.35 * p.hw, c.y + p.y + 0.02 * size, p.hw * 0.95, 0.08 * size, 12),
  );
  fillAll(g, shadows, P.shadowColor, P.shadowAlpha);
  // Loose rocks on the ground (mostly hidden behind the peaks, visible at the edges)
  const rocks: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const r = (0.035 + rng() * 0.03) * size;
    const x = c.x + (rng() - 0.5) * 1.2 * size;
    const y = c.y + (0.1 + rng() * 0.5) * size;
    if (distanceToEdges({ x: x - c.x, y: y - c.y }, ALL_EDGES, size) < r * 2) {
      continue;
    }
    rocks.push(ellipsePoints(x, y, r, r * 0.6, 5, 0.25, rng));
  }
  fillAll(g, rocks, P.screeColor);
  for (const p of peaks) {
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
    g.poly(flat([left, leftMid, tip, ridge, foot])).fill(P.rockLight);
    g.poly(flat([tip, rightMid, right, foot, ridge])).fill(theme.mountainColor);
    // A dark crevice running down the lit face
    const top = lerp(tip, ridge, 0.3);
    const bottom = lerp(left, foot, 0.45 + j(0.15));
    const cw = 0.05 * p.hw;
    g.poly([top.x, top.y, bottom.x + cw, bottom.y, bottom.x - cw, bottom.y]).fill({
      color: theme.mountainColor,
      alpha: 0.45,
    });
    if (!p.snow) continue;
    // Snow cap with a zigzag lower edge; its right side lies in the cool shade
    const sl = lerp(tip, leftMid, 0.62);
    const sr = lerp(tip, rightMid, 0.56);
    const sj = lerp(tip, ridge, 0.7);
    const z1 = { x: sl.x + (sj.x - sl.x) * 0.35, y: sl.y + (sj.y - sl.y) * 0.35 + 0.07 * p.h };
    const z2 = { x: sl.x + (sj.x - sl.x) * 0.7, y: sl.y + (sj.y - sl.y) * 0.7 - 0.02 * p.h };
    const z3 = { x: (sj.x + sr.x) / 2, y: (sj.y + sr.y) / 2 + 0.06 * p.h };
    g.poly(flat([tip, sl, z1, z2, sj])).fill(theme.mountainPeakColor);
    g.poly(flat([tip, sj, z3, sr])).fill(P.snowShade);
  }
}

/** Standing objects (hills, peaks, trees) tile by tile in row order, so lower rows cover upper ones. */
function paintStanding(g: Graphics, tiles: readonly Tile[], size: number): void {
  for (const t of tiles) {
    if (t.terrain === 'forest') {
      paintTrees(
        g,
        t.center,
        forestTrees(tileRng(t.hex.q, t.hex.r, 30), size, t.shore, P.cypressShare),
        size,
      );
    } else if (t.terrain === 'hills') {
      const rng = tileRng(t.hex.q, t.hex.r, 31);
      paintMounds(g, t.center, hillMounds(rng, size), size);
      paintShrubs(g, t, size, rng);
    } else if (t.terrain === 'mountains') {
      const rng = tileRng(t.hex.q, t.hex.r, 32);
      paintPeaks(g, t.center, mountainPeaks(rng, size), size, rng);
    }
  }
}

/** Paints the whole map into `ground` and `details` (both are cleared first). */
export function paintTerrain(
  map: MapState,
  size: number,
  ground: Graphics,
  details: Graphics,
): void {
  ground.clear();
  details.clear();
  const tiles: Tile[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    const hex = hexAtIndex(map, i);
    const center = hexToPixel(hex, size);
    tiles.push({
      hex,
      terrain: map.tiles[i],
      center,
      corners: hexCorners(center, size),
      shore: shoreMask(map, hex),
    });
  }
  paintGround(ground, tiles, map, size);
  paintGroundDecals(details, tiles, size);
  paintStanding(details, tiles, size);
}

/** Creates the static terrain layers for a map. */
export function createTerrainLayer(map: MapState, size: number): TerrainLayer {
  const ground = new Graphics();
  const details = new Graphics();
  paintTerrain(map, size, ground, details);
  return { ground, details };
}
