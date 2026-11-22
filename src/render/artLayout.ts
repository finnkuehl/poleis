// Pure helpers for the drawn SVG art (no PixiJS, easy to test): reading an SVG's canvas, where
// and how large a sprite is placed, how large the texture is rasterized, draw order and fallbacks.
import type { Hex, Point } from '../core/hex';
import { BUILDING_IDS, type BuildingId } from '../data/buildings';
import type { TerrainId } from '../data/terrain';
import { cameraConfig } from './config';
import { theme } from './theme';

export type ArtKind = 'building' | 'unit';

/** The SVG canvas (`viewBox`) in SVG units. */
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fixed canvas contract of the diorama art (docs/ART.md, "Canvas and anchor"), in SVG units:
 * canvas size, center of the base's top ellipse, width of that ellipse. The art files rely on it.
 */
export const ART_CANVAS: Readonly<
  Record<ArtKind, { size: number; baseX: number; baseY: number; baseWidth: number }>
> = {
  building: { size: 256, baseX: 128, baseY: 176, baseWidth: 208 },
  unit: { size: 128, baseX: 64, baseY: 96, baseWidth: 88 },
};

/** Where a sprite of the art goes: anchor on the tile point and world size. */
export interface ArtPlacement {
  /**
   * 'diorama': new art on the fixed canvas (or a larger canvas with a `data-anchor`), the anchor
   * (ground point under the building / the unit's token) sits on the tile center.
   * 'flat': older art on another canvas, centered on the colored plate / token.
   */
  style: 'diorama' | 'flat';
  /**
   * Longer side of the canvas relative to the fixed canvas of its kind (1 for the fixed canvas
   * and for flat art). The texture cap grows with it, so a larger canvas keeps the same detail.
   */
  canvasFactor: number;
  /** Sprite anchor as a share of the canvas (0..1). */
  anchorX: number;
  anchorY: number;
  /** World px per SVG unit. */
  scale: number;
  /** World size of the whole canvas. */
  width: number;
  height: number;
}

/** Width of a pointy-top hex (corner radius `hexSize`). */
export function hexWidth(hexSize: number): number {
  return Math.sqrt(3) * hexSize;
}

/** True if the canvas is the fixed diorama canvas of that kind (256 for buildings, 128 for units). */
export function isDioramaCanvas(kind: ArtKind, vb: ViewBox): boolean {
  const size = ART_CANVAS[kind].size;
  return vb.width === size && vb.height === size;
}

/**
 * `anchor`: the root tag's `data-anchor` (see `parseSvgAnchor`). With it, any canvas is diorama
 * art in the user units of the fixed canvas: the anchor point goes on the tile center and
 * 208 units (buildings) are 0.92 x the hex width, as on the fixed canvas. Such a canvas may be
 * larger than the fixed one and start at negative x / y (e.g. a fishery scene with its jetty).
 */
export function artPlacement(
  kind: ArtKind,
  vb: ViewBox,
  hexSize: number,
  anchor: Point | null = null,
): ArtPlacement {
  if (anchor || isDioramaCanvas(kind, vb)) {
    const c = ART_CANVAS[kind];
    const factor = kind === 'building' ? theme.buildingArtWidthFactor : theme.unitArtWidthFactor;
    const scale = (factor * hexWidth(hexSize)) / c.baseWidth;
    const ax = anchor ? anchor.x : c.baseX;
    const ay = anchor ? anchor.y : c.baseY;
    return {
      style: 'diorama',
      anchorX: (ax - vb.x) / vb.width,
      anchorY: (ay - vb.y) / vb.height,
      scale,
      width: vb.width * scale,
      height: vb.height * scale,
      canvasFactor: Math.max(vb.width, vb.height) / c.size,
    };
  }
  const radiusFactor = kind === 'building' ? theme.plateRadiusFactor : theme.unitRadiusFactor;
  const factor = kind === 'building' ? theme.buildingFlatArtFactor : theme.unitFlatArtFactor;
  const scale = (factor * 2 * radiusFactor * hexSize) / Math.max(vb.width, vb.height);
  return {
    style: 'flat',
    anchorX: 0.5,
    anchorY: 0.5,
    scale,
    width: vb.width * scale,
    height: vb.height * scale,
    canvasFactor: 1,
  };
}

