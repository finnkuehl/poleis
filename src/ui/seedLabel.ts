// Small label at the top left showing the map seed.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';

export function createSeedLabel(root: HTMLElement, seedText: string, testMode = false): void {
  const el = document.createElement('div');
  el.className = 'seed-label';
  el.textContent = testMode
    ? fill(en.seedLabelTestMode, { seed: seedText })
    : `${en.seedLabel}: ${seedText}`;
  root.appendChild(el);
}
