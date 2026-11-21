# Progress

## Current milestone: M2 – Economy (in progress, branch `m2-economy`)

- [x] Plan approved; project switched to English (chat, game texts, comments, docs, commits)
- [ ] Goods and building data, rules: placement, territory, connection, workers, production
- [ ] A* pathfinding and automatic start position
- [ ] Game state with city, actions (build, road, demolish), end of turn
- [ ] Rendering: territory border, roads, buildings with status, highlights, road preview
- [ ] UI: resource bar, bottom bar, build menu, confirmation, building panel, error messages
- [ ] Interaction modes wired up; camera starts at the city
- [ ] Browser test desktop + phone, code-review, pull request

**Design decisions M2** (in `docs/GAME_DESIGN.md` §5 "Detailed rules"): start with 20 wood + 10 stone, automatic start position, housing filled immediately until M3, demolish without refund.

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.

## Known limitations

- No gameplay yet: no cities, buildings or units.
- The start view shows the whole map – on a phone the tiles are small (zoom in). From M2 on, the camera starts at the player's own city.

## Notes

- Online: https://finnkuehl.github.io/poleis/ (updated on every merge into `main`)
- One branch per milestone (e.g. `m1-map`), a pull request at the end; `code-review` runs before the merge.
- Opus plans and reviews, Sonnet (`implementer`) writes the code.
- Project folder: `~/Projects/poleis`. **Do not** put it in iCloud-synced folders (Documents, Desktop) – iCloud creates duplicate files and can corrupt the Git repository.
