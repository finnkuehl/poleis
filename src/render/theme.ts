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
  /**
   * Tile outlines: only a very light hint of the grid (for tapping), straight ink lines between
   * land tiles (none between land and water: the beach shows that edge)
   */
  outlineColor: 0x1d2b36,
  outlineAlpha: 0.04,
  outlineWidth: 1,
  /** Outline between water tiles: almost invisible */
  outlineWaterAlpha: 0.03,
  /**
   * Painted terrain details (src/render/terrainLayer.ts). Sizes are fractions of the hex
   * size unless they say "px" (world px; a hex has a radius of 32 world px).
   */
  terrainPaint: {
    /**
     * Per-tile brightness variation (+-5 % on land, +-2.5 % on water) and golden meadows: only
     * used by the small map preview in the start menu. The map itself has no per-tile shade.
     */
    landVariation: 0.05,
    waterVariation: 0.025,
    /** Some meadows turn golden: mix up to this share of the golden color into the meadow */
    plainsGoldenColor: 0xd2bf58,
    plainsGoldenMax: 0.55,
    /**
     * Where the terrain changes, the tile edge is a soft wavy curve instead of a straight hex
     * side. How far it bulges at most: between land types, between land and water, between
     * deep ocean and the turquoise coast.
     */
    landWave: 0.1,
    shoreWave: 0.13,
    seaWave: 0.16,
    /**
     * Large soft color washes that flow across tiles of the same terrain (no hex patchwork):
     * a smooth noise over the map decides where the land turns lighter (golden meadows,
     * sunlit glades) or darker (lush grass, deep shade). Washes per land / water tile, radius range,
     * noise scale (hex sizes per noise cell; larger = bigger regions), alpha of each of the 3
     * stacked bands at full strength, and the [light, dark] color per terrain.
     */
    washCount: 2,
    waterWashCount: 1,
    washRadiusMin: 0.45,
    washRadiusMax: 0.85,
    washNoiseScale: 4.5,
    washAlpha: 0.08,
    washColors: {
      ocean: [0x2b74a3, 0x174f78],
      coast: [0x63cfc6, 0x2f9fae],
      plains: [0xd6c45c, 0x7aa943],
      forest: [0x7ea545, 0x4a7530],
      hills: [0xdcc67a, 0xae9447],
      mountains: [0xb5aa98, 0x867b6d],
    } satisfies Record<TerrainId, readonly [number, number]>,
    /**
     * Color bleed where two land types meet: irregular tongues of the neighbor's color reach
     * into the tile, feathered in stacked translucent bands (max depth, bands, alpha of each)
     */
    bleedDepth: 0.3,
    bleedBands: 3,
    bleedAlpha: 0.13,
    /** How far each land type bleeds into its neighbors (share of bleedDepth) */
    bleedReach: {
      ocean: 1,
      coast: 1,
      plains: 1,
      forest: 1,
      hills: 1,
      mountains: 0.6,
    } satisfies Record<TerrainId, number>,
    /** Color a land type bleeds into its neighbors (mountains: light scree, not grey smoke) */
    bleedColors: {
      ocean: 0x1e5f8a,
      coast: 0x3fb3b8,
      plains: 0x9cc25a,
      forest: 0x5f8f3c,
      hills: 0xc6aa5c,
      mountains: 0xb9ad98,
    } satisfies Record<TerrainId, number>,
    /** Next to a forest, meadows and hills get a few smaller trees spilling over (chance per edge) */
    spillTreeChance: 0.55,
    spillTreeScale: 0.7,
    /** Next to hills, meadows get a low rolling mound now and then (chance per edge) */
    spillMoundChance: 0.35,
    /** Grass tufts (3 small blades) and tiny flowers on meadows */
    grassColor: 0x6a9437,
    grassAlpha: 0.9,
    hillGrassColor: 0x8a8f3e,
    flowerColors: [0xfbf7ea, 0xf3d34a, 0xd8483a, 0xb79ad8],
    /**
     * Forest drawn with the tree art (docs/ART.md "Forests", src/render/forest.ts): a dense wood
     * on a jittered lattice in map space, so the canopy runs on from one forest tile into the next.
     */
    forest: {
      /** Distance between neighboring trees (fraction of the hex size) and random shift (share of it) */
      spacing: 0.34,
      jitter: 0.36,
      /** Chance of a gap in the canopy; a smooth noise adds a few glades (extra gap chance there) */
      gapChance: 0.04,
      gladeChance: 0.45,
      /** How much the mix of species shifts from region to region (pine-rich vs oak-rich woods) */
      mixShift: 0.2,
      /** Umbrella pines dominate, holm oaks are the mass, the rest are cypresses (vertical accents) */
      pineShare: 0.44,
      oakShare: 0.4,
      /** Size change per tree (+-share) */
      scaleJitter: 0.15,
      /**
       * Toward open land (other terrain, water, map border) the wood thins out over this distance:
       * chance a tree stays right at the edge, share that become shrubs, size there
       */
      edgeZone: 0.45,
      edgeKeep: 0.4,
      edgeShrubShare: 0.55,
      edgeScale: 0.7,
      /** Trees keep this far from the beach */
      shoreMargin: 0.3,
      /** Crown radius of each kind at size 1 (fraction of the hex size), when no exact one is known */
      crown: { pine: 0.24, oak: 0.2, cypress: 0.07, shrub: 0.096, olive: 0.15 },
      /** Exact crown radius of every tree art file at size 1 (measured from the art, hex sizes) */
      treeCrowns: {
        pine1: 0.246,
        pine2: 0.27,
        pine3: 0.205,
        cypress1: 0.076,
        cypress2: 0.064,
        oak1: 0.205,
        oak2: 0.182,
        oak3: 0.217,
        shrub1: 0.1,
        shrub2: 0.076,
        shrub3: 0.111,
        olive1: 0.158,
        olive2: 0.141,
      },
      /** Brightness variation of the tree sprites (tint between this gray and white) */
      tintMin: 0xe6e6e6,
      /** Soft contact shadow under each tree sprite (0 = none: the tree art brings its own shadows) */
      spriteShadowAlpha: 0,
      /** Forest floor: dappled shade between the trunks and a few sunflecks (per tile) */
      floorShadeCount: 6,
      floorShadeAlpha: 0.2,
      sunfleckCount: 3,
      sunfleckColor: 0xa8c768,
      sunfleckAlpha: 0.22,
    },
    /** Forest without tree art (code-drawn trees): share of cypresses among the trees (the rest are umbrella pines) */
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
    /** Hills in the small start-menu map preview: lit and shaded side of a mound */
    moundLight: 0xd2c26d,
    moundShade: 0x968842,
    /**
     * Hills (docs/ART.md "Hills and mountains"): golden Mediterranean hill country. Broad mounds
     * fill each hill tile and sit across the edges toward neighboring hill tiles (and as
     * foothills toward mountains), so hill tiles join into one landscape. Sizes are fractions of
     * the hex size; a mound is `w` half wide and `h` high, its base reaches `depth` x w forward.
     */
    hills: {
      /** The big mound under the middle of the tile (a unit token sits on its gentle front slope) */
      centerW: 0.8,
      centerH: 0.34,
      /** Its base lies this far below the tile center */
      centerY: 0.3,
      /** A smaller mound at the back of the tile */
      backW: 0.6,
      backH: 0.28,
      /** A mound on most edges to a neighboring hill tile (straddles the edge; chance per edge) */
      edgeW: 0.62,
      edgeH: 0.28,
      edgeChance: 0.7,
      /** Foothill on an edge to a mountain tile, pushed this far into the hill tile */
      footW: 0.5,
      footH: 0.3,
      footShift: 0.22,
      /** Base depth (front bulge) as a share of the half width */
      depth: 0.34,
      /** Random size change (+-share) */
      jitter: 0.16,
      /** Mounds keep this far from the beach (wavy shore distance) */
      shoreMargin: 0.36,
      /** Lit color of the mounds (the shading texture darkens it to the lower right): golden, green-gold, warm */
      tones: [0xe2c771, 0xd8c76d, 0xe6c26c],
      /** Light sunlit rim along the upper left of each crest */
      crestColor: 0xf6e7a8,
      crestAlpha: 0.6,
      /** Soft cast shadow to the lower right of each mound */
      shadowAlpha: 0.13,
      /** Dry-grass strokes on the slopes (count per tile, light and dark straw, alpha) */
      grassCount: 9,
      grassLight: 0xe9d184,
      grassDark: 0x9c8644,
      grassAlpha: 0.75,
      /** Dark green maquis shrubs (count range per tile) */
      shrubMin: 2,
      shrubMax: 5,
      /** A few olive trees (chance of 1 and of a second one per tile): trunk, silvery canopy */
      oliveChance: 0.6,
      oliveSecondChance: 0.3,
      oliveTrunk: 0x5c4a3a,
      oliveDark: 0x5f6c3c,
      oliveColor: 0x87975a,
      oliveLight: 0xb2bd82,
      /** Pale limestone rocks (max per tile): lit top, shaded side */
      rockMax: 2,
      rockLight: 0xe0d8c6,
      rockShade: 0xa99f8b,
      /** Nothing tall in this radius around the tile center: a unit token stands there */
      tokenClear: 0.3,
    },
    /** Maquis shrubs on hills (dark base, lit top-left) */
    shrubColor: 0x6f7d3a,
    shrubDark: 0x4a5a26,
    /** Mountains: small loose rocks on the ground */
    screeColor: 0x7f766b,
    /** Mountains: lit and shaded rock (also the start-menu preview and the rocks in the surf), snow */
    rockLight: 0xc4b9a6,
    rockShade: 0x766c61,
    snowColor: 0xf8f7f1,
    snowShade: 0xc6d1da,
    /**
     * Mountains (docs/ART.md "Hills and mountains"): one big faceted massif per tile. Toward a
     * neighboring mountain tile its slopes run up to a shared saddle on the edge (ridges from
     * peak to peak), where three mountain tiles meet the corner is raised too, so tiles join into
     * ranges. Heights are fractions of the hex size.
     */
    mountains: {
      /**
       * Peak height range (a smooth noise over the map makes whole ranges higher or lower); on a
       * tile with a building the massif is lower and sits at the back
       */
      peakMin: 0.82,
      peakMax: 1.32,
      buildingPeak: 0.82,
      /** Saddle height on an edge between two mountain tiles, and of a corner inside a range */
      saddleMin: 0.5,
      saddleMax: 0.72,
      cornerMin: 0.42,
      cornerMax: 0.62,
      /** Foot of the massif toward other terrain: share of the way from the center to the edge */
      footInset: 0.84,
      /** ... toward water (keeps the pebble beach and cliffs free) */
      shoreInset: 0.62,
      /** Shoulders halfway up every slope: random extra height (+-) and sideways shift */
      shoulderBump: 0.12,
      shoulderShift: 0.1,
      /** Rock faces by how much sun they get: lit, middle, shaded, dark (light from the upper left) */
      faceColors: [0xdcd0b9, 0xbaac95, 0x958873, 0x766a5c],
      /** Sunlight (0..1) above which a face gets the lit, middle and shaded color */
      faceLevels: [0.7, 0.5, 0.3],
      /** Thin darker strata lines across the faces */
      strataColor: 0x5a5046,
      strataAlpha: 0.3,
      /** Snow above this share of the peak height (peaks lower than snowMinPeak get none) */
      snowLine: 0.8,
      snowMinPeak: 1.0,
      /** Soft shadow of the massif on the ground to the lower right */
      shadowAlpha: 0.22,
      /** Scree at the foot (stones per tile) and a few boulders */
      screeCount: 9,
      boulderMax: 3,
    },
    /**
     * Terrace under a building on hills or mountains: the flat ground is cut into the slope; along
     * the middle of the front of the building's footprint runs a low earth bank with grass hanging
     * over it (hills) or a dry-stone wall (mountains), highest in the middle and running out into
     * the slope at both ends (share of the front it spans, height, how ragged its top is).
     */
    /**
     * Mines and quarries on hills and mountains dig into the terrain's own slope (docs/ART.md
     * "Mines and quarries dig into the real slope"). The geometry is a contract with the art
     * (tools/art/buildings/mine.py SLOPE_FACE_*, quarry.py SLOPE_STEPS), in the art's world units
     * around the tile center: a / b = the two ground axes of the art, z = height.
     */
    cuts: {
      /** Art world units -> canvas units (the art's iso scale) and the height factor of z */
      artScale: 1.08146,
      artHeight: 1.225,
      /** Mine: one vertical rock face on the plane b = faceB along a faceA, faceH high */
      faceB: -15,
      faceA: [-25, 5],
      faceH: 28,
      /** ... running out into the slope over this many units beyond both ends (a, toward +b) */
      faceRunOut: [12, 4],
      /** Quarry: [a from, a to, front face b, top runs back to b, top height z] per step */
      steps: [
        [-35, 5, -10, -20, 9],
        [-35, -5, -20, -30, 18],
        [-35, -15, -30, -40, 27],
      ],
      /** On a cut tile the peak stands this far behind the tile center (hex sizes), this much lower */
      peakBack: 0.5,
      peakFactor: 0.9,
      /** Hills: the cut face is dusty limestone, the step tops hill gold */
      hillFace: 0xe2d8c2,
      hillEnd: 0xb7ab92,
      hillTop: 0xd8c27a,
      /** Mountains: the cut face is the massif's middle rock, ends in shade, tops lit */
      rockFace: 0xbaac95,
      rockEnd: 0x958873,
      rockTop: 0xd6cab3,
      /** Light lip along the top edge of every cut face; faint tool marks on the faces */
      lipColor: 0xf1ead9,
      markColor: 0x6a6054,
      markAlpha: 0.25,
    },
    terrace: {
      earthSpan: 0.6,
      stoneSpan: 0.56,
      height: 0.075,
      stoneHeight: 0.065,
      jitter: 0.018,
      earthColor: 0xb0904f,
      earthShade: 0x82683a,
      grassColor: 0xd6bd6a,
      stoneColor: 0xa89e8c,
      stoneLight: 0xc4baa8,
      stoneShade: 0x857b6b,
      jointColor: 0x6a6153,
      /** Soft shadow on the ground at the foot of the bank */
      shadowAlpha: 0.18,
      /**
       * Behind a building on hills the slope rises: a broad hill crest whose foot lies this share
       * of the footprint behind the center, as wide as this share of the footprint, this high
       */
      backFoot: 0.62,
      backWidth: 0.95,
      backHeight: 0.3,
      /** Footprints taller than this (fraction of the hex size) are fields: no crest behind them */
      fieldRy: 0.75,
    },
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
    /**
     * Small cliffs where hills or mountains meet water below them (south-facing shores): a rock
     * face hanging into the water (height, chance on hills; mountains always), its lit, middle
     * and shaded rock facets, cracks and the light top lip. No beach on those edges.
     */
    cliffHeight: 0.28,
    hillCliffChance: 0.5,
    cliffColor: 0xc9b493,
    cliffMid: 0xa8957a,
    cliffShade: 0x7f6e5b,
    cliffCrackColor: 0x54483b,
    cliffLipColor: 0xece2c8,
    /** Rocks in the surf just off the shore (chance per shore edge), with a foam ring */
    shoreRockChance: 0.3,
    shoreRockFoamAlpha: 0.55,
    /** Boulders lying on sandy beaches (chance per beach edge) */
    beachRockChance: 0.25,
    /** A few small boats on coastal water (chance per coastal tile): hull, sail, mast */
    boatChance: 0.06,
    boatHullColor: 0x6b4426,
    boatHullLight: 0x9a6a3c,
    boatSailColor: 0xf7f0de,
    boatSailShade: 0xd6ccb4,
    boatMastColor: 0x4a3020,
    boatWakeAlpha: 0.5,
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
  /**
   * Drawn art (SVG files in public/assets, see docs/ART.md and src/render/art.ts).
   * Diorama art: the scale reference of the canvas (208 units, once the base's width) as a share
   * of the hex width. Buildings and units share one human scale.
   */
  buildingArtWidthFactor: 0.92,
  unitArtWidthFactor: 0.62,
  /**
   * Old flat art (any other canvas, e.g. 96 x 96): drawn centered on the colored plate / token,
   * its canvas width as a share of the plate / token diameter.
   */
  buildingFlatArtFactor: 1.1,
  unitFlatArtFactor: 0.8,
  /**
   * Largest texture an SVG is rasterized to (px, longer side). The game picks the size that stays
   * sharp at maximum zoom (up to this cap); lower = less memory, softer art when zoomed in.
   */
  // 320 keeps the full art set at about 27 MB of texture memory on DPR-2 phones (384 ≈ 38 MB)
  // and only softens the art slightly at the very closest zoom.
  artMaxTexturePx: 320,
  /**
   * City-level rings around a drawn building: a flat ellipse on the ground around the city
   * center (its size: ground.ringRadius), this many px further out. The Metropolis' second ring
   * is drawn this many px outside the first one (an inner ring would be hidden by the building).
   */
  cityArtRingGap: 1,
  cityArtSecondRingGap: 1.5,
  /**
   * Status badge of a drawn building: offset from the tile center (fractions of hex size).
   * Just right of the building at about half its height: higher up it would sit on the building
   * above and cover that city's resident count.
   */
  badgeArtOffsetXFactor: 0.66,
  badgeArtOffsetYFactor: -0.12,
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
  /**
   * Ground under and between the buildings (src/render/groundLayer.ts, docs/ART.md "Grounded
   * buildings"). Sizes are fractions of the hex size unless they say "px" (world px; a hex has
   * a radius of 32 world px). rx / ry are half width / half height of a patch on the screen.
   */
  ground: {
    /** Soft edge: every patch is painted again, grown by these factors with these alphas */
    featherGrow: [1.3, 1.14],
    featherAlpha: [0.2, 0.34],
    /** Alpha of the patch itself (a little terrain shimmers through) */
    coreAlpha: 0.9,
    /** How much the outline of a patch wobbles (share of its radius) */
    wobble: 0.1,
    /**
     * The terrain keeps its trees and rocks out of a building's patch, grown by this factor
     * (fields: the whole tile; woodcutter: its own smaller footprint, see clearing)
     */
    footprintGrow: 1.05,
    /** Small details (pebbles, litter, rubble) lie in the outer part of a patch, from this share of its radius */
    detailRing: 0.62,
    /** Patches stay this far inside the tile edge, and this far inside a water edge (beach) */
    edgeMargin: 0.05,
    shoreMargin: 0.3,
    /**
     * Ground radius of each building's art in WORLD units of the art (measured by the art
     * agents): the patch under it is this circle on the art's 2:1 ground, grown by artPatchGrow.
     * Fields: the small yard under their building. Not listed: the kind's default size below.
     */
    artGroundRadius: {
      house: 52,
      farm: 48,
      woodcutter: 54,
      storehouse: 53,
      temple: 54,
      cityCenter: 55,
      sawmill: 55,
      bakery: 50,
      oilPress: 54,
      winery: 54,
      smelter: 50,
      quarry: 56,
      mine: 56,
      barracks: 52,
      marketplace: 56,
      wonder: 56,
      borderTower: 40,
      vineyard: 34,
      oliveGrove: 16,
    },
    /** Where that circle lies if not under the tile center (world units a, b of the art) */
    artGroundCenter: {
      borderTower: [0, -4],
      vineyard: [0, -2],
      oliveGrove: [-22, -34],
    },
    /** One world unit of the art as a share of the hex size (1.08 canvas units x 0.92 hex widths / 208) */
    artWorldUnit: 0.008275,
    /** The patch is the art's ground circle grown by this much (sideways, front-back): a ring of ground */
    artPatchGrow: [1.25, 1.6],
    /**
     * Patches on hills and mountains (not fields): ground cut into the slope instead of a disc.
     * The terrain draws a terrace bank (hills) or dry-stone edge (mountains) along the middle of
     * the footprint's front; the patch's front follows it, back and sides fade into the slope.
     */
    slope: {
      /** Back and sides: this share of the plains size, this ragged (share of the radius) */
      scale: 0.72,
      wobble: 0.28,
      /** The front follows the bank: this share of the footprint ... */
      bankShare: 0.95,
      /** ... over this share of the front half (like the terrace), fading out over this much beside it */
      frontSpan: 0.58,
      frontFade: 0.1,
      /** Strong soft fade into the slope: back and sides grown by these factors, alphas; core alpha */
      featherGrow: [1.5, 1.25],
      featherAlpha: [0.08, 0.16],
      coreAlpha: 0.6,
      /** Hills: trodden dry grass and dusty earth, only a little lighter than the hill gold */
      hillColor: 0xdabf7a,
      dustColor: 0xc2a46c,
      /** Quarry on hills: a dusty tan apron with tan gravel */
      hillStoneColor: 0xd2b885,
      hillGravelColors: [0xbca47a, 0xe2d2a8],
      /** Mountains: scree grey-brown like the foot of the massif */
      mountainColor: 0xb2a58e,
      /** Small details (rubble, stones) lie mostly near the building: within this share, from this ring */
      detailShare: 0.85,
      detailRing: 0.3,
      /**
       * Mine and quarry on a slope: the terrain cuts the rock face / terraces, the art shows the
       * works; the ground is only a narrow ledge of scree and gravel in front of them (half width,
       * half height, how far in front of the tile center; fractions of the hex size)
       */
      ledge: { rx: 0.42, ry: 0.1, y: 0.16 },
    },
    /** Under a unit's token on a tile without a building, the terrain makes room (half axes) */
    unitFootprint: { rx: 0.3, ry: 0.18 },
    /**
     * A unit on a tile with a building stands at the front of the tile (this far below the tile
     * center, fraction of the hex size), so the building stays visible
     */
    unitFrontOffset: 0.4,
    /** Soft ground shadow under drawn tokens (offset to the lower right, alpha) */
    unitShadowAlpha: 0.22,
    /** Soft shadows of small things on the ground (stumps, shrubs, walls, hedges) */
    shadowColor: 0x1d2b36,
    shadowAlpha: 0.24,
    /** Trodden-earth yard: earth, sunlit worn center, darker worn spots, pebbles, trade litter */
    yard: {
      rx: 0.86,
      ry: 0.58,
      color: 0xc9ab76,
      lightColor: 0xdcc497,
      lightAlpha: 0.55,
      wornColor: 0xa88c5c,
      wornAlpha: 0.35,
      pebbleColors: [0xefe6d2, 0x93826a],
      sawdustColor: 0xecd9a0,
      sootColor: 0x4d4640,
      sootAlpha: 0.4,
      strawColor: 0xe2c25e,
    },
    /** Paved plaza (an iso octagon) on a trodden-earth apron, with flagstone joints */
    plaza: {
      rx: 0.8,
      ry: 0.42,
      /** The earth apron around the paving, as a factor of the plaza size (sideways, up/down) */
      apronGrow: 1.1,
      apronGrowY: 1.5,
      stoneColor: 0xe6dfcf,
      /** Some flagstones lighter or warmer (chance per stone, alpha) */
      stoneLight: 0xf4efe4,
      stoneWarm: 0xd8ccb2,
      tintChance: 0.25,
      tintAlpha: 0.8,
      /** Curb band: the paving shrinks to this share inside the curb */
      curbColor: 0xb5a88f,
      curbShare: 0.93,
      jointColor: 0xa8997e,
      jointAlpha: 0.55,
      /** Joint line width in px */
      jointWidth: 0.55,
      jointSpacing: 0.12,
      /** Sunlit upper left of the paving */
      sunColor: 0xffffff,
      sunAlpha: 0.16,
    },
    /** Woodcutter: forest floor with leaf litter, stumps and wood chips; a small footprint */
    clearing: {
      rx: 0.78,
      ry: 0.52,
      footprintRx: 0.6,
      footprintRy: 0.4,
      color: 0x8f8649,
      darkColor: 0x6a6436,
      sunColor: 0xb7ab66,
      leafColors: [0xa8693a, 0xc9a24a, 0x7d8a3c],
      stumpTop: 0xdcb57c,
      stumpRing: 0xb08550,
      stumpSide: 0x6b4426,
      chipColor: 0xe8cf98,
    },
    /** Quarry: a stony apron with rubble and gravel (the art draws the rock face, blocks, crane) */
    quarry: {
      rx: 0.86,
      ry: 0.58,
      // Dusty stone tan close to the hills' gold, so the apron does not read as a grey disc
      color: 0xc4ad7f,
      rubbleCount: 9,
      rubbleColors: [0xa39a8a, 0xdcd4c2, 0x7d7466],
      gravelCount: 16,
      gravelColors: [0xb39d72, 0xd9caa2],
    },
    /** Mine: a rock apron with scattered stones, some ore-red (the art draws the outcrop, heap, cart) */
    mine: {
      rx: 0.84,
      ry: 0.56,
      color: 0x9d9282,
      stoneCount: 10,
      stoneColors: [0x9a5a3a, 0x857a6c, 0xbab0a0, 0x857a6c, 0xbab0a0],
    },
    /**
     * Fields (farm, vineyard, olive grove) over most of their tile, painted into the land: an
     * organic outline (never the hex edge), a soft rim toward the terrain, irregular parcels.
     */
    field: {
      /** Outline: inset from a hex edge without a field neighbor (toward water: shoreMargin) */
      inset: 0.15,
      /** ... varying by up to this much, so the rim is never straight */
      insetJitter: 0.08,
      /** How round the outline is: 0 = hex shape, 1 = circle (bowed edges, rounded corners) */
      roundness: 0.7,
      /** The middle of each open edge bows out by up to this much (corners stay rounded) */
      edgeBulge: 0.09,
      /** ... but the outline always stays at least this far inside the hex edge */
      minInset: 0.04,
      /** Corners blend between the rules of their two edges over this many degrees */
      cornerBlend: 12,
      /** Two neighboring fields meet on a wavy line up to this far off the hex edge, waving this much */
      joinOffset: 0.14,
      joinWave: 0.08,
      /** Soft rim outside the outline: band width, alphas and how much meadow is mixed in (inner to outer) */
      featherWidth: 0.05,
      featherAlpha: [0.5, 0.3, 0.14],
      featherMeadowMix: [0.35, 0.55, 0.75],
      /** Just inside the outline the crops fade toward the meadow: band width, alphas, meadow mix */
      rimWidth: 0.07,
      rimAlpha: [0.42, 0.2],
      rimMeadowMix: 0.6,
      /** Ground under the crops (shows in the balks and along the rim): crop color + this much meadow */
      baseMeadowMix: 0.45,
      /** Grass balk between the parcels; parcels stay this far inside the outline */
      gap: 0.07,
      parcelInset: 0.03,
      /** Gentle warp of the parcel grid (bowed edges, shifted corners) */
      warp: 0.05,
      /** Small trodden yard in the middle (fallback size; normally from artGroundRadius) */
      yard: { rx: 0.4, ry: 0.27 },
      /**
       * The yard of a farm or vineyard is its building's ground circle grown only this much
       * (sideways, front-back): the fields begin right at the farmstead
       */
      yardGrow: [1, 1.1],
      /** Farmstead layout: the cut lines pass within this much of the middle */
      farmsteadJitter: 0.04,
      /** Chance of 3 parcels (back and one side as one) and of 5 (the front one split again) */
      farmsteadThree: 0.2,
      farmsteadFive: 0.3,
      /** ... that second cut lies this far out from the middle */
      farmsteadOuterCut: 0.42,
      /** Furrows: spacing, darker line and lighter ridge (width px, alpha, shade factor), faint */
      furrowSpacing: 0.085,
      furrowWidth: 1,
      furrowAlpha: 0.32,
      furrowShade: 0.86,
      ridgeWidth: 0.8,
      ridgeAlpha: 0.28,
      ridgeLight: 1.07,
      /** Furrows and rows end this far before the parcel edge (and taper out) */
      rowEndMargin: 0.06,
      /** Farm parcels: golden wheat tones */
      wheatColors: [0xdcb04a, 0xe6c058, 0xd0a240, 0xe2b850],
      /** Now and then a parcel is freshly ploughed earth or young green wheat (chance per parcel each) */
      ploughedColor: 0xb48d5a,
      ploughedChance: 0.1,
      youngColor: 0xbcbb52,
      youngChance: 0.1,
      /** Ragged rim, chances per outline step: crop tufts spill out, meadow tufts poke in */
      tuftChance: 0.7,
      meadowTuftChance: 0.5,
      cropTuftColor: 0xd4ae4e,
      meadowTuftColor: 0x6a9437,
      /** Weeds in the crops near the rim: poppies and dark leaves (chance per outline step) */
      weedChance: 0.18,
      weedColors: [0xd8483a, 0x4f6b2c],
      /** Per open edge of the tile: chance of a shrub, a short hedge piece, a dry-stone wall piece */
      shrubChance: 0.28,
      hedgeChance: 0.18,
      wallChance: 0.14,
      shrubDark: 0x4a5a26,
      shrubLight: 0x6f8a36,
      /** Where two fields meet their crops reach this far past the shared line (no gap) */
      joinOverlap: 0.02,
      /** ... and some get a thin, soft grass balk on it (chance, width, alpha, meadow mix) */
      balkChance: 0.5,
      balkWidth: 0.045,
      balkAlpha: 0.6,
      balkMeadowMix: 0.35,
      /** The terrain keeps this much of the tile (as a share of the hex size) free for the field */
      footprint: 0.88,
    },
    /** Vineyard: dry soil, rows of vines along the iso axes */
    vineyard: {
      soilColors: [0xc7a466, 0xbb9a5e],
      rowSpacing: 0.15,
      /** Darker soil strip under every row (width px, alpha), faint */
      rowColor: 0xa48250,
      rowWidth: 2.2,
      rowAlpha: 0.38,
      vineStep: 0.1,
      vineRx: 0.042,
      vineRy: 0.03,
      vineDark: 0x4a5a26,
      vineLight: 0x6f8a36,
      grapeColor: 0x6a2a4a,
      grapeChance: 0.3,
    },
    /** Olive grove: dry-grass parcels with the soft field rim (the art draws the olive trees) */
    orchard: {
      grassColors: [0xd6c67e, 0xcbb972],
    },
    /** Low dry-stone walls and hedges on the field rims and where fields meet */
    wall: {
      /** Chance that the boundary of two fields gets a hedge or wall piece */
      joinChance: 0.45,
      /** Share of hedges (the rest are stone walls) */
      hedgeShare: 0.5,
      stoneColors: [0xd9d0bd, 0xb7ac96],
      stoneSize: 0.034,
      stoneStep: 0.062,
      hedgeColor: 0x4f6b2c,
      hedgeLight: 0x7a9640,
      hedgeWidth: 0.085,
    },
    /**
     * Fishery: a sandy yard under the hut and its props. The hut, jetty and boat are one drawn
     * scene per water direction (fishery.e0-e5.svg); the hut stands at the shoreline.
     */
    fishery: {
      /** Elliptical yard: at least ~0.34 x the hex size in every direction (45 art units) */
      rx: 0.44,
      ry: 0.32,
      color: 0xdcc58f,
      /** The yard's center sits this share of the apothem toward the jetty edge (under the hut) */
      yardShift: 0.64,
      /** The terrain keeps its grass and flowers off the yard grown by this much (the rest stays) */
      footprintGrow: 1.15,
      /** Around the yard: sparse beach grass, shells and pebbles (how many, colors) */
      litterCount: 9,
      beachGrass: 0xb3b46a,
      shellColors: [0xf6eee0, 0xecd3c4],
      pebbleColor: 0xb9ad95,
    },
    /**
     * City-level rings on the ground around a building (no base any more): half width of the
     * ring (fraction of the hex size) and its height share (0.5 = flat 2:1 like the art's ground).
     */
    ringRadius: 0.7,
    ringFlatten: 0.5,
  },
} as const;
