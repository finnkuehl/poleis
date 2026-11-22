// Training candidates: one order per training building per turn (settlers at the city center;
// scouts, defenders and attackers at the barracks).

import { distance, neighbors } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { advanceCheck, cityIdOf, canAfford, foodIn } from '../core/rules';
import type { Building, City } from '../core/state';
import {
  aiConfig,
  CITY_LEVELS,
  GOOD_IDS,
  militaryConfig,
  UNITS,
  type Goods,
  type UnitId,
} from '../data';
import type { AiContext } from './context';
import { isCramped, mayExpandFrom, settleSites } from './settle';
import type { Candidate } from './types';
import { isCombat, landSearch, viewOf, type View } from './view';

const M = aiConfig.military;

/** Combat units alive plus ordered. */
function combatCount(ctx: AiContext, type?: UnitId): number {
  const own = ctx.state.units.filter(
    (u) => u.owner === ctx.player && (type ? u.type === type : isCombat(u)),
  ).length;
  const queued = ctx.state.training.filter(
    (t) =>
      t.owner === ctx.player &&
      (type ? t.unit === type : t.unit !== 'scout' && t.unit !== 'settler'),
  ).length;
  return own + queued;
}

/** Defenders the AI wants in total: per city, plus one where enemy units are near. */
export function defendersWanted(view: View, city: City): number {
  let wanted = M.defendersPerCity[view.ctx.personality];
  const near = view.enemies.filter(
    (e) => e.type !== 'settler' && distance(e.hex, city.center) <= M.threatRadius,
  );
  if (near.length > 0) wanted += M.threatExtraDefenders;
  return wanted;
}

function threatened(view: View, city: City): boolean {
  return view.enemies.some(
    (e) => e.type !== 'settler' && distance(e.hex, city.center) <= M.threatRadius,
  );
}

/** Army size (units on top of the defenders) the AI wants now. */
export function armyWanted(ctx: AiContext): number {
  const start = M.armyStartTurn[ctx.personality];
  if (ctx.turn < start) return 0;
  const grown = Math.floor((ctx.turn - start) / M.armyGrowEvery);
  return Math.min(M.armyMaxSize, M.armySize[ctx.personality] + grown);
}

/** Does the AI want bronze for units (raises the bronze-chain wish)? */
export function bronzeForUnits(ctx: AiContext): number {
  return ctx.count.barracks > 0 ? M.bronzeTarget[ctx.personality] : 0;
}

function exploredShare(view: View): number {
  let n = 0;
  for (const e of view.explored) if (e) n += 1;
  return n / Math.max(1, view.explored.length);
}

/** Has a frontier tile (explored land next to unexplored tiles) that can be walked to? */
function hasFrontier(view: View, barracks: Building): boolean {
  const map = view.state.map;
  const { order } = landSearch(view, barracks.hex);
  return order.some((i) =>
    neighbors(hexAtIndex(map, i)).some((n) => {
      const ni = tileIndex(map, n);
      return ni >= 0 && !view.explored[ni];
    }),
  );
}

function pickCombat(ctx: AiContext, city: City, role: 'defender' | 'attacker'): UnitId | null {
  const level = CITY_LEVELS.indexOf(city.level);
  const stock = ctx.stock;
  const can = (id: UnitId): boolean =>
    CITY_LEVELS.indexOf(UNITS[id].minLevel) <= level && canAfford(stock, UNITS[id].cost);
  if (role === 'defender' && can('hoplite') && stock.bronze >= M.hopliteMinBronze) return 'hoplite';
  // Archers hit from 2 tiles and are not countered by melee units: half the army.
  const archers = combatCount(ctx, 'archer');
  const melee = combatCount(ctx) - archers;
  if (role === 'attacker' && archers <= melee && can('archer')) return 'archer';
  if (can('spearman')) return 'spearman';
  if (can('archer')) return 'archer';
  return null;
}

/** Goods a city that is ready to advance still needs: units must not eat into them. */
function advanceKeep(ctx: AiContext): Goods {
  for (const ci of ctx.cities) {
    const check = advanceCheck(ctx.state, ci.city.id, ctx.production);
    if (check && check.to !== null && check.residents.ok && !check.canAdvance) {
      return check.cost.cost;
    }
  }
  return {};
}

