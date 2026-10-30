import { describe, expect, it } from 'vitest';
import { DIFFICULTY_IDS } from '../src/data/difficulty';
import { SHIFT } from '../src/data/shift';
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  createSaveStore,
  parseSave,
  recordRun,
  serializeSave,
  type SaveData,
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

/** A save with some records, for round trips. */
function sampleSave(): SaveData {
  return {
    totalKills: 999,
    muted: true,
    showDebug: true,
    difficulty: 'hard',
    records: {
      easy: { bestTime: 600, wins: 3 },
      normal: { bestTime: 321.5, wins: 0 },
      hard: { bestTime: 90, wins: 0 },
    },
  };
}

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
    const save = sampleSave();
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('replaces invalid fields one by one and keeps the valid ones', () => {
    const raw = JSON.stringify({ totalKills: 'many', muted: true, difficulty: 'nightmare' });
    expect(parseSave(raw)).toEqual({ ...DEFAULT_SAVE, muted: true });
    const raw2 = JSON.stringify({ totalKills: 12.7, muted: 'yes', difficulty: 'normal' });
    expect(parseSave(raw2)).toEqual({ ...DEFAULT_SAVE, totalKills: 12, difficulty: 'normal' });
  });

  it('reads showDebug, defaulting to hidden when missing or invalid', () => {
    expect(DEFAULT_SAVE.showDebug).toBe(false);
    expect(parseSave(JSON.stringify({ muted: true })).showDebug).toBe(false);
    expect(parseSave(JSON.stringify({ showDebug: true })).showDebug).toBe(true);
    const raw = JSON.stringify({ muted: true, showDebug: 'on' });
    expect(parseSave(raw)).toEqual({ ...DEFAULT_SAVE, muted: true });
  });

  it('starts on easy with empty records', () => {
    expect(DEFAULT_SAVE.difficulty).toBe('easy');
    for (const id of DIFFICULTY_IDS)
      expect(DEFAULT_SAVE.records[id]).toEqual({ bestTime: 0, wins: 0 });
  });

  it('validates every record field by field', () => {
    const raw = JSON.stringify({
      records: {
        easy: { bestTime: -5, wins: 2 },
        normal: { bestTime: 1e9, wins: 'lots' },
        hard: 'corrupt',
      },
    });
    expect(parseSave(raw).records).toEqual({
      easy: { bestTime: 0, wins: 2 },
      normal: { bestTime: SHIFT.durationSeconds, wins: 0 },
      hard: { bestTime: 0, wins: 0 },
    });
    expect(parseSave(JSON.stringify({ records: { easy: { wins: 4.9 } } })).records.easy.wins).toBe(
      4,
    );
    expect(parseSave(JSON.stringify({ records: [1, 2] })).records).toEqual(DEFAULT_SAVE.records);
  });
});

describe('migration of saves from before the difficulties', () => {
  it('moves the old best time to easy and keeps the other settings', () => {
    const old = JSON.stringify({ bestTime: 321.5, totalKills: 999, muted: true, showDebug: true });
    expect(parseSave(old)).toEqual({
      totalKills: 999,
      muted: true,
      showDebug: true,
      difficulty: 'easy',
      records: {
        easy: { bestTime: 321.5, wins: 0 },
        normal: { bestTime: 0, wins: 0 },
        hard: { bestTime: 0, wins: 0 },
      },
    });
  });

  it('an old best time at 6 AM counts as one win on easy', () => {
    const save = parseSave(JSON.stringify({ bestTime: SHIFT.durationSeconds }));
    expect(save.records.easy).toEqual({ bestTime: SHIFT.durationSeconds, wins: 1 });
  });

  it('caps or drops an invalid old best time', () => {
    expect(parseSave(JSON.stringify({ bestTime: 1e9 })).records.easy.bestTime).toBe(
      SHIFT.durationSeconds,
    );
    expect(parseSave(JSON.stringify({ bestTime: 'x' })).records.easy).toEqual({
      bestTime: 0,
      wins: 0,
    });
  });

  it('a valid easy record wins over a stray old field, and the old field is not written back', () => {
    const raw = JSON.stringify({ bestTime: 500, records: { easy: { bestTime: 200, wins: 0 } } });
    const save = parseSave(raw);
    expect(save.records.easy.bestTime).toBe(200);
    expect(JSON.parse(serializeSave(save))).not.toHaveProperty('bestTime');
  });

  it('the migrated record survives a save and load', () => {
    const store = createSaveStore(memoryBackend({ [SAVE_KEY]: JSON.stringify({ bestTime: 250 }) }));
    const migrated = store.load();
    store.save(migrated);
    expect(store.load().records.easy.bestTime).toBe(250);
  });
});

describe('recordRun', () => {
  it('flags a new record and keeps the longer time, per difficulty', () => {
    const first = recordRun(DEFAULT_SAVE, 'normal', 120, 50, false);
    expect(first.newRecord).toBe(true);
    expect(first.save.records.normal).toEqual({ bestTime: 120, wins: 0 });
    expect(first.save.records.easy).toEqual(DEFAULT_SAVE.records.easy);
    expect(first.save.totalKills).toBe(50);

    const worse = recordRun(first.save, 'normal', 90, 30, false);
    expect(worse.newRecord).toBe(false);
    expect(worse.save.records.normal.bestTime).toBe(120);
    expect(worse.save.totalKills).toBe(80);

    // A shorter run on another difficulty is still that difficulty's record.
    expect(recordRun(first.save, 'hard', 60, 0, false).newRecord).toBe(true);
  });

  it('counts wins on the difficulty played', () => {
    const won = recordRun(DEFAULT_SAVE, 'hard', SHIFT.durationSeconds, 900, true).save;
    expect(won.records.hard).toEqual({ bestTime: SHIFT.durationSeconds, wins: 1 });
    const again = recordRun(won, 'hard', SHIFT.durationSeconds, 900, true);
    expect(again.newRecord).toBe(false);
    expect(again.save.records.hard.wins).toBe(2);
    expect(again.save.records.easy.wins).toBe(0);
  });

  it('an equal time is not a new record', () => {
    const save = recordRun(DEFAULT_SAVE, 'easy', 200, 0, false).save;
    expect(recordRun(save, 'easy', 200, 0, false).newRecord).toBe(false);
  });

  it('does not mutate the input and keeps the settings', () => {
    const save = sampleSave();
    const result = recordRun(save, 'hard', 300, 2, false);
    expect(save).toEqual(sampleSave());
    expect(DEFAULT_SAVE.records.hard.bestTime).toBe(0);
    expect(result.save.muted).toBe(true);
    expect(result.save.showDebug).toBe(true);
    expect(result.save.difficulty).toBe('hard');
  });
});

describe('createSaveStore', () => {
  it('saves under deadshift:v1 and loads it back', () => {
    const backend = memoryBackend();
    const store = createSaveStore(backend);
    const save = sampleSave();
    store.save(save);
    expect(Object.keys(backend.data)).toEqual([SAVE_KEY]);
    expect(store.load()).toEqual(save);
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
