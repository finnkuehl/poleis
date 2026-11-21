# Arbeitsstand

## Aktueller Meilenstein: M1 – Karte (umgesetzt, Pull Request offen – wartet auf Test und Merge)

- [x] Hex-Mathematik (axial, pointy-top) + Seed-Zufallsgenerator, mit Tests
- [x] Kamera: ziehen, Pinch-Zoom, Mausrad, Zoom-Grenzen, Tipp-Schwelle 8 px
- [x] Terrain-Daten (`src/data/terrain.ts`) und Kartengenerator (`src/core/mapgen/`), mit Determinismus-Tests
- [x] Karte zeichnen (Farben + einfache Symbole), Feld antippen und markieren, Infopanel
- [x] Seed per URL (`?seed=123`), Seed-Anzeige
- [x] Browser-Test Desktop + Handy-Format (Pinch nur auf echtem Handy testbar)
- [ ] code-review, Merge

**Design-Entscheidungen M1** (auch in `docs/GAME_DESIGN.md` §3):
- Festland ca. 45 % der Karte, zusammenhängend
- Berge in kurzen Ketten; jede Landmasse bleibt zu Fuß verbunden
- Inseln mit mehr Hügeln und Wald als das Festland

## Erledigt

- **M0 – Projekt-Setup** (`v0.0.0`): Vite, TypeScript, PixiJS, Vitest, ESLint/Prettier, CI, Pages-Deploy.

## Bekannte Einschränkungen

- Noch kein Gameplay: keine Städte, Gebäude oder Einheiten.
- Startansicht zeigt die ganze Karte – auf dem Handy sind die Felder dann klein (reinzoomen). Ab M2 startet die Kamera bei der eigenen Stadt.

## Notizen

- Online: https://finnkuehl.github.io/poleis/ (wird bei jedem Merge auf `main` aktualisiert)
- Pro Meilenstein ein Branch (z. B. `m1-karte`), am Ende ein Pull Request; vor dem Merge läuft `code-review`.
- Opus plant und prüft, Sonnet (`umsetzer`) schreibt den Code.
- Projektordner: `~/Projects/poleis`. **Nicht** in iCloud-synchronisierte Ordner (Dokumente, Schreibtisch) legen – iCloud erzeugt Doppel-Dateien und kann das Git-Repository beschädigen.
