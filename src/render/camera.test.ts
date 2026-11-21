import { describe, expect, it } from 'vitest';
import {
  centeredCamera,
  clampCamera,
  fitCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomLimits,
  type Rect,
  type Size,
} from './camera';
import { cameraConfig } from './config';

const viewport: Size = { width: 400, height: 800 };
const bigWorld: Rect = { x: -100, y: -50, width: 2000, height: 1500 };
const smallWorld: Rect = { x: 0, y: 0, width: 100, height: 100 };
const hexSize = 30;

describe('screenToWorld / worldToScreen', () => {
  it('are inverses of each other', () => {
    const cam = { x: 37, y: -12, zoom: 1.7 };
    const s = worldToScreen(cam, 123, 456);
    const w = screenToWorld(cam, s.x, s.y);
    expect(w.x).toBeCloseTo(123);
    expect(w.y).toBeCloseTo(456);
  });
});

describe('zoomAt', () => {
  it('keeps the world point under the pointer fixed', () => {
    let cam = { x: 20, y: 40, zoom: 1 };
    const before = screenToWorld(cam, 150, 220);
    for (const z of [0.5, 2, 3.3, 0.8]) {
      cam = zoomAt(cam, 150, 220, z);
      const after = screenToWorld(cam, 150, 220);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
      expect(cam.zoom).toBe(z);
    }
  });
});

describe('zoomLimits', () => {
  it('computes min and max', () => {
    const l = zoomLimits(bigWorld, viewport, hexSize);
    expect(l.min).toBeCloseTo(cameraConfig.minZoomFitFactor * Math.min(400 / 2000, 800 / 1500));
    expect(l.max).toBeCloseTo(cameraConfig.maxHexScreenRadiusPx / hexSize);
    expect(l.max).toBeGreaterThanOrEqual(l.min);
  });
  it('max is never smaller than min', () => {
    const l = zoomLimits(smallWorld, { width: 4000, height: 4000 }, 1000);
    expect(l.max).toBe(l.min);
  });
});

describe('clampCamera', () => {
  const limits = zoomLimits(bigWorld, viewport, hexSize);

  it('clamps the zoom', () => {
    expect(clampCamera({ x: 0, y: 0, zoom: 0.0001 }, bigWorld, viewport, limits).zoom).toBe(
      limits.min,
    );
    expect(clampCamera({ x: 0, y: 0, zoom: 99 }, bigWorld, viewport, limits).zoom).toBe(limits.max);
  });

  it('centers a small map', () => {
    const l = { min: 1, max: 1 };
    const c = clampCamera({ x: 500, y: -500, zoom: 1 }, smallWorld, viewport, l);
    const mid = worldToScreen(c, 50, 50);
    expect(mid.x).toBeCloseTo(200);
    expect(mid.y).toBeCloseTo(400);
  });

  it('lets a large map go at most panMarginPx past the edge', () => {
    const zoom = limits.max;
    const m = cameraConfig.panMarginPx;
    const edge = (c: { x: number; y: number; zoom: number }) => ({
      left: worldToScreen(c, bigWorld.x, bigWorld.y),
      right: worldToScreen(c, bigWorld.x + bigWorld.width, bigWorld.y + bigWorld.height),
    });
    const far = 1e6;
    const a = edge(clampCamera({ x: far, y: far, zoom }, bigWorld, viewport, limits));
    expect(a.left.x).toBeCloseTo(m);
    expect(a.left.y).toBeCloseTo(m);
    const b = edge(clampCamera({ x: -far, y: -far, zoom }, bigWorld, viewport, limits));
    expect(b.right.x).toBeCloseTo(viewport.width - m);
    expect(b.right.y).toBeCloseTo(viewport.height - m);
  });
});

describe('fitCamera', () => {
  it('shows the map centered at minimum zoom', () => {
    const limits = zoomLimits(bigWorld, viewport, hexSize);
    const c = fitCamera(bigWorld, viewport, limits);
    expect(c.zoom).toBe(limits.min);
    const mid = worldToScreen(c, bigWorld.x + bigWorld.width / 2, bigWorld.y + bigWorld.height / 2);
    expect(mid.x).toBeCloseTo(viewport.width / 2);
    expect(mid.y).toBeCloseTo(viewport.height / 2);
  });
});

describe('centeredCamera', () => {
  it('puts the world point in the viewport center and clamps the zoom', () => {
    const limits = zoomLimits(bigWorld, viewport, hexSize);
    const c = centeredCamera(300, 400, 99, viewport, limits);
    expect(c.zoom).toBe(limits.max);
    const s = worldToScreen(c, 300, 400);
    expect(s.x).toBeCloseTo(viewport.width / 2);
    expect(s.y).toBeCloseTo(viewport.height / 2);
  });
});
