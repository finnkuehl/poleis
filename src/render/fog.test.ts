import { describe, expect, it } from 'vitest';
import { fogSignature, fogState, hpBarColor, unitTokenOffset } from './fog';
import { theme } from './theme';

describe('fogState', () => {
  const explored = [false, true, true];
  const visible = [false, false, true];
  it('classifies tiles', () => {
    expect(fogState(explored, visible, 0)).toBe('hidden');
    expect(fogState(explored, visible, 1)).toBe('dim');
    expect(fogState(explored, visible, 2)).toBe('clear');
  });
  it('signature changes with visibility', () => {
    expect(fogSignature(explored, visible)).toBe('hdc');
    expect(fogSignature(explored, [true, false, true])).toBe('cdc');
  });
});

describe('hpBarColor', () => {
  it('goes green -> ochre -> red', () => {
    expect(hpBarColor(1)).toBe(theme.hpBarGoodColor);
    expect(hpBarColor(0.5)).toBe(theme.hpBarMidColor);
    expect(hpBarColor(0.1)).toBe(theme.hpBarLowColor);
  });
});

describe('unitTokenOffset', () => {
  it('moves up only on buildings', () => {
    expect(unitTokenOffset(false, 32)).toBe(0);
    expect(unitTokenOffset(true, 32)).toBeLessThan(0);
  });
});
