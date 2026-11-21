// Small 2D-canvas picture of the map a seed makes (start menu). No start positions are shown.
import { hexCorners, hexToPixel } from '../core/hex';
import { hexAtIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { seedFromText } from '../core/rng';
import { MAP_SIZES, type MapSize } from '../data';
import { theme } from '../render/theme';

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Width / height of the picture of a map size (at hex size 1), so the page can reserve the space. */
export function previewAspect(size: MapSize): number {
  const { width, height } = MAP_SIZES[size];
  const w = Math.sqrt(3) * (width + 0.5);
  const h = 1.5 * (height - 1) + 2;
  return w / h;
}

/**
 * Draws the map for `seedText` and `size` onto `canvas`. The canvas keeps its CSS size; the
 * pixel size follows it (with the device pixel ratio). Does nothing while the canvas is hidden.
 */
export function drawSeedPreview(canvas: HTMLCanvasElement, seedText: string, size: MapSize): void {
  const cssW = canvas.clientWidth;
  if (cssW <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { map } = generateMap(seedFromText(seedText), MAP_SIZES[size]);
  const centers = map.tiles.map((_, i) => hexToPixel(hexAtIndex(map, i), 1));
  const minX = Math.min(...centers.map((p) => p.x)) - Math.sqrt(3) / 2;
  const maxX = Math.max(...centers.map((p) => p.x)) + Math.sqrt(3) / 2;
  const minY = Math.min(...centers.map((p) => p.y)) - 1;
  const maxY = Math.max(...centers.map((p) => p.y)) + 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const scale = cssW / (maxX - minX);
  const cssH = (maxY - minY) * scale;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -minX * dpr * scale, -minY * dpr * scale);
  ctx.fillStyle = css(theme.terrainColors.ocean);
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  map.tiles.forEach((terrain, i) => {
    ctx.fillStyle = css(theme.terrainColors[terrain]);
    ctx.beginPath();
    // A hair larger than the tile so no seams show between neighbors.
    hexCorners(centers[i], 1.03).forEach((c, k) => {
      if (k === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.fill();
  });
}
