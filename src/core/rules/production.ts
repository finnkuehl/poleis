// Production: what each building produces in one turn.

import { BUILDINGS, GOOD_IDS, wonderConfig, type Goods, type GoodId, type Stock } from '../../data';
import type { GameState, PlayerId } from '../state';
import { connectedBuildingIds } from './connection';
import type { CityReport } from './population';
import { addGoods, canAfford, missingGoods, pay } from './goods';
import type { OrderReport } from './orders';
import { addEvent } from './events';
import { assignWorkers, isWonderComplete, workersNeeded } from './workers';

export type BuildingStatus =
  | { kind: 'producing' }
  // Staffed service building without outputs (marketplace): open for business.
  | { kind: 'working' }
  // No outputs and no workers (house, storehouse, city center, temple).
  | { kind: 'noProduction' }
  | { kind: 'paused' }
  | { kind: 'notConnected' }
  | { kind: 'missingWorkers'; assigned: number; needed: number }
  | { kind: 'missingInput'; missing: Goods }
  // Wonder staffed and connected: its work goes on (progress = working turns done).
  | { kind: 'wonderBuilding'; progress: number; total: number }
  | { kind: 'wonderComplete' };

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
  /** Drachmas paid as soldiers' pay. */
  upkeepPaid: number;
  /** Not enough food for all units. */
  hungry: boolean;
  /** Not enough drachmas to pay all units. */
  unpaid: boolean;
  /** Food or pay was short: every unit took damage (once). */
  starving: boolean;
  /** Units that died of hunger or unpaid. */
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
  /** Outcomes of move orders that ended at the start of this turn (filled by endTurn). */
  orders: OrderReport[];
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
    const needed = workersNeeded(b);
    const isService = !hasGoods(def.outputs) && needed > 0 && b.type !== 'wonder';
    if (b.type === 'wonder') {
      if (isWonderComplete(b)) report.status = { kind: 'wonderComplete' };
      else if (b.paused) report.status = { kind: 'paused' };
      else if (!connected.has(b.id)) report.status = { kind: 'notConnected' };
      else if ((workers[b.id] ?? 0) < needed) {
        report.status = { kind: 'missingWorkers', assigned: workers[b.id] ?? 0, needed };
      } else {
        report.status = {
          kind: 'wonderBuilding',
          progress: b.progress ?? 0,
          total: wonderConfig.buildTurns,
        };
      }
    } else if (!hasGoods(def.outputs) && !isService) {
      report.status = { kind: 'noProduction' };
    } else if (b.paused) {
      report.status = { kind: 'paused' };
    } else if (!connected.has(b.id)) {
      report.status = { kind: 'notConnected' };
    } else if ((workers[b.id] ?? 0) < needed) {
      report.status = { kind: 'missingWorkers', assigned: workers[b.id] ?? 0, needed };
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
    units: {
      spawned: 0,
      upkeepEaten: {},
      upkeepPaid: 0,
      hungry: false,
      unpaid: false,
      starving: false,
      lost: 0,
    },
    captured: [],
    orders: [],
  };
}

function stockOf(state: GameState, player: PlayerId): Stock {
  const p = state.players.find((x) => x.id === player);
  if (!p) throw new Error(`Unknown player ${player}`);
  return p.goods;
}

/** Runs the production of one turn and changes the player's goods (mutates `state`). */
export function runProduction(state: GameState, player: PlayerId): TurnReport {
  const report = simulate(state, player, stockOf(state, player));
  // Wonders whose work goes on advance by one turn; the last one completes them.
  for (const r of report.buildings) {
    if (r.status.kind !== 'wonderBuilding') continue;
    const wonder = state.buildings.find((b) => b.id === r.buildingId);
    if (!wonder) continue;
    wonder.progress = (wonder.progress ?? 0) + 1;
    r.status = {
      kind: 'wonderBuilding',
      progress: wonder.progress,
      total: wonderConfig.buildTurns,
    };
    if (isWonderComplete(wonder)) {
      r.status = { kind: 'wonderComplete' };
      addEvent(state, {
        type: 'wonderCompleted',
        turn: state.turn,
        player,
        hex: wonder.hex,
        seenBy: state.players.map((p) => p.id),
      });
    }
  }
  return report;
}

/** Same result as `runProduction`, but changes nothing. */
export function previewProduction(state: GameState, player: PlayerId): TurnReport {
  return simulate(state, player, { ...stockOf(state, player) });
}
