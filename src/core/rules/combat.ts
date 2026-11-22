// Combat (docs/GAME_DESIGN.md, section 7: combat formula).

import { militaryConfig, TERRAIN, UNITS } from '../../data';
import { distance, hexEquals } from '../hex';
import { terrainAt } from '../map';
import type { GameState, Unit } from '../state';

export interface CombatPreview {
  /** Damage the defender takes. */
  damage: number;
  /** Damage the attacker takes in return (0 = no counterattack). */
  counter: number;
  defenderDies: boolean;
  attackerDies: boolean;
}

/** Predicts a fight between two units (no state change). */
export function combatPreview(
  state: GameState,
  attackerId: number,
  defenderId: number,
): CombatPreview {
  const a = state.units.find((u) => u.id === attackerId);
  const d = state.units.find((u) => u.id === defenderId);
  if (!a || !d) throw new Error('combatPreview: unknown unit');
  const aDef = UNITS[a.type];
  const dDef = UNITS[d.type];
  const terrain = terrainAt(state.map, d.hex);
  const terrainBonus = (terrain && TERRAIN[terrain].defenseBonus) ?? 1;
  // A unit defending on any city center counts as walled.
  const walled = state.buildings.some((b) => b.type === 'cityCenter' && hexEquals(b.hex, d.hex));
  const attackPower = aDef.attack * (a.hp / aDef.hp);
  const defensePower =
    dDef.defense * (d.hp / dDef.hp) * terrainBonus * (walled ? militaryConfig.wallBonus : 1);
  const total = attackPower + defensePower;
  const damage =
    total > 0 ? Math.round((attackPower / total) * aDef.attack * militaryConfig.damageFactor) : 0;
  const defenderDies = damage >= d.hp;
  let counter = 0;
  if (!defenderDies && dDef.range > 0 && distance(a.hex, d.hex) <= dDef.range && total > 0) {
    counter = Math.round((defensePower / total) * dDef.defense * militaryConfig.damageFactor);
  }
  return { damage, counter, defenderDies, attackerDies: counter >= a.hp };
}

/**
 * Enemy units the unit can attack right now (needs range > 0 and no attack yet this turn).
 * Passengers cannot be attacked (the ship takes the hit), passengers cannot attack, and only
 * units that attack ships (trireme, archers) may target ships.
 */
export function attackTargets(state: GameState, unitId: number): Unit[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.attacked || unit.aboard !== null) return [];
  const def = UNITS[unit.type];
  if (def.range <= 0) return [];
  return state.units.filter(
    (u) =>
      u.owner !== unit.owner &&
      u.aboard === null &&
      (def.attacksShips || UNITS[u.type].domain === 'land') &&
      distance(unit.hex, u.hex) <= def.range,
  );
}
