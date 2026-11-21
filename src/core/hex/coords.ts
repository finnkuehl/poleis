// Axiale Hex-Koordinaten (pointy-top), Grundlage: redblobgames.com/grids/hexagons
// Reine Funktionen ohne Zustand.

export interface Hex {
  q: number;
  r: number;
}

/** Offset-Koordinaten (odd-r: ungerade Zeilen nach rechts verschoben). */
export interface Offset {
  col: number;
  row: number;
}

/** Richtungen in der Reihenfolge O, NO, NW, W, SW, SO (pointy-top). */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// "+ 0" wandelt -0 in 0 um (Object.is unterscheidet beide).
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

/** Schlüssel "q,r" für Set/Map außerhalb des States. */
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

/** Alle Felder mit exakt `radius` Abstand (radius 0 → nur das Zentrum). */
export function ring(center: Hex, radius: number): Hex[] {
  if (radius <= 0) return [hex(center.q, center.r)];
  const results: Hex[] = [];
  // Start im Südwesten (SW · radius), dann einmal rund herum.
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

/** Alle Felder mit distance ≤ radius. */
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

/** Rundet gebrochene axiale Koordinaten auf das nächste Feld (Cube-Rounding). */
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

/** Gerade Linie von a nach b, inkl. Start und Ziel (distance + 1 Felder). */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [hex(a.q, a.r)];
  // Kleiner Versatz, damit Punkte exakt auf Kanten deterministisch gerundet werden.
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

/** Axial → Offset (odd-r). */
export function axialToOffset(h: Hex): Offset {
  const col = h.q + (h.r - (h.r & 1)) / 2;
  return { col: norm(col), row: norm(h.r) };
}

/** Offset (odd-r) → Axial. */
export function offsetToAxial(o: Offset): Hex {
  const q = o.col - (o.row - (o.row & 1)) / 2;
  return hex(q, o.row);
}
