// Meadows and the dry grass on hills, pure helpers (no PixiJS, easy to test): the pixels of the
// painted grass textures laid over all plains and hills (seamless, in map space), the pixels of
// the meadow atlas (one cell per cluster: flower drifts, clover, lush and dry tufts, stones) and
// the layout of the clusters, shrubs and lone trees on a meadow tile.
// Everything here only affects the look; it never changes game logic.
import type { Point } from '../core/hex';
import type { WoodKind } from './forest';
import { tileRng } from './terrain';
import { theme } from './theme';

const G = theme.terrainPaint.meadow;

// ---------------------------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------------------------

/**
 * A small RGBA canvas of premultiplied floats (0..1). `wrap`: drawing wraps around the edges,
 * so the result tiles seamlessly; else drawing is clipped to `clip` (x0, y0, x1, y1).
 */
class Canvas {
  readonly data: Float32Array;
  clip: [number, number, number, number];
  constructor(
    readonly w: number,
    readonly h: number,
    readonly wrap: boolean,
  ) {
    this.data = new Float32Array(w * h * 4);
    this.clip = [0, 0, w, h];
  }

  /** Paints `color` with `alpha` (0..1) over pixel (x, y) (source over). */
  blend(x: number, y: number, color: number, alpha: number): void {
    if (alpha <= 0) return;
    let px = x;
    let py = y;
    if (this.wrap) {
      px = ((px % this.w) + this.w) % this.w;
      py = ((py % this.h) + this.h) % this.h;
    } else {
      const [x0, y0, x1, y1] = this.clip;
      if (px < x0 || py < y0 || px >= x1 || py >= y1) return;
    }
    const i = (py * this.w + px) * 4;
    const a = Math.min(1, alpha);
    const k = 1 - a;
    const d = this.data;
    d[i] = (((color >> 16) & 255) / 255) * a + d[i] * k;
    d[i + 1] = (((color >> 8) & 255) / 255) * a + d[i + 1] * k;
    d[i + 2] = ((color & 255) / 255) * a + d[i + 2] * k;
    d[i + 3] = a + d[i + 3] * k;
  }

  /** Fills the whole canvas with one opaque color. */
  fill(color: number): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.blend(x, y, color, 1);
  }

  /** Anti-aliased ellipse; `soft`: its alpha falls off smoothly from the middle to the rim. */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: number,
    alpha: number,
    soft = false,
  ): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    const r = Math.min(rx, ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(u * u + v * v);
        let a: number;
        if (soft) a = d >= 1 ? 0 : (1 - d * d) ** 2;
        else a = Math.max(0, Math.min(1, (1 - d) * r + 0.5));
        this.blend(x, y, color, alpha * a);
      }
    }
  }

  /** Anti-aliased tapered stroke from (x0, y0) (width w0) to (x1, y1) (width w1). */
  stroke(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w0: number,
    w1: number,
    color: number,
    alpha: number,
  ): void {
    const pad = Math.max(w0, w1) / 2 + 1;
    const bx0 = Math.floor(Math.min(x0, x1) - pad);
    const bx1 = Math.ceil(Math.max(x0, x1) + pad);
    const by0 = Math.floor(Math.min(y0, y1) - pad);
    const by1 = Math.ceil(Math.max(y0, y1) + pad);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const px = x + 0.5 - x0;
        const py = y + 0.5 - y0;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const dist = Math.hypot(px - t * dx, py - t * dy);
        const half = (w0 + (w1 - w0) * t) / 2;
        const a = Math.max(0, Math.min(1, half - dist + 0.5));
        this.blend(x, y, color, alpha * a);
      }
    }
  }

  /** The pixels as premultiplied RGBA bytes. */
  bytes(): Uint8Array {
    const out = new Uint8Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) {
      out[i] = Math.round(Math.max(0, Math.min(1, this.data[i])) * 255);
    }
    return out;
  }
}

/** Mixes two 0xRRGGBB colors. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => {
    const ca = (a >> s) & 255;
    return Math.round(ca + (((b >> s) & 255) - ca) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Picks an item by weight (weights need not sum to 1). */
