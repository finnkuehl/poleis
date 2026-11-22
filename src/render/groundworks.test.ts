import { describe, expect, it } from 'vitest';
import type { Point } from '../core/hex';
import { tileIndex } from '../core/map';
import { addBuilding, at, makeTestState } from '../core/testing';
import type { GameState } from '../core/state';
import { BUILDING_IDS } from '../data/buildings';
import { hexSize } from './config';
import { edgeNeighborHex } from './geometry';
import {
  FIELD_CELL_REACH,
  GROUND_KIND,
  OUTLINE_SAMPLES_PER_EDGE,
  cellCorners,
  clampToLimits,
  clampToOutline,
  clipSegment,
  clipToCell,
  dedupe,
  densify,
  edgeLimits,
  edgeNormal,
  fieldCells,
  fieldJoinMask,
  fieldOutline,
  fieldTiles,
  fieldWarp,
  fisheryYardOffset,
  footprintOf,
  groundFootprints,
  groundSide,
  groundSignature,
  insideConvex,
  insideOutline,
  isFieldKind,
  isoPoint,
  jettyEdge,
  longestRun,
  organicBlob,
  outlinePoint,
  outlineRadius,
  parallelLines,
  patchCenter,
  patchRadii,
  polygonArea,
  withinLimits,
  type OutlineSample,
} from './groundworks';
import { apothem, tileRng } from './terrain';
import { theme } from './theme';

const size = hexSize;
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

describe('ground kind per building', () => {
  it('covers every building id', () => {
    for (const id of BUILDING_IDS) expect(GROUND_KIND[id], id).toBeDefined();
    expect(Object.keys(GROUND_KIND).sort()).toEqual([...BUILDING_IDS].sort());
  });

  it('gives fields to farm, vineyard and olive grove only', () => {
    const fields = BUILDING_IDS.filter((id) => isFieldKind(GROUND_KIND[id]));
    expect(fields.sort()).toEqual(['farm', 'oliveGrove', 'vineyard']);
    expect(GROUND_KIND.cityCenter).toBe('plaza');
    expect(GROUND_KIND.temple).toBe('plaza');
    expect(GROUND_KIND.woodcutter).toBe('clearing');
    expect(GROUND_KIND.fishery).toBe('fishery');
  });

  it('gives every non-field building a patch that fits into the tile', () => {
    for (const id of BUILDING_IDS) {
      const { rx, ry } = patchRadii(id, size);
      expect(rx, id).toBeGreaterThan(0);
      expect(ry, id).toBeGreaterThan(0);
      expect(rx, id).toBeLessThanOrEqual(size);
    }
  });
});

describe('patches fitted to the art', () => {
  const G = theme.ground;

  it("grow each building's measured ground circle into an iso ellipse", () => {
    // A world circle of radius r: about 0.0117 r x 0.00586 r hex sizes (art agents' conversion)
    const r = G.artGroundRadius.house;
    const { rx, ry } = patchRadii('house', size);
    expect(rx / size).toBeCloseTo(0.0117 * r * G.artPatchGrow[0], 2);
    expect(ry / size).toBeCloseTo(0.00586 * r * G.artPatchGrow[1], 2);
    // Bigger art, bigger patch
    expect(patchRadii('marketplace', size).rx).toBeGreaterThan(patchRadii('borderTower', size).rx);
  });

  it('lies where the art stands: the olive-grove shed is behind and to the right', () => {
    expect(patchCenter('house', size)).toEqual({ x: 0, y: 0 });
    const shed = patchCenter('oliveGrove', size);
    expect(shed.x).toBeGreaterThan(0);
    expect(shed.y).toBeLessThan(0);
    // The border tower is only a hair off center
    const tower = patchCenter('borderTower', size);
    expect(Math.hypot(tower.x, tower.y)).toBeLessThan(0.05 * size);
  });

  it('footprints still cover patches that are off center', () => {
    for (const id of ['borderTower', 'storehouse'] as const) {
      const fp = footprintOf(id, size);
      const { rx, ry } = patchRadii(id, size);
      const o = patchCenter(id, size);
      expect(fp.rx).toBeGreaterThanOrEqual(rx + Math.abs(o.x));
      expect(fp.ry).toBeGreaterThanOrEqual(ry + Math.abs(o.y));
    }
  });
});

