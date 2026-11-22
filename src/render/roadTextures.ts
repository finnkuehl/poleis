// Pixels of the small road textures (docs/ART.md "Roads"), generated once at startup from code
// (no image files, no canvas): premultiplied RGBA, deterministic, seamless where they repeat.
// roadLayer.ts turns them into PixiJS textures and maps them along the road curves.
//
// Two kinds of texture:
// - planar tiles, repeated in both directions in world space (the gravel surface, the flagstones of
//   a paved square): light comes from the upper left, so small stones are lit there;
// - strips, mapped along the road (x = along the road, repeated; y = across the road, from one
//   side to the other): wheel ruts, the paving with its curbs, the banks of a cut through a hill.
//   Their light is NOT baked for one side: the relief strips hold the shading for light coming
//   from the +y side, and roadLayer.ts blends them with their mirror image by the road's real
//   direction to the sun.
import { theme } from './theme';

/** A premultiplied RGBA image (rows top to bottom). */
export interface PixelImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

const T = theme.road.textures;

// ---------------------------------------------------------------------------------------------
// Noise (deterministic, periodic)
// ---------------------------------------------------------------------------------------------

/** Hash of two ints and a seed, in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Smooth value noise in [0, 1) on a lattice that repeats every px x py cells. */
export function periodicNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v = (i: number, j: number): number => hash2(mod(ix + i, px), mod(iy + j, py), seed);
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return a + (b - a) * sy;
}

/**
 * Fractal noise in [0, 1) at texture position (u, v) in [0, 1): `cells` lattice cells across the
 * texture at the coarsest octave (cellsX along x, cellsY along y), doubling each octave, so it
 * repeats exactly at the texture's edges.
 */
