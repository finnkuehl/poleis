// Terrain-Werte (siehe docs/GAME_DESIGN.md, Abschnitt 3).
// Hier stehen nur Zahlen und Regeln, keine Texte (Namen kommen aus i18n).

export type TerrainId = 'ocean' | 'coast' | 'plains' | 'forest' | 'hills' | 'mountains';

export interface TerrainDef {
  /** Wasserfeld? Wasser können nur Schiffe befahren. */
  isWater: boolean;
  /** Bewegungskosten für Landeinheiten. null = nicht betretbar (Wasser: nur Schiffe, Berg: unpassierbar). */
  moveCost: number | null;
  /** Verteidigungs-Multiplikator (1.5 = 50 % stärker). null = kein Bonus ("–"). */
  defenseBonus: number | null;
  /** Darf man direkt auf das Feld bauen? (Wald: nein, Holzfäller steht daneben.) */
  buildable: boolean;
}

/** Alle Terrain-Arten in fester Reihenfolge (z. B. für Schleifen und Tests). */
export const TERRAIN_IDS: readonly TerrainId[] = [
  'ocean',
  'coast',
  'plains',
  'forest',
  'hills',
  'mountains',
];

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  // Tiefes Wasser, nur für Schiffe.
  ocean: { isWater: true, moveCost: null, defenseBonus: null, buildable: false },
  // Wasser direkt neben Land; Fischer und Hafen grenzen daran.
  coast: { isWater: true, moveCost: null, defenseBonus: null, buildable: false },
  // Standardfeld: 1 Bewegungspunkt, bebaubar.
  plains: { isWater: false, moveCost: 1, defenseBonus: 1.0, buildable: true },
  // Holzquelle: 2 Bewegungspunkte, Verteidigung x1,5, nicht direkt bebaubar.
  forest: { isWater: false, moveCost: 2, defenseBonus: 1.5, buildable: false },
  // Steinbruch, Mine, Weinberg: 2 Bewegungspunkte, Verteidigung x1,5, bebaubar.
  hills: { isWater: false, moveCost: 2, defenseBonus: 1.5, buildable: true },
  // Unpassierbar, nicht bebaubar (Mine/Steinbruch stehen daneben).
  mountains: { isWater: false, moveCost: null, defenseBonus: null, buildable: false },
};
