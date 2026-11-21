// Info panel for a tapped tile (bottom sheet on phones, card on desktop).
import { axialToOffset, type Hex } from '../core/hex';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { en } from '../i18n/en';
import { theme } from '../render/theme';

export interface InfoRow {
  label: string;
  value: string;
}

/** Rows of the info panel for a terrain (pure function, no DOM). */
export function tileInfoRows(terrain: TerrainId): InfoRow[] {
  const def = TERRAIN[terrain];
  const t = en.tileInfo;
  let movement: string;
  if (def.moveCost !== null) movement = def.moveCost.toLocaleString('en-US');
  else movement = def.isWater ? t.shipsOnly : t.impassable;
  const defense = def.defenseBonus !== null ? `×${def.defenseBonus.toLocaleString('en-US')}` : '–';
  return [
    { label: t.movement, value: movement },
    { label: t.defense, value: defense },
    { label: t.buildable, value: def.buildable ? t.yes : t.no },
  ];
}

function cssColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function createTileInfoPanel(
  root: HTMLElement,
  onClose: () => void,
): { show(h: Hex, terrain: TerrainId): void; hide(): void } {
  const panel = document.createElement('section');
  panel.className = 'tile-info';
  panel.hidden = true;

  const header = document.createElement('div');
  header.className = 'tile-info__header';
  const swatch = document.createElement('span');
  swatch.className = 'tile-info__swatch';
  const titles = document.createElement('div');
  titles.className = 'tile-info__titles';
  const title = document.createElement('h2');
  title.className = 'tile-info__title';
  const coords = document.createElement('p');
  coords.className = 'tile-info__coords';
  titles.append(title, coords);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tile-info__close';
  close.textContent = '✕';
  close.setAttribute('aria-label', en.tileInfo.close);
  header.append(swatch, titles, close);

  const list = document.createElement('dl');
  list.className = 'tile-info__rows';
  const note = document.createElement('p');
  note.className = 'tile-info__note';
  panel.append(header, list, note);
  root.appendChild(panel);

  const hide = (): void => {
    panel.hidden = true;
  };
  close.addEventListener('click', () => {
    hide();
    onClose();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      hide();
      onClose();
    }
  });

  return {
    show(h, terrain) {
      const { col, row } = axialToOffset(h);
      swatch.style.background = cssColor(theme.terrainColors[terrain]);
      title.textContent = en.terrain[terrain];
      coords.textContent = `${en.tileInfo.tile} ${col + 1}/${row + 1}`;
      list.replaceChildren();
      for (const r of tileInfoRows(terrain)) {
        const wrap = document.createElement('div');
        wrap.className = 'tile-info__row';
        const dt = document.createElement('dt');
        dt.textContent = r.label;
        const dd = document.createElement('dd');
        dd.textContent = r.value;
        wrap.append(dt, dd);
        list.appendChild(wrap);
      }
      note.textContent = en.terrainNote[terrain];
      panel.hidden = false;
    },
    hide,
  };
}
