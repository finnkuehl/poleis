// Pure helpers for the ground the game paints under and between buildings (docs/ART.md,
// "Grounded buildings"): which ground every building gets, organic outlines fitted to the hex,
// fields cut into parcels, the fishery's water edge and the footprints the terrain keeps free of
// trees and rocks. No PixiJS; deterministic (tile hashes only).
import { hexToPixel, pixelToHex, type Hex, type Point } from '../core/hex';
import { hexAtIndex, tileIndex } from '../core/map';
import { visibleTiles } from '../core/rules/vision';
import type { Building, GameState, MapState, PlayerId, Unit } from '../core/state';
import type { BuildingId } from '../data/buildings';
import type { TerrainId } from '../data/terrain';
import { UNITS } from '../data/units';
import { buildingsShownTo } from './fog';
import { hillMounds, mineArtTransform, moundOutline, type HillMound } from './relief';
import type { FootprintKind } from './terrainArt';
import { edgeNeighborHex } from './geometry';
import { apothem, distanceToEdges, isWater, shoreMask, tileHash } from './terrain';
import { theme } from './theme';

const G = theme.ground;

/**
 * The ground drawn under a building:
 * - 'yard': trodden earth
 * - 'plaza': paved square with flagstone joints, on a trodden-earth apron
 * - 'clearing': forest floor with leaf litter and stumps
 * - 'quarry': stony apron with a stepped cut-stone pit; 'mine': rock apron with a spoil heap
 * - 'farm' / 'vineyard' / 'orchard': fields over the whole tile (furrows, vine rows, olive rows)
 * - 'harbor': like the fishery, a sandy yard toward the water under the quay of its drawn scene
 * - 'fishery': sandy yard under the hut and a trail to the shore (the hut, jetty and boat are one
 *   drawn scene per water direction, see artLayout.ts `buildingArtId`)
 */
export type GroundKind =
  | 'yard'
  | 'plaza'
  | 'clearing'
  | 'quarry'
  | 'mine'
  | 'farm'
  | 'vineyard'
  | 'orchard'
  | 'fishery'
  | 'harbor';

/** Ground kind of every building. */
export const GROUND_KIND: Readonly<Record<BuildingId, GroundKind>> = {
  cityCenter: 'plaza',
  storehouse: 'yard',
  borderTower: 'yard',
  barracks: 'yard',
  harbor: 'harbor',
  house: 'yard',
  woodcutter: 'clearing',
  quarry: 'quarry',
  farm: 'farm',
  fishery: 'fishery',
  sawmill: 'yard',
  bakery: 'yard',
  oliveGrove: 'orchard',
  oilPress: 'yard',
  mine: 'mine',
  smelter: 'yard',
  vineyard: 'vineyard',
  winery: 'yard',
  marketplace: 'plaza',
  temple: 'plaza',
  wonder: 'plaza',
};

/** Small things lying in a yard that hint at the trade. */
export type YardLitter = 'sawdust' | 'soot' | 'straw';

export const YARD_LITTER: Readonly<Partial<Record<BuildingId, YardLitter>>> = {
  sawmill: 'sawdust',
  smelter: 'soot',
  bakery: 'straw',
  storehouse: 'straw',
};

export function groundKindOf(type: BuildingId): GroundKind {
  return GROUND_KIND[type];
}

/** Fields cover the whole tile and join neighboring fields. */
export function isFieldKind(kind: GroundKind): boolean {
  return kind === 'farm' || kind === 'vineyard' || kind === 'orchard';
}

// ---------------------------------------------------------------------------------------------
// Towns share one ground (docs/ART.md): neighboring building tiles of one owner (no fields)
// ---------------------------------------------------------------------------------------------

/** Buildings whose ground can be part of a town (yards and plazas; not fields, mines, ...). */
export function isTownKind(kind: GroundKind): boolean {
  return kind === 'yard' || kind === 'plaza';
}

/** Flat land a town ground can lie on. */
function townLand(t: TerrainId | undefined): boolean {
  return t !== undefined && t !== 'hills' && t !== 'mountains' && !isWater(t);
}

/**
 * The town areas: neighboring tiles with a yard or plaza building of the same owner, on flat
 * land, joined into areas. Road tiles inside a town join it too (`roads`: per tile, `territory`:
 * per tile owner): a road tile next to at least two tiles of the same owner's town (buildings or
 * road tiles that already joined) becomes part of it, so the street runs over the town ground;
 * a road tile with only one town neighbor stays outside (the town's soft rim meets it). Maps
 * every tile of an area with at least two buildings to the area's id (its lowest tile index); single
 * buildings are left out (they keep their own yard).
 */
export function townTiles(
  map: MapState,
  shown: readonly Building[],
  roads: readonly boolean[] = [],
  territory: readonly number[] = [],
): Map<number, number> {
  const owner = new Map<number, PlayerId>();
  const built = new Set<number>();
  for (const b of shown) {
    const i = tileIndex(map, b.hex);
    if (i >= 0) built.add(i);
    if (i < 0 || !isTownKind(GROUND_KIND[b.type]) || !townLand(map.tiles[i])) continue;
    owner.set(i, b.owner);
  }
  const neighborsOf = (i: number): number[] => {
    const h = hexAtIndex(map, i);
    return [0, 1, 2, 3, 4, 5].map((e) => tileIndex(map, edgeNeighborHex(h, e)));
  };
  // Road tiles (no building) that join: repeat until no more do (streets of several road tiles)
  const candidates: number[] = [];
  for (let i = 0; i < roads.length; i++) {
    if (roads[i] && !built.has(i) && townLand(map.tiles[i]) && (territory[i] ?? -1) >= 0) {
      candidates.push(i);
    }
  }
  const street = new Set<number>();
  for (let changed = true; changed;) {
    changed = false;
    for (const i of candidates) {
      if (street.has(i)) continue;
      const who = territory[i];
      const near = neighborsOf(i).filter((n) => n >= 0 && owner.get(n) === who).length;
      if (near < 2) continue;
      owner.set(i, who);
      street.add(i);
      changed = true;
    }
  }
  const out = new Map<number, number>();
  const seen = new Set<number>();
  for (const [start, who] of owner) {
    if (seen.has(start)) continue;
    seen.add(start);
    const area = [start];
    for (let k = 0; k < area.length; k++) {
      for (const n of neighborsOf(area[k])) {
        if (n < 0 || seen.has(n) || owner.get(n) !== who) continue;
        seen.add(n);
        area.push(n);
      }
    }
    const buildings = area.filter((i) => !street.has(i)).length;
    if (buildings >= 2) {
      const id = Math.min(...area);
      for (const i of area) out.set(i, id);
    }
  }
  return out;
}

