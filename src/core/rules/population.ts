// Population: eating, needs, level-up supply, growth/hunger and taxes (docs/GAME_DESIGN.md §6).

import {
  CITY_LEVEL_DEFS,
  GOODS,
  populationConfig,
  type GoodId,
  type Goods,
  type Stock,
} from '../../data';
import type { City, GameState, PlayerId } from '../state';
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
  /** Next level's supply good was supplied this turn (null at the highest level). */
  supplied: boolean | null;
  supplyStreak: number;
  taxes: number;
}

export interface CityStats {
  residents: number;
  housing: number;
  foodPerTurn: number;
  needs: { good: GoodId; amount: number; inStock: boolean }[];
  supply: {
    good: GoodId;
    amount: number;
    inStock: boolean;
    streak: number;
    turnsNeeded: number;
  } | null;
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

/** Amount of the next level's supply good per turn (rate = that good's rate at the next level). */
function supplyAmount(city: City): { good: GoodId; amount: number } | null {
  const next = CITY_LEVEL_DEFS[city.level].next;
  if (!next) return null;
  const rate = CITY_LEVEL_DEFS[next.to].needs.find((n) => n.good === next.supplyGood);
  return {
    good: next.supplyGood,
    amount: rate ? Math.ceil(city.residents / rate.residentsPer) : 0,
  };
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

    // 3. Supply for the next level.
    let supplied: boolean | null = null;
    const supply = supplyAmount({ ...city, residents: before });
    if (supply) {
      if (stock[supply.good] >= supply.amount) {
        stock[supply.good] -= supply.amount;
        city.supplyStreak += 1;
        supplied = true;
      } else {
        city.supplyStreak = 0;
        supplied = false;
      }
    }

    // 4. Growth / hunger.
    const cap = housing(state, city.id);
    if (fed) {
      if (city.residents < cap) {
        city.residents += Math.min(
          populationConfig.growthPerTurn[city.level],
          cap - city.residents,
        );
      }
    } else {
      city.residents = Math.max(
        populationConfig.minResidents,
        city.residents - populationConfig.starvationLoss,
      );
    }
    if (city.residents > cap) city.residents = Math.max(populationConfig.minResidents, cap);

    // 5. Taxes.
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
      supplied,
      supplyStreak: city.supplyStreak,
      taxes,
    });
  }
  return reports;
}

/** Numbers for the city panel (changes nothing). */
export function cityStats(state: GameState, cityId: number): CityStats {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`Unknown city ${cityId}`);
  const stock = stockOf(state, city.owner);
  const def = CITY_LEVEL_DEFS[city.level];
  const foodPerTurn = foodNeeded(city.residents);
  const needs = def.needs.map((n) => {
    const amount = Math.ceil(city.residents / n.residentsPer);
    return { good: n.good, amount, inStock: stock[n.good] >= amount };
  });
  const supplyInfo = supplyAmount(city);
  const next = def.next;
  const supply =
    supplyInfo && next
      ? {
          good: supplyInfo.good,
          amount: supplyInfo.amount,
          inStock: stock[supplyInfo.good] >= supplyInfo.amount,
          streak: city.supplyStreak,
          turnsNeeded: next.supplyTurns,
        }
      : null;
  const foodStock = populationConfig.foodOrder.reduce(
    (sum, g) => sum + (GOODS[g].isFood ? stock[g] : 0),
    0,
  );
  const covered = foodStock >= foodPerTurn && needs.every((n) => n.inStock);
  return {
    residents: city.residents,
    housing: housing(state, city.id),
    foodPerTurn,
    needs,
    supply,
    taxPerTurn: taxFor(city.residents, covered),
  };
}
