// Economy candidates: what the AI could build or do to feed, grow and advance its cities.
// Each wish has a base utility (data/ai.ts), multiplied by how urgent it is and by the
// personality weight. Built in four steps: needs from the economy overview, wishes that use
// goods (food, houses, chains, advancing ...), wishes for income buildings (they react to which
// goods the other wishes lack), then border towers and trading.

import type { Action } from '../core/actions';
import { neighbors, type Hex } from '../core/hex';
import { terrainAt, tileIndex } from '../core/map';
import {
  advanceCheck,
  canAfford,
  foodIn,
  missingGoods,
  territoryGain,
  towerUsage,
} from '../core/rules';
import {
  aiConfig,
  BUILDINGS,
  CITY_LEVELS,
  economyConfig,
  GOOD_IDS,
  populationConfig,
  type BuildingId,
  type GoodId,
  type Goods,
  type PersonalityWish,
  type TerrainId,
} from '../data';
import type { AiContext, CityInfo } from './context';
import { freePlainsOf, isCramped } from './settle';
import { bronzeForUnits } from './training';
import type { Candidate } from './types';

const U = aiConfig.utility;

/** A tile chosen for a building, with the road it needs. */
interface Site {
  hex: Hex;
  roadCost: number;
  score: number;
}

/** A wish that cannot be placed because the terrain it needs is not in the territory. */
interface StuckWish {
  terrains: readonly TerrainId[];
  utility: number;
}

interface Gen {
  ctx: AiContext;
  /** Wishes that spend goods (shortages are read from them). */
  demand: Candidate[];
  income: Candidate[];
  stuck: StuckWish[];
  sites: Map<BuildingId, Map<number, Site>>;
  /** Largest missing amount per good among the strongest unaffordable wishes. */
  shortage: Partial<Record<GoodId, number>>;
}

const key = (type: BuildingId, h: Hex): string => `build:${type}:${h.q},${h.r}`;

function addGoodsTo(a: Goods, b: Goods): Goods {
  const result: Goods = { ...a };
  for (const id of GOOD_IDS) {
    const sum = (a[id] ?? 0) + (b[id] ?? 0);
    if (sum > 0) result[id] = sum;
  }
  return result;
}

function roadGoods(tiles: number): Goods {
  const result: Goods = {};
  for (const id of GOOD_IDS) {
    const per = (economyConfig.roadCost as Goods)[id] ?? 0;
    if (per > 0) result[id] = per * tiles;
  }
  return result;
}

const levelIndex = (c: CityInfo): number => CITY_LEVELS.indexOf(c.city.level);
const weight = (ctx: AiContext, wish: PersonalityWish): number =>
  aiConfig.weights[ctx.personality][wish];

function coastal(ctx: AiContext, h: Hex): boolean {
  return neighbors(h).some((n) => terrainAt(ctx.state.map, n) === 'coast');
}

/** How good a tile is for the building (higher = better); ties go to the lowest tile index. */
function tileScore(ctx: AiContext, type: BuildingId, h: Hex, roadCost: number): number {
  const terrain = terrainAt(ctx.state.map, h);
  let score = -roadCost * aiConfig.roadTileCost;
  const onResource =
    (type === 'woodcutter' && terrain === 'forest') ||
    (type === 'quarry' && (terrain === 'hills' || terrain === 'mountains'));
  if (onResource) score += aiConfig.onResourceBonus;
  if (terrain === 'plains' && type !== 'fishery' && coastal(ctx, h)) {
    score -= aiConfig.coastalPlainsPenalty;
  }
  if (terrain === 'hills' && type !== 'quarry' && type !== 'vineyard') {
    score -= aiConfig.hillsPenalty;
  }
  return score;
}

/** The best valid tile per city for a building type (cached). */
function sitesFor(g: Gen, type: BuildingId): Map<number, Site> {
  const cached = g.sites.get(type);
  if (cached) return cached;
  const { ctx } = g;
  const needsRoad = BUILDINGS[type].workers > 0;
  const result = new Map<number, Site>();
  for (const h of ctx.placements(type)) {
    const cityId = ctx.state.tileCity[tileIndex(ctx.state.map, h)];
    let roadCost = 0;
    if (needsRoad) {
      const info = ctx.roadInfo(h);
      if (!info) continue;
      roadCost = info.cost;
    }
    const score = tileScore(ctx, type, h, roadCost);
    const best = result.get(cityId);
    if (!best || score > best.score) result.set(cityId, { hex: h, roadCost, score });
  }
  g.sites.set(type, result);
  return result;
}

