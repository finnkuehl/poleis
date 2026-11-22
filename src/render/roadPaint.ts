// The look of the roads (docs/ART.md "Roads"), as vertex arrays per road mesh (pure, no PixiJS):
// which strips and patches every piece of road gets, their rows across the road and their colors.
// roadLayer.ts turns the arrays into one PixiJS mesh per texture (a handful of draw calls for the
// whole network). Drawing order (bottom to top):
// 1. 'shoulders' gravel texture, planar: the darker compacted earth beside every track, fading
//                into the grass, and the earth apron under the paving;
// 2. 'banks'     on hills: the banks of the cut through the slope, lit or shaded by the sun;
// 3. 'surface'   gravel texture, planar: every track surface and worn crossing, so junctions merge
//                into one surface (and cover the banks of the other curves of a junction);
// 4. 'ruts'      relief strip along the gravel tracks: wheel ruts and pushed-up edges;
// 5. 'paving'    stone slabs and curbs along the paved roads;
// 6. 'pavingRelief'  raised curbs and sunken joints;
// 7. 'squares'   small paved squares where paved roads meet or end.
// The relief strips are drawn twice, once as they are (lit from one side of the road) and once
// mirrored, weighted by the road's direction to the sun, so their light always comes from the
// upper left of the screen (roadMesh.ts `sunWeight`).
import type { Point } from '../core/hex';
import type { RoadTracks, TrackCrossing, TrackPiece } from './geometry';
import {
  emptyMesh,
  normalOf,
  pushDisc,
  pushStrip,
  sunWeight,
  type MeshData,
  type Rgba,
  type StripLine,
} from './roadMesh';
import { theme } from './theme';

const R = theme.road;
const G = R.gravel;
const P = R.paving;
const B = R.banks;

export const ROAD_MESHES = [
  'shoulders',
  'banks',
  'surface',
  'ruts',
  'paving',
  'pavingRelief',
  'squares',
] as const;
export type RoadMeshId = (typeof ROAD_MESHES)[number];

/** Optional ghost look (path preview): colors mixed toward `tint`, every alpha scaled. */
export interface Ghost {
  tint: number;
  mix: number;
  alpha: number;
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number): number => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function lineOf(t: TrackPiece): StripLine {
  return { points: t.points, dirs: t.dirs, halfWidths: t.widths.map((w) => w / 2), along: t.along };
}

/** Light direction, normalized. */
function light(): Point {
  const l = Math.hypot(R.light.x, R.light.y) || 1;
  return { x: R.light.x / l, y: R.light.y / l };
}

/**
 * Grid axes of the paved squares' flagstones: their rows run along the iso axes like the
 * plaza's joints (2:1), so a square looks like a piece of the plaza.
 */
function isoAxes(): [Point, Point] {
  const a = { x: 2 / Math.sqrt(5), y: 1 / Math.sqrt(5) };
  const b = { x: 2 / Math.sqrt(5), y: -1 / Math.sqrt(5) };
  // Texture coordinates = inverse of [a b] applied to the world point
  const det = a.x * b.y - b.x * a.y;
  return [
    { x: b.y / det, y: -b.x / det },
    { x: -a.y / det, y: a.x / det },
  ];
}

/** A slightly irregular outline for a worn spot (deterministic per crossing). */
function wobbleOf(c: TrackCrossing, amount: number): (k: number) => number {
  const seed = Math.round(c.center.x * 7.3 + c.center.y * 3.1);
  return (k) => 1 + amount * Math.sin(k * 1.9 + seed) * Math.cos(k * 0.7 + seed * 0.3);
}

/** Surface opacity of a crossing (a dead end's spot is only a soft trace). */
function crossingAlpha(c: TrackCrossing): number {
  return c.kind === 'deadEnd' && c.style === 'dirt' ? 0.55 : 1;
}

/**
 * Vertex arrays of all road meshes for `tracks` (world px, hex size `size`). With `ghost`, only
 * the gravel look (shoulders, surface, ruts) in the ghost colors: the path preview.
 */
