// Kleines Schild oben links mit dem Seed der Karte.
import { de } from '../i18n/de';

export function createSeedLabel(root: HTMLElement, seedText: string): void {
  const el = document.createElement('div');
  el.className = 'seed-label';
  el.textContent = `${de.seedLabel}: ${seedText}`;
  root.appendChild(el);
}