/** One boolean per edge: does the neighbor across it belong to the same town area? */
export function townJoinMask(map: MapState, h: Hex, towns: ReadonlyMap<number, number>): boolean[] {
  const area = towns.get(tileIndex(map, h));
  return [0, 1, 2, 3, 4, 5].map((e) => {
    const n = tileIndex(map, edgeNeighborHex(h, e));
    return area !== undefined && n >= 0 && towns.get(n) === area;
  });
}

/** Key of the edge between two tiles (same from both sides). */
export function tilePairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Which neighboring town tiles a lane joins (keys from `tilePairKey`; `towns`: the building tiles
 * only, see townTiles): in every town area the lanes lead from its hub (a city center, else its first tile) out to every building, like
 * streets to the square, plus now and then a lane across (`extraChance`, per pair of tiles).
 */
export function townLanes(
  map: MapState,
  towns: ReadonlyMap<number, number>,
  hubs: ReadonlySet<number>,
  extraChance: number = G.town.extraLaneChance,
): Set<string> {
  const lanes = new Set<string>();
  const start = new Map<number, number>();
  for (const [i, area] of towns) {
    if (!start.has(area) || hubs.has(i)) start.set(area, i);
  }
  const reached = new Set<number>();
  // From the hubs first, then from any tile not reached yet (parts of an area that only a
  // street joins: lanes run on town tiles only, the road is the street)
  const starts = [...start.values(), ...towns.keys()];
  for (const hub of starts) {
    if (reached.has(hub)) continue;
    const area = towns.get(hub);
    reached.add(hub);
    const queue = [hub];
    for (let k = 0; k < queue.length; k++) {
      const h = hexAtIndex(map, queue[k]);
      for (let e = 0; e < 6; e++) {
        const n = tileIndex(map, edgeNeighborHex(h, e));
        if (n < 0 || towns.get(n) !== area) continue;
        if (!reached.has(n)) {
          reached.add(n);
          queue.push(n);
          lanes.add(tilePairKey(queue[k], n));
        } else if (tileHash(Math.min(queue[k], n), Math.max(queue[k], n), 240) < extraChance) {
          lanes.add(tilePairKey(queue[k], n));
        }
      }
    }
  }
  return lanes;
}

/**
 * Where the lanes of two neighboring town tiles meet on their shared edge (world px): the edge
 * midpoint slid along the edge by a jitter both tiles compute the same way.
 */
export function laneMeetPoint(map: MapState, h: Hex, e: number, size: number): Point {
  const here = tileIndex(map, h);
  const nb = edgeNeighborHex(h, e);
  const there = tileIndex(map, nb);
  // Always from the tile with the lower index, so both tiles get the very same point
  const [from, edge] = there >= 0 && there < here ? [nb, (e + 3) % 6] : [h, e];
  const lo = Math.min(here, there);
  const hi = Math.max(here, there);
  const c = hexToPixel(from, size);
  const n = edgeNormal(edge);
  const j = (tileHash(lo, hi, 210) - 0.5) * 2 * G.town.laneJitter * size;
  const a = apothem(size);
  return { x: c.x + n.x * a - n.y * j, y: c.y + n.y * a + n.x * j };
}

/** The art's ground circle as an iso ellipse (world px), else the kind's default yard size. */
export function artGroundEllipse(type: BuildingId, size: number): { rx: number; ry: number } {
  const r = artRadiusOf(type);
  if (r === undefined) {
    const { rx, ry } = patchRadii(type, size);
    return { rx: rx / G.artPatchGrow[0], ry: ry / G.artPatchGrow[1] };
  }
  const u = G.artWorldUnit * size * r * Math.SQRT2;
  return { rx: u, ry: u / 2 };
}

/** Measured ground radius of a building's art (world units of the art), if known. */
function artRadiusOf(type: BuildingId): number | undefined {
  return (G.artGroundRadius as Readonly<Partial<Record<BuildingId, number>>>)[type];
}

/**
 * Half axes (world px) of a building's core patch, before the soft edge: its art's ground circle
 * (theme.ground.artGroundRadius, as an iso ellipse) grown by `artPatchGrow`, so a ring of ground
 * shows around the building. Buildings without a measured radius use their kind's default size.
 */
export function patchRadii(type: BuildingId, size: number): { rx: number; ry: number } {
  const r = artRadiusOf(type);
  if (r !== undefined) {
    // A circle of radius r on the art's 2:1 ground: sqrt(2) r wide, half as high. The yard of
    // a farm or vineyard is only as big as its building: the fields begin right at its edge.
    const u = G.artWorldUnit * size * r * Math.SQRT2;
    const kind = GROUND_KIND[type];
    const grow = kind === 'farm' || kind === 'vineyard' ? G.field.yardGrow : G.artPatchGrow;
    return { rx: u * grow[0], ry: (u / 2) * grow[1] };
  }
  const kind = GROUND_KIND[type];
  const base =
    kind === 'plaza'
      ? G.plaza
      : kind === 'clearing'
        ? G.clearing
        : kind === 'quarry'
          ? G.quarry
          : kind === 'mine'
            ? G.mine
            : kind === 'fishery' || kind === 'harbor'
              ? shoreConfig(kind)
              : isFieldKind(kind)
                ? G.field.yard
                : G.yard;
  return { rx: base.rx * size, ry: base.ry * size };
}

/**
 * Center of a building's patch relative to the tile center (world px): where its art's ground
 * circle lies (theme.ground.artGroundCenter, art world units a / b), else the tile center.
 * The fishery's yard has its own shift (`fisheryYardOffset`).
 */
export function patchCenter(type: BuildingId, size: number): Point {
  const c = (G.artGroundCenter as Readonly<Partial<Record<BuildingId, readonly number[]>>>)[type];
  if (!c) return { x: 0, y: 0 };
  // The art's ground axes: a -> (1, 0.5), b -> (-1, 0.5) per world unit
  const u = G.artWorldUnit * size;
  return { x: (c[0] - c[1]) * u, y: ((c[0] + c[1]) / 2) * u };
}

/**
 * Outline of a patch on hills or mountains (relative to the tile center; `rx`, `ry`: its plains
 * size, `fp`: the building's footprint): the front follows the terrace bank the terrain draws
 * along the front of the footprint (the bank hides that edge); back and sides are smaller than
 * on plains, ragged (three waves of phase `phase`), grown by `grow` for the soft fade.
 */
