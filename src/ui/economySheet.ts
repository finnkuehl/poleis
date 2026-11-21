// Economy overview: workers and, per good, stock, net per turn, where it comes from and goes.
import { GOODS } from '../data';
import type { EconomyOverview, GoodFlow } from '../core/rules/economy';
import { en } from '../i18n/en';
import { formatMade, formatNet, formatRunsOut, formatUsed, formatWorkerLine } from '../i18n/format';
import { button, el } from './dom';

function goodRow(flow: GoodFlow): HTMLElement {
  const row = el('li', 'economy__row');
  const head = el('div', 'economy__head');
  const icon = el('span', 'economy__icon', GOODS[flow.good].icon);
  icon.setAttribute('aria-hidden', 'true');
  const net = el(
    'span',
    `economy__net${flow.net > 0 ? ' is-plus' : flow.net < 0 ? ' is-minus' : ''}`,
    formatNet(flow.net),
  );
  head.append(
    icon,
    el('span', 'economy__name', en.goods[flow.good]),
    el('span', 'economy__stock', String(flow.stock)),
    net,
  );
  row.appendChild(head);
  const made = formatMade(flow);
  const used = formatUsed(flow);
  if (made) row.appendChild(el('p', 'economy__line', made));
  if (used) row.appendChild(el('p', 'economy__line', used));
  if (flow.turnsLeft !== null) {
    row.appendChild(el('p', 'economy__line economy__warn', formatRunsOut(flow.turnsLeft)));
  }
  return row;
}

export function createEconomySheet(root: HTMLElement): {
  open(o: EconomyOverview): void;
  close(): void;
  isOpen(): boolean;
} {
  const sheet = el('section', 'sheet economy-sheet');
  sheet.hidden = true;
  sheet.setAttribute('aria-label', en.economy.title);
  const header = el('div', 'sheet__header');
  const closeBtn = button('icon-button', '✕');
  closeBtn.setAttribute('aria-label', en.ui.close);
  header.append(el('h2', 'sheet__title', en.economy.title), closeBtn);
  const workers = el('p', 'economy__workers');
  const list = el('ul', 'economy__list');
  const content = el('div', 'economy__content');
  content.append(workers, list);
  sheet.append(header, content);
  root.appendChild(sheet);

  const close = (): void => {
    sheet.hidden = true;
  };
  closeBtn.addEventListener('click', close);
  // Capture phase on window: the open sheet consumes Escape exclusively.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.stopPropagation();
        close();
      }
    },
    true,
  );

  return {
    open(o) {
      workers.textContent = formatWorkerLine(o.workers);
      workers.classList.toggle('has-missing', o.workers.missing > 0);
      list.replaceChildren(...o.goods.map(goodRow));
      if (o.goods.length === 0) list.appendChild(el('li', 'economy__line', en.economy.nothing));
      sheet.hidden = false;
    },
    close,
    isOpen: () => !sheet.hidden,
  };
}
