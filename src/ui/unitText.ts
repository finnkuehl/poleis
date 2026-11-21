// Pure helpers for unit texts: stats, status, attack preview and the training list (no DOM).
import type { CombatPreview } from '../core/rules/combat';
import type { OrderReport } from '../core/rules/orders';
import { missingGoods } from '../core/rules/goods';
import type { Unit } from '../core/state';
import {
  CITY_LEVELS,
  UNIT_IDS,
  UNITS,
  militaryConfig,
  type CityLevel,
  type Goods,
  type Stock,
  type UnitId,
} from '../data';
import { en } from '../i18n/en';
import { fill, formatTurns } from '../i18n/format';

/** Compact stats of a unit type, e.g. "Attack 2 · Defense 2 · Range 1 · Moves 1". */
export function unitStatLine(id: UnitId): string {
  const d = UNITS[id];
  const t = en.unitText;
  return [
    fill(t.attack, { n: d.attack }),
    fill(t.defense, { n: d.defense }),
    d.range > 0 ? fill(t.range, { n: d.range }) : t.noRange,
    fill(t.moves, { n: d.movement }),
  ].join(' · ');
}

export type UnitStatus = 'ready' | 'canAttack' | 'done';

/**
 * What an own unit can still do this turn: move (moves left), attack (range, no attack yet and
 * at least one target in reach: `hasTargets`).
 * "Ready" = can still move; "Can still attack" = out of moves but may attack; else done.
 */
export function unitStatus(unit: Unit, hasTargets: boolean): UnitStatus {
  const def = UNITS[unit.type];
  const canMove = !unit.attacked && unit.movesLeft > 0;
  const canAttack = !unit.attacked && def.range > 0 && hasTargets;
  if (canMove) return 'ready';
  if (canAttack) return 'canAttack';
  return 'done';
}

export function unitStatusText(status: UnitStatus): string {
  return {
    ready: en.unitText.statusReady,
    canAttack: en.unitText.statusCanAttack,
    done: en.unitText.statusDone,
  }[status];
}

/**
 * Lines for the attack confirm sheet: damage dealt, the counterattack and the outcome.
 * The unit name in the brackets is the unit that takes the damage.
 */
export function attackPreviewLines(
  preview: CombatPreview,
  attacker: Unit,
  defender: Unit,
): string[] {
  const a = en.attack;
  const lines: string[] = [];
  lines.push(
    fill(a.deal, {
      n: preview.damage,
      unit: en.units[defender.type],
      from: defender.hp,
      to: Math.max(0, defender.hp - preview.damage),
    }),
  );
  if (preview.defenderDies) {
    lines.push(a.defeated);
  } else if (preview.counter > 0) {
    lines.push(
      fill(a.take, {
        n: preview.counter,
        unit: en.units[attacker.type],
        from: attacker.hp,
        to: Math.max(0, attacker.hp - preview.counter),
      }),
    );
    if (preview.attackerDies) lines.push(a.lost);
  } else {
    lines.push(a.noCounter);
  }
  return lines;
}

export interface TrainOption {
  id: UnitId;
  state: 'ok' | 'unaffordable' | 'locked' | 'noResidents';
  /** unaffordable: the goods that are missing. */
  missing?: Goods;
  /** locked: the city level the unit needs. */
  level?: CityLevel;
  /** noResidents: how many residents the city needs. */
  residentsNeeded?: number;
}

const ORDER: Record<TrainOption['state'], number> = {
  ok: 0,
  unaffordable: 1,
  noResidents: 2,
  locked: 3,
};

/**
 * The units a barracks could train, from facts the caller already knows (city level, residents,
 * the player's goods). Settlers need `settlerMinCityResidents` residents in the city.
 * Order: ready first, then too expensive, then too few residents, then locked by level.
 */
export function trainOptions(facts: {
  cityLevel: CityLevel;
  residents: number;
  stock: Stock;
}): TrainOption[] {
  const options: TrainOption[] = [];
  for (const id of UNIT_IDS) {
    const def = UNITS[id];
    if (CITY_LEVELS.indexOf(facts.cityLevel) < CITY_LEVELS.indexOf(def.minLevel)) {
      options.push({ id, state: 'locked', level: def.minLevel });
      continue;
    }
    if (def.residents > 0 && facts.residents < militaryConfig.settlerMinCityResidents) {
      options.push({
        id,
        state: 'noResidents',
        residentsNeeded: militaryConfig.settlerMinCityResidents,
      });
      continue;
    }
    const missing = missingGoods(facts.stock, def.cost);
    if (Object.values(missing).some((n) => (n ?? 0) > 0)) {
      options.push({ id, state: 'unaffordable', missing });
      continue;
    }
    options.push({ id, state: 'ok' });
  }
  return options.sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}

/** Status line of a unit that is walking on a move order ("On the way – arrives in 3 turns"). */
export function onTheWayText(turns: number | null): string {
  return turns === null
    ? en.orders.onTheWayUnknown
    : fill(en.orders.onTheWay, { turns: formatTurns(turns) });
}

/** Texts of the confirm sheet shown before a unit is sent on a multi-turn move. */
export function orderConfirm(
  unit: UnitId,
  turns: number,
): { title: string; lines: string[]; confirmLabel: string } {
  const o = en.orders;
  const t = formatTurns(turns);
  return {
    title: fill(o.confirmTitle, { unit: en.units[unit] }),
    lines: [fill(o.arrivesIn, { turns: t }), o.continues],
    confirmLabel: fill(o.goHere, { turns: t }),
  };
}

/** Toast text for an order that ended at the start of the turn (arrived = info, stopped = error). */
export function orderOutcomeText(
  outcome: OrderReport['outcome'],
  unit: UnitId,
): { text: string; kind: 'info' | 'error' } {
  const o = en.orders;
  const name = en.units[unit];
  switch (outcome) {
    case 'arrived':
      return { text: fill(o.arrived, { unit: name }), kind: 'info' };
    case 'enemySpotted':
      return { text: fill(o.stoppedEnemy, { unit: name }), kind: 'error' };
    case 'blocked':
      return { text: fill(o.stoppedBlocked, { unit: name }), kind: 'error' };
  }
}
