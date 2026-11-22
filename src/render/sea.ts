// The sea (docs/ART.md "Seafaring and ocean"), pure helpers (no PixiJS, easy to test): the
// outline of the whole map, the depth of the water (the distance to land, painted as a smooth
// gradient from turquoise shallows into deep Aegean blue with soft bands, the same on both sides
// of every tile edge), the pixels of the seamless wave textures (fine ripples on coastal water,
// longer swells on all water), the reef atlas, and where reefs, shoals, seaweed and sun glints lie.
// Everything here only affects the look; it never changes game logic.
import { hexToPixel, type Point } from '../core/hex';
import { hexAtIndex } from '../core/map';
import type { MapState } from '../core/state';
import { mapEdgeNeighborIndex } from './geometry';
import { Canvas, mix } from './pixels';
import { cornerPoint } from './relief';
import { smoothNoise, tileRng } from './terrain';
import { theme } from './theme';

const P = theme.terrainPaint;
const S = P.sea;

// ---------------------------------------------------------------------------------------------
// Map outline
// ---------------------------------------------------------------------------------------------

/**
 * The outer boundary of the whole map (all tiles together), clockwise, world px: the edges of
 * the tiles on the map border chained into one loop. The sea is painted inside it once.
 */
export function mapOutline(map: MapState, size: number): Point[] {
  const key = (p: Point): string => `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`;
  const next = new Map<string, Point>();
  let first: Point | null = null;
  for (let i = 0; i < map.tiles.length; i++) {
    const h = hexAtIndex(map, i);
    for (let e = 0; e < 6; e++) {
      if (mapEdgeNeighborIndex(map, h, e) >= 0) continue;
      const a = cornerPoint(h, e, size);
      next.set(key(a), cornerPoint(h, (e + 1) % 6, size));
      first ??= a;
    }
  }
  const out: Point[] = [];
  if (!first) return out;
  const start = key(first);
  let p: Point = first;
  for (let k = 0; k < next.size; k++) {
    out.push(p);
    const q = next.get(key(p));
    if (!q || key(q) === start) break;
    p = q;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------------------------

/** The distance to land over the whole map, on a square grid of n x n texels. */
export interface DepthField {
  /** Texels per side (a power of 2) and the world size of one texel (px). */
  n: number;
  cell: number;
  /** World position of the corner of texel (0, 0). */
  x0: number;
  y0: number;
  /** Distance of every texel center to the nearest land (hex sizes), row by row. */
  depth: Float32Array;
}

const FAR = 1e12;

/** One pass of the exact squared distance transform (Felzenszwalb & Huttenlocher) over `f`. */
function distance1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/**
 * The depth field of a map: for every texel the distance from its center to the nearest point
 * where `landAt` is true (hex sizes). One field for the whole map, so the depth runs on smoothly
 * from tile to tile. The texel size follows `depthCell` (coarser on very big maps).
 */
export function seaDepthField(
  map: MapState,
  size: number,
  landAt: (p: Point) => boolean,
): DepthField {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < map.tiles.length; i++) {
    const c = hexToPixel(hexAtIndex(map, i), size);
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const margin = 2 * size;
  const extent = Math.max(maxX - minX, maxY - minY) + 2 * margin;
  let n = 32;
  while (n < S.depthTextureMax && extent / n > S.depthCell * size) n *= 2;
  const cell = extent / n;
  const x0 = minX - margin;
  const y0 = minY - margin;
  const f = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const land = landAt({ x: x0 + (x + 0.5) * cell, y: y0 + (y + 0.5) * cell });
      f[y * n + x] = land ? 0 : FAR;
    }
  }
  // Rows, then columns: exact Euclidean distance in texels
  const line = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) line[x] = f[y * n + x];
    distance1d(line, n, out, v, z);
    for (let x = 0; x < n; x++) f[y * n + x] = out[x];
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) line[y] = f[y * n + x];
    distance1d(line, n, out, v, z);
    for (let y = 0; y < n; y++) f[y * n + x] = out[y];
  }
  const depth = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) depth[i] = (Math.sqrt(f[i]) * cell) / size;
  return { n, cell, x0, y0, depth };
}

