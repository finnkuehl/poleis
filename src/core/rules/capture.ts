// Capturing enemy cities (docs/GAME_DESIGN.md, section 7: capturing).

import { UNITS } from '../../data';
import { hexEquals } from '../hex';
import { tileIndex } from '../map';
import type { GameState, PlayerId, Unit } from '../state';
import { addEvent, playersSeeing } from './events';

/** Sets `capturing` for a unit that has just arrived on a tile (call after moving). Mutates. */
export function updateCapturing(state: GameState, unit: Unit): void {
  const city = state.cities.find((c) => hexEquals(c.center, unit.hex));
  unit.capturing =
    city && city.owner !== unit.owner && UNITS[unit.type].canCapture ? city.id : null;
}

/**
 * Start of the player's turn: every unit still standing on the center of the enemy city it
 * was capturing takes the city over (city, its buildings and its territory). Mutates.
 * Returns the ids of the captured cities.
 */
export function captureCities(state: GameState, player: PlayerId): number[] {
  const captured: number[] = [];
  for (const unit of state.units) {
    if (unit.owner !== player || unit.capturing === null) continue;
    const city = state.cities.find((c) => c.id === unit.capturing);
    unit.capturing = null;
    // Old saves: a unit that cannot capture (scout, settler) never takes a city.
    if (!UNITS[unit.type].canCapture) continue;
    if (!city || city.owner === player || !hexEquals(city.center, unit.hex)) continue;
    const ofCity = (barracksId: number) => {
      const b = state.buildings.find((x) => x.id === barracksId);
      return b !== undefined && state.tileCity[tileIndex(state.map, b.hex)] === city.id;
    };
    // Training orders of the old owner in this city are lost.
    state.training = state.training.filter((t) => !ofCity(t.barracksId));
    const from = city.owner;
    city.owner = player;
    for (const b of state.buildings) {
      if (state.tileCity[tileIndex(state.map, b.hex)] === city.id) b.owner = player;
    }
    for (let i = 0; i < state.tileCity.length; i++) {
      if (state.tileCity[i] === city.id) state.territory[i] = player;
    }
    addEvent(state, {
      type: 'cityCaptured',
      turn: state.turn,
      by: player,
      from,
      cityId: city.id,
      hex: city.center,
      seenBy: playersSeeing(state, city.center, [player, from]),
    });
    captured.push(city.id);
  }
  return captured;
}
