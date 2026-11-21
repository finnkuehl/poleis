// Confirmation sheet: title, detail lines, Cancel and a confirm button.
import { en } from '../i18n/en';
import { button, el } from './dom';

export interface ConfirmOptions {
  title: string;
  lines: string[];
  confirmLabel: string;
  /** Danger style (wine) for destructive actions. */
  danger?: boolean;
  /** If set, the confirm button is disabled and this reason is shown. */
  disabledReason?: string;
  onConfirm(): void;
  onCancel(): void;
}

/** The sheet hides itself before calling `onConfirm` or `onCancel`. */
export function createConfirmSheet(root: HTMLElement): {
  show(o: ConfirmOptions): void;
  /** Hides the sheet via the cancel path (runs onCancel) if it is open. */
  cancel(): void;
  hide(): void;
} {
  const sheet = el('section', 'sheet confirm-sheet');
  sheet.hidden = true;
  const title = el('h2', 'sheet__title');
  const lines = el('ul', 'confirm-sheet__lines');
  const reason = el('p', 'confirm-sheet__reason');
  const buttons = el('div', 'confirm-sheet__buttons');
  const cancelBtn = button('btn btn--secondary', en.ui.cancel);
  const confirmBtn = button('btn btn--primary', '');
  buttons.append(cancelBtn, confirmBtn);
  sheet.append(title, lines, reason, buttons);
  root.appendChild(sheet);

  let current: ConfirmOptions | null = null;
  const hide = (): void => {
    sheet.hidden = true;
    current = null;
  };
  cancelBtn.addEventListener('click', () => {
    const c = current;
    hide();
    c?.onCancel();
  });
  confirmBtn.addEventListener('click', () => {
    const c = current;
    hide();
    c?.onConfirm();
  });
  const cancel = (): void => {
    const c = current;
    if (!c) return;
    hide();
    c.onCancel();
  };
  // Capture phase on window: the open sheet is topmost and consumes Escape,
  // so no other component reacts to the same key press.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && current) {
        e.stopPropagation();
        cancel();
      }
    },
    true,
  );

  return {
    show(o) {
      current = o;
      title.textContent = o.title;
      lines.replaceChildren(
        ...o.lines.map((line) => {
          const li = el('li', 'confirm-sheet__line', line);
          return li;
        }),
      );
      reason.textContent = o.disabledReason ?? '';
      reason.hidden = !o.disabledReason;
      confirmBtn.textContent = o.confirmLabel;
      confirmBtn.className = `btn ${o.danger ? 'btn--danger' : 'btn--primary'}`;
      confirmBtn.disabled = Boolean(o.disabledReason);
      sheet.hidden = false;
    },
    cancel,
    hide,
  };
}
