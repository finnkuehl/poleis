// Info panel for a tapped tile: terrain, building or road (bottom sheet on phones, card on desktop).
import { axialToOffset, type Hex } from '../core/hex';
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityStats } from '../core/rules/population';
import type { BuildingStatus } from '../core/rules/production';
import {
  BUILDINGS,
  GOODS,
  economyConfig,
  type BuildingId,
  type CityLevel,
  type GoodId,
  type Stock,
} from '../data';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { en } from '../i18n/en';
import { fill, formatAdvanceTo, formatDrachmas, formatStatus } from '../i18n/format';
import { theme } from '../render/theme';
import { canPause, perTurnText, statusTone } from './buildingText';
import {
  advanceBlockReason,
  advanceRows,
  growthState,
  growthText,
  needText,
  tradeRows,
} from './cityText';
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
  /** The building is paused by the player (used for the button label). */
  paused?: boolean;
  /** If set (and the building has workers), a Pause / Resume button is shown. */
  onTogglePause?: () => void;
  /** Marketplace only: the list of tradable goods. */
  trade?: TradeInfo;
}

export interface TradeInfo {
  /** false = the marketplace is not connected or staffed: buttons are disabled and a hint is shown. */
  enabled: boolean;
  stock: Stock;
  onSell(good: GoodId): void;
  onBuy(good: GoodId): void;
}

export interface CityInfo {
  hex: Hex;
  terrain: TerrainId;
  level: CityLevel;
  stats: CityStats;
  check: AdvanceCheck;
  /** Goods in stock (to tell whether the city is hungry and which needs are covered). */
  stock: Stock;
  /** If set, the Advance button is shown (enabled when `check.canAdvance`). */
  onAdvance?: () => void;
}

export interface RoadInfo {
  hex: Hex;
  terrain: TerrainId;
  onDemolish(): void;
}

export interface TileInfoPanel {
  showTerrain(h: Hex, terrain: TerrainId): void;
  showBuilding(o: BuildingInfo): void;
  showCity(o: CityInfo): void;
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

  function line(text: string, tone?: 'ok' | 'problem' | 'neutral'): HTMLElement {
    if (!tone) return el('p', 'tile-info__line', text);
    const p = el('p', `tile-info__bullet is-${tone}`);
    p.append(el('span', 'status-dot'), document.createTextNode(text));
    return p;
  }

  // Marketplace: show all goods or only the ones in stock (kept while the panel stays open).
  let showAllGoods = false;

  function tradeSection(t: TradeInfo, rerender: () => void): HTMLElement {
    const { sellAmount, sellPrice, buyPrice } = economyConfig.market;
    const wrap = el('div', 'trade');
    wrap.appendChild(
      el(
        'p',
        'trade__rates',
        fill(en.market.rates, {
          sellAmount,
          sellPrice: formatDrachmas(sellPrice),
          buyPrice: formatDrachmas(buyPrice),
        }),
      ),
    );
    if (!t.enabled) wrap.appendChild(el('p', 'trade__hint', en.market.disabled));
    const rows = tradeRows(t.stock, t.enabled, showAllGoods);
    const list = el('ul', 'trade__list');
    for (const r of rows) {
      const li = el('li', 'trade__row');
      const icon = el('span', 'trade__icon', GOODS[r.good].icon);
      icon.setAttribute('aria-hidden', 'true');
      const body = el('span', 'trade__body');
      body.append(
        el('span', 'trade__name', en.goods[r.good]),
        el('span', 'trade__amount', String(r.amount)),
      );
      const sell = button(
        'btn btn--secondary trade__button',
        fill(en.market.sell, { n: sellAmount }),
      );
      sell.disabled = !r.canSell;
      sell.setAttribute(
        'aria-label',
        fill(en.market.sellLabel, {
          n: sellAmount,
          good: en.goods[r.good],
          price: formatDrachmas(sellPrice),
        }),
      );
      sell.addEventListener('click', () => t.onSell(r.good));
      const buy = button('btn btn--secondary trade__button', fill(en.market.buy, { n: 1 }));
      buy.disabled = !r.canBuy;
      buy.setAttribute(
        'aria-label',
        fill(en.market.buyLabel, {
          n: 1,
          good: en.goods[r.good],
          price: formatDrachmas(buyPrice),
        }),
      );
      buy.addEventListener('click', () => t.onBuy(r.good));
      li.append(icon, body, sell, buy);
      list.appendChild(li);
    }
    if (rows.length === 0) wrap.appendChild(el('p', 'trade__hint', en.market.nothing));
    else wrap.appendChild(list);
    const toggle = button(
      'btn btn--secondary trade__toggle',
      showAllGoods ? en.market.showOwned : en.market.showAll,
    );
    toggle.addEventListener('click', () => {
      showAllGoods = !showAllGoods;
      rerender();
    });
    wrap.appendChild(toggle);
    return wrap;
  }

