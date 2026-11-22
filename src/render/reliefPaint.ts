// Painting of hills and mountains (PixiJS shapes from the plans in relief.ts): the rolling hill
// mounds in the flat ground, the texture on the hills (dry grass, maquis, olive trees, limestone),
// the faceted mountain massifs with snow and strata, scree and boulders, and the terrace under a
// building on a slope. Shading uses two small reusable textures (a soft spot and the mound
// shading), mapped onto each shape, so a mound costs only one polygon.
import { BufferImageSource, Graphics, Texture } from 'pixi.js';
import type { Point } from '../core/hex';
import type { TerrainId } from '../data/terrain';
import {
  faceShadePixels,
  massifFacets,
  mineCut,
  moundOutline,
  quarryCut,
  moundShadePixels,
  project,
  softSpotPixels,
  terraceArc,
  type HillMound,
  type MassifPlan,
  type P3,
} from './relief';
import type { TreePlan } from './forest';
import { ellipsePoints, taperedStroke, tileRng, type FootprintShape } from './terrain';
import { theme } from './theme';

const P = theme.terrainPaint;
const H = P.hills;
const M = P.mountains;
const T = P.terrace;
const C = P.cuts;

/** A filled polygon; with `texture` the texture is stretched over the polygon's bounds and tinted. */
export interface Shape {
  poly: number[];
  color: number;
  alpha: number;
  texture?: ReliefTexture;
}

/** A standing object (tree, shrub, massif, boat ...) with its ground point in world px. */
export interface Standing {
  x: number;
  y: number;
  shadow: number[] | null;
  shadowAlpha: number;
  shapes: Shape[];
  /**
   * True: always painted in the back slice of its own tile's row, i.e. behind the building on
   * that tile (terraces, the massif of a mine), whatever its ground point.
   */
  behindBuilding?: boolean;
}

/** A flat decal (grass, flower, pebble), ground point in world px. */
export interface Decal {
  x: number;
  y: number;
  color: number;
  alpha: number;
  poly: number[];
}

export type ReliefTexture = 'spot' | 'mound' | 'face';

const textures: Partial<Record<ReliefTexture, Texture>> = {};

/** The shared shading textures (made once, from pixels: no canvas needed). */
export function reliefTexture(kind: ReliefTexture): Texture {
  let tex = textures[kind];
  if (!tex) {
    const n = 64;
    const resource =
      kind === 'spot'
        ? softSpotPixels(n)
        : kind === 'mound'
          ? moundShadePixels(n)
          : faceShadePixels(n);
    tex = new Texture({
      source: new BufferImageSource({
        resource,
        width: n,
        height: n,
        format: 'rgba8unorm',
        alphaMode: 'premultiplied-alpha',
      }),
    });
    textures[kind] = tex;
  }
  return tex;
}

/** Fills one shape (flat color or tinted texture). */
export function fillShape(g: Graphics, s: Shape): void {
  g.poly(s.poly);
  if (s.texture) {
    g.fill({
      texture: reliefTexture(s.texture),
      color: s.color,
      alpha: s.alpha,
      textureSpace: 'local',
    });
  } else {
    g.fill({ color: s.color, alpha: s.alpha });
  }
}

function flat(points: readonly Point[]): number[] {
  const out: number[] = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}

function lerp3(a: P3, b: P3, t: number): P3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// ---------------------------------------------------------------------------------------------
// Hills
// ---------------------------------------------------------------------------------------------

/**
 * The rolling hill country, back to front: per mound a soft shadow to the lower right, the
 * shaded body (lit upper left, fading into the ground at its foot) and a sunlit rim on the crest.
 */
export function paintHillMounds(g: Graphics, mounds: readonly HillMound[], size: number): void {
  for (const m of mounds) for (const shape of moundShapes(m, size)) fillShape(g, shape);
}

/** One hill mound: soft shadow, shaded body, sunlit rim along the left part of the crest. */
function moundShapes(m: HillMound, size: number, shadow = true): Shape[] {
  const d = m.w * H.depth;
  const outline = moundOutline(m);
  const shapes: Shape[] = [];
  if (shadow) {
    shapes.push({
      poly: ellipsePoints(m.x + 0.3 * m.w, m.y + 0.25 * d, m.w * 1.08, d * 1.25 + 0.1 * m.h, 14),
      color: P.shadowColor,
      alpha: H.shadowAlpha,
      texture: 'spot',
    });
  }
  shapes.push({ poly: flat(outline), color: H.tones[m.tone], alpha: 1, texture: 'mound' });
  shapes.push({
    poly: taperedStroke(outline.slice(1, 8), Math.max(1, 0.05 * size * (m.h / (H.centerH * size)))),
    color: H.crestColor,
    alpha: H.crestAlpha,
  });
  return shapes;
}

