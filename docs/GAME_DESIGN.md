# Poleis – Spielkonzept (Game Design)

> Lebendes Dokument. Alle Zahlen sind **Startwerte fürs Balancing** und gehören im Code nach `src/data/`.

## 1. Überblick

| | |
|---|---|
| Genre | Rundenbasiertes Aufbau-Strategiespiel |
| Setting | Antike Mittelmeerwelt |
| Plattform | Browser, Handy zuerst (Touch), Desktop ebenfalls |
| Modus | Singleplayer gegen 1–3 KI-Völker |
| Karte | Hex-Felder, 2D von oben, zufällig aus Seed generiert |
| Partiedauer | 45–90 Minuten, ca. 100–150 Runden, speicherbar |
| Schwerpunkt | Wirtschaft & Aufbau; Kampf ist wichtig, aber zweitrangig |

**Kernidee:** Du gründest eine Stadt, baust Warenketten auf, verbindest Gebäude mit Straßen und lässt deine Stadt von der Siedlung zur Metropole aufsteigen. Die Wirtschaft *ist* der Fortschritt – es gibt keinen separaten Technologiebaum.

## 2. Ablauf einer Runde

1. **Produktion** (am Rundenbeginn des Spielers): Jedes Gebäude, das Arbeiter hat, per Straße mit einem Lager/Stadtzentrum verbunden ist und seine Eingangswaren bekommt, produziert.
2. **Verbrauch:** Einwohner essen, Einheiten kosten Unterhalt, Bedarfe (Öl, Wein) werden abgezogen.
3. **Wachstum/Steuern:** Bevölkerung wächst oder schrumpft, Drachmen werden eingenommen.
4. **Aktionen des Spielers** (beliebig viele, solange Waren reichen): bauen, Straßen ziehen, Einheiten ausbilden/bewegen/angreifen, Stadt aufsteigen lassen.
5. **Runde beenden** → die KI-Völker ziehen nacheinander.

## 3. Terrain

| Terrain | Bewegungskosten | Verteidigungsbonus | Bebaubar | Besonderheit |
|---|---|---|---|---|
| Ozean | nur Schiffe | – | nein | – |
| Küstenwasser | nur Schiffe | – | nein | Fischer und Hafen grenzen daran |
| Ebene | 1 | ×1,0 | ja | Standard für die meisten Gebäude |
| Wald | 2 | ×1,5 | nein (Holzfäller daneben) | Holzquelle; kann gerodet werden (später) |
| Hügel | 2 | ×1,5 | ja | Steinbruch, Mine, Weinberg |
| Berg | unpassierbar | – | nein | Mine/Steinbruch daneben |

- Straße auf einem Feld: Bewegungskosten für Landeinheiten halbiert (abgerundet, mindestens 0,5).
- Gebäude und Straßen nur im **eigenen Territorium**.

## 4. Waren (12 + Währung)

| Ware | Typ | Herkunft |
|---|---|---|
| Holz | Rohstoff | Holzfäller |
| Stein | Rohstoff | Steinbruch |
| Getreide | Rohstoff | Bauernhof |
| Fisch | Rohstoff | Fischer |
| Oliven | Rohstoff | Olivenhain |
| Trauben | Rohstoff | Weinberg |
| Erz | Rohstoff | Mine |
| Bretter | verarbeitet | Sägewerk (Holz) |
| Brot | verarbeitet | Bäckerei (Getreide) |
| Öl | verarbeitet | Ölpresse (Oliven) |
| Wein | verarbeitet | Kelterei (Trauben) |
| Bronze | verarbeitet | Schmelze (Erz + Holz) |
| **Drachmen** | Währung | Steuern, später Marktplatz |

**Nahrung** = Brot oder Fisch (beides zählt gleich).

