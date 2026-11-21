import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { savedAtText, saveSummaryText, slotName } from './saveText';

const summary = { turn: 12, playerName: 'Ilios', aiCount: 2, mapSize: 'normal', seedText: '7' };

describe('saveText', () => {
  it('summarizes a save with the name or the default name', () => {
    expect(saveSummaryText(summary)).toBe('Turn 12, Ilios');
    expect(saveSummaryText({ ...summary, playerName: '' })).toBe(
      `Turn 12, ${en.defaultPlayerName}`,
    );
  });

  it('names slots and formats the date', () => {
    expect(slotName('auto')).toBe(en.gameMenu.autosave);
    expect(slotName(2)).toBe('Slot 2');
    expect(savedAtText('2026-11-21T14:05:00Z')).toMatch(/^Saved .*2026/);
    expect(savedAtText('not a date')).toBe('');
  });
});
