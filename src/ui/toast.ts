// Short message that fades in and out; one at a time.
import { el } from './dom';

const TOAST_MS = 3000;

export function createToast(root: HTMLElement): {
  show(text: string, kind?: 'info' | 'error'): void;
} {
  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  root.appendChild(toast);
  let timer: number | undefined;
  return {
    show(text, kind = 'info') {
      window.clearTimeout(timer);
      toast.textContent = text;
      toast.className = `toast toast--${kind} is-visible`;
      timer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
      }, TOAST_MS);
    },
  };
}