function pick<T>(items: readonly T[], weights: readonly number[], v: number): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i] / total;
    if (v < acc) return items[i];
  }
  return items[items.length - 1];
}

/** How a grass texture is painted (see theme.terrainPaint.meadow). */
export interface GrassStyle {
  /** Opaque ground color (null: transparent, only the blades show). */
  base: number | null;
  /** Blade colors and their weights; lit edge and shade (light from the upper left). */
  colors: readonly number[];
  weights: readonly number[];
  light: number;
  shade: number;
  /** Tufts per 1000 texels, blades per tuft (range), blade length and width (texels), max lean (rad). */
  tufts: number;
  blades: readonly [number, number];
  length: readonly [number, number];
  width: readonly [number, number];
  lean: number;
  /** Alpha of the blades and of the small shadow at the foot of every tuft. */
  alpha: number;
  shadowAlpha: number;
}

/** A small coverage mask (0..1 per pixel), placed with its pixel (0, 0) at (ox, oy). */
interface Mask {
  w: number;
  h: number;
  ox: number;
  oy: number;
  a: Float32Array;
}

/** Rasterizes a drawing call into a mask (with a margin of `pad` px around (0, 0)). */
function mask(pad: number, draw: (c: Canvas, cx: number, cy: number) => void): Mask {
  const n = 2 * pad + 1;
  const c = new Canvas(n, n, false);
  draw(c, pad, pad);
  let x0 = n;
  let y0 = n;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (c.data[(y * n + x) * 4 + 3] <= 0.004) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { w: 0, h: 0, ox: 0, oy: 0, a: new Float32Array(0) };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) a[y * w + x] = c.data[((y0 + y) * n + x0 + x) * 4 + 3];
  }
  return { w, h, ox: x0 - pad, oy: y0 - pad, a };
}

/** Paints `color` through a mask at integer position (x, y) onto a wrapping canvas of size 2^k. */
function stamp(c: Canvas, m: Mask, x: number, y: number, color: number, alpha: number): void {
  const n = c.w;
  const wrap = n - 1;
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const d = c.data;
  for (let j = 0; j < m.h; j++) {
    const row = ((y + m.oy + j) & wrap) * n;
    for (let i = 0; i < m.w; i++) {
      const a = m.a[j * m.w + i] * alpha;
      if (a <= 0) continue;
      const k = (row + ((x + m.ox + i) & wrap)) * 4;
      const inv = 1 - a;
      d[k] = r * a + d[k] * inv;
      d[k + 1] = g * a + d[k + 1] * inv;
      d[k + 2] = b * a + d[k + 2] * inv;
      d[k + 3] = a + d[k + 3] * inv;
    }
  }
}

/** Quantized blade shapes: [angle][length][width] -> body and lit edge masks. */
function bladeStamps(style: GrassStyle, angles: readonly number[], lengths: readonly number[]) {
  const widths = [style.width[0], (style.width[0] + style.width[1]) / 2, style.width[1]];
  const pad = Math.ceil(style.length[1] + style.width[1] + 2);
  return angles.map((a) =>
    lengths.map((len) =>
      widths.map((w) => {
        const tx = Math.sin(a) * len;
        const ty = -Math.cos(a) * len;
        return {
          body: mask(pad, (c, cx, cy) => c.stroke(cx, cy, cx + tx, cy + ty, w, w * 0.2, 0, 1)),
          lit: mask(pad, (c, cx, cy) =>
            c.stroke(
              cx + tx * 0.35 - w * 0.3,
              cy + ty * 0.35,
              cx + tx - w * 0.15,
              cy + ty,
              w * 0.45,
              w * 0.1,
              0,
              1,
            ),
          ),
        };
      }),
    ),
  );
}

/**
 * Premultiplied RGBA pixels (n x n, n a power of 2) of a seamless painted grass texture: small
 * tufts of short brush-like blades all over, each blade with a lit left edge and each tuft with
 * a soft shadow at its foot (light from the upper left), drawn back to front. With an opaque base
 * the mean color is pulled to exactly the base, so from afar the grass has the flat terrain color.
 */
