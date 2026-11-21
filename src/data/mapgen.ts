// All numbers of the map generation (see docs/GAME_DESIGN.md, section 3).
// You can change them yourself: adjust a number, save, reload the game.
// If the map does not work out with these numbers, the generator retries up to
// `maxAttempts` times and then reports an error.

export const mapgenConfig = {
  /** Default map size in tiles (width x height). */
  width: 30,
  height: 30,

  /** The mainland keeps this many tiles of distance to the map edge (the edge itself is ocean). */
  edgeMargin: 2,
  /** Share of the mainland among ALL tiles (0.45 = 45 %). */
  mainlandShare: 0.45,

  /** How many islands there are (random between min and max). */
  islandCount: { min: 3, max: 6 },
  /** Size of an island in tiles (random between min and max). */
  islandSize: { min: 8, max: 20 },
  /** Minimum distance of an island to other land (tiles in between: value minus 1). */
  islandMinDistance: 3,
  /** Islands may come closer to the map edge than the mainland. */
  islandEdgeMargin: 1,

  /** Terrain shares on the mainland. Whatever is left over is plains. */
  mainlandTerrain: { mountains: 0.1, hills: 0.17, forest: 0.25 },
  /** Terrain shares on the islands: more hills and forest (an incentive to settle by ship). */
  islandTerrain: { mountains: 0.05, hills: 0.28, forest: 0.32 },

  /** Length of a mountain chain in tiles (random between min and max). */
  mountainChainLength: { min: 3, max: 6 },
  /** Hills preferably appear next to mountains: this much bonus on the hills score. */
  hillsNearMountainsBonus: 0.15,

  /** Size of the noise cells in tiles (approximately). Larger = bigger-scale shapes. */
  noiseCellSize: 6,
  /** How often the map is regenerated until all rules are met. */
  maxAttempts: 20,

  /** Shape of the mainland (fine tuning). */
  mainlandShape: {
    /** Elongation of the ellipse (ratio long/short axis), random between min and max. */
    elongation: { min: 1.3, max: 1.8 },
    /** Shift of the center away from the middle of the map (share of the map size), so one side of the sea stays free for islands. */
    centerShift: 0.2,
    /** How strongly the noise frays the coastline (0 = smooth ellipse). */
    noiseWeight: 0.5,
    /** How strongly chance alters individual tiles. */
    jitter: 0.15,
  },

  /** Seeds: at most this many characters are taken from `?seed=...`. */
  seedMaxLength: 40,
  /** Without a seed in the address, a random number from 0 up to (not including) this value is rolled. */
  randomSeedRange: 1_000_000,
} as const;
