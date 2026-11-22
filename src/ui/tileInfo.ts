// Info panel for a tapped tile: terrain, building or road (bottom sheet on phones, card on desktop).
import { axialToOffset, type Hex } from '../core/hex';
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityStats } from '../core/rules/population';
import type { BuildingStatus } from '../core/rules/production';
import {
  BUILDING_IDS,
  BUILDINGS,
  GOOD_IDS,
  UNITS,
  economyConfig,
  type BuildingId,
  type CityLevel,
  type GoodId,
  type Stock,
  type UnitId,
} from '../data';
import type { Unit } from '../core/state';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { en } from '../i18n/en';
import {
  fill,
  formatAdvanceTo,
  formatDrachmas,
  formatMissing,
  formatMoves,
  formatResidents,
  formatStatus,
  formatTileGain,
} from '../i18n/format';
import { theme } from '../render/theme';
import type { BuildOption } from './buildOptions';
import { canPause, costParts, perTurnText, statusTone } from './buildingText';
import {
  advanceBlockReason,
  advanceRows,
  growthState,
  growthText,
  needText,
  tradeRows,
} from './cityText';
import { buildingIcon, goodIcon, goodText, ownerColor, unitIcon } from './art';
import { button, el } from './dom';
import {
  onTheWayText,
  unitStatLine,
  unitStatus,
  unitStatusText,
  type TrainOption,
} from './unitText';

export interface InfoRow {
  label: string;
  value: string;
}

/** "no", "yes" or "only mine, quarry": derived from the buildings the player may build. */
function buildableText(terrain: TerrainId): string {
  const t = en.tileInfo;
  if (TERRAIN[terrain].buildable) return t.yes;
  const names = BUILDING_IDS.filter(
    (id) =>
      BUILDINGS[id].playerCanBuild && BUILDINGS[id].placement.some((o) => o.on.includes(terrain)),
  )
    .map((id) => en.buildings[id].toLowerCase())
    .sort();
  return names.length === 0 ? t.no : fill(t.only, { list: names.join(', ') });
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
    { label: t.buildable, value: buildableText(terrain) },
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
  /** Barracks only: the units that can be trained. */
  train?: TrainInfo;
}

export interface TrainInfo {
  options: TrainOption[];
  /** Unit already ordered this turn (one order per barracks): the list is disabled. */
  pending: UnitId | null;
  onTrain(id: UnitId): void;
}

export interface UnitInfo {
  hex: Hex;
  terrain: TerrainId;
  unit: Unit;
  /** false = a foreign unit: tagged "Enemy", no moves or hint. */
  own: boolean;
  /** Own units: is there an attack target in reach (for the status line)? */
  hasTargets?: boolean;
  /**
   * Own units walking on a move order: `turns` = estimated turns until arrival (null = unknown),
   * `onStop` cancels the order. Shown instead of the usual status, plus a "Stop" button.
   */
  order?: { turns: number | null; onStop(): void } | null;
  /** Settlers only: the "Found city here" button. */
  found?: { ok: boolean; reason?: string; onFound(): void };
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
  /** Working and free residents of this city (optional). */
  workers?: { working: number; free: number };
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

/** Extras of the terrain panel: build list, road start and a short note. */
export interface TerrainExtra {
  /** "Build here" list; one tap on an affordable entry calls `onBuild`. */
  build?: { options: BuildOption[]; stock: Stock; onBuild(id: BuildingId): void };
  /** If set, a "Road from here" button is shown. */
  onRoadFrom?: () => void;
  note?: string;
}

export interface TileInfoPanel {
  showTerrain(h: Hex, terrain: TerrainId, extra?: TerrainExtra): void;
  showBuilding(o: BuildingInfo): void;
  showCity(o: CityInfo): void;
  showUnit(o: UnitInfo): void;
  showRoad(o: RoadInfo): void;
  /** Same as `showTerrain` (kept for existing callers). */
  show(h: Hex, terrain: TerrainId, extra?: TerrainExtra): void;
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

