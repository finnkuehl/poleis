// Production: what each building produces in one turn.

import { BUILDINGS, GOOD_IDS, type Goods, type GoodId, type Stock } from '../../data';
import type { GameState, PlayerId } from '../state';
import { connectedBuildingIds } from './connection';
import type { CityReport } from './population';
import { addGoods, canAfford, missingGoods, pay } from './goods';
import { assignWorkers } from './workers';

export type BuildingStatus =
  | { kind: 'producing' }
  // Staffed service building without outputs (marketplace): open for business.
  | { kind: 'working' }
  // No outputs and no workers (house, storehouse, city center, temple).
  | { kind: 'noProduction' }
  | { kind: 'paused' }
  | { kind: 'notConnected' }
  | { kind: 'missingWorkers'; assigned: number; needed: number }
  | { kind: 'missingInput'; missing: Goods };

export interface BuildingReport {
  buildingId: number;
  status: BuildingStatus;
  produced: Goods;
  consumed: Goods;
}

export interface UnitsReport {
  /** Units that appeared at the start of the turn. */
  spawned: number;
  /** Food eaten by the units. */
  upkeepEaten: Goods;
  /** Not enough food for all units: every unit took damage. */
  starving: boolean;
  /** Units that died of hunger. */
  lost: number;
}

export interface TurnReport {
  turn: number;
  player: PlayerId;
  /** Net change per good. */
  delta: Goods;
  buildings: BuildingReport[];
  /** Population report per city (filled by endTurn; empty for a production-only run). */
  cities: CityReport[];
  /** Unit report (filled by endTurn). */
  units: UnitsReport;
  /** Ids of the cities captured at the start of this turn. */
  captured: number[];
}

function hasGoods(goods: Goods): boolean {
  return GOOD_IDS.some((id) => (goods[id] ?? 0) > 0);
}

/** Runs one production round on `stock` (mutates the stock). */
function simulate(state: GameState, player: PlayerId, stock: Stock): TurnReport {
  const connected = connectedBuildingIds(state, player);
  const workers = assignWorkers(state, player, connected);
  const own = state.buildings.filter((b) => b.owner === player);
  // Buildings without inputs first, then those with inputs; by id within each group.
  const ordered = [...own].sort(
    (a, b) =>
      Number(hasGoods(BUILDINGS[a.type].inputs)) - Number(hasGoods(BUILDINGS[b.type].inputs)) ||
      a.id - b.id,
  );

  const before = { ...stock };
  const reports: BuildingReport[] = [];
  for (const b of ordered) {
    const def = BUILDINGS[b.type];
    const report: BuildingReport = {
      buildingId: b.id,
      status: { kind: 'producing' },
      produced: {},
      consumed: {},
    };
    reports.push(report);
    const isService = !hasGoods(def.outputs) && def.workers > 0;
    if (!hasGoods(def.outputs) && !isService) {
      report.status = { kind: 'noProduction' };
    } else if (b.paused) {
      report.status = { kind: 'paused' };
    } else if (!connected.has(b.id)) {
      report.status = { kind: 'notConnected' };
    } else if ((workers[b.id] ?? 0) < def.workers) {
      report.status = { kind: 'missingWorkers', assigned: workers[b.id] ?? 0, needed: def.workers };
    } else if (isService) {
      report.status = { kind: 'working' };
    } else if (!canAfford(stock, def.inputs)) {
      report.status = { kind: 'missingInput', missing: missingGoods(stock, def.inputs) };
    } else {
      pay(stock, def.inputs);
      addGoods(stock, def.outputs);
      report.consumed = { ...def.inputs };
      report.produced = { ...def.outputs };
    }
  }

  const delta: Goods = {};
  for (const id of GOOD_IDS as readonly GoodId[]) {
    const d = stock[id] - before[id];
    if (d !== 0) delta[id] = d;
  }
  return {
    turn: state.turn,
    player,
    delta,
    buildings: reports,
    cities: [],
    units: { spawned: 0, upkeepEaten: {}, starving: false, lost: 0 },
    captured: [],
  };
}

function stockOf(state: GameState, player: PlayerId): Stock {
  const p = state.players.find((x) => x.id === player);
  if (!p) throw new Error(`Unknown player ${player}`);
  return p.goods;
}

/** Runs the production of one turn and changes the player's goods (mutates `state`). */
export function runProduction(state: GameState, player: PlayerId): TurnReport {
  return simulate(state, player, stockOf(state, player));
}

/** Same result as `runProduction`, but changes nothing. */
export function previewProduction(state: GameState, player: PlayerId): TurnReport {
  return simulate(state, player, { ...stockOf(state, player) });
}
