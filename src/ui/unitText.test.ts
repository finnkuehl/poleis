import { describe, expect, it } from 'vitest';
import type { CombatPreview } from '../core/rules/combat';
import { emptyStock } from '../core/rules/goods';
import type { Unit } from '../core/state';
import {
  attackPreviewLines,
  aboardState,
  aboardText,
  cargoText,
  inUnitCycle,
  onTheWayText,
  orderConfirm,
  orderOutcomeText,
  trainOptions,
  unitStatLine,
  unitStatus,
} from './unitText';

function unit(over: Partial<Unit>): Unit {
  return {
    id: 1,
    type: 'spearman',
    owner: 0,
    hex: { q: 0, r: 0 },
    hp: 10,
    movesLeft: 1,
    hasMoved: false,
    acted: false,
    attacked: false,
    capturing: null,
    order: null,
    aboard: null,
    ...over,
  };
}
const preview = (over: Partial<CombatPreview>): CombatPreview => ({
  damage: 5,
  counter: 5,
  defenderDies: false,
  attackerDies: false,
  ...over,
});

describe('unitStatLine', () => {
  it('lists attack, defense, range and moves', () => {
    expect(unitStatLine('spearman')).toBe('Attack 2 · Defense 2 · Range 1 · Moves 1');
    expect(unitStatLine('settler')).toBe('Attack 0 · Defense 1 · Range – · Moves 1');
  });
});

describe('unitStatus', () => {
  it('is ready with moves left', () => expect(unitStatus(unit({}), false)).toBe('ready'));
  it('can still attack without moves when a target is in reach', () =>
    expect(unitStatus(unit({ movesLeft: 0, acted: true }), true)).toBe('canAttack'));
  it('is done without moves and without targets', () =>
    expect(unitStatus(unit({ movesLeft: 0, acted: true }), false)).toBe('done'));
  it('is done after an attack', () =>
    expect(unitStatus(unit({ attacked: true, movesLeft: 1 }), true)).toBe('done'));
  it('is done without moves when it cannot attack', () =>
    expect(unitStatus(unit({ type: 'settler', movesLeft: 0 }), true)).toBe('done'));
});

describe('attackPreviewLines', () => {
  const a = unit({ id: 1 });
  const d = unit({ id: 2, owner: 1 });
  it('shows damage dealt and taken', () => {
    expect(attackPreviewLines(preview({}), a, d)).toEqual([
      'You deal 5 damage (Spearman 10 → 5 HP)',
      'You take 5 damage (Spearman 10 → 5 HP)',
    ]);
  });
  it('says when there is no counterattack', () => {
    expect(attackPreviewLines(preview({ counter: 0 }), a, d)[1]).toBe('No counterattack');
  });
  it('announces a defeated enemy without a counterattack', () => {
    expect(
      attackPreviewLines(preview({ damage: 12, defenderDies: true, counter: 0 }), a, d),
    ).toEqual(['You deal 12 damage (Spearman 10 → 0 HP)', 'The enemy is defeated']);
  });
  it('warns when the attacker would be lost', () => {
    const lines = attackPreviewLines(preview({ counter: 12, attackerDies: true }), a, d);
    expect(lines[1]).toBe('You take 12 damage (Spearman 10 → 0 HP)');
    expect(lines[2]).toBe('Your unit would be lost');
  });
});

describe('trainOptions', () => {
  const rich = { ...emptyStock(), planks: 10, bronze: 10, grain: 10, drachmas: 10 };
  const byId = (o: ReturnType<typeof trainOptions>, id: string) => o.find((x) => x.id === id);

  it('offers units by city level', () => {
    const o = trainOptions({ cityLevel: 'settlement', residents: 6, stock: rich });
    expect(byId(o, 'spearman')?.state).toBe('ok');
    expect(byId(o, 'hoplite')).toMatchObject({ state: 'locked', level: 'polis' });
    expect(byId(o, 'horseman')).toMatchObject({ state: 'locked', level: 'metropolis' });
  });
  it('lists missing goods', () => {
    const o = trainOptions({
      cityLevel: 'settlement',
      residents: 6,
      stock: { ...emptyStock(), planks: 5 },
    });
    expect(byId(o, 'spearman')).toMatchObject({ state: 'unaffordable', missing: { bronze: 1 } });
  });
  it('blocks settlers in small cities', () => {
    const small = { cityLevel: 'settlement', residents: 2, stock: rich, building: 'cityCenter' };
    const o = trainOptions(small as Parameters<typeof trainOptions>[0]);
    expect(byId(o, 'settler')).toMatchObject({ state: 'noResidents', residentsNeeded: 3 });
    expect(
      byId(
        trainOptions({ ...small, residents: 3 } as Parameters<typeof trainOptions>[0]),
        'settler',
      )?.state,
    ).toBe('ok');
    // The barracks list has no settler any more.
    expect(
      byId(trainOptions({ cityLevel: 'settlement', residents: 6, stock: rich }), 'settler'),
    ).toBeUndefined();
  });
  it('sorts ready units first', () => {
    const o = trainOptions({ cityLevel: 'settlement', residents: 6, stock: rich });
    expect(o[0]?.state).toBe('ok');
    expect(o[o.length - 1]?.state).toBe('locked');
  });
});

