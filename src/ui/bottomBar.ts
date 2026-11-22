// Bottom bar: Build, Undo and Units on the left, the End-turn disc on the right.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import { button, el } from './dom';

export type BottomBarMode = 'idle' | 'build' | 'units';

export function createBottomBar(
  root: HTMLElement,
  h: { onBuild(): void; onUndo(): void; onUnits(): void; onEndTurn(): void },
): {
  setMode(m: BottomBarMode): void;
  setTurn(n: number): void;
  setEnabled(enabled: boolean): void;
  /** Game over: Build, Undo and Units are disabled; End turn looks disabled but still reports taps. */
  setGameOver(over: boolean): void;
  /** Enables or disables only the Units button (e.g. no units yet). */
  setUnitsEnabled(enabled: boolean): void;
  /** Enables or disables only the Undo button (nothing to take back). */
  setUndoEnabled(enabled: boolean): void;
} {
  const bar = el('nav', 'bottom-bar');
  const actions = el('div', 'bottom-bar__actions');
  const buildBtn = button('bar-button', en.ui.build);
  const undoBtn = button('bar-button bar-button--undo', '');
  undoBtn.append(el('span', 'bar-button__icon', '\u21B6'), el('span', '', en.ui.undo));
  undoBtn.setAttribute('aria-label', en.ui.undoLabel);
  undoBtn.disabled = true;
  const unitsBtn = button('bar-button', en.ui.units);
  const endBtn = button('end-turn', '');
  const endLabel = el('span', 'end-turn__label', en.ui.endTurn);
  const endTurn = el('span', 'end-turn__turn');
  endBtn.append(endLabel, endTurn);
  actions.append(buildBtn, undoBtn, unitsBtn);
  bar.append(actions, endBtn);
  root.appendChild(bar);

  buildBtn.addEventListener('click', h.onBuild);
  undoBtn.addEventListener('click', h.onUndo);
  unitsBtn.addEventListener('click', h.onUnits);
  endBtn.addEventListener('click', h.onEndTurn);

  let barEnabled = true;
  let unitsAllowed = true;
  let undoAllowed = false;
  let gameOver = false;

  return {
    setMode(m) {
      buildBtn.classList.toggle('is-active', m === 'build');
      buildBtn.setAttribute('aria-pressed', String(m === 'build'));
      unitsBtn.classList.toggle('is-active', m === 'units');
      unitsBtn.setAttribute('aria-pressed', String(m === 'units'));
    },
    setTurn(n) {
      endTurn.textContent = fill(en.ui.turnShort, { turn: n });
    },
    setEnabled(enabled) {
      buildBtn.disabled = !enabled;
      undoBtn.disabled = !enabled || gameOver || !undoAllowed;
      endBtn.disabled = !enabled;
      unitsBtn.disabled = !enabled || gameOver || !unitsAllowed;
      barEnabled = enabled;
    },
    setGameOver(over) {
      buildBtn.disabled = over;
      gameOver = over;
      undoBtn.disabled = !barEnabled || over || !undoAllowed;
      unitsBtn.disabled = !barEnabled || over || !unitsAllowed;
      endBtn.classList.toggle('is-disabled', over);
      endBtn.setAttribute('aria-disabled', String(over));
    },
    setUndoEnabled(enabled) {
      undoAllowed = enabled;
      undoBtn.disabled = !barEnabled || gameOver || !enabled;
    },
    setUnitsEnabled(enabled) {
      unitsAllowed = enabled;
      unitsBtn.disabled = !barEnabled || gameOver || !enabled;
    },
  };
}
