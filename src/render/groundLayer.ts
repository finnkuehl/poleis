// Ground under and between the buildings (docs/ART.md, "Grounded buildings"): yards, plazas,
// clearings, stony aprons, fields over most of their tile and the fishery's sandy yard.
// One static Graphics in map space, between the terrain's flat ground and its standing details.
// Repainted only when the shown buildings change (compared by a cheap key), never per frame.
// Light comes from the upper left; shadows fall to the lower right.
import { Graphics, Matrix } from 'pixi.js';
import { hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { Building, GameState, MapState, PlayerId } from '../core/state';
import { buildingsShownTo } from './fog';
import { edgeNeighborHex, trackRibbon } from './geometry';
import type { HillMound } from './relief';
import {
  ISO_A,
  ISO_B,
  FIELD_CELL_REACH,
  OUTLINE_SAMPLES_PER_EDGE,
  YARD_LITTER,
  artGroundEllipse,
  cellCorners,
  clampToLimits,
  clampToOutline,
  clipHalfPlane,
  cropInset,
  clipToCell,
  dedupe,
  densify,
  edgeLimits,
  edgeNormal,
  fieldCells,
  fieldMounds,
  fieldJoinMask,
  fieldOutline,
  fieldTiles,
  fieldWarp,
  fisheryYardOffset,
  flatPoints,
  groundKindOf,
  groundKey,
  hillHeight,
  hillLight,
  insideConvex,
  insideOutline,
  isFieldKind,
  jettyEdge,
  laneMeetPoint,
  longestRun,
  moundsNear,
  organicBlob,
  outlinePoint,
  parallelLines,
  footprintOf,
  patchCenter,
  patchRadii,
  polygonArea,
  scalePoints,
  slopeOutline,
  spacedWells,
  tilePairKey,
  townLanes,
  townJoinMask,
  townTiles,
  translate,
  withinLimits,
  type FieldMound,
  type GroundKind,
  type OutlineSample,
  type YardLitter,
} from './groundworks';
import { mineArtTransform } from './relief';
import { reliefTexture } from './reliefPaint';
import {
  ellipsePoints,
  isWater,
  mixColor,
  scaleColor,
  taperedStroke,
  tileHash,
  tileRng,
} from './terrain';
import { theme } from './theme';

const G = theme.ground;

export interface GroundLayer {
  layer: Graphics;
  /**
   * Repaints the ground of the buildings `viewer` may see, if anything it depends on changed.
   * Returns true when it repainted (the terrain footprints need an update then too).
   */
  update(state: GameState, viewer: PlayerId): boolean;
  /** Test option: ground under every building (no fog). Takes effect on the next update. */
  setRevealAll(value: boolean): void;
}

// ---------------------------------------------------------------------------------------------
// Painter: collects polygons and lines per style and draws each style with ONE instruction
// ---------------------------------------------------------------------------------------------

interface FillBucket {
  kind: 'fill';
  color: number;
  alpha: number;
  polys: number[][];
}

interface LineBucket {
  kind: 'line';
  color: number;
  alpha: number;
  width: number;
  lines: Point[][];
}

interface Painter {
  fill(color: number, alpha: number, poly: readonly Point[] | number[]): void;
  line(color: number, alpha: number, width: number, points: readonly Point[]): void;
  /** Draws everything collected (styles in order of first use) and starts over. */
  flush(g: Graphics): void;
}

function createPainter(): Painter {
  const buckets = new Map<string, FillBucket | LineBucket>();
  return {
    fill(color, alpha, poly) {
      const flat = typeof poly[0] === 'number' ? (poly as number[]) : flatPoints(poly as Point[]);
      if (flat.length < 6 || alpha <= 0) return;
      const key = `f${color}:${alpha}`;
      let b = buckets.get(key);
      if (!b) {
        b = { kind: 'fill', color, alpha, polys: [] };
        buckets.set(key, b);
      }
      if (b.kind === 'fill') b.polys.push(flat);
    },
    line(color, alpha, width, points) {
      if (points.length < 2 || alpha <= 0) return;
      const key = `l${color}:${alpha}:${width}`;
      let b = buckets.get(key);
      if (!b) {
        b = { kind: 'line', color, alpha, width, lines: [] };
        buckets.set(key, b);
      }
      if (b.kind === 'line') b.lines.push([...points]);
    },
    flush(g) {
      for (const b of buckets.values()) {
        if (b.kind === 'fill') {
          for (const p of b.polys) g.poly(p);
          g.fill({ color: b.color, alpha: b.alpha });
        } else {
          for (const line of b.lines) {
            g.moveTo(line[0].x, line[0].y);
            for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
          }
          // Butt caps: a round cap costs ~30 vertices, a butt cap 4
          g.stroke({ color: b.color, alpha: b.alpha, width: b.width, cap: 'butt', join: 'round' });
        }
      }
      buckets.clear();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Small painting helpers
// ---------------------------------------------------------------------------------------------

/** One building's tile while painting. */
interface Site {
  b: Building;
  kind: GroundKind;
  /** Tile center (world px). */
  c: Point;
  size: number;
  /** How far ground may reach along each edge normal (see edgeLimits). */
  limits: number[];
  rng: () => number;
  /** Center of the building's patch relative to the tile center (see patchCenter). */
  o: Point;
  /** Hills or mountains under a building that is not a field: its patch is a slope patch. */
  slope: 'hills' | 'mountains' | null;
  /** The tile's terrain is hills or mountains (also for fields: their yard takes its colors). */
  sloped: 'hills' | 'mountains' | null;
  /** The footprint the terrain cuts its terrace for (the bank runs along its front). */
  fp: { rx: number; ry: number };
}

function add(a: Point, b: Point, k = 1): Point {
  return { x: a.x + b.x * k, y: a.y + b.y * k };
}

/** Small roundish dab (stone, leaf, crop) at a world position. */
function dab(
  p: Painter,
  color: number,
  alpha: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rng?: () => number,
  segments = 7,
): void {
  p.fill(color, alpha, ellipsePoints(x, y, rx, ry, segments, rng ? 0.22 : 0, rng));
}

/**
 * Random point inside the ellipse (rx, ry) around the origin, evenly spread; with `from` > 0 only
 * in the outer ring from that share of the radius (the middle is under the building).
 */
function spotIn(rng: () => number, rx: number, ry: number, from = 0): Point {
  const a = rng() * Math.PI * 2;
  const d = Math.sqrt(from * from + (1 - from * from) * rng());
  return { x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d };
}

/**
 * A patch with a feathered edge: the shape grown twice (around `origin`, relative to the tile
 * center) at low alpha under the shape itself, all kept inside the tile (`limits`), so it fades
 * softly into the terrain.
 */
function softPatch(
  p: Painter,
  c: Point,
  shape: readonly Point[],
  limits: readonly number[],
  color: number,
  coreAlpha: number = G.coreAlpha,
  origin: Point = { x: 0, y: 0 },
): void {
  G.featherGrow.forEach((grow, k) => {
    const grown = scalePoints(shape, grow, origin);
    p.fill(color, G.featherAlpha[k], translate(clampToLimits(grown, limits), c));
  });
  p.fill(color, coreAlpha, translate(clampToLimits(shape, limits), c));
}

/**
 * A patch on hills or mountains: no round disc, but ground cut into the slope. Flat front along
 * the terrace bank, ragged back and sides that fade strongly into the slope, a little of the
 * slope shining through.
 */
function slopePatch(p: Painter, s: Site, rx: number, ry: number, color: number): void {
  const S = G.slope;
  const phase = [s.rng(), s.rng(), s.rng()].map((v) => v * Math.PI * 2);
  S.featherGrow.forEach((grow, k) => {
    const pts = clampToLimits(slopeOutline(rx, ry, s.fp, grow, phase), s.limits);
    p.fill(color, S.featherAlpha[k], translate(pts, s.c));
  });
  p.fill(
    color,
    S.coreAlpha,
    translate(clampToLimits(slopeOutline(rx, ry, s.fp, 1, phase), s.limits), s.c),
  );
}

/** Color of a patch: on slopes from the terrain's own color family, else the plains color. */
function patchColor(s: Site, plains: number, kind: 'earth' | 'stone' = 'earth'): number {
  const S = G.slope;
  if (s.sloped === 'mountains') return S.mountainColor;
  if (s.sloped === 'hills') return kind === 'stone' ? S.hillStoneColor : S.hillColor;
  return plains;
}

/**
 * The ground of a patch: on plains the soft organic `shape`, on slopes a slope patch. Returns
 * the radii details should be scattered in (smaller on slopes, near the building).
 */
function patchBase(
  p: Painter,
  s: Site,
  rx: number,
  ry: number,
  shape: readonly Point[],
  color: number,
  origin: Point = { x: 0, y: 0 },
): { rx: number; ry: number } {
  if (s.slope) {
    slopePatch(p, s, rx, ry, color);
    return {
      rx: rx * G.slope.scale * G.slope.detailShare,
      ry: ry * G.slope.scale * G.slope.detailShare,
    };
  }
  softPatch(p, s.c, shape, s.limits, color, G.coreAlpha, origin);
  return { rx, ry };
}

// ---------------------------------------------------------------------------------------------
// Patches (pass 3)
// ---------------------------------------------------------------------------------------------

/** Trodden-earth yard around the patch center `s.o` (the tile center for most buildings). */
function paintYard(p: Painter, s: Site, rx: number, ry: number, litter?: YardLitter): void {
  const Y = G.yard;
  const { size, rng, limits, o } = s;
  // Everything is placed relative to the patch center; the tile limits stay as they are
  const c = add(s.c, o);
  const shape = translate(organicBlob(rx, ry, rng, G.wobble), o);
  const color = patchColor(s, Y.color);
  const d = patchBase(p, s, rx, ry, shape, color, o);
  if (!s.sloped) {
    // Sunlit, worn middle a bit toward the upper left (not on slopes: it would read as a disc)
    const light = translate(scalePoints(shape, 0.55, o), { x: -0.12 * rx, y: -0.14 * ry });
    p.fill(Y.lightColor, Y.lightAlpha, translate(clampToLimits(light, limits), s.c));
  }
  const worn = s.sloped ? G.slope.dustColor : Y.wornColor;
  rx = d.rx;
  ry = d.ry;
  const ring = G.detailRing;
  for (let i = 0; i < 2; i++) {
    const q = spotIn(rng, rx * 0.8, ry * 0.8, ring);
    dab(p, worn, Y.wornAlpha, c.x + q.x, c.y + q.y, 0.13 * size, 0.05 * size, rng);
  }
  for (let i = 0; i < 5; i++) {
    const q = spotIn(rng, rx * 0.9, ry * 0.9, ring);
    const color = Y.pebbleColors[i % Y.pebbleColors.length];
    dab(p, color, 1, c.x + q.x, c.y + q.y, 0.024 * size, 0.017 * size, rng, 5);
  }
  if (!litter) return;
  for (let i = 0; i < 7; i++) {
    const q = spotIn(rng, rx * 0.85, ry * 0.85, ring);
    const x = c.x + q.x;
    const y = c.y + q.y;
    if (litter === 'sawdust') dab(p, Y.sawdustColor, 0.85, x, y, 0.04 * size, 0.022 * size, rng);
    else if (litter === 'soot')
      dab(p, Y.sootColor, Y.sootAlpha, x, y, 0.07 * size, 0.03 * size, rng);
    else {
      // Straw: short golden blades
      const a = rng() * Math.PI;
      const l = 0.05 * size;
      const d = { x: Math.cos(a) * l, y: Math.sin(a) * l * 0.5 };
      p.line(Y.strawColor, 0.9, 0.7, [
        { x: x - d.x, y: y - d.y },
        { x: x + d.x, y: y + d.y },
      ]);
    }
  }
}

/** Iso octagon (edges along the iso axes, plus horizontal and vertical ones): half axes rx, ry. */
function isoOctagon(rx: number, ry: number): Point[] {
  const r = rx / Math.cos(Math.PI / 8);
  const pts: Point[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (Math.PI / 4) * i;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * (ry / rx) });
  }
  return pts;
}

/** Paved plaza; `apron`: on its own trodden-earth apron (not inside a shared town ground). */
function paintPlaza(p: Painter, s: Site, rx: number, ry: number, apron = true): void {
  const P = G.plaza;
  const { c, size, rng, limits } = s;
  // Trodden earth apron, so the paving does not sit on the grass like a sticker
  if (apron) {
    const shape = organicBlob(rx * P.apronGrow, ry * P.apronGrowY, rng, G.wobble);
    patchBase(p, s, rx * P.apronGrow, ry * P.apronGrow, shape, patchColor(s, G.yard.color));
  }
  let paving = isoOctagon(rx, ry);
  for (let e = 0; e < 6; e++) {
    const a = (Math.PI / 3) * e;
    paving = clipHalfPlane(paving, { x: Math.cos(a), y: Math.sin(a) }, limits[e]);
  }
  if (paving.length < 3) return;
  const inner = scalePoints(paving, P.curbShare);
  p.fill(P.curbColor, 1, translate(paving, c));
  p.fill(P.stoneColor, 1, translate(inner, c));
  // A few lighter / warmer flagstones: grid cells between the joint lines
  const sp = P.jointSpacing * size;
  const nA = { x: -ISO_A.y, y: ISO_A.x };
  const nB = { x: -ISO_B.y, y: ISO_B.x };
  const neg = (v: Point): Point => ({ x: -v.x, y: -v.y });
  const reach = Math.ceil((rx * 1.2) / sp);
  for (let i = -reach; i < reach; i++) {
    for (let j = -reach; j < reach; j++) {
      if (rng() >= P.tintChance) continue;
      let cell = clipHalfPlane(inner, nA, (i + 1) * sp);
      cell = clipHalfPlane(cell, neg(nA), -i * sp);
      cell = clipHalfPlane(cell, nB, (j + 1) * sp);
      cell = clipHalfPlane(cell, neg(nB), -j * sp);
      if (cell.length < 3) continue;
      p.fill(rng() < 0.5 ? P.stoneLight : P.stoneWarm, P.tintAlpha, translate(cell, c));
    }
  }
  for (const dir of [ISO_A, ISO_B]) {
    for (const [a, b] of parallelLines(inner, dir, sp)) {
      p.line(P.jointColor, P.jointAlpha, P.jointWidth, [add(c, a), add(c, b)]);
    }
  }
  // Sunlit upper left
  p.fill(
    P.sunColor,
    P.sunAlpha,
    translate(clampToLimits(organicBlob(rx * 0.5, ry * 0.45, rng, 0.05), limits), {
      x: c.x - 0.3 * rx,
      y: c.y - 0.3 * ry,
    }),
  );
}

function paintClearing(p: Painter, s: Site, rx: number, ry: number): void {
  const C = G.clearing;
  const { c, size, rng, limits } = s;
  const shape = organicBlob(rx, ry, rng, G.wobble * 1.3);
  const d = patchBase(p, s, rx, ry, shape, s.sloped ? patchColor(s, C.color) : C.color);
  if (!s.sloped) {
    for (let i = 0; i < 2; i++) {
      const q = spotIn(rng, rx * 0.7, ry * 0.7);
      dab(p, C.darkColor, 0.4, c.x + q.x, c.y + q.y, 0.16 * size, 0.07 * size, rng, 8);
    }
    p.fill(
      C.sunColor,
      0.45,
      translate(clampToLimits(scalePoints(shape, 0.45), limits), {
        x: c.x - 0.2 * rx,
        y: c.y - 0.2 * ry,
      }),
    );
  }
  rx = d.rx;
  ry = d.ry;
  // Fallen leaves and wood chips
  for (let i = 0; i < 12; i++) {
    const q = spotIn(rng, rx * 1.05, ry * 1.05, G.detailRing * 0.7);
    const color = C.leafColors[i % C.leafColors.length];
    dab(p, color, 0.9, c.x + q.x, c.y + q.y, 0.022 * size, 0.014 * size, rng, 5);
  }
  for (let i = 0; i < 6; i++) {
    const q = spotIn(rng, rx * 0.9, ry * 0.9, G.detailRing);
    dab(p, C.chipColor, 1, c.x + q.x, c.y + q.y, 0.02 * size, 0.012 * size, rng, 4);
  }
  // Stumps around the front half (the back is behind the hut)
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (0.05 + (0.9 * (i + 0.2 + rng() * 0.6)) / count);
    const x = c.x + Math.cos(a) * rx * 0.85;
    const y = c.y + Math.sin(a) * ry * 0.85;
    const r = (0.05 + rng() * 0.015) * size;
    dab(p, G.shadowColor, G.shadowAlpha, x + r * 0.7, y + r * 0.25, r * 1.2, r * 0.45);
    dab(p, C.stumpSide, 1, x, y + r * 0.35, r, r * 0.5, undefined, 10);
    p.fill(C.stumpSide, 1, [
      { x: x - r, y },
      { x: x + r, y },
      { x: x + r, y: y + r * 0.35 },
      { x: x - r, y: y + r * 0.35 },
    ]);
    dab(p, C.stumpTop, 1, x, y, r, r * 0.5, undefined, 10);
    dab(p, C.stumpRing, 1, x, y, r * 0.55, r * 0.27, undefined, 8);
  }
}

/**
 * Quarry ground: a stony apron with rubble and gravel and a soft rim. The quarry itself (rock
 * face or pit, cut blocks, crane) is part of the drawn art.
 */
/**
 * Mine or quarry on a slope: the terrain cuts the rock face or terraces into its own slope and
 * the art shows the works; the ground is only a narrow, ragged ledge of scree and gravel in
 * front of them, with stones on it.
 */
function paintLedge(
  p: Painter,
  s: Site,
  stones: { count: number; colors: readonly number[] },
  gravel: { count: number; colors: readonly number[] },
  t: { x: number; y: number; scale: number } = { x: 0, y: 0, scale: 1 },
): void {
  const L = G.slope.ledge;
  const { c, size, rng, limits } = s;
  // `t`: where the works stand and how big (the mine: relief.ts mineArtTransform)
  const o = { x: t.x, y: t.y + L.y * size * t.scale };
  const rx = L.rx * size * t.scale;
  const ry = L.ry * size * t.scale;
  const shape = translate(organicBlob(rx, ry, rng, 0.25), o);
  softPatch(p, c, shape, limits, patchColor(s, G.mine.color, 'stone'), G.slope.coreAlpha + 0.1, o);
  const place = (count: number, colors: readonly number[], r0: number, dr: number): void => {
    for (let i = 0; i < count; i++) {
      const q = add(o, spotIn(rng, rx * 0.95, ry * 0.9));
      if (!withinLimits(q, limits, 1)) continue;
      const r = (r0 + rng() * dr) * size;
      dab(p, colors[i % colors.length], 1, c.x + q.x, c.y + q.y, r, r * 0.7, rng, 5);
    }
  };
  place(stones.count, stones.colors, 0.014, 0.016);
  place(gravel.count, gravel.colors, 0.007, 0.006);
}

function paintQuarry(p: Painter, s: Site, rx: number, ry: number): void {
  const Q = G.quarry;
  // On hills tan gravel, elsewhere stone grey
  const gravelColors = s.sloped === 'hills' ? G.slope.hillGravelColors : Q.gravelColors;
  if (s.slope) {
    paintLedge(
      p,
      s,
      { count: Q.rubbleCount, colors: Q.rubbleColors },
      { count: Q.gravelCount, colors: gravelColors },
    );
    return;
  }
  // On plains: a stony apron around the quarry
  const shape = organicBlob(rx, ry, s.rng, G.wobble);
  const d = patchBase(p, s, rx, ry, shape, Q.color);
  scatter(p, s, d.rx, d.ry, Q.rubbleCount, Q.rubbleColors, 0.018, 0.018);
  scatter(p, s, d.rx, d.ry, Q.gravelCount, gravelColors, 0.008, 0.006);
}

/**
 * `count` small stones in the outer part of a patch (`r0` + up to `dr` x hex size), colors in
 * turn; the middle is under the building.
 */
function scatter(
  p: Painter,
  s: Site,
  rx: number,
  ry: number,
  count: number,
  colors: readonly number[],
  r0: number,
  dr: number,
): void {
  const { c, size, rng } = s;
  for (let i = 0; i < count; i++) {
    const pt = spotIn(rng, rx, ry, s.slope ? G.slope.detailRing : G.detailRing);
    const r = (r0 + rng() * dr) * size;
    dab(p, colors[i % colors.length], 1, c.x + pt.x, c.y + pt.y, r, r * 0.7, rng, 5);
  }
}

/**
 * Mine ground: a rock apron with scattered stones (some ore-red) and a soft rim. The rock
 * outcrop, the entrance, the spoil heap, the cart and the rails are part of the drawn art.
 */
function paintMine(p: Painter, s: Site, rx: number, ry: number): void {
  const M = G.mine;
  if (s.slope) {
    paintLedge(
      p,
      s,
      { count: M.stoneCount, colors: M.stoneColors },
      { count: G.quarry.gravelCount, colors: G.quarry.gravelColors },
      mineArtTransform(s.size),
    );
    return;
  }
  const shape = organicBlob(rx, ry, s.rng, G.wobble);
  const d = patchBase(p, s, rx, ry, shape, patchColor(s, M.color, 'stone'));
  scatter(p, s, d.rx, d.ry, M.stoneCount, M.stoneColors, 0.016, 0.018);
}

/**
 * Sandy yard of a fishery, centered under the hut of the drawn scene (shifted toward its jetty
 * edge, to the shoreline). Toward the water it stops at the beach like every patch.
 */
function paintFishery(p: Painter, s: Site, rx: number, ry: number, edge: number | null): void {
  const F = G.fishery;
  const { c, size, rng, limits } = s;
  const o = fisheryYardOffset(edge, size);
  softPatch(
    p,
    c,
    translate(organicBlob(rx, ry, rng, G.wobble), o),
    limits,
    F.color,
    G.coreAlpha,
    o,
  );
  for (let i = 0; i < 4; i++) {
    const q = add(o, spotIn(rng, rx * 0.9, ry * 0.9, G.detailRing));
    if (!withinLimits(q, limits, 1)) continue;
    const color = G.yard.pebbleColors[i % G.yard.pebbleColors.length];
    dab(p, color, 1, c.x + q.x, c.y + q.y, 0.022 * size, 0.016 * size, rng, 5);
  }
  // Around the yard: sparse beach grass, a few shells and pebbles
  for (let i = 0; i < F.litterCount; i++) {
    const a = rng() * Math.PI * 2;
    const d = 0.85 + rng() * 0.45;
    const q = add(o, { x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d });
    if (!withinLimits(q, limits, 1)) continue;
    const x = c.x + q.x;
    const y = c.y + q.y;
    const k = i % 3;
    if (k === 0) tuft(p, F.beachGrass, x, y, size, rng);
    else if (k === 1) {
      const color = F.shellColors[Math.floor(rng() * F.shellColors.length)];
      dab(p, color, 1, x, y, 0.016 * size, 0.011 * size, undefined, 5);
    } else dab(p, F.pebbleColor, 1, x, y, 0.02 * size, 0.014 * size, rng, 5);
  }
}

// ---------------------------------------------------------------------------------------------
// Fields (pass 1: ground, rows, walls; pass 4: vines and olive trees)
// ---------------------------------------------------------------------------------------------

interface FieldParcel {
  /** Warped parcel, trimmed to the outline (relative to the tile center). */
  poly: Point[];
  /** The straight iso cell it came from (convex; furrows are laid out in it). */
  cell: Point[];
  dir: Point;
  color: number;
  /** Vine rows, computed once (soil strips and vines use the same rows). */
  rows?: Point[][];
}

interface FieldSite extends Site {
  joined: boolean[];
  outline: OutlineSample[];
  /** Largest outline distance: rows are cut to this circle before they are trimmed exactly. */
  maxR: number;
  parcels: FieldParcel[];
  warp: (p: Point) => Point;
  /** Meadow color of the tile's terrain: the rim fades toward it. */
  meadow: number;
  /** Typical crop color and the ground under the crops (balks, rim). */
  crop: number;
  base: number;
  /** Index of the tile and its neighbors (-1 outside the map). */
  index: number;
  neighbors: number[];
  /** Per edge: the neighbor is a field of another kind (a hedge or wall lies between them). */
  otherField: boolean[];
  /**
   * On hills: the field lies on top of the slopes. Its ground is see-through, so the terrain's
   * mounds show; its rows drape over them and are shaded like them (`mounds` near the tile).
   */
  hill: boolean;
  mounds: HillMound[];
  /** The mounds cut to the field's crop area (on hills; else empty). */
  relief: FieldMound[];
}

/** Densify step (px) for parcel outlines: fine enough to follow the outline and the warp. */
const PARCEL_STEP = 3.5;

function fieldSite(
  map: MapState,
  s: Site,
  fields: ReadonlyMap<number, GroundKind>,
  towns: ReadonlyMap<number, number> = new Map(),
): FieldSite {
  const F = G.field;
  const { size, rng } = s;
  const joined = fieldJoinMask(map, s.b.hex, fields, s.kind);
  const outline = fieldOutline(map, s.b.hex, size, joined);
  const warp = fieldWarp(s.b.hex, size);
  const index = tileIndex(map, s.b.hex);
  const terrainColor = theme.terrainColors[map.tiles[index]];
  // Next to a town the field fades into the town's worn ground
  const byTown = [0, 1, 2, 3, 4, 5].some((e) =>
    towns.has(tileIndex(map, edgeNeighborHex(s.b.hex, e))),
  );
  const meadow = byTown ? mixColor(terrainColor, G.yard.color, G.town.baseEarthMix) : terrainColor;
  const crop =
    s.kind === 'farm'
      ? F.wheatColors[0]
      : s.kind === 'vineyard'
        ? G.vineyard.soilColors[0]
        : G.orchard.grassColors[0];
  const inset = F.parcelInset * size;
  const overlap = F.joinOverlap * size;
  // The field area: the outline a little further in on the open rim, a little past the shared
  // boundary of joined fields (their crops meet there); every parcel is its part inside one
  // cell, then gently warped (bowed edges) and kept inside that area
  const area = densify(
    outline.map((o) => outlinePoint(o, -cropInset(o.open, inset, overlap))),
    PARCEL_STEP,
    true,
  );
  const parcels: FieldParcel[] = [];
  const hill = s.sloped === 'hills';
  const mounds = hill ? moundsNear(map, s.b.hex, size) : [];
  // Farms and vineyards: an orderly farmstead in the middle of its fields; olive groves: free
  const layout = s.kind === 'orchard' ? 'free' : 'farmstead';
  fieldCells(rng, size, F.gap * size, layout).forEach((cell, i) => {
    const corners = cellCorners(cell);
    const clipped = clipToCell(area, cell, FIELD_CELL_REACH * size * 0.99);
    const poly = dedupe(
      clampToOutline(densify(clipped, PARCEL_STEP, true).map(warp), outline, inset, overlap),
      0.6,
    );
    let color: number;
    if (s.kind === 'farm') {
      const k = rng();
      color =
        k < F.ploughedChance
          ? F.ploughedColor
          : k < F.ploughedChance + F.youngChance
            ? F.youngColor
            : F.wheatColors[Math.floor(rng() * F.wheatColors.length)];
    } else if (s.kind === 'vineyard') {
      color = G.vineyard.soilColors[i % G.vineyard.soilColors.length];
    } else color = G.orchard.grassColors[i % G.orchard.grassColors.length];
    if (polygonArea(poly) > 0.02 * size * size)
      parcels.push({ poly, cell: corners, dir: cell.dir, color });
  });
  const neighbors = [0, 1, 2, 3, 4, 5].map((e) => tileIndex(map, edgeNeighborHex(s.b.hex, e)));
  const otherField = neighbors.map((n) => {
    const k = n >= 0 ? fields.get(n) : undefined;
    return k !== undefined && k !== s.kind;
  });
  return {
    ...s,
    joined,
    outline,
    maxR: Math.max(...outline.map((o) => o.r)) + 1,
    parcels,
    warp,
    meadow,
    crop,
    base: mixColor(crop, meadow, F.baseMeadowMix),
    index,
    neighbors,
    otherField,
    hill,
    mounds,
    relief: hill ? fieldMounds(mounds, s.c, outline, inset, overlap) : [],
  };
}

/**
 * Quads of a band along the outline, from `from` to `to` px off it (negative = inside), only
 * where the outline is open (toward a neighbor without a field).
 */
function rimBand(
  f: { outline: readonly OutlineSample[]; c: Point },
  from: number,
  to: number,
): Point[][] {
  const quads: Point[][] = [];
  const n = f.outline.length;
  for (let i = 0; i < n; i++) {
    const s0 = f.outline[i];
    const s1 = f.outline[(i + 1) % n];
    if ((s0.open + s1.open) / 2 < 0.5) continue;
    quads.push(
      translate(
        [
          outlinePoint(s0, from),
          outlinePoint(s1, from),
          outlinePoint(s1, to),
          outlinePoint(s0, to),
        ],
        f.c,
      ),
    );
  }
  return quads;
}

/** 1a. Soft rim outside the outline (fading into the meadow) and the ground under the crops. */
function paintFieldBase(p: Painter, f: FieldSite): void {
  const F = G.field;
  const w = F.featherWidth * f.size;
  // On hills the field ground is see-through: the slopes roll on under the field
  const share = f.hill ? F.hillFeatherShare : 1;
  F.featherAlpha.forEach((alpha, k) => {
    const color = mixColor(f.base, f.meadow, F.featherMeadowMix[k]);
    for (const q of rimBand(f, k * w, (k + 1) * w)) p.fill(color, alpha * share, q);
  });
  p.fill(
    f.base,
    f.hill ? F.hillFillAlpha : G.coreAlpha,
    translate(
      f.outline.map((o) => outlinePoint(o)),
      f.c,
    ),
  );
}

/**
 * 1b'. On hills: every mound under the field again in the field's colors, shaded with the
 * terrain's mound texture (lit upper left, darker lower right, fading at its foot) laid over the
 * whole mound, and its sunlit crest; so the slopes roll on under the crops.
 */
function paintFieldRelief(g: Graphics, p: Painter, f: FieldSite): void {
  if (f.relief.length === 0) return;
  const F = G.field;
  const tex = reliefTexture('mound');
  const body = scaleColor(f.crop, F.hillLit);
  const crest = scaleColor(f.crop, F.hillCrestLit);
  for (const m of f.relief) {
    const { x, y, w, h } = m.bounds;
    g.poly(flatPoints(translate(m.poly, f.c))).fill({
      texture: tex,
      color: body,
      alpha: F.hillReliefAlpha,
      textureSpace: 'global',
      // Texture pixels -> the whole mound's bounds (world px)
      matrix: new Matrix(w / tex.width, 0, 0, h / tex.height, x, y),
    });
    if (m.crest.length >= 2) {
      const width = Math.max(1, F.hillCrestWidth * m.h);
      p.fill(crest, F.hillCrestAlpha, taperedStroke(translate(m.crest, f.c), width));
    }
  }
}

/** Furrow / row lines of a parcel, warped and trimmed to the field, as point runs (relative). */
function parcelRows(f: FieldSite, parcel: FieldParcel, spacing: number, offset: number): Point[][] {
  const F = G.field;
  const end = F.rowEndMargin * f.size;
  const keepInset = F.parcelInset * f.size + end;
  const runs: Point[][] = [];
  for (const [a0, b0] of parallelLines(parcel.cell, parcel.dir, spacing, offset)) {
    // The cells reach far past the field: first cut the line to the outline's circle
    const chord = circleChord(a0, b0, f.maxR);
    if (!chord) continue;
    const [a, b] = chord;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 2 * end) continue;
    const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let pts = densify([add(a, d, end), add(b, d, -end)], 2.5, false).map(f.warp);
    // On hills the row lies on the slope: it bows up over every mound
    if (f.hill) pts = pts.map((q) => ({ x: q.x, y: q.y - G.field.hillDrape * heightAt(f, q) }));
    const run = longestRun(pts, (q) => insideOutline(q, f.outline, keepInset));
    if (run.length >= 3) runs.push(thin(run, f.hill ? 14 : 8));
  }
  return runs;
}

