import { describe, expect, it } from 'vitest';
import { hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { GameState } from '../core/state';
import { addBuilding, addCity, addRoad, at, makeTestState } from '../core/testing';
import { hexSize } from './config';
import {
  edgeNeighborHex,
  previewPiece,
  previewTrack,
  roadGeometry,
  roadSignature,
  roadTracks,
  trackRibbon,
  type TrackPiece,
} from './geometry';
import { roadDistance, roadMasks } from './relief';
import { roadTrackParams } from './roadLayer';
import { apothem } from './terrain';
import { theme } from './theme';

const size = hexSize;
const R = theme.road;
const params = roadTrackParams();

function state(rows: string[] = Array(9).fill('ppppppppp')): GameState {
  return makeTestState(rows);
}

function road(s: GameState, ...hexes: Hex[]): void {
  for (const h of hexes) addRoad(s, h);
}

const close = (a: Point, b: Point, eps = 1e-6): boolean => Math.hypot(a.x - b.x, a.y - b.y) < eps;
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const first = <T>(a: readonly T[]): T => a[0];
const last = <T>(a: readonly T[]): T => a[a.length - 1];

function pieceOf(pieces: readonly TrackPiece[], s: GameState, h: Hex): TrackPiece | undefined {
  return pieces.find((t) => t.tile === tileIndex(s.map, h));
}

describe('roadTracks', () => {
  it('runs on across the shared edge of two road tiles: same point, width, direction, distance', () => {
    const s = state();
    // A bending road: west - middle - south-east neighbor - further on
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    const c = edgeNeighborHex(b, 1);
    const d = edgeNeighborHex(c, 2);
    road(s, a, b, c, d);
    const { pieces } = roadTracks(s, size, params);
    const pb = pieceOf(pieces, s, b);
    const pc = pieceOf(pieces, s, c);
    if (!pb || !pc) throw new Error('missing pieces');
    // One chain: one piece ends where the next begins (they run the same way)
    const [x, y] = close(last(pb.points), first(pc.points)) ? [pb, pc] : [pc, pb];
    expect(close(last(x.points), first(y.points))).toBe(true);
    // ... near the middle of the shared edge
    const m = {
      x: (hexToPixel(b, size).x + hexToPixel(c, size).x) / 2,
      y: (hexToPixel(b, size).y + hexToPixel(c, size).y) / 2,
    };
    expect(Math.hypot(first(y.points).x - m.x, first(y.points).y - m.y)).toBeLessThanOrEqual(
      R.edgeJitter * size + 1e-6,
    );
    expect(last(x.widths)).toBeCloseTo(first(y.widths));
    // The same direction on both sides of the joint (no kink), across the edge at right angles
    expect(dot(last(x.dirs), first(y.dirs))).toBeGreaterThan(0.9999);
    const across = {
      x: hexToPixel(c, size).x - hexToPixel(b, size).x,
      y: hexToPixel(c, size).y - hexToPixel(b, size).y,
    };
    const l = Math.hypot(across.x, across.y);
    expect(Math.abs(dot(first(y.dirs), { x: across.x / l, y: across.y / l }))).toBeGreaterThan(
      0.9999,
    );
    // The distance along the road runs on (textures continue without a seam)
    expect(last(x.along)).toBeCloseTo(first(y.along));
  });

  it('keeps one direction along a whole chain, with growing distances', () => {
    const s = state();
    const hexes = [at(1, 4)];
    for (let i = 0; i < 5; i++)
      hexes.push(edgeNeighborHex(hexes[hexes.length - 1], i % 2 === 0 ? 0 : 1));
    road(s, ...hexes);
    const { pieces } = roadTracks(s, size, params);
    for (const t of pieces) {
      for (let i = 1; i < t.along.length; i++) expect(t.along[i]).toBeGreaterThan(t.along[i - 1]);
    }
    // Sorted by distance, every piece starts where the previous one ended
    const sorted = [...pieces].sort((p, q) => first(p.along) - first(q.along));
    expect(first(sorted[0].along)).toBe(0);
    for (let i = 1; i < sorted.length; i++) {
      expect(close(first(sorted[i].points), last(sorted[i - 1].points))).toBe(true);
      expect(first(sorted[i].along)).toBeCloseTo(last(sorted[i - 1].along));
    }
  });

  it('bends through the middle of a tile with two road edges, with a constant width', () => {
    const s = state();
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    const c = edgeNeighborHex(b, 1);
    road(s, a, b, c);
    const ib = tileIndex(s.map, b);
    const pieces = roadTracks(s, size, params).pieces.filter((t) => t.tile === ib);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].kind).toBe('through');
    const cb = hexToPixel(b, size);
    const nearest = Math.min(...pieces[0].points.map((p) => Math.hypot(p.x - cb.x, p.y - cb.y)));
    expect(nearest).toBeLessThanOrEqual(R.centerJitter * size * Math.SQRT2 + 1e-6);
    for (const w of pieces[0].widths) expect(w).toBeCloseTo(R.width * size);
  });

  it('merges a gravel junction softly: curves between neighboring arms, no ruts, a worn crossing', () => {
    const s = state();
    const m = at(4, 4);
    road(s, m, edgeNeighborHex(m, 0), edgeNeighborHex(m, 2), edgeNeighborHex(m, 4));
    const im = tileIndex(s.map, m);
    const { pieces, crossings } = roadTracks(s, size, params);
    const own = pieces.filter((t) => t.tile === im);
    expect(own).toHaveLength(3);
    const crossing = crossings.filter((c) => c.tile === im);
    expect(crossing).toHaveLength(1);
    expect(crossing[0].kind).toBe('junction');
    const cm = hexToPixel(m, size);
    for (const t of own) {
      expect(t.kind).toBe('junction');
      // Every curve runs from one edge to another (no spoke ending at the center)
      for (const p of [first(t.points), last(t.points)]) {
        expect(Math.hypot(p.x - cm.x, p.y - cm.y)).toBeGreaterThan(0.8 * apothem(size));
      }
      // One worn place: no ruts inside
      expect(Math.max(...t.ruts)).toBe(0);
    }
    // The tracks running in let their ruts fade out before the crossing
    for (const e of [0, 2, 4]) {
      const arm = pieceOf(pieces, s, edgeNeighborHex(m, e));
      if (!arm) throw new Error('no arm');
      const c = hexToPixel(m, size);
      const near =
        Math.hypot(first(arm.points).x - c.x, first(arm.points).y - c.y) <
        Math.hypot(last(arm.points).x - c.x, last(arm.points).y - c.y)
          ? 0
          : arm.ruts.length - 1;
      expect(arm.ruts[near]).toBeCloseTo(0);
    }
  });

  it('fades out at a dead end and in a building yard', () => {
    const s = state();
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    road(s, a, b);
    addBuilding(s, 'house', edgeNeighborHex(b, 0));
    const { pieces, crossings } = roadTracks(s, size, params);
    const dead = pieceOf(pieces, s, a);
    if (!dead) throw new Error('no dead end');
    expect(dead.kind).toBe('deadEnd');
    // Full at the edge, gone at its end; narrower there; a soft worn spot at the end
    const edgeEnd = dead.fade[0] === 1 ? 0 : dead.fade.length - 1;
    const tipEnd = edgeEnd === 0 ? dead.fade.length - 1 : 0;
    expect(dead.fade[edgeEnd]).toBe(1);
    expect(dead.fade[tipEnd]).toBeCloseTo(0);
    expect(dead.widths[tipEnd]).toBeLessThan(dead.widths[edgeEnd]);
    const spot = crossings.find((c) => c.tile === tileIndex(s.map, a));
    expect(spot?.kind).toBe('deadEnd');
    const yard = pieceOf(pieces, s, edgeNeighborHex(b, 0));
    if (!yard) throw new Error('no yard piece');
    expect(yard.kind).toBe('yard');
    // It runs into the yard and fades out there, its ruts first
    expect(Math.min(...yard.fade)).toBeCloseTo(0);
    const yardTip = yard.fade.indexOf(Math.min(...yard.fade));
    expect(yard.ruts[yardTip]).toBeCloseTo(0);
  });

  it('is paved on and next to a city center, gravel further out; it ends cleanly at the plaza', () => {
    const s = state();
    const city = at(4, 4);
    addCity(s, city, { radius: 3 });
    const n1 = edgeNeighborHex(city, 0);
    const n2 = edgeNeighborHex(n1, 0);
    const n3 = edgeNeighborHex(n2, 0);
    road(s, n1, n2, n3);
    const { pieces } = roadTracks(s, size, params);
    expect(pieceOf(pieces, s, city)?.style).toBe('paved');
    expect(pieceOf(pieces, s, n1)?.style).toBe('paved');
    expect(pieceOf(pieces, s, n2)?.style).toBe('dirt');
    expect(pieceOf(pieces, s, n3)?.style).toBe('dirt');
    // Onto the city center: ends on the plaza's ellipse, no fading
    const plaza = pieceOf(pieces, s, city);
    if (!plaza) throw new Error('no plaza piece');
    expect(plaza.kind).toBe('plaza');
    expect(Math.min(...plaza.fade)).toBe(1);
    const cc = hexToPixel(city, size);
    const inner = [first(plaza.points), last(plaza.points)].sort(
      (p, q) => Math.hypot(p.x - cc.x, p.y - cc.y) - Math.hypot(q.x - cc.x, q.y - cc.y),
    )[0];
    const k = Math.hypot(
      (inner.x - cc.x) / (R.plazaRx * size),
      (inner.y - cc.y) / (R.plazaRy * size),
    );
    expect(k).toBeCloseTo(1, 5);
    // The paving is wider than the gravel; the gravel's ruts fade out before the stones begin
    expect(pieceOf(pieces, s, n1)?.widths[0]).toBeCloseTo(R.width * R.paving.width * size);
    const gravel = pieceOf(pieces, s, n2);
    if (!gravel) throw new Error('no gravel piece');
    const atPaving = close(first(gravel.points), last(pieceOf(pieces, s, n1)?.points ?? []))
      ? 0
      : gravel.ruts.length - 1;
    expect(gravel.ruts[atPaving]).toBeCloseTo(0);
    // ... and the paving ends there with a row of edge stones (not at the plaza)
    const street = pieceOf(pieces, s, n1);
    if (!street) throw new Error('no street');
    const curbAt =
      close(first(street.points), first(gravel.points)) ||
      close(first(street.points), last(gravel.points))
        ? 0
        : 1;
    expect(street.curbs[curbAt]).toBe(true);
    expect(street.curbs[1 - curbAt]).toBe(false);
    expect(plaza.curbs).toEqual([false, false]);
  });

  it('meets in a small paved square where paved roads join', () => {
    const s = state();
    const city = at(4, 4);
    addCity(s, city, { radius: 3 });
    const n = edgeNeighborHex(city, 0);
    road(s, n, edgeNeighborHex(n, 1), edgeNeighborHex(n, 5), edgeNeighborHex(n, 0));
    const { pieces, crossings } = roadTracks(s, size, params);
    const own = pieces.filter((t) => t.tile === tileIndex(s.map, n));
    expect(own.length).toBe(4);
    for (const t of own) expect(t.kind).toBe('junction');
    const square = crossings.find((c) => c.tile === tileIndex(s.map, n));
    expect(square?.style).toBe('paved');
    expect(square?.r).toBeCloseTo(R.width * R.paving.width * R.paving.squareRadius * size);
  });

  it('cuts banks into hills: full between hill tiles, growing in from other terrain, none on plains', () => {
    // Row 4: plains, hills, hills, plains
    const s = state(['ppppppp', 'ppppppp', 'ppppppp', 'ppppppp', 'phhhppp', 'ppppppp', 'ppppppp']);
    const a = at(0, 4);
    const b = at(1, 4);
    const c = at(2, 4);
    const d = at(3, 4);
    const e = at(4, 4);
    road(s, a, b, c, d, e);
    const { pieces } = roadTracks(s, size, params);
    const toward = (t: TrackPiece, h: Hex): number => {
      const p = hexToPixel(h, size);
      const da = Math.hypot(first(t.points).x - p.x, first(t.points).y - p.y);
      const db = Math.hypot(last(t.points).x - p.x, last(t.points).y - p.y);
      return da < db ? 0 : t.points.length - 1;
    };
    const pb = pieceOf(pieces, s, b);
    const pc = pieceOf(pieces, s, c);
    const pa = pieceOf(pieces, s, a);
    if (!pa || !pb || !pc) throw new Error('missing pieces');
    expect(Math.max(...pa.banks)).toBe(0);
    // Hill next to plains: no bank at that edge, full inside
    expect(pb.banks[toward(pb, a)]).toBe(0);
    expect(pb.banks[toward(pb, c)]).toBe(1);
    // Between two hill tiles: full banks at the joint
    expect(pc.banks[toward(pc, b)]).toBe(1);
  });

  it("stays on the terrain's road lines (trees and rocks keep off the track)", () => {
    const s = state();
    // A small network with a junction, bends and a dead end
    const m = at(4, 4);
    road(
      s,
      m,
      edgeNeighborHex(m, 0),
      edgeNeighborHex(m, 1),
      edgeNeighborHex(m, 3),
      edgeNeighborHex(edgeNeighborHex(m, 3), 4),
      edgeNeighborHex(edgeNeighborHex(m, 0), 5),
    );
    const masks = roadMasks(s.map, roadGeometry(s));
    let worst = 0;
    for (const t of roadTracks(s, size, params).pieces) {
      const c = hexToPixel(hexAtIndex(s.map, t.tile), size);
      for (const p of t.points) {
        const d = roadDistance({ x: p.x - c.x, y: p.y - c.y }, masks[t.tile], size);
        worst = Math.max(worst, d);
      }
    }
    // The center line never strays further than this from the terrain's road lines
    expect(worst).toBeLessThan(0.2 * size);
  });

  it('changes its key only when the roads change', () => {
    const s = state();
    road(s, at(3, 4), at(4, 4));
    const key = roadSignature(s);
    expect(roadSignature(s)).toBe(key);
    road(s, at(5, 4));
    expect(roadSignature(s)).not.toBe(key);
  });
});

