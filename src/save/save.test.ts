import { describe, expect, it } from 'vitest';
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
