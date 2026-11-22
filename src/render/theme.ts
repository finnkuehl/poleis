// Colors and font of the rendering (no balancing, looks only).
import type { TerrainId } from '../data/terrain';

export const theme = {
  /** Background beyond the map edge: a little darker than the open sea, close to the fog */
  background: 0x15394f,
  fontFamily: "Georgia, 'Times New Roman', serif",
  /**
   * Base fill color per terrain (bright Mediterranean palette, see docs/ART.md). Also used
   * by the tile info panel and the seed preview in the start menu.
   */
  terrainColors: {
    ocean: 0x1e5f8a,
    coast: 0x3fb3b8,
    plains: 0x9cc25a,
    forest: 0x5f8f3c,
    hills: 0xc6aa5c,
    mountains: 0x9a8e7e,
  } satisfies Record<TerrainId, number>,
  /** Symbols on the tiles: umbrella-pine canopy, hill shade, rock shade, snow */
  treeColor: 0x47662a,
  hillColor: 0x968842,
  mountainColor: 0x766c61,
  mountainPeakColor: 0xf8f7f1,
  /** Tile outlines: very faint ink lines between land tiles (none between land and water) */
  outlineColor: 0x1d2b36,
  outlineAlpha: 0.09,
  outlineWidth: 1,
  /** Outline where the terrain type changes (e.g. plains next to forest): a bit stronger */
  outlineChangeAlpha: 0.15,
  /** Outline between water tiles: almost invisible */
  outlineWaterAlpha: 0.05,
  /**
   * Painted terrain details (src/render/terrainLayer.ts). Sizes are fractions of the hex
   * size unless they say "px" (world px; a hex has a radius of 32 world px).
   */
  terrainPaint: {
    /** Per-tile brightness variation: +-5 % on land, +-2.5 % on water */
    landVariation: 0.05,
    waterVariation: 0.025,
    /** Some meadows turn golden: mix up to this share of the golden color into the meadow */
    plainsGoldenColor: 0xd2bf58,
    plainsGoldenMax: 0.55,
    /** Lighter sunny patch on meadows (chance per tile, color, alpha) */
    sunPatchChance: 0.55,
    sunPatchColor: 0xc8e07c,
    sunPatchAlpha: 0.35,
    /** Grass tufts (3 small blades) and tiny flowers on meadows */
    grassColor: 0x6a9437,
    grassAlpha: 0.9,
    hillGrassColor: 0x8a8f3e,
    flowerColors: [0xfbf7ea, 0xf3d34a, 0xd8483a, 0xb79ad8],
    /** Forest: share of cypresses among the trees (the rest are umbrella pines) */
    cypressShare: 0.4,
    pineDark: 0x47662a,
    pineLight: 0x76973a,
    pineHighlight: 0x9fba52,
    cypressDark: 0x284423,
    cypressLight: 0x406632,
    trunkColor: 0x5e3b22,
    /** Soft ground shadows of trees, hills and peaks (light comes from the upper left) */
    shadowColor: 0x1d2b36,
    shadowAlpha: 0.22,
    /** Hills: lit and shaded side of the rolling mounds (olive-ochre), small olive shrubs */
    moundLight: 0xd2c26d,
    /** Light grassy crest on the upper left of each mound */
    moundCrest: 0xe4d888,
    moundShade: 0x968842,
    shrubColor: 0x6f7d3a,
    shrubDark: 0x4a5a26,
    /** Mountains: small loose rocks on the ground */
    screeColor: 0x7f766b,
    /** Mountains: lit and shaded rock faces, snow and its cool shadow side */
    rockLight: 0xc4b9a6,
    rockShade: 0x766c61,
    snowColor: 0xf8f7f1,
    snowShade: 0xc6d1da,
    /** Beach on land tiles along the water: dry sand, wet sand at the waterline, pebbles below mountains */
    sandColor: 0xe8d29a,
    sandWetColor: 0xd3b878,
    pebbleColor: 0xc9bea6,
    /** Beach depth (main band, soft outer fringe) and how much its inner edge wobbles */
    beachDepth: 0.19,
    beachFringeDepth: 0.3,
    beachFringeAlpha: 0.45,
    beachWobble: 0.06,
    beachWetDepth: 0.05,
    beachWetAlpha: 0.8,
    /** Coastal water: lighter shallow band along the shore, white foam lines */
    shallowColor: 0x86dcd2,
    shallowAlpha: 0.32,
    shallowDepth: 0.4,
    foamColor: 0xffffff,
    foamAlpha: 0.8,
    foamWidth: 1.6,
    /** Foam line distance from the shore in px; second, broken wave line further out */
    foamInset: 1.8,
    foamOuterInset: 5.5,
    foamOuterAlpha: 0.45,
    /** Soft blend between turquoise coast and deep ocean */
    seaBlendAlpha: 0.12,
    /** Depth of each of the 3 blend bands (they stack, so the color fades in steps) */
    seaBlendDepths: [0.12, 0.24, 0.36],
    /** Waves on the open sea: lighter blue "~" strokes (chance per tile) */
    waveColor: 0x6aa3cc,
    waveAlpha: 0.55,
    waveWidth: 1.3,
    waveChance: 0.65,
    /** Small glints on coastal water */
    glintColor: 0xffffff,
    glintAlpha: 0.4,
  },
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
  territoryBorderAlpha: 1,
  /** The colored border runs this far (px) inside the territory, so two neighbors' borders sit side by side */
  territoryBorderInset: 2,
  /** Dark rim around the colored border (player color mixed with ink), extra width in px */
  territoryBorderRimMix: 0.5,
  territoryBorderRimExtra: 1.6,
  /** Thin light inner line (double-line look), px inside the territory */
  territoryInnerLineColor: 0xf4e9d8,
  territoryInnerLineWidth: 1.1,
  territoryInnerLineInset: 4.9,
  territoryInnerLineAlpha: 0.9,
  /** Roads: dirt road with a darker rim and a lighter worn center; width is a fraction of the hex size */
  roadColor: 0xa88150,
  roadWidthFactor: 0.22,
  roadRimColor: 0x6b4f30,
  /** Rim: extra width in px on top of the road width */
  roadRimExtra: 1.8,
  roadCenterColor: 0xd8bb85,
  /** Worn center line: fraction of the road width */
  roadCenterFactor: 0.36,
  /** Tiny stones along the road (light and dark), radius as a fraction of the road width */
  roadStoneColors: [0xe6ddc8, 0x7d6a52],
  roadStoneRadiusFactor: 0.13,
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
  /** Fog of war: unexplored tiles opaque dark sea-blue; explored but not visible tiles dimmed */
  fogHiddenColor: 0x15384f,
  fogDimColor: 0x0f2638,
  fogDimAlpha: 0.5,
  /** Unexplored tiles vary a little in brightness (+-) and carry faint wave strokes */
  fogVariation: 0.07,
  fogTextureColor: 0x2b5774,
  fogTextureAlpha: 0.5,
  fogTextureChance: 0.5,
  /** Feathered edge: bands on explored tiles next to unexplored ones (depths = fractions of the hex size) */
  fogFeatherDepths: [0.14, 0.27, 0.4],
  fogFeatherAlpha: 0.26,
  /** Softer edge where visible tiles meet dimmed ones (two stacked bands) */
  fogDimFeatherDepths: [0.1, 0.2],
  fogDimFeatherAlpha: 0.13,
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
  /** Dot where the unit gets to right now (turn 0): dark with a marble rim */
  orderDotRadiusFactor: 0.12,
  /** Sideways shift of flag and badge on the destination tile so both stay visible */
  orderDestOffsetFactor: 0.3,
} as const;