export function slopeOutline(
  rx: number,
  ry: number,
  fp: { rx: number; ry: number },
  grow: number,
  phase: readonly number[],
): Point[] {
  const S = G.slope;
  const n = 32;
  const from = ((1 - S.frontSpan) / 2) * Math.PI;
  const to = from + S.frontSpan * Math.PI;
  const fade = S.frontFade * Math.PI;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const ellipse = (ax: number, ay: number): number =>
      1 / Math.sqrt((cos / ax) ** 2 + (sin / ay) ** 2);
    const ragged =
      1 +
      S.wobble *
        (0.5 * Math.sin(3 * t + phase[0]) +
          0.3 * Math.sin(5 * t + phase[1]) +
          0.2 * Math.sin(9 * t + phase[2]));
    const back = ellipse(rx * S.scale, ry * S.scale) * ragged * grow;
    const front = ellipse(fp.rx, fp.ry) * S.bankShare;
    // 1 along the bank, fading to 0 beside it (the bank only spans the middle of the front)
    const d = t < from ? from - t : t > to ? t - to : 0;
    const k = Math.max(0, 1 - d / fade);
    const w = t <= Math.PI + fade ? k * k * (3 - 2 * k) : 0;
    const r = back * (1 - w) + front * w;
    pts.push({ x: cos * r, y: sin * r });
  }
  return pts;
}

/**
 * Same shape as `TileFootprint` in terrainLayer.ts: an ellipse around the tile center, plus
 * what it belongs to (terrainArt.ts `FootprintKind`; absent = 'building') and, optionally, how far
 * the ellipse's center lies from the tile center (`cx`, `cy`, world px; absent = 0).
 */
export interface GroundFootprint {
  hex: Hex;
  rx: number;
  ry: number;
  kind?: FootprintKind;
  cx?: number;
  cy?: number;
}

/**
 * Footprint kind of a building: a mine or quarry on hills / mountains cuts into the slope; a
 * field on hills lies on top of the slopes (the terrain keeps its rolling mounds there, no
 * terrace, and only clears its shrubs, rocks and trees).
 */
export function footprintKindOf(type: BuildingId, terrain: string | undefined): FootprintKind {
  const slope = terrain === 'hills' || terrain === 'mountains';
  if (slope && type === 'mine') return 'mineCut';
  if (slope && type === 'quarry') return 'quarryCut';
  if (terrain === 'hills' && isFieldKind(GROUND_KIND[type])) return 'field';
  return 'building';
}

/**
 * Ellipse (world px) the terrain keeps free of its trees, rocks and decals: fields nearly the
 * whole tile (a few tufts and flowers stay by the corners, near the soft rim), a woodcutter's clearing a small one (the forest stays around it), else about the patch
 * (its soft edge may run over grass tufts and flowers).
 */
export function footprintOf(type: BuildingId, size: number): { rx: number; ry: number } {
  const kind = GROUND_KIND[type];
  if (isFieldKind(kind)) return { rx: G.field.footprint * size, ry: G.field.footprint * size };
  if (kind === 'clearing') {
    return { rx: G.clearing.footprintRx * size, ry: G.clearing.footprintRy * size };
  }
  const { rx, ry } = patchRadii(type, size);
  // An ellipse around the tile center that still covers a patch that is off center
  const o = patchCenter(type, size);
  return { rx: rx * G.footprintGrow + Math.abs(o.x), ry: ry * G.footprintGrow + Math.abs(o.y) };
}

/**
 * Footprints of every building `viewer` may see (the same filter as the building art).
 * A fishery's footprint also covers its yard, which is shifted toward the water, and the water
 * tile its jetty reaches into is cleared too, so no sailboat lies under the drawn jetty.
 */
export function groundFootprints(
  state: GameState,
  viewer: PlayerId,
  revealAll: boolean,
  size: number,
): GroundFootprint[] {
  const out: GroundFootprint[] = [];
  const shown = buildingsShownTo(state, viewer, revealAll);
  const towns = townTiles(state.map, shown, state.roads, state.territory);
  // Road tiles inside a town lie on the town ground too
  const built = new Set(shown.map((b) => tileIndex(state.map, b.hex)));
  for (const i of towns.keys()) {
    if (built.has(i)) continue;
    const r = G.town.footprint * size;
    out.push({ hex: hexAtIndex(state.map, i), rx: r, ry: r });
  }
  for (const b of shown) {
    if (towns.has(tileIndex(state.map, b.hex))) {
      // A tile of a town area: the town ground covers most of it
      const r = G.town.footprint * size;
      out.push({ hex: b.hex, rx: r, ry: r });
      continue;
    }
    const fp = footprintOf(b.type, size);
    const shore = GROUND_KIND[b.type];
    if (shore !== 'fishery' && shore !== 'harbor') {
      const kind = footprintKindOf(b.type, state.map.tiles[tileIndex(state.map, b.hex)]);
      if (kind === 'mineCut') {
        // The mine stands at the mountain's outer foot, bigger (relief.ts mineArtTransform)
        const t = mineArtTransform(size);
        out.push({ hex: b.hex, rx: fp.rx * t.scale, ry: fp.ry * t.scale, kind, cx: t.x, cy: t.y });
        continue;
      }
      out.push(kind === 'building' ? { hex: b.hex, ...fp } : { hex: b.hex, ...fp, kind });
      continue;
    }
    // Only the yard, around its shifted center: the terrain's grass and flowers stay on the rest
    const e = jettyEdge(state.map, b.hex);
    const shift = fisheryYardOffset(e, size, shore);
    const { rx, ry } = patchRadii(b.type, size);
    const k = shoreConfig(shore).footprintGrow;
    out.push({ hex: b.hex, rx: rx * k, ry: ry * k, cx: shift.x, cy: shift.y });
    if (e !== null) out.push({ hex: edgeNeighborHex(b.hex, e), rx: size, ry: size });
  }
  return out;
}

/**
 * The units `viewer` may see: its own, and others only on tiles it sees right now (`revealAll`:
 * all). The unit sprites and the unit footprints use exactly this filter, so the terrain never
 * makes room for a unit the viewer cannot see. `visible`: the viewer's visible tiles, if known.
 */
export function unitsShownTo(
  state: GameState,
  viewer: PlayerId,
  revealAll: boolean,
  visible: readonly boolean[] | null = revealAll ? null : visibleTiles(state, viewer),
): Unit[] {
  // Passengers are never drawn as figures: they ride on their ship
  const onMap = state.units.filter((u) => u.aboard === null);
  if (revealAll || visible === null) return onMap;
  return onMap.filter((u) => u.owner === viewer || visible[tileIndex(state.map, u.hex)] === true);
}

/**
 * How many passengers the badge on a ship's token shows: only for the viewer's own ships that
 * carry somebody (cargo is not visible to others); null = no badge.
 */
export function cargoBadgeCount(state: GameState, ship: Unit, viewer: PlayerId): number | null {
  if (ship.owner !== viewer || UNITS[ship.type].capacity <= 0) return null;
  const n = state.units.filter((u) => u.aboard === ship.id).length;
  return n > 0 ? n : null;
}

/**
 * Small footprints under the tokens of the units `viewer` may see (trees, shrubs and rocks make
 * room there), one per tile, only on tiles without a shown building (its footprint covers them).
 */
