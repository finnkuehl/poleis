// News about other civilizations for the turn summary (pure, no DOM).
import type { GameEvent, GameState, PlayerId } from '../core/state';
import { en } from '../i18n/en';
import { fill } from '../i18n/format';
import { civName } from './scoreText';
import type { SummaryLine } from './turnSummary';

function line(text: string, kind: SummaryLine['kind'] = 'info'): SummaryLine {
  return { text, kind };
}

function eventToLines(state: GameState, viewer: PlayerId, e: GameEvent): SummaryLine[] {
  switch (e.type) {
    case 'attack': {
      // The viewer's own attacks are their own action: no news.
      if (e.attacker === viewer) return [];
      const civ = civName(state, e.attacker);
      const unit = en.units[e.attackerUnit].toLowerCase();
      if (e.defender === viewer) {
        const own = en.units[e.defenderUnit].toLowerCase();
        const out: SummaryLine[] = [
          line(
            e.defenderKilled
              ? fill(en.events.attackedYouLost, { civ, unit, own })
              : fill(en.events.attackedYou, { civ, unit, own, damage: e.damage }),
            'error',
          ),
        ];
        if (e.attackerKilled) out.push(line(fill(en.events.attackerFell, { own, unit })));
        return out;
      }
      const values = {
        civ,
        unit,
        other: civName(state, e.defender),
        otherUnit: en.units[e.defenderUnit].toLowerCase(),
      };
      return [
        line(
          fill(e.defenderKilled ? en.events.attackedOtherLost : en.events.attackedOther, values),
        ),
      ];
    }
    case 'cityCaptured':
      if (e.from === viewer) {
        return [line(fill(en.events.cityLost, { civ: civName(state, e.by) }), 'error')];
      }
      // Capturing a city is already in the turn summary ("You captured a city!").
      if (e.by === viewer) return [];
      return [
        line(
          fill(en.events.cityTakenOther, {
            civ: civName(state, e.by),
            other: civName(state, e.from),
          }),
        ),
      ];
    case 'cityFounded':
      return e.by === viewer
        ? []
        : [line(fill(en.events.cityFounded, { civ: civName(state, e.by) }))];
    case 'eliminated':
      // Your own defeat has its own screen.
      return e.player === viewer
        ? []
        : [line(fill(en.events.eliminated, { civ: civName(state, e.player) }))];
    case 'wonderStarted':
    case 'wonderCompleted': {
      if (e.player === viewer) return [];
      const started = e.type === 'wonderStarted';
      return [
        line(
          fill(started ? en.events.wonderStarted : en.events.wonderCompleted, {
            civ: civName(state, e.player),
          }),
          started ? 'info' : 'error',
        ),
      ];
    }
  }
}

/** Lines for the events the viewer saw (`seenBy`), in the order they happened. */
export function eventLines(state: GameState, viewer: PlayerId): SummaryLine[] {
  return state.events
    .filter((e) => e.seenBy.includes(viewer))
    .flatMap((e) => eventToLines(state, viewer, e));
}
