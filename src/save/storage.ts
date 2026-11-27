import { parseKeyBindings, parsePadBindings } from '../core/bindings';
import {
  DEFAULT_FIRE_MODE,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  DEFAULT_SENSITIVITY,
  DEFAULT_VIEW_SCALE,
  FIRE_MODES,
  SENSITIVITY_LEVELS,
  VIEW_SCALES,
  type FireMode,
  type KeyBindings,
  type PadBindings,
  type SensitivityLevel,
  type ViewScale,
} from '../data/controls';
import { DEFAULT_DIFFICULTY, DIFFICULTY_IDS, type DifficultyId } from '../data/difficulty';
import { SHIFT } from '../data/shift';
import { parseDifficulty } from '../game/difficulty';

export const SAVE_KEY = 'deadshift:v1';

/** Ceiling for lifetime counters (kills, wins): far above any real play, far below float limits. */
export const MAX_SAVED_COUNT = 1_000_000_000;

/** A real save is a few hundred characters; anything far longer is rejected before parsing. */
export const MAX_SAVE_LENGTH = 10_000;

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
  /** «Reducir movimiento» chosen in the menu, or null to follow `prefers-reduced-motion`. */
  reducedMotion: boolean | null;
  records: Record<DifficultyId, DifficultyRecord>;
  /** «Controles»: assigned keys (`KeyboardEvent.code`) and gamepad buttons. */
  keyBindings: KeyBindings;
  padBindings: PadBindings;
  /** «Campo de visión», percent of the default view. */
  viewScale: ViewScale;
  touchSensitivity: SensitivityLevel;
  padSensitivity: SensitivityLevel;
  /** «Apuntado asistido» for the Pistol and Shotgun. */
  aimAssist: boolean;
  fireMode: FireMode;
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
  reducedMotion: null,
  records: emptyRecords(),
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  padBindings: { ...DEFAULT_PAD_BINDINGS },
  viewScale: DEFAULT_VIEW_SCALE,
  touchSensitivity: DEFAULT_SENSITIVITY,
  padSensitivity: DEFAULT_SENSITIVITY,
  aimAssist: false,
  fireMode: DEFAULT_FIRE_MODE,
};

/** A fresh default save (its nested objects can be modified without touching `DEFAULT_SAVE`). */
export function defaultSave(): SaveData {
  return {
    ...DEFAULT_SAVE,
    records: emptyRecords(),
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    padBindings: { ...DEFAULT_PAD_BINDINGS },
  };
}

/** `v` if it is one of `allowed` (compared by identity: no coercion of "100" to 100). */
function oneOf<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === v) ?? fallback;
}

const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function finiteNonNegative(v: unknown, fallback: number, max: number): number {
  return isFiniteNonNegative(v) ? Math.min(v, max) : fallback;
}

/** A lifetime counter: whole, non-negative and capped at `MAX_SAVED_COUNT`. */
function count(v: unknown, fallback: number): number {
  return Math.floor(finiteNonNegative(v, fallback, MAX_SAVED_COUNT));
}

const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/** One difficulty's record, field by field; `fallback` fills what is missing or invalid. */
function parseRecord(v: unknown, fallback: Readonly<DifficultyRecord>): DifficultyRecord {
  const r = isRecord(v) ? v : {};
  return {
    bestTime: finiteNonNegative(r.bestTime, fallback.bestTime, SHIFT.durationSeconds),
    wins: count(r.wins, fallback.wins),
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
  if (raw === null || raw.length > MAX_SAVE_LENGTH) return defaultSave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSave();
  }
  if (!isRecord(data)) return defaultSave();
  return {
    totalKills: count(data.totalKills, DEFAULT_SAVE.totalKills),
    muted: boolOr(data.muted, DEFAULT_SAVE.muted),
    showDebug: boolOr(data.showDebug, DEFAULT_SAVE.showDebug),
    difficulty: parseDifficulty(data.difficulty) ?? DEFAULT_SAVE.difficulty,
    reducedMotion: boolOrNull(data.reducedMotion),
    records: parseRecords(data),
    keyBindings: parseKeyBindings(data.keyBindings),
    padBindings: parsePadBindings(data.padBindings),
    viewScale: oneOf(data.viewScale, VIEW_SCALES, DEFAULT_SAVE.viewScale),
    touchSensitivity: oneOf(
      data.touchSensitivity,
      SENSITIVITY_LEVELS,
      DEFAULT_SAVE.touchSensitivity,
    ),
    padSensitivity: oneOf(data.padSensitivity, SENSITIVITY_LEVELS, DEFAULT_SAVE.padSensitivity),
    aimAssist: boolOr(data.aimAssist, DEFAULT_SAVE.aimAssist),
    fireMode: oneOf(data.fireMode, FIRE_MODES, DEFAULT_SAVE.fireMode),
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
      totalKills: Math.min(save.totalKills + count(kills, 0), MAX_SAVED_COUNT),
      records: {
        ...save.records,
        [difficulty]: {
          bestTime: newRecord ? time : prev.bestTime,
          wins: Math.min(prev.wins + (won ? 1 : 0), MAX_SAVED_COUNT),
        },
      },
    },
    newRecord,
  };
}

/** The part of `Storage` we use, so tests can pass a fake. */
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface SaveStore {
  load(): SaveData;
  save(data: Readonly<SaveData>): void;
  /** «Borrar datos guardados»: removes only this game's key from this browser. */
  clear(): void;
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
    clear() {
      try {
        backend?.removeItem(SAVE_KEY);
      } catch {
        // Storage blocked: there is nothing this page can remove.
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
