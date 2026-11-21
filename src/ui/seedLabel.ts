// Small label at the top left showing the map seed.
import { en } from '../i18n/en';

export function createSeedLabel(root: HTMLElement, seedText: string): void {
  const el = document.createElement('div');
  el.className = 'seed-label';
  el.textContent = `${en.seedLabel}: ${seedText}`;
  root.appendChild(el);
}