/** How much a worker building suffers from a lack of free workers (shared by all cities). */
function workerFactor(ctx: AiContext, type: BuildingId): number {
  // The wonder is worth building before its crew is there (more housing and food follow).
  if (type === 'wonder') return 1;
  const need = BUILDINGS[type].workers;
  if (need === 0 || ctx.slack >= need) return 1;
  const freeHousing = ctx.cities.reduce((sum, c) => sum + c.freeHousing, 0);
  const growing = freeHousing > 0 && ctx.foodProd - ctx.foodNeed >= 1;
  if (BUILDINGS[type].category === 'food') return aiConfig.foodNoWorkersFactor;
  if (growing && ctx.slack + Math.min(freeHousing, aiConfig.futureWorkerHousing) >= need)
    return aiConfig.growingFactor;
  return aiConfig.noFreeWorkersFactor;
}

interface WishOptions {
  /** Keep the goods for it while it is not affordable. */
  reserve?: boolean;
  /** Income building: may use reserved goods. */
  income?: boolean;
  /** Essential (food): may use reserved goods and the goods the AI always keeps. */
  essential?: boolean;
  /** Personality weight of this wish. */
  wish?: PersonalityWish;
  /** Where it goes in: `demand` (default) or `income`. */
  list?: 'demand' | 'income';
  /** Terrain to claim with a tower if no tile is valid. */
  terrainIfStuck?: readonly TerrainId[];
  /** Only this city. */
  city?: CityInfo;
}

/** Terrains a building of this type can stand on (what a tower should claim if no tile is left). */
function stuckTerrains(type: BuildingId): TerrainId[] {
  if (type === 'fishery') return [];
  const result: TerrainId[] = [];
  for (const option of BUILDINGS[type].placement) {
    for (const t of option.on) if (!result.includes(t)) result.push(t);
  }
  return result;
}

/** Adds a build candidate for the best tile of every city (or records that the wish is stuck). */
function wishBuilding(
  g: Gen,
  type: BuildingId,
  base: number,
  reason: string,
  opts: WishOptions = {},
): boolean {
  const { ctx } = g;
  const w = opts.wish ? weight(ctx, opts.wish) : 1;
  const sites = sitesFor(g, type);
  let any = false;
  for (const ci of ctx.cities) {
    if (opts.city && opts.city !== ci) continue;
    const site = sites.get(ci.city.id);
    if (!site) continue;
    any = true;
    const cost = addGoodsTo(BUILDINGS[type].cost, roadGoods(site.roadCost));
    const candidate: Candidate = {
      action: { type: 'build', building: type, hex: site.hex },
      utility: base * w * workerFactor(ctx, type),
      reason,
      key: key(type, site.hex),
      cost,
      reserve: opts.reserve,
      bypassReserve: opts.income || opts.essential,
    };
    (opts.list === 'income' ? g.income : g.demand).push(candidate);
  }
  if (!any) {
    // No valid tile: a tower may claim land of the terrain the building needs (a fishery needs
    // the coast, which a tower cannot bring).
    const terrains = opts.terrainIfStuck ?? stuckTerrains(type);
    if (terrains.length > 0) g.stuck.push({ terrains, utility: base * w * U.towerForTerrain });
  }
  return any;
}

/** Food numbers: net now, and net after the residents have grown for a few turns. */
function foodSituation(ctx: AiContext): { net: number; projNet: number } {
  const net = ctx.foodProd - ctx.foodNeed;
  let needNow = 0;
  let needProj = 0;
  for (const ci of ctx.cities) {
    const res = ci.city.residents;
    const grow = populationConfig.growthPerTurn[ci.city.level] * aiConfig.foodLookAheadTurns;
    const proj = Math.max(res, Math.min(ci.housing, res + grow));
    needNow += Math.ceil(res / populationConfig.residentsPerFood);
    needProj += Math.ceil(proj / populationConfig.residentsPerFood);
  }
  return { net, projNet: net + needNow - needProj };
}

