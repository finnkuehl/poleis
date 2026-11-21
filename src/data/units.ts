// Units (see docs/GAME_DESIGN.md, section 7).
// To rebalance: change the numbers below, save, reload the game.
// Only numbers and rules live here, no texts (names come from i18n).

import type { CityLevel } from './buildings';
import type { Goods } from './goods';

// Ships (transport ship, trireme) follow in milestone M6.
export type UnitId = 'scout' | 'settler' | 'spearman' | 'archer' | 'hoplite' | 'horseman';

export interface UnitDef {
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
  /** Goods paid when the unit is ordered in the barracks. */
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
];

export const UNITS: Record<UnitId, UnitDef> = {
  // Fast and weak: explores the map.
  scout: {
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
    attack: 0,
    defense: 1,
    hp: 5,
    movement: 1,
    range: 0,
    cost: { bread: 4, planks: 4 },
    residents: 2,
    minLevel: 'settlement',
    canCapture: false,
    icon: '🏕️',
  },
  // Cheap all-rounder.
  spearman: {
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
};
