// Error codes of the rules. Texts come from i18n (see i18n/format.ts).

import type { Goods, TerrainId } from '../../data';

export type RuleErrorCode =
  | 'outOfBounds'
  | 'notOwnTerritory'
  | 'tileOccupied'
  | 'wrongTerrain'
  | 'needsNeighbor'
  | 'notAffordable'
  | 'cannotBuildType'
  | 'levelTooLow'
  // The following codes are used by later steps (roads, demolishing).
  | 'noPath'
  | 'roadNotAllowed'
  | 'nothingToDemolish'
  | 'cannotDemolishCityCenter'
  | 'cannotPause';

export interface RuleError {
  code: RuleErrorCode;
  /** notAffordable: the goods that are missing. */
  missing?: Goods;
  /** wrongTerrain / needsNeighbor: the terrains that would work. */
  terrains?: readonly TerrainId[];
}