/** Food: fishery first (cheap), else a farm (grain is food, so one building is enough). */
function foodWishes(g: Gen): void {
  const { ctx } = g;
  const nCities = ctx.cities.length;
  const food = foodSituation(ctx);
  const deficit = aiConfig.foodNetTarget - food.projNet;
  const stockFood = foodIn(ctx.stock);
  let urgency =
    deficit > 0 ? 1 + Math.min(aiConfig.foodUrgencyMax, deficit / aiConfig.foodUrgencyDivisor) : 0;
  if (stockFood >= aiConfig.foodStockHalvesUrgency) urgency /= 2;

  const fisheryTiles = sitesFor(g, 'fishery').size > 0;
  const maxFish = aiConfig.maxPerCity.fishery * nCities;
  const maxFarm = aiConfig.maxPerCity.farm * nCities;
  if (urgency > 0 && fisheryTiles && ctx.count.fishery < maxFish && ctx.pending.fishery === 0) {
    wishBuilding(g, 'fishery', U.food * urgency, 'food: fishery', { essential: true });
  }
  const fisheriesDone = !fisheryTiles || ctx.count.fishery >= maxFish;
  if (urgency > 0 && fisheriesDone && ctx.count.farm < maxFarm && ctx.pending.farm === 0) {
    wishBuilding(g, 'farm', U.food * aiConfig.farmFactor * urgency, 'food: farm', {
      essential: true,
    });
  }
}

/** The world wonder is still to be built or not complete yet. */
function wonderUnfinished(ctx: AiContext): boolean {
  return (
    ctx.count.wonder === 0 ||
    ctx.ownBuildings.some((b) => b.type === 'wonder' && ctx.statusOf.get(b.id) !== 'wonderComplete')
  );
}

/** Houses when a city runs out of housing and the food can carry more residents. */
function houseWishes(g: Gen): void {
  const { ctx } = g;
  const food = foodSituation(ctx);
  if (food.net < aiConfig.houseMinFoodNet[ctx.personality]) return;
  if (aiConfig.houseNeedsFoodCover[ctx.personality] && food.projNet < 0) return;
  for (const ci of ctx.cities) {
    // The last free plains tile of a cramped civilization without a barracks is kept for it.
    if (ctx.count.barracks === 0 && freePlainsOf(ctx, ci.city) <= 1 && isCramped(ctx, ci.city)) {
      continue;
    }
    let buffer = aiConfig.houseBuffer[ctx.personality];
    // A Metropolis needs room for the wonder's crew.
    if (ci.city.level === 'metropolis') buffer = Math.max(buffer, aiConfig.metropolisHouseBuffer);
    // No spare workers for a wished building: more housing means more workers.
    const crew =
      ci.city.level === 'metropolis' && wonderUnfinished(ctx) ? BUILDINGS.wonder.workers : 1;
    const needsWorkers = ctx.slack < crew && ci.freeHousing <= aiConfig.needsWorkersMaxFreeHousing;
    if (ci.freeHousing > buffer && !needsWorkers) continue;
    const prepare =
      ci.city.level === 'settlement' && ci.housing < aiConfig.preparePolisHousing
        ? aiConfig.preparePolisFactor
        : 1;
    const short = ctx.slack < 0 ? aiConfig.workerShortHouseFactor : 1;
    wishBuilding(g, 'house', U.house * prepare * short, 'housing', { wish: 'house', city: ci });
  }
}

/** Advancing, and keeping the goods for an advance that only waits for goods. */
function advanceWishes(g: Gen): void {
  const { ctx } = g;
  for (const ci of ctx.cities) {
    const check = advanceCheck(ctx.state, ci.city.id, ctx.production);
    if (!check || check.to === null) continue;
    if (check.canAdvance) {
      g.demand.push({
        action: { type: 'advanceCity', cityId: ci.city.id },
        utility: U.advance,
        reason: `advance to ${check.to}`,
        key: `advance:${ci.city.id}`,
        cost: check.cost.cost,
      });
    } else if (check.residents.ok && check.supply.ok) {
      g.demand.push({
        action: null,
        utility: U.advanceReserve,
        reason: `save for ${check.to}`,
        key: `save:${ci.city.id}`,
        cost: check.cost.cost,
        reserve: true,
      });
    }
  }
}

