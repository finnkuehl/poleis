# Handover – read this first in a new session

This file lets a fresh Claude session continue Poleis without the old chat history.
Read it together with `CLAUDE.md` (rules), `docs/GAME_DESIGN.md` (game design incl. all "Detailed rules (decided in …)" sections) and `docs/PROGRESS.md` (checklist).

## 1. Where we are

- **Repo:** https://github.com/finnkuehl/poleis (public), local folder `~/Projects/poleis` (NOT in iCloud – iCloud corrupted files once).
- **Live game:** https://finnkuehl.github.io/poleis/ – updated ~2 min after every merge into `main` (Pages may show the old version for up to ~10 min).
- **Test mode:** add `&sandbox` → big start stock + a passive red enemy city ~6–9 tiles away (for seed 1: 7 tiles **south** of the player's city). Example: `https://finnkuehl.github.io/poleis/?seed=1&sandbox`.
- **Done and tagged:** M0 `v0.0.0`, M1 `v0.1.0`, M2 `v0.2.0`, M3 `v0.3.0`, balance pass `v0.3.1`.
- **M4 – Territory & military is merged as `v0.4.0`** (PR #6): units, combat, capturing, settlers, fog of war, plus the user's overview requests (workers working/free, "📊 Overview" economy sheet, drag & drop for units). The user tested it on desktop: "looks good".
- **Multi-turn move orders are done as `v0.4.1`** (§5a, rules in GAME_DESIGN §7 "decided after M4: move orders").
- **M5 – First complete game** (`v0.5.0`, branch `m5-complete-game`): start menu, 1–3 AI civilizations (Athens, Sparta, Corinth), victory/defeat, scores, saving (autosave + 3 slots). Rules in GAME_DESIGN "Detailed rules (decided in M5)". Next: M6 – Seafaring (see §6).
- **Low priority per good** is merged as `v0.5.1` (PR #9).
- **M6 – Seafaring is paused** (user request); its gameplay decisions are on branch `m6-seafaring`.
- **M7 graphics are merged as `v0.5.2`** (PR #10): see `docs/ART.md` (all art decisions with the user, incl. grounded buildings, hills/mountains, forests, towns, roads, units) and `tools/art/README.md` (how the building, unit and tree art is generated). Rest of M7 (sound, animations, tutorial, PWA, balancing) is not started.
- **Quick-start URLs for testing** skip the start menu: `?seed=1&sandbox` (test mode, no autosave), `?seed=1&ai=3` (3 AIs), `&size=small|normal|large`.

## 2. How we work (important – the user relies on it)

- **The user** is a programming beginner, decides the game design, tests on the phone. Communicate in **English**, short, explain terms. Every finished task ends with a **3–5 step test guide**.
- **Gameplay gaps → ask** with `AskUserQuestion`, 2–3 concrete options, recommendation first. Record every decision in `docs/GAME_DESIGN.md` ("Detailed rules (decided in Mx)") in the same branch.
- **Milestone flow:** questions → plan (steps, files, my interpretations) → wait for OK → branch `mN-name` → steps → browser test → PR → `code-review` → fix → user tests on GitHub Pages after merge → tag.
- **Opus plans, Sonnet implements:** delegate every code step to the subagent `implementer` (`.claude/agents/implementer.md`). Briefs must contain: goal, exact file scope ("you own …, don't touch …"), APIs/types to use, rules (cite GAME_DESIGN sections), tests, acceptance (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`). Run agents **in parallel only on disjoint files**; core first, then render ‖ UI components, then wiring in `src/ui/interaction.ts`.
- **After each step:** run the four checks yourself, look at key code, commit with an English imperative message ending with the `Co-Authored-By` line.
- **Typical snag:** adding a required field to a core type breaks hand-built fixtures in `src/ui/preview.ts` / ui tests – allow the implementer to fix exactly those lines.
- **code-review plugin** before every merge (`/code-review:code-review <PR>`): eligibility (haiku) → CLAUDE.md list (haiku) → summary (sonnet) → 2 CLAUDE.md reviewers (sonnet) + 2 bug reviewers (opus) → validate each bug finding with its own agent → fix confirmed ones. Tell reviewers to read `CLAUDE.md` **from disk** (they sometimes see an old German copy).
- **frontend-design plugin** for UI work. Visual direction: Aegean marble & bronze (tokens in `src/ui/ui.css`), Tyrian purple player color, one bold element (bronze "End turn" coin), sentence case, no all-caps, no "→" in buttons.
- **Merging:** auto-merge is disabled in the repo. Check CI once (`gh pr view N --json statusCheckRollup`), then `gh pr merge N --merge --delete-branch`, pull `main`, tag `v0.N.0`, push the tag. Never poll CI in a loop.
- **Phone testing:** the phone **cannot** reach the Mac over Wi-Fi (Mac firewall + FritzBox guest network 192.168.179.x) → the user tests on GitHub Pages after the merge.
- **Browser testing yourself:** `.claude/launch.json` has `poleis-dev` (Vite on 5173). Use the in-app browser; prefer `find` refs over coordinates (the pane size changes). To locate things in a seed quickly, print positions with a temporary Vitest file in `src/_tmp/` and delete it afterwards.

## 3. Code map

- `src/core/` – pure logic, JSON state, deterministic (seeded RNG in state). ESLint forbids render/ui/save imports, `Math.random`, `window`/`document` there.
  - `state.ts` – `GameState` (settings [aiCount, mapSize, victory, turnLimit, playerName, playerColor], map, rng, turn, currentPlayer, players [goods, explored, civ, name, color, alive], buildings [paused, progress for the wonder], roads[], territory[], cities [level, residents, supplyStreak], tileCity[], units [hp, movesLeft, hasMoved, acted, attacked, capturing, order], training[], nextId, lastReport, events[], result); `createGameState(seed, { sandbox, settings })` (+ AI civs or the passive sandbox enemy).
  - `actions.ts` – `applyAction` (structuredClone, never mutates): build, buildRoad, demolish, togglePause, advanceCity, trade, train, move, attack, foundCity, endTurn; updates fog (`updateAllExplored`) after every action.
  - `turn.ts` – `endTurn` passes the turn to the next alive, non-passive player (turn + 1 when the order wraps; events are cleared when the human ends the turn); points victory at the turn limit; then the start of that player's turn: capture → eliminations + victory check → heal/reset units → spawn trained units → move orders walk on → production (wonder progress) → population → unit upkeep; `lastReport` = latest turn start.
  - `rules/` – placement, territory (+`territoryGain`), connection (BFS), workers (full crews, per city, paused), production (status kinds), population, advance, trade, roads (A*), movement (explored-only, 1-tile rule, `ignoreHiddenUnits`), units (training/spawn/upkeep/heal), combat (formula + preview), capture, found, vision (fog), economy (overview/estimate), orders (multi-turn move orders: plan, walk, stop reasons), events (`seenBy`), elimination, score (`scoreOf`, `scoreboard`), victory, errors.
  - `hex/` (axial pointy-top, A*, `reachable`), `mapgen/` (map + start positions).
- `src/data/` – ALL numbers: terrain, goods, buildings, economy (start goods, market, sandbox goods), population, cityLevels, units, military, mapgen, startPosition, game (civs, map sizes, default settings), victory (wonder, points), **ai** (all AI weights/targets per personality, peace time, wonder start turn).
- `src/ai/` – AI players: `play.ts` (`playAiTurns` after the human's End turn), `turn.ts` (`takeAiTurn`: pick the highest-utility candidate, apply, repeat), `context.ts` (what the AI knows this decision), `view.ts` (fog-fair view of enemies), generators: `economy.ts`, `training.ts`, `units.ts` (scouts, defenders, army), `settle.ts`, `wonder.ts`. Tests run headless multi-AI simulations.
- `src/save/` – `saveGame`/`loadGame`/`listSaves` with an envelope (`SAVE_VERSION`, migrations). **Bump `SAVE_VERSION` and add a migration whenever `GameState` changes shape.**
- `tools/art/` – Python 3 (stdlib) generators for all building/unit SVGs (`build_all.py`, `preview.py`, `iso.py` library, `units_lib.py`, `lib_*.py`); output in `public/assets/{buildings,units}/<id>.svg` + `<id>.accent.svg` (owner-color layer drawn UNDER the art). Goods icons in `public/assets/goods/` are hand-written flat SVGs. Every asset is listed in `ASSETS.md`.
- `src/render/` – PixiJS: painted terrain once (`terrainLayer.ts`), art loading (`art.ts`, `artLayout.ts`: rasterize SVGs once, anchors, row sorting, tinted accent layer), dynamic layers (territory, roads, buildings, badges, units, fog, highlights, preview, attack targets, selection), camera (pan/pinch/wheel, `centerOn`, `centerOnScreenPoint`).
- `src/ui/` – HTML/CSS components (resource bar with menu button, bottom bar, build menu, tile/city/building/unit panels, confirm sheet, toast, mode banner, economy sheet, start menu + seed preview, game menu, scores sheet, end screen, event texts) + **`interaction.ts` = controller** (modes idle / placing / roadStart / roadEnd / unit; refresh after every action; after End turn: AI turns → autosave → summary toast; end screen when `state.result`). `main.ts` boots: quick-start params → boot intent (in-game Load) → start menu. `preview.ts` + `/ui-preview.html` = dev-only component gallery.
- `src/i18n/en.ts` + `format.ts` – every visible text.

## 4. Decisions already taken (details in GAME_DESIGN)

Start 20 wood + 10 stone, city placed automatically; housing/workers full crews only; demolish without refund; start 4 residents, city center +1 bread; oil/wine supplied 3 turns in a row before advancing; marketplace 2 goods → 1 drachma / 1 good for 3; pause per building; woodcutter on/next to forest, quarry on/next to hills or mountains, mine on mountains; border towers (radius 2); houses hold 6; tap a tile → "Build here"; units: always 1 tile, one unit per tile, walled city centers ×1.5, settlers found cities with 2 residents, units only move onto explored tiles. Move orders: drag or tap + confirm, walk on each turn, stop on arrival / blocked / new enemy in sight / attacked. M5: AI turns instant + summary, peace until turn 15, wonder paid at placement + 5 working turns (never demolished; AI places it from turn 70), out of the game without a city, start menu (name, color, rivals 1–3, map size, seed, victory types), autosave + 3 slots, scores of all civs visible.

## 5. Known limitations / backlog

- AI balance is untested by the user: AIs may grow faster than a beginner (Polis/Metropolis by turn ~50 in simulations); tune in `src/data/ai.ts` (M7 balance pass at the latest). AIs plateau around 40 residents when no wish is left, cannot demolish, and stall on very cramped starts; Sparta's economy sometimes stalls (planks/food), so it then attacks little.
- Any land unit except settlers captures cities – also AI scouts (legal per rules; ask the user if this should change).
- AI turns have no animation (M7). "Main menu" and in-game "Load" reload the page. Test mode (`&sandbox`) does not autosave.
- Harbor, ships, sea routes (M6); graphics/sound/PWA (M7). `npm test` takes ~15–20 s because of the AI simulations.

## 5a. Done: multi-turn move orders (user request after M4, `v0.4.1`)

User's words: "would be nice if I could move units further than they can walk and they move the shortest way according to their movement in the next turns."
Suggested rules – **confirm them with the user first** (AskUserQuestion, recommendation first), then record them in GAME_DESIGN §7:
- Drag or tap a selected unit onto **any explored tile** reachable by a land path, even far away → path preview with turn markers ("arrives in 3 turns"); this turn the unit already walks as far as it can.
- At the start of each of the player's turns (after heal/reset, before production) the unit automatically continues along the shortest path (same movement rules: explored tiles only, terrain costs, roads, 1-tile rule, one unit per tile) – re-plan the path each turn.
- The order is cleared when the unit arrives, the path is blocked, an enemy unit comes into the unit's view, the unit is attacked, or the player gives it a new order / taps "Stop" in the unit panel.
- Units with an active order are skipped by the "Units" button; the map shows their remaining path faintly; the turn summary says e.g. "Scout arrived" / "Scout stopped: enemy in sight".
Implementation sketch: `Unit.destination: Hex | null` (JSON-plain) + a core action `{ type: 'setDestination'; unitId; to }`; auto-move in `turn.ts` via the existing pathfinding over explored tiles; UI in `interaction.ts` (drop/tap outside this turn's reach but on explored land → order), render path line in `unitLayers.ts`. Tests: auto-move over several turns, stop conditions, fog respected, determinism.

## 6. Next: M6 – Seafaring (from CLAUDE.md)

Harbor, transport ship, trireme, sea routes as a connection between storehouses, embarking units, settling islands. Start with questions for the gameplay gaps (e.g. how embarking works – a unit walks onto a transport next to land?, how many units fit, how a sea route is set up and whether it needs a harbor at both ends, whether the AI uses ships in M6 or later). Remember the save migration when `GameState` changes.

## 7. Start prompt for the new session

```
Read docs/HANDOVER.md, CLAUDE.md, docs/PROGRESS.md and docs/GAME_DESIGN.md.
Then continue where we left off: the plan for M6 – Seafaring, with the open gameplay questions first (HANDOVER §6).
```
