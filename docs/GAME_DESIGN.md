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
| Forest | 2 | ×1.5 | only woodcutter | Source of wood (woodcutter on or next to it); can be cleared (later) |
| Hills | 2 | ×1.5 | yes | Quarry, vineyard, olive grove |
| Mountains | impassable | – | only mine/quarry | Mine on it; quarry on or next to it |

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
| Grain | Raw material (food) | Farm, city center |
| Fish | Raw material (food) | Fishery |
| Olives | Raw material | Olive grove |
| Grapes | Raw material | Vineyard |
| Ore | Raw material | Mine |
| Planks | Processed | Sawmill (wood) |
| Oil | Processed | Oil press (olives) |
| Wine | Processed | Winery (grapes) |
| Bronze | Processed | Smelter (ore + wood) |
| **Drachmas** | Currency | Taxes, later marketplace |

**Food** = fish or grain (both count the same; 1 food feeds 2 residents).

### Goods chains
```
Woodcutter ──Wood──► Sawmill ──Planks──► Construction, ships
Quarry ──Stone──► Construction, walls, wonder
Farm ──Grain──► Residents, upkeep, settlers, horsemen
Fishery ──Fish──► Residents, upkeep
Olive grove ──Olives──► Oil press ──Oil──► Need from Polis
Vineyard ──Grapes──► Winery ──Wine──► Need from Metropolis
Mine ──Ore──┐
Woodcutter ─Wood─┴► Smelter ──Bronze──► Units, wonder
```

## 5. Buildings

| Building | Placement | Cost | Workers | Per turn | From level |
|---|---|---|---|---|---|
| City center | Plains | (start / settler) | – | Storehouse, territory radius 2, +4 housing, +2 grain (no workers) | Start |
| Storehouse | Plains | 4 wood, 2 stone | 0 | additional road connection point | Settlement |
| House | Plains | 3 wood | 0 | +6 housing | Settlement |
| Woodcutter | on forest, or plains/hills next to forest | 2 wood | 1 | +2 wood | Settlement |
| Quarry | on hills or mountains, or plains next to them | 3 wood | 1 | +2 stone | Settlement |
| Farm | Plains | 3 wood | 2 | +4 grain (feeds as well per worker as a fishery) | Settlement |
| Fishery | Plains at coastal water | 3 wood | 1 | +2 fish | Settlement |
| Sawmill | Plains | 4 wood, 2 stone | 1 | 2 wood → 2 planks | Settlement |
| Olive grove | Plains or hills | 4 planks | 1 | +2 olives | Settlement |
| Oil press | Plains | 4 planks, 3 stone | 1 | 2 olives → 2 oil | Settlement |
| Mine | on mountains | 5 wood, 3 stone | 2 | +2 ore | Settlement |
| Smelter | Plains | 2 planks, 4 stone | 1 | 2 ore + 1 wood → 1 bronze | Settlement |
| Barracks | Plains | 6 planks, 4 stone | 0 | trains land units | Settlement |
| Border tower | Plains or hills, inside own territory | 2 wood, 4 stone | 0 | claims territory radius 2 around the tower (only unclaimed tiles); the new land belongs to the tower's city | Settlement |
| Vineyard | Hills | 4 planks, 2 stone | 1 | +2 grapes | Polis |
| Winery | Plains | 4 planks, 4 stone | 1 | 2 grapes → 2 wine | Polis |
| Harbor | Plains at coastal water | 8 planks, 4 stone | 1 | builds ships; road connection point like a storehouse | Polis |
| Marketplace | Plains | 6 planks, 6 stone | 1 | trade goods ↔ drachmas | Polis |
| Temple | Plains or hills | 10 stone, 4 oil | 0 | +points; later divine favor | Polis |
| World wonder | Plains, 1 per civilization | 40 stone, 20 planks, 20 bronze, 10 wine | 4 | built over 5 turns; see victory | Metropolis |

**Production rules**
- A building only produces if it (a) has all its workers, (b) is connected by road to a storehouse/city center of the same civilization and (c) has its input goods in stock.
- "Connected" = there is a chain of road tiles/building tiles between the building and the storehouse (adjacency on the hex grid). Buildings directly next to a storehouse count as connected.
- All goods go into the civilization's shared stock (no carrier simulation in version 1).
- If something is missing, the building shows a status symbol and the info panel shows the reason.
- Building a road: 1 wood per tile (from Polis on, optionally paved road: 1 stone, later).