/** Part of the segment a-b inside the circle of radius r around the tile center, or null. */
function circleChord(a: Point, b: Point, r: number): [Point, Point] | null {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const A = d.x * d.x + d.y * d.y;
  const B = 2 * (a.x * d.x + a.y * d.y);
  const C = a.x * a.x + a.y * a.y - r * r;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc <= 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - sq) / (2 * A));
  const t1 = Math.min(1, (-B + sq) / (2 * A));
  if (t1 <= t0) return null;
  return [add(a, d, t0), add(a, d, t1)];
}

/** Hill height under a point of a field (relative to the tile center), px. */
function heightAt(f: FieldSite, q: Point): number {
  return hillHeight(f.mounds, { x: f.c.x + q.x, y: f.c.y + q.y });
}

/** Light class of a point of a field on hills: 1 lit, 0 middle, -1 shaded (like the mounds). */
function lightAt(f: FieldSite, q: Point): number {
  if (!f.hill) return 0;
  const l = hillLight(f.mounds, { x: f.c.x + q.x, y: f.c.y + q.y }, f.size);
  return l > G.field.hillLightLevel ? 1 : l < -G.field.hillLightLevel ? -1 : 0;
}

/** A color a little lighter on lit slopes, darker on shaded ones. */
function lit(color: number, light: number): number {
  const F = G.field;
  return light > 0
    ? scaleColor(color, F.hillLit)
    : light < 0
      ? scaleColor(color, F.hillShade)
      : color;
}

