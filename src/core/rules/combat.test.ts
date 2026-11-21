import { describe, expect, it } from 'vitest';
import { applyAction } from '../actions';
import { attackTargets, combatPreview } from './combat';
import { addCity, addUnit, at, makeTestState } from '../testing';
import type { GameState } from '../state';

/** 7x5 plains; forest at (4,2). Human = 0, enemy = 1. */
function world() {
  const s = makeTestState(['ppppppp', 'ppppppp', 'ppppfpp', 'ppppppp', 'ppppppp']);
  s.players.push({
    id: 1,
    isHuman: false,
    goods: { ...s.players[0].goods },
    explored: s.map.tiles.map(() => false),
  });
  return s;
}

function attack(s: GameState, unitId: number, targetId: number) {
  return applyAction(s, { type: 'attack', unitId, targetId });
}

describe('combatPreview', () => {
  it('spearman vs spearman on plains: 5 damage, 5 counter', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    expect(combatPreview(s, a, d)).toEqual({
      damage: 5,
      counter: 5,
      defenderDies: false,
      attackerDies: false,
    });
  });

  it('forest gives x1.5 to the defender', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(3, 2));
    const d = addUnit(s, 'spearman', at(4, 2), { owner: 1 });
    const p = combatPreview(s, a, d);
    expect(p.damage).toBe(4);
    expect(p.counter).toBe(5);
  });

  it('a city center gives x1.5 as well', () => {
    const s = world();
    addCity(s, at(2, 2), { owner: 1 });
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    const p = combatPreview(s, a, d);
    expect(p.damage).toBe(4);
    expect(p.counter).toBe(5);
  });

  it('terrain and city bonuses multiply', () => {
    const s = world();
    addCity(s, at(4, 2), { owner: 1 }); // city center on forest (test only)
    const a = addUnit(s, 'spearman', at(3, 2));
    const d = addUnit(s, 'spearman', at(4, 2), { owner: 1 });
    const p = combatPreview(s, a, d);
    expect(p.damage).toBe(3);
    expect(p.counter).toBe(6);
  });

  it('wounded units deal less', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2), { hp: 5 });
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    // attackPower 1, defensePower 2 -> round(1/3*2*4.5) = 3
    expect(combatPreview(s, a, d).damage).toBe(3);
  });

  it('an archer at distance 2 gets no counter from a spearman', () => {
    const s = world();
    const a = addUnit(s, 'archer', at(1, 2));
    const d = addUnit(s, 'spearman', at(3, 2), { owner: 1 });
    expect(combatPreview(s, a, d).counter).toBe(0);
  });

  it('a killed defender gives no counter', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1, hp: 3 });
    const p = combatPreview(s, a, d);
    expect(p.defenderDies).toBe(true);
    expect(p.counter).toBe(0);
  });
});

describe('attack action', () => {
  it('applies damage and counter and ends the unit turn', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    const res = attack(s, a, d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ua = res.state.units.find((u) => u.id === a);
    const ud = res.state.units.find((u) => u.id === d);
    expect(ua).toMatchObject({ hp: 5, attacked: true, acted: true, movesLeft: 0 });
    expect(ua?.hex).toEqual(at(1, 2));
    expect(ud?.hp).toBe(5);
    // The input stays untouched.
    expect(s.units.find((u) => u.id === d)?.hp).toBe(10);
  });

  it('removes a killed defender and does not move the attacker', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1, hp: 3 });
    const res = attack(s, a, d);
    if (!res.ok) throw new Error('failed');
    expect(res.state.units.map((u) => u.id)).toEqual([a]);
    expect(res.state.units[0].hp).toBe(10);
    expect(res.state.units[0].hex).toEqual(at(1, 2));
  });

  it('removes an attacker killed by the counter', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2), { hp: 2 });
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    const res = attack(s, a, d);
    if (!res.ok) throw new Error('failed');
    expect(res.state.units.map((u) => u.id)).toEqual([d]);
  });

  it('attackTargets lists enemies in range, none after attacking or without range', () => {
    const s = world();
    const a = addUnit(s, 'archer', at(1, 2));
    const near = addUnit(s, 'spearman', at(3, 2), { owner: 1 });
    addUnit(s, 'spearman', at(6, 2), { owner: 1 });
    addUnit(s, 'spearman', at(2, 2)); // own unit
    expect(attackTargets(s, a).map((u) => u.id)).toEqual([near]);
    const settler = addUnit(s, 'settler', at(1, 3));
    expect(attackTargets(s, settler)).toEqual([]);
    const done = attack(s, a, near);
    if (!done.ok) throw new Error('failed');
    expect(attackTargets(done.state, a)).toEqual([]);
  });

  it('reports all errors', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const friend = addUnit(s, 'spearman', at(2, 2));
    const far = addUnit(s, 'spearman', at(5, 2), { owner: 1 });
    const adjacent = addUnit(s, 'spearman', at(1, 3), { owner: 1 });
    const code = (r: ReturnType<typeof attack>) => (r.ok ? 'ok' : r.error.code);
    expect(code(attack(s, 999, far))).toBe('notOwnUnit');
    expect(code(attack(s, far, adjacent))).toBe('notOwnUnit');
    expect(code(attack(s, a, 999))).toBe('notEnemy');
    expect(code(attack(s, a, friend))).toBe('notEnemy');
    expect(code(attack(s, a, far))).toBe('notInRange');
    const settler = addUnit(s, 'settler', at(0, 0));
    expect(code(attack(s, settler, adjacent))).toBe('notInRange');
    const first = attack(s, a, adjacent);
    if (!first.ok) throw new Error('failed');
    expect(code(attack(first.state, a, adjacent))).toBe('alreadyAttacked');
  });
});

describe('attack ends the turn', () => {
  it('an attacking unit cannot move afterwards', () => {
    const s = world();
    const a = addUnit(s, 'spearman', at(1, 2));
    const d = addUnit(s, 'spearman', at(2, 2), { owner: 1 });
    const res = attack(s, a, d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const mv = applyAction(res.state, { type: 'move', unitId: a, to: at(1, 1) });
    expect(mv.ok === false && mv.error.code).toBe('cannotReach');
  });
});