/** The depth at a world point, interpolated between the texel centers like the GPU does. */
export function depthAt(field: DepthField, x: number, y: number): number {
  const { n, cell, x0, y0, depth } = field;
  const fx = Math.max(0, Math.min(n - 1, (x - x0) / cell - 0.5));
  const fy = Math.max(0, Math.min(n - 1, (y - y0) / cell - 0.5));
  const ix = Math.min(n - 2, Math.floor(fx));
  const iy = Math.min(n - 2, Math.floor(fy));
  const tx = fx - ix;
  const ty = fy - iy;
  const at = (cx: number, cy: number): number => depth[cy * n + cx];
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
  const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
  return top + (bottom - top) * ty;
}

/** The ramp of sea colors by depth (see theme `depthStops`). */
function rampColor(d: number): number {
  const stops = S.depthStops;
  if (d <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [d1, c1] = stops[i];
    if (d <= d1) {
      const [d0, c0] = stops[i - 1];
      const t = (d - d0) / (d1 - d0);
      return mix(c0, c1, t * t * (3 - 2 * t));
    }
  }
  return stops[stops.length - 1][1];
}

/** The two slow noises of the sea at a world point: the warp of the bands and the tone, -0.5..0.5. */
function seaNoise(x: number, y: number, size: number): [number, number] {
  return [
    smoothNoise(x / (S.warpScale * size), y / (S.warpScale * size), 41) - 0.5,
    smoothNoise(x / (S.toneScale * size), y / (S.toneScale * size), 43) - 0.5,
  ];
}

/** The depth ramp sampled finely (r, g, b per step), so painting a texel is a lookup. */
const RAMP_STEPS = 1024;
const RAMP_MAX = 8;
let ramp: Uint8Array | null = null;
function rampTable(): Uint8Array {
  if (!ramp) {
    ramp = new Uint8Array(RAMP_STEPS * 3);
    for (let i = 0; i < RAMP_STEPS; i++) {
      const c = rampColor((i / (RAMP_STEPS - 1)) * RAMP_MAX);
      ramp[i * 3] = (c >> 16) & 255;
      ramp[i * 3 + 1] = (c >> 8) & 255;
      ramp[i * 3 + 2] = c & 255;
    }
  }
  return ramp;
}

/**
 * The color of water with distance `d` to land (hex sizes) and the slow noises `warp` and
 * `tone` (-0.5..0.5, see `seaNoise`), written to `out` at `o` as r, g, b: the depth ramp over a
 * gently warped depth (so the bands wobble like painted ones), softly stepped into bands, with a
 * large slow light and shade.
 */
function shadeInto(d: number, warp: number, tone: number, out: Uint8Array, o: number): void {
  const dw = Math.max(0, d + S.warp * warp * Math.min(1, d / 0.6));
  // Soft bands: the depth lingers in every band and changes quicker between them
  const w = S.bandWidth;
  const banded = dw - ((w * S.bandSoftness) / (2 * Math.PI)) * Math.sin((2 * Math.PI * dw) / w);
  const table = rampTable();
  const k =
    Math.max(0, Math.min(RAMP_STEPS - 1, Math.round((banded / RAMP_MAX) * (RAMP_STEPS - 1)))) * 3;
  const f = 1 + 2 * S.tone * tone;
  out[o] = Math.min(255, Math.round(table[k] * f));
  out[o + 1] = Math.min(255, Math.round(table[k + 1] * f));
  out[o + 2] = Math.min(255, Math.round(table[k + 2] * f));
}

