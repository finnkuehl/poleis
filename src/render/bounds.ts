// Pure calculation of the map extent (no PixiJS, easy to test).
import { allHexes } from '../core/map';
import type { MapState } from '../core/state';
import { hexToPixel, SQRT3 } from '../core/hex';
import type { Rect } from './camera';

/** Bounding box of all tiles, including half a hex width/height as margin. */
export function mapWorldBounds(map: MapState, hexSize: number): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const halfW = (hexSize * SQRT3) / 2;
  for (const h of allHexes(map)) {
    const p = hexToPixel(h, hexSize);
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - hexSize);
    maxY = Math.max(maxY, p.y + hexSize);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
