// Slim banner under the resource bar with an instruction and a Cancel button.
import { en } from '../i18n/en';
import { button, el } from './dom';

export function createModeBanner(
  root: HTMLElement,
  onCancel: () => void,
): { show(text: string): void; hide(): void } {
  const banner = el('div', 'mode-banner');
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  const text = el('span', 'mode-banner__text');
  const cancel = button('mode-banner__cancel', en.ui.cancel);
  banner.append(text, cancel);
  root.appendChild(banner);
  cancel.addEventListener('click', onCancel);
  return {
    show(t) {
      text.textContent = t;
      banner.hidden = false;
    },
    hide() {
      banner.hidden = true;
    },
  };
}
