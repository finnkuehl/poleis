// Error codes of the rules. Texts come from i18n (see i18n/format.ts).

import type { CityLevel, GoodId, Goods, TerrainId } from '../../data';

export type RuleErrorCode =
  | 'outOfBounds'
  | 'notOwnTerritory'
  | 'tileOccupied'
  | 'wrongTerrain'
  | 'needsNeighbor'
  | 'notAffordable'
  | 'cannotBuildType'
  | 'levelTooLow'
  | 'notOwnCity'
  | 'cityMaxLevel'
  | 'notEnoughResidents'
  | 'supplyNotReady'
  | 'noMarketplace'
  | 'cannotTradeGood'
  | 'invalidAmount'
  // The following codes are used by later steps (roads, demolishing).
  | 'noPath'
  | 'destinationOccupied'
  | 'roadNotAllowed'
  | 'nothingToDemolish'
  | 'cannotDemolishCityCenter'
  | 'cannotPause'
  | 'notOwnUnit'
  | 'cannotReach'
  | 'blockedByUnseen'
  | 'notOwnBuilding'
  | 'alreadyTraining'
  | 'notEnemy'
  | 'alreadyAttacked'
  | 'notInRange'
  | 'notASettler'
  | 'foreignTerritory'
  | 'tooCloseToCity';

export interface RuleError {
  code: RuleErrorCode;
  /** notAffordable: the goods that are missing. */
  missing?: Goods;
  /** wrongTerrain / needsNeighbor: the terrains that would work. */
  terrains?: readonly TerrainId[];
  /** levelTooLow: the city level that is needed. */
  level?: CityLevel;
  /** supplyNotReady: the good that must be supplied and for how many turns in a row. */
  good?: GoodId;
  turns?: number;
}
