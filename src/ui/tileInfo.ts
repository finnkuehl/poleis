// Info panel for a tapped tile: terrain, building or road (bottom sheet on phones, card on desktop).
import { axialToOffset, type Hex } from '../core/hex';
import type { BuildingStatus } from '../core/rules/production';
import { BUILDINGS, type BuildingId } from '../data';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { en } from '../i18n/en';
import { fill, formatStatus } from '../i18n/format';
import { theme } from '../render/theme';
import { perTurnText, statusTone } from './buildingText';
import { button, el } from './dom';

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

export interface BuildingInfo {
  hex: Hex;
  terrain: TerrainId;
  type: BuildingId;
  status: BuildingStatus;
  workers: { assigned: number; needed: number };
  /** If set, a Demolish button is shown. */
  onDemolish?: () => void;
}

export interface RoadInfo {
  hex: Hex;
  terrain: TerrainId;
  onDemolish(): void;
}

export interface TileInfoPanel {
  showTerrain(h: Hex, terrain: TerrainId): void;
  showBuilding(o: BuildingInfo): void;
  showRoad(o: RoadInfo): void;
  /** Same as `showTerrain` (kept for existing callers). */
  show(h: Hex, terrain: TerrainId): void;
  hide(): void;
}

export function createTileInfoPanel(root: HTMLElement, onClose: () => void): TileInfoPanel {
  const panel = el('section', 'sheet tile-info');
  panel.hidden = true;

  const header = el('div', 'tile-info__header');
  const mark = el('span', 'tile-info__mark');
  mark.setAttribute('aria-hidden', 'true');
  const titles = el('div', 'tile-info__titles');
  const title = el('h2', 'sheet__title');
  const coords = el('p', 'tile-info__coords');
  titles.append(title, coords);
  const close = button('icon-button', '\u2715');
  close.setAttribute('aria-label', en.tileInfo.close);
  header.append(mark, titles, close);

  const content = el('div', 'tile-info__content');
  panel.append(header, content);
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

  function setHeader(h: Hex, name: string, glyph: string | null, terrain: TerrainId): void {
    const { col, row } = axialToOffset(h);
    title.textContent = name;
    coords.textContent = `${en.tileInfo.tile} ${col + 1}/${row + 1}`;
    if (glyph === null) {
      mark.textContent = '';
      mark.className = 'tile-info__mark tile-info__mark--swatch';
      mark.style.background = cssColor(theme.terrainColors[terrain]);
    } else {
      mark.textContent = glyph;
      mark.className = 'tile-info__mark tile-info__mark--icon';
      mark.style.background = '';
    }
  }

  function terrainLine(terrain: TerrainId): HTMLElement {
    return el('p', 'tile-info__terrain', en.terrain[terrain]);
  }

  function demolishButton(onDemolish: () => void): HTMLButtonElement {
    const b = button('btn btn--danger tile-info__demolish', en.ui.demolish);
    b.addEventListener('click', onDemolish);
    return b;
  }

  function showTerrain(h: Hex, terrain: TerrainId): void {
    setHeader(h, en.terrain[terrain], null, terrain);
    const list = el('dl', 'tile-info__rows');
    for (const r of tileInfoRows(terrain)) {
      const wrap = el('div', 'tile-info__row');
      wrap.append(el('dt', '', r.label), el('dd', '', r.value));
      list.appendChild(wrap);
    }
    content.replaceChildren(list, el('p', 'tile-info__note', en.terrainNote[terrain]));
    panel.hidden = false;
  }

  return {
    showTerrain,
    show: showTerrain,
    showBuilding(o) {
      const def = BUILDINGS[o.type];
      setHeader(o.hex, en.buildings[o.type], def.icon, o.terrain);
      const status = el('p', `tile-info__status is-${statusTone(o.status)}`);
      status.append(el('span', 'status-dot'), document.createTextNode(formatStatus(o.status)));
      const nodes: HTMLElement[] = [status];
      const perTurn = perTurnText(o.type);
      if (perTurn) nodes.push(el('p', 'tile-info__line', perTurn));
      if (o.workers.needed > 0) {
        nodes.push(
          el(
            'p',
            'tile-info__line',
            fill(en.buildingText.workersAssigned, {
              assigned: o.workers.assigned,
              needed: o.workers.needed,
            }),
          ),
        );
      }
      nodes.push(terrainLine(o.terrain));
      if (o.onDemolish) nodes.push(demolishButton(o.onDemolish));
      content.replaceChildren(...nodes);
      panel.hidden = false;
    },
    showRoad(o) {
      setHeader(o.hex, en.ui.road, '\u{1F6E4}\uFE0F', o.terrain);
      content.replaceChildren(terrainLine(o.terrain), demolishButton(o.onDemolish));
      panel.hidden = false;
    },
    hide,
  };
}