describe('footprints', () => {
  it('fields take the whole tile, a clearing is smaller than a yard', () => {
    // Nearly the whole tile: a few terrain tufts may stay by the soft rim
    const field = theme.ground.field.footprint * size;
    expect(footprintOf('farm', size)).toEqual({ rx: field, ry: field });
    expect(footprintOf('vineyard', size)).toEqual({ rx: field, ry: field });
    expect(field).toBeGreaterThan(0.8 * size);
    expect(field).toBeLessThanOrEqual(size);
    const clearing = footprintOf('woodcutter', size);
    const yard = footprintOf('storehouse', size);
    expect(clearing.rx).toBeLessThan(yard.rx);
    expect(clearing.ry).toBeLessThan(yard.ry);
    // A yard keeps about its patch free
    const patch = patchRadii('storehouse', size);
    expect(yard.rx).toBeCloseTo(patch.rx * theme.ground.footprintGrow);
  });

  it('only for the buildings the viewer may see', () => {
    const state = makeTestState(['pppp', 'pppp'], { explored: false });
    addBuilding(state, 'house', at(0, 0), 1); // enemy, unexplored
    addBuilding(state, 'farm', at(2, 0), 1); // enemy, explored
    addBuilding(state, 'house', at(3, 1), 0); // own
    state.players[0].explored[tileIndex(state.map, at(2, 0))] = true;
    const fps = groundFootprints(state, 0, false, size);
    expect(fps.map((f) => f.hex)).toEqual([at(2, 0), at(3, 1)]);
    const field = theme.ground.field.footprint * size;
    expect(fps[0]).toMatchObject({ rx: field, ry: field });
    expect(groundFootprints(state, 0, true, size)).toHaveLength(3);
  });
});

describe('groundFootprints for a fishery', () => {
  it('also clears the water tile its jetty reaches into', () => {
    const state = makeTestState(['ccccc', 'ppppp', 'ppppp']);
    const h = at(2, 1);
    addBuilding(state, 'fishery', h, 0);
    state.players[0].explored[tileIndex(state.map, h)] = true;
    const fps = groundFootprints(state, 0, false, size);
    const e = jettyEdge(state.map, h);
    expect(e).not.toBeNull();
    expect(fps).toHaveLength(2);
    expect(fps[1]).toMatchObject({ hex: edgeNeighborHex(h, e ?? 0), rx: size, ry: size });
  });

  it("covers the fishery's yard, which is shifted toward the water", () => {
    const state = makeTestState(['ccccc', 'ppppp', 'ppppp']);
    const h = at(2, 1);
    addBuilding(state, 'fishery', h, 0);
    const [own] = groundFootprints(state, 0, false, size);
    const { rx, ry } = patchRadii('fishery', size);
    const o = fisheryYardOffset(jettyEdge(state.map, h), size);
    // The ellipse around the tile center reaches past the shifted yard's far side
    expect(own.rx).toBeGreaterThanOrEqual(rx + Math.abs(o.x));
    expect(own.ry).toBeGreaterThanOrEqual(ry + Math.abs(o.y));
  });
});

describe('jettyEdge', () => {
  it('picks an edge toward coastal water', () => {
    // Row 0 coast, row 1 plains: the fishery in row 1 looks up at the water
    const state = makeTestState(['ccccc', 'ppppp', 'ppppp']);
    const h = at(2, 1);
    const e = jettyEdge(state.map, h);
    expect(e).not.toBeNull();
    const n = edgeNeighborHex(h, e ?? 0);
    expect(state.map.tiles[tileIndex(state.map, n)]).toBe('coast');
  });

  it('prefers a lower or side edge, so the jetty is not hidden behind the hut', () => {
    const state = makeTestState(['ccccc', 'ppppp', 'ccccc']);
    const e = jettyEdge(state.map, at(2, 1));
    // Edges 1 (SE) and 2 (SW) face down
    expect([1, 2]).toContain(e);
  });

  it('prefers coast over ocean and returns null without water', () => {
    const state = makeTestState(['ooooo', 'ppcpp', 'ppppp']);
    const h = at(1, 1);
    const e = jettyEdge(state.map, h);
    expect(e).not.toBeNull();
    expect(state.map.tiles[tileIndex(state.map, edgeNeighborHex(h, e ?? 0))]).toBe('coast');
    const dry = makeTestState(['ppp', 'ppp', 'ppp']);
    expect(jettyEdge(dry.map, at(1, 1))).toBeNull();
    // Only ocean around: still a jetty
    const ocean = makeTestState(['ooo', 'opo', 'ooo']);
    expect(jettyEdge(ocean.map, at(1, 1))).not.toBeNull();
  });

  it('is deterministic', () => {
    const state = makeTestState(['cccc', 'cppc', 'cccc']);
    expect(jettyEdge(state.map, at(1, 1))).toBe(jettyEdge(state.map, at(1, 1)));
  });
});

