// AI civilizations (docs/GAME_DESIGN.md, section 9).
// The AI is "utility-based": every possible action gets a score ("utility"); each step it does the
// highest-scoring one it can afford. All scores and thresholds live here, so you can tune them:
// a higher number = the AI wants it more / earlier. Scores are compared with each other, so
// only the relation matters (100 beats 60).

import type { CivId } from './game';
import type { Goods } from './goods';

export type Personality = 'merchant' | 'warrior' | 'builder';

// The personality of each AI civilization.
export const AI_CIVS: Record<CivId, { personality: Personality }> = {
  athens: { personality: 'merchant' },
  sparta: { personality: 'warrior' },
  corinth: { personality: 'builder' },
};

/** Wishes the personality can make stronger or weaker (multiplier on the base utility). */
export type PersonalityWish =
  'house' | 'marketplace' | 'trade' | 'temple' | 'wonder' | 'barracks' | 'expand';

export const aiConfig = {
  // No AI civilization attacks anyone before this turn (peace time).
  peaceUntilTurn: 15,

  // --- Turn driver ---
  // The most actions one AI civilization takes per turn (keeps a turn fast).
  maxActionsPerTurn: 16,
  // The AI stops for the turn when the best remaining action scores this or less.
  minUtility: 10,

  // --- Base utilities (before urgency and personality) ---
  utility: {
    // Connecting a freshly built building to the road network (an unconnected building is useless).
    connectRoad: 900,
    // Advancing a city that meets all requirements.
    advance: 800,
    // Keeping the goods for an advance whose other requirements are met.
    advanceReserve: 700,
    // Food buildings (fishery, farm, bakery); multiplied by how short food is.
    food: 100,
    // A house when the city runs out of housing.
    house: 75,
    // Income buildings, multiplied by how far the income is below its target.
    woodcutter: 80,
    quarry: 70,
    sawmill: 85,
    // Chains that prepare the next city level.
    oilChain: 60,
    wineChain: 60,
    bronzeChain: 55,
    // Optional buildings.
    marketplace: 40,
    temple: 45,
    barracks: 80,
    wonder: 250,
    // Border towers: to reach terrain a wished building needs / when plains run out / to grow.
    towerForTerrain: 0.9, // x the utility of the wish that is stuck
    towerForPlains: 110,
    towerToExpand: 20,
    // Trading: selling a big surplus, buying the few goods that block an important wish.
    sell: 35,
    buy: 65,
  },

  // --- Targets ---
  // Food net per turn the AI wants to keep (after the residents ate), looking a few turns ahead.
  foodNetTarget: 1,
  // Food in stock from which the AI no longer worries about a food shortage when counting workers.
  foodStockSafe: 6,
  // Turns of growth the AI plans food for.
  foodLookAheadTurns: 3,
  // Do not build more of an income building when this much of the good is in stock.
  stockSatiation: { wood: 60, stone: 60, planks: 50 },
  // Net income per turn wanted for the basic goods (+ extra when a wish is short of the good).
  incomeTarget: { wood: 2, stone: 2, planks: 2 },
  incomeShortageBonus: 2,
  // A sawmill is only built once the wood income (net) can feed it (it eats this much per turn).
  sawmillWoodNeeded: 2,
  // Goods that cheaper wishes must leave in the stock (income buildings may use them): the AI
  // never spends its last wood on houses and the like, so it can always build a woodcutter.
  keepStock: { wood: 4 } as Goods,
  // Most buildings of a kind the AI keeps per city (stops endless building).
  maxPerCity: {
    woodcutter: 4,
    quarry: 3,
    sawmill: 2,
    fishery: 4,
    farm: 8,
    oliveGrove: 4,
    vineyard: 4,
  },
  // House: build when free housing is at most this (builders plan ahead).
  houseBuffer: { merchant: 1, warrior: 1, builder: 6 } as Record<Personality, number>,
  // House: only when the food also covers the residents who would move in (builders build
  // ahead of the food and let the food wishes catch up).
  houseNeedsFoodCover: { merchant: true, warrior: true, builder: false } as Record<
    Personality,
    boolean
  >,
  // House: the food net per turn (after eating) the AI wants before it builds one.
  houseMinFoodNet: { merchant: 1, warrior: 1, builder: 0 } as Record<Personality, number>,

  // --- Preparing the city levels ---
  // Start the oil chain when a settlement has this many residents (Polis needs 20).
  oilChainResidents: 10,
  // Start the wine chain when a Polis has this many residents (Metropolis needs 50).
  wineChainResidents: 35,
  // Start the bronze chain when a Polis has this many residents (also needed for the wonder).
  bronzeChainResidents: 25,
  // Bronze in stock the AI aims for: advance to Metropolis / the wonder.
  bronzeStockTarget: { polis: 10, metropolis: 20 },
  // Net oil / wine per turn wanted after the city's own needs.
  oilNetTarget: 1,
  wineNetTarget: 1,

  // --- Optional buildings ---
  // Temple: build only if stone and oil stay above these amounts after paying.
  templeKeepStone: 10,
  templeKeepOil: 3,
  // Most temples per personality.
  maxTemples: { merchant: 1, warrior: 1, builder: 3 } as Record<Personality, number>,
  // Barracks: the turn from which the AI wants one (warriors early, others late and at Polis).
  barracksStartTurn: { merchant: 40, warrior: 5, builder: 40 } as Record<Personality, number>,

  // --- Border towers ---
  // Build a tower when fewer free plains than this are left in the territory.
  freePlainsMin: 10,
  // A tower must claim at least this many new tiles.
  towerMinGain: 3,
  // The most towers per civilization.
  maxTowers: 12,
  // Value of a newly claimed tile by terrain; terrain a wish needs counts `neededTerrainValue`.
  tileValue: { plains: 1.5, forest: 1, hills: 1, mountains: 1, coast: 0.1, ocean: 0.1 },
  neededTerrainValue: 6,
  // Towers on plains cost a building spot: subtracted from the tower tile's score.
  towerOnPlainsPenalty: 1,
  // Stock the AI wants before building a tower just to expand.
  expandMinStock: { wood: 20, stone: 25 },

  // --- Placement ---
  // Score lost per new road tile a tile needs to reach the road network.
  roadTileCost: 3,
  // Score for building a resource building on its resource tile (keeps plains free).
  onResourceBonus: 4,
  // Score lost for building something else on coastal plains (reserved for fisheries) / hills.
  coastalPlainsPenalty: 3,
  hillsPenalty: 1,

  // --- Workers ---
  // Utility multiplier for a worker building in a city without free workers.
  noFreeWorkersFactor: 0.02,
  // ... when the city is growing and will get them soon.
  growingFactor: 0.5,
  // ... food buildings (they feed the growth, so they are only damped a little).
  foodNoWorkersFactor: 0.6,

  // --- Trading (only with a working marketplace) ---
  // Sell a good when the stock is above this ...
  sellAbove: 60,
  // ... down to this amount.
  sellKeep: 40,
  // Most lots (2 goods each) sold per action.
  sellMaxLots: 10,
  // Buy only if the blocked wish is short of at most this many goods in total ...
  buyMaxGoods: 4,
  // ... or this many when the AI is rich (it has at least `buyRichDrachmas`).
  buyMaxGoodsRich: 20,
  buyRichDrachmas: 200,
  // Drachmas the AI keeps for advancing before it buys goods.
  buyKeepDrachmas: 30,

  // --- Personality weights (multiply the base utility of that wish) ---
  weights: {
    merchant: {
      house: 1,
      marketplace: 2.5,
      trade: 2,
      temple: 1,
      wonder: 0.6,
      barracks: 0.35,
      expand: 1,
    },
    warrior: {
      house: 1,
      marketplace: 0.7,
      trade: 1,
      temple: 0.8,
      wonder: 0.6,
      barracks: 1,
      expand: 1.2,
    },
    builder: {
      house: 1.4,
      marketplace: 1,
      trade: 1,
      temple: 1.6,
      wonder: 1.6,
      barracks: 0.35,
      expand: 1.4,
    },
  } as Record<Personality, Record<PersonalityWish, number>>,
};
