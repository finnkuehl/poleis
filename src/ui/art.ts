// Drawn art for the HTML UI: goods icons, building miniatures and unit figures from
// public/assets (see docs/ART.md). Each icon is a small square box with the image; buildings and
// units also get their owner-colored accent layer (`<id>.accent.svg`). Draw order (docs/ART.md):
// the accent goes UNDER the art – the art has transparent holes where the accents are:
//   1. accent image (neutral greys with light and shade)
//   2. player color, `mix-blend-mode: multiply`, masked by the accent → tinted, shading kept
//   3. art image on top
// Missing files fall back to the emoji from src/data, so a missing drawing never shows a broken
// image. The box fills its container: size it with the container's CSS class.
import { BUILDINGS, GOODS, UNITS, type BuildingId, type GoodId, type UnitId } from '../data';
import type { PlayerState } from '../core/state';
import { playerCssColor } from './playerColors';

export type ArtKind = 'goods' | 'buildings' | 'units';

/** A square cut-out of the art canvas (art pixels) that the icon box shows. */
export interface ArtFrame {
  /** Width and height of the SVG canvas (its viewBox). */
  canvas: number;
  /** Top-left corner and side length of the shown square. */
  x: number;
  y: number;
  size: number;
}

/**
 * Default cut-out per kind: what the icon box shows of the canvas. The default must never cut a
 * drawing, so it shows nearly the whole canvas (buildings without a measured frame below).
 * Units: 128 canvas, token 88 wide with its center at (64, 96).
 */
export const ART_FRAMES: Readonly<Record<ArtKind, ArtFrame>> = {
  goods: { canvas: 64, x: 0, y: 0, size: 64 },
  buildings: { canvas: 256, x: 5, y: 4, size: 250 },
  units: { canvas: 128, x: 4, y: 4, size: 120 },
};

/** Bounding box of a drawing on its canvas: minX, minY, maxX, maxY (art pixels). */
export type ArtBounds = readonly [number, number, number, number];

/**
 * Measured bounding boxes of the grounded building art (art + owner layer, pixels with at least
 * 50 % alpha, 256 canvas; the fishery: its icon file fishery.svg). Update an entry when its
 * drawing changes; the icon frame is derived from it.
 */
export const BUILDING_ART_BOUNDS: Readonly<Record<BuildingId, ArtBounds>> = {
  house: [54, 95, 196, 214],
  farm: [67, 93, 201, 213],
  woodcutter: [46, 92, 188, 214],
  storehouse: [54, 88, 210, 216],
  temple: [47, 60, 204, 216],
  cityCenter: [47, 43, 224, 216],
  fishery: [51, 94, 188, 217],
  sawmill: [46.5, 96.5, 208.5, 211],
  bakery: [57.5, 84, 195.5, 213],
  oilPress: [61.5, 88, 212.5, 207.5],
  winery: [46.5, 93.5, 200, 201.5],
  // incl. the smoke
  smelter: [46.5, 52, 197.5, 214.5],
  quarry: [44.5, 79, 200.5, 214.5],
  mine: [62, 77.5, 206.5, 204.5],
  barracks: [49.2, 48.2, 218, 205.5],
  marketplace: [46.8, 72.2, 199.2, 218.5],
  wonder: [47, 6.8, 206.5, 217],
  borderTower: [60, 16, 173.8, 208.8],
  vineyard: [88, 96.5, 178.5, 201],
  oliveGrove: [33, 94.2, 220.5, 224.8],
};

/** Free space around a drawing in its icon: share of its longer side. */
export const ART_FRAME_MARGIN = 0.08;

/**
 * Square cut-out around a drawing: centered on its bounding box, the longer side plus the margin,
 * moved (not shrunk) to stay inside the canvas where possible.
 */
export function frameAround(
  bounds: ArtBounds,
  canvas: number,
  margin = ART_FRAME_MARGIN,
): ArtFrame {
  const [minX, minY, maxX, maxY] = bounds;
  const size = Math.min(canvas, Math.max(maxX - minX, maxY - minY) * (1 + margin));
  const fit = (center: number): number => Math.max(0, Math.min(canvas - size, center - size / 2));
  const round = (n: number): number => Math.round(n * 10) / 10;
  return {
    canvas,
    x: round(fit((minX + maxX) / 2)),
    y: round(fit((minY + maxY) / 2)),
    size: round(size),
  };
}

/** The icon cut-out of every building, one per drawing (from its bounding box). */
export const BUILDING_FRAMES: Readonly<Record<BuildingId, ArtFrame>> = Object.fromEntries(
  (Object.keys(BUILDING_ART_BOUNDS) as BuildingId[]).map((id) => [
    id,
    frameAround(BUILDING_ART_BOUNDS[id], 256),
  ]),
) as Record<BuildingId, ArtFrame>;

/** The cut-out of one asset: a building's own frame if it has one, else the kind's default. */
export function artFrame(kind: ArtKind, id: string): ArtFrame {
  const own = kind === 'buildings' ? BUILDING_FRAMES[id as BuildingId] : undefined;
  return own ?? ART_FRAMES[kind];
}

/** Load state of one art file: unknown until the browser tried it once. */
export type ArtStatus = 'loaded' | 'missing';

/** Url of an asset (`base` is Vite's base: "/" locally, "/poleis/" in builds). */
export function artUrl(kind: ArtKind, id: string, base: string = import.meta.env.BASE_URL): string {
  return `${base}assets/${kind}/${id}.svg`;
}

/** Url of the owner-color layer of a building or unit. */
export function accentUrl(
  kind: ArtKind,
  id: string,
  base: string = import.meta.env.BASE_URL,
): string {
  return `${base}assets/${kind}/${id}.accent.svg`;
}