describe('fisheryYardOffset', () => {
  it('moves the yard toward the jetty edge, under the hut of the drawn scene', () => {
    for (let e = 0; e < 6; e++) {
      const o = fisheryYardOffset(e, size);
      expect(dot(o, edgeNormal(e))).toBeCloseTo(theme.ground.fishery.yardShift * apothem(size));
      // At the shoreline, but still on the fishery's own tile
      expect(Math.hypot(o.x, o.y)).toBeLessThan(apothem(size));
    }
    expect(fisheryYardOffset(null, size)).toEqual({ x: 0, y: 0 });
  });
});

describe('groundSide', () => {
  it('points sideways on the 2:1 ground, foreshortened, toward the front', () => {
    expect(groundSide({ x: 1, y: 0 })).toEqual({ x: -0, y: 0.5 });
    const s = groundSide({ x: 0, y: 1 });
    expect(s.x).toBeCloseTo(1);
    expect(s.y).toBeCloseTo(0);
  });
});

function town(): GameState {
  return makeTestState(['ppppp', 'ppppp', 'ppppp', 'ppppp']);
}

describe('field joins', () => {
  it('mark the edges toward other shown fields', () => {
    const state = town();
    const a = at(1, 1);
    addBuilding(state, 'farm', a);
    addBuilding(state, 'vineyard', edgeNeighborHex(a, 1));
    addBuilding(state, 'house', edgeNeighborHex(a, 0));
    const mask = fieldJoinMask(state.map, a, fieldTiles(state.map, state.buildings));
    expect(mask).toEqual([false, true, false, false, false, false]);
  });
});

describe('groundSignature', () => {
  it('changes with the shown buildings only', () => {
    const state = town();
    addBuilding(state, 'house', at(1, 1));
    const key = groundSignature(state.buildings);
    expect(groundSignature(state.buildings)).toBe(key);
    // The ground shows no owner: a captured building keeps its ground
    state.buildings[0].owner = 1;
    expect(groundSignature(state.buildings)).toBe(key);
    state.buildings[0].type = 'storehouse';
    expect(groundSignature(state.buildings)).not.toBe(key);
    addBuilding(state, 'farm', at(2, 2));
    expect(groundSignature(state.buildings)).not.toBe(groundSignature(state.buildings.slice(0, 1)));
  });
});

/** Distance of a point (relative) to the line of hex edge `e`, measured inward. */
function insideEdge(p: Point, e: number): number {
  return apothem(size) - dot(p, edgeNormal(e));
}

const N = OUTLINE_SAMPLES_PER_EDGE;
const edgeSamples = (o: OutlineSample[], e: number): OutlineSample[] => o.slice(e * N, (e + 1) * N);