**Detailed rules (decided in M2)**
- **Start:** stock of **20 wood and 10 stone**. The first city center is placed **automatically** on plains on the mainland; its territory (radius 2) is guaranteed to contain forest, hills or mountains and enough plains. The camera starts there.
- **Resource placement (balance pass after M3):** resource buildings may stand on their resource. Woodcutter: on forest, or on plains/hills next to forest. Quarry: on hills or mountains, or on plains next to them. Mine: on mountains only (a city without mountains reaches them with a border tower). Fishery: plains next to coastal water.
- **Territory grows with border towers** (moved forward from M4): a city claims radius 2; border towers claim radius 2 around themselves. Ordinary buildings do not expand territory – expanding stays a deliberate, paid choice.
- **One thing per tile:** a tile holds either one building or one road.
- **Roads** only on walkable land in the player's own territory (plains, forest, hills – not mountains, not water). A road may pass through the player's own buildings at no cost.
- **Demolishing** buildings and roads is allowed, **without refund**. The city center cannot be demolished.
- **Production order:** raw-material buildings (no inputs) produce first, then processing buildings – so freshly cut wood can become planks in the same turn. If goods run short, older buildings go first.
- **Workers** go only to connected buildings, in this order: food (farm, fishery), then raw materials, then processing; older buildings first within a group. A building only gets workers if its **whole crew** can be filled – otherwise it gets none and the workers go on to the next building, so no worker is wasted.
- **Pause:** the player can pause any building; a paused building gets no workers and produces nothing, so its workers go to the next building in line.
- **Low priority per good** (decided after M5, toggle in the 📊 Overview): buildings that produce a good marked "low priority" get workers only after all other buildings of their city are staffed. They keep producing with leftover workers, so production slows instead of stopping. The setting is per civilization and also applies to buildings built later.

## 6. Population & city levels

- Residents live in the city center and houses (housing) and work in buildings automatically (order: food first, then raw materials, then processing).
- **Consumption:** 1 food per 2 residents per turn (rounded up).
- **Growth:** If food is covered and there is free housing → +1 resident per turn; **+1 more** on a Polis or Metropolis whose needs are all met.
- **Starvation:** If food is missing → −1 resident per turn.
- **Taxes:** 1 drachma per 2 residents; +50 % if all needs of the current level are covered.

| Level | Needs per turn | Level-up requires | Unlocks |
|---|---|---|---|
| Settlement | Food (never oil or wine) | – (start) | Basic buildings, scout, settler, spearman, archer |
| Polis | Food + 1 oil per 10 residents | 20 residents, oil production per turn covers the need (see below), 20 planks, 20 stone, 30 drachmas | Vineyard, winery, harbor, marketplace, temple, hoplite, transport ship |
| Metropolis | as Polis + 1 wine per 10 residents | 50 residents, wine production per turn covers the need (see below), 40 planks, 40 stone, 10 bronze, 80 drachmas | World wonder, horseman, trireme |

Every city of a civilization has its own level; the stock is shared.

**Detailed rules (decided in M3)**
- **Start:** a new city has **4 residents** (its city center is full). Residents live in the city center and the houses in that city's territory and work in that city's buildings.
- **The city center feeds a little by itself:** it produces **2 grain per turn** without workers, which feeds its first 4 residents. A city never gets stuck – a fishery or a farm can always be staffed again.
- **Eating:** fish is eaten first, then grain (grain is kept back for settlers and horsemen). If food runs short, residents eat what is there and the city loses 1 resident; a city never drops below 1 resident.
- **Growth** needs only food and free housing; missing oil or wine never stops or reverses growth, it only removes the +1 growth bonus and the +50 % taxes.
- **Oil and wine are used only from the level that needs them:** a city uses 1 oil per 10 residents (rounded up) only once it **is** a Polis, and oil and wine once it is a Metropolis. A Settlement never touches oil. There is no supply streak.
- **Advancing needs enough production:** besides the residents and the one-time cost, the player's buildings must make enough of the next level's supply good (oil for Polis, wine for Metropolis) per turn. `made` = what all the player's buildings produce of it per turn (marketplace purchases and stock do not count); `needed` = what all OTHER own cities already need of it at their current level + what this city will need at the next level (1 per 10 residents, rounded up). The advance is possible when `made >= needed`. The city panel shows it as "Oil: makes 2 / needs 3 per turn".
- **Needs met** (fed, and every need of the current level covered): +50 % taxes and +1 growth per turn (Polis and Metropolis only). Needs not met: only these bonuses are lost.
- **Advancing is the player's decision:** the city panel shows the requirements; the "Advance" button pays the goods and raises the level. A city never drops back a level – a Polis without oil only loses the +50 % tax bonus.
- **Taxes:** rounded down (e.g. 5 residents → 2 drachmas; with the bonus 2 × 1.5 = 3).
- **Marketplace:** sell 2 of any good for 1 drachma, or buy 1 good for 3 drachmas. Trading works only while the player has a connected, staffed marketplace.
- **In M3** the Polis level unlocks vineyard, winery, marketplace and temple. Harbor (M6), units (M4) and the world wonder (M5, with the victory rules) follow later.

