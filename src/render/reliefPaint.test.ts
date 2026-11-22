import { describe, expect, it } from 'vitest';
import { cutStanding } from './reliefPaint';
import { theme } from './theme';

const size = 32;
const C = theme.terrainPaint.cuts;

describe('cutStanding', () => {
  it('a mine at the mountain foot: its rock face and a few stones, no scree fan', () => {
    for (const terrain of ['mountains', 'hills'] as const) {
      const cut = cutStanding({ x: 0, y: 0 }, 'mineCut', terrain, size);
      expect(cut.behindBuilding).toBe(true);
      // No scree floor or shade bands in front of it
      expect(cut.shapes.some((s) => s.color === C.screeColor)).toBe(false);
      expect(cut.shapes.some((s) => s.color === C.screeShade)).toBe(false);
      // The face (rock or limestone) with its texture
      const face = terrain === 'mountains' ? C.rockFace : C.hillFace;
      expect(cut.shapes.some((s) => s.color === face && s.texture === 'face')).toBe(true);
      // Stones at the lip of the ledge: their shadows
      const stones = cut.shapes.filter((s) => s.color === theme.terrainPaint.shadowColor);
      expect(stones.length).toBe(C.mineLipStones);
    }
    // Only the hill mine has a hill rising behind it
    expect(
      cutStanding({ x: 0, y: 0 }, 'mineCut', 'hills', size).shapes.some(
        (s) => s.texture === 'mound',
      ),
    ).toBe(true);
    expect(
      cutStanding({ x: 0, y: 0 }, 'mineCut', 'mountains', size).shapes.some(
        (s) => s.texture === 'mound',
      ),
    ).toBe(false);
  });

  it('a quarry in a mountain gets the niche too; on hills both keep their hill behind', () => {
    const quarry = cutStanding({ x: 0, y: 0 }, 'quarryCut', 'mountains', size);
    expect(quarry.shapes.some((s) => s.color === C.screeColor)).toBe(true);
    for (const kind of ['mineCut', 'quarryCut'] as const) {
      const hill = cutStanding({ x: 0, y: 0 }, kind, 'hills', size);
      expect(hill.shapes.some((s) => s.color === C.screeColor)).toBe(false);
      expect(hill.shapes.some((s) => s.texture === 'mound')).toBe(true);
    }
  });

  it('is deterministic', () => {
    const a = cutStanding({ x: 100, y: 48 }, 'mineCut', 'mountains', size);
    const b = cutStanding({ x: 100, y: 48 }, 'mineCut', 'mountains', size);
    expect(a).toEqual(b);
  });
});
