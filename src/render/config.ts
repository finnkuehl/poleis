// Einstellungen fürs Kamera-Gefühl (Verschieben, Zoomen, Tippen).
// Alle Werte können frei angepasst werden; Pixel sind CSS-Pixel auf dem Bildschirm.
export const cameraConfig = {
  /** Bewegung bis zu dieser Strecke zählt als Tippen, darüber als Ziehen */
  tapThresholdPx: 8,
  /** Größter Zoom: ein Feld ist höchstens so groß (Radius in Bildschirmpixeln) */
  maxHexScreenRadiusPx: 90,
  /** Kleinster Zoom: die ganze Karte passt hinein (0,9 = etwas Rand) */
  minZoomFitFactor: 0.9,
  /** So viel Meer darf man über den Kartenrand hinausziehen */
  panMarginPx: 80,
  /** Mausrad-Empfindlichkeit (größer = schnelleres Zoomen) */
  wheelZoomSpeed: 0.0015,
} as const;