/**
 * Decals, standing objects and tree sprites on one hill tile (world px; `ok` says whether a spot
 * is usable). Olive trees and maquis shrubs become sprites when their art is loaded (`art`),
 * else they are drawn in code.
 */
export function hillDetails(
  center: Point,
  size: number,
  rng: () => number,
  ok: (rel: Point, margin: number) => boolean,
  art: { olive: boolean; shrub: boolean } = { olive: false, shrub: false },
): { decals: Decal[]; standing: Standing[]; sprites: TreePlan[] } {
  const k = size / 32;
  const decals: Decal[] = [];
  const standing: Standing[] = [];
  const sprites: TreePlan[] = [];
  const variant = (): number => Math.floor(rng() * 1000);
  const spot = (margin: number, clear: number): Point | null => {
    const p = { x: (rng() - 0.5) * 1.5 * size, y: (rng() - 0.5) * 1.6 * size };
    if (Math.hypot(p.x, p.y * 1.4) < clear * size) return null;
    return ok(p, margin) ? p : null;
  };
  // Dry-grass strokes, leaning a little with the slope
  const strokes = Math.round(H.grassCount * (0.7 + rng() * 0.6));
  for (let i = 0; i < strokes; i++) {
    const p = spot(0.22, 0);
    const lean = (rng() - 0.5) * 1.6 * k;
    const tall = (2 + rng() * 1.8) * k;
    const light = rng() < 0.55;
    if (!p) continue;
    const x = center.x + p.x;
    const y = center.y + p.y;
    for (const dx of [-0.9, 0.9]) {
      decals.push({
        x,
        y,
        color: light ? H.grassLight : H.grassDark,
        alpha: H.grassAlpha,
        poly: [
          x + dx * k - 0.35 * k,
          y,
          x + dx * k + 0.35 * k,
          y,
          x + dx * k + lean + dx * 0.4 * k,
          y - tall * (dx < 0 ? 0.85 : 1),
        ],
      });
    }
  }
  // Pale limestone rocks
  const rocks = Math.floor(rng() * (H.rockMax + 1));
  for (let i = 0; i < rocks; i++) {
    const p = spot(0.26, H.tokenClear);
    const r = (0.05 + rng() * 0.04) * size;
    const shapeRng = tileRng(Math.round(center.x), Math.round(center.y), 640 + i);
    if (!p) continue;
    standing.push(limestone(center.x + p.x, center.y + p.y, r, shapeRng));
  }
  // Maquis shrubs
  const shrubs = H.shrubMin + Math.floor(rng() * (H.shrubMax - H.shrubMin + 1));
  for (let i = 0; i < shrubs; i++) {
    const p = spot(0.24, 0.2);
    const r = (0.055 + rng() * 0.035) * size;
    const shapeRng = tileRng(Math.round(center.x), Math.round(center.y), 650 + i);
    const v = variant();
    if (!p) continue;
    if (art.shrub) {
      const scale = (r / (0.075 * size)) * (0.9 + shapeRng() * 0.2);
      sprites.push({ x: center.x + p.x, y: center.y + p.y, kind: 'shrub', variant: v, scale });
    } else {
      standing.push(maquisStanding(center.x + p.x, center.y + p.y, r, shapeRng));
    }
  }
  // A few olive trees
  let olives = rng() < H.oliveChance ? 1 : 0;
  if (olives && rng() < H.oliveSecondChance) olives++;
  for (let i = 0; i < olives; i++) {
    const p = spot(0.3, H.tokenClear + 0.05);
    const scale = 0.85 + rng() * 0.3;
    const shapeRng = tileRng(Math.round(center.x), Math.round(center.y), 660 + i);
    const v = variant();
    if (!p) continue;
    if (art.olive) {
      sprites.push({ x: center.x + p.x, y: center.y + p.y, kind: 'olive', variant: v, scale });
    } else {
      standing.push(oliveTree(center.x + p.x, center.y + p.y, scale * size, shapeRng));
    }
  }
  standing.sort((a, b) => a.y - b.y);
  return { decals, standing, sprites };
}

