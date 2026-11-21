// Kartengenerator. Ablauf:
// 1. Rausch-Felder (Küstenform, Höhe, Feuchte)  2. Festland wächst Feld für Feld
// 3. Inseln  4. Terrain je Landmasse (Berge als Ketten, Hügel, Wald, Rest Ebene)
// 5. Wasser: Küste oder Ozean.
// Alles läuft über den Seed-RNG; Gleichstände werden immer über den Index entschieden.

import { mapgenConfig as cfg } from '../../data/mapgen';
import type { TerrainId } from '../../data/terrain';
import { axialToOffset, hexToPixel, neighbors, offsetToAxial, type Hex } from '../hex';
import type { MapState } from '../state';
import { chance, createRng, nextFloat, nextInt, pick, type Rng } from '../rng';
import { createNoise } from './noise';

export interface GenerateOptions {
  width?: number;
  height?: number;
}

export interface MapGenStats {
  /** Anzahl der Versuche (1 = gleich beim ersten Mal geklappt). */
  attempts: number;
}

interface Grid {
  width: number;
  height: number;
  hexes: Hex[];
  /** Pixelposition (Hexgröße 1), so verschoben, dass alles >= 0 ist. */
  px: { x: number; y: number }[];
  pxWidth: number;
  pxHeight: number;
  /** Nachbar-Indizes (nur Felder innerhalb der Karte), Reihenfolge wie HEX_DIRECTIONS. */
  nbrs: number[][];
  /** Abstand zum Kartenrand in Feldern (0 = Randfeld). */
  edgeDist: number[];
}

function buildGrid(width: number, height: number): Grid {
  const hexes: Hex[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) hexes.push(offsetToAxial({ col, row }));
  }
  const raw = hexes.map((h) => hexToPixel(h, 1));
  const minX = Math.min(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const px = raw.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const nbrs = hexes.map((h) => {
    const list: number[] = [];
    for (const n of neighbors(h)) {
      const { col, row } = axialToOffset(n);
      if (col >= 0 && col < width && row >= 0 && row < height) list.push(row * width + col);
    }
    return list;
  });
  const edgeDist = hexes.map((_, i) => {
    const col = i % width;
    const row = Math.floor(i / width);
    return Math.min(col, row, width - 1 - col, height - 1 - row);
  });
  return {
    width,
    height,
    hexes,
    px,
    pxWidth: Math.max(...px.map((p) => p.x)) + 1,
    pxHeight: Math.max(...px.map((p) => p.y)) + 1,
    nbrs,
    edgeDist,
  };
}

