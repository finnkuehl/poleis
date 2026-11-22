// Small 2D-canvas picture of the map a seed makes (start menu). No start positions are shown.
// Painted in the game's bright Mediterranean mood (docs/ART.md), reduced to what reads at this
// size: per-tile tones, deep sea fading into a turquoise coast, a sand rim with foam along
// every shore, tiny trees, mounds and peaks, and soft sunlight from the upper left.
import { hexCorners, hexToPixel, type Point } from '../core/hex';
import { hexAtIndex } from '../core/map';
import { generateMap } from '../core/mapgen';
import { seedFromText } from '../core/rng';
import { MAP_SIZES, type MapSize } from '../data';
import { insetBands, insetStrips } from '../render/geometry';
import { edgeMask, isWater, shoreMask, tileBaseColor, tileRng } from '../render/terrain';
import { theme } from '../render/theme';

const P = theme.terrainPaint;

/**
 * Look of the preview (looks only, no balancing). Sizes are fractions of the hex size; the
 * preview is tiny (a hex is ~5-9 CSS px), so beaches and marks are a bit bolder than in the game.
 */
const LOOK = {
  /** Sand rim on land tiles along the water, and its wet line at the waterline */
  beachDepth: 0.3,
  beachWetDepth: 0.08,
  /** White foam strip on the water side of the shore: distance from the shore and width */
  foamFrom: 0.06,
  foamTo: 0.16,
  foamAlpha: 0.7,
  /** Forest: up to this many small tree crowns per tile, crown radius */
  treesPerTile: 3,
  treeRadius: 0.26,
  /** Hills: one rolling mound per tile (half width, height) */
  moundWidth: 0.5,
  moundHeight: 0.34,
  /** Mountains: one peak per tile (half width, height), share of the height under snow */
  peakWidth: 0.55,
  peakHeight: 0.85,
  snowShare: 0.34,
  /** Waves on the open sea: chance per tile, stroke width */
  waveChance: 0.35,
  waveWidth: 0.1,
  /** Sunlight over the whole picture: light in the upper left, shade in the lower right */
  sunAlpha: 0.16,
  shadeAlpha: 0.2,
} as const;

