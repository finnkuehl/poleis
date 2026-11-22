import { describe, expect, it } from 'vitest';
import {
  buildContextBatches,
  Graphics,
  Sprite,
  Texture,
  type Container,
  type GraphicsContext,
} from 'pixi.js';
import { hexToPixel } from '../core/hex';
import { hexAtIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import type { MapState } from '../core/state';
import { hexSize } from './config';
import { mapEdgeNeighborIndex } from './geometry';
import { sliceDepthKey } from './relief';
import { TREE_ART_IDS, type TerrainArt } from './terrainArt';
import { createTerrainLayer, type TerrainLayer } from './terrainLayer';

/** Tessellates a Graphics context the way the renderer does; returns the vertex positions. */
function tessellate(context: GraphicsContext): number[] {
  const gpu = { geometryData: { vertices: [], uvs: [], indices: [] }, batches: [] };
  buildContextBatches(context, gpu as unknown as Parameters<typeof buildContextBatches>[1]);
  return gpu.geometryData.vertices;
}

/** The Graphics of a slice (always its first child). */
function graphicsOf(slice: Container): Graphics {
  return slice.children[0] as Graphics;
}

/** Tree sprites of a slice as [x, y] pairs. */
function spritesOf(slice: Container): number[][] {
  return slice.children.filter((c) => c instanceof Sprite).map((s) => [s.x, s.y]);
}

/** Everything painted for map row `r` (its back and front slice). */
function rowContent(layer: TerrainLayer, r: number): { vertices: number[]; sprites: number[][] } {
  const slices = [layer.rows[2 * r], layer.rows[2 * r + 1]];
  return {
    vertices: slices.flatMap((s) => tessellate(graphicsOf(s).context)),
    sprites: slices.flatMap(spritesOf),
  };
}

function allVertices(layer: TerrainLayer): number {
  return layer.rows.reduce((n, s) => n + tessellate(graphicsOf(s).context).length, 0);
}

function allSprites(layer: TerrainLayer): number {
  return layer.rows.reduce((n, s) => n + spritesOf(s).length, 0);
}

/** Stand-in tree art: every id loaded, all with a plain white texture. */
const FAKE_ART: TerrainArt = {
  trees: Object.fromEntries(
    TREE_ART_IDS.map((id) => [id, { texture: Texture.WHITE, anchorX: 0.5, anchorY: 1, scale: 1 }]),
  ),
};

/** First tile of `terrain` away from the map border; `test` can ask for more. */
function findTile(
  map: MapState,
  terrain: string,
  test: (i: number) => boolean = () => true,
): number {
  for (let i = 0; i < map.tiles.length; i++) {
    const row = Math.floor(i / map.width);
    const col = i % map.width;
    if (map.tiles[i] !== terrain || row < 3 || row > map.height - 4 || col < 2) continue;
    if (test(i)) return i;
  }
  return -1;
}

describe('createTerrainLayer', () => {
  // Builds two full 40 x 40 maps: give it time when the whole suite runs in parallel
  it(
    'builds a 40 x 40 map within the vertex budget (static, drawn once)',
    { timeout: 30_000 },
    () => {
      const { map } = generateMap(12345, { width: 40, height: 40 });
      for (const art of [undefined, FAKE_ART]) {
        const t0 = performance.now();
        const layer = createTerrainLayer(map, hexSize, art);
        const t1 = performance.now();
        const g = tessellate(layer.ground.context).length / 2;
        const d = allVertices(layer) / 2;
        const t2 = performance.now();
        console.info(
          `terrain 40x40 ${art ? 'with tree art' : 'without art'}: paint ${(t1 - t0).toFixed(1)} ms, ` +
            `tessellate ${(t2 - t1).toFixed(1)} ms, vertices ground ${g} + details ${d} = ${g + d}, ` +
            `sprites ${allSprites(layer)}`,
        );
        // Budget for a mid-range phone: the whole static terrain stays below about 450k vertices
        expect(g + d).toBeLessThan(450_000);
        expect(layer.rows).toHaveLength(80);
        if (!art) expect(allSprites(layer)).toBe(0);
        else expect(allSprites(layer)).toBeGreaterThan(1000);
      }
    },
  );

  it('is deterministic: the same map paints the same geometry and sprites', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const run = (art?: TerrainArt): unknown[] => {
      const layer = createTerrainLayer(map, hexSize, art);
      return [
        ...tessellate(layer.ground.context),
        ...layer.rows.flatMap((s) => [...tessellate(graphicsOf(s).context), ...spritesOf(s)]),
      ];
    };
    expect(run()).toEqual(run());
    expect(run(FAKE_ART)).toEqual(run(FAKE_ART));
  });

  it('slices carry the depth keys that sort them around the buildings of their row', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    layer.rows.forEach((s, i) => {
      expect(s.zIndex).toBe(sliceDepthKey(i));
      expect(s.cullable).toBe(true);
    });
  });

  it('without tree art the forests keep their code-drawn trees', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const row = Math.floor(findTile(map, 'forest') / map.width);
    expect(rowContent(layer, row).vertices.length).toBeGreaterThan(0);
    expect(allSprites(layer)).toBe(0);
  });

  it('footprints clear room only in the rows they touch, and can be undone', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    for (const art of [undefined, FAKE_ART]) {
      const layer = createTerrainLayer(map, hexSize, art);
      const index = findTile(map, 'forest');
      const hex = hexAtIndex(map, index);
      const row = Math.floor(index / map.width);
      const before = Array.from({ length: map.height }, (_, r) => rowContent(layer, r));
      layer.setFootprints([{ hex, rx: hexSize, ry: hexSize }]);
      const after = Array.from({ length: map.height }, (_, r) => rowContent(layer, r));
      // The tile's own trees made room; rows further away were not touched
      const trees = (c: { vertices: number[]; sprites: number[][] }): number =>
        art ? c.sprites.length : c.vertices.length;
      expect(trees(after[row]) + trees(after[row - 1]) + trees(after[row + 1])).toBeLessThan(
        trees(before[row]) + trees(before[row - 1]) + trees(before[row + 1]),
      );
      for (let r = 0; r < map.height; r++) {
        if (Math.abs(r - row) > 1) expect(after[r]).toEqual(before[r]);
      }
      // The same footprints again: nothing is repainted
      const instructions = layer.rows.map((s) => graphicsOf(s).context.instructions.slice());
      const children = layer.rows.map((s) => [...s.children]);
      layer.setFootprints([{ hex, rx: hexSize, ry: hexSize }]);
      layer.rows.forEach((s, i) => {
        expect(graphicsOf(s).context.instructions).toEqual(instructions[i]);
        expect(s.children).toEqual(children[i]);
      });
      // Removing the footprint brings the same trees back
      layer.setFootprints([]);
      for (let r = 0; r < map.height; r++) expect(rowContent(layer, r)).toEqual(before[r]);
    }
  });

  it('a clearing skips only the trunks inside it; trees around stay', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize, FAKE_ART);
    const index = findTile(map, 'forest');
    const hex = hexAtIndex(map, index);
    const center = hexToPixel(hex, hexSize);
    const rx = 0.5 * hexSize;
    const ry = 0.35 * hexSize;
    const inside = (p: number[]): boolean =>
      ((p[0] - center.x) / rx) ** 2 + ((p[1] - center.y) / ry) ** 2 <= 1;
    const before = layer.rows.flatMap(spritesOf);
    layer.setFootprints([{ hex, rx, ry }]);
    const after = layer.rows.flatMap(spritesOf);
    expect(after.some(inside)).toBe(false);
    expect(before.some(inside)).toBe(true);
    // Every tree outside the clearing is still there
    const outside = before.filter((p) => !inside(p));
    expect(after).toHaveLength(outside.length);
  });

  it('a unit footprint clears trees, shrubs and rocks but keeps the grass', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    // A meadow with only meadows around: tufts and flowers, nothing standing
    const index = findTile(map, 'plains', (i) => {
      const h = hexAtIndex(map, i);
      for (let e = 0; e < 6; e++) {
        const n = mapEdgeNeighborIndex(map, h, e);
        if (n < 0 || map.tiles[n] !== 'plains') return false;
      }
      return true;
    });
    expect(index).toBeGreaterThanOrEqual(0);
    const hex = hexAtIndex(map, index);
    const row = Math.floor(index / map.width);
    const layer = createTerrainLayer(map, hexSize, FAKE_ART);
    const before = rowContent(layer, row);
    layer.setFootprints([{ hex, rx: hexSize, ry: hexSize, kind: 'unit' }]);
    expect(rowContent(layer, row)).toEqual(before);
    layer.setFootprints([{ hex, rx: hexSize, ry: hexSize }]);
    expect(rowContent(layer, row).vertices.length).toBeLessThan(before.vertices.length);

    // In a forest the same unit footprint does clear the trees
    const forest = findTile(map, 'forest');
    const fhex = hexAtIndex(map, forest);
    const total = allSprites(layer);
    layer.setFootprints([{ hex: fhex, rx: 0.3 * hexSize, ry: 0.25 * hexSize, kind: 'unit' }]);
    expect(allSprites(layer)).toBeLessThan(total);
  });

  it('a building on a mountain keeps the massif (moved to the back) and gets a terrace', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const index = findTile(map, 'mountains');
    expect(index).toBeGreaterThanOrEqual(0);
    const row = Math.floor(index / map.width);
    const before = rowContent(layer, row).vertices;
    layer.setFootprints([{ hex: hexAtIndex(map, index), rx: 0.86 * hexSize, ry: 0.55 * hexSize }]);
    const after = rowContent(layer, row).vertices;
    expect(after).not.toEqual(before);
    // Still a mountain there (not cleared away like a tree)
    expect(after.length).toBeGreaterThan(before.length * 0.5);
  });

  it('trees keep off roads; the same roads again repaint nothing', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    for (const art of [undefined, FAKE_ART]) {
      const layer = createTerrainLayer(map, hexSize, art);
      const index = findTile(map, 'forest');
      const count = (): number => (art ? allSprites(layer) : allVertices(layer));
      const before = count();
      // A road through the forest tile, from its western to its eastern neighbor
      const roads = {
        segments: [
          [index - 1, index],
          [index, index + 1],
        ] as [number, number][],
        stubs: [],
      };
      layer.setRoads(roads);
      expect(count()).toBeLessThan(before);
      const instructions = layer.rows.map((s) => graphicsOf(s).context.instructions.slice());
      layer.setRoads(roads);
      layer.rows.forEach((s, i) =>
        expect(graphicsOf(s).context.instructions).toEqual(instructions[i]),
      );
      layer.setRoads({ segments: [], stubs: [] });
      expect(count()).toBe(before);
    }
  });

  it('unexplored tiles show no trees or mountains', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize, FAKE_ART);
    const all = allVertices(layer);
    const trees = allSprites(layer);
    layer.setExplored(map.tiles.map(() => false));
    expect(allVertices(layer)).toBe(0);
    expect(allSprites(layer)).toBe(0);
    layer.setExplored(map.tiles.map((_, i) => i < map.tiles.length / 2));
    const half = allVertices(layer);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(all);
    layer.setExplored(null);
    expect(allVertices(layer)).toBe(all);
    expect(allSprites(layer)).toBe(trees);
  });

  it('mines and quarries cut into their own slope; a quarry on plains has no cut', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const fp = { rx: 0.6 * hexSize, ry: 0.35 * hexSize };
    // Mountain: the mine keeps a massif (with its rock face), different from a plain building's
    const m = findTile(map, 'mountains');
    const mRow = Math.floor(m / map.width);
    const mHex = hexAtIndex(map, m);
    layer.setFootprints([{ hex: mHex, ...fp }]);
    const building = rowContent(layer, mRow).vertices;
    layer.setFootprints([{ hex: mHex, ...fp, kind: 'mineCut' }]);
    const mine = rowContent(layer, mRow).vertices;
    layer.setFootprints([{ hex: mHex, ...fp, kind: 'quarryCut' }]);
    const quarry = rowContent(layer, mRow).vertices;
    expect(mine).not.toEqual(building);
    expect(quarry).not.toEqual(mine);
    expect(mine.length).toBeGreaterThan(0);
    // Hills: the quarry's steps are drawn there too
    const h = findTile(map, 'hills');
    const hRow = Math.floor(h / map.width);
    layer.setFootprints([{ hex: hexAtIndex(map, h), ...fp }]);
    const terrace = rowContent(layer, hRow).vertices;
    layer.setFootprints([{ hex: hexAtIndex(map, h), ...fp, kind: 'quarryCut' }]);
    expect(rowContent(layer, hRow).vertices).not.toEqual(terrace);
    // Plains: a cut footprint only makes room, like any building
    const p = findTile(map, 'plains');
    const pRow = Math.floor(p / map.width);
    layer.setFootprints([{ hex: hexAtIndex(map, p), ...fp }]);
    const plain = rowContent(layer, pRow);
    layer.setFootprints([{ hex: hexAtIndex(map, p), ...fp, kind: 'quarryCut' }]);
    expect(rowContent(layer, pRow)).toEqual(plain);
  });

  it('a footprint centered off the tile center clears around that center', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize, FAKE_ART);
    const index = findTile(map, 'forest');
    const hex = hexAtIndex(map, index);
    const c = hexToPixel(hex, hexSize);
    const rx = 0.4 * hexSize;
    const ry = 0.3 * hexSize;
    const cx = 0.35 * hexSize;
    const inside = (p: number[]): boolean =>
      ((p[0] - c.x - cx) / rx) ** 2 + ((p[1] - c.y) / ry) ** 2 <= 1;
    const before = layer.rows.flatMap(spritesOf);
    layer.setFootprints([{ hex, rx, ry, cx }]);
    const after = layer.rows.flatMap(spritesOf);
    expect(before.some(inside)).toBe(true);
    expect(after.some(inside)).toBe(false);
    expect(after).toHaveLength(before.filter((p) => !inside(p)).length);
  });

  it('a field on hills keeps the hill: no terrace, only its shrubs, rocks and olives make room', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const h = findTile(map, 'hills');
    const hex = hexAtIndex(map, h);
    const row = Math.floor(h / map.width);
    const fp = { hex, rx: 0.88 * hexSize, ry: 0.88 * hexSize };
    for (const art of [undefined, FAKE_ART]) {
      const layer = createTerrainLayer(map, hexSize, art);
      const before = rowContent(layer, row);
      layer.setFootprints([{ ...fp, kind: 'field' }]);
      const field = rowContent(layer, row);
      layer.setFootprints([fp]);
      const building = rowContent(layer, row);
      // A plain building on hills adds its terrace; a field adds nothing, it only clears
      expect(building.vertices.length).toBeGreaterThan(field.vertices.length);
      expect(field.vertices.length).toBeLessThanOrEqual(before.vertices.length);
      if (art) expect(field.sprites.length).toBeLessThan(before.sprites.length);
    }
    // The grass strokes (decals) stay under a field, as under a unit's spot
    const layer = createTerrainLayer(map, hexSize, FAKE_ART);
    layer.setFootprints([{ ...fp, kind: 'field' }]);
    const withField = rowContent(layer, row).vertices.length;
    layer.setFootprints([{ ...fp, kind: 'unit' }]);
    // A field clears exactly what a unit's spot of the same size would: standing things only
    expect(rowContent(layer, row).vertices.length).toBe(withField);
  });
});
