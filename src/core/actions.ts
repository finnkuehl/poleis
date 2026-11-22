// All player actions and applyAction(state, action) -> new state or error.

import {
  BUILDINGS,
  CITY_LEVEL_DEFS,
  economyConfig,
  UNITS,
  type BuildingId,
  type GoodId,
  type Goods,
  type UnitId,
} from '../data';
import type { Hex } from './hex';
import { distance, hexEquals } from './hex';
import { tileIndex } from './map';
import {
  addGoods,
  advanceCheck,
  canTrade,
  checkFoundCity,
  addEvent,
  combatPreview,
  playersSeeing,
  foundCity,
  updateCapturing,
  canAfford,
  checkPlacement,
  claimTerritory,
  missingGoods,
  ownerAt,
  pay,
  orderTraining,
  planRoad,
  reachableTiles,
  hasFreeCapacity,
  moveUnitTo,
  pruneUnits,
  unitAt,
  scaleGoods,
  setMoveOrder,
  updateAllExplored,
  workersNeeded,
  canPrioritizeGood,
  type RuleError,
} from './rules';
import type { GameState } from './state';
import { endTurn } from './turn';

export type Action =
  | { type: 'build'; building: BuildingId; hex: Hex }
  | { type: 'buildRoad'; from: Hex; to: Hex }
  | { type: 'demolish'; hex: Hex }
  | { type: 'togglePause'; hex: Hex }
  | { type: 'setGoodPriority'; good: GoodId; low: boolean }
  | { type: 'advanceCity'; cityId: number }
  | { type: 'trade'; good: GoodId; direction: 'sell' | 'buy'; lots: number }
  | { type: 'move'; unitId: number; to: Hex }
  | { type: 'setOrder'; unitId: number; to: Hex }
  | { type: 'cancelOrder'; unitId: number }
  | { type: 'attack'; unitId: number; targetId: number }
  | { type: 'foundCity'; unitId: number }
  | { type: 'train'; barracksId: number; unit: UnitId }
  | { type: 'endTurn' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: RuleError };

const fail = (error: RuleError): ActionResult => ({ ok: false, error });

/** Applies an action of the current player. Never mutates `state`. */
export function applyAction(state: GameState, action: Action): ActionResult {
  const result = applyActionInner(state, action);
  if (result.ok && action.type !== 'endTurn') updateAllExplored(result.state);
  return result;
}

function applyActionInner(state: GameState, action: Action): ActionResult {
  const player = state.currentPlayer;
  if (state.result) return fail({ code: 'gameOver' });
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
        ...(action.building === 'wonder' ? { progress: 0 } : {}),
      });
      if (action.building === 'wonder') {
        addEvent(next, {
          type: 'wonderStarted',
          turn: next.turn,
          player,
          hex: action.hex,
          seenBy: next.players.map((p) => p.id),
        });
      }
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
      if (!building || workersNeeded(building) <= 0) return fail({ code: 'cannotPause' });
      building.paused = !building.paused;
      return { ok: true, state: next };
    }
    case 'setGoodPriority': {
      if (!canPrioritizeGood(action.good)) return fail({ code: 'cannotPrioritizeGood' });
      const me = next.players.find((p) => p.id === player);
      if (!me) throw new Error(`Unknown player ${player}`);
      const rest = me.lowPriorityGoods.filter((g) => g !== action.good);
      me.lowPriorityGoods = action.low ? [...rest, action.good].sort() : rest;
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
      if (!target) {
        // A land unit that wants onto an own ship that is full.
        const ship = unitAt(next, action.to);
        if (
          unit.aboard === null &&
          UNITS[unit.type].domain === 'land' &&
          ship &&
          ship.owner === player &&
          UNITS[ship.type].capacity > 0 &&
          distance(unit.hex, ship.hex) === 1 &&
          !hasFreeCapacity(next, ship)
        ) {
          return fail({ code: 'shipFull' });
        }
        const seen = reachableTiles(next, unit.id, { ignoreHiddenUnits: true });
        return fail({
          code: seen.some((r) => hexEquals(r.hex, action.to)) ? 'blockedByUnseen' : 'cannotReach',
        });
      }
      if (target.kind === 'board') {
        // Step onto the ship: share its hex; the move ends.
        const ship = unitAt(next, target.hex);
        if (!ship) throw new Error('move: boarding target without a ship');
        unit.aboard = ship.id;
        unit.hex = ship.hex;
        unit.movesLeft = 0;
      } else if (target.kind === 'land') {
        // Step off the ship onto land; the move ends.
        unit.aboard = null;
        unit.hex = target.hex;
        unit.movesLeft = 0;
      } else {
        moveUnitTo(next, unit, target.hex);
        unit.movesLeft = Math.max(0, unit.movesLeft - target.cost);
      }
      unit.hasMoved = true;
      unit.acted = true;
      unit.order = null;
      updateCapturing(next, unit);
      return { ok: true, state: next };
    }
    case 'setOrder': {
      const error = setMoveOrder(next, player, action.unitId, action.to);
      return error ? fail(error) : { ok: true, state: next };
    }
    case 'cancelOrder': {
      const unit = next.units.find((u) => u.id === action.unitId);
      if (!unit || unit.owner !== player) return fail({ code: 'notOwnUnit' });
      unit.order = null;
      return { ok: true, state: next };
    }
    case 'attack': {
      const unit = next.units.find((u) => u.id === action.unitId);
      if (!unit || unit.owner !== player) return fail({ code: 'notOwnUnit' });
      if (unit.aboard !== null) return fail({ code: 'passengerCannotAct' });
      const target = next.units.find((u) => u.id === action.targetId);
      // Passengers cannot be attacked directly: the attacks hit their ship.
      if (!target || target.owner === player || target.aboard !== null) {
        return fail({ code: 'notEnemy' });
      }
      if (unit.attacked) return fail({ code: 'alreadyAttacked' });
      if (UNITS[target.type].domain === 'sea' && !UNITS[unit.type].attacksShips) {
        return fail({ code: 'cannotAttackShip' });
      }
      const range = UNITS[unit.type].range;
      if (range <= 0 || distance(unit.hex, target.hex) > range) return fail({ code: 'notInRange' });
      const result = combatPreview(next, unit.id, target.id);
      target.hp -= result.damage;
      // A wounded defender loses a pending capture.
      if (result.damage > 0) target.capturing = null;
      unit.hp -= result.counter;
      unit.attacked = true;
      // An attack ends the orders of both sides (damage or not).
      unit.order = null;
      target.order = null;
      unit.hasMoved = true;
      unit.acted = true;
      unit.movesLeft = 0;
      addEvent(next, {
        type: 'attack',
        turn: next.turn,
        attacker: player,
        defender: target.owner,
        attackerUnit: unit.type,
        defenderUnit: target.type,
        hex: target.hex,
        damage: result.damage,
        counter: result.counter,
        defenderKilled: target.hp <= 0,
        attackerKilled: unit.hp <= 0,
        seenBy: playersSeeing(next, target.hex, [player, target.owner]),
      });
      // Dead units are gone; the passengers of a sunk ship go down with it.
      pruneUnits(next);
      return { ok: true, state: next };
    }
    case 'foundCity': {
      const error = checkFoundCity(next, player, action.unitId);
      if (error) return fail(error);
      foundCity(next, action.unitId);
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
        if (building.type === 'wonder') return fail({ code: 'cannotDemolishWonder' });
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