/** Oil, wine and bronze chains that prepare the next city levels. */
function chainWishes(g: Gen): void {
  const { ctx } = g;
  const cfg = aiConfig;
  const cities = ctx.cities;
  const anyLevel = (level: number, minRes: number): boolean =>
    cities.some((c) => levelIndex(c) === level && c.city.residents >= minRes);
  const atLeast = (level: number): boolean => cities.some((c) => levelIndex(c) >= level);

  // Production still missing for an advance (made vs needed, see `advanceCheck`): a city
  // prepares its advance once it is nearly big enough. Oil/wine already used by Polis /
  // Metropolis cities are covered by the net target.
  const supplyShort = (good: GoodId, level: number, minRes: number): number => {
    let short = 0;
    for (const ci of cities) {
      if (levelIndex(ci) !== level || ci.city.residents < minRes) continue;
      const check = advanceCheck(ctx.state, ci.city.id, ctx.production);
      if (check && check.to !== null && check.supply.good === good) {
        short = Math.max(short, check.supply.needed - check.supply.made);
      }
    }
    return short;
  };

  // Oil: needed from Polis on, prepared by a settlement that is nearly big enough.
  const oilNeedy = anyLevel(0, cfg.oilChainResidents) || atLeast(1);
  if (
    oilNeedy &&
    (ctx.net.oil < cfg.oilNetTarget || supplyShort('oil', 0, cfg.oilChainResidents) > 0)
  ) {
    const groveCap = cfg.maxPerCity.oliveGrove * cities.length;
    if (ctx.count.oliveGrove <= ctx.count.oilPress) {
      if (ctx.count.oliveGrove < groveCap && ctx.pending.oliveGrove === 0) {
        wishBuilding(g, 'oliveGrove', U.oilChain, 'oil: grove', { reserve: true });
      }
    } else if (ctx.pending.oilPress === 0) {
      wishBuilding(g, 'oilPress', U.oilChain * cfg.chainSecondFactor, 'oil: press', {
        reserve: true,
      });
    }
  }

  // Wine: from a big Polis on.
  const wineNeedy = anyLevel(1, cfg.wineChainResidents) || atLeast(2);
  if (
    wineNeedy &&
    (ctx.net.wine < cfg.wineNetTarget || supplyShort('wine', 1, cfg.wineChainResidents) > 0)
  ) {
    if (ctx.count.vineyard <= ctx.count.winery) {
      if (
        ctx.count.vineyard < cfg.maxPerCity.vineyard * cities.length &&
        ctx.pending.vineyard === 0
      ) {
        wishBuilding(g, 'vineyard', U.wineChain, 'wine: vineyard', {
          reserve: true,
          terrainIfStuck: ['hills'],
        });
      }
    } else if (ctx.pending.winery === 0) {
      wishBuilding(g, 'winery', U.wineChain * cfg.chainSecondFactor, 'wine: winery', {
        reserve: true,
      });
    }
  }

  // Bronze: for the Metropolis advance and the wonder.
  const levelAim = atLeast(2)
    ? cfg.bronzeStockTarget.metropolis
    : anyLevel(1, cfg.bronzeChainResidents)
      ? cfg.bronzeStockTarget.polis
      : 0;
  // Units cost bronze, too (the AI with a barracks wants some in stock).
  const unitAim = bronzeForUnits(ctx);
  const wonderDone = ctx.count.wonder > 0;
  const bronzeAim = Math.max(wonderDone ? 0 : levelAim, unitAim);
  if (bronzeAim > 0 && ctx.stock.bronze < bronzeAim) {
    if (ctx.count.mine <= ctx.count.smelter) {
      if (ctx.count.mine < cfg.maxMines && ctx.pending.mine === 0) {
        wishBuilding(g, 'mine', U.bronzeChain, 'bronze: mine', {
          reserve: true,
          terrainIfStuck: ['mountains'],
        });
      }
    } else if (ctx.pending.smelter === 0) {
      wishBuilding(g, 'smelter', U.bronzeChain * cfg.chainSecondFactor, 'bronze: smelter', {
        reserve: true,
      });
    }
  }
}

