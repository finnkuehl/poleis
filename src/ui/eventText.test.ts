import { describe, expect, it } from 'vitest';
import { createGameState, type GameEvent } from '../core/state';
import { cityName } from '../i18n/cityNames';
import { en } from '../i18n/en';
import { eventLines } from './eventText';

const hex = { q: 3, r: 3 };

function stateWith(...events: GameEvent[]) {
  const state = createGameState('events', { settings: { aiCount: 2 } });
  state.events.push(...events);
  return state;
}

function civ(state: ReturnType<typeof stateWith>, id: number): string {
  return en.civs[state.players[id].civ ?? 'athens'];
}

const attack = (over: Partial<Extract<GameEvent, { type: 'attack' }>>): GameEvent => ({
  type: 'attack',
  turn: 5,
  attacker: 1,
  defender: 0,
  attackerUnit: 'hoplite',
  defenderUnit: 'scout',
  hex,
  damage: 4,
  counter: 0,
  defenderKilled: false,
  attackerKilled: false,
  seenBy: [0, 1],
  ...over,
});

describe('eventLines', () => {
  it('ignores events the viewer did not see', () => {
    expect(eventLines(stateWith(attack({ seenBy: [1, 2] })), 0)).toEqual([]);
  });

  it('reports an attack on the viewer as bad news', () => {
    const state = stateWith(attack({}));
    expect(eventLines(state, 0)).toEqual([
      { kind: 'error', text: `${civ(state, 1)}'s hoplite attacked your scout (−4 HP)` },
    ]);
  });

  it('reports a lost unit and a repelled attacker', () => {
    const lost = stateWith(attack({ defenderKilled: true }));
    expect(eventLines(lost, 0)[0].text).toBe(`${civ(lost, 1)}'s hoplite defeated your scout`);
    const repelled = stateWith(attack({ attackerKilled: true }));
    expect(eventLines(repelled, 0).map((l) => l.kind)).toEqual(['error', 'info']);
  });

  it('skips the viewer attacking and shows other civilizations fighting', () => {
    expect(eventLines(stateWith(attack({ attacker: 0, defender: 1 })), 0)).toEqual([]);
    const state = stateWith(attack({ attacker: 1, defender: 2, seenBy: [0, 1, 2] }));
    expect(eventLines(state, 0)).toEqual([
      {
        kind: 'info',
        text: `${civ(state, 1)}'s hoplite attacked ${civ(state, 2)}'s scout`,
      },
    ]);
  });

  it('reports captured cities by who is involved', () => {
    const base = { type: 'cityCaptured', turn: 5, cityId: 1, hex } as const;
    const lost = stateWith({ ...base, by: 1, from: 0, seenBy: [0, 1] });
    expect(eventLines(lost, 0)).toEqual([
      { kind: 'error', text: `${civ(lost, 1)} captured Argos` },
    ]);
    const won = stateWith({ ...base, by: 0, from: 1, seenBy: [0, 1] });
    // The viewer's own capture is reported by the turn summary, not here.
    expect(eventLines(won, 0)).toEqual([]);
    const other = stateWith({ ...base, by: 1, from: 2, seenBy: [0, 1, 2] });
    expect(eventLines(other, 0)[0].text).toBe(
      `${civ(other, 1)} captured Argos from ${civ(other, 2)}`,
    );
  });

  it('reports foundings, eliminations and wonders of others, not of the viewer', () => {
    const state2 = createGameState('events', { settings: { aiCount: 2 } });
    const state = stateWith(
      { type: 'cityFounded', turn: 5, by: 1, cityId: state2.cities[1].id, hex, seenBy: [0, 1] },
      { type: 'cityFounded', turn: 5, by: 0, cityId: 5, hex, seenBy: [0] },
      { type: 'eliminated', turn: 5, player: 2, seenBy: [0, 2] },
      { type: 'wonderStarted', turn: 5, player: 1, hex, seenBy: [0, 1, 2] },
      { type: 'wonderCompleted', turn: 5, player: 2, hex, seenBy: [0, 1, 2] },
      { type: 'wonderCompleted', turn: 5, player: 0, hex, seenBy: [0, 1, 2] },
    );
    expect(eventLines(state, 0)).toEqual([
      { kind: 'info', text: `${civ(state, 1)} founded ${cityName(state.cities[1].nameIndex)}` },
      { kind: 'info', text: `${civ(state, 2)} is out of the game` },
      { kind: 'info', text: `${civ(state, 1)} started a world wonder` },
      { kind: 'error', text: `${civ(state, 2)} completed its world wonder` },
    ]);
  });
});
