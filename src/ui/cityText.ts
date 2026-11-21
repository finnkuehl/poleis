// Pure helpers for the city panel and the marketplace list (no DOM, easy to test).
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityStats } from '../core/rules/population';
import {
  GOOD_IDS,
  economyConfig,
  populationConfig,
  type CityLevel,
  type GoodId,
  type Stock,
} from '../data';
import { en } from '../i18n/en';
import { fill, formatError, formatGoods, formatResidents, formatTurns } from '../i18n/format';
import { costPartsFromMissing, type CostPart } from './buildingText';

export type GrowthState =
  { kind: 'growing'; perTurn: number } | { kind: 'full' } | { kind: 'hungry'; loss: number };

/** Is the city growing, full or hungry? (hungry = the food in stock does not cover one turn). */
export function growthState(level: CityLevel, stats: CityStats, stock: Stock): GrowthState {
  const food = populationConfig.foodOrder.reduce((sum, g) => sum + stock[g], 0);
  if (food < stats.foodPerTurn) return { kind: 'hungry', loss: populationConfig.starvationLoss };
  const free = stats.housing - stats.residents;
  if (free <= 0) return { kind: 'full' };
  return { kind: 'growing', perTurn: Math.min(populationConfig.growthPerTurn[level], free) };
}

export function growthText(state: GrowthState): string {
  switch (state.kind) {
    case 'growing':
      return fill(en.cityPanel.growing, { n: state.perTurn });
    case 'full':
      return en.cityPanel.full;
    case 'hungry':
      return fill(en.cityPanel.hungry, { residents: formatResidents(state.loss) });
  }
}

/** "Needs 2 Oil per turn" (with "– missing" if the stock does not cover it). */
export function needText(n: CityStats['needs'][number]): string {
  const base = fill(en.cityPanel.need, { amount: n.amount, good: en.goods[n.good] });
  return n.inStock ? base : `${base} – ${en.cityPanel.needMissing}`;
}

export interface ChecklistRow {
  kind: 'residents' | 'supply' | 'cost';
  ok: boolean;
  text: string;
  /** Only for the cost row: the goods, marking what is missing. */
  parts?: CostPart[];
}

/** The requirements to advance as a checklist (empty at the highest level). */
export function advanceRows(check: AdvanceCheck): ChecklistRow[] {
  if (!check.to) return [];
  return [
    {
      kind: 'residents',
      ok: check.residents.ok,
      text: fill(en.cityPanel.residentsReq, {
        have: check.residents.have,
        need: check.residents.need,
      }),
    },
    {
      kind: 'supply',
      ok: check.supply.ok,
      text: fill(en.cityPanel.supplyReq, {
        good: en.goods[check.supply.good],
        streak: check.supply.streak,
        turns: formatTurns(check.supply.turns),
      }),
    },
    {
      kind: 'cost',
      ok: check.cost.ok,
      text: fill(en.cityPanel.costReq, { cost: en.ui.cost, goods: formatGoods(check.cost.cost) }),
      parts: costPartsFromMissing(check.cost.cost, check.cost.missing),
    },
  ];
}

/** The first unmet requirement as a sentence (null = can advance or no next level). */
export function advanceBlockReason(check: AdvanceCheck): string | null {
  if (!check.to || check.canAdvance) return null;
  if (!check.residents.ok) return formatError({ code: 'notEnoughResidents' });
  if (!check.supply.ok) {
    return formatError({
      code: 'supplyNotReady',
      good: check.supply.good,
      turns: check.supply.turns,
    });
  }
  return formatError({ code: 'notAffordable', missing: check.cost.missing });
}

export interface TradeRow {
  good: GoodId;
  amount: number;
  canSell: boolean;
  canBuy: boolean;
}

/** Goods that can be traded: all except drachmas. */
export const TRADABLE_GOODS: readonly GoodId[] = GOOD_IDS.filter((g) => g !== 'drachmas');

/**
 * Rows of the marketplace list: goods you have (or all goods) with what you can do.
 * Buttons are never enabled while trading is not possible (`enabled` = false).
 */
export function tradeRows(stock: Stock, enabled: boolean, showAll: boolean): TradeRow[] {
  const { sellAmount, buyPrice } = economyConfig.market;
  return TRADABLE_GOODS.filter((g) => showAll || stock[g] > 0).map((good) => ({
    good,
    amount: stock[good],
    canSell: enabled && stock[good] >= sellAmount,
    canBuy: enabled && stock.drachmas >= buyPrice,
  }));
}
