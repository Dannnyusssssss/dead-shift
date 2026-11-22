import { describe, expect, it } from 'vitest';
import { COMBAT } from '../src/data/combat';
import { SHIFT } from '../src/data/shift';
import { parseDebugOptions } from '../src/game/debug-options';

describe('parseDebugOptions', () => {
  it('no parameters: nothing enabled, nothing assisted', () => {
    const o = parseDebugOptions('');
    expect(o.enabled).toBe(false);
    expect(o.assisted).toBe(false);
    expect(o).toMatchObject({ spawn: 0, god: false, allWeapons: false, startTime: 0, ammo: null });
  });

  it('every switch that changes the run counts as assisted', () => {
    for (const q of [
      '?god',
      '?t=300',
      '?spawn=50',
      '?weapons=all',
      '?weapons=evolved',
      '?ammo=0',
    ]) {
      const o = parseDebugOptions(q);
      expect(o.assisted, q).toBe(true);
      expect(o.enabled, q).toBe(true);
    }
  });

  it('?debug and a valid ?difficulty enable the session but are not assists', () => {
    for (const q of ['?debug', '?difficulty=hard', '?debug&difficulty=easy']) {
      const o = parseDebugOptions(q);
      expect(o.enabled, q).toBe(true);
      expect(o.assisted, q).toBe(false);
    }
    expect(parseDebugOptions('?difficulty=insane').enabled).toBe(false);
  });

  it('hostile numbers fall back to 0 or are capped', () => {
    for (const q of ['?t=-1', '?t=abc', '?t=1e999', '?t=NaN', '?spawn=-5', '?spawn=Infinity']) {
      const o = parseDebugOptions(q);
      expect(o.startTime, q).toBe(0);
      expect(o.spawn, q).toBe(0);
    }
    expect(parseDebugOptions('?t=99999').startTime).toBe(SHIFT.durationSeconds - 1);
    expect(parseDebugOptions('?spawn=99999').spawn).toBe(COMBAT.maxEnemies);
    expect(parseDebugOptions('?spawn=12.9').spawn).toBe(12);
    expect(parseDebugOptions('?ammo=-3').ammo).toBe(0);
  });

  it('only exact weapon values are accepted; the first repeated value wins', () => {
    for (const q of ['?weapons=__proto__', '?weapons=ALL', '?weapons=constructor']) {
      expect(parseDebugOptions(q).allWeapons, q).toBe(false);
      expect(parseDebugOptions(q).assisted, q).toBe(false);
    }
    expect(parseDebugOptions('?t=10&t=500').startTime).toBe(10);
  });
});
