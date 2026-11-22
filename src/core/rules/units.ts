// Units: training, spawning, healing, upkeep (docs/GAME_DESIGN.md, section 7).
// All functions mutate the passed state (the caller clones).

import {
  CITY_LEVELS,
  militaryConfig,
  populationConfig,
  UNITS,
  type Goods,
  type Stock,
  type UnitId,
} from '../../data';
import { neighbors } from '../hex';
import { tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';
import type { RuleError } from './errors';
import { canAfford, missingGoods, pay } from './goods';
import { isFreeLand, isFreeWater, pruneUnits } from './movement';
import { ownerAt } from './territory';
import type { UnitsReport } from './production';

/** Checks and carries out a training order. Returns an error or null (then it is done). */
export function orderTraining(
  state: GameState,
  player: PlayerId,
  barracksId: number,
  unit: UnitId,
): RuleError | null {
  // `barracksId` is the id of the training building: a barracks (land units), a harbor (ships)
  // or a city center (settlers).
  const barracks = state.buildings.find((b) => b.id === barracksId);
  if (
    !barracks ||
    barracks.owner !== player ||
    (barracks.type !== 'barracks' && barracks.type !== 'harbor' && barracks.type !== 'cityCenter')
  ) {
    return { code: 'notOwnBuilding' };
  }
  const def = UNITS[unit];
  if (def.trainedIn !== barracks.type) return { code: 'wrongTrainingBuilding' };
  if (state.training.some((t) => t.barracksId === barracksId)) return { code: 'alreadyTraining' };
  const cityId = state.tileCity[tileIndex(state.map, barracks.hex)];
  const city = state.cities.find((c) => c.id === cityId && c.owner === player);
  if (!city) return { code: 'notOwnCity' };
  if (CITY_LEVELS.indexOf(city.level) < CITY_LEVELS.indexOf(def.minLevel)) {
    return { code: 'levelTooLow', level: def.minLevel };
  }
  if (def.residents > 0 && city.residents < militaryConfig.settlerMinCityResidents) {
    return { code: 'notEnoughResidents' };
  }
  const stock = state.players.find((p) => p.id === player)?.goods;
  if (!stock) throw new Error(`Unknown player ${player}`);
  if (!canAfford(stock, def.cost)) {
    return { code: 'notAffordable', missing: missingGoods(stock, def.cost) };
  }
  pay(stock, def.cost);
  city.residents -= def.residents;
  state.training.push({ barracksId, unit, owner: player });
  return null;
}

/** Heals the player's units that did not act last turn, then resets their turn flags. */
export function healAndResetUnits(state: GameState, player: PlayerId): void {
  for (const u of state.units) {
    if (u.owner !== player) continue;
    if (!u.acted) {
      const heal =
        ownerAt(state, u.hex) === player
          ? militaryConfig.healOwnTerritory
          : militaryConfig.healIdle;
      u.hp = Math.min(UNITS[u.type].hp, u.hp + heal);
    }
    u.movesLeft = UNITS[u.type].movement;
    u.hasMoved = false;
    u.acted = false;
    u.attacked = false;
  }
}

/** Turns the player's training orders into units; returns how many appeared. */
export function spawnUnits(state: GameState, player: PlayerId): number {
  let spawned = 0;
  const waiting: typeof state.training = [];
  for (const order of state.training) {
    if (order.owner !== player) {
      waiting.push(order);
      continue;
    }
    const barracks = state.buildings.find((b) => b.id === order.barracksId);
    // The barracks was demolished meanwhile: the order is lost.
    if (!barracks) continue;
    const def = UNITS[order.unit];
    // (The order is not checked against `trainedIn` again: an old barracks order still finishes.)
    // Land units: the barracks/city center tile or a free walkable tile next to it.
    // Ships: a free water tile next to the harbor.
    const spot =
      def.domain === 'sea'
        ? neighbors(barracks.hex).find((h) => isFreeWater(state, h))
        : [barracks.hex, ...neighbors(barracks.hex)].find((h) => isFreeLand(state, h));
    if (!spot) {
      waiting.push(order);
      continue;
    }
    state.units.push({
      id: state.nextId++,
      type: order.unit,
      owner: player,
      hex: spot,
      hp: def.hp,
      movesLeft: def.movement,
      hasMoved: false,
      acted: false,
      attacked: false,
      capturing: null,
      order: null,
      aboard: null,
    });
    spawned++;
  }
  state.training = waiting;
  return spawned;
}

/** Units eat after the residents. Missing food hurts every unit; dead units are removed. */
export function runUpkeep(
  state: GameState,
  player: PlayerId,
  stock: Stock,
): Omit<UnitsReport, 'spawned'> {
  const own = state.units.filter((u) => u.owner === player);
  let left = own.length * militaryConfig.upkeepFood;
  const upkeepEaten: Goods = {};
  for (const good of populationConfig.foodOrder) {
    const eat = Math.min(stock[good], left);
    if (eat > 0) {
      stock[good] -= eat;
      upkeepEaten[good] = eat;
      left -= eat;
    }
  }
  const starving = left > 0;
  let lost = 0;
  if (starving) {
    for (const u of own) u.hp -= militaryConfig.starvationDamage;
    // Passengers of a ship that starved to death are lost with it.
    lost = pruneUnits(state);
  }
  return { upkeepEaten, starving, lost };
}
