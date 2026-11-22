import { describe, expect, it } from 'vitest';
import type { Point } from '../core/hex';
import { addCity, addRoad, at, makeTestState } from '../core/testing';
import { hexSize } from './config';
import { edgeNeighborHex, roadTracks } from './geometry';
import {
  curvatures,
  emptyMesh,
  pushDisc,
  pushStrip,
  sunWeight,
  vertexCount,
  type StripLine,
} from './roadMesh';
import { roadTrackParams } from './roadLayer';
import { ROAD_MESHES, roadMeshData } from './roadPaint';

const white = { color: 0xffffff, alpha: 1 };

/** A straight line along +x, 3 points, 10 px apart, half width 2. */
function straight(): StripLine {
  return {
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ],
    dirs: [
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
    ],
    halfWidths: [2, 2, 2],
    along: [5, 15, 25],
  };
}

function pos(mesh: ReturnType<typeof emptyMesh>, i: number): Point {
  return { x: mesh.positions[2 * i], y: mesh.positions[2 * i + 1] };
}

describe('pushStrip', () => {
  it('makes a row of vertices per offset at every point, joined into triangles', () => {
    const mesh = emptyMesh();
    pushStrip(mesh, straight(), [-1, 0, 1], null, { kind: 'planar', scale: 10 }, () => white);
    expect(vertexCount(mesh)).toBe(9);
    // (points - 1) x (rows - 1) quads, two triangles each
    expect(mesh.indices.length).toBe(2 * 2 * 2 * 3);
    expect(Math.max(...mesh.indices)).toBe(8);
    expect(mesh.colors.length).toBe(9 * 4);
    // Offsets along the left normal (+y for a line along +x), scaled by the half width
    expect(pos(mesh, 0)).toEqual({ x: 0, y: -2 });
    expect(pos(mesh, 2)).toEqual({ x: 0, y: 2 });
    // Planar texture coordinates: world position / scale
    expect(mesh.uvs.slice(4, 6)).toEqual([0, 0.2]);
  });

  it('lays a strip texture along the road: u from the distance, v per row, mirrored with flipV', () => {
    const mesh = emptyMesh();
    pushStrip(mesh, straight(), [-1, 1], [0, 1], { kind: 'strip', period: 10 }, () => white);
    expect(mesh.uvs.slice(0, 4)).toEqual([0.5, 0, 0.5, 1]);
    expect(mesh.uvs.slice(8, 12)).toEqual([2.5, 0, 2.5, 1]);
    const mirrored = emptyMesh();
    pushStrip(
      mirrored,
      straight(),
      [-1, 1],
      [0, 1],
      { kind: 'strip', period: 10, flipV: true },
      () => white,
    );
    expect(mirrored.uvs.slice(0, 4)).toEqual([0.5, 1, 0.5, 0]);
  });

  it('keeps the inner rows of a tight bend from folding over the bend center', () => {
    // A quarter circle of radius 5 around (0, 5), turning toward its left
    const n = 9;
    const points: Point[] = [];
    const dirs: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1)) * (Math.PI / 2);
      points.push({ x: 5 * Math.cos(a), y: 5 + 5 * Math.sin(a) });
      dirs.push({ x: -Math.sin(a), y: Math.cos(a) });
    }
    const k = curvatures(points, dirs);
    expect(k[4]).toBeCloseTo(1 / 5, 1);
    const mesh = emptyMesh();
    const line = { points, dirs, halfWidths: points.map(() => 4), along: points.map((_, i) => i) };
    pushStrip(mesh, line, [-2, 2], null, { kind: 'planar', scale: 10 }, () => white, 0.85);
    // The inner row (+2 x 4 = 8 px toward the center) stops at 0.85 x the radius
    for (let i = 1; i < n - 1; i++) {
      const p = pos(mesh, i * 2 + 1);
      expect(Math.hypot(p.x, p.y - 5)).toBeGreaterThan(5 * 0.14);
    }
  });

  it('colors every vertex by point and row', () => {
    const mesh = emptyMesh();
    pushStrip(mesh, straight(), [-1, 1], null, { kind: 'planar', scale: 10 }, (i, r) => ({
      color: 0xff0000,
      alpha: i * 0.25 + r * 0.5,
    }));
    expect(mesh.colors.slice(0, 4)).toEqual([1, 0, 0, 0]);
    expect(mesh.colors.slice(4 * 5, 4 * 6)).toEqual([1, 0, 0, 1]);
  });
});

