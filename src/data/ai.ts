// AI civilizations (docs/GAME_DESIGN.md, section 9).
// The AI is "utility-based": every possible action gets a score ("utility"); each step it does the
// highest-scoring one it can afford. All scores and thresholds live here, so you can tune them:
// a higher number = the AI wants it more / earlier. Scores are compared with each other, so
// only the relation matters (100 beats 60).

import type { BuildingId } from './buildings';
import type { CivId } from './game';
import type { Goods } from './goods';
import type { UnitId } from './units';

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
  // An AI civilization places its world wonder only from this turn on (like the peace time, this
  // is AI-only: the human may build it whenever they can).
  wonderFromTurn: 70,

  // Personality of an AI that plays the human's civilization (no civ). Test mode only (`&watch`).
  watchPersonality: 'builder' as Personality,
  // Watch mode (`&watch`): milliseconds between two automatic turns.
  watchIntervalMs: 1000,

  // Seafaring AI comes later: until then the AI civilizations never build these buildings and
  // never train these units (they stay on the mainland).
  neverBuild: ['harbor'] as readonly BuildingId[],
  neverTrain: ['transport', 'trireme'] as readonly UnitId[],

  // --- Turn driver ---
  // The most actions one AI civilization takes per turn (keeps a turn fast).
  maxActionsPerTurn: 60,
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
    // Food buildings (fishery, farm); multiplied by how short food is.
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

  // --- Tuning of the economy wishes ---
  // Free housing of a city counted as future workers (a growing city staffs buildings soon).
  futureWorkerHousing: 3,
  // Food urgency = 1 + min(foodUrgencyMax, food deficit / foodUrgencyDivisor).
  foodUrgencyMax: 2,
  foodUrgencyDivisor: 2,
  // A food stock this big halves the food urgency.
  foodStockHalvesUrgency: 20,
  // Farm wish strength relative to the base food utility.
  farmFactor: 0.9,
  // Housing buffer a Metropolis keeps (room for the wonder's crew).
  metropolisHouseBuffer: 4,
  // A city with at most this much free housing and no spare workers builds houses for workers.
  needsWorkersMaxFreeHousing: 3,
  // A Settlement with less housing than this builds houses a bit earlier (prepares the Polis).
  preparePolisHousing: 22,
  preparePolisFactor: 1.2,
  // House wish factor when the city lacks workers.
  workerShortHouseFactor: 1.3,
  // Oil / wine stock below which the chain is started (also when the net is negative).
  oilStartStock: 10,
  wineStartStock: 12,
  // Second building of a chain (press, winery, smelter) is wished a bit more than the first.
  chainSecondFactor: 1.1,
  // Most mines the bronze chain builds.
  maxMines: 2,
  // The shortage of goods is read from this many of the strongest unaffordable wishes.
  shortageTopWishes: 4,
  // Extra stone income wanted per city level.
  stoneIncomePerLevel: 2,
  // Income building wish: at most 1 + this x (how far the income is below the target).
  incomeDeficitCap: 3,
  // A sawmill is also built when this much wood is in stock.
  sawmillWoodStock: 30,

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
  // Barracks: the turn from which the AI wants one (warriors early, others a bit later). Every
  // personality needs one for scouts, settlers and defenders.
  barracksStartTurn: { merchant: 20, warrior: 5, builder: 15 } as Record<Personality, number>,

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

  // --- Military: training, exploring, defending, attacking, settling (src/ai/units.ts etc.) ---
  military: {
    // Utility of the unit commands (no goods are spent, so they are compared with each other
    // and with the economy only through these numbers).
    utility: {
      // Settler: found the city / walk to the chosen site.
      foundCity: 820,
      settleWalk: 250,
      // Attacks (+ damage bonus), capturing an empty enemy city, moving to a spot to attack.
      attack: 700,
      capture: 760,
      moveToAttack: 650,
      // Retreat of a badly wounded unit.
      retreat: 500,
      // Defenders walking to their post / army marching / army going home / scout exploring.
      defendPost: 280,
      march: 150,
      goHome: 140,
      explore: 120,
      // Safety: cancel an order that would end on an enemy city center in peace time.
      peaceGuard: 880,
      // Training wishes.
      trainSettler: 70,
      trainScout: 95,
      trainDefender: 90,
      trainDefenderUnderThreat: 400,
      trainAttacker: 65,
    },

    // --- Unit command tuning ---
    // Attack utility = attack + damage x attackDamageWeight - counter x attackCounterWeight
    // + attackKillBonus when the defender dies.
    attackDamageWeight: 10,
    attackCounterWeight: 5,
    attackKillBonus: 100,
    // Enemies farther than this (tiles) are not considered for moving into attack position.
    attackSearchRange: 8,
    // Attack position value: damage - counter + terrain cover + kill bonus - move cost x penalty.
    positionKillBonus: 3,
    positionCostPenalty: 0.1,
    // Army units farther than this from the target city march; closer ones fight.
    marchStopDistance: 2,
    // The army considers this many target cities for marching orders.
    marchTargets: 2,
    // Utility: unpause the buildings once the wonder is complete / pause one for the crew.
    unpauseUtility: 200,
    pauseUtility: 300,
    // Settler founds a city here although no site was good enough.
    foundAnywhereUtility: 200,
    // Radius (tiles) around a site that counts for its score.
    settleSiteRadius: 2,

    // --- Training ---
    // Scouts: alive + ordered at most this many; a second one only from `scoutSecondTurn` while
    // less than `scoutSecondBelow` of the map is explored. No scouts once this much is explored.
    scoutsWanted: 1,
    scoutSecondTurn: 15,
    scoutSecondBelow: 0.45,
    scoutStopExplored: 0.7,
    // Defenders (combat units) per city, by personality; +1 when enemy units are near the city.
    defendersPerCity: { merchant: 1, warrior: 2, builder: 1 } as Record<Personality, number>,
    threatRadius: 4,
    threatExtraDefenders: 1,
    // The army (combat units on top of the defenders): from this turn on the AI trains this many,
    // one more every `armyGrowEvery` turns, up to `armyMaxSize`.
    armyStartTurn: { merchant: 70, warrior: 10, builder: 50 } as Record<Personality, number>,
    armySize: { merchant: 3, warrior: 4, builder: 3 } as Record<Personality, number>,
    armyGrowEvery: 20,
    armyMaxSize: 8,
    // Bronze in stock the AI aims for once it has a barracks (units cost bronze).
    bronzeTarget: { merchant: 4, warrior: 12, builder: 6 } as Record<Personality, number>,
    // A Polis trains hoplites for defense when the stock holds at least this much bronze.
    hopliteMinBronze: 4,
    // Food left per turn after the extra unit has eaten (production - residents - all units).
    // Warriors accept a small food deficit while the food stock is at least `unitFoodStockMin`.
    unitFoodMargin: { merchant: 0, warrior: -2, builder: 0 } as Record<Personality, number>,
    unitFoodStockMin: 20,
    // The food wishes plan for this many wanted-but-missing units at most (they will eat).
    unitFoodPlanCap: 4,

    // --- Offense (only after the peace time) ---
    // The army needs this many units to march out (fewer once its units are at the target).
    armyMinSize: 3,
    armyMinSizeEngaged: 1,
    // Own units this close to the target city count as "engaged".
    engageRadius: 3,
    // Strength (attack x HP share) of visible enemy units within this distance of the target.
    targetStrengthRadius: 4,
    // Strength assumed for a target city whose center is not in sight.
    assumedCityDefense: 4,
    // The army strength must be at least this many times the enemy strength near the target.
    attackRatio: { merchant: 4, warrior: 0.8, builder: 3 } as Record<Personality, number>,
    // ... times this factor once units are already fighting at the target.
    engagedRatioFactor: 0.5,
    // Units below this share of their HP leave the fight and go home; they only rejoin the
    // army once healed to `rejoinHp`.
    retreatHp: 0.4,
    rejoinHp: 0.75,

    // --- Exploring ---
    // Frontier tiles tried per scout (nearest first), and the distance two scouts keep apart.
    frontierTries: 4,
    scoutSpread: 5,

    // --- Settling ---
    // A city may send out a settler once it has this many residents and the food surplus of the
    // residents (units not counted) is at least `expandMinFoodNet`.
    expandMinResidents: 8,
    expandMinFoodNet: 0,
    // While a city waits to advance (enough residents, but oil/goods missing) no settlers go out:
    // they would take the workers the chain needs. Unless the city is this big.
    expandWaitResidents: 40,
    // Most cities per personality.
    maxCities: { merchant: 2, warrior: 3, builder: 4 } as Record<Personality, number>,
    // Site: preferred and largest distance from the nearest own city center.
    settlePreferredDistance: 6,
    settleMaxDistance: 10,
    // Site score: value of each tile in radius 2 (not foreign), minus penalties.
    settleTileValue: {
      plains: 1,
      forest: 1.2,
      hills: 1.5,
      mountains: 1.2,
      coast: 1,
      ocean: 0.1,
    },
    settleDistancePenalty: 1,
    settlePathPenalty: 0.3,
    // Known enemy city centers closer than this make a site worse (per missing tile).
    settleEnemyDistance: 7,
    settleEnemyPenalty: 1,
    // Sites scoring less than this are not used.
    settleMinScore: 8,
    // Alternatives tried when the best site cannot be reached.
    settleTries: 3,

    // --- Wonder crew ---
    // Value of keeping a building staffed while the wonder lacks workers (low = paused first).
    // Food buildings and the wonder itself are never paused; unlisted buildings are never paused.
    wonderPauseValue: {
      marketplace: 1,
      temple: 2,
      mine: 3,
      smelter: 3,
      quarry: 4,
      sawmill: 5,
      woodcutter: 6,
      vineyard: 8,
      winery: 8,
      oliveGrove: 9,
      oilPress: 9,
    } as Partial<Record<string, number>>,
    // Most buildings of one city paused for the wonder.
    wonderMaxPaused: 4,
  },

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
