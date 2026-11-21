// Pixel conversion for pointy-top hex tiles.
// `size` is the radius from the center to a corner.

import { hexRound, type Hex } from './coords';

export interface Point {
  x: number;
  y: number;
}

export const SQRT3 = Math.sqrt(3);

export function hexToPixel(h: Hex, size: number): Point {
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * (3 / 2) * h.r,
  };
}

export function pixelToHex(p: Point, size: number): Hex {
  const q = ((SQRT3 / 3) * p.x - (1 / 3) * p.y) / size;
  const r = ((2 / 3) * p.y) / size;
  return hexRound(q, r);
}

/** The 6 corners of a tile (angle 60° * i - 30°). */
export function hexCorners(center: Point, size: number): Point[] {
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}
