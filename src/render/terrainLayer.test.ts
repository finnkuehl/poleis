import { describe, expect, it } from 'vitest';
import { buildContextBatches, Graphics, type GraphicsContext } from 'pixi.js';
import { generateMap } from '../core/mapgen';
import { hexSize } from './config';
import { paintTerrain } from './terrainLayer';

/** Tessellates a Graphics context the way the renderer does; returns vertex and index counts. */
function tessellate(context: GraphicsContext): { vertices: number; indices: number } {
  const gpu = { geometryData: { vertices: [], uvs: [], indices: [] }, batches: [] };
  buildContextBatches(context, gpu as unknown as Parameters<typeof buildContextBatches>[1]);
  return {
    vertices: gpu.geometryData.vertices.length / 2,
    indices: gpu.geometryData.indices.length,
  };
}

describe('paintTerrain', () => {
  it('builds a 40 x 40 map within the vertex budget (static, drawn once)', () => {
    const { map } = generateMap(12345, { width: 40, height: 40 });
    const ground = new Graphics();
    const details = new Graphics();
    const t0 = performance.now();
    paintTerrain(map, hexSize, ground, details);
    const t1 = performance.now();
    const g = tessellate(ground.context);
    const d = tessellate(details.context);
    const t2 = performance.now();
    const total = g.vertices + d.vertices;
    console.info(
      `terrain 40x40: paint ${(t1 - t0).toFixed(1)} ms, tessellate ${(t2 - t1).toFixed(1)} ms, ` +
        `vertices ground ${g.vertices} + details ${d.vertices} = ${total}, ` +
        `instructions ${ground.context.instructions.length + details.context.instructions.length}`,
    );
    // Budget for a mid-range phone: the whole static terrain stays well below 400k vertices
    expect(total).toBeLessThan(400_000);
    expect(total).toBeGreaterThan(0);
  });

  it('is deterministic: the same map paints the same geometry', () => {
    const { map } = generateMap(7, { width: 24, height: 24 });
    const run = (): number[] => {
      const ground = new Graphics();
      const details = new Graphics();
      paintTerrain(map, hexSize, ground, details);
      const gpu = { geometryData: { vertices: [], uvs: [], indices: [] }, batches: [] };
      buildContextBatches(
        details.context,
        gpu as unknown as Parameters<typeof buildContextBatches>[1],
      );
      return gpu.geometryData.vertices;
    };
    expect(run()).toEqual(run());
  });
});