describe('onTheWayText', () => {
  it('shows the arrival estimate with plurals', () => {
    expect(onTheWayText(3)).toBe('On the way – arrives in 3 turns');
    expect(onTheWayText(1)).toBe('On the way – arrives in 1 turn');
  });
  it('falls back without an estimate', () => expect(onTheWayText(null)).toBe('On the way'));
});

describe('orderConfirm', () => {
  it('builds title, lines and button label', () => {
    expect(orderConfirm('scout', 3)).toEqual({
      title: 'Send Scout here?',
      lines: ['Arrives in 3 turns', 'It walks on by itself at the start of each turn.'],
      confirmLabel: 'Go here (3 turns)',
    });
  });
  it('uses the singular for one turn', () => {
    const c = orderConfirm('scout', 1);
    expect(c.lines[0]).toBe('Arrives in 1 turn');
    expect(c.confirmLabel).toBe('Go here (1 turn)');
  });
});

describe('orderOutcomeText', () => {
  it('reports arrival as info', () =>
    expect(orderOutcomeText('arrived', 'scout')).toEqual({ text: 'Scout arrived', kind: 'info' }));
  it('reports stops as errors', () => {
    expect(orderOutcomeText('enemySpotted', 'scout')).toEqual({
      text: 'Scout stopped: enemy in sight',
      kind: 'error',
    });
    expect(orderOutcomeText('blocked', 'spearman')).toEqual({
      text: 'Spearman stopped: the way is blocked',
      kind: 'error',
    });
  });
});

describe('ship texts', () => {
  it('cargo text shows the count and the capacity', () => {
    expect(cargoText(1, 2)).toBe('Aboard: 1 / 2');
  });

  it('the harbor trains only ships; locked ships name their level', () => {
    const options = trainOptions({
      cityLevel: 'polis',
      residents: 10,
      stock: { ...emptyStock(), planks: 20, bronze: 5 },
      building: 'harbor',
    });
    expect(options.map((o) => [o.id, o.state])).toEqual([
      ['transport', 'ok'],
      ['trireme', 'locked'],
    ]);
    expect(options[1].level).toBe('metropolis');
    expect(
      trainOptions({ cityLevel: 'polis', residents: 10, stock: emptyStock() }).map((o) => o.id),
    ).not.toContain('transport');
  });

  it('the Units button cycles ships, but passengers only while they can land', () => {
    const base = { aboard: null, movesLeft: 3, attacked: false } as unknown as Unit;
    const passenger = { ...base, aboard: 7 } as Unit;
    expect(inUnitCycle(base, true, 0)).toBe(true);
    expect(inUnitCycle(base, false, 0)).toBe(false);
    expect(inUnitCycle(passenger, true, 2)).toBe(true);
    expect(inUnitCycle(passenger, true, 0)).toBe(false);
    expect(inUnitCycle({ ...passenger, movesLeft: 0 } as Unit, true, 2)).toBe(false);
  });
});

describe('passenger state', () => {
  const p = { movesLeft: 1, attacked: false } as unknown as Unit;
  it('lands, waits for the next turn, or has no shore', () => {
    expect(aboardState(p, 2)).toBe('land');
    expect(aboardState(p, 0)).toBe('noTile');
    expect(aboardState({ ...p, movesLeft: 0 } as Unit, 2)).toBe('noMoves');
    expect(aboardText('noMoves')).toMatch(/next turn/);
  });
});
