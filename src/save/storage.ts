import { DEFAULT_DIFFICULTY, DIFFICULTY_IDS, type DifficultyId } from '../data/difficulty';
import { SHIFT } from '../data/shift';
import { parseDifficulty } from '../game/difficulty';

export const SAVE_KEY = 'deadshift:v1';

/** Best run and wins on one difficulty. */
export interface DifficultyRecord {
  /** Longest run, seconds of game time (600 = reached 6 AM). */
  bestTime: number;
  /** Runs that reached 6 AM. */
  wins: number;
}

/** Everything kept between runs. */
export interface SaveData {
  totalKills: number;
  muted: boolean;
  /** Show the FPS / metrics overlay (F3 or the pause-menu checkbox). */
  showDebug: boolean;
  /** Last difficulty chosen in the main menu. */
  difficulty: DifficultyId;
  records: Record<DifficultyId, DifficultyRecord>;
}

const emptyRecords = (): Record<DifficultyId, DifficultyRecord> => ({
  easy: { bestTime: 0, wins: 0 },
  normal: { bestTime: 0, wins: 0 },
  hard: { bestTime: 0, wins: 0 },
});

export const DEFAULT_SAVE: Readonly<SaveData> = {
  totalKills: 0,
  muted: false,
  showDebug: false,
  difficulty: DEFAULT_DIFFICULTY,
  records: emptyRecords(),
};

/** A fresh default save (its `records` can be modified without touching `DEFAULT_SAVE`). */
export function defaultSave(): SaveData {
  return { ...DEFAULT_SAVE, records: emptyRecords() };
}

const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function finiteNonNegative(v: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return isFiniteNonNegative(v) ? Math.min(v, max) : fallback;
}

/** One difficulty's record, field by field; `fallback` fills what is missing or invalid. */
function parseRecord(v: unknown, fallback: Readonly<DifficultyRecord>): DifficultyRecord {
  const r = isRecord(v) ? v : {};
  return {
    bestTime: finiteNonNegative(r.bestTime, fallback.bestTime, SHIFT.durationSeconds),
    wins: Math.floor(finiteNonNegative(r.wins, fallback.wins)),
  };
}

/**
 * Saves from before the difficulties (Hito 11) kept a single top-level `bestTime`: it becomes the
 * easy record. A best time that reached 6 AM proves at least one win.
 */
function legacyEasyRecord(data: Record<string, unknown>): DifficultyRecord {
  const bestTime = finiteNonNegative(data.bestTime, 0, SHIFT.durationSeconds);
  return { bestTime, wins: bestTime >= SHIFT.durationSeconds ? 1 : 0 };
}

function parseRecords(data: Record<string, unknown>): Record<DifficultyId, DifficultyRecord> {
  const stored = isRecord(data.records) ? data.records : {};
  const records = emptyRecords();
  for (const id of DIFFICULTY_IDS) {
    const fallback = id === 'easy' ? legacyEasyRecord(data) : records[id];
    records[id] = parseRecord(stored[id], fallback);
  }
  return records;
}

/** Reads a stored save; anything missing or invalid falls back to its default, field by field. */
export function parseSave(raw: string | null): SaveData {
  if (raw === null) return defaultSave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSave();
  }
  if (!isRecord(data)) return defaultSave();
  return {
    totalKills: Math.floor(finiteNonNegative(data.totalKills, DEFAULT_SAVE.totalKills)),
    muted: boolOr(data.muted, DEFAULT_SAVE.muted),
    showDebug: boolOr(data.showDebug, DEFAULT_SAVE.showDebug),
    difficulty: parseDifficulty(data.difficulty) ?? DEFAULT_SAVE.difficulty,
    records: parseRecords(data),
  };
}

export function serializeSave(save: Readonly<SaveData>): string {
  return JSON.stringify(save);
}

export interface RunRecord {
  save: SaveData;
  /** The run beat the previous best time on its difficulty. */
  newRecord: boolean;
}

/** Folds a finished run into the save, under the difficulty it was played on. */
export function recordRun(
  save: Readonly<SaveData>,
  difficulty: DifficultyId,
  timeSurvived: number,
  kills: number,
  won: boolean,
): RunRecord {
  const time = finiteNonNegative(timeSurvived, 0, SHIFT.durationSeconds);
  const prev = save.records[difficulty];
  const newRecord = time > prev.bestTime;
  return {
    save: {
      ...save,
      totalKills: save.totalKills + Math.floor(finiteNonNegative(kills, 0)),
      records: {
        ...save.records,
        [difficulty]: {
          bestTime: newRecord ? time : prev.bestTime,
          wins: prev.wins + (won ? 1 : 0),
        },
      },
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
        return defaultSave();
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