/** The color of the sea at world point (x, y) with distance `d` to land (hex sizes). */
export function seaColor(d: number, x: number, y: number, size: number): number {
  const [warp, tone] = seaNoise(x, y, size);
  const rgb = new Uint8Array(3);
  shadeInto(d, warp, tone, rgb, 0);
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

/**
 * Opaque RGBA pixels of the depth texture (n x n): the sea color of every texel. The slow
 * noises are sampled every 4 texels and blended (they change over hexes, not pixels).
 */
export function seaDepthPixels(field: DepthField, size: number): Uint8Array {
  const { n, cell, x0, y0, depth } = field;
  const step = 4;
  const m = n / step + 1;
  const warp = new Float32Array(m * m);
  const tone = new Float32Array(m * m);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const [a, b] = seaNoise(x0 + (i * step + 0.5) * cell, y0 + (j * step + 0.5) * cell, size);
      warp[j * m + i] = a;
      tone[j * m + i] = b;
    }
  }
  const sample = (grid: Float32Array, x: number, y: number): number => {
    const i = Math.floor(x / step);
    const j = Math.floor(y / step);
    const tx = (x % step) / step;
    const ty = (y % step) / step;
    const top = grid[j * m + i] + (grid[j * m + i + 1] - grid[j * m + i]) * tx;
    const bottom = grid[(j + 1) * m + i] + (grid[(j + 1) * m + i + 1] - grid[(j + 1) * m + i]) * tx;
    return top + (bottom - top) * ty;
  };
  const px = new Uint8Array(n * n * 4);
  const shallow = S.depthStops[0][1];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const d = depth[i];
      // Land: only seen through the bilinear blend right at the shore
      if (d <= 0) {
        px[i * 4] = (shallow >> 16) & 255;
        px[i * 4 + 1] = (shallow >> 8) & 255;
        px[i * 4 + 2] = shallow & 255;
      } else {
        shadeInto(d, sample(warp, x, y), sample(tone, x, y), px, i * 4);
      }
      px[i * 4 + 3] = 255;
    }
  }
  return px;
}

// ---------------------------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------------------------

/** How a wave texture is painted (sizes in texels): rows of short, slightly arched crest strokes. */
export interface WaveStyle {
  /** Distance between the rows of crests. */
  spacing: number;
  /** Length range of a crest, its thickness in the middle, how much it arches (share of length). */
  length: readonly [number, number];
  width: number;
  sag: number;
  /** Largest tilt (rad), share of the places that get a crest, how far below lies its trough. */
  tilt: number;
  fill: number;
  troughOffset: number;
  /** The trough is this much wider than the crest (soft and spread out, the crest a thin line). */
  troughWidth: number;
  /** Alpha of the light crests and the darker troughs at full strength. */
  crestAlpha: number;
  troughAlpha: number;
}

/** Smooth noise that repeats every `cells` cells (values on a wrapping lattice, smoothstep blend). */
function periodicNoise(cells: number, salt: number): (u: number, v: number) => number {
  const rng = tileRng(cells, salt, 900);
  const lattice = Array.from({ length: cells * cells }, () => rng());
  return (u: number, v: number): number => {
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number): number =>
      lattice[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}

/** A slightly arched, tapered stroke (as 4 segments) centered at (x, y). */
function arc(
  c: Canvas,
  x: number,
  y: number,
  len: number,
  tilt: number,
  sag: number,
  width: number,
  alphaLeft: number,
  alphaRight: number,
): void {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const pts: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 2 - 1;
    const along = (t * len) / 2;
    const up = sag * len * (1 - t * t);
    pts.push({
      x: x + cos * along + sin * up,
      y: y + sin * along - cos * up,
      w: width * Math.pow(Math.max(0, 1 - t * t), 0.6),
    });
  }
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const alpha = alphaLeft + ((alphaRight - alphaLeft) * (i + 0.5)) / 4;
    c.stroke(a.x, a.y, b.x, b.y, Math.max(0.4, a.w), Math.max(0.4, b.w), 0xffffff, alpha);
  }
}

/**
 * Premultiplied RGBA pixels (n x n) of a seamless wave texture to lay over water of color `base`:
 * rows of short arched crests, staggered and broken, a few tilted, calmer and busier patches
 * (a wrapping noise). Each crest is a light stroke, brighter on its left (the sun is in the upper
 * left), with a darker trough just below it; both translucent. The troughs are exactly dark enough
 * that over `base` the average color stays `base`, so the depth gradient keeps the say.
 */