/**
 * A row strip (relative points) tapering at both ends; on hills split where the light changes,
 * each part lighter or darker like the slope under it.
 */
function rowStrip(
  p: Painter,
  f: FieldSite,
  run: readonly Point[],
  width: number,
  color: number,
  alpha: number,
): void {
  const pts = translate(run, f.c);
  if (!f.hill) {
    p.fill(color, alpha, taperedStroke(pts, width));
    return;
  }
  const n = pts.length;
  const widths = pts.map((_, i) => width * Math.sqrt(Math.sin((Math.PI * i) / (n - 1))));
  let start = 0;
  let cls = lightAt(f, run[0]);
  for (let i = 1; i <= n; i++) {
    const next = i < n ? lightAt(f, run[i]) : null;
    if (next === cls) continue;
    const end = Math.min(n - 1, i);
    if (end > start) {
      p.fill(
        lit(color, cls),
        alpha,
        trackRibbon(pts.slice(start, end + 1), widths.slice(start, end + 1), 1),
      );
    }
    start = end;
    if (next !== null) cls = next;
  }
}

/** Vine rows of a parcel (computed once). */
function vineRows(f: FieldSite, parcel: FieldParcel): Point[][] {
  parcel.rows ??= parcelRows(f, parcel, G.vineyard.rowSpacing * f.size, 0);
  return parcel.rows;
}

