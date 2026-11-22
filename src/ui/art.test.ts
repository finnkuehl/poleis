import { describe, expect, it } from 'vitest';
import { BUILDING_IDS } from '../data';
import {
  ART_FRAMES,
  ART_FRAME_MARGIN,
  BUILDING_ART_BOUNDS,
  BUILDING_FRAMES,
  accentUrl,
  artFrame,
  artColorsOf,
  artUrl,
  frameAround,
  frameLayout,
  hasAccentLayer,
  ownerColor,
  setArtPlayers,
  shouldTryArt,
} from './art';
import { playerCssColor } from './playerColors';

describe('artUrl / accentUrl', () => {
  it('builds the asset path under the given base', () => {
    expect(artUrl('goods', 'wood', '/')).toBe('/assets/goods/wood.svg');
    expect(artUrl('buildings', 'cityCenter', '/poleis/')).toBe(
      '/poleis/assets/buildings/cityCenter.svg',
    );
    expect(accentUrl('units', 'hoplite', '/poleis/')).toBe(
      '/poleis/assets/units/hoplite.accent.svg',
    );
  });

  it("uses Vite's base url by default", () => {
    expect(artUrl('goods', 'fish')).toBe(`${import.meta.env.BASE_URL}assets/goods/fish.svg`);
  });
});

describe('fallback decision', () => {
  it('tries unknown and loaded files, not missing ones', () => {
    expect(shouldTryArt(undefined)).toBe(true);
    expect(shouldTryArt('loaded')).toBe(true);
    expect(shouldTryArt('missing')).toBe(false);
  });

  it('gives only buildings and units an owner-color layer', () => {
    expect(hasAccentLayer('goods')).toBe(false);
    expect(hasAccentLayer('buildings')).toBe(true);
    expect(hasAccentLayer('units')).toBe(true);
  });
});

describe('frameLayout', () => {
  it('shows the whole canvas for goods', () => {
    expect(frameLayout(ART_FRAMES.goods)).toEqual({ zoom: '100%', left: '0%', top: '0%' });
  });

  it('zooms in and shifts so exactly the frame square is visible', () => {
    expect(frameLayout({ canvas: 256, x: 16, y: 32, size: 224 })).toEqual({
      zoom: '114.286%',
      left: '-7.143%',
      top: '-14.286%',
    });
  });

  it('keeps every frame inside its canvas', () => {
    for (const f of [...Object.values(ART_FRAMES), ...Object.values(BUILDING_FRAMES)]) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.size).toBeLessThanOrEqual(f.canvas);
      expect(f.y + f.size).toBeLessThanOrEqual(f.canvas);
    }
  });

  it('gives every building its own square frame around its whole drawing', () => {
    for (const id of BUILDING_IDS) {
      const f = artFrame('buildings', id);
      const [minX, minY, maxX, maxY] = BUILDING_ART_BOUNDS[id];
      expect(f, id).toBe(BUILDING_FRAMES[id]);
      expect(f.canvas).toBe(256);
      // Nothing cut off
      expect(f.x, id).toBeLessThanOrEqual(minX);
      expect(f.y, id).toBeLessThanOrEqual(minY);
      expect(f.x + f.size, id).toBeGreaterThanOrEqual(maxX);
      expect(f.y + f.size, id).toBeGreaterThanOrEqual(maxY);
      // ... and not much more than the drawing: every icon about equally prominent
      const longer = Math.max(maxX - minX, maxY - minY);
      expect(f.size, id).toBeLessThanOrEqual(Math.min(256, longer * (1 + ART_FRAME_MARGIN)) + 0.1);
    }
  });

  it('centers the frame on the drawing and keeps it inside the canvas', () => {
    expect(frameAround([100, 100, 150, 200], 256, 0.1)).toEqual({
      canvas: 256,
      x: 70,
      y: 95,
      size: 110,
    });
    // A drawing near the top: the frame moves down instead of leaving the canvas
    const tall = frameAround([47, 6.8, 206.5, 217], 256);
    expect(tall.y).toBe(0);
    expect(tall.size).toBeLessThanOrEqual(256);
    // Larger than the canvas: the whole canvas
    expect(frameAround([0, 0, 256, 256], 256)).toEqual({ canvas: 256, x: 0, y: 0, size: 256 });
  });

  it('uses the kind default for goods and units', () => {
    expect(artFrame('goods', 'wood')).toBe(ART_FRAMES.goods);
    expect(artFrame('units', 'hoplite')).toBe(ART_FRAMES.units);
  });

  it('keeps the unit token fully visible', () => {
    const u = ART_FRAMES.units;
    expect(u.x).toBeLessThanOrEqual(64 - 44);
    expect(u.x + u.size).toBeGreaterThanOrEqual(64 + 44);
  });
});

describe('player colors', () => {
  const players = [
    { id: 0, color: 2, isHuman: true },
    { id: 1, color: 0, isHuman: false },
  ];

  it('maps player ids to css colors and takes the human color as own color', () => {
    const c = artColorsOf(players);
    expect(c.own).toBe(playerCssColor(2));
    expect(c.byId).toEqual({ 0: playerCssColor(2), 1: playerCssColor(0) });
  });

  it('falls back to Tyrian purple without a human', () => {
    expect(artColorsOf([{ id: 1, color: 3, isHuman: false }]).own).toBe(playerCssColor(0));
  });

  it('resolves owners after setArtPlayers; unknown owners get the own color', () => {
    setArtPlayers(players);
    expect(ownerColor()).toBe(playerCssColor(2));
    expect(ownerColor(1)).toBe(playerCssColor(0));
    expect(ownerColor(7)).toBe(playerCssColor(2));
  });
});