export function wavePixels(n: number, style: WaveStyle, base: number, salt: number): Uint8Array {
  const crests = new Canvas(n, n, true);
  const troughs = new Canvas(n, n, true);
  const busy = periodicNoise(6, salt);
  const turn = periodicNoise(4, salt + 1);
  const rng = tileRng(n, salt, 901);
  const rows = Math.max(1, Math.round(n / style.spacing));
  const dy = n / rows;
  for (let r = 0; r < rows; r++) {
    const gap = (style.length[0] + style.length[1]) / 2 + style.spacing * 0.6;
    const count = Math.max(1, Math.round(n / gap));
    const shift = rng() * gap;
    for (let k = 0; k < count; k++) {
      const x = shift + k * (n / count) + (rng() - 0.5) * gap * 0.5;
      const y = r * dy + (rng() - 0.5) * dy * 0.45;
      const len = style.length[0] + rng() * (style.length[1] - style.length[0]);
      const tilt = (turn(x / n, y / n) - 0.5) * 2 * style.tilt + (rng() - 0.5) * 0.15;
      const strength = 0.55 + 0.45 * rng();
      if (rng() > style.fill * (0.55 + 0.9 * busy(x / n, y / n))) continue;
      arc(crests, x, y, len, tilt, style.sag, style.width, strength, strength * 0.55);
      const o = style.troughOffset;
      arc(
        troughs,
        x + o * 0.4,
        y + o,
        len * 0.95,
        tilt,
        style.sag * 0.6,
        style.width * style.troughWidth,
        strength,
        strength,
      );
    }
  }
  // Signed shading per pixel: crest light up, trough darkness down
  const shade = new Float32Array(n * n);
  let crestSum = 0;
  let troughSum = 0;
  for (let i = 0; i < n * n; i++) {
    const a =
      crests.data[i * 4 + 3] * style.crestAlpha - troughs.data[i * 4 + 3] * style.troughAlpha;
    shade[i] = a;
    if (a > 0) crestSum += a;
    else troughSum -= a;
  }
  // Crest color: the base lifted toward white; trough color: the base lowered just enough
  const ch = (c: number, s: number): number => ((c >> s) & 255) / 255;
  const b = [ch(base, 16), ch(base, 8), ch(base, 0)];
  const lift = b.map((v) => S.crestLift * (1 - v));
  const ratio = troughSum > 0 ? crestSum / troughSum : 0;
  const crest = b.map((v, k) => v + lift[k]);
  const trough = b.map((v, k) => Math.max(0, v - lift[k] * ratio));
  const px = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const a = shade[i];
    const color = a > 0 ? crest : trough;
    const alpha = Math.abs(a);
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.round(color[k] * alpha * 255);
    px[i * 4 + 3] = Math.round(alpha * 255);
  }
  return px;
}

/** Fine ripples for coastal water (neutral over the coastal turquoise). */
export function ripplePixels(n: number): Uint8Array {
  return wavePixels(n, S.ripple, theme.terrainColors.coast, 1);
}

/** Longer swells for all water (neutral over the ocean blue). */
export function swellPixels(n: number): Uint8Array {
  return wavePixels(n, S.swell, theme.terrainColors.ocean, 2);
}

// ---------------------------------------------------------------------------------------------
// Reefs, shoals, seaweed (an atlas of 4 x 2 cells, laid as quads) and sun glints
// ---------------------------------------------------------------------------------------------

export type ReefKind = 'shoal' | 'reef' | 'seaweed' | 'rocks';

/** Cells of the reef atlas per kind (4 columns x 2 rows, row by row). */
export const REEF_CELLS: Readonly<Record<ReefKind, readonly number[]>> = {
  shoal: [0, 1],
  reef: [2, 3],
  seaweed: [4, 5],
  rocks: [6, 7],
};
export const REEF_COLUMNS = 4;
export const REEF_ROWS = 2;

/** A random point in an ellipse, denser toward the middle. */
function inEllipse(rng: () => number, rx: number, ry: number): Point {
  const a = rng() * Math.PI * 2;
  const d = Math.pow(rng(), 0.7);
  return { x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d };
}

