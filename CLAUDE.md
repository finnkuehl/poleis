# Poleis – Projektanweisungen für Claude Code

Poleis ist ein rundenbasiertes Aufbau-Strategiespiel in der Antike auf einer Hex-Karte, gespielt im Browser (Handy zuerst, Desktop muss auch gehen). Singleplayer gegen 1–3 KI-Völker. Inspiration: Siedler (Warenketten, Straßen), Polytopia (Runden, Hex-Taktik), Grepolis (Antike, Inseln), Age of Empires (Aufstieg in Stufen).

**Das vollständige Spielkonzept steht in `docs/GAME_DESIGN.md`. Lies es vor jeder Gameplay-Arbeit.**
**Der aktuelle Arbeitsstand steht in `docs/PROGRESS.md`. Lies es zu Beginn jeder Sitzung und halte es aktuell.**

---

## Über den Nutzer – so kommunizierst du

- Der Nutzer ist **Programmier-Anfänger**. Er gibt die Richtung vor, testet und entscheidet über das Spieldesign; du schreibst den Code.
- Kommuniziere **auf Deutsch**, kurz und verständlich. Erkläre Fachbegriffe beim ersten Auftreten in einem Halbsatz.
- Wenn du Terminal-Befehle ausführst, die der Nutzer später selbst brauchen könnte, sag in einem Satz, wofür sie sind.
- **Technische Entscheidungen** (Bibliotheken, Dateistruktur, Algorithmen) triffst du selbst und begründest sie kurz.
- **Gameplay-Entscheidungen**, die nicht in `docs/GAME_DESIGN.md` stehen, fragst du nach, statt zu raten. Biete 2–3 konkrete Optionen mit Empfehlung an.
- Beende jede abgeschlossene Aufgabe mit einer **Testanleitung in 3–5 Schritten** (was starten, was antippen, was sollte passieren).

## Arbeitsweise

1. **Zu Beginn jedes Meilensteins:** Lege einen Plan vor (Schritte, betroffene Dateien, offene Design-Fragen) und warte auf das OK des Nutzers.
2. Arbeite in kleinen, lauffähigen Schritten. Nach jedem Schritt muss das Spiel noch starten.
3. Vor jedem Commit müssen `npm run typecheck`, `npm run lint` und `npm test` fehlerfrei durchlaufen.
4. Am Ende eines Meilensteins: `docs/PROGRESS.md` aktualisieren, Pull Request öffnen (siehe Git-Abschnitt), Testanleitung geben.
5. Ändert sich das Spieldesign, aktualisiere `docs/GAME_DESIGN.md` im selben Commit.

## Modelle: Opus plant, Sonnet setzt um

Ziel: gute Planung, günstige Umsetzung.

- **Die Hauptsitzung läuft auf Opus.** Sie liest die Dokumente, plant Meilensteine, trifft technische Entscheidungen, stellt dem Nutzer die Gameplay-Fragen, prüft Ergebnisse und macht Commits, Pushes und Pull Requests.
- **Code schreibt der Subagent `umsetzer`** (`.claude/agents/umsetzer.md`, läuft auf Sonnet). Nach dem OK des Nutzers zerlegt Opus den Plan in kleine Schritte und gibt jeden Schritt per Agent-Tool an `umsetzer`.
- **Jeder Auftrag an `umsetzer` enthält:** Ziel des Schritts, betroffene Dateien, die relevanten Regeln/Zahlen aus `docs/GAME_DESIGN.md` (Abschnitt nennen), Abnahmekriterien (welche Tests, was soll im Browser passieren).
- Schritte, die verschiedene Dateien betreffen und unabhängig sind, dürfen parallel laufen. Schritte, die dieselben Dateien anfassen, nacheinander.
- **Nach jedem Schritt prüft Opus:** `git diff` ansehen, `npm run typecheck`, `npm run lint`, `npm test` selbst laufen lassen. Mängel gehen als Nachbesserung an denselben `umsetzer` zurück, statt sie selbst neu zu schreiben. Nur Kleinkram (eine Zeile, Tippfehler) erledigt Opus direkt.
- Meldet `umsetzer` eine offene Gameplay-Frage, stellt Opus sie dem Nutzer (2–3 Optionen mit Empfehlung).
- Ist der Subagent `umsetzer` nicht verfügbar, nimm das Agent-Tool mit `model: sonnet` und gib die Regeln aus `umsetzer.md` im Auftrag mit.

## Plugins

- **code-review:** Vor jedem Merge eines Meilenstein-PRs auf den PR laufen lassen. Gefundene Fehler gehen als Nachbesserung an `umsetzer`; erst wenn alles behoben (oder mit dem Nutzer als „ok so“ abgestimmt) ist, wird gemergt.
- **frontend-design:** Für Arbeit an `src/ui/` und am Aussehen (Menüs, Leisten, Panels, Grafikstil) laden – spätestens in M7. Die Vorgaben aus „Mobile first“ gelten weiter.

