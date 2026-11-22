// Goods of the game (see docs/GAME_DESIGN.md, section 4).
// Names live in i18n; here are only the types and the properties of each good.

export type GoodId =
  | 'wood'
  | 'stone'
  | 'grain'
  | 'fish'
  | 'olives'
  | 'grapes'
  | 'ore'
  | 'planks'
  | 'oil'
  | 'wine'
  | 'bronze'
  | 'drachmas';

/** An amount of goods (a cost, an input, an output or a change). Missing entries mean 0. */
export type Goods = Partial<Record<GoodId, number>>;

/** The full stock of a civilization: every good has an amount (0 = none). */
export type Stock = Record<GoodId, number>;

export interface GoodDef {
  /** raw = produced directly, processed = made from other goods, currency = money. */
  kind: 'raw' | 'processed' | 'currency';
  /** Does it count as food? (Residents eat fish or grain, both count the same.) */
  isFood: boolean;
  /** Symbol shown in the UI. */
  icon: string;
}

/** All goods in display order (resource bar, lists). */
export const GOOD_IDS: readonly GoodId[] = [
  'wood',
  'stone',
  'grain',
  'fish',
  'olives',
  'grapes',
  'ore',
  'planks',
  'oil',
  'wine',
  'bronze',
  'drachmas',
];

export const GOODS: Record<GoodId, GoodDef> = {
  wood: { kind: 'raw', isFood: false, icon: '🪵' },
  stone: { kind: 'raw', isFood: false, icon: '🪨' },
  // Grain is eaten directly, so it counts as food (like fish).
  grain: { kind: 'raw', isFood: true, icon: '🌾' },
  // Fish is eaten directly, so it counts as food.
  fish: { kind: 'raw', isFood: true, icon: '🐟' },
  olives: { kind: 'raw', isFood: false, icon: '🫒' },
  grapes: { kind: 'raw', isFood: false, icon: '🍇' },
  ore: { kind: 'raw', isFood: false, icon: '🌑' },
  planks: { kind: 'processed', isFood: false, icon: '🪜' },
  oil: { kind: 'processed', isFood: false, icon: '🏺' },
  wine: { kind: 'processed', isFood: false, icon: '🍷' },
  bronze: { kind: 'processed', isFood: false, icon: '🥉' },
  drachmas: { kind: 'currency', isFood: false, icon: '🪙' },
};
