# Poleis

Poleis ist ein rundenbasiertes Aufbau-Strategiespiel in der Antike auf einer Hex-Karte. Du baust Städte, Warenketten und Straßen und trittst gegen 1–3 KI-Völker an. Es läuft im Browser, zuerst für das Handy, aber auch am Desktop.

**Online spielen:** https://finnkuehl.github.io/poleis/ (verfügbar nach dem ersten Merge auf `main`)

## Voraussetzungen

- Node.js 22 (LTS)

## Starten

```
npm install
npm run dev
```

Dann http://localhost:5173 im Browser öffnen.

## Handy-Test im WLAN

```
npm run dev -- --host
```

Die „Network“-Adresse aus dem Terminal auf dem Handy öffnen (Handy und Computer im selben WLAN).

## Befehle

| Befehl                  | Zweck                                          |
| ----------------------- | ---------------------------------------------- |
| `npm install`           | Abhängigkeiten installieren                    |
| `npm run dev`           | Dev-Server starten (http://localhost:5173)     |
| `npm run dev -- --host` | Dev-Server auch im WLAN erreichbar machen      |
| `npm run build`         | Produktionsversion nach `dist/` bauen          |
| `npm test`              | Tests ausführen                                |
| `npm run lint`          | Codequalität prüfen                            |
| `npm run typecheck`     | TypeScript-Typen prüfen                        |

## Projektstruktur

- `src/core/` – reine Spiellogik (Hex-Mathe, Kartengenerierung, Regeln, Aktionen, Runden)
- `src/data/` – alle Balancing-Zahlen
- `src/ai/` – KI-Spieler
- `src/render/` – Darstellung mit PixiJS
- `src/ui/` – HTML/CSS-Oberfläche
- `src/save/` – Speichern und Laden
- `src/i18n/` – alle sichtbaren Texte
- `docs/` – Spielkonzept und Arbeitsstand

Die Balancing-Zahlen stehen in `src/data/`.