---

## Tech-Stack

- **Sprache:** TypeScript im `strict`-Modus
- **Build/Dev-Server:** Vite
- **Rendering:** PixiJS (aktuelle stabile Hauptversion)
- **UI (Menüs, Leisten, Dialoge):** reines HTML/CSS über dem Canvas, kein UI-Framework
- **Tests:** Vitest
- **Codequalität:** ESLint + Prettier
- **Laufzeit:** aktuelle Node.js-LTS-Version
- Keine weiteren Abhängigkeiten ohne kurze Begründung gegenüber dem Nutzer.

## Architektur

```
src/
  core/        Reine Spiellogik. KEIN DOM, KEIN PixiJS, keine Zufallsquellen außer dem Seed-RNG.
    hex/       Axiale Hex-Koordinaten (q, r): Nachbarn, Distanz, Ringe, Linien, A*-Wegfindung
    mapgen/    Kartengenerierung aus einem Seed
    rules/     Produktion, Straßen-Verbindung, Bevölkerung, Kampf, Territorium, Sieg
    state.ts   GameState-Typen
    actions.ts Alle Spieleraktionen + applyAction(state, action) → neuer State oder Fehler
    turn.ts    endTurn(state): Produktion, Verbrauch, Wachstum, nächster Spieler
  data/        ALLE Balancing-Werte: Terrain, Waren, Gebäude, Einheiten, Stadtstufen, Punkte
  ai/          KI-Spieler; benutzt ausschließlich dieselben Actions wie der Mensch
  render/      PixiJS: zeichnet den State, Kamera (verschieben/zoomen), Tippen → Hex-Feld
  ui/          HTML/CSS-Panels: Ressourcenleiste, Baumenü, Feldinfo, Rundenknopf, Menüs
  save/        Speichern/Laden (localStorage bzw. IndexedDB), Save-Versionsnummer + Migration
  i18n/de.ts   Alle sichtbaren Texte an einer Stelle
  main.ts      Einstiegspunkt
docs/
  GAME_DESIGN.md
  PROGRESS.md
```

**Feste Regeln:**
- `core/` importiert niemals aus `render/`, `ui/` oder `save/`.
- Der `GameState` ist ein reines, JSON-serialisierbares Objekt (keine Klassen-Instanzen, keine Maps/Sets im State). So funktionieren Speichern, Tests und später Multiplayer.
- Die Spiellogik ist **deterministisch**: gleicher Seed + gleiche Aktionen = gleiches Ergebnis. Der RNG-Zustand liegt im State.
- Jede Aktion wird in `core/` geprüft (genug Waren? eigenes Gebiet? passendes Terrain?). Ungültige Aktionen liefern eine verständliche Fehlermeldung (deutsch, über i18n).
- **Zahlen nur in `data/`.** Der Nutzer soll Balancing dort selbst anpassen können; kommentiere die Dateien so, dass er sie versteht.
- Bezeichner im Code auf Englisch, **Kommentare auf Deutsch**, sichtbare Spieltexte auf Deutsch über `i18n/de.ts`.
- Hex-Mathematik nach https://www.redblobgames.com/grids/hexagons/ (axiale Koordinaten, „pointy-top“).
- Logik in `core/` und `ai/` bekommt Unit-Tests (Hex-Mathe, Mapgen-Determinismus, Produktion, Straßenverbindung, Kampf).

## Mobile first