function limestone(x: number, y: number, r: number, rng: () => number): Standing {
  // An irregular, flat-topped block: lit top and left, shaded right side
  const pts: Point[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const f = 0.8 + rng() * 0.35;
    pts.push({ x: x + Math.cos(a) * r * f, y: y + Math.sin(a) * r * 0.85 * f });
  }
  pts.push({ x: x + r * 0.9, y: y + r * 0.15 }, { x: x - r * 0.85, y: y + r * 0.2 });
  const shade = [
    { x: x + r * 0.15, y: y - r * 0.55 },
    pts[5],
    pts[6],
    { x: x + r * 0.9, y: y + r * 0.15 },
    { x: x + r * 0.1, y: y + r * 0.22 },
  ];
  return {
    x,
    y,
    shadow: ellipsePoints(x + r * 0.35, y + r * 0.2, r * 1.1, r * 0.4, 8),
    shadowAlpha: P.shadowAlpha,
    shapes: [
      { poly: flat(pts), color: H.rockLight, alpha: 1 },
      { poly: flat(shade), color: H.rockShade, alpha: 1 },
    ],
  };
}

/** A maquis shrub drawn in code (dark green clumps, lit top-left). */
export function maquisStanding(x: number, y: number, r: number, rng: () => number): Standing {
  const shapes: Shape[] = [];
  const blobs = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const bx = x + (i - (blobs - 1) / 2) * r * 0.75 + (rng() - 0.5) * r * 0.3;
    const by = y - r * 0.45 - (i % 2) * r * 0.2;
    const br = r * (0.65 + rng() * 0.3);
    shapes.push({
      poly: ellipsePoints(bx, by, br, br * 0.8, 8, 0.12, rng),
      color: P.shrubDark,
      alpha: 1,
    });
  }
  shapes.push({
    poly: ellipsePoints(x - r * 0.3, y - r * 0.75, r * 0.55, r * 0.36, 7),
    color: P.shrubColor,
    alpha: 1,
  });
  return {
    x,
    y,
    shadow: ellipsePoints(x + r * 0.45, y + r * 0.05, r * 1.25, r * 0.42, 8),
    shadowAlpha: P.shadowAlpha,
    shapes,
  };
}

function oliveTree(x: number, y: number, k: number, rng: () => number): Standing {
  // Gnarled forked trunk, a low wide canopy of silvery green clumps (lit upper left)
  const lean = (rng() - 0.5) * 0.05 * k;
  const top = { x: x + lean, y: y - 0.2 * k };
  const trunk = taperedStroke(
    [{ x, y: y + 0.01 * k }, { x: x + lean * 0.3 - 0.015 * k, y: y - 0.1 * k }, top],
    0.07 * k,
  );
  const shapes: Shape[] = [{ poly: trunk, color: H.oliveTrunk, alpha: 1 }];
  const cy = y - 0.3 * k;
  const clumps = [
    { dx: -0.1, dy: 0.03, r: 0.12 },
    { dx: 0.1, dy: 0.02, r: 0.12 },
    { dx: 0, dy: -0.05, r: 0.13 },
  ];
  for (const c of clumps) {
    shapes.push({
      poly: ellipsePoints(top.x + c.dx * k, cy + c.dy * k, c.r * k, c.r * k * 0.78, 9, 0.14, rng),
      color: H.oliveDark,
      alpha: 1,
    });
  }
  shapes.push({
    poly: ellipsePoints(top.x - 0.03 * k, cy - 0.04 * k, 0.15 * k, 0.09 * k, 9, 0.15, rng),
    color: H.oliveColor,
    alpha: 1,
  });
  shapes.push({
    poly: ellipsePoints(top.x - 0.08 * k, cy - 0.07 * k, 0.07 * k, 0.04 * k, 7),
    color: H.oliveLight,
    alpha: 1,
  });
  return {
    x,
    y,
    shadow: ellipsePoints(x + 0.14 * k, y + 0.01 * k, 0.21 * k, 0.07 * k, 10),
    shadowAlpha: P.shadowAlpha,
    shapes,
  };
}

// ---------------------------------------------------------------------------------------------
// Mountains
// ---------------------------------------------------------------------------------------------

/** Rock color of a facet by its sunlight (0..1). */
function faceColor(light: number): number {
  const [lit, mid, shade, dark] = M.faceColors;
  if (light > M.faceLevels[0]) return lit;
  if (light > M.faceLevels[1]) return mid;
  if (light > M.faceLevels[2]) return shade;
  return dark;
}

