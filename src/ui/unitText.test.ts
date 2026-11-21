import { describe, expect, it } from 'vitest';
import type { CombatPreview } from '../core/rules/combat';
import { emptyStock } from '../core/rules/goods';
import type { Unit } from '../core/state';
import { attackPreviewLines, trainOptions, unitStatLine, unitStatus } from './unitText';

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
  it('is ready with moves left', () => expect(unitStatus(unit({}))).toBe('ready'));
  it('can still attack without moves', () =>
    expect(unitStatus(unit({ movesLeft: 0, acted: true }))).toBe('canAttack'));
  it('is done after an attack', () =>
    expect(unitStatus(unit({ attacked: true, movesLeft: 1 }))).toBe('done'));
  it('is done without moves when it cannot attack', () =>
    expect(unitStatus(unit({ type: 'settler', movesLeft: 0 }))).toBe('done'));
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
  const rich = { ...emptyStock(), planks: 10, bronze: 10, bread: 10, grain: 10, drachmas: 10 };
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
    const o = trainOptions({ cityLevel: 'settlement', residents: 2, stock: rich });
    expect(byId(o, 'settler')).toMatchObject({ state: 'noResidents', residentsNeeded: 3 });
    expect(
      byId(trainOptions({ cityLevel: 'settlement', residents: 3, stock: rich }), 'settler')?.state,
    ).toBe('ok');
  });
  it('sorts ready units first', () => {
    const o = trainOptions({ cityLevel: 'settlement', residents: 6, stock: rich });
    expect(o[0]?.state).toBe('ok');
    expect(o[o.length - 1]?.state).toBe('locked');
  });
});