  function showBuildingInner(o: BuildingInfo): void {
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
    if (o.trade) nodes.push(tradeSection(o.trade, () => showBuildingInner(o)));
    nodes.push(terrainLine(o.terrain));
    const actions = el('div', 'tile-info__actions');
    if (o.onTogglePause && canPause(o.type)) {
      const pause = button(
        'btn btn--secondary tile-info__pause',
        o.paused ? en.ui.resume : en.ui.pause,
      );
      pause.addEventListener('click', o.onTogglePause);
      actions.appendChild(pause);
    }
    if (o.onDemolish) actions.appendChild(demolishButton(o.onDemolish));
    if (actions.childElementCount > 0) nodes.push(actions);
    content.replaceChildren(...nodes);
    panel.hidden = false;
  }

  function checkMark(ok: boolean): HTMLElement {
    const m = el('span', `check${ok ? ' is-done' : ''}`, ok ? '\u2713' : '\u25CB');
    m.setAttribute('role', 'img');
    m.setAttribute('aria-label', ok ? en.cityPanel.done : en.cityPanel.open);
    return m;
  }

  function showCity(o: CityInfo): void {
    setHeader(o.hex, en.levels[o.level], '\u{1F3DB}\uFE0F', o.terrain);
    const nodes: HTMLElement[] = [];
    const rows = el('dl', 'tile-info__rows');
    const row = el('div', 'tile-info__row');
    row.append(
      el('dt', '', en.cityPanel.residents),
      el('dd', '', `${o.stats.residents} / ${o.stats.housing}`),
    );
    rows.appendChild(row);
    nodes.push(rows);

    const growth = growthState(o.level, o.stats, o.stock);
    nodes.push(line(growthText(growth), growth.kind === 'growing' ? 'ok' : 'problem'));
    nodes.push(line(fill(en.cityPanel.eats, { n: o.stats.foodPerTurn })));
    nodes.push(line(fill(en.cityPanel.taxes, { amount: formatDrachmas(o.stats.taxPerTurn) })));
    for (const need of o.stats.needs) {
      nodes.push(line(needText(need), need.inStock ? 'ok' : 'problem'));
    }

    const next = el('div', 'city-next');
    if (o.check.to) {
      const target = formatAdvanceTo(o.check.to);
      next.appendChild(el('h3', 'city-next__title', target));
      const list = el('ul', 'city-next__list');
      for (const r of advanceRows(o.check)) {
        const li = el('li', `city-next__row${r.ok ? ' is-done' : ''}`);
        const text = el('span', 'city-next__text');
        if (r.parts) {
          text.appendChild(document.createTextNode(`${en.ui.cost}: `));
          r.parts.forEach((part, i) => {
            if (i > 0) text.appendChild(document.createTextNode(', '));
            text.appendChild(
              el(
                'span',
                `cost-part${part.missing ? ' is-missing' : ''}`,
                `${GOODS[part.good].icon} ${part.amount} ${en.goods[part.good]}`,
              ),
            );
          });
        } else {
          text.textContent = r.text;
        }
        li.append(checkMark(r.ok), text);
        list.appendChild(li);
      }
      next.appendChild(list);
      if (o.onAdvance) {
        const advance = button('btn btn--primary city-next__button', target);
        advance.disabled = !o.check.canAdvance;
        advance.addEventListener('click', o.onAdvance);
        next.appendChild(advance);
        const reason = advanceBlockReason(o.check);
        if (reason) next.appendChild(el('p', 'city-next__reason', reason));
      }
    } else {
      next.appendChild(el('p', 'city-next__top', en.cityPanel.topLevel));
    }
    nodes.push(next);
    content.replaceChildren(...nodes);
    panel.hidden = false;
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
    showBuilding: showBuildingInner,
    showCity,
    showRoad(o) {
      setHeader(o.hex, en.ui.road, '\u{1F6E4}\uFE0F', o.terrain);
      content.replaceChildren(terrainLine(o.terrain), demolishButton(o.onDemolish));
      panel.hidden = false;
    },
    hide,
  };
}
