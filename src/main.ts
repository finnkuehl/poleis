// Entry point: reads the seed, starts the renderer and shows a message on errors.
import './style.css';
import './ui/ui.css';
import { hexEquals, type Hex } from './core/hex';
import { terrainAt } from './core/map';
import { previewProduction, type BuildingStatus } from './core/rules/production';
import { createGameState } from './core/state';
import { mapgenConfig } from './data/mapgen';
import { en } from './i18n/en';
import { createRenderer, type Renderer } from './render/app';
import { createSeedLabel, createTileInfoPanel } from './ui';

// iOS Safari: prevent pinch-zoom of the whole page
document.addEventListener('gesturestart', (event) => event.preventDefault());

/** Seed from `?seed=...` (trimmed, shortened); if missing, one is rolled and written into the URL. */
function readSeed(): string {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('seed')?.trim().slice(0, mapgenConfig.seedMaxLength);
  if (param) return param;
  const seed = String(Math.floor(Math.random() * mapgenConfig.randomSeedRange));
  url.searchParams.set('seed', seed);
  // Path and hash are kept (GitHub Pages lives under /poleis/)
  history.replaceState(null, '', url);
  return seed;
}

/** Shows the error message above the (empty) map. */
function showError(ui: HTMLElement, error: unknown): void {
  console.error(error);
  const message = document.createElement('p');
  message.textContent = en.renderError;
  message.style.cssText = 'color:#f4e9d8;font-family:Georgia,serif;padding:24px;text-align:center;';
  ui.appendChild(message);
}

function start(appContainer: HTMLElement, uiContainer: HTMLElement): void {
  const state = createGameState(readSeed());
  let renderer: Renderer | null = null;
  let selected: Hex | null = null;
  const panel = createTileInfoPanel(uiContainer, () => {
    selected = null;
    renderer?.selectTile(null);
  });
  createSeedLabel(uiContainer, state.seedText);

  const onTileTap = (tapped: Hex | null): void => {
    // Tapping the selected tile again (or outside the map) deselects
    selected = tapped && !(selected && hexEquals(selected, tapped)) ? tapped : null;
    renderer?.selectTile(selected);
    const terrain = selected ? terrainAt(state.map, selected) : undefined;
    if (selected && terrain) panel.show(selected, terrain);
    else panel.hide();
  };

  createRenderer(appContainer, state, onTileTap)
    .then((r) => {
      renderer = r;
      const statuses: Record<number, BuildingStatus> = {};
      for (const report of previewProduction(state, 0).buildings) {
        statuses[report.buildingId] = report.status;
      }
      r.setState(state, statuses);
    })
    .catch((error: unknown) => showError(uiContainer, error));
}

const appContainer = document.getElementById('app');
const uiContainer = document.getElementById('ui');

if (appContainer && uiContainer) {
  // Errors during map generation should also become a visible message
  try {
    start(appContainer, uiContainer);
  } catch (error) {
    showError(uiContainer, error);
  }
}