/** Marketplace, temple, barracks and the wonder: they depend on the personality. */
function optionalWishes(g: Gen): void {
  const { ctx } = g;
  const cfg = aiConfig;
  const stock = ctx.stock;

  if (ctx.count.marketplace === 0 && sitesFor(g, 'marketplace').size > 0) {
    wishBuilding(g, 'marketplace', U.marketplace, 'marketplace', { wish: 'marketplace' });
  }
  const templeDef = BUILDINGS.temple.cost;
  if (
    ctx.count.temple < cfg.maxTemples[ctx.personality] &&
    stock.stone >= (templeDef.stone ?? 0) + cfg.templeKeepStone &&
    stock.oil >= (templeDef.oil ?? 0) + cfg.templeKeepOil
  ) {
    wishBuilding(g, 'temple', U.temple, 'temple', { wish: 'temple' });
  }
  if (ctx.count.barracks === 0 && ctx.turn >= cfg.barracksStartTurn[ctx.personality]) {
    wishBuilding(g, 'barracks', U.barracks, 'barracks', { wish: 'barracks' });
  } else if (ctx.count.barracks === 0 && ctx.cities.some((c) => isCramped(ctx, c.city))) {
    // A cramped civilization builds the barracks at once, while a free plains tile is left:
    // without it there are no scouts and no way to find a place for settlers.
    wishBuilding(g, 'barracks', U.barracksCramped, 'barracks (cramped)', { reserve: true });
  }
  if (
    ctx.count.wonder === 0 &&
    ctx.turn >= cfg.wonderFromTurn &&
    ctx.cities.some((c) => c.city.level === 'metropolis')
  ) {
    // (If the Metropolis has no free plains, the wish is stuck and a tower claims more land.)
    wishBuilding(g, 'wonder', U.wonder, 'world wonder', { wish: 'wonder', reserve: true });
  }
}

/** Sets `g.shortage` from the strongest wishes that cannot be paid yet. */
function computeShortage(g: Gen): void {
  const top = [...g.demand]
    .sort((a, b) => b.utility - a.utility)
    .slice(0, aiConfig.shortageTopWishes);
  for (const c of top) {
    const missing = missingGoods(g.ctx.stock, c.cost ?? {});
    for (const id of GOOD_IDS) {
      const m = missing[id] ?? 0;
      if (m > 0) g.shortage[id] = Math.max(g.shortage[id] ?? 0, m);
    }
  }
}

/** Woodcutters, quarries and sawmills, driven by the income targets and by what is missing. */
function incomeWishes(g: Gen): void {
  const { ctx } = g;
  const cfg = aiConfig;
  const nCities = ctx.cities.length;
  const bonus = cfg.incomeShortageBonus;
  const level = Math.max(0, ...ctx.cities.map(levelIndex));
  const sat = cfg.stockSatiation;

  const planksTarget = cfg.incomeTarget.planks + ((g.shortage.planks ?? 0) > 0 ? bonus : 0);
  const planksWanted = ctx.net.planks < planksTarget && ctx.stock.planks < sat.planks;
  // Wood must also feed a sawmill that is wanted.
  const woodTarget =
    cfg.incomeTarget.wood +
    ((g.shortage.wood ?? 0) > 0 ? bonus : 0) +
    (planksWanted && ctx.count.sawmill < cfg.maxPerCity.sawmill * nCities
      ? cfg.sawmillWoodNeeded
      : 0);
  const stoneTarget =
    cfg.incomeTarget.stone +
    ((g.shortage.stone ?? 0) > 0 ? bonus : 0) +
    cfg.stoneIncomePerLevel * level;

  const wished = (
    type: BuildingId,
    base: number,
    reason: string,
    target: number,
    net: number,
    terrains: readonly TerrainId[],
  ) => {
    const deficit = target - net;
    wishBuilding(
      g,
      type,
      base * (1 + Math.min(cfg.incomeDeficitCap, deficit / Math.max(1, target))),
      reason,
      {
        income: true,
        list: 'income',
        terrainIfStuck: terrains,
      },
    );
  };

  if (
    ctx.net.wood < woodTarget &&
    ctx.stock.wood < sat.wood &&
    ctx.pending.woodcutter === 0 &&
    ctx.count.woodcutter < cfg.maxPerCity.woodcutter * nCities
  ) {
    wished('woodcutter', U.woodcutter, 'income: wood', woodTarget, ctx.net.wood, ['forest']);
  }
  if (
    ctx.net.stone < stoneTarget &&
    ctx.stock.stone < sat.stone &&
    ctx.pending.quarry === 0 &&
    ctx.count.quarry < cfg.maxPerCity.quarry * nCities
  ) {
    wished('quarry', U.quarry, 'income: stone', stoneTarget, ctx.net.stone, ['hills', 'mountains']);
  }
  if (
    planksWanted &&
    ctx.pending.sawmill === 0 &&
    ctx.count.sawmill < cfg.maxPerCity.sawmill * nCities &&
    (ctx.net.wood >= cfg.sawmillWoodNeeded * (ctx.count.sawmill + 1) ||
      ctx.stock.wood >= cfg.sawmillWoodStock)
  ) {
    wished('sawmill', U.sawmill, 'income: planks', planksTarget, ctx.net.planks, []);
  }
}

