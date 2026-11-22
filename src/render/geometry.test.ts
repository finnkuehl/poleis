import { describe, expect, it } from 'vitest';
import { HEX_DIRECTIONS, hexAdd, hexCorners, hexToPixel, type Point } from '../core/hex';
import { tileIndex } from '../core/map';
import type { GameState } from '../core/state';
import { at, makeTestState } from '../core/testing';
import {
  EDGE_DIRECTION,
  cityEdges,
  edgeMaskOf,
  edgeMidpoint,
  edgeNeighborHex,
  insetBands,
  insetEdge,
  insetRuns,
  insetStrips,
  sharedEdgeMidpoint,
  roadGeometry,
  subPolyline,
  territoryEdges,
  wavyInsetLine,
  wavyTileOutline,
} from './geometry';
import { edgeWave, WAVE_SEGMENTS } from './terrain';

describe('EDGE_DIRECTION', () => {
  it('each edge faces the neighbor it is mapped to', () => {
    const size = 32;
    const c = hexToPixel({ q: 0, r: 0 }, size);
    for (let e = 0; e < 6; e++) {
      const nb = hexToPixel(HEX_DIRECTIONS[EDGE_DIRECTION[e]], size);
      const mid = edgeMidpoint(c, size, e);
      // Edge midpoint lies exactly halfway to the neighbor center
      expect(mid.x).toBeCloseTo(nb.x / 2);
      expect(mid.y).toBeCloseTo(nb.y / 2);
    }
  });
});

function emptyState(): GameState {
  const s = makeTestState(Array(12).fill('pppppppppppp'));
  s.roads = s.roads.map(() => false);
  s.territory = s.territory.map(() => -1);
  s.buildings = [];
  return s;
}

describe('cityEdges', () => {
  /** Two tiles side by side (b east of a), both of player 0, cities `ca` and `cb`. */
  function pair(ca: number, cb: number, ownerB = 0): { s: GameState; a: number; b: number } {
    const s = emptyState();
    s.tileCity = s.tileCity.map(() => -1);
    const ha = at(4, 3);
    const a = tileIndex(s.map, ha);
    const b = tileIndex(s.map, hexAdd(ha, HEX_DIRECTIONS[0]));
    s.territory[a] = 0;
    s.territory[b] = ownerB;
    s.tileCity[a] = ca;
    s.tileCity[b] = cb;
    return { s, a, b };
  }

  it('draws no edge inside one city', () => {
    const { s } = pair(7, 7);
    expect(cityEdges(s, 0)).toEqual([]);
  });

  it('draws the edge between two cities of one owner once', () => {
    const { s, a, b } = pair(7, 9);
    const edges = cityEdges(s, 0);
    expect(edges).toEqual([{ tile: Math.min(a, b), edges: [a < b ? 0 : 3] }]);
  });

  it('draws none across different owners or toward land of no city', () => {
    expect(cityEdges(pair(7, 9, 1).s, 0)).toEqual([]);
    expect(cityEdges(pair(7, -1).s, 0)).toEqual([]);
  });
});