export function fbm(
  u: number,
  v: number,
  cellsX: number,
  cellsY: number,
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o;
    const cy = cellsY << o;
    sum += amp * periodicNoise(u * cx, v * cy, cx, cy, seed + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** A small deterministic random sequence. */
function rng(seed: number): () => number {
  let i = 0;
  return () => hash2(i++, 7, seed);
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function rgbOf(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

/** A float RGBA buffer (straight alpha) that is turned into premultiplied bytes at the end. */
class Canvas {
  readonly data: Float32Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Float32Array(width * height * 4);
  }

  /** Index of the pixel at (x, y), wrapping in both directions (seamless stamps). */
  at(x: number, y: number): number {
    return (mod(y, this.height) * this.width + mod(x, this.width)) * 4;
  }

  set(x: number, y: number, rgb: readonly number[], a = 1): void {
    const i = this.at(x, y);
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = a;
  }

  /** Blends a color over the pixel (straight alpha `a`); x wraps, y wraps unless `clampY`. */
  blend(x: number, y: number, rgb: readonly number[], a: number, clampY = false): void {
    if (a <= 0) return;
    if (clampY && (y < 0 || y >= this.height)) return;
    const i = this.at(x, y);
    const d = this.data;
    const da = d[i + 3];
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (rgb[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa;
  }

  /** Multiplies the pixel's color (shading); x wraps, y wraps unless `clampY`. */
  shade(x: number, y: number, factor: number, clampY = false): void {
    if (clampY && (y < 0 || y >= this.height)) return;
    const i = this.at(x, y);
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.min(1, this.data[i + k] * factor);
  }

  toImage(): PixelImage {
    const pixels = new Uint8Array(this.width * this.height * 4);
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.max(0, Math.min(1, d[i + 3]));
      for (let k = 0; k < 3; k++) {
        pixels[i + k] = Math.round(Math.max(0, Math.min(1, d[i + k])) * a * 255);
      }
      pixels[i + 3] = Math.round(a * 255);
    }
    return { width: this.width, height: this.height, pixels };
  }
}

/**
 * A small stone seen from above, lit from the upper left: a soft shadow to the lower right, the
 * stone body, a highlight on its upper left. (x, y) its center, r its radius in pixels.
 */
function stampStone(
  c: Canvas,
  x: number,
  y: number,
  r: number,
  rgb: readonly number[],
  opacity: number,
  clampY = false,
): void {
  const reach = Math.ceil(r + 2);
  const sh = Math.max(0.6, r * 0.45);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const px = Math.floor(x) + dx;
      const py = Math.floor(y) + dy;
      const cx = px + 0.5 - x;
      const cy = py + 0.5 - y;
      // Shadow first (offset to the lower right)
      const ds = Math.hypot(cx - sh, cy - sh) / (r * 1.05);
      if (ds < 1)
        c.blend(px, py, [0.16, 0.12, 0.08], T.stoneShadow * opacity * (1 - ds * ds), clampY);
    }
  }
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const px = Math.floor(x) + dx;
      const py = Math.floor(y) + dy;
      const cx = px + 0.5 - x;
      const cy = py + 0.5 - y;
      const d = Math.hypot(cx, cy) / r;
      if (d >= 1) continue;
      // Lit toward the upper left, darker toward the lower right
      const lit = 1 + T.stoneRelief * (-(cx + cy) / (r * Math.SQRT2));
      const edge = smoothstep(1, 0.7, d);
      c.blend(
        px,
        py,
        rgb.map((v) => v * lit),
        opacity * edge,
        clampY,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Gravel surface (planar tile)
// ---------------------------------------------------------------------------------------------

/**
 * The surface of a gravel road, `n` x `n`, repeating in both directions: compacted earth with
 * soft patches of grey gravel and ochre earth, fine grain, and small lit pebbles. Opaque; the road
 * mesh tints it (lighter in the track, darker on the shoulders).
 */
export function gravelTileImage(n: number): PixelImage {
  const c = new Canvas(n, n);
  const earth = rgbOf(T.gravel.earth);
  const grit = rgbOf(T.gravel.grit);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      // Large soft patches of grey grit and ochre earth, and some brighter worn spots
      const m = smoothstep(0.35, 0.65, fbm(u, v, 3, 3, 3, 11));
      const lum = 0.93 + 0.12 * fbm(u, v, 6, 6, 3, 23);
      const grain = 1 + (hash2(x, y, 31) - 0.5) * T.gravel.grain;
      const k = lum * grain;
      c.set(
        x,
        y,
        [0, 1, 2].map((i) => (earth[i] + (grit[i] - earth[i]) * m) * k),
      );
    }
  }
  // Pebbles: many tiny ones, fewer bigger ones; light limestone, mid and dark stones
  const stones = T.gravel.stones.map(rgbOf);
  const r = rng(41);
  const count = Math.round(n * n * T.gravel.pebbleDensity);
  for (let i = 0; i < count; i++) {
    const big = r() < T.gravel.bigShare;
    const radius = big ? 1.6 + r() * 1.6 : 0.7 + r() * 0.9;
    const rgb = stones[Math.floor(r() * stones.length)];
    stampStone(c, r() * n, r() * n, radius, rgb, 0.55 + r() * 0.4);
  }
  return c.toImage();
}

// ---------------------------------------------------------------------------------------------
// Relief strips: shading for light from the +y side
// ---------------------------------------------------------------------------------------------

/**
 * Turns a height field (one value per pixel, `h(x, y)`, y across the strip) into a relief overlay:
 * slopes facing +y get a white highlight, slopes facing -y a dark shade, hollows (h < 0) a dark
 * ambient-occlusion tint. `edge(y)` fades the overlay out toward the sides of the strip.
 */
function reliefFromHeight(
  width: number,
  height: number,
  h: (x: number, y: number) => number,
  light: number,
  shadow: number,
  hollow: number,
  edge: (y: number) => number,
): PixelImage {
  const c = new Canvas(width, height);
  const dark = rgbOf(T.reliefShade);
  const lit = rgbOf(T.reliefLight);
  for (let x = 0; x < width; x++) {
    let prev = h(x, -1);
    let cur = h(x, 0);
    for (let y = 0; y < height; y++) {
      const next = h(x, y + 1);
      // Height falls toward +y -> the slope faces the light on the +y side
      const slope = (prev - next) / 2;
      const hi = Math.max(0, slope) * light;
      const lo = Math.max(0, -slope) * shadow;
      const ao = Math.max(0, -cur) * hollow;
      const fade = edge(y);
      const shade = Math.min(1, (lo + ao) * fade);
      const bright = Math.min(1, hi * fade);
      // One texel: warm light over a warm dark tint
      const a = Math.min(1, bright + shade);
      const i = c.at(x, y);
      for (let k = 0; k < 3; k++)
        c.data[i + k] = a > 0 ? (lit[k] * bright + dark[k] * shade) / a : 0;
      c.data[i + 3] = a;
      prev = cur;
      cur = next;
    }
  }
  return c.toImage();
}

/** Position across a strip texture: pixel row y -> a in [-reach, reach] (0 = middle). */
function across(y: number, height: number, reach: number): number {
  return ((y + 0.5) / height) * 2 * reach - reach;
}

/** A soft bump: 1 at 0, falling off over `w`. */
function bump(d: number, w: number): number {
  return Math.exp(-(d * d) / (2 * w * w));
}

/**
 * Wheel ruts and the edges of a gravel track as a relief strip (`width` along, repeating; `height`
 * across): two grooves with raised lips, pushed-up gravel along both edges, small puddle hollows.
 * The rows cover [-reach, reach] half widths of the track (`theme.road.gravel.reliefReach`).
 */
export function rutReliefImage(width: number, height: number): PixelImage {
  const G = theme.road.gravel;
  const reach = G.reliefReach;
  const cells = width / 64;
  // Along the road (one value per column): the ruts wander a little and vary in depth, the
  // pushed-up edges vary in height, now and then a shallow puddle hollow
  const columns = Array.from({ length: width }, (_, x) => {
    const u = (x + 0.5) / width;
    return {
      wander: (fbm(u, 0.5, cells, 1, 2, 51) - 0.5) * 0.1,
      depth: 0.8 + 0.3 * fbm(u, 0.25, cells * 2, 1, 2, 53),
      berms: [0.1, 0.75].map((v) => 0.45 + 0.35 * fbm(u, v, cells * 2, 1, 2, 57)),
      puddle: smoothstep(0.72, 0.85, fbm(u, 0.6, cells * 2, 1, 2, 59)),
    };
  });
  const scale = (height / (2 * reach)) * G.reliefScale;
  const field = (x: number, y: number): number => {
    const a = across(y, height, reach);
    const col = columns[mod(x, width)];
    let h = 0;
    for (const side of [-1, 1]) {
      const d = a - (side * G.rutOffset + col.wander);
      h -= col.depth * bump(d, G.rutWidth);
      // Raised lips beside the groove
      h +=
        0.35 *
        col.depth *
        (bump(d - G.rutWidth * 2.1, G.rutWidth * 0.8) +
          bump(d + G.rutWidth * 2.1, G.rutWidth * 0.8));
      // Loose gravel pushed up along the edge of the track
      h += col.berms[side > 0 ? 1 : 0] * bump(a - side * G.bermAt, G.bermWidth);
    }
    h -=
      0.25 *
      col.puddle *
      (bump(a - G.rutOffset, G.rutWidth * 1.6) + bump(a + G.rutOffset, G.rutWidth * 1.6));
    return h * scale;
  };
  return reliefFromHeight(
    width,
    height,
    field,
    G.reliefLight,
    G.reliefShadow,
    G.reliefHollow,
    (y) => {
      const a = Math.abs(across(y, height, reach));
      return smoothstep(reach, reach * 0.85, a);
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Paving (strip along the road, and a planar tile for paved squares)
// ---------------------------------------------------------------------------------------------

/** One row of slabs across the road: where the joints between its slabs lie (a in [-1, 1]). */
export interface SlabRow {
  joints: number[];
  /** Tone of each slab (index = slab, joints.length + 1 slabs), -1..1 */
  tones: number[];
}

/**
 * The slab layout of the paving strip: `rows` rows along one texture period, each split into
 * 2-3 slabs between the curbs, the joints shifted from row to row (running bond).
 */
export function slabRows(rows: number, curb: number, seed: number): SlabRow[] {
  const r = rng(seed);
  const out: SlabRow[] = [];
  const inner = 1 - curb;
  let prevMid = 0;
  for (let i = 0; i < rows; i++) {
    const count = r() < 0.55 ? 2 : 3;
    const joints: number[] = [];
    if (count === 2) {
      // Never on the previous row's joint
      let j = (r() - 0.5) * 0.9 * inner;
      if (Math.abs(j - prevMid) < 0.2 * inner)
        j = j > prevMid ? j + 0.25 * inner : j - 0.25 * inner;
      j = Math.max(-0.6 * inner, Math.min(0.6 * inner, j));
      joints.push(j);
      prevMid = j;
    } else {
      const a = -inner + (0.55 + r() * 0.2) * inner;
      const b = inner - (0.55 + r() * 0.2) * inner;
      joints.push(a, b);
      prevMid = (a + b) / 2;
    }
    out.push({ joints, tones: Array.from({ length: count }, () => r() * 2 - 1) });
  }
  return out;
}

/** Where pixel (x, y) of the paving strip lies: slab row, slab, distances to the joints (in pixels). */
function slabAt(
  x: number,
  a: number,
  rows: readonly SlabRow[],
  rowLen: number,
  pxPerA: number,
): { row: number; slab: number; jointDist: number } {
  const row = Math.floor(mod(x, rows.length * rowLen) / rowLen);
  const along = mod(x, rowLen);
  const { joints } = rows[row];
  let slab = 0;
  while (slab < joints.length && a > joints[slab]) slab++;
  let jointDist = Math.min(along, rowLen - along);
  for (const j of joints) jointDist = Math.min(jointDist, Math.abs(a - j) * pxPerA);
  return { row, slab, jointDist };
}

/**
 * The stone paving as a strip (`width` along, repeating; `height` across, curb to curb): light
 * limestone slabs in rows with darker joints and slightly varied tones, a band of edge stones
 * (the curb) on both sides. Opaque between the curbs, antialiased at the outer edges.
 */
export function pavingImage(width: number, height: number): PixelImage {
  const P = theme.road.paving;
  const c = new Canvas(width, height);
  const rows = slabRows(P.rows, P.curb, 71);
  const rowLen = width / P.rows;
  const pxPerA = height / 2;
  const stone = rgbOf(P.stone);
  const light = rgbOf(P.stoneLight);
  const warm = rgbOf(P.stoneWarm);
  const curb = rgbOf(P.curbStone);
  const joint = rgbOf(P.joint);
  const curbLen = rowLen * P.curbStoneRows;
  for (let y = 0; y < height; y++) {
    const a = across(y, height, 1);
    const inCurb = Math.abs(a) > 1 - P.curb;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const grain = 1 + (hash2(x, y, 73) - 0.5) * P.grain;
      const wear = 1 + (fbm(u, (y + 0.5) / height, 8, 2, 3, 75) - 0.5) * P.wear;
      let rgb: number[];
      let jointDist: number;
      if (inCurb) {
        // Edge stones: long blocks with joints between them (the two sides staggered)
        const side = a > 0 ? 1 : 0;
        const along = mod(x + side * curbLen * 0.5, curbLen);
        const block = Math.floor(mod(x + side * curbLen * 0.5, width) / curbLen);
        const tone = (hash2(block, side, 77) - 0.5) * 2 * P.toneVar;
        rgb = curb.map((v) => v * (1 + tone));
        const innerDist = (Math.abs(a) - (1 - P.curb)) * pxPerA;
        jointDist = Math.min(along, curbLen - along, innerDist);
      } else {
        const s = slabAt(x, a, rows, rowLen, pxPerA);
        const t = rows[s.row].tones[s.slab];
        const base = t > 0.7 ? light : t < -0.8 ? warm : stone;
        const tone = 1 + t * P.toneVar;
        rgb = base.map((v) => v * tone);
        jointDist = s.jointDist;
      }
      // Joints: a dark line, slab edges a little darker toward it (worn, rounded edges)
      const j = smoothstep(P.jointWidth + 1, P.jointWidth, jointDist);
      const bevel = 1 - P.bevel * smoothstep(P.jointWidth + 3, P.jointWidth, jointDist);
      const k = grain * wear * bevel;
      const out = rgb.map((v, i) => v * k * (1 - j) + joint[i] * j);
      const alpha = smoothstep(1, 1 - 1.5 / pxPerA, Math.abs(a));
      c.set(x, y, out, alpha);
    }
  }
  return c.toImage();
}

/**
 * Relief of the paving (`width` along, repeating; `height` across, covering
 * [-reliefReach, reliefReach] of the paving's half width): raised curbs with their outer faces and
 * a soft cast shadow on the ground beside them, slightly domed slabs, sunken joints.
 */
export function pavingReliefImage(width: number, height: number): PixelImage {
  const P = theme.road.paving;
  const reach = P.reliefReach;
  const rows = slabRows(P.rows, P.curb, 71);
  const rowLen = width / P.rows;
  const pxPerA = height / (2 * reach);
  /** One pixel in half widths */
  const px = 1 / pxPerA;
  // Heights in pixels (so a slope of 1 = 45 degrees)
  const field = (x: number, y: number): number => {
    const a = across(y, height, reach);
    const d = Math.abs(a);
    // The curb: up at its inner edge, down again at its outer edge (each step ~1.5 px wide)
    const curb =
      smoothstep(1 - P.curb - px, 1 - P.curb + px, d) * smoothstep(1 + 2 * px, 1 - px, d);
    if (d >= 1 - P.curb) return curb * P.curbHeight * pxPerA;
    // Slabs: a little domed, the joints sunk
    const s = slabAt(x, a, rows, rowLen, pxPerA);
    const sunk = smoothstep(P.jointWidth + 2, 0, s.jointDist);
    return (curb * P.curbHeight - sunk * P.jointDepth) * pxPerA;
  };
  return reliefFromHeight(
    width,
    height,
    field,
    P.reliefLight,
    P.reliefShadow,
    P.reliefHollow,
    (y) => {
      const d = Math.abs(across(y, height, reach));
      return smoothstep(reach, 1 + (reach - 1) * 0.3, d);
    },
  );
}

/**
 * Flagstones for a paved square (planar, `n` x `n`, repeating; roadLayer.ts lays the grid along
 * the iso axes like the plaza): square slabs in rows (running bond), joints, varied tones.
 */
export function flagstoneTileImage(n: number): PixelImage {
  const P = theme.road.paving;
  const c = new Canvas(n, n);
  const per = P.squareSlabs;
  const cell = n / per;
  const stone = rgbOf(P.stone);
  const light = rgbOf(P.stoneLight);
  const warm = rgbOf(P.stoneWarm);
  const joint = rgbOf(P.joint);
  for (let y = 0; y < n; y++) {
    const row = Math.floor(y / cell);
    const shift = row % 2 === 0 ? 0 : cell / 2;
    for (let x = 0; x < n; x++) {
      const sx = mod(x + shift, n);
      const col = Math.floor(sx / cell);
      const t = hash2(col, row, 81) * 2 - 1;
      const base = t > 0.7 ? light : t < -0.8 ? warm : stone;
      const ax = mod(sx, cell);
      const ay = mod(y, cell);
      const jointDist = Math.min(ax, cell - ax, ay, cell - ay);
      const j = smoothstep(P.jointWidth + 1, P.jointWidth, jointDist);
      const bevel = 1 - P.bevel * smoothstep(P.jointWidth + 3, P.jointWidth, jointDist);
      const grain = 1 + (hash2(x, y, 83) - 0.5) * P.grain;
      const k = (1 + t * P.toneVar) * bevel * grain;
      c.set(
        x,
        y,
        base.map((v, i) => v * k * (1 - j) + joint[i] * j),
      );
    }
  }
  return c.toImage();
}

// ---------------------------------------------------------------------------------------------
// Banks of a cut through a hill (strip)
// ---------------------------------------------------------------------------------------------

/**
 * Texture of a bank beside a road through a hill (`width` along, repeating; `height` from the
 * foot of the bank (y = 0) to its top (y = height)): white, so the road mesh tints it lit or
 * shaded, broken up by small erosion gullies running down the slope and a ragged top edge.
 */
export function bankImage(width: number, height: number): PixelImage {
  const c = new Canvas(width, height);
  const cells = width / 32;
  // Per column: gullies (streaks down the slope) and the ragged top edge of the bank
  const columns = Array.from({ length: width }, (_, x) => {
    const u = (x + 0.5) / width;
    return {
      lum: 0.8 + 0.35 * fbm(u, 0.5, cells * 4, 1, 2, 91),
      top: 0.78 + 0.2 * fbm(u, 0.2, cells, 1, 3, 95),
    };
  });
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const { lum, top } = columns[x];
      const rough = fbm((x + 0.5) / width, v, cells * 2, 2, 3, 93);
      const a = smoothstep(top, top - 0.18, v) * (0.75 + 0.25 * rough);
      c.set(x, y, [lum, lum, lum], a);
    }
  }
  return c.toImage();
}
