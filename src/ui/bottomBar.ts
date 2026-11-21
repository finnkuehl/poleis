// Bottom bar: Build, Road and Units on the left, the End-turn disc on the right.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import { button, el } from './dom';

export type BottomBarMode = 'idle' | 'build' | 'road' | 'units';

export function createBottomBar(
  root: HTMLElement,
  h: { onBuild(): void; onRoad(): void; onUnits(): void; onEndTurn(): void },
): {
  setMode(m: BottomBarMode): void;
  setTurn(n: number): void;
  setEnabled(enabled: boolean): void;
  /** Enables or disables only the Units button (e.g. no units yet). */
  setUnitsEnabled(enabled: boolean): void;
} {
  const bar = el('nav', 'bottom-bar');
  const actions = el('div', 'bottom-bar__actions');
  const buildBtn = button('bar-button', en.ui.build);
  const roadBtn = button('bar-button', en.ui.road);
  const unitsBtn = button('bar-button', en.ui.units);
  const endBtn = button('end-turn', '');
  const endLabel = el('span', 'end-turn__label', en.ui.endTurn);
  const endTurn = el('span', 'end-turn__turn');
  endBtn.append(endLabel, endTurn);
  actions.append(buildBtn, roadBtn, unitsBtn);
  bar.append(actions, endBtn);
  root.appendChild(bar);

  buildBtn.addEventListener('click', h.onBuild);
  roadBtn.addEventListener('click', h.onRoad);
  unitsBtn.addEventListener('click', h.onUnits);
  endBtn.addEventListener('click', h.onEndTurn);

  let barEnabled = true;
  let unitsAllowed = true;

  return {
    setMode(m) {
      buildBtn.classList.toggle('is-active', m === 'build');
      roadBtn.classList.toggle('is-active', m === 'road');
      buildBtn.setAttribute('aria-pressed', String(m === 'build'));
      roadBtn.setAttribute('aria-pressed', String(m === 'road'));
      unitsBtn.classList.toggle('is-active', m === 'units');
      unitsBtn.setAttribute('aria-pressed', String(m === 'units'));
    },
    setTurn(n) {
      endTurn.textContent = fill(en.ui.turnShort, { turn: n });
    },
    setEnabled(enabled) {
      buildBtn.disabled = !enabled;
      roadBtn.disabled = !enabled;
      endBtn.disabled = !enabled;
      unitsBtn.disabled = !enabled || !unitsAllowed;
      barEnabled = enabled;
    },
    setUnitsEnabled(enabled) {
      unitsAllowed = enabled;
      unitsBtn.disabled = !barEnabled || !enabled;
    },
  };
}
