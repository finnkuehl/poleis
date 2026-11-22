// Pure layout of the woodland (no PixiJS, easy to test): where the drawn tree sprites stand on
// forest tiles. Trees sit on a jittered lattice in map space, so the canopy runs on without a seam
// from one forest tile into the next; toward other terrain the wood thins out into smaller trees
// and shrubs, and toward the water it keeps the beach free.
// Everything here only affects the look; it never changes game logic.
import { hexToPixel, pixelToHex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import type { MapState } from '../core/state';
import { smoothNoise, tileHash } from './terrain';
import { theme } from './theme';

const F = theme.terrainPaint.forest;

export type WoodKind = 'pine' | 'oak' | 'cypress' | 'shrub' | 'olive';

/** A tree sprite to place: trunk foot (world px), kind, variant number, size factor. */
export interface TreePlan {
  x: number;
  y: number;
  kind: WoodKind;
  /** Any number; the painter picks the loaded variant `variant % count`. */
  variant: number;
  scale: number;
}

/** One tree of the woodland, with the tile it stands on. */
export interface WoodTree extends TreePlan {
  tile: number;
}

/** Nominal crown radius of a tree of `kind` at scale 1 (world px). */
export function crownRadius(kind: WoodKind, size: number): number {
  return F.crown[kind] * size;
}

/**
 * Crown radius (fraction of the hex size, at scale 1) of the tree of `kind` and `variant` that
 * will actually be drawn; default: the nominal one of the kind.
 */
export type CrownOf = (kind: WoodKind, variant: number) => number;

const nominalCrown: CrownOf = (kind) => F.crown[kind];

/**
 * The woodland of the whole map. `shoreDist(p)` is the distance of a world point to the beach of
 * the tile it stands in (Infinity inland), `openDist(p)` the distance to the nearest edge of its
 * tile that borders anything but forest (other land, water, the map border; Infinity if none).
 * Trees stand only on forest tiles; their crowns (`crownOf`) reach across edges only into other
 * forest tiles.
 */
export function woodlandTrees(
  map: MapState,
  size: number,
  shoreDist: (p: Point) => number,
  openDist: (p: Point) => number,
  crownOf: CrownOf = nominalCrown,
): WoodTree[] {
  const step = F.spacing * size;
  const dy = step * (Math.sqrt(3) / 2);
  const jitter = F.jitter * step;
  const out: WoodTree[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== 'forest') continue;
    const c = hexToPixel(hexAtIndex(map, i), size);
    // Every lattice point whose jittered position may fall into this tile
    const j0 = Math.floor((c.y - size - jitter) / dy);
    const j1 = Math.ceil((c.y + size + jitter) / dy);
    for (let j = j0; j <= j1; j++) {
      const shift = (j & 1) * 0.5 * step;
      const k0 = Math.floor((c.x - size - jitter - shift) / step);
      const k1 = Math.ceil((c.x + size + jitter - shift) / step);
      for (let k = k0; k <= k1; k++) {
        const h = (salt: number): number => tileHash(k, j, 800 + salt);
        const p = {
          x: k * step + shift + (h(0) - 0.5) * 2 * jitter,
          y: j * dy + (h(1) - 0.5) * 2 * jitter,
        };
        // Each lattice point belongs to the one tile it lands in
        if (tileIndex(map, pixelToHex(p, size)) !== i) continue;
        const tree = placeTree(p, i, size, h, shoreDist(p), openDist(p), crownOf);
        if (tree) out.push(tree);
      }
    }
  }
  return out;
}

function placeTree(
  p: Point,
  tile: number,
  size: number,
  h: (salt: number) => number,
  shore: number,
  open: number,
  crownOf: CrownOf,
): WoodTree | null {
  if (shore < F.shoreMargin * size) return null;
  // Gaps in the canopy now and then, and a few glades (where a smooth noise is high)
  const glade = smoothNoise(p.x / (3 * size), p.y / (3 * size), 31);
  const gap = F.gapChance + F.gladeChance * Math.max(0, glade - 0.7) * 3.3;
  if (h(2) < gap) return null;
  // Pine-rich and oak-rich parts of the wood
  const pines =
    F.pineShare + (smoothNoise(p.x / (5 * size), p.y / (5 * size), 32) - 0.5) * 2 * F.mixShift;
  const v = h(3);
  let kind: WoodKind = v < pines ? 'pine' : v < pines + F.oakShare ? 'oak' : 'cypress';
  let scale = 1 + (h(4) - 0.5) * 2 * F.scaleJitter;
  // Toward open land the wood thins out: fewer, smaller trees and shrubs
  const edge = F.edgeZone * size;
  if (open < edge) {
    const t = open / edge;
    if (h(5) > F.edgeKeep + (1 - F.edgeKeep) * t) return null;
    if (h(6) < F.edgeShrubShare * (1 - t)) kind = 'shrub';
    scale *= F.edgeScale + (1 - F.edgeScale) * t;
  }
  // The crown (of the variant that will be drawn) must not reach over an edge into open land
  const variant = Math.floor(h(7) * 1000);
  const room = Math.min(open, shore);
  if (crownOf(kind, variant) * size * scale > room) {
    const shrub = crownOf('shrub', variant) * size;
    if (kind === 'shrub' || shrub > room) return null;
    kind = 'shrub';
    scale = Math.min(scale, room / shrub);
  }
  return { x: p.x, y: p.y, kind, variant, scale, tile };
}