function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Width / height of the picture of a map size (at hex size 1), so the page can reserve the space. */
export function previewAspect(size: MapSize): number {
  const { width, height } = MAP_SIZES[size];
  const w = Math.sqrt(3) * (width + 0.5);
  const h = 1.5 * (height - 1) + 2;
  return w / h;
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  points.forEach((c, k) => {
    if (k === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.closePath();
}

/** Fills all polygons in one path (one fill call per color). */
function fillAll(
  ctx: CanvasRenderingContext2D,
  polys: readonly (readonly Point[])[],
  color: number,
  alpha = 1,
): void {
  if (polys.length === 0) return;
  ctx.beginPath();
  for (const p of polys) polygon(ctx, p);
  ctx.fillStyle = css(color, alpha);
  ctx.fill();
}

interface PreviewTile {
  q: number;
  r: number;
  center: Point;
  corners: Point[];
}

/** Tiny tree crowns, mounds and peaks (back to front, light from the upper left). */
function paintMarks(
  ctx: CanvasRenderingContext2D,
  tiles: readonly PreviewTile[],
  terrain: (i: number) => string,
): void {
  tiles.forEach((t, i) => {
    const kind = terrain(i);
    const rng = tileRng(t.q, t.r, 71);
    const { x, y } = t.center;
    if (kind === 'forest') {
      const n = 2 + Math.floor(rng() * (LOOK.treesPerTile - 1));
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2;
        const d = 0.18 + rng() * 0.22;
        const cx = x + Math.cos(a) * d;
        const cy = y + Math.sin(a) * d * 0.8;
        const rad = LOOK.treeRadius * (0.8 + rng() * 0.4);
        ctx.fillStyle = css(P.shadowColor, P.shadowAlpha);
        ctx.beginPath();
        ctx.ellipse(cx + rad * 0.35, cy + rad * 0.45, rad, rad * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(P.pineDark);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(P.pineLight);
        ctx.beginPath();
        ctx.arc(cx - rad * 0.28, cy - rad * 0.3, rad * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'hills') {
      const w = LOOK.moundWidth;
      const h = LOOK.moundHeight;
      const cx = x + (rng() - 0.5) * 0.2;
      const base = y + 0.22;
      ctx.fillStyle = css(P.moundShade);
      ctx.beginPath();
      ctx.ellipse(cx, base, w, h, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(P.moundLight);
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.12, base, w * 0.86, h * 0.92, 0, Math.PI, Math.PI * 1.72);
      ctx.lineTo(cx - w * 0.12, base);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'mountains') {
      const w = LOOK.peakWidth * (0.85 + rng() * 0.3);
      const h = LOOK.peakHeight * (0.85 + rng() * 0.3);
      const cx = x + (rng() - 0.5) * 0.16;
      const base = y + 0.36;
      const top = { x: cx, y: base - h };
      const left = { x: cx - w, y: base };
      const right = { x: cx + w, y: base };
      const foot = { x: cx + w * 0.12, y: base };
      ctx.fillStyle = css(P.rockShade);
      ctx.beginPath();
      polygon(ctx, [top, right, foot]);
      ctx.fill();
      ctx.fillStyle = css(P.rockLight);
      ctx.beginPath();
      polygon(ctx, [top, foot, left]);
      ctx.fill();
      // Snow cap: the top share of both faces
      const s = LOOK.snowShare;
      const sl = { x: top.x + (left.x - top.x) * s, y: top.y + (left.y - top.y) * s };
      const sf = { x: top.x + (foot.x - top.x) * s, y: top.y + (foot.y - top.y) * s };
      const sr = { x: top.x + (right.x - top.x) * s, y: top.y + (right.y - top.y) * s };
      ctx.fillStyle = css(P.snowShade);
      ctx.beginPath();
      polygon(ctx, [top, sr, sf]);
      ctx.fill();
      ctx.fillStyle = css(P.snowColor);
      ctx.beginPath();
      polygon(ctx, [top, sf, sl]);
      ctx.fill();
    } else if (kind === 'ocean' && rng() < LOOK.waveChance) {
      // One small "~" stroke
      const w = 0.36;
      const cx = x + (rng() - 0.5) * 0.5;
      const cy = y + (rng() - 0.5) * 0.5;
      ctx.strokeStyle = css(P.waveColor, P.waveAlpha);
      ctx.lineWidth = LOOK.waveWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w, cy);
      ctx.quadraticCurveTo(cx - w / 2, cy - 0.16, cx, cy);
      ctx.quadraticCurveTo(cx + w / 2, cy + 0.16, cx + w, cy);
      ctx.stroke();
    }
  });
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
  const tiles: PreviewTile[] = map.tiles.map((_, i) => {
    const hex = hexAtIndex(map, i);
    const center = hexToPixel(hex, 1);
    return { q: hex.q, r: hex.r, center, corners: hexCorners(center, 1) };
  });
  const minX = Math.min(...tiles.map((t) => t.center.x)) - Math.sqrt(3) / 2;
  const maxX = Math.max(...tiles.map((t) => t.center.x)) + Math.sqrt(3) / 2;
  const minY = Math.min(...tiles.map((t) => t.center.y)) - 1;
  const maxY = Math.max(...tiles.map((t) => t.center.y)) + 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const scale = cssW / (maxX - minX);
  const cssH = (maxY - minY) * scale;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -minX * dpr * scale, -minY * dpr * scale);
  ctx.fillStyle = css(theme.terrainColors.ocean);
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

  // 1. Tile fills, each with the game's slight per-tile tone (a hair larger: no seams)
  map.tiles.forEach((terrain, i) => {
    const t = tiles[i];
    ctx.fillStyle = css(tileBaseColor(terrain, hexAtIndex(map, i)));
    ctx.beginPath();
    polygon(ctx, hexCorners(t.center, 1.03));
    ctx.fill();
  });

  // 2. Water: deep sea fades into the turquoise coast, a lighter shallow band along the shore
  const coastIntoOcean: Point[][] = [];
  const oceanIntoCoast: Point[][] = [];
  const shallow: Point[][] = [];
  const sand: Point[][] = [];
  const pebbles: Point[][] = [];
  const wet: Point[][] = [];
  const foam: Point[][] = [];
  map.tiles.forEach((terrain, i) => {
    const t = tiles[i];
    const hex = hexAtIndex(map, i);
    const shore = shoreMask(map, hex);
    const hasShore = shore.some(Boolean);
    if (terrain === 'coast') {
      const toOcean = edgeMask(map, hex, (n) => n === 'ocean');
      for (const d of P.seaBlendDepths)
        coastIntoOcean.push(...insetBands(t.center, t.corners, toOcean, d));
    } else if (terrain === 'ocean') {
      const toCoast = edgeMask(map, hex, (n) => n === 'coast');
      for (const d of P.seaBlendDepths)
        oceanIntoCoast.push(...insetBands(t.center, t.corners, toCoast, d));
    }
    if (!hasShore) return;
    if (isWater(terrain)) {
      shallow.push(...insetBands(t.center, t.corners, shore, P.shallowDepth));
      foam.push(...insetStrips(t.center, t.corners, shore, LOOK.foamFrom, LOOK.foamTo));
    } else {
      const bands = insetBands(t.center, t.corners, shore, LOOK.beachDepth);
      (terrain === 'mountains' ? pebbles : sand).push(...bands);
      wet.push(...insetBands(t.center, t.corners, shore, LOOK.beachWetDepth));
    }
  });
  fillAll(ctx, coastIntoOcean, theme.terrainColors.ocean, P.seaBlendAlpha);
  fillAll(ctx, oceanIntoCoast, theme.terrainColors.coast, P.seaBlendAlpha);
  fillAll(ctx, shallow, P.shallowColor, P.shallowAlpha);

  // 3. Sand rim along every shore (pebbles below mountains), wet sand at the waterline, foam
  fillAll(ctx, sand, P.sandColor);
  fillAll(ctx, pebbles, P.pebbleColor);
  fillAll(ctx, wet, P.sandWetColor, P.beachWetAlpha);
  fillAll(ctx, foam, P.foamColor, LOOK.foamAlpha);

  // 4. Trees, mounds, peaks and waves
  paintMarks(ctx, tiles, (i) => map.tiles[i]);

  // 5. Sunlight from the upper left, soft shade towards the lower right
  const light = ctx.createLinearGradient(minX, minY, maxX, maxY);
  light.addColorStop(0, `rgba(255, 248, 225, ${LOOK.sunAlpha})`);
  light.addColorStop(0.45, 'rgba(255, 248, 225, 0)');
  light.addColorStop(0.6, 'rgba(29, 43, 54, 0)');
  light.addColorStop(1, css(theme.outlineColor, LOOK.shadeAlpha));
  ctx.fillStyle = light;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
}
