// Scores sheet: every civilization with points and wonder progress, plus the viewer's breakdown.
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import type { GameState, PlayerId } from '../core/state';
import { buildingIcon } from './art';
import { button, el } from './dom';
import { playerCssColor } from './playerColors';
import { scoreBreakdown, scoreRows, type ScoreRowView } from './scoreText';

/** One ranking row (also used by the end screen). */
export function scoreRowElement(row: ScoreRowView, rank: number): HTMLElement {
  const li = el('li', 'score-row');
  li.classList.toggle('is-viewer', row.isViewer);
  li.classList.toggle('is-out', row.out);
  // A small city center miniature in the civilization's color (its base rim shows the color).
  const mark = el('span', 'score-row__mark');
  mark.setAttribute('aria-hidden', 'true');
  mark.appendChild(buildingIcon('cityCenter', playerCssColor(row.color)));
  const info = el('div', 'score-row__info');
  const name = el('span', 'score-row__name', `${rank}. ${row.name}`);
  if (row.isViewer) name.appendChild(el('span', 'score-row__you', en.scores.you));
  info.appendChild(name);
  const notes = [row.out ? en.scores.outOfGame : null, row.wonder].filter(
    (n): n is string => n !== null,
  );
  if (notes.length > 0) info.appendChild(el('span', 'score-row__note', notes.join(' – ')));
  const points = el('span', 'score-row__points', String(row.points));
  points.setAttribute('aria-label', fill(en.scores.points, { n: row.points }));
  li.append(mark, info, points);
  return li;
}

/** Ranking list for a state (rows best first). */
export function scoreList(state: GameState, viewer: PlayerId): HTMLElement {
  const ul = el('ol', 'score-list');
  scoreRows(state, viewer).forEach((row, i) => ul.appendChild(scoreRowElement(row, i + 1)));
  return ul;
}

export function createScoresSheet(root: HTMLElement): {
  open(state: GameState, viewer: PlayerId): void;
  close(): void;
  isOpen(): boolean;
} {
  const sheet = el('section', 'sheet menu-sheet scores-sheet');
  sheet.hidden = true;
  sheet.setAttribute('aria-label', en.scores.title);
  const header = el('div', 'sheet__header');
  const closeBtn = button('icon-button', '✕');
  closeBtn.setAttribute('aria-label', en.ui.close);
  header.append(el('h2', 'sheet__title', en.scores.title), closeBtn);
  const body = el('div', 'menu-sheet__content');
  sheet.append(header, body);
  root.appendChild(sheet);

  const close = (): void => {
    sheet.hidden = true;
  };
  closeBtn.addEventListener('click', close);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.stopPropagation();
        close();
      }
    },
    true,
  );

  return {
    open(state, viewer) {
      const breakdown = el('dl', 'breakdown');
      for (const line of scoreBreakdown(state, viewer)) {
        const isTotal = line.label === en.scores.total;
        const row = el('div', `breakdown__row${isTotal ? ' is-total' : ''}`);
        row.append(el('dt', '', line.label), el('dd', '', String(line.points)));
        breakdown.appendChild(row);
      }
      body.replaceChildren(
        scoreList(state, viewer),
        el('h3', 'menu-sheet__subtitle', en.scores.breakdownTitle),
        breakdown,
      );
      sheet.hidden = false;
    },
    close,
    isOpen: () => !sheet.hidden,
  };
}
