import { describe, expect, it } from 'vitest';
import { emptyStock } from '../core/rules/goods';
import { costParts, perTurnText, statusTone, workersText } from './buildingText';

describe('perTurnText', () => {
  it('describes producers', () => {
    expect(perTurnText('woodcutter')).toBe('+2 Wood');
    expect(perTurnText('farm')).toBe('+3 Grain');
  });
  it('describes processing', () => {
    expect(perTurnText('sawmill')).toBe('2 Wood → 2 Planks');
    expect(perTurnText('smelter')).toBe('1 Wood, 2 Ore → 1 Bronze');
  });
  it('describes housing and storage', () => {
    expect(perTurnText('house')).toBe('Houses 4 residents');
    expect(perTurnText('storehouse')).toBe('Connection point for roads');
    expect(perTurnText('cityCenter')).toBe('Houses 4 residents. Connection point for roads');
  });
});

describe('workersText', () => {
  it('uses singular and plural', () => {
    expect(workersText(0)).toBe('No workers needed');
    expect(workersText(1)).toBe('1 worker');
    expect(workersText(2)).toBe('2 workers');
  });
});

describe('costParts', () => {
  it('marks missing parts in display order', () => {
    const stock = { ...emptyStock(), wood: 5, stone: 1 };
    expect(costParts({ stone: 2, wood: 4 }, stock)).toEqual([
      { good: 'wood', amount: 4, missing: false },
      { good: 'stone', amount: 2, missing: true },
    ]);
  });
  it('is empty for no cost', () => {
    expect(costParts({}, emptyStock())).toEqual([]);
  });
});

describe('statusTone', () => {
  it('maps statuses', () => {
    expect(statusTone({ kind: 'producing' })).toBe('ok');
    expect(statusTone({ kind: 'noProduction' })).toBe('neutral');
    expect(statusTone({ kind: 'notConnected' })).toBe('problem');
    expect(statusTone({ kind: 'missingInput', missing: { wood: 1 } })).toBe('problem');
  });
});
