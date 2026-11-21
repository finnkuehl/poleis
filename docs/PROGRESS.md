# Progress

## Current milestone: M3 – Population & city levels (implemented, pull request open)

- [x] Plan approved; decisions recorded in `docs/GAME_DESIGN.md` §6 "Detailed rules (decided in M3)"
- [x] Cities with residents: eating, growth, hunger, taxes, oil/wine supply count, pause button
- [x] Advance action (Settlement → Polis → Metropolis), Polis buildings, marketplace trading
- [x] Map: city level on the city plate, paused marker
- [x] Controls: residents and drachmas in the resource bar, city panel with Advance, marketplace panel, pause button, end-of-turn summary
- [x] Everything wired together; test mode `?sandbox` (large start stock)
- [x] Browser test (settlement → polis in test mode, trading, pause)
- [ ] code-review, merge; phone test on GitHub Pages after the merge

**Design decisions M3:** start with 4 residents, oil/wine supplied beforehand (3 turns in a row), fixed marketplace prices (2 goods → 1 drachma, 1 good ← 3 drachmas), pause button per building, fish eaten before bread, no level loss.

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.
- **M2 – Economy** (`v0.2.0`): project in English; starting city, 12 settlement buildings, terrain placement, roads (A*), connection check, workers, production, demolish, controls.

## Known limitations

- No saving yet (M5) – reloading the page starts a new game.
- No units yet (M4).
- With 4 civilizations, `findStartPositions` can place starts close together on a few seeds (e.g. seed 49). Fix when AI civilizations arrive (M5): relax plains/forest minimums before accepting a short distance.
- A dev-only UI preview lives at `/ui-preview.html` (not part of the production build).

## Notes

- Online: https://finnkuehl.github.io/poleis/ (updated on every merge into `main`)
- One branch per milestone (e.g. `m1-map`), a pull request at the end; `code-review` runs before the merge.
- Opus plans and reviews, Sonnet (`implementer`) writes the code.
- Project folder: `~/Projects/poleis`. **Do not** put it in iCloud-synced folders (Documents, Desktop) – iCloud creates duplicate files and can corrupt the Git repository.
- Phone testing: the phone cannot reach the Mac over Wi-Fi (Mac firewall blocks node; the 192.168.179.x network looks like a FritzBox guest Wi-Fi). Test on GitHub Pages after the merge instead.
