// Fog of war: what a player can see right now and what they have explored so far.
// Vision is plain hex distance (no line of sight). Units see `visionUnit` tiles,
// city centers and border towers see `visionCity` tiles.

import { militaryConfig } from '../../data';
import { range, type Hex } from '../hex';
import { inBounds, tileIndex } from '../map';
import type { GameState, PlayerId } from '../state';

/** Per tile index: is the tile currently visible to the player? */
export function visibleTiles(state: GameState, player: PlayerId): boolean[] {
  const visible = state.map.tiles.map(() => false);
  const mark = (center: Hex, radius: number) => {
    for (const h of range(center, radius)) {
      if (inBounds(state.map, h)) visible[tileIndex(state.map, h)] = true;
    }
  };
  for (const unit of state.units) {
    if (unit.owner === player) mark(unit.hex, militaryConfig.visionUnit);
  }
  for (const building of state.buildings) {
    if (
      building.owner === player &&
      (building.type === 'cityCenter' || building.type === 'borderTower')
    ) {
      mark(building.hex, militaryConfig.visionCity);
    }
  }
  return visible;
}

/** Is this tile currently visible to the player? */
export function isVisible(state: GameState, player: PlayerId, hex: Hex): boolean {
  if (!inBounds(state.map, hex)) return false;
  return visibleTiles(state, player)[tileIndex(state.map, hex)];
}

/** Marks everything currently visible as explored. Mutates the given state. */
export function updateExplored(state: GameState, player: PlayerId): void {
  const p = state.players.find((x) => x.id === player);
  if (!p) return;
  const visible = visibleTiles(state, player);
  if (p.explored.length !== visible.length) p.explored = visible.map(() => false);
  for (let i = 0; i < visible.length; i++) {
    if (visible[i]) p.explored[i] = true;
  }
}

/** Updates the explored tiles of every player. Mutates the given state. */
export function updateAllExplored(state: GameState): void {
  for (const p of state.players) updateExplored(state, p.id);
}
