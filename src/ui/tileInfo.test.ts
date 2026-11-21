import { describe, expect, it } from 'vitest';
import { TERRAIN_IDS } from '../data/terrain';
import { tileInfoRows } from './tileInfo';

const values = (id: Parameters<typeof tileInfoRows>[0]): string[] =>
  tileInfoRows(id).map((r) => r.value);

describe('tileInfoRows', () => {
  it('liefert für jedes Terrain drei Zeilen', () => {
    for (const id of TERRAIN_IDS) expect(tileInfoRows(id)).toHaveLength(3);
  });
  it('Ebene', () => expect(values('plains')).toEqual(['1', '×1', 'ja']));
  it('Wald', () => expect(values('forest')).toEqual(['2', '×1,5', 'nein']));
  it('Hügel', () => expect(values('hills')).toEqual(['2', '×1,5', 'ja']));
  it('Ozean und Küste', () => {
    expect(values('ocean')).toEqual(['nur Schiffe', '–', 'nein']);
    expect(values('coast')).toEqual(['nur Schiffe', '–', 'nein']);
  });
  it('Berg', () => expect(values('mountains')).toEqual(['unpassierbar', '–', 'nein']));
});
