// Einstiegspunkt: liest den Seed, startet die Darstellung und zeigt bei Fehlern eine Meldung.
import './style.css';
import './ui/ui.css';
import { terrainAt } from './core/map';
import { createGameState } from './core/state';
import { mapgenConfig } from './data/mapgen';
import { de } from './i18n/de';
import { createRenderer, type Renderer } from './render/app';
import { createSeedLabel, createTileInfoPanel } from './ui';

// iOS-Safari: Pinch-Zoom der ganzen Seite verhindern
document.addEventListener('gesturestart', (event) => event.preventDefault());

/** Seed aus `?seed=…` (getrimmt, gekürzt); fehlt er, wird einer gewürfelt und in die URL geschrieben. */
function readSeed(): string {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('seed')?.trim().slice(0, mapgenConfig.seedMaxLength);
  if (param) return param;
  const seed = String(Math.floor(Math.random() * mapgenConfig.randomSeedRange));
  url.searchParams.set('seed', seed);
  // Pfad und Hash bleiben erhalten (GitHub Pages unter /poleis/)
  history.replaceState(null, '', url);
  return seed;
}

/** Zeigt die Fehlermeldung über der (leeren) Karte an. */
function showError(ui: HTMLElement, error: unknown): void {
  console.error(error);
  const message = document.createElement('p');
  message.textContent = de.renderError;
  message.style.cssText = 'color:#f4e9d8;font-family:Georgia,serif;padding:24px;text-align:center;';
  ui.appendChild(message);
}

function start(appContainer: HTMLElement, uiContainer: HTMLElement): void {
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
    .catch((error: unknown) => showError(uiContainer, error));
}

const appContainer = document.getElementById('app');
const uiContainer = document.getElementById('ui');

if (appContainer && uiContainer) {
  // Auch Fehler bei der Kartenerzeugung sollen als Meldung sichtbar werden
  try {
    start(appContainer, uiContainer);
  } catch (error) {
    showError(uiContainer, error);
  }
}
