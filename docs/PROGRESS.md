# Arbeitsstand

## Aktueller Meilenstein: M1 – Karte (in Arbeit, Branch `m1-karte`)

- [ ] Hex-Mathematik (axial, pointy-top) + Seed-Zufallsgenerator, mit Tests
- [ ] Kamera: ziehen, Pinch-Zoom, Mausrad, Zoom-Grenzen, Tipp-Schwelle 8 px
- [ ] Terrain-Daten (`src/data/terrain.ts`) und Kartengenerator (`src/core/mapgen/`), mit Determinismus-Tests
- [ ] Karte zeichnen (Farben + einfache Symbole), Feld antippen und markieren, Infopanel
- [ ] Seed per URL (`?seed=123`), Seed-Anzeige
- [ ] Browser-Test Desktop + Handy, code-review, Pull Request

**Design-Entscheidungen M1** (auch in `docs/GAME_DESIGN.md` §3):
- Festland ca. 45 % der Karte, zusammenhängend
- Berge in kurzen Ketten; jede Landmasse bleibt zu Fuß verbunden
- Inseln mit mehr Hügeln und Wald als das Festland

## Erledigt

- **M0 – Projekt-Setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages-Deploy.

## Bekannte Einschränkungen

- Noch kein Gameplay: keine Städte, Gebäude oder Einheiten.

## Notizen

- Online: https://finnkuehl.github.io/poleis/ (wird bei jedem Merge auf `main` aktualisiert)
- Pro Meilenstein ein Branch (z. B. `m1-karte`), am Ende ein Pull Request; vor dem Merge läuft `code-review`.
- Opus plant und prüft, Sonnet (`umsetzer`) schreibt den Code.