describe('fieldOutline', () => {
  const state = makeTestState(['pppppp', 'pppppp', 'pppppp', 'pppppp', 'pppppp']);
  const h = at(2, 2);
  const none = [false, false, false, false, false, false];

  it('never follows a straight hex edge: it runs inside it by a varying amount', () => {
    for (let q = 0; q < 4; q++) {
      const tile = at(1 + q, 2);
      const outline = fieldOutline(state.map, tile, size, none);
      expect(outline).toHaveLength(6 * N);
      for (let e = 0; e < 6; e++) {
        const gaps = edgeSamples(outline, e).map((o) => insideEdge(outlinePoint(o), e));
        // Inside the tile everywhere
        for (const g of gaps) expect(g).toBeGreaterThan(0);
        // Not a straight line parallel to the edge: the inset varies along it
        expect(Math.max(...gaps) - Math.min(...gaps), `tile ${q} edge ${e}`).toBeGreaterThan(1.5);
      }
      // Rounded corners: well inside the hex corners
      for (const o of outline) expect(o.r).toBeLessThan(size - 2);
    }
  });

  it('is open (soft rim) toward neighbors without a field and deterministic', () => {
    const outline = fieldOutline(state.map, h, size, none);
    for (const o of outline) expect(o.open).toBe(1);
    expect(fieldOutline(state.map, h, size, none)).toEqual(outline);
    expect(fieldOutline(state.map, at(3, 2), size, none)).not.toEqual(outline);
  });

  it('stays further away from water (the beach stays visible)', () => {
    const coast = makeTestState(['pppp', 'ppcc', 'pppp']);
    const tile = at(1, 1);
    expect(coast.map.tiles[tileIndex(coast.map, edgeNeighborHex(tile, 0))]).toBe('coast');
    const outline = fieldOutline(coast.map, tile, size, none);
    const shore = theme.ground.shoreMargin * size;
    const jitter = theme.ground.field.insetJitter * size;
    for (const o of edgeSamples(outline, 0).slice(2, -2)) {
      expect(insideEdge(outlinePoint(o), 0)).toBeGreaterThan(shore - jitter - 1);
    }
  });

  it('two joined fields meet on the same wavy line, off the hex edge', () => {
    const a = at(2, 2);
    for (let e = 0; e < 6; e++) {
      const b = edgeNeighborHex(a, e);
      const maskA = none.map((_, k) => k === e);
      const maskB = none.map((_, k) => k === (e + 3) % 6);
      const outA = fieldOutline(state.map, a, size, maskA);
      const outB = fieldOutline(state.map, b, size, maskB);
      const ca = hexToPixelLocal(a);
      const cb = hexToPixelLocal(b);
      const offsets: number[] = [];
      // Away from the corners (they blend into the neighboring edges' rim)
      for (const o of edgeSamples(outA, e).slice(2, -2)) {
        expect(o.open).toBe(0);
        const p = outlinePoint(o);
        const world = { x: ca.x + p.x, y: ca.y + p.y };
        // The same point seen from the other tile lies on its outline too
        const rel = { x: world.x - cb.x, y: world.y - cb.y };
        const rb = outlineRadius(outB, Math.atan2(rel.y, rel.x));
        expect(Math.abs(Math.hypot(rel.x, rel.y) - rb), `edge ${e}`).toBeLessThan(1.2);
        offsets.push(insideEdge(p, e));
      }
      // Wavy, not the straight edge
      expect(Math.max(...offsets) - Math.min(...offsets), `edge ${e}`).toBeGreaterThan(0.5);
    }
  });

  it('finds the outline between samples and keeps points inside it', () => {
    const outline = fieldOutline(state.map, h, size, none);
    const r0 = outline[0].r;
    expect(outlineRadius(outline, outline[0].angle)).toBeCloseTo(r0);
    expect(outlineRadius(outline, outline[0].angle + Math.PI * 2)).toBeCloseTo(r0);
    const far = [
      { x: 60, y: 0 },
      { x: -10, y: 50 },
      { x: 3, y: 2 },
    ];
    const clamped = clampToOutline(far, outline, 2);
    for (const p of clamped) expect(insideOutline(p, outline, 1.99)).toBe(true);
    expect(clamped[2]).toEqual({ x: 3, y: 2 });
  });
});

/** Tile center in world px (local helper, same as hexToPixel). */
function hexToPixelLocal(h: { q: number; r: number }): Point {
  return { x: size * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r), y: size * 1.5 * h.r };
}

