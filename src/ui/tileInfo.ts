// Infopanel für ein angetipptes Feld (Bottom Sheet am Handy, Karte am Desktop).
import { axialToOffset, type Hex } from '../core/hex';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { de } from '../i18n/de';
import { theme } from '../render/theme';

export interface InfoRow {
  label: string;
  value: string;
}

/** Zeilen des Infopanels für ein Terrain (reine Funktion, ohne DOM). */
export function tileInfoRows(terrain: TerrainId): InfoRow[] {
  const def = TERRAIN[terrain];
  const t = de.tileInfo;
  let movement: string;
  if (def.moveCost !== null) movement = def.moveCost.toLocaleString('de-DE');
  else movement = def.isWater ? t.shipsOnly : t.impassable;
  const defense = def.defenseBonus !== null ? `×${def.defenseBonus.toLocaleString('de-DE')}` : '–';
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
  close.setAttribute('aria-label', de.tileInfo.close);
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
      title.textContent = de.terrain[terrain];
      coords.textContent = `${de.tileInfo.tile} ${col + 1}/${row + 1}`;
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
      note.textContent = de.terrainNote[terrain];
      panel.hidden = false;
    },
    hide,
  };
}
