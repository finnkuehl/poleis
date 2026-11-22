import { describe, expect, it } from 'vitest';
import { hexToPixel, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { GameState } from '../core/state';
import { addBuilding, addCity, addRoad, at, makeTestState } from '../core/testing';
import { hexSize } from './config';
import {
  edgeNeighborHex,
  previewTrack,
  roadGeometry,
  roadSignature,
  roadTracks,
  trackRibbon,
  type TrackParams,
  type TrackPiece,
} from './geometry';
import { roadDistance, roadMasks } from './relief';
import { apothem } from './terrain';
import { theme } from './theme';

const size = hexSize;
const R = theme.ground.road;
const params: TrackParams = {
  width: R.width,
  widthVar: R.widthVar,
  edgeJitter: R.edgeJitter,
  centerJitter: R.centerJitter,
  buildingEnd: R.buildingEnd,
  plazaEnd: R.plazaEnd,
  samples: R.samples,
};

function state(): GameState {
  return makeTestState(Array(9).fill('ppppppppp'));
}

function road(s: GameState, ...hexes: Hex[]): void {
  for (const h of hexes) addRoad(s, h);
}

const close = (a: Point, b: Point): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const dir = (a: Point, b: Point): Point => {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};

/** The end of a piece at `p` (start or end) with its direction leaving through that end. */
function endAt(piece: TrackPiece, p: Point): { out: Point; width: number } | null {
  const pts = piece.points;
  const n = pts.length;
  if (close(pts[0], p)) return { out: dir(pts[1], pts[0]), width: piece.widths[0] };
  if (close(pts[n - 1], p)) return { out: dir(pts[n - 2], pts[n - 1]), width: piece.widths[n - 1] };
  return null;
}

describe('roadTracks', () => {
  it('runs on without a kink across the shared edge of two road tiles', () => {
    const s = state();
    // A bending road: west - middle - south-east neighbor - further on
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    const c = edgeNeighborHex(b, 1);
    const d = edgeNeighborHex(c, 2);
    road(s, a, b, c, d);
    const { pieces } = roadTracks(s, size, params);
    const ib = tileIndex(s.map, b);
    const ic = tileIndex(s.map, c);
    const pb = pieces.find((t) => t.tile === ib);
    const pc = pieces.find((t) => t.tile === ic);
    expect(pb && pc).toBeTruthy();
    if (!pb || !pc) return;
    // The point both pieces share lies near the middle of the shared edge
    const shared = [pb.points[0], pb.points[pb.points.length - 1]].find(
      (p) => endAt(pc, p) !== null,
    );
    expect(shared).toBeDefined();
    if (!shared) return;
    const m = {
      x: (hexToPixel(b, size).x + hexToPixel(c, size).x) / 2,
      y: (hexToPixel(b, size).y + hexToPixel(c, size).y) / 2,
    };
    expect(Math.hypot(shared.x - m.x, shared.y - m.y)).toBeLessThanOrEqual(
      R.edgeJitter * size + 1e-6,
    );
    const eb = endAt(pb, shared);
    const ec = endAt(pc, shared);
    if (!eb || !ec) throw new Error('no shared end');
    // Same width, and the two pieces leave the point in opposite directions (one smooth line)
    expect(eb.width).toBeCloseTo(ec.width);
    expect(eb.out.x * ec.out.x + eb.out.y * ec.out.y).toBeLessThan(-0.99);
  });

  it('bends through the middle of a tile with two road edges', () => {
    const s = state();
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    const c = edgeNeighborHex(b, 1);
    road(s, a, b, c);
    const ib = tileIndex(s.map, b);
    const pieces = roadTracks(s, size, params).pieces.filter((t) => t.tile === ib);
    expect(pieces).toHaveLength(1);
    const cb = hexToPixel(b, size);
    const nearest = Math.min(...pieces[0].points.map((p) => Math.hypot(p.x - cb.x, p.y - cb.y)));
    expect(nearest).toBeLessThanOrEqual(R.centerJitter * size * Math.SQRT2 + 1e-6);
  });

  it('merges a junction softly: curves between neighboring arms and a worn crossing', () => {
    const s = state();
    const m = at(4, 4);
    road(s, m, edgeNeighborHex(m, 0), edgeNeighborHex(m, 2), edgeNeighborHex(m, 4));
    const im = tileIndex(s.map, m);
    const { pieces, crossings } = roadTracks(s, size, params);
    const own = pieces.filter((t) => t.tile === im);
    expect(own).toHaveLength(3);
    expect(crossings.filter((c) => c.tile === im)).toHaveLength(1);
    const cm = hexToPixel(m, size);
    for (const t of own) {
      expect(t.junction).toBe(true);
      // Every curve runs from one edge to another (no spoke ending at the center)
      for (const p of [t.points[0], t.points[t.points.length - 1]]) {
        expect(Math.hypot(p.x - cm.x, p.y - cm.y)).toBeGreaterThan(0.8 * apothem(size));
      }
    }
  });

  it('fades out at a dead end and ends softly in a building yard', () => {
    const s = state();
    const a = at(3, 4);
    const b = edgeNeighborHex(a, 0);
    road(s, a, b);
    addBuilding(s, 'house', edgeNeighborHex(b, 0));
    const { pieces } = roadTracks(s, size, params);
    const { crossings } = roadTracks(s, size, params);
    const dead = pieces.find((t) => t.tile === tileIndex(s.map, a));
    // It narrows toward its end and stops in a small worn spot
    expect(dead?.widths[dead.widths.length - 1]).toBeLessThan((dead?.widths[0] ?? 0) * 0.5);
    expect(crossings.some((c) => c.tile === tileIndex(s.map, a))).toBe(true);
    const yard = pieces.find((t) => t.tile === tileIndex(s.map, edgeNeighborHex(b, 0)));
    expect(yard).toBeDefined();
    if (!yard) return;
    // It runs into the yard and ends in a worn spot there
    expect(yard.yard).toBe(true);
    expect(crossings.some((c) => c.tile === yard.tile)).toBe(true);
  });

  it('is paved on and next to a city center, earth further out', () => {
    const s = state();
    const city = at(4, 4);
    addCity(s, city, { radius: 3 });
    const n1 = edgeNeighborHex(city, 0);
    const n2 = edgeNeighborHex(n1, 0);
    const n3 = edgeNeighborHex(n2, 0);
    road(s, n1, n2, n3);
    const { pieces } = roadTracks(s, size, params);
    const styleOf = (h: Hex) => pieces.find((t) => t.tile === tileIndex(s.map, h))?.style;
    expect(styleOf(city)).toBe('paved');
    expect(styleOf(n1)).toBe('paved');
    expect(styleOf(n2)).toBe('dirt');
    expect(styleOf(n3)).toBe('dirt');
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
  });
});
