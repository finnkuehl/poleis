import { describe, expect, it } from 'vitest';
import { buildContextBatches, Graphics, type GraphicsContext } from 'pixi.js';
import { hexAtIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { hexSize } from './config';
import type { MapState } from '../core/state';
import { rowDepthKey } from './relief';
import { createTerrainLayer, type TerrainLayer } from './terrainLayer';

/** Tessellates a Graphics context the way the renderer does; returns the vertex positions. */
function tessellate(context: GraphicsContext): number[] {
  const gpu = { geometryData: { vertices: [], uvs: [], indices: [] }, batches: [] };
  buildContextBatches(context, gpu as unknown as Parameters<typeof buildContextBatches>[1]);
  return gpu.geometryData.vertices;
}

function rows(layer: TerrainLayer): readonly Graphics[] {
  return layer.rows;
}

describe('createTerrainLayer', () => {
  it('builds a 40 x 40 map within the vertex budget (static, drawn once)', () => {
    const { map } = generateMap(12345, { width: 40, height: 40 });
    const t0 = performance.now();
    const layer = createTerrainLayer(map, hexSize);
    const t1 = performance.now();
    const g = tessellate(layer.ground.context).length / 2;
    let d = 0;
    let instructions = layer.ground.context.instructions.length;
    for (const row of rows(layer)) {
      d += tessellate(row.context).length / 2;
      instructions += row.context.instructions.length;
    }
    const t2 = performance.now();
    console.info(
      `terrain 40x40: paint ${(t1 - t0).toFixed(1)} ms, tessellate ${(t2 - t1).toFixed(1)} ms, ` +
        `vertices ground ${g} + details ${d} = ${g + d}, instructions ${instructions}`,
    );
    // Budget for a mid-range phone: the whole static terrain stays below about 450k vertices
    expect(g + d).toBeLessThan(450_000);
    expect(g + d).toBeGreaterThan(0);
    expect(rows(layer)).toHaveLength(40);
  });

  it('is deterministic: the same map paints the same geometry', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const run = (): number[] => {
      const layer = createTerrainLayer(map, hexSize);
      return [
        ...tessellate(layer.ground.context),
        ...rows(layer).flatMap((r) => tessellate(r.context)),
      ];
    };
    expect(run()).toEqual(run());
  });

  it('footprints clear room only in the rows they touch, and can be undone', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const before = rows(layer).map((r) => tessellate(r.context));
    // A forest tile in the middle of the map: its trees make room for a building
    let index = -1;
    for (let i = 0; i < map.tiles.length; i++) {
      const row = Math.floor(i / map.width);
      if (map.tiles[i] === 'forest' && row > 2 && row < map.height - 3) {
        index = i;
        break;
      }
    }
    expect(index).toBeGreaterThanOrEqual(0);
    const hex = hexAtIndex(map, index);
    const row = Math.floor(index / map.width);
    const contexts = rows(layer).map((r) => r.context);
    layer.setFootprints([{ hex, rx: hexSize, ry: hexSize }]);
    const after = rows(layer).map((r) => tessellate(r.context));
    // The tile's own row lost its trees; rows further away were not even repainted
    expect(after[row].length).toBeLessThan(before[row].length);
    for (let r = 0; r < map.height; r++) {
      if (Math.abs(r - row) > 1) expect(after[r]).toEqual(before[r]);
    }
    expect(rows(layer).map((r) => r.context)).toEqual(contexts);

    // The same footprints again: nothing is repainted
    const instructions = rows(layer).map((r) => r.context.instructions.slice());
    layer.setFootprints([{ hex, rx: hexSize, ry: hexSize }]);
    rows(layer).forEach((r, i) => expect(r.context.instructions).toEqual(instructions[i]));

    // Removing the footprint brings the same trees back
    layer.setFootprints([]);
    expect(rows(layer).map((r) => tessellate(r.context))).toEqual(before);
  });

  /** First tile of `terrain` away from the map border (row 3 .. height - 4). */
  function findTile(map: MapState, terrain: string): number {
    for (let i = 0; i < map.tiles.length; i++) {
      const row = Math.floor(i / map.width);
      const col = i % map.width;
      if (map.tiles[i] === terrain && row > 2 && row < map.height - 3 && col > 1) return i;
    }
    return -1;
  }

  it('rows carry the depth key that sorts them between the building rows', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    rows(layer).forEach((g, r) => expect(g.zIndex).toBe(rowDepthKey(r)));
  });

  it('a building on a mountain keeps the massif (moved to the back) and gets a terrace', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const index = findTile(map, 'mountains');
    expect(index).toBeGreaterThanOrEqual(0);
    const row = Math.floor(index / map.width);
    const before = tessellate(rows(layer)[row].context);
    layer.setFootprints([{ hex: hexAtIndex(map, index), rx: 0.86 * hexSize, ry: 0.55 * hexSize }]);
    const after = tessellate(rows(layer)[row].context);
    expect(after).not.toEqual(before);
    // Still a mountain there (not cleared away like a tree)
    expect(after.length).toBeGreaterThan(before.length * 0.5);
  });

  it('trees keep off roads; the same roads again repaint nothing', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const index = findTile(map, 'forest');
    const row = Math.floor(index / map.width);
    const before = tessellate(rows(layer)[row].context).length;
    const roads = { segments: [] as [number, number][], stubs: [index] };
    // A road through the forest tile, from its western to its eastern neighbor
    const west = index - 1;
    const east = index + 1;
    roads.segments.push([west, index], [index, east]);
    layer.setRoads(roads);
    const withRoad = tessellate(rows(layer)[row].context).length;
    expect(withRoad).toBeLessThan(before);
    const instructions = rows(layer).map((r) => r.context.instructions.slice());
    layer.setRoads(roads);
    rows(layer).forEach((r, i) => expect(r.context.instructions).toEqual(instructions[i]));
    layer.setRoads({ segments: [], stubs: [] });
    expect(tessellate(rows(layer)[row].context).length).toBe(before);
  });

  it('unexplored tiles show no trees or mountains', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const layer = createTerrainLayer(map, hexSize);
    const total = (): number => rows(layer).reduce((n, r) => n + tessellate(r.context).length, 0);
    const all = total();
    layer.setExplored(map.tiles.map(() => false));
    expect(total()).toBe(0);
    layer.setExplored(map.tiles.map((_, i) => i < map.tiles.length / 2));
    const half = total();
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(all);
    layer.setExplored(null);
    expect(total()).toBe(all);
  });
});
