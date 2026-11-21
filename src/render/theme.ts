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
  /** Player colors, index = PlayerId (0 = human, Tyrian purple) */
  playerColors: [0x6e3a8e, 0x2e6da4, 0xb23a30, 0xc9a227],
  /** Territory tint (alpha) and border (world px, alpha) */
  territoryTintAlpha: 0.12,
  territoryBorderWidth: 3,
  territoryBorderAlpha: 0.9,
  /** Roads: warm earth; width is a fraction of the hex size */
  roadColor: 0x8a6a44,
  roadWidthFactor: 0.22,
  /** Building plate: radius (fraction of hex size), light rim, icon size (fraction) */
  plateRadiusFactor: 0.62,
  plateRimColor: 0xf4e9d8,
  plateRimWidth: 1.5,
  iconSizeFactor: 0.75,
  /** Status badge (problems): ochre circle with a white "!" */
  badgeColor: 0xc2902a,
  badgeMarkColor: 0xffffff,
  badgeRadiusFactor: 0.24,
  /** Highlight of valid tiles: white fill + outline */
  highlightColor: 0xffffff,
  highlightFillAlpha: 0.28,
  highlightWidth: 2,
  /** Road preview: bronze-verdigris, a bit wider than roads */
  previewColor: 0x3e7d6b,
  previewWidthFactor: 0.3,
  previewDotRadiusFactor: 0.12,
} as const;
