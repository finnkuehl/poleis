// End screen: victory or defeat, the reason, the final ranking and what to do next.
// A miniature stands on the top edge of the card: the winner's world in the winner's color on a
// victory, a greyed temple on a defeat.
import { en } from '../i18n/en';
import type { BuildingId } from '../data';
import type { GameState, PlayerId } from '../core/state';
import { buildingIcon } from './art';
import { button, el } from './dom';
import { endText } from './endText';
import { playerCssColor } from './playerColors';
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

/** Which miniature the end screen shows, in which player color, and whether it is greyed out. */
export interface EndFigure {
  building: BuildingId;
  /** Index into the player colors. */
  color: number;
  /** true = defeat: the quiet, greyed-out version. */
  muted: boolean;
}

/**
 * The miniature for a finished game: on a victory the wonder (won by the wonder) or the city
 * center (any other way) in the winner's color; on a defeat a greyed temple. null while the
 * game still runs.
 */
export function endFigure(state: GameState, viewer: PlayerId): EndFigure | null {
  const result = state.result;
  if (!result) return null;
  const colorOf = (id: PlayerId): number => state.players.find((p) => p.id === id)?.color ?? id;
  if (result.winner !== null && result.winner === viewer) {
    return {
      building: result.reason === 'wonder' ? 'wonder' : 'cityCenter',
      color: colorOf(result.winner),
      muted: false,
    };
  }
  return { building: 'temple', color: colorOf(viewer), muted: true };
}

export function createEndScreen(root: HTMLElement, opts: EndScreenOptions): EndScreen {
  const screen = el('section', 'end-screen');
  screen.hidden = true;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const stage = el('div', 'end-screen__stage');
  const figure = el('div', 'end-screen__figure');
  figure.setAttribute('aria-hidden', 'true');
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
  stage.append(figure, card);
  screen.appendChild(stage);
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
      const look = endFigure(state, viewer);
      if (!text || !look) return;
      const mood = text.victory ? 'is-victory' : 'is-defeat';
      stage.className = `end-screen__stage ${mood}`;
      figure.replaceChildren(buildingIcon(look.building, playerCssColor(look.color)));
      figure.classList.toggle('is-muted', look.muted);
      title.textContent = text.title;
      title.className = `end-screen__title ${mood}`;
      reason.textContent = text.reason;
      ranking.replaceChildren(scoreList(state, viewer));
      screen.scrollTop = 0;
      screen.hidden = false;
      newBtn.focus();
    },
    hide,
  };
}
