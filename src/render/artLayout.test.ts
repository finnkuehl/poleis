import { describe, expect, it } from 'vitest';
import { offsetToAxial } from '../core/hex';
import {
  ART_CANVAS,
  BUILDING_BASE_DEPTH,
  artModeOf,
  artPlacement,
  baseRingEllipse,
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

  it('gives every tile of a 40 x 40 map its own key, in row order', () => {
    const keys: number[] = [];
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < 40; col++) keys.push(depthKey(offsetToAxial({ col, row })));
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
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

describe('baseRingEllipse', () => {
  it('runs around the foot of the base, outside the base outline', () => {
    const baseHalfWidth = (theme.buildingArtWidthFactor * hexWidth(hexSize)) / 2;
    const scale = artPlacement('building', box(256), hexSize).scale;
    const e = baseRingEllipse(hexSize, 1, 3);
    expect(e.cy).toBeCloseTo(BUILDING_BASE_DEPTH * scale);
    expect(e.rx).toBeCloseTo(baseHalfWidth + 1 + 1.5);
    // 2:1 dimetric base: its top ellipse is half as high as wide
    expect(e.ry).toBeCloseTo(baseHalfWidth / 2 + 1 + 1.5);
    // The ring's front passes below the base's front edge (top ellipse + earth side)
    expect(e.cy + e.ry).toBeGreaterThan(baseHalfWidth / 2 + BUILDING_BASE_DEPTH * scale);
  });
});

/** The art files that exist right now (raw text); missing files are simply not in the list. */
const artFiles = import.meta.glob<string>('/public/assets/{buildings,units}/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('art files in public/assets', () => {
  const mains = Object.keys(artFiles).filter((path) => !path.endsWith('.accent.svg'));

  it('all have a readable canvas; owner layers share the canvas of their art', () => {
    for (const path of mains) {
      const vb = parseSvgViewBox(artFiles[path]);
      expect(vb, path).not.toBeNull();
      const accent = artFiles[path.replace(/\.svg$/, '.accent.svg')];
      if (accent) expect(parseSvgViewBox(accent), path).toEqual(vb);
    }
  });

  it('places the diorama buildings with the base center on the tile (ART.md anchor)', () => {
    let checked = 0;
    for (const path of mains.filter((p) => p.includes('/buildings/'))) {
      const svg = artFiles[path];
      const vb = parseSvgViewBox(svg);
      if (!vb || vb.width !== ART_CANVAS.building.size) continue;
      checked++;
      const p = artPlacement('building', vb, hexSize);
      expect(p.style, path).toBe('diorama');
      expect(p.anchorX * vb.width, path).toBeCloseTo(128);
      expect(p.anchorY * vb.height, path).toBeCloseTo(176);
      // The grass top of the base is the 208 px wide ellipse around (128, 176) – drawn in world
      // units (rx 96.17) inside the library's scale(1.08) group around the anchor.
      expect(svg, path).toMatch(/<ellipse cx="128" cy="176" rx="96\.17" ry="48\.08"/);
      expect(svg, path).toContain('translate(128 176) scale(1.08) translate(-128 -176)');
    }
    // house, temple, cityCenter and wonder exist as diorama art
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});
