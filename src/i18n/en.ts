// Alle sichtbaren Texte des Spiels stehen hier (Deutsch).
export const de = {
  gameTitle: 'Poleis',
  renderError:
    'Die Grafik konnte nicht gestartet werden. Bitte lade die Seite neu oder versuche einen anderen Browser.',
  terrain: {
    ocean: 'Ozean',
    coast: 'Küstenwasser',
    plains: 'Ebene',
    forest: 'Wald',
    hills: 'Hügel',
    mountains: 'Berg',
  },
  terrainNote: {
    ocean: 'Offenes Meer – nur für Schiffe',
    coast: 'Fischer und Hafen grenzen daran',
    plains: 'Standard für die meisten Gebäude',
    forest: 'Holzquelle – Holzfäller daneben bauen',
    hills: 'Für Steinbruch, Mine und Weinberg',
    mountains: 'Unpassierbar – Mine oder Steinbruch daneben bauen',
  },
  tileInfo: {
    movement: 'Bewegung',
    defense: 'Verteidigung',
    buildable: 'Bebaubar',
    yes: 'ja',
    no: 'nein',
    shipsOnly: 'nur Schiffe',
    impassable: 'unpassierbar',
    tile: 'Feld',
    close: 'Schließen',
  },
  seedLabel: 'Seed',
} as const;
