# Progress

## Next

1. **M5 – First complete game** (AI civilizations, victory, start menu, saving) – plan and open questions first.

**Handover for a new session:** see `docs/HANDOVER.md`.

## Done

- **M0 – Project setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages deploy.
- **M1 – Map** (`v0.1.0`): hex math, seeded map generator, camera (touch + mouse), tile selection with info panel, seed via URL.
- **M2 – Economy** (`v0.2.0`): project in English; starting city, 12 settlement buildings, terrain placement, roads (A*), connection check, workers, production, demolish, controls.
- **M3 – Population & city levels** (`v0.3.0`): residents eat, grow, starve and pay taxes; city center +1 bread; oil/wine supply streak; advance to Polis/Metropolis; vineyard, winery, marketplace (trading), temple; pause button; city panel; turn summary; test mode `?sandbox`.
- **Balance pass** (`v0.3.1`): resource buildings on their resource (woodcutter on forest, mine on mountains), border towers, houses hold 6, tap a tile → "Build here".
- **M4 – Territory & military** (`v0.4.0`): barracks and units, movement (terrain costs, roads, 1-tile rule, explored tiles only), combat with preview (walled city centers), upkeep/healing, capturing, settlers founding cities, fog of war, passive enemy in test mode; workers working/free, "📊 Overview" economy sheet, drag & drop for units. Founding/capturing verified by automated tests only.
- **Move orders** (`v0.4.1`): send a unit to a far explored tile by drag & drop (or tap + "Go here (N turns)"); it walks on by itself each turn along the cheapest path, shows a faint line with a flag (turn numbers when selected) and stops when it arrives, the way is blocked, a new enemy comes into sight or it is attacked; "Stop" in the unit panel, the "Units" button skips busy units.

## Known limitations

- No saving yet (M5) – reloading the page starts a new game.
- The test-mode enemy is passive (no AI until M5); there is no victory or defeat yet (M5).
- With 4 civilizations, `findStartPositions` can place starts close together on a few seeds (e.g. seed 49). Fix when AI civilizations arrive (M5): relax plains/forest minimums before accepting a short distance.
- A dev-only UI preview lives at `/ui-preview.html` (not part of the production build).

## Notes

- Online: https://finnkuehl.github.io/poleis/ (updated on every merge into `main`)
- One branch per milestone (e.g. `m1-map`), a pull request at the end; `code-review` runs before the merge.
- Opus plans and reviews, Sonnet (`implementer`) writes the code.
- Project folder: `~/Projects/poleis`. **Do not** put it in iCloud-synced folders (Documents, Desktop) – iCloud creates duplicate files and can corrupt the Git repository.
- Phone testing: the phone cannot reach the Mac over Wi-Fi (Mac firewall blocks node; the 192.168.179.x network looks like a FritzBox guest Wi-Fi). Test on GitHub Pages after the merge instead.