export function grassPixels(n: number, style: GrassStyle, salt: number): Uint8Array {
  const c = new Canvas(n, n, true);
  if (style.base !== null) {
    const r = ((style.base >> 16) & 255) / 255;
    const g = ((style.base >> 8) & 255) / 255;
    const b = (style.base & 255) / 255;
    for (let i = 0; i < n * n * 4; i += 4) {
      c.data[i] = r;
      c.data[i + 1] = g;
      c.data[i + 2] = b;
      c.data[i + 3] = 1;
    }
  }
  // Blade shapes are drawn once and stamped (quantized angle, length, width)
  const span = style.lean / 2 + 0.15;
  const angles = Array.from({ length: 13 }, (_, i) => -span + (2 * span * i) / 12);
  const lengths = Array.from(
    { length: 4 },
    (_, i) => style.length[0] + ((style.length[1] - style.length[0]) * i) / 3,
  );
  const stamps = bladeStamps(style, angles, lengths);
  const shadow = mask(5, (m, cx, cy) => m.ellipse(cx + 1, cy + 0.6, 2.6, 1.2, 0, 1, true));
  const nearest = (list: readonly number[], v: number): number => {
    let best = 0;
    for (let i = 1; i < list.length; i++) {
      if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
    }
    return best;
  };

  const rng = tileRng(n, salt, 880);
  const count = Math.round(((n * n) / 1000) * style.tufts);
  const tufts: { x: number; y: number; color: number; blades: number; seed: number }[] = [];
  for (let i = 0; i < count; i++) {
    tufts.push({
      x: Math.floor(rng() * n),
      y: Math.floor(rng() * n),
      color: pick(style.colors, style.weights, rng()),
      blades: style.blades[0] + Math.floor(rng() * (style.blades[1] - style.blades[0] + 1)),
      seed: rng(),
    });
  }
  // Back to front: a tuft further down overlaps the ones behind it
  tufts.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of tufts) {
    const r = tileRng(Math.floor(t.seed * 1e6), salt, 881);
    if (style.shadowAlpha > 0) stamp(c, shadow, t.x, t.y, style.shade, style.shadowAlpha);
    for (let b = 0; b < t.blades; b++) {
      const x = t.x + Math.round((r() - 0.5) * 3);
      const y = t.y + Math.round((r() - 0.5) * 1.5);
      const len = style.length[0] + r() * (style.length[1] - style.length[0]);
      const wi = Math.floor(r() * 3);
      // Blades fan out from the tuft and lean a little
      const a = (b / Math.max(1, t.blades - 1) - 0.5) * style.lean + (r() - 0.5) * 0.3;
      const blade = stamps[nearest(angles, a)][nearest(lengths, len)][wi];
      const color = mix(t.color, r() < 0.5 ? style.light : style.shade, r() * 0.25);
      stamp(c, blade.body, x, y, color, style.alpha);
      stamp(c, blade.lit, x, y, style.light, style.alpha * 0.55);
    }
  }
  if (style.base !== null) normalizeMean(c, style.base);
  return c.bytes();
}

/** Shifts all colors so their mean is exactly `target` (opaque canvases only). */
function normalizeMean(c: Canvas, target: number): void {
  const d = c.data;
  const sum = [0, 0, 0];
  const px = c.w * c.h;
  for (let i = 0; i < px; i++) for (let k = 0; k < 3; k++) sum[k] += d[i * 4 + k];
  const want = [(target >> 16) & 255, (target >> 8) & 255, target & 255].map((v) => v / 255);
  const shift = want.map((v, k) => v - sum[k] / px);
  for (let i = 0; i < px; i++) for (let k = 0; k < 3; k++) d[i * 4 + k] += shift[k];
}

/** The painted grass over all meadows (opaque, mean = the meadow color). */
export function meadowGrassPixels(n: number): Uint8Array {
  return grassPixels(
    n,
    {
      base: theme.terrainColors.plains,
      colors: G.grassColors,
      weights: G.grassWeights,
      light: G.grassLight,
      shade: G.grassShade,
      tufts: G.tufts,
      blades: G.tuftBlades,
      length: G.bladeLength,
      width: G.bladeWidth,
      lean: G.bladeLean,
      alpha: 0.95,
      shadowAlpha: G.tuftShadowAlpha,
    },
    1,
  );
}