/**
 * The massif of a mountain tile as one standing object: a soft shadow to the lower right, the
 * rock facets back to front, strata across the sunlit lower faces, snow around the peak.
 */
export function massifStanding(plan: MassifPlan, size: number, seed: number): Standing {
  const rng = tileRng(Math.round(plan.apex.x), Math.round(plan.apex.y), seed);
  const facets = massifFacets(plan, size, rng);
  const shapes: Shape[] = [];
  // Soft shadow on the ground, to the lower right of the foot
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of plan.base) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y);
  }
  shapes.push({
    poly: ellipsePoints(
      (minX + maxX) / 2 + 0.22 * size,
      (minY + maxY) / 2 + 0.12 * size,
      (maxX - minX) * 0.6,
      (maxY - minY) * 0.55,
      16,
    ),
    color: P.shadowColor,
    alpha: M.shadowAlpha,
    texture: 'spot',
  });
  const snowZ = plan.apex.z * M.snowLine;
  const snowy = plan.apex.z >= M.snowMinPeak * size;
  for (const f of facets) {
    const poly = flat([project(f.a), project(f.b), project(f.c)]);
    shapes.push({ poly, color: faceColor(f.light), alpha: 1, texture: 'face' });
    const top = Math.max(f.a.z, f.b.z, f.c.z);
    // Strata on sunlit lower faces: lines of equal height across the face
    if (top < plan.apex.z - 1 && f.light > 0.45) {
      for (const share of [0.35, 0.65]) {
        const line = strataLine(f, share);
        if (line) shapes.push({ poly: line, color: M.strataColor, alpha: M.strataAlpha });
      }
    }
    // Snow on the faces at the peak (the upper ring touches the apex)
    if (snowy && top >= plan.apex.z - 1e-6) {
      const cap = snowCap(f, plan.apex, snowZ, rng);
      if (cap) {
        shapes.push({
          poly: cap,
          color: f.light > 0.5 ? P.snowColor : P.snowShade,
          alpha: 1,
        });
      }
    }
  }
  return {
    x: plan.apex.x,
    y: plan.apex.y,
    shadow: null,
    shadowAlpha: 0,
    shapes,
    behindBuilding: true,
  };
}

/** A thin line across a facet at `share` of its height range (null if too short). */
function strataLine(f: { a: P3; b: P3; c: P3 }, share: number): number[] | null {
  const pts = [f.a, f.b, f.c].sort((p, q) => q.z - p.z);
  const [hi, mid, lo] = pts;
  const z = lo.z + (hi.z - lo.z) * share;
  const along = (p: P3, q: P3): P3 | null => {
    if ((p.z - z) * (q.z - z) > 0 || p.z === q.z) return null;
    return lerp3(p, q, (z - p.z) / (q.z - p.z));
  };
  const a = along(hi, lo);
  const b = along(hi, mid) ?? along(mid, lo);
  if (!a || !b) return null;
  const pa = project(a);
  const pb = project(b);
  if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 3) return null;
  // Not quite to the facet's sides, so lines of neighboring faces do not touch
  const s = { x: pa.x + (pb.x - pa.x) * 0.12, y: pa.y + (pb.y - pa.y) * 0.12 };
  const e = { x: pa.x + (pb.x - pa.x) * 0.88, y: pa.y + (pb.y - pa.y) * 0.88 };
  return taperedStroke([s, e], 0.9);
}

/** The part of a peak facet above the snow line, with a ragged lower edge (null if none). */
function snowCap(
  f: { a: P3; b: P3; c: P3 },
  apex: P3,
  snowZ: number,
  rng: () => number,
): number[] | null {
  const others = [f.a, f.b, f.c].filter((p) => p !== apex);
  if (others.length !== 2) return null;
  const [p, q] = others;
  const cut = (o: P3): P3 => {
    if (o.z >= snowZ) return o;
    return lerp3(apex, o, (apex.z - snowZ) / (apex.z - o.z));
  };
  const a = cut(p);
  const b = cut(q);
  // Zigzag: a tongue of snow reaching down in the middle
  const m = lerp3(a, b, 0.5);
  const down = lerp3(m, { ...m, z: m.z * 0.6 }, 0.35 + rng() * 0.4);
  return flat([project(apex), project(a), project(lerp3(a, down, 0.5)), project(down), project(b)]);
}

