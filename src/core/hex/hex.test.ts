import { describe, expect, it } from 'vitest';
import {
  axialToOffset,
  distance,
  hex,
  hexRound,
  line,
  neighbors,
  offsetToAxial,
  range,
  ring,
  hexKey,
} from './coords';
import { hexCorners, hexToPixel, pixelToHex } from './layout';

const O = hex(0, 0);

describe('coords', () => {
  it('neighbors: 6 Stück mit distance 1', () => {
    const n = neighbors(hex(2, -1));
    expect(n).toHaveLength(6);
    for (const h of n) expect(distance(hex(2, -1), h)).toBe(1);
  });

  it('distance: bekannte Werte und Symmetrie', () => {
    expect(distance(O, hex(3, -1))).toBe(3);
    expect(distance(O, hex(2, 2))).toBe(4);
    expect(distance(hex(1, 4), hex(-2, 3))).toBe(distance(hex(-2, 3), hex(1, 4)));
  });

  it('ring: Größe und exakte Distanz', () => {
    [1, 6, 12, 18].forEach((size, radius) => {
      const r = ring(O, radius);
      expect(r).toHaveLength(size);
      expect(new Set(r.map(hexKey)).size).toBe(size);
      for (const h of r) expect(distance(O, h)).toBe(radius);
    });
  });

  it('range: Größe und keine Duplikate', () => {
    [1, 7, 19, 37].forEach((size, radius) => {
      const r = range(hex(1, 1), radius);
      expect(r).toHaveLength(size);
      expect(new Set(r.map(hexKey)).size).toBe(size);
    });
  });

  it('line: Länge, Enden, Nachbarschaft', () => {
    const pairs: [ReturnType<typeof hex>, ReturnType<typeof hex>][] = [
      [O, hex(5, 0)],
      [O, hex(0, 5)],
      [O, hex(5, -5)],
      [hex(-3, 2), hex(4, -6)],
      [hex(2, 2), hex(2, 2)],
      [hex(0, 0), hex(3, 3)],
    ];
    for (const [a, b] of pairs) {
      const l = line(a, b);
      expect(l).toHaveLength(distance(a, b) + 1);
      expect(l[0]).toEqual(a);
      expect(l[l.length - 1]).toEqual(b);
      for (let i = 1; i < l.length; i++) expect(distance(l[i - 1], l[i])).toBe(1);
    }
  });

  it('Offset odd-r: Rundreise und Formel', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const a = offsetToAxial({ col, row });
        expect(a.q).toBe(col - (row - (row & 1)) / 2);
        expect(a.r).toBe(row);
        expect(axialToOffset(a)).toEqual({ col, row });
      }
    }
    expect(offsetToAxial({ col: 0, row: 1 })).toEqual({ q: 0, r: 1 });
    expect(offsetToAxial({ col: 0, row: 2 })).toEqual({ q: -1, r: 2 });
  });

  it('kein -0', () => {
    const r = hexRound(-0.1, 0.1);
    expect(Object.is(r.q, -0)).toBe(false);
    expect(Object.is(r.r, -0)).toBe(false);
    const h = hex(-0, -0);
    expect(Object.is(h.q, -0) || Object.is(h.r, -0)).toBe(false);
    for (const x of ring(O, 2)) {
      expect(Object.is(x.q, -0) || Object.is(x.r, -0)).toBe(false);
    }
    const o = axialToOffset(hex(0, 0));
    expect(Object.is(o.col, -0) || Object.is(o.row, -0)).toBe(false);
  });
});

describe('layout', () => {
  it('Pixel-Rundreise', () => {
    for (const h of range(O, 5)) {
      expect(pixelToHex(hexToPixel(h, 32), 32)).toEqual(h);
    }
  });

  it('Punkt neben dem Mittelpunkt bleibt im Feld', () => {
    const h = hex(2, -3);
    const p = hexToPixel(h, 32);
    expect(pixelToHex({ x: p.x + 5, y: p.y - 4 }, 32)).toEqual(h);
  });

  it('hexCorners: 6 Ecken im Abstand size', () => {
    const c = { x: 10, y: -4 };
    const corners = hexCorners(c, 32);
    expect(corners).toHaveLength(6);
    for (const p of corners) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(32, 9);
  });
});
