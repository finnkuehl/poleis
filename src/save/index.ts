// Saving/loading (localStorage) with a save version number and migration.
// Everything takes the storage as a parameter, so tests can use an in-memory fake.

import type { GameState } from '../core/state';

/** Current save format version. Bump it and add a step to MIGRATIONS when the state changes. */
export const SAVE_VERSION = 4;

/** Number of manual save slots (technical constant, not a balancing value). */
export const SAVE_SLOT_COUNT = 3;

const SAVE_FORMAT = 'poleis-save';
const KEY_PREFIX = 'poleis.';

export type SaveSlot = 'auto' | 1 | 2 | 3;

/** All slots, autosave first. */
export const ALL_SLOTS: readonly SaveSlot[] = ['auto', 1, 2, 3];

/** The minimal storage API we need (matches window.localStorage). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Short info shown in the save list. */
export interface SaveSummary {
  turn: number;
  playerName: string;
  aiCount: number;
  mapSize: string;
  seedText: string;
}

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  summary: SaveSummary;
  state: GameState;
}

export type SaveResult = { ok: true } | { ok: false; error: 'storageFull' | 'unavailable' };
export type LoadResult =
  { ok: true; state: GameState } | { ok: false; error: 'missing' | 'corrupt' | 'tooNew' };

export interface SaveListEntry {
  slot: SaveSlot;
  summary: SaveSummary;
  savedAt: string;
}

/** Wraps window.localStorage; returns an inert storage if it is unavailable (e.g. private mode). */
export function browserStorage(): KeyValueStorage {
  try {
    const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (ls) return ls;
  } catch {
    // Accessing localStorage can throw (blocked cookies/site data).
  }
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('localStorage unavailable');
    },
    removeItem: () => {},
  };
}

function slotKey(slot: SaveSlot): string {
  return `${KEY_PREFIX}save.${slot === 'auto' ? 'auto' : `slot${slot}`}`;
}

/** Version n -> n+1 upgrade steps, keyed by the version they upgrade FROM. */
export const MIGRATIONS: Record<number, (env: Record<string, unknown>) => Record<string, unknown>> =
  {
    // 1 -> 2: players got `lowPriorityGoods` (worker priority per good).
    1: (env) => {
      const state = env.state;
      if (isRecord(state) && Array.isArray(state.players)) {
        for (const p of state.players) {
          if (isRecord(p) && !Array.isArray(p.lowPriorityGoods)) p.lowPriorityGoods = [];
        }
      }
      return env;
    },
    // 2 -> 3: units got `aboard` (id of the transport ship they ride on, null = on their own).
    2: (env) => {
      const state = env.state;
      if (isRecord(state) && Array.isArray(state.units)) {
        for (const u of state.units) {
          if (isRecord(u) && u.aboard === undefined) u.aboard = null;
        }
      }
      return env;
    },
    // 3 -> 4: bread and the bakery were removed (grain is food now). Bread becomes grain,
    // bakeries become farms, and the stored turn report (which may mention bread) is dropped.
    // Cities lose `supplyStreak` (the level-up supply streak no longer exists) and get a
    // `nameIndex` (their position in the city list, which is the creation order).
    3: (env) => {
      const state = env.state;
      if (!isRecord(state)) return env;
      if (Array.isArray(state.players)) {
        for (const p of state.players) {
          if (!isRecord(p)) continue;
          if (isRecord(p.goods)) {
            const bread = typeof p.goods.bread === 'number' ? p.goods.bread : 0;
            const grain = typeof p.goods.grain === 'number' ? p.goods.grain : 0;
            p.goods.grain = grain + bread;
            delete p.goods.bread;
          }
          if (Array.isArray(p.lowPriorityGoods)) {
            p.lowPriorityGoods = p.lowPriorityGoods.filter((g) => g !== 'bread');
          }
        }
      }
      if (Array.isArray(state.buildings)) {
        for (const b of state.buildings) {
          if (isRecord(b) && b.type === 'bakery') b.type = 'farm';
        }
      }
      if (Array.isArray(state.cities)) {
        state.cities.forEach((c, index) => {
          if (!isRecord(c)) return;
          delete c.supplyStreak;
          if (typeof c.nameIndex !== 'number') c.nameIndex = index;
        });
      }
      // Training orders only store the unit type (the cost is paid when ordered): nothing to convert.
      state.lastReport = null;
      return env;
    },
  };

