// Vertex arrays of the road meshes (pure, no PixiJS, easy to test): strips along a road's
// center line with rows of vertices across it, and round patches. Every vertex has a position,
// texture coordinates and an RGBA color (straight alpha); roadLayer.ts turns the arrays into
// PixiJS meshes. The rows across a strip give its profile (soft edges, a darker shoulder), the
// colors fade it out at its ends and shade it by its direction to the sun.
import type { Point } from '../core/hex';

/** Growing vertex arrays of one mesh. */
export interface MeshData {
  /** x, y per vertex (world px) */
  positions: number[];
  /** u, v per vertex (texture coordinates; > 1 repeats) */
  uvs: number[];
  /** r, g, b, a per vertex (0..1, straight alpha) */
  colors: number[];
  /** Three vertex indices per triangle */
  indices: number[];
}

export function emptyMesh(): MeshData {
  return { positions: [], uvs: [], colors: [], indices: [] };
}

export function vertexCount(mesh: MeshData): number {
  return mesh.positions.length / 2;
}

/** A vertex color: 0xrrggbb and alpha. */
export interface Rgba {
  color: number;
  alpha: number;
}

/** How a mesh's texture lies on the map. */
export type UvMode =
  /**
   * Planar: the texture repeats over the map like a floor (world px / `scale`); `axes` turn its
   * grid (default: the texture's x along the screen's x).
   */
  | { kind: 'planar'; scale: number; axes?: readonly [Point, Point] }
  /**
   * Along the road: u = distance along the road / `period`, v = the row's v (or 1 - v with
   * `flipV`: the mirror image across the road).
   */
  | { kind: 'strip'; period: number; flipV?: boolean };

/** A road center line with everything the strips need at every point. */
export interface StripLine {
  points: readonly Point[];
  /** Unit direction at every point */
  dirs: readonly Point[];
  /** Half width at every point (world px): the row offsets are shares of it */
  halfWidths: readonly number[];
  /** Distance along the road at every point (world px), for 'strip' textures */
  along: readonly number[];
}

/** Normal of a direction, the +offset side of a strip: on the screen (y down) its right. */
export function normalOf(d: Point): Point {
  return { x: -d.y, y: d.x };
}

function pushVertex(mesh: MeshData, p: Point, u: number, v: number, c: Rgba): void {
  mesh.positions.push(p.x, p.y);
  mesh.uvs.push(u, v);
  mesh.colors.push(
    ((c.color >> 16) & 255) / 255,
    ((c.color >> 8) & 255) / 255,
    (c.color & 255) / 255,
    c.alpha,
  );
}

function planarUv(
  p: Point,
  mode: { scale: number; axes?: readonly [Point, Point] },
): [number, number] {
  if (!mode.axes) return [p.x / mode.scale, p.y / mode.scale];
  const [a, b] = mode.axes;
  return [(p.x * a.x + p.y * a.y) / mode.scale, (p.x * b.x + p.y * b.y) / mode.scale];
}

/**
 * Signed curvature at every point of a line (1 / px; > 0 = turning toward its normal), from
 * the change of direction between the neighboring points.
 */
export function curvatures(points: readonly Point[], dirs: readonly Point[]): number[] {
  const n = points.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    if (a === b) {
      out.push(0);
      continue;
    }
    const da = dirs[a];
    const db = dirs[b];
    const turn = Math.atan2(da.x * db.y - da.y * db.x, da.x * db.x + da.y * db.y);
    let len = 0;
    for (let k = a; k < b; k++) {
      len += Math.hypot(points[k + 1].x - points[k].x, points[k + 1].y - points[k].y);
    }
    out.push(len > 0 ? turn / len : 0);
  }
  return out;
}

/**
 * Adds a strip along `line`: one row of vertices per entry of `offsets` (shares of the half width,
 * + = toward `normalOf` the direction), joined into triangles between neighboring points and rows.
 * `vs[r]` is the texture v of row r ('strip' textures). `shade(i, r)` gives the color of the
 * vertex of point i in row r. On the inner side of a bend the rows keep within `bendLimit` x the
 * bend's radius, so wide strips do not fold over themselves.
 */
export function pushStrip(
  mesh: MeshData,
  line: StripLine,
  offsets: readonly number[],
  vs: readonly number[] | null,
  uv: UvMode,
  shade: (i: number, row: number) => Rgba,
  bendLimit = 0.85,
): void {
  const n = line.points.length;
  if (n < 2 || offsets.length < 2) return;
  const base = vertexCount(mesh);
  const bends = curvatures(line.points, line.dirs);
  const rows = offsets.length;
  for (let i = 0; i < n; i++) {
    const p = line.points[i];
    const nrm = normalOf(line.dirs[i]);
    const k = bends[i];
    for (let r = 0; r < rows; r++) {
      let o = offsets[r] * line.halfWidths[i];
      // Inner side of a bend: never past the bend's center
      if (k !== 0 && o * k > 0) {
        const limit = bendLimit / Math.abs(k);
        if (Math.abs(o) > limit) o = Math.sign(o) * limit;
      }
      const q = { x: p.x + nrm.x * o, y: p.y + nrm.y * o };
      let u: number;
      let v: number;
      if (uv.kind === 'planar') {
        [u, v] = planarUv(q, uv);
      } else {
        u = line.along[i] / uv.period;
        const rowV = vs ? vs[r] : r / (rows - 1);
        v = uv.flipV ? 1 - rowV : rowV;
      }
      pushVertex(mesh, q, u, v, shade(i, r));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = base + i * rows + r;
      const b = a + 1;
      const c = a + rows;
      const d = c + 1;
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

/**
 * Adds a round patch around `center`: rings of vertices at `radii` (px; a radius of 0 is the
 * middle point), `segments` vertices per ring, joined into triangles. `wobble(k)` (optional) scales
 * the radius at segment k (an irregular outline); `shade(ring)` gives the color of a ring; the
 * first vertex of every ring lies at angle `angle0` (6 segments and -30 degrees: a hexagon like
 * the tiles). Only planar textures.
 */
export function pushDisc(
  mesh: MeshData,
  center: Point,
  radii: readonly number[],
  segments: number,
  uv: { scale: number; axes?: readonly [Point, Point] },
  shade: (ring: number) => Rgba,
  wobble?: (k: number) => number,
  angle0 = 0,
): void {
  const base = vertexCount(mesh);
  const rings = radii.length;
  for (let r = 0; r < rings; r++) {
    const c = shade(r);
    for (let k = 0; k < segments; k++) {
      const a = angle0 + (2 * Math.PI * k) / segments;
      const rad = radii[r] * (wobble ? wobble(k) : 1);
      const p = { x: center.x + Math.cos(a) * rad, y: center.y + Math.sin(a) * rad };
      const [u, v] = planarUv(p, uv);
      pushVertex(mesh, p, u, v, c);
    }
  }
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const k2 = (k + 1) % segments;
      const a = base + r * segments + k;
      const b = base + r * segments + k2;
      const c = base + (r + 1) * segments + k;
      const d = base + (r + 1) * segments + k2;
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

/**
 * How much of a relief strip's own shading (lit from its +offset side) a vertex gets, 0..1: 1 when
 * that side faces the sun, 1/2 when the road runs toward the sun, 0 when it faces away.
 */
export function sunWeight(dir: Point, light: Point): number {
  const nrm = normalOf(dir);
  const l = Math.hypot(light.x, light.y) || 1;
  return 0.5 + (0.5 * (nrm.x * light.x + nrm.y * light.y)) / l;
}