/** At most `max` points of a run (always keeping both ends). */
function thin(points: readonly Point[], max: number): Point[] {
  if (points.length <= max) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))]);
  return out;
}

/** 1c. Faint furrows (farm) and soil strips under the vine rows, fading out at their ends. */
function paintFieldRows(p: Painter, f: FieldSite): void {
  const F = G.field;
  const { c, size } = f;
  for (const parcel of f.parcels) {
    if (f.kind === 'farm') {
      const spacing = F.furrowSpacing * size;
      const dark = scaleColor(parcel.color, F.furrowShade);
      const light = scaleColor(parcel.color, F.ridgeLight);
      for (const run of parcelRows(f, parcel, spacing, 0)) {
        p.fill(dark, F.furrowAlpha, taperedStroke(translate(run, c), F.furrowWidth));
      }
      for (const run of parcelRows(f, parcel, spacing, spacing / 2)) {
        p.fill(light, F.ridgeAlpha, taperedStroke(translate(run, c), F.ridgeWidth));
      }
    } else if (f.kind === 'orchard') {
      // Orchard grass: light tufts and a few flowers between the (drawn) olive trees
      const O = G.orchard;
      const inset = 0.08 * size;
      const spot = (): Point | null => {
        const q = { x: (f.rng() - 0.5) * 1.7 * size, y: (f.rng() - 0.5) * 1.7 * size };
        if (!insideOutline(q, f.outline, inset)) return null;
        if (!insideConvex(q, parcel.poly, 0.5)) return null;
        return inFieldYard(f, q) ? null : q;
      };
      for (let i = 0; i < O.tuftCount / f.parcels.length; i++) {
        const q = spot();
        if (q) tuft(p, O.tuftColor, c.x + q.x, c.y + q.y, size, f.rng);
      }
      for (let i = 0; i < O.flowerCount / f.parcels.length; i++) {
        const q = spot();
        if (!q) continue;
        const color = O.flowerColors[Math.floor(f.rng() * O.flowerColors.length)];
        dab(p, color, 1, c.x + q.x, c.y + q.y, 0.018 * size, 0.014 * size, undefined, 4);
      }
    } else if (f.kind === 'vineyard') {
      const V = G.vineyard;
      for (const run of vineRows(f, parcel))
        rowStrip(p, f, run, V.rowWidth, V.rowColor, V.rowAlpha);
    }
  }
}

