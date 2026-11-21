// Turns rule results (goods, errors, statuses) into display texts.

import { GOOD_IDS, type Goods, type TerrainId } from '../data';
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

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function formatError(err: RuleError): string {
  return fill(en.errors[err.code], {
    goods: formatGoods(err.missing ?? {}),
    terrains: formatTerrains(err.terrains ?? []),
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
