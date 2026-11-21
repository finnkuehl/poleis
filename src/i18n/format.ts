// Turns rule results (goods, errors, statuses) into display texts.

import {
  GOOD_IDS,
  militaryConfig,
  type CityLevel,
  type GoodId,
  type Goods,
  type TerrainId,
} from '../data';
import type { RuleError } from '../core/rules/errors';
import type { BuildingStatus } from '../core/rules/production';
import type { GoodFlow, WorkerSummary } from '../core/rules/economy';
import type { BuildingId } from '../data';
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
    distance: militaryConfig.foundMinDistance,
  });
}

export function formatStatus(status: BuildingStatus): string {
  switch (status.kind) {
    case 'missingWorkers':
      return fill(en.status.missingWorkers, { assigned: status.assigned, needed: status.needed });
    case 'wonderBuilding':
      return fill(en.status.wonderBuilding, { progress: status.progress, total: status.total });
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

/** "+1 tile" / "+11 tiles" (what a border tower claims, in the build list) */
export function formatTileGain(n: number): string {
  return fill(n === 1 ? en.tileInfo.gainOne : en.tileInfo.gainMany, { n });
}

/** "+1 territory tile" / "+11 territory tiles" (confirm sheet line) */
export function formatTerritoryGain(n: number): string {
  return fill(n === 1 ? en.flow.territoryGainOne : en.flow.territoryGainMany, { n });
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

/** Movement points: whole numbers plain ("2"), fractions with one decimal ("0.5"). */
export function formatMoves(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "1 unit is ready" / "3 units are ready" (turn summary, when only a count is known) */
export function formatUnitsReady(n: number): string {
  return n === 1 ? en.turnSummary.unitsReadyOne : fill(en.turnSummary.unitsReadyMany, { n });
}

/** "1 unit was lost to hunger" / "2 units were lost to hunger" */
export function formatUnitsLost(n: number): string {
  return n === 1 ? en.turnSummary.unitsLostOne : fill(en.turnSummary.unitsLostMany, { n });
}

/** "You captured a city!" / "You captured 2 cities!" */
export function formatCaptured(n: number): string {
  return n === 1 ? en.turnSummary.capturedOne : fill(en.turnSummary.capturedMany, { n });
}

/**
 * Toast after an attack, from the combat numbers:
 * "Spearman defeated the enemy." / "Spearman attacked: 5 damage, took 3." /
 * "Scout attacked: 1 damage. Your scout was lost."
 */
export function formatAttacked(
  unit: string,
  r: { damage: number; counter: number; defenderDies: boolean; attackerDies: boolean },
): string {
  if (r.defenderDies) return fill(en.flow.attackedDefeated, { unit });
  if (r.attackerDies) {
    return fill(en.flow.attackedLost, { unit, n: r.damage, lower: unit.toLowerCase() });
  }
  if (r.counter > 0) return fill(en.flow.attackedTook, { unit, n: r.damage, c: r.counter });
  return fill(en.flow.attacked, { unit, n: r.damage });
}

/** "+4" / "−2" / "0" (net change per turn, with a real minus sign) */
export function formatNet(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** "Runs out this turn" / "Runs out in 1 turn" / "Runs out in 3 turns" */
export function formatRunsOut(turns: number): string {
  return turns <= 0
    ? en.economy.runsOutNow
    : fill(en.economy.runsOut, { turns: formatTurns(turns) });
}

function flowPart(name: string, count: number, amount: number, sign: 1 | -1): string {
  const times = count > 1 ? ` ×${count}` : '';
  return `${name}${times} ${formatNet(sign * amount)}`;
}

/** "Woodcutter ×2 +4, Taxes +1" (null = nothing is made) */
export function formatMade(flow: GoodFlow): string | null {
  if (flow.produced.length === 0) return null;
  const parts = flow.produced.map((p) =>
    flowPart(
      p.source === 'taxes' ? en.economy.taxes : en.buildings[p.source as BuildingId],
      p.count,
      p.amount,
      1,
    ),
  );
  return `${en.economy.made}: ${parts.join(', ')}`;
}

/** "Sawmill −2, residents −3, units −1" (null = nothing is used) */
export function formatUsed(flow: GoodFlow): string | null {
  if (flow.consumed.length === 0) return null;
  const parts = flow.consumed.map((c) => {
    const name =
      c.source === 'building'
        ? en.buildings[c.detail as BuildingId]
        : c.source === 'residents'
          ? en.economy.residentsUse
          : c.source === 'units'
            ? en.economy.unitsUse
            : c.source === 'needs'
              ? en.economy.needsUse
              : en.economy.supplyUse;
    return flowPart(name, c.source === 'building' ? c.count : 1, c.amount, -1);
  });
  return `${en.economy.used}: ${parts.join(', ')}`;
}

/** "Residents 8 / 12 · Working 6 · Free 2 · Missing 1" */
export function formatWorkerLine(w: WorkerSummary): string {
  const parts = [
    `${en.economy.residents} ${w.residents} / ${w.housing}`,
    `${en.economy.working} ${w.working}`,
    `${en.economy.free} ${w.free}`,
    `${en.economy.missing} ${w.missing}`,
  ];
  return parts.join(' · ');
}