describe('territoryEdges', () => {
  it('a single tile has all 6 edges', () => {
    const s = emptyState();
    const h = at(4, 3);
    s.territory[tileIndex(s.map, h)] = 0;
    const edges = territoryEdges(s, 0);
    expect(edges).toHaveLength(1);
    expect(edges[0].edges).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('shared edges between two tiles of the same owner are skipped', () => {
    const s = emptyState();
    const a = at(4, 3);
    const b = hexAdd(a, HEX_DIRECTIONS[0]); // east of a
    s.territory[tileIndex(s.map, a)] = 0;
    s.territory[tileIndex(s.map, b)] = 0;
    const edges = territoryEdges(s, 0);
    const ea = edges.find((t) => t.tile === tileIndex(s.map, a));
    const eb = edges.find((t) => t.tile === tileIndex(s.map, b));
    expect(ea?.edges).toEqual([1, 2, 3, 4, 5]); // edge 0 (east) is missing
    expect(eb?.edges).toEqual([0, 1, 2, 4, 5]); // edge 3 (west) is missing
  });

  it('draws an edge next to another owner', () => {
    const s = emptyState();
    const a = at(4, 3);
    s.territory[tileIndex(s.map, a)] = 0;
    s.territory[tileIndex(s.map, hexAdd(a, HEX_DIRECTIONS[0]))] = 1;
    expect(territoryEdges(s, 0)[0].edges).toContain(0);
    expect(territoryEdges(s, 2)).toEqual([]);
  });
});

describe('roadGeometry', () => {
  it('connects adjacent road tiles once and gives lone roads a stub', () => {
    const s = emptyState();
    const a = at(4, 3);
    const b = hexAdd(a, HEX_DIRECTIONS[0]);
    const c = at(8, 8);
    for (const h of [a, b, c]) s.roads[tileIndex(s.map, h)] = true;
    const g = roadGeometry(s);
    expect(g.segments).toHaveLength(1);
    expect(g.stubs).toEqual([tileIndex(s.map, c)]);
  });

  it('connects a road to an adjacent building of the same owner only', () => {
    const s = emptyState();
    const a = at(4, 3);
    const bHex = hexAdd(a, HEX_DIRECTIONS[0]);
    const ia = tileIndex(s.map, a);
    s.roads[ia] = true;
    s.territory[ia] = 0;
    s.buildings = [{ id: 1, type: 'house', owner: 1, hex: bHex, paused: false }];
    expect(roadGeometry(s).segments).toHaveLength(0);
    s.buildings = [{ id: 1, type: 'house', owner: 0, hex: bHex, paused: false }];
    const g = roadGeometry(s);
    expect(g.segments).toEqual([[ia, tileIndex(s.map, bHex)]]);
    expect(g.stubs).toEqual([]);
  });
});

describe('sharedEdgeMidpoint', () => {
  it('lies halfway to the neighbor, at distance size*sqrt(3)/2 from the start center', () => {
    const size = 40;
    const a = { q: 3, r: 2 };
    for (const d of HEX_DIRECTIONS) {
      const b = { q: a.q + d.q, r: a.r + d.r };
      const m = sharedEdgeMidpoint(a, b, size);
      const ca = hexToPixel(a, size);
      const cb = hexToPixel(b, size);
      expect(Math.hypot(m.x - ca.x, m.y - ca.y)).toBeCloseTo((size * Math.sqrt(3)) / 2, 6);
      expect(m.x).toBeCloseTo((ca.x + cb.x) / 2, 6);
      expect(m.y).toBeCloseTo((ca.y + cb.y) / 2, 6);
    }
  });
});

/** Distance of point p to the infinite line through a and b. */
function distToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

describe('insetEdge', () => {
  const size = 32;
  const c = hexToPixel({ q: 2, r: 1 }, size);
  const corners = hexCorners(c, size);

  it('both endpoints lie exactly `depth` inside the edge, in every corner mode', () => {
    for (let e = 0; e < 6; e++) {
      for (const prevIn of [false, true]) {
        for (const nextIn of [false, true]) {
          const [s, t] = insetEdge(c, corners, e, 5, prevIn, nextIn);
          const a = corners[e];
          const b = corners[(e + 1) % 6];
          expect(distToLine(s, a, b)).toBeCloseTo(5, 6);
          expect(distToLine(t, a, b)).toBeCloseTo(5, 6);
        }
      }
    }
  });

  it('slides along the neighboring edge when that edge is not part of the line', () => {
    const [s, t] = insetEdge(c, corners, 0, 5, false, false);
    // start lies on edge 5 (corner 5 -> corner 0), end on edge 1 (corner 1 -> corner 2)
    expect(distToLine(s, corners[5], corners[0])).toBeCloseTo(0, 6);
    expect(distToLine(t, corners[1], corners[2])).toBeCloseTo(0, 6);
  });

  it('meets the line of the neighbor tile exactly at a shared corner', () => {
    // Tile A and its east neighbor B both border the tile N to the north-east of A
    // (NE of A = across edge 5). B's edge facing N is edge 4. They share corner 0 of A.
    const a = { q: 2, r: 1 };
    const b = edgeNeighborHex(a, 0);
    const n = edgeNeighborHex(a, 5);
    expect(edgeNeighborHex(b, 4)).toEqual(n);
    const ca = hexToPixel(a, size);
    const cb = hexToPixel(b, size);
    const [, endA] = insetEdge(ca, hexCorners(ca, size), 5, 4, false, false);
    const [startB] = insetEdge(cb, hexCorners(cb, size), 4, 4, false, false);
    expect(endA.x).toBeCloseTo(startB.x, 6);
    expect(endA.y).toBeCloseTo(startB.y, 6);
  });
});

describe('insetRuns / insetBands / insetStrips', () => {
  const size = 32;
  const c = { x: 0, y: 0 };
  const corners = hexCorners(c, size);

  it('chains consecutive edges into one line, wrapping around edge 0', () => {
    const runs = insetRuns(c, corners, edgeMaskOf([5, 0, 1, 3]), 3);
    expect(runs).toHaveLength(2);
    // Run over edges 5, 0, 1: 4 points; run over edge 3 alone: 2 points
    const lengths = runs.map((r) => r.points.length).sort();
    expect(lengths).toEqual([2, 4]);
    expect(runs.every((r) => !r.closed)).toBe(true);
  });

  it('all six edges make one closed ring', () => {
    const runs = insetRuns(c, corners, edgeMaskOf([0, 1, 2, 3, 4, 5]), 3);
    expect(runs).toHaveLength(1);
    expect(runs[0].closed).toBe(true);
    expect(runs[0].points).toHaveLength(6);
  });

  it('no edges, no lines', () => {
    expect(insetRuns(c, corners, edgeMaskOf([]), 3)).toEqual([]);
    expect(insetBands(c, corners, edgeMaskOf([]), 3)).toEqual([]);
  });

  it('bands start on the edge itself, strips run parallel inside', () => {
    const bands = insetBands(c, corners, edgeMaskOf([2]), 6);
    expect(bands).toHaveLength(1);
    expect(bands[0][0]).toEqual(corners[2]);
    expect(bands[0][1]).toEqual(corners[3]);
    const [strip] = insetStrips(c, corners, edgeMaskOf([2]), 2, 6);
    expect(distToLine(strip[0], corners[2], corners[3])).toBeCloseTo(2, 6);
    expect(distToLine(strip[2], corners[2], corners[3])).toBeCloseTo(6, 6);
  });
});

describe('wavy edges (shared curve between two tiles)', () => {
  const size = 32;
  const amp = 0.15 * size;
  const tile = (h: { q: number; r: number }): { c: Point; corners: Point[] } => {
    const c = hexToPixel(h, size);
    return { c, corners: hexCorners(c, size) };
  };

  it('both tiles draw the identical curve (reversed), ending exactly in the shared corners', () => {
    for (const a of [
      { q: 0, r: 0 },
      { q: 3, r: -2 },
      { q: -5, r: 7 },
    ]) {
      for (let e = 0; e < 6; e++) {
        const b = edgeNeighborHex(a, e);
        const back = (e + 3) % 6;
        const ta = tile(a);
        const tb = tile(b);
        const lineA = wavyInsetLine(ta.c, ta.corners, e, edgeWave(a, e, amp), 0, false, false);
        const lineB = wavyInsetLine(
          tb.c,
          tb.corners,
          back,
          edgeWave(b, back, amp),
          0,
          false,
          false,
        );
        expect(lineA).toHaveLength(WAVE_SEGMENTS + 1);
        const reversed = [...lineB].reverse();
        lineA.forEach((p, i) => {
          expect(p.x).toBeCloseTo(reversed[i].x, 9);
          expect(p.y).toBeCloseTo(reversed[i].y, 9);
        });
        expect(lineA[0].x).toBeCloseTo(ta.corners[e].x, 9);
        expect(lineA[0].y).toBeCloseTo(ta.corners[e].y, 9);
        expect(lineA[WAVE_SEGMENTS].x).toBeCloseTo(ta.corners[(e + 1) % 6].x, 9);
        expect(lineA[WAVE_SEGMENTS].y).toBeCloseTo(ta.corners[(e + 1) % 6].y, 9);
      }
    }
  });

  it('a line inside the tile keeps the insetEdge ends and follows the curve', () => {
    const { c, corners } = tile({ q: 2, r: 1 });
    const offsets = edgeWave({ q: 2, r: 1 }, 1, amp);
    const line = wavyInsetLine(c, corners, 1, offsets, 6, true, false);
    const [s, e] = insetEdge(c, corners, 1, 6, true, false);
    expect(line[0]).toEqual(s);
    expect(line[WAVE_SEGMENTS].x).toBeCloseTo(e.x, 9);
    expect(line[WAVE_SEGMENTS].y).toBeCloseTo(e.y, 9);
    // Straight offsets give a straight line between the two ends
    const flatLine = wavyInsetLine(
      c,
      corners,
      1,
      new Array(WAVE_SEGMENTS + 1).fill(0),
      6,
      true,
      false,
    );
    const mid = flatLine[WAVE_SEGMENTS / 2];
    expect(mid.x).toBeCloseTo((s.x + e.x) / 2, 9);
    expect(mid.y).toBeCloseTo((s.y + e.y) / 2, 9);
  });

  it('tile outline: corners once, wavy edges add their inner points', () => {
    const { corners } = tile({ q: 0, r: 0 });
    const waves = [
      edgeWave({ q: 0, r: 0 }, 0, amp),
      null,
      null,
      edgeWave({ q: 0, r: 0 }, 3, amp),
      null,
      null,
    ];
    const outline = wavyTileOutline(corners, waves);
    expect(outline).toHaveLength(6 + 2 * (WAVE_SEGMENTS - 1));
    for (const corner of corners) expect(outline).toContainEqual(corner);
    expect(wavyTileOutline(corners, [null, null, null, null, null, null])).toEqual(corners);
  });
});

describe('subPolyline', () => {
  const line: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 40, y: 0 },
  ];
  it('cuts out the part between t0 and t1, keeping the points inside', () => {
    expect(subPolyline(line, 0.1, 0.6)).toEqual([
      { x: 4, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 24, y: 0 },
    ]);
    expect(subPolyline(line, 0, 1)).toEqual(line);
  });
});
