// Pure helpers for the drawn SVG art (no PixiJS, easy to test): reading an SVG's canvas, where
// and how large a sprite is placed, how large the texture is rasterized, draw order and fallbacks.
import type { Hex } from '../core/hex';
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

/**
 * Height of the earth side of a diorama building's round base, in canvas px
 * (tools/art/iso.py: BASE_H = 21 world units x S = 1.08 px per unit).
 */
export const BUILDING_BASE_DEPTH = 22.7;

/** Where a sprite of the art goes: anchor on the tile point and world size. */
export interface ArtPlacement {
  /**
   * 'diorama': new art on the fixed canvas, the base center sits on the tile center.
   * 'flat': older art on another canvas, centered on the colored plate / token.
   */
  style: 'diorama' | 'flat';
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

export function artPlacement(kind: ArtKind, vb: ViewBox, hexSize: number): ArtPlacement {
  if (isDioramaCanvas(kind, vb)) {
    const c = ART_CANVAS[kind];
    const factor = kind === 'building' ? theme.buildingArtWidthFactor : theme.unitArtWidthFactor;
    const scale = (factor * hexWidth(hexSize)) / c.baseWidth;
    return {
      style: 'diorama',
      anchorX: (c.baseX - vb.x) / vb.width,
      anchorY: (c.baseY - vb.y) / vb.height,
      scale,
      width: vb.width * scale,
      height: vb.height * scale,
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
  };
}

/** An ellipse relative to the tile center (world px). */
export interface RingEllipse {
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Center line of a ring of `width` px on the ground around the foot of a diorama building's
 * base, `gap` px away from it. The base's top ellipse is 2:1 (dimetric); its foot lies one base
 * depth lower. Drawn under the art, only the front and the sides of the ring show.
 */
export function baseRingEllipse(hexSize: number, gap: number, width: number): RingEllipse {
  const c = ART_CANVAS.building;
  const scale = (theme.buildingArtWidthFactor * hexWidth(hexSize)) / c.baseWidth;
  const rx = (c.baseWidth / 2) * scale;
  const out = gap + width / 2;
  return { cy: BUILDING_BASE_DEPTH * scale, rx: rx + out, ry: rx / 2 + out };
}

/** Texture sizes are rounded up to a multiple of this (px). */
const RASTER_STEP_PX = 32;

/**
 * Texture size (px, longer side) at which an SVG is rasterized: as many pixels as the art covers
 * on the screen at maximum zoom with this device pixel ratio, rounded up, capped by the theme.
 */
export function rasterSizePx(placement: ArtPlacement, dpr: number, hexSize: number): number {
  const worldPx = Math.max(placement.width, placement.height);
  const maxZoom = cameraConfig.maxHexScreenRadiusPx / hexSize;
  const px = Math.ceil((worldPx * maxZoom * dpr) / RASTER_STEP_PX) * RASTER_STEP_PX;
  return Math.max(RASTER_STEP_PX, Math.min(theme.artMaxTexturePx, px));
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