/** The dry grass laid over the hills (transparent between the strokes). */
export function hillGrassPixels(n: number): Uint8Array {
  return grassPixels(
    n,
    {
      base: null,
      colors: G.hillColors,
      weights: G.hillWeights,
      light: G.hillLight,
      shade: G.hillShade,
      tufts: G.hillTufts,
      blades: G.hillTuftBlades,
      length: G.hillBladeLength,
      width: G.bladeWidth,
      lean: G.bladeLean * 1.2,
      alpha: 0.9,
      shadowAlpha: G.hillShadowAlpha,
    },
    2,
  );
}

// ---------------------------------------------------------------------------------------------
// Meadow atlas: one cell per cluster
// ---------------------------------------------------------------------------------------------

export type MeadowKind =
  | 'poppies'
  | 'chamomile'
  | 'buttercups'
  | 'violets'
  | 'mixed'
  | 'clover'
  | 'lush'
  | 'dry'
  | 'stones';

/** Cells of the atlas per kind (4 x 4 cells, row by row). */
export const ATLAS_CELLS: Readonly<Record<MeadowKind, readonly number[]>> = {
  poppies: [0, 1],
  chamomile: [2, 3],
  buttercups: [4, 5],
  violets: [6],
  mixed: [7],
  clover: [8, 9],
  lush: [10, 11],
  dry: [12, 13],
  stones: [14, 15],
};

/** Cells per row and column of the atlas. */
export const ATLAS_GRID = 4;

/** Flower colors: petal, its shaded rim, highlight, center. */
const FLOWERS: Readonly<
  Record<'poppies' | 'chamomile' | 'buttercups' | 'violets', readonly number[]>
> = {
  poppies: G.poppy,
  chamomile: G.chamomile,
  buttercups: G.buttercup,
  violets: G.violet,
};

/**
 * Premultiplied RGBA pixels of the meadow atlas: ATLAS_GRID x ATLAS_GRID cells of `cell` px,
 * each one cluster on a transparent ground, fading out well inside its cell (so neighboring
 * cells never bleed into each other).
 */
export function meadowAtlasPixels(cell: number): Uint8Array {
  const n = cell * ATLAS_GRID;
  const c = new Canvas(n, n, false);
  for (const [kind, cells] of Object.entries(ATLAS_CELLS) as [MeadowKind, number[]][]) {
    for (const index of cells) {
      const ox = (index % ATLAS_GRID) * cell;
      const oy = Math.floor(index / ATLAS_GRID) * cell;
      c.clip = [ox + 1, oy + 1, ox + cell - 1, oy + cell - 1];
      drawCell(c, kind, ox, oy, cell, tileRng(index, cell, 890));
    }
  }
  return c.bytes();
}

/** A random point in the ellipse (cx, cy, rx, ry), denser toward the middle. */
function inEllipse(rng: () => number, rx: number, ry: number): Point {
  const a = rng() * Math.PI * 2;
  const d = Math.pow(rng(), 0.7);
  return { x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d };
}

