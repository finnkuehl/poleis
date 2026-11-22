// What can be built on one tapped tile (pure function, no DOM).
import type { Hex } from '../core/hex';
import { tileIndex } from '../core/map';
import { checkPlacement, territoryGain, towerUsage } from '../core/rules';
import type { GameState, PlayerId } from '../core/state';
import { BUILDING_IDS, BUILDINGS, type BuildingId, type CityLevel, type Goods } from '../data';

export interface BuildOption {
  id: BuildingId;
  state: 'ok' | 'unaffordable' | 'locked' | 'limit';
  /** unaffordable: the goods that are missing. */
  missing?: Goods;
  /** locked: the city level the building needs. */
  level?: CityLevel;
  /** limit: watchtowers the city has and the most it may have. */
  used?: number;
  max?: number;
  /** Buildings that claim land: the number of new tiles the player would gain. */
  gain?: number;
}

const ORDER: Record<BuildOption['state'], number> = { ok: 0, unaffordable: 1, limit: 2, locked: 3 };

/**
 * All buildings that belong on this tile: buildable now, too expensive, or locked by city level.
 * Buildings that do not fit the tile (terrain, neighbours, occupied, foreign land) are left out.
 */
export function buildOptionsFor(state: GameState, player: PlayerId, hex: Hex): BuildOption[] {
  // The level check comes before the terrain check in `checkPlacement`; to tell whether a locked
  // building would fit the tile at all, ask again as if the city were a metropolis (lazy copy).
  let maxLevelState: GameState | null = null;
  const fitsIgnoringLevel = (id: BuildingId): boolean => {
    if (!maxLevelState) {
      maxLevelState = structuredClone(state);
      for (const c of maxLevelState.cities) c.level = 'metropolis';
    }
    const err = checkPlacement(maxLevelState, player, id, hex);
    return err === null || err.code === 'notAffordable';
  };

  const options: BuildOption[] = [];
  for (const id of BUILDING_IDS) {
    const def = BUILDINGS[id];
    if (!def.playerCanBuild) continue;
    const err = checkPlacement(state, player, id, hex);
    let option: BuildOption;
    if (err === null) option = { id, state: 'ok' };
    else if (err.code === 'notAffordable') {
      option = { id, state: 'unaffordable', missing: err.missing };
    } else if (err.code === 'levelTooLow' && fitsIgnoringLevel(id)) {
      option = { id, state: 'locked', level: err.level };
    } else if (err.code === 'towerLimit') {
      const cityId = state.tileCity[tileIndex(state.map, hex)];
      option = { id, state: 'limit', used: towerUsage(state, player, cityId).used, max: err.max };
    } else continue;
    if (def.territoryRadius > 0)
      option.gain = territoryGain(state, hex, def.territoryRadius).length;
    options.push(option);
  }
  // Stable sort: ok first, then unaffordable, then locked; BUILDING_IDS order inside each group.
  return options.sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}
