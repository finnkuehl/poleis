# Progress

## Current milestone: M2 – Economy (implemented, pull request open – waiting for test and merge)

- [x] Plan approved; project switched to English (chat, game texts, comments, docs, commits)
- [x] Goods and building data, rules: placement, territory, connection, workers, production
- [x] A* pathfinding and automatic start position
- [x] Game state with city, actions (build, road, demolish), end of turn
- [x] Rendering: territory border, roads, buildings with status, highlights, road preview
- [x] UI: resource bar, bottom bar, build menu, confirmation, building panel, error messages
- [x] Interaction modes wired up; camera starts at the city
- [x] Browser test desktop + phone format, code-review (no issues), pull request
- [ ] Merge

**Design decisions M2** (in `docs/GAME_DESIGN.md` §5 "Detailed rules"): start with 20 wood + 10 stone, automatic start position, housing filled immediately until M3, demolish without refund, workers only fill complete crews.

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.

## Known limitations

- No food consumption, growth, taxes or city levels yet (M3) – food piles up.
- No saving yet (M5) – reloading the page starts a new game.
- No units yet (M4).
- With 4 civilizations, `findStartPositions` can place starts close together on a few seeds (e.g. seed 49). Fix when AI civilizations arrive (M5): relax plains/forest minimums before accepting a short distance.
- A dev-only UI preview lives at `/ui-preview.html` (not part of the production build).

## Notes

- Online: https://finnkuehl.github.io/poleis/ (updated on every merge into `main`)
- One branch per milestone (e.g. `m1-map`), a pull request at the end; `code-review` runs before the merge.
- Opus plans and reviews, Sonnet (`implementer`) writes the code.
- Project folder: `~/Projects/poleis`. **Do not** put it in iCloud-synced folders (Documents, Desktop) – iCloud creates duplicate files and can corrupt the Git repository.
