// End screen: victory or defeat, the reason, the final ranking and what to do next.
import { en } from '../i18n/en';
import type { GameState, PlayerId } from '../core/state';
import { button, el } from './dom';
import { endText } from './endText';
import { scoreList } from './scoresSheet';

export interface EndScreenOptions {
  onNewGame(): void;
  onLookAtMap(): void;
}

export interface EndScreen {
  /** Shows the result of `state` from the point of view of `viewer` (default: the human, player 0). */
  show(state: GameState, viewer?: PlayerId): void;
  hide(): void;
}

export function createEndScreen(root: HTMLElement, opts: EndScreenOptions): EndScreen {
  const screen = el('section', 'end-screen');
  screen.hidden = true;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const card = el('div', 'end-screen__card');
  const title = el('h2', 'end-screen__title');
  const reason = el('p', 'end-screen__reason');
  const ranking = el('div', 'end-screen__ranking');
  const buttons = el('div', 'end-screen__buttons');
  const newBtn = button('btn btn--primary', en.endScreen.newGame);
  const mapBtn = button('btn btn--secondary', en.endScreen.lookAtMap);
  buttons.append(newBtn, mapBtn);
  card.append(
    title,
    reason,
    el('h3', 'end-screen__subtitle', en.endScreen.rankingTitle),
    ranking,
    buttons,
  );
  screen.appendChild(card);
  root.appendChild(screen);

  const hide = (): void => {
    screen.hidden = true;
  };
  newBtn.addEventListener('click', () => {
    hide();
    opts.onNewGame();
  });
  mapBtn.addEventListener('click', () => {
    hide();
    opts.onLookAtMap();
  });

  return {
    show(state, viewer = 0) {
      const text = endText(state, viewer);
      if (!text) return;
      title.textContent = text.title;
      title.className = `end-screen__title ${text.victory ? 'is-victory' : 'is-defeat'}`;
      reason.textContent = text.reason;
      ranking.replaceChildren(scoreList(state, viewer));
      screen.hidden = false;
      newBtn.focus();
    },
    hide,
  };
}
