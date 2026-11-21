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
  /** Selection: double outline (dark outer + white inner) so it stands out on any tile and on white highlights */
  selectionOuterColor: 0x1d2b36,
  selectionOuterWidth: 5,
  selectionColor: 0xffffff,
  selectionWidth: 2,
  selectionFillAlpha: 0.15,
  /** Player colors, index = PlayerId (0 = human purple, 1 = red, 2 = blue, 3 = gold) */
  playerColors: [0x6e3a8e, 0xb23a30, 0x2e6da4, 0xc9a227],
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
  /** Paused building: grey badge with a white pause sign */
  pausedBadgeColor: 0x8a8f94,
  /** City-level rings: inner gold ring (Metropolis) inset and width in px */
  cityInnerRingInset: 4,
  cityInnerRingWidth: 1.5,
  /** Resident count label under the city center */
  residentsSizeFactor: 0.42,
  residentsStrokeColor: 0x1d2b36,
  /** Highlight of valid tiles: white fill + outline */
  highlightColor: 0xffffff,
  highlightFillAlpha: 0.28,
  highlightWidth: 2,
  /** Road preview: bronze-verdigris, a bit wider than roads */
  previewColor: 0x3e7d6b,
  previewWidthFactor: 0.3,
  previewDotRadiusFactor: 0.12,
  /** Fog of war: unexplored tiles opaque; explored but not visible tiles dimmed */
  fogHiddenColor: 0x0d1b22,
  fogDimColor: 0x0d1b22,
  fogDimAlpha: 0.5,
  /** Unit token: radius (fraction of hex size), rim, icon size (fraction) */
  unitRadiusFactor: 0.5,
  unitRimColor: 0xf4e9d8,
  unitRimWidth: 1.5,
  unitIconSizeFactor: 0.62,
  /** Ghost token while dragging a unit: opacity and size relative to the normal token */
  dragGhostAlpha: 0.7,
  dragGhostScale: 1.25,
  /** Unit that is done for the turn (own units only) */
  unitDoneAlpha: 0.6,
  /** HP bar under the token: size (fraction of hex size), background, colors by HP share */
  hpBarWidthFactor: 0.8,
  hpBarHeightFactor: 0.14,
  hpBarBackColor: 0x1d2b36,
  hpBarGoodColor: 0x4caf50,
  hpBarMidColor: 0xc2902a,
  hpBarLowColor: 0xd6453a,
  /** Token moves up (fraction of hex size) when a building stands on the same tile */
  unitOnBuildingOffsetFactor: 0.38,
  /** Attack targets: red outline + light red fill */
  attackColor: 0xd6453a,
  attackWidth: 3,
  attackFillAlpha: 0.2,
  /** Move-order paths: marble line, dark under-stroke, number badge (sizes are fractions of the hex size) */
  orderMarbleColor: 0xf4e9d8,
  orderDarkColor: 0x1d2b36,
  /** Faint path of a unit that is not selected */
  orderFaintWidthFactor: 0.1,
  orderFaintAlpha: 0.45,
  orderFaintFlagAlpha: 0.7,
  /** Active path (selected unit / destination preview) */
  orderActiveWidthFactor: 0.16,
  orderActiveAlpha: 0.9,
  orderUnderStrokeExtraFactor: 0.08,
  orderUnderStrokeAlpha: 0.35,
  /** Flag: pole height and pennant width/height */
  orderFlagHeightFactor: 0.5,
  orderFlagPennantWidthFactor: 0.28,
  orderFlagPennantHeightFactor: 0.22,
  /** Turn-number badge and the dot for a stop reached this turn */
  orderBadgeRadiusFactor: 0.3,
  orderBadgeRimWidth: 1.5,
  orderBadgeTextColor: 0xffffff,
  orderDotRadiusFactor: 0.09,
  /** Sideways shift of flag and badge on the destination tile so both stay visible */
  orderDestOffsetFactor: 0.3,
} as const;