- **Touch:** ein Finger ziehen = Karte verschieben, zwei Finger = zoomen, Tippen = auswählen. Ziehen darf nicht als Tippen zählen (Schwelle ~8 px).
- **Maus/Desktop:** ziehen = verschieben, Mausrad = zoomen, Klick = auswählen.
- Hochformat zuerst, Querformat muss ebenfalls nutzbar sein. Touch-Ziele mindestens 44 × 44 px. Keine Infos, die nur per Hover sichtbar sind.
- Ziel: flüssige 60 fps auf einem Mittelklasse-Handy bei Karten bis 40 × 40 Felder.
- Browser-Zoom und Scroll-Bounce auf der Spielseite unterbinden (viewport-Meta, `touch-action: none` auf dem Canvas).
- **Grafik:** zunächst prozedural (Hex-Farben, einfache Formen/Symbole). Später Grafiken in `public/assets/`, nur mit freier Lizenz (z. B. CC0); Herkunft und Lizenz in `ASSETS.md` festhalten.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm install` | Abhängigkeiten installieren (nach dem Klonen) |
| `npm run dev` | Dev-Server starten (http://localhost:5173) |
| `npm run dev -- --host` | Dev-Server auch im WLAN erreichbar machen (Handy-Test) |
| `npm run build` | Produktionsversion nach `dist/` bauen |
| `npm test` | Tests ausführen |
| `npm run lint` | Codequalität prüfen |
| `npm run typecheck` | TypeScript-Typen prüfen |

## Git & GitHub

- Repository `poleis` auf GitHub, Hauptbranch `main`. Die GitHub CLI (`gh`) ist installiert und angemeldet.
- **Pro Meilenstein ein Branch**, z. B. `m1-karte`, `m2-wirtschaft`.
- Kleine, thematische Commits mit klarer deutscher Nachricht im Imperativ (z. B. „Füge Straßenbau hinzu“).
- Am Ende eines Meilensteins: Pull Request mit `gh pr create`. Beschreibung: was ist neu, Testanleitung, bekannte Einschränkungen. Der Nutzer testet und merged selbst (oder bittet dich darum). Nach dem Merge: Tag `v0.<Meilenstein>.0`.
- **GitHub Actions:**
  - CI bei jedem Push/PR: typecheck, lint, test, build.
  - Deploy nach GitHub Pages bei Push auf `main` (Vite-`base` auf `/poleis/` setzen). Nur möglich, wenn das Repo öffentlich ist oder der Nutzer GitHub Pro hat – sonst diesen Schritt weglassen und Handy-Test per `npm run dev -- --host` erklären.
- Niemals Zugangsdaten oder Tokens committen. `.gitignore` enthält mindestens `node_modules/`, `dist/`, `.env*`.

---

## Meilensteine

Jeder Meilenstein endet mit einem spielbaren Stand. Details zu Regeln und Zahlen: `docs/GAME_DESIGN.md`.

### M0 – Projekt-Setup
Vite + TypeScript + PixiJS + Vitest + ESLint/Prettier aufsetzen. Vollbild-Canvas mit Hintergrundfarbe und Text „Poleis“. Ordnerstruktur wie oben (leere Module mit kurzer Beschreibung). `README.md` auf Deutsch (was ist das, wie starten). `docs/PROGRESS.md` anlegen. GitHub-Repo erstellen, CI und (falls möglich) Pages-Deploy einrichten, pushen.

### M1 – Karte
Seed-basierte Kartengenerierung (Standard 30 × 30): Ozean, Küstenwasser, Ebene, Wald, Hügel, Berg. Ein großes Festland für die Startgebiete plus 3–6 Inseln. Kamera mit Touch- und Maussteuerung, Zoom-Grenzen. Tippen markiert ein Feld und zeigt Terrain-Info. Seed per URL wählbar (`?seed=123`). Tests für Hex-Mathe und Mapgen-Determinismus.

### M2 – Wirtschaft
Stadtzentrum beim Start, Territorium, Baumenü, Gebäude der Warenketten aus dem Design-Dokument, Platzierungsregeln nach Terrain, Straßenbau, Verbindungsprüfung (Gebäude ↔ Lager/Stadtzentrum per Straße, Breitensuche), Rundenende mit Produktion und Verarbeitung, Ressourcenleiste, Gebäude-Infopanel mit Status („nicht verbunden“, „fehlende Arbeiter“, „fehlender Rohstoff“).

### M3 – Bevölkerung & Stadtstufen
Wohnhäuser, Einwohner als Arbeiter (automatische Zuteilung, Priorität einstellbar ist optional), Nahrungsverbrauch, Wachstum/Schrumpfen, Bedarfe Öl/Wein, Steuern in Drachmen, Aufstieg Siedlung → Polis → Metropole mit Freischaltungen.

### M4 – Territorium & Militär
Grenztürme, Nebel des Krieges, Kaserne, Landeinheiten, Bewegung mit Wegfindung und Bewegungskosten, Straßenbonus, Kampf nach der Formel im Design-Dokument, Einheiten-Unterhalt, Städte einnehmen, Siedler gründen neue Städte.

### M5 – Erste komplette Partie
KI-Völker (1–3, Persönlichkeiten aus dem Design-Dokument), Siegbedingungen und Punkteanzeige, Startmenü (Kartengröße, Anzahl KI, Seed), Speichern/Laden, Autosave jede Runde, Sieg-/Niederlage-Bildschirm.

### M6 – Seefahrt
Hafen, Transportschiff, Triere, Seewege als Verbindung zwischen Lagern, Einheiten einschiffen, Inseln besiedeln.

### M7 – Feinschliff
Balancing-Durchgang, echte Grafiken, Sound, Animationen, Tutorial-Hinweise, PWA (installierbar, offline spielbar).

### Später (noch nicht umsetzen)
Götter-System (Tempel erzeugt Gunst), Handel/Diplomatie mit KI-Völkern, Multiplayer, App-Store-Version (z. B. Capacitor).
