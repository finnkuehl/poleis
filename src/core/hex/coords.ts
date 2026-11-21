// Axial hex coordinates (pointy-top), based on redblobgames.com/grids/hexagons
// Pure functions without state.

export interface Hex {
  q: number;
  r: number;
}

/** Offset coordinates (odd-r: odd rows shifted to the right). */
export interface Offset {
  col: number;
  row: number;
}

/** Directions in the order E, NE, NW, W, SW, SE (pointy-top). */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// "+ 0" turns -0 into 0 (Object.is tells them apart).
const norm = (n: number): number => n + 0;

export function hex(q: number, r: number): Hex {
  return { q: norm(q), r: norm(r) };
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Key "q,r" for Set/Map outside the state. */
export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function neighbor(h: Hex, direction: number): Hex {
  const d = HEX_DIRECTIONS[((direction % 6) + 6) % 6];
  return hexAdd(h, d);
}

export function neighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** All tiles at exactly `radius` distance (radius 0 -> only the center). */
export function ring(center: Hex, radius: number): Hex[] {
  if (radius <= 0) return [hex(center.q, center.r)];
  const results: Hex[] = [];
  // Start in the south-west (SW * radius), then once all the way around.
  let current = hex(
    center.q + HEX_DIRECTIONS[4].q * radius,
    center.r + HEX_DIRECTIONS[4].r * radius,
  );
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(current);
      current = neighbor(current, side);
    }
  }
  return results;
}

/** All tiles with distance <= radius. */
export function range(center: Hex, radius: number): Hex[] {
  const results: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      results.push(hex(center.q + dq, center.r + dr));
    }
  }
  return results;
}

/** Rounds fractional axial coordinates to the nearest tile (cube rounding). */
export function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return hex(rq, rr);
}

/** Straight line from a to b, including start and end (distance + 1 tiles). */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [hex(a.q, a.r)];
  // Small offset so that points exactly on edges are rounded deterministically.
  const eps = 1e-6;
  const aq = a.q + eps;
  const ar = a.r + eps * 2;
  const bq = b.q + eps;
  const br = b.r + eps * 2;
  const results: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    results.push(hexRound(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return results;
}

/** Axial -> offset (odd-r). */
export function axialToOffset(h: Hex): Offset {
  const col = h.q + (h.r - (h.r & 1)) / 2;
  return { col: norm(col), row: norm(h.r) };
}

/** Offset (odd-r) -> axial. */
export function offsetToAxial(o: Offset): Hex {
  const q = o.col - (o.row - (o.row & 1)) / 2;
  return hex(q, o.row);
}