/** A rock that breaks the surface: foam ring, wet dark body, lit top (light from the upper left). */
function surfaceRock(c: Canvas, x: number, y: number, r: number): void {
  const [light, body, shade] = S.rockColors;
  c.ellipse(x + r * 0.5, y + r * 0.25, r * 2.3, r * 1.2, P.foamColor, 0.35, true);
  c.ellipse(x + r * 0.15, y + r * 0.1, r * 1.5, r * 0.85, P.foamColor, 0.85, true);
  c.ellipse(x, y, r, r * 0.68, shade, 1);
  c.ellipse(x - r * 0.12, y - r * 0.14, r * 0.82, r * 0.5, body, 1);
  c.ellipse(x - r * 0.32, y - r * 0.28, r * 0.42, r * 0.24, light, 0.9);
}

/** A rock under the surface: a soft dark shape with a faintly lit top. */
function submergedRock(c: Canvas, x: number, y: number, r: number): void {
  c.ellipse(x, y, r, r * 0.7, S.submergedColor, 0.75, true);
  c.ellipse(x - r * 0.25, y - r * 0.2, r * 0.55, r * 0.35, S.submergedLight, 0.35, true);
}

function drawReefCell(
  c: Canvas,
  kind: ReefKind,
  ox: number,
  oy: number,
  s: number,
  rng: () => number,
) {
  const cx = ox + s / 2;
  const cy = oy + s / 2;
  if (kind === 'seaweed') {
    // Soft dark beds of weed with a few curling fronds, all under the surface
    for (let i = 0; i < 7; i++) {
      const p = inEllipse(rng, s * 0.24, s * 0.14);
      const r = s * (0.09 + rng() * 0.08);
      c.ellipse(cx + p.x, cy + p.y, r, r * 0.6, S.seaweedColors[i % 2], 0.55, true);
    }
    for (let i = 0; i < 14; i++) {
      const p = inEllipse(rng, s * 0.26, s * 0.15);
      const r = s * (0.025 + rng() * 0.02);
      c.ellipse(cx + p.x, cy + p.y, r * 1.6, r * 0.7, S.seaweedColors[2], 0.35, true);
    }
    return;
  }
  // A light sandy halo under the water (strong on shoals, faint around reefs and rocks)
  // An irregular sandbank: a few overlapping soft blobs
  const halo = kind === 'shoal' ? 0.6 : kind === 'reef' ? 0.42 : 0.32;
  for (let i = 0; i < 5; i++) {
    const p = i === 0 ? { x: 0, y: 0 } : inEllipse(rng, s * 0.2, s * 0.1);
    const r = s * (i === 0 ? 0.3 : 0.16 + rng() * 0.08);
    c.ellipse(cx + p.x, cy + p.y, r * 1.45, r, S.shoalColor, halo, true);
  }
  if (kind === 'shoal') {
    for (let i = 0; i < 3; i++) {
      const p = inEllipse(rng, s * 0.12, s * 0.06);
      const r = s * (0.12 + rng() * 0.07);
      c.ellipse(cx + p.x, cy + p.y, r * 1.5, r * 0.9, S.shoalLight, 0.45, true);
    }
    // Sand ripples: faint light arcs
    for (let i = 0; i < 7; i++) {
      const p = inEllipse(rng, s * 0.22, s * 0.12);
      const len = s * (0.08 + rng() * 0.08);
      c.stroke(
        cx + p.x - len / 2,
        cy + p.y,
        cx + p.x + len / 2,
        cy + p.y - len * 0.15,
        s * 0.012,
        s * 0.012,
        S.shoalLight,
        0.35,
      );
    }
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
      const p = inEllipse(rng, s * 0.25, s * 0.14);
      submergedRock(c, cx + p.x, cy + p.y, s * (0.035 + rng() * 0.035));
    }
    return;
  }
  const rocks: { x: number; y: number; r: number; up: boolean }[] = [];
  const under = kind === 'reef' ? 6 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 2);
  const up = kind === 'reef' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
  for (let i = 0; i < under + up; i++) {
    const p = inEllipse(rng, s * 0.27, s * 0.15);
    const big = i >= under;
    rocks.push({
      x: cx + p.x,
      y: cy + p.y,
      r: s * (big ? 0.04 + rng() * 0.035 : 0.04 + rng() * 0.045),
      up: big,
    });
  }
  for (const r of rocks) if (!r.up) submergedRock(c, r.x, r.y, r.r);
  rocks.sort((a, b) => a.y - b.y);
  for (const r of rocks) if (r.up) surfaceRock(c, r.x, r.y, r.r);
}

