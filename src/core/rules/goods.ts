// Helper functions for goods and stocks.

import { GOOD_IDS, GOODS, type Goods, type GoodId, type Stock } from '../../data';

/** A stock with 0 of every good. */
export function emptyStock(): Stock {
  const stock = {} as Stock;
  for (const id of GOOD_IDS) stock[id] = 0;
  return stock;
}

export function canAfford(stock: Stock, cost: Goods): boolean {
  return GOOD_IDS.every((id) => stock[id] >= (cost[id] ?? 0));
}

/** The amounts that are missing to pay `cost` (empty object = affordable). */
export function missingGoods(stock: Stock, cost: Goods): Goods {
  const missing: Goods = {};
  for (const id of GOOD_IDS) {
    const lack = (cost[id] ?? 0) - stock[id];
    if (lack > 0) missing[id] = lack;
  }
  return missing;
}

/** Removes `cost` from the stock (mutates). Does not check affordability. */
export function pay(stock: Stock, cost: Goods): void {
  for (const id of GOOD_IDS) stock[id] -= cost[id] ?? 0;
}

/** Adds `delta` to the stock (mutates). */
export function addGoods(stock: Stock, delta: Goods): void {
  for (const id of GOOD_IDS) stock[id] += delta[id] ?? 0;
}

/** Multiplies every amount by `factor`, rounded down. */
export function scaleGoods(goods: Goods, factor: number): Goods {
  const result: Goods = {};
  for (const id of Object.keys(goods) as GoodId[]) {
    result[id] = Math.floor((goods[id] ?? 0) * factor);
  }
  return result;
}

/** Is this good food (eaten by residents and units)? Single source of truth: `GOODS[...].isFood`. */
export function isFoodGood(good: GoodId): boolean {
  return GOODS[good].isFood;
}

/** Total food in a stock (fish + grain, everything with `isFood`). */
export function foodIn(stock: Stock): number {
  let total = 0;
  for (const id of GOOD_IDS) if (GOODS[id].isFood) total += stock[id];
  return total;
}
