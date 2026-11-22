import { describe, expect, it } from 'vitest';
import {
  ART_CANVAS,
  artModeOf,
  artPlacement,
  depthKey,
  drawsOwnerDisc,
  hexWidth,
  isSvgText,
  parseSvgViewBox,
  rasterSizePx,
  withSvgSize,
} from './artLayout';
import { cameraConfig, hexSize } from './config';
import { theme } from './theme';

const box = (size: number) => ({ x: 0, y: 0, width: size, height: size });

describe('artPlacement', () => {
  it('puts the base center of diorama buildings on the tile, base width 0.92 x hex width', () => {
    const p = artPlacement('building', box(256), hexSize);
    expect(p.style).toBe('diorama');
    expect(p.anchorX).toBeCloseTo(128 / 256);
    expect(p.anchorY).toBeCloseTo(176 / 256);
    // The base ellipse (208 SVG units) ends up 0.92 x the hex width wide
    expect(ART_CANVAS.building.baseWidth * p.scale).toBeCloseTo(
      theme.buildingArtWidthFactor * hexWidth(hexSize),
    );
    expect(p.width).toBeCloseTo(256 * p.scale);
  });

  it('scales diorama units to 0.62 x hex width with the base center as anchor', () => {
    const p = artPlacement('unit', box(128), hexSize);
    expect(p.style).toBe('diorama');
    expect(p.anchorX).toBeCloseTo(0.5);
    expect(p.anchorY).toBeCloseTo(0.75);
    expect(88 * p.scale).toBeCloseTo(theme.unitArtWidthFactor * hexWidth(hexSize));
  });

  it('respects a viewBox origin other than 0 0', () => {
    const p = artPlacement('unit', { x: -10, y: 20, width: 128, height: 128 }, hexSize);
    expect(p.anchorX).toBeCloseTo((64 + 10) / 128);
    expect(p.anchorY).toBeCloseTo((96 - 20) / 128);
  });

  it('centers old flat art (other canvas) on the token / plate', () => {
    const unit = artPlacement('unit', box(96), hexSize);
    expect(unit.style).toBe('flat');
    expect(unit.anchorX).toBe(0.5);
    expect(unit.anchorY).toBe(0.5);
    expect(unit.width).toBeCloseTo(2 * theme.unitRadiusFactor * hexSize * theme.unitFlatArtFactor);
    // A 96 canvas building is old flat art too, even though 96 is no diorama size
    expect(artPlacement('building', box(96), hexSize).style).toBe('flat');
    // A unit-sized canvas is not a building diorama
    expect(artPlacement('building', box(128), hexSize).style).toBe('flat');
  });
});

describe('rasterSizePx', () => {
  const maxZoom = cameraConfig.maxHexScreenRadiusPx / hexSize;

  it('covers the art at max zoom, rounded up to a multiple of 32', () => {
    const p = artPlacement('unit', box(128), hexSize);
    const px = rasterSizePx(p, 2, hexSize);
    expect(px % 32).toBe(0);
    expect(px).toBeGreaterThanOrEqual(Math.min(theme.artMaxTexturePx, p.width * maxZoom * 2));
    expect(px).toBeLessThan(p.width * maxZoom * 2 + 32);
  });

  it('is smaller on low-density screens and never above the cap', () => {
    const p = artPlacement('building', box(256), hexSize);
    expect(rasterSizePx(p, 1, hexSize)).toBeLessThan(rasterSizePx(p, 2, hexSize));
    expect(rasterSizePx(p, 2, hexSize)).toBeLessThanOrEqual(theme.artMaxTexturePx);
    expect(rasterSizePx(p, 10, hexSize)).toBe(theme.artMaxTexturePx);
  });
});

describe('depthKey', () => {
  it('draws lower rows over upper rows, then left to right', () => {
    expect(depthKey({ q: 5, r: 3 })).toBeGreaterThan(depthKey({ q: 30, r: 2 }));
    expect(depthKey({ q: -12, r: 25 })).toBeGreaterThan(depthKey({ q: 30, r: 24 }));
    expect(depthKey({ q: 4, r: 3 })).toBeGreaterThan(depthKey({ q: 3, r: 3 }));
  });

  it('keeps the owner layer right above its own art, below the next object', () => {
    const h = { q: 3, r: 3 };
    expect(depthKey(h, 1)).toBeGreaterThan(depthKey(h, 0));
    expect(depthKey(h, 1)).toBeLessThan(depthKey({ q: 4, r: 3 }, 0));
  });
});

describe('art fallback decisions', () => {
  it('uses plate/token + emoji without art', () => {
    expect(artModeOf(undefined)).toBe('emoji');
    expect(artModeOf(null)).toBe('emoji');
    expect(drawsOwnerDisc('emoji')).toBe(true);
  });

  it('keeps the colored plate/token under art without an owner layer', () => {
    expect(artModeOf({ accent: null })).toBe('art');
    expect(drawsOwnerDisc('art')).toBe(true);
  });

  it('draws no plate/token when the owner layer shows the color', () => {
    expect(artModeOf({ accent: {} })).toBe('tintedArt');
    expect(drawsOwnerDisc('tintedArt')).toBe(false);
  });
});

describe('SVG helpers', () => {
  const svg = `<?xml version="1.0"?>\n<!-- art -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">\n<g stroke-width="3"><rect width="10" height="10"/></g></svg>`;

  it('reads the viewBox of the root tag', () => {
    expect(parseSvgViewBox(svg)).toEqual({ x: 0, y: 0, width: 256, height: 256 });
    expect(parseSvgViewBox(`<svg viewBox='-4,2 96 80'></svg>`)).toEqual({
      x: -4,
      y: 2,
      width: 96,
      height: 80,
    });
  });

  it('falls back to width/height and rejects files without a canvas', () => {
    expect(parseSvgViewBox('<svg width="96" height="96"></svg>')).toEqual(box(96));
    expect(parseSvgViewBox('<svg width="100%" height="100%"></svg>')).toBeNull();
    expect(parseSvgViewBox('<svg viewBox="0 0 0 10"></svg>')).toBeNull();
    expect(parseSvgViewBox('not an svg')).toBeNull();
  });

  it('tells SVG files from HTML fallback pages', () => {
    expect(isSvgText(svg)).toBe(true);
    expect(isSvgText('<!doctype html><html><body><svg></svg></body></html>')).toBe(false);
    expect(isSvgText('')).toBe(false);
  });

  it('sets the pixel size on the root tag only', () => {
    const sized = withSvgSize(svg, 384, 384);
    expect(sized).toContain('<svg width="384" height="384" xmlns="http://www.w3.org/2000/svg"');
    // Inner elements keep their sizes; the prolog stays in front
    expect(sized).toContain('<rect width="10" height="10"/>');
    expect(sized).toContain('stroke-width="3"');
    expect(sized.startsWith('<?xml')).toBe(true);
    expect(parseSvgViewBox(sized)).toEqual(box(256));
  });

  it('replaces an existing size on the root tag', () => {
    const sized = withSvgSize('<svg width="96" height=\'96\' viewBox="0 0 96 96"></svg>', 160, 160);
    expect(sized).toBe('<svg width="160" height="160" viewBox="0 0 96 96"></svg>');
  });
});
