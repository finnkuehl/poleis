// Start menu: continue, load, and the new game form with a preview of the map for the seed.
import { gameConfig, MAP_SIZES, mapgenConfig, type BuildingId, type MapSize } from '../data';
import { en } from '../i18n/en';
import { fill, formatTurns } from '../i18n/format';
import { SAVE_SLOT_COUNT, type SaveListEntry, type SaveSlot } from '../save';
import type { GameSettings } from '../core/state';
import { buildingIcon } from './art';
import { button, el } from './dom';
import { PLAYER_COLOR_COUNT, playerColorName, playerCssColor } from './playerColors';
import { findSave, savedAtText, saveSummaryText } from './saveText';
import { drawSeedPreview, previewAspect } from './seedPreview';

export interface StartMenuOptions {
  /** Seed the field starts with. */
  seed: string;
  saves: SaveListEntry[];
  onNewGame(settings: GameSettings, seedText: string): void;
  onContinue(): void;
  onLoad(slot: SaveSlot): void;
}

export interface StartMenu {
  show(): void;
  hide(): void;
  /** Refreshes the Continue button and the list of saved games (e.g. after returning to the menu). */
  setSaves(saves: SaveListEntry[]): void;
}

const PREVIEW_DELAY_MS = 250;
const NAME_MAX_LENGTH = 24;
const SIZE_IDS: readonly MapSize[] = ['small', 'normal', 'large'];
const SIZE_LABEL: Record<MapSize, string> = {
  small: en.startMenu.sizeSmall,
  normal: en.startMenu.sizeNormal,
  large: en.startMenu.sizeLarge,
};

/**
 * The miniatures standing on the front edge of the map card, back to front (later ones are
 * drawn on top). Their place and size are set in ui.css (`.start-menu__piece.is-…`).
 */
const VIGNETTE: readonly { id: BuildingId; className: string }[] = [
  { id: 'house', className: 'is-house' },
  { id: 'temple', className: 'is-temple' },
  { id: 'cityCenter', className: 'is-center' },
];

let uid = 0;

/** Seed text as the game uses it: trimmed and shortened to the maximum length. */
export function normalizeSeed(text: string): string {
  return text.trim().slice(0, mapgenConfig.seedMaxLength);
}

/** A random seed for the "New seed" button (the UI may use Math.random, core may not). */
export function randomSeed(): string {
  return String(Math.floor(Math.random() * 1_000_000));
}

interface ChoiceOption {
  value: string;
  label: string;
  sub?: string;
}

/** The cluster of miniatures in the player's color; `setColor` recolors them in place. */
function createVignette(color: string): { root: HTMLElement; setColor(color: string): void } {
  const root = el('div', 'start-menu__vignette');
  root.setAttribute('aria-hidden', 'true');
  for (const piece of VIGNETTE) {
    const slot = el('span', `start-menu__piece ${piece.className}`);
    slot.appendChild(buildingIcon(piece.id, color));
    root.appendChild(slot);
  }
  return {
    root,
    setColor(next) {
      // The owner-color layer of the drawn art (src/ui/art.ts): change its color without
      // reloading the images, so the pieces do not flicker or settle in again.
      root.querySelectorAll<HTMLElement>('.art__tint').forEach((tint) => {
        tint.style.backgroundColor = next;
      });
    },
  };
}

/** Radio group drawn as a segmented control (native radio inputs: keyboard and screen reader friendly). */
function segmented(
  legend: string,
  options: ChoiceOption[],
  selected: string,
  onChange: (value: string) => void,
): { root: HTMLElement; value(): string } {
  const group = `start-${uid++}`;
  const root = el('fieldset', 'field');
  root.appendChild(el('legend', 'field__label', legend));
  const row = el('div', 'segmented');
  let current = selected;
  for (const o of options) {
    const label = el('label', 'segmented__option');
    const input = el('input', 'segmented__input');
    input.type = 'radio';
    input.name = group;
    input.value = o.value;
    input.checked = o.value === selected;
    input.addEventListener('change', () => {
      current = o.value;
      onChange(o.value);
    });
    const face = el('span', 'segmented__face');
    face.appendChild(el('span', 'segmented__label', o.label));
    if (o.sub) face.appendChild(el('span', 'segmented__sub', o.sub));
    label.append(input, face);
    row.appendChild(label);
  }
  root.appendChild(row);
  return { root, value: () => current };
}