/** Abstand jedes Feldes zum nächsten Landfeld (Land = 0), per Breitensuche. */
function landDistance(grid: Grid, isLand: boolean[]): number[] {
  const dist = new Array<number>(isLand.length).fill(Infinity);
  const queue: number[] = [];
  isLand.forEach((l, i) => {
    if (l) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    for (const n of grid.nbrs[i]) {
      if (dist[n] === Infinity) {
        dist[n] = dist[i] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

type Noise = (x: number, y: number) => number;

function sampleAt(grid: Grid, noise: Noise, i: number): number {
  return noise(grid.px[i].x, grid.px[i].y);
}

/** Festland: wächst vom besten Feld nahe dem Zentrum nach außen. */
function growMainland(grid: Grid, rng: Rng, shapeNoise: Noise, target: number): number[] | null {
  const shape = cfg.mainlandShape;
  const n = grid.hexes.length;
  const elong =
    shape.elongation.min + nextFloat(rng) * (shape.elongation.max - shape.elongation.min);
  const angle = nextFloat(rng) * Math.PI;
  const shiftAngle = nextFloat(rng) * Math.PI * 2;
  const cx = grid.pxWidth / 2 + Math.cos(shiftAngle) * shape.centerShift * grid.pxWidth;
  const cy = grid.pxHeight / 2 + Math.sin(shiftAngle) * shape.centerShift * grid.pxHeight;
  // Ellipsenfläche = Fläche der Zielfelder (ein Hexfeld hat die Fläche 1,5·√3).
  const area = target * 1.5 * Math.sqrt(3);
  const prod = area / Math.PI;
  const a = Math.sqrt(prod * elong);
  const b = prod / a;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const score = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const dx = grid.px[i].x - cx;
    const dy = grid.px[i].y - cy;
    const u = (dx * cos + dy * sin) / a;
    const v = (-dx * sin + dy * cos) / b;
    const d = Math.sqrt(u * u + v * v);
    score[i] =
      -d +
      (sampleAt(grid, shapeNoise, i) - 0.5) * shape.noiseWeight +
      nextFloat(rng) * shape.jitter;
  }
  const valid = (i: number): boolean => grid.edgeDist[i] >= cfg.edgeMargin;

  // Startfeld: gültiges Feld, das dem Zentrum am nächsten liegt.
  let start = -1;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    if (!valid(i)) continue;
    const d = (grid.px[i].x - cx) ** 2 + (grid.px[i].y - cy) ** 2;
    if (d < best) {
      best = d;
      start = i;
    }
  }
  if (start < 0) return null;

  const inSet = new Array<boolean>(n).fill(false);
  const inFrontier = new Array<boolean>(n).fill(false);
  const cells: number[] = [];
  const frontier: number[] = [start];
  inFrontier[start] = true;
  while (cells.length < target && frontier.length > 0) {
    let bi = 0;
    for (let k = 1; k < frontier.length; k++) {
      const f = frontier[k];
      const g = frontier[bi];
      if (score[f] > score[g] || (score[f] === score[g] && f < g)) bi = k;
    }
    const cur = frontier[bi];
    frontier.splice(bi, 1);
    inSet[cur] = true;
    cells.push(cur);
    for (const nb of grid.nbrs[cur]) {
      if (!inSet[nb] && !inFrontier[nb] && valid(nb)) {
        inFrontier[nb] = true;
        frontier.push(nb);
      }
    }
  }
  return cells.length === target ? cells : null;
}

/** Eine Insel wächst aus `start`; null, wenn sie die Mindestgröße nicht erreicht. */
function growIsland(
  grid: Grid,
  rng: Rng,
  noise: Noise,
  start: number,
  allowed: (i: number) => boolean,
): number[] | null {
  const target = nextInt(rng, cfg.islandSize.min, cfg.islandSize.max);
  const cells = [start];
  const inSet = new Set<number>([start]);
  while (cells.length < target) {
    const candidates = new Set<number>();
    for (const c of cells)
      for (const nb of grid.nbrs[c]) if (!inSet.has(nb) && allowed(nb)) candidates.add(nb);
    if (candidates.size === 0) break;
    let bestCell = -1;
    let bestScore = -Infinity;
    for (const c of [...candidates].sort((x, y) => x - y)) {
      const own = grid.nbrs[c].filter((nb) => inSet.has(nb)).length;
      const s = sampleAt(grid, noise, c) + nextFloat(rng) * 0.25 + own * 0.12;
      if (s > bestScore) {
        bestScore = s;
        bestCell = c;
      }
    }
    inSet.add(bestCell);
    cells.push(bestCell);
  }
  return cells.length >= cfg.islandSize.min ? cells : null;
}

interface TerrainShares {
  mountains: number;
  hills: number;
  forest: number;
}

/** Verteilt Berge (Ketten), Hügel, Wald und Ebene auf eine Landmasse. */
function assignTerrain(
  grid: Grid,
  rng: Rng,
  cells: number[],
  shares: TerrainShares,
  height: Noise,
  moisture: Noise,
  terrain: TerrainId[],
): void {
  const size = cells.length;
  const sorted = [...cells].sort((a, b) => a - b);
  const heightOf = new Map<number, number>();
  const moistOf = new Map<number, number>();
  for (const c of sorted) {
    heightOf.set(c, sampleAt(grid, height, c));
    moistOf.set(c, sampleAt(grid, moisture, c));
  }
  // 1 = begehbar (noch nicht vergeben), 2 = Berg, 0 = gehört nicht zur Landmasse
  const kind = new Map<number, number>();
  for (const c of sorted) kind.set(c, 1);
  let passableCount = size;

  /** Bleiben die begehbaren Felder zusammenhängend, wenn `cand` ein Berg wird? */
  const connectedWithout = (cand: number): boolean => {
    if (passableCount <= 1) return false;
    const start = sorted.find((c) => c !== cand && kind.get(c) === 1);
    if (start === undefined) return false;
    const seen = new Set<number>([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      for (const nb of grid.nbrs[queue[head]]) {
        if (nb !== cand && kind.get(nb) === 1 && !seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    return seen.size === passableCount - 1;
  };

  // Berge als kurze Ketten.
  const mountainTarget = Math.round(shares.mountains * size);
  let mountains = 0;
  let tries = 0;
  const maxTries = mountainTarget * 10 + 20;
  while (mountains < mountainTarget && tries < maxTries) {
    tries++;
    const free = sorted.filter((c) => kind.get(c) === 1);
    // Startfeld: aus 5 Zufallskandidaten das höchste (bevorzugt hohes Gelände).
    let start = -1;
    for (let k = 0; k < 5; k++) {
      const c = pick(rng, free);
      if (start < 0 || heightOf.get(c)! > heightOf.get(start)!) start = c;
    }
    let dir = nextInt(rng, 0, 5);
    const length = nextInt(rng, cfg.mountainChainLength.min, cfg.mountainChainLength.max);
    let cur = start;
    for (let step = 0; step < length && mountains < mountainTarget; step++) {
      if (kind.get(cur) !== 1 || !connectedWithout(cur)) break;
      kind.set(cur, 2);
      passableCount--;
      mountains++;
      terrain[cur] = 'mountains';
      if (chance(rng, 0.3)) dir += chance(rng, 0.5) ? 1 : -1;
      // Weiter in Richtung `dir`; ist das Feld unbrauchbar, eine Nachbarrichtung probieren.
      let next = -1;
      for (const d of [dir, dir + 1, dir - 1]) {
        const idx = ((d % 6) + 6) % 6;
        const cand = nbrInDirection(grid, cur, idx);
        if (cand >= 0 && kind.get(cand) === 1) {
          next = cand;
          dir = d;
          break;
        }
      }
      if (next < 0) break;
      cur = next;
    }
  }

  const take = (list: number[], count: number, score: (c: number) => number, id: TerrainId) => {
    const ranked = [...list].sort((a, b) => score(b) - score(a) || a - b);
    const chosen = ranked.slice(0, count);
    for (const c of chosen) terrain[c] = id;
    return list.filter((c) => !chosen.includes(c));
  };

  // Hügel: hohes Gelände, bevorzugt neben Bergen.
  let rest = sorted.filter((c) => kind.get(c) === 1);
  rest = take(
    rest,
    Math.round(shares.hills * size),
    (c) =>
      heightOf.get(c)! +
      (grid.nbrs[c].some((nb) => kind.get(nb) === 2) ? cfg.hillsNearMountainsBonus : 0),
    'hills',
  );
  // Wald: feuchtes Gelände.
  rest = take(rest, Math.round(shares.forest * size), (c) => moistOf.get(c)!, 'forest');
  for (const c of rest) terrain[c] = 'plains';
}

/** Index des Nachbarn in Richtung `dir` (0..5, wie HEX_DIRECTIONS) oder -1 außerhalb. */
function nbrInDirection(grid: Grid, i: number, dir: number): number {
  const h = grid.hexes[i];
  const dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  const { col, row } = axialToOffset({ q: h.q + dirs[dir].q, r: h.r + dirs[dir].r });
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) return -1;
  return row * grid.width + col;
}

/** Ein Versuch; null, wenn nicht genug Inseln Platz finden. */
function tryGenerate(grid: Grid, rng: Rng): TerrainId[] | null {
  const n = grid.hexes.length;
  const noiseOf = () => createNoise(rng, grid.pxWidth, grid.pxHeight, cfg.noiseCellSize * 1.5);
  const shapeNoise = noiseOf();
  const heightNoise = noiseOf();
  const moistureNoise = noiseOf();

  const mainland = growMainland(grid, rng, shapeNoise, Math.round(cfg.mainlandShare * n));
  if (!mainland) return null;

  const isLand = new Array<boolean>(n).fill(false);
  for (const c of mainland) isLand[c] = true;
  const landmasses: number[][] = [mainland];

  const islandCount = nextInt(rng, cfg.islandCount.min, cfg.islandCount.max);
  for (let k = 0; k < islandCount; k++) {
    let placed = false;
    for (let tryNo = 0; tryNo < 30 && !placed; tryNo++) {
      const dist = landDistance(grid, isLand);
      const ok = (i: number): boolean =>
        !isLand[i] && dist[i] >= cfg.islandMinDistance && grid.edgeDist[i] >= cfg.islandEdgeMargin;
      const starts: number[] = [];
      for (let i = 0; i < n; i++) if (ok(i)) starts.push(i);
      if (starts.length === 0) return null;
      const island = growIsland(grid, rng, shapeNoise, pick(rng, starts), ok);
      if (island) {
        for (const c of island) isLand[c] = true;
        landmasses.push(island);
        placed = true;
      }
    }
    if (!placed) return null;
  }

  const terrain = new Array<TerrainId>(n).fill('ocean');
  landmasses.forEach((cells, idx) => {
    const shares = idx === 0 ? cfg.mainlandTerrain : cfg.islandTerrain;
    assignTerrain(grid, rng, cells, shares, heightNoise, moistureNoise, terrain);
  });
  for (let i = 0; i < n; i++) {
    if (!isLand[i]) terrain[i] = grid.nbrs[i].some((nb) => isLand[nb]) ? 'coast' : 'ocean';
  }
  return terrain;
}

export function generateMapWithStats(
  seed: number,
  options: GenerateOptions = {},
): { map: MapState; rng: Rng; stats: MapGenStats } {
  const width = options.width ?? cfg.width;
  const height = options.height ?? cfg.height;
  const grid = buildGrid(width, height);
  const rng = createRng(seed);
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    const tiles = tryGenerate(grid, rng);
    if (tiles) return { map: { width, height, tiles }, rng, stats: { attempts: attempt } };
  }
  throw new Error(
    `Kartengenerierung: nach ${cfg.maxAttempts} Versuchen keine gültige Karte (Seed ${seed})`,
  );
}

export function generateMap(
  seed: number,
  options: GenerateOptions = {},
): { map: MapState; rng: Rng } {
  const { map, rng } = generateMapWithStats(seed, options);
  return { map, rng };
}
