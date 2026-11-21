// Pure helpers for building texts (no DOM, easy to test).
import {
  BUILDINGS,
  CITY_LEVELS,
  GOOD_IDS,
  type BuildingId,
  type CityLevel,
  type Goods,
  type GoodId,
  type Stock,
} from '../data';
import type { BuildingStatus } from '../core/rules/production';
import { en } from '../i18n/en';
import { fill, formatConversion, formatSignedGoods, formatWorkerCount } from '../i18n/format';

/** What a building does per turn, e.g. "+2 Wood", "2 Wood → 2 Planks", "Houses 4 residents". */
export function perTurnText(id: BuildingId): string {
  const def = BUILDINGS[id];
  const parts: string[] = [];
  const hasOutputs = GOOD_IDS.some((g) => (def.outputs[g] ?? 0) > 0);
  const hasInputs = GOOD_IDS.some((g) => (def.inputs[g] ?? 0) > 0);
  if (hasOutputs) {
    parts.push(
      hasInputs ? formatConversion(def.inputs, def.outputs) : formatSignedGoods(def.outputs),
    );
  }
  if (def.housing > 0) parts.push(fill(en.buildingText.houses, { n: def.housing }));
  if (def.isStorage) parts.push(en.buildingText.connectionPoint);
  return parts.join('. ');
}

/** "1 worker", "2 workers" or "No workers needed". */
export function workersText(n: number): string {
  return n > 0 ? formatWorkerCount(n) : en.buildingText.noWorkers;
}

export interface CostPart {
  good: GoodId;
  amount: number;
  /** true if the stock does not cover this part of the cost. */
  missing: boolean;
}

/** The cost split per good (display order), marking what the stock lacks. */
export function costParts(cost: Goods, stock: Stock): CostPart[] {
  return GOOD_IDS.filter((g) => (cost[g] ?? 0) > 0).map((good) => {
    const amount = cost[good] ?? 0;
    return { good, amount, missing: stock[good] < amount };
  });
}

export type StatusTone = 'ok' | 'problem' | 'neutral';

/**
 * Color class of a status: producing and open for business = ok, no production and paused =
 * neutral, everything else = problem.
 */
export function statusTone(status: BuildingStatus): StatusTone {
  if (status.kind === 'producing' || status.kind === 'working') return 'ok';
  if (status.kind === 'noProduction' || status.kind === 'paused') return 'neutral';
  return 'problem';
}

/** Like `costParts`, but takes the already known missing goods (e.g. from an advance check). */
export function costPartsFromMissing(cost: Goods, missing: Goods): CostPart[] {
  return GOOD_IDS.filter((g) => (cost[g] ?? 0) > 0).map((good) => ({
    good,
    amount: cost[good] ?? 0,
    missing: (missing[good] ?? 0) > 0,
  }));
}

/** Can a city of level `have` use something that needs level `need`? */
export function levelReached(have: CityLevel, need: CityLevel): boolean {
  return CITY_LEVELS.indexOf(have) >= CITY_LEVELS.indexOf(need);
}

/** Does the building show a Pause button? Only buildings with workers can be paused. */
export function canPause(id: BuildingId): boolean {
  return BUILDINGS[id].workers > 0;
}