## 7. Units

| Unit | Attack | Defense | HP | Movement | Range | Cost | From |
|---|---|---|---|---|---|---|---|
| Scout | 1 | 1 | 5 | 3 | 1 | 2 planks, 5 drachmas | Settlement |
| Settler | 0 | 1 | 5 | 1 | – | 4 grain, 4 planks, 2 residents | Settlement |
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

### Detailed rules (decided in M4)
- **Movement:** a unit's movement points are spent on the cost of each tile it enters (plains 1, forest/hills 2; mountains and water are impassable for land units; a road on the entered tile halves the cost, minimum 0.5). **A unit that has not moved yet this turn may always step onto one neighboring tile**, whatever it costs.
- **One unit per tile.** Units block each other; a unit can stand on buildings and roads.
- **Only into explored land:** a unit can only move onto tiles its civilization has already explored (so the fog reveals nothing). A scout explores step by step: move, see further, move on. If an unseen enemy unit stands in the way, the move is blocked ("An unseen unit blocks the way.").
- **Training:** all land units – settlers included – are trained in a barracks; the cost is paid when ordering, the unit appears at the start of the next turn on the barracks tile (or the nearest free walkable tile next to it). One order per barracks per turn.
- **Settlers** take 2 residents from the barracks' city (that city needs at least 3). A settler founds a city on a free plains tile at least 4 tiles from every city center; the settler is used up, the new city starts with **2 residents** and claims the unclaimed land in radius 2.
- **Upkeep:** units eat after the residents; if food runs out, every unit loses 2 HP. A unit at 0 HP is gone.
- **Combat:** move and/or attack per turn; an attack ends the unit's turn. Defender bonuses multiply: forest/hills ×1.5, **a unit defending on a city center counts as walled (×1.5)**. After a win the attacker stays where it is.
- **Capturing:** a land unit (not a settler) that stands on an enemy city center and is still there, unattacked, at the start of its owner's next turn takes the city with the buildings and territory of that city.
- **Test mode** (`&sandbox`): a passive enemy civilization (one city, two spearmen) is placed nearby so combat and capturing can be tried before the AI arrives (M5). It takes no actions.

### Detailed rules (decided after M4: move orders)
- **Move orders:** a selected unit can be sent to any explored land tile it cannot reach this turn, as long as a land path over explored tiles leads there. **Dragging** the unit onto that tile gives the order right away; **tapping** the tile shows the path with turn numbers and a "Go here (N turns)" button (cancel = nothing happens).
- **Walking:** the unit walks right away as far as its movement allows this turn. At the start of each of its owner's turns (after healing and new units, before production) it walks on along the cheapest path with its full movement – same rules as a normal move (explored tiles only, terrain costs, roads, the 1-tile rule, one unit per tile). The path is planned again every turn; units the owner can see block it, unseen ones do not (the fog reveals nothing).
- **The order ends** when the unit arrives, when no path is left (the way is blocked), when an enemy unit it had not seen during this order comes into its sight (enemies already visible when the order was given do not stop it), when it is attacked, or when the player moves, attacks or founds a city with it by hand, gives it a new order or taps "Stop".
- A unit on its way moves every turn, so it does not heal.
- **Display:** every own unit with an order shows a faint line to a small flag at its destination; the selected unit's path shows a turn number (1, 2, 3 …) where it will stop at the end of each coming turn. The turn summary says when a unit arrived or stopped (and why).
- The **"Units" button** skips units with an order (they are busy); tapping such a unit still selects it.

