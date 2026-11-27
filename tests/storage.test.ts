import { describe, expect, it } from 'vitest';
import { DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, PAD_BUTTON } from '../src/data/controls';
import { DIFFICULTY_IDS } from '../src/data/difficulty';
import { SHIFT } from '../src/data/shift';
import {
  DEFAULT_SAVE,
  MAX_SAVED_COUNT,
  MAX_SAVE_LENGTH,
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
    removeItem: (k) => {
      delete data[k];
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
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

/** A save with some records, for round trips. */
function sampleSave(): SaveData {
  return {
    totalKills: 999,
    muted: true,
    showDebug: true,
    difficulty: 'hard',
    reducedMotion: true,
    records: {
      easy: { bestTime: 600, wins: 3 },
      normal: { bestTime: 321.5, wins: 0 },
      hard: { bestTime: 90, wins: 0 },
    },
    keyBindings: { ...DEFAULT_KEY_BINDINGS, fire: 'KeyF', up: 'KeyI' },
    padBindings: { ...DEFAULT_PAD_BINDINGS, fire: PAD_BUTTON.bottom },
    viewScale: 115,
    touchSensitivity: 5,
    padSensitivity: 1,
    aimAssist: true,
    fireMode: 'toggle',
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
      ...DEFAULT_SAVE,
      totalKills: 999,
      muted: true,
      showDebug: true,
      difficulty: 'easy',
      reducedMotion: null,
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
      expect(() => store.clear()).not.toThrow();
    }
  });

  it('clear removes only this game key, and the next load is a fresh save', () => {
    const backend = memoryBackend({ other: 'keep' });
    const store = createSaveStore(backend);
    store.save(sampleSave());
    store.clear();
    expect(backend.data).toEqual({ other: 'keep' });
    expect(store.load()).toEqual(DEFAULT_SAVE);
  });
});

describe('hostile saves', () => {
  it('rejects an oversized save before parsing it', () => {
    const big = JSON.stringify({ ...sampleSave(), pad: 'x'.repeat(MAX_SAVE_LENGTH) });
    expect(parseSave(big)).toEqual(DEFAULT_SAVE);
  });

  it('caps huge counters and drops overflowing numbers', () => {
    const save = parseSave(
      '{"totalKills":1e300,"records":{"easy":{"bestTime":1e999,"wins":5e20}}}',
    );
    expect(save.totalKills).toBe(MAX_SAVED_COUNT);
    expect(save.records.easy).toEqual({ bestTime: 0, wins: MAX_SAVED_COUNT });
  });

  it('ignores __proto__ and constructor keys without polluting objects', () => {
    const raw =
      '{"__proto__":{"polluted":true},"constructor":{"x":1},' +
      '"records":{"__proto__":{"bestTime":600},"easy":{"__proto__":{"wins":9}}}}';
    const save = parseSave(raw);
    expect(save).toEqual(DEFAULT_SAVE);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(save)).toBe(Object.prototype);
  });

  it('a counter at the cap stays at the cap after another run', () => {
    const save = { ...sampleSave(), totalKills: MAX_SAVED_COUNT };
    expect(recordRun(save, 'easy', 10, 50, false).save.totalKills).toBe(MAX_SAVED_COUNT);
  });
});

describe('reducedMotion', () => {
  it('defaults to null (follow the system) and keeps an explicit choice', () => {
    expect(DEFAULT_SAVE.reducedMotion).toBeNull();
    expect(parseSave('{"reducedMotion":true}').reducedMotion).toBe(true);
    expect(parseSave('{"reducedMotion":false}').reducedMotion).toBe(false);
  });

  it('falls back to null when missing or invalid', () => {
    for (const v of ['"yes"', '1', 'null', '{}']) {
      expect(parseSave(`{"reducedMotion":${v}}`).reducedMotion).toBeNull();
    }
    expect(parseSave('{"muted":true}').reducedMotion).toBeNull();
  });
});

describe('control settings', () => {
  it('a save from before the controls menu loads with the usual controls', () => {
    const save = parseSave('{"totalKills":5,"muted":true}');
    expect(save.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
    expect(save.padBindings).toEqual(DEFAULT_PAD_BINDINGS);
    expect(save.viewScale).toBe(100);
    expect(save.touchSensitivity).toBe(3);
    expect(save.padSensitivity).toBe(3);
    expect(save.aimAssist).toBe(false);
    expect(save.fireMode).toBe('hold');
  });

  it('keeps only the listed values, without coercion', () => {
    const bad = [
      ['viewScale', ['"100"', '101', '1e999', '-80', 'null', '[]', '{}', 'true']],
      ['touchSensitivity', ['"3"', '0', '6', '2.5', 'null']],
      ['padSensitivity', ['"5"', '-1', '99', 'false']],
      ['aimAssist', ['"true"', '1', 'null']],
      ['fireMode', ['"HOLD"', '"auto"', '1', 'null', '["toggle"]']],
    ] as const;
    for (const [field, values] of bad) {
      for (const v of values) {
        expect(parseSave(`{"${field}":${v}}`)[field]).toEqual(DEFAULT_SAVE[field]);
      }
    }
    expect(parseSave('{"viewScale":80}').viewScale).toBe(80);
    expect(parseSave('{"fireMode":"toggle"}').fireMode).toBe('toggle');
  });

  it('rejects fixed, unknown, repeated or non-string keys', () => {
    expect(parseSave('{"keyBindings":{"pause":"Escape"}}').keyBindings).toEqual(
      DEFAULT_KEY_BINDINGS,
    );
    expect(parseSave('{"keyBindings":{"fire":"<img onerror=x>"}}').keyBindings.fire).toBe('Space');
    expect(parseSave('{"keyBindings":{"fire":"KeyW"}}').keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
    expect(parseSave('{"keyBindings":"KeyW"}').keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
    expect(parseSave('{"keyBindings":{"fire":"KeyF"}}').keyBindings.fire).toBe('KeyF');
    expect(parseSave('{"padBindings":{"fire":16}}').padBindings).toEqual(DEFAULT_PAD_BINDINGS);
  });

  it('prototype keys inside the bindings are ignored and pollute nothing', () => {
    const raw =
      '{"keyBindings":{"__proto__":{"fire":"KeyZ"},"fire":"KeyF"},"padBindings":{"__proto__":{"fire":0}}}';
    const save = parseSave(raw);
    expect(save.keyBindings.fire).toBe('KeyF');
    expect(save.padBindings).toEqual(DEFAULT_PAD_BINDINGS);
    expect(({} as Record<string, unknown>).fire).toBeUndefined();
    expect(Object.getPrototypeOf(save.keyBindings)).toBe(Object.prototype);
  });

  it('extra unknown fields are dropped on the next save', () => {
    const save = parseSave('{"keyBindings":{"fire":"KeyF","jump":"KeyJ"},"cheats":true}');
    const written = JSON.parse(serializeSave(save)) as Record<string, unknown>;
    expect(written.cheats).toBeUndefined();
    expect((written.keyBindings as Record<string, unknown>).jump).toBeUndefined();
  });

  it('a full save with every setting still fits well under the size limit', () => {
    expect(serializeSave(sampleSave()).length).toBeLessThan(MAX_SAVE_LENGTH / 5);
  });

  it('the defaults never share objects with a parsed save', () => {
    const save = parseSave(null);
    save.keyBindings.fire = 'KeyF';
    save.padBindings.fire = 0;
    expect(DEFAULT_SAVE.keyBindings.fire).toBe('Space');
    expect(DEFAULT_SAVE.padBindings.fire).toBe(PAD_BUTTON.rt);
  });
});
