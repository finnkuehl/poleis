// Dev-only art gallery (open /art-preview.html with `npm run dev`): shows every drawn asset
// from public/assets at the sizes and on the backgrounds used in the game (see docs/ART.md).
// Not part of the production build. Files that do not exist yet show a light placeholder.
// Buildings and units are composed like in the game: the accent layer (`<id>.accent.svg`,
// tinted in the player color with a multiply layer) UNDER the art, which has holes there.
import { BUILDING_IDS, GOOD_IDS, UNIT_IDS } from './data';

type AssetKind = 'goods' | 'buildings' | 'units';

/** Sizes (px) at which every asset is shown on each background. */
const SIZES = [20, 40, 96] as const;

/** The four player colors: Tyrian purple, cinnabar, Aegean blue, gold. */
const PLAYER_COLORS = ['#6e3a8e', '#b23a30', '#2e6da4', '#c9a227'] as const;

/** Ships have art but are not in UNIT_IDS yet (seafaring comes with M6). */
const EXTRA_UNIT_IDS = ['transport', 'trireme'] as const;

/** Size (px) of a unit and of a building in the player-color row (about map size). */
const UNIT_MAP_SIZE = 48;
const BUILDING_MAP_SIZE = 72;

const SECTIONS: readonly { kind: AssetKind; title: string; ids: readonly string[] }[] = [
  { kind: 'goods', title: 'Goods', ids: GOOD_IDS },
  { kind: 'buildings', title: 'Buildings', ids: BUILDING_IDS },
  { kind: 'units', title: 'Units', ids: [...new Set<string>([...UNIT_IDS, ...EXTRA_UNIT_IDS])] },
];

function assetUrl(kind: AssetKind, id: string): string {
  return `${import.meta.env.BASE_URL}assets/${kind}/${id}.svg`;
}

function accentUrl(kind: AssetKind, id: string): string {
  return `${import.meta.env.BASE_URL}assets/${kind}/${id}.accent.svg`;
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** An image of the asset; swaps itself for a placeholder if the file is missing. */
function art(kind: AssetKind, id: string, size: number, onMissing: () => void): HTMLElement {
  const img = document.createElement('img');
  img.width = size;
  img.height = size;
  img.alt = id;
  img.addEventListener('error', () => {
    const placeholder = el('span', 'missing');
    placeholder.style.width = `${size}px`;
    placeholder.style.height = `${size}px`;
    placeholder.title = `${id} (missing)`;
    img.replaceWith(placeholder);
    onMissing();
  });
  img.src = assetUrl(kind, id);
  return img;
}

/** Callbacks of one asset row: the art file or the accent file does not exist. */
interface RowFlags {
  onMissing(): void;
  onNoAccent(): void;
}

/**
 * The asset as the game shows it. Goods: the flat icon. Buildings and units, bottom to top:
 * accent image, player color in multiply masked by the accent, art image.
 */
function composed(
  kind: AssetKind,
  id: string,
  size: number,
  color: string,
  flags: RowFlags,
): HTMLElement {
  if (kind === 'goods') return art(kind, id, size, flags.onMissing);
  const box = el('div', 'layered');
  box.style.width = `${size}px`;
  box.style.height = `${size}px`;
  const url = accentUrl(kind, id);
  const accent = document.createElement('img');
  accent.alt = '';
  accent.width = size;
  accent.height = size;
  const tint = el('div', 'tint');
  tint.style.backgroundColor = color;
  tint.style.setProperty('-webkit-mask-image', `url("${url}")`);
  tint.style.setProperty('mask-image', `url("${url}")`);
  accent.addEventListener('error', () => {
    accent.remove();
    tint.remove();
    flags.onNoAccent();
  });
  accent.src = url;
  box.append(accent, tint, art(kind, id, size, flags.onMissing));
  return box;
}

function strip(
  kind: AssetKind,
  id: string,
  background: 'marble' | 'sea',
  flags: RowFlags,
): HTMLElement {
  const row = el('div', `strip ${background}`);
  for (const size of SIZES) row.append(composed(kind, id, size, PLAYER_COLORS[0], flags));
  return row;
}

/** The asset in each of the four player colors on a meadow-colored map strip. */
function playerRow(kind: 'buildings' | 'units', id: string, flags: RowFlags): HTMLElement {
  const row = el('div', 'map-row');
  const size = kind === 'units' ? UNIT_MAP_SIZE : BUILDING_MAP_SIZE;
  for (const color of PLAYER_COLORS) row.append(composed(kind, id, size, color, flags));
  return row;
}

function assetRow(kind: AssetKind, id: string): HTMLElement {
  const row = el('div', 'asset');
  const label = el('div', 'asset-id', id);
  // Each note once per row, however many images report it.
  const notes = new Set<string>();
  const note = (text: string): void => {
    if (notes.has(text)) return;
    notes.add(text);
    label.append(el('small', undefined, text));
  };
  const flags: RowFlags = {
    onMissing: () => note('missing'),
    onNoAccent: () => note('no accent layer'),
  };
  row.append(label, strip(kind, id, 'marble', flags), strip(kind, id, 'sea', flags));
  if (kind !== 'goods') row.append(playerRow(kind, id, flags));
  return row;
}

const gallery = document.getElementById('gallery');
if (!gallery) throw new Error('Missing gallery container');

gallery.append(
  el('h1', undefined, 'Poleis art gallery'),
  el(
    'p',
    undefined,
    `Every asset at ${SIZES.join(', ')} px on marble and on the sea-blue bar (accent in Tyrian purple); buildings and units in the four player colors on a map strip.`,
  ),
);
for (const section of SECTIONS) {
  gallery.append(el('h2', undefined, `${section.title} (${section.ids.length})`));
  for (const id of section.ids) gallery.append(assetRow(section.kind, id));
}