### Warenketten
```
Holzfäller ──Holz──► Sägewerk ──Bretter──► Bau, Schiffe
Steinbruch ──Stein──► Bau, Mauern, Wunder
Bauernhof ──Getreide──► Bäckerei ──Brot──► Einwohner, Unterhalt
Fischer ──Fisch──► Einwohner, Unterhalt
Olivenhain ──Oliven──► Ölpresse ──Öl──► Bedarf ab Polis
Weinberg ──Trauben──► Kelterei ──Wein──► Bedarf ab Metropole
Mine ──Erz──┐
Holzfäller ─Holz─┴► Schmelze ──Bronze──► Einheiten, Wunder
```

## 5. Gebäude

| Gebäude | Platzierung | Kosten | Arbeiter | Pro Runde | Ab Stufe |
|---|---|---|---|---|---|
| Stadtzentrum | Ebene | (Start / Siedler) | – | Lager, Territorium Radius 2, +4 Wohnplätze | Start |
| Lager | Ebene | 4 Holz, 2 Stein | 0 | weiterer Straßen-Anschlusspunkt | Siedlung |
| Wohnhaus | Ebene | 3 Holz | 0 | +4 Wohnplätze | Siedlung |
| Holzfäller | neben Wald | 2 Holz | 1 | +2 Holz | Siedlung |
| Steinbruch | Hügel oder neben Berg | 3 Holz | 1 | +2 Stein | Siedlung |
| Bauernhof | Ebene | 3 Holz | 2 | +3 Getreide | Siedlung |
| Fischer | Ebene an Küstenwasser | 3 Holz | 1 | +2 Fisch | Siedlung |
| Sägewerk | Ebene | 4 Holz, 2 Stein | 1 | 2 Holz → 2 Bretter | Siedlung |
| Bäckerei | Ebene | 3 Bretter, 2 Stein | 1 | 2 Getreide → 3 Brot | Siedlung |
| Olivenhain | Ebene oder Hügel | 4 Bretter | 1 | +2 Oliven | Siedlung |
| Ölpresse | Ebene | 4 Bretter, 3 Stein | 1 | 2 Oliven → 2 Öl | Siedlung |
| Mine | Hügel oder neben Berg | 5 Holz, 3 Stein | 2 | +2 Erz | Siedlung |
| Schmelze | Ebene | 2 Bretter, 4 Stein | 1 | 2 Erz + 1 Holz → 1 Bronze | Siedlung |
| Kaserne | Ebene | 6 Bretter, 4 Stein | 0 | bildet Landeinheiten aus | Siedlung |
| Grenzturm | Ebene oder Hügel | 2 Holz, 4 Stein | 0 | Territorium Radius 2 um den Turm | Siedlung |
| Weinberg | Hügel | 4 Bretter, 2 Stein | 1 | +2 Trauben | Polis |
| Kelterei | Ebene | 4 Bretter, 4 Stein | 1 | 2 Trauben → 2 Wein | Polis |
| Hafen | Ebene an Küstenwasser | 8 Bretter, 4 Stein | 1 | baut Schiffe, Seeweg-Anschluss | Polis |
| Marktplatz | Ebene | 6 Bretter, 6 Stein | 1 | Waren ↔ Drachmen tauschen | Polis |
| Tempel | Ebene oder Hügel | 10 Stein, 4 Öl | 0 | +Punkte; später Götter-Gunst | Polis |
| Weltwunder | Ebene, 1 pro Volk | 40 Stein, 20 Bretter, 20 Bronze, 10 Wein | 4 | Bau über 5 Runden; siehe Sieg | Metropole |

**Produktionsregeln**
- Ein Gebäude produziert nur, wenn es (a) alle Arbeiter hat, (b) per Straße mit einem Lager/Stadtzentrum desselben Volkes verbunden ist und (c) die Eingangswaren im Vorrat liegen.
- „Verbunden“ = es gibt eine Kette aus Straßenfeldern/Gebäudefeldern zwischen Gebäude und Lager (Nachbarschaft auf dem Hex-Gitter). Gebäude direkt neben einem Lager zählen als verbunden.
- Alle Waren landen im gemeinsamen Vorrat des Volkes (keine Träger-Simulation in Version 1).
- Fehlt etwas, zeigt das Gebäude ein Statussymbol und im Infopanel den Grund.
- Straße bauen: 1 Holz pro Feld (ab Polis optional gepflasterte Straße: 1 Stein, später).

