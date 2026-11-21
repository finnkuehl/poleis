import { describe, expect, it } from 'vitest';
import { addBuilding, addCity, at, makeTestState } from '../core/testing';
import { buildOptionsFor } from './buildOptions';

const rich = { wood: 50, stone: 50, planks: 50, grain: 50 };

function ids(options: ReturnType<typeof buildOptionsFor>, state?: string): string[] {
  return options.filter((o) => !state || o.state === state).map((o) => o.id);
}

describe('buildOptionsFor', () => {
  it('lists ok buildings on a plains tile, in data order, without the city center', () => {
    const s = makeTestState(['ppp', 'ppp'], { goods: rich });
    addCity(s, at(0, 0));
    const options = buildOptionsFor(s, 0, at(2, 1));
    const ok = ids(options, 'ok');
    expect(ok).toContain('house');
    expect(ok).toContain('borderTower');
    expect(ok).not.toContain('cityCenter');
    expect(ok.indexOf('storehouse')).toBeLessThan(ok.indexOf('borderTower'));
    expect(ok.indexOf('borderTower')).toBeLessThan(ok.indexOf('house'));
  });

  it('marks unaffordable buildings with the missing goods', () => {
    const s = makeTestState(['ppp'], { goods: { wood: 1 } });
    addCity(s, at(0, 0));
    const house = buildOptionsFor(s, 0, at(2, 0)).find((o) => o.id === 'house');
    expect(house?.state).toBe('unaffordable');
    expect(house?.missing).toBeDefined();
    expect(Object.keys(house?.missing ?? {}).length).toBeGreaterThan(0);
  });

  it('marks buildings of a higher city level as locked with that level', () => {
    const s = makeTestState(['ppp'], { goods: rich });
    addCity(s, at(0, 0));
    const options = buildOptionsFor(s, 0, at(2, 0));
    const market = options.find((o) => o.id === 'marketplace');
    expect(market).toMatchObject({ state: 'locked', level: 'polis' });
  });

  it('leaves out buildings that do not fit the terrain, e.g. only woodcutter on a lone forest', () => {
    const s = makeTestState(['ppp', 'pfp', 'ppp'], { goods: rich });
    addCity(s, at(0, 0));
    expect(ids(buildOptionsFor(s, 0, at(1, 1)))).toEqual(['woodcutter']);
  });

  it('orders ok, then unaffordable, then locked', () => {
    const s = makeTestState(['ppp'], { goods: { wood: 4, stone: 2 } });
    addCity(s, at(0, 0));
    const states = buildOptionsFor(s, 0, at(2, 0)).map((o) => o.state);
    const sorted = [...states].sort(
      (a, b) =>
        ['ok', 'unaffordable', 'locked'].indexOf(a) - ['ok', 'unaffordable', 'locked'].indexOf(b),
    );
    expect(states).toEqual(sorted);
    expect(states).toContain('ok');
    expect(states).toContain('unaffordable');
    expect(states).toContain('locked');
  });

  it('returns nothing for occupied tiles and foreign land', () => {
    const s = makeTestState(['ppp'], { goods: rich, ownAll: false });
    expect(buildOptionsFor(s, 0, at(1, 0))).toEqual([]);
    const t = makeTestState(['ppp'], { goods: rich });
    addBuilding(t, 'house', at(1, 0));
    expect(buildOptionsFor(t, 0, at(1, 0))).toEqual([]);
  });

  it('gives the border tower its number of new tiles', () => {
    const s = makeTestState(['ppppppp'], { goods: rich, ownAll: false });
    s.territory[0] = 0;
    s.territory[1] = 0;
    s.territory[2] = 0;
    const tower = buildOptionsFor(s, 0, at(2, 0)).find((o) => o.id === 'borderTower');
    expect(tower?.state).toBe('ok');
    expect(tower?.gain).toBeGreaterThan(0);
    const house = buildOptionsFor(s, 0, at(2, 0)).find((o) => o.id === 'house');
    expect(house?.gain).toBeUndefined();
  });
});
