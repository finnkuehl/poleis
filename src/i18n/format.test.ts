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
  formatAdvanceTo,
  formatAdvanced,
  formatBought,
  formatDrachmas,
  formatResidents,
  formatSold,
  formatTurns,
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
  it('formats plural forms', () => {
    expect(formatResidents(1)).toBe('1 resident');
    expect(formatResidents(0)).toBe('0 residents');
    expect(formatResidents(6)).toBe('6 residents');
    expect(formatDrachmas(1)).toBe('1 drachma');
    expect(formatDrachmas(3)).toBe('3 drachmas');
    expect(formatTurns(1)).toBe('1 turn');
    expect(formatTurns(3)).toBe('3 turns');
  });
  it('formats the advance, trade and level texts', () => {
    expect(formatAdvanceTo('polis')).toBe('Advance to Polis');
    expect(formatAdvanced('polis')).toBe('Your city is now a Polis.');
    expect(formatSold('wood', 2, 1)).toBe('Sold 2 Wood for 1 drachma.');
    expect(formatBought('wood', 1, 3)).toBe('Bought 1 Wood for 3 drachmas.');
  });
  it('fills placeholders', () => {
    expect(fill('Build {building} here?', { building: 'House' })).toBe('Build House here?');
  });
});