/** Scree stones and boulders at the foot of a massif (ground points in world px). */
export function mountainFootDetails(
  center: Point,
  size: number,
  rng: () => number,
  ok: (rel: Point) => boolean,
): { decals: Decal[]; standing: Standing[] } {
  const decals: Decal[] = [];
  const standing: Standing[] = [];
  for (let i = 0; i < M.screeCount; i++) {
    const a = rng() * Math.PI * 2;
    const d = (0.62 + rng() * 0.3) * (Math.sqrt(3) / 2) * size;
    const p = { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9 };
    const r = (0.022 + rng() * 0.025) * size;
    const light = rng() < 0.45;
    const shapeRng = tileRng(Math.round(center.x), Math.round(center.y), 740 + i);
    if (!ok(p)) continue;
    decals.push({
      x: center.x + p.x,
      y: center.y + p.y,
      color: light ? P.rockLight : P.screeColor,
      alpha: 1,
      poly: ellipsePoints(center.x + p.x, center.y + p.y, r, r * 0.62, 6, 0.25, shapeRng),
    });
  }
  const boulders = Math.floor(rng() * (M.boulderMax + 1));
  for (let i = 0; i < boulders; i++) {
    const a = (0.1 + rng() * 0.8) * Math.PI;
    const d = (0.66 + rng() * 0.2) * (Math.sqrt(3) / 2) * size;
    const p = { x: Math.cos(a) * d, y: Math.sin(a) * d };
    const r = (0.06 + rng() * 0.04) * size;
    const shapeRng = tileRng(Math.round(center.x), Math.round(center.y), 750 + i);
    if (!ok(p)) continue;
    standing.push(boulder(center.x + p.x, center.y + p.y, r, shapeRng));
  }
  return { decals, standing };
}

