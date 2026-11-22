// Loads the drawn SVG art (public/assets, see docs/ART.md) once at startup and rasterizes every file
// into a shared texture. Missing or broken files simply have no entry: the map then draws the old
// colored plate / token with an emoji instead.
import { Container, ImageSource, Sprite, Texture } from 'pixi.js';
import { BUILDING_IDS, UNIT_IDS } from '../data';
import { hexSize } from './config';
import {
  artPlacement,
  isSvgText,
  parseSvgViewBox,
  rasterSizePx,
  withSvgSize,
  type ArtKind,
  type ArtPlacement,
  type ViewBox,
} from './artLayout';

/** One drawn object: the art and its optional owner-color layer, both on the same canvas. */
export interface ArtAsset {
  /** Color-neutral art (`<id>.svg`). */
  art: Texture;
  /** Grey owner-color parts (`<id>.accent.svg`), tinted with the player color; null if missing. */
  accent: Texture | null;
  /** Sprite anchor (0..1 of the canvas). */
  anchorX: number;
  anchorY: number;
  /** Sprite scale (the same for both layers). */
  scale: number;
  placement: ArtPlacement;
}

export interface ArtSet {
  buildings: Readonly<Partial<Record<string, ArtAsset>>>;
  units: Readonly<Partial<Record<string, ArtAsset>>>;
}

/** Gives `sprite` one layer of `asset` (shared texture, the asset's anchor and scale). */
export function setArtLayer(sprite: Sprite, asset: ArtAsset, texture: Texture): Sprite {
  sprite.texture = texture;
  sprite.anchor.set(asset.anchorX, asset.anchorY);
  sprite.scale.set(asset.scale);
  return sprite;
}

/** One drawn object on the map; `root` is placed on the tile point and sorted as one piece. */
export interface ArtObject {
  root: Container;
  /** The owner-color layer (set its `tint` to the player color), null if the asset has none. */
  accent: Sprite | null;
}

/**
 * Builds the container of one object: the tinted owner layer FIRST, the art on top. The art has
 * transparent holes exactly where the owner parts are (docs/ART.md, "Draw order"), so things in
 * front of an owner part hide it and shadows painted on top darken the tinted color.
 */
export function createArtObject(asset: ArtAsset): ArtObject {
  const root = new Container();
  const accent = asset.accent ? setArtLayer(new Sprite(), asset, asset.accent) : null;
  if (accent) root.addChild(accent);
  root.addChild(setArtLayer(new Sprite(), asset, asset.art));
  return { root, accent };
}

/** No art at all: everything is drawn with plates / tokens and emoji. */
export const NO_ART: ArtSet = { buildings: {}, units: {} };

/** Ships have art but no unit type yet (seafaring comes with M6). */
const EXTRA_UNIT_ART_IDS = ['transport', 'trireme'] as const;

const FOLDERS: Record<ArtKind, string> = { building: 'buildings', unit: 'units' };

function artUrl(kind: ArtKind, file: string): string {
  return `${import.meta.env.BASE_URL}assets/${FOLDERS[kind]}/${file}`;
}

/** Text of an SVG file, or null if it is missing (404, HTML fallback page) or unreadable. */
async function fetchSvg(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null;
    const text = await res.text();
    return isSvgText(text) ? text : null;
  } catch {
    return null;
  }
}

/** Loads an image (onload works for SVG in every browser; `decode()` is unreliable there). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the image'));
    image.src = src;
  });
}

/** Rasterizes an SVG once into a canvas texture whose size in texture units is the viewBox size. */
async function rasterize(svg: string, vb: ViewBox, sizePx: number): Promise<Texture | null> {
  try {
    const resolution = sizePx / Math.max(vb.width, vb.height);
    const w = Math.max(1, Math.round(vb.width * resolution));
    const h = Math.max(1, Math.round(vb.height * resolution));
    const image = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withSvgSize(svg, w, h))}`,
    );
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, w, h);
    const source = new ImageSource({
      resource: canvas,
      resolution: w / vb.width,
      alphaMode: 'premultiply-alpha-on-upload',
      // Mipmaps keep the art smooth when zoomed out (a 384 px texture drawn at ~60 px)
      autoGenerateMipmaps: true,
    });
    return new Texture({ source });
  } catch {
    return null;
  }
}

interface LoadResult {
  asset: ArtAsset | null;
  /** File names that are missing or could not be read. */
  missing: string[];
}

async function loadAsset(kind: ArtKind, id: string, dpr: number): Promise<LoadResult> {
  const missing: string[] = [];
  const [main, accentSvg] = await Promise.all([
    fetchSvg(artUrl(kind, `${id}.svg`)),
    fetchSvg(artUrl(kind, `${id}.accent.svg`)),
  ]);
  const vb = main ? parseSvgViewBox(main) : null;
  if (!main || !vb) {
    return { asset: null, missing: [`${FOLDERS[kind]}/${id}.svg`] };
  }
  const placement = artPlacement(kind, vb, hexSize);
  const sizePx = rasterSizePx(placement, dpr, hexSize);
  // The owner layer only counts if it is on the same canvas as the art.
  const accentVb = accentSvg ? parseSvgViewBox(accentSvg) : null;
  const accentFits =
    accentVb !== null &&
    accentVb.x === vb.x &&
    accentVb.y === vb.y &&
    accentVb.width === vb.width &&
    accentVb.height === vb.height;
  const [art, accent] = await Promise.all([
    rasterize(main, vb, sizePx),
    accentSvg && accentFits ? rasterize(accentSvg, vb, sizePx) : Promise.resolve(null),
  ]);
  if (!art) return { asset: null, missing: [`${FOLDERS[kind]}/${id}.svg`] };
  if (!accent) missing.push(`${FOLDERS[kind]}/${id}.accent.svg`);
  return {
    asset: {
      art,
      accent,
      anchorX: placement.anchorX,
      anchorY: placement.anchorY,
      // World width of the canvas divided by the texture width (= viewBox width in texture units)
      scale: placement.width / art.width,
      placement,
    },
    missing,
  };
}

/**
 * Loads all building and unit art in parallel. `dpr` is the renderer's device pixel ratio
 * (the texture size follows it). Never rejects: failed files are left out.
 */
export async function loadArt(dpr: number): Promise<ArtSet> {
  const jobs: { kind: ArtKind; id: string }[] = [
    ...BUILDING_IDS.map((id) => ({ kind: 'building' as const, id })),
    ...[...new Set<string>([...UNIT_IDS, ...EXTRA_UNIT_ART_IDS])].map((id) => ({
      kind: 'unit' as const,
      id,
    })),
  ];
  const results = await Promise.all(jobs.map((j) => loadAsset(j.kind, j.id, dpr)));
  const buildings: Partial<Record<string, ArtAsset>> = {};
  const units: Partial<Record<string, ArtAsset>> = {};
  const missing: string[] = [];
  results.forEach((r, i) => {
    const { kind, id } = jobs[i];
    if (r.asset) (kind === 'building' ? buildings : units)[id] = r.asset;
    missing.push(...r.missing);
  });
  if (import.meta.env.DEV && missing.length > 0) {
    console.warn(
      `[art] ${missing.length} art files missing or unreadable, using the fallback look: ${missing.join(', ')}`,
    );
  }
  return { buildings, units };
}
