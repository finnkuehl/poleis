# Poleis – Project Instructions for Claude Code

Poleis is a turn-based city-building strategy game set in antiquity on a hex map, played in the browser (mobile first, desktop must work too). Singleplayer against 1–3 AI civilizations. Inspiration: Settlers (goods chains, roads), Polytopia (turns, hex tactics), Grepolis (antiquity, islands), Age of Empires (advancing through levels).

**The full game concept is in `docs/GAME_DESIGN.md`. Read it before any gameplay work.**
**The current state of work is in `docs/PROGRESS.md`. Read it at the start of every session and keep it up to date.**

---

## About the user – how you communicate

- The user is a **programming beginner**. The user sets the direction, tests and decides on the game design; you write the code.
- Communicate **in English**, short and understandable. Explain technical terms in a half-sentence on first use.
- When you run terminal commands the user might need later, say in one sentence what they are for.
- **Technical decisions** (libraries, file structure, algorithms) you make yourself and justify briefly.
- **Gameplay decisions** that are not in `docs/GAME_DESIGN.md` you ask about instead of guessing. Offer 2–3 concrete options with a recommendation.
- End every finished task with a **test guide in 3–5 steps** (what to start, what to tap, what should happen).

## Way of working

1. **At the start of every milestone:** present a plan (steps, affected files, open design questions) and wait for the user's OK.
2. Work in small, runnable steps. After every step the game must still start.
3. Before every commit, `npm run typecheck`, `npm run lint` and `npm test` must pass without errors.
4. At the end of a milestone: update `docs/PROGRESS.md`, open a pull request (see the Git section), give a test guide.
5. If the game design changes, update `docs/GAME_DESIGN.md` in the same commit.

## Models: Opus plans, Sonnet implements

Goal: good planning, cheap implementation.

- **The main session runs on Opus.** It reads the documents, plans milestones, makes technical decisions, asks the user the gameplay questions, reviews results and does commits, pushes and pull requests.
- **Code is written by the subagent `implementer`** (`.claude/agents/implementer.md`, runs on Sonnet). After the user's OK, Opus breaks the plan into small steps and hands each step to `implementer` via the Agent tool.
- **Every brief to `implementer` contains:** goal of the step, affected files, the relevant rules/numbers from `docs/GAME_DESIGN.md` (name the section), acceptance criteria (which tests, what should happen in the browser).
- Steps that touch different files and are independent may run in parallel. Steps that touch the same files run one after another.
- **After every step Opus checks:** look at `git diff`, run `npm run typecheck`, `npm run lint`, `npm test` itself. Defects go back to the same `implementer` as rework instead of being rewritten by Opus. Only small stuff (one line, a typo) Opus does directly.
- If `implementer` reports an open gameplay question, Opus asks the user (2–3 options with a recommendation).
- If `implementer` is unavailable, use the Agent tool with `model: sonnet` and include the rules from `implementer.md` in the brief.

## Plugins

- **code-review:** Run it on the pull request before every merge of a milestone PR. Bugs found go back to `implementer` as rework; only when everything is fixed (or agreed with the user as "fine as is") is it merged.
- **frontend-design:** Load it for work on `src/ui/` and on the look (menus, bars, panels, graphics style) – by M7 at the latest. The "Mobile first" rules still apply.

---

## Tech stack

- **Language:** TypeScript in `strict` mode
- **Build/dev server:** Vite
- **Rendering:** PixiJS (current stable major version)
- **UI (menus, bars, dialogs):** plain HTML/CSS above the canvas, no UI framework
- **Tests:** Vitest
- **Code quality:** ESLint + Prettier
- **Runtime:** current Node.js LTS version
- No further dependencies without a short justification to the user.

## Architecture

```
src/
  core/        Pure game logic. NO DOM, NO PixiJS, no random sources except the seeded RNG.
    hex/       Axial hex coordinates (q, r): neighbors, distance, rings, lines, A* pathfinding
    mapgen/    Map generation from a seed
    rules/     Production, road connection, population, combat, territory, victory
    state.ts   GameState types
    actions.ts All player actions + applyAction(state, action) → new state or error
    turn.ts    endTurn(state): production, consumption, growth, next player
  data/        ALL balancing values: terrain, goods, buildings, units, city levels, points
  ai/          AI players; use exactly the same actions as the human
  render/      PixiJS: draws the state, camera (pan/zoom), tap → hex tile
  ui/          HTML/CSS panels: resource bar, build menu, tile info, end-turn button, menus
  save/        Saving/loading (localStorage or IndexedDB), save version number + migration
  i18n/en.ts   All visible texts in one place
  main.ts      Entry point
docs/
  GAME_DESIGN.md
  PROGRESS.md
```

