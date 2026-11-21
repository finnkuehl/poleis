// Build menu: bottom sheet with the buildings the player can build, grouped by category.
import {
  BUILDING_IDS,
  BUILDINGS,
  GOODS,
  type BuildingCategory,
  type BuildingId,
  type CityLevel,
  type Stock,
} from '../data';
import { canAfford, missingGoods } from '../core/rules/goods';
import { en } from '../i18n/en';
import { fill, formatMissing } from '../i18n/format';
import { costParts, levelReached, perTurnText, workersText } from './buildingText';
import { button, el } from './dom';

const CATEGORY_ORDER: readonly BuildingCategory[] = ['city', 'food', 'raw', 'processing'];

export function createBuildMenu(
  root: HTMLElement,
  h: { onPick(id: BuildingId): void; onClose(): void },
): { open(stock: Stock, cityLevel: CityLevel): void; close(): void } {
  const sheet = el('section', 'sheet build-menu');
  sheet.hidden = true;
  sheet.setAttribute('aria-label', en.ui.buildMenuTitle);
  const header = el('div', 'sheet__header');
  const title = el('h2', 'sheet__title', en.ui.buildMenuTitle);
  const closeBtn = button('icon-button', '✕');
  closeBtn.setAttribute('aria-label', en.ui.close);
  header.append(title, closeBtn);
  const list = el('div', 'build-menu__list');
  sheet.append(header, list);
  root.appendChild(sheet);

  const close = (): void => {
    sheet.hidden = true;
  };
  closeBtn.addEventListener('click', () => {
    close();
    h.onClose();
  });
  // Capture phase on window: the open menu consumes Escape exclusively.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.stopPropagation();
        close();
        h.onClose();
      }
    },
    true,
  );

  /** A building the city level does not allow yet: muted, not pickable, says from which level. */
  function lockedEntry(id: BuildingId): HTMLButtonElement {
    const def = BUILDINGS[id];
    const item = button('build-item is-muted is-locked', '');
    item.disabled = true;
    const icon = el('span', 'build-item__icon', def.icon);
    icon.setAttribute('aria-hidden', 'true');
    const body = el('span', 'build-item__body');
    body.appendChild(el('span', 'build-item__name', en.buildings[id]));
    body.appendChild(el('span', 'build-item__effect', perTurnText(id)));
    body.appendChild(
      el('span', 'build-item__level', fill(en.ui.fromLevel, { level: en.levels[def.minLevel] })),
    );
    item.append(icon, body);
    return item;
  }

  function entry(id: BuildingId, stock: Stock): HTMLButtonElement {
    const def = BUILDINGS[id];
    const affordable = canAfford(stock, def.cost);
    const item = button(`build-item${affordable ? '' : ' is-muted'}`, '');
    item.disabled = !affordable;
    const icon = el('span', 'build-item__icon', def.icon);
    icon.setAttribute('aria-hidden', 'true');
    const body = el('span', 'build-item__body');
    body.appendChild(el('span', 'build-item__name', en.buildings[id]));
    body.appendChild(el('span', 'build-item__effect', perTurnText(id)));

    const cost = el('span', 'build-item__cost');
    cost.appendChild(document.createTextNode(`${en.ui.cost}: `));
    costParts(def.cost, stock).forEach((part, i) => {
      if (i > 0) cost.appendChild(document.createTextNode(', '));
      const chip = el(
        'span',
        `cost-part${part.missing ? ' is-missing' : ''}`,
        `${GOODS[part.good].icon} ${part.amount} ${en.goods[part.good]}`,
      );
      cost.appendChild(chip);
    });
    body.appendChild(cost);
    if (def.workers > 0)
      body.appendChild(el('span', 'build-item__workers', workersText(def.workers)));
    if (!affordable) {
      body.appendChild(
        el('span', 'build-item__missing', formatMissing(missingGoods(stock, def.cost))),
      );
    }
    item.append(icon, body);
    item.addEventListener('click', () => h.onPick(id));
    return item;
  }

  return {
    open(stock, cityLevel) {
      const scrollTop = list.scrollTop;
      list.replaceChildren();
      for (const category of CATEGORY_ORDER) {
        const ids = BUILDING_IDS.filter(
          (id) => BUILDINGS[id].category === category && BUILDINGS[id].playerCanBuild,
        );
        if (ids.length === 0) continue;
        const group = el('div', 'build-menu__group');
        group.appendChild(el('h3', 'build-menu__heading', en.categories[category]));
        for (const id of ids) {
          group.appendChild(
            levelReached(cityLevel, BUILDINGS[id].minLevel) ? entry(id, stock) : lockedEntry(id),
          );
        }
        list.appendChild(group);
      }
      sheet.hidden = false;
      list.scrollTop = scrollTop;
    },
    close,
  };
}
