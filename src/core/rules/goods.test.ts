import { describe, expect, it } from 'vitest';
import { addGoods, canAfford, emptyStock, missingGoods, pay, scaleGoods } from './goods';

describe('goods helpers', () => {
  it('empty stock has all goods at 0', () => {
    const s = emptyStock();
    expect(s.wood).toBe(0);
    expect(s.drachmas).toBe(0);
  });
  it('canAfford / missingGoods', () => {
    const s = { ...emptyStock(), wood: 3 };
    expect(canAfford(s, { wood: 3 })).toBe(true);
    expect(canAfford(s, { wood: 4, stone: 1 })).toBe(false);
    expect(missingGoods(s, { wood: 4, stone: 1 })).toEqual({ wood: 1, stone: 1 });
    expect(missingGoods(s, { wood: 2 })).toEqual({});
  });
  it('pay and addGoods mutate', () => {
    const s = { ...emptyStock(), wood: 5 };
    pay(s, { wood: 2 });
    addGoods(s, { stone: 3 });
    expect(s.wood).toBe(3);
    expect(s.stone).toBe(3);
  });
  it('scaleGoods rounds down', () => {
    expect(scaleGoods({ wood: 5, stone: 1 }, 0.5)).toEqual({ wood: 2, stone: 0 });
  });
});