/**
 * Premultiplied RGBA pixels of the reef atlas: REEF_COLUMNS x REEF_ROWS cells of `cell` px, one
 * patch each on a transparent ground (shoals, reefs of submerged rocks with a few breaking the
 * surface in foam, seaweed, rocks), fading out well inside its cell.
 */
export function reefAtlasPixels(cell: number): Uint8Array {
  const w = cell * REEF_COLUMNS;
  const c = new Canvas(w, cell * REEF_ROWS, false);
  for (const [kind, cells] of Object.entries(REEF_CELLS) as [ReefKind, number[]][]) {
    for (const index of cells) {
      const ox = (index % REEF_COLUMNS) * cell;
      const oy = Math.floor(index / REEF_COLUMNS) * cell;
      c.clip = [ox + 1, oy + 1, ox + cell - 1, oy + cell - 1];
      drawReefCell(c, kind, ox, oy, cell, tileRng(index, cell, 910));
    }
  }
  return c.bytes();
}

/** One reef patch on a coastal tile (relative to the tile center, half size in px). */
export interface ReefPatch {
  kind: ReefKind;
  cell: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
}

/**
 * The reefs, shoals and seaweed of one coastal tile (most tiles have none), relative to its
 * center: deterministic for the same `rng`. `ok(p, r)`: can a patch of half width r lie at p
 * (off the shore, off the middle of a tile where a ship stands)?
 */
export function reefLayout(
  rng: () => number,
  size: number,
  ok: (p: Point, r: number) => boolean,
): ReefPatch[] {
  if (rng() >= S.reefChance) return [];
  const out: ReefPatch[] = [];
  const kinds: ReefKind[] = ['shoal', 'reef', 'seaweed', 'rocks'];
  const count = rng() < 0.35 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const v = rng();
    let acc = 0;
    let kind: ReefKind = 'shoal';
    const total = S.reefWeights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < kinds.length; k++) {
      acc += S.reefWeights[k] / total;
      if (v < acc) {
        kind = kinds[k];
        break;
      }
    }
    const r = (S.reefSize[0] + rng() * (S.reefSize[1] - S.reefSize[0])) * size;
    const cells = REEF_CELLS[kind];
    const cell = cells[Math.floor(rng() * cells.length)];
    for (let k = 0; k < 5; k++) {
      const p = { x: (rng() - 0.5) * 1.5 * size, y: (rng() - 0.5) * 1.4 * size };
      if (!ok(p, r)) continue;
      out.push({ kind, cell, x: p.x, y: p.y, rx: r, ry: r * (0.62 + rng() * 0.12), alpha: 0.9 });
      break;
    }
  }
  return out;
}

/** A sun glint: a tiny sparkle (world px). */
export interface Glint {
  x: number;
  y: number;
  r: number;
}

/**
 * Sun glints on one water tile (relative to its center): sparse, more on the open sea (`open` 0
 * coastal .. 1 ocean) and toward the sun in the upper left of the map (`sun` 0 .. 1).
 */
export function glintLayout(
  rng: () => number,
  size: number,
  open: number,
  sun: number,
  ok: (p: Point) => boolean,
): Glint[] {
  const chance =
    S.glintChance * (0.45 + 0.55 * open) * (1 - S.glintSunBias / 2 + S.glintSunBias * sun);
  const out: Glint[] = [];
  let v = chance;
  while (v > 0) {
    if (rng() < Math.min(1, v)) {
      const p = { x: (rng() - 0.5) * 1.3 * size, y: (rng() - 0.5) * 1.2 * size };
      const r = (S.glintSize[0] + rng() * (S.glintSize[1] - S.glintSize[0])) * size;
      if (ok(p)) out.push({ x: p.x, y: p.y, r });
    }
    v -= 1;
  }
  return out;
}
