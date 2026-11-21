// The AI's view of its own situation, computed once per decision. It only reads what the player
// may know: its own stock, buildings, cities and territory (nothing about other civilizations).

import {
  aiConfig,
  AI_CIVS,
  BUILDINGS,
  GOOD_IDS,
  populationConfig,
  TERRAIN,
  type BuildingId,
  type GoodId,
  type Personality,
  type Stock,
} from '../data';
import {
  checkPlacement,
  economyOverview,
  housing,
  previewProduction,
  workerSummary,
  workersNeeded,
  cityIdOf,
  type BuildingStatus,
  type WorkerSummary,
} from '../core/rules';
import { neighbors, type Hex } from '../core/hex';
import { hexAtIndex, inBounds, tileIndex } from '../core/map';
import type { Building, City, GameState, PlayerId } from '../core/state';

export interface CityInfo {
  city: City;
  housing: number;
  /** Housing minus residents. */
  freeHousing: number;
  /** Residents minus the workers all (unpaused) buildings of the city need; negative = short. */
  slack: number;
}

const INF = 1 << 20;

export interface AiContext {
  state: GameState;
  player: PlayerId;
  personality: Personality;
  stock: Stock;
  turn: number;
  /** Estimated net change per good next turn. */
  net: Record<GoodId, number>;
  /** Food (fish + bread) produced per turn, and eaten by the residents if they get all they need. */
  foodProd: number;
  foodNeed: number;
  workers: WorkerSummary;
  cities: CityInfo[];
  ownBuildings: Building[];
  /** Number of own buildings per type. */
  count: Record<BuildingId, number>;
  /** Own buildings that will produce once they get workers / a road (not yet doing so). */
  pending: Record<BuildingId, number>;
  /** Number of own buildings per type that actually work (producing or open for business). */
  working: Record<BuildingId, number>;
  statusOf: Map<number, BuildingStatus['kind']>;
  /** Indices of the player's own territory tiles. */
  ownTiles: number[];
  /** Per tile index: part of the road network connected to a storage building. */
  connectedTile: boolean[];
  /** Per tile index: new road tiles needed to reach the network (INF = unreachable). */
  roadDist: Int32Array;
  /** Per tile index: the next tile towards the network. */
  roadParent: Int32Array;
  /** Own units alive plus units ordered in a barracks (all eat 1 food per turn). */
  unitCount: number;
  /** Keys of candidates that failed or were applied once this turn (set by the turn driver). */
  skip: ReadonlySet<string>;
  /** Marketplace trading is possible. */
  canTrade: boolean;
  /** Tiles where `type` may be built (cost ignored), in index order. Cached. */
  placements(type: BuildingId): Hex[];
  /** Road tiles needed to connect a building standing on `hex` (0 = already connected). */
  roadInfo(hex: Hex): { cost: number; target: Hex | null } | null;
}

function emptyCounts(): Record<BuildingId, number> {
  const result = {} as Record<BuildingId, number>;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) result[id] = 0;
  return result;
}

