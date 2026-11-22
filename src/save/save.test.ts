import { describe, expect, it } from 'vitest';
import { endTurn } from '../core/turn';
import { createGameState } from '../core/state';
import {
  browserStorage,
  deleteSave,
  hasAutosave,
  listSaves,
  loadGame,
  migrateEnvelope,
  saveGame,
  SAVE_VERSION,
  type KeyValueStorage,
} from './index';

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const state = createGameState('save-test', { settings: { aiCount: 2 } });
const t1 = new Date('2026-01-01T10:00:00Z');

describe('save/load', () => {
  it('round trips a real game state', () => {
    const s = fakeStorage();
    expect(saveGame(s, 'auto', state, t1)).toEqual({ ok: true });
    const res = loadGame(s, 'auto');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state).toEqual(state);
  });

  it('keeps autosave and slots independent, and lists them in order', () => {
    const s = fakeStorage();
    const later = { ...state, turn: 7 };
    saveGame(s, 2, later, t1);
    saveGame(s, 'auto', state, t1);
    expect(hasAutosave(s)).toBe(true);
    const list = listSaves(s);
    expect(list.map((e) => e.slot)).toEqual(['auto', 2]);
    expect(list[0].summary).toMatchObject({ turn: 1, aiCount: 2, seedText: 'save-test' });
    expect(list[1].summary.turn).toBe(7);
    expect(list[1].savedAt).toBe(t1.toISOString());
    deleteSave(s, 'auto');
    expect(hasAutosave(s)).toBe(false);
    expect(loadGame(s, 2).ok).toBe(true);
  });

  it('reports missing, corrupt and too new saves', () => {
    const s = fakeStorage();
    expect(loadGame(s, 1)).toEqual({ ok: false, error: 'missing' });
    s.setItem('poleis.save.slot1', '{not json');
    expect(loadGame(s, 1)).toEqual({ ok: false, error: 'corrupt' });
    s.setItem('poleis.save.slot1', JSON.stringify({ format: 'other', version: 1 }));
    expect(loadGame(s, 1)).toEqual({ ok: false, error: 'corrupt' });
    s.setItem(
      'poleis.save.slot1',
      JSON.stringify({ format: 'poleis-save', version: SAVE_VERSION, state: { players: 1 } }),
    );
    expect(loadGame(s, 1)).toEqual({ ok: false, error: 'corrupt' });
    s.setItem(
      'poleis.save.slot1',
      JSON.stringify({ format: 'poleis-save', version: SAVE_VERSION + 1 }),
    );
    expect(loadGame(s, 1)).toEqual({ ok: false, error: 'tooNew' });
    expect(listSaves(s)).toEqual([]);
  });

  it('maps storage errors to error codes', () => {
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        const e = new Error('full');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem: () => {},
    };
    expect(saveGame(full, 1, state)).toEqual({ ok: false, error: 'storageFull' });
    const broken: KeyValueStorage = {
      ...full,
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(saveGame(broken, 1, state)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('runs the migration chain step by step', () => {
    const s = fakeStorage();
    saveGame(s, 1, state, t1);
    const env = JSON.parse(s.data.get('poleis.save.slot1') as string);
    env.version = 0;
    const res = migrateEnvelope(
      env,
      {
        0: (e) => ({ ...e, summary: { ...(e.summary as object), turn: 99 } }),
      },
      1,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.envelope.version).toBe(1);
      expect(res.envelope.summary.turn).toBe(99);
    }
    // A missing step is a corrupt save.
    expect(migrateEnvelope(env, {}, 1)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('does not throw without localStorage', () => {
    const b = browserStorage();
    expect(() => listSaves(b)).not.toThrow();
    expect(() => deleteSave(b, 1)).not.toThrow();
    expect(loadGame(b, 'auto').ok).toBe(false);
    expect(() => saveGame(b, 1, state)).not.toThrow();
  });
});

describe('migration 1 -> 2', () => {
  it('adds lowPriorityGoods to players that lack it', () => {
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    for (const p of old.players as Record<string, unknown>[]) delete p.lowPriorityGoods;
    const res = migrateEnvelope({
      format: 'poleis-save',
      version: 1,
      savedAt: t1.toISOString(),
      summary: { turn: 1 },
      state: old,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.envelope.version).toBe(SAVE_VERSION);
      expect(res.envelope.state.players.every((p) => p.lowPriorityGoods.length === 0)).toBe(true);
    }
  });
});

describe('migration 2 -> 3', () => {
  it('a version 2 save loads: units get aboard = null', () => {
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.units = [
      { id: 90, type: 'scout', owner: 0, hex: { q: 1, r: 1 }, hp: 5, movesLeft: 3 },
      { id: 91, type: 'settler', owner: 0, hex: { q: 2, r: 1 }, hp: 5, movesLeft: 1 },
    ];
    const s = fakeStorage();
    s.setItem(
      'poleis.save.auto',
      JSON.stringify({
        format: 'poleis-save',
        version: 2,
        savedAt: t1.toISOString(),
        summary: { turn: 1 },
        state: old,
      }),
    );
    const res = loadGame(s, 'auto');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(SAVE_VERSION).toBe(4);
      expect(res.state.units).toHaveLength(2);
      expect(res.state.units.every((u) => u.aboard === null)).toBe(true);
    }
  });
});

describe('migration 3 -> 4', () => {
  it('turns bread into grain and bakeries into farms, and the game still runs', () => {
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    const players = old.players as Record<string, unknown>[];
    const goods = players[0].goods as Record<string, number>;
    goods.bread = 7;
    goods.grain = 3;
    players[0].lowPriorityGoods = ['bread', 'wood'];
    const buildings = old.buildings as Record<string, unknown>[];
    buildings.push({ id: 900, type: 'bakery', owner: 0, hex: { q: 2, r: 2 }, paused: true });
    old.lastReport = { delta: { bread: 2 } };
    (old.cities as Record<string, unknown>[]).forEach((c) => {
      c.supplyStreak = 2;
      delete c.nameIndex;
    });
    const s = fakeStorage();
    s.setItem(
      'poleis.save.auto',
      JSON.stringify({
        format: 'poleis-save',
        version: 3,
        savedAt: t1.toISOString(),
        summary: { turn: 1 },
        state: old,
      }),
    );
    const res = loadGame(s, 'auto');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.state.players[0];
    expect(p.goods.grain).toBe(10);
    expect('bread' in p.goods).toBe(false);
    expect(p.lowPriorityGoods).toEqual(['wood']);
    expect(res.state.buildings.find((b) => b.id === 900)).toMatchObject({
      type: 'farm',
      owner: 0,
      hex: { q: 2, r: 2 },
      paused: true,
    });
    expect(res.state.lastReport).toBeNull();
    expect(res.state.cities.every((c) => !('supplyStreak' in c))).toBe(true);
    // Cities get their list position as name index.
    expect(res.state.cities.map((c) => c.nameIndex)).toEqual(res.state.cities.map((_, i) => i));
    expect(() => endTurn(res.state)).not.toThrow();
  });
});