describe('pushDisc', () => {
  it('makes rings of vertices around the center, joined into triangles', () => {
    const mesh = emptyMesh();
    pushDisc(mesh, { x: 10, y: 20 }, [0, 3, 5], 8, { scale: 10 }, (ring) => ({
      color: 0,
      alpha: 1 - ring / 2,
    }));
    expect(vertexCount(mesh)).toBe(24);
    expect(mesh.indices.length).toBe(2 * 8 * 2 * 3);
    expect(pos(mesh, 0)).toEqual({ x: 10, y: 20 });
    expect(pos(mesh, 16).x).toBeCloseTo(15);
    expect(mesh.colors[16 * 4 + 3]).toBe(0);
  });

  it('turns its first vertex to angle0 (a hexagon like the tiles)', () => {
    const mesh = emptyMesh();
    pushDisc(mesh, { x: 0, y: 0 }, [0, 10], 6, { scale: 10 }, () => white, undefined, -Math.PI / 6);
    const p = pos(mesh, 6);
    expect(p.x).toBeCloseTo(10 * Math.cos(-Math.PI / 6));
    expect(p.y).toBeCloseTo(-5);
  });
});

describe('sunWeight', () => {
  it('is 1/2 along the light, more when the +offset side faces the sun', () => {
    const light = { x: -1, y: -1 };
    const r = Math.SQRT1_2;
    // Heading south-west, the +offset side (its normal) faces north-west: the sun
    expect(sunWeight({ x: -r, y: r }, light)).toBeCloseTo(1);
    expect(sunWeight({ x: r, y: -r }, light)).toBeCloseTo(0);
    expect(sunWeight({ x: -r, y: -r }, light)).toBeCloseTo(0.5);
  });
});

describe('roadMeshData', () => {
  function network() {
    const s = makeTestState([
      'ppppppppp',
      'ppphhhppp',
      'ppphhhppp',
      'ppphhhppp',
      'ppppppppp',
      'ppppppppp',
      'ppppppppp',
    ]);
    addCity(s, at(1, 4), { radius: 3 });
    let h = edgeNeighborHex(at(1, 4), 0);
    addRoad(s, h);
    for (const e of [0, 5, 5, 0, 1]) {
      h = edgeNeighborHex(h, e);
      addRoad(s, h);
    }
    return s;
  }

  it('builds every mesh with valid triangles; banks only where the road crosses hills', () => {
    const s = network();
    const data = roadMeshData(roadTracks(s, hexSize, roadTrackParams()), hexSize);
    for (const id of ROAD_MESHES) {
      const m = data[id];
      const count = vertexCount(m);
      expect(m.uvs.length).toBe(2 * count);
      expect(m.colors.length).toBe(4 * count);
      expect(m.indices.length % 3).toBe(0);
      for (const i of m.indices) expect(i).toBeLessThan(count);
      for (const v of [...m.positions, ...m.uvs, ...m.colors])
        expect(Number.isFinite(v)).toBe(true);
    }
    expect(data.surface.indices.length).toBeGreaterThan(0);
    expect(data.paving.indices.length).toBeGreaterThan(0);
    expect(data.banks.indices.length).toBeGreaterThan(0);
  });

  it('a network on the plains has no banks; without a city no paving', () => {
    const s = makeTestState(Array(7).fill('ppppppp'));
    addRoad(s, at(2, 3));
    addRoad(s, at(3, 3));
    addRoad(s, at(4, 3));
    const data = roadMeshData(roadTracks(s, hexSize, roadTrackParams()), hexSize);
    expect(data.banks.indices.length).toBe(0);
    expect(data.paving.indices.length).toBe(0);
    expect(data.squares.indices.length).toBe(0);
    expect(data.ruts.indices.length).toBeGreaterThan(0);
  });

  it('the ghost (path preview) is only the gravel look, lighter and translucent', () => {
    const s = network();
    const tracks = roadTracks(s, hexSize, roadTrackParams());
    const ghost = roadMeshData(tracks, hexSize, { tint: 0xffffff, mix: 1, alpha: 0.5 });
    expect(ghost.paving.indices.length).toBe(0);
    expect(ghost.banks.indices.length).toBe(0);
    expect(ghost.squares.indices.length).toBe(0);
    for (let i = 0; i < ghost.surface.colors.length; i += 4) {
      expect(ghost.surface.colors.slice(i, i + 3)).toEqual([1, 1, 1]);
      expect(ghost.surface.colors[i + 3]).toBeLessThanOrEqual(0.5);
    }
  });
});
