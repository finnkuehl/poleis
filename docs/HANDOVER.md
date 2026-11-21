# Handover – read this first in a new session

This file lets a fresh Claude session continue Poleis without the old chat history.
Read it together with `CLAUDE.md` (rules), `docs/GAME_DESIGN.md` (game design incl. all "Detailed rules (decided in …)" sections) and `docs/PROGRESS.md` (checklist).

## 1. Where we are

- **Repo:** https://github.com/finnkuehl/poleis (public), local folder `~/Projects/poleis` (NOT in iCloud – iCloud corrupted files once).
- **Live game:** https://finnkuehl.github.io/poleis/ – updated ~2 min after every merge into `main` (Pages may show the old version for up to ~10 min).
- **Test mode:** add `&sandbox` → big start stock + a passive red enemy city ~6–9 tiles away (for seed 1: 7 tiles **south** of the player's city). Example: `https://finnkuehl.github.io/poleis/?seed=1&sandbox`.
- **Done and tagged:** M0 `v0.0.0`, M1 `v0.1.0`, M2 `v0.2.0`, M3 `v0.3.0`, balance pass `v0.3.1`.
- **Current:** M4 – Territory & military on branch `m4-military`, **PR #6** (https://github.com/finnkuehl/poleis/pull/6). Implemented, code-reviewed (5 findings fixed), plus three overview features the user asked for (workers working/free, economy overview, drag & drop units). Waiting for the user's phone test → merge → tag `v0.4.0`.
- **Next milestone:** M5 – First complete game (see §6).

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
  - `state.ts` – `GameState` (map, rng, turn, players [goods, explored], buildings [paused], roads[], territory[], cities [level, residents, supplyStreak], tileCity[], units [hp, movesLeft, hasMoved, acted, attacked, capturing], training[], nextId, lastReport); `createGameState(seed, { sandbox })` (+ passive enemy).
  - `actions.ts` – `applyAction` (structuredClone, never mutates): build, buildRoad, demolish, togglePause, advanceCity, trade, train, move, attack, foundCity, endTurn; updates fog (`updateAllExplored`) after every action.
  - `turn.ts` – start of the player's turn: capture → heal/reset units → spawn trained units → production → population (eat, needs, supply, growth, taxes) → unit upkeep; `lastReport` with deltas, cities, units, captured.
  - `rules/` – placement, territory (+`territoryGain`), connection (BFS), workers (full crews, per city, paused), production (status kinds), population, advance, trade, roads (A*), movement (explored-only, 1-tile rule, `ignoreHiddenUnits`), units (training/spawn/upkeep/heal), combat (formula + preview), capture, found, vision (fog), economy (overview/estimate), errors.
  - `hex/` (axial pointy-top, A*, `reachable`), `mapgen/` (map + start positions).
- `src/data/` – ALL numbers: terrain, goods, buildings, economy (start goods, market, sandbox goods), population, cityLevels, units, military, mapgen, startPosition.
- `src/render/` – PixiJS: terrain once, dynamic layers (territory, roads, buildings, badges, units, fog, highlights, preview, attack targets, selection), camera (pan/pinch/wheel, `centerOn`, `centerOnScreenPoint`).
- `src/ui/` – HTML/CSS components (resource bar, bottom bar, build menu, tile/city/building/unit panels, confirm sheet, toast, mode banner, economy sheet) + **`interaction.ts` = controller** (modes idle / placing / roadStart / roadEnd / unit; refresh after every action). `preview.ts` + `/ui-preview.html` = dev-only component gallery.
- `src/i18n/en.ts` + `format.ts` – every visible text.

## 4. Decisions already taken (details in GAME_DESIGN)

Start 20 wood + 10 stone, city placed automatically; housing/workers full crews only; demolish without refund; start 4 residents, city center +1 bread; oil/wine supplied 3 turns in a row before advancing; marketplace 2 goods → 1 drachma / 1 good for 3; pause per building; woodcutter on/next to forest, quarry on/next to hills or mountains, mine on mountains; border towers (radius 2); houses hold 6; tap a tile → "Build here"; units: always 1 tile, one unit per tile, walled city centers ×1.5, settlers found cities with 2 residents, units only move onto explored tiles.

## 5. Known limitations / backlog

- No saving, no victory/defeat, enemy is passive (all M5).
- `findStartPositions` can place 4 civilizations too close on a few seeds (e.g. seed 49) – fix in M5 (relax plains/forest minimums before accepting a short distance).
- Capturing and founding were verified by automated tests only, not yet in a real browser play-through.
- Harbor, ships, sea routes (M6); world wonder + temple points (M5); graphics/sound/PWA (M7).

## 6. Next: M5 – First complete game (from CLAUDE.md)

AI civilizations (1–3; personalities from GAME_DESIGN §9: Athens trader, Sparta warrior, Corinth builder; utility-based, only regular actions, only what their fog allows – use `isVisible`/`economyOverview`), victory conditions + score display (GAME_DESIGN §10), start menu (map size, number of AIs, seed), save/load (`src/save/`, versioned) + autosave every turn, victory/defeat screen. Start with questions for the gameplay gaps (e.g. AI turn order/animation, difficulty, what happens to the passive sandbox enemy, how the world wonder is built over 5 turns).

## 7. Start prompt for the new session

```
Read docs/HANDOVER.md, CLAUDE.md, docs/PROGRESS.md and docs/GAME_DESIGN.md.
Then continue where we left off: if PR #6 (M4) is still open, ask me whether my phone test passed and merge + tag v0.4.0; otherwise present the plan for M5 with the open gameplay questions first.
```