export function trainingCandidates(ctx: AiContext): Candidate[] {
  const view = viewOf(ctx);
  const out: Candidate[] = [];
  const { state } = ctx;
  const foodAfter = ctx.foodProd - ctx.foodNeed - 1;
  const margin = M.unitFoodMargin[ctx.personality];
  const foodOk = foodAfter >= 0 || (foodAfter >= margin && foodIn(ctx.stock) >= M.unitFoodStockMin);
  // Drachma income per turn (before any pay) minus the pay of all units, the ones in training
  // and one more.
  const payAfter = ctx.drachmaIncome - (ctx.unitCount + 1) * militaryConfig.upkeepDrachmas;
  const payMargin = M.unitPayMargin[ctx.personality];
  const payOk =
    payAfter >= payMargin ||
    (payAfter >= payMargin - M.unitPayStockSlack[ctx.personality] &&
      ctx.stock.drachmas >= M.unitPayStockMin);
  const keep = advanceKeep(ctx);
  // Does paying for the unit leave what the advance of a city needs?
  const keeps = (unit: UnitId): boolean =>
    GOOD_IDS.every((g) => ctx.stock[g] - (UNITS[unit].cost[g] ?? 0) >= (keep[g] ?? 0));
  const makeAdd =
    (building: Building) =>
    (unit: UnitId, utility: number, reason: string): void => {
      if (utility < M.utility.trainDefenderUnderThreat && !keeps(unit)) return;
      out.push({
        action: { type: 'train', barracksId: building.id, unit },
        utility,
        reason,
        key: `train:${building.id}`,
        cost: UNITS[unit].cost,
      });
    };

  // Settlers come from the city center: the new city is worth more than any unit.
  for (const center of ctx.ownBuildings) {
    if (center.type !== 'cityCenter') continue;
    if (state.training.some((t) => t.barracksId === center.id)) continue;
    const city = ctx.cities.find((c) => c.city.id === cityIdOf(state, center))?.city;
    if (!city) continue;
    if (mayExpandFrom(ctx, city) && canAfford(ctx.stock, UNITS.settler.cost)) {
      if (settleSites(view, center.hex, 1).length > 0) {
        const cramped = isCramped(ctx, city);
        makeAdd(center)(
          'settler',
          cramped ? M.utility.trainSettlerCramped : M.utility.trainSettler,
          cramped ? 'settler: the city is cramped' : 'settler for a new city',
        );
      }
    }
  }

  for (const barracks of ctx.ownBuildings) {
    if (barracks.type !== 'barracks') continue;
    if (state.training.some((t) => t.barracksId === barracks.id)) continue;
    const city = ctx.cities.find((c) => c.city.id === cityIdOf(state, barracks))?.city;
    if (!city) continue;
    const add = makeAdd(barracks);
    if (!foodOk || !payOk) continue;

    // Scout.
    const scouts = combatCount(ctx, 'scout');
    const share = exploredShare(view);
    const scoutsWanted =
      M.scoutsWanted + (ctx.turn >= M.scoutSecondTurn && share < M.scoutSecondBelow ? 1 : 0);
    if (
      scouts < scoutsWanted &&
      share < M.scoutStopExplored &&
      canAfford(ctx.stock, UNITS.scout.cost) &&
      hasFrontier(view, barracks)
    ) {
      add('scout', M.utility.trainScout, 'scout');
    }

    // Defenders (urgent when enemy units are near).
    let wanted = 0;
    let under = false;
    for (const c of ctx.cities) {
      wanted += defendersWanted(view, c.city);
      under ||= threatened(view, c.city);
    }
    const have = combatCount(ctx);
    if (have < wanted) {
      const unit = pickCombat(ctx, city, 'defender');
      if (unit) {
        add(unit, under ? M.utility.trainDefenderUnderThreat : M.utility.trainDefender, 'defender');
        continue;
      }
    }
    // Attack force.
    if (have < wanted + armyWanted(ctx)) {
      const unit = pickCombat(ctx, city, 'attacker');
      if (unit) add(unit, M.utility.trainAttacker, 'army');
    }
  }
  return out;
}

/** Units the AI still wants to have (capped): the food wishes plan for their upkeep. */
export function missingUnits(ctx: AiContext): number {
  if (ctx.count.barracks === 0) return 0;
  const view = viewOf(ctx);
  let wanted = M.scoutsWanted + armyWanted(ctx);
  for (const c of ctx.cities) wanted += defendersWanted(view, c.city);
  return Math.min(M.unitFoodPlanCap, Math.max(0, wanted - ctx.unitCount));
}