/** Should the UI try to load this file? No once it is known to be missing (then: emoji). */
export function shouldTryArt(status: ArtStatus | undefined): boolean {
  return status !== 'missing';
}

/** Only buildings and units have an owner-color layer; goods icons are flat. */
export function hasAccentLayer(kind: ArtKind): boolean {
  return kind !== 'goods';
}

function percent(n: number): string {
  return `${Math.round(n * 100000) / 1000}%`;
}

/**
 * Position of the image inside the square box, in percent of the box: the image is `zoom` wide
 * and high and shifted by `left` / `top`, so exactly the frame's square is visible.
 */
export function frameLayout(frame: ArtFrame): { zoom: string; left: string; top: string } {
  return {
    zoom: percent(frame.canvas / frame.size),
    left: percent(-frame.x / frame.size),
    top: percent(-frame.y / frame.size),
  };
}

/** CSS colors of the players (by id) and of the human ("own" color). */
export interface ArtColors {
  own: string;
  byId: Record<number, string>;
}

/** Default before a game is known: Tyrian purple (player color 0). */
const DEFAULT_COLORS: ArtColors = { own: playerCssColor(0), byId: {} };

/** Colors from the players of a game: the human's color is the default for the own art. */
export function artColorsOf(
  players: readonly Pick<PlayerState, 'id' | 'color' | 'isHuman'>[],
): ArtColors {
  const byId: Record<number, string> = {};
  for (const p of players) byId[p.id] = playerCssColor(p.color);
  const human = players.find((p) => p.isHuman);
  return { own: human ? playerCssColor(human.color) : DEFAULT_COLORS.own, byId };
}

let colors: ArtColors = DEFAULT_COLORS;
/** What the browser found out about each url (so missing files are not requested again). */
const statuses: Record<string, ArtStatus> = {};

/** Sets the player colors for owner-colored art (call once when a game starts). */
export function setArtPlayers(
  players: readonly Pick<PlayerState, 'id' | 'color' | 'isHuman'>[],
): void {
  colors = artColorsOf(players);
}

/** CSS color of a player's art; no owner or an unknown one = the human's color. */
export function ownerColor(owner?: number): string {
  return owner === undefined ? colors.own : (colors.byId[owner] ?? colors.own);
}

function showEmoji(box: HTMLElement, emoji: string): void {
  box.replaceChildren();
  box.removeAttribute('style');
  box.className = 'art art--emoji';
  box.textContent = emoji;
}

function layerImage(className: string, url: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = `art__layer ${className}`;
  img.alt = '';
  img.draggable = false;
  img.src = url;
  return img;
}

/**
 * Appends the owner-color layers (accent image + player color in multiply, masked by the
 * accent). Must run before the art image is appended: the accent lies under the art.
 * A missing accent file removes both layers again (and is not requested again).
 */
function appendAccent(box: HTMLElement, kind: ArtKind, id: string, color: string): void {
  const url = accentUrl(kind, id);
  if (!shouldTryArt(statuses[url])) return;
  const accent = layerImage('art__accent', url);
  const tint = document.createElement('span');
  tint.className = 'art__layer art__tint';
  tint.style.backgroundColor = color;
  tint.style.setProperty('-webkit-mask-image', `url("${url}")`);
  tint.style.setProperty('mask-image', `url("${url}")`);
  accent.addEventListener('load', () => {
    statuses[url] = 'loaded';
  });
  accent.addEventListener('error', () => {
    statuses[url] = 'missing';
    accent.remove();
    tint.remove();
  });
  box.append(accent, tint);
}

function artIcon(kind: ArtKind, id: string, emoji: string, color?: string): HTMLSpanElement {
  const box = document.createElement('span');
  box.setAttribute('aria-hidden', 'true');
  const url = artUrl(kind, id);
  if (!shouldTryArt(statuses[url])) {
    showEmoji(box, emoji);
    return box;
  }
  box.className = `art art--${kind}`;
  const layout = frameLayout(artFrame(kind, id));
  box.style.setProperty('--art-zoom', layout.zoom);
  box.style.setProperty('--art-left', layout.left);
  box.style.setProperty('--art-top', layout.top);
  if (color !== undefined && hasAccentLayer(kind)) appendAccent(box, kind, id, color);
  const img = layerImage('art__img', url);
  img.addEventListener('load', () => {
    statuses[url] = 'loaded';
  });
  img.addEventListener('error', () => {
    statuses[url] = 'missing';
    showEmoji(box, emoji);
  });
  box.appendChild(img);
  return box;
}

/** Icon of a good (flat icon; the emoji while the file is missing). */
export function goodIcon(id: GoodId): HTMLSpanElement {
  return artIcon('goods', id, GOODS[id].icon);
}

/** Miniature of a building, its owner-colored details in `color` (default: the human's color). */
export function buildingIcon(id: BuildingId, color: string = ownerColor()): HTMLSpanElement {
  return artIcon('buildings', id, BUILDINGS[id].icon, color);
}

/** Figure of a unit on its token, the token in `color` (default: the human's color). */
export function unitIcon(id: UnitId, color: string = ownerColor()): HTMLSpanElement {
  return artIcon('units', id, UNITS[id].icon, color);
}

/** Inline goods text with its icon in front, e.g. [wood icon] "3 Wood" (cost lists). */
export function goodText(good: GoodId, text: string, className = 'cost-part'): HTMLSpanElement {
  const part = document.createElement('span');
  part.className = className;
  const icon = document.createElement('span');
  icon.className = 'cost-part__icon';
  icon.appendChild(goodIcon(good));
  part.append(icon, document.createTextNode(text));
  return part;
}