function drawCell(
  c: Canvas,
  kind: MeadowKind,
  ox: number,
  oy: number,
  s: number,
  rng: () => number,
): void {
  const cx = ox + s / 2;
  const cy = oy + s * 0.55;
  const blades = (count: number, colors: readonly number[], len: [number, number], rx: number) => {
    const list: { x: number; y: number; len: number; a: number; color: number }[] = [];
    for (let i = 0; i < count; i++) {
      const p = inEllipse(rng, rx, rx * 0.62);
      list.push({
        x: cx + p.x,
        y: cy + p.y,
        len: (len[0] + rng() * (len[1] - len[0])) * s,
        a: (rng() - 0.5) * 0.9,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    list.sort((a, b) => a.y - b.y);
    for (const b of list) {
      const w = s * 0.03;
      const tx = b.x + Math.sin(b.a) * b.len;
      const ty = b.y - Math.cos(b.a) * b.len;
      c.stroke(b.x, b.y, tx, ty, w, w * 0.2, b.color, 0.95);
      c.stroke(
        b.x - w * 0.25,
        b.y - b.len * 0.4,
        tx - w * 0.1,
        ty,
        w * 0.4,
        w * 0.1,
        G.grassLight,
        0.4,
      );
    }
  };
  if (kind === 'stones') {
    blades(10, G.grassColors, [0.06, 0.12], s * 0.36);
    const count = 3 + Math.floor(rng() * 4);
    const stones: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < count; i++) {
      const p = inEllipse(rng, s * 0.3, s * 0.18);
      stones.push({ x: cx + p.x, y: cy + p.y, r: s * (0.045 + rng() * 0.06) });
    }
    stones.sort((a, b) => a.y - b.y);
    const [light, body, shade] = G.stoneColors;
    for (const st of stones) {
      c.ellipse(
        st.x + st.r * 0.45,
        st.y + st.r * 0.35,
        st.r * 1.15,
        st.r * 0.6,
        G.grassShade,
        0.4,
        true,
      );
      c.ellipse(st.x, st.y, st.r, st.r * 0.68, shade, 1);
      c.ellipse(st.x - st.r * 0.1, st.y - st.r * 0.12, st.r * 0.85, st.r * 0.52, body, 1);
      c.ellipse(st.x - st.r * 0.3, st.y - st.r * 0.28, st.r * 0.42, st.r * 0.24, light, 0.9);
    }
    return;
  }
  if (kind === 'lush' || kind === 'dry') {
    const lush = kind === 'lush';
    const colors = lush ? G.lushColors : G.dryColors;
    c.ellipse(cx, cy, s * 0.44, s * 0.28, lush ? G.lushBase : G.dryBase, lush ? 0.55 : 0.45, true);
    const tufts = lush ? 7 + Math.floor(rng() * 4) : 9 + Math.floor(rng() * 4);
    const list: Point[] = [];
    for (let i = 0; i < tufts; i++) {
      const p = inEllipse(rng, s * 0.3, s * 0.17);
      list.push({ x: cx + p.x, y: cy + p.y });
    }
    list.sort((a, b) => a.y - b.y);
    for (const p of list) {
      c.ellipse(p.x + s * 0.02, p.y + s * 0.01, s * 0.07, s * 0.03, G.grassShade, 0.3, true);
      const count = lush ? 7 + Math.floor(rng() * 4) : 5 + Math.floor(rng() * 4);
      for (let b = 0; b < count; b++) {
        const a = (b / (count - 1) - 0.5) * 1.3 + (rng() - 0.5) * 0.3;
        const len = s * (lush ? 0.18 + rng() * 0.14 : 0.13 + rng() * 0.12);
        const x = p.x + (rng() - 0.5) * s * 0.04;
        const tx = x + Math.sin(a) * len;
        const ty = p.y - Math.cos(a) * len;
        const w = s * (lush ? 0.034 : 0.028);
        c.stroke(x, p.y, tx, ty, w, w * 0.2, colors[Math.floor(rng() * colors.length)], 1);
        if (a < 0.2)
          c.stroke(
            x - w * 0.2,
            p.y - len * 0.3,
            tx - w * 0.1,
            ty,
            w * 0.4,
            w * 0.1,
            lush ? G.grassLight : G.hillLight,
            0.5,
          );
      }
      // Seed heads on the dry grass
      if (!lush && rng() < 0.6)
        c.ellipse(
          p.x + (rng() - 0.5) * s * 0.06,
          p.y - s * 0.17,
          s * 0.016,
          s * 0.022,
          G.dryColors[0],
          1,
        );
    }
    return;
  }
  if (kind === 'clover') {
    c.ellipse(cx, cy, s * 0.42, s * 0.27, G.cloverColors[0], 0.35, true);
    for (let i = 0; i < 26; i++) {
      const p = inEllipse(rng, s * 0.34, s * 0.2);
      const r = s * (0.024 + rng() * 0.01);
      const color = G.cloverColors[Math.floor(rng() * G.cloverColors.length)];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rng();
        c.ellipse(
          cx + p.x + Math.cos(a) * r,
          cy + p.y + Math.sin(a) * r * 0.7,
          r,
          r * 0.75,
          color,
          1,
        );
      }
      c.ellipse(cx + p.x - r * 0.4, cy + p.y - r * 0.4, r * 0.5, r * 0.35, G.grassLight, 0.5);
    }
    for (let i = 0; i < 4; i++) {
      const p = inEllipse(rng, s * 0.3, s * 0.16);
      const r = s * 0.04;
      const [petal, rim] = G.cloverFlower;
      c.ellipse(cx + p.x + r * 0.2, cy + p.y + r * 0.2, r, r * 0.9, rim, 1);
      c.ellipse(cx + p.x, cy + p.y, r * 0.85, r * 0.78, petal, 1);
    }
    return;
  }
  // Flower drifts: a clump of leaves, the flowers on top (back to front)
  c.ellipse(cx, cy, s * 0.43, s * 0.3, G.lushBase, 0.32, true);
  blades(36, G.lushColors, [0.07, 0.14], s * 0.38);
  const kinds = ['poppies', 'chamomile', 'buttercups', 'violets'] as const;
  const count = 17 + Math.floor(rng() * 8);
  const flowers: { x: number; y: number; r: number; colors: readonly number[] }[] = [];
  for (let i = 0; i < count; i++) {
    const p = inEllipse(rng, s * 0.36, s * 0.25);
    const k = kind === 'mixed' ? pick(kinds, [0.35, 0.3, 0.25, 0.1], rng()) : kind;
    flowers.push({
      x: cx + p.x,
      y: cy + p.y - s * 0.04,
      r: s * (0.036 + rng() * 0.024),
      colors: FLOWERS[k],
    });
  }
  flowers.sort((a, b) => a.y - b.y);
  for (const f of flowers) {
    const [petal, rim, light, center] = f.colors;
    c.stroke(
      f.x,
      f.y + f.r,
      f.x + f.r * 0.2,
      f.y + f.r * 2.6,
      s * 0.012,
      s * 0.008,
      G.lushColors[0],
      0.9,
    );
    c.ellipse(f.x + f.r * 0.35, f.y + f.r * 0.4, f.r * 1.05, f.r * 0.6, G.grassShade, 0.35, true);
    c.ellipse(f.x + f.r * 0.12, f.y + f.r * 0.12, f.r, f.r * 0.86, rim, 1);
    c.ellipse(f.x - f.r * 0.06, f.y - f.r * 0.06, f.r * 0.86, f.r * 0.74, petal, 1);
    c.ellipse(f.x - f.r * 0.34, f.y - f.r * 0.32, f.r * 0.36, f.r * 0.28, light, 0.85);
    c.ellipse(f.x + f.r * 0.05, f.y + f.r * 0.02, f.r * 0.3, f.r * 0.27, center, 1);
  }
}

// ---------------------------------------------------------------------------------------------
// Layout on a meadow tile
// ---------------------------------------------------------------------------------------------

/** One cluster on a meadow (ground point and half size in world px; `layer`: draw order). */
export interface MeadowCluster {
  kind: MeadowKind;
  cell: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
  /** Tint (slight brightness change); 0xffffff = as painted. */
  tint: number;
  /** Patches (0) under stones (1) under flowers (2). */
  layer: number;
}

/** A shrub or lone tree on open meadow (relative to the tile center, scale of the tree art). */
export interface MeadowPlant {
  kind: WoodKind;
  x: number;
  y: number;
  scale: number;
  variant: number;
}

/** What the layout needs to know about a meadow tile. */
export interface MeadowSite {
  /** How many clusters (1 = normal; more beside forests and water, fewer beside hills). */
  density: number;
  /** 0..1: how damp (forest or water beside it); lush tufts gather toward `dampSide`. */
  damp: number;
  dampSide: Point | null;
  /** 0..1: how dry (hills beside it, a golden region): more golden patches. */
  dry: number;
  /** 0..1: how flowery this part of the map is (a smooth noise: drifts of flowers in regions). */
  flowers: number;
  /** True: no forest beside it (only there a lone tree may stand). */
  open: boolean;
  /** Can a cluster of half width `r` lie at `p` (relative to the tile center)? */
  ok: (p: Point, r: number) => boolean;
}

/**
 * The clusters, shrubs and lone trees on one meadow tile (positions relative to its center,
 * deterministic for the same `rng`). Drifts of flowers are a few cells of one kind in a short
 * row; lush tufts sit toward the damp side, golden patches where it is dry.
 */
export function meadowLayout(
  rng: () => number,
  size: number,
  site: MeadowSite,
): { clusters: MeadowCluster[]; plants: MeadowPlant[] } {
  const clusters: MeadowCluster[] = [];
  const plants: MeadowPlant[] = [];
  const amount = (base: number): number => {
    const v = base * site.density;
    return Math.floor(v) + (rng() < v - Math.floor(v) ? 1 : 0);
  };
  const spot = (r: number, toward: Point | null = null): Point | null => {
    for (let k = 0; k < 3; k++) {
      let p = { x: (rng() - 0.5) * 1.5 * size, y: (rng() - 0.5) * 1.4 * size };
      if (toward) {
        p = { x: toward.x * 0.5 * size + p.x * 0.45, y: toward.y * 0.5 * size + p.y * 0.45 };
      }
      if (site.ok(p, r)) return p;
    }
    return null;
  };
  const add = (kind: MeadowKind, p: Point, r: number, layer: number, alpha = 1): void => {
    const cells = ATLAS_CELLS[kind];
    clusters.push({
      kind,
      cell: cells[Math.floor(rng() * cells.length)],
      x: p.x,
      y: p.y,
      rx: r,
      ry: r * (layer === 2 ? 0.78 + rng() * 0.1 : 0.62 + rng() * 0.12),
      alpha,
      tint: mix(G.tintMin, 0xffffff, rng()),
      layer,
    });
  };
  const size01 = (range: readonly [number, number]): number =>
    (range[0] + rng() * (range[1] - range[0])) * size;

  for (let i = amount(G.lushCount * (0.5 + site.damp)); i > 0; i--) {
    const r = size01(G.lushSize);
    const p = spot(r, site.damp > 0 ? site.dampSide : null);
    if (p) add('lush', p, r, 0, 0.9);
  }
  for (let i = amount(G.dryCount * (0.3 + site.dry * 1.4)); i > 0; i--) {
    const r = size01(G.drySize);
    const p = spot(r);
    if (p) add('dry', p, r, 0, 0.85);
  }
  for (let i = amount(G.cloverCount); i > 0; i--) {
    const r = size01(G.cloverSize);
    const p = spot(r);
    if (p) add('clover', p, r, 0);
  }
  for (let i = amount(G.stoneCount); i > 0; i--) {
    const r = size01(G.stoneSize);
    const p = spot(r);
    if (p) add('stones', p, r, 1);
  }
  const kinds: MeadowKind[] = ['poppies', 'chamomile', 'buttercups', 'mixed', 'violets'];
  for (let i = amount(G.driftCount * (0.25 + site.flowers * 1.5)); i > 0; i--) {
    const kind = pick(kinds, G.driftWeights, rng());
    const r = size01(G.flowerSize);
    const p = spot(r * 1.6);
    if (!p) continue;
    // A drift: 2-4 overlapping cells of one kind around its middle, smaller toward its rim
    const n = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2;
      const off = k === 0 ? 0 : r * (0.7 + rng() * 0.45);
      const q = { x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off * 0.6 };
      const rk = r * (k === 0 ? 1 : 0.7 + rng() * 0.2);
      if (site.ok(q, rk)) add(kind, q, rk, 2);
    }
  }
  // Now and then a shrub, and on open meadow a lone tree
  if (rng() < G.shrubChance * site.density) {
    const p = spot(0.12 * size);
    if (p)
      plants.push({
        kind: 'shrub',
        ...p,
        scale: 0.8 + rng() * 0.35,
        variant: Math.floor(rng() * 1000),
      });
  }
  if (site.open && rng() < G.treeChance) {
    const kind = pick<WoodKind>(['olive', 'oak', 'pine'], G.treeWeights, rng());
    const p = spot(0.22 * size);
    const scale = G.treeScale[0] + rng() * (G.treeScale[1] - G.treeScale[0]);
    if (p) plants.push({ kind, ...p, scale, variant: Math.floor(rng() * 1000) });
  }
  return { clusters, plants };
}
