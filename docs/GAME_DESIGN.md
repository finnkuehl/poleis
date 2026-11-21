# Poleis – Game Design

> Living document. All numbers are **starting values for balancing** and belong in the code under `src/data/`.

## 1. Overview

| | |
|---|---|
| Genre | Turn-based city-building strategy |
| Setting | Ancient Mediterranean world |
| Platform | Browser, mobile first (touch), desktop as well |
| Mode | Singleplayer against 1–3 AI civilizations |
| Map | Hex tiles, 2D top-down, randomly generated from a seed |
| Game length | 45–90 minutes, about 100–150 turns, can be saved |
| Focus | Economy & building; combat matters, but is secondary |

**Core idea:** You found a city, build goods chains, connect buildings with roads and let your city grow from a settlement into a metropolis. The economy *is* the progression – there is no separate tech tree.

## 2. Flow of a turn

1. **Production** (at the start of the player's turn): Every building that has workers, is connected to a storehouse/city center by road and receives its input goods produces.
2. **Consumption:** Residents eat, units cost upkeep, needs (oil, wine) are deducted.
3. **Growth/taxes:** Population grows or shrinks, drachmas are collected.
4. **Player actions** (any number, as long as goods suffice): build, lay roads, train/move/attack with units, level up the city.
5. **End turn** → the AI civilizations move one after another.

## 3. Terrain

| Terrain | Movement cost | Defense bonus | Buildable | Special |
|---|---|---|---|---|
| Ocean | ships only | – | no | – |
| Coastal water | ships only | – | no | Fishery and harbor border it |
| Plains | 1 | ×1.0 | yes | Standard for most buildings |
| Forest | 2 | ×1.5 | no (woodcutter next to it) | Source of wood; can be cleared (later) |
| Hills | 2 | ×1.5 | yes | Quarry, mine, vineyard |
| Mountains | impassable | – | no | Mine/quarry next to it |

- A road on a tile: movement cost for land units is halved (rounded down, at least 0.5).
- Buildings and roads only inside **your own territory**.

### Map generation
- Default size 30 × 30 tiles, rectangular; the map edge is ocean.
- **Mainland:** about 45 % of all tiles, one connected landmass (starting areas of the civilizations).
- **Islands:** 3–6 smaller islands set apart from the mainland; **more hills and forest** than the mainland (an incentive to settle by ship).
- **Mountains** form short chains (passes, chokepoints). Guarantee: every landmass stays connected for land units – no mountain cuts off an area.
- **Coastal water** = water tiles directly next to land; all other water is ocean.
- Same seed = same map. All numbers for this are in `src/data/mapgen.ts`.

## 4. Goods (12 + currency)

| Good | Type | Source |
|---|---|---|
| Wood | Raw material | Woodcutter |
| Stone | Raw material | Quarry |
| Grain | Raw material | Farm |
| Fish | Raw material | Fishery |
| Olives | Raw material | Olive grove |
| Grapes | Raw material | Vineyard |
| Ore | Raw material | Mine |
| Planks | Processed | Sawmill (wood) |
| Bread | Processed | Bakery (grain) |
| Oil | Processed | Oil press (olives) |
| Wine | Processed | Winery (grapes) |
| Bronze | Processed | Smelter (ore + wood) |
| **Drachmas** | Currency | Taxes, later marketplace |

**Food** = bread or fish (both count the same).

### Goods chains
```
Woodcutter ──Wood──► Sawmill ──Planks──► Construction, ships
Quarry ──Stone──► Construction, walls, wonder
Farm ──Grain──► Bakery ──Bread──► Residents, upkeep
Fishery ──Fish──► Residents, upkeep
Olive grove ──Olives──► Oil press ──Oil──► Need from Polis
Vineyard ──Grapes──► Winery ──Wine──► Need from Metropolis
Mine ──Ore──┐
Woodcutter ─Wood─┴► Smelter ──Bronze──► Units, wonder
```

## 5. Buildings

| Building | Placement | Cost | Workers | Per turn | From level |
|---|---|---|---|---|---|
| City center | Plains | (start / settler) | – | Storehouse, territory radius 2, +4 housing | Start |
| Storehouse | Plains | 4 wood, 2 stone | 0 | additional road connection point | Settlement |
| House | Plains | 3 wood | 0 | +4 housing | Settlement |
| Woodcutter | next to forest | 2 wood | 1 | +2 wood | Settlement |
| Quarry | Hills or next to mountains | 3 wood | 1 | +2 stone | Settlement |
| Farm | Plains | 3 wood | 2 | +3 grain | Settlement |
| Fishery | Plains at coastal water | 3 wood | 1 | +2 fish | Settlement |
| Sawmill | Plains | 4 wood, 2 stone | 1 | 2 wood → 2 planks | Settlement |
| Bakery | Plains | 3 planks, 2 stone | 1 | 2 grain → 3 bread | Settlement |
| Olive grove | Plains or hills | 4 planks | 1 | +2 olives | Settlement |
| Oil press | Plains | 4 planks, 3 stone | 1 | 2 olives → 2 oil | Settlement |
| Mine | Hills or next to mountains | 5 wood, 3 stone | 2 | +2 ore | Settlement |
| Smelter | Plains | 2 planks, 4 stone | 1 | 2 ore + 1 wood → 1 bronze | Settlement |
| Barracks | Plains | 6 planks, 4 stone | 0 | trains land units | Settlement |
| Border tower | Plains or hills | 2 wood, 4 stone | 0 | territory radius 2 around the tower | Settlement |
| Vineyard | Hills | 4 planks, 2 stone | 1 | +2 grapes | Polis |
| Winery | Plains | 4 planks, 4 stone | 1 | 2 grapes → 2 wine | Polis |
| Harbor | Plains at coastal water | 8 planks, 4 stone | 1 | builds ships, sea route connection | Polis |
| Marketplace | Plains | 6 planks, 6 stone | 1 | trade goods ↔ drachmas | Polis |
| Temple | Plains or hills | 10 stone, 4 oil | 0 | +points; later divine favor | Polis |
| World wonder | Plains, 1 per civilization | 40 stone, 20 planks, 20 bronze, 10 wine | 4 | built over 5 turns; see victory | Metropolis |

**Production rules**
- A building only produces if it (a) has all its workers, (b) is connected by road to a storehouse/city center of the same civilization and (c) has its input goods in stock.
- "Connected" = there is a chain of road tiles/building tiles between the building and the storehouse (adjacency on the hex grid). Buildings directly next to a storehouse count as connected.
- All goods go into the civilization's shared stock (no carrier simulation in version 1).
- If something is missing, the building shows a status symbol and the info panel shows the reason.
- Building a road: 1 wood per tile (from Polis on, optionally paved road: 1 stone, later).

## 6. Population & city levels

- Residents live in the city center and houses (housing) and work in buildings automatically (order: food first, then raw materials, then processing).
- **Consumption:** 1 food per 2 residents per turn (rounded up).
- **Growth:** If food is covered and there is free housing → +1 resident per turn (from Polis +2).
- **Starvation:** If food is missing → −1 resident per turn.
- **Taxes:** 1 drachma per 2 residents; +50 % if all needs of the current level are covered.

| Level | Needs per turn | Level-up requires | Unlocks |
|---|---|---|---|
| Settlement | Food | – (start) | Basic buildings, scout, settler, spearman, archer |
| Polis | Food + 1 oil per 10 residents | 20 residents, 3 turns oil supplied, 20 planks, 20 stone, 30 drachmas | Vineyard, winery, harbor, marketplace, temple, hoplite, transport ship |
| Metropolis | as Polis + 1 wine per 10 residents | 50 residents, 3 turns wine supplied, 40 planks, 40 stone, 10 bronze, 80 drachmas | World wonder, horseman, trireme |

Every city of a civilization has its own level; the stock is shared.

## 7. Units

| Unit | Attack | Defense | HP | Movement | Range | Cost | From |
|---|---|---|---|---|---|---|---|
| Scout | 1 | 1 | 5 | 3 | 1 | 2 planks, 5 drachmas | Settlement |
| Settler | 0 | 1 | 5 | 1 | – | 4 bread, 4 planks, 2 residents | Settlement |
| Spearman | 2 | 2 | 10 | 1 | 1 | 2 planks, 1 bronze | Settlement |
| Archer | 2 | 1 | 8 | 1 | 2 | 3 planks, 1 bronze | Settlement |
| Hoplite | 2 | 3 | 12 | 1 | 1 | 1 planks, 3 bronze | Polis |
| Horseman | 3 | 1 | 10 | 3 | 1 | 2 bronze, 4 grain | Metropolis |
| Transport ship | 0 | 1 | 8 | 3 | – | 6 planks | Polis (harbor) |
| Trireme | 3 | 2 | 12 | 3 | 1 | 8 planks, 2 bronze | Metropolis (harbor) |

- Training: land units in the barracks, ships in the harbor. The unit appears on the next turn.
- **Upkeep:** 1 food per unit per turn. If food is missing, every unit loses 2 HP.
- Per turn: move and/or attack (an attack ends the unit's turn).
- Healing: +2 HP per turn without acting, +4 inside your own territory.
- **Settlers** found a new city on a free plains tile (at least 4 tiles from other city centers).

### Combat formula (starting value, modeled on Polytopia)
```
attackPower   = Attack_A    × (HP_A / maxHP_A)
defensePower  = Defense_D   × (HP_D / maxHP_D) × terrainBonus × (wall ? 1.5 : 1)
total         = attackPower + defensePower
damage        = round(attackPower / total × Attack_A × 4.5)
counterattack = round(defensePower / total × Defense_D × 4.5)   // only if D survives and A is within D's range
```

### Capturing cities
An enemy land unit that stands on a city center undisturbed for one turn takes over the city, including the buildings in its territory.

## 8. Territory & vision

- City center: territory radius 2. Border tower: radius 2 around the tower (must border your own territory).
- Tiles belong to the civilization that claimed them first.
- **Fog of war:** unexplored tiles black; explored but currently not visible tiles darkened. Vision range: units 2, city center/border tower 3.

## 9. AI civilizations

| Civilization | Personality | Focus |
|---|---|---|
| Athens | Merchant | Economy, harbor/market early, little military |
| Sparta | Warrior | Barracks early, hoplites, attacks neighbors |
| Corinth | Builder | Fast growth, wonder race |

- The player chooses their own civilization (name/color free), the AI takes the rest.
- AI approach: **utility-based** – every possible action gets a score based on current needs (e.g. food scarce → farm scores high), weighted by the personality. The AI only uses regular player actions and only sees what its vision allows.
- Difficulty levels later (e.g. production bonus for the AI).

## 10. Victory conditions

Individually selectable at game start:
1. **Points** after a turn limit (default: 120 turns).
2. **World wonder:** whoever completes it first wins immediately.
3. **Conquest:** all enemy city centers captured.

| Points | Value |
|---|---|
| per resident | 1 |
| per building | 2 |
| per territory tile | 1 |
| per city at level Polis / Metropolis | 20 / 50 |
| Temple | 15 |
| World wonder | 150 |

## 11. Controls (phone)

- **Top:** resource bar (horizontally scrollable), turn X / limit.
- **Bottom:** bar with "Build", "Road", "Units"; large "End turn" button at the bottom right.
- Tap a tile → info panel from below (terrain, building, status, actions).
- Building: choose a building → valid tiles are highlighted → tap a tile → confirm.
- Road: tap the start tile, tap the target tile → preview of the path with cost → confirm.
- Tap a unit → reachable tiles highlighted, attackable enemies marked red.

## 12. Later (not in version 1)

- **Gods:** the temple generates favor; Zeus, Poseidon, Athena, Demeter with their own blessings/spells.
- Trade and diplomacy with AI civilizations (peace, trade treaties).
- Carrier simulation on roads (optional, for a Settlers feel).
- Multiplayer (the deterministic logic in `core/` is prepared for it).
- App store version.
