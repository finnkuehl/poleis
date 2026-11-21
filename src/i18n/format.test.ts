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
  formatMoves,
  formatUnitsReady,
  formatUnitsLost,
  formatCaptured,
  formatAttacked,
  formatNet,
  formatRunsOut,
  formatMade,
  formatUsed,
  formatWorkerLine,
} from './format';
import type { GoodFlow } from '../core/rules/economy';

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
  it('formats unit texts', () => {
    expect(formatMoves(2)).toBe('2');
    expect(formatMoves(0.5)).toBe('0.5');
    expect(formatUnitsReady(1)).toBe('1 unit is ready');
    expect(formatUnitsReady(3)).toBe('3 units are ready');
    expect(formatUnitsLost(1)).toBe('1 unit was lost to hunger');
    expect(formatUnitsLost(2)).toBe('2 units were lost to hunger');
    expect(formatCaptured(1)).toBe('You captured a city!');
    expect(formatCaptured(2)).toBe('You captured 2 cities!');
    const base = { damage: 5, counter: 0, defenderDies: false, attackerDies: false };
    expect(formatAttacked('Spearman', base)).toBe('Spearman attacked: 5 damage.');
    expect(formatAttacked('Spearman', { ...base, damage: 10, defenderDies: true })).toBe(
      'Spearman defeated the enemy.',
    );
    expect(formatAttacked('Spearman', { ...base, counter: 3 })).toBe(
      'Spearman attacked: 5 damage, took 3.',
    );
    expect(formatAttacked('Scout', { ...base, damage: 1, counter: 4, attackerDies: true })).toBe(
      'Scout attacked: 1 damage. Your scout was lost.',
    );
  });
  it('fills placeholders', () => {
    expect(fill('Build {building} here?', { building: 'House' })).toBe('Build House here?');
  });
  it('formats economy flows', () => {
    expect(formatNet(4)).toBe('+4');
    expect(formatNet(-2)).toBe('−2');
    expect(formatNet(0)).toBe('0');
    expect(formatRunsOut(0)).toBe('Runs out this turn');
    expect(formatRunsOut(1)).toBe('Runs out in 1 turn');
    expect(formatRunsOut(3)).toBe('Runs out in 3 turns');
    const flow: GoodFlow = {
      good: 'wood',
      stock: 5,
      produced: [{ source: 'woodcutter', amount: 4, count: 2 }],
      consumed: [
        { source: 'building', detail: 'sawmill', amount: 2, count: 1 },
        { source: 'residents', amount: 3, count: 1 },
        { source: 'units', amount: 1, count: 1 },
      ],
      net: -2,
      turnsLeft: 2,
      lowPriority: false,
      canPrioritize: true,
    };
    expect(formatMade(flow)).toBe('Made: Woodcutter ×2 +4');
    expect(formatUsed(flow)).toBe('Used: Sawmill −2, residents −3, units −1');
    expect(formatMade({ ...flow, produced: [] })).toBeNull();
    expect(formatWorkerLine({ residents: 8, housing: 12, working: 6, free: 2, missing: 1 })).toBe(
      'Residents 8 / 12 · Working 6 · Free 2 · Missing 1',
    );
  });
});
