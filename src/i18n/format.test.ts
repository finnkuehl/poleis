import { describe, expect, it } from 'vitest';
import {
  fill,
  formatConversion,
  formatError,
  formatGoods,
  formatMissing,
  formatSignedGoods,
  formatStatus,
  formatTerrains,
  formatTurnOf,
  formatRoadTiles,
  formatWorkerCount,
} from './format';

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
  it('formats signed goods, conversions and missing goods', () => {
    expect(formatSignedGoods({ stone: 1, wood: 2 })).toBe('+2 Wood, +1 Stone');
    expect(formatConversion({ wood: 2 }, { planks: 2 })).toBe('2 Wood → 2 Planks');
    expect(formatMissing({ wood: 2 })).toBe('Missing: 2 Wood');
  });
  it('formats worker counts and turns', () => {
    expect(formatWorkerCount(1)).toBe('1 worker');
    expect(formatWorkerCount(2)).toBe('2 workers');
    expect(formatTurnOf(3, 120)).toBe('Turn 3 / 120');
  });
  it('formats road tile counts with singular and plural', () => {
    expect(formatRoadTiles(1)).toBe('1 new road tile');
    expect(formatRoadTiles(2)).toBe('2 new road tiles');
  });
  it('fills placeholders', () => {
    expect(fill('Build {building} here?', { building: 'House' })).toBe('Build House here?');
  });
});
