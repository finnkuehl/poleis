// Zeichnet die Karte einmal statisch (Flächen, Umrisse, Symbole) plus eine Auswahl-Ebene.
import { Container, Graphics } from 'pixi.js';
import { allHexes, inBounds } from '../core/map';
import { hexCorners, hexToPixel, type Hex, type Point } from '../core/hex';
import type { MapState } from '../core/state';
import { terrainAt } from '../core/map';
import { mapWorldBounds } from './bounds';
import type { Rect } from './camera';
import { hexSize } from './config';
import { theme } from './theme';

export { mapWorldBounds };

export interface MapView {
  container: Container;
  bounds: Rect;
  setSelection(h: Hex | null): void;
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
  // weiße Spitze: oberes Drittel des Dreiecks
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

  container.addChild(fields, symbols, selection);

  return {
    container,
    bounds: mapWorldBounds(map, hexSize),
    setSelection(h) {
      selection.clear();
      if (!h || !inBounds(map, h)) return;
      const corners = hexCorners(hexToPixel(h, hexSize), hexSize).flatMap((p) => [p.x, p.y]);
      selection
        .poly(corners)
        .fill({ color: theme.selectionColor, alpha: theme.selectionFillAlpha })
        .stroke({ color: theme.selectionColor, width: theme.selectionWidth, join: 'round' });
    },
  };
}
