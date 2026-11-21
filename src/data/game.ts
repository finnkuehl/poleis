// Game setup: civilizations, map sizes and the default game settings (docs/GAME_DESIGN.md, section 10).

// The AI civilizations. With fewer AIs than civilizations, the seed picks which ones play.
export const CIV_IDS = ['athens', 'sparta', 'corinth'] as const;
export type CivId = (typeof CIV_IDS)[number];

// Map sizes in tiles (the start menu offers these three).
export const MAP_SIZES = {
  small: { width: 24, height: 24 },
  normal: { width: 30, height: 30 },
  large: { width: 40, height: 40 },
} as const;
export type MapSize = keyof typeof MAP_SIZES;

// The settings of one game (chosen in the start menu).
export interface GameSettingsData {
  // Number of AI civilizations (0-3).
  aiCount: number;
  mapSize: MapSize;
  // Which ways to win are switched on.
  victory: { points: boolean; wonder: boolean; conquest: boolean };
  // Number of turns of a game, shown as "Turn X / 120".
  turnLimit: number;
  // Name of the player's civilization ('' = the default name).
  playerName: string;
  // Color of the player (index 0-3 into the player colors; 0 = Tyrian purple).
  playerColor: number;
}

export const gameConfig = {
  defaultSettings: {
    // 0 = no AI: used by tests and test mode (the start menu proposes `menuDefaultAiCount`).
    aiCount: 0,
    mapSize: 'normal',
    victory: { points: true, wonder: true, conquest: true },
    turnLimit: 120,
    playerName: '',
    playerColor: 0,
  } as GameSettingsData,
  // Number of AI civilizations the start menu proposes.
  menuDefaultAiCount: 2,
  // The most AI civilizations in one game.
  maxAiCount: 3,
  // Number of selectable player colors.
  playerColorCount: 4,
} as const;
