// Dev-only art gallery (open /art-preview.html with `npm run dev`): shows every drawn asset
// from public/assets at the sizes and on the backgrounds used in the game (see docs/ART.md).
// Not part of the production build. Files that do not exist yet show a light placeholder.
import { BUILDING_IDS, GOOD_IDS, UNIT_IDS } from './data';

type AssetKind = 'goods' | 'buildings' | 'units';

/** Sizes (px) at which every asset is shown on each background. */
const SIZES = [20, 40, 96] as const;

/** The four player colors: Tyrian purple, cinnabar, Aegean blue, gold. */
const PLAYER_COLORS = ['#6e3a8e', '#b23a30', '#2e6da4', '#c9a227'] as const;

/** Ships have art but are not in UNIT_IDS yet (seafaring comes with M6). */
const EXTRA_UNIT_IDS = ['transport', 'trireme'] as const;

/** Drawn size (px) of a unit on its token and of a building on its base. */
const TOKEN_ART_SIZE = 44;
const BASE_ART_SIZE = 72;

const SECTIONS: readonly { kind: AssetKind; title: string; ids: readonly string[] }[] = [
  { kind: 'goods', title: 'Goods', ids: GOOD_IDS },
  { kind: 'buildings', title: 'Buildings', ids: BUILDING_IDS },
  { kind: 'units', title: 'Units', ids: [...new Set<string>([...UNIT_IDS, ...EXTRA_UNIT_IDS])] },
];

function assetUrl(kind: AssetKind, id: string): string {
  return `${import.meta.env.BASE_URL}assets/${kind}/${id}.svg`;
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

function strip(kind: AssetKind, id: string, background: 'marble' | 'sea', onMissing: () => void) {
  const row = el('div', `strip ${background}`);
  for (const size of SIZES) row.append(art(kind, id, size, onMissing));
  return row;
}

/** Units on round tokens, buildings on round bases, both on a meadow-colored map strip. */
function playerRow(kind: 'buildings' | 'units', id: string, onMissing: () => void): HTMLElement {
  const row = el('div', 'map-row');
  for (const color of PLAYER_COLORS) {
    if (kind === 'units') {
      const token = el('div', 'token');
      token.style.background = color;
      token.append(art(kind, id, TOKEN_ART_SIZE, onMissing));
      row.append(token);
    } else {
      const based = el('div', 'based');
      based.style.setProperty('--player', color);
      based.append(art(kind, id, BASE_ART_SIZE, onMissing));
      row.append(based);
    }
  }
  return row;
}

function assetRow(kind: AssetKind, id: string): HTMLElement {
  const row = el('div', 'asset');
  const label = el('div', 'asset-id', id);
  let flagged = false;
  const onMissing = (): void => {
    if (flagged) return;
    flagged = true;
    label.append(el('small', undefined, 'missing'));
  };
  row.append(label, strip(kind, id, 'marble', onMissing), strip(kind, id, 'sea', onMissing));
  if (kind !== 'goods') row.append(playerRow(kind, id, onMissing));
  return row;
}

const gallery = document.getElementById('gallery');
if (!gallery) throw new Error('Missing gallery container');

gallery.append(
  el('h1', undefined, 'Poleis art gallery'),
  el(
    'p',
    undefined,
    `Every asset at ${SIZES.join(', ')} px on marble and on the sea-blue bar; units on player tokens, buildings on player bases.`,
  ),
);
for (const section of SECTIONS) {
  gallery.append(el('h2', undefined, `${section.title} (${section.ids.length})`));
  for (const id of section.ids) gallery.append(assetRow(section.kind, id));
}
