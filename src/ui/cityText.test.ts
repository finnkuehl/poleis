import { describe, expect, it } from 'vitest';
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityStats } from '../core/rules/population';
import { emptyStock } from '../core/rules/goods';
import {
  advanceBlockReason,
  advanceRows,
  growthState,
  growthText,
  needText,
  tradeRows,
} from './cityText';

const stats: CityStats = {
  residents: 6,
  housing: 8,
  foodPerTurn: 3,
  needs: [],
  supply: null,
  taxPerTurn: 3,
};

describe('growthState', () => {
  it('grows when fed and housing is free', () => {
    const stock = { ...emptyStock(), fish: 3 };
    const s = growthState('settlement', stats, stock);
    expect(s).toEqual({ kind: 'growing', perTurn: 1 });
    expect(growthText(s)).toBe('Growing: +1 per turn');
  });
  it('limits growth to free housing', () => {
    const stock = { ...emptyStock(), bread: 5 };
    expect(growthState('polis', { ...stats, housing: 7 }, stock)).toEqual({
      kind: 'growing',
      perTurn: 1,
    });
    expect(growthState('polis', stats, stock)).toEqual({ kind: 'growing', perTurn: 2 });
  });
  it('is full without free housing', () => {
    const stock = { ...emptyStock(), fish: 3 };
    const s = growthState('settlement', { ...stats, housing: 6 }, stock);
    expect(growthText(s)).toBe('Full – build houses to grow');
  });
  it('is hungry when food in stock does not cover a turn (fish and bread count together)', () => {
    expect(growthText(growthState('settlement', stats, emptyStock()))).toBe(
      'Hungry – loses 1 resident per turn',
    );
    expect(growthState('settlement', stats, { ...emptyStock(), fish: 1, bread: 2 }).kind).toBe(
      'growing',
    );
    expect(growthState('settlement', stats, { ...emptyStock(), fish: 1, bread: 1 }).kind).toBe(
      'hungry',
    );
  });
});

describe('needText', () => {
  it('marks missing needs', () => {
    expect(needText({ good: 'oil', amount: 2, inStock: true })).toBe('Needs 2 Oil per turn');
    expect(needText({ good: 'oil', amount: 2, inStock: false })).toBe(
      'Needs 2 Oil per turn – missing',
    );
  });
});

const check: AdvanceCheck = {
  to: 'polis',
  residents: { have: 12, need: 20, ok: false },
  supply: { good: 'oil', streak: 2, turns: 3, ok: false },
  cost: {
    cost: { planks: 20, stone: 20, drachmas: 30 },
    missing: { stone: 5 },
    ok: false,
  },
  canAdvance: false,
};

describe('advanceRows', () => {
  it('lists residents, supply and cost', () => {
    const rows = advanceRows(check);
    expect(rows.map((r) => [r.kind, r.ok, r.text])).toEqual([
      ['residents', false, 'Residents 12 / 20'],
      ['supply', false, 'Oil supplied 2 of 3 turns in a row'],
      ['cost', false, 'Cost: 20 Stone, 20 Planks, 30 Drachmas'],
    ]);
    expect(rows[2]?.parts?.map((p) => [p.good, p.missing])).toEqual([
      ['stone', true],
      ['planks', false],
      ['drachmas', false],
    ]);
  });
  it('is empty at the highest level', () => {
    expect(advanceRows({ ...check, to: null })).toEqual([]);
  });
});

describe('advanceBlockReason', () => {
  it('names the first unmet requirement', () => {
    expect(advanceBlockReason(check)).toBe('Not enough residents yet.');
    const r1 = { ...check, residents: { have: 20, need: 20, ok: true } };
    expect(advanceBlockReason(r1)).toBe('Supply the city with oil for 3 turns in a row first.');
    const r2 = { ...r1, supply: { ...r1.supply, ok: true } };
    expect(advanceBlockReason(r2)).toBe('Not enough goods: 5 Stone missing.');
  });
  it('is null when ready or at the top', () => {
    expect(advanceBlockReason({ ...check, canAdvance: true })).toBeNull();
    expect(advanceBlockReason({ ...check, to: null })).toBeNull();
  });
});

describe('tradeRows', () => {
  it('shows only goods you have, never drachmas', () => {
    const stock = { ...emptyStock(), wood: 5, grain: 1, drachmas: 10 };
    const rows = tradeRows(stock, true, false);
    expect(rows.map((r) => r.good)).toEqual(['wood', 'grain']);
  });
  it('shows all goods on request, without drachmas', () => {
    const rows = tradeRows(emptyStock(), true, true);
    expect(rows).toHaveLength(12);
    expect(rows.some((r) => r.good === 'drachmas')).toBe(false);
  });
  it('enables selling with the sell amount and buying with enough drachmas', () => {
    const stock = { ...emptyStock(), wood: 2, grain: 1, drachmas: 3 };
    const [wood, grain] = tradeRows(stock, true, false);
    expect(wood).toMatchObject({ canSell: true, canBuy: true });
    expect(grain).toMatchObject({ canSell: false, canBuy: true });
    const poor = tradeRows({ ...stock, drachmas: 2 }, true, false);
    expect(poor[0]?.canBuy).toBe(false);
  });
  it('disables everything when trading is not enabled', () => {
    const stock = { ...emptyStock(), wood: 5, drachmas: 10 };
    expect(tradeRows(stock, false, false)[0]).toMatchObject({ canSell: false, canBuy: false });
  });
});
