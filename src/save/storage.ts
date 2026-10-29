import { SHIFT } from '../data/shift';

export const SAVE_KEY = 'deadshift:v1';

/** Everything kept between runs. */
export interface SaveData {
  /** Longest run, seconds of game time (600 = reached 6 AM). */
  bestTime: number;
  totalKills: number;
  muted: boolean;
}

export const DEFAULT_SAVE: Readonly<SaveData> = { bestTime: 0, totalKills: 0, muted: false };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finiteNonNegative(v: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback;
}

/** Reads a stored save; anything missing or invalid falls back to its default, field by field. */
export function parseSave(raw: string | null): SaveData {
  if (raw === null) return { ...DEFAULT_SAVE };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SAVE };
  }
  if (!isRecord(data)) return { ...DEFAULT_SAVE };
  return {
    bestTime: finiteNonNegative(data.bestTime, DEFAULT_SAVE.bestTime, SHIFT.durationSeconds),
    totalKills: Math.floor(finiteNonNegative(data.totalKills, DEFAULT_SAVE.totalKills)),
    muted: typeof data.muted === 'boolean' ? data.muted : DEFAULT_SAVE.muted,
  };
}

export function serializeSave(save: Readonly<SaveData>): string {
  return JSON.stringify(save);
}

export interface RunRecord {
  save: SaveData;
  /** The run beat the previous best time. */
  newRecord: boolean;
}

/** Folds a finished run into the save. */
export function recordRun(
  save: Readonly<SaveData>,
  timeSurvived: number,
  kills: number,
): RunRecord {
  const time = finiteNonNegative(timeSurvived, 0, SHIFT.durationSeconds);
  const newRecord = time > save.bestTime;
  return {
    save: {
      ...save,
      bestTime: newRecord ? time : save.bestTime,
      totalKills: save.totalKills + Math.floor(finiteNonNegative(kills, 0)),
    },
    newRecord,
  };
}

/** The part of `Storage` we use, so tests can pass a fake. */
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;

export interface SaveStore {
  load(): SaveData;
  save(data: Readonly<SaveData>): void;
}

/** Wraps a backend that may be missing or throw (private mode, quota, disabled storage). */
export function createSaveStore(backend: StorageBackend | null): SaveStore {
  return {
    load() {
      try {
        return parseSave(backend ? backend.getItem(SAVE_KEY) : null);
      } catch {
        return { ...DEFAULT_SAVE };
      }
    },
    save(data) {
      try {
        backend?.setItem(SAVE_KEY, serializeSave(data));
      } catch {
        // Not saving is acceptable; the game keeps working with the in-memory copy.
      }
    },
  };
}

/** `window.localStorage`, or null where even reading the property throws. */
export function browserStorage(): StorageBackend | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
