// Buildings (see docs/GAME_DESIGN.md, section 5).
// To rebalance: change costs, workers, inputs and outputs below.

import type { Goods } from './goods';
import type { TerrainId } from './terrain';

export type BuildingId =
  | 'cityCenter'
  | 'storehouse'
  | 'borderTower'
  | 'barracks'
  | 'harbor'
  | 'house'
  | 'woodcutter'
  | 'quarry'
  | 'farm'
  | 'fishery'
  | 'sawmill'
  | 'bakery'
  | 'oliveGrove'
  | 'oilPress'
  | 'mine'
  | 'smelter'
  | 'vineyard'
  | 'winery'
  | 'marketplace'
  | 'temple'
  | 'wonder';

/** City levels (see cityLevels.ts). */
export type CityLevel = 'settlement' | 'polis' | 'metropolis';

/** Build-menu group AND worker priority (food first, then raw materials, then processing). */
export type BuildingCategory = 'city' | 'food' | 'raw' | 'processing';

/**
 * One way to place a building: the tile's terrain must be in `on`.
 * If `nextTo` is set, at least one neighboring tile must have one of those terrains.
 */
export interface PlacementOption {
  on: readonly TerrainId[];
  nextTo?: readonly TerrainId[];
}

export interface BuildingDef {
  category: BuildingCategory;
  /** Any one of these options is enough. */
  placement: readonly PlacementOption[];
  /** Goods paid once when building. */
  cost: Goods;
  /** Workers needed to produce. */
  workers: number;
  /** Goods consumed per turn. */
  inputs: Goods;
  /** Goods produced per turn. */
  outputs: Goods;
  /** Residents the building houses. */
  housing: number;
  /** Connection point for roads (city center, storehouse, harbor). */
  isStorage: boolean;
  /** Territory claimed around the building (0 = claims nothing). */
  territoryRadius: number;
  /** City level needed to build it. */
  minLevel: CityLevel;
  /** false = the player cannot build it (city center: placed at game start / by settlers). */
  playerCanBuild: boolean;
  icon: string;
}

/** All buildings in build-menu order. */
export const BUILDING_IDS: readonly BuildingId[] = [
  'cityCenter',
  'storehouse',
  'borderTower',
  'barracks',
  'harbor',
  'house',
  'woodcutter',
  'quarry',
  'farm',
  'fishery',
  'sawmill',
  'bakery',
  'oliveGrove',
  'oilPress',
  'mine',
  'smelter',
  'vineyard',
  'winery',
  'marketplace',
  'temple',
  'wonder',
];