export function createStartMenu(root: HTMLElement, opts: StartMenuOptions): StartMenu {
  const screen = el('section', 'start-menu');
  screen.hidden = true;
  screen.setAttribute('aria-label', en.gameTitle);

  let color = gameConfig.defaultSettings.playerColor;

  // ---- Left: title and the map card with miniatures standing on its front edge ----
  const hero = el('div', 'start-menu__hero');
  const head = el('header', 'start-menu__head');
  head.append(
    el('h1', 'start-menu__title', en.gameTitle),
    el('p', 'start-menu__tagline', en.startMenu.tagline),
  );
  const previewBox = el('figure', 'start-menu__preview');
  const board = el('div', 'start-menu__board');
  const canvas = el('canvas', 'start-menu__canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', en.startMenu.previewLabel);
  const vignette = createVignette(playerCssColor(color));
  board.append(canvas, vignette.root);
  const caption = el('figcaption', 'start-menu__caption');
  previewBox.append(board, caption);
  hero.append(head, previewBox);

  // ---- Right: continue, load, new game ----
  const main = el('div', 'start-menu__main');

  const continueBtn = button('start-menu__continue btn btn--primary', '');
  const continueTitle = el('span', 'start-menu__continue-title', en.startMenu.continueTitle);
  const continueDetail = el('span', 'start-menu__continue-detail');
  continueBtn.append(continueTitle, continueDetail);
  continueBtn.addEventListener('click', () => opts.onContinue());

  const loadToggle = button('btn btn--secondary start-menu__load-toggle', en.startMenu.loadTitle);
  const loadId = `start-load-${uid++}`;
  loadToggle.setAttribute('aria-expanded', 'false');
  loadToggle.setAttribute('aria-controls', loadId);
  const loadList = el('ul', 'save-list');
  loadList.id = loadId;
  loadList.hidden = true;
  loadToggle.addEventListener('click', () => {
    loadList.hidden = !loadList.hidden;
    loadToggle.setAttribute('aria-expanded', String(!loadList.hidden));
    loadToggle.textContent = loadList.hidden ? en.startMenu.loadTitle : en.startMenu.loadHide;
  });
  const saveBlock = el('div', 'start-menu__saves');
  saveBlock.append(continueBtn, loadToggle, loadList);

  const form = el('form', 'start-menu__form');
  form.noValidate = true;
  form.appendChild(el('h2', 'start-menu__section', en.startMenu.newGameTitle));

  // Name
  const nameField = el('div', 'field');
  const nameId = `start-name-${uid++}`;
  const nameLabel = el('label', 'field__label', en.startMenu.nameLabel);
  nameLabel.htmlFor = nameId;
  const nameInput = el('input', 'text-input');
  nameInput.id = nameId;
  nameInput.type = 'text';
  nameInput.maxLength = NAME_MAX_LENGTH;
  nameInput.placeholder = en.defaultPlayerName;
  nameInput.autocomplete = 'off';
  nameField.append(nameLabel, nameInput);

  // Color (the miniatures on the map card follow it)
  const colorField = el('fieldset', 'field');
  colorField.appendChild(el('legend', 'field__label', en.startMenu.colorLabel));
  const swatches = el('div', 'swatches');
  const colorGroup = `start-${uid++}`;
  const colorName = el('p', 'field__hint', playerColorName(color));
  for (let i = 0; i < PLAYER_COLOR_COUNT; i++) {
    const label = el('label', 'swatch');
    const input = el('input', 'swatch__input');
    input.type = 'radio';
    input.name = colorGroup;
    input.value = String(i);
    input.checked = i === color;
    input.setAttribute('aria-label', playerColorName(i));
    input.addEventListener('change', () => {
      color = i;
      colorName.textContent = playerColorName(i);
      vignette.setColor(playerCssColor(i));
    });
    const dot = el('span', 'swatch__dot');
    dot.style.background = playerCssColor(i);
    dot.title = playerColorName(i);
    label.append(input, dot);
    swatches.appendChild(label);
  }
  colorField.append(swatches, colorName);

  // Rivals
  const rivals = segmented(
    en.startMenu.rivalsLabel,
    Array.from({ length: gameConfig.maxAiCount }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    })),
    String(gameConfig.menuDefaultAiCount),
    () => undefined,
  );

  /** The seed the preview shows and the game gets; an empty field uses the seed the menu opened with. */
  const currentSeed = (): string => normalizeSeed(seedInput.value) || normalizeSeed(opts.seed);

  // Map size and seed (both redraw the preview)
  let previewTimer: number | undefined;
  const seedInput = el('input', 'text-input');
  const redrawSoon = (): void => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(redraw, PREVIEW_DELAY_MS);
  };
  const size = segmented(
    en.startMenu.sizeLabel,
    SIZE_IDS.map((id) => ({
      value: id,
      label: SIZE_LABEL[id],
      sub: fill(en.startMenu.sizeDimensions, { w: MAP_SIZES[id].width, h: MAP_SIZES[id].height }),
    })),
    gameConfig.defaultSettings.mapSize,
    () => {
      applyAspect();
      redrawSoon();
    },
  );
  const currentSize = (): MapSize => size.value() as MapSize;
  const applyAspect = (): void => {
    previewBox.style.setProperty('--map-aspect', String(previewAspect(currentSize())));
  };
  function redraw(): void {
    const seed = currentSeed();
    caption.textContent = fill(en.startMenu.previewCaption, { seed });
    drawSeedPreview(canvas, seed, currentSize());
  }

  const seedField = el('div', 'field');
  const seedId = `start-seed-${uid++}`;
  const seedLabel = el('label', 'field__label', en.startMenu.seedLabel);
  seedLabel.htmlFor = seedId;
  seedInput.id = seedId;
  seedInput.type = 'text';
  seedInput.value = opts.seed;
  seedInput.maxLength = mapgenConfig.seedMaxLength;
  seedInput.autocomplete = 'off';
  seedInput.spellcheck = false;
  seedInput.addEventListener('input', redrawSoon);
  const newSeedBtn = button('btn btn--secondary', en.startMenu.newSeed);
  newSeedBtn.addEventListener('click', () => {
    seedInput.value = randomSeed();
    redrawSoon();
  });
  const seedRow = el('div', 'seed-row');
  seedRow.append(seedInput, newSeedBtn);
  seedField.append(seedLabel, seedRow, el('p', 'field__hint', en.startMenu.seedHint));

  // Ways to win
  const victory = { ...gameConfig.defaultSettings.victory };
  const victoryField = el('fieldset', 'field');
  victoryField.appendChild(el('legend', 'field__label', en.startMenu.victoryLabel));
  const victoryDefs: { key: keyof typeof victory; title: string; info: string }[] = [
    { key: 'points', title: en.startMenu.victoryPoints, info: en.startMenu.victoryPointsInfo },
    { key: 'wonder', title: en.startMenu.victoryWonder, info: en.startMenu.victoryWonderInfo },
    {
      key: 'conquest',
      title: en.startMenu.victoryConquest,
      info: en.startMenu.victoryConquestInfo,
    },
  ];
  const victoryInputs = new Map<string, HTMLInputElement>();
  const lockHint = el('p', 'field__hint', en.startMenu.victoryLocked);
  lockHint.hidden = true;
  const syncVictory = (): void => {
    const on = victoryDefs.filter((d) => victory[d.key]);
    for (const d of victoryDefs) {
      const input = victoryInputs.get(d.key);
      if (input) input.disabled = on.length === 1 && victory[d.key];
    }
    lockHint.hidden = on.length !== 1;
  };
  for (const d of victoryDefs) {
    const label = el('label', 'option');
    const input = el('input', 'option__input');
    input.type = 'checkbox';
    input.checked = victory[d.key];
    input.addEventListener('change', () => {
      victory[d.key] = input.checked;
      syncVictory();
    });
    victoryInputs.set(d.key, input);
    const text = el('span', 'option__text');
    text.append(el('span', 'option__title', d.title), el('span', 'option__info', d.info));
    label.append(input, text);
    victoryField.appendChild(label);
  }
  victoryField.appendChild(lockHint);
  syncVictory();

  const limit = el(
    'p',
    'field__hint',
    fill(en.startMenu.turnLimit, { turns: formatTurns(gameConfig.defaultSettings.turnLimit) }),
  );

  const foundBtn = button('btn btn--primary start-menu__found', en.startMenu.found);
  foundBtn.type = 'submit';
  form.append(
    nameField,
    colorField,
    rivals.root,
    size.root,
    seedField,
    victoryField,
    limit,
    foundBtn,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings: GameSettings = {
      ...gameConfig.defaultSettings,
      aiCount: Number(rivals.value()),
      mapSize: currentSize(),
      victory: { ...victory },
      playerName: nameInput.value.trim().slice(0, NAME_MAX_LENGTH),
      playerColor: color,
    };
    opts.onNewGame(settings, currentSeed());
  });

  main.append(saveBlock, form);
  const inner = el('div', 'start-menu__inner');
  inner.append(hero, main);
  screen.appendChild(inner);
  root.appendChild(screen);
  applyAspect();

  function setSaves(saves: SaveListEntry[]): void {
    const auto = findSave(saves, 'auto');
    continueBtn.hidden = !auto;
    if (auto) continueDetail.textContent = saveSummaryText(auto.summary);
    // The found button is the main action unless there is a game to continue.
    foundBtn.className = `btn start-menu__found ${auto ? 'btn--secondary' : 'btn--primary'}`;
    const slots: SaveSlot[] = Array.from(
      { length: SAVE_SLOT_COUNT },
      (_, i) => (i + 1) as SaveSlot,
    );
    loadList.replaceChildren(
      ...slots.map((slot) => {
        const entry = findSave(saves, slot);
        const li = el('li', 'save-list__item');
        const row = button('save-row', '');
        row.disabled = !entry;
        row.append(
          el('span', 'save-row__name', fill(en.gameMenu.slot, { n: slot })),
          el(
            'span',
            'save-row__detail',
            entry ? saveSummaryText(entry.summary) : en.gameMenu.empty,
          ),
        );
        if (entry) {
          row.appendChild(el('span', 'save-row__date', savedAtText(entry.savedAt)));
          row.addEventListener('click', () => opts.onLoad(slot));
        }
        li.appendChild(row);
        return li;
      }),
    );
    const hasManual = slots.some((slot) => findSave(saves, slot));
    loadToggle.hidden = !hasManual;
    if (!hasManual) loadList.hidden = true;
  }
  setSaves(opts.saves);

  return {
    show() {
      screen.hidden = false;
      redraw();
    },
    hide() {
      screen.hidden = true;
      window.clearTimeout(previewTimer);
    },
    setSaves,
  };
}
