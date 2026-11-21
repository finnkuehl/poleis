// Bottom bar: Build and Road on the left, the End-turn disc on the right.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import { button, el } from './dom';

export type BottomBarMode = 'idle' | 'build' | 'road';

export function createBottomBar(
  root: HTMLElement,
  h: { onBuild(): void; onRoad(): void; onEndTurn(): void },
): {
  setMode(m: BottomBarMode): void;
  setTurn(n: number): void;
  setEnabled(enabled: boolean): void;
} {
  const bar = el('nav', 'bottom-bar');
  const actions = el('div', 'bottom-bar__actions');
  const buildBtn = button('bar-button', en.ui.build);
  const roadBtn = button('bar-button', en.ui.road);
  const endBtn = button('end-turn', '');
  const endLabel = el('span', 'end-turn__label', en.ui.endTurn);
  const endTurn = el('span', 'end-turn__turn');
  endBtn.append(endLabel, endTurn);
  actions.append(buildBtn, roadBtn);
  bar.append(actions, endBtn);
  root.appendChild(bar);

  buildBtn.addEventListener('click', h.onBuild);
  roadBtn.addEventListener('click', h.onRoad);
  endBtn.addEventListener('click', h.onEndTurn);

  return {
    setMode(m) {
      buildBtn.classList.toggle('is-active', m === 'build');
      roadBtn.classList.toggle('is-active', m === 'road');
      buildBtn.setAttribute('aria-pressed', String(m === 'build'));
      roadBtn.setAttribute('aria-pressed', String(m === 'road'));
    },
    setTurn(n) {
      endTurn.textContent = fill(en.ui.turnShort, { turn: n });
    },
    setEnabled(enabled) {
      buildBtn.disabled = !enabled;
      roadBtn.disabled = !enabled;
      endBtn.disabled = !enabled;
    },
  };
}
