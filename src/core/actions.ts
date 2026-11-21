// All player actions and applyAction(state, action) -> new state or error.

import {
  BUILDINGS,
  CITY_LEVEL_DEFS,
  economyConfig,
  type BuildingId,
  type GoodId,
  type Goods,
  type UnitId,
} from '../data';
import type { Hex } from './hex';
import { hexEquals } from './hex';
import { tileIndex } from './map';
import {
  addGoods,
  advanceCheck,
  canTrade,
  canAfford,
  checkPlacement,
  claimTerritory,
  missingGoods,
  ownerAt,
  pay,
  orderTraining,
  planRoad,
  reachableTiles,
  scaleGoods,
  type RuleError,
} from './rules';
import type { GameState } from './state';
import { endTurn } from './turn';

export type Action =
  | { type: 'build'; building: BuildingId; hex: Hex }
  | { type: 'buildRoad'; from: Hex; to: Hex }
  | { type: 'demolish'; hex: Hex }
  | { type: 'togglePause'; hex: Hex }
  | { type: 'advanceCity'; cityId: number }
  | { type: 'trade'; good: GoodId; direction: 'sell' | 'buy'; lots: number }
  | { type: 'move'; unitId: number; to: Hex }
  | { type: 'train'; barracksId: number; unit: UnitId }
  | { type: 'endTurn' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: RuleError };

const fail = (error: RuleError): ActionResult => ({ ok: false, error });

/** Applies an action of the current player. Never mutates `state`. */
export function applyAction(state: GameState, action: Action): ActionResult {
  const player = state.currentPlayer;
  if (action.type === 'endTurn') return { ok: true, state: endTurn(state) };

  const next = structuredClone(state);
  const stock = next.players.find((p) => p.id === player)?.goods;
  if (!stock) throw new Error(`Unknown player ${player}`);

  switch (action.type) {
    case 'build': {
      const error = checkPlacement(next, player, action.building, action.hex);
      if (error) return fail(error);
      const def = BUILDINGS[action.building];
      pay(stock, def.cost);
      next.buildings.push({
        id: next.nextId++,
        type: action.building,
        owner: player,
        hex: action.hex,
        paused: false,
      });
      if (def.territoryRadius > 0) {
        const i = tileIndex(next.map, action.hex);
        claimTerritory(next, action.hex, def.territoryRadius, player, next.tileCity[i]);
      }
      return { ok: true, state: next };
    }
    case 'buildRoad': {
      const result = planRoad(next, player, action.from, action.to);
      if (!result.ok) return fail(result.error);
      const { plan } = result;
      if (!canAfford(stock, plan.cost)) {
        return fail({ code: 'notAffordable', missing: missingGoods(stock, plan.cost) });
      }
      pay(stock, plan.cost);
      for (const h of plan.newTiles) next.roads[tileIndex(next.map, h)] = true;
      return { ok: true, state: next };
    }
    case 'togglePause': {
      const building = next.buildings.find(
        (b) => b.owner === player && hexEquals(b.hex, action.hex),
      );
      if (!building || BUILDINGS[building.type].workers <= 0) return fail({ code: 'cannotPause' });
      building.paused = !building.paused;
      return { ok: true, state: next };
    }
    case 'advanceCity': {
      const city = next.cities.find((c) => c.id === action.cityId);
      if (!city || city.owner !== player) return fail({ code: 'notOwnCity' });
      const check = advanceCheck(next, city.id);
      const def = CITY_LEVEL_DEFS[city.level].next;
      if (!check || !def || check.to === null) return fail({ code: 'cityMaxLevel' });
      if (!check.residents.ok) return fail({ code: 'notEnoughResidents' });
      if (!check.supply.ok) {
        return fail({ code: 'supplyNotReady', good: check.supply.good, turns: check.supply.turns });
      }
      if (!check.cost.ok) return fail({ code: 'notAffordable', missing: check.cost.missing });
      pay(stock, def.cost);
      city.level = def.to;
      city.supplyStreak = 0;
      return { ok: true, state: next };
    }
    case 'trade': {
      if (!canTrade(next, player)) return fail({ code: 'noMarketplace' });
      if (action.good === 'drachmas') return fail({ code: 'cannotTradeGood' });
      if (!Number.isInteger(action.lots) || action.lots < 1) return fail({ code: 'invalidAmount' });
      const { sellAmount, sellPrice, buyPrice } = economyConfig.market;
      const cost: Goods =
        action.direction === 'sell'
          ? { [action.good]: action.lots * sellAmount }
          : { drachmas: action.lots * buyPrice };
      if (!canAfford(stock, cost))
        return fail({ code: 'notAffordable', missing: missingGoods(stock, cost) });
      pay(stock, cost);
      addGoods(
        stock,
        action.direction === 'sell'
          ? { drachmas: action.lots * sellPrice }
          : { [action.good]: action.lots },
      );
      return { ok: true, state: next };
    }
    case 'move': {
      const unit = next.units.find((u) => u.id === action.unitId);
      if (!unit || unit.owner !== player) return fail({ code: 'notOwnUnit' });
      const target = reachableTiles(next, unit.id).find((r) => hexEquals(r.hex, action.to));
      if (!target) return fail({ code: 'cannotReach' });
      unit.hex = target.hex;
      unit.movesLeft = Math.max(0, unit.movesLeft - target.cost);
      unit.hasMoved = true;
      unit.acted = true;
      return { ok: true, state: next };
    }
    case 'train': {
      const error = orderTraining(next, player, action.barracksId, action.unit);
      return error ? fail(error) : { ok: true, state: next };
    }
    case 'demolish': {
      const building = next.buildings.find(
        (b) => b.owner === player && hexEquals(b.hex, action.hex),
      );
      if (building) {
        if (building.type === 'cityCenter') return fail({ code: 'cannotDemolishCityCenter' });
        next.buildings = next.buildings.filter((b) => b !== building);
        addGoods(stock, scaleGoods(BUILDINGS[building.type].cost, economyConfig.demolishRefund));
        return { ok: true, state: next };
      }
      const i = tileIndex(next.map, action.hex);
      if (i >= 0 && next.roads[i] && ownerAt(next, action.hex) === player) {
        next.roads[i] = false;
        addGoods(stock, scaleGoods(economyConfig.roadCost, economyConfig.demolishRefund));
        return { ok: true, state: next };
      }
      return fail({ code: 'nothingToDemolish' });
    }
  }
}
