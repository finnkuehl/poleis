// Turns the report of a finished turn into short messages (pure, no DOM).
import type { TurnReport } from '../core/rules/production';
import { militaryConfig, type CityLevel, type GoodId, type UnitId } from '../data';
import { en } from '../i18n/en';
import {
  fill,
  formatCaptured,
  formatDrachmas,
  formatResidents,
  formatTurns,
  formatUnitsLost,
  formatUnitsReady,
} from '../i18n/format';

export interface SummaryLine {
  text: string;
  kind: 'info' | 'error';
}

/** Extra facts the report does not contain (the caller reads them from the game state). */
export interface SummaryContext {
  /** City id -> level it can advance to now (only cities that just became ready). */
  canAdvance?: Readonly<Record<number, CityLevel>>;
  /** City id -> the supply good for the next level and how many turns in a row it must be supplied. */
  supply?: Readonly<Record<number, { good: GoodId; turnsNeeded: number }>>;
  /** Types of the units that appeared this turn; without it only the count is reported. */
  spawnedUnits?: readonly UnitId[];
}

/**
 * Messages for the toast after a turn, per city: growth and taxes, hunger, supply progress and
 * "Ready to advance", then units (new, hunger, lost) and captured cities. Lines without news are
 * left out.
 */
export function turnSummary(report: TurnReport, ctx: SummaryContext = {}): SummaryLine[] {
  const lines: SummaryLine[] = [];
  for (const city of report.cities) {
    const change = city.residentsAfter - city.residentsBefore;
    const parts: string[] = [];
    if (change > 0) parts.push(`+${formatResidents(change)}`);
    if (city.taxes > 0) parts.push(`+${formatDrachmas(city.taxes)}`);
    if (parts.length > 0) {
      lines.push({
        text: fill(en.turnSummary.line, { turn: report.turn, parts: parts.join(', ') }),
        kind: 'info',
      });
    }
    if (!city.fed) {
      lines.push({
        text:
          change < 0
            ? fill(en.turnSummary.hunger, { residents: formatResidents(-change) })
            : en.turnSummary.hungerNoLoss,
        kind: 'error',
      });
    }
    const supply = ctx.supply?.[city.cityId];
    // Only report progress up to the goal ("3 of 3"); after that the count keeps running silently.
    if (city.supplied === true && supply && city.supplyStreak <= supply.turnsNeeded) {
      lines.push({
        text: fill(en.turnSummary.supplied, {
          good: en.goods[supply.good],
          streak: city.supplyStreak,
          turns: formatTurns(supply.turnsNeeded),
        }),
        kind: 'info',
      });
    }
    const level = ctx.canAdvance?.[city.cityId];
    if (level) {
      lines.push({
        text: fill(en.turnSummary.ready, { level: en.levels[level] }),
        kind: 'info',
      });
    }
  }
  const spawned = ctx.spawnedUnits;
  if (spawned && spawned.length > 0) {
    for (const type of spawned) {
      lines.push({ text: fill(en.turnSummary.unitReady, { unit: en.units[type] }), kind: 'info' });
    }
  } else if (report.units.spawned > 0) {
    lines.push({ text: formatUnitsReady(report.units.spawned), kind: 'info' });
  }
  if (report.units.starving) {
    lines.push({
      text: fill(en.turnSummary.unitsHungry, { hp: militaryConfig.starvationDamage }),
      kind: 'error',
    });
  }
  if (report.units.lost > 0) {
    lines.push({ text: formatUnitsLost(report.units.lost), kind: 'error' });
  }
  if (report.captured.length > 0) {
    lines.push({ text: formatCaptured(report.captured.length), kind: 'info' });
  }
  return lines;
}
