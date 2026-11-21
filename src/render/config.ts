// Settings for the camera feel (panning, zooming, tapping).
// All values can be adjusted freely; pixels are CSS pixels on the screen.
export const cameraConfig = {
  /** Movement up to this distance counts as a tap, anything beyond as a drag */
  tapThresholdPx: 8,
  /** Maximum zoom: a tile is at most this big (radius in screen pixels) */
  maxHexScreenRadiusPx: 90,
  /** Minimum zoom: the whole map fits in (0.9 = a bit of margin) */
  minZoomFitFactor: 0.9,
  /** How much sea you may pan beyond the map edge */
  panMarginPx: 80,
  /** Mouse wheel sensitivity (larger = faster zooming) */
  wheelZoomSpeed: 0.0015,
} as const;

/** Start zoom: a hex has this radius (center to corner) on the screen, in CSS pixels */
export const startHexScreenRadiusPx = 26;

/** Size of the hex tiles: radius from center to corner in world pixels (at zoom 1) */
export const hexSize = 32;
