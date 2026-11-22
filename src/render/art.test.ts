import { describe, expect, it } from 'vitest';
import type { Texture } from 'pixi.js';
import { loadTerrainArt, NO_ART, treePlacement } from './art';
import { artPlacement } from './artLayout';
import { hexSize } from './config';
import { TREE_ART_IDS } from './terrainArt';

/** A tree file: a canvas larger than 256 with the trunk foot at (128, 176). */
const PINE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 320 256" data-anchor="128 176"></svg>';

/** Stand-in for a rasterized texture (only its width is read). */
function fakeTexture(width: number): Texture {
  return { width } as unknown as Texture;
}

describe('terrain art', () => {
  it('no art at all: the terrain draws its own trees', () => {
    expect(NO_ART.terrain.trees).toEqual({});
  });

  it("places a tree with its trunk foot on the spot, at the buildings' world scale", () => {
    const fit = treePlacement(PINE);
    expect(fit).not.toBeNull();
    const building = artPlacement('building', { x: 0, y: 0, width: 256, height: 256 }, hexSize);
    expect(fit?.placement.anchorX).toBeCloseTo((128 + 32) / 320);
    expect(fit?.placement.anchorY).toBeCloseTo(176 / 256);
    expect(fit?.placement.scale).toBeCloseTo(building.scale);
    expect(treePlacement('not an svg')).toBeNull();
    // No anchor on another canvas: not usable as a tree
    expect(treePlacement('<svg viewBox="0 0 96 96"></svg>')).toBeNull();
  });

  it('leaves missing and broken files out, without failing', async () => {
    const none = await loadTerrainArt(
      2,
      async () => null,
      async () => fakeTexture(320),
    );
    expect(none.terrain.trees).toEqual({});
    expect(none.missing).toHaveLength(TREE_ART_IDS.length);

    const throwing = await loadTerrainArt(
      2,
      async () => {
        throw new Error('offline');
      },
      async () => fakeTexture(320),
    );
    expect(throwing.terrain.trees).toEqual({});
  });

  it('loads the files that exist', async () => {
    const files: Record<string, string> = { pine1: PINE, oak2: PINE, shrub1: '<html>404</html>' };
    const sizes: number[] = [];
    const result = await loadTerrainArt(
      2,
      async (url) => files[url.replace(/^.*\/terrain\/(.*)\.svg$/, '$1')] ?? null,
      async (_svg, _vb, sizePx) => {
        sizes.push(sizePx);
        return fakeTexture(sizePx);
      },
    );
    expect(Object.keys(result.terrain.trees).sort()).toEqual(['oak2', 'pine1']);
    const pine = result.terrain.trees.pine1;
    expect(pine?.anchorX).toBeCloseTo((128 + 32) / 320);
    expect(pine?.anchorY).toBeCloseTo(176 / 256);
    // World width of the canvas / texture width
    const fit = treePlacement(PINE);
    expect(pine?.scale).toBeCloseTo((fit?.placement.width ?? 0) / sizes[0]);
    expect(result.missing).toHaveLength(TREE_ART_IDS.length - 2);
  });
});
