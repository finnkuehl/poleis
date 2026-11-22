// Turns the report of a finished turn into short messages (pure, no DOM).
import type { TurnReport } from '../core/rules/production';
import { militaryConfig, type CityLevel, type UnitId } from '../data';
import { en } from '../i18n/en';
import {
  fill,
  formatCaptured,
  formatDrachmas,
  formatResidents,
  formatUnitsLost,
  formatUnitsReady,
} from '../i18n/format';
import { orderOutcomeText } from './unitText';

export interface SummaryLine {
  text: string;
  kind: 'info' | 'error';
}

/** Extra facts the report does not contain (the caller reads them from the game state). */
export interface SummaryContext {
  /** City id -> level it can advance to now (only cities that just became ready). */
  canAdvance?: Readonly<Record<number, CityLevel>>;
  /** Types of the units that appeared this turn; without it only the count is reported. */
  spawnedUnits?: readonly UnitId[];
  /** City id -> display name; unknown ids fall back to a generic "City". */
  cityNames?: Readonly<Record<number, string>>;
}

/**
 * Messages for the toast after a turn, per city: growth and taxes, hunger and
 * "Ready to advance", then units (new, hunger, lost), move order results and captured cities. Lines without news are
 * left out.
 */
export function turnSummary(report: TurnReport, ctx: SummaryContext = {}): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const nameOf = (id: number): string => ctx.cityNames?.[id] ?? en.cityPanel.fallbackName;
  for (const city of report.cities) {
    const name = nameOf(city.cityId);
    const change = city.residentsAfter - city.residentsBefore;
    const parts: string[] = [];
    if (change > 0) parts.push(`+${formatResidents(change)}`);
    if (city.taxes > 0) parts.push(`+${formatDrachmas(city.taxes)}`);
    if (parts.length > 0) {
      lines.push({
        text: fill(en.turnSummary.line, { turn: report.turn, city: name, parts: parts.join(', ') }),
        kind: 'info',
      });
    }
    if (!city.fed) {
      lines.push({
        text:
          change < 0
            ? fill(en.turnSummary.hunger, { city: name, residents: formatResidents(-change) })
            : fill(en.turnSummary.hungerNoLoss, { city: name }),
        kind: 'error',
      });
    }
    const level = ctx.canAdvance?.[city.cityId];
    if (level) {
      lines.push({
        text: fill(en.turnSummary.ready, { city: name, level: en.levels[level] }),
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
  for (const entry of report.orders) {
    lines.push(orderOutcomeText(entry.outcome, entry.unitType));
  }
  if (report.captured.length > 0) {
    lines.push({ text: formatCaptured(report.captured.map(nameOf)), kind: 'info' });
  }
  return lines;
}
