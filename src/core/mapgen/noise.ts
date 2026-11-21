// Value noise: smooth, random "terrain noise" built from a coarse grid.
// The grid values come from the seeded RNG, so everything is deterministic.

import { nextFloat, type Rng } from '../rng';

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Creates a noise function f(x, y) with values in [0, 1].
 * x/y are pixel coordinates (hex size 1); width/height is the covered area.
 * Each octave halves the cell size and the strength.
 */
export function createNoise(
  rng: Rng,
  width: number,
  height: number,
  cellSize: number,
  octaves = 3,
): (x: number, y: number) => number {
  interface Octave {
    cell: number;
    cols: number;
    values: number[];
    amplitude: number;
  }
  const layers: Octave[] = [];
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cell = cellSize / 2 ** o;
    const amplitude = 0.5 ** o;
    const cols = Math.ceil(width / cell) + 2;
    const rows = Math.ceil(height / cell) + 2;
    const values: number[] = [];
    for (let i = 0; i < cols * rows; i++) values.push(nextFloat(rng));
    layers.push({ cell, cols, values, amplitude });
    total += amplitude;
  }
  return (x, y) => {
    let sum = 0;
    for (const l of layers) {
      const gx = Math.max(0, x) / l.cell;
      const gy = Math.max(0, y) / l.cell;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = smoothstep(gx - ix);
      const fy = smoothstep(gy - iy);
      const v = (cx: number, cy: number): number => l.values[cy * l.cols + cx];
      const top = v(ix, iy) * (1 - fx) + v(ix + 1, iy) * fx;
      const bottom = v(ix, iy + 1) * (1 - fx) + v(ix + 1, iy + 1) * fx;
      sum += (top * (1 - fy) + bottom * fy) * l.amplitude;
    }
    return sum / total;
  };
}
