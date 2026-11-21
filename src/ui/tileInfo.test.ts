import { describe, expect, it } from 'vitest';
import { TERRAIN_IDS } from '../data/terrain';
import { tileInfoRows } from './tileInfo';

const values = (id: Parameters<typeof tileInfoRows>[0]): string[] =>
  tileInfoRows(id).map((r) => r.value);

describe('tileInfoRows', () => {
  it('returns three rows for every terrain', () => {
    for (const id of TERRAIN_IDS) expect(tileInfoRows(id)).toHaveLength(3);
  });
  it('plains', () => expect(values('plains')).toEqual(['1', '×1', 'yes']));
  it('forest', () => expect(values('forest')).toEqual(['2', '×1.5', 'no']));
  it('hills', () => expect(values('hills')).toEqual(['2', '×1.5', 'yes']));
  it('ocean and coast', () => {
    expect(values('ocean')).toEqual(['ships only', '–', 'no']);
    expect(values('coast')).toEqual(['ships only', '–', 'no']);
  });
  it('mountains', () => expect(values('mountains')).toEqual(['impassable', '–', 'no']));
});
