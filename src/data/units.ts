// Units (see docs/GAME_DESIGN.md, section 7).
// To rebalance: change the numbers below, save, reload the game.
// Only numbers and rules live here, no texts (names come from i18n).

import type { CityLevel } from './buildings';
import type { Goods } from './goods';

export type UnitId =
  'scout' | 'settler' | 'spearman' | 'archer' | 'hoplite' | 'horseman' | 'transport' | 'trireme';

/** Where a unit moves: land units on land tiles, ships on water tiles. */
export type UnitDomain = 'land' | 'sea';

/** The building types that train units. */
export type TrainingBuildingId = 'barracks' | 'harbor' | 'cityCenter';

export interface UnitDef {
  /** 'land' = walks on land (never enters water on its own), 'sea' = sails on coast and ocean. */
  domain: UnitDomain;
  /** Which building trains the unit (land units: barracks, ships: harbor, settlers: city center). */
  trainedIn: TrainingBuildingId;
  /** How many land units a ship carries (0 = carries nobody). */
  capacity: number;
  /** Can the unit attack ships? (Trireme and archers; melee land units cannot.) */
  attacksShips: boolean;
  /** How hard the unit hits. */
  attack: number;
  /** How well the unit holds against an attack. */
  defense: number;
  /** Hit points at full health. */
  hp: number;
  /** Movement points per turn (plains cost 1, forest/hills 2). */
  movement: number;
  /** Attack range in tiles. 0 = cannot attack. */
  range: number;
  /** Goods paid when the unit is ordered. */
  cost: Goods;
  /** Residents taken from the city when ordering (settlers: 2). */
  residents: number;
  /** City level needed to train it. */
  minLevel: CityLevel;
  /** Can the unit take over an enemy city by standing on its center? */
  canCapture: boolean;
  /** Symbol shown in the UI. */
  icon: string;
}

/** All units in display order (menus, lists). */
export const UNIT_IDS: readonly UnitId[] = [
  'scout',
  'settler',
  'spearman',
  'archer',
  'hoplite',
  'horseman',
  'transport',
  'trireme',
];

export const UNITS: Record<UnitId, UnitDef> = {
  // Fast and weak: explores the map.
  scout: {
    domain: 'land',
    trainedIn: 'barracks',
    capacity: 0,
    attacksShips: false,
    attack: 1,
    defense: 1,
    hp: 5,
    movement: 3,
    range: 1,
    cost: { planks: 2, drachmas: 5 },
    residents: 0,
    minLevel: 'settlement',
    canCapture: true,
    icon: '🧭',
  },
  // Founds a new city. Cannot attack and cannot capture cities.
  settler: {
    domain: 'land',
    trainedIn: 'cityCenter',
    capacity: 0,
    attacksShips: false,
    attack: 0,
    defense: 1,
    hp: 5,
    movement: 1,
    range: 0,
    cost: { grain: 4, planks: 4 },
    residents: 2,
    minLevel: 'settlement',
    canCapture: false,
    icon: '🏕️',
  },
  // Cheap all-rounder.
  spearman: {
    domain: 'land',
    trainedIn: 'barracks',
    capacity: 0,
    attacksShips: false,
    attack: 2,
    defense: 2,
    hp: 10,
    movement: 1,
    range: 1,
    cost: { planks: 2, bronze: 1 },
    residents: 0,
    minLevel: 'settlement',
    canCapture: true,
    icon: '⚔️',
  },
  // Shoots from 2 tiles away.
  archer: {
    domain: 'land',
    trainedIn: 'barracks',
    capacity: 0,
    attacksShips: true,
    attack: 2,
    defense: 1,
    hp: 8,
    movement: 1,
    range: 2,
    cost: { planks: 3, bronze: 1 },
    residents: 0,
    minLevel: 'settlement',
    canCapture: true,
    icon: '🏹',
  },
  // Heavy defender.
  hoplite: {
    domain: 'land',
    trainedIn: 'barracks',
    capacity: 0,
    attacksShips: false,
    attack: 2,
    defense: 3,
    hp: 12,
    movement: 1,
    range: 1,
    cost: { planks: 1, bronze: 3 },
    residents: 0,
    minLevel: 'polis',
    canCapture: true,
    icon: '🛡️',
  },
  // Fast attacker.
  horseman: {
    domain: 'land',
    trainedIn: 'barracks',
    capacity: 0,
    attacksShips: false,
    attack: 3,
    defense: 1,
    hp: 10,
    movement: 3,
    range: 1,
    cost: { bronze: 2, grain: 4 },
    residents: 0,
    minLevel: 'metropolis',
    canCapture: true,
    icon: '🐎',
  },
  // Carries up to 2 land units over the water (this is how settlers reach islands). Cannot attack.
  transport: {
    domain: 'sea',
    trainedIn: 'harbor',
    capacity: 2,
    attacksShips: false,
    attack: 0,
    defense: 1,
    hp: 8,
    movement: 3,
    range: 0,
    cost: { planks: 6 },
    residents: 0,
    minLevel: 'polis',
    canCapture: false,
    icon: '⛵',
  },
  // Warship: attacks ships and land units on the tiles next to it. Never captures cities.
  trireme: {
    domain: 'sea',
    trainedIn: 'harbor',
    capacity: 0,
    attacksShips: true,
    attack: 3,
    defense: 2,
    hp: 12,
    movement: 3,
    range: 1,
    cost: { planks: 8, bronze: 2 },
    residents: 0,
    minLevel: 'metropolis',
    canCapture: false,
    icon: '🚣',
  },
};