### Detailed rules (decided in M6: seafaring)
- **Harbor = connection point:** a harbor works like a storehouse for road connections (buildings next to it or linked to it by road count as connected). There are no sea routes to draw – goods already go into one shared stock and an island city's center connects its own buildings.
- **Transport ship:** a land unit steps from the coast onto an adjacent own transport ship; a transport carries **up to 2 units**; they step off onto an adjacent land tile. If the ship sinks, the units on board are lost. This is how settlers reach the islands.
- **Trireme:** attacks ships and land units on tiles next to the water; land units with a ranged attack (archers, range 2) can shoot at ships near the coast. Ships never capture cities.
- **AI and ships:** in M6 the AI civilizations do not build harbors or ships – they stay on the mainland. Seafaring AI comes later.
- **Boarding and landing end the move:** a land unit that steps onto a transport, or off it onto an adjacent land tile, has no movement left that turn. The ship itself can still sail in the same turn (passengers travel along).
- **No attacks from on board:** passengers cannot attack; they land first and fight from the next turn on. Only the trireme fights at sea.
- **Where ships go:** both ships sail on coastal water and ocean (land units never enter water on their own). A ship trained in the harbor appears next turn on a free water tile next to the harbor; if none is free, it waits.
- **Ships and cities:** ships never capture cities and never enter land.

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

### Detailed rules (decided in M5)
- **AI turns:** after "End turn" every AI civilization takes its turn, one after another, **instantly** (no animation – animations follow in M7). Then the player's next turn starts. The turn summary lists what the player could see (e.g. "Sparta attacked your scout", a city lost or captured, a civilization out of the game).
- **Peace time:** no AI civilization attacks anyone before **turn 15**. After that its personality decides: Sparta attacks often, Athens rarely, Corinth only when it is clearly stronger.
- **World wonder:** the whole cost is paid when it is placed. Every turn it has its 4 workers and a road connection, its progress goes up by 1 (shown as "2 of 5"); without workers or connection it pauses. At 5 of 5 it is complete: with the wonder victory switched on, the first civilization to complete it wins at once; otherwise it is worth its points. A world wonder can never be demolished (finished or not). An AI civilization places its wonder only **from turn 70** on (like the peace time, this is AI behavior; the player may build it whenever they can).
- **Out of the game:** a civilization that loses its last city is out; its remaining units disappear. If this happens to the player, the defeat screen appears. **Conquest** = all other civilizations are out.
- **Start menu:** the player picks a civilization name (free text) and one of 4 colors (Tyrian purple by default), the number of AI civilizations (1–3), the map size (small 24 × 24, normal 30 × 30, large 40 × 40), the seed (random unless typed in) and the victory types (three checkboxes, all on by default; turn limit 120). The AIs are Athens, Sparta and Corinth; with fewer than 3, the seed picks which.
- **Saving:** the game saves itself every turn ("Continue" in the start menu). In addition the player can save to **3 slots** and load them again.
- **Scores:** a "Scores" sheet lists every civilization with its points and its wonder progress – also civilizations the player has not met yet.

## 11. Controls (phone)

- **Top:** resource bar (horizontally scrollable), turn X / limit.
- **Bottom:** bar with "Build", "Road", "Units"; large "End turn" button at the bottom right.
- Tap a tile → info panel from below (terrain, building, status, actions).
- **Tap an empty tile in your territory** → the panel lists every building that fits on that tile ("Build here"); **one tap builds it** right away. Unaffordable ones are muted with what is missing, higher-level ones show "From Polis". A "Road from here" button starts a road on that tile.
- Building via the "Build" button: choose a building → valid tiles are highlighted → tap a tile → confirm.
- Road: tap the start tile, tap the target tile → preview of the path with cost → confirm.
- Tap a unit → reachable tiles highlighted, attackable enemies marked red.

## 12. Later (not in version 1)

- **Gods:** the temple generates favor; Zeus, Poseidon, Athena, Demeter with their own blessings/spells.
- Trade and diplomacy with AI civilizations (peace, trade treaties).
- Carrier simulation on roads (optional, for a Settlers feel).
- Multiplayer (the deterministic logic in `core/` is prepared for it).
- App store version.
