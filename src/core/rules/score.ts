// Victory points (docs/GAME_DESIGN.md, section 10). Numbers live in data/victory.ts.

import { scoreConfig } from '../../data';
import { isPassive, type GameState, type PlayerId } from '../state';
import { isWonderComplete, population } from './workers';

export interface ScoreBreakdown {
  residents: number;
  buildings: number;
  territory: number;
  levels: number;
  temples: number;
  wonder: number;
  total: number;
}

export interface ScoreRow {
  player: PlayerId;
  total: number;
  residents: number;
  /** Working turns of the player's wonder, null = no wonder. */
  wonderProgress: number | null;
  alive: boolean;
  /** The passive test-mode enemy. */
  passive: boolean;
}

/** Points of one player, split by source. */
export function scoreOf(state: GameState, player: PlayerId): ScoreBreakdown {
  const own = state.buildings.filter((b) => b.owner === player);
  const residents = population(state, player) * scoreConfig.perResident;
  const buildings = own.length * scoreConfig.perBuilding;
  const territory =
    state.territory.filter((o) => o === player).length * scoreConfig.perTerritoryTile;
  const levels = state.cities
    .filter((c) => c.owner === player)
    .reduce((sum, c) => sum + scoreConfig.cityLevel[c.level], 0);
  const temples = own.filter((b) => b.type === 'temple').length * scoreConfig.temple;
  const wonder = own.filter(isWonderComplete).length * scoreConfig.wonderComplete;
  return {
    residents,
    buildings,
    territory,
    levels,
    temples,
    wonder,
    total: residents + buildings + territory + levels + temples + wonder,
  };
}

/** One row per player, best first: more points, then more residents, then lower id. */
export function scoreboard(state: GameState): ScoreRow[] {
  return state.players
    .map((p): ScoreRow => {
      const wonder = state.buildings.find((b) => b.owner === p.id && b.type === 'wonder');
      return {
        player: p.id,
        total: scoreOf(state, p.id).total,
        residents: population(state, p.id),
        wonderProgress: wonder ? (wonder.progress ?? 0) : null,
        alive: p.alive,
        passive: isPassive(p),
      };
    })
    .sort((a, b) => b.total - a.total || b.residents - a.residents || a.player - b.player);
}
