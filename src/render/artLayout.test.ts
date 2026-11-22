import { describe, expect, it } from 'vitest';
import { offsetToAxial } from '../core/hex';
import { at, makeTestState } from '../core/testing';
import { BUILDING_IDS } from '../data/buildings';
import {
  ART_CANVAS,
  artModeOf,
  artPlacement,
  buildingArtId,
  buildingArtIds,
  depthKey,
  drawsOwnerDisc,
  groundRingEllipse,
  hexWidth,
  isSvgText,
  parseSvgAnchor,
  parseSvgViewBox,
  rasterSizePx,
  withSvgSize,
} from './artLayout';
import { cameraConfig, hexSize } from './config';
import { jettyEdge } from './groundworks';
import { cityRingStyle } from './style';
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

describe('artPlacement with a data-anchor (larger canvas, e.g. a fishery scene)', () => {
  const wide = { x: -64, y: 0, width: 320, height: 256 };
  const anchor = { x: 128, y: 176 };

  it('puts the anchor on the tile, at the same scale as the fixed building canvas', () => {
    const p = artPlacement('building', wide, hexSize, anchor);
    const normal = artPlacement('building', box(256), hexSize);
    expect(p.style).toBe('diorama');
    expect(p.anchorX).toBeCloseTo((128 + 64) / 320);
    expect(p.anchorY).toBeCloseTo(176 / 256);
    expect(p.scale).toBeCloseTo(normal.scale);
    expect(p.width).toBeCloseTo(320 * normal.scale);
    expect(p.height).toBeCloseTo(normal.height);
    expect(p.canvasFactor).toBeCloseTo(320 / 256);
    // The anchor ends up at the same world point as on the fixed canvas
    expect(p.anchorX * p.width - (128 - wide.x) * p.scale).toBeCloseTo(0);
  });

  it('works for any canvas (not only the fishery) and for a top-left origin below zero', () => {
    const p = artPlacement(
      'building',
      { x: -40, y: -24, width: 336, height: 300 },
      hexSize,
      anchor,
    );
    expect(p.style).toBe('diorama');
    expect(p.anchorX).toBeCloseTo((128 + 40) / 336);
    expect(p.anchorY).toBeCloseTo((176 + 24) / 300);
    expect(p.canvasFactor).toBeCloseTo(336 / 256);
    // Without an anchor the same canvas is old flat art
    expect(artPlacement('building', box(96), hexSize).style).toBe('flat');
    expect(artPlacement('building', box(96), hexSize, anchor).style).toBe('diorama');
  });

  it('the fixed canvas and flat art have a canvas factor of 1', () => {
    expect(artPlacement('building', box(256), hexSize).canvasFactor).toBe(1);
    expect(artPlacement('unit', box(128), hexSize).canvasFactor).toBe(1);
    expect(artPlacement('unit', box(96), hexSize).canvasFactor).toBe(1);
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

  it('grows the cap with a larger canvas, keeping the same pixels per SVG unit', () => {
    const normal = artPlacement('building', box(256), hexSize);
    const wide = artPlacement('building', { x: -64, y: 0, width: 320, height: 256 }, hexSize, {
      x: 128,
      y: 176,
    });
    expect(rasterSizePx(normal, 10, hexSize)).toBe(theme.artMaxTexturePx);
    expect(rasterSizePx(wide, 10, hexSize)).toBe(Math.round(theme.artMaxTexturePx * 1.25));
    expect(rasterSizePx(wide, 10, hexSize) / 320).toBeCloseTo(
      rasterSizePx(normal, 10, hexSize) / 256,
    );
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

  it('reads the data-anchor of the root tag', () => {
    const scene =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 0 320 256" data-anchor="128 176"><g data-anchor="1 2"/></svg>';
    expect(parseSvgAnchor(scene)).toEqual({ x: 128, y: 176 });
    expect(parseSvgAnchor(`<svg data-anchor='64,96' viewBox="0 0 128 128"></svg>`)).toEqual({
      x: 64,
      y: 96,
    });
    expect(parseSvgAnchor(svg)).toBeNull();
    expect(parseSvgAnchor('<svg data-anchor="128"></svg>')).toBeNull();
    expect(parseSvgAnchor('<svg data-anchor="a b"></svg>')).toBeNull();
    // Only the root tag counts
    expect(parseSvgAnchor('<svg viewBox="0 0 256 256"><g data-anchor="1 2"/></svg>')).toBeNull();
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

describe('groundRingEllipse', () => {
  it('lies flat on the ground around the tile center (buildings have no base any more)', () => {
    const r = theme.ground.ringRadius * hexSize;
    const e = groundRingEllipse(hexSize, 1, 3);
    expect(e.cy).toBe(0);
    expect(e.rx).toBeCloseTo(r + 1 + 1.5);
    expect(e.ry).toBeCloseTo(r * theme.ground.ringFlatten + 1 + 1.5);
  });

  it('keeps the city rings inside their own tile from side to side', () => {
    const halfHex = hexWidth(hexSize) / 2;
    for (const level of ['polis', 'metropolis'] as const) {
      const ring = cityRingStyle(level);
      const e = groundRingEllipse(hexSize, theme.cityArtRingGap, ring.outerWidth);
      expect(e.rx + ring.outerWidth / 2, level).toBeLessThanOrEqual(halfHex);
    }
  });

  it('runs in front of the building foot, below the tile center', () => {
    const e = groundRingEllipse(hexSize, theme.cityArtRingGap, 3);
    expect(e.cy + e.ry).toBeGreaterThan(0.3 * hexSize);
    expect(e.cy + e.ry).toBeLessThan(hexSize);
  });
});

describe('direction versions of building art', () => {
  it('loads every building plus the six fishery versions', () => {
    const ids = buildingArtIds();
    for (const id of BUILDING_IDS) expect(ids).toContain(id);
    for (let e = 0; e < 6; e++) expect(ids).toContain(`fishery.e${e}`);
    expect(ids).toContain('mine.slope');
    expect(ids).toContain('quarry.slope');
    expect(ids).toHaveLength(BUILDING_IDS.length + 8);
  });

  it('uses the version toward the edge if it loaded, else the normal art', () => {
    const all = (): boolean => true;
    const none = (): boolean => false;
    expect(buildingArtId('fishery', 2, all)).toBe('fishery.e2');
    expect(buildingArtId('fishery', 0, all)).toBe('fishery.e0');
    expect(buildingArtId('fishery', 2, none)).toBe('fishery');
    expect(buildingArtId('fishery', 2, (id) => id === 'fishery.e5')).toBe('fishery');
    expect(buildingArtId('fishery', null, all)).toBe('fishery');
    // Buildings without direction versions keep their art
    expect(buildingArtId('house', 1, all)).toBe('house');
  });

  it('mines and quarries on hills / mountains use their slope version if it loaded', () => {
    const all = (): boolean => true;
    const none = (): boolean => false;
    expect(buildingArtId('mine', null, all, 'mountains')).toBe('mine.slope');
    expect(buildingArtId('quarry', null, all, 'hills')).toBe('quarry.slope');
    // A quarry on plains keeps its normal art
    expect(buildingArtId('quarry', null, all, 'plains')).toBe('quarry');
    // Fallback while the slope version is missing
    expect(buildingArtId('mine', null, none, 'mountains')).toBe('mine');
    // Other buildings on slopes keep their art
    expect(buildingArtId('house', null, all, 'hills')).toBe('house');
  });

  it("faces the fishery's water: the version follows its jetty edge", () => {
    // Water above and below: the jetty (and the scene) faces a lower edge (SE or SW)
    const state = makeTestState(['ccccc', 'ppppp', 'ccccc']);
    const edge = jettyEdge(state.map, at(2, 1));
    expect([1, 2]).toContain(edge);
    expect(buildingArtId('fishery', edge, () => true)).toBe(`fishery.e${edge}`);
    // No water around: the normal fishery art
    const dry = makeTestState(['ppp', 'ppp', 'ppp']);
    expect(buildingArtId('fishery', jettyEdge(dry.map, at(1, 1)), () => true)).toBe('fishery');
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

  it('places the diorama buildings with their ground point on the tile (ART.md anchor)', () => {
    let checked = 0;
    for (const path of mains.filter((p) => p.includes('/buildings/'))) {
      const svg = artFiles[path];
      const vb = parseSvgViewBox(svg);
      const anchor = parseSvgAnchor(svg);
      if (!vb) continue;
      const fixed = vb.width === ART_CANVAS.building.size && vb.height === ART_CANVAS.building.size;
      if (!fixed && !anchor) continue;
      checked++;
      const p = artPlacement('building', vb, hexSize, anchor);
      expect(p.style, path).toBe('diorama');
      // The anchor in user units: the ground point under the building at (128, 176)
      expect(vb.x + p.anchorX * vb.width, path).toBeCloseTo(128);
      expect(vb.y + p.anchorY * vb.height, path).toBeCloseTo(176);
      // The library draws in world units inside a scale(1.08) group around the anchor (the ground
      // point under the building); grounded buildings have no base ellipse any more.
      if (fixed && !anchor) {
        expect(svg, path).toContain('translate(128 176) scale(1.08) translate(-128 -176)');
      }
    }
    // house, temple, cityCenter and wonder exist as diorama art
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it('direction versions (<id>.e0-e5.svg) carry data-anchor="128 176"', () => {
    for (const path of mains.filter((p) => /\/buildings\/[^/]+\.e[0-5]\.svg$/.test(p))) {
      expect(parseSvgAnchor(artFiles[path]), path).toEqual({ x: 128, y: 176 });
    }
  });
});