describe('track helpers', () => {
  it('a ribbon is a closed band along the line, pointed where the width is 0', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const poly = trackRibbon(pts, [4, 4, 0], 1);
    expect(poly).toHaveLength(12);
    // Left side at +y (normal of a line to the right), back along -y
    expect(poly.slice(0, 2)).toEqual([0, 2]);
    expect(poly.slice(4, 6)).toEqual([20, 0]);
    // Shifted sideways for a rut
    const rut = trackRibbon(pts, [4, 4, 4], 0.1, 0.25);
    expect(rut[1]).toBeCloseTo(1 + 0.2);
  });

  it('the preview runs smoothly through the tile centers and edge midpoints', () => {
    const path = [at(3, 4), at(4, 4), at(4, 5)];
    const pts = previewTrack(path, size);
    for (const h of path) {
      const c = hexToPixel(h, size);
      expect(pts.some((p) => close(p, c))).toBe(true);
    }
    // As a piece: a gravel track with growing distances along it
    const piece = previewPiece(path, size, R.width);
    expect(piece.points).toEqual(pts);
    for (let i = 1; i < piece.along.length; i++)
      expect(piece.along[i]).toBeGreaterThan(piece.along[i - 1]);
    expect(piece.widths[0]).toBeCloseTo(R.width * size);
  });
});
