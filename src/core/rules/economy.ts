// Economy overview: where every good comes from and where it goes in the next turn.
// Estimated on a copy of the state the same way endTurn runs it (production, residents, units).

import { GOOD_IDS, type BuildingId, type GoodId, type Stock } from '../../data';
import type { GameState, PlayerId } from '../state';
import { connectedBuildingIds } from './connection';
import { runPopulation } from './population';
import { runProduction } from './production';
import { runUpkeep } from './units';
import { assignWorkers, canPrioritizeGood, housing, population, workersNeeded } from './workers';

export interface GoodFlow {
  good: GoodId;
  stock: number;
  /** source = BuildingId (aggregated per building type) or 'taxes'; count = buildings of that type. */
  produced: { source: string; amount: number; count: number }[];
  /** detail = BuildingId for buildings, the good for needs. */
  consumed: {
    source: 'building' | 'residents' | 'units' | 'needs';
    detail?: string;
    amount: number;
    count: number;
  }[];
  /** Net change per turn. */
  net: number;
  /** When net < 0: full turns the stock lasts (floor(stock / -net)), else null. */
  turnsLeft: number | null;
  /** The good is marked low priority by the player. */
  lowPriority: boolean;
  /** Some building type with workers produces this good, so the toggle makes sense. */
  canPrioritize: boolean;
}

export interface WorkerSummary {
  residents: number;
  housing: number;
  working: number;
  free: number;
  /** Workers still needed by connected, unpaused buildings that did not get a full crew. */
  missing: number;
}

export interface EconomyOverview {
  goods: GoodFlow[];
  workers: WorkerSummary;
}

/** Worker numbers of the player (changes nothing). */
export function workerSummary(state: GameState, player: PlayerId): WorkerSummary {
  const connected = connectedBuildingIds(state, player);
  const assigned = assignWorkers(state, player, connected);
  let working = 0;
  let missing = 0;
  for (const b of state.buildings) {
    if (b.owner !== player) continue;
    const got = assigned[b.id] ?? 0;
    working += got;
    const needed = workersNeeded(b);
    if (!b.paused && connected.has(b.id) && needed > 0 && got < needed) missing += needed - got;
  }
  const residents = population(state, player);
  let housingSum = 0;
  for (const c of state.cities) if (c.owner === player) housingSum += housing(state, c.id);
  return {
    residents,
    housing: housingSum,
    working,
    free: Math.max(0, residents - working),
    missing,
  };
}

type Produced = GoodFlow['produced'][number];
type Consumed = GoodFlow['consumed'][number];

/** Estimates the next turn's flows per good. The passed state is never changed. */
export function economyOverview(state: GameState, player: PlayerId): EconomyOverview {
  const workers = workerSummary(state, player);
  const me = state.players.find((p) => p.id === player);
  if (!me) throw new Error(`Unknown player ${player}`);
  const real = me.goods;
  const lowPriorityGoods = me.lowPriorityGoods;

  const sim = structuredClone(state);
  const stock: Stock = sim.players.find((p) => p.id === player)!.goods;
  const produced = new Map<GoodId, Produced[]>();
  const consumed = new Map<GoodId, Consumed[]>();

  const addProduced = (good: GoodId, source: string, amount: number, count = 1): void => {
    if (amount <= 0) return;
    const list = produced.get(good) ?? [];
    const found = list.find((p) => p.source === source);
    if (found) {
      found.amount += amount;
      found.count += count;
    } else list.push({ source, amount, count });
    produced.set(good, list);
  };
  const addConsumed = (
    good: GoodId,
    source: Consumed['source'],
    detail: string | undefined,
    amount: number,
    count = 1,
  ): void => {
    if (amount <= 0) return;
    const list = consumed.get(good) ?? [];
    const found = list.find((c) => c.source === source && c.detail === detail);
    if (found) {
      found.amount += amount;
      found.count += count;
    } else list.push({ source, detail, amount, count });
    consumed.set(good, list);
  };

  // 1. Production, attributed per building type.
  const report = runProduction(sim, player);
  for (const br of report.buildings) {
    const type: BuildingId | undefined = sim.buildings.find((b) => b.id === br.buildingId)?.type;
    if (!type) continue;
    for (const id of GOOD_IDS) {
      addProduced(id, type, br.produced[id] ?? 0);
      addConsumed(id, 'building', type, br.consumed[id] ?? 0);
    }
  }

  // 2. Residents: food, needs, taxes.
  for (const cr of runPopulation(sim, player)) {
    for (const id of GOOD_IDS) {
      addConsumed(id, 'residents', undefined, cr.foodEaten[id] ?? 0);
      addConsumed(id, 'needs', id, cr.needsConsumed[id] ?? 0);
    }
    addProduced('drachmas', 'taxes', cr.taxes);
  }

  // 3. Unit upkeep.
  const upkeep = runUpkeep(sim, player, stock);
  for (const id of GOOD_IDS)
    addConsumed(
      id,
      'units',
      undefined,
      (upkeep.upkeepEaten[id] ?? 0) + (id === 'drachmas' ? upkeep.upkeepPaid : 0),
    );

  const goods: GoodFlow[] = [];
  for (const id of GOOD_IDS) {
    const p = produced.get(id) ?? [];
    const c = consumed.get(id) ?? [];
    const net = p.reduce((s, x) => s + x.amount, 0) - c.reduce((s, x) => s + x.amount, 0);
    // A low-priority good keeps its row so the toggle can always be undone.
    if (real[id] <= 0 && p.length === 0 && c.length === 0 && !lowPriorityGoods.includes(id))
      continue;
    goods.push({
      good: id,
      stock: real[id],
      produced: p,
      consumed: c,
      net,
      turnsLeft: net < 0 ? Math.floor(real[id] / -net) : null,
      lowPriority: lowPriorityGoods.includes(id),
      canPrioritize: canPrioritizeGood(id),
    });
  }
  return { goods, workers };
}
