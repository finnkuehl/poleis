// Entry point: reads the seed, starts the renderer and shows a message on errors.
import './style.css';
import './ui/ui.css';
import { createGameState, type GameSettings, type GameState } from './core/state';
import { gameConfig, MAP_SIZES, type MapSize } from './data/game';
import { mapgenConfig } from './data/mapgen';
import { en } from './i18n/en';
import { ALL_SLOTS, browserStorage, listSaves, loadGame, type SaveSlot } from './save';
import { BOOT_INTENT_KEY, createGame, type GameOptions } from './ui/interaction';
import { createStartMenu, createToast, formatSaveError, randomSeed, type StartMenu } from './ui';

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

/** Dev settings from the URL: `&ai=N` (0-3) and `&size=small|normal|large`. */
function readSettings(): Partial<GameSettings> {
  const params = new URL(window.location.href).searchParams;
  const settings: Partial<GameSettings> = {};
  const ai = Number(params.get('ai'));
  if (params.has('ai') && Number.isFinite(ai)) {
    settings.aiCount = Math.max(0, Math.min(gameConfig.maxAiCount, Math.floor(ai)));
  }
  const size = params.get('size');
  if (size !== null && Object.keys(MAP_SIZES).includes(size)) settings.mapSize = size as MapSize;
  return settings;
}

/** Puts the seed into the URL (path and hash are kept, GitHub Pages lives under /poleis/). */
function writeSeedToUrl(seed: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  history.replaceState(null, '', url);
}

/** Starts the game with a ready state. */
function launch(
  appContainer: HTMLElement,
  uiContainer: HTMLElement,
  state: GameState,
  sandbox = false,
  options: GameOptions = {},
): void {
  writeSeedToUrl(state.seedText);
  createGame(appContainer, uiContainer, state, sandbox, options).catch((error: unknown) =>
    showError(uiContainer, error),
  );
}

/** Slot the in-game Load asked for before reloading the page (the intent is used once). */
function takeBootIntent(): SaveSlot | null {
  try {
    const text = window.sessionStorage.getItem(BOOT_INTENT_KEY);
    if (text === null) return null;
    window.sessionStorage.removeItem(BOOT_INTENT_KEY);
    const slot = (JSON.parse(text) as { load?: unknown }).load;
    return ALL_SLOTS.includes(slot as SaveSlot) ? (slot as SaveSlot) : null;
  } catch {
    return null;
  }
}

function start(appContainer: HTMLElement, uiContainer: HTMLElement): void {
  const params = new URL(window.location.href).searchParams;
  const storage = browserStorage();
  const toast = createToast(uiContainer);
  const loadSlot = takeBootIntent();

  // Quick start for testing: these parameters skip the menu.
  // `&reveal` shows the whole map (display only); `&watch` lets an AI play the human too (implies reveal).
  const watch = params.has('watch');
  const quick = params.has('sandbox') || params.has('ai') || params.has('size') || watch;
  if (loadSlot === null && quick) {
    const sandbox = params.has('sandbox');
    const state = createGameState(readSeed(), { sandbox, settings: readSettings() });
    launch(appContainer, uiContainer, state, sandbox, {
      reveal: params.has('reveal') || watch,
      watch,
    });
    return;
  }

  let menu: StartMenu | null = null;
  const begin = (state: GameState): void => {
    menu?.hide();
    launch(appContainer, uiContainer, state);
  };
  const loadInto = (slot: SaveSlot): boolean => {
    const result = loadGame(storage, slot);
    if (!result.ok) {
      toast.show(formatSaveError(result.error), 'error');
      return false;
    }
    begin(result.state);
    return true;
  };

  if (loadSlot !== null && loadInto(loadSlot)) return;

  const seedParam = params.get('seed')?.trim().slice(0, mapgenConfig.seedMaxLength);
  menu = createStartMenu(uiContainer, {
    seed: seedParam || randomSeed(),
    saves: listSaves(storage),
    onNewGame: (settings, seedText) => {
      const seed = seedText.trim().slice(0, mapgenConfig.seedMaxLength) || randomSeed();
      begin(createGameState(seed, { settings }));
    },
    onContinue: () => {
      loadInto('auto');
    },
    onLoad: (slot) => {
      loadInto(slot);
    },
  });
  menu.show();
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
