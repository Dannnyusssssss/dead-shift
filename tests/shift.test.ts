import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { SHIFT } from '../src/data/shift';
import { checkDawn, shiftClock, shiftProgress } from '../src/game/shift';
import { emptyWorld } from './helpers';

describe('shiftClock', () => {
  it('maps 10 real minutes onto 10 PM -> 6 AM', () => {
    expect(shiftClock(0)).toBe('10:00 PM');
    expect(shiftClock(75)).toBe('11:00 PM');
    expect(shiftClock(150)).toBe('12:00 AM');
    expect(shiftClock(225)).toBe('1:00 AM');
    expect(shiftClock(300)).toBe('2:00 AM');
    expect(shiftClock(600)).toBe('6:00 AM');
  });

  it('advances about 48 in-game minutes per real minute', () => {
    expect(shiftClock(60)).toBe('10:48 PM');
  });

  it('clamps outside the shift', () => {
    expect(shiftClock(-10)).toBe('10:00 PM');
    expect(shiftClock(9999)).toBe('6:00 AM');
    expect(shiftProgress(300)).toBeCloseTo(0.5);
  });
});

describe('dawn', () => {
  it('wins the run exactly at 6:00 AM', () => {
    const world = emptyWorld();
    world.time = SHIFT.durationSeconds - FIXED_STEP;
    checkDawn(world);
    expect(world.status).toBe('playing');
    world.time = SHIFT.durationSeconds - 1e-9;
    checkDawn(world);
    expect(world.status).toBe('won');
    expect(world.time).toBe(SHIFT.durationSeconds);
    expect(shiftClock(world.time)).toBe('6:00 AM');
  });

  it('does not revive a dead player', () => {
    const world = emptyWorld();
    world.status = 'dead';
    world.time = SHIFT.durationSeconds;
    checkDawn(world);
    expect(world.status).toBe('dead');
  });
});