/** Breadth-first search over the connected network (same rule as `connectedBuildingIds`). */
function connectedTiles(state: GameState, player: PlayerId, own: Building[]): boolean[] {
  const map = state.map;
  const visited = map.tiles.map(() => false);
  const hasBuilding = map.tiles.map(() => false);
  for (const b of own) hasBuilding[tileIndex(map, b.hex)] = true;
  let queue: number[] = [];
  for (const b of own) {
    if (!BUILDINGS[b.type].isStorage) continue;
    const i = tileIndex(map, b.hex);
    if (!visited[i]) {
      visited[i] = true;
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const next: number[] = [];
    for (const i of queue) {
      for (const n of neighbors(hexAtIndex(map, i))) {
        if (!inBounds(map, n)) continue;
        const ni = tileIndex(map, n);
        if (visited[ni]) continue;
        if (!(hasBuilding[ni] || (state.roads[ni] && state.territory[ni] === player))) continue;
        visited[ni] = true;
        next.push(ni);
      }
    }
    queue = next;
  }
  return visited;
}

export function buildContext(state: GameState, player: PlayerId): AiContext {
  const me = state.players.find((p) => p.id === player);
  if (!me) throw new Error(`Unknown player ${player}`);
  const personality: Personality = me.civ ? AI_CIVS[me.civ].personality : 'builder';
  const map = state.map;

  const overview = economyOverview(state, player);
  const net = {} as Record<GoodId, number>;
  for (const id of GOOD_IDS) net[id] = 0;
  for (const flow of overview.goods) net[flow.good] = flow.net;
  const workers = workerSummary(state, player);
  // Food produced vs needed: the overview's net is capped by the stock (residents cannot eat
  // what is not there), so it hides how big a shortage really is.
  let foodProd = 0;
  for (const flow of overview.goods) {
    if (flow.good === 'fish' || flow.good === 'bread') {
      for (const p of flow.produced) foodProd += p.amount;
    }
  }

  const ownBuildings = state.buildings.filter((b) => b.owner === player);
  const report = previewProduction(state, player);
  const statusOf = new Map<number, BuildingStatus['kind']>();
  for (const r of report.buildings) statusOf.set(r.buildingId, r.status.kind);
  const count = emptyCounts();
  const pending = emptyCounts();
  const working = emptyCounts();
  for (const b of ownBuildings) {
    count[b.type] += 1;
    const kind = statusOf.get(b.id);
    if (kind === 'notConnected' || kind === 'missingWorkers') pending[b.type] += 1;
    if (kind === 'producing' || kind === 'working' || kind === 'wonderBuilding') {
      working[b.type] += 1;
    }
  }

  // Cities with their free housing and free workers (residents - workers the buildings need).
  // A city that is about to starve counts only the residents its food can keep.
  const ownCities = state.cities.filter((c) => c.owner === player);
  const foodStock = me.goods.fish + me.goods.bread;
  let eatenNow = 0;
  for (const c of ownCities) eatenNow += Math.ceil(c.residents / populationConfig.residentsPerFood);
  // Residents the food can keep (a stock of food hides a shortage for a while).
  const sustainable = Math.max(
    populationConfig.minResidents,
    Math.floor((foodProd * populationConfig.residentsPerFood) / Math.max(1, ownCities.length)),
  );
  const foodSafe = foodStock >= aiConfig.foodStockSafe;
  const cities: CityInfo[] = ownCities.map((city) => {
    const h = housing(state, city.id);
    let needed = 0;
    for (const b of ownBuildings) {
      if (!b.paused && cityIdOf(state, b) === city.id) needed += workersNeeded(b);
    }
    const residents = foodSafe ? city.residents : Math.min(city.residents, sustainable);
    return { city, housing: h, freeHousing: h - city.residents, slack: residents - needed };
  });

  const unitCount =
    state.units.filter((u) => u.owner === player).length +
    state.training.filter((t) => t.owner === player).length;
  const ownTiles: number[] = [];
  for (let i = 0; i < state.territory.length; i++)
    if (state.territory[i] === player) ownTiles.push(i);

  // Road network and the cheapest way to it from everywhere (0-1 breadth-first search).
  const connectedTile = connectedTiles(state, player, ownBuildings);
  const hasOwnBuilding = map.tiles.map(() => false);
  for (const b of ownBuildings) hasOwnBuilding[tileIndex(map, b.hex)] = true;
  const passable = (i: number): boolean =>
    state.territory[i] === player && (hasOwnBuilding[i] || TERRAIN[map.tiles[i]].moveCost !== null);
  const roadDist = new Int32Array(map.tiles.length).fill(INF);
  const roadParent = new Int32Array(map.tiles.length).fill(-1);
  const levels: number[][] = [[]];
  for (let i = 0; i < connectedTile.length; i++) {
    if (connectedTile[i]) {
      roadDist[i] = 0;
      levels[0].push(i);
    }
  }
  for (let d = 0; d < levels.length; d++) {
    const queue = levels[d];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      if (roadDist[i] !== d) continue;
      for (const n of neighbors(hexAtIndex(map, i))) {
        const ni = tileIndex(map, n);
        if (ni < 0 || !passable(ni)) continue;
        const nd = d + (state.roads[ni] || hasOwnBuilding[ni] ? 0 : 1);
        if (nd < roadDist[ni]) {
          roadDist[ni] = nd;
          roadParent[ni] = i;
          (levels[nd] ??= []).push(ni);
        }
      }
    }
  }

  const placementCache = new Map<BuildingId, Hex[]>();
  const ctx: AiContext = {
    state,
    player,
    personality,
    stock: me.goods,
    turn: state.turn,
    net,
    foodProd,
    foodNeed: eatenNow + unitCount,
    unitCount,
    skip: new Set<string>(),
    workers,
    cities,
    ownBuildings,
    count,
    pending,
    working,
    statusOf,
    ownTiles,
    connectedTile,
    roadDist,
    roadParent,
    canTrade: ownBuildings.some(
      (b) => b.type === 'marketplace' && statusOf.get(b.id) === 'working',
    ),
    placements(type) {
      let list = placementCache.get(type);
      if (!list) {
        list = [];
        for (const i of ownTiles) {
          const h = hexAtIndex(map, i);
          if (checkPlacement(state, player, type, h, { ignoreCost: true }) === null) list.push(h);
        }
        placementCache.set(type, list);
      }
      return list;
    },
    roadInfo(hex) {
      const i = tileIndex(map, hex);
      if (i < 0) return null;
      let best = -1;
      for (const n of neighbors(hex)) {
        const ni = tileIndex(map, n);
        if (ni < 0 || roadDist[ni] >= INF) continue;
        if (connectedTile[ni]) return { cost: 0, target: null };
        if (best < 0 || roadDist[ni] < roadDist[best]) best = ni;
      }
      if (best < 0) return null;
      // Follow the parents to the connected tile where the new road ends.
      let at = best;
      while (roadParent[at] >= 0 && !connectedTile[at]) at = roadParent[at];
      return { cost: roadDist[best], target: hexAtIndex(map, at) };
    },
  };
  return ctx;
}
