// Turns rule results (goods, errors, statuses) into display texts.

import { GOOD_IDS, type CityLevel, type GoodId, type Goods, type TerrainId } from '../data';
import type { RuleError } from '../core/rules/errors';
import type { BuildingStatus } from '../core/rules/production';
import { en } from './en';

/** "2 Wood, 1 Stone" in display order; zero amounts are skipped. */
export function formatGoods(goods: Goods): string {
  return GOOD_IDS.filter((id) => (goods[id] ?? 0) > 0)
    .map((id) => `${goods[id]} ${en.goods[id]}`)
    .join(', ');
}

/** "forest or hills" (lowercase names joined with " or "). */
export function formatTerrains(list: readonly TerrainId[]): string {
  return list.map((t) => en.terrain[t].toLowerCase()).join(' or ');
}

/** Replaces {name} placeholders in a template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function formatError(err: RuleError): string {
  return fill(en.errors[err.code], {
    goods: formatGoods(err.missing ?? {}),
    terrains: formatTerrains(err.terrains ?? []),
    level: err.level ? en.levels[err.level] : '',
    good: err.good ? en.goods[err.good].toLowerCase() : '',
    turns: err.turns ?? 0,
  });
}

export function formatStatus(status: BuildingStatus): string {
  switch (status.kind) {
    case 'missingWorkers':
      return fill(en.status.missingWorkers, { assigned: status.assigned, needed: status.needed });
    case 'missingInput':
      return fill(en.status.missingInput, { goods: formatGoods(status.missing) });
    default:
      return en.status[status.kind];
  }
}

/** "+2 Wood, +1 Stone" (every amount with a plus sign). */
export function formatSignedGoods(goods: Goods): string {
  return GOOD_IDS.filter((id) => (goods[id] ?? 0) > 0)
    .map((id) => `+${goods[id]} ${en.goods[id]}`)
    .join(', ');
}

/** "2 Wood → 2 Planks" for a processing step. */
export function formatConversion(inputs: Goods, outputs: Goods): string {
  return `${formatGoods(inputs)} → ${formatGoods(outputs)}`;
}

/** "Missing: 2 Wood" */
export function formatMissing(goods: Goods): string {
  return fill(en.ui.missing, { goods: formatGoods(goods) });
}

/** "1 worker" / "2 workers" */
export function formatWorkerCount(n: number): string {
  return fill(n === 1 ? en.buildingText.workerOne : en.buildingText.workerMany, { n });
}

/** "1 new road tile" / "2 new road tiles" */
export function formatRoadTiles(n: number): string {
  return fill(n === 1 ? en.flow.roadTileOne : en.flow.roadTileMany, { n });
}

/** "Turn 3 / 120" */
export function formatTurnOf(turn: number, limit: number): string {
  return fill(en.ui.turnOf, { turn, limit });
}

function plural(n: number, forms: { one: string; many: string }): string {
  return `${n} ${n === 1 ? forms.one : forms.many}`;
}

/** "1 resident" / "6 residents" */
export function formatResidents(n: number): string {
  return plural(n, en.plural.resident);
}

/** "1 drachma" / "3 drachmas" */
export function formatDrachmas(n: number): string {
  return plural(n, en.plural.drachma);
}

/** "1 turn" / "3 turns" */
export function formatTurns(n: number): string {
  return plural(n, en.plural.turn);
}

/** "Advance to Polis" (button, title) */
export function formatAdvanceTo(level: CityLevel): string {
  return fill(en.cityPanel.advanceButton, { level: en.levels[level] });
}

/** Toast after advancing: "Your city is now a Polis." */
export function formatAdvanced(level: CityLevel): string {
  return fill(en.flow.advanced, { level: en.levels[level] });
}

/** Toast after selling: "Sold 2 Wood for 1 drachma." */
export function formatSold(good: GoodId, amount: number, price: number): string {
  return fill(en.flow.sold, { amount, good: en.goods[good], price: formatDrachmas(price) });
}

/** Toast after buying: "Bought 1 Wood for 3 drachmas." */
export function formatBought(good: GoodId, amount: number, price: number): string {
  return fill(en.flow.bought, { amount, good: en.goods[good], price: formatDrachmas(price) });
}