## 6. Bevölkerung & Stadtstufen

- Einwohner wohnen in Stadtzentrum und Wohnhäusern (Wohnplätze) und arbeiten automatisch in Gebäuden (Reihenfolge: Nahrung zuerst, dann Rohstoffe, dann Verarbeitung).
- **Verbrauch:** 1 Nahrung pro 2 Einwohner pro Runde (aufgerundet).
- **Wachstum:** Ist die Nahrung gedeckt und es gibt freie Wohnplätze → +1 Einwohner pro Runde (ab Polis +2).
- **Hunger:** Fehlt Nahrung → −1 Einwohner pro Runde.
- **Steuern:** 1 Drachme pro 2 Einwohner; +50 %, wenn alle Bedarfe der aktuellen Stufe gedeckt sind.

| Stufe | Bedarf pro Runde | Aufstieg erfordert | Schaltet frei |
|---|---|---|---|
| Siedlung | Nahrung | – (Start) | Grundgebäude, Späher, Siedler, Speerträger, Bogenschütze |
| Polis | Nahrung + 1 Öl je 10 Einw. | 20 Einwohner, 3 Runden Öl versorgt, 20 Bretter, 20 Stein, 30 Drachmen | Weinberg, Kelterei, Hafen, Marktplatz, Tempel, Hoplit, Transportschiff |
| Metropole | wie Polis + 1 Wein je 10 Einw. | 50 Einwohner, 3 Runden Wein versorgt, 40 Bretter, 40 Stein, 10 Bronze, 80 Drachmen | Weltwunder, Reiter, Triere |

Jede Stadt eines Volkes hat ihre eigene Stufe; der Vorrat ist gemeinsam.

## 7. Einheiten

| Einheit | Angriff | Verteidigung | LP | Bewegung | Reichweite | Kosten | Ab |
|---|---|---|---|---|---|---|---|
| Späher | 1 | 1 | 5 | 3 | 1 | 2 Bretter, 5 Drachmen | Siedlung |
| Siedler | 0 | 1 | 5 | 1 | – | 4 Brot, 4 Bretter, 2 Einwohner | Siedlung |
| Speerträger | 2 | 2 | 10 | 1 | 1 | 2 Bretter, 1 Bronze | Siedlung |
| Bogenschütze | 2 | 1 | 8 | 1 | 2 | 3 Bretter, 1 Bronze | Siedlung |
| Hoplit | 2 | 3 | 12 | 1 | 1 | 1 Bretter, 3 Bronze | Polis |
| Reiter | 3 | 1 | 10 | 3 | 1 | 2 Bronze, 4 Getreide | Metropole |
| Transportschiff | 0 | 1 | 8 | 3 | – | 6 Bretter | Polis (Hafen) |
| Triere | 3 | 2 | 12 | 3 | 1 | 8 Bretter, 2 Bronze | Metropole (Hafen) |

- Ausbildung: Landeinheiten in der Kaserne, Schiffe im Hafen. Die Einheit erscheint im nächsten Zug.
- **Unterhalt:** 1 Nahrung pro Einheit pro Runde. Fehlt Nahrung, verliert jede Einheit 2 LP.
- Pro Zug: bewegen und/oder angreifen (Angriff beendet den Zug der Einheit).
- Heilung: +2 LP pro Runde ohne Aktion, +4 im eigenen Territorium.
- **Siedler** gründen auf einer freien Ebene (mind. 4 Felder von anderen Stadtzentren entfernt) eine neue Stadt.