  /** Header mark: terrain swatch (null), drawn art (element) or a symbol (text). */
  function setHeader(
    h: Hex,
    name: string,
    glyph: HTMLElement | string | null,
    terrain: TerrainId,
  ): void {
    const { col, row } = axialToOffset(h);
    title.textContent = name;
    coords.textContent = `${en.tileInfo.tile} ${col + 1}/${row + 1}`;
    if (glyph === null) {
      mark.replaceChildren();
      mark.className = 'tile-info__mark tile-info__mark--swatch';
      mark.style.background = cssColor(theme.terrainColors[terrain]);
    } else {
      mark.replaceChildren(glyph);
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
      const icon = el('span', 'trade__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.appendChild(goodIcon(r.good));
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

  /** Barracks: one row per unit type; ready rows train with one tap. */
  function trainSection(t: TrainInfo): HTMLElement {
    const wrap = el('div', 'build-here');
    wrap.appendChild(el('h3', 'build-here__title', en.unitText.train));
    if (t.pending) {
      wrap.appendChild(
        el('p', 'tile-info__hint', fill(en.unitText.training, { unit: en.units[t.pending] })),
      );
    }
    for (const o of t.options) {
      const def = UNITS[o.id];
      const ok = o.state === 'ok' && !t.pending;
      const item = button(`build-item build-item--here${ok ? '' : ' is-muted'}`, '');
      item.disabled = !ok;
      const icon = el('span', 'build-item__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.appendChild(unitIcon(o.id));
      const body = el('span', 'build-item__body');
      body.appendChild(el('span', 'build-item__name', en.units[o.id]));
      const sub = el('span', 'build-item__effect');
      if (o.state === 'locked' && o.level) {
        sub.textContent = fill(en.ui.fromLevel, { level: en.levels[o.level] });
      } else if (o.state === 'noResidents') {
        sub.textContent = fill(en.unitText.needsResidents, { n: o.residentsNeeded ?? 0 });
      } else if (o.state === 'unaffordable' && o.missing) {
        sub.className = 'build-item__missing';
        sub.textContent = formatMissing(o.missing);
      } else {
        const parts: Node[] = GOOD_IDS.filter((g) => (def.cost[g] ?? 0) > 0).map((g) =>
          goodText(g, `${def.cost[g]} ${en.goods[g]}`),
        );
        if (def.residents > 0) parts.push(document.createTextNode(formatResidents(def.residents)));
        parts.forEach((part, i) => {
          if (i > 0) sub.appendChild(document.createTextNode(', '));
          sub.appendChild(part);
        });
      }
      body.appendChild(sub);
      body.appendChild(el('span', 'build-item__stats', unitStatLine(o.id)));
      if (o.state === 'ok')
        body.appendChild(el('span', 'build-item__gain', en.unitText.readyNextTurn));
      item.append(icon, body);
      if (ok) item.addEventListener('click', () => t.onTrain(o.id));
      wrap.appendChild(item);
    }
    return wrap;
  }

  function showUnit(o: UnitInfo): void {
    const def = UNITS[o.unit.type];
    setHeader(
      o.hex,
      en.units[o.unit.type],
      unitIcon(o.unit.type, ownerColor(o.unit.owner)),
      o.terrain,
    );
    const nodes: HTMLElement[] = [];
    if (!o.own) nodes.push(el('p', 'unit-tag', en.unitText.enemy));
    const hp = el('div', 'hp');
    const track = el('span', 'hp__track');
    const fillBar = el('span', 'hp__fill');
    const ratio = Math.max(0, Math.min(1, o.unit.hp / def.hp));
    fillBar.style.width = `${Math.round(ratio * 100)}%`;
    if (ratio <= 0.34) fillBar.classList.add('is-low');
    track.appendChild(fillBar);
    hp.append(track, el('span', 'hp__text', fill(en.unitText.hp, { hp: o.unit.hp, max: def.hp })));
    nodes.push(hp);
    // Own units: compact panel (name, HP, moves, status), so the map stays visible above it.
    if (!o.own) nodes.push(el('p', 'tile-info__line', unitStatLine(o.unit.type)));
    if (o.own) {
      nodes.push(
        el(
          'p',
          'tile-info__line',
          fill(en.unitText.movesLeft, {
            left: formatMoves(o.unit.movesLeft),
            max: def.movement,
          }),
        ),
      );
      const status = unitStatus(o.unit, o.hasTargets ?? false);
      const statusText = o.order ? onTheWayText(o.order.turns) : unitStatusText(status);
      const tone = o.order || status !== 'done' ? 'ok' : 'neutral';
      const row = el('p', `tile-info__status is-${tone}`);
      row.append(el('span', 'status-dot'), document.createTextNode(statusText));
      nodes.push(row);
      if (o.order) {
        const stop = button('btn btn--secondary unit-stop', en.orders.stop);
        stop.addEventListener('click', o.order.onStop);
        nodes.push(stop);
      }
    } else {
      nodes.push(terrainLine(o.terrain));
    }
    if (o.own && o.found) {
      const found = o.found;
      const b = button('btn btn--primary unit-found', en.unitText.foundCity);
      b.disabled = !found.ok;
      if (found.ok) b.addEventListener('click', found.onFound);
      nodes.push(b);
      if (!found.ok && found.reason) nodes.push(el('p', 'city-next__reason', found.reason));
    }
    content.replaceChildren(...nodes);
    content.scrollTop = 0;
    panel.hidden = false;
  }

  function showBuildingInner(o: BuildingInfo): void {
    setHeader(o.hex, en.buildings[o.type], buildingIcon(o.type), o.terrain);
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
    if (o.train) nodes.push(trainSection(o.train));
    nodes.push(terrainLine(o.terrain));
    const actions = el('div', 'tile-info__actions');
    if (o.onTogglePause && canPause(o.type, o.workers.needed)) {
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
    setHeader(o.hex, en.levels[o.level], buildingIcon('cityCenter'), o.terrain);
    const nodes: HTMLElement[] = [];
    const rows = el('dl', 'tile-info__rows');
    const row = el('div', 'tile-info__row');
    row.append(
      el('dt', '', en.cityPanel.residents),
      el('dd', '', `${o.stats.residents} / ${o.stats.housing}`),
    );
    rows.appendChild(row);
    nodes.push(rows);
    if (o.workers) nodes.push(line(fill(en.cityPanel.workers, o.workers)));

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
              goodText(
                part.good,
                `${part.amount} ${en.goods[part.good]}`,
                `cost-part${part.missing ? ' is-missing' : ''}`,
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

  /** One row of the "Build here" list. */
  function buildRow(o: BuildOption, stock: Stock, onBuild: (id: BuildingId) => void): HTMLElement {
    const def = BUILDINGS[o.id];
    const ok = o.state === 'ok';
    const item = button(`build-item build-item--here${ok ? '' : ' is-muted'}`, '');
    item.disabled = !ok;
    const icon = el('span', 'build-item__icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(buildingIcon(o.id));
    const body = el('span', 'build-item__body');
    body.appendChild(el('span', 'build-item__name', en.buildings[o.id]));
    const sub = el('span', 'build-item__effect');
    if (o.state === 'locked' && o.level) {
      sub.textContent = fill(en.ui.fromLevel, { level: en.levels[o.level] });
    } else if (o.state === 'unaffordable' && o.missing) {
      sub.className = 'build-item__missing';
      sub.textContent = formatMissing(o.missing);
    } else {
      costParts(def.cost, stock).forEach((part, i) => {
        if (i > 0) sub.appendChild(document.createTextNode(', '));
        sub.appendChild(goodText(part.good, `${part.amount} ${en.goods[part.good]}`));
      });
    }
    if (o.gain !== undefined && o.state !== 'locked') {
      if (sub.childNodes.length > 0) sub.appendChild(document.createTextNode(' · '));
      sub.appendChild(el('span', 'build-item__gain', formatTileGain(o.gain)));
    }
    body.appendChild(sub);
    item.append(icon, body);
    if (ok) item.addEventListener('click', () => onBuild(o.id));
    return item;
  }

  function showTerrain(h: Hex, terrain: TerrainId, extra: TerrainExtra = {}): void {
    setHeader(h, en.terrain[terrain], null, terrain);
    const list = el('dl', 'tile-info__rows');
    for (const r of tileInfoRows(terrain)) {
      const wrap = el('div', 'tile-info__row');
      wrap.append(el('dt', '', r.label), el('dd', '', r.value));
      list.appendChild(wrap);
    }
    const nodes: HTMLElement[] = [list, el('p', 'tile-info__note', en.terrainNote[terrain])];
    if (extra.note) nodes.push(el('p', 'tile-info__hint', extra.note));
    const build = extra.build;
    if (build && build.options.length > 0) {
      const section = el('div', 'build-here');
      section.appendChild(el('h3', 'build-here__title', en.tileInfo.buildHere));
      for (const o of build.options) section.appendChild(buildRow(o, build.stock, build.onBuild));
      nodes.push(section);
    }
    if (extra.onRoadFrom) {
      const road = button('btn btn--secondary tile-info__road', en.tileInfo.roadFromHere);
      road.addEventListener('click', extra.onRoadFrom);
      nodes.push(road);
    }
    content.replaceChildren(...nodes);
    content.scrollTop = 0;
    panel.hidden = false;
  }

  return {
    showTerrain,
    show: showTerrain,
    showBuilding: showBuildingInner,
    showCity,
    showUnit,
    showRoad(o) {
      setHeader(o.hex, en.ui.road, '\u{1F6E4}\uFE0F', o.terrain);
      content.replaceChildren(terrainLine(o.terrain), demolishButton(o.onDemolish));
      panel.hidden = false;
    },
    hide,
  };
}
