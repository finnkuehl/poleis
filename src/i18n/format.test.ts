import { describe, expect, it } from 'vitest';
import { formatError, formatGoods, formatStatus, formatTerrains } from './format';

describe('i18n/format', () => {
  it('formats goods in display order and skips zeros', () => {
    expect(formatGoods({ stone: 1, wood: 2, ore: 0 })).toBe('2 Wood, 1 Stone');
    expect(formatGoods({})).toBe('');
  });
  it('formats terrains', () => {
    expect(formatTerrains(['forest'])).toBe('forest');
    expect(formatTerrains(['plains', 'hills'])).toBe('plains or hills');
  });
  it('formats errors', () => {
    expect(formatError({ code: 'notAffordable', missing: { wood: 2, stone: 1 } })).toBe(
      'Not enough goods: 2 Wood, 1 Stone missing.',
    );
    expect(formatError({ code: 'needsNeighbor', terrains: ['forest'] })).toBe(
      'Must be built next to forest.',
    );
    expect(formatError({ code: 'cannotDemolishCityCenter' })).toBe(
      'The city center cannot be demolished.',
    );
  });
  it('formats statuses', () => {
    expect(formatStatus({ kind: 'producing' })).toBe('Producing');
    expect(formatStatus({ kind: 'missingWorkers', assigned: 1, needed: 2 })).toBe(
      'Missing workers (1/2)',
    );
    expect(formatStatus({ kind: 'missingInput', missing: { wood: 2 } })).toBe(
      'Missing input: 2 Wood',
    );
  });
});
