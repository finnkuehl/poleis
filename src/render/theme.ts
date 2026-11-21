// Farben und Schrift der Darstellung (kein Balancing, nur Optik).
import type { TerrainId } from '../data/terrain';

export const theme = {
  /** Hintergrund: etwas dunkler als der Ozean */
  background: 0x15384a,
  fontFamily: "Georgia, 'Times New Roman', serif",
  /** Flächenfarbe je Terrain (mediterrane Palette) */
  terrainColors: {
    ocean: 0x1f4e63,
    coast: 0x3d8ea3,
    plains: 0xa9b665,
    forest: 0x4f7a3a,
    hills: 0xc2a36b,
    mountains: 0x8a8178,
  } satisfies Record<TerrainId, number>,
  /** Symbole auf den Feldern */
  treeColor: 0x2c5a26,
  hillColor: 0x7a5a30,
  mountainColor: 0x5e574f,
  mountainPeakColor: 0xffffff,
  /** Umrisslinie der Felder: dunkel, durchscheinend */
  outlineColor: 0x0b1f2a,
  outlineAlpha: 0.35,
  outlineWidth: 1,
  /** Auswahl: weißer Umriss + leichte Füllung */
  selectionColor: 0xffffff,
  selectionWidth: 3,
  selectionFillAlpha: 0.15,
} as const;
