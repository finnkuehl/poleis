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
  type TrainingBuildingId,
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
 * Short label drawn on an attackable enemy: the damage ("-3"), a skull when it kills,
 * the counterattack ("-3 ↩2") and a cross when the counterattack would kill the attacker.
 */
export function attackLabel(preview: CombatPreview): string {
  const a = en.attack;
  if (preview.defenderDies) return fill(a.labelKill, { n: preview.damage });
  if (preview.counter <= 0) return fill(a.labelDamage, { n: preview.damage });
  return fill(preview.attackerDies ? a.labelCounterDeath : a.labelCounter, {
    n: preview.damage,
    counter: preview.counter,
  });
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
  /** The training building (default: barracks; a harbor lists the ships; the city center the settler). */
  building?: TrainingBuildingId;
}): TrainOption[] {
  const options: TrainOption[] = [];
  for (const id of UNIT_IDS) {
    const def = UNITS[id];
    if (def.trainedIn !== (facts.building ?? 'barracks')) continue;
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

/** "Aboard: 1 / 2" for a transport ship's cargo. */
export function cargoText(count: number, capacity: number): string {
  return fill(en.unitText.aboard, { n: count, max: capacity });
}

/**
 * Can the unit take part in the "Units" button's cycle? Ships and land units that can still act
 * (`canAct`); passengers only while they can still land: moves left and a landing tile.
 */
export function inUnitCycle(unit: Unit, canAct: boolean, landingTiles: number): boolean {
  if (unit.aboard !== null) return unit.movesLeft > 0 && !unit.attacked && landingTiles > 0;
  return canAct;
}

/** What a passenger can do now: land, wait for the next turn (no moves left) or has no free shore. */
export type AboardState = 'land' | 'noMoves' | 'noTile';

export function aboardState(unit: Unit, landingTiles: number): AboardState {
  if (unit.movesLeft <= 0 || unit.attacked) return 'noMoves';
  return landingTiles > 0 ? 'land' : 'noTile';
}

export function aboardText(state: AboardState): string {
  return {
    land: en.unitText.aboardHint,
    noMoves: en.unitText.aboardNoMoves,
    noTile: en.unitText.aboardNoLanding,
  }[state];
}
