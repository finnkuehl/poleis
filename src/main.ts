// Einstiegspunkt: liest den Seed, startet die Darstellung und zeigt bei Fehlern eine Meldung.
import './style.css';
import './ui/ui.css';
import { terrainAt } from './core/map';
import { createGameState } from './core/state';
import { de } from './i18n/de';
import { createRenderer, type Renderer } from './render/app';
import { createSeedLabel, createTileInfoPanel } from './ui';

// iOS-Safari: Pinch-Zoom der ganzen Seite verhindern
document.addEventListener('gesturestart', (event) => event.preventDefault());

/** Seed aus `?seed=…` (getrimmt, max. 40 Zeichen); fehlt er, wird einer gewürfelt und in die URL geschrieben. */
function readSeed(): string {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('seed')?.trim().slice(0, 40);
  if (param) return param;
  const seed = String(Math.floor(Math.random() * 1_000_000));
  url.searchParams.set('seed', seed);
  // Pfad und Hash bleiben erhalten (GitHub Pages unter /poleis/)
  history.replaceState(null, '', url);
  return seed;
}

const appContainer = document.getElementById('app');
const uiContainer = document.getElementById('ui');

if (appContainer && uiContainer) {
  const state = createGameState(readSeed());
  let renderer: Renderer | null = null;
  const panel = createTileInfoPanel(uiContainer, () => renderer?.selectTile(null));
  createSeedLabel(uiContainer, state.seedText);

  createRenderer(appContainer, state, (h) => {
    const terrain = h ? terrainAt(state.map, h) : undefined;
    if (h && terrain) panel.show(h, terrain);
    else panel.hide();
  })
    .then((r) => {
      renderer = r;
    })
    .catch((error: unknown) => {
      console.error(error);
      const message = document.createElement('p');
      message.textContent = de.renderError;
      message.style.cssText =
        'color:#f4e9d8;font-family:Georgia,serif;padding:24px;text-align:center;';
      uiContainer.appendChild(message);
    });
}
