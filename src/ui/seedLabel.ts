// Small label at the top left showing the map seed.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';

export function createSeedLabel(
  root: HTMLElement,
  seedText: string,
  testMode = false,
  watchMode = false,
): void {
  const el = document.createElement('div');
  el.className = 'seed-label';
  el.textContent = watchMode
    ? fill(en.seedLabelWatchMode, { seed: seedText })
    : testMode
      ? fill(en.seedLabelTestMode, { seed: seedText })
      : `${en.seedLabel}: ${seedText}`;
  root.appendChild(el);
}
