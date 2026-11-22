// Advancing a city to the next level (docs/GAME_DESIGN.md, section 6).

import { CITY_LEVEL_DEFS, type CityLevel, type GoodId, type Goods } from '../../data';
import type { GameState, PlayerId } from '../state';
import { canAfford, missingGoods } from './goods';
import { previewProduction, type TurnReport } from './production';

export interface AdvanceCheck {
  /** The next level; null = already at the top level. */
  to: CityLevel | null;
  residents: { have: number; need: number; ok: boolean };
  /** Production per turn of the supply good (`made`) against what the cities will need (`needed`). */
  supply: { good: GoodId; made: number; needed: number; ok: boolean };
  cost: { cost: Goods; missing: Goods; ok: boolean };
  canAdvance: boolean;
}

/** How much of `good` all buildings of the player produce per turn (marketplace purchases do not count). */
export function producedPerTurn(report: TurnReport, good: GoodId): number {
  return report.buildings.reduce((sum, b) => sum + (b.produced[good] ?? 0), 0);
}

/** How much of `good` one city needs per turn at the given level and residents (0 = no such need). */
function needAt(level: CityLevel, residents: number, good: GoodId): number {
  return CITY_LEVEL_DEFS[level].needs
    .filter((n) => n.good === good)
    .reduce((sum, n) => sum + Math.ceil(residents / n.residentsPer), 0);
}

/**
 * What a city still needs to advance (changes nothing). null if the city does not exist.
 * `production` = the player's `previewProduction`; pass it when checking many cities so it is
 * only computed once.
 *
 * Supply rule: `made` = the supply good produced per turn by all the player's buildings;
 * `needed` = what all OTHER own cities need of it at their current level + what THIS city
 * will need at the next level. The supply is ok when made >= needed.
 */
export function advanceCheck(
  state: GameState,
  cityId: number,
  production?: TurnReport,
): AdvanceCheck | null {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return null;
  const next = CITY_LEVEL_DEFS[city.level].next;
  if (!next) {
    return {
      to: null,
      residents: { have: city.residents, need: 0, ok: true },
      supply: { good: 'oil', made: 0, needed: 0, ok: true },
      cost: { cost: {}, missing: {}, ok: true },
      canAdvance: false,
    };
  }
  const stock = state.players.find((p) => p.id === city.owner)?.goods;
  if (!stock) throw new Error(`Unknown player ${city.owner}`);
  const residents = {
    have: city.residents,
    need: next.minResidents,
    ok: city.residents >= next.minResidents,
  };
  const report = production ?? previewProduction(state, city.owner as PlayerId);
  const made = producedPerTurn(report, next.supplyGood);
  let needed = needAt(next.to, city.residents, next.supplyGood);
  for (const other of state.cities) {
    if (other.owner === city.owner && other.id !== city.id) {
      needed += needAt(other.level, other.residents, next.supplyGood);
    }
  }
  const supply = { good: next.supplyGood, made, needed, ok: made >= needed };
  const missing = missingGoods(stock, next.cost);
  const cost = { cost: { ...next.cost }, missing, ok: canAfford(stock, next.cost) };
  return {
    to: next.to,
    residents,
    supply,
    cost,
    canAdvance: residents.ok && supply.ok && cost.ok,
  };
}