export function unitFootprints(
  state: GameState,
  viewer: PlayerId,
  revealAll: boolean,
  size: number,
  visible?: readonly boolean[] | null,
): GroundFootprint[] {
  const buildings = new Set<number>();
  for (const b of buildingsShownTo(state, viewer, revealAll)) {
    buildings.add(tileIndex(state.map, b.hex));
  }
  const done = new Set<number>();
  const out: GroundFootprint[] = [];
  for (const u of unitsShownTo(state, viewer, revealAll, visible)) {
    const i = tileIndex(state.map, u.hex);
    // Ships sail on water: nothing grows there, so they leave no footprint
    if (i < 0 || buildings.has(i) || done.has(i) || UNITS[u.type].domain === 'sea') continue;
    done.add(i);
    out.push({
      hex: u.hex,
      rx: G.unitFootprint.rx * size,
      ry: G.unitFootprint.ry * size,
      kind: 'unit',
    });
  }
  return out;
}

/** Cheap key of a footprint list (same key -> the terrain needs no repaint). */
export function footprintSignature(list: readonly GroundFootprint[]): string {
  return list
    .map(
      (f) =>
        `${f.hex.q}.${f.hex.r}.${f.rx.toFixed(2)}.${f.ry.toFixed(2)}.${f.kind ?? ''}.${(f.cx ?? 0).toFixed(1)}.${(f.cy ?? 0).toFixed(1)}`,
    )
    .join(',');
}

// ---------------------------------------------------------------------------------------------
// Hill relief under fields (fields on hills lie on top of the slopes, docs/ART.md)
// ---------------------------------------------------------------------------------------------

/** The rolling mounds of the terrain's hills (relief.ts), per map (they never change). */
const moundCache = new WeakMap<MapState, Map<number, HillMound[]>>();

/**
 * The terrain's hill mounds near one tile (world px), as relief.ts lays them out. Used to drape
 * vine rows over the slopes and to shade them like the mounds; near the shore the terrain may
 * leave out a mound this keeps, which only changes the shading slightly.
 */
export function moundsNear(map: MapState, h: Hex, size: number): HillMound[] {
  let byTile = moundCache.get(map);
  if (!byTile) {
    byTile = new Map();
    const shoreDist = (p: Point): number => {
      const hex = pixelToHex(p, size);
      const c = hexToPixel(hex, size);
      return distanceToEdges({ x: p.x - c.x, y: p.y - c.y }, shoreMask(map, hex), size);
    };
    const mounds = hillMounds(map, size, shoreDist);
    for (const m of mounds) {
      // Index every mound by the tiles its body touches
      for (const q of [
        { x: m.x - m.w, y: m.y },
        { x: m.x + m.w, y: m.y },
        { x: m.x, y: m.y - m.h },
        { x: m.x, y: m.y },
        { x: m.x, y: m.y + m.w * 0.4 },
      ]) {
        const i = tileIndex(map, pixelToHex(q, size));
        if (i < 0) continue;
        const list = byTile.get(i);
        if (!list) byTile.set(i, [m]);
        else if (!list.includes(m)) list.push(m);
      }
    }
    moundCache.set(map, byTile);
  }
  return byTile.get(tileIndex(map, h)) ?? [];
}

/**
 * Height of the hill surface at a world point (px; 0 off the mounds): a soft bump over every
 * mound's body (from its crest to the front of its base).
 */
export function hillHeight(mounds: readonly HillMound[], p: Point): number {
  let best = 0;
  for (const m of mounds) {
    const d = m.w * 0.34;
    const cy = m.y + (d - m.h) / 2;
    const ry = (m.h + d) / 2;
    const u = (p.x - m.x) / m.w;
    const v = (p.y - cy) / ry;
    const r2 = u * u + v * v;
    if (r2 >= 1) continue;
    best = Math.max(best, m.h * (1 - r2) ** 1.2);
  }
  return best;
}

/**
 * Light on the hill surface at a world point, -1 (shaded) .. 1 (lit), like the mounds: light
 * from the upper left, so a slope rising to the right (the left flank) is lit.
 */
export function hillLight(mounds: readonly HillMound[], p: Point, size: number): number {
  const dx = 0.08 * size;
  const slope =
    (hillHeight(mounds, { x: p.x + dx, y: p.y }) - hillHeight(mounds, { x: p.x - dx, y: p.y })) /
    (2 * dx);
  return Math.max(-1, Math.min(1, slope * 2.2));
}

/**
 * A hill mound as it shows through a field on hills: its body cut to the field (`poly`,
 * relative to the tile center), the bounds of the WHOLE body (world px: its shading texture is
 * laid over these, so the parts in neighboring fields and on the bare hill line up) and the part
 * of its sunlit crest inside the field (`crest`, relative; may be empty).
 */
export interface FieldMound {
  poly: Point[];
  bounds: { x: number; y: number; w: number; h: number };
  crest: Point[];
  /** Mound height (px), for the crest width. */
  h: number;
}

/**
 * The mounds near a field cut to its crop area: `inset` / `overlap` as for the parcels (see
 * `cropInset`); mounds outside the field are left out.
 */