describe('field parcels', () => {
  it('2-4 cells along the iso axes, balks between them, furrows along an axis', () => {
    for (let q = 0; q < 16; q++) {
      const cells = fieldCells(tileRng(q, 7), size, 2);
      expect(cells.length).toBeGreaterThanOrEqual(2);
      expect(cells.length).toBeLessThanOrEqual(4);
      for (const c of cells) {
        expect(c.a1).toBeGreaterThan(c.a0);
        expect(c.b1).toBeGreaterThan(c.b0);
        expect(Math.abs(c.dir.y / c.dir.x)).toBeCloseTo(0.5);
      }
      // No two cells overlap
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const [u, v] = [cells[i], cells[j]];
          const apart = u.a1 <= v.a0 || v.a1 <= u.a0 || u.b1 <= v.b0 || v.b1 <= u.b0;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it('a parcel is the part of the field inside its cell', () => {
    const state = makeTestState(['ppppp', 'ppppp', 'ppppp']);
    const h = at(2, 1);
    const outline = fieldOutline(state.map, h, size, [false, false, false, false, false, false]);
    const area = densify(
      outline.map((o) => outlinePoint(o)),
      3,
      true,
    );
    const cells = fieldCells(tileRng(2, 1), size, 2);
    let total = 0;
    for (const cell of cells) {
      const poly = clipToCell(area, cell, FIELD_CELL_REACH * size * 0.99);
      expect(poly.length).toBeGreaterThanOrEqual(3);
      total += polygonArea(poly);
      for (const p of poly) expect(insideOutline(p, outline, -0.01)).toBe(true);
      // Inside the cell (a = y + x / 2, b = y - x / 2)
      for (const p of poly) {
        expect(p.y + p.x / 2).toBeGreaterThanOrEqual(cell.a0 - 1e-6);
        expect(p.y + p.x / 2).toBeLessThanOrEqual(cell.a1 + 1e-6);
      }
    }
    // The balks take a little of the field
    expect(total).toBeLessThan(polygonArea(area));
    expect(total).toBeGreaterThan(polygonArea(area) * 0.8);
    expect(cellCorners(cells[0])[0]).toEqual(isoPoint(cells[0].a0, cells[0].b0));
  });

  it('the warp is gentle and deterministic', () => {
    const warp = fieldWarp(at(2, 1), size);
    const p = { x: 5, y: -7 };
    const w = warp(p);
    expect(Math.hypot(w.x - p.x, w.y - p.y)).toBeLessThanOrEqual(
      theme.ground.field.warp * size * 1.2,
    );
    expect(fieldWarp(at(2, 1), size)(p)).toEqual(w);
  });

  it('helpers: densify, longest run, dedupe', () => {
    const line = densify(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      2.5,
      false,
    );
    expect(line).toHaveLength(5);
    expect(line[4]).toEqual({ x: 10, y: 0 });
    expect(longestRun(line, (p) => p.x !== 5).map((p) => p.x)).toEqual([0, 2.5]);
    expect(longestRun(line, (p) => p.x >= 5).map((p) => p.x)).toEqual([5, 7.5, 10]);
    expect(
      dedupe(
        [
          { x: 0, y: 0 },
          { x: 0.1, y: 0 },
          { x: 3, y: 0 },
          { x: 0.2, y: 0 },
        ],
        0.5,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
});

describe('patch geometry', () => {
  it('keeps patches inside the tile and further away from a water edge', () => {
    const state = makeTestState(['ppp', 'ppc', 'ppp']);
    const h = at(1, 1);
    const margin = theme.ground.edgeMargin * size;
    const shore = theme.ground.shoreMargin * size;
    const limits = edgeLimits(state.map, h, size, margin, shore);
    const east = 0;
    expect(state.map.tiles[tileIndex(state.map, edgeNeighborHex(h, east))]).toBe('coast');
    expect(limits[east]).toBeCloseTo(apothem(size) - shore);
    expect(limits[3]).toBeCloseTo(apothem(size) - margin);
    const blob = organicBlob(size * 1.2, size * 0.9, tileRng(1, 1), 0.1);
    for (const p of clampToLimits(blob, limits)) expect(withinLimits(p, limits, -1e-9)).toBe(true);
  });

  it('draws the same organic outline for the same tile', () => {
    expect(organicBlob(10, 6, tileRng(3, 4), 0.1)).toEqual(organicBlob(10, 6, tileRng(3, 4), 0.1));
    expect(organicBlob(10, 6, tileRng(3, 4), 0.1)).not.toEqual(
      organicBlob(10, 6, tileRng(4, 3), 0.1),
    );
  });

  it('clips lines to a convex polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(clipSegment({ x: -5, y: 5 }, { x: 15, y: 5 }, square)).toEqual([
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]);
    expect(clipSegment({ x: -5, y: 20 }, { x: 15, y: 20 }, square)).toBeNull();
    const lines = parallelLines(square, { x: 1, y: 0 }, 2.5);
    expect(lines.length).toBe(5);
    expect(insideConvex({ x: 5, y: 5 }, square, 1)).toBe(true);
    expect(insideConvex({ x: 0.5, y: 5 }, square, 1)).toBe(false);
  });
});
