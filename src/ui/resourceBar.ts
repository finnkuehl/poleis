// Top strip: turn chip, residents chip and one chip per good (icon + amount + change per turn).
import { GOOD_IDS, GOODS, type Goods, type GoodId, type Stock } from '../data';
import { en } from '../i18n/en';
import { fill, formatTurnOf } from '../i18n/format';
import type { WorkerSummary } from '../core/rules/economy';
import { button, el } from './dom';
import { createMenuButton } from './gameMenu';

/** Goods that are always shown, even at 0. */
const ALWAYS_SHOWN: readonly GoodId[] = ['wood', 'stone'];
/** How long the name label stays after tapping a chip (ms). */
const LABEL_MS = 2000;

interface Chip {
  root: HTMLButtonElement;
  amount: HTMLElement;
  delta: HTMLElement;
}

export function createResourceBar(
  root: HTMLElement,
  h: { onMenu?(): void; onOverview(): void },
): {
  update(
    stock: Stock,
    delta: Goods | null,
    turn: number,
    /** Turn limit to show as "Turn X / limit"; null = no limit shown. */
    turnLimit: number | null,
    people: { residents: number; housing: number },
    workers: WorkerSummary,
  ): void;
} {
  const bar = el('header', 'resource-bar');
  const scroll = el('div', 'resource-bar__scroll');
  scroll.setAttribute('role', 'list');
  const turnChip = el('span', 'resource-bar__turn');
  turnChip.setAttribute('role', 'listitem');
  const label = el('div', 'resource-bar__label');
  label.hidden = true;
  label.setAttribute('role', 'status');
  const residentsChip = el('button', 'resource-chip');
  residentsChip.type = 'button';
  residentsChip.setAttribute('role', 'listitem');
  const residentsIcon = el('span', 'resource-chip__icon', '\u{1F465}');
  residentsIcon.setAttribute('aria-hidden', 'true');
  const residentsAmount = el('span', 'resource-chip__amount');
  residentsChip.append(residentsIcon, residentsAmount);
  const workersChip = el('button', 'resource-chip');
  workersChip.type = 'button';
  workersChip.setAttribute('role', 'listitem');
  const workersIcon = el('span', 'resource-chip__icon', '\u2692');
  workersIcon.setAttribute('aria-hidden', 'true');
  const workersAmount = el('span', 'resource-chip__amount');
  const workersFree = el('span', 'resource-chip__delta is-free');
  const workersMissing = el('span', 'resource-chip__delta is-missing');
  workersChip.append(workersIcon, workersAmount, workersFree, workersMissing);
  const overviewBtn = button('resource-bar__overview', `\u{1F4CA} ${en.economy.button}`);
  overviewBtn.addEventListener('click', h.onOverview);
  if (h.onMenu) scroll.appendChild(createMenuButton(h.onMenu));
  scroll.append(overviewBtn, turnChip, residentsChip, workersChip);

  const chips = new Map<GoodId, Chip>();
  let labelTimer: number | undefined;
  const showLabel = (text: string): void => {
    label.textContent = text;
    label.hidden = false;
    window.clearTimeout(labelTimer);
    labelTimer = window.setTimeout(() => {
      label.hidden = true;
    }, LABEL_MS);
  };

  for (const id of GOOD_IDS) {
    const chip = el('button', 'resource-chip');
    chip.type = 'button';
    chip.setAttribute('role', 'listitem');
    const icon = el('span', 'resource-chip__icon', GOODS[id].icon);
    icon.setAttribute('aria-hidden', 'true');
    const amount = el('span', 'resource-chip__amount');
    const delta = el('span', 'resource-chip__delta');
    chip.append(icon, amount, delta);
    chip.addEventListener('click', () => showLabel(en.goods[id]));
    scroll.appendChild(chip);
    chips.set(id, { root: chip, amount, delta });
  }
  residentsChip.addEventListener('click', () => showLabel(en.ui.residentsHousing));
  workersChip.addEventListener('click', () => showLabel(en.ui.workersLabel));
  bar.append(scroll, label);
  root.appendChild(bar);

  return {
    update(stock, delta, turn, turnLimit, people, workers) {
      turnChip.textContent =
        turnLimit === null ? fill(en.ui.turnShort, { turn }) : formatTurnOf(turn, turnLimit);
      residentsAmount.textContent = `${people.residents} / ${people.housing}`;
      residentsChip.setAttribute(
        'aria-label',
        `${en.ui.residentsHousing} ${people.residents} / ${people.housing}`,
      );
      workersAmount.textContent = String(workers.working);
      workersFree.textContent =
        workers.free > 0 ? `\u00B7 ${workers.free} ${en.economy.freeShort}` : '';
      workersMissing.textContent =
        workers.missing > 0 ? `\u00B7 ${workers.missing} ${en.economy.missingShort}` : '';
      workersChip.setAttribute(
        'aria-label',
        `${en.ui.workersLabel}: ${workers.working}, ${workers.free}, ${workers.missing}`,
      );
      for (const id of GOOD_IDS) {
        const chip = chips.get(id);
        if (!chip) continue;
        const d = delta?.[id] ?? 0;
        const amount = stock[id];
        chip.root.hidden = !(ALWAYS_SHOWN.includes(id) || amount > 0 || d !== 0);
        chip.amount.textContent = String(amount);
        chip.delta.textContent = d === 0 ? '' : d > 0 ? `+${d}` : `−${Math.abs(d)}`;
        chip.delta.className = `resource-chip__delta${d > 0 ? ' is-plus' : d < 0 ? ' is-minus' : ''}`;
        chip.root.setAttribute(
          'aria-label',
          `${en.goods[id]} ${amount}${d === 0 ? '' : `, ${d > 0 ? '+' : '−'}${Math.abs(d)}`}`,
        );
      }
    },
  };
}
