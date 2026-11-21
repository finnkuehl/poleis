// AI civilizations (docs/GAME_DESIGN.md, section 9).

import type { CivId } from './game';

export type Personality = 'merchant' | 'warrior' | 'builder';

// The personality of each AI civilization.
export const AI_CIVS: Record<CivId, { personality: Personality }> = {
  athens: { personality: 'merchant' },
  sparta: { personality: 'warrior' },
  corinth: { personality: 'builder' },
};

export const aiConfig = {
  // No AI civilization attacks anyone before this turn (peace time).
  peaceUntilTurn: 15,
} as const;