type MigrationResult =
  { ok: true; envelope: SaveEnvelope } | { ok: false; error: 'corrupt' | 'tooNew' };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Checks the shape and upgrades an envelope step by step to SAVE_VERSION.
 * `migrations` / `targetVersion` are parameters so tests can inject a fake chain.
 */
export function migrateEnvelope(
  raw: unknown,
  migrations: Record<
    number,
    (env: Record<string, unknown>) => Record<string, unknown>
  > = MIGRATIONS,
  targetVersion: number = SAVE_VERSION,
): MigrationResult {
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT) return { ok: false, error: 'corrupt' };
  let version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { ok: false, error: 'corrupt' };
  }
  if (version > targetVersion) return { ok: false, error: 'tooNew' };
  let env: Record<string, unknown> = raw;
  while (version < targetVersion) {
    const step = migrations[version];
    if (!step) return { ok: false, error: 'corrupt' };
    try {
      env = step(env);
    } catch {
      return { ok: false, error: 'corrupt' };
    }
    version += 1;
    env = { ...env, version };
  }
  const state = env.state;
  if (!isRecord(state) || !isRecord(state.map) || !Array.isArray(state.players)) {
    return { ok: false, error: 'corrupt' };
  }
  if (!isRecord(env.summary) || typeof env.savedAt !== 'string') {
    return { ok: false, error: 'corrupt' };
  }
  return { ok: true, envelope: env as unknown as SaveEnvelope };
}

/** Builds the list summary from the state (read defensively). */
function summarize(state: GameState): SaveSummary {
  const human = state.players?.find((p) => p.isHuman);
  return {
    turn: state.turn,
    playerName: state.settings?.playerName || human?.name || '',
    aiCount: state.settings?.aiCount ?? 0,
    mapSize: String(state.settings?.mapSize ?? ''),
    seedText: state.seedText ?? '',
  };
}

export function saveGame(
  storage: KeyValueStorage,
  slot: SaveSlot,
  state: GameState,
  now: Date = new Date(),
): SaveResult {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    summary: summarize(state),
    state,
  };
  try {
    storage.setItem(slotKey(slot), JSON.stringify(envelope));
    return { ok: true };
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const quota =
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (e instanceof Error && /quota/i.test(e.message));
    return { ok: false, error: quota ? 'storageFull' : 'unavailable' };
  }
}

function readEnvelope(storage: KeyValueStorage, slot: SaveSlot): LoadResultEnvelope {
  let text: string | null;
  try {
    text = storage.getItem(slotKey(slot));
  } catch {
    return { ok: false, error: 'missing' };
  }
  if (text === null) return { ok: false, error: 'missing' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'corrupt' };
  }
  return migrateEnvelope(raw);
}

type LoadResultEnvelope = MigrationResult | { ok: false; error: 'missing' };

export function loadGame(storage: KeyValueStorage, slot: SaveSlot): LoadResult {
  const res = readEnvelope(storage, slot);
  return res.ok ? { ok: true, state: res.envelope.state } : res;
}

/** Existing, readable saves; autosave first. */
export function listSaves(storage: KeyValueStorage): SaveListEntry[] {
  const out: SaveListEntry[] = [];
  for (const slot of ALL_SLOTS) {
    const res = readEnvelope(storage, slot);
    if (res.ok) {
      out.push({ slot, summary: res.envelope.summary, savedAt: res.envelope.savedAt });
    }
  }
  return out;
}

export function deleteSave(storage: KeyValueStorage, slot: SaveSlot): void {
  try {
    storage.removeItem(slotKey(slot));
  } catch {
    // Nothing to delete if storage is unavailable.
  }
}

export function hasAutosave(storage: KeyValueStorage): boolean {
  return readEnvelope(storage, 'auto').ok;
}
