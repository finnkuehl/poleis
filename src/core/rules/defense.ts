// City and watchtower fire (docs/GAME_DESIGN.md, section 7: city and tower fire).

import { militaryConfig } from '../../data';
import { distance } from '../hex';
import { tileIndex } from '../map';
import type { Building, City, GameState, PlayerId, Unit } from '../state';
import { addEvent, playersSeeing } from './events';
import { pruneUnits } from './movement';

/** Damage of one shot of the building (city centers by level, watchtowers fixed). */
export function shotDamage(state: GameState, building: Building): number {
  const cfg = militaryConfig.defense;
  if (building.type === 'borderTower') return cfg.towerDamage;
  const city = state.cities.find((c) => c.id === building.id);
  return city ? cfg.cityDamage[city.level] : 0;
}

/**
 * Picks the target of a shooter at `from`: enemy units within range that are alive and not
 * passengers (their ship takes the shot). Order: the unit capturing `city` first, then the
 * lowest HP, then the nearest, then the lowest id. Returns undefined if nothing is in range.
 */
export function pickTarget(
  state: GameState,
  player: PlayerId,
  from: Building['hex'],
  city: City | undefined,
): Unit | undefined {
  const candidates = state.units.filter(
    (u) =>
      u.owner !== player &&
      u.hp > 0 &&
      u.aboard === null &&
      distance(from, u.hex) <= militaryConfig.defense.range,
  );
  const capturer = (u: Unit): number => (city !== undefined && u.capturing === city.id ? 0 : 1);
  candidates.sort(
    (a, b) =>
      capturer(a) - capturer(b) ||
      a.hp - b.hp ||
      distance(from, a.hex) - distance(from, b.hex) ||
      a.id - b.id,
  );
  return candidates[0];
}

/**
 * Start of the player's turn: every city center of the player shoots once, then every
 * watchtower (each group by building id ascending), each at the best enemy unit in range.
 * No counterattack. Dead units (and the passengers of sunk ships) are removed right after
 * each shot. Shots never cancel a capture (`capturing` is left alone). Mutates.
 */
export function runDefense(state: GameState, player: PlayerId): void {
  const own = state.buildings.filter((b) => b.owner === player);
  const shooters = [
    ...own.filter((b) => b.type === 'cityCenter').sort((a, b) => a.id - b.id),
    ...own.filter((b) => b.type === 'borderTower').sort((a, b) => a.id - b.id),
  ];
  for (const b of shooters) {
    // A city center is its own city; a tower belongs to the city whose territory it stands on.
    const cityId = b.type === 'cityCenter' ? b.id : state.tileCity[tileIndex(state.map, b.hex)];
    const city = state.cities.find((c) => c.id === cityId);
    const target = pickTarget(state, player, b.hex, city);
    if (!target) continue;
    const damage = Math.min(shotDamage(state, b), target.hp);
    target.hp -= damage;
    const killed = target.hp <= 0;
    addEvent(state, {
      type: 'defenseShot',
      turn: state.turn,
      shooter: player,
      victim: target.owner,
      source: b.type === 'cityCenter' ? 'city' : 'tower',
      unit: target.type,
      hex: target.hex,
      damage,
      killed,
      seenBy: playersSeeing(state, target.hex, [player, target.owner]),
    });
    if (killed) pruneUnits(state);
  }
}
