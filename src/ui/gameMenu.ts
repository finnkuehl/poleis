// In-game menu: scores, save to a slot, load a game, back to the main menu. Callbacks only:
// the menu does not save or load by itself.
import { ALL_SLOTS, SAVE_SLOT_COUNT, type SaveListEntry, type SaveSlot } from '../save';
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import { button, el } from './dom';
import type { createConfirmSheet } from './confirmSheet';
import { findSave, savedAtText, saveSummaryText, slotName } from './saveText';

export interface GameMenuOptions {
  /** The shared confirmation sheet (the menu hides itself while a question is open). */
  confirm: Pick<ReturnType<typeof createConfirmSheet>, 'show'>;
  /** Current saves, read each time the menu or a slot list opens. */
  getSaves(): SaveListEntry[];
  onScores(): void;
  onSave(slot: 1 | 2 | 3): void;
  onLoad(slot: SaveSlot): void;
  onMainMenu(): void;
}

export interface GameMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

type View = 'main' | 'save' | 'load';

/** Menu button for the resource bar (44 px, three bars icon, accessible label). */
export function createMenuButton(onClick: () => void): HTMLButtonElement {
  const b = button('resource-bar__menu', '');
  b.setAttribute('aria-label', en.gameMenu.open);
  b.setAttribute('aria-haspopup', 'dialog');
  b.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
  b.addEventListener('click', onClick);
  return b;
}

export function createGameMenu(root: HTMLElement, opts: GameMenuOptions): GameMenu {
  const sheet = el('section', 'sheet menu-sheet');
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', en.gameMenu.title);
  const header = el('div', 'sheet__header');
  const title = el('h2', 'sheet__title');
  const closeBtn = button('icon-button', '✕');
  closeBtn.setAttribute('aria-label', en.ui.close);
  header.append(title, closeBtn);
  const body = el('div', 'menu-sheet__content');
  sheet.append(header, body);
  root.appendChild(sheet);

  let view: View = 'main';

  const close = (): void => {
    sheet.hidden = true;
  };
  /** Closes the menu, asks, and brings the menu back if the player says no. */
  const ask = (
    o: { title: string; line: string; confirmLabel: string; danger?: boolean },
    onYes: () => void,
  ): void => {
    close();
    opts.confirm.show({
      title: o.title,
      lines: [o.line],
      confirmLabel: o.confirmLabel,
      danger: o.danger,
      onConfirm: onYes,
      onCancel: () => render(view),
    });
  };

  function slotButton(slot: SaveSlot, entry: SaveListEntry | undefined, enabled: boolean) {
    const row = button('save-row', '');
    row.disabled = !enabled;
    row.append(
      el('span', 'save-row__name', slotName(slot)),
      el('span', 'save-row__detail', entry ? saveSummaryText(entry.summary) : en.gameMenu.empty),
    );
    if (entry) row.appendChild(el('span', 'save-row__date', savedAtText(entry.savedAt)));
    return row;
  }

  function list(rows: HTMLElement[]): HTMLElement {
    const ul = el('ul', 'save-list');
    for (const r of rows) {
      const li = el('li', 'save-list__item');
      li.appendChild(r);
      ul.appendChild(li);
    }
    return ul;
  }

  function render(next: View): void {
    view = next;
    sheet.hidden = false;
    body.replaceChildren();
    const saves = opts.getSaves();
    if (view === 'main') {
      title.textContent = en.gameMenu.title;
      const items: [string, () => void][] = [
        [
          en.gameMenu.scores,
          () => {
            close();
            opts.onScores();
          },
        ],
        [en.gameMenu.save, () => render('save')],
        [en.gameMenu.load, () => render('load')],
        [
          en.gameMenu.mainMenu,
          () =>
            ask(
              {
                title: en.gameMenu.mainMenuTitle,
                line: en.gameMenu.mainMenuLine,
                confirmLabel: en.gameMenu.mainMenuConfirm,
              },
              opts.onMainMenu,
            ),
        ],
      ];
      body.appendChild(
        list(
          items.map(([label, run]) => {
            const b = button('menu-item', label);
            b.addEventListener('click', run);
            return b;
          }),
        ),
      );
      return;
    }
    const back = button('btn btn--secondary menu-sheet__back', en.gameMenu.back);
    back.addEventListener('click', () => render('main'));
    if (view === 'save') {
      title.textContent = en.gameMenu.saveTitle;
      const rows = Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
        const slot = (i + 1) as 1 | 2 | 3;
        const entry = findSave(saves, slot);
        const row = slotButton(slot, entry, true);
        row.addEventListener('click', () => {
          if (!entry) {
            close();
            opts.onSave(slot);
            return;
          }
          ask(
            {
              title: fill(en.gameMenu.overwriteTitle, { n: slot }),
              line: en.gameMenu.overwriteLine,
              confirmLabel: en.gameMenu.overwrite,
              danger: true,
            },
            () => opts.onSave(slot),
          );
        });
        return row;
      });
      body.append(list(rows), back);
      return;
    }
    title.textContent = en.gameMenu.loadSheetTitle;
    const rows = ALL_SLOTS.map((slot) => {
      const entry = findSave(saves, slot);
      const row = slotButton(slot, entry, Boolean(entry));
      if (entry) {
        row.addEventListener('click', () =>
          ask(
            {
              title: en.gameMenu.loadConfirmTitle,
              line: en.gameMenu.loadConfirmLine,
              confirmLabel: en.gameMenu.loadConfirm,
              danger: true,
            },
            () => opts.onLoad(slot),
          ),
        );
      }
      return row;
    });
    body.append(list(rows), back);
  }

  closeBtn.addEventListener('click', close);
  // Capture phase on window: the open menu consumes Escape exclusively.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.stopPropagation();
        if (view === 'main') close();
        else render('main');
      }
    },
    true,
  );

  return {
    open: () => render('main'),
    close,
    isOpen: () => !sheet.hidden,
  };
}
