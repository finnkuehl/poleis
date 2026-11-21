# Progress

## Current milestone: Balance pass after M3 (implemented, pull request open, tag `v0.3.1` after merge)

Why: in playtesting, a radius-2 city (≈11 free building tiles) could not fit the ≈14 buildings needed for Polis.

- [x] Plan approved; rules updated in `docs/GAME_DESIGN.md` (§3 terrain, §5 table and "Resource placement", §11 controls)
- [x] Placement: woodcutter on/next to forest, quarry on/next to hills or mountains, mine on mountains only
- [x] Border tower (moved forward from M4): claims radius 2 around it; shows "+N tiles" before building
- [x] Houses hold 6 residents (was 4)
- [x] Tap an empty tile → "Build here" list, one tap builds; "Road from here"
- [x] Browser test (build list, one-tap house, forest, outside territory, border tower +9 tiles)
- [ ] code-review, merge; phone test on GitHub Pages after the merge

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.
- **M2 – Economy** (`v0.2.0`): project in English; starting city, 12 settlement buildings, terrain placement, roads (A*), connection check, workers, production, demolish, controls.
- **M3 – Population & city levels** (`v0.3.0`): residents eat, grow, starve and pay taxes; city center +1 bread; oil/wine supply streak; advance to Polis/Metropolis; vineyard, winery, marketplace (trading), temple; pause button; city panel; turn summary; test mode `?sandbox`.

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