/** Little tuft of two blades with its foot at (x, y). */
function tuft(
  p: Painter,
  color: number,
  x: number,
  y: number,
  size: number,
  rng: () => number,
): void {
  const k = size / 32;
  for (const side of [-0.6, 0.6]) {
    const bx = x + side * 0.9 * k;
    const tipX = bx + side * 0.8 * k + (rng() - 0.5) * 0.6 * k;
    const tipY = y - (2.2 + rng() * 1.4 - Math.abs(side) * 0.5) * k;
    p.fill(color, 0.95, [bx - 0.55 * k, y, bx + 0.55 * k, y, tipX, tipY]);
  }
}

/** Point on the outline between samples i and i + 1, `off` px outside it (relative). */
function rimPoint(
  f: { outline: readonly OutlineSample[] },
  i: number,
  t: number,
  off: number,
): Point {
  const n = f.outline.length;
  const s0 = f.outline[i];
  const s1 = f.outline[(i + 1) % n];
  const p0 = outlinePoint(s0, off);
  const p1 = outlinePoint(s1, off);
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

/**
 * 1d. Where the field meets the land: the crops fade toward the meadow, ragged tufts spill out
 * and meadow tufts and weeds poke in, now and then a shrub, a hedge or a wall piece. Where two
 * fields meet: a soft wavy grass balk, sometimes with a hedge or wall piece on it.
 */
function paintFieldRim(p: Painter, f: FieldSite, map: MapState): void {
  const F = G.field;
  const { c, size, rng } = f;
  const w = F.rimWidth * size;
  const rimColor = mixColor(f.crop, f.meadow, F.rimMeadowMix);
  F.rimAlpha.forEach((alpha, k) => {
    const a = f.hill ? alpha * F.hillFeatherShare : alpha;
    for (const q of rimBand(f, -(k + 1) * w, -k * w)) p.fill(rimColor, a, q);
  });
  const n = f.outline.length;
  const N = OUTLINE_SAMPLES_PER_EDGE;
  // Ragged edge on the open parts
  const spill =
    f.kind === 'farm'
      ? F.cropTuftColor
      : f.kind === 'vineyard'
        ? G.vineyard.vineDark
        : F.cropTuftColor;
  for (let i = 0; i < n; i++) {
    const open = (f.outline[i].open + f.outline[(i + 1) % n].open) / 2;
    if (open < 0.6) continue;
    if (rng() < F.tuftChance) {
      const q = add(c, rimPoint(f, i, rng(), rng() * 0.05 * size));
      if (f.kind === 'vineyard') {
        dab(p, spill, 1, q.x, q.y - 0.02 * size, 0.035 * size, 0.026 * size, rng, 5);
      } else tuft(p, spill, q.x, q.y, size, rng);
    }
    if (rng() < F.meadowTuftChance) {
      const q = add(c, rimPoint(f, i, rng(), -(0.02 + rng() * 0.06) * size));
      tuft(p, F.meadowTuftColor, q.x, q.y, size, rng);
    }
    if (rng() < F.weedChance) {
      const q = add(c, rimPoint(f, i, rng(), -(0.04 + rng() * 0.1) * size));
      const color = F.weedColors[Math.floor(rng() * F.weedColors.length)];
      dab(p, color, 1, q.x, q.y, 0.022 * size, 0.018 * size, rng, 5);
    }
  }
  // Toward a field of another kind: a hedge or a low wall along the rim (drawn by the tile with
  // the lower index; the grass strip between both rims stays on the vertical edges)
  for (let e = 0; e < 6; e++) {
    const nb = f.neighbors[e];
    if (!f.otherField[e] || nb < f.index || e === 0 || e === 3) continue;
    const pts: Point[] = [];
    for (let i = e * N + 1; i <= e * N + N - 2; i++) {
      pts.push(add(c, outlinePoint(f.outline[i % n], 0.03 * size)));
    }
    const hedge = tileHash(Math.min(f.index, nb), Math.max(f.index, nb), 92) < G.wall.hedgeShare;
    wallLine(p, pts, hedge, size, rng);
  }
  // Now and then a shrub, a hedge piece or a wall piece on an open land edge
  for (let e = 0; e < 6; e++) {
    const nb = f.neighbors[e];
    if (f.joined[e] || f.otherField[e] || nb < 0 || isWater(map.tiles[nb])) continue;
    const h = tileHash(f.b.hex.q, f.b.hex.r, 180 + e);
    const first = e * N;
    if (h < F.shrubChance) {
      const q = add(c, rimPoint(f, first + 2 + Math.floor(rng() * (N - 4)), rng(), 0.04 * size));
      const r = (0.07 + rng() * 0.03) * size;
      dab(
        p,
        G.shadowColor,
        G.shadowAlpha,
        q.x + r * 0.5,
        q.y + r * 0.1,
        r * 1.1,
        r * 0.45,
        undefined,
        8,
      );
      dab(p, F.shrubDark, 1, q.x, q.y - r * 0.5, r, r * 0.75, rng, 8);
      dab(p, F.shrubLight, 1, q.x - r * 0.25, q.y - r * 0.72, r * 0.6, r * 0.42, rng, 7);
      continue;
    }
    // Hedges and walls only on the slanted edges (along a vertical edge they read as a post)
    if (e === 0 || e === 3) continue;
    const pieceHedge = h < F.shrubChance + F.hedgeChance;
    if (!pieceHedge && h >= F.shrubChance + F.hedgeChance + F.wallChance) continue;
    const start = first + 1 + Math.floor(rng() * 3);
    const pts: Point[] = [];
    for (let i = start; i <= start + 3; i++)
      pts.push(add(c, outlinePoint(f.outline[i % n], 0.02 * size)));
    wallLine(p, pts, pieceHedge, size, rng);
  }
  // Shared boundaries with neighboring fields, drawn once (by the tile with the lower index)
  for (let e = 0; e < 6; e++) {
    const nb = f.neighbors[e];
    if (!f.joined[e] || nb < f.index) continue;
    const pts: Point[] = [];
    for (let i = e * N; i < (e + 1) * N; i++) {
      if (f.outline[i].open < 0.5) pts.push(add(c, outlinePoint(f.outline[i])));
    }
    if (pts.length < 2) continue;
    const h = tileHash(Math.min(f.index, nb), Math.max(f.index, nb), 90);
    // Some fields just meet (crops against crops), others have a thin grass balk between them
    if (tileHash(Math.min(f.index, nb), Math.max(f.index, nb), 91) < F.balkChance) {
      const balk = mixColor(f.base, f.meadow, F.balkMeadowMix);
      p.fill(balk, F.balkAlpha, taperedStroke(pts, F.balkWidth * size));
    }
    if (h < G.wall.joinChance && e !== 0 && e !== 3) {
      const from = Math.floor(pts.length * 0.2);
      const piece = pts.slice(from, Math.max(from + 2, Math.ceil(pts.length * 0.75)));
      wallLine(p, piece, h < G.wall.joinChance * G.wall.hedgeShare, size, rng);
    }
  }
}

/** Dry-stone wall or hedge along a line of points (world px). */
function wallLine(
  p: Painter,
  pts: readonly Point[],
  hedge: boolean,
  size: number,
  rng: () => number,
): void {
  const W = G.wall;
  if (pts.length < 2) return;
  if (hedge) {
    const w = W.hedgeWidth * size;
    p.fill(
      G.shadowColor,
      G.shadowAlpha,
      taperedStroke(translate(pts, { x: w * 0.35, y: w * 0.3 }), w),
    );
    p.fill(W.hedgeColor, 1, taperedStroke(pts, w));
    p.fill(
      W.hedgeLight,
      0.9,
      taperedStroke(translate(pts, { x: -w * 0.15, y: -w * 0.2 }), w * 0.45),
    );
    return;
  }
  const r = W.stoneSize * size;
  const stones = densify(pts, W.stoneStep * size, false);
  p.fill(
    G.shadowColor,
    G.shadowAlpha,
    taperedStroke(translate(pts, { x: r * 0.4, y: r * 0.5 }), r * 1.6),
  );
  stones.forEach((q, i) => {
    dab(p, W.stoneColors[i % W.stoneColors.length], 1, q.x, q.y, r, r * 0.72, rng, 6);
  });
}

/** Is the point (relative to the tile) inside the field's yard (kept free of vines)? */
function inFieldYard(f: FieldSite, pt: Point): boolean {
  const { rx, ry } = patchRadii(f.b.type, f.size);
  const x = (pt.x - f.o.x) / (rx * 1.05);
  const y = (pt.y - f.o.y) / (ry * 1.1);
  return x * x + y * y < 1;
}

function paintVines(p: Painter, f: FieldSite): void {
  const V = G.vineyard;
  const { c, size, rng } = f;
  const step = V.vineStep * size;
  const rx = V.vineRx * size;
  const ry = V.vineRy * size;
  for (const parcel of f.parcels) {
    for (const run of vineRows(f, parcel)) {
      for (const pt of densify(run, step, false).slice(1, -1)) {
        if (inFieldYard(f, pt)) continue;
        const x = c.x + pt.x;
        const y = c.y + pt.y - ry * 0.6;
        // On hills the vines take the light of the slope they stand on
        const l = lightAt(f, pt);
        dab(p, lit(V.vineDark, l), 1, x, y, rx, ry, rng, 5);
        dab(
          p,
          lit(V.vineLight, l),
          1,
          x - rx * 0.3,
          y - ry * 0.35,
          rx * 0.6,
          ry * 0.5,
          undefined,
          4,
        );
        if (rng() < V.grapeChance) {
          dab(p, V.grapeColor, 1, x + rx * 0.35, y + ry * 0.45, rx * 0.3, ry * 0.35, undefined, 4);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Towns share one ground (docs/ART.md)
// ---------------------------------------------------------------------------------------------

/** The ground of one tile of a town area (a building tile or a street: a road tile in a town). */
interface TownGround {
  /** Tile center (world px). */
  c: Point;
  size: number;
  /** Per edge: the neighbor belongs to the same town area (the ground and a lane run on). */
  joined: boolean[];
  /** Organic outline (like a field's): reaches the shared edges, runs inside open ones. */
  outline: OutlineSample[];
  /** Worn town ground (meadow with packed earth mixed in). */
  base: number;
  index: number;
  neighbors: number[];
}

/** One building tile of a town area. */
interface TownSite extends Site, TownGround {
  /** Id of its town area (see townTiles). */
  area: number;
}

function townGround(
  map: MapState,
  h: Hex,
  size: number,
  towns: ReadonlyMap<number, number>,
): TownGround {
  const joined = townJoinMask(map, h, towns);
  const index = tileIndex(map, h);
  const meadow = theme.terrainColors[map.tiles[index]];
  return {
    c: hexToPixel(h, size),
    size,
    joined,
    outline: fieldOutline(map, h, size, joined),
    base: mixColor(meadow, G.yard.color, G.town.baseEarthMix),
    index,
    neighbors: [0, 1, 2, 3, 4, 5].map((e) => tileIndex(map, edgeNeighborHex(h, e))),
  };
}

function townSite(map: MapState, s: Site, towns: ReadonlyMap<number, number>): TownSite {
  const ground = townGround(map, s.b.hex, s.size, towns);
  return { ...s, ...ground, area: towns.get(ground.index) ?? ground.index };
}

/** A lane from a building to the point where it meets its neighbor's lane (world px). */
function laneLine(map: MapState, t: TownSite, e: number): Point[] {
  const a = add(t.c, t.o);
  const b = laneMeetPoint(map, t.b.hex, e, t.size);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  // Leaves the building toward the meeting point, crosses the edge straight (both halves join)
  const t0 = { x: b.x - a.x, y: b.y - a.y };
  const n = edgeNormal(e);
  const t1 = { x: n.x * len, y: n.y * len };
  const pts: Point[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    pts.push({
      x: h00 * a.x + h10 * t0.x + h01 * b.x + h11 * t1.x,
      y: h00 * a.y + h10 * t0.y + h01 * b.y + h11 * t1.y,
    });
  }
  return pts;
}

/**
 * One town ground over all tiles of a town area (`streets`: its road tiles): worn ground with a
 * soft rim, packed-earth lanes
 * from building to building (paved next to the city center; the road on a street tile is its
 * street), a square under every building, gardens, wells (spaced apart) and trees in some gaps,
 * low walls on some outer edges (not toward a road leading out: `roadTiles`, per tile).
 */
function paintTowns(
  p: Painter,
  g: Graphics,
  sites: readonly TownSite[],
  streets: readonly TownGround[],
  map: MapState,
  roadTiles: readonly boolean[],
): void {
  const T = G.town;
  const Y = G.yard;
  const P = G.plaza;
  const byIndex = new Map(sites.map((t) => [t.index, t]));
  const towns = new Map<number, number>();
  for (const t of sites) towns.set(t.index, t.area);
  const hubs = new Set(sites.filter((t) => t.b.type === 'cityCenter').map((t) => t.index));
  const lanes = townLanes(map, towns, hubs);
  // 1. Worn ground with a soft rim toward the land around (also under the streets: the road
  // drawn on top is the street, no lane there)
  for (const t of [...sites, ...streets]) {
    const w = T.featherWidth * t.size;
    T.featherAlpha.forEach((alpha, k) => {
      for (const q of rimBand(t, k * w, (k + 1) * w)) p.fill(t.base, alpha, q);
    });
    p.fill(
      t.base,
      T.baseAlpha,
      translate(
        t.outline.map((o) => outlinePoint(o)),
        t.c,
      ),
    );
  }
  p.flush(g);
  // 2. Lanes: soft edge, packed earth, worn light middle; next to the city center paved
  const earth: Point[][] = [];
  const paved: Point[][] = [];
  for (const t of sites) {
    for (let e = 0; e < 6; e++) {
      if (!t.joined[e] || !lanes.has(tilePairKey(t.index, t.neighbors[e]))) continue;
      const line = laneLine(map, t, e);
      const other = byIndex.get(t.neighbors[e]);
      const nearCenter = t.b.type === 'cityCenter' || other?.b.type === 'cityCenter';
      (nearCenter ? paved : earth).push(line);
    }
  }
  const w = T.laneWidth * sites[0].size;
  const edge = mixColor(Y.color, sites[0].base, 0.5);
  for (const line of [...earth, ...paved]) p.line(edge, T.laneEdgeAlpha, w * T.laneEdgeGrow, line);
  for (const line of earth) p.line(Y.color, T.laneAlpha, w, line);
  for (const line of earth) p.line(Y.lightColor, T.laneLightAlpha, w * T.laneLightShare, line);
  for (const line of paved) p.line(P.curbColor, T.paveAlpha, w * 1.15, line);
  for (const line of paved) p.line(P.stoneColor, T.paveAlpha, w, line);
  for (const line of paved) {
    // Joints across the paving
    const pts = densify(line, P.jointSpacing * sites[0].size, false);
    for (let i = 1; i < pts.length - 1; i++) {
      const d = { x: pts[i + 1].x - pts[i - 1].x, y: pts[i + 1].y - pts[i - 1].y };
      const l = Math.hypot(d.x, d.y) || 1;
      const nx = (-d.y / l) * w * 0.45;
      const ny = (d.x / l) * w * 0.45;
      p.line(P.jointColor, P.jointAlpha, P.jointWidth, [
        { x: pts[i].x - nx, y: pts[i].y - ny },
        { x: pts[i].x + nx, y: pts[i].y + ny },
      ]);
    }
  }
  p.flush(g);
  // 3. A packed-earth square under every building (not the plazas: their paving comes later)
  for (const t of sites) {
    if (t.kind === 'plaza') continue;
    const { rx, ry } = patchRadii(t.b.type, t.size);
    const shape = translate(
      organicBlob(rx * T.squareShare, ry * T.squareShare, t.rng, G.wobble),
      t.o,
    );
    softPatch(p, t.c, shape, t.limits, Y.color, G.coreAlpha, t.o);
  }
  p.flush(g);
  // 4. Gaps, the rim and walls; wells only far apart (candidates in tile order)
  const wells: Point[] = [];
  for (const t of [...sites].sort((a, b) => a.index - b.index)) {
    paintTownGaps(p, t, map, roadTiles, wells);
  }
  const size = sites[0].size;
  for (const q of spacedWells(wells, T.wellSpacing * size)) well(p, q.x, q.y, size);
  p.flush(g);
}

/**
 * Gardens and trees toward some tile corners (spots for a well go to `wells`); meadow tufts and
 * walls on the outer rim.
 */
function paintTownGaps(
  p: Painter,
  t: TownSite,
  map: MapState,
  roadTiles: readonly boolean[],
  wells: Point[],
): void {
  const T = G.town;
  const { c, size, rng } = t;
  const art = artGroundEllipse(t.b.type, size);
  for (let k = 0; k < 6; k++) {
    // Toward the corners (between the lanes); not straight behind the building
    const a = Math.PI / 6 + (Math.PI / 3) * k;
    if (k === 4) continue;
    const q = { x: Math.cos(a) * T.gapDistance * size, y: Math.sin(a) * T.gapDistance * size };
    if (!insideOutline(q, t.outline, 0.12 * size)) continue;
    const u = (q.x - t.o.x) / (art.rx * 1.05);
    const v = (q.y - t.o.y) / (art.ry * 1.2);
    if (u * u + v * v < 1) continue;
    const h = tileHash(t.b.hex.q, t.b.hex.r, 220 + k);
    const x = c.x + q.x;
    const y = c.y + q.y;
    if (h < T.gardenChance) garden(p, x, y, size, rng);
    else if (h < T.gardenChance + T.wellChance) wells.push({ x, y });
    else if (h < T.gardenChance + T.wellChance + T.treeChance) smallTree(p, x, y, size, rng);
  }
  // Meadow tufts poking into the rim
  const n = t.outline.length;
  for (let i = 0; i < n; i++) {
    if (t.outline[i].open < 0.6 || rng() >= T.tuftChance) continue;
    const q = add(c, rimPoint(t, i, rng(), -(0.02 + rng() * 0.06) * size));
    tuft(p, G.field.meadowTuftColor, q.x, q.y, size, rng);
  }
  // Now and then a low dry-stone wall on an outer land edge (not along the vertical edges)
  const N = OUTLINE_SAMPLES_PER_EDGE;
  for (let e = 0; e < 6; e++) {
    const nb = t.neighbors[e];
    // (no wall across a road leading out of town)
    if (t.joined[e] || nb < 0 || isWater(map.tiles[nb]) || roadTiles[nb] || e === 0 || e === 3) {
      continue;
    }
    if (tileHash(t.b.hex.q, t.b.hex.r, 230 + e) >= T.wallChance) continue;
    const start = e * N + 1 + Math.floor(rng() * 2);
    const pts: Point[] = [];
    for (let i = start; i <= start + N - 3; i++) {
      pts.push(add(c, outlinePoint(t.outline[i % n], 0.02 * size)));
    }
    wallLine(p, pts, false, size, rng);
  }
}

/** A small kitchen garden: a bed along the iso axes with rows of greens. */
function garden(p: Painter, x: number, y: number, size: number, rng: () => number): void {
  const T = G.town;
  const ga = T.gardenSize[0] * size;
  const gb = T.gardenSize[1] * size;
  const at = (i: number, j: number): Point => ({
    x: x + ISO_A.x * ga * i + ISO_B.x * gb * j,
    y: y + ISO_A.y * ga * i + ISO_B.y * gb * j,
  });
  p.fill(T.gardenEdge, 0.9, [at(-1.15, -1.25), at(1.15, -1.25), at(1.15, 1.25), at(-1.15, 1.25)]);
  p.fill(T.gardenSoil, 1, [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]);
  for (let j = -0.6; j <= 0.61; j += 0.6) {
    for (let i = -0.8; i <= 0.81; i += 0.2) {
      const q = at(i, j);
      const color = T.gardenGreens[Math.floor(rng() * T.gardenGreens.length)];
      dab(p, color, 1, q.x, q.y - 0.006 * size, 0.022 * size, 0.016 * size, rng, 5);
    }
  }
}

/** A well: stone ring with dark water and a little wooden frame. */
function well(p: Painter, x: number, y: number, size: number): void {
  const T = G.town;
  const rx = 0.065 * size;
  const ry = 0.04 * size;
  dab(
    p,
    G.shadowColor,
    G.shadowAlpha,
    x + rx * 0.5,
    y + ry * 0.6,
    rx * 1.3,
    ry * 1.1,
    undefined,
    10,
  );
  dab(p, T.wellShade, 1, x, y + ry * 0.35, rx, ry, undefined, 12);
  dab(p, T.wellStone, 1, x, y, rx, ry, undefined, 12);
  dab(p, T.wellWater, 1, x, y - ry * 0.1, rx * 0.62, ry * 0.55, undefined, 10);
  const top = y - 0.11 * size;
  p.line(T.wellWood, 1, 0.9, [
    { x: x - rx * 0.8, y: y - ry * 0.2 },
    { x: x - rx * 0.8, y: top },
  ]);
  p.line(T.wellWood, 1, 0.9, [
    { x: x + rx * 0.8, y: y - ry * 0.2 },
    { x: x + rx * 0.8, y: top },
  ]);
  p.line(T.wellWood, 1, 1.1, [
    { x: x - rx, y: top },
    { x: x + rx, y: top },
  ]);
}

/** A small tree standing in a gap. */
function smallTree(p: Painter, x: number, y: number, size: number, rng: () => number): void {
  const T = G.town;
  const r = (0.075 + rng() * 0.02) * size;
  dab(p, G.shadowColor, G.shadowAlpha, x + r * 0.6, y + r * 0.15, r * 1.2, r * 0.45, undefined, 10);
  p.line(T.treeTrunk, 1, 1.3, [
    { x, y },
    { x, y: y - r * 0.9 },
  ]);
  dab(p, T.treeDark, 1, x, y - r * 1.35, r, r * 0.85, rng, 9);
  dab(p, T.treeLight, 1, x - r * 0.3, y - r * 1.6, r * 0.55, r * 0.45, rng, 8);
}

/** Paints the ground of `shown` into `g` (cleared first); `towns`: see townTiles. */
export function paintGround(
  g: Graphics,
  state: GameState,
  shown: readonly Building[],
  size: number,
  towns: ReadonlyMap<number, number> = townTiles(state.map, shown, state.roads, state.territory),
): void {
  g.clear();
  const map = state.map;
  const p = createPainter();
  const fields = fieldTiles(map, shown);
  const sites: Site[] = shown.map((b) => {
    const kind = groundKindOf(b.type);
    const t = map.tiles[tileIndex(map, b.hex)];
    const sloped = t === 'hills' || t === 'mountains' ? t : null;
    return {
      b,
      kind,
      c: hexToPixel(b.hex, size),
      size,
      limits: edgeLimits(map, b.hex, size, G.edgeMargin * size, G.shoreMargin * size),
      rng: tileRng(b.hex.q, b.hex.r, 140),
      o: patchCenter(b.type, size),
      slope: isFieldKind(kind) ? null : sloped,
      sloped,
      fp: footprintOf(b.type, size),
    };
  });
  // Neighboring buildings of one owner share one town ground (fields next to it fade into it)
  const fieldSites = sites
    .filter((s) => isFieldKind(s.kind))
    .map((s) => fieldSite(map, s, fields, towns));
  const inTown = (s: Site): boolean => towns.has(tileIndex(map, s.b.hex));
  const townSites = sites.filter(inTown).map((s) => townSite(map, s, towns));
  const built = new Set(sites.map((s) => tileIndex(map, s.b.hex)));
  const streets = [...towns.keys()]
    .filter((i) => !built.has(i))
    .map((i) => townGround(map, hexAtIndex(map, i), size, towns));

  // 1. Fields painted into the land: soft rim and ground, parcels, faint rows, the ragged rim
  for (const f of fieldSites) paintFieldBase(p, f);
  p.flush(g);
  for (const f of fieldSites)
    for (const parcel of f.parcels) {
      p.fill(parcel.color, f.hill ? G.field.hillParcelAlpha : 1, translate(parcel.poly, f.c));
    }
  p.flush(g);
  // On hills the mounds roll on under the field, in its own colors
  for (const f of fieldSites) paintFieldRelief(g, p, f);
  p.flush(g);
  for (const f of fieldSites) paintFieldRows(p, f);
  p.flush(g);
  for (const f of fieldSites) paintFieldRim(p, f, map);
  p.flush(g);
  if (townSites.length > 0) paintTowns(p, g, townSites, streets, map, state.roads);

  // 2. Patches under the buildings
  for (const s of sites) {
    const { rx, ry } = patchRadii(s.b.type, size);
    switch (s.kind) {
      case 'plaza':
        if (inTown(s)) {
          // Inside a town: no apron; the city center's paving reaches further out
          const k = s.b.type === 'cityCenter' ? G.town.paveGrow : 1;
          paintPlaza(p, s, rx * k, ry * k, false);
        } else paintPlaza(p, s, rx, ry);
        break;
      case 'clearing':
        paintClearing(p, s, rx, ry);
        break;
      case 'quarry':
        paintQuarry(p, s, rx, ry);
        break;
      case 'mine':
        paintMine(p, s, rx, ry);
        break;
      case 'fishery':
        paintFishery(p, s, rx, ry, jettyEdge(map, s.b.hex));
        break;
      default:
        // Plain yards and the small yard in the middle of a field (a town tile has none)
        if (!inTown(s)) paintYard(p, s, rx, ry, YARD_LITTER[s.b.type]);
    }
  }
  p.flush(g);

  // 3. Vines standing in their rows (the olive trees of a grove are part of the drawn art)
  for (const f of fieldSites) if (f.kind === 'vineyard') paintVines(p, f);
  p.flush(g);
}

export function createGroundLayer(size: number): GroundLayer {
  const layer = new Graphics();
  let revealAll = false;
  let key: string | null = null;
  return {
    layer,
    update(state, viewer) {
      const shown = buildingsShownTo(state, viewer, revealAll);
      const towns = townTiles(state.map, shown, state.roads, state.territory);
      const next = groundKey(state.map, shown, towns, state.roads);
      if (next === key) return false;
      key = next;
      paintGround(layer, state, shown, size, towns);
      return true;
    },
    setRevealAll(value) {
      revealAll = value;
    },
  };
}
