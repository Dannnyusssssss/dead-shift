import { FRENZY, SHIFT } from '../data/shift';
import { emit } from './events';
import type { World } from './world';

const MINUTES_PER_DAY = 24 * 60;

/** In-game wall clock for a moment of the run, e.g. "10:00 PM", "2:00 AM", "6:00 AM". */
export function shiftClock(time: number): string {
  const progress = Math.min(1, Math.max(0, time / SHIFT.durationSeconds));
  const minutes = Math.floor(SHIFT.startHour * 60 + progress * SHIFT.hours * 60) % MINUTES_PER_DAY;
  const h24 = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 0 at 10 PM, 1 at 6 AM. */
export function shiftProgress(time: number): number {
  return Math.min(1, Math.max(0, time / SHIFT.durationSeconds));
}

/** Game time at which the shift clock shows `hour` (0-23) o'clock, s. */
export function timeAtHour(hour: number): number {
  const hoursIn = (hour - SHIFT.startHour + 24) % 24;
  return (hoursIn / SHIFT.hours) * SHIFT.durationSeconds;
}

/** Game time when the 5 AM frenzy starts, s. */
export const FRENZY_START = timeAtHour(FRENZY.startHour);

export function isFrenzy(time: number): boolean {
  return time >= FRENZY_START;
}

/** Enemy speed multiplier given its slow (fraction removed, 0 = none) and the frenzy. */
export function enemySpeedScale(slow: number, frenzy: boolean): number {
  if (!frenzy) return 1 - slow;
  return (1 - slow * (1 - FRENZY.slowResist)) * FRENZY.speedMultiplier;
}

/** Turns the frenzy on once (and tells the presentation layer). */
export function frenzySystem(world: World): void {
  if (world.frenzy || !isFrenzy(world.time)) return;
  world.frenzy = true;
  emit(world.events, 'frenzyStart', world.player.pos.x, world.player.pos.y);
}

/** Steps of 1/60 s don't add up to exactly 600; anything this close counts as dawn. */
const DAWN_EPSILON = 1e-6;

/** Dawn ends the run with a victory (and pins the clock to exactly 6:00 AM). */
export function checkDawn(world: World): void {
  if (world.status === 'playing' && world.time >= SHIFT.durationSeconds - DAWN_EPSILON) {
    world.time = SHIFT.durationSeconds;
    world.status = 'won';
  }
}