**Fixed rules:**
- `core/` never imports from `render/`, `ui/` or `save/`.
- The `GameState` is a plain, JSON-serializable object (no class instances, no Maps/Sets in the state). This is how saving, tests and later multiplayer work.
- The game logic is **deterministic**: same seed + same actions = same result. The RNG state lives in the state.
- Every action is validated in `core/` (enough goods? own territory? suitable terrain?). Invalid actions return an understandable error message (English, via i18n).
- **Numbers only in `data/`.** The user should be able to adjust balancing there; comment the files so the user understands them.
- Identifiers in code in English, **comments in English**, visible game texts in **English via `i18n/en.ts`**.
- Hex math according to https://www.redblobgames.com/grids/hexagons/ (axial coordinates, "pointy-top").
- Logic in `core/` and `ai/` gets unit tests (hex math, mapgen determinism, production, road connection, combat).

## Mobile first

- **Touch:** one finger drag = pan the map, two fingers = zoom, tap = select. Dragging must not count as tapping (threshold ~8 px).
- **Mouse/desktop:** drag = pan, mouse wheel = zoom, click = select.
- Portrait first, landscape must also be usable. Touch targets at least 44 × 44 px. No information that is only visible on hover.
- Goal: smooth 60 fps on a mid-range phone with maps up to 40 × 40 tiles.
- Prevent browser zoom and scroll bounce on the game page (viewport meta, `touch-action: none` on the canvas).
- **Graphics:** procedural at first (hex colors, simple shapes/symbols). Later graphics in `public/assets/`, only with a free license (e.g. CC0); record origin and license in `ASSETS.md`.

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies (after cloning) |
| `npm run dev` | Start the dev server (http://localhost:5173) |
| `npm run dev -- --host` | Make the dev server reachable over Wi-Fi (phone test) |
| `npm run build` | Build the production version into `dist/` |
| `npm test` | Run tests |
| `npm run lint` | Check code quality |
| `npm run typecheck` | Check TypeScript types |

## Git & GitHub

- Repository `poleis` on GitHub, main branch `main`. The GitHub CLI (`gh`) is installed and logged in.
- **One branch per milestone**, e.g. `m1-map`, `m2-economy`.
- Small, thematic commits with a clear English message in the imperative (e.g. "Add road building").
- At the end of a milestone: pull request with `gh pr create`. Description: what is new, test guide, known limitations. The user tests and merges (or asks you to do it). After the merge: tag `v0.<milestone>.0`.
- **GitHub Actions:**
  - CI on every push/PR: typecheck, lint, test, build.
  - Deploy to GitHub Pages on push to `main` (set Vite `base` to `/poleis/`). Only possible if the repo is public or the user has GitHub Pro – otherwise skip this step and explain the phone test via `npm run dev -- --host`.
- Never commit credentials or tokens. `.gitignore` contains at least `node_modules/`, `dist/`, `.env*`.

---

## Milestones

Every milestone ends with a playable state. Details on rules and numbers: `docs/GAME_DESIGN.md`.

### M0 – Project setup
Set up Vite + TypeScript + PixiJS + Vitest + ESLint/Prettier. Fullscreen canvas with a background color and the text "Poleis". Folder structure as above (empty modules with a short description). `README.md` in English (what is it, how to start). Create `docs/PROGRESS.md`. Create the GitHub repo, set up CI and (if possible) the Pages deploy, push.

### M1 – Map
Seed-based map generation (default 30 × 30): ocean, coastal water, plains, forest, hills, mountains. One large mainland for the starting areas plus 3–6 islands. Camera with touch and mouse controls, zoom limits. Tapping highlights a tile and shows terrain info. Seed selectable via URL (`?seed=123`). Tests for hex math and mapgen determinism.

### M2 – Economy
City center at the start, territory, build menu, buildings of the goods chains from the design document, placement rules by terrain, road building, connection check (building ↔ storehouse/city center via road, breadth-first search), end of turn with production and processing, resource bar, building info panel with status ("not connected", "missing workers", "missing raw material").

### M3 – Population & city levels
Houses, residents as workers (automatic assignment, adjustable priority is optional), food consumption, growth/shrinking, needs for oil/wine, taxes in drachmas, level-up Settlement → Polis → Metropolis with unlocks.

### M4 – Territory & military
Border towers, fog of war, barracks, land units, movement with pathfinding and movement costs, road bonus, combat per the formula in the design document, unit upkeep, capturing cities, settlers found new cities.

### M5 – First complete game
AI civilizations (1–3, personalities from the design document), victory conditions and score display, start menu (map size, number of AIs, seed), saving/loading, autosave every turn, victory/defeat screen.

### M6 – Seafaring
Harbor, transport ship, trireme, sea routes as a connection between storehouses, embarking units, settling islands.

### M7 – Polish
Balancing pass, real graphics, sound, animations, tutorial hints, PWA (installable, playable offline).

### Later (do not implement yet)
Gods system (temple generates favor), trade/diplomacy with AI civilizations, multiplayer, app store version (e.g. Capacitor).
