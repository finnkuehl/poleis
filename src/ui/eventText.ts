// News about other civilizations for the turn summary (pure, no DOM).
import type { GameEvent, GameState, PlayerId } from '../core/state';
import { en } from '../i18n/en';
import { cityName } from '../i18n/cityNames';
import { fill } from '../i18n/format';
import { civName } from './scoreText';
import type { SummaryLine } from './turnSummary';

function line(text: string, kind: SummaryLine['kind'] = 'info'): SummaryLine {
  return { text, kind };
}

function cityNameOf(state: GameState, cityId: number): string {
  const city = state.cities.find((c) => c.id === cityId);
  return city ? cityName(city.nameIndex) : en.cityPanel.fallbackName;
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
    case 'defenseShot': {
      const unit = en.units[e.unit].toLowerCase();
      if (e.victim === viewer) {
        const civ = civName(state, e.shooter);
        return [
          line(
            e.killed
              ? fill(en.events.shotKilledYou, { civ, unit })
              : fill(en.events.shotAtYou, { civ, unit, damage: e.damage }),
            'error',
          ),
        ];
      }
      if (e.shooter === viewer) {
        const source = e.source === 'city' ? en.events.sourceCity : en.events.sourceTower;
        return [
          line(
            e.killed
              ? fill(en.events.shotKilledEnemy, { source, unit })
              : fill(en.events.shotAtEnemy, { source, unit, damage: e.damage }),
          ),
        ];
      }
      const values = { civ: civName(state, e.shooter), other: civName(state, e.victim), unit };
      return [line(fill(e.killed ? en.events.shotOtherKilled : en.events.shotOther, values))];
    }
    case 'cityCaptured':
      if (e.from === viewer) {
        return [
          line(
            fill(en.events.cityLost, {
              civ: civName(state, e.by),
              city: cityNameOf(state, e.cityId),
            }),
            'error',
          ),
        ];
      }
      // Capturing a city is already in the turn summary ("You captured a city!").
      if (e.by === viewer) return [];
      return [
        line(
          fill(en.events.cityTakenOther, {
            civ: civName(state, e.by),
            city: cityNameOf(state, e.cityId),
            other: civName(state, e.from),
          }),
        ),
      ];
    case 'cityFounded':
      return e.by === viewer
        ? []
        : [
            line(
              fill(en.events.cityFounded, {
                civ: civName(state, e.by),
                city: cityNameOf(state, e.cityId),
              }),
            ),
          ];
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