function boulder(x: number, y: number, r: number, rng: () => number): Standing {
  const [lit, mid, shade] = M.faceColors;
  const top = { x: x - r * 0.15, y: y - r * 1.05 };
  const left = { x: x - r, y: y - r * 0.2 };
  const right = { x: x + r * 0.95, y: y - r * 0.15 };
  const foot = { x: x + r * 0.1, y: y + r * 0.25 };
  const ridge = { x: x + r * 0.2 + (rng() - 0.5) * r * 0.3, y: y - r * 0.35 };
  return {
    x,
    y,
    shadow: ellipsePoints(x + r * 0.45, y + r * 0.2, r * 1.2, r * 0.42, 8),
    shadowAlpha: P.shadowAlpha,
    shapes: [
      { poly: flat([left, top, ridge, foot]), color: lit, alpha: 1 },
      { poly: flat([top, right, foot, ridge]), color: shade, alpha: 1 },
      { poly: flat([left, ridge, foot]), color: mid, alpha: 0.6 },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Terraces
// ---------------------------------------------------------------------------------------------

/**
 * The terrace under a building on a slope: along the middle of the front of its footprint a low
 * earth bank with grass hanging over it (hills) or a dry-stone retaining wall (mountains),
 * highest in the middle and running out into the slope at both ends; on hills also the slope
 * rising behind it. So the building stands on ground cut into the hill, not on a
 * round plateau. Two standing objects (back slope, front edge), sorted with the tile's others.
 */
export function terraceStanding(
  center: Point,
  fp: FootprintShape,
  terrain: TerrainId,
  size: number,
): Standing[] {
  const rng = tileRng(Math.round(center.x), Math.round(center.y), 770);
  const stone = terrain === 'mountains';
  const raw = terraceArc(fp, size, stone ? T.stoneSpan : T.earthSpan, 12);
  const n = raw.length - 1;
  const env = (i: number): number => Math.pow(Math.sin((Math.PI * i) / n), 1.1);
  // The top of the bank lies a little inside the yard, so it replaces the yard's round front rim
  const arc = raw.map((p, i) => {
    const k = 1 - 0.07 * env(i);
    const inner = i > 0 && i < n;
    return {
      x: center.x + p.x * k,
      y: center.y + p.y * k + (inner ? (rng() - 0.5) * T.jitter * size : 0),
    };
  });
  const h = (stone ? T.stoneHeight : T.height) * size;
  const bottom = arc.map((p, i) => ({ x: p.x, y: p.y + h * env(i) }));
  const shapes: Shape[] = [];
  // Fields (a footprint over nearly the whole tile) get no crest behind them: only a front bank
  const field = fp.ry > T.fieldRy * size;
  const back: Standing[] =
    stone || field
      ? []
      : [
          {
            x: center.x,
            y: center.y - fp.ry,
            shadow: null,
            shadowAlpha: 0,
            shapes: terraceBackSlope(center, fp, size, rng),
            behindBuilding: true,
          },
        ];
  // Soft shadow on the ground at the foot of the bank
  const mid = arc[Math.floor(n / 2)];
  const span = Math.abs(arc[0].x - arc[n].x);
  shapes.push({
    poly: ellipsePoints(mid.x + 0.05 * size, mid.y + h * 1.1, span * 0.55, h * 1.3, 14),
    color: P.shadowColor,
    alpha: T.shadowAlpha,
    texture: 'spot',
  });
  if (!stone) {
    shapes.push({
      poly: flat([...arc, ...[...bottom].reverse()]),
      color: T.earthColor,
      alpha: 1,
    });
    const lower = arc.map((p, i) => ({ x: p.x, y: p.y + h * env(i) * 0.45 }));
    shapes.push({
      poly: flat([...lower, ...[...bottom].reverse()]),
      color: T.earthShade,
      alpha: 0.6,
    });
    // Dry grass hanging over the top of the bank
    for (let i = 1; i < n; i++) {
      if (env(i) < 0.25) continue;
      for (let k = 0; k < 2; k++) {
        const p = {
          x: arc[i].x + (arc[i + 1].x - arc[i].x) * (k * 0.5 + rng() * 0.3),
          y: arc[i].y,
        };
        const len = (0.04 + rng() * 0.04) * size * env(i);
        shapes.push({
          poly: [
            p.x - 0.012 * size,
            p.y - 0.01 * size,
            p.x + 0.012 * size,
            p.y - 0.01 * size,
            p.x + (rng() - 0.3) * 0.02 * size,
            p.y + len,
          ],
          color: rng() < 0.5 ? P.hills.grassDark : T.grassColor,
          alpha: 0.9,
        });
      }
    }
  } else {
    // Dry-stone wall: dark joints behind, then two courses of irregular stones
    shapes.push({
      poly: flat([...arc, ...[...bottom].reverse()]),
      color: T.jointColor,
      alpha: 1,
    });
    for (let course = 0; course < 2; course++) {
      const t0 = course * 0.5;
      const t1 = t0 + 0.5;
      const offset = course * 0.5;
      for (let i = 0; i < n; i++) {
        const u0 = Math.min(n, i + offset);
        const u1 = Math.min(n, i + 1 + offset);
        if (u1 - u0 < 0.4) continue;
        const at = (u: number, t: number): Point => {
          const k = Math.floor(Math.min(n - 1, u));
          const f = u - k;
          const a = arc[k];
          const b = arc[k + 1];
          const e = env(k) + (env(k + 1) - env(k)) * f;
          return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + h * e * t };
        };
        const gap = 0.07;
        const quad = [
          at(u0 + gap, t0 + gap),
          at(u1 - gap, t0 + gap),
          at(u1 - gap, t1 - gap),
          at(u0 + gap, t1 - gap),
        ];
        if (quad[3].y - quad[0].y < 0.6) continue;
        const v = rng();
        shapes.push({
          poly: flat(quad),
          color: v < 0.5 ? T.stoneColor : v < 0.8 ? T.stoneLight : T.stoneShade,
          alpha: 1,
        });
      }
    }
  }
  return [
    ...back,
    { x: mid.x, y: mid.y, shadow: null, shadowAlpha: 0, shapes, behindBuilding: true },
  ];
}

/**
 * Behind a building on hills the slope rises again: a broad hill crest whose foot runs along the
 * back of the terrace (it fades out over the back of the yard, so the yard has no round back
 * rim). Painted like the hill mounds; drawn before the building, which stands in front of it.
 */
function terraceBackSlope(
  center: Point,
  fp: FootprintShape,
  size: number,
  rng: () => number,
): Shape[] {
  const m: HillMound = {
    x: center.x + (rng() - 0.5) * 0.1 * size,
    y: center.y - fp.ry * T.backFoot,
    w: fp.rx * T.backWidth,
    h: T.backHeight * size * (0.9 + rng() * 0.2),
    tone: 0,
  };
  const outline = moundOutline(m);
  return [
    { poly: flat(outline), color: H.tones[m.tone], alpha: 1, texture: 'mound' },
    {
      poly: taperedStroke(outline.slice(1, 8), Math.max(1, 0.045 * size)),
      color: H.crestColor,
      alpha: H.crestAlpha,
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Mine and quarry cuts
// ---------------------------------------------------------------------------------------------

/** A thin mark across a face between two edges (at share t of the way from `lo` to `hi`). */
function faceMark(lo: [P3, P3], hi: [P3, P3], t: number, inset: number): number[] {
  const at = (p: P3, q: P3): Point => project(lerp3(p, q, t));
  const a = at(lo[0], hi[0]);
  const b = at(lo[1], hi[1]);
  const s = { x: a.x + (b.x - a.x) * inset, y: a.y + (b.y - a.y) * inset };
  const e = { x: a.x + (b.x - a.x) * (1 - inset), y: a.y + (b.y - a.y) * (1 - inset) };
  return taperedStroke([s, e], 0.8);
}

/**
 * The cut of a mine (`'mineCut'`: one vertical rock face) or quarry (`'quarryCut'`: three stepped
 * terraces) into its tile's slope, painted over the tile's massif (mountains; the massif itself
 * comes from massifPlan with the cut footprint) or over a hill rising behind it (hills). The
 * art draws the works in front of it (docs/ART.md "Mines and quarries dig into the real slope").
 */
export function cutStanding(
  center: Point,
  kind: 'mineCut' | 'quarryCut',
  terrain: TerrainId,
  size: number,
): Standing {
  const rock = terrain === 'mountains';
  const faceColor = rock ? C.rockFace : C.hillFace;
  const endColor = rock ? C.rockEnd : C.hillEnd;
  const topColor = rock ? C.rockTop : C.hillTop;
  const shapes: Shape[] = [];
  const poly = (pts: readonly P3[]): number[] => flat(pts.map(project));
  const lip = (a: P3, b: P3): void => {
    shapes.push({
      poly: taperedStroke([project(a), project(b)], 1.2),
      color: C.lipColor,
      alpha: 0.9,
    });
  };
  if (kind === 'mineCut') {
    const cut = mineCut(center, size);
    if (!rock) {
      // The hill rises behind the face
      const top = project(cut.top[0]);
      const topR = project(cut.top[1]);
      shapes.push(
        ...moundShapes(
          {
            x: (top.x + topR.x) / 2 + 0.06 * size,
            y: (cut.foot[0].y + cut.foot[1].y) / 2 - 0.06 * size,
            w: 0.56 * size,
            h: 0.46 * size,
            tone: 0,
          },
          size,
          false,
        ),
      );
    }
    shapes.push({ poly: poly(cut.face), color: faceColor, alpha: 1, texture: 'face' });
    for (const t of [0.34, 0.66]) {
      shapes.push({
        poly: faceMark(cut.foot, cut.top, t, 0.08),
        color: C.markColor,
        alpha: C.markAlpha,
      });
    }
    lip(cut.top[0], cut.top[1]);
  } else {
    const cut = quarryCut(center, size);
    if (!rock) {
      // The hill rises behind the steps and runs down on their left
      const back = cut.front[4];
      const left = cut.front[cut.front.length - 2];
      shapes.push(
        ...moundShapes(
          {
            x: back.x + 0.08 * size,
            y: back.y + 0.02 * size,
            w: 0.62 * size,
            h: 0.44 * size,
            tone: 0,
          },
          size,
          false,
        ),
        ...moundShapes(
          {
            x: left.x - 0.04 * size,
            y: left.y + 0.06 * size,
            w: 0.38 * size,
            h: 0.32 * size,
            tone: 0,
          },
          size,
          false,
        ),
      );
    }
    for (const step of cut.steps) {
      shapes.push({ poly: poly(step.top), color: topColor, alpha: 1 });
      shapes.push({ poly: poly(step.end), color: endColor, alpha: 1, texture: 'face' });
      shapes.push({ poly: poly(step.front), color: faceColor, alpha: 1, texture: 'face' });
      const [f0, f1, f2, f3] = step.front;
      shapes.push({
        poly: faceMark([f0, f1], [f3, f2], 0.5, 0.06),
        color: C.markColor,
        alpha: C.markAlpha,
      });
      lip(f3, f2);
    }
  }
  return {
    x: center.x,
    y: center.y - 0.01 * size,
    shadow: null,
    shadowAlpha: 0,
    shapes,
    behindBuilding: true,
  };
}