export function fieldMounds(
  mounds: readonly HillMound[],
  center: Point,
  outline: readonly OutlineSample[],
  inset: number,
  overlap: number,
): FieldMound[] {
  const out: FieldMound[] = [];
  const back = { x: -center.x, y: -center.y };
  for (const m of mounds) {
    const body = moundOutline(m);
    const xs = body.map((q) => q.x);
    const ys = body.map((q) => q.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const rel = translate(body, back);
    const poly = dedupe(clampToOutline(densify(rel, 2.5, true), outline, inset, overlap), 0.4);
    if (poly.length < 3 || polygonArea(poly) < 1) continue;
    // The sunlit rim along the upper left of the crest (as the terrain draws it)
    const crest = longestRun(densify(rel.slice(1, 8), 2.5, false), (q) =>
      insideOutline(q, outline, Math.max(0, inset)),
    );
    out.push({
      poly,
      bounds: { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 },
      crest: crest.length >= 2 ? crest : [],
      h: m.h,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plain 2D geometry (points relative to the tile center unless a function says otherwise)
// ---------------------------------------------------------------------------------------------

/** Isometric ground axes of the art on screen (unit vectors): A down-right, B down-left (slope ±0.5). */
export const ISO_A: Point = { x: 2 / Math.sqrt(5), y: 1 / Math.sqrt(5) };
export const ISO_B: Point = { x: -2 / Math.sqrt(5), y: 1 / Math.sqrt(5) };

/** Outward normal of edge `e` (edge 0 faces east, then clockwise in 60° steps, y down). */
export function edgeNormal(e: number): Point {
  const a = (Math.PI / 3) * e;
  return { x: Math.cos(a), y: Math.sin(a) };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function translate(points: readonly Point[], c: Point): Point[] {
  return points.map((p) => ({ x: p.x + c.x, y: p.y + c.y }));
}

export function scalePoints(
  points: readonly Point[],
  f: number,
  c: Point = { x: 0, y: 0 },
): Point[] {
  return points.map((p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f }));
}

/** Flat [x0, y0, x1, y1, ...] for PixiJS. */
export function flatPoints(points: readonly Point[]): number[] {
  const out: number[] = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}

/**
 * An organic, egg-like outline (no perfect ellipse): the radius wobbles by up to `wobble` with
 * three smooth waves of random phase, so the outline stays soft, never jagged.
 */
export function organicBlob(
  rx: number,
  ry: number,
  rng: () => number,
  wobble: number,
  segments = 20,
): Point[] {
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    const f =
      1 +
      wobble *
        (0.55 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.15 * Math.sin(5 * a + p3));
    pts.push({ x: Math.cos(a) * rx * f, y: Math.sin(a) * ry * f });
  }
  return pts;
}

/**
 * How far (world px, along each edge normal) ground may reach from the tile center: up to
 * `margin` px inside a land edge or the map border, `shoreMargin` px inside a water edge (so the
 * beach stays visible) and right up to the edge where `open[e]` is set (fields joining).
 */
export function edgeLimits(
  map: MapState,
  h: Hex,
  size: number,
  margin: number,
  shoreMargin: number,
  open: readonly boolean[] = [false, false, false, false, false, false],
): number[] {
  const a = apothem(size);
  const here = map.tiles[tileIndex(map, h)];
  const landHere = here !== undefined && !isWater(here);
  const limits: number[] = [];
  for (let e = 0; e < 6; e++) {
    if (open[e]) {
      limits.push(a);
      continue;
    }
    const n = tileIndex(map, edgeNeighborHex(h, e));
    const water = n >= 0 && landHere && isWater(map.tiles[n]);
    limits.push(a - (water ? shoreMargin : margin));
  }
  return limits;
}

/** Pulls every point toward the center until it respects all six edge limits. */
export function clampToLimits(points: readonly Point[], limits: readonly number[]): Point[] {
  return points.map((p) => {
    let f = 1;
    for (let e = 0; e < 6; e++) {
      const d = dot(p, edgeNormal(e));
      if (d > limits[e]) f = Math.min(f, limits[e] / d);
    }
    return { x: p.x * f, y: p.y * f };
  });
}

/** True when the point respects all six edge limits (with `pad` px to spare). */
export function withinLimits(p: Point, limits: readonly number[], pad = 0): boolean {
  for (let e = 0; e < 6; e++) if (dot(p, edgeNormal(e)) > limits[e] - pad) return false;
  return true;
}

/** Part of a convex polygon with dot(p, n) <= c (Sutherland–Hodgman against one line). */
export function clipHalfPlane(poly: readonly Point[], n: Point, c: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = dot(a, n) - c;
    const db = dot(b, n) - c;
    if (da <= 0) out.push(a);
    if (da < 0 !== db < 0 && da !== db) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Signed area (positive = clockwise on screen, y down). */
function signedArea(poly: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(poly: readonly Point[]): number {
  return Math.abs(signedArea(poly));
}

/** Part of the segment a-b inside a convex polygon (any winding), or null (Cyrus–Beck). */
export function clipSegment(a: Point, b: Point, poly: readonly Point[]): [Point, Point] | null {
  if (poly.length < 3) return null;
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    // Inward normal of edge p-q
    const n = { x: -(q.y - p.y) * sign, y: (q.x - p.x) * sign };
    const num = dot({ x: a.x - p.x, y: a.y - p.y }, n);
    const den = dot(d, n);
    if (den === 0) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const at = (t: number): Point => ({ x: a.x + d.x * t, y: a.y + d.y * t });
  return [at(t0), at(t1)];
}

/** Is the point inside a convex polygon (any winding), at least `pad` px from its edges? */
export function insideConvex(p: Point, poly: readonly Point[], pad = 0): boolean {
  if (poly.length < 3) return false;
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const cross = ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * sign;
    if (cross / len < pad) return false;
  }
  return true;
}

/**
 * Parallel lines along `dir` (unit vector), `spacing` px apart (shifted by `offset`), clipped to
 * a convex polygon: furrows, vine rows, flagstone joints.
 */
export function parallelLines(
  poly: readonly Point[],
  dir: Point,
  spacing: number,
  offset = 0,
): [Point, Point][] {
  if (poly.length < 3 || spacing <= 0) return [];
  const perp = { x: -dir.y, y: dir.x };
  let lo = Infinity;
  let hi = -Infinity;
  let along = 0;
  for (const p of poly) {
    const d = dot(p, perp);
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
    along = Math.max(along, Math.abs(dot(p, dir)));
  }
  const reach = along + 1;
  const lines: [Point, Point][] = [];
  for (let k = Math.ceil((lo - offset) / spacing); offset + k * spacing <= hi; k++) {
    const d = offset + k * spacing;
    const c = { x: perp.x * d, y: perp.y * d };
    const seg = clipSegment(
      { x: c.x - dir.x * reach, y: c.y - dir.y * reach },
      { x: c.x + dir.x * reach, y: c.y + dir.y * reach },
      poly,
    );
    if (seg) lines.push(seg);
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Fields: an organic outline instead of the hex, parcels in a gently warped iso grid
// ---------------------------------------------------------------------------------------------

/** Outline samples per hex edge (6 x this around the tile). */
export const OUTLINE_SAMPLES_PER_EDGE = 8;

/** One point of a field's outline, seen from the tile center. */
export interface OutlineSample {
  /** Angle from the tile center (radians, screen y down). */
  angle: number;
  /** Distance from the tile center (world px). */
  r: number;
  /**
   * 1 toward a neighbor without a field (soft rim), 0 toward a joined field (shared boundary),
   * in between close to a corner where the two meet.
   */
  open: number;
  /** Edge whose sector the sample lies in (0 = east, clockwise). */
  edge: number;
}

/** Normalizes an angle to (-PI, PI]. */
function wrapAngle(t: number): number {
  let x = t % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x <= -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * Organic outline of a field tile (star-shaped around the tile center): it never follows a
 * straight hex edge.
 * - Toward a neighbor without a field it runs inside the edge by a varying amount (jittered,
 *   bowed between rounded corners; further in toward water, so the beach stays visible).
 * - Toward a joined field it follows a wavy boundary shared with that neighbor, offset from the
 *   hex edge (computed from both tiles' indices, so both fields meet on the same line).
 * Corners blend smoothly between the two edges' rules.
 */
export function fieldOutline(
  map: MapState,
  h: Hex,
  size: number,
  joined: readonly boolean[],
): OutlineSample[] {
  const F = G.field;
  const a = apothem(size);
  const here = tileIndex(map, h);
  const hereTerrain = map.tiles[here];
  const land = hereTerrain !== undefined && !isWater(hereTerrain);
  const phase = [0, 1, 2, 3].map((k) => tileHash(h.q, h.r, 150 + k) * Math.PI * 2);
  // Smooth wobble around the tile, in [-1, 1] (integer frequencies: closes up seamlessly)
  const noise = (t: number): number =>
    0.45 * Math.sin(3 * t + phase[0]) +
    0.3 * Math.sin(5 * t + phase[1]) +
    0.17 * Math.sin(8 * t + phase[2]) +
    0.08 * Math.sin(13 * t + phase[3]);
  const neighbor = [0, 1, 2, 3, 4, 5].map((e) => tileIndex(map, edgeNeighborHex(h, e)));
  const inset = neighbor.map(
    (n) => (n >= 0 && land && isWater(map.tiles[n]) ? G.shoreMargin : F.inset) * size,
  );
  // Each open edge bows out in its middle (never ~0); with the rounded corners the field gets
  // a soft, convex shape, the noise makes it irregular
  // (not toward water: the beach stays visible)
  const bulge = neighbor.map((n, e) =>
    n >= 0 && land && isWater(map.tiles[n])
      ? 0
      : -(0.4 + 0.6 * tileHash(h.q, h.r, 196 + e)) * F.edgeBulge * size,
  );
  /** Distance of the outline along angle `t` under the rule of edge `e` (`d`: hex boundary). */
  const radiusOf = (e: number, t: number, d: number): number => {
    if (!joined[e]) {
      // Between hex (0) and circle (1): bowed edges, rounded corners; minus a jittered inset
      const phi = wrapAngle(t - (Math.PI / 3) * e);
      const u = Math.max(0, Math.min(1, 0.5 + (a * Math.tan(phi)) / size));
      const round = d * (1 - F.roundness) + a * F.roundness;
      const r =
        round - inset[e] - bulge[e] * Math.sin(Math.PI * u) - noise(t) * F.insetJitter * size;
      // Never on or past the hex edge itself
      return Math.min(r, d - F.minInset * size);
    }
    const n = neighbor[e];
    const lo = Math.min(here, n);
    const hi = Math.max(here, n);
    const phi = wrapAngle(t - (Math.PI / 3) * e);
    // Position along the edge: 0 at corner e, 1 at corner e + 1; the other tile runs the other way
    const u = Math.max(0, Math.min(1, 0.5 + (a * Math.tan(phi)) / size));
    const uc = here === lo ? u : 1 - u;
    const w0 = tileHash(lo, hi, 161) * Math.PI * 2;
    const w1 = tileHash(lo, hi, 162) * Math.PI * 2;
    const base = (tileHash(lo, hi, 160) - 0.5) * 2 * F.joinOffset * size;
    const wave =
      F.joinWave *
      size *
      (0.6 * Math.sin(Math.PI * 3 * uc + w0) + 0.4 * Math.sin(Math.PI * 5 * uc + w1));
    // Offset from the hex edge toward the higher tile index; it fades out at the corners
    const off = (base + wave) * Math.sin(Math.PI * uc) ** 0.7;
    return a / Math.cos(phi) + (here === lo ? off : -off) / Math.cos(phi);
  };
  const N = OUTLINE_SAMPLES_PER_EDGE;
  const step = Math.PI / 3 / N;
  const blend = (F.cornerBlend * Math.PI) / 180;
  const out: OutlineSample[] = [];
  for (let i = 0; i < 6 * N; i++) {
    const angle = -Math.PI / 6 + (i + 0.5) * step;
    const e = Math.floor(i / N);
    const phi = angle - (Math.PI / 3) * e;
    const d = a / Math.cos(phi);
    let r = radiusOf(e, angle, d);
    let open = joined[e] ? 0 : 1;
    const toCorner = Math.PI / 6 - Math.abs(phi);
    if (toCorner < blend) {
      const e2 = (e + (phi > 0 ? 1 : 5)) % 6;
      const k = 0.5 * (1 - toCorner / blend);
      r = r * (1 - k) + radiusOf(e2, angle, d) * k;
      open = open * (1 - k) + (joined[e2] ? 0 : 1) * k;
    }
    out.push({ angle, r: Math.max(0.45 * a, r), open, edge: e });
  }
  return out;
}

/** Interpolates a property of the outline at any angle (linear between the samples). */
function outlineAt(outline: readonly OutlineSample[], angle: number, key: 'r' | 'open'): number {
  const n = outline.length;
  const step = (Math.PI * 2) / n;
  let x = (angle - outline[0].angle) / step;
  x = ((x % n) + n) % n;
  const i = Math.floor(x);
  const t = x - i;
  return outline[i][key] * (1 - t) + outline[(i + 1) % n][key] * t;
}

/** Distance of the outline at any angle (linear between the samples). */
export function outlineRadius(outline: readonly OutlineSample[], angle: number): number {
  return outlineAt(outline, angle, 'r');
}

/** How open the outline is at any angle (1 = soft rim, 0 = shared with a joined field). */
export function outlineOpen(outline: readonly OutlineSample[], angle: number): number {
  return outlineAt(outline, angle, 'open');
}

/**
 * How far inside the outline crops stop at a point of it: `inset` px on the open rim, and
 * `overlap` px PAST the shared boundary of joined fields (both fields' crops meet there with no
 * gap; a balk may be drawn on top).
 */
export function cropInset(open: number, inset: number, overlap: number): number {
  return inset * open - overlap * (1 - open);
}

/** The outline as points (relative to the tile center), `grow` px further out. */
export function outlinePoint(s: OutlineSample, grow = 0): Point {
  return { x: Math.cos(s.angle) * (s.r + grow), y: Math.sin(s.angle) * (s.r + grow) };
}

/**
 * Pulls points toward the tile center until they lie `inset` px inside the outline (with
 * `overlap`: the crop inset, see `cropInset`, that depends on how open the outline is there).
 */
export function clampToOutline(
  points: readonly Point[],
  outline: readonly OutlineSample[],
  inset = 0,
  overlap: number | null = null,
): Point[] {
  return points.map((p) => {
    const d = Math.hypot(p.x, p.y);
    if (d === 0) return p;
    const angle = Math.atan2(p.y, p.x);
    const k = overlap === null ? inset : cropInset(outlineOpen(outline, angle), inset, overlap);
    const limit = outlineRadius(outline, angle) - k;
    return d > limit ? { x: (p.x * limit) / d, y: (p.y * limit) / d } : p;
  });
}

/** Is the point (relative) at least `inset` px inside the outline? */
export function insideOutline(p: Point, outline: readonly OutlineSample[], inset = 0): boolean {
  return Math.hypot(p.x, p.y) <= outlineRadius(outline, Math.atan2(p.y, p.x)) - inset;
}

/** Points along a line or polygon, no more than `step` px apart (keeps the given corners). */
export function densify(points: readonly Point[], step: number, closed: boolean): Point[] {
  const out: Point[] = [];
  const n = points.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let j = 0; j < k; j++) {
      out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
    }
  }
  if (!closed && n > 0) out.push(points[n - 1]);
  return out;
}

/** The longest run of consecutive points that pass `keep` (a furrow trimmed to the field). */
export function longestRun(points: readonly Point[], keep: (p: Point) => boolean): Point[] {
  let best: Point[] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (keep(p)) {
      run.push(p);
      if (run.length > best.length) best = run;
    } else run = [];
  }
  return best;
}

/** Screen point of iso coordinates: `a` along the art's down-right axis, `b` along down-left. */
export function isoPoint(a: number, b: number): Point {
  return { x: a - b, y: (a + b) / 2 };
}

/** Outer bounds of the field cells (iso units, share of the hex size): well past the tile. */
export const FIELD_CELL_REACH = 1.5;

/** One parcel of a field as a cell of the iso grid (before warping and trimming). */
export interface FieldCell {
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  /** Direction of its furrows / rows (ISO_A or ISO_B). */
  dir: Point;
}

/**
 * How a field tile is cut into parcels:
 * - 'farmstead' (farm, vineyard): an orderly 3-5 parcels around the building in the middle; the
 *   cut lines run through the farmstead, so the fields begin right at its yard (back, left,
 *   right and front parcel, sometimes the front one split once more, or two of them as one).
 * - 'free' (olive grove): 2-4 parcels with cut lines anywhere near the middle.
 */
export type FieldLayout = 'farmstead' | 'free';

/**
 * Cuts the tile's field area into parcels along the iso ground axes, `gap` px balks between
 * them. The cells reach far past the tile; the outline trims them.
 */
export function fieldCells(
  rng: () => number,
  size: number,
  gap: number,
  layout: FieldLayout = 'free',
): FieldCell[] {
  const big = FIELD_CELL_REACH * size;
  // A line a = const is 1 / |grad a| = 1 / 1.118 px per iso unit away from the next one
  const h = (gap * Math.hypot(1, 0.5)) / 2;
  type Range = [number, number];
  const full: Range = [-big, big];
  if (layout === 'farmstead') {
    const F = G.field;
    const cutA = (rng() - 0.5) * 2 * F.farmsteadJitter * size;
    const cutB = (rng() - 0.5) * 2 * F.farmsteadJitter * size;
    const lowA: Range = [-big, cutA - h];
    const highA: Range = [cutA + h, big];
    const lowB: Range = [-big, cutB - h];
    const highB: Range = [cutB + h, big];
    const k = rng();
    // Quadrants around the farmstead: back (a, b < cut), left, right, front (a, b > cut)
    const quads: [Range, Range][] = [
      [lowA, lowB],
      [lowA, highB],
      [highA, lowB],
      [highA, highB],
    ];
    let cells: [Range, Range][];
    if (k < F.farmsteadThree) {
      // Three: the back and one side parcel are one
      cells = rng() < 0.5 ? [[lowA, full], quads[2], quads[3]] : [[full, lowB], quads[1], quads[3]];
    } else if (k < F.farmsteadThree + F.farmsteadFive) {
      // Five: the front parcel is split once more, further out
      const split = cutA + F.farmsteadOuterCut * size;
      cells = [
        quads[0],
        quads[1],
        quads[2],
        [[cutA + h, split - h], highB],
        [[split + h, big], highB],
      ];
    } else cells = quads;
    const flip = rng() < 0.5;
    // Neighboring parcels get different furrow directions
    return cells.map(([[a0, a1], [b0, b1]], i) => ({
      a0,
      a1,
      b0,
      b1,
      dir: (i === 0 || i === 3) !== flip ? ISO_A : ISO_B,
    }));
  }
  const cutA = (rng() - 0.5) * 0.3 * size;
  const cutB = (rng() - 0.5) * 0.3 * size;
  const count = 2 + Math.floor(rng() * 3);
  const lowA: Range = [-big, cutA - h];
  const highA: Range = [cutA + h, big];
  const lowB: Range = [-big, cutB - h];
  const highB: Range = [cutB + h, big];
  const cells: [Range, Range][] = [];
  if (count === 2) {
    if (rng() < 0.5) cells.push([lowA, full], [highA, full]);
    else cells.push([full, lowB], [full, highB]);
  } else if (count === 3) {
    if (rng() < 0.5) cells.push([lowA, lowB], [lowA, highB], [highA, full]);
    else cells.push([lowA, full], [highA, lowB], [highA, highB]);
  } else cells.push([lowA, lowB], [lowA, highB], [highA, lowB], [highA, highB]);
  const flip = rng() < 0.5;
  return cells.map(([[a0, a1], [b0, b1]], i) => ({
    a0,
    a1,
    b0,
    b1,
    dir: (i % 2 === 0) !== flip ? ISO_A : ISO_B,
  }));
}

/**
 * Part of a polygon (e.g. the field outline) inside a cell: clipped against the cell's four sides
 * (a = a0, a = a1, b = b0, b = b1; sides at the far bounds are skipped). Works for any polygon,
 * because the cell is convex (Sutherland-Hodgman).
 */
export function clipToCell(poly: readonly Point[], cell: FieldCell, far: number): Point[] {
  // a = y + x / 2 and b = y - x / 2, so their gradients are (0.5, 1) and (-0.5, 1)
  let out: Point[] = [...poly];
  if (cell.a1 < far) out = clipHalfPlane(out, { x: 0.5, y: 1 }, cell.a1);
  if (cell.a0 > -far) out = clipHalfPlane(out, { x: -0.5, y: -1 }, -cell.a0);
  if (cell.b1 < far) out = clipHalfPlane(out, { x: -0.5, y: 1 }, cell.b1);
  if (cell.b0 > -far) out = clipHalfPlane(out, { x: 0.5, y: -1 }, -cell.b0);
  return out;
}

/** Drops points closer than `min` px to the previous one (cleaner polygons to triangulate). */
export function dedupe(points: readonly Point[], min: number): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) >= min) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < min) out.pop();
  return out;
}

/** Corners of a cell on the screen (relative): a parallelogram along the iso axes. */
export function cellCorners(c: FieldCell): Point[] {
  return [isoPoint(c.a0, c.b0), isoPoint(c.a1, c.b0), isoPoint(c.a1, c.b1), isoPoint(c.a0, c.b1)];
}

/**
 * A smooth, gentle displacement of one field tile: parcel edges and furrows bow a little and
 * the corners shift, so the grid does not look stamped. Deterministic per tile.
 */
export function fieldWarp(h: Hex, size: number): (p: Point) => Point {
  const amp = G.field.warp * size;
  const k = (Math.PI * 2) / (2.6 * size);
  const p1 = tileHash(h.q, h.r, 170) * Math.PI * 2;
  const p2 = tileHash(h.q, h.r, 171) * Math.PI * 2;
  const t1 = 0.6 + tileHash(h.q, h.r, 172) * 0.8;
  const t2 = 0.6 + tileHash(h.q, h.r, 173) * 0.8;
  return (p) => ({
    x: p.x + amp * Math.sin((p.y * t1 + p.x * 0.4) * k + p1),
    y: p.y + amp * 0.6 * Math.sin((p.x * t2 - p.y * 0.3) * k + p2),
  });
}

/**
 * Screen offset of "sideways on the ground" for a direction on screen: the art's ground plane is
 * squashed 2:1, so the perpendicular is taken in the unsquashed plan and squashed back. Returns
 * a vector of plan length 1 (on screen: as long as 1 px of ground width looks), pointing to the
 * front (y >= 0) so things placed on that side stay visible.
 */
export function groundSide(dir: Point): Point {
  const px = dir.x;
  const py = dir.y * 2;
  const len = Math.hypot(px, py) || 1;
  let side = { x: -py / len, y: px / len / 2 };
  if (side.y < 0 || (side.y === 0 && side.x < 0)) side = { x: -side.x, y: -side.y };
  return side;
}

// ---------------------------------------------------------------------------------------------
// Map-level decisions
// ---------------------------------------------------------------------------------------------

/**
 * Preference per edge for the fishery's jetty (E, SE, SW, W, NW, NE): lower and side edges first,
 * so the jetty is not hidden behind the hut. Ties are broken by the order in `JETTY_EDGE_ORDER`.
 */
const JETTY_EDGE_PREFERENCE: readonly number[] = [1, 2, 2, 1, 0, 0];
const JETTY_EDGE_ORDER: readonly number[] = [1, 2, 0, 3, 5, 4];

/**
 * The edge of `h` the fishery's jetty crosses: a coastal-water neighbor (any water if there is no
 * coast), preferring lower/side edges and open water (water on both neighboring edges too).
 * null when the tile has no water neighbor. It picks the drawn scene's direction version
 * (`fishery.e<edge>.svg`), the yard's shift and the water tile kept free of terrain boats.
 */
export function jettyEdge(map: MapState, h: Hex): number | null {
  const terrain = (e: number) => {
    const n = tileIndex(map, edgeNeighborHex(h, e));
    return n >= 0 ? map.tiles[n] : undefined;
  };
  const water = [0, 1, 2, 3, 4, 5].map((e) => {
    const t = terrain(e);
    return t !== undefined && isWater(t);
  });
  const coast = [0, 1, 2, 3, 4, 5].map((e) => terrain(e) === 'coast');
  const candidates = coast.some(Boolean) ? coast : water;
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const e of JETTY_EDGE_ORDER) {
    if (!candidates[e]) continue;
    const open = (water[(e + 5) % 6] ? 1 : 0) + (water[(e + 1) % 6] ? 1 : 0);
    const score = JETTY_EDGE_PREFERENCE[e] + 0.75 * open;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

/** Theme block of a shore building's yard (the harbor's own numbers, else the fishery's). */
export function shoreConfig(kind: 'fishery' | 'harbor'): typeof G.fishery | typeof G.harbor {
  return kind === 'harbor' ? G.harbor : G.fishery;
}

/**
 * Center of the fishery's (or harbor's) sandy yard, relative to the tile center: `yardShift` x apothem along
 * the normal of its jetty edge, under the hut of the drawn scene. The tile center without water.
 */
export function fisheryYardOffset(
  edge: number | null,
  size: number,
  kind: 'fishery' | 'harbor' = 'fishery',
): Point {
  if (edge === null) return { x: 0, y: 0 };
  const n = edgeNormal(edge);
  const d = shoreConfig(kind).yardShift * apothem(size);
  return { x: n.x * d, y: n.y * d };
}

/** Tile indices of the shown field buildings (farm, vineyard, olive grove). */
export function fieldTiles(map: MapState, shown: readonly Building[]): Map<number, GroundKind> {
  const out = new Map<number, GroundKind>();
  for (const b of shown) {
    const kind = GROUND_KIND[b.type];
    if (!isFieldKind(kind)) continue;
    const i = tileIndex(map, b.hex);
    if (i >= 0) out.set(i, kind);
  }
  return out;
}

/**
 * One boolean per edge: is the neighbor across it a field of the same kind (the fields join
 * there)? Different kinds of fields do not join: a grass strip, hedge or wall lies between them.
 */
export function fieldJoinMask(
  map: MapState,
  h: Hex,
  fields: ReadonlyMap<number, GroundKind>,
  kind: GroundKind,
): boolean[] {
  const mask: boolean[] = [];
  for (let e = 0; e < 6; e++) {
    const n = tileIndex(map, edgeNeighborHex(h, e));
    mask.push(n >= 0 && fields.get(n) === kind);
  }
  return mask;
}

/** Key of the shown buildings (id, type, tile, owner: town areas are per owner). */
export function groundSignature(shown: readonly Building[]): string {
  const parts: string[] = [];
  for (const b of shown) parts.push(`${b.id}.${b.type}.${b.hex.q}.${b.hex.r}.${b.owner}`);
  return parts.join(',');
}

/**
 * Cheap key of everything the ground depends on (same key -> no repaint): the shown buildings,
 * the town areas (`towns`, see townTiles; streets joining or leaving change them) and the road
 * tiles next to a town (no wall is drawn toward a road leading out of town).
 */
export function groundKey(
  map: MapState,
  shown: readonly Building[],
  towns: ReadonlyMap<number, number>,
  roads: readonly boolean[],
): string {
  const areas = [...towns].map(([i, area]) => `${i}:${area}`);
  const nearRoads = new Set<number>();
  for (const i of towns.keys()) {
    const h = hexAtIndex(map, i);
    for (let e = 0; e < 6; e++) {
      const n = tileIndex(map, edgeNeighborHex(h, e));
      if (n >= 0 && roads[n] && !towns.has(n)) nearRoads.add(n);
    }
  }
  const roadList = [...nearRoads].sort((a, b) => a - b);
  return `${groundSignature(shown)}|${areas.join(',')}|${roadList.join(',')}`;
}

/**
 * Picks well spots far enough apart: candidates (world px) in the given order, keeping one only
 * if no kept well lies within `minDistance`.
 */
export function spacedWells(candidates: readonly Point[], minDistance: number): Point[] {
  const kept: Point[] = [];
  for (const c of candidates) {
    if (kept.every((k) => Math.hypot(k.x - c.x, k.y - c.y) >= minDistance)) kept.push(c);
  }
  return kept;
}
