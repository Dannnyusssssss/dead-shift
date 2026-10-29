import { SHIFT } from '../data/shift';
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

/** Steps of 1/60 s don't add up to exactly 600; anything this close counts as dawn. */
const DAWN_EPSILON = 1e-6;

/** Dawn ends the run with a victory (and pins the clock to exactly 6:00 AM). */
export function checkDawn(world: World): void {
  if (world.status === 'playing' && world.time >= SHIFT.durationSeconds - DAWN_EPSILON) {
    world.time = SHIFT.durationSeconds;
    world.status = 'won';
  }
}