const onPlains: readonly PlacementOption[] = [{ on: ['plains'] }];

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // Start building: storage, +4 housing, claims radius 2. Cannot be built by the player.
  // Feeds a little by itself (1 bread per turn, no workers), so a city never gets stuck.
  cityCenter: {
    category: 'city',
    placement: onPlains,
    cost: {},
    workers: 0,
    inputs: {},
    outputs: { bread: 1 },
    housing: 4,
    isStorage: true,
    territoryRadius: 2,
    minLevel: 'settlement',
    playerCanBuild: false,
    icon: '🏛️',
  },
  // Extra connection point for roads.
  storehouse: {
    category: 'city',
    placement: onPlains,
    cost: { wood: 4, stone: 2 },
    workers: 0,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: true,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '📦',
  },
  // Claims radius 2 around itself (only unclaimed tiles), so the city can grow outwards.
  borderTower: {
    category: 'city',
    placement: [{ on: ['plains', 'hills'] }],
    cost: { wood: 2, stone: 4 },
    workers: 0,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: false,
    territoryRadius: 2,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🗼',
  },
  // Trains land units (also settlers); the unit appears next turn.
  barracks: {
    category: 'city',
    placement: onPlains,
    cost: { planks: 6, stone: 4 },
    workers: 0,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🏰',
  },
  // Plains next to coastal water. Trains ships; the ship appears next turn on a free water tile
  // next to the harbor. Also a road connection point, like a storehouse.
  harbor: {
    category: 'city',
    placement: [{ on: ['plains'], nextTo: ['coast'] }],
    cost: { planks: 8, stone: 4 },
    workers: 1,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: true,
    territoryRadius: 0,
    minLevel: 'polis',
    playerCanBuild: true,
    icon: '⚓',
  },
  // +6 housing.
  house: {
    category: 'city',
    placement: onPlains,
    cost: { wood: 3 },
    workers: 0,
    inputs: {},
    outputs: {},
    housing: 6,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🏠',
  },
  // On forest, or on plains/hills next to forest: +2 wood per turn.
  woodcutter: {
    category: 'raw',
    placement: [{ on: ['forest'] }, { on: ['plains', 'hills'], nextTo: ['forest'] }],
    cost: { wood: 2 },
    workers: 1,
    inputs: {},
    outputs: { wood: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🪓',
  },
  // On hills or mountains, or on plains next to hills/mountains: +2 stone per turn.
  quarry: {
    category: 'raw',
    placement: [{ on: ['hills', 'mountains'] }, { on: ['plains'], nextTo: ['hills', 'mountains'] }],
    cost: { wood: 3 },
    workers: 1,
    inputs: {},
    outputs: { stone: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '⛏️',
  },
  // +3 grain per turn, needs 2 workers.
  farm: {
    category: 'food',
    placement: onPlains,
    cost: { wood: 3 },
    workers: 2,
    inputs: {},
    outputs: { grain: 3 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🚜',
  },
  // Plains next to coastal water: +2 fish per turn.
  fishery: {
    category: 'food',
    placement: [{ on: ['plains'], nextTo: ['coast'] }],
    cost: { wood: 3 },
    workers: 1,
    inputs: {},
    outputs: { fish: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🎣',
  },
  // 2 wood -> 2 planks per turn.
  sawmill: {
    category: 'processing',
    placement: onPlains,
    cost: { wood: 4, stone: 2 },
    workers: 1,
    inputs: { wood: 2 },
    outputs: { planks: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🪚',
  },
  // 2 grain -> 3 bread per turn.
  bakery: {
    category: 'food',
    placement: onPlains,
    cost: { planks: 3, stone: 2 },
    workers: 1,
    inputs: { grain: 2 },
    outputs: { bread: 3 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🥖',
  },
  // Plains or hills: +2 olives per turn.
  oliveGrove: {
    category: 'raw',
    placement: [{ on: ['plains', 'hills'] }],
    cost: { planks: 4 },
    workers: 1,
    inputs: {},
    outputs: { olives: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🌳',
  },
  // 2 olives -> 2 oil per turn.
  oilPress: {
    category: 'processing',
    placement: onPlains,
    cost: { planks: 4, stone: 3 },
    workers: 1,
    inputs: { olives: 2 },
    outputs: { oil: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '⚙️',
  },
  // Only on mountains: +2 ore per turn, needs 2 workers.
  mine: {
    category: 'raw',
    placement: [{ on: ['mountains'] }],
    cost: { wood: 5, stone: 3 },
    workers: 2,
    inputs: {},
    outputs: { ore: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '⚒️',
  },
  // 2 ore + 1 wood -> 1 bronze per turn.
  smelter: {
    category: 'processing',
    placement: onPlains,
    cost: { planks: 2, stone: 4 },
    workers: 1,
    inputs: { ore: 2, wood: 1 },
    outputs: { bronze: 1 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'settlement',
    playerCanBuild: true,
    icon: '🔥',
  },
  // Polis: hills only: +2 grapes per turn.
  vineyard: {
    category: 'raw',
    placement: [{ on: ['hills'] }],
    cost: { planks: 4, stone: 2 },
    workers: 1,
    inputs: {},
    outputs: { grapes: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'polis',
    playerCanBuild: true,
    icon: '🍇',
  },
  // Polis: 2 grapes -> 2 wine per turn.
  winery: {
    category: 'processing',
    placement: onPlains,
    cost: { planks: 4, stone: 4 },
    workers: 1,
    inputs: { grapes: 2 },
    outputs: { wine: 2 },
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'polis',
    playerCanBuild: true,
    icon: '🛢️',
  },
  // Polis: no production; while connected and staffed, goods can be traded for drachmas.
  marketplace: {
    category: 'city',
    placement: onPlains,
    cost: { planks: 6, stone: 6 },
    workers: 1,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'polis',
    playerCanBuild: true,
    icon: '⚖️',
  },
  // Polis: no workers, no production (victory points come in M5).
  temple: {
    category: 'city',
    placement: [{ on: ['plains', 'hills'] }],
    cost: { stone: 10, oil: 4 },
    workers: 0,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'polis',
    playerCanBuild: true,
    icon: '🔱',
  },
  // World wonder (victory rules in victory.ts): the whole cost is paid when placing. It is built
  // over `wonderConfig.buildTurns` working turns and needs its full crew and a road connection
  // for each of them. A completed wonder needs no workers any more.
  wonder: {
    category: 'city',
    placement: onPlains,
    cost: { stone: 40, planks: 20, bronze: 20, wine: 10 },
    workers: 4,
    inputs: {},
    outputs: {},
    housing: 0,
    isStorage: false,
    territoryRadius: 0,
    minLevel: 'metropolis',
    playerCanBuild: true,
    icon: '🗿',
  },
};