/** An ellipse relative to the tile center (world px). */
export interface RingEllipse {
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Center line of a ring of `width` px on the ground around a building, `gap` px outside the
 * ring radius (theme.ground.ringRadius). Buildings stand directly on the map (no base, docs/ART.md
 * "Grounded buildings"), so the ring lies flat (2:1 like the art's ground) around the tile
 * center. Drawn under the art, only its front and sides show.
 */
export function groundRingEllipse(hexSize: number, gap: number, width: number): RingEllipse {
  const r = theme.ground.ringRadius * hexSize;
  const out = gap + width / 2;
  return { cy: 0, rx: r + out, ry: r * theme.ground.ringFlatten + out };
}

/** Texture sizes are rounded up to a multiple of this (px). */
const RASTER_STEP_PX = 32;

/**
 * Texture size (px, longer side) at which an SVG is rasterized: as many pixels as the art covers
 * on the screen at maximum zoom with this device pixel ratio, rounded up, capped by the theme.
 * The cap is for the fixed canvas; a larger canvas gets a cap grown by its `canvasFactor`, so it
 * has the same pixels per SVG unit (its building is not blurrier than the others).
 */
export function rasterSizePx(placement: ArtPlacement, dpr: number, hexSize: number): number {
  const worldPx = Math.max(placement.width, placement.height);
  const maxZoom = cameraConfig.maxHexScreenRadiusPx / hexSize;
  const px = Math.ceil((worldPx * maxZoom * dpr) / RASTER_STEP_PX) * RASTER_STEP_PX;
  const cap = Math.round(theme.artMaxTexturePx * placement.canvasFactor);
  return Math.max(RASTER_STEP_PX, Math.min(cap, px));
}

/**
 * Buildings whose art also comes in six direction versions `<id>.e0` ... `<id>.e5`, one per
 * edge of the tile (0 = east, then clockwise in 60° steps; see groundworks.ts `edgeNormal`):
 * the fishery scene with its jetty reaching into the water. `<id>` stays the icon and fallback.
 */
export const EDGE_ART_BUILDINGS: readonly BuildingId[] = ['fishery', 'harbor'];

/** Art id of the direction version of `type` toward `edge` (e.g. 'fishery.e1'). */
export function edgeArtId(type: BuildingId, edge: number): string {
  return `${type}.e${edge}`;
}

/**
 * Buildings with a map version for hills and mountains, `<id>.slope`: only the works (portal,
 * rails, cart, heap; crane, blocks, shed), the terrain cuts the rock face or terraces into its own
 * slope (docs/ART.md "Mines and quarries dig into the real slope"). `<id>` stays the icon and the
 * version on plains.
 */
export const SLOPE_ART_BUILDINGS: readonly BuildingId[] = ['mine', 'quarry'];

/** Art id of the slope version of `type` (e.g. 'mine.slope'). */
export function slopeArtId(type: BuildingId): string {
  return `${type}.slope`;
}

/** Hills and mountains: the terrain under a slope version. */
export function isSlopeTerrain(terrain: TerrainId | undefined): boolean {
  return terrain === 'hills' || terrain === 'mountains';
}

/**
 * Every building art file to load (without extension): each building, then its direction
 * versions and its slope versions.
 */
export function buildingArtIds(): string[] {
  const ids: string[] = [...BUILDING_IDS];
  for (const type of EDGE_ART_BUILDINGS) {
    for (let e = 0; e < 6; e++) ids.push(edgeArtId(type, e));
  }
  for (const type of SLOPE_ART_BUILDINGS) ids.push(slopeArtId(type));
  return ids;
}

/**
 * Which art a building on the map uses:
 * - on hills / mountains (`terrain`): its slope version if it has one and that one loaded;
 * - its direction version toward `edge` if it has those and that one loaded (`edge` is null when
 *   the tile has no fitting edge, e.g. a fishery without water around);
 * - else its own art.
 */
export function buildingArtId(
  type: BuildingId,
  edge: number | null,
  loaded: (id: string) => boolean,
  terrain?: TerrainId,
): string {
  if (isSlopeTerrain(terrain) && SLOPE_ART_BUILDINGS.includes(type)) {
    const slope = slopeArtId(type);
    return loaded(slope) ? slope : type;
  }
  if (edge === null || !EDGE_ART_BUILDINGS.includes(type)) return type;
  const id = edgeArtId(type, edge);
  return loaded(id) ? id : type;
}

/**
 * Draw order of objects on the map: rows from top to bottom (art of a lower tile overlaps the
 * tile above), then left to right. One key per object (its layers live in one container).
 */
export function depthKey(h: Hex): number {
  return h.r * 4096 + h.q;
}

/**
 * How an object is drawn:
 * - 'emoji': no art file -> colored plate / token + emoji (the old look).
 * - 'art': art without an owner-color layer -> drawn over the colored plate / token.
 * - 'tintedArt': art + owner-color layer tinted with the player color, no plate / token.
 */
export type ArtMode = 'emoji' | 'art' | 'tintedArt';

export function artModeOf(asset: { accent: unknown } | null | undefined): ArtMode {
  if (!asset) return 'emoji';
  return asset.accent ? 'tintedArt' : 'art';
}

/** Is the colored plate / token drawn under the object? Only the owner layer replaces it. */
export function drawsOwnerDisc(mode: ArtMode): boolean {
  return mode !== 'tintedArt';
}

/** The root `<svg ...>` start tag, or null. */
function rootTag(svg: string): RegExpMatchArray | null {
  return svg.match(/<svg\b[^>]*>/i);
}

/** Does a fetched text look like an SVG file (and not e.g. an HTML 404 / fallback page)? */
export function isSvgText(text: string): boolean {
  return !/<html[\s>]/i.test(text) && rootTag(text) !== null;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : null;
}

/**
 * The anchor point of the art in SVG user units, from `data-anchor="x y"` on the root tag
 * (canvases other than the fixed one carry it, e.g. `data-anchor="128 176"`); null if missing.
 */
export function parseSvgAnchor(svg: string): Point | null {
  const tag = rootTag(svg)?.[0];
  const value = tag ? attr(tag, 'data-anchor') : null;
  if (!value) return null;
  const n = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return n.length === 2 && n.every(Number.isFinite) ? { x: n[0], y: n[1] } : null;
}

/** The canvas of an SVG: its viewBox, else its plain numeric width/height; null if neither. */
export function parseSvgViewBox(svg: string): ViewBox | null {
  const tag = rootTag(svg)?.[0];
  if (!tag) return null;
  const vb = attr(tag, 'viewBox');
  if (vb) {
    const n = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0) {
      return { x: n[0], y: n[1], width: n[2], height: n[3] };
    }
    return null;
  }
  const w = Number(attr(tag, 'width'));
  const h = Number(attr(tag, 'height'));
  return w > 0 && h > 0 ? { x: 0, y: 0, width: w, height: h } : null;
}

/**
 * The SVG with an explicit pixel size on its root tag (replacing any width/height there), so every
 * browser rasterizes it at exactly that size (some refuse or blur SVGs without one).
 */
export function withSvgSize(svg: string, width: number, height: number): string {
  const m = rootTag(svg);
  if (!m || m.index === undefined) return svg;
  const tag = m[0]
    .replace(/\s(width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/^<svg\b/i, `<svg width="${width}" height="${height}"`);
  return svg.slice(0, m.index) + tag + svg.slice(m.index + m[0].length);
}
