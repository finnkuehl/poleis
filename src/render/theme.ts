// Colors and font of the rendering (no balancing, looks only).
import type { TerrainId } from '../data/terrain';

export const theme = {
  /** Background: slightly darker than the ocean */
  background: 0x15384a,
  fontFamily: "Georgia, 'Times New Roman', serif",
  /** Fill color per terrain (Mediterranean palette) */
  terrainColors: {
    ocean: 0x1f4e63,
    coast: 0x3d8ea3,
    plains: 0xa9b665,
    forest: 0x4f7a3a,
    hills: 0xc2a36b,
    mountains: 0x8a8178,
  } satisfies Record<TerrainId, number>,
  /** Symbols on the tiles */
  treeColor: 0x2c5a26,
  hillColor: 0x7a5a30,
  mountainColor: 0x5e574f,
  mountainPeakColor: 0xffffff,
  /** Outline of the tiles: dark, translucent */
  outlineColor: 0x0b1f2a,
  outlineAlpha: 0.35,
  outlineWidth: 1,
  /** Selection: white outline + light fill */
  selectionColor: 0xffffff,
  selectionWidth: 3,
  selectionFillAlpha: 0.15,
} as const;
