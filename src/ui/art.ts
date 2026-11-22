// Drawn art for the HTML UI: goods icons, building miniatures and unit figures from
// public/assets (see docs/ART.md). Each icon is a small square box with the image; buildings and
// units also get their owner-colored accent layer (`<id>.accent.svg`, tinted with a CSS mask).
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
 * What each icon box shows of the canvas. Buildings (256 canvas, base 208 wide from x 24 to 232,
 * base center at y 176) and units (128 canvas, token 88 wide, center at y 96) leave empty space
 * at the top and the sides, so the icon zooms in a little to let the miniature fill the box.
 * Adjust these if a drawing gets cut off.
 */
export const ART_FRAMES: Readonly<Record<ArtKind, ArtFrame>> = {
  goods: { canvas: 64, x: 0, y: 0, size: 64 },
  buildings: { canvas: 256, x: 16, y: 28, size: 224 },
  units: { canvas: 128, x: 8, y: 12, size: 112 },
};

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

/** Adds the tinted owner-color layer once its file is known to exist. */
function addTint(box: HTMLElement, kind: ArtKind, id: string, color: string): void {
  const url = accentUrl(kind, id);
  if (!shouldTryArt(statuses[url])) return;
  const attach = (): void => {
    if (box.classList.contains('art--emoji')) return;
    const tint = document.createElement('span');
    tint.className = 'art__layer art__tint';
    // The grey accent drawing multiplied with the player color, cut to the drawing's shape.
    tint.style.backgroundImage = `url("${url}")`;
    tint.style.backgroundColor = color;
    tint.style.setProperty('-webkit-mask-image', `url("${url}")`);
    tint.style.setProperty('mask-image', `url("${url}")`);
    box.appendChild(tint);
  };
  if (statuses[url] === 'loaded') {
    attach();
    return;
  }
  const probe = new Image();
  probe.addEventListener('load', () => {
    statuses[url] = 'loaded';
    attach();
  });
  probe.addEventListener('error', () => {
    statuses[url] = 'missing';
  });
  probe.src = url;
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
  const layout = frameLayout(ART_FRAMES[kind]);
  box.style.setProperty('--art-zoom', layout.zoom);
  box.style.setProperty('--art-left', layout.left);
  box.style.setProperty('--art-top', layout.top);
  const img = document.createElement('img');
  img.className = 'art__layer art__img';
  img.alt = '';
  img.draggable = false;
  img.addEventListener('load', () => {
    statuses[url] = 'loaded';
  });
  img.addEventListener('error', () => {
    statuses[url] = 'missing';
    showEmoji(box, emoji);
  });
  img.src = url;
  box.appendChild(img);
  if (color !== undefined && hasAccentLayer(kind)) addTint(box, kind, id, color);
  return box;
}

/** Icon of a good (flat icon; the emoji while the file is missing). */
export function goodIcon(id: GoodId): HTMLSpanElement {
  return artIcon('goods', id, GOODS[id].icon);
}

/** Miniature of a building on its base, the base rim in `color` (default: the human's color). */
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
