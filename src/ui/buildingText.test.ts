import { describe, expect, it } from 'vitest';
import { emptyStock } from '../core/rules/goods';
import {
  canPause,
  costParts,
  costPartsFromMissing,
  levelReached,
  perTurnText,
  statusTone,
  workersText,
} from './buildingText';

describe('perTurnText', () => {
  it('describes producers', () => {
    expect(perTurnText('woodcutter')).toBe('+2 Wood');
    expect(perTurnText('farm')).toBe('+4 Grain');
  });
  it('describes processing', () => {
    expect(perTurnText('sawmill')).toBe('2 Wood → 2 Planks');
    expect(perTurnText('smelter')).toBe('1 Wood, 2 Ore → 1 Bronze');
  });
  it('describes housing and storage', () => {
    expect(perTurnText('house')).toBe('Houses 6 residents');
    expect(perTurnText('storehouse')).toBe('Connection point for roads');
    expect(perTurnText('cityCenter')).toBe(
      '+2 Grain. Houses 4 residents. Connection point for roads',
    );
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
    expect(statusTone({ kind: 'working' })).toBe('ok');
    expect(statusTone({ kind: 'paused' })).toBe('neutral');
    expect(statusTone({ kind: 'noProduction' })).toBe('neutral');
    expect(statusTone({ kind: 'notConnected' })).toBe('problem');
    expect(statusTone({ kind: 'missingInput', missing: { wood: 1 } })).toBe('problem');
  });
});

describe('costPartsFromMissing', () => {
  it('marks the goods listed as missing', () => {
    expect(costPartsFromMissing({ planks: 20, stone: 20 }, { stone: 3 })).toEqual([
      { good: 'stone', amount: 20, missing: true },
      { good: 'planks', amount: 20, missing: false },
    ]);
  });
});

describe('levelReached', () => {
  it('compares city levels', () => {
    expect(levelReached('settlement', 'settlement')).toBe(true);
    expect(levelReached('settlement', 'polis')).toBe(false);
    expect(levelReached('metropolis', 'polis')).toBe(true);
  });
});

describe('canPause', () => {
  it('is true only for buildings with workers', () => {
    expect(canPause('woodcutter')).toBe(true);
    expect(canPause('marketplace')).toBe(true);
    expect(canPause('house')).toBe(false);
    expect(canPause('temple')).toBe(false);
  });

  it('follows the workers a building needs right now (wonder)', () => {
    expect(canPause('wonder', 4)).toBe(true);
    expect(canPause('wonder', 0)).toBe(false);
  });
});

describe('statusTone for the world wonder', () => {
  it('is ok while building and when complete', () => {
    expect(statusTone({ kind: 'wonderBuilding', progress: 2, total: 5 })).toBe('ok');
    expect(statusTone({ kind: 'wonderComplete' })).toBe('ok');
  });
});