/** Border towers: for terrain a wish needs, when plains run out, and to grow. */
function towerWishes(g: Gen): void {
  const { ctx } = g;
  const cfg = aiConfig;
  if (ctx.count.borderTower >= cfg.maxTowers) return;
  const sites = ctx.placements('borderTower');
  if (sites.length === 0) return;
  const radius = BUILDINGS.borderTower.territoryRadius;

  // The tile whose new land is worth the most (needed terrain counts extra).
  const best = (needed: readonly TerrainId[]): { hex: Hex; gain: number; value: number } | null => {
    let result: { hex: Hex; gain: number; value: number } | null = null;
    for (const h of sites) {
      const gained = territoryGain(ctx.state, h, radius);
      if (gained.length < cfg.towerMinGain) continue;
      // The last watchtower a city may build: spend it on the most land, not on one terrain.
      // A cramped city (almost no free plains) wants plains above all and ignores the needed
      // terrain: it can only grow by claiming plains.
      const cityId = ctx.state.tileCity[tileIndex(ctx.state.map, h)];
      const usage = towerUsage(ctx.state, ctx.player, cityId);
      const lastSlot = usage.max - usage.used <= 1;
      const city = ctx.state.cities.find((c) => c.id === cityId);
      const cramped = lastSlot && city !== undefined && isCramped(ctx, city);
      let value = 0;
      let hasNeeded = needed.length === 0 || cramped;
      for (const t of gained) {
        const terrain = terrainAt(ctx.state.map, t) as TerrainId;
        const isNeeded = needed.includes(terrain);
        if (isNeeded) hasNeeded = true;
        value +=
          isNeeded && !lastSlot
            ? cfg.neededTerrainValue
            : cramped && terrain === 'plains'
              ? cfg.crampedPlainsValue
              : cfg.tileValue[terrain];
      }
      if (!hasNeeded) continue;
      if (terrainAt(ctx.state.map, h) === 'plains') value -= cfg.towerOnPlainsPenalty;
      if (!result || value > result.value) result = { hex: h, gain: gained.length, value };
    }
    return result;
  };

  const push = (
    needed: readonly TerrainId[],
    utility: number,
    reason: string,
    reserve = false,
  ): void => {
    const pick = best(needed);
    if (!pick) return;
    g.demand.push({
      action: { type: 'build', building: 'borderTower', hex: pick.hex },
      utility,
      reason,
      key: key('borderTower', pick.hex),
      cost: BUILDINGS.borderTower.cost,
      reserve,
    });
  };

  for (const s of g.stuck) {
    if (s.terrains.length > 0) push(s.terrains, s.utility, 'tower: terrain for a wish');
  }
  // Free plains left (coastal ones are kept for fisheries).
  let freePlains = 0;
  for (const i of ctx.ownTiles) {
    if (ctx.state.map.tiles[i] !== 'plains' || ctx.state.roads[i]) continue;
    freePlains += 1;
  }
  for (const b of ctx.ownBuildings) {
    if (terrainAt(ctx.state.map, b.hex) === 'plains') freePlains -= 1;
  }
  // Only once the first woodcutter works (the first wood goes to the first buildings).
  const basicsDone = ctx.count.woodcutter > 0;
  if (freePlains < cfg.freePlainsMin && basicsDone)
    push([], U.towerForPlains, 'tower: plains run out', true);
  if (ctx.stock.wood >= cfg.expandMinStock.wood && ctx.stock.stone >= cfg.expandMinStock.stone) {
    push([], U.towerToExpand * weight(ctx, 'expand'), 'tower: expand');
  }
}

