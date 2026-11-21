# Progress

## Current milestone: M4 – Territory & military (in progress, branch `m4-military`)

- [x] Plan approved; decisions in `docs/GAME_DESIGN.md` §7 "Detailed rules (decided in M4)"
- [ ] Units: barracks, training, appearing next turn, movement (costs, roads, 1-tile rule), upkeep, healing
- [ ] Combat (formula, range, counterattack, walled city centers), capturing, settlers found cities, passive enemy in test mode
- [ ] Fog of war (explored / visible per civilization)
- [ ] Map: units with health bars, reachable tiles, attack targets, fog
- [ ] Controls: Units button, barracks panel, unit panel, attack preview, found city, combat messages
- [ ] Everything wired together
- [ ] Browser test, code-review, pull request; phone test on GitHub Pages after the merge

**Design decisions M4:** always 1 tile of movement, one unit per tile, passive enemy in test mode, city centers count as walled.

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.
- **M2 – Economy** (`v0.2.0`): project in English; starting city, 12 settlement buildings, terrain placement, roads (A*), connection check, workers, production, demolish, controls.
- **M3 – Population & city levels** (`v0.3.0`): residents eat, grow, starve and pay taxes; city center +1 bread; oil/wine supply streak; advance to Polis/Metropolis; vineyard, winery, marketplace (trading), temple; pause button; city panel; turn summary; test mode `?sandbox`.
- **Balance pass** (`v0.3.1`): resource buildings on their resource (woodcutter on forest, mine on mountains), border towers, houses hold 6, tap a tile → "Build here".

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
