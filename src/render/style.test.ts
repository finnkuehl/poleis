import { describe, expect, it } from 'vitest';
import { badgeKind, cityRingStyle } from './style';

describe('cityRingStyle', () => {
  it('settlement has no ring, polis verdigris, metropolis gold with inner ring', () => {
    expect(cityRingStyle('settlement').outerColor).toBeNull();
    expect(cityRingStyle('polis')).toMatchObject({ outerColor: 0x3e7d6b, innerColor: null });
    expect(cityRingStyle('metropolis')).toMatchObject({
      outerColor: 0xc9a227,
      innerColor: 0xc9a227,
    });
    expect(cityRingStyle('metropolis').outerWidth).toBeGreaterThan(
      cityRingStyle('polis').outerWidth,
    );
  });
});

describe('badgeKind', () => {
  it('maps statuses to badges', () => {
    expect(badgeKind({ kind: 'paused' })).toBe('paused');
    expect(badgeKind({ kind: 'working' })).toBeNull();
    expect(badgeKind({ kind: 'notConnected' })).toBe('problem');
    expect(badgeKind({ kind: 'missingWorkers' } as never)).toBe('problem');
    expect(badgeKind({ kind: 'wonderBuilding', progress: 1, total: 5 })).toBeNull();
    expect(badgeKind({ kind: 'wonderComplete' })).toBeNull();
    expect(badgeKind(undefined)).toBeNull();
  });
});