/** Selling a big surplus and buying the few goods that block an important wish. */
function tradeWishes(g: Gen): Candidate[] {
  const { ctx } = g;
  const cfg = aiConfig;
  if (!ctx.canTrade) return [];
  const out: Candidate[] = [];
  const { sellAmount, buyPrice } = economyConfig.market;
  const w = weight(ctx, 'trade');
  for (const good of GOOD_IDS) {
    if (good === 'drachmas') continue;
    const have = ctx.stock[good];
    if (have <= cfg.sellAbove) continue;
    const lots = Math.min(cfg.sellMaxLots, Math.floor((have - cfg.sellKeep) / sellAmount));
    if (lots < 1) continue;
    out.push({
      action: { type: 'trade', good, direction: 'sell', lots },
      utility: U.sell * w,
      reason: `sell surplus ${good}`,
      key: `sell:${good}`,
      cost: { [good]: lots * sellAmount },
    });
  }
  // Buy what blocks the strongest wish if that is only a few goods and the drachmas allow it.
  const blocked = [...g.demand]
    .filter((c) => !canAfford(ctx.stock, c.cost ?? {}))
    .sort((a, b) => b.utility - a.utility)[0];
  if (blocked) {
    const missing = missingGoods(ctx.stock, blocked.cost ?? {});
    const goods = GOOD_IDS.filter((id) => id !== 'drachmas' && (missing[id] ?? 0) > 0);
    const total = goods.reduce((sum, id) => sum + (missing[id] ?? 0), 0);
    const onlyGoods = (missing.drachmas ?? 0) === 0;
    const maxGoods =
      ctx.stock.drachmas >= cfg.buyRichDrachmas ? cfg.buyMaxGoodsRich : cfg.buyMaxGoods;
    if (onlyGoods && total > 0 && total <= maxGoods) {
      if (ctx.stock.drachmas >= total * buyPrice + cfg.buyKeepDrachmas) {
        for (const good of goods) {
          const lots = missing[good] ?? 0;
          out.push({
            action: { type: 'trade', good, direction: 'buy', lots },
            utility: U.buy * w,
            reason: `buy ${good} for ${blocked.reason}`,
            key: `buy:${good}`,
            cost: { drachmas: lots * buyPrice },
          });
        }
      }
    }
  }
  return out;
}

/** Connecting every unconnected building that needs workers to the road network. */
export function roadCandidates(ctx: AiContext): Candidate[] {
  const out: Candidate[] = [];
  for (const b of ctx.ownBuildings) {
    if (BUILDINGS[b.type].workers <= 0) continue;
    if (ctx.connectedTile[tileIndex(ctx.state.map, b.hex)]) continue;
    const info = ctx.roadInfo(b.hex);
    if (!info || !info.target || info.cost === 0) continue;
    const action: Action = { type: 'buildRoad', from: b.hex, to: info.target };
    out.push({
      action,
      utility: U.connectRoad,
      reason: `connect ${b.type}`,
      key: `road:${b.id}`,
      cost: roadGoods(info.cost),
      reserve: true,
      bypassReserve: true,
    });
  }
  return out;
}

/** All economy candidates for the current situation. */
export function economyCandidates(ctx: AiContext): Candidate[] {
  const g: Gen = { ctx, demand: [], income: [], stuck: [], sites: new Map(), shortage: {} };
  foodWishes(g);
  houseWishes(g);
  advanceWishes(g);
  chainWishes(g);
  optionalWishes(g);
  computeShortage(g);
  incomeWishes(g);
  towerWishes(g);
  return [...g.demand, ...g.income, ...tradeWishes(g)];
}
