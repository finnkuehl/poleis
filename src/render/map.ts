// Draws the terrain once statically (fills, outlines, symbols); dynamic layers above it.
import { Container, Graphics } from 'pixi.js';
import { allHexes, inBounds } from '../core/map';
import { hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, MapState, PlayerId } from '../core/state';
import { terrainAt } from '../core/map';
import { mapWorldBounds } from './bounds';
import type { Rect } from './camera';
import { hexSize } from './config';
import { createEconomyLayers } from './economyLayers';
import { createOrderLayers, type OrderPath } from './orderLayers';
import { createUnitLayers } from './unitLayers';
import { theme } from './theme';

export { mapWorldBounds };

export interface MapView {
  container: Container;
  bounds: Rect;
  /** Redraws the dynamic layers (territory, roads, buildings, badges). */
  update(state: GameState, statuses: Record<number, BuildingStatus>, viewer?: PlayerId): void;
  /** Red outlines on attack targets; [] clears. */
  setAttackTargets(hexes: readonly Hex[]): void;
  setSelection(h: Hex | null): void;
  /** Ghost token at world position; null hides it. */
  setGhost(unit: { type: string; owner: number } | null, x?: number, y?: number): void;
  /** Highlights valid tiles; [] clears. */
  setHighlights(hexes: readonly Hex[]): void;
  /** Road preview along `path`, dots on `newTiles`; null clears. */
  setPathPreview(path: readonly Hex[] | null, newTiles: readonly Hex[]): void;
  /** Draws move-order paths; [] clears. */
  setOrderPaths(paths: readonly OrderPath[]): void;
}

function drawTree(g: Graphics, cx: number, cy: number, s: number): void {
  g.poly([cx, cy - s, cx + s * 0.7, cy + s * 0.6, cx - s * 0.7, cy + s * 0.6]).fill(
    theme.treeColor,
  );
}

function drawHills(g: Graphics, c: Point, size: number): void {
  const w = size * 0.35;
  for (const dx of [-w, w]) {
    const cx = c.x + dx;
    const cy = c.y + size * 0.15;
    g.moveTo(cx - w, cy)
      .quadraticCurveTo(cx, cy - size * 0.5, cx + w, cy)
      .stroke({ color: theme.hillColor, width: 2, cap: 'round' });
  }
}

function drawMountain(g: Graphics, c: Point, size: number): void {
  const hw = size * 0.5;
  const top = { x: c.x, y: c.y - size * 0.5 };
  const baseY = c.y + size * 0.4;
  g.poly([top.x, top.y, c.x + hw, baseY, c.x - hw, baseY]).fill(theme.mountainColor);
  // white peak: top third of the triangle
  const t = 0.35;
  g.poly([
    top.x,
    top.y,
    top.x + hw * t,
    top.y + (baseY - top.y) * t,
    top.x - hw * t,
    top.y + (baseY - top.y) * t,
  ]).fill(theme.mountainPeakColor);
}

export function createMapView(map: MapState): MapView {
  const container = new Container();
  const fields = new Graphics();
  const symbols = new Graphics();
  const selection = new Graphics();
  const economy = createEconomyLayers();
  const unitLayers = createUnitLayers();
  const orders = createOrderLayers();

  for (const h of allHexes(map)) {
    const terrain = terrainAt(map, h);
    if (!terrain) continue;
    const c = hexToPixel(h, hexSize);
    const corners = hexCorners(c, hexSize).flatMap((p) => [p.x, p.y]);
    fields.poly(corners).fill(theme.terrainColors[terrain]).stroke({
      color: theme.outlineColor,
      alpha: theme.outlineAlpha,
      width: theme.outlineWidth,
    });

    if (terrain === 'forest') {
      const s = hexSize * 0.3;
      drawTree(symbols, c.x - s * 1.1, c.y + s * 0.4, s);
      drawTree(symbols, c.x + s * 1.1, c.y + s * 0.4, s);
      drawTree(symbols, c.x, c.y - s * 0.5, s);
    } else if (terrain === 'hills') {
      drawHills(symbols, c, hexSize);
    } else if (terrain === 'mountains') {
      drawMountain(symbols, c, hexSize);
    }
  }

  // economy layers: [tint, border, roads, plates, icons, badges, highlights, preview]
  const below = economy.layers.slice(0, 6);
  const above = economy.layers.slice(6);
  container.addChild(
    fields,
    symbols,
    ...below,
    unitLayers.units,
    unitLayers.fog,
    orders.layer,
    ...above,
    unitLayers.attack,
    selection,
    unitLayers.ghost,
  );

  return {
    container,
    bounds: mapWorldBounds(map, hexSize),
    update(state, statuses, viewer = 0) {
      economy.update(state, statuses);
      unitLayers.update(state, viewer);
    },
    setAttackTargets: unitLayers.setAttackTargets,
    setGhost: unitLayers.setGhost,
    setHighlights: economy.setHighlights,
    setPathPreview: economy.setPathPreview,
    setOrderPaths: orders.setOrderPaths,
    setSelection(h) {
      selection.clear();
      if (!h || !inBounds(map, h)) return;
      const corners = hexCorners(hexToPixel(h, hexSize), hexSize).flatMap((p) => [p.x, p.y]);
      selection
        .poly(corners)
        .fill({ color: theme.selectionColor, alpha: theme.selectionFillAlpha })
        .stroke({
          color: theme.selectionOuterColor,
          width: theme.selectionOuterWidth,
          join: 'round',
        })
        .poly(corners)
        .stroke({ color: theme.selectionColor, width: theme.selectionWidth, join: 'round' });
    },
  };
}
