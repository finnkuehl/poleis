// Advancing a city to the next level (docs/GAME_DESIGN.md, section 6).

import { CITY_LEVEL_DEFS, type CityLevel, type GoodId, type Goods } from '../../data';
import type { GameState } from '../state';
import { canAfford, missingGoods } from './goods';

export interface AdvanceCheck {
  /** The next level; null = already at the top level. */
  to: CityLevel | null;
  residents: { have: number; need: number; ok: boolean };
  supply: { good: GoodId; streak: number; turns: number; ok: boolean };
  cost: { cost: Goods; missing: Goods; ok: boolean };
  canAdvance: boolean;
}

/** What a city still needs to advance (changes nothing). null if the city does not exist. */
export function advanceCheck(state: GameState, cityId: number): AdvanceCheck | null {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return null;
  const next = CITY_LEVEL_DEFS[city.level].next;
  if (!next) {
    return {
      to: null,
      residents: { have: city.residents, need: 0, ok: true },
      supply: { good: 'oil', streak: city.supplyStreak, turns: 0, ok: true },
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
  const supply = {
    good: next.supplyGood,
    streak: city.supplyStreak,
    turns: next.supplyTurns,
    ok: city.supplyStreak >= next.supplyTurns,
  };
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
