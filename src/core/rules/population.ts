// Population: eating, needs, level-up supply, growth/hunger and taxes (docs/GAME_DESIGN.md §6).

import {
  CITY_LEVEL_DEFS,
  GOODS,
  populationConfig,
  type CityLevel,
  type GoodId,
  type Goods,
  type Stock,
} from '../../data';
import type { TurnReport } from './production';
import type { GameState, PlayerId } from '../state';
import { advanceCheck } from './advance';
import { housing } from './workers';

export interface CityReport {
  cityId: number;
  residentsBefore: number;
  residentsAfter: number;
  foodNeeded: number;
  foodEaten: Goods;
  fed: boolean;
  /** Food + all needs of the current level covered. */
  needsMet: boolean;
  needsConsumed: Goods;
  taxes: number;
}

export interface CityStats {
  residents: number;
  housing: number;
  foodPerTurn: number;
  needs: { good: GoodId; amount: number; inStock: boolean }[];
  /** Production per turn vs. need for the next level's supply good (null at the highest level). */
  supply: { good: GoodId; made: number; needed: number; ok: boolean } | null;
  /** Residents that move in per turn if the city is fed and has room (incl. the needs bonus). */
  growthPerTurn: number;
  /** Assumes needs are met if they are in stock. */
  taxPerTurn: number;
}

function stockOf(state: GameState, player: PlayerId): Stock {
  const p = state.players.find((x) => x.id === player);
  if (!p) throw new Error(`Unknown player ${player}`);
  return p.goods;
}

function foodNeeded(residents: number): number {
  return Math.ceil(residents / populationConfig.residentsPerFood);
}

/** Residents per turn: base growth, +bonus if the level has needs and they are all met. */
export function growthFor(level: CityLevel, needsMet: boolean): number {
  const hasNeeds = CITY_LEVEL_DEFS[level].needs.length > 0;
  return (
    populationConfig.growthPerTurn[level] +
    (hasNeeds && needsMet ? populationConfig.growthBonusNeedsMet : 0)
  );
}

function taxFor(residents: number, bonus: boolean): number {
  const base = Math.floor(residents / populationConfig.residentsPerTax);
  return bonus ? Math.floor(base * (1 + populationConfig.taxBonus)) : base;
}

/** Runs the population step for all cities of the player (mutates goods and cities). */
export function runPopulation(state: GameState, player: PlayerId): CityReport[] {
  const stock = stockOf(state, player);
  const reports: CityReport[] = [];
  const cities = state.cities.filter((c) => c.owner === player).sort((a, b) => a.id - b.id);
  for (const city of cities) {
    const before = city.residents;
    // 1. Food.
    const needed = foodNeeded(before);
    let left = needed;
    const foodEaten: Goods = {};
    for (const good of populationConfig.foodOrder) {
      const eat = Math.min(stock[good], left);
      if (eat > 0) {
        stock[good] -= eat;
        foodEaten[good] = eat;
        left -= eat;
      }
    }
    const fed = left === 0;

    // 2. Needs of the current level: only fully covered needs are consumed.
    const needsConsumed: Goods = {};
    let allNeeds = true;
    for (const need of CITY_LEVEL_DEFS[city.level].needs) {
      const amount = Math.ceil(before / need.residentsPer);
      if (stock[need.good] >= amount) {
        stock[need.good] -= amount;
        needsConsumed[need.good] = (needsConsumed[need.good] ?? 0) + amount;
      } else {
        allNeeds = false;
      }
    }
    const needsMet = fed && allNeeds;

    // 3. Growth / hunger.
    const cap = housing(state, city.id);
    if (fed) {
      if (city.residents < cap) {
        city.residents += Math.min(growthFor(city.level, needsMet), cap - city.residents);
      }
    } else {
      city.residents = Math.max(
        populationConfig.minResidents,
        city.residents - populationConfig.starvationLoss,
      );
    }
    if (city.residents > cap) city.residents = Math.max(populationConfig.minResidents, cap);

    // 4. Taxes.
    const taxes = taxFor(city.residents, needsMet);
    stock.drachmas += taxes;

    reports.push({
      cityId: city.id,
      residentsBefore: before,
      residentsAfter: city.residents,
      foodNeeded: needed,
      foodEaten,
      fed,
      needsMet,
      needsConsumed,
      taxes,
    });
  }
  return reports;
}

/** Numbers for the city panel (changes nothing). */
export function cityStats(state: GameState, cityId: number, production?: TurnReport): CityStats {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`Unknown city ${cityId}`);
  const stock = stockOf(state, city.owner);
  const def = CITY_LEVEL_DEFS[city.level];
  const foodPerTurn = foodNeeded(city.residents);
  const needs = def.needs.map((n) => {
    const amount = Math.ceil(city.residents / n.residentsPer);
    return { good: n.good, amount, inStock: stock[n.good] >= amount };
  });
  const check = def.next ? advanceCheck(state, cityId, production) : null;
  const supply = check ? { ...check.supply } : null;
  const foodStock = populationConfig.foodOrder.reduce(
    (sum, g) => sum + (GOODS[g].isFood ? stock[g] : 0),
    0,
  );
  const covered = foodStock >= foodPerTurn && needs.every((n) => n.inStock);
  const growthPerTurn = growthFor(city.level, covered);
  return {
    residents: city.residents,
    housing: housing(state, city.id),
    foodPerTurn,
    needs,
    supply,
    growthPerTurn,
    taxPerTurn: taxFor(city.residents, covered),
  };
}