### Kampfformel (Startwert, nach Polytopia-Vorbild)
```
angriffsKraft   = Angriff_A    × (LP_A / maxLP_A)
verteidKraft    = Verteidigung_V × (LP_V / maxLP_V) × Terrainbonus × (Mauer ? 1,5 : 1)
gesamt          = angriffsKraft + verteidKraft
schaden         = runden(angriffsKraft / gesamt × Angriff_A × 4,5)
gegenschlag     = runden(verteidKraft / gesamt × Verteidigung_V × 4,5)   // nur wenn V überlebt und A in Reichweite von V
```

### Städte einnehmen
Eine feindliche Landeinheit, die eine Runde lang unbehelligt auf einem Stadtzentrum steht, übernimmt die Stadt samt Gebäuden in ihrem Territorium.

## 8. Territorium & Sicht

- Stadtzentrum: Territorium Radius 2. Grenzturm: Radius 2 um den Turm (muss an eigenes Gebiet grenzen).
- Felder gehören dem Volk, das sie zuerst beansprucht hat.
- **Nebel des Krieges:** unerkundete Felder schwarz; erkundete, aber nicht sichtbare Felder abgedunkelt. Sichtweite: Einheiten 2, Stadtzentrum/Grenzturm 3.

## 9. KI-Völker

| Volk | Persönlichkeit | Schwerpunkt |
|---|---|---|
| Athen | Händler | Wirtschaft, Hafen/Markt früh, wenig Militär |
| Sparta | Krieger | früh Kaserne, Hopliten, greift Nachbarn an |
| Korinth | Baumeister | schnelles Wachstum, Wunder-Rennen |

- Der Spieler wählt ein eigenes Volk (Name/Farbe frei), die KI nimmt die übrigen.
- KI-Ansatz: **Nutzwert-basiert** – jede mögliche Aktion bekommt eine Punktzahl nach aktuellem Bedarf (z. B. Nahrung knapp → Bauernhof hoch bewertet), gewichtet mit der Persönlichkeit. Die KI benutzt nur reguläre Spieleraktionen und sieht nur, was ihre Sicht erlaubt.
- Schwierigkeitsgrade später (z. B. Produktionsbonus für die KI).

## 10. Siegbedingungen

Beim Spielstart einzeln an-/abwählbar:
1. **Punkte** nach Rundenlimit (Standard: 120 Runden).
2. **Weltwunder:** Wer es zuerst fertigstellt, gewinnt sofort.
3. **Eroberung:** alle gegnerischen Stadtzentren eingenommen.

| Punkte | Wert |
|---|---|
| je Einwohner | 1 |
| je Gebäude | 2 |
| je Territoriumsfeld | 1 |
| je Stadt auf Stufe Polis / Metropole | 20 / 50 |
| Tempel | 15 |
| Weltwunder | 150 |

## 11. Bedienung (Handy)

- **Oben:** Ressourcenleiste (horizontal scrollbar), Runde X / Limit.
- **Unten:** Leiste mit „Bauen“, „Straße“, „Einheiten“; rechts unten großer Knopf „Runde beenden“.
- Feld antippen → Infopanel von unten (Terrain, Gebäude, Status, Aktionen).
- Bauen: Gebäude wählen → gültige Felder werden hervorgehoben → Feld antippen → bestätigen.
- Straße: Startfeld antippen, Zielfeld antippen → Vorschau des Weges mit Kosten → bestätigen.
- Einheit antippen → erreichbare Felder hervorgehoben, angreifbare Gegner rot markiert.

## 12. Später (nicht in Version 1)

- **Götter:** Tempel erzeugt Gunst; Zeus, Poseidon, Athene, Demeter mit eigenen Segen/Zaubern.
- Handel und Diplomatie mit KI-Völkern (Frieden, Handelsverträge).
- Träger-Simulation auf Straßen (optional, für Siedler-Feeling).
- Multiplayer (die deterministische Logik in `core/` ist dafür vorbereitet).
- App-Store-Version.