export function roadMeshData(
  tracks: RoadTracks,
  size: number,
  ghost?: Ghost,
): Record<RoadMeshId, MeshData> {
  const out: Record<RoadMeshId, MeshData> = {
    shoulders: emptyMesh(),
    banks: emptyMesh(),
    surface: emptyMesh(),
    ruts: emptyMesh(),
    paving: emptyMesh(),
    pavingRelief: emptyMesh(),
    squares: emptyMesh(),
  };
  const sun = light();
  const look = (color: number, alpha: number): Rgba =>
    ghost
      ? { color: mixColor(color, ghost.tint, ghost.mix), alpha: alpha * ghost.alpha }
      : { color, alpha };
  const gravelUv = { kind: 'planar', scale: R.gravelTile * size } as const;
  const { pieces, crossings } = tracks;
  const dirt = pieces.filter((t) => t.style === 'dirt');
  const paved = ghost ? [] : pieces.filter((t) => t.style === 'paved');

  // 1. Shoulders (and the apron under the paving)
  // Opaque from one side's `shoulderMid` to the other's (under the track too), soft beyond
  const shoulderRows = [-G.shoulder, -G.shoulderMid, G.shoulderMid, G.shoulder];
  for (const t of pieces) {
    if (ghost && t.style !== 'dirt') continue;
    const isPaved = t.style === 'paved';
    const tint = isPaved ? P.apronTint : G.shoulderTint;
    const a0 = isPaved ? P.apronAlpha : G.shoulderAlpha;
    const m = t.points.length - 1;
    pushStrip(out.shoulders, lineOf(t), shoulderRows, null, gravelUv, (i, r) => {
      // No apron on the plaza itself: it fades out toward the plaza's paving
      const k = t.kind === 'plaza' ? 1 - smooth(0, 0.85, i / m) : t.fade[i];
      return look(tint, (r === 0 || r === 3 ? 0 : a0) * k);
    });
  }
  for (const c of crossings) {
    if (ghost && c.style !== 'dirt') continue;
    const isPaved = c.style === 'paved';
    const tint = isPaved ? P.apronTint : G.shoulderTint;
    const a0 = (isPaved ? P.apronAlpha : G.shoulderAlpha) * crossingAlpha(c);
    if (isPaved) {
      // A narrow earth apron around the paved square, the same hexagon
      pushDisc(
        out.shoulders,
        c.center,
        [0, c.r * 1.12, c.r * 1.32],
        6,
        gravelUv,
        (ring) => look(tint, ring === 2 ? 0 : a0),
        undefined,
        -Math.PI / 6,
      );
      continue;
    }
    // Around a worn spot: the shoulder as wide as beside the tracks
    const hw = R.width * size * 0.5;
    pushDisc(
      out.shoulders,
      c.center,
      [0, c.r + (G.shoulderMid - G.edge) * hw, c.r + (G.shoulder - G.edge) * hw],
      16,
      gravelUv,
      (ring) => look(tint, ring === 2 ? 0 : a0),
      wobbleOf(c, 0.08),
    );
  }
  // 2. Banks of the cut through a hill: a dark crease at their foot, the face lit or shaded by
  // how much it faces the sun, and the shaded bank's shadow on the road
  if (!ghost) {
    for (const t of pieces) {
      if (!t.banks.some((b) => b > 0)) continue;
      const line = lineOf(t);
      for (const side of [-1, 1]) {
        const rows = [B.shadowFrom, B.foot, B.face, B.rim, B.top].map((o) => o * side);
        pushStrip(
          out.banks,
          line,
          rows,
          [0, 0.04, 0.2, 0.85, 1],
          { kind: 'strip', period: R.bankPeriod * size },
          (i, r) => {
            const n = normalOf(t.dirs[i]);
            // The bank on this side faces the road (-side x normal): how much it faces the sun
            const q = -side * (n.x * sun.x + n.y * sun.y);
            const b = t.banks[i];
            if (r === 0) return { color: B.footColor, alpha: 0 };
            if (r === 1) {
              return {
                color: B.footColor,
                alpha: b * (B.footAlpha + B.castAlpha * Math.max(0, -q)),
              };
            }
            if (r === 4) return { color: B.rimColor, alpha: 0 };
            if (r === 3) {
              // The top edge: still the face's light or shade, and a thin sunlit lip
              const face = q >= 0 ? q * B.litAlpha : -q * B.shadeAlpha;
              return {
                color: q >= 0 ? B.litColor : B.rimColor,
                alpha: b * Math.max(face, B.rimAlpha),
              };
            }
            return q >= 0
              ? { color: B.litColor, alpha: b * q * B.litAlpha }
              : { color: B.shadeColor, alpha: b * -q * B.shadeAlpha };
          },
          0.7,
        );
      }
    }
  }

  // 3. Track surfaces and worn crossings
  const surfaceRows = [-G.edge, -G.inner, G.inner, G.edge];
  for (const t of dirt) {
    pushStrip(out.surface, lineOf(t), surfaceRows, null, gravelUv, (i, r) =>
      look(G.surfaceTint, (r === 0 || r === 3 ? 0 : 1) * t.fade[i]),
    );
  }
  for (const c of crossings) {
    if (c.style !== 'dirt') continue;
    const a = crossingAlpha(c);
    pushDisc(
      out.surface,
      c.center,
      c.kind === 'deadEnd' ? [0, c.r] : [0, c.r * 0.78, c.r],
      20,
      gravelUv,
      (ring) => look(G.surfaceTint, (c.kind === 'deadEnd' ? ring === 0 : ring < 2) ? a : 0),
      wobbleOf(c, 0.1),
    );
  }

  // 4. Wheel ruts and the edges of the gravel tracks (relief, two weighted passes)
  for (const flipV of [false, true]) {
    for (const t of dirt) {
      if (!t.ruts.some((v) => v > 0)) continue;
      pushStrip(
        out.ruts,
        lineOf(t),
        [-G.reliefReach, G.reliefReach],
        [0, 1],
        { kind: 'strip', period: R.rutPeriod * size, flipV },
        (i) => {
          const w = sunWeight(t.dirs[i], sun);
          return look(0xffffff, (flipV ? 1 - w : w) * t.ruts[i] * t.fade[i] * G.reliefAlpha);
        },
      );
    }
  }

  // 5. / 6. Paving with its curbs, and their relief
  for (const t of paved) {
    pushStrip(
      out.paving,
      lineOf(t),
      [-1, 1],
      [0, 1],
      { kind: 'strip', period: R.pavingPeriod * size },
      (i) => look(0xffffff, t.fade[i]),
    );
  }
  for (const flipV of [false, true]) {
    for (const t of paved) {
      pushStrip(
        out.pavingRelief,
        lineOf(t),
        [-P.reliefReach, P.reliefReach],
        [0, 1],
        { kind: 'strip', period: R.pavingPeriod * size, flipV },
        (i) => {
          const w = sunWeight(t.dirs[i], sun);
          return look(0xffffff, (flipV ? 1 - w : w) * t.fade[i]);
        },
      );
    }
  }

  // 7. A row of edge stones across a paved road where a gravel track goes on (a built end) ...
  const axes = isoAxes();
  const flagUv = { kind: 'planar', scale: R.flagstoneTile * size, axes } as const;
  for (const t of paved) {
    t.curbs.forEach((curb, end) => {
      if (!curb) return;
      const i = end === 0 ? 0 : t.points.length - 1;
      const p = t.points[i];
      const d = t.dirs[i];
      const hw = t.widths[i] / 2;
      // From the end back into the paving
      const k = (end === 0 ? 1 : -1) * P.endCurb * hw;
      const q = { x: p.x + d.x * k, y: p.y + d.y * k };
      pushStrip(
        out.squares,
        { points: end === 0 ? [p, q] : [q, p], dirs: [d, d], halfWidths: [hw, hw], along: [0, 0] },
        [-1, 1],
        null,
        flagUv,
        () => ({ color: P.squareCurbTint, alpha: 1 }),
      );
    });
  }
  // ... and small paved squares: hexagons like the tile, so the paved roads enter them at right angles
  // (flagstones along the iso axes like the plaza, a band of edge stones)
  for (const c of crossings) {
    if (ghost || c.style !== 'paved') continue;
    const inner = c.r * (1 - P.squareCurb);
    pushDisc(
      out.squares,
      c.center,
      [0, inner - 0.3, inner, c.r - 0.45, c.r],
      6,
      flagUv,
      (ring) =>
        ring < 2
          ? { color: 0xffffff, alpha: 1 }
          : { color: P.squareCurbTint, alpha: ring === 4 ? 0 : 1 },
      undefined,
      -Math.PI / 6,
    );
  }
  return out;
}
