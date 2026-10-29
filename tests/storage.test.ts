import { describe, expect, it } from 'vitest';
import { SHIFT } from '../src/data/shift';
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  createSaveStore,
  parseSave,
  recordRun,
  serializeSave,
  type StorageBackend,
} from '../src/save/storage';

function memoryBackend(initial: Record<string, string> = {}): StorageBackend & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing: StorageBackend = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('parseSave', () => {
  it('returns defaults when nothing is stored', () => {
    expect(parseSave(null)).toEqual(DEFAULT_SAVE);
  });

  it('returns defaults for corrupt JSON or non-objects', () => {
    for (const raw of ['{oops', '', 'null', '42', '"text"', '[1,2]']) {
      expect(parseSave(raw)).toEqual(DEFAULT_SAVE);
    }
  });

  it('round-trips a valid save', () => {
    const save = { bestTime: 321.5, totalKills: 999, muted: true };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('replaces invalid fields one by one and keeps the valid ones', () => {
    const raw = JSON.stringify({ bestTime: -5, totalKills: 'many', muted: true });
    expect(parseSave(raw)).toEqual({ ...DEFAULT_SAVE, muted: true });
    const raw2 = JSON.stringify({ bestTime: 100, totalKills: 12.7, muted: 'yes' });
    expect(parseSave(raw2)).toEqual({ bestTime: 100, totalKills: 12, muted: false });
  });

  it('caps the best time at the shift length', () => {
    expect(parseSave(JSON.stringify({ bestTime: 1e9 })).bestTime).toBe(SHIFT.durationSeconds);
  });
});

describe('recordRun', () => {
  it('flags a new record and keeps the longer time', () => {
    const first = recordRun(DEFAULT_SAVE, 120, 50);
    expect(first.newRecord).toBe(true);
    expect(first.save).toEqual({ ...DEFAULT_SAVE, bestTime: 120, totalKills: 50 });

    const worse = recordRun(first.save, 90, 30);
    expect(worse.newRecord).toBe(false);
    expect(worse.save.bestTime).toBe(120);
    expect(worse.save.totalKills).toBe(80);
  });

  it('an equal time is not a new record', () => {
    expect(recordRun({ ...DEFAULT_SAVE, bestTime: 200 }, 200, 0).newRecord).toBe(false);
  });

  it('does not mutate the input and keeps the sound setting', () => {
    const save = { bestTime: 10, totalKills: 1, muted: true };
    const result = recordRun(save, 20, 2);
    expect(save).toEqual({ bestTime: 10, totalKills: 1, muted: true });
    expect(result.save.muted).toBe(true);
  });
});

describe('createSaveStore', () => {
  it('saves under deadshift:v1 and loads it back', () => {
    const backend = memoryBackend();
    const store = createSaveStore(backend);
    store.save({ bestTime: 300, totalKills: 7, muted: true });
    expect(Object.keys(backend.data)).toEqual([SAVE_KEY]);
    expect(store.load()).toEqual({ bestTime: 300, totalKills: 7, muted: true });
  });

  it('tolerates corrupt stored data', () => {
    const store = createSaveStore(memoryBackend({ [SAVE_KEY]: '}{' }));
    expect(store.load()).toEqual(DEFAULT_SAVE);
  });

  it('never throws when storage is missing or throws', () => {
    for (const backend of [null, throwing]) {
      const store = createSaveStore(backend);
      expect(store.load()).toEqual(DEFAULT_SAVE);
      expect(() => store.save(DEFAULT_SAVE)).not.toThrow();
    }
  });
});
